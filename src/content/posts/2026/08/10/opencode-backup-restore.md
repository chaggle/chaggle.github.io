---
title: "opencode 数据备份与恢复方案"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "opencode", "备份"]
category: "summary"
---

> 用 opencode 写代码、记对话，所有会话历史都存在本地。一旦硬盘损坏或者系统重装，几年的积累就全没了。本文记录我搭建的"NAS 每日备份 + 安全恢复"完整方案，Windows / Linux / macOS 三平台通用。

## 为什么要做备份

opencode 是**本地优先**的 AI 编程助手：会话记录、对话数据库、附件文件都存在本机 `C:\Users\Administrator\.local\share\opencode` 目录下，其中核心是一个 SQLite 数据库 `opencode.db`（当前已经增长到 376MB）。

:::warning
本地优先意味着"数据只存在这一台机器上"。没有备份的情况下，一次磁盘故障、一次误删，所有历史对话就永久消失了。
:::


备份设计遵循两个原则：

- **本机快照**：离数据最近，恢复最快（但本机挂了就一起挂）
- **NAS 镜像**：局域网内独立存储，每日自动增量同步

## 备份方案：绿联云 NAS + robocopy 增量镜像

家里有一台绿联云 NAS（`192.168.137.108`），挂在局域网内。通过 Windows 的 `robocopy` 做**增量镜像同步**，只传输有变化的部分，速度快、支持断点续传。

脚本 `opencode-backup.ps1` 的核心逻辑：

- 源目录：`C:\Users\Administrator\.local\share\opencode`
- 目标目录：`\\192.168.137.108\personal_folder\opencode-backup\opencode`
- 排除临时文件：`*.tmp`、`*.lock`、`*.part`
- `/MIR` 镜像模式：NAS 上多出的文件自动清理，本地删除的文件也会从 NAS 上同步删除

:::note
**为什么要排除临时文件**：SQLite 运行时会生成 WAL/锁文件，直接同步会导致备份副本与主库状态不一致。备份镜像中只保留稳定的数据文件。
:::


几个关键设计：

- **24 小时间隔**：脚本放入开机自启，每次启动检查"上次成功备份时间"，不足 24 小时直接跳过，一天至多一次
- **凭据安全**：NAS 登录凭据存在 Windows 凭据管理器（`cmdkey`），脚本里不含任何密码明文
- **日志审计**：每天一份日志 `logs/opencode-backup-YYYYMMDD.log`，保留 30 天，出问题可回溯

完整脚本 `tools/opencode-backup.ps1`：

```powershell
# opencode-backup.ps1
# 每日增量备份 opencode 数据目录到绿联云 NAS (192.168.137.108)
# 触发方式：开机自启（Startup 文件夹），内置 24 小时间隔检查，一天至多备份一次
# 凭据使用 Windows 凭据管理器中的 cmdkey 记录，脚本内不含任何密码
$ErrorActionPreference = 'Stop'

$src = 'C:\Users\Administrator\.local\share\opencode'
$dst = '\\192.168.137.108\personal_folder\opencode-backup\opencode'
$logDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("opencode-backup-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))
$marker = Join-Path $logDir '.last-backup'

function Log($msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

# 0. 24 小时间隔检查：距上次成功备份不足 24 小时则跳过
if (Test-Path $marker) {
  $last = (Get-Item $marker).LastWriteTime
  if ($last -gt (Get-Date).AddHours(-24)) {
    Log 'SKIP: last backup within 24h, skip this run'
    exit 0
  }
}

Log '==== opencode backup start ===='

# 1. 检查 opencode 是否在运行（运行中复制 WAL 三件套可能不一致，仅告警）
$proc = Get-Process -Name 'opencode' -ErrorAction SilentlyContinue
if ($proc) { Log 'WARN: opencode is running, sqlite backup may be inconsistent' }

# 2. 确认 NAS 可达
if (-not (Test-Path '\\192.168.137.108\personal_folder')) {
  Log 'ERROR: NAS share unreachable'
  exit 1
}

# 3. robocopy 增量镜像同步（目标端为专用备份目录，/MIR 安全）
# 排除临时/锁文件；保留 30 天日志由计划任务侧清理
$null = robocopy $src $dst /MIR /R:2 /W:3 /XF *.tmp *.lock *.part /NP /LOG+:$logFile /TEE
$code = $LASTEXITCODE

# robocopy 退出码 0-7 均为成功，>=8 为失败
if ($code -lt 8) {
  Log "OK: robocopy exit=$code, backup completed"
  New-Item -ItemType File -Path $marker -Force | Out-Null
} else {
  Log "ERROR: robocopy exit=$code"
}

# 4. 清理 30 天前的日志
Get-ChildItem $logDir -Filter 'opencode-backup-*.log' |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

Log '==== opencode backup end ===='
exit $code
```

