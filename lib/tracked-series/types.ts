export type TrackedSeriesState = "disponivel" | "em-andamento" | "proximo-episodio" | "aguardando-temporada" | "concluida";

export type TrackedSeriesSummaryItem = {
  series: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
  };
  state: TrackedSeriesState;
  /** "Estado principal" (Fase 10) — texto pronto pra exibir, ex.: "3 episodios disponiveis". */
  stateLabel: string;
  /** "Contexto resumido" (Fase 10) — segunda linha opcional, ex.: data do proximo episodio. */
  contextLabel: string | null;
  /** Ultima atividade do usuario nesta serie — usado pra ordenar (mais recente primeiro). */
  lastActivityAt: Date | null;
};
