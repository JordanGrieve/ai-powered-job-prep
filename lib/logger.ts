import "server-only";

/**
 * Minimal structured logger for service boundaries.
 *
 * The app previously had exactly one console call in the entire codebase (the
 * Clerk webhook catch), so the paid user-facing path - Hume fetch, Gemini
 * generation - failed with no record of what broke or for which interview.
 *
 * JSON lines so a log aggregator can parse them. Never log the API keys from
 * app/data/env/server.
 */

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const SENSITIVE = /^(.*(key|secret|token|password|authorization).*)$/i;

function redact(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = SENSITIVE.test(key) ? "[redacted]" : value;
  }
  return out;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error ? error.cause.message : error.cause,
    };
  }
  return { message: String(error) };
}

function emit(
  level: Level,
  boundary: string,
  message: string,
  context: LogContext = {},
) {
  const line = JSON.stringify({
    level,
    boundary,
    message,
    timestamp: new Date().toISOString(),
    ...redact(context),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Bind a logger to one service boundary. `correlationId` should be the most
 * useful identifier available at that boundary - an interview id, a Hume chat
 * id, a Clerk user id - so a failure can be traced back to a specific record.
 */
export function createLogger(boundary: string, base: LogContext = {}) {
  return {
    info: (message: string, context?: LogContext) =>
      emit("info", boundary, message, { ...base, ...context }),
    warn: (message: string, context?: LogContext) =>
      emit("warn", boundary, message, { ...base, ...context }),
    error: (message: string, error?: unknown, context?: LogContext) =>
      emit("error", boundary, message, {
        ...base,
        ...context,
        ...(error === undefined ? {} : { error: serializeError(error) }),
      }),
  };
}

export type Logger = ReturnType<typeof createLogger>;
