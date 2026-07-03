import { EmptyState } from "@/components/ui/empty-state";
import { SeriesCard } from "@/components/series/series-card";
import { MeTabs } from "@/components/me/me-tabs";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import type { Series } from "@/lib/types";

export default async function WatchlistPage() {
  const user = await requireUser();
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId: user.id, state: "WANT_TO_WATCH" },
    include: { series: true }
  });
  const series = (await Promise.all(statuses.map((item) => getCatalogSeriesBySlug(item.series.slug)))).filter(
    (item): item is Series => Boolean(item)
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Watchlist</h1>
      </div>
      <MeTabs active="/me/watchlist" />
      {series.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((item) => (
            <SeriesCard key={item.id} series={item} />
          ))}
        </div>
      ) : (
        <EmptyState title="Watchlist vazia" copy="Use Quero assistir para montar lista." />
      )}
    </div>
  );
}
