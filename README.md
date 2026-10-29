# Attio AI plugins

> [!NOTE]
> Work in progress: the skills in these plugins are still being written.

Plugins that bring [Attio](https://attio.com) to AI assistants and coding agents, including Claude, Claude
Code, ChatGPT and Codex. Each plugin bundles [Agent Skills](https://agentskills.io) and, where it needs
workspace access, the [Attio MCP server](https://docs.attio.com/mcp/overview).

<!-- BEGIN GENERATED: plugins -->

| Plugin                           | Description                                                     |
| -------------------------------- | --------------------------------------------------------------- |
| [`attio`](plugins/attio)         | Build pipeline, advance deals, and grow accounts.               |
| [`attio-dev`](plugins/attio-dev) | Build and review Attio apps with the App SDK, REST API and MCP. |

<!-- END GENERATED: plugins -->

## Skills

<!-- BEGIN GENERATED: skills -->

| Plugin      | Skill                                                        | Description                                                             |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `attio`     | [`onboarding`](plugins/attio/skills/onboarding/SKILL.md)     | Sets up the Attio plugin for a new user.                                |
| `attio-dev` | [`attio-apps`](plugins/attio-dev/skills/attio-apps/SKILL.md) | Build, modify, debug or review Attio apps built with the Attio App SDK. |

<!-- END GENERATED: skills -->

## Install

This repository is a plugin marketplace for Claude Code and Codex. Install the plugins you want from it:

<!-- BEGIN GENERATED: install -->

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

<!-- END GENERATED: install -->

The `attio` plugin connects to the Attio MCP server. Sign in with your Attio account when your client
asks. The assistant can only see and change what your Attio permissions allow.

## Updates

The marketplace points at the latest release of each plugin. Until the first release, it installs from `main`.

- **Claude Code:** run `claude plugin update <plugin>@attio` in a terminal, or turn on auto-update for the
  `attio` marketplace in `/plugin` under Marketplaces. Run `/reload-plugins` to load the new version.
- **Codex:** checks for updates when it starts. Run `codex plugin marketplace upgrade attio` to check now.

## Repository layout

```text
plugins/<plugin>/skills/<skill>/SKILL.md   skills, one folder each
plugins/<plugin>/README.md                 plugin overview
plugin.config.ts                           source for every manifest and marketplace file
scripts/                                   generator, checks and the release build
```

Each plugin folder also holds manifests for every supported client. They're generated from
`plugin.config.ts`, so don't edit them by hand.
