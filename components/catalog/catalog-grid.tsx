"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FixedGrid } from "@/components/ui/fixed-grid";
import { SeriesCard } from "@/components/series/series-card";
import { Button } from "@/components/ui/button";
import type { Series } from "@/lib/types";

/**
 * Fase 8 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — paginacao tradicional removida. Primeira
 * pagina vem server-rendered (SEO, sem loading state inicial); paginas seguintes sao buscadas
 * em `/api/catalog/browse` e anexadas ao grid existente ("Carregar mais", sem trocar de URL).
 */
export function CatalogGrid({ initialItems, initialPage, totalPages }: { initialItems: Series[]; initialPage: number; totalPages: number }) {
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);

  const hasMore = page < totalPages;

  async function loadMore() {
    setLoading(true);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(page + 1));
      const response = await fetch(`/api/catalog/browse?${params.toString()}`);
      const payload = await response.json();
      setItems((current) => [...current, ...payload.data.items]);
      setPage((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <FixedGrid mobile={2} tablet={4} desktop={5} wide={6}>
        {items.map((item) => (
          <SeriesCard key={item.id} series={item} />
        ))}
      </FixedGrid>
      {hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMore} loading={loading}>
            Carregar mais
          </Button>
        </div>
      ) : null}
    </div>
  );
}
