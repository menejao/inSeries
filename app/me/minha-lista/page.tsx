import { MyListHeader } from "@/components/my-list/my-list-header";
import { MyListPageClient } from "@/components/my-list/my-list-page-client";
import { requireUser } from "@/lib/auth/server";
import { getMyListFullForUser } from "@/lib/my-list";
import { listUserLists } from "@/lib/social/lists";
import { getWatchNextForUser } from "@/lib/watch-next/queries";

/**
 * INSERIES-MY-LIST-REDESIGN-01 — "a pagina deve transmitir a sensacao de uma biblioteca
 * pessoal de series, e nao de um painel administrativo": Hero reduzido a titulo+subtitulo
 * (MyListHeader), estatisticas do topo removidas por completo. `watchNext` alimenta o
 * destaque de progresso/proximo episodio da secao Assistindo (unica secao que precisa disso)
 * sem uma query extra por card — mesma fonte que o Dashboard usa (lib/watch-next/queries.ts).
 */
export default async function MinhaListaPage() {
  const user = await requireUser();

  const [fullList, lists, watchNext] = await Promise.all([
    getMyListFullForUser(user.id),
    listUserLists(user.id),
    getWatchNextForUser(user.id)
  ]);

  const watchNextBySeriesId = new Map(watchNext.items.map((item) => [item.series.id, item]));

  return (
    <div className="space-y-6">
      <MyListHeader />
      <MyListPageClient
        items={fullList.items}
        lists={lists.map((list) => ({ id: list.id, title: list.title }))}
        watchNextBySeriesId={Object.fromEntries(watchNextBySeriesId)}
      />
    </div>
  );
}
