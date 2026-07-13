"""On-device (CPU) voice service: Piper TTS + whisper.cpp STT.

Canonical, framework-agnostic implementation shared across the **webtools-ui**
consumer dashboards (llm-benchmark, dc-planner, cluster-manager). It powers the
*interactive narration* feature entirely on-device, with **zero network
egress** — a hard requirement for air-gapped / high-security deployments.

- **TTS** is produced by `Piper <https://github.com/rhasspy/piper>`_, a fast
  CPU neural text-to-speech engine. Higher quality than the OS Web Speech
  voices, and fully local.
- **STT** is produced by `whisper.cpp <https://github.com/ggerganov/whisper.cpp>`_,
  a CPU build of OpenAI Whisper. Browser audio (webm/opus) is transcoded to
  16 kHz mono WAV via ``ffmpeg`` before recognition.

Everything degrades gracefully: when a binary or model is missing,
:func:`capabilities` reports it as unavailable and :func:`synthesize` /
:func:`transcribe` raise :class:`VoiceUnavailable`, so the browser falls back
to the built-in Web Speech API (see ``shared/js/voice-local.js``).

Binaries and models are discovered on ``PATH`` or pinned via environment
variables (so an air-gapped site can stage them anywhere):

    PIPER_BIN        piper executable            (default: "piper" on PATH)
    PIPER_VOICE      path to a Piper .onnx voice (the .onnx.json sits beside it)
    WHISPER_BIN      whisper.cpp executable      (default: whisper-cli/main)
    WHISPER_MODEL    path to a ggml/gguf model   (e.g. ggml-base.en.bin)
    FFMPEG_BIN       ffmpeg executable           (default: "ffmpeg" on PATH)

Wiring into a consumer backend
------------------------------
This module is intentionally free of any web-framework dependency. A consumer
HTTP server only needs to (1) parse the JSON body for POSTs and (2) forward the
request to :func:`http_dispatch`, which returns a ``(status, content_type,
body_bytes)`` triple implementing the ``/api/voice/*`` contract:

    GET  /api/voice/capabilities      -> application/json  {ok, tts, stt}
    POST /api/voice/tts   {text}      -> audio/wav
    POST /api/voice/stt   {audio_b64,mime} -> application/json {ok, text}

Example (stdlib http.server)::

    import json, voice_service
    result = voice_service.http_dispatch(self.command, self.path, body)
    if result is not None:
        status, ctype, payload = result
        self.send_response(status); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(payload))); self.end_headers()
        self.wfile.write(payload)

Security notes:
    * No ``shell=True``. Every subprocess uses an argv list.
    * Narration text is fed to Piper on **stdin**, never as an argv token.
    * Inputs are size-capped (:data:`MAX_TTS_CHARS`, :data:`MAX_AUDIO_BYTES`).
    * Work happens in a private temp dir that is always cleaned up.
    * The dispatcher never leaks internal exception detail to the client;
      callers should log :func:`http_dispatch` return codes / their own errors.
"""

from __future__ import annotations

import base64
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Optional, Tuple

# Input caps — keep synthesis/recognition bounded so a single request can't
# tie up a CPU worker indefinitely.
MAX_TTS_CHARS = 2000
MAX_AUDIO_BYTES = 4 * 1024 * 1024  # 4 MiB (~90s of 16k mono once transcoded)
_TTS_TIMEOUT_S = 30
_STT_TIMEOUT_S = 60
_FFMPEG_TIMEOUT_S = 30

# WAV magic ("RIFF....WAVE") — lets us skip ffmpeg when the client already
# uploaded a WAV.
_WAV_MAGIC = b"RIFF"
_WAV_FORMAT = b"WAVE"


class VoiceUnavailable(RuntimeError):
    """Raised when the requested engine (Piper/whisper.cpp) is not installed."""


def _resolve_bin(env_var: str, *candidates: str) -> Optional[str]:
    """Resolve an executable from an env override or a list of PATH names.

    An env override may be an absolute path (used verbatim if it exists and is
    executable) or a bare command name resolved on PATH.
    """
    override = os.environ.get(env_var, "").strip()
    if override:
        p = Path(override)
        if p.is_absolute():
            return str(p) if os.access(p, os.X_OK) else None
        return shutil.which(override)
    for name in candidates:
        found = shutil.which(name)
        if found:
            return found
    return None


def _piper_bin() -> Optional[str]:
    return _resolve_bin("PIPER_BIN", "piper")


