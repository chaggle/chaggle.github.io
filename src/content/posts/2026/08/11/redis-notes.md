---
title: "Redis 学习笔记：概念、持久化与底层"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "redis", "middleware"]
category: "middleware"
---

> 2022 年学习 Redis 的两篇笔记（浅谈 Redis 中间件、深入理解 Redis 底层）合并整理。教程来源于 b站狂神说 Java 的 Redis 教程，底层部分配图主要来自极客时间。

## Redis 概念

1、Redis 是基于计算机内存的数据库，一般称为缓存数据库，由于没有固定的表结构与关系，也叫 NoSQL（Not Only SQL）数据库。

2、为什么要使用 Redis：

- 数据的爆发增长
- 没有固定关系的数据

3、最新的版本中，官方不建议直接在 win 上直接使用 Redis，而是使用 WSL2 Linux 子系统进行 Redis 的开发。

4、Redis 常见使用场景：

- 内存缓存
- 不想使用 Kafka 的话，可以作为消息队列而存在
- 做电商的热点数据保存，因为可以设置 TTL
- 朋友圈点赞
- 做秒杀的库存

## Redis benchmark 压力测试

使用官方自带的 redis-benchmark 工具进行压力测试，其中：

- -h：host，可以是本地，也能是远程进行压力测试
- -p：port，即端口号
- -c：connection，连接的数量，基本上连接都是基于 TCP/socket 的
- -n：跟时间复杂度与空间复杂度差不多，即指定每一个连接数的请求次数

```bash
redis-benchmark -h localhost -p 6379 -c 100 -n 10000

# 如果需要保存在一个日志文件中
redis-benchmark -h localhost -p 6379 -c 100 -n 10000 > redis.log
```

## Redis 基本知识

Redis 默认有 16 个数据库，默认是第 0 个数据库。Redis 的命令大小写不敏感，而其中的 key - value 大小写敏感。常见的命令有：

| 命令 | 效果 |
| :--- | :--- |
| select | 切换数据库 |
| dbsize | 查看数据库大小 |
| flushdb | 清空当前数据库所有 K-V 值 |
| flushall | 清空 Redis 数据库中所有 K-V 值 |

Redis 的限制跟 CPU 的性能无关，性能主要受制于硬件的内存与网络带宽。

## Redis 设计目标与底层数据结构

Redis 主要是为了实现**高性能、高可靠、高可扩展性**三个目标。而全面学习 Redis，主要是当 Redis 出现相应的故障问题时，开发人员能快速对问题进行定位与解决：

![](/images/middleware/redis1.png)

Redis 底层数据结构主要采用整数数组和压缩列表，但是在查找时间复杂度方面并没有很大的优势，那为什么 Redis 还会把它们作为底层数据结构呢？这有两个方面的原因：

> 1、从内存利用率出发，数组和压缩列表都是非常紧凑的数据结构，它比链表占用的内存要更少。Redis 是内存数据库，大量数据存到内存中，此时需要做尽可能的优化，提高内存的利用率。
>
> 2、从 CPU 高速缓存出发，Redis 在设计时，集合数据元素较少的情况下，默认采用内存紧凑排列的方式存储，同时利用 CPU 高速缓存不会降低访问速度。当数据元素超过设定阈值后，避免查询时间复杂度太高，转为哈希和跳表数据结构存储，保证查询效率。

## Redis 五大基本类型

### String 类型

String 类型中常见的几种命令：

| 命令 | 效果 |
| :--- | :--- |
| keys * | 查询所有的 key 值 |
| type key | 查看 key 的类型 |
| exist key | 是否存在 key |
| append key value | 向 key 类型添加数据 |
| incr key | key 的 value 原子性 + 1 |
| decr key | key 的 value 原子性 - 1 |
| incrby key [numbers] | key 的 value 原子性 + numbers |
| decrby key [numbers] | key 的 value 原子性 - numbers |
| expire key [second] | 设置 key 的过期时间，默认单位是秒 |
| getrange key start end | 取 key 的 value 从 start 到 end |
| setrange key offset val | 设置 key 的 value 的 offset 位后替换为 val |
| ttl key | 查看 key 剩余过期时间，默认单位是秒 |
| setex key expire value | 设置 key value 以及过期时间 expire |
| setnx key value | 如果 key 不存在，则设置 value，存在则设置失败（分布式锁使用，乐观锁） |
| getset key value | 先得到 key 再设置 key value |

