import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/server";
import { listPublicLists } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

export default async function ListsPage() {
  const [lists, viewer] = await Promise.all([listPublicLists(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="section-title">Listas</h1>
          <p className="section-copy">Descubra listas publicas criadas pela comunidade inSeries.</p>
        </div>
        <Link
          href={viewer ? "/me/lists" : "/login"}
          className="min-h-11 rounded-full bg-ember px-4 py-2 text-sm font-semibold text-night"
        >
          Criar lista
        </Link>
      </div>
      {lists.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((list) => (
            <Card key={list.id}>
              <div className="flex items-center justify-between gap-2">
                <Link href={`/lists/${list.id}`} className="text-xl font-semibold text-ink">
                  {list.title}
                </Link>
                <Badge>{list._count.items} series</Badge>
              </div>
              {list.description ? <p className="mt-2 text-sm text-slate-300">{list.description}</p> : null}
              <p className="mt-3 text-xs text-slate-400">
                por{" "}
                <Link href={`/profile/${list.user.username}`} className="font-semibold text-amber-200">
                  @{list.user.username}
                </Link>{" "}
                · {formatDate(list.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma lista publica ainda" copy="Seja o primeiro a criar uma lista publica de series." />
      )}
    </div>
  );
}
