import { EmptyState } from "@/components/ui/empty-state";
import { SeriesCard } from "@/components/series/series-card";
import { Tabs } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { getCatalogSeriesBySlug } from "@/lib/catalog/repository";
import type { Series } from "@/lib/types";

const tabs = [
  { href: "/me", label: "Resumo" },
  { href: "/me/watching", label: "Assistindo" },
  { href: "/me/completed", label: "Concluidas" },
  { href: "/me/watchlist", label: "Watchlist" },
  { href: "/me/lists", label: "Listas" }
];

export default async function WatchingPage() {
  const user = await requireUser();
  const statuses = await prisma.userSeriesStatus.findMany({
    where: { userId: user.id, state: "WATCHING" },
    include: { series: true }
  });
  const series = (await Promise.all(statuses.map((item) => getCatalogSeriesBySlug(item.series.slug)))).filter(
    (item): item is Series => Boolean(item)
  );

  return (
    <div className="space-y-6">
      <h1 className="section-title">Assistindo</h1>
      <Tabs items={tabs} active="/me/watching" />
      <div className="grid gap-4 lg:grid-cols-2">
        {series.length ? series.map((item) => <SeriesCard key={item.id} series={item} />) : <EmptyState title="Nenhuma serie assistindo" copy="Atualize status de uma serie para ve-la aqui." />}
      </div>
    </div>
  );
}
