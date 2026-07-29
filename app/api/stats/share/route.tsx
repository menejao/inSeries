import { ImageResponse } from "next/og";
import { getApiUser } from "@/lib/auth/server";
import { getStatsPageData } from "@/lib/stats";

export const runtime = "nodejs";

/** INSERIES-STATISTICS-ENGINE-01 — "o usuario escolhe... o formato que ele escolher": one shareable card per common social layout, picked via `?format=`. */
const FORMATS = {
  stories: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 }
} as const;

type ShareFormat = keyof typeof FORMATS;

function isShareFormat(value: string | null): value is ShareFormat {
  return value === "stories" || value === "feed" || value === "square";
}

type StatEntry = { icon: string; label: string; value: string };

/**
 * "Gerar automaticamente cards prontos para... redes sociais" — a real generated image (not
 * just a shared link) with real visual design (icon tiles, brand mark, persona badge), not a
 * bare list of labels floating in empty space. No avatar/name: server-rendered image with no
 * access to the browser's rendered avatar, and the hero itself dropped the avatar too.
 */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const formatParam = url.searchParams.get("format");
  const format: ShareFormat = isShareFormat(formatParam) ? formatParam : "stories";
  const { width, height } = FORMATS[format];
  const compact = format !== "stories";

  const stats = await getStatsPageData(user.id);

  const statEntries: StatEntry[] = [
    { icon: "⏱️", label: "Horas assistidas", value: `${stats.watchTime.hoursWatched}h` },
    { icon: "🎬", label: "Episodios", value: String(stats.overview.episodesWatched) },
    { icon: "📅", label: "Dias da sua vida", value: `${stats.watchTime.daysWatched}` },
    stats.genres.topGenre ? { icon: "🎭", label: "Genero favorito", value: stats.genres.topGenre.genre } : null,
    stats.rankings.topSeries[0] ? { icon: "⭐", label: "Serie favorita", value: stats.rankings.topSeries[0].label } : null,
    { icon: "🔥", label: "Sequencia atual", value: `${stats.streaks.currentStreakDays} dias` }
  ].filter((entry): entry is StatEntry => entry !== null);

  const gridEntries = compact ? statEntries.slice(0, 4) : statEntries;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: compact ? 56 : 72,
          backgroundColor: "#0b0f1a",
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(249,115,22,0.4), transparent 45%), radial-gradient(circle at 90% 85%, rgba(249,115,22,0.15), transparent 40%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif"
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "#f97316",
              fontSize: 26,
              fontWeight: 900,
              color: "#0b0f1a"
            }}
          >
            in
          </div>
          <span style={{ fontSize: 26, color: "#f4f4f5", fontWeight: 700, letterSpacing: 2 }}>inSeries</span>
        </div>

        {/* Persona */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: compact ? 40 : 64 }}>
          <div
            style={{
              display: "flex",
              width: compact ? 90 : 110,
              height: compact ? 90 : 110,
              borderRadius: "50%",
              backgroundColor: "rgba(249,115,22,0.18)",
              border: "2px solid rgba(249,115,22,0.5)",
              alignItems: "center",
              justifyContent: "center",
              fontSize: compact ? 46 : 56
            }}
          >
            {stats.persona.emoji}
          </div>
          <span style={{ fontSize: compact ? 46 : 60, fontWeight: 900, lineHeight: 1.1 }}>{stats.persona.title}</span>
          <span style={{ fontSize: compact ? 22 : 26, color: "#a1a1aa", maxWidth: 820, lineHeight: 1.4 }}>{stats.persona.description}</span>
        </div>

        {/* Stat grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: compact ? 40 : 56 }}>
          {gridEntries.map((entry) => (
            <div
              key={entry.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: compact ? "47%" : "31%",
                padding: compact ? 20 : 24,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)"
              }}
            >
              <span style={{ fontSize: compact ? 28 : 32 }}>{entry.icon}</span>
              <span style={{ fontSize: compact ? 30 : 38, fontWeight: 800, marginTop: 4 }}>{entry.value}</span>
              <span style={{ fontSize: compact ? 16 : 18, color: "#a1a1aa" }}>{entry.label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: 32,
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <span style={{ fontSize: compact ? 18 : 22, color: "#71717a" }}>Meu perfil de espectador</span>
          <span style={{ fontSize: compact ? 18 : 22, color: "#f97316", fontWeight: 700 }}>in-series.vercel.app</span>
        </div>
      </div>
    ),
    { width, height }
  );
}
