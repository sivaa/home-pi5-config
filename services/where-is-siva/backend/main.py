import asyncio
import json
import logging
import os
import socket
import tempfile
from contextlib import asynccontextmanager
from datetime import datetime as dt, timedelta

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import config
from backend.database import (
    get_all_messages,
    get_all_track_points,
    init_db,
    insert_message,
    insert_messages_batch,
    insert_track_point,
    insert_track_points_batch,
)
from backend.kml_parser import parse_kml
from backend.tracker import compute_voyage_stats
from backend.git_sync import push_data_json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


# ========================================
# SYSTEMD WATCHDOG
# ========================================

def notify_systemd(state="WATCHDOG=1"):
    """Notify systemd watchdog that the service is alive."""
    addr = os.environ.get("NOTIFY_SOCKET")
    if not addr:
        return
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
    try:
        if addr.startswith("@"):
            addr = "\0" + addr[1:]
        sock.sendto(state.encode(), addr)
    finally:
        sock.close()


def watchdog_ping():
    """Periodic watchdog ping - also checks service health."""
    try:
        db_path = config.DB_PATH
        if not os.path.exists(os.path.dirname(db_path) or "."):
            logger.error("DB directory missing!")
            return
        notify_systemd("WATCHDOG=1")
    except Exception:
        logger.exception("Watchdog health check failed")


# ========================================
# DATA ASSEMBLY (single source of truth)
# ========================================

async def build_dashboard_data() -> dict:
    """Build the complete dashboard payload. Used by both API and data.json export."""
    track_points = await get_all_track_points()
    messages = await get_all_messages()
    stats = compute_voyage_stats(track_points)
    return {
        "stats": stats,
        "track": track_points,
        "messages": messages,
        "waypoints": config.WAYPOINTS,
        "route": {
            "origin": config.ORIGIN_NAME,
            "destination": config.DESTINATION_NAME,
            "total_km": config.TOTAL_ROUTE_KM,
        },
    }


# ========================================
# SCHEDULED JOBS
# ========================================

async def poll_garmin_feed():
    """Fetch the Garmin KML feed, parse it, and store new data."""
    if not config.GARMIN_FEED_URL:
        logger.debug("No GARMIN_FEED_URL configured, skipping poll")
        return

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(config.GARMIN_FEED_URL)
            resp.raise_for_status()

        if not resp.text.strip():
            logger.debug("Empty KML feed, skipping parse")
            return

        track_points, messages = parse_kml(resp.text)

        await insert_track_points_batch([
            (tp.lat, tp.lon, tp.speed, tp.heading, tp.elevation, tp.timestamp)
            for tp in track_points
        ])
        await insert_messages_batch([
            (msg.text, msg.lat, msg.lon, msg.timestamp)
            for msg in messages
        ])

        logger.info("Polled KML: %d track points, %d messages", len(track_points), len(messages))
        await export_data_json()

    except Exception:
        logger.exception("Failed to poll Garmin feed")


async def load_mock_data():
    """Load mock data into the database for testing."""
    from backend.mock import generate_mock_track

    track_points, messages = generate_mock_track()
    for tp in track_points:
        await insert_track_point(
            tp["lat"], tp["lon"], tp["speed"], tp["heading"], tp["elevation"], tp["timestamp"]
        )
    for msg in messages:
        await insert_message(msg["text"], msg["lat"], msg["lon"], msg["timestamp"])

    logger.info("Loaded mock data: %d track points, %d messages", len(track_points), len(messages))
    await export_data_json()


async def export_data_json():
    """Export current dashboard state to static/data.json.

    Uses atomic write (tempfile + os.replace) so a power cut mid-write
    cannot leave a truncated file that breaks the public Vercel site.
    """
    data = await build_dashboard_data()

    os.makedirs(config.STATIC_DIR, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=config.STATIC_DIR, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_path, config.DATA_JSON_PATH)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise

    logger.info("Exported data.json (%d bytes)", os.path.getsize(config.DATA_JSON_PATH))


async def async_push_data_json():
    """Run git push in a thread to avoid blocking the event loop."""
    await asyncio.to_thread(push_data_json)


# ========================================
# APP LIFECYCLE
# ========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    if config.USE_MOCK_DATA:
        await load_mock_data()

    if config.GARMIN_FEED_URL:
        scheduler.add_job(
            poll_garmin_feed, "interval",
            seconds=config.POLL_INTERVAL_SECONDS,
            next_run_time=dt.now(),
        )
        logger.info("Scheduled KML polling every %ds (first poll: now)", config.POLL_INTERVAL_SECONDS)

    if config.GIT_PUSH_ENABLED:
        scheduler.add_job(
            async_push_data_json, "interval",
            seconds=config.GIT_PUSH_INTERVAL_SECONDS,
            next_run_time=dt.now() + timedelta(seconds=30),
        )
        logger.info("Scheduled git push every %ds (first push: 30s delay)", config.GIT_PUSH_INTERVAL_SECONDS)

    # Watchdog: ping systemd every 30s (WatchdogSec=120, so 4x safety margin)
    scheduler.add_job(watchdog_ping, "interval", seconds=30)
    notify_systemd("READY=1")

    if scheduler.get_jobs():
        scheduler.start()

    yield

    if scheduler.running:
        scheduler.shutdown()


# ========================================
# APP + MIDDLEWARE
# ========================================

app = FastAPI(title="Where Is Siva", lifespan=lifespan)

# CORS for local dev (localhost:8888 -> pi:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


# ========================================
# API ENDPOINTS
# ========================================

@app.get("/api/all")
async def api_all():
    """Single endpoint returning all dashboard data."""
    data = await build_dashboard_data()
    return JSONResponse(data)


@app.get("/api/status")
async def api_status():
    """Voyage stats only."""
    data = await build_dashboard_data()
    return JSONResponse(data["stats"])


@app.get("/health")
async def health():
    """Health check for monitoring."""
    track_points = await get_all_track_points()
    return JSONResponse({
        "status": "ok",
        "track_points": len(track_points),
        "garmin_url_configured": bool(config.GARMIN_FEED_URL),
        "git_push_enabled": config.GIT_PUSH_ENABLED,
    })


# Serve static files (data.json, etc.)
app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")


@app.get("/")
async def index():
    index_path = os.path.join(config.STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Where Is Siva - dashboard not built yet"})
