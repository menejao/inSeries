import type { AchievementRarity } from "@/lib/gamification";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "cada raridade devera possuir identidade visual
 * propria: cores, brilho, bordas, pequenos efeitos". One place mapping rarity to the visual
 * language used across the medal (`AchievementMedal`) and the card border — never inline
 * per-component, so tuning a rarity's look never means touching more than this file.
 */
export const RARITY_RING_CLASSES: Record<AchievementRarity, string> = {
  COMMON: "border-border bg-surface-strong text-subtle",
  RARE: "border-secondary/50 bg-secondary/12 text-secondary-text shadow-[0_0_0_3px_rgba(56,189,248,0.08)]",
  EPIC: "border-primary/60 bg-primary/14 text-primary-text shadow-[0_0_18px_rgba(249,115,22,0.35)]",
  LEGENDARY:
    "border-warning/70 bg-gradient-to-br from-warning/25 via-primary/20 to-warning/10 text-warning-text shadow-[0_0_24px_rgba(250,204,21,0.45)]"
};

export const RARITY_CARD_BORDER_CLASSES: Record<AchievementRarity, string> = {
  COMMON: "border-border",
  RARE: "border-secondary/40",
  EPIC: "border-primary/50",
  LEGENDARY: "border-warning/60"
};
