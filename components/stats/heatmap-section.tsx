"use client";

import { useState } from "react";
import { Heatmap } from "@/components/ui/heatmap";
import { Sheet } from "@/components/ui/sheet";
import { formatDate } from "@/lib/utils";
import type { DayDetailEpisode } from "@/lib/stats/types";

/** INSERIES-STATISTICS-ENGINE-01 — "ao clicar: abrir os episodios daquele dia." */
export function HeatmapSection({ counts, dayDetails }: { counts: Record<string, number>; dayDetails: Record<string, DayDetailEpisode[]> }) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const episodes = openDay ? (dayDetails[openDay] ?? []) : [];

  return (
    <>
      <Heatmap counts={counts} onDayClick={setOpenDay} />
      <Sheet
        open={openDay !== null}
        onClose={() => setOpenDay(null)}
        title={openDay ? formatDate(new Date(`${openDay}T12:00:00.000Z`)) : undefined}
      >
        <ul className="space-y-3">
          {episodes.map((episode, index) => (
            <li key={index} className="rounded-2xl border border-border bg-surface-strong/40 p-3">
              <p className="text-sm font-semibold text-ink">{episode.seriesTitle}</p>
              <p className="text-xs text-muted">{episode.episodeTitle}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
