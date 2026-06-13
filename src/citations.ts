import type { TarazSource } from "./types.js";
import { metaByFileId } from "./metadata.js";

// OpenAI Responses output: message item with content[].annotations[] of type
// "file_citation" carrying file_id (+ filename). We map file_id -> public metadata.
interface Annotation {
  type?: string;
  file_id?: string;
  filename?: string;
}

export function buildSources(output: any[]): TarazSource[] {
  const fileIds = new Set<string>();
  for (const item of output || []) {
    if (item?.type !== "message") continue;
    for (const c of item.content || []) {
      for (const a of (c.annotations || []) as Annotation[]) {
        if (a?.file_id && (a.type === "file_citation" || a.type === "file_path")) {
          fileIds.add(a.file_id);
        }
      }
    }
  }
  const sources: TarazSource[] = [];
  for (const id of fileIds) {
    const m = metaByFileId(id);
    if (!m || m.published_status !== "published") continue; // never cite non-public
    sources.push({
      title: m.title,
      public_url: m.public_url || "",
      dossier: m.dossier,
      published_date: m.published_date_shamsi || m.published_date_gregorian,
      relevance: "مرتبط با پرسش بر اساس بازیابیِ پروندهٔ منتشرشده",
    });
  }
  return sources;
}
