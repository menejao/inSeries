"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ImportTotals, MatchedSeries, ImportReport } from "@/lib/import/types";

type Source = "tvtime" | "imdb" | "letterboxd" | "inseries" | "csv";

const SOURCES: Array<{ value: Source; label: string; instructions: string[] }> = [
  {
    value: "tvtime",
    label: "TV Time",
    instructions: [
      "No TV Time, solicite a exportacao dos seus dados (Configuracoes > Conta > Exportar dados, via pedido GDPR).",
      "Voce recebera um ZIP por email. Extraia o ZIP no seu computador.",
      "Envie aqui o CSV de episodios assistidos (ex: seen_episode.csv ou tracking-prod-records.csv)."
    ]
  },
  {
    value: "imdb",
    label: "IMDb",
    instructions: [
      "No IMDb, abra sua lista de avaliacoes (Your Ratings) ou sua Watchlist.",
      "Use a opcao Export para baixar o CSV.",
      "Envie o CSV aqui. Filmes serao ignorados automaticamente (o inSeries importa apenas series)."
    ]
  },
  {
    value: "letterboxd",
    label: "Letterboxd",
    instructions: [
      "No Letterboxd, va em Settings > Import & Export > Export your data.",
      "Extraia o ZIP baixado.",
      "Envie o CSV aqui. O Letterboxd e focado em filmes: itens de filme serao ignorados."
    ]
  },
  {
    value: "inseries",
    label: "Backup do inSeries (JSON)",
    instructions: [
      "Use um arquivo gerado pela exportacao do proprio inSeries (Exportar > Backup completo em JSON).",
      "Envie o arquivo .json aqui — series, episodios, avaliacoes e listas serao restaurados sem duplicar nada."
    ]
  },
  {
    value: "csv",
    label: "CSV generico",
    instructions: [
      "Monte um CSV com cabecalho. Colunas reconhecidas: Titulo, Ano, Temporada, Episodio, Data assistida, Nota, Status, Lista, TMDB ID, IMDb ID.",
      "So Titulo (ou TMDB ID) e obrigatorio; as demais colunas sao opcionais.",
      "Envie o arquivo aqui."
    ]
  }
];

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const CONFIDENCE_LABEL: Record<string, { label: string; variant: "success" | "secondary" | "warning" | "danger" }> = {
  confirmed: { label: "Confirmada", variant: "success" },
  probable: { label: "Provavel", variant: "secondary" },
  ambiguous: { label: "Ambigua", variant: "warning" },
  not_found: { label: "Nao encontrada", variant: "danger" }
};

type Step = "pick" | "preview" | "running" | "done";

