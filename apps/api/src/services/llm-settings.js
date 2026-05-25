import { config } from '../config.js';
import { getDb } from '../db.js';

const ROW_ID = 1;

const DEFAULTS = {
  provider: 'openai',
  openaiModel: config.llm.openai.model,
  geminiModel: config.llm.gemini.model,
};

function maskKey(key) {
  if (!key || key.length < 8) return null;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function readRow() {
  const db = getDb();
  return db.prepare('SELECT * FROM llm_settings WHERE id = ?').get(ROW_ID);
}

function envFallback() {
  return {
    provider: config.llm.provider === 'gemini' ? 'gemini' : 'openai',
    openaiApiKey: config.llm.openai.apiKey || '',
    openaiModel: config.llm.openai.model,
    geminiApiKey: config.llm.gemini.apiKey || '',
    geminiModel: config.llm.gemini.model,
    source: 'env',
  };
}

/** Resolved credentials: DB overrides env for each field. */
export function getResolvedLlmConfig() {
  const row = readRow();
  if (!row) return envFallback();

  const fromDb = Boolean(row.openai_api_key || row.gemini_api_key || row.updated_at);
  return {
    provider: row.provider === 'gemini' ? 'gemini' : 'openai',
    openaiApiKey: row.openai_api_key || config.llm.openai.apiKey || '',
    openaiModel: row.openai_model || config.llm.openai.model,
    geminiApiKey: row.gemini_api_key || config.llm.gemini.apiKey || '',
    geminiModel: row.gemini_model || config.llm.gemini.model,
    source: fromDb ? 'database' : 'env',
  };
}

export function getLlmSettingsForUi() {
  const row = readRow();
  const resolved = getResolvedLlmConfig();
  const active = resolved.provider;

  return {
    provider: active,
    openai: {
      model: resolved.openaiModel,
      apiKeySet: Boolean(resolved.openaiApiKey),
      apiKeyMask: maskKey(resolved.openaiApiKey),
    },
    gemini: {
      model: resolved.geminiModel,
      apiKeySet: Boolean(resolved.geminiApiKey),
      apiKeyMask: maskKey(resolved.geminiApiKey),
    },
    configured: active === 'gemini' ? Boolean(resolved.geminiApiKey) : Boolean(resolved.openaiApiKey),
    source: resolved.source,
    updatedAt: row?.updated_at || null,
  };
}

export function saveLlmSettings(input) {
  const db = getDb();
  const existing = readRow();
  const now = new Date().toISOString();

  const provider = input.provider === 'gemini' ? 'gemini' : 'openai';
  const openaiModel = (input.openaiModel || DEFAULTS.openaiModel).trim();
  const geminiModel = (input.geminiModel || DEFAULTS.geminiModel).trim();

  let openaiApiKey = existing?.openai_api_key || config.llm.openai.apiKey || '';
  let geminiApiKey = existing?.gemini_api_key || config.llm.gemini.apiKey || '';

  if (input.openaiApiKey?.trim()) openaiApiKey = input.openaiApiKey.trim();
  if (input.geminiApiKey?.trim()) geminiApiKey = input.geminiApiKey.trim();

  db.prepare(`
    INSERT INTO llm_settings (id, provider, openai_api_key, openai_model, gemini_api_key, gemini_model, updated_at)
    VALUES (@id, @provider, @openai_api_key, @openai_model, @gemini_api_key, @gemini_model, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      openai_api_key = excluded.openai_api_key,
      openai_model = excluded.openai_model,
      gemini_api_key = excluded.gemini_api_key,
      gemini_model = excluded.gemini_model,
      updated_at = excluded.updated_at
  `).run({
    id: ROW_ID,
    provider,
    openai_api_key: openaiApiKey,
    openai_model: openaiModel,
    gemini_api_key: geminiApiKey,
    gemini_model: geminiModel,
    updated_at: now,
  });

  return getLlmSettingsForUi();
}

export function isLlmConfiguredResolved() {
  const c = getResolvedLlmConfig();
  return c.provider === 'gemini' ? Boolean(c.geminiApiKey) : Boolean(c.openaiApiKey);
}

export function assertLlmConfigured() {
  if (!isLlmConfiguredResolved()) {
    const err = new Error('LLM is not configured. Open Settings and add your API key.');
    err.status = 400;
    throw err;
  }
}
