---
title: "DataX 适配 Kerberos Hadoop/Hive 集群：从 hdfsreader 到 hdfswriter 的踩坑实录"
published: 2026-08-21T18:40:00+08:00
updated: 2026-08-21T18:40:00+08:00
tags: ["2026", "datax", "hive", "hdfs", "kerberos"]
category: "bigdata"
---

> 上一篇博客讲了 DolphinScheduler 怎么接入 Kerberos 认证的 Hive（数据源配置层面）。这次继续往链路深处走：调度平台里的 DataX 任务要真正读写 Kerberos 集群的 HDFS/Hive，官方开源版 DataX 直接跑不通，本文记录从 hdfsreader 读到 hdfswriter 写、再到 GBase 8c 反向推 Hive 的完整适配过程与排错结论。

## 一、先看结论

官方 DataX 默认依赖 Hadoop 2.7.1 + Hive 1.1.1 + fastjson 1.x，而实际集群是 Hadoop 3.3.6 + Hive 3.1.3，且服务器发行版做了 fastjson2 改造。五个硬伤逐层暴露，每层都有对应的修复动作：

| # | 现象 | 根因 | 修复 |
|---|---|---|---|
| 1 | `UnknownHost nameservice1` / 表找不到 | defaultFS 与 hadoopConfig 的 nameservice 前缀不一致 | 统一 ns 名，配全 HA 五个配置项 |
| 2 | DataNode 全部 `连接被对方重设`（RST） | Kerberos 集群 DataNode 数据传输默认 SASL，客户端明文握手被拒 | hadoopConfig 加 `dfs.data.transfer.protection: authentication` |
| 3 | `ClassCastException: JSONObject cannot be cast to JSONObject` | 发行版 datax-common 已 fastjson2 化，插件源码还是 fastjson1 | 源码 import 改 fastjson2 + pom 显式加 fastjson2 2.0.23 |
| 4 | `unrecognized Hadoop major version number: 3.3.6` | hive-exec 1.1.1 的 shims 不识别 Hadoop 3.x | hive.version 升 3.1.3，删 hive-service / hive-hcatalog-core |
| 5 | 插件包内新旧版本并存 | maven-assembly 增量输出不清理 | 打包前手动删残留 jar（注意别误删 hadoop 3.x 的 shaded 依赖） |

hdfswriter 在 hdfsreader 的全部适配之上还多了两个坑：parquet 依赖要靠 hive-hcatalog-core 传递、删掉后就断了；parquet 1.8 之后包名从 `parquet.schema.*` 迁到 `org.apache.parquet.schema.*`，源码 import 必须同步改。

## 二、30 秒看懂 DataX 的插件类加载

DataX 每个插件（reader/writer）独立目录、独立 classloader（child-first）：插件 `libs/` 里的 jar 优先于全局 `lib/`。这一条解释了后面几乎所有"版本冲突"：

- 插件 libs 里的 `datax-common` 若带旧 fastjson，会反向污染全局——**插件包内禁止打 datax-common**；
- 服务器发行版的 `datax-common` 是 fastjson2 改造版（`datax/lib/fastjson2-2.0.23.jar`），所以插件源码必须按 fastjson2 编译。

另外 rdbmsreader 有个特殊机制：插件初始化时读 `plugin.json` 的 `drivers` 数组，逐个 `Class.forName` **预加载**，任何一个类缺失直接抛 `数据库驱动加载错误`——即使任务根本不用那个驱动。

## 三、hdfsreader：读 Kerberos HDFS 的五层修复

### 3.1 nameservice 全套配置

defaultFS 的 ns 名必须与 hadoopConfig 的 `dfs.nameservices` 前缀完全一致，且 HA 五个配置项缺一不可：

