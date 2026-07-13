import { redirect } from "next/navigation";

/**
 * Fase 1/6 (INSERIES-DASHBOARD-UX-AND-NAVIGATION-01) — /me era um dashboard
 * duplicado sem nenhum link apontando para ele em toda a aplicacao. O Dashboard
 * (/) e o unico painel de acompanhamento diario; esta rota so existe para
 * nao quebrar bookmarks antigos.
 */
export default function MePage() {
  redirect("/");
}
