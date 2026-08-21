---
title: "Tez 部署与调优指南"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "tez", "部署"]
category: "bigdata"
---

> Tez 是 Hive 的 DAG 执行引擎，把多轮 MapReduce 的"写盘-重读"改成一张 DAG 内存流转，SQL 性能提升 2~3 倍是常态。它不独立部署（寄生于 YARN），部署动作是"把 Tez 库放到 HDFS + 让 Hive 引擎指向它"。本文覆盖底层原理（衔接《Tez 底层原理与知识要点》）、部署、参数优化与常见问题。

## 底层原理速览

- **DAG**：一次提交整个执行计划图，顶点（Vertex）是逻辑阶段，边（Edge）描述数据流转
- **三种 Edge**：OneToOne（窄依赖）、Broadcast（小表广播）、ScatterGather（shuffle）
- **Session 复用**：Tez 会话常驻 AM 与容器，多个作业复用，省去 JVM 反复启动
- **容器复用**：一个容器内连续跑多个任务，任务启动开销趋近于零

:::note
Tez 的性能来源三句话：**中间结果不落 HDFS、一次调度多阶段、容器 JVM 复用**。与 MR 对比，复杂 SQL 的磁盘读写从"每阶段一次"降到"只读输入只写输出"。
:::


## 部署

### 1. 准备 Tez 包并上传 HDFS

```bash
# 下载与 Hadoop 版本匹配的 tez（如 tez-0.10.2 配 Hadoop 3.3）
wget https://dlcdn.apache.org/tez/0.10.2/apache-tez-0.10.2-bin.tar.gz
tar -zxvf apache-tez-0.10.2-bin.tar.gz -C /opt
ln -s /opt/apache-tez-0.10.2 /opt/tez

# 把 tez 库上传到 HDFS（所有节点通过 tez.lib.uris 引用）
hdfs dfs -mkdir -p /apps/tez
hdfs dfs -put /opt/tez/share/tez.tar.gz /apps/tez/
```

### 2. 配置 tez-site.xml（$TEZ_HOME/conf）

```xml
<configuration>
  <!-- 指向 HDFS 上的 tez 库 -->
  <property>
    <name>tez.lib.uris</name>
    <value>hdfs://node1:8020/apps/tez/tez.tar.gz</value>
  </property>
  <!-- AM 与容器内存 -->
  <property>
    <name>tez.am.resource.memory.mb</name>
    <value>2048</value>
  </property>
  <property>
    <name>tez.container.size</name>
    <value>4096</value>
  </property>
  <!-- Session 复用：作业间复用 AM，减少启动开销 -->
  <property>
    <name>tez.session.client.timeout</name>
    <value>300</value>
  </property>
</configuration>
```

### 3. Hive 切换引擎

```bash
# 环境变量（所有跑 Hive 的节点）
export TEZ_HOME=/opt/tez
export TEZ_JARS=/opt/tez/share/tez.tar.gz
export HADOOP_CLASSPATH=$HADOOP_CLASSPATH:/opt/tez/share/tez.tar.gz

# 会话级或 hive-site.xml 配置
set hive.execution.engine=tez;
```

## 参数优化（三档规格）

| 参数 | 8C16G（每节点） | 32C256G（每节点） | 64C512G（每节点） |
| ---- | ---- | ---- | ---- |
| `tez.am.resource.memory.mb` | 1G | 2G | 4G |
| `tez.am.java.opts`（AM 堆） | 768M | 1.5G | 3G |
| `tez.container.size` | 2G | 4G | 8G |
| `tez.task.max.memory.mb` | 1.5G | 3G | 6G |
| `tez.task.scale.memory.additional-resource.fraction` | 0.3 | 0.3 | 0.3 |
| `tez.session.client.timeout` | 120 | 300 | 600 |
| `tez.runtime.sort.threads` | 2 | 4 | 8 |

:::warning
`tez.container.size` 必须与 Hive 的 `hive.tez.container.size` 一致（Hive 侧是配置入口），且容器总量不能超过 YARN 的 `yarn.scheduler.maximum-allocation-mb`。容器申请超过上限会被 YARN 拒绝，作业直接失败。
:::


**优化理解**：

- **容器内存 = 数据排序的池子**：Tez 的 shuffle 在容器内排序，`tez.container.size` 越大，单任务能处理的数据量越大，溢写（spill）越少；但容器大 → 并发任务少，需要按数据量平衡
- **Session 超时**：`tez.session.client.timeout` 是会话闲置回收时间；调大让跑批作业间的复用率提高（省 AM 启动），但占用 YARN 资源不释放，按作业密度取舍
- **AM 内存**：`tez.am.resource.memory.mb` 只影响 AM 本身，占资源小，2~4G 足够，不用跟着规格涨

## 集群规模优化（几十~上百节点）

- **容器复用是收益主力**：批作业密集时段让 Session 常驻（timeout 调大），削峰时段回收；配合 YARN 队列隔离
- **与 YARN 资源联动**：`tez.container.size` 别超过节点可用内存 ÷ 期望并发任务数；优先保证单节点 2~4 个 Tez 容器并发
- **本地模式**：小任务自动降级 `tez.local.mode=true`（本地文件系统跑），不占 YARN 资源，适合测试与临时查询
- **数据倾斜**：`tez.groupby.split.grouping.enabled` + 二阶段聚合兜底；与 Hive 的 `hive.groupby.skewindata` 配合
- **RPC 与元数据**：`tez.am.am-rm.heartbeat.interval-ms`（默认 1s）在百节点集群可放宽到 5s，减少心跳流量

## 常见问题

- **`ClassNotFoundException: org.apache.tez.dag...`**：`tez.lib.uris` 指向的 HDFS 路径不存在或权限不足，或节点没配 `HADOOP_CLASSPATH`
- **作业卡在 INITIALIZING**：AM 无法获取容器——`tez.am.resource.memory.mb` 超 YARN 上限，或 Session 被回收后客户端仍在等旧会话
- **Container OOM**：`tez.container.size` 与 `hive.tez.container.size` 不一致（Hive 侧默认 512M 覆盖）、或排序数据量超过容器
- **Session 僵死**：`tez.session.client.timeout` 太小导致频繁建 Session，作业排队；调大或确认 AM 被 YARN 回收后客户端重连逻辑
- **本地模式误开**：`tez.local.mode` 开了但本地磁盘不足，任务失败；确认本地目录空间
- **与 Spark 引擎切换后参数残留**：`hive.execution.engine` 切换时，两边引擎参数（tez.*/spark.*）互相残留影响，切换后验证首条 SQL

## 部署检查清单

1. tez.tar.gz 在 HDFS 且 `tez.lib.uris` 正确
2. `hive.tez.container.size` 与 YARN 上限匹配
3. Session 超时与作业密度匹配
4. 与 08-09 原理文章联动：Edge 类型决定 shuffle 成本，优化 SQL 时先看执行计划（`EXPLAIN`）
