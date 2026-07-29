"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyIcon, CheckIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";

const SUGGESTED_AMOUNTS = [
  { label: "R$ 5", cents: 500 },
  { label: "R$ 10", cents: 1000 },
  { label: "R$ 20", cents: 2000 }
];

type CheckoutState =
  | { step: "pick" }
  | { step: "pay"; contributionId: string; pixPayload: string; amountCents: number }
  | { step: "thanks" };

/** INSERIES-SUPPORTER-SYSTEM-01 — o fluxo inteiro: escolher valor -> gerar PIX (QR + copia-e-cola) -> confirmar -> agradecimento. */
export function PixCheckout() {
  const { toast } = useToast();
  const [state, setState] = useState<CheckoutState>({ step: "pick" });
  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setState({ step: "pay", contributionId: payload.data.contributionId, pixPayload: payload.data.pixPayload, amountCents });
    } finally {
      setPending(false);
    }
  }

  async function copyCode(pixPayload: string) {
    await navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function confirm(contributionId: string) {
    setPending(true);
    try {
      const response = await fetch("/api/support/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId })
      });
      if (!response.ok) {
        toast({ title: "Nao foi possivel confirmar agora", variant: "error" });
        return;
      }
      setState({ step: "thanks" });
    } finally {
      setPending(false);
    }
  }

  if (state.step === "thanks") {
    return (
      <Card className="space-y-2 text-center">
        <p className="text-3xl">❤️</p>
        <h2 className="text-xl font-bold text-ink">Obrigado por apoiar o inSeries.</h2>
        <p className="mx-auto max-w-sm text-sm text-muted">Seu apoio ajuda a plataforma a continuar evoluindo para toda a comunidade.</p>
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

        <p className="text-center text-xs text-subtle">A confirmacao pode levar alguns instantes apos o pagamento.</p>

        <Button type="button" variant="primary" size="md" className="w-full" loading={pending} onClick={() => confirm(state.contributionId)}>
          Ja fiz o PIX
        </Button>
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