getset 命令有点类似于 CompareAndSwap 这种类型的操作。同理，还有 mset、mget 为批量设置（非原子性），msetnx、msetex 等（原子性操作）。

在 Redis 中，如果要设计一种封装类型的对象，语法可以如下所示：

1、`set user:1 {name:zhangsan, age : 18}`

2、`set user:1:name zhangsan user:1:age 18`

String 常见的使用场景为：计数器、统计多单位的数量、粉丝数、对象缓存存储。

### List 类型

| 命令 | 效果 |
| :--- | :--- |
| lpush [listname] value | 将 value 插入 [listname] 队头 |
| lrange [listname] start end | 查看 [listname] 从队头的 start 到 end |
| lpop [listname] | 将 [listname] 队头的元素移除 |
| lindex [listname] index | 从队头开始索引第 index 个值 |
| rpush [listname] value | 将 value 插入 [listname] 队尾 |
| rpop [listname] | 将 [listname] 队尾的元素移除 |
| llen [listname] | 查看 [listname] 长度 |
| lrem [listname] count value | 移除 [listname] 中 count 个值为 value 的值 |
| ltrim [listname] start end | 截断 [listname] 从 start 到 end |

List 底层实现就是一个双向链表，所以优点跟缺点都跟双向链表一样。

### Set 类型

Set 集合类型，里面的值不重复：

- `sadd [setname] value`：向 [setname] 添加 value
- `spop [setname] value`：从 [setname] 移除 value
- `smembers [setname]`：查看 [setname] 内所有值
- `sismember [setname] value`：判断 value 是否存在 [setname] 中
- `srem [setname] value`：移除 [setname] 中的 value
- `srandmember [setname] count`：随机获取 [setname] 内的一个值
- `smove source destination value`：将 value 从 source 移动到 destination
- `sdiff [setname1] [setname2]`：[setname1] 与 [setname2] 的差集
- `sinter [setname1] [setname2]`：[setname1] 与 [setname2] 的交集
- `sunion [setname1] [setname2]`：[setname1] 与 [setname2] 的并集

Set 为一个无序、不重复集合。

### Hash 类型

其实就是变为 key - map 结构，只是一个 map 集合。

> Hash 类型的命令大同小异，只是在基本操作前加一个 h，如 hget、hset、hgetall、hlen、hexists、hmset 等。其中独有的特性即是：hkeys 与 hvals 是只获取 k 或 v，以及 hincrby、hdecrby、hsetnx、hsetex 等命令。

虽然 Hash 与 String 很相似，但是从特点来看，Hash 更适合存储结构体对象，String 更适合存储字符串类型。

### Zset 类型

有序集合，在 Set 基础之上增加了一个排序维度。常见命令有 zadd、zrange、zrangebyscore xxx -inf +inf（涉及正负无穷的问题）、zcard（记个数）、zrem（删除）、zcount 等。其中没有 ( 与 ) 即是闭区间，有 ( 与 ) 是开区间，比大小的时候经常使用这种方式。

zset 主要存储重要消息、带权重进行判断、排行榜的应用实现 Top N 测试。

> 更多的命令，可以前往 Redis 的官网进行查询。我们使用 Go、Java、Cpp 等语言做开发的时候，Java 用 Jedis、Go 用 go-redis，具体使用看文档即可。

## Redis 三大特殊数据类型

### Geospatial

Geospatial 在 Redis 中即是 geo，在 Redis 3.x 版本就已经推出了，可以推算地理位置信息，比如两地之间的距离、方圆几里的人。geo 的 api 在现在的官网只有 9 个命令：geoadd、geopos、geodist、georadius。其中 geo 的底层实现还是基于 zset，所以 zset 的命令都能操作 geo 数据结构。如果不做地图地理信息的话，基本上项目内不会使用此数据类型。