### Linux / macOS：rsync + SSH

Windows 脚本依赖 `robocopy` 和 SMB 共享，Linux/macOS 上换成 **`rsync` + SSH**，一套脚本两个平台通用（两个系统都自带 rsync）。

完整脚本 `tools/opencode-backup.sh`：

```bash
#!/usr/bin/env bash
# opencode-backup.sh
# 每日增量备份 opencode 数据目录到绿联云 NAS (rsync + SSH)
# 适用于 Linux / macOS（两个平台均自带 rsync）
# 用法:
#   ./opencode-backup.sh                     # 默认备份到 NAS（SSH + rsync）
#   NAS_REMOTE=user@host:/path ./opencode-backup.sh  # 自定义 NAS 地址/路径
# 定时: Linux 用 crontab，macOS 用 launchd 或 crontab
# 免密: Linux: ssh-copy-id $NAS_USER@$NAS_HOST
#       macOS: cat ~/.ssh/id_rsa.pub | ssh $NAS_USER@$NAS_HOST "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
set -euo pipefail

# 可配置项（按自己环境修改）
NAS_HOST="192.168.137.108"
NAS_USER="${NAS_USER:-admin}"
# 绿联 UGOS 共享目录默认挂载在 /volume1 下，如路径不同请修改
NAS_REMOTE="${NAS_REMOTE:-$NAS_USER@$NAS_HOST:/volume1/personal_folder/opencode-backup/opencode}"

SRC="$HOME/.local/share/opencode"
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/opencode-backup-$(date +%Y%m%d).log"
MARKER_FILE="$LOG_DIR/.last-backup"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }

# 0. 24 小时间隔检查：距上次成功备份不足 24 小时则跳过
if [ -f "$MARKER_FILE" ] && [ "$(find "$MARKER_FILE" -mmin -1440 | wc -l)" -eq 1 ]; then
  log 'SKIP: last backup within 24h, skip this run'
  exit 0
fi

log '==== opencode backup start ===='

# 1. 检查 opencode 是否在运行（运行中复制 sqlite 可能不一致，仅告警）
if pgrep -x opencode >/dev/null 2>&1; then
  log 'WARN: opencode is running, sqlite backup may be inconsistent'
fi

# 2. 检查源目录
if [ ! -d "$SRC" ]; then
  log "ERROR: source dir missing: $SRC"
  exit 1
fi

# 3. rsync 增量镜像同步（排除临时/锁文件）
if ! rsync -avz --delete --timeout=60 \
  --exclude '*.tmp' --exclude '*.lock' --exclude '*.part' \
  -e ssh "$SRC/" "$NAS_REMOTE/"; then
  log "ERROR: rsync failed"
  exit 1
fi

log 'OK: backup completed'
touch "$MARKER_FILE"

# 4. 清理 30 天前的日志
find "$LOG_DIR" -name 'opencode-backup-*.log' -mtime +30 -delete 2>/dev/null || true

log '==== opencode backup end ===='
```

:::note
**SSH 免密配置**：NAS 上需开启 SSH（绿联云：设置 → 终端机 → 开启 SSH）。然后用 `ssh-copy-id admin@192.168.137.108`（Linux）或手动追加公钥（macOS）实现免密登录，脚本才能定时自动执行。
:::


**定时执行**：

- Linux（crontab）：`0 3 * * * /path/to/tools/opencode-backup.sh`
- macOS（launchd 或 crontab）：推荐 crontab 与 Linux 一致，简单够用

## 恢复方案：安全快照 + 演练模式 + 结果校验

备份做得再勤，恢复不出来也是白搭。所以恢复脚本 `opencode-restore.ps1` 设计了**三道保险**：

### 1. 本地安全快照

恢复操作会**覆盖本地现有数据**。万一恢复失败或者从 NAS 拿回来的数据有问题，本地数据也没了——那才是真正的灾难。因此恢复前先把当前本地数据完整镜像到临时目录：

```
SAFETY: local data snapshot -> %TEMP%\opencode-safety-20260810-002133
```

### 2. 演练模式

脚本支持 `-RestoreTo` 参数，把恢复目标指向任意目录，**不碰本地真实数据**。建议每次升级方案后先在临时目录演练一遍：

```powershell
.\opencode-restore.ps1 -RestoreTo C:\temp\opencode-test
```

### 3. 结果校验

