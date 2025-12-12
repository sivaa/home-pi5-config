# SD Card as Extra Storage

> **Date Configured:** December 12, 2025
> **Prerequisite:** NVMe boot must be configured first (see `01-nvme-boot-setup.md`)

---

## The Story

After migrating boot to NVMe, the SD card was no longer needed for booting. Instead of
removing it, we repurposed it as extra storage - giving us an additional 111GB of space
for backups, media, or less frequently accessed data.

---

## Before & After

```
╔═══════════════════════════════════════════════════════════════╗
║                         BEFORE                                ║
╠═══════════════════════════════════════════════════════════════╣
║  mmcblk0                                                      ║
║  ├── mmcblk0p1 (512MB)  → /boot/firmware  [FAT32]             ║
║  └── mmcblk0p2 (118GB)  → /               [ext4]              ║
╚═══════════════════════════════════════════════════════════════╝

                            ↓ Reformatted ↓

╔═══════════════════════════════════════════════════════════════╗
║                         AFTER                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  mmcblk0                                                      ║
║  └── mmcblk0p1 (119GB)  → /mnt/storage    [ext4]              ║
║                           Label: "storage"                    ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Step-by-Step Procedure

### Step 1: Unmount SD Card Partitions

The SD card may auto-mount after reboot. First, unmount all partitions:

```bash
sudo umount /media/pi/bootfs 2>/dev/null
sudo umount /dev/mmcblk0p1 2>/dev/null
sudo umount /dev/mmcblk0p2 2>/dev/null
```

### Step 2: Repartition as Single Partition

We wiped the old partition table and created a single partition using all space:

```bash
# Create new GPT partition table (erases everything!)
sudo parted /dev/mmcblk0 --script mklabel gpt

# Create single partition using all space
sudo parted /dev/mmcblk0 --script mkpart primary ext4 1MiB 100%
```

**Result:**
```
Number  Start   End    Size   File system  Name     Flags
 1      1049kB  128GB  128GB               primary
```

### Step 3: Format with ext4

```bash
sudo mkfs.ext4 -L storage /dev/mmcblk0p1
```

**Important:** The `-L storage` flag sets the volume label, which we use for mounting.

### Step 4: Create Mount Point and Mount

```bash
# Create mount point
sudo mkdir -p /mnt/storage

# Mount the partition
sudo mount /dev/mmcblk0p1 /mnt/storage

# Set ownership to pi user
sudo chown pi:pi /mnt/storage
```

### Step 5: Add to fstab for Persistent Mount

Add this line to `/etc/fstab`:

```bash
echo 'LABEL=storage  /mnt/storage  ext4  defaults,noatime  0  2' | sudo tee -a /etc/fstab
```

**Why use LABEL instead of UUID?**
- Easier to read and understand
- Works even if SD card is replaced (just label it "storage")
- More human-friendly for documentation

---

## Verification

Check the mount is working:

```bash
df -h /mnt/storage
```

**Expected Output:**
```
Filesystem      Size  Used Avail Use% Mounted on
/dev/mmcblk0p1  117G  2.1M  111G   1% /mnt/storage
```

Check fstab entry:

```bash
cat /etc/fstab | grep storage
```

**Expected:**
```
LABEL=storage  /mnt/storage  ext4  defaults,noatime  0  2
```

---

## Current Storage Layout

```
┌─────────────────────────────────────────────────────────────┐
│                   COMPLETE STORAGE MAP                      │
├─────────────────────────────────────────────────────────────┤
│  NVMe Drive (nvme0n1) - 476.9GB                             │
│  ├── nvme0n1p1  512MB   /boot/firmware   [FAT32]            │
│  └── nvme0n1p2  476GB   /                [ext4]  438G free  │
├─────────────────────────────────────────────────────────────┤
│  SD Card (mmcblk0) - 119.1GB                                │
│  └── mmcblk0p1  119GB   /mnt/storage     [ext4]  111G free  │
├─────────────────────────────────────────────────────────────┤
│  Virtual                                                    │
│  └── zram0      2GB     [SWAP]           compressed RAM     │
├─────────────────────────────────────────────────────────────┤
│  TOTAL AVAILABLE: ~549GB                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Use Cases for /mnt/storage

| Use Case | Why SD Card? |
|----------|--------------|
| **Backups** | If NVMe fails, backups survive |
| **Media files** | Large files, not speed-critical |
| **Log archives** | Old logs, not frequently accessed |
| **Docker volumes** | Secondary storage for containers |
| **Swap overflow** | Emergency swap space |

---

## Suggested Directory Structure

```bash
/mnt/storage/
├── backups/        # System and data backups
├── media/          # Videos, music, photos
├── archives/       # Old logs, compressed data
├── docker/         # Docker volumes (if needed)
└── scratch/        # Temporary large files
```

Create it with:

```bash
mkdir -p /mnt/storage/{backups,media,archives,docker,scratch}
```

---

## Disaster Recovery

### If SD Card Dies

1. Get a new SD card (any size 16GB+)
2. Partition and format:
   ```bash
   sudo parted /dev/mmcblk0 --script mklabel gpt
   sudo parted /dev/mmcblk0 --script mkpart primary ext4 1MiB 100%
   sudo mkfs.ext4 -L storage /dev/mmcblk0p1
   ```
3. Mount will auto-happen on next boot (fstab uses LABEL)

### If Mount Fails on Boot

The `0 2` at the end of fstab means non-critical mount. Boot will continue even if
the SD card is missing. Check with:

```bash
sudo mount -a        # Try mounting all fstab entries
journalctl -b | grep storage  # Check for errors
```

---

## Performance Notes

SD card is slower than NVMe. Keep performance-critical data on NVMe (`/`):

| Operation | NVMe | SD Card |
|-----------|------|---------|
| Sequential Read | ~3500 MB/s | ~45 MB/s |
| Sequential Write | ~3000 MB/s | ~25 MB/s |
| Random IOPS | ~500,000 | ~5,000 |

**Rule of thumb:** Anything accessed frequently → NVMe. Archives/backups → SD Card.
