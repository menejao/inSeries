import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { ListCreateForm } from "@/components/social/list-create-form";
import { ListIcon } from "@/components/ui/icons";
import { getCurrentUser, requireUser } from "@/lib/auth/server";
import { listPublicLists, listUserLists } from "@/lib/social/lists";
import { formatDate } from "@/lib/utils";

type ListsSearchParams = { view?: string };

/**
 * Fase 2 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "/lists" (publicas) e "/me/lists"
 * (proprias) unificados: mesmo grid/card, so mudava o escopo do dado (auditoria, achado #4).
 * "Minhas listas" (`?view=minhas`) reusa a mesma logica de auth de antes (`requireUser`,
 * redireciona pra /login) — nao vira uma pagina nova, so uma aba desta.
 */
export default async function ListsPage({ searchParams }: { searchParams: Promise<ListsSearchParams> }) {
  const params = await searchParams;
  const view = params.view === "minhas" ? "minhas" : "publicas";

  const tabs = (
    <Tabs
      label="Visualizacao de listas"
      items={[
        { href: "/lists", label: "Descobrir" },
        { href: "/lists?view=minhas", label: "Minhas listas" }
      ]}
      active={view === "minhas" ? "/lists?view=minhas" : "/lists"}
    />
  );

  if (view === "minhas") {
    const user = await requireUser();
    const lists = await listUserLists(user.id);

    return (
      <div className="space-y-6">
        <div>
          <p className="eyebrow">Cards</p>
          <h1 className="section-title">Minhas listas</h1>
          <p className="section-copy">Crie, edite e organize suas listas de series.</p>
        </div>

        {tabs}

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

  const [lists, viewer] = await Promise.all([listPublicLists(), getCurrentUser()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Cards</p>
          <h1 className="section-title">Listas</h1>
          <p className="section-copy">Descubra listas publicas criadas pela comunidade inSeries.</p>
        </div>
        <Link href={viewer ? "/lists?view=minhas" : "/login"} className={buttonVariants()}>
          Criar lista
        </Link>
      </div>

      {tabs}

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
