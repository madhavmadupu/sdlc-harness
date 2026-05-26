import { execSync } from "node:child_process";
import { constants, accessSync } from "node:fs";
import { bold, dim, green, red, yellow, cyan, header, divider, section, item, success, error, warn, info, createSpinner } from "./utils.ts";
import { ServerManager } from "../server-manager.ts";

interface Diagnostic {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  fix?: string;
}

export async function doctor(): Promise<void> {
  header("SDLC Harness Doctor");
  info("Running diagnostics...\n");

  const diagnostics: Diagnostic[] = [];

  // 1. Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  if (nodeMajor >= 22) {
    diagnostics.push({
      name: "Node.js version",
      status: "pass",
      message: nodeVersion,
    });
  } else {
    diagnostics.push({
      name: "Node.js version",
      status: "fail",
      message: `${nodeVersion} (22+ required)`,
      fix: "Install Node.js 22+ from https://nodejs.org",
    });
  }

  // 2. Opencode binary
  const spinner = createSpinner("Checking opencode installation...");
  spinner.start();

  let opencodeFound = false;
  let opencodeVersion = "?";

  try {
    const which = process.platform === "win32" ? "where" : "which";
    const result = execSync(`${which} opencode`, {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
    if (result) {
      opencodeFound = true;
      try {
        const verResult = execSync(`opencode --version`, {
          encoding: "utf8",
          stdio: "pipe",
        }).trim();
        opencodeVersion = verResult;
      } catch {
        // version not available
      }
    }
  } catch {
    // not on PATH
  }

  if (opencodeFound) {
    diagnostics.push({
      name: "opencode CLI",
      status: "pass",
      message: `found (${opencodeVersion})`,
    });
  } else {
    diagnostics.push({
      name: "opencode CLI",
      status: "fail",
      message: "not found on PATH",
      fix: "Run: npm install -g opencode-ai",
    });
  }

  spinner.stop();

  // 3. Opencode server connectivity
  const serverSpinner = createSpinner("Checking opencode server...");
  serverSpinner.start();

  const serverUrl = process.env.OPENCODE_SERVER ?? "http://127.0.0.1:4096";
  try {
    const res = await fetch(`${serverUrl}/global/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as { healthy?: boolean; version?: string };
      if (data.healthy) {
        diagnostics.push({
          name: "opencode server",
          status: "pass",
          message: `running at ${serverUrl} (v${data.version ?? "?"})`,
        });
      } else {
        diagnostics.push({
          name: "opencode server",
          status: "fail",
          message: `at ${serverUrl} — not healthy`,
          fix: "Restart: opencode serve",
        });
      }
      serverSpinner.stop();
    } else {
      diagnostics.push({
        name: "opencode server",
        status: "warn",
        message: `at ${serverUrl} — not responding`,
        fix: "Start: opencode serve",
      });
      serverSpinner.stop();
    }
  } catch {
    diagnostics.push({
      name: "opencode server",
      status: "warn",
      message: `not running at ${serverUrl}`,
      fix: "Start: opencode serve",
    });
    serverSpinner.stop();
  }

  // 4. Database file
  const dbPath = process.env.SDLC_DB ?? "./sdlc-harness.db";
  try {
    accessSync(dbPath, constants.R_OK);
    const { statSync } = await import("node:fs");
    const stats = statSync(dbPath);
    diagnostics.push({
      name: "Knowledge graph DB",
      status: "pass",
      message: `${dbPath} (${(stats.size / 1024).toFixed(1)} KB)`,
    });
  } catch {
    diagnostics.push({
      name: "Knowledge graph DB",
      status: "warn",
      message: `${dbPath} — not found (will be created on first run)`,
    });
  }

  // 5. Git repository
  try {
    execSync("git rev-parse --git-dir", {
      encoding: "utf8",
      stdio: "pipe",
    });
    diagnostics.push({
      name: "Git repository",
      status: "pass",
      message: "detected",
    });
  } catch {
    diagnostics.push({
      name: "Git repository",
      status: "warn",
      message: "not found (some features may be limited)",
    });
  }

  // Print results
  divider();
  section("Diagnostic Results");

  let allPassed = true;
  for (const d of diagnostics) {
    const icon =
      d.status === "pass"
        ? green("✔")
        : d.status === "warn"
          ? yellow("⚠")
          : red("✗");
    console.log(`  ${icon} ${bold(d.name)}`);
    console.log(`    ${dim(d.message)}`);
    if (d.fix && d.status !== "pass") {
      console.log(`    ${cyan("→")} ${d.fix}`);
    }
    if (d.status === "fail") allPassed = false;
  }

  divider();

  if (allPassed) {
    success("All checks passed");
  } else {
    const failCount = diagnostics.filter((d) => d.status === "fail").length;
    const warnCount = diagnostics.filter((d) => d.status === "warn").length;
    if (failCount > 0) error(`${failCount} failed, ${warnCount} warnings`);
    else warn(`${warnCount} warnings`);
  }
}
