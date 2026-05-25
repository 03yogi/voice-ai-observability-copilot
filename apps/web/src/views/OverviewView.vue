<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api.js';

const agents = ref([]);
const loading = ref(true);
const syncing = ref(false);
const syncingAgentId = ref('');
const error = ref('');
const syncMessage = ref('');
const llmConfigured = ref(true);
const ghlConfigured = ref(true);
const monitoredCount = ref(0);
const autoSyncSummary = ref(null);

function scoreClass(score) {
  if (score == null) return 'pill-warn';
  if (score >= 70) return 'pill-ok';
  return 'pill-bad';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [agentsData, llmHealth, ghlHealth, monitoredData, syncStatus] = await Promise.all([
      api.agents(),
      fetch('/api/health/llm').then((r) => r.json()),
      fetch('/api/health/ghl').then((r) => r.json()),
      api.monitoredAgents(),
      api.syncStatus().catch(() => null),
    ]);
    agents.value = agentsData.agents;
    llmConfigured.value = llmHealth.llm?.configured ?? false;
    ghlConfigured.value = ghlHealth.configured ?? false;
    monitoredCount.value = monitoredData.agents?.length ?? 0;
    autoSyncSummary.value = syncStatus;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function formatSyncMessage(result, agentName) {
  const prefix = agentName ? `${agentName}: ` : '';
  const parts = [`${prefix}synced ${result.callsSynced} call(s)`];
    if (result.callsEvaluated != null) {
      parts.push(`${result.callsEvaluated} evaluated`);
      if (result.callsSkipped) parts.push(`${result.callsSkipped} skipped (unchanged)`);
    }
    if (result.evalErrors?.length) {
      parts.push(`${result.evalErrors.length} eval error(s) — check AI Settings`);
    }
  return `${parts.join(' · ')}.`;
}

async function syncNow() {
  syncing.value = true;
  syncMessage.value = '';
  error.value = '';
  try {
    const result = await api.sync();
    syncMessage.value = formatSyncMessage(result);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    syncing.value = false;
  }
}

async function syncAgent(agent) {
  syncingAgentId.value = agent.id;
  syncMessage.value = '';
  error.value = '';
  try {
    const result = await api.syncAgent(agent.id);
    syncMessage.value = formatSyncMessage(result, agent.name);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    syncingAgentId.value = '';
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Observability Dashboard</h1>
        <p>Monitor Voice AI agents and call performance against KPIs.</p>
      </div>
      <button class="btn" :disabled="syncing || !!syncingAgentId" @click="syncNow">
        {{ syncing ? 'Syncing all…' : 'Sync all from HighLevel' }}
      </button>
    </header>

    <p v-if="autoSyncSummary?.autoSyncEnabledCount > 0" class="card muted">
      Auto-fetch: {{ autoSyncSummary.autoSyncEnabledCount }} agent(s) on a schedule
      (server checks every {{ autoSyncSummary.tickSeconds || 60 }}s).
      <RouterLink to="/settings/agents">Edit schedules</RouterLink>
    </p>
    <p v-else-if="ghlConfigured && monitoredCount" class="card muted">
      Auto-fetch is off for all agents (manual sync only).
      <RouterLink to="/settings/agents">Set auto-fetch per agent</RouterLink>
    </p>

    <p v-if="!ghlConfigured" class="banner-warn">
      No agents with HighLevel credentials configured.
      <RouterLink to="/settings/agents">Add an agent with its token and location ID</RouterLink>
      before syncing.
    </p>

    <p v-if="!monitoredCount" class="banner-warn">
      No Voice AI agents configured.
      <RouterLink to="/settings/agents">Add agents to monitor</RouterLink>
      before syncing.
    </p>

    <p v-if="!llmConfigured" class="banner-warn">
      AI evaluation is not configured.
      <RouterLink to="/settings">Add your LLM API key in Settings</RouterLink>
      before syncing calls.
    </p>

    <p v-if="syncMessage" class="card muted">{{ syncMessage }}</p>
    <p v-if="error" class="alert">{{ error }}</p>

    <div v-if="loading" class="empty">Loading agents…</div>

    <div v-else-if="!agents.length" class="card empty">
      <p>
        No synced data yet for your monitored agents.
        <RouterLink to="/settings/agents">Manage agents</RouterLink>
        or click <strong>Sync from HighLevel</strong>.
      </p>
    </div>

    <div v-else class="grid grid-2">
      <article v-for="agent in agents" :key="agent.id" class="card">
        <h2>{{ agent.name }}</h2>
        <p class="muted">{{ agent.businessName }}</p>
        <div class="grid grid-2" style="margin-top: 0.75rem">
          <div>
            <div class="muted">Calls</div>
            <div class="stat">{{ agent.callCount }}</div>
          </div>
          <div>
            <div class="muted">Avg score</div>
            <div class="stat">
              <span :class="['pill', scoreClass(agent.avgScore)]">
                {{ agent.avgScore ?? '—' }}
              </span>
            </div>
          </div>
        </div>
        <p class="muted" style="margin-top: 0.75rem">
          <span v-if="!agent.synced" class="pill pill-warn">Not synced from GHL yet — run Sync</span>
          <template v-else>{{ agent.issueCount }} call(s) below KPI threshold</template>
        </p>
        <div class="actions-row" style="margin-top: 1rem">
          <button
            class="btn"
            :disabled="syncing || syncingAgentId === agent.id"
            @click="syncAgent(agent)"
          >
            {{ syncingAgentId === agent.id ? 'Syncing…' : 'Sync this agent' }}
          </button>
          <RouterLink class="btn btn-secondary" :to="`/agents/${agent.id}`">View calls</RouterLink>
          <RouterLink class="btn btn-secondary" :to="`/agents/${agent.id}/insights`">Call insights</RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>
