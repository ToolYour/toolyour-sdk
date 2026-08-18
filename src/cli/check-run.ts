#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { runFrozenChecks } from "../mcp/check-run.js";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

async function main(): Promise<void> {
  const jobId = arg("--job");
  const cwd = path.resolve(arg("--cwd", process.cwd()));
  if (!jobId) {
    console.error("usage: toolyour-check-run --job <id> [--cwd <repo>]");
    process.exit(2);
  }
  const apiKey =
    process.env.TOOLYOUR_API_KEY ||
    process.env.MCP_API_KEY ||
    process.env.TY_API_KEY ||
    "";
  const runnerToken = String(process.env.CONTROL_PLANE_RUNNER_TOKEN || "").trim();
  const mcpUrl = (
    process.env.MCP_URL || "http://127.0.0.1:3090/mcp/http"
  ).replace(/\/$/, "");
  const secretsDir =
    process.env.CONTROL_PLANE_SECRETS_DIR ||
    path.join(os.tmpdir(), "toolyour-control-plane");

  const { decision } = await runFrozenChecks({
    jobId,
    cwd,
    apiKey,
    mcpUrl,
    runnerToken,
    secretsDir,
  });
  console.log(JSON.stringify(decision, null, 2));
  const rec = decision as { error?: unknown; status?: string };
  if (rec?.error) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
