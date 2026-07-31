/**
 * INSERIES-SOCIAL-CONTENT-ENGINE-02 — pt-BR dictionary. All user-facing template strings
 * (hooks, CTA text, format labels, poll question templates, caption connector words) live
 * here instead of scattered inline in content-engine logic, so a future language can be added
 * by adding a sibling dictionary file (see `i18n/index.ts`) without touching engine code.
 */
export const ptBR = {
  formatLabels: {
    "series-of-the-day": "Serie do dia",
    "similar-series": "Se voce gostou disso, vai gostar disso",
    trending: "Em alta no inSeries",
    "weekly-premieres": "Estreias da semana",
    ranking: "Ranking inSeries",
    poll: "Enquete",
    "themed-list": "Lista tematica",
    "inseries-feature": "Recurso do inSeries"
  } as Record<string, string>,

  hooks: [
    { id: "hook-curiosity", category: "curiosidade", text: "Voce sabia disso sobre {title}?" },
    { id: "hook-question", category: "pergunta", text: "Ja assistiu {title}? Conta pra gente!" },
    { id: "hook-superlative", category: "superlativo", text: "Uma das series mais comentadas do momento: {title}." },
    { id: "hook-recommendation", category: "recomendacao", text: "Se voce curtiu {title}, separamos mais indicacoes pra voce." },
    { id: "hook-discovery", category: "descoberta", text: "Descubra {title} antes de todo mundo comentar." },
    { id: "hook-community", category: "comunidade", text: "A comunidade inSeries esta falando sobre {title}." }
  ],

  ctas: [
    { id: "cta-profile", category: "perfil", text: "Adicione {title} na sua lista — link na bio." },
    { id: "cta-explore", category: "explorar", text: "Explore o catalogo completo — link na bio." },
    { id: "cta-rate", category: "avaliar", text: "Avalie {title} no app — link na bio." },
    { id: "cta-comment", category: "comentario", text: "Deixe seu comentario e confira mais no app — link na bio." },
    { id: "cta-discover", category: "descoberta", text: "Encontre sua proxima serie favorita — link na bio." }
  ],

  captionConnectors: {
    question: "E ai, o que voce acha?",
    invite: "Comenta aqui embaixo!",
    join: "Continue a conversa no app.",
    watchProviders: "Disponivel em: {providers}."
  },

  pollQuestions: [
    "Qual dessas series voce ja assistiu: {options}?",
    "Vote na proxima serie que voce quer ver em destaque: {options}.",
    "Qual dessas voce recomendaria pra um amigo: {options}?"
  ],

  themedLists: {
    "top-genero-drama": { label: "Dramas imperdiveis", genres: ["Drama"] },
    "top-genero-comedia": { label: "Comedias pra maratonar", genres: ["Comedy", "Comedia"] },
    "top-genero-crime": { label: "Series de crime e misterio", genres: ["Crime", "Mystery"] },
    "top-genero-ficcao": { label: "Ficcao cientifica que vale o hype", genres: ["Sci-Fi & Fantasy", "Science Fiction"] },
    "series-premiadas": { label: "Series aclamadas pela critica", keywords: ["award winning", "critically acclaimed"] }
  } as Record<string, { label: string; genres?: string[]; keywords?: string[] }>,

  inseriesFeatures: [
    {
      id: "feature-lists",
      title: "Crie suas listas",
      description: "Monte listas personalizadas com as series que voce quer assistir ou ja assistiu."
    },
    {
      id: "feature-reviews",
      title: "Avalie e comente",
      description: "Compartilhe sua opiniao com reviews e notas para cada serie."
    },
    {
      id: "feature-progress",
      title: "Acompanhe seu progresso",
      description: "Marque episodios assistidos e nunca perca o fio da meada."
    },
    {
      id: "feature-recommendations",
      title: "Recomendacoes personalizadas",
      description: "Descubra series com base no que voce ja assistiu e avaliou."
    },
    {
      id: "feature-follow",
      title: "Siga outros usuarios",
      description: "Veja o que seus amigos estao assistindo e trocar recomendacoes."
    }
  ],

  bannedWords: {
    spoilers: ["morre", "morte de", "final revela", "spoiler:", "termina com", "descobre que e"],
    offensive: ["idiota", "burro", "lixo", "merda"],
    speculative: ["rumor", "dizem que", "boato", "nao confirmado", "vazou que", "fonte anonima"]
  }
} as const;
