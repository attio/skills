# Attio for developers

The Attio for developers plugin helps coding agents build on Attio. Its skills cover building, debugging
and reviewing apps with the [Attio App SDK](https://docs.attio.com/sdk/overview). It works in Claude Code
and Codex, and doesn't connect to your Attio workspace.

## Skills

| Skill | Description |
| --- | --- |
| [`attio-apps`](skills/attio-apps/SKILL.md) | Build, modify, debug or review Attio apps built with the Attio App SDK. |

## Install

In Claude Code:

```
/plugin install attio-dev --marketplace attio/skills
```

In Codex:

```
codex plugin marketplace add attio/skills
codex plugin add attio-dev@attio
```
