"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchBar } from "@/components/ui/search-bar";

/**
 * Fase 3 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — busca e o elemento principal da pagina:
 * digitar atualiza a URL (?q=) com debounce, sem precisar de botao "Buscar". `page` e sempre
 * resetado (uma nova busca sempre comeca na primeira pagina de resultados).
 */
export function CatalogSearchBar({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue ?? "");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  function handleChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    }, 350);
  }

  return (
    <SearchBar
      name="q"
      id="catalog-search"
      label="Buscar por titulo ou sinopse"
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      placeholder="Buscar series por titulo ou sinopse..."
      className="text-base"
    />
  );
}
