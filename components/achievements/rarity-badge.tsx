import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { RARITY_LABELS, type AchievementRarity } from "@/lib/gamification";

const RARITY_VARIANT: Record<AchievementRarity, BadgeVariant> = {
  COMMON: "default",
  RARE: "secondary",
  EPIC: "primary",
  LEGENDARY: "warning"
};

export function RarityBadge({ rarity }: { rarity: AchievementRarity }) {
  return <Badge variant={RARITY_VARIANT[rarity]}>{RARITY_LABELS[rarity]}</Badge>;
}
