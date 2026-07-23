import Link from "next/link";
import { typeIcons } from "@/components/feed/activity-card";
import { FilmIcon } from "@/components/ui/icons";
import { formatRelativeDate } from "@/lib/utils";
import type { ActivityGroup } from "@/lib/dashboard/group-activity";

/**
 * Fase 11 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — versao compacta de 1 grupo de
 * atividade (ja agrupado por `groupRecentActivity`). Reusa `typeIcons` de
 * `components/feed/activity-card.tsx` (mesmo mapeamento tipo->icone do Feed, "nao alterar o
 * Feed completo" - so consumido, nunca modificado) em vez de duplicar o switch.
 */
export function ActivityGroupRow({ group }: { group: ActivityGroup }) {
  const Icon = typeIcons[group.type] ?? FilmIcon;
  const content = (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-strong/40 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-strong text-primary-text">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm text-ink">{group.label}</p>
        <p className="line-clamp-1 text-xs text-subtle">
          {group.contextLabel ? `${group.contextLabel} · ` : ""}
          {formatRelativeDate(group.latestCreatedAt)}
        </p>
      </div>
    </div>
  );

  return group.href ? (
    <Link href={group.href} className="block transition hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  );
}
