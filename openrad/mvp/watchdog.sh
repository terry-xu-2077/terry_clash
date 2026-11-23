#!/bin/sh
# Detached safety timer. Persistent identity files are never removed by rollback.
set -eu
timer=
trap '[ -z "$timer" ] || kill "$timer" 2>/dev/null || true; exit 0' TERM INT HUP
sleep "${1:-1200}" &
timer=$!
wait "$timer"
timer=
if [ ! -f /tmp/openrad-mvp/retain ]; then
    /etc/init.d/openrad-mvp stop 2>/dev/null || true
    /usr/libexec/openrad-mvp/network.sh down
fi
