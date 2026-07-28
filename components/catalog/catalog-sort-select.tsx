"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";
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
    <div className="relative shrink-0">
      <select
        aria-label="Ordenar por"
        value={sort}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full border-none bg-transparent pl-2.5 pr-6 text-xs font-medium text-muted transition",
          "hover:text-ink focus-visible:text-ink"
        )}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
    </div>
  );
}
