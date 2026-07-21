import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { LogoutButton } from "@/components/auth/logout-button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { ProfileDetailsForm } from "@/components/social/profile-details-form";
import { ProfilePrivacyForm } from "@/components/social/profile-privacy-form";
import { requireUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";

type SettingsTab = "perfil" | "privacidade" | "aparencia" | "conta";
const VALID_TABS: SettingsTab[] = ["perfil", "privacidade", "aparencia", "conta"];

/**
 * Fase 19 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "Não criar uma única página longa com
 * todos os campos. Utilizar navegação interna adequada." Agrupado por dominio real (so os que
 * ja tem dado por tras — Notificacoes/Seguranca/Dados/Integracoes nao existem como feature
 * ainda, criar aba vazia pra eles seria interface desonesta). `Tabs` com `?tab=`, mesmo padrao
 * ja usado por /feed e /calendar.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
  const tab: SettingsTab = VALID_TABS.includes(params.tab as SettingsTab) ? (params.tab as SettingsTab) : "perfil";

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

      <Tabs
        label="Secoes de configuracoes"
        items={[
          { href: "/settings", label: "Perfil" },
          { href: "/settings?tab=privacidade", label: "Privacidade" },
          { href: "/settings?tab=aparencia", label: "Aparencia" },
          { href: "/settings?tab=conta", label: "Conta" }
        ]}
        active={tab === "perfil" ? "/settings" : `/settings?tab=${tab}`}
      />

      {tab === "perfil" ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink">Editar perfil</h2>
          <p className="mt-1 section-copy">Nome, username, bio e avatar sao aplicados ao seu perfil publico.</p>
          <div className="mt-5">
            <ProfileDetailsForm initial={fullUser} />
          </div>
        </Card>
      ) : null}

      {tab === "privacidade" ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink">Privacidade</h2>
          <p className="mt-1 section-copy">Controle o que aparece no seu perfil publico.</p>
          <div className="mt-5">
            <ProfilePrivacyForm initial={fullUser} />
          </div>
        </Card>
      ) : null}

      {tab === "aparencia" ? (
        <Card className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Aparencia</h2>
            <p className="mt-1 text-sm text-muted">Alterne entre tema claro e escuro.</p>
          </div>
          <ThemeToggle />
        </Card>
      ) : null}

      {tab === "conta" ? (
        <Card>
          <h2 className="text-lg font-semibold text-ink">Conta</h2>
          <p className="mt-1 text-sm text-muted">Sessao segura por cookie, senha com hash e alteracoes restritas ao proprio usuario.</p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
