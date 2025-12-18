# Raspberry Pi 5 Setup Documentation

> **Last Updated:** December 17, 2025
> **Purpose:** Complete documentation for disaster recovery and reproducibility

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM OVERVIEW                          │
├─────────────────────────────────────────────────────────────┤
│  Device:      Raspberry Pi 5 Model B Rev 1.1                │
│  OS:          Debian GNU/Linux 13 (trixie)                  │
│  Hostname:    pi                                            │
│  Access:      ssh pi@pi                                     │
├─────────────────────────────────────────────────────────────┤
│  Boot:        NVMe (primary) → SD (fallback)                │
│  EEPROM:      BOOT_ORDER=0xf416                             │
├─────────────────────────────────────────────────────────────┤
│  Storage:                                                   │
│    /              NVMe   438GB available                    │
│    /boot/firmware NVMe   425MB available                    │
│    /mnt/storage   SD     111GB available                    │
│                                                             │
│    TOTAL: ~549GB                                            │
├─────────────────────────────────────────────────────────────┤
│  Hardware:                                                  │
│    Zigbee:  Sonoff 3.0 USB Dongle Plus V2                   │
│    Path:    /dev/serial/by-id/usb-Itead_Sonoff_...          │
├─────────────────────────────────────────────────────────────┤
│  Services (Docker):                                         │
│    Dashboard:     http://pi:8888                            │
│    Home Assistant:http://pi:8123 (ext: ha.sivaa.in)         │
│    Zigbee2MQTT:   http://pi:8080                            │
│    InfluxDB:      http://pi:8086                            │
│    Grafana:       http://pi:3000                            │
│    MQTT Broker:   mqtt://pi:1883 (WS: 9001)                 │
│    Cloudflared:   Tunnel to ha.sivaa.in                     │
├─────────────────────────────────────────────────────────────┤
│  Zigbee Devices: 15 total                                   │
│    Sensors: 9 (6x temp/humidity, 1x CO2, 1x PIR, 1x contact)│
│    Lights:  2 (IKEA FLOALT panels)                          │
│    Remotes: 2 (IKEA TRADFRI)                                │
│    Plugs:   1 (SONOFF smart plug w/ energy monitor)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation Index

| # | Document | Description |
|---|----------|-------------|
| 1 | [NVMe Boot Setup](docs/01-nvme-boot-setup.md) | How we configured NVMe as primary boot device |
| 2 | [SD Card Storage](docs/02-sd-card-storage.md) | Repurposing SD card as extra storage |
| 3 | [Zigbee Dongle](docs/03-zigbee-dongle.md) | Sonoff Zigbee 3.0 USB Dongle Plus V2 setup |
| 4 | [Zigbee2MQTT Setup](docs/04-zigbee2mqtt-setup.md) | Docker-based Zigbee2MQTT + Mosquitto |
| 5 | [Zigbee Devices](docs/05-zigbee-devices.md) | Complete device inventory & pairing guide |
| 6 | [WiFi Troubleshooting](docs/06-wifi-troubleshooting.md) | Metal case WiFi issues & power save fix |
| 7 | [Dashboard & InfluxDB](docs/07-dashboard-influxdb.md) | Custom dashboard InfluxDB integration |
| 8 | [Google Home Integration](docs/08-google-home-integration.md) | Voice control via Google Assistant |
| 9 | [Router Maintenance](docs/09-router-maintenance.md) | Automated daily router reboot to prevent WiFi issues |
| 10 | [Display Scheduling](docs/10-display-scheduling.md) | Auto off at 22:00, on at 06:00, 5-min night idle |
| 11 | [On-Screen Keyboard](docs/11-onscreen-keyboard.md) | Tablet-like touch keyboard (squeekboard) |

---

## Backup Files

### System Configs (`backups/configs/`)

| File | Description |
|------|-------------|
| `fstab` | Current filesystem mount table |
| `cmdline.txt` | Kernel boot parameters |
| `eeprom-config.txt` | EEPROM/bootloader configuration |
| `disk-info.txt` | Partition layout and UUIDs |
| `system-info.txt` | OS version, hostname, network info |
| `zigbee-dongle-info.txt` | Zigbee dongle USB device details |
| `sshd_config` | SSH server configuration (locale fix applied) |
| `wifi-powersave-off.conf` | NetworkManager WiFi power save disable config |

### Service Configs (`configs/`)

| Path | Description | Pi Location |
|------|-------------|-------------|
| `zigbee2mqtt/docker-compose.yml` | All Docker services | `/opt/zigbee2mqtt/` |
| `zigbee2mqtt/configuration.yaml` | Zigbee2MQTT config | `/opt/zigbee2mqtt/data/` |
| `homeassistant/configuration.yaml` | Home Assistant config | `/opt/homeassistant/` |
| `homeassistant/SERVICE_ACCOUNT.json` | GCP credentials (gitignored) | `/opt/homeassistant/` |
| `cloudflared/config.yml` | Cloudflare tunnel config | `/etc/cloudflared/` |
| `display-scheduler/*` | Display power management | `~/.config/systemd/user/` + `~/.local/bin/` |

### Sensitive Files (Not in Git)

| File | Description | How to Recover |
|------|-------------|----------------|
| `SERVICE_ACCOUNT.json` | GCP service account key | Download from GCP Console |
| `cloudflared/*.json` | Tunnel credentials | Run `cloudflared tunnel login` |

