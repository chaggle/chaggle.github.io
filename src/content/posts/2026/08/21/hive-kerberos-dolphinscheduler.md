---
title: "DolphinScheduler 接入 Kerberos 认证 Hive：从 KDC 到数据源测试连接"
published: 2026-08-21T00:00:00+08:00
updated: 2026-08-21T00:00:00+08:00
tags: ["2026", "dolphinscheduler", "hive", "kerberos"]
category: "bigdata"
---

> 一篇讲透 DolphinScheduler 接 Kerberos Hive 的全链路：底座怎么开 Kerberos、凭据怎么分发到调度节点、数据源表单里 principal / keytab / other 怎么填、常见报错怎么定位。文章写作前对标了开源社区已有博客与官方文档，把"底座开启"和"调度平台接入"两张拼图接上了。

## 一、先看结论

社区里"开启 Hive Kerberos"和"DolphinScheduler 接 Hive"的资料都不缺，但普遍是两段分离的：要么只讲 KDC、keytab、beeline 验证，要么只讲调度平台表单怎么填，中间"凭据怎么到调度节点、进程怎么登录、JDBC URL 怎么拼"这一截经常被一笔带过。

本文把链路串成五步：

```text
底座核对/开启 Kerberos
  → 调度节点准备凭据与进程登录配置
  → 数据源表单填值
  → 测试连接与验证
  → 按报错特征定位
```

参考的主要社区资料（详见文末）：

