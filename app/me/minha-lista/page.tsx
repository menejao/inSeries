import { MyListHeader } from "@/components/my-list/my-list-header";
import { MyListStatsSection } from "@/components/my-list/my-list-stats-section";
import { MyListPageClient } from "@/components/my-list/my-list-page-client";
import { MyListDiscoverySection } from "@/components/my-list/my-list-discovery-section";
import { MeTabs } from "@/components/me/me-tabs";
import { requireUser } from "@/lib/auth/server";
import { getUserStats } from "@/lib/analytics";
import { getMyListFullForUser } from "@/lib/my-list";
import { getMyListDiscovery } from "@/lib/my-list/recommendations";
import { listUserLists } from "@/lib/social/lists";

/**
 * INSERIES-MY-LISTS-PREMIUM-01 — a Minha Lista completa: o centro de organizacao pessoal
 * do usuario. Substitui as 3 paginas fragmentadas (/me/watching, /me/watchlist,
 * /me/completed — nenhuma cobria Pausadas/Abandonadas/Favoritas) por uma unica pagina com
 * 6 grupos, busca, filtros, ordenacao, acoes em lote, estatisticas e recomendacoes — tudo
 * reaproveitando servicos existentes (ver README para o audit completo da Fase 1).
 */
export default async function MinhaListaPage() {
  const user = await requireUser();

  const [stats, fullList, lists] = await Promise.all([getUserStats(user.id), getMyListFullForUser(user.id), listUserLists(user.id)]);

  const discovery = await getMyListDiscovery(user.id, fullList.items);

  return (
    <div className="space-y-8">
      <MeTabs active="/me/minha-lista" />
      <MyListHeader stats={stats} />
      <MyListPageClient items={fullList.items} lists={lists.map((list) => ({ id: list.id, title: list.title }))} />
      <MyListStatsSection stats={stats} />
      <MyListDiscoverySection discovery={discovery} />
    </div>
  );
}
