import { Carousel, CarouselItem } from "@/components/media/carousel";
import { PosterImage } from "@/components/media/poster-image";
import type { NormalizedCastMember } from "@/lib/catalog/normalize";

/** Fase 17 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — elenco em carrossel: foto, nome, personagem. Some inteiro se a serie nao tiver elenco sincronizado. */
export function CastCarousel({ cast }: { cast: NormalizedCastMember[] }) {
  if (!cast.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Elenco</h2>
      <Carousel>
        {cast.map((member) => (
          <CarouselItem key={member.id} className="w-28 sm:w-32">
            <div className="space-y-2">
              <div className="relative aspect-square overflow-hidden rounded-full border border-border">
                <PosterImage src={member.profileUrl} alt={member.name} sizes="128px" />
              </div>
              <div className="text-center">
                <p className="line-clamp-1 text-sm font-semibold text-ink">{member.name}</p>
                {member.character ? <p className="line-clamp-1 text-xs text-muted">{member.character}</p> : null}
              </div>
            </div>
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}
