import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarIcon, CheckCircleIcon, ChartIcon, FlameIcon, PlayIcon } from "@/components/ui/icons";
import { formatDate, getInitials } from "@/lib/utils";
import type { UserStats } from "@/lib/analytics";

type ProfileHeaderProfile = {
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  isProfilePrivate: boolean;
};

/**
 * Fase 2 (INSERIES-PROFILE-PREMIUM-01) — cabecalho premium: identidade (avatar/nome/
 * username/data de cadastro/bio) sempre visivel, como antes; a nova linha de numeros
 * (sequencia atual, series acompanhadas, series concluidas, episodios assistidos, tempo
 * assistido) so aparece quando `stats` e passado — a pagina so passa `stats` quando
 * `canSeeStats` e verdadeiro (dono ou perfil publico com pelo menos uma das listas de
 * series visivel), nunca para um perfil oculto.
 */
export function ProfileHeader({ profile, stats, action }: { profile: ProfileHeaderProfile; stats: UserStats | null; action: ReactNode }) {
  const tiles = stats
    ? [
        { icon: FlameIcon, label: "Sequencia atual", value: `${stats.streaks.currentStreakDays}d` },
        { icon: PlayIcon, label: "Series acompanhadas", value: stats.overview.seriesWatching },
        { icon: CheckCircleIcon, label: "Series concluidas", value: stats.overview.seriesCompleted },
        { icon: CheckCircleIcon, label: "Episodios assistidos", value: stats.overview.episodesWatched },
        { icon: ChartIcon, label: "Tempo assistido", value: `${stats.watchTime.hoursWatched}h` }
      ]
    : [];

  return (
    <Card className="space-y-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar label={getInitials(profile.name)} name={profile.name} src={profile.avatarUrl} size="xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="section-title">{profile.name}</h1>
              <Badge variant="secondary">@{profile.username}</Badge>
              {profile.isProfilePrivate ? <Badge variant="default">Privado</Badge> : null}
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
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-5">
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
