"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/**
 * Substitui "Carregar mais" por paginacao tradicional (Fase: numero exato de series nunca e
 * exposto ao usuario — ver page.tsx — entao paginas ficam sem contagem total, so
 * anterior/proximo + numeros ao redor da pagina atual).
 */
export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.push(`${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1].filter((n) => n >= 1 && n <= totalPages));
  const sorted = Array.from(pages).sort((a, b) => a - b);

  return (
    <nav aria-label="Paginacao" className="flex items-center justify-center gap-1">
      <Button type="button" variant="ghost" size="sm" onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="Pagina anterior">
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      {sorted.map((n, index) => {
        const previous = sorted[index - 1];
        const showGap = previous !== undefined && n - previous > 1;
        return (
          <span key={n} className="flex items-center gap-1">
            {showGap ? <span className="px-1 text-sm text-subtle">…</span> : null}
            <button
              type="button"
              onClick={() => goTo(n)}
              aria-current={n === page ? "page" : undefined}
              className={
                n === page
                  ? "flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary px-2 text-sm font-semibold text-on-primary"
                  : "flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm text-muted transition hover:bg-surface-strong/60 hover:text-ink"
              }
            >
              {n}
            </button>
          </span>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => goTo(page + 1)}
        disabled={page >= totalPages}
        aria-label="Proxima pagina"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </nav>
  );
}
