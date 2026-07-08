export type MyListGroupKey = "WATCHING" | "WANT_TO_WATCH" | "COMPLETED" | "PAUSED" | "FAVORITES";

export type MyListPreviewSeries = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  backdropUrl: string | null;
};

export type MyListGroup = {
  key: MyListGroupKey;
  label: string;
  count: number;
  preview: MyListPreviewSeries[];
};

export type MyListSummary = {
  groups: MyListGroup[];
  hasAnySeries: boolean;
};
