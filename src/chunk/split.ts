import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/** 单块目标长度（字符级，中文友好可调）。 */
export const CHUNK_SIZE = 800;

/** 块间重叠，便于跨句检索。 */
export const CHUNK_OVERLAP = 120;

/** 在默认分隔符基础上增加常见中文标点，便于按句/段切分。 */
const CHUNK_SEPARATORS = [
  "\n\n",
  "\n",
  "。",
  "！",
  "？",
  "；",
  "，",
  " ",
  "",
];

export function createPdfTextSplitter() {
  return new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: CHUNK_SEPARATORS,
  });
}

/**
 * 将 PDF 页级文档递归切块，并为每块写入 chunkIndex（从 0 递增）。
 */
export async function splitDocumentsIntoChunks(
  documents: Document[],
): Promise<Document[]> {
  const splitter = createPdfTextSplitter();
  const chunks = await splitter.splitDocuments(documents);
  return chunks.map(
    (doc, chunkIndex) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: { ...doc.metadata, chunkIndex },
      }),
  );
}
