"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { PosterImage } from "@/components/media/poster-image";
import { PosterBadge } from "@/components/media/poster-badge";
import { TvIcon } from "@/components/ui/icons";

export type LibrarySeriesTile = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  state: "WATCHING" | "COMPLETED";
};

const STATE_LABEL: Record<LibrarySeriesTile["state"], string> = { WATCHING: "Assistindo", COMPLETED: "Concluida" };
const STATE_VARIANT: Record<LibrarySeriesTile["state"], "secondary" | "success"> = { WATCHING: "secondary", COMPLETED: "success" };

const PREVIEW_COUNT = 6;
const MODAL_PAGE_SIZE = 24;

function PosterTile({ series }: { series: LibrarySeriesTile }) {
  return (
    <Link
      href={`/series/${series.slug}`}
      aria-label={`Abrir ${series.title} (${STATE_LABEL[series.state]})`}
      className="group relative block aspect-[2/3] overflow-hidden rounded-2xl border border-border transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <PosterImage
        src={series.posterUrl}
        alt={series.title}
        sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 33vw"
        imageClassName="transition duration-300 ease-out group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/90 via-transparent to-transparent" />
      <div className="absolute left-2 top-2">
        <PosterBadge variant={STATE_VARIANT[series.state]}>{STATE_LABEL[series.state]}</PosterBadge>
      </div>
      <p className="absolute inset-x-0 bottom-0 line-clamp-1 p-2 text-xs font-semibold text-ink">{series.title}</p>
    </Link>
  );
}

/**
 * Substitui as secoes separadas "Assistindo"/"Concluidas" (e o teaser duplicado "Concluidas
 * recentemente") por uma unica biblioteca de posteres com badge de status por card. Mostra
 * `PREVIEW_COUNT` series (grade responsiva); "Ver mais" abre um modal com a biblioteca
 * completa, revelada em paginas de `MODAL_PAGE_SIZE` ("Carregar mais" dentro do modal) — sem
 * nenhuma query nova, o array completo ja chega do servidor (privacidade ja resolvida la).
 */
export function ProfileSeriesLibrary({ items }: { items: LibrarySeriesTile[] }) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(MODAL_PAGE_SIZE);

  if (!items.length) {
    return (
      <section className="space-y-3">
        <h2 className="section-title">Series</h2>
        <EmptyState icon={<TvIcon className="h-6 w-6" />} title="Nenhuma serie ainda" copy="Series assistindo ou concluidas aparecem aqui." />
      </section>
    );
  }

  const preview = items.slice(0, PREVIEW_COUNT);
  const visibleInModal = items.slice(0, visibleCount);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Series</h2>
        {items.length > PREVIEW_COUNT ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Ver mais
          </Button>
        ) : null}
      </div>

      <FixedGrid mobile={2} tablet={3} desktop={6}>
        {preview.map((series) => (
          <PosterTile key={series.id} series={series} />
        ))}
      </FixedGrid>

      <Dialog open={open} onClose={() => setOpen(false)} title="Series" size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <FixedGrid mobile={2} tablet={3} desktop={4}>
            {visibleInModal.map((series) => (
              <PosterTile key={series.id} series={series} />
            ))}
          </FixedGrid>
          {visibleCount < items.length ? (
            <div className="flex justify-center">
              <Button type="button" variant="secondary" onClick={() => setVisibleCount((count) => count + MODAL_PAGE_SIZE)}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}
