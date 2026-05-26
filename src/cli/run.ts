import { GraphStore } from "../graph/store.ts";
import { OpencodeBackend } from "../adapter/opencode.ts";
import { Orchestrator } from "../orchestrator/index.ts";
import { ServerManager } from "../server-manager.ts";
import { MemoryStore } from "../memory/store.ts";
import {
  bold,
  dim,
  green,
  red,
  yellow,
  cyan,
  header,
  divider,
  section,
  item,
  success,
  error,
  info,
  createSpinner,
} from "./utils.ts";

export interface RunOptions {
  feature: string;
  featureId?: string;
  featureDesc?: string;
  model?: string;
  db?: string;
  server?: string;
}

export async function runFeature(opts: RunOptions): Promise<void> {
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER;
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  // Parse model
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

  // Auto-start opencode server
  let effectiveUrl = serverUrl;
  if (!effectiveUrl) {
    const spinner = createSpinner("Starting opencode server...");
    spinner.start();
    const manager = new ServerManager();
    manager.setupCleanup();
    try {
      const handle = await manager.start();
      effectiveUrl = handle.url;
      spinner.stop(green(`opencode server ready at ${effectiveUrl}`));
    } catch (err) {
      spinner.fail(red("Failed to start opencode server"));
      throw err;
    }
  } else {
    const spinner = createSpinner(`Connecting to opencode at ${effectiveUrl}...`);
    spinner.start();
    const testRes = await fetch(`${effectiveUrl}/global/health`).catch(
      () => null,
    );
    if (!testRes || !testRes.ok) {
      spinner.fail(red(`Cannot reach opencode server at ${effectiveUrl}`));
      console.error(`  ${dim("Set OPENCODE_SERVER or omit it for auto-detection")}`);
      process.exit(1);
    }
    spinner.stop(green(`Connected to opencode at ${effectiveUrl}`));
  }

  // Initialize graph + memory
  const graph = new GraphStore(dbPath);
  const memory = new MemoryStore(dbPath);
  const backend = new OpencodeBackend(effectiveUrl);
  const orchestrator = new Orchestrator(graph, backend, memory, {
    model: modelObj,
  });

  // Health check
  const health = await backend.health();
  if (!health.healthy) {
    error(`opencode server at ${effectiveUrl} is not healthy`);
    process.exit(1);
  }

  // Run feature
  const featureId = opts.featureId ?? `feat_${Date.now()}`;
  const feature = {
    id: featureId,
    title: opts.feature,
    description: opts.featureDesc ?? opts.feature,
  };

  header(`Running feature`);
  item("Feature", bold(opts.feature));
  item("ID", dim(featureId));
  if (modelObj) item("Model", `${modelObj.providerID}/${modelObj.modelID}`);
  item("Database", dbPath);
  divider();

  const startTime = Date.now();

  try {
    const spinner = createSpinner("Executing SDLC pipeline...");
    spinner.start();

    const result = await orchestrator.runFeature(feature);

    const duration = Date.now() - startTime;
    spinner.stop(green(`Done in ${(duration / 1000).toFixed(1)}s`));

    divider();
    section("Results");

    const outcomeColor =
      result.outcome === "done"
        ? green
        : result.outcome === "failed"
          ? red
          : yellow;
    item("Outcome", outcomeColor(result.outcome));
    item("Duration", `${Math.round((Date.now() - startTime) / 1000)}s`);
    item("Tasks", String(result.tasks.length));

    divider();

    for (const r of result.results) {
      const icon = r.outcome === "passed" ? green("✔") : red("✗");
      const label = dim(r.taskId);
      const attempts =
        r.attempts > 1 ? dim(` (${r.attempts} attempts)`) : "";
      console.log(`  ${icon} ${label}${attempts}`);
      if (r.error) console.log(`     ${dim("Error:")} ${r.error}`);
    }

    divider();

    if (result.outcome === "done") {
      success("Feature completed successfully");
    } else if (result.outcome === "failed") {
      error("Feature failed");
    } else {
      info("Feature partially completed");
    }
  } catch (err) {
    const duration = Date.now() - startTime;
    divider();
    error(
      `Failed after ${Math.round(duration / 1000)}s: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}
