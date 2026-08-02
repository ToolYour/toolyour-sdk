"""
Minimal Python agent loop sketch for ToolYour MCP (Streamable HTTP).

  set TOOLYOUR_API_KEY=ty_...
  python agent_starter.py "SEO audit for https://example.com"

Prefer Cursor/Claude MCP config for interactive use; this script is a 50-line starter.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request

API_KEY = os.environ.get("TOOLYOUR_API_KEY")
MCP_HTTP = os.environ.get("TOOLYOUR_MCP_HTTP_URL", "https://api.toolyour.com/mcp/http")
GOAL = " ".join(sys.argv[1:]) or "SEO audit for https://example.com"


def rpc(method: str, params: dict, req_id: int, session_id: str | None = None) -> tuple[str | None, dict]:
    body = json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}).encode()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "X-Api-Key": API_KEY or "",
    }
    if session_id:
        headers["mcp-session-id"] = session_id
    req = urllib.request.Request(MCP_HTTP, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as res:
        next_session = res.headers.get("mcp-session-id") or session_id
        text = res.read().decode()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        lines = [ln[5:].strip() for ln in text.splitlines() if ln.startswith("data:")]
        payload = json.loads(lines[-1]) if lines else {"raw": text}
    return next_session, payload


def main() -> None:
    if not API_KEY:
        raise SystemExit("Set TOOLYOUR_API_KEY")

    session, _ = rpc(
        "initialize",
        {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "toolyour-agent-starter-py", "version": "0.1.0"},
        },
        0,
    )
    if not session:
        raise SystemExit("MCP initialize failed — no mcp-session-id")

    session, plan = rpc("tools/call", {"name": "plan_task", "arguments": {"goal": GOAL}}, 1, session)
    print("=== plan_task ===")
    print(json.dumps(plan, indent=2)[:3000])

    session, solve = rpc(
        "tools/call",
        {"name": "solve_task", "arguments": {"goal": GOAL, "responseMode": "compact"}},
        2,
        session,
    )
    print("=== solve_task (compact) ===")
    print(json.dumps(solve, indent=2)[:4000])
    print("\nNext: verify_task after you apply fixes.")
    print("Async: solve_task/verify_task(async=True) → get_run → read resultStatus.")


if __name__ == "__main__":
    main()
