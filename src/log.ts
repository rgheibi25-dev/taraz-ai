import { createHash } from "node:crypto";
import { config } from "./config.js";

export function hashIp(ip: string): string {
  return createHash("sha256").update(config.ipHashSalt() + "|" + ip).digest("hex").slice(0, 16);
}

// Minimal, privacy-respecting log line. No full profile, no raw IP.
export function logQuery(entry: {
  ip: string;
  question: string;
  confidence: string;
  sourceTitles: string[];
}) {
  const line = {
    ts: new Date().toISOString(),
    ip_hash: hashIp(entry.ip),
    question: entry.question.slice(0, 200),
    confidence: entry.confidence,
    sources: entry.sourceTitles,
  };
  // Replace with your log sink. Console is fine for MVP.
  console.log("[taraz-qa]", JSON.stringify(line));
}
