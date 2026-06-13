// POST /api/admin/reindex-content — webhook to (re)index a single published item.
// Auth: header "x-admin-secret" must equal ADMIN_UPLOAD_SECRET.
// Body: { url, title, slug, dossier, dossier_slug, content_slug, content_type,
//         published_status, published_date_shamsi, published_date_gregorian, version }
//
// NOTE on persistence: on Vercel/CF the filesystem is read-only at runtime, so this
// endpoint uploads to OpenAI and RETURNS the new metadata. Persist it to a KV store
// (Vercel KV / Cloudflare KV) or commit data/taraz-files.json from CI. See README.
import OpenAI from "openai";
import { config } from "../../src/config.js";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  if (req.headers.get("x-admin-secret") !== config.adminSecret())
    return new Response("forbidden", { status: 403 });

  const payload = (await req.json().catch(() => ({}))) as any;
  if (payload?.published_status && payload.published_status !== "published")
    return Response.json({ skipped: "not_published" });
  if (!payload?.url || !payload?.slug)
    return new Response("missing url/slug", { status: 400 });

  const page = await fetch(payload.url).then((r) => r.text());
  const text = htmlToText(page);
  if (text.length < 200) return new Response("content_too_short", { status: 422 });

  const oa = new OpenAI({ apiKey: config.openaiApiKey() });

  const file = await oa.files.create({
    file: new File([text], `${payload.slug}.txt`, { type: "text/plain" }),
    purpose: "assistants",
  });

  const attributes = {
    title: payload.title || payload.slug,
    slug: payload.slug,
    public_url: payload.url,
    content_type: payload.content_type || "report",
    dossier_slug: payload.dossier_slug || "",
    content_slug: payload.content_slug || payload.slug,
    published_status: "published",
    published_date_shamsi: payload.published_date_shamsi || "",
    published_date_gregorian: payload.published_date_gregorian || "",
    language: "fa",
    version: payload.version || "1.0",
    qa_enabled: payload.qa_enabled === false ? false : true,
  };

  await oa.vectorStores.files.createAndPoll(config.vectorStoreId(), {
    file_id: file.id,
    attributes: attributes as any,
  });

  // Return the metadata the caller must persist (KV / committed JSON).
  return Response.json({
    indexed: true,
    metadata: {
      ...attributes,
      dossier: payload.dossier || payload.dossier_slug || "",
      file_id: file.id,
      vector_store_id: config.vectorStoreId(),
      last_indexed_at: new Date().toISOString(),
    },
  });
}

export const config_runtime = { runtime: "nodejs" };
