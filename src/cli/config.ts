import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { bold, cyan, dim, green, red, yellow, header, divider, item } from "./utils.ts";

export interface SdlcConfig {
  defaultModel?: string;
  defaultDb?: string;
  defaultServer?: string;
  opencodeDir?: string;
}

const CONFIG_PATH = resolve(homedir(), ".sdlc-harness.json");

export function loadConfig(): SdlcConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch {
    // ignore — return defaults
  }
  return {};
}

export function saveConfig(config: SdlcConfig): void {
  const dir = CONFIG_PATH.replace(/\/[^/]+$/, "");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

const CONFIG_KEYS: (keyof SdlcConfig)[] = [
  "defaultModel",
  "defaultDb",
  "defaultServer",
  "opencodeDir",
];

const KEY_DESCRIPTIONS: Record<keyof SdlcConfig, string> = {
  defaultModel: "Default model (e.g. opencode/gpt-4)",
  defaultDb: "Default database path",
  defaultServer: "Default opencode server URL",
  opencodeDir: "Default opencode CLI directory",
};

export async function configCommand(args: string[]): Promise<void> {
  const sub = args[0]?.toLowerCase();

  switch (sub) {
    case "get": {
      const key = args[1]?.toLowerCase() as keyof SdlcConfig;
      if (!key || !CONFIG_KEYS.includes(key)) {
        console.error(`  ${red("✘")} Usage: sdlc-harness config get <key>`);
        console.error(`  ${dim("Keys:")} ${CONFIG_KEYS.join(", ")}`);
        return;
      }
      const config = loadConfig();
      const val = config[key];
      if (val !== undefined) {
        console.log(`  ${bold(key)}: ${cyan(val)}`);
      } else {
        console.log(`  ${bold(key)}: ${dim("(not set)")}`);
      }
      break;
    }

    case "set": {
      const key = args[1]?.toLowerCase() as keyof SdlcConfig;
      const value = args.slice(2).join(" ");
      if (!key || !CONFIG_KEYS.includes(key) || !value) {
        console.error(`  ${red("✘")} Usage: sdlc-harness config set <key> <value>`);
        console.error(`  ${dim("Keys:")} ${CONFIG_KEYS.join(", ")}`);
        return;
      }
      const config = loadConfig();
      config[key] = value;
      saveConfig(config);
      console.log(`  ${green("✔")} ${bold(key)} set to ${cyan(value)}`);
      break;
    }

    case "list":
    case "ls": {
      const config = loadConfig();
      header("Configuration");
      let hasAny = false;
      for (const k of CONFIG_KEYS) {
        const val = config[k];
        if (val !== undefined) {
          item(KEY_DESCRIPTIONS[k], cyan(val));
          hasAny = true;
        } else {
          item(KEY_DESCRIPTIONS[k], dim("(not set)"));
        }
      }
      if (!hasAny) {
        console.log(`  ${dim("No configuration set yet. Use")} ${cyan("sdlc-harness config set <key> <value>")} ${dim("to add config.")}`);
      }
      divider();
      console.log(`  ${dim("Config file:")} ${CONFIG_PATH}`);
      break;
    }

    case "delete":
    case "del":
    case "unset": {
      const key = args[1]?.toLowerCase() as keyof SdlcConfig;
      if (!key || !CONFIG_KEYS.includes(key)) {
        console.error(`  ${red("✘")} Usage: sdlc-harness config delete <key>`);
        return;
      }
      const config = loadConfig();
      if (key in config) {
        delete config[key];
        saveConfig(config);
        console.log(`  ${green("✔")} ${bold(key)} ${dim("deleted")}`);
      } else {
        console.log(`  ${yellow("⚠")} ${bold(key)} ${dim("was not set")}`);
      }
      break;
    }

    default: {
      // Show current config
      const config = loadConfig();
      header("Configuration");
      let hasAny = false;
      for (const k of CONFIG_KEYS) {
        const val = config[k];
        if (val !== undefined) {
          item(KEY_DESCRIPTIONS[k], cyan(val));
          hasAny = true;
        }
      }
      if (!hasAny) {
        console.log(`  ${dim("No configuration set yet.")}`);
      }
      divider();
      console.log(`  ${dim("Config file:")} ${CONFIG_PATH}`);
      console.log(`  ${dim("Usage:")} ${cyan("sdlc-harness config set <key> <value>")}`);
      console.log(`  ${dim("       ")} ${cyan("sdlc-harness config get <key>")}`);
      console.log(`  ${dim("       ")} ${cyan("sdlc-harness config list")}`);
      console.log(`  ${dim("       ")} ${cyan("sdlc-harness config delete <key>")}`);
    }
  }
}
