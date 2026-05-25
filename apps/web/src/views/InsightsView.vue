<script setup>
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const agent = ref(null);
const calls = ref([]);
const loading = ref(true);
const error = ref('');

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function scoreClass(score) {
  if (score >= 70) return 'pill-ok';
  return 'pill-bad';
}

function impactClass(impact) {
  if (impact === 'high') return 'pill-bad';
  if (impact === 'low') return 'pill-ok';
  return 'pill-warn';
}

onMounted(async () => {
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
});
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Call insights — {{ agent?.name }}</h1>
        <p class="muted">Per-call AI suggestions tied to each conversation</p>
      </div>
      <RouterLink class="btn btn-secondary" :to="`/agents/${route.params.id}`">Back to calls</RouterLink>
    </header>

    <p v-if="error" class="alert">{{ error }}</p>
    <div v-if="loading" class="empty">Loading call insights…</div>

    <div v-else-if="!calls.length" class="card empty">
      No calls synced yet. Run sync from the dashboard.
    </div>

    <div v-else class="list">
      <article v-for="call in calls" :key="call.id" class="card call-insight-card">
        <header class="call-insight-header">
          <div>
            <strong>{{ formatDate(call.startedAt) }}</strong>
            <p class="muted">{{ call.summary }}</p>
          </div>
          <span :class="['pill', scoreClass(call.overallScore)]">{{ call.overallScore ?? '—' }}</span>
        </header>

        <div v-if="!call.suggestions?.length" class="muted">
          No suggestions for this call yet.
        </div>
        <div v-else class="list">
          <div v-for="(item, i) in call.suggestions" :key="i" class="suggestion-card">
            <div class="suggestion-header">
              <strong>{{ item.title }}</strong>
              <span :class="['pill', impactClass(item.impact)]">{{ item.impact }}</span>
            </div>
            <p class="muted">{{ item.body }}</p>
          </div>
        </div>

        <RouterLink class="btn btn-secondary" style="margin-top: 0.75rem" :to="`/agents/${route.params.id}/calls/${call.id}`">
          View transcript & suggestions
        </RouterLink>
      </article>
    </div>
  </section>
</template>
