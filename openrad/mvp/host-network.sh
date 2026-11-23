#!/bin/sh
# P2P comparison mode: sockets and TAP use the host network; DNS stays isolated.
set -eu
STATE=/tmp/openrad-mvp
test -f "$STATE/active"
test ! -f "$STATE/host-network"
test ! -e /sys/class/net/radminvpn0
command -v nsenter >/dev/null
nft -f - <<'EOF'
table inet openrad_mvp_host {
 chain inner_input_guard {
  type filter hook input priority -10; policy accept;
  iifname "radminvpn0" ct state { established, related } accept
  iifname "radminvpn0" ip protocol icmp icmp type echo-request accept
  iifname "radminvpn0" counter drop
 }
 chain inner_forward_guard {
  type filter hook forward priority -10; policy accept;
  iifname "radminvpn0" counter drop
  oifname "radminvpn0" counter drop
 }
 chain outer_output {
  type filter hook output priority -151; policy accept;
  meta skuid 999 counter
 }
}
insert rule inet fw4 input iifname "eth1" udp dport 40000-40015 counter accept comment "openrad-mvp-host"
insert rule inet fw4 input iifname "radminvpn0" ip protocol icmp icmp type echo-request counter accept comment "openrad-mvp-host"
add set inet fw4 openrad_mvp_tcp_ports { type inet_service; flags dynamic,timeout; timeout 90s; size 128; }
add chain inet fw4 openrad_mvp_output { type filter hook output priority -151; policy accept; }
add rule inet fw4 openrad_mvp_output meta skuid 999 meta l4proto tcp update @openrad_mvp_tcp_ports { tcp sport timeout 90s } counter
insert rule inet fw4 input iifname "eth1" tcp dport @openrad_mvp_tcp_ports counter accept comment "openrad-mvp-host"
EOF
touch "$STATE/host-network"
echo 'Host network comparison mode enabled; start service, then remove only its group routes'
