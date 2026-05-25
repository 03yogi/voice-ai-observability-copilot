/** Mirror of apps/api/src/services/sync-interval.js for UI fallback when API is stale. */
export const DEFAULT_SYNC_INTERVAL_OPTIONS = [
  { value: 0, label: 'Manual only' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 1440, label: 'Every 24 hours' },
];

export function syncIntervalLabel(minutes) {
  const opt = DEFAULT_SYNC_INTERVAL_OPTIONS.find((o) => o.value === minutes);
  return opt?.label ?? (minutes > 0 ? `Every ${minutes} min` : 'Manual only');
}
