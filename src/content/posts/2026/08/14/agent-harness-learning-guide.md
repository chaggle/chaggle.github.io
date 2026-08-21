---
title: "Agent Harness 岗的核心学习方法"
published: 2026-08-14T00:00:00+08:00
updated: 2026-08-14T00:00:00+08:00
tags: ["2026", "DeepSeek", "AI", "Agent", "Harness", "多智能体", "求职"]
category: "AI"
---

> 本文以 DeepSeek Harness 团队「Agent Harness 研发/工程方向」为目标岗位，通过对 bilibili 视频课程与 GitHub 开源项目的调研总结，系统阐述如何训练 Agent 开发与 Harness 工程能力。文章给出从基础到进阶的分阶段实操路线、可复现实验与阶段目标，避免泛泛而谈。

## 目录

1. [岗位定位：Harness 是什么、为什么重要](#1-岗位定位)
2. [核心技能树：从 LLM 基础到 Harness 工程](#2-核心技能树)
3. [bilibili 学习资源：入门到进阶的视频路线](#3-bilibili-学习资源)
4. [GitHub 项目精读：读源码、学架构](#4-github-项目精读)
5. [训练路线：分阶段实操与可复现实验](#5-训练路线)
6. [对标招聘要求：能力映射与面试准备](#6-对标招聘要求)

---

# 1. 岗位定位

## 1.1 一个公式：Model + Harness = Agent

这是目标团队（DeepSeek Harness 团队）写在招聘里的**团队使命**。理解这个公式，就理解了整份 JD：

- **Model（模型）**：经过预训练/后训练的 LLM，提供"智能"本身——推理、知识、代码生成。
- **Agent（智能体）**：能自主完成任务的系统，会拆解目标、调用工具、迭代执行、自我纠错。
- **Harness（中间那一层）**：把模型"装"起来，让它变成 Agent 的**全部工程脚手架**——Agent Loop、工具调用、上下文管理、记忆、多智能体编排、评测、沙箱、可观测性。

打个比方：模型是"发动机"，Harness 是"整车底盘 + 变速箱 + 方向盘 + 仪表盘"。没有 Harness，模型只能回答问题；有了 Harness，模型才能**做事**。这正是为什么这个岗位叫 "Harness" 而不是 "Agent 应用开发"——它关注的是**让 Agent 可靠跑起来的底层系统**，而不是用框架搭一个聊天机器人。

## 1.2 岗位职责拆解

JD 里明确列出了研究/工程/产品三个方向，核心职责可以归纳为四条：

1. **定义并实现 Harness 前沿能力**：上下文管理、长期记忆、Subagent 与 Multi-Agent、自进化 Agent、超长程任务。
2. **模型与 Harness 的深度适配**：与模型训练团队协作，让 Harness 和模型"共同进化"（而不是 Harness 单向适配模型）。
3. **构建评测体系**：提出基准测试与评测方法、构建评测数据、制定标注策略，从 Harness 角度持续优化 Agent 智能水平。
4. **以真实任务为反馈源**：把用户反馈、真实世界任务变成数据与实验，持续迭代 Agent 在真实场景的表现。

## 1.3 核心价值：Harness 是 Agent 的"护城河"

为什么专门设一个 Harness 团队，而不是让普通后端工程师顺便做？因为**模型能力在快速平价化，而 Harness 工程是差异化竞争点**：

- 同样的模型，Harness 的好坏直接决定 Agent 能不能处理**超长程、多步骤、需记忆、需协作**的真实任务。
- 评测（eval）决定了团队能不能**量化**"Agent 是否真的变强了"，这是模型与 Harness 共同进化的前提。
- 上下文管理与记忆机制，直接决定 Agent 在真实工作流里的"续航能力"和"智商天花板"。

一句话总结：**Harness 工程师是"模型之上的系统工程师"**，既要有算法品味（理解模型行为），又要有工程硬功（状态管理、并发、沙箱、可观测性）。

---

# 2. 核心技能树

对照 JD 的关键词，可以把 Harness 岗的技能树拆成七层，从下到上：

| 层级 | 技能域 | 关键知识点（JD 原词） | 掌握标准 |
|---|---|---|---|
| L1 基础 | LLM 机制 | LLM API、**KV Cache**、token、上下文窗口、推理/思考模型 | 能解释 KV Cache 为何是长上下文/长任务的性能瓶颈 |
| L2 核心 | Agent 机制 | **Agent Loop**、**Tool Use**、**Reasoning**、**Planning** | 能手写 ReAct Loop，理解 ReAct/CoT/Reflexion/ToT 的差异 |
| L3 上下文 | 上下文工程 | **Prompt Engineering**、**Context Engineering**、**Memory**、上下文压缩/卸载 | 能设计记忆分层 + 上下文窗口管理策略 |
| L4 工具 | 工具与协议 | **Skills**、**MCP**、工具注册/沙箱/权限 | 能写 MCP Server、封装工具、设计工具 schema |
| L5 编排 | 多智能体 | **Subagent**、**Multi-Agent**、编排模式、通信 | 能手写 supervisor / handoff / 图编排三种模式 |
| L6 评测 | 评测体系 | benchmark、eval harness、trajectory scoring、pass@k | 能搭一套可复现评测 + 做 error analysis |
| L7 工程 | 工程化 | 框架选型、状态持久化、checkpoint、可观测性、沙箱、部署 | 能做 durable execution、human-in-the-loop |

## 2.1 三个 Engineering 课题（JD 反复强调）

JD 里把三个概念并列提出，这是 Harness 岗的**理论主线**，值得单独拎出来：

- **Prompt Engineering（提示词工程）**：让单次调用输出高质量结果。入门门槛低，但天花板在于"结构化输出、少样本、指令设计"。
- **Context Engineering（上下文工程）**：**把"给模型什么上下文"当成一个系统问题来设计**——哪些历史要保留、哪些工具结果要压缩、如何分层记忆、如何做上下文卸载（offload）。这是 Harness 岗与普通 Agent 教程的核心分野。
- **Harness Engineering（Harness 工程）**：把上面所有东西做成**可靠、可评测、可观测、可复现**的系统——状态图、checkpoint、并发、沙箱、评测闭环。

一句话记忆：**Prompt 管"一次调用"，Context 管"一个会话"，Harness 管"整个系统"。**

## 2.2 一个隐藏技能：成为 Agent 产品"重度用户"

JD 每个方向都要求"深度使用过代码类及通用类 Agent 产品"（Claude Code、Cursor、Codex、Manus、OpenClaw、Hermes 等），并且"把使用融入工作生活"。这不是客套话——**对模型行为有品味、有判断力，只能靠大量真实使用积累**。这也是后面训练路线里"阶段 0"要做的第一件事。

---

# 3. bilibili 学习资源

调研结论：B 站上的 Agent 课程主要分**四类**，各自解决不同问题。按学习顺序推荐如下。

| 优先级 | 资源 / UP主 | BV 号 / 链接 | 解决什么问题 | 适合阶段 |
|---|---|---|---|---|
| ★★★ | 吴恩达《Agentic AI》 | `BV1aaxyz8ELY`、`BV1DfrdByE2H` | 四大设计模式（反思/工具/规划/多智能体）、**evals 评估**、MCP，官方中英字幕 | 入门→进阶 |
| ★★★ | 李宏毅《AI Agent 系统设计》2025/2026 | `BV1o3wvzUEDD` | 零基础概念入门，"复仇者联盟"类比多智能体，生动易懂 | 零基础 |
| ★★★ | 微软《AI Agents for Beginners》 | `BV18TZYY8EuJ`（GitHub 5万+星，12 课时中文） | 系统性：从概念到工具调用、记忆、多智能体全覆盖 | 零基础→入门 |
| ★★☆ | 李沐《动手学 AI Agent》 | B 站搜"李沐 Agent" | 从零手搓多智能体框架，**ReAct/AutoGPT 论文逐句精读** | 进阶 |
| ★★☆ | 尚硅谷 LangChain / LangGraph 实战 | B 站搜"尚硅谷 LangChain" | 框架 API 实战，工程落地 | 入门→进阶 |
| ★★☆ | Hugging Face《Agents Course》 | B 站搜"HF Agents Course"（官网 huggingface.co/learn/agents-course） | 生产级框架 smolagents / LangGraph 实战，补"跑得起来"的缺口 | 进阶 |
| ★☆☆ | 各类 MCP / Claude Code 实战视频 | 如 `BV1oecTzKELA`（86 集 LLM+MCP 实战） | 工具协议与真实 Agent 产品上手 | 全程穿插 |

**几点选课建议（避免踩坑）**：

1. **先刷吴恩达《Agentic AI》**：它把"反思、工具使用、规划、多智能体"四个设计模式和 **evals（评估）** 讲得最清楚，而 evals 恰恰是 Harness 岗最核心、也是绝大多数教程最缺的一块。
2. **李宏毅负责"建立直觉"**，微软《AI Agents for Beginners》负责"系统覆盖"——两个二选一即可，都看完反而拖节奏。
3. **框架类视频（LangChain/LangGraph）不要只看不写**。B 站教程普遍"演示多、原理解释少"，看完一定要配合第 5 节的动手项目。
4. **警惕"全 X 百集、七天成大神"类搬运合集**：这类视频多为营销搬运，结构松散、无版权标注。优先选 UP 主本人或官方频道（DeepLearning.AI、Hugging Face、Datawhale 等）的内容。

---

# 4. GitHub 项目精读

GitHub 项目分三类精读：**评测 Harness**（对标 "harness" 本义，最重要）、**Agent 框架**（学架构）、**手搓/教学项目**（练工程感）。

## 4.1 评测 Harness：理解 "harness" 一词的出处

**EleutherAI/lm-evaluation-harness**（11k+ star）

- **架构**：把评测拆成"模型接口"与"任务定义"两半。任何模型只需实现 `lm_eval.api.model.LM` 的三个原语——`loglikelihood`（多选题对数概率）、`loglikelihood_rolling`（困惑度）、`generate_until`（自由生成）——即可接入 60+ 标准基准。任务从 v0.4.0 起从 Python 子类迁移到 **YAML 配置**，降低加新 benchmark 门槛。
- **可借鉴的 Harness 实践**：① 统一抽象（模型后端与任务解耦）；② YAML 声明式任务定义；③ 结果缓存保证可复现；④ 任务版本号（task version）确保跨时间对比公平。它是 Hugging Face Open LLM Leaderboard 的评测后端，是"评测 harness"的事实标准。

**SWE-bench / SWE-agent**（Princeton）

- **架构**：SWE-bench 收集 2294 个真实 GitHub issue + 对应 PR，用 **FAIL_TO_PASS / PASS_TO_PASS** 测试作为评测信号——模型要改代码让原本失败的测试通过。SWE-agent 是第一个基于 Agent 的系统，用 ReAct 循环 + **Agent-Computer Interface（ACI）** 设计（精简的文件/编辑/搜索工具）刷出 12.47% 的 baseline。
- **可借鉴的 Harness 实践**：① **执行即评测**（execution-graded，跑测试而不是看文本相似度）；② 工具接口设计（ACI）对 Agent 性能影响巨大；③ 轨迹打分（trajectory scoring）能区分"差一步就对"和"完全跑偏"两种失败——这是比"最终对错"更细粒度的评测信号。

**All-Hands-AI/OpenHands（原 OpenDevin）**

- **架构**：代码 Agent 平台，基于 **事件流（event stream）架构**，Agent 的每个 action/observation 都是事件，可回放、可注入、可评测。内置 CodeActAgent（统一 action space：把"动作"统一为"执行一段代码"）。
- **可借鉴的 Harness 实践**：事件流让 Agent 执行**完全可审计、可回放、可作为训练数据**——这正是"以真实任务为反馈源、持续迭代"的落地形态。

其他值得扫一眼的评测项目：`UKGovernmentBEIS/inspect_ai`（自定义 agent eval 的框架，标准化推荐）、`ServiceNow/BrowserGym` + `AgentLab`（Web 环境评测）、`sierra-research/tau-bench`（工具+用户仿真，pass^k 可靠性指标）、`GAIA`/`WebArena`/`AgentBench`/`OSWorld`（多环境基准）。

## 4.2 Agent 框架：读架构、学取舍

调研结论（2026 年年中，star 数与版本随时变动，以下为方向性结论）：

| 框架 | 心智模型 | 核心原语 | 何时用 |
|---|---|---|---|
| **LangGraph**（langchain-ai） | 状态图 | StateGraph、checkpointer、human-in-the-loop | 生产级多智能体、需持久化/恢复/审批 |
| **AutoGen → Microsoft Agent Framework** | 对话/actor | GroupChat、异步事件 | 开放讨论、红队、辩论（成本偏高） |
| **CrewAI**（crewAIInc） | 角色分工 | role/goal/backstory + crew + process | 内容流水线、快速原型 |
| **OpenAI Agents SDK** | handoff 交接 | Agent + handoffs + guardrails + sessions | 快速交付、OpenAI 生态 |
| **smolagents**（huggingface） | code-first | CodeAgent（让 LLM 写 Python） | 可审计、极简、HF 生态 |

**关键取舍（面试常考）**：

- **LangGraph 是生产默认**：durable execution（crash 后从 checkpoint 恢复）、human-in-the-loop、时间旅行调试。代价是学习曲线陡、对简单 agent 显得重。
- **AutoGen 的 GroupChat 成本失控**：同一任务可能多出 5~6 倍 token 调用，因为每轮都拉全量 transcript 进上下文——这是"编排方式决定成本"的典型例证。
- **smolagents 的"code-first"是趋势**：让 LLM 直接写代码而非走严格的 function-calling 格式，动作空间更灵活、可审计性更好，值得精读其 ~1000 行核心源码。
- **OpenAI Agents SDK 的 handoff 是"委派即原语"**：triage agent 判断意图后交接给专家 agent，状态通过对话历史流动，心智模型干净但状态默认短暂。

**读源码建议**：不要五个都读。**精读 smolagents（最小可读）→ 精读 LangGraph（生产代表）**，其余读文档 + 跑 demo 即可。

## 4.3 手搓/教学项目：练 "harness 工程感"

- **datawhalechina/hello-agents**：从零手搓一个 Agent 框架，无第三方依赖。**强烈推荐**——只有自己搭过状态图、持久化、工作流编排，出问题才知道断在哪。
- **microsoft/ai-agents-for-beginners**：12 课时的系统入门，含完整中文，覆盖 Agent 概念、工具、记忆、多智能体。
- **MCP（modelcontextprotocol）**：不是"项目"而是"协议"，但 `modelcontextprotocol/servers` 是理解 Skills/MCP 工具生态的必读。JD 明确把 MCP、Skills 列为知识点。

---

# 5. 训练路线

从零到对标岗位，按 6 个阶段推进。每阶段给出**目标、动手项目、可复现实验、验收标准**。总周期建议 3~6 个月（有后端/算法基础可压缩）。

## 阶段 0：成为 Agent 重度用户 + 补 LLM 基础（1~2 周）

- **目标**：建立"对模型行为的品味"，这是 JD 反复要求、面试最难伪装的能力。
- **动手**：把 Claude Code / Cursor 接入你的日常——用它们写代码、读代码库、重构。记录：什么时候它"神"，什么时候它"蠢"（死循环、改错文件、忘记目标）。
- **实验**：同一个任务，分别用 Cursor、Claude Code、Manus 跑，对比工具调用轨迹、失败模式、token 消耗。
- **验收**：能写出 200 字的"Agent 行为观察笔记"，能解释 KV Cache 为什么是长任务瓶颈。

## 阶段 1：手搓最小 Agent Loop（2~3 周）

- **目标**：不依赖任何框架，理解 Agent Loop / Tool Use / ReAct 的底层。
- **动手项目**：用 Python 写一个 ReAct Agent——LLM 输出 `Thought → Action → Observation` 循环，调用 2~3 个真实工具（搜索、计算器、文件读写）。
- **可复现实验**：① 对比"带 ReAct 循环" vs "单次生成"解决多步任务的正确率；② 加入 max_iteration / 循环检测，观察死循环如何被切断。
- **验收**：核心循环 < 200 行可读代码；能画出 ReAct 的状态机图。

```python
# 最小 ReAct 循环（伪代码，用于理解，非生产实现）
def react_loop(task: str, tools: dict, llm, max_iter: int = 10):
    messages = [{"role": "system", "content": SYS_PROMPT}]  # 包含工具 schema
    messages.append({"role": "user", "content": task})
    for _ in range(max_iter):
        out = llm(messages)                    # Thought + Action(JSON)
        thought, action = parse(out)           # 解析出动作与参数
        if action.name == "finish":
            return action.args["answer"]       # 终止
        obs = tools[action.name](**action.args)  # 执行工具，得到 Observation
        messages.append({"role": "assistant", "content": out})
        messages.append({"role": "user", "content": f"Observation: {obs}"})
    raise TimeoutError("agent loop 超过最大迭代")
```

## 阶段 2：框架实战 + 上下文工程（3~4 周）

- **目标**：用 LangGraph 落地，重点攻克**记忆与上下文管理**。
- **动手项目**：把阶段 1 的 Agent 用 LangGraph 重写，加入 ① `checkpointer`（持久化，crash 后恢复）；② 短期记忆（滑动窗口）+ 长期记忆（向量库/摘要）；③ human-in-the-loop 审批节点。
- **可复现实验**：对比"无记忆 vs 滑动窗口 vs 摘要压缩"在长对话任务中的 token 消耗与正确率，量化上下文管理收益。
- **验收**：能解释 StateGraph 的状态流；能实现 checkpoint 恢复与时间旅行调试。

## 阶段 3：多智能体编排 + MCP 工具生态（3~4 周）

- **目标**：掌握 Subagent / Multi-Agent 与工具协议。
- **动手项目**：实现一个 supervisor 模式的多智能体（研究员 + 写手 + 评审），并写一个自定义 **MCP Server** 让 Agent 调用。
- **可复现实验**：对比"单 Agent" vs "supervisor 多 Agent" vs "GroupChat 多 Agent"在同一任务上的成功率与成本，验证"编排方式决定成本"。
- **验收**：能手写 handoff / 图编排 / supervisor 三种模式并说清取舍。

## 阶段 4：评测体系（4~6 周，Harness 岗核心）

- **目标**：搭一套**可复现的 eval harness**，这是与普通 Agent 开发者拉开差距的关键。
- **动手项目**：① 用 `lm-evaluation-harness` 的 YAML 自定义一个任务；② 用 SWE-bench Lite 跑一个基线 Agent（可参考 smolagents 或 SWE-agent 的最小实现）；③ 自建 20~50 题的个人 benchmark，对阶段 1~3 的 Agent 做 error analysis。
- **可复现实验**：对同一 Agent 分别做 outcome 打分 vs trajectory 打分，验证"最终对错"如何掩盖"差一步就对"。
- **验收**：能写出一份 eval 报告，含失败模式分类 + 下一步改进优先级（这正是吴恩达《Agentic AI》模块 4 讲的"误差分析"）。

## 阶段 5：真实项目 + 开源贡献（长期）

- **目标**：把能力沉淀为**可展示的开源作品**（JD 加分项）。
- **动手项目**：做一个端到端的 Agent 产品（如代码维护 Agent、研究 Agent、数据分析 Agent），开源并写好 README、eval 结果、trace 回放。
- **复现实验**：提交 PR 给 smolagents / LangGraph / lm-eval / SWE-bench 等社区（哪怕修文档、加 test）。
- **验收**：有 1~2 个能放进简历的开源项目 + 若干社区 PR。

---

# 6. 对标招聘要求

把 JD 的任职要求逐条映射成"学习完成后应具备的能力"，并给出面试准备方向。

## 6.1 能力映射表

| JD 要求（研发/工程方向） | 对应训练阶段 | 面试验证方式 |
|---|---|---|
| 熟悉 LLM + Agent 机制（LLM API、KV Cache、Agent Loop、Tool Use、Reasoning、Planning、Skills、MCP、Memory、Subagent、Multi-Agent） | 阶段 0~3 | 白板画 Agent Loop 状态机；解释 KV Cache；比较编排模式 |
| 深入理解 Prompt / Context / Harness Engineering | 阶段 2、4 | 现场设计一个记忆分层 + 上下文窗口管理方案 |
| 熟练使用 AI Agent 工具做软件开发 | 阶段 0 贯穿全程 | 展示你用 Claude Code/Cursor 做项目的实际经历与效率收益 |
| 是 Agent 产品重度用户，对模型行为有品味 | 阶段 0 | 谈对某个 Agent 产品"神/蠢"时刻的具体观察 |
| 技术水平过硬、眼界广阔（架构与选型） | 阶段 2~4 | 框架选型题：什么场景选 LangGraph 还是 smolagents |
| 真实任务作反馈源、持续迭代产品 | 阶段 4、5 | 讲你的 eval → error analysis → 改进闭环 |

## 6.2 面试准备清单

1. **三个必答理论题**：① 什么是 Harness，Model + Harness = Agent 怎么理解；② Prompt / Context / Harness Engineering 三者的边界；③ 评测的 outcome vs trajectory 打分差异。
2. **一个必带的项目**：一个**带评测、带 trace、开源**的 Agent 项目（阶段 5 的产出），重点讲"我怎么评测它、怎么改进它"。
3. **三个可现场手撕的小题**：手写 ReAct Loop、设计一个 MCP 工具 schema、画一个 supervisor 多智能体的状态图。
4. **一页"产品观察"**：你深度使用过的 2~3 个 Agent 产品，各自的优点、失败模式、你作为 Harness 工程师会怎么改。

## 6.3 简历项目建议（按含金量排序）

1. 一个**自建 eval harness + benchmark + error analysis 报告**（最稀缺、最对味）。
2. 一个**多智能体 + 记忆 + 持久化的端到端产品**（LangGraph 实现）。
3. 一个**最小可读的 ReAct/CodeAct Agent 框架**（手搓，展示工程功底）。
4. 开源社区 PR（哪怕小，证明能跟社区协作）。

---

# 总结

Harness 岗的本质是：**在模型之上做"可靠系统"的人**。学习路径的底层逻辑只有一条——**先成为 Agent 的重度用户（建立品味），再手搓理解底层（建立直觉），然后上框架做工程（建立硬功），最后用评测闭环迭代（建立判断力）**。B 站负责补"概念与直觉"，GitHub 源码负责补"架构与工程感"，而真正拉开差距的，永远是你自己搭的那套 eval harness 和那份 error analysis 报告。

## 参考资料

**岗位**

- DeepSeek Harness 团队招聘（mokahr）：`https://app.mokahr.com/social-recruitment/high-flyer/140576#/job/8d40c764-d2b2-49b1-826c-e3f2adb75c01`

**bilibili 视频**

- 吴恩达《Agentic AI》：`BV1aaxyz8ELY`、`BV1DfrdByE2H`
- 李宏毅《AI Agent 系统设计》2026：`BV1o3wvzUEDD`
- 微软《AI Agents for Beginners》B 站版：`BV18TZYY8EuJ`
- 李沐《动手学 AI Agent》：B 站搜"李沐 Agent"
- Hugging Face Agents Course：`huggingface.co/learn/agents-course`

**GitHub 项目**

- 评测 Harness：`EleutherAI/lm-evaluation-harness`、`SWE-bench/SWE-bench`、`SWE-agent/SWE-agent`、`All-Hands-AI/OpenHands`、`UKGovernmentBEIS/inspect_ai`
- Agent 框架：`langchain-ai/langgraph`、`microsoft/autogen`（→ Microsoft Agent Framework）、`crewAIInc/crewAI`、`openai/openai-agents-python`、`huggingface/smolagents`
- 教学/手搓：`datawhalechina/hello-agents`、`microsoft/ai-agents-for-beginners`
- 协议：`modelcontextprotocol/servers`

**经典论文（按需精读）**

- ReAct（arXiv:2210.03629）、Chain-of-Thought（arXiv:2201.11903）、Reflexion、Tree of Thoughts
- SWE-bench（Jimenez et al., ICLR 2024）、CodeAct（OpenHands）、GAIA、WebArena、τ-bench、AgentBench
