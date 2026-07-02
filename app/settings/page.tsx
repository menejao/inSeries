import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";
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
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
      <Card>
        <h1 className="section-title">Editar perfil</h1>
        <p className="mt-2 section-copy">Nome, username, bio, avatar e privacidade sao aplicados ao seu perfil publico.</p>
        <div className="mt-5">
          <ProfileSettingsForm initial={fullUser} />
        </div>
      </Card>
      <Card>
        <h2 className="section-title">Conta</h2>
        <p className="mt-3 text-sm text-slate-300">Sessao segura por cookie, senha com hash e alteracoes restritas ao proprio usuario.</p>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
