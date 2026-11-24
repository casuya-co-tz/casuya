#!/usr/bin/env bash
# Back up the SQLite database and every storage subtree with a single timestamp.
set -euo pipefail

PLATFORM_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PLATFORM_ROOT"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="storage/backups"
mkdir -p "$backup_root"

bash scripts/backup/backup_sqlite.sh

# Back up every storage directory (lesson packages, quiz packages, uploads,
# caches, ...) except backups themselves. A missing directory is skipped so the
# script works on a fresh install.
for dir in storage/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  [ "$name" = "backups" ] && continue
  echo "Backing up storage/$name..."
  mkdir -p "$backup_root/$name-$timestamp"
  rsync -a "$dir" "$backup_root/$name-$timestamp/" \
    --exclude='*.tmp' --exclude='*.temp' --exclude='*.part'
done

echo "Backup complete: $backup_root/*-$timestamp"
