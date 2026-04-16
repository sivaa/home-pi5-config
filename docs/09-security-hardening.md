# Security Hardening Guide

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  🔐 Raspberry Pi 5 Security Hardening                                        ║
║  📅 Implemented: December 19, 2025                                           ║
║  🎯 Status: COMPLETE                                                         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Overview

This Pi was secured after a malware incident caused by SSH port forwarding + default password.

### Attack Vector (What Happened)
```
Internet Bot → Port Forward :22 → Pi SSH → Default Password → Malware
```

### Solution Implemented
```
Tailscale VPN (no ports exposed) + SSH Key-Only + Service Auth + Firewall
```

---

## Current Security Status

| Component | Status | Details |
|-----------|--------|---------|
| SSH | ✅ Hardened | Key-only auth, password disabled, fail2ban |
| Remote Access | ✅ Tailscale | VPN-based, no port forwarding |
| MQTT | ✅ VPN-Only | Anonymous allowed (VPN provides security) |
| Zigbee2MQTT | ✅ VPN-Only | No frontend token (VPN provides security) |
| Home Assistant | ✅ Cloudflare + Auth | External via ha.sivaa.in |
| Firewall | ✅ UFW Active | Local + Tailscale + Docker allowed |

---

## Access Methods

### Remote Access (from anywhere)

**Via Tailscale VPN:**
```
Pi Tailscale IP: 100.84.208.93

ssh pi@100.84.208.93
http://100.84.208.93:8123  (Home Assistant)
http://100.84.208.93:8080  (Zigbee2MQTT - needs token)
http://100.84.208.93:8888  (Dashboard)
```

**Via Cloudflare (Home Assistant only):**
```
https://ha.sivaa.in
```

### Local Access (home network)
```
ssh pi@pi
http://pi:8123
http://pi:8080
http://pi:8888
```

---

## Credentials (Store in Password Manager!)

| Service | Username | Password/Token |
|---------|----------|----------------|
| MQTT | - | No auth (VPN-protected) |
| Zigbee2MQTT Frontend | - | No auth (VPN-protected) |
| Dashboard | (basic auth) | (check .htpasswd) |

---

## What Was Configured

### 1. SSH Hardening

**File:** `/etc/ssh/sshd_config`
```
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
```

**fail2ban:** Installed and monitoring SSH

### 2. Tailscale VPN

- Installed on Pi, Mac, iPhone
- Pi IP: 100.84.208.93
- Auto-starts on boot

### 3. MQTT (VPN-Only Security)

**File:** `/opt/mosquitto/config/mosquitto.conf`
```
# VPN provides network security - no MQTT auth needed
allow_anonymous true
```

**Rationale:** Since all access is via Tailscale VPN or local network (protected by firewall), application-level MQTT authentication adds unnecessary complexity without additional security benefit.

### 4. UFW Firewall

```
Default: deny incoming, allow outgoing
Allow: 192.168.0.0/24 (local network)
Allow: tailscale0 interface
Allow: 172.16.0.0/12 (Docker)
```

---

## Recovery Procedures

### If Locked Out of SSH

1. Physical access: Connect keyboard/monitor to Pi
2. Edit `/etc/ssh/sshd_config`, set `PasswordAuthentication yes`
3. Reboot, fix issue, re-disable password auth

### If Tailscale Not Working

- Local network still works (192.168.0.x)
- Check: `sudo systemctl status tailscaled`
- Restart: `sudo systemctl restart tailscaled`

### If Firewall Blocking Too Much

```bash
sudo ufw disable
# Fix rules
sudo ufw enable
```

---

## Maintenance Checklist

- [ ] Monthly: Check fail2ban status (`sudo fail2ban-client status sshd`)
- [ ] Monthly: Check for Pi OS updates (`sudo apt update && sudo apt upgrade`)
- [ ] Monthly: Check Docker image updates
- [ ] Quarterly: Review Tailscale connected devices
- [ ] Yearly: Review VPN access list

---

## Files Modified

| File | Location | Purpose |
|------|----------|---------|
| sshd_config | `/etc/ssh/` | SSH hardening |
| mosquitto.conf | `/opt/mosquitto/config/` | MQTT auth |
| configuration.yaml | `/opt/zigbee2mqtt/data/` | Z2M MQTT creds + frontend auth |
| configuration.yaml | `/opt/homeassistant/` | HA MQTT creds |
| mqtt-store.js | `/opt/dashboard/www/js/stores/` | Dashboard MQTT creds |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURE ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INTERNET                                                                   │
│     │                                                                       │
│     ├─── Cloudflare Tunnel ──► ha.sivaa.in (Home Assistant only)           │
│     │                                                                       │
│     └─── Tailscale VPN ──────► 100.84.208.93 (All services)                │
│                                                                             │
│  LOCAL NETWORK (192.168.0.x)                                               │
│     │                                                                       │
│     └─── UFW Firewall ───────► Pi Services (authenticated)                │
│                                                                             │
│  ROUTER                                                                     │
│     ├─ UPnP: Should be DISABLED                                            │
│     ├─ Port Forwards: NONE                                                 │
│     └─ Remote Management: DISABLED                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
