---
title: "在精简版 Windows 上恢复 WSL2 与 Docker：一次从检测到落地的全过程实录"
published: 2026-08-14T23:00:00+08:00
updated: 2026-08-15T02:55:00+08:00
tags: ["WSL2", "Windows", "Docker", "容器", "DISM", "MSI", "系统重装", "踩坑"]
category: "windows"
---

> 一台 "Ghost 精简版" Windows 11 专业版机器，想用 WSL2 + Docker，结果发现系统镜像把虚拟化组件全部精简掉了。本文完整记录了两个阶段的战斗：第一阶段是检测与原地升级（2026-08-14 深夜），把系统从 26200.7705 完整升级到 26200.9168；第二阶段是重启后的 WSL 升级灾难修复与 Docker Desktop 落地（2026-08-15 凌晨），最终 `docker run hello-world` 点亮引擎。

## 一、任务背景

目标机器：Intel i5-14600KF / 32GB / NVMe 2TB，Windows 11 专业版（Build 26200.7705）。需求：**确认系统是否具备 WSL2 与容器化能力**，并完成 Docker 环境搭建。

## 二、检测阶段：看起来正常，实则千疮百孔

第一轮检测结果：

| 检查项 | 结果 |
| --- | --- |
| CPU 虚拟化 (VT-x / SLAT) | ✅ BIOS 已开启 |
| WSL 版本（Store 版 2.7.11） | ✅ 已安装 |
| `wsl --status` / `wsl -l -v` | ❌ 报错 `Wsl/0x8007041d`（服务超时），无任何发行版 |
| LxssManager / vmcompute / vmms 服务 | ❌ 全部不存在 |
| Windows 功能清单（102 项） | ❌ 无 WSL、VirtualMachinePlatform、Hyper-V、Containers |

**根因确认**：这是一台被深度精简的 Windows 镜像（典型 Ghost 版），组件仓库（WinSxS/CBS）里根本没有虚拟化相关功能包。连恢复环境（reagentc / WinRE）都被删了。硬件没问题，是软件层"缺零件"。

## 三、第一阶段：修复尝试全记录（失败路线图）

> 这一路踩的坑比预想的多得多，每一步都值得记录。

### 3.1 直接启用功能 → 功能名未知

```text
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux, VirtualMachinePlatform -All
# 错误: 0x800f080c 功能名称 Microsoft-Windows-Subsystem-Linux 未知
```

`wsl --install` 也是同样的结局（`WSL_E_INSTALL_COMPONENT_FAILED`）。**"功能名未知"意味着功能包彻底不在镜像里，不是"未启用"**。

### 3.2 下载官方 ISO：一条 8.5GB 的下载历险

- Fido 脚本（Rufus 作者维护）生成微软官方直链：`software.download.prss.microsoft.com`，带 24 小时时效令牌。
- **单连接被限速 1.5MB/s** → 实测发现 CDN 支持 Range 请求 → **分段并行下载**，聚合速度冲到 **74MB/s**，8.5GB 几分钟搞定。
- 中途 **D: 盘（挂载的虚拟盘）神秘消失**，所有下载写入失败（curl 退出码 23），才意识到 D: 不是物理分区——**下载目标必须选稳定盘**。

### 3.3 从 ISO 补装组件 → 没有载荷

- `dism /Online /Enable-Feature /Source:WIM:...` → 依然 `0x800f080c`（在线镜像的清单里没有该功能，给源也没用）。
- 挂载 wim 提取功能包 → 发现 wim 的 Packages 目录里**只有 .mum/.cat 清单，没有 .cab 载荷**；而且 WSL 在 25H2 里是"按需功能"(FOD)，**根本不随安装镜像分发**。手术式补装路线宣告失败。

### 3.4 原地升级修复（setup /auto upgrade）→ 七连败

微软官方对"精简系统"的正规修复是**原地升级**（保留文件和应用）。ISO（26200.8037）比当前系统（7705）新，版本匹配没问题，但每次都在不同步骤暴毙：

