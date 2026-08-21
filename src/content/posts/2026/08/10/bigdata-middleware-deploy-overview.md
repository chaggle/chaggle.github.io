---
title: "大数据与中间件组件部署总览"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "bigdata", "部署"]
category: "bigdata"
---

> 本文汇总 HDFS、YARN、Hive、Spark、Flink、Zookeeper、Kafka、MySQL、Redis、Nacos、RocketMQ 共 11 个组件的安装部署文档，统一了目录导航，便于对照查阅。各组件更深入的**生产调优**（8C16G / 32C256G / 64C512G 三档规格参数、集群规模优化、容灾备份）见对应组件各自的《XXX 生产调优实践》文章；K8S 环境下的部署见《Kubernetes 底层原理》《Kubernetes 常见问题排查》《Kubernetes 部署参数优化》三篇。

## 目录

- 第一部分：大数据组件（HDFS、YARN、Hive、Spark、Flink）
- 第二部分：中间件组件（Zookeeper、Kafka、MySQL、Redis、Nacos、RocketMQ）

---

# 第一部分：大数据组件

## HDFS（分布式文件系统）

> HDFS 是 Hadoop 的分布式文件系统，安装部署的核心是搞清楚三个角色的分工：NameNode（元数据）、DataNode（数据）、SecondaryNameNode（辅助检查点）。本文以 Hadoop 3.x 为例，记录从下载解压到启动验证的完整过程，单节点起步，扩展为集群只需加节点。

### 前置条件

| 项目 | 要求 |
| ---- | ---- |
| 操作系统 | Linux（CentOS 7+/Ubuntu 均可用） |
| JDK | 1.8 或 11（Hadoop 3.x 要求） |
| 免密登录 | 主节点到所有 DataNode 节点 SSH 免密 |
| 时间同步 | 集群节点统一时间（NTP/chrony） |
| hosts 解析 | 所有节点 hostname 与 IP 写入 `/etc/hosts` |

```bash
# 免密配置（主节点执行）
ssh-keygen -t rsa
ssh-copy-id user@node1
ssh-copy-id user@node2
```

:::note
HDFS 单点起步时免密不是必须的，但集群模式（主节点用 ssh 拉起从节点进程）必须配置。
:::


### 下载与解压

```bash
# 下载 Hadoop 3.x 二进制包（以 3.3.6 为例，建议从 Apache 镜像站获取）
wget https://dlcdn.apache.org/hadoop/common/hadoop-3.3.6/hadoop-3.3.6.tar.gz

# 统一解压到 /opt 并建立软链
tar -zxvf hadoop-3.3.6.tar.gz -C /opt
ln -s /opt/hadoop-3.3.6 /opt/hadoop
```

配置环境变量（`/etc/profile` 或 `~/.bashrc`）：

```bash
export JAVA_HOME=/usr/local/jdk1.8.0_xxx
export HADOOP_HOME=/opt/hadoop
export PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin
export HADOOP_CONF_DIR=$HADOOP_HOME/etc/hadoop
source /etc/profile
```

### 核心配置

配置文件都在 `$HADOOP_HOME/etc/hadoop/` 下，集群模式需要同步到所有节点。

#### 1. `core-site.xml`：文件系统入口

```xml
<configuration>
  <property>
    <name>fs.defaultFS</name>
    <value>hdfs://node1:8020</value>
  </property>
  <property>
    <name>hadoop.tmp.dir</name>
    <value>/data/hadoop/tmp</value>
  </property>
</configuration>
```

#### 2. `hdfs-site.xml`：存储目录与副本

```xml
<configuration>
  <!-- NameNode 元数据目录（建议配多目录，不同磁盘） -->
  <property>
    <name>dfs.namenode.name.dir</name>
    <value>/data/hadoop/namenode</value>
  </property>
  <!-- DataNode 数据目录（多块盘逗号分隔） -->
  <property>
    <name>dfs.datanode.data.dir</name>
    <value>/data/hadoop/datanode</value>
  </property>
  <!-- 副本数：3 节点集群配 2 或 3 -->
  <property>
    <name>dfs.replication</name>
    <value>2</value>
  </property>
</configuration>
```

:::warning
**生产铁律**：`dfs.namenode.name.dir` 配多个目录并放在不同磁盘（甚至两台机器），元数据是 HDFS 的命根子，目录损坏等于文件系统报废。
:::


#### 3. `workers` 文件：DataNode 清单

```bash
# 每行一个 DataNode 主机名
node1
node2
node3
```

#### 4. 环境配置 `hadoop-env.sh`

```bash
export JAVA_HOME=/usr/local/jdk1.8.0_xxx
```

### 格式化与启动

:::caution
**NameNode 只能格式化一次**（单节点首次部署时）。格式化会清空元数据目录，重复格式化会导致集群 DataNode 上报的集群 ID 不一致而启动失败。
:::


```bash
# 1. 创建数据目录
mkdir -p /data/hadoop/{namenode,datanode,tmp}

# 2. 首次部署时格式化 NameNode
hdfs namenode -format

# 3. 启动 HDFS（主节点执行，自动 ssh 到 workers 拉起 DataNode）
start-dfs.sh

# 4. 检查进程
jps
# 主节点应有：NameNode、SecondaryNameNode
# 从节点应有：DataNode
```

### 验证

```bash
# 查看集群状态：Live nodes 数量、块情况
hdfs dfsadmin -report

# 基本读写测试
hdfs dfs -mkdir -p /test
echo "hello hdfs" > /tmp/test.txt
hdfs dfs -put /tmp/test.txt /test/
hdfs dfs -cat /test/test.txt
```

Web UI：`http://<NameNode节点>:9870`（Hadoop 3.x；2.x 为 50070），可查看节点状态、文件系统浏览、NameNode 日志。

### 常见问题

- **DataNode 一直处于 Decommissioned/Down**：检查 `dfs.datanode.data.dir` 目录权限（属主应为运行用户）、磁盘空间、节点间 hostname 解析
- **集群 ID 不一致**（`java.io.IOException: Incompatible clusterIDs`）：多为重复格式化或从备份恢复元数据导致，需要比对 `VERSION` 文件中的 clusterID 或清理 DataNode 数据目录重新启动
- **块副本不足**：`dfs.replication` 与存活 DataNode 数不匹配，或部分节点掉线；`hdfs fsck / -files -blocks` 排查
- **安全模式（Safe mode）**：刚启动短暂处于安全模式属正常，长时间不退出检查 `hdfs dfsadmin -safemode get` 与数据目录空间

### 扩展为集群

单节点验证通过后，把 `hdfs-site.xml`、`core-site.xml`、`workers` 同步到其他节点，在各节点准备相同路径的 `dfs.datanode.data.dir` 目录，重启 DataNode 即可加入集群。HA（双 NameNode + JournalNode）属于进阶部署，后续单独写文档。

## YARN（资源调度）

> YARN 是 Hadoop 的资源调度框架，负责给 MapReduce、Spark、Flink 等作业分配 CPU 与内存。它的安装包和 HDFS 是同一个 Hadoop 发行版，只需额外配置两个文件：`mapred-site.xml`（把计算框架指向 YARN）和 `yarn-site.xml`（定义 ResourceManager 与资源参数）。本文接 HDFS 安装文档，记录 YARN 的配置、启动与验证。

