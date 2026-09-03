#!/usr/bin/env bash
# iCloud eviction guard.
#
# This repo lives under ~/Desktop, which macOS syncs to iCloud Drive when
# "Desktop & Documents" sync is on. iCloud evicts file *contents* to the
# cloud under disk pressure, leaving metadata-only stubs flagged
# `dataless`. `ls` still reports the right size, but any read blocks on an
# on-demand download — and when that download stalls, Metro/Next builds
# fail with a confusing `ETIMEDOUT: connection timed out, read` on what
# looks like a perfectly ordinary local path.
#
# That happened on 2026-09-02: 1437 files under node_modules were dataless
# and `npx expo export` could not load metro-resolver. See
# docs/2026-09-02-user-app-rewards-screen.md.
#
# This script does both halves of the fix:
#   1. `exclude` — marks dependency/build directories with the
#      com.apple.fileprovider.ignore#P xattr so iCloud stops syncing (and
#      therefore stops evicting) them. This is the preventative fix and is
#      idempotent; re-run it after any `rm -rf node_modules`.
#   2. `repair`  — finds anything already dataless and forces it back down
#      with `brctl download`. This is the cure when a build is failing
#      right now.
#
# Usage:
#   ./scripts/icloud-guard.sh exclude   # prevent future eviction
#   ./scripts/icloud-guard.sh repair    # materialize what's already gone
#   ./scripts/icloud-guard.sh check     # report only, change nothing
#
# The permanent fix is to move this repo off ~/Desktop entirely (e.g. to
# ~/dev/zabetna-live) or turn off Desktop & Documents sync. Until then,
# this script is the workaround.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

XATTR_KEY="com.apple.fileprovider.ignore#P"

# Directories that should never be synced: they're large, regenerable, and
# the ones that actually break builds when evicted.
target_dirs() {
  {
    echo node_modules
    ls -d apps/*/node_modules packages/*/node_modules 2>/dev/null || true
    ls -d apps/*/.expo apps/*/dist apps/*/.next 2>/dev/null || true
  } | sort -u
}

cmd_exclude() {
  local count=0
  while IFS= read -r dir; do
    [ -d "$dir" ] || continue
    xattr -w "$XATTR_KEY" 1 "$dir" 2>/dev/null || {
      echo "  ! could not set xattr on $dir" >&2
      continue
    }
    echo "  excluded $dir"
    count=$((count + 1))
  done < <(target_dirs)
  echo "Excluded $count directories from iCloud sync."
  echo "Re-run this after reinstalling dependencies — a fresh node_modules loses the flag."
}

# Lists dataless files (contents evicted to iCloud) under the given roots.
find_dataless() {
  find "$@" -type f -print0 2>/dev/null \
    | xargs -0 ls -lO 2>/dev/null \
    | grep dataless \
    | sed -E 's/^.*[0-9]{2}:[0-9]{2} //'
}

cmd_check() {
  local roots=(node_modules apps packages supabase docs)
  local existing=()
  for r in "${roots[@]}"; do [ -e "$r" ] && existing+=("$r"); done
  local list n
  list="$(mktemp)"
  find_dataless "${existing[@]}" > "$list"
  n="$(wc -l < "$list" | tr -d ' ')"
  echo "Dataless (evicted) files: $n"
  if [ "$n" != "0" ]; then
    echo "Run './scripts/icloud-guard.sh repair' before building."
    # `head` closing the pipe early would raise SIGPIPE under `pipefail`,
    # so slice the saved list rather than piping find_dataless into head.
    sed -n '1,10p' "$list" | sed 's/^/  /'
    [ "$n" -gt 10 ] && echo "  ... and $((n - 10)) more"
  fi
  rm -f "$list"
  return 0
}

cmd_repair() {
  local roots=(node_modules apps packages supabase docs)
  local existing=()
  for r in "${roots[@]}"; do [ -e "$r" ] && existing+=("$r"); done

  local list
  list="$(mktemp)"
  find_dataless "${existing[@]}" > "$list"

  local total
  total="$(wc -l < "$list" | tr -d ' ')"
  if [ "$total" = "0" ]; then
    echo "Nothing evicted — nothing to repair."
    rm -f "$list"
    return 0
  fi

  echo "Materializing $total evicted files (this can take a minute)..."
  local i=0
  while IFS= read -r f; do
    brctl download "$f" 2>/dev/null || true
    i=$((i + 1))
    [ $((i % 200)) -eq 0 ] && echo "  $i/$total"
  done < "$list"
  rm -f "$list"

  local left
  left="$(find_dataless "${existing[@]}" | wc -l | tr -d ' ')"
  echo "Done. Still dataless: $left"
  [ "$left" != "0" ] && echo "Some files would not download — check network/iCloud status, then re-run." >&2
  return 0
}

case "${1:-check}" in
  exclude) cmd_exclude ;;
  repair) cmd_repair ;;
  check) cmd_check ;;
  *)
    echo "usage: $0 {exclude|repair|check}" >&2
    exit 2
    ;;
esac
