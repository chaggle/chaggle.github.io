---
title: "MySQL 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "mysql"]
category: "middleware"
---

> 本文是对 MySQL 核心知识的系统性总结，覆盖架构、InnoDB 索引、事务与 MVCC、锁、日志、缓冲池以及日常问题排查要点，作为个人技术笔记使用。

## 整体架构：一条 SQL 是如何执行的

MySQL 的架构可以自上而下分为四层：

- **连接层**：负责客户端连接管理、认证授权、线程复用（thread pool）
- **服务层**：SQL 接口、解析器、优化器、执行器、缓存
- **存储引擎层**：可插拔式，常用 InnoDB、MyISAM
- **文件系统层**：数据文件（.ibd）、日志文件（redo/binlog）、系统表空间

一条 SQL 的完整执行流程：

```text
客户端 → 连接器(建立连接/权限校验) → 查询缓存(8.0 已移除)
       → 解析器(词法/语法分析，生成语法树)
       → 优化器(选择索引、生成执行计划)
       → 执行器(调用存储引擎 API，返回结果)
```

:::note
查询缓存 8.0 已被移除，因为任何写操作都会使其大面积失效，维护成本远大于收益。
:::


各组件职责：

- **连接器**：`mysql -uroot -p` 建立连接，验证用户名密码，连接默认 8 小时空闲自动断开
- **解析器**：词法分析拆分关键字，语法分析校验语法，出错报 `You have an error in your SQL syntax`
- **优化器**：决定用哪个索引、join 顺序，可通过 `explain` 观察优化结果
- **执行器**：判断权限，调用引擎接口逐行读取数据，`rows_examined` 统计扫描行数

## InnoDB 存储引擎与 B+ 树索引

### 为什么是 B+ 树

- 相比哈希索引，B+ 树支持范围查询与排序
- 相比 B 树，B+ 树只有叶子节点存数据，非叶子节点可存放更多索引键，树更矮，IO 次数更少（3~4 层即可支撑千万级数据）
- 叶子节点之间通过链表串联，天然支持范围扫描与排序

### 聚簇索引与二级索引

InnoDB 表数据本身按主键组织，主键索引即聚簇索引：

- **聚簇索引**：叶子节点直接存放整行数据，主键查找一次 IO 即可拿到数据
- **二级索引**：叶子节点存放索引列 + 主键值，查询需要先找主键，再回表查数据
- **回表**：通过二级索引查到主键，再回聚簇索引取整行，多一次 IO
- **索引覆盖**：select 的列都在索引中，无需回表，`explain` 中 `Using index` 即表示覆盖

:::tip
主键建议使用自增整数，因为聚簇索引物理有序，随机字符串主键会导致页分裂与碎片。
:::


### 联合索引与最左前缀

联合索引 `(a, b, c)` 实际上创建了 `a`、`(a,b)`、`(a,b,c)` 三个索引，遵循**最左前缀原则**：

- `where a=1` ✅ 用到索引
- `where a=1 and b=2` ✅ 用到索引
- `where b=2` ❌ 索引失效，因为跳过了最左列
- `where a=1 and c=3` ⚠️ 只用到 a 列，c 列无法用上

排序字段如果符合最左前缀，还能避免 filesort。

### 页结构与行格式

- InnoDB 最小存储单位是**页**，默认 16KB，页内由目录（Page Directory）、用户记录区组成
- 页之间通过链表连接，树的高度即索引层数
- 行格式默认 `DYNAMIC`，变长字段（varchar/text/blob）超长时部分存储在溢出页，页内只存 20 字节指针

```sql
-- 查看行格式
SHOW TABLE STATUS LIKE 't_user';
-- 查看索引
SHOW INDEX FROM t_user;
```

## 事务：ACID 与隔离级别

事务四大特性：

- **原子性 A**：要么全部成功要么全部失败，靠 undo log 回滚
- **一致性 C**：事务前后数据总量不变，由其他三个特性共同保证
- **隔离性 I**：并发事务互不干扰，靠锁与 MVCC
- **持久性 D**：事务提交后不丢失，靠 redo log

隔离级别（由低到高）：

