import { getDictionary } from "./i18n";
import { contentEngineConfig } from "../config";

export interface CaptionParts {
  hook: string;
  context: string;
  content: string;
  question?: string;
  cta: string;
}

/**
 * Assembles hook + context + content + question + CTA + hashtags. Configurable max length
 * (default 2200, Instagram's real caption cap) — when over budget, trims non-essential parts
 * first (question, then context) and NEVER truncates the CTA (it always carries "link na bio").
 */
export function buildCaption(parts: CaptionParts, hashtags: string[], maxLength: number = contentEngineConfig.captionMaxLength): string {
  const dict = getDictionary();
  const question = parts.question ?? dict.captionConnectors.question;
  const hashtagLine = hashtags.join(" ");

  const sections = {
    hook: parts.hook,
    context: parts.context,
    content: parts.content,
    question,
    cta: parts.cta,
    hashtags: hashtagLine
  };

  function assemble(active: typeof sections): string {
    return [active.hook, active.context, active.content, active.question, active.cta, active.hashtags]
      .filter((s) => s && s.trim().length > 0)
      .join("\n\n");
  }

  let current = { ...sections };
  let result = assemble(current);

  // Trim order: question first, then context — content and hook stay (they carry the topic),
  // CTA and hashtags are never removed/truncated.
  if (result.length > maxLength) {
    current = { ...current, question: "" };
    result = assemble(current);
  }
  if (result.length > maxLength) {
    current = { ...current, context: "" };
    result = assemble(current);
  }
  if (result.length > maxLength) {
    // Last resort: trim the content body itself, but keep hook/CTA/hashtags whole.
    const fixedLength =
      current.hook.length + current.cta.length + current.hashtags.length + 8; // separators budget
    const budget = Math.max(0, maxLength - fixedLength);
    current = { ...current, content: current.content.slice(0, budget).trimEnd() };
    result = assemble(current);
  }

  return result;
}
