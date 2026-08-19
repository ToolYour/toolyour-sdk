import { describe, expect, it } from "vitest";
import {
  buildEvidenceBlob,
  CONTROL_PLANE_EVIDENCE_SCHEMA,
  mergeGateFromDecision,
} from "../src/mcp/merge-gate.js";

describe("control-plane merge gate", () => {
  const results = [
    {
      checkId: "chk_test",
      status: "pass",
      exitCode: 0,
      fingerprint: "pass",
      summary: "ok",
    },
  ];

  it("passes only when job.state is verified", () => {
    const gate = mergeGateFromDecision({
      state: "verified",
      status: "verified",
      ruleId: "R6",
    });
    expect(gate.pass).toBe(true);
    expect(gate.reason).toMatch(/verified/);
  });

  it("fails on continue / still open", () => {
    const gate = mergeGateFromDecision({
      state: "open",
      status: "continue",
      ruleId: "R5",
      remaining_requirements: ["ac1"],
    });
    expect(gate.pass).toBe(false);
    expect(gate.reason).toMatch(/state=open/);
  });

  it("fails on escalated", () => {
    const gate = mergeGateFromDecision({
      state: "escalated",
      status: "escalated",
      ruleId: "R4",
    });
    expect(gate.pass).toBe(false);
  });

  it("fails on cancelled", () => {
    expect(
      mergeGateFromDecision({ state: "cancelled", status: "cancelled" }).pass
    ).toBe(false);
  });

  it("fails on check_submit error objects", () => {
    const gate = mergeGateFromDecision({
      error: { code: "unauthorized", message: "not enabled" },
    });
    expect(gate.pass).toBe(false);
    expect(gate.reason).toBe("not enabled");
  });

  it("does not treat agent-done speech as a pass", () => {
    const gate = mergeGateFromDecision({
      state: "open",
      status: "continue",
      ok: true,
      summary: "all tests pass, ready to merge",
    });
    expect(gate.pass).toBe(false);
  });

  it("builds a redacted evidence blob without log excerpts", () => {
    const blob = buildEvidenceBlob({
      jobId: "11111111-1111-4111-8111-111111111111",
      decision: {
        state: "verified",
        status: "verified",
        ruleId: "R6",
        specHash: "abc",
        iteration: 2,
        remaining_requirements: [],
      },
      results,
      treeHash: "tree",
      gitSha: "deadbeef",
    });
    expect(blob.schemaVersion).toBe(CONTROL_PLANE_EVIDENCE_SCHEMA);
    expect(blob.mergeGate).toBe("pass");
    expect(blob.results[0]).not.toHaveProperty("logExcerpt");
    expect(JSON.stringify(blob)).not.toMatch(/runnerToken|runnerNonce|submitHmac/);
  });
});
