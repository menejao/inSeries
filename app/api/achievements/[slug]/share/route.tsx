import { ImageResponse } from "next/og";
import { getApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { RARITY_LABELS } from "@/lib/gamification";
import type { AchievementRarity } from "@/lib/gamification";

export const runtime = "nodejs";

const RARITY_ACCENT: Record<AchievementRarity, string> = {
  COMMON: "#94a3b8",
  RARE: "#38bdf8",
  EPIC: "#f97316",
  LEGENDARY: "#facc15"
};

/**
 * INSERIES-ACHIEVEMENTS-REDESIGN-01 — "ao desbloquear uma conquista, permitir compartilhar...
 * criar cards proprios para compartilhamento". So gera a imagem se o usuario autenticado
 * realmente desbloqueou essa conquista (nunca revela o card de uma conquista que o visitante
 * nao tem) — mesmo padrao de auth de app/api/stats/share/route.tsx.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getApiUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const { slug } = await params;
  const achievement = await prisma.achievement.findUnique({ where: { slug } });
  if (!achievement) return new Response("not_found", { status: 404 });

  const unlock = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } }
  });
  if (!unlock) return new Response("not_unlocked", { status: 403 });

  const accent = RARITY_ACCENT[achievement.rarity];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 72,
          backgroundColor: "#0b0f1a",
          backgroundImage: `radial-gradient(circle at 50% 20%, ${accent}33, transparent 55%)`,
          color: "#f4f4f5",
          fontFamily: "sans-serif",
          textAlign: "center"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 56 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "#f97316",
              fontSize: 22,
              fontWeight: 900,
              color: "#0b0f1a"
            }}
          >
            in
          </div>
          <span style={{ fontSize: 22, color: "#f4f4f5", fontWeight: 700, letterSpacing: 2 }}>inSeries</span>
        </div>

        <div
          style={{
            display: "flex",
            width: 220,
            height: 220,
            borderRadius: "50%",
            backgroundColor: `${accent}22`,
            border: `4px solid ${accent}`,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 100,
            boxShadow: `0 0 60px ${accent}55`
          }}
        >
          🏆
        </div>

        <span
          style={{
            marginTop: 40,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            color: accent,
            textTransform: "uppercase"
          }}
        >
          {RARITY_LABELS[achievement.rarity]}
        </span>
        <span style={{ marginTop: 12, fontSize: 56, fontWeight: 900, lineHeight: 1.15, maxWidth: 820 }}>{achievement.name}</span>
        <span style={{ marginTop: 18, fontSize: 26, color: "#a1a1aa", maxWidth: 760, lineHeight: 1.4 }}>{achievement.description}</span>
        <span style={{ marginTop: 32, fontSize: 24, color: "#f4f4f5", fontWeight: 700 }}>+{achievement.points} pontos</span>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
