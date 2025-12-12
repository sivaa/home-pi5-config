# 🔧 Hardware Setup

> Getting started with the physical components of your smart home system.

```
                    HARDWARE OVERVIEW
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │     ┌─────────────┐         ┌──────────────────┐   │
    │     │   Pi 3B+    │─────USB─│  Sonoff Dongle   │   │
    │     │  (DietPi)   │         │   (Zigbee Hub)   │   │
    │     └──────┬──────┘         └────────┬─────────┘   │
    │            │                         │             │
    │        Ethernet                  2.4 GHz          │
    │            │                    Zigbee Mesh        │
    │            │                         │             │
    │     ┌──────┴──────┐          ┌───────┴────────┐   │
    │     │   Router    │          │  Smart Devices │   │
    │     └─────────────┘          └────────────────┘   │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 📦 Required Hardware

| Component | Model | Purpose | Est. Cost |
|-----------|-------|---------|-----------|
| **Single Board Computer** | Raspberry Pi 3B+ | Main controller | ~$35 |
| **Zigbee Coordinator** | Sonoff ZBDongle-E (EFR32MG21) | USB Zigbee adapter | ~$20 |
| **Storage** | 16GB+ MicroSD Card | DietPi OS | ~$10 |
| **Power Supply** | 5V 2.5A USB Power | Pi power | ~$10 |
| **Ethernet Cable** | Cat5e or better | Network connection | ~$5 |

### 🔌 Smart Devices (Starter Kit)

| Device | Model | Purpose |
|--------|-------|---------|
| **Smart Light** | IKEA FLOALT Panel (L1528) | Study lamp |
| **Remote Control** | IKEA TRADFRI Remote (E1524/E1810) | Physical control |
| **Temp/Humidity Sensor** | Sonoff SNZB-02P | Environment monitoring |

---

## 🍓 Why Raspberry Pi 3B+?

```
PRO's                              CON's
────────────────────               ────────────────────
✅ Low power (~5W)                 ⚠️ Only 1GB RAM
✅ Silent operation                ⚠️ Limited processing
✅ Proven reliability              ⚠️ SD card wear
✅ Great community support
✅ Perfect for 24/7 operation
```

> **Note**: The Pi 3B+ handles this stack well with proper optimization.
> See the performance tuning section in [Troubleshooting](./08-troubleshooting.md).

---

## 📡 Why Sonoff ZBDongle-E?

The EFR32MG21 chip is the **recommended coordinator** for Zigbee2MQTT:

```
FEATURE                           VALUE
────────────────────              ────────────────────
Chip                              Silicon Labs EFR32MG21
Protocol                          Zigbee 3.0
Range (indoor)                    ~50m (with router nodes)
Max devices                       100+ (with routers)
Firmware                          Pre-flashed, no setup needed
Price                             ~$20
```

### 🔍 Identifying Your Dongle

```bash
# Check USB device
lsusb | grep -i "10c4\|silicon\|cp210"

# Expected output:
# Bus 001 Device 002: ID 10c4:ea60 Silicon Labs CP210x UART Bridge

# Check serial port
ls -la /dev/ttyUSB0
```

---

## 💻 Initial Pi Setup

### Step 1: Download DietPi

```bash
# Visit: https://dietpi.com/downloads/images/
# Download: DietPi_RPi-ARMv8-Bookworm.img.xz
```

> **Why DietPi?** It's a minimal Debian-based OS optimized for SBCs.
> Uses ~300MB RAM vs ~500MB for Raspberry Pi OS Lite.

### Step 2: Flash to SD Card

```bash
# Using Balena Etcher (GUI) - easiest
# Or via command line:

# macOS
diskutil list                    # Find SD card (e.g., /dev/disk4)
diskutil unmountDisk /dev/disk4
sudo dd if=DietPi.img of=/dev/rdisk4 bs=4m status=progress
sync

# Linux
lsblk                            # Find SD card
sudo dd if=DietPi.img of=/dev/sdX bs=4M status=progress
sync
```

### Step 3: Enable SSH (Headless Setup)

Before ejecting the SD card:

```bash
# Mount the boot partition and create empty file
touch /Volumes/boot/ssh    # macOS
touch /media/$USER/boot/ssh   # Linux
```

### Step 4: First Boot

```bash
# 1. Insert SD card into Pi
# 2. Connect Ethernet cable
# 3. Connect USB Zigbee dongle
# 4. Apply power

# 5. Wait 2-3 minutes, then SSH in:
ssh root@dietpi.local
# Default password: dietpi
```

### Step 5: Initial Configuration

DietPi will prompt you through:

```
┌───────────────────────────────────────────────────┐
│            DietPi First Run Setup                 │
├───────────────────────────────────────────────────┤
│  1. Change Software Password  ← SET THIS!         │
│  2. Change Unix Password      ← SET THIS!         │
│  3. Serial Console: Disabled  ← OK                │
│  4. Install Software          ← Skip for now      │
└───────────────────────────────────────────────────┘
```

---

## 🐳 Install Docker

```bash
# Update system first
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

Expected output:
```
Docker version 24.0.x
Docker Compose version v2.x.x
```

---

## 🔌 Verify Zigbee Dongle

```bash
# Check USB is detected
lsusb

# Check serial port exists
ls -la /dev/ttyUSB*

# Check permissions
groups root | grep dialout
```

If `/dev/ttyUSB0` doesn't appear:
```bash
# Try different USB port
# Check dmesg for errors
dmesg | grep -i usb | tail -20
```

---

## 🌐 Network Configuration

### Set Static IP (Optional but Recommended)

```bash
# Edit network configuration
nano /etc/network/interfaces

# Add:
auto eth0
iface eth0 inet static
    address 192.168.1.100
    netmask 255.255.255.0
    gateway 192.168.1.1
    dns-nameservers 8.8.8.8 1.1.1.1
```

### Set Hostname

```bash
# DietPi default is 'dietpi'
# Change if desired:
hostnamectl set-hostname your-name
```

---

## ✅ Hardware Checklist

Before proceeding to Docker setup:

- [ ] Pi boots successfully
- [ ] SSH access works (`ssh root@dietpi.local`)
- [ ] Zigbee dongle detected (`ls /dev/ttyUSB0`)
- [ ] Docker installed (`docker --version`)
- [ ] Docker Compose installed (`docker compose version`)
- [ ] Network connectivity verified (`ping google.com`)

---

## 🔗 Next Steps

Your hardware is ready! Continue to:
→ [Docker Services Setup](./02-docker-services.md)

---

*Last updated: December 2025*
