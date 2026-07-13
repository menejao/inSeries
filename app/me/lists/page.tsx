import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListCreateForm } from "@/components/social/list-create-form";
import { ChevronLeftIcon, ListIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { listUserLists } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

export default async function MyListsPage() {
  const user = await requireUser();
  const lists = await listUserLists(user.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lists" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeftIcon className="h-4 w-4" /> Listas publicas
        </Link>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Minhas listas</h1>
        <p className="section-copy">Crie, edite e organize suas listas de series.</p>
      </div>

      <ListCreateForm />

      {lists.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`}>
              <Card interactive className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-ink">{list.title}</p>
                  <Badge variant={list.visibility === "PUBLIC" ? "secondary" : "default"}>
                    {list.visibility === "PUBLIC" ? "Publica" : "Privada"}
                  </Badge>
                </div>
                <p className="text-sm text-muted">{list._count.items} serie(s)</p>
                <p className="text-xs text-subtle">Atualizada em {formatDate(list.updatedAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<ListIcon className="h-6 w-6" />} title="Nenhuma lista criada" copy="Use o formulario acima para criar sua primeira lista." />
      )}
    </div>
  );
}
