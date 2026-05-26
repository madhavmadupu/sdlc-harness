import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORIES = ["workflow", "task_pattern", "knowledge", "prompt"];

export default function Memory() {
  const [category, setCategory] = useState("all");
  const [data, setData] = useState<{
    total: number;
    byCategory: Record<string, number>;
    entries: Record<string, unknown>[];
  }>({ total: 0, byCategory: {}, entries: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .memory(category === "all" ? undefined : category)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Process Memory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(data.byCategory).map(([cat, count]) => (
              <Badge key={cat} variant="info" className="text-sm px-3 py-1">
                {cat}: {count}
              </Badge>
            ))}
            <Badge variant="outline" className="text-sm px-3 py-1">
              Total: {data.total}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>
              {c.replace("_", " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={category} className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : data.entries.length === 0 ? (
                <p className="text-muted-foreground">No entries found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Success</TableHead>
                      <TableHead>Last Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entries.map((e: Record<string, unknown>, i: number) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="info">{String(e.category || "—")}</Badge>
                        </TableCell>
                        <TableCell>{String(e.phase || "—")}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {String(e.summary || e.content || "—")}
                        </TableCell>
                        <TableCell>
                          {e.success_count != null ? (
                            <span
                              className={
                                Number(e.success_count) > 0 ? "text-green-400" : "text-muted-foreground"
                              }
                            >
                              {String(e.success_count)}/{String(e.failure_count ?? 0)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {e.last_used ? String(e.last_used).slice(0, 10) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
