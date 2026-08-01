# Agent starter — ToolYour MCP capability loop

Minimal Node script: `plan_task` → `solve_task` (compact) using the remote MCP HTTP/SSE surface via SDK helpers where available, or raw JSON-RPC over the documented endpoint.

## Setup

```bash
npm install @toolyour/sdk
export TOOLYOUR_API_KEY=ty_...
```

## Cursor one-liner

```bash
npx tsx -e "import { toolYourMcpServerConfigJson } from '@toolyour/sdk/mcp'; console.log(toolYourMcpServerConfigJson({ apiKey: process.env.TOOLYOUR_API_KEY }));"
```

## First goals (copy into Cursor)

- `SEO audit for https://example.com`
- `ship gate for https://example.com`
- `check open graph tags https://example.com`
- `check security headers for https://example.com`
- Local: `audit this html before deploy` + `input.html`

## Loop

```text
plan_task(goal)           # free
solve_task(goal)          # compact jobReport by default
verify_task(goal, baseline) after edits
```

## Example scripts

- `index.mjs` — Node: initializes Streamable HTTP (`/mcp/http`), runs `plan_task` then `solve_task(compact)`
- `agent_starter.py` — same loop in Python (stdlib only)

```bash
node index.mjs "ship gate for https://example.com"
python agent_starter.py "check security headers for https://example.com"
```

Docs: https://www.toolyour.com/developers/docs/mcp-quickstart  
Playbooks: https://www.toolyour.com/developers/docs/mcp-playbooks
