import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getStatusBadgeVariant, getStatusLabel } from "@/lib/catalog/status-labels";
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
      <Link href="/admin/catalog" className="inline-flex items-center gap-1 text-sm font-medium text-muted transition hover:text-ink">
        <ChevronLeftIcon className="h-4 w-4" />
        Catalogo
      </Link>
      <div>
        <p className="eyebrow">Admin / Catalogo</p>
        <h1 className="section-title">{series.title}</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getStatusBadgeVariant(series.status)}>{getStatusLabel(series.status)}</Badge>
          <span className="text-sm text-muted">Ano: {series.firstAirYear ?? "-"}</span>
          <span className="text-sm text-muted">Popularidade: {series.popularityScore?.toFixed(1) ?? "-"}</span>
          <span className="text-sm text-muted">
            Nota TMDb: {series.voteAverage?.toFixed(1) ?? "-"} ({series.voteCount ?? 0} votos)
          </span>
        </div>
        <p className="text-sm text-muted">{series.overview}</p>
        <p className="text-xs text-subtle">
          Id interno: {series.id} · Slug: {series.slug} · Criado em {formatDate(series.createdAt)} · Atualizado em {formatDate(series.updatedAt)}
        </p>
      </Card>

      <Card padding={series.externalMappings.length ? "none" : "md"}>
        {series.externalMappings.length === 0 ? (
          <>
            <h2 className="p-5 pb-0 text-lg font-semibold text-ink">Mapeamentos externos</h2>
            <p className="p-5 pt-2 text-sm text-muted">Nenhum mapeamento externo registrado.</p>
          </>
        ) : (
          <>
            <h2 className="p-5 pb-0 text-lg font-semibold text-ink">Mapeamentos externos</h2>
            <TableContainer>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Fonte</Th>
                    <Th>Tipo</Th>
                    <Th>Id externo</Th>
                    <Th>Ultimo sync</Th>
                  </tr>
                </TableHead>
                <TableBody>
                  {series.externalMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <Td>{mapping.source}</Td>
                      <Td>{mapping.entityType}</Td>
                      <Td>{mapping.externalId}</Td>
                      <Td>{mapping.lastSyncedAt ? formatDate(mapping.lastSyncedAt) : "-"}</Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Temporadas e episodios</h2>
        {series.seasons.map((season) => (
          <div key={season.id}>
            <p className="text-sm font-semibold text-ink">
              {season.title} ({season.episodes.length} episodios)
            </p>
            <ul className="mt-1 space-y-1 text-xs text-subtle">
              {season.episodes.map((episode) => (
                <li key={episode.id}>
                  E{episode.number} · {episode.title} · {episode.airedAt ? formatDate(episode.airedAt) : "sem data"}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
