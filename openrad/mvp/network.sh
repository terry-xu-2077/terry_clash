#!/bin/sh
# Runtime-only network sandbox. Does not restart fw4, DNS or TerryClash.
set -eu
NS=or-mvp
HOST=or-mvp-host
PEER=or-mvp-peer
STATE=/tmp/openrad-mvp
COMMENT=openrad-mvp
IP=/usr/bin/ip

remove_rules() {
    for spec in 'fw4 input' 'fw4 forward' 'dnsmasq prerouting' 'terryclash tcp_prerouting' 'terryclash udp_prerouting' 'terryclash ipv6_prerouting'; do
        set -- $spec
        nft -a list chain inet "$1" "$2" 2>/dev/null |
            awk '/comment "openrad-mvp(-host|-p2p)?"/ {print $NF}' |
            while read -r handle; do nft delete rule inet "$1" "$2" handle "$handle"; done
    done
}

down() {
    if [ -f "$STATE/host-network" ]; then
        /etc/init.d/openrad-mvp stop 2>/dev/null || true
    fi
    # Also stop the unprivileged instance before removing its namespace.
    if "$IP" netns list | grep -Eq "^$NS([[:space:]]|$)"; then
        for pid in $("$IP" netns pids "$NS"); do kill "$pid" 2>/dev/null || true; done
        sleep 1
        for pid in $("$IP" netns pids "$NS"); do kill -KILL "$pid" 2>/dev/null || true; done
    fi
    remove_rules
    nft flush chain inet fw4 openrad_mvp_output 2>/dev/null || true
    nft delete chain inet fw4 openrad_mvp_output 2>/dev/null || true
    nft delete set inet fw4 openrad_mvp_tcp_ports 2>/dev/null || true
    nft delete table inet openrad_mvp 2>/dev/null || true
    nft delete table inet openrad_mvp_host 2>/dev/null || true
    "$IP" link del "$HOST" 2>/dev/null || true
    "$IP" netns del "$NS" 2>/dev/null || true
    rm -f /etc/netns/or-mvp/resolv.conf
    rmdir /etc/netns/or-mvp 2>/dev/null || true
    rm -f "$STATE/active" "$STATE/retain" "$STATE/host-network"
    if [ -r "$STATE/watchdog.pid" ]; then
        watchpid=$(cat "$STATE/watchdog.pid")
        case "$watchpid" in
            ''|*[!0-9]*) ;;
            *)
                if [ "$watchpid" != "$$" ] && grep -q '/usr/libexec/openrad-mvp/watchdog.sh' "/proc/$watchpid/cmdline" 2>/dev/null; then
                    kill "$watchpid" 2>/dev/null || true
                fi
                ;;
        esac
        rm -f "$STATE/watchdog.pid"
    fi
}

up() {
    test ! -e "$STATE/active" || { echo 'Already active; inspect or stop first' >&2; exit 1; }
    ! "$IP" link show "$HOST" >/dev/null 2>&1 || { echo 'Interface already exists' >&2; exit 1; }
    ! "$IP" netns list | grep -Eq "^$NS([[:space:]]|$)" || { echo 'Namespace already exists' >&2; exit 1; }
    ! nft list table inet openrad_mvp >/dev/null 2>&1 || { echo 'Table already exists' >&2; exit 1; }
    # Keep this prototype tied to the inspected WAN instead of guessing interfaces.
    WAN=$("$IP" -4 route show default | awk 'NR==1 {for(i=1;i<=NF;i++)if($i=="dev")print $(i+1)}')
    test "$WAN" = eth1 || { echo 'WAN changed; review sandbox rules' >&2; exit 1; }
    ! "$IP" -4 route show table all | grep -q '10\.203\.17\.' || { echo 'Sandbox subnet in use' >&2; exit 1; }
    mkdir -p "$STATE" /etc/netns/or-mvp
    chmod 700 "$STATE"
    trap 'down' EXIT
    "$IP" netns add "$NS"
    "$IP" link add "$HOST" type veth peer name "$PEER"
    "$IP" link set "$PEER" netns "$NS"
    "$IP" addr add 10.203.17.1/30 dev "$HOST"
    "$IP" link set "$HOST" up
    "$IP" -n "$NS" link set lo up
    "$IP" -n "$NS" addr add 10.203.17.2/30 dev "$PEER"
    "$IP" -n "$NS" link set "$PEER" up
    "$IP" -n "$NS" route add default via 10.203.17.1
    "$IP" netns exec "$NS" sysctl -q -w net.ipv6.conf.all.disable_ipv6=1
    printf 'nameserver 223.5.5.5\nnameserver 1.1.1.1\n' > /etc/netns/or-mvp/resolv.conf
    nft -f - <<EOF
table inet openrad_mvp {
 chain input_guard {
  type filter hook input priority -10; policy accept;
  iifname "$HOST" counter drop
 }
 chain forward_guard {
  type filter hook forward priority -10; policy accept;
  iifname "$HOST" ip saddr != 10.203.17.2 counter drop
  iifname "$HOST" ip daddr { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16 } counter drop
  iifname "$HOST" oifname != "$WAN" counter drop
  oifname "$HOST" iifname != "$WAN" counter drop
  iifname "$HOST" counter
  oifname "$HOST" counter
 }
 chain egress_nat {
  type nat hook postrouting priority srcnat - 1; policy accept;
  ip saddr 10.203.17.2 oifname "$WAN" counter masquerade
 }
}
insert rule inet fw4 forward iifname "$HOST" oifname "$WAN" counter accept comment "$COMMENT"
insert rule inet dnsmasq prerouting iifname "$HOST" counter return comment "$COMMENT"
insert rule inet terryclash tcp_prerouting iifname "$HOST" counter return comment "$COMMENT"
insert rule inet terryclash udp_prerouting iifname "$HOST" counter return comment "$COMMENT"
insert rule inet terryclash ipv6_prerouting iifname "$HOST" counter return comment "$COMMENT"
EOF
    # Only ICMP echo and the dedicated test service can enter through the VPN TAP.
    "$IP" netns exec "$NS" nft -f - <<'EOF'
table inet openrad_mvp_guest {
 chain input {
  type filter hook input priority filter; policy drop;
  iifname "lo" accept
  ct state { established, related } accept
  iifname "radminvpn0" ip protocol icmp icmp type echo-request accept
  iifname "radminvpn0" tcp dport 39090 accept
  iifname "or-mvp-peer" meta l4proto { tcp, udp } accept
 }
 chain forward {
  type filter hook forward priority filter; policy drop;
 }
}
EOF
    date +%s > "$STATE/active"
    rm -f "$STATE/retain"
    trap - EXIT
    echo 'Sandbox ready; temporary, IPv4-only, no LAN clients attached'
}

case "${1:-}" in
    up) up ;;
    down) down ;;
    status) "$IP" netns list; nft list table inet openrad_mvp ;;
    *) echo 'Usage: network.sh up|down|status' >&2; exit 2 ;;
esac
