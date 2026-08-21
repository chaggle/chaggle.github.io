---
title: "Kubernetes 部署参数优化"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "kubernetes", "k8s"]
category: "linux"
---

> K8S 部署优化分两层：**集群层**（控制面规格、etcd 磁盘、系统参数）与**工作负载层**（requests/limits、调度策略、扩缩容）。本文给出 8C16G / 32C256G / 64C512G 三种节点规格下的部署建议，以及大数据/中间件组件容器化的关键参数。

## 集群层优化

### 节点规格规划

| 角色 | 规格 | 说明 |
| ---- | ---- | ---- |
| 控制面（etcd+apiserver+scheduler+cm） | 8C16G 起步 ×3 | etcd 独立 SSD；apiserver 内存随规模涨 |
| Worker（业务） | 8C16G / 32C256G / 64C512G | 按业务类型混合：内存型与计算型分开 |
| 存储节点 | 高磁盘密度 | 跑分布式存储（Ceph/Longhorn）或大数据本地盘 |

### 控制面参数

| 参数 | 说明 | 建议 |
| ---- | ---- | ---- |
| `--max-requests-inflight` | apiserver 并发上限 | 默认 400，大集群调 1000+，配合 `--max-mutating-requests-inflight` |
| `--request-timeout` | 请求超时 | 默认 60s；大对象（LIST 全量）可调大 |
| `kube-apiserver --enable-aggregator-routing` | 聚合器路由 | 依部署环境开启 |
| etcd `--quota-backend-bytes` | 后端配额 | 默认 2G，大集群 8~16G |
| kubelet `--max-pods` | 单节点 Pod 上限 | 默认 110；大数据节点按实际调低 |

:::note
**etcd 是集群的性能底座**：所有状态读写都要过它，磁盘 fsync 延迟直接决定 apiserver 响应。etcd 节点必须 SSD/NVMe，`disk.latency` 监控；数据盘与系统盘分离。
:::


### 节点系统参数

```bash
# 内核参数（kubelet 前置）
sysctl -w vm.max_map_count=262144          # 大数据组件（ES/HBase 类）需要
sysctl -w fs.file-max=1048576
sysctl -w net.core.somaxconn=65535

# kubelet 预留资源：防止系统组件被业务 Pod 挤死
kubelet --system-reserved=cpu=500m,memory=1Gi \
        --kube-reserved=cpu=500m,memory=1Gi \
        --eviction-hard=memory.available<500Mi
```

## 工作负载层优化

### 1. requests / limits 是基本功

```yaml
resources:
  requests:          # 调度依据（分配保证）
    cpu: 500m
    memory: 1Gi
  limits:            # 运行上限（超限被限流/OOM）
    cpu: 1
    memory: 2Gi
```

- **requests 决定调度**，写大 = 节点资源被高估 → 调度不足
- **limits 决定生死**，写小 = 业务 OOM；写大 = 节点超卖失控
- 三个 QoS 等级：Guaranteed（requests=limits）最稳，适合中间件；Burstable 常见；BestEffort 禁止用于生产

:::warning
**内存 limits 与 Java 的坑**：容器 memory limits=2G，但 JVM 默认按宿主机内存算堆，Pod 一启动就被 OOM。解法：`-XX:MaxRAMPercentage=75` 或显式 `-Xmx`，让 JVM 感知容器限制。
:::


### 2. 调度策略

```yaml
affinity:
  nodeAffinity:            # 节点亲和：大内存任务 → 内存型节点
    requiredDuringScheduling:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-type
          operator: In
          values: ["memory"]
  podAntiAffinity:         # 反亲和：有状态组件副本分散到不同节点
    preferredDuringScheduling:
      - weight: 100
        podAffinityTerm:
          topologyKey: kubernetes.io/hostname
          labelSelector:
            matchLabels: {app: kafka}
tolerations:               # 容忍：允许调度到带污点的专用节点
  - key: "bigdata"
    operator: Exists
```

- 控制面节点打污点（`node-role.kubernetes.io/master:NoSchedule`）防止业务误调
- 大数据节点打标签 + 污点，Spark/Flink 任务用容忍+节点亲和定向调度，避免与在线业务互抢

### 3. 扩缩容

```yaml
# HPA：按 CPU 自动扩缩（需 metrics-server）
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web-hpa}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: web}
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource: {name: cpu, target: {type: Utilization, averageUtilization: 60}}
```

:::note
HPA 的三个坑：扩容快（几秒）缩容慢（默认 5 分钟冷却）；无状态业务才适合 HPA；有状态组件（数据库）用垂直扩缩（VPA）或人工，别套 HPA。
:::


## 组件容器化要点（大数据/中间件）

| 组件 | 部署形态 | 关键参数 |
| ---- | ---- | ---- |
| Zookeeper/Kafka | StatefulSet | 稳定 ID、本地 PV、`preStop` 优雅下线 |
| MySQL/Redis | StatefulSet + 备份 | 数据卷独立 PVC、`fsGroup`、快照备份 |
| Flink（K8s 原生） | Application 模式 Job | `jobmanager/taskmanager` 资源分离、检查点 PVC |
| Spark on K8s | Operator 或 spark-submit | driver/executor requests 精确配置 |
| Nacos | StatefulSet × 3 | 集群域名解析、9848/9849 端口 |

### StatefulSet 通用骨架

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata: {name: zookeeper}
spec:
  serviceName: zk-headless      # 无头 Service：稳定网络标识
  replicas: 3
  selector: {matchLabels: {app: zookeeper}}
  template:
    metadata: {labels: {app: zookeeper}}
    spec:
      terminationGracePeriodSeconds: 60   # 优雅下线窗口
      containers:
      - name: zk
        image: zookeeper:3.8
        resources:
          requests: {cpu: "1", memory: 2Gi}
          limits: {cpu: "2", memory: 4Gi}
  volumeClaimTemplates:          # 每副本独立 PVC
  - metadata: {name: data}
    spec:
      accessModes: ["ReadWriteOnce"]
      resources: {requests: {storage: 50Gi}}
```

## 三档规格部署建议

| 参数 | 8C16G | 32C256G | 64C512G |
| ---- | ---- | ---- | ---- |
| 角色定位 | 控制面/轻业务 | 通用业务 | 大数据/内存型 |
| max-pods | 60 | 110 | 110 |
| system-reserved | 500m/1Gi | 1C/2Gi | 2C/4Gi |
| kube-reserved | 500m/1Gi | 1C/2Gi | 2C/4Gi |
| 大数据组件实例 | 控制面配套 | 单实例起步 | 多实例/本地盘存储 |
| 容器运行时 | containerd | containerd | containerd + 大数据本地盘 |

:::note
64C512G 节点给大数据组件（HDFS DataNode、Kafka）时，考虑**本地盘 PV（Local PersistentVolume）+ 节点污点**组合：数据本地化保吞吐，污点防止其他业务误调度挤占。本地盘 PV 的代价是"数据绑定节点"——节点故障数据不可达，需要配合组件自身副本（HDFS 副本、Kafka ISR）兜底，而不是依赖 K8S 做数据层容灾。
:::


## 优化检查清单

1. etcd SSD 独立、控制面独立节点
2. 所有工作负载有 requests/limits（Guaranteed 给中间件）
3. JVM 容器化参数（MaxRAMPercentage）就位
4. 节点标签/污点/亲和策略落地
5. HPA 只给无状态业务
6. 本地盘 PV 场景用组件副本兜底数据
