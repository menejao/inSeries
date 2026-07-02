export const futureJobs = [
  "import-series",
  "refresh-episodes",
  "refresh-seasons",
  "refresh-images",
  "refresh-statuses"
] as const;

export function listFutureJobs() {
  return futureJobs.map((name) => ({
    name,
    queue: "catalog-sync",
    status: "planned"
  }));
}
