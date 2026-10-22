# Connection events, webhook handlers and `kv`

Read this file before you add or change `*.event.ts` or `*.webhook.ts` files, verify a
delivery, or use `kv`. Signatures, handler setup and the `kv` API are in the docs and types.

Docs: `/sdk/server/events/events`, `/sdk/server/events/connection-added`,
`/sdk/server/events/connection-removed`, `/sdk/server/webhooks/webhook-handlers`,
`/sdk/server/webhooks/create-webhook-handler`, `/sdk/guides/receiving-http-requests`,
`/sdk/server/kv-store`, `/sdk/server/available-globals`.

## Contents

- Connection events
- Webhook handlers
- Verifying deliveries and the runtime `crypto`
- Responses and redelivery
- Deduplication and `kv`
- One vendor URL shared by many activations

## Connection events

**`connection-added`** runs before the connection is saved; if it throws, the connection is not
created.

- Check the credential with one cheap authenticated call (e.g. "who am I"), and throw a clear
  `Error` message if it is bad.
- Use the `connection` argument. The getters do not see the new connection yet.
- **Roll back on partial failure.** If a later step fails, delete what you created (the vendor
  webhook and the handler) before you throw.
- **Do not throw for optional setup.** If a feature works without the webhook (only some blocks
  need it, or the vendor plan lacks webhooks), log the failure and let the connection save.
  Create the webhook lazily the first time a feature needs it.
- A bug here stops anyone connecting the app. Unit-test its failure paths.

**`connection-removed`** runs before the connection is deleted; if it throws, the removal is
blocked.

- Tear down what `connection-added` created (vendor webhooks, handlers, `kv` entries), but
  **never throw**. The vendor may already have revoked the
  token or deleted the resource, so log each failure and carry on.

## Webhook handlers

- Check `req.method` and return `405` for methods you do not accept.
- Return a `Response` on every path. If the handler returns none, the vendor gets a generic
  `500` with no detail, and usually retries; only the dev logs say why ("did not return a
  Response object").
- `req.url` is a path with its query string (`/a/<id>/<id>?probe=1`), not a full URL, so
  `new URL(req.url)` throws. Parse it with a base: `new URL(req.url, "https://hooks.attio.com")`.
- Keep the handler fast. Treat the 30 second server function limit as applying here too.

## Verifying deliveries and the runtime `crypto`

Every webhook the app receives must be verified; Attio's code review requires it
(`/share/code-review`).

- Use the vendor's scheme: an HMAC signature, a shared secret header, or a token in the URL.
  Generate secrets with `crypto.randomUUID()`. Store them in `kv` and never log them.
- The server runtime has a partial `crypto` global that `/sdk/server/available-globals` does not
  list. Only three functions work:
  - `crypto.randomUUID()`
  - `crypto.subtle.importKey()` for HMAC keys. The key it returns has no readable `type` or
    `algorithm`.
  - `crypto.subtle.sign("HMAC", …)` with SHA-256
- Everything else fails at runtime, even if a feature check says it exists:
  `crypto.getRandomValues()`, `crypto.subtle.digest()` and `crypto.subtle.verify()` all throw
  `TypeError: … is not a function`. To verify an HMAC, compute it with `sign` (below) and
  compare it with the signature the vendor sent. If a vendor needs a plain SHA hash, use HMAC or
  ask the user first.
- `TextDecoder.decode()` only accepts a `Uint8Array`. Wrap an `ArrayBuffer` first:
  `decoder.decode(new Uint8Array(buffer))`; an `ArrayBuffer` throws a `TypeError`.
- There is no `Buffer`. Use `TextEncoder`, `TextDecoder` and `Uint8Array` instead of the
  `Buffer.from(…)` calls in Node examples.
- Compute an HMAC-SHA256 signature:

```ts
async function hmacSha256Hex({secret, body}: {secret: string; body: string}): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        {name: "HMAC", hash: "SHA-256"},
        false,
        ["sign"]
    )
    const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body))
    return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("")
}
```

- Sign and verify the **raw** body. Read `await req.text()` once, verify it, then `JSON.parse`
  the string.
- If the check fails, return `401` and do no other work. This is the one non-`2xx` you return
  for a request that will never succeed.

## Responses and redelivery

Most vendors retry anything that is not `2xx`.

- Return `2xx` (and log) for verified payloads that will never succeed: malformed body, unknown
  or ignored event.
- Return `5xx` only for transient failures a redelivery can fix, and only if every consumer
  deduplicates.
- If a redelivery can never succeed (e.g. it forwards to a stale URL), stop after a bounded
  number of consecutive failures, or every later delivery fails too.

## Deduplication and `kv`

- Deduplicate on a stable event or delivery id: `kv.set(key, "processed", {ttlInSeconds})` with a
  TTL that covers the vendor's retry window, and skip ids you have already seen.
- Namespace keys by purpose and owner, e.g. `processed:<uniqueActivationId>:<eventId>`, and keep
  the key builders in one module.
- `kv` calls can reject; decide what a failed read or write means.
- **There is no way to list keys.** Store an index yourself if you need to enumerate entries.
- The docs page types values as strings; the 1.1.5 types accept any JSON-serialisable value.
  What `get` returns is untyped, so validate it with Zod.
- **There is no compare-and-swap.** A read-modify-write cycle (e.g. adding to a stored list) can
  lose writes when two run at once. Narrow the window with a claim key (write a timestamp, wait
  once, re-check; treat old claims as abandoned), and note the limit in a comment.

## One vendor URL shared by many activations

Some vendors allow one webhook URL per account or bot. Then `activate` must not call the
vendor's "set webhook" endpoint, or each activation replaces the last. Instead:

- `connection-added` registers one `.webhook.ts` handler with the vendor. It does not change
  when activations change. (If that setup is optional and was skipped, `activate` may create it,
  after checking `kv` that none exists.)
- `activate` stores `{uniqueActivationId, triggerCallbackUrl}` in a `kv` registry; `deactivate`
  removes its entry by `uniqueActivationId` (it does not receive the URL). Mind the
  compare-and-swap limit above.
- The webhook verifies each delivery, then POSTs the body to every stored `triggerCallbackUrl`.
  Each `trigger.ts` deduplicates on its own, so partial redelivery is safe.
- Remove a URL after N consecutive failures. Write the design down in the app's `docs/`, or the
  next person will "fix" it by calling the vendor from `activate`.
