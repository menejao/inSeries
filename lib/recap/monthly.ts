import type { SeriesStatusRecord, WatchedEpisodeRecord } from "@/lib/analytics";
import type { RecapReviewRecord } from "@/lib/recap/types";

export function isValidYearNumber(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 3000;
}

export function isValidMonthNumber(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

export function isFutureMonth(year: number, month: number, reference = new Date()): boolean {
  const refYear = reference.getUTCFullYear();
  const refMonth = reference.getUTCMonth() + 1;
  return year > refYear || (year === refYear && month > refMonth);
}

export function getMonthlyPeriodLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function sliceEpisodesForMonth(episodes: WatchedEpisodeRecord[], year: number, month: number): WatchedEpisodeRecord[] {
  return episodes.filter((episode) => episode.watchedAt.getUTCFullYear() === year && episode.watchedAt.getUTCMonth() + 1 === month);
}

export function sliceStatusesCompletedInMonth(statuses: SeriesStatusRecord[], year: number, month: number): SeriesStatusRecord[] {
  return statuses.filter(
    (status) =>
      status.state === "COMPLETED" &&
      status.completedAt !== null &&
      status.completedAt.getUTCFullYear() === year &&
      status.completedAt.getUTCMonth() + 1 === month
  );
}

export function sliceReviewsForMonth(reviews: RecapReviewRecord[], year: number, month: number): RecapReviewRecord[] {
  return reviews.filter((review) => review.createdAt.getUTCFullYear() === year && review.createdAt.getUTCMonth() + 1 === month);
}
