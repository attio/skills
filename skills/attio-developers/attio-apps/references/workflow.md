# Workflow: scaffold, develop, validate, ship

Read this file when you create an app, run it, validate a change, or ship a version.

Docs: `/sdk/guides/creating-an-app`, `/sdk/guides/folder-structure-migration`,
`/sdk/guides/debugging-your-app`, `/share/shipping-updates`.

## New app

1. The developer creates the app in the Developer console and picks its slug. You cannot do this
   for them.
2. Scaffold with `npm create attio@latest <app-slug>`. Always pass `@latest`, or npm may use a
   cached old template.
3. Rename or delete the template's example extension. Do not rewrite its lint, format or
   TypeScript config.
4. Write the README: what the app does, the external service (API, auth, docs, rate limits), and
   setup steps.

## Existing app

- Copy the shape of an existing entry point of the same kind, and reuse the app's client and
  logger for a service.
- **Deprecated layout.** If the app registers entry points in `src/app.ts` or `app.settings.ts`,
  follow that layout for the change you were asked to make. Do not migrate the layout as a side
  effect. Suggest `attio migrate folder-structure` as a follow-up. Never define settings in both
  layouts.

## Develop

- `attio dev` pushes changes live to a workspace, and they persist after it stops, so use a
  separate development workspace.
- Do not edit or commit generated files (`*.graphql.d.ts`, `.attio/register.d.ts`).
- Server logs stream with `attio logs`. Client logs are in the browser console.
- Only a person can click through the UI. Give them the exact steps to try the change.

## Validation ladder

Run the app's checks with its package manager. Fix what they report, then run them again until
they all pass. The template has these scripts:

1. `build` (`attio build`): type-checks, checks entry-point discovery and generates GraphQL types
2. `format:check` (run `format` to fix)
3. `lint:fix`, which includes Attio's lint rules

If the app defines more checks (`typecheck`, `test`, `knip`), run those too. If a script is
missing, say so. Never skip a check without telling the user.

## Ship

Run `attio version create` only when the user asks to release. See `publishing.md`.
