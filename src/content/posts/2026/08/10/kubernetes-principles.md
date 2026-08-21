---
title: "Kubernetes 底层原理"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "kubernetes", "k8s"]
category: "linux"
---

> Kubernetes（K8S）是容器编排的事实标准。理解它的底层原理，记住一条主线就够：**声明式 API + 控制器循环**——用户声明"我要 3 个副本"，控制器不停地对比"现状"与"期望"并拉齐。本文梳理控制面、数据面、调度、网络、存储五大块。

## 整体架构

```
┌─ 控制面（Master）────────────────────────┐
│  kube-apiserver（唯一入口，RESTful API）   │
│  etcd（集群状态存储，共识层）              │
│  kube-scheduler（调度器）                 │
│  controller-manager（控制器们）           │
└──────────────────────────────────────────┘
            │ API
┌───────────▼──────────────────────────────┐
│  数据面（Worker 节点）                    │
│  kubelet（节点代理，管 Pod 生命周期）       │
│  kube-proxy（Service 流量转发）           │
│  容器运行时（containerd / CRI-O）         │
│  网络插件 CNI（Calico / Flannel）         │
└──────────────────────────────────────────┘
```

- **kube-apiserver**：所有组件与用户操作的唯一入口，一切请求走 API；etcd 只允许 apiserver 读写
- **etcd**：集群"真相"存储（期望状态 + 当前状态），选主用 Raft 共识；性能瓶颈在磁盘 IO（fsync）
- **controller-manager**：一堆控制器（Deployment/Node/Namespace...），核心模式是"期望 vs 现状"的调谐循环
- **kubelet**：每个节点的代理，监听 apiserver 下发的 Pod 定义，驱动容器运行时创建/销毁容器
- **kube-proxy**：实现 Service 的虚拟 IP 转发（iptables 或 IPVS 模式）

:::note
**控制器的哲学**：所有对象都有一个 `spec`（期望）和 `status`（现状）。控制器循环执行：读现状 → 对比期望 → 执行动作 → 更新 status。Pod 被删了？控制器发现"现状少一个"，立即补一个——这就是"自愈"的来源。
:::


## 核心对象

| 对象 | 作用 | 关键点 |
| ---- | ---- | ---- |
| Pod | 最小调度单位（一个或多个容器） | 同 Pod 共享网络与存储卷 |
| Deployment | 无状态应用的副本管理 | 滚动更新、回滚、自愈 |
| StatefulSet | 有状态应用（数据库/中间件） | 稳定网络标识（序号）、有序部署 |
| DaemonSet | 每个节点跑一个（监控/日志） | 节点级守护 |
| Service | 稳定的访问入口（ClusterIP） | 负载均衡到一组 Pod |
| Ingress | 七层 HTTP 路由（域名→Service） | 外部访问入口 |
| ConfigMap/Secret | 配置与敏感信息 | Secret 等保存储（etcd 加密） |
| PV/PVC | 持久化存储抽象 | 存储与使用分离 |
| HPA | 按指标自动扩缩副本 | CPU/自定义指标 |

## 调度原理

kube-scheduler 两步走：

1. **过滤（Filter）**：剔除不满足条件的节点（资源不足、污点不匹配、端口冲突）
2. **打分（Score）**：剩余节点按策略打分（资源余量、亲和性、拓扑分布），选最高分

调度结果记录在 Pod 的 `nodeName` 上，kubelet 看到后开始创建容器。调度器可扩展（自定义 scheduler extender）。

## 网络模型

- **Pod 网络**：每个 Pod 一个唯一 IP，Pod 间直接通信（跨节点），由 CNI 插件实现
  - Calico：BGP 路由分发，性能好，大集群主流
  - Flannel：VXLAN/overlay 封装，简单
- **Service 网络**：ClusterIP 是虚拟 IP，kube-proxy 通过 iptables/IPVS 规则把流量转发给后端 Pod（依赖 EndpointSlice）
- **DNS**：CoreDNS 解析 Service 名（`svc.namespace.svc.cluster.local`）

:::note
**Pod IP 不稳定的问题**：Pod 重建 IP 就变，所以业务访问不直连 Pod，而是通过 Service 的稳定虚拟 IP——Service 背后挂一组 Pod，Pod 增减自动更新 Endpoint。
:::


## 存储原理

- **PV（持久卷）**：管理员准备的存储（NFS、本地盘、云盘），对应 CSI 插件接入
- **PVC（持久卷声明）**：用户申请"我要 10G"，控制器把 PVC 绑定到合适的 PV
- **有状态应用**：StatefulSet 每个副本绑定独立 PVC，删除重建后数据仍在（如 Kafka/ZK/MySQL 的 K8S 化）

## 常见架构误区

- **etcd 与 apiserver 合部**：小集群可合部，生产分离；etcd 用 SSD、独立部署、3/5 节点奇数
- **控制面与业务混部**：Worker 节点跑业务与控制面组件混在一起，etcd/调度抖动会拖垮业务；生产控制面独立节点
- **不用网络策略**：K8S 默认网络平面全通，生产必须 NetworkPolicy（Calico 实现）收敛东西向流量
- **Pod 无资源限制**：不写 requests/limits 的 Pod 可以吃满节点，见《Kubernetes 部署参数优化》

## 学习路径建议

1. 先玩熟 kubectl 与资源清单（YAML 声明式）
2. 动手验证控制器原理（删 Pod 观察自动重建）
3. 网络：从 Service 转发到 CNI 再到 NetworkPolicy
4. 存储：PV/PVC 与 StatefulSet 落地一个中间件
5. 进阶：调度策略、多集群、Operator 模式
