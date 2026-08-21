---
title: "MySQL 生产调优实践"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "mysql", "调优"]
category: "middleware"
---

> MySQL 调优的优先级永远是：**慢查询 → 索引 → 参数**。参数调优是最后一步——一个被慢查询拖垮的库，innodb_buffer_pool_size 调得再大也救不了。本文先给参数理解与规格表，再强调集群规模的读写分离与容灾。部署安装见《大数据与中间件组件部署总览》。

## 核心参数与调优理解

| 参数 | 默认值 | 调优理解 |
| ---- | ---- | ---- |
| `innodb_buffer_pool_size` | 128M | InnoDB 缓存池，**最重要参数**：建议物理内存的 60~75%，热点数据命中内存才能快 |
| `innodb_buffer_pool_instances` | 8 | 缓冲池分片数，大内存下减少锁竞争（每片 ≥1G） |
| `innodb_log_file_size` | 48M | Redo 日志大小，**建议 1~4G**：太小导致频繁刷盘 checkpoint，写入抖动 |
| `innodb_flush_log_at_trx_commit` | 1 | 1=每次提交刷盘（最安全）、2=每秒刷盘（性能与安全折中） |
| `innodb_flush_method` | fsync | Linux 上 `O_DIRECT` 绕过页缓存，避免双缓存，数据盘直接读写 |
| `innodb_io_capacity` | 200 | 刷盘 IO 上限，SSD 调 1000~2000，NVMe 可更高 |
| `max_connections` | 151 | 连接上限，同时盯 `max_connections` 与 `thread_cache_size` |
| `sync_binlog` | 1 | 每次事务刷 binlog，配合 `innodb_flush_log_at_trx_commit=1` 双 1 最安全 |
| `slow_query_log` | OFF | 开启慢查询日志 + `long_query_time=1`，调优的起点 |

:::note
**双 1 与性能的权衡**：`sync_binlog=1 + innodb_flush_log_at_trx_commit=1` 保证崩溃不丢任何已提交事务，但每次提交两次刷盘。对事务一致性要求极高的金融/支付场景必须双 1；普通业务可用 `innodb_flush_log_at_trx_commit=2`（每秒刷盘）换取数倍写入性能。
:::


## 三档规格推荐参数

| 参数 | 8C16G | 32C256G | 64C512G |
| ---- | ---- | ---- | ---- |
| `innodb_buffer_pool_size` | 10G（62%） | 180G（70%） | 380G（74%） |
| `innodb_buffer_pool_instances` | 8 | 16 | 32 |
| `innodb_log_file_size` | 1G | 2G | 4G |
| `innodb_log_buffer_size` | 16M | 32M | 64M |
| `innodb_flush_method` | O_DIRECT | O_DIRECT | O_DIRECT |
| `innodb_io_capacity` | 1000 | 2000 | 4000 |
| `max_connections` | 300 | 1000 | 2000 |
| `sort_buffer_size` | 2M | 4M | 4M |
| `join_buffer_size` | 2M | 4M | 8M |

:::warning
`sort_buffer_size` / `join_buffer_size` 是**会话级**内存，按连接数放大计算：1000 连接 × 8M = 8G。这类参数给大了不如不给——连接一多内存直接打爆。大内存优先喂 `buffer_pool`，会话缓冲保持小值。
:::


## 集群规模优化（几十~上百节点）

- **读写分离**：一主多从（3~5 从），读流量水平扩展；从库 `read_only=ON`，业务层/中间件（ProxySQL、ShardingSphere）路由
- **主从复制优化**：
  - 并行复制：`replica_parallel_workers=8`（8.0）减少从库延迟
  - `binlog_transaction_dependency_tracking=WRITESET` 提升并行度
  - 大事务拆小（单事务 < 5 万行），否则从库追不上
- **分库分表**：单表过千万/库容量过 T 级时规划分片（ShardingSphere/MyCat）；分片键按业务维度设计，避免跨片查询
- **连接治理**：连接池（HikariCP/Druid）设置合理上限，防止雪崩时连接风暴打垮 DB；`max_connections` 与 `wait_timeout` 联动
- **慢查询治理**：慢日志 → 索引/改写循环；`pt-query-digest` 定期分析 TOP SQL
- **参数与版本管理**：my.cnf 纳入版本库，变更走发布流程，`SET GLOBAL` 只做临时变更

## 容灾与备份

| 层级 | 手段 | 说明 |
| ---- | ---- | ---- |
| 高可用 | 主从 + 自动切换 | MHA / Orchestrator / 云 RDS 机制，秒级切换 |
| 数据 | 全量 + binlog 增量 | xtrabackup 每日全量 + binlog 定期归档（如 10 分钟），可恢复到任意时点 |
| 跨机房 | 异地从库 | 异步复制或半同步，灾备切换入口 |
| 一致性 | 半同步复制 | `rpl_semi_sync_master_enabled`（主从间），主库确认至少一个从库收到 binlog |

:::caution
备份的验证比备份本身重要：**每周做一次"备份恢复演练"**——用最新备份在测试环境恢复并跑核心查询。生产上"备份了三年、从未恢复过"最后恢复失败的事故并不少见。
:::


## 调优常见问题

- **CPU 100% 但连接不多**：慢查询 + 全表扫描，看 `SHOW PROCESSLIST` 定位，优化索引而非加机器
- **主从延迟持续增长**：大事务、从库配置低于主库、并行复制未开；`SHOW REPLICA STATUS` 看 `Seconds_Behind_Source`
- **`Too many connections`**：连接池泄漏或突发流量，先查 processlist 的 Sleep 连接，再定 max_connections
- **磁盘 IO 100% 但内存空闲**：`buffer_pool` 命中率低（`SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%'`）或 redo 太小频繁刷盘
- **`Deadlock found when trying to get lock`**：业务侧事务顺序不一致，统一加锁顺序 + 缩短事务

## 调优检查清单

1. buffer_pool 60~75% 内存，redo 1~4G
2. 双 1 或 2（按一致性要求），O_DIRECT
3. 慢查询日志开启 + 定期治理
4. 主从 + 并行复制 + 半同步
5. 备份全量+增量，周演练恢复
6. 连接池上限与 max_connections 匹配
