/**
 * Minimal agent loop: plan_task → solve_task (compact) over Streamable HTTP MCP.
 *
 *   TOOLYOUR_API_KEY=ty_... node index.mjs "SEO audit for https://example.com"
 *
 * Prefer Cursor/Claude with toolYourMcpServerConfigJson for day-to-day use.
 */
import { toolYourMcpServerConfigJson } from "@toolyour/sdk/mcp";

const apiKey = process.env.TOOLYOUR_API_KEY;
const goal = process.argv.slice(2).join(" ") || "SEO audit for https://example.com";
const mcpHttp =
  process.env.TOOLYOUR_MCP_HTTP_URL || "https://api.toolyour.com/mcp/http";

if (!apiKey) {
  console.error("Set TOOLYOUR_API_KEY");
  process.exit(1);
}

console.log("=== Cursor mcp.json snippet ===");
console.log(toolYourMcpServerConfigJson({ apiKey }));

async function mcpCall(sessionId, name, args, id) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "X-Api-Key": apiKey,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(mcpHttp, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  const nextSession = res.headers.get("mcp-session-id") || sessionId;
  const text = await res.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    // SSE: take last data: JSON line
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
      .pop();
    payload = dataLine ? JSON.parse(dataLine) : { raw: text };
  }
  return { sessionId: nextSession, payload, ok: res.ok, status: res.status };
}

async function initialize() {
  const res = await fetch(mcpHttp, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "toolyour-agent-starter", version: "0.1.0" },
      },
    }),
  });
  const sessionId = res.headers.get("mcp-session-id");
  await res.text();
  if (!sessionId) {
    throw new Error(`MCP initialize failed (${res.status}) — no mcp-session-id`);
  }
  return sessionId;
}

function printToolResult(label, payload) {
  const content = payload?.result?.content;
  const text =
    Array.isArray(content) && content[0]?.text
      ? content[0].text
      : JSON.stringify(payload, null, 2);
  console.log(`\n=== ${label} ===`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 4000));
  }
}

const sessionId = await initialize();
const plan = await mcpCall(sessionId, "plan_task", { goal }, 1);
printToolResult("plan_task (free)", plan.payload);

const solve = await mcpCall(
  plan.sessionId,
  "solve_task",
  { goal, responseMode: "compact" },
  2
);
printToolResult("solve_task (compact)", solve.payload);

console.log(
  "\nNext: apply fixes in your harness, then verify_task(goal, { baseline: previousReport })."
);
console.log(
  "Async: solve_task/verify_task({ async: true }) → get_run(runId) → read resultStatus (not only status)."
);
console.log("Docs: https://www.toolyour.com/developers/docs/mcp-playbooks");
