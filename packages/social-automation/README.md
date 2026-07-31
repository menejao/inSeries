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
| `publisher/` | `Publisher` interface: `publish(publication): Promise<{ externalId: string }>`. `publisherRegistry` keyed by lowercase network name. `ConsoleLogPublisher` is registered under `"instagram"` — logs what it would post and returns a fake `externalId`. **This is the extension point for future networks**: implement `Publisher`, add one line to `publisherRegistry`. |
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
