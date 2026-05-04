import path from "node:path";
import "dotenv/config";
import { getArkConfig } from "./config.js";
import { REPO_ROOT } from "./paths.js";
import { loadPdfAsDocuments } from "./pdf/loadPdf.js";
import { splitDocumentsIntoChunks } from "./chunk/split.js";
import { createArkOpenAIEmbeddings } from "./embed/arkEmbeddings.js";
import {
  filterOutSource,
  mergePersistAndBuildStore,
  readPersistedRecords,
} from "./store/localVectorStore.js";

function parsePdfCliArg(): string {
  const parts = process.argv.slice(2).filter((a) => a !== "--");
  if (parts.length === 0) {
    throw new Error("请提供 PDF 路径，例如：pnpm ingest -- pdfs/sample.pdf");
  }
  return parts[0]!;
}

function resolvePdfPath(arg: string): string {
  return path.isAbsolute(arg) ? path.resolve(arg) : path.resolve(REPO_ROOT, arg);
}

async function main() {
  const t0 = Date.now();
  const config = getArkConfig();
  const embeddings = createArkOpenAIEmbeddings(config);

  const rawArg = parsePdfCliArg();
  const absolutePdf = resolvePdfPath(rawArg);
  const sourceLabel = path.basename(absolutePdf);

  const pages = await loadPdfAsDocuments(absolutePdf, sourceLabel);
  const chunks = await splitDocumentsIntoChunks(pages);
  if (chunks.length === 0) {
    throw new Error(
      `分块后未得到任何文本块：${absolutePdf}。请检查 PDF 是否仅含空白或不可见字符。`,
    );
  }

  const existing = await readPersistedRecords();
  const kept = filterOutSource(existing, sourceLabel);

  const { vectorsPath, manifestPath, allRecords } =
    await mergePersistAndBuildStore({
      embeddings,
      keptRecords: kept,
      newChunkDocuments: chunks,
    });

  const ms = Date.now() - t0;
  console.log(
    `块数量：${chunks.length}（本文件 ${sourceLabel}）；库内总块数：${allRecords.length}`,
  );
  console.log(`耗时：${ms} ms`);
  console.log(
    `写入路径：\n  - ${vectorsPath}\n  - ${manifestPath}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
