# OpenRad 路由器单实例最小实现

此目录仅用于真实路由器的单实例试验，不属于 TerryClash r17 安装包。主机显示名为 `TerryClash-Router-MVP`；网络名称、密码和身份文件不随代码发布。

指定外网成员的 P2P 尚未实现。2026-11-23 已完成停止代理、被动协商、随机 UDP 端口与早期构建对照，结果仍为中继。用户要求结束实验后，路由器上的 OpenRad、身份、测试脚本和依赖已全部移除；继续项目先读 [最新交接](HANDOFF_2026-11-23.md)，勿直接照旧部署记录操作。

上游固定为 OpenRad 2.4.5，提交 `c7111577ffdfb4ab48ef4ba108ddbcf3ca07795c`。通过独立的 GitHub Actions 工作流构建 x86_64 musl 静态 CLI，不在路由器上编译。

## 运行边界

- 单实例运行在 `or-mvp` 网络命名空间，veth 为 `or-mvp-host` 与 `or-mvp-peer`，传输网段为 `10.203.17.0/30`。启动前检查冲突；当前脚本要求 WAN 为 `eth1`。
- 实例 IPv4 出口单独做 NAT，实例 DNS 使用独立 resolv.conf；首轮不启用 IPv6，不接入局域网主机。
- 在 TerryClash 三条接管链和独立 DNS 劫持链最前方，为专用 veth 添加带 `openrad-mvp` 注释的返回规则。fw4 仅放行该 veth 到 WAN 的转发，不改默认策略。
- 独立 guard 表阻止实例访问主路由器服务及私网目的，并阻止 LAN 与实例互相转发。命名空间内仅允许虚拟网卡的 ICMP echo 和专用 TCP 39090 测试入口，禁止内层转发。
- OpenRad 引擎使用专用非特权用户；只允许根拥有的固定二进制执行 TAP helper。procd 前台监管，限制地址空间、文件描述符、core 和优先级，不开启开机自启。

## 文件与权限

| 文件 | 路由器目标位置 | 权限或用途 |
| --- | --- | --- |
| 静态 CLI | `/usr/libexec/openrad-mvp/openrad` | root 拥有，0755，部署前后校验 SHA256 |
| `network.sh` | `/usr/libexec/openrad-mvp/network.sh` | root 拥有，0755 |
| `watchdog.sh` | `/usr/libexec/openrad-mvp/watchdog.sh` | root 拥有，0755 |
| `openrad-mvp.init` | `/etc/init.d/openrad-mvp` | root 拥有，0755，不 enable |
| 实例身份目录 | `/etc/openrad-mvp/profile` | 实例用户拥有，0700，持久保存，退出不删除身份 |
| 临时状态 | `/tmp/openrad-mvp` | root 拥有，0700 |
| 临时日志 | `/tmp/openrad-mvp-logs` | 实例用户拥有，0700，不公开原始日志 |
| TAP 助手授权 | `/etc/sudoers.d/openrad-mvp` | root 拥有，0440，由 visudo 校验 |

先准备停止清理与独立于 SSH 会话的 watchdog，再执行 `network.sh up`。watchdog 到期后停止服务并撤销试验网络。`network.sh down` 只按固定资源名和规则注释清理本实例；不删除用户、依赖包或身份文件。

注册时先用 `init --node-name TerryClash-Router-MVP` 创建身份，再以前台服务方式启动。加入网络使用 `join NETWORK --password-file FILE`，密码仅通过 SSH stdin 写入实例用户可读的临时文件，命令结束后立即删除。所有 CLI 命令均在同一命名空间、同一实例用户和数据目录下执行。

## 构建适配

`tools/prepare_openrad.py` 增加独立 `router-headless` feature：新建私有文件身份时允许系统没有桌面凭据库；既有文件身份检查仍保留。另修复 glibc 与 musl 的 `msghdr`、`cmsghdr` 长度类型差异，接收后的指针运算统一使用 usize。

构建工作流运行上游 CLI 测试，再构建 musl 二进制，并检查不存在动态解释器。上述测试不能代替路由器真实加入网络和外部互通验证。

## 验收与清理

必须验证网络加入、有效成员关系、外部成员认证、双向有效载荷及完整绕过 TerryClash。记录 P2P 或 Radmin 中继类型；同一家庭 LAN 内的 Windows 客户端只能作为补充测试，不能替代外部互联网客户端。

TerryClash 或 fw4 重载可能删除临时插入的规则；此原型不声称已经实现重载后的自动恢复。试验期间不得依赖丢失的规则继续宣称“已绕过”，应重新检查并受控恢复或停止试验。

结束时先停止服务，再执行 `network.sh down`，检查 TerryClash 和管理连接。未经长期部署验证，不添加开机自启。网络及凭据的试验结果另记在不包含秘密的测试记录中。

## P2P 比较模式

`host-network.sh` 在已有临时网络中设置主网络比较模式，依赖 nsenter。进程保持非特权用户和专用 resolver 挂载，网络命名空间切回宿主，外层连接直接使用 WAN，避免额外 veth NAT。TAP 此时创建在主网络中，内层转发仍被禁止，未接入 LAN 主机。

服务启动后必须移除仅由该 TAP 新增的 `224.0.0.0/4` 和 `255.255.255.255/32`、metric 500 路由，避免影响原 LAN 组播；不得删除其他接口的路由。

UDP 端口池为 40000–40015。TCP 动态集合仅记录 UID 999 实际发出的 TCP 源端口，90 秒超时，最多 128 项，供 WAN 回连使用，不开放全部 TCP 端口。未配置光猫或 UPnP。network.sh 清理此模式时会停止实例并删除自建 guard 表、fw4 集合和带试验注释的规则。

适配层新增 TCP 回连监听、协调源端口复用、候选回显过滤及有界协商窗口。`OPENRAD_P2P_GRACE_SECS` 限定 4–25 秒；`OPENRAD_PASSIVE_SECONDS` 限定 0–60 秒。被动窗口构建已编译但未部署，不能把源码设置当作当前路由器行为。
