"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ModerationButton({
  action,
  endpoint,
  confirmMessage
}: {
  action: "hide" | "restore";
  endpoint: string;
  confirmMessage: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      await fetch(endpoint, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={action === "hide" ? "secondary" : "primary"} onClick={handleClick} disabled={loading}>
      {loading ? "Aguarde..." : action === "hide" ? "Ocultar" : "Restaurar"}
    </Button>
  );
}
