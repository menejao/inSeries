"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <Card className="mx-auto max-w-lg space-y-4">
      <h1 className="section-title">{mode === "login" ? "Login" : "Cadastro"}</h1>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setSuccess(null);
          const formData = new FormData(event.currentTarget);
          const payload = Object.fromEntries(formData.entries());

          startTransition(async () => {
            const response = await fetch(`/api/auth/${mode}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const result = (await response.json()) as { error?: string; next?: string };

            if (!response.ok) {
              setError(result.error ?? "request_failed");
              return;
            }

            setSuccess(mode === "login" ? "Login realizado." : "Conta criada.");
            router.push(result.next ?? "/me");
            router.refresh();
          });
        }}
      >
        {mode === "register" ? <Input name="name" placeholder="Nome" required /> : null}
        {mode === "register" ? <Input name="username" placeholder="Username" required /> : null}
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Senha" minLength={8} required />
        <Button className="w-full" disabled={isPending}>
          {isPending ? "Enviando..." : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      {error ? <p className="text-sm text-rose-300">Erro: {error}</p> : null}
      {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
    </Card>
  );
}
