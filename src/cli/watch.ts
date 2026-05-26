import { createDashboard, type DashboardState } from "../tui/dashboard.ts";
import { ServerManager } from "../server-manager.ts";
import { dim, red } from "./utils.ts";

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
    } catch (err) {
      console.error(`  ${red("✘")} Failed to start opencode server: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  const { MemoryStore } = await import("../memory/store.ts");
  const memory = new MemoryStore(dbPath);
  const startTime = Date.now();

  let userQuit = false;

  const state: DashboardState = {
    feature: opts.feature,
    featureId: `feat_${Date.now()}`,
    status: "starting",
    tasks: [],
    memoryStats: { total: 0, byCategory: {} },
    serverUrl: effectiveUrl,
    serverHealthy: true,
    elapsed: 0,
  };

  const dashboard = createDashboard(() => {
    userQuit = true;
  });
  dashboard.update(state);

  // Poll loop for dynamic state
  const pollTimer = setInterval(() => {
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
      // memory not ready
    }

    if (!userQuit) {
      dashboard.update(state);
    }
  }, 1000);

  // Run the feature
  state.status = "running";
  dashboard.update(state);

  try {
    const { Orchestrator } = await import("../orchestrator/index.ts");
    const { GraphStore } = await import("../graph/store.ts");
    const { OpencodeBackend } = await import("../adapter/opencode.ts");

    const graph = new GraphStore(dbPath);
    const backend = new OpencodeBackend(effectiveUrl);
    const orchestrator = new Orchestrator(graph, backend, memory);

    const result = await orchestrator.runFeature({
      id: state.featureId,
      title: opts.feature,
      description: opts.feature,
    });

    state.status = result.outcome === "done" ? "done" : "failed";
    state.tasks = result.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      outcome: t.status === "passed" ? "passed" : t.status === "failed" ? "failed" : undefined,
    }));
    dashboard.update(state);
  } catch {
    state.status = "failed";
    dashboard.update(state);
  }

  clearInterval(pollTimer);

  // Wait for user to press 'q'
  while (!userQuit) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
