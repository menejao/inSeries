import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { WatchNextCard } from "@/components/watch-next/watch-next-card";
import { CalendarIcon, CheckCircleIcon, CompassIcon } from "@/components/ui/icons";
import { requireUser } from "@/lib/auth/server";
import { getWatchNextForUser } from "@/lib/watch-next";

export default async function WatchNextPage() {
  const user = await requireUser();
  const result = await getWatchNextForUser(user.id);

  const overdueItems = result.items.filter((item) => item.isOverdue);
  const recentItems = result.items.filter((item) => !item.isOverdue);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Minha area</p>
        <h1 className="section-title">Assistir a seguir</h1>
        <p className="section-copy">O proximo episodio pendente de cada serie que voce acompanha.</p>
      </div>

      {result.items.length === 0 ? (
        !result.hasTrackedSeries ? (
          <EmptyState
            icon={<CompassIcon className="h-6 w-6" />}
            title="Voce ainda nao segue nenhuma serie."
            copy="Explore o catalogo e comece a acompanhar suas series favoritas."
            action={
              <Link href="/series">
                <Button>Explorar series</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<CheckCircleIcon className="h-6 w-6" />}
            title="Voce esta em dia com suas series."
            copy="Nenhum episodio pendente agora — quando sair um novo, ele aparece aqui."
            action={
              <Link href="/calendar">
                <Button variant="secondary">Ver calendario</Button>
              </Link>
            }
          />
        )
      ) : (
        <>
          {overdueItems.length ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <CalendarIcon className="h-5 w-5 text-subtle" />
                Atrasados
              </h2>
              <div className="space-y-3">
                {overdueItems.map((item) => (
                  <WatchNextCard key={item.episode.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}

          {recentItems.length ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-ink">Lancados recentemente</h2>
              <div className="space-y-3">
                {recentItems.map((item) => (
                  <WatchNextCard key={item.episode.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
