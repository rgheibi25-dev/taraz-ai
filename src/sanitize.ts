import { config } from "./config.js";

// Remove tags, collapse whitespace, cap length.
export function sanitizeQuestion(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/<[^>]*>/g, " "); // strip HTML tags
  s = s.replace(/[\u0000-\u001F\u007F]/g, " "); // control chars
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > config.maxInputChars) s = s.slice(0, config.maxInputChars);
  return s;
}

export function clampWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  return words.slice(0, max).join(" ").replace(/[،,;:.\s]+$/, "") + " …";
}
