import { getDictionary } from "./i18n";

export interface SafetyCheckResult {
  requiresApproval: boolean;
  flags: string[];
}

/**
 * Configurable banned-word lists (spoilers/offensive/speculative — see i18n/pt-BR.ts's
 * `bannedWords`, structurally extendable per language). Checked against generated hook/caption/
 * CTA text and against Series.overview whenever it's embedded in the payload. Nothing here ever
 * auto-approves content — see approval.ts, which is the only path to APPROVED and always
 * requires an explicit human call.
 */
export function checkTextSafety(texts: string[]): SafetyCheckResult {
  const dict = getDictionary();
  const flags: string[] = [];
  const haystack = texts.join(" \n ").toLowerCase();

  for (const word of dict.bannedWords.spoilers) {
    if (haystack.includes(word.toLowerCase())) flags.push(`spoiler:${word}`);
  }
  for (const word of dict.bannedWords.offensive) {
    if (haystack.includes(word.toLowerCase())) flags.push(`offensive:${word}`);
  }
  for (const word of dict.bannedWords.speculative) {
    if (haystack.includes(word.toLowerCase())) flags.push(`speculative:${word}`);
  }

  // requiresApproval is ALWAYS true regardless of flags (approval.ts never lets content skip
  // human review), but flags are still recorded so a reviewer knows exactly why to look twice.
  return { requiresApproval: true, flags };
}

/** Never synthesize a fake voteAverage — only pass through the real DB value or omit it entirely. */
export function safeVoteAverage(voteAverage: number | null | undefined): number | null {
  return typeof voteAverage === "number" ? voteAverage : null;
}

/** Only use real watchProviders from the DB — never invent a provider list. */
export function safeWatchProviders(watchProviders: string[] | null | undefined): string[] {
  return Array.isArray(watchProviders) ? watchProviders : [];
}
