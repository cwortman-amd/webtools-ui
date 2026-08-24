"""Boundary contract tests for python/webtools_mcp/host.py.

Must fail if initialize / tools/list / tools/call JSON-RPC shapes drift.
"""

from __future__ import annotations

import io
import json
import sys
import unittest
import urllib.error
from unittest.mock import patch

from python.webtools_mcp.host import (
    McpHost,
    McpTool,
    _http_dispatch,
    proxy_stdio,
    run_stdio,
)
from python.webtools_mcp import host as host_mod


def _echo(params: dict) -> dict:
    return {"ok": True, "echo": params.get("query", "")}


def _host(**kwargs) -> McpHost:
    return McpHost(
        {"name": "test-host", "version": "0.0.1"},
        [
            McpTool(
                name="demo.echo",
                description="echo",
                input_schema={"type": "object"},
                handler=_echo,
                extension="demo",
            )
        ],
        **kwargs,
    )


class McpHostBoundaryTests(unittest.TestCase):
    def test_initialize_handshake(self):
        out = _host().handle_message(
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}
        )
        self.assertEqual(out["id"], 1)
        self.assertEqual(out["result"]["protocolVersion"], "2024-11-05")

    def test_tools_list_and_call_happy_path(self):
        host = _host()
        listed = host.handle_message(
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        )
        names = [t["name"] for t in listed["result"]["tools"]]
        self.assertIn("demo.echo", names)
        self.assertIn("annotations", listed["result"]["tools"][0])

        called = host.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": "demo.echo", "arguments": {"query": "ping"}},
            }
        )
        payload = json.loads(called["result"]["content"][0]["text"])
        self.assertTrue(payload["ok"])
        self.assertFalse(called["result"]["isError"])

    def test_unknown_tool_rejected(self):
        out = _host().handle_message(
            {
                "jsonrpc": "2.0",
                "id": 4,
                "method": "tools/call",
                "params": {"name": "missing.tool", "arguments": {}},
            }
        )
        self.assertTrue(out["result"]["isError"])

    def test_duplicate_tool_rejected(self):
        tool = McpTool("dup", "d", {}, _echo)
        with self.assertRaises(ValueError):
            McpHost({"name": "x"}, [tool, tool])

    def test_register_from_manifest_adds_tools(self):
        host = McpHost({"name": "empty"}, [])
        added = host.register_from_manifest(
            {
                "registrations": {
                    "mcp": {
                        "tools": [
                            {
                                "name": "catalog.list",
                                "description": "list",
                                "inputSchema": {"type": "object"},
                            }
                        ]
                    }
                }
            },
            handlers={"catalog.list": lambda p: {"n": len(p)}},
        )
        self.assertEqual(added, ["catalog.list"])
        out = host.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 20,
                "method": "tools/call",
                "params": {"name": "catalog.list", "arguments": {"a": 1}},
            }
        )
        payload = json.loads(out["result"]["content"][0]["text"])
        self.assertEqual(payload["n"], 1)

    def test_register_from_manifest_reads_contributes_mcp_tools(self):
        host = McpHost({"name": "empty"}, [])
        added = host.register_from_manifest(
            {
                "contributes": {
                    "mcp": {
                        "tools": [
                            {
                                "name": "ext.ping",
                                "description": "ping",
                                "input_schema": {"type": "object"},
                            }
                        ]
                    }
                }
            },
            handlers={"ext.ping": lambda p: {"pong": True}},
        )
        self.assertEqual(added, ["ext.ping"])
        out = host.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 22,
                "method": "tools/call",
                "params": {"name": "ext.ping", "arguments": {}},
            }
        )
        payload = json.loads(out["result"]["content"][0]["text"])
        self.assertTrue(payload["pong"])

    def test_register_from_manifest_skips_nameless_and_rejects_dupes(self):
        host = McpHost({"name": "empty"}, [])
        host.register_from_manifest({"tools": ["skip-me", {"description": "no-name"}, {"name": "once"}]})
        with self.assertRaises(ValueError):
            host.register_from_manifest({"tools": [{"name": "once"}]})
        missing = host.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 21,
                "method": "tools/call",
                "params": {"name": "once", "arguments": {}},
            }
        )
        self.assertTrue(missing["result"]["isError"])

    def test_list_entry_extra_without_extension(self):
        tool = McpTool("plain", "p", {}, _echo, extra={"audience": "ops"})
        entry = tool.list_entry()
        self.assertEqual(entry["annotations"]["audience"], "ops")

    def test_list_entry_default_schema_when_empty(self):
        tool = McpTool("empty", "e", {}, _echo)
        entry = tool.list_entry()
        self.assertEqual(entry["inputSchema"]["type"], "object")
        self.assertTrue(entry["inputSchema"]["additionalProperties"])

    def test_get_map_and_native_dispatch(self):
        host = _host()
        mapped = host.handle_message(
            {"jsonrpc": "2.0", "id": 5, "method": "get_map"}
        )
        self.assertIn("demo.echo", mapped["result"]["mcp_tools"])
        native = host.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 6,
                "method": "demo.echo",
                "params": {"query": "n"},
            }
        )
        self.assertEqual(native["result"]["echo"], "n")

    def test_notifications_return_none(self):
        host = _host()
        self.assertIsNone(
            host.handle_message({"jsonrpc": "2.0", "method": "notifications/initialized"})
        )
        self.assertIsNone(
            host.handle_message({"jsonrpc": "2.0", "method": "initialized"})
        )
        self.assertIsNone(
            host.handle_message({"jsonrpc": "2.0", "method": "notifications/cancelled"})
        )

    def test_invalid_request_and_jsonrpc_errors(self):
        host = _host()
        bad = host.handle_message("not-an-object")
        self.assertEqual(bad["error"]["code"], -32600)

        missing = host.handle_message(
            {"jsonrpc": "2.0", "id": 7, "method": "nope.tool"}
        )
        self.assertEqual(missing["error"]["code"], -32601)

        def boom_value(_p):
            raise ValueError("bad args")

        def boom_key(_p):
            raise KeyError("missing")

        def boom_runtime(_p):
            raise RuntimeError("explode")

        host2 = McpHost(
            {"name": "err"},
            [
                McpTool("t.val", "v", {}, boom_value),
                McpTool("t.key", "k", {}, boom_key),
                McpTool("t.run", "r", {}, boom_runtime),
            ],
        )
        self.assertEqual(
            host2.handle_message({"jsonrpc": "2.0", "id": 8, "method": "t.val"})["error"]["code"],
            -32602,
        )
        # KeyError is a LookupError, so it maps to method-not-found (-32601).
        self.assertEqual(
            host2.handle_message({"jsonrpc": "2.0", "id": 9, "method": "t.key"})["error"]["code"],
            -32601,
        )
        self.assertEqual(
            host2.handle_message({"jsonrpc": "2.0", "id": 10, "method": "t.run"})["error"]["code"],
            -32603,
        )

    def test_notification_dispatch_failure_is_swallowed(self):
        def boom(_p):
            raise RuntimeError("notify-fail")

        host = McpHost({"name": "n"}, [McpTool("noisy", "n", {}, boom)])
        self.assertIsNone(
            host.handle_message({"jsonrpc": "2.0", "method": "noisy", "params": {}})
        )

    def test_run_stdio_parse_error_and_request(self):
        host = _host()
        stdin = io.StringIO(
            "\n{not json}\n"
            + json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"})
            + "\n"
            + json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
            + "\n"
        )
        stdout = io.StringIO()
        with patch.object(sys, "stdin", stdin), patch.object(sys, "stdout", stdout):
            self.assertEqual(run_stdio(host), 0)
        lines = [json.loads(line) for line in stdout.getvalue().splitlines() if line.strip()]
        self.assertEqual(lines[0]["error"]["code"], -32700)
        self.assertEqual(lines[1]["result"]["protocolVersion"], "2024-11-05")

    def test_http_dispatch_paths(self):
        class _Resp:
            def __init__(self, body: str):
                self._body = body.encode("utf-8")

            def read(self):
                return self._body

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        with patch.object(host_mod.urllib.request, "urlopen", return_value=_Resp("")):
            self.assertIsNone(_http_dispatch("http://127.0.0.1:9", "initialize", {}))

        with patch.object(
            host_mod.urllib.request,
            "urlopen",
            return_value=_Resp(json.dumps({"error": {"code": 1, "message": "nope"}})),
        ):
            with self.assertRaises(RuntimeError):
                _http_dispatch("http://127.0.0.1:9", "initialize", {})

        with patch.object(
            host_mod.urllib.request,
            "urlopen",
            return_value=_Resp(json.dumps({"result": {"ok": True}})),
        ):
            self.assertEqual(_http_dispatch("http://127.0.0.1:9", "initialize", {}), {"ok": True})

        with patch.object(
            host_mod.urllib.request,
            "urlopen",
            side_effect=urllib.error.URLError("down"),
        ):
            with self.assertRaises(RuntimeError):
                _http_dispatch("http://127.0.0.1:9", "initialize", {})

    def test_http_proxy_host_list_and_initialize(self):
        proxy = host_mod._HttpProxyHost("http://127.0.0.1:9", {"name": "proxy", "version": "1"})

        with patch.object(
            host_mod,
            "_http_dispatch",
            return_value={"tools": [{"name": "remote.tool"}]},
        ):
            listed = proxy.list_tools()
            self.assertEqual(listed["tools"][0]["name"], "remote.tool")

        with patch.object(
            host_mod,
            "_http_dispatch",
            return_value={"mcp_tools": ["alpha"]},
        ):
            listed = proxy.list_tools()
            self.assertEqual(listed["tools"][0]["name"], "alpha")

        with patch.object(host_mod, "_http_dispatch", return_value={"nope": True}):
            with self.assertRaises(RuntimeError):
                proxy.list_tools()

        with patch.object(
            host_mod,
            "_http_dispatch",
            return_value={"protocolVersion": "x", "serverInfo": {"name": "r"}},
        ):
            init = proxy.initialize({})
            self.assertEqual(init["protocolVersion"], "x")

        with patch.object(host_mod, "_http_dispatch", side_effect=RuntimeError("down")):
            init = proxy.initialize({})
            self.assertEqual(init["protocolVersion"], "2024-11-05")

        with patch.object(host_mod, "_http_dispatch", return_value={"ok": True}):
            init = proxy.initialize({})
            self.assertEqual(init["protocolVersion"], "2024-11-05")

        with patch.object(host_mod, "_http_dispatch", return_value={"ok": 1}) as disp:
            self.assertEqual(proxy.dispatch("get_map", {}), {"ok": 1})
            self.assertEqual(disp.call_args[0][1], "get_map")
            self.assertEqual(proxy.dispatch("demo.echo", {"q": 1}), {"ok": 1})

    def test_proxy_stdio_wires_http_host(self):
        with patch.object(host_mod, "run_stdio", return_value=7) as run:
            self.assertEqual(proxy_stdio("http://127.0.0.1:9"), 7)
            self.assertIsInstance(run.call_args[0][0], host_mod._HttpProxyHost)


if __name__ == "__main__":
    unittest.main()
