# Workflow blocks

Read this file before you add or change a trigger or step block. File names, handler signatures,
return types and the lifecycle are in the docs and types; read them first.

Docs: `/sdk/workflows/file-structure`, `/sdk/workflows/block-lifecycle`,
`/sdk/workflows/define-workflow-block`, `/sdk/workflows/config-schema`,
`/sdk/workflows/outcome-schema`, `/sdk/workflows/configurator`, the handler pages
`/sdk/workflows/define-workflow-block-{execute,resume-callback,activate,on-trigger-callback,deactivate}`,
and `/guides/building-workflow-blocks`.

## Contents

- Layout and `block.ts`
- Configurators
- Outcomes
- Step blocks
- Trigger blocks
- Data from upstream

## Layout and `block.ts`

- Every block requires a `configurator.tsx`, even one with no inputs: it declares the outcomes.
  Without one, the block's panel does not load and the workflow cannot be published.
- Each direct subfolder of `src/app/blocks/` must contain a `block.ts`, or the build fails. Put
  shared block code elsewhere (e.g. `src/<service>/`, or a `lib/` folder inside one block).
- The configurator runs in the workflow editor. It must not change anything in Attio or the
  vendor; reading data and showing a toast are fine.
- **Config keys are a public contract.** Workflows that use the block store values under them.
  Renaming a key, or narrowing an enum or option set, breaks those workflows. Keep the old key
  or value working, or deprecate the block with `deprecated: {replacedBy: "new-block-id"}`.
- Match the app's config key casing; for a new app, prefer snake_case (as the docs do).
- Config nodes have no `.min()` or `.max()`. Use `stringEnum` for fixed choices, and check ranges
  and formats in `execute`.
- `ConfigSchema.record(...)` exists for maps keyed at run time (e.g. one value per field of a
  selected form), although the config-schema page does not list it. Use a node only if it
  type-checks against the installed types.

## Configurators

- **Render every `Outcome` unconditionally** in the top-level configurator: outside any
  component that loads data, and not conditional on field values. The editor waits while the
  configurator suspends, then reads its outcomes. An outcome that only appears after a load, or
  after a field is set, gives downstream steps `Invalid path` errors.
- **Do not add your own `<React.Suspense>`.** The editor provides the boundary.
- **Load dropdowns through an options provider** (`search` and `getOption`, backed by server
  functions), so the block renders at once. Prefer a searchable dropdown over asking for an id.
  - Small list: load it once with `useAsyncCache` and filter it in `search`. Large list: make
    `search(query)` call the server.
  - **`getOption(value)` must resolve a saved value even when it is not on the current page of
    results.** Return `undefined` if the value is unknown.
- Use fixed `useAsyncCache` keys. A key from a completed choice (e.g. a selected group id) is
  fine; a value the member is still typing is not.
- **Surface load failures.** If a server function returns an errored result, show a toast once
  (e.g. in a `useEffect` that depends on the failure) and fall back to an empty list. Do not
  leave the block stuck, and do not throw. De-duplicate toasts when several dropdowns fail
  together.
- When `watch(name)` reports a dynamic value (a variable resolved at run time), show all
  dependent inputs (the safe default) or hide the ones that need a known value. Do not guess.

## Outcomes

- Outcome ids are the branch names in the editor. Give each code path the member may branch on
  its own id. Snake_case and kebab-case are both fine. **Changing an outcome id is a breaking
  change for workflows that already use the block.**
- "Not found" or "empty" results that are a normal case are outcomes, not errors.
- The returned `data` must match the declared schema exactly. Use snake_case schema keys, or
  `.title()` for a readable name.

## Step blocks

- **Validate config at run time in `execute`.** A required field bound to a variable can still
  resolve to `undefined` or `""`. Return a clear `error` or an outcome instead of throwing.
- Write `errorMessage` for the member. Set `retryable: true` only for transient failures, and
  only when a repeat is safe.
- Pass `metadata.uniqueExecutionId` as the vendor's idempotency key where the API has one.
- For long upstream work, register `metadata.finishCallbackUrl` with the vendor in `execute` and
  return `defer`. Each execution has its own URL; do not share it. Do not poll in `execute`.
- If the vendor caps webhooks per account, do not register one per execution: map the vendor's
  job id to `finishCallbackUrl` in `kv` and forward from a shared `.webhook.ts`.

## Trigger blocks

**`activate.ts`**

- Register `metadata.triggerCallbackUrl` with the vendor, and store the subscription id and any
  signing secret in `kv` under a key that includes `metadata.uniqueActivationId`.
- **Make it idempotent.** `uniqueActivationId` stays the same across retries; if an entry
  exists, return `complete`.
- **Roll back.** If saving to `kv` fails after the vendor call succeeded, remove the vendor
  subscription before you return the error.

**`trigger.ts`**

- **Verify the request first**, as the vendor documents it, over the raw body (`webhooks.md` has
  the HMAC code). If it fails, return `no-op` and log it. If the vendor offers
  no verification, say so in a comment and in your report; Attio's review requires it.
- `req.url` is a path, not a full URL (see `webhooks.md`). Parse it with a base:
  `new URL(req.url, "https://hooks.attio.com")`.
- **Validate** the payload with Zod. Return `no-op` for malformed payloads and for events that do
  not match the config.
- **Deduplicate** on a stable delivery or event id stored in `kv` with a TTL that covers the
  vendor's retry window. Mark it processed only after you have built the outcome, so a failure
  partway through can be retried.
- A trigger fed by a shared `.webhook.ts` still validates and deduplicates.
- One delivery starts at most one run; if it holds several matching events, decide which wins and
  log the rest. Keep `trigger` fast and free of side effects.

**`deactivate.ts`**

- Remove the stored registration at the vendor, then delete the `kv` entry. If there is no entry,
  or the vendor says it is already gone, return `complete`.

If the vendor allows only one webhook URL per account, `activate` must not call its "set
webhook" endpoint. Use the shared-registry pattern in `webhooks.md`.

## Data from upstream

- Map unknown enum values to an explicit `unknown` bucket and log a warning; do not drop or
  coerce them. Do not quietly default values that should always be present.
- Convert dates, time zones and currency units in one tested helper. Send a date-only value
  stored as a timestamp as midday UTC; midnight shows as the previous day west of UTC.
- Combobox values are strings; parse ids before sending them to a vendor that expects integers.
