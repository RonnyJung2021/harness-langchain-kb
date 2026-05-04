# 实现指南 V2：仅「Embedding-Vision」向量端点时的 PDF RAG（Harness + Cursor）

> **与 V1 的关系**：仓库骨架、Cursor Agent 用法、分块、本地向量库、问答 Harness 契约等 **不变**；见 [`langchain-pdf-kb-rag-cursor-harness.md`](./langchain-pdf-kb-rag-cursor-harness.md)。本文只写 **2.0 场景**：火山方舟侧 **仅能开通 / 仅能使用「多模态向量化（Embedding-Vision）」类端点** 时，你需要额外做对什么、怎么验收。  
> **读者**：已有 V1 思路或仓库，要把向量模型换成 `doubao-embedding-vision`（或控制台展示名称相近的 Vision 向量化接入点）的维护者。

---

## 1. 2.0 在解决什么问题

- **问题**：纯文本 Embedding 端点不可用或不可选，控制台只剩 **Embedding-Vision**（文本 + 图片/视频统一向量空间的一类模型）。  
- **目标**：在 **仍只做「PDF 文本 → 块 → 向量 → RAG」** 的前提下，用 Vision 向量端点跑通 **ingest / ask**，且避免「旧向量库维度与模型不一致」这类隐性故障。

---

## 2. 控制台与环境：与 V1 的差异（仅此几处）

| 项 | V1（纯文本向量） | 2.0（Embedding-Vision） |
|----|------------------|-------------------------|
| 向量端点 | 文本 Embedding 接入点 ID | **多模态向量化 / Embedding-Vision** 接入点 ID（以控制台为准） |
| `ARK_EMBED_MODEL` | 填文本向量 Endpoint ID | 填 **Vision 向量** Endpoint ID |
| `ARK_BASE_URL` | 常用 `https://ark.cn-beijing.volces.com/api/v3` | **以控制台「API 接入」页为准**；若账号走 Coding 等计划，可能是带 `coding` 的路径（与 V1 不同则必须改 `.env`） |
| 对话模型 `ARK_CHAT_MODEL` | 不变 | 不变 |

**动作**：在方舟控制台为 **向量化 API** 单独创建推理接入点，复制 **Base URL + 模型/Endpoint ID**；不要假设与 V1 截图一致。

官方向量化 API 总入口（参数以线上文档为准）：[向量化 API - 火山方舟](https://www.volcengine.com/docs/82379/1521765)。

---

## 3. 代码侧 2.0 必做项（最小改动面）

以下假设仍使用 `@langchain/openai` 的 `OpenAIEmbeddings` 指向方舟 **OpenAI 兼容**向量化接口（Vision 模型在「仅传文本」时通常仍走同一 `embeddings` 形态；若你方 SDK 报错，再按第 5 节降级为手写 `fetch`）。

1. **向量维度契约**  
   - Vision 模型的 **输出维度** 往往与旧文本模型不同。  
   - **要求**：在 `kb_store` 的 manifest（或等价元数据）里写入 **`embeddingModel` + `embeddingDimensions`**；`ask` 加载时若与当前 `ARK_EMBED_MODEL` 或维度不一致，**明确报错并提示执行 `clean:kb` 后全量重新 `pnpm ingest`**，禁止静默混用两套向量。

2. **阈值重标定**  
   - 向量空间变了，原 `RAG_MIN_SIMILARITY`（如 0.35）可能 **全部过滤** 或 **过于宽松**。  
   - **要求**：在 README / 常量处注明「换 Embedding-Vision 后必须先试问答，再调该阈值」；可选把默认略调低并在日志打印 topK 的相似度分布便于一次性标定。

3. **`.env.example` 文案**  
   - 将 `ARK_EMBED_MODEL` 注释改为：**多模态向量化（Embedding-Vision）接入点 ID，非纯文本 Embedding**。  
   - 可选新增一行说明：`ARK_BASE_URL` 必须与该接入点所在 **区域/产品线** 一致。

4. **全量重建**  
   - 切换向量端点后 **必须** 删除旧 `kb_store` 数据再 ingest（与换任意 embedding 模型相同，但 Vision 切换更易踩维度坑，需在文档里写死）。

---

## 4. 发给 Cursor Agent 的「单条任务」（2.0 专用，可直接粘贴）

```text
本仓库已按 V1 指南实现 PDF RAG。现仅使用火山方舟「Embedding-Vision」类向量端点，请做 2.0 最小改动：

1) .env.example：ARK_EMBED_MODEL 注释改为「多模态向量化 / Embedding-Vision 接入点」；补充 ARK_BASE_URL 须与控制台向量化接入一致（含可能的 coding 路径）。
2) 入库写 kb_store manifest（或现有元数据）：记录 embedModel 名称/id 与 embedding 向量维度（从首次 embed 返回推断或查文档常量）。
3) ask 加载向量库：校验 manifest 的模型与维度与当前环境变量一致；不一致则抛清晰错误，提示 clean:kb 后重新 pnpm ingest。
4) README「常见问题」增加一条：切换 Vision 向量后必须重建 kb_store，并重新调 RAG_MIN_SIMILARITY。
5) pnpm run build 通过；不重复实现 V1 已有的大段脚手架说明。

若 OpenAIEmbeddings 对 Vision 端点报错：在 src/embed/ 增加备用实现，用 fetch 调方舟向量化 API（OpenAI 兼容 JSON），与现有 MemoryVectorStore 对接，仍从 config 读 baseURL/apiKey/model。
```

---

## 5. 若 LangChain 默认 Embeddings 与 Vision 端点不兼容

按优先级处理：

1. **先看报错体**：400 多为 `input` 格式或 `model` 字段；401/403 为 Key 或接入点权限。  
2. **仍用 OpenAI 兼容路径**：许多 Vision 向量模型对「纯文本」仍接受 `input: string | string[]`，与 V1 相同；此时仅需第 3 节的维度与 manifest。  
3. **仅当不兼容时**：在 `src/embed/` 实现薄封装（`embedDocuments` / `embedQuery`），内部 `POST {ARK_BASE_URL}/embeddings`（路径以官方文档为准），解析 `data[].embedding`，供 `MemoryVectorStore.fromDocuments` 与检索使用；**不要**在未验证前改写分块与 Chat 流程。

---

## 6. 2.0 验收清单（在 V1 验收之上增加）

- [ ] 使用 **Embedding-Vision** 接入点 ID 填入 `ARK_EMBED_MODEL`，`pnpm ingest` 成功，`kb_store` 中 **维度字段** 与 API 返回一致。  
- [ ] 故意保留旧 kb_store（另一维度或旧模型 manifest）时，`pnpm ask` **失败并提示重建**，而不是乱答。  
- [ ] 同一份 PDF：Vision 向量全流程问答可用；弱相关问题下调节 `RAG_MIN_SIMILARITY` 后行为符合预期。  
- [ ] Harness 其余项（config 集中、路径白名单、不提交 `.env`）仍满足 V1 自检表。

---

## 7. 文档版本

- **2.0**：面向「仅 Embedding-Vision 向量端点」的增量说明；实现细节以方舟控制台与 [向量化 API 文档](https://www.volcengine.com/docs/82379/1521765) 为准。  
- **V1 总流程**：仍以 [`langchain-pdf-kb-rag-cursor-harness.md`](./langchain-pdf-kb-rag-cursor-harness.md) 为主文档。
