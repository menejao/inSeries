import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { getActionContent, typeIcons } from "@/components/feed/activity-card";
import { FilmIcon } from "@/components/ui/icons";
import { formatRelativeDate, getInitials } from "@/lib/utils";
import type { ActivityFeedItem } from "@/lib/social/activity";

/**
 * Fase 10/17 (INSERIES-DASHBOARD-HOME-EXPERIENCE-03) — versao de uma linha da Atividade
 * recente. Reaproveita `getActionContent`/`typeIcons` de ActivityCard (mesma logica de texto
 * por tipo) em vez de duplicar o switch por tipo de atividade; so descarta os blocos extras
 * (preview de review/comentario, badges, poster, hover lift) que fazem o card completo ser
 * alto. A pagina /feed continua usando ActivityCard inalterado.
 */
export function ActivityRow({ activity }: { activity: ActivityFeedItem }) {
  const action = getActionContent(activity);
  const Icon = typeIcons[activity.type] ?? FilmIcon;

  return (
    <div className="flex items-center gap-3 rounded-2xl p-2">
      <div className="relative shrink-0">
        <Avatar label={getInitials(activity.user.name)} name={activity.user.name} src={activity.user.avatarUrl} size="sm" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-surface bg-surface-strong text-primary-text">
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>
      <p className="line-clamp-1 min-w-0 flex-1 text-sm text-ink/90">
        <Link href={`/profile/${activity.user.username}`} className="font-semibold text-ink">
          {activity.user.name}
        </Link>{" "}
        {action.text}
      </p>
      <span className="shrink-0 text-xs text-subtle">{formatRelativeDate(activity.createdAt)}</span>
    </div>
  );
}
