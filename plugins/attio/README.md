# Attio

The Attio plugin connects your AI assistant to your [Attio](https://attio.com) workspace. Use it to search, create and update records, prepare for meetings and review your pipeline.

## What it connects to

The plugin adds the [Attio MCP server](https://docs.attio.com/mcp/overview) at `https://mcp.attio.com/mcp`. Your client asks you to sign in with your Attio account the first time you use it. The assistant can only see and change what your Attio permissions allow. The plugin doesn't connect to any other service.

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
