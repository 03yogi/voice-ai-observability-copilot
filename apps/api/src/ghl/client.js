import {
  assertCredentials,
  credentialsFromMonitoredRow,
  normalizeCredentials,
} from './credentials.js';

const API_VERSION = '2021-07-28';

function headers(creds) {
  return {
    Authorization: `Bearer ${creds.apiToken}`,
    Version: API_VERSION,
    Accept: 'application/json',
  };
}

async function ghlFetch(creds, path, query = {}) {
  assertCredentials(creds);
  const url = new URL(path, creds.apiBase);
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { headers: headers(creds) });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(body.message || body.error || `GHL API ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export async function getLocation(creds) {
  return ghlFetch(creds, `/locations/${creds.locationId}`);
}

export async function listAgents(creds) {
  return ghlFetch(creds, '/voice-ai/agents', {
    locationId: creds.locationId,
    page: 1,
    pageSize: 50,
  });
}

export async function listAllCallLogs(creds, { agentId, pageSize = 50 } = {}) {
  const all = [];
  let page = 1;
  let total = null;

  while (true) {
    const res = await listCallLogs(creds, { agentId, page, pageSize });
    const batch = res.callLogs || [];
    all.push(...batch);
    if (total == null && res.total != null) total = res.total;
    if (!batch.length) break;
    if (total != null && all.length >= total) break;
    if (batch.length < pageSize) break;
    page += 1;
    if (page > 100) break;
  }

  return { callLogs: all, total: total ?? all.length };
}

export async function listCallLogs(creds, { agentId, page = 1, pageSize = 50 } = {}) {
  if (!agentId) {
    throw new Error('agentId is required for call logs');
  }
  return ghlFetch(creds, '/voice-ai/dashboard/call-logs', {
    locationId: creds.locationId,
    agentId,
    timezone: creds.timezone,
    page,
    pageSize,
  });
}

export async function getCallLog(creds, callId) {
  return ghlFetch(creds, `/voice-ai/dashboard/call-logs/${callId}`, {
    locationId: creds.locationId,
  });
}

export async function discoverAgents(input) {
  const creds = normalizeCredentials(input);
  const [locationRes, agentsRes] = await Promise.all([
    getLocation(creds),
    listAgents(creds),
  ]);
  return {
    locationName: locationRes.location?.name || null,
    agents: (agentsRes.agents || []).map((a) => ({
      ghlAgentId: a.id,
      name: a.agentName,
      businessName: a.businessName || null,
      locationId: a.locationId || creds.locationId,
    })),
  };
}

export { credentialsFromMonitoredRow };
