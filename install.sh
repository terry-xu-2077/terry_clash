#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. /etc/openwrt_release
[ "$DISTRIB_ID" = ImmortalWrt ] && [ "$DISTRIB_RELEASE" = 25.12.2 ] && [ "$DISTRIB_ARCH" = x86_64 ] || { echo 'Requires ImmortalWrt 25.12.2 x86_64' >&2; exit 1; }
package=$(find "$ROOT" -maxdepth 1 -name 'terryclash-*.apk' -type f | head -n 1)
[ -n "$package" ] || { echo 'Place the SDK-built terryclash APK beside install.sh' >&2; exit 1; }
apk add --allow-untrusted "$package"
echo 'TerryClash installed. Open LuCI → Services → TerryClash.'
