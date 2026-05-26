# SDLC Harness

[![npm version](https://img.shields.io/npm/v/@madhavmadupu/sdlc-harness)](https://www.npmjs.com/package/@madhavmadupu/sdlc-harness)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![CI](https://github.com/madhavmadupu/sdlc-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/madhavmadupu/sdlc-harness/actions/workflows/ci.yml)

Multi-agent SDLC harness — decompose features into tasks, execute via LLM agents, track everything in a knowledge graph, and enforce quality gates.

Built on [opencode](https://opencode.ai), providers are swappable through a clean adapter interface.

## Features

- **Agent-based SDLC** — Architect, Coder, QA, and Stack Analyst agents collaborate through structured phases
- **Knowledge graph** — SQLite-backed property graph traces every feature, task, decision, and artifact
- **Quality gates** — Automated verification between phases with configurable criteria
- **Fork-retry resilience** — Failed tasks auto-fork sessions and retry up to configurable limits
- **Provider-agnostic** — Opencode adapter included; extend with your own backend
- **Health-aware** — Detects existing servers or auto-starts one on demand

## Quick start

```bash
# Start the opencode server
opencode serve

# Run a feature through the SDLC
npx sdlc-harness --feature "Add user authentication"
```

## Requirements

- [opencode](https://opencode.ai) v1.15+ running as a headless server (`opencode serve`)
- Node.js 22+

## Install

```bash
npm install -g @madhavmadupu/sdlc-harness
```

Or run directly with `npx`.

## Usage

```bash
sdlc-harness --feature <title> [options]
```

| Option | Description |
|---|---|
| `--feature <title>` | Feature title to run through the SDLC |
| `--feature-id <id>` | Explicit feature ID (auto-generated if omitted) |
| `--feature-desc <text>` | Feature description (defaults to title) |
| `--model <model>` | Model override (e.g. `opencode/gpt-4`) |
| `--health` | Check opencode server health |
| `--db <path>` | Knowledge graph database path |
| `--server <url>` | opencode server URL override |

Environment variables: `OPENCODE_SERVER`, `SDLC_DB`.

## Architecture

```
┌─ HARNESS BRAIN ─────────────────────────────────────┐
│  Orchestrator    Agent roles    Policy / gates       │
│  Knowledge graph (SQLite) + reasoning store          │
└────────────────────────┬────────────────────────────┘
                         │ normalized events
┌─ PROVIDER SEAM ───────┴────────────────────────────┐
│  OpencodeBackend adapter (one interface)             │
└────────────────────────┬────────────────────────────┘
                         │ HTTP + SSE
┌─ OPENCODE SERVER ──────┴────────────────────────────┐
│  Sessions · Event stream · Diff · Permissions        │
│  Provider routing (any LLM)                          │
└─────────────────────────────────────────────────────┘
```

## Documentation

| Section | Contents |
|---|---|
| [Getting started](docs/guides/getting-started.md) | Installation, first feature, CLI overview |
| [Architecture](docs/architecture/overview.md) | System design, components, data flow |
| [Knowledge graph](docs/architecture/knowledge-graph.md) | Schema, queries, graph traversal |
| [Agent roles](docs/architecture/agent-roles.md) | Agent definitions, prompts, responsibilities |
| [CLI reference](docs/reference/cli.md) | Full CLI options and environment variables |
| [Contributing](docs/development/contributing.md) | Setup, testing, pull request guide |

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
