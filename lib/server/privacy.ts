/**
 * Privacy gateway: finds personal data and secrets before a prompt leaves the platform.
 * Secrets (API keys, private keys) are always blocked. Personal data is masked before it reaches an
 * external (cloud) model and kept as-is for local models, and it feeds the router's privacy term Pm.
 */

export type SensitiveKind = "email" | "phone" | "card" | "account" | "ip" | "aadhaar" | "pan" | "api_key" | "private_key";
export type Finding = { kind: SensitiveKind; secret: boolean; preview: string };

const KIND_LABEL: Record<SensitiveKind, string> = {
  email: "email address", phone: "phone number", card: "payment card number", account: "account number", ip: "IP address",
  aadhaar: "Aadhaar number", pan: "PAN", api_key: "API key", private_key: "private key",
};
export const describeKind = (k: SensitiveKind) => KIND_LABEL[k];

/** Luhn check, so order numbers and long IDs aren't mistaken for card numbers. */
function luhn(digits: string) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

/** 10–13 digits written like a phone number, or a bare 10-digit mobile; long bare IDs are left alone. */
function isPhone(m: string) {
  const n = m.replace(/\D/g, "").length;
  return /[+ ().-]/.test(m) ? n >= 10 && n <= 13 : n === 10;
}

type Rule = { kind: SensitiveKind; secret: boolean; re: RegExp; accept?: (m: string) => boolean };

// Order matters: earlier rules claim their span first (a card number is not also reported as a phone number).
const RULES: Rule[] = [
  { kind: "private_key", secret: true, re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g },
  {
    kind: "api_key", secret: true,
    re: /\b(sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{36,}|xox[abpors]-[A-Za-z0-9-]{10,}|gsk_[A-Za-z0-9]{20,})\b/g,
  },
  { kind: "api_key", secret: true, re: /\b(api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{12,}/gi },
  { kind: "email", secret: false, re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { kind: "card", secret: false, re: /\b(?:\d[ -]?){13,19}\b/g, accept: (m) => luhn(m.replace(/\D/g, "")) },
  { kind: "aadhaar", secret: false, re: /\b[2-9]\d{3}[ -]\d{4}[ -]\d{4}\b/g },
  { kind: "pan", secret: false, re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  { kind: "account", secret: false, re: /\b(?:a\/c|acct|account)(?:\s*(?:no\.?|number|#))?\s*[:#]?\s*\d{8,18}\b/gi },
  { kind: "ip", secret: false, re: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g },
  { kind: "phone", secret: false, re: /(?<![\w$])\+?\d[\d ().-]{8,}\d(?![\w])/g, accept: isPhone },
];

type Span = { start: number; end: number; kind: SensitiveKind; secret: boolean; text: string };

function spans(text: string): Span[] {
  const out: Span[] = [];
  for (const r of RULES) {
    for (const m of text.matchAll(r.re)) {
      const start = m.index!, end = start + m[0].length;
      if (r.accept && !r.accept(m[0])) continue;
      if (out.some((s) => start < s.end && end > s.start)) continue;
      out.push({ start, end, kind: r.kind, secret: r.secret, text: m[0] });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Masked preview that is safe to log or show back: keeps a hint of the shape, never the value. */
function preview(s: Span) {
  if (s.kind === "email") return s.text.replace(/^(.).*(@.*)$/, "$1***$2");
  if (s.secret) return `${s.text.slice(0, 4)}…`;
  return `…${s.text.replace(/\D/g, "").slice(-2)}`;
}

export function scanSensitive(text: string): Finding[] {
  return spans(text).map((s) => ({ kind: s.kind, secret: s.secret, preview: preview(s) }));
}

/** Replace personal data with typed placeholders such as [EMAIL]. Secrets are masked too. */
export function redact(text: string): string {
  let out = "";
  let at = 0;
  for (const s of spans(text)) {
    out += text.slice(at, s.start) + `[${s.kind.toUpperCase()}]`;
    at = s.end;
  }
  return out + text.slice(at);
}

export const hasPersonalData = (findings: Finding[]) => findings.some((f) => !f.secret);

export type GateResult =
  | { ok: true; text: string; findings: Finding[]; redacted: boolean }
  | { ok: false; reason: string; findings: Finding[] };

/**
 * Gate learner-written text before it goes to a model. `external` means the model runs outside
 * the platform (a cloud API); local and simulated models see the text unchanged.
 */
export function gatePrompt(text: string, opts: { external: boolean }): GateResult {
  const findings = scanSensitive(text);
  const secrets = findings.filter((f) => f.secret);
  if (secrets.length) {
    return { ok: false, findings, reason: `Your prompt contains what looks like a ${describeKind(secrets[0].kind)} (${secrets[0].preview}). Remove it before sending — keys and passwords never belong in a prompt.` };
  }
  if (opts.external && hasPersonalData(findings)) return { ok: true, text: redact(text), findings, redacted: true };
  return { ok: true, text, findings, redacted: false };
}

/** Providers that run outside the platform. Simulated and local models never send data anywhere. */
export const isExternalProvider = (name: string) => !name.startsWith("simulated") && name !== "local";
