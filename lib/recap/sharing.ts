import { createHash } from "node:crypto";
import type { RecapSharing } from "@/lib/recap/types";

/**
 * Fase 9 — prepared, not implemented. `shareSlug` is a deterministic,
 * non-secret identifier (same user + period always yields the same slug) so
 * a future public recap route can be added without changing anything about
 * how recaps are generated. Nothing here is persisted (no DB column/table)
 * and no route resolves this slug yet — `isPublic` is hardcoded `false`
 * (Fase 11: recaps are private by default, never auto-published).
 */
export function buildRecapSharing(userId: string, year: number, month: number | null): RecapSharing {
  const key = `${userId}:${year}:${month ?? "yearly"}`;
  const shareSlug = createHash("sha256").update(key).digest("hex").slice(0, 16);

  return {
    shareSlug,
    isPublic: false
  };
}
