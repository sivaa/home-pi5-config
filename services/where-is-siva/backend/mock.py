"""Generate realistic mock track data for testing the dashboard.

Simulates a voyage from Ft. Lauderdale to Horta via Bermuda,
~18 days in, approximately 72% complete.
"""

import math
import random
from datetime import datetime, timedelta, timezone
from backend.config import WAYPOINTS


def _interpolate_great_circle(lat1, lon1, lat2, lon2, fraction):
    """Interpolate along a great circle arc."""
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)
    cos_d = (
        math.sin(lat1_r) * math.sin(lat2_r)
        + math.cos(lat1_r) * math.cos(lat2_r) * math.cos(lon2_r - lon1_r)
    )
    d = math.acos(max(-1.0, min(1.0, cos_d)))
    if d == 0:
        return lat1, lon1
    a = math.sin((1 - fraction) * d) / math.sin(d)
    b = math.sin(fraction * d) / math.sin(d)
    x = a * math.cos(lat1_r) * math.cos(lon1_r) + b * math.cos(lat2_r) * math.cos(lon2_r)
    y = a * math.cos(lat1_r) * math.sin(lon1_r) + b * math.cos(lat2_r) * math.sin(lon2_r)
    z = a * math.sin(lat1_r) + b * math.sin(lat2_r)
    lat = math.degrees(math.atan2(z, math.sqrt(x * x + y * y)))
    lon = math.degrees(math.atan2(y, x))
    return lat, lon


def generate_mock_track(days_elapsed=18, points_per_day=6):
    """Generate mock track points for the voyage.

    Args:
        days_elapsed: How many days into the voyage (default 18 = ~72%)
        points_per_day: GPS updates per day (Garmin sends ~6/day at 4h intervals)

    Returns:
        tuple of (track_points, messages)
    """
    random.seed(42)

    # Leg 1: Ft. Lauderdale to Bermuda (~773nm, ~5.5 days at 5.8kts avg)
    # Leg 2: Bermuda to Horta (~1877nm, ~13.5 days at 5.8kts avg)
    ft_laud = WAYPOINTS[0]
    bermuda = WAYPOINTS[1]
    horta = WAYPOINTS[2]

    leg1_days = 5.5
    leg2_days = 22.5  # total days for full trip if continued
    total_points = days_elapsed * points_per_day
    hours_between = 24 / points_per_day

    start_time = datetime(2026, 3, 28, 14, 0, 0, tzinfo=timezone.utc)
    track_points = []

    for i in range(total_points):
        t = start_time + timedelta(hours=i * hours_between)
        day = i / points_per_day

        if day <= leg1_days:
            # Leg 1: Ft. Lauderdale to Bermuda
            frac = day / leg1_days
            lat, lon = _interpolate_great_circle(
                ft_laud["lat"], ft_laud["lon"],
                bermuda["lat"], bermuda["lon"],
                frac,
            )
        else:
            # Leg 2: Bermuda to Horta
            frac = (day - leg1_days) / (leg2_days - leg1_days)
            frac = min(frac, 1.0)
            lat, lon = _interpolate_great_circle(
                bermuda["lat"], bermuda["lon"],
                horta["lat"], horta["lon"],
                frac,
            )

        # Add realistic noise (wind, current, course corrections)
        lat += random.gauss(0, 0.05)
        lon += random.gauss(0, 0.08)

        # Realistic speed variation (4-8 knots)
        speed = 5.8 + random.gauss(0, 1.2)
        speed = max(2.0, min(9.0, speed))

        # Heading (approximate, with noise)
        heading = (65 + random.gauss(0, 15)) % 360

        track_points.append({
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "speed": round(speed, 1),
            "heading": round(heading, 1),
            "elevation": 0.0,
            "timestamp": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
        })

    # Mock check-in messages
    messages = [
        {
            "text": "Just left Ft. Lauderdale! Crew is excited. Fair winds ahead.",
            "lat": 26.15,
            "lon": -80.10,
            "timestamp": "2026-03-28T15:30:00Z",
        },
        {
            "text": "Day 3 - Gulf Stream crossing was rough but we're through. Heading NE to Bermuda.",
            "lat": 29.42,
            "lon": -76.55,
            "timestamp": "2026-03-31T08:15:00Z",
        },
        {
            "text": "Arrived Bermuda! Restocking supplies. Beautiful harbor in St. George's.",
            "lat": 32.38,
            "lon": -64.68,
            "timestamp": "2026-04-03T12:00:00Z",
        },
        {
            "text": "Departed Bermuda. Next stop: Azores. 1,877nm to go!",
            "lat": 32.40,
            "lon": -64.60,
            "timestamp": "2026-04-04T09:00:00Z",
        },
        {
            "text": "Day 10 - Dolphins swimming alongside us this morning! Wind steady from SW at 15kts.",
            "lat": 34.25,
            "lon": -55.30,
            "timestamp": "2026-04-07T08:15:00Z",
        },
        {
            "text": "Crossed the halfway mark! 1,325nm behind us. Crew morale is high.",
            "lat": 35.10,
            "lon": -48.20,
            "timestamp": "2026-04-10T07:45:00Z",
        },
        {
            "text": "Day 15 - Beautiful sunset. Made 148nm today, best day yet!",
            "lat": 36.05,
            "lon": -42.80,
            "timestamp": "2026-04-12T19:30:00Z",
        },
        {
            "text": "Day 18 - Can almost smell the Azores! 742nm remaining. Wind picking up.",
            "lat": 36.42,
            "lon": -37.10,
            "timestamp": "2026-04-15T08:00:00Z",
        },
    ]

    return track_points, messages
