import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";

export default async function AdminCatalogPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdminUser("admin.catalog");
  const { q } = await searchParams;

  const series = await prisma.series.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { originalTitle: { contains: q, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: [{ popularityScore: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: { _count: { select: { seasons: true } } }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Catalogo</h1>
      </div>

      <Card>
        <form className="flex gap-2" method="get">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por titulo..."
            className="min-h-11 flex-1 rounded-full border border-slate-600 bg-slate-900/70 px-4 text-sm text-ink"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-ember px-4 text-sm font-semibold text-night"
          >
            Buscar
          </button>
        </form>
      </Card>

      {series.length === 0 ? (
        <EmptyState title="Nenhuma serie encontrada" copy="Ajuste a busca ou sincronize o catalogo." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Titulo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ano</th>
                <th className="px-3 py-2">Temporadas</th>
                <th className="px-3 py-2">Popularidade</th>
                <th className="px-3 py-2">Nota TMDb</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {series.map((item) => (
                <tr key={item.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium text-ink">{item.title}</td>
                  <td className="px-3 py-2">
                    <Badge>{item.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{item.firstAirYear ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{item._count.seasons}</td>
                  <td className="px-3 py-2 text-slate-300">{item.popularityScore?.toFixed(1) ?? "-"}</td>
                  <td className="px-3 py-2 text-slate-300">{item.voteAverage?.toFixed(1) ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/catalog/${item.id}`} className="font-semibold text-amber-200">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
