import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { SearchBar } from "@/components/ui/search-bar";
import { Button } from "@/components/ui/button";
import { getStatusLabel } from "@/lib/catalog/status-labels";
import type { CatalogFilterMetadata } from "@/lib/discovery/search";

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
    <Card as="form" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" padding="sm">
      <SearchBar
        name="q"
        id="catalog-search"
        label="Buscar por titulo ou sinopse"
        defaultValue={query ?? ""}
        placeholder="Buscar por titulo ou sinopse..."
        className="xl:col-span-2"
      />
      <Select name="genre" defaultValue={genre ?? ""} aria-label="Filtrar por genero">
        <option value="">Genero</option>
        {metadata.genres.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select name="status" defaultValue={status ?? ""} aria-label="Filtrar por status">
        <option value="">Status</option>
        {metadata.statuses.map((item) => (
          <option key={item} value={item}>
            {getStatusLabel(item)}
          </option>
        ))}
      </Select>
      <Select name="year" defaultValue={year ?? ""} aria-label="Filtrar por ano">
        <option value="">Ano</option>
        {metadata.years.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </Select>
      <Select name="sort" defaultValue={sort ?? "popular"} aria-label="Ordenar por">
        {Object.entries(sortLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button type="submit" className="xl:col-span-6">
        Aplicar filtros
      </Button>
    </Card>
  );
}
