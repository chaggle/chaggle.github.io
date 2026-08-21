---
title: "Jenkins 原理、部署与调优指南"
published: 2026-08-11T00:00:00+08:00
updated: 2026-08-11T00:00:00+08:00
tags: ["2026", "jenkins", "ci/cd", "devops", "middleware"]
category: "middleware"
---

> 大数据底座的迭代思路里提到"引入 CI/CD，把组件部署从手工变为流水线"，落地首选就是 Jenkins。本文按"原理 → 部署 → 调优"三步整理企业级使用指南，延续《Kerberos 部署与调优指南》等系列的结构。

## 一、Jenkins 核心原理

### 1、Jenkins 是什么

Jenkins 是 Java 编写的开源 CI/CD 工具，负责"自动化的构建、测试、发布"。它的核心价值不是某个功能，而是**可编程的流水线**：把"拉代码 → 编译 → 测试 → 打包 → 发布"整条链路用代码表达、可重复执行。

### 2、整体架构：Master / Agent

```
                   ┌────────────────────────┐
   Git / SVN ──→   │        Master          │   ← 调度中心（控制器）
   Webhook/定时 ──→ │  Queue → Executors 调度│
                   └──────┬─────────┬───────┘
                          │ SSH/协议 │
                   ┌──────┴─────┐ ┌─┴────────────┐
                   │  Agent 1   │ │  Agent N     │   ← 执行节点
                   │ (Linux)    │ │ (K8s/Docker) │
                   └────────────┘ └──────────────┘
```

- **Master**：负责任务调度、配置存储、Web 界面、权限。默认自带执行器，生产建议设 0（只调度不干活）
- **Agent**：真正执行构建的节点，一个 master 可以挂大量 agent，按标签（label）分组，比如 `bigdata`、`java17`、`k8s-node`
- **JENKINS_HOME**：一切状态的家——配置、构建记录、凭据、插件都在这里，是备份与迁移的核心

### 3、核心对象

| 对象 | 说明 |
| ---- | ---- |
| Job / Item | 一个任务（freestyle / pipeline / multibranch） |
| Build | 一次构建执行，有编号（#1、#2...）和状态 |
| Workspace | agent 上的工作目录，代码和构建产物都在里面 |
| Executor | 执行器，一个 agent 上可以配多个（并发数） |
| Queue | 等待队列，executor 空闲才被调度 |
| Node / Label | 节点与标签，用于把任务路由到特定 agent |
| Credentials | 凭据（SSH 密钥、token、密码），加密存在 JENKINS_HOME/secrets |
| SCM | 源码管理：Git / SVN 集成，轮询或 webhook 触发 |

### 4、一次构建的完整流程

```
触发（Webhook / 定时 / 手动 / API）
  → 进入 Queue 等待空闲 Executor
  → Agent 上创建/复用 Workspace，拉取源码
  → 按 Pipeline 执行阶段：构建（Maven/Gradle/npm）→ 测试 → 归档制品
  → 发布：SSH 推包 / 上传 Nexus / kubectl 滚动更新
  → 结果通知（邮件 / 企业微信 / DingTalk）并记录构建历史
```

### 5、Pipeline 原理

Pipeline 是 Jenkins 的"一等公民"，用 Groovy 编写，两种写法：

- **Declarative（声明式）**：结构化，推荐生产使用

```groovy
pipeline {
    agent { label 'bigdata' }          // 指定执行节点
    stages {
        stage('拉取代码') { steps { checkout scm } }
        stage('构建')    { steps { sh 'mvn -q clean package' } }
        stage('发布')    { steps { sh './deploy.sh' } }
    }
    post { success { emailext subject: '构建成功' } }
}
```

- **Scripted（脚本式）**：自由但难维护

Pipeline 的核心机制是 **CPS（Continuation Passing Style）**：脚本被翻译成可暂停/恢复的状态机，每次构建的执行状态持久化，所以能支持"构建被打断后恢复"、Blue Ocean 可视化、以及跨重启的 stage 视图。

**Jenkins Shared Library（共享库）**：把通用逻辑（部署脚本、参数校验、通知封装）抽成公共 Groovy 库，各流水线引用，解决"流水线代码重复"的问题。

### 6、分布式构建的三种 Agent 形态

| 形态 | 原理 | 适用 |
| ---- | ---- | ---- |
| SSH Agent | master 通过 SSH 连 agent 节点，按需拉起 slave.jar | 固定物理/虚机节点 |
| Inbound Agent（JNLP/WebSocket） | agent 主动连 master（可跨 NAT），Java Web Start 已废弃 | 跨网络、容器内节点 |
| 云 Agent（Docker / Kubernetes） | 构建时动态起一个容器跑任务，跑完销毁 | 弹性场景，资源利用最省 |

