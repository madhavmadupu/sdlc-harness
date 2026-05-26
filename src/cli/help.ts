import { bold, dim, cyan, yellow, green, color, paint } from "./utils.ts";

declare const __SDLC_HARNESS_VERSION__: string;

export function getVersion(): string {
  return __SDLC_HARNESS_VERSION__;
}

export function showHelp(): void {
  const v = getVersion();
  console.log(`
${bold("sdlc-harness")} ${dim(`v${v}`)} — ${dim("Multi-agent SDLC harness")}

${dim("Decompose features into tasks, execute via LLM agents, track")}
${dim("everything in a knowledge graph, and enforce quality gates.")}

${bold("USAGE")}
  ${cyan("sdlc-harness")} ${dim("[command]")} ${dim("[options]")}
  ${cyan("sdlc-harness")} ${dim("[command]")} ${cyan("--help")}

${bold("COMMANDS")}
  ${cyan("run")}       ${dim("<feature>")}   Run a feature through the SDLC
  ${cyan("watch")}     ${dim("<feature>")}   Run a feature with live TUI dashboard
  ${cyan("web")}                           Start browser-based dashboard
  ${cyan("config")}    ${dim("[action]")}    View/edit configuration (${dim("get/set/list/delete")})
  ${cyan("status")}                       Show server, graph and memory status
  ${cyan("doctor")}                       Diagnose and fix common issues
  ${cyan("init")}                        Initialize sdlc-harness in this directory
  ${cyan("memory")}                       Access process memory (${dim("list/show/search/clear")})
  ${cyan("help")}                         Show this help message

${bold("OPTIONS")}
  ${dim("--model")}       ${yellow("<model>")}     Model override (e.g. ${yellow("opencode/gpt-4")})
  ${dim("--id")}          ${yellow("<id>")}        Explicit feature ID (auto-generated if omitted)
  ${dim("--desc")}        ${yellow("<text>")}      Feature description (defaults to title)
  ${dim("--db")}          ${yellow("<path>")}      Knowledge graph database path
  ${dim("--server")}      ${yellow("<url>")}       opencode server URL
  ${dim("--version")} ${dim("/")} ${cyan("-v")}           Show version

${bold("WEB UI OPTIONS")}
  ${dim("--port")}       ${yellow("<port>")}     Port to listen on (default: ${yellow("4097")})
  ${dim("--open")}                           Open browser automatically
  ${dim("--dev")}                            Enable CORS for Vite dev server

${bold("EXAMPLES")}
  ${dim("# Run a feature")}
  ${cyan("sdlc-harness")} ${green("run")} "${yellow("Add user authentication")}"

  ${dim("# Run with live dashboard")}
  ${cyan("sdlc-harness")} ${green("watch")} "${yellow("Add login page")}"

  ${dim("# Start web dashboard")}
  ${cyan("sdlc-harness")} ${green("web")}

  ${dim("# View config")}
  ${cyan("sdlc-harness")} ${green("config")} ${green("list")}

  ${dim("# Set config")}
  ${cyan("sdlc-harness")} ${green("config")} ${green("set")} ${yellow("defaultModel")} ${yellow("opencode/gpt-4")}

  ${dim("# Check system health")}
  ${cyan("sdlc-harness")} ${green("status")}

  ${dim("# Diagnose issues")}
  ${cyan("sdlc-harness")} ${green("doctor")}

  ${dim("# Show version")}
  ${cyan("sdlc-harness")} ${green("--version")}
`);
}
