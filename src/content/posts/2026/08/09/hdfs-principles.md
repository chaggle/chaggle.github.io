---
title: "HDFS 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "hdfs"]
category: "bigdata"
---

> 大数据入门的第一块基石就是 HDFS。作为 Hadoop 的分布式文件系统，它藏了很多"为什么"：为什么块是 128M？为什么写数据要走 pipeline？NameNode 挂了数据会不会丢？这篇文章把 HDFS 的架构、原理、参数和排障经验梳理一遍。

## 核心架构

HDFS 是主从（Master/Slave）架构，核心角色有三个：NameNode、DataNode，以及辅助的 Secondary NameNode / Standby NameNode。

### NameNode（主节点）

- 管理文件系统的命名空间：目录树、文件名、文件与块的映射关系、块与 DataNode 的对应关系
- 不存数据本身，只存元数据（Metadata），保存在内存中，由磁盘上的 FsImage + EditsLog 持久化
- 响应客户端的读写请求：告诉客户端数据块在哪个 DataNode 上
- 是单点（SPOF），依赖 HA 机制或 Secondary NameNode 缓解风险

:::caution
NameNode 一旦丢失元数据（FsImage + EditsLog 全部损坏），整个集群的数据就"找不回来"了，因为块和文件的映射关系没了。所以 name.dir 一定要配置多个目录，最好在不同磁盘甚至不同机器上。
:::


### DataNode（从节点）

- 真正存储数据块的地方，默认块大小 128M，冗余副本默认 3 份
- 周期性向 NameNode 发送心跳（默认 3 秒一次）和块报告（BlockReport）
- 响应客户端的读写请求，负责数据块的复制、删除、校验
- 每个块在磁盘上有两个文件：数据文件（blk_xxx）和校验文件（blk_xxx.meta）

### Secondary NameNode（辅助节点）

注意它**不是** NameNode 的热备，不能接管故障：

- 定期（默认 1 小时）从 NameNode 拉取 EditsLog，与 FsImage 合并（checkpoint），生成新的 FsImage 回传给 NameNode
- 作用是把 NameNode 的 EditLog 控制在一个较小范围，加速 NameNode 重启恢复
- 在 HA 架构中，它被 Standby NameNode 取代（Standby 会持续同步元数据，随时可以切换接管）

### 机架感知（Rack Awareness）

- Hadoop 默认认为所有节点在同一个机架，通过配置 `topology.script.file.name` 或 `net.topology.node.switch.mapping.impl` 启用
- 副本放置策略依赖机架信息：第一个副本放客户端所在节点，第二个副本放同机架不同节点，第三个副本放不同机架节点
- 好处：既满足容灾（跨机架），又减少跨机架带宽消耗（读写大多数副本在本机架内）

## 读写流程

### 写数据流程（Pipeline 流水线复制）

1. 客户端调用 `FileSystem.create()`，向 NameNode 发起创建请求
2. NameNode 检查权限、路径合法性，返回可写的 DataNode 列表（按机架感知选 3 个）
3. 客户端按块（128M）写入：把数据切包（packet，默认 64KB），流式推给第一个 DataNode
4. 第一个 DataNode 边接收边存盘，同时把 packet 转发给第二个，第二个再转发给第三个，形成 pipeline
5. 每个 DataNode 写完一个 packet 后逐级 ack 回传，客户端收到确认后才发送下一个 packet
6. 一个块写完，向 NameNode 汇报块完成信息；全部块写完，关闭文件流

:::note
pipeline 写入的妙处：3 份副本只需要一份网络流量即可完成（顺序转发），相比"并发写三份"带宽节省显著，代价是写入延迟随副本数增加而略微上升。
:::


### 读数据流程（就近读取）

1. 客户端调用 `FileSystem.open()`，拿到文件的块列表（每个块包含多个副本位置）
2. 客户端对每个块按"网络距离"排序副本节点：本机 > 同机架 > 同数据中心 > 跨数据中心
3. 从最近的 DataNode 读取，优先读第一个副本，失败自动切换下一个副本
4. 读完自动校验 CRC 校验码，不一致会重新选取副本读取

## 重要原理机制

### 块 Block（128M）

- 默认 128M（旧版本 64M），通过 `dfs.blocksize` 配置
- 大块设计的原因：
  - 减少元数据量：一个文件块数少，NameNode 内存占用小
  - 减少寻道次数：块大，一次寻道能读更多连续数据，适合"一次写入、多次读取、大文件流式读"的场景
  - 便于并行处理：文件被切块后，MapReduce/Spark 可以按块并行处理

