---
title: "Redis 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "redis"]
category: "middleware"
---

> 本文总结 Redis 的核心底层原理：数据结构实现、单线程模型、持久化机制、过期与淘汰策略、缓存三大问题、高可用方案以及常见问题排查要点，作为个人技术笔记。

## 五种基础数据结构与底层实现

### string：SDS

string 底层是 **SDS（Simple Dynamic String）**，而非 C 字符串：

- 带长度字段，获取长度 O(1)
- 预分配空间 + 惰性释放，减少内存重分配次数
- 二进制安全，可存任意二进制数据
- 3.2+ 分 `sdshdr5/8/16/32/64` 按长度分级，节省内存

### list：双向链表与 quicklist

- 3.2 之前：元素少且小时用 **ziplist（压缩列表）**，否则用双向链表
- 3.2+ 统一为 **quicklist**：以 ziplist 为节点组成的双向链表，兼顾内存紧凑与读写效率
- 7.0 之后引入 **listpack** 逐步替代 ziplist（解决连锁更新问题）

:::note
quicklist 本质上就是"链表 + 压缩块"，通过 `list-max-ziplist-size` 控制每个节点的大小。
:::


### hash：哈希表与 ziplist

- 元素少且小时：ziplist
- 元素多时：**hashtable**，rehash 采用**渐进式 rehash**（分多次搬迁，避免一次性阻塞）

### set：整数集合与哈希表

- 全部为整数且数量少时：**intset（整数集合）**，有序紧凑存储，查找二分
- 否则：hashtable（值为 null）

### zset：跳表 + 哈希表

zset 底层是**跳表（skiplist） + 哈希表**的组合：

- 哈希表存 member -> score，O(1) 取分数
- 跳表按 score 排序，支持范围查询、排名（zrange/zrank）O(logN)
- 元素少时也用 ziplist/listpack 压缩存储

:::tip
跳表相比平衡树实现简单、区间遍历友好，Redis 作者因此选跳表实现有序集合。
:::


## 单线程模型与 IO 多路复用

### 为什么单线程还快

- 基于内存操作，瓶颈不在 CPU
- 核心是 **IO 多路复用（epoll）**：单线程注册多个 socket 事件，有事件才处理，无事件阻塞，避免线程切换与锁竞争
- 数据结构高效，命令执行本身微秒级

事件循环流程：

```text
epoll_wait 等待事件 → 读取命令 → 执行命令（单线程） → 写回响应
```

### Redis 6.0 多线程

- 6.0 引入**多线程 IO**：网络读写（accept/read/write）由多个线程并行处理，命令执行仍是单线程
- 解决的是大流量下网络 IO 成为瓶颈的问题，而非 CPU 计算瓶颈
- 默认关闭，通过 `io-threads` 开启（建议 4 核以下不开启）

:::caution
Redis 单线程意味着一个慢命令会阻塞所有客户端，生产环境禁止大 key 操作、`keys *`、`hgetall` 大 hash、`lrange` 大 list。
:::


## 持久化

### RDB 快照

- 全量快照：`save`（同步阻塞）/ `bgsave`（fork 子进程后台生成 dump.rdb）
- 触发条件：`save 900 1 300 10 60 10000` 等配置，或 `shutdown`、主从全量同步
- 优点：文件紧凑、加载快、适合备份；缺点：两次快照之间数据会丢

### AOF 日志

- 追加写命令，三种写回策略（appendfsync）：

| 策略 | 说明 | 数据安全性 |
| --- | --- | --- |
| always | 每次写命令 fsync 磁盘 | 最安全，性能最差 |
| everysec | 每秒 fsync（默认） | 最多丢 1 秒数据 |
| no | 交给操作系统刷盘 | 可能丢较多数据 |

- AOF 文件膨胀后触发 `bgrewriteaof` 重写压缩

### 混合持久化（4.0+）

- `aof-use-rdb-preamble yes`：AOF 重写时先写 RDB 格式的全量数据，再追加增量命令
- 优点：加载快（RDB 部分直接加载）+ 丢失数据少

### fork 与 copy-on-write

`bgsave`/`bgrewriteaof` 都依赖 **fork + COW**：

- fork 创建子进程，子进程共享父进程内存页表
- 主进程继续写时触发写时复制，被修改的页复制一份
- 内存越大、写越频繁，fork 耗时与 COW 内存开销越大

:::warning
内存过大（如超过物理内存一半）时 bgsave 可能因 COW 触发 OOM；fork 耗时在 1ms 以上需要关注。
:::


## 过期删除与内存淘汰

### 过期删除策略

- **惰性删除**：访问 key 时才检查是否过期，过期则删。节省 CPU，但过期 key 堆积占内存
- **定期删除**：每秒采样删除部分过期 key（默认 10 次/秒，每次取 20 个样本）
- 两者配合使用，平衡 CPU 与内存

### 内存淘汰策略（8 种）

达到 `maxmemory` 时触发，8 种策略：

```text
noeviction        不淘汰，写报错（默认）
allkeys-lru       所有 key 按 LRU 淘汰
volatile-lru      只淘汰设置了过期时间的 LRU
allkeys-random    所有 key 随机淘汰
volatile-random   过期 key 随机淘汰
volatile-ttl      过期 key 中 TTL 最短的优先淘汰
allkeys-lfu       所有 key 按 LFU 淘汰（4.0+）
volatile-lfu      过期 key 按 LFU 淘汰（4.0+）
```

:::tip
缓存场景建议 `allkeys-lru`；需要区分热点与非热点的用 `allkeys-lfu`；不能丢数据的业务绝不依赖淘汰兜底。
:::


