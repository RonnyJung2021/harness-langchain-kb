import path from "node:path";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

/**
 * 使用 LangChain PDFLoader 加载 PDF 文本（按页拆分）。
 * @param absolutePdfPath PDF 绝对路径
 * @param sourceLabel 写入 metadata.source 的文件名（通常为 basename）
 */
export async function loadPdfAsDocuments(
  absolutePdfPath: string,
  sourceLabel: string,
) {
  const loader = new PDFLoader(absolutePdfPath, { splitPages: true });
  const docs = await loader.load();

  if (docs.length === 0) {
    throw new Error(
      `PDF 未解析出任何页面文本：${absolutePdfPath}。若为扫描件/图片型 PDF，请先 OCR 或导出为可选中文本的 PDF 后再入库。`,
    );
  }

  const hasText = docs.some((d) => d.pageContent.trim().length > 0);
  if (!hasText) {
    throw new Error(
      `PDF 解析结果为空（各页无可见文本）：${absolutePdfPath}。请确认不是纯图片扫描版，或尝试其他 PDF。`,
    );
  }

  const resolved = path.resolve(absolutePdfPath);
  return docs.map(
    (doc) =>
      new Document({
        pageContent: doc.pageContent,
        metadata: {
          ...doc.metadata,
          source: sourceLabel,
          pdfPath: resolved,
        },
      }),
  );
}
