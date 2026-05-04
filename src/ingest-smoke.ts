import "dotenv/config";
import fs from "node:fs/promises";
import { ensureSmokePdf } from "./smoke/ensureSmokePdf.js";
import { runIngestFromAbsolutePdf } from "./ingestCore.js";
import { MANIFEST_JSON, VECTORS_JSON } from "./store/localVectorStore.js";

async function main() {
  const pdfPath = await ensureSmokePdf();
  const result = await runIngestFromAbsolutePdf(pdfPath);

  console.log(
    `块数量：${result.chunkCount}（本文件 ${result.sourceLabel}）；库内总块数：${result.totalChunks}`,
  );
  console.log(`耗时：${result.ms} ms`);
  console.log(
    `写入路径：\n  - ${result.vectorsPath}\n  - ${result.manifestPath}`,
  );

  const vStat = await fs.stat(VECTORS_JSON);
  const mStat = await fs.stat(MANIFEST_JSON);
  console.log("");
  console.log(`[smoke] kb_store/vectors.json 大小：${vStat.size} 字节`);
  console.log(`[smoke] kb_store/manifest.json 大小：${mStat.size} 字节`);
  console.log(`[smoke] 本次入库 chunk 数：${result.chunkCount}`);

  if (result.chunkCount <= 0) {
    throw new Error("[smoke] 断言失败：chunk 数必须 > 0");
  }
  console.log("[smoke] 断言通过：chunk > 0");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
