---
title: "Spark 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "spark"]
category: "bigdata"
---

> 本文是对 Spark 核心知识的系统性总结，覆盖架构、RDD 与 DAG 调度、Shuffle、缓存与 Checkpoint、运行模式、常用参数以及日常问题排查要点，作为个人技术笔记使用。

## 整体架构：一次任务是怎么跑起来的

Spark 是内存计算框架，采用 Master-Slave 架构，核心组件如下：

- **Driver**：任务的"大脑"，运行用户程序 main 函数，负责解析代码、构建 DAG、调度任务、分发 Task，同时持有 SparkContext
- **Executor**：实际执行计算的工作进程，运行在 Worker 节点上，负责执行 Task、存储 RDD 缓存数据
- **Master**：集群的"总管"，负责资源管理，接收 Worker 心跳，将资源分配给 Application
- **Worker**：集群中的"包工头"，汇报资源给 Master，负责启动和监控本机的 Executor
- **Cluster Manager**：外部资源调度器（Standalone / YARN / Mesos / Kubernetes），Spark 本身支持 Standalone 自带的 Master-Worker

提交一个 Application 后的大致流程：

```text
spark-submit → 启动 Driver(SparkContext)
    → Driver 向 Cluster Manager 申请资源
    → Cluster Manager 通知 Worker 启动 Executor
    → Executor 反向注册给 Driver
    → Driver 把代码拆成 Job → Stage → Task 分发执行
    → Task 在 Executor 上执行，结果汇聚给 Driver
```

:::note
Spark 的内存计算优势在于：中间结果优先放内存，避免像 MapReduce 那样每步都落盘。但前提是 Executor 内存要够，否则退化为磁盘计算，性能反而不如 MR。
:::


### Application / Job / Stage / Task 层次

- **Application**：一次 spark-submit 提交的任务，包含一个 Driver 和若干 Executor
- **Job**：一个 Action 算子（count、collect、saveAsTextFile 等）触发一个 Job，一个 Application 可以有多个 Job
- **Stage**：一个 Job 按宽依赖（Shuffle）划分成多个 Stage，窄依赖之间不切 Stage
- **Task**：Stage 的最小执行单元，一个分区对应一个 Task，同一 Stage 的 Task 执行相同的代码片段

```text
Application
 └── Job1 (Action: count)
      ├── Stage0 (读 HDFS / 窄依赖算子)
      └── Stage1 (Shuffle → reduce)
           └── Task × N (每个分区一个 Task)
```

:::tip
记住：**Action 触发 Job，宽依赖划分 Stage，分区数决定 Task 数**，这是 Spark 调优最核心的三个概念。
:::


## RDD 与 DAG 调度原理

### RDD：弹性分布式数据集

RDD（Resilient Distributed Dataset）是只读、可分区的数据集合抽象，核心特性：

- **分区（Partition）**：数据被切成多块分布在不同节点，并行计算的粒度
- **血缘（Lineage）**：记录 RDD 从父 RDD 派生的过程，是容错的基础
- **惰性求值（Lazy）**：转换算子（map、filter）只是记录血缘，不真正计算，遇到 Action 才触发
- **缓存（Cache）**：可以持久化到内存/磁盘，供多次复用

### 宽依赖与窄依赖

依赖关系决定了容错成本和 Stage 划分：

- **窄依赖**：父 RDD 的每个分区只被一个子分区使用（map、filter、union、coalesce），计算在同一个 Stage 内流水线式执行，父分区丢失只需重算这一个分区
- **宽依赖**：父 RDD 的一个分区被多个子分区使用（groupByKey、reduceByKey、join），必然产生 Shuffle，子分区计算必须等父分区全部算完，父分区丢失需要整条血缘重算

:::caution
宽依赖是 Shuffle 的唯一来源，也是性能瓶颈和节点宕机风险的重灾区。能用 map-side 预聚合的算子（reduceByKey、aggregateByKey）就不要用 groupByKey。
:::


### DAG 调度与 Stage 划分

DAGScheduler 把 Job 的 DAG 反向解析，从 Action 往前回溯：

- 遇到宽依赖就切一刀，形成新的 Stage
- 先执行前面的 Stage，Shuffle 数据落盘后由后面的 Stage 拉取
- Stage 内窄依赖算子串成流水线，减少调度开销

```text
rdd.map(f1).filter(f2).groupByKey(f3).mapValues(f4).collect()
        └── Stage0 ──┘    └──── Stage1（Shuffle 切割）────┘
```

划分好 Stage 后，TaskScheduler 按数据本地性（Data Locality）把 Task 派发给 Executor 执行。

## Shuffle 机制

### 演进：Hash Shuffle 到 Sort Shuffle

