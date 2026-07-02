import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminCatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser("admin.catalog");
  const { id } = await params;

  const series = await prisma.series.findUnique({
    where: { id },
    include: {
      seasons: { orderBy: { number: "asc" }, include: { episodes: { orderBy: { number: "asc" } } } },
      externalMappings: true
    }
  });

  if (!series) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin / Catalogo</p>
        <h1 className="section-title">{series.title}</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{series.status}</Badge>
          <span className="text-sm text-slate-300">Ano: {series.firstAirYear ?? "-"}</span>
          <span className="text-sm text-slate-300">Popularidade: {series.popularityScore?.toFixed(1) ?? "-"}</span>
          <span className="text-sm text-slate-300">Nota TMDb: {series.voteAverage?.toFixed(1) ?? "-"} ({series.voteCount ?? 0} votos)</span>
        </div>
        <p className="text-sm text-slate-300">{series.overview}</p>
        <p className="text-xs text-slate-400">
          Id interno: {series.id} · Slug: {series.slug} · Criado em {formatDate(series.createdAt)} · Atualizado em {formatDate(series.updatedAt)}
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Mapeamentos externos</h2>
        {series.externalMappings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-300">Nenhum mapeamento externo registrado.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Fonte</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Id externo</th>
                <th className="px-3 py-2">Ultimo sync</th>
              </tr>
            </thead>
            <tbody>
              {series.externalMappings.map((mapping) => (
                <tr key={mapping.id} className="border-t border-white/5">
                  <td className="px-3 py-2">{mapping.source}</td>
                  <td className="px-3 py-2">{mapping.entityType}</td>
                  <td className="px-3 py-2">{mapping.externalId}</td>
                  <td className="px-3 py-2">{mapping.lastSyncedAt ? formatDate(mapping.lastSyncedAt) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-ink">Temporadas e episodios</h2>
        <div className="mt-3 space-y-4">
          {series.seasons.map((season) => (
            <div key={season.id}>
              <p className="text-sm font-semibold text-ink">
                {season.title} ({season.episodes.length} episodios)
              </p>
              <ul className="mt-1 space-y-1 text-xs text-slate-400">
                {season.episodes.map((episode) => (
                  <li key={episode.id}>
                    E{episode.number} · {episode.title} · {episode.airedAt ? formatDate(episode.airedAt) : "sem data"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
