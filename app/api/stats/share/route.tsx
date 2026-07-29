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

/**
 * "Gerar automaticamente cards prontos para... redes sociais" — a real generated image (not
 * just a shared link) covering the info the ticket asks for (episodios/horas/dias/genero/
 * serie favorita/sequencia + branding). No avatar/name: this is a server-rendered image with
 * no access to the browser's rendered avatar, and the user explicitly asked to drop the
 * avatar from the hero too — the card leans on the numbers + persona instead.
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
  const compact = format === "square";

  const stats = await getStatsPageData(user.id);

  const statEntries = [
    { label: "Horas assistidas", value: `${stats.watchTime.hoursWatched}h` },
    { label: "Episodios assistidos", value: String(stats.overview.episodesWatched) },
    { label: "Dias da sua vida", value: `${stats.watchTime.daysWatched} dias` },
    stats.genres.topGenre ? { label: "Genero favorito", value: stats.genres.topGenre.genre } : null,
    stats.rankings.topSeries[0] ? { label: "Serie favorita", value: stats.rankings.topSeries[0].label } : null,
    { label: "Sequencia atual", value: `${stats.streaks.currentStreakDays} dias` }
  ]
    .filter((entry): entry is { label: string; value: string } => entry !== null)
    .slice(0, compact ? 4 : 6);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: compact ? 60 : 80,
          backgroundColor: "#0b0f1a",
          backgroundImage: "radial-gradient(circle at 20% 15%, rgba(249,115,22,0.35), transparent 55%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: compact ? 24 : 32, color: "#f97316", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
            inSeries
          </span>
          <span style={{ fontSize: compact ? 52 : 72, fontWeight: 900, lineHeight: 1.1 }}>
            {stats.persona.emoji} {stats.persona.title}
          </span>
          <span style={{ fontSize: compact ? 24 : 32, color: "#a1a1aa", maxWidth: 800 }}>{stats.persona.description}</span>
        </div>

        <div style={{ display: "flex", flexDirection: compact ? "row" : "column", flexWrap: "wrap", gap: compact ? 32 : 28 }}>
          {statEntries.map((entry) => (
            <div key={entry.label} style={{ display: "flex", flexDirection: "column", width: compact ? "40%" : "100%" }}>
              <span style={{ fontSize: compact ? 22 : 28, color: "#a1a1aa" }}>{entry.label}</span>
              <span style={{ fontSize: compact ? 40 : 56, fontWeight: 800 }}>{entry.value}</span>
            </div>
          ))}
        </div>

        <span style={{ fontSize: compact ? 20 : 24, color: "#71717a" }}>in-series.vercel.app</span>
      </div>
    ),
    { width, height }
  );
}
