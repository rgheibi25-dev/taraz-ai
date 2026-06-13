/**
 * Option B — scheduled sync (cron) from the Ghost Content API.
 *   npm run sync   (or run on a daily Vercel/CF cron)
 * Pulls PUBLISHED posts+pages, ignores drafts/private, and POSTs each to
 * /api/admin/reindex-content. For MVP this is a thin skeleton you can wire to cron.
 *
 * Requires: GHOST_API_URL, GHOST_CONTENT_API_KEY, ADMIN_UPLOAD_SECRET,
 *           SELF_BASE_URL (where /api/admin/reindex-content is hosted).
 */
const GHOST = process.env.GHOST_API_URL;
const KEY = process.env.GHOST_CONTENT_API_KEY;
const SECRET = process.env.ADMIN_UPLOAD_SECRET;
const SELF = process.env.SELF_BASE_URL;

async function fetchPublished(resource: "posts" | "pages") {
  const url = `${GHOST}/ghost/api/content/${resource}/?key=${KEY}&limit=all&fields=title,slug,url,published_at,visibility&include=tags`;
  const res = await fetch(url).then((r) => r.json() as any);
  return (res[resource] || []).filter((p: any) => p.visibility === "public");
}

function dossierSlugOf(item: any): string {
  const tag = (item.tags || []).find((t: any) => !t.name?.startsWith("#"));
  return tag?.slug || "";
}

async function main() {
  if (!GHOST || !KEY || !SECRET || !SELF) throw new Error("Missing GHOST_API_URL / GHOST_CONTENT_API_KEY / ADMIN_UPLOAD_SECRET / SELF_BASE_URL");
  const items = [...(await fetchPublished("posts")), ...(await fetchPublished("pages"))];

  for (const it of items) {
    const qaOff = (it.tags || []).some((t: any) => t.slug === "hash-qa-off");
    if (qaOff) continue;
    const body = {
      url: it.url,
      title: it.title,
      slug: it.slug,
      dossier_slug: dossierSlugOf(it),
      content_slug: it.slug,
      content_type: "report",
      published_status: "published",
      published_date_gregorian: (it.published_at || "").slice(0, 10),
    };
    const r = await fetch(`${SELF}/api/admin/reindex-content`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": SECRET },
      body: JSON.stringify(body),
    });
    console.log(it.slug, r.status);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
