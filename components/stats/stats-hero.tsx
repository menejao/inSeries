import { Avatar } from "@/components/ui/avatar";
import { StatCounter } from "@/components/stats/stat-counter";
import { ShareButton } from "@/components/stats/share-button";
import { getInitials } from "@/lib/utils";
import type { ViewerPersona } from "@/lib/stats/types";

/** INSERIES-STATISTICS-ENGINE-01 — "Hero da pagina": avatar, nivel, titulo dinamico, estatistica principal, botao de compartilhar. */
export function StatsHero({
  name,
  avatarUrl,
  persona,
  level,
  points,
  hoursWatched,
  episodesWatched
}: {
  name: string;
  avatarUrl: string | null;
  persona: ViewerPersona;
  level: number;
  points: number;
  hoursWatched: number;
  episodesWatched: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-4xl border border-border bg-surface/70 p-6 shadow-card sm:p-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: "radial-gradient(circle at top left, rgb(var(--c-primary) / 0.18), transparent 55%)" }}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar label={getInitials(name)} name={name} src={avatarUrl} size="lg" />
          <div>
            <p className="eyebrow">Nivel {level} · {points} pts</p>
            <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-4xl">
              {persona.emoji} Voce e {persona.title.startsWith("Voce") ? persona.title.replace(/^Voce\s*/, "") : `um(a) ${persona.title}`}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">{persona.description}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="text-left sm:text-right">
            <p className="font-display text-4xl font-black text-ink">
              <StatCounter value={hoursWatched} />h
            </p>
            <p className="text-xs text-subtle">{episodesWatched.toLocaleString("pt-BR")} episodios assistidos</p>
          </div>
          <ShareButton personaTitle={persona.title} hoursWatched={hoursWatched} episodesWatched={episodesWatched} />
        </div>
      </div>
    </section>
  );
}
