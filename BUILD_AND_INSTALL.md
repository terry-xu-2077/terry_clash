# TerryClash 构建与安装交接

此文档记录 2026-11-20 在本项目中实际使用的 r16 构建和安装流程。新会话先读此文件、`README.md`、`package/terryclash/Makefile`，再检查现场状态；不要把文中的 IP、版本号或服务状态当作永久不变的配置。

## r17 现场修复记录（2026-11-20）

- 问题：Claude 网页和客户端提示所在地区不可用。路由日志中 Claude 的 TCP 443 命中 `RuleSet(Claude)`，但 UDP 443 显示 `doesn't match any rule using DIRECT`。仅切换 Claude 节点没有解决问题。
- 验证：在已启用的全局脚本末尾临时加入 `AND,((NETWORK,UDP),(DST-PORT,443)),REJECT` 后，Claude 网页进入 `/new`。r17 已在 `usr/libexec/terryclash` 的 `build()` 中将这条规则置于自定义规则和订阅规则之前；安装后移除了全局脚本中的临时片段，原脚本恢复。运行配置里该规则恰好一条。
- 路由器已升级至 `0.1.0-r17`，服务运行。Claude 策略组恢复到原来的 `尊-新加坡-1线 | 专线`，网页仍可进入 `/new`，新 TCP 请求在路由日志里命中 Claude 组。UDP 443 在日志里命中 `REJECT`。
- TerryClash 重启后，Windows DNS 缓存可能保留旧 Fake-IP。此次旧缓存 `198.18.0.13` 与新分配的 `198.18.0.58` 不一致，导致本机 curl 证书名校验失败；执行 PowerShell 7 的 `Clear-DnsClientCache` 后恢复，curl TLS 校验通过且 HTTP 302。客户端若仍异常，应先重启客户端或清其 DNS/连接缓存，再复核日志。
- r17 包：`dist/terryclash-0.1.0-r17.apk`，发布 ZIP：`dist/TerryClash-V1-0.1.0-r17-x86_64.zip`；校验值见 `dist/SHA256SUMS-r17`。构建镜像挂载和临时 SMB 服务均已清理。

## 项目与环境

- 项目根目录：`G:\AIGC\TerryClash`；包源码：`package\terryclash`。
- 目标路由器：当次为 `192.168.100.1`，ImmortalWrt 25.12.2 x86_64，使用 APK 包管理。路由器 IP 和版本在下次操作前重新确认。
- 本机：Windows，所有**本地命令**使用 `C:\Program Files\PowerShell\7\pwsh.exe`。涉及中文、文本管道或文本文件读写时，在同一 PowerShell 进程先设置 UTF-8：

  ```powershell
  $Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [Console]::InputEncoding = $Utf8NoBom
  [Console]::OutputEncoding = $Utf8NoBom
  $global:OutputEncoding = $Utf8NoBom
  chcp.com 65001 > $null
  ```

