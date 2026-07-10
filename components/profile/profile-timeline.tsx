"use client";

import { useMemo, useState } from "react";
import { ActivityCard } from "@/components/feed/activity-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { ActivityFeedItem } from "@/lib/social/activity";

type TimelineFilter = "ALL" | "REVIEWS" | "COMMENTS" | "SERIES" | "EPISODES" | "FAVORITES" | "COMPLETIONS";

const FAVORITE_MIN_RATING = 4;

const FILTERS: Array<{ key: TimelineFilter; label: string }> = [
  { key: "ALL", label: "Tudo" },
  { key: "REVIEWS", label: "Reviews" },
  { key: "COMMENTS", label: "Comentarios" },
  { key: "SERIES", label: "Series" },
  { key: "EPISODES", label: "Episodios" },
  { key: "FAVORITES", label: "Favoritos" },
  { key: "COMPLETIONS", label: "Conclusoes" }
];

function matchesFilter(activity: ActivityFeedItem, filter: TimelineFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "REVIEWS":
      return activity.type === "REVIEW_CREATED";
    case "COMMENTS":
      return activity.type === "COMMENT_CREATED";
    case "SERIES":
      return activity.type === "SERIES_STATUS_CHANGED";
    case "EPISODES":
      return activity.type === "EPISODE_WATCHED";
    case "FAVORITES":
      return activity.type === "REVIEW_CREATED" && (activity.review?.rating ?? 0) >= FAVORITE_MIN_RATING;
    case "COMPLETIONS":
      return activity.type === "SERIES_COMPLETED";
  }
}

/**
 * Fase 4/7 (INSERIES-PROFILE-PREMIUM-01) — a timeline reaproveita `getProfileActivity`
 * (lib/social/activity.ts, ja preserva a mesma regra de privacidade granular do restante do
 * perfil) e `ActivityCard` (o mesmo card do feed de atividades, sem duplicar o mapeamento
 * tipo->texto) — so adiciona um filtro client-side por cima do array ja buscado, nenhuma
 * query nova por filtro. "Favoritos" nao e um `ActivityType` proprio (o schema so tem
 * REVIEW_CREATED) — e derivado como uma review com nota >= 4, o mesmo criterio ja
 * estabelecido para "Favoritas" na Minha Lista Premium.
 */
export function ProfileTimeline({ activities }: { activities: ActivityFeedItem[] }) {
  const [filter, setFilter] = useState<TimelineFilter>("ALL");

  const filtered = useMemo(() => activities.filter((activity) => matchesFilter(activity, filter)), [activities, filter]);

  if (!activities.length) {
    return (
      <section className="space-y-4">
        <h2 className="section-title">Atividade</h2>
        <EmptyState title="Nenhuma atividade ainda" copy="Quando este usuario agir no inSeries, a jornada aparece aqui." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="section-title">Atividade</h2>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button key={item.key} variant={filter === item.key ? "primary" : "secondary"} size="sm" onClick={() => setFilter(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>
      {filtered.length ? (
        <div className="space-y-3">
          {filtered.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <EmptyState title="Nada por aqui" copy="Nenhuma atividade encontrada para este filtro." />
      )}
    </section>
  );
}
