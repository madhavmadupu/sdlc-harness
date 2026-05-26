import { MemoryStore } from "../memory/store.ts";
import {
  bold, dim, green, red, yellow, cyan,
  header, divider, section, item, success, error, info, warn,
} from "./utils.ts";

export interface MemoryOptions {
  db?: string;
}

export async function listMemories(opts: MemoryOptions, category?: string): Promise<void> {
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";
  const store = new MemoryStore(dbPath);

  const stats = store.getStats();
  header("Process Memory");

  section("Statistics");
  item("Total entries", String(stats.totalEntries));
  item("Workflows", String(stats.workflows));
  item("Task patterns", String(stats.taskPatterns));
  item("Knowledge", String(stats.knowledge));

  if (stats.totalEntries === 0) {
    divider();
    info("No memory entries yet. Run a feature to start building patterns.");
    store.close();
    return;
  }

  const entries = category ? store.list(category as any) : store.list();
  divider();

  section(category ? `${category} entries` : "All entries");
  for (const entry of entries) {
    const successRate = entry.successCount + entry.failureCount > 0
      ? Math.round((entry.successCount / (entry.successCount + entry.failureCount)) * 100)
      : 0;
    const icon = entry.category === "workflow" ? "📋"
      : entry.category === "task_pattern" ? "🔧"
      : entry.category === "knowledge" ? "📝"
      : "💡";
    const phase = entry.phase ? dim(` [${entry.phase}]`) : "";
    const lastUsed = entry.lastUsed
      ? dim(` last: ${new Date(entry.lastUsed).toISOString().slice(0, 10)}`)
      : "";
    console.log(`  ${icon} ${bold(entry.title)}${phase}`);
    console.log(`     ${dim(entry.summary || entry.body.slice(0, 80))}`);
    console.log(`     ${green(`${entry.successCount}✓`)} ${entry.failureCount > 0 ? red(`${entry.failureCount}✗`) : ""} ${dim(`${successRate}% success`)}${lastUsed}`);
    console.log();
  }

  store.close();
}

export async function showMemory(opts: MemoryOptions, id: string): Promise<void> {
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";
  const store = new MemoryStore(dbPath);

  const entry = store.get(id);
  if (!entry) {
    error(`Memory entry not found: ${id}`);
    store.close();
    return;
  }

  header(`Memory: ${entry.title}`);

  item("ID", dim(entry.id));
  item("Category", entry.category);
  if (entry.phase) item("Phase", entry.phase);
  if (entry.role) item("Role", entry.role);
  item("Keywords", entry.keywords.join(", "));
  item("Success rate", `${entry.successCount}✓ ${entry.failureCount > 0 ? `${entry.failureCount}✗` : ""}`);
  item("Last used", new Date(entry.lastUsed).toISOString());
  item("Created", new Date(entry.createdAt).toISOString());

  if (entry.summary) {
    divider();
    section("Summary");
    console.log(`  ${entry.summary}`);
  }

  if (entry.body) {
    divider();
    section("Body");
    console.log(`  ${entry.body}`);
  }

  if (entry.sourceTaskId || entry.sourceFeatureId) {
    divider();
    section("Source");
    if (entry.sourceFeatureId) item("Feature", entry.sourceFeatureId);
    if (entry.sourceTaskId) item("Task", entry.sourceTaskId);
  }

  store.close();
}

export async function searchMemories(opts: MemoryOptions, query: string): Promise<void> {
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";
  const store = new MemoryStore(dbPath);

  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  header(`Search memory: "${query}"`);

  const results = store.search({ keywords, limit: 15 });

  if (results.length === 0) {
    info("No matching entries found.");
    store.close();
    return;
  }

  divider();
  for (const entry of results) {
    const icon = entry.category === "workflow" ? "📋"
      : entry.category === "task_pattern" ? "🔧"
      : entry.category === "knowledge" ? "📝"
      : "💡";
    console.log(`  ${icon} ${bold(entry.title)} ${dim(`[${entry.category}]`)}`);
    console.log(`     ${dim(entry.summary || entry.body.slice(0, 80))}`);
    console.log(`     ${dim(entry.id)} — ${green(`${entry.successCount}✓`)} ${dim(`${Math.round((entry.successCount / Math.max(entry.successCount + entry.failureCount, 1)) * 100)}%`)}`);
    console.log();
  }

  store.close();
}

export async function clearMemories(opts: MemoryOptions): Promise<void> {
  const dbPath = opts.db ?? process.env.SDLC_DB ?? "./sdlc-harness.db";
  const store = new MemoryStore(dbPath);

  const stats = store.getStats();
  if (stats.totalEntries === 0) {
    info("Memory is already empty.");
    store.close();
    return;
  }

  store.clear();
  success(`Cleared ${stats.totalEntries} memory entries.`);
  store.close();
}
