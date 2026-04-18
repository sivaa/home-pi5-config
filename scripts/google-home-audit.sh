#!/bin/bash
#
# Google Home Integration Audit
# ==============================
# Compares HA's exposed entities against Google HomeGraph state to detect
# drift: entities HA pushes but Google rejects, stale entity_configs, or
# entities with no Google trait mapping.
#
# Usage:
#   ./scripts/google-home-audit.sh           # Full audit
#   ./scripts/google-home-audit.sh --quiet   # Only print drift summary
#
# Requires:
#   - SSH access as pi@pi
#   - HA_TOKEN in /opt/zigbee2mqtt/.env on Pi
#   - /opt/homeassistant/SERVICE_ACCOUNT.json on Pi (HomeGraph service account)
#   - Python venv at /tmp/homegraph-venv on Pi (auto-created on first run)
#
# What it checks:
#   1. HA REST API health for every entity with expose:true
#   2. HomeGraph state for every exposed entity (via devices:query)
#   3. Recent reportStateAndNotification errors in HA logs
#   4. cloudflared tunnel health
#
# Evidence-based: prints actual HTTP codes and counts, no assumptions.

set -u

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

log() { [[ $QUIET -eq 0 ]] && echo "$@"; }
err() { echo "$@" >&2; }

log "=== Google Home Integration Audit ==="
log ""

# -----------------------------------------------------------------------------
# Step 1: Ensure Python venv with google-auth + requests exists on the Pi
# -----------------------------------------------------------------------------
log "[1/4] Ensuring Python venv on Pi..."
ssh pi@pi '
  if [ ! -x /tmp/homegraph-venv/bin/python3 ]; then
    python3 -m venv /tmp/homegraph-venv
    /tmp/homegraph-venv/bin/pip install -q google-auth requests
  fi
' || { err "Failed to set up venv on Pi"; exit 1; }

# -----------------------------------------------------------------------------
# Step 2: Cloudflared tunnel
# -----------------------------------------------------------------------------
log ""
log "[2/4] cloudflared tunnel..."
TUNNEL=$(ssh pi@pi "sudo systemctl is-active cloudflared")
HTTPS_CODE=$(ssh pi@pi "curl -s -o /dev/null -w '%{http_code}' -I https://ha.sivaa.in")
log "  systemd:       $TUNNEL"
log "  ha.sivaa.in:   HTTP $HTTPS_CODE  (405 on HEAD = OK, webhook is POST-only)"

# -----------------------------------------------------------------------------
# Step 3: HA log scan for google_assistant errors in last 24h
# -----------------------------------------------------------------------------
log ""
log "[3/4] HA logs (last 24h)..."
ERR_COUNT=$(ssh pi@pi "docker logs homeassistant --since 24h 2>&1 | grep -c 'google_assistant.*ERROR' || true")
log "  google_assistant ERROR lines:  $ERR_COUNT"
if [[ $ERR_COUNT -gt 0 ]]; then
  log "  Recent samples:"
  ssh pi@pi "docker logs homeassistant --since 24h 2>&1 | grep 'google_assistant' | tail -3" | sed 's/^/    /'
fi

# -----------------------------------------------------------------------------
# Step 4: Per-entity drift check against HomeGraph
# -----------------------------------------------------------------------------
log ""
log "[4/4] HomeGraph per-entity query..."

ssh pi@pi "sudo /tmp/homegraph-venv/bin/python3 - <<'PYEOF'
import json, time, re, sys, requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

# Parse expose:true entities from the deployed configuration.yaml
cfg = open('/opt/homeassistant/configuration.yaml').read()
section = cfg.split('entity_config:', 1)[1].split('\n# ====', 1)[0]
exposed = []
cur = None
expose_val = None
for line in section.splitlines():
    m = re.match(r'^    ([a-z_]+\.[a-z0-9_]+):\s*$', line)
    if m:
        if cur and expose_val == 'true':
            exposed.append(cur)
        cur = m.group(1); expose_val = None
        continue
    m = re.match(r'^      expose:\s*(\w+)', line)
    if m: expose_val = m.group(1)
if cur and expose_val == 'true':
    exposed.append(cur)

# Auth
creds = service_account.Credentials.from_service_account_file(
    '/opt/homeassistant/SERVICE_ACCOUNT.json',
    scopes=['https://www.googleapis.com/auth/homegraph'])
creds.refresh(Request())

# Read agentUserId from HA storage
ga = json.load(open('/opt/homeassistant/.storage/google_assistant'))
agent = list(ga['data']['agent_user_ids'].keys())[0]

# Read HA token
env = open('/opt/zigbee2mqtt/.env').read()
ha_token = re.search(r'HA_TOKEN=(\S+)', env).group(1)

missing_google, missing_ha, unavail = [], [], []
ok_count = 0
for eid in exposed:
    # HA side
    hr = requests.get(f'http://localhost:8123/api/states/{eid}',
                      headers={'Authorization': f'Bearer {ha_token}'}, timeout=10)
    if hr.status_code == 404:
        missing_ha.append(eid)
        continue
    elif hr.status_code == 200 and hr.json().get('state') in ('unavailable', 'unknown'):
        unavail.append(eid)
    # Google side
    gr = requests.post(
        'https://homegraph.googleapis.com/v1/devices:query',
        headers={'Authorization': f'Bearer {creds.token}'},
        json={'requestId': str(int(time.time()*1000)), 'agentUserId': agent,
              'inputs': [{'payload': {'devices': [{'id': eid}]}}]}, timeout=10)
    if gr.status_code != 200:
        missing_google.append(eid)
    else:
        ok_count += 1

print(f'  Exposed in HA:           {len(exposed)}')
print(f'  OK in both HA + Google:  {ok_count}')
print(f'  Unavailable in HA:       {len(unavail)}  (usually wall-switched)')
print(f'  Missing from HA (stale): {len(missing_ha)}')
print(f'  Missing from HomeGraph:  {len(missing_google)}')

if missing_ha or missing_google:
    print()
    print('  DRIFT DETECTED:')
    for e in missing_ha:
        print(f'    [stale]      {e}  - remove from configuration.yaml entity_config')
    for e in missing_google:
        print(f'    [no trait]   {e}  - set expose:false (see CLAUDE.md trait table)')
    sys.exit(2)

if unavail:
    print()
    print('  Unavailable HA entities (expected if wall-switched):')
    for e in unavail: print(f'    {e}')

PYEOF"
RC=$?

log ""
if [[ $RC -eq 0 ]]; then
  log "=== Audit clean. No drift. ==="
elif [[ $RC -eq 2 ]]; then
  err ""
  err "=== Audit found drift. See output above for fixes. ==="
  exit 2
else
  err "=== Audit failed to complete (rc=$RC). ==="
  exit $RC
fi
