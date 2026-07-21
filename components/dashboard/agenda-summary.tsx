import { EpisodeActionRow } from "@/components/dashboard/episode-action-row";
import type { AgendaGroup } from "@/lib/dashboard/agenda";

/**
 * Fase 7/8 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — agenda compacta agrupada por data
 * (Hoje/Amanha/Esta semana), nunca uma copia do calendario completo. `hiddenCount` vira um
 * resumo textual ("+N mais") em vez de renderizar mais linhas.
 */
export function AgendaSummary({ groups }: { groups: AgendaGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.key} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{group.label}</p>
          <div className="space-y-2">
            {group.episodes.map((episode) => (
              <EpisodeActionRow key={episode.id} episode={episode} dateLabel={group.label} />
            ))}
          </div>
          {group.hiddenCount > 0 ? (
            <p className="text-xs text-subtle">+{group.hiddenCount} episodio(s) a mais {group.label.toLowerCase()}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
