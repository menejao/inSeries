# @inseries/social-automation

INSERIES-SOCIAL-AUTOMATION-01 — infrastructure/scaffolding for a future content-automation
system that will post to Instagram and other networks. **This package makes no real network
calls and runs no real AI generation.** Everything is stub/interface-only, but the whole
pipeline compiles, typechecks, and is runnable end-to-end in manual mode via the CLI scripts in
`scripts/` (wired from the repo root as `npm run social:*`).

## Why a separate package

Kept independent from `app/` and `components/` on purpose: this is meant to eventually run as
its own process (a worker, a scheduled job, a separate deploy) rather than inside Next.js
request handlers. It only depends on `@prisma/client` (the same generated client / same
`DATABASE_URL` / same schema as the main app — see `prisma/schema.prisma` for the
`SocialContent` / `SocialPublication` / `SocialTemplate` / `SocialAutomationHistory` models) and
on `zod` for its own config validation.

## Module layout (`src/`)

| Module | Responsibility |
| --- | --- |
| `content-engine/` | Orchestrates the pipeline end-to-end (generate → render → media → publish/schedule) purely via injected interfaces (`ContentGenerator`, `TemplateRenderer`, `MediaGenerator`, `Publisher`). No network-specific code lives here. Also hosts `automatic-runner.ts`, the architected-but-disabled automatic mode entry point. |
| `content-generator/` | `ContentGenerator` interface. `NoopContentGenerator` (always throws — proves the shape). `ManualContentGenerator` (creates a `SocialContent` DRAFT from manually supplied text — no AI). |
| `template-renderer/` | `TemplateRenderer` interface. `PassthroughTemplateRenderer` applies a `SocialTemplate` (or none) to content and produces caption text — no real templating engine yet. |
| `media-generator/` | `MediaGenerator` interface. `PlaceholderMediaGenerator` returns a fake `placeholder://` media reference — no real media is ever produced. |
| `publisher/` | `Publisher` interface: `publish(publication): Promise<{ externalId: string }>`. `publisherRegistry` keyed by lowercase network name. `ConsoleLogPublisher` is registered under `"instagram"` in every non-production environment. **This is the extension point for future networks**: implement `Publisher`, add one line to `publisherRegistry`. Since INSERIES-INSTAGRAM-PUBLISHER-05 it also contains the real Meta Graph API integration — see the dedicated section below. |
| `scheduler/` | Real, unit-testable logic: `computeNextRun()` given configured daily `HH:mm` times, `getDuePublications()`, `scheduleNext()`. Documented-only, like `lib/jobs/registry.ts` in the main app — nothing here is wired to an actual cron. |
| `history/` | `recordHistory()` — every other module calls into this on every action. Writes a `SocialAutomationHistory` row *and* a structured log line. Nothing is silent. |
| `config/` | zod-validated config: `environment` (`development`/`homologation`/`production` — only `production` allows a real publish attempt to proceed past the dev-noop warning), `mode` (`manual`/`automatic`), `scheduleTimes`, `dailyPostCount`, `enabledNetworks`. |
| `db/` | Thin repository layer over Prisma: `content-repo`, `publication-repo`, `template-repo`, `history-repo`, plus `client.ts` (own `PrismaClient` singleton against the shared schema/DB — cannot import `lib/db/prisma.ts` from `app/`, so it keeps its own instance). |
| `manual-flow/` | The only mode that's actually implemented: `generate()` → `approve(contentId)` → `publishApproved(contentId)`. |
| `logger/` | Structured JSON logger mirroring `lib/logger/index.ts`'s shape (level, redaction), scoped to this package. |

## Data flow (manual mode)

