import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { CatalogFilterMetadata } from "@/lib/discovery/search";

const statusLabels: Record<string, string> = {
  RETURNING: "Em exibicao",
  ENDED: "Finalizada",
  CANCELED: "Cancelada",
  IN_PRODUCTION: "Em producao",
  PILOT: "Piloto"
};

const sortLabels: Record<string, string> = {
  popular: "Popularidade",
  latest: "Lancamento",
  title: "Titulo",
  rating: "Nota"
};

export function Filters({
  query,
  genre,
  status,
  year,
  sort,
  metadata
}: {
  query?: string;
  genre?: string;
  status?: string;
  year?: string;
  sort?: string;
  metadata: CatalogFilterMetadata;
}) {
  return (
    <form className="grid gap-3 rounded-4xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-2 xl:grid-cols-6" method="get">
      <Input name="q" defaultValue={query ?? ""} placeholder="Buscar por titulo ou sinopse..." className="xl:col-span-2" />
      <Select name="genre" defaultValue={genre ?? ""}>
        <option value="">Genero</option>
        {metadata.genres.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select name="status" defaultValue={status ?? ""}>
        <option value="">Status</option>
        {metadata.statuses.map((item) => (
          <option key={item} value={item}>
            {statusLabels[item] ?? item}
          </option>
        ))}
      </Select>
      <Select name="year" defaultValue={year ?? ""}>
        <option value="">Ano</option>
        {metadata.years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select name="sort" defaultValue={sort ?? "popular"}>
        {Object.entries(sortLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <button className="min-h-11 rounded-2xl bg-ember px-4 text-sm font-semibold text-night xl:col-span-6" type="submit">
        Buscar
      </button>
    </form>
  );
}
