import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ModerationButton } from "@/components/admin/moderation-button";
import { requireAdminUser } from "@/lib/admin/rbac";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export default async function AdminReviewsPage() {
  await requireAdminUser("admin.reviews");

  const reviews = await prisma.review.findMany({
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      user: { select: { username: true, name: true } },
      series: { select: { title: true } }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin</p>
        <h1 className="section-title">Reviews</h1>
      </div>

      {reviews.length === 0 ? (
        <EmptyState title="Nenhuma review encontrada" copy="Ainda nao ha reviews cadastradas." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Autor</th>
                <th className="px-3 py-2">Serie</th>
                <th className="px-3 py-2">Nota</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Visibilidade</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-t border-white/5">
                  <td className="px-3 py-2 text-slate-300">@{review.user.username}</td>
                  <td className="px-3 py-2 text-slate-300">{review.series.title}</td>
                  <td className="px-3 py-2 text-slate-300">{review.rating}/10</td>
                  <td className="px-3 py-2 text-slate-300">{formatDate(review.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <Badge>{review.visibility}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {review.hiddenByAdminAt ? <Badge>Oculta pelo admin</Badge> : <span className="text-slate-400">Visivel</span>}
                  </td>
                  <td className="px-3 py-2">
                    {review.hiddenByAdminAt ? (
                      <ModerationButton
                        action="restore"
                        endpoint={`/api/admin/reviews/${review.id}/restore`}
                        confirmMessage="Restaurar esta review?"
                      />
                    ) : (
                      <ModerationButton
                        action="hide"
                        endpoint={`/api/admin/reviews/${review.id}/hide`}
                        confirmMessage="Ocultar esta review? Ela deixara de aparecer publicamente."
                      />
                    )}
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
