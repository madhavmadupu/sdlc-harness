import {
  Screen,
  Box,
  Text,
  ProgressBar,
  Log,
  Line,
} from "@unblessed/node";

export interface DashboardState {
  feature: string;
  featureId: string;
  status: "starting" | "running" | "done" | "failed";
  tasks: { id: string; title: string; status: string; outcome?: string }[];
  memoryStats: { total: number; byCategory: Record<string, number> };
  serverUrl: string;
  serverHealthy: boolean;
  elapsed: number;
}

export interface DashboardHandle {
  update: (state: DashboardState) => void;
  stop: () => void;
}

export function createDashboard(onQuit?: () => void): DashboardHandle {
  const screen = new Screen({
    smartCSR: true,
    fullUnicode: true,
    title: "SDLC Harness Dashboard",
    dockBorders: true,
  });

  // ── Header ──────────────────────────────────────────────
  const headerBox = new Box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 3,
    style: { fg: "cyan", bold: true },
    content: " SDLC Harness Dashboard  v1.4.0",
  });

  new Line({
    parent: screen,
    top: 3,
    left: 0,
    width: "100%",
    type: "line",
    style: { fg: "bright-black" },
  });

  // ── Server & Status ─────────────────────────────────────
  const serverBox = new Box({
    parent: screen,
    top: 5,
    left: 2,
    width: "100%-4",
    height: 3,
    tags: true,
  });

  // ── Progress ─────────────────────────────────────────────
  const progressBar = new ProgressBar({
    parent: screen,
    top: 9,
    left: 2,
    width: "100%-4",
    height: 1,
    pch: " ",
    filled: 0,
    style: {
      bar: { bg: "cyan" },
      border: { fg: "bright-black" },
    },
    border: { type: "line" },
  });

  const progressLabel = new Text({
    parent: screen,
    top: 8,
    left: 2,
    width: "100%-4",
    height: 1,
    content: " Progress: 0%",
    style: { bold: true },
  });

  // ── Tasks ────────────────────────────────────────────────
  new Text({
    parent: screen,
    top: 11,
    left: 2,
    width: "100%-4",
    height: 1,
    content: " Tasks:",
    style: { bold: true },
  });

  const taskLog = new Log({
    parent: screen,
    top: 12,
    left: 2,
    width: "100%-4",
    height: 8,
    scrollback: 100,
    scrollOnInput: true,
    tags: true,
    border: { type: "line" },
    style: {
      fg: "white",
      border: { fg: "bright-black" },
    },
  });

  // ── Memory Stats ─────────────────────────────────────────
  const memoryBox = new Box({
    parent: screen,
    top: 21,
    left: 2,
    width: "100%-4",
    height: 6,
    tags: true,
    style: { fg: "bright-white" },
    content: " Memory: waiting...",
  });

  // ── Bottom divider + keybindings ────────────────────────
  new Line({
    parent: screen,
    bottom: 2,
    left: 0,
    width: "100%",
    type: "line",
    style: { fg: "bright-black" },
  });

  new Text({
    parent: screen,
    bottom: 0,
    left: 2,
    width: "100%-4",
    height: 1,
    content: " q: quit",
    style: { fg: "bright-black" },
  });

  // ── Key handlers ─────────────────────────────────────────
  let stopped = false;

  screen.key(["q", "escape", "C-c"], () => {
    stop();
  });

  function stop() {
    if (stopped) return;
    stopped = true;
    screen.destroy();
    onQuit?.();
  }

  screen.render();

  // ── Update function ──────────────────────────────────────
  function update(state: DashboardState): void {
    if (stopped) return;

    // Server line
    const serverColor = state.serverHealthy ? "{green-fg}" : "{red-fg}";
    const serverStatus = state.serverHealthy ? `OK (${state.serverUrl})` : "Disconnected";
    serverBox.setContent(
      ` Server: ${serverColor}${serverStatus}{/green-fg}{/red-fg}\n` +
      ` {bold}Feature:{/bold} ${state.feature}\n` +
      ` Status: ${statusColor(state.status)}${state.status}{/}\n` +
      ` Elapsed: ${formatElapsed(state.elapsed)}`,
    );

    // Progress
    const completed = state.tasks.filter(
      (t) => t.outcome === "passed" || t.outcome === "failed",
    ).length;
    const total = state.tasks.length || 1;
    const pct = Math.round((completed / total) * 100);
    progressBar.setProgress(pct);
    progressLabel.setContent(` Progress: {bold}${pct}%{/bold}  (${completed}/${state.tasks.length} tasks)`);

    // Tasks
    taskLog.setContent(
      state.tasks
        .map((t) => {
          const icon = t.outcome === "passed" ? "{green-fg}✔{/green-fg}" :
                       t.outcome === "failed" ? "{red-fg}✗{/red-fg}" :
                       t.status === "running" ? "{yellow-fg}●{/yellow-fg}" :
                       "{bright-black-fg}○{/bright-black-fg}";
          return ` ${icon} {bright-black-fg}${t.id}{/bright-black-fg} ${t.title}`;
        })
        .join("\n"),
    );

    // Memory stats
    const cats = Object.entries(state.memoryStats.byCategory)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    memoryBox.setContent(
      ` Memory: {bold}${state.memoryStats.total}{/bold} total entries\n` +
      ` ${cats || "{bright-black-fg}(empty){/bright-black-fg}"}`,
    );

    screen.render();
  }

  screen.on("resize", () => {
    screen.render();
  });

  return { update, stop };
}

function statusColor(status: string): string {
  switch (status) {
    case "done": return "{green-fg}";
    case "failed": return "{red-fg}";
    case "running": return "{yellow-fg}";
    default: return "{bright-black-fg}";
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
