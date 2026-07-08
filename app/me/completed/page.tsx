import { redirect } from "next/navigation";

/**
 * INSERIES-MY-LISTS-PREMIUM-01 — esta pagina fragmentada (so o grupo "Concluidas", com um
 * N+1 real de getCatalogSeriesBySlug por serie, auditado na Fase 1) foi substituida pela
 * Minha Lista completa. Redirect em vez de duplicar a query/render aqui.
 */
export default function CompletedPage() {
  redirect("/me/minha-lista#grupo-completed");
}
