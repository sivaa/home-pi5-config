#!/bin/bash
# OnFailure notifier for zigbee-ghost-sweep.service.
# Called by systemd when the main ghost-sweep unit exits non-zero.
# POSTs a CRITICAL email via HA's script.send_alert_email. If HA itself is
# down or unreachable, this script fails silently — the systemd journal
# still records the original failure.

set -euo pipefail

HA_TOKEN="${ZIGBEE_WATCHDOG_HA_TOKEN:-${HA_TOKEN:-}}"
HA_URL="${HA_URL:-http://localhost:8123}"

if [ -z "$HA_TOKEN" ]; then
    echo "ERROR: HA_TOKEN not set — cannot send failure email." >&2
    exit 1
fi

# Grab the last 20 lines of the failed unit for the email body. Keep the
# actual newlines — jq's `--arg` takes the value as an opaque string and
# emits a properly JSON-escaped string, so multi-line content is fine. The
# HTML email template renders `\n` → `<br>` on the `details` field, so
# newlines preserve visual structure in the inbox.
LAST_LOG=$(journalctl -u zigbee-ghost-sweep.service -n 20 --no-pager 2>/dev/null | tail -c 2000)

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Multi-line string with REAL newlines (not the literal \n sequences the
# previous version produced — bash double-quoted strings don't interpret
# backslash escapes).
DETAILS="Time: ${TIMESTAMP}
Last 20 journal lines:
${LAST_LOG}"

# jq builds the JSON so we don't fight with bash escaping
PAYLOAD=$(jq -n \
    --arg severity "CRITICAL" \
    --arg title "Ghost Sweep Service Failed" \
    --arg subtitle "zigbee-ghost-sweep.service exited with failure" \
    --arg description "The twice-daily Zigbee ghost-detection service exited non-zero. Until fixed, silent Z2M device removals (the class of bug this detects) will go unnoticed. Check the journal for the root cause." \
    --arg actions "ssh pi@pi 'sudo journalctl -u zigbee-ghost-sweep.service -n 50 --no-pager'|Fix the root cause shown in the logs|Manually retry: sudo systemctl start zigbee-ghost-sweep.service" \
    --arg details "$DETAILS" \
    --arg plain_text "Ghost sweep failed. Check systemctl status zigbee-ghost-sweep.service." \
    '{severity:$severity, title:$title, subtitle:$subtitle, description:$description, actions:$actions, details:$details, plain_text:$plain_text}')

curl -sf -X POST \
    -H "Authorization: Bearer ${HA_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" \
    "${HA_URL}/api/services/script/send_alert_email" \
    > /dev/null || {
    echo "ERROR: failed to POST failure notification to HA" >&2
    exit 2
}

echo "Failure notification sent for zigbee-ghost-sweep.service"
