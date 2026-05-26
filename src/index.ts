import { GraphStore } from "./graph/store.ts";
import { OpencodeBackend } from "./adapter/opencode.ts";
import { Orchestrator } from "./orchestrator/index.ts";
import { ServerManager } from "./server-manager.ts";

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
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER;
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  // Show help immediately (no server needed)
  if (opts.help || (!opts.feature && !opts.health)) {
    showHelp();
    return;
  }

  // Parse model: "providerID/modelID" → { providerID, modelID }
  let modelObj:
    | { providerID: string; modelID: string; variant?: string }
    | undefined;
  if (opts.model) {
    const parts = opts.model.split("/");
    modelObj = {
      providerID: parts[0] ?? "opencode",
      modelID: parts[1] ?? parts[0] ?? "big-pickle",
    };
  }

  // Auto-start opencode server (or reuse existing one)
  let effectiveUrl = serverUrl;
  if (!effectiveUrl) {
    const manager = new ServerManager();
    manager.setupCleanup();
    const handle = await manager.start();
    effectiveUrl = handle.url;
  } else {
    // Verify user-specified server is reachable
    const testRes = await fetch(`${effectiveUrl}/global/health`).catch(
      () => null,
    );
    if (!testRes || !testRes.ok) {
      console.error(`Cannot reach opencode server at ${effectiveUrl}`);
      console.error(
        `  Set OPENCODE_SERVER or omit it for auto-detection`,
      );
      process.exit(1);
    }
  }

  const graph = new GraphStore(dbPath);
  const backend = new OpencodeBackend(effectiveUrl);
  const orchestrator = new Orchestrator(graph, backend, {
    model: modelObj,
  });

  // Health check (also ensures the server is ready)
  const health = await backend.health();
  if (!health.healthy) {
    console.error(`opencode server at ${effectiveUrl} is not healthy`);
    process.exit(1);
  }

  if (opts.health) {
    console.log(
      `System healthy. Server: ${effectiveUrl} (v${health.version ?? "?"})`,
    );
    return;
  }

  // Run a feature through the SDLC
  const featureId = opts.featureId ?? `feat_${Date.now()}`;
  const feature = {
    id: featureId,
    title: opts.feature!,
    description: opts.featureDesc ?? opts.feature!,
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
}

function showHelp() {
  console.log(`
sdlc-harness — multi-agent SDLC harness

USAGE
  npx sdlc-harness --feature <title>       Run a feature through the SDLC
  npx sdlc-harness --health                Check system health
  npx sdlc-harness --help                  Show this message

WHAT IT DOES
  Starts an opencode server in the background, decomposes your feature
  into implementation + QA tasks, assigns agents, executes with fork-retry
  on failure, and records everything in a knowledge graph.

OPTIONS
  --feature <title>     Feature to implement (e.g. "Add login page")
  --feature-id <id>     Explicit feature ID (default: auto-generated)
  --feature-desc <text> Feature description (default: same as title)
  --model <model>       Model override (e.g. opencode/gpt-4)
  --health              Check connectivity
  --db <path>           Knowledge graph database (default: ./sdlc-harness.db)
  --server <url>        opencode server URL override for debugging
  --help, -h            Show this message

EXAMPLE
  sdlc-harness --feature "Add a README.md"
`);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
