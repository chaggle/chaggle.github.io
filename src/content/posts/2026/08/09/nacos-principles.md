---
title: "Nacos 底层原理与知识要点"
published: 2026-08-09T00:00:00+08:00
updated: 2026-08-09T00:00:00+08:00
tags: ["2026", "nacos"]
category: "middleware"
---
> 本文梳理 Nacos 的架构、服务发现（AP/Distro）、配置中心（长轮询）、集群一致性（Raft + Derby/MySQL）、与主流注册中心的对比，以及常见问题的排查思路。

## 概述

Nacos（Dynamic Naming and Configuration Service）是阿里巴巴开源的，同时提供**服务发现**与**配置管理**两大能力的中间件，是 Spring Cloud Alibaba 生态的核心组件。

:::tip
Nacos 的核心卖点是"一个组件解决注册中心 + 配置中心两个问题"，且原生支持 AP（可用性优先）与 CP（一致性优先）双模型切换，比 Zookeeper/Eureka 的组合更简单。
:::


核心概念：

- **命名空间（Namespace）**：用于多环境/多租户隔离，默认 public
- **分组（Group）**：同一命名空间内的逻辑分组，默认 DEFAULT_GROUP，用于区分不同业务域
- **服务（Service）**：逻辑上的服务名，下面挂多个实例（Instance）
- **实例（Instance）**：具体提供服务的地址（ip:port + 元数据），分为临时实例与持久实例

```properties
# 定位一个配置/服务资源的完整标识
namespace + group + service/dataId
```

## 架构与一致性模型

### Server 端双模型

Nacos Server 内部有两种一致性协议，按数据类别分工：

| 数据 | 一致性模型 | 底层协议 | 说明 |
| ---- | ---- | ---- | ---- |
| 注册中心（临时实例） | **AP** | Distro | 多节点异步复制，可用性优先，允许短暂不一致 |
| 注册中心（持久实例） | **CP** | Raft | 强一致，配合健康检查 |
| 配置中心 | **CP** | Raft | 配置必须强一致，防止读到旧配置 |

:::note
Nacos 1.x 的 Raft 是自研简化版（内部依赖轻量级实现），Nacos 2.x 起配置/持久化数据统一采用 **Raft（Jraft）** 实现，并引入了 **gRPC** 通信协议，大幅提升性能。
:::


### 架构角色

- **Server**：Nacos 集群节点，通过 Raft 选主；负责数据存储、健康检查、配置推送
- **Client（SDK）**：业务侧 Java/Go 等 SDK，注册实例、订阅配置、维护心跳；也提供 **OpenAPI**（HTTP）方式接入
- **Console**：控制台，管理命名空间、服务、配置
- 2.x 起客户端与 Server 之间默认走 **gRPC 长连接**（1.x 是 HTTP 短连接 + UDP 推送），每个服务实例一个长连接，服务端主动推送配置变更

:::warning
Nacos 2.x 的 gRPC 长连接是常见问题根源：客户端与服务端之间的连接被防火墙/网关静默断开（半开连接），会导致注册信息不更新、配置收不到推送。排查时优先看 gRPC 端口（默认 9848、9849）是否放通。
:::


## 服务发现

### 注册原理

1. 客户端启动时调用注册接口（SDK `naming.registerInstance` 或 OpenAPI POST `/nacos/v1/ns/instance`）
2. 临时实例注册到**当前连接的 Server 节点**，节点通过 Distro 协议异步同步给其他节点
3. 注册数据放入本地内存 + 定期同步，心跳续约

### 健康检查（双机制）

- **临时实例：客户端主动上报（心跳）**
  - 客户端每 5 秒发一次心跳（`beat`），服务端每 15 秒检查一次，超过 30 秒（默认）未收到心跳则标记不健康并剔除
  - 心跳超时判定、实例剔除都是**每台节点本地执行**，靠 Distro 同步结果