- **Hash Shuffle（1.x 早期）**：每个 Map Task 为每个下游分区写一个文件，M 个 Task × R 个分区 = M×R 个文件，小文件爆炸，磁盘 IO 是灾难
- **Consolidated Hash Shuffle**：同 Executor 的 Map Task 复用输出文件组，减少到 Executor 数 × R
- **Sort Shuffle（2.x 默认）**：每个 Map Task 只输出一个数据文件 + 一个索引文件，先按分区排序（可选再按键排序），下游按索引拉取，小文件数量从 M×R 降到 M

:::note
Sort Shuffle 之所以胜出，本质是**用排序代价换小文件数**。spark.shuffle.sort.bypassMergeThreshold 默认为 200，当分区数小于 200 时走 bypass 模式，不排序直接合并，更快。
:::


### 中间数据与合并小文件

- Shuffle 中间文件由 Executor 负责清理（不再依赖 Driver 删除，规避了 Driver 挂掉数据残留问题）
- 小文件过多的优化手段：
  - 调节 `spark.sql.shuffle.partitions`，分区数不是越大越好，200 起步，按数据量评估
  - 使用 `coalesce`（减少分区，无 Shuffle）或 `repartition`（重分布，有 Shuffle）
  - 开启 `spark.sql.adaptive.coalescePartitions.enabled`（AQE）自动合并小分区

### 缓存与 Checkpoint

- **Cache/persist**：把 RDD 缓存在 Executor 内存或磁盘，多次 Action 复用，存储级别有 MEMORY_ONLY、MEMORY_AND_DISK、DISK_ONLY 等
- **Checkpoint**：把 RDD 数据物理写入 HDFS，**截断血缘**。与 cache 不同，checkpoint 是为了容错而不是性能——血缘过长时重算代价高，直接读取检查点恢复

:::warning
使用 Checkpoint 前建议先 cache，否则 checkpoint 会触发一次完整计算；且 checkpoint 要等 Job 执行完才落盘，第一次运行没有实际效果。
:::


### 广播变量与累加器

- **广播变量（Broadcast）**：把小表或大字典发给所有 Executor 一份只读副本，避免每个 Task 都从 Driver 拉取一份（序列化走网络、内存翻 N 倍）。join 小表用 broadcast join 可避免 shuffle
- **累加器（Accumulator）**：Driver 定义的只写变量，Executor 只能累加，Driver 最终读取，用于统计（如过滤掉的行数、错误计数）。注意 Task 重试会导致重复累加，需要结合执行次数判断

```scala
val dict = spark.sparkContext.broadcast(Map("a" -> 1, "b" -> 2))
val badCnt = spark.sparkContext.longAccumulator("badCnt")

rdd.map(x => {
  if (!dict.value.contains(x)) badCnt.add(1)
  dict.value.getOrElse(x, -1)
})
println(s"bad count: ${badCnt.value}")
```

## 运行模式

| 模式 | 说明 | 适用场景 |
| ---- | ---- | ---- |
| Local | 单机多线程，local[2] 表示 2 个线程 | 开发调试 |
| Standalone | Spark 自带 Master/Worker 集群 | 无 Hadoop 的小集群 |
| YARN Client | Driver 跑在提交机，适合交互式调试 | 日志直接打在本机 |
| YARN Cluster | Driver 跑在集群内 AM 容器中，提交机即退 | 生产环境推荐 |
| Kubernetes | Executor 以 Pod 方式动态创建 | 容器化平台 |

:::tip
生产环境几乎都是 YARN Cluster 或 K8s。client 模式的 Driver 跑在提交机上，提交机一断网/宕机任务就挂，且 Web UI 无法统一查看。
:::


YARN 模式下 Executor 内存配额会按公式被二次削减：`executor-memory × (1 - spark.memory.overheadFactor)`，overhead 默认 0.1，这部分是堆外内存，留给 JVM 自身和网络缓冲。申请 10g 实际可用堆约 9g。

## 重要参数介绍

| 参数 | 默认值 | 说明 |
| ---- | ---- | ---- |
| spark.executor.memory | 1g | 每个 Executor 的 JVM 堆内存 |
| spark.executor.cores | 1 | 每个 Executor 的 CPU 核数 |
| spark.executor.instances | 2 | 固定模式下的 Executor 数量 |
| spark.driver.memory | 1g | Driver 堆内存，collect 大数据时调大 |
| spark.sql.shuffle.partitions | 200 | SQL 聚合/Join 的 Shuffle 分区数 |
| spark.default.parallelism | 取决于模式 | 未指定时的默认并行度（分区数） |
| spark.memory.fraction | 0.6 | 堆内可用统一内存占比（0.6 × 堆），剩 0.4 留给用户代码和元数据 |
| spark.memory.storageFraction | 0.5 | 统一内存中 storage 的"保底份额"，execution 可抢占超出部分 |
| spark.shuffle.file.buffer | 32k | Shuffle write 输出缓冲区大小，调大减少磁盘写次数 |
| spark.reducer.maxSizeInFlight | 48m | Shuffle read 每次拉取数据上限 |

### 动态资源分配

