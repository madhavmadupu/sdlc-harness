// ── Knowledge Graph Schema ─────────────────────────────────
//
// Two stores, linked:
//   1. STRUCTURAL: nodes + edges (property graph in SQLite)
//   2. REASONING:   append-only documents + embeddings keyed to nodes
//
// The bridge: a REASONING record carries an embedding and
// hangs off the structural node it explains (via node_type + node_id).

// ── Node types ─────────────────────────────────────────────

export enum NodeType {
  Feature = "feature",
  Module = "module",
  Task = "task",
  Decision = "decision",
  File = "file",
  Agent = "agent",
  Artifact = "artifact",
}

// ── Edge types ─────────────────────────────────────────────

export enum EdgeType {
  // Feature decomposition
  FeatureToTask = "feature_has_task",
  FeatureToModule = "feature_uses_module",

  // Module structure
  ModuleToFile = "module_contains_file",
  ModuleDependsOn = "module_depends_on",

  // Decision justification
  DecisionJustifies = "decision_justifies", // → module | file | feature

  // Task relationships
  TaskToArtifact = "task_produces_artifact",
  TaskAssignedTo = "task_assigned_to",
  TaskBlockedBy = "task_blocked_by",
  TaskPrecedes = "task_precedes",

  // Traceability
  ArtifactToFile = "artifact_modifies_file",
}

// ── Node data payloads ─────────────────────────────────────

export interface FeatureNode {
  type: NodeType.Feature;
  id: string;
  title: string;
  description: string;
  status: "proposed" | "designed" | "in_progress" | "done" | "cancelled";
  createdAt: number;
  updatedAt: number;
}

export interface ModuleNode {
  type: NodeType.Module;
  id: string;
  name: string;
  techStack: string[];
  purpose: string;
}

export interface TaskNode {
  type: NodeType.Task;
  id: string;
  featureId: string;
  title: string;
  description: string;
  status: "pending" | "assigned" | "in_progress" | "passed" | "failed" | "blocked";
  sdlcPhase: "design" | "implementation" | "review" | "testing" | "done" | "failed";
  attemptCount: number;
  maxAttempts: number;
  gateCriteria: string[];
  assignedAgentId?: string;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DecisionNode {
  type: NodeType.Decision;
  id: string;
  summary: string;
  rationale: string;
  alternatives: string[];
  madeBy: string;
  timestamp: number;
}

export interface FileNode {
  type: NodeType.File;
  id: string;
  path: string;
  hash: string;
  techStack: string[];
}

export interface AgentNode {
  type: NodeType.Agent;
  id: string;
  role: "architect" | "coder" | "qa" | "stack_analyst";
  status: "idle" | "working" | "blocked" | "error";
  currentTaskId?: string;
  sessionId?: string;
}

export interface ArtifactNode {
  type: NodeType.Artifact;
  id: string;
  taskId: string;
  kind: "diff" | "doc" | "summary" | "test_result" | "review";
  content: string;
  size: number;
  createdAt: number;
}

export type NodeData =
  | FeatureNode
  | ModuleNode
  | TaskNode
  | DecisionNode
  | FileNode
  | AgentNode
  | ArtifactNode;

// ── Edge data ──────────────────────────────────────────────

export interface Edge {
  sourceType: NodeType;
  sourceId: string;
  targetType: NodeType;
  targetId: string;
  edgeType: EdgeType;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

// ── Reasoning record ───────────────────────────────────────

export interface ReasoningRecord {
  id: string;
  nodeType: NodeType;
  nodeId: string;
  content: string;
  source: "thinking" | "summary" | "decision" | "export" | "review";
  sessionId?: string;
  embedding?: Float32Array;
  createdAt: number;
}
