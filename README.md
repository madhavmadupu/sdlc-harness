# sdlc-harness

Multi-agent SDLC harness: decompose features into tasks, execute via LLM agents, track everything in a knowledge graph, and enforce quality gates. Providers are swappable — opencode is the primary backend today.

## Quick start

```bash
# Start opencode server
opencode serve

# Install and run a feature
npx sdlc-harness --feature "Add user authentication"
```

## Requirements

- [opencode](https://opencode.ai) v1.15+ running as a headless server (`opencode serve`)
- Node.js 22+

## CLI

```
sdlc-harness --feature <title> [options]

Options:
  --feature <title>     Feature title to run through the SDLC
  --feature-id <id>     Feature ID (default: auto-generated)
  --feature-desc <text> Feature description (default: same as title)
  --model <id>          Model (e.g. opencode/deepseek-v4-flash-free)
  --health              Check opencode server health
  --db <path>           Knowledge graph database path
  --server <url>        opencode server URL (default: http://127.0.0.1:4096)

Env:
  OPENCODE_SERVER   default: http://127.0.0.1:4096
  SDLC_DB           default: ./sdlc-harness.db
```

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

## Knowledge graph

The harness stores everything in a SQLite-backed property graph:
- **Structural** — features, modules, tasks, decisions, files, artifacts, edges
- **Reasoning** — append-only thinking traces, summaries, and decisions keyed to nodes
- **Agent status** — real-time cross-agent visibility

Query patterns: "what features break if I change module X?" via recursive CTE.

## Development

```bash
npm install
npm run typecheck   # TypeScript check
npm test            # Run tests
npm run build       # Bundle for distribution
```

## License

MIT