- **持久实例：服务端主动探测**
  - 服务端按配置的检查协议（HTTP/TCP/MySQL 等）主动探测实例健康状态
  - 探测失败按 `healthyCheckTimes` 阈值判定不健康

:::note
临时实例适合"进程级注册"（进程退出即消失），持久实例适合"需要服务端探测"的静态/外部服务（如数据库、跨网络的服务）。默认是临时实例。
:::


### 保护阈值（Protect Threshold）

- 每个服务可设置 `protectThreshold`（0~1，默认 0）
- 当**健康实例数 / 总实例数 < 保护阈值**时，触发保护：不再剔除不健康实例，而是把不健康实例也返回给调用方

:::caution
保护阈值的本意是"防止全部实例被误判下线导致流量打空"（比返回空列表好，至少能尝试调用）。但如果不健康实例真不可用，流量会大量失败。排查"突然出现大量失败调用"时要先看是否触发了保护阈值。
:::


### 订阅与变更感知

- 消费者订阅服务，SDK 通过 gRPC 建立订阅，服务端实例变更时**主动推送**（UDP 广播推送在 1.x；2.x 走 gRPC 推送）
- 客户端本地也做兜底：定期拉取全量实例列表（`failover` 双缓存）

## 配置中心

### 发布与订阅

- **发布**：控制台/OpenAPI/SDK 写入配置，Server 通过 Raft 保证一致后持久化，再通知订阅方
- **订阅**：客户端 `configService.addListener` 注册监听器（Listener），配置变更时回调 `receiveConfigInfo`

### 长轮询机制（Long Polling）

这是 Nacos 配置中心的灵魂：

1. 客户端发起配置拉取请求（带 `dataId + group + content-md5`）
2. 如果本地缓存 md5 与服务端一致（无变化），服务端**挂起请求**（默认 30 秒内不返回）
3. 期间配置被修改 → 服务端立即返回新配置；30 秒内无变化 → 返回"无变化"
4. 客户端拿到结果后，循环发起下一次长轮询

```text
客户端 ---- 长轮询请求(带md5) ----> 服务端
客户端 <---- 立即返回新配置/超时返回无变化 --- 服务端
客户端(有变化) ----> 拉取完整配置
```

:::tip
长轮询的好处：相比纯推送，服务端不需要维护海量连接状态；相比短轮询，几乎无轮询开销，变更感知延迟能做到秒级甚至毫秒级。
:::


### 监听回调与灰度发布

- **Listener**：`addListener` 后，配置变更由内部长轮询线程感知，回调业务代码
- 常见坑：回调内做重逻辑会阻塞配置线程；多个 listener 变更顺序不确定，不要依赖回调顺序
- **灰度发布（Beta 发布）**：指定部分 IP 灰度下发，通过 `publishConfig` 携带灰度规则；灰度发布仅对临时配置有效，正式发布后灰度信息清除

### 配置快照与容灾

- 客户端本地有**配置快照**（默认 `${user.home}/nacos/config`），缓存最近拉取的配置
- Server 全挂时，客户端用本地快照 + `failover` 机制继续提供旧配置，业务不中断
- 服务端配置持久化：内嵌 **Derby**（默认单机，集群共享一份）或外置 **MySQL**

## 集群部署与持久化

### 集群一致性

- **配置中心 / 持久实例：Raft（CP）**
  - 集群选 Leader，写请求走 Leader，过半确认
  - 节点故障（< 半数）不影响写入
- **临时实例注册：Distro（AP）**
  - 每个节点独立承接写请求（无 Leader 瓶颈），本地生效后**异步**复制给其他节点
  - 节点故障期间的数据差异靠定期全量同步 + 心跳续约收敛

:::warning
Distro 是最终一致：刚注册的实例可能在其他节点上要等一小段时间才能被读到（异步复制）。如果服务刚上线就被消费端请求打过来且报"服务不存在"，多半是 Distro 复制延迟 + 本地缓存未刷新。
:::


