# Project: Raspberry Pi 5 Setup & Configuration

## Purpose

This repository documents the complete setup of a Raspberry Pi 5, designed for **disaster recovery**.
If the Pi dies, we should be able to rebuild it exactly as it was using this documentation.

---

## Core Principles

1. **Document Everything**
   - WHY we made each change
   - HOW we made it (exact commands)
   - WHAT the result looks like (verification)

2. **Backup All Configs**
   - Store copies of critical config files in `backups/configs/`
   - Update backups after every change

3. **Honest Documentation**
   - No assumptions - only document what was actually done
   - Include error messages and troubleshooting steps
   - Evidence-based: show actual outputs, not expected outputs

4. **Organized Structure**
   - Each topic gets its own numbered doc in `docs/`
   - Main README.md serves as the index
   - Update CLAUDE.md after significant changes

---

## Project Structure

```
pi-setup/
├── README.md           # Main index and quick reference
├── CLAUDE.md           # This file - AI instructions
├── docs/               # Detailed documentation
│   ├── 01-*.md         # Numbered for reading order
│   └── ...
└── backups/
    └── configs/        # Backed up Pi config files
```

---

## Current Pi Configuration

- **Device:** Raspberry Pi 5 Model B Rev 1.1
- **OS:** Debian GNU/Linux 13 (trixie)
- **Access:** `ssh pi@pi`
- **Boot:** NVMe primary (BOOT_ORDER=0xf416)
- **Storage:**
  - NVMe: `/` and `/boot/firmware`
  - SD Card: `/mnt/storage` (extra storage)

---

## When Making Changes

1. **Before:** Read relevant existing docs
2. **During:** Note exact commands and outputs
3. **After:**
   - Backup changed config files to `backups/configs/`
   - Document in appropriate `docs/*.md` file
   - Update README.md index if new doc created
   - Update this CLAUDE.md if project structure changes

---

## Recovery Philosophy

> *"We are preparing for the worst day and we need to recover and get it up exactly the same as before."*

All documentation should enable complete system restoration from scratch.
