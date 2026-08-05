"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

const errorMessages: Record<string, string> = {
  invalid_payload: "A senha precisa ter pelo menos 8 caracteres.",
  unauthorized: "Sessao expirada. Entre novamente.",
  request_failed: "Ocorreu um erro inesperado. Tente novamente."
};

export function ChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordId = useId();
  const confirmId = useId();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMismatch(false);
        const formData = new FormData(event.currentTarget);
        const password = String(formData.get("password") ?? "");
        const confirm = String(formData.get("confirm") ?? "");

        if (password !== confirm) {
          setMismatch(true);
          return;
        }

        startTransition(async () => {
          const response = await fetch("/api/auth/change-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password })
          });
          const result = (await response.json().catch(() => ({}))) as { error?: string };

          if (!response.ok) {
            setError(result.error ?? "request_failed");
            return;
          }

          router.push("/");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={passwordId} className="text-sm font-medium text-ink">
          Nova senha
        </label>
        <div className="relative">
          <Input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Minimo 8 caracteres"
            minLength={8}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle transition hover:text-ink"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={confirmId} className="text-sm font-medium text-ink">
          Confirme a nova senha
        </label>
        <Input id={confirmId} name="confirm" type={showPassword ? "text" : "password"} placeholder="Repita a senha" minLength={8} required />
      </div>
      <Button className="w-full" size="lg" disabled={isPending} loading={isPending}>
        Salvar nova senha
      </Button>
      {mismatch ? (
        <Alert variant="danger" title="As senhas nao coincidem">
          Digite a mesma senha nos dois campos.
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title="Nao foi possivel continuar">
          {errorMessages[error] ?? error}
        </Alert>
      ) : null}
    </form>
  );
}
