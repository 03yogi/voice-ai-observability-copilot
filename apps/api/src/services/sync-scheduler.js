import { getDb } from '../db.js';
import { runSync } from './sync.js';
import {
  anyMonitoredAgentConfigured,
  ensureMonitoredBootstrap,
  getMonitoredAgentsForSync,
  markAgentAutoSynced,
} from './monitored-agents.js';
import { isLlmConfiguredResolved } from './llm-settings.js';
import { isAgentSyncDue, syncIntervalLabel } from './sync-interval.js';

const TICK_MS = 60 * 1000;

let running = false;
let timer = null;
let lastTickAt = null;
let lastSource = null;
let lastResult = null;
let lastError = null;
let lastAgentsProcessed = [];

export function getSyncSchedulerStatus() {
  ensureMonitoredBootstrap();
  const agents = getMonitoredAgentsForSync()
    .filter((a) => a.api_token && a.location_id)
    .map((row) => ({
      ghlAgentId: row.ghl_agent_id,
      name: row.name,
      syncIntervalMinutes: row.sync_interval_minutes ?? 0,
      syncIntervalLabel: syncIntervalLabel(row.sync_interval_minutes ?? 0),
      lastAutoSyncAt: row.last_auto_sync_at || null,
      due: isAgentSyncDue(row),
    }));

  return {
    enabled: true,
    tickSeconds: TICK_MS / 1000,
    running,
    lastTickAt,
    lastSource,
    lastResult,
    lastError,
    lastAgentsProcessed,
    agents,
    autoSyncEnabledCount: agents.filter((a) => a.syncIntervalMinutes > 0).length,
  };
}

export async function triggerSync(source = 'manual', { ghlAgentId = null } = {}) {
  if (running) {
    return { skipped: true, reason: 'sync already in progress', source };
  }

  ensureMonitoredBootstrap();
  if (!anyMonitoredAgentConfigured()) {
    return { skipped: true, reason: 'no monitored agents configured', source };
  }
  if (!isLlmConfiguredResolved()) {
    return { skipped: true, reason: 'LLM not configured', source };
  }

  running = true;
  lastSource = source;
  try {
    lastResult = await runSync({ ghlAgentId });
    lastTickAt = new Date().toISOString();
    lastError = null;
    if (source === 'schedule' && ghlAgentId) {
      markAgentAutoSynced(ghlAgentId);
    }
    return { ...lastResult, source };
  } catch (err) {
    lastError = err.message;
    lastTickAt = new Date().toISOString();
    throw err;
  } finally {
    running = false;
  }
}

async function runScheduledTick() {
  if (running) return;

  ensureMonitoredBootstrap();
  if (!anyMonitoredAgentConfigured() || !isLlmConfiguredResolved()) return;

  const due = getMonitoredAgentsForSync().filter(
    (row) => row.api_token && row.location_id && isAgentSyncDue(row),
  );

  if (!due.length) return;

  lastAgentsProcessed = [];
  for (const row of due) {
    if (running) break;
    try {
      const result = await triggerSync('schedule', { ghlAgentId: row.ghl_agent_id });
      if (!result.skipped) {
        lastAgentsProcessed.push({
          ghlAgentId: row.ghl_agent_id,
          name: row.name,
          callsSynced: result.callsSynced,
          callsEvaluated: result.callsEvaluated,
        });
        console.log(
          `[sync-scheduler] ${row.name}: ${result.callsSynced} calls, ${result.callsEvaluated} evaluated`,
        );
      }
    } catch (err) {
      console.error(`[sync-scheduler] ${row.name} failed:`, err.message);
      lastError = err.message;
    }
  }
}

export function startSyncScheduler() {
  stopSyncScheduler();
  timer = setInterval(() => {
    runScheduledTick().catch((err) => {
      console.error('[sync-scheduler] tick error:', err.message);
    });
  }, TICK_MS);

  console.log('[sync-scheduler] per-agent auto-sync tick every 60s');
}

export function stopSyncScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
