import { listMonitoredForUi } from './monitored-agents.js';
import { SYNC_INTERVAL_OPTIONS } from './sync-interval.js';

export function getAgentCatalog() {
  const agents = listMonitoredForUi();
  return {
    agents: agents.map((a) => ({
      ...a,
      isMonitored: true,
      inGhl: true,
    })),
    monitoredCount: agents.length,
    syncIntervalOptions: SYNC_INTERVAL_OPTIONS,
  };
}
