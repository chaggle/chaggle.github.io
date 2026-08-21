---
title: "雪花算法"
published: 2022-04-11T17:14:16+08:00
updated: 2022-04-11T17:14:16+08:00
tags: ["snowflake"]
category: "middleware"
---
> 主要学习 Twitter 开源的雪花算法。

## 介绍

雪花算法是 Twitter 公司开源的、由 64 bit 整数组成的分布式 ID，并且在单机上递增！

snowflake 64 bit 的结构如下图所示：

![snowflake](/images/middleware/snowflake.png)

如图：

1、雪花算法默认左起第一位应该是 0，第一位在实际中并无任何作用。

2、从第一位之后的 41 位都是时间戳，单位为 ms，能容纳 69 年的时间。以某个时间点为基准，基准可以自行设置，偏移量为其中的 41 位的数值。

3、第 43 - 52 位，十位是工作机器的 ID 号，因为是分布式的算法，所以应该支持多台机器。从左开始的五位表示数据中心的 ID，后五位表示工作节点的 ID，最多容纳 1024 个节点。

4、剩下 12 位为序列号，记录同毫秒内产生不同的 ID。每个节点每毫秒从 0 开始不断累加，最多累加 4095。

故 1 ms 内最多产生 1024 x 4096 = $2^{22}$ 个不同的 ID 号。

## 实现

### [bwmarrin/snowflake](https://github.com/bwmarrin/snowflake)

Go 语言的原生雪花算法实现。

### [sony/sonyflake](https://github.com/sony/sonyflake)

sony 公司实现的 sonyflake，在 snowflake 的基础上进行修改，基本的实现原理跟 snowflake 差不多，如下图：

![sonyflake](/images/middleware/sonyflake.png)

sonyflake 主要是修改了时间戳，计量单位变为了 10 ms，所以可记录的时间延长为 174 年。sequence ID 跟之前的定义一致，Machine ID 即是节点的 ID 值。
