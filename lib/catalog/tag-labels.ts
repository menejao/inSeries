import type { ComponentType } from "react";
import type { BadgeVariant } from "@/components/ui/badge";
import type { IconProps } from "@/components/ui/icons";
import {
  BookIcon,
  FilmIcon,
  FlameIcon,
  PlayIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  CalendarIcon
} from "@/components/ui/icons";

/**
 * Fase 4 (INSERIES-CATALOG-INTELLIGENCE-EXPERIENCE-01) — each Collection Tag
 * (lib/catalog/collection-tags.ts) gets its own color+icon pairing so the badges read as
 * distinct "kinds" of signal at a glance, not one generic pill repeated eleven times.
 */
const TAG_VARIANTS: Record<string, BadgeVariant> = {
  Maratona: "primary",
  "Minissérie": "secondary",
  "Baseada em Livro": "success",
  Premiada: "warning",
  "Em Alta": "danger",
  "Longa Duração": "outline",
  "Sci-Fi": "primary",
  Drama: "secondary",
  "Mistério": "outline",
  Crime: "danger",
  Anime: "warning"
};

const TAG_ICONS: Record<string, ComponentType<IconProps>> = {
  Maratona: PlayIcon,
  "Minissérie": FilmIcon,
  "Baseada em Livro": BookIcon,
  Premiada: TrophyIcon,
  "Em Alta": FlameIcon,
  "Longa Duração": CalendarIcon,
  "Sci-Fi": SparklesIcon,
  Drama: FilmIcon,
  "Mistério": SearchIcon,
  Crime: ShieldIcon,
  Anime: StarIcon
};

export function getTagBadgeVariant(tag: string): BadgeVariant {
  return TAG_VARIANTS[tag] ?? "default";
}

export function getTagIcon(tag: string): ComponentType<IconProps> | null {
  return TAG_ICONS[tag] ?? null;
}
