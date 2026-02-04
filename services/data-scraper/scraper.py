#!/usr/bin/env python3
"""
Transport Scraper - On-demand Playwright scraping for BVG Bus and DB S-Bahn

Architecture: Launch → Scrape → Kill
- Browser launches fresh for each request
- Browser is killed immediately after scraping completes
- Zero CPU usage between requests
- Activity timestamp written for cleanup service monitoring

Why this architecture?
- Previous "warm browser" approach had a bug: 5-min timeout never triggered
  because dashboard requests every 60s reset the timer.
- Result: Browser stayed warm forever → 83% CPU → 59°C → loud fan
- New approach: No warm browser. Launch, scrape, kill. ~40-50% avg CPU.

Why web scraping instead of REST APIs?
- REST APIs (v6.bvg.transport.rest, v6.vbb.transport.rest) are unreliable
- Frequent outages and inconsistent data availability
- User manually verified unreliability (Jan 2026)
- This is a non-negotiable requirement
"""

import asyncio
import json
import os
import re
import signal
import time
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler

from playwright.async_api import async_playwright

PORT = int(os.environ.get("PORT", 8890))

# ─────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────

# URLs to scrape
BUS_URL = "https://www.bvg.de/de/verbindungen/verbindungssuche#!P|SQ!qrCode|bvg&100050&BVG&"
SBAHN_URL = "https://www.bahnhof.de/en/berlin-zehlendorf/departure?transport=s-bahn"

# Fallback links (shown when scraping fails)
FALLBACK = {
    "sbahn": SBAHN_URL,
    "bus": "https://www.bvg.de/de/verbindungen/echtzeit-abfahrten"
}

# Filter settings for bus
ALLOWED_BUS_LINES = ["X10", "285"]
WRONG_DIRECTIONS = ["teltow", "stahnsdorf", "lankwitz", "andréezeile", "steglitz", "rathaus"]

# Filter settings for S-Bahn (directions to exclude)
WRONG_SBAHN_DIRECTIONS = ["wannsee"]

# Cancellation/strike detection pattern (shared by Bus + S-Bahn scrapers)
#
#   ┌───────────────────────────────────────────────────────────────┐
#   │  CANCELLATION KEYWORDS (German + English)                     │
#   │                                                               │
#   │  bestreikt .......... "on strike" (BVG strike days)           │
#   │  streik ............. "strike"                                │
#   │  cancelled/canceled . English (bahnhof.de uses English UI)    │
#   │  fällt aus .......... "is cancelled" (standard BVG/DB)        │
#   │  ausfall ............ "cancellation/failure"                  │
#   │  entfällt ........... "does not take place" (formal DB)       │
#   │  verkehrt nicht ..... "does not run" (DB disruption notices)  │
#   └───────────────────────────────────────────────────────────────┘
CANCELLATION_PATTERN = re.compile(
    r'bestreikt|streik|(?:trip\s+)?cancell?ed|fällt\s+aus|ausfall|entfällt|verkehrt\s+nicht',
    re.IGNORECASE
)

# Cache results for 60 seconds (matches dashboard refresh interval)
CACHE_TTL = 60

# Activity tracking for cleanup service
ACTIVITY_FILE = "/tmp/scraper-last-activity"

# ─────────────────────────────────────────────────────────────────
# BROWSER STATE (Launch → Scrape → Kill)
# ─────────────────────────────────────────────────────────────────

_playwright = None
_browser = None
_browser_lock = asyncio.Lock()
_event_loop = None

# Cache for scraped data
_cache = {
    "data": None,
    "timestamp": None
}


def log(msg):
    """Log with timestamp."""
    print(f"{datetime.now().isoformat()} {msg}", flush=True)


_process_start_time = time.time()

