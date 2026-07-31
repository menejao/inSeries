import { getDictionary } from "./i18n";
import { isCtaRepeated, type RecentContentWindow } from "./repetition-guard";
import type { ContentFormatKey } from "../config";

export interface CtaDefinition {
  id: string;
  text: string;
  category: string;
  compatibleFormats: ContentFormatKey[] | "*";
  lastUsedAt: Date | null;
  active: boolean;
}

const ALL_FORMATS: ContentFormatKey[] | "*" = "*";

/** 5 seed CTAs — always mentions "link na bio" (see i18n/pt-BR.ts's `ctas`). */
function seedCtas(): CtaDefinition[] {
  const dict = getDictionary();
  return dict.ctas.map((cta) => ({
    id: cta.id,
    text: cta.text,
    category: cta.category,
    compatibleFormats: ALL_FORMATS,
    lastUsedAt: null,
    active: true
  }));
}

function isCompatible(cta: CtaDefinition, format: string): boolean {
  return cta.compatibleFormats === "*" || (cta.compatibleFormats as string[]).includes(format);
}

export interface SelectedCta {
  id: string;
  text: string;
}

/** Picks a CTA compatible with `format`, never repeating the CTA used in the immediately preceding piece of content, filling in `title` and always keeping "link na bio". */
export function selectCta(window: RecentContentWindow, format: string, title: string): SelectedCta {
  const candidates = seedCtas().filter((cta) => cta.active && isCompatible(cta, format));
  const nonRepeating = candidates.filter((cta) => !isCtaRepeated(window, cta.id));
  const pool = nonRepeating.length > 0 ? nonRepeating : candidates;

  const chosen = pool[0] ?? seedCtas()[0];
  return { id: chosen.id, text: chosen.text.replace("{title}", title) };
}