- SDK 版本：`immortalwrt-sdk-25.12.2-x86-64_gcc-14.3.0_musl.Linux-x86_64`。本机 `dist\sdk\build.ext4` 是已准备好的 8 GiB Linux 构建镜像；SDK 在其中，构建时由路由器挂载并运行 Ubuntu chroot。本机 `dist\sdk\immortalwrt-sdk-...` 目录也存在，但上次成功构建实际使用的是 `build.ext4`。
- Python 依赖：本机 `paramiko` 用于 SSH 和传文件，`impacket` 用于 `tools\sdk_smb_server.py` 的临时 SMB 服务。Python 包只在缺失时再安装。
- `dist\` 被 `.gitignore` 忽略；包含大镜像、安装包、临时 SMB 凭据。不要把 `dist\.sdk_smb_credentials.json`、路由器密码或订阅内容写进文档、日志或源码。

## 修改源码后的版本规则

1. 修改 `package\terryclash\files` 下的 LuCI、rpcd、Shell 等文件；包版本由 `package\terryclash\Makefile` 的 `PKG_VERSION` 和 `PKG_RELEASE` 决定。每次发布递增 `PKG_RELEASE`。r16 对应 `0.1.0-r16`。
2. 改动 LuCI 菜单或页面后，核对 `files\usr\share\luci\menu.d\luci-app-terryclash.json` 的菜单路径和 JS 文件名。为避开浏览器旧缓存，上次将 `lan_r15.js` 改为 `lan_r16.js`，菜单中的 view path 同步更新；页面 CSS 查询串也改为 `?v=0.1.0-r16`。
3. `Makefile` 的 postinst 会删除 `/tmp/luci-indexcache.*.json`，并重启 rpcd/uhttpd。升级后仍应检查菜单缓存和静态资源实际版本。
4. 更新 `README.md` 的当前安装包名和版本记录；发布时复制到 `dist\README.md`。

## 构建：2026-11-20 已验证流程

下述步骤在路由器上占用临时挂载点。先确认挂载点未被其他任务使用，且 SMB 服务地址与本机 LAN 地址一致。示例本机地址为 `192.168.100.173`；若地址变化，要同步修改 `tools\sdk_smb_server.py` 中的监听地址和路由器挂载命令。所有路由器命令通过 SSH 执行；本机用 PowerShell 7 启动 Python/Paramiko，不调用 Windows CMD、Git Bash 或 WSL。

1. 本机启动临时 SMB 服务：

   ```powershell
   $server = Start-Process -FilePath (Get-Command python).Source -ArgumentList 'tools/sdk_smb_server.py' -WorkingDirectory 'G:\AIGC\TerryClash' -WindowStyle Hidden -PassThru
   $server.Id
   ```

   服务共享 `G:\AIGC\TerryClash\dist\sdk` 为 `//<本机IP>/SDK`，TCP 1445，SMB2。用户名 `tcsdk`，密码从本机 `dist\.sdk_smb_credentials.json` 的 `password` 字段读取，不要输出。不要把服务器保留为长期服务。

2. 用 Paramiko SSH 连接路由器 root。Dropbear 未提供 SFTP；上次用 SSH session 执行 `cat > /tmp/tcsdkcred`，再将 `username=tcsdk\npassword=<读取的密码>\n` 字节写入 channel stdin，关闭写入并检查退出码。凭据文件权限设为 600。源码文件也同样用 `cat > <目标路径>` 传送并检查退出码。不要在命令行、输出或日志中打印密码。

3. 在路由器上创建挂载点并挂载镜像；以下是**路由器 SSH 远端命令**：

   ```sh
   mkdir -p /mnt/sdkshare /mnt/tcbuild
   mount -t cifs //<本机IP>/SDK /mnt/sdkshare -o credentials=/tmp/tcsdkcred,port=1445,vers=2.0,mfsymlinks,noserverino
   mount -t ext4 -o loop /mnt/sdkshare/build.ext4 /mnt/tcbuild
   mount --bind /mnt/tcbuild/immortalwrt-sdk-25.12.2-x86-64_gcc-14.3.0_musl.Linux-x86_64 /mnt/tcbuild/ubuntu/workspace
   for x in proc sys dev; do mount --bind /$x /mnt/tcbuild/ubuntu/$x; done
   ```

4. 将本机 `package\terryclash` 中**所有已修改文件**传入路由器镜像的 `/mnt/tcbuild/ubuntu/workspace/package/terryclash/`，保持相对路径。新建文件要传入，删除或改名的旧文件要从镜像中的包源码目录移除，否则可能被一同打入 APK。r16 当次传了 `Makefile`、菜单 JSON、`lan_r16.js`，并移除了旧 `lan_r15.js`。下一次不能只照搬这三个文件，须按实际变更同步。
5. 在路由器上执行构建，日志留在 chroot 内 `/tmp/tc-build.log`：

   ```sh
   chroot /mnt/tcbuild/ubuntu /bin/bash -lc 'cd /workspace && make -C package/terryclash TOPDIR=/workspace compile V=s > /tmp/tc-build.log 2>&1; echo build_rc:$?; tail -n 20 /tmp/tc-build.log'
   ```

   必须确认 `build_rc:0`，且输出的 APK 版本与 `Makefile` 一致。产物路径：`/mnt/tcbuild/ubuntu/workspace/bin/packages/x86_64/base/terryclash-0.1.0-r<release>.apk`。
