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

## 目录说明

- `src/`：源码（`ingest.ts` / `ask.ts` 等）。
- `pdfs/`：用户 PDF。
- `kb_store/`：向量与元数据 JSON（运行时生成，默认不提交 `*.json`）。
