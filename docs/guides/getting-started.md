# Getting started

## Prerequisites

- [opencode](https://opencode.ai) v1.15+ — install with `npm install -g opencode-ai`
- Node.js 22+

## Install

```bash
npm install -g @madhavmadupu/sdlc-harness
```

Or run directly without installation:

```bash
npx @madhavmadupu/sdlc-harness --feature "My feature"
```

## Start opencode

The harness needs an opencode server running in the background:

```bash
opencode serve
```

If no server is detected, the harness will attempt to auto-start one.

## Run a feature

```bash
sdlc-harness --feature "Add user authentication"
```

The harness will:
1. Decompose the feature into implementation and QA tasks
2. Assign agents (Coder, QA) to each task
3. Execute tasks via opencode sessions
4. Record decisions and artifacts in the knowledge graph

## Verify health

```bash
sdlc-harness --health
```

## What's next

- [CLI reference](../reference/cli.md) — full option list
- [Architecture overview](../architecture/overview.md) — how it works
