import { describe, expect, it, vi } from "vitest";
import {
  extractJobReport,
  gateFromJobReport,
  extractVerifyDelta,
  verifyUntilPass,
} from "../src/mcp/harness.js";
import { parseMcpToolResult } from "../src/mcp/session.js";

describe("MCP harness helpers", () => {
  it("parseMcpToolResult peels content text JSON", () => {
    const body = parseMcpToolResult({
      result: { content: [{ type: "text", text: '{"status":"plan","free":true}' }] },
    });
    expect(body).toEqual({ status: "plan", free: true });
  });

  it("extractJobReport peels execution.jobReport", () => {
    const report = {
      schemaVersion: "toolyour.jobReport@1",
      findings: [],
      scores: {},
    };
    expect(
      extractJobReport({
        status: "completed",
        execution: { jobReport: report },
      })
    ).toEqual(report);
  });

  it("gateFromJobReport fails on high findings", () => {
    expect(
      gateFromJobReport({
        findings: [{ severity: "high", title: "CSP" }],
        scores: {},
      })
    ).toBe("fail");
    expect(
      gateFromJobReport({
        findings: [{ severity: "low", title: "nit" }],
        scores: { overall: { status: "good" } },
      })
    ).toBe("pass");
  });

  it("extractVerifyDelta reads delta.gate", () => {
    expect(
      extractVerifyDelta({
        status: "verified",
        delta: { gate: "pass", remainingFixes: [] },
      })?.gate
    ).toBe("pass");
  });

  it("verifyUntilPass returns pass on clean solve", async () => {
    let call = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as {
        method?: string;
        params?: { name?: string };
      };
      call += 1;
      if (body.method === "initialize") {
        return new Response("{}", {
          status: 200,
          headers: { "mcp-session-id": "sess-1" },
        });
      }
      const name = body.params?.name;
      let text = "{}";
      if (name === "plan_task") {
        text = JSON.stringify({ status: "plan", free: true });
      } else if (name === "solve_task") {
        text = JSON.stringify({
          status: "completed",
          execution: {
            jobReport: {
              schemaVersion: "toolyour.jobReport@1",
              findings: [],
              scores: { overall: { status: "good", value: 90, label: "o" } },
              prioritizedActions: [],
            },
          },
        });
      }
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: call,
          result: { content: [{ type: "text", text }] },
        }),
        { status: 200, headers: { "mcp-session-id": "sess-1" } }
      );
    });

    const result = await verifyUntilPass({
      apiKey: "ty_test",
      goal: "ship gate for https://example.com",
      input: { url: "https://example.com" },
      fetch: fetchMock as unknown as typeof fetch,
      maxRounds: 2,
    });

    expect(result.gate).toBe("pass");
    expect(result.rounds).toBe(1);
    expect(result.lastVerify).toBeNull();
  });

  it("verifyUntilPass loops with applyFixes until pass", async () => {
    let solveN = 0;
    let verifyN = 0;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}")) as {
        method?: string;
        params?: { name?: string };
      };
      if (body.method === "initialize") {
        return new Response("{}", {
          status: 200,
          headers: { "mcp-session-id": "sess-2" },
        });
      }
      const name = body.params?.name;
      let text = "{}";
      if (name === "plan_task") {
        text = JSON.stringify({ status: "plan", free: true });
      } else if (name === "solve_task") {
        solveN += 1;
        const failReport = {
          schemaVersion: "toolyour.jobReport@1",
          findings: [
            {
              severity: "high",
              title: "Missing CSP",
              howToFix: ["Add CSP"],
            },
          ],
          scores: { overall: { status: "poor", value: 20, label: "o" } },
          prioritizedActions: [],
        };
        const passReport = {
          schemaVersion: "toolyour.jobReport@1",
          findings: [],
          scores: { overall: { status: "good", value: 90, label: "o" } },
          prioritizedActions: [],
        };
        text = JSON.stringify({
          status: "completed",
          execution: { jobReport: solveN === 1 ? failReport : passReport },
        });
      } else if (name === "verify_task") {
        verifyN += 1;
        text = JSON.stringify({
          status: "verified",
          delta: {
            status: verifyN === 1 ? "unchanged" : "improved",
            gate: verifyN === 1 ? "fail" : "pass",
            remainingFixes:
              verifyN === 1
                ? [
                    {
                      rank: 1,
                      workstream: "security",
                      title: "Missing CSP",
                      actions: ["Add CSP"],
                      source: "finding",
                    },
                  ]
                : [],
            nextActions:
              verifyN === 1
                ? [{ id: "fix-csp", label: "Add Content-Security-Policy" }]
                : [],
          },
          after: {
            execution: {
              jobReport: {
                schemaVersion: "toolyour.jobReport@1",
                findings: verifyN === 1 ? [{ severity: "high", title: "Missing CSP" }] : [],
                scores: {
                  overall: {
                    status: verifyN === 1 ? "poor" : "good",
                    value: verifyN === 1 ? 20 : 90,
                    label: "o",
                  },
                },
              },
            },
          },
        });
      }
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { content: [{ type: "text", text }] },
        }),
        { status: 200, headers: { "mcp-session-id": "sess-2" } }
      );
    });

    let applied = 0;
    const result = await verifyUntilPass({
      apiKey: "ty_test",
      goal: "ship gate for https://example.com",
      input: { url: "https://example.com" },
      fetch: fetchMock as unknown as typeof fetch,
      maxRounds: 3,
      applyFixes: async (ctx) => {
        applied += 1;
        expect(ctx.remainingFixes.length).toBeGreaterThan(0);
        return { continue: true };
      },
    });

    expect(applied).toBe(1);
    expect(result.rounds).toBe(2);
    expect(result.gate).toBe("pass");
  });
});
