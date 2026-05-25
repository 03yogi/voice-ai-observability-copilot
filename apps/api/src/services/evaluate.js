import { EVALUATION_SYSTEM, buildEvaluationUserPrompt } from '../llm/prompts.js';
import { llmCompleteJson } from '../llm/provider.js';
import { normalizeEvaluationResult } from '../llm/schemas.js';
import { getEvaluationPromptForGhlAgent } from './monitored-agents.js';

export async function evaluateCallSession(call, agent) {
  if (!call.transcript?.trim()) {
    return {
      overallScore: 0,
      kpiResults: [],
      deviations: [
        {
          id: 'empty_transcript',
          label: 'Empty transcript',
          evidence: 'No transcript available for evaluation',
          severity: 'high',
        },
      ],
      useActions: [],
      suggestions: [
        {
          type: 'human_workflow',
          title: 'No transcript to analyze',
          body: 'This call has no transcript. Re-sync from HighLevel or check the call recording.',
          examplePromptSnippet: '',
          impact: 'low',
        },
      ],
      evaluatedBy: 'system',
    };
  }

  const { text: evaluationPrompt } = getEvaluationPromptForGhlAgent(agent.ghl_agent_id);

  const { data, provider, model } = await llmCompleteJson({
    system: EVALUATION_SYSTEM,
    user: buildEvaluationUserPrompt({ agent, call, evaluationPrompt }),
  });

  const normalized = normalizeEvaluationResult(data);
  return {
    ...normalized,
    evaluatedBy: `${provider}:${model}`,
    evaluationPromptUsed: evaluationPrompt,
  };
}

export function getEvaluationContextForAgent(agent) {
  return getEvaluationPromptForGhlAgent(agent.ghl_agent_id);
}
