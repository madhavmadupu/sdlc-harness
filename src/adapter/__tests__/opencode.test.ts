import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpencodeBackend } from "../opencode.ts";
import type { TaskId } from "../../types/events.ts";

const makeTaskId = (s: string): TaskId => ({
  featureId: s.split(":")[0] ?? s,
  taskIndex: 0,
  toString: () => s,
});

describe("OpencodeBackend", () => {
  let backend: OpencodeBackend;

  beforeEach(() => {
    backend = new OpencodeBackend("http://test:4096");
    vi.restoreAllMocks();
  });

  describe("session management", () => {
    it("creates a session via POST /session", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ses_123" }), { status: 200 }),
      );

      const id = await backend.ensureSession("coder-1", {
        title: "test session",
      });

      expect(id).toBe("ses_123");
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "http://test:4096/session",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("test session"),
        }),
      );
    });

    it("reuses an existing session", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "ses_123" }), { status: 200 }),
      );

      await backend.ensureSession("coder-1");
      await backend.ensureSession("coder-1");

      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
  });

  describe("health check", () => {
    it("returns healthy when server responds", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ healthy: true, version: "1.15.10" }), {
          status: 200,
        }),
      );

      const health = await backend.health();
      expect(health.healthy).toBe(true);
      expect(health.version).toBe("1.15.10");
    });

    it("returns unhealthy when server is unreachable", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const health = await backend.health();
      expect(health.healthy).toBe(false);
    });
  });

  describe("diff collection", () => {
    it("returns file diffs", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "ses_123" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { path: "src/auth.ts", diff: "+export function login()" },
            ]),
            { status: 200 },
          ),
        );

      await backend.ensureSession("coder-1");
      const diffs = await backend.getDiff("coder-1");
      expect(diffs).toHaveLength(1);
      expect(diffs[0].path).toBe("src/auth.ts");
    });
  });

  describe("fork", () => {
    it("forks a session and updates the binding", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "ses_123" }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "ses_123_forked" }), {
            status: 200,
          }),
        );

      await backend.ensureSession("coder-1");
      const forked = await backend.forkSession("coder-1", "msg_42");

      expect(forked).toBe("ses_123_forked");
      expect(backend.getSessionId("coder-1")).toBe("ses_123_forked");
    });
  });

  describe("abort", () => {
    it("calls POST /session/:id/abort", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "ses_123" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      await backend.ensureSession("coder-1");
      await backend.abortTask("coder-1");

      expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
        "http://test:4096/session/ses_123/abort",
      );
    });
  });
});
