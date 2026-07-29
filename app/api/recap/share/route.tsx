import { ImageResponse } from "next/og";
import { getApiUser } from "@/lib/auth/server";
import { canAccessRecapWrapped } from "@/lib/recap/window";
import { getWrappedData } from "@/lib/recap/wrapped-service";

export const runtime = "nodejs";

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
 * INSERIES-RECAP-ENGINE-01 — "gerar automaticamente um card final... o card ja deve estar
 * pronto." Uses the favorite series' backdrop as a full-bleed background when available (the
 * one real differentiator vs. the Stats share card) — falls back to the same ambient-gradient
 * look when there's no favorite series yet.
 */
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!canAccessRecapWrapped(user.role === "ADMIN")) {
    return new Response("not_found", { status: 404 });
  }

  const url = new URL(request.url);
  const yearParam = Number(url.searchParams.get("year"));
  const formatParam = url.searchParams.get("format");
  const format: ShareFormat = isShareFormat(formatParam) ? formatParam : "stories";
  const { width, height } = FORMATS[format];
  const compact = format !== "stories";

  const data = Number.isInteger(yearParam) ? await getWrappedData(user.id, yearParam) : null;
  if (!data) {
    return new Response("not_found", { status: 404 });
  }

  const statEntries = [
    { icon: "🎬", label: "Episodios", value: String(data.shareStats.episodesWatched) },
    { icon: "⏱️", label: "Horas assistidas", value: `${data.shareStats.hoursWatched}h` },
    data.shareStats.favoriteGenre ? { icon: "🎭", label: "Genero favorito", value: data.shareStats.favoriteGenre } : null,
    data.shareStats.favoriteSeriesTitle ? { icon: "⭐", label: "Serie favorita", value: data.shareStats.favoriteSeriesTitle } : null,
    data.shareStats.biggestBingeEpisodeCount
      ? { icon: "🔥", label: "Maior maratona", value: `${data.shareStats.biggestBingeEpisodeCount} ep.` }
      : null
  ]
    .filter((entry): entry is { icon: string; label: string; value: string } => entry !== null)
    .slice(0, compact ? 4 : 5);

  const backdropUrl = data.favoriteSeries?.backdropUrl ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          padding: compact ? 56 : 72,
          backgroundColor: "#0b0f1a",
          color: "#f4f4f5",
          fontFamily: "sans-serif"
        }}
      >
        {backdropUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backdropUrl}
            alt=""
            width={width}
            height={height}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: backdropUrl
              ? "linear-gradient(to top, #0b0f1a 15%, rgba(11,15,26,0.6) 55%, rgba(11,15,26,0.85) 100%)"
              : "radial-gradient(circle at 15% 10%, rgba(249,115,22,0.4), transparent 45%)"
          }}
        />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
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
          <span style={{ fontSize: 26, color: "#f4f4f5", fontWeight: 700, letterSpacing: 2 }}>inSeries RECAP {data.year}</span>
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, marginTop: compact ? 40 : 64 }}>
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
            {data.persona.emoji}
          </div>
          <span style={{ fontSize: compact ? 46 : 60, fontWeight: 900, lineHeight: 1.1 }}>{data.persona.title}</span>
        </div>

        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 16, marginTop: compact ? 40 : 56 }}>
          {statEntries.map((entry) => (
            <div
              key={entry.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                width: compact ? "47%" : "31%",
                padding: compact ? 20 : 24,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)"
              }}
            >
              <span style={{ fontSize: compact ? 28 : 32 }}>{entry.icon}</span>
              <span style={{ fontSize: compact ? 28 : 36, fontWeight: 800, marginTop: 4 }}>{entry.value}</span>
              <span style={{ fontSize: compact ? 16 : 18, color: "#d4d4d8" }}>{entry.label}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            marginTop: "auto",
            paddingTop: 32,
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.14)"
          }}
        >
          <span style={{ fontSize: compact ? 18 : 22, color: "#d4d4d8" }}>Meu Recap {data.year}</span>
          <span style={{ fontSize: compact ? 18 : 22, color: "#f97316", fontWeight: 700 }}>in-series.vercel.app</span>
        </div>
      </div>
    ),
    { width, height }
  );
}
