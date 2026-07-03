"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const usernameId = useId();
  const emailId = useId();
  const passwordId = useId();

  return (
    <Card className="mx-auto max-w-md space-y-5 animate-fade-in-up">
      <div className="space-y-1 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
          in
        </span>
        <h1 className="pt-2 text-2xl font-bold text-ink">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="text-sm text-muted">
          {mode === "login" ? "Continue de onde parou." : "Comece a acompanhar suas series."}
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
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

            router.push(result.next ?? "/me");
            router.refresh();
          });
        }}
      >
        {mode === "register" ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor={nameId} className="text-sm font-medium text-ink">
                Nome
              </label>
              <Input id={nameId} name="name" placeholder="Seu nome" required />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={usernameId} className="text-sm font-medium text-ink">
                Username
              </label>
              <Input id={usernameId} name="username" placeholder="seu_username" required />
            </div>
          </>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor={emailId} className="text-sm font-medium text-ink">
            Email
          </label>
          <Input id={emailId} name="email" type="email" placeholder="voce@email.com" required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="text-sm font-medium text-ink">
            Senha
          </label>
          <Input id={passwordId} name="password" type="password" placeholder="Minimo 8 caracteres" minLength={8} required />
        </div>
        <Button className="w-full" size="lg" disabled={isPending} loading={isPending}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
      {error ? (
        <Alert variant="danger" title="Nao foi possivel continuar">
          {error}
        </Alert>
      ) : null}
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            Ainda nao tem conta?{" "}
            <Link href="/register" className="link-accent">
              Criar conta
            </Link>
          </>
        ) : (
          <>
            Ja tem conta?{" "}
            <Link href="/login" className="link-accent">
              Entrar
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}
