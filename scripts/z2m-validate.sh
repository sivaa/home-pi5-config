#!/bin/bash
#
# Z2M Pre-Start Validation
# =========================
# Prevents starting with corrupted database (which causes network reformation)
#
# Exit 0 = OK to start
# Exit 1 = BLOCKED (corruption detected)
#
# WHY THIS EXISTS:
# On Jan 4, 2026, database corruption caused Z2M to form a new network,
# orphaning all 35 devices. This script prevents that from happening again.
#

DB="/opt/zigbee2mqtt/data/database.db"
DB_BACKUP="/opt/zigbee2mqtt/data/database.db.backup"
COORD_BACKUP="/opt/zigbee2mqtt/data/coordinator_backup.json"
MIN_RATIO=30  # database.db must be at least 30% of backup size
FALLBACK_MIN_SIZE=15000  # 15KB fallback if no backup exists

echo "========================================"
echo "  Z2M Pre-Start Validation"
echo "========================================"
echo ""
echo "Time: $(date)"
echo ""

# Check 1: Fresh install (no database yet)
if [ ! -f "$DB" ] && [ ! -f "$DB_BACKUP" ]; then
    echo "✅ Fresh install detected. No validation needed."
    exit 0
fi

# Check 2: coordinator_backup.json exists
if [ ! -f "$COORD_BACKUP" ]; then
    echo "⚠️  WARNING: coordinator_backup.json missing!"
    echo "   This file contains critical network state."
    echo "   Proceeding, but network might have issues."
    echo ""
fi

# Check 3: database.db.backup exists
if [ -f "$DB" ] && [ ! -f "$DB_BACKUP" ]; then
    echo "⚠️  WARNING: database.db.backup missing!"
    echo "   Using fallback minimum size (${FALLBACK_MIN_SIZE} bytes)."
    echo ""
    BACKUP_SIZE=$FALLBACK_MIN_SIZE
else
    BACKUP_SIZE=$(stat -c %s "$DB_BACKUP" 2>/dev/null || echo $FALLBACK_MIN_SIZE)
fi

# Check 4: database.db size validation
DB_SIZE=$(stat -c %s "$DB" 2>/dev/null || echo 0)
MIN_SIZE=$((BACKUP_SIZE * MIN_RATIO / 100))

# Ensure minimum is at least reasonable
if [ "$MIN_SIZE" -lt 5000 ]; then
    MIN_SIZE=5000
fi

echo "database.db:        $DB_SIZE bytes"
echo "database.db.backup: $BACKUP_SIZE bytes"
echo "Minimum required:   $MIN_SIZE bytes (${MIN_RATIO}% of backup)"
echo ""

if [ "$DB_SIZE" -lt "$MIN_SIZE" ]; then
    echo "========================================"
    echo "  ❌ BLOCKED: DATABASE CORRUPTION DETECTED"
    echo "========================================"
    echo ""
    echo "database.db is too small ($DB_SIZE bytes)."
    echo "Starting Z2M would cause NETWORK REFORMATION!"
    echo "All 50+ devices would need re-pairing!"
    echo ""
    echo "TO RECOVER:"
    echo "  1. Check available backups:"
    echo "     ls -la /mnt/storage/backups/zigbee2mqtt/"
    echo ""
    echo "  2. Find most recent backup:"
    echo "     ls -t /mnt/storage/backups/zigbee2mqtt/database.db.* | head -5"
    echo ""
    echo "  3. Restore database (replace TIMESTAMP with actual value):"
    echo "     sudo cp /mnt/storage/backups/zigbee2mqtt/database.db.TIMESTAMP $DB"
    echo "     sudo cp /mnt/storage/backups/zigbee2mqtt/coordinator_backup.json.TIMESTAMP $COORD_BACKUP"
    echo ""
    echo "  4. Retry:"
    echo "     sudo systemctl start zigbee2mqtt"
    echo ""
    echo "  For detailed recovery procedures, see:"
    echo "     configs/zigbee2mqtt/NETWORK_KEYS.md"
    echo ""

    # Try to send alert via MQTT (might fail if mosquitto not ready)
    docker exec mosquitto mosquitto_pub \
        -t "zigbee2mqtt/validation/blocked" \
        -m "{\"status\":\"BLOCKED\",\"reason\":\"database_corrupted\",\"size\":$DB_SIZE,\"required\":$MIN_SIZE,\"timestamp\":\"$(date -Iseconds)\"}" \
        2>/dev/null || true

    exit 1
fi

echo "✅ Validation PASSED. Starting Z2M..."
exit 0
