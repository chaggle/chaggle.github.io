---
title: "Centos 8.2 中 Git 安装"
published: 2021-10-15T20:18:42+08:00
updated: 2022-02-22T12:35:34+08:00
tags: ["git", "centos", "middleware"]
category: "middleware"
---

## 安装依赖包

```bash
# 系统为 centos8.2 版本，可能会出现系统版本不兼容等问题！
sudo yum -y install make autoconf automake cmake perl-CPAN libcurl-devel libtool gcc gcc-c++ glibc-headers zlib-devel git-lfs telnet ctags lrzsz jq expat-devel openssl-devel
```

## 安装新版 Git 包

```bash
cd /tmp
wget https://mirrors.edge.kernel.org/pub/software/scm/git/git-2.30.2.tar.gz
tar -xvzf git-2.30.2.tar.gz
cd git-2.30.2/
./configure
make
sudo make install
git --version          # 输出 git 版本号，说明安装成功
git version 2.30.2
```

## 常用配置命令

```sh
git config --global user.name "chaggle"  用户名改成自己的
git config --global user.email "chaggle@foxmail.com" 邮箱改成自己的
git config --global credential.helper store
git config --global core.longpaths true

# 在 Git 中，我们会把非 ASCII 字符叫做 Unusual 字符。这类字符在 Git 输出到终端的时候默认是用 8 进制转义字符输出的（以防乱码），但现在的终端多数都支持直接显示非 ASCII 字符，所以我们可以关闭掉这个特性
git config --global core.quotepath off

# 访问 github.com 太慢，可以通过国内 GitHub 镜像网站来访问
git config --global url."https://gitclone.com/".insteadOf "https://"

# GitHub 限制最大只能克隆 100M 的单个文件，为了能够克隆大于 100M 的文件，我们还需要安装 Git Large File Storage
git lfs install --skip-repo
```

## GitHub 代理配置

这里博主为了稳定性考虑，只推荐 https://gitclone.com 网站，其余的代理都容易失效

```bash
#原地址
git clone https://github.com/kubernetes/kubernetes.git
#改为
git clone https://gitclone.com/github.com/kubernetes/kubernetes.git
```

但是提交 Git 仓库的时候，需要将代理地址进行还原，否则就会上传到代理地址对应的 Git 仓库！

## HTTPS 与 SSH clone 的稳定性问题

一般建议在网络环境友好的情况下使用 HTTPS 协议，配置简单；而网络环境差的情况下使用 SSH 协议，因为 SSH 建立的传输链接不容易丢失。
