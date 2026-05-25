import { config } from '../config.js';
import { getResolvedGhlConfig } from '../services/ghl-settings.js';

export const GHL_DEFAULTS = {
  apiBase: 'https://services.leadconnectorhq.com',
  timezone: 'Asia/Kolkata',
};

export function maskToken(token) {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function normalizeCredentials(input = {}) {
  return {
    apiToken: (input.apiToken || '').trim(),
    locationId: (input.locationId || '').trim(),
    apiBase: (input.apiBase || GHL_DEFAULTS.apiBase).trim(),
    timezone: (input.timezone || GHL_DEFAULTS.timezone).trim(),
  };
}

export function credentialsFromMonitoredRow(row) {
  return normalizeCredentials({
    apiToken: row.api_token,
    locationId: row.location_id,
    apiBase: row.api_base,
    timezone: row.timezone,
  });
}

export function isCredentialsConfigured(creds) {
  return Boolean(creds.apiToken && creds.locationId);
}

export function assertCredentials(creds, message = 'API token and location ID are required for this agent.') {
  if (!isCredentialsConfigured(creds)) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
}

export function legacyGlobalCredentials() {
  const g = getResolvedGhlConfig();
  return normalizeCredentials({
    apiToken: g.apiToken,
    locationId: g.locationId,
    apiBase: g.apiBase,
    timezone: g.timezone,
  });
}

export function credentialsFromRequestBody(body = {}, existingRow = null) {
  const legacy = legacyGlobalCredentials();
  const base = existingRow ? credentialsFromMonitoredRow(existingRow) : legacy;
  const creds = normalizeCredentials({
    apiToken: body.apiToken?.trim() || base.apiToken,
    locationId: (body.locationId ?? base.locationId).trim(),
    apiBase: body.apiBase ?? base.apiBase,
    timezone: body.timezone ?? base.timezone,
  });
  return creds;
}