### 角色说明

| 角色 | 职责 | 部署位置 |
| ---- | ---- | ---- |
| ResourceManager（RM） | 全局资源调度，分配 Container | 主节点（可 HA 两台） |
| NodeManager（NM） | 单机资源管理与任务执行 | 每个计算节点 |
| ApplicationMaster（AM） | 每个应用一个，向 RM 申请资源 | 由 NM 拉起，无需手动部署 |
| TimelineServer / JobHistoryServer | 作业历史记录 | 主节点（可选） |

### 配置

沿用 HDFS 部署时的 Hadoop 安装目录，在 `$HADOOP_HOME/etc/hadoop/` 下配置。

#### 1. `mapred-site.xml`：计算框架对接 YARN

```xml
<configuration>
  <property>
    <name>mapreduce.framework.name</name>
    <value>yarn</value>
  </property>
  <property>
    <name>mapreduce.jobhistory.address</name>
    <value>node1:10020</value>
  </property>
</configuration>
```

#### 2. `yarn-site.xml`：资源调度与单机资源

```xml
<configuration>
  <!-- ResourceManager 地址 -->
  <property>
    <name>yarn.resourcemanager.hostname</name>
    <value>node1</value>
  </property>
  <!-- 调度器：容量调度器 -->
  <property>
    <name>yarn.resourcemanager.scheduler.class</name>
    <value>org.apache.hadoop.yarn.server.resourcemanager.scheduler.capacity.CapacityScheduler</value>
  </property>
  <!-- 单节点可分配内存与核数（按机器实际配置调整） -->
  <property>
    <name>yarn.nodemanager.resource.memory-mb</name>
    <value>8192</value>
  </property>
  <property>
    <name>yarn.nodemanager.resource.cpu-vcores</name>
    <value>4</value>
  </property>
  <!-- 日志聚合：作业日志汇总到 HDFS -->
  <property>
    <name>yarn.log-aggregation-enable</name>
    <value>true</value>
  </property>
</configuration>
```

:::warning
`yarn.nodemanager.resource.memory-mb` 是 NodeManager 可分配给容器（Container）的内存总量，**必须给操作系统留出余量**。8GB 内存的机器建议配 6~7GB，配满会导致操作系统内存耗尽被 OOM 杀掉。
:::


#### 3. `yarn-env.sh` 补充 JDK

```bash
export JAVA_HOME=/usr/local/jdk1.8.0_xxx
```

### 启动与验证

```bash
# 启动 YARN（主节点执行）
start-yarn.sh

# 检查进程
jps
# 主节点：ResourceManager
# 从节点：NodeManager

# 查看节点资源
yarn node -list
# 输出应显示每个 NodeManager 的 IP 与可用资源
```

Web UI：`http://<ResourceManager节点>:8088`。集群概览页能看到：

- Active Nodes 数量
- 各节点内存/核数（与 `yarn.nodemanager.resource.*` 配置对应）
- 正在运行与已完成的 Application

### 跑一个 MR 作业验证

```bash
# 官方示例：统计 /test 目录下单词（先确认 HDFS 上已有文件）
hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-3.3.6.jar \
  wordcount /test /test-output

# 查看结果
hdfs dfs -cat /test-output/part-r-00000
```

作业提交后在 8088 页面能看到 Application 从 ACCEPTED → RUNNING → SUCCEEDED 的变化过程。

### 常见问题

- **ResourceManager 无法启动**：检查 8088 端口占用、`yarn.resourcemanager.hostname` 是否被主机名解析、`yarn-site.xml` 是否有残留配置
- **作业一直 ACCEPTED 不运行**：NodeManager 上报资源为 0（内存配置异常）、或集群总资源被其他作业占满
- **Container 启动即失败（Exited with exit code 127/1）**：节点上 JAVA_HOME 配置错误、或 `yarn.nodemanager.resource.memory-mb` 过小导致容器分配不足
- **日志看不到**：`yarn.log-aggregation-enable` 未开启时作业日志留在 NodeManager 本地，开启后可通过 8088 页面 `Logs` 入口查看
- **核数设置大于物理核数**：会导致超卖，任务互相抢占 CPU，一般按物理核数配置

### 扩展：ResourceManager HA（可选）

两个 ResourceManager 节点 + Zookeeper 实现故障自动切换，配置 `yarn.resourcemanager.ha.enabled=true`、`yarn.resourcemanager.zk-address` 后重启生效。单节点起步阶段可暂缓。

## Hive（数仓 SQL 引擎）

> Hive 本身不存储数据、不执行计算，它把 SQL 翻译成 MapReduce/Tez/Spark 作业丢给 YARN 跑，表结构（元数据）存在数据库里。安装 Hive 的核心就是两件事：**把元数据从默认的 Derby 换成 MySQL**（生产必须），以及处理它与 Hadoop 的版本兼容。本文以 Hive 3.1.3 + Hadoop 3.x 为例。

### 安装前必须理解的架构

```
HiveServer2（提供 JDBC 服务）
   │
   ├── 元数据 → MySQL（Metastore）
   └── 计算引擎 → YARN（MapReduce / Tez / Spark）
```

:::warning
Hive 自带的内嵌 Derby 元数据库只适合本地演示：同一时间只允许一个会话连接，并发一多就锁表。**生产环境必须外置 MySQL 作为 Metastore**。
:::


### 前置条件

- Hadoop 集群已部署（HDFS + YARN）
- JDK 1.8
- MySQL 5.7/8.0 可用（提前建好库与账号）

### 下载与解压

```bash
wget https://dlcdn.apache.org/hive/hive-3.1.3/apache-hive-3.1.3-bin.tar.gz
tar -zxvf apache-hive-3.1.3-bin.tar.gz -C /opt
ln -s /opt/apache-hive-3.1.3-bin /opt/hive

# 环境变量
export HIVE_HOME=/opt/hive
export PATH=$PATH:$HIVE_HOME/bin
```

### 配置 Metastore（MySQL）

#### 1. 准备 MySQL 库

```sql
CREATE DATABASE IF NOT EXISTS hive DEFAULT CHARACTER SET utf8;
GRANT ALL PRIVILEGES ON hive.* TO 'hive'@'%' IDENTIFIED BY 'hive123';
FLUSH PRIVILEGES;
```

#### 2. 添加 MySQL 驱动

```bash
# 将 mysql-connector-java 的 jar（如 mysql-connector-j-8.0.33.jar）放到 lib 目录
cp mysql-connector-j-8.0.33.jar $HIVE_HOME/lib/
```

#### 3. 修改 `conf/hive-site.xml`

```xml
<configuration>
  <!-- 数据库连接 -->
  <property>
    <name>javax.jdo.option.ConnectionURL</name>
    <value>jdbc:mysql://localhost:3306/hive?useSSL=false&amp;characterEncoding=UTF-8</value>
  </property>
  <property>
    <name>javax.jdo.option.ConnectionDriverName</name>
    <value>com.mysql.cj.jdbc.Driver</value>
  </property>
  <property>
    <name>javax.jdo.option.ConnectionUserName</name>
    <value>hive</value>
  </property>
  <property>
    <name>javax.jdo.option.ConnectionPassword</name>
    <value>hive123</value>
  </property>
  <!-- HiveServer2 服务地址（供 beeline/客户端连接） -->
  <property>
    <name>hive.server2.thrift.bind.host</name>
    <value>node1</value>
  </property>
  <property>
    <name>hive.server2.thrift.port</name>
    <value>10000</value>
  </property>
  <!-- 执行引擎：MR / tez / spark 三选一 -->
  <property>
    <name>hive.execution.engine</name>
    <value>mr</value>
  </property>
</configuration>
```

