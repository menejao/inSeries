"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — pre-visualizacao real da arte gerada.
 *
 * O toggle apenas troca a URL de /api/admin/social/content/:id/preview/:format, que renderiza um
 * PNG de verdade pelo MESMO renderer (Playwright) usado na publicacao. Nada e desenhado aqui em
 * HTML: se a imagem aparece, e exatamente o arquivo que seria enviado.
 *
 * FINALIZATION: a imagem passou a ser buscada por `fetch` com AbortController. Trocar de
 * formato/slide rapidamente cancela a requisicao anterior (o render em curso no servidor deixa de
 * ser aguardado) e respostas atrasadas sao ignoradas — antes, a ultima resposta a chegar vencia,
 * independentemente de qual formato estava selecionado.
 */
export type PreviewFormat = "feed" | "carousel" | "story";

const LABELS: Record<PreviewFormat, string> = {
  feed: "Feed",
  carousel: "Carrossel",
  story: "Story"
};

interface PreviewError {
  message: string;
  detail?: string;
}

export function ContentArtPreview({ contentId, formats }: { contentId: string; formats: PreviewFormat[] }) {
  const available = formats.length > 0 ? formats : (["story"] as PreviewFormat[]);
  const [format, setFormat] = useState<PreviewFormat>(available[0]);
  const [slide, setSlide] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<PreviewError | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Cada requisicao carrega um id; so a mais recente pode escrever no estado.
  const requestIdRef = useRef(0);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setStatus("loading");
    setError(null);

    const url = `/api/admin/social/content/${contentId}/preview/${format}?slide=${slide}&v=${nonce}`;

    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;

        if (!response.ok) {
          let detail: string | undefined;
          try {
            const body = (await response.json()) as { error?: string; message?: string };
            detail = [body.error, body.message].filter(Boolean).join(" — ") || undefined;
          } catch {
            detail = undefined;
          }
          if (requestId !== requestIdRef.current) return;
          setError({
            message:
              response.status === 403
                ? "Voce nao tem permissao para visualizar esta previa."
                : "Nao foi possivel gerar a previa deste formato.",
            detail: detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`
          });
          setStatus("error");
          return;
        }

        const blob = await response.blob();
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;

        revokeObjectUrl();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setImageUrl(objectUrl);
        setStatus("ready");
      } catch (caught) {
        // Abort e o caminho feliz de uma troca rapida de formato: nao e erro para o usuario.
        if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
        if (requestId !== requestIdRef.current) return;
        setError({
          message: "Nao foi possivel carregar a previa.",
          // Mensagem tecnica curta e sem stack/paths internos — nem em dev.
          detail: caught instanceof Error ? caught.message : String(caught)
        });
        setStatus("error");
      }
    })();

    return () => controller.abort();
  }, [contentId, format, slide, nonce, revokeObjectUrl]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeObjectUrl();
    };
  }, [revokeObjectUrl]);

  function select(next: PreviewFormat) {
    if (next === format) return;
    setFormat(next);
    setSlide(1);
  }

  function retry() {
    setNonce((value) => value + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {available.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={option === format ? "primary" : "outline"}
            onClick={() => select(option)}
            type="button"
          >
            {LABELS[option]}
          </Button>
        ))}

        {format === "carousel" ? (
          <div className="ml-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={slide <= 1}
              onClick={() => setSlide((value) => Math.max(1, value - 1))}
            >
              ←
            </Button>
            <span className="text-xs text-ink-muted">Slide {slide}</span>
            <Button size="sm" variant="ghost" type="button" onClick={() => setSlide((value) => value + 1)}>
              →
            </Button>
          </div>
        ) : null}

        <Button size="sm" variant="ghost" type="button" onClick={retry}>
          Regerar
        </Button>
      </div>

      {/* O container mantem a altura minima em todos os estados: o loading nunca desmonta a tela. */}
      <div className="relative flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-surface p-4">
        {status === "error" ? (
          <div className="max-w-md space-y-3 text-center">
            <p className="text-sm text-ink">{error?.message ?? "Nao foi possivel gerar a previa."}</p>
            <Button size="sm" variant="outline" type="button" onClick={retry}>
              Tentar novamente
            </Button>
            {error?.detail ? (
              <details className="text-left">
                <summary className="cursor-pointer text-xs text-ink-muted">Detalhes tecnicos</summary>
                <p className="mt-1 break-words text-xs text-ink-muted">{error.detail}</p>
              </details>
            ) : null}
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- PNG gerado sob demanda por uma rota admin; nao passa pelo otimizador.
          <img
            src={imageUrl}
            alt={`Previa ${LABELS[format]} do conteudo`}
            className={`max-h-[560px] w-auto max-w-full rounded-lg shadow transition-opacity ${
              status === "loading" ? "opacity-40" : "opacity-100"
            }`}
          />
        ) : null}

        {status === "loading" ? (
          <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-ink-muted">Renderizando…</span>
        ) : null}
      </div>
    </div>
  );
}
