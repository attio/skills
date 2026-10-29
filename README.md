# Attio AI plugins

> [!NOTE]
> Work in progress: the skills in these plugins are still being written.

Plugins that bring [Attio](https://attio.com) to AI assistants and coding agents, including Claude, Claude
Code, ChatGPT and Codex. Each plugin bundles [Agent Skills](https://agentskills.io) and, where it needs
workspace access, the [Attio MCP server](https://docs.attio.com/mcp/overview).

| Plugin | Description |
| --- | --- |
| [`attio`](plugins/attio) | Build pipeline, advance deals, and grow accounts. |
| [`attio-dev`](plugins/attio-dev) | Build and review Attio apps with the App SDK, REST API and MCP. |

## Skills

| Plugin | Skill | Description |
| --- | --- | --- |
| `attio` | [`onboarding`](plugins/attio/skills/onboarding/SKILL.md) | Sets up the Attio plugin for a new user. |
| `attio-dev` | [`attio-apps`](plugins/attio-dev/skills/attio-apps/SKILL.md) | Build, modify, debug or review Attio apps built with the Attio App SDK. |

## Install

This repository is a plugin marketplace for Claude Code and Codex. Install the plugins you want from it:

In Claude Code:

```
/plugin install attio --marketplace attio/skills
/plugin install attio-dev --marketplace attio/skills
```

In Codex:

```
codex plugin marketplace add attio/skills
codex plugin add attio@attio
codex plugin add attio-dev@attio
```

The `attio` plugin connects to the Attio MCP server. Sign in with your Attio account when your client
asks. The assistant can only see and change what your Attio permissions allow.

## Repository layout

```text
plugins/<plugin>/skills/<skill>/SKILL.md   skills, one folder each
```

Each plugin folder also holds manifests for every supported client.
