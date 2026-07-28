# Cursor — ToolYour remote MCP

1. Create an API key at [toolyour.com/dashboard](https://www.toolyour.com/dashboard).

2. Add to Cursor MCP settings (`mcp.json`):

```json
{
  "mcpServers": {
    "toolyour": {
      "url": "https://api.toolyour.com/mcp",
      "headers": {
        "X-Api-Key": "ty_YOUR_KEY_HERE"
      }
    }
  }
}
```

Or generate config from the SDK:

```bash
npx tsx -e "import { toolYourMcpServerConfigJson } from '@toolyour/sdk/mcp'; console.log(toolYourMcpServerConfigJson({ apiKey: process.env.TOOLYOUR_API_KEY }));"
```

3. Docs: [MCP quickstart](https://www.toolyour.com/developers/docs/mcp-quickstart)

**Note:** MCP exposes API-backed tools only. Browser-only tools remain on [toolyour.com](https://www.toolyour.com).
