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
- **Interactive mode** — Run with no args for a guided menu

## Quick start

```bash
# Install
npm install -g @madhavmadupu/sdlc-harness

# Run a feature
sdlc-harness run "Add user authentication"
```

## Requirements

- [opencode](https://opencode.ai) v1.15+ (`npm install -g opencode-ai`)
- Node.js 22+

## Usage

### CLI

```bash
sdlc-harness run "Feature title"     Run a feature through the SDLC
sdlc-harness status                  Check system health
sdlc-harness doctor                  Diagnose and fix issues
sdlc-harness init                    Initialize a project
sdlc-harness                         Interactive mode
```

### Run options

```bash
sdlc-harness run "Add login" --model opencode/gpt-4 --db ./my-project.db
```

| Option | Description |
|---|---|
| `--model <model>` | Model override (e.g. `opencode/gpt-4`) |
| `--id <id>` | Explicit feature ID |
| `--desc <text>` | Feature description |
| `--db <path>` | Knowledge graph database path |
| `--server <url>` | opencode server URL |

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
| [CLI reference](docs/reference/cli.md) | Full CLI commands, options, and environment variables |
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
