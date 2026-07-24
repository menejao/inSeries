"use client";

import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/search/command-palette";

/**
 * Fase 12 (INSERIES-DASHBOARD-OPERATIONAL-EXPERIENCE-04) — "nao repetir destinos ja
 * disponiveis diretamente na Sidebar sem justificativa funcional... substituir atalhos de
 * navegacao redundantes por acoes uteis... somente exibir acoes existentes". Dos 6 exemplos
 * do ticket (Buscar serie / Revisar pendencias / Atualizar progresso / Ver lancamentos da
 * semana / Marcar episodios / Abrir serie em andamento), 5 ja sao a acao PRINCIPAL de uma
 * secao do proprio Dashboard construida nas Fases 5/8/9/10/11 desta sessao (Hero tem
 * "Continuar episodio"/"Marcar assistido", Disponiveis agora tem "Continuar serie"/"Marcar
 * todos", Agenda resumida tem "Abrir calendario") - repetir qualquer uma delas aqui violaria
 * a propria Fase 27 (nao repetir uma acao ja visivel na secao anterior, ja aplicada em
 * "Marcar episodio" no Dashboard antes deste ticket). "Buscar serie" e a unica que nao vive
 * em nenhuma secao do Dashboard - reusa o mesmo Command Palette (Fase 4,
 * INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01) que ja existe, so um ponto de entrada a mais,
 * util sobretudo no mobile (sem atalho de teclado pratico).
 */
export function QuickActions() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}>
      <SearchIcon className="h-4 w-4" />
      Buscar serie
    </Button>
  );
}
