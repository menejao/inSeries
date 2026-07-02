import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/logout-button";

export default function SettingsPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h1 className="section-title">Privacidade</h1>
        <p className="mt-3 text-sm text-slate-300">Perfil publico ou privado, exibir listas, reviews, atividade e series assistidas.</p>
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
