import { spawn as spawnProc } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMcpHttpSession, type McpHttpClientOptions } from "./session.js";

export type CheckRunStatus = "pass" | "fail" | "error";

export type FrozenCheck = {
  id: string;
  command: string;
};

export type CheckRunResult = {
  checkId: string;
  status: CheckRunStatus;
  exitCode: number;
  fingerprint: string;
  summary: string;
  logExcerpt: string;
};

const UNSAFE_COMMAND = /[|&;<>`$()\n\r]/;

export function splitCommand(command: string): string[] {
  return String(command)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function assertSafeCommand(command: string): void {
  const c = String(command || "");
  if (!c.trim()) throw new Error("empty check command");
  if (UNSAFE_COMMAND.test(c)) {
    throw new Error(`refusing unsafe check command: ${c}`);
  }
}

export function failingNames(output: string): string[] {
  const names = new Set<string>();
  const re = /^\s*not ok \d+ - (.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) names.add(m[1].trim());
  const xRe = /^\s*✖\s+(.+)$/gm;
  while ((m = xRe.exec(output))) names.add(m[1].trim());
  return [...names].sort();
}

export function fingerprint(
  status: CheckRunStatus,
  exitCode: number,
  output: string
): string {
  if (status === "pass") return "pass";
  const names = failingNames(output);
  if (names.length) {
    return createHash("sha256").update(names.join("\n"), "utf8").digest("hex");
  }
  return createHash("sha256")
    .update(`exit:${exitCode}\n${String(output).slice(-800)}`, "utf8")
    .digest("hex");
}

export function treeHash(
  root: string,
  dirs: string[] = ["lib", "tests"]
): string {
  const lines: string[] = [];
  for (const dir of dirs) {
    const p = path.join(root, dir);
    if (!fs.existsSync(p)) continue;
    for (const name of fs.readdirSync(p).sort()) {
      const fp = path.join(p, name);
      if (!fs.statSync(fp).isFile()) continue;
      const rel = `${dir}/${name}`.replace(/\\/g, "/");
      const hex = createHash("sha256").update(fs.readFileSync(fp)).digest("hex");
      lines.push(`${rel} ${hex}`);
    }
  }
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export function excerpt(text: string): string {
  const s = String(text || "");
  if (s.length <= 8192) return s;
  return `${s.slice(0, 4096)}\n…\n${s.slice(-4096)}`;
}

function assertionSnippet(output: string): string {
  const m = String(output || "").match(
    /Expected values[\s\S]{0,240}|error: \|-[\s\S]{0,200}/
  );
  return (m ? m[0] : "").replace(/\s+/g, " ").trim().slice(0, 400);
}

/** HMAC over jobId + treeHash + result identities. Keep in sync with toolyour-mcp secrets.submitHmacHex. */
export function submitHmacHex(
  runnerToken: string,
  jobId: string,
  nonce: string,
  treeHashValue: string,
  results: Array<{
    checkId: string;
    status: string;
    exitCode: number;
    fingerprint: string;
  }>
): string {
  const body = JSON.stringify({
    jobId,
    treeHash: treeHashValue,
    results: results.map((r) => ({
      checkId: r.checkId,
      status: r.status,
      exitCode: r.exitCode,
      fingerprint: r.fingerprint,
    })),
  });
  return createHmac("sha256", runnerToken)
    .update(`${nonce}\n${body}`, "utf8")
    .digest("hex");
}

export function readRunnerNonce(
  jobId: string,
  secretsDir =
    process.env.CONTROL_PLANE_SECRETS_DIR ||
    path.join(os.tmpdir(), "toolyour-control-plane")
): string {
  const noncePath = path.join(secretsDir, `${jobId}.nonce`);
  if (!fs.existsSync(noncePath)) {
    throw new Error(`host-only nonce missing: ${noncePath}`);
  }
  const nonce = fs.readFileSync(noncePath, "utf8").trim();
  if (!nonce) throw new Error(`empty nonce: ${noncePath}`);
  return nonce;
}

export async function runCommand(
  command: string,
  cwd: string,
  timeoutMs = 30_000
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  assertSafeCommand(command);
  const parts = splitCommand(command);
  return new Promise((resolve) => {
    const child = spawnProc(parts[0], parts.slice(1), {
      cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        exitCode: 124,
        stdout,
        stderr: `${stderr}\ntimeout after ${timeoutMs}ms`,
      });
    }, timeoutMs);
    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ exitCode: 127, stdout, stderr: String(e.message || e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

async function gitShaIfRepoRoot(cwd: string): Promise<string | undefined> {
  const gitOut = (args: string[]) =>
    new Promise<string>((resolve) => {
      const git = spawnProc("git", args, {
        cwd,
        shell: false,
        windowsHide: true,
      });
      let out = "";
      git.stdout?.on("data", (d: Buffer) => {
        out += d.toString();
      });
      git.on("close", (code) => resolve(code === 0 ? out.trim() : ""));
      git.on("error", () => resolve(""));
    });
  const top = await gitOut(["rev-parse", "--show-toplevel"]);
  const head = await gitOut(["rev-parse", "HEAD"]);
  const sameRepo =
    Boolean(top) &&
    path.resolve(top).toLowerCase() === path.resolve(cwd).toLowerCase();
  return sameRepo && head ? head : undefined;
}

export type RunFrozenChecksOptions = {
  jobId: string;
  cwd: string;
  apiKey: string;
  mcpUrl?: string;
  runnerToken: string;
  secretsDir?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
  writeDecision?: boolean;
};

export type RunFrozenChecksResult = {
  decision: unknown;
  results: CheckRunResult[];
  treeHash: string;
  gitSha?: string;
};

/**
 * Fetch frozen checks from job_status, run only those commands, submit signed results.
 * Does not invent pass/fail. Host owns the shell.
 */
export async function runFrozenChecks(
  options: RunFrozenChecksOptions
): Promise<RunFrozenChecksResult> {
  const jobId = options.jobId.trim();
  const cwd = path.resolve(options.cwd);
  const runnerToken = options.runnerToken.trim();
  if (!jobId) throw new Error("jobId is required");
  if (runnerToken.length < 16) {
    throw new Error("CONTROL_PLANE_RUNNER_TOKEN is required (16+ chars)");
  }

  const sessionOpts: McpHttpClientOptions = {
    apiKey: options.apiKey,
    url: options.mcpUrl,
    fetch: options.fetch,
    clientInfo: { name: "toolyour-check-run", version: "0.2.1" },
  };
  const session = await createMcpHttpSession(sessionOpts);
  const status = (await session.callTool("job_status", { jobId })) as {
    error?: { message?: string };
    checks?: FrozenCheck[];
  };
  if (status?.error) {
    throw new Error(status.error.message || JSON.stringify(status.error));
  }
  const checks = status.checks || [];
  if (!checks.length) {
    throw new Error("job_status returned no frozen checks");
  }

  const timeoutMs = options.timeoutMs ?? 30_000;
  const results: CheckRunResult[] = [];
  for (const check of checks) {
    assertSafeCommand(check.command);
    const ran = await runCommand(check.command, cwd, timeoutMs);
    const output = `${ran.stdout}\n${ran.stderr}`;
    let statusName: CheckRunStatus = "error";
    if (ran.exitCode === 0) statusName = "pass";
    else if (ran.exitCode === 127) statusName = "error";
    else statusName = "fail";
    const names = failingNames(output);
    const snippet = assertionSnippet(output);
    const summary =
      [names.join(", "), snippet].filter(Boolean).join(" — ").slice(0, 500) ||
      (
        output.trim().split("\n").filter(Boolean).slice(-1)[0] ||
        `exit ${ran.exitCode}`
      ).slice(0, 500);
    results.push({
      checkId: check.id,
      status: statusName,
      exitCode: ran.exitCode,
      fingerprint: fingerprint(statusName, ran.exitCode, output),
      summary,
      logExcerpt: excerpt(output),
    });
  }

  const nonce = readRunnerNonce(jobId, options.secretsDir);
  const tree = treeHash(cwd);
  const git = await gitShaIfRepoRoot(cwd);
  const submitHmac = submitHmacHex(
    runnerToken,
    jobId,
    nonce,
    tree,
    results
  );

  const decision = await session.callTool("check_submit", {
    jobId,
    runnerToken,
    runnerNonce: nonce,
    submitHmac,
    gitSha: git,
    treeHash: tree,
    results,
  });

  if (options.writeDecision !== false) {
    fs.writeFileSync(
      path.join(cwd, "DECISION.json"),
      `${JSON.stringify(decision, null, 2)}\n`,
      "utf8"
    );
  }

  return { decision, results, treeHash: tree, gitSha: git };
}
