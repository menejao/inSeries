import type { PropsWithChildren } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Header } from "@/components/layout/header";
import { Navbar } from "@/components/layout/navbar";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <>
      <div className="shell">
        <Header />
        <Navbar />
        <main className="mt-8">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
