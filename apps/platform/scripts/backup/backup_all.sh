#!/usr/bin/env bash
set -euo pipefail
bash scripts/backup/backup_sqlite.sh
echo "Backing up lesson packages..."
rsync -av "../storage/lesson-packages/" "storage/backups/lesson-packages-${timestamp}/" --exclude="*.tmp" --exclude="*.temp" 2>/dev/null || true
echo "TODO: also back up other storage content"