export function ImportWizard({ onFinished }: { onFinished?: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [source, setSource] = useState<Source>("tvtime");
  const [showInstructions, setShowInstructions] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState<Step>("pick");

  const [jobId, setJobId] = useState<string | null>(null);
  const [totals, setTotals] = useState<ImportTotals | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [series, setSeries] = useState<MatchedSeries[]>([]);
  const [previewFilter, setPreviewFilter] = useState<"all" | "confirmed" | "probable" | "ambiguous" | "not_found">("all");
  const [conflictPolicy, setConflictPolicy] = useState("keep_existing");

  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [report, setReport] = useState<ImportReport | null>(null);
  const [finalStatus, setFinalStatus] = useState<string>("");

  const activeSource = SOURCES.find((item) => item.value === source)!;

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast({ title: "Este arquivo e maior que o limite permitido de 15 MB.", variant: "error" });
      return;
    }
    if (/\.zip$/i.test(file.name)) {
      toast({
        title: "ZIP nao e aceito diretamente",
        description: "Extraia o ZIP e envie o CSV ou JSON interno.",
        variant: "error"
      });
      return;
    }

    setAnalyzing(true);
    try {
      const content = await file.text();
      const response = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, fileName: file.name, content })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.details?.[0] ?? (payload?.error === "file_too_large" ? "Arquivo acima do limite." : "Formato nao reconhecido.");
        toast({ title: "Nao foi possivel analisar o arquivo", description: detail, variant: "error" });
        return;
      }
      setJobId(payload.data.jobId);
      setTotals(payload.data.totals);
      setWarnings(payload.data.warnings ?? []);
      setSeries(payload.data.series ?? []);
      setStep("preview");
    } finally {
      setAnalyzing(false);
    }
  }

  async function resolveAmbiguous(key: string, tmdbId?: string, skipped?: boolean) {
    if (!jobId) return;
    const response = await fetch(`/api/data/import/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutions: [{ key, tmdbId, skipped }] })
    });
    if (response.ok) {
      setSeries((current) =>
        current.map((group) =>
          group.key === key
            ? { ...group, ...(tmdbId ? { tmdbId, confidence: "confirmed" as const, skipped: false } : {}), ...(skipped !== undefined ? { skipped } : {}) }
            : group
        )
      );
    }
  }

  async function startImport() {
    if (!jobId) return;
    cancelRef.current = false;

    await fetch(`/api/data/import/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conflictPolicy })
    });

    setStep("running");
    setProgress({ processed: 0, total: series.length });

    // Fase 27/28 — loop client-driven: cada chamada processa um lote e devolve o checkpoint.
    let done = false;
    while (!done && !cancelRef.current) {
      const response = await fetch(`/api/data/import/${jobId}/execute`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ title: "A importacao foi interrompida", description: "Voce pode retoma-la no historico de importacoes.", variant: "error" });
        setStep("preview");
        return;
      }
      done = payload.data.done;
      setProgress({ processed: payload.data.processedCount, total: payload.data.totalCount });
      if (done) {
        setReport(payload.data.report ?? null);
        setFinalStatus(payload.data.status);
      }
    }

    if (cancelRef.current) {
      if (jobId) await fetch(`/api/data/import/${jobId}`, { method: "DELETE" });
      toast({ title: "Importacao cancelada", description: "Os itens ja aplicados foram mantidos." });
      setStep("preview");
      return;
    }

    setStep("done");
    onFinished?.();
  }

  function reset() {
    setStep("pick");
    setJobId(null);
    setTotals(null);
    setSeries([]);
    setWarnings([]);
    setReport(null);
  }

  const filteredSeries = series.filter((group) => (previewFilter === "all" ? true : group.confidence === previewFilter));
  const ambiguousCount = series.filter((group) => group.confidence === "ambiguous" && !group.skipped).length;

  // ---------------------------------------------------------------- pick
  if (step === "pick") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="import-source" className="text-sm font-medium text-ink">
            Fonte
          </label>
          <Select id="import-source" value={source} onChange={(event) => setSource(event.target.value as Source)}>
            {SOURCES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <button
            type="button"
            className="text-sm font-semibold text-primary-text hover:underline"
            aria-expanded={showInstructions}
            onClick={() => setShowInstructions((value) => !value)}
          >
            {showInstructions ? "Ocultar instrucoes" : "Como obter o arquivo"}
          </button>
          {showInstructions ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              {activeSource.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          ) : null}
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Selecionar arquivo de exportacao (${activeSource.label})`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-6 text-center transition",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-border-strong"
          )}
        >
          {analyzing ? (
            <p className="text-sm font-medium text-ink" role="status">
              Analisando arquivo...
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted">CSV ou JSON · Maximo de 15 MB</p>
              <p className="text-xs text-subtle">O arquivo e lido no seu navegador e analisado no servidor; nada e alterado antes da sua confirmacao.</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------- preview
  if (step === "preview" && totals) {
    return (
      <div className="space-y-4">
        <Card className="space-y-2">
          <p className="font-semibold text-ink">Arquivo analisado</p>
          <p className="text-sm text-muted">
            {totals.seriesCount} serie{totals.seriesCount === 1 ? "" : "s"} · {totals.episodeCount} episodios assistidos · {totals.ratingCount}{" "}
            avaliacoes · {totals.listCount} listas
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="success">{totals.confirmed} confirmadas</Badge>
            <Badge variant="secondary">{totals.probable} provaveis</Badge>
            {totals.ambiguous ? <Badge variant="warning">{totals.ambiguous} ambiguas</Badge> : null}
            {totals.notFound ? <Badge variant="danger">{totals.notFound} nao encontradas</Badge> : null}
            {totals.ignored ? <Badge variant="default">{totals.ignored} ignoradas (filmes)</Badge> : null}
          </div>
          {warnings.map((warning, index) => (
            <p key={index} className="text-xs text-warning-text">
              {warning}
            </p>
          ))}
        </Card>

        <div className="space-y-2">
          <label htmlFor="conflict-policy" className="text-sm font-medium text-ink">
            Quando um dado ja existir no inSeries
          </label>
          <Select id="conflict-policy" value={conflictPolicy} onChange={(event) => setConflictPolicy(event.target.value)}>
            <option value="keep_existing">Manter meus dados atuais</option>
            <option value="use_imported">Usar dados importados</option>
            <option value="use_newest">Usar a informacao mais recente</option>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "confirmed", "probable", "ambiguous", "not_found"] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              size="xs"
              variant={previewFilter === filter ? "primary" : "secondary"}
              onClick={() => setPreviewFilter(filter)}
            >
              {filter === "all" ? "Todas" : CONFIDENCE_LABEL[filter].label}
            </Button>
          ))}
        </div>

        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {filteredSeries.map((group) => (
            <Card key={group.key} padding="sm" className={cn("space-y-2", group.skipped && "opacity-50")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-ink">
                    {group.title}
                    {group.year ? <span className="ml-1 text-muted">({group.year})</span> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {group.episodes.length ? `${group.episodes.length} episodio(s)` : null}
                    {group.rating !== undefined ? ` · nota ${group.rating}/5` : null}
                    {group.status ? ` · ${group.status}` : null}
                  </p>
                </div>
                <Badge variant={CONFIDENCE_LABEL[group.confidence].variant}>{CONFIDENCE_LABEL[group.confidence].label}</Badge>
              </div>

              {group.confidence === "ambiguous" && group.candidates?.length ? (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-xs font-medium text-ink">Qual serie corresponde?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.candidates.map((candidate) => (
                      <Button
                        key={candidate.tmdbId}
                        type="button"
                        size="xs"
                        variant={group.tmdbId === candidate.tmdbId ? "primary" : "secondary"}
                        onClick={() => void resolveAmbiguous(group.key, candidate.tmdbId)}
                      >
                        {candidate.title}
                        {candidate.year ? ` (${candidate.year})` : ""}
                      </Button>
                    ))}
                    <Button type="button" size="xs" variant="ghost" onClick={() => void resolveAmbiguous(group.key, undefined, true)}>
                      Nenhuma destas
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
          {!filteredSeries.length ? <p className="py-4 text-center text-sm text-muted">Nenhuma serie neste filtro.</p> : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-canvas/95 py-3 backdrop-blur">
          <Button type="button" onClick={() => void startImport()} disabled={!totals.confirmed && !totals.probable}>
            Confirmar importacao
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Cancelar
          </Button>
          {ambiguousCount ? <p className="text-xs text-warning-text">{ambiguousCount} serie(s) ambiguas serao puladas se nao forem resolvidas.</p> : null}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- running
  if (step === "running") {
    const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
    return (
      <Card className="space-y-3 text-center">
        <p className="font-semibold text-ink">Importando seu historico</p>
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {progress.processed} de {progress.total} series · {percent}%
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-surface-strong">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-subtle">Mantenha esta aba aberta ate concluir — se sair, voce pode retomar no historico de importacoes.</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => (cancelRef.current = true)}>
          Cancelar
        </Button>
      </Card>
    );
  }

  // ---------------------------------------------------------------- done
  if (step === "done" && report) {
    return (
      <Card className="space-y-3">
        <p className="font-semibold text-ink">
          {finalStatus === "COMPLETED" ? "Importacao concluida" : "Importacao concluida com avisos"}
        </p>
        <ul className="space-y-1 text-sm text-muted">
          <li>{report.seriesCreated} series adicionadas ao catalogo</li>
          <li>{report.seriesMatched} series ja existiam</li>
          <li>{report.episodesMarked} episodios marcados como assistidos</li>
          <li>{report.episodesAlreadyWatched} episodios ja estavam assistidos</li>
          <li>{report.ratingsImported} avaliacoes importadas</li>
          {report.ratingsSkippedConflict ? <li>{report.ratingsSkippedConflict} avaliacoes mantidas (conflito)</li> : null}
          <li>{report.statusesApplied} status aplicados</li>
          {report.listsCreated ? <li>{report.listsCreated} listas criadas ({report.listItemsAdded} itens)</li> : null}
          {report.skippedSeries ? <li>{report.skippedSeries} series puladas (ambiguas/nao encontradas)</li> : null}
        </ul>
        {report.failures.length ? (
          <div className="space-y-1 rounded-2xl bg-danger/10 p-3 text-xs text-danger-text">
            {report.failures.slice(0, 5).map((failure, index) => (
              <p key={index}>
                {failure.series}: {failure.error}
              </p>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Nova importacao
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
