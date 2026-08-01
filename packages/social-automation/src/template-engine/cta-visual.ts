/**
 * INSERIES-SOCIAL-TEMPLATE-ENGINE-04-FINALIZATION — derivacao VISUAL do CTA.
 *
 * Problema que isto resolve: o slide final do carrossel (e o CTA de story/feed) usava
 * `payload.cta.text` inteiro como titulo E como botao. Com um CTA editorial longo (~150 chars) a
 * arte ficava com o mesmo paragrafo repetido duas vezes.
 *
 * ESTA E UMA CAMADA DE APRESENTACAO. Nada aqui altera o payload editorial: o Content Engine
 * continua produzindo `cta.text` e o `SocialContent.payload.cta.text` persistido no banco continua
 * intocado — a legenda publicada segue usando o CTA completo. Aqui apenas decidimos como aquele
 * mesmo texto e distribuido em tres areas visuais distintas:
 *
 *   headline — chamada curta (<= 48 chars, nunca corta palavra no meio);
 *   body     — o CTA editorial (ou o que sobra dele), truncado a 120 chars;
 *   action   — o rotulo do botao, uma de poucas strings curtas fixas.
 *
 * REGRA CENTRAL: o texto integral do CTA original nunca aparece em duas areas ao mesmo tempo.
 */
import { truncate } from "./utils";
import { TemplateEngineError } from "./types";
import type { ContentPayload } from "../content-engine/types";

export interface CtaVisual {
  headline: string;
  body: string;
  action: string;
}

export const CTA_HEADLINE_MAX = 48;
export const CTA_BODY_MAX = 120;

/** Rotulos de botao permitidos. Escolha SEMPRE deterministica (ver `deriveAction`), nunca aleatoria. */
export const CTA_ACTIONS = {
  bio: "Link na bio",
  bioAlt: "Acesse pela bio",
  knowInseries: "Conheca o inSeries",
  continueInseries: "Continue no inSeries",
  discover: "Descubra mais"
} as const;

/** Headline generica por templateKey — usada quando o CTA original nao oferece uma abertura curta. */
const HEADLINE_BY_TEMPLATE: Record<string, string> = {
  "series-of-the-day": "Sua serie de hoje",
  "similar-series": "Gostou dessas recomendacoes?",
  trending: "Bombando essa semana",
  "weekly-premieres": "Nao perca as estreias",
  ranking: "Concorda com o ranking?",
  poll: "Qual e a sua escolha?",
  "themed-list": "Salve essa lista",
  "inseries-feature": "Continue sua jornada"
};

