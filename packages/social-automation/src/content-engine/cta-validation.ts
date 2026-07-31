/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — the editorial rules a CTA must satisfy before content can be
 * approved or edited. This lives HERE (content-engine) and not in the admin UI on purpose: the
 * panel renders the same result client-side for immediate feedback, but every write path
 * (approveContent / editContent in approval.ts) calls `assertValidCta`, so the backend is the
 * definitive gate and the CLI scripts get the identical rule for free.
 *
 * ERRORS vs WARNINGS — deliberate split. The ticket lists three checks (empty / no "inSeries" /
 * no "link na bio"), but the 5 seed CTAs in i18n/pt-BR.ts satisfy only two of them: every one
 * ends in "link na bio", and NONE contains the literal string "inSeries" (e.g. "Explore o
 * catalogo completo — link na bio."). Making the brand check blocking would therefore reject
 * 100% of the content the engine has ever generated, including content produced by the CLI.
 * So `empty` and `missing-link-na-bio` are blocking errors, and `missing-brand` is a
 * non-blocking warning surfaced to the reviewer. Promoting it to an error is a one-line change
 * here (move it into BLOCKING_VIOLATIONS) once the seed CTA copy is updated to carry the brand.
 */

export const CTA_REQUIRED_BRAND = "inSeries";
export const CTA_REQUIRED_PHRASE = "link na bio";

export type CtaViolation = "empty" | "missing-brand" | "missing-link-na-bio";

const BLOCKING_VIOLATIONS: ReadonlySet<CtaViolation> = new Set<CtaViolation>(["empty", "missing-link-na-bio"]);

const VIOLATION_MESSAGES: Record<CtaViolation, string> = {
  empty: "O CTA nao pode estar vazio.",
  "missing-brand": `Aviso: o CTA nao menciona "${CTA_REQUIRED_BRAND}".`,
  "missing-link-na-bio": `O CTA precisa conter "${CTA_REQUIRED_PHRASE}".`
};

export interface CtaValidationResult {
  /** True when there is no BLOCKING violation — warnings alone never block. */
  valid: boolean;
  errors: CtaViolation[];
  warnings: CtaViolation[];
  errorMessages: string[];
  warningMessages: string[];
}

/** Pure, synchronous, dependency-free — safe to call from a Server Component, an API route or a Client Component. */
export function validateCta(text: string | null | undefined): CtaValidationResult {
  const value = (text ?? "").trim();
  const violations: CtaViolation[] = [];

  if (value.length === 0) {
    violations.push("empty");
  } else {
    const haystack = value.toLowerCase();
    if (!haystack.includes(CTA_REQUIRED_BRAND.toLowerCase())) violations.push("missing-brand");
    if (!haystack.includes(CTA_REQUIRED_PHRASE.toLowerCase())) violations.push("missing-link-na-bio");
  }

  const errors = violations.filter((violation) => BLOCKING_VIOLATIONS.has(violation));
  const warnings = violations.filter((violation) => !BLOCKING_VIOLATIONS.has(violation));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    errorMessages: errors.map((violation) => VIOLATION_MESSAGES[violation]),
    warningMessages: warnings.map((violation) => VIOLATION_MESSAGES[violation])
  };
}

/**
 * NOTE — this module is deliberately dependency-free (no i18n, no config, no prisma imports). The
 * admin review screen imports `validateCta` into a Client Component for instant feedback while
 * typing, and pulling in config/index.ts (which zod-parses process.env at module load) would drag
 * server-only code into the browser bundle. The seed-CTA listing that *does* need the dictionary
 * lives in cta-engine.ts instead.
 */

/** Throws on blocking violations only — used by the write paths in approval.ts. */
export function assertValidCta(text: string | null | undefined): void {
  const result = validateCta(text);
  if (!result.valid) {
    throw new Error(`CTA invalido: ${result.errorMessages.join(" ")}`);
  }
}
