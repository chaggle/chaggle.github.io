---
title: "RocketMQ 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "rocketmq"]
category: "middleware"
---
> 本文是我学习 RocketMQ 时整理的笔记，围绕四大组件、存储与高可用架构、消息模型，以及线上常见的堆积、丢失、顺序与事务问题展开，适合面试复习和日常排查参考。

## 核心架构

RocketMQ 集群由四大组件构成：

- **NameServer**：轻量级路由中心，维护 Topic 与 Broker 的路由信息，Broker 启动时注册、断开时剔除，不存储消息数据，**无状态**，可多台部署互为冗余。
- **Broker**：消息存储与转发节点，负责接收生产者消息、落盘、向消费者推送/拉取消息，每个 Broker 保存全部 Topic 的部分队列数据。多 Broker 组成主从结构。
- **Producer**：消息生产者，从 NameServer 拉取路由信息后选择队列发送，支持失败重试、延迟消息、事务消息。
- **Consumer**：消息消费者，分为 Push 与 Pull 两种模式，从 Broker 拉取消息消费。

### 路由注册与心跳机制

- Broker 启动后**每 30 秒**向所有 NameServer 发送心跳（注册自身信息与 Topic 路由表），NameServer 若 **10 秒**收不到心跳，则将该 Broker 标记为不可用。
- Producer / Consumer 在发送/消费前先向 NameServer 拉取路由（默认每 30 秒定时更新），因此 **NameServer 与客户端之间的路由不是实时的**，Broker 宕机后客户端最多需要 30 秒左右感知。

:::note
NameServer 之间互不通信，各自独立保存全量路由，Broker 向所有 NameServer 同时注册，保证单台 NameServer 故障不影响集群路由发现。
:::


## 存储原理

### CommitLog

- 所有 Topic 的消息**共享写入一个文件**：`CommitLog`，按顺序追加，文件默认 1GB（`mapedFileSizeCommitLog`），写满后新建文件，文件名即起始物理偏移量。
- 顺序写 + 内存映射（mmap）是 RocketMQ 高吞吐的基础：所有消息统一进 CommitLog，彻底避免了多 Topic 各自随机写文件带来的性能损耗。

:::tip
"所有消息写一个文件"是 RocketMQ 与 Kafka（按分区文件）最大的存储差异：RocketMQ 牺牲了一点查询灵活性，换取了极致的顺序写性能与极低的文件数。
:::


### ConsumeQueue

- 每个 Topic 的每个 Queue 对应一组 `ConsumeQueue` 文件，记录**消息在 CommitLog 中的偏移量、长度、tag hash** 等索引信息，按顺序递增。
- 消费时先查 ConsumeQueue 拿到物理偏移，再去 CommitLog 读取真实消息，实现"索引与数据分离"。

### IndexFile

- 按 key 或统一时间戳查询消息时使用 `IndexFile`（哈希索引），支持"按 key 精确查"与"按时间范围查"，主要用于业务排查与运维工具（如 `mqadmin queryMsgByKey`）。

### 页缓存与 mmap

- Broker 写入与读取都基于 `FileChannel` + `mmap`（MappedByteBuffer）读写，数据先进入**页缓存（Page Cache）**，由操作系统统一管理刷盘，命中缓存时读写极快。
- 读取路径：先读 ConsumeQueue 索引（常驻页缓存），再读 CommitLog 数据，两者都尽量命中页缓存。

### 消息刷盘策略

- **同步刷盘（SYNC_FLUSH）**：消息写入 CommitLog 并成功落盘后，才向生产者返回写入成功，可靠性最高，但吞吐下降。
- **异步刷盘（ASYNC_FLUSH）**：写入页缓存即返回，由后台线程批量刷盘，吞吐高，机器断电可能丢少量消息（默认配置）。

:::warning
同步/异步刷盘关注的是"Broker 本地不丢"，与主从复制关注点不同；生产环境单机数据可靠性要求高时用同步刷盘，重吞吐场景用异步刷盘 + 主从同步复制组合。
:::


## 消息模型

### Topic 与 Queue

