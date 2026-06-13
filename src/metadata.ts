import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { FileMeta } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "../data/taraz-files.json");

interface Store {
  vector_store_id: string;
  files: FileMeta[];
}

let cache: Store | null = null;

export function loadStore(): Store {
  if (cache) return cache;
  // Read-only at runtime on serverless. Committed at ingest/CI time.
  cache = JSON.parse(readFileSync(DATA_PATH, "utf-8")) as Store;
  return cache;
}

export function metaByFileId(fileId: string): FileMeta | undefined {
  return loadStore().files.find((f) => f.file_id === fileId);
}