### HyperLogLog

HyperLogLog 是基数统计的算法，用于网页的 UV 计数。此数据结构占用内存非常小，只占用 $2^{64}$ B，即 12 KB 大小，所以从内存角度，HyperLogLog 是优先选择。使用即是 pfadd、pfcount、pfmerge。

### Bitmaps

位图，跟操作系统里面的一样，Redis 里面可以统计用户信息：活跃、登陆、打开。操作为：setbit、getbit、bitcount。

## Redis 事务

:::caution
在 Redis 中，单条命令保证原子性，而其事务是不保证原子性的！
:::


事务的本质即是：一组命令的集合。事务具有一次性、顺序性、排他性。Redis 中的事务是没有隔离性的概念，没有隔离级别。所有的命令在事务中没有被执行，必须发起执行命令的时候，事务才能执行，即：exec 命令。

Redis 事务执行方式：

- 开启事务（multi）
- 命令入队，返回值均为 queue
- 执行事务（exec）

事务也能放弃，命令即是：discard（即放弃事务队列里的所有命令）。

以下几点异常需要注意：

- 1、编译型异常：代码错误、错误命令，Redis 事务队列不会去执行
- 2、运行时异常：如果事务队列中存在语法性错误，那么执行命令的时候，只放弃命令错误的那几条
- 3、**注意：错误命令与命令错误这两种说法的区别**

## Redis 实现乐观锁

乐观锁：只会在更新数据的时候去判断一下，在此期间是否有修改过数据。所以使用 watch 命令对 key 值进行监视即可。修改失败，用 unwatch 解锁，再 watch key，即可。

## redis.conf 配置文件

Redis 大小写不敏感在配置文件中已经说明了：

```bash
daemonize  yes # 后台守护进程开启，默认为 no

pidfile /var/run/redis_6379.pid # 后台运行的 pid 值

save 900 1 # 快照 900s 内修改一个，就自动保存一次
save 300 10
save 60 10000

config get / set requirepass  # 设置 redis 的安全密码

maxmemory-policy # 内存到达上限的处理政策，一般以下 6 种处理方法
1、volatile-lru : 只对设置了过期时间的 key 进行 lru
2、allkeys-lru
3、volatile-random 随机删除设置了过期时间的 key
4、allkeys-random
5、volatile-ttl 删除即将过期的
6、noeviction 永不过期，返回错误
```

## AOF 与 RDB

在大部分情况下，RDB 是默认的持久化配置，大部分的情况下都够用了。

一般进行数据持久化的保存操作过程一般分为五步：

> (1) 客户端向服务端发送写操作（数据在客户端的内存中）
>
> (2) 数据库服务端接收到写请求的数据（数据在服务端的内存中）
>
> (3) 服务端调用系统调用函数 write，将数据写入磁盘（数据在系统内存的缓冲区中）
>
> (4) 操作系统将缓冲区中的数据转移到磁盘控制器上（数据在磁盘缓存中）
>
> (5) 磁盘控制器将数据写到磁盘的物理介质中（数据真正落到磁盘上）

以上五个步骤为在理想条件下，一个正常的保存流程。但是在大多数情况下，我们的机器等等都会有各种各样的故障，这里划分了两种情况：

> 1、Redis 数据库发生故障，只要在上面的第三步执行完毕，那么就可以持久化保存，剩下的两步由操作系统替我们完成
>
> 2、操作系统发生故障，必须上面 5 步都完成才可保存

### RDB

RDB（Redis DataBase）操作是**在内存中的数据库记录定时 dump 到磁盘上的 RDB 持久化**。这种方式就是将内存中数据以快照的方式写入到二进制文件中，默认的文件名为 dump.rdb：

![RDB](/images/SQL/RDB.jpg)

在执行 RDB 快照备份时候，一般会通过父进程 fork 一个子进程，将数据写到一个临时文件，快照写完后，替换原来的快照文件，子进程就退出，临时文件变成正式的 RDB 文件。