def _piper_voice() -> Optional[str]:
    """Return the Piper voice .onnx path if it (and its .json sidecar) exist."""
    voice = os.environ.get("PIPER_VOICE", "").strip() or os.environ.get("PIPER_MODEL", "").strip()
    if not voice:
        return None
    onnx = Path(voice)
    sidecar = Path(str(onnx) + ".json")
    if onnx.is_file() and sidecar.is_file():
        return str(onnx)
    return None


def _whisper_bin() -> Optional[str]:
    return _resolve_bin("WHISPER_BIN", "whisper-cli", "whisper-cpp", "main")


def _whisper_model() -> Optional[str]:
    model = os.environ.get("WHISPER_MODEL", "").strip()
    if model and Path(model).is_file():
        return model
    return None


def _ffmpeg_bin() -> Optional[str]:
    return _resolve_bin("FFMPEG_BIN", "ffmpeg")


def piper_available() -> bool:
    return bool(_piper_bin()) and bool(_piper_voice())


def whisper_available() -> bool:
    return bool(_whisper_bin()) and bool(_whisper_model())


def capabilities() -> Dict[str, object]:
    """Report which on-device engines are usable, for frontend feature-gating."""
    voice = _piper_voice()
    return {
        "tts": {
            "engine": "piper",
            "available": piper_available(),
            "voice": Path(voice).name if voice else None,
        },
        "stt": {
            "engine": "whisper.cpp",
            "available": whisper_available(),
            "model": Path(_whisper_model()).name if _whisper_model() else None,
            "ffmpeg": bool(_ffmpeg_bin()),
        },
    }


