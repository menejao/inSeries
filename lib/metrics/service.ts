/**
 * In-memory metrics store. Deliberately simple (a plain counters object kept on
 * globalThis so it survives Next.js dev hot-reload, mirroring the Prisma client
 * singleton pattern in lib/db/prisma.ts). Never persisted, resets on restart.
 *
 * Prepared for future replacement: swap `state`/these functions for a
 * Prometheus client or OpenTelemetry meter without changing call sites —
 * every call site here only ever calls the exported functions below.
 */
type MetricsState = {
  totalRequests: number;
  totalResponseTimeMs: number;
  status4xx: number;
  status5xx: number;
  logins: number;
  registrations: number;
  syncsStarted: number;
  notificationsCreated: number;
  activitiesCreated: number;
  recommendationsGenerated: number;
  recommendationCacheHits: number;
  recommendationCacheMisses: number;
  startedAt: string;
};

function createInitialState(): MetricsState {
  return {
    totalRequests: 0,
    totalResponseTimeMs: 0,
    status4xx: 0,
    status5xx: 0,
    logins: 0,
    registrations: 0,
    syncsStarted: 0,
    notificationsCreated: 0,
    activitiesCreated: 0,
    recommendationsGenerated: 0,
    recommendationCacheHits: 0,
    recommendationCacheMisses: 0,
    startedAt: new Date().toISOString()
  };
}

declare global {
  var __inSeriesMetrics: MetricsState | undefined;
}

const state = globalThis.__inSeriesMetrics ?? createInitialState();
globalThis.__inSeriesMetrics = state;

export function recordRequestMetric(status: number, durationMs: number) {
  state.totalRequests += 1;
  state.totalResponseTimeMs += durationMs;
  if (status >= 400 && status < 500) state.status4xx += 1;
  if (status >= 500) state.status5xx += 1;
}

export function incrementLogin() {
  state.logins += 1;
}

export function incrementRegistration() {
  state.registrations += 1;
}

export function incrementSyncStarted() {
  state.syncsStarted += 1;
}

export function incrementNotificationsCreated(count = 1) {
  state.notificationsCreated += count;
}

export function incrementActivitiesCreated() {
  state.activitiesCreated += 1;
}

export function incrementRecommendationsGenerated(count = 1) {
  state.recommendationsGenerated += count;
}

export function incrementRecommendationCacheHit() {
  state.recommendationCacheHits += 1;
}

export function incrementRecommendationCacheMiss() {
  state.recommendationCacheMisses += 1;
}

export function getMetricsSnapshot() {
  return {
    ...state,
    averageResponseTimeMs: state.totalRequests > 0 ? Math.round(state.totalResponseTimeMs / state.totalRequests) : 0
  };
}
