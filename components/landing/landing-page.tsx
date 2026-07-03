import Link from "next/link";
import { SeriesCard } from "@/components/series/series-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { canUseDatabase } from "@/lib/db/health";
import { prisma } from "@/lib/db/prisma";
import { searchSeries } from "@/lib/discovery/search";
import {
  BellIcon,
  CalendarIcon,
  ChartIcon,
  CheckCircleIcon,
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

/**
 * Fase 3 — the full public Landing Page: Hero, CTA, Beneficios, Demonstracao,
 * Recursos, Estatisticas do catalogo, Depoimentos (placeholder), FAQ. Never
 * shows anything from the authenticated product (no personal data, no
 * internal navigation) — "visitante conhece o produto", nao o usa.
 */
export async function LandingPage() {
  const [stats, popular] = await Promise.all([getCatalogStats(), searchSeries({ sort: "popular", page: 1, pageSize: 6 })]);

  return (
    <div className="space-y-20">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card padding="lg" className="animate-fade-in-up overflow-hidden">
          <Badge>Feito para maratonistas</Badge>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Sua central para acompanhar series, episodio por episodio.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Progresso real por episodio, calendario de lancamentos, recomendacoes, estatisticas, recap anual e conquistas — tudo
            calculado a partir do que voce realmente assiste.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex">
              <Button size="lg">Criar conta gratis</Button>
            </Link>
            <Link href="/series" className="inline-flex">
              <Button size="lg" variant="secondary">
                Explorar catalogo
              </Button>
            </Link>
          </div>
        </Card>
        <Card padding="lg" className="animate-fade-in-up [animation-delay:80ms]">
          <p className="eyebrow">O catalogo em numeros</p>
          {stats ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatTile label="Series" value={stats.seriesCount} />
              <StatTile label="Episodios" value={stats.episodeCount} />
              <StatTile label="Usuarios" value={stats.userCount} />
              <StatTile label="Reviews" value={stats.reviewCount} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Estatisticas indisponiveis no momento.</p>
          )}
        </Card>
      </section>

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
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Demonstracao</p>
            <h2 className="section-title">Em destaque no catalogo agora</h2>
          </div>
          <Link href="/series" className="link-accent shrink-0 text-sm">
            Ver tudo
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popular.items.map((series) => (
            <SeriesCard key={series.id} series={series} />
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
    <div className="rounded-3xl border border-border bg-surface-strong/50 p-3">
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
