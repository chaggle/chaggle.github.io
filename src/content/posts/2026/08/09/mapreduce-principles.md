---
title: "MapReduce 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "mapreduce"]
category: "bigdata"
---

> 学大数据绕不开 MapReduce，它是 Hadoop 分布式计算的基石。这篇文章是我对 MapReduce 底层原理的总结，从计算模型讲到执行流程，再到参数调优和常见问题排查，希望能帮你把这块知识串起来。

## 计算模型：Map / Reduce 思想

MapReduce 的核心思想就四个字：**分而治之**。把一个大规模计算任务拆成无数个小任务，分发给集群中的多台机器并行处理，最后再汇总结果。

- **Map（映射）**：把输入数据转换为一组 `(key, value)` 键值对，即"分"的过程，天然可并行。
- **Shuffle（洗牌）**：框架自动完成，把 Map 输出的数据按 key 分组、排序、传输到 Reduce 端。
- **Reduce（归约）**：对相同 key 的数据做聚合运算，即"合"的过程。

:::tip
MapReduce 对外只暴露 Map 和 Reduce 两个接口，中间最复杂的 Shuffle 过程完全由框架封装，这也是它好上手的原因。
:::


### WordCount 经典流程

以最经典的词频统计为例，完整流程如下：

1. **输入**：文件被切分成多个 split，每行文本作为一条记录输入 Map。
2. **Map 阶段**：对每一行按空格切词，输出 `(word, 1)`，比如 `(hello, 1)`。
3. **Shuffle 阶段**：框架把所有 `hello` 的 key 分到同一组，排序后传给同一个 Reduce。
4. **Reduce 阶段**：对 `(hello, [1,1,1,1])` 做求和，输出 `(hello, 4)`。
5. **输出**：写入结果文件。

```text
输入: "hello world hello hadoop world"
Map 输出: (hello,1) (world,1) (hello,1) (hadoop,1) (world,1)
Shuffle:  分组排序 -> hello:[1,1] world:[1,1] hadoop:[1]
Reduce:   (hello,2) (world,2) (hadoop,1)
```

## 执行流程详解

一个 MapReduce Job 的执行可以分成五大阶段：Input Split、Map、Shuffle、Reduce、Output。

### 1. Input Split（输入分片）

- 输入文件会被逻辑切分成若干个 **split（分片）**，每个 split 对应一个 Map Task。
- split 与 HDFS 的 **block（块）** 有关系但不等同：block 是 HDFS 存储层的物理概念（默认 128MB），split 是计算层的逻辑概念。
- 默认情况下 split 大小与 block 对齐（128MB），目的是保证 **数据本地性**——Map 任务可以在存储该数据的节点上运行，避免网络传输。
- 每个 split 会切成多条记录（record），`(key, value)` 形式喂给 Map，比如 TextInputFormat 中 key 是行偏移量、value 是一行文本。

:::warning
split 切分时如果一条记录横跨两个 split，会有一个小的"边界重叠"（默认 split 可以跨 block 边界读取），这导致一个文件最多会多出一个小分片，小文件过多时特别明显。
:::


### 2. Map 阶段

- Map 读入 `(key, value)` 调用用户自定义的 `map()` 方法，输出新的 `(key, value)`。
- Map 的输出**先写入环形缓冲区（内存）**，不会直接落盘，只有溢写（spill）时才写本地磁盘。
- 环形缓冲区默认 100MB（由 `mapreduce.task.io.sort.mb` 控制），当使用量达到阈值（默认 80%，即 `mapreduce.map.sort.spill.percent`）时，后台线程开始溢写。

### 3. Shuffle 阶段（重头戏）

Shuffle 是 MapReduce 的精华，也是性能瓶颈最常出现的地方，包括：分区、排序、合并、压缩、溢写、归并六个动作。

**Map 端 Shuffle：**

