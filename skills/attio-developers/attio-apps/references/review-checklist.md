# Review checklist

Use this when you review App SDK code, and as a self-check before you report a change. The
rules are stated in full in the other references and `/share/code-review`.

Docs: `/share/code-review`, `/share/security`.

## Self-check before you report a change

For a small change, check these and the validation ladder. Run the full review for reviews and
new features.

- No secrets, tokens or PII in client code, logs or committed files.
- Connection getters are outside any `try`.
- Every new failure path ends in a clear message for the user: a caught error or a returned
  error, never an unhandled throw.
- New suspending hooks have a Suspense boundary above them (none added in configurators).
- New workflow outcomes render unconditionally; new config keys and ids do not rename old ones.
- Server calls have a time budget and no unbounded loops.

## Full review

Go through the areas that apply and skip the rest. A clean diff gets a short "no notable
issues". **Do not invent findings.** If you see a real correctness or security problem that no
item covers, report it anyway.

- **Security:** incoming webhooks and trigger deliveries are verified (raw body) before any
  work; no PII or tokens in logs, URLs included; no PII sent to third parties without consent.
- **Runtime:** no HTML, CSS, DOM, client `fetch` or `process`; `block.ts` and settings
  `schema.ts` import nothing runtime-bound; new dependencies run in the server runtime; no
  `@experimental`, `@deprecated`, `Experimental_` or `experimental_` APIs; published ids, config
  keys and outcome ids unchanged.
- **API clients:** no status codes or response bodies in thrown messages or the UI; `401` and
  `403` get different messages; each error branch can actually run.
- **Time limits and retries:** pagination and fan-out have a wall-clock budget; in-request
  retries are bounded; steps return `retryable` instead of looping, and only where a repeat is
  safe; long work uses `defer`, not polling.
- **Connections and events:** getters outside any `try`; events use the `connection` argument;
  `connection-added` throws only when the credential is unusable, rolls back partial setup and
  does not throw for optional setup; `connection-removed` never throws.
- **Webhooks and `kv`:** `401` on failed verification, `2xx` for payloads that will never
  succeed, `5xx` only for transient failures; dedupe with a TTL; no reliance on listing keys or
  atomic updates.
- **Workflow blocks:** all `Outcome`s render unconditionally, outside loading components and
  field conditions; no `<Suspense>` in configurators; options providers with a `getOption` that
  resolves saved values; fixed `useAsyncCache` keys; load failures show one toast and fall back
  to empty; config validated at run time in `execute`; not-found is an outcome; `activate`
  idempotent on `uniqueActivationId` and rolls back; triggers verify, validate, filter and
  deduplicate, marking an event processed only after building the outcome.
- **Client UI:** every suspending hook has a boundary; widgets have their own with
  `Widget.Loading`; suspending hooks are not in stateful parents; components render fallbacks
  rather than throw; hooks are called unconditionally; settings hold no secrets.
- **Types and data:** no `any` or `as unknown as` (tests too); Zod validates vendor responses;
  inputs and server function arguments are validated; unknown enum values are bucketed and
  logged.
- **Config and docs:** `attio` is on the current major; the README reflects user-visible
  changes.

## Output format

For each finding, give:

- `file:line`
- The area
- A one-line quote or paraphrase of the code
- The rule it breaks
- A concrete fix

Put the most important findings first: correctness, security and error handling before naming
nits. End with a short verdict, e.g. "ready to merge with nits" or "blocking issues found".
