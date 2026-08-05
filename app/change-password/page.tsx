import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

/**
 * INSERIES-ADMIN-PASSWORD-RESET-01 — destino forcado pelo middleware quando
 * `mustChangePassword` esta ligado (reset de senha feito pelo admin). Quem chega aqui sem a
 * flag ligada (ex: digitou a URL direto) e mandado de volta — nao e uma pagina de "trocar
 * senha voluntariamente", essa continua em Configuracoes.
 */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { mustChangePassword: true } });
  if (!fresh?.mustChangePassword) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md space-y-1 pt-8 text-center">
      <h1 className="text-xl font-bold text-ink">Crie uma nova senha</h1>
      <p className="text-sm text-muted">Sua senha foi redefinida por um administrador. Escolha uma nova senha para continuar.</p>
      <div className="pt-4 text-left">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
