#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { runFrozenChecks } from "../mcp/check-run.js";
import { mergeGateFromDecision } from "../mcp/merge-gate.js";

function arg(name: string, fallback = ""): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const jobId = arg("--job");
  const cwd = path.resolve(arg("--cwd", process.cwd()));
  const evidenceDir = arg("--evidence-dir", cwd);
  const requireVerified = hasFlag("--require-verified");
  if (!jobId) {
    console.error(
      "usage: toolyour-check-run --job <id> [--cwd <repo>] [--evidence-dir <dir>] [--require-verified]"
    );
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
    evidenceDir,
  });
  console.log(JSON.stringify(decision, null, 2));
  const rec = decision as { error?: unknown };
  if (rec?.error) process.exit(1);
  if (requireVerified) {
    const gate = mergeGateFromDecision(decision);
    if (!gate.pass) {
      console.error(gate.reason);
      process.exit(1);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