6. 在路由器上把 APK 复制到 `/mnt/sdkshare/`；本机对应 `dist\sdk\terryclash-0.1.0-r<release>.apk`。再复制一份到 `dist\terryclash-0.1.0-r<release>.apk`。用 `Get-FileHash -Algorithm SHA256` 生成 `dist\SHA256SUMS-r<release>` 和 `dist\SHA256SUMS`，一行格式为 `<sha256>  terryclash-0.1.0-r<release>.apk`。发布 ZIP 包含 APK、`install.sh`、`uninstall.sh`、`README.md`、对应 SHA256SUMS；上次用 PowerShell `Compress-Archive` 制作 `dist\TerryClash-V1-0.1.0-r16-x86_64.zip`。

## 安装和验证

先检查目标路由器型号/版本、当前 APK 版本、TerryClash 状态和网络连通性。用户已反馈 Claude 能通过 TerryClash 访问，因此后续升级可能中断当前代理连接；在更新真实路由器前，先确保有不依赖 TerryClash 的管理通道。不要因为旧记录写着“服务关闭”就推断当前仍关闭。

在路由器上通过 SSH 安装具体 APK（不要使用 `install.sh` 的通配寻找方式在有多个 APK 的目录里猜版本）：

```sh
apk add --allow-untrusted /mnt/sdkshare/terryclash-0.1.0-r<release>.apk
```

`install.sh` 用于将**单个** APK 与脚本放在同一目录时的人工安装。升级时 `/etc/config/terryclash` 和 `/etc/terryclash/global.js` 为 conffiles；若 apk 提示生成 `.apk-new`，先比较，勿直接覆盖用户配置。

安装后核对：

```sh
apk info -e terryclash
/etc/init.d/terryclash status
grep -A5 'admin/services/terryclash/lan' /usr/share/luci/menu.d/luci-app-terryclash.json
```

还要核对新 JS 文件在 `/www/luci-static/resources/view/terryclash/`，通过 HTTP 请求该静态资源应返回 200，浏览器实际菜单和页面标题应与源码一致。若看到旧菜单，检查 `/tmp/luci-indexcache.*.json` 内容；r16 安装后缓存已重新生成且包含 `"title": "分流"`、`"path": "terryclash/lan_r16"`。测试服务启停、DNS 或透明转发时，应明确确认不会切断当前管理连接，结束后核对运行状态与用户期望一致。

## 清理临时构建环境

在路由器上按绑定挂载的反序卸载；此操作只针对上面确认由本次构建创建的挂载，不要对其他任务的挂载执行：

```sh
sync
for x in dev sys proc workspace; do umount /mnt/tcbuild/ubuntu/$x; done
umount /mnt/tcbuild
umount /mnt/sdkshare
rm -f /tmp/tcsdkcred
```

本机确认 `Start-Process` 返回的 PID 仍是 `tools/sdk_smb_server.py` 后，用 PowerShell `Stop-Process -Id <PID>` 关闭临时服务。r16 构建后执行了以上清理。

## 备选：GitHub Actions

`.github/workflows/build-apk.yml` 会下载同版本 SDK，校验 SDK 与 Mihomo SHA256 后构建 APK，适合有正常 GitHub 仓库和 Actions 环境时使用。它与上述在路由器运行本机 SDK 镜像的流程不同；本地 r16 安装包是通过上述镜像流程构建的。若换用 Actions，先确认源码和包版本已同步到仓库。
