import Link from "next/link";
import { SeriesCard } from "@/components/series/series-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/server";
import { canUseDatabase } from "@/lib/db/health";
import { prisma } from "@/lib/db/prisma";
import { searchSeries } from "@/lib/discovery/search";
import {
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  FilmIcon,
  ListIcon,
  StarIcon
} from "@/components/ui/icons";

const features = [
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

export default async function HomePage() {
  const [user, stats, popular] = await Promise.all([
    getCurrentUser(),
    getCatalogStats(),
    searchSeries({ sort: "popular", page: 1, pageSize: 6 })
  ]);

  return (
    <div className="space-y-14">
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card padding="lg" className="animate-fade-in-up overflow-hidden">
          <Badge>Feito para maratonistas</Badge>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Sua central para acompanhar series, episodio por episodio.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Progresso real por episodio, calendario de lancamentos, listas e reviews sociais — tudo em um so lugar,
            pensado para quem leva series a serio.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/series" className="inline-flex">
              <Button size="lg">Explorar catalogo</Button>
            </Link>
            {user ? (
              <Link href="/me" className="inline-flex">
                <Button size="lg" variant="secondary">
                  Ir para minha area
                </Button>
              </Link>
            ) : (
              <Link href="/register" className="inline-flex">
                <Button size="lg" variant="secondary">
                  Criar conta gratis
                </Button>
              </Link>
            )}
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
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Populares</p>
            <h2 className="section-title">Em destaque no catalogo</h2>
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
          <p className="eyebrow">Funcionalidades</p>
          <h2 className="section-title">Feito para quem acompanha series de verdade</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
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

      <footer className="border-t border-border pt-8 text-sm text-muted">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
                in
              </span>
              <span className="font-semibold text-ink">inSeries</span>
            </div>
            <p>Uma plataforma independente para acompanhar series, episodio por episodio.</p>
          </div>
          <nav aria-label="Links do rodape" className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            <Link href="/series" className="transition hover:text-ink">
              Catalogo
            </Link>
            <Link href="/calendar" className="transition hover:text-ink">
              Calendario
            </Link>
            <Link href="/lists" className="transition hover:text-ink">
              Listas
            </Link>
            <Link href="/feed" className="transition hover:text-ink">
              Feed
            </Link>
            <Link href="/login" className="transition hover:text-ink">
              Entrar
            </Link>
            <Link href="/register" className="transition hover:text-ink">
              Criar conta
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-xs text-subtle">© {new Date().getFullYear()} inSeries. Todos os direitos reservados.</p>
      </footer>
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
