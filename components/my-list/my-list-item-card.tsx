"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { PosterImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { ProviderList } from "@/components/media/provider-badge";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { FlameIcon, SparklesIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { formatRelativeDate } from "@/lib/utils";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";
import type { MyListItem } from "@/lib/my-list/types";
import type { WatchState } from "@/lib/types";

/**
 * Fase 4 (INSERIES-MY-LISTS-PREMIUM-01) — o card premium de cada serie na Minha Lista:
 * poster, logo oficial com fallback (`SeriesLogoOrTitle`, ja existente), nota, Discovery
 * Score, Quality Score, providers, Collection Tags, progresso, status, ultima atividade e
 * acoes rapidas (mudar status/remover). Mudar status reaproveita `POST /api/series/[id]/status`
 * (o mesmo endpoint de `SeriesStatusActions`); remover usa o novo `DELETE` aditivo
 * (Fase 7). Hover premium padronizado (`-translate-y-1`), igual a todo outro card do app.
 */
export function MyListItemCard({
  item,
  selected,
  onToggleSelect
}: {
  item: MyListItem;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  function changeStatus(state: WatchState) {
    startTransition(async () => {
      const response = await fetch(`/api/series/${item.series.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId: item.series.id, state })
      });
      if (!response.ok) {
        toast({ title: "Erro ao mudar status", variant: "error" });
        return;
      }
      toast({ title: "Status atualizado", description: getWatchStateLabel(state), variant: "success" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const response = await fetch(`/api/series/${item.series.id}/status`, { method: "DELETE" });
      if (!response.ok) {
        toast({ title: "Erro ao remover da lista", variant: "error" });
        return;
      }
      setRemoved(true);
      toast({ title: "Removida da Minha Lista", description: item.series.title, variant: "success" });
      router.refresh();
    });
  }

  if (removed) return null;

  return (
    <Card
      padding="sm"
      className="flex gap-3 transition duration-200 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised sm:gap-4"
    >
      <Checkbox
        label={<span className="sr-only">Selecionar {item.series.title}</span>}
        checked={selected}
        onChange={onToggleSelect}
        className="pt-1"
      />

      <Link href={`/series/${item.series.slug}`} className="relative aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-2xl border border-border sm:w-24">
        <PosterImage src={item.series.posterUrl} alt={item.series.title} sizes="96px" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link href={`/series/${item.series.slug}`} className="min-w-0">
            <SeriesLogoOrTitle
              title={item.series.title}
              logoUrl={item.series.logoUrl}
              as="p"
              textClassName="line-clamp-1 font-semibold text-ink"
              logoClassName="h-6 max-w-[160px]"
            />
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            aria-label={`Remover ${item.series.title} da Minha Lista`}
            className="rounded-full p-1.5 text-subtle transition hover:bg-danger/10 hover:text-danger-text disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{item.state ? getWatchStateLabel(item.state) : "Sem status"}</Badge>
          {typeof item.series.voteAverage === "number" ? (
            <Badge variant="warning">
              <StarIcon className="h-3 w-3 fill-current" /> {item.series.voteAverage.toFixed(1)}
            </Badge>
          ) : null}
          {typeof item.series.qualityScore === "number" ? (
            <Badge variant="primary">
              <SparklesIcon className="h-3 w-3" /> {Math.round(item.series.qualityScore)}
            </Badge>
          ) : null}
          {typeof item.series.discoveryScore === "number" ? (
            <Badge variant="secondary">
              <FlameIcon className="h-3 w-3" /> {Math.round(item.series.discoveryScore)}
            </Badge>
          ) : null}
          {item.isFavorite ? <Badge variant="danger">Favorita</Badge> : null}
        </div>

        <ProviderList providers={item.series.watchProviders} limit={3} />
        <CollectionTagList tags={item.series.collectionTags} limit={2} />

        {item.completionPercent > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-subtle">
              <span>Progresso</span>
              <span>{Math.round(item.completionPercent)}%</span>
            </div>
            <Progress value={item.completionPercent} label={`Progresso de ${item.series.title}`} />
          </div>
        ) : null}

        <p className="text-xs text-subtle">
          {item.lastActivityAt ? `Ultima atividade ${formatRelativeDate(item.lastActivityAt)}` : `Adicionada ${formatRelativeDate(item.addedAt)}`}
        </p>

        <div className="mt-1 max-w-[220px]">
          <Select
            aria-label={`Mudar status de ${item.series.title}`}
            value={item.state ?? ""}
            disabled={isPending}
            onChange={(event) => changeStatus(event.target.value as WatchState)}
          >
            {!item.state ? (
              <option value="" disabled>
                Sem status
              </option>
            ) : null}
            {WATCH_STATE_ORDER.map((state) => (
              <option key={state} value={state}>
                {getWatchStateLabel(state)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Card>
  );
}
