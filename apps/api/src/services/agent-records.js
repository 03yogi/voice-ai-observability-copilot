import { randomUUID } from 'crypto';
import { getDb } from '../db.js';

export function ensureAgentRecordForMonitored(monitoredRow, { syncedAt = null } = {}) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM agents WHERE ghl_agent_id = ?').get(monitoredRow.ghl_agent_id);
  if (existing) return existing;

  const id = randomUUID();
  db.prepare(`
    INSERT INTO agents (
      id, ghl_agent_id, location_id, name, business_name,
      welcome_message, agent_prompt, success_criteria, synced_at
    )
    VALUES (
      @id, @ghl_agent_id, @location_id, @name, @business_name,
      '', '', '{}', @synced_at
    )
  `).run({
    id,
    ghl_agent_id: monitoredRow.ghl_agent_id,
    location_id: monitoredRow.location_id || '',
    name: monitoredRow.name || 'Voice AI Agent',
    business_name: monitoredRow.business_name,
    synced_at: syncedAt,
  });

  return db.prepare('SELECT * FROM agents WHERE ghl_agent_id = ?').get(monitoredRow.ghl_agent_id);
}

export function backfillAgentRecords() {
  const db = getDb();
  const monitored = db.prepare('SELECT * FROM monitored_agents').all();
  for (const row of monitored) {
    ensureAgentRecordForMonitored(row);
  }
}
