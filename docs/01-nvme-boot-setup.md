# NVMe Boot Setup for Raspberry Pi 5

> **Date Configured:** December 12, 2025
> **Device:** Raspberry Pi 5 Model B Rev 1.1
> **OS:** Debian GNU/Linux 13 (trixie)

---

## The Story

We wanted to boot the Raspberry Pi 5 from a faster NVMe drive instead of the slower SD card.
NVMe provides significantly better I/O performance, which is crucial for tasks like running
databases, containers, or any I/O-intensive workloads.

---

## Hardware Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    HARDWARE INVENTORY                       │
├─────────────────────────────────────────────────────────────┤
│  Device:     Raspberry Pi 5 Model B Rev 1.1                 │
│  RAM:        8GB (based on zram swap size)                  │
│  NVMe:       BIWIN CE430T5D100-512G (476.9GB)               │
│  SD Card:    SN128 (119.1GB) - now used as extra storage    │
└─────────────────────────────────────────────────────────────┘
```

---

## Why NVMe Boot?

| Aspect | SD Card | NVMe |
|--------|---------|------|
| **Read Speed** | ~45 MB/s | ~3500 MB/s |
| **Write Speed** | ~25 MB/s | ~3000 MB/s |
| **IOPS** | ~5,000 | ~500,000 |
| **Durability** | Lower (flash wear) | Higher |
| **Best For** | Portable/backup | Daily use |

---

## Step-by-Step Procedure

### Step 1: Verify NVMe Detection

First, we confirmed the NVMe drive was detected:

```bash
ssh pi@pi "lsblk"
```

**Expected Output:**
```
nvme0n1     259:0    0 476.9G  0 disk    # NVMe detected!
mmcblk0     179:0    0 119.1G  0 disk    # SD card (current boot)
```

### Step 2: Check Current Boot Configuration

```bash
ssh pi@pi "sudo rpi-eeprom-config"
```

**Original Configuration:**
```
BOOT_ORDER=0xf461   # SD → NVMe → USB → Restart
```

### Step 3: Partition the NVMe Drive

We created two partitions:
- **Boot partition** (512MB, FAT32) - for firmware/kernel
- **Root partition** (remaining space, ext4) - for the filesystem

```bash
# Create GPT partition table
sudo parted /dev/nvme0n1 --script mklabel gpt

# Create boot partition (512MB)
sudo parted /dev/nvme0n1 --script mkpart primary fat32 1MiB 513MiB

# Create root partition (rest of drive)
sudo parted /dev/nvme0n1 --script mkpart primary ext4 513MiB 100%

# Set boot flag
sudo parted /dev/nvme0n1 --script set 1 boot on
```

**Result:**
```
Number  Start   End    Size   File system  Name     Flags
 1      1049kB  538MB  537MB               primary  boot, esp
 2      538MB   512GB  512GB               primary
```

### Step 4: Format the Partitions

```bash
# Format boot partition as FAT32
sudo mkfs.vfat -F 32 -n BOOT /dev/nvme0n1p1

# Format root partition as ext4
sudo mkfs.ext4 -L rootfs /dev/nvme0n1p2
```

### Step 5: Mount and Copy Filesystems

```bash
# Create mount points
sudo mkdir -p /mnt/nvme_boot /mnt/nvme_root

# Mount NVMe partitions
sudo mount /dev/nvme0n1p1 /mnt/nvme_boot
sudo mount /dev/nvme0n1p2 /mnt/nvme_root

# Copy boot partition
sudo rsync -axv /boot/firmware/ /mnt/nvme_boot/

# Copy root filesystem (excluding virtual filesystems)
sudo rsync -axv \
  --exclude='/mnt/*' \
  --exclude='/tmp/*' \
  --exclude='/proc/*' \
  --exclude='/sys/*' \
  --exclude='/dev/*' \
  --exclude='/run/*' \
  / /mnt/nvme_root/
