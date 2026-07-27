"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { PosterImage } from "@/components/media/poster-image";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { WATCH_STATE_ORDER, getWatchStateLabel } from "@/lib/progress/labels";
import type { MyListItem } from "@/lib/my-list/types";
import type { WatchState } from "@/lib/types";

/**
 * Fase 15 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "reduzir drasticamente a
 * quantidade de informacoes... cada card deve possuir somente: poster, titulo,
 * temporada/episodio (quando aplicavel), status, plataforma (quando relevante), acao
 * principal... mover informacoes secundarias pra modal/drawer/pagina da serie... nao
 * depender de hover". Removidos desta sessao: nota (voteAverage), Quality Score, Discovery
 * Score, badge "Favorita" redundante, Collection Tags, barra de progresso + porcentagem
 * (mesma razao da Fase 3 do Dashboard - pertence a Pagina da Serie/Estatisticas), texto de
 * ultima atividade. A "acao principal" e o seletor de status (reorganizar a biblioteca e
 * literalmente o unico objetivo desta pagina - Fase 11); remover da lista continua
 * disponivel como acao utilitaria pequena, nao conta como "informacao".
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

  const platform = item.series.watchProviders[0] ?? null;

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
          {platform ? <Badge variant="outline">{platform}</Badge> : null}
        </div>

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
