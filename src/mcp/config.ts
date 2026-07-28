export const DEFAULT_MCP_URL = "https://api.toolyour.com/mcp";

export interface McpServerConfigOptions {
  apiKey: string;
  /** Remote MCP HTTP endpoint (default: production) */
  url?: string;
  /** Label shown in MCP client UI */
  name?: string;
}

/**
 * Cursor / Claude Desktop remote MCP server block.
 * Paste into mcp.json or use with @modelcontextprotocol/sdk transports.
 */
export function toolYourMcpServerConfig(options: McpServerConfigOptions) {
  const url = options.url ?? DEFAULT_MCP_URL;
  return {
    mcpServers: {
      toolyour: {
        url,
        headers: {
          "X-Api-Key": options.apiKey,
        },
        ...(options.name ? { name: options.name } : {}),
      },
    },
  } as const;
}

/** JSON string for mcp.json (pretty-printed). */
export function toolYourMcpServerConfigJson(options: McpServerConfigOptions): string {
  return `${JSON.stringify(toolYourMcpServerConfig(options), null, 2)}\n`;
}
