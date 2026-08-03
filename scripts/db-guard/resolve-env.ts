import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolução determinística de variáveis de ambiente para o db-guard.
 *
 * Contexto (DB-GUARD-ENV-RESOLUTION-06): o wrapper usava `loadEnvConfig(cwd)` do `@next/env`.
 * Sem o segundo argumento (`dev`), o `@next/env` assume modo *produção* e carrega
 * `.env.production.local` com a MAIOR precedência. Esse arquivo (gerado por `vercel env pull`)
 * contém valores redigidos literais `"[SENSITIVE]"`, então `process.env.DATABASE_URL` virava a
 * string de 11 caracteres `[SENSITIVE]`. O Prisma CLI nunca foi afetado porque lê apenas `.env`.
 *
 * Regras adotadas aqui:
 * - precedência: variável já presente e VÁLIDA no processo > `.env.local` > `.env`;
 * - arquivos `.env.production*` / `.env.development*` NUNCA são lidos por este módulo;
 * - placeholders conhecidos (ex.: `[SENSITIVE]`) são tratados como "ausente", nunca como valor;
 * - nada aqui imprime ou retorna o valor bruto em mensagens de erro.
 */

/** Mapa de env aceito pelas funções deste módulo. `process.env` é atribuível a ele. */
export type EnvLike = Record<string, string | undefined>;

/** Valores literais que NUNCA podem ser aceitos como uma URL real. */
export const PLACEHOLDER_VALUES = ["[SENSITIVE]", "[REDACTED]", "[REDACTED_SECRET]", "<not set>", "undefined", "null"] as const;

/** Ordem de leitura: o último vence (override), igual à convenção do Next.js/`@next/env`. */
export const ENV_FILES = [".env", ".env.local"] as const;

const ALLOWED_PROTOCOLS = ["postgresql:", "postgres:"];

export type EnvSource = "process" | ".env" | ".env.local";

export type ResolvedEnvVar = {
  /** Valor real. Nunca logar. */
  value: string;
  /** De onde veio, para diagnóstico seguro (não revela o valor). */
  source: EnvSource;
};

export class EnvResolutionError extends Error {}

export function isPlaceholder(value: string | undefined): boolean {
  if (value === undefined) return false;
  return (PLACEHOLDER_VALUES as readonly string[]).includes(value.trim());
}

/** "Utilizável" = definida, não vazia/só-espaços e não um placeholder conhecido. */
export function isUsable(value: string | undefined): value is string {
  if (value === undefined) return false;
  if (value.trim() === "") return false;
  return !isPlaceholder(value);
}

/**
 * Parser mínimo de arquivo `.env` (KEY=value, aspas opcionais, `#` como comentário de linha
 * inteira). Deliberadamente sem dependência externa: `dotenv`/`@next/env` só existem aqui de
 * forma transitiva, e foi justamente a semântica do `@next/env` que causou o bug.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim().replace(/^export\s+/, "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(separator + 1).trim();
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    result[key] = value;
  }
  return result;
}

/** Lê `.env` e depois `.env.local` (override). Arquivos ausentes são ignorados em silêncio. */
export function readEnvFiles(cwd: string = process.cwd()): Array<{ file: EnvSource; values: Record<string, string> }> {
  const layers: Array<{ file: EnvSource; values: Record<string, string> }> = [];
  for (const file of ENV_FILES) {
    const path = join(cwd, file);
    if (!existsSync(path)) continue;
    layers.push({ file, values: parseEnvFile(readFileSync(path, "utf8")) });
  }
  return layers;
}

/**
 * Resolve uma variável qualquer com a precedência do módulo. Retorna `null` quando nenhuma
 * camada oferece um valor utilizável (a distinção ausente/placeholder fica com o chamador).
 */
export function resolveEnvVar(
  name: string,
  options: { cwd?: string; env?: EnvLike } = {}
): ResolvedEnvVar | null {
  const env = options.env ?? process.env;

  const fromProcess = env[name];
  if (isUsable(fromProcess)) return { value: fromProcess, source: "process" };

  // `.env.local` sobrepõe `.env`, então percorremos as camadas de trás para frente.
  for (const layer of readEnvFiles(options.cwd).reverse()) {
    const candidate = layer.values[name];
    if (isUsable(candidate)) return { value: candidate, source: layer.file };
  }

  return null;
}

export type DatabaseUrlResolution = ResolvedEnvVar & { variable: string };

function describeMissing(name: string, env: EnvLike): string {
  const raw = env[name];
  if (isPlaceholder(raw)) {
    return (
      `[db-guard] ${name} está definida como um placeholder redigido (ex.: "[SENSITIVE]", típico de ` +
      `.env.production.local gerado por "vercel env pull") e não pode ser usada. ` +
      `Defina ${name} com a URL real em .env ou .env.local.`
    );
  }
  if (raw !== undefined && raw.trim() === "") {
    return `[db-guard] ${name} está definida porém vazia. Defina ${name} com a URL real em .env ou .env.local.`;
  }
  return `[db-guard] ${name} ausente. Defina ${name} em .env ou .env.local (ou no ambiente do processo).`;
}

/**
 * Fonte única de verdade da URL do banco para `cli.ts` e `backup.ts`.
 * Nunca conecta; só valida formato e protocolo. Erros são sanitizados: dizem QUAL variável está
 * faltando/inválida, jamais o valor tentado.
 */
export function resolveDatabaseUrl(
  options: { cwd?: string; env?: EnvLike; variable?: string } = {}
): DatabaseUrlResolution {
  const env = options.env ?? process.env;
  const variable = options.variable ?? "DATABASE_URL";

  const resolved = resolveEnvVar(variable, { cwd: options.cwd, env });
  if (!resolved) {
    throw new EnvResolutionError(describeMissing(variable, env));
  }

  let protocol: string;
  try {
    protocol = new URL(resolved.value).protocol;
  } catch {
    throw new EnvResolutionError(
      `[db-guard] ${variable} (origem: ${resolved.source}) não é uma URL válida. Valor omitido por segurança.`
    );
  }

  if (!ALLOWED_PROTOCOLS.includes(protocol)) {
    throw new EnvResolutionError(
      `[db-guard] ${variable} (origem: ${resolved.source}) usa protocolo "${protocol}" — ` +
        `apenas ${ALLOWED_PROTOCOLS.join(" / ")} são aceitos.`
    );
  }

  return { ...resolved, variable };
}

/**
 * Aplica em `process.env` (mutação explícita) as variáveis que o guard precisa, sem jamais
 * sobrescrever um valor já utilizável vindo do processo pai. Substitui o `loadEnvConfig` do
 * `@next/env` no `cli.ts`. Retorna a origem escolhida por variável, para diagnóstico seguro.
 */
export function hydrateProcessEnv(
  names: readonly string[],
  options: { cwd?: string; env?: EnvLike } = {}
): Record<string, EnvSource | "unresolved"> {
  const env = options.env ?? process.env;
  const report: Record<string, EnvSource | "unresolved"> = {};

  for (const name of names) {
    const resolved = resolveEnvVar(name, { cwd: options.cwd, env });
    if (!resolved) {
      report[name] = "unresolved";
      // Um placeholder herdado é pior que "ausente": guards a jusante checam apenas presença.
      if (isPlaceholder(env[name])) delete env[name];
      continue;
    }
    env[name] = resolved.value;
    report[name] = resolved.source;
  }

  return report;
}