:::note
Hive 元数据会存放文件在 HDFS 的 `/user/hive/warehouse`（默认建表目录），启动前确认 HDFS 上有对应目录及写权限，或在配置中指定 `hive.metastore.warehouse.dir`。
:::


### 初始化元数据库

```bash
# 初始化 schema（首次部署执行一次，向 MySQL 建 60+ 张元数据表）
schematool -initSchema -dbType mysql
# 看到 "schemaTool completed" 即成功
```

### 启动与验证

#### 方式一：本地 CLI（快速验证）

```bash
hive
# 执行验证
show databases;
create table t_test(id int, name string);
insert into t_test values (1, 'hello');
select * from t_test;
```

#### 方式二：独立 Metastore + HiveServer2（生产模式）

```bash
# 后台启动元数据服务（共享元数据、允许多客户端）
nohup hive --service metastore > /opt/hive/logs/metastore.log 2>&1 &

# 启动 HiveServer2（JDBC 服务）
nohup hive --service hiveserver2 > /opt/hive/logs/hiveserver2.log 2>&1 &

# beeline 客户端连接验证
beeline -u jdbc:hive2://node1:10000 -n root
```

### 常见问题

- **`Could not resolve org.apache.hadoop:hadoop-client` / guava 冲突**：Hive 与 Hadoop 的 guava jar 版本不一致，删除 Hive lib 下的低版本 guava，替换为 Hadoop lib 下的版本
- **初始化报 `Access denied for user`**：MySQL 账号权限未授权 `hive.*`，或连接串中的 `useSSL=false` 未生效
- **HiveServer2 启动后连不上**：检查 10000 端口是否监听（`ss -lntp | grep 10000`）、`hive.server2.thrift.bind.host` 是否被正确解析
- **insert 很慢**：MR 引擎作业冷启动开销大，可用 `set hive.execution.engine=tez;` 切换（需安装 Tez）；表数据量大时优先考虑分区表
- **`warehouse` 目录权限不足**：`hdfs dfs -chmod -R 755 /user/hive/warehouse` 或直接 `hdfs dfs -chown -R hive:hive /user/hive`

### 部署建议

- 生产将 Metastore 独立部署（可多实例），HiveServer2 前挂 Kyuubi/LB 供多业务共用
- 建表规范：分区表 + 合理的文件格式（ORC/Parquet），避免小文件堆积
- 计算引擎：数据量大建议 Tez/Spark，MR 作为兜底

## Spark（内存计算引擎）

> Spark 是内存计算引擎，安装方式按资源管理模式分三种：Local（单机调试）、Standalone（Spark 自带集群）、YARN（复用 Hadoop 资源池）。生产环境几乎都是 **on YARN**，但部署上反而是最简单的——只需要客户端 + 配置，不用起任何常驻进程。本文三种模式都讲清楚，重点落在 YARN 模式。

### 部署模式对比

| 模式 | 部署动作 | 适用场景 |
| ---- | ---- | ---- |
| Local | 解压即用 | 开发调试、学习 |
| Standalone | 启动 Master + Worker 常驻进程 | 无 Hadoop 的小集群 |
| on YARN | 只需客户端，作业提交后由 YARN 调度 | 生产（与 Hadoop 共用资源） |

### 前置条件

- JDK 1.8/11
- Hadoop 3.x（on YARN 模式需要，且 `YARN_CONF_DIR` 指向有效配置）
- Scala 无需单独安装（发行包自带）

### 下载与解压

```bash
# 选择与 Hadoop 大版本匹配的预编译包（hadoop3 版）
wget https://dlcdn.apache.org/spark/spark-3.5.1/spark-3.5.1-bin-hadoop3.tgz
tar -zxvf spark-3.5.1-bin-hadoop3.tgz -C /opt
ln -s /opt/spark-3.5.1-bin-hadoop3 /opt/spark

export SPARK_HOME=/opt/spark
export PATH=$PATH:$SPARK_HOME/bin:$SPARK_HOME/sbin
```

### 配置

配置目录 `$SPARK_HOME/conf/`，官方自带模板，复制后修改。

#### 1. `spark-env.sh`

```bash
export JAVA_HOME=/usr/local/jdk1.8.0_xxx
# on YARN 模式：让 YARN 知道 Hadoop 配置位置
export HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop
# Standalone 模式：本机作为 Master 时指定
export SPARK_MASTER_HOST=node1
```

#### 2. `spark-defaults.conf`（on YARN 常用参数）

```properties
# 默认资源模式：用 YARN
spark.master=yarn
spark.deploy.mode=client
# 单 Executor 资源（内存与核数按数据量调整）
spark.executor.memory=4g
spark.executor.cores=2
spark.driver.memory=2g
# 动态资源分配（可选）
spark.dynamicAllocation.enabled=true
spark.dynamicAllocation.minExecutors=1
spark.dynamicAllocation.maxExecutors=10
```

:::note
注意区分两类内存：`spark.driver.memory` 在 client 模式是本地 JVM 内存，在 cluster 模式是 YARN 容器内存；Driver 端用 `collect()` 汇总大数据量时容易 OOM。另外 YARN 容器的资源上限受 `yarn.nodemanager.resource.memory-mb` 约束，Executor 数量、内存、核数的乘积不能超过集群总资源，否则作业提交后一直处于 PENDING。
:::


### 三种模式的启动

#### Local 模式（零部署）

```bash
spark-shell
# 或提交作业
spark-submit --master local[*] your_app.jar
```

#### Standalone 模式

```bash
# 主节点
start-master.sh      # Web UI: http://node1:8080
# 各从节点（Master 节点执行，会 ssh 拉起）
start-workers.sh
# 提交
spark-submit --master spark://node1:7077 your_app.jar
```

#### on YARN 模式（生产）

```bash
# 不需要启动任何 Spark 进程！直接提交即可
spark-submit --master yarn --deploy-mode cluster \
  --class org.apache.spark.examples.SparkPi \
  $SPARK_HOME/examples/jars/spark-examples_2.12-3.5.1.jar 10
```

### 验证

```bash
# YARN 模式：任务运行情况去 YARN 8088 页面看
# 提交后：
yarn application -list          # 看到 SparkPi 的 Application
yarn logs -applicationId <id>   # 查看作业日志

# Standalone 模式：访问 http://node1:8080 查看 Worker 与执行中的应用
```

:::warning
YARN 模式的验证要点：**Spark 有没有真正用上 YARN，看 8088 页面**。如果作业出现在 YARN 的 Application 列表里，说明资源管理器接管成功；如果提交时报 `java.io.IOException: Connecting to ResourceManager failed`，检查 `YARN_CONF_DIR` 与 `yarn-site.xml`。
:::


### 常见问题

