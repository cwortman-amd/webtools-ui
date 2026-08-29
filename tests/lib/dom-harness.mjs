/**
 * Minimal browser DOM for vm.runInNewContext coverage of shell.js / chat-orb.js.
 */

export function makeElement(tag, id, byId) {
  const listeners = Object.create(null);
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    type: tag === "button" ? "button" : tag === "textarea" ? "textarea" : undefined,
    id: id || "",
    className: "",
    hidden: false,
    href: "",
    src: "",
    value: "",
    checked: false,
    textContent: "",
    innerHTML: "",
    style: {},
    children: [],
    paused: true,
    classList: {
      _c: new Set(),
      add(...xs) {
        xs.forEach((x) => this._c.add(x));
      },
      remove(...xs) {
        xs.forEach((x) => this._c.delete(x));
      },
      toggle(x, force) {
        if (force === true) this._c.add(x);
        else if (force === false) this._c.delete(x);
        else if (this._c.has(x)) this._c.delete(x);
        else this._c.add(x);
      },
      contains(x) {
        return this._c.has(x);
      },
    },
    setAttribute(k, v) {
      this[k] = v;
      if (k === "id") {
        this.id = v;
        if (byId) byId[v] = this;
      }
      if (k === "hidden") this.hidden = v === true || v === "true";
    },
    getAttribute(k) {
      if (k === "data-tab") return this._dataTab ?? null;
      if (k === "data-skin") return this._dataSkin ?? null;
      if (k === "data-mode") return this._dataMode ?? null;
      if (k === "data-src") return this._dataSrc ?? null;
      if (k === "aria-expanded") return this._ariaExpanded ?? "false";
      if (k === "aria-selected") return this._ariaSelected ?? "false";
      if (k === "aria-controls") return this._ariaControls ?? null;
      return this[k] ?? null;
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
    },
    get firstChild() {
      return this.children[0] || null;
    },
    contains() {
      return false;
    },
    querySelector(sel) {
      if (sel === ".material-symbols-outlined") {
        return { textContent: "" };
      }
      if (String(sel).includes("data-tab=")) {
        const m = /data-tab="([^"]+)"/.exec(String(sel));
        if (m && this._dataTab === m[1]) return this;
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, fn) {
      (listeners[type] ||= []).push(fn);
    },
    dispatchEvent(ev) {
      (listeners[ev.type] || []).forEach((fn) => fn(ev));
    },
    focus() {},
    blur() {},
    setSelectionRange() {},
    play() {
      return Promise.resolve();
    },
    pause() {},
    removeAttribute() {},
    cloneNode() {
      return makeElement("span");
    },
    _click() {
      (listeners.click || []).forEach((fn) =>
        fn.call(node, { preventDefault() {}, stopPropagation() {}, target: node })
      );
    },
  };
  if (id) {
    node.id = id;
    byId[id] = node;
  }
  return node;
}

export function registerById(byId, el) {
  if (el && el.id) byId[el.id] = el;
}

export function indexHtmlIds(html, byId) {
  const re = /\bid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    if (byId[id]) continue;
    let tag = "div";
    if (new RegExp(`<textarea[^>]*id="${id}"`).test(html)) tag = "textarea";
    else if (new RegExp(`<input[^>]*id="${id}"`).test(html)) tag = "input";
    else if (new RegExp(`<button[^>]*id="${id}"`).test(html)) tag = "button";
    else if (new RegExp(`<select[^>]*id="${id}"`).test(html)) tag = "select";
    else if (new RegExp(`<pre[^>]*id="${id}"`).test(html)) tag = "pre";
    else if (new RegExp(`<section[^>]*id="${id}"`).test(html)) tag = "section";
    byId[id] = makeElement(tag, id, byId);
  }
}

