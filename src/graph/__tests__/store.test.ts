import { describe, it, expect, beforeEach } from "vitest";
import { GraphStore } from "../store.ts";
import {
  NodeType,
  EdgeType,
  type FeatureNode,
  type TaskNode,
  type ModuleNode,
} from "../schema.ts";

describe("GraphStore", () => {
  let store: GraphStore;

  beforeEach(() => {
    store = new GraphStore(":memory:");
  });

  describe("nodes", () => {
    it("creates and retrieves a feature node", () => {
      const feature: FeatureNode = {
        type: NodeType.Feature,
        id: "feat_1",
        title: "User Auth",
        description: "Add login and registration",
        status: "proposed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      store.upsertNode(feature);
      const retrieved = store.getNode<FeatureNode>(NodeType.Feature, "feat_1");
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe("User Auth");
    });

    it("updates an existing node", () => {
      store.upsertNode({
        type: NodeType.Feature,
        id: "feat_1",
        title: "Old Title",
        status: "proposed",
      } as FeatureNode);

      store.upsertNode({
        type: NodeType.Feature,
        id: "feat_1",
        title: "New Title",
        status: "in_progress",
      } as FeatureNode);

      const retrieved = store.getNode<FeatureNode>(NodeType.Feature, "feat_1");
      expect(retrieved!.title).toBe("New Title");
      expect(retrieved!.status).toBe("in_progress");
    });

    it("lists all nodes of a type", () => {
      for (let i = 0; i < 3; i++) {
        store.upsertNode({
          type: NodeType.Task,
          id: `task_${i}`,
          featureId: "feat_1",
          title: `Task ${i}`,
          description: "",
          status: "pending",
          sdlcPhase: "implementation",
          attemptCount: 0,
          maxAttempts: 3,
          gateCriteria: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as TaskNode);
      }

      const tasks = store.listNodes<TaskNode>(NodeType.Task);
      expect(tasks).toHaveLength(3);
    });

    it("deletes a node and its edges", () => {
      store.upsertNode({
        type: NodeType.Feature,
        id: "feat_1",
        title: "Test",
      } as FeatureNode);

      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "feat_1",
        targetType: NodeType.Module,
        targetId: "mod_1",
        edgeType: EdgeType.FeatureToModule,
      });

      store.deleteNode(NodeType.Feature, "feat_1");

      expect(store.getNode(NodeType.Feature, "feat_1")).toBeNull();
      expect(
        store.getOutgoingEdges(NodeType.Feature, "feat_1"),
      ).toHaveLength(0);
    });
  });

  describe("edges", () => {
    it("creates and queries outgoing edges", () => {
      store.upsertNode({ type: NodeType.Feature, id: "feat_1" } as FeatureNode);
      store.upsertNode({ type: NodeType.Module, id: "mod_1" } as ModuleNode);

      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "feat_1",
        targetType: NodeType.Module,
        targetId: "mod_1",
        edgeType: EdgeType.FeatureToModule,
      });

      const outgoing = store.getOutgoingEdges(
        NodeType.Feature,
        "feat_1",
        EdgeType.FeatureToModule,
      );
      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].targetId).toBe("mod_1");
    });

    it("creates and queries incoming edges", () => {
      store.upsertNode({ type: NodeType.Module, id: "mod_1" } as ModuleNode);

      store.addEdge({
        sourceType: NodeType.Module,
        sourceId: "mod_A",
        targetType: NodeType.Module,
        targetId: "mod_1",
        edgeType: EdgeType.ModuleDependsOn,
      });

      store.addEdge({
        sourceType: NodeType.Module,
        sourceId: "mod_B",
        targetType: NodeType.Module,
        targetId: "mod_1",
        edgeType: EdgeType.ModuleDependsOn,
      });

      const incoming = store.getIncomingEdges(
        NodeType.Module,
        "mod_1",
        EdgeType.ModuleDependsOn,
      );
      expect(incoming).toHaveLength(2);
    });

    it("enforces unique edge constraint", () => {
      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "f1",
        targetType: NodeType.Module,
        targetId: "m1",
        edgeType: EdgeType.FeatureToModule,
      });

      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "f1",
        targetType: NodeType.Module,
        targetId: "m1",
        edgeType: EdgeType.FeatureToModule,
      });

      const edges = store.getOutgoingEdges(NodeType.Feature, "f1");
      expect(edges).toHaveLength(1);
    });
  });

  describe("graph traversal", () => {
    it("finds features affected by module changes", () => {
      // Module A depends on Module B
      // Feature 1 uses Module A
      // Feature 2 uses Module B
      store.upsertNode({ type: NodeType.Module, id: "mod_A" } as ModuleNode);
      store.upsertNode({ type: NodeType.Module, id: "mod_B" } as ModuleNode);
      store.upsertNode({ type: NodeType.Feature, id: "f1" } as FeatureNode);
      store.upsertNode({ type: NodeType.Feature, id: "f2" } as FeatureNode);

      store.addEdge({
        sourceType: NodeType.Module,
        sourceId: "mod_A",
        targetType: NodeType.Module,
        targetId: "mod_B",
        edgeType: EdgeType.ModuleDependsOn,
      });

      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "f1",
        targetType: NodeType.Module,
        targetId: "mod_A",
        edgeType: EdgeType.FeatureToModule,
      });

      store.addEdge({
        sourceType: NodeType.Feature,
        sourceId: "f2",
        targetType: NodeType.Module,
        targetId: "mod_B",
        edgeType: EdgeType.FeatureToModule,
      });

      // Changing mod_B should affect both f1 (via mod_A → mod_B) and f2 (direct)
      const affected = store.featuresAffectedByModule("mod_B");
      expect(affected.sort()).toEqual(["f1", "f2"]);
    });
  });

  describe("reasoning", () => {
    it("stores and retrieves reasoning records", () => {
      store.addReasoning({
        nodeType: NodeType.Task,
        nodeId: "task_1",
        content: "Decided to use bcrypt for password hashing",
        source: "thinking",
        sessionId: "ses_123",
      });

      const records = store.getReasoning(NodeType.Task, "task_1");
      expect(records).toHaveLength(1);
      expect(records[0].content).toContain("bcrypt");
      expect(records[0].sessionId).toBe("ses_123");
    });
  });

  describe("agent status", () => {
    it("stores and retrieves agent status", () => {
      store.upsertAgentStatus({
        agentId: "coder-1",
        role: "coder",
        status: "working",
        phase: "implementation",
        currentTaskId: "task_1",
        progress: 0.5,
      });

      const statuses = store.getAllAgentStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({
        agent_id: "coder-1",
        status: "working",
        current_task_id: "task_1",
      });
    });
  });
});
