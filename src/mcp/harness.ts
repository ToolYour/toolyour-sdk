import { createMcpHttpSession, type McpHttpClientOptions } from "./session.js";

export type VerifyGate = "pass" | "fail" | "unknown";

export type RemainingFix = {
  rank: number;
  workstream: string;
  severity?: "low" | "medium" | "high";
  title: string;
  actions: string[];
  expectedImpact?: "high" | "medium" | "low";
  source: "finding" | "prioritizedAction";
};

export type VerifyNextAction = {
  id: string;
  label: string;
  workstream?: string;
  severity?: "low" | "medium" | "high";
};

export type VerifyDelta = {
  status?: "improved" | "regressed" | "unchanged" | "unknown";
  remainingFixes?: RemainingFix[];
  nextActions?: VerifyNextAction[];
  gate?: VerifyGate;
  summary?: string[];
  [key: string]: unknown;
};

export type JobReportLike = {
  schemaVersion?: string;
  findings?: Array<{ severity?: string; title?: string; howToFix?: string[] }>;
  scores?: Record<string, { status?: string }>;
  prioritizedActions?: Array<{ action?: string; workstream?: string }>;
  [key: string]: unknown;
};

/**
 * Peel common MCP envelopes to a jobReport object.
 */
export function extractJobReport(payload: unknown): JobReportLike | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.schemaVersion === "toolyour.jobReport@1") {
    return root as JobReportLike;
  }
  if (root.jobReport && typeof root.jobReport === "object") {
    return root.jobReport as JobReportLike;
  }
  if (
    root.execution &&
    typeof root.execution === "object" &&
    (root.execution as Record<string, unknown>).jobReport
  ) {
    return (root.execution as Record<string, unknown>).jobReport as JobReportLike;
  }
  if (root.after !== undefined) {
    return extractJobReport(root.after);
  }
  if (root.result !== undefined) {
    return extractJobReport(root.result);
  }
  if (root.delta && root.after !== undefined) {
    return extractJobReport(root.after);
  }
  return null;
}

export function extractVerifyDelta(payload: unknown): VerifyDelta | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  if (root.delta && typeof root.delta === "object") {
    return root.delta as VerifyDelta;
  }
  return null;
}

/** Local gate when you only have a jobReport (e.g. first solve before verify). */
export function gateFromJobReport(report: JobReportLike | null): VerifyGate {
  if (!report) return "unknown";
  const high = (report.findings || []).some((f) => f.severity === "high");
  const poor = Object.values(report.scores || {}).some((s) => s?.status === "poor");
  if (high || poor) return "fail";
  return "pass";
}

export type ApplyFixesContext = {
  round: number;
  delta: VerifyDelta | null;
  gate: VerifyGate;
  baseline: unknown;
  solveResult: unknown;
  remainingFixes: RemainingFix[];
  nextActions: VerifyNextAction[];
};

export type ApplyFixesResult = {
  /** false → stop looping even if gate is fail */
  continue?: boolean;
  /** merge into next verify/solve input */
  input?: Record<string, unknown>;
};

export type VerifyUntilPassOptions = McpHttpClientOptions & {
  goal: string;
  input?: Record<string, unknown>;
  /** Max plan→solve→verify cycles (default 3). */
  maxRounds?: number;
  /**
   * Host harness hook: apply remainingFixes (edit code, commit, redeploy),
   * then return to re-verify. If omitted, runs one solve (+ verify if baseline
   * already fails) and returns without looping.
   */
  applyFixes?: (
    ctx: ApplyFixesContext
  ) => Promise<ApplyFixesResult | void> | ApplyFixesResult | void;
  /** Skip plan_task (default false). */
  skipPlan?: boolean;
  skillId?: string;
};

export type VerifyUntilPassResult = {
  rounds: number;
  gate: VerifyGate;
  baseline: unknown;
  lastSolve: unknown;
  lastVerify: unknown | null;
  delta: VerifyDelta | null;
  remainingFixes: RemainingFix[];
  nextActions: VerifyNextAction[];
  plan: unknown | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollGetRun(
  session: Awaited<ReturnType<typeof createMcpHttpSession>>,
  runId: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<unknown> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 2_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const body = (await session.callTool("get_run", { runId })) as Record<
      string,
      unknown
    >;
    const status = String(body?.status || "");
    if (status === "completed" || status === "partial" || status === "error") {
      return body;
    }
    await sleep(intervalMs);
  }
  throw new Error(`get_run timed out for runId=${runId}`);
}

