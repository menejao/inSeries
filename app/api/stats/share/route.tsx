import { ImageResponse } from "next/og";
import { getApiUser } from "@/lib/auth/server";
import { getStatsPageData } from "@/lib/stats";

export const runtime = "nodejs";

/**
 * INSERIES-STATISTICS-ENGINE-01 — "gerar automaticamente cards prontos para... redes
 * sociais." One polished, story-ratio (1080x1920) shareable image covering every network
 * (screenshots/native share sheets don't need per-platform variants) rather than six
 * hand-tuned renders — avatar/name are deliberately omitted (this is a server-generated
 * image with no access to the browser's rendered avatar without an extra fetch), so it
 * leans on the numbers + persona, matching what `ShareButton` already sends as share text.
 */
export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const stats = await getStatsPageData(user.id);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: "#0b0f1a",
          backgroundImage: "radial-gradient(circle at 20% 15%, rgba(249,115,22,0.35), transparent 55%)",
          color: "#f4f4f5",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 32, color: "#f97316", fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>inSeries</span>
          <span style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.1 }}>
            {stats.persona.emoji} {stats.persona.title}
          </span>
          <span style={{ fontSize: 32, color: "#a1a1aa", maxWidth: 800 }}>{stats.persona.description}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <Stat label="Horas assistidas" value={`${stats.watchTime.hoursWatched}h`} />
          <Stat label="Episodios assistidos" value={String(stats.overview.episodesWatched)} />
          <Stat label="Dias da sua vida" value={`${stats.watchTime.daysWatched} dias`} />
          {stats.genres.topGenre ? <Stat label="Genero favorito" value={stats.genres.topGenre.genre} /> : null}
          {stats.rankings.topSeries[0] ? <Stat label="Serie favorita" value={stats.rankings.topSeries[0].label} /> : null}
          <Stat label="Sequencia atual" value={`${stats.streaks.currentStreakDays} dias`} />
        </div>

        <span style={{ fontSize: 24, color: "#71717a" }}>in-series.vercel.app</span>
      </div>
    ),
    { width: 1080, height: 1920 }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 28, color: "#a1a1aa" }}>{label}</span>
      <span style={{ fontSize: 56, fontWeight: 800 }}>{value}</span>
    </div>
  );
}
