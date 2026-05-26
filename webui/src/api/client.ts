export interface TaskState {
  id: string;
  title: string;
  status: "pending" | "running" | "done";
  outcome?: "passed" | "failed";
  logs?: string[];
}

export interface RunState {
  id: string;
  feature: string;
  featureId: string;
  status: "starting" | "running" | "done" | "failed";
  tasks: TaskState[];
  elapsed: number;
  createdAt: number;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
}

export interface HealthResponse {
  serverHealthy: boolean;
  serverUrl: string;
  feature: string;
  featureId: string;
  status: string;
  elapsed: number;
  memoryStats: MemoryStats;
}

export interface RunEvent {
  type: "task-update" | "task-complete" | "run-complete" | "run-error" | "log";
  taskId?: string;
  task?: TaskState;
  message?: string;
  run?: RunState;
}

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  memory: (category?: string) =>
    request<MemoryStats & { entries: Record<string, unknown>[] }>(
      `/memory${category ? `?category=${category}` : ""}`,
    ),

  tasks: () => request<TaskState[]>("/tasks"),

  startRun: (feature: string, description?: string, id?: string) =>
    request<{ id: string }>("/runs", {
      method: "POST",
      body: JSON.stringify({ feature, description, id }),
    }),

  getRun: (id: string) => request<RunState>(`/runs/${id}`),

  runEvents: (id: string): EventSource =>
    new EventSource(`${BASE}/runs/${id}/events`),

  config: () => request<Record<string, unknown>>("/config"),

  updateConfig: (cfg: Record<string, unknown>) =>
    request<Record<string, unknown>>("/config", {
      method: "PUT",
      body: JSON.stringify(cfg),
    }),
};
