# 大布丁的博客

> 人格的容纳之地 — 基于 [Fuwari](https://github.com/saicaca/fuwari)（Astro + Svelte + Tailwind CSS）的静态博客。
> 线上地址：<https://chaggle.github.io>

本仓库即是线上仓库：**推送到 `master` 分支后，GitHub Actions 自动构建并部署**，无需手动构建。

---

## 新电脑快速开始

前置要求：**Node.js ≥ 22**、**pnpm**（`npm i -g pnpm` 或 `corepack enable` 后 `corepack prepare pnpm@latest --activate`）。

```bash
# 1. 克隆（这就是全部源码）
git clone https://github.com/chaggle/chaggle.github.io.git
cd chaggle.github.io

# 2. 安装依赖
pnpm install

# 3. 本地预览（自动热更新）
pnpm dev
# 浏览器打开 http://localhost:4321

# 4. 首次提交前配置 git 身份（如果没有）
git config user.name "chaggle"
git config user.email "chaggle@users.noreply.github.com"
```

---

## 写文章

### 方式一：脚本新建（推荐）

```bash
pnpm new-post my-new-post
# 生成 src/content/posts/my-new-post.md，已带好 front matter 模板
```

### 方式二：手动新建

在 `src/content/posts/` 下建 `.md` 文件，front matter 格式：

```yaml
---
title: 文章标题
published: 2026-08-21          # 必填，ISO 日期或日期时间
updated: 2026-08-22            # 可选，最后修改时间
description: 可选摘要            # 不填则自动取正文首段
image: /images/xxx.png         # 可选封面图
tags: ["标签1", "标签2"]
category: 分类                  # 单值；不填则归入未分类
draft: true                    # true = 草稿：本地可见，线上不发布
---
```

> 注：URL 由文件路径决定（`src/content/posts/2026/08/14/foo.md` → `/posts/2026/08/14/foo/`）。
> 放在 `年/月/日/` 子目录里可以保留日期路径，也可直接平铺。

### 图片

- 放到 **`public/images/`**（或 `public/img/`），正文里用 `/images/xxx.png` 引用，无需相对路径
- 封面图（front matter 的 `image`）同理

### 正文常用语法

| 语法 | 说明 |
|---|---|
| `:::note` / `:::tip` / `:::warning` / `:::caution` / `:::important` | 提示框（admonition），内容以 `:::` 结束 |
| `:::note[自定义标题]` | 带标题的提示框 |
| ``` 语言围栏代码块 | 自动高亮 + 行号 + 复制按钮 |
| `$$...$$` | 数学公式（KaTeX） |
| `> [!NOTE]` 等 | GitHub 风格提示框也支持 |
| 标准 Markdown | 表格、引用、任务列表等全部支持 |

### 评论区

文章底部已集成 **Giscus** 评论（基于 GitHub Discussions）：

- 评论数据存在本仓库的 **Discussions** 页签里，直接在 GitHub 上管理/删除
- 访客首次评论时用 GitHub 账号授权即可，无需注册
- 评论区自动跟随博客的亮/暗色主题

---

## 发布

```bash
git add -A
git commit -m "feat: 新文章 xxx"
git push            # 推到 master 即自动部署
```

- 约 **2-3 分钟**后访问 <https://chaggle.github.io> 生效
- 部署进度：仓库 **Actions** 页签查看 `Deploy to GitHub Pages` 工作流
- 推送前建议跑 `pnpm build` 本地验证无报错（可选，Actions 会做同样的事）

---

## 目录结构

```
src/content/posts/   # 所有文章（Markdown）
public/images/       # 文章图片（/images/...）
src/config.ts        # 站点配置：标题、副标题、语言、头像、导航、主题色(hue)
src/content/spec/about.md  # 关于页
astro.config.mjs     # Astro 配置（site 地址、插件）
.github/workflows/   # 构建检查 + 部署工作流
scripts/new-post.js  # 新建文章脚本
```

常用定制入口：
- 主题色：`src/config.ts` → `themeColor.hue`（0-360，改完即可看到）
- 头像：`public/img/chaggle.png`
- 导航/侧边栏链接：`src/config.ts` 的 `navBarConfig` / `profileConfig`

---

## 备份与回滚

- **旧版 Hexo 站**：线上仓库 `hexo-backup` 分支保留了迁移前的完整快照；本机 `/Users/chaggle/blog` 也有源码备份
- **回滚方式**：`git checkout hexo-backup` 后 force push 回 master，并把仓库 Settings → Pages 的 Source 改回 `Deploy from a branch`（master 根目录）

---

## 常见问题

- **`pnpm dev` 报 pnpm 版本错误**：仓库声明 `packageManager: pnpm@9.14.4`，新版 pnpm（11+）也可用；如被 corepack 拦截，执行 `corepack prepare pnpm@9.14.4 --activate` 或直接 `npm i -g pnpm`
- **draft 文章线上看不到**：正常，`draft: true` 只本地可见；删除该字段即可发布
- **分类只有一类**：Fuwari 的 `category` 是单值，多分类需求请用标签（`tags`）补充
- **改了 `src/config.ts` 没生效**：dev 模式热更新，如果没变化就刷新页面；部署以 push 为准
