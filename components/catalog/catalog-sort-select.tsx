"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { SeriesSortOption } from "@/lib/discovery/search";

const SORT_LABELS: Record<Exclude<SeriesSortOption, "quality" | "seasons" | "episodes">, string> = {
  discovery: "Relevancia",
  popular: "Mais populares",
  rating: "Melhor avaliadas",
  latest: "Mais recentes",
  onair: "Em exibicao",
  title: "A-Z"
};

// Fase 20 (INSERIES-CATALOG-POPULATION-AND-EXPERIENCE-V3) — as 6 opcoes exatas do ticket:
// Relevancia (ranking interno combinado, default), Mais populares, Mais bem avaliadas, Mais
// recentes, Em exibicao, A-Z.
const SORT_OPTIONS: Array<Exclude<SeriesSortOption, "quality" | "seasons" | "episodes">> = [
  "discovery",
  "popular",
  "rating",
  "latest",
  "onair",
  "title"
];

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
