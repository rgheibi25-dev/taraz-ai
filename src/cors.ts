import { config } from "./config.js";

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = config.allowedOrigins();
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return config.allowedOrigins().includes(origin);
}
