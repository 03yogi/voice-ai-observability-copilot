<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { ghlEmbed } from './ghl/embed.js';
</script>

<template>
  <div class="layout" :class="{ 'layout--embedded': ghlEmbed.embedded }">
    <header class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-icon">◉</span>
        <span class="brand-text">Voice AI Observability Copilot</span>
      </RouterLink>
      <nav class="topbar-nav">
        <RouterLink to="/settings/agents" class="nav-link">Agents</RouterLink>
        <RouterLink to="/settings" class="nav-link">AI Settings</RouterLink>
        <span v-if="ghlEmbed.embedded" class="badge badge-embed">Embedded in GHL</span>
        <span v-else class="badge">HighLevel</span>
      </nav>
    </header>
    <div v-if="ghlEmbed.embedded && ghlEmbed.locationId" class="embed-banner">
      Sub-account location: <code>{{ ghlEmbed.locationId }}</code>
    </div>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>
