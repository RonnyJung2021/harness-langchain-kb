# kb-rag-local

本地 PDF 知识库问答（LangChain + 方舟）的占位工程。

## 快速开始

1. 将 PDF 文件放入 `pdfs/` 目录。
2. 复制环境变量模板并填写密钥与模型 ID：

   ```bash
   cp .env.example .env
   ```

3. 安装依赖并编译（可选，用于检查 TypeScript）：

   ```bash
   pnpm install
   pnpm run build
   ```

   使用 **pnpm 11** 时，仓库根目录的 `pnpm-workspace.yaml` 已对 `esbuild` 声明 `allowBuilds`，避免 `tsx` 依赖的安装脚本被默认拦截。

4. 后续阶段完成后：入库 `pnpm ingest`、提问 `pnpm ask`。

## 验收

一键验证「PDF → 分块 → 向量落盘」管道是否打通（需已配置 `.env` 中的方舟变量，含 `ARK_EMBED_MODEL`，与正式入库相同）：

```bash
pnpm ingest:smoke
```

脚本会：

1. 若仓库中尚无 `pdfs/_smoke.pdf`，则从内置 base64 写出一份仅含几十字中文的最小 PDF；
2. 对该文件执行与 `pnpm ingest -- pdfs/_smoke.pdf` 相同的入库流程；
3. 在末尾打印 `kb_store/vectors.json` 与 `kb_store/manifest.json` 的文件大小，并断言本次入库 **chunk 数大于 0**（失败则非零退出）。

用于 CI 或换机后快速自检：**chunk 断言通过**即说明 PDF 解析、分块、Embedding 与向量写入链路正常。若接口返回模型不可用（例如 400），请确认 `ARK_EMBED_MODEL` 为方舟控制台中 **文本向量** 类接入点 ID，且与当前 API 匹配。

## 目录说明

- `src/`：源码（`ingest.ts` / `ask.ts` 等）。
- `pdfs/`：用户 PDF。
- `kb_store/`：向量与元数据 JSON（运行时生成，默认不提交 `*.json`）。
