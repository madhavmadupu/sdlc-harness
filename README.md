# sdlc-harness

A CLI tool that orchestrates features through an SDLC pipeline using the opencode backend and a knowledge graph store.

## Usage

```bash
# Run a feature through the SDLC
npx tsx src/index.ts --feature "Add user authentication"

# Specify a model
npx tsx src/index.ts --feature "Add user auth" --model "opencode/big-pickle"

# Health check
npx tsx src/index.ts --health
```

### Options

| Option            | Description                            |
| ----------------- | -------------------------------------- |
| `--feature`       | Feature title to run through the SDLC  |
| `--feature-id`    | Feature ID (default: auto-generated)   |
| `--feature-desc`  | Feature description                    |
| `--model`         | Model to use (e.g. opencode/big-pickle)|
| `--health`        | Check opencode server health           |
| `--db`            | Knowledge graph database path          |
| `--server`        | opencode server URL                    |

### Environment Variables

| Variable          | Default                    |
| ----------------- | -------------------------- |
| `OPENCODE_SERVER` | `http://127.0.0.1:4096`    |
| `SDLC_DB`         | `./sdlc-harness.db`        |

## Development

```bash
# Install dependencies
npm install

# Type-check
npm run typecheck

# Run tests
npm test

# Build
npm run build

# Start in watch mode
npm run dev
```
