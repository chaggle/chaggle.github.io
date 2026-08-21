---
title: "在 Linux 下使用 Clash 进行全局上网代理及自动订阅代理和规则"
published: 2025-03-21T15:47:55+08:00
updated: 2025-03-21T15:47:55+08:00
tags: ["clash"]
category: "linux"
---

:::note
本文将详细介绍如何在 Linux 环境下配置 Clash，以实现全局网络代理。
同时使用 proxy-group 与 rule-providers，来实现机场订阅链接和规则的自动订阅。
:::


## 下载 Clash

从以下备份库下载 Clash Premium。由于 Clash Premium 的主库已被删除，我们将使用备份库来获取：[Clash-premium-backup](https://github.com/zhongfly/Clash-premium-backup/releases/download/2023-09-05-gdcc8d87/clash-linux-amd64-n2023-09-05-gdcc8d87.gz)。如果备份库失效，也可以百度搜索 clash for linux 进行下载。

## 解压 Clash

解压下载的文件：

```bash
gzip -d clash-linux-amd64-n2023-09-05-gdcc8d87.gz
chmod +x clash-linux-amd64
mv clash-linux-amd64 clash
```

创建配置文件 config.yaml，并编辑配置：

确保将 `<这里替换为你机场的订阅链接>` 替换为你的实际订阅链接。

这里我们使用了 proxy-groups 和 rule-providers：

- 可以自动订阅节点
- 可以自动订阅规则

当然也可以使用原机场提供的配置文件，但是需要自己手动订阅节点和规则。

```yaml
port: 7890
socks-port: 7891
redir-port: 7892
mixed-port: 7893
allow-lan: false
mode: rule
log-level: info
ipv6: false
external-controller: 127.0.0.1:9091 # 最好不要在公网打开面板进行使用
clash-for-android:
  append-system-dns: false
profile:
  tracing: true
experimental:
  sniff-tls-sni: true

tun:
  enable: true
  stack: system
  dns-hijack:
    - any:53
  auto-route: true
  auto-detect-interface: true

dns:
  enable: true
  enhanced-mode: fake-ip
  listen: :53
  default-nameserver:
      - 210.5.56.145
  nameserver:
      - 114.114.114.114
  fallback:
      - https://8888.google/dns-query
      - https://1.0.0.1/dns-query
      - https://dns.twnic.tw/dns-query
      - https://doh.opendns.com/dns-query
      - https://dns-nyc.aaflalo.me/dns-query
      - https://dns.aa.net.uk/dns-query
      - https://sg.adhole.org/dns-query
      - https://kaitain.restena.lu/dns-query
      - https://hydra.plan9-ns1.com/dns-query
      - https://jp.tiar.app/dns-query
      - https://doh.asia.dnswarden.com/adblock
  fallback-filter:
    geoip: true
    geoip-code: CN

proxy-providers:
  Exemple:
    type: http
    path: ./example.yaml
    url: <这里替换为你机场的订阅链接>
    interval: 3600
    health-check:
      enable: true
      url: http://www.gstatic.com/generate_204
      interval: 300

proxy-groups:
  - name: PROXY
    type: select
    url: http://www.gstatic.com/generate_204
    interval: 3600
    use:
      - Exemple

rule-providers:
  reject:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt"
    path: ./ruleset/reject.yaml
    interval: 86400

  icloud:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt"
    path: ./ruleset/icloud.yaml
    interval: 86400

  apple:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt"
    path: ./ruleset/apple.yaml
    interval: 86400

  google:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt"
    path: ./ruleset/google.yaml
    interval: 86400

  proxy:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt"
    path: ./ruleset/proxy.yaml
    interval: 86400

  direct:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt"
    path: ./ruleset/direct.yaml
    interval: 86400

  private:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt"
    path: ./ruleset/private.yaml
    interval: 86400

  gfw:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt"
    path: ./ruleset/gfw.yaml
    interval: 86400

  tld-not-cn:
    type: http
    behavior: domain
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt"
    path: ./ruleset/tld-not-cn.yaml
    interval: 86400

  telegramcidr:
    type: http
    behavior: ipcidr
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt"
    path: ./ruleset/telegramcidr.yaml
    interval: 86400

  cncidr:
    type: http
    behavior: ipcidr
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt"
    path: ./ruleset/cncidr.yaml
    interval: 86400

  lancidr:
    type: http
    behavior: ipcidr
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt"
    path: ./ruleset/lancidr.yaml
    interval: 86400

  applications:
    type: http
    behavior: classical
    url: "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt"
    path: ./ruleset/applications.yaml
    interval: 86400


rules:
  - RULE-SET,applications,DIRECT
  - DOMAIN,clash.razord.top,DIRECT
  - DOMAIN,yacd.haishan.me,DIRECT
  - RULE-SET,private,DIRECT
  - RULE-SET,reject,REJECT
  - RULE-SET,tld-not-cn,PROXY
  - RULE-SET,gfw,PROXY
  - RULE-SET,google,PROXY
  - RULE-SET,telegramcidr,PROXY
  - MATCH,DIRECT
```

运行 Clash：

```bash
clash -f /path/to/your/config.yaml
# 注意：请替换 /path/to/your/config.yaml 为你的实际配置文件路径。
```

## 配置 systemd 服务

创建一个 systemd 服务文件，例如 /etc/systemd/system/clash.service，内容如下：

```yaml
[Unit]
Description=Clash Service
After=network.target

[Service]
Type=simple
User=<你的用户名>
WorkingDirectory=<Clash配置文件目录>
ExecStart=<Clash执行文件路径> -f <Clash配置文件路径>
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

:::warning
需要替换 `<你的用户名>`、`<Clash 配置文件目录>`、`<Clash 执行文件路径>` 和 `<Clash 配置文件路径>` 为你的实际信息。
:::


重新加载 systemd 管理器配置，并启用 Clash 服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clash.service
systemctl status clash.service
```

启动后需要设置代理环境变量，如果 http 请求不需要走代理，就只需要设置 https_proxy 即可：

```bash
export http_proxy="http://127.0.0.1:7890"
export https_proxy="http://127.0.0.1:7890"
```

此时，Clash 基本安装完毕，但是可能还是无法访问外网，因为 Clash 默认配置是 DIRECT 直连，需要修改配置文件，将 direct 直连修改为 proxy 代理。

### 切换配置

安装 jq 工具，用于解析 JSON 字符串：

```bash
sudo apt install jq
```

利用 curl 命令，打印当前配置文件：

```bash
# 此处的端口在 external-controller 已经配置
curl --request GET --url http://127.0.0.1:9091/proxies
```

配置文件信息太长，只看节点选择策略组选中的节点：

```bash
curl --request GET --url http://127.0.0.1:9091/proxies | jq '.proxies."🚀 节点选择".now'
```

第一次输出结果应该为 DIRECT 直连，此状态下无法翻墙。由于 `🚀 节点选择` 这个策略组包含 emoji 和中文，所以需要进行转义，可以使用如下在线网站进行转义：

[转义网站：https://tool.oschina.net/encode?type=4](https://tool.oschina.net/encode?type=4)

拼接为以下 curl 命令，其中 proxies 后面是你要操作的策略组转义字符串，data 内的 name 对应需要操作的完整节点名：

```bash
curl --request PUT --url "http://127.0.0.1:9091/proxies/%F0%9F%9A%80%20%E8%8A%82%E7%82%B9%E9%80%89%E6%8B%A9" --header "Content-Type: text/plain" --data "{\"name\": \"<替换为你想要选择的节点>\"}"
```

正常操作完不会有返回值，此时我们再次调用命令查看，可看到输出修改的节点。

```bash
curl --request GET --url http://127.0.0.1:9091/proxies | jq '.proxies."🚀 节点选择".now'
```

### 参考链接

如有不懂可自行查阅：[此链接](https://telegra.ph/%E8%8B%A5%E5%B9%B2%E8%BD%AF%E4%BB%B6%E8%AE%BE%E7%BD%AE-CordCloud-11-22)
