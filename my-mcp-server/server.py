# Tutorial-style MCP server (Python, FastMCP).
# Serves streamable HTTP on http://127.0.0.1:8001/mcp
#
# Run:     python server.py        (keep the window open while using it)
# Try it:  curl -X POST http://127.0.0.1:8001/mcp -H "Content-Type: application/json" \
#            -H "Accept: application/json, text/event-stream" \
#            -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
#
# Register with Claude Code (corrected version of the earlier attempt —
# --transport is one word):
#   claude mcp add -s user --transport http my-mcp-server http://localhost:8001/mcp

from fastmcp import FastMCP

mcp = FastMCP(name="my-mcp-server")


@mcp.tool
def add(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b


@mcp.tool
def greet(name: str) -> str:
    """Return a friendly greeting for the given name."""
    return f"Hello, {name}!"


if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8001)
