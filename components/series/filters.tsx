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
  rating: "Nota",
  quality: "Quality Score"
};

/** Fase 8 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — tag/provider/country/language discovery, alongside the pre-existing genre/status/year/sort. */
export function Filters({
  query,
  genre,
  status,
  year,
  tag,
  provider,
  country,
  language,
  sort,
  metadata
}: {
  query?: string;
  genre?: string;
  status?: string;
  year?: string;
  tag?: string;
  provider?: string;
  country?: string;
  language?: string;
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
      {metadata.tags.length ? (
        <Select name="tag" defaultValue={tag ?? ""} aria-label="Filtrar por tag">
          <option value="">Tag</option>
          {metadata.tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      ) : null}
      {metadata.providers.length ? (
        <Select name="provider" defaultValue={provider ?? ""} aria-label="Filtrar por provedor">
          <option value="">Provedor</option>
          {metadata.providers.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      ) : null}
      {metadata.countries.length ? (
        <Select name="country" defaultValue={country ?? ""} aria-label="Filtrar por pais">
          <option value="">Pais</option>
          {metadata.countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      ) : null}
      {metadata.languages.length ? (
        <Select name="language" defaultValue={language ?? ""} aria-label="Filtrar por idioma">
          <option value="">Idioma</option>
          {metadata.languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      ) : null}
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
