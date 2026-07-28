"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ImportWizard } from "@/components/data/import-wizard";
import { formatRelativeDate, cn } from "@/lib/utils";
import type { ImportReport, ImportTotals } from "@/lib/import/types";

type Section = "import" | "export" | "clear" | "analyze" | "history";

const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: "import", label: "Importar" },
  { value: "export", label: "Exportar" },
  { value: "clear", label: "Limpar dados" },
  { value: "analyze", label: "Analisar historico" },
  { value: "history", label: "Historico de importacoes" }
];

type JobRow = {
  id: string;
  source: string;
  fileName: string;
  status: string;
  totals: ImportTotals;
  processedCount: number;
  report: ImportReport | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "warning" | "danger" | "default" }> = {
  ANALYZED: { label: "Aguardando confirmacao", variant: "secondary" },
  IMPORTING: { label: "Importando", variant: "warning" },
  COMPLETED: { label: "Concluida", variant: "success" },
  COMPLETED_WITH_WARNINGS: { label: "Concluida com avisos", variant: "warning" },
  FAILED: { label: "Falhou", variant: "danger" },
  CANCELLED: { label: "Cancelada", variant: "default" },
  UNDONE: { label: "Desfeita", variant: "default" }
};

const SOURCE_LABEL: Record<string, string> = {
  tvtime: "TV Time",
  imdb: "IMDb",
  letterboxd: "Letterboxd",
  inseries: "Backup inSeries",
  csv: "CSV"
};

/**
 * INSERIES-HISTORY-IMPORT-AND-DATA-PORTABILITY-01 — Fase 2/3: a central de dados inteira
 * (Importar/Exportar/Limpar/Analisar/Historico) numa unica pagina com seletor de secao
 * (tabs rolaveis, mobile-first — nunca uma sidebar comprimida).
 */