---

## Critical UUIDs and Identifiers

Keep these safe - needed for recovery:

### NVMe Partitions
```
/dev/nvme0n1p1 (boot):  PARTUUID=d54ea4ea-52b0-4f42-bcb6-fa63c91c645b
/dev/nvme0n1p2 (root):  PARTUUID=356b6b75-2d93-4b9f-af42-43ca7ceb2737
```

### SD Card Partition
```
/dev/mmcblk0p1 (storage): LABEL=storage
```

---

## Emergency Recovery Procedures

### Scenario 1: Pi Won't Boot (NVMe Issue)

1. **Insert SD card** with Raspberry Pi OS Lite
2. **Edit config.txt** on SD card boot partition:
   ```
   # Add this line to force SD card boot
   boot_order=0x1
   ```
3. **Boot from SD** and investigate NVMe

### Scenario 2: Reset EEPROM to Defaults

1. Download **Raspberry Pi Imager**
2. Choose: `Misc utility images` → `Bootloader` → `SD Card Boot`
3. Flash to SD card
4. Insert SD and power on (LED flashes when done)
5. Remove SD and power cycle

### Scenario 3: Complete Reinstall

1. Flash fresh OS to NVMe using Pi Imager
2. Apply configurations from `backups/configs/`
3. Set boot order:
   ```bash
   echo 'BOOT_ORDER=0xf416' | sudo tee /tmp/boot.conf
   sudo rpi-eeprom-config --apply /tmp/boot.conf
   ```

---

## Current Disk Layout

```
NAME        SIZE   MOUNTPOINT      FSTYPE  LABEL
nvme0n1     477G
├─nvme0n1p1 512M   /boot/firmware  vfat    BOOT
└─nvme0n1p2 476G   /               ext4    rootfs
mmcblk0     119G
└─mmcblk0p1 119G   /mnt/storage    ext4    storage
zram0       2G     [SWAP]
```

---

## Network Access

```bash
# SSH access
ssh pi@pi

# If hostname doesn't resolve, use IP discovery
# Check router DHCP leases or use:
nmap -sn 192.168.1.0/24 | grep -B2 "Raspberry"
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-18 | Enabled on-screen keyboard (squeekboard) for tablet-like touch input |
| 2025-12-17 | Added display scheduler: auto-off 22:00, auto-on 06:00, 5-min night idle |
| 2025-12-17 | Added automated daily router reboot at 4 AM (prevents WiFi degradation) |
| 2025-12-13 | Added CO2 Monitor dashboard view (view #10) with gauge, history chart, ambient mode |
| 2025-12-13 | Fixed dashboard history modal - InfluxDB queries & entity ID mapping |
| 2025-12-12 | Added contact sensor (SNZB-04P) |
| 2025-12-12 | Added PIR motion sensor (SNZB-03P) and smart plug (S60ZBTPF) |
| 2025-12-12 | Fixed WiFi disconnection: disabled power save, documented metal case issue |
| 2025-12-12 | Added NOUS E10 CO2 sensor, created device inventory doc |
| 2025-12-12 | Fixed SSH locale warning (removed LC_* from AcceptEnv) |
| 2025-12-12 | Set up Zigbee2MQTT + Mosquitto via Docker |
| 2025-12-12 | Added Zigbee dongle documentation |
| 2025-12-12 | Initial setup: NVMe boot + SD storage |

---

## Directory Structure

```
pi-setup/
├── README.md              <- You are here (main index)
├── CLAUDE.md              <- Instructions for AI assistants
├── configs/
│   ├── zigbee2mqtt/       <- Source of truth for Pi configs
│   │   ├── docker-compose.yml
│   │   ├── configuration.yaml
│   │   └── mosquitto.conf
│   └── display-scheduler/ <- Display power scheduling
│       ├── display-scheduler.sh
│       ├── display-on.timer
│       ├── display-off.timer
│       └── *.service files
├── docs/
│   ├── 01-nvme-boot-setup.md
│   ├── 02-sd-card-storage.md
│   ├── 03-zigbee-dongle.md
│   ├── 04-zigbee2mqtt-setup.md
│   ├── 05-zigbee-devices.md
│   ├── 06-wifi-troubleshooting.md
│   ├── 07-dashboard-influxdb.md
│   ├── 08-google-home-integration.md
│   ├── 09-router-maintenance.md
│   ├── 10-display-scheduling.md
│   └── 11-onscreen-keyboard.md
├── scripts/                   <- Maintenance scripts
│   ├── router-reboot.sh       <- Daily router reboot (cron 4 AM)
│   └── .env                   <- Router credentials (gitignored)
├── services/                  <- Docker service configs (source of truth)
│   ├── dashboard/             <- Custom smart home dashboard
│   │   ├── www/index.html
│   │   └── nginx/dashboard.conf
│   ├── homeassistant/
│   ├── mosquitto/
│   └── zigbee2mqtt/
└── backups/
    └── configs/
        ├── fstab
        ├── cmdline.txt
        ├── eeprom-config.txt
        ├── disk-info.txt
        ├── system-info.txt
        └── zigbee-dongle-info.txt
```

---

## Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

Every configuration change is documented with:
- **WHY** we made the change
- **HOW** we made it (exact commands)
- **WHAT** the result should look like (verification steps)
- **BACKUP** of the actual config files
