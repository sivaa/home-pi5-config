# Data Scraper Service

> **Purpose:** On-demand fetching of Berlin public transport departures (Bus + S-Bahn)
> **Runtime:** Docker container (Python 3.11 + Playwright + Chromium)
> **Port:** 8890

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                DATA SCRAPER SERVICE (Activity-Based)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STATE: IDLE (no dashboard viewing)                                         │
│  ┌─────────────────────────────────────────────┐                           │
│  │  HTTP Server only (no browser)              │  ← 0 MB for Chromium      │
│  │  RAM: ~50MB total                           │                           │
│  └─────────────────────────────────────────────┘                           │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  STATE: ACTIVE (dashboard open, user viewing transport)                     │
│                                                                             │
│  GET /api/transport (first request)                                        │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                           │
│  │  Launch Chromium (~15s one-time)            │                           │
│  │  RAM: ~200MB                                │                           │
│  │  Start 5-min inactivity timer               │                           │
│  └─────────────────────────────────────────────┘                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                                │
│  │  Context: BVG   │    │  Context: DB    │    ← Parallel scrape          │
│  │  (bus departures│    │  (S-Bahn deps)  │                                │
│  └────────┬────────┘    └────────┬────────┘                                │
│           └──────────┬───────────┘                                          │
│                      ▼                                                      │
│              { bus: [...], sbahn: [...] }                                   │
│                                                                             │
│  Subsequent requests: Browser warm → ~5s response                          │
│  Each request resets 5-min timer                                           │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  After 5 min with no requests:                                             │
│  ┌─────────────────────────────────────────────┐                           │
│  │  Auto-shutdown browser                      │                           │
│  │  Return to IDLE state (0 MB Chromium)       │                           │
│  └─────────────────────────────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Web Scraping Instead of REST APIs?

> **Non-Negotiable Requirement (Documented Jan 2026)**
>
> REST APIs (`v6.bvg.transport.rest`, `v6.vbb.transport.rest`) were evaluated
> and rejected due to reliability issues:
> - Frequent outages and timeouts
> - Inconsistent data availability
> - User manually verified unreliability
>
> Web scraping from official websites is the **only acceptable approach**.
> This decision is final and documented for future reference.

---

## URLs Scraped

| Transport | URL | JS Required |
|-----------|-----|-------------|
| **Bus** | `https://www.bvg.de/de/verbindungen/verbindungssuche#!P|SQ!qrCode|bvg&100050&BVG&` | YES (iframe) |
| **S-Bahn** | `https://www.bahnhof.de/en/berlin-zehlendorf/departure?transport=s-bahn` | YES (Next.js) |

The BVG URL format is the same as scanning QR codes at bus stops.

---

## API Endpoints

### GET /api/transport

Scrapes both Bus and S-Bahn departures in parallel.

**Response:**
```json
{
  "sbahn": [
    {
      "line": "S1",
      "direction": "Wannsee",
      "minutes": 5,
      "time": "22:30",
      "delay": 0,
      "platform": "1"
    }
  ],
  "bus": [
    {
      "line": "285",
      "direction": "Waldfriedhof Dahlem",
      "minutes": 17,
      "time": "22:46",
      "delay": 0,
      "platform": null
    }
  ],
  "updated": "22:28",
  "error": null,
  "fallback": {
    "sbahn": "https://www.bahnhof.de/en/berlin-zehlendorf/departure?transport=s-bahn",
    "bus": "https://www.bvg.de/de/verbindungen/echtzeit-abfahrten"
  }
}
```

### GET /api/health

Health check endpoint. Does NOT start the browser.

**Response:**
```json
{
  "status": "ok",
  "browser_active": false
}
```

---

## Configuration

**Hardcoded Values in scraper.py:**

| Variable | Description | Current Value |
|----------|-------------|---------------|
| `BUS_URL` | BVG departures page (QR code format) | `...#!P|SQ!qrCode|bvg&100050&BVG&` |
| `SBAHN_URL` | bahnhof.de departures page | `berlin-zehlendorf/departure?transport=s-bahn` |
| `ALLOWED_BUS_LINES` | Bus lines to show | `["X10", "285"]` |
| `WRONG_DIRECTIONS` | Bus directions to filter out | `["teltow", "stahnsdorf", ...]` |
| `WRONG_SBAHN_DIRECTIONS` | S-Bahn directions to filter out | `["wannsee"]` |
| `INACTIVITY_TIMEOUT` | Browser shutdown delay | `5 * 60` (5 minutes) |
| `CACHE_TTL` | Response cache duration | `30` seconds |

---

## Activity-Based Browser Lifecycle

```
┌───────────────────────────────────────────────────────────────────────────┐
│  REQUEST TIMELINE                                                         │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Dashboard inactive (hours)                                               │
│  ─────────────────────────                                                │
│  • No browser running                                                     │
│  • 0 MB RAM for Chromium                                                  │
│  • Container uses ~50MB total                                             │
│                                                                           │
│  First request comes in  ──────────────────────────────┐                  │
│  ─────────────────────────                             │                  │
│  • Launch Chromium (~15s)                              │                  │
│  • Scrape BVG + bahnhof.de in parallel                 ├── ~15-20s        │
│  • Return response                                     │                  │
│  • Start 5-min shutdown timer                          │                  │
│                                                        │                  │
│  Second request (within 5 min) ────────────────────────┘                  │
│  ───────────────────────────────                                          │
│  • Browser already warm                                                   │
│  • Check cache (30s TTL)                                                  │
│  • If cached: instant response                                            │
│  • If stale: scrape (~5s)                                                 │
│  • Reset 5-min timer                                                      │
│                                                                           │
│  No requests for 5 minutes                                                │
│  ───────────────────────────                                              │
│  • Timer fires                                                            │
│  • Shutdown browser                                                       │
│  • Release ~200MB RAM                                                     │
│  • Back to idle state                                                     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Benefits

| Metric | Before | After (Idle) | After (Active) |
|--------|--------|--------------|----------------|
| RAM Usage | ~300MB always | **~50MB** | ~200MB when viewing |
| First Request | 30-40s | ~15s (browser launch) | ~5s (browser warm) |
| Container Start | 30-40s | **Instant** | - |
| S-Bahn Data | Link only | **Live departures** | Live departures |

---

## Docker Requirements

The Dockerfile installs:
- Python 3.11 (slim-bookworm for ARM64 compatibility)
- Playwright with Chromium browser
- System libraries for headless Chrome

**docker-compose.yml settings:**
```yaml
services:
  data-scraper:
    build: .
    container_name: data-scraper
    restart: unless-stopped
    ports:
      - "8890:8890"
    environment:
      - PORT=8890
      - TZ=Europe/Berlin
    shm_size: '256mb'      # Required for Chromium
    security_opt:
      - seccomp:unconfined  # Required for headless Chrome
```

---

## Files

```
services/data-scraper/
├── CLAUDE.md           <- This file
├── Dockerfile          <- Python 3.11 + Playwright + Chromium
├── docker-compose.yml  <- Standalone compose file
├── requirements.txt    <- playwright>=1.40.0
└── scraper.py          <- Main script (HTTP server + Playwright scraping)
```

---

## How the Scraper Works

### Bus (BVG)

1. **Navigate** to BVG departures page with stop ID in URL fragment
2. **Wait** 8 seconds for JavaScript to load iframe content
3. **Dismiss** popup if present ("Alles klar" button)
4. **Find** the iframe containing departure data
5. **Locate** list items within `[role="tabpanel"]`
6. **Parse** each departure:
   - Time from `<time>` element (e.g., "21:46 Uhr +3 Minuten")
   - Line number and direction from button text
7. **Filter** for allowed lines and directions
8. **Return** up to 6 departures

### S-Bahn (bahnhof.de)

1. **Navigate** to bahnhof.de departures page
2. **Wait** for Next.js hydration (~3s)
3. **Accept** cookies if dialog appears
4. **Parse** departure rows using multiple selector strategies
5. **Extract** line (S1, S7, etc.), time, direction, platform
6. **Fallback** to regex text extraction if structured parsing fails
7. **Deduplicate** and sort by departure time
8. **Return** up to 6 departures

---

## Deployment

**On Pi:**
```bash
cd /opt/data-scraper
docker compose build
docker compose up -d
```

**Rebuild after changes:**
```bash
ssh pi@pi "cd /opt/data-scraper && docker compose down && docker compose build --no-cache && docker compose up -d"
```

**Quick deploy from local:**
```bash
scp services/data-scraper/scraper.py pi@pi:/opt/data-scraper/
ssh pi@pi "cd /opt/data-scraper && docker compose down && docker compose build && docker compose up -d"
```

---

## Troubleshooting

### Scraper Returns Empty Data

1. Check container logs:
   ```bash
   docker logs data-scraper --tail 50
   ```

2. Look for:
   - "Launching browser" - first request or after idle
   - "[BUS] Navigating to BVG" - bus scrape started
   - "[S-BAHN] Navigating to bahnhof.de" - S-Bahn scrape started
   - "OK: X S-Bahn, X bus" - successful scrape

3. Common issues:
   - **Timeout on tabpanel**: BVG page structure changed, update selectors
   - **No S-Bahn data**: bahnhof.de structure changed, check regex patterns
   - **0 departures after filter**: All buses filtered out by direction

### Browser Not Shutting Down

Check if requests are still coming:
```bash
docker logs data-scraper --tail 20 | grep -E "Fetch|Launching|shutdown"
```

Browser stays alive as long as requests come within 5-minute window.

### High Memory Usage

```bash
docker stats data-scraper --no-stream
```

Expected: ~50MB idle, ~200-250MB when browser active.

### Testing Locally

```bash
cd services/data-scraper
pip install playwright
playwright install chromium

python3 -c "
import asyncio
from scraper import fetch_transport_async

async def test():
    result = await fetch_transport_async()
    print(f'S-Bahn: {len(result[\"sbahn\"])} departures')
    print(f'Bus: {len(result[\"bus\"])} departures')
    for dep in result['sbahn']:
        print(f'  {dep[\"line\"]} → {dep[\"direction\"]} in {dep[\"minutes\"]} min')
    for dep in result['bus']:
        print(f'  {dep[\"line\"]} → {dep[\"direction\"]} in {dep[\"minutes\"]} min')

asyncio.run(test())
"
```

---

## Fallback URLs

When scraper fails, response includes fallback URLs for manual checking:

| Type | URL |
|------|-----|
| S-Bahn | https://www.bahnhof.de/en/berlin-zehlendorf/departure?transport=s-bahn |
| Bus | https://www.bvg.de/de/verbindungen/echtzeit-abfahrten |

---

## Time Calculation Logic

The scraper calculates "minutes until departure" considering delays:

```
┌─────────────────────────────────────────────────────────────────┐
│  TIME CALCULATION                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Scheduled: 12:35    Delay: +5 min    Now: 12:37               │
│                                                                 │
│  actual_dep_time = 12:35 + 5 = 12:40                           │
│  minutes = (12:40 - 12:37) = 3 min  ✓                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Edge case: Scheduled time is past, but with delay is future   │
│                                                                 │
│  OLD BUG: 12:35 < 12:37 → wrap to next day → 1443 min  ✗       │
│  FIXED:   12:40 > 12:37 → show 3 min  ✓                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Skip departures that already left (within last hour)          │
│  Only wrap to next day for late-night schedules (23:xx → 00:xx)│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## History

- **Jan 12, 2026**: Fixed time calculation bug - scheduled times in past with delays showing ~1440 min instead of correct minutes
- **Jan 12, 2026**: Added S-Bahn direction filtering (Wannsee blacklist), fixed direction extraction from bahnhof.de
- **Jan 2026**: Major refactor - activity-based browser lifecycle, added S-Bahn scraping from bahnhof.de, parallel scraping
- **Jan 2026**: Switched from REST API to Playwright web scraping due to API reliability issues
- **Original**: Used `v6.bvg.transport.rest` REST API (deprecated, unreliable)
