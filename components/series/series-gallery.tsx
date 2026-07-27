import { Carousel, CarouselItem } from "@/components/media/carousel";
import { PosterImage } from "@/components/media/poster-image";

/** Fase 18 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — backdrops + posters da serie, separados do backdrop/poster unicos ja usados no Hero/card. Cada grupo some se vazio; secao inteira some se ambos vazios. */
export function SeriesGallery({ backdropUrls, posterUrls }: { backdropUrls: string[]; posterUrls: string[] }) {
  if (!backdropUrls.length && !posterUrls.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-ink">Galeria</h2>

      {backdropUrls.length ? (
        <Carousel>
          {backdropUrls.map((url, index) => (
            <CarouselItem key={url} className="w-64 sm:w-80" size="auto">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border">
                <PosterImage src={url} alt={`Backdrop ${index + 1}`} sizes="320px" />
              </div>
            </CarouselItem>
          ))}
        </Carousel>
      ) : null}

      {posterUrls.length ? (
        <Carousel>
          {posterUrls.map((url, index) => (
            <CarouselItem key={url} className="w-28 sm:w-32" size="auto">
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border">
                <PosterImage src={url} alt={`Poster ${index + 1}`} sizes="128px" />
              </div>
            </CarouselItem>
          ))}
        </Carousel>
      ) : null}
    </section>
  );
}
