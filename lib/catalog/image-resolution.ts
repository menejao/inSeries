/**
 * Fase 5 (INSERIES-TMDB-CATALOG-QUALITY-01) — the preferred-image order the ticket asks
 * for (logo > poster > backdrop) for any future UI component that wants "the one image
 * that best represents this series" instead of a specific slot. Not wired into any
 * existing component yet (no navigation/UI change this sprint) — a ready-to-use helper,
 * same treatment as the rich metadata fields added in INSERIES-TMDB-CATALOG-SCALE-01.
 */
export type ImageResolutionInput = {
  logoUrl?: string | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
};

export function resolvePreferredImageUrl(series: ImageResolutionInput): string | null {
  return series.logoUrl || series.posterUrl || series.backdropUrl || null;
}
