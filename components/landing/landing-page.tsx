import Link from "next/link";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesPosterCard, type PosterCardVariant } from "@/components/media/series-poster-card";
import { BackdropImage } from "@/components/media/poster-image";
import { ScrollReveal } from "@/components/media/scroll-reveal";
import { CinematicHero } from "@/components/landing/cinematic-hero";
import { CinematicBanner } from "@/components/landing/cinematic-banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { canUseDatabase } from "@/lib/db/health";
import { prisma } from "@/lib/db/prisma";
import { searchSeries } from "@/lib/discovery/search";
import {
  listBaseadasEmLivros,
  listCurtas,
  listEmAlta,
  listEmExibicao,
  listFinalizadas,
  listLongaDuracao,
  listMaisBemAvaliadas,
  listMaisComentadas,
  listMaisPopulares,
  listMaratonas,
  listMinisseries,
  listNovidades,
  listPremiadas
} from "@/lib/catalog/smart-lists";
import { HERO_MIN_DISCOVERY_SCORE, HERO_POOL_SIZE } from "@/lib/catalog/hero-selection";
import type { Series } from "@/lib/types";
import {
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChartIcon,
  CompassIcon,
  FilmIcon,
  ListIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon
} from "@/components/ui/icons";

const FEATURES = [
  {
    icon: CheckCircleIcon,
    title: "Progresso por episodio",
    copy: "Marque episodios assistidos e acompanhe o avanco de cada temporada em tempo real."
  },
  {
    icon: CalendarIcon,
    title: "Calendario de lancamentos",
    copy: "Veja quando os proximos episodios das suas series estreiam, organizados por dia e semana."
  },
  {
    icon: ListIcon,
    title: "Listas sociais",
    copy: "Monte listas tematicas, publique-as e explore as listas de quem voce segue."
  },
  {
    icon: StarIcon,
    title: "Reviews e notas",
    copy: "Avalie series concluidas e leia o que a comunidade esta assistindo."
  },
  {
    icon: FilmIcon,
    title: "Feed de atividades",
    copy: "Acompanhe o que amigos estao assistindo, avaliando e adicionando as listas."
  },
  {
    icon: BellIcon,
    title: "Notificacoes",
    copy: "Seja avisado sobre novos seguidores, reviews e episodios disponiveis."
  }
];

const BENEFITS = [
  {
    icon: PlayIcon,
    title: "Nunca perca o proximo episodio",
    copy: "A tela Assistir a seguir mostra so o que falta, na ordem certa — sem procurar entre series que ja estao em dia."
  },
  {
    icon: ChartIcon,
    title: "Suas estatisticas, de verdade",
    copy: "Horas assistidas, generos favoritos e sequencias calculados a partir do seu progresso real, nunca estimados."
  },
  {
    icon: TrophyIcon,
    title: "Gamificacao que faz sentido",
    copy: "Conquistas desbloqueadas por acoes reais — assistir, avaliar, seguir — sem rankings artificiais."
  },
  {
    icon: SparklesIcon,
    title: "Recap do seu ano em series",
    copy: "Retrospectivas mensais e anuais, com os generos e series que marcaram cada periodo."
  }
];

const TESTIMONIALS = [
  {
    quote: "Finalmente uma tela que me diz exatamente qual episodio assistir, sem eu ter que lembrar onde parei.",
    name: "Usuario inSeries"
  },
  {
    quote: "O recap anual virou o motivo que eu mais espero — ver quantas series eu realmente terminei.",
    name: "Usuario inSeries"
  },
  {
    quote: "Uso a lista de assistir a seguir todo dia. E o primeiro app de series que eu abro de verdade.",
    name: "Usuario inSeries"
  }
];

const FAQ = [
  {
    question: "Preciso pagar para usar o inSeries?",
    answer: "Nao. Criar conta e acompanhar suas series e gratuito."
  },
  {
    question: "O inSeries transmite episodios?",
    answer: "Nao. O inSeries e uma central de acompanhamento — progresso, calendario, estatisticas e comunidade — nao um servico de streaming."
  },
  {
    question: "Minhas estatisticas e conquistas sao calculadas automaticamente?",
    answer: "Sim. Tudo vem do seu progresso real (episodios marcados, series concluidas, reviews, listas) — nada e inserido manualmente."
  },
  {
    question: "Posso deixar meu perfil privado?",
    answer: "Sim. Voce controla, nas configuracoes, o que fica visivel para outras pessoas: series assistidas, reviews, listas e atividade."
  }
];

async function getCatalogStats() {
  if (!(await canUseDatabase())) return null;

  const [seriesCount, episodeCount, userCount, reviewCount] = await Promise.all([
    prisma.series.count(),
    prisma.episode.count(),
    prisma.user.count(),
    prisma.review.count()
  ]);

  return { seriesCount, episodeCount, userCount, reviewCount };
}

