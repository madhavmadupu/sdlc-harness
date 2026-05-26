import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { ServerManager } from "../server-manager.ts";
import { MemoryStore } from "../memory/store.ts";
import { GraphStore } from "../graph/store.ts";
import { OpencodeBackend } from "../adapter/opencode.ts";
import { Orchestrator } from "../orchestrator/index.ts";
import { loadConfig, saveConfig } from "./config.ts";

const _dirname = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

export interface WebOptions {
  port: number;
  dev?: boolean;
  db?: string;
  server?: string;
  open?: boolean;
}

interface WebTaskState {
  id: string;
  title: string;
  status: string;
  outcome?: string;
}

interface WebRunState {
  id: string;
  feature: string;
  featureId: string;
  status: "starting" | "running" | "done" | "failed";
  tasks: WebTaskState[];
  elapsed: number;
  createdAt: number;
}

const activeRuns = new Map<string, WebRunState>();
const sseEmitter = new EventEmitter();
sseEmitter.setMaxListeners(100);

export async function startWebServer(opts: WebOptions): Promise<void> {
  const serverUrl = opts.server ?? process.env.OPENCODE_SERVER;
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";

  let effectiveUrl = serverUrl;
  if (!effectiveUrl) {
    const manager = new ServerManager();
    manager.setupCleanup();
    const handle = await manager.start();
    effectiveUrl = handle.url;
  }

  const memory = new MemoryStore(dbPath);
  const graph = new GraphStore(dbPath);
  const backend = new OpencodeBackend(effectiveUrl);

  const app = new Hono();

  if (opts.dev) {
    app.use(
      "/api/*",
      cors({
        origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
        credentials: true,
      }),
    );
  }

  // ── Health ──────────────────────────────────────────────

  app.get("/api/health", (c) => {
    const stats = memory.getStats();
    const running = [...activeRuns.values()].find((r) => r.status === "running");
    return c.json({
      serverHealthy: true,
      serverUrl: effectiveUrl,
      feature: running?.feature ?? "",
      featureId: running?.featureId ?? "",
      status: running?.status ?? "idle",
      elapsed: running?.elapsed ?? 0,
      memoryStats: {
        total: stats.totalEntries,
        byCategory: stats.byCategory,
      },
    });
  });

  // ── Memory ──────────────────────────────────────────────

  app.get("/api/memory", (c) => {
    const category = c.req.query("category") || undefined;
    const entries = memory.list(category as never);
    const stats = memory.getStats();
    return c.json({
      total: stats.totalEntries,
      byCategory: stats.byCategory,
      entries,
    });
  });

  // ── Tasks ───────────────────────────────────────────────

  app.get("/api/tasks", (c) => {
    const all: WebTaskState[] = [];
    for (const run of activeRuns.values()) {
      all.push(...run.tasks);
    }
    return c.json(all);
  });

  // ── Start run ──────────────────────────────────────────

  app.post("/api/runs", async (c) => {
    const body = await c.req.json();
    const feature = body.feature as string;
    const description = (body.description as string) || feature;
    const id = (body.id as string) || `feat_${Date.now()}`;
    const runId = randomUUID();

    const runState: WebRunState = {
      id: runId,
      feature,
      featureId: id,
      status: "starting",
      tasks: [],
      elapsed: 0,
      createdAt: Date.now(),
    };

    activeRuns.set(runId, runState);

    const startTime = Date.now();
    const orchestrator = new Orchestrator(
      graph,
      backend,
      memory,
      undefined,
      (event) => {
        if (event.type === "task-started") {
          runState.tasks.push({
            id: event.taskId,
            title: event.title,
            status: "running",
          });
          runState.status = "running";
          sseEmitter.emit(`run:${runId}`, {
            type: "task-update",
            taskId: event.taskId,
            task: runState.tasks[runState.tasks.length - 1],
          });
        } else if (event.type === "task-completed") {
          const task = runState.tasks.find((t) => t.id === event.taskId);
          if (task) {
            task.status = event.outcome;
            task.outcome = event.outcome;
          }
          sseEmitter.emit(`run:${runId}`, {
            type: "task-update",
            taskId: event.taskId,
            task,
          });
        } else if (event.type === "feature-complete") {
          runState.status = event.outcome === "done" ? "done" : "failed";
          runState.elapsed = Date.now() - startTime;
          sseEmitter.emit(`run:${runId}`, {
            type: "run-complete",
            run: { ...runState },
          });
        } else if (event.type === "error") {
          runState.status = "failed";
          sseEmitter.emit(`run:${runId}`, {
            type: "run-error",
            message: event.message,
          });
        }
      },
    );

    orchestrator.runFeature({ id, title: feature, description }).catch((err: Error) => {
      runState.status = "failed";
      sseEmitter.emit(`run:${runId}`, {
        type: "run-error",
        message: err.message,
      });
    });

    return c.json({ id: runId });
  });

  // ── Get run ────────────────────────────────────────────

  app.get("/api/runs/:id", (c) => {
    const run = activeRuns.get(c.req.param("id"));
    if (!run) return c.json({ error: "Run not found" }, 404);
    return c.json(run);
  });

  // ── SSE events ─────────────────────────────────────────

  app.get("/api/runs/:id/events", (c) => {
    const runId = c.req.param("id");
    if (!activeRuns.has(runId)) return c.json({ error: "Run not found" }, 404);

    const body = new ReadableStream({
      start(controller) {
        const send = (data: string) => {
          try {
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          } catch {
            /* stream closed */
          }
        };

        const handler = (event: unknown) => {
          send(JSON.stringify(event));
        };

        sseEmitter.on(`run:${runId}`, handler);

        send(JSON.stringify({ type: "connected" }));

        const keepAlive = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
          } catch {
            clearInterval(keepAlive);
          }
        }, 15000);

        c.req.raw.signal.addEventListener("abort", () => {
          sseEmitter.off(`run:${runId}`, handler);
          clearInterval(keepAlive);
        });
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });

  // ── Config ─────────────────────────────────────────────

  app.get("/api/config", (c) => c.json(loadConfig()));

  app.put("/api/config", async (c) => {
    const body = await c.req.json();
    saveConfig(body);
    return c.json(loadConfig());
  });

  // ── Static files (production) ──────────────────────────

  if (!opts.dev) {
    const webRoot = resolve(_dirname, "..", "webui", "dist");

    if (!existsSync(webRoot)) {
      console.error(`  ${"\u2718"} Web UI assets not found at ${webRoot}`);
      console.error(`  Run "npm run build" or "cd webui && npm run build" first.`);
      process.exit(1);
    }

    app.get("/*", (c) => {
      const reqPath = c.req.path;
      if (reqPath.startsWith("/api/")) return c.notFound();

      const filePath =
        reqPath === "/" || !reqPath
          ? resolve(webRoot, "index.html")
          : resolve(webRoot, reqPath.replace(/^\//, ""));

      try {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        return c.body(content, 200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        });
      } catch {
        const index = readFileSync(resolve(webRoot, "index.html"));
        return c.body(index, 200, { "Content-Type": "text/html" });
      }
    });
  }

  // ── Start ──────────────────────────────────────────────

  serve(
    { fetch: app.fetch, port: opts.port },
    (info: { port: number }) => {
      const url = `http://localhost:${info.port}`;
      console.log(`\n  SDLC Harness Web UI running at ${url}`);

      if (opts.open) {
        const cmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        try {
          execSync(`${cmd} ${url}`);
        } catch {
          /* not critical */
        }
      }

      console.log(`  Press Ctrl+C to stop\n`);
    },
  );
}
