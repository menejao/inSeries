"use client";

import { useState } from "react";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { RecommendationFeedbackMenu } from "@/components/recommendations/recommendation-feedback-menu";
import type { Series } from "@/lib/types";

/** Owns the hidden-card state so "Nao me interessa"/"Ja assisti"/"Ocultar" remove a card instantly without a full page reload. */
export function RecommendationCarouselItems({ items, priority = false }: { items: Series[]; priority?: boolean }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visible = items.filter((series) => !hiddenIds.has(series.id));

  if (!visible.length) return null;

  return (
    <Carousel>
      {visible.map((series, index) => (
        <CarouselItem key={series.id}>
          <div className="relative">
            <RecommendationFeedbackMenu
              seriesId={series.id}
              onHide={() => setHiddenIds((current) => new Set(current).add(series.id))}
              hasRatingBadge={typeof series.voteAverage === "number"}
            />
            <SeriesPosterCard series={series} priority={priority && index < 4} />
          </div>
        </CarouselItem>
      ))}
    </Carousel>
  );
}
