import Database from "better-sqlite3";
import {
  type MemoryEntry,
  type MemorySearchParams,
  type MemoryCategory,
  type MemoryStats,
  generateMemoryId,
} from "./types.ts";

// ── Process Memory Store ────────────────────────────────────
//
// SQLite-backed store that remembers what worked.
// Each entry is a reusable pattern — workflow, task solution,
// knowledge snippet, or prompt template.

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? ":memory:");
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_memory (
        id            TEXT PRIMARY KEY,
        category      TEXT NOT NULL,
        phase         TEXT,
        role          TEXT,
        keywords      TEXT NOT NULL DEFAULT '[]',
        title         TEXT NOT NULL,
        summary       TEXT NOT NULL DEFAULT '',
        body          TEXT NOT NULL DEFAULT '',
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_used     INTEGER NOT NULL DEFAULT 0,
        source_task_id   TEXT,
        source_feature_id TEXT,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_memory_category
        ON process_memory(category);
      CREATE INDEX IF NOT EXISTS idx_memory_phase
        ON process_memory(phase);
      CREATE INDEX IF NOT EXISTS idx_memory_role
        ON process_memory(role);
      CREATE INDEX IF NOT EXISTS idx_memory_last_used
        ON process_memory(last_used DESC);
    `);
  }

  // ── CRUD ─────────────────────────────────────────────────

  insert(entry: Omit<MemoryEntry, "id" | "successCount" | "failureCount" | "lastUsed" | "createdAt" | "updatedAt">): MemoryEntry {
    const id = generateMemoryId();
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO process_memory (id, category, phase, role, keywords, title, summary, body, success_count, failure_count, last_used, source_task_id, source_feature_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      entry.category,
      entry.phase ?? null,
      entry.role ?? null,
      JSON.stringify(entry.keywords),
      entry.title,
      entry.summary,
      entry.body,
      now,
      entry.sourceTaskId ?? null,
      entry.sourceFeatureId ?? null,
      now,
      now,
    );
    return this.get(id)!;
  }

  get(id: string): MemoryEntry | null {
    const row = this.db
      .prepare("SELECT * FROM process_memory WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  list(category?: MemoryCategory, limit = 50): MemoryEntry[] {
    let query = "SELECT * FROM process_memory";
    const params: unknown[] = [];
    if (category) {
      query += " WHERE category = ?";
      params.push(category);
    }
    query += " ORDER BY last_used DESC LIMIT ?";
    params.push(limit);
    return (this.db.prepare(query).all(...params) as Record<string, unknown>[]).map(this.rowToEntry);
  }

  search(params: MemorySearchParams): MemoryEntry[] {
    const conditions: string[] = [];
    const queryParams: unknown[] = [];
    const limit = params.limit ?? 10;

    if (params.phase) {
      conditions.push("phase = ?");
      queryParams.push(params.phase);
    }
    if (params.role) {
      conditions.push("role = ?");
      queryParams.push(params.role);
    }
    if (params.keywords && params.keywords.length > 0) {
      // Match entries whose keywords overlap with search keywords
      const likes = params.keywords.map(() => "keywords LIKE ?");
      conditions.push(`(${likes.join(" OR ")})`);
      for (const kw of params.keywords) {
        queryParams.push(`%${kw}%`);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM process_memory ${where} ORDER BY success_count DESC, last_used DESC LIMIT ?`)
      .all(...queryParams, limit) as Record<string, unknown>[];
    return rows.map(this.rowToEntry);
  }

  // ── Usage tracking ─────────────────────────────────────

  recordSuccess(id: string): void {
    this.db
      .prepare(
        "UPDATE process_memory SET success_count = success_count + 1, last_used = ?, updated_at = ? WHERE id = ?",
      )
      .run(Date.now(), Date.now(), id);
  }

  recordFailure(id: string): void {
    this.db
      .prepare(
        "UPDATE process_memory SET failure_count = failure_count + 1, last_used = ?, updated_at = ? WHERE id = ?",
      )
      .run(Date.now(), Date.now(), id);
  }

  // ── Delete ─────────────────────────────────────────────

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM process_memory WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  clear(): void {
    this.db.exec("DELETE FROM process_memory");
  }

  // ── Stats ──────────────────────────────────────────────

  getStats(): MemoryStats {
    const total = this.db
      .prepare("SELECT COUNT(*) as count FROM process_memory")
      .get() as { count: number };

    const byCategoryRows = this.db
      .prepare("SELECT category, COUNT(*) as count FROM process_memory GROUP BY category")
      .all() as { category: string; count: number }[];

    const byCategory: Record<MemoryCategory, number> = {
      workflow: 0,
      task_pattern: 0,
      knowledge: 0,
      prompt: 0,
    };
    for (const row of byCategoryRows) {
      byCategory[row.category as MemoryCategory] = row.count;
    }

    return {
      totalEntries: total.count,
      byCategory,
      workflows: byCategory.workflow,
      taskPatterns: byCategory.task_pattern,
      knowledge: byCategory.knowledge,
    };
  }

  // ── Helpers ────────────────────────────────────────────

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: row.id as string,
      category: row.category as MemoryCategory,
      phase: row.phase as string | undefined,
      role: row.role as string | undefined,
      keywords: JSON.parse(row.keywords as string) as string[],
      title: row.title as string,
      summary: row.summary as string,
      body: row.body as string,
      successCount: row.success_count as number,
      failureCount: row.failure_count as number,
      lastUsed: row.last_used as number,
      sourceTaskId: row.source_task_id as string | undefined,
      sourceFeatureId: row.source_feature_id as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  close(): void {
    this.db.close();
  }
}
