"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackdropImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CompassIcon, SparklesIcon, StarIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
import { cn } from "@/lib/utils";
import type { Series } from "@/lib/types";

/** Fase 3 — "trocar automaticamente entre 15 e 20 segundos". */
const ROTATION_MS = 18_000;

/**
 * Fase 2/3/4 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — the full-bleed, ever-rotating
 * Hero. `pool` arrives already shuffled by the server (a fresh `Math.random()` order per
 * request/reload — see landing-page.tsx), so this component only needs to cycle through it
 * sequentially: that alone satisfies both "nunca repetir sempre a mesma série" (the pool
 * itself has no duplicates) and "trocar ao atualizar a página" (a reload re-shuffles
 * server-side, this component never does its own randomization, so no hydration mismatch).
 *
 * Rendering strategy: only ever two backdrop layers exist in the DOM — the active one
 * (opacity 100) and the next one in the rotation (opacity 0, invisible but already
 * fetching — "preload da próxima imagem"). When the timer advances, the "next" layer's
 * className flips to opacity-100 (same DOM node, same `key`, so React reconciles in place
 * instead of remounting — "transição sem flickering"), and a fresh "next" layer mounts
 * behind it for the following rotation. Hovering the Hero pauses the timer.
 */
export function CinematicHero({ pool }: { pool: Series[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || pool.length <= 1) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, [paused, pool.length]);

  if (!pool.length) {
    return (
      <div className="relative flex min-h-[95dvh] items-center justify-center bg-gradient-to-br from-surface-strong via-surface to-canvas px-4 sm:min-h-[100dvh]">
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Catalogo ainda vazio"
          copy="Assim que series forem sincronizadas, elas aparecem aqui em destaque."
        />
      </div>
    );
  }

  const current = pool[index % pool.length];
  const nextIndex = pool.length > 1 ? (index + 1) % pool.length : index;
  const next = pool[nextIndex];
  const layers = next && next.id !== current.id ? [current, next] : [current];

  return (
    <div
      className="group relative min-h-[95dvh] overflow-hidden sm:min-h-[100dvh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {layers.map((series) => {
        const isActive = series.id === current.id;
        return (
          <div
            key={series.id}
            aria-hidden={!isActive}
            className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", isActive ? "opacity-100" : "opacity-0")}
          >
            <div className={cn("h-full w-full", isActive && "animate-kenburns motion-reduce:animate-none")}>
              <BackdropImage
                src={series.backdropUrl || series.posterUrl}
                alt={series.title}
                priority={index === 0}
                sizes="100vw"
              />
            </div>
          </div>
        );
      })}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/75 via-canvas/15 to-transparent" />

      <div className="relative flex min-h-[95dvh] flex-col justify-end gap-5 px-4 pb-16 pt-28 sm:min-h-[100dvh] sm:gap-6 sm:px-10 sm:pb-24 lg:max-w-2xl">
        <div key={current.id} className="animate-fade-in-up space-y-4">
          <p className="eyebrow text-ink/70">Em destaque no catalogo inSeries</p>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(current.status)}>{getStatusLabel(current.status)}</Badge>
            {current.type ? <Badge variant="outline">{current.type}</Badge> : null}
            {current.year ? <Badge variant="default">{current.year}</Badge> : null}
            {typeof current.voteAverage === "number" ? (
              <Badge variant="warning">
                <StarIcon className="h-3 w-3 fill-current" /> {current.voteAverage.toFixed(1)}
              </Badge>
            ) : null}
            {typeof current.qualityScore === "number" ? (
              <Badge variant="primary">
                <SparklesIcon className="h-3 w-3" /> {Math.round(current.qualityScore)}
              </Badge>
            ) : null}
          </div>

          <SeriesLogoOrTitle
            title={current.title}
            logoUrl={current.logoUrl}
            as="h1"
            textClassName="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl"
            logoClassName="h-16 max-w-[300px] sm:h-24 sm:max-w-[420px]"
          />

          {current.genres.length ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              {current.genres.slice(0, 4).map((genre) => (
                <span key={genre} className="rounded-full bg-surface-strong/70 px-2.5 py-1 backdrop-blur">
                  {genre}
                </span>
              ))}
            </div>
          ) : null}

          <p className="max-w-xl text-sm leading-7 text-ink/90 line-clamp-3 sm:text-base">{current.overview}</p>

          {current.collectionTags.length || current.watchProviders.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <CollectionTagList tags={current.collectionTags} limit={3} />
              <ProviderList providers={current.watchProviders} limit={3} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/register" className="inline-flex">
            <Button size="lg">Criar conta gratis</Button>
          </Link>
          <Link href="/series" className="inline-flex">
            <Button size="lg" variant="secondary">
              Explorar catalogo
            </Button>
          </Link>
        </div>

        {pool.length > 1 ? (
          <div className="flex gap-1.5 pt-1" role="tablist" aria-label="Series em destaque">
            {pool.map((series, i) => (
              <button
                key={series.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Destacar ${series.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-8 bg-ink" : "w-4 bg-ink/30 hover:bg-ink/60"
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
