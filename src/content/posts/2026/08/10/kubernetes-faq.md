---
title: "Kubernetes 常见问题排查"
published: 2026-08-10T00:00:00+08:00
updated: 2026-08-10T00:00:00+08:00
tags: ["2026", "kubernetes", "k8s"]
category: "linux"
---

> K8S 排障有固定套路：**先看事件，再看日志，最后看资源状态**。绝大多数问题能通过 `kubectl describe`、`kubectl logs`、`kubectl get events` 三步定位。本文按"Pod 起不来 → 网络不通 → 存储异常 → 控制面异常"的顺序整理高频问题。

## 一、Pod 层问题

### 1. Pod 一直 Pending

排查路径：`kubectl describe pod xxx` 看 Events。

| 事件 | 原因 | 解法 |
| ---- | ---- | ---- |
| `0/1 nodes are available` | 节点资源不足（CPU/内存） | 调小 requests 或加节点 |
| `node(s) had taint` | 节点有污点（如专用节点） | 确认 Pod 是否容忍；业务不该跑在控制面节点 |
| `pod has unbound PersistentVolumeClaims` | PVC 没有可绑定的 PV | 检查存储类与 PV 供给 |
| `failed to fit in any node` | 端口冲突/亲和性不满足 | 看详细拒绝原因 |

### 2. CrashLoopBackOff（反复重启）

```bash
kubectl logs pod xxx --previous   # 看上次退出日志
kubectl get pod -o yaml           # 看 Last State 与退出码
```

常见原因：启动参数错误、配置文件缺失（ConfigMap 未挂载）、探针（liveness）失败被反复杀掉、OOMKilled（看退出码 137）。

:::warning
退出码 137 = 被 OOM Kill；128+signal 系列要先查内存。常见误解：只看日志不看退出码，把 OOM 当业务 bug 排查，浪费半天。
:::


### 3. ImagePullBackOff

- 镜像不存在/标签写错：`kubectl describe` 有 `ErrImagePull` 详情
- 私有仓库认证失败：配置 imagePullSecrets
- 节点无法访问镜像仓库：内网环境需配置 mirror 或离线导入

### 4. Running 但不健康（探针问题）

- readiness 失败：流量不转发但 Pod 在跑；查就绪探针路径与端口
- liveness 失败：被杀重启——探针超时设置不合理（如 Java 启动慢，initialDelay 太短）

## 二、网络层问题

### 1. Service 访问不通

排查顺序：

```bash
kubectl get endpoints <svc>      # 1. 后端 Pod 是否有 Endpoint
kubectl get pods -o wide         # 2. Pod 是否 Ready、IP 是否正确
kubectl exec <pod> -- curl <ClusterIP>:<port>   # 3. 集群内直连测试
kubectl describe svc <svc>       # 4. 选择器与标签是否匹配
```

:::note
`Endpoints 为空`是最常见的 Service 不通原因——Service 的 selector 与 Pod 的 labels 不一致，流量没有后端可转发。
:::


### 2. Pod 间跨节点不通

- CNI 插件状态：`kubectl get pods -n kube-system` 看 calico/flannel Pod
- 节点防火墙（iptables 规则被清空或塞满）
- 大集群 Calico 的 BGP 对端数过多导致路由收敛慢

### 3. DNS 解析失败

- CoreDNS Pod 是否 Running、`kubectl -n kube-system logs -l k8s-app=kube-dns` 看报错
- Pod 的 `/etc/resolv.conf` 是否指向 CoreDNS
- 自定义域名需 ConfigMap 配置 ndots/search 域

### 4. 节点端口访问（NodePort）不通

- NodePort 端口区间（30000~32767）确认、宿主机防火墙放行
- kube-proxy 是否运行正常（iptables/IPVS 规则生成）

## 三、存储层问题

| 现象 | 原因 | 解法 |
| ---- | ---- | ---- |
| PVC Pending | 存储类不存在或 PV 供给失败 | `kubectl get storageclass`、查 CSI 插件 |
| Pod 卡 Terminating | 挂载卷卸载不掉（NFS 断连） | 强制删除（`--grace-period=0 --force`）后清理节点挂载点 |
| 数据丢失 | 本地盘 PV 节点故障 | 本地盘只能单节点，关键数据用网络存储或副本 |
| 挂载慢/超时 | CSI 插件与存储后端 IO 高 | 查存储集群与 CSI 日志 |

## 四、控制面问题

### 1. apiserver 不可用

- etcd 健康：`etcdctl endpoint health`；etcd 磁盘慢/满 → 整个集群"假死"
- 证书过期：K8S 1.20 后证书 1 年，`kubeadm certs renew all` 或升级

### 2. 节点 NotReady

```bash
kubectl get nodes
kubectl describe node <node>     # 看 Ready 条件与最近心跳
journalctl -u kubelet -f         # kubelet 日志
```

常见：kubelet 挂掉、磁盘满（`--eviction-hard` 驱逐）、docker/containerd 挂掉、节点网络到 apiserver 不通。

### 3. 集群证书问题

- `Unable to connect to the server: x509: certificate has expired`
- kubeadm 集群：`kubeadm certs check-expiration` 检查，`kubeadm certs renew all` 续期并滚动重启组件

## 五、通用排障方法论

1. **看事件**：`kubectl describe` 的 Events 是排障起点，90% 的问题在这里给出原因
2. **看日志**：Pod 内多个容器用 `-c 容器名`；崩溃看 `--previous`；中间件看节点组件日志（kubelet/CNI）
3. **看资源**：`kubectl top node/pod`（需 metrics-server）判断资源水位
4. **复现思维**：临时起一个测试 Pod（`kubectl run -it --image=busybox`）在集群内验证网络与 DNS，把"环境问题"和"业务问题"分开
5. **记录复盘**：每次事故沉淀成 runbook，排障手册是团队最值钱的资产