- **分区 Partition**：每个 key 通过 Partitioner 决定进入哪个分区（默认按 key 的 hash 对 Reduce 数量取模），每个分区对应一个 Reduce Task。
- **排序 Sort**：溢写前先按 key 排序，默认只按 key 排序，可以配置二次排序（key + value 联合排序）。
- **合并 Combine**（可选）：Map 端先做一次局部聚合，减少网络传输量，比如 `(hello,1)(hello,1)` 可以先合并成 `(hello,2)`。注意 Combiner 的输入输出类型必须与 Reduce 一致，且只适用于**满足交换律和结合律**的聚合（如求和、取 max，但不适合求平均值）。
- **压缩**（可选）：通过 `mapreduce.map.output.compress` 开启中间结果压缩，比如 Snappy，大幅减少磁盘 IO 和网络传输。
- **溢写 Spill**：缓冲区满后把数据写入本地磁盘，生成溢写文件。
- **归并 Merge**：多个溢写文件在 Map 结束时合并成一个大文件（同时做分区内排序），并建立索引方便 Reduce 拉取。

**Reduce 端 Shuffle：**

- Reduce Task 启动后，启动 copy 线程从各 Map 端**拉取属于自己分区的数据**，边拉边做归并。
- 拉取的数据先放内存缓冲区，内存不够时写磁盘，最终把多个 map 的输出归并成一个有序的输入喂给 `reduce()` 方法。

```text
Map 端:  环形缓冲 -> 分区 -> 排序 -> (combine) -> (压缩) -> 溢写 -> 归并
                                                   |
Reduce 端:  <------ 拉取自己分区数据 ------ 内存/磁盘归并 -> 分组有序输入 -> reduce()
```

### 4. Reduce 阶段

- `reduce()` 收到 `(key, value迭代器)`，把相同 key 的 value 做聚合，输出结果。
- Reduce 完成后把结果写入 HDFS（通过 OutputFormat），每个分区输出一个文件，命名如 `part-r-00000`。

### 5. Output 输出

- 输出通过 OutputFormat 控制，默认 TextOutputFormat 每行一条记录，`key \t value` 格式。
- 输出文件写入 HDFS 通常为 3 副本，直接面向用户或下游任务。

## 核心机制

### Job / Task 概念

- **Job**：一个完整的 MapReduce 程序（如一次 WordCount），包含多个 Task。
- **Task**：Job 的最小执行单元，分为 **Map Task** 和 **Reduce Task**，Task 内部又划分为 `setup -> map/reduce -> cleanup` 三阶段。
- Task 运行在 **YARN 的 Container** 里，一个 Container 就是一个任务的计算资源（内存 + CPU）。

### 容错机制

- **Task 失败重试**：Task 运行失败后由 ApplicationMaster（AM）重新调度执行，默认重试 4 次（`mapreduce.map.maxattempts` / `mapreduce.reduce.maxattempts`），重试次数耗尽则整个 Job 失败。
- **推测执行（Speculative Execution）**：当某个 Task 运行速度明显慢于同 Job 其他 Task（"拖后腿"），AM 会在另一台机器上**启动一个相同的备份任务**，谁先跑完用谁的结果，后完成者直接 kill。这能有效缓解集群不均衡问题，但会浪费资源，对反复失败的机器反而加重负担。
- **AM 失败**：AM 自身失败后由 YARN ResourceManager 重新启动，恢复任务状态（Hadoop 2.x 支持 AM 自动恢复）。

### 数据本地性（机架感知调度）

- 计算移动比数据移动成本低，所以调度器优先把 Task 调度到**数据所在的节点**（Node-local），其次同一机架（Rack-local），最后才是跨机架（Off-rack）。
- 这依赖 **机架感知（Rack Awareness）**：HDFS 知道每个节点的机架位置，调度时据此决策。

:::note
数据本地性层级：Node-local（数据在本地磁盘）> Rack-local（数据在同机架其他节点）> Off-rack（跨机架）。层级越低，网络传输越多，Job 越慢。
:::


### Combiner 与 Partitioner 的区别

这是面试高频考点，二者完全不同：

- **Combiner**：Map 端的**本地 reducer**，对 map 输出做预聚合，发生在 Map 端、Reduce 之前，目的是**减少网络传输量**。可选组件，逻辑必须可交换可结合。
- **Partitioner**：决定每个 `(key, value)` **进入哪个分区**（哪个 Reduce Task），发生在 Map 端溢写之前。默认 HashPartitioner 按 key hash 取模，可自定义实现数据分发策略（比如让某个 key 单独进一个分区）。

