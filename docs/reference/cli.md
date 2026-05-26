# CLI reference

## Synopsis

```bash
sdlc-harness --feature <title> [options]
sdlc-harness --health
sdlc-harness --help
```

## Options

| Option | Description |
|---|---|
| `--feature <title>` | Feature title to run through the SDLC |
| `--feature-id <id>` | Explicit feature ID (auto-generated if omitted, format: `feat_<timestamp>`) |
| `--feature-desc <text>` | Feature description (defaults to the title) |
| `--model <model>` | Model override in `provider/model` format (e.g. `opencode/gpt-4`) |
| `--health` | Check opencode server connectivity and health |
| `--db <path>` | Path to the knowledge graph SQLite database (default: `./sdlc-harness.db`) |
| `--server <url>` | opencode server URL override |
| `--help, -h` | Display help message |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENCODE_SERVER` | `http://127.0.0.1:4096` | URL of the opencode server |
| `SDLC_DB` | `./sdlc-harness.db` | Path to the knowledge graph database |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Feature completed successfully or system healthy |
| 1 | Fatal error (server unreachable, unhealthy, or crash) |

## Examples

```bash
# Run a feature
sdlc-harness --feature "Add login page"

# Specify a model
sdlc-harness --feature "Add search" --model opencode/deepseek-v4

# Custom database path
sdlc-harness --feature "Refactor auth" --db ./my-project.db

# Health check
sdlc-harness --health
```
