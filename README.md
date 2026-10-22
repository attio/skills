# Attio skills

[Agent skills](https://agentskills.io) that help coding agents build on [Attio](https://attio.com).
Each skill is a folder under [`skills/`](skills/) with a `SKILL.md` and the `references/` it loads
on demand. This repo is the source of truth for Attio's skills. It does not accept pull requests.

| Skill | Use it for |
| --- | --- |
| [`attio-apps`](skills/attio-developers/attio-apps/SKILL.md) | Building, changing, debugging, reviewing and shipping apps built with the [Attio App SDK](https://docs.attio.com/sdk/overview): record actions, widgets, tabs, pages, settings, workflow blocks, webhooks, connections and third-party API clients. |

## Install

Install with the [`skills` CLI](https://github.com/vercel-labs/skills), which supports Claude Code,
Cursor, Codex and other agents that read the Agent Skills format:

```bash
npx skills add attio/skills                       # pick skills interactively
npx skills add attio/skills --skill attio-apps    # one skill
npx skills add attio/skills --list                # list what's available
```

Skills installed with the CLI do not update on their own. Run `npx skills update` to get the
latest versions.

## Using `attio-apps` in an app

Point the app's `AGENTS.md` at the skill so that every agent loads it:

```md
# AGENTS.md

Attio App SDK app. Before changing any code, load the `attio-apps` skill. If it is not
installed, run `npx skills add attio/skills --skill attio-apps -y`, then read its `SKILL.md`.
```

Put knowledge about one app in the app itself: gotchas in comments next to the code, and the 
external service and app-wide constraints in its README or `docs/`.
