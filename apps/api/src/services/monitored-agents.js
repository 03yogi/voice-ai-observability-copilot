import { getDb } from '../db.js';
import { getResolvedGhlConfig } from './ghl-settings.js';
import {
  credentialsFromRequestBody,
  isCredentialsConfigured,
  legacyGlobalCredentials,
  maskToken,
  GHL_DEFAULTS,
} from '../ghl/credentials.js';
import { resolveEvaluationPrompt } from './evaluation-prompt.js';
import { backfillAgentRecords, ensureAgentRecordForMonitored } from './agent-records.js';
import {
  normalizeSyncIntervalMinutes,
  syncIntervalLabel,
} from './sync-interval.js';

export function getEvaluationPromptForGhlAgent(ghlAgentId) {
  const db = getDb();
  const row = db.prepare('SELECT evaluation_prompt FROM monitored_agents WHERE ghl_agent_id = ?').get(ghlAgentId);
  return resolveEvaluationPrompt(row?.evaluation_prompt);
}

function migrateRowCredentials(db, row) {
  if (row.api_token) return;
  const legacy = legacyGlobalCredentials();
  if (!legacy.apiToken) return;
  db.prepare(`
    UPDATE monitored_agents SET
      api_token = @api_token,
      location_id = COALESCE(NULLIF(location_id, ''), @location_id),
      api_base = COALESCE(NULLIF(api_base, ''), @api_base),
      timezone = COALESCE(NULLIF(timezone, ''), @timezone)
    WHERE ghl_agent_id = @ghl_agent_id
  `).run({
    ghl_agent_id: row.ghl_agent_id,
    api_token: legacy.apiToken,
    location_id: legacy.locationId,
    api_base: legacy.apiBase,
    timezone: legacy.timezone,
  });
}

export function ensureMonitoredBootstrap() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM monitored_agents').all();
  for (const row of rows) {
    migrateRowCredentials(db, row);
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM monitored_agents').get().c;
  const { defaultAgentId } = getResolvedGhlConfig();
  const creds = legacyGlobalCredentials();
  if (count > 0 || !defaultAgentId || !creds.apiToken) {
    backfillAgentRecords();
    return;
  }

  const existing = db
    .prepare('SELECT name, business_name FROM agents WHERE ghl_agent_id = ?')
    .get(defaultAgentId);

  db.prepare(`
    INSERT OR IGNORE INTO monitored_agents (
      ghl_agent_id, location_id, name, business_name, added_at,
      api_token, api_base, timezone
    )
    VALUES (
      @ghl_agent_id, @location_id, @name, @business_name, @added_at,
      @api_token, @api_base, @timezone
    )
  `).run({
    ghl_agent_id: defaultAgentId,
    location_id: creds.locationId,
    name: existing?.name || 'Agent',
    business_name: existing?.business_name || null,
    added_at: new Date().toISOString(),
    api_token: creds.apiToken,
    api_base: creds.apiBase,
    timezone: creds.timezone,
  });
}

export function listMonitoredAgents() {
  ensureMonitoredBootstrap();
  const db = getDb();
  return db.prepare(`
    SELECT m.*, a.id AS db_id,
      (SELECT COUNT(*) FROM calls c WHERE c.agent_id = a.id) AS call_count
    FROM monitored_agents m
    LEFT JOIN agents a ON a.ghl_agent_id = m.ghl_agent_id
    ORDER BY m.name
  `).all();
}

export function getMonitoredAgentsForSync() {
  ensureMonitoredBootstrap();
  const db = getDb();
  return db.prepare('SELECT * FROM monitored_agents ORDER BY name').all();
}

export function getMonitoredAgent(ghlAgentId) {
  ensureMonitoredBootstrap();
  const db = getDb();
  return db.prepare(`
    SELECT m.*, a.id AS db_id,
      (SELECT COUNT(*) FROM calls c WHERE c.agent_id = a.id) AS call_count
    FROM monitored_agents m
    LEFT JOIN agents a ON a.ghl_agent_id = m.ghl_agent_id
    WHERE m.ghl_agent_id = ?
  `).get(ghlAgentId);
}

