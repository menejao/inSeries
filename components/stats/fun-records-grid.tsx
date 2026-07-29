import { Card } from "@/components/ui/card";
import { FlameIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";
import type { FunRecords } from "@/lib/stats/types";

function RecordCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm" className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger-text">
        <FlameIcon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{value}</p>
        <p className="text-xs text-subtle">{label}</p>
      </div>
    </Card>
  );
}

/** INSERIES-STATISTICS-ENGINE-01 — "Recordes": secao exclusiva com os melhores/maiores numeros do usuario. */
export function FunRecordsGrid({ records }: { records: FunRecords }) {
  const cards: Array<{ label: string; value: string } | null> = [
    records.biggestBingeDay
      ? { label: `Maior maratona (${formatDate(new Date(`${records.biggestBingeDay.date}T12:00:00.000Z`))})`, value: `${records.biggestBingeDay.episodeCount} episodios em um dia` }
      : null,
    records.longestSeriesCompleted
      ? { label: "Serie mais longa concluida", value: `${records.longestSeriesCompleted.title} (${records.longestSeriesCompleted.episodeCount} ep.)` }
      : null,
    records.fastestCompletion
      ? { label: "Serie concluida mais rapido", value: `${records.fastestCompletion.title} em ${records.fastestCompletion.days} dia(s)` }
      : null,
    records.longestTracked ? { label: "Acompanhada ha mais tempo", value: `${records.longestTracked.title} (${records.longestTracked.days} dias)` } : null,
    records.favoriteHour ? { label: "Horario favorito", value: `Por volta das ${records.favoriteHour.label}` } : null,
    records.favoriteWeekday ? { label: "Dia da semana preferido", value: records.favoriteWeekday.label } : null,
    records.averageEpisodesPerSession
      ? { label: "Media de episodios por sessao", value: `${records.averageEpisodesPerSession} episodio(s)` }
      : null,
    records.lateNightEpisodes > 0 ? { label: "Episodios apos meia-noite", value: `${records.lateNightEpisodes}` } : null
  ];

  const visible = cards.filter((card): card is { label: string; value: string } => card !== null);
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((card) => (
        <RecordCard key={card.label} label={card.label} value={card.value} />
      ))}
    </div>
  );
}
