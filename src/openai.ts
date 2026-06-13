import OpenAI from "openai";
import { config } from "./config.js";
import { SYSTEM_INSTRUCTION } from "./prompt.js";
import type { Scope } from "./types.js";

export function client(): OpenAI {
  return new OpenAI({ apiKey: config.openaiApiKey() });
}

// Build metadata filters. published_status="published" is ALWAYS enforced.
// dossier names are never hard-coded; everything is metadata-driven.
export function buildFilters(scope: Scope, dossierSlug?: string | null, contentSlug?: string | null) {
  const must: any[] = [
    { type: "eq", key: "published_status", value: "published" },
    { type: "eq", key: "qa_enabled", value: true },
  ];
  if (scope === "dossier" && dossierSlug) {
    must.push({ type: "eq", key: "dossier_slug", value: dossierSlug });
  } else if (scope === "content" && contentSlug) {
    must.push({ type: "eq", key: "content_slug", value: contentSlug });
  }
  return must.length === 1 ? must[0] : { type: "and", filters: must };
}

// JSON schema for structured output (sources are added by the backend, not the model).
const QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    key_points: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    limitations: { type: "string" },
    suggested_followups: { type: "array", items: { type: "string" } },
  },
  required: ["answer", "key_points", "confidence", "limitations", "suggested_followups"],
};

export async function runQA(opts: {
  question: string;
  scope: Scope;
  dossierSlug?: string | null;
  contentSlug?: string | null;
}) {
  const oa = client();
  const filters = buildFilters(opts.scope, opts.dossierSlug, opts.contentSlug);

  const response = await oa.responses.create({
    model: config.model(),
    instructions: SYSTEM_INSTRUCTION,
    input: opts.question,
    tools: [
      {
        type: "file_search",
        vector_store_ids: [config.vectorStoreId()],
        filters,
        max_num_results: 8,
      } as any,
    ],
    include: ["file_search_call.results"],
    text: {
      format: {
        type: "json_schema",
        name: "taraz_qa",
        strict: true,
        schema: QA_SCHEMA,
      },
    } as any,
  } as any);

  return response as any;
}