- **Topic**：业务逻辑上的消息类别，一个 Topic 可以分布在多个 Broker 上。
- **Queue（队列）**：Topic 的物理切分单元，每个 Broker 上每个 Topic 默认 4 个队列（`defaultTopicQueueNums`），队列是消息顺序的最小保证单位，也是消费并行度的来源。

### 消费模式

- **集群消费（Clustering）**：同一消费组内各消费者分摊队列，一条消息只被组内一个消费者消费（默认）。
- **广播消费（Broadcasting）**：组内每个消费者都消费全部消息，适合"每台机器都要收到"的场景，如本地缓存刷新。

### 消费组与负载均衡

- 同一消费组共享消费进度（offset 存在 Broker），Rebalance 时按"消费者数 : 队列数"平均分配队列，消费者数超过队列数则部分消费者空闲。
- 消费组内消费者故障或新消费者加入时，会触发 Rebalance 重新分配队列。

:::note
Rebalance 造成队列从消费者 A 迁移到 B 时，B 从"存储的 offset"继续消费，因此可能出现重复消费；消费者数量建议与队列总数成倍数关系，避免分配不均。
:::


### 顺序消息

- **局部有序**：把需要有序的消息通过选择队列算法（如 MessageQueueSelector 按订单 ID 哈希）送入**同一个队列**，该队列单线程顺序消费，即保证队列内严格有序。
- **全局有序**：一个 Topic 只有一个队列，吞吐受限，非必须不采用。
- 消费端需避免并发/重试导致的乱序：用 MessageListenerOrderly（顺序消费会加锁并严格串行处理）。

### 事务消息（半消息 + 回查）

事务消息流程（两阶段）：

1. Producer 发送**半消息（half message）**，Broker 暂存，消费者不可见。
2. 执行本地事务，成功则提交事务消息，失败则回滚。
3. 若本地事务结果未上报（网络异常等），Broker 定时**回查**（check）Producer 的本地事务状态，Producer 实现 `TransactionListener#checkLocalTransaction` 返回提交/回滚。

:::caution
事务消息解决的是"本地数据库操作与发消息"的一致性问题，但需要业务实现**本地事务表或日志**来支撑回查，否则回查时无法判断业务是否成功，可能造成消息最终状态不确定。
:::


### 延迟消息

- 内置 18 个延迟级别（`messageDelayLevel`：1s/5s/10s/30s/1m/2m/3m/4m/5m/6m/7m/8m/9m/10m/20m/30m/1h/2h），`setDelayTimeLevel(3)` 即延迟 10 秒。
- 实现原理：延迟消息写入**专门的延迟队列（SCHEDULE_TOPIC_XXXX）**，定时任务扫描到期后重新投递到真实 Topic，到期时间只精确到秒级。
- 支持自定义时间（5.x 新增）需配置时间跨度较大的 level，或使用定时消息（基于时间轮实现）。

## 高可用

### Broker 主从结构

- 每个 Broker 分为 Master 与 Slave（可 1 主多从），同一 Broker 组的 Master/Slave 数据同步有**同步复制**与**异步复制**两种：
  - **同步复制（SYNC_MASTER）**：主从都写入成功才返回，可靠性高，可用性略降（从挂掉会导致主不可用），Broker 主从切换后数据不丢。
  - **异步复制（ASYNC_MASTER）**：主写入成功即返回，主挂掉时可能丢少量消息，但可用性好。
- 主从切换：传统模式下需要运维介入切换（更新 namesrv 路由、重启）；5.x 引入 **Controller 模式**（基于 DLedger/Raft 的自动切换）可实现自动选主。

:::tip
Broker 故障自动恢复优先级：同一 Broker 组内 Slave 可接管读请求（消费端优先读 Slave），Master 宕机后由 Controller（或运维）将 Slave 提升为 Master。
:::


### NameServer 高可用

- NameServer 完全无状态，多台独立部署即高可用，Broker 向所有 NameServer 注册，客户端随机选一台即可获得全量路由。

:::note
RocketMQ 的"高可用"依赖三层：NameServer 无状态多活（路由层）、Broker 主从复制（数据层）、消息消费的 offset 持久化（进度层），三层各自独立设计，故障面被隔离。
:::


