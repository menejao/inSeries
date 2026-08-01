/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04 — public surface of the Template Engine.
 *
 * Import from here (not from the sub-folders) outside the package: `generatePublicationPackage`
 * and `renderPreview` are the only two functions a caller normally needs.
 */
export * from "./types";
export { templateRegistry, TEMPLATE_KEYS, getTemplateEntry, isTemplateKey, listTemplates, supportsFormat } from "./registry";
export { templates, getTemplate, requireTemplate } from "./templates";
export { themeRegistry, listThemes, resolveTheme, DEFAULT_THEME, type Theme, type ThemeKey } from "./themes";
export {
  render,
  renderAll,
  renderCached,
  closeRenderer,
  rendererIsAvailable,
  getRendererMetrics,
  cleanupRendererTempProfiles,
  scheduleDevTempProfileCleanup,
  previewCacheKey,
  clearRenderCache,
  PREVIEW_CACHE_TTL_MS,
  type RenderOptions,
  type RenderResult,
  type RendererMetrics,
  type PreviewCacheKeyInput
} from "./renderer";
export {
  resolveCtaVisual,
  deriveAction,
  CTA_ACTIONS,
  CTA_HEADLINE_MAX,
  CTA_BODY_MAX,
  type CtaVisual
} from "./cta-visual";
export {
  generatePublicationPackage,
  renderPreview,
  buildDocuments,
  availableFormats,
  type GeneratePackageOptions
} from "./preview";
export { hasEmbeddedFonts } from "./fonts";
