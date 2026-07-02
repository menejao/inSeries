import Link from "next/link";
import { Card } from "@/components/ui/card";
import { GlobalCalendar } from "@/components/calendar/global-calendar";
import { PersonalCalendar } from "@/components/calendar/personal-calendar";
import { getCurrentUser } from "@/lib/auth/server";
import { cn } from "@/lib/utils";
import type { GlobalCalendarRange } from "@/lib/calendar/queries";

type CalendarSearchParams = {
  view?: string;
  range?: string;
  genre?: string;
  language?: string;
  onlyMine?: string;
  onlyUnwatched?: string;
  onlyUnaired?: string;
};

const viewTabs = [
  { key: "personal", label: "Meu calendario" },
  { key: "global", label: "Todos os lancamentos" }
] as const;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : "personal";
  const range: GlobalCalendarRange = params.range === "week" ? "week" : params.range === "month" ? "month" : "today";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="section-title">Calendario</h1>
        <p className="section-copy">Episodios lancados, proximos lancamentos e temporadas futuras das suas series, direto do banco.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {viewTabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/calendar?view=${tab.key}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm transition",
              view === tab.key ? "bg-ember text-night" : "bg-slate-900/60 text-slate-300"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {view === "personal" ? (
        user ? (
          <PersonalCalendar userId={user.id} />
        ) : (
          <Card className="space-y-3 text-center">
            <p className="text-lg font-semibold text-ink">Entre para ver seu calendario</p>
            <p className="text-sm text-slate-300">
              Faca login para acompanhar episodios lancados, proximos lancamentos e temporadas futuras das series que voce segue.
            </p>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ember px-4 text-sm font-semibold text-night transition hover:bg-orange-400"
            >
              Entrar
            </Link>
          </Card>
        )
      ) : (
        <GlobalCalendar
          range={range}
          genre={params.genre || undefined}
          language={params.language || undefined}
          onlyMine={params.onlyMine === "1"}
          onlyUnwatched={params.onlyUnwatched === "1"}
          onlyUnaired={params.onlyUnaired === "1"}
          userId={user?.id ?? null}
          authenticated={Boolean(user)}
        />
      )}
    </div>
  );
}