## 缓存三大问题与解决方案

### 缓存穿透

**现象**：查询一个不存在的 key，缓存无数据，每次打到 DB。

解决方案：

- 缓存空值（key 不存在也缓存空串 + 短过期时间）
- 布隆过滤器（Bloom Filter）：前置拦截不存在的 key
- 接口层参数校验（如 id 非法的直接拒绝）

### 缓存击穿

**现象**：某个**热点 key 过期**的瞬间，大量请求同时打到 DB。

解决方案：

- 互斥锁（分布式锁）：重建缓存的请求加锁，其余等待
- 逻辑过期：key 永不过期，后台线程异步刷新
- 热点 key 过期时间加随机值错开

### 缓存雪崩

**现象**：大量 key 同一时间过期，或 Redis 宕机，DB 被打垮。

解决方案：

- 过期时间加随机抖动：`setex key random(60~120s)`
- 多级缓存（本地缓存 Caffeine + Redis）
- Redis 高可用（哨兵/集群）+ 限流降级兜底

:::warning
缓存击穿是"单个热点 key"，雪崩是"大面积 key 同时失效"，定位时要区分清楚。
:::


## 高可用架构

### 主从复制

- 全量同步：从节点发 `psync ? -1`，主节点 bgsave 生成 RDB 传给从节点，期间写入记录在 repl backlog 中，同步完成后补发增量
- 增量同步：断线重连后基于偏移量从 backlog 增量同步
- 从节点默认只读，`slaveof` 指定主从关系

### 哨兵 Sentinel

- 作用：监控主从节点、自动故障转移、通知客户端
- 判定：主观下线（单个哨兵超时）→ 客观下线（多数哨兵确认）→ 选举新主（从节点优先级、复制偏移量、run_id）
- 哨兵自身集群部署，至少 3 个实例

### 集群 Cluster

- **16384 个槽位**，key 通过 `CRC16(key) % 16384` 决定归属节点
- 客户端访问错节点时返回 **MOVED 重定向**（槽位迁移中返回 ASK），客户端需处理重定向
- 数据分片 + 主从副本，`cluster meet` 组建集群
- 槽位迁移、多 key 操作（mget）跨槽不支持

### Redis 分布式锁

```bash
SET lock_key token NX PX 30000   # 加锁：原子设置，带过期时间
DEL lock_key                     # 解锁：需校验 token（Lua 脚本保证原子）
```

- 红锁（RedLock）：多节点加锁，过半成功才算成功，用于强一致场景
- **Redisson 看门狗**：默认 30s 锁超时，后台定时续期（默认每 10s 续一次），业务未完成时防止锁被自动释放；宕机时看门狗停更，锁自然过期释放

:::note
Redis 分布式锁适合大多数业务，但要清楚它基于 AP 架构；对一致性要求极高的场景考虑 ZooKeeper 锁。
:::


## 常规问题排查

### 内存暴涨

- `redis-cli --bigkeys` 扫描大 key（大 hash/zset/string）
- `memory usage key` 查看单个 key 内存
- `info memory` 查看 used_memory、fragmentation 等指标
- 常见原因：无过期时间的 key 堆积、大 value、list 无限追加（消息堆积）、内存碎片（`activedefrag yes`）

### 慢查询

- `slowlog get 10` 查看慢命令
- `slowlog-log-slower-than` 阈值配置（默认 10000 微秒）
- 定位后优化：拆小 key、避免 O(N) 命令（`hgetall`/`lrange` 大范围）、`keys` 换 `scan`

### CPU 高 / Hot Key

- `hotkeys` 参数开启后 `redis-cli --hotkeys` 检测（4.0+）
- 缓解：本地缓存热 key、读写分离（从节点分担读）、key 打散（`key#1`~`key#N` 分片到不同节点）
- 注意：高频小 key 的 CPU 消耗主要在协议解析与内存分配，可评估 `io-threads`

### 数据不一致（双写一致性）

常见方案：

- **Cache Aside**：先更新 DB，再删缓存；删缓存失败用重试/订阅 binlog（Canal）+ MQ 补偿
- 保证最终一致：更新 DB 成功 → 延迟双删（先删缓存，延迟 500ms 再删一次）
- 强一致场景：读写都走 DB 或分布式事务，缓存只做加速

:::caution
"先删缓存再更新 DB"在并发读下极易产生脏数据，生产应统一"先更 DB 再删缓存"。
:::


### 持久化阻塞与延迟抖动

- 大实例 bgsave fork 阻塞主线程：控制单实例内存（建议 10GB 内），或换用物理机大内存 + `fork` 前避免大写入
- AOF `always` 策略磁盘慢导致抖动：评估改 `everysec`
- 触发场景排查：`info stats` 看 `latest_fork_usec`，检查是否有频繁 bgsave（如主从全量重连）
- 内存碎片导致延迟：`info memory` 看 `mem_fragmentation_ratio > 1.5` 时开启 `activedefrag`
- 网络抖动：客户端连接池 + 合理的超时重试策略

## 小结

- 底层数据结构都是"小数据压缩、大数据换结构"的策略（ziplist/quicklist/intset → 跳表/哈希表）
- 单线程 + epoll 是高吞吐的根基，任何 O(N) 操作都是性能雷区
- 持久化、过期淘汰、缓存问题、高可用本质都是对"内存、磁盘、网络"三者的权衡
- 排查问题的核心抓手：`info`、`slowlog`、`--bigkeys/--hotkeys`、`memory usage`
