import type { z } from "zod";

// ── Task identity ──────────────────────────────────────────

export interface TaskId {
  featureId: string;
  taskIndex: number;
  toString(): string;
}

// ── Phase / status enums ───────────────────────────────────

export enum SdlcPhase {
  Design = "design",
  Implementation = "implementation",
  Review = "review",
  Testing = "testing",
  Done = "done",
  Failed = "failed",
}

export enum TaskStatus {
  Pending = "pending",
  Assigned = "assigned",
  InProgress = "in_progress",
  Blocked = "blocked",
  Passed = "passed",
  Failed = "failed",
}

// ── Normalized event vocabulary ────────────────────────────
// Every backend adapter emits these. The orchestrator and
// agents only ever see this vocabulary.

export type HarnessEvent =
  | TaskStarted
  | Thinking
  | ToolCallRequested
  | FileChanged
  | Progress
  | CostUpdate
  | PermissionNeeded
  | TaskCompleted
  | TaskFailed;

export interface TaskStarted {
  type: "task_started";
  taskId: TaskId;
  agentId: string;
  backend: string;
  timestamp: number;
}

export interface Thinking {
  type: "thinking";
  taskId: TaskId;
  text: string;
  timestamp: number;
}

export interface ToolCallRequested {
  type: "tool_call_requested";
  taskId: TaskId;
  name: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export interface FileChanged {
  type: "file_changed";
  taskId: TaskId;
  path: string;
  diff: string;
  timestamp: number;
}

export interface Progress {
  type: "progress";
  taskId: TaskId;
  phase: SdlcPhase;
  percent?: number;
  message: string;
  timestamp: number;
}

export interface CostUpdate {
  type: "cost_update";
  taskId: TaskId;
  tokens?: { input: number; output: number; cache?: { read: number; write: number } };
  dollars?: number;
  timestamp: number;
}

export interface PermissionNeeded {
  type: "permission_needed";
  taskId: TaskId;
  permissionId: string;
  action: string;
  details?: string;
  timestamp: number;
}

export interface TaskCompleted {
  type: "task_completed";
  taskId: TaskId;
  summary: string;
  artifacts: string[];
  diff: string;
  cost?: CostUpdate;
  timestamp: number;
}

export interface TaskFailed {
  type: "task_failed";
  taskId: TaskId;
  error: string;
  recoverable: boolean;
  timestamp: number;
}

// ── Agent status (shared state, not events) ────────────────

export interface AgentStatus {
  agentId: string;
  role: AgentRole;
  phase: SdlcPhase;
  currentTaskId?: TaskId;
  progress?: number;
  status: "idle" | "working" | "blocked" | "error";
  lastHeartbeat: number;
}

// ── Agent roles ────────────────────────────────────────────

export enum AgentRole {
  Architect = "architect",
  Coder = "coder",
  QA = "qa",
  StackAnalyst = "stack_analyst",
}

// ── Provider/tool backend abstraction ──────────────────────

export interface BackendCapabilities {
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  agentic: boolean; // true = backend owns its loop (opencode)
  maxContextWindow: number;
}

export interface BackendInfo {
  id: string;
  name: string;
  capabilities: BackendCapabilities;
  costPerToken?: { input: number; output: number };
}
