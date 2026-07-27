"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { SeriesSortOption } from "@/lib/discovery/search";

const SORT_LABELS: Record<SeriesSortOption, string> = {
  popular: "Mais populares",
  rating: "Melhor avaliadas",
  latest: "Mais recentes",
  title: "A-Z",
  seasons: "Mais temporadas",
  episodes: "Mais episodios",
  quality: "Maior nota TMDB",
  discovery: "Em alta"
};

const SORT_OPTIONS: SeriesSortOption[] = ["popular", "rating", "latest", "title", "seasons", "episodes", "quality"];

/** Fase 5 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — ordenacao como elemento dedicado, separado da busca e dos filtros. */
export function CatalogSortSelect({ sort }: { sort: SeriesSortOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", next);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select aria-label="Ordenar por" value={sort} onChange={(event) => handleChange(event.target.value)} className="sm:w-56">
      {SORT_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {SORT_LABELS[option]}
        </option>
      ))}
    </Select>
  );
}
