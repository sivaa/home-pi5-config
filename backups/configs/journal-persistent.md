# Persistent Journaling Configuration

> **Purpose:** Enable systemd-journald to persist logs across reboots
> **Date Configured:** December 13, 2025
> **Pi Location:** `/etc/systemd/journald.conf.d/persistent.conf`

---

## How It Works

By default, systemd-journald stores logs only in `/run/log/journal/` (tmpfs), which is lost on reboot.

We configure it to use `/var/log/journal/` for persistent storage with an explicit config.

---

## Configuration File

**File:** `/etc/systemd/journald.conf.d/persistent.conf`
```ini
[Journal]
Storage=persistent
```

---

## Setup Commands

```bash
# Create the config directory and file
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/persistent.conf << 'EOF'
[Journal]
Storage=persistent
EOF

# Create the journal directory with machine-id subdirectory
sudo mkdir -p /var/log/journal/$(cat /etc/machine-id)
sudo chown root:systemd-journal /var/log/journal/$(cat /etc/machine-id)
sudo chmod 2755 /var/log/journal
sudo chmod 2755 /var/log/journal/$(cat /etc/machine-id)

# Restart journald and flush runtime logs to persistent
sudo systemctl restart systemd-journald
sudo journalctl --flush
```

---

## Verification

```bash
# Check disk usage (should show persistent storage)
journalctl --disk-usage

# Check journal file location (should be /var/log/journal/...)
journalctl --header | grep 'File path'

# List boots (should show multiple after reboots)
journalctl --list-boots

# View logs from previous boot
journalctl --boot=-1
```

---

## Why This Matters

When debugging WiFi dropouts or crashes:
- **Before:** Logs lost after power cycle, no evidence to investigate
- **After:** Full logs preserved, can analyze what happened before the issue

---

## Disaster Recovery

If rebuilding the Pi from scratch, run the full setup commands above to restore persistent journaling.
