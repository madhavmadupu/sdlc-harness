# Basic usage examples

## Run a feature

```bash
sdlc-harness --feature "Add README.md to project"
```

The harness creates implementation and QA tasks, executes them through opencode agents, and records the results.

## Custom model

```bash
sdlc-harness --feature "Add input validation" --model opencode/deepseek-v4
```

## Health check with custom server

```bash
sdlc-harness --health --server http://localhost:4096
```

## Persistent database

```bash
sdlc-harness --feature "Refactor database layer" --db ./project-kg.db
```

Reusing the same database across runs builds up a graph that can be queried for impact analysis.
