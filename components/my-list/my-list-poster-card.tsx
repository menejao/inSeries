"use client";

import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";
import { PosterBadge } from "@/components/media/poster-badge";
import { MyListItemMenu } from "@/components/my-list/my-list-item-menu";
import type { MyListItem } from "@/lib/my-list/types";

/**
 * INSERIES-MY-LIST-REDESIGN-01 — "Concluidas: manter a aparencia baseada em posteres... servira
 * como referencia visual para as demais" / "Quero assistir: priorizar apenas o poster, nao
 * exibir controles desnecessarios". Um unico card poster-only para os dois grupos: o menu ⋮ so
 * aparece no hover/foco (`opacity-0 group-hover:opacity-100`), nunca compete com o poster.
 */
export function MyListPosterCard({ item, badge }: { item: MyListItem; badge?: string }) {
  return (
    <div className="group relative">
      <Link href={`/series/${item.series.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-3xl border border-border shadow-card transition duration-300 ease-out group-hover:-translate-y-1 group-hover:border-border-strong group-hover:shadow-raised">
          <PosterImage
            src={item.series.posterUrl}
            alt={item.series.title}
            sizes="(min-width: 1024px) 190px, (min-width: 640px) 33vw, 40vw"
            imageClassName="transition duration-500 ease-out group-hover:scale-110"
          />
          {badge ? (
            <PosterBadge variant="secondary" className="absolute left-2 top-2">
              {badge}
            </PosterBadge>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{item.series.title}</p>
      </Link>
      <div className="absolute right-2 top-2 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <MyListItemMenu item={item} />
      </div>
    </div>
  );
}
