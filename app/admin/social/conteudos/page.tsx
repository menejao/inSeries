import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/ui/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContentStatusBadge, formatDateTime } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { contentRepo } from "@/packages/social-automation/src/db/content-repo";
import { templateRepo } from "@/packages/social-automation/src/db/template-repo";
import type { SocialContentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: SocialContentStatus[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PUBLISHED", "FAILED", "ARCHIVED"];
const NETWORKS = ["INSTAGRAM"];
const SORTS: Array<{ value: string; label: string }> = [
  { value: "createdAt:desc", label: "Mais recentes" },
  { value: "createdAt:asc", label: "Mais antigos" },
  { value: "updatedAt:desc", label: "Atualizados recentemente" },
  { value: "title:asc", label: "Titulo (A-Z)" }
];

type SearchParams = {
  status?: string;
  format?: string;
  templateId?: string;
  network?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — listagem de conteudos.
 *
 * Server Component + searchParams (the pattern used by /admin/users), delegating the whole query
 * to contentRepo.listPaginated. This file only maps query-string values onto that filter object; the
 * where/orderBy/skip/take live in the package's data layer.
 */
export default async function AdminSocialContentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminUser("admin.social");
  const params = await searchParams;

  const [sortBy, sortDir] = (params.sort ?? "createdAt:desc").split(":");
  const page = Number(params.page ?? "1");

  const [result, templates, formats] = await Promise.all([
    contentRepo.listPaginated({
      status: STATUSES.includes(params.status as SocialContentStatus) ? (params.status as SocialContentStatus) : null,
      format: params.format || null,
      templateId: params.templateId || null,
      network: params.network || null,
      search: params.q || null,
      from: parseDate(params.from),
      to: parseDate(params.to),
      sortBy: (["createdAt", "updatedAt", "title"].includes(sortBy) ? sortBy : "createdAt") as "createdAt" | "updatedAt" | "title",
      sortDir: sortDir === "asc" ? "asc" : "desc",
      page: Number.isFinite(page) ? page : 1,
      perPage: 20
    }),
    templateRepo.listAll(),
    contentRepo.listDistinctFormats()
  ]);

  function pageHref(target: number) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(target));
    return `/admin/social/conteudos?${query.toString()}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Conteudos" description="Todos os conteudos gerados, com filtros, busca e ordenacao." />

      <Card as="form" method="get" padding="sm" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <SearchBar
          name="q"
          id="social-contents-search"
          label="Buscar conteudos"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por titulo ou legenda..."
          className="lg:col-span-2"
        />

        <Select name="status" defaultValue={params.status ?? ""} aria-label="Status">
          <option value="">Todos os status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </Select>

        <Select name="format" defaultValue={params.format ?? ""} aria-label="Formato">
          <option value="">Todos os formatos</option>
          {formats.map((format) => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </Select>

        <Select name="templateId" defaultValue={params.templateId ?? ""} aria-label="Template">
          <option value="">Todos os templates</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </Select>

        <Select name="network" defaultValue={params.network ?? ""} aria-label="Rede social">
          <option value="">Todas as redes</option>
          {NETWORKS.map((network) => (
            <option key={network} value={network}>
              {network}
            </option>
          ))}
        </Select>

        <Input type="date" name="from" defaultValue={params.from ?? ""} aria-label="Data inicial" />
        <Input type="date" name="to" defaultValue={params.to ?? ""} aria-label="Data final" />

        <Select name="sort" defaultValue={params.sort ?? "createdAt:desc"} aria-label="Ordenacao">
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </Select>

        <div className="flex gap-2 lg:col-span-3">
          <Button type="submit">Filtrar</Button>
          <Link href="/admin/social/conteudos" className={buttonVariants({ variant: "ghost" })}>
            Limpar
          </Link>
        </div>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title="Nenhum conteudo encontrado" copy="Ajuste os filtros ou gere um novo conteudo na visao geral." />
      ) : (
        <>
          <Card padding="none">
            <TableContainer>
              <Table>
                <TableHead>
                  <tr>
                    <Th>Titulo</Th>
                    <Th>Formato</Th>
                    <Th>Status</Th>
                    <Th>Template</Th>
                    <Th>Publicacoes</Th>
                    <Th>Criado em</Th>
                    <Th />
                  </tr>
                </TableHead>
                <TableBody>
                  {result.items.map((content) => (
                    <TableRow key={content.id}>
                      <Td>
                        <Link href={`/admin/social/conteudos/${content.id}`} className="font-medium text-ink hover:underline">
                          {content.title}
                        </Link>
                      </Td>
                      <Td className="text-muted">{content.format ?? "-"}</Td>
                      <Td>
                        <ContentStatusBadge status={content.status} />
                      </Td>
                      <Td className="text-muted">{content.template?.name ?? "-"}</Td>
                      <Td className="text-muted">
                        {content.publications.length === 0 ? (
                          "-"
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {content.publications.map((publication) => (
                              <Badge key={publication.id} variant="outline">
                                {publication.network}: {publication.status}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td className="text-muted">{formatDateTime(content.createdAt)}</Td>
                      <Td>
                        <Link href={`/admin/social/conteudos/${content.id}`} className={buttonVariants({ variant: "ghost", size: "xs" })}>
                          Revisar
                        </Link>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {result.total} conteudo(s) · pagina {result.page} de {result.pageCount}
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
