import { Router } from 'express';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { assertGhlConfigured, getGhlSettingsForUi, saveGhlSettings } from '../services/ghl-settings.js';
import { triggerSync, getSyncSchedulerStatus } from '../services/sync-scheduler.js';
import { SYNC_INTERVAL_OPTIONS } from '../services/sync-interval.js';
import { generateRecommendations } from '../services/recommendations.js';
import { reanalyzeCall } from '../services/call-analyze.js';
import {
  listMonitoredForUi,
  addMonitoredAgent,
  updateMonitoredAgent,
  removeMonitoredAgent,
  ensureMonitoredBootstrap,
  anyMonitoredAgentConfigured,
  getEvaluationPromptForGhlAgent,
} from '../services/monitored-agents.js';
import { getAgentCatalog } from '../services/agent-catalog.js';
import { getLlmSettingsForUi, saveLlmSettings } from '../services/llm-settings.js';
import { getLlmStatus, llmCompleteJson } from '../llm/provider.js';
import * as ghl from '../ghl/client.js';
import { resolveEvaluationPrompt } from '../services/evaluation-prompt.js';
import { backfillAgentRecords } from '../services/agent-records.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'voice-ai-copilot-api' });
});

router.get('/health/llm', (_req, res) => {
  res.json({ ok: true, llm: getLlmStatus() });
});

router.get('/embed/info', (_req, res) => {
  const base = config.publicUrl || `http://localhost:${config.port}`;
  res.json({
    iframeUrl: `${base}/?location_id={location_id}`,
    customMenuLink: `${base}/?location_id={{location.id}}`,
    allowedFrameAncestors: [
      'https://app.gohighlevel.com',
      'https://*.gohighlevel.com',
      'https://*.leadconnectorhq.com',
    ],
    setupDoc: 'docs/GHL_SETUP.md',
  });
});

