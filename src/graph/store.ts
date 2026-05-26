import Database from "better-sqlite3";
import path from "node:path";
import {
  NodeType,
  EdgeType,
  type NodeData,
  type Edge,
  type ReasoningRecord,
  type TaskNode,
  type FeatureNode,
  type ModuleNode,
  type DecisionNode,
  type FileNode,
  type AgentNode,
  type ArtifactNode,
} from "./schema.ts";

// ── Graph store ────────────────────────────────────────────
//
// SQLite-backed property graph.
//   nodes:   polymorphic JSON payload keyed by (type, id)
//   edges:   directed, typed edges with composite indexes
//   reasoning: append-only docs keyed to nodes

export class GraphStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? ":memory:");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  // ── Schema ─────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        node_type TEXT NOT NULL,
        node_id   TEXT NOT NULL,
        data      TEXT NOT NULL,  -- JSON payload
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (node_type, node_id)
      );

      CREATE TABLE IF NOT EXISTS edges (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_id   TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id   TEXT NOT NULL,
        edge_type   TEXT NOT NULL,
        metadata    TEXT,  -- optional JSON
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(source_type, source_id, edge_type, target_type, target_id)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_source
        ON edges(source_type, source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target
        ON edges(target_type, target_id);
      CREATE INDEX IF NOT EXISTS idx_edges_type
        ON edges(edge_type);
      CREATE INDEX IF NOT EXISTS idx_edges_source_type
        ON edges(source_type, source_id, edge_type);

      CREATE TABLE IF NOT EXISTS reasoning (
        id          TEXT PRIMARY KEY,
        node_type   TEXT NOT NULL,
        node_id     TEXT NOT NULL,
        content     TEXT NOT NULL,
        source      TEXT NOT NULL,
        session_id  TEXT,
        embedding   BLOB,  -- float32 array
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_reasoning_node
        ON reasoning(node_type, node_id);

      CREATE TABLE IF NOT EXISTS agent_status (
        agent_id    TEXT PRIMARY KEY,
        role        TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'idle',
        phase       TEXT,
        current_task_id TEXT,
        progress    REAL,
        last_heartbeat INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `);
  }

  // ── Node CRUD ──────────────────────────────────────────

  upsertNode(data: NodeData): void {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (node_type, node_id, data, updated_at)
      VALUES (@type, @id, @data, unixepoch())
      ON CONFLICT(node_type, node_id) DO UPDATE SET
        data = excluded.data,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      type: data.type,
      id: ("id" in data ? data.id : (data as any).id) as string,
      data: JSON.stringify(data),
    });
  }

  getNode<T extends NodeData>(type: NodeType, id: string): T | null {
    const row = this.db
      .prepare("SELECT data FROM nodes WHERE node_type = ? AND node_id = ?")
      .get(type, id) as { data: string } | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  listNodes<T extends NodeData>(type: NodeType): T[] {
    const rows = this.db
      .prepare("SELECT data FROM nodes WHERE node_type = ?")
      .all(type) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  deleteNode(type: NodeType, id: string): void {
    this.db
      .prepare("DELETE FROM nodes WHERE node_type = ? AND node_id = ?")
      .run(type, id);
    this.db
      .prepare(
        "DELETE FROM edges WHERE (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)",
      )
      .run(type, id, type, id);
  }

  // ── Edge CRUD ──────────────────────────────────────────

  addEdge(edge: Omit<Edge, "createdAt">): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO edges (source_type, source_id, target_type, target_id, edge_type, metadata)
      VALUES (@sourceType, @sourceId, @targetType, @targetId, @edgeType, @metadata)
    `);
    stmt.run({
      sourceType: edge.sourceType,
      sourceId: edge.sourceId,
      targetType: edge.targetType,
      targetId: edge.targetId,
      edgeType: edge.edgeType,
      metadata: edge.metadata ? JSON.stringify(edge.metadata) : null,
    });
  }

  getOutgoingEdges(
    sourceType: NodeType,
    sourceId: string,
    edgeType?: EdgeType,
  ): Edge[] {
    let query = "SELECT * FROM edges WHERE source_type = ? AND source_id = ?";
    const params: unknown[] = [sourceType, sourceId];
    if (edgeType) {
      query += " AND edge_type = ?";
      params.push(edgeType);
    }
    return (this.db.prepare(query).all(...params) as any[]).map(this.toEdge);
  }

  getIncomingEdges(
    targetType: NodeType,
    targetId: string,
    edgeType?: EdgeType,
  ): Edge[] {
    let query = "SELECT * FROM edges WHERE target_type = ? AND target_id = ?";
    const params: unknown[] = [targetType, targetId];
    if (edgeType) {
      query += " AND edge_type = ?";
      params.push(edgeType);
    }
    return (this.db.prepare(query).all(...params) as any[]).map(this.toEdge);
  }

  // ── Graph traversal ────────────────────────────────────

  // What features depend (transitively) on a module?
  // Uses recursive CTE over edges.
  featuresAffectedByModule(moduleId: string): string[] {
    const rows = this.db
      .prepare(
        `
      WITH RECURSIVE affected(module_id) AS (
        -- start with the module itself
        SELECT ? AS module_id
        UNION
        -- modules that DIRECTLY depend on any module in the set
        SELECT e.source_id
        FROM edges e
        JOIN affected a ON e.target_id = a.module_id
        WHERE e.edge_type = 'module_depends_on'
          AND e.target_type = 'module'
          AND e.source_type = 'module'
      )
      -- features that use any module in the affected chain
      SELECT DISTINCT n.node_id
      FROM nodes n
      JOIN edges fe ON fe.source_type = 'feature'
                   AND fe.source_id = n.node_id
                   AND fe.edge_type = 'feature_uses_module'
      JOIN affected a ON fe.target_id = a.module_id
      WHERE n.node_type = 'feature'
      `,
      )
      .all(moduleId) as { node_id: string }[];
    return rows.map((r) => r.node_id);
  }

  // What tasks are associated with a feature (all phases)?
  tasksForFeature(featureId: string): TaskNode[] {
    const edges = this.getOutgoingEdges(
      NodeType.Feature,
      featureId,
      EdgeType.FeatureToTask,
    );
    return edges
      .map((e) => this.getNode<TaskNode>(NodeType.Task, e.targetId))
      .filter((n): n is TaskNode => n !== null);
  }

  // ── Reasoning ──────────────────────────────────────────

  addReasoning(record: Omit<ReasoningRecord, "id" | "createdAt">): void {
    const id = `${record.nodeType}:${record.nodeId}:${Date.now()}`;
    const stmt = this.db.prepare(`
      INSERT INTO reasoning (id, node_type, node_id, content, source, session_id, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.nodeType,
      record.nodeId,
      record.content,
      record.source,
      record.sessionId ?? null,
      record.embedding ? Buffer.from(record.embedding.buffer) : null,
    );
  }

  getReasoning(type: NodeType, id: string): ReasoningRecord[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM reasoning WHERE node_type = ? AND node_id = ? ORDER BY created_at ASC",
      )
      .all(type, id) as any[];
    return rows.map((r) => ({
      id: r.id,
      nodeType: r.node_type,
      nodeId: r.node_id,
      content: r.content,
      source: r.source,
      sessionId: r.session_id,
      embedding: r.embedding
        ? new Float32Array(r.embedding.buffer)
        : undefined,
      createdAt: r.created_at,
    }));
  }

  // ── Agent status ───────────────────────────────────────

  upsertAgentStatus(status: {
    agentId: string;
    role: string;
    status: string;
    phase?: string | null;
    currentTaskId?: string | null;
    progress?: number | null;
  }): void {
    const params = {
      agentId: status.agentId,
      role: status.role,
      status: status.status,
      phase: status.phase ?? null,
      currentTaskId: status.currentTaskId ?? null,
      progress: status.progress ?? null,
    };
    const stmt = this.db.prepare(`
      INSERT INTO agent_status (agent_id, role, status, phase, current_task_id, progress, last_heartbeat)
      VALUES (@agentId, @role, @status, @phase, @currentTaskId, @progress, unixepoch())
      ON CONFLICT(agent_id) DO UPDATE SET
        status = excluded.status,
        phase = excluded.phase,
        current_task_id = excluded.current_task_id,
        progress = excluded.progress,
        last_heartbeat = excluded.last_heartbeat
    `);
    stmt.run(params);
  }

  getAllAgentStatuses() {
    return this.db.prepare("SELECT * FROM agent_status").all();
  }

  // ── Helpers ────────────────────────────────────────────

  private toEdge(row: any): Edge {
    return {
      sourceType: row.source_type,
      sourceId: row.source_id,
      targetType: row.target_type,
      targetId: row.target_id,
      edgeType: row.edge_type,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
