# OpenRad 路由器最小实现测试记录

日期：2026-11-23，Asia/Shanghai。

## 已完成的验证

目标为 ImmortalWrt 25.12.2 x86_64、Linux 6.12.103，TerryClash r17 保持运行。试验直接在真实路由器上进行，没有电脑端模拟阶段。

OpenRad 2.4.5 固定提交 `c7111577ffdfb4ab48ef4ba108ddbcf3ca07795c`。已处理无桌面凭据库的私有文件身份初始化、musl 的辅助消息长度字段和 ioctl 请求类型差异。

| 验证项 | 结果 |
| --- | --- |
| musl CLI 测试及静态构建 | GitHub Actions 通过，检查不存在动态解释器 |
| 二进制部署校验 | SHA256 与构建附件一致，路由器可运行 |
| 身份注册 | 成功，主机名为 TerryClash-Router-MVP，获得独立虚拟地址 |
| TAP 数据接口 | 创建成功，配置分配的虚拟地址 |
| 私有网络加入 | 通过网络名称及受保护的临时密码文件成功加入，成员资格有效 |
| 认证成员连接 | 与同网络两台在线成员建立 Authenticated Relay 连接 |
| 内层 ICMP | 两个成员各 3 次往返均成功，无丢包；服务重连后再次通过 |
| 出口路径 | 专用命名空间经 veth、独立 NAT 和原 WAN 出口通信 |
| 绕过 TerryClash | nft trace 覆盖实例 TCP/UDP 路径，命中专用 return，未观察到 TPROXY 或代理重定向动作 |
| Mihomo 交叉验证 | 连接 API 中没有源地址为实例传输地址的连接 |
| DNS 路径 | 专用 resolv.conf 和 DNS 劫持链 return 规则生效，绕过计数增长 |
| 服务停止与重启 | 停止后 TAP 消失；重启恢复同一身份、主机名、TAP 和网络成员关系 |
| 网络清理 | network.sh down 连续执行两次成功，临时命名空间、规则及表均清理；随后重新建网成功 |
| 主路由器状态 | TerryClash 运行；TerryClash、DHCP 和 firewall 配置文件 SHA256 保持原值 |
| 权限及资源 | 引擎 UID/GID 999，实测 VmRSS 4352 KiB、8 线程；地址空间上限 384 MiB，文件描述符上限 8192 |
| 密码清理 | 加入命令结束后临时密码文件已删除，源码和发布文件不包含该密码 |

成功构建：[GitHub Actions 45099054375](https://github.com/terry-xu-2077/terry_clash/actions/runs/45099054375)。

静态 CLI 大小：6,471,536 字节。SHA256：`c57e37e1ee201334c3a92a5f0cdd4a13ed355d29603bf05a312b91fb9a860e86`。

首次稳定 ICMP 测试平均往返约为 423 ms 和 398 ms。重连后部分初始报文等待成员通道恢复，延迟升高，不能把它当作稳定延迟或吞吐性能数据。当前使用 Radmin 自身的公网中继，未证明 P2P 直连成功；这与经 Mihomo 代理不同。

## 依赖与安装说明

运行依赖从目标版本的 ImmortalWrt 官方下载源取得，与配置的镜像源抽查内容一致。独立 APK 未通过设备的单文件签名校验，因此没有修改全局信任配置：逐包计算 ADB 元数据 SHA256，与设备现有仓库索引中对应名称、版本的摘要核对，再用 apk 验证数据完整性后，仅对这批明确文件执行本地 allow-untrusted 安装。

12 个包的版本及 SHA256 见 [dependencies.json](dependencies.json)。既有系统包未升级，依赖包和专用用户不属于 network.sh 的运行时清理范围。不要把 allow-untrusted 视作可以跳过来源和摘要验证的通用安装方式。

## 验证边界

- 已证明通过公网 Radmin 中继，与两台网络成员实际交换虚拟网卡报文；两台测试成员是否均位于家庭 LAN 之外，仍需用户确认。不能仅由主机名或中继地址推断其物理网络位置。
- 已验证路由器主动发起的 ICMP 请求与成员回复，未验证外部主机独立主动发起的新会话，以及内层 TCP/UDP 应用有效载荷。
- 观察到外层 TCP 协调与中继连接、UDP 尝试及专用绕过路径；未成功建立的 P2P 路径不能列为互通已通过。
- 首轮仅 IPv4，不声称已验证 IPv6、游戏搜房、广播映射、吞吐上限、长时间稳定性或多主机映射。
- 临时规则在 fw4、dnsmasq 或 TerryClash 重载后的恢复机制尚未产品化，未开启开机自启。
- 此记录不包含网络名称、网络 ID、成员名单、虚拟地址或身份文件。原始抓包、trace 和成员诊断只用于受保护的本次测试，不上传仓库。

## 运行与回滚

服务名为 `openrad-mvp`，网络资源由 `network.sh` 管理。试验启动了独立 watchdog，未取消限时回滚；到期将停止实例并清理临时网络，保留安装的文件和独立身份。当前运行状态应实时查询，不能由本记录推断仍在线。

停止试验按顺序执行 `/etc/init.d/openrad-mvp stop` 和 `/usr/libexec/openrad-mvp/network.sh down`。清理操作不重启或停止 TerryClash，不清空 fw4，也不删除 Radmin 身份。后续重新运行可复用该身份与网络成员关系。