export function DataCenter() {
  const { toast } = useToast();
  const [section, setSection] = useState<Section>("import");

  // ---- historico ----
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [undoTarget, setUndoTarget] = useState<JobRow | null>(null);
  const [undoing, setUndoing] = useState(false);

  async function loadJobs() {
    const response = await fetch("/api/data/import");
    if (response.ok) {
      const payload = await response.json();
      setJobs(payload.data);
    }
  }

  useEffect(() => {
    if (section === "history" && jobs === null) void loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  async function undoJob(job: JobRow) {
    setUndoing(true);
    try {
      const response = await fetch(`/api/data/import/${job.id}/undo`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ title: "Nao foi possivel desfazer esta importacao", variant: "error" });
        return;
      }
      toast({
        title: "Importacao desfeita",
        description: `${payload.data.removedProgress} registros de visualizacao removidos.`,
        variant: "success"
      });
      setUndoTarget(null);
      await loadJobs();
    } finally {
      setUndoing(false);
    }
  }

  // ---- limpar ----
  const [clearCategory, setClearCategory] = useState("history");
  const [clearPhrase, setClearPhrase] = useState("");
  const [clearing, setClearing] = useState(false);

  async function clearData() {
    setClearing(true);
    try {
      const response = await fetch("/api/data/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: clearCategory, confirmation: clearPhrase })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ title: "Confirmacao invalida", description: 'Digite exatamente "LIMPAR" para confirmar.', variant: "error" });
        return;
      }
      toast({ title: "Dados removidos", description: `${payload.data.removed} registros excluidos.`, variant: "success" });
      setClearPhrase("");
    } finally {
      setClearing(false);
    }
  }

  // ---- analisar ----
  const [analysis, setAnalysis] = useState<{
    duplicateTitles: Array<{ title: string; series: Array<{ slug: string; year: number | null; state: string }> }>;
    inconsistentCompleted: Array<{ title: string; slug: string; completionPercent: number }>;
    orphanSeries: Array<{ title: string; slug: string }>;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/data/duplicates");
      if (response.ok) {
        const payload = await response.json();
        setAnalysis(payload.data);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Secoes de dados" className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-current={section === item.value ? "page" : undefined}
            onClick={() => setSection(item.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
              section === item.value ? "bg-primary text-primary-foreground" : "bg-surface-strong text-muted hover:text-ink"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === "import" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Importar historico</h2>
            <p className="text-sm text-muted">Traga suas series, episodios assistidos, avaliacoes e listas de outros servicos.</p>
          </div>
          <ImportWizard onFinished={() => setJobs(null)} />
        </div>
      ) : null}

      {section === "export" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Exportar meus dados</h2>
            <p className="text-sm text-muted">
              O backup completo em JSON pode ser re-importado no inSeries a qualquer momento. Nenhum dado sensivel (senha, tokens, sessoes) e
              incluido.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/data/export?format=json" download>
              <Button type="button">Backup completo (JSON)</Button>
            </a>
            <a href="/api/data/export?format=history-csv" download>
              <Button type="button" variant="secondary">
                Historico (CSV)
              </Button>
            </a>
            <a href="/api/data/export?format=ratings-csv" download>
              <Button type="button" variant="secondary">
                Avaliacoes (CSV)
              </Button>
            </a>
          </div>
        </div>
      ) : null}

      {section === "clear" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-danger-text">Limpar dados</h2>
            <p className="text-sm text-muted">
              Acao permanente: remove a categoria selecionada por completo. As demais categorias sao preservadas.
            </p>
          </div>
          <Card className="space-y-3 border-danger/40">
            <Select aria-label="Categoria a limpar" value={clearCategory} onChange={(event) => setClearCategory(event.target.value)}>
              <option value="history">Historico de episodios assistidos</option>
              <option value="ratings">Avaliacoes</option>
              <option value="statuses">Status de acompanhamento</option>
              <option value="lists">Listas</option>
              <option value="reviews">Reviews</option>
            </Select>
            <div className="space-y-1">
              <label htmlFor="clear-phrase" className="text-sm text-muted">
                Digite <span className="font-mono font-semibold text-ink">LIMPAR</span> para confirmar
              </label>
              <input
                id="clear-phrase"
                value={clearPhrase}
                onChange={(event) => setClearPhrase(event.target.value)}
                className="min-h-11 w-full rounded-2xl border border-border bg-surface px-4 text-sm text-ink"
              />
            </div>
            <Button type="button" variant="danger" disabled={clearPhrase !== "LIMPAR" || clearing} loading={clearing} onClick={() => void clearData()}>
              Remover permanentemente
            </Button>
          </Card>
        </div>
      ) : null}

      {section === "analyze" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Analisar historico</h2>
            <p className="text-sm text-muted">Procura duplicacoes e inconsistencias no seu acompanhamento.</p>
          </div>
          <Button type="button" onClick={() => void runAnalysis()} loading={analyzing} disabled={analyzing}>
            Analisar agora
          </Button>
          {analysis ? (
            <div className="space-y-3">
              {!analysis.duplicateTitles.length && !analysis.inconsistentCompleted.length && !analysis.orphanSeries.length ? (
                <EmptyState title="Seu historico nao possui duplicacoes aparentes" copy="Nenhuma inconsistencia foi encontrada." />
              ) : (
                <>
                  {analysis.duplicateTitles.length ? (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold text-ink">Series com titulo duplicado no seu acompanhamento</p>
                      {analysis.duplicateTitles.map((duplicate) => (
                        <p key={duplicate.title} className="text-sm text-muted">
                          {duplicate.title} — {duplicate.series.map((series) => `${series.year ?? "?"} (${series.state})`).join(", ")}
                        </p>
                      ))}
                    </Card>
                  ) : null}
                  {analysis.inconsistentCompleted.length ? (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold text-ink">Concluidas com progresso abaixo de 100%</p>
                      {analysis.inconsistentCompleted.map((series) => (
                        <p key={series.slug} className="text-sm text-muted">
                          {series.title} — {series.completionPercent}%
                        </p>
                      ))}
                    </Card>
                  ) : null}
                  {analysis.orphanSeries.length ? (
                    <Card className="space-y-2">
                      <p className="text-sm font-semibold text-ink">Episodios assistidos sem status de acompanhamento</p>
                      {analysis.orphanSeries.map((series) => (
                        <p key={series.slug} className="text-sm text-muted">
                          {series.title}
                        </p>
                      ))}
                    </Card>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {section === "history" ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Historico de importacoes</h2>
          </div>
          {jobs === null ? (
            <p className="text-sm text-muted" role="status">
              Carregando...
            </p>
          ) : jobs.length ? (
            <div className="space-y-2">
              {jobs.map((job) => {
                const status = STATUS_LABEL[job.status] ?? { label: job.status, variant: "default" as const };
                return (
                  <Card key={job.id} padding="sm" className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">
                        {SOURCE_LABEL[job.source] ?? job.source} · {job.fileName}
                      </p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted">
                      {job.totals.seriesCount} series · {job.totals.episodeCount} episodios · {formatRelativeDate(new Date(job.createdAt))}
                    </p>
                    {job.report ? (
                      <p className="text-xs text-subtle">
                        {job.report.episodesMarked} marcados · {job.report.episodesAlreadyWatched} ja existiam · {job.report.skippedSeries} pulados
                      </p>
                    ) : null}
                    {(job.status === "COMPLETED" || job.status === "COMPLETED_WITH_WARNINGS") && job.report ? (
                      <Button type="button" variant="ghost" size="xs" onClick={() => setUndoTarget(job)}>
                        Desfazer importacao
                      </Button>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Voce ainda nao realizou nenhuma importacao"
              copy="Traga seu historico de outro servico para continuar de onde parou."
            />
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(undoTarget)}
        onClose={() => setUndoTarget(null)}
        onConfirm={() => undoTarget && void undoJob(undoTarget)}
        title="Desfazer importacao?"
        description={
          undoTarget?.report
            ? `Essa acao removera ${undoTarget.report.createdProgressIds.length} registros de visualizacao, ${undoTarget.report.createdRatingIds.length} avaliacoes, ${undoTarget.report.createdStatusIds.length} status e ${undoTarget.report.createdListIds.length} listas criados por esta importacao. Alteracoes feitas depois dela serao preservadas.`
            : undefined
        }
        confirmLabel="Desfazer"
        confirmVariant="danger"
        loading={undoing}
      />
    </div>
  );
}
