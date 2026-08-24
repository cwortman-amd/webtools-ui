"""Boundary contract tests for scripts/voice_service.py HTTP dispatch."""

from __future__ import annotations

import json
import unittest

import voice_service


class VoiceServiceBoundaryTests(unittest.TestCase):
    def test_capabilities_json_shape(self):
        caps = voice_service.capabilities()
        self.assertIn("tts", caps)
        self.assertIn("stt", caps)

    def test_http_dispatch_capabilities_route(self):
        result = voice_service.http_dispatch("GET", "/api/voice/capabilities", None)
        self.assertIsNotNone(result)
        status, ctype, body = result
        self.assertEqual(status, 200)
        self.assertEqual(ctype, "application/json")
        payload = json.loads(body.decode("utf-8"))
        self.assertTrue(payload["ok"])

    def test_http_dispatch_unknown_route(self):
        self.assertIsNone(voice_service.http_dispatch("GET", "/api/other", None))

    def test_tts_rejects_empty_text(self):
        result = voice_service.http_dispatch("POST", "/api/voice/tts", {"text": ""})
        self.assertIsNotNone(result)
        status, _, _ = result
        self.assertGreaterEqual(status, 400)


if __name__ == "__main__":
    unittest.main()
