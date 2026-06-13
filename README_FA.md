 # پرسش از پرونده‌های تراز — Taraz dossier Q&A (MVP)

A controlled, citation-based Q&A layer over **published Taraz dossiers only**. Not a
chatbot, not a public assistant. Answers in Persian, strictly from retrieved Taraz files,
with citations to public report URLs. Refuses advice and out-of-scope questions.

## Architecture
- **Frontend:** one reusable widget (`public/taraz-qa-widget.js` + `.css`) that auto-mounts
  on every `[data-taraz-qa]` placeholder. Modes: `full` (cases index), `compact` (dossier),
  `inline` (report bottom). RTL, editorial, no API key in the browser.
- **Backend:** `POST /api/taraz-qa` (Node/TS). Calls the OpenAI **Responses API** with the
  **file_search** tool against a vector store, applying metadata **filters** by scope and
  always enforcing `published_status = "published"`. Authoritative `sources` are built from
  the citation annotations mapped to public metadata — never from model claims.
- **Index:** `scripts/ingest-taraz-docs.ts` uploads published docs + attributes; the vector
  store is the knowledge base. No fine-tuning, no live web search in MVP.

## Setup
```bash
npm install
cp .env.example .env   # fill in keys
npm run ingest         # uploads content/taraz-published/* and writes data/taraz-files.json
npm run dev            # or deploy to Vercel
```
Set `OPENAI_MODEL` to a model your account can use (e.g. gpt-4o / gpt-4.1 / gpt-5.1).

## Key rules enforced
- If fewer than **2** mapped Taraz sources → returns the standard "insufficient" message; never invents an answer.
- Always appends: «این پاسخ فقط بر اساس محتوای منتشرشده تراز است و جایگزین مشاوره تخصصی نیست.»
- CORS allowlist (`ALLOWED_ORIGINS`), per-IP rate limit, 500-char input cap, HTML stripped,
  minimal logging (hashed IP, question, confidence, source titles — no profile).

## Important caveats (read before production)
- **Serverless filesystem is read-only at runtime.** `data/taraz-files.json` is written at
  ingest time and committed. The webhook/reindex endpoint returns metadata to persist via a
  KV store (Vercel KV / Cloudflare KV) — see `admin/ADMIN.md`.
- **CMS = Ghost Pro.** Embed via the Ghost partial + tag conventions in `embed/ghost-embeds.md`.
  The widget itself is CMS-agnostic (reads `data-*` attributes).
- Rate limiting is in-memory (per instance). For real traffic use a KV-backed limiter.

## Acceptance tests (manual)
1. «ریسک‌های اقتصاد دیجیتال در پرونده‌های تراز چیست؟» → answer + citations from the اقتصاد بی‌اتصال dossier.
2. «تراز درباره بحران اعتماد رسانه فارسی چه گفته؟» → from the media-trust dossier only.
3. «آیا الان باید دلار بخرم؟» → polite refusal, out of scope, not financial advice.
4. «آخرین خبر امروز درباره اینترنت ایران چیست؟» → states it answers only from published Taraz reports, no live news in MVP.
5. «منبع این حرف چیست؟» → shows source titles + public links.

See `tests/qa.test.ts` for unit tests of the pure helpers.