router.post('/webhooks/ghl/call-completed', async (req, res, next) => {
  try {
    const payload = req.body || {};
    console.log('[webhook] ghl/call-completed', {
      callId: payload.callId || payload.call_id,
      agentId: payload.agentId || payload.agent_id,
      locationId: payload.locationId || payload.location_id,
    });

    let syncResult = null;
    if (req.query.sync === 'true' && anyMonitoredAgentConfigured()) {
      syncResult = await triggerSync('webhook');
    }

    res.json({
      ok: true,
      received: true,
      syncTriggered: !!syncResult,
      sync: syncResult,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/settings/llm', (_req, res) => {
  res.json({ settings: getLlmSettingsForUi() });
});

router.put('/settings/llm', (req, res, next) => {
  try {
    const settings = saveLlmSettings(req.body || {});
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/llm/test', async (req, res, next) => {
  try {
    if (req.body && Object.keys(req.body).length) {
      saveLlmSettings(req.body);
    }
    const result = await llmCompleteJson({
      system: 'Reply with JSON only: {"ok":true}',
      user: 'ping',
    });
    res.json({ ok: true, provider: result.provider, model: result.model });
  } catch (err) {
    next(err);
  }
});

router.get('/health/ghl', async (_req, res) => {
  ensureMonitoredBootstrap();
  res.json({
    ok: anyMonitoredAgentConfigured(),
    configured: anyMonitoredAgentConfigured(),
  });
});

router.get('/settings/ghl', (_req, res) => {
  res.json({ settings: getGhlSettingsForUi() });
});

router.put('/settings/ghl', (req, res, next) => {
  try {
    const settings = saveGhlSettings(req.body || {});
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/ghl/test', async (req, res, next) => {
  try {
    if (req.body && Object.keys(req.body).length) {
      saveGhlSettings(req.body);
    }
    assertGhlConfigured();
    const data = await ghl.getLocation();
    res.json({ ok: true, location: data.location?.name });
  } catch (err) {
    next(err);
  }
});

router.get('/monitored-agents', (_req, res) => {
  ensureMonitoredBootstrap();
  res.json({ agents: listMonitoredForUi() });
});

router.get('/agents/catalog', (_req, res) => {
  ensureMonitoredBootstrap();
  res.json(getAgentCatalog());
});

router.post('/ghl/discover', async (req, res, next) => {
  try {
    const result = await ghl.discoverAgents(req.body || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/ghl/voice-agents', async (req, res, next) => {
  try {
    const result = await ghl.discoverAgents(req.query || {});
    res.json({ agents: result.agents.map((a) => ({ ...a, monitored: false })) });
  } catch (err) {
    next(err);
  }
});

router.post('/monitored-agents', (req, res, next) => {
  try {
    const agent = addMonitoredAgent(req.body || {});
    res.status(201).json({ agent });
  } catch (err) {
    next(err);
  }
});

router.put('/monitored-agents/:ghlAgentId', (req, res, next) => {
  try {
    const agent = updateMonitoredAgent(req.params.ghlAgentId, req.body || {});
    res.json({ agent });
  } catch (err) {
    next(err);
  }
});

router.delete('/monitored-agents/:ghlAgentId', (req, res, next) => {
  try {
    removeMonitoredAgent(req.params.ghlAgentId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/sync/status', (_req, res) => {
  res.json(getSyncSchedulerStatus());
});

router.get('/sync/options', (_req, res) => {
  res.json({ intervals: SYNC_INTERVAL_OPTIONS });
});

router.post('/sync', async (req, res, next) => {
  try {
    const ghlAgentId = req.body?.ghlAgentId || req.query?.ghlAgentId || null;
    const result = await triggerSync('manual', { ghlAgentId });
    if (result.skipped) {
      return res.status(409).json({ message: result.reason, ...result });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/agents/:id/sync', async (req, res, next) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT ghl_agent_id FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const result = await triggerSync('manual', { ghlAgentId: agent.ghl_agent_id });
    if (result.skipped) {
      return res.status(409).json({ message: result.reason, ...result });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/agents', (_req, res) => {
  ensureMonitoredBootstrap();
  backfillAgentRecords();
  const db = getDb();
  const agents = db.prepare(`
    SELECT
      a.id,
      m.ghl_agent_id,
      COALESCE(a.name, m.name) AS name,
      COALESCE(a.business_name, m.business_name) AS business_name,
      a.welcome_message,
      a.synced_at,
      COUNT(c.id) AS call_count,
      ROUND(AVG(e.overall_score)) AS avg_score,
      SUM(CASE WHEN e.overall_score < 70 THEN 1 ELSE 0 END) AS issue_count
    FROM monitored_agents m
    LEFT JOIN agents a ON a.ghl_agent_id = m.ghl_agent_id
    LEFT JOIN calls c ON c.agent_id = a.id
    LEFT JOIN call_evaluations e ON e.call_id = c.id
    GROUP BY m.ghl_agent_id
    ORDER BY name
  `).all();

  res.json({ agents: agents.map(formatAgent) });
});

router.get('/agents/:id', (req, res) => {
  const db = getDb();
  const agent = db.prepare(`
    SELECT a.*,
      COUNT(c.id) AS call_count,
      ROUND(AVG(e.overall_score)) AS avg_score,
      SUM(CASE WHEN e.overall_score < 70 THEN 1 ELSE 0 END) AS issue_count
    FROM agents a
    LEFT JOIN calls c ON c.agent_id = a.id
    LEFT JOIN call_evaluations e ON e.call_id = c.id
    WHERE a.id = ?
    GROUP BY a.id
  `).get(req.params.id);

  if (!agent) return res.status(404).json({ message: 'Agent not found' });
  res.json({ agent: formatAgent(agent) });
});

router.get('/agents/:id/calls', (req, res) => {
  const db = getDb();
  const calls = db.prepare(`
    SELECT c.*, e.overall_score, e.kpi_results, e.deviations, e.suggestions, e.evaluated_by
    FROM calls c
    LEFT JOIN call_evaluations e ON e.call_id = c.id
    WHERE c.agent_id = ?
    ORDER BY c.started_at DESC
  `).all(req.params.id);

  res.json({ calls: calls.map(formatCallSummary) });
});

router.get('/agents/:id/recommendations', async (req, res, next) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const refresh = req.query.refresh === 'true';
    const result = await generateRecommendations(agent, { refresh });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/calls/:id', (req, res) => {
  const db = getDb();
  const call = db.prepare(`
    SELECT c.*, e.overall_score, e.kpi_results, e.deviations, e.use_actions, e.suggestions, e.evaluated_at, e.evaluated_by
    FROM calls c
    LEFT JOIN call_evaluations e ON e.call_id = c.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!call) return res.status(404).json({ message: 'Call not found' });
  const agent = db.prepare('SELECT ghl_agent_id FROM agents WHERE id = ?').get(call.agent_id);
  const evalCtx = agent ? getEvaluationPromptForGhlAgent(agent.ghl_agent_id) : resolveEvaluationPrompt('');
  res.json({ call: { ...formatCallDetail(call), evaluationPrompt: evalCtx.text, evaluationPromptIsCustom: evalCtx.isCustom } });
});

router.post('/calls/:id/reanalyze', async (req, res, next) => {
  try {
    const { evaluation } = await reanalyzeCall(req.params.id);
    res.json({
      call: {
        overallScore: evaluation.overallScore,
        kpiResults: evaluation.kpiResults,
        deviations: evaluation.deviations,
        useActions: evaluation.useActions,
        suggestions: evaluation.suggestions,
        evaluatedBy: evaluation.evaluatedBy,
      },
    });
  } catch (err) {
    next(err);
  }
});

function formatAgent(row) {
  const evalCtx = row.ghl_agent_id
    ? getEvaluationPromptForGhlAgent(row.ghl_agent_id)
    : resolveEvaluationPrompt(row.evaluation_prompt);
  return {
    id: row.id,
    ghlAgentId: row.ghl_agent_id,
    name: row.name,
    businessName: row.business_name,
    welcomeMessage: row.welcome_message,
    callCount: row.call_count || 0,
    avgScore: row.avg_score ?? null,
    issueCount: row.issue_count || 0,
    syncedAt: row.synced_at,
    synced: Boolean(row.synced_at),
    evaluationPrompt: evalCtx.text,
    evaluationPromptIsCustom: evalCtx.isCustom,
  };
}

function formatCallSummary(row) {
  const suggestions = JSON.parse(row.suggestions || '[]');
  return {
    id: row.id,
    ghlCallId: row.ghl_call_id,
    startedAt: row.started_at,
    durationSec: row.duration_sec,
    summary: row.summary,
    overallScore: row.overall_score,
    trialCall: !!row.trial_call,
    evaluatedBy: row.evaluated_by || null,
    kpiResults: JSON.parse(row.kpi_results || '[]'),
    deviations: JSON.parse(row.deviations || '[]'),
    suggestions,
    suggestionCount: suggestions.length,
  };
}

function formatCallDetail(row) {
  return {
    ...formatCallSummary(row),
    transcript: row.transcript,
    transcriptWithToolCalls: JSON.parse(row.transcript_json || '[]'),
    extractedData: JSON.parse(row.extracted_data || '{}'),
    useActions: JSON.parse(row.use_actions || '[]'),
    evaluatedAt: row.evaluated_at,
  };
}

export default router;