| 次数 | 卡住的步骤 | 报错 | 解决 |
| --- | --- | --- | --- |
| v1 | EULA | `User did not accept EULA` (0xC190010E) | 需要应答文件 |
| v2 | 语言选择 | `GetInternationalSettingsFromUnattend 0x8007000D` | 应答文件补 `Microsoft-Windows-International-Core-WinPE` |
| v3 | 产品密钥 | `ProductKeyValidate 0x80070490` | 系统是 KMS 卷激活，加 `/pkey W269N-...`（Pro GVLK） |
| v4 | 驱动安装 | `DriverInstallation 0x80070490` | 补 WinRE（winre.wim + reagentc.exe 从 wim 提取） |
| v5 | 驱动安装 | 同上 | 加 `/migratedrivers none`，无效 |
| v6 | 驱动安装 | 同上 | WinRE 已就位，仍无效 |
| v7 | 驱动安装 | 同上 | 补迁移框架 DLL（migcore.dll 等，从 ISO sources 复制） |
| v8（交互式） | 迁移收集 | `Gather data 0x8007042B`，`ServiceModelRegMigPlugin.dll does not exist` | 补全 migration 插件目录（33 个 DLL）+ acmigration.dll |
| **v9（交互式）** | — | — | **✅ 全程通过，升级成功** |

