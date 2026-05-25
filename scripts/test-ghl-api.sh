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

echo ""
echo "=== Agents ==="
curl -s "${BASE}/voice-ai/agents?locationId=${GHL_LOCATION_ID}&page=1&pageSize=10" "${HDR[@]}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('total:', d.get('total'))
for a in d.get('agents', []):
    print(f\"  - {a['agentName']} ({a['id']})\")
"

echo ""
echo "=== Call logs ==="
curl -s "${BASE}/voice-ai/dashboard/call-logs?locationId=${GHL_LOCATION_ID}&agentId=${GHL_AGENT_ID}&timezone=${TZ}&page=1&pageSize=10" "${HDR[@]}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('total:', d.get('total'))
for c in d.get('callLogs', []):
    ext = c.get('extractedData', {})
    print(f\"  - {c['id']} | {c['duration']}s | extracted={ext}\")
"
