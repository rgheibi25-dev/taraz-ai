// Hard abuse guard. Scope/advice refusals are handled editorially by the model.
// This only hard-blocks clearly malicious intent BEFORE spending an API call.
const ILLEGAL = [
  /\b(بمب|سلاح|انفجار|مواد منفجره|هک کردن|بدافزار|باج‌افزار)\b/i,
  /\b(make|build|synthesize)\b.*\b(bomb|explosive|malware|ransomware|weapon)\b/i,
];
const PII_EXTRACTION = [
  /\b(آدرس خانه|شماره تماس شخصی|کد ملی|رمز عبور|password|home address|phone number of)\b/i,
];

export interface GuardResult {
  blocked: boolean;
  reason?: "illegal" | "pii";
}

export function abuseGuard(question: string): GuardResult {
  if (ILLEGAL.some((r) => r.test(question))) return { blocked: true, reason: "illegal" };
  if (PII_EXTRACTION.some((r) => r.test(question))) return { blocked: true, reason: "pii" };
  return { blocked: false };
}
