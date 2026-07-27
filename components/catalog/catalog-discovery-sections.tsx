import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesCard } from "@/components/series/series-card";
import type { CatalogDiscoverySections } from "@/lib/catalog/discovery-sections";

const SECTIONS: Array<{ key: keyof CatalogDiscoverySections; title: string }> = [
  { key: "trending", title: "Em alta" },
  { key: "popular", title: "Mais populares" },
  { key: "latest", title: "Lancamentos" },
  { key: "topRated", title: "Melhor avaliadas" }
];

/** Fase 9 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — so aparecem sem busca/filtro ativo (ver app/series/page.tsx); cada uma some se nao houver dados. */
export function CatalogDiscoverySections({ sections }: { sections: CatalogDiscoverySections }) {
  const visible = SECTIONS.filter((section) => sections[section.key].length);
  if (!visible.length) return null;

  return (
    <div className="space-y-8">
      {visible.map((section) => (
        <div key={section.key} className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{section.title}</h2>
          <Carousel>
            {sections[section.key].map((series) => (
              <CarouselItem key={series.id} size="large">
                <SeriesCard series={series} />
              </CarouselItem>
            ))}
          </Carousel>
        </div>
      ))}
    </div>
  );
}
