export const futureJobs = [
  "import-series",
  "refresh-episodes",
  "refresh-seasons",
  "refresh-images",
  "refresh-statuses"
] as const;

export const futureCalendarJobs = [
  "sync-episode-air-dates",
  "detect-new-seasons",
  "detect-date-changes"
] as const;

export type FutureCatalogSyncJob = {
  name: string;
  schedule: string;
  runs: string;
  status: "planned";
};

/**
 * Prepared schedule for a future scheduler (cron, Vercel Cron, BullMQ repeatable
 * jobs, etc). No cron is wired up yet — these only document what each job would
 * call and how often, so `lib/catalog/sync.ts` can be plugged in without redesign.
 */
export const futureCatalogSyncJobs: FutureCatalogSyncJob[] = [
  {
    name: "daily-popular-series-sync",
    schedule: "0 3 * * *",
    runs: "syncPopularSeries({ pages: 2 })",
    status: "planned"
  },
  {
    name: "daily-upcoming-episodes-sync",
    schedule: "0 4 * * *",
    runs: "syncExistingSeriesDetails() scoped to series with WATCHING/WANT_TO_WATCH status",
    status: "planned"
  },
  {
    name: "weekly-full-metadata-refresh",
    schedule: "0 5 * * 0",
    runs: "syncFullRefresh({ pages: 3 })",
    status: "planned"
  }
];

export function listFutureJobs() {
  return futureJobs.map((name) => ({
    name,
    queue: "catalog-sync",
    status: "planned"
  }));
}

export function listFutureCalendarJobs() {
  return futureCalendarJobs.map((name) => ({
    name,
    queue: "calendar-sync",
    status: "planned"
  }));
}

export function listFutureCatalogSyncJobs() {
  return futureCatalogSyncJobs;
}