- **`ClassNotFoundException: org.apache.hadoop.fs.FileSystem`**：Hadoop 依赖未加入 classpath，确认 `HADOOP_CONF_DIR` 已导出，或提交时加 `--jars` 补齐
- **作业一直 PENDING**：资源不足（Executors 需求超过集群资源）或 YARN 队列容量不足；调小 `spark.executor.memory/cores`，或检查 `yarn.scheduler.capacity` 队列配置
- **Driver OOM**：client 模式下 `collect()` 大结果集；改用 `saveAsTextFile` 写 HDFS，或加大 driver 内存
- **Executor 丢失（Lost executor）**：节点内存被打满被系统 OOM Kill，对照 `yarn.nodemanager.resource.memory-mb` 与 Executor 配置排查
- **Spark 版本与 Hadoop 不匹配**：`spark-x.y.z-bin-hadoop2` 与 hadoop3 混用会报 RPC 协议错误，必须选 `bin-hadoop3` 包

### 部署建议

- 生产统一走 **on YARN + client 或 cluster 模式**：cluster 模式 Driver 由 YARN 托管更稳，适合定时作业；交互式开发用 client
- 动态资源分配建议开启：波峰波谷明显的作业能省一半资源
- 历史记录服务（SparkHistoryServer）配合 `spark.eventLog.enabled=true` 开启，便于排查历史作业

## Flink（流式计算引擎）

> Flink 是流批一体的分布式计算引擎，常与 Kafka 搭配做实时数仓。部署模式比 Spark 简单直观：解压后改一个配置文件，`start-cluster.sh` 就能起一个可用集群（Standalone 模式）；生产环境也可以跑在 YARN 上，让资源调度统一归 YARN 管理。本文以 Flink 1.17 为例，覆盖 Standalone 与 on YARN 两种方式。

### 前置条件

- JDK 1.8 或 11（Flink 1.17 要求 JDK 8/11）
- on YARN 模式：Hadoop 3.x 集群 + `HADOOP_CLASSPATH` 配置
- 建议关闭节点防火墙或放行 Web UI 端口

### 下载与解压

```bash
# 选择 with-hadoop 预编译包，省去手动集成 Hadoop 依赖
wget https://dlcdn.apache.org/flink/flink-1.17.2/flink-1.17.2-bin-scala_2.12.tgz
tar -zxvf flink-1.17.2-bin-scala_2.12.tgz -C /opt
ln -s /opt/flink-1.17.2 /opt/flink

export FLINK_HOME=/opt/flink
export PATH=$PATH:$FLINK_HOME/bin
```

:::note
Flink 1.17 之前的老版本（如 1.13）预编译包不带 hadoop 集成，需要手动把 `flink-shaded-hadoop-uber` jar 拷进 `lib/` 才能在 YARN 上跑。新版省掉了这一步。
:::


### Standalone 模式配置

核心配置文件 `conf/flink-conf.yaml`（重点三个：内存、并行度、Web 端口）：

```yaml
# JobManager 与 TaskManager 内存（按机器实际调整）
jobmanager.memory.process.size: 2048m
taskmanager.memory.process.size: 4096m

# 每个 TaskManager 的并行度（Slot 数）
taskmanager.numberOfTaskSlots: 4

# 默认并行度（建议不超过总 Slot 数）
parallelism.default: 4

# Web UI 端口
rest.port: 8081
```

#### 启动

```bash
# 主节点启动集群（JobManager + 本机 TaskManager）
start-cluster.sh

# 检查进程
jps   # 应看到 StandaloneSessionClusterEntrypoint 与 TaskManagerExecutor

# 停止
stop-cluster.sh
```

Web UI：`http://<主节点>:8081`，能看到 JobManager 状态、TaskManager 列表、运行中的作业。

### on YARN 模式

Flink 跑在 YARN 上有三种会话形态，区别在于作业生命周期：

| 形态 | 说明 | 适用场景 |
| ---- | ---- | ---- |
| Application 模式（推荐） | 每个作业一个专用 Flink 集群，用完即释放 | 生产作业、长任务 |
| Per-Job 模式 | 旧模式，作业结束集群释放（1.15+ 已弃用） | 不推荐 |
| Session 模式 | 共享集群，多个作业复用 | 短小临时作业多、希望快速提交 |

```bash
# 先让 Flink 客户端拿到 Hadoop 依赖
export HADOOP_CLASSPATH=$(hadoop classpath)

# Application 模式提交（作业常驻）
flink run-application -t yarn-application \
  -Djobmanager.memory.process.size=2048m \
  -Dtaskmanager.memory.process.size=4096m \
  -Dtaskmanager.numberOfTaskSlots=4 \
  -Dyarn.application.name=flink-etl-job \
  -c com.example.YourJob your-app.jar
```

:::note
Application 模式的作业在 YARN 8088 页面能看到独立的 Application。作业失败时整个集群自动销毁，由外部调度（如 DolphinScheduler/定时任务）负责重启，这正是它适合生产的原因。
:::


### 验证

```bash
# Standalone：提交内置示例（流式词频统计）
flink run $FLINK_HOME/examples/streaming/WordCount.jar \
  --input /tmp/input.txt --output /tmp/out

# 运行后在 8081 页面点击作业，能看到算子执行图与吞吐量

# on YARN：同样提交，作业出现在 YARN 8088 页面
```

### 常见问题

- **TaskManager 启动失败/OOM**：`taskmanager.memory.process.size` 与机器内存不匹配，或与 `yarn.nodemanager.resource.memory-mb` 冲突；JVM 堆内堆外内存（managed memory）分配不合理也会导致启动即死
- **`Could not resolve KeeperErrorCode`**：使用 Kafka connector 时配置错误导致连不上 Kafka；检查 `bootstrap.servers` 与 topic 权限
- **反压（Backpressure）高**：下游处理不过来，通过 Web UI 的 BackPressure 标签页定位慢算子，调大并行度或优化算子逻辑
- **检查点（Checkpoint）失败**：state.backend（RocksDB）存储路径磁盘不足，或 HDFS 目录权限问题；`flink run` 加 `-Dstate.checkpoints.dir=hdfs://node1:8020/flink-cp` 指定
- **on YARN 提交报 `NoSuchMethodError` 等版本冲突**：`HADOOP_CLASSPATH` 未配置或混入了错误版本的 hadoop 依赖

### 部署建议

- 生产用 **Application 模式 + 检查点 + 重启策略**（`restart-strategy: failure-rate`），配合监控报警（Web UI 或接入 Prometheus）
- 状态后端选 RocksDB（大状态），checkpoint 目录放 HDFS 保证可恢复
- Standalone 适合测试；正式环境资源统一归 YARN 管理，避免两套资源池互相争抢


---

# 第二部分：中间件组件


## Zookeeper（分布式协调）

> Zookeeper 是分布式协调服务，Kafka、HBase、HDFS HA、Dubbo 注册中心等大量中间件都依赖它做选主与元数据存储。它的部署模式很简单：单机（演示）、伪集群、真集群（3/5/7 台奇数）。真集群的关键就两件事：`zoo.cfg` 里声明所有节点、每个节点写自己的 `myid`。本文以 Zookeeper 3.8 为例。

### 前置条件

- JDK 1.8+
- 集群节点数建议奇数（3、5、7）：选主需要过半机制，奇数台才能容忍一半以下的节点故障

### 下载与解压

