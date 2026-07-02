import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  TMDB_API_KEY: z.string().min(1).optional(),
  TMDB_ACCESS_TOKEN: z.string().min(1).optional(),
  TMDB_BASE_URL: z.string().url().optional(),
  TMDB_LANGUAGE: z.string().min(2).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional()
});

const parsed = envSchema.safeParse(process.env);

export const env = parsed.success ? parsed.data : {};

export function getTmdbCredentials() {
  const apiKey = env.TMDB_API_KEY?.trim();
  const accessToken = env.TMDB_ACCESS_TOKEN?.trim();

  return {
    apiKey,
    accessToken,
    isConfigured: Boolean(apiKey || accessToken)
  };
}

export function getTmdbBaseUrl() {
  return env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
}

export function getTmdbLanguage() {
  return env.TMDB_LANGUAGE ?? "pt-BR";
}
