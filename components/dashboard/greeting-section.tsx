import { formatRelativeDate } from "@/lib/utils";
import type { UserStats } from "@/lib/analytics";

function getContextualGreeting(hour: number) {
  if (hour < 5) return "Boa madrugada";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Fase 3 (INSERIES-DASHBOARD-PREMIUM-01) — every number here is reused, not recomputed:
 * `stats.overview` (lib/analytics) already tracks series in progress/episodes remaining,
 * `stats.streaks.lastWatchedAt` already tracks last activity, and `User.lastLoginAt`
 * (lib/auth/server.ts) already tracks last access — all pre-existing fields, no schema
 * change and no new query for this section.
 */
export function GreetingSection({
  name,
  lastLoginAt,
  stats
}: {
  name: string;
  lastLoginAt: Date | null;
  stats: UserStats;
}) {
  const greeting = getContextualGreeting(new Date().getHours());
  const firstName = name.split(" ")[0];

  const facts: string[] = [];
  if (stats.overview.seriesWatching > 0) {
    facts.push(`${stats.overview.seriesWatching} serie${stats.overview.seriesWatching === 1 ? "" : "s"} em andamento`);
  }
  if (stats.overview.episodesRemaining > 0) {
    facts.push(`${stats.overview.episodesRemaining} episodio${stats.overview.episodesRemaining === 1 ? "" : "s"} pendente${stats.overview.episodesRemaining === 1 ? "" : "s"}`);
  }
  if (stats.streaks.lastWatchedAt) {
    facts.push(`ultima atividade ${formatRelativeDate(stats.streaks.lastWatchedAt)}`);
  }
  if (lastLoginAt) {
    facts.push(`ultimo acesso ${formatRelativeDate(lastLoginAt)}`);
  }

  return (
    <div>
      <p className="eyebrow">
        {greeting}, {firstName}
      </p>
      <h1 className="section-title">Dashboard</h1>
      <p className="section-copy">Seu hub de series — tudo que importa agora, num so lugar.</p>
      {facts.length ? <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p> : null}
    </div>
  );
}
