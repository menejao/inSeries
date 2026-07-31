import type { ContentGenerator } from "../content-generator";
import type { TemplateRenderer } from "../template-renderer";
import type { MediaGenerator } from "../media-generator";
import type { Publisher } from "../publisher";

/**
 * Orchestrates the pipeline end-to-end (generate -> render -> media ->
 * publish/schedule) purely via injected interfaces — no network-specific
 * code lives here. manual-flow/ wires concrete manual implementations into
 * this shape; a future automatic runner would wire real ones the same way.
 */
export interface ContentEnginePipeline {
  generator: ContentGenerator;
  renderer: TemplateRenderer;
  mediaGenerator: MediaGenerator;
  getPublisher: (network: string) => Publisher;
}

export type { ContentGenerator, TemplateRenderer, MediaGenerator, Publisher };
