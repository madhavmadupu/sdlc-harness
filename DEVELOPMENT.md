# Development workflow

## Quick cycle

```bash
# 1. Make changes (code, docs, config)
# 2. Verify
npm run typecheck
npm test
npm run build

# 3. Commit
git add -A
git commit -m "Short descriptive message"

# 4. Bump version
npm version patch   # bug fix
npm version minor   # new feature
npm version major   # breaking change

# 5. Push
git push

# 6. Publish to npmjs.org (unscoped name)
npm run publish:npm

# 7. Publish to GitHub Packages (scoped name)
npm run publish:github -- --name @madhavmadupu/sdlc-harness
```

## Publishing to both registries

Package name must be `sdlc-harness` in `package.json` for npmjs.org.  
To publish to GitHub Packages, override the name:

```bash
# Temporarily publish to GitHub Packages
sed -i 's/"name": "sdlc-harness"/"name": "@madhavmadupu\/sdlc-harness"/' package.json
npm run publish:github
sed -i 's/"name": "@madhavmadupu\/sdlc-harness"/"name": "sdlc-harness"/' package.json
git checkout package.json  # revert if dirty
```

Or use the shorthand scripts:
```bash
npm run publish:npm       # → registry.npmjs.org
npm run publish:github    # → npm.pkg.github.com
```

## Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run locally with `tsx` |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run Vitest tests |
| `npm run build` | Bundle with tsup |
| `npm run publish:npm` | Publish to npmjs.org |
| `npm run publish:github` | Publish to GitHub Packages |

## CLI entry point

`src/index.ts` → uses subcommand dispatch:
- `sdlc-harness run "feature"` — run feature
- `sdlc-harness watch "feature"` — run feature with live TUI dashboard
- `sdlc-harness status` — check health
- `sdlc-harness doctor` — diagnose
- `sdlc-harness init` — scaffold
- `sdlc-harness config [action]` — view/edit config
- `sdlc-harness memory [action]` — process memory queries
- `sdlc-harness --version` or `-v` — show version
- No args → interactive mode

## Project structure

```
src/
├── cli/              # CLI commands and utilities
│   ├── run.ts        # sdlc-harness run
│   ├── watch.ts      # sdlc-harness watch (TUI dashboard)
│   ├── status.ts     # sdlc-harness status
│   ├── doctor.ts     # sdlc-harness doctor
│   ├── init.ts       # sdlc-harness init
│   ├── config.ts     # sdlc-harness config
│   ├── memory.ts     # sdlc-harness memory
│   ├── help.ts       # sdlc-harness help
│   └── utils.ts      # colors, spinners, prompts, TUI helpers
├── tui/              # Terminal UI components
│   └── dashboard.ts  # Live feature monitoring dashboard
├── adapter/          # Backend provider adapters
├── agents/           # Agent role definitions
├── graph/            # Knowledge graph store + schema
├── memory/           # Process memory (SQLite-backed)
├── orchestrator/     # SDLC orchestration logic
├── types/            # Shared type definitions
├── index.ts          # CLI entry point
└── server-manager.ts # opencode server lifecycle
```

## Key config files

- `tsup.config.ts` — bundler config (ESM, no code splitting)
- `tsconfig.json` — TypeScript strict mode
- `package.json` — registry config via `publishConfig` and scripts
- `.github/workflows/ci.yml` — GitHub Actions CI

## First-time publish setup

```bash
# npmjs.org
echo "//registry.npmjs.org/:_authToken=npm_xxxxx" >> ~/.npmrc

# GitHub Packages
echo "//npm.pkg.github.com/:_authToken=ghp_xxxxx" >> ~/.npmrc
```
