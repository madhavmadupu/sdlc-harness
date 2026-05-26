// ── Process Memory Types ────────────────────────────────────
//
// The memory layer stores successful workflows, task patterns,
// knowledge snippets, and prompt templates so that agents can
// reuse what worked before instead of re-discovering solutions.

export type MemoryCategory =
  | "workflow"       // End-to-end feature sequence that succeeded
  | "task_pattern"   // How a specific task type was solved
  | "knowledge"      // Project conventions, configs, decisions
  | "prompt";        // Prompt template that produced good results

export interface MemoryEntry {
  id: string;

  category: MemoryCategory;

  // Matching fields — used to find relevant memories
  phase?: string;      // design | implementation | testing | review
  role?: string;        // architect | coder | qa | stack_analyst
  keywords: string[];   // e.g., ["authentication", "jwt", "login"]

  // Content
  title: string;
  summary: string;
  body: string;        // Injected into agent prompts or system context

  // Usage tracking
  successCount: number;
  failureCount: number;
  lastUsed: number;
  sourceTaskId?: string;
  sourceFeatureId?: string;

  createdAt: number;
  updatedAt: number;
}

export interface MemorySearchParams {
  phase?: string;
  role?: string;
  keywords?: string[];
  limit?: number;
}

export interface MemoryStats {
  totalEntries: number;
  byCategory: Record<MemoryCategory, number>;
  workflows: number;
  taskPatterns: number;
  knowledge: number;
}

export function generateMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
