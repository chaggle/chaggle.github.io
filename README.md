# 大布丁的博客

基于 [Fuwari](https://github.com/saicaca/fuwari)（Astro + Svelte + Tailwind CSS）构建的静态博客，部署于 GitHub Pages：https://chaggle.github.io

## 常用命令

```bash
pnpm dev       # 本地预览 http://localhost:4321
pnpm build     # 构建到 dist/
pnpm new-post  # 交互式新建文章
```

## 写文章

文章位于 `src/content/posts/`，front matter 格式：

```yaml
---
title: 文章标题
published: 2026-08-21
description: 可选摘要
tags: ["标签1", "标签2"]
category: 分类
draft: false
---
```

图片放到 `public/images/`，正文中引用 `/images/xxx.png`。

## 部署

推送到 `master` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages（Settings → Pages → Source 选择 "GitHub Actions"）。

> 原 Hexo 版本备份在 `/Users/chaggle/blog`（本机）。