:::caution
Combiner 的聚合逻辑是"预聚合"，最终结果必须和不用 Combiner 一致，否则会算错。典型的反例是求平均值：两个分片的局部平均值不能直接再平均。
:::


### Writable 序列化

- Hadoop 不直接使用 Java 原生的 Serializable，而是自己实现了 **Writable** 序列化机制。
- 原因：Java 序列化会携带大量类信息、对象结构等冗余，序列化结果体积大；Writable 只序列化字段值，**体积小、速度快**，适合大规模网络传输和磁盘写入。
- 常用类型：`IntWritable`、`LongWritable`、`Text`、`DoubleWritable` 等，自定义数据类型需要实现 `Writable` 接口（序列化/反序列化顺序要一致）。
- 若 key 参与排序，还需实现 `WritableComparable` 接口（compareTo 方法）。

## InputFormat / OutputFormat

InputFormat 负责**切分输入数据 + 解析记录**，OutputFormat 负责**写出结果**。都是可插拔的，通过 `job.setInputFormatClass()` / `job.setOutputFormatClass()` 指定。

常见 InputFormat：

- **TextInputFormat**（默认）：按行读取，key 为行偏移量（LongWritable），value 为一行内容（Text）。
- **KeyValueTextInputFormat**：每行按分隔符（默认 tab）拆成 key-value。
- **SequenceFileInputFormat**：读取二进制 SequenceFile，适合 MR 与 MR 之间的中间结果，不解析成文本，效率更高。
- **CombineFileInputFormat**：把小文件合并成一个 split，专治小文件过多的问题。

常见 OutputFormat：

- **TextOutputFormat**（默认）：每行一条 `key\tvalue`。
- **SequenceFileOutputFormat**：输出二进制 SequenceFile，供下游 MR 直接读。
- **MultipleOutputs**：按条件输出到不同文件/目录。

## 重要参数介绍

:::note
下面是我常用的核心参数，调优时优先关注这些，其他参数按需再查。
:::


**资源类：**

```text
# 单个 Map Task 的内存上限（MB），默认 1024
mapreduce.map.memory.mb=1024

# 单个 Reduce Task 的内存上限（MB），默认 1024
mapreduce.reduce.memory.mb=1024

# 单个 Map Task 申请的虚拟 CPU 核数，默认 1
mapreduce.map.cpu.vcores=1
```

**Shuffle / 排序类：**

```text
# Map 端排序缓冲区大小（MB），默认 100，通常配合调大 memory.mb
mapreduce.task.io.sort.mb=100

# 缓冲区溢写阈值（百分比），默认 0.80，即缓冲区用到 80% 时开始溢写
mapreduce.map.sort.spill.percent=0.80

# Reduce 端 shuffle 拉取数据的内存占比，默认 0.70（mapreduce.reduce.shuffle.parallelcopies 控制并行 copy 线程数，默认 5）
```

**任务数 / 重试类：**

```text
# 手动指定 Reduce 数量（默认为 1），生产上常设为节点数或合理估算值
mapreduce.job.reduces=10

# Map Task 最大重试次数，默认 4，超限则 Job 失败
mapreduce.map.maxattempts=4
```

**推测执行类：**

```text
# Map / Reduce 推测执行开关，生产上默认开启，一般不建议关
mapreduce.map.speculative=true
mapreduce.reduce.speculative=true
```

**Combiner / 压缩类：**

```text
# 指定 Combiner 类（和 reducer 类相同则 job.setCombinerClass）
# 中间结果压缩（Map 端输出，强烈建议开启）
mapreduce.map.output.compress=true
mapreduce.map.output.compress.codec=org.apache.hadoop.io.compress.SnappyCodec
```

:::warning
`mapreduce.job.reduces` 不设置时默认只有 1 个 Reduce，大量小数据全部压到一个任务里，既慢又容易 OOM，集群大时千万别忘设置。
:::


## 常见问题排查

### 1. 数据倾斜

**现象**：某个/某几个 Reduce 跑得特别慢，其他 Reduce 早早就结束了；或单个 Map 处理的数据量异常大。

**原因**：key 分布不均，比如热词、空 key、业务上某个 key 天然占大头；Partitioner 取模后多对一。

**解决**：

