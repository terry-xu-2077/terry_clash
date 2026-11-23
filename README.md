# TerryClash V1

ImmortalWrt 25.12.2 x86_64 上的 Mihomo 代理管理器。LuCI 原生 JS 提供首页、订阅、代理、规则和分流页面，Shell + UCI 管理配置，rpcd 执行操作，procd 管理服务，独立 nftables 表接管 LAN IPv4/IPv6 TCP/UDP。

源码仓库：[terry-xu-2077/terry_clash](https://github.com/terry-xu-2077/terry_clash)。已编译安装包与校验文件见 [Releases](https://github.com/terry-xu-2077/terry_clash/releases)。

OpenRad 路由器方案见 [OPENRAD_ROUTER_PLAN.md](OPENRAD_ROUTER_PLAN.md)。[单实例最小实现](openrad/mvp/README.md)已在路由器验证注册、加入私有网络、认证成员连接、ICMP 往返及绕过 TerryClash；[测试记录](openrad/mvp/TEST_RESULTS.md)列明验证范围。多主机地址映射尚未实现，OpenRad 不包含在 r17 安装包中。 2026-11-23 已按用户要求清除路由器上的 OpenRad 实验环境，外网 P2P 尚未完成；继续项目见 [最新交接](openrad/mvp/HANDOFF_2026-11-23.md)。

## 已核实目标设备

- ImmortalWrt 25.12.2 (`r38135-0c4cd0f9920a`)，`x86/64` / `x86_64`
- Linux 6.12.103；Intel Core i3-9100T（虚拟机展示 1 vCPU）；内存 1,174,828 KiB
- apk-tools 3.0.5；内核模块源带 ABI `6.12.103-1-0413601b1c3f0490e17f340fe09229ea`
- LuCI `26.249.28459~d6167ea`、rpcd `2026.07.19~e37ed9d8-r1`、uhttpd `2026.06.16~7b1bec45-r1`、procd `2026.03.13~58eb263d-r1`、fw4 `2025.03.17~b6e51575-r2`、nftables `1.1.6-r2`
- Mihomo `v1.19.34` Linux AMD64 compatible 在设备上通过 `-v` 与最小 YAML 的 `-t` 测试。核心压缩包 SHA256：`2763f5b414527f7baf6dc57e3f82f3ab561eedf34bfd7c2f2cde1f7e592efe06`。

## 构建

本项目在 Windows + 目标路由器上实际使用的构建、安装、校验及清理步骤见 [BUILD_AND_INSTALL.md](BUILD_AND_INSTALL.md)。下次调整前先读该文档并检查路由器当前状态。

使用 [ImmortalWrt 25.12.2 x86/64 SDK](https://downloads.immortalwrt.org/releases/25.12.2/targets/x86/64/) 的 Linux 环境。将 `package/terryclash` 复制到 SDK 的 `package/terryclash`，运行 `make defconfig`，再运行 `make -C package/terryclash TOPDIR="$PWD" compile V=s`（只构建此包；运行时依赖由设备 APK 软件源提供）。仅从该 SDK 和设备配置的软件源解析依赖，不使用 BleachWrt 的 IPK 或内核模块。

构建后将 `terryclash-0.1.0-r17.apk` 与 `install.sh` 放在路由器同一目录，执行 `sh install.sh`。安装后在 LuCI → 服务 → TerryClash 导入订阅或 YAML，切换为当前配置并启动。`sh uninstall.sh` 卸载；`sh uninstall.sh --purge` 同时删除配置和订阅。

## 配置与回滚

- 原始订阅保存在 `/etc/terryclash/subscriptions/`；自定义规则保存在 `/etc/config/terryclash`。
- `yq` 按 YAML 结构合并规则，插在订阅规则前。候选配置由 Mihomo `-t` 校验，通过后才替换 `run.yaml`。上一版本留在 `run.previous.yaml`。
- 停止或卸载时删除独立 `inet terryclash` nftables 表及专用策略路由。`fw4` 的既有规则不做覆盖。
- 代理 API 仅监听 `127.0.0.1:9090`，LuCI 通过 rpcd 调用本地 Shell 代理。

## 验证结果

- r7 使用 ImmortalWrt 25.12.2 x86_64 SDK 构建，APK SHA256：`cf063b0f2b858fe4552cbfe5e1e54f739f5fa14812c23da78fab84520431b19b`。r6 → r7 模拟升级和实机升级均通过。
- 路由 DNS 对 `claude.ai` 的 AAAA 查询返回空结果；绕过桌面代理后，IPv4 和强制 IPv6 访问 Claude 均返回登录页，IPv4 出口为 SG。IPv4/IPv6 的 nftables 计数器均增长。
- 停止服务后，dnsmasq 配置 SHA256 恢复到升级前值，nftables 表及 IPv6 策略路由消失；再次启动后重新接管。升级前的 TerryClash UCI 和全局脚本 SHA256 保持一致。
- r8 APK 已在路由器从 r7 升级，SHA256：`7d41d7e61e6e46cd2c2202cf8121e5ccf3ab17b8a670a4bdf40ca4dd4d085b39`。状态接口返回 IPv4、IPv6、DNS 均已接管。三个 LuCI 页面共用的“路由接管”状态区已在 1280px 桌面和 375px 手机实机页面检查；无 JavaScript 错误或横向溢出。路由器现运行 r8，服务已启用。

- 初版 r1 也由官方 25.12.2 SDK 构建；SHA256：`5161c6bb300d474a00da32188c1c3cf77379b9c96ca10c3597499b3896af78d1`。
- 目标设备 APK 安装、卸载、重新安装成功；卸载再安装后 UCI 配置 SHA256 保持一致。r1 → r2 升级已另行验证。
- 订阅 URL 下载、本地 YAML 导入、无效配置拒绝且运行配置不变、策略组实际切换、单节点延迟、规则新增/删除/排序/目标验证已测试。
- Windows LAN 客户端 TCP HTTP 与 UDP DNS：DIRECT 可达，REJECT 阻断，停止代理后恢复可达。
- LuCI 三个页面已加载检查。暗色订阅页的输入框、文件选择控件和按钮底边分别为 433、605、743 px，每行内一致。

## 使用

1. 打开 LuCI → 服务 → TerryClash。
2. 输入订阅名称和 URL，点击“添加并更新”；也可以导入本地 YAML。
3. 在保存的订阅中点击“使用”，再点击“启动”。
4. 在代理页测试延迟、切换策略组；在规则页添加自定义规则并指定目标策略组。
5. 点击“停止”恢复普通网络转发。

Mihomo 核心随 APK 安装，升级时重新构建并安装新的 APK。r7 接管 LAN IPv4/IPv6 TCP/UDP，不包含 TUN。

## DNS 与 IPv6 接管（0.1.0-r7）

TerryClash 启动时将 dnsmasq 的普通上游查询转给本机 Mihomo DNS（`127.0.0.1:1053`），保留 dnsmasq 的局域网名称和域名专用转发。Mihomo DNS 对 AAAA 查询返回空结果，与桌面 Clash Verge 的 DNS 行为一致。原有 dnsmasq 上游设置会备份；停止或卸载 TerryClash 时恢复。若订阅 DNS 上游为空或使用 `system`/本机 53 端口，会改用明确的 DoH 上游，避免循环转发。

独立 nftables 表通过 IPv6 TPROXY 接管 LAN 发出的公网 TCP/UDP，包括使用自带 DoH、缓存或直接填写 IPv6 地址的客户端；链路本地、ULA 和组播流量继续留在局域网。停止服务时同时删除 IPv4/IPv6 策略路由。升级后首次启动会从当前订阅重建旧版运行配置。

安装后在路由器执行 `nft list table inet terryclash`、`ip -6 rule show`、`uci get 'dhcp.@dnsmasq[0].server'`，确认 IPv4/IPv6 计数器随客户端访问增长且 dnsmasq 上游包含 `127.0.0.1#1053`。从客户端向路由 DNS 查询 `claude.ai` 的 AAAA 应得到空结果；关闭桌面系统代理后，再分别强制 IPv4 和 IPv6 访问 Claude 检查实际出口。若 IPv4 仍显示 CN 出口，应查看 nft 计数器与 Mihomo 连接记录，确认流量是否进入路由器及命中的策略组。

## 路由接管状态界面（0.1.0-r8）

订阅、代理、规则三个页面的标题下方显示 IPv4 透明代理、IPv6 透明代理和 DNS 上游状态。每三秒从路由器读取真实的 nftables 规则、IPv6 策略路由和 dnsmasq 设置；服务停止时显示“未启用”。LuCI 视图和公共资源改用 r8 文件名，避免旧页面缓存。

## 全局扩展脚本（0.1.0-r2）

订阅页提供 JavaScript 编辑器、文件导入、启用开关及“保存并应用”。兼容同步 `function main(config) { return config; }`，第二参数为 `TerryClash`。使用当前软件源的 QuickJS，按需执行，无常驻 JavaScript 服务。执行限制为 10 秒、32 MiB。

配置处理顺序：原始订阅 → 全局脚本 → TerryClash 管理端口/模式设置 → 自定义规则 → Mihomo 校验 → 原子替换运行配置。脚本保存、订阅更新和切换都会重新生成配置；脚本失败或生成配置无效时保留原运行配置。没有当前订阅时保存只检查脚本语法，导入订阅后再检查执行结果。脚本及启用状态保存在 `/etc/terryclash/global.js` 与 UCI，升级保留。

支持普通 JavaScript 配置变换，不提供 Verge 桌面 API、Node.js 模块或异步 main。LAN 透明代理无法读取客户端进程名，PROCESS-NAME 规则不能匹配 LAN 设备进程。

已用用户提供的 Script.js 验证策略组、规则集与 MATCH 重定向；异常与无限循环均能回滚。r1 → r2 APK 升级通过，已保存脚本 SHA256 保持一致。用户脚本未打入通用安装包。

## 代理分组卡片（0.1.0-r3）

代理页按当前配置顺序显示可折叠分组，读取 Mihomo API 的组图标、类型、当前节点和延迟。展开后显示三列节点卡片（中屏两列、手机单列），点击卡片实际调用选择节点 API，当前节点用勾选和边框标识。

分组内提供“测速”“延迟排序”“原始顺序”：测速并发数为 4，显示完成进度；排序按钮在升序/降序间切换，未测试和超时始终置后。延迟数字也可单独点击测试。“测试所有节点”对核心中非策略组节点去重后测试。这里的测速是 HTTP 延迟测试，不是带宽测速。

展开状态保存在浏览器本地；排序仅改变显示顺序。图标无法加载时回退到星形图标。样式适配 Argon 暗色模式。

设备验收：9 个策略组、Google 组 37 个成员真实延迟测试、升序/降序、节点选择 API、展开状态刷新保留均通过；1280px 桌面和 375px 手机截图检查完成，手机无横向溢出。r3 APK 使用原 25.12.2 SDK 构建。

## 代理页修正（0.1.0-r4）

分组标题栏中间放置“测速”和“延迟排序”；右侧用明确的“展开/收起”文字控制折叠。点击组名或标题空白处同样能折叠。测速和排序按钮不会触发折叠。

节点卡片只显示延迟，不再设置逐节点测速按钮。排序按钮依次切换升序、降序和原始顺序；整组测速完成后保留展开状态。组图标优先使用配置中的 icon，加载期间或失败时显示默认星形。

LuCI 菜单改为版本化的代理视图资源 `terryclash/proxies_r4`，CSS 带 r4 版本参数，避免浏览器继续使用旧版页面。已在设备验证：37 个成员批量延迟测试、标题栏排序不触发折叠、展开/收起、图标、无逐节点测试按钮、手机无横向溢出。

## 可选服务钩子（0.1.0-r5）

当 `/etc/terryclash/service-hook` 存在且可执行时，服务 API 就绪后调用 `service-hook start`，停止时调用 `service-hook stop`。通用安装包不包含用户专用的钩子与规则；用于在代理停用时恢复特定业务的普通 DNS。PS5 系统更新配置使用该钩子，只切换更新域名的 DNS 转发，游戏下载域名保留原解析。

## 炭灰配色与脚本编辑器（0.1.0-r6）

三个页面统一炭灰底和蓝紫色强调，替换原蓝绿色。全局脚本默认折叠，展开使用本地打包的 CodeMirror 5.65.20（MIT，随附许可证），提供 JavaScript 高亮、行号、Tab/Shift-Tab 缩进和撤销。编辑不会自动保存，“保存并应用”仍经过现有配置校验和回滚流程。

三个 LuCI 视图和公共资源使用 r6 版本路径，避免旧页面缓存。已检查桌面/375px 手机显示、默认折叠、展开高亮、行号、Tab 与撤销，PS5 全局脚本完整保留。

## 0.1.0-r9 路由器诊断

Mihomo 的标准输出与错误已交给 procd 写入系统日志。下一次开启 TerryClash 后，可通过 `logread | grep mihomo` 查看实际命中的规则和核心错误。升级保持原有订阅、脚本、选择缓存及关闭状态。

路由器已将 Claude 组固定为“尊-新加坡-1线 | 专线”，隔离代理测试得到 `https://claude.ai/login`；正式透明接管尚未复测。

## 0.1.0-r10 节点地址直连排除

透明转发规则将当前订阅中以 IP 地址指定的代理节点加入 IPv4/IPv6 直连排除集合。局域网内仍运行 Clash 的设备因此不会把连接上游节点的流量再次送进 TerryClash。当前订阅的 35 个 IPv4 节点已通过隔离 nft 集合验证，正式透明接管尚未在用户终端复测。

## 0.1.0-r11 本机 Clash 节点直连

订阅页新增“本机 Clash 节点直连”：可以导入本机 Clash YAML，后端只提取并保存 `proxies[].server` 中的字面 IP，上传的临时 YAML 随请求删除；也可每行输入一个额外 IPv4/IPv6 地址。地址经 nft 校验后保存为 `terryclash.main.bypass_node`，防火墙重建时与当前订阅节点地址合并。当前本机 Clash 配置的 35 个节点 IP 已导入；本机订阅更新后需重新导入。服务保持关闭。

## 0.1.0-r13 网络总览首页

LuCI 服务菜单新增“首页”，将服务启停、运行状态、默认策略链、最近节点延迟、实时上下行速率和 IPv4/IPv6/DNS 接管状态放到同一页；订阅、代理、规则页不再重复显示状态区。站点连通性默认包含 Google、YouTube、哔哩哔哩，支持自定义添加和删除；检测通过路由器 Mihomo HTTP 入口按当前规则发起 HEAD 请求，显示 HTTP 响应与耗时。服务关闭时不发起站点检测。

设备验收：r13 已安装；桌面 1280px 与手机 375px 实页无横向溢出，站点增删通过；隔离 Mihomo 实例检测得到 Google 204、YouTube 200、哔哩哔哩 200。正式透明接管仍未开启，以保留当前连接。

## 0.1.0-r15 局域网分流

LuCI 新增“局域网”类目。上方分别填写走代理和走直连的客户端源 IP 或 CIDR；直连优先。代理名单为空时，除直连名单外的局域网设备延续默认透明代理；代理名单非空时，仅名单内设备被接管。IPv4、IPv6 分别按各自源地址匹配。下方是迁入的“下游 Clash 节点直连”，用于排除下游 Clash 上游节点的目标 IP。

保存名单时使用 nft 校验地址；启用源地址分流时，将 Mihomo DNS 增强模式设为 redir-host，防止直连设备收到 fake IP；清空名单后恢复订阅原 DNS 模式。设备验收：r15 已安装，桌面/手机页面及菜单通过、保存与清空名单后 DNS 模式切换通过、无效 IP 拦截通过、nft 规则语法通过。服务保持关闭，透明转发尚未对真实客户端启用复测。

## 0.1.0-r16 分流类目

将 LuCI 菜单和页面标题从“局域网”改为“分流”；页面内仍以“局域网设备分流”标明源 IP 设置区。更新页面资源版本以避开浏览器旧缓存。

## 0.1.0-r17 QUIC 防直连

运行配置在自定义规则和订阅规则前插入 `AND,((NETWORK,UDP),(DST-PORT,443)),REJECT`。订阅节点无法承载 UDP 时，Mihomo 原先会将 HTTP/3 请求回退到 DIRECT，导致 Claude 等站点出现出口不一致；现在浏览器会改用 TCP，并继续按域名规则走代理。该规则会让所有经 TerryClash 接管的 HTTP/3 流量回退到 TCP。
