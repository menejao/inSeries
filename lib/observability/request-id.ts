export const REQUEST_ID_HEADER = "x-request-id";

/** Reuses an inbound request id (set by middleware, or a caller/proxy) instead of always minting a new one. */
export function getOrCreateRequestId(request: Request): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
}
