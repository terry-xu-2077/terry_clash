#!/bin/sh
# Independent recovery for the explicitly approved short TerryClash A/B test.
set -eu
STATE=/tmp/openrad-ab

ready() {
    curl -fsS --max-time 1 http://127.0.0.1:9090/configs >/dev/null 2>&1 &&
    nft list table inet terryclash >/dev/null 2>&1 &&
    uci -q get 'dhcp.@dnsmasq[0].server' | grep -q '127.0.0.1#1053'
}

restore() {
    for attempt in 1 2 3; do
        if ! ready; then
            /etc/init.d/terryclash start
        fi
        for wait in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
            if ready; then
                "$STATE/restore-selections.sh"
                date +%s > "$STATE/restored"
                echo 'TerryClash API, takeover, DNS and selector restore completed'
                return 0
            fi
            sleep 1
        done
    done
    echo 'TerryClash recovery needs attention' >&2
    return 1
}

case "${1:-}" in
    timer) sleep 60; restore ;;
    now) restore ;;
    *) echo 'Usage: ab-restore.sh timer|now' >&2; exit 2 ;;
esac