export function createBrowserSandbox(extra = {}) {
  const byId = Object.create(null);
  const docListeners = Object.create(null);
  const globalListeners = Object.create(null);

  const documentElement = {
    setAttribute() {},
    style: { setProperty() {} },
  };

  const body = {
    classList: {
      _c: new Set(),
      add(...xs) {
        xs.forEach((x) => this._c.add(x));
      },
      remove(...xs) {
        xs.forEach((x) => this._c.delete(x));
      },
      contains(x) {
        return this._c.has(x);
      },
      toggle(x, force) {
        if (force === true) this._c.add(x);
        else if (force === false) this._c.delete(x);
        else if (this._c.has(x)) this._c.delete(x);
        else this._c.add(x);
      },
    },
    setAttribute() {},
    getAttribute(k) {
      return k === "data-theme" ? this._theme || "dark" : null;
    },
    _theme: "dark",
    appendChild(el) {
      if (el && el.id) byId[el.id] = el;
      if (el && el.innerHTML) indexHtmlIds(el.innerHTML, byId);
      return el;
    },
    removeChild() {},
    contains: () => true,
  };

  const document = {
    documentElement,
    body,
    head: { appendChild() {} },
    hidden: false,
    readyState: "complete",
    activeElement: null,
    getElementById(id) {
      return byId[id] || null;
    },
    createElement(tag) {
      const el = makeElement(tag, "", byId);
      el.ownerDocument = document;
      Object.defineProperty(el, "innerHTML", {
        set(html) {
          el._innerHTML = html;
          indexHtmlIds(html, byId);
        },
        get() {
          return el._innerHTML || "";
        },
      });
      return el;
    },
    querySelector(sel) {
      const s = String(sel);
      if (s.includes("skinStylesheet")) return byId.skinStylesheet || null;
      if (s.includes("hero-toolbar .hero-skin-wrap")) return byId.heroSkinWrap || null;
      if (s.includes("sidebar-nav") && s.includes("data-tab=")) {
        if (s.includes("create")) return byId.navCreate || null;
        if (s.includes("search")) return byId.navSearch || null;
      }
      if (s.includes("sidebar-nav")) return byId.sidebarNav || null;
      if (s.includes("#themeToggleSide .util-label")) return byId.themeSideLabel || null;
      return null;
    },
    querySelectorAll(sel) {
      const s = String(sel);
      if (s.includes("hero-skin-option") || s.includes("side-nav-skin-option")) {
        return [byId.skinOpt].filter(Boolean);
      }
      if (s.includes("hero-mode-option") || s.includes("side-nav-mode-option")) {
        return [byId.modeOpt].filter(Boolean);
      }
      if (s.includes("sidebar-nav .nav-btn")) {
        return [byId.navSearch, byId.navCreate].filter(Boolean);
      }
      if (s.includes("tab-panel")) {
        return [byId.panelSearch, byId.panelCreate].filter(Boolean);
      }
      if (s.includes("hero-tabs .tab-btn")) return [];
      if (s.includes("#themeToggleTop") || s.includes("#themeToggleSide") || s.includes("#sideNavThemeBtn")) {
        return [byId.themeToggleTop, byId.themeToggleSide].filter(Boolean);
      }
      if (s.includes("#modeToggleSide") || s.includes("#userModeBtnSide")) {
        return [byId.modeToggleSide].filter(Boolean);
      }
      if (s.includes(".material-symbols-outlined")) return [];
      return [];
    },
    addEventListener(type, fn) {
      (docListeners[type] ||= []).push(fn);
    },
    dispatchEvent(ev) {
      (docListeners[ev.type] || []).forEach((fn) => fn(ev));
      return true;
    },
  };

  const storage = Object.create(null);
  const sandbox = {
    console: { warn() {}, log() {} },
    SHELL_PREFIX: "test",
    localStorage: {
      getItem(k) {
        if (k === "throw") throw new Error("blocked");
        return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
      },
      setItem(k, v) {
        if (k === "throw-set") throw new Error("blocked");
        storage[k] = v;
      },
    },
    location: { search: "?tab=create", hash: "", href: "http://127.0.0.1/pages/index.html" },
    history: { pushState() {}, replaceState() {} },
    URL,
    URLSearchParams,
    CSS: { escape: (s) => s },
    CustomEvent: class {
      constructor(_name, opts) {
        this.detail = opts?.detail;
        this.type = _name;
      }
    },
    Event: class {
      constructor(type, opts) {
        this.type = type;
        this.bubbles = opts?.bubbles;
      }
    },
    setTimeout,
    clearTimeout,
    requestAnimationFrame(fn) {
      fn();
    },
    innerHeight: 800,
    matchMedia(q) {
      return { matches: String(q).includes("coarse") };
    },
    addEventListener(type, fn) {
      (globalListeners[type] ||= []).push(fn);
    },
    document,
    ...extra,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  // Shell fixtures
  byId.skinStylesheet = makeElement("link", "skinStylesheet", byId);
  byId.themeToggleTop = makeElement("button", "themeToggleTop", byId);
  byId.themeToggleSide = makeElement("button", "themeToggleSide", byId);
  byId.themeSideLabel = makeElement("span", "themeSideLabel", byId);
  byId.collapseToggle = makeElement("button", "collapseToggle", byId);
  byId.collapseToggle.querySelector = () => ({ textContent: "" });
  byId.skinMenuBtnTop = makeElement("button", "skinMenuBtnTop", byId);
  byId.skinMenuTop = makeElement("div", "skinMenuTop", byId);
  byId.skinMenuTop.hidden = true;
  byId.skinToggleSide = makeElement("button", "skinToggleSide", byId);
  byId.sideNavSkinList = makeElement("div", "sideNavSkinList", byId);
  byId.modeToggleSide = makeElement("button", "modeToggleSide", byId);
  byId.sideNavModeList = makeElement("div", "sideNavModeList", byId);
  byId.modeLabelSide = makeElement("span", "modeLabelSide", byId);
  byId.heroSkinWrap = makeElement("div", "heroSkinWrap", byId);
  byId.skinOpt = makeElement("button", "skinOpt", byId);
  byId.skinOpt._dataSkin = "amd-teal";
  byId.skinOpt.getAttribute = (k) => (k === "data-skin" ? "amd-teal" : null);
  byId.modeOpt = makeElement("button", "modeOpt", byId);
  byId.modeOpt._dataMode = "advanced";
  byId.modeOpt.getAttribute = (k) => (k === "data-mode" ? "advanced" : null);
  byId.navSearch = makeElement("button", "nav-search", byId);
  byId.navSearch._dataTab = "search";
  byId.navSearch.getAttribute = (k) => (k === "data-tab" ? "search" : null);
  byId.navCreate = makeElement("button", "nav-create", byId);
  byId.navCreate._dataTab = "create";
  byId.navCreate.getAttribute = (k) => (k === "data-tab" ? "create" : null);
  byId.navCreate.classList._c.add("active");
  byId.panelSearch = makeElement("div", "panel-search", byId);
  byId.panelCreate = makeElement("div", "panel-create", byId);
  byId.panelCreate.querySelector = () => null;
  byId.sidebar = makeElement("aside", "sidebar", byId);
  byId.sidebarNav = makeElement("nav", "sidebarNav", byId);
  byId.sidebar.addEventListener = (type, fn) => {
    byId.sidebar._sidebarClick = fn;
  };
  const baseQuerySelector = document.querySelector.bind(document);
  document.querySelector = (sel) => {
    const s = String(sel);
    if (s === ".sidebar") return byId.sidebar;
    if (s.includes("sidebar-nav") && !s.includes("data-tab")) return byId.sidebarNav;
    return baseQuerySelector(sel);
  };

  sandbox._byId = byId;
  sandbox._docListeners = docListeners;
  sandbox._globalListeners = globalListeners;
  sandbox._storage = storage;
  return sandbox;
}
