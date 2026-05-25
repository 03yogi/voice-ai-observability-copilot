# Voice AI Observability Copilot

**Repository:** https://github.com/03yogi/voice-ai-observability-copilot

Agent Observability Copilot for HighLevel Voice AI — syncs call transcripts, evaluates each call session with an LLM, and surfaces AI-generated recommendations inside a GHL sub-account iframe.

## Problem and solution

HighLevel Voice AI agents handle real customer calls, but teams lack a unified view of *which* agents are failing, *why* specific calls went wrong, and *what* to change in prompts or workflows. This copilot ingests Voice AI call logs, runs structured LLM evaluation per session (KPIs, deviations, Use Actions, per-call suggestions), and aggregates agent-level recommendations — all configurable from the UI without editing `.env`.

## Quick start

### 1. Install

```bash
npm install
cp .env.example .env   # PORT only; rest configured in UI
```

### 2. Development

```bash
npm run dev
```

- **API:** http://localhost:3001  
- **Web:** http://localhost:5173 (proxies `/api` to the API)

### 3. Configure in the app

1. **Agents** (`/settings/agents`) — add Voice AI agents with per-agent GHL JWT + location ID; optional custom evaluation criteria  
2. **AI Settings** (`/settings`) — OpenAI or Gemini provider + API key  
3. **Overview** — **Sync from HighLevel** to ingest and evaluate calls

### 4. Production / GHL iframe

```bash
APP_URL=https://your-public-url.example.com npm run start:prod
```

Set the marketplace app Custom Menu Link to:

```text
https://your-public-url.example.com/?location_id={{location.id}}
```

Full steps: [docs/GHL_SETUP.md](docs/GHL_SETUP.md)

### Auto sync (per agent)

Each monitored agent has its own **auto-fetch schedule** in **Settings → Agents**:

| Interval | Use case |
|----------|----------|
| Manual only | Default — sync from dashboard when you want |
| Every 5 min | High call volume |
| Every 15 min | Active production |
| Every hour | Moderate traffic |
| Every 24 hours | Low volume / compliance |

The API runs a **60-second tick**, checks which agents are due, and syncs them **one at a time** (GHL call-logs with pagination, LLM only on new/changed calls).

```bash
curl http://localhost:3001/api/sync/status   # per-agent due / last run
curl http://localhost:3001/api/sync/options # interval choices
```

Optional webhook: `POST /api/webhooks/ghl/call-completed?sync=true` (all agents).

## Architecture

```text
GHL APIs → sync.js → evaluate.js (LLM) → SQLite → Vue dashboard (iframe)
                  → recommendations.js (LLM, cached)
```

Detailed diagram and module map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

| Module | Role |
|--------|------|
| `apps/api/src/ghl/` | GHL client with per-agent credentials |
| `apps/api/src/services/sync.js` | Ingest + smart re-eval via fingerprint |
| `apps/api/src/services/evaluate.js` | Per-call LLM evaluation |
| `apps/api/src/services/recommendations.js` | Agent-level LLM recommendations |
| `apps/api/src/services/sync-scheduler.js` | Per-agent auto-fetch (60s tick) |
| `apps/api/src/ghl/normalize-call-log.js` | GHL field normalization |
| `apps/web/src/ghl/embed.js` | GHL iframe context (`location_id` query param) |

## API routes (summary)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sync` | Sync all agents (optional `ghlAgentId` in body) |
| POST | `/api/agents/:id/sync` | Sync one agent |
| GET | `/api/sync/status` | Scheduler + per-agent auto-sync state |
| GET | `/api/sync/options` | Auto-fetch interval choices |
| GET | `/api/agents` | Dashboard agent list |
| GET | `/api/agents/catalog` | Settings → monitored agents |
| PUT | `/api/monitored-agents/:ghlAgentId` | Update creds, criteria, **sync interval** |
| GET | `/api/calls/:id` | Call detail + evaluation |
| POST | `/api/calls/:id/reanalyze` | Force LLM re-evaluate one call |
| GET | `/api/agents/:id/recommendations` | Agent insights (`?refresh=true`) |
| GET | `/api/health/llm` | LLM provider status |
| GET | `/api/embed/info` | Iframe URL template |
| POST | `/api/webhooks/ghl/call-completed` | Webhook stub (`?sync=true`) |

## Functional vs mocked

| Component | Status |
|-----------|--------|
| GHL agents + call logs | **Real** (per-agent JWT in UI) |
| Call evaluation | **LLM** (OpenAI or Gemini, UI-configured) |
| Recommendations | **LLM** (cached in SQLite) |
| KPI / deviation logic | **LLM** against agent prompt + custom criteria |
| GHL iframe embed | **Implemented** — CSP headers + `location_id` URL param |
| Webhooks | **Stub** — `?sync=true` triggers sync all |
| Auto sync | **Per-agent schedule** — 60s tick, paginated ingest, fingerprint skip |
| Extracted data (GHL) | **Real** from call logs; may be `{}` if agent didn't collect fields |
| Auto prompt updates in GHL | Not implemented (recommendations are copy-only) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API won't start (`better_sqlite3` / NODE_MODULE_VERSION) | `npm rebuild better-sqlite3` then `npm run dev` |
| Sync 404 or stale API | `lsof -ti :3001 \| xargs kill -9` then restart `npm run dev` |
| `0 evaluated, N skipped` | Calls unchanged — open call → **Refresh analysis** |
| Empty extracted data `{}` | GHL didn't return name/email for that call (see call in GHL UI) |
| Auto-fetch dropdown empty | Restart API; page falls back to default intervals |

## Submission

See [SUBMISSION.md](SUBMISSION.md) for deliverable checklist, demo flow, and remaining steps (GitHub + Loom).

## Team of one

| Role | Approach |
|------|----------|
| **Product** | Session-based observability loop: sync → score → evidence → recommendations |
| **Design** | Vue dashboard with transcript quotes, Use Actions, copy suggestions; compact embed mode |
| **Engineering** | Node ingest, unified LLM layer, SQLite, single-origin prod deploy for iframe |
| **QA** | Verified GHL sandbox APIs; JSON schema normalizers for LLM output |

## LLM providers

Configure in **AI Settings** (or optional `.env` fallback):

| Provider | Notes |
|----------|-------|
| **openai** (default) | `gpt-4o-mini` recommended |
| **gemini** | `gemini-2.0-flash` |

See [docs/LLM_PIPELINE.md](docs/LLM_PIPELINE.md).

## Demo script (2–5 min)

1. Open GHL → custom menu **Observability Copilot** (embedded badge visible)  
2. Overview — agents with pass rates; one flagged low  
3. Agent → worst call → KPI failures with transcript quotes  
4. Use Actions on call detail  
5. Insights → recommendations → copy suggestion  
6. Note: live GHL + LLM; webhook auto-sync is stubbed  

## Future work

- Wire GHL Voice AI webhooks to auto-sync on call completion  
- Push approved prompt changes back to GHL via API  
- Trend charts and alerting thresholds  
- Multi-location agency rollup  

## References

- Assignment: `[Hiring] FSB Assignment Q226.md`
- [docs/GHL_SETUP.md](docs/GHL_SETUP.md) — marketplace iframe install
- [docs/GHL_API.md](docs/GHL_API.md) — verified API curls
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [SUBMISSION.md](SUBMISSION.md) — wrap-up checklist
- [BUILD_PLAN.md](BUILD_PLAN.md)
