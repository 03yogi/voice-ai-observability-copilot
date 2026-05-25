import { createRouter, createWebHistory } from 'vue-router';
import OverviewView from './views/OverviewView.vue';
import AgentView from './views/AgentView.vue';
import CallView from './views/CallView.vue';
import InsightsView from './views/InsightsView.vue';
import SettingsView from './views/SettingsView.vue';
import GhlSettingsView from './views/GhlSettingsView.vue';
import AgentsSettingsView from './views/AgentsSettingsView.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'overview', component: OverviewView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/settings/ghl', name: 'ghl-settings', component: GhlSettingsView },
    { path: '/settings/agents', name: 'agents-settings', component: AgentsSettingsView },
    { path: '/agents/:id', name: 'agent', component: AgentView },
    { path: '/agents/:id/insights', name: 'insights', component: InsightsView },
    { path: '/agents/:agentId/calls/:callId', name: 'call', component: CallView },
  ],
});
