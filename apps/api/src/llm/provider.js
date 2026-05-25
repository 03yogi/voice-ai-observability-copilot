import { getResolvedLlmConfig } from '../services/llm-settings.js';
import * as openai from './openai.js';
import * as gemini from './gemini.js';

const providers = {
  openai: {
    isConfigured: openai.isOpenAiConfigured,
    completeJson: openai.completeJson,
  },
  gemini: {
    isConfigured: gemini.isGeminiConfigured,
    completeJson: gemini.completeJson,
  },
};

function getActiveProvider() {
  return getResolvedLlmConfig().provider;
}

export function isLlmConfigured() {
  const name = getActiveProvider();
  return providers[name]?.isConfigured() ?? false;
}

export function getLlmStatus() {
  const cfg = getResolvedLlmConfig();
  const provider = cfg.provider;
  const configured = isLlmConfigured();
  const model = provider === 'gemini' ? cfg.geminiModel : cfg.openaiModel;
  return { provider, configured, model, source: cfg.source };
}

export async function llmCompleteJson({ system, user }) {
  const name = getActiveProvider();
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Unknown LLM provider "${name}". Use openai or gemini.`);
  }
  if (!provider.isConfigured()) {
    throw new Error(`${name} is not configured. Add your API key in Settings.`);
  }
  return provider.completeJson({ system, user });
}
