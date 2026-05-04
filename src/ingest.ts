import path from "node:path";
import "dotenv/config";
import { REPO_ROOT } from "./paths.js";
import { runIngestFromAbsolutePdf } from "./ingestCore.js";

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
  const rawArg = parsePdfCliArg();
  const absolutePdf = resolvePdfPath(rawArg);
  const result = await runIngestFromAbsolutePdf(absolutePdf);

  console.log(
    `块数量：${result.chunkCount}（本文件 ${result.sourceLabel}）；库内总块数：${result.totalChunks}`,
  );
  console.log(`耗时：${result.ms} ms`);
  console.log(
    `写入路径：\n  - ${result.vectorsPath}\n  - ${result.manifestPath}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
