# HighLevel API Reference — Voice AI Observability Copilot

Verified against sandbox sub-account **Voice AI Copilot Test** (May 2026).

Use this doc for local testing and as the backend integration spec for the project.

---

## Environment variables

Store credentials in `.env` at the project root — **never commit the token**.

```env
GHL_API_TOKEN=pit-your-private-integration-token
GHL_LOCATION_ID=UmiW3ZZUkaJLNkY5kEuk
GHL_AGENT_ID=6a11f0b5066e920e0c6cc344
GHL_API_BASE=https://services.leadconnectorhq.com
GHL_TIMEZONE=Asia/Kolkata
```

| Variable | Purpose |
|----------|---------|
| `GHL_API_TOKEN` | Private Integration Token from sub-account **Settings → Private Integrations** |
| `GHL_LOCATION_ID` | Sub-account (location) ID — from URL `/v2/location/{id}/...` |
| `GHL_AGENT_ID` | Voice AI agent ID — from agents list response |
| `GHL_TIMEZONE` | IANA timezone for call-logs queries (match sub-account timezone) |

### Required headers (all requests)

```http
Authorization: Bearer ${GHL_API_TOKEN}
Version: 2021-07-28
Accept: application/json
```

### Token scopes

Private Integration must include at minimum:

- **Locations** (verify sub-account access)
- **Voice AI** (agents + call logs)

Create the token **inside the sub-account**, not only at agency level.

---

## Sandbox IDs (this project)

| Resource | ID |
|----------|-----|
| Location (sub-account) | `UmiW3ZZUkaJLNkY5kEuk` |
| Voice AI agent | `6a11f0b5066e920e0c6cc344` |
| Agent name | `Demo Booking Agent` |
| Sample call 1 | `6a11f28602747d3f6bc47070` |
| Sample call 2 | `6a11f25152fdebe1308566ee` |

---

## Endpoints used in this project

| # | Endpoint | Used for |
|---|----------|----------|
| 1 | `GET /locations/:locationId` | Health check; confirm token + location on startup |
| 2 | `GET /voice-ai/agents` | Sync agents; load prompt/goals for KPI config |
| 3 | `GET /voice-ai/dashboard/call-logs` | **Primary ingest** — transcripts, summaries, extracted data |
| 4 | `GET /voice-ai/dashboard/call-logs/:callId` | Call drill-down (optional; list already includes transcript) |

Not required for MVP but noted in `BUILD_PLAN.md`:

- Webhooks for real-time call completion
- OAuth marketplace app flow (iframe + server-side PIT is sufficient for assignment)

---

## 1. Verify location (health check)

**Purpose:** Confirm token works and matches the sub-account before sync.

```bash
curl -s "${GHL_API_BASE}/locations/${GHL_LOCATION_ID}" \
  -H "Authorization: Bearer ${GHL_API_TOKEN}" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Success:** `"name": "Voice AI Copilot Test"`

**Errors:**

| Status | Meaning |
|--------|---------|
| 403 | Token not scoped to this location — recreate token in sub-account |
| 401 | Invalid or revoked token |

---

## 2. List Voice AI agents

**Purpose:** Dashboard agent picker; seed observability KPIs from `agentPrompt` and `actions`.

```bash
curl -s "${GHL_API_BASE}/voice-ai/agents?locationId=${GHL_LOCATION_ID}&page=1&pageSize=10" \
  -H "Authorization: Bearer ${GHL_API_TOKEN}" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Key response fields:**

| Field | Copilot use |
|-------|-------------|
| `agents[].id` | Store as `ghl_agent_id` |
| `agents[].agentName` | Dashboard display |
| `agents[].agentPrompt` | Auto-suggest success criteria / script rules |
| `agents[].actions[]` | KPI definitions (name, email, otherDetails extraction) |
| `agents[].welcomeMessage` | Script compliance checks |

**Verified response:** `"total": 1`, agent `Demo Booking Agent`

---

## 3. List call logs (primary data source)

**Purpose:** Monitor loop — ingest transcripts, summaries, and GHL-extracted fields for KPI scoring and recommendations.

```bash
curl -s "${GHL_API_BASE}/voice-ai/dashboard/call-logs?locationId=${GHL_LOCATION_ID}&agentId=${GHL_AGENT_ID}&timezone=${GHL_TIMEZONE}&page=1&pageSize=10" \
  -H "Authorization: Bearer ${GHL_API_TOKEN}" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Query parameters:**

| Param | Required | Notes |
|-------|----------|-------|
| `locationId` | Yes | Sub-account ID |
| `agentId` | Recommended | Filter to one agent |
| `timezone` | Yes | e.g. `Asia/Kolkata` — must match location |
| `page` | No | 1-based pagination (default 1) |
| `pageSize` | No | Default 10 |

**Do not use:** `dateStart` / `dateEnd` — returns **422** on this endpoint.

**Key response fields:**

| Field | Copilot use |
|-------|-------------|
| `callLogs[].id` | Primary key for call detail view |
| `callLogs[].transcript` | LLM evaluation input |
| `callLogs[].transcriptWithToolCalls` | Use Actions timestamps (`startTime`, `endTime`, `role`) |
| `callLogs[].summary` | Dashboard issue cards |
| `callLogs[].extractedData.name/email/otherDetails` | Rule-based KPI pass/fail |
| `callLogs[].duration` | Short-call / hang-up detection |
| `callLogs[].createdAt` | Sorting and trends |
| `callLogs[].trialCall` | Label sandbox web calls in UI |

**Verified response:** `"total": 2` with full transcripts

---

## 4. Get single call log (optional)

**Purpose:** Call drill-down page. The list endpoint already returns transcripts; use this only if you need a refresh of one call.

```bash
curl -s "${GHL_API_BASE}/voice-ai/dashboard/call-logs/${CALL_ID}?locationId=${GHL_LOCATION_ID}" \
  -H "Authorization: Bearer ${GHL_API_TOKEN}" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Example with verified call ID:**

