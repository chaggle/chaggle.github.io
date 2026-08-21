---
title: "Kafka 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "kafka"]
category: "middleware"
---
> 本文是我学习 Kafka 时整理的笔记，涵盖核心架构、底层存储原理、副本与一致性机制、生产消费流程，以及日常排障的经验总结，适合面试复习和实际排查问题参考。

## 核心架构

### 角色划分

Kafka 集群主要由以下几类角色组成：

- **Producer（生产者）**：向 Topic 发送消息的客户端，负责选择分区、批量发送、处理发送结果。
- **Broker（服务端）**：Kafka 集群中的一台服务器就是一个 Broker，负责消息的存储、接收与副本管理。
- **Consumer（消费者）**：从 Topic 拉取消息的客户端，多个消费者组成消费组协同消费。
- **Controller（控制器）**：集群中特殊角色，负责分区 Leader 选举、元数据管理等集群协调工作，本质是一个 Broker。
- **Zookeeper / KRaft**：旧版本依赖 Zookeeper 存储元数据（Topic、分区、broker 状态等）并完成 Controller 选举；新版本引入 KRaft 模式，用内置的 Raft 协议替代 ZK，简化运维。

:::note
2.8 版本开始引入 KRaft（Kafka Raft Metadata mode），3.3+ 起 KRaft 生产可用，4.0 已完全移除 Zookeeper。KRaft 通过 Controller 节点上内置的 Raft 日志存储元数据，Controller 与 Broker 角色可以合并部署，也可以独立部署。
:::


### 核心概念

- **Topic（主题）**：消息的逻辑分类，一个 Topic 可被多个生产者写入、多个消费组读取。
- **Partition（分区）**：Topic 在物理上的切分单元，每个分区是一个有序的日志文件，分区内消息有序，分区之间无序。
- **Offset（偏移量）**：分区内消息的唯一序号，从 0 开始递增，Consumer 通过维护 offset 记录消费进度。

:::tip
分区是 Kafka 并行度的来源：生产者按分区并行写、消费者按分区并行读。分区数越多，吞吐上限越高，但也带来更多文件句柄与副本开销，并非越多越好。
:::


## 存储原理

### 分区与段（Segment）

每个 Partition 在磁盘上是一个目录（`topic-分区号`），目录内按**段（Segment）**组织数据：

- `.log`：消息数据文件，消息按 offset 顺序追加写入。
- `.index`：稀疏索引文件，记录 offset 到物理位置的映射（消息在文件中的字节偏移）。
- `.timeindex`：时间索引文件，记录时间戳与 offset 的映射，用于按时间查询。

每个 Segment 默认 1GB（`log.segment.bytes`）达到上限后滚动创建新 Segment，活动段（active segment）之外的段可以被删除或压缩。

### 稀疏索引

.index 文件不是每条消息都建索引，而是**每隔一定字节（`log.index.interval.bytes`，默认 4096）写入一条索引项**，即稀疏索引。

- 好处：索引文件体积小，能常驻内存，检索快。
- 查找流程：先二分查找最近的索引项定位到起始物理位置，再顺序扫描 .log 文件定位目标消息，单次查找磁盘扫描量很小，性能可观。

### 顺序写与页缓存

- **顺序写**：消息追加到日志文件尾部，磁盘顺序写速度远高于随机写（机械盘百倍级差距），这是 Kafka 高吞吐的核心之一。
- **页缓存（Page Cache）**：Kafka 写入数据只落 Page Cache，由操作系统统一管理刷盘，而非自己维护缓存；读取时优先命中 Page Cache，保证读写两端都很快，也实现了"读写都用 OS 缓存、磁盘只做备份"的效果。

:::warning
Kafka 依赖页缓存 + 顺序写获得高性能，因此建议机器内存尽量充裕，并关闭"脏页回写"相关不必要的限制（如 vm.dirty_ratio），不要在同一台机器上部署多个重 IO 应用抢占缓存。
:::


### 零拷贝（sendfile）

Consumer 拉取消息时，服务端将磁盘数据发给网卡，传统做法要经过"磁盘 → 内核缓冲区 → 用户态 → 内核 socket 缓冲区 → 网卡"多次拷贝；Kafka 使用 `sendfile`（FileChannel.transferTo）让数据**直接从内核页缓存拷贝到网卡**，全程不经过用户态，极大降低 CPU 与拷贝开销。

### 批量写与批量读

- Producer 攒批发送（batch + linger.ms），减少网络往返。
- Broker 接收后以批次（record batch）为单位落盘。
- Consumer 拉取时按 `fetch.min.bytes` / `fetch.max.wait.ms` 攒批返回。

## 副本机制

### 分区副本

每个分区有多个副本（`replication.factor`），其中：

- **Leader**：负责所有读写请求，Producer 和 Consumer 只与 Leader 交互。
- **Follower**：从 Leader 拉取消息同步数据，Leader 故障时参与选举。

### ISR、HW、LEO

