import { type HarnessEvent, type TaskId } from "../types/events.ts";

// ── Opencode server → Harness adapter ─────────────────────
//
// Translates between opencode's HTTP + SSE API and the
// harness's normalized event model.
//
// Each agent maps to one opencode session. SSE events from
// all sessions arrive on the global /event stream and are
// filtered by session ID.

export class OpencodeBackend {
  private baseUrl: string;
  private sessions = new Map<string, string>(); // agentId → sessionId
  private abortControllers = new Map<string, AbortController>();

  constructor(baseUrl = "http://127.0.0.1:4096") {
    this.baseUrl = baseUrl;
  }

  get id(): string {
    return "opencode";
  }

  // ── Session management ─────────────────────────────────

  async ensureSession(
    agentId: string,
    opts?: { title?: string },
  ): Promise<string> {
    const existing = this.sessions.get(agentId);
    if (existing) return existing;

    const body: Record<string, string> = {};
    if (opts?.title) body.title = opts.title;

    const res = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to create session: ${res.status} ${await res.text()}`,
      );
    }
    const session = (await res.json()) as { id: string };
    this.sessions.set(agentId, session.id);
    return session.id;
  }

  getSessionId(agentId: string): string | undefined {
    return this.sessions.get(agentId);
  }

  // ── Task execution ─────────────────────────────────────

  async *runTask(
    agentId: string,
    taskId: TaskId,
    prompt: string,
    opts?: {
      model?: { providerID: string; modelID: string; variant?: string };
      system?: string;
      noReply?: boolean;
    },
  ): AsyncGenerator<HarnessEvent> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) throw new Error(`No session for agent "${agentId}"`);

    const abort = new AbortController();
    this.abortControllers.set(sessionId, abort);

    // 1. Fire the async prompt
    const body: Record<string, unknown> = {
      parts: [{ type: "text", text: prompt }],
    };
    if (opts?.model) body.model = opts.model;
    if (opts?.system) body.system = opts.system;
    if (opts?.noReply) body.noReply = true;

    const res = await fetch(
      `${this.baseUrl}/session/${sessionId}/prompt_async`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      },
    );
    if (!res.ok) {
      throw new Error(
        `Failed to send prompt_async: ${res.status} ${await res.text()}`,
      );
    }

    yield {
      type: "task_started",
      taskId,
      agentId,
      backend: "opencode",
      timestamp: Date.now(),
    };

    // 2. Connect to the global SSE stream, filter for this session
    const sseAbort = new AbortController();
    abort.signal.addEventListener("abort", () => sseAbort.abort());

    let thinkingBuffer = "";
    let lastThinkingYield = 0;
    let completed = false;

    try {
      const sseRes = await fetch(`${this.baseUrl}/event`, {
        signal: sseAbort.signal,
      });
      if (!sseRes.ok || !sseRes.body) {
        throw new Error(`SSE connection failed: ${sseRes.status}`);
      }

      const reader = sseRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!completed) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(line.slice(6)) as Record<string, unknown>;
          } catch {
            continue;
          }

          const props = parsed.properties as Record<string, unknown> | undefined;
          if (!props) continue;
          const evtSessionId = props.sessionID as string | undefined;
          if (evtSessionId && evtSessionId !== sessionId) continue;

          const evtType = parsed.type as string;

          switch (evtType) {
            case "message.part.delta": {
              const delta = props.delta as string | undefined;
              const field = props.field as string | undefined;
              if (field === "text" && delta) {
                thinkingBuffer += delta;
                const now = Date.now();
                if (now - lastThinkingYield > 100 && thinkingBuffer.length > 0) {
                  yield {
                    type: "thinking",
                    taskId,
                    text: thinkingBuffer,
                    timestamp: now,
                  };
                  thinkingBuffer = "";
                  lastThinkingYield = now;
                }
              }
              break;
            }

            case "message.part.updated": {
              const part = props.part as Record<string, unknown> | undefined;
              if (!part) break;
              if (part.type === "tool" && part.name) {
                yield {
                  type: "tool_call_requested",
                  taskId,
                  name: part.name as string,
                  args: part.arguments
                    ? (JSON.parse(part.arguments as string) as Record<
                        string,
                        unknown
                      >)
                    : {},
                  timestamp: Date.now(),
                };
              }
              break;
            }

            case "session.diff": {
              const diffs = props.diff as
                | Array<{ path: string; diff: string }>
                | undefined;
              if (diffs && diffs.length > 0) {
                for (const f of diffs) {
                  yield {
                    type: "file_changed",
                    taskId,
                    path: f.path,
                    diff: f.diff,
                    timestamp: Date.now(),
                  };
                }
              }
              break;
            }

            case "session.idle": {
              completed = true;
              break;
            }
          }
        }
      }

      reader.releaseLock();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        yield {
          type: "task_failed",
          taskId,
          error: "Task aborted",
          recoverable: true,
          timestamp: Date.now(),
        };
        return;
      }
      // Connection might end naturally after task completes
      if (!completed) {
        yield {
          type: "task_failed",
          taskId,
          error: err instanceof Error ? err.message : String(err),
          recoverable: true,
          timestamp: Date.now(),
        };
        return;
      }
    }

    // Flush remaining thinking
    if (thinkingBuffer.length > 0) {
      yield {
        type: "thinking",
        taskId,
        text: thinkingBuffer,
        timestamp: Date.now(),
      };
    }

    // 3. Collect authoritative diff
    const fileDiffs = await this.getDiff(agentId);
    const diffText = fileDiffs
      .map((f) => `--- ${f.path}\n${f.diff}`)
      .join("\n");

    yield {
      type: "task_completed",
      taskId,
      summary: "",
      artifacts: fileDiffs.map((f) => f.path),
      diff: diffText,
      timestamp: Date.now(),
    };
  }

  // ── Permission responses ───────────────────────────────

  async respondToPermission(
    agentId: string,
    permissionId: string,
    response: "allow" | "deny",
    remember = false,
  ): Promise<void> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) throw new Error(`No session for agent "${agentId}"`);

    await fetch(
      `${this.baseUrl}/session/${sessionId}/permissions/${permissionId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, remember }),
      },
    ).catch(() => {});
  }

  // ── Diff collection ──────────────────────────────────

  async getDiff(
    agentId: string,
  ): Promise<{ path: string; diff: string }[]> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) return [];
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/diff`);
    if (!res.ok) return [];
    return (await res.json()) as { path: string; diff: string }[];
  }

  // ── All session statuses ───────────────────────────────

  async getAllSessionStatuses(): Promise<
    Record<string, { status: string; title?: string }>
  > {
    const res = await fetch(`${this.baseUrl}/session/status`);
    if (!res.ok) return {};
    return (await res.json()) as Record<
      string,
      { status: string; title?: string }
    >;
  }

  // ── Todo ──────────────────────────────────────────────

  async getTodo(
    agentId: string,
  ): Promise<{ title: string; completed: boolean }[]> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) return [];
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/todo`);
    if (!res.ok) return [];
    return (await res.json()) as { title: string; completed: boolean }[];
  }

  // ── Abort ─────────────────────────────────────────────

  async abortTask(agentId: string): Promise<void> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) return;
    this.abortControllers.get(sessionId)?.abort();
    await fetch(`${this.baseUrl}/session/${sessionId}/abort`, {
      method: "POST",
    }).catch(() => {});
  }

  // ── Fork ──────────────────────────────────────────────

  async forkSession(agentId: string, messageId?: string): Promise<string> {
    const sessionId = this.sessions.get(agentId);
    if (!sessionId) throw new Error(`No session for agent "${agentId}"`);
    const body: Record<string, string> = {};
    if (messageId) body.messageID = messageId;
    const res = await fetch(`${this.baseUrl}/session/${sessionId}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to fork session: ${res.status} ${await res.text()}`,
      );
    }
    const forked = (await res.json()) as { id: string };
    this.sessions.set(agentId, forked.id);
    return forked.id;
  }

  // ── Health ────────────────────────────────────────────

  async health(): Promise<{ healthy: boolean; version?: string }> {
    const res = await fetch(`${this.baseUrl}/global/health`).catch(() => null);
    if (!res) return { healthy: false };
    return (await res.json()) as { healthy: boolean; version?: string };
  }
}
