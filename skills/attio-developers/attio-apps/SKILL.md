---
name: attio-apps
description: >-
  Build, modify, debug or review Attio apps built with the Attio App SDK (the
  `attio` npm package). Use for any change to such an app, however small:
  record actions, bulk actions, record widgets, record tabs, object actions,
  call recording text actions, app pages, dialogs, forms, toasts, workspace
  settings, workflow blocks (block.ts, execute.ts, configurator.tsx, triggers,
  outcomes, options providers), webhook handlers (.webhook.ts), connection
  events (.event.ts), server functions (.server.ts), GraphQL queries, the KV
  store, connections and third-party API clients. Also use to scaffold a new
  Attio app, fix its lint, type or test failures, ship a version, prepare it
  for the Attio App Store, or decide which SDK surface fits a requirement.
  Applies when package.json depends on `attio` or the code imports from
  attio/client or attio/server.
metadata:
  version: "0.1.0"
  attio-sdk-version: "1.1.5"
---

# Attio apps

Attio apps add UI and server logic to Attio: actions, widgets, tabs and pages on records,
workspace settings, workflow blocks, webhooks and connection events. They run in Attio's
sandboxed runtimes, so code that type-checks can still fail in Attio. Load this skill for every
change, including one-line fixes.

This skill does not restate the SDK's API. It adds the runtime limits, house patterns and rules
that the docs and types leave out or get wrong. For an existing app, read its `package.json`,
`README.md`, any `docs/` notes and the code next to your change first. Keep the work within the
user's request.

## Read the docs and types first

The Attio docs (`https://docs.attio.com`) and the installed types (`node_modules/attio/dist/types/`)
are the source of truth for signatures, props, handler arguments, file conventions and limits.

- **Before you use an SDK surface or API the app does not already use, read its docs page and
  its installed types.** Do not write it from memory or from this skill. Each reference starts
  with a "Docs:" line listing the pages for its surfaces.
- Fetch a page as Markdown by adding `.md` to its path, e.g.
  `https://docs.attio.com/sdk/workflows/configurator.md`. The index is
  `https://docs.attio.com/llms.txt`.
- For edits inside SDK calls the app already makes, the existing code and types are enough.
- When the docs and the types differ, follow the types. When this skill differs from either,
  follow them. Tell the user in both cases.
- For third-party APIs, read the vendor's API reference. Do not guess endpoints, fields or error
  shapes. Put a `@see <url>` on each client method.

## SDK version

Read the installed `attio` version from `node_modules/attio/package.json`, else `package.json`.

- **Older than 1.1.5:** the installed types win for that app. Apply "from SDK 1.x" notes only
  if the app has that version. In the report, suggest upgrading `attio` within 1.x; do not
  upgrade unless asked.
- **Newer than 1.1.5:** the types and docs win where they differ from this skill. Tell the user
  the skill may be out of date (`claude plugin update` or `npx skills update`).

## Rules that always apply

- **Client code** (`extension.tsx`, `page.tsx`, `configurator.tsx` and what they import) renders
  only `attio/client` components: no HTML tags, CSS, DOM access or `fetch`. `process` is
  undefined there, though TypeScript allows it. It reaches the server only through `.server.ts`
  default exports, with JSON-serialisable arguments and results.
- **Server code** (`*.server.ts`, `*.webhook.ts`, `*.event.ts`, block handlers) runs in a custom
  runtime, not Node.js. Server functions stop after 30 seconds; keep all server code inside that.
  `block.ts` and settings `schema.ts` are shared and must not import `attio/client` or
  `attio/server`.
- **Entry points** are discovered under `src/app/`. Do not add `app.ts` or `app.settings.ts`.
  Never guess an import.
  Extension and block ids, and page folder names, are kebab-case string literals. **Never rename
  a published id, config key or outcome id**: installs and workflows that use them break.
- **Connections:** never call `getUserConnection()` or `getWorkspaceConnection()` inside a `try`,
  even if an example you are copying does.
- **Errors:** users see a clear message that says what to do, never raw JSON, status codes,
  response bodies or stack traces, and thrown messages carry none of them. React components
  render a fallback; they do not throw.
- **Logging:** never log PII, tokens or response bodies. For Zod failures, log only each issue's
  `code` and `path`, even if existing code does more.
- **Suspense:** every `useAsyncCache` or `useQuery` caller needs a boundary above it. Widgets need
  their own, with `Widget.Loading` (see `ui-extensions.md`).
- **No experimental or deprecated APIs:** nothing `@experimental` or `@deprecated` in the types,
  no `Experimental_` exports, no `experimental_` GraphQL fields. Attio's review rejects them.
- Validate third-party responses with Zod, and fix type errors at their cause, not with casts.

## Routing

| Task | Read |
| --- | --- |
| Decide which entry point fits a requirement, or what to ask the user | [references/extension-types.md](references/extension-types.md) |
| Record, bulk, object or call recording action; widget; record tab; page; dialog; form; toast; navigation; workspace settings; GraphQL | [references/ui-extensions.md](references/ui-extensions.md) |
| Trigger or step block, configurator, outcomes, options provider, deferred step | [references/workflow-blocks.md](references/workflow-blocks.md) |
| Call a third-party API, map its errors, paginate, retry, make calls idempotent | [references/api-client.md](references/api-client.md) |
| User or workspace connection, secret, environment variable, Attio REST API from server code | [references/authentication.md](references/authentication.md) |
| Connection events, `.webhook.ts`, verifying or deduplicating deliveries, `crypto`, `kv`, one vendor URL shared by many activations | [references/webhooks.md](references/webhooks.md) |
| User-facing error text, logging | [references/error-messages-and-logging.md](references/error-messages-and-logging.md) |
| Unit tests, test config, mocking `attio/server` | [references/testing.md](references/testing.md) |
| Scaffold, run `attio dev`, deprecated-layout app, validate, create a version | [references/workflow.md](references/workflow.md) |
| Share privately, ship an update, App Store submission | [references/publishing.md](references/publishing.md) |
| Review code, or self-check before reporting | [references/review-checklist.md](references/review-checklist.md) |

Read every row that applies before that part of the work (a step block calling a vendor API
needs `workflow-blocks.md` and `api-client.md`), and reuse what you already read this session.
Before reporting, run the validation ladder in `workflow.md` and the self-check in
`review-checklist.md`.

## Report

For a change, report:

1. What changed, as `src/app/...` paths, and why
2. The docs pages you relied on, if any
3. Tests added, or why none were needed
4. Each validation step with pass or fail, naming any you did not run
5. Steps for the user to try it in Attio
6. Risks and open questions, including any `attio` upgrade you suggest

Keep it proportional: for a one-line fix, items 1 and 4 are enough. For a review, use the output
format in `review-checklist.md`.
