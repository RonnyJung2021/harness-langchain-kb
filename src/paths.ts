import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录（`tsx src/ingest.ts` 或 `node dist/ingest.js` 时均为项目根）。 */
export const REPO_ROOT = path.resolve(here, "..");

export const KB_STORE_DIR = path.join(REPO_ROOT, "kb_store");
