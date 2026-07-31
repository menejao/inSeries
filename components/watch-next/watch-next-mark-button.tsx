"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { useMarkEpisodeWatched } from "@/components/series/mark-episode-watched-dialog";

/**
 * Fase 7 — reuses the exact same mutation every other "mark watched" button
 * in the app calls (`POST /api/episodes/[id]/progress` -> toggleEpisodeProgress).
 * No parallel progress logic: `router.refresh()` re-runs the server component,
 * which re-derives the next pending episode (or drops the series entirely) from
 * the same lib/watch-next query every other consumer uses.
 *
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — "escolher a data que assisti": mesmo dialogo
 * (Hoje / Escolher uma data) de EpisodeWatchButton, pra nao ter duas logicas de marcar
 * episodio diferentes entre a pagina da serie e o widget "Proximo episodio".
 */
export function WatchNextMarkButton({
  episodeId,
  variant = "primary",
  size = "lg",
  className = "w-full sm:w-auto",
  label = "Marcar assistido",
  ariaLabel
}: {
  episodeId: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
  /** Fase 16 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — nome acessivel completo ("Marcar Silo,
   * temporada 3, episodio 4 como assistido"), independente do texto visivel curto do botao. */
  ariaLabel?: string;
}) {
  const [justWatched, setJustWatched] = useState(false);
  const { requestMark, dialog, isPending } = useMarkEpisodeWatched(episodeId, () => setJustWatched(true));

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        aria-label={ariaLabel}
        disabled={isPending || justWatched}
        loading={isPending}
        onClick={requestMark}
      >
        <CheckCircleIcon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
        {justWatched ? "Assistido!" : label}
      </Button>
      {dialog}
    </>
  );
}