```bash
wget https://dlcdn.apache.org/zookeeper/zookeeper-3.8.4/apache-zookeeper-3.8.4-bin.tar.gz
tar -zxvf apache-zookeeper-3.8.4-bin.tar.gz -C /opt
ln -s /opt/apache-zookeeper-3.8.4-bin /opt/zookeeper

export ZOOKEEPER_HOME=/opt/zookeeper
export PATH=$PATH:$ZOOKEEPER_HOME/bin
```

### 配置

#### 1. 核心配置 `conf/zoo.cfg`

模板 `zoo_sample.cfg` 复制而来：

```properties
# 基础心跳时间单位（毫秒），其他时间参数都是它的倍数
tickTime=2000
# 初始化连接时的最大心跳数：follower 与 leader 初始同步最长 10*tickTime
initLimit=10
# 运行中 leader 与 follower 心跳最大间隔，超过则判死
syncLimit=5
# 数据目录（快照），务必放数据盘；事务日志目录可另配 dataLogDir
dataDir=/data/zookeeper/data
dataLogDir=/data/zookeeper/logs
# 客户端连接端口
clientPort=2181
# 集群节点声明：server.<myid>=<host>:<选举端口>:<数据同步端口>
server.1=node1:2888:3888
server.2=node2:2888:3888
server.3=node3:2888:3888
```

:::note
三个端口的区分：2181 是客户端连接，2888 是 leader 与 follower 的数据同步，3888 是选举通信端口。防火墙放行时三个都要开。
:::


#### 2. 每个节点写 `myid`

```bash
# 在 dataDir 目录下创建 myid 文件，内容与 zoo.cfg 中的 server 编号一致
mkdir -p /data/zookeeper/data
# node1 上：
echo 1 > /data/zookeeper/data/myid
# node2 上：
echo 2 > /data/zookeeper/data/myid
# node3 上：
echo 3 > /data/zookeeper/data/myid
```

:::warning
**myid 与 zoo.cfg 的 server 编号必须一一对应**，写错会导致节点加入不了集群，日志报 `Failed to sync` 或反复切换 Leader。
:::


### 启动与验证

```bash
# 每个节点启动
zkServer.sh start

# 查看状态（会输出该节点是 leader 还是 follower）
zkServer.sh status

# 客户端连接验证
zkCli.sh -server node1:2181
# 连接成功后执行：
ls /                    # 根节点（应存在 /zookeeper 内置节点）
create /test hello      # 创建节点
get /test               # 读取节点
```

3 台节点启动后，`zkServer.sh status` 应显示 1 台 leader、2 台 follower。

### 常用运维命令

```bash
zkServer.sh status              # 角色状态
zkServer.sh restart             # 重启
echo srvr | nc localhost 2181   # 查看运行统计（4lw 命令，需开启）
```

`conf/zoo.cfg` 追加 `4lw.commands.whitelist=*` 可开启四字命令（生产建议按需白名单）。

### 常见问题

- **启动报 `Address already in use`**：端口被占用，`ss -lntp | grep 2181` 排查
- **集群全部变成 standalone / 一直 leader 选举中**：节点间 2888/3888 不通（防火墙）或 myid 冲突
- **`Session expired`**：客户端与服务器之间心跳超时，tickTime 与 sessionTimeout 配置过小，或网络抖动
- **磁盘打满**：`dataDir` 下快照不断增长，Zookeeper 3.6+ 默认自动清理（`autopurge.snapRetainCount`、`autopurge.purgeInterval`），老版本需手动清
- **CPU 飙高**：连接数过多或 watcher 数量过大，用 4lw 命令 `mntr`、`wchs` 排查

### 部署建议

- 生产 3 台起步，ZK 与业务节点混部时注意隔离（它吃磁盘 IO 和网络）
- `dataLogDir` 独立磁盘放事务日志，能显著提升写性能
- 快照与事务日志定期检查清理策略，防止磁盘写满导致集群不可用

## Kafka（消息队列）

> Kafka 是分布式消息队列，也是实时数仓的事实标准：上游 Flink 消费它做计算，下游 sink 到 HDFS/Doris。安装的核心配置在 `server.properties` 一个文件里：broker 身份、监听地址、数据目录、集群协调方式（Zookeeper 或 3.x 的 KRaft）。本文以 Kafka 3.x 为例，先讲最常用的 Zookeeper 协调模式，再补充 KRaft 模式。

### 架构与依赖

```
Kafka Broker（消息存储与分发）
   ├── 集群协调：Zookeeper（传统模式）/ KRaft（3.x 新架构，去 ZK）
   ├── 客户端：producer / consumer
   └── 管理：kafka-topics.sh、kafka-console-*.sh
```

:::note
Kafka 3.x 引入 KRaft 模式后可以完全脱离 Zookeeper，但主流生产（尤其是与 Hadoop 生态共存）仍大量使用 Zookeeper 协调。KRaft 部署更轻，适合新建集群。
:::


### 前置条件

- JDK 1.8+（Kafka 3.x 需要 JDK 8/11/17）
- Zookeeper 集群可用（传统模式）
- 多 broker 节点建议奇数台

### 下载与解压

```bash
wget https://dlcdn.apache.org/kafka/3.6.2/kafka_2.13-3.6.2.tgz
tar -zxvf kafka_2.13-3.6.2.tgz -C /opt
ln -s /opt/kafka_2.13-3.6.2 /opt/kafka

export KAFKA_HOME=/opt/kafka
export PATH=$PATH:$KAFKA_HOME/bin
```

### 配置（Zookeeper 协调模式）

编辑 `config/server.properties`：

```properties
# 每台 broker 唯一
broker.id=0

# 监听地址：生产必须显式指定，否则注册给客户端的地址是内网主机名，客户端解析失败
listeners=PLAINTEXT://node1:9092

# 数据目录：日志段文件存放位置，多块盘逗号分隔
log.dirs=/data/kafka/logs

# 分区数与副本数的默认值（单分区默认即可，多分区按吞吐调整）
num.partitions=3
default.replication.factor=2

# Zookeeper 连接（传统模式）
zookeeper.connect=node1:2181,node2:2181,node3:2181

# 数据保留时间与大小（生产按业务设置）
log.retention.hours=72
log.retention.bytes=-1
```

:::warning
`listeners` 是最容易踩的坑：不显式配置时，broker 会把自己注册为 `主机名:9092`，客户端在别的机器上无法解析该主机名而连接失败。生产建议同时配 `advertised.listeners` 指向客户端可达的地址。
:::


### 启动与验证

#### 1. 启动 Zookeeper（若未部署，单机演示可先用 Kafka 自带的）

```bash
# 仅单机演示：kafka 自带的单机 ZK
zookeeper-server-start.sh config/zookeeper.properties
```

#### 2. 启动 Broker

```bash
# 每台节点执行（后台运行）
nohup kafka-server-start.sh config/server.properties > /opt/kafka/logs/kafka.out 2>&1 &

# 查看集群成员
kafka-broker-api-versions.sh --bootstrap-server node1:9092
# 或 kafka-metadata.sh（旧版用 zookeeper-shell 查 /brokers/ids）
```

#### 3. 消息收发验证

```bash
# 创建 topic：3 分区 2 副本
kafka-topics.sh --create --topic test-topic \
  --partitions 3 --replication-factor 2 \
  --bootstrap-server node1:9092

# 查看 topic 详情（确认分区与副本状态）
kafka-topics.sh --describe --topic test-topic --bootstrap-server node1:9092

# 生产消息
kafka-console-producer.sh --topic test-topic --bootstrap-server node1:9092
> hello kafka

# 消费消息（另开终端）
kafka-console-consumer.sh --topic test-topic \
  --from-beginning --bootstrap-server node1:9092
```

