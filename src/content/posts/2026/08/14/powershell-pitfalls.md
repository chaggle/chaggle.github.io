---
title: "PowerShell 实战踩坑大全：从 GBK 乱码到引号地狱的十八个真实案例"
published: 2026-08-14T23:00:00+08:00
updated: 2026-08-15T01:30:00+08:00
tags: ["PowerShell", "Windows", "DISM", "脚本", "踩坑"]
category: "powershell"
---

> 本文是《[在精简版 Windows 上恢复 WSL2 与 Docker：一次从检测到落地的全过程实录](/2026/08/14/windows/wsl2-restore-on-stripped-windows/)》的姊妹篇。那次任务在 PowerShell 上踩的坑，单独值得写一篇。

> 文章按主题分五组：**① 语法与解析 → ② 字符串、转义与输出 → ③ 外部命令与进程调用 → ④ Windows 组件与 DISM → ⑤ 数据与迭代**；每一节都标注了对应的检查规则编号（R1–R17），文末是沉淀成的检查插件与完整映射表。

## 第一部分 · 语法与解析（语言本身的坑）

## 1-1、`$var:` 被解析成"驱动器限定变量"（R2）

```powershell
"attempt $attempt: downloading..."   # 报错: ':' was not followed by a valid variable name
```

PowerShell 把 `$attempt:` 当成 `$env:Path` 那种带作用域/驱动器的语法。解法：**用 ${} 显式界定**：

```powershell
"attempt ${attempt}: downloading..."
```

## 1-2、PowerShell 5.1 没有三元运算符（R3）

```powershell
$v = ($a -gt 0) ? "yes" : "no"   # PS 5.1 直接解析错误！
$v = if ($a -gt 0) { "yes" } else { "no" }  # 正确
```

## 1-3、PowerShell 5.1 没有 `&&` / `||` 链式运算符（R11）

```powershell
git commit && git push   # PS 5.1 直接解析报错；这是 PS 7+ 才有的语法
git commit; git push     # 用分号链式执行
```

`&&`/`||` 是 PowerShell 7 才引入的；5.1 里链式执行用分号，或按退出码判断：`if ($LASTEXITCODE -eq 0) { git push }`。注意 `cmd /c "a && b"` 这类 cmd/bash 内部字符串不受影响。

## 1-4、if/while 条件里用 `=` 当比较（R14）

```powershell
if ($x = 5) { ... }   # 赋值！条件恒真，静默逻辑 bug
if ($x -eq 5) { ... } # 正确：PowerShell 比较运算符是 -eq
```

AI 常把 C/JS 习惯的 `==` 简化成 `=` 写进条件；PowerShell 里 `=` 是赋值，条件恒真且修起来很难找。

## 1-5、PowerShell 7+ 专属语法混入 5.1（R15）

`-AsHashtable`、`ForEach-Object -Parallel`、`-AsByteStream`、`??`（空合并）、`?.`（可选链）都是 PowerShell 7+ 才有；目标机若是 5.1（Windows 自带版本）直接解析报错。AI 默认按 7 写，先确认运行环境或用 5.1 等价写法（如 `-Encoding Byte`）。

## 第二部分 · 字符串、转义与输出（文本层）

## 2-1、双引号里的 `$WINDOWS` 被当成变量展开（R4）

```powershell
Get-Content "C:\$WINDOWS.~BT\Sources\Panther\setupact.log"  # 路径变成 C:\.~BT\...，$WINDOWS 是未定义变量！
Get-Content 'C:\$WINDOWS.~BT\Sources\Panther\setupact.log'  # 单引号才对
```

这个坑导致排查时一度以为日志文件"神秘消失"，浪费了不少时间。

## 2-2、用 JS 模板字符串生成 PowerShell 脚本时的转义地狱（写作侧规则）

在 JS 里写模板字符串生成 .ps1 时，`$($var)`、`${attempt}` 都会被 JS 抢先插值。规则：**所有想保留到 PS 里的 `$` 都要写成 `\$`**，否则报 `attempt is not defined` 这类 JS 错误。

