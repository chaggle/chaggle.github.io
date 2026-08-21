---
title: "YARN 生产调优实践"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "yarn", "调优"]
category: "bigdata"
---

> YARN 调优的核心是**算好每台机器能拿出多少资源给容器**，以及**资源怎么分给不同业务**。前者是内存与核数预算（要留给操作系统和系统进程），后者是队列规划（Capacity Scheduler）。调不好最常见的症状：作业一直 ACCEPTED 不跑、容器 OOM、大作业挤死小作业。部署安装见《大数据与中间件组件部署总览》。

## 核心参数与调优理解

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `yarn.nodemanager.resource.memory-mb` | 8192 | 单节点可分配给容器的内存总量，**必须小于物理内存**，预留系统与内核 |
| `yarn.nodemanager.resource.cpu-vcores` | 8 | 单节点可分配核数，一般 = 物理核数（超售有风险） |
| `yarn.scheduler.maximum-allocation-mb` | 8192 | 单个容器内存上限，限制大作业的"一口吃太多"，也防止死配置 |
| `yarn.scheduler.maximum-allocation-vcores` | 32 | 单个容器核数上限 |
| `yarn.scheduler.minimum-allocation-mb` | 1024 | 单个容器内存下限（资源粒度） |
| `yarn.nodemanager.pmem-check-enabled` | true | 物理内存超限检查，误杀大容器时考虑关闭或调大容器 |
| `yarn.nodemanager.vmem-check-enabled` | true | 虚拟内存检查，Spark/Flink 大作业常被它误杀 |
| `yarn.resourcemanager.am.max-attempts` | 2 | ApplicationMaster 重试次数，作业失败自动拉起 |

:::note
**内存预算公式**：可分配内存 = 物理内存 - 系统预留。经验值：16G 机器预留 3~4G，256G 机器预留 20~30G（给操作系统页缓存、Agent、JVM 元空间），512G 机器预留 40~50G。
:::


## 三档规格推荐参数

| 参数 | 8C16G | 32C256G | 64C512G |
| ---- | ---- | ---- | ---- |
| `yarn.nodemanager.resource.memory-mb` | 12G（预留 4G） | 220G（预留 36G） | 460G（预留 52G） |
| `yarn.nodemanager.resource.cpu-vcores` | 6 | 28 | 58 |
| `yarn.scheduler.maximum-allocation-mb` | 8G | 64G | 128G |
| `yarn.scheduler.maximum-allocation-vcores` | 6 | 24 | 48 |
| `yarn.scheduler.minimum-allocation-mb` | 512M | 1G | 2G |
| `yarn.nodemanager.pmem-check-enabled` | true | true（大容器作业多时关） | 关 |
| ResourceManager 堆（YARN_RESOURCEMANAGER_OPTS） | 4G | 16G | 32G |

:::note
被 `pmem-check-enabled` 误杀是 YARN 最经典的问题：检查逻辑按容器申请值限定"软限制"，容器实际内存超出就被 NodeManager 杀掉。Hive/Spark 大作业集群普遍直接关闭物理内存与虚拟内存检查，靠 `yarn.nodemanager.resource.memory-mb` 总量兜底，换取稳定性。
:::


## 队列规划（几十~上百节点）

| 队列 | 容量 | 适用 |
| ---- | ---- | ---- |
| root.default | 20% | 临时作业、测试 |
| root.offline | 50% | 跑批作业（离线数仓） |
| root.realtime | 30% | 实时计算（Flink）、交互查询 |

Capacity Scheduler 关键参数（`capacity-scheduler.xml`）：

```xml
<property>
  <name>yarn.scheduler.capacity.root.queues</name>
  <value>default,offline,realtime</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.offline.capacity</name>
  <value>50</value>
</property>
<property>
  <name>yarn.scheduler.capacity.root.realtime.maximum-capacity</name>
  <value>80</value>
</property>
```

:::warning
队列规划的原则：**核心业务队列有保底容量（capacity）+ 弹性上限（maximum-capacity）**。实时队列弹性上限设 80%，避免离线跑批把资源吃光后 Flink 作业饿死；`capacity` 之和必须等于 100。
:::


- **百节点资源分区**：计算密集节点（高核）与内存密集节点（高内存）用分区（partition）隔离，调度时按分区投放作业
- **NodeManager 多本地目录**：`yarn.nodemanager.local-dirs` 多盘，容器临时数据分散 IO；`yarn.nodemanager.log-dirs` 同
- **磁盘健康检查**：`yarn.nodemanager.disk-health-checker.enabled=true`（默认开），坏盘节点自动变为 unhealthy 不接新容器
- **资源抢占**：`yarn.resourcemanager.scheduler.monitor.enable` + ProportionalCapacityPreemptionPolicy，保障队列容量

## 容灾与备份

- **ResourceManager HA**：双 RM + Zookeeper，秒级切换；切换时运行中作业的 AM 会重试（`yarn.resourcemanager.am.max-attempts` 调 3~5）
- **作业日志聚合**：`yarn.log-aggregation-enable=true`，作业日志汇总到 HDFS，节点销毁后仍可查
- **ApplicationMaster 重试**：`yarn.resourcemanager.am.max-attempts`，配合调度器避免单点故障导致作业丢失
- **队列配置备份**：`capacity-scheduler.xml` 纳入版本管理，变更前 `yarn rmadmin -refreshQueues` 验证

## 调优常见问题

- **作业一直 ACCEPTED**：队列容量被占满或 `maximum-allocation` 小于作业申请；`yarn application -list` 看待运行队列，`yarn queue -status` 看容量
- **容器被 NodeManager 杀**：看节点日志的 `KillContainer` 原因——内存超限（关闭检查或调容器）、磁盘超限（`yarn.nodemanager.disk-health-checker.max-disk-utilization-per-disk-percentage`）
- **单节点资源上不去**：检查 NM 上报内存是否等于 `yarn.nodemanager.resource.memory-mb`（改了配置要重启 NM），以及是否被 `yarn-site.xml` 的别名旧参数覆盖
- **大作业独占集群**：容量调度器默认没有超卖限制，给大作业所在队列设 `maximum-capacity` 上限

## 调优检查清单

1. 每节点内存/核数预算正确（预留系统）
2. 队列容量规划并启用弹性上限
3. 大作业集群关闭 pmem/vmem 检查
4. RM HA + 日志聚合 + AM 重试
5. NodeManager 多盘 local-dirs，坏盘自动隔离
6. 集群资源水位、队列使用率纳入监控