:::warning
块设置不是越大越好：块太大，MapReduce 任务分片粒度变粗，并行度下降；块太小，元数据膨胀。实际业务中小文件多才是更大的问题。
:::


### 副本策略

- 默认副本数 3（`dfs.replication`），可对单个文件/目录单独设置（`hdfs dfs -setrep`）
- 放置策略：机架感知（见上文）
- 副本冗余的目的是容错 + 就近读取加速

### 心跳与块报告

- DataNode 每 3 秒向 NameNode 发送心跳（`dfs.heartbeat.interval`），表示"我还活着"
- 心跳还携带容量、剩余空间、正在复制的块数等信息，NameNode 据此做负载均衡决策
- DataNode 启动时会向 NameNode 上报全部块列表（块报告），之后周期性增量上报
- 超过 `dfs.namenode.heartbeat.recheck-interval` 判定 DataNode 死亡，将其上的块标记为需要复制

### 安全模式（SafeMode）

- NameNode 启动后先进入安全模式，此时只读，不能写
- 等待各 DataNode 上报块报告，达到阈值（`dfs.namenode.safemode.threshold-pct`，默认 0.999）且副本满足率达标后自动退出
- 手动操作：`hdfs dfsadmin -safemode enter/leave/get`

### 元数据管理：FsImage + EditsLog

- 内存中的元数据定期落盘为 FsImage（文件系统镜像）
- 所有增删改操作先追加写 EditsLog（日志），定期 checkpoint 合并
- 设计思路借鉴了传统数据库的 WAL：重启时加载 FsImage + 重放 EditsLog 恢复内存状态
- EditsLog 多目录冗余（`dfs.namenode.edits.dir`），防止单盘损坏

### HA 高可用（QJM）

- 两个 NameNode（Active/Standby），Active 对外服务，Standby 热备
- 共享存储用 QJM（Quorum Journal Manager）：由 3 个 JournalNode 组成，Active 写 EditsLog 到多数派（2/3），Standby 实时读取并在内存中重放
- ZKFC（ZKFailoverController）借助 ZooKeeper 监控 Active 状态，故障时自动切换
- 切换时靠 **fencing（隔离）** 防止脑裂：比如 kill 掉旧 Active 的进程、踢出共享存储，确保同时只有一个 Active

:::caution
脑裂（Split Brain）是最危险的事故：两个 NameNode 同时认为自己是 Active，同时写 EditsLog，元数据会错乱。HA 场景下 fencing 机制必须配置完整，比如 `dfs.ha.fencing.methods` 要配置 sshfence 或 shell 脚本。
:::


### 负载均衡

- `hdfs balancer` 命令触发，按 `dfs.datanode.balance.bandwidthPerSec` 限速
- 均衡目标是让各 DataNode 磁盘使用率接近集群平均值（±5%）
- 新节点扩容后通常会执行一次 balancer

## 重要参数介绍

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `dfs.replication` | 3 | 默认副本数；带宽有限或测试环境可调低，重要数据可调高 |
| `dfs.blocksize` | 134217728 (128M) | 块大小，新写入生效 |
| `dfs.namenode.handler.count` | 10 | NameNode 处理 RPC 的线程数；机器核多、集群大时适当调大（如 100~200） |
| `dfs.namenode.name.dir` | file:///... | 元数据（FsImage+EditsLog）存储目录，配置多个以容灾 |
| `dfs.datanode.data.dir` | file:///... | DataNode 数据存储目录，多盘可配置逗号分隔多个目录 |
| `dfs.replication.max` | 512 | 单个块最大副本数 |
| `dfs.heartbeat.interval` | 3 | DataNode 心跳间隔（秒） |
| `dfs.namenode.safemode.threshold-pct` | 0.999 | 安全模式退出的块报告比例阈值 |
| `dfs.trash.interval` | 0 | 垃圾回收站保留时间（分钟），0 表示关闭 |

### 与写入带宽相关的参数

- `dfs.client.block.write.replace-datanode-on-failure`：pipeline 中某个 DataNode 故障时是否更换节点重写
- `dfs.namenode.replication.work.multiplier.per.iteration`：NameNode 每轮心跳下发的复制任务数，影响副本恢复速度
- `dfs.datanode.handler.count`：DataNode 处理读写请求的线程数，调大能提升并发吞吐
- 客户端侧：`io.file.buffer.size`（默认 4KB~128KB）影响读写缓冲区，调大可提升单线程吞吐