### Raft 选举

- 基于 Raft 协议：Leader 心跳超时 → 触发选举 → 得票过半当选
- 选举时比较 **term + log index**（日志越新越有资格）
- 集群建议奇数节点（3 台起步），单节点无法满足 CP 写入半数要求（单节点集群会退化为独立模式）

### 数据持久化

- **内嵌 Derby**：默认模式，适合单机/快速体验；多节点共享同一份 Derby 存储时用 `jdbcUrl` 指向同一个数据库（1.x 的集群默认方式是共享 Derby，存在锁问题，2.x 默认每节点独立 Derby，配置走 raft 同步）
- **外置 MySQL**：生产推荐，`application.properties` 配置 `spring.datasource.platform=mysql` 并执行初始化 SQL 脚本；MySQL 高可用（主从）需自行保证

```properties
# conf/application.properties 关键配置
spring.datasource.platform=mysql
db.num=1
db.url.0=jdbc:mysql://127.0.0.1:3306/nacos_config?characterEncoding=utf8
db.user.0=root
db.password.0=root
```

:::caution
Derby 锁问题：1.x 集群多个节点共享同一个 Derby 数据库时，可能出现 `Table 'CONFIG_INFO' in statement is locked` 或写入失败。解决：改用 MySQL，或升级到 2.x 每节点独立 Derby。
:::


## 与 Zookeeper / Eureka / Consul 对比

| 维度 | Nacos | Zookeeper | Eureka | Consul |
| ---- | ---- | ---- | ---- | ---- |
| 能力 | 注册中心 + 配置中心 | 协调服务（可做注册） | 仅注册中心 | 注册 + 配置 + KV |
| 一致性 | AP（临时）/ CP（配置） | CP（ZAB） | AP（无主） | CP（Raft） |
| 健康检查 | 心跳上报 + 服务端探测 | 会话心跳（临时节点） | 客户端心跳 | 服务端探测 |
| 配置中心 | 内置，长轮询 | 可做（watch） | 无 | 内置（KV watch） |
| 协议 | gRPC / HTTP | TCP 长连接 + ZAB | HTTP 心跳 | HTTP + Raft |
| 适用 | Spring Cloud 全家桶 | 强一致协调场景 | 大规模注册（已停维护） | 多数据中心注册 |

:::note
选型建议：

- 追求"注册 + 配置一站式"、Spring Cloud 技术栈 → Nacos
- 需要强一致协调能力（锁、选主）→ Zookeeper
- 纯注册中心、读写都大 → 考虑 Nacos AP 模式或 Consul
- Eureka 已进入维护期，新项目不建议
:::


## 常规问题排查

### 1. 服务上下线不及时

- 现象：服务停止后很久才从列表消失，或新服务迟迟不可见
- 排查：
  - 临时实例靠心跳超时（默认 30 秒），下线延迟正常；调小 `healthCheckTimeout` / 心跳间隔可加快，但会增加误判风险
  - Distro 异步复制延迟：检查集群各节点时间是否同步（NTP），日志是否有 `distro` 同步报错
  - 客户端是否优雅下线（`deregisterInstance`）：kill -9 无法走注销流程，只能等心跳超时
  - 2.x 的 gRPC 连接是否被断开导致服务端感知不到客户端异常

### 2. 配置变更不生效 / 未触发监听

- 现象：改了配置，客户端 `receiveConfigInfo` 没回调，或拿到的还是旧值
- 排查：
  - dataId、group、namespace 三者是否与服务端完全一致（最常见的"改了别的环境的配置"）
  - 客户端是否 `addListener` 后才修改的配置（先监听再发布才有回调）
  - 长轮询线程是否被阻塞（服务端 30s 挂起超时被占用）——看服务端日志 `ConfigChangeNotifyTask`
  - gRPC 半开连接：客户端收到推送但连接已断
  - 检查本地快照是否被手动修改（快照 md5 与服务端不同会导致一直走"拉取"分支的假象）
  - 灰度发布只对灰度 IP 生效，普通实例收不到是正常行为

