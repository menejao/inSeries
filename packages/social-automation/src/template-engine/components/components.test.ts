import { describe, expect, it } from "vitest";
import {
  Badge,
  CTA,
  GenreChips,
  Platform,
  Poster,
  Progress,
  Rating,
  RankingItem,
  SeriesCard,
  Subtitle,
  Title
} from "./index";
import { buildAltText, escapeHtml, formatRating, synopsisOrPlaceholder, truncate } from "../utils";
import { series, theBear } from "../sandbox/fixtures";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — componentes e utils.
 * O foco e o comportamento com DADOS FALTANDO: poster, nota, plataforma e sinopse sao colunas
 * nullable no banco, entao o placeholder elegante e uma regra do ticket, nao um detalhe.
 */
describe("placeholders quando faltam dados", () => {
  it("Poster sem src renderiza placeholder deterministico com as iniciais", () => {
    const first = Poster({ title: "Breaking Bad" });
    const second = Poster({ title: "Breaking Bad" });

    expect(first).toBe(second); // deterministico: mesmo titulo => mesmas cores
    expect(first).toContain("is-poster--placeholder");
    expect(first).toContain(">BB<");
    expect(first).not.toContain("<img");
  });

  it("Poster com src usa a imagem e nao o placeholder", () => {
    const html = Poster({ title: "Dark", src: "https://image.tmdb.org/x.jpg" });
    expect(html).toContain("<img");
    expect(html).not.toContain("is-poster--placeholder");
  });

  it("Rating sem nota mostra 'sem nota' em vez de NaN", () => {
    expect(Rating({ value: null })).toContain("sem nota");
    expect(Rating({ value: 0 })).toContain("sem nota");
    expect(Rating({ value: Number.NaN })).toContain("sem nota");
    expect(Rating({ value: 8.74, votes: 13420 })).toContain("8.7");
    expect(Rating({ value: 8.74, votes: 13420 })).toContain("13k");
  });

  it("Platform sem provider avisa que a plataforma nao esta confirmada", () => {
    expect(Platform({ name: null })).toContain("plataforma a confirmar");
    expect(Platform({ name: "   " })).toContain("plataforma a confirmar");
    expect(Platform({ name: "Netflix" })).toContain("Netflix");
  });

  it("synopsisOrPlaceholder cai para uma frase honesta quando overview e null", () => {
    expect(synopsisOrPlaceholder(theBear)).toContain("drama");
    expect(synopsisOrPlaceholder(series({ id: "x", title: "X" }))).toContain("indisponivel");
  });

  it("SeriesCard renderiza uma serie sem poster/nota/genero/plataforma sem quebrar", () => {
    const empty = series({ id: "empty", title: "Serie Sem Dados" });
    const html = SeriesCard({ series: empty, layout: "horizontal" });

    expect(html).toContain("Serie Sem Dados");
    expect(html).toContain("sem nota");
    expect(html).toContain("plataforma a confirmar");
    expect(html).toContain("is-poster--placeholder");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("RankingItem sem metrica nem ano nao imprime separadores soltos", () => {
    const html = RankingItem({ position: 1, series: series({ id: "y", title: "Y" }) });
    expect(html).toContain(">1<");
    expect(html).toContain("—"); // ano/nota ausentes
    expect(html).not.toContain("undefined");
  });

  it("GenreChips some quando nao ha generos", () => {
    expect(GenreChips({ genres: [] })).toBe("");
    expect(GenreChips({ genres: ["Drama", "Crime", "Suspense", "Extra"], limit: 2 })).toContain("Crime");
    expect(GenreChips({ genres: ["Drama", "Crime", "Suspense", "Extra"], limit: 2 })).not.toContain("Suspense");
  });
});

describe("CTA obrigatorio", () => {
  it("renderiza um CTA padrao mesmo com texto vazio (nenhum formato sai sem CTA)", () => {
    expect(CTA({ text: "" })).toContain("Descubra mais no inSeries");
    expect(CTA({ text: "   " })).toContain("Descubra mais no inSeries");
    expect(CTA({ text: "Monte sua lista" })).toContain("Monte sua lista");
  });
});

describe("seguranca e truncamento", () => {
  it("escapa HTML em todo valor dinamico", () => {
    const html = Title({ text: `<script>alert("x")</script>` });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(escapeHtml(null)).toBe("");
  });

  it("truncate nao corta palavra no meio quando da para evitar", () => {
    expect(truncate("Breaking Bad e uma serie", 12)).toBe("Breaking…");
    expect(truncate("abcdefghijklmno", 6)).toBe("abcde…");
    expect(truncate("curto", 40)).toBe("curto");
    expect(truncate(null, 10)).toBe("");
    expect(truncate("qualquer", 0)).toBe("");
  });

  it("Subtitle vazio nao emite markup", () => {
    expect(Subtitle({ text: "" })).toBe("");
    expect(Subtitle({ text: "  " })).toBe("");
  });

  it("Badge vazio nao emite markup", () => {
    expect(Badge({ text: "" })).toBe("");
  });

  it("Progress clampeia a porcentagem", () => {
    expect(Progress({ value: 10, total: 5 })).toContain("100%");
    expect(Progress({ value: -3, total: 5 })).toContain("0%");
    expect(Progress({ value: 1, total: 0 })).toContain("100%");
  });

  it("formatRating nunca devolve NaN", () => {
    expect(formatRating(null)).toBe("—");
    expect(formatRating(Number.NaN)).toBe("—");
    expect(formatRating(7.25)).toBe("7.3");
  });
});

describe("alt-text", () => {
  it("descreve formato, posicao e series citadas", () => {
    const alt = buildAltText({
      title: "Top 5 mais concluidas",
      format: "carousel",
      slideIndex: 2,
      slideTotal: 7,
      series: [{ title: "Dark" }, { title: "Breaking Bad" }]
    });

    expect(alt).toContain("Slide de carrossel 2 de 7");
    expect(alt).toContain("Top 5 mais concluidas");
    expect(alt).toContain("Dark, Breaking Bad");
  });

  it("funciona sem series associadas", () => {
    const alt = buildAltText({ title: "Calendario de episodios", format: "story" });
    expect(alt).toContain("Story do inSeries");
    expect(alt).not.toContain("Series citadas");
  });
});
