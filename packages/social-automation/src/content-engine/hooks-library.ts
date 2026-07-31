import { getDictionary } from "./i18n";
import { isHookRepeated, type RecentContentWindow } from "./repetition-guard";

export interface SelectedHook {
  id: string;
  text: string;
}

/** Picks a hook, never repeating the one used in the immediately preceding piece of content when an alternative exists. */
export function selectHook(window: RecentContentWindow, title: string): SelectedHook {
  const dict = getDictionary();
  const nonRepeating = dict.hooks.filter((hook) => !isHookRepeated(window, hook.id));
  const pool = nonRepeating.length > 0 ? nonRepeating : dict.hooks;
  const chosen = pool[0];
  return { id: chosen.id, text: chosen.text.replace("{title}", title) };
}