**关键洞察**：升级程序在 downlevel 阶段要从**当前系统**加载迁移框架（`migcore.dll`）、迁移插件（`%SYSTEM32%\migration\`）和 WinRE——精简镜像把这类"运行时才需要"的组件也删了。**把这些组件从官方 wim 补齐后，交互式升级可以成功**。

### 3.5 转机：交互式升级 + 补齐运行时组件

期间也制作了 UEFI 启动 U 盘（FAT32 + `dism /Split-Image` 拆分 7GB 的 install.wim），但用户否决了 U 盘/双系统路线，于是回到升级修复。**静默模式（/quiet）对每个 DLP 动作失败即中止，换成图形化交互式升级后同一套管线走得更远**：

- **v8（交互式第 1 次）**：镜像应用、驱动迁移全部通过，最终卡在**迁移收集**（`Gather data 0x8007042B`，根因是 `ServiceModelRegMigPlugin.dll` 等迁移插件缺失）。
- **v9（交互式第 2 次）**：从 wim 补全整个 `C:\Windows\System32\migration\` 插件目录（33 个 DLL）+ `acmigration.dll` 后，**全程通过**：迁移收集 → 驱动迁移 → 组件分期 → 迁移应用 → 自动重启。

**第一阶段成果**：系统从 26200.7705 升级到 **26200.9168**（动态更新自动带上最新累积更新），个人文件与应用设置完整迁移，旧系统完整保留在 `Windows.old`（确认无误后可删除）。WSL + VirtualMachinePlatform 两个功能随后启用成功，系统提示重启生效。

## 四、第二阶段：重启后的 WSL 升级灾难

> 重启之后，WSL 并没有如预期那样恢复可用，反而抛出了一个更隐蔽的错误。这一阶段的排查对象从"缺失组件"变成了"残留状态"。

### 4.1 表面恢复 ≠ 真正可用

重启后功能已生效，但所有 wsl 命令——`wsl --version`、`wsl --install`、甚至 `wsl --shutdown`——一律输出：

```text
WSL 正在完成升级...
灾难性故障
错误代码: Wsl/CallMsi/Install/E_UNEXPECTED
```

注意两点：其一，错误发生在"**完成升级**"这个动作上，说明系统认为有一次升级处于未完成状态；其二，Windows Installer 事件日志显示，**每次调用 wsl.exe 都会触发一次 WSL MSI 的"重配置"事务，且状态码为 0（成功）**——MSI 本身没坏，坏的是触发它之前的判定逻辑。

### 4.2 逐层排查：五个检查点

1. **功能与组件层**：DISM 查询确认 `Microsoft-Windows-Subsystem-Linux` 与 `VirtualMachinePlatform` 均已启用；Appx 包（2.7.11.0）状态 Ok；`C:\Program Files\WSL\` 下 wsl.exe、wslservice.exe 等组件齐全且版本一致。**不是缺组件**。
2. **MSI 注册层**：产品注册信息里 `DisplayVersion` 为 2.7.11.0、`InstallState` 为 5（已安装），但 **`InstallLocation` 为空**——这与 WSL 官方仓库 issue #12623 中 WSL 团队确认的根因完全吻合：**InstallLocation 注册表值缺失，手动重装可解**。
3. **手动安装 MSI**：从 GitHub Releases 下载同版本 MSI（wsl.2.7.11.0.x64.msi）执行 `msiexec /i`，**退出码 1603**。verbose 日志给出两个关键信号：属性表里 `MsiSystemRebootPending = 1`（安装器判定系统存在待重启状态），以及自定义操作 `ValidateInstall` 返回 3（失败）。
4. **追踪待重启状态来源**：常见的重启标记（CBS RebootPending、WU RebootRequired、RunOnce）都不存在，真正的来源是 **`PendingFileRenameOperations`——里面有 70 条 Norton 卸载残留的删除队列**（这台封装镜像里 Norton 服务早已停用，但删除队列一直没清）。MSI 正是据此判定"系统待重启"。
5. **镜像封装残留**：`WindowsUpdate\Auto Update` 下的 **`IsOOBEInProgress = 1`**（首次开机流程标记）也是封装遗留，同样会干扰系统级安装。

### 4.3 三个修复动作

按"从轻到重"的顺序执行：

1. **清除 `IsOOBEInProgress` 残留标记**（置 0）→ 重试，无效，错误依旧。
2. **备份并清空 `PendingFileRenameOperations`**（先 `reg export` 备份整个 Session Manager 键到 `session_manager_backup.reg`，再删除该值）→ `MsiSystemRebootPending` 消失，但 `ValidateInstall` 仍然返回 3，1603 依旧。
3. **关键一步：先卸载、再全新安装**。既然同版本 MSI 进入的是"维护模式/重配置"路径（日志里 `Skipping RemoveExistingProducts: current configuration is maintenance mode or an uninstall`），那就 `msiexec /x {497CB23D-8747-4047-A079-DD98E0EDFC18}` 彻底卸载产品，随后 `msiexec /i` 全新安装 → **退出码 0，安装成功**。

修复效果立竿见影：

```text
$ wsl --version
WSL 版本: 2.7.11.0
内核版本: 6.18.33.2-2
WSLg 版本: 1.0.73.2
默认版本: 2
```

### 4.4 Docker Desktop 落地

WSL 恢复后，Docker 安装一路顺畅：

1. **安装**：`winget install -e --id Docker.DockerDesktop`（4.86.0），安装器自动校验哈希，一次成功。
2. **启动**：启动 Docker Desktop 后引擎数分钟内就绪——Server: Docker Desktop 4.86.0，Engine 29.7.2（linux/amd64），containerd v2.2.5。
3. **验证**：`docker run --rm hello-world` 成功拉取镜像并运行，输出 "Hello from Docker!"。
4. **PATH**：安装器已将 `C:\Program Files\Docker\Docker\resources\bin` 写入系统 PATH。若在旧终端里遇到 `docker-credential-desktop: executable file not found`，是会话 PATH 未刷新的表象，新开终端即正常。

## 五、经验总结

1. **"功能名未知"（0x800f080c）≠ "功能未启用"**：前者说明镜像里根本没这个功能，任何 /Source 都救不了。
2. **深度精简镜像（Ghost 版）的升级修复并非无解，但要补齐运行时组件**：setup 的 downlevel 阶段强依赖当前系统的迁移框架（migcore.dll）、迁移插件（`%SYSTEM32%\migration\`）和 WinRE，精简系统删掉的恰恰是这些。报错 `0x80070490`（找不到元素）几乎总是"某个被删的运行时组件"的信号，去 `migration` 和 `Recovery` 目录与官方 wim 对账补齐即可。
3. **静默升级失败 ≠ 升级无望**：`/quiet` 模式下任意 DLP 动作失败即中止；改用**交互式升级**（GUI）后同一套管线能走得更远，错误信息也更明确。
4. **硬件虚拟化支持 ≠ 系统能用 WSL2**：WSL2 需要 `Microsoft-Windows-Subsystem-Linux` + `VirtualMachinePlatform` 两个系统功能，缺一个都是 0x8007041d。
5. **"灾难性故障 E_UNEXPECTED" 的排查顺序**：先看 MSI verbose 日志（`msiexec /i ... /l*v`），定位失败的 custom action 与 `MsiSystemRebootPending` 属性；再反向追踪待重启标记的来源（`PendingFileRenameOperations`、CBS、WU），清掉残留后再重试。**"升级进行中"的判定卡死，往往不是缺文件，而是残留状态没清**。
6. **同版本 MSI 修复失败时，先卸载再装**：维护模式（重配置）走的是另一条执行路径，`ValidateInstall` 等自定义操作的行为与全新安装不同；卸载后全新安装常常直接绕开问题。
7. **封装/克隆镜像的残留标记会以奇怪的方式阻塞系统级安装**：`IsOOBEInProgress`、Norton 删除队列这类与"当前任务"无关的残留，会通过待重启判定间接导致 MSI 安装失败（1603）。排查系统级安装失败时，值得把这类"体检项"纳入检查清单。
8. **自动化排查的黄金法则**：每一步都留日志、验证产物、先小样后大样（先下 10MB 验内容再下 8.5GB）。

## 六、最终结果与数据

### 6.1 时间线（2026-08-14 → 08-15）

| 时间 | 事件 |
| --- | --- |
| 21:26 | 任务开始：检测 WSL2 / 容器化能力 |
| 21:30-21:45 | 检测完成，定位精简镜像根因；并行加速下载官方 ISO |
| 22:00-23:20 | DISM 补装三路失败；静默升级 v1-v7 七连败（EULA→语言→密钥→驱动） |
| 23:28 | 交互式升级 v8 → 卡迁移收集（缺迁移插件） |
| 00:10 | 补全 35 个迁移组件（33 插件 + acmigration.dll + ServiceModelRegMigPlugin.dll） |
| 00:24 | 交互式升级 v9 启动 |
| 00:55 | **升级完成，自动重启进入新系统（26200.9168）** |
| 01:18 | WSL + VirtualMachinePlatform 功能启用成功（重启生效） |
| 02:20 | 第二阶段开始：wsl 全部命令报 `Wsl/CallMsi/Install/E_UNEXPECTED` |
| 02:21-02:33 | 逐层排查：功能/组件/注册层均正常；确认 `InstallLocation` 缺失、`MsiSystemRebootPending=1` |
| 02:33-02:42 | 清除 `IsOOBEInProgress` 与 Norton 删除队列残留；MSI 仍 1603 |
| 02:43 | **卸载后全新安装 WSL MSI 2.7.11.0 → 成功，wsl 命令恢复** |
| 02:44-02:53 | winget 安装 Docker Desktop 4.86.0 → 引擎就绪 → `hello-world` 验证通过 |
| 总耗时 | **约 5.5 小时**（两阶段合计，含 8.5GB 镜像下载与两次安装尝试） |

### 6.2 会话消耗（AI 助手侧）

第一阶段（精简镜像升级）会话消耗：

| 指标 | 数值 |
| --- | --- |
| 输入 tokens（累计） | 约 15.4 万 |
| 输出 tokens（累计） | 约 25.6 万（其中推理 tokens 13.5 万） |
| 缓存读取 tokens | 约 5471 万 |
| LLM 用量记录（工具步骤） | 259 条 |

第二阶段（WSL 修复 + Docker 落地）会话消耗未单独统计，工具调用主要集中在：DISM/注册表查询与修改、MSI 安装与日志分析、GitHub API 取包、winget 安装与引擎验证。

### 6.3 解决的问题（16 项）

第一阶段（10 项）：

1. 定位 WSL2 不可用根因：`0x8007041d` → 精简镜像缺失 WSL/VMP 功能组件
2. 微软 CDN 单连接限速 1.5MB/s → 分段并行下载提速至 74MB/s
3. D 盘虚拟盘中途消失导致下载失败 → 换稳定盘并绕过
4. 澄清"功能名未知"（0x800f080c）≠ "未启用"，DISM /Source 无法补装
5. 静默升级 EULA 失败 → autounattend.xml 应答文件
6. 语言选择失败 → 应答文件补 International-Core-WinPE
7. 产品密钥校验失败 → /pkey 传入 Pro GVLK
8. 驱动安装 0x80070490 → 部署 WinRE + 迁移框架 DLL
9. 迁移收集 0x8007042B → 补全 35 个迁移组件 → **升级成功**
10. WSL + VirtualMachinePlatform 功能启用成功

第二阶段（6 项）：

11. `Wsl/CallMsi/Install/E_UNEXPECTED`（升级完成判定卡死）→ 定位为 MSI 判定链问题而非组件缺失
12. `MsiSystemRebootPending=1` 干扰安装 → 备份并清空 `PendingFileRenameOperations` 中 70 条 Norton 删除队列残留
13. 封装镜像残留 `IsOOBEInProgress=1` → 清除
14. 同版本 MSI 维护模式重配置失败（1603）→ 先卸载再全新安装 → **WSL 2.7.11.0 恢复可用**
15. Docker Desktop 安装与启动 → winget 一次成功，引擎 29.7.2 就绪
16. 端到端验证 → `docker run hello-world` 通过

### 6.4 当前状态与待办

- ✅ 系统：Windows 11 **26200.9168**（完整镜像，非精简）
- ✅ WSL2：2.7.11.0 正常可用（内核 6.18.33.2-2，默认版本 2）
- ✅ Docker Desktop：4.86.0 已安装并启动，`hello-world` 验证通过，`docker` 命令已入系统 PATH
- ✅ 遗留清理：`session_manager_backup.reg` 保留在 `C:\Users\Administrator\`（PendingFileRenameOperations 备份，确认无误后可删）
- 📦 `C:\iso\Win11_25H2.iso` 按用户要求保留不删；`Windows.old` 确认无误后可删除释放空间
- 📝 后续可选：`wsl --install -d Ubuntu` 安装发行版、配置 Docker 镜像加速
