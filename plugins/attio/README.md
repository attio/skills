# Attio

The Attio plugin connects Claude and ChatGPT to your Attio workspace. It adds the
[Attio MCP server](https://docs.attio.com/mcp/overview), so the assistant can search, create and update
records, notes, tasks and lists, and skills that guide it through common sales work in Attio.

You sign in with your Attio account the first time the plugin connects, and the assistant can only see
and change what your Attio permissions allow.

## Skills

| Skill | Description |
| --- | --- |
| [`onboarding`](skills/onboarding/SKILL.md) | Sets up the Attio plugin for a new user. |

## Install

In Claude Code:

```
/plugin install attio --marketplace attio/skills
```

In Codex:

```
codex plugin marketplace add attio/skills
codex plugin add attio@attio
```

## Links

- [Attio MCP documentation](https://docs.attio.com/mcp/overview)
- [Help center](https://attio.com/help)
- [Privacy policy](https://attio.com/legal/privacy)
- [Services agreement](https://attio.com/legal/services-agreement)
