<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const agent = ref(null);
const calls = ref([]);
const loading = ref(true);
const error = ref('');

function scoreClass(score) {
  if (score == null) return 'pill-warn';
  if (score >= 70) return 'pill-ok';
  return 'pill-bad';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [agentRes, callsRes] = await Promise.all([
      api.agent(route.params.id),
      api.calls(route.params.id),
    ]);
    agent.value = agentRes.agent;
    calls.value = callsRes.calls;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>{{ agent?.name || 'Agent' }}</h1>
        <p class="muted">Call history and KPI results</p>
      </div>
      <div class="actions-row">
        <RouterLink class="btn btn-secondary" to="/">Back</RouterLink>
        <RouterLink class="btn btn-secondary" :to="`/agents/${route.params.id}/insights`">Call insights</RouterLink>
      </div>
    </header>

    <article v-if="agent?.evaluationPrompt" class="card" style="margin-bottom: 1rem">
      <h3>Evaluation criteria</h3>
      <p class="muted">
        Calls are scored against this prompt
        <span v-if="agent.evaluationPromptIsCustom" class="pill pill-warn">Custom</span>
        <span v-else class="pill pill-ok">Default</span>
      </p>
      <pre class="eval-criteria-preview">{{ agent.evaluationPrompt }}</pre>
      <RouterLink class="btn btn-secondary" style="margin-top: 0.5rem" to="/settings/agents">Edit criteria</RouterLink>
    </article>

    <p v-if="error" class="alert">{{ error }}</p>
    <div v-if="loading" class="empty">Loading calls…</div>

    <div v-else-if="!calls.length" class="card empty">
      No calls synced yet. Run sync from the dashboard.
    </div>

    <div v-else class="list">
      <RouterLink
        v-for="call in calls"
        :key="call.id"
        class="list-item"
        :to="`/agents/${route.params.id}/calls/${call.id}`"
      >
        <div>
          <strong>{{ formatDate(call.startedAt) }}</strong>
          <p class="muted">{{ call.summary }}</p>
          <p v-if="call.suggestionCount" class="muted">{{ call.suggestionCount }} AI suggestion(s)</p>
        </div>
        <span v-if="call.overallScore == null" class="pill pill-warn">Not analyzed</span>
        <span v-else :class="['pill', scoreClass(call.overallScore)]">{{ call.overallScore }}</span>
      </RouterLink>
    </div>
  </section>
</template>
