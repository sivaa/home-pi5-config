"""Geodesic calculations and derived voyage statistics."""

import math
from datetime import datetime, timedelta, timezone
from haversine import haversine, Unit
from backend.config import (
    DESTINATION_LAT, DESTINATION_LON,
    ORIGIN_LAT, ORIGIN_LON,
    TOTAL_ROUTE_KM,
)


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in kilometers between two points."""
    return haversine((lat1, lon1), (lat2, lon2), unit=Unit.KILOMETERS)


def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial bearing in degrees from point 1 to point 2."""
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    dlon_r = math.radians(lon2 - lon1)
    x = math.sin(dlon_r) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon_r)
    brng = math.degrees(math.atan2(x, y))
    return (brng + 360) % 360


def compass_direction(degrees: float) -> str:
    """Convert bearing degrees to 16-point compass direction."""
    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    idx = round(degrees / 22.5) % 16
    return directions[idx]


def knots_to_kmh(knots: float) -> float:
    """Convert speed from knots to km/h."""
    return knots * 1.852


def compute_voyage_stats(track_points: list[dict]) -> dict:
    """Compute all derived voyage statistics from track point history.

    Args:
        track_points: list of dicts with lat, lon, speed, heading, elevation, timestamp
                      sorted by timestamp ascending. Speed is stored in knots internally.

    Returns:
        dict with all dashboard statistics (distances in km, speeds in km/h)
    """
    if not track_points:
        return _empty_stats()

    latest = track_points[-1]
    current_lat = latest["lat"]
    current_lon = latest["lon"]

    # Distance completed: sum of segments between consecutive points
    distance_completed = 0.0
    for i in range(1, len(track_points)):
        p1 = track_points[i - 1]
        p2 = track_points[i]
        distance_completed += distance_km(p1["lat"], p1["lon"], p2["lat"], p2["lon"])

    # Distance remaining: straight line from current position to destination
    distance_remaining = distance_km(current_lat, current_lon, DESTINATION_LAT, DESTINATION_LON)

    # Progress percentage
    total_traveled_plus_remaining = distance_completed + distance_remaining
    progress_pct = (distance_completed / total_traveled_plus_remaining * 100) if total_traveled_plus_remaining > 0 else 0

    # Time calculations
    first_ts = _parse_timestamp(track_points[0]["timestamp"])
    latest_ts = _parse_timestamp(latest["timestamp"])
    elapsed_hours = (latest_ts - first_ts).total_seconds() / 3600 if first_ts and latest_ts else 0

    # Speeds (convert stored knots to km/h for display)
    current_speed_knots = latest.get("speed") or 0.0
    current_speed_kmh = knots_to_kmh(current_speed_knots)
    avg_speed_kmh = (distance_completed / elapsed_hours) if elapsed_hours > 0 else 0.0

    # ETA
    eta = None
    days_remaining = None
    if avg_speed_kmh > 0:
        hours_remaining = distance_remaining / avg_speed_kmh
        days_remaining = hours_remaining / 24
        if latest_ts:
            eta = latest_ts + timedelta(hours=hours_remaining)

    # Heading to destination
    heading_to_dest = bearing(current_lat, current_lon, DESTINATION_LAT, DESTINATION_LON)

    # Daily distances
    daily_distances = _compute_daily_distances(track_points)

    return {
        "current_position": {
            "lat": round(current_lat, 4),
            "lon": round(current_lon, 4),
            "heading": round(latest.get("heading") or heading_to_dest, 1),
            "heading_compass": compass_direction(latest.get("heading") or heading_to_dest),
            "last_update": latest["timestamp"],
        },
        "voyage": {
            "distance_completed_km": round(distance_completed, 1),
            "distance_remaining_km": round(distance_remaining, 1),
            "total_route_km": TOTAL_ROUTE_KM,
            "progress_pct": round(progress_pct, 1),
        },
        "speed": {
            "current_kmh": round(current_speed_kmh, 1),
            "average_kmh": round(avg_speed_kmh, 1),
        },
        "eta": {
            "estimated_arrival": eta.isoformat() if eta else None,
            "days_remaining": round(days_remaining, 1) if days_remaining else None,
        },
        "daily_distances": daily_distances,
    }


def _compute_daily_distances(track_points: list[dict]) -> list[dict]:
    """Compute distance traveled per day."""
    if len(track_points) < 2:
        return []

    daily = {}
    for i in range(1, len(track_points)):
        p1 = track_points[i - 1]
        p2 = track_points[i]
        ts = _parse_timestamp(p2["timestamp"])
        if ts is None:
            continue
        day = ts.strftime("%Y-%m-%d")
        segment = distance_km(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        daily[day] = daily.get(day, 0.0) + segment

    return [
        {"date": day, "distance_km": round(dist, 1)}
        for day, dist in sorted(daily.items())
    ]


def _parse_timestamp(ts_str: str) -> datetime | None:
    """Parse various timestamp formats from Garmin KML."""
    if not ts_str:
        return None
    for fmt in [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",
    ]:
        try:
            return datetime.strptime(ts_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _empty_stats() -> dict:
    return {
        "current_position": {
            "lat": ORIGIN_LAT,
            "lon": ORIGIN_LON,
            "heading": 0,
            "heading_compass": "N",
            "last_update": None,
        },
        "voyage": {
            "distance_completed_km": 0,
            "distance_remaining_km": round(distance_km(ORIGIN_LAT, ORIGIN_LON, DESTINATION_LAT, DESTINATION_LON), 1),
            "total_route_km": TOTAL_ROUTE_KM,
            "progress_pct": 0,
        },
        "speed": {"current_kmh": 0, "average_kmh": 0},
        "eta": {"estimated_arrival": None, "days_remaining": None},
        "daily_distances": [],
    }
