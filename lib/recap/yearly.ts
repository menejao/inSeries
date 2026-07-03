import type { SeriesStatusRecord, WatchedEpisodeRecord } from "@/lib/analytics";
import type { RecapReviewRecord } from "@/lib/recap/types";

export function isValidYearNumber(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 3000;
}

export function isFutureYear(year: number, reference = new Date()): boolean {
  return year > reference.getUTCFullYear();
}

export function getYearlyPeriodLabel(year: number): string {
  return String(year);
}

export function sliceEpisodesForYear(episodes: WatchedEpisodeRecord[], year: number): WatchedEpisodeRecord[] {
  return episodes.filter((episode) => episode.watchedAt.getUTCFullYear() === year);
}

export function sliceStatusesCompletedInYear(statuses: SeriesStatusRecord[], year: number): SeriesStatusRecord[] {
  return statuses.filter((status) => status.state === "COMPLETED" && status.completedAt !== null && status.completedAt.getUTCFullYear() === year);
}

export function sliceReviewsForYear(reviews: RecapReviewRecord[], year: number): RecapReviewRecord[] {
  return reviews.filter((review) => review.createdAt.getUTCFullYear() === year);
}
