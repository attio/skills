# Third-party API clients

Read this file before you call a third-party API from an Attio app, or change how the app maps
that API's errors, paginates or retries. Credentials are in `authentication.md`.

Docs: `/sdk/guides/making-http-requests`, `/sdk/server/server-functions`,
`/sdk/server/available-globals`.

## Where vendor calls live

Keep the HTTP details (base URL, auth header, error mapping) in one server-side module per
service, e.g. `src/<service>/`, and extend the app's existing client if it has one. The client
can call any server function with any arguments, so validate them there and expose only the
operations the UI needs.

## Failures as data

Throwing in server code and catching in the client (the docs' pattern) is fine when one message
covers every failure, but thrown messages must not contain vendor response bodies or status
codes: they reach the client and the logs, and can contain PII. When the UI needs to tell failures apart (e.g. "reconnect" for `401` vs "missing scope" for
`403`), return the failure as data: `{ok: true, value} | {ok: false, error}` with plain-object
errors (codes and fields), not `Error` instances, so they survive the boundary. Follow the app's
own result type if it has one. Inside a `useAsyncCache` loader, return a fallback rather than
letting it throw.

## Example client

```ts
// src/<service>/client.ts
export type ServiceError =
    | {code: "UNAUTHORIZED"} // 401: reconnecting fixes it
    | {code: "FORBIDDEN"; missingScopes?: string[]} // 403: reconnecting the same account does not
    | {code: "NOT_FOUND"} | {code: "RATE_LIMITED"}
    | {code: "SERVICE_UNAVAILABLE"} | {code: "UNEXPECTED_RESPONSE"}

function errorFromStatus(status: number): ServiceError { /* 401, 403, 404, 429, 5xx, other */ }

/** @see https://api.example.com/docs/widgets#get */
export async function getWidget(
    id: string,
    // Connection events pass their `connection` argument. Otherwise the getter runs here, outside
    // any try: it throws an AttioError when nobody has connected, which opens the connect dialog.
    connection = getWorkspaceConnection(),
): Promise<Result<Widget, ServiceError>> {
    let response: Response
    try {
        response = await fetch(url, {headers: {authorization: `Bearer ${connection.value}`}})
    } catch {
        return {ok: false, error: {code: "SERVICE_UNAVAILABLE"}}
    }
    if (!response.ok) return {ok: false, error: errorFromStatus(response.status)}
    // Then parse JSON and safeParse with Zod; on failure log only issue code and path.
}
```

## Mapping vendor errors

- Give `401` and `403` different messages. `401` means the credentials are missing, invalid or
  expired, and reconnecting fixes it. `403` means the account lacks a scope or permission, and
  reconnecting the same account will not. Keep data the message needs (e.g. `missingScopes`).
- Some vendors use statuses oddly: `403` for rate limits, `200` with an `{error}` body, `202` for
  "still processing". Handle these where the response is parsed, with a comment linking the
  vendor docs.

## Vendor SDKs

- The server runtime is not Node.js. A vendor SDK only works if it needs no Node built-ins and no
  web globals the runtime lacks (see `/sdk/server/available-globals` and the `crypto` limits in
  `webhooks.md`). If it does not run, call the API with `fetch`.
- Some SDKs read optional environment variables at start-up. Pass explicit options (e.g.
  `baseUrl`) so the runtime does not warn about unset variables.

## Time limits, pagination and retries

Server functions stop after 30 seconds. Treat block handlers, webhooks and events the same way.

- Give paginated loops a wall-clock budget under the limit (e.g. 20 seconds). When you pass it,
  stop, log it, and return what you have with a flag saying the list is incomplete. Request the
  most relevant results first (e.g. most recently updated), so a cut-off list keeps them.
- Limit fan-out to a few concurrent requests, and stop early on a rate limit.
- A short in-request retry on `429` is fine: respect `Retry-After`, cap the wait, and stay well
  under 30 seconds in total.
- In a workflow step, do not loop or wait out a rate limit. Waiting burns the step's time limit,
  and a retry gets a fresh one: return a `retryable` error and let Attio retry. For slow vendor
  jobs, use a deferred step, not polling.

## Idempotency

Attio retries `execute` when you return `retryable: true`, and may retry `activate`; vendors
redeliver webhooks. Check what each side effect does when it runs twice. With no idempotency key
and a call that is not naturally idempotent, set `retryable: false` (keys: `workflow-blocks.md`).