def synthesize(text: str) -> bytes:
    """Render ``text`` to WAV bytes with Piper.

    Raises:
        VoiceUnavailable: Piper binary/voice missing.
        ValueError: empty or over-long text.
        RuntimeError: synthesis failed.
    """
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text is required")
    if len(text) > MAX_TTS_CHARS:
        raise ValueError(f"text too long (max {MAX_TTS_CHARS} chars)")
    bin_path = _piper_bin()
    voice = _piper_voice()
    if not bin_path or not voice:
        raise VoiceUnavailable("piper is not installed or PIPER_VOICE is unset")

    workdir = tempfile.mkdtemp(prefix="voice_tts_")
    out_wav = os.path.join(workdir, "out.wav")
    try:
        proc = subprocess.run(
            [bin_path, "--model", voice, "--output_file", out_wav],
            input=text.encode("utf-8"),
            capture_output=True,
            timeout=_TTS_TIMEOUT_S,
            check=False,
        )
        if proc.returncode != 0 or not os.path.isfile(out_wav):
            detail = proc.stderr.decode("utf-8", "replace")[:500]
            raise RuntimeError(f"piper synthesis failed: {detail}")
        with open(out_wav, "rb") as fh:
            return fh.read()
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("piper synthesis timed out") from exc
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _is_wav(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == _WAV_MAGIC and data[8:12] == _WAV_FORMAT


def transcribe(audio: bytes, mime: str = "") -> str:
    """Transcribe ``audio`` bytes to text with whisper.cpp.

    Non-WAV input (e.g. browser webm/opus) is transcoded to 16 kHz mono WAV via
    ffmpeg first.

    Raises:
        VoiceUnavailable: whisper.cpp binary/model missing (or ffmpeg needed
            but absent for non-WAV input).
        ValueError: empty or over-large audio.
        RuntimeError: transcoding/recognition failed.
    """
    if not audio:
        raise ValueError("audio is required")
    if len(audio) > MAX_AUDIO_BYTES:
        raise ValueError(f"audio too large (max {MAX_AUDIO_BYTES} bytes)")
    bin_path = _whisper_bin()
    model = _whisper_model()
    if not bin_path or not model:
        raise VoiceUnavailable("whisper.cpp is not installed or WHISPER_MODEL is unset")

    workdir = tempfile.mkdtemp(prefix="voice_stt_")
    try:
        wav_path = os.path.join(workdir, "audio.wav")
        if _is_wav(audio):
            with open(wav_path, "wb") as fh:
                fh.write(audio)
        else:
            ffmpeg = _ffmpeg_bin()
            if not ffmpeg:
                raise VoiceUnavailable(
                    "ffmpeg is required to decode non-WAV audio but is not installed"
                )
            src_path = os.path.join(workdir, "input.bin")
            with open(src_path, "wb") as fh:
                fh.write(audio)
            ff = subprocess.run(
                [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
                 "-i", src_path, "-ac", "1", "-ar", "16000", "-f", "wav", wav_path],
                capture_output=True,
                timeout=_FFMPEG_TIMEOUT_S,
                check=False,
            )
            if ff.returncode != 0 or not os.path.isfile(wav_path):
                detail = ff.stderr.decode("utf-8", "replace")[:500]
                raise RuntimeError(f"ffmpeg transcode failed: {detail}")

        proc = subprocess.run(
            [bin_path, "--model", model, "--file", wav_path, "--no-timestamps"],
            capture_output=True,
            timeout=_STT_TIMEOUT_S,
            check=False,
        )
        if proc.returncode != 0:
            detail = proc.stderr.decode("utf-8", "replace")[:500]
            raise RuntimeError(f"whisper transcription failed: {detail}")
        return _clean_transcript(proc.stdout.decode("utf-8", "replace"))
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("whisper transcription timed out") from exc
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _clean_transcript(raw: str) -> str:
    """Strip whisper.cpp log noise and blank lines into a single utterance."""
    lines = []
    for line in raw.splitlines():
        s = line.strip()
        if not s:
            continue
        # whisper.cpp occasionally emits bracketed non-speech markers.
        if s in ("[BLANK_AUDIO]", "[ Silence ]", "(silence)"):
            continue
        lines.append(s)
    return " ".join(lines).strip()


# ── Framework-agnostic HTTP contract ────────────────────────────────
# Consumers forward requests here so the `/api/voice/*` contract stays
# identical across every webtools-ui dashboard. Returns None when `path`
# is not a voice route so the caller can continue its own routing.

VOICE_ROUTES = ("/api/voice/capabilities", "/api/voice/tts", "/api/voice/stt")

# (status, content_type, body_bytes)
Response = Tuple[int, str, bytes]


def _json_response(status: int, obj: Dict[str, object]) -> Response:
    return status, "application/json", json.dumps(obj).encode("utf-8")


def http_dispatch(method: str, path: str, body: Optional[Dict[str, object]]) -> Optional[Response]:
    """Route a ``/api/voice/*`` request to the on-device engines.

    Args:
        method: HTTP method ("GET"/"POST").
        path: request path with any query string already stripped.
        body: parsed JSON object for POSTs (``None`` for GET or empty body).

    Returns:
        ``(status, content_type, body_bytes)`` for a handled voice route, or
        ``None`` when ``path`` is not a voice route (caller keeps routing).

    The caller is responsible for authorization (CSRF/token) and for parsing
    the JSON body; this function never raises for expected client errors — it
    maps them to 400/503/500 responses.
    """
    # Only strip a trailing query defensively; callers usually pass a clean path.
    if "?" in path:
        path = path.split("?", 1)[0]
    if path not in VOICE_ROUTES:
        return None

    method = (method or "").upper()
    data = body if isinstance(body, dict) else {}

    if path == "/api/voice/capabilities":
        if method != "GET":
            return _json_response(405, {"ok": False, "error": "method not allowed"})
        try:
            return _json_response(200, {"ok": True, **capabilities()})
        except Exception:  # noqa: BLE001 (degrade to "unavailable")
            return _json_response(200, {
                "ok": True,
                "tts": {"engine": "piper", "available": False},
                "stt": {"engine": "whisper.cpp", "available": False},
            })

    if path == "/api/voice/tts":
        if method != "POST":
            return _json_response(405, {"ok": False, "error": "method not allowed"})
        text = data.get("text")
        try:
            audio = synthesize(text if isinstance(text, str) else "")
        except ValueError as exc:
            return _json_response(400, {"ok": False, "error": str(exc)})
        except VoiceUnavailable:
            return _json_response(503, {"ok": False, "error": "on-device TTS unavailable"})
        except Exception:  # noqa: BLE001 (generic client message; caller logs)
            return _json_response(500, {"ok": False, "error": "TTS failed"})
        return 200, "audio/wav", audio

    if path == "/api/voice/stt":
        if method != "POST":
            return _json_response(405, {"ok": False, "error": "method not allowed"})
        b64 = data.get("audio_b64")
        mime = str(data.get("mime", ""))
        if not isinstance(b64, str) or not b64:
            return _json_response(400, {"ok": False, "error": "audio_b64 is required"})
        try:
            audio = base64.b64decode(b64, validate=True)
        except Exception:  # noqa: BLE001
            return _json_response(400, {"ok": False, "error": "audio_b64 is not valid base64"})
        try:
            text = transcribe(audio, mime)
        except ValueError as exc:
            return _json_response(400, {"ok": False, "error": str(exc)})
        except VoiceUnavailable:
            return _json_response(503, {"ok": False, "error": "on-device STT unavailable"})
        except Exception:  # noqa: BLE001 (generic client message; caller logs)
            return _json_response(500, {"ok": False, "error": "STT failed"})
        return _json_response(200, {"ok": True, "text": text})

    return None  # unreachable given the VOICE_ROUTES guard
