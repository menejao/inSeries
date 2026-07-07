import Link from "next/link";
import { BackdropImage } from "@/components/media/poster-image";
import { Carousel, CarouselItem } from "@/components/media/carousel";
import { SeriesPosterCard } from "@/components/media/series-poster-card";
import { SeriesLogoOrTitle } from "@/components/media/series-logo";
import { CollectionTagList } from "@/components/media/collection-tag-badge";
import { ProviderList } from "@/components/media/provider-badge";
import { Badge } from "@/components/ui/badge";
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
  listLongaDuracao,
  listMaisBemAvaliadas,
  listMaisPopulares,
  listMaratonas,
  listMinisseries,
  listNovidades,
  listPremiadas
} from "@/lib/catalog/smart-lists";
import { HERO_POOL_SIZE, pickHero } from "@/lib/catalog/hero-selection";
import type { Series } from "@/lib/types";
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  CheckCircleIcon,
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

type CarouselSection = { eyebrow: string; title: string; href: string; items: Series[] };

function tagHref(tag: string) {
  return `/series?tag=${encodeURIComponent(tag)}`;
}

/**
 * Fase 2/3/11 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — o Hero passa a considerar o
 * Quality Score (pickHero acima) e o corpo da Landing deixa de usar sorts genericos
 * (popular/latest/rating/status) e passa a usar o motor de Smart Lists de verdade
 * (lib/catalog/smart-lists.ts) — as mesmas 10 listas nomeadas no ticket, cada uma com sua
 * propria personalidade (eyebrow/titulo), sem redundancia entre secoes.
 */
export async function LandingPage() {
  const [
    stats,
    heroQualityPool,
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
    novidades
  ] = await Promise.all([
    getCatalogStats(),
    searchSeries({ sort: "quality", page: 1, pageSize: HERO_POOL_SIZE }),
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
    listNovidades(12)
  ]);

  const hero = pickHero(heroQualityPool.items, heroPopularFallback.items);
  const sections: CarouselSection[] = [
    { eyebrow: "Mais Populares", title: "O catalogo que todo mundo esta assistindo", href: "/series?sort=popular", items: maisPopulares },
    { eyebrow: "Mais Bem Avaliadas", title: "As notas mais altas da comunidade", href: "/series?sort=rating", items: maisBemAvaliadas },
    { eyebrow: "Em Alta", title: "Series com popularidade disparando agora", href: tagHref("Em Alta"), items: emAlta },
    { eyebrow: "Novidades", title: "Os lancamentos mais recentes do catalogo", href: "/series?sort=latest", items: novidades },
    { eyebrow: "Maratonas", title: "Temporadas de sobra para o fim de semana", href: tagHref("Maratona"), items: maratonas },
    { eyebrow: "Minisseries", title: "Historias completas, sem compromisso longo", href: tagHref("Minissérie"), items: minisseries },
    { eyebrow: "Curtas", title: "Poucos episodios, comeco-meio-fim rapido", href: "/series?sort=quality", items: curtas },
    { eyebrow: "Baseadas em Livros", title: "Series adaptadas de romances e quadrinhos", href: tagHref("Baseada em Livro"), items: baseadasEmLivros },
    { eyebrow: "Premiadas", title: "Aclamadas pela critica e pelo publico", href: tagHref("Premiada"), items: premiadas },
    { eyebrow: "Longa Duracao", title: "Series com muitas temporadas para maratonar", href: tagHref("Longa Duração"), items: longaDuracao }
  ].filter((section) => section.items.length > 0);

  return (
    <div className="space-y-16">
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-4xl sm:border sm:border-border">
        <div className="relative min-h-[70vh] sm:min-h-[80vh]">
          <div className="absolute inset-0">
            {hero ? (
              <BackdropImage src={hero.backdropUrl || hero.posterUrl} alt={hero.title} priority sizes="100vw" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-surface-strong via-surface to-canvas" />
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/35 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/55 via-transparent to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end gap-5 p-5 sm:p-10 lg:max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
                in
              </span>
              <span className="text-sm font-semibold text-ink">inSeries</span>
            </div>
            <Badge>Feito para maratonistas</Badge>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Sua central para acompanhar series, episodio por episodio.
            </h1>
            <p className="max-w-xl text-base leading-7 text-ink/90 sm:text-lg">
              Progresso real por episodio, calendario de lancamentos, recomendacoes, estatisticas, recap anual e conquistas — tudo
              calculado a partir do que voce realmente assiste.
            </p>
            {hero ? (
              <div className="space-y-2.5">
                <p className="text-sm text-muted">Em destaque:</p>
                <SeriesLogoOrTitle
                  title={hero.title}
                  logoUrl={hero.logoUrl}
                  as="p"
                  textClassName="text-lg font-semibold text-ink"
                  logoClassName="h-12 max-w-[220px]"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <CollectionTagList tags={hero.collectionTags} limit={3} />
                  <ProviderList providers={hero.watchProviders} limit={3} />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex">
                <Button size="lg">Criar conta gratis</Button>
              </Link>
              <Link href="/series" className="inline-flex">
                <Button size="lg" variant="secondary">
                  Explorar catalogo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {stats ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Series" value={stats.seriesCount} />
          <StatTile label="Episodios" value={stats.episodeCount} />
          <StatTile label="Usuarios" value={stats.userCount} />
          <StatTile label="Reviews" value={stats.reviewCount} />
        </section>
      ) : null}

      {sections.length ? (
        sections.map((section, index) => (
          <section key={section.eyebrow} className="space-y-3">
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
                <CarouselItem key={series.id}>
                  <SeriesPosterCard series={series} priority={index === 0 && itemIndex < 4} />
                </CarouselItem>
              ))}
            </Carousel>
          </section>
        ))
      ) : (
        <EmptyState
          icon={<CompassIcon className="h-6 w-6" />}
          title="Catalogo ainda vazio"
          copy="Assim que series forem sincronizadas, elas aparecem aqui em destaque."
        />
      )}

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

      <section>
        <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
          <h2 className="section-title">Comece a acompanhar suas series hoje</h2>
          <p className="max-w-md text-sm text-muted">Gratuito, sem cartao de credito. Leva menos de um minuto para criar sua conta.</p>
          <Link href="/register" className="inline-flex">
            <Button size="lg">Criar conta gratis</Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-border bg-surface-strong/50 p-4 text-center sm:text-left">
      <p className="text-2xl font-semibold text-ink">{value.toLocaleString("pt-BR")}</p>
      <p className="text-xs text-muted">{label}</p>
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
