#!/bin/bash
# =============================================================================
# PostgreSQL Database Backup Script
# =============================================================================
# This script creates a timestamped backup of the PostgreSQL database.
#
# Usage:
#   ./scripts/backup-db.sh
#
# Requirements:
#   - DATABASE_URL environment variable must be set
#   - pg_dump must be available in PATH
#
# Output:
#   - Backup file: backups/backup_YYYYMMDD_HHMMSS.sql
#
# Cron Setup (for automated daily backups):
#   1. Open crontab: crontab -e
#   2. Add the following line for daily backup at 2:00 AM:
#      0 2 * * * cd /home/user/player-development-system && ./scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
#
#   Alternative: Use node-cron in your application for in-process scheduling
# =============================================================================

set -e

BACKUP_DIR="$(dirname "$0")/../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "Starting database backup at $(date)"
echo "Backup file: $BACKUP_FILE"

pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup completed successfully!"
  echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
  
  BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql 2>/dev/null | wc -l)
  MAX_BACKUPS=7
  
  if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    echo "Cleaning up old backups (keeping last $MAX_BACKUPS)..."
    ls -1t "$BACKUP_DIR"/backup_*.sql | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
    echo "Old backups removed."
  fi
else
  echo "Error: Backup failed!"
  exit 1
fi

echo "Backup process finished at $(date)"
