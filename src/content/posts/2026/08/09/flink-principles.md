---
title: "Flink 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "flink"]
category: "bigdata"
---

> 本文是对 Flink 核心知识的系统性总结，覆盖架构、流处理模型、窗口与 Watermark、状态编程、Checkpoint 容错、常用参数以及日常问题排查要点，作为个人技术笔记使用。

## 整体架构：JobManager 与 TaskManager

Flink 是真正的流式计算框架（Streaming First），采用主从架构：

- **JobManager（JobMaster）**：集群的大脑，负责作业调度、Checkpoint 协调、故障恢复。内部包含 ResourceManager、Dispatcher、JobMaster
- **TaskManager（TaskExecutor）**：实际执行任务的工作进程，一个 TM 上有若干 Slot（资源单元），一个 Slot 跑一个线程
- **Slot**：TaskManager 内存资源的最小分配单位。默认一个 Slot 可以跑多个 Task 的共享模式（slots per TM 控制 Slot 数）
- **Client**：提交作业的入口，只负责提交（构建 JobGraph 后发出），不参与计算

```text
Client ──提交 JobGraph──▶ JobManager
                          ├─ 解析成 ExecutionGraph
                          ├─ 调度 Task 到 Slot
                          └─ 协调 Checkpoint
TaskManager  ◀── 部署 Task / SubTask ──▶ TaskManager
```

:::note
Flink 与 Spark Streaming 的本质区别：Flink 每个数据事件一进来就被处理（真正的流），而 Spark Streaming 是微批次（Micro-Batch）模拟流。因此 Flink 天然延迟更低（毫秒级 vs 秒级）。
:::


### JobGraph / ExecutionGraph / Task / SubTask

- **JobGraph**：Client 提交的作业逻辑图，包含 Operator 节点和边
- **ExecutionGraph**：JobManager 将 JobGraph 并行化后生成的执行图，每个 Operator 变成多个并行子任务（SubTask）
- **SubTask**：算子的一个并行实例，是 Flink 调度的最小单元。一个 TaskManager 的一个线程跑一个 SubTask
- **并行度（Parallelism）**：算子并行实例的个数，可在算子、执行环境、提交参数三层设置，取最近一层的设置

### 部署模式

- **Session（会话）模式**：共享一个 Flink 集群跑多个作业，JobManager 已启动，提交快，但作业间资源隔离差、一个作业出问题可能拖垮集群
- **Per-Job 模式**：每个作业独立启动一个集群，作业结束集群释放，资源隔离好（Flink 1.15+ 已废弃）
- **Application 模式**：main 方法在集群内执行，每个应用一个 JobManager，适合生产
- 资源管理：Standalone（自管）、YARN（yarn-session / yarn-application）、Kubernetes（原生 K8s）

:::tip
生产环境推荐 YARN Application 或 K8s 部署：资源按作业隔离，main 方法跑在集群内，本地不需要提交环境。
:::


## 流处理模型与 DataStream

### 有界流与无界流

- **无界流（Unbounded）**：数据持续产生永不结束，必须用事件时间 + Watermark + 窗口来处理，如 Kafka 实时接入
- **有界流（Bounded）**：数据有明确边界，本质上是批处理，Flink 用同一套 DataStream API 处理，如读文件/数据库

### DataStream 常用算子

- 无状态算子：map、flatMap、filter
- 分区算子：keyBy（按 key 分组，产生网络 shuffle）、rebalance（轮询）、broadcast、partitionCustom
- 有状态算子：window、process（ProcessFunction 是最灵活的底层 API）
- 侧输出流（Side Output）：把脏数据、迟到数据分流，是生产环境标配

## 窗口与 Watermark

### 三类窗口

- **滚动窗口（Tumbling）**：固定大小、互不重叠，如每 10 秒统计一次
- **滑动窗口（Sliding）**：固定大小 + 滑动步长，重叠，如每 5 秒统计过去 10 秒
- **会话窗口（Session）**：按不活跃间隔切分，适合用户行为会话类统计

```scala
// 滚动窗口示例：每 10s 按 userId 统计订单金额
dataStream
  .keyBy(_.userId)
  .window(TumblingEventTimeWindows.of(Time.seconds(10)))
  .aggregate(new OrderAggFunc)
```

### Watermark：处理乱序数据

