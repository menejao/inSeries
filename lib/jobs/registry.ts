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