- [Apache DolphinScheduler 官方 Hive 数据源文档](https://apache.googlesource.com/dolphinscheduler-website/+show/refs/heads/history-docs/docs/2.0.9/docs/zh/guide/datasource/hive.md)（现行版见 [GitHub](https://github.com/apache/dolphinscheduler/blob/136a1830187509c465236274b2e9e423ee13075f/docs/docs/en/guide/datasource/hive.md)）
- CSDN《[Kerberos 安全认证-连载10-Hive Kerberos 安全配置及访问](https://blog.csdn.net/qq_53058639/article/details/139338696)》
- Cloudera《[HiveServer2 Security Configuration](https://docs-archive.cloudera.com/documentation/enterprise/5-7-x/topics/cdh_sg_hiveserver2_security.html)》
- DolphinScheduler Issue [#17413](https://github.com/apache/dolphinscheduler/issues/17413)、[#7964](https://github.com/apache/dolphinscheduler/issues/7964)

## 二、30 秒看懂 Kerberos：三个身份别混

| 概念 | 含义 | 本文示例 |
| ---- | ---- | ---- |
| KDC | 密钥分发中心，存所有 principal 和密钥 | `kdc.example.com` |
| realm | Kerberos 域，通常大写 | `HADOOP.COM` |
| principal | 身份名 `name/instance@REALM` | 见下方三个身份 |
| keytab | 存 principal 密钥的文件，相当于"免密身份证" | `*.keytab` |
| TGT | 客户端登录 KDC 后拿到的"临时通行证" | `kinit` 后缓存于 `/tmp/krb5cc_*` |
| service ticket | 访问某个服务（HS2）的短期票据 | `kvno hive/slave01@HADOOP.COM` |

**一次 JDBC 连接会用到的三个身份：**

1. **服务身份（HiveServer2 / Metastore）**：`hive/<服务节点hostname>@HADOOP.COM`
   ——写在底座 `hive-site.xml` 和服务端 keytab 里，也写在 JDBC URL 的 `principal=` 参数里。
2. **客户端 / 调度平台身份（headless）**：`ds-hive@HADOOP.COM`（名字可自取）
   ——写在 DolphinScheduler 的 `common.properties` / 环境变量里，进程启动时用 keytab 登录。
3. **数据源表单里的独立 principal 字段与 other 参数**：二者经常被混淆。最终进 JDBC URL 的是 **other 里的 `principal=...`**，独立字段只负责存储（见第六章代码事实）。

认证链路：

```text
DS 进程 --(1) headless keytab 登录 KDC，拿 TGT-->
DS 进程 --(2) 按 URL 中 principal=hive/slave01@HADOOP.COM 申请服务票据-->
DS 进程 --(3) GSSAPI 携带服务票据，与 HS2 握手-->
HS2      --(4) 用本机 hive.service.keytab 验签并证明身份-->
DS 进程 --(5) 握手成功，进入 SQL 会话
```

:::note
**一句话理解**：Kerberos 把"密码验证"变成"票据验证"。调度进程用 keytab 登录一次拿 TGT，之后每次访问 Hive 都用 TGT 换服务票据；服务端只认 KDC 签发的票据，不接触密码。
:::


## 三、总体架构

```text
┌──────────────────────────────┐        ┌────────────────────────────────┐
│ Hive 集群（Kerberos 底座）      │        │ DolphinScheduler 集群            │
│  · KDC（realm=HADOOP.COM）     │        │  · api-server / master         │
│  · HiveServer2 (10000)         │        │  · worker × N                  │
│  · Metastore (9083)            │        │  · alert（可选）                │
│  · /etc/krb5.conf              │  scp   │  · <DS_HOME>/conf/kerberos/     │
│  · /etc/security/keytab/*      │ ─────▶ │    krb5.conf                   │
│  · hive-site.xml/hdfs-site.xml │        │    ds-hive.headless.keytab     │
└──────────────────────────────┘        │    hive.service.keytab（按需）   │
                                        └────────────────────────────────┘
```

部署顺序就是文章顺序：底座（第四章）→ 调度节点（第五章）→ 数据源表单（第六章）→ 验证排错（第七、八章）。

:::warning
如果你用的是 DataSophon 管理底座，keytab 通常统一在 `/etc/security/keytab/`，krb5.conf 在 `/etc/krb5.conf`，且 **DataSophon 默认不创建 headless keytab**，需要单独申请。如果是 CDH/CDP/HDP/手工集群，路径不同但配置项一致，替换路径即可。
:::


## 四、底座侧：开启 / 核对 HiveServer2 与 Metastore 的 Kerberos

即使拿到的是"已经开了 Kerberos 的集群"，也建议过一遍本章——调度侧所有填值都应该来自这里的命令输出，而不是猜测。

### 4.1 在 KDC 上创建 principal

```bash
# 每个运行 HS2/Metastore 的节点一个服务 principal；-randkey 表示随机密钥，不设口令
kadmin.local -q "addprinc -randkey hive/slave01@HADOOP.COM"

# 调度平台进程身份（headless）：一个平台统一一个即可
kadmin.local -q "addprinc -randkey ds-hive@HADOOP.COM"

# 核对真实存在的 principal（这是后面所有填值的唯一事实来源）
kadmin.local -q "listprincs" | grep -iE "hive|ds-hive"
```

:::caution
`slave01` 必须是 **hostname**（`hostname -f` 的结果，FQDN 更稳），不是集群名、不是 IP。社区教程里 90% 的 `Server not found in Kerberos database` 都是这里写错。
:::


### 4.2 生成并分发 keytab

```bash
mkdir -p /etc/security/keytab

# 服务 keytab：只放在对应的 Hive 服务节点
kadmin.local -q "ktadd -k /etc/security/keytab/hive.service.keytab hive/slave01@HADOOP.COM"

# headless keytab：之后要复制到 DolphinScheduler 各节点
kadmin.local -q "ktadd -k /etc/security/keytab/ds-hive.headless.keytab ds-hive@HADOOP.COM"

chmod 600 /etc/security/keytab/*.keytab

# 立即核对 keytab 里实际装了哪些 principal
klist -k /etc/security/keytab/hive.service.keytab
klist -k /etc/security/keytab/ds-hive.headless.keytab
```

### 4.3 服务端配置参数

`core-site.xml`（涉及 HDFS 文件访问时）：

```xml
<property><name>hadoop.security.authentication</name><value>kerberos</value></property>
<property><name>hadoop.security.authorization</name><value>true</value></property>
```

`hive-site.xml` 关键参数（★ = Kerberos 必须项）：

| 参数 | 推荐值 | 说明 |
| ---- | ---- | ---- |
| `hive.server2.authentication` ★ | `KERBEROS` | HS2 认证开关 |
| `hive.server2.authentication.kerberos.principal` ★ | `hive/_HOST@HADOOP.COM` | 服务 principal；`_HOST` 自动替换本机 hostname |
| `hive.server2.authentication.kerberos.keytab` ★ | `/etc/security/keytab/hive.service.keytab` | HS2 服务 keytab |
| `hive.metastore.sasl.enabled` ★ | `true` | Metastore Thrift SASL 开关 |
| `hive.metastore.kerberos.principal` ★ | `hive/_HOST@HADOOP.COM` | Metastore principal |
| `hive.metastore.kerberos.keytab.file` ★ | `/etc/security/keytab/hive.service.keytab` | Metastore keytab |
| `hive.server2.transport.mode` | `binary`（默认） | binary/http 不一致是 `invalid status 80` 的根源 |
| `hive.server2.support.dynamic.service.discovery` | `true`（HA 时） | ZK 动态发现 |
| `hive.server2.zookeeper.namespace` | `hiveserver2` | ZK 命名空间 |
| `hive.zookeeper.quorum` | `slave01:2181,slave02:2181,slave03:2181` | HA 场景 ZK 地址 |

### 4.4 重启并验证（beeline 是社区的"标准裁判"）

```bash
# 按实际环境重启（systemd / 管理台 / 手工脚本均可）
systemctl restart hive-server2 hive-metastore

# 服务身份能登录
kinit -kt /etc/security/keytab/hive.service.keytab hive/slave01@HADOOP.COM && klist && kdestroy

# beeline 直连：这是区分"底座问题 vs 调度平台问题"的黄金标准
/opt/hive/bin/beeline \
  -u "jdbc:hive2://slave01:10000/default;principal=hive/slave01@HADOOP.COM"
```

:::note
判断口径：beeline 也报错 → 回到底座，看 HS2 日志、KDC 服务、时钟与 DNS；beeline 能通、DolphinScheduler 不通 → 问题在调度侧，重点查 `other.principal` 和全局开关。
:::


## 五、调度侧：让每个 DolphinScheduler 节点都"带好证件"

### 5.1 需要分发哪些文件

| 文件 | 用途 | 分发范围 |
| ---- | ---- | ---- |
| `krb5.conf` | KDC/realm/域名映射 | 所有 DS 节点（api-server/master、worker、alert） |
| `ds-hive.headless.keytab` | DS 进程登录身份 | 所有 DS 节点 |
| `hive.service.keytab` | 仅元数据（Metastore）链路使用 | 按需，只给 api-server/master 节点 |
| `hdfs-site.xml` / `hive-site.xml` | 元数据客户端需要 | 按需，只给 api-server/master 节点 |

目标目录：

```text
<DS_HOME>/conf/kerberos/
├── krb5.conf
├── ds-hive.headless.keytab
├── hive.service.keytab        # 按需
├── hdfs-site.xml              # 按需
└── hive-site.xml              # 按需
```

### 5.2 全局进程登录配置（两种等价方式）

`PropertyUtils` 的优先级：**环境变量 > JVM 参数 > 外部 common.properties > jar 内 classpath**。

**方式 A：外部 `common.properties`（每个服务一份，改完重启）**

```properties
# 总开关：false 时 JDBC URL 会用 ? 拼 other，行为完全不同
hadoop.security.authentication.startup.state=true

# krb5.conf 绝对路径
java.security.krb5.conf.path=<DS_HOME>/conf/kerberos/krb5.conf

# 平台进程身份（headless principal + keytab）
login.user.keytab.username=ds-hive@HADOOP.COM
login.user.keytab.path=<DS_HOME>/conf/kerberos/ds-hive.headless.keytab

# TGT 生命周期（小时），进程每 5 分钟自动 checkTGTAndReloginFromKeytab
kerberos.expire.time=2
```

**方式 B：环境变量（优先级更高，适合快速兜底或老版本 jar）**

```bash
export HADOOP_SECURITY_AUTHENTICATION_STARTUP_STATE=true
export JAVA_SECURITY_KRB5_CONF_PATH=<DS_HOME>/conf/kerberos/krb5.conf
export LOGIN_USER_KEYTAB_USERNAME=ds-hive@HADOOP.COM
export LOGIN_USER_KEYTAB_PATH=<DS_HOME>/conf/kerberos/ds-hive.headless.keytab
export KERBEROS_EXPIRE_TIME=2
```

:::warning
`resource.storage.type=HDFS` 且总开关为 true 时才会走 Kerberos 登录；资源存储不是 HDFS 时先确认这条链路。
:::


### 5.3 JAAS：每次从 keytab 取票，而不是依赖会过期的 ticket cache

`<DS_HOME>/conf/kerberos/jaas.conf`：

```
Client {
    com.sun.security.auth.module.Krb5LoginModule required
    useKeyTab=true
    keyTab="<DS_HOME>/conf/kerberos/ds-hive.headless.keytab"
    principal="ds-hive@HADOOP.COM"
    storeKey=true
    useTicketCache=false;
};
```

让 JVM 生效（上游 DolphinScheduler 写入 `<DS_HOME>/conf/dolphinscheduler_env.sh`；同源平台写入各服务 start.sh）：

```bash
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS} \
  -Djava.security.auth.login.config=<DS_HOME>/conf/kerberos/jaas.conf \
  -Djava.security.krb5.conf=<DS_HOME>/conf/kerberos/krb5.conf"
```

:::caution
为什么必须 `useTicketCache=false`：Hive JDBC 驱动的 GSSAPI 默认去系统 ticket cache 找凭证，手动 `kinit` 的 TGT 过期后就会出现"测试连接通过、跑着跑着 `TGT is expired`"的偶发故障。JAAS 每次从 keytab 登录才能根治。
:::


### 5.4 安装客户端工具

```bash
# CentOS/RHEL
yum install -y krb5-workstation
# Ubuntu/Debian
apt-get install -y krb5-user
```

`klist` / `kinit` / `kvno` 齐全，后面的验证才跑得起来。

## 六、数据源配置：表单字段逐个说清楚

本文示例：HS2 节点 `slave01`、端口 10000、ZK 三个节点。DolphinScheduler 与其同源数据中台的字段一致。

### 6.1 场景 A：JDBC-Hive 数据源（单 HS2，binary 模式）

| 字段 | 填写值 | 说明 |
| ---- | ---- | ---- |
| 类型 | `JDBC-Hive` | 后端 `DbType.HIVE` |
| 主机 host | `slave01` | HS2 所在节点；支持逗号分隔多 host |
| 端口 port | `10000` | HS2 端口 |
| 数据库 database | `default` | 默认库 |
| 用户名 userName / 密码 password | 非空即可 | Kerberos 场景不参与认证 |
| principal（独立字段） | `hive/slave01@HADOOP.COM` | 存储用，不自动拼 URL（见下方代码事实） |
| krb5.conf 路径 | 留空用全局，或填节点绝对路径 | 数据源级覆盖 |
| keytab 用户名 / keytab 路径 | 留空用全局，或填 headless keytab | 数据源级覆盖 |
| **其他参数 other** ★ | **`principal=hive/slave01@HADOOP.COM`** | 必须填；多个用 `;` 分隔 |

:::caution
**代码事实（DolphinScheduler 与同源平台一致）**：`getJdbcUrl()` 最终 URL = `jdbc:hive2://host:port/db` + `;` + `other`。全局开关为 true 时用 `;` 拼接，false 时用 `?` 拼接。**独立 principal 字段只存储，不参与 URL 拼接**——`other.principal` 漏填，报错就是 `Unsupported mechanism type PLAIN`。
:::


正确效果：

```text
jdbc:hive2://slave01:10000/default;principal=hive/slave01@HADOOP.COM
```

:::warning
底座是 binary 模式时，other 不要加 `transportMode=http;httpPath=cliservice`，否则报 `invalid status 80`。只有服务端明确配置了 `hive.server2.transport.mode=http` 及 HTTP 端口/路径时才加。
:::


### 6.2 场景 A+：HS2 高可用（ZooKeeper 动态发现）

当底座配置了 `hive.server2.support.dynamic.service.discovery=true` 时：

| 字段 | 填写值 |
| ---- | ---- |
| 主机 host | `slave01,slave02,slave03`（ZK 节点列表） |
| 端口 port | `2181`（每个 host 都会拼该端口） |
| 数据库 database | `default` |
| other | `serviceDiscoveryMode=zooKeeper;zooKeeperNamespace=hiveserver2;principal=hive/_HOST@HADOOP.COM` |

最终 URL：

```text
jdbc:hive2://slave01:2181,slave02:2181,slave03:2181/default;serviceDiscoveryMode=zooKeeper;zooKeeperNamespace=hiveserver2;principal=hive/_HOST@HADOOP.COM
```

:::note
Hive JDBC 从 ZK 读到实际 HS2 主机名后，会把 `principal` 里的 `_HOST` 替换为该主机名。不能写死 `hive/slave01@...`，否则连接被调度到其他节点时 GSS 失败。前提是每个 HS2 节点 keytab 都含 `hive/<本机hostname>@REALM`，且 DS 节点能访问 ZK 2181。
:::


### 6.3 场景 B：元数据（Metastore）链路

| 字段 | 填写值 |
| ---- | ---- |
| metastoreUri | `thrift://slave01:9083`（HA 逗号分隔多地址） |
| kerberosPrincipal / kerberosKeytabPath / kerberosKrb5ConfPath | 可填，但同源平台代码会用全局 `login.user.keytab.*` 覆盖 |
| hdfsSitePath | `<DS_HOME>/conf/kerberos/hdfs-site.xml`（必填） |
| hiveSitePath | `<DS_HOME>/conf/kerberos/hive-site.xml`（可选） |

:::warning
元数据链路实际认证身份 = 全局 headless principal，不是前端那三个字段。所以 headless keytab 必须申请，并且 Metastore 侧 ACL 要放行该 principal。
:::


### 6.4 测试连接

1. 点「测试连接」：JDBC-Hive → keytab 登录 + `DriverManager.getConnection`；元数据链路 → `HiveClient` → `UGI.loginUserFromKeytab`。
2. 成功标志：服务日志出现 `Kerberos authentication successful`。
3. 失败按第八章速查表定位。

## 七、端到端验证三板斧

```bash
# 斧 1：服务端日志（HS2 的错误是决定性的）
tail -n 1000 /opt/hive/logs/hiveserver2.log | grep -B5 -A30 "Caused by" | tail -100

# 斧 2：客户端身份与票据（在 DS 任一节点）
kinit -kt <DS_HOME>/conf/kerberos/ds-hive.headless.keytab ds-hive@HADOOP.COM && klist
kvno hive/slave01@HADOOP.COM
# 拿不到服务票据 = KDC 里 principal 不存在或客户端到 KDC 链路不通

# 斧 3：DS 服务日志（客户端侧 Caused by）
grep -B3 -A15 "GSS\|Caused by" <DS_HOME>/logs/dolphinscheduler-api.log | tail -80
```

没有 beeline 时的替代验证（在 Hive 节点，参考阿里云 EMR 的 Java 连接示例）：

```bash
java -cp ".:$HIVE_HOME/lib/*" HiveJdbcTest \
  "jdbc:hive2://slave01:10000/default;principal=hive/slave01@HADOOP.COM" hive ""
```

## 八、排错速查表：按报错特征定位

| 报错特征 | 根因 | 处理 |
| ---- | ---- | ---- |
| **`Unsupported mechanism type PLAIN`** | JDBC URL 没有有效 `principal=`；或全局开关 false（URL 用 `?` 拼接） | 在 other 里补 `principal=hive/<hostname>@REALM`；确认总开关 true 且已重启 |
| **`invalid status 80`** | 客户端 http 模式 vs 服务端 binary 模式 | other 去掉 `transportMode=http;httpPath=cliservice` |
| `GSS initiate failed: Server not found in Kerberos database` | URL principal 在 KDC 不存在（host 写成集群名/IP） | `kadmin.local -q "listprincs"` 查真实 principal，KDC/keytab/hive-site 三处一致 |
| `GSS initiate failed: Clock skew too great / checksum fail` | 节点时钟偏差 > 5 分钟 | 全节点 NTP 同步 |
| `GSS initiate failed: Cannot contact any KDC` | krb5.conf 错误 / KDC 88 端口不通 | 查 krb5.conf、测 88 端口、`kinit -V` |
| `GSS initiate failed: Failed to find any Kerberos tgt` | headless keytab 登录失败 | 核对 `login.user.keytab.username/path` 与 `klist -k` |
| `Cannot locate default realm` | krb5.conf 缺失或 `java.security.krb5.conf.path` 配错 | 核对路径与文件内容 |
| `Cannot get kdc for realm` | realm→KDC 映射或 DNS/反向解析问题 | 配 `[domain_realm]`；`rdns=false`；核对 `hostname -f` |
| `keytab contains no suitable keys for ...` | kinit 用的 principal 与 keytab 内容不一致 | `klist -k <keytab>` 用文件内真实 principal |
| `Unable to obtain password from user` | keytab 不存在/权限不对 | `chmod 600`，确认运行账户可读 |
| **`TGT is expired`（连接通过后偶发）** | JDBC 依赖系统 ticket cache，手动 kinit 的 TGT 过期 | 应急 `kinit -kt ...`；长期用 JAAS `useKeyTab=true;useTicketCache=false` |
| kinit 长时间卡住 | KDC 不可达 | `kinit -V`、`getent hosts`、测 88 端口 |
| **DS 表单填了 principal 但 URL 没带上** | 部分 DS 版本已知 Bug（Issue [#17413](https://github.com/apache/dolphinscheduler/issues/17413) / [#7964](https://github.com/apache/dolphinscheduler/issues/7964)） | 升级/打 patch；临时规避：principal 同时写进 other；抓日志确认最终 URL |
| 测试连接成功但作业失败 | worker 节点未分发凭据或配置未同步 | 重新分发到全部 worker，并重启 worker |
| 未开启 Kerberos 但报认证错误 | 总开关误开 | 确认 `hadoop.security.authentication.startup.state` |

**报错演进坐标（真实排错经历，建议背下来）：**

```text
PLAIN（开关/principal 缺失）
  → invalid status 80（transport 不匹配）
  → GSS initiate failed / Server not found（principal 不在 KDC）
  → 连接成功
  → HA 切换（ZK 动态发现 + principal=_HOST）
```

每越过一个报错，说明前面的配置已经正确，聚焦当前报错即可，不要推倒重来。

## 九、生产安全清单

1. **keytab = 明文密码**：所有 keytab `chmod 600`，属主为运行账户，禁止提交 Git、禁止发聊天群。
2. **最小分发**：服务 keytab 只在 Hive 节点；DS 节点只分发 headless keytab；`hive.service.keytab` 仅在元数据链路需要时给 master 节点。
3. **最小授权**：headless principal 一个平台一个，不复用管理员 principal；Metastore ACL 只放行该身份。
4. **时钟与 DNS**：NTP 全集群同步（与 KDC 偏差 < 5 分钟）；hostname/FQDN、正反向解析一致，krb5.conf 建议 `rdns=false`。
5. **凭据轮换**：keytab 变更后，重新分发 → 重启服务 → 重新测试连接，避免"改了 KDC 忘了中台"。
6. **版本核对**：先确认 DolphinScheduler 版本没有 #17413/#7964 类字段 Bug，升级前在测试环境验证。

## 十、一页速记

```text
底座：kadmin.local addprinc → ktadd → chmod 600
       hive-site.xml: authentication=KERBEROS + principal=_HOST + keytab
       beeline 验证通过才算底座 OK

调度：每个 DS 节点：krb5.conf + headless.keytab
       common.properties: startup.state=true + krb5 path + login.user.keytab.*
       jaas.conf: useKeyTab=true / useTicketCache=false

数据源：
       单机:  other = principal=hive/<hostname>@REALM
       HA  :  host=ZK列表, port=2181,
              other = serviceDiscoveryMode=zooKeeper;zooKeeperNamespace=hiveserver2;principal=hive/_HOST@REALM
       binary 底座: 不要加 transportMode=http;httpPath=cliservice

排错顺序：
       PLAIN → 补 other.principal / 开总开关
       invalid status 80 → 去掉 http 参数
       GSS/Server not found → kadmin.local 核对 principal
       Clock skew → NTP
       TGT is expired → JAAS useTicketCache=false
```

## 参考资料

1. [Apache DolphinScheduler 官方 Hive 数据源文档（2.0.9 中文）](https://apache.googlesource.com/dolphinscheduler-website/+show/refs/heads/history-docs/docs/2.0.9/docs/zh/guide/datasource/hive.md)
2. [Apache DolphinScheduler hive datasource doc（GitHub）](https://github.com/apache/dolphinscheduler/blob/136a1830187509c465236274b2e9e423ee13075f/docs/docs/en/guide/datasource/hive.md)
3. [Kerberos 安全认证-连载10-Hive Kerberos 安全配置及访问（CSDN）](https://blog.csdn.net/qq_53058639/article/details/139338696)
4. [同主题另一版本（CSDN）](https://blog.csdn.net/qq_32020645/article/details/131344549)
5. [将生成的 keytab 文件分发到运行 Hive 服务的所有节点（CSDN）](https://blog.csdn.net/golove666/article/details/137371835)
6. [使用 Java 连接开启 Kerberos 认证的 Hive（阿里云 EMR）](https://www.alibabacloud.com/help/zh/emr/emr-on-ecs/user-guide/use-java-to-connect-to-an-emr-cluster-with-kerberos-authentication-enabled)
7. [HiveServer2 Security Configuration（Cloudera）](https://docs-archive.cloudera.com/documentation/enterprise/5-7-x/topics/cdh_sg_hiveserver2_security.html)
8. [Configure HiveServer 2 to use Kerberos（Ezmeral）](https://docs.ezmeral.hpe.com/datafabric-customer-managed/80/Hive/HiveServer2-KerberosAuth.html)
9. [DolphinScheduler Issue #17413](https://github.com/apache/dolphinscheduler/issues/17413)
10. [DolphinScheduler Issue #7964](https://github.com/apache/dolphinscheduler/issues/7964)
11. [Kerberos 的 keytab 文件生成和登录（博客园）](https://www.cnblogs.com/chhyan-dream/p/13442628.html)
