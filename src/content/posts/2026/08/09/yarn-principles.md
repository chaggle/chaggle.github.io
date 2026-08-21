---
title: "Yarn 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "yarn"]
category: "bigdata"
---

> Yarn 是 Hadoop 的资源调度层，负责把集群的 CPU 和内存"分蛋糕"。搞懂 Yarn，才能明白为什么任务一直卡在 ACCEPTED、为什么容器总被杀、为什么队列里任务挤成一堆。这篇文章从架构到排障完整梳理一遍。

## 核心架构

Yarn 采用主从 + 两级调度的架构：ResourceManager 管全局资源，NodeManager 管单节点资源，ApplicationMaster 管单个应用。

### ResourceManager（RM，主节点）

全局资源管理器，包含两大组件：

- **Scheduler（调度器）**：纯资源分配，不关心应用具体执行。把资源以 Container 的形式分配给各个应用
- **ApplicationManager（应用管理器）**：负责接收作业提交、协商启动 ApplicationMaster、监控 AM 状态、失败时重启 AM、处理作业完成与清理

RM 自身是单点，需要配置 HA（Active/Standby，依赖 ZooKeeper 选主）。

### NodeManager（NM，从节点）

- 每台计算节点一个，管理本节点的资源（CPU、内存、磁盘）
- 负责启动/销毁 Container，上报容器状态、节点健康情况（含磁盘健康检查）给 RM
- 不参与计算，计算都在 Container 里跑

### ApplicationMaster（AM）

- 每个应用（作业）一个 AM，是"作业的大脑"
- 向 RM 申请资源（Container），与 NM 通信启动任务，监控任务进度，失败重试
- AM 本身就是运行在一个 Container 里的特殊任务

### Container（容器）

- 资源的抽象单位：一段内存 + 若干虚拟 CPU 核（vcore）
- 任务的每个执行单元（Map/Reduce Task、Executor）都跑在一个 Container 里

### 队列（Queue）

- 调度器按队列组织资源：多个队列共享集群资源，每个队列可配容量、最大资源、ACL 等
- 提交作业时指定队列：`-D mapreduce.job.queuename=xxx`

:::note
两级调度的心智模型：RM 把资源给"应用"（AM），AM 再把资源细分为一个个 Container 给"任务"。RM 不感知单个 task，只感知应用层面的资源需求。
:::


## 调度器对比

### FIFO Scheduler

- 先进先出，一个队列，先来先服务
- 问题：前面一个大作业占满资源，后面所有小作业都要等（队头阻塞）
- 只适合教学/单用户场景，生产环境基本不用

### Capacity Scheduler（容量调度器，默认）

- 按队列分配固定比例容量（capacity），如 `root.default` 60%、`root.etl` 40%
- 每个队列容量有下限保障，还有弹性：某个队列资源闲置时，可被其他队列"借走"（弹性共享），忙时收回
- 支持层级队列（root 下有子队列）、ACL 控制、优先级
- 特点：可预测、易于管理，适合多部门多业务线

### Fair Scheduler（公平调度器）

- 所有运行中的作业按权重**公平分享**资源，新作业启动后能抢到等待的作业一半资源，收敛更快
- 按资源需求动态分配，空闲队列资源利用率高
- 配置较灵活（fair-scheduler.xml），适合用户多、作业多且小的场景

| 调度器 | 分配依据 | 典型场景 | 配置项 |
| --- | --- | --- | --- |
| FIFO | 提交时间 | 单用户测试 | 无需配置 |
| Capacity | 队列容量比例 | 多业务线、资源隔离要求高 | capacity-scheduler.xml |
| Fair | 公平份额 | 多用户共享、作业量多变 | fair-scheduler.xml |

:::warning
CDH/阿里云 EMR 默认是 Capacity Scheduler；如果线上任务忽快忽慢、某个部门的作业老吃不到资源，先看队列容量配置和调度器类型，别急着怪 Spark 参数。
:::


## 应用提交与运行流程

以 MapReduce 作业为例，完整生命周期：

