<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const error = ref('');
const success = ref('');
const testResult = ref('');

const provider = ref('openai');
const openaiModel = ref('gpt-4o-mini');
const openaiApiKey = ref('');
const geminiModel = ref('gemini-2.0-flash');
const geminiApiKey = ref('');
const openaiKeySet = ref(false);
const openaiKeyMask = ref('');
const geminiKeySet = ref(false);
const geminiKeyMask = ref('');
const source = ref('');

function formPayload() {
  const payload = {
    provider: provider.value,
    openaiModel: openaiModel.value,
    geminiModel: geminiModel.value,
  };
  if (openaiApiKey.value.trim()) payload.openaiApiKey = openaiApiKey.value.trim();
  if (geminiApiKey.value.trim()) payload.geminiApiKey = geminiApiKey.value.trim();
  return payload;
}

function applySettings(s) {
  provider.value = s.provider;
  openaiModel.value = s.openai.model;
  geminiModel.value = s.gemini.model;
  openaiKeySet.value = s.openai.apiKeySet;
  openaiKeyMask.value = s.openai.apiKeyMask || '';
  geminiKeySet.value = s.gemini.apiKeySet;
  geminiKeyMask.value = s.gemini.apiKeyMask || '';
  source.value = s.source;
  openaiApiKey.value = '';
  geminiApiKey.value = '';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.llmSettings();
    applySettings(data.settings);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const data = await api.saveLlmSettings(formPayload());
    applySettings(data.settings);
    success.value = 'Settings saved.';
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  error.value = '';
  testResult.value = '';
  try {
    const data = await api.testLlmSettings(formPayload());
    testResult.value = `Connected to ${data.provider} (${data.model}).`;
  } catch (e) {
    error.value = e.message;
  } finally {
    testing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>AI Settings</h1>
        <p>Configure the LLM provider used for call evaluation and insights.</p>
      </div>
    </header>

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="success" class="card muted">{{ success }}</p>
    <p v-if="testResult" class="card muted">{{ testResult }}</p>

    <div v-if="loading" class="empty">Loading settings…</div>

    <form v-else class="card settings-form" @submit.prevent="save">
      <div class="field">
        <label for="provider">Provider</label>
        <select id="provider" v-model="provider">
          <option value="openai">OpenAI</option>
          <option value="gemini">Google Gemini</option>
        </select>
      </div>

      <div v-if="provider === 'openai'" class="provider-block">
        <div class="field">
          <label for="openai-model">OpenAI model</label>
          <input id="openai-model" v-model="openaiModel" type="text" placeholder="gpt-4o-mini" />
        </div>
        <div class="field">
          <label for="openai-key">OpenAI API key</label>
          <input
            id="openai-key"
            v-model="openaiApiKey"
            type="password"
            autocomplete="off"
            :placeholder="openaiKeySet ? `Saved (${openaiKeyMask}) — leave blank to keep` : 'sk-...'"
          />
        </div>
      </div>

      <div v-else class="provider-block">
        <div class="field">
          <label for="gemini-model">Gemini model</label>
          <input id="gemini-model" v-model="geminiModel" type="text" placeholder="gemini-2.0-flash" />
        </div>
        <div class="field">
          <label for="gemini-key">Gemini API key</label>
          <input
            id="gemini-key"
            v-model="geminiApiKey"
            type="password"
            autocomplete="off"
            :placeholder="geminiKeySet ? `Saved (${geminiKeyMask}) — leave blank to keep` : 'AIza...'"
          />
        </div>
      </div>

      <p v-if="source" class="muted">
        Active config source: {{ source === 'database' ? 'saved settings' : 'environment (.env)' }}
      </p>

      <div class="actions-row" style="margin-top: 1rem">
        <button class="btn" type="submit" :disabled="saving || testing">
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>
        <button class="btn btn-secondary" type="button" :disabled="saving || testing" @click="testConnection">
          {{ testing ? 'Testing…' : 'Test connection' }}
        </button>
      </div>
    </form>
  </section>
</template>
