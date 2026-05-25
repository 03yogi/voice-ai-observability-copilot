# FSB Q226 — Submission wrap-up

Voice AI Observability Copilot for HighLevel.

## Deliverables status

| Assignment deliverable | Status | Where |
|------------------------|--------|--------|
| Node.js backend + Vue frontend | Done | `apps/api/`, `apps/web/` |
| GHL sandbox integration | Done | Per-agent JWT in **Settings → Agents** |
| Monitor + Analyze loops | Done | `sync.js`, `evaluate.js`, dashboard |
| Marketplace / iframe embed | Done | `docs/GHL_SETUP.md`, `embed-headers.js` |
| Install & run docs | Done | `README.md` |
| Architecture + Team of One | Done | `README.md`, `docs/ARCHITECTURE.md` |
| Functional vs mocked | Done | `README.md` § Functional vs mocked |
| **GitHub repo URL** | https://github.com/03yogi/voice-ai-observability-copilot |
| **Loom demo (2–5 min)** | **You** | Record; add URL to README |

## Before you submit (15 min checklist)

```bash
# 1. Fix native module if API won't start (Node 22 vs 25 mismatch)
npm rebuild better-sqlite3
lsof -ti :3001 | xargs kill -9 2>/dev/null
npm run dev

# 2. Smoke test
# - Settings → AI: LLM key + test
# - Settings → Agents: 1+ agent, set auto-fetch if desired
# - Overview → Sync all / Sync this agent
# - Open call → KPIs + extracted data + Refresh analysis
# - Insights → recommendations

# 3. Production / GHL demo (optional for Loom)
APP_URL=https://YOUR-NGROK-OR-HOST npm run start:prod
# Custom Menu Link: https://HOST/?location_id={{location.id}}
```

## UI map (where things live)

| Screen | Route | Purpose |
|--------|-------|---------|
| Dashboard | `/` | Agent scores, **Sync all**, per-agent **Sync this agent** |
| Agent calls | `/agents/:id` | Call list, scores |
| Call detail | `/agents/:id/calls/:callId` | Transcript, KPIs, Use Actions, GHL extracted data |
| Call insights | `/agents/:id/insights` | Agent-level AI recommendations |
| **Auto-fetch schedule** | **`/settings/agents`** | Per-agent interval (5m / 1h / 24h / manual) |
| LLM config | `/settings` | OpenAI or Gemini API key |

## Key technical behaviors (for reviewers)

- **Ingest:** `GET /voice-ai/dashboard/call-logs` with **pagination** (all pages per sync).
- **Eval:** LLM per call; **fingerprint** skips unchanged transcripts; **`pending`** calls always evaluated.
- **Auto-sync:** 60s scheduler; each agent has own `sync_interval_minutes` + `last_auto_sync_at`.
- **Credentials:** Stored in SQLite per monitored agent (not in browser long-term).
- **Webhooks:** Stub only — polling is the reliable path.

## Sandbox reference (this project)

| Resource | ID |
|----------|-----|
| Location | `UmiW3ZZUkaJLNkY5kEuk` |
| Sample agent | `6a11f0b5066e920e0c6cc344` (Demo Booking Agent) |

## Known limitations (honest for README)

- No push webhook from GHL for Voice AI call-complete (poll / manual / per-agent schedule).
- Recommendations are **copy-only** — not written back to GHL agent config.
- Max **100 pages** of call logs per agent per sync (50 per page).
- Single-server SQLite — not multi-tenant production scale.

## Doc index

- [README.md](README.md) — start here
- [docs/GHL_SETUP.md](docs/GHL_SETUP.md) — iframe + marketplace
- [docs/GHL_API.md](docs/GHL_API.md) — verified curls
- [docs/LLM_PIPELINE.md](docs/LLM_PIPELINE.md) — prompts & schemas
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design
- [BUILD_PLAN.md](BUILD_PLAN.md) — original plan (reference)
