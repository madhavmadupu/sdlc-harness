# Knowledge graph

The harness uses a SQLite-backed property graph with two linked stores.

## Structural store

Nodes represent entities in the SDLC process. Each node has a type and a JSON payload.

### Node types

| Type | Description |
|---|---|
| `feature` | A feature to implement |
| `module` | A software module or component |
| `task` | A unit of work within a feature |
| `decision` | A design decision with rationale |
| `file` | A source file in the project |
| `agent` | An agent instance (Coder, QA, etc.) |
| `artifact` | A produced artifact (diff, test result, review) |

### Edge types

Edges form directed, typed relationships between nodes:

| Edge type | Description |
|---|---|
| `feature_has_task` | Feature decomposition |
| `feature_uses_module` | Feature-to-module mapping |
| `module_contains_file` | Module structure |
| `module_depends_on` | Module dependency |
| `task_produces_artifact` | Task output |
| `task_assigned_to` | Agent assignment |
| `task_blocked_by` | Task dependency |
| `task_precedes` | Task ordering |
| `decision_justifies` | Decision rationale |

## Reasoning store

An append-only store for thinking traces, summaries, and decisions keyed to nodes. Each record carries a source label (`thinking`, `summary`, `decision`, etc.) and optional embedding.

## Query patterns

**What features break if I change module X?**

```sql
WITH RECURSIVE affected(module_id) AS (
  SELECT ? AS module_id
  UNION
  SELECT e.source_id
  FROM edges e
  JOIN affected a ON e.target_id = a.module_id
  WHERE e.edge_type = 'module_depends_on'
)
SELECT DISTINCT n.node_id
FROM nodes n
JOIN edges fe ON fe.source_type = 'feature'
             AND fe.source_id = n.node_id
             AND fe.edge_type = 'feature_uses_module'
JOIN affected a ON fe.target_id = a.module_id
WHERE n.node_type = 'feature';
```

This recursive CTE finds all features transitively affected by a module change.
