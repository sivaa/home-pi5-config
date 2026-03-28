import aiosqlite
import os
from backend.config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    speed REAL,
    heading REAL,
    elevation REAL,
    timestamp TEXT NOT NULL,
    UNIQUE(lat, lon, timestamp)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    lat REAL,
    lon REAL,
    timestamp TEXT NOT NULL,
    UNIQUE(text, timestamp)
);
"""


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        # WAL mode: more robust crash recovery + allows concurrent reads during writes
        await db.execute("PRAGMA journal_mode=WAL")
        await db.commit()


async def insert_track_point(lat, lon, speed, heading, elevation, timestamp):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO track_points (lat, lon, speed, heading, elevation, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (lat, lon, speed, heading, elevation, timestamp),
        )
        await db.commit()


async def insert_message(text, lat, lon, timestamp):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO messages (text, lat, lon, timestamp) VALUES (?, ?, ?, ?)",
            (text, lat, lon, timestamp),
        )
        await db.commit()


async def get_all_track_points():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT lat, lon, speed, heading, elevation, timestamp FROM track_points ORDER BY timestamp ASC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_all_messages():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT text, lat, lon, timestamp FROM messages ORDER BY timestamp DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_latest_track_point():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT lat, lon, speed, heading, elevation, timestamp FROM track_points ORDER BY timestamp DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        return dict(row) if row else None
