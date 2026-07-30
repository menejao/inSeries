import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarIcon, CheckCircleIcon, ChartIcon, FlameIcon } from "@/components/ui/icons";
import { SupporterBadge } from "@/components/supporters/supporter-badge";
import { SupporterName } from "@/components/supporters/supporter-name";
import { formatDate, getInitials } from "@/lib/utils";
import type { UserStats } from "@/lib/analytics";

type ProfileHeaderProfile = {
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  isProfilePrivate: boolean;
  isActiveSupporter?: boolean;
  showSupporterBadge?: boolean;
  /** INSERIES-ACHIEVEMENTS-REDESIGN-01 — "titulos devem aparecer... no perfil do usuario". Null when gamification is off or the user has 0 points (level 1 badge would be noise for a brand-new account). */
  levelTitle?: string | null;
};

/**
 * INSERIES-PROFILE-REDESIGN-01 — cabecalho: identidade (avatar/nome/username/data de
 * cadastro/bio) sempre visivel; a linha de numeros fica reduzida a "poucas estatisticas de
 * destaque" (episodios, horas, series concluidas, sequencia atual) — nunca a lista completa
 * de 10 metricas que vivia aqui antes, essas pertencem a pagina de Estatisticas. So aparece
 * quando `stats` e passado (dono, ou perfil publico com pelo menos uma lista de series
 * visivel), nunca para um perfil oculto.
 */
export function ProfileHeader({ profile, stats, action }: { profile: ProfileHeaderProfile; stats: UserStats | null; action: ReactNode }) {
  const tiles = stats
    ? [
        { icon: CheckCircleIcon, label: "Episodios assistidos", value: stats.overview.episodesWatched },
        { icon: ChartIcon, label: "Horas assistidas", value: `${stats.watchTime.hoursWatched}h` },
        { icon: CheckCircleIcon, label: "Series concluidas", value: stats.overview.seriesCompleted },
        { icon: FlameIcon, label: "Sequencia atual", value: `${stats.streaks.currentStreakDays}d` }
      ]
    : [];

  const showBadge = Boolean(profile.isActiveSupporter && profile.showSupporterBadge);

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar label={getInitials(profile.name)} name={profile.name} src={profile.avatarUrl} size="xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="section-title">
                <SupporterName active={showBadge}>{profile.name}</SupporterName>
              </h1>
              <Badge variant="secondary">@{profile.username}</Badge>
              {profile.isProfilePrivate ? <Badge variant="default">Privado</Badge> : null}
              {showBadge ? <SupporterBadge /> : null}
              {profile.levelTitle ? <Badge variant="primary">🏆 {profile.levelTitle}</Badge> : null}
            </div>
            {profile.bio ? <p className="section-copy max-w-xl">{profile.bio}</p> : null}
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <CalendarIcon className="h-3.5 w-3.5" /> Entrou em {formatDate(profile.createdAt)}
            </p>
          </div>
        </div>
        <div>{action}</div>
      </div>

      {tiles.length ? (
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="space-y-1.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary-text">
                <tile.icon className="h-4.5 w-4.5" />
              </span>
              <p className="truncate text-xl font-black text-ink sm:text-2xl">{tile.value}</p>
              <p className="text-xs text-muted">{tile.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
