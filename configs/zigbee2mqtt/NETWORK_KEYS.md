# Zigbee Network Recovery Keys

> **CRITICAL:** These keys are needed to restore the Zigbee network after disaster.
> Without them, ALL 35 devices must be re-paired manually!

---

## Quick Reference

| Parameter | Value | Format |
|-----------|-------|--------|
| **Network Key** | `9a0aa1d156264e9ca4b4779a086cf75e` | Hex string |
| **PAN ID** | `6754` | Decimal (0x1A62 hex) |
| **Extended PAN ID** | `dddddddddddddddd` | Hex string |
| **Channel** | `25` | Decimal (2.475 GHz) |
| **Coordinator IEEE** | `0x08b95ffffed8f574` | 64-bit address |

---

## All Key Types Explained

### 1. Network Key (AES-128) - MOST CRITICAL

```
+--------------------------------------------------------------------------+
|  THE NETWORK KEY                                                         |
+--------------------------------------------------------------------------+
|                                                                          |
|  Hex:    9a0aa1d156264e9ca4b4779a086cf75e                               |
|  Bytes:  [154, 10, 161, 209, 86, 38, 78, 156,                           |
|           164, 180, 119, 154, 8, 108, 247, 94]                          |
|  Hex:    [0x9A, 0x0A, 0xA1, 0xD1, 0x56, 0x26, 0x4E, 0x9C,               |
|           0xA4, 0xB4, 0x77, 0x9A, 0x08, 0x6C, 0xF7, 0x5E]               |
|                                                                          |
|  Purpose:                                                                |
|    - 128-bit AES encryption key                                         |
|    - Encrypts ALL Zigbee traffic on the network                         |
|    - Every device stores this key permanently                           |
|    - Shared secret between coordinator and all devices                  |
|                                                                          |
|  If lost/changed:                                                        |
|    X ALL devices become orphaned                                        |
|    X Devices cannot decrypt new messages                                |
|    X Must factory reset and re-pair every device                        |
|                                                                          |
|  Recovery:                                                               |
|    + Set this key in configuration.yaml before starting Z2M             |
|    + Devices will reconnect automatically                               |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 2. PAN ID (Personal Area Network ID)

```
+--------------------------------------------------------------------------+
|  PAN ID                                                                  |
+--------------------------------------------------------------------------+
|                                                                          |
|  Decimal: 6754                                                           |
|  Hex:     0x1A62                                                         |
|                                                                          |
|  Purpose:                                                                |
|    - 16-bit network identifier                                          |
|    - Like a WiFi SSID but numeric                                       |
|    - Devices use this to find "their" network                           |
|    - Multiple Zigbee networks can coexist with different PAN IDs        |
|                                                                          |
|  If lost/changed:                                                        |
|    ! Devices may not find the network initially                         |
|    + Usually auto-recovers when network key matches                     |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 3. Extended PAN ID (64-bit)

```
+--------------------------------------------------------------------------+
|  EXTENDED PAN ID                                                         |
+--------------------------------------------------------------------------+
|                                                                          |
|  Hex:     dddddddddddddddd                                              |
|  Bytes:   [0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD]             |
|  Decimal: [221, 221, 221, 221, 221, 221, 221, 221]                      |
|                                                                          |
|  Purpose:                                                                |
|    - 64-bit extended network identifier                                 |
|    - More unique than 16-bit PAN ID                                     |
|    - Used for network discovery and identification                      |
|                                                                          |
|  Note: "dddddddddddddddd" is the default Z2M value                      |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 4. Channel

```
+--------------------------------------------------------------------------+
|  RADIO CHANNEL                                                           |
+--------------------------------------------------------------------------+
|                                                                          |
|  Channel:   25                                                           |
|  Frequency: 2.475 GHz (2.4GHz band)                                     |
|  Range:     11-26 for Zigbee                                            |
|                                                                          |
|  Purpose:                                                                |
|    - Radio frequency for all Zigbee communication                       |
|    - All devices must be on same channel                                |
|    - Channel 25 chosen to avoid WiFi interference                       |
|                                                                          |
|  WiFi Overlap:                                                           |
|    - Zigbee 25 overlaps with WiFi channels 11-13                        |
|    - Generally safe if WiFi is on channel 1 or 6                        |
|                                                                          |
|  If changed:                                                             |
|    X Devices cannot hear coordinator                                    |
|    X Network appears "dead"                                             |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 5. Coordinator IEEE Address