1. **提交**：客户端调用 `Job.waitForCompletion()`，向 RM 提交作业（含 jar、分片信息），RM 返回作业 ID 和提交路径
2. **调度 AM**：RM 的 Scheduler 为该作业分配第一个 Container，ApplicationManager 指示 NM 启动 ApplicationMaster
3. **AM 初始化**：AM 启动后向 RM 注册自己，然后根据输入分片向 RM 申请运行 Map Task 的 Container
4. **分配与启动**：RM 分配 Container（满足队列、资源、节点位置等约束），AM 与对应 NM 通信，启动任务
5. **任务执行**：Map Task 执行完，shuffle 阶段数据传给 Reduce Task；AM 持续监控进度
6. **完成清理**：作业完成后 AM 注销并向 RM 汇报，RM 清理作业状态

:::note
这里的重点是"AM 向 RM 申请资源"的循环：RM 只是分配器，**不直接启动任务**。如果 AM 申请不到资源，作业就会一直卡在 ACCEPTED / RUNNING 但无 task 启动。
:::


## 重要参数介绍

### 节点资源（NM 层面）

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `yarn.nodemanager.resource.cpu-vcores` | 8 | 单节点可供 Yarn 使用的虚拟核数，按物理核配 |
| `yarn.nodemanager.resource.memory-mb` | 8192 | 单节点可供 Yarn 使用的总内存（MB），**必须小于物理内存**，留出系统余量 |
| `yarn.nodemanager.resource.detect-hardware-capabilities` | false | 是否自动探测硬件并配置上面两项 |

### 容器资源范围（RM/Scheduler 层面）

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `yarn.scheduler.minimum-allocation-mb` | 1024 | 单个 Container 最小内存，申请会向上取整到它的倍数 |
| `yarn.scheduler.maximum-allocation-mb` | 8192 | 单个 Container 最大内存，超过会被拒绝或降级 |
| `yarn.scheduler.minimum-allocation-vcores` | 1 | 单个 Container 最小 vcore |
| `yarn.scheduler.maximum-allocation-vcores` | 32 | 单个 Container 最大 vcore |

:::caution
`yarn.scheduler.maximum-allocation-mb` 默认 8192，很多任务向 Spark 申请 driver 10G 内存直接失败或被杀。改这个参数时要同步评估单节点能同时跑几个大 Container，防止内存超卖。
:::


### 内存与调度行为

- `yarn.nodemanager.pmem-check-enabled` / `yarn.nodemanager.vmem-check-enabled`：是否开启物理内存/虚拟内存超限检查，默认 true。任务实际内存超申请值会被 NM 直接 kill
- `yarn.nodemanager.pmem-check-enabled=false` 是"容器被杀"的常见临时规避手段，但不建议生产关掉
- `yarn.resourcemanager.scheduler.class`：指定调度器类，如 `org.apache.hadoop.yarn.server.resourcemanager.scheduler.capacity.CapacityScheduler`
- `yarn.nodemanager.local-dirs` / `yarn.nodemanager.log-dirs`：本地临时目录与日志目录，多磁盘逗号分隔

### 队列配置（capacity-scheduler.xml）

```xml
<property>
  <name>yarn.scheduler.capacity.root.queues</name>
  <value>default,etl</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.default.capacity</name>
  <value>60</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.etl.capacity</name>
  <value>40</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.etl.maximum-capacity</name>
  <value>60</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.etl.acl_submit_applications</name>
  <value>etl_user</value>
</property>
```

- `capacity`：队列保证容量（子队列之和 = 100）
- `maximum-capacity`：弹性上限，防止独占全部资源
- 修改后 `yarn rmadmin -refreshQueues` 热生效

### 资源抢占（Preemption）

- 开启后，当队列使用超过 `maximum-capacity` 时，RM 会杀掉抢占队列中过期的容器（`yarn.resourcemanager.scheduler.monitor.enable=true` + 配置 ProportionalCapacityPreemptionPolicy）
- 参数：`yarn.resourcemanager.monitor.capacity.preemption.monitoring-interval`（检查周期）、`yarn.resourcemanager.monitor.capacity.preemption.max-wait-before-kill`（宽限期，默认 15s）
- 抢占会杀容器，对跑长任务的流作业不友好，生产需谨慎评估

## 常见问题排查

### 任务卡在 ACCEPTED / 调度不分配容器

