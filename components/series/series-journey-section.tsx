"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon, StarIcon, TvIcon } from "@/components/ui/icons";
import { formatEpisodeCode, formatRelativeDate } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  WANT_TO_WATCH: "Quero assistir",
  WATCHING: "Assistindo",
  PAUSED: "Pausada",
  DROPPED: "Abandonada",
  COMPLETED: "Concluida"
};

type JourneyItem = {
  id: string;
  type: string;
  createdAt: string;
  metadata?: unknown;
  episode?: { number: number; title: string; season: { number: number } } | null;
  review?: { rating: number } | null;
};

type JourneyResponse = {
  items: JourneyItem[];
  nextCursor: string | null;
};

function JourneyItemRow({ item }: { item: JourneyItem }) {
  switch (item.type) {
    case "EPISODE_WATCHED": {
      if (!item.episode) return null;
      const code = formatEpisodeCode(item.episode.season.number, item.episode.number);
      return (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
            <CheckCircleIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              Assistiu <Badge variant="secondary">{code}</Badge>{" "}
              <span className="text-muted">{item.episode.title}</span>
            </p>
            <p className="mt-0.5 text-xs text-subtle">{formatRelativeDate(new Date(item.createdAt))}</p>
          </div>
        </div>
      );
    }
    case "SERIES_STATUS_CHANGED": {
      const metadata = (item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata) ? item.metadata : {}) as { to?: string };
      const label = statusLabels[metadata.to ?? ""] ?? metadata.to ?? "";
      return (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
            <TvIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              Status alterado para <Badge variant="outline">{label}</Badge>
            </p>
            <p className="mt-0.5 text-xs text-subtle">{formatRelativeDate(new Date(item.createdAt))}</p>
          </div>
        </div>
      );
    }
    case "SERIES_COMPLETED": {
      return (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
            <StarIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Serie concluida!</p>
            <p className="mt-0.5 text-xs text-subtle">{formatRelativeDate(new Date(item.createdAt))}</p>
          </div>
        </div>
      );
    }
    case "REVIEW_CREATED": {
      return (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
            <StarIcon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              Avaliou com{" "}
              <Badge variant="warning">
                <StarIcon className="h-3 w-3 fill-current" /> {item.review?.rating ?? "?"}/5
              </Badge>
            </p>
            <p className="mt-0.5 text-xs text-subtle">{formatRelativeDate(new Date(item.createdAt))}</p>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}

type Props = {
  seriesId: string;
  initialData: JourneyResponse;
};

export function SeriesJourneySection({ seriesId, initialData }: Props) {
  const [items, setItems] = useState<JourneyItem[]>(initialData.items);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData.nextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function loadMore() {
    if (!nextCursor) return;
    setError(null);
    startTransition(async () => {
      const response = await fetch(
        `/api/series/${seriesId}/journey?cursor=${encodeURIComponent(nextCursor!)}`
      );
      if (!response.ok) {
        setError("Nao foi possivel carregar mais atividades.");
        return;
      }
      const data = (await response.json()) as JourneyResponse;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    });
  }

  return (
    <div className="space-y-3">
      <div
        className="max-h-80 space-y-4 overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {items.map((item) => (
          <JourneyItemRow key={item.id} item={item} />
        ))}
      </div>
      {error ? <p className="text-xs text-error">{error}</p> : null}
      {nextCursor ? (
        <Button variant="secondary" size="sm" onClick={loadMore} disabled={isPending} loading={isPending}>
          Carregar mais
        </Button>
      ) : (
        <p className="text-xs text-subtle">Inicio da jornada.</p>
      )}
    </div>
  );
}
