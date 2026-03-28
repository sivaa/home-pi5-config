"""Fake Garmin InReach KML feed for end-to-end testing.

Simulates a boat sailing Ft. Lauderdale -> Bermuda -> Horta, Azores.
Each real minute = 1 simulated hour by default (configurable).

Usage:
    python fake-garmin.py                          # defaults: port 9000, 60x speed
    python fake-garmin.py --port 9001 --speed 120  # 120x = 1 real min = 2 sim hours
    python fake-garmin.py --speed 1                # real-time (very slow, for realism)

Then point the tracker at:
    GARMIN_FEED_URL=http://localhost:9000/feed.kml

Endpoints:
    GET /feed.kml        - KML feed (what the tracker polls)
    GET /status          - JSON with current sim state
    POST /message        - Inject a check-in message (body: {"text": "All good!"})
    POST /reset          - Reset simulation to start
"""

import argparse
import json
import math
import time
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler

# --- Route: Ft. Lauderdale -> Bermuda -> Horta, Azores ---
WAYPOINTS = [
    (26.1224, -80.1373, "Ft. Lauderdale"),
    (32.3778, -64.6772, "Bermuda"),
    (38.5320, -28.6300, "Horta, Azores"),
]

BOAT_SPEED_KMH = 12.0      # realistic cruising speed for a sailboat
POINT_INTERVAL_HOURS = 1.0  # one track point per simulated hour


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def initial_bearing(lat1, lon1, lat2, lon2):
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlon_r = math.radians(lon2 - lon1)
    x = math.sin(dlon_r) * math.cos(lat2_r)
    y = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon_r)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(lat, lon, bearing_deg, distance_km):
    """Move from (lat, lon) along bearing by distance_km. Returns (new_lat, new_lon)."""
    R = 6371.0
    d = distance_km / R
    brng = math.radians(bearing_deg)
    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    new_lat = math.asin(math.sin(lat_r) * math.cos(d) + math.cos(lat_r) * math.sin(d) * math.cos(brng))
    new_lon = lon_r + math.atan2(
        math.sin(brng) * math.sin(d) * math.cos(lat_r),
        math.cos(d) - math.sin(lat_r) * math.sin(new_lat),
    )
    return math.degrees(new_lat), math.degrees(new_lon)


def build_route_segments():
    """Pre-compute total distances between waypoints."""
    segments = []
    for i in range(len(WAYPOINTS) - 1):
        lat1, lon1, _ = WAYPOINTS[i]
        lat2, lon2, _ = WAYPOINTS[i + 1]
        dist = haversine_km(lat1, lon1, lat2, lon2)
        segments.append((lat1, lon1, lat2, lon2, dist))
    return segments


ROUTE_SEGMENTS = build_route_segments()
TOTAL_ROUTE_KM = sum(s[4] for s in ROUTE_SEGMENTS)