- 现象：作业提交后长时间 `ACCEPTED` 或 `RUNNING` 但 task 一个没启动
- 排查步骤：
  1. ResourceManager UI（8088 端口）看作业所在队列的**资源使用情况**：Pending 容器多说明申请排队了
  2. 看队列是不是被其他作业占满（尤其大作业或"资源泄露"的僵尸任务）
  3. 确认申请的容器内存是否超过 `yarn.scheduler.maximum-allocation-mb`
  4. 看 AM 是否启动成功：AM 反复重启会导致作业一直 RUNNING 没进展（见下）
  5. 检查用户是否有队列提交权限（ACL 拒绝会直接失败而不是排队）

### 容器被杀 / 内存溢出

- 现象：日志里出现 `Container killed by the ApplicationMaster`、`Process tree is exceeding the physical memory limit`、`OutOfMemoryError`
- 原因与处理：
  - 任务实际内存超过申请值 → 调大 `mapreduce.map.memory.mb` / `spark.executor.memory` 等任务内存参数
  - 虚拟内存超限（vmem）常因 JVM 预留空间大触发，可评估 `yarn.nodemanager.vmem-pmem-ratio` 是否调大
  - 确认是不是单个 Container 申请超过 maximum-allocation（申请被降级或拒绝）
- 先看容器日志（`logs/userlogs/`）里的 JVM 错误，再决定调哪个参数

### 节点资源未释放

- 现象：RM UI 显示节点内存被占满，但实际没有任务在跑
- 原因：
  - 客户端 kill 作业但 AM 没收到信号，任务进程还活着
  - NM 与 RM 心跳中断，NM 状态没及时更新（看节点状态是 Lost 还是 Healthy）
  - 容器所在进程残留（`jps` 看是否有 Java 进程未退出），杀掉后资源自动回收
- 处理：`yarn application -kill <appid>` 强杀；再不行重启对应 NM

### 队列配置错误

- 现象：作业提交时报 `Queue ... doesn't exist`、`Failed to submit application`、`ACL ... is denied`
- 排查：检查 `yarn.scheduler.capacity.root.queues` 是否包含目标队列名；子队列 capacity 之和是否 100%；ACL 用户是否匹配
- 修改配置后务必 `yarn rmadmin -refreshQueues` 并在 RM UI 确认生效

### AM 反复重启

- 现象：RM UI 上 `AM Container: failed`，作业反复从 0 重跑
- 常见原因：
  - AM 申请的内存小于实际需要 → 被 kill
  - 依赖的 jar/资源在 AM 节点上找不到（本地化失败）
  - AM 启动阶段抛异常（代码问题、配置项拼错）
  - `yarn.resourcemanager.am.max-attempts`（默认 2）内没起来就彻底失败
- 排查：看 RM 日志中该 AppAttempt 的失败原因，重点看 AM 容器的 stderr

### 磁盘心跳（Disk Health）

- NM 会对本地目录做磁盘健康检查，`yarn.nodemanager.disk-health-checker.enabled` 默认开启
- 某个磁盘满了或写失败，该盘会被标记坏盘，NM 上报给 RM；坏盘过多（`yarn.nodemanager.max-disk-utilization-per-disk-percentage`）会导致整个节点被标记为 unhealthy，RM 停止向它分配容器
- 现象：节点状态 unhealthy、容器一直起不来
- 处理：清理磁盘/更换坏盘，NM 会自动恢复

### RM 单点故障 / HA 切换

- 现象：RM 进程挂了，所有作业停摆；HA 场景下主动切换后作业中断
- 注意：**RM 切换不丢作业状态**（依赖 ZK），但 AM 和 task 会中断重跑
- 排查：看 ZK 中 `yarn-leader-election` 节点，检查两个 RM 的 Active/Standby 状态（`yarn rmadmin -getAllServiceState`）
- 参数：`yarn.resourcemanager.zk-addresses`、`yarn.resourcemanager.ha.enabled`，ZK 抖动是 RM 频繁切换的常见原因

:::tip
Yarn 排障三板斧：① RM UI（8088）看队列资源与容器状态；② `yarn logs -applicationId <appid>` 看任务日志；③ `yarn node -list` / `yarn node -status <node>` 看节点健康。UI 永远是第一手信息源。
:::


## 小结

Yarn 的本质是**资源抽象的通用调度平台**：把节点资源抽象成 Container，用两级调度（RM→AM→Task）隔离"资源分配"和"任务执行"。理解队列容量与弹性、记住"内存申请超限会被杀"和"资源不释放要先看节点健康"，大部分 Yarn 问题都能快速定位。
