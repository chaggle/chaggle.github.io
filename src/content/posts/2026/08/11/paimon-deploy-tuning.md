---
title: "Paimon 原理、部署与调优指南"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "paimon", "湖仓", "flink", "部署"]
category: "bigdata"
---

> Paimon（原 Flink Table Store，Apache 孵化项目）是"流式数据湖仓"：在湖格式上叠加 LSM 结构与 Changelog，让 **Flink 能对湖表做流读流写**，主键表支持 CDC 同步与行级更新。本文覆盖原理（LSM/Bucket/Changelog）、集成部署（Flink/Spark）、参数优化与常见问题。

## 底层原理速览

- **表类型**：主键表（Primary Key，支持行级更新/删除）与 Append-Only 表（纯追加，日志型场景）
- **LSM 结构**：写入先进内存缓冲（MemTable），落盘成 Sorted Run（有序数据文件），查询时多路归并——与 HBase/RocksDB 同款思路，换来了**随机写变顺序写**
- **Bucket（分桶）**：主键哈希分桶，桶是写入与并发的最小单元，桶内有序；**桶数建表后不可改**
- **Changelog**：主键表每次变更产生增删改记录，落在 changelog 文件里 → 下游可做**增量流读**（实时数仓"湖上实时"的关键）
- **Compaction**：后台把多个 Sorted Run 合并（减少读放大）；full-compaction 生成完整 changelog
- **Lookup**：主键点查走索引文件，Flink Join 湖表时按需拉取，替代"全表缓存"
- **与 Iceberg 对比**：Iceberg 是"批写批读 + ACID"，Paimon 是"流写流读 + LSM"，Paimon 更贴 Flink 生态，Iceberg 更贴 Spark 生态

:::note
Paimon 一句话定位：**把 Flink 的状态和 Changelog 落成"可读可查的湖表"**。以前 Flink 实时数仓的明细要写 Kafka + 再同步到 Hive/OLAP，现在直接写 Paimon，下游 Spark/Doris/Trino 都能读，还能继续流读。
:::


## 部署（集成式，强依赖 Flink）

### 1. 集成 Flink

```bash
# 拷贝 paimon-flink（带连接器版本）到 $FLINK_HOME/lib
cp paimon-flink-1.18-0.8.x.jar $FLINK_HOME/lib/
```

```sql
-- Flink SQL 注册 Catalog
CREATE CATALOG paimon WITH (
  'type' = 'paimon',
  'warehouse' = 'hdfs:///paimon',
  'metastore' = 'filesystem'          -- 或 hive（借用 HMS）
  -- ,'uri' = 'thrift://node1:9083'   -- metastore=hive 时配置
);
USE CATALOG paimon;
```

```sql
-- 建主键表（流写流读的核心形态）
CREATE TABLE dwd_orders (
  order_id BIGINT PRIMARY KEY NOT ENFORCED,
  user_id  BIGINT,
  amount   DECIMAL(20,2),
  status   STRING,
  ts       TIMESTAMP(3),
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'bucket' = '32',
  'changelog-producer' = 'input',
  'merge-engine' = 'deduplicate'
);

-- 流式写入（来自 Kafka 的 CDC/实时流）
CREATE TEMPORARY TABLE kafka_orders (...) WITH ('connector'='kafka', ...);
INSERT INTO dwd_orders SELECT * FROM kafka_orders;

-- 流式读取（增量读 changelog，下游可做实时数仓）
SELECT * FROM dwd_orders /*+ OPTIONS('scan.mode'='latest') */;
```

### 2. 集成 Spark / 查询端

```bash
# Spark 3.x 读取 Paimon 表
spark-sql \
  --packages org.apache.paimon:paimon-spark-3.5:0.8.x \
  --conf spark.sql.catalog.paimon=org.apache.paimon.spark.SparkCatalog \
  --conf spark.sql.catalog.paimon.warehouse=hdfs:///paimon
```

```sql
SELECT user_id, SUM(amount) FROM paimon.dwd.dwd_orders
GROUP BY user_id;   -- Spark 离线读同一张流表
```

