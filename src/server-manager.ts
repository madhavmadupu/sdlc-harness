import { spawn, execSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { accessSync, constants } from "node:fs";
import { createServer } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

export interface ServerHandle {
  url: string;
  stop: () => Promise<void>;
}

export class ServerManager {
  private child: ChildProcess | null = null;
  private managed = false;

  async start(): Promise<ServerHandle> {
    const url = await this.findOrStart();
    return { url, stop: () => this.stop() };
  }

  private async findOrStart(): Promise<string> {
    // Check common ports for an existing server
    for (const port of [4096, 4097, 4098, 4099, 4100]) {
      const url = `http://127.0.0.1:${port}`;
      try {
        const res = await fetch(`${url}/global/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const data = await res.json() as { healthy?: boolean };
          if (data.healthy === true) {
            console.error(`Using existing opencode server at ${url}`);
            this.managed = false;
            return url;
          }
        }
      } catch {
        // Not running on this port
      }
    }

    // No existing server — start our own
    const port = await this.findAvailablePort();
    await this.spawn(port);
    return `http://127.0.0.1:${port}`;
  }

  private async findAvailablePort(): Promise<number> {
    for (let port = 4096; port <= 4196; port++) {
      const available = await new Promise<boolean>((resolvePromise) => {
        const server = createServer();
        server.on("error", () => resolvePromise(false));
        server.listen(port, "127.0.0.1", () => {
          server.close();
          resolvePromise(true);
        });
      });
      if (available) return port;
    }
    throw new Error("No available port found in range 4096-4196");
  }

  private async spawn(port: number): Promise<void> {
    const binary = this.findBinary();
    if (!binary) {
      throw new Error(
        "opencode not found.\n" +
        "  Install: npm install -g opencode-ai\n" +
        "  (It should install automatically when you install sdlc-harness)"
      );
    }

    const proc = spawn(binary, ["serve", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });
    this.child = proc;
    this.managed = true;

    let stderrOutput = "";
    proc.stdout?.on("data", () => {}); // drain stdout
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString("utf8");
    });

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/global/health`, {
          signal: AbortSignal.timeout(1000),
        });
        if (res.ok) {
          const data = await res.json() as { healthy?: boolean };
          if (data.healthy === true) {
            console.error(`Started opencode server on port ${port}`);
            return;
          }
        }
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // Timed out — clean up and throw
    await this.stop();
    throw new Error(
      `opencode server did not become healthy within 30s.\n${stderrOutput.slice(-1000)}`
    );
  }

  private findBinary(): string | null {
    // 1. Check PATH (covers global install and npx environments)
    try {
      const which = process.platform === "win32" ? "where" : "which";
      const result = execSync(`${which} opencode`, {
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
      if (result) return result.split("\n")[0];
    } catch {}

    // 2. Resolve from dependency tree (covers when opencode-ai is a dep)
    try {
      const pkgPath = _require.resolve("opencode-ai/package.json");
      const binPath = resolve(dirname(pkgPath), "bin", "opencode.exe");
      accessSync(binPath, constants.R_OK);
      return binPath;
    } catch {}

    return null;
  }

  private async stop(): Promise<void> {
    if (!this.managed || !this.child) return;
    return new Promise<void>((resolvePromise) => {
      const timeout = setTimeout(() => {
        try {
          this.child?.kill("SIGKILL");
        } catch {}
        resolvePromise();
      }, 5000);
      this.child!.on("exit", () => {
        clearTimeout(timeout);
        resolvePromise();
      });

      try {
        this.child?.kill("SIGTERM");
      } catch {
        clearTimeout(timeout);
        resolvePromise();
      }
    });
  }

  setupCleanup(): void {
    const handler = () => this.stop();
    process.on("SIGINT", handler);
    process.on("SIGTERM", handler);
    process.on("exit", () => {
      if (this.managed && this.child) {
        try {
          this.child.kill("SIGTERM");
        } catch {}
      }
    });
  }
}
