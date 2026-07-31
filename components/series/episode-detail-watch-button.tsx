"use client";

import { useState } from "react";
import { EpisodeWatchButton } from "@/components/series/episode-watch-button";

/**
 * INSERIES-SERIES-LIBRARY-ENGINE-01 — `EpisodeWatchButton` virou controlado (sem estado
 * proprio); esta e a casca client que uma pagina de episodio isolada (Server Component,
 * sem outro estado local pra amarrar o botao) precisa pra ele continuar funcionando sozinho.
 */
export function EpisodeDetailWatchButton({
  episodeId,
  initialWatched,
  authenticated
}: {
  episodeId: string;
  initialWatched: boolean;
  authenticated: boolean;
}) {
  const [watched, setWatched] = useState(initialWatched);
  return (
    <EpisodeWatchButton
      episodeId={episodeId}
      watched={watched}
      authenticated={authenticated}
      onChange={(nextWatched) => setWatched(nextWatched)}
    />
  );
}
