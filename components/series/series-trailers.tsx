import { Carousel, CarouselItem } from "@/components/media/carousel";
import { PlayIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import type { NormalizedVideo } from "@/lib/catalog/normalize";

const TYPE_LABELS: Record<string, string> = {
  Trailer: "Trailer",
  Teaser: "Teaser",
  Clip: "Clipe",
  Featurette: "Featurette"
};

/** Fase 19 (INSERIES-CATALOG-SERIES-EXPERIENCE-01) — trailer/teaser/clipe/featurette, abrindo no YouTube (sem embed, evita problemas de CSP/autoplay). Some se a serie nao tiver videos sincronizados. */
export function SeriesTrailers({ videos }: { videos: NormalizedVideo[] }) {
  if (!videos.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink">Trailers</h2>
      <Carousel>
        {videos.map((video) => (
          <CarouselItem key={video.key} className="w-56 sm:w-64" size="auto">
            <a
              href={`https://www.youtube.com/watch?v=${video.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block space-y-2"
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-surface-strong">
                {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube thumbnail, not part of the Next Image-optimized catalog media pipeline */}
                <img
                  src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
                  alt={video.name}
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-canvas/30 opacity-0 transition group-hover:opacity-100">
                  <PlayIcon className="h-8 w-8 text-ink" />
                </div>
                <div className="absolute left-2 top-2">
                  <Badge variant="outline">{TYPE_LABELS[video.type] ?? video.type}</Badge>
                </div>
              </div>
              <p className="line-clamp-1 text-sm font-medium text-ink">{video.name}</p>
            </a>
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}
