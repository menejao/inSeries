/**
 * Fase 5 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — brand color per streaming provider.
 * The sync pipeline only persists provider *names* (`Series.watchProviders`, see
 * lib/catalog/normalize.ts) — never a logo image path, since capturing that would mean
 * touching the TMDb sync pipeline, out of scope for this ticket ("Não alterar
 * sincronização TMDb"/"Não alterar pipeline"). So "official icons" here means a
 * recognizable brand-colored badge with the provider's initial, not a hotlinked logo
 * image — documented as a deliberate interpretation in the README.
 */
const PROVIDER_COLORS: Record<string, string> = {
  Netflix: "#E50914",
  "Prime Video": "#00A8E1",
  "Disney+": "#113CCF",
  Max: "#002BE7",
  "Apple TV+": "#000000",
  "Paramount+": "#0064FF",
  Globoplay: "#E60045",
  Crunchyroll: "#F47521",
  Peacock: "#000000",
  Hulu: "#1CE783"
};

const DEFAULT_PROVIDER_COLOR = "#6b7280";

export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? DEFAULT_PROVIDER_COLOR;
}

export function getProviderInitial(provider: string): string {
  return provider.trim().charAt(0).toUpperCase() || "?";
}