class Simulation:
    def __init__(self, speed_multiplier):
        self.speed_multiplier = speed_multiplier
        self.real_start = time.time()
        self.sim_start = datetime(2026, 4, 1, 8, 0, 0, tzinfo=timezone.utc)
        self.messages = []
        # Add a departure message
        self.messages.append({
            "text": "Setting sail from Ft. Lauderdale! Next stop: Bermuda.",
            "lat": WAYPOINTS[0][0],
            "lon": WAYPOINTS[0][1],
            "timestamp": self.sim_start,
        })

    def sim_now(self):
        elapsed_real = time.time() - self.real_start
        elapsed_sim = timedelta(seconds=elapsed_real * self.speed_multiplier)
        return self.sim_start + elapsed_sim

    def sim_elapsed_hours(self):
        return (self.sim_now() - self.sim_start).total_seconds() / 3600

    def _position_at_km(self, km_traveled):
        """Get (lat, lon, heading) at a given distance along the route."""
        if km_traveled <= 0:
            lat, lon, _ = WAYPOINTS[0]
            return lat, lon, initial_bearing(lat, lon, ROUTE_SEGMENTS[0][2], ROUTE_SEGMENTS[0][3])
        remaining = km_traveled
        for lat1, lon1, lat2, lon2, seg_dist in ROUTE_SEGMENTS:
            if remaining <= seg_dist:
                brng = initial_bearing(lat1, lon1, lat2, lon2)
                lat, lon = destination_point(lat1, lon1, brng, remaining)
                return lat, lon, brng
            remaining -= seg_dist
        # Past the end - clamp to destination
        lat, lon, _ = WAYPOINTS[-1]
        return lat, lon, 0.0

    def get_track_points(self):
        """Generate all track points from sim_start to sim_now."""
        hours = self.sim_elapsed_hours()
        num_points = int(hours / POINT_INTERVAL_HOURS) + 1
        points = []
        for i in range(num_points):
            t = self.sim_start + timedelta(hours=i * POINT_INTERVAL_HOURS)
            km = i * POINT_INTERVAL_HOURS * BOAT_SPEED_KMH
            if km > TOTAL_ROUTE_KM:
                km = TOTAL_ROUTE_KM
            lat, lon, heading = self._position_at_km(km)
            # Add some noise for realism
            speed_noise = BOAT_SPEED_KMH + math.sin(i * 0.7) * 3.0
            points.append({
                "lat": lat,
                "lon": lon,
                "speed_kmh": max(0.5, speed_noise),
                "heading": heading,
                "elevation": 0.0,
                "timestamp": t,
            })
            if km >= TOTAL_ROUTE_KM:
                break
        return points

    def add_message(self, text):
        points = self.get_track_points()
        latest = points[-1] if points else {"lat": WAYPOINTS[0][0], "lon": WAYPOINTS[0][1]}
        self.messages.append({
            "text": text,
            "lat": latest["lat"],
            "lon": latest["lon"],
            "timestamp": self.sim_now(),
        })

    def reset(self):
        self.__init__(self.speed_multiplier)

    def arrived(self):
        km = self.sim_elapsed_hours() * BOAT_SPEED_KMH
        return km >= TOTAL_ROUTE_KM

    def to_kml(self):
        points = self.get_track_points()
        placemarks = []
        for p in points:
            ts = p["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ")
            placemarks.append(f"""    <Placemark>
      <TimeStamp><when>{ts}</when></TimeStamp>
      <Point><coordinates>{p['lon']:.6f},{p['lat']:.6f},{p['elevation']:.1f}</coordinates></Point>
      <ExtendedData>
        <Data name="Time UTC"><value>{ts}</value></Data>
        <Data name="Velocity"><value>{p['speed_kmh']:.1f} km/h</value></Data>
        <Data name="Course"><value>{p['heading']:.1f}°</value></Data>
        <Data name="Event"><value>Tracking</value></Data>
      </ExtendedData>
    </Placemark>""")

        for m in self.messages:
            ts = m["timestamp"].strftime("%Y-%m-%dT%H:%M:%SZ")
            placemarks.append(f"""    <Placemark>
      <description>{m['text']}</description>
      <TimeStamp><when>{ts}</when></TimeStamp>
      <Point><coordinates>{m['lon']:.6f},{m['lat']:.6f},0.0</coordinates></Point>
      <ExtendedData>
        <Data name="Time UTC"><value>{ts}</value></Data>
        <Data name="Event"><value>Text Message</value></Data>
      </ExtendedData>
    </Placemark>""")

        return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Siva's inReach Tracking (FAKE)</name>
{"".join(placemarks)}
  </Document>
