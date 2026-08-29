import assert from "node:assert/strict";
import test from "node:test";
import {
  positionContextMenu,
  renderContextMenuItemHtml,
  createContextMenu,
  createAnchoredMenu,
} from "../../js/context-menu.mjs";

function stubWindow(width, height) {
  const prev = global.window;
  global.window = { innerWidth: width, innerHeight: height };
  return function restore() {
    global.window = prev;
  };
}

function stubMenu(width, height) {
  return {
    style: { left: "", top: "" },
    getBoundingClientRect: () => ({ width: width, height: height }),
  };
}

test("positionContextMenu anchors top-left at cursor by default", () => {
  const restore = stubWindow(800, 600);
  const el = stubMenu(120, 80);
  positionContextMenu(el, 100, 200);
  assert.equal(el.style.left, "100px");
  assert.equal(el.style.top, "200px");
  restore();
});

test("positionContextMenu flips left when overflowing right edge", () => {
  const restore = stubWindow(200, 800);
  const el = stubMenu(120, 80);
  positionContextMenu(el, 150, 200);
  assert.equal(el.style.left, "30px");
  assert.equal(el.style.top, "200px");
  restore();
});

test("positionContextMenu flips up when overflowing bottom edge", () => {
  const restore = stubWindow(800, 250);
  const el = stubMenu(120, 80);
  positionContextMenu(el, 100, 220);
  assert.equal(el.style.left, "100px");
  assert.equal(el.style.top, "140px");
  restore();
});

test("positionContextMenu clamps to viewport padding", () => {
  const restore = stubWindow(200, 200);
  const el = stubMenu(120, 80);
  positionContextMenu(el, 2, 2);
  assert.equal(el.style.left, "4px");
  assert.equal(el.style.top, "4px");
  restore();
});

test("renderContextMenuItemHtml emits icon column and danger row", () => {
  const html = renderContextMenuItemHtml({
    action: "delete",
    label: "Delete <item>",
    icon: "delete",
    danger: true,
  });
  assert.match(html, /wt-context-menu-item--danger/);
  assert.match(html, /wt-context-menu-item__icon/);
  assert.match(html, /Delete &lt;item&gt;/);
  assert.match(html, /data-action="delete"/);
});

function installDomStub() {
  const listeners = [];
  const bodyChildren = [];
  const body = {
    contains(node) {
      return bodyChildren.includes(node) || node === body;
    },
    appendChild(node) {
      bodyChildren.push(node);
      node.parentNode = body;
      return node;
    },
  };
  function makeEl(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      innerHTML: "",
      hidden: true,
      style: { left: "", top: "" },
      disabled: false,
      attrs: {},
      children: [],
      parentNode: null,
      __wtAnchoredBound: false,
      firstElementChild: null,
      className: "",
      getAttribute(name) {
        return this.attrs[name] || null;
      },
      setAttribute(name, value) {
        this.attrs[name] = String(value);
      },
      closest(sel) {
        if (sel === ".wt-context-menu-item" || sel === "[data-action]") return this.attrs["data-action"] ? this : null;
        return null;
      },
      contains(node) {
        return node === this || this.children.includes(node);
      },
      addEventListener(type, fn) {
        listeners.push({ type, fn, el: this });
      },
      removeEventListener() {},
      remove() {
        const i = bodyChildren.indexOf(this);
        if (i >= 0) bodyChildren.splice(i, 1);
        this.parentNode = null;
      },
      getBoundingClientRect() {
        return { left: 10, bottom: 40, width: 80, height: 40 };
      },
    };
    return el;
  }
  const prevDoc = global.document;
  const prevWin = global.window;
  global.window = { innerWidth: 800, innerHeight: 600 };
  global.document = {
    body,
    createElement(tag) {
      const el = makeEl(tag);
      Object.defineProperty(el, "innerHTML", {
        get() {
          return this._html || "";
        },
        set(html) {
          this._html = html;
          if (html) {
            const child = makeEl("div");
            child.className = "wt-context-menu";
            child.getBoundingClientRect = () => ({ left: 0, top: 0, width: 120, height: 80 });
            this.firstElementChild = child;
            this.children = [child];
          }
        },
      });
      return el;
    },
    addEventListener(type, fn) {
      listeners.push({ type, fn, el: "doc" });
    },
  };
  return {
    listeners,
    bodyChildren,
    restore() {
      global.document = prevDoc;
      global.window = prevWin;
    },
  };
}

test("createContextMenu show injects markup and hide removes it", () => {
  const stub = installDomStub();
  const menu = createContextMenu({
    renderHtml: () => '<div class="wt-context-menu" role="menu"><button data-action="cut">Cut</button></div>',
    onAction: () => {},
  });
  menu.show(20, 30, { id: "s1" });
  assert.equal(stub.bodyChildren.length, 1);
  menu.hide();
  assert.equal(stub.bodyChildren.length, 0);
  stub.restore();
});

test("createAnchoredMenu toggles persistent hidden menu", () => {
  const stub = installDomStub();
  const persistent = global.document.createElement("div");
  persistent.hidden = true;
  persistent.contains = () => false;
  const trigger = global.document.createElement("button");
  const api = createAnchoredMenu({
    triggerEl: trigger,
    menuEl: persistent,
    bindTrigger: false,
    position: "css",
  });
  api.show({ triggerEl: trigger });
  assert.equal(persistent.hidden, false);
  assert.equal(trigger.attrs["aria-expanded"], "true");
  api.hide();
  assert.equal(persistent.hidden, true);
  stub.restore();
});
