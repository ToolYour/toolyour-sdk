import { createToolYourClient } from "../client.js";
import type { InvokeInput, InvokeOptions, ToolYourClientOptions } from "../types.js";
import { OPERATIONS, type OperationId } from "../generated/routes.js";

/**
 * Map REST operationId → MCP tool name (camelCase gateway tool id).
 * MCP manifest uses camelCase operationIds from OpenAPI.
 */
export function mapOperationToMcpToolName(operationId: OperationId): string {
  if (!operationId.includes("_")) return operationId;
  return operationId
    .split("_")
    .map((part, i) =>
      i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join("");
}

/**
 * Invoke a tool by MCP-style name using the REST API (same quota as MCP).
 * Prefer this in Node scripts; use toolYourMcpServerConfig for Cursor/Claude.
 */
export async function invokeMcpTool<T = unknown>(
  toolName: string,
  input: InvokeInput = {},
  clientOptions: ToolYourClientOptions,
  invokeOptions?: InvokeOptions
): Promise<T> {
  const client = createToolYourClient(clientOptions);

  const operationId =
    (Object.keys(OPERATIONS) as OperationId[]).find(
      (id) => mapOperationToMcpToolName(id) === toolName
    ) ?? (toolName as OperationId);

  return client.invoke<T>(operationId, input, invokeOptions);
}

export { toolYourMcpServerConfig, toolYourMcpServerConfigJson, DEFAULT_MCP_URL } from "./config.js";