## 常规问题排查

### 消息堆积

- 用控制台或 `mqadmin consumerProgress -g group` 查看消费进度与堆积量。
- 堆积原因：消费能力不足（并发线程数小、单条处理慢）、消费者宕机、Rebalance 后队列分配不均、Broker 读性能下降。
- 处理：提高消费线程数、优化单条处理耗时、扩容消费者（注意队列数限制）、短期可临时增加队列并扩消费者，快速止血。

### 消息丢失

排查点（按可靠性层级）：

- Producer 发送失败：`retryTimesWhenSendFailed` 默认 2 次，确认是否重试足够。
- Broker 刷盘策略：异步刷盘 + 机器断电会丢数据，关键业务改同步刷盘。
- 主从复制：异步复制下主挂会丢，改同步复制（SYNC_MASTER）。
- 消费端：消费失败且重试耗尽会进入死信队列，若 DLQ 无人处理等于"逻辑丢失"。

### 重复消费

重复消费不可避免（至少一次语义），常见原因与对策：

- 消费成功但提交 offset 失败（客户端宕机/网络闪断）后重新消费。
- Rebalance 迁移队列导致重复。
- 对策：消费逻辑幂等（唯一键去重、数据库主键防重、Redis setnx 去重）。

### 顺序错乱

- 原因 1：业务未保证同一业务键进同一队列（未用 MessageQueueSelector）。
- 原因 2：使用了并发消费（MessageListenerConcurrently）。
- 原因 3：消费失败重试时跳过失败消息继续消费后续消息。
- 对策：selector 选队列 + MessageListenerOrderly 顺序消费；重试需暂停后续消费或把失败消息转死信由专门消费者处理。

### 事务消息不回查 / 卡在半提交

- 确认 Producer 实现并注册了 `TransactionListener`。
- 回查间隔与次数有限（默认回查 15 次），回查失败会丢弃半消息，需在业务侧查"本地事务表"核对。
- 排查：`mqadmin queryMsgById` 查看半消息状态（Commit/ROLLBACK），配合监控半消息数量指标。

### Broker 内存 / 磁盘告警

- 磁盘：CommitLog 与 ConsumeQueue 按保留时间（`fileReservedTime`，默认 72 小时）清理；磁盘写满会导致 broker 停写，关注磁盘使用率告警并合理设置清理策略。
- 内存：页缓存占用高是正常现象（RocketMQ 依赖页缓存），主要监控 JVM 堆内存与 GC；大量瞬时消息可能造成内存页缓存压力大，注意 `maxMessageSize` 与流量规划。
- CPU 高：关注是否发送了大消息、消费端频繁 GC、刷盘线程打满。

### 消费重试与死信队列（DLQ）

- 消费失败默认**重试 16 次**，间隔按 `%RETRY%` 队列的延迟等级递增（10s → 5min 逐级增加）。
- 重试耗尽后消息转入**死信队列 `%DLQ%消费组名`**，DLQ 默认只读，需要人工（或运维脚本）消费恢复。

:::warning
DLQ 是"最后一道防线"，必须配置告警与人工处理流程，否则消息静默丢失；恢复时注意按消息头里的原 Topic 信息重新投递并处理幂等。
:::


### 常用排查命令

```bash
# 查看消费进度与堆积
mqadmin consumerProgress -g <group> -n <namesrvAddr>

# 查看 Topic 路由与队列分布
mqadmin topicRoute -t <topic>

# 按 key 查询消息
mqadmin queryMsgByKey -t <topic> -k <key>

# 查看 broker 运行状态与连接数
mqadmin brokerStatus -b <brokerAddr>

# 查看/修改延迟级别配置
mqadmin updateBrokerConfig -b <brokerAddr> -c messageDelayLevel
```

:::tip
RocketMQ 排障思路总结：先看生产端（发送是否成功）→ 再查存储端（刷盘/复制/磁盘）→ 后看消费端（重试、DLQ、堆积），结合消息轨迹（5.x 支持全链路轨迹）可以快速定位每一跳的问题。
:::

