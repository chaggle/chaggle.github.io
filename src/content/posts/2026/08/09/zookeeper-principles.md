---
title: "Zookeeper 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "zookeeper"]
category: "middleware"
---
> 本文从 Zookeeper 的数据模型、ZAB 协议、Leader 选举、会话机制出发，梳理分布式协调服务的底层原理，最后给出常见问题的排查思路。

## 概述

Zookeeper 是 Apache 开源的分布式协调服务，用于解决分布式系统中的**一致性**、**数据发布订阅**、**命名服务**、**分布式锁**、**集群管理**等问题。

:::note
Zookeeper 的核心定位是"小数据的协调"，它存储的数据量很小（一般建议单节点不超过几 MB 到十几 MB），但要求极高的读性能和一致性。不要把 ZK 当数据库用。
:::


它的典型使用者：Kafka（broker 元数据、Controller 选举、分区副本选主）、HBase（HMaster 选举、meta 表定位）、Dubbo（注册中心）、Eureka/Consul 之外的分布式锁实现等。

## 数据模型

### Znode 树形结构

Zookeeper 的数据模型是一棵**树**，树的每个节点称为 **Znode**。每个 Znode 有唯一的路径，如 `/dubbo/service1/providers`。

- 每个 Znode 可以存储数据（上限默认 1MB，建议小数据量）和挂载子节点
- 路径以 `/` 开头，不允许嵌套 `/dubbo//x` 这样的写法
- 每个 Znode 都有 stat 状态信息：版本号（version）、子节点版本（cversion）、ACL 版本（aversion）、时间戳（ctime/mtime）、数据长度、ephemeralOwner 等

Znode 按生命周期分为四类：

| 类型 | 说明 | 应用场景 |
| ---- | ---- | ---- |
| 持久节点（Persistent） | 创建后永久存在，除非显式删除 | 配置数据、固定目录 |
| 持久顺序节点（Persistent Sequential） | 创建时自动追加递增序号 | 分布式队列 |
| 临时节点（Ephemeral） | 会话结束自动删除 | 注册中心、分布式锁 |
| 临时顺序节点（Ephemeral Sequential） | 临时 + 顺序 | 分布式锁核心 |

:::warning
临时节点不能有子节点，且它的生命周期与创建它的**会话**绑定：会话失效（不是连接断开），节点即被删除。这是 ZK 做服务注册发现时"宕机自动下线"的根基。
:::


### 版本号与乐观锁

每个 Znode 的 stat 中有 `dataVersion`（数据版本号），任何写操作都携带版本号：

```java
// 携带 version，实现 CAS 式更新
zk.setData(path, data, version);
```

- 传入的 version 与当前版本不一致时，抛出 `BadVersionException`，事务提交失败
- 这是 ZK 实现分布式锁"防重入、防误删"的重要手段：删除锁节点时携带创建时读到的 version，避免删掉别人重入创建的节点

### Watch 机制

Watch（监听）是 ZK 的**发布订阅**实现：

- 客户端对某个节点注册 watch：`getData(path, watch, ...)`、`getChildren(path, watch, ...)`、`exists(path, watch, ...)`
- 节点数据变化、子节点变化、节点删除时，服务端向注册了 watch 的客户端发送通知
- 通知是**一次性**的：触发后即失效，需要客户端重新注册

:::caution
Watch 通知只能保证"事件发生了"，不保证事件内容完整：`getData` 触发的通知里不含新数据，需要客户端再主动 `getData` 一次拿最新值。且 watch 在 session 过期时全部失效（不会触发 Watcher），回调线程执行过慢还可能触发 `Session moved` 相关异常。
:::


:::warning
ZK 客户端发起 watch 注册与获得通知之间存在"窗口期"：注册请求没到达服务端之前事件已经发生，就会丢失。这就是常见的"watch 丢失"问题来源，通常通过读锁路径时先 `exists` 再 `getData` 之类的二次确认来缓解。
:::


## 一致性协议：ZAB

ZAB（Zookeeper Atomic Broadcast）是 ZK 专属的一致性协议，全称"原子广播协议"。它只解决一个问题：**保证所有副本上的数据变更以事务形式按序提交**。

ZAB 协议包含两大阶段：

### 阶段一：原子广播（正常运行）

写请求统一交给 Leader，Leader 执行两阶段提交的变体：

1. 客户端将写请求发给 Leader
2. Leader 生成全局唯一的 **ZXID**（事务 id），把提案（Proposal）广播给所有 Follower
3. Follower 将提案写入本地事务日志（sync 落盘），返回 ACK
4. Leader 收到**过半（法定人数 quorum）** ACK 后提交该提案，并广播 commit 给 Follower
5. Follower 应用 commit，返回客户端结果

:::tip
过半提交保证了任意两条事务不会在不同机器上以相反顺序被应用：因为任何过半集合必有交集。这就是 ZK 容忍少数节点故障（容忍 2 台挂 1 台）的理论依据。
:::


### 阶段二：崩溃恢复（Leader 故障）

