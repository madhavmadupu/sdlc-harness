import {
  Screen,
  Box,
  Text,
  ProgressBar,
  List,
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

const palette = {
  bg: "black",
  fg: "white",
  accent: "cyan",
  accentBg: "blue",
  success: "green",
  warn: "yellow",
  error: "red",
  dim: "bright-black",
  border: "bright-blue",
  panelBg: "#1a1a2e",
  panelBorder: "#16213e",
};

export function createDashboard(onQuit?: () => void): DashboardHandle {
  const screen = new Screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    title: "SDLC Harness Dashboard",
    terminal: "xterm-256color",
  });

  // ── Top bar ───────────────────────────────────────────────
  const topBar = new Box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    style: { fg: "white", bg: palette.accentBg },
    content: "  ◉ SDLC HARNESS DASHBOARD",
  });

  const versionText = new Text({
    parent: screen,
    top: 0,
    right: 2,
    width: 12,
    height: 1,
    align: "right",
    style: { fg: "white", bg: palette.accentBg },
    content: "v1.5.0",
  });

  const statusBadge = new Text({
    parent: screen,
    top: 0,
    right: 16,
    width: 14,
    height: 1,
    align: "center",
    style: { fg: "yellow", bg: palette.accentBg, bold: true },
    content: "[STARTING]",
  });

  // ── Info panel (left side stats) ──────────────────────────
  const infoPanel = new Box({
    parent: screen,
    top: 1,
    left: 0,
    width: "40%",
    height: 7,
    style: { fg: "white", bg: palette.bg },
    tags: true,
  });

  // ── Progress panel (right side) ───────────────────────────
  const progressPanel = new Box({
    parent: screen,
    top: 1,
    left: "40%+1",
    width: "60%-1",
    height: 7,
    style: { fg: "white", bg: palette.bg },
    tags: true,
  });

  // ── Divider line ──────────────────────────────────────────
  new Line({
    parent: screen,
    top: 8,
    left: 0,
    width: "100%",
    type: "line",
    style: { fg: palette.border },
  });

  // ── Tasks section ─────────────────────────────────────────
  const taskHeader = new Text({
    parent: screen,
    top: 9,
    left: 1,
    height: 1,
    width: "100%-2",
    content: " TASKS",
    style: { bold: true, fg: "cyan" },
  });

  const taskList = new List({
    parent: screen,
    top: 10,
    left: 1,
    width: "100%-2",
    height: "100%-14",
    scrollbar: { style: { bg: palette.accent } },
    style: {
      fg: "white",
      bg: palette.bg,
      selected: { fg: "white", bg: palette.accentBg },
      scrollbar: { bg: palette.accent },
    },
    tags: true,
    mouse: true,
    keys: true,
    vi: true,
    items: [],
  });

  // ── Bottom bar ────────────────────────────────────────────
  const bottomBar = new Box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: "100%",
    height: 1,
    style: { fg: palette.dim, bg: palette.bg },
  });

  function renderKeys(keys: string) {
    bottomBar.setContent(`  ${keys}`);
  }
  renderKeys("q:quit  ↑↓:scroll  ESC:exit");

  // ── Key handlers ──────────────────────────────────────────
  let stopped = false;

  screen.key(["q", "escape", "C-c"], () => stop());
  screen.key(["up", "k"], () => taskList.up());
  screen.key(["down", "j"], () => taskList.down());

  function stop() {
    if (stopped) return;
    stopped = true;
    screen.destroy();
    onQuit?.();
  }

  screen.render();

  // ── Update function ───────────────────────────────────────
  function update(state: DashboardState): void {
    if (stopped) return;

    // Status badge
    const badgeColors: Record<string, string> = {
      starting: "{yellow-fg}[STARTING]{/yellow-fg}",
      running: "{yellow-fg}[RUNNING]{/yellow-fg}",
      done: "{green-fg}[DONE]{/green-fg}",
      failed: "{red-fg}[FAILED]{/red-fg}",
    };
    statusBadge.setContent(badgeColors[state.status] ?? state.status);

    // Info panel
    const serverIcon = state.serverHealthy ? "{green-fg}●{/green-fg}" : "{red-fg}●{/red-fg}";
    const statusIcon = state.status === "done" ? "{green-fg}✔{/green-fg}" :
      state.status === "failed" ? "{red-fg}✗{/red-fg}" :
      state.status === "running" ? "{yellow-fg}●{/yellow-fg}" : "{bright-black-fg}○{/bright-black-fg}";

    infoPanel.setContent(
      `  {bold}Server:{/bold}        ${serverIcon} ${state.serverHealthy ? "{green-fg}Connected{/green-fg}" : "{red-fg}Disconnected{/red-fg}"}\n` +
      `  {bold}Feature:{/bold}       ${state.feature}\n` +
      `  {bold}Elapsed:{/bold}       {yellow-fg}${formatElapsed(state.elapsed)}{/yellow-fg}\n` +
      `  {bold}Status:{/bold}        ${statusIcon} ${state.status.toUpperCase()}\n` +
      `  {bold}Server URL:{/bold}    {bright-black-fg}${state.serverUrl}{/bright-black-fg}`,
    );

    // Progress panel
    const completed = state.tasks.filter(
      (t) => t.outcome === "passed" || t.outcome === "failed",
    ).length;
    const total = state.tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const barLen = Math.min((screen.cols || 100) - 50, 30);
    const filled = Math.round((pct / 100) * barLen);
    const bar = "{cyan-fg}" + "█".repeat(filled) + "{/cyan-fg}" +
      "{bright-black-fg}" + "░".repeat(Math.max(0, barLen - filled)) + "{/bright-black-fg}";

    const cats = Object.entries(state.memoryStats.byCategory)
      .map(([k, v]) => `{bright-black-fg}${k}:{/bright-black-fg} {white-fg}${v}{/white-fg}`)
      .join("  ");

    progressPanel.setContent(
      `  {bold}Progress{/bold}\n` +
      `  ${bar}  {bold}${pct}%{/bold}  ({cyan-fg}${completed}{/cyan-fg}/{cyan-fg}${total}{/cyan-fg} tasks)\n` +
      `\n` +
      `  {bold}Memory:{/bold} {yellow-fg}${state.memoryStats.total}{/yellow-fg} entries\n` +
      `  ${cats}`,
    );

    // Task list
    const taskLines = state.tasks.map((t) => {
      const icon = t.outcome === "passed" ? "{green-fg}✔{/green-fg}" :
        t.outcome === "failed" ? "{red-fg}✗{/red-fg}" :
        t.status === "running" ? "{yellow-fg}●{/yellow-fg}" :
        "{bright-black-fg}○{/bright-black-fg}";
      return `${icon} {bright-black-fg}${t.id}{/bright-black-fg} ${t.title}`;
    });
    taskList.setItems(taskLines);
    if (taskLines.length > 0) {
      const idx = state.tasks.findIndex((t) => t.status === "running");
      if (idx >= 0) taskList.select(idx);
    }

    screen.render();
  }

  screen.on("resize", () => screen.render());

  return { update, stop };
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