```
+--------------------------------------------------------------------------+
|  COORDINATOR IEEE ADDRESS                                                |
+--------------------------------------------------------------------------+
|                                                                          |
|  Address:       0x08b95ffffed8f574                                      |
|  Byte-reversed: 74f5d8feff5fb908 (as stored in backup files)            |
|  Device:        Sonoff Zigbee 3.0 USB Dongle Plus V2                    |
|  Chip:          Silicon Labs EFR32MG21                                  |
|                                                                          |
|  Purpose:                                                                |
|    - Hardware MAC address of the USB dongle                             |
|    - Unique identifier for the coordinator                              |
|    - Devices use this to identify the trust center                      |
|                                                                          |
|  Note:                                                                   |
|    - This is FIXED per physical dongle                                  |
|    - If dongle is replaced, this changes                                |
|    - New dongle = new coordinator = may need re-pairing                 |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 6. Security Level

```
+--------------------------------------------------------------------------+
|  SECURITY LEVEL                                                          |
+--------------------------------------------------------------------------+
|                                                                          |
|  Level: 5                                                                |
|  Mode:  AES-128-CCM with 32-bit MIC                                     |
|                                                                          |
|  Purpose:                                                                |
|    - Defines encryption and authentication strength                     |
|    - Level 5 = Encrypted + 32-bit Message Integrity Code               |
|    - Standard for all Zigbee 3.0 networks                              |
|                                                                          |
|  Security Levels:                                                        |
|    0 = No security                                                      |
|    1 = MIC-32 only (no encryption)                                      |
|    5 = AES-128 encryption + MIC-32 (standard)                          |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 7. Hashed Trust Center Link Key (TCLK)

```
+--------------------------------------------------------------------------+
|  HASHED TRUST CENTER LINK KEY                                            |
+--------------------------------------------------------------------------+
|                                                                          |
|  Hash: d38811c6f8a5f39e974fb531ad4f1018                                 |
|                                                                          |
|  Purpose:                                                                |
|    - Authenticates devices during the joining process                   |
|    - Derived from network key + coordinator state                       |
|    - Used to securely distribute network key to new devices             |
|    - Stored in coordinator_backup.json                                  |
|                                                                          |
|  If regenerated:                                                         |
|    ! Existing devices may have trouble rejoining                        |
|    + Usually resolves when network key matches                          |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 8. Frame Counter (DYNAMIC - NOT STORED IN GIT)

```
+--------------------------------------------------------------------------+
|  FRAME COUNTER                                                           |
+--------------------------------------------------------------------------+
|                                                                          |
|  Current: ~86,000+ (as of 2026-01-06, always incrementing)             |
|  Stored:  coordinator_backup.json (backed up hourly)                    |
|                                                                          |
|  Purpose:                                                                |
|    - 32-bit counter included in every Zigbee message                    |
|    - Prevents replay attacks                                            |
|    - Devices reject messages with old/repeated frame counters           |
|                                                                          |
|  If reset to 0:                                                          |
|    ! Devices temporarily reject messages                                |
|    + Self-heals after counter exceeds devices' last-seen value          |
|    ~ May take a few minutes to hours depending on device                |
|                                                                          |
|  Recovery:                                                               |
|    - Restore coordinator_backup.json from backup                        |
|    - Contains recent frame counter value                                |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 9. Key Sequence Number

```
+--------------------------------------------------------------------------+
|  KEY SEQUENCE NUMBER                                                     |
+--------------------------------------------------------------------------+
|                                                                          |
|  Current: 0                                                              |
|                                                                          |
|  Purpose:                                                                |
|    - Tracks network key rotation                                        |
|    - Increments each time the network key is changed                    |
|    - Devices use this to know which key version to use                  |
|                                                                          |
|  Note: 0 means original key, no rotations have occurred                 |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 10. Network Update ID

```
+--------------------------------------------------------------------------+
|  NETWORK UPDATE ID                                                       |
+--------------------------------------------------------------------------+
|                                                                          |
|  Current: 0                                                              |
|                                                                          |
|  Purpose:                                                                |
|    - Tracks network parameter changes                                   |
|    - Increments when channel or PAN ID changes                          |
|    - Helps devices detect network reconfiguration                       |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 11. Global Trust Center Link Key (Standard)

