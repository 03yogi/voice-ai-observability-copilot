import { getDb } from '../db.js';
import { assertLlmConfigured } from './llm-settings.js';
import { evaluateCallSession, getEvaluationContextForAgent } from './evaluate.js';
import { computeEvalFingerprint } from './eval-fingerprint.js';

function saveEvaluation(db, callId, evaluation, evaluatedAt, fingerprint) {
  db.prepare(`
    INSERT INTO call_evaluations (call_id, overall_score, kpi_results, deviations, use_actions, suggestions, evaluated_at, evaluated_by, eval_fingerprint)
    VALUES (@call_id, @overall_score, @kpi_results, @deviations, @use_actions, @suggestions, @evaluated_at, @evaluated_by, @eval_fingerprint)
    ON CONFLICT(call_id) DO UPDATE SET
      overall_score = excluded.overall_score,
      kpi_results = excluded.kpi_results,
      deviations = excluded.deviations,
      use_actions = excluded.use_actions,
      suggestions = excluded.suggestions,
      evaluated_at = excluded.evaluated_at,
      evaluated_by = excluded.evaluated_by,
      eval_fingerprint = excluded.eval_fingerprint
  `).run({
    call_id: callId,
    overall_score: evaluation.overallScore,
    kpi_results: JSON.stringify(evaluation.kpiResults),
    deviations: JSON.stringify(evaluation.deviations),
    use_actions: JSON.stringify(evaluation.useActions),
    suggestions: JSON.stringify(evaluation.suggestions || []),
    evaluated_at: evaluatedAt,
    evaluated_by: evaluation.evaluatedBy,
    eval_fingerprint: fingerprint,
  });
}

export async function reanalyzeCall(callId) {
  assertLlmConfigured();

  const db = getDb();
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId);
  if (!call) {
    const err = new Error('Call not found');
    err.status = 404;
    throw err;
  }

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(call.agent_id);
  if (!agent) {
    const err = new Error('Agent not found for call');
    err.status = 404;
    throw err;
  }

  const evaluatedAt = new Date().toISOString();
  const { text: evaluationPrompt } = getEvaluationContextForAgent(agent);
  const evaluation = await evaluateCallSession(call, agent);
  const fingerprint = computeEvalFingerprint(call, agent, evaluationPrompt);
  saveEvaluation(db, callId, evaluation, evaluatedAt, fingerprint);
  db.prepare(`UPDATE calls SET status = 'analyzed' WHERE id = ?`).run(callId);

  return { callId, evaluatedAt, evaluation };
}

export { saveEvaluation, computeEvalFingerprint };
