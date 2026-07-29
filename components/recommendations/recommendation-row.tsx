import Link from "next/link";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { RecommendationSection } from "@/lib/recommendations/sections";

/** One horizontal shelf of the redesigned /recommendations page — title + optional description + Carousel + "Ver mais". */
export function RecommendationRow({ section, priority = false }: { section: RecommendationSection; priority?: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title">{section.title}</h2>
          {section.description ? <p className="section-copy">{section.description}</p> : null}
        </div>
        <Link href={section.href} className="link-accent flex shrink-0 items-center gap-1 text-sm">
          Ver mais
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      </div>

      <Carousel>
        {section.items.map((series, index) => (
          <CarouselItem key={series.id}>
            <SeriesPosterCard series={series} priority={priority && index < 4} />
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}