| 级别 | 脏读 | 不可重复读 | 幻读 |
| --- | --- | --- | --- |
| Read Uncommitted | 可能 | 可能 | 可能 |
| Read Committed | 不会 | 可能 | 可能 |
| Repeatable Read | 不会 | 不会 | 可能（InnoDB 通过 next-key lock 解决） |
| Serializable | 不会 | 不会 | 不会 |

:::warning
MySQL 默认隔离级别是 Repeatable Read，通过间隙锁完全解决了幻读问题，与 Oracle 默认 RC 不同。
:::


## MVCC 原理

MVCC（多版本并发控制）用于解决读写冲突，实现"读写不阻塞"。

### 核心组成

- **隐藏字段**：每行有隐藏的 `trx_id`（最近修改该行的事务 id）、`roll_pointer`（指向 undo log 版本链）
- **undo log**：记录事务修改前的数据，多个版本串成一条版本链
- **ReadView**：事务生成快照时记录活跃事务列表，用于判断版本可见性

### ReadView 判断规则

ReadView 包含四个字段：`m_ids`（活跃事务 id 集合）、`min_trx_id`、`max_trx_id`、`creator_trx_id`。判断某版本可见性：

- `trx_id < min_trx_id`：已提交，可见
- `trx_id > max_trx_id`：未开始，不可见
- 在 `m_ids` 中：活跃事务（含未提交），不可见
- 等于 `creator_trx_id`：自己修改的，可见

### 快照读与当前读

- **快照读**：普通 `select`，读 ReadView 生成的快照，不加锁。RC 每次 select 重新生成 ReadView，RR 只在第一次 select 生成
- **当前读**：`select ... for update`、`update`、`delete`、`insert`，读最新数据并加锁

:::note
RR 下为什么能解决幻读：当前读靠 next-key lock 锁住间隙阻止插入，快照读靠 ReadView 一致性快照保证两次读取结果一致。
:::


## 锁机制

按粒度分类：

- **全局锁**：`flush tables with read lock`，锁整个库，用于全库备份
- **表级锁**：`lock tables ... read/write`、元数据锁（DDL 时自动加）、意向锁
- **行级锁**：InnoDB 特有，包括记录锁（Record Lock）、间隙锁（Gap Lock）、临键锁（Next-Key Lock）

:::caution
行锁是加在索引上的！没有索引的 update/delete 会退化为锁全表，生产事故高发点。
:::


- **记录锁**：锁定单行记录
- **间隙锁**：锁定一个区间，只阻止其他事务在间隙内插入，用于解决幻读
- **临键锁**：记录锁 + 间隙锁的组合，左开右闭区间，RR 下默认使用

### 死锁

两个事务互相持有对方需要的锁时发生，InnoDB 会自动检测并回滚代价较小的事务：

```sql
-- 查看最近一次死锁信息
SHOW ENGINE INNODB STATUS;
```

死锁常见解决方案：

- 业务上统一加锁顺序（如都按 id 升序操作）
- 缩短事务时间，减少锁持有
- 在 MySQL 8.0+ 使用 `innodb_deadlock_detect` 控制检测开关

## 三大日志：redo log / binlog / undo log

### redo log（重做日志）

- 物理日志，记录"某页某偏移做了什么修改"，用于**崩溃恢复**，保证持久性
- 采用 WAL（Write-Ahead Logging）：先写日志、再写磁盘数据页
- 环形写入，`innodb_log_file_size` 控制大小，满了触发刷盘 checkpoint

### binlog（归档日志）

- 逻辑日志，记录 SQL 或行变更，用于**主从复制**与**数据恢复**
- 三种格式：`STATEMENT`（记录 SQL）、`ROW`（记录行变更，默认，最安全）、`MIXED`
- 与 redo log 的区别：redo 是 InnoDB 引擎层的物理日志（环形覆盖），binlog 是 Server 层的逻辑日志（追加写）

### 两阶段提交

redo log 与 binlog 要保持一致，否则崩溃恢复或主从复制可能出现数据不一致，因此采用两阶段提交：

