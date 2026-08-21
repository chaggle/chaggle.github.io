---
title: "Tez 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "tez"]
category: "bigdata"
---

> Tez 是 Apache 旗下的 DAG 计算引擎，脱胎于 MapReduce，用于替代 MR 执行多阶段复杂作业。它把"多轮 MR 写盘"改成"一个 DAG 内存流转"，性能提升肉眼可见，也是 Hive 默认执行引擎之一。

## 一、Tez 的定位与背景

MapReduce 的缺陷很明确：一次作业只能表达 Map → Reduce 两个阶段，复杂的分析（比如 Hive SQL）会被翻译成一串串 MR 作业串行执行，每个 MR 作业的中间结果都要落 HDFS，一轮一轮地读写磁盘，性能极差，而且整个集群的调度开销也被放大。

Tez 的解决思路：把多个 MR 阶段融合成**一个有向无环图（DAG）**，一次提交、一次调度，顶点之间直接传递数据，能省则省。

:::tip
Tez 不是要取代 HDFS/Yarn，而是站在它们之上，解决"计算编排"层面的效率问题。它不存数据，只算数据。
:::


核心收益：

- 中间结果尽量留在内存/本地磁盘，不写 HDFS
- 一个 DAG 一次调度，避免多轮作业的 AM 反复启动
- 任务/容器复用，减少 JVM 启动开销

## 二、核心概念

Tez 的核心抽象围绕 DAG 展开，先记住这几个词：

- **DAG**：整个作业的执行计划图，节点是 Vertex，边是 Edge
- **Vertex（顶点）**：一个逻辑阶段，对应 MR 里的 Map 或 Reduce 阶段，也可以对应 Spark 里的 stage 概念
- **Edge（边）**：连接两个顶点，描述上游到下游的数据流转方式和数据分布方式
- **Task**：顶点的一个并行实例，一个 Vertex 被拆成多个 Task 并行执行
- **Container**：Yarn 分配的资源容器，Task 在 Container 里运行
- **Session**：Tez 会话，复用 AM 与容器资源的长期运行环境

### Edge 的类型

Edge 除了描述"谁给谁传数据"，还要声明数据怎么分，常用的有：

- **OneToOne（窄依赖）**：上游一个 Task 的输出只发给下游一个 Task，如 Map 到 Map
- **Broadcast**：上游每个 Task 的输出广播给下游所有 Task，如小表分发
- **ScatterGather（Shuffle）**：上游输出按分区算法打散，下游每个 Task 从所有上游 Task 拉数据，如 Map 到 Reduce

:::note
Edge 的分区器（Partitioner）和排序逻辑都可插拔，这也是 Tez 能支撑多种引擎接入的底气。
:::


## 三、执行原理

### 1. 数据流转：尽量不落盘

传统 MR：Map 输出 → Shuffle 写盘 → Reduce 拉取再写盘。

Tez：同一 DAG 内，上游 Task 的输出可以**直接通过内存/网络传给下游 Task**，只有当数据量超过内存阈值时才落本地磁盘做 spill。只有跨越多个作业（多个 DAG）时才会写 HDFS。

### 2. Task 复用与容器复用

- **Task 复用**：一个 Task 处理完自己的分片后，如果还有空闲容器，可以继续处理其他分片，减少启动开销
- **容器复用（Container Reuse）**：一个 Container 跑完一批 Task 后不销毁，继续加载下一个 Task，避免反复申请资源和启动 JVM

这两招对"Task 数多但单个 Task 执行快"的场景（比如大量小文件、聚合类 SQL）收益特别大。

### 3. 动态资源分配

Tez 的 AM 会统计当前 DAG 各顶点的实际执行速度、数据量，动态调整后续顶点的并行度，比如 Shuffle 下游 Reduce 的 Task 数可以根据实际数据量缩放，避免预估不准导致资源浪费或倾斜。

## 四、与 MapReduce 的对比

| 维度 | MapReduce | Tez |
| --- | --- | --- |
| 作业模型 | 单作业两阶段（Map/Reduce） | 多阶段 DAG |
| 中间结果 | 每轮写 HDFS | 内存/本地流转，尽量不落盘 |
| 调度次数 | 每轮作业一次（AM 反复启停） | 整个 DAG 一次 |
| 容器复用 | 无 | 支持，任务/容器级复用 |
| 资源利用 | 轮次间有大量空窗 | 连续流水线式执行 |
| 复杂 SQL | 翻译成 N 个 MR 串行 | 翻译成一个 DAG |

:::warning
MR 不是一无是处：单阶段、逻辑简单的作业上两者差距不大，而且 MR 的稳定性经过多年打磨。但凡是多阶段 JOIN/聚合类作业，Tez 的收益非常明显。
:::


## 五、在 Hive / Spark 中的应用

### 1. Hive on Tez

Hive 里一条 SQL 的执行计划（比如 JOIN → GROUP BY → ORDER BY）会被翻译成 Tez DAG，每个 MR 风格的阶段变成 DAG 中的 Vertex，Reduce 阶段之间的 Shuffle 变成 Edge，一次提交执行。

