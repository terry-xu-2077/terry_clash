include $(TOPDIR)/rules.mk

PKG_NAME:=terryclash
PKG_VERSION:=0.1.0
PKG_RELEASE:=17
PKG_LICENSE:=MIT
PKG_MAINTAINER:=TerryClash
PKGARCH:=x86_64

include $(INCLUDE_DIR)/package.mk

define Package/terryclash
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=Mihomo manager for ImmortalWrt 25.12.2
  DEPENDS:=+luci-base +rpcd +rpcd-mod-file +uhttpd +uhttpd-mod-ubus +yq +quickjs +coreutils-timeout +curl +firewall4 +nftables-json +kmod-nft-tproxy +ca-bundle
endef

define Package/terryclash/description
  LuCI, UCI and procd based Mihomo manager with subscription and custom rule support.
endef

define Package/terryclash/conffiles
/etc/config/terryclash
/etc/terryclash/global.js
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/terryclash/install
	$(CP) ./files/* $(1)/
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/terryclash/subscriptions
	gzip -dc ./core/mihomo.gz > $(1)/usr/bin/mihomo
	chmod 0755 $(1)/usr/bin/mihomo $(1)/usr/libexec/terryclash $(1)/usr/libexec/terryclash-firewall $(1)/usr/libexec/terryclash-dns $(1)/etc/init.d/terryclash $(1)/etc/hotplug.d/firewall/90-terryclash
endef

define Package/terryclash/postinst
#!/bin/sh
[ -n "$$$$IPKG_INSTROOT" ] || {
  grep -q '/usr/libexec/terryclash auto-update' /etc/crontabs/root 2>/dev/null || echo '17 * * * * /usr/libexec/terryclash auto-update >/dev/null 2>&1' >> /etc/crontabs/root
  for cache in /tmp/luci-indexcache.*.json; do [ ! -f "$$$$cache" ] || rm -f "$$$$cache"; done
  /etc/init.d/rpcd restart
  /etc/init.d/uhttpd restart
  /etc/init.d/cron restart
}
exit 0
endef

define Package/terryclash/prerm
#!/bin/sh
[ -n "$$$$IPKG_INSTROOT" ] || /etc/init.d/terryclash stop
exit 0
endef

define Package/terryclash/postrm
#!/bin/sh
[ -n "$$$$IPKG_INSTROOT" ] || {
  nft delete table inet terryclash 2>/dev/null || true
  ip -4 rule del fwmark 0x71 lookup 171 2>/dev/null || true
  ip -6 rule del fwmark 0x71 lookup 171 2>/dev/null || true
  ip -4 route flush table 171 2>/dev/null || true
  ip -6 route flush table 171 2>/dev/null || true
  sed -i '\|/usr/libexec/terryclash auto-update|d' /etc/crontabs/root
  /etc/init.d/cron restart
}
exit 0
endef

$(eval $(call BuildPackage,terryclash))
