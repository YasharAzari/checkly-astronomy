#!/bin/sh
# Size-based rotation for a log file that another process holds open.
#
# The agent pipes its output through `tee -a`, which opens the file once and
# never reopens it, so we must not rename it away -- tee would keep writing to
# the renamed inode and logs/agent.log would stay empty forever. Instead we copy
# the contents aside and truncate the original in place (what logrotate calls
# `copytruncate`). Because tee opened it O_APPEND, its next write lands at
# offset 0 rather than leaving a multi-megabyte sparse hole.
#
# The cost of copytruncate is the usual one: lines written in the instant
# between the copy and the truncate are lost. That is fine for agent logs.

set -eu

LOG="${LOG_FILE:-/var/log/checkly/agent.log}"
MAX_BYTES="${MAX_BYTES:-10485760}"
KEEP="${KEEP:-5}"
INTERVAL="${INTERVAL:-60}"

log() { echo "[rotate] $(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

# Arithmetic expansion normalises the padding some `wc` builds emit, and gives 0
# for a file that does not exist yet.
size_of() { echo $(( $(wc -c < "$1" 2>/dev/null || echo 0) )); }

rotate() {
  bytes=$(size_of "$LOG")

  # Shift the generations down: .4 -> .5, .3 -> .4, ... and drop what falls off.
  i="$KEEP"
  while [ "$i" -gt 1 ]; do
    prev=$(( i - 1 ))
    if [ -f "$LOG.$prev" ]; then
      mv -f "$LOG.$prev" "$LOG.$i"
    fi
    i="$prev"
  done

  cp -f "$LOG" "$LOG.1"
  : > "$LOG"
  log "rotated ${bytes}B -> $(basename "$LOG").1 (keeping $KEEP)"
}

log "watching $LOG (rotate above ${MAX_BYTES}B, keep $KEEP, check every ${INTERVAL}s)"
while :; do
  if [ -f "$LOG" ] && [ "$(size_of "$LOG")" -gt "$MAX_BYTES" ]; then
    rotate
  fi
  sleep "$INTERVAL"
done
