/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — credential masking for anything that can reach a log line,
 * a history row or `SocialPublication.lastError`.
 *
 * Deliberately a local copy of the idea behind `scripts/db-guard/mask.ts` rather than an import:
 * that module belongs to the main app's scripts and this package must stay independently
 * runnable (see the package README, "Why a separate package").
 */
import { metaConfig } from "../../config";

/** "EAAB…9f2a" — enough to tell two tokens apart, never enough to use one. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "[unset]";
  if (value.length <= 8) return "[redacted]";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Every configured credential value, longest first so substrings never survive a shorter match. */
function knownSecrets(): string[] {
  return [metaConfig.accessToken, metaConfig.appSecret, metaConfig.appId, metaConfig.instagramBusinessAccountId, metaConfig.facebookPageId]
    .filter((value): value is string => typeof value === "string" && value.length >= 6)
    .sort((a, b) => b.length - a.length);
}

const TOKEN_QUERY_PARAM = /([?&](?:access_token|client_secret|appsecret_proof)=)[^&\s"']+/gi;
const BEARER = /(Bearer\s+)[A-Za-z0-9._\-|]+/gi;
/**
 * Meta user/page access tokens are `EAA…` blobs. Matched by shape as well as by value: Meta's own
 * error messages routinely echo the token back, and at that point it may not be the exact string
 * currently in config (a rotated token, a token from another environment) — shape is what saves us.
 */
const META_TOKEN_SHAPE = /\bEAA[A-Za-z0-9._\-]{6,}/g;

/**
 * Scrubs a free-text string (a Graph API error message, a URL, an exception message) of anything
 * credential-shaped. Always applied before a message is logged or written to `lastError`.
 */
export function maskText(value: string): string {
  let result = value
    .replace(TOKEN_QUERY_PARAM, "$1[redacted]")
    .replace(BEARER, "$1[redacted]")
    .replace(META_TOKEN_SHAPE, "[redacted]");
  for (const secret of knownSecrets()) {
    result = result.split(secret).join("[redacted]");
  }
  return result;
}

/** `lastError` is a DB column, not a log — keep it short as well as masked. */
export function toStoredError(error: unknown, maxLength = 500): string {
  const raw = error instanceof Error ? error.message : String(error);
  const masked = maskText(raw);
  return masked.length > maxLength ? `${masked.slice(0, maxLength - 1)}…` : masked;
}
