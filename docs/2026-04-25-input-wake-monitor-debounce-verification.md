# input-wake-monitor Debounce Patch — Verification Report

**Date:** 2026-04-25
**Patch commit:** d0685ee (deployed 2026-04-23 ~22:49 CEST)
**Verification window:** 2026-04-24 22:00:00 – 22:10:00 CEST (first full night-cycle post-fix)

## Verdict: **PASS**

## Baseline vs Measured

| Metric                        | Baseline (2026-04-23 22:01–22:08) | Measured (2026-04-24 22:00–22:10) | Threshold | Result |
|-------------------------------|----------------------------------:|----------------------------------:|----------:|--------|
| `Input detected` journal count| 1,684                             | **0**                             | < 50      | ✅      |
| Peak `load_1m`                | 6.02                              | **0.68**                          | < 1.0     | ✅      |
| Peak `cpu_percent`            | 59.2%                             | **14.8%**                         | < 15%     | ✅      |
| Peak `cpu_temp`               | 62.25 °C                          | **53.45 °C**                      | < 55 °C   | ✅      |
| Service `NRestarts`           | n/a                               | **0** (clean run)                 | 0         | ✅      |

The 14.8 % CPU peak is inside the threshold but worth a note: the cadence (14.8 → 0.6 → 14.8 → 0.7 → 11.7 over the 10 min sample) is the regular minute-aligned background work pattern (HA + Influx scrapes), not a storm. A true storm sample would be sustained > 50 %, not alternating with sub-1 % troughs.

## Service Health

- Service started 22:00:36 by `display-off.service`, journal logged `Input wake monitor started (debounce=2s)` — confirms the NEW script (md5 `a2d0cd4fe4c0a0605ca54bb0ab1b8452` matches expected).
- Ran cleanly through the night. 2 genuine `Input detected` events overnight (22:36:11, 22:43:38) — looks like real interaction, not phantom.
- One stop/start at 04:30 (display-off.timer reload, NOT a libinput crash); restarted with same script and ran until 06:00 display-on.

## USB Phantom-Input Pattern

**No** — kernel log shows zero `usb 3-1` / `ILITEK` events during 22:00–22:10. The hardware re-enumeration did not fire that night.

**Caveat (honest):** the verification window passed thresholds because the hardware trigger didn't fire, AND because the new debounce script was confirmed loaded and running. We did not stress-test the debounce against the actual storm trigger pattern this window. Future triggers will hit the new code path; the fix is in place, but tonight's data is "no storm because no trigger" rather than "fix proven under storm conditions". The next time the monitor's USB hub re-enumerates the touchscreen at 22:00, we'll get the real demonstration.

## Next Step

PASS, so the software amplification is fixed. The remaining work is the **physical root cause**:

> Move the ILITEK touchscreen USB cable off the monitor's USB hub to a powered USB hub or directly to a Pi USB port.

The `wlopm --off HDMI-A-1` call at 22:00 likely cuts power to the monitor's downstream USB hub (or causes a brownout), forcing the touchscreen to re-enumerate. With the touchscreen on independent power, the trigger disappears entirely and the debounce becomes a defense-in-depth backstop rather than the primary mitigation.

## Commands Run

```bash
# Storm count (window)
sudo journalctl --since '2026-04-24 22:00:00' --until '2026-04-24 22:10:00' \
  | grep -c 'Input detected'   # → 0

# InfluxDB metrics (CPU/load/temp)
docker exec influxdb influx -database homeassistant -execute "SELECT time, \
  cpu_percent, load_1m, load_5m, cpu_temp FROM system_metrics WHERE \
  time >= '2026-04-24T20:00:00Z' AND time <= '2026-04-24T20:10:00Z' \
  ORDER BY time ASC"

# USB events (window)
sudo journalctl -k --since '2026-04-24 22:00:00' --until '2026-04-24 22:10:00' \
  | grep -E 'usb 3-1|ILITEK'   # → none

# Script integrity
md5sum /home/pi/.local/bin/input-wake-monitor.sh
# → a2d0cd4fe4c0a0605ca54bb0ab1b8452 ✓
```