```
+--------------------------------------------------------------------------+
|  GLOBAL TRUST CENTER LINK KEY                                            |
+--------------------------------------------------------------------------+
|                                                                          |
|  Hex:    5A6967426565416C6C69616E63653039                               |
|  ASCII:  "ZigBeeAlliance09"                                             |
|                                                                          |
|  Purpose:                                                                |
|    - Well-known default key for initial device joining                  |
|    - All Zigbee devices know this key                                   |
|    - Used only during pairing, then replaced with network key           |
|                                                                          |
|  Note: This is a PUBLIC standard value, not secret                      |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 12. Install Codes (Per-Device, Optional)

```
+--------------------------------------------------------------------------+
|  INSTALL CODES                                                           |
+--------------------------------------------------------------------------+
|                                                                          |
|  Type:   Per-device unique codes                                        |
|  Where:  Printed on device label or in manual                           |
|                                                                          |
|  Purpose:                                                                |
|    - Enhanced security during device commissioning                      |
|    - Alternative to using global TCLK                                   |
|    - Mostly used in commercial/industrial Zigbee                        |
|                                                                          |
|  Note: Most consumer devices don't use install codes                    |
|        Our SONOFF/IKEA devices use standard joining                     |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 13. Application Link Keys (Per-Device, Dynamic)

```
+--------------------------------------------------------------------------+
|  APPLICATION LINK KEYS                                                   |
+--------------------------------------------------------------------------+
|                                                                          |
|  Type:   Per-device-pair encryption keys                                |
|  Stored: database.db (backed up hourly)                                 |
|                                                                          |
|  Purpose:                                                                |
|    - End-to-end encryption between specific device pairs                |
|    - Higher security than network-wide encryption                       |
|    - Negotiated between devices during binding                          |
|                                                                          |
|  Note: Not all devices use link keys                                    |
|        Most home automation uses network key only                       |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## What's Stored Where

| Key Type | In Git? | In Backups? | Location |
|----------|---------|-------------|----------|
| Network Key | Yes | Yes | configuration.yaml |
| PAN ID | Yes | Yes | configuration.yaml |
| Extended PAN ID | Yes | Yes | configuration.yaml |
| Channel | Yes | Yes | configuration.yaml |
| Coordinator IEEE | Yes | Yes | Informational only |
| Security Level | Yes | Yes | coordinator_backup.json |
| Hashed TCLK | No | Yes | coordinator_backup.json |
| Frame Counter | No | Yes | coordinator_backup.json |
| Key Sequence Number | No | Yes | coordinator_backup.json |
| NWK Update ID | No | Yes | coordinator_backup.json |
| Global TCLK | Standard | N/A | Well-known value |
| Install Codes | N/A | N/A | Device labels |
| Link Keys | No | Yes | database.db |

---

## Backup System

```
+--------------------------------------------------------------------------+
|  HOURLY BACKUP SYSTEM                                                    |
+--------------------------------------------------------------------------+
|                                                                          |
|  Cron:      Every hour at minute 0                                      |
|  Script:    /opt/scripts/z2m-backup.sh                                  |
|  Location:  /mnt/storage/backups/zigbee2mqtt/                           |
|  Retention: 7 days (~168 hourly backups)                                |
|                                                                          |
|  Files Backed Up:                                                        |
|    - database.db.<timestamp>                                            |
|    - coordinator_backup.json.<timestamp>                                |
|                                                                          |
|  Manual Backup:                                                          |
|    ssh pi@pi "sudo /opt/scripts/z2m-backup.sh"                          |
|                                                                          |
|  List Backups:                                                           |
|    ssh pi@pi "ls -la /mnt/storage/backups/zigbee2mqtt/"                 |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## Recovery Procedures

