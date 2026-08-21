---
title: "Kerberos 部署与调优指南"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "kerberos", "部署"]
category: "bigdata"
---

> Kerberos 是 Hadoop 生态（HDFS/YARN/Hive/Kafka 等）的标准认证协议：客户端先向 KDC 拿票据，再用票据访问服务，全程不传密码。部署的核心是 **KDC 服务 + 每个组件的 principal/keytab**；调优的核心是**票据生命周期与时钟同步**。本文覆盖原理、部署、参数优化与常见问题。

## 底层原理

### 认证流程（两次票据交换）

```
① AS-REQ    客户端 → KDC（AS 服务）：用密码加密请求
② AS-REP    客户端 ← KDC：TGT（票据授权票据，密码解密）
③ TGS-REQ   客户端 → KDC（TGS 服务）：TGT + 目标服务名
④ TGS-REP   客户端 ← KDC：服务票据 ST（目标服务密钥加密）
⑤ AP-REQ    客户端 → 服务端：ST + 认证信息
```

- **Principal**：身份标识，格式 `user/instance@REALM`，如 `hdfs/node1@BLOG.COM`
- **Keytab**：principal 的密钥文件（等价密码），服务进程用它免交互认证
- **TGT**：登录凭证，默认有效期 24 小时（`ticket_lifetime`）
- **时钟同步**：Kerberos 票据校验时间戳，客户端与 KDC 时钟偏差超过默认 300 秒直接失败

:::note
**一句话理解**：Kerberos 把"密码验证"变成"票据验证"。第一次登录向 KDC 要 TGT（验证密码），之后所有服务访问都用 TGT 换 ST，服务端只认 KDC 签发的票据，不再接触密码。
:::


## 部署（KDC + Hadoop 集成）

### 1. 安装 KDC（独立节点）

```bash
# CentOS/RHEL
yum install -y krb5-server krb5-workstation
# 配置 /etc/krb5.conf（所有客户端同样配置）
cat >> /etc/krb5.conf <<'EOF'
[libdefaults]
  default_realm = BLOG.COM
  dns_lookup_realm = false
  dns_lookup_kdc = false
  ticket_lifetime = 24h
  renew_lifetime = 7d
  forwardable = true
[realms]
  BLOG.COM = {
    kdc = kdc-server
    admin_server = kdc-server
  }
[domain_realm]
  .blog.com = BLOG.COM
  blog.com = BLOG.COM
EOF

# 初始化数据库并启动
kdb5_util create -s -r BLOG.COM        # 输入 KDC 主密码
systemctl start krb5kdc && systemctl start kadmin
```

### 2. 创建 principal 与 keytab

```bash
kadmin.local
# 服务 principal（每组件每节点）
addprinc -randkey hdfs/node1@BLOG.COM
addprinc -randkey hdfs/node2@BLOG.COM
# 导出 keytab 到节点（分发到对应机器）
xst -k /etc/security/keytabs/hdfs.keytab hdfs/node1@BLOG.COM
```

### 3. Hadoop 开启认证

```xml
<!-- core-site.xml -->
<property>
  <name>hadoop.security.authentication</name>
  <value>kerberos</value>
</property>
<property>
  <name>hadoop.security.authorization</name>
  <value>true</value>
</property>
<!-- hdfs-site.xml：DataNode 通信认证 -->
<property>
  <name>dfs.namenode.keytab.file</name>
  <value>/etc/security/keytabs/hdfs.keytab</value>
</property>
```

```bash
# 客户端认证方式一：kinit（交互/定时续票）
kinit -kt /etc/security/keytabs/hdfs.keytab hdfs/node1@BLOG.COM

# 方式二：作业提交通道
# 普通用户 kinit 后提交作业，或使用 Hadoop 代理用户（proxyuser）
```

## 参数优化（三档规格）

| 参数 | 中小集群（<50 节点） | 中大型（50~200） | 超大型（200+） |
| ---- | ---- | ---- | ---- |
| `ticket_lifetime` | 24h | 24h（服务端）+ 客户端续票 | 24h + 自动续期脚本 |
| `renew_lifetime` | 7d | 14d | 30d（配合自动 kinit 定时任务） |
| `maxrenewlife` | 7d | 14d | 30d |
| `clockskew` | 300s | 300s | 300s（配合 NTP 保准） |
| KDC 规格 | 8C16G | 16C32G | 32C64G 或双 KDC 主备 |
| `kdc_max_dgram_reply_size` | 2048 | 4096 | 8192（大票据/UDP 限制） |

:::warning
**长作业 vs 票据过期**：Spark/Flink 长任务运行时票据过期（`Ticket expired`）是经典故障。方案：客户端 `renew_lifetime` 覆盖作业时长 + 定时 `kinit -R` 续票；或开启 Hadoop 的令牌（delegation token）自动刷新机制。
:::


**优化理解**：

- `ticket_lifetime` 与安全是反比：24h 兼顾可用与风险；安全要求高的场景缩到 8~12h，但必须配套自动续票，否则运维事故频发
- `clockskew` 放宽会弱化重放攻击防护，**优先保 NTP 而不是放宽 clockskew**——NTP 偏差控制在 1 分钟内是硬性运维指标
- KDC 是**同步瓶颈**：集群认证风暴（全部节点同时重启）时 KDC 单点 CPU/网络飙高，双 KDC（主备）或独立 VIP 是超大规模标配

## 集群规模优化

- **时钟同步是地基**：所有节点 NTP/chrony 统一时钟，偏差 >300s 一切认证失败；KDC 自身也加入时间源
- **keytab 管理**：keytab 按主机分发、权限 400、root 属主；定期轮换（`xst -norandkey` 不换密钥，`-randkey` 换密钥需重发）
- **代理用户（proxyuser）**：提交作业统一走调度平台账号 + 代理用户，避免人人在节点上 kinit
- **令牌（delegation token）**：HDFS/YARN 长作业用 DT 免 keytab，配置 `hadoop.security.token.service.use_ip` 与刷新周期
- **Kafka/Ranger 联动**：Kafka 开 SASL/GSSAPI 复用同一 KDC；Ranger 与 Kerberos 双认证共存时注意票据传递链
- **排障工具链**：`klist`（看票据）、`kadmin`（查 principal）、KDC 日志（/var/log/krb5kdc.log）定位认证失败

## 常见问题

- **`Clock skew too great (X > 300 seconds)`**：时钟偏差——先 NTPdate 校准所有节点，别急着放宽 clockskew
- **`Ticket expired`**：票据过期——kinit 续票或刷新 delegation token；长作业必须规划续期
- **`Server not found in Kerberos database`**：principal 拼写/格式错误，或实例名与节点 hostname 不一致
- **`Decrypt integrity check failed`**：keytab 与 KDC 密钥不一致（换过密码/keytab 损坏）——重新 `addprinc -randkey` + 导出
- **`kinit: Client not found`**：principal 不存在；确认 realm 大小写（REALM 惯例全大写）
- **开启 Kerberos 后 HDFS 报权限失败**：认证通过但授权失败——检查用户映射（`hadoop.security.auth_to_local` 规则）

## 部署检查清单

1. 全节点时钟同步（NTP）——Kerberos 的地基
2. KDC 双机（超大规模），keytab 权限 400
3. ticket_lifetime/renew_lifetime 覆盖作业时长，续票自动化
4. delegation token 用于长作业，proxyuser 收敛账号
5. klist/kadmin/KDC 日志排障工具齐备
6. 故障演练：KDC 主备切换、票据过期恢复