## 2-3、中文控制台 GBK 乱码（R1）

wsl/dism 输出的中文全是乱码（形如 `g?R?l g?S?e?T?^/T?R?`）。原因是控制台代码页是 GBK 而程序输出 UTF-8。每次开头加：

```powershell
chcp 65001 | Out-Null
```

## 2-4、Write-Host 输出不进管道（R17）

```powershell
Write-Host "done"    # 只写控制台，下游 | 捕获不到
Write-Output "done"  # 结果进管道，可被捕获/拼接
```

AI 喜欢用 Write-Host「打印」结果，但它的输出不进成功流；需要返回/捕获结果用 Write-Output 或直接表达式，Write-Host 只适合进度提示。

## 第三部分 · 外部命令与进程调用（调用层）

## 3-1、Start-Process -ArgumentList 的引号与沙箱坑（R5）

- `-ArgumentList` 拼接时**不会自动加引号**，路径含空格会碎参数。
- 后台任务里 `Start-Process curl` 下载的文件**内容损坏**（大小正确、字节全错），直接 `& curl.exe` 则正常。能直接调用就别包一层。

## 3-2、Windows 上 `npm` 被 ExecutionPolicy 拦截（R10）

```powershell
npm run build   # 报错: File C:\nvm4w\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system
```

Windows 装 Node 后 PATH 里同时存在 `npm.ps1` 与 `npm.cmd`，PowerShell 优先解析到 `.ps1`，而默认执行策略禁止运行脚本。解法：**显式调用 `npm.cmd`**（`npx.cmd`、`pnpm.cmd` 同理）：

```powershell
npm.cmd run build
```

## 3-3、cmd 风格命令与 `%VAR%` 环境变量混入（R16）

```powershell
del /f /q file.txt   # cmd 风格：/f /q 会被当成参数，语义与 Remove-Item 不同
%PATH%               # 在 PowerShell 里不会展开！要用 $env:PATH
```

AI 在 Windows 上经常混用 cmd 语法；裸 `del/copy/move/mkdir` 虽能命中别名，但参数语义不同，`%VAR%` 则完全不会展开。

## 3-4、微软 CDN 下载加速（R9，正向收获）

- 单连接 1.5MB/s → 实测 Range 请求单连接 15~20MB/s、突发 71MB/s。
- 做法：HEAD 拿 `Content-Length` → 切成 N 段 → 并行 `curl -r start-end` → `cmd /c copy /b a+b+c out` 合并 → 校验总大小。
- 注意 `curl -L` 与 `-C -` 组合在部分 CDN 上会拖慢速度，极简参数往往更快。

## 第四部分 · Windows 组件与 DISM（系统层）

## 4-1、Get-WindowsOptionalFeature 的 FeatureName 不支持数组（R6）

```powershell
Get-WindowsOptionalFeature -Online -FeatureName A, B   # 报错 Cannot convert 'System.Object[]'
foreach ($n in "A","B") { Get-WindowsOptionalFeature -Online -FeatureName $n }
```

## 4-2、DISM 动词：/Dismount-Image 不存在（R7）

正确动词是 **`/Unmount-Image`**（`/Dismount-Image` 报 `错误: 87`），导致 wim 一直挂着占空间。

## 4-3、RestoreHealth 的源版本必须 ≤ 当前系统（R8）

```powershell
dism /Online /Cleanup-Image /RestoreHealth /Source:WIM:install.wim:1
# 错误: 0x800f0915 找不到修复内容 —— 因为 wim 是 8037，系统是 7705，源比系统新
```

修复源要求**同版本或更旧**（或走 Windows Update）。

## 第五部分 · 数据与迭代（逻辑层）

## 5-1、ConvertTo-Json 未指定 -Depth：JSON 被静默截断（R12）

```powershell
$data | ConvertTo-Json                # 嵌套超过 2 层直接截断，结果静默损坏
$data | ConvertTo-Json -Depth 100     # 显式指定深度
```