def update_activity():
    """Write activity timestamp ONCE for cleanup service.

    ┌──────────────────────────────────────────────────────────────┐
    │  WRITE-ONCE ACTIVITY STAMP                                   │
    │                                                              │
    │  OLD: Every request resets timestamp → container alive       │
    │       forever while dashboard polls every 60s                │
    │                                                              │
    │  NEW: Write only on FIRST request after startup              │
    │       → 30-min countdown starts from first use               │
    │       → container auto-stops regardless of polling           │
    │       → dashboard must explicitly restart via HA             │
    │                                                              │
    │  STALE FILE GUARD:                                           │
    │  If container crashes (not clean docker stop), cleanup       │
    │  never runs rm -f, so stale file persists on host /tmp.     │
    │  On restart, we'd skip writing → cleanup sees old stamp     │
    │  → immediate stop → restart loop!                           │
    │                                                              │
    │  Fix: Compare file stamp against process start time.        │
    │  If stamp predates this process, it's stale → overwrite.    │
    └──────────────────────────────────────────────────────────────┘
    """
    if os.path.exists(ACTIVITY_FILE):
        try:
            with open(ACTIVITY_FILE, 'r') as f:
                stamp = float(f.read().strip())
            if stamp >= _process_start_time:
                return  # Written by this session, don't reset countdown
            log(f"Stale activity file detected (age: {_process_start_time - stamp:.0f}s), overwriting")
        except (ValueError, IOError):
            log("Corrupt activity file, overwriting")
    try:
        with open(ACTIVITY_FILE, 'w') as f:
            f.write(str(time.time()))
    except Exception as e:
        log(f"Failed to write activity file: {e}")


def _get_event_loop():
    """Get or create event loop for async operations."""
    global _event_loop
    if _event_loop is None or _event_loop.is_closed():
        _event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(_event_loop)
    return _event_loop


async def get_browser():
    """Launch browser if not already running."""
    global _playwright, _browser

    async with _browser_lock:
        if _browser is None:
            log("Launching browser...")
            _playwright = await async_playwright().start()
            _browser = await _playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                ]
            )
            log("Browser ready")

        return _browser


async def shutdown_browser_now():
    """Kill browser immediately after scrape."""
    global _playwright, _browser

    async with _browser_lock:
        if _browser:
            try:
                await _browser.close()
                log("Browser killed")
            except Exception as e:
                log(f"Error closing browser: {e}")
            _browser = None

        if _playwright:
            try:
                await _playwright.stop()
                log("Playwright stopped")
            except Exception as e:
                log(f"Error stopping playwright: {e}")
            _playwright = None


# ─────────────────────────────────────────────────────────────────
# BVG BUS SCRAPING
# ─────────────────────────────────────────────────────────────────

def is_wrong_direction(direction):
    """Filter out buses going the wrong direction."""
    d_lower = direction.lower()
    return any(x in d_lower for x in WRONG_DIRECTIONS)


