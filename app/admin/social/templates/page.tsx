import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableContainer, TableHead, TableRow, Th, Td } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TemplateActiveToggle } from "@/components/admin/social/template-active-toggle";
import { formatDateTime } from "@/components/admin/social/social-shared";
import { requireAdminUser } from "@/lib/admin/rbac";
import { templateRepo } from "@/packages/social-automation/src/db/template-repo";

export const dynamic = "force-dynamic";

/**
 * INSERIES-SOCIAL-ADMIN-PANEL-03 — templates.
 * `lastUsedAt` is MAX(SocialContent.createdAt) for the templateId, computed by the package's
 * templateRepo.listAllWithUsage (one groupBy, no N+1).
 */
export default async function AdminSocialTemplatesPage() {
  await requireAdminUser("admin.social");
  const templates = await templateRepo.listAllWithUsage();

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Templates" description="Templates de conteudo disponiveis para a automacao." />

      {templates.length === 0 ? (
        <EmptyState title="Nenhum template cadastrado" copy="Os templates sao criados pelo pacote de automacao social." />
      ) : (
        <Card padding="none">
          <TableContainer>
            <Table>
              <TableHead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Tipo</Th>
                  <Th>Status</Th>
                  <Th>Conteudos</Th>
                  <Th>Ultima utilizacao</Th>
                  <Th>Criado em</Th>
                  <Th />
                </tr>
              </TableHead>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <Td className="font-medium text-ink">{template.name}</Td>
                    <Td className="text-muted">{template.type}</Td>
                    <Td>
                      <Badge variant={template.active ? "success" : "default"}>{template.active ? "Ativo" : "Inativo"}</Badge>
                    </Td>
                    <Td className="text-muted">{template.contentCount}</Td>
                    <Td className="text-muted">{formatDateTime(template.lastUsedAt)}</Td>
                    <Td className="text-muted">{formatDateTime(template.createdAt)}</Td>
                    <Td>
                      <TemplateActiveToggle templateId={template.id} active={template.active} />
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </div>
  );
}
