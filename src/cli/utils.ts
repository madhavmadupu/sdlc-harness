import { createInterface } from "node:readline";

// ── Terminal colors ────────────────────────────────────────

export const color = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",

  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

export function paint(code: string, text: string): string {
  return `${code}${text}${color.reset}`;
}

export function dim(text: string): string {
  return paint(color.dim, text);
}

export function bold(text: string): string {
  return paint(color.bold, text);
}

export function red(text: string): string {
  return paint(color.red, text);
}

export function green(text: string): string {
  return paint(color.green, text);
}

export function yellow(text: string): string {
  return paint(color.yellow, text);
}

export function blue(text: string): string {
  return paint(color.blue, text);
}

export function cyan(text: string): string {
  return paint(color.cyan, text);
}

export function magenta(text: string): string {
  return paint(color.magenta, text);
}

// ── Spinner ─────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(message: string) {
  let i = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      const lines = message.split("\n");
      const line = lines[lines.length - 1];
      process.stdout.write(`\r${color.cyan}${SPINNER_FRAMES[0]}${color.reset} ${line}`);
      interval = setInterval(() => {
        i = (i + 1) % SPINNER_FRAMES.length;
        process.stdout.write(
          `\r${color.cyan}${SPINNER_FRAMES[i]}${color.reset} ${line}`,
        );
      }, 80);
    },
    stop(finalMessage?: string) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (finalMessage) {
        process.stdout.write(`\r${green("✔")} ${finalMessage}\n`);
      } else {
        process.stdout.write("\r".padEnd(process.stdout.columns ?? 80, " ") + "\r");
      }
    },
    fail(finalMessage?: string) {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (finalMessage) {
        process.stdout.write(`\r${red("✘")} ${finalMessage}\n`);
      } else {
        process.stdout.write("\r".padEnd(process.stdout.columns ?? 80, " ") + "\r");
      }
    },
  };
}

// ── Progress bar ────────────────────────────────────────────

export function createProgressBar(total: number) {
  let current = 0;

  return {
    tick(message?: string) {
      current++;
      const pct = Math.round((current / total) * 100);
      const filled = Math.round((pct / 100) * 30);
      const bar =
        color.cyan +
        "█".repeat(filled) +
        color.dim +
        "░".repeat(30 - filled) +
        color.reset;
      const msg = message ? ` ${dim(message)}` : "";
      process.stdout.write(`\r${bar} ${bold(String(pct))}%${msg}`);
      if (current >= total) {
        process.stdout.write("\n");
      }
    },
  };
}

// ── Prompt ──────────────────────────────────────────────────

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${cyan("?")} ${bold(question)} ${dim("›")} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await ask(`${question} [${dim(hint)}]`);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

// ── Box / divider ───────────────────────────────────────────

export function divider(char = "─", colorFn = dim): void {
  console.log(colorFn(char.repeat(process.stdout.columns ?? 60)));
}

export function header(title: string): void {
  console.log(`\n  ${bold(cyan(title))}`);
  divider();
}

export function section(title: string): void {
  console.log(`\n  ${bold(title)}`);
}

export function item(label: string, value: string): void {
  console.log(`  ${dim(label + ":")}  ${value}`);
}

export function success(message: string): void {
  console.log(`  ${green("✔")} ${message}`);
}

export function error(message: string): void {
  console.log(`  ${red("✘")} ${message}`);
}

export function warn(message: string): void {
  console.log(`  ${yellow("⚠")} ${message}`);
}

export function info(message: string): void {
  console.log(`  ${cyan("ℹ")} ${message}`);
}

// ── TUI helpers ──────────────────────────────────────────────

let tuiInitialized = false;

export function tuiInit(): void {
  if (!tuiInitialized) {
    process.stdout.write("\x1b[?25l"); // hide cursor
    tuiInitialized = true;
  }
}

export function tuiCleanup(): void {
  if (tuiInitialized) {
    process.stdout.write("\x1b[?25h"); // show cursor
    process.stdout.write("\x1b[0m");   // reset all
    tuiInitialized = false;
  }
}

export function tuiClear(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

export function tuiMoveTo(row: number, col = 0): void {
  process.stdout.write(`\x1b[${row};${col + 1}H`);
}

export function tuiClearLine(): void {
  process.stdout.write("\x1b[K");
}

export function tuiWrite(row: number, col: number, text: string): void {
  tuiMoveTo(row, col);
  tuiClearLine();
  process.stdout.write(text);
}

export function tuiColorRow(
  row: number,
  col: number,
  label: string,
  value: string,
  valueColor = cyan,
): void {
  tuiWrite(row, col, `${dim(label)} ${valueColor(value)}`);
}

// ── Format helpers ──────────────────────────────────────────

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
