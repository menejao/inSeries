import { recordHistory } from "../history";
import type { SocialContent, SocialTemplate } from "@prisma/client";

export interface RenderedCaption {
  caption: string;
}

/** Extension point for future real template rendering (variables, layouts, per-network limits). */
export interface TemplateRenderer {
  render(content: SocialContent, template: SocialTemplate | null): Promise<RenderedCaption>;
}

/**
 * Trivial renderer: applies no real templating logic, just concatenates the
 * content's title/description into a caption. Good enough to exercise the
 * full pipeline without any real template engine.
 */
export class PassthroughTemplateRenderer implements TemplateRenderer {
  async render(content: SocialContent, template: SocialTemplate | null): Promise<RenderedCaption> {
    const caption = template ? `[${template.name}] ${content.title}\n\n${content.description}` : `${content.title}\n\n${content.description}`;

    await recordHistory({
      action: "TEMPLATE_RENDERED",
      contentId: content.id,
      detail: { templateId: template?.id ?? null, captionLength: caption.length }
    });

    return { caption };
  }
}
