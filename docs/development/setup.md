# Development setup

## Prerequisites

- Node.js 22+
- npm
- [opencode](https://opencode.ai) v1.15+

## Clone and install

```bash
git clone https://github.com/madhavmadupu/sdlc-harness.git
cd sdlc-harness
npm install
```

## Build

```bash
npm run build
```

Builds the project with `tsup` — outputs ESM bundles to `dist/`.

## Type-check

```bash
npm run typecheck
```

## Run tests

```bash
npm test
```

Uses [Vitest](https://vitest.dev) for testing.

## Project structure

```
src/
├── adapter/          # Backend provider adapters
│   ├── opencode.ts   # Opencode HTTP + SSE adapter
│   └── __tests__/
├── agents/           # Agent role definitions and prompts
│   └── roles.ts
├── graph/            # Knowledge graph store and schema
│   ├── store.ts
│   ├── schema.ts
│   └── __tests__/
├── orchestrator/     # SDLC orchestration logic
│   └── index.ts
├── types/            # Shared type definitions
│   └── events.ts
├── index.ts          # CLI entry point
└── server-manager.ts # opencode server lifecycle management
```

## Code style

- TypeScript with strict mode
- ESM modules (no CommonJS)
- No semicolons
- Descriptive variable names