AI 生成的序列化代码几乎从不带 `-Depth`，而默认深度只有 2——深层对象被静默截断成 `"..."`，是「AI 输出 JSON 看起来不对」的头号原因。

## 5-2、foreach 循环里误用 `$_`（R13）

```powershell
foreach ($f in $files) { Write-Output $_ }   # $_ 不是 $f！是外层管道的当前对象或 $null
foreach ($f in $files) { Write-Output $f }   # 正确：用循环变量
```

`$_` 是管道自动变量，只属于 `ForEach-Object { }` / `Where-Object { }` 管道场景；`foreach` 语法循环里它是外层上下文（或空），AI 经常把两种迭代混着写。

## 第六部分 · 沉淀成检查插件：powershell-check

这些坑如果只躺在文章里，下次还是会踩。我把它们提取成了一个**检查插件**：`powershell-check` —— 一个静态检查脚本 + 配套使用规范，位于博客仓库 `.dsh/skills/powershell-check/` 下。**规则：一旦涉及 PowerShell 的执行（调用 pwsh、生成 .ps1、把命令嵌进脚本模板），先启动插件进行检查，FAIL 修复后再执行。**

该插件已按 DeepSeek Harness 官方插件范式升级为独立仓库：[**dsh-powershell-check**](https://github.com/chaggle/dsh-powershell-check) —— 原生 Cordis 插件，通过官方 `tools/pre-execute` 拦截点对每次 pwsh 调用**自动**检查并拦截（deny reason 即修复指引），同时以 `ctx.skills.registerProvider` 内置同名技能，无需每次手动启动；可配置 `analyzer: psscriptanalyzer` 叠加官方 PSScriptAnalyzer 深度检查。

```text
# 检查命令串
node .dsh/skills/powershell-check/scripts/check-pwsh.mjs -- '<命令原文>'

# 检查 .ps1 脚本文件
Get-Content fix.ps1 -Raw | node .dsh/skills/powershell-check/scripts/check-pwsh.mjs -

# 插件自检（跑内置正反例）
node .dsh/skills/powershell-check/scripts/check-pwsh.mjs --selftest
```

### 规则总表（R → 章节）

| 规则 | 级别 | 坑位 | 章节 |
| --- | --- | --- | --- |
| R1 | 建议 | 中文控制台 GBK 乱码 | 2-3 |
| R2 | 阻断 | `$var:` 驱动器限定解析 | 1-1 |
| R3 | 阻断 | PS 5.1 三元运算符 | 1-2 |
| R4 | 阻断 | 双引号 `$WINDOWS` 展开 | 2-1 |
| R5 | 阻断 | Start-Process 包装外部命令 | 3-1 |
| R6 | 阻断 | FeatureName 数组 | 4-1 |
| R7 | 阻断 | DISM 动词 /Dismount-Image | 4-2 |
| R8 | 阻断 | RestoreHealth 源版本 | 4-3 |
| R9 | 阻断 | curl -L 与 -C - 组合 | 3-4 |
| R10 | 阻断 | npm 不带 .cmd 后缀 | 3-2 |
| R11 | 阻断 | `&&` / `||` 链式 | 1-3 |
| R12 | 建议 | ConvertTo-Json -Depth | 5-1 |
| R13 | 建议 | foreach 的 `$_` | 5-2 |
| R14 | 阻断 | `=` 当比较 | 1-4 |
| R15 | 建议 | PS 7+ 专属语法 | 1-5 |
| R16 | 建议 | cmd 风格 / %VAR% | 3-3 |
| R17 | 建议 | Write-Host 不进管道 | 2-4 |
| 写作侧 | — | JS 模板转义 | 2-2 |

**维护约定（长期生效）：每次 PowerShell 执行踩到新坑，先给检查器加规则（含 selftest 正反例）并跑通 --selftest，再同步补进本文与 SKILL.md，然后走一轮 commit + push + publish 部署，让知识库与工具保持同步。**

