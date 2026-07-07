import { TmdbApiError, TmdbConfigurationError, TmdbTimeoutError } from "@/lib/tmdb/service";

/** Never includes API keys/tokens — only safe, human-readable context. Shared by every sync module. */
export function describeTmdbError(error: unknown): string {
  if (error instanceof TmdbConfigurationError) return error.message;
  if (error instanceof TmdbTimeoutError) return error.message;
  if (error instanceof TmdbApiError) return `${error.message} (status ${error.status})`;
  if (error instanceof Error) return error.message;
  return "Erro desconhecido durante a sincronizacao.";
}
