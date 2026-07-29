"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const BANNER_STYLES = [
  { id: "aurora", label: "Aurora", className: "bg-gradient-to-r from-primary via-danger to-secondary" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-r from-warning via-danger to-primary" },
  { id: "midnight", label: "Midnight", className: "bg-gradient-to-r from-secondary via-primary to-canvas" }
];

const FRAME_STYLES = [
  { id: "none", label: "Nenhuma" },
  { id: "gold", label: "Dourada" },
  { id: "neon", label: "Neon" }
];

/** INSERIES-SUPPORTER-SYSTEM-01 — "usuario podera escolher exibir ou ocultar" o badge + personalizacao cosmetica (banner/moldura). So renderizado pra quem ja e Apoiador. */
export function SupporterPreferences({
  showSupporterBadge,
  supporterBannerStyle,
  supporterFrameStyle
}: {
  showSupporterBadge: boolean;
  supporterBannerStyle: string | null;
  supporterFrameStyle: string | null;
}) {
  const { toast } = useToast();
  const [badgeVisible, setBadgeVisible] = useState(showSupporterBadge);
  const [banner, setBanner] = useState(supporterBannerStyle);
  const [frame, setFrame] = useState(supporterFrameStyle ?? "none");
  const [pending, setPending] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setPending(true);
    try {
      const response = await fetch("/api/support/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!response.ok) {
        toast({ title: "Erro ao salvar preferencia", variant: "error" });
        return;
      }
      toast({ title: "Preferencia salva", variant: "success" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-5">
      <h2 className="text-lg font-semibold text-ink">Personalizacao</h2>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">Exibir badge de Apoiador</p>
          <p className="text-xs text-subtle">Aparece no seu perfil, reviews, comentarios e listas publicas.</p>
        </div>
        <Button
          type="button"
          variant={badgeVisible ? "primary" : "secondary"}
          size="sm"
          disabled={pending}
          onClick={() => {
            const next = !badgeVisible;
            setBadgeVisible(next);
            save({ showSupporterBadge: next });
          }}
        >
          {badgeVisible ? "Visivel" : "Oculto"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Banner exclusivo</p>
        <div className="grid grid-cols-3 gap-2">
          {BANNER_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              disabled={pending}
              onClick={() => {
                setBanner(style.id);
                save({ supporterBannerStyle: style.id });
              }}
              className={cn(
                "h-12 rounded-2xl border-2",
                style.className,
                banner === style.id ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"
              )}
              aria-label={style.label}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Moldura do avatar</p>
        <div className="flex gap-2">
          {FRAME_STYLES.map((style) => (
            <Button
              key={style.id}
              type="button"
              variant={frame === style.id ? "primary" : "secondary"}
              size="sm"
              disabled={pending}
              onClick={() => {
                setFrame(style.id);
                save({ supporterFrameStyle: style.id });
              }}
            >
              {style.label}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
