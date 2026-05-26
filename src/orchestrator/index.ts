import { GraphStore } from "../graph/store.ts";
import { OpencodeBackend } from "../adapter/opencode.ts";
import {
  type HarnessEvent,
  type TaskId,
  SdlcPhase,
  AgentRole,
} from "../types/events.ts";
import {
  NodeType,
  EdgeType,
  type TaskNode,
  type FeatureNode,
  type DecisionNode,
} from "../graph/schema.ts";

// ── Orchestrator ───────────────────────────────────────────
//
// Conducts the full SDLC for a feature:
//   1. Decompose → writes tasks to the graph
//   2. Assign   → picks agent role per task
//   3. Execute  → runs task via OpencodeBackend
//   4. Gate     → runs QA, may fork + retry
//   5. Record   → writes results + reasoning to graph

export interface OrchestratorConfig {
  maxAttemptsPerTask: number;
  autoApprovePermissions: boolean;
  model?: { providerID: string; modelID: string; variant?: string };
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxAttemptsPerTask: 3,
  autoApprovePermissions: true,
  model: undefined,
};

export class Orchestrator {
  private graph: GraphStore;
  private backend: OpencodeBackend;
  private config: OrchestratorConfig;
  private plannerSessionId: string | null = null;

  constructor(
    graph: GraphStore,
    backend: OpencodeBackend,
    config?: Partial<OrchestratorConfig>,
  ) {
    this.graph = graph;
    this.backend = backend;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Run one feature through the entire SDLC ─────────────

  async runFeature(featureSpec: {
    id: string;
    title: string;
    description: string;
  }): Promise<FeatureResult> {
    const feature: FeatureNode = {
      type: NodeType.Feature,
      id: featureSpec.id,
      title: featureSpec.title,
      description: featureSpec.description,
      status: "proposed",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.graph.upsertNode(feature);

    // 1. Decompose into tasks
    const tasks = await this.decomposeFeature(feature);
    feature.status = "designed";
    feature.updatedAt = Date.now();
    this.graph.upsertNode(feature);

    // 2. Execute each task in order
    const results: TaskResult[] = [];
    for (const task of tasks) {
      this.graph.upsertNode(task);

      // Link feature → task
      this.graph.addEdge({
        sourceType: NodeType.Feature,
        sourceId: feature.id,
        targetType: NodeType.Task,
        targetId: task.id,
        edgeType: EdgeType.FeatureToTask,
      });

      const result = await this.executeTask(task, feature);
      results.push(result);

      // If any task fails non-recoverably, stop the feature
      if (result.outcome === "failed" && !result.recoverable) {
        feature.status = "cancelled";
        feature.updatedAt = Date.now();
        this.graph.upsertNode(feature);
        return { feature, tasks, results, outcome: "failed" };
      }
    }

    feature.status = results.every((r) => r.outcome === "passed")
      ? "done"
      : "in_progress";
    feature.updatedAt = Date.now();
    this.graph.upsertNode(feature);

    return { feature, tasks, results, outcome: feature.status as FeatureResult["outcome"] };
  }

  // ── Decompose feature → tasks ───────────────────────────

  private async decomposeFeature(
    feature: FeatureNode,
  ): Promise<TaskNode[]> {
    // Record the decomposition reasoning
    const reasoning = `Decomposed feature "${feature.title}": ${feature.description}`;
    this.graph.addReasoning({
      nodeType: NodeType.Feature,
      nodeId: feature.id,
      content: reasoning,
      source: "decision",
    });

    // Default decomposition: one implementation task + one QA task
    // In a full implementation this would use an LLM for planning.
    const tasks: TaskNode[] = [
      {
        type: NodeType.Task,
        id: `${feature.id}:impl`,
        featureId: feature.id,
        title: `Implement ${feature.title}`,
        description: feature.description,
        status: "pending",
        sdlcPhase: "implementation",
        attemptCount: 0,
        maxAttempts: this.config.maxAttemptsPerTask,
        gateCriteria: ["tests_pass", "lint_clean", "no_regressions"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        type: NodeType.Task,
        id: `${feature.id}:qa`,
        featureId: feature.id,
        title: `QA ${feature.title}`,
        description: `Verify the implementation of ${feature.title}`,
        status: "pending",
        sdlcPhase: "testing",
        attemptCount: 0,
        maxAttempts: this.config.maxAttemptsPerTask,
        gateCriteria: ["all_tests_pass", "code_review_approved"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    // Link task ordering: impl → qa
    this.graph.addEdge({
      sourceType: NodeType.Task,
      sourceId: tasks[0].id,
      targetType: NodeType.Task,
      targetId: tasks[1].id,
      edgeType: EdgeType.TaskPrecedes,
    });

    return tasks;
  }

  // ── Execute a single task with gate loop ─────────────────

  private async executeTask(
    task: TaskNode,
    feature: FeatureNode,
  ): Promise<TaskResult> {
    const agentId = this.pickAgent(task.sdlcPhase);
    const role = task.sdlcPhase === "testing" ? AgentRole.QA : AgentRole.Coder;

    // Ensure the agent has a session
    await this.backend.ensureSession(agentId, {
      title: `${role}: ${task.title}`,
    });

    // Update graph
    task.status = "in_progress";
    task.assignedAgentId = agentId;
    task.updatedAt = Date.now();
    this.graph.upsertNode(task);

    this.graph.addEdge({
      sourceType: NodeType.Task,
      sourceId: task.id,
      targetType: NodeType.Agent,
      targetId: agentId,
      edgeType: EdgeType.TaskAssignedTo,
    });

    this.graph.upsertAgentStatus({
      agentId,
      role,
      status: "working",
      phase: task.sdlcPhase,
      currentTaskId: task.id,
    });

    // Build the prompt
    const prompt = this.buildTaskPrompt(task, feature);

    // Execute with fork-retry loop
    let attempt = 0;
    let lastError = "";

    while (attempt < task.maxAttempts) {
      attempt++;
      task.attemptCount = attempt;
      task.updatedAt = Date.now();
      this.graph.upsertNode(task);

      try {
        // Run the task
        const events = this.backend.runTask(agentId, taskId(task.id), prompt, {
          model: this.config.model,
        });

        let completed = false;
        let summary = "";
        let diff = "";

        for await (const event of events) {
          // Record thinking as reasoning
          if (event.type === "thinking") {
            this.graph.addReasoning({
              nodeType: NodeType.Task,
              nodeId: task.id,
              content: event.text,
              source: "thinking",
              sessionId: this.backend.getSessionId(agentId),
            });
          }

          // Auto-approve permissions
          if (event.type === "permission_needed" && this.config.autoApprovePermissions) {
            await this.backend.respondToPermission(
              agentId,
              event.permissionId,
              "allow",
              true,
            );
          }

          // Track file changes
          if (event.type === "file_changed") {
            this.graph.addEdge({
              sourceType: NodeType.Artifact,
              sourceId: `${task.id}:artifact:${attempt}`,
              targetType: NodeType.File,
              targetId: event.path,
              edgeType: EdgeType.ArtifactToFile,
            });
          }

          if (event.type === "task_completed") {
            completed = true;
            summary = event.summary;
            diff = event.diff;
          }

          if (event.type === "task_failed") {
            completed = true;
            lastError = event.error;
            if (!event.recoverable) break;
          }
        }

        // Collect authoritative diff
        const fileDiffs = await this.backend.getDiff(agentId);
        diff =
          fileDiffs
            .map((f) => `--- ${f.path}\n${f.diff}`)
            .join("\n") || diff;

        if (completed && !lastError) {
          // Gate check (simplified — always passes for now)
          const gatePassed = await this.runGate(task, agentId);

          if (gatePassed) {
            task.status = "passed";
            task.sdlcPhase = "done";
            task.updatedAt = Date.now();
            this.graph.upsertNode(task);

            // Record the artifact
            this.graph.upsertNode({
              type: NodeType.Artifact,
              id: `${task.id}:artifact:${attempt}`,
              taskId: task.id,
              kind: "diff",
              content: diff,
              size: diff.length,
              createdAt: Date.now(),
            });

            this.graph.addEdge({
              sourceType: NodeType.Task,
              sourceId: task.id,
              targetType: NodeType.Artifact,
              targetId: `${task.id}:artifact:${attempt}`,
              edgeType: EdgeType.TaskToArtifact,
            });

            this.graph.upsertAgentStatus({
              agentId,
              role,
              status: "idle",
              phase: "done",
            });

            return {
              outcome: "passed",
              taskId: task.id,
              summary,
              diff,
              attempts: attempt,
            };
          } else {
            // Gate failed — fork and retry
            lastError = "Gate check failed";
            await this.backend.forkSession(agentId);
            continue;
          }
        } else {
          // Task failed — fork and retry
          await this.backend.forkSession(agentId);
          continue;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        await this.backend.forkSession(agentId);
      }
    }

    // All attempts exhausted
    task.status = "failed";
    task.sdlcPhase = "failed";
    task.updatedAt = Date.now();
    this.graph.upsertNode(task);

    this.graph.addReasoning({
      nodeType: NodeType.Task,
      nodeId: task.id,
      content: `Failed after ${attempt} attempts. Last error: ${lastError}`,
      source: "decision",
    });

    this.graph.upsertAgentStatus({
      agentId,
      role,
      status: "error",
      phase: "failed",
    });

    return {
      outcome: "failed",
      taskId: task.id,
      error: lastError,
      recoverable: attempt < task.maxAttempts,
      attempts: attempt,
    };
  }

  // ── Quality gate ────────────────────────────────────────

  private async runGate(
    task: TaskNode,
    agentId: string,
  ): Promise<boolean> {
    // For the MVP, gates always pass.
    // In production this runs tests, lint, and review via
    // POST /session/:id/shell and the QA agent.
    return true;
  }

  // ── Helpers ─────────────────────────────────────────────

  private pickAgent(phase: string): string {
    // Simple routing: one agent per phase for now
    switch (phase) {
      case "design":
        return "architect";
      case "implementation":
        return "coder";
      case "testing":
        return "qa";
      default:
        return "coder";
    }
  }

  private buildTaskPrompt(task: TaskNode, feature: FeatureNode): string {
    return `You are implementing the following feature for the project.

Feature: ${feature.title}
Description: ${feature.description}

Task: ${task.title}
Task description: ${task.description}

SDLC Phase: ${task.sdlcPhase}
Gate criteria: ${task.gateCriteria.join(", ")}

Please implement this task. Follow existing code conventions. Handle edge cases.`;
  }
}

// ── Result types ───────────────────────────────────────────

export interface FeatureResult {
  feature: FeatureNode;
  tasks: TaskNode[];
  results: TaskResult[];
  outcome: "done" | "in_progress" | "failed" | "cancelled";
}

export interface TaskResult {
  outcome: "passed" | "failed";
  taskId: string;
  summary?: string;
  diff?: string;
  error?: string;
  recoverable?: boolean;
  attempts: number;
}

// ── Internal helpers ───────────────────────────────────────

function taskId(id: string): TaskId {
  const parts = id.split(":");
  return {
    featureId: parts[0] ?? id,
    taskIndex: parseInt(parts[1] ?? "0", 10),
    toString() {
      return id;
    },
  };
}
