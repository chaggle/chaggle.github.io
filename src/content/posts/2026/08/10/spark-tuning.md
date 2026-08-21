---
title: "Spark 生产调优实践"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "spark", "调优"]
category: "bigdata"
---

> Spark 调优围绕四个变量转：**Executor 的数量 × 单 Executor 的内存 × 单 Executor 的核数**，以及**分区数（并行度）**。前三个决定资源总量，第四个决定并行度是否与资源匹配——资源给了、并行度不够，照样跑不快。本文给出三档规格的分配方案与常见坑。部署安装见《大数据与中间件组件部署总览》。

## 核心参数与调优理解

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `spark.executor.memory` | 1G | 单 Executor 堆内存，结合核数决定 Executor 规模 |
| `spark.executor.cores` | 1 | 单 Executor 核数，**建议 3~5**：太多则单 Executor 内任务并发 IO 互相竞争 |
| `spark.executor.memoryOverhead` | 堆的 10% | 堆外内存（Metaspace、网络、序列化缓冲），大作业容易在这里 OOM |
| `spark.memory.fraction` | 0.6 | 堆内执行+存储内存占比，剩余给用户代码；GC 频繁可降到 0.5~0.6 |
| `spark.memory.storageFraction` | 0.5 | 存储内存占比，缓存多的作业调大 |
| `spark.sql.shuffle.partitions` | 200 | Shuffle 分区数，**必须随数据量与集群规模调整**，公式：总 Executor 核数 × 2~3 |
| `spark.sql.autoBroadcastJoinThreshold` | 10M | 小表广播阈值，调到 50~100M 可消除大量 shuffle |
| `spark.sql.adaptive.enabled` | true（3.2+） | AQE 动态合并/拆分分区、自动处理倾斜，生产必开 |
| `spark.serializer` | Java | 换 Kryo：序列化数据量减少 2~5 倍，性能与 GC 双受益 |
| `spark.local.dir` | /tmp | Shuffle 临时目录，多盘分布（逗号分隔），避免单盘瓶颈 |

:::note
**Executor 分配的黄金法则**：单 Executor 核数 3~5，内存 8~32G。每节点 Executor 数 = 可用核 ÷ Executor 核数。宁可 Executor 多而小，不要大而少（单 Executor 太大 → GC 长暂停 + 故障影响面大）。
:::


## 三档规格推荐参数（on YARN）

| 参数 | 8C16G（单节点） | 32C256G（每节点） | 64C512G（每节点） |
| ---- | ---- | ---- | ---- |
| 可用核（预留后） | 6 | 28 | 58 |
| Executor 核数 | 2 | 4 | 5 |
| Executor 内存 | 3G | 16G | 32G |
| Executor 数 | 3 | 6~7 | 11~12 |
| `spark.executor.memoryOverhead` | 0.5G | 4G | 8G |
| `spark.driver.memory` | 2G | 8G | 16G |
| `spark.sql.shuffle.partitions` | 400 | 2000~4000 | 5000~10000 |
| 广播阈值 | 50M | 100M | 100M |

:::warning
三档表是**每节点**的值。集群提交作业时用动态资源分配（`spark.dynamicAllocation.enabled=true`），让作业按需申请，避免"一个集群配一套全局参数"的僵化。但 `spark.sql.shuffle.partitions` 要与作业实际数据量联动，不能只靠资源分配解决。
:::


## 集群规模优化（几十~上百节点）

- **AQE 三件套全开**：
  - `spark.sql.adaptive.coalescePartitions.enabled=true`（动态合并小分区）
  - `spark.sql.adaptive.skewJoin.enabled=true`（倾斜 join 自动拆分）
  - `spark.sql.adaptive.advisoryPartitionSizeInBytes=64M`（合并后的目标分区大小）
- **序列化**：全部换 Kryo（`spark.serializer=org.apache.spark.serializer.KryoSerializer`），注册类减少大对象序列化成本
- **shuffle 阶段**：`spark.shuffle.compress=true`、`spark.shuffle.file.buffer=64k`；`spark.local.dir` 每节点 4~8 盘，shuffle 数据 IO 摊开
- **缓存策略**：频繁复用的中间结果 `cache()` 并确认存储级别（`storageLevel= MEMORY_AND_DISK`）；用完 `unpersist()`，防止内存被缓存挤占执行空间
- **join 策略**：数据量允许的维度表直接广播（阈值 100M 内）；事实表 join 用分桶 + bucket join（`spark.sql.bucketing.enabled`）
- **写 HDFS 调小文件**：`spark.sql.shuffle.partitions` 与 AQE 合并配合，写出分区数收敛到目标文件数（目标单文件 128~256M）
- **GC 观察**：Executor 日志看 GC 时间占比 >10% 时，优先降低 `spark.memory.fraction` 给用户代码留空间，或换 G1

## 容灾与备份

- **事件日志**：`spark.eventLog.enabled=true` + `spark.eventLog.dir=hdfs://...`，配合 HistoryServer 留存全部作业审计与排障依据
- **流作业 Checkpoint**：`spark.sql.streaming.checkpointLocation` 指向 HDFS，故障恢复不丢进度
- **Driver 高可用**：生产统一 `--deploy-mode cluster`（Driver 由 YARN 托管，失败自动重试）
- **作业重跑**：离线作业幂等设计（目标表先删后写或分区覆盖），失败重跑不产生重复数据

## 调优常见问题

- **Executor 全灭（Lost executor）**：内存超 YARN 容器上限被 Kill——`executor.memory + memoryOverhead` 超过 `yarn.scheduler.maximum-allocation-mb`，或节点内存被打满
- **GC 时间过长**：executor 内存与核数不匹配（核多内存少）、`spark.memory.fraction` 过高挤占用户代码堆
- **数据倾斜卡死**：一个分区拖垮整体——开启 AQE skewJoin，或业务侧对热点 key 加盐（前缀随机数）二次聚合
- **小文件成灾**：`shuffle.partitions` 过大 + 输出目标无合并，AQE coalesce 与目标分区数对齐
- **广播超限报 OOM**：`autoBroadcastJoinThreshold` 调太大，广播表超过 Executor 内存；阈值按最小 Executor 内存的 1/3 封顶

## 调优检查清单

1. Executor = 核 3~5、内存 8~32G，与 YARN 上限匹配
2. 动态资源分配开启
3. shuffle.partitions 与数据量/集群核数联动
4. AQE 全开 + Kryo + 多盘 local.dir
5. 事件日志 + checkpoint + cluster 模式
6. 定期观察 GC 占比与 Executor 稳定性
