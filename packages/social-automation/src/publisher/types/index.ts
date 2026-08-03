/**
 * INSERIES-INSTAGRAM-PUBLISHER-05 — shared types for the real publisher.
 *
 * Re-exports the pre-existing `Publisher`/`PublishResult` contract, now living at `./base.ts`, and
 * adds the types the Graph API integration needs on top of it.
 *
 * Why `types.ts` became `types/base.ts`: the ticket asks for a `types/` folder, and a sibling
 * `types.ts` + `types/` pair makes every `from "./types"` import ambiguous (it silently resolved to
 * the file in some resolvers and the directory in others). Moving the original file inside the
 * folder keeps ALL existing import paths (`./types`, `../types`) valid and unambiguous — no call
 * site outside this folder had to change.
 *
 * IMPORTANT (pending migration): `PublicationStatus` below is declared locally instead of being
 * imported from `@prisma/client`. The `UPLOADING`/`CANCELLED` values were added to
 * `prisma/schema.prisma` in this ticket but the Prisma client has NOT been regenerated (the
 * migration is deliberately out of scope — see CLAUDE.md database rules). Declaring the union here
 * keeps the whole package typechecking today, and once the migration runs this alias can simply
 * become `import type { SocialPublicationStatus }`. Same reasoning for `PublicationAttemptFields`.
 */
export type { Publisher, PublishResult } from "./base";

/** Every status the publisher state machine can produce. Mirrors the enum in schema.prisma. */
export const PUBLICATION_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "UPLOADING",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED"
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

/** Statuses from which a publication may still be cancelled. Never a published/in-flight one. */
export const CANCELLABLE_STATUSES: readonly PublicationStatus[] = ["PENDING", "SCHEDULED", "FAILED"];

/** Statuses that mean "this publication is done" — the queue must never pick these up again. */
export const TERMINAL_STATUSES: readonly PublicationStatus[] = ["PUBLISHED", "CANCELLED"];

/** Statuses that mean a publish is already in flight — the idempotency guard. */
export const IN_FLIGHT_STATUSES: readonly PublicationStatus[] = ["UPLOADING", "PUBLISHING"];

/** The retry/error bookkeeping columns added to SocialPublication by this ticket. */
export interface PublicationAttemptFields {
  attempts: number;
  lastError: string | null;
}

/** The Instagram media kinds this publisher can produce. */
export type InstagramMediaKind = "feed" | "carousel" | "story";

/** Status the Graph API reports for a media container. */
export type ContainerStatusCode = "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export interface ContainerStatus {
  creationId: string;
  statusCode: ContainerStatusCode;
  /** Already-masked human message, when Meta provided one. */
  message?: string | null;
}

/**
 * What the publisher needs to know about a publication in order to post it. Built from a
 * `SocialPublication` row plus the media URLs resolved by the ImageHostingService, so the Graph
 * API layer never touches Prisma.
 */
export interface InstagramPublishRequest {
  publicationId: string;
  kind: InstagramMediaKind;
  caption: string;
  /** Public HTTPS URLs the Graph API will fetch. One for feed/story, 2..10 for a carousel. */
  imageUrls: string[];
}

export interface PublishOutcome {
  externalId: string;
  attempts: number;
}
