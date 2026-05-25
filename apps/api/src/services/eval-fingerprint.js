import { createHash } from 'crypto';

/** Hash of inputs that drive LLM evaluation — skip re-eval when unchanged. */
export function computeEvalFingerprint(call, agent, evaluationPrompt = '') {
  let extracted = '';
  try {
    extracted = call.extracted_data || '';
  } catch {
    extracted = '';
  }
  const payload = [
    call.transcript || '',
    call.summary || '',
    agent.agent_prompt || '',
    evaluationPrompt || '',
    extracted,
  ].join('\n---\n');
  return createHash('sha256').update(payload).digest('hex');
}

export function shouldReevaluateCall(call, agent, existingEval, evaluationPrompt = '') {
  if (!existingEval) return true;
  if (!existingEval.eval_fingerprint) return true;
  return existingEval.eval_fingerprint !== computeEvalFingerprint(call, agent, evaluationPrompt);
}
