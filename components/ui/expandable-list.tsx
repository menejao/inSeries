"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * Fase 10/25 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) — "nao criar listas verticais muito
 * longas". Dado ja carregado pelo Server Component pai (nunca dispara fetch novo); so revela
 * o resto no cliente. Genérico o bastante pra qualquer lista de itens ja renderizados
 * (Calendario hoje, outras telas depois). `listClassName` fica só nos itens (grid/space-y);
 * o botão "Mostrar mais" nunca vira item do grid/lista.
 */
export function ExpandableList({
  children,
  initialVisible = 5,
  itemLabel = "item",
  listClassName
}: {
  children: ReactNode[];
  initialVisible?: number;
  itemLabel?: string;
  listClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = children.length - initialVisible;
  const visible = expanded || hiddenCount <= 0 ? children : children.slice(0, initialVisible);

  return (
    <div className="space-y-3">
      <div className={listClassName}>{visible}</div>
      {!expanded && hiddenCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)} className="w-full justify-center">
          Mostrar mais {hiddenCount} {itemLabel}
          {hiddenCount > 1 ? "s" : ""}
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
