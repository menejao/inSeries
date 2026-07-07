import Link from "next/link";
import { BackdropImage } from "@/components/media/poster-image";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { Series } from "@/lib/types";

/**
 * Fase 7 (INSERIES-LANDING-CINEMATIC-IMMERSION-01) — a horizontal cinematic banner between
 * carousels ("Série da semana", "Mais comentada", ...), always backed by a real backdrop.
 * Links to an existing discovery filter/route — no new business rule, just a themed
 * entry point into the catalog that already exists.
 */
export function CinematicBanner({ eyebrow, title, href, series }: { eyebrow: string; title: string; href: string; series: Series }) {
  return (
    <Link
      href={href}
      className="group relative -mx-4 block h-[42vh] min-h-[280px] overflow-hidden sm:mx-0 sm:h-[46vh] sm:rounded-4xl"
    >
      <BackdropImage
        src={series.backdropUrl || series.posterUrl}
        alt={series.title}
        sizes="100vw"
        imageClassName="transition duration-700 ease-out group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-2 p-6 sm:p-10 lg:max-w-lg">
        <p className="eyebrow text-ink/80">{eyebrow}</p>
        <h3 className="text-2xl font-black leading-tight text-ink sm:text-3xl">{title}</h3>
        <p className="line-clamp-1 text-sm text-ink/80">
          {series.title}
          {series.year ? ` · ${series.year}` : ""}
        </p>
        <span className="link-accent mt-1 inline-flex items-center gap-1 text-sm">
          Explorar <ChevronRightIcon className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
