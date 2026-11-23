#!/bin/sh
set -eu
/etc/init.d/terryclash stop 2>/dev/null || true
/etc/init.d/terryclash disable 2>/dev/null || true
/usr/libexec/terryclash-dns remove 2>/dev/null || true
/usr/libexec/terryclash-firewall remove 2>/dev/null || true
apk del terryclash
if [ "${1:-}" = --purge ]; then
	rm -rf /etc/terryclash /etc/config/terryclash
fi
echo 'TerryClash removed; network rules restored.'
