const IMPACTS = new Set(['high', 'medium', 'low']);
const TYPES = new Set(['prompt_edit', 'script_addition', 'agent_behavior', 'human_workflow']);
const PRIORITIES = new Set(['high', 'medium', 'low']);
const SEVERITIES = new Set(['high', 'medium', 'low', 'none']);

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeSuggestionItems(raw, { required = false, max = 5 } = {}) {
  const sourceItems = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.recommendations)
        ? raw.recommendations
        : Array.isArray(raw?.suggestions)
          ? raw.suggestions
          : [];

  const items = sourceItems.slice(0, max).map((item) => ({
    type: TYPES.has(item.type) ? item.type : 'agent_behavior',
    title: String(item.title || 'Suggestion'),
    body: String(item.body || ''),
    examplePromptSnippet: String(item.examplePromptSnippet || item.example_prompt_snippet || ''),
    impact: IMPACTS.has(item.impact) ? item.impact : 'medium',
  }));

  if (required && !items.length) {
    throw new Error('Recommendations payload must include at least one item');
  }

  return items;
}

export function normalizeEvaluationResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Evaluation payload must be an object');
  }

  const kpiResults = Array.isArray(raw.kpiResults)
    ? raw.kpiResults.map((k, i) => ({
        kpi: String(k.kpi || k.id || `kpi_${i}`),
        label: String(k.label || k.kpi || `KPI ${i + 1}`),
        pass: Boolean(k.pass),
        evidence: String(k.evidence || 'No evidence provided'),
        severity: SEVERITIES.has(k.severity) ? k.severity : k.pass ? 'none' : 'high',
      }))
    : [];

  const deviations = Array.isArray(raw.deviations)
    ? raw.deviations.map((d, i) => ({
        id: String(d.id || `deviation_${i}`),
        label: String(d.label || 'Issue detected'),
        evidence: String(d.evidence || ''),
        severity: SEVERITIES.has(d.severity) ? d.severity : 'medium',
      }))
    : [];

  const useActions = Array.isArray(raw.useActions)
    ? raw.useActions.slice(0, 8).map((a) => ({
        startSec: a.startSec ?? a.start_sec ?? null,
        endSec: a.endSec ?? a.end_sec ?? null,
        label: String(a.label || 'Review segment'),
        reason: String(a.reason || a.evidence || ''),
        priority: PRIORITIES.has(a.priority) ? a.priority : 'medium',
      }))
    : [];

  return {
    overallScore: clampScore(raw.overallScore ?? raw.overall_score),
    kpiResults,
    deviations,
    useActions,
    suggestions: normalizeSuggestionItems(raw.suggestions, { max: 5 }),
  };
}

export function normalizeRecommendationsResult(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Recommendations payload must be an object');
  }

  const sourceItems = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.recommendations)
        ? raw.recommendations
        : [];

  const items = normalizeSuggestionItems(sourceItems, { required: true, max: 7 });

  return { items };
}
