import { AchievementIcon } from "@/components/achievements/achievement-icon";
import { RARITY_RING_CLASSES } from "@/components/achievements/rarity-styles";
import { LockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AchievementRarity } from "@/lib/gamification";

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "transformar as conquistas em verdadeiras medalhas":
 * um anel colorido por raridade (rarity-styles.ts) substitui o circulo cinza generico de
 * antes. Locked usa o mesmo anel, so apagado — "evitar mostrar apenas cadeados": o cadeado
 * some assim que existe uma barra de progresso ao lado (ver AchievementCard), a medalha em
 * si so fica opaca.
 */
export function AchievementMedal({
  icon,
  rarity,
  unlocked,
  size = "md"
}: {
  icon: string;
  rarity: AchievementRarity;
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dimensions = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const iconSize = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 transition",
        dimensions,
        unlocked ? RARITY_RING_CLASSES[rarity] : "border-border bg-surface-strong text-subtle opacity-60"
      )}
    >
      {unlocked ? <AchievementIcon icon={icon} className={iconSize} /> : <LockIcon className={iconSize} />}
    </span>
  );
}
