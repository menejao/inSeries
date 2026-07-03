import type { AchievementCategory, AchievementRarity } from "@/lib/gamification/types";

/**
 * Fase 6 — badge metadata. Deliberately UI-agnostic (no component/style
 * references here, that mapping lives in components/achievements) so this
 * module stays a pure data layer, consistent with the rest of lib/gamification.
 * No special effects (animations, sounds) — just labels and sort order.
 */
export const RARITY_LABELS: Record<AchievementRarity, string> = {
  COMMON: "Comum",
  RARE: "Rara",
  EPIC: "Epica",
  LEGENDARY: "Lendaria"
};

export const RARITY_ORDER: AchievementRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

export function rarityWeight(rarity: AchievementRarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  WATCHING: "Assistindo",
  SOCIAL: "Social",
  COLLECTION: "Colecao",
  STREAK: "Sequencia",
  REVIEW: "Reviews",
  SPECIAL: "Especiais"
};

export const CATEGORY_ORDER: AchievementCategory[] = ["WATCHING", "STREAK", "REVIEW", "COLLECTION", "SOCIAL", "SPECIAL"];
