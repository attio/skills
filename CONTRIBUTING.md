# Contributing

Thanks for helping improve Attio's plugins. Skills are instructions that an agent follows, so we review
changes to them as carefully as code. A maintainer reviews every pull request.

## Set up

You need Node.js 22.18 or later and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm check
```

## Change a plugin

Plugin names, descriptions, versions and MCP servers live in [`plugin.config.ts`](plugin.config.ts). The
manifests and marketplace files for each client are generated from it:

| File | Read by |
| --- | --- |
| `plugins/<plugin>/plugin.json`, `plugins/<plugin>/mcp.json` | ChatGPT and Codex |
| `plugins/<plugin>/.claude-plugin/plugin.json`, `plugins/<plugin>/.mcp.json` | Claude and Claude Code |
| `.agents/plugins/marketplace.json` | Codex |
| `.claude-plugin/marketplace.json` | Claude Code |

Edit `plugin.config.ts`, run `pnpm generate`, and commit the generated files with your change.

## Checks

| Command | What it checks |
| --- | --- |
| `pnpm check` | Generated files are up to date |
| `pnpm test` | The scripts' own tests |
| `pnpm typecheck` | TypeScript types |
