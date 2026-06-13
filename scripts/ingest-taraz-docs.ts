/**
 * Ingest published Taraz docs into an OpenAI vector store.
 *   npm run ingest
 * Reads /content/taraz-published/*.{md,txt,pdf}
 * Each .md/.txt file should start with a front-matter block (--- ... ---) carrying metadata.
 * Creates the vector store if OPENAI_VECTOR_STORE_ID is empty, uploads + attaches files
 * with attributes, and writes /data/taraz-files.json.
 */
import OpenAI from "openai";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = resolve(__dirname, "../content/taraz-published");
const DATA_PATH = resolve(__dirname, "../data/taraz-files.json");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required");
const oa = new OpenAI({ apiKey });

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    v = v.replace(/^["']|["']$/g, "");
    if (k) meta[k] = v;
  }
  return { meta, body: m[2] || "" };
}

async function getVectorStoreId(): Promise<string> {
  if (process.env.OPENAI_VECTOR_STORE_ID) return process.env.OPENAI_VECTOR_STORE_ID;
  const vs = await oa.vectorStores.create({ name: "taraz-published" });
  console.log("Created vector store:", vs.id);
  console.log(">>> Put this in your env: OPENAI_VECTOR_STORE_ID=" + vs.id);
  return vs.id;
}

async function main() {
  const vectorStoreId = await getVectorStoreId();
  const files = readdirSync(CONTENT_DIR).filter((f) => /\.(md|txt|pdf)$/i.test(f));
  const out: any[] = [];

  for (const f of files) {
    const path = resolve(CONTENT_DIR, f);
    const ext = extname(f).toLowerCase();
    let meta: Record<string, string> = {};
    let uploadFile: File;

    if (ext === ".pdf") {
      // OpenAI parses PDFs server-side. Metadata must come from a sibling .json or filename.
      const buf = readFileSync(path);
      uploadFile = new File([buf], f, { type: "application/pdf" });
      meta = { slug: basename(f, ext), title: basename(f, ext), published_status: "published" };
    } else {
      const raw = readFileSync(path, "utf-8");
      const parsed = parseFrontMatter(raw);
      meta = parsed.meta;
      uploadFile = new File([parsed.body || raw], f, { type: "text/plain" });
    }

    if ((meta.published_status || "published") !== "published") {
      console.log("Skipping (not published):", f);
      continue;
    }

    const uploaded = await oa.files.create({ file: uploadFile, purpose: "assistants" });

    const attributes = {
      title: meta.title || basename(f),
      slug: meta.slug || basename(f),
      public_url: meta.public_url || "",
      content_type: meta.content_type || "dossier",
      dossier_slug: meta.dossier_slug || "",
      content_slug: meta.content_slug || meta.slug || basename(f),
      published_status: "published",
      published_date_shamsi: meta.published_date_shamsi || "",
      published_date_gregorian: meta.published_date_gregorian || "",
      language: meta.language || "fa",
      version: meta.version || "1.0",
      qa_enabled: meta.qa_enabled === "false" ? false : true,
    };

    await oa.vectorStores.files.createAndPoll(vectorStoreId, {
      file_id: uploaded.id,
      attributes: attributes as any,
    });

    out.push({
      ...attributes,
      dossier: meta.dossier || meta.dossier_slug || "",
      file_id: uploaded.id,
      vector_store_id: vectorStoreId,
      last_indexed_at: new Date().toISOString(),
    });
    console.log("Indexed:", attributes.title, "->", uploaded.id);
  }

  writeFileSync(DATA_PATH, JSON.stringify({ vector_store_id: vectorStoreId, files: out }, null, 2));
  console.log(`\nWrote ${out.length} entries to data/taraz-files.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
