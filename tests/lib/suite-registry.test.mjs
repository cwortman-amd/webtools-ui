import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadSuite(fetchImpl) {
  const file = path.join(root, "js/suite.js");
  const cards = [];
  const sandbox = {
    console,
    fetch: fetchImpl,
    addEventListener() {},
    location: { hash: "", href: "http://127.0.0.1/pages/index.html" },
    document: {
      readyState: "complete",
      addEventListener() {},
      getElementById(id) {
        if (id === "suite-grid") {
          return {
            innerHTML: "",
            appendChild(el) {
              cards.push(el);
            },
          };
        }
        return {
          innerHTML: "",
          textContent: "",
          classList: { add() {}, remove() {}, toggle() {} },
          addEventListener() {},
          style: {},
          appendChild() {},
        };
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return {
          className: "",
          innerHTML: "",
          textContent: "",
          href: "",
          style: {},
          classList: { add() {}, remove() {} },
          setAttribute() {},
          addEventListener() {},
          appendChild() {},
        };
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return { sandbox, cards };
}

test("suite boot fetches plugins.registry.json", async () => {
  const hits = [];
  try {
    loadSuite((url) => {
      hits.push(String(url));
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plugins: [
              { id: "llm-benchmark", name: "LLM Benchmark", localUrl: "../llm-benchmark/" },
            ],
          }),
      });
    });
  } catch (err) {
    hits.push("load-error:" + err.message);
  }
  await new Promise((r) => setTimeout(r, 40));
  assert.ok(
    hits.some((u) => String(u).includes("plugins.registry.json")),
    `expected registry fetch, got ${JSON.stringify(hits)}`
  );
});