```
generate(input)                     -> SocialContent{status: DRAFT}          + history: CONTENT_GENERATED
approve(contentId)                  -> SocialContent{status: APPROVED}       + history: CONTENT_GENERATED (transition)
publishApproved(contentId)
  -> renderer.render()              -> caption text                          + history: TEMPLATE_RENDERED
  -> mediaGenerator.generate()      -> placeholder mediaRef                  + history: MEDIA_GENERATED
  -> publicationRepo.create()       -> SocialPublication{status: PENDING}
  -> publicationRepo.markPublishing()
  -> publisher.publish()            -> { externalId }                       + history: PUBLISH_ATTEMPTED
  -> on success: SocialPublication{status: PUBLISHED}, SocialContent{status: PUBLISHED}
                                                                              + history: PUBLISH_SUCCEEDED
  -> on failure: SocialPublication{status: FAILED}, SocialContent{status: FAILED} (never deleted)
                                                                              + history: PUBLISH_FAILED
```

Failures never lose content — the flow only ever moves status, never deletes a row. A `FAILED`
`SocialContent`/`SocialPublication` is retryable by re-running `publishApproved` after fixing
whatever went wrong (a future retry runner could automate this using `scheduler.scheduleNext()`).

## Manual vs. automatic mode

- **Manual** (`config.mode === "manual"`, the default): a human calls `generate` → `approve` →
  `publishApproved` directly (e.g. via the CLI scripts). Fully implemented and runnable today.
- **Automatic**: types/interfaces exist (`AutomaticRunner` in `content-engine/automatic-runner.ts`)
  so the shape is architected, but `NotYetEnabledAutomaticRunner.run()` always throws
  `"Automatic mode is not yet enabled"`. There is no cron/queue wiring anywhere in this package —
  same "documented, not executed" pattern the main app uses for `lib/jobs/registry.ts`.

## Instagram Publisher (INSERIES-INSTAGRAM-PUBLISHER-05)

### Where it lives, and why not `src/server/social/publisher/`

The ticket suggested `src/server/social/publisher/`. That path does not exist in this repository and
creating it would have produced a second, parallel social-automation tree: the `Publisher` interface,
the registry, the repositories, the history writer, the logger and the config loader all already live
in `packages/social-automation/src/`, and `manual-flow/index.ts` already calls
`getPublisher(network).publish(publication)`. The real publisher was therefore built **inside
`packages/social-automation/src/publisher/`**, with the subfolders the ticket asked for added there:

```
publisher/
  types/{index,base}.ts   base.ts is the original types.ts (Publisher/PublishResult), moved into the
                          folder so `from "./types"` is unambiguous; index.ts adds the new types
  instagram/
    graph-client.ts       the ONLY file that speaks HTTP to the Graph API (injectable fetch)
    instagram-publisher.ts implements Publisher — feed / carousel / story sequencing
    image-hosting.ts      ImageHostingService + NotConfigured/Configured implementations
    errors.ts             PublishError + the single retryable/not-retryable classification
  queue/publish-queue.ts  FIFO semaphore + per-publication idempotency (no Redis, no new dependency)
  scheduler/publish-scheduler.ts  pure "publish now vs defer vs skip" decisions, absolute-time (UTC)
  retries/retry-policy.ts exponential backoff, temporary failures only
  services/publish-service.ts  the orchestrator — the only module here that writes to the database
  utils/mask.ts           credential masking for logs, history and `lastError`
```

The existing `console-log-publisher.ts`, `registry.ts`, `status.ts`, `index.ts` were extended, not
replaced, and `manual-flow/` was not touched at all.

### When the real publisher is actually used

`registry.ts` returns `InstagramGraphPublisher` only when **both** hold:

1. `isRealPublishAllowed()` — `SOCIAL_AUTOMATION_ENVIRONMENT=production`; and
2. every mandatory Meta credential is present.

Otherwise the registry keeps `ConsoleLogPublisher`, so development and homologation behave exactly as
before this ticket. In production with an incomplete configuration, `assertMetaConfigured()` throws at
startup (fail-fast) rather than letting a half-configured publisher attempt a real post.

### Configuration

`INSTAGRAM_BUSINESS_ACCOUNT_ID`, `FACEBOOK_PAGE_ID`, `META_APP_ID`, `META_APP_SECRET`,
`META_ACCESS_TOKEN`, `META_API_VERSION` (default `v21.0`), `META_REQUEST_TIMEOUT_MS` (15000),
`META_RETRY_LIMIT` (3), `SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL`.

