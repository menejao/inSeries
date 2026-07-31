import { contentRepo } from "../db/content-repo";
import { recordHistory } from "../history";
import type { SocialContent } from "@prisma/client";

export interface GenerateContentInput {
  type: string;
  title: string;
  description: string;
  templateId?: string | null;
}

/**
 * ContentGenerator is the extension point for real AI generation later.
 * Nothing in this package implements real AI — only manual/no-op stubs.
 */
export interface ContentGenerator {
  generate(input: GenerateContentInput): Promise<SocialContent>;
}

/** Always throws — a placeholder proving the interface shape before any real generator exists. */
export class NoopContentGenerator implements ContentGenerator {
  async generate(): Promise<SocialContent> {
    throw new Error("NoopContentGenerator cannot generate content — register a real ContentGenerator implementation.");
  }
}

/**
 * Creates a SocialContent DRAFT from text supplied by a human. This is the
 * only generator wired into the manual flow — no AI call, no network call.
 */
export class ManualContentGenerator implements ContentGenerator {
  async generate(input: GenerateContentInput): Promise<SocialContent> {
    const content = await contentRepo.create({
      type: input.type,
      title: input.title,
      description: input.description,
      templateId: input.templateId ?? null
    });

    await recordHistory({
      action: "CONTENT_GENERATED",
      contentId: content.id,
      detail: { type: input.type, title: input.title, source: "manual" }
    });

    return content;
  }
}
