import { DEFAULT_MCP_URL } from "./config.js";

export type McpHttpClientOptions = {
  apiKey: string;
  /** Streamable HTTP endpoint (default production `/mcp/http`). */
  url?: string;
  fetch?: typeof fetch;
  clientInfo?: { name: string; version: string };
};

export type McpHttpSession = {
  sessionId: string;
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  rawCall: (
    method: string,
    params?: Record<string, unknown>
  ) => Promise<{ sessionId: string; payload: unknown; httpStatus: number }>;
};

function resolveHttpUrl(url?: string): string {
  const base = (url ?? `${DEFAULT_MCP_URL}/http`).replace(/\/$/, "");
  if (base.endsWith("/http")) return base;
  if (base.endsWith("/mcp")) return `${base}/http`;
  return base;
}

function parseRpcBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const dataLine = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
      .pop();
    return dataLine ? JSON.parse(dataLine) : { raw: text.slice(0, 2000) };
  }
}

/** Peel MCP tools/call result content[0].text JSON when present. */
export function parseMcpToolResult(payload: unknown): unknown {
  const root = payload as { result?: { content?: Array<{ text?: string }> } };
  const text = root?.result?.content?.[0]?.text;
  if (typeof text === "string") {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return payload;
}

/**
 * Open a Streamable HTTP MCP session (initialize + tools/call helper).
 * Used by harness helpers and CI scripts.
 */
export async function createMcpHttpSession(
  options: McpHttpClientOptions
): Promise<McpHttpSession> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) throw new Error("apiKey is required");
  const mcpHttp = resolveHttpUrl(options.url);
  const fetchFn = options.fetch ?? fetch;
  let rpcId = 0;
  let sessionId = "";

  async function rawCall(
    method: string,
    params?: Record<string, unknown>
  ): Promise<{ sessionId: string; payload: unknown; httpStatus: number }> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-Api-Key": apiKey,
    };
    if (sessionId) headers["mcp-session-id"] = sessionId;
    const res = await fetchFn(mcpHttp, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcId,
        method,
        params,
      }),
    });
    sessionId = res.headers.get("mcp-session-id") || sessionId;
    const text = await res.text();
    const payload = parseRpcBody(text);
    return { sessionId, payload, httpStatus: res.status };
  }

  const init = await rawCall("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: options.clientInfo ?? {
      name: "@toolyour/sdk",
      version: "0.1.2",
    },
  });
  if (!init.sessionId) {
    throw new Error(
      `MCP initialize failed (HTTP ${init.httpStatus}) — no mcp-session-id`
    );
  }
  sessionId = init.sessionId;

  return {
    get sessionId() {
      return sessionId;
    },
    rawCall,
    async callTool(name: string, args: Record<string, unknown> = {}) {
      const { payload } = await rawCall("tools/call", {
        name,
        arguments: args,
      });
      return parseMcpToolResult(payload);
    },
  };
}
