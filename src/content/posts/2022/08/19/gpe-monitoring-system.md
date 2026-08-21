---
title: "GPE 监控系统分析与搭建"
published: 2022-08-19T08:48:36+08:00
updated: 2022-08-19T08:48:36+08:00
tags: ["GPE", "prometheus", "grafana", "middleware"]
category: "middleware"
---

> Grafana + Prometheus + Exporter 监控体系的搭建

## Prometheus 的监控体系

### 系统层监控（需要监控的数据）

> 1、CPU、Load、Memory、swap、disk i/o、process 等
> 2、网络监控：网络设备、工作负载、网络延迟、丢包率等

### 中间件及基础设施类监控

> 1、消息中间件：kafka、redis、RocketMQ 等消息代理/中间件
> 2、WEB 服务器容器：tomcat、weblogic、apache、php、spring 系列
> 3、数据库/缓存数据库：MySQL、PostgreSQL、MongoDB、es、redis

### 应用层监控

**用于衡量应用程序代码状态和性能**

> 1. 白盒监控：自省指标，等待被下载
> 2. 黑盒监控：基于探针的监控方式，不会主动干预、影响数据

### 业务层监控

**用于衡量应用程序的价值**

> 1. 如电商业务的销售量，QPS、dau 日活、转化率等。
> 2. 业务接口：登入数量，注册数、订单量、搜索量和支付量。

## Prometheus 监控系统安装流程

prometheus + alertmanager + node_exporter 下载来源可以有以下三种：

> 1、官网下载：https://prometheus.io/download/
> 2、github 下载：https://github.com/prometheus/prometheus
> 3、github 镜像下载：https://hub.fastgit.xyz/prometheus/prometheus

下载完毕后按如下 shell 先进行解压操作：

```bash
# 本次采用 prometheus-2.37.0.linux 版本进行操作
tar -zxvf prometheus-2.37.0.linux-amd64.tar.gz
mv prometheus-2.37.0.linux-amd64 prometheus-2.37.0

# 本次将 alertmanager 一起都装好，采用 0.24.0.linux-amd64 版本进行操作
tar -zxvf alertmanager-0.24.0.linux-amd64.tar.gz
mv alertmanager-0.24.0.linux-amd64 alertmanager-0.24.0

# 本次 node_exporter 版本为 1.3.1.linux-amd64 版本
tar -zxvf node_exporter-1.3.1.linux-amd64.tar.gz
mv node_exporter-1.3.1.linux-amd64/ node_exporter-1.3.1
```

然后编辑其中的 yml 配置文件（如下所示），更改成自己需要的环境，重点在 job 那一块。

```yaml
# my global config
global:
  scrape_interval: 15s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.
  # scrape_timeout is set to the global default (10s).

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
          # - alertmanager:9093

# Load rules once and periodically evaluate them according to the global 'evaluation_interval'.
rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

# A scrape configuration containing exactly one endpoint to scrape:
# Here it's Prometheus itself.
scrape_configs:
  # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
  - job_name: "prometheus"

    # metrics_path defaults to '/metrics'
    # scheme defaults to 'http'.

    static_configs:
      - targets: ["localhost:9090"]

  - job_name: "k12_zs_01"

    static_configs:
      - targets: ["localhost:9100"]
```

需要监控的内容直接在 job_name 新增字段即可，其中 node_exporter 默认监听端口为 9100 端口。

```bash
# 因为要查看防火墙的状态
systemctl status firewalld

# 开放端口(可批量)
firewall-cmd --zone=public --add-port=9100/tcp --permanent && firewall-cmd --reload

# 关闭端口(可批量)
firewall-cmd --zone=public --remove-port=9100/tcp --permanent && firewall-cmd --reload

# 查看开放端口
firewall-cmd --zone=public --list-ports
```

之后开始装 Grafana，其中 shell 操作如下：

```bash
# 2022年8月19日最新版本为 grafana-enterprise-9.1.0.linux-amd64，使用二进制包更合适
wget https://dl.grafana.com/enterprise/release/grafana-enterprise-9.1.0.linux-amd64.tar.gz

# 解压之后不用改名
tar -zxvf grafana-enterprise-9.1.0.linux-amd64.tar.gz
```
