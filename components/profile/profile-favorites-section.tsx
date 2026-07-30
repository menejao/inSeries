import Link from "next/link";
import { PosterImage } from "@/components/media/poster-image";

type FavoriteSeries = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
};

export function ProfileFavoritesSection({ favorites }: { favorites: FavoriteSeries[] }) {
  if (!favorites.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="section-title">Favoritas</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {favorites.map((series) => (
          <Link key={series.id} href={`/series/${series.slug}`} className="group block">
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-border transition group-hover:border-border-strong group-hover:shadow-raised">
              <PosterImage src={series.posterUrl} alt={series.title} sizes="(min-width: 640px) 80px, 33vw" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