type CarouselSection = {
  eyebrow: string;
  title: string;
  href: string;
  items: Series[];
  variant?: PosterCardVariant;
  large?: boolean;
};

type CollectionTile = { label: string; href: string; series?: Series };

function tagHref(tag: string) {
  return `/series?tag=${encodeURIComponent(tag)}`;
}

function genreHref(genre: string) {
  return `/series?genre=${encodeURIComponent(genre)}&sort=quality`;
}

/** Fisher-Yates, seeded by nothing but `Math.random()` — a fresh order every request/reload ("trocar ao atualizar a pagina"), never client-side, so there's no hydration mismatch. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * INSERIES-LANDING-CINEMATIC-IMMERSION-01 — the Landing stops looking like a dashboard
 * catalog listing and becomes a full-bleed, cinematic showcase: a rotating full-viewport
 * Hero, carousels with their own per-list identity (poster grande, nota em destaque, badge
 * NOVO, temporadas/episodios, status, colecao completa), cinematic banners between them,
 * an editorial collections grid, and scroll-revealed sections further down. Every image is
 * a real backdrop/poster/logo already in the catalog — no video, no autoplay, no new
 * business rule: every section is backed by an existing Smart List or discovery filter.
 */
export async function LandingPage() {
  const [
    stats,
    heroDiscoveryPool,
    heroPopularFallback,
    maisPopulares,
    maisBemAvaliadas,
    maratonas,
    curtas,
    minisseries,
    emAlta,
    baseadasEmLivros,
    premiadas,
    longaDuracao,
    novidades,
    emExibicao,
    finalizadas,
    maisComentadas,
    sciFi,
    drama,
    misterio,
    fantasia,
    animacao
  ] = await Promise.all([
    getCatalogStats(),
    // Fase 10 (INSERIES-TRENDING-DISCOVERY-ENGINE-01) — the Hero now ranks by Discovery
    // Score (trending-weighted relevance), not Quality Score, so it never spotlights an
    // obscure-but-complete series. Fallback pool stays plain popularity for catalogs the
    // Discovery Engine hasn't scored yet.
    searchSeries({ sort: "discovery", page: 1, pageSize: HERO_POOL_SIZE }),
    searchSeries({ sort: "popular", page: 1, pageSize: HERO_POOL_SIZE }),
    listMaisPopulares(12),
    listMaisBemAvaliadas(12),
    listMaratonas(12),
    listCurtas(12),
    listMinisseries(12),
    listEmAlta(12),
    listBaseadasEmLivros(12),
    listPremiadas(12),
    listLongaDuracao(12),
    listNovidades(12),
    listEmExibicao(12),
    listFinalizadas(12),
    listMaisComentadas(12),
    searchSeries({ genre: "Sci-Fi", sort: "quality", pageSize: 1 }),
    searchSeries({ genre: "Drama", sort: "quality", pageSize: 1 }),
    searchSeries({ genre: "Mystery", sort: "quality", pageSize: 1 }),
    searchSeries({ genre: "Fantasy", sort: "quality", pageSize: 1 }),
    searchSeries({ genre: "Animation", sort: "quality", pageSize: 1 })
  ]);

  // Fase 10 — only series that actually clear the Discovery Score bar qualify; a small or
  // freshly-scored catalog (fewer than 4 qualifying series) falls back to plain popularity
  // rather than padding the pool with low-relevance series.
  const heroQualified = heroDiscoveryPool.items.filter((item) => (item.discoveryScore ?? 0) >= HERO_MIN_DISCOVERY_SCORE);
  // Fase 3 — a fresh shuffle every request/reload; the pool itself never repeats a series.
  const heroPool = shuffle(heroQualified.length >= 4 ? heroQualified : heroPopularFallback.items);

  // Typed directly on the literal (not on the .filter() result below) so each object's
  // `variant`/`large` literal types narrow correctly instead of widening to `string`/`boolean`.
  const carouselCandidates: CarouselSection[] = [
    { eyebrow: "Mais Populares", title: "O catalogo que todo mundo esta assistindo", href: "/series?sort=popular", items: maisPopulares },
    { eyebrow: "Em Alta", title: "Series com popularidade disparando agora", href: tagHref("Em Alta"), items: emAlta, large: true },
    {
      eyebrow: "Mais Bem Avaliadas",
      title: "As notas mais altas da comunidade",
      href: "/series?sort=rating",
      items: maisBemAvaliadas,
      variant: "rating"
    },
    { eyebrow: "Novidades", title: "Os lancamentos mais recentes do catalogo", href: "/series?sort=latest", items: novidades, variant: "new" },
    {
      eyebrow: "Maratonas",
      title: "Temporadas de sobra para o fim de semana",
      href: tagHref("Maratona"),
      items: maratonas,
      variant: "episodes"
    },
    {
      eyebrow: "Em Exibicao",
      title: "Series que ainda estao no ar",
      href: "/series?status=RETURNING",
      items: emExibicao,
      variant: "status"
    },
    {
      eyebrow: "Finalizadas",
      title: "Maratonas completas, do inicio ao fim",
      href: "/series?status=ENDED",
      items: finalizadas,
      variant: "collection"
    }
  ];
  const carousels = carouselCandidates.filter((section) => section.items.length > 0);

  // Same reasoning as carouselCandidates above: annotate the literal directly.
  const collectionTileCandidates: CollectionTile[] = [
    { label: "Minisseries", href: tagHref("Minissérie"), series: minisseries[0] },
    { label: "Series Curtas", href: "/series?sort=quality", series: curtas[0] },
    { label: "Indicadas ao Emmy", href: tagHref("Premiada"), series: premiadas[0] },
    { label: "Baseadas em Livros", href: tagHref("Baseada em Livro"), series: baseadasEmLivros[0] },
    { label: "Longa Duracao", href: tagHref("Longa Duração"), series: longaDuracao[0] },
    { label: "Sci-Fi", href: genreHref("Sci-Fi"), series: sciFi.items[0] },
    { label: "Drama", href: genreHref("Drama"), series: drama.items[0] },
    { label: "Suspense", href: genreHref("Mystery"), series: misterio.items[0] },
    { label: "Fantasia", href: genreHref("Fantasy"), series: fantasia.items[0] },
    { label: "Animacoes", href: genreHref("Animation"), series: animacao.items[0] }
  ];
  const collectionTiles = collectionTileCandidates.filter(
    (tile): tile is CollectionTile & { series: Series } => Boolean(tile.series)
  );

  const bannerSerieDaSemana = maisPopulares[0];
  const bannerMaisComentada = maisComentadas[0];
  const bannerValeAMaratona = maratonas.find((series) => series.id !== bannerSerieDaSemana?.id) ?? maratonas[0];
  const bannerEscolhaDaComunidade =
    premiadas.find((series) => series.id !== bannerSerieDaSemana?.id && series.id !== bannerMaisComentada?.id) ??
    maisBemAvaliadas.find((series) => series.id !== bannerSerieDaSemana?.id) ??
    maisBemAvaliadas[0];

  return (
    <div className="space-y-16">
      {/* Fase 2 — full-bleed breakout: LandingShell's max-w-7xl/px-* container is cancelled
          here (100vw via negative margin) and the shell's pt-24 header clearance (see
          landing-shell.tsx) is cancelled too (-mt-24), so the Hero's backdrop truly reaches
          every edge of the viewport, with only the fixed transparent header floating over it. */}
      <div className="relative left-1/2 right-1/2 -mx-[50vw] -mt-24 w-screen">
        <CinematicHero pool={heroPool} />
      </div>

      {carousels.length ? (
        <>
          <CarouselSectionBlock section={carousels[0]} index={0} />

          {bannerSerieDaSemana ? (
            <ScrollReveal>
              <CinematicBanner eyebrow="Serie da Semana" title="Comece por aqui" href={`/series/${bannerSerieDaSemana.slug}`} series={bannerSerieDaSemana} />
            </ScrollReveal>
          ) : null}

          {carousels.slice(1, 3).map((section, index) => (
            <CarouselSectionBlock key={section.eyebrow} section={section} index={index + 1} />
          ))}

          {bannerMaisComentada ? (
            <ScrollReveal>
              <CinematicBanner
                eyebrow="Mais Comentada"
                title="O assunto do momento entre a comunidade"
                href={`/series/${bannerMaisComentada.slug}`}
                series={bannerMaisComentada}
              />
            </ScrollReveal>
          ) : null}

          {carousels.slice(3, 5).map((section, index) => (
            <CarouselSectionBlock key={section.eyebrow} section={section} index={index + 3} />
          ))}

          {bannerValeAMaratona ? (
            <ScrollReveal>
              <CinematicBanner
                eyebrow="Vale a Maratona"
                title="Temporadas de sobra para nao parar de assistir"
                href={`/series/${bannerValeAMaratona.slug}`}
                series={bannerValeAMaratona}
              />
            </ScrollReveal>
          ) : null}

          {carousels.slice(5).map((section, index) => (
            <CarouselSectionBlock key={section.eyebrow} section={section} index={index + 5} />
          ))}
        </>
      ) : (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Catalogo ainda vazio"
          copy="Assim que series forem sincronizadas, elas aparecem aqui em destaque."
        />
      )}

      {collectionTiles.length ? (
        <ScrollReveal>
          <section className="space-y-4">
            <div>
              <p className="eyebrow">Colecoes</p>
              <h2 className="section-title">Descubra por tema</h2>
              <p className="section-copy mt-1">Curadoria editorial a partir dos generos e tags reais do catalogo.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {collectionTiles.map((tile) => (
                <CollectionTile key={tile.label} tile={tile} />
              ))}
            </div>
          </section>
        </ScrollReveal>
      ) : null}

      {bannerEscolhaDaComunidade ? (
        <ScrollReveal>
          <CinematicBanner
            eyebrow="Escolha da Comunidade"
            title="Aclamada pela critica e pelo publico"
            href={`/series/${bannerEscolhaDaComunidade.slug}`}
            series={bannerEscolhaDaComunidade}
          />
        </ScrollReveal>
      ) : null}

      {stats ? (
        <ScrollReveal>
          <section className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-border/60 py-8 text-center">
            <InlineStat label="Series" value={stats.seriesCount} />
            <InlineStat label="Episodios" value={stats.episodeCount} />
            <InlineStat label="Usuarios" value={stats.userCount} />
            <InlineStat label="Reviews" value={stats.reviewCount} />
          </section>
        </ScrollReveal>
      ) : null}

      <ScrollReveal>
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Por que inSeries</p>
            <h2 className="section-title">Feito para quem leva series a serio</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="space-y-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
                  <benefit.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{benefit.title}</p>
                  <p className="mt-1 text-sm text-muted">{benefit.copy}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Recursos</p>
            <h2 className="section-title">Um modulo para cada parte de acompanhar series</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="space-y-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
                  <feature.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-ink">{feature.title}</p>
                  <p className="mt-1 text-sm text-muted">{feature.copy}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Depoimentos (em breve)</p>
            <h2 className="section-title">O que os maratonistas vao dizer</h2>
            <p className="section-copy mt-1">Depoimentos ilustrativos — a comunidade real ainda esta crescendo.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <Card key={index} className="space-y-3">
                <StarRow />
                <p className="text-sm leading-6 text-muted">&ldquo;{testimonial.quote}&rdquo;</p>
                <p className="text-sm font-semibold text-ink">{testimonial.name}</p>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section className="space-y-4">
          <div>
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 className="section-title">Antes de comecar</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <Card key={item.question} as="details" padding="none" className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink marker:content-none">
                  {item.question}
                  <span className="shrink-0 text-subtle transition group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
              </Card>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal>
        <section>
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
            <h2 className="section-title">Comece a acompanhar suas series hoje</h2>
            <p className="max-w-md text-sm text-muted">Gratuito, sem cartao de credito. Leva menos de um minuto para criar sua conta.</p>
            <Link href="/register" className="inline-flex">
              <Button size="lg">Criar conta gratis</Button>
            </Link>
          </Card>
        </section>
      </ScrollReveal>
    </div>
  );
}