```bash
curl -s "https://services.leadconnectorhq.com/voice-ai/dashboard/call-logs/6a11f28602747d3f6bc47070?locationId=UmiW3ZZUkaJLNkY5kEuk" \
  -H "Authorization: Bearer ${GHL_API_TOKEN}" \
  -H "Version: 2021-07-28" \
  -H "Accept: application/json"
```

**Important:** `locationId` must be a **query parameter**, even when `callId` is in the path.

---

## Common mistakes

| Wrong | Result | Fix |
|-------|--------|-----|
| `/call-logs/UmiW3ZZUkaJLNkY5kEuk` | 400 — location id used as call id | Use `?locationId=...` on list endpoint |
| `/call-logs/{callId}` without `?locationId=` | 400 — LocationId missing | Add `?locationId=UmiW3ZZUkaJLNkY5kEuk` |
| Token created at agency only | 403 on location-scoped calls | Create token inside sub-account |
| `dateStart` / `dateEnd` on call-logs | 422 | Omit; use pagination instead |

---

## How each endpoint maps to the copilot

```text
┌─────────────────────────────────────────────────────────────┐
│                     Node.js Backend                          │
├─────────────────────────────────────────────────────────────┤
│  POST /api/sync                                               │
│    → GET /voice-ai/agents          (sync agent config)        │
│    → GET /voice-ai/dashboard/call-logs  (ingest transcripts)  │
│                                                               │
│  GET /api/agents                                              │
│    → DB + last sync scores                                    │
│                                                               │
│  GET /api/agents/:id/calls                                    │
│    → DB calls (sourced from call-logs ingest)                 │
│                                                               │
│  GET /api/calls/:id                                           │
│    → DB evaluation OR GET /call-logs/:id (optional refresh)   │
│                                                               │
│  GET /api/agents/:id/recommendations                          │
│    → LLM rollup on failed KPIs from ingested calls            │
└─────────────────────────────────────────────────────────────┘
```

### KPI sources from GHL data

From agent `actions` and `extractedData`:

| KPI | Source |
|-----|--------|
| Name captured | `extractedData.name` + transcript LLM check |
| Email captured | `extractedData.email` |
| Issue / reason captured | `extractedData.otherDetails` |
| Script followed | Compare transcript to `agentPrompt` flow |
| Use Actions | `transcriptWithToolCalls` segments where agent repeated or caller dropped |

---

## Copy-paste test script

Save as `scripts/test-ghl-api.sh` and run: `source .env && bash scripts/test-ghl-api.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${GHL_API_TOKEN:?Set GHL_API_TOKEN}"
: "${GHL_LOCATION_ID:?Set GHL_LOCATION_ID}"
: "${GHL_AGENT_ID:?Set GHL_AGENT_ID}"

BASE="${GHL_API_BASE:-https://services.leadconnectorhq.com}"
TZ="${GHL_TIMEZONE:-Asia/Kolkata}"
HDR=(-H "Authorization: Bearer ${GHL_API_TOKEN}" -H "Version: 2021-07-28" -H "Accept: application/json")

echo "=== Location ==="
curl -s "${BASE}/locations/${GHL_LOCATION_ID}" "${HDR[@]}" | python3 -m json.tool | head -15

echo "=== Agents (total) ==="
curl -s "${BASE}/voice-ai/agents?locationId=${GHL_LOCATION_ID}&page=1&pageSize=10" "${HDR[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('total:', d.get('total')); [print('-', a['agentName'], a['id']) for a in d.get('agents',[])]"

echo "=== Call logs (total) ==="
curl -s "${BASE}/voice-ai/dashboard/call-logs?locationId=${GHL_LOCATION_ID}&agentId=${GHL_AGENT_ID}&timezone=${TZ}&page=1&pageSize=10" "${HDR[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('total:', d.get('total')); [print('-', c['id'], c['duration'],'s', c['extractedData']) for c in d.get('callLogs',[])]"
```

---

## Functional vs mocked (for README)

| Component | Status |
|-----------|--------|
| Location API | Real |
| Agents API | Real |
| Call logs + transcripts | Real |
| KPI LLM evaluation | Real (OpenAI or Gemini via `LLM_PROVIDER`) |
| Recommendations | Real LLM (cached; `?refresh=true` to regenerate) |
| Webhooks | Stub — optional `POST /api/webhooks/ghl/call-completed?sync=true` |
| Auto sync | **Per-agent schedule** (60s tick; Settings → Agents) |
| Marketplace iframe | **Implemented** — see [GHL_SETUP.md](GHL_SETUP.md) |

---

## Official docs

- [Voice AI API](https://marketplace.gohighlevel.com/docs/ghl/voice-ai/voice-ai-api/index.html)
- [List Call Logs](https://marketplace.gohighlevel.com/docs/ghl/voice-ai/get-call-logs/)
- [Get Call Log](https://marketplace.gohighlevel.com/docs/ghl/voice-ai/get-call-log/)
- [Private Integrations](https://help.gohighlevel.com/support/solutions/articles/155000003054-private-integrations-everything-you-need-to-know)
- Project build plan: [BUILD_PLAN.md](../BUILD_PLAN.md)
