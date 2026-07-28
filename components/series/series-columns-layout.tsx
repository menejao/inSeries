"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ColumnHeightContext = createContext<number | undefined>(undefined);

/** Consumed by `SeasonSelector` to cap the episode list to the left column's height. */
export function useMatchedColumnHeight() {
  return useContext(ColumnHeightContext);
}

/**
 * Mede a altura da coluna esquerda (Resumo/Producao/Proximo lancamento/Sua jornada) e
 * disponibiliza esse valor via contexto pra coluna direita (Temporadas) — usado pelo
 * `SeasonSelector` pra limitar a lista de episodios a essa mesma altura, com scroll interno,
 * em vez de a pagina crescer indefinidamente sempre que a temporada tiver mais episodios do
 * que a coluna esquerda tem conteudo.
 */
export function SeriesColumnsLayout({ left, right }: { left: ReactNode; right: ReactNode }) {
  const leftRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = leftRef.current;
    if (!el) return;

    // So limita a altura no breakpoint `lg` (onde as 2 colunas ficam lado a lado) — em telas
    // menores as colunas empilham e a altura da esquerda nao tem relacao com a direita.
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => setHeight(mediaQuery.matches ? el.offsetHeight : undefined);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    mediaQuery.addEventListener("change", update);
    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
      <div ref={leftRef} className="space-y-6">
        {left}
      </div>
      <ColumnHeightContext.Provider value={height}>
        <div className="space-y-4">{right}</div>
      </ColumnHeightContext.Provider>
    </section>
  );
}
