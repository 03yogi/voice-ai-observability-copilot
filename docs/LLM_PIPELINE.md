# LLM Evaluation Pipeline

Consistent AI path for call evaluation and agent recommendations.

## Flow

```text
POST /api/sync
  1. Ingest agents + call logs from GHL
  2. For each call session → evaluateCallSession() via LLM
  3. For each agent → generateRecommendations() via LLM (cached)
```

## Provider selection

**Primary:** configure in the app under **AI Settings** (`/settings`) — stored in `llm_settings` (SQLite).

**Optional `.env` fallback** (for local dev without opening the UI):

```env
LLM_PROVIDER=openai   # or gemini
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

| Provider | Key | Default model |
|----------|-----|---------------|
| openai | OPENAI_API_KEY | gpt-4o-mini |
| gemini | GEMINI_API_KEY | gemini-2.0-flash |

**Evaluation:** one LLM call per call (`evaluate.js` → `llmCompleteJson()`), not a multi-stage extract/score/recommend pipeline. **Recommendations** are a separate agent-level LLM call (`recommendations.js`).

Implementation: `apps/api/src/llm/provider.js` — single `llmCompleteJson()` entry point; `schemas.js` normalizes JSON (not Zod).

## Per-call evaluation

**Input:** agent `agent_prompt`, call `transcript`, `summary`, `extractedData`, turns  
**Output:** `overallScore`, `kpiResults`, `deviations`, `useActions`, `evaluatedBy`

KPIs are derived from the agent instructions by the LLM — not hardcoded keys.

## Agent recommendations

**Input:** agent prompt + recent call evaluations/transcripts  
**Output:** 3–7 items with `examplePromptSnippet`  
**Cache:** `recommendations` table; refresh with `?refresh=true`

## Health check

```bash
curl http://localhost:3001/api/health/llm
```

## Files

```text
apps/api/src/llm/
  provider.js    # openai | gemini switch
  openai.js
  gemini.js
  prompts.js
  schemas.js     # normalize + validate JSON shape
  parse.js
apps/api/src/services/
  evaluate.js
  recommendations.js
  sync.js
```