:::note
**K8s Agent 是企业级弹性的关键**：构建高峰期自动起 20 个 pod 并行，空闲时归零，比固定 agent 池省一半以上资源。配合共享存储（PVC）挂 maven 仓库、npm 缓存，构建速度接近本地。
:::


### 7、高可用与制品管理

- **HA 思路**：Jenkins 本身无内置集群，企业做法是"NFS 共享 JENKINS_HOME + 双实例 active/standby + 前端负载均衡"，或"单实例 + 定期备份（tar JENKINS_HOME）"降级方案
- **制品**：构建产物归档到 Nexus/Artifactory（Maven、Docker registry），发布环境从制品库拉取，而不是从构建机拷贝——保证"构建一次，处处部署"

## 二、部署（企业级，Linux）

### 1、前置准备

| 项目 | 建议 |
| ---- | ---- |
| JDK | Jenkins 当前 LTS 要求 Java 11+，推荐 **Java 17 LTS**；K8s/Docker agent 场景再加 JDK 21 工具链 |
| 内存 | Master 建议 2G+，构建任务多的 4G；JENKINS_HOME 放独立磁盘（SSD） |
| 时区 | JVM 加 `-Duser.timezone=Asia/Shanghai`，否则日志/时间戳差 8 小时 |
| 镜像 | 插件更新中心走清华镜像，Maven/npm 走国内源，否则初始化极慢 |

### 2、部署方式对比

| 方式 | 优点 | 缺点 | 推荐度 |
| ---- | ---- | ---- | ---- |
| war + systemd（原生） | 可控、易调 JVM、无额外依赖 | 手工步骤多 | ★★★ 推荐 |
| Docker Compose | 环境隔离、迁移方便 | 数据卷管理、JVM 调参绕 | ★★ |
| Tomcat 部署 war | 复用现有 Tomcat | 多一层依赖 | ★ |

### 3、war + systemd 部署步骤

```bash
# 1) 创建用户与目录
useradd -r -s /bin/bash jenkins
mkdir -p /data/jenkins_home /data/jenkins && chown -R jenkins:jenkins /data/jenkins*

# 2) 下载 LTS war 包（清华镜像更快）
wget https://mirrors.tuna.tsinghua.edu.cn/jenkins/war-stable/latest/jenkins.war \
  -O /data/jenkins/jenkins.war

# 3) systemd 服务（/etc/systemd/system/jenkins.service）
[Unit]
Description=Jenkins CI
After=network.target

[Service]
User=jenkins
Environment="JENKINS_HOME=/data/jenkins_home"
Environment="JAVA_OPTS=-Xms2g -Xmx4g -XX:MaxMetaspaceSize=512m \
  -Duser.timezone=Asia/Shanghai -Dfile.encoding=UTF-8 \
  -Dhudson.model.WorkspaceCleanupThread.interval=3600"
ExecStart=/usr/bin/java $JAVA_OPTS -jar /data/jenkins/jenkins.war --httpPort=8080
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 4) 启动并初始化
systemctl daemon-reload && systemctl start jenkins
cat /data/jenkins_home/secrets/initialAdminPassword   # 初始解锁密码

# 5) 配置插件镜像（/data/jenkins_home/hudson.model.UpdateCenter.xml）
#    清华镜像：https://mirrors.tuna.tsinghua.edu.cn/jenkins/updates/update-center.json
```

### 4、初始化配置清单

- 解锁后用**管理员账号**（不要用 admin 默认密码）登录
- 必装插件：`Chinese`、`Git/Subversion`、`Pipeline`、`Blue Ocean`、`Credentials Binding`、`SSH Pipeline Steps`、`Docker/Kubernetes`、`Email Extension`
- 全局工具：JDK（17/21）、Maven（配 settings.xml 阿里云镜像）、Node.js
- 凭据：Git 账号（token）、SSH 私钥（部署用）、Nexus/Registry 账号，全部用 **Credential 管理**，不写死在脚本里
- 权限：按团队建用户/角色，用**矩阵授权**（Matrix Authorization Strategy），Master 上禁用匿名访问
- 反向代理 HTTPS（nginx）：