function CarouselSectionBlock({ section, index }: { section: CarouselSection; index: number }) {
  return (
    <ScrollReveal>
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{section.eyebrow}</p>
            <h2 className="section-title">{section.title}</h2>
          </div>
          <Link href={section.href} className="link-accent shrink-0 text-sm">
            Ver tudo
          </Link>
        </div>
        <Carousel>
          {section.items.map((series, itemIndex) => (
            <CarouselItem key={series.id} size={section.large ? "large" : "default"}>
              <SeriesPosterCard
                series={series}
                priority={index === 0 && itemIndex < 4}
                variant={section.variant}
                large={section.large}
              />
            </CarouselItem>
          ))}
        </Carousel>
      </section>
    </ScrollReveal>
  );
}

function CollectionTile({ tile }: { tile: CollectionTile & { series: Series } }) {
  return (
    <Link
      href={tile.href}
      className="group relative block aspect-[3/4] overflow-hidden rounded-2xl border border-border shadow-card transition duration-300 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-raised"
    >
      <BackdropImage
        src={tile.series.backdropUrl || tile.series.posterUrl}
        alt={tile.label}
        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
        imageClassName="transition duration-500 ease-out group-hover:scale-110"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/40 to-transparent" />
      <p className="absolute inset-x-0 bottom-0 p-3 text-sm font-bold text-ink sm:text-base">{tile.label}</p>
    </Link>
  );
}

function InlineStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-3xl font-black text-ink">{value.toLocaleString("pt-BR")}</p>
      <p className="eyebrow">{label}</p>
    </div>
  );
}

function StarRow() {
  return (
    <div className="flex gap-0.5 text-warning-text" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon key={index} className="h-4 w-4" />
      ))}
    </div>
  );
}