Leader 崩溃后，集群进入崩溃恢复阶段，选出新 Leader，并把旧 Leader 已经提交但未同步的事务通过**截断（truncate）**或**同步（sync）**对齐到新 Leader 的状态：

- 新 Leader 必须是**数据最新**（ZXID 最大）的节点
- 对落后节点：把超过新 Leader ZXID 的未提交事务截断丢弃
- 对可能已经提交的事务：先同步补齐再对外服务

:::note
ZAB 与 Paxos/Raft 的异同：

- Paxos：没有 Leader 概念（Basic Paxos），通过两阶段 Prepare/Accept 达成共识，ZK 的 ZAB 受 Paxos 启发但做了简化：固定 Leader、广播式提交
- Raft：同样基于 Leader + 日志复制 + 过半提交，但 Raft 有完整的"任期（term）"和随机超时选主；ZAB 的 ZXID 包含 epoch（朝代）+ 计数，等价于 term
- 关键区别：Raft 的日志是"连续性"的（领导者尝试填平日志空洞），ZAB 直接截断多余日志；ZAB 是顺序提交、无日志空洞
:::


## Leader 选举

### 选举算法：Fast Leader Election（FLE）

ZK 3.4+ 默认使用 Fast Leader Election。选举触发时机：

- 集群启动时
- Leader 崩溃 / 失联（Follower 收不到 Leader 心跳）
- 节点进入 LOOKING 状态

### 投票规则（比较规则）

每张投票包含 `(myid, zxid, epoch)`，比较顺序是：

1. **epoch（朝代）** 大的优先 —— 新的选举周期
2. **zxid（最新事务 id）** 大的优先 —— 数据新的节点当 Leader
3. **myid（节点编号）** 大的优先 —— 数据相同时编号大的胜出

:::tip
"epoch 优先、zxid 优先、myid 兜底" 保证选出的 Leader 一定是**数据最全**的节点，避免数据回退；myid 兜底保证最终一定能收敛出唯一 Leader。
:::


选举流程（以 3 节点为例，myid=1,2,3）：

1. 所有节点进入 LOOKING，先投自己（myid, zxid, epoch）
2. 把投票广播给其他节点
3. 收到别人的投票后按规则 PK：如果别人"更大"就改投别人，并广播新票
4. 某节点发现自己的票被**过半**节点认可（包括自己），成为 Leader，其余节点成为 Follower
5. Leader 与其他节点建立学习（sync）流程，对齐数据后进入正常广播阶段

:::warning
脑裂场景：ZK 集群必须满足**过半存活**才能选出 Leader。例如 5 台集群，网络分区成 3+2，3 台那边能选出 Leader 继续服务；2 台那边永远无法过半，只能等待恢复。所以 ZK 集群建议奇数台（3、5、7），避免双 Leader。
:::


### myid / zxid 的组成

- **myid**：写在 `data/myid` 文件里的唯一编号，用于区分节点身份
- **zxid**：64 位，高 32 位是 **epoch**（每次选举 +1），低 32 位是当前 epoch 内的事务序号。保证全局单调递增
- **epoch** 在选举时互相 PK，只有 epoch 更大或相同才接受对方的投票

```bash
# 查看节点角色与状态
zkServer.sh status
# 输出：Mode: leader / follower
```

## 会话机制

### Session 与超时

- 客户端连接 ZK 建立会话，服务端分配 sessionId（64 位）与 sessionTimeout
- 会话以**心跳**维持：客户端定期（sessionTimeout/3 左右）发 ping，服务端过期扫描线程按 `sessionTimeout/2` 的粒度检查
- 服务端判定会话超时后：删除该会话的所有临时节点，并广播事件

### 临时节点生命周期

```
创建临时节点  ->  会话存活  ->  节点存在
              ->  会话超时  ->  节点被删除（与连接断开无关）
```

:::note
关键区别：

- **连接断开**：TCP 断了，但会话可能还在（超时时间内重连成功，节点还在）
- **会话超时**：超过 sessionTimeout 没恢复心跳，节点永久删除
:::


### 重连与恢复

- 客户端断开后，ZK Client 库会按 `connectTimeout` 重试，尽量重连到**同一台**服务端（会话仍有效）
- 连接串配多个地址时，重连成功后如果 session 未过期，无需重新初始化，watch 保留；如果 session 已过期，客户端抛出 `SessionExpiredException`，应用需自行重建会话、重建 watch、重新注册临时节点

:::warning
临时节点的"存活依赖"陷阱：如果应用进程还在，但 session 超时导致临时节点被删，ZK 不会自动帮你重建。服务注册场景必须捕获 `SessionExpiredException` 并重连重建，否则会出现"服务还活着、注册信息没了"的现象。
:::


## 典型应用

### 分布式锁（临时顺序节点 + Watch）

核心思路：

1. 加锁：在锁目录下创建**临时顺序节点**，如 `/locks/lock_0000000010`
2. 判断自己是否是序号最小的节点：是则获得锁
3. 不是则注册 watch 监听**前一个节点**的删除事件，被唤醒后重新检查
4. 解锁：删除自己的节点（携带 version 防误删），会话异常则临时节点自动清理

