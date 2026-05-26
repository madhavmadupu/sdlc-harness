import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "../store.ts";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore(":memory:");
  });

  describe("CRUD", () => {
    it("inserts and retrieves a memory entry", () => {
      const entry = store.insert({
        category: "task_pattern",
        phase: "implementation",
        role: "coder",
        keywords: ["authentication", "jwt"],
        title: "JWT authentication pattern",
        summary: "How to implement JWT-based auth",
        body: "Use jsonwebtoken library with RS256 signing",
      });

      const retrieved = store.get(entry.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("JWT authentication pattern");
      expect(retrieved!.keywords).toEqual(["authentication", "jwt"]);
      expect(retrieved!.successCount).toBe(0);
    });

    it("lists all entries ordered by last used", () => {
      store.insert({
        category: "workflow",
        keywords: ["auth"],
        title: "Auth workflow",
        summary: "",
        body: "",
      });
      store.insert({
        category: "knowledge",
        keywords: ["config"],
        title: "Project config",
        summary: "",
        body: "",
      });

      const all = store.list();
      expect(all).toHaveLength(2);
    });

    it("filters by category", () => {
      store.insert({ category: "workflow", keywords: ["a"], title: "W1", summary: "", body: "" });
      store.insert({ category: "workflow", keywords: ["b"], title: "W2", summary: "", body: "" });
      store.insert({ category: "knowledge", keywords: ["c"], title: "K1", summary: "", body: "" });

      const workflows = store.list("workflow");
      expect(workflows).toHaveLength(2);
    });
  });

  describe("search", () => {
    it("finds entries by keyword match", () => {
      store.insert({
        category: "task_pattern",
        phase: "implementation",
        keywords: ["database", "sqlite", "migration"],
        title: "SQLite migration pattern",
        summary: "",
        body: "Use better-sqlite3 with WAL mode",
      });
      store.insert({
        category: "task_pattern",
        phase: "implementation",
        keywords: ["api", "rest", "routing"],
        title: "REST API pattern",
        summary: "",
        body: "Use Express with route handlers",
      });

      const results = store.search({ keywords: ["database"] });
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain("SQLite");
    });

    it("filters by phase and role", () => {
      store.insert({
        category: "task_pattern",
        phase: "testing",
        role: "qa",
        keywords: ["test"],
        title: "Testing pattern",
        summary: "",
        body: "",
      });

      const results = store.search({ phase: "testing", role: "qa" });
      expect(results).toHaveLength(1);
    });
  });

  describe("usage tracking", () => {
    it("increments success count", () => {
      const entry = store.insert({
        category: "prompt",
        keywords: ["code-review"],
        title: "Code review prompt",
        summary: "",
        body: "Review the code for...",
      });

      store.recordSuccess(entry.id);
      const updated = store.get(entry.id);
      expect(updated!.successCount).toBe(1);
    });

    it("increments failure count", () => {
      const entry = store.insert({
        category: "prompt",
        keywords: ["refactor"],
        title: "Refactor prompt",
        summary: "",
        body: "",
      });

      store.recordFailure(entry.id);
      const updated = store.get(entry.id);
      expect(updated!.failureCount).toBe(1);
    });
  });

  describe("delete", () => {
    it("removes an entry", () => {
      const entry = store.insert({
        category: "knowledge",
        keywords: ["temp"],
        title: "Temp note",
        summary: "",
        body: "",
      });

      expect(store.delete(entry.id)).toBe(true);
      expect(store.get(entry.id)).toBeNull();
    });

    it("clears all entries", () => {
      store.insert({ category: "workflow", keywords: ["a"], title: "A", summary: "", body: "" });
      store.insert({ category: "workflow", keywords: ["b"], title: "B", summary: "", body: "" });
      store.clear();
      expect(store.list()).toHaveLength(0);
    });
  });

  describe("stats", () => {
    it("returns correct counts", () => {
      store.insert({ category: "workflow", keywords: ["a"], title: "W", summary: "", body: "" });
      store.insert({ category: "task_pattern", keywords: ["b"], title: "T", summary: "", body: "" });
      store.insert({ category: "task_pattern", keywords: ["c"], title: "T2", summary: "", body: "" });
      store.insert({ category: "knowledge", keywords: ["d"], title: "K", summary: "", body: "" });

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(4);
      expect(stats.workflows).toBe(1);
      expect(stats.taskPatterns).toBe(2);
      expect(stats.knowledge).toBe(1);
    });
  });
});