```json
"defaultFS": "hdfs://nameservice1",
"hadoopConfig": {
  "dfs.nameservices": "nameservice1",
  "dfs.ha.namenodes.nameservice1": "nn1,nn2",
  "dfs.namenode.rpc-address.nameservice1.nn1": "10.0.0.1:8020",
  "dfs.namenode.rpc-address.nameservice1.nn2": "10.0.0.2:8020",
  "dfs.client.failover.proxy.provider.nameservice1": "org.apache.hadoop.hdfs.server.namenode.ha.ConfiguredFailoverProxyProvider",
  "hadoop.security.authentication": "kerberos",
  "dfs.data.transfer.protection": "authentication"
}
```

### 3.2 dfs.data.transfer.protection 是 RST 的根因

现象最有迷惑性：三个 DataNode 全部 `Failed to connect to /10.x.x.x:1025 ... 连接被对方重设`，换 2.7.1 客户端也一样。集群内 `hdfs dfs -cat` 却能读——先隔离"客户端问题 vs 集群问题"，再猜原因。

根因：Kerberos 集群 DataNode 数据传输默认 SASL 保护（`authentication`），DataX 客户端没声明传输保护，以明文握手直接被 DataNode 拒绝（RST）。补上 `dfs.data.transfer.protection: authentication` 后日志立刻出现「是[orc]类型的文件」，block 读取成功。

### 3.3 文件格式必须对齐（ORC 魔数）

Hive 默认建表即 ORC，`hdfs dfs -cat` 看到文件头魔数 `ORC`。fileType 配错（写成 text）会在探测阶段误判。读侧按 `fileType: "orc"` 配。

### 3.4 fastjson2 双向冲突

发行版 datax-common 已 fastjson2 化，而 hdfsreader / plugin-unstructured-storage-util 源码还是 fastjson1，运行时报 `ClassCastException: com.alibaba.fastjson2.JSONObject cannot be cast to com.alibaba.fastjson.JSONObject`。

修复三件套：
1. `DFSUtil.java`、`UnstructuredStorageReaderUtil.java` 的 import 改 `com.alibaba.fastjson2.*`；
2. 两个模块 pom 显式加 `fastjson2:2.0.23`；
3. 插件包内删除 datax-common（避免 child-first 加载到旧版 common）。

### 3.5 hive 版本与打包残留

- hive-exec 1.1.1 的 shims 不识别 Hadoop 3.x（`unrecognized Hadoop major version number`），升 3.1.3 并**去掉 hive-service、hive-hcatalog-core** 两个重型依赖（会拉入 Hadoop 2.x 旧 jar）；
- maven-assembly 增量输出不会清理 target/datax，版本升级后新旧 jar 并存（曾出现 19 个 1.1.1 残留），打包前必须手动清理；
- 清理时注意：`hadoop-shaded-guava-1.1.1`、`hadoop-shaded-protobuf_3_7-1.1.1` 是 Hadoop 3.3.6 的正常依赖（版本号恰好也是 1.1.1），**别误删**，只匹配 `hive.*1.1.1` 与 `hcatalog`。

## 四、hdfswriter：写侧多出的两个坑

### 4.1 parquet 依赖断裂

hdfswriter 源码 import 了 `parquet.schema.*`，原依赖靠 hive-hcatalog-core 传递。删除重型依赖后必须显式补：

```xml
<dependency>
    <groupId>org.apache.parquet</groupId>
    <artifactId>parquet-hadoop</artifactId>
    <version>1.10.1</version>
</dependency>
```

### 4.2 parquet 包名迁移

光有 jar 不够：parquet 1.8 之后包名从 `parquet.schema.*` 迁到 `org.apache.parquet.schema.*`。本地 javac 单测即可复现「程序包parquet.schema不存在」，4 处 import（`MessageTypeParser` / `OriginalType` / `PrimitiveType` / `Types`）必须改，否则 classpath 里明明有 jar 也编不过。

### 4.3 fieldDelimiter 无条件必填

hdfswriter 的 `fieldDelimiter` 在 Job 初始化时强制校验（null 直接抛 `REQUIRED_VALUE`，且仅支持单字符），**不区分文件格式**——即使写 ORC 也必须填 `"\t"` 或 `","`（列式存储实际不依赖它，但源码强制）。

## 五、反向场景：GBase 8c 推 Hive