async function maybeAwaitAsync(
  session: Awaited<ReturnType<typeof createMcpHttpSession>>,
  body: unknown
): Promise<unknown> {
  if (!body || typeof body !== "object") return body;
  const root = body as Record<string, unknown>;
  if (root.status === "accepted" && typeof root.runId === "string") {
    const polled = await pollGetRun(session, root.runId);
    const result = (polled as Record<string, unknown>)?.result;
    return result ?? polled;
  }
  return body;
}

/**
 * plan_task (optional) → solve_task / run_playbook → verify_task loop until
 * delta.gate === "pass" or maxRounds / applyFixes stops.
 *
 * Does **not** replace the host agent — it only standardizes the ToolYour
 * verify harness contract for CI and thin agents.
 */
export async function verifyUntilPass(
  options: VerifyUntilPassOptions
): Promise<VerifyUntilPassResult> {
  const maxRounds = Math.max(1, options.maxRounds ?? 3);
  const session = await createMcpHttpSession(options);
  let input = { ...(options.input || {}) };
  let plan: unknown | null = null;

  if (!options.skipPlan) {
    plan = await session.callTool("plan_task", {
      goal: options.goal,
      input,
    });
  }

  let lastSolve: unknown = null;
  let lastVerify: unknown | null = null;
  let delta: VerifyDelta | null = null;
  let gate: VerifyGate = "unknown";
  let baseline: unknown = null;
  let remainingFixes: RemainingFix[] = [];
  let nextActions: VerifyNextAction[] = [];
  let rounds = 0;

  for (let round = 1; round <= maxRounds; round++) {
    rounds = round;
    const solveArgs: Record<string, unknown> = {
      goal: options.goal,
      input,
      responseMode: "compact",
    };

    lastSolve = options.skillId
      ? await session.callTool("run_playbook", {
          skillId: options.skillId,
          input,
          responseMode: "compact",
        })
      : await session.callTool("solve_task", solveArgs);

    lastSolve = await maybeAwaitAsync(session, lastSolve);

    if (!baseline) {
      baseline = lastSolve;
      const report = extractJobReport(lastSolve);
      gate = gateFromJobReport(report);
      if (gate === "pass") {
        return {
          rounds,
          gate,
          baseline,
          lastSolve,
          lastVerify: null,
          delta: null,
          remainingFixes: [],
          nextActions: [],
          plan,
        };
      }
    }

    lastVerify = await session.callTool("verify_task", {
      goal: options.goal,
      input,
      baseline,
      responseMode: "compact",
    });
    lastVerify = await maybeAwaitAsync(session, lastVerify);

    delta = extractVerifyDelta(lastVerify);
    gate =
      (delta?.gate as VerifyGate | undefined) ||
      gateFromJobReport(extractJobReport(lastVerify));
    remainingFixes = (delta?.remainingFixes as RemainingFix[]) || [];
    nextActions = (delta?.nextActions as VerifyNextAction[]) || [];

    if (gate === "pass") {
      return {
        rounds,
        gate,
        baseline,
        lastSolve,
        lastVerify,
        delta,
        remainingFixes,
        nextActions,
        plan,
      };
    }

    if (!options.applyFixes || round >= maxRounds) {
      break;
    }

    const applied = await options.applyFixes({
      round,
      delta,
      gate,
      baseline,
      solveResult: lastSolve,
      remainingFixes,
      nextActions,
    });
    if (applied?.continue === false) break;
    if (applied?.input) {
      input = { ...input, ...applied.input };
    }
    // Next round: keep original baseline so verify_task still diffs vs first solve
  }

  return {
    rounds,
    gate,
    baseline,
    lastSolve,
    lastVerify,
    delta,
    remainingFixes,
    nextActions,
    plan,
  };
}

/** One-shot: plan → solve (compact). */
export async function planAndSolve(
  options: McpHttpClientOptions & {
    goal: string;
    input?: Record<string, unknown>;
    skipPlan?: boolean;
  }
): Promise<{ plan: unknown | null; solve: unknown }> {
  const session = await createMcpHttpSession(options);
  let plan: unknown | null = null;
  if (!options.skipPlan) {
    plan = await session.callTool("plan_task", {
      goal: options.goal,
      input: options.input,
    });
  }
  const solve = await session.callTool("solve_task", {
    goal: options.goal,
    input: options.input,
    responseMode: "compact",
  });
  return { plan, solve: await maybeAwaitAsync(session, solve) };
}