### 3. MySQL CDC 同步（实时数仓标配链路）

```sql
-- 用 Flink CDC 把 MySQL 实时同步成 Paimon 主键表
CREATE TEMPORARY TABLE mysql_orders (
  order_id BIGINT PRIMARY KEY NOT ENFORCED, ...
) WITH ('connector'='mysql-cdc', 'hostname'='...', 'database-name'='shop', 'table-name'='orders');

CREATE TABLE paimon.dwd.orders (...) WITH ('bucket'='32');
INSERT INTO paimon.dwd.orders SELECT * FROM mysql_orders;
```

## 调优

### 1. Bucket 与并发

| 参数 | 建议 | 说明 |
| ---- | ---- | ---- |
| `bucket` | 写入并行度一致（或整数倍） | **建表后不可改**，前期定错要重建表 |
| sink 并行度 | = bucket 数 | 每个写入子任务对应若干桶，避免重分布 |
| `bucket-key` | 主键子集 | 打散热点，如 user_id%N |

### 2. 写入

- `write-buffer-size`（默认 64MB）：单任务内存缓冲，调大减少小文件但吃内存（注意并行度乘积）
- `sink.parallelism` 与 bucket 匹配；`commit.force-compact` 可开启提交前强制 compact（写读隔离但延迟高，慎用）
- `write-only=true`：只写不 compaction（导入大任务场景，事后统一 compact）

### 3. Compaction

- `num-sorted-runs.compaction-trigger`（默认 5）：达到阈值触发 compaction，调大可减少触发频率
- `compaction.max.file-num` / `full-compaction.delta-commits`（如 10）：定期 full compaction 生成完整 changelog（供快照读）
- 大表建议独立 compaction 作业池（`compaction.parallelism`），避免与写入抢资源

### 4. 读取

- 流读：`scan.mode=latest`（实时）/ `from-timestamp`（追增量）；`read.changelog-producer=lookup` 时点查代价高，尽量 input 模式
- 批读（Spark）：谓词下推 + 分区裁剪自动生效；大表先 `ANALYZE` 相关统计
- 点查 Lookup：`lookup.cache` 开启（如 10000 条/10 分钟），Flink Join 湖表时命中缓存

### 5. 快照与文件

- `snapshot.num-retained.min`（默认 10）/max：控制快照保留，影响流读回溯窗口
- 小文件治理：`write-buffer-size` 调大 + compaction 周期内聚；`paimon gc` 逻辑同 Iceberg（孤儿文件清理）

## 常见问题

| 现象 | 原因 | 处理 |
| ---- | ---- | ---- |
| 桶数想改 | bucket 建表后固定 | 评估重建表 + 数据回灌，或早期按峰值并行度定 |
| 流读延迟高 | changelog-producer 配置弱 | 用 input/full-compaction，别用 lookup |
| 小文件多 | 写缓冲太小/并行度与桶不匹配 | 调 write-buffer-size，桶数=并行度 |
| CDC 同步延迟 | 单任务吞吐/检查点间隔 | 调大并行度、检查点间隔 60-120s |
| 读快照数据量大 | 保留快照过多 | 调 snapshot.num-retained，full compaction 后清理 |
| Flink 找不到表 | Catalog/warehouse 配置漂移 | 确认 catalog 类型与 warehouse 路径一致 |

## 总结

- Paimon = Flink 生态的流式湖仓：LSM + Bucket + Changelog，主键表支持 CDC 与行级更新，流读流写
- 部署 = 放 jar + 注册 catalog（filesystem/hive）+ 建主键表；无独立服务，强依赖 Flink
- 调优主线：**bucket 数前期定死**（核心）→ write-buffer-size → compaction 节奏 → changelog-producer 模式 → 快照保留
- 在底座迭代中，Paimon 承接"实时数仓湖化"：Flink 实时链路直接落湖，替代"Kafka + 双写 Hive"的复杂架构；与 Iceberg 分工——实时链路 Paimon，离线/多引擎场景 Iceberg，两套并存是常态
