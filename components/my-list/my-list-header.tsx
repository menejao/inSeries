import { CheckCircleIcon, ClockIcon, HeartIcon, PlayIcon, TrashIcon, TvIcon } from "@/components/ui/icons";
import { MY_LIST_GROUP_LABELS, type MyListItem } from "@/lib/my-list/types";

/**
 * Fase 11/12 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "a pagina deve deixar de
 * funcionar como Dashboard... horas assistidas/tempo assistido/graficos/totais detalhados
 * pertencem exclusivamente a pagina Estatisticas". O header perdeu os 6 tiles antigos
 * (incluindo "Tempo assistido"/"Sequencia atual", puramente analiticos) - sobra so o
 * "Resumo" da estrutura sugerida pelo ticket: quantas series em cada grupo, organizacional,
 * nao analitico.
 */
export function MyListHeader({ items }: { items: MyListItem[] }) {
  const counts = {
    WATCHING: items.filter((item) => item.state === "WATCHING").length,
    WANT_TO_WATCH: items.filter((item) => item.state === "WANT_TO_WATCH").length,
    COMPLETED: items.filter((item) => item.state === "COMPLETED").length,
    FAVORITES: items.filter((item) => item.isFavorite).length,
    PAUSED: items.filter((item) => item.state === "PAUSED").length,
    DROPPED: items.filter((item) => item.state === "DROPPED").length
  };

  const tiles = [
    { icon: PlayIcon, key: "WATCHING" as const },
    { icon: TvIcon, key: "WANT_TO_WATCH" as const },
    { icon: CheckCircleIcon, key: "COMPLETED" as const },
    { icon: HeartIcon, key: "FAVORITES" as const },
    { icon: ClockIcon, key: "PAUSED" as const },
    { icon: TrashIcon, key: "DROPPED" as const }
  ];

  return (
    <section className="rounded-4xl border border-border bg-surface/70 p-5 sm:p-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Minha Lista</h1>
        <p className="section-copy">Como esta organizada a sua biblioteca.</p>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.key} className="space-y-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
              <tile.icon className="h-4.5 w-4.5" />
            </span>
            <p className="truncate text-xl font-black text-ink sm:text-2xl">{counts[tile.key]}</p>
            <p className="text-xs text-muted">{MY_LIST_GROUP_LABELS[tile.key]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
