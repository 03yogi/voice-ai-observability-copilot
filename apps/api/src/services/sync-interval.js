/** Allowed auto-fetch intervals per monitored agent (minutes). 0 = manual only. */
export const SYNC_INTERVAL_OPTIONS = [
  { value: 0, label: 'Manual only' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 1440, label: 'Every 24 hours' },
];

const ALLOWED = new Set(SYNC_INTERVAL_OPTIONS.map((o) => o.value));

export function normalizeSyncIntervalMinutes(input, fallback = 0) {
  if (input === undefined || input === null || input === '') {
    return fallback;
  }
  const n = Number(input);
  if (!Number.isFinite(n) || !ALLOWED.has(n)) {
    const err = new Error(
      `Invalid sync interval. Allowed: ${[...ALLOWED].join(', ')} minutes.`,
    );
    err.status = 400;
    throw err;
  }
  return n;
}

export function syncIntervalLabel(minutes) {
  const opt = SYNC_INTERVAL_OPTIONS.find((o) => o.value === minutes);
  return opt?.label ?? (minutes > 0 ? `Every ${minutes} minutes` : 'Manual only');
}

export function isAgentSyncDue(row, now = Date.now()) {
  const interval = row.sync_interval_minutes ?? 0;
  if (interval <= 0) return false;
  if (!row.last_auto_sync_at) return true;
  const last = new Date(row.last_auto_sync_at).getTime();
  if (Number.isNaN(last)) return true;
  return now - last >= interval * 60 * 1000;
}
