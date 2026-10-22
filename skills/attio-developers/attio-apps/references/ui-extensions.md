# UI extensions: actions, widgets, tabs, pages, dialogs, forms and settings

Read this file before you add or change client-side UI. Id rules, `objects`, handler arguments
and props are in the docs and types, not here.

Docs: `/sdk/extensions/overview`, `/sdk/extensions/<type>` (e.g. `record-tab`),
`/sdk/pages/overview`, `/sdk/dialogs/show-dialog`, `/sdk/dialogs/dialog-list`,
`/sdk/notifications/show-toast`, `/sdk/navigation/overview`, `/sdk/guides/building-forms`,
`/sdk/forms/use-form`, `/sdk/settings/overview`, `/sdk/data-fetching/use-async-cache`,
`/sdk/graphql/graphql`, `/sdk/components/<component>`.

## Loading data and Suspense

`useAsyncCache()` and `useQuery()` suspend while they load. Every call needs a Suspense
boundary above it:

| Surface | Boundary |
| --- | --- |
| Dialog | Provided. Add your own `<React.Suspense>` only for a custom loading message. |
| Record widget | Not provided. Wrap the content in `<React.Suspense fallback={<Widget.Loading />}>` inside the `Widget` render prop. |
| Record tab, page | Both may suspend; pages show a skeleton while they do. Add boundaries for sections that load slowly. |
| Workflow configurator | Provided by the editor. Do not add your own. |
| Anything else | Add `<React.Suspense>` yourself. |

- **Keep suspending hooks out of components that hold state their children depend on.** When
  that component suspends, the nearest boundary above it replaces the whole subtree, steps
  included, with its fallback. For a multi-step dialog: `Dialog` (holds step state, no
  suspending hooks) → one `<Suspense>` per step → `StepContent` (calls the hook). Check the
  whole JSX tree, not one file at a time.
- Use fixed `useAsyncCache` keys. Never key on text the user is still typing; for live search,
  use a combobox options provider.
- Do not hand-roll a cache (a module-level `Map`). Use `useAsyncCache`, or `kv` with a TTL on the
  server.
- React Query (`useSuspenseQuery`) also works. If the app already uses it, follow the app. Do
  not add it to an app that uses `useAsyncCache`.

## Actions and dialogs

- Check the inputs before you open UI. If a required value is missing (e.g. the person has no
  email), show a toast that explains how to fix it, and return.
- In a dialog, if the loaded result is errored, render a `Banner` and a close button. Call
  `hideDialog()` after a successful submit.
- For a pick-from-a-list dialog, use `DialogList` before you build your own list. If you replace
  custom UI with an SDK component, keep behaviour the old UI had (e.g. search), or say that you
  dropped it.
- For long operations, show a neutral toast and update it as the work moves on.
- Bulk actions use `runRecordBatches`. Do not loop over every record in a single server call.

## Forms

- Validate every input in the form schema, across fields where needed, and again on the server.
- `Fieldset` and `RadioGroup` are `@experimental` in the 1.1.5 types; do not use them.

## Widgets, tabs and pages

- Widgets get no Suspense boundary from Attio. Wrap the content in the `Widget` render prop:

```tsx
Widget: ({recordId}) => (
    <React.Suspense fallback={<Widget.Loading />}>
        <OpenDealsWidget recordId={recordId} />
    </React.Suspense>
),
```

- Widgets: lint (`attio/widget-text-children`) enforces what `Widget.TextWidget` may contain.
  From SDK 1.1.4, put a `Badge` inside `Widget.Decoration`; a bare `Badge` is rejected.
- Show a clear widget state when data is missing (e.g. "No location"), not an empty widget.
  Members must add the widget to the page layout before it shows.
- A record tab's `id` is the last segment of its URL (the JSDoc saying it is only used
  internally is wrong). It must not be a built-in tab slug, or the build fails; the reserved
  slugs are listed on `/sdk/extensions/record-tab`.
- A version that drops a record tab removes it, and its placement, from every workspace.
- Layout components (`Card`, `Grid`, `Stack`, `EmptyState`) work on pages, record tabs and
  dialogs. Do not nest `Card`s: an inner card renders flat, with no border of its own.
  `EmptyState` must be the only child of its surface. With a sibling it silently does not
  render, with no error or warning.

## Workspace settings

- Secrets do not belong in settings. Use connections or environment variables.
- The settings `Form` has no `onSubmit` and no `SubmitButton`: fields save on blur or change.
  Validate through input props.
- Every value is `null` until it is set, so handle `null` wherever you read one.

## GraphQL

- Put queries in `.graphql` files. `attio dev` and `attio build` generate a `.graphql.d.ts` next
  to each one; do not edit or commit it. Run the build script after you change a query and
  before you rely on its types.
- Custom attributes come back as a union. Select `__typename` with an inline fragment, and narrow
  on it before you read the value. Fields can be `null`.
- GraphQL is client-only. Server code reads Attio data over REST (see `authentication.md`).

## Hooks

- If a component picks between two data sources (e.g. person vs company), call both hooks on
  every render and choose the result afterwards. Do not call either conditionally.
