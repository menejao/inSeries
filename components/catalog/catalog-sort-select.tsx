"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { SeriesSortOption } from "@/lib/discovery/search";

const SORT_LABELS: Record<Exclude<SeriesSortOption, "quality" | "discovery">, string> = {
  popular: "Mais populares",
  rating: "Melhor avaliadas",
  latest: "Mais recentes",
  title: "A-Z",
  seasons: "Mais temporadas",
  episodes: "Mais episodios"
};

// Fase 6 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — exatamente as 6 opcoes do ticket, "Maior
// nota TMDB"/"Em alta" removidas (nao fazem parte da lista da Fase 6; "Em alta" tambem deixou
// de existir como conceito de UI depois que as secoes editoriais foram removidas na Fase 2).
const SORT_OPTIONS: Array<Exclude<SeriesSortOption, "quality" | "discovery">> = ["popular", "latest", "rating", "title", "seasons", "episodes"];

/** Fase 5/6 (INSERIES-CATALOG-SERIES-EXPERIENCE-V2) — ordenacao como elemento dedicado, separado da busca e dos filtros. */
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
