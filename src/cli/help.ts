import { bold, dim, cyan, yellow, green, color, paint } from "./utils.ts";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function version(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    );
    return pkg.version ?? "?";
  } catch {
    return "?";
  }
}

export function showHelp(): void {
  const v = version();
  console.log(`
${bold("sdlc-harness")} ${dim(`v${v}`)} — ${dim("Multi-agent SDLC harness")}

${dim("Decompose features into tasks, execute via LLM agents, track")}
${dim("everything in a knowledge graph, and enforce quality gates.")}

${bold("USAGE")}
  ${cyan("sdlc-harness")} ${dim("[command]")} ${dim("[options]")}

${bold("COMMANDS")}
  ${cyan("run")}       ${dim("<feature>")}   Run a feature through the SDLC
  ${cyan("init")}                        Initialize a project for sdlc-harness
  ${cyan("doctor")}                       Diagnose and fix issues
  ${cyan("status")}                       Show server and graph status
  ${cyan("help")}                         Show this help message

${bold("RUN OPTIONS")}
  ${dim("--model")}       ${yellow("<model>")}     Model override (e.g. ${yellow("opencode/gpt-4")})
  ${dim("--id")}          ${yellow("<id>")}        Explicit feature ID (auto-generated if omitted)
  ${dim("--desc")}        ${yellow("<text>")}      Feature description (defaults to title)
  ${dim("--db")}          ${yellow("<path>")}      Knowledge graph database path
  ${dim("--server")}      ${yellow("<url>")}       opencode server URL

${bold("EXAMPLES")}
  ${dim("# Run a feature")}
  ${cyan("sdlc-harness")} ${green("run")} "${yellow("Add user authentication")}"

  ${dim("# Check system health")}
  ${cyan("sdlc-harness")} ${green("status")}

  ${dim("# Diagnose issues")}
  ${cyan("sdlc-harness")} ${green("doctor")}

  ${dim("# Run with a specific model")}
  ${cyan("sdlc-harness")} ${green("run")} "${yellow("Add login page")}" ${dim("--model")} ${yellow("opencode/deepseek-v4")}
`);
}