```text
prepare 阶段：写 redo log 并置为 prepare 状态
commit 阶段：写 binlog，成功后 redo log 置为 commit 状态
```

:::note
两阶段提交的恢复原则：崩溃后若 redo 处于 prepare 状态，检查 binlog 是否完整，完整则提交、否则回滚，保证两份日志一致。
:::


### undo log（回滚日志）

- 逻辑日志，记录修改前的旧值，用于事务回滚与 MVCC 版本链
- 对应回滚段（rollback segment），purge 线程负责清理不再被任何 ReadView 引用的版本

## Buffer Pool 与 change buffer

- **Buffer Pool**：InnoDB 的内存缓冲，缓存数据页与索引页，默认 128MB（建议机器物理内存 50%~70%）。`innodb_buffer_pool_size` 可动态调整
- 读：优先从缓冲池查，未命中才去磁盘加载
- 写：修改先在缓冲池完成（脏页），由后台线程按 checkpoint 刷盘
- **change buffer**：针对二级索引的变更缓冲，插入/更新二级索引时若目标页不在缓冲池，先记录变更而非直接写磁盘，等页面被读到或后台合并

:::tip
唯一索引的插入无法使用 change buffer（必须先读页判断唯一性），因此"写多读少"的场景优先使用普通索引。
:::


## 常规问题排查

### 慢查询定位

- 开启慢查询日志：

```sql
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;  -- 超过 1 秒记录
```

- 拿到慢 SQL 后执行 `explain`，重点看：

| 字段 | 含义 |
| --- | --- |
| type | all（全表扫描）→ index → range → ref → const，最好到 range 以上 |
| key | 实际使用的索引，为 null 表示没走索引 |
| rows | 预估扫描行数 |
| Extra | `Using filesort`/`Using temporary` 需要优化 |

### 索引失效常见场景

- 对索引列使用函数或计算：`where year(create_time)=2026` ❌
- 隐式类型转换：`where phone = 13800000000`（phone 是 varchar）❌
- 前导模糊查询：`like '%abc'` ❌
- 联合索引不满足最左前缀
- 索引列用 `or` 且另一侧无索引
- 大量数据 `not in` / `is not null` 导致优化器放弃索引

### 死锁与锁等待排查

```sql
SHOW ENGINE INNODB STATUS;  -- 查看死锁/锁等待
SELECT * FROM performance_schema.data_lock_waits;  -- 8.0 查看锁等待
```

### 连接数打满

- 查看连接：`show status like 'Threads_connected';`
- 查看超时：`show variables like 'wait_timeout';`
- 排查长事务：`select * from information_schema.innodb_trx;`
- 应用侧：连接池合理配置、防止慢 SQL 占用连接、及时释放事务

### 主从延迟

常见原因与对策：

- 主库大事务/大 DDL：拆分事务，DDL 用 pt-osc 类工具
- 从库单线程回放：开启并行复制 `slave_parallel_workers`
- 从库硬件差、有分析类大查询：提升配置或分担只读流量
- 查看延迟：`show slave status` 的 `Seconds_Behind_Master`

### 磁盘与内存问题

- 磁盘写满：优先清理 binlog（`purge binary logs`）与慢日志，检查 binlog 保留时间
- 磁盘 IO 高：关注刷盘策略 `innodb_flush_log_at_trx_commit=1` 时每次提交 fsync，可权衡调整为 2
- 内存不足：swap 会拖垮性能，检查 Buffer Pool 是否过大；Buffer Pool 命中率低时增大缓冲池并优化 SQL

:::warning
`innodb_flush_log_at_trx_commit=1` 保证每次提交都刷盘（最安全），改为 0/2 可能丢最近 1 秒日志，生产环境需谨慎权衡。
:::


## 小结

- 架构上理解一条 SQL 从解析、优化到执行的完整链路
- 索引核心是 B+ 树 + 最左前缀 + 覆盖索引，减少回表
- 事务靠 MVCC 与锁实现隔离，redo/binlog 两阶段提交保证一致性与持久性
- 排查问题的核心抓手：慢查询日志、explain、`SHOW ENGINE INNODB STATUS`、`performance_schema`
