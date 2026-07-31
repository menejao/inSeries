import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PublicationStatusBadge, IntegrationNotActiveWarning } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { publicationRepo } from "@/packages/social-automation/src/db/publication-repo";
import { formatForDate } from "@/packages/social-automation/src/content-engine/editorial-calendar";
import { computeNextRun } from "@/packages/social-automation/src/scheduler";
import { noNetworkIsConfigured } from "@/packages/social-automation/src/publisher/status";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

function monthStart(year: number, month: number) {
  return new Date(year, month, 1);
}

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — calendario mensal.
 *
 * Two package calls: `formatForDate` (editorial-calendar.ts) for the format each day is scheduled
 * to produce, and `publicationRepo.listBetween` for the publications actually scheduled in the
 * month. The grid maths below is pure date arithmetic for layout, not scheduling logic.
 */
export default async function AdminSocialCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdminUser("admin.social");
  const { month } = await searchParams;

  const today = new Date();
  const parsed = month && /^\d{4}-\d{2}$/.test(month) ? month.split("-").map(Number) : null;
  const year = parsed ? parsed[0] : today.getFullYear();
  const monthIndex = parsed ? parsed[1] - 1 : today.getMonth();

  const from = monthStart(year, monthIndex);
  const to = monthStart(year, monthIndex + 1);

  const publications = await publicationRepo.listBetween(from, to);
  const nextRun = computeNextRun(today);
  const anyNetworkConfigured = !noNetworkIsConfigured();

  // Group publications by day-of-month for O(1) lookup while rendering the grid.
  const byDay = new Map<number, typeof publications>();
  for (const publication of publications) {
    const day = publication.scheduledFor.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), publication]);
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingBlanks = from.getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  const previousMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const monthParam = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Calendario" description="Formato previsto por dia (calendario editorial) e publicacoes realmente agendadas." />

      <IntegrationNotActiveWarning anyNetworkConfigured={anyNetworkConfigured} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold capitalize text-ink">{MONTH_FORMAT.format(from)}</p>
        <div className="flex gap-2">
          <Link href={`/admin/social/calendario?month=${monthParam(previousMonth)}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Mes anterior
          </Link>
          <Link href="/admin/social/calendario" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Hoje
          </Link>
          <Link href={`/admin/social/calendario?month=${monthParam(nextMonth)}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Proximo mes
          </Link>
        </div>
      </Card>

      <Card padding="sm" className="space-y-1">
        <p className="text-sm font-semibold text-ink">Proxima geracao prevista</p>
        <p className="text-sm text-muted">
          {nextRun.toLocaleString("pt-BR")} · formato <Badge variant="secondary">{formatForDate(nextRun)}</Badge>
        </p>
      </Card>

      <Card padding="sm">
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-subtle">
              {label}
            </div>
          ))}

          {cells.map((day, index) => {
            if (day === null) return <div key={`blank-${index}`} />;

            const date = new Date(year, monthIndex, day);
            const isToday =
              day === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear();
            const dayPublications = byDay.get(day) ?? [];

            return (
              <div
                key={day}
                className={`min-h-24 rounded-2xl border p-2 ${isToday ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
              >
                <p className="text-xs font-semibold text-ink">{day}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-subtle">{formatForDate(date)}</p>
                <div className="mt-1 space-y-1">
                  {dayPublications.map((publication) => (
                    <Link
                      key={publication.id}
                      href={`/admin/social/conteudos/${publication.contentId}`}
                      className="block truncate rounded-lg bg-surface-strong px-1.5 py-1 text-[10px] text-muted hover:text-ink"
                      title={publication.content.title}
                    >
                      {publication.content.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Publicacoes agendadas neste mes</p>
        {publications.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma publicacao agendada neste periodo.</p>
        ) : (
          <ul className="space-y-2">
            {publications.map((publication) => (
              <li key={publication.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-subtle">{publication.scheduledFor.toLocaleString("pt-BR")}</span>
                <PublicationStatusBadge status={publication.status} />
                <Badge variant="outline">{publication.network}</Badge>
                <Link href={`/admin/social/conteudos/${publication.contentId}`} className="text-muted hover:text-ink hover:underline">
                  {publication.content.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
