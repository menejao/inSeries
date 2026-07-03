"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon } from "@/components/ui/icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side visibility only; server-side errors are already captured by lib/logger + lib/errors.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="flex max-w-md flex-col items-center gap-4 text-center animate-fade-in-up">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/12 text-danger-text">
          <AlertCircleIcon className="h-7 w-7" />
        </span>
        <div>
          <p className="text-lg font-semibold text-ink">Algo deu errado</p>
          <p className="mt-2 text-sm text-muted">Nao foi possivel carregar esta pagina. Tente novamente em instantes.</p>
        </div>
        <Button onClick={reset}>Tentar novamente</Button>
      </Card>
    </div>
  );
}
