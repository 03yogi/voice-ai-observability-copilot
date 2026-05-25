export const DEFAULT_EVALUATION_PROMPT = `Evaluate each call against this agent's Voice AI script and business goals.

Check whether the agent:
- Followed the configured script and call flow step by step
- Collected required information (name, email, reason for call, etc.) as defined in the agent instructions
- Confirmed details correctly without skipping required steps
- Stayed on-brand and avoided unnecessary filler or off-script behavior

Derive KPIs from these criteria and the agent instructions provided. Every failed KPI must cite a short quote from the transcript as evidence.`;

export function resolveEvaluationPrompt(stored) {
  const custom = (stored || '').trim();
  if (custom) {
    return { text: custom, isCustom: true };
  }
  return { text: DEFAULT_EVALUATION_PROMPT, isCustom: false };
}
