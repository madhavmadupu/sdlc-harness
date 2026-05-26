import { useState, useEffect, useCallback } from "react";
import { api, type HealthResponse, type RunState, type TaskState, type RunEvent } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  Server,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Zap,
} from "lucide-react";

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [activeRun, setActiveRun] = useState<RunState | null>(null);
  const [feature, setFeature] = useState("");
  const [description, setDescription] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // Poll health every 2s
  useEffect(() => {
    const poll = async () => {
      try {
        const h = await api.health();
        setHealth(h);
      } catch {
        /* server not ready */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  // SSE subscription for active run
  useEffect(() => {
    if (!activeRun) return;

    const es = api.runEvents(activeRun.id);
    es.onmessage = (event: MessageEvent) => {
      try {
        const data: RunEvent = JSON.parse(event.data);
        if (data.type === "run-complete" || data.type === "run-error") {
          es.close();
          // Refresh to get final state
          api.getRun(activeRun.id).then(setActiveRun).catch(() => {});
        } else if (data.type === "task-update" && data.task) {
          setActiveRun((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === data.task!.id ? { ...t, ...data.task! } : t,
              ),
            };
          });
        }
      } catch {
        /* ignore parse errors */
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [activeRun?.id]);

  const startRun = useCallback(async () => {
    if (!feature.trim()) return;
    setStarting(true);
    setError("");
    try {
      const { id } = await api.startRun(feature.trim(), description.trim() || undefined);
      // Poll until the run is available
      let run: RunState;
      for (let i = 0; i < 30; i++) {
        run = await api.getRun(id);
        if (run.status !== "starting") break;
        await new Promise((r) => setTimeout(r, 500));
      }
      setActiveRun(run!);
      setFeature("");
      setDescription("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start run");
    } finally {
      setStarting(false);
    }
  }, [feature, description]);

  const completed = activeRun
    ? activeRun.tasks.filter((t) => t.outcome === "passed" || t.outcome === "failed").length
    : 0;
  const total = activeRun?.tasks.length ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const statusIcon = (s: string, outcome?: string) => {
    if (outcome === "passed") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (outcome === "failed") return <XCircle className="h-4 w-4 text-red-400" />;
    if (s === "running") return <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />;
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Status cards row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Server</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${health?.serverHealthy ? "bg-green-400" : "bg-red-400"}`}
              />
              <span className="text-sm font-medium">
                {health?.serverHealthy ? "Connected" : "Disconnected"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{health?.serverUrl ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Feature</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium truncate">
              {activeRun?.feature ?? health?.feature ?? "Idle"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active feature</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Elapsed</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">
              {formatElapsed(activeRun?.elapsed ?? health?.elapsed ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Running time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                activeRun?.status === "done"
                  ? "success"
                  : activeRun?.status === "failed"
                    ? "destructive"
                    : activeRun?.status === "running"
                      ? "warning"
                      : "secondary"
              }
            >
              {(activeRun?.status ?? health?.status ?? "idle").toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Start new feature */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start New Feature</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Feature title (e.g., Add user authentication)"
                value={feature}
                onChange={(e) => setFeature(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startRun()}
              />
              <Input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startRun()}
              />
            </div>
            <Button onClick={startRun} disabled={!feature.trim() || starting} className="self-start">
              {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Start
            </Button>
          </div>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Active run progress */}
      {activeRun && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Run: {activeRun.feature}</span>
              <Badge
                variant={
                  activeRun.status === "done"
                    ? "success"
                    : activeRun.status === "failed"
                      ? "destructive"
                      : "warning"
                }
              >
                {activeRun.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>
                  {completed}/{total} tasks ({pct}%)
                </span>
              </div>
              <Progress value={pct} />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRun.tasks.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{statusIcon(t.status, t.outcome)}</TableCell>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "running" ? "warning" : "secondary"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.outcome ? (
                        <Badge
                          variant={t.outcome === "passed" ? "success" : "destructive"}
                        >
                          {t.outcome}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Memory stats */}
      {health?.memoryStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Process Memory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(health.memoryStats.byCategory).map(([cat, count]) => (
                <Badge key={cat} variant="info" className="text-sm px-3 py-1">
                  {cat}: {count}
                </Badge>
              ))}
              <Badge variant="outline" className="text-sm px-3 py-1">
                Total: {health.memoryStats.total}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}