const DEFAULT_HEADLINE = "Continue sua jornada";
/** Usada quando a headline generica coincidiria com o body (evita duplicacao acidental). */
const FALLBACK_HEADLINE = "Gostou dessas recomendacoes?";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Comparacao tolerante a caixa/acento/pontuacao — usada so para detectar duplicacao. */
function normalizeForCompare(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Campos estruturados proprios, se o payload um dia passar a te-los. Hoje o `ContentPayload` do
 * Content Engine NAO os declara (isso pertence a outro ticket), entao na pratica cai sempre no
 * fallback derivado. Sao lidos de forma defensiva do proprio payload ou de `payload.extra`.
 */
function structuredOverride(payload: unknown): Partial<CtaVisual> {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const extra = (record.extra && typeof record.extra === "object" ? record.extra : {}) as Record<string, unknown>;
  const pick = (key: string) => clean(record[key]) || clean(extra[key]);
  return {
    headline: pick("ctaHeadline") || undefined,
    body: pick("ctaBody") || undefined,
    action: pick("ctaAction") || undefined
  };
}

/** Primeira frase do CTA + o que sobra dela. */
function splitFirstSentence(text: string): { first: string; rest: string } {
  const match = text.match(/^(.+?[.!?…])\s+(.*)$/s);
  if (!match) return { first: text, rest: "" };
  return { first: match[1].replace(/[\s.!?…]+$/, "").trim(), rest: match[2].trim() };
}

function genericHeadline(templateKey: string | null | undefined): string {
  return HEADLINE_BY_TEMPLATE[templateKey ?? ""] ?? DEFAULT_HEADLINE;
}

/**
 * Rotulo do botao. Escada deterministica: mesmo CTA => mesmo rotulo, sempre.
 * Default "Link na bio"; se o proprio CTA ja diz "link na bio" usamos uma variacao para nao ecoar
 * a mesma frase no botao e no corpo.
 */
export function deriveAction(originalCta: string): string {
  const normalized = normalizeForCompare(originalCta);
  if (/\blink na bio\b/.test(normalized)) return CTA_ACTIONS.bioAlt;
  if (/\bbio\b/.test(normalized)) return CTA_ACTIONS.bio;
  if (/\binseries\b/.test(normalized)) return CTA_ACTIONS.continueInseries;
  if (/\b(app|aplicativo|site|plataforma)\b/.test(normalized)) return CTA_ACTIONS.knowInseries;
  return CTA_ACTIONS.bio;
}

/**
 * Deriva as tres areas visuais do CTA. Lanca `TemplateEngineError` quando nao ha CTA algum —
 * renderizar uma area de CTA vazia seria pior do que falhar alto.
 */
export function resolveCtaVisual(payload: ContentPayload | null | undefined, templateKey?: string | null): CtaVisual {
  if (!payload || typeof payload !== "object") {
    throw new TemplateEngineError("resolveCtaVisual(): payload ausente — nao e possivel compor o CTA visual.");
  }
  const key = templateKey ?? payload.templateKey ?? null;
  const original = clean(payload.cta?.text);
  const override = structuredOverride(payload);

  if (!original && !override.headline && !override.body && !override.action) {
    throw new TemplateEngineError(
      `template "${key ?? "?"}": payload.cta.text vazio — todo formato exige CTA visivel, nada foi renderizado.`
    );
  }

  // Campos estruturados vencem a derivacao, quando existirem.
  if (override.headline && override.body && override.action) {
    return finalize(
      {
        headline: truncate(override.headline, CTA_HEADLINE_MAX),
        body: truncate(override.body, CTA_BODY_MAX),
        action: truncate(override.action, 28)
      },
      original,
      key
    );
  }

  const action = override.action ? truncate(override.action, 28) : deriveAction(original);
  const { first, rest } = splitFirstSentence(original);

  let headline: string;
  let body: string;

  if (override.headline) {
    headline = truncate(override.headline, CTA_HEADLINE_MAX);
    body = truncate(override.body ?? original, CTA_BODY_MAX);
  } else if (rest && first.length <= CTA_HEADLINE_MAX) {
    // O CTA ja traz uma abertura curta: ela vira a headline e SO o restante vai para o corpo,
    // de modo que nenhum trecho aparece nas duas areas.
    headline = first;
    body = truncate(override.body ?? rest, CTA_BODY_MAX);
  } else {
    headline = genericHeadline(key);
    body = truncate(override.body ?? original, CTA_BODY_MAX);
  }

  return finalize({ headline, body, action }, original, key);
}

/** Ultima linha de defesa: garante headline != action e nenhuma area igual a outra. */
function finalize(visual: CtaVisual, original: string, templateKey: string | null): CtaVisual {
  let { headline, body, action } = visual;

  if (!headline) headline = genericHeadline(templateKey);
  if (!body) body = truncate(original, CTA_BODY_MAX) || headline;
  if (!action) action = CTA_ACTIONS.bio;

  if (normalizeForCompare(headline) === normalizeForCompare(body)) {
    headline = genericHeadline(templateKey);
    if (normalizeForCompare(headline) === normalizeForCompare(body)) headline = FALLBACK_HEADLINE;
    if (normalizeForCompare(headline) === normalizeForCompare(body)) headline = DEFAULT_HEADLINE;
  }
  if (normalizeForCompare(headline) === normalizeForCompare(action)) {
    headline = genericHeadline(templateKey);
    if (normalizeForCompare(headline) === normalizeForCompare(action)) headline = FALLBACK_HEADLINE;
  }
  if (normalizeForCompare(body) === normalizeForCompare(action)) {
    action = action === CTA_ACTIONS.bio ? CTA_ACTIONS.discover : CTA_ACTIONS.bio;
  }

  return { headline, body, action };
}