- **LEO（Log End Offset）**：副本日志下一条待写入消息的 offset，即日志末尾位置。
- **HW（High Watermark）**：已同步的最小 LEO，Consumer 只能消费到 HW 之前的消息，保证消费到的数据至少在多数副本上存在。
- **ISR（In-Sync Replicas）**：与 Leader 保持同步的副本集合，默认 `replica.lag.time.max.ms`（10 秒）内未跟上同步的副本会被踢出 ISR。

:::caution
HW 机制下消费只能看到"已提交"的消息，可能造成消息"不可见延迟"；且 HW 的推进依赖副本之间的同步与 Leader 转发，配合 fetch 协议存在数据丢失/重复的窗口期（旧版本消息发送语义的固有风险），生产环境应启用 `min.insync.replicas` 并配合 acks=all 降低风险。
:::


### Leader 选举

- 分区 Leader 宕机后由 **Controller** 在 ISR 中挑选新 Leader（优先 ISR，ISR 为空时可降级选择非 ISR 副本，并可能丢数据）。
- 选举范围优先"最近同步过"的副本，避免选出一个数据明显落后的副本导致大量消息"回退"。

### acks 三种级别

| acks | 行为 | 语义 |
| :--- | :--- | :--- |
| 0 | 发完就返回，不等待任何确认 | 最快，可能丢消息 |
| 1 | Leader 写入本地日志后返回 | 默认值，Leader 宕机可能丢数据 |
| all（-1） | 等待 ISR 全部副本写入后返回 | 最可靠，配合 `min.insync.replicas` 使用 |

:::tip
高可靠场景建议 acks=all + min.insync.replicas=2（至少 2 个副本同步才算提交），牺牲部分延迟换取不丢消息。
:::


## 生产者原理

### 分区策略

Producer 发送消息时确定目标分区，规则如下：

- 消息指定了 Partition：直接使用指定分区。
- 指定了 Key：对 Key 哈希取模（`murmur2`）选择分区，相同 Key 的消息进入同一分区，保证同 Key 消息有序。
- 两者都没指定：使用 **Sticky Partitioner**，随机选一个分区并尽量把消息攒到一个批次里发出去，兼顾负载均衡与批处理效率。

### 批量发送与缓冲

- 消息先进入内存缓冲（`buffer.memory`，默认 32MB），由发送线程批量取出发送。
- `batch.size`（默认 16KB）控制单批次大小，`linger.ms` 控制等待时间，两者共同决定"攒批"的程度。
- 缓冲区写满时 `max.block.ms` 到期后抛异常，需要监控该异常。

### 幂等性（PID + 序列号）

开启 `enable.idempotence=true` 后：

- Producer 初始化时分配 **PID（Producer Id）**，每条消息携带该 PID 和**单调递增的序列号**（按分区维度）。
- Broker 端校验序列号，重复的序列号直接丢弃，从而解决"重试导致的消息重复"问题。
- 注意：PID 只在单会话有效，重启会生成新 PID；且只对单分区有序，跨分区无法保证全局不重复。

### 事务

`enable.idempotence=true` 是事务的前提，事务通过 Transaction Coordinator 管理：

- 支持"多分区原子写入"和"读已提交（read_committed）"消费语义。
- 通过 LSO（Last Stable Offset）控制，只有事务提交后消息才对 read_committed 消费者可见。
- 典型应用：Kafka Streams 的 exactly-once 处理。

## 消费者原理

### 消费组与分区分配

- 同一消费组内，一个分区同一时刻只能被一个消费者实例消费（一条消息只被组内一个消费者消费）。
- 消费者数 > 分区数时，多余的消费者空闲。
- 分配策略（`partition.assignment.strategy`）：

| 策略 | 说明 |
| :--- | :--- |
| Range | 按 Topic 内分区序号范围连续划分，易造成"前段消费者分多、后端消费者分少"的不均衡 |
| RoundRobin | 全部分区轮询分配，相对均衡 |
| Sticky | 在保持上次分配尽量不变的前提下均衡分配，减少 rebalance 后的分区移动 |

### Rebalance（新旧协议）

- 发生条件：消费者加入/退出、分区数变化、消费组订阅变化。
- 新协议（增量式合作 rebalance，0.11+）：消费者和 Group Coordinator 之间用"分阶段协商"，每次只迁移需要移动的分区，Sticky/CooperativeSticky 策略下能显著降低全组停止消费的时间。
- 旧协议：停止消费 → 全体重新分配 → 重新拉取，期间整个消费组不可用。

:::warning
Rebalance 期间消费组短暂不可用，频繁 rebalance 通常意味着：消费者心跳超时、处理时间过长导致会话超时、网络抖动，或消费者实例频繁启停，需要重点排查。
:::


### Offset 提交

