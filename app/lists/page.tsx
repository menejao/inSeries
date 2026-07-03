import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ListIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth/server";
import { listPublicLists } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

export default async function ListsPage() {
  const [lists, viewer] = await Promise.all([listPublicLists(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Cards</p>
          <h1 className="section-title">Listas</h1>
          <p className="section-copy">Descubra listas publicas criadas pela comunidade inSeries.</p>
        </div>
        <Link href={viewer ? "/me/lists" : "/login"} className={buttonVariants()}>
          Criar lista
        </Link>
      </div>
      {lists.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {lists.map((list) => (
            <Link key={list.id} href={`/lists/${list.id}`}>
              <Card interactive className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-lg font-semibold text-ink">{list.title}</p>
                  <Badge>{list._count.items} series</Badge>
                </div>
                {list.description ? <p className="line-clamp-2 text-sm text-muted">{list.description}</p> : null}
                <p className="text-xs text-subtle">
                  por <span className="font-semibold text-ink">@{list.user.username}</span> · {formatDate(list.createdAt)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListIcon className="h-6 w-6" />}
          title="Nenhuma lista publica ainda"
          copy="Seja o primeiro a criar uma lista publica de series."
        />
      )}
    </div>
  );
}
