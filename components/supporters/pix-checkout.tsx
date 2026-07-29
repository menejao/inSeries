"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyIcon, CheckIcon, UploadIcon, ClockIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

const SUGGESTED_AMOUNTS = [
  { label: "R$ 5", cents: 500 },
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 20", cents: 2000 }
];

const MAX_RECEIPT_BYTES = 1_500_000;

type ResumableRequest = {
  id: string;
  status: "PENDING_PAYMENT" | "AWAITING_REVIEW";
  amountCents: number;
  receiptUrl: string | null;
  pixPayload: string;
};

type CheckoutState =
  | { step: "pick" }
  | { step: "pay"; supportRequestId: string; pixPayload: string; amountCents: number }
  | { step: "awaiting-review"; supportRequestId: string; amountCents: number };

function initialStateFor(resumableRequest: ResumableRequest | null): CheckoutState {
  if (!resumableRequest) return { step: "pick" };
  if (resumableRequest.status === "AWAITING_REVIEW") {
    return { step: "awaiting-review", supportRequestId: resumableRequest.id, amountCents: resumableRequest.amountCents };
  }
  return {
    step: "pay",
    supportRequestId: resumableRequest.id,
    pixPayload: resumableRequest.pixPayload,
    amountCents: resumableRequest.amountCents
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * INSERIES-SUPPORTER-ACTIVATION-01 — o fluxo inteiro ate a solicitacao ficar pendente de
 * analise: escolher valor -> gerar PIX (QR + copia-e-cola) -> enviar comprovante -> aguardar um
 * administrador aprovar. Nunca ativa nenhum beneficio sozinho — so o painel admin faz isso.
 */
export function PixCheckout({ resumableRequest }: { resumableRequest: ResumableRequest | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, setState] = useState<CheckoutState>(() => initialStateFor(resumableRequest));
  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function generatePix(amountCents: number) {
    setPending(true);
    try {
      const response = await fetch("/api/support/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents })
      });
      const payload = await response.json();
      if (!response.ok) {
        toast({ title: "Nao foi possivel gerar o PIX", description: "Tente novamente em instantes.", variant: "error" });
        return;
      }
      setState({ step: "pay", supportRequestId: payload.data.supportRequestId, pixPayload: payload.data.pixPayload, amountCents });
    } finally {
      setPending(false);
    }
  }

  async function copyCode(pixPayload: string) {
    await navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function submitReceipt(supportRequestId: string, amountCents: number, file: File) {
    if (file.size > MAX_RECEIPT_BYTES) {
      toast({ title: "Comprovante muito grande", description: "Envie uma imagem de ate 1,5MB.", variant: "error" });
      return;
    }

    setPending(true);
    try {
      const receiptDataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/support/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportRequestId, receiptDataUrl })
      });
      if (!response.ok) {
        toast({ title: "Nao foi possivel enviar o comprovante", variant: "error" });
        return;
      }
      setState({ step: "awaiting-review", supportRequestId, amountCents });
      toast({ title: "Comprovante enviado", description: "Sua solicitacao ficou pendente de analise.", variant: "success" });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (state.step === "awaiting-review") {
    return (
      <Card className="space-y-3 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/12 text-primary-text">
          <ClockIcon className="h-6 w-6" />
        </span>
        <h2 className="text-xl font-bold text-ink">Recebemos seu comprovante.</h2>
        <p className="mx-auto max-w-sm text-sm text-muted">
          Sua solicitacao esta pendente de analise. Assim que um administrador confirmar o pagamento, seus beneficios de
          Apoiador sao ativados automaticamente e voce recebe uma notificacao.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && state.step === "awaiting-review") submitReceipt(state.supportRequestId, state.amountCents, file);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="ghost" size="sm" loading={pending} onClick={() => fileInputRef.current?.click()}>
          <UploadIcon className="h-4 w-4" />
          Enviar outro comprovante
        </Button>
      </Card>
    );
  }

  if (state.step === "pay") {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(state.pixPayload)}`;
    return (
      <Card className="space-y-5">
        <div className="flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code PIX" width={220} height={220} className="rounded-2xl border border-border" />
          <p className="text-sm text-muted">
            Escaneie o QR Code no app do seu banco ou copie o codigo abaixo (PIX Copia e Cola).
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-strong/40 p-3">
          <code className="min-w-0 flex-1 truncate text-xs text-muted">{state.pixPayload}</code>
          <Button type="button" variant="ghost" size="sm" onClick={() => copyCode(state.pixPayload)}>
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <div className="space-y-2 rounded-2xl border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted">Ja fez o PIX? Envie o comprovante para colocarmos sua solicitacao em analise.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) submitReceipt(state.supportRequestId, state.amountCents, file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            className="w-full"
            loading={pending}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="h-4 w-4" />
            Enviar comprovante
          </Button>
        </div>

        <p className="text-center text-xs text-subtle">
          Um administrador vai analisar o pagamento apos o envio do comprovante — a confirmacao pode levar alguns instantes.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Escolha um valor</h2>
        <p className="text-sm text-muted">Todos os valores recebem exatamente os mesmos beneficios.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUGGESTED_AMOUNTS.map((amount) => (
          <button
            key={amount.cents}
            type="button"
            onClick={() => {
              setSelectedCents(amount.cents);
              setCustomValue("");
            }}
            className={`rounded-2xl border p-4 text-center font-semibold transition ${
              selectedCents === amount.cents
                ? "border-primary bg-primary/10 text-primary-text"
                : "border-border text-ink hover:border-border-strong"
            }`}
          >
            {amount.label}
          </button>
        ))}
        <div
          className={`col-span-2 flex items-center gap-2 rounded-2xl border p-2 sm:col-span-1 ${
            selectedCents === null && customValue ? "border-primary" : "border-border"
          }`}
        >
          <span className="pl-2 text-sm text-muted">R$</span>
          <input
            type="number"
            min={1}
            placeholder="Outro"
            value={customValue}
            onChange={(event) => {
              setCustomValue(event.target.value);
              setSelectedCents(null);
            }}
            className="w-full bg-transparent py-2 text-sm text-ink outline-none"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="primary"
        size="md"
        className="w-full"
        loading={pending}
        disabled={selectedCents === null && !customValue}
        onClick={() => {
          const cents = selectedCents ?? Math.round(Number(customValue) * 100);
          if (cents > 0) generatePix(cents);
        }}
      >
        Gerar PIX
      </Button>
    </Card>
  );
}
