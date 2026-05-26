import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
  dts: true,
  splitting: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __SDLC_HARNESS_VERSION__: JSON.stringify(pkg.version),
  },
});
