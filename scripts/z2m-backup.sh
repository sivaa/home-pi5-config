#!/bin/bash
#
# Z2M Hourly Backup Script
# ========================
# Keeps 7 days of hourly backups (168 max)
#
# Cron: 0 * * * * /opt/scripts/z2m-backup.sh >> /var/log/z2m-backup.log 2>&1
#
# WHY THIS EXISTS:
# On Jan 4, 2026, database corruption caused complete network loss.
# Hourly backups ensure max 1 hour of data loss on corruption.
#

BACKUP_DIR="/mnt/storage/backups/zigbee2mqtt"
DATA_DIR="/opt/zigbee2mqtt/data"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M)

echo "========================================"
echo "  Z2M Backup - $TIMESTAMP"
echo "========================================"

# Create backup directory if it doesn't exist
if ! mkdir -p "$BACKUP_DIR"; then
    echo "[ERROR] Failed to create backup directory: $BACKUP_DIR"
    exit 1
fi

# Check source files exist
if [ ! -f "$DATA_DIR/database.db" ]; then
    echo "[ERROR] Source file not found: $DATA_DIR/database.db"
    exit 1
fi

if [ ! -f "$DATA_DIR/coordinator_backup.json" ]; then
    echo "[WARNING] coordinator_backup.json not found - skipping"
fi

# Backup both files with same timestamp (atomic backup)
echo "Backing up database.db..."
if ! cp "$DATA_DIR/database.db" "$BACKUP_DIR/database.db.$TIMESTAMP"; then
    echo "[ERROR] Failed to backup database.db"
    exit 1
fi

echo "Backing up coordinator_backup.json..."
if [ -f "$DATA_DIR/coordinator_backup.json" ]; then
    if ! cp "$DATA_DIR/coordinator_backup.json" "$BACKUP_DIR/coordinator_backup.json.$TIMESTAMP"; then
        echo "[ERROR] Failed to backup coordinator_backup.json"
        # Don't exit - database backup succeeded
    fi
fi

# Verify backups were created
DB_BACKUP_SIZE=$(stat -c %s "$BACKUP_DIR/database.db.$TIMESTAMP" 2>/dev/null || echo 0)
COORD_BACKUP_SIZE=$(stat -c %s "$BACKUP_DIR/coordinator_backup.json.$TIMESTAMP" 2>/dev/null || echo 0)

if [ "$DB_BACKUP_SIZE" -eq 0 ]; then
    echo "[ERROR] Backup verification failed - database.db is empty!"
    exit 1
fi

echo ""
echo "Backup successful:"
echo "  database.db.$TIMESTAMP ($DB_BACKUP_SIZE bytes)"
echo "  coordinator_backup.json.$TIMESTAMP ($COORD_BACKUP_SIZE bytes)"

# Cleanup old backups (older than retention period)
echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED_DB=$(find "$BACKUP_DIR" -name "database.db.*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
DELETED_COORD=$(find "$BACKUP_DIR" -name "coordinator_backup.json.*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
echo "  Deleted: $DELETED_DB database backups, $DELETED_COORD coordinator backups"

# Report backup statistics
echo ""
echo "Backup statistics:"
COUNT=$(ls -1 "$BACKUP_DIR"/database.db.* 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "  Total backups: $COUNT (max ~168 for 7 days)"
echo "  Total size: $TOTAL_SIZE"

# Find oldest and newest backups
OLDEST=$(ls -t "$BACKUP_DIR"/database.db.* 2>/dev/null | tail -1 | xargs basename 2>/dev/null | sed 's/database.db.//')
NEWEST=$(ls -t "$BACKUP_DIR"/database.db.* 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/database.db.//')
echo "  Oldest: $OLDEST"
echo "  Newest: $NEWEST"

echo ""
echo "========================================"
echo "  Backup complete at $(date)"
echo "========================================"