- 自动提交（`enable.auto.commit=true`，默认）：每 `auto.commit.interval.ms`（默认 5 秒）提交当前拉取位置。注意它提交的是"最近一次 poll 返回的 offset"，处理滞后会导致重复消费，因此自动提交需配合幂等消费设计。
- 手动提交：`commitSync`（同步，重试保证不丢）或 `commitAsync`（异步，不阻塞但可能失败）。
- Offset 存放在内部 Topic `__consumer_offsets`（默认 50 个分区），消费进度是"committed offset 与 consumed 之间"的关系。

## 高可用与故障恢复

- **副本同步**：Follower 以 fetch 方式向 Leader 拉取数据，Leader 在 ISR 内推进 HW，Consumer 只能读到 HW 前的数据。
- **Controller**：负责分区 Leader 选举、Broker 上下线元数据变更通知（通过 ZK 或 KRaft）；Controller 本身也靠选举保证高可用（旧版基于 ZK，KRaft 基于 Raft）。
- **日志压缩（Log Compaction）**：针对"保留最新 value"的场景（如 Key-Value 型数据、配置同步），压缩后日志中每个 Key 只保留最新版本，可配合 `cleanup.policy=compact` 使用，与"基于时间的过期删除"是两种不同的清理策略。
- **分区副本重新分配**：Broker 下线后，Controller 会在存活 Broker 上补足副本（auto.leader.rebalance 与副本迁移任务）。

:::tip
Kafka 的可用性保障是"多副本 + ISR 选主 + 分区迁移"，数据安全由 acks 级别和 min.insync.replicas 决定，两者组合使用才能兼顾可用与可靠。
:::


## 常规问题排查

### 消费堆积（Lag）

- 用命令行查看：`kafka-consumer-groups.sh --bootstrap-server xxx --describe --group g1`，关注 LAG 列。
- 判断堆积原因：
  - 消费能力不足：单条消息处理耗时长、消费者线程数 < 分区数。
  - 消费卡住：消费线程异常/阻塞/频繁 rebalance 导致重复消费。
  - 生产过快：生产速率超过消费能力。
- 处理手段：扩容消费者实例/增加分区、优化消费逻辑、必要时直接重置 offset（`--reset-offsets`，谨慎使用）。

### 消息丢失与重复

丢失常见原因：

- `acks=0/1` 且 Broker 宕机。
- 生产者发送失败未重试（`retries=0`）。
- 消费者自动提交 offset 后处理失败。
- 分区 Leader 从非 ISR 副本选出（丢未同步消息）。

重复常见原因：

- 生产者重试造成重复 → 开启幂等（PID+序列号）。
- 消费者处理成功后未提交 offset 就宕机 → 重复消费，业务侧要做幂等。
- 事务/跨分区场景的 exactly-once 需依赖事务与 read_committed。

### 分区数调整

- 分区只能增多不能减少（`kafka-topics.sh --alter --partitions N`）。
- 增加分区后，如果消息有 Key，相同 Key 可能落到不同分区，**同 Key 有序性被破坏**。
- 分区数调整会触发消费者 rebalance。

:::warning
分区数的选择要结合吞吐目标与扩展计划一次规划好（如 3×broker 下 6/9 分区），后期"只增不减"，改分区数是个敏感操作。
:::


### 磁盘占用与清理

- 默认按时间保留（`log.retention.hours=168`）或按大小（`log.retention.bytes`）。
- 磁盘告警排查：`du -sh` 查看分区目录大小；确认是否有 Topic 未设置合理的 retention；检查日志压缩是否生效；清理旧 Topic（`kafka-topics.sh --delete`）。
- 磁盘空间不足会直接导致 Broker 写失败，务必提前监控。

### 吞吐瓶颈定位

- 排查链路：Producer 端（batch.size / linger.ms / compression 压缩）、网络带宽、Broker 磁盘 IO（顺序写是否被打断）、页缓存命中率、Consumer 拉取参数。
- 常见手段：开启 `compression.type=lz4/zstd`、调大 `num.io.threads`、确认分区数足够并行。
- 用 `kafka-run-class.sh kafka.tools.JmxTool` 或监控面板看 IO 与网络指标。

### Rebalance 频繁

- 检查 `session.timeout.ms` 与 `max.poll.interval.ms`：处理慢导致超时被踢出消费组。
- 检查 `heartbeat.interval.ms` 是否过大。
- 排查消费者实例是否频繁上下线（如容器 OOM、被调度重启）。
- 升级到 CooperativeSticky 策略减少 rebalance 影响面。

### 客户端参数调优要点

| 场景 | 建议 |
| :--- | :--- |
| 高吞吐 | 调大 batch.size、linger.ms，开启压缩 |
| 低延迟 | 调小 linger.ms（如 5ms），适当减小 batch |
| 高可靠 | acks=all + enable.idempotence=true + min.insync.replicas=2 |
| 消费能力 | max.poll.records 与处理耗时匹配，超时调大 max.poll.interval.ms |

:::tip
排查 Kafka 问题遵循三板斧：先看 Lag（消费是否跟上）、再看 rebalance（消费组是否稳定）、最后看磁盘/页缓存/网络（Broker 是否健康），配合监控告警能快速定位大部分故障。
:::

