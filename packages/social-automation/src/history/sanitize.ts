/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — defense-in-depth redaction for any JSON blob rendered in the
 * admin panel (SocialAutomationHistory.detail, SocialContent.payload).
 *
 * Nothing in this package writes a credential into either column today, so in practice this
 * should always be a no-op. It exists anyway because the panel renders stored JSON verbatim and
 * a future publisher (a real Instagram one) would plausibly log a token into a history detail.
 * Redacting at the read boundary means that mistake can never become an admin-facing leak.
 */

const SENSITIVE_KEY_PATTERN = /(api[-_]?key|secret|token|password|passwd|credential|authorization|auth[-_]?header|access[-_]?key|private[-_]?key|session|cookie|signature|bearer)/i;

export const REDACTED = "[redigido]";

/** Recursively replaces the value of any key whose name looks credential-ish. Cycle-safe, depth-capped. */
export function sanitizeJson(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 12) return REDACTED;
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJson(entry, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeJson(entry, depth + 1, seen);
  }
  return result;
}

/** Convenience wrapper returning a pretty-printed, already-sanitized JSON string for display. */
export function sanitizedJsonString(value: unknown, space = 2): string {
  return JSON.stringify(sanitizeJson(value), null, space) ?? "null";
}
