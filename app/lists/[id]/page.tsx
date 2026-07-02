import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListDeleteButton } from "@/components/social/list-delete-button";
import { ListEditForm } from "@/components/social/list-edit-form";
import { ListItemManager } from "@/components/social/list-item-manager";
import { getCurrentUser } from "@/lib/auth/server";
import { listCatalogSeries } from "@/lib/catalog/repository";
import { getListWithItems } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

export default async function ListDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await getListWithItems(id);

  if (!list) {
    notFound();
  }

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === list.userId;

  if ((list.visibility !== "PUBLIC" || list.hiddenByAdminAt) && !isOwner) {
    notFound();
  }

  const catalogSeries = isOwner ? await listCatalogSeries() : [];

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lista</p>
            <h1 className="section-title">{list.title}</h1>
          </div>
          <Badge>{list.visibility === "PUBLIC" ? "Publica" : "Privada"}</Badge>
        </div>
        {list.description ? <p className="section-copy">{list.description}</p> : null}
        <p className="text-xs text-slate-400">
          por{" "}
          <Link href={`/profile/${list.user.username}`} className="font-semibold text-amber-200">
            @{list.user.username}
          </Link>{" "}
          · {formatDate(list.createdAt)}
        </p>
      </Card>

      {isOwner ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-ink">Editar lista</h2>
            <div className="mt-4">
              <ListEditForm
                listId={list.id}
                initialTitle={list.title}
                initialDescription={list.description ?? ""}
                initialVisibility={list.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC"}
              />
            </div>
          </Card>
          <Card className="flex flex-col justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Excluir lista</h2>
              <p className="mt-2 text-sm text-slate-300">Essa acao remove a lista e todos os itens permanentemente.</p>
            </div>
            <ListDeleteButton listId={list.id} redirectTo="/me/lists" />
          </Card>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-ink">Series</h2>
        {isOwner ? (
          <ListItemManager
            listId={list.id}
            items={list.items.map((item) => ({ id: item.id, seriesId: item.seriesId, title: item.series.title }))}
            seriesOptions={catalogSeries.map((series) => ({ id: series.id, title: series.title }))}
          />
        ) : list.items.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {list.items.map((item) => (
              <Card key={item.id}>
                <Link href={`/series/${item.series.slug}`} className="font-semibold text-ink">
                  {item.series.title}
                </Link>
                {item.note ? <p className="mt-1 text-sm text-slate-300">{item.note}</p> : null}
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Lista vazia" copy="Nenhuma serie foi adicionada a esta lista ainda." />
        )}
      </section>
    </div>
  );
}
