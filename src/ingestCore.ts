import path from "node:path";
import { getArkConfig } from "./config.js";
import { loadPdfAsDocuments } from "./pdf/loadPdf.js";
import { splitDocumentsIntoChunks } from "./chunk/split.js";
import { createArkOpenAIEmbeddings } from "./embed/arkEmbeddings.js";
import {
  filterOutSource,
  mergePersistAndBuildStore,
  readPersistedRecords,
} from "./store/localVectorStore.js";

export type IngestRunResult = {
  chunkCount: number;
  totalChunks: number;
  sourceLabel: string;
  vectorsPath: string;
  manifestPath: string;
  ms: number;
  absolutePdfPath: string;
};

/** 对给定绝对路径的 PDF 执行完整入库（与 CLI `ingest` 相同逻辑）。 */
export async function runIngestFromAbsolutePdf(
  absolutePdfPath: string,
): Promise<IngestRunResult> {
  const t0 = Date.now();
  const config = getArkConfig();
  const embeddings = createArkOpenAIEmbeddings(config);
  const sourceLabel = path.basename(absolutePdfPath);

  const pages = await loadPdfAsDocuments(absolutePdfPath, sourceLabel);
  const chunks = await splitDocumentsIntoChunks(pages);
  if (chunks.length === 0) {
    throw new Error(
      `分块后未得到任何文本块：${absolutePdfPath}。请检查 PDF 是否仅含空白或不可见字符。`,
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

  return {
    chunkCount: chunks.length,
    totalChunks: allRecords.length,
    sourceLabel,
    vectorsPath,
    manifestPath,
    ms: Date.now() - t0,
    absolutePdfPath,
  };
}
