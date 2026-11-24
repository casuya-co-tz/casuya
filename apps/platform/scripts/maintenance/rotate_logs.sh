#!/usr/bin/env bash
# Rotate log files larger than LOG_MAX_BYTES (default 50 MiB).
# Keeps LOG_KEEP (default 5) gzip-compressed generations per file.
set -euo pipefail

LOG_DIR="${LOG_DIR:-logs}"
LOG_MAX_BYTES="${LOG_MAX_BYTES:-52428800}"
LOG_KEEP="${LOG_KEEP:-5}"

[ -d "$LOG_DIR" ] || { echo "No log directory at $LOG_DIR; nothing to rotate."; exit 0; }

rotated=0
while IFS= read -r -d '' log; do
  size="$(wc -c < "$log")"
  [ "$size" -lt "$LOG_MAX_BYTES" ] && continue

  # Shift existing generations: .4.gz -> .5.gz ... .1.gz -> .2.gz
  for i in $(seq "$LOG_KEEP" -1 2); do
    [ -f "$log.$((i - 1)).gz" ] && mv -f "$log.$((i - 1)).gz" "$log.$i.gz"
  done
  [ -f "$log.1.gz" ] && mv -f "$log.1.gz" "$log.2.gz"
  gzip -c "$log" > "$log.1.gz"
  : > "$log"
  rotated=$((rotated + 1))
  echo "Rotated $log (${size} bytes)"
done < <(find "$LOG_DIR" -maxdepth 2 -type f -name '*.log' -print0)

echo "Rotated $rotated log file(s)."
