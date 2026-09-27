// A small HTML parser and selector engine that runs the page readers in Node on saved pages, with the browser's rules for void elements, raw text, <p> and <li>.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title"]);
const CLOSES_P = new Set(["address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "main", "menu", "nav", "ol", "p", "pre", "section", "table", "ul"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", middot: "\u00b7", ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", bull: "\u2022", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", rsquo: "\u2019", lsquo: "\u2018", rdquo: "\u201d", ldquo: "\u201c", times: "\u00d7", euro: "\u20ac", pound: "\u00a3" };

export function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return Object.prototype.hasOwnProperty.call(ENTITIES, e.toLowerCase()) ? ENTITIES[e.toLowerCase()] : m;
  });
}

class Node {
  constructor(type) { this.nodeType = type; this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
  get textContent() { return this.childNodes.map(c => c.textContent).join(""); }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n.nodeType === 9; }
}

class Text extends Node {
  constructor(text) { super(3); this.data = text; }
  get textContent() { return this.data; }
  get nodeValue() { return this.data; }
}

class Element extends Node {
  constructor(name, attrs) { super(1); this.localName = name; this.attrs = attrs; }
  get tagName() { return this.localName.toUpperCase(); }
  get nodeName() { return this.tagName; }
  get id() { return this.attrs.id || ""; }
  get className() { return this.attrs.class || ""; }
  get classList() { const list = this.className.split(/\s+/).filter(Boolean); return { contains: c => list.includes(c), length: list.length }; }
  get children() { return this.childNodes.filter(c => c.nodeType === 1); }
  get innerText() { return this.textContent; }
  get href() { return this.attrs.href != null ? this.attrs.href : undefined; }
  get content() { return this.attrs.content; }
  get value() { return this.attrs.value != null ? this.attrs.value : ""; }
  get previousElementSibling() { const s = this.parentNode ? this.parentNode.children : []; const i = s.indexOf(this); return i > 0 ? s[i - 1] : null; }
  get nextElementSibling() { const s = this.parentNode ? this.parentNode.children : []; const i = s.indexOf(this); return i >= 0 && i < s.length - 1 ? s[i + 1] : null; }
  getAttribute(n) { n = n.toLowerCase(); return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; }
  hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n.toLowerCase()); }
  setAttribute(n, v) { this.attrs[n.toLowerCase()] = String(v); }
  removeAttribute(n) { delete this.attrs[n.toLowerCase()]; }
  remove() { if (!this.parentNode) return; const s = this.parentNode.childNodes; s.splice(s.indexOf(this), 1); this.parentNode = null; }
  matches(sel) { return parseGroup(sel).some(chain => matchChain(this, chain)); }
  closest(sel) { const g = parseGroup(sel); let n = this; while (n && n.nodeType === 1) { if (g.some(c => matchChain(n, c))) return n; n = n.parentNode; } return null; }
  querySelectorAll(sel) { const g = parseGroup(sel); const out = []; walk(this, el => { if (g.some(c => matchChain(el, c))) out.push(el); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementsByTagName(t) { return this.querySelectorAll(t); }
}

class Document extends Node {
  constructor() { super(9); }
  get documentElement() { return this.childNodes.find(c => c.nodeType === 1) || null; }
  get body() { return this.querySelector("body"); }
  get head() { return this.querySelector("head"); }
  get title() { const t = this.querySelector("title"); return t ? t.textContent.trim() : ""; }
  querySelectorAll(sel) { return Element.prototype.querySelectorAll.call(this, sel); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  getElementById(id) { return this.querySelector("#" + id.replace(/([^\w-])/g, "\\$1")); }
}

function walk(root, fn) {
  for (const c of root.childNodes) { if (c.nodeType === 1) { fn(c); walk(c, fn); } }
}

function append(parent, child) { child.parentNode = parent; parent.childNodes.push(child); }

function parseAttrs(src) {
  const attrs = {};
  const re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(attrs, name)) continue;
    attrs[name] = decode(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : "");
  }
  return attrs;
}

export function parseHTML(html) {
  const doc = new Document();
  const stack = [doc];
  const top = () => stack[stack.length - 1];
  const open = name => { for (let i = stack.length - 1; i > 0; i--) if (stack[i].localName === name) return i; return -1; };
  const closeTo = i => { stack.length = i; };
  let i = 0;
  const s = String(html);
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) { append(top(), new Text(decode(s.slice(i)))); break; }
    if (lt > i) append(top(), new Text(decode(s.slice(i, lt))));
    if (s.startsWith("<!--", lt)) { const e = s.indexOf("-->", lt + 4); i = e < 0 ? s.length : e + 3; continue; }
    if (s[lt + 1] === "!" || s[lt + 1] === "?") { const e = s.indexOf(">", lt); i = e < 0 ? s.length : e + 1; continue; }
    const end = /^<\/([a-zA-Z][\w-]*)\s*>/.exec(s.slice(lt, lt + 200));
    if (end) {
      const name = end[1].toLowerCase();
      const at = open(name);
      if (at > 0) closeTo(at);
      i = lt + end[0].length;
      continue;
    }
    const start = /^<([a-zA-Z][\w-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.exec(s.slice(lt));
    if (!start) { append(top(), new Text("<")); i = lt + 1; continue; }
    const name = start[1].toLowerCase();
    if (CLOSES_P.has(name)) { const p = open("p"); if (p > 0 && !stack.slice(p + 1).some(e => /^(button|td|th|table|caption|object|template|marquee|applet)$/.test(e.localName))) closeTo(p); }
    if (name === "li") { const l = open("li"); if (l > 0 && !stack.slice(l + 1).some(e => e.localName === "ul" || e.localName === "ol")) closeTo(l); }
    if (name === "option") { const o = open("option"); if (o === stack.length - 1) closeTo(o); }
    const el = new Element(name, parseAttrs(start[2]));
    append(top(), el);
    i = lt + start[0].length;
    if (VOID.has(name) || start[3] === "/") continue;
    if (RAW.has(name)) {
      const close = s.toLowerCase().indexOf("</" + name, i);
      const text = s.slice(i, close < 0 ? s.length : close);
      if (text) append(el, new Text(name === "title" || name === "textarea" ? decode(text) : text));
      const gt = close < 0 ? s.length : s.indexOf(">", close);
      i = gt < 0 ? s.length : gt + 1;
      continue;
    }
    stack.push(el);
  }
  return doc;
}

const cache = new Map();

function parseGroup(sel) {
  if (cache.has(sel)) return cache.get(sel);
  const groups = splitTop(sel, ",").map(g => parseChain(g.trim()));
  cache.set(sel, groups);
  return groups;
}

function splitTop(s, ch) {
  const out = []; let depth = 0, quote = "", cur = "";
  for (const c of s) {
    if (quote) { cur += c; if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === ch && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseChain(sel) {
  const parts = [];
  let rest = sel.trim(), comb = " ";
  while (rest) {
    const m = /^((?:[\w*-]+)?(?:#[\w-]+|\.[\w-]+|\[[^\]]+\]|:not\((?:[^()]|\([^()]*\))*\)|:first-child|:last-child)*)/.exec(rest);
    if (!m || !m[1]) throw new Error("dom-lite cannot parse selector: " + sel);
    parts.push({ comb, simple: parseCompound(m[1]) });
    rest = rest.slice(m[1].length);
    const c = /^\s*([>+~])\s*|^\s+/.exec(rest);
    if (!c) break;
    comb = c[1] || " ";
    rest = rest.slice(c[0].length);
  }
  return parts;
}

function parseCompound(src) {
  const out = { tag: "", ids: [], classes: [], attrs: [], nots: [], pseudo: [] };
  const re = /^[\w*-]+|#([\w-]+)|\.([\w-]+)|\[\s*([\w:-]+)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*(i)?)?\s*\]|:not\(((?:[^()]|\([^()]*\))*)\)|:(first-child|last-child)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m.index === 0 && /^[\w*-]/.test(m[0]) && !m[0].startsWith("#") && !m[0].startsWith(".")) { if (m[0] !== "*") out.tag = m[0].toLowerCase(); continue; }
    if (m[1]) out.ids.push(m[1]);
    else if (m[2]) out.classes.push(m[2]);
    else if (m[3]) out.attrs.push({ name: m[3].toLowerCase(), op: m[4] || "", value: m[5] != null ? m[5] : m[6] != null ? m[6] : m[7] || "", ci: !!m[8] });
    else if (m[9] != null) out.nots.push(parseGroup(m[9]));
    else if (m[10]) out.pseudo.push(m[10]);
  }
  return out;
}

function matchSimple(el, s) {
  if (s.tag && el.localName !== s.tag) return false;
  for (const id of s.ids) if (el.id !== id) return false;
  if (s.classes.length) { const list = el.className.split(/\s+/); for (const c of s.classes) if (!list.includes(c)) return false; }
  for (const a of s.attrs) {
    const v = el.getAttribute(a.name);
    if (v == null) return false;
    if (!a.op) continue;
    const have = a.ci ? v.toLowerCase() : v, want = a.ci ? a.value.toLowerCase() : a.value;
    if (a.op === "=" && have !== want) return false;
    if (a.op === "^=" && !(want && have.startsWith(want))) return false;
    if (a.op === "$=" && !(want && have.endsWith(want))) return false;
    if (a.op === "*=" && !(want && have.includes(want))) return false;
    if (a.op === "~=" && !have.split(/\s+/).includes(want)) return false;
    if (a.op === "|=" && !(have === want || have.startsWith(want + "-"))) return false;
  }
  for (const n of s.nots) if (n.some(c => matchChain(el, c))) return false;
  for (const p of s.pseudo) {
    const sib = el.parentNode ? el.parentNode.children || el.parentNode.childNodes.filter(c => c.nodeType === 1) : [el];
    if (p === "first-child" && sib[0] !== el) return false;
    if (p === "last-child" && sib[sib.length - 1] !== el) return false;
  }
  return true;
}

function matchChain(el, chain, idx = chain.length - 1) {
  if (!matchSimple(el, chain[idx].simple)) return false;
  if (idx === 0) return true;
  const comb = chain[idx].comb;
  if (comb === ">") { const p = el.parentElement; return !!p && matchChain(p, chain, idx - 1); }
  if (comb === "+") { const p = el.previousElementSibling; return !!p && matchChain(p, chain, idx - 1); }
  if (comb === "~") { let p = el.previousElementSibling; while (p) { if (matchChain(p, chain, idx - 1)) return true; p = p.previousElementSibling; } return false; }
  let p = el.parentElement;
  while (p) { if (matchChain(p, chain, idx - 1)) return true; p = p.parentElement; }
  return false;
}

export function windowFor(html, url) {
  const document = parseHTML(html);
  const u = new URL(url);
  const location = { href: u.href, host: u.host, hostname: u.hostname, pathname: u.pathname, search: u.search, origin: u.origin, protocol: u.protocol };
  return { document, location };
}