但是 RDB 对数据的完整性不敏感，最后一次持久化之后的数据在宕机后可能丢失。

RDB 的触发条件如下：

1、满足默认的 save 条件，会触发 rdb 规则

2、执行 flushall，也会触发 rdb 规则

3、退出 redis，也会产生 rdb 文件

RDB 的恢复条件如下：

1、将 dump.rdb 文件放在 redis 启动目录即可，redis 会自动检查其中的数据并恢复

2、查看需要存在的位置：redis-cli 中 config get dir 即可

rdb 适合大规模的数据恢复，但是需要一定的时间间隔进程操作。

### AOF

AOF（Append Only File），记录服务器执行的**所有写操作**命令，类似于 MySQL 中的日志。在服务器启动时，通过重新执行 AOF 这些命令来还原数据集。相应的配置文件为 appendonly.aof，默认不开启，需要手动进行启动。

其他相应的配置可以查看 redis 的相应的 conf 文件，比如 appendfsync、auto-aof-rewrite-percentage、auto-aof-rewrite-min-size 等。aof 文件大小大于 64mb 后就会产生重写的操作。当 aof 文件出现问题时，需要使用 `redis-check-aof --fix` 工具对 aof 文件进行修复。

aof 同步设置：

- 每一次修改都会同步，文件的完整性会更好
- 每 1s 同步一次，那么可能会丢失 1s 的数据
- 不同步效率是最高的

对比 AOF 与 RDB，AOF 是文件读写流操作，所以运行效率比 RDB 低，数据文件也比 RDB 大，修复数据的速度也比 RDB 慢。

Redis 还可以**同时使用 AOF 持久化和 RDB 持久化**。在这种情况下，当 Redis 重启时，它会优先使用 AOF 文件来还原数据集，因为 AOF 文件保存的数据集通常比 RDB 文件所保存的数据集更完整。

## Redis 发布与订阅

发布订阅（pub/sub）是一种消息通信的模型，发送者发送消息，接收者接受消息。一般此模型涉及三种对象：

> 1、消息发送者
>
> 2、频道
>
> 3、消息订阅者

模型的视图如下：

![redis-pub-sub](/images/middleware/redis-pub-sub.png)

Redis 的客户端可以订阅任意数量的频道，其相应的操作文档可以参考前文的 Redis 官方文档。

## Redis 主从复制

在企业中，Redis 集群是必用的，其架构通常为主从模式：一个主节点有多个从节点，一个从节点只有一个主节点。

**主从复制的作用如下所示：**

- 数据冗余：主从复制是可以热备份的，是区别于 Redis 持久化的另外一种数据冗余的方式
- 故障恢复：当主节点出现问题时，可以由从节点提供服务，实现故障的快速恢复，也能称为服务冗余
- 负载均衡：主从架构主要是一种多读少写型的架构模式，通过多个 Redis 服务器分担读的负载，可以大大提升 Redis 服务器的并发量
- 高可用的基石：主从复制是哨兵和集群能实施的基础，所以说是基石

> 一般来说，单体 Redis 服务器一旦发生单点故障，那么很有可能会丢失至少 1s 以上的数据，并且单体 Redis 需要处理所有的请求负载，压力较大。而且，单体 Redis 由于服务器的内存有限，不可能让服务器内存全部交给 Redis 进行数据存储。单台 Redis 内存占用不应超过 20GB。

`info replication` 表示查看当前的 Redis 服务器的角色信息。

实现 Redis 集群模式只需要修改三个配置属性即可，然后使用 Redis 启动这三个配置即可：

- 1、端口
- 2、pid
- 3、log 文件名

配置从机时候，使用 `slaveof + host + port` 即可配置主从形式，但是一旦此 Redis 重启后，配置就会重置，若需要持久化的配置文件，需要手动设置 redis.conf 配置文件。

主从复制一般两种形式：全量复制与增量复制。其中，但凡从机只要是重新连接主机，都会发生一次全量复制。