### 3. 心跳超时实例被剔除

- 现象：实例被误剔除，或总是进 `不健康` 列表
- 排查：
  - 客户端进程 GC 停顿/主线程阻塞导致心跳发送延迟（临时实例 5s 心跳，连续 6 次未收到才剔除，GC 太久会触发）
  - 服务端与客户端时钟偏差过大
  - 服务端负载高、健康检查线程池打满，处理心跳慢——看 Nacos 日志 `health check` 相关 warning
  - 网络抖动：Nacos 所在网络与业务网络之间丢包

### 4. 集群数据不一致

- 现象：不同节点查到的服务实例/配置不一样
- 排查：
  - 临时实例走 Distro：检查节点间 8848（HTTP）/9848（gRPC）互通，`distro` 同步任务是否报错
  - 配置走 Raft：检查是否选了 Leader（`nacos_raft` 相关日志），Leader 挂后是否正常重新选举
  - 检查各节点配置 `cluster.conf` 是否一致、节点间时钟同步
  - 持久实例走 Raft，如果发现不一致，优先看 Raft 日志是否有 snapshot 恢复失败

### 5. Derby 锁问题

- 现象：控制台/服务端日志报 `Table 'xxx' is locked`、`Unable to obtain lock`
- 原因：1.x 集群多节点共享 Derby
- 处理：迁移到 MySQL（执行 `conf/mysql-schema.sql`），或升级 2.x

### 6. 保护阈值触发导致无可用实例

- 现象：突然大量调用失败，但服务列表里实例"看起来都在"
- 排查：
  - 查看服务详情页的**保护阈值**设置与健康实例比例
  - 保护触发后不健康实例也会被返回，调用方需自行做失败重试/熔断
  - 阈值设置过高（如 0.9）会在正常波动时误触发，建议结合健康实例数合理设置

### 7. 灰度发布失效

- 现象：灰度发布后，目标 IP 没收到灰度配置，或全量实例都收到灰度配置
- 排查：
  - 灰度发布基于 IP 列表匹配，确认服务端拿到的客户端 IP 是否正确（经过代理/网关后取到的是代理 IP）
  - 灰度配置只对临时配置生效，检查是否误把配置改成正式发布
  - 灰度期间又做了正式发布，灰度信息会被覆盖清除

### 8. 与 Spring Cloud Alibaba 集成问题

- 现象：`No Feign Client for loadBalancing defined`、`Config not found`、`NacosException: Client not connected`
- 排查：
  - 版本兼容：Spring Boot / Spring Cloud / Spring Cloud Alibaba 版本必须按官方对应矩阵（如 Spring Cloud 2021.x 配 Alibaba 2021.0.x）
  - 连接失败：检查 `nacos.config.server-addr`、`nacos.discovery.server-addr` 是否正确，2.x 需放通 9848/9849 gRPC 端口
  - 配置优先级：`bootstrap.yml` 中的配置要早于业务配置，`spring.cloud.nacos.config` 前缀不要拼错
  - `NacosException: Client not connected`：多半是 gRPC 长连接被断，检查防火墙/负载均衡对长连接的空闲断开策略

## 小结

- 架构上记住"命名空间/分组/服务三层隔离，Server AP+CP 双模型，Client 走 gRPC"
- 服务发现记住"临时实例心跳上报（AP），持久实例服务端探测（CP），保护阈值兜底"
- 配置中心记住"长轮询 + md5 比对 + Listener 回调 + 本地快照容灾"
- 集群记住"配置 Raft 强一致，临时实例 Distro 最终一致，生产用 MySQL 持久化"
- 排查问题的第一直觉：**先看 gRPC 连接是否正常，再看 dataId/group/namespace 是否对齐，最后看 AP/CP 同步日志**