:::tip
垃圾回收站是保命神器：`dfs.trash.interval` 设为 1440（1 天），用户误删文件后可以在 `.Trash` 目录里捞回来，HDFS Shell 删文件默认只进回收站，不直接物理删除。
:::


## 常见问题排查

### NameNode 启动失败 / 元数据损坏

- 现象：日志报 `No such file or directory`、`Corrupt image`、`NameNode format without confirming` 等
- 排查：
  - 先看日志 `logs/hadoop-hdfs-namenode-xxx.log`，确认是镜像文件损坏还是磁盘故障
  - 用 `hdfs fsck / -files -blocks` 检查文件系统完整性
  - 单点环境可以用 Secondary NameNode 的最新 FsImage 恢复；HA 环境直接用 Standby 的元数据
  - 严重时考虑 `hdfs namenode -recover`（offline image viewer / edit log viewer 辅助判断）
- 预防：多目录冗余 + 定期备份 FsImage + 配置 HA

### DataNode 下线（Decommission）

- 下线流程：`hdfs dfsadmin -decommission datanode:50020`，NameNode 会把该节点上的块复制到其他节点，完成后状态变为 Decommissioned
- 注意事项：
  - 用 `-refresh` 刷新超时时间，防止复制未完成被误判
  - 下线期间观察 `hdfs dfsadmin -report`，确认副本数恢复后再真正关机
  - 千万别直接 kill DataNode 进程（块会变"复制中"，触发大量网络复制）

### 块丢失（Missing Blocks）

- 表现：`fsck` 报 `MISSING`，Spark 读数据报 `FileNotFoundException` 或 `ChecksumException`
- 排查：
  - `hdfs fsck / -files -blocks` 定位丢失块的文件
  - 查 `hdfs dfsadmin -report` 看存活 DataNode 和副本状态
  - 磁盘坏、节点被误下线、硬件故障是常见原因；副本数 = 1 的文件一旦节点坏必丢
- 处理：无法恢复的块只能接受文件损坏；关键数据务必副本数 ≥ 3

### 磁盘满（Disk Full）

- 表现：写入报 `Disk out of space`、`No space left on device`
- 排查：
  - `df -h` 看 DataNode 数据盘使用率，`hdfs dfsadmin -report` 看各节点容量
  - 清理回收站、过期日志、临时文件
  - 扩容节点后跑 `hdfs balancer`
- 注意 NameNode 所在盘满会导致元数据写不进去，比数据盘满更危险

### 小文件过多

- 危害：每个文件、每个块都要占 NameNode 内存（约 150 字节/条目），百万小文件直接打爆 NameNode；MapReduce 每个小文件一个 map，效率极低
- 治理：
  - 写入侧：合并写入（SequenceFile / ORC / Parquet 大文件）
  - 存量侧：用 Spark 或 `hadoop archive -archiveName`（HAR）合并归档
  - 配合 `dfs.namenode.handler.count` 调大缓解压力

### 脑裂（Split Brain）

- 表现：两个 Active 同时出现，元数据双写错乱
- 排查：检查 ZKFC 日志、fencing 脚本执行情况、网络分区是否恢复
- 处理：第一时间停掉一个 NameNode，用 `hdfs haadmin -failover` 强制切换，之后从完好的元数据恢复

### 安全模式卡住

- 现象：`SafeMode is ON` 一直不退出，无法写数据
- 原因：DataNode 还没全部汇报完、块副本不足、或阈值配置不对
- 处理：
  - `hdfs dfsadmin -report` 看副本满足率
  - 等 DataNode 上线后自动退出；确认无丢失后可 `hdfs dfsadmin -safemode leave`（慎用）

:::note
排障通用口诀：先看 NameNode/DataNode 日志，再 `hdfs dfsadmin -report` 看集群健康，最后 `hdfs fsck /` 定位具体问题路径。日志永远是最先要看的。
:::


## 小结

HDFS 的核心心智模型就三句话：**元数据与数据分离**（NameNode 管元数据、DataNode 管数据）、**块 + 副本**（128M 大块、3 副本、机架感知）、**WAL 思路**（EditsLog + FsImage 持久化元数据）。把这三点吃透，再看读写流程、HA、参数和排障，都会顺理成章。
