import { getDb } from '../db.js';
import { RECOMMENDATIONS_SYSTEM, buildRecommendationsUserPrompt } from '../llm/prompts.js';
import { llmCompleteJson } from '../llm/provider.js';
import { normalizeRecommendationsResult } from '../llm/schemas.js';

function loadRecentCalls(db, agentId, limit = 10) {
  return db.prepare(`
    SELECT c.*, e.overall_score, e.kpi_results, e.deviations
    FROM calls c
    JOIN call_evaluations e ON e.call_id = c.id
    WHERE c.agent_id = ?
    ORDER BY c.started_at DESC
    LIMIT ?
  `).all(agentId, limit);
}

export async function generateRecommendations(agent, { refresh = false } = {}) {
  const db = getDb();

  if (!refresh) {
    const cached = db.prepare('SELECT * FROM recommendations WHERE agent_id = ?').get(agent.id);
    if (cached) {
      return {
        agentId: agent.id,
        generatedAt: cached.generated_at,
        basedOnCalls: cached.based_on_calls,
        provider: cached.provider,
        items: JSON.parse(cached.items),
        cached: true,
      };
    }
  }

  const calls = loadRecentCalls(db, agent.id, 10);
  if (!calls.length) {
    return {
      agentId: agent.id,
      generatedAt: new Date().toISOString(),
      basedOnCalls: 0,
      provider: null,
      items: [
        {
          type: 'human_workflow',
          title: 'No calls to analyze yet',
          body: 'Sync call logs from HighLevel, then refresh insights.',
          examplePromptSnippet: '',
          impact: 'low',
        },
      ],
      cached: false,
    };
  }

  const lowScoring = calls.filter((c) => (c.overall_score ?? 100) < 70);
  const inputCalls = (lowScoring.length ? lowScoring : calls).slice(0, 8);

  const { data, provider, model } = await llmCompleteJson({
    system: RECOMMENDATIONS_SYSTEM,
    user: buildRecommendationsUserPrompt({ agent, calls: inputCalls }),
  });

  const { items } = normalizeRecommendationsResult(data);
  const generatedAt = new Date().toISOString();
  const providerLabel = `${provider}:${model}`;

  db.prepare(`
    INSERT INTO recommendations (agent_id, items, based_on_calls, provider, generated_at)
    VALUES (@agent_id, @items, @based_on_calls, @provider, @generated_at)
    ON CONFLICT(agent_id) DO UPDATE SET
      items = excluded.items,
      based_on_calls = excluded.based_on_calls,
      provider = excluded.provider,
      generated_at = excluded.generated_at
  `).run({
    agent_id: agent.id,
    items: JSON.stringify(items),
    based_on_calls: inputCalls.length,
    provider: providerLabel,
    generated_at: generatedAt,
  });

  return {
    agentId: agent.id,
    generatedAt,
    basedOnCalls: inputCalls.length,
    provider: providerLabel,
    items,
    cached: false,
  };
}

export async function refreshAllAgentRecommendations(agentIds) {
  const db = getDb();
  for (const agentId of agentIds) {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
    if (agent) await generateRecommendations(agent, { refresh: true });
  }
}