export function addMonitoredAgent(input) {
  const db = getDb();
  const id = String(input.ghlAgentId || '').trim();
  if (!id) {
    const err = new Error('GHL agent ID is required');
    err.status = 400;
    throw err;
  }

  const existing = db.prepare('SELECT * FROM monitored_agents WHERE ghl_agent_id = ?').get(id);
  const creds = credentialsFromRequestBody(input, existing);
  if (!isCredentialsConfigured(creds)) {
    const err = new Error('Private integration token and location ID are required for each agent.');
    err.status = 400;
    throw err;
  }

  const syncInterval = input.syncIntervalMinutes !== undefined
    ? normalizeSyncIntervalMinutes(input.syncIntervalMinutes, 0)
    : (existing?.sync_interval_minutes ?? 0);

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO monitored_agents (
      ghl_agent_id, location_id, name, business_name, added_at,
      api_token, api_base, timezone, evaluation_prompt, sync_interval_minutes
    )
    VALUES (
      @ghl_agent_id, @location_id, @name, @business_name, @added_at,
      @api_token, @api_base, @timezone, @evaluation_prompt, @sync_interval_minutes
    )
    ON CONFLICT(ghl_agent_id) DO UPDATE SET
      name = excluded.name,
      business_name = excluded.business_name,
      location_id = excluded.location_id,
      api_token = excluded.api_token,
      api_base = excluded.api_base,
      timezone = excluded.timezone,
      evaluation_prompt = excluded.evaluation_prompt,
      sync_interval_minutes = excluded.sync_interval_minutes
  `).run({
    ghl_agent_id: id,
    location_id: creds.locationId,
    name: (input.name || existing?.name || 'Voice AI Agent').trim(),
    business_name: input.businessName ?? existing?.business_name ?? null,
    added_at: existing?.added_at || now,
    api_token: creds.apiToken,
    api_base: creds.apiBase,
    timezone: creds.timezone,
    evaluation_prompt: input.evaluationPrompt !== undefined
      ? (input.evaluationPrompt || '').trim() || null
      : existing?.evaluation_prompt ?? null,
    sync_interval_minutes: syncInterval,
  });

  ensureAgentRecordForMonitored(
    db.prepare('SELECT * FROM monitored_agents WHERE ghl_agent_id = ?').get(id),
  );

  return formatMonitoredRow(getMonitoredAgent(id));
}

export function updateMonitoredAgent(ghlAgentId, input) {
  const existing = getMonitoredAgent(ghlAgentId);
  if (!existing) {
    const err = new Error('Monitored agent not found');
    err.status = 404;
    throw err;
  }
  return addMonitoredAgent({ ...input, ghlAgentId });
}

export function removeMonitoredAgent(ghlAgentId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM monitored_agents WHERE ghl_agent_id = ?').run(ghlAgentId);
  if (!result.changes) {
    const err = new Error('Monitored agent not found');
    err.status = 404;
    throw err;
  }
}

export function markAgentAutoSynced(ghlAgentId) {
  const db = getDb();
  db.prepare(
    'UPDATE monitored_agents SET last_auto_sync_at = ? WHERE ghl_agent_id = ?',
  ).run(new Date().toISOString(), ghlAgentId);
}

export function formatMonitoredRow(row) {
  if (!row) return null;
  const creds = {
    apiToken: row.api_token,
    locationId: row.location_id,
    apiBase: row.api_base || GHL_DEFAULTS.apiBase,
    timezone: row.timezone || GHL_DEFAULTS.timezone,
  };
  const evalPrompt = resolveEvaluationPrompt(row.evaluation_prompt);
  return {
    ghlAgentId: row.ghl_agent_id,
    name: row.name,
    businessName: row.business_name,
    locationId: row.location_id,
    apiBase: creds.apiBase,
    timezone: creds.timezone,
    apiTokenSet: Boolean(row.api_token),
    apiTokenMask: maskToken(row.api_token),
    connectionConfigured: isCredentialsConfigured(creds),
    evaluationPrompt: evalPrompt.text,
    evaluationPromptIsCustom: evalPrompt.isCustom,
    evaluationPromptRaw: row.evaluation_prompt || '',
    addedAt: row.added_at,
    dbId: row.db_id || null,
    callCount: row.call_count || 0,
    synced: Boolean(row.db_id),
    syncIntervalMinutes: row.sync_interval_minutes ?? 0,
    syncIntervalLabel: syncIntervalLabel(row.sync_interval_minutes ?? 0),
    lastAutoSyncAt: row.last_auto_sync_at || null,
  };
}

export function listMonitoredForUi() {
  return listMonitoredAgents().map(formatMonitoredRow);
}

export function assertMonitoredAgentsConfigured() {
  const agents = getMonitoredAgentsForSync();
  if (!agents.length) {
    const err = new Error('No Voice AI agents configured. Add agents in Settings → Agents.');
    err.status = 400;
    throw err;
  }
  const missing = agents.filter((a) => !a.api_token || !a.location_id);
  if (missing.length) {
    const err = new Error(
      `Missing connection for: ${missing.map((a) => a.name).join(', ')}. Edit each agent with its token and location ID.`,
    );
    err.status = 400;
    throw err;
  }
  return agents;
}

export function isMonitoredGhlAgent(ghlAgentId) {
  ensureMonitoredBootstrap();
  const db = getDb();
  return Boolean(
    db.prepare('SELECT 1 FROM monitored_agents WHERE ghl_agent_id = ?').get(ghlAgentId),
  );
}

export function anyMonitoredAgentConfigured() {
  ensureMonitoredBootstrap();
  return listMonitoredForUi().some((a) => a.connectionConfigured);
}
