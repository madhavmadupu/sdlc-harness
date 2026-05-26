# Architecture overview

## High-level design

The SDLC Harness follows a layered architecture with a provider seam that decouples the orchestration logic from the LLM backend.

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

## Components

### Orchestrator (`src/orchestrator/`)
Conducts the full SDLC for a feature:
1. **Decompose** — breaks a feature into tasks
2. **Assign** — picks agent roles per task
3. **Execute** — runs tasks via the backend adapter
4. **Gate** — runs quality checks between phases
5. **Record** — persists results to the knowledge graph

### Knowledge graph (`src/graph/`)
SQLite-backed property graph with two stores:
- **Structural** — nodes (features, modules, tasks, files, agents, artifacts) connected by typed edges
- **Reasoning** — append-only documents (thinking traces, summaries, decisions) keyed to nodes

### Backend adapter (`src/adapter/`)
Translates between the LLM backend's API and the harness's normalized event model. Currently ships with an `OpencodeBackend` that communicates via HTTP and SSE.

### Agents (`src/agents/`)
Portable system prompts and role definitions that define agent behavior independently of the backend.

## Data flow

1. User submits a feature via CLI
2. Orchestrator decomposes the feature into tasks and writes them to the graph
3. Each task is executed through the provider seam with session management
4. Real-time events (thinking, file changes, tool calls) are streamed back and recorded
5. Quality gates verify results; failed tasks fork and retry
6. All decisions and artifacts are persisted for traceability
