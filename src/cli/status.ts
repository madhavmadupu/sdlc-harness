declare const __SDLC_HARNESS_VERSION__: string;

import { bold, dim, green, red, yellow, cyan, header, divider, section, item, success, error, info, createSpinner } from "./utils.ts";
import { GraphStore } from "../graph/store.ts";
import { NodeType } from "../graph/schema.ts";
import { MemoryStore } from "../memory/store.ts";

export interface StatusOptions {
  server?: string;
  db?: string;
}

export async function status(opts: StatusOptions): Promise<void> {
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER ?? "http://127.0.0.1:4096";
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  header("SDLC Harness Status");

  // Server status
  const serverSpinner = createSpinner("Checking opencode server...");
  serverSpinner.start();

  let serverHealthy = false;
  let serverVersion = "?";

  try {
    const res = await fetch(`${serverUrl}/global/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as { healthy?: boolean; version?: string };
      serverHealthy = data.healthy === true;
      serverVersion = data.version ?? "?";
    }
  } catch {
    // Not reachable
  }

  serverSpinner.stop();
  section("Server");
  if (serverHealthy) {
    item("Status", green("healthy"));
    item("URL", serverUrl);
    item("Version", serverVersion);

    // Get sessions
    try {
      const backend = new (await import("../adapter/opencode.ts")).OpencodeBackend(serverUrl);
      const sessions = await backend.getAllSessionStatuses();
      const sessionCount = Object.keys(sessions).length;
      const activeCount = Object.values(sessions).filter(
        (s) => s.status !== "idle" && s.status !== "ended",
      ).length;
      item("Sessions", `${sessionCount} total, ${activeCount} active`);
    } catch {
      item("Sessions", dim("unavailable"));
    }
  } else {
    item("Status", red("not reachable"));
    item("URL", serverUrl);
    info("Start the server with: opencode serve");
  }

  // Database status
  section("Knowledge Graph");
  try {
    const { accessSync, constants, statSync } = await import("node:fs");
    accessSync(dbPath, constants.R_OK);
    const stats = statSync(dbPath);

    item("Database", dbPath);
    item("Size", `${(stats.size / 1024).toFixed(1)} KB`);
    item("Modified", new Date(stats.mtime).toISOString().slice(0, 19).replace("T", " "));

    // Query graph counts
    try {
      const graph = new GraphStore(dbPath);
      const featureCount = graph.listNodes(NodeType.Feature).length;
      const taskCount = graph.listNodes(NodeType.Task).length;
      const fileCount = graph.listNodes(NodeType.File).length;
      const agentCount = graph.listNodes(NodeType.Agent).length;

      item("Features", String(featureCount));
      item("Tasks", String(taskCount));
      item("Files", String(fileCount));
      item("Agents", String(agentCount));

      graph.close();
    } catch {
      item("Contents", dim("could not read"));
    }
  } catch {
    item("Database", dim("not found"));
    info("First run will create it automatically");
  }

  // Process memory
  section("Process Memory");
  try {
    const memory = new MemoryStore(dbPath);
    const memStats = memory.getStats();
    item("Entries", String(memStats.totalEntries));
    if (memStats.totalEntries > 0) {
      item("Workflows", String(memStats.workflows));
      item("Task patterns", String(memStats.taskPatterns));
      item("Knowledge", String(memStats.knowledge));
    }
    memory.close();
  } catch {
    item("Entries", dim("unavailable"));
  }

  // Package version
  section("CLI");
  const version = (typeof __SDLC_HARNESS_VERSION__ !== "undefined"
    ? __SDLC_HARNESS_VERSION__
    : "?"
  );
  item("Version", `v${version}`);
  item("Node.js", process.version);
  item("Platform", process.platform);

  divider();
}