切换引擎（老版本 Hive 1.x 时代常用）：

```sql
SET hive.execution.engine=tez;   -- tez / mr / spark
```

### 2. Spark 与 Tez

Spark 有自己的 DAG 引擎，一般不依赖 Tez。但在部分生态（如老版本 Hive on Spark 之前的过渡期、某些 Impala/Athena 变体）里 Tez 仍扮演执行引擎角色。对大数据从业者来说，掌握 Tez 的 DAG 思想能帮助理解 Spark Stage 的划分，两者是同一个思想脉络。

## 六、重要参数

### 1. 资源相关

| 参数 | 说明 |
| --- | --- |
| `tez.am.resource.memory.mb` | AM 内存，默认 1024，大作业建议调大，否则 AM 频繁 GC 甚至 OOM |
| `tez.task.resource.memory.mb` | 单个 Task 内存，默认 1024 |
| `tez.task.resource.cpu.vcores` | 单个 Task 虚拟核数，默认 1 |

### 2. 复用相关

- `tez.am.container.reuse.enabled`：默认 true，开启容器复用
- `tez.am.container.reuse.rack-fallback.enabled`：容器复用落空时是否允许跨机架复用

### 3. 运行时相关

- `tez.runtime.io.sort.mb`：排序缓冲区大小，类似 MR 的 sort.mb，大 shuffle 时可调大
- `tez.grouping.min-size`：Map 端输入分片的最小分组大小，默认 16MB，影响 Input 合并粒度
- `tez.session.mode`：会话模式，取值 `strict`（独占 AM）/ `nonsession`（按作业启停 AM），Hive 通常配合 `hive.server2.tez.sessions.per.default.queue` 管理常驻 Session

### 4. Hive 侧相关

- `hive.execution.engine`：切换执行引擎
- `hive.tez.container.size`：Hive 传给 Tez 的容器内存，常与 `tez.task.resource.memory.mb` 联动

:::warning
改内存参数时注意和 Yarn 的 `yarn.scheduler.maximum-allocation-mb` 对齐，Task/AM 申请超过队列上限会一直 pending。
:::


## 七、常见问题排查

### 1. 任务启动慢

DAG 调度阶段耗时过长，通常是 AM 申请慢、会话未复用（每次都新建 AM）、队列资源紧张。检查：

- 是否启用了 Tez Session（Hive 场景看 `hive.server2.tez.sessions` 配置）
- Yarn 队列是否打满，AM 是否长时间 pending

### 2. AM 内存不足

日志出现 `Container killed by the ResourceManager` 或 AM OOM。把 `tez.am.resource.memory.mb` 调大，同时注意队列最大资源上限。

### 3. Tez Session 未复用

- `tez.session.mode` 配成了 `nonsession` 会导致每个查询都新建 AM
- Session 空闲超时被回收，检查 `tez.session.am.dag.submit.timeout`、`hive.server2.tez.sessions.per.default.queue`

### 4. 任务失败重试风暴

某个 Task 反复失败重试，占满集群资源。优先看：

- 是否数据倾斜导致个别 Task 拉爆内存
- 是否有坏节点，Container 反复失败，配合 `tez.am.max.task.attempts` 限制重试次数

### 5. 数据倾斜

Shuffle 下游个别 Task 处理量远大于均值。手段：

- 开启倾斜优化（Hive 侧 `hive.groupby.skewindata=true`）
- 合理设置分区数，避免 Reduce 数量过少
- 大小表 JOIN 用 Broadcast Edge，避免全量 Shuffle

### 6. Yarn 资源配额问题

现象：Tez 作业正常，但提交后一直 ACCEPTED 不运行。检查：

- `yarn.scheduler.maximum-allocation-mb` 是否小于 Tez 申请的内存
- 队列容量/最大容量是否被其他作业占满
- 用户权限：提交的队列是否有访问权限

### 7. 日志定位（Tez UI）

Tez 自带 Web UI（AM 页面），能看 DAG 各顶点耗时、每个 Task 的 Attempt 次数、Shuffle 数据量、反压情况。排查性能问题优先看：

- 哪个 Vertex 耗时最长（瓶颈顶点）
- 哪些 Task 的 Attempt 数异常（失败重试）
- 顶点间传输数据量是否异常（倾斜）

## 八、小结

:::tip
一句话总结 Tez：**把 MapReduce 的多轮写盘改成一张 DAG 的内存流水线，配合容器/任务复用和动态资源，把多阶段计算的速度提上去。** 它是理解 Hive 执行引擎、以及后来自研 DAG 引擎的重要基石。
:::


学习建议：

- 先跑一个 `explain` 看 Hive on Tez 的 DAG 结构，对照本文概念逐个理解
- 出问题时先看 Tez UI，再查参数，不要盲目调内存
- 和 Spark Stage/Shuffle 对照着学，一通百通