- robocopy 退出码 0-7 均视为成功（1 表示有文件复制），大于等于 8 才算失败
- 恢复完成后验证 `opencode.db` 是否存在并检查文件大小，防止"恢复成功但数据库缺失"

完整脚本 `tools/opencode-restore.ps1`：

```powershell
# opencode-restore.ps1
# 从绿联云 NAS 恢复 opencode 数据目录到本地
# 用法:
#   .\opencode-restore.ps1              # 标准恢复（含本地安全快照）
#   .\opencode-restore.ps1 -SkipSafetyCopy   # 跳过本地安全快照
#   .\opencode-restore.ps1 -RestoreTo C:\temp\opencode-test  # 恢复到指定目录（演练用，不覆盖本地）
param(
  [switch]$SkipSafetyCopy,
  [string]$RestoreTo = ''
)

$ErrorActionPreference = 'Stop'

$srcNas = '\\192.168.137.108\personal_folder\opencode-backup\opencode'
$local = 'C:\Users\Administrator\.local\share\opencode'
$logDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$logFile = Join-Path $logDir ("opencode-restore-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))

function Log($msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

Log '==== opencode restore start ===='

# 1. NAS 可达性检查
if (-not (Test-Path $srcNas)) {
  Log 'ERROR: NAS backup dir unreachable, abort'
  exit 1
}
if (-not (Test-Path (Join-Path $srcNas 'opencode.db'))) {
  Log 'ERROR: opencode.db not found on NAS, abort'
  exit 1
}

# 2. 目标目录确认
if ($RestoreTo) {
  $target = $RestoreTo
  Log "Restore target (test mode): $target"
} else {
  $target = $local
}

# 3. 运行中检测：恢复会覆盖本地数据，opencode 运行中禁止
$proc = Get-Process -Name 'opencode' -ErrorAction SilentlyContinue
if ($proc -and -not $RestoreTo) {
  Log 'ERROR: opencode is running, please exit opencode first then retry'
  exit 1
}

# 4. 本地安全快照（防止恢复失败导致数据丢失）
if (-not $SkipSafetyCopy -and -not $RestoreTo) {
  $safety = Join-Path $env:TEMP ("opencode-safety-{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $safety -Force | Out-Null
  $null = robocopy $local $safety /MIR /R:2 /W:3 /NP /NFL /NDL /NJH /NJS
  Log "SAFETY: local data snapshot -> $safety"
}

# 5. 执行恢复（NAS 镜像回本地）
$null = robocopy $srcNas $target /MIR /R:2 /W:3 /XF *.tmp *.lock *.part /NP /LOG+:$logFile /TEE
$code = $LASTEXITCODE
if ($code -lt 8) {
  Log "OK: restore completed (robocopy exit=$code) -> $target"
} else {
  Log "ERROR: restore failed (robocopy exit=$code)"
  exit $code
}

# 6. 校验
try {
  $db = Join-Path $target 'opencode.db'
  if (Test-Path $db) {
    $size = (Get-Item $db).Length
    Log "VERIFY: opencode.db exists, size=$size bytes"
  } else {
    Log 'WARN: opencode.db missing after restore'
  }
} catch { }

Log '==== opencode restore end ===='
```

### Linux / macOS：恢复脚本

与备份脚本对应，`tools/opencode-restore.sh` 同样基于 rsync + SSH，保留 Windows 版的全部三道保险：安全快照、演练模式、结果校验。

完整脚本 `tools/opencode-restore.sh`：

