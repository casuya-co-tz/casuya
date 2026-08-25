#!/usr/bin/env bash
# Copies PostgreSQL database to storage/backups/ with a timestamp.
set -euo pipefail
timestamp=$(date +%Y%m%d-%H%M%S)
db_file="../casuya_platform.db"
if [ -f "../../postgresql-setup.sh" ] || command -v pg_dump >/dev/null 2>&1; then
    # Database is PostgreSQL
    pg_dump -h localhost -U postgres -F c -f "storage/backups/casuya_platform-${timestamp}.sql" casuya_platform || true
    echo "Backed up PostgreSQL to storage/backups/casuya_platform-${timestamp}.sql"
else
    # Fallback to SQLite backup
    if [ -f "$db_file" ]; then
        cp "$db_file" "storage/backups/casuya_platform-${timestamp}.db"
        echo "Backed up to storage/backups/casuya_platform-${timestamp}.db"
    else
        echo "No database backup performed - no SQLite or PostgreSQL database found"
    fi
fi
