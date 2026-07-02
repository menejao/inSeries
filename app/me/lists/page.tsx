import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListCreateForm } from "@/components/social/list-create-form";
import { requireUser } from "@/lib/auth/server";
import { listUserLists } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

export default async function MyListsPage() {
  const user = await requireUser();
  const lists = await listUserLists(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Minhas listas</h1>
        <p className="section-copy">Crie, edite e organize suas listas de series.</p>
      </div>

      <ListCreateForm />

      <div className="space-y-3">
        {lists.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {lists.map((list) => (
              <Card key={list.id}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/lists/${list.id}`} className="text-lg font-semibold text-ink">
                    {list.title}
                  </Link>
                  <Badge>{list.visibility === "PUBLIC" ? "Publica" : "Privada"}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-300">{list._count.items} series</p>
                <p className="mt-1 text-xs text-slate-400">Atualizada em {formatDate(list.updatedAt)}</p>
                <Link href={`/lists/${list.id}`} className="mt-4 inline-block text-sm font-semibold text-amber-200">
                  Editar / gerenciar
                </Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Nenhuma lista criada" copy="Use o formulario acima para criar sua primeira lista." />
        )}
      </div>
    </div>
  );
}
