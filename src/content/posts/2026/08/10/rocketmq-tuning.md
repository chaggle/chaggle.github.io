---
title: "RocketMQ 生产调优实践"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "rocketmq", "调优"]
category: "middleware"
---

> RocketMQ 的调优主线是**刷盘与复制的两对选择**：异步刷盘还是同步刷盘、异步复制还是同步复制——组合出四种可靠性与性能档位；其次是 Broker 的 JVM 与磁盘 IO。生产默认"异步刷盘 + 异步复制"性能最好，核心链路升到"同步复制"。部署安装见《大数据与中间件组件部署总览》。

## 核心参数与调优理解

### Broker 配置（broker.conf）

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `flushDiskType` | ASYNC_FLUSH | 异步刷盘：写内存立即返回，OS 定期落盘，性能好；SYNC_FLUSH 每次落盘，慢 10 倍+ |
| `brokerRole` | ASYNC_MASTER | 异步复制：主写成功即返回；SYNC_MASTER 等从节点同步完成，双机可用性高 |
| `sendMessageThreadPoolNums` | 1 | 消息写入线程数，8C 机器调 4~8，写密集核心参数 |
| `pullMessageThreadPoolNums` | 20 | 拉取消息线程数，消费旺盛时调大 |
| `maxMessageSize` | 4M | 单条消息上限，业务大消息按需调整 |
| `fileReservedTime` | 72 | 消息文件保留小时数，与磁盘容量联动 |
| `deleteWhen` | 04 | 清理磁盘文件的时刻，业务低峰期 |
| `waitTimeMillsInSendQueue` | 200 | 发送队列满时等待毫秒数，超时直接失败，防队列堆积拖垮 |

### 操作系统层

| 参数 | 说明 |
| ---- | ---- |
| `vm.overcommit_memory=1` | 关闭内存超卖检查，避免大页分配被拒 |
| `vm.swappiness=10` | 降低 swap 倾向，消息内存优先 |
| `ulimit -n 655350` | 文件句柄，Broker 连接与文件数要求高 |

:::note
**可靠性四档组合**：
- 异步刷盘 + 异步复制：性能最好，消息可能丢（宕机窗口）
- 同步刷盘 + 异步复制：消息不丢（落盘了），但主宕机同步窗口内从机可能缺数据
- 异步刷盘 + 同步复制：性能尚可，主从切换不丢已同步消息
- 同步刷盘 + 同步复制：最稳最慢，极少场景使用
:::


## 三档规格推荐参数

| 参数 | 8C16G | 32C256G | 64C512G |
| ---- | ---- | ---- | ---- |
| Broker JVM 堆（runbroker.sh） | 4G | 12G | 16G |
| NameServer 堆（runserver.sh） | 1G | 2G | 2G |
| `sendMessageThreadPoolNums` | 4 | 8 | 16 |
| `pullMessageThreadPoolNums` | 20 | 40 | 64 |
| `flushDiskType` | ASYNC_FLUSH | ASYNC_FLUSH | ASYNC_FLUSH |
| `brokerRole` | ASYNC_MASTER | SYNC_MASTER（核心链路） | SYNC_MASTER |
| `maxMessageSize` | 4M | 4M | 8M |
| commitlog 磁盘 | 1~2 盘 | 4 盘（RAID0/裸盘） | 8+ 盘 |
| `fileReservedTime` | 48 | 72 | 按容量配 |

:::warning
Broker JVM 堆**不要给太大**：RocketMQ 利用 mmap 与页缓存，堆 8~16G 即可，内存留给 OS 页缓存（同 Kafka 的道理）。堆 32G+ 会因 Full GC 造成发送毛刺。
:::


## 集群规模优化（几十~上百节点）

- **主从成组扩展**：多组主从（如 3 主 3 从）水平扩展吞吐；topic 建在 master 上，读流量可走 slave（`readQueueNums` 与 `slaveReadEnable`）
- **Broker 分组规划**：按业务拆分独立 broker 集群（订单集群/日志集群），故障爆炸半径收敛；`brokerClusterName` 区分
- **Topic 与队列规划**：写并行度 = master 数 × `writeQueueNums`；读并行度 = 消费组消费者数 × `readQueueNums`；队列数后期只加不减，规划时按峰值预留
- **消费积压治理**：`mqadmin consumerProgress` 巡检；积压持续时先确认消费端能力（线程池、下游 IO），再考虑扩容消费者/加队列
- **磁盘 IO 优化**：commitlog 与 consumequeue 分盘；`storePathCommitLog` 放性能最好的盘，`storePathRootDir` 分区独立
- **NameServer 2~3 台**：不参与业务流量，轻量部署；客户端 `namesrvAddr` 写全

## 容灾与备份

| 层级 | 手段 | 说明 |
| ---- | ---- | ---- |
| 高可用 | 主从同步复制 | `brokerRole=SYNC_MASTER`，主挂从机顶上不丢已同步消息 |
| 高可用 | NameServer 多台 | 单台故障不影响路由发现 |
| 数据 | 消息重放 | 消费端幂等 + 消息可重放设计，业务侧兜底 |
| 数据 | 文件备份 | commitlog 定期归档到对象存储（离线重放场景） |
| 监控 | 积压/主从同步监控 | dashboard + 告警：积压数、slave 落后数 |

:::note
RocketMQ 的事务消息（半消息 + 回查）是业务一致性的关键工具：先写半消息，本地事务成功后提交。回查参数 `transactionCheckInterval` 与 `transactionTimeOut`（默认 6s/回查间隔）按业务事务时长配置，避免高频回查放大 DB 压力；超时未决消息会滞留，需要兜底任务处理。
:::


## 调优常见问题

- **发送超时（`sendDefaultImpl call timeout`）**：Broker 写入线程打满（调 `sendMessageThreadPoolNums`）、磁盘慢、或 `waitTimeMillsInSendQueue` 太小被提前丢弃
- **消费积压持续增长**：消费线程不足或下游阻塞；先 `mqadmin consumerProgress` 看 lag 分布，再调消费者线程池
- **启动 OOM**：`runbroker.sh`/`runserver.sh` 的 Xmx 与机器内存不匹配，按规格表调整
- **主从不同步**：`brokerRole=SYNC_MASTER` 时从机故障会导致主写入阻塞，注意 `slaveReadEnable` 与健康检查
- **消息重复消费**：客户端重试 + 主从切换导致；消费端必须幂等（唯一键去重），这是 RocketMQ 语义内的事
- **磁盘写满**：`fileReservedTime` 未收敛 + 生产量增长，按容量配 `deleteWhen` 与保留时长

## 调优检查清单

1. 刷盘/复制组合按可靠性要求定档
2. Broker 堆 8~16G，内存留给页缓存
3. 发送/拉取线程池与核数匹配
4. 主从成组 + 同步复制（核心链路）
5. 积压与同步滞后监控告警
6. 消费端幂等 + 消息重放演练
