# Choosing an entry point

Read this file when the user describes what they want ("show X on a company", "sync Y when Z
happens") and you need to pick the SDK surface. Read the docs page for the chosen type before
you build it.

Docs: `/sdk/extensions/overview`, `/sdk/pages/overview`, `/sdk/settings/overview`,
`/sdk/workflow-blocks/overview`, `/sdk/server/webhooks/webhook-handlers`,
`/sdk/server/events/events`.

## By goal

| The user wants to... | Use |
| --- | --- |
| Run something on one record from its page or the command palette | `record-action` |
| Run something on many selected records in a list | `bulk-record-action` (with `runRecordBatches`) |
| Act on an object as a whole (not one record) | `object-action` |
| Show a small, glanceable value on a record page | `record-widget` |
| Show rich UI about one record, with room for tables or charts | `record-tab` |
| Act on text a member selects in a call recording | a `call-recording-*-text-action` |
| A dashboard or anything not about one record | Page (`src/app/pages/<slug>/page.tsx`) |
| Let admins configure the app for the workspace | Workspace settings (`src/app/settings/`) |
| Let workflows start when something happens in the vendor's system | Trigger block |
| Let workflows do something in the vendor's system | Step block |
| Wait inside a workflow for slow vendor work or an approval | Step block that returns `defer`, plus `finish.ts` |
| Receive vendor calls that are not tied to one workflow | Webhook handler (`*.webhook.ts`) |
| Check a credential or set up vendor webhooks when someone connects | `connection-added` event |
| Call the vendor from the UI | A `*.server.ts` function the UI imports |

A feature often combines several: e.g. a step block, its configurator's server functions, and a
record action that does the same thing from a record page.

## Questions to settle first

Ask only when the answer changes what you build and you cannot infer it.

- **Who acts, and where?** A member on a record page, an admin once (settings), or a workflow
  with no member present (block).
- **Whose credentials?** Per member (user connection) or per workspace (workspace connection).
- **Which way does data move?** Attio calls the vendor (server function or step), or the vendor
  calls Attio (webhook handler or trigger).
- **One webhook URL per vendor account, or one per subscription?** This decides between
  per-activation registration and a shared webhook (see `webhooks.md`).
- **How much data?** Thousands of items need pagination with a time budget, batching, or a
  search-as-you-type options provider.

## Limits that rule options out

- GraphQL only works on the client. Server code reads Attio data over REST.
- Widgets only render `Widget.TextWidget` content. Use a record tab for anything richer.
- Long jobs use a deferred step, not a loop. There is no scheduler: work runs when a member
  acts, a workflow runs, or the vendor calls in.
- Connections and OAuth scopes are configured in the Developer console, not in code.
