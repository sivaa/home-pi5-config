# Where Is Siva - Sailing Tracker

> **Purpose:** Real-time sailing tracker that polls a Garmin InReach KML feed, computes voyage statistics, and serves a dashboard API
> **Runtime:** Python 3 (FastAPI + Uvicorn), systemd service (not Docker)
> **Port:** 8000 (public, all interfaces)

---

## Why This Exists

Tracks a sailboat voyage (Ft. Lauderdale - Bermuda - Horta, Azores) using a Garmin InReach satellite communicator. The InReach publishes location data as a KML feed. This service:

1. Polls the Garmin KML feed on a schedule (default: every 5 minutes)
2. Parses track points and text messages from the KML
3. Stores everything in a local SQLite database
4. Computes voyage stats (distance, speed, ETA, daily distances)
5. Serves a JSON API for the kiosk dashboard's Sailing view
6. Optionally pushes `data.json` to a separate GitHub repo for a public Vercel site

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHERE IS SIVA - DATA FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Garmin InReach ──► KML Feed ──► poll_garmin_feed() ──► SQLite DB          │
│       (satellite)       (HTTP)     (every 5 min)         (tracker.db)       │
│                                                                             │
│  SQLite DB ──► compute_voyage_stats() ──► /api/all ──► Kiosk Dashboard     │
│                                      ──► data.json ──► git push ──► Vercel │
│                                                                             │
│  For testing without real Garmin:                                           │
│  fake-garmin.py ──► localhost:9000/feed.kml ──► tracker polls this instead  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/all` | GET | Full dashboard payload (stats + track + messages + waypoints + route) |
| `/api/status` | GET | Voyage stats only (position, speed, ETA, progress) |
| `/health` | GET | Health check (track point count, config status) |
| `/` | GET | Static HTML dashboard (index.html) |
| `/static/*` | GET | Static files (data.json, etc.) |

---

## Key Files

```
services/where-is-siva/
├── CLAUDE.md              <- This file
├── requirements.txt       <- Python dependencies (FastAPI, uvicorn, httpx, etc.)
├── deploy.sh              <- Deployment script (rsync to Pi + systemd setup)
├── fake-garmin.py         <- Simulated KML feed for end-to-end testing
├── backend/
│   ├── main.py            <- FastAPI app, scheduler, Garmin polling, data export
│   ├── config.py          <- Environment-based configuration
│   ├── database.py        <- SQLite via aiosqlite (track points + messages)
│   ├── tracker.py         <- Geodesic calculations and voyage statistics
│   ├── kml_parser.py      <- Garmin KML parsing (track points + text messages)
│   ├── git_sync.py        <- Push data.json to public GitHub repo for Vercel
│   └── mock.py            <- Mock data generator for testing
├── static/
│   ├── index.html         <- Standalone tracker dashboard
│   └── data.json          <- Exported dashboard state (generated, not committed)
└── data/
    └── tracker.db         <- SQLite database (generated, not committed)
```

---

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `GARMIN_FEED_URL` | (empty) | Garmin MapShare KML feed URL. Empty = no polling |
| `POLL_INTERVAL_SECONDS` | `300` | How often to poll the KML feed |
| `DB_PATH` | `data/tracker.db` | SQLite database path |
| `STATIC_DIR` | `static` | Directory for static files and data.json |
| `USE_MOCK_DATA` | `false` | Load simulated data on startup (for testing) |
| `GIT_PUSH_ENABLED` | `false` | Push data.json to a separate GitHub repo |
| `GIT_PUSH_INTERVAL_SECONDS` | `600` | How often to push (if enabled) |
| `GIT_REPO_PATH` | `/opt/where-is-siva/public-repo` | Path to cloned public site repo |

Secrets and config are loaded from `/opt/where-is-siva/.env` (not committed to git).

---

## Deployment

**Systemd service** (not Docker). Uses `deploy.sh` for automated deployment.

```bash
# From pi-setup root on the Pi:
./services/where-is-siva/deploy.sh
```

The deploy script:
1. Copies backend/, static/, fake-garmin.py, requirements.txt to `/opt/where-is-siva/`
2. Creates venv and installs dependencies (first time)
3. Installs both systemd services (where-is-siva + fake-garmin)
4. Enables and restarts the tracker service
5. fake-garmin is installed but NOT auto-started (manual start for testing)

**Systemd service files:**

| Service | File | Auto-start | Description |
|---------|------|------------|-------------|
| `where-is-siva` | `configs/systemd/where-is-siva.service` | Yes (enabled) | Main tracker, polls Garmin feed |
| `fake-garmin` | `configs/systemd/fake-garmin.service` | No (manual) | Test KML feed simulator on port 9000 |

**Commands:**
```bash
# Check tracker status
sudo systemctl status where-is-siva

# View logs
sudo journalctl -u where-is-siva -f

# Start fake Garmin feed for testing
sudo systemctl start fake-garmin
```

---

## Fake Garmin Feed (Testing)

`fake-garmin.py` simulates a sailboat voyage for end-to-end testing without a real Garmin InReach device.

- Simulates route: Ft. Lauderdale - Bermuda - Horta, Azores
- Default speed: 60x (1 real minute = 1 simulated hour)
- Serves a KML feed at `http://localhost:9000/feed.kml`
- Supports injecting check-in messages via `POST /message`

**Usage:**
```bash
# Start the simulator
sudo systemctl start fake-garmin

# Point the tracker at it (edit .env or service file)
GARMIN_FEED_URL=http://localhost:9000/feed.kml
```

---

## Systemd Watchdog

The tracker integrates with systemd's watchdog mechanism:
- Service type: `notify` (sends `READY=1` on startup)
- `WatchdogSec=120` - service must ping within 120s or gets killed + restarted
- Watchdog pings every 30s (4x safety margin)

---

## Security Hardening

The systemd service uses:
- `NoNewPrivileges=true`
- `PrivateTmp=true`
- `ProtectSystem=strict`
- `ReadWritePaths` limited to data, static, and public-repo directories

---

## Related Services

| Service | Relationship |
|---------|--------------|
| Kiosk Dashboard | Sailing view fetches from `/api/all` |
| Public Vercel Site | Receives `data.json` via git push |
