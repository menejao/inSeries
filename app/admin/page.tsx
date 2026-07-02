import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

async function getDashboardStats() {
  const [
    userCount,
    seriesCount,
    seasonCount,
    episodeCount,
    reviewCount,
    listCount,
    followCount,
    activityCount,
    lastSyncRun
  ] = await Promise.all([
    prisma.user.count(),
    prisma.series.count(),
    prisma.season.count(),
    prisma.episode.count(),
    prisma.review.count(),
    prisma.list.count(),
    prisma.follow.count(),
    prisma.activity.count(),
    prisma.catalogSyncRun.findFirst({ orderBy: { startedAt: "desc" } })
  ]);

  return {
    userCount,
    seriesCount,
    seasonCount,
    episodeCount,
    reviewCount,
    listCount,
    followCount,
    activityCount,
    lastSyncRun
  };
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminUser("admin.read");
  const stats = await getDashboardStats();

  const durationMs = stats.lastSyncRun?.finishedAt
    ? stats.lastSyncRun.finishedAt.getTime() - stats.lastSyncRun.startedAt.getTime()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Usuarios" value={stats.userCount} />
        <StatCard label="Series" value={stats.seriesCount} />
        <StatCard label="Temporadas" value={stats.seasonCount} />
        <StatCard label="Episodios" value={stats.episodeCount} />
        <StatCard label="Reviews" value={stats.reviewCount} />
        <StatCard label="Listas" value={stats.listCount} />
        <StatCard label="Follows" value={stats.followCount} />
        <StatCard label="Atividades" value={stats.activityCount} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Ultima sincronizacao</h2>
        {stats.lastSyncRun ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <Badge>{stats.lastSyncRun.status}</Badge>
            <span>{stats.lastSyncRun.type}</span>
            <span>{formatDate(stats.lastSyncRun.startedAt)}</span>
            <span>{durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : "em andamento"}</span>
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState title="Nenhuma sincronizacao ainda" copy="Nenhum sync do catalogo foi executado." />
          </div>
        )}
      </Card>
    </div>
  );
}
