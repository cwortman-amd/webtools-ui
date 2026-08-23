/*!
 * Pitch deck narration helpers — full speaker notes for AI / TTS agents.
 * Loaded as ../shared/js/pitch-narration.js from consumer pages/pitch.html.
 */
(function (global) {
  "use strict";

  function stripForSpeech(raw) {
    return String(raw || "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/&[a-zA-Z#0-9]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitChunks(text, maxLen) {
    maxLen = maxLen || 450;
    var paras = String(text || "")
      .split(/\n\n+/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
    var chunks = [];
    paras.forEach(function (p) {
      if (p.length <= maxLen) {
        chunks.push(p);
        return;
      }
      var sentences = p.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [p];
      var buf = "";
      sentences.forEach(function (s) {
        var next = (buf ? buf + " " : "") + s.trim();
        if (next.length > maxLen && buf) {
          chunks.push(buf.trim());
          buf = s.trim();
        } else {
          buf = next;
        }
      });
      if (buf) chunks.push(buf.trim());
    });
    return chunks.length ? chunks : (text ? [text] : []);
  }

  function decodeEntities(s) {
    var el = document.createElement("textarea");
    el.innerHTML = s;
    return el.value;
  }

  function inlineMd(s) {
    return String(s || "")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  }

  function formatNotesHtml(raw) {
    if (!raw || !String(raw).trim()) {
      return '<p class="empty">No speaker notes for this slide.</p>';
    }
    return String(raw)
      .trim()
      .split(/\n\s*\n/)
      .map(function (block) {
        var lines = block.split(/\n/);
        var out = [];
        var buf = [];
        var list = null;
        function flushPara() {
          if (buf.length) {
            out.push("<p>" + inlineMd(buf.join(" ").trim()) + "</p>");
            buf = [];
          }
        }
        function flushList() {
          if (list) {
            out.push(
              "<ul>" +
                list
                  .map(function (i) {
                    return "<li>" + inlineMd(i) + "</li>";
                  })
                  .join("") +
                "</ul>"
            );
            list = null;
          }
        }
        lines.forEach(function (line) {
          var m = line.match(/^\s*-\s+(.*)$/);
          if (m) {
            flushPara();
            list = list || [];
            list.push(m[1].trim());
          } else if (line.trim()) {
            flushList();
            buf.push(line.trim());
          }
        });
        flushPara();
        flushList();
        return out.join("");
      })
      .join("");
  }

  function getSlideNotes(idx) {
    var notes = global.SLIDE_NOTES || {};
    if (notes[idx] != null && String(notes[idx]).trim()) {
      return String(notes[idx]);
    }
    var slides = document.querySelectorAll(".slide");
    var slide = slides[idx];
    if (!slide) return "";
    var aside = slide.querySelector(".speaker-notes, .notes");
    return aside ? aside.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function speakFull(voice, text, opts) {
    opts = opts || {};
    if (!voice || typeof voice.say !== "function") {
      return Promise.resolve({ ok: false, reason: "no voice" });
    }
    var cleaned = stripForSpeech(text);
    if (!cleaned) return Promise.resolve({ ok: false, reason: "empty" });
    var chunks = splitChunks(cleaned, opts.maxChunk || 450);
    var chain = Promise.resolve({ ok: true });
    chunks.forEach(function (chunk) {
      chain = chain.then(function (prev) {
        if (opts.cancelCheck && opts.cancelCheck()) {
          return { ok: false, reason: "cancelled" };
        }
        if (prev && prev.ok === false && prev.reason === "cancelled") return prev;
        return Promise.resolve(voice.say(chunk, opts.sayOpts || {}));
      });
    });
    return chain;
  }

  global.PitchNarration = {
    stripForSpeech: stripForSpeech,
    splitChunks: splitChunks,
    getSlideNotes: getSlideNotes,
    speakFull: speakFull,
    formatNotesHtml: formatNotesHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
