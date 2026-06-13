// POST /api/taraz-qa  — Web-standard handler (Vercel Node runtime; see README for CF Workers notes).
import { config, LIMITATION_LINE, INSUFFICIENT_MESSAGE } from "../src/config.js";
import { corsHeaders, originAllowed } from "../src/cors.js";
import { rateLimit } from "../src/ratelimit.js";
import { hashIp, logQuery } from "../src/log.js";
import { sanitizeQuestion, clampWords } from "../src/sanitize.js";
import { abuseGuard } from "../src/safety.js";
import { runQA } from "../src/openai.js";
import { buildSources } from "../src/citations.js";
import type { QARequest, QAResponse, Scope, Confidence } from "../src/types.js";

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function insufficient(origin: string | null, note?: string): Response {
  const body: QAResponse = {
    answer: note ? `${INSUFFICIENT_MESSAGE} ${note}` : INSUFFICIENT_MESSAGE,
    key_points: [],
    confidence: "low",
    limitations: LIMITATION_LINE,
    sources: [],
    suggested_followups: [],
  };
  return json(body, 200, origin);
}

function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);
  if (!originAllowed(origin)) return json({ error: "origin_not_allowed" }, 403, origin);

  const ip = clientIp(req);
  const rl = rateLimit(hashIp(ip));
  if (!rl.ok) return json({ error: "rate_limited" }, 429, origin);

  let body: QARequest;
  try {
    body = (await req.json()) as QARequest;
  } catch {
    return json({ error: "bad_json" }, 400, origin);
  }

  const question = sanitizeQuestion(body.question);
  if (question.length < 3) return json({ error: "empty_question" }, 400, origin);

  const guard = abuseGuard(question);
  if (guard.blocked) {
    return json(
      {
        answer:
          "این پرسش خارج از کاربردِ این ابزار است. «پرسش از پرونده‌های تراز» فقط برای یافتنِ پاسخ‌های مستند از گزارش‌های منتشرشدهٔ تراز است.",
        key_points: [],
        confidence: "low" as Confidence,
        limitations: LIMITATION_LINE,
        sources: [],
        suggested_followups: [],
      } satisfies QAResponse,
      200,
      origin
    );
  }

  const scope: Scope = body.scope === "dossier" || body.scope === "content" ? body.scope : "site";

  try {
    let resp = await runQA({
      question,
      scope,
      dossierSlug: body.dossier_slug,
      contentSlug: body.content_slug,
    });
    let sources = buildSources(resp.output || []);
    let fallbackNote = "";

    // Addendum fallback: content scope with too few sources -> expand to dossier.
    if (sources.length < config.minSources && scope === "content" && body.dossier_slug) {
      resp = await runQA({ question, scope: "dossier", dossierSlug: body.dossier_slug });
      const expanded = buildSources(resp.output || []);
      if (expanded.length >= config.minSources) {
        sources = expanded;
        fallbackNote = "پاسخ با اتکا به پروندهٔ مرتبط، نه فقط همین مطلب، تهیه شده است.";
      }
    }

    if (sources.length < config.minSources) return insufficient(origin);

    let parsed: Partial<QAResponse> = {};
    try {
      parsed = JSON.parse(resp.output_text || "{}");
    } catch {
      return insufficient(origin);
    }

    const answer = clampWords(
      [fallbackNote, parsed.answer].filter(Boolean).join(" "),
      config.answerWordsMax
    );
    const limitations = (parsed.limitations || "").includes(LIMITATION_LINE)
      ? parsed.limitations!
      : LIMITATION_LINE;

    const out: QAResponse = {
      answer,
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points.slice(0, 6) : [],
      confidence: (parsed.confidence as Confidence) || "medium",
      limitations,
      sources,
      suggested_followups: Array.isArray(parsed.suggested_followups)
        ? parsed.suggested_followups.slice(0, 4)
        : [],
    };

    logQuery({ ip, question, confidence: out.confidence, sourceTitles: sources.map((s) => s.title) });
    return json(out, 200, origin);
  } catch (err) {
    console.error("[taraz-qa] error", err);
    return json({ error: "internal_error" }, 500, origin);
  }
}

// Vercel Node runtime (needs Node APIs: fs, crypto). Do NOT set edge runtime.
export const config_runtime = { runtime: "nodejs" };
