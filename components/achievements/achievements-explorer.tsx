"use client";

import { useMemo, useState } from "react";
import { AchievementCard } from "@/components/achievements/achievement-card";
import { TrophyIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ORDER, type AchievementCategory, type LockedAchievementSummary, type UnlockedAchievementSummary } from "@/lib/gamification";

type FilterValue = "ALL" | AchievementCategory;

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "permitir filtrar por categoria atraves de chips...
 * evitar exibir todas as categorias abertas simultaneamente": um unico grid filtravel por
 * chip, nunca 6 `<section>` sempre expandidas ao mesmo tempo (o layout antigo). Desbloqueadas
 * sempre vem primeiro — a colecao ja conquistada e o que da a sensacao de album.
 */
export function AchievementsExplorer({
  unlocked,
  locked
}: {
  unlocked: UnlockedAchievementSummary[];
  locked: LockedAchievementSummary[];
}) {
  const [filter, setFilter] = useState<FilterValue>("ALL");

  const visibleUnlocked = useMemo(
    () => (filter === "ALL" ? unlocked : unlocked.filter((achievement) => achievement.category === filter)),
    [unlocked, filter]
  );
  const visibleLocked = useMemo(
    () => (filter === "ALL" ? locked : locked.filter((achievement) => achievement.category === filter)),
    [locked, filter]
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
          <TrophyIcon className="h-5 w-5 text-subtle" />
          Todas as conquistas
        </h2>
      </div>

      <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
            filter === "ALL" ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted hover:text-ink"
          )}
        >
          Todas
        </button>
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              filter === category ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted hover:text-ink"
            )}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleUnlocked.map((achievement) => (
          <AchievementCard key={achievement.slug} achievement={achievement} unlocked />
        ))}
        {visibleLocked.map((achievement) => (
          <AchievementCard key={achievement.slug} achievement={achievement} unlocked={false} />
        ))}
      </div>
    </section>
  );
}