```

**Data Copied:**
- Boot: ~86MB
- Root: ~6.9GB

### Step 6: Get NVMe Partition UUIDs

```bash
sudo blkid /dev/nvme0n1p1 /dev/nvme0n1p2
```

**Our UUIDs:**
```
/dev/nvme0n1p1: PARTUUID="d54ea4ea-52b0-4f42-bcb6-fa63c91c645b"  # Boot
/dev/nvme0n1p2: PARTUUID="356b6b75-2d93-4b9f-af42-43ca7ceb2737"  # Root
```

### Step 7: Update Boot Configuration on NVMe

**Update cmdline.txt:**
```bash
# Change root partition to NVMe
sudo sed -i 's/PARTUUID=8362df2c-02/PARTUUID=356b6b75-2d93-4b9f-af42-43ca7ceb2737/' \
  /mnt/nvme_boot/cmdline.txt
```

**Update fstab on NVMe root:**
```bash
# Update boot partition UUID
sudo sed -i 's/PARTUUID=8362df2c-01/PARTUUID=d54ea4ea-52b0-4f42-bcb6-fa63c91c645b/' \
  /mnt/nvme_root/etc/fstab

# Update root partition UUID
sudo sed -i 's/PARTUUID=8362df2c-02/PARTUUID=356b6b75-2d93-4b9f-af42-43ca7ceb2737/' \
  /mnt/nvme_root/etc/fstab
```

### Step 8: Update EEPROM Boot Order

Change boot priority to try NVMe first:

```bash
echo 'BOOT_ORDER=0xf416' | sudo tee /tmp/boot.conf
sudo rpi-eeprom-config --apply /tmp/boot.conf
```

**Boot Order Codes:**
- `1` = SD Card
- `4` = USB Mass Storage
- `6` = NVMe
- `f` = Restart

**New Order: `0xf416`** = NVMe → SD → USB → Restart

### Step 9: Cleanup and Reboot

```bash
# Unmount
sudo umount /mnt/nvme_boot /mnt/nvme_root
sudo rmdir /mnt/nvme_boot /mnt/nvme_root

# Reboot to NVMe
sudo reboot
```

---

## Verification

After reboot, verify NVMe boot:

```bash
# Check root filesystem
findmnt /
```

**Expected:**
```
TARGET SOURCE         FSTYPE OPTIONS
/      /dev/nvme0n1p2 ext4   rw,noatime
```

```bash
# Check EEPROM config
sudo rpi-eeprom-config | grep BOOT_ORDER
```

**Expected:**
```
BOOT_ORDER=0xf416
```

---

## Current Configuration Files

### /boot/firmware/cmdline.txt
```
console=serial0,115200 console=tty1 root=PARTUUID=356b6b75-2d93-4b9f-af42-43ca7ceb2737 rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles cfg80211.ieee80211_regdom=DE
```

### /etc/fstab
```
proc            /proc           proc    defaults          0       0
PARTUUID=d54ea4ea-52b0-4f42-bcb6-fa63c91c645b  /boot/firmware  vfat    defaults          0       2
PARTUUID=356b6b75-2d93-4b9f-af42-43ca7ceb2737  /               ext4    defaults,noatime  0       1
LABEL=storage  /mnt/storage  ext4  defaults,noatime  0  2
```

---

## Disaster Recovery

### If NVMe Fails - Boot from SD Card

1. Remove the NVMe or change boot order:
   ```bash
   # From another machine or serial console
   sudo rpi-eeprom-config --edit
   # Change BOOT_ORDER to 0xf461 (SD first)
   ```

2. Or use Raspberry Pi Imager to create a recovery SD card

### Restore EEPROM to Default

If EEPROM is corrupted:
1. Download Raspberry Pi Imager
2. Choose "Misc utility images" → "Bootloader" → "Reset bootloader to defaults"
3. Flash to SD card and boot

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pi doesn't boot | Check UART output, verify PARTUUIDs match |
| Wrong root mounted | Verify cmdline.txt has correct PARTUUID |
| EEPROM update failed | Use Pi Imager to reset bootloader |
| NVMe not detected | Check NVMe HAT connection, try reseating |

---

## References

- [Raspberry Pi NVMe Boot Documentation](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#nvme-ssd-boot)
- [EEPROM Boot Order](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#BOOT_ORDER)
