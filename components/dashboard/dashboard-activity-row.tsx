import { typeIcons, getActionText } from "@/components/feed/activity-card";
import { FilmIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * Fase 10 (INSERIES-DASHBOARD-AND-MY-LIST-EXPERIENCE-01) — "Atividade recente" opcional e
 * minima ("evitar excesso de informacoes"): 1 linha por evento, sem agrupamento (a versao
 * anterior, com regra de agrupamento propria, foi removida na
 * INSERIES-DASHBOARD-HOME-EXPERIENCE-03 por ser redundante com o Feed - esta e
 * deliberadamente mais simples, nao a mesma secao de volta). Reusa `typeIcons`/
 * `getActionText` de `components/feed/activity-card.tsx` (mesmo mapeamento do Feed,
 * nunca duplicado) - o Feed continua intocado, so consumido.
 */
export function DashboardActivityRow({ activity }: { activity: ActivityFeedItem }) {
  const Icon = typeIcons[activity.type] ?? FilmIcon;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
        <Icon className="h-4 w-4" />
      </span>
      <p className="line-clamp-1 flex-1 text-sm text-ink">
        Voce {getActionText(activity)}
        <span className="ml-2 text-xs text-subtle">{formatRelativeDate(activity.createdAt)}</span>
      </p>
    </div>
  );
}
