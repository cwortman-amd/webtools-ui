"""T4 MCP JSON-RPC host for webtools-ui consumers.

Transport and handshake live here. Product plugins and sidebar extensions
register tools; they do not each ship an MCP server.
"""

from .host import McpHost, McpTool, PROTOCOL_VERSION, proxy_stdio, run_stdio

__all__ = ["McpHost", "McpTool", "PROTOCOL_VERSION", "proxy_stdio", "run_stdio"]
