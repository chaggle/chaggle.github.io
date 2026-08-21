---
title: "Kafka 生产调优实践"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "kafka", "调优"]
category: "middleware"
---

> Kafka 调优的本质是**吞吐与可靠的权衡**：Producer 侧（batch、压缩、acks）、Broker 侧（IO 线程、分段、保留策略）、Consumer 侧（拉取、提交、分区并行）。Kafka 最大的性能秘密在**页缓存**——它不靠 JVM 堆缓存数据，所以堆别给太大，钱要花在磁盘和内存页缓存上。部署安装见《大数据与中间件组件部署总览》。

## 核心参数与调优理解

### Producer 侧

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `acks` | all（3.x 默认） | 1 吞吐高但可能丢；all + `min.insync.replicas=2` 是生产标配 |
| `batch.size` | 16384（16K） | 单批消息上限，调大（如 64K）减少网络往返，吞吐提升明显 |
| `linger.ms` | 0 | 攒批等待时间，调到 5~20ms 让批凑满，延迟换吞吐 |
| `compression.type` | none | 开 snappy/lz4，CPU 换网络，大数据量场景收益巨大 |
| `buffer.memory` | 33554432（32M） | Producer 缓冲池，突发流量别让缓冲打满报异常 |
| `retries` | 2147483647 | 重试次数，配合 `enable.idempotence=true` 幂等不重复 |

### Broker 侧

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `num.network.threads` | 3 | 网络线程，8C 机器 4~8，大集群按核数 1/4 |
| `num.io.threads` | 8 | IO 线程（磁盘读写），16 核机器 8~16，写密集调大 |
| `log.segment.bytes` | 1073741824（1G） | 日志分段大小，影响索引粒度与清理粒度，一般 1G 不动 |
| `log.retention.hours` | 168（7 天） | 保留时长，与磁盘容量、下游消费节奏匹配 |
| `log.retention.bytes` | -1 | 按容量保留（如每 topic 500G），防止磁盘写满 |
| `log.flush.interval.messages` | 10000 | 消息数触发刷盘；追求低丢失可调小，一般交给 OS 刷盘 |
| `min.insync.replicas` | 1 | ISR 最小副本数=2 时，acks=all 才真正不丢 |

:::note
**为什么 Kafka 堆不用大**：数据读写走 OS 页缓存（page cache），JVM 堆只放元数据与索引。堆给 4~8G 足够，把内存留给页缓存，热数据命中在内存，IO 骤降。**堆设 32G 反而 Full GC 拖垮吞吐**。
:::


## 三档规格推荐参数

| 参数 | 8C16G | 32C256G | 64C512G |
| ---- | ---- | ---- | ---- |
| Broker 堆（KAFKA_HEAP_OPTS） | 4G | 8G | 8G（省内存给页缓存） |
| `num.network.threads` | 4 | 8 | 12 |
| `num.io.threads` | 8 | 16 | 24 |
| `log.segment.bytes` | 1G | 1G | 1G |
| `log.retention.hours` | 72 | 72~168 | 按容量（`log.retention.bytes`） |
| `min.insync.replicas` | 2 | 2 | 2 |
| `log.dirs` 盘数 | 1~2 | 4 | 8+ |
| Producer `batch.size` | 32K | 64K | 64K |
| Producer `linger.ms` | 5 | 10 | 10 |

:::warning
**副本数与磁盘是硬约束**：`default.replication.factor=3` 意味着 3 倍磁盘占用。64C512G 的机器配 8 块盘时，单 broker 磁盘吞吐约等于 8 块盘的 RAID0 带宽，分区副本再翻倍后，每分区实际可用带宽会骤降——规划吞吐时先算盘，再算副本。
:::


## 集群规模优化（几十~上百节点）

- **分区数规划**：单分区吞吐约 5~20MB/s（取决于磁盘），目标吞吐 ÷ 单分区吞吐 = 分区数；分区总数除以 broker 数让副本均衡；**分区数宁多勿少的教训**：后期扩分区只加不减，且扩容时 consumer 重平衡
- **机架感知**：`broker.rack` 配置，副本跨机架放置，机架级故障不丢数据
- **Consumer 消费力**：分区数 ≥ 消费者数（同组内），lag 监控（Kafka Lag Exporter / dashboard）是必装项；重平衡风暴（频繁 rebalance）用 `partition.assignment.strategy` 选 CooperativeSticky 减少抖动
- **隔离部署**：Kafka 与 Hadoop 作业混部会互相抢磁盘 IO；生产独立 broker 节点
- **监控三件套**：UnderReplicatedPartitions（副本落后）、BytesInPerSec（吞吐水位）、消费 lag；异常联动告警

## 容灾与备份

| 层级 | 手段 | 说明 |
| ---- | ---- | ---- |
| 集群内 | 副本因子 3 + `min.insync.replicas=2` | 单节点故障无感，写入不丢 |
| 跨机房 | MirrorMaker 2 | 主集群 → 灾备集群异步镜像，消费侧可切换 |
| 数据 | Topic 导出备份 | `kafka-dump-log` / Kafka Connect S3/HDFS 归档，满足重放需求 |
| 变更 | 配置审计 | topic 的 retention/副本配置纳入版本管理，避免误改 |

## 调优常见问题

- **吞吐上不去但 CPU 不高**：网络或页缓存瓶颈——检查 `linger.ms`/`batch.size` 是否生效、网卡是否跑满；生产端压缩开启
- **`Not enough replicas` / 写入超时**：ISR 不足（`min.insync.replicas` 未满足）或 `acks=all` 下副本落后；查 UnderReplicatedPartitions
- **消费 lag 持续增长**：消费者线程数 < 分区数、单条消息处理慢、重平衡频繁；先看 lag 分布定位是整体还是单分区（数据倾斜）
- **磁盘写满**：`log.retention.bytes` 未配 + 业务无脑设大 retention；按 topic 容量上限管控
- **rebalance 风暴**：心跳超时（`session.timeout.ms`）或消费者进出频繁；调大 session.timeout、用 CooperativeSticky 分配策略

## 调优检查清单

1. Producer：batch + linger + 压缩 + acks=all + 幂等
2. Broker：堆 4~8G（页缓存优先）、IO 线程按核数
3. 副本因子 3 + ISR=2
4. 分区数按吞吐规划，lag 监控必装
5. 跨机房 MirrorMaker2（核心链路）
6. 磁盘容量与 retention 管控
