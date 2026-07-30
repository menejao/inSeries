"use client";

import { useState } from "react";
import { SearchBar } from "@/components/ui/search-bar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { MY_LIST_GROUP_LABELS, type MyListGroupKey } from "@/lib/my-list/types";
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
const STATUS_OPTIONS: MyListGroupKey[] = ["WATCHING", "WANT_TO_WATCH", "COMPLETED", "FAVORITES", "PAUSED", "DROPPED"];

type FilterOptions = ReturnType<typeof getMyListFilterOptions>;

/**
 * INSERIES-MY-LIST-REDESIGN-01 — "exibir inicialmente apenas Status e Ordenacao... adicionar
 * um botao Filtros avancados". Busca continua a ferramenta principal; genero/ano/idioma/
 * pais/provider/tag/keyword ficam escondidos ate o usuario pedir — evita sobrecarregar a
 * interface com 7 selects sempre visiveis (era o comportamento antigo).
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function set<K extends keyof MyListFilters>(key: K, value: MyListFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const hasActiveAdvancedFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "query" || key === "status") return false;
    return value !== null;
  });

  return (
    <div className="space-y-3">
      <SearchBar
        label="Buscar na Minha Lista"
        placeholder="Buscar por titulo..."
        value={filters.query}
        onChange={(event) => set("query", event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filtrar por status"
          value={filters.status ?? ""}
          onChange={(event) => set("status", (event.target.value || null) as MyListGroupKey | null)}
        >
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {MY_LIST_GROUP_LABELS[status]}
            </option>
          ))}
        </Select>

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

        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          aria-expanded={advancedOpen}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium text-muted transition hover:border-border-strong hover:text-ink"
        >
          Filtros avancados
          {hasActiveAdvancedFilters ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
          <ChevronDownIcon className={cn("h-4 w-4 transition duration-200", advancedOpen && "rotate-180")} />
        </button>
      </div>

      {advancedOpen ? (
        <div className="space-y-3 rounded-3xl border border-border bg-surface/70 p-4">
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
              <option value="">Tag</option>
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

          {hasActiveAdvancedFilters ? (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...EMPTY_MY_LIST_FILTERS, query: filters.query, status: filters.status })}
              className="link-accent text-sm"
            >
              Limpar filtros avancados
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
