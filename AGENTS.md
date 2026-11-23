# 项目交接入口

开始修改 TerryClash 前，先读 [BUILD_AND_INSTALL.md](BUILD_AND_INSTALL.md)、[README.md](README.md) 和 `package/terryclash/Makefile`。构建、安装、发布、校验与清理的已验证流程记录在 `BUILD_AND_INSTALL.md`。

本项目在 Windows 上执行本地命令时使用 PowerShell 7；涉及中文或文本读写时先设置 UTF-8，文件读写显式指定 UTF-8。路由器目前可能依赖 TerryClash 提供代理连接；安装、重启或修改 DNS/透明转发前先检查实时服务状态与备用管理通道。不要把路由器密码、SMB 凭据或订阅内容写进项目文件。
