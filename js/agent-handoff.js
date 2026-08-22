/*!
 * webtools-ui/js/agent-handoff.js
 *
 * AG-5 structured context packets for cross-app navigation (?agent_ctx=).
 * Size-capped base64url JSON; decode on the receiving app (e.g. KE portal).
 */
(function (global) {
  "use strict";

  var MAX_BYTES = 4096;

  function toBase64Url(str) {
    var b64;
    try {
      b64 = btoa(unescape(encodeURIComponent(str)));
    } catch (_) {
      b64 = btoa(str);
    }
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(token) {
    var b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    try {
      return decodeURIComponent(escape(atob(b64)));
    } catch (_) {
      return atob(b64);
    }
  }

  function encode(packet) {
    if (!packet || typeof packet !== "object") return "";
    var json = JSON.stringify(packet);
    if (json.length > MAX_BYTES) {
      packet = Object.assign({}, packet, {
        summary: String(packet.summary || packet.question || "").slice(0, 480),
        truncated: true,
      });
      json = JSON.stringify(packet);
    }
    if (json.length > MAX_BYTES) {
      json = JSON.stringify({
        product: packet.product || "",
        summary: String(packet.summary || "").slice(0, 200),
        truncated: true,
      });
    }
    return toBase64Url(json);
  }

  function decode(token) {
    if (!token) return null;
    try {
      return JSON.parse(fromBase64Url(token));
    } catch (_) {
      return null;
    }
  }

  function attachToUrl(href, packet) {
    if (!href || !packet) return href;
    var token = encode(packet);
    if (!token) return href;
    try {
      var url = new URL(href, global.location && global.location.href ? global.location.href : undefined);
      url.searchParams.set("agent_ctx", token);
      return url.pathname + url.search + url.hash;
    } catch (_) {
      var sep = href.indexOf("?") >= 0 ? "&" : "?";
      return href + sep + "agent_ctx=" + encodeURIComponent(token);
    }
  }

  function buildPacket(opts) {
    opts = opts || {};
    return {
      v: 1,
      product: opts.product || "",
      question: String(opts.question || "").slice(0, 500),
      summary: String(opts.summary || "").slice(0, 800),
      intent: opts.intent || "learn",
      ts: Date.now(),
    };
  }

  global.AgentHandoff = {
    encode: encode,
    decode: decode,
    attachToUrl: attachToUrl,
    buildPacket: buildPacket,
    MAX_BYTES: MAX_BYTES,
  };
})(typeof window !== "undefined" ? window : globalThis);