### KRaft 模式（去 Zookeeper，可选）

3.x 新建集群可以直接用 KRaft，少维护一套 ZK：

```bash
# 1. 生成集群唯一 ID
KAFKA_CLUSTER_ID="$(kafka-storage.sh random-uuid)"

# 2. 格式化存储目录（每台节点）
kafka-storage.sh format -t $KAFKA_CLUSTER_ID -c config/kraft/server.properties

# 3. 启动（controller 与 broker 合一角色，3 台起步）
kafka-server-start.sh config/kraft/server.properties
```

`server.properties` 中相应配置改为 `process.roles=broker,controller`、`controller.quorum.voters=1@node1:9093,2@node2:9093,3@node3:9093`。

### 常见问题

- **客户端报 `Failed to construct kafka consumer / Connection refused`**：`listeners`/`advertised.listeners` 未配或配错；防火墙 9092 未放行
- **`LEADER_NOT_AVAILABLE`**：topic 刚创建 leader 选举未完成，稍等重试；持续出现则检查 broker 是否全部加入集群
- **磁盘 IO 高/吞吐上不去**：`log.dirs` 只配了一块盘；副本因子高、acks 配置过严（`acks=all` + `min.insync.replicas` 不匹配）
- **消费组 lag 持续增长**：消费者处理速度跟不上生产速度，或分区数少于消费者并行度
- **`Replication factor: 2 larger than available brokers: 1`**：副本数超过存活 broker 数，单机演示时把副本因子改成 1

### 部署建议

- 生产 3+ broker，`default.replication.factor` 与 `min.insync.replicas`（建议 2）配合使用，保证消息不丢
- 数据盘单独挂载，`log.dirs` 多盘分担 IO
- 监控：JMX 指标（kafka.server 的 BytesInPerSec、UnderReplicatedPartitions）接入 Prometheus/Grafana
- 消息体大小、保留时长按业务定，避免无脑调大导致磁盘膨胀

## MySQL（关系型数据库）

> MySQL 是使用最广的关系型数据库，安装方式很多：yum/apt 源安装、官方二进制包（tar.xz）、源码编译。二进制包方式最可控、与发行版无关，本文以 MySQL 8.0 官方二进制包为例，覆盖从初始化、启动到安全配置的完整流程。服务化使用 systemd 管理，保证重启自愈。

### 前置条件

- Linux（CentOS 7+/Ubuntu），glibc 2.17+（8.0 二进制包要求）
- 依赖库：`libaio`、`libncurses`（可用 yum/apt 安装）
- 数据盘建议独立挂载

```bash
# CentOS 依赖
yum install -y libaio ncurses-libs
```

### 下载与解压

```bash
# 8.0 二进制包（约 250MB，选择 Linux-Generic 版本）
wget https://dev.mysql.com/get/Downloads/MySQL-8.0/mysql-8.0.36-linux-glibc2.17-x86_64.tar.xz
tar -xvf mysql-8.0.36-linux-glibc2.17-x86_64.tar.xz -C /opt
ln -s /opt/mysql-8.0.36-linux-glibc2.17-x86_64 /opt/mysql
```

### 创建运行用户与目录

```bash
# MySQL 禁止以 root 运行，创建专用用户
useradd -r -s /sbin/nologin mysql
mkdir -p /data/mysql
chown -R mysql:mysql /opt/mysql /data/mysql
```

### 初始化数据目录

```bash
# 8.0 初始化方式（--initialize-insecure：root 初始密码为空）
/opt/mysql/bin/mysqld --initialize-insecure \
  --user=mysql --datadir=/data/mysql

# 如想生成随机初始密码，用 --initialize（密码在错误日志里）
```

:::note
5.7 时代用 `mysql_install_db` 初始化，8.0 统一用 `mysqld --initialize`。初始化只需执行一次，重复执行会报 `datadir already exists`。
:::


### 配置文件 my.cnf

```ini
[mysqld]
basedir=/opt/mysql
datadir=/data/mysql
port=3306
socket=/data/mysql/mysql.sock
# 服务端字符集
character-set-server=utf8mb4
collation-server=utf8mb4_general_ci
# 数据目录环境（8.0 区分大小写必须在初始化前定）
lower_case_table_names=0
# 连接数（按业务调整）
max_connections=500
# 日志
log-error=/data/mysql/error.log
pid-file=/data/mysql/mysql.pid
```

:::warning
`lower_case_table_names` 决定表名是否大小写敏感，**必须在初始化前确定**，8.0 之后运行时修改会直接报错。Linux 生产环境一般保持默认（敏感，值为 0），迁移自 Windows 环境的库注意此坑。
:::


### 启动并注册 systemd

```bash
# 创建 systemd 服务
cat > /etc/systemd/system/mysqld.service <<'EOF'
[Unit]
Description=MySQL Server
After=network.target

[Service]
User=mysql
Group=mysql
ExecStart=/opt/mysql/bin/mysqld --defaults-file=/etc/my.cnf
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now mysqld
systemctl status mysqld
```

### 安全配置

```bash
# 首次连接（初始密码为空）
/opt/mysql/bin/mysql -uroot

# 设置 root 密码并删除匿名用户
ALTER USER 'root'@'localhost' IDENTIFIED BY 'StrongPass!123';
DELETE FROM mysql.user WHERE User='';
FLUSH PRIVILEGES;

# 允许 root 远程访问（生产不推荐 root 远程，建议专用账号）
CREATE USER 'root'@'%' IDENTIFIED BY 'StrongPass!123';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
```

### 验证

```bash
mysql -uroot -p
SELECT VERSION();          # 版本
SHOW VARIABLES LIKE '%datadir%';   # 数据目录
# 建库建表压力测试
CREATE DATABASE testdb DEFAULT CHARACTER SET utf8mb4;
USE testdb; CREATE TABLE t(id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(50));
INSERT INTO t(name) VALUES ('mysql');
SELECT * FROM t;
```

### 常见问题

- **启动报 `libaio.so.1: cannot open shared object file`**：未装 libaio 依赖
- **`Can't connect to local MySQL server through socket`**：mysqld 没起来，先看 `/data/mysql/error.log`；socket 路径不一致也常见
- **忘记 root 密码**：`--skip-grant-tables` 跳过权限表启动，重置后再正常重启
- **`Authentication plugin 'caching_sha2_password'` 连接失败**：8.0 默认认证插件，老客户端（5.7 及以下 JDBC 驱动）不支持；给账号指定 `IDENTIFIED WITH mysql_native_password BY '...'`，或升级驱动
- **`Too many connections`**：`max_connections` 不够，同时排查是否有连接泄漏

### 部署建议

- 生产：主从复制（binlog 开启 `log-bin` + `server-id`）+ 定时物理备份，从库可读扩展
- 数据目录放数据盘，日志（binlog/error log）单独盘位更好
- 8.0 默认 `caching_sha2_password` 认证，客户端组件版本要匹配

## Redis（缓存）