Watermark 是 Flink 处理乱序的核心机制，语义：**"时间戳 <= Watermark 的事件已经全部到达"**。当事件时间超过当前窗口结束时间时，窗口才会触发计算。

- Watermark = 已见最大事件时间 - 允许乱序的时间（BoundedOutOfOrderness）
- Watermark 必须与事件时间（EventTime）配合，指定 `env.setStreamTimeCharacteristic`（1.12+ 默认事件时间）
- 迟到事件处理：Watermark 之后的迟到数据，可丢弃、可落到侧输出流

```scala
val stream = source
  .assignTimestampsAndWatermarks(
    WatermarkStrategy
      .forBoundedOutOfOrderness[Order](Duration.ofSeconds(5))
      .withTimestampAssigner(_.timestamp)
  )
```

:::warning
Watermark 是在 Task 内部基于分区推进的，多个分区要先经过对齐（取最小），才决定窗口是否触发。单个分区长时间无数据，会拖住整个窗口——常见坑。
:::


## 状态编程

### Keyed State

- 状态必须以 keyBy 为前提，按 key 隔离（每个 key 一份）
- 常用类型：ValueState、ListState、MapState、ReducingState、AggregatingState
- 无 key 的算子可用 Operator State（如 Kafka offset 的存储）

```scala
class MyProcess extends KeyedProcessFunction[String, Order, Result] {
  var totalState: ValueState[Double] = _
  override def open(parameters: Configuration): Unit = {
    val desc = new ValueStateDescriptor[Double]("total", classOf[Double])
    totalState = getRuntimeContext.getState(desc)
  }
}
```

### 状态后端

| 后端 | 存储 | 特点 |
| ---- | ---- | ---- |
| HashMap（堆内存） | JVM 堆 | 快，但受 GC 影响大，大状态 OOM 风险高 |
| RocksDB（默认） | 本地磁盘（嵌入 RocksDB，LMS 结构） | 状态量大时首选，增量 Checkpoint 快，代价是序列化开销 |
| 内存文件系统 | 实验性 | 目前不建议生产使用 |

:::note
RocksDB 适合 100GB 以上的大状态；毫秒级延迟敏感且状态小时可选堆内存后端。增量 Checkpoint 只在 RocksDB 上支持。
:::


## 容错机制：Checkpoint 与 Exactly-Once

### Checkpoint：Barrier 对齐

Flink 周期性对算子状态做一致性快照，核心是 **Checkpoint Barrier**（屏障）：

```text
Source(offset) ──Barrier N──▶ 上游算子 ──▶ Sink(写临时事务)
        Barrier 随数据流传播，每个算子收到 Barrier 即对状态做快照
        全部算子快照成功 → 本次 Checkpoint 完成（New 变 Completed）
```

- **Barrier 对齐**：多上游（如 Kafka 多分区）算子必须等所有输入的 Barrier 都到齐再快照，期间缓存数据。这是 Exactly-Once 的关键，代价是期间数据排队（可关闭对齐换性能，退化为 At-Least-Once）
- 快照存到外部存储：JobManager 内存（小状态）或 HDFS/OSS（`state.checkpoints.dir`）

### Savepoint

- 手动触发的完整状态快照，用于升级版本、改并行度、暂停恢复（`flink savepoint` 命令）
- 与 Checkpoint 独立存储，Checkpoint 默认自动过期，Savepoint 需手动删除
- Checkpoint 恢复后**没有 idempotent 保证**，保存点做迁移是常态

### Exactly-Once：两阶段提交 Sink

Kafka Sink 的 Exactly-Once 语义通过两阶段提交实现：

1. **预提交**：Checkpoint Barrier 到达 Sink 时，Kafka Producer 挂起当前事务，写入预提交状态
2. **提交**：JobManager 确认所有算子快照成功后，通知 Sink 真正提交事务（写入不可见 → 可见）
3. Checkpoint 失败则回滚事务，数据不落盘

:::caution
Exactly-Once 的前提是 Sink 支持事务（Kafka、MySQL 有，Redis 需要自实现）。且**两阶段提交依赖"下游不存在其他事务写入"**，如果 Sink 端还有别的程序写同一 topic 事务，可能造成阻塞。
:::


### Source 重放

