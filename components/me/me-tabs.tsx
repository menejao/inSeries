import { Tabs } from "@/components/ui/tabs";

export const ME_TABS = [
  { href: "/me", label: "Resumo" },
  { href: "/watch-next", label: "Assistir a seguir" },
  // INSERIES-MY-LISTS-PREMIUM-01 — substitui as 3 abas fragmentadas (Assistindo/Concluidas/
  // Watchlist, que nunca cobriram Pausadas/Abandonadas/Favoritas) por uma unica aba com os
  // 6 grupos completos. /me/watching, /me/watchlist e /me/completed viram redirects.
  { href: "/me/minha-lista", label: "Minha Lista" },
  { href: "/me/lists", label: "Listas" },
  { href: "/me/stats", label: "Estatisticas" },
  { href: "/me/recap", label: "Recap" },
  { href: "/me/achievements", label: "Conquistas" }
];

export function MeTabs({ active }: { active: string }) {
  return <Tabs items={ME_TABS} active={active} label="Secoes da minha area" />;
}