> Redis 是高性能的内存键值数据库，安装过程在中间件里算简单的：源码编译三步走（configure/make/make install），核心工作量全在 `redis.conf` 的取舍上——是否开启持久化、保护模式与密码、内存淘汰策略。本文以 Redis 7.x 为例，覆盖单机部署与主从复制的配置要点。

### 前置条件

- gcc、make（编译工具）
- 内存规划：Redis 数据全在内存，数据量 ×2 的内存预算比较稳妥（内存峰值 + 持久化缓冲）

```bash
yum install -y gcc make
```

### 下载与编译安装

```bash
wget https://download.redis.io/releases/redis-7.2.4.tar.gz
tar -zxvf redis-7.2.4.tar.gz -C /opt
cd /opt/redis-7.2.4

# 编译并安装（默认安装到 /usr/local/bin：redis-server、redis-cli 等）
make -j4
make install

# 目录规划
mkdir -p /data/redis
cp redis.conf /etc/redis.conf
```

### 核心配置 redis.conf

```conf
# 后台运行
daemonize yes

# 监听地址：生产只绑内网地址，避免暴露公网
bind 0.0.0.0

# 端口
port 6379

# 保护模式：开启时只允许本机回环地址连接
protected-mode yes

# 设置访问密码（生产必须）
requirepass YourPass123

# 持久化：AOF（默认关闭）与 RDB（默认开启）同时使用更稳
appendonly yes
appendfilename "appendonly.aof"

# 内存淘汰策略：到达 maxmemory 后如何清理
maxmemory 4gb
maxmemory-policy allkeys-lru

# 日志与数据目录
dir /data/redis
logfile /data/redis/redis.log
```

:::caution
**公网裸奔事故**：Redis 默认无密码 + 绑定所有网卡，暴露到公网后几分钟内就会被扫描器攻破，被植入挖矿程序。生产必须：`requirepass` 设密码 + `bind` 内网 IP + `protected-mode yes`。
:::


### 启动与验证

```bash
# 启动
redis-server /etc/redis.conf

# 验证连接与读写
redis-cli -a YourPass123 ping
# 输出 PONG

redis-cli -a YourPass123
> set name redis
> get name
> info memory
```

### 主从复制（可选）

从节点在 `redis.conf` 中配置一行即可：

```conf
# 从节点指向主节点
replicaof 192.168.1.10 6379
# 主节点有密码时从节点也要配
masterauth YourPass123
```

验证：主节点 `info replication` 应显示从节点在线；从节点 `role:slave`。

### 常见问题

- **`(error) NOAUTH Authentication required`**：未带密码认证，`redis-cli -a <密码>` 或连接后 `AUTH <密码>`
- **`Could not connect to Redis at 127.0.0.1:6379`**：服务没起来（看 `/data/redis/redis.log`）或 bind 地址不对
- **`MISCONF Redis is configured to save RDB snapshots but is currently not able to persist`**：磁盘权限或空间不足，RDB 保存失败；修复 `dir` 目录权限，必要时 `CONFIG SET stop-writes-on-bgsave-error no` 临时顶住
- **内存打满 OOM**：`maxmemory` 未设置导致 Redis 吃满内存被内核 OOM Kill；设置 maxmemory + 淘汰策略
- **主从延迟大**：网络延迟、从节点磁盘慢或 AOF 同步策略（`appendfsync`）过严；`info replication` 的 `master_repl_offset` 对比

### 部署建议

- 生产：主从 + 哨兵（Sentinel）或集群（Cluster）模式，单机是学习起点
- 持久化：AOF + RDB 双开，`appendfsync everysec` 平衡性能与安全
- 缓存场景务必配 `maxmemory` 与淘汰策略，防止缓存打满拖垮服务
- 监控：`INFO` 命令的 memory/connected_clients/keyspace 指标接入监控系统

## Nacos（注册与配置中心）

> Nacos 是阿里开源的服务注册中心与配置中心，微服务架构（Spring Cloud Alibaba、Dubbo）的核心依赖。安装分单机与集群两种模式：单机内置 Derby 数据库开箱即用，集群必须外接 MySQL 并至少 3 节点。部署的关键参数就两个：**启动模式**（standalone 还是集群）和**数据库配置**。本文以 Nacos 2.3.x 为例。

### 架构与端口

```
Nacos Server（注册中心 + 配置中心）
   ├── 单机：内嵌 Derby（开箱即用，仅测试）
   └── 集群：外接 MySQL（生产必须）+ 3 节点 + 一致性协议
```

| 端口 | 用途 |
| ---- | ---- |
| 8848 | 主端口（HTTP 控制台与 API） |
| 9848/9849 | gRPC 端口（2.x 客户端长连接，**必须放行**） |

:::warning
Nacos 2.x 客户端通过 gRPC 通信，只放行 8848 会导致服务注册成功但心跳续约失败。9848（客户端 gRPC）与 9849（集群间 gRPC）都要放行。
:::


### 前置条件

- JDK 1.8+（2.x 需要 JDK 8+）
- 集群模式：MySQL 5.7/8.0 + 3 台节点
- 建议与业务同内网，8848/9848 不暴露公网

### 下载与解压

```bash
wget https://github.com/alibaba/nacos/releases/download/2.3.2/nacos-server-2.3.2.tar.gz
tar -zxvf nacos-server-2.3.2.tar.gz -C /opt
ln -s /opt/nacos-server-2.3.2 /opt/nacos

# 数据目录
mkdir -p /data/nacos
export NACOS_HOME=/opt/nacos
```

### 单机模式（快速体验）

```bash
# 直接启动（默认 standalone 模式，使用内嵌 Derby）
sh bin/startup.sh -m standalone

# 访问控制台
# http://<IP>:8848/nacos   默认账号：nacos / nacos

# 查看日志确认启动成功
tail -f logs/start.out
```

### 集群模式（生产）

#### 1. 初始化 MySQL

Nacos 自带建表 SQL，2.x 是 `mysql-schema.sql`（与 `conf/nacos-mysql.sql` 同源，按版本选择）：

```bash
mysql -uroot -p < /opt/nacos/conf/mysql-schema.sql
# 执行后生成 nacos_config 库及其表
```

#### 2. 配置 `conf/application.properties`

```properties
# 指定外部 MySQL
spring.datasource.platform=mysql
db.num=1
db.url.0=jdbc:mysql://192.168.1.10:3306/nacos_config?characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=Asia/Shanghai
db.user.0=nacos
db.password.0=nacos123
```

#### 3. 配置集群节点 `conf/cluster.conf`

```bash
# 每行一个节点 IP:port（注意与 node.id 对应；2.2+ 版本需配置 node.id）
# node.id=1,192.168.1.10:8848
# node.id=2,192.168.1.11:8848
192.168.1.10:8848
192.168.1.11:8848
192.168.1.12:8848
```

#### 4. 三节点启动

```bash
sh bin/startup.sh      # 默认集群模式
# 各节点日志确认集群成员：
# logs/naming-server.log 中应看到对等节点列表
```

### 验证

```bash
# 控制台：http://<IP>:8848/nacos
# 服务列表/配置管理页面正常、各节点数据一致即部署成功

# API 验证（服务注册）
curl -X POST 'http://192.168.1.10:8848/nacos/v1/ns/instance?serviceName=test-service&ip=192.168.1.20&port=8080'
# 返回 ok 表示注册成功

# 查看节点状态（集群模式下确认全部在线）
curl 'http://192.168.1.10:8848/nacos/v1/ns/operator/servers'
```

