#!/usr/bin/env node

import { createInterface } from "node:readline";
import { bold, dim, green, red, yellow, cyan, magenta, header, divider, color } from "./cli/utils.ts";
import { showHelp } from "./cli/help.ts";
import { runFeature, type RunOptions } from "./cli/run.ts";
import { status } from "./cli/status.ts";
import { doctor } from "./cli/doctor.ts";
import { initProject } from "./cli/init.ts";

// ── Main ────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await interactiveMode();
    return;
  }

  const command = args[0].toLowerCase();
  const rest = args.slice(1);

  switch (command) {
    case "run": {
      const opts = parseRunOptions(rest);
      await runFeature(opts);
      break;
    }
    case "status":
    case "health": {
      const serverIdx = rest.indexOf("--server");
      const dbIdx = rest.indexOf("--db");
      await status({
        server: serverIdx >= 0 ? rest[serverIdx + 1] : undefined,
        db: dbIdx >= 0 ? rest[dbIdx + 1] : undefined,
      });
      break;
    }
    case "doctor":
    case "diagnose": {
      await doctor();
      break;
    }
    case "init":
    case "setup": {
      await initProject(rest[0]);
      break;
    }
    case "help":
    case "--help":
    case "-h": {
      showHelp();
      break;
    }
    default: {
      // Try treating the first arg as a feature title (backwards compat)
      if (!command.startsWith("-")) {
        const opts = parseRunOptions(args);
        opts.feature = args.join(" ");
        await runFeature(opts);
      } else {
        console.error(`  ${red("✘")} Unknown command: ${bold(command)}`);
        console.error(`  ${dim("Run")} ${cyan("sdlc-harness help")} ${dim("to see available commands")}`);
        process.exit(1);
      }
    }
  }
}

// ── Interactive mode ────────────────────────────────────────

async function interactiveMode(): Promise<void> {
  console.log(`
  ${bold(cyan("sdlc-harness"))} ${dim("— Multi-agent SDLC harness")}

  ${dim("What would you like to do?")}
  `);

  const choices = [
    { key: "r", label: "Run a feature", desc: "Execute a feature through the SDLC pipeline" },
    { key: "s", label: "Check status", desc: "Show server health and knowledge graph status" },
    { key: "d", label: "Run doctor", desc: "Diagnose and fix common issues" },
    { key: "i", label: "Init project", desc: "Set up sdlc-harness in this directory" },
    { key: "h", label: "Show help", desc: "View full command reference" },
    { key: "q", label: "Quit", desc: "Exit" },
  ];

  for (const c of choices) {
    const shortcut = c.key === "q" ? dim("q") : cyan(c.key);
    console.log(`    ${shortcut}) ${bold(c.label)}`);
    console.log(`       ${dim(c.desc)}`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const answer = await new Promise<string>((resolve) => {
    rl.question(`\n  ${cyan("?")} ${bold("Choose an option")} ${dim("[r/s/d/i/h/q]")} ${dim("›")} `, (a) => {
      rl.close();
      resolve(a.trim().toLowerCase());
    });
  });

  console.log();

  switch (answer) {
    case "r": {
      const rl2 = createInterface({ input: process.stdin, output: process.stdout });
      const feature = await new Promise<string>((resolve) => {
        rl2.question(`  ${cyan("?")} ${bold("Feature title")} ${dim("›")} `, (a) => {
          rl2.close();
          resolve(a.trim());
        });
      });
      if (feature) {
        await runFeature({ feature });
      } else {
        console.log(`  ${yellow("⚠")} No feature specified`);
      }
      break;
    }
    case "s":
      await status({});
      break;
    case "d":
      await doctor();
      break;
    case "i":
      await initProject();
      break;
    case "h":
      showHelp();
      break;
    case "q":
      console.log(`  ${dim("Goodbye!")}`);
      break;
    default:
      console.log(`  ${yellow("⚠")} Invalid option: ${answer}`);
  }
}

// ── Parse run options ──────────────────────────────────────

function parseRunOptions(args: string[]): RunOptions {
  const opts: RunOptions = { feature: "" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--model":
        opts.model = args[++i];
        break;
      case "--id":
        opts.featureId = args[++i];
        break;
      case "--desc":
        opts.featureDesc = args[++i];
        break;
      case "--db":
        opts.db = args[++i];
        break;
      case "--server":
        opts.server = args[++i];
        break;
      default:
        if (!args[i].startsWith("-")) {
          opts.feature = opts.feature ? `${opts.feature} ${args[i]}` : args[i];
        }
    }
  }

  return opts;
}

// ── Execute ─────────────────────────────────────────────────

main().catch((err) => {
  console.error(`\n  ${red("✘")} ${bold("Fatal:")} ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
