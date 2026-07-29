import { Card } from "@/components/ui/card";
import { BarList } from "@/components/ui/bar-list";
import type { StatsRankings } from "@/lib/stats/types";

const SECTIONS: Array<{ key: keyof StatsRankings; title: string; suffix: string }> = [
  { key: "topSeries", title: "Series mais assistidas", suffix: " ep." },
  { key: "topGenres", title: "Generos favoritos", suffix: " ep." },
  { key: "topPlatforms", title: "Plataformas", suffix: " series" },
  { key: "topNetworks", title: "Emissoras", suffix: " series" },
  { key: "topCountries", title: "Paises", suffix: " series" },
  { key: "topLanguages", title: "Idiomas", suffix: " series" }
];

/** INSERIES-STATISTICS-ENGINE-01 — "Rankings pessoais": top 10 por categoria. */
export function RankingsSection({ rankings }: { rankings: StatsRankings }) {
  const nonEmpty = SECTIONS.filter((section) => rankings[section.key].length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {nonEmpty.map((section) => (
        <Card key={section.key}>
          <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
          <div className="mt-4">
            <BarList
              items={rankings[section.key].map((entry) => ({ label: entry.label, value: entry.count, percentage: entry.percentage }))}
              valueSuffix={section.suffix}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
