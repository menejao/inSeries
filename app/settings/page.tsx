import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ProfileSettingsForm } from "@/components/social/profile-settings-form";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";

export default async function SettingsPage() {
  const user = await requireUser();
  const fullUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      isProfilePrivate: true,
      showWatchedSeries: true,
      showWatchingSeries: true,
      showLists: true,
      showReviews: true,
      showActivity: true
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Configuracoes</p>
        <h1 className="section-title">Configuracoes</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <h2 className="text-lg font-semibold text-ink">Editar perfil</h2>
          <p className="mt-1 section-copy">Nome, username, bio, avatar e privacidade sao aplicados ao seu perfil publico.</p>
          <div className="mt-5">
            <ProfileSettingsForm initial={fullUser} />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Aparencia</h2>
              <p className="mt-1 text-sm text-muted">Alterne entre tema claro e escuro.</p>
            </div>
            <ThemeToggle />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-ink">Conta</h2>
            <p className="mt-1 text-sm text-muted">Sessao segura por cookie, senha com hash e alteracoes restritas ao proprio usuario.</p>
            <div className="mt-4">
              <LogoutButton />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
