import fs from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { KB_STORE_DIR } from "../paths.js";

export const VECTORS_JSON = path.join(KB_STORE_DIR, "vectors.json");
export const MANIFEST_JSON = path.join(KB_STORE_DIR, "manifest.json");

const STORE_VERSION = 1 as const;

export type PersistedVectorRecord = {
  pageContent: string;
  embedding: number[];
  metadata: Record<string, unknown>;
};

type VectorsFile = {
  version: typeof STORE_VERSION;
  records: PersistedVectorRecord[];
};

type ManifestFile = {
  version: typeof STORE_VERSION;
  updatedAt: string;
  totalChunks: number;
  /** 每个 source（文件名）对应的块数量 */
  bySource: Record<string, number>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function ensureKbStoreDir(): Promise<void> {
  await fs.mkdir(KB_STORE_DIR, { recursive: true });
}

export async function readPersistedRecords(): Promise<PersistedVectorRecord[]> {
  try {
    const raw = await fs.readFile(VECTORS_JSON, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORE_VERSION) {
      return [];
    }
    const recs = parsed.records;
    if (!Array.isArray(recs)) {
      return [];
    }
    const out: PersistedVectorRecord[] = [];
    for (const r of recs) {
      if (!isRecord(r)) continue;
      const { pageContent, embedding, metadata } = r;
      if (typeof pageContent !== "string" || !Array.isArray(embedding)) {
        continue;
      }
      if (!isRecord(metadata)) continue;
      const nums = embedding.every((x) => typeof x === "number");
      if (!nums) continue;
      out.push({
        pageContent,
        embedding: embedding as number[],
        metadata,
      });
    }
    return out;
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw e;
  }
}

/** 默认策略：移除与本次入库相同 source（文件名）的旧块，再合并新向量，避免重复。 */
export function filterOutSource(
  records: PersistedVectorRecord[],
  sourceBasename: string,
): PersistedVectorRecord[] {
  return records.filter((r) => {
    const src = r.metadata.source;
    return typeof src !== "string" || src !== sourceBasename;
  });
}

function buildManifest(records: PersistedVectorRecord[]): ManifestFile {
  const bySource: Record<string, number> = {};
  for (const r of records) {
    const src = r.metadata.source;
    if (typeof src !== "string") continue;
    bySource[src] = (bySource[src] ?? 0) + 1;
  }
  return {
    version: STORE_VERSION,
    updatedAt: new Date().toISOString(),
    totalChunks: records.length,
    bySource,
  };
}

export async function persistVectorRecords(
  records: PersistedVectorRecord[],
): Promise<{ vectorsPath: string; manifestPath: string }> {
  await ensureKbStoreDir();
  const payload: VectorsFile = { version: STORE_VERSION, records };
  const manifest = buildManifest(records);
  await fs.writeFile(VECTORS_JSON, JSON.stringify(payload), "utf8");
  await fs.writeFile(MANIFEST_JSON, JSON.stringify(manifest, null, 2), "utf8");
  return { vectorsPath: VECTORS_JSON, manifestPath: MANIFEST_JSON };
}

function memoryVectorsToRecords(
  memoryVectors: Array<{
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>,
): PersistedVectorRecord[] {
  return memoryVectors.map((mv) => ({
    pageContent: mv.content,
    embedding: mv.embedding,
    metadata: mv.metadata,
  }));
}

/**
 * 合并「保留的旧记录」与「新块」的向量，写入磁盘，并返回可检索的 {@link MemoryVectorStore}。
 * 新块使用 {@link MemoryVectorStore.fromDocuments} 生成向量并并入内存库。
 */
export async function mergePersistAndBuildStore(options: {
  embeddings: EmbeddingsInterface;
  keptRecords: PersistedVectorRecord[];
  newChunkDocuments: Document[];
}): Promise<{
  store: MemoryVectorStore;
  vectorsPath: string;
  manifestPath: string;
  allRecords: PersistedVectorRecord[];
}> {
  const { embeddings, keptRecords, newChunkDocuments } = options;

  const store = await MemoryVectorStore.fromExistingIndex(embeddings);

  if (keptRecords.length > 0) {
    await store.addVectors(
      keptRecords.map((r) => r.embedding),
      keptRecords.map(
        (r) =>
          new Document({
            pageContent: r.pageContent,
            metadata: r.metadata,
          }),
      ),
    );
  }

  let newRecords: PersistedVectorRecord[] = [];
  if (newChunkDocuments.length > 0) {
    const newPart = await MemoryVectorStore.fromDocuments(
      newChunkDocuments,
      embeddings,
    );
    newRecords = memoryVectorsToRecords(newPart.memoryVectors);
    await store.addVectors(
      newPart.memoryVectors.map((mv) => mv.embedding),
      newPart.memoryVectors.map(
        (mv) =>
          new Document({
            pageContent: mv.content,
            metadata: mv.metadata,
          }),
      ),
    );
  }

  const mergedRecords: PersistedVectorRecord[] = [...keptRecords, ...newRecords];

  const { vectorsPath, manifestPath } =
    await persistVectorRecords(mergedRecords);
  return { store, vectorsPath, manifestPath, allRecords: mergedRecords };
}