### Scenario A: Database Corrupted (Most Common)

The validation script will block Z2M startup if database.db is corrupted.

```bash
# 1. Validation script blocks Z2M startup
# 2. Check available backups
ssh pi@pi "ls -la /mnt/storage/backups/zigbee2mqtt/"

# 3. Find most recent backup
ssh pi@pi "ls -t /mnt/storage/backups/zigbee2mqtt/database.db.* | head -5"

# 4. Restore from most recent backup (replace TIMESTAMP)
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/database.db.TIMESTAMP \
        /opt/zigbee2mqtt/data/database.db"
ssh pi@pi "sudo cp /mnt/storage/backups/zigbee2mqtt/coordinator_backup.json.TIMESTAMP \
        /opt/zigbee2mqtt/data/coordinator_backup.json"

# 5. Start Z2M via systemctl (NOT docker!)
ssh pi@pi "sudo systemctl start zigbee2mqtt"
```

### Scenario B: Complete Pi Rebuild (Disaster Recovery)

If the Pi dies and you need to rebuild from scratch:

```bash
# 1. Install fresh Z2M on new Pi (follow docs/03-zigbee2mqtt-setup.md)

# 2. Before first start, configure network key:
cat > /opt/zigbee2mqtt/data/configuration.yaml << 'EOF'
homeassistant:
  enabled: true
frontend:
  enabled: true
  port: 8080
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
serial:
  port: /dev/ttyUSB0
  adapter: ember
advanced:
  channel: 25
  pan_id: 6754
  ext_pan_id:
    - 221
    - 221
    - 221
    - 221
    - 221
    - 221
    - 221
    - 221
  network_key:
    - 154
    - 10
    - 161
    - 209
    - 86
    - 38
    - 78
    - 156
    - 164
    - 180
    - 119
    - 154
    - 8
    - 108
    - 247
    - 94
availability:
  enabled: true
device_options:
  retain: true
EOF

# 3. If you have backups, restore database
sudo cp /path/to/backup/database.db /opt/zigbee2mqtt/data/database.db
sudo cp /path/to/backup/coordinator_backup.json /opt/zigbee2mqtt/data/coordinator_backup.json

# 4. Start Z2M via systemctl
sudo systemctl start zigbee2mqtt

# 5. Enable permit_join (in Z2M frontend or via MQTT)
# 6. Power cycle router devices (plugs, lights)
# 7. Wait for battery devices to wake and rejoin (may take hours)
```

### Scenario C: New Coordinator (Hardware Replacement)

If the Sonoff dongle dies and you get a new one:

```bash
# 1. New dongle has different IEEE address (hardware MAC)
# 2. Configure same network key in configuration.yaml (as shown above)
# 3. Start Z2M - it will use new coordinator IEEE
# 4. Some devices may need factory reset
# 5. Router devices definitely need power cycle
# 6. Battery devices should eventually rejoin
```

---

## Key Format Conversions

### Network Key

```
Hex string:  9a0aa1d156264e9ca4b4779a086cf75e

Byte array:  [154, 10, 161, 209, 86, 38, 78, 156,
              164, 180, 119, 154, 8, 108, 247, 94]

Hex array:   [0x9A, 0x0A, 0xA1, 0xD1, 0x56, 0x26, 0x4E, 0x9C,
              0xA4, 0xB4, 0x77, 0x9A, 0x08, 0x6C, 0xF7, 0x5E]
```

### Extended PAN ID

```
Hex string:  dddddddddddddddd

Byte array:  [0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD]

Decimal:     [221, 221, 221, 221, 221, 221, 221, 221]
```

---

## History

| Date | Event |
|------|-------|
| 2026-01-04 | Network reformation incident - 35 devices lost |
| 2026-01-04 | Network key recovered from device memory |
| 2026-01-05 | Keys documented, protection system implemented |
| 2026-01-05 | Hourly backup system implemented (7-day retention) |
| 2026-01-06 | **Fresh network key migration** - new key generated |
| 2026-01-06 | All 35 devices re-paired to new network |
| 2026-01-06 | Documentation updated with new key |

---

*Last updated: 2026-01-06*
*This file is git-tracked in private repository*
