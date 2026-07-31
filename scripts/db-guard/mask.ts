/**
 * Masks the userinfo (user:password) segment of a Postgres connection string so credentials
 * never reach stdout/logs. `postgresql://user:pass@host:port/db?schema=x` -> `postgresql://user:***@host:port/db?schema=x`.
 */
export function maskDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return "<not set>";

  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    // Not a parseable URL (shouldn't happen for valid Postgres URLs) — redact defensively.
    return rawUrl.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  }
}

export type DbIdentity = {
  host: string;
  port: string;
  database: string;
  schema: string;
};

export function parseDbIdentity(rawUrl: string | undefined): DbIdentity | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname,
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, ""),
      schema: url.searchParams.get("schema") ?? "public"
    };
  } catch {
    return null;
  }
}

export function sameDatabase(a: DbIdentity | null, b: DbIdentity | null): boolean {
  if (!a || !b) return false;
  return a.host === b.host && a.port === b.port && a.database === b.database && a.schema === b.schema;
}
