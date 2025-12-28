#!/usr/bin/env python3
"""
Cast IP Monitor - Detects Google Cast device IP changes and updates Home Assistant config.
Runs periodically and updates HA's known_hosts when Cast devices get new IPs.
"""
import json
import os
import subprocess
import time
import urllib.request
from datetime import datetime

# Device UUIDs (permanent identifiers)
DEVICES = {
    "ee8aaf6c-5550-7296-d932-36e9cc16255a": "Kitchen Display",
    "3a1930f7-5fb6-b4e6-693e-df51f16effb4": "Broken Display",
    "3ecad949-3512-a3a9-0dda-672859997fc9": "Master Bedroom clock",
}

SCAN_INTERVAL = int(os.environ.get("SCAN_INTERVAL", 300))  # 5 min default
HA_CONFIG = "/ha-config/.storage/core.config_entries"
NETWORK_PREFIX = "192.168.0"


def log(msg):
    print(f"{datetime.now().isoformat()} {msg}", flush=True)


def scan_for_cast_devices():
    """Scan network for Cast devices, return {uuid: ip} mapping."""
    found = {}
    for i in range(1, 255):
        ip = f"{NETWORK_PREFIX}.{i}"
        try:
            req = urllib.request.Request(
                f"http://{ip}:8008/setup/eureka_info",
                headers={"Connection": "close"}
            )
            with urllib.request.urlopen(req, timeout=0.5) as resp:
                data = json.loads(resp.read())
                uuid = data.get("ssdp_udn")
                if uuid and uuid in DEVICES:
                    found[uuid] = ip
                    log(f"Found {DEVICES[uuid]} at {ip}")
        except Exception:
            pass
    return found


def get_current_known_hosts():
    """Read current known_hosts from HA config."""
    try:
        with open(HA_CONFIG) as f:
            data = json.load(f)
        for entry in data.get("data", {}).get("entries", []):
            if entry.get("domain") == "cast":
                return set(entry.get("data", {}).get("known_hosts", []))
    except Exception as e:
        log(f"Error reading config: {e}")
    return set()


def update_known_hosts(new_ips):
    """Update HA config with new IPs."""
    try:
        with open(HA_CONFIG) as f:
            data = json.load(f)

        for entry in data.get("data", {}).get("entries", []):
            if entry.get("domain") == "cast":
                entry["data"]["known_hosts"] = sorted(list(new_ips))
                break

        with open(HA_CONFIG, "w") as f:
            json.dump(data, f, indent=2)

        log(f"Updated known_hosts to: {sorted(list(new_ips))}")
        return True
    except Exception as e:
        log(f"Error updating config: {e}")
        return False


def restart_homeassistant():
    """Restart HA container to apply changes."""
    try:
        subprocess.run(["docker", "restart", "homeassistant"], check=True)
        log("Restarted Home Assistant")
    except Exception as e:
        log(f"Error restarting HA: {e}")


def main():
    log("Cast IP Monitor starting...")
    log(f"Monitoring {len(DEVICES)} devices, scan interval: {SCAN_INTERVAL}s")

    while True:
        try:
            found_devices = scan_for_cast_devices()
            new_ips = set(found_devices.values())
            current_ips = get_current_known_hosts()

            if new_ips and new_ips != current_ips:
                log(f"IP change detected: {current_ips} -> {new_ips}")
                if update_known_hosts(new_ips):
                    restart_homeassistant()
            else:
                log(f"No changes (found {len(found_devices)} devices)")

        except Exception as e:
            log(f"Error in main loop: {e}")

        time.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    main()
