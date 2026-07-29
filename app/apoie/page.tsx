import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PixCheckout } from "@/components/supporters/pix-checkout";
import { PollCard } from "@/components/supporters/poll-card";
import { SupporterBadge } from "@/components/supporters/supporter-badge";
import { SupporterPreferences } from "@/components/supporters/supporter-preferences";
import { requireUser } from "@/lib/auth/server";
import { canAccessSupporterProgram } from "@/lib/supporters/access";
import { getSupporterStatus } from "@/lib/supporters/status";
import { getLatestSupportRequest } from "@/lib/supporters/service";
import { buildPixPayload } from "@/lib/supporters/pix";
import { listActivePolls } from "@/lib/supporters/polls";
import { prisma } from "@/lib/db/prisma";
import { config } from "@/lib/config";

const RESUMABLE_STATUSES = new Set(["PENDING_PAYMENT", "AWAITING_REVIEW"]);

/**
 * INSERIES-SUPPORTER-ACTIVATION-01 — "Apoie o inSeries": comunicacao simples/acolhedora, nunca
 * menciona custos/servidores/metas financeiras (foco na comunidade). Admin-only por enquanto
 * (canAccessSupporterProgram) — usuarios comuns recebem 404 real, mesma postura de
 * /recap (INSERIES-RECAP-ENGINE-01): quando `config.featureFlags.supporterPublicLaunch` virar
 * true, essa mesma pagina abre pra todo mundo sem nenhuma outra mudanca.
 *
 * Ativacao dos beneficios NUNCA acontece aqui — so via aprovacao manual de um administrador
 * (ver lib/supporters/admin.ts). Esta pagina so cria a solicitacao e recebe o comprovante.
 */
export default async function SupportPage() {
  const user = await requireUser();
  if (!canAccessSupporterProgram(user.role)) notFound();

  const [fullUser, supporterStatus, latestRequest] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { showSupporterBadge: true, supporterBannerStyle: true, supporterFrameStyle: true }
    }),
    getSupporterStatus(user.id),
    getLatestSupportRequest(user.id)
  ]);

  const polls = supporterStatus.active ? await listActivePolls(user.id) : [];

  // A resumable request re-derives its PIX payload deterministically (amountCents + pixTxId are
  // persisted; the payload itself never is) so a page reload never loses the in-progress QR code.
  const resumableRequest =
    latestRequest && RESUMABLE_STATUSES.has(latestRequest.status)
      ? {
          id: latestRequest.id,
          status: latestRequest.status as "PENDING_PAYMENT" | "AWAITING_REVIEW",
          amountCents: latestRequest.amountCents,
          receiptUrl: latestRequest.receiptUrl,
          pixPayload: buildPixPayload({
            pixKey: config.supporters.pixKey,
            receiverName: config.supporters.receiverName,
            receiverCity: config.supporters.receiverCity,
            amount: latestRequest.amountCents / 100,
            txId: latestRequest.pixTxId
          })
        }
      : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-3 text-center">
        {!config.featureFlags.supporterPublicLaunch ? (
          <Badge variant="default" className="mx-auto">
            Preview — apenas administradores
          </Badge>
        ) : null}
        <h1 className="font-display text-3xl font-black text-ink">Apoie o inSeries</h1>
        <p className="mx-auto max-w-lg text-sm leading-6 text-muted">
          O inSeries e um projeto independente que evolui constantemente. Se voce gosta da plataforma e deseja apoiar seu
          crescimento, torne-se um Apoiador e faca parte dessa jornada.
        </p>
        {supporterStatus.active ? (
          <div className="flex justify-center">
            <SupporterBadge />
          </div>
        ) : null}
      </div>

      <PixCheckout resumableRequest={resumableRequest} />

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Beneficios</h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>❤️ Badge exclusivo de Apoiador, visivel no perfil, reviews, comentarios e listas</li>
          <li>✨ Destaque visual discreto no nome</li>
          <li>🎨 Personalizacao cosmetica extra (banner e moldura de avatar)</li>
          <li>🧪 Acesso antecipado ao programa Beta de novas funcionalidades</li>
          <li>🗳️ Enquetes exclusivas para opinar sobre o futuro do inSeries</li>
        </ul>
        <p className="text-xs text-subtle">Todos os valores recebem exatamente os mesmos beneficios — nunca bloqueamos funcionalidades essenciais da plataforma.</p>
      </Card>

      {supporterStatus.active ? (
        <>
          <SupporterPreferences
            showSupporterBadge={fullUser.showSupporterBadge}
            supporterBannerStyle={fullUser.supporterBannerStyle}
            supporterFrameStyle={fullUser.supporterFrameStyle}
          />

          {polls.length ? (
            <section className="space-y-3">
              <h2 className="section-title">Enquetes</h2>
              <div className="space-y-3">
                {polls.map((poll) => (
                  <PollCard key={poll.id} poll={poll} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
