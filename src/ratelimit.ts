import { config } from "./config.js";

// In-memory fixed-window limiter. Fine for a single instance / MVP.
// PRODUCTION on serverless: replace with Vercel KV / Cloudflare KV / Upstash,
// because each serverless instance has its own memory.
const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string): { ok: boolean; remaining: number } {
  const limit = config.rateLimitPerIp();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) return { ok: false, remaining: 0 };
  b.count += 1;
  return { ok: true, remaining: limit - b.count };
}
