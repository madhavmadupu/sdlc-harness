# API reference

## Core classes

### `Orchestrator`

```typescript
class Orchestrator {
  constructor(graph: GraphStore, backend: OpencodeBackend, config?: Partial<OrchestratorConfig>)
  runFeature(feature: { id: string; title: string; description: string }): Promise<FeatureResult>
}
```

### `GraphStore`

```typescript
class GraphStore {
  constructor(dbPath?: string)
  upsertNode(data: NodeData): void
  getNode<T>(type: NodeType, id: string): T | null
  listNodes<T>(type: NodeType): T[]
  deleteNode(type: NodeType, id: string): void
  addEdge(edge: Omit<Edge, 'createdAt'>): void
  getOutgoingEdges(sourceType: NodeType, sourceId: string, edgeType?: EdgeType): Edge[]
  getIncomingEdges(targetType: NodeType, targetId: string, edgeType?: EdgeType): Edge[]
  featuresAffectedByModule(moduleId: string): string[]
  tasksForFeature(featureId: string): TaskNode[]
  addReasoning(record: Omit<ReasoningRecord, 'id' | 'createdAt'>): void
  getReasoning(type: NodeType, id: string): ReasoningRecord[]
  upsertAgentStatus(status: { ... }): void
  getAllAgentStatuses(): any[]
  close(): void
}
```

### `OpencodeBackend`

```typescript
class OpencodeBackend {
  constructor(baseUrl?: string)
  ensureSession(agentId: string, opts?: { title?: string }): Promise<string>
  getSessionId(agentId: string): string | undefined
  runTask(agentId: string, taskId: TaskId, prompt: string, opts?): AsyncGenerator<HarnessEvent>
  respondToPermission(agentId: string, permissionId: string, response: 'allow' | 'deny', remember?: boolean): Promise<void>
  getDiff(agentId: string): Promise<{ path: string; diff: string }[]>
  getAllSessionStatuses(): Promise<Record<string, { status: string; title?: string }>>
  getTodo(agentId: string): Promise<{ title: string; completed: boolean }[]>
  abortTask(agentId: string): Promise<void>
  forkSession(agentId: string, messageId?: string): Promise<string>
  health(): Promise<{ healthy: boolean; version?: string }>
}
```

## Event types

The harness normalizes backend events into a common vocabulary:

| Event | Description |
|---|---|
| `task_started` | Task execution began |
| `thinking` | Agent reasoning text stream |
| `tool_call_requested` | Agent requested a tool call |
| `file_changed` | A file was modified |
| `progress` | Phase progress update |
| `cost_update` | Token/dollar cost update |
| `permission_needed` | Agent requested permission |
| `task_completed` | Task finished successfully |
| `task_failed` | Task failed (possibly recoverable) |

## Schema types

See [src/graph/schema.ts](../../src/graph/schema.ts) for the full type definitions including `NodeType`, `EdgeType`, `NodeData`, `Edge`, and `ReasoningRecord`.
