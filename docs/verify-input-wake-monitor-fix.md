# Verify input-wake-monitor debounce fix

**Created**: 2026-04-23 after shipping commit `d0685ee`.
**Run this**: Saturday 2026-04-25 morning (or later) - after the first post-fix night cycle at 2026-04-24 22:00.

## How to use

Paste the "Verification prompt" section below into a Claude Code session with the Pi on the LAN. Claude will SSH to the Pi, pull metrics, compare against baseline, and produce a report.

---

## Context

- Commit `d0685ee` shipped 2026-04-23 ~22:49 CEST to `/home/pi/.local/bin/input-wake-monitor.sh`.
- Bug: ILITEK touchscreen (USB 222a:0001 on usb 3-1) is powered via the monitor's USB hub. When `display-off.timer` fires at 22:00 and runs `wlopm --off HDMI-A-1`, the touchscreen re-enumerates, emitting phantom libinput events. Old script fired `wake_display` ~950x/min with ~10 forks per call, driving load to 6+.
- Fix: 2s debounce via `$EPOCHSECONDS`, idempotent skip when display already on, `[[ =~ ]]` instead of `echo|grep`, dropped `logger` fork, explicit `return 1` on libinput crash so systemd restarts it.
- Baseline storm (2026-04-23 22:01-22:08, pre-fix): load 6.02, CPU 59.2%, temp 62.25 C, 1,684 "Input detected" lines.
- Verification window: **2026-04-24 22:00-22:10 CEST** (first full post-fix night cycle).

## Verification prompt (paste into Claude Code)

```
Verify commit d0685ee stopped the nightly CPU fork-storm on the Pi.
See /Users/siva/pyrepos/siva-personal/pi-setup/docs/verify-input-wake-monitor-fix.md for full context.

Run these five checks against the 2026-04-24 22:00-22:10 CEST window and report PASS/PARTIAL/FAIL:

1. ssh pi@pi "sudo journalctl --since '2026-04-24 22:00:00' --until '2026-04-24 22:10:00' --no-pager | grep -c 'Input detected'"
   Expect: < 50. Baseline was 1684.

2. ssh pi@pi "docker exec influxdb influx -database homeassistant -execute \"SELECT time, cpu_percent, load_1m, cpu_temp FROM system_metrics WHERE time >= '2026-04-24T20:00:00Z' AND time <= '2026-04-24T20:10:00Z' ORDER BY time ASC\" -format csv"
   Expect: peak load < 1.0, CPU < 15%, temp < 55 C. Baseline peaks: load 6.02, CPU 59.2%, temp 62.25 C.

3. ssh pi@pi "systemctl --user show input-wake-monitor.service -p CPUUsageNSec,NRestarts,MainPID,Tasks"
   Expect: NRestarts=0 or 1.

4. ssh pi@pi "sudo journalctl -k --since '2026-04-24 22:00:00' --until '2026-04-24 22:10:00' --no-pager | grep -E 'usb 3-1|ILITEK'"
   Expect: USB disconnect/reconnect still present - this is hardware, fix is software-only.

5. ssh pi@pi "md5sum /home/pi/.local/bin/input-wake-monitor.sh"
   Expect: a2d0cd4fe4c0a0605ca54bb0ab1b8452

## Pass/fail rubric
- PASS: check 1 < 50 AND check 2 peaks load < 1.0 / CPU < 15% / temp < 55 C AND check 3 restarts <= 1.
- PARTIAL: check 1 is 50-200 or load 1-2. Try tightening DEBOUNCE_SEC from 2 to 5.
- FAIL: check 1 > 200 or load > 2. Dump journal for the window and propose a new patch.

## Deliverable
- Short markdown report (< 300 words): verdict, numbers table (baseline vs measured), USB pattern yes/no, recommended next step.
- If PASS, flag the physical follow-up: move the touchscreen USB off the monitor's hub to a powered hub or direct Pi port. That eliminates the symptom at the hardware layer.
- If PARTIAL/FAIL, propose a concrete next patch.
- Save the report to docs/reports/input-wake-monitor-verification-2026-04-25.md and commit to main.
```