Credentials are **never persisted to the database and never logged**: the access token travels in the
`Authorization` header (never a query string), `utils/mask.ts` scrubs anything credential-shaped from
every log line / history row / `lastError`, and the admin Configuracoes screen shows only
present/absent via `describeMetaConfig()`.

### Open infrastructure gap: public image hosting

The Content Publishing API does not accept a binary upload in this flow — `POST /{ig-user-id}/media`
takes an `image_url` that **Meta's servers fetch anonymously from the public internet**. The Template
Engine returns PNGs as in-memory `Buffer`s, and the only HTTP surface serving them today
(`/api/admin/social/content/[id]/preview/[format]`) requires an admin session, so it cannot be used as
`image_url`.

There is no object storage configured anywhere in this repository, and standing one up is an
infrastructure decision outside this ticket. The gap is therefore stated rather than papered over:
`NotConfiguredImageHostingService` (the default) throws a clear, non-retryable error naming
`SOCIAL_AUTOMATION_PUBLIC_MEDIA_BASE_URL`, and the publications panel shows a warning per network.
`ConfiguredImageHostingService` only *composes* URLs under that base — it deliberately performs no
upload, because there is nothing to upload to yet. **A real production publish is not possible until
this is resolved.**

### Retry, queue, cancellation

- Retry: exponential backoff (`2^n` seconds, default 3 attempts) for **temporary** failures only —
  timeout, rate limit (429 / codes 4, 17, 32, 613), 5xx. Auth (code 190), permission (code 10, 200-299)
  and invalid media (code 100) go straight to `FAILED` with a masked `lastError`, never retried.
  The classification lives in exactly one file, `instagram/errors.ts`.
- Queue: in-memory, single process. Concurrent publishes of the same `SocialPublication` collapse into
  one execution; global concurrency defaults to 1. Across multiple worker processes the real backstop
  is the DB status guard in `publish-service.ts`, which refuses rows already `UPLOADING`/`PUBLISHING`/
  `PUBLISHED`/`CANCELLED`.
- Cancellation: `PENDING`/`SCHEDULED`/`FAILED` -> `CANCELLED` with a mandatory reason. The row is never
  deleted.

### Pending migration (schema edited, database NOT migrated)

`prisma/schema.prisma` gained `SocialPublicationStatus.UPLOADING` / `.CANCELLED` and
`SocialPublication.attempts` / `.lastError`. Per `CLAUDE.md`, **no migration was executed** — the
generated Prisma client still describes the old shape. To keep the package compiling in the meantime:

- `db/publication-repo.ts` funnels every write touching a new column/enum value through one named,
  documented helper (`pendingSchema`). Delete it and inline the literals once the migration runs.
- `publisher/types/index.ts` declares `PublicationStatus` locally; it becomes
  `import type { SocialPublicationStatus }` after the migration.
- The admin page reads `attempts`/`lastError` defensively and types its status filter as `string[]`.

### Testing

`npx vitest run packages/social-automation/src/publisher` — every test injects a fake `fetch` or a
fake `Publisher`. **No test reaches the Meta Graph API and no real token is used anywhere.**

## Extension points for a new social network

1. Implement `Publisher` (`publish(publication): Promise<{ externalId: string }>`) in
   `publisher/`, e.g. `TikTokPublisher`.
2. Register it in `publisher/registry.ts`: `publisherRegistry["tiktok"] = new TikTokPublisher()`.
3. Add the value to the `SocialNetwork` enum in `prisma/schema.prisma` and to the
   `SocialNetworkKey`/`NETWORKS` list in `config/index.ts`.

Nothing else in the pipeline needs to change — `manual-flow` and `content-engine` only ever call
`getPublisher(network)`.

## Running it

From the repo root (see root `package.json`):

```
npm run social:generate -- --title "..." --description "..." --type post
npm run social:approve -- --content <id>
npm run social:publish -- --content <id>
npm run social:status -- --content <id>
```

All four scripts call into the real package functions (not static output). Without a live
`DATABASE_URL` they will fail at the DB call with a clear, caught error — that's expected in a
sandbox with no database; the control flow up to that point (config load, generator/renderer/
media/publisher wiring) is real.
