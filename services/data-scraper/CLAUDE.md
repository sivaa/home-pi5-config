# Data Scraper Service

> **Purpose:** On-demand fetching of Berlin public transport departures (Bus + S-Bahn)
> **Runtime:** Docker container (Python 3.11 + Playwright + Chromium)
> **Port:** 8890

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                DATA SCRAPER SERVICE (Launch → Scrape → Kill)                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EVERY REQUEST:                                                             │
│                                                                             │
│  GET /api/transport                                                         │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                           │
│  │  1. Check cache (60s TTL)                   │                           │
│  │     └── If hit: return cached, skip browser │                           │
│  └─────────────────────────────────────────────┘                           │
│       │ (cache miss)                                                        │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────┐                           │
│  │  2. Launch Chromium (~10-15s)               │                           │
│  │     RAM: ~200MB temporarily                 │                           │
│  └─────────────────────────────────────────────┘                           │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                                │
│  │  Context: BVG   │    │  Context: DB    │    ← Parallel scrape          │
│  │  (bus departures│    │  (S-Bahn deps)  │                                │
│  └────────┬────────┘    └────────┬────────┘                                │
│           └──────────┬───────────┘                                          │
│                      ▼                                                      │
│  ┌─────────────────────────────────────────────┐                           │
│  │  3. KILL browser immediately                │  ← No warm browser!       │
│  │     Write timestamp to /tmp/scraper-last-activity                       │
│  │     RAM: back to ~50MB                      │                           │
│  └─────────────────────────────────────────────┘                           │
│       │                                                                     │
│       ▼                                                                     │
│              { bus: [...], sbahn: [...] }                                   │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  CONTAINER LIFECYCLE (managed by scraper-cleanup service):                  │
│                                                                             │
│  ┌─────────────────────────────────────────────┐                           │
│  │  Every 5 min: Check /tmp/scraper-last-activity                          │
│  │  └── If > 30 min old: docker stop data-scraper                          │
│  └─────────────────────────────────────────────┘                           │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  AUTO-RESTART (via dashboard + Home Assistant):                             │
│                                                                             │
│  ┌─────────────────────────────────────────────┐                           │
│  │  Dashboard fetch fails → Call HA shell_command                          │
│  │  └── docker start data-scraper                                          │
│  │  Wait 20s → Retry fetch                     │                           │
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
      "platform": "1",
      "cancelled": false
    }
  ],
  "bus": [
    {
      "line": "285",
      "direction": "Waldfriedhof Dahlem",
      "minutes": 17,
      "time": "22:46",
      "delay": 0,
      "platform": null,
      "cancelled": false
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

### Cancelled Trip Detection

The scraper detects cancelled trips from bahnhof.de:

```
┌─────────────────────────────────────────────────────────────────┐
│  CANCELLED TRIP DETECTION                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Regex Pattern (case-insensitive):                              │
│  /(?:trip\s+)?cancell?ed|fällt\s+aus|ausfall/                   │
│                                                                 │
│  Matches:                                                       │
│  • "Trip cancelled" (English)                                   │
│  • "cancelled" (English)                                        │
│  • "canceled" (US spelling)                                     │
│  • "fällt aus" (German)                                         │
│  • "Ausfall" (German)                                           │
│                                                                 │
│  When detected:                                                 │
│  • Sets cancelled: true in departure object                     │
│  • Departure still included (for display purposes)              │
│  • Dashboard shows "✕ Trip cancelled" with styling              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
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
| `CACHE_TTL` | Response cache duration | `60` seconds |
| `ACTIVITY_FILE` | Timestamp file for cleanup service | `/tmp/scraper-last-activity` |

---

## Launch → Scrape → Kill Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│  REQUEST TIMELINE                                                         │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Dashboard requests transport data (every 60s)                            │
│  ─────────────────────────────────────────────                            │
│                                                                           │
│  t=0s   Request arrives                                                   │
│         └── Check cache (60s TTL)                                         │
│             └── If HIT: Return instantly, done                            │
│             └── If MISS: Continue to scrape                               │
│                                                                           │
│  t=0s   Launch Chromium                                                   │
│         └── Fresh browser every time                                      │
│         └── ~10-15s startup on ARM64                                      │
│                                                                           │
│  t=15s  Scrape BVG + bahnhof.de in parallel                               │
│         └── Both sites in separate browser contexts                       │
│         └── ~5-10s scraping                                               │
│                                                                           │
│  t=25s  KILL browser immediately                                          │
│         └── playwright.stop()                                             │
│         └── RAM back to ~50MB                                             │
│         └── Write timestamp to /tmp/scraper-last-activity                 │
│                                                                           │
│  t=25s  Return JSON response                                              │
│         └── Cached for 60s                                                │
│         └── Next request hits cache, skips browser                        │
│                                                                           │
│  Result: ~80% CPU for 25s, then 0% until next request                     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Why Not Keep Browser Warm?

The previous architecture kept the browser warm with a 5-minute inactivity timer. This had a bug:

```
┌───────────────────────────────────────────────────────────────────────────┐
│  THE BUG (Fixed Jan 2026)                                                 │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Dashboard requests every 60s                                             │
│  Timer was 5 minutes (300s)                                               │
│  BUT: Each request RESET the timer                                        │
│                                                                           │
│  t=0s:    Request → Start 5-min timer                                     │
│  t=60s:   Request → CANCEL timer, restart 5-min timer                     │
│  t=120s:  Request → CANCEL timer, restart 5-min timer                     │
│  ...forever...                                                            │
│                                                                           │
│  Result: Timer NEVER fires → Browser NEVER shuts down → 83% CPU forever   │
│                                                                           │
│  Fix: Remove warm browser concept. Launch → Scrape → Kill every time.     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Benefits

| Metric | Before (Bug) | After |
|--------|--------------|-------|
| CPU (viewing) | 83% constant | ~80% for 25s, then 0% |
| CPU (average) | 83% | ~40-50% |
| Temperature | 59°C | ~50-55°C |
| Fan | 2,920 RPM constant | ~2,000 RPM or off |
| RAM (between requests) | ~250MB | ~50MB |

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

### Container Stopped (Auto-Restart)

If container was stopped by cleanup service after 30 min inactivity:
1. Dashboard will show "Starting transport service..."
2. It auto-restarts via Home Assistant shell_command
3. Wait ~20s for browser to launch and scrape
4. Data will appear automatically

**How Auto-Restart Works:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AUTO-RESTART FLOW                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Dashboard (transport-store.js)                                             │
│       │                                                                     │
│       ▼  fetch fails (container stopped)                                    │
│  triggerContainerRestart()                                                  │
│       │                                                                     │
│       ▼  POST /api/services/shell_command/start_data_scraper                │
│  Home Assistant                                                             │
│       │  (with Bearer token auth)                                           │
│       ▼                                                                     │
│  shell_command: curl → Docker socket API                                    │
│       │  POST /v1.44/containers/data-scraper/start                          │
│       ▼                                                                     │
│  Container starts                                                           │
│       │                                                                     │
│       ▼  (20s delay)                                                        │
│  Dashboard retries fetch → Success                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Requirements for HA Auto-Restart:**
1. HA container must have Docker socket mounted (`-v /var/run/docker.sock:/var/run/docker.sock`)
2. HA must use host network (`--network host`) for localhost:8123 access
3. Dashboard needs HA long-lived access token in `haToken` property
4. shell_command uses `curl` (not `docker` CLI - not in HA image)

Manual restart:
```bash
ssh pi@pi "docker start data-scraper"
```

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

- **Jan 16, 2026**: **Major fix** - Launch→Scrape→Kill architecture
  - Root cause: Timer reset bug kept browser warm forever (83% CPU)
  - Fix: Kill browser immediately after each scrape, no warm browser
  - Added: Activity timestamp for cleanup service (/tmp/scraper-last-activity)
  - Added: Cache TTL increased to 60s (matches request interval)
  - Result: CPU drops to 0% between requests, ~40-50% average
- **Jan 12, 2026**: Added cancelled trip detection with regex pattern (Trip cancelled/fällt aus/Ausfall)
- **Jan 12, 2026**: Fixed time calculation bug - scheduled times in past with delays showing ~1440 min instead of correct minutes
- **Jan 12, 2026**: Added S-Bahn direction filtering (Wannsee blacklist), fixed direction extraction from bahnhof.de
- **Jan 2026**: Major refactor - activity-based browser lifecycle, added S-Bahn scraping from bahnhof.de, parallel scraping
- **Jan 2026**: Switched from REST API to Playwright web scraping due to API reliability issues
- **Original**: Used `v6.bvg.transport.rest` REST API (deprecated, unreliable)