```text
spark.dynamicAllocation.enabled=true
spark.dynamicAllocation.initialExecutors=2
spark.dynamicAllocation.minExecutors=2
spark.dynamicAllocation.maxExecutors=50
spark.shuffle.service.enabled=true   # 必须配套开启（Standalone 默认开）
```

原理：Driver 根据待处理 Task 数和 Executor 利用率周期性扩容/缩容。**注意 YARN 下必须开启 spark.shuffle.service，否则 Executor 被回收后 Shuffle 中间文件无法被其他 Executor 读取**，会导致任务失败或性能退化。

:::warning
executor.cores 建议与 Executor 内存匹配，一个 Executor 核数太多（如 8 核 8G）会导致并发 Task 共享内存互相挤压 OOM；常见配比：1 Executor = 4~5 核 + 8~16G。
:::


## 常见问题排查

### Executor OOM

- 现象：`ExecutorLostFailure`、`Java heap space`、YARN 页面看到容器被杀（Container killed by RM）
- 排查思路：
  - 看是 Task 内存不足（加大 spark.executor.memory）还是 Executor 太多 Task 并发（减少 spark.executor.cores）
  - 大聚合/大 join 场景调大 `spark.memory.fraction` 或直接加内存
  - 数据倾斜导致的局部 OOM 优先解决倾斜，而不是盲目加内存
  - 使用 `spark.executor.extraJavaOptions=-XX:+PrintGCDetails` 打 GC 日志辅助定位

### Driver OOM

- 现象：`java.lang.OutOfMemoryError: Java heap space` 出现在 Driver 日志，`collect`/`take` 拉回的数据量过大
- 解决：避免 collect 全量数据；非要拉数据用 `take(N)` 或先聚合；调大 spark.driver.memory；广播变量过大也占 Driver 内存

### 数据倾斜

- 现象：某个 Task 运行时间远超同 Stage 其他 Task，GC 频繁
- 定位：Spark Web UI 看 Stage 的 Task 耗时分布，或对 key 做 count 统计
- 解法（按优先级）：
  - 过滤无效 key（如 null、空字符串，先确认业务上可丢弃）
  - 两阶段聚合：key 加随机前缀打散 → 局部聚合 → 去前缀 → 全局聚合
  - join 倾斜：小表广播（broadcast join）；或把大 key 拆分加盐后与扩容的小表 join
  - 提升并行度：调大 spark.sql.shuffle.partitions

### Shuffle 慢

- 现象：Stage 卡在 Shuffle Read，或大量 fetch failed
- 检查：executor 心跳是否超时、网络是否拥塞、`spark.reducer.maxSizeInFlight` 是否过大导致瞬时拉取压力
- 优化：开启压缩（spark.shuffle.compress）、调大 `spark.shuffle.file.buffer`、检查是否有大量小文件需要读取、合并小分区

### 任务 Straggler（掉队 Task）

- 现象：大部分 Task 秒级完成，少数 Task 跑很久
- 解法：开启 `spark.speculation=true`（推测执行），对慢 Task 复制一份在别的 Executor 上执行，先完成的生效；倾斜场景靠 speculation 治标不治本，还是得处理倾斜

### 序列化错误

- 现象：`NotSerializableException`、`Task not serializable`（最常见是闭包里引用了不可序列化的对象，如 SparkSession、Connection）
- 解法：把不可序列化的对象声明为 transient 或改用广播变量；使用 Kryo 序列化（`spark.serializer=org.apache.spark.serializer.KryoSerializer`）并注册类，比 Java 默认快 10 倍以上

### 动态分配不生效

- 现象：Executor 数量恒定不变，不扩容
- 检查：是否开启了 `spark.dynamicAllocation.enabled`；YARN 下是否开了 `spark.shuffle.service.enabled` 且 Shuffle Service 实例存活；是否设置了 `spark.executor.instances` 固定值（两者冲突，固定值优先）

### Executor 丢失

- 现象：`Lost executor` / `Executor is not registered` / `Connection refused`
- 排查：
  - YARN 看容器是被主动杀死（内存超限）还是机器宕机（节点内存/磁盘满）
  - Executor 日志找 `Container killed by YARN for exceeding memory limits` 说明内存配小了
  - 心跳超时（heartbeatInterval 默认 10s，超时 spark.network.timeout 默认 120s）调大网络超时或检查 GC 长停顿
  - 磁盘空间不足导致 Shuffle 写失败，检查 spark.local.dir 所在盘

:::caution
排查问题的通用顺序：**先看 Spark Web UI 的 Stage/Task 耗时与日志 → 再查 Executor 日志与 YARN 容器状态 → 最后结合参数与数据分布下结论**，不要上来就盲目调参。
:::


## 小结

Spark 的核心思想可以浓缩为一句话：**以 RDD 血缘为基础、以宽依赖为界划分 Stage、用内存换速度**。调优也是围绕这三点展开：减小 Shuffle 数据量、提高并行度、让内存物尽其用。掌握架构与调度原理后，大部分性能问题都能从 Web UI 上一眼定位到根因。
