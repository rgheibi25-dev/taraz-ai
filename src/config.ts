function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  openaiApiKey: () => req("OPENAI_API_KEY"),
  vectorStoreId: () => req("OPENAI_VECTOR_STORE_ID"),
  model: () => opt("OPENAI_MODEL", "gpt-4o"),
  allowedOrigins: () =>
    opt("ALLOWED_ORIGINS", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  rateLimitPerIp: () => parseInt(opt("RATE_LIMIT_PER_IP", "20"), 10),
  adminSecret: () => req("ADMIN_UPLOAD_SECRET"),
  ipHashSalt: () => opt("IP_HASH_SALT", "taraz-default-salt"),
  // Editorial guardrails
  maxInputChars: 500,
  minSources: 2,
  answerWordsMin: 220,
  answerWordsMax: 280,
};

export const LIMITATION_LINE =
  "این پاسخ فقط بر اساس محتوای منتشرشده تراز است و جایگزین مشاوره تخصصی نیست.";

export const INSUFFICIENT_MESSAGE =
  "در پرونده‌های منتشرشده تراز، پاسخ مستند کافی برای این پرسش پیدا نشد.";
