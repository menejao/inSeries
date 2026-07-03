export { getUserStats } from "@/lib/analytics/service";
export { fetchAnalyticsDataset } from "@/lib/analytics/dataset";
export { computeOverviewStats } from "@/lib/analytics/overview";
export { computeWatchTimeStats } from "@/lib/analytics/watch-time";
export { computeGenreStats } from "@/lib/analytics/genres";
export { computeTimelineStats, getMonthlyRecapData, getYearlyRecapData } from "@/lib/analytics/timeline";
export { computeStreakStats } from "@/lib/analytics/streaks";
export { generateInsights, getMostWatchedSeries } from "@/lib/analytics/insights";
export type * from "@/lib/analytics/types";
