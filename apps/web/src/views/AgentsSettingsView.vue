<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api.js';
import { ghlEmbed } from '../ghl/embed.js';
import { DEFAULT_SYNC_INTERVAL_OPTIONS, syncIntervalLabel } from '../constants/sync-interval.js';

const loading = ref(true);
const error = ref('');
const success = ref('');
const agents = ref([]);
const busyId = ref('');
const syncIntervalOptions = ref([]);
const addSyncInterval = ref(0);

const discovered = ref([]);
const locationName = ref('');
const discovering = ref(false);

const apiToken = ref('');
const locationId = ref('');
const apiBase = ref('https://services.leadconnectorhq.com');
const timezone = ref('Asia/Kolkata');
const selectedAgentId = ref('');
const manualAgentId = ref('');
const manualName = ref('');

const editingId = ref('');
const editingCriteriaId = ref('');
const editToken = ref('');
const editLocationId = ref('');
const editApiBase = ref('');
const editTimezone = ref('');
const editEvalPrompt = ref('');
const addEvalPrompt = ref('');

function connectionPayload() {
  return {
    apiToken: apiToken.value.trim(),
    locationId: locationId.value.trim(),
    apiBase: apiBase.value.trim(),
    timezone: timezone.value.trim(),
  };
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [catalog, optsRes, monitoredRes] = await Promise.all([
      api.agentCatalog(),
      api.syncIntervalOptions().catch(() => null),
      api.monitoredAgents().catch(() => null),
    ]);

    syncIntervalOptions.value =
      catalog.syncIntervalOptions ||
      optsRes?.intervals ||
      DEFAULT_SYNC_INTERVAL_OPTIONS;

    const monitoredById = new Map(
      (monitoredRes?.agents || []).map((a) => [a.ghlAgentId, a]),
    );

    agents.value = (catalog.agents || []).map((a) => {
      const m = monitoredById.get(a.ghlAgentId);
      const minutes = a.syncIntervalMinutes ?? m?.syncIntervalMinutes ?? 0;
      return {
        ...a,
        syncIntervalMinutes: minutes,
        syncIntervalLabel: a.syncIntervalLabel || m?.syncIntervalLabel || syncIntervalLabel(minutes),
        lastAutoSyncAt: a.lastAutoSyncAt ?? m?.lastAutoSyncAt ?? null,
      };
    });

    if (!catalog.syncIntervalOptions && !optsRes?.intervals) {
      error.value =
        'API is running an older build — restart npm run dev. Using default auto-fetch options.';
    }
  } catch (e) {
    error.value = e.message;
    syncIntervalOptions.value = DEFAULT_SYNC_INTERVAL_OPTIONS;
  } finally {
    loading.value = false;
  }
}

