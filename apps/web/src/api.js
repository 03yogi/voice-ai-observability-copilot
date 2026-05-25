const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  health: () => request('/health'),
  sync: (ghlAgentId) =>
    request('/sync', {
      method: 'POST',
      body: JSON.stringify(ghlAgentId ? { ghlAgentId } : {}),
    }),
  syncAgent: (id) => request(`/agents/${id}/sync`, { method: 'POST' }),
  syncStatus: () => request('/sync/status'),
  syncIntervalOptions: () => request('/sync/options'),
  agents: () => request('/agents'),
  agent: (id) => request(`/agents/${id}`),
  calls: (agentId) => request(`/agents/${agentId}/calls`),
  call: (id) => request(`/calls/${id}`),
  reanalyzeCall: (id) => request(`/calls/${id}/reanalyze`, { method: 'POST' }),
  recommendations: (agentId, refresh = false) =>
    request(`/agents/${agentId}/recommendations${refresh ? '?refresh=true' : ''}`),
  llmSettings: () => request('/settings/llm'),
  saveLlmSettings: (body) => request('/settings/llm', { method: 'PUT', body: JSON.stringify(body) }),
  testLlmSettings: (body) =>
    request('/settings/llm/test', { method: 'POST', body: JSON.stringify(body) }),
  ghlSettings: () => request('/settings/ghl'),
  saveGhlSettings: (body) => request('/settings/ghl', { method: 'PUT', body: JSON.stringify(body) }),
  testGhlSettings: (body) =>
    request('/settings/ghl/test', { method: 'POST', body: JSON.stringify(body) }),
  monitoredAgents: () => request('/monitored-agents'),
  agentCatalog: () => request('/agents/catalog'),
  ghlVoiceAgents: () => request('/ghl/voice-agents'),
  addMonitoredAgent: (body) =>
    request('/monitored-agents', { method: 'POST', body: JSON.stringify(body) }),
  updateMonitoredAgent: (ghlAgentId, body) =>
    request(`/monitored-agents/${encodeURIComponent(ghlAgentId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  discoverGhlAgents: (body) =>
    request('/ghl/discover', { method: 'POST', body: JSON.stringify(body) }),
  removeMonitoredAgent: (ghlAgentId) =>
    request(`/monitored-agents/${encodeURIComponent(ghlAgentId)}`, { method: 'DELETE' }),
};
