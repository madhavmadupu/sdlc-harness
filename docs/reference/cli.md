# CLI reference

## Synopsis

```bash
sdlc-harness [command] [options]
sdlc-harness run <feature> [options]
sdlc-harness status
sdlc-harness doctor
sdlc-harness init [directory]
sdlc-harness help
```

## Commands

### `run`

Run a feature through the SDLC pipeline.

```bash
sdlc-harness run "Add user authentication"
```

| Option | Description |
|---|---|
| `--model <model>` | Model override in `provider/model` format (e.g. `opencode/gpt-4`) |
| `--id <id>` | Explicit feature ID (auto-generated if omitted) |
| `--desc <text>` | Feature description (defaults to the title) |
| `--db <path>` | Path to the knowledge graph SQLite database |
| `--server <url>` | opencode server URL override |

### `status` / `health`

Check system health, server status, and knowledge graph statistics.

```bash
sdlc-harness status
```

### `doctor` / `diagnose`

Run diagnostics to identify and fix common issues.

```bash
sdlc-harness doctor
```

Checks:
- Node.js version (22+ required)
- opencode CLI installation
- opencode server connectivity
- Knowledge graph database
- Git repository

### `init` / `setup`

Initialize a project for SDLC Harness usage.

```bash
sdlc-harness init            # Current directory
sdlc-harness init ./my-project  # Specific directory
```

Creates:
- `.sdlc-harness.json` — project configuration
- Updates `.gitignore` with database entries
- Optionally creates `package.json`

### `help`

Display the full help reference.

```bash
sdlc-harness help
```

## Interactive mode

Run `sdlc-harness` with no arguments to enter interactive mode, which presents a menu of available commands.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENCODE_SERVER` | `http://127.0.0.1:4096` | URL of the opencode server |
| `SDLC_DB` | `./sdlc-harness.db` | Path to the knowledge graph database |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Fatal error (server unreachable, crash, or invalid args) |