async function discoverAgents() {
  discovering.value = true;
  error.value = '';
  discovered.value = [];
  locationName.value = '';
  try {
    const data = await api.discoverGhlAgents(connectionPayload());
    discovered.value = data.agents || [];
    locationName.value = data.locationName || '';
    if (!discovered.value.length) {
      error.value = 'No Voice AI agents found for this location.';
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    discovering.value = false;
  }
}

async function addDiscovered() {
  const pick = discovered.value.find((a) => a.ghlAgentId === selectedAgentId.value);
  if (!pick) {
    error.value = 'Select an agent from the list.';
    return;
  }
  await saveAgent({
    ghlAgentId: pick.ghlAgentId,
    name: pick.name,
    businessName: pick.businessName,
    evaluationPrompt: addEvalPrompt.value.trim(),
    syncIntervalMinutes: addSyncInterval.value,
    ...connectionPayload(),
  });
  selectedAgentId.value = '';
  discovered.value = [];
}

async function addManual() {
  if (!manualAgentId.value.trim()) {
    error.value = 'Enter a Voice AI agent ID.';
    return;
  }
  await saveAgent({
    ghlAgentId: manualAgentId.value.trim(),
    name: manualName.value.trim() || 'Voice AI Agent',
    evaluationPrompt: addEvalPrompt.value.trim(),
    syncIntervalMinutes: addSyncInterval.value,
    ...connectionPayload(),
  });
  manualAgentId.value = '';
  manualName.value = '';
}

async function saveAgent(payload) {
  busyId.value = payload.ghlAgentId;
  error.value = '';
  success.value = '';
  try {
    await api.addMonitoredAgent(payload);
    success.value = 'Agent added. Run Sync from the dashboard to pull call logs.';
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = '';
  }
}

function startEdit(agent) {
  editingId.value = agent.ghlAgentId;
  editToken.value = '';
  editLocationId.value = agent.locationId || '';
  editApiBase.value = agent.apiBase || 'https://services.leadconnectorhq.com';
  editTimezone.value = agent.timezone || 'Asia/Kolkata';
}

function cancelEdit() {
  editingId.value = '';
}

async function saveEdit(agent) {
  busyId.value = agent.ghlAgentId;
  error.value = '';
  success.value = '';
  try {
    const payload = {
      locationId: editLocationId.value.trim(),
      apiBase: editApiBase.value.trim(),
      timezone: editTimezone.value.trim(),
    };
    if (editToken.value.trim()) payload.apiToken = editToken.value.trim();
    await api.updateMonitoredAgent(agent.ghlAgentId, payload);
    success.value = 'Connection updated.';
    editingId.value = '';
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = '';
  }
}

function startEditCriteria(agent) {
  editingCriteriaId.value = agent.ghlAgentId;
  editEvalPrompt.value = agent.evaluationPromptRaw || agent.evaluationPrompt || '';
}

function cancelEditCriteria() {
  editingCriteriaId.value = '';
}

async function saveCriteria(agent) {
  busyId.value = agent.ghlAgentId;
  error.value = '';
  success.value = '';
  try {
    await api.updateMonitoredAgent(agent.ghlAgentId, {
      evaluationPrompt: editEvalPrompt.value.trim(),
    });
    success.value = 'Evaluation criteria saved. Re-sync or refresh call analysis to apply.';
    editingCriteriaId.value = '';
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = '';
  }
}

async function updateSchedule(agent, minutes) {
  busyId.value = agent.ghlAgentId;
  error.value = '';
  success.value = '';
  try {
    await api.updateMonitoredAgent(agent.ghlAgentId, { syncIntervalMinutes: minutes });
    success.value =
      minutes > 0
        ? `Auto-fetch enabled: ${agent.name} — every ${minutes} min.`
        : `Auto-fetch disabled for ${agent.name}. Use manual sync on the dashboard.`;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = '';
  }
}

async function removeAgent(ghlAgentId) {
  busyId.value = ghlAgentId;
  error.value = '';
  success.value = '';
  try {
    await api.removeMonitoredAgent(ghlAgentId);
    success.value = 'Agent removed.';
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    busyId.value = '';
  }
}

onMounted(() => {
  if (ghlEmbed.locationId && !locationId.value) {
    locationId.value = ghlEmbed.locationId;
  }
  load();
});
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Voice AI Agents</h1>
        <p>Each agent has its own GHL connection and auto-fetch schedule (server checks every minute).</p>
      </div>
    </header>

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="success" class="card muted">{{ success }}</p>

    <div v-if="loading" class="empty">Loading agents…</div>

    <template v-else>
      <article class="card" style="margin-bottom: 1rem">
        <h3>Monitored agents ({{ agents.length }})</h3>
        <p v-if="!agents.length" class="muted">No agents yet. Add one below with its own GHL connection.</p>

        <div v-else class="list">
          <div v-for="agent in agents" :key="agent.ghlAgentId" class="card agent-connection-card">
            <div class="agent-catalog-title">
              <strong>{{ agent.name }}</strong>
              <span :class="['pill', agent.connectionConfigured ? 'pill-ok' : 'pill-bad']">
                {{ agent.connectionConfigured ? 'Connected' : 'Missing credentials' }}
              </span>
            </div>
            <p class="muted">{{ agent.businessName || '—' }}</p>
            <p class="muted agent-id">Agent ID: {{ agent.ghlAgentId }}</p>
            <p class="muted">Location: {{ agent.locationId || '—' }} · Token: {{ agent.apiTokenMask || 'not set' }}</p>
            <p class="muted">Timezone: {{ agent.timezone }} · {{ agent.synced ? `${agent.callCount} call(s) synced` : 'Not synced yet' }}</p>

            <div class="field" style="margin-top: 0.75rem">
              <label :for="`sync-${agent.ghlAgentId}`">Auto-fetch transcripts</label>
              <select
                :id="`sync-${agent.ghlAgentId}`"
                :value="agent.syncIntervalMinutes ?? 0"
                :disabled="busyId === agent.ghlAgentId"
                @change="updateSchedule(agent, Number($event.target.value))"
              >
                <option v-for="opt in syncIntervalOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <span class="muted">
                <template v-if="(agent.syncIntervalMinutes ?? 0) > 0">
                  Last auto-sync: {{ agent.lastAutoSyncAt || 'not yet' }}
                  · {{ agent.syncIntervalLabel || syncIntervalLabel(agent.syncIntervalMinutes) }}
                </template>
                <template v-else>Manual sync only (dashboard).</template>
              </span>
            </div>

            <div style="margin-top: 0.75rem">
              <div class="agent-catalog-title">
                <strong>Evaluation criteria</strong>
                <span :class="['pill', agent.evaluationPromptIsCustom ? 'pill-warn' : 'pill-ok']">
                  {{ agent.evaluationPromptIsCustom ? 'Custom' : 'Default' }}
                </span>
              </div>
              <p class="muted">Calls are scored against this prompt (visible on agent and call pages).</p>

              <div v-if="editingCriteriaId === agent.ghlAgentId" class="manual-add-form">
                <div class="field">
                <label>Evaluation prompt</label>
                <textarea
                  v-model="editEvalPrompt"
                  placeholder="Describe what to check on each call — KPIs, script adherence, required fields..."
                />
                <span class="muted">Leave blank to use the default criteria. Changing this re-evaluates calls on next sync.</span>
              </div>
                <div class="actions-row">
                  <button class="btn" :disabled="busyId === agent.ghlAgentId" @click="saveCriteria(agent)">Save criteria</button>
                  <button class="btn btn-secondary" @click="cancelEditCriteria">Cancel</button>
                </div>
              </div>
              <template v-else>
                <pre class="eval-criteria-preview">{{ agent.evaluationPrompt }}</pre>
                <button class="btn btn-secondary" style="margin-top: 0.5rem" @click="startEditCriteria(agent)">
                  Edit evaluation criteria
                </button>
              </template>
            </div>

            <div v-if="editingId === agent.ghlAgentId" class="manual-add-form" style="margin-top: 0.75rem">
              <div class="field">
                <label>Private integration token</label>
                <input v-model="editToken" type="password" :placeholder="agent.apiTokenMask ? `Saved (${agent.apiTokenMask}) — leave blank to keep` : 'pit-...'" />
              </div>
              <div class="field">
                <label>Location ID</label>
                <input v-model="editLocationId" type="text" />
              </div>
              <div class="field">
                <label>API base URL</label>
                <input v-model="editApiBase" type="text" />
              </div>
              <div class="field">
                <label>Timezone</label>
                <input v-model="editTimezone" type="text" />
              </div>
              <div class="actions-row">
                <button class="btn" :disabled="busyId === agent.ghlAgentId" @click="saveEdit(agent)">Save connection</button>
                <button class="btn btn-secondary" @click="cancelEdit">Cancel</button>
              </div>
            </div>

            <div v-else class="actions-row" style="margin-top: 0.75rem">
              <button class="btn btn-secondary" @click="startEdit(agent)">Edit connection</button>
              <button class="btn btn-secondary" :disabled="busyId === agent.ghlAgentId" @click="removeAgent(agent.ghlAgentId)">
                Remove
              </button>
            </div>
          </div>
        </div>
      </article>

      <article class="card">
        <h3>Add agent</h3>
        <p class="muted">Enter this agent's HighLevel credentials, discover Voice AI agents, then add one.</p>

        <div class="manual-add-form">
          <div class="field">
            <label for="add-token">Private integration token</label>
            <input id="add-token" v-model="apiToken" type="password" placeholder="pit-..." />
          </div>
          <div class="field">
            <label for="add-location">Location ID</label>
            <input id="add-location" v-model="locationId" type="text" placeholder="Sub-account location ID" />
          </div>
          <div class="field">
            <label for="add-base">API base URL</label>
            <input id="add-base" v-model="apiBase" type="text" />
          </div>
          <div class="field">
            <label for="add-tz">Timezone</label>
            <input id="add-tz" v-model="timezone" type="text" />
          </div>
          <div class="field">
            <label for="add-sync">Auto-fetch transcripts</label>
            <select id="add-sync" v-model.number="addSyncInterval">
              <option v-for="opt in syncIntervalOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="add-eval">Evaluation prompt (optional)</label>
            <textarea
              id="add-eval"
              v-model="addEvalPrompt"
              placeholder="Custom criteria for scoring this agent's calls. Leave blank for defaults."
            />
          </div>
          <button class="btn btn-secondary" type="button" :disabled="discovering" @click="discoverAgents">
            {{ discovering ? 'Fetching…' : 'Fetch agents from HighLevel' }}
          </button>
        </div>

        <template v-if="discovered.length">
          <p class="muted" style="margin-top: 1rem">
            Found {{ discovered.length }} agent(s) in {{ locationName || 'location' }}:
          </p>
          <div class="field">
            <label for="pick-agent">Select agent</label>
            <select id="pick-agent" v-model="selectedAgentId">
              <option value="">Choose…</option>
              <option v-for="a in discovered" :key="a.ghlAgentId" :value="a.ghlAgentId">
                {{ a.name }} ({{ a.ghlAgentId }})
              </option>
            </select>
          </div>
          <button class="btn" :disabled="!selectedAgentId || !!busyId" @click="addDiscovered">Add selected agent</button>
        </template>

        <hr style="margin: 1.25rem 0; border: none; border-top: 1px solid #e5e7eb" />

        <h3>Or add by agent ID</h3>
        <div class="manual-add-form">
          <div class="field">
            <label for="manual-id">GHL agent ID</label>
            <input id="manual-id" v-model="manualAgentId" type="text" />
          </div>
          <div class="field">
            <label for="manual-name">Display name (optional)</label>
            <input id="manual-name" v-model="manualName" type="text" />
          </div>
          <button class="btn" :disabled="!!busyId" @click="addManual">Add with credentials above</button>
        </div>
      </article>
    </template>
  </section>
</template>
