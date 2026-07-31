"use client";

import { usePathname } from "next/navigation";
import { Tabs, type TabItem } from "@/components/ui/tabs";

const ITEMS: TabItem[] = [
  { href: "/admin/social", label: "Visao geral" },
  { href: "/admin/social/conteudos", label: "Conteudos" },
  { href: "/admin/social/calendario", label: "Calendario" },
  { href: "/admin/social/templates", label: "Templates" },
  { href: "/admin/social/publicacoes", label: "Publicacoes" },
  { href: "/admin/social/historico", label: "Historico" },
  { href: "/admin/social/configuracoes", label: "Configuracoes" }
];

/** Client-side only so the active pill follows navigation; Tabs itself is route-driven. */
export function SocialSubNav() {
  const pathname = usePathname() ?? "/admin/social";

  // Longest matching prefix wins so /admin/social/conteudos/<id> keeps "Conteudos" active
  // while the exact "/admin/social" root does not swallow every child route.
  const active =
    [...ITEMS]
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "/admin/social";

  return <Tabs items={ITEMS} active={active} label="Secoes da automacao social" />;
}
