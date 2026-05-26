# Configuration

## CLI options

See the [CLI reference](../reference/cli.md) for all command-line options.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENCODE_SERVER` | `http://127.0.0.1:4096` | URL of the opencode server |
| `SDLC_DB` | `./sdlc-harness.db` | Path to the knowledge graph database |

## Orchestrator settings

The orchestrator accepts configuration for task retry behavior and model selection:

| Setting | Default | Description |
|---|---|---|
| `maxAttemptsPerTask` | 3 | Maximum retry attempts before a task is marked failed |
| `autoApprovePermissions` | true | Auto-allow permission requests during execution |
| `model` | — | Model override (e.g. `opencode/gpt-4`) |

## Git configuration

The project includes a `.gitignore` with sensible defaults for Node.js, TypeScript build output, database files, and environment files.
