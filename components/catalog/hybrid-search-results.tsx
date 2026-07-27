"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PosterImage } from "@/components/media/poster-image";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CompassIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

type ExternalResult = {
  id: string;
  title: string;
  year: number;
  posterUrl: string;
  external: { externalId: string };
};

/**
 * Fase 3 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — busca hibrida: biblioteca local primeiro
 * (server-rendered), TMDb so quando a busca local nao encontra nada. "Importar" reusa
 * `POST /api/catalog/import` (ja existente, usado pelo sync admin) e redireciona pra pagina
 * da serie recem-importada — o usuario nunca ve um "id TMDb" bruto.
 */
export function HybridSearchResults({ query }: { query: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [results, setResults] = useState<ExternalResult[] | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResults(null);
    fetch(`/api/catalog/search-external?q=${encodeURIComponent(query)}`)
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((payload) => {
        if (!cancelled) setResults(payload.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function handleImport(externalId: string) {
    setImportingId(externalId);
    try {
      const response = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: externalId })
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: "Nao foi possivel importar a serie", variant: "error" });
        return;
      }
      router.push(`/series/${payload.data.slug}`);
    } finally {
      setImportingId(null);
    }
  }

  if (results === null) {
    return <p className="text-sm text-muted">Buscando no TMDb...</p>;
  }

  if (!results.length) {
    return <EmptyState icon={<CompassIcon className="h-6 w-6" />} title="Nenhuma serie encontrada" copy="Tente outro termo de busca." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Nao encontramos essa serie no catalogo, mas o TMDb tem estes resultados:</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface/70 p-3">
            <div className="relative aspect-[2/3] h-20 w-14 shrink-0 overflow-hidden rounded-xl">
              <PosterImage src={item.posterUrl} alt={item.title} sizes="56px" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-semibold text-ink">{item.title}</p>
              <p className="text-xs text-muted">{item.year || "Ano n/d"}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={importingId === item.external.externalId}
              onClick={() => handleImport(item.external.externalId)}
            >
              Importar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
