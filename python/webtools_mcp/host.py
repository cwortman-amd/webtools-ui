"""Generic MCP JSON-RPC 2.0 host (stdio + in-process).

Implements the 2024-11-05 handshake (initialize, tools/list, tools/call)
plus native method dispatch by tool name. Product-specific handlers are
injected as ``McpTool`` records — this module must not import a consumer.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

PROTOCOL_VERSION = "2024-11-05"


@dataclass
class McpTool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]
    extension: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def list_entry(self) -> dict[str, Any]:
        entry: dict[str, Any] = {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema or {"type": "object", "additionalProperties": True},
        }
        if self.extension:
            entry["annotations"] = {"title": self.extension, **self.extra}
        elif self.extra:
            entry["annotations"] = dict(self.extra)
        return entry


class McpHost:
    def __init__(
        self,
        server_info: dict[str, Any],
        tools: list[McpTool],
        *,
        protocol_version: str = PROTOCOL_VERSION,
    ) -> None:
        self.server_info = server_info
        self.protocol_version = protocol_version
        self._tools: Dict[str, McpTool] = {}
        for tool in tools:
            if tool.name in self._tools:
                raise ValueError(f"duplicate MCP tool: {tool.name}")
            self._tools[tool.name] = tool

    def tool_names(self) -> list[str]:
        return list(self._tools)

    def capability_map(self) -> dict[str, Any]:
        by_ext: dict[str, list[str]] = {}
        for tool in self._tools.values():
            by_ext.setdefault(tool.extension or "workbench", []).append(tool.name)
        return {
            "server": self.server_info.get("name"),
            "mcp_tools": self.tool_names(),
            "extensions": by_ext,
            "serverInfo": self.server_info,
        }

    def list_tools(self) -> dict[str, Any]:
        return {"tools": [t.list_entry() for t in self._tools.values()]}

    def dispatch(self, method: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if method == "get_map":
            return self.capability_map()
        tool = self._tools.get(method)
        if tool is None:
            raise LookupError(f"unknown tool: {method}")
        return tool.handler(params)

    def initialize(self, _params: dict[str, Any] | None = None) -> dict[str, Any]:
        return {
            "protocolVersion": self.protocol_version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": self.server_info,
        }

    def tools_call(self, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
        try:
            result = self.dispatch(name, arguments or {})
            return {
                "content": [{"type": "text", "text": json.dumps(result, indent=2, default=str)}],
                "isError": False,
            }
        except Exception as exc:
            return {
                "content": [{"type": "text", "text": f"error: {exc}"}],
                "isError": True,
            }

    def handle_message(self, req: Any) -> dict[str, Any] | None:
        if not isinstance(req, dict):
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32600, "message": "invalid request"},
            }
        method = req.get("method") or ""
        params = req.get("params") if isinstance(req.get("params"), dict) else {}
        rid = req.get("id")

        if method == "initialize":
            return {"jsonrpc": "2.0", "id": rid, "result": self.initialize(params)}
        if method in {"notifications/initialized", "initialized", "notifications/cancelled"}:
            return None
        if method == "tools/list":
            return {"jsonrpc": "2.0", "id": rid, "result": self.list_tools()}
        if method == "tools/call":
            name = str(params.get("name") or "")
            arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
            return {"jsonrpc": "2.0", "id": rid, "result": self.tools_call(name, arguments)}

        if rid is None:
            try:
                self.dispatch(method, params)
            except Exception as exc:
                print(f"[webtools-mcp] notification {method!r} raised: {exc}", file=sys.stderr, flush=True)
            return None

        try:
            return {"jsonrpc": "2.0", "id": rid, "result": self.dispatch(method, params)}
        except LookupError as exc:
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": str(exc)}}
        except (ValueError, KeyError) as exc:
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32602, "message": str(exc)}}
        except Exception as exc:
            return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32603, "message": str(exc)}}


def run_stdio(host: McpHost) -> int:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": f"parse error: {exc}"},
            }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
            continue
        resp = host.handle_message(req)
        if resp is not None:
            sys.stdout.write(json.dumps(resp, default=str) + "\n")
            sys.stdout.flush()
    return 0


def _http_dispatch(api_base: str, method: str, params: dict[str, Any]) -> Any:
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    req = urllib.request.Request(
        api_base.rstrip("/") + "/mcp",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"HTTP transport failed for {api_base}/mcp: {exc}") from exc
    if not body.strip():
        return None
    parsed = json.loads(body)
    if "error" in parsed:
        raise RuntimeError(f"server returned error: {parsed['error']}")
    return parsed.get("result")


class _HttpProxyHost(McpHost):
    """Stdio front-end that forwards every dispatch to a live ``POST /mcp``."""

    def __init__(self, api_base: str, server_info: dict[str, Any]) -> None:
        super().__init__(server_info, tools=[])
        self.api_base = api_base

    def dispatch(self, method: str, params: dict[str, Any] | None = None) -> Any:
        params = params or {}
        if method == "get_map":
            return _http_dispatch(self.api_base, "get_map", params)
        return _http_dispatch(self.api_base, method, params)

    def list_tools(self) -> dict[str, Any]:
        result = _http_dispatch(self.api_base, "tools/list", {})
        if isinstance(result, dict) and "tools" in result:
            return result
        names = (result or {}).get("mcp_tools") if isinstance(result, dict) else None
        if names:
            return {
                "tools": [
                    {
                        "name": n,
                        "description": n,
                        "inputSchema": {"type": "object", "additionalProperties": True},
                    }
                    for n in names
                ]
            }
        raise RuntimeError("remote /mcp did not return tools/list")

    def initialize(self, params: dict[str, Any] | None = None) -> dict[str, Any]:
        try:
            remote = _http_dispatch(self.api_base, "initialize", params or {})
            if isinstance(remote, dict) and remote.get("protocolVersion"):
                return remote
        except Exception:
            pass
        return super().initialize(params)


def proxy_stdio(api_base: str, server_info: Optional[dict[str, Any]] = None) -> int:
    info = server_info or {"name": "webtools-mcp-proxy", "version": "1.0.0"}
    return run_stdio(_HttpProxyHost(api_base, info))