- 外部数据源必须支持重放才能实现精确一次：Kafka 靠 offset 消费位点（存在 state 或 checkpoint 中，消费失败可回滚 offset）
- 重启恢复时，Flink 从最近一次成功 Checkpoint 恢复状态 + 对应的 Source offset，数据重放一遍
- 幂等写入（Redis set、MySQL 主键覆盖）是另一种保证思路，与两阶段提交二选一

## 重要参数介绍

### 内存与资源

| 参数 | 默认值 | 说明 |
| ---- | ---- | ---- |
| taskmanager.memory.process.size | 无（必配） | TM 总进程内存（含堆+托管内存+网络缓冲+JVM overhead） |
| taskmanager.memory.managed.size | 0.4 比例 | 托管内存（RocksDB、sort buffer 用），RocksDB 场景建议加大 |
| taskmanager.memory.framework.heap.size | 128m | 框架堆内存 |
| taskmanager.numberOfTaskSlots | 1 | 每 TM 的 Slot 数，Slot 数 × TM 数 = 最大并行度 |
| parallelism.default | 1 | 默认并行度，生产按资源评估 |

### 状态与 Checkpoint

| 参数 | 默认值 | 说明 |
| ---- | ---- | ---- |
| state.backend | RocksDB | HashMap / RocksDB |
| state.backend.incremental | false | 增量 Checkpoint（仅 RocksDB） |
| execution.checkpointing.interval | 无 | Checkpoint 间隔，如 60s；太短压力大，太长恢复慢 |
| execution.checkpointing.min-pause | 0 | 两次 Checkpoint 之间最短停顿，避免频繁触发 |
| execution.checkpointing.timeout | 10min | 单次 Checkpoint 超时时间，超时视为失败 |
| execution.checkpointing.max-concurrent-checkpoints | 1 | 并发 Checkpoint 数 |
| execution.checkpointing.exactly-once | true | 模式开关，Kafka 场景可设 at_least_once 换吞吐 |
| restart-strategy | 视部署方式 | fixed-delay（默认重启 Integer.MAX_VALUE 次）/ failure-rate / none |

```yaml
# 常见生产配置示例
taskmanager.memory.process.size: 8g
taskmanager.numberOfTaskSlots: 4
parallelism.default: 8
execution.checkpointing.interval: 60s
execution.checkpointing.min-pause: 30s
execution.checkpointing.timeout: 5min
state.backend: rocksdb
state.checkpoints.dir: hdfs://nameservice/flink/cp
restart-strategy.fixed-delay.attempts: 3
restart-strategy.fixed-delay.delay: 30s
```

:::warning
`taskmanager.memory.process.size` 是进程级总内存，堆内存会自动计算，无需再配 taskmanager.memory.heap.size。改托管内存比例时注意总内存不变。
:::


### Watermark 相关

| 参数/API | 说明 |
| ---- | ---- |
| forBoundedOutOfOrderness(duration) | 固定乱序容忍度 |
| withIdleness(timeout) | 分区长时间无数据时推进 Watermark，解决单分区拖拽（关键） |
| allowedLateness | 窗口触发后再等的宽容时间，迟到数据再进窗口 |
| sideOutputLateData | 超宽容期的数据输出到侧流，便于对账 |

## 常见问题排查

### 背压（Backpressure）定位

- 现象：Web UI 上游算子显示背压高（High），下游处理不过来
- 原理：数据从 Source 一直流到 Sink，中间某个算子处理慢，消息在 TaskManager 缓冲队列（默认 100）堆积，逐级向上传递为背压
- 定位：Flink Web UI → 作业 → 算子节点颜色/背压数值，红色高背压的算子就是瓶颈
- 常见原因与解法：
  - 单算子计算过重：优化算子逻辑、拆并行度
  - 下游为外部存储（DB/ES）写入慢：削峰（Kafka 天然削峰）、批量写入、限流
  - 反序列化/状态访问慢：状态后端换 RocksDB 或调优序列化
  - 窗口聚合算子热点：见下方窗口倾斜

### 反压导致延迟升高

- 现象：端到端延迟飙升，Kafka lag（消费者 lag）持续增长
- 排查顺序：看哪个算子背压最重 → 该算子 CPU/GC 是否打满 → 检查外部系统吞吐 → 检查是否有未关闭的日志/序列化开销
- 手段：`execution.checkpointing.min-pause` 过短会加剧（checkpoint 期间暂停消费），适当调大；并行度不够就扩容 Slot 与并行度

