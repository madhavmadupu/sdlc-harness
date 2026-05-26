import {
  tuiInit,
  tuiCleanup,
  tuiClear,
  tuiWrite,
  tuiColorRow,
  tuiMoveTo,
} from "../cli/utils.ts";

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

const R = {
  header: 1,
  server: 3,
  feature: 5,
  divider1: 6,
  progress: 8,
  tasksStart: 10,
  memoryHeader: 0, // computed
  memoryStart: 0, // computed
  bindings: 0, // computed at bottom
};

export function renderDashboard(state: DashboardState): void {
  const cols = process.stdout.columns ?? 100;
  const rows = process.stdout.rows ?? 40;

  R.memoryHeader = R.tasksStart + Math.min(state.tasks.length, 10) + 2;
  R.memoryStart = R.memoryHeader + 1;
  R.bindings = Math.min(rows - 2, R.memoryStart + Object.keys(state.memoryStats.byCategory).length + 2);

  tuiWrite(1, 0, `\x1b[1m\x1b[36m SDLC Harness Dashboard\x1b[0m  ${"\x1b[2m"}v1.4.0${"\x1b[0m"}`);
  tuiWrite(2, 0, `${"\x1b[2m"}${"─".repeat(cols)}${"\x1b[0m"}`);

  tuiColorRow(3, 2, "Server:", state.serverHealthy ? `OK (${state.serverUrl})` : "Disconnected", state.serverHealthy ? undefined : undefined);
  tuiWrite(4, 2, `${"\x1b[2m"}Elapsed: ${formatElapsed(state.elapsed)}${"\x1b[0m"}`);

  tuiWrite(5, 2, `\x1b[1mFeature:\x1b[0m ${state.feature}`);
  const statusColor = state.status === "done" ? "\x1b[32m" : state.status === "failed" ? "\x1b[31m" : "\x1b[33m";
  tuiWrite(6, 2, `\x1b[2mStatus:\x1b[0m ${statusColor}${state.status}\x1b[0m`);

  tuiWrite(R.divider1, 0, `${"\x1b[2m"}${"─".repeat(cols)}${"\x1b[0m"}`);

  const completed = state.tasks.filter((t) => t.outcome === "passed" || t.outcome === "failed").length;
  const total = state.tasks.length || 1;
  const pct = Math.round((completed / total) * 100);
  const barW = Math.min(cols - 20, 40);
  const filled = Math.round((pct / 100) * barW);
  const bar = `${"\x1b[36m"}${"█".repeat(filled)}${"\x1b[2m"}${"░".repeat(barW - filled)}${"\x1b[0m"}`;
  tuiWrite(8, 2, `\x1b[1mProgress:\x1b[0m ${bar} \x1b[1m${pct}%\x1b[0m`);

  tuiWrite(9, 2, `${"\x1b[1m"}Tasks:${"\x1b[0m"} ${completed}/${state.tasks.length}`);

  const maxTasks = Math.min(state.tasks.length, 10);
  for (let i = 0; i < maxTasks; i++) {
    const t = state.tasks[i];
    const row = R.tasksStart + i;
    const icon = t.outcome === "passed" ? "\x1b[32m✔\x1b[0m" : t.outcome === "failed" ? "\x1b[31m✗\x1b[0m" : t.status === "running" ? "\x1b[33m●\x1b[0m" : "\x1b[2m○\x1b[0m";
    const title = t.title.length > cols - 10 ? t.title.slice(0, cols - 13) + "..." : t.title;
    tuiWrite(row, 4, `${icon} ${"\x1b[2m"}${t.id}${"\x1b[0m"} ${title}`);
  }

  const cats = Object.keys(state.memoryStats.byCategory);
  tuiWrite(R.memoryHeader, 2, `\x1b[1mMemory:\x1b[0m ${"\x1b[2m"}${state.memoryStats.total} total entries${"\x1b[0m"}`);
  for (let i = 0; i < cats.length; i++) {
    tuiWrite(R.memoryStart + i, 4, `${"\x1b[2m"}${cats[i]}: ${state.memoryStats.byCategory[cats[i]]}${"\x1b[0m"}`);
  }

  tuiWrite(R.bindings, 0, `${"\x1b[2m"}${"─".repeat(cols)}${"\x1b[0m"}`);
  tuiWrite(R.bindings + 1, 2, `${"\x1b[2m"}q: quit  r: refresh${"\x1b[0m"}`);

  tuiMoveTo(rows, 0);
}

export function startDashboard(
  renderFn: () => void,
  onKey: (key: string) => void,
  intervalMs = 500,
): { stop: () => void } {
  tuiInit();
  tuiClear();

  const timer = setInterval(renderFn, intervalMs);

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  const handler = (data: Buffer) => {
    const key = data.toString();
    if (key === "\x1b") {
      // escape sequence, read next chars
      return;
    }
    onKey(key);
  };
  stdin.on("data", handler);

  return {
    stop: () => {
      clearInterval(timer);
      stdin.removeListener("data", handler);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      tuiCleanup();
    },
  };
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
