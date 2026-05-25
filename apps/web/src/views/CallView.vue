<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const call = ref(null);
const loading = ref(true);
const reanalyzing = ref(false);
const error = ref('');
const copied = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.call(route.params.callId);
    call.value = data.call;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function refreshAnalysis() {
  reanalyzing.value = true;
  error.value = '';
  try {
    await api.reanalyzeCall(route.params.callId);
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    reanalyzing.value = false;
  }
}

async function copy(text) {
  await navigator.clipboard.writeText(text);
  copied.value = text;
  setTimeout(() => { copied.value = ''; }, 2000);
}

function impactClass(impact) {
  if (impact === 'high') return 'pill-bad';
  if (impact === 'low') return 'pill-ok';
  return 'pill-warn';
}

const hasExtractedData = computed(() => {
  const d = call.value?.extractedData;
  if (!d || typeof d !== 'object') return false;
  return Object.values(d).some((v) => v != null && String(v).trim() !== '');
});

onMounted(load);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Call detail</h1>
        <p class="muted">
          Score {{ call?.overallScore ?? '—' }} · {{ call?.durationSec }}s
          <span v-if="call?.evaluatedBy"> · AI: {{ call.evaluatedBy }}</span>
        </p>
      </div>
      <div class="actions-row">
        <button class="btn btn-secondary" :disabled="reanalyzing" @click="refreshAnalysis">
          {{ reanalyzing ? 'Analyzing…' : 'Refresh analysis' }}
        </button>
        <RouterLink class="btn btn-secondary" :to="`/agents/${route.params.agentId}`">Back to calls</RouterLink>
      </div>
    </header>

    <p v-if="call && call.overallScore == null && !call.evaluatedBy" class="banner-warn">
      This call was synced but not analyzed yet. Click <strong>Refresh analysis</strong> or run sync again.
    </p>

    <p v-if="error" class="alert">{{ error }}</p>
    <div v-if="loading" class="empty">Loading call…</div>

    <template v-else-if="call">
      <div class="grid grid-2" style="margin-bottom: 1rem">
        <article class="card">
          <h3>Summary</h3>
          <p>{{ call.summary }}</p>
        </article>
        <article class="card">
          <h3>Extracted data (from HighLevel)</h3>
          <p v-if="!hasExtractedData" class="muted">
            No structured fields from GHL for this call (name/email may be empty in Voice AI actions).
          </p>
          <pre v-else class="transcript">{{ JSON.stringify(call.extractedData, null, 2) }}</pre>
        </article>
      </div>

      <article v-if="call.evaluationPrompt" class="card" style="margin-bottom: 1rem">
        <h3>Evaluation criteria used</h3>
        <p class="muted">
          This call was scored against:
          <span v-if="call.evaluationPromptIsCustom" class="pill pill-warn">Custom prompt</span>
          <span v-else class="pill pill-ok">Default prompt</span>
        </p>
        <pre class="eval-criteria-preview">{{ call.evaluationPrompt }}</pre>
      </article>

      <article class="card" style="margin-bottom: 1rem">
        <h3>KPI results</h3>
        <div class="list">
          <div
            v-for="kpi in call.kpiResults"
            :key="kpi.kpi"
            class="list-item"
            style="flex-direction: column; align-items: flex-start"
          >
            <div style="display: flex; justify-content: space-between; width: 100%">
              <span>{{ kpi.label }}</span>
              <span :class="['pill', kpi.pass ? 'pill-ok' : 'pill-bad']">{{ kpi.pass ? 'Pass' : 'Fail' }}</span>
            </div>
            <span v-if="kpi.evidence" class="muted">{{ kpi.evidence }}</span>
          </div>
        </div>
      </article>

      <div class="call-detail-split">
        <article class="card">
          <h3>Transcript</h3>
          <pre class="transcript">{{ call.transcript }}</pre>
        </article>

        <article class="card">
          <h3>AI suggestions for this call</h3>
          <p v-if="!call.suggestions?.length" class="muted">
            No suggestions yet.
            <button class="link-btn" :disabled="reanalyzing" @click="refreshAnalysis">Run AI analysis</button>
          </p>
          <div v-else class="list">
            <div
              v-for="(item, i) in call.suggestions"
              :key="i"
              class="suggestion-card"
            >
              <div class="suggestion-header">
                <strong>{{ item.title }}</strong>
                <span :class="['pill', impactClass(item.impact)]">{{ item.impact }}</span>
              </div>
              <p class="muted">{{ item.body }}</p>
              <pre v-if="item.examplePromptSnippet" class="transcript">{{ item.examplePromptSnippet }}</pre>
              <button
                v-if="item.examplePromptSnippet"
                class="btn btn-secondary"
                style="margin-top: 0.5rem"
                @click="copy(item.examplePromptSnippet)"
              >
                {{ copied === item.examplePromptSnippet ? 'Copied!' : 'Copy suggestion' }}
              </button>
            </div>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>
