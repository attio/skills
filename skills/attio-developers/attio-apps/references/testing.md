# Testing

Read this file before you add or fix tests.

Docs: no Attio page covers testing; read the pages for the surface under test.

The app template has no test runner. If the app has one, use it. If it has none and the change
adds logic worth testing, suggest adding one (Vitest works) and ask before you add the
dependency.

## What to test

- Logic that is not trivial: error mapping, response parsing, data transforms between Attio and
  the vendor, unit and format conversion, pagination budgets, dedupe, signature checks.
- Test the app's code, not its dependencies. Do not assert that Zod rejects a bad shape; assert
  what the app does with the failure.
- **Test a pure function, not `execute.ts`.** Put a handler's decisions (which outcome, which
  error, `retryable`) in a plain function next to it and test that. Importing `execute.ts` pulls
  in `block.ts` and the `attio` package, which may not load under Vitest. If you must test the
  handler file, mock `./block` and add `Workflows` to the `attio/server` mock.
- Likewise, keep `kv`-backed logic in pure functions so it needs no mocks.
- Never use `any` or `as unknown as` to force a mock into shape.

## Config and mocks

`attio/server` and `attio/client` only work inside Attio's runtime. Alias them to small mocks
and inline `attio`:

```ts
import {defineConfig} from "vitest/config"

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        environment: "node",
        passWithNoTests: true,
        server: {deps: {inline: ["attio"]}},
        alias: {
            "attio/server": new URL("./src/__mocks__/attio-server.ts", import.meta.url).pathname,
        },
    },
})
```

- The mock exports only what the code under test imports (e.g.
  `export const getWorkspaceConnection = () => ({value: "test-token"})`, an in-memory `kv`).
- Stub `fetch` with `vi.stubGlobal` or `vi.spyOn(globalThis, "fetch")`, and restore it in
  `afterEach`.
