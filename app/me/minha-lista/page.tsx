import { MyListHeader } from "@/components/my-list/my-list-header";
import { MyListPageClient } from "@/components/my-list/my-list-page-client";
import { requireUser } from "@/lib/auth/server";
import { getMyListFullForUser } from "@/lib/my-list";
import { listUserLists } from "@/lib/social/lists";

/**
 * INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01 — "a pagina deve deixar de funcionar como
 * Dashboard. Seu unico objetivo passa a ser: organizar a biblioteca." Estatisticas
 * completas (Fase 12, `MyListStatsSection`) e recomendacoes (Fase 13, `MyListDiscoverySection`)
 * removidas por completo desta pagina - pertencem exclusivamente as paginas
 * Estatisticas/Recomendacoes. Documentado em detalhe em
 * docs/dashboard-and-my-list-experience-01.md.
 */
export default async function MinhaListaPage() {
  const user = await requireUser();

  const [fullList, lists] = await Promise.all([getMyListFullForUser(user.id), listUserLists(user.id)]);

  return (
    <div className="space-y-8">
      <MyListHeader items={fullList.items} />
      <MyListPageClient items={fullList.items} lists={lists.map((list) => ({ id: list.id, title: list.title }))} />
    </div>
  );
}
