import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/mcp/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
  },
  {
    entry: { "cli/check-run": "src/cli/check-run.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    banner: { js: "#!/usr/bin/env node" },
  },
]);
