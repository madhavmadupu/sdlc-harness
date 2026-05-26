import { startDashboard, renderDashboard, type DashboardState } from "../tui/dashboard.ts";
import { MemoryStore } from "../memory/store.ts";
import { ServerManager } from "../server-manager.ts";
import { bold, cyan, dim, green, red } from "./utils.ts";

export interface WatchOptions {
  feature: string;
  model?: string;
  db?: string;
  server?: string;
}

export async function watchFeature(opts: WatchOptions): Promise<void> {
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER;
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  let effectiveUrl = serverUrl;
  if (!effectiveUrl) {
    console.log(`  ${dim("Starting opencode server...")}`);
    const manager = new ServerManager();
    manager.setupCleanup();
    try {
      const handle = await manager.start();
      effectiveUrl = handle.url;
      console.log(`  ${green("✔")} opencode server ready at ${effectiveUrl}`);
    } catch (err) {
      console.error(`  ${red("✘")} Failed to start opencode server: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  const memory = new MemoryStore(dbPath);
  const startTime = Date.now();

  const state: DashboardState = {
    feature: opts.feature,
    featureId: `feat_${Date.now()}`,
    status: "running",
    tasks: [],
    memoryStats: { total: 0, byCategory: {} },
    serverUrl: effectiveUrl,
    serverHealthy: true,
    elapsed: 0,
  };

  const dashboard = startDashboard(
    () => {
      state.elapsed = Date.now() - startTime;

      fetch(`${effectiveUrl}/global/health`)
        .then((r) => { state.serverHealthy = r.ok; })
        .catch(() => { state.serverHealthy = false; });

      try {
        const allMemories = memory.search({});
        state.memoryStats.total = allMemories.length;
        const byCategory: Record<string, number> = {};
        for (const m of allMemories) {
          byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
        }
        state.memoryStats.byCategory = byCategory;
      } catch {
        // memory not ready yet
      }

      renderDashboard(state);
    },
    (key) => {
      if (key === "q" || key === "\x03") {
        dashboard.stop();
        console.log(`\n  ${dim("Watch ended.")}`);
        process.exit(0);
      }
    },
  );

  const { Orchestrator } = await import("../orchestrator/index.ts");
  const { GraphStore } = await import("../graph/store.ts");
  const { OpencodeBackend } = await import("../adapter/opencode.ts");

  const graph = new GraphStore(dbPath);
  const backend = new OpencodeBackend(effectiveUrl);
  const orchestrator = new Orchestrator(graph, backend, memory);
  const feature = {
    id: state.featureId,
    title: opts.feature,
    description: opts.feature,
  };

  try {
    const result = await orchestrator.runFeature(feature);
    state.status = result.outcome === "done" ? "done" : "failed";
    state.tasks = result.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }));
  } catch {
    state.status = "failed";
  }

  // Let user see final state before closing
  await new Promise((resolve) => setTimeout(resolve, 5000));
  dashboard.stop();
  console.log(`\n  ${dim("Feature completed with status:")} ${bold(state.status)}`);
}
