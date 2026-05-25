import { config } from '../config.js';
import { getDb } from '../db.js';

const ROW_ID = 1;

const DEFAULTS = {
  apiBase: 'https://services.leadconnectorhq.com',
  timezone: 'Asia/Kolkata',
};

function maskToken(token) {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function readRow() {
  const db = getDb();
  return db.prepare('SELECT * FROM ghl_settings WHERE id = ?').get(ROW_ID);
}

function envFallback() {
  return {
    apiToken: config.ghl.apiToken || '',
    locationId: config.ghl.locationId || '',
    apiBase: config.ghl.apiBase || DEFAULTS.apiBase,
    timezone: config.ghl.timezone || DEFAULTS.timezone,
    defaultAgentId: config.ghl.agentId || '',
    source: 'env',
  };
}

/** Resolved credentials: DB overrides env for each field. */
export function getResolvedGhlConfig() {
  const row = readRow();
  if (!row) return envFallback();

  const fromDb = Boolean(row.api_token || row.location_id || row.updated_at);
  return {
    apiToken: row.api_token || config.ghl.apiToken || '',
    locationId: row.location_id || config.ghl.locationId || '',
    apiBase: row.api_base || config.ghl.apiBase || DEFAULTS.apiBase,
    timezone: row.timezone || config.ghl.timezone || DEFAULTS.timezone,
    defaultAgentId: row.default_agent_id || config.ghl.agentId || '',
    source: fromDb ? 'database' : 'env',
  };
}

export function getGhlSettingsForUi() {
  const row = readRow();
  const resolved = getResolvedGhlConfig();

  return {
    locationId: resolved.locationId,
    apiBase: resolved.apiBase,
    timezone: resolved.timezone,
    defaultAgentId: resolved.defaultAgentId || '',
    apiTokenSet: Boolean(resolved.apiToken),
    apiTokenMask: maskToken(resolved.apiToken),
    configured: Boolean(resolved.apiToken && resolved.locationId),
    source: resolved.source,
    updatedAt: row?.updated_at || null,
  };
}

export function saveGhlSettings(input) {
  const db = getDb();
  const existing = readRow();
  const now = new Date().toISOString();

  let apiToken = existing?.api_token || config.ghl.apiToken || '';
  if (input.apiToken?.trim()) apiToken = input.apiToken.trim();

  const locationId = (input.locationId ?? existing?.location_id ?? config.ghl.locationId ?? '').trim();
  const apiBase = (input.apiBase || existing?.api_base || DEFAULTS.apiBase).trim();
  const timezone = (input.timezone || existing?.timezone || DEFAULTS.timezone).trim();
  const defaultAgentId = (input.defaultAgentId ?? existing?.default_agent_id ?? '').trim();

  db.prepare(`
    INSERT INTO ghl_settings (id, api_token, location_id, api_base, timezone, default_agent_id, updated_at)
    VALUES (@id, @api_token, @location_id, @api_base, @timezone, @default_agent_id, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      api_token = excluded.api_token,
      location_id = excluded.location_id,
      api_base = excluded.api_base,
      timezone = excluded.timezone,
      default_agent_id = excluded.default_agent_id,
      updated_at = excluded.updated_at
  `).run({
    id: ROW_ID,
    api_token: apiToken,
    location_id: locationId,
    api_base: apiBase,
    timezone: timezone,
    default_agent_id: defaultAgentId,
    updated_at: now,
  });

  return getGhlSettingsForUi();
}

export function isGhlConfiguredResolved() {
  const c = getResolvedGhlConfig();
  return Boolean(c.apiToken && c.locationId);
}

export function assertGhlConfigured() {
  if (!isGhlConfiguredResolved()) {
    const err = new Error('HighLevel is not configured. Open Settings → HighLevel and add your credentials.');
    err.status = 400;
    throw err;
  }
}
