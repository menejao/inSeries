import { redirect } from "next/navigation";

/**
 * INSERIES-MY-LISTS-PREMIUM-01 — esta pagina fragmentada (so o grupo "Quero assistir", sem
 * busca/filtros/ordenacao/acoes em lote) foi substituida pela Minha Lista completa. Redirect
 * em vez de duplicar a query/render aqui — nenhum bookmark quebra.
 */
export default function WatchlistPage() {
  redirect("/me/minha-lista#grupo-want_to_watch");
}
