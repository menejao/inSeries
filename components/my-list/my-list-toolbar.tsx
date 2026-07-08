"use client";

import { SearchBar } from "@/components/ui/search-bar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EMPTY_MY_LIST_FILTERS, type MyListFilters, type MyListSortDirection, type MyListSortField, type getMyListFilterOptions } from "@/lib/my-list/filter-sort";

const SORT_FIELD_LABELS: Record<MyListSortField, string> = {
  lastActivity: "Ultima atividade",
  updatedAt: "Ultima atualizacao",
  addedAt: "Data adicionada",
  title: "Titulo",
  popularity: "Popularidade",
  qualityScore: "Quality Score",
  discoveryScore: "Discovery Score",
  voteAverage: "Nota",
  episodeCount: "Quantidade de episodios",
  seasonCount: "Quantidade de temporadas"
};

const SORT_FIELDS = Object.keys(SORT_FIELD_LABELS) as MyListSortField[];

type FilterOptions = ReturnType<typeof getMyListFilterOptions>;

/**
 * Fase 5/6/8 (INSERIES-MY-LISTS-PREMIUM-01) — busca + filtros + ordenacao, tudo controlado
 * pelo componente pai (`my-list-page-client.tsx`): este componente nao tem estado nem logica
 * de negocio propria, so emite os callbacks. As opcoes de cada filtro vem exclusivamente dos
 * valores presentes na propria lista do usuario (`getMyListFilterOptions`), nunca do catalogo
 * inteiro.
 */
export function MyListToolbar({
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  options
}: {
  filters: MyListFilters;
  onFiltersChange: (filters: MyListFilters) => void;
  sortField: MyListSortField;
  sortDirection: MyListSortDirection;
  onSortChange: (field: MyListSortField, direction: MyListSortDirection) => void;
  options: FilterOptions;
}) {
  function set<K extends keyof MyListFilters>(key: K, value: MyListFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "query") return false;
    return value !== null;
  });

  return (
    <div className="space-y-3 rounded-4xl border border-border bg-surface/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchBar
            label="Buscar na Minha Lista"
            placeholder="Buscar por titulo, keyword, tag ou provider..."
            value={filters.query}
            onChange={(event) => set("query", event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select aria-label="Ordenar por" value={sortField} onChange={(event) => onSortChange(event.target.value as MyListSortField, sortDirection)}>
            {SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {SORT_FIELD_LABELS[field]}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            size="md"
            onClick={() => onSortChange(sortField, sortDirection === "asc" ? "desc" : "asc")}
            aria-label={sortDirection === "asc" ? "Ordem ascendente" : "Ordem descendente"}
          >
            {sortDirection === "asc" ? "Asc" : "Desc"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Select aria-label="Filtrar por genero" value={filters.genre ?? ""} onChange={(event) => set("genre", event.target.value || null)}>
          <option value="">Genero</option>
          {options.genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por ano"
          value={filters.year?.toString() ?? ""}
          onChange={(event) => set("year", event.target.value ? Number(event.target.value) : null)}
        >
          <option value="">Ano</option>
          {options.years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por idioma" value={filters.language ?? ""} onChange={(event) => set("language", event.target.value || null)}>
          <option value="">Idioma</option>
          {options.languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por pais" value={filters.country ?? ""} onChange={(event) => set("country", event.target.value || null)}>
          <option value="">Pais</option>
          {options.countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por provider" value={filters.provider ?? ""} onChange={(event) => set("provider", event.target.value || null)}>
          <option value="">Provider</option>
          {options.providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por Collection Tag" value={filters.tag ?? ""} onChange={(event) => set("tag", event.target.value || null)}>
          <option value="">Collection Tag</option>
          {options.tags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </Select>
        <Select aria-label="Filtrar por keyword" value={filters.keyword ?? ""} onChange={(event) => set("keyword", event.target.value || null)}>
          <option value="">Keyword</option>
          {options.keywords.map((keyword) => (
            <option key={keyword} value={keyword}>
              {keyword}
            </option>
          ))}
        </Select>
      </div>

      {hasActiveFilters ? (
        <button type="button" onClick={() => onFiltersChange({ ...EMPTY_MY_LIST_FILTERS, query: filters.query })} className="link-accent text-sm">
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
