import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { formatDateTime } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { historyRepo } from "@/packages/social-automation/src/db/history-repo";
import { sanitizedJsonString } from "@/packages/social-automation/src/history/sanitize";
import type { SocialAutomationAction } from "@prisma/client";

export const dynamic = "force-dynamic";

const ACTIONS: SocialAutomationAction[] = [
  "CONTENT_GENERATED",
  "TEMPLATE_RENDERED",
  "MEDIA_GENERATED",
  "PUBLISH_ATTEMPTED",
  "PUBLISH_SUCCEEDED",
  "PUBLISH_FAILED",
  "RETRY_SCHEDULED",
  "CONTENT_SELECTION_STARTED",
  "CONTENT_CANDIDATES_ANALYZED",
  "CONTENT_TOPIC_SELECTED",
  "CONTENT_FALLBACK_APPLIED",
  "CONTENT_REJECTED_SAFETY",
  "CONTENT_SUBMITTED_FOR_APPROVAL",
  "CONTENT_APPROVED",
  "CONTENT_REJECTED"
];

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — timeline de SocialAutomationHistory.
 *
 * Every `detail` blob is rendered through the package's sanitizedJsonString, which redacts any
 * key that looks like a credential (token/secret/apiKey/...). Nothing in this package writes such
 * a value today; the redaction is there so a future real publisher cannot turn a stray log into an
 * admin-visible leak.
 */
export default async function AdminSocialHistoryPage({
  searchParams
}: {
  searchParams: Promise<{ action?: string; contentId?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdminUser("admin.social");
  const params = await searchParams;

  const page = Number(params.page ?? "1");
  const [result, counts] = await Promise.all([
    historyRepo.listPaginated({
      action: ACTIONS.includes(params.action as SocialAutomationAction) ? (params.action as SocialAutomationAction) : null,
      contentId: params.contentId || null,
      from: parseDate(params.from),
      to: parseDate(params.to),
      page: Number.isFinite(page) ? page : 1,
      perPage: 50
    }),
    historyRepo.countsByAction()
  ]);

  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(target));
    return `/admin/social/historico?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Historico" description="Toda acao registrada pelo pacote de automacao social." />

      <Card padding="sm" className="flex flex-wrap gap-2">
        {counts.slice(0, 10).map((entry) => (
          <Badge key={entry.action} variant="outline">
            {entry.action}: {entry.count}
          </Badge>
        ))}
      </Card>

      <Card as="form" method="get" padding="sm" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Select name="action" defaultValue={params.action ?? ""} aria-label="Acao">
          <option value="">Todas as acoes</option>
          {ACTIONS.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </Select>
        <Input type="date" name="from" defaultValue={params.from ?? ""} aria-label="Data inicial" />
        <Input type="date" name="to" defaultValue={params.to ?? ""} aria-label="Data final" />
        <div className="flex gap-2">
          <Button type="submit">Filtrar</Button>
          <Link href="/admin/social/historico" className={buttonVariants({ variant: "ghost" })}>
            Limpar
          </Link>
        </div>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado" copy="Ajuste os filtros para ver o historico." />
      ) : (
        <>
          <Card className="space-y-4">
            <ol className="space-y-4 border-l border-border pl-4">
              {result.items.map((event) => (
                <li key={event.id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{event.action}</Badge>
                    <span className="text-xs text-subtle">{formatDateTime(event.createdAt)}</span>
                    {event.content ? (
                      <Link href={`/admin/social/conteudos/${event.content.id}`} className="text-sm text-muted hover:text-ink hover:underline">
                        {event.content.title}
                      </Link>
                    ) : null}
                  </div>
                  {event.detail ? (
                    <pre className="overflow-x-auto rounded-2xl bg-surface-strong p-3 text-xs text-muted">
                      {sanitizedJsonString(event.detail)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {result.total} evento(s) · pagina {result.page} de {result.pageCount}
            </p>
            <div className="flex gap-2">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Anterior
                </Link>
              ) : null}
              {result.page < result.pageCount ? (
                <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Proxima
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
