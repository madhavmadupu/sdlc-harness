import { GraphStore } from "./graph/store.ts";
import { OpencodeBackend } from "./adapter/opencode.ts";
import { Orchestrator } from "./orchestrator/index.ts";
import { readFileSync, existsSync } from "node:fs";

// ── CLI entry point ────────────────────────────────────────
//
// Usage:
//   npx tsx src/index.ts --feature "Add user authentication"
//   npx tsx src/index.ts --feature "Add user auth" --model "opencode/big-pickle"
//   npx tsx src/index.ts --health                  (check opencode server)
//
// Env:
//   OPENCODE_SERVER   default: http://127.0.0.1:4096
//   SDLC_DB           default: ./sdlc-harness.db

interface CliArgs {
  feature?: string;
  model?: string;
  health?: boolean;
  help?: boolean;
  db?: string;
  server?: string;
  featureId?: string;
  featureDesc?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const opts: CliArgs = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--feature":
        opts.feature = args[++i];
        break;
      case "--feature-id":
        opts.featureId = args[++i];
        break;
      case "--feature-desc":
        opts.featureDesc = args[++i];
        break;
      case "--model":
        opts.model = args[++i];
        break;
      case "--health":
        opts.health = true;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--db":
        opts.db = args[++i];
        break;
      case "--server":
        opts.server = args[++i];
        break;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER ?? "http://127.0.0.1:4096";
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  // Parse model: "providerID/modelID" → { id, providerID }
  let modelObj: { providerID: string; modelID: string; variant?: string } | undefined;
  if (opts.model) {
    const parts = opts.model.split("/");
    modelObj = {
      providerID: parts[0] ?? "opencode",
      modelID: parts[1] ?? parts[0] ?? "big-pickle",
    };
  }

  if (opts.help || (!opts.feature && !opts.health)) {
    showHelp(serverUrl);
    return;
  }

  const graph = new GraphStore(dbPath);
  const backend = new OpencodeBackend(serverUrl);
  const orchestrator = new Orchestrator(graph, backend, {
    model: modelObj,
  });

  // Health check
  const health = await backend.health();
  if (!health.healthy) {
    console.error(
      `Cannot reach opencode server at ${serverUrl}. Is opencode serve running?`,
    );
    console.error(`  Start it: opencode serve --port 4096`);
    process.exit(1);
  }
  console.log(`opencode server: ${serverUrl} (v${health.version ?? "?"})`);

  if (opts.health) {
    console.log("System healthy.");
    return;
  }

  // Run a feature through the SDLC
  if (opts.feature) {
    const featureId =
      opts.featureId ??
      `feat_${Date.now()}`;
    const feature = {
      id: featureId,
      title: opts.feature,
      description:
        opts.featureDesc ?? opts.feature,
    };

    console.log(`\nRunning feature: ${feature.title} (${feature.id})`);
    console.log("─".repeat(50));

    const result = await orchestrator.runFeature(feature);

    console.log(`\nOutcome: ${result.outcome}`);
    console.log("─".repeat(50));

    for (const r of result.results) {
      const icon = r.outcome === "passed" ? "✓" : "✗";
      console.log(
        `  ${icon} ${r.taskId}: ${r.outcome} (${r.attempts} attempt${r.attempts > 1 ? "s" : ""})`,
      );
      if (r.error) console.log(`     Error: ${r.error}`);
    }

    console.log("\nTasks created:");
    for (const task of result.tasks) {
      console.log(`  - ${task.id}: ${task.title} [${task.status}]`);
    }

    return;
  }

  // No feature specified — show available commands
  showHelp(serverUrl);
}

function showHelp(serverUrl: string) {
  console.log(`
sdlc-harness — multi-agent SDLC harness

USAGE
  npx sdlc-harness --feature <title>       Run a feature
  npx sdlc-harness --health                Check connectivity
  npx sdlc-harness --help                  This message

REQUIREMENTS
  opencode server at ${serverUrl}
  Install: npm install -g opencode
  Start:   opencode serve

OPTIONS
  --feature <title>     Feature to implement (e.g. "Add login page")
  --feature-id <id>     Set feature ID (default: auto-generated)
  --feature-desc <text> Feature description (default: same as title)
  --model <model>       Model to use (e.g. opencode/big-pickle)
  --health              Check opencode server health
  --db <path>           Knowledge graph database path (default: ./sdlc-harness.db)
  --server <url>        opencode server URL (default: http://127.0.0.1:4096)

EXAMPLE
  npx sdlc-harness --feature "Add README.md" --server http://localhost:4096
`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
