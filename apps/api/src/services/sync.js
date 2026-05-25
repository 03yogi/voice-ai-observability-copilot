import { randomUUID } from 'crypto';
import { getDb } from '../db.js';
import * as ghl from '../ghl/client.js';
import { credentialsFromMonitoredRow } from '../ghl/credentials.js';
import { assertLlmConfigured } from './llm-settings.js';
import { evaluateCallSession, getEvaluationContextForAgent } from './evaluate.js';
import { computeEvalFingerprint, shouldReevaluateCall } from './eval-fingerprint.js';
import { assertMonitoredAgentsConfigured } from './monitored-agents.js';
import { ensureAgentRecordForMonitored } from './agent-records.js';
import { saveEvaluation } from './call-analyze.js';
import { normalizeCallLog } from '../ghl/normalize-call-log.js';

function needsEvaluation(callRow, existingEval, agentRow, evaluationPrompt) {
  if (!existingEval) return true;
  if (callRow.status === 'pending') return true;
  if (!callRow.transcript?.trim() && existingEval.evaluated_by?.startsWith('system')) {
    return false;
  }
  return shouldReevaluateCall(callRow, agentRow, existingEval, evaluationPrompt);
}

export async function runSync({ ghlAgentId = null } = {}) {
  assertLlmConfigured();
  let monitored = assertMonitoredAgentsConfigured();
  if (ghlAgentId) {
    monitored = monitored.filter((row) => row.ghl_agent_id === ghlAgentId);
    if (!monitored.length) {
      const err = new Error('Agent not found or not configured for monitoring');
      err.status = 404;
      throw err;
    }
  }

  const db = getDb();
  const startedAt = new Date().toISOString();
  const run = db.prepare('INSERT INTO sync_runs (started_at) VALUES (?)').run(startedAt);

  let agentsSynced = 0;
  let callsSynced = 0;
  let callsEvaluated = 0;
  let callsSkipped = 0;
  const evalErrors = [];

  try {
    const upsertAgent = db.prepare(`
      INSERT INTO agents (id, ghl_agent_id, location_id, name, business_name, welcome_message, agent_prompt, success_criteria, synced_at)
      VALUES (@id, @ghl_agent_id, @location_id, @name, @business_name, @welcome_message, @agent_prompt, @success_criteria, @synced_at)
      ON CONFLICT(ghl_agent_id) DO UPDATE SET
        name = excluded.name,
        business_name = excluded.business_name,
        welcome_message = excluded.welcome_message,
        agent_prompt = excluded.agent_prompt,
        location_id = excluded.location_id,
        synced_at = excluded.synced_at
    `);

    const upsertCall = db.prepare(`
      INSERT INTO calls (id, ghl_call_id, agent_id, contact_id, started_at, duration_sec, summary, transcript, transcript_json, extracted_data, trial_call, status, synced_at)
      VALUES (@id, @ghl_call_id, @agent_id, @contact_id, @started_at, @duration_sec, @summary, @transcript, @transcript_json, @extracted_data, @trial_call, @status, @synced_at)
      ON CONFLICT(ghl_call_id) DO UPDATE SET
        summary = excluded.summary,
        transcript = excluded.transcript,
        transcript_json = excluded.transcript_json,
        extracted_data = excluded.extracted_data,
        duration_sec = excluded.duration_sec,
        synced_at = excluded.synced_at,
        status = CASE
          WHEN IFNULL(calls.transcript, '') != IFNULL(excluded.transcript, '')
            OR IFNULL(calls.summary, '') != IFNULL(excluded.summary, '')
            OR IFNULL(calls.extracted_data, '') != IFNULL(excluded.extracted_data, '')
          THEN 'pending'
          ELSE calls.status
        END
    `);

    const getEval = db.prepare('SELECT * FROM call_evaluations WHERE call_id = ?');

    for (const monitoredRow of monitored) {
      const creds = credentialsFromMonitoredRow(monitoredRow);
      const agentsRes = await ghl.listAgents(creds);
      const ghlAgent = (agentsRes.agents || []).find((a) => a.id === monitoredRow.ghl_agent_id);

      if (ghlAgent) {
        upsertAgent.run({
          id: randomUUID(),
          ghl_agent_id: ghlAgent.id,
          location_id: ghlAgent.locationId || creds.locationId,
          name: ghlAgent.agentName,
          business_name: ghlAgent.businessName,
          welcome_message: ghlAgent.welcomeMessage,
          agent_prompt: ghlAgent.agentPrompt,
          success_criteria: '{}',
          synced_at: startedAt,
        });
        agentsSynced += 1;
      } else {
        ensureAgentRecordForMonitored(monitoredRow);
      }

      const agentRow = db.prepare('SELECT * FROM agents WHERE ghl_agent_id = ?').get(monitoredRow.ghl_agent_id);
      if (!agentRow) continue;

      const logsRes = await ghl.listAllCallLogs(creds, { agentId: monitoredRow.ghl_agent_id });

      for (const rawLog of logsRes.callLogs || []) {
        const log = normalizeCallLog(rawLog);
        const extractedJson = JSON.stringify(log.extractedData);

        upsertCall.run({
          id: randomUUID(),
          ghl_call_id: log.id,
          agent_id: agentRow.id,
          contact_id: log.contactId,
          started_at: log.createdAt,
          duration_sec: log.duration,
          summary: log.summary,
          transcript: log.transcript,
          transcript_json: JSON.stringify(log.transcriptWithToolCalls || []),
          extracted_data: extractedJson,
          trial_call: log.trialCall ? 1 : 0,
          status: 'pending',
          synced_at: startedAt,
        });

        const callRow = db.prepare('SELECT * FROM calls WHERE ghl_call_id = ?').get(log.id);
        if (!callRow) continue;
        const existingEval = getEval.get(callRow.id);
        callsSynced += 1;

        const { text: evaluationPrompt } = getEvaluationContextForAgent(agentRow);
        if (!needsEvaluation(callRow, existingEval, agentRow, evaluationPrompt)) {
          callsSkipped += 1;
          continue;
        }

        try {
          const evaluation = await evaluateCallSession(callRow, agentRow);
          const fingerprint = computeEvalFingerprint(callRow, agentRow, evaluationPrompt);
          saveEvaluation(db, callRow.id, evaluation, startedAt, fingerprint);
          db.prepare(`UPDATE calls SET status = 'analyzed' WHERE id = ?`).run(callRow.id);
          callsEvaluated += 1;
        } catch (evalErr) {
          console.error(`[sync] eval failed ${log.id}:`, evalErr.message);
          evalErrors.push({ ghlCallId: log.id, message: evalErr.message });
          db.prepare(`UPDATE calls SET status = 'pending' WHERE id = ?`).run(callRow.id);
        }
      }
    }

    db.prepare(`
      UPDATE sync_runs SET finished_at = ?, agents_synced = ?, calls_synced = ? WHERE id = ?
    `).run(new Date().toISOString(), agentsSynced, callsSynced, run.lastInsertRowid);

    return {
      agentsSynced,
      callsSynced,
      callsEvaluated,
      callsSkipped,
      evalErrors,
      syncedAt: startedAt,
      ghlAgentId,
    };
  } catch (err) {
    db.prepare(`
      UPDATE sync_runs SET finished_at = ?, error = ? WHERE id = ?
    `).run(new Date().toISOString(), err.message, run.lastInsertRowid);
    throw err;
  }
}