:::caution
背压不是 bug，是系统在说"下游消费不过来了"。盲目加并行度若瓶颈在外部存储 IO，只会让外部系统更慢。先定位瓶颈算子再动手。
:::


### Checkpoint 失败/超时（Barrier 未对齐）

- 现象：UI 上 Checkpoint 一直失败，`Checkpoint expired before completing`、`Barrier 未对齐`
- 原因：
  - 单分区长时间无数据导致 Watermark 不推进（配 withIdleness）
  - 算子处理过慢，Barrier 排队，超过 checkpoint.timeout
  - 状态后端写入慢（HDFS 抖动）
  - 背压导致 Barrier 无法按时到达
- 解法：调大 timeout / min-pause；排查背压；RocksDB 增量 Checkpoint；把 Checkpoint 间隔与数据吞吐匹配

### 状态过大

- 现象：内存占用高、Checkpoint 越来越大、恢复越来越慢
- 解法：
  - 用 TTL（StateTtlConfig）清理过期 key（如 7 天未更新的 key 自动过期）
  - RocksDB 天然适合大状态，别用堆内存硬扛
  - 检查 key 是否无限增长（如按用户存明细而不是聚合值）
  - 增量 Checkpoint + 定期 Savepoint 清理旧 Checkpoint

### TaskManager 内存溢出

- 现象：TM 进程被杀（OOM）、`Container killed by YARN`、Metaspace/堆溢出
- 排查：
  - 堆 OOM：并行度 × 状态量超限，调大 process.size 或减小 slots
  - RocksDB 撑爆托管内存：`taskmanager.memory.managed.size` 调大
  - 网络缓冲溢出：`taskmanager.memory.network.size`（默认 64m × slots）不足会报 `NotEnoughAvailableSlotsException` 或反序列化错误
  - 直接内存泄漏：检查是否用了非 Flink 的第三方 IO 库（JDBC 连接池、Netty 自定义 handler）

### Exactly-Once 失效

- 现象：重启后数据重复或丢失
- 排查：
  - Sink 是否实现两阶段提交（Kafka sink 需 1.4+ 且 `enable.2pc`，参数 `sink.semantic=exactly_once`）
  - 是否混用了外部写（外部还往同一 Kafka topic 写数据，事务互相干扰）
  - 幂等依赖的存储（Redis/MySQL）是否真有幂等语义（主键/唯一索引）
  - Source offset 是否在 state 里（否则重启从头读）

### 窗口数据倾斜

- 现象：窗口聚合单个 key 数据量极大，对应 SubTask 长时间卡住
- 解法：
  - 预聚合后按子 key 二次聚合（两阶段聚合，key 加随机后缀）
  - 热点 key 单独拆出来做局部聚合（key 数据量已知可控时）
  - 调整并行度，配合 keyBy 的哈希分布观察各 Slot 数据均衡性
  - 数据模型层解决：先按维度拆分，避免单 key 无限累积

### 与 Kafka 集成 offset 问题

- 现象：重启后消费重复/丢数据；`offset out of range` 报错
- 要点：
  - 默认从 Checkpoint 恢复 offset，不配 `setStartFromEarliest/Latest`（这些只在无 checkpoint 时生效）
  - 重复消费：Exactly-Once 开启后是**端到端**保证，必须 Sink 两阶段提交配合；否则只能 At-Least-Once + 幂等
  - `offset out of range`：offset 过期被 Kafka 清理，检查 topic 的 retention 是否小于 Checkpoint 恢复间隔
  - 消费者组在 Flink 中只是"占位"，group.id 不用于 offset 管理，别指望 Flink 之外的程序共用 group 消费

:::note
排查通用心法：**先看 Web UI 的 Backpressure 与 Checkpoint 状态 → 再看 TaskManager 日志（OOM/序列化）→ 最后结合数据分布（倾斜）与外部系统（Kafka/DB）判断**，与 Spark 排查思路一脉相承。
:::


## 小结

Flink 的核心在于三件事：**以事件时间为基准处理乱序流（Window + Watermark）、以状态承载所有中间结果、以 Barrier 快照实现 Exactly-Once**。生产环境里大部分问题的根因最终都落在背压、状态、Checkpoint 三角上，把这三个维度吃透，Flink 调优就成功了大半。