### 常见问题

- **启动报 `Unable to start web server` / 端口冲突**：8848 被占用；或 JDK 版本过低
- **集群节点互相看不到**：`cluster.conf` 配置错误、9849 gRPC 端口不通、各节点 `nacos.core.auth` 或节点 ID 不一致
- **配置发布失败报 Derby 相关错误**：运行的是单机内嵌 Derby 但多实例同时连，或本该集群却起了多个单机实例；检查 `application.properties` 的 MySQL 配置是否生效（启动日志会打印 `Database` 类型）
- **服务注册成功但客户端调用 503**：服务健康检查（心跳）失败，客户端与 9848 端口不通
- **`nacos` 默认密码登录后必须改**：控制台首次登录用 nacos/nacos，生产第一时间修改

### 部署建议

- 生产至少 3 节点集群 + 外接 MySQL（单机 Derby 只用于测试）
- 2.x 客户端与服务端版本尽量一致，gRPC 协议跨大版本不兼容
- 配置变更通过控制台/API 操作，变更记录存 MySQL，天然可审计
- 与 Kubernetes 结合时可用 nacos-k8s 方案，但传统部署仍是主流

## RocketMQ（消息队列）

> RocketMQ 是阿里开源的消息中间件，特点是高吞吐、低延迟、事务消息与顺序消息支持好，国内互联网与政企项目使用广泛。它分 NameServer（路由注册）与 Broker（消息存储）两个角色，部署模板化：装 JDK、解压、改内存参数、起两个进程。本文以 RocketMQ 5.x 为例，覆盖单机与集群两种形态。

### 架构角色

```
Producer / Consumer（业务）
        │
        ▼
NameServer（路由中心，轻量，可多台）
        ▲
        │ 心跳 + 路由
Broker（消息存储，一主一从或多主多从）
```

| 角色 | 职责 | 端口 |
| ---- | ---- | ---- |
| NameServer | 管理 Broker 路由，客户端先连它拿地址 | 9876 |
| Broker | 消息存储与分发，向 NameServer 注册 | 10911（主端口） |
| Broker VIP | 客户端访问 Broker 的 VIP 端口 | 10909（默认开放） |

### 前置条件

- JDK 1.8+（RocketMQ 官方推荐 JDK 8，5.x 支持到 JDK 11+ 但以 8 最稳）
- 内存：官方建议 4GB+（默认启动脚本 Xmx 4g，机器小需调低）
- Linux 建议调大文件句柄与进程数限制

```bash
echo '* soft nofile 655350' >> /etc/security/limits.conf
echo '* hard nofile 655350' >> /etc/security/limits.conf
```

### 下载与解压

```bash
wget https://dlcdn.apache.org/rocketmq/5.1.4/rocketmq-all-5.1.4-bin-release.zip
unzip rocketmq-all-5.1.4-bin-release.zip -d /opt
ln -s /opt/rocketmq-all-5.1.4-bin-release /opt/rocketmq

export ROCKETMQ_HOME=/opt/rocketmq
export PATH=$PATH:$ROCKETMQ_HOME/bin
```

### 单机部署（快速体验）

#### 1. 启动 NameServer

```bash
nohup sh bin/mqnamesrv > /opt/rocketmq/logs/namesrv.log 2>&1 &
# 看到 "The Name Server boot success" 即成功
```

#### 2. 启动 Broker（使用默认配置）

```bash
nohup sh bin/mqbroker -n localhost:9876 \
  -c conf/broker.conf > /opt/rocketmq/logs/broker.log 2>&1 &
# 看到 "The broker boot success" 即成功
```

:::note
内存不足的机器启动失败时，先改启动脚本里的 JVM 参数：`bin/runserver.sh`（NameServer 的 Xmx 默认 4g）与 `bin/runbroker.sh`（Broker 的 Xmx 默认 8g）调小，例如 `-Xms1g -Xmx1g`。
:::


### 生产配置要点（broker.conf）

```properties
# Broker 集群名与自身名字
brokerClusterName=DefaultCluster
brokerName=broker-a
brokerId=0

# 注册给客户端/NameServer 的地址：生产必须填内网 IP，不能留空
brokerIP1=192.168.1.20

# NameServer 列表
namesrvAddr=192.168.1.10:9876;192.168.1.11:9876

# 消息存储目录（放数据盘）
storePathRootDir=/data/rocketmq/store
storePathCommitLog=/data/rocketmq/store/commitlog

# 删除策略：磁盘使用率阈值与保留时长
deleteWhen=04
fileReservedTime=72

# 自动创建 topic（生产建议关闭，Topic 走后台创建）
autoCreateTopicEnable=true
```

:::warning
`brokerIP1` 不配置时 Broker 会注册自己的主机名/IP，客户端在其他机器解析不了就连接失败。这是 RocketMQ 最常见的部署坑，同 Kafka 的 `listeners` 一个道理。
:::


### 验证

```bash
# 查看集群与 Broker 状态
mqadmin clusterList -n localhost:9876
# 应显示 broker-a 与对应的地址、版本

# 命令行收发消息测试
sh bin/tools.sh org.apache.rocketmq.example.quickstart.Producer \
  -n localhost:9876
# 输出 "Send Result: SEND_OK"

sh bin/tools.sh org.apache.rocketmq.example.quickstart.Consumer \
  -n localhost:9876
# 应消费到刚才生产的消息
```

生产环境建议额外部署 `rocketmq-dashboard`（官方 Web 控制台，spring boot 应用）查看 topic、消费组积压与消息详情。

### 集群模式（主从，可扩展）

- **一主一从**：两个 Broker 节点 `brokerName` 相同、`brokerId` 分别为 0 和 1（从节点同配置起 mqbroker 即可），从节点自动同步
- **多主多从**：多组 brokerName 独立的主从对，分担 topic 流量
- NameServer 部署 2~3 台，业务侧 `namesrvAddr` 写全

```bash
# 从节点只需 broker.conf 中 brokerId=1 并指向同一集群
nohup sh bin/mqbroker -n <namesrv>:9876 -c conf/broker-s.conf > broker-s.log 2>&1 &
```

### 常见问题

- **`connect to 127.0.0.1:9876 failed`**：NameServer 没启动或 `namesrvAddr` 写错
- **启动报内存不足（`Could not reserve enough space`）**：默认 JVM 参数 Xmx 太大，改 `runserver.sh`/`runbroker.sh`
- **客户端连不上 Broker（`sendDefaultImpl call timeout`）**：`brokerIP1` 未配置导致注册地址不可达；防火墙 10911/10909 未放行
- **消费积压持续增加**：消费端处理慢或消费失败重试死循环，查看消费组 `mqadmin consumerProgress -n <ns> -g <group>`
- **消息堆积磁盘暴涨**：`fileReservedTime` 保留时间过长、`autoCreateTopicEnable=true` 导致无限自动建 topic

### 部署建议

- 生产：主从成组 + 2 台以上 NameServer，Topic 划分业务隔离
- 存储目录独立数据盘，commitlog 与 consumequeue 分开磁盘效果更好
- 事务消息、延迟消息测试先行，确认 5.x 与业务 SDK 版本兼容
- 监控：Broker 的 `mqadmin` 指标 + 消费积压告警（dashboard 自带）