</kml>"""

    def status_json(self):
        points = self.get_track_points()
        latest = points[-1] if points else None
        km = self.sim_elapsed_hours() * BOAT_SPEED_KMH
        return {
            "sim_time": self.sim_now().isoformat(),
            "elapsed_sim_hours": round(self.sim_elapsed_hours(), 1),
            "km_traveled": round(min(km, TOTAL_ROUTE_KM), 1),
            "total_km": round(TOTAL_ROUTE_KM, 1),
            "progress_pct": round(min(km / TOTAL_ROUTE_KM * 100, 100), 1),
            "arrived": self.arrived(),
            "track_points": len(points),
            "messages": len(self.messages),
            "current_position": {
                "lat": round(latest["lat"], 4),
                "lon": round(latest["lon"], 4),
            } if latest else None,
            "speed_multiplier": self.speed_multiplier,
        }


sim = None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/feed.kml":
            body = sim.to_kml().encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.google-earth.kml+xml")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/status":
            body = json.dumps(sim.status_json(), indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif self.path == "/":
            status = sim.status_json()
            body = LANDING_HTML.format(**status).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        else:
            self.send_error(404)

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else b""

        if self.path == "/message":
            try:
                data = json.loads(body) if body else {}
                text = data.get("text", "Check-in from the sea!")
            except json.JSONDecodeError:
                text = "Check-in from the sea!"
            sim.add_message(text)
            resp = json.dumps({"ok": True, "message": text}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

        elif self.path == "/reset":
            sim.reset()
            resp = json.dumps({"ok": True, "message": "Simulation reset"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

        else:
            self.send_error(404)

    def log_message(self, format, *args):
        # Only log actual requests, not noise
        if "/feed.kml" in (args[0] if args else ""):
            return  # suppress poll spam
        super().log_message(format, *args)


LANDING_HTML = """<!DOCTYPE html>
<html><head><title>Fake Garmin Feed</title>
<meta http-equiv="refresh" content="10">
<style>
  body {{ font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 2em; }}
  h1 {{ color: #e94560; }}
  .stat {{ margin: 0.5em 0; }}
  .label {{ color: #888; }}
  .val {{ color: #0f3460; font-weight: bold; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; }}
  a {{ color: #e94560; }}
  pre {{ background: #16213e; padding: 1em; border-radius: 8px; overflow-x: auto; }}
</style></head>
<body>
<h1>Fake Garmin InReach Feed</h1>
<div class="stat"><span class="label">Sim time:</span> <span class="val">{sim_time}</span></div>
<div class="stat"><span class="label">Speed:</span> <span class="val">{speed_multiplier}x</span> (1 real min = {speed_multiplier} sim min)</div>
<div class="stat"><span class="label">Elapsed:</span> <span class="val">{elapsed_sim_hours} hours</span></div>
<div class="stat"><span class="label">Progress:</span> <span class="val">{km_traveled} / {total_km} km ({progress_pct}%)</span></div>
<div class="stat"><span class="label">Track points:</span> <span class="val">{track_points}</span></div>
<div class="stat"><span class="label">Messages:</span> <span class="val">{messages}</span></div>
<div class="stat"><span class="label">Arrived:</span> <span class="val">{arrived}</span></div>
<h2>Endpoints</h2>
<pre>
GET  <a href="/feed.kml">/feed.kml</a>   - KML feed (point tracker here)
GET  <a href="/status">/status</a>     - JSON status
POST /message   - Send check-in: curl -X POST -d '{{"text":"Hello!"}}' http://localhost:PORT/message
POST /reset     - Reset simulation
</pre>
<p style="color:#555">Auto-refreshes every 10s</p>
</body></html>"""


def main():
    global sim
    parser = argparse.ArgumentParser(description="Fake Garmin InReach KML feed")
    parser.add_argument("--port", type=int, default=9000, help="Port to serve on (default: 9000)")
    parser.add_argument("--speed", type=int, default=60, help="Speed multiplier: 60 = 1 real min = 1 sim hour (default: 60)")
    args = parser.parse_args()

    sim = Simulation(args.speed)

    total_sim_hours = TOTAL_ROUTE_KM / BOAT_SPEED_KMH
    real_minutes = total_sim_hours * 60 / args.speed

    print(f"""
    ╔══════════════════════════════════════════════════════╗
    ║  FAKE GARMIN INREACH FEED                           ║
    ╠══════════════════════════════════════════════════════╣
    ║                                                      ║
    ║  Route: Ft. Lauderdale -> Bermuda -> Horta, Azores  ║
    ║  Distance: {TOTAL_ROUTE_KM:.0f} km at {BOAT_SPEED_KMH:.0f} km/h                  ║
    ║  Sim duration: {total_sim_hours:.0f} hours                         ║
    ║  Real time to complete: {real_minutes:.0f} minutes                ║
    ║  Speed: {args.speed}x (1 real min = {args.speed} sim min)          ║
    ║                                                      ║
    ║  KML feed: http://localhost:{args.port}/feed.kml        ║
    ║  Dashboard: http://localhost:{args.port}                 ║
    ║                                                      ║
    ║  Set in tracker:                                     ║
    ║  GARMIN_FEED_URL=http://localhost:{args.port}/feed.kml  ║
    ╚══════════════════════════════════════════════════════╝
    """)

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


if __name__ == "__main__":
    main()
