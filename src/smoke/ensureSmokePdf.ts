import fs from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "../paths.js";
import { EMBEDDED_SMOKE_PDF_BASE64 } from "./embeddedSmokePdfB64.js";

/** 验收用中文最小 PDF 路径（相对仓库根）。 */
export const SMOKE_PDF_RELPATH = path.join("pdfs", "_smoke.pdf");

/**
 * 若 `pdfs/_smoke.pdf` 不存在，则从内置 base64 解码写入（几十字中文样例）。
 */
export async function ensureSmokePdf(): Promise<string> {
  const dest = path.join(REPO_ROOT, SMOKE_PDF_RELPATH);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.access(dest);
    return dest;
  } catch {
    const buf = Buffer.from(EMBEDDED_SMOKE_PDF_BASE64, "base64");
    await fs.writeFile(dest, buf);
    return dest;
  }
}
