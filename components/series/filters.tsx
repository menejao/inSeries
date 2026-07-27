"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SettingsIcon, XIcon } from "@/components/ui/icons";
import { getStatusLabel } from "@/lib/catalog/status-labels";
import type { CatalogFilterMetadata } from "@/lib/discovery/search";

type FilterKey = "genre" | "status" | "year" | "tag" | "provider" | "country" | "language";

const FILTER_LABELS: Record<FilterKey, string> = {
  genre: "Genero",
  status: "Status",
  year: "Ano",
  tag: "Tag",
  provider: "Provedor",
  country: "Pais",
  language: "Idioma"
};

/**
 * Fase 4 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — form tradicional removido: filtros vivem
 * num Sheet, aplicam automaticamente (sem botao "Aplicar filtros") e ficam visiveis como
 * chips fora do Sheet, cada um removivel individualmente + "Limpar filtros".
 */
export function Filters({
  genre,
  status,
  year,
  tag,
  provider,
  country,
  language,
  metadata
}: {
  genre?: string;
  status?: string;
  year?: string;
  tag?: string;
  provider?: string;
  country?: string;
  language?: string;
  metadata: CatalogFilterMetadata;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const current: Record<FilterKey, string | undefined> = { genre, status, year, tag, provider, country, language };
  const activeEntries = (Object.entries(current) as Array<[FilterKey, string | undefined]>).filter(([, value]) => Boolean(value));

  function updateParam(key: FilterKey, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of Object.keys(FILTER_LABELS)) params.delete(key);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const statusLabel = useMemo(() => (value: string) => (value ? getStatusLabel(value) : value), []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="md" onClick={() => setOpen(true)}>
        <SettingsIcon className="h-4 w-4" />
        Filtros
        {activeEntries.length ? <Badge variant="primary">{activeEntries.length}</Badge> : null}
      </Button>

      {activeEntries.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => updateParam(key, "")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-strong/60 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-border-strong"
        >
          {key === "status" ? statusLabel(value as string) : value}
          <XIcon className="h-3 w-3 text-subtle" aria-hidden />
        </button>
      ))}

      {activeEntries.length ? (
        <button type="button" onClick={clearAll} className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
          Limpar filtros
        </button>
      ) : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select aria-label="Filtrar por genero" value={genre ?? ""} onChange={(event) => updateParam("genre", event.target.value)}>
            <option value="">Genero</option>
            {metadata.genres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por status" value={status ?? ""} onChange={(event) => updateParam("status", event.target.value)}>
            <option value="">Status</option>
            {metadata.statuses.map((item) => (
              <option key={item} value={item}>
                {getStatusLabel(item)}
              </option>
            ))}
          </Select>
          <Select aria-label="Filtrar por ano" value={year ?? ""} onChange={(event) => updateParam("year", event.target.value)}>
            <option value="">Ano</option>
            {metadata.years.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          {metadata.tags.length ? (
            <Select aria-label="Filtrar por tag" value={tag ?? ""} onChange={(event) => updateParam("tag", event.target.value)}>
              <option value="">Tag</option>
              {metadata.tags.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}
          {metadata.providers.length ? (
            <Select aria-label="Filtrar por provedor" value={provider ?? ""} onChange={(event) => updateParam("provider", event.target.value)}>
              <option value="">Provedor</option>
              {metadata.providers.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}
          {metadata.countries.length ? (
            <Select aria-label="Filtrar por pais" value={country ?? ""} onChange={(event) => updateParam("country", event.target.value)}>
              <option value="">Pais</option>
              {metadata.countries.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}
          {metadata.languages.length ? (
            <Select aria-label="Filtrar por idioma" value={language ?? ""} onChange={(event) => updateParam("language", event.target.value)}>
              <option value="">Idioma</option>
              {metadata.languages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button type="button" onClick={clearAll} className="text-sm font-medium text-muted hover:text-ink" disabled={!activeEntries.length}>
            Limpar filtros
          </button>
          <Button type="button" variant="primary" size="sm" onClick={() => setOpen(false)}>
            Pronto
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
