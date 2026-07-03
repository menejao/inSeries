import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { GlobalCalendar } from "@/components/calendar/global-calendar";
import { PersonalCalendar } from "@/components/calendar/personal-calendar";
import { getCurrentUser } from "@/lib/auth/server";
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

export default async function CalendarPage({ searchParams }: { searchParams: Promise<CalendarSearchParams> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const view = params.view === "global" ? "global" : "personal";
  const range: GlobalCalendarRange = params.range === "week" ? "week" : params.range === "month" ? "month" : "today";

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Timeline</p>
        <h1 className="section-title">Calendario</h1>
        <p className="section-copy">Episodios lancados, proximos lancamentos e temporadas futuras das suas series, direto do banco.</p>
      </div>

      <Tabs
        label="Visualizacao do calendario"
        items={[
          { href: "/calendar?view=personal", label: "Meu calendario" },
          { href: "/calendar?view=global", label: "Todos os lancamentos" }
        ]}
        active={`/calendar?view=${view}`}
      />

      {view === "personal" ? (
        user ? (
          <PersonalCalendar userId={user.id} />
        ) : (
          <Card className="space-y-3 text-center">
            <p className="text-lg font-semibold text-ink">Entre para ver seu calendario</p>
            <p className="text-sm text-muted">
              Faca login para acompanhar episodios lancados, proximos lancamentos e temporadas futuras das series que voce segue.
            </p>
            <Link href="/login" className="inline-flex justify-center">
              <Button>Entrar</Button>
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
