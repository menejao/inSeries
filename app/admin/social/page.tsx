import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SocialActionButton } from "@/components/admin/social/social-action-button";
import { AutomationToggle } from "@/components/admin/social/automation-toggle";
import { ContentStatusBadge, IntegrationNotActiveWarning, formatDateTime } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { getSocialOverview } from "@/packages/social-automation/src/overview";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Array<[string, string]> = [
  ["DRAFT", "Rascunhos"],
  ["PENDING_APPROVAL", "Aguardando revisao"],
  ["APPROVED", "Aprovados"],
  ["REJECTED", "Rejeitados"],
  ["PUBLISHED", "Publicados"],
  ["FAILED", "Falharam"],
  ["ARCHIVED", "Arquivados"]
];

/** INSERIES-SOCIAL-ADMIN-PANEL-03 — Visao geral. One await into the package's overview aggregate. */
export default async function AdminSocialOverviewPage() {
  await requireAdminUser("admin.social");
  const overview = await getSocialOverview();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Automacao Social" description="Acompanhe e revise o conteudo gerado automaticamente para as redes sociais." />

      <IntegrationNotActiveWarning anyNetworkConfigured={overview.anyNetworkConfigured} />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">Estado da automacao</p>
          <p className="text-xs text-muted">
            Modo <strong>{overview.mode}</strong> · ambiente <strong>{overview.environment}</strong> · horarios{" "}
            <strong>{overview.scheduleTimes.join(", ")}</strong>
          </p>
        </div>
        <AutomationToggle paused={overview.pauseState.paused} reason={overview.pauseState.reason} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_LABELS.map(([status, label]) => (
          <Card key={status} padding="sm" className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-subtle">{label}</p>
            <p className="text-2xl font-semibold text-ink">{overview.contentCounts[status as keyof typeof overview.contentCounts]}</p>
            <Link
              href={`/admin/social/conteudos?status=${status}`}
              className="inline-block text-xs font-medium text-primary-text hover:underline"
            >
              Ver conteudos
            </Link>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Proxima geracao</p>
          <p className="text-lg text-ink">{formatDateTime(overview.nextRun.at)}</p>
          <p className="text-xs text-muted">
            Formato previsto pelo calendario editorial: <Badge variant="secondary">{overview.nextRun.format}</Badge>
          </p>
          <p className="text-xs text-subtle">
            Calculado por scheduler.computeNextRun(). Nenhum cron esta ligado a este pacote — a geracao acontece quando
            disparada manualmente.
          </p>
        </Card>

        <Card className="space-y-3">
          <p className="text-sm font-semibold text-ink">Acoes rapidas</p>
          <div className="flex flex-wrap gap-3">
            <SocialActionButton
              endpoint="/api/admin/social/generate"
              label="Gerar conteudo agora"
              variant="primary"
              size="sm"
              confirmTitle="Gerar conteudo agora?"
              confirmMessage="Executa a mesma selecao de topico do comando de CLI e cria um novo rascunho para revisao."
              successMessage="Conteudo gerado"
              disabled={overview.pauseState.paused}
            />
            <Link href="/admin/social/conteudos?status=PENDING_APPROVAL" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Revisar pendentes ({overview.pendingReviewCount})
            </Link>
            <Link href="/admin/social/calendario" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ver calendario
            </Link>
          </div>
          {overview.pauseState.paused ? (
            <p className="text-xs text-warning-text">A automacao esta pausada — a geracao manual esta bloqueada.</p>
          ) : null}
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Status das redes</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {overview.networks.map((network) => (
            <div key={network.network} className="rounded-2xl border border-border px-4 py-3">
              <p className="text-sm font-medium capitalize text-ink">{network.network}</p>
              <p className="mt-1 text-xs text-muted">
                <Badge variant={network.configured ? "success" : "warning"}>{network.label}</Badge>
              </p>
              <p className="mt-1 text-xs text-subtle">Publisher: {network.publisherName}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Atividade recente</p>
          <Link href="/admin/social/historico" className="text-xs font-medium text-primary-text hover:underline">
            Ver historico completo
          </Link>
        </div>
        {overview.recentHistory.length === 0 ? (
          <p className="text-sm text-muted">Nenhum evento registrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {overview.recentHistory.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-subtle">{formatDateTime(event.createdAt)}</span>
                <Badge variant="outline">{event.action}</Badge>
                {event.content ? (
                  <Link href={`/admin/social/conteudos/${event.content.id}`} className="text-muted hover:text-ink hover:underline">
                    {event.content.title}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="sm" className="space-y-2">
        <p className="text-sm font-semibold text-ink">Conteudos por status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_LABELS.map(([status]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <ContentStatusBadge status={status} />
              <span className="text-xs text-muted">{overview.contentCounts[status as keyof typeof overview.contentCounts]}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