```java
// 伪代码：加锁流程
String path = zk.create("/locks/lock-", data, EPHEMERAL_SEQUENTIAL);
List<String> children = zk.getChildren("/locks", false);
String lockId = path.substring(path.lastIndexOf("/") + 1);
int mySeq = getSeq(lockId);
String prev = findPrevSmaller(mySeq);   // 找序号比自己小的最近节点
if (prev == null) {
    return 获得锁;
}
zk.exists(prev, new Watcher() {        // watch 前一个节点
    public void process(WatchedEvent e) {
        if (e.getType() == NodeDeleted) {
            // 唤醒抢锁线程，重新走判断流程
        }
    }
});
```

:::tip
与 Redis 锁相比，ZK 锁的优点是"天然防死锁"（会话超时自动释放临时节点）、有事件通知不用自旋轮询；缺点是性能差（每次加锁多次 RTT）、依赖 ZK 集群。
:::


### 服务注册发现

- 服务提供者启动时在 `/services/{service}/providers/{ip:port}` 下创建**临时节点**，注册 URL 元数据
- 消费者 watch 该服务目录的 `getChildren`，节点变化（上线/下线）实时感知
- 提供者宕机 → 会话超时 → 临时节点删除 → 消费者 watch 触发 → 剔除实例

### 分布式队列

- FIFO 队列：用持久顺序节点，出队时取序号最小节点（类似分布式锁反向）
- 屏障（Barrier）：先注册一个 ready 节点，参与者全部就绪才删除它，实现多节点同步

### 大数据组件的协调器

- **Kafka**：broker 注册、Controller 选举（谁先抢到临时节点谁是 Controller）、分区 leader 选举、ISR 元数据存储
- **HBase**：HMaster 抢注临时节点选举、meta 表位置记录、RegionServer 在线状态上报
- **HDFS**（旧版）：NameNode 双机热备的 Active/Standby 选举

## 常规问题排查

### 1. 集群脑裂 / 无法选主

- 检查各节点 `zkServer.sh status`，是否处于 LOOKING 状态
- 网络分区：确认节点之间 2888/3888 端口互通，防火墙是否误拦
- 集群必须**过半**存活才能选主，`server.1=...` 配置中节点总数是否与实际一致
- 检查 `data/myid` 是否与配置文件对应、事务日志目录是否可写

:::caution
「无法选主」最常见原因：集群配置里写了 5 台但实际只起了 2 台，永远无法过半；或者磁盘满了事务日志写不进去。
:::


### 2. session 过期导致临时节点丢失

- 现象：客户端未重启，但注册中心里的临时节点消失了
- 排查：查看日志 `Session 0x... expired`；调大客户端 `sessionTimeout` 配置（同时服务端需在 `maxSessionTimeout` 范围内）
- 应用层必须监听 `SessionExpiredException` 做重建逻辑

### 3. watch 通知丢失

- 原因：watch 一次性 + 注册与事件之间的窗口期
- 排查：检查是否在事件回调里重新注册了 watch；不要在回调里做耗时操作（长时间占用 watcher 线程会触发 `Session moved`/`Watcher` 抛错）
- 缓解：先 `exists` 再 `getData` 二次确认；业务上以"主动拉取 + watch 兜底"双保险

### 4. 读写性能瓶颈

- ZK 读性能远好于写：写必须过 Leader 且落盘 + 过半 ACK
- 客户端连接全部打到 Leader 导致写放大：使用 observer 节点分担读压力（observer 不参与投票）
- 单机吞吐提升：将事务日志放在独立磁盘（SSD），与数据快照分离

### 5. 连接数限制

- 服务端默认连接数上限 `maxClientCnxns`（默认 60），连接池/多客户端场景容易触发 `Connection refused` 或 `Too many connections`
- 调大配置并重启，或应用侧复用连接池

### 6. 慢操作：sync 阻塞

- 写操作必须等待事务日志 fsync 落盘，磁盘 IO 慢 → 写延迟飙高
- 现象：`sync 耗时高`、事务日志增长慢、客户端大量超时
- 排查：`iostat` 看磁盘；保证 `/data/version-2` 下的 `log.*` 文件所在盘性能
- 配置 `fsync.windowsize` 批量刷盘可缓解部分压力（牺牲少量可靠性换取吞吐）

### 7. 磁盘事务日志管理

- 事务日志默认无限制增长，老日志可通过 `autopurge.snapRetainCount` + `autopurge.purgeInterval` 自动清理
- 快照（snapshot）与事务日志（log）分别存储；恢复时先加载快照再重放 log
- 磁盘写满后 ZK 会停止接受写入，表现为 "Unable to write to transaction log"

## 小结

- 数据模型上记住"树 + Znode 四种类型 + 版本号 + 一次性 Watch"
- 一致性上记住"ZAB = 原子广播 + 崩溃恢复，过半提交"
- 选举上记住"epoch > zxid > myid"的 PK 规则
- 会话上记住"临时节点跟随会话生命周期，超时即删"
- 面试/实践最关键的一句话：**ZK 适合做协调和小数据强一致，不适合当数据库和无限扩容的注册中心**
