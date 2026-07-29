import { Card } from "@/components/ui/card";
import type { ViewerPersona } from "@/lib/stats/types";

/** INSERIES-PROFILE-REDESIGN-01 — "Perfil do espectador": calculado automaticamente (lib/stats/persona-for-user.ts), nunca um texto generico. */
export function ProfilePersonaCard({ persona }: { persona: ViewerPersona }) {
  return (
    <Card className="flex items-center gap-4" padding="md">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/12 text-3xl">
        {persona.emoji}
      </span>
      <div className="min-w-0">
        <p className="eyebrow">Perfil do espectador</p>
        <p className="text-lg font-bold text-ink">{persona.title}</p>
        <p className="mt-0.5 text-sm text-muted">{persona.description}</p>
      </div>
    </Card>
  );
}
