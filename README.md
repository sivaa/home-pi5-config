# Raspberry Pi 5 Setup Documentation

> **Last Updated:** December 12, 2025
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
└─────────────────────────────────────────────────────────────┘
```

---

## Documentation Index

| # | Document | Description |
|---|----------|-------------|
| 1 | [NVMe Boot Setup](docs/01-nvme-boot-setup.md) | How we configured NVMe as primary boot device |
| 2 | [SD Card Storage](docs/02-sd-card-storage.md) | Repurposing SD card as extra storage |

---

## Backup Files

All critical configuration files are backed up in `backups/configs/`:

| File | Description |
|------|-------------|
| `fstab` | Current filesystem mount table |
| `cmdline.txt` | Kernel boot parameters |
| `eeprom-config.txt` | EEPROM/bootloader configuration |
| `disk-info.txt` | Partition layout and UUIDs |
| `system-info.txt` | OS version, hostname, network info |

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
| 2025-12-12 | Initial setup: NVMe boot + SD storage |

---

## Directory Structure

```
pi-setup/
├── README.md              ← You are here (main index)
├── CLAUDE.md              ← Instructions for AI assistants
├── docs/
│   ├── 01-nvme-boot-setup.md
│   └── 02-sd-card-storage.md
└── backups/
    └── configs/
        ├── fstab
        ├── cmdline.txt
        ├── eeprom-config.txt
        ├── disk-info.txt
        └── system-info.txt
```

---

## Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

Every configuration change is documented with:
- **WHY** we made the change
- **HOW** we made it (exact commands)
- **WHAT** the result should look like (verification steps)
- **BACKUP** of the actual config files
