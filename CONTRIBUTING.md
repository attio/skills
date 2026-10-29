# Contributing

Thanks for helping improve Attio's plugins. Skills are instructions that an agent follows, so we review
changes to them as carefully as code. A maintainer reviews every pull request.

## Set up

You need Node.js 22.18 or later and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm check
```

## Add or change a skill

Each skill is a folder in `plugins/<plugin>/skills/` and follows the
[Agent Skills specification](https://agentskills.io/specification):

```text
plugins/attio/skills/meeting-prep/
├── SKILL.md         # required
└── references/      # optional detail, loaded when SKILL.md links to it
```

`SKILL.md` starts with YAML frontmatter:

```yaml
---
name: meeting-prep
description: Prepares a brief for an upcoming meeting. Use when the user asks to prep for a call or meeting.
metadata:
  mcp-tools: "search-meetings search-records get-records-by-ids"
---
```

- `name` matches the folder name and uses lowercase letters, digits and hyphens.
- `description` says what the skill does and when to use it, in under 1,024 characters.
- The only other allowed keys are `license`, `metadata` and `allowed-tools`. Every `metadata` value is a
  string, so quote numbers.
- `metadata.mcp-tools` lists, separated by spaces, every Attio MCP tool the skill uses. Write tool names in
  backticks in the skill text, such as `search-records`. The checks fail if a skill uses a tool it doesn't
  list, or lists a tool that isn't in [`mcp-tools.json`](mcp-tools.json).
- Keep `SKILL.md` under 500 lines. Move detail into `references/` and link to it from `SKILL.md`.
- Write skills that work in every client, and with any Attio workspace and data model.

Run `pnpm generate` after adding, removing or renaming a skill, or changing its description, to update the skill
tables in the READMEs.

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
| `pnpm check` | Generated files are up to date, skills pass the lint, and every MCP tool a skill uses exists |
| `pnpm test` | The scripts' own tests |
| `pnpm typecheck` | TypeScript types |
| `pnpm validate:hosts` | Installs both plugins with the Claude Code and Codex CLIs, if you have them |
| `pnpm build:zip` | Builds the OpenAI upload ZIP in `dist/` |

CI runs all of them on every pull request.

## Releases

Maintainers publish releases. Two fields in `plugin.config.ts` control them: `version` is the version on `main`,
and `published` is the release users get. Each command below checks the repo is ready, does one step, and
prints the next. Run them from an up-to-date `main` with the GitHub CLI signed in.

| Step | Command | What users get |
| --- | --- | --- |
| 1. Bump | `pnpm release bump X.Y.Z` opens a pull request that sets `version`. Merge it. | The previous release |
| 2. Tag | `pnpm release tag` tags `main` as `vX.Y.Z`. CI builds the release. | The previous release |
| 3. Check | Test the tagged build. If something's wrong, fix it and release the next patch version. | The previous release |
| 4. Publish | `pnpm release publish` opens a pull request that sets `published`. Merge it. | `X.Y.Z` |

Each release needs a higher `version` than the last, because Claude Code only updates a plugin when its version
changes. The marketplace files pin each release's tag and commit, and only point at tags that exist. That's why
publishing is its own step: a tag can only be created once its commit is on `main`, so the marketplace can
only point at it afterwards. Until the first release, `published` is unset and they install from `main`.
