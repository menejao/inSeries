import Link from "next/link";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { ContinueWatchingCard } from "@/components/continue-watching/continue-watching-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CompassIcon, PlayIcon } from "@/components/ui/icons";
import type { ContinueWatchingResult } from "@/lib/continue-watching";

/**
 * Fase 4 (INSERIES-CONTINUE-WATCHING-EXPERIENCE-01) — the Dashboard's first area. Purely
 * presentational (data comes from the caller's own `getContinueWatchingForUser` call, run
 * alongside every other Dashboard fetch in the same `Promise.all` — Fase 9: no nested
 * async component here, so this section never becomes its own sequential waterfall).
 *
 * Reuses the existing `Carousel`/`CarouselItem` shelf
 * (INSERIES-LANDING-CINEMATIC-IMMERSION-01) so the layout is a horizontal row with visible
 * arrow buttons on desktop and a native touch scroll-snap carousel on mobile — Fase 8's
 * "layout horizontal no desktop" and "carrossel ou stack no mobile" from the exact same
 * component, no new layout mechanism.
 */
export function ContinueWatchingSection({ continueWatching }: { continueWatching: ContinueWatchingResult }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="section-title">Continuar assistindo</h2>
        <p className="section-copy">Retome suas series exatamente de onde parou.</p>
      </div>

      {continueWatching.items.length ? (
        <Carousel>
          {continueWatching.items.map((item, index) => (
            <CarouselItem key={item.episode.id} size="auto">
              <ContinueWatchingCard item={item} priority={index < 2} />
            </CarouselItem>
          ))}
        </Carousel>
      ) : (
        <EmptyState
          icon={<PlayIcon className="h-6 w-6" />}
          title={continueWatching.hasTrackedSeries ? "Voce esta em dia com suas series" : "Voce ainda nao comecou nenhuma serie"}
          copy={
            continueWatching.hasTrackedSeries
              ? "Nao ha episodios pendentes agora. Quando um novo episodio for lancado, ele aparece aqui."
              : "Explore o catalogo e comece a acompanhar uma serie para ver seu progresso aqui."
          }
          action={
            <Link href="/series" className={buttonVariants({ variant: "primary" })}>
              <CompassIcon className="h-4 w-4" />
              Explorar catalogo
            </Link>
          }
        />
      )}
    </section>
  );
}
