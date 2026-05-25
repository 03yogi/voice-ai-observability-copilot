<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api.js';

const loading = ref(true);
const saving = ref(false);
const testing = ref(false);
const error = ref('');
const success = ref('');
const testResult = ref('');

const locationId = ref('');
const apiBase = ref('https://services.leadconnectorhq.com');
const timezone = ref('Asia/Kolkata');
const defaultAgentId = ref('');
const apiToken = ref('');
const apiTokenSet = ref(false);
const apiTokenMask = ref('');
const source = ref('');

function formPayload() {
  const payload = {
    locationId: locationId.value.trim(),
    apiBase: apiBase.value.trim(),
    timezone: timezone.value.trim(),
    defaultAgentId: defaultAgentId.value.trim(),
  };
  if (apiToken.value.trim()) payload.apiToken = apiToken.value.trim();
  return payload;
}

function applySettings(s) {
  locationId.value = s.locationId || '';
  apiBase.value = s.apiBase || 'https://services.leadconnectorhq.com';
  timezone.value = s.timezone || 'Asia/Kolkata';
  defaultAgentId.value = s.defaultAgentId || '';
  apiTokenSet.value = s.apiTokenSet;
  apiTokenMask.value = s.apiTokenMask || '';
  source.value = s.source;
  apiToken.value = '';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.ghlSettings();
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
    const data = await api.saveGhlSettings(formPayload());
    applySettings(data.settings);
    success.value = 'HighLevel settings saved.';
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
    const data = await api.testGhlSettings(formPayload());
    testResult.value = `Connected to location: ${data.location}`;
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
        <h1>HighLevel Settings</h1>
        <p>Connect your sandbox or sub-account to sync Voice AI agents and call logs.</p>
      </div>
    </header>

    <p v-if="error" class="alert">{{ error }}</p>
    <p v-if="success" class="card muted">{{ success }}</p>
    <p v-if="testResult" class="card muted">{{ testResult }}</p>

    <div v-if="loading" class="empty">Loading settings…</div>

    <form v-else class="card settings-form" @submit.prevent="save">
      <div class="field">
        <label for="ghl-token">Private Integration Token</label>
        <input
          id="ghl-token"
          v-model="apiToken"
          type="password"
          autocomplete="off"
          :placeholder="apiTokenSet ? `Saved (${apiTokenMask}) — leave blank to keep` : 'pit-...'"
        />
        <span class="muted">From HighLevel → Settings → Private Integrations</span>
      </div>

      <div class="field">
        <label for="ghl-location">Location ID</label>
        <input id="ghl-location" v-model="locationId" type="text" placeholder="UmiW3ZZUkaJLNkY5kEuk" />
      </div>

      <div class="field">
        <label for="ghl-base">API base URL</label>
        <input id="ghl-base" v-model="apiBase" type="text" />
      </div>

      <div class="field">
        <label for="ghl-tz">Timezone</label>
        <input id="ghl-tz" v-model="timezone" type="text" placeholder="Asia/Kolkata" />
        <span class="muted">Used when fetching call logs</span>
      </div>

      <div class="field">
        <label for="ghl-default-agent">Default agent ID (optional)</label>
        <input id="ghl-default-agent" v-model="defaultAgentId" type="text" placeholder="Auto-add on first setup" />
        <span class="muted">Bootstrap only — use Agents screen to manage multiple agents</span>
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
