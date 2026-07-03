import { config } from "@/lib/config";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogContext = {
  requestId?: string;
  userId?: string | null;
  route?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|api[_-]?key|authorization/i;

/** Recursively strips known-sensitive keys so they can never reach logs, even inside nested metadata. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redact(entryValue, depth + 1);
    }
    return result;
  }

  return value;
}

function shouldLog(level: LogLevel) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[config.logging.level as LogLevel];
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: context?.requestId,
    userId: context?.userId ?? undefined,
    route: context?.route,
    metadata: context?.metadata ? redact(context.metadata) : undefined
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context)
};
