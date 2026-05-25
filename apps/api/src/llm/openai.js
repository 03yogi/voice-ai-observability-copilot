import { config } from '../config.js';
import { getResolvedLlmConfig } from '../services/llm-settings.js';
import { parseJsonResponse } from './parse.js';

export function isOpenAiConfigured() {
  return Boolean(getResolvedLlmConfig().openaiApiKey);
}

export async function completeJson({ system, user }) {
  const cfg = getResolvedLlmConfig();
  const apiKey = cfg.openaiApiKey;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Add it in Settings.');
  }

  const res = await fetch(`${config.llm.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.openaiModel,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.message || `OpenAI API error ${res.status}`);
  }

  const text = body.choices?.[0]?.message?.content;
  return {
    data: parseJsonResponse(text),
    provider: 'openai',
    model: cfg.openaiModel,
  };
}
