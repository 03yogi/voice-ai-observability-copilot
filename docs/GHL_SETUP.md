# HighLevel marketplace setup

This guide explains how to embed **Voice AI Observability Copilot** inside a HighLevel sub-account via a marketplace app Custom Menu Link.

## Prerequisites

- Deployed app URL (or ngrok tunnel for local demo)
- GHL developer account + marketplace app
- Sub-account with Voice AI agents (e.g. **Voice AI Copilot Test**)
- Private integration token or location JWT with Voice AI scopes

See [GHL_API.md](GHL_API.md) for API verification curls.

## 1. Deploy the app (single URL)

Production mode serves the Vue dashboard and API from one port:

```bash
npm install
npm run build
APP_URL=https://your-app.example.com PORT=3001 npm run start
```

Or use the convenience script:

```bash
APP_URL=https://your-app.example.com npm run start:prod
```

Set `APP_URL` to the public HTTPS URL GHL will iframe. The API logs the suggested iframe URL on startup.

**Local demo with ngrok:**

```bash
npm run start:prod
ngrok http 3001
# Set APP_URL to the ngrok HTTPS URL and restart
```

## 2. Create a marketplace app

1. Go to [HighLevel Marketplace](https://marketplace.gohighlevel.com/) → **My Apps** → **Create App**
2. App type: **Custom Menu Link** (iframe embed)
3. Name: **Voice AI Observability Copilot**
4. **Iframe URL:**

   ```text
   https://YOUR_APP_URL/?location_id={{location.id}}
   ```

   GHL replaces `{{location.id}}` with the active sub-account location ID.

5. Required scopes (minimum):
   - Voice AI — read agents, call logs, transcripts
   - Locations — read (for discover/test)

6. Save and **Install** into your test sub-account.

## 3. Configure inside the iframe

After opening the custom menu in GHL:

1. **Agents** — add Voice AI agents to monitor; paste the location JWT + location ID (pre-filled from URL when embedded)
2. **AI Settings** — choose OpenAI or Gemini and API key
3. **Overview** — click **Sync from HighLevel** to ingest and LLM-evaluate calls

Credentials are stored in SQLite on your server — not in the browser long-term beyond the settings forms.

## 4. Verify embed headers

The API sets `Content-Security-Policy: frame-ancestors` for:

- `https://app.gohighlevel.com`
- `https://*.gohighlevel.com`
- `https://*.leadconnectorhq.com`

Check embed metadata:

```bash
curl -s http://localhost:3001/api/embed/info | jq
```

## 5. Optional webhook (future auto-sync)

A stub endpoint accepts GHL call-completed payloads:

```http
POST /api/webhooks/ghl/call-completed?sync=true
Content-Type: application/json

{ "callId": "...", "agentId": "...", "locationId": "..." }
```

With `?sync=true`, triggers a full sync after logging the payload. Wire this in GHL when Voice AI webhooks are available.

## Demo checklist

| Step | Action |
|------|--------|
| 1 | Open GHL sub-account → custom menu **Observability Copilot** |
| 2 | Confirm green **Embedded in GHL** badge + location ID banner |
| 3 | Sync → overview shows agents and scores |
| 4 | Drill into worst call → KPI failures + Use Actions |
| 5 | Insights → copy AI recommendations |

## Sandbox reference

| Field | Value |
|-------|-------|
| Location ID | `UmiW3ZZUkaJLNkY5kEuk` |
| Agent | Demo Booking Agent (`6a11f0b5066e920e0c6cc344`) |
| Sample calls | `6a11f28602747d3f6bc47070`, `6a11f25152fdebe1308566ee` |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank iframe | Ensure HTTPS public URL; check browser console for CSP errors |
| API 404 in iframe | Use `npm run start:prod` so UI and `/api` share one origin |
| No agents on discover | Verify JWT scopes and location ID match the sub-account |
| LLM errors | Configure provider + API key under **AI Settings** |