目标变为：从 GBase 8c（openGauss/PostgreSQL 内核）读表，写 Kerberos 集群 Hive（ORC）。方向反过来，适配成果直接复用：

- **reader 换 rdbmsreader**（GBase 8c 是 PG 系，不能用 8a 的 gbasereader）。驱动选 openGauss 官方 JDBC（`opengauss-jdbc`，驱动类 `org.postgresql.Driver`），jdbcUrl 写 `jdbc:postgresql://host:5432/db`——DataX 的 `DataBaseType` 枚举按 URL 前缀匹配驱动，PG 是内置支持，**插件源码与 plugin.json 都不用改**；
- **writer 用已适配的 hdfswriter**，JSON 侧与第三章完全相同。

排错中踩到发行版的隐藏机制：任务一启动就报 `ClassNotFoundException: org.apache.hive.jdbc.HiveDriver`——服务器版 `rdbmsreader/plugin.json` 的 `drivers` 数组**比源码版多了 Hive 驱动**，`Class.forName` 预加载缺类直接失败，与任务是否用 Hive 无关。补齐 `hive-jdbc-*-standalone.jar` 后进入下一层：

```
No suitable driver found for jdbc:postgresql://...
```

这一层说明 `org.postgresql.Driver` 根本没进 classpath——检查 `rdbmsreader/libs/` 确认 openGauss 驱动 jar 是否真的放到位。逐层排查的顺序本身也是经验：**先让 plugin.json 的 drivers 全部能 Class.forName，再谈具体连接**。

## 六、一页速记

```text
hdfsreader / hdfswriter 适配：
  pom: hadoop 3.3.6 + hive 3.1.3
       删 hive-service / hive-hcatalog-core
       hadoop-aliyun 排除 hadoop 传递
       fastjson2 2.0.23（源码 import 同步改）
       hdfswriter 另加 parquet-hadoop 1.10.1 + import 改 org.apache.parquet.schema.*
  打包: 清 hive.*1.1.1 与 hcatalog 残留（别动 hadoop-shaded-*1.1.1）
        删插件 libs 里的 datax-common
  JSON: hadoopConfig 全套 nameservice + dfs.data.transfer.protection=authentication
        fileType 按文件魔数（ORC）配
        fieldDelimiter 必填单字符（ORC 也要）

GBase 8c → Hive：
  reader = rdbmsreader + opengauss-jdbc（org.postgresql.Driver）
  jdbcUrl 前缀必须 jdbc:postgresql://
  发行版 plugin.json 的 drivers 数组可能含 HiveDriver，
  先保证 drivers 全部可加载，再排查具体连接

排错顺序：
  RST / 连接被重设 → 查 dfs.data.transfer.protection
  ClassCastException fastjson → 查插件 libs 与 datax/lib 版本
  unrecognized Hadoop major version → 查 hive-exec 版本
  驱动加载错误 ClassNotFound → 查 plugin.json drivers 与 libs jar
  No suitable driver → 查驱动 jar 是否真在 libs
```

## 参考资料

1. [DataX 官方仓库（GitHub）](https://github.com/alibaba/DataX)
2. [DataX rdbmsreader 文档（GitHub）](https://github.com/nehcuh/DataX/blob/master/docs/rdbmsreader.md)
3. [hdfswriter 源码与 assembly 打包结构（GitHub）](https://github.com/alibaba/DataX/tree/master/hdfswriter)
4. [修复 rdbmsreader 插件 plugin.json 驱动加载问题（GitHub commit）](https://github.com/dellaxing/DataX/commit/d763fa33c6ab6b289ad288aaa0f650a01c6ac6a9)
5. [HiveServer2 Security Configuration（Cloudera）](https://docs-archive.cloudera.com/documentation/enterprise/5-7-x/topics/cdh_sg_hiveserver2_security.html)
6. [Apache Parquet 版本与包名迁移说明（GitHub）](https://github.com/apache/parquet-java)
7. [openGauss JDBC 驱动（Maven Central）](https://repo1.maven.org/maven2/org/opengauss/opengauss-jdbc/)
