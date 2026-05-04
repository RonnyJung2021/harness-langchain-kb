# 实现指南 V3：单命令启动后的命令行多轮对话（Harness + Cursor）

> **与 V1 / V2 的关系**  
> - **V1**（[`langchain-pdf-kb-rag-cursor-harness.md`](./langchain-pdf-kb-rag-cursor-harness.md)）：仓库骨架、`ingest` / `ask`、分块、本地向量库、RAG 契约与验收。  
> - **V2**（[`langchain-pdf-kb-rag-cursor-harness-v2.md`](./langchain-pdf-kb-rag-cursor-harness-v2.md)）：仅 Embedding-Vision 向量端点时的增量。  
> 本文 **只写 3.0**：在已有「单次 `pnpm ask -- "…"`」之上，用 **一条命令** 进入 **可连续输入多轮** 的 CLI 会话；不重复脚手架与向量端点说明。

---

## 1. 3.0 在解决什么问题

| 现状（V1 典型） | 3.0 目标 |
|-----------------|----------|
| 每问一次要重新执行 `pnpm ask -- "…"`，进程即退出 | 执行一次如 `pnpm chat`（或你命名的等价脚本），**进程常驻**，在终端里 **多轮输入** |
| 无对话记忆，或仅单轮 | **同一进程内**保留 `messages` 历史；新轮次可引用上文（「前面说的第二点」） |
| RAG 仍按问题检索 | **每一轮用户输入**仍走 **向量检索 → 拼 context → Chat**；不要把「多轮」做成纯聊天而丢掉检索 |

**前置**：`kb_store` 已通过 `pnpm ingest` 建好；环境变量与 V1/V2 一致，无需在本文重复。

---

## 2. 产品行为约定（实现前先定稿）

1. **启动命令**：例如 `pnpm chat` → 打印一行简短说明（如何退出、当前是否已加载 kb）。  
2. **提示符**：如 `你> ` 或 `KB> `，用 `readline`（Node 内置）逐行读取 stdin。  
3. **空行**：忽略或提示再输入，勿当错误退出。  
4. **退出**：`exit`、`quit`、EOF（Ctrl+D）或单独约定 `/bye`；退出前 `readline.close()`，`process.exit(0)`。  
5. **每轮输出**：与现有 `ask` 对齐 Harness——先 **检索引用摘要**，再 **模型回答**；可选在 DEBUG 下打印本轮 history 条数。  
6. **与旧 CLI 共存**：保留 `pnpm ask -- "…"` 单轮模式；`chat` 为新增入口（新文件如 `src/chat.ts` + `package.json` 的 `chat` 脚本）。

---

## 3. 技术要点（最小实现面）

### 3.1 入口与循环

- 使用 `node:readline` 的 `createInterface({ input: process.stdin, output: process.stdout })`。  
- **启动时只做一次**：`loadMemoryVectorStoreFromKb`（与 `ask.ts` 相同），避免每轮重复读盘；若加载失败，打印错误并 `process.exit(1)`。  
- **循环**：`question = await rl.question(prompt)` → trim → 判空/退出词 → 否则进入 RAG + Chat。

### 3.2 多轮与 RAG 的组合方式（推荐默认）

- **内存**：`BaseMessage[]` 或 `{ role, content }[]`，每轮追加 `HumanMessage` 与 `AIMessage`。  
- **检索**：对 **当前轮用户原文** 做 `embedQuery` + `similaritySearchWithScore`（或复用现有 `retrieveWithThreshold`），得到本轮 `context` 字符串。  
- **发给模型**：System（固定 RAG 说明）+ 可选「以下为检索片段」+ **本轮 context** + **最近 N 轮对话**（见下节裁剪）+ **本轮问题**。  
- **不要把整本书拼进 history**：知识仍以 **检索片段** 为主；history 只承载指代、追问语气。

### 3.3 Token / 长度裁剪（必做，否则多轮必炸）

- 常量：`CHAT_HISTORY_MAX_MESSAGES`（如只保留最近 8 条「用户+助手」对）或 `CHAT_HISTORY_MAX_CHARS`。  
- 在拼 `messages` 进 `invoke` 前 **从旧到新截断**；System + 本轮检索 context **优先生效**，再塞 history。  
- 可选环境变量：`CHAT_HISTORY_MAX_TURNS`，默认合理值写进 `.env.example` 一行注释即可。

### 3.4 代码复用

- 将 `ask.ts` 中「加载 store → 检索 → `buildContextFromDocs` → `answerFromContext`」抽成 **纯函数**（如 `askOnce(question): Promise<{ citationsText, answer }>`），`ask.ts` 与 `chat.ts` **共用**，避免两套 RAG 逻辑分叉。

---

## 4. 发给 Cursor Agent 的「单条任务」（3.0 专用，可直接粘贴）

```text
本仓库已有 V1 的 ingest / ask（单次问答）。请实现 3.0：单命令启动后命令行多轮对话。

1) 新增 package.json script：chat → tsx src/chat.ts（名称可按仓库习惯，与 ask 并列）。
2) 抽取可复用逻辑：从 ask 流程抽出「加载 kb_store → 检索 → 拼 context → 调 Chat 得到回答」，供 ask.ts 与 chat.ts 共用，避免重复实现 RAG。
3) src/chat.ts：用 node:readline 循环读取用户输入；启动时加载向量库一次；每轮对用户输入做检索+RAG，打印引用摘要再打印回答；维护多轮 message history，并在调用模型前按条数或字符数裁剪 history。
4) 支持 exit/quit 及 Ctrl+D 优雅退出；空行跳过。
5) README 增加一句：多轮用 pnpm chat；单次仍用 pnpm ask -- "…"。.env.example 可选增加 CHAT_HISTORY 相关说明一行。
6) pnpm run build 通过；不要求改 V2 Vision 文档，除非触及共用 config。

不要复述 V1 全文；与 V1/V2 冲突时以现有仓库结构为准。
```

---

## 5. 3.0 验收清单

- [ ] 仅执行 **一次** `pnpm chat`，可连续输入 ≥3 轮不同问题，均能出引用摘要 + 回答。  
- [ ] 第二轮能利用第一轮语境（例如先问「作者是谁」，再问「他做过什么项目」——回答应合理；不强求模型完美指代）。  
- [ ] 长时间对话不因 history 无限增长而明显变慢或 OOM（裁剪生效）。  
- [ ] `pnpm ask -- "某问题"` 行为与改造前一致（回归单轮路径）。  
- [ ] Harness：错误信息仍可读（未 ingest、阈值无命中、Key 错误等）；不提交 `.env`。

---

## 6. 文档版本

- **3.0**：在 V1 单次 `ask` 之上增加 **REPL 式多轮 CLI** 的实现说明与 Agent 任务块。  
- **向量端点 / Vision**：仍以 **V2** 为准；**总流程与自检表** 仍以 **V1** 为准。
