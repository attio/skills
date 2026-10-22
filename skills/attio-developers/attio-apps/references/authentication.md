# Authentication: connections, secrets and the Attio API

Read this file when code needs a credential: a member's or workspace's token for a third-party
service, an app-level secret, or access to the Attio REST API.

Docs: `/sdk/server/connections/connections`, `/sdk/guides/authenticating-to-external-services`,
`/sdk/server/environment-variables`, `/sdk/server/attio-api-token`.

## Which credential

| Credential | Use when |
| --- | --- |
| User connection (`getUserConnection()`) | The vendor scopes access to a person, and actions should be attributed to the member who triggered them |
| Workspace connection (`getWorkspaceConnection()`) | One account serves the whole workspace. Only admins can set it up. |
| Environment variable (`process.env.NAME`, server only) | An app-level secret that belongs to you, not to a user or workspace |
| `ATTIO_API_TOKEN` from `attio/server` | Server code that reads or writes Attio data over REST |

## Connections

- Connections (type, OAuth or secret, scopes, redirect URL) are configured in the Developer
  console, not in code. Tell the user what to set there.
- Both getters throw a special `AttioError` when no connection exists, and Attio then asks the
  user to connect. **Never call them inside a `try`, and never check the result for `null`.**
  Call them first, then do the fallible work, even if an example you are copying does otherwise.
- Read the connection in one place, the API client, with an optional `connection` parameter
  that defaults to the getter (see `api-client.md`). Inside `connection-added` the getters do not
  see the new connection yet, so pass the event's `connection` argument; do the same in
  `connection-removed`.
- A secret connection stores one string. If the vendor needs several credentials, define one
  format (e.g. `PUBLIC_KEY:SECRET_KEY`), document it in the README and the connection's setup
  instructions, and parse it in one tested helper.
- Never send a token to the client, and never log it. If a token is part of a URL (e.g.
  `/bot<token>/`), remove it before logging the URL.

## Environment variables

- Server code only. `process` is undefined on the client; TypeScript will not stop you, but the
  code throws at run time.
- Never commit `.env` or `.env.local`. An unset variable reads as `undefined`: check for it and
  return a clear error.

## Attio data

- On the client, use GraphQL (see `ui-extensions.md`). On the server there is no GraphQL runner:
  call the REST API (`https://api.attio.com/v2/...`) with `Authorization: Bearer
  ${ATTIO_API_TOKEN}`, from plain modules under `src/attio/`. For endpoint behaviour, load the
  `attio-api` skill, but follow this skill's runtime rules over its Node.js examples.
- `ATTIO_API_TOKEN` acts as the app. Never expose a general-purpose Attio call through a
  `.server.ts` file.
