"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownItem } from "@/components/ui/dropdown";
import { LogOutIcon } from "@/components/ui/icons";

function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return { logout, loading };
}

export function LogoutButton() {
  const { logout, loading } = useLogout();
  return (
    <Button variant="secondary" onClick={logout} loading={loading}>
      Sair
    </Button>
  );
}

export function LogoutMenuItem() {
  const { logout, loading } = useLogout();
  return (
    <DropdownItem onClick={logout} disabled={loading} className="text-danger-text">
      <LogOutIcon className="h-4 w-4" />
      Sair
    </DropdownItem>
  );
}
