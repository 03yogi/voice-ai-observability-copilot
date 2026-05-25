import { config } from '../config.js';
import { getResolvedLlmConfig } from '../services/llm-settings.js';
import { parseJsonResponse } from './parse.js';

export function isGeminiConfigured() {
  return Boolean(getResolvedLlmConfig().geminiApiKey);
}

export async function completeJson({ system, user }) {
  const cfg = getResolvedLlmConfig();
  const apiKey = cfg.geminiApiKey;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Add it in Settings.');
  }

  const model = cfg.geminiModel;
  const url = `${config.llm.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error?.message || `Gemini API error ${res.status}`);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return {
    data: parseJsonResponse(text),
    provider: 'gemini',
    model,
  };
}
