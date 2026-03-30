"""Parse Garmin inReach MapShare KML feeds.

Garmin KML feeds contain <Placemark> elements with:
- Track points: <Point><coordinates>lon,lat,elevation</coordinates></Point>
  with <ExtendedData> containing speed, heading, timestamp, etc.
- Messages: <Placemark> with <description> containing the check-in text.

The KML namespace is typically: http://www.opengis.net/kml/2.2
"""

import defusedxml.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

KML_NS = "{http://www.opengis.net/kml/2.2}"


@dataclass
class TrackPoint:
    lat: float
    lon: float
    speed: Optional[float]
    heading: Optional[float]
    elevation: Optional[float]
    timestamp: str


@dataclass
class Message:
    text: str
    lat: Optional[float]
    lon: Optional[float]
    timestamp: str


def _get_extended_data(placemark) -> dict:
    """Extract key-value pairs from ExtendedData/Data elements."""
    data = {}
    extended = placemark.find(f"{KML_NS}ExtendedData")
    if extended is None:
        return data
    for d in extended.findall(f"{KML_NS}Data"):
        name = d.get("name", "")
        value_el = d.find(f"{KML_NS}value")
        if value_el is not None and value_el.text:
            data[name] = value_el.text.strip()
    return data


def _parse_coordinates(placemark) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """Extract lon, lat, elevation from a Placemark's Point coordinates."""
    point = placemark.find(f".//{KML_NS}Point/{KML_NS}coordinates")
    if point is None or not point.text:
        return None, None, None
    parts = point.text.strip().split(",")
    if len(parts) >= 2:
        lon = float(parts[0])
        lat = float(parts[1])
        elevation = float(parts[2]) if len(parts) >= 3 else None
        return lon, lat, elevation
    return None, None, None


_TIMESTAMP_FORMATS = [
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%d %H:%M:%S",
    "%m/%d/%Y %I:%M:%S %p",
]


def _normalize_timestamp(raw: str) -> str:
    """Convert any Garmin timestamp format to ISO 8601 UTC."""
    for fmt in _TIMESTAMP_FORMATS:
        try:
            dt = datetime.strptime(raw.strip(), fmt).replace(tzinfo=timezone.utc)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue
    return raw  # fallback: return as-is if no format matches


def parse_kml(kml_text: str) -> tuple[list[TrackPoint], list[Message]]:
    """Parse a Garmin inReach KML feed and return track points and messages."""
    root = ET.fromstring(kml_text)
    track_points = []
    messages = []

    for placemark in root.iter(f"{KML_NS}Placemark"):
        ext_data = _get_extended_data(placemark)
        lon, lat, elevation = _parse_coordinates(placemark)

        if lat is None or lon is None:
            continue

        raw_ts = ext_data.get("Time UTC", ext_data.get("timeUTC", ""))
        if not raw_ts:
            when = placemark.find(f".//{KML_NS}TimeStamp/{KML_NS}when")
            if when is not None and when.text:
                raw_ts = when.text.strip()

        if not raw_ts:
            continue

        timestamp = _normalize_timestamp(raw_ts)

        # Determine if this is a user check-in message or a track point.
        # Garmin event types observed in the wild:
        #   "Tracking interval received." / "Tracking message received." = GPS positions
        #   "Msg to shared map received" = user message sent to MapShare
        #   "Text Message to MapShare received." = user text message
        #   "Quick Text to MapShare received" = preset quick-text sent to MapShare
        #   "Preset Message sent." / "Check-in sent." = user check-ins
        # "Tracking message received." contains "message" but is NOT a user message -
        # it's a GPS position sent via Iridium message. Exclude it explicitly.
        event_type = ext_data.get("Event", "").lower()
        is_tracking = "tracking" in event_type
        is_message = (
            not is_tracking
            and ("message" in event_type or "msg" in event_type
                 or "checkin" in event_type or "check-in" in event_type
                 or "quick text" in event_type)
        )

        # Also check for user-typed text in the Text extended data field
        user_text = ext_data.get("Text", "").strip()
        desc_el = placemark.find(f"{KML_NS}description")
        description = desc_el.text.strip() if desc_el is not None and desc_el.text else ""

        # Use Text field if available (preferred), fall back to description
        message_text = user_text or description

        if is_message and message_text:
            messages.append(Message(
                text=message_text,
                lat=lat,
                lon=lon,
                timestamp=timestamp,
            ))
        else:
            speed = None
            heading = None
            speed_str = ext_data.get("Velocity", ext_data.get("speed", ""))
            if speed_str:
                try:
                    # Garmin reports speed in km/h, convert to knots
                    speed_kmh = float(speed_str.replace(" km/h", "").strip())
                    speed = speed_kmh * 0.539957
                except ValueError:
                    pass

            heading_str = ext_data.get("Course", ext_data.get("heading", ""))
            if heading_str:
                try:
                    # Garmin format: "0.00 ° True" - strip unit and reference
                    cleaned = heading_str.replace("°", "").replace("True", "").replace("Magnetic", "").strip()
                    heading = float(cleaned)
                except ValueError:
                    pass

            track_points.append(TrackPoint(
                lat=lat,
                lon=lon,
                speed=speed,
                heading=heading,
                elevation=elevation,
                timestamp=timestamp,
            ))

    return track_points, messages