async def scrape_bvg_departures():
    """Scrape bus departures from BVG website."""
    departures = []
    browser = await get_browser()

    context = await browser.new_context(
        viewport={'width': 1280, 'height': 800},
        user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    )

    try:
        page = await context.new_page()

        log(f"[BUS] Navigating to BVG...")
        await page.goto(BUS_URL, wait_until='domcontentloaded', timeout=30000)

        # Wait for page to fully load (BVG uses heavy JS and iframes)
        await page.wait_for_timeout(5000)

        # Dismiss cookie popup if present
        try:
            popup_btn = page.locator('button:has-text("Alles klar")')
            if await popup_btn.count() > 0:
                await popup_btn.click()
                await page.wait_for_timeout(1000)
        except Exception:
            pass

        # Find the iframe with departure data (retry up to 3 times)
        frame = None
        for attempt in range(3):
            for f in page.frames:
                try:
                    tabpanel = f.locator('[role="tabpanel"]')
                    if await tabpanel.count() > 0:
                        frame = f
                        break
                except Exception:
                    continue
            if frame:
                break
            log(f"[BUS] Waiting for iframe (attempt {attempt + 1}/3)...")
            await page.wait_for_timeout(3000)

        if not frame:
            log("[BUS] ERROR: Could not find departure frame after retries")
            return []

        # Get all list items within the tabpanel
        items = await frame.locator('[role="tabpanel"] li').all()
        now = datetime.now()

        for item in items[:20]:
            try:
                button = item.locator('button')
                if not await button.count():
                    continue

                button_text = await button.inner_text()

                time_el = item.locator('time')
                if not await time_el.count():
                    continue

                time_text = await time_el.inner_text()

                # Check full item text for strike/cancellation indicators
                #
                #   ┌─────────────────────────────────────────────────────────┐
                #   │  BVG STRIKE DETECTION (Feb 2026)                        │
                #   │                                                         │
                #   │  During strikes, BVG shows per-departure messages:      │
                #   │  "Die BVG wird heute bestreikt"                         │
                #   │                                                         │
                #   │  Without this check:                                    │
                #   │    Dashboard shows ghost departures as catchable  ✗     │
                #   │                                                         │
                #   │  With this check:                                       │
                #   │    Dashboard shows "✕ Trip cancelled" + red styling ✓   │
                #   │                                                         │
                #   │  Uses shared CANCELLATION_PATTERN constant               │
                #   │  (same regex for Bus + S-Bahn scrapers)                │
                #   └─────────────────────────────────────────────────────────┘
                item_text = await item.inner_text()
                cancelled = bool(CANCELLATION_PATTERN.search(item_text))

                # Parse time (format: "21:26 Uhr" or "21:26 Uhr +3 Minuten")
                time_match = re.search(r'(\d{2}):(\d{2})', time_text)
                if not time_match:
                    continue

                hour, minute = int(time_match.group(1)), int(time_match.group(2))

                # Parse delay
                delay = 0
                delay_match = re.search(r'\+(\d+)', time_text)
                if delay_match:
                    delay = int(delay_match.group(1))

                # Parse line number
                line_match = re.search(r'^"?(X?\d+|N\d+)"?', button_text.strip())
                if not line_match:
                    continue
                line = line_match.group(1)

                # Parse direction
                dir_match = re.search(r'in Richtung\s+(.+?)(?:\s+Informationen|$)', button_text)
                direction = dir_match.group(1).strip() if dir_match else "Unknown"

                # Calculate minutes until departure (include delay in comparison)
                dep_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                actual_dep_time = dep_time + timedelta(minutes=delay)

                # Only wrap to next day if it's truly past (e.g., 23:00 when now is 01:00)
                # Not if it's just a few minutes ago (likely already departed)
                if actual_dep_time < now:
                    # Skip buses that have already left (within last hour)
                    if (now - actual_dep_time).total_seconds() < 3600:
                        continue
                    # Otherwise it's probably next day (late night schedule)
                    dep_time = dep_time + timedelta(days=1)
                    actual_dep_time = dep_time + timedelta(minutes=delay)

                minutes = int((actual_dep_time - now).total_seconds() / 60)

                if minutes < 0:
                    continue

                departures.append({
                    "line": line,
                    "direction": direction,
                    "minutes": minutes,
                    "time": f"{hour:02d}:{minute:02d}",
                    "delay": delay,
                    "platform": None,
                    "cancelled": cancelled
                })

            except Exception as e:
                continue

        log(f"[BUS] Scraped {len(departures)} departures")

    except Exception as e:
        log(f"[BUS] Scraping error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await context.close()

    return departures


def filter_bus_departures(departures):
    """Filter departures to only show relevant buses."""
    filtered = []
    for dep in departures:
        if dep["line"] in ALLOWED_BUS_LINES:
            if not is_wrong_direction(dep["direction"]):
                filtered.append(dep)
    return filtered[:6]


def filter_sbahn_departures(departures):
    """Filter S-Bahn departures to exclude wrong directions."""
    filtered = []
    for dep in departures:
        direction_lower = dep["direction"].lower()
        if not any(x in direction_lower for x in WRONG_SBAHN_DIRECTIONS):
            filtered.append(dep)
    return filtered[:6]


# ─────────────────────────────────────────────────────────────────
# S-BAHN SCRAPING (bahnhof.de)
# ─────────────────────────────────────────────────────────────────

async def scrape_sbahn_departures():
    """Scrape S-Bahn departures from bahnhof.de."""
    departures = []
    browser = await get_browser()

    context = await browser.new_context(
        viewport={'width': 1280, 'height': 800},
        user_agent='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    )

    try:
        page = await context.new_page()

        log(f"[S-BAHN] Navigating to bahnhof.de...")
        await page.goto(SBAHN_URL, wait_until='networkidle', timeout=30000)

        # Wait for Next.js hydration
        await page.wait_for_timeout(3000)

        # Accept cookies if dialog appears
        try:
            accept_btn = page.locator('button:has-text("Accept")')
            if await accept_btn.count() > 0:
                await accept_btn.first.click()
                await page.wait_for_timeout(500)
        except Exception:
            pass

        # Find departure entries - bahnhof.de uses aria-labels for departures
        # Look for time elements and departure info
        departure_items = await page.locator('[data-testid="departure-row"], .departure-row, [class*="Departure"]').all()

        if not departure_items:
            # Try alternative selectors
            departure_items = await page.locator('article, [role="listitem"]').all()

        now = datetime.now()

        for item in departure_items[:10]:
            try:
                text = await item.inner_text()

                # Look for S-Bahn lines (S1, S7, etc.)
                line_match = re.search(r'\b(S\d+)\b', text)
                if not line_match:
                    continue

                line = line_match.group(1)

                # Look for time patterns (HH:MM)
                time_match = re.search(r'(\d{1,2}):(\d{2})', text)
                if not time_match:
                    continue

                hour, minute = int(time_match.group(1)), int(time_match.group(2))

                # Look for direction/destination
                # Pattern on bahnhof.de: "to Berlin-Wannsee." or "to Oranienburg."
                direction = "Unknown"
                dir_patterns = [
                    r'to\s+(Berlin-)?([A-Za-zäöüÄÖÜß\-]+)\.',  # "to Berlin-Wannsee." or "to Oranienburg."
                    r'(?:Richtung|nach)\s+([A-Za-zäöüÄÖÜß\s\-]+?)(?:\s*\d|$|\n)',
                    r'(Wannsee|Oranienburg|Frohnau|Potsdam)',  # Fallback: known destinations
                ]
                for pattern in dir_patterns:
                    dir_match = re.search(pattern, text, re.IGNORECASE)
                    if dir_match:
                        # Get the last group (handles optional Berlin- prefix)
                        groups = [g for g in dir_match.groups() if g]
                        direction = groups[-1].strip() if groups else "Unknown"
                        break

                # Look for platform
                platform = None
                plat_match = re.search(r'(?:Gleis|Platform|Pl\.?)\s*(\d+)', text, re.IGNORECASE)
                if plat_match:
                    platform = plat_match.group(1)

                # Look for delay
                delay = 0
                delay_match = re.search(r'\+(\d+)', text)
                if delay_match:
                    delay = int(delay_match.group(1))

                # Check for cancelled/strike trip (uses shared CANCELLATION_PATTERN)
                cancelled = bool(CANCELLATION_PATTERN.search(text))

                # Calculate minutes until departure (include delay in comparison)
                dep_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                actual_dep_time = dep_time + timedelta(minutes=delay)

                # Only wrap to next day if it's truly past (e.g., 23:00 when now is 01:00)
                # Not if it's just a few minutes ago (likely already departed)
                if actual_dep_time < now:
                    # Skip trains that have already left (within last hour)
                    if (now - actual_dep_time).total_seconds() < 3600:
                        continue
                    # Otherwise it's probably next day (late night schedule)
                    dep_time = dep_time + timedelta(days=1)
                    actual_dep_time = dep_time + timedelta(minutes=delay)

                minutes = int((actual_dep_time - now).total_seconds() / 60)

                if minutes < 0:
                    continue

                departures.append({
                    "line": line,
                    "direction": direction,
                    "minutes": minutes,
                    "time": f"{hour:02d}:{minute:02d}",
                    "delay": delay,
                    "platform": platform,
                    "cancelled": cancelled
                })

            except Exception as e:
                continue

        # If structured parsing failed, try a simpler approach
        if not departures:
            log("[S-BAHN] Structured parsing failed, trying simple text extraction...")
            all_text = await page.inner_text('body')

            # Pattern: S1 followed by "to DESTINATION." followed by time
            # Example: "S1\nto Berlin-Wannsee.\nplanned 10 52...\n10:52"
            pattern = r'(S\d+)\s*\nto\s+([^.]+)\.\s*.*?(\d{1,2}):(\d{2})'
            for match in re.finditer(pattern, all_text, re.DOTALL):
                try:
                    line = match.group(1)
                    direction_raw = match.group(2).strip()
                    hour = int(match.group(3))
                    minute = int(match.group(4))

                    # Clean up direction (remove "Berlin-" prefix for cleaner display)
                    direction = direction_raw.replace("Berlin-", "").strip()

                    # Calculate minutes until departure
                    dep_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

                    # Only wrap to next day if it's truly past (e.g., 23:00 when now is 01:00)
                    # Not if it's just a few minutes ago (likely already departed)
                    if dep_time < now:
                        # Skip trains that have already left (within last hour)
                        if (now - dep_time).total_seconds() < 3600:
                            continue
                        # Otherwise it's probably next day (late night schedule)
                        dep_time = dep_time + timedelta(days=1)

                    minutes = int((dep_time - now).total_seconds() / 60)

                    if minutes < 0 or minutes > 120:
                        continue

                    # Extract platform and cancellation from nearby text
                    #
                    #   ┌──────────────────────────────────────────────────┐
                    #   │  BIDIRECTIONAL WINDOW (100 before + 200 after)  │
                    #   │                                                  │
                    #   │  Why not forward-only? Cancellation badges      │
                    #   │  can appear BEFORE the departure entry on       │
                    #   │  bahnhof.de (e.g. status label above the row). │
                    #   │                                                  │
                    #   │  ◄─100─► match.start() ◄──────200──────►       │
                    #   │  [cancel] S1 to Frohnau. Trip cancelled. 12:33  │
                    #   └──────────────────────────────────────────────────┘
                    window_start = max(0, match.start() - 100)
                    nearby_text = all_text[window_start:match.start() + 200]

                    platform = None
                    plat_match = re.search(r'Platform\s+(\d+)', nearby_text)
                    if plat_match:
                        platform = plat_match.group(1)

                    cancelled = bool(CANCELLATION_PATTERN.search(nearby_text))

                    departures.append({
                        "line": line,
                        "direction": direction,
                        "minutes": minutes,
                        "time": f"{hour:02d}:{minute:02d}",
                        "delay": 0,
                        "platform": platform,
                        "cancelled": cancelled
                    })
                except Exception:
                    continue

        # Deduplicate and sort
        seen = set()
        unique_deps = []
        for dep in departures:
            key = (dep["line"], dep["time"])
            if key not in seen:
                seen.add(key)
                unique_deps.append(dep)

        departures = sorted(unique_deps, key=lambda x: x["minutes"])[:6]

        log(f"[S-BAHN] Scraped {len(departures)} departures")

    except Exception as e:
        log(f"[S-BAHN] Scraping error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await context.close()

    return departures


# ─────────────────────────────────────────────────────────────────
# MAIN FETCH FUNCTION
# ─────────────────────────────────────────────────────────────────

async def fetch_transport_async():
    """Fetch transport data - scrapes both Bus and S-Bahn in parallel.

    Architecture: Launch → Scrape → Kill
    Browser is launched, scraping happens, then browser is killed immediately.
    """
    # Check cache first
    if _cache["data"] and _cache["timestamp"]:
        age = (datetime.now() - _cache["timestamp"]).total_seconds()
        if age < CACHE_TTL:
            log(f"Returning cached data (age: {age:.1f}s)")
            return _cache["data"]

    log("Fetching fresh transport data...")

    try:
        # Scrape both sources in parallel
        bus_task = asyncio.create_task(scrape_bvg_departures())
        sbahn_task = asyncio.create_task(scrape_sbahn_departures())

        bus_result, sbahn_result = await asyncio.gather(
            bus_task, sbahn_task,
            return_exceptions=True
        )

        # Handle exceptions
        bus_departures = [] if isinstance(bus_result, Exception) else bus_result
        sbahn_departures = [] if isinstance(sbahn_result, Exception) else sbahn_result

        # Filter departures
        bus_departures = filter_bus_departures(bus_departures)
        sbahn_departures = filter_sbahn_departures(sbahn_departures)

        log(f"OK: {len(sbahn_departures)} S-Bahn, {len(bus_departures)} bus")

        result = {
            "sbahn": sbahn_departures,
            "bus": bus_departures,
            "updated": datetime.now().strftime("%H:%M"),
            "error": None,
            "fallback": FALLBACK
        }

        # Update cache
        _cache["data"] = result
        _cache["timestamp"] = datetime.now()

        return result

    except Exception as e:
        log(f"ERROR: {e}")
        return {
            "sbahn": [],
            "bus": [],
            "updated": None,
            "error": str(e),
            "fallback": FALLBACK
        }

    finally:
        # ALWAYS kill browser after scrape (Launch → Scrape → Kill architecture)
        await shutdown_browser_now()


def fetch_transport():
    """Synchronous wrapper for async fetch."""
    loop = _get_event_loop()
    return loop.run_until_complete(fetch_transport_async())


# ─────────────────────────────────────────────────────────────────
# HTTP SERVER
# ─────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/api/transport":
            result = fetch_transport()
            # Update activity timestamp for cleanup service
            update_activity()
            self.send_json(result)
        elif self.path == "/api/health":
            # Health check doesn't start browser
            self.send_json({
                "status": "ok",
                "browser_active": _browser is not None
            })
        else:
            self.send_json({"error": "not found"}, 404)


def main():
    """Start server - browser will launch fresh for each request."""
    # Auto-reap zombie child processes (Python as PID 1 doesn't do this by default)
    signal.signal(signal.SIGCHLD, signal.SIG_IGN)

    log(f"Starting transport scraper on port {PORT}")
    log(f"Architecture: Launch → Scrape → Kill (browser killed after each request)")
    log(f"Cache TTL: {CACHE_TTL}s | Activity file: {ACTIVITY_FILE}")
    log(f"URLs: Bus={BUS_URL[:50]}... | S-Bahn={SBAHN_URL[:50]}...")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
