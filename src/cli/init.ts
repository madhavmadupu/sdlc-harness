import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bold, dim, green, yellow, cyan, header, divider, section, item, success, error, info, ask, confirm, createSpinner } from "./utils.ts";

export async function initProject(targetDir?: string): Promise<void> {
  const dir = targetDir ? resolve(targetDir) : process.cwd();
  const name = dir.split("/").pop() ?? dir.split("\\").pop() ?? "project";

  header("Initialize SDLC Harness");

  info(`Setting up in ${bold(dir)}`);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    success(`Created directory ${dir}`);
  }

  const changes: string[] = [];

  // Create .sdlc config
  const configPath = resolve(dir, ".sdlc-harness.json");
  if (existsSync(configPath)) {
    info("Config file already exists");
  } else {
    const config = {
      version: "1",
      db: "./sdlc-harness.db",
      server: "http://127.0.0.1:4096",
      maxAttemptsPerTask: 3,
      autoApprovePermissions: true,
    };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    changes.push(".sdlc-harness.json");
    success("Created .sdlc-harness.json");
  }

  // Add to .gitignore
  const gitignorePath = resolve(dir, ".gitignore");
  let gitignore = "";
  if (existsSync(gitignorePath)) {
    gitignore = require("node:fs").readFileSync(gitignorePath, "utf8");
  }

  const dbEntries = ["sdlc-harness.db", "sdlc-harness.db-shm", "sdlc-harness.db-wal"];
  const missingEntries = dbEntries.filter((e) => !gitignore.includes(e));
  if (missingEntries.length > 0 && gitignore.length > 0) {
    const append = "\n# SDLC Harness\n" + missingEntries.map((e) => e + "\n").join("");
    require("node:fs").appendFileSync(gitignorePath, append);
    changes.push(".gitignore updated");
    success("Added database files to .gitignore");
  }

  // Check for package.json
  const pkgPath = resolve(dir, "package.json");
  if (!existsSync(pkgPath)) {
    const wantsPkg = await confirm("Create a package.json?");
    if (wantsPkg) {
      const pkg = {
        name: name,
        version: "1.0.0",
        private: true,
        scripts: {
          "sdlc": "sdlc-harness",
        },
      };
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      changes.push("package.json");
      success("Created package.json");
    }
  }

  divider();
  section("Summary");
  if (changes.length > 0) {
    success(`Completed ${changes.length} ${changes.length === 1 ? "change" : "changes"}`);
    for (const c of changes) {
      console.log(`  ${green("✔")} ${c}`);
    }
  } else {
    info("Everything is already set up");
  }

  divider();
  console.log(`  ${cyan("Next:")} ${bold(`sdlc-harness run "<feature>"`)}`);
}