- 空 key 加随机前缀后再分区，结果再处理。
- 热点 key 先做两阶段聚合（局部聚合 + 全局聚合）。
- 自定义 Partitioner，让热点 key 均匀分散。
- 增大 Reduce 数量只能缓解，不能根治。

### 2. OOM（内存溢出）

**现象**：Container 被杀，报 `Container killed by the ApplicationMaster` 或 GC 异常。

**原因**：`mapreduce.map.memory.mb` 设置过小，或数据量超过预期。

**解决**：

- 调大 `mapreduce.map.memory.mb` / `mapreduce.reduce.memory.mb`，同时调大 YARN 侧 `yarn.nodemanager.resource.memory-mb` 和 `yarn.scheduler.maximum-allocation-mb`。
- 调大 `mapreduce.task.io.sort.mb` 需同步调大容器内存，因为缓冲区从容器堆内存中分配。
- 检查代码里是否有不必要的对象缓存，尽量流式处理。

### 3. 小文件过多

**现象**：Job 启动的 Map Task 数量巨大、元数据撑爆 NameNode、启动开销远超计算时间。

**原因**：一个文件（split）对应一个 Map，百万个小文件就是百万个 Map Task。

**解决**：

- 用 `CombineFileInputFormat` 把小文件合并成少量 split。
- 源头治理：上游合并输出、定期归档小文件（HDFS 层面合并）。
- 输出端避免产生太多小分区文件。

### 4. Shuffle 慢

**现象**：Job 时间大部分耗在 shuffle，Map 结束后 Reduce 端迟迟不结束。

**解决**：

- 开启中间结果压缩（Snappy），减少磁盘 IO 和网络传输。
- 调大 `mapreduce.reduce.shuffle.parallelcopies`，提高并发拉取。
- 合理使用 Combiner 减少传输量。
- 确认 Map 端溢写次数是否过多（溢写次数 = shuffle 垃圾），调大 sort buffer。

### 5. Reducer 数量设置不当

- **过多**：每个 Reduce 处理数据量小，任务启动/调度开销占比大，输出文件碎片化。
- **过少**：单个 Reduce 压力大，慢、OOM、输出文件过大。
- **经验值**：`Reduce 数 ≈ 节点数 × 每节点 1~2 个`，或者按 `总数据量 / 单 Reduce 处理量（约 1GB）`估算。

### 6. 任务卡住 / 重复执行

**现象**：进度一直卡在 66.6% 等数字不动，或日志显示同一 Task 反复执行。

**原因**：

- 代码逻辑死循环、等待外部资源（如连接数据库）。
- Task 反复失败但没超重试上限，被 AM 反复调度。
- 数据本地性差，大量 Task 等待传输；或节点宕机后任务重新调度。
- Speculative 启动的备份任务互相竞争，资源紧张时拖慢整体。

**排查**：看 AM/Container 日志（`yarn logs -applicationId`），确认是失败重试还是慢任务；检查节点资源水位；必要时关闭推测执行观察。

### 7. 本地化率低

**现象**：大量 Map Task 在非数据所在节点运行，网络传输量大，Job 慢。YARN 的 `yarn-clusters` 或 ResourceManager 界面可以看本地化率。

**原因**：split 与 block 不对齐、节点宕机/资源不足、调度器未开启延迟调度、数据刚写入尚未就绪。

**解决**：

- 保证输入文件块大小与 split 对齐（默认 128MB 即可）。
- 检查数据是否使用 Erasure Coding 或副本数导致本地化失效。
- 调整 YARN 调度器配置（开启 `yarn.scheduler.capacity.node-locality-delay` 等延迟调度参数，给本地化一些等待时间）。

## 总结

:::tip
MapReduce 的脉络其实很清晰：**分（InputSplit + Map）→ 洗（Partition + Sort + Merge + 网络传输）→ 合（Reduce）→ 出（Output）**。把 Shuffle 六个动作的时序搞清楚，参数就都串起来了；把任务失败、倾斜、OOM 这几个高频问题的特征记牢，生产排查就不慌。
:::


最后提醒一点：现在大部分场景下 Flink、Spark 已经取代 MapReduce 成为主流，但 MapReduce 的分区、排序、归并、推测执行、本地性这些思想被大量沿用，理解它依然是深入大数据的必修课。