```bash
#!/usr/bin/env bash
# opencode-restore.sh
# 从绿联云 NAS 恢复 opencode 数据目录 (rsync + SSH)
# 适用于 Linux / macOS
# 用法:
#   ./opencode-restore.sh                  # 标准恢复（含本地安全快照）
#   ./opencode-restore.sh -s               # 跳过本地安全快照
#   ./opencode-restore.sh -t DIR           # 恢复到指定目录（演练用，不覆盖本地）
# 免密: 同 opencode-backup.sh，需先配置 SSH 公钥
set -euo pipefail

# 可配置项（与备份脚本保持一致）
NAS_HOST="192.168.137.108"
NAS_USER="${NAS_USER:-admin}"
NAS_REMOTE="${NAS_REMOTE:-$NAS_USER@$NAS_HOST:/volume1/personal_folder/opencode-backup/opencode}"

LOCAL="$HOME/.local/share/opencode"
LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/opencode-restore-$(date +%Y%m%d).log"

SKIP_SAFETY=0
TARGET=""

usage() {
  echo "用法: $0 [-s] [-t DIR]"
  echo "  -s         跳过本地安全快照"
  echo "  -t DIR     恢复到指定目录（演练模式，不覆盖本地）"
  exit 0
}

while getopts "st:h" opt; do
  case $opt in
    s) SKIP_SAFETY=1 ;;
    t) TARGET="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG_FILE"; }

log '==== opencode restore start ===='

# 1. NAS 可达性检查
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$NAS_USER@$NAS_HOST" \
  "test -d /volume1/personal_folder/opencode-backup/opencode" 2>/dev/null; then
  log 'ERROR: NAS backup dir unreachable (SSH), abort'
  exit 1
fi

# 2. 目标目录确认
if [ -n "$TARGET" ]; then
  DEST="$TARGET"
  log "Restore target (test mode): $DEST"
else
  DEST="$LOCAL"
fi

# 3. 运行中检测：恢复会覆盖本地数据，opencode 运行中禁止
if pgrep -x opencode >/dev/null 2>&1 && [ -z "$TARGET" ]; then
  log 'ERROR: opencode is running, please exit opencode first then retry'
  exit 1
fi

# 4. 本地安全快照（防止恢复失败导致数据丢失）
if [ "$SKIP_SAFETY" -eq 0 ] && [ -z "$TARGET" ] && [ -d "$LOCAL" ]; then
  SAFETY="$HOME/opencode-safety-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$SAFETY"
  rsync -a "$LOCAL/" "$SAFETY/"
  log "SAFETY: local data snapshot -> $SAFETY"
fi

# 5. 执行恢复（NAS 镜像回本地）
if ! rsync -avz --delete --timeout=60 \
  --exclude '*.tmp' --exclude '*.lock' --exclude '*.part' \
  -e ssh "$NAS_REMOTE/" "$DEST/"; then
  log "ERROR: restore failed"
  exit 1
fi
log "OK: restore completed -> $DEST"

# 6. 校验
DB="$DEST/opencode.db"
if [ -f "$DB" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    SIZE=$(stat -f%z "$DB")
  else
    SIZE=$(stat -c%s "$DB")
  fi
  log "VERIFY: opencode.db exists, size=$SIZE bytes"
else
  log 'WARN: opencode.db missing after restore'
fi

log '==== opencode restore end ===='
```

:::note
**恢复演练**（跨平台通用）：`./opencode-restore.sh -t ~/opencode-test` 恢复到临时目录验证，确认无误后再执行标准恢复。
:::


## 日常使用

**手动备份**（一般不需要，开机自启会自动跑）：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\opencode-backup.ps1
```

**完整恢复**（先退出 opencode，脚本会自动拒绝在运行中恢复）：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\opencode-restore.ps1
```

**快速恢复**（确认本地数据不重要，跳过安全快照）：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\opencode-restore.ps1 -SkipSafetyCopy
```

### Linux / macOS

**手动备份**：

```bash
./tools/opencode-backup.sh
```

**完整恢复**（先退出 opencode）：

```bash
./tools/opencode-restore.sh
```

**恢复演练**（不覆盖本地数据）：

```bash
./tools/opencode-restore.sh -t ~/opencode-test
```

:::caution
恢复是**覆盖式**操作，会把本地数据替换成 NAS 上的版本。执行前务必确认本地没有比 NAS 更新的对话记录，必要时先手动复制一份。
:::


## 踩过的坑

- **robocopy 退出码**：1-7 是"成功但有复制动作"，8+ 才是失败，直接 `if ($LASTEXITCODE -eq 0)` 判断会误报失败
- **运行中备份的一致性**：opencode 运行时会写数据库，此时备份的副本可能不一致。脚本只告警不阻塞——NAS 副本用于"恢复历史"是够的，但如果追求严格一致，应该在退出 opencode 后备份
- **数据库持续增长**：opencode.db 三个月涨到 376MB，首次全量同步会比较慢，之后增量就快了
- **跨平台差异**：Linux/macOS 脚本用 rsync + SSH 直连 NAS（不依赖挂载）；`stat` 参数两平台不同（Linux `-c%s`，macOS `-f%z`），脚本已兼容；NAS 共享目录的卷路径（`/volume1`）不同机型可能不同，按实际修改脚本顶部配置即可

## 总结

备份这件事，**贵在自动、重在验证**。方案的价值不在于脚本写得多漂亮，而在于：

1. 每天自动跑，不用人记着
2. 恢复有演练，不是纸面流程
3. 单点故障不会全灭
4. 凭据安全，脚本可公开可审计

下次换电脑或者系统重装，一条命令就能把几年的对话历史完整带回来。
