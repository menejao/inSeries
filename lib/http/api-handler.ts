import { logger } from "@/lib/logger";
import { recordRequestMetric } from "@/lib/metrics/service";
import { toErrorResponse } from "@/lib/errors";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/lib/observability/request-id";

type RouteHandler<Context> = (request: Request, context: Context) => Promise<Response> | Response;

/**
 * Wraps a Next.js route handler with the cross-cutting concerns every API
 * route needs: request id propagation, structured request logging, basic
 * metrics (total requests/avg duration/4xx/5xx) and a safety net that turns
 * any uncaught exception into a consistent, stack-trace-free response instead
 * of leaking to the client or crashing the process.
 *
 * Route-specific validation/business errors (e.g. `{ error: "invalid_payload" }`)
 * are untouched — this only wraps around them, it never replaces them.
 */
export function withApiObservability<Context = unknown>(routeName: string, handler: RouteHandler<Context>): RouteHandler<Context> {
  return async (request: Request, context: Context) => {
    const start = Date.now();
    const requestId = getOrCreateRequestId(request);

    try {
      const response = await handler(request, context);
      const durationMs = Date.now() - start;
      response.headers.set(REQUEST_ID_HEADER, requestId);
      recordRequestMetric(response.status, durationMs);
      logger.info("api_request", {
        requestId,
        route: routeName,
        metadata: { method: request.method, status: response.status, durationMs }
      });
      return response;
    } catch (error) {
      const durationMs = Date.now() - start;
      const { response, envelope } = toErrorResponse(error);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      recordRequestMetric(envelope.status, durationMs);
      logger.error("api_request_failed", {
        requestId,
        route: routeName,
        metadata: {
          method: request.method,
          status: envelope.status,
          code: envelope.code,
          durationMs,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      return response;
    }
  };
}

/** Convenience for handlers that don't need this wrapper's Context generic (e.g. no dynamic params). */
export type ObservedRouteHandler = RouteHandler<unknown>;
