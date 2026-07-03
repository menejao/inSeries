export type WatchNextUserState = "WATCHING" | "WANT_TO_WATCH";

export type WatchNextItem = {
  series: {
    id: string;
    slug: string;
    title: string;
    posterUrl: string | null;
  };
  userState: WatchNextUserState;
  episode: {
    id: string;
    seasonNumber: number;
    number: number;
    title: string;
    stillUrl: string | null;
    airedAt: Date;
  };
  /** Aired-and-unwatched episodes still left after this one — the "+N" badge. */
  pendingAfterNext: number;
  /** `pendingAfterNext + 1` — this episode plus everything still pending behind it. */
  totalPending: number;
  isOverdue: boolean;
  isNew: boolean;
  isPremiere: boolean;
};

export type WatchNextResult = {
  items: WatchNextItem[];
  /** True if the user tracks (watching/plan-to-watch) at least one series, regardless of whether anything is pending — distinguishes the two empty states. */
  hasTrackedSeries: boolean;
};
