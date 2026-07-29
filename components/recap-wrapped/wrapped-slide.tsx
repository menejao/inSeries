import Link from "next/link";
import { BackdropImage } from "@/components/media/poster-image";
import { StatCounter } from "@/components/stats/stat-counter";
import { WrappedParticles } from "@/components/recap-wrapped/wrapped-particles";
import { WrappedShareButton } from "@/components/recap-wrapped/wrapped-share-button";
import { FlameIcon, SparklesIcon, TrophyIcon } from "@/components/ui/icons";
import type { WrappedSlide } from "@/lib/recap/wrapped-types";

function AmbientBackground({ variant = "default" }: { variant?: "default" | "warm" | "cool" }) {
  const gradients: Record<string, string> = {
    default: "radial-gradient(circle at 30% 20%, rgba(249,115,22,0.35), transparent 55%), radial-gradient(circle at 80% 80%, rgba(249,115,22,0.12), transparent 45%)",
    warm: "radial-gradient(circle at 50% 15%, rgba(239,68,68,0.4), transparent 55%), radial-gradient(circle at 20% 85%, rgba(249,115,22,0.2), transparent 45%)",
    cool: "radial-gradient(circle at 70% 20%, rgba(59,130,246,0.3), transparent 55%), radial-gradient(circle at 20% 80%, rgba(249,115,22,0.15), transparent 45%)"
  };
  return (
    <div className="absolute inset-0 -z-10 animate-kenburns bg-canvas" style={{ backgroundImage: gradients[variant] }} aria-hidden="true" />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow animate-fade-in text-primary-text">{children}</p>;
}

function Insight({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-md animate-fade-in-up text-base leading-7 text-muted sm:text-lg">{children}</p>;
}

/** INSERIES-RECAP-ENGINE-01 — one visual per slide kind. Every number is real (WrappedData), never placeholder copy. */
export function WrappedSlideContent({ slide }: { slide: WrappedSlide }) {
  switch (slide.kind) {
    case "welcome":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground />
          <WrappedParticles />
          <span className="flex h-20 w-20 animate-scale-in items-center justify-center rounded-3xl bg-primary text-3xl font-black text-primary-foreground">
            in
          </span>
          <h1 className="mt-6 animate-fade-in-up font-display text-4xl font-black tracking-tight text-ink sm:text-6xl">Seu Recap {slide.year}</h1>
          <p className="mt-4 animate-fade-in text-lg text-muted">A sua jornada como espectador, contada em numeros.</p>
        </div>
      );

    case "numbers":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground />
          <Eyebrow>Seu ano em numeros</Eyebrow>
          <p className="mt-3 font-display text-7xl font-black text-ink sm:text-8xl">
            <StatCounter value={slide.episodesWatched} />
          </p>
          <p className="mt-1 text-xl text-muted">episodios assistidos</p>
          <div className="mt-10 flex gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-ink">{slide.seriesStarted}</p>
              <p className="text-xs text-subtle">series iniciadas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-ink">{slide.seriesCompleted}</p>
              <p className="text-xs text-subtle">series concluidas</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-ink">{slide.seasonsCompleted}</p>
              <p className="text-xs text-subtle">temporadas concluidas</p>
            </div>
          </div>
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "time":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground variant="warm" />
          <Eyebrow>Quanto tempo voce assistiu</Eyebrow>
          <p className="mt-3 font-display text-7xl font-black text-ink sm:text-8xl">
            <StatCounter value={slide.hoursWatched} />h
          </p>
          <p className="mt-1 text-xl text-muted">{slide.daysWatched} dias equivalentes</p>
          <div className="mt-10 flex flex-col gap-3">
            {slide.comparisons.map((comparison) => (
              <p key={comparison.label} className="text-sm text-muted">
                <span className="font-bold text-ink">{comparison.value}</span> {comparison.label}
              </p>
            ))}
          </div>
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "favorite-series":
      return (
        <div className="relative flex h-full flex-col items-end justify-end overflow-hidden text-left">
          <div className="absolute inset-0">
            <BackdropImage src={slide.series.backdropUrl} alt={slide.series.title} />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />
          </div>
          <div className="relative z-10 p-8 pb-16 sm:p-12">
            <Eyebrow>Sua serie favorita</Eyebrow>
            <h2 className="mt-3 font-display text-4xl font-black text-ink sm:text-6xl">{slide.series.title}</h2>
            <p className="mt-2 text-lg text-muted">{slide.series.episodeCount} episodios assistidos</p>
            <Insight>{slide.insight}</Insight>
          </div>
        </div>
      );

    case "favorite-genre":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground variant="cool" />
          <Eyebrow>Seu genero favorito</Eyebrow>
          <h2 className="mt-3 font-display text-6xl font-black text-ink sm:text-7xl">{slide.genre}</h2>
          <p className="mt-3 text-2xl font-bold text-primary-text">{slide.percentage}% do seu ano</p>
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "platform-language-country":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground />
          <Eyebrow>Onde e como voce assistiu</Eyebrow>
          <div className="mt-8 flex flex-col gap-6">
            {slide.platform ? (
              <div>
                <p className="font-display text-4xl font-black text-ink">{slide.platform}</p>
                <p className="text-xs text-subtle">plataforma favorita</p>
              </div>
            ) : null}
            {slide.language ? (
              <div>
                <p className="text-2xl font-bold text-ink">{slide.language}</p>
                <p className="text-xs text-subtle">idioma predominante</p>
              </div>
            ) : null}
            {slide.country ? (
              <div>
                <p className="text-2xl font-bold text-ink">{slide.country}</p>
                <p className="text-xs text-subtle">pais predominante</p>
              </div>
            ) : null}
          </div>
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "biggest-binge":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground variant="warm" />
          <span className="flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-danger/15 text-danger-text">
            <FlameIcon className="h-8 w-8" />
          </span>
          <Eyebrow>Sua maior maratona</Eyebrow>
          <p className="mt-3 font-display text-7xl font-black text-ink sm:text-8xl">
            <StatCounter value={slide.episodeCount} />
          </p>
          <p className="mt-1 text-xl text-muted">episodios em um unico dia</p>
          {slide.longestStreakDays > 1 ? <p className="mt-2 text-sm text-subtle">Maior sequencia: {slide.longestStreakDays} dias seguidos</p> : null}
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "habits":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground variant="cool" />
          <Eyebrow>Seus habitos</Eyebrow>
          <div className="mt-8 flex flex-col gap-6">
            {slide.favoriteWeekday ? (
              <div>
                <p className="font-display text-4xl font-black text-ink">{slide.favoriteWeekday}</p>
                <p className="text-xs text-subtle">dia da semana favorito</p>
              </div>
            ) : null}
            {slide.favoriteHour ? (
              <div>
                <p className="text-2xl font-bold text-ink">{slide.favoriteHour}</p>
                <p className="text-xs text-subtle">horario favorito</p>
              </div>
            ) : null}
            {slide.activeMonth ? (
              <div>
                <p className="text-2xl font-bold text-ink">{slide.activeMonth}</p>
                <p className="text-xs text-subtle">mes mais ativo</p>
              </div>
            ) : null}
          </div>
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "persona":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground />
          <WrappedParticles />
          <span className="flex h-24 w-24 animate-scale-in items-center justify-center rounded-full border-2 border-primary/50 bg-primary/15 text-5xl">
            {slide.persona.emoji}
          </span>
          <Eyebrow>Seu perfil de espectador</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-black text-ink sm:text-6xl">{slide.persona.title}</h2>
          <Insight>{slide.persona.description}</Insight>
        </div>
      );

    case "comparison":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground variant="cool" />
          <span className="flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-primary/15 text-primary-text">
            <TrophyIcon className="h-8 w-8" />
          </span>
          <Eyebrow>Como voce se compara</Eyebrow>
          {slide.growthPercent !== null ? (
            <p className="mt-3 font-display text-6xl font-black text-ink sm:text-7xl">
              {slide.growthPercent >= 0 ? "+" : ""}
              {slide.growthPercent}%
            </p>
          ) : slide.percentile !== null ? (
            <p className="mt-3 font-display text-6xl font-black text-ink sm:text-7xl">Top {Math.max(1, 100 - slide.percentile)}%</p>
          ) : null}
          <Insight>{slide.insight}</Insight>
        </div>
      );

    case "thanks":
      return (
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <AmbientBackground />
          <WrappedParticles />
          <span className="flex h-20 w-20 animate-scale-in items-center justify-center rounded-3xl bg-primary text-3xl font-black text-primary-foreground">
            <SparklesIcon className="h-10 w-10" />
          </span>
          <h2 className="mt-6 animate-fade-in-up font-display text-4xl font-black tracking-tight text-ink sm:text-6xl">Sua retrospectiva {slide.year} terminou.</h2>
          <p className="mt-4 max-w-md animate-fade-in text-lg text-muted">Obrigado por passar o ano com o inSeries. Ate a proxima retrospectiva.</p>
        </div>
      );

    case "share":
      return (
        <div className="relative flex h-full flex-col items-center justify-center gap-8 text-center">
          <AmbientBackground variant="warm" />
          <div>
            <Eyebrow>Compartilhe seu ano</Eyebrow>
            <h2 className="mt-3 font-display text-4xl font-black text-ink sm:text-5xl">Seu card ja esta pronto.</h2>
            <p className="mt-3 max-w-sm text-sm text-muted">Escolha o formato e compartilhe direto nas suas redes — sem precisar editar nada.</p>
          </div>
          <WrappedShareButton year={slide.year} />
          <Link href="/me/stats" className="link-accent text-sm">
            Ver todas as minhas estatisticas
          </Link>
        </div>
      );

    default:
      return null;
  }
}
