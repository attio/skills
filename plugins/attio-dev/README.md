# Attio for developers

The Attio for developers plugin helps coding agents build on Attio. Its skills cover building, debugging
and reviewing apps with the [Attio App SDK](https://docs.attio.com/sdk/overview). It works in Claude Code
and Codex, and doesn't connect to your Attio workspace.

## Skills

<!-- BEGIN GENERATED: skills -->
| Skill | Description |
| --- | --- |
| [`attio-apps`](skills/attio-apps/SKILL.md) | Build, modify, debug or review Attio apps built with the Attio App SDK. |
<!-- END GENERATED: skills -->

## Install

<!-- BEGIN GENERATED: install -->
In Claude Code:

```
/plugin install attio-dev --marketplace attio/skills
```

In Codex:

```
codex plugin marketplace add attio/skills
codex plugin add attio-dev@attio
```
<!-- END GENERATED: install -->

See the [main README](../../README.md#updates) for updates.
