import os

GARMIN_FEED_URL = os.getenv("GARMIN_FEED_URL", "")
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "300"))

DESTINATION_LAT = 38.5320
DESTINATION_LON = -28.6300
DESTINATION_NAME = "Horta, Azores"

ORIGIN_LAT = 26.1224
ORIGIN_LON = -80.1373
ORIGIN_NAME = "Ft. Lauderdale"

TOTAL_ROUTE_KM = 5000

WAYPOINTS = [
    {"name": "Ft. Lauderdale", "lat": 26.1224, "lon": -80.1373},
    {"name": "Bermuda", "lat": 32.3778, "lon": -64.6772},
    {"name": "Horta, Azores", "lat": 38.5320, "lon": -28.6300},
]

DB_PATH = os.getenv("DB_PATH", "data/tracker.db")
STATIC_DIR = os.getenv("STATIC_DIR", "static")
DATA_JSON_PATH = os.path.join(STATIC_DIR, "data.json")

USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "false").lower() == "true"

GIT_PUSH_ENABLED = os.getenv("GIT_PUSH_ENABLED", "false").lower() == "true"
GIT_PUSH_INTERVAL_SECONDS = int(os.getenv("GIT_PUSH_INTERVAL_SECONDS", "600"))
GIT_REPO_PATH = os.getenv("GIT_REPO_PATH", "/opt/where-is-siva/public-repo")
