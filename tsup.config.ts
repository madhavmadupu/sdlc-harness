import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: "cjs",
  outDir: "dist",
  clean: true,
  dts: false,
  splitting: false,
  outExtension: () => ({ js: ".cjs" }),
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __SDLC_HARNESS_VERSION__: JSON.stringify(pkg.version),
  },
  noExternal: ["@unblessed/node", "@unblessed/core"],
});