```nginx
server {
    listen 443 ssl;
    server_name ci.example.com;
    ssl_certificate     /etc/nginx/cert/server.crt;
    ssl_certificate_key /etc/nginx/cert/server.key;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5、Agent 节点接入

**SSH Agent（固定节点）**：系统管理 → 节点 → 新建节点 → 填写 SSH 地址与凭据 → 指定标签（如 `bigdata`）与执行器数量（按 CPU 核数的一半）。注意 agent 上也要装 JDK 与工具链。

**Kubernetes Agent（弹性）**：装 `Kubernetes` 插件 → 配置集群地址、命名空间、Pod 模板（镜像含 JDK/Maven）→ Pipeline 里 `agent { kubernetes { label 'ephemeral' } }`，构建结束 Pod 自动销毁。

**验证**：在节点页点"连接"，能看到节点图标为绿色并显示空闲执行器数。

## 三、调优

### 1、JVM 调优

| 参数 | 建议 | 说明 |
| ---- | ---- | ---- |
| -Xms / -Xmx | 2G / 4G（任务多可 4G/8G） | 相等可避免动态伸缩抖动 |
| -XX:MaxMetaspaceSize | 512m-1G | 插件与 Groovy 脚本大量加载类 |
| GC | 默认 G1 即可 | 不要轻易换 GC 算法 |
| -Duser.timezone | Asia/Shanghai | 时区问题最常见 |

:::warning
JENKINS_HOME 磁盘 IO 是最大的性能瓶颈：构建记录、日志、workspace 都在它下面。放 SSD、预留 20% 以上空间、监控 inode，比调 JVM 更见效。
:::


### 2、系统级调优

- **Master 执行器设 0**：调度与执行分离，避免主控被构建任务拖垮
- **构建记录保留策略**：按分支/标签保留最近 N 次，开启 SCM 保留策略（有改动才留）
- **制品保留**：归档制品设保留天数，配合 Nexus 做长期存储
- **Workspace 清理**：开启自动清理（`WorkspaceCleanupThread`），未用 workspace 定时删除
- **插件瘦身**：只装用到的插件，禁用（不卸载）低频插件，减少启动与内存开销
- **日志轮转**：`/var/log/jenkins` 与构建日志启用 logrotate，避免撑爆磁盘

### 3、Pipeline 性能优化

- **触发用 Webhook 替代轮询**：SCM 轮询浪费 master 资源，Git 仓库配 webhook 即时触发
- **并行阶段**：`stage('并行') { parallel { ... } }`，测试分片、多平台构建并行
- **构建缓存**：Maven 本地仓库、npm cache、Gradle 缓存挂到共享卷（NFS/PVC），避免每次全量下载依赖
- **减小日志**：生产关闭 DEBUG 日志输出，构建脚本避免无意义的大打印
- **共享库管理**：常用逻辑抽到 Shared Library，流水线文件保持精简

### 4、规模扩展

- 固定 Agent 池 + 标签分组：不同技术栈（java/node/python）分池，避免互相污染 workspace
- 高峰期弹性：Kubernetes Agent 按队列长度动态伸缩，高峰期 20 并发、低峰归零
- 多 master 拆分：业务线多、任务量大时按业务拆 master（或 Team/文件夹隔离），避免单点排队

### 5、安全加固

- CSRF 保护默认开启；禁用匿名读
- Agent 接入只放行内网网段，SSH 端口最小化暴露
- 凭据只用 **Jenkins Credential** 管理，脚本里禁止明文密码；开启凭据加密（默认 AES）
- 共享库走代码评审，流水线里禁止 `eval` 等危险操作
- 生产环境 HTTPS 必须（反向代理或证书直配）

### 6、常见问题排查

| 现象 | 原因 | 处理 |
| ---- | ---- | ---- |
| 任务一直排队 | 执行器满 / agent 离线 / 标签不匹配 | 节点页看连接状态与执行器占用；标签写错会永远等不到 agent |
| 构建卡死无输出 | 网络、等待锁、脚本死循环 | 看线程转储（Thread Dump），检查 SCM 与制品库连通性 |
| 内存溢出（OOM） | JVM 太小或插件泄漏 | 调 Xmx，禁用可疑插件 |
| 磁盘满 | 构建日志、workspace、备份堆积 | 清理 + 轮转 + 保留策略 |
| 插件升级后功能异常 | 插件兼容性 | 升级前备份 JENKINS_HOME，异常时回退版本 |
| 时间/日志差 8 小时 | JVM 时区未设置 | 加 -Duser.timezone=Asia/Shanghai 重启 |
| Agent 频繁断连 | 网络抖动 / 版本不匹配 | 升级 agent.jar 与 master 同版本，检查防火墙 |

## 四、总结

- **原理**：Master/Agent 架构 + JENKINS_HOME 状态存储 + Pipeline（CPS 状态机）+ 插件生态；HA 靠共享存储双实例或备份
- **部署**：war + systemd 最可控；初始化三件套（国内镜像、插件清单、凭据与权限）一次配好
- **调优**：先磁盘与 IO，再 JVM 与保留策略，再 Pipeline 缓存与弹性 Agent；安全加固与备份是长期责任
- **落地建议**：Jenkins 接回大数据底座迭代思路——组件参数变更、服务构建、发布脚本全部流水线化，让"平台现代化"真正跑起来
