import { Tabs } from "@/components/ui/tabs";

export const ME_TABS = [
  { href: "/me", label: "Resumo" },
  { href: "/me/watching", label: "Assistindo" },
  { href: "/me/completed", label: "Concluidas" },
  { href: "/me/watchlist", label: "Watchlist" },
  { href: "/me/lists", label: "Listas" },
  { href: "/me/stats", label: "Estatisticas" }
];

export function MeTabs({ active }: { active: string }) {
  return <Tabs items={ME_TABS} active={active} label="Secoes da minha area" />;
}
