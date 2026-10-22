# Error messages and logging

Read this file before you write any user-facing error text or any log line.

Docs: `/sdk/guides/debugging-your-app`, `/sdk/notifications/show-toast`, `/share/code-review`.

## Logging

- `console.error` for unexpected failures, `console.log` for notable events (partial pagination,
  ignored webhook events). Start each line with a short prefix, as the app template does:
  `console.error("[deals] create failed", {code})`. If the app has its own logger, use that.
- Log ids, error codes, counts and statuses.
- **Never log PII or secrets**: email addresses, names, phone numbers, addresses, message text,
  form values, tokens, API keys and raw response bodies. Remove tokens from URLs before you log
  them. For Zod failures, log only `issue.code` and `issue.path`, not the input.
- Turn off a vendor SDK's own response-body logging. Remove debug logging before you finish.

## User-facing messages

Keep the copy for a service's errors in one function (e.g. `serviceErrorMessage(error)`, a
`switch` over the client's error codes), and use it in execute handlers, toasts and banners so
one error always reads the same way.

- No raw JSON, square brackets, stack traces or HTTP status codes, and no technical detail the
  user cannot act on: "An unexpected error occurred when calling Example's API", not "503 from
  api.example.com".
- Make each message actionable. `401`: "Attio could not sign in to Example. Reconnect Example in
  the app's settings." `403`: name the missing scope if the vendor says which, otherwise "Your
  Example account does not have permission to do this. Ask an Example admin for access."
- When your own assumption fails (e.g. your Zod schema rejects a response), log the issue codes
  and paths and show a generic message. That is a bug in the app, not something the user can fix.
- For a missing selection, say what to choose, e.g. "Select a segment before adding this person."

## Where errors show

| Surface | Mechanism |
| --- | --- |
| Record action or form submit | An error toast |
| Dialog or widget content | A fallback: a `Banner` in dialogs, a `Widget.TextWidget` that says what is missing in widgets. Never throw. |
| Configurator load failure | One toast, then an empty fallback (see `workflow-blocks.md`) |
| Workflow step | A returned `error` with `errorMessage` and `retryable` |
| Trigger `activate` | A returned `error`; the member sees it when they enable the workflow |
| `connection-added` | `throw new Error("...")` with a clear message |
