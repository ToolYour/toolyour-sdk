export const CONTROL_PLANE_EVIDENCE_SCHEMA =
  "toolyour.controlPlaneEvidence@1" as const;

export type MergeGateResult = {
  pass: boolean;
  state: string;
  status: string;
  ruleId?: string;
  reason: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  const rec = asRecord(error);
  if (typeof rec.message === "string" && rec.message.trim()) {
    return rec.message.trim();
  }
  return "check_submit error";
}

/**
 * Merge fails unless the durable job is verified.
 * Agent speech, continue, escalated, and cancelled are not a pass.
 */
export function mergeGateFromDecision(decision: unknown): MergeGateResult {
  const rec = asRecord(decision);
  if (rec.error) {
    return {
      pass: false,
      state: "error",
      status: "error",
      reason: errorMessage(rec.error),
    };
  }
  const last = asRecord(rec.lastDecision);
  const state = String(rec.state || "").trim();
  const status = String(rec.status || last.status || "").trim();
  const ruleIdRaw = String(rec.ruleId || last.ruleId || "").trim();
  const ruleId = ruleIdRaw || undefined;
  if (state === "verified") {
    return {
      pass: true,
      state,
      status: status || "verified",
      ruleId,
      reason: "job.state is verified",
    };
  }
  return {
    pass: false,
    state: state || "unknown",
    status: status || "unknown",
    ruleId,
    reason: `merge gate requires job.state=verified (got state=${state || "unknown"} status=${status || "unknown"})`,
  };
}

export type EvidenceCheckResult = {
  checkId: string;
  status: string;
  exitCode: number;
  fingerprint: string;
  summary: string;
};

export type ControlPlaneEvidence = {
  schemaVersion: typeof CONTROL_PLANE_EVIDENCE_SCHEMA;
  jobId: string;
  state: string;
  status: string;
  ruleId: string | null;
  specHash: string | null;
  iteration: number | null;
  gitSha: string | null;
  treeHash: string;
  remaining_requirements: unknown;
  requires_human: boolean;
  mergeGate: "pass" | "fail";
  results: EvidenceCheckResult[];
};

export function buildEvidenceBlob(input: {
  jobId: string;
  decision: unknown;
  results: EvidenceCheckResult[];
  treeHash: string;
  gitSha?: string;
}): ControlPlaneEvidence {
  const rec = asRecord(input.decision);
  const last = asRecord(rec.lastDecision);
  const gate = mergeGateFromDecision(input.decision);
  const iteration = rec.iteration ?? last.iteration;
  return {
    schemaVersion: CONTROL_PLANE_EVIDENCE_SCHEMA,
    jobId: input.jobId,
    state: gate.state,
    status: gate.status,
    ruleId: gate.ruleId || null,
    specHash: typeof rec.specHash === "string" ? rec.specHash : null,
    iteration: typeof iteration === "number" ? iteration : null,
    gitSha:
      input.gitSha ||
      (typeof rec.gitSha === "string" ? rec.gitSha : null) ||
      (typeof last.gitSha === "string" ? last.gitSha : null),
    treeHash: input.treeHash,
    remaining_requirements:
      rec.remaining_requirements ?? last.remaining_requirements ?? [],
    requires_human:
      rec.requires_human === true || last.requires_human === true,
    mergeGate: gate.pass ? "pass" : "fail",
    results: input.results.map((r) => ({
      checkId: r.checkId,
      status: r.status,
      exitCode: r.exitCode,
      fingerprint: r.fingerprint,
      summary: String(r.summary || "").slice(0, 500),
    })),
  };
}
