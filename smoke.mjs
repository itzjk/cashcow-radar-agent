#!/usr/bin/env node
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve as resolvePath } from "node:path";

const EXT = process.env.ZERACK_EXT ? resolvePath(process.env.ZERACK_EXT) : dirname(fileURLToPath(import.meta.url));

const SKIP_DIRS = ["/.git/", "/node_modules/", "/docs/", "/lib/face-api/", "/lib/mobilenet/", "/lib/whisper/models/"];
const SKIP_FILES = [/\.min\.js$/, /\.bak$/, /\.before-restore$/, /\.pre-mono$/];

let failures = 0, warnings = 0;
const ok = m => console.log("  \x1b[32mOK\x1b[0m    " + m);
const fail = m => { failures++; console.log("  \x1b[31mFAIL\x1b[0m  " + m); };
const warn = m => { warnings++; console.log("  \x1b[33mWARN\x1b[0m  " + m); };
const section = t => console.log("\n" + t);

function walk(root, test, everything) {
  const out = [];
  (function step(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const p = join(dir, name);
      const skipped = !everything && SKIP_DIRS.some(s => (p + "/").includes(s));
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (!skipped && !/\/\.git$/.test(p)) step(p); continue; }
      if (skipped) continue;
      if (!everything && SKIP_FILES.some(r => r.test(name))) continue;
      if (test(name)) out.push(p);
    }
  })(root);
  return out.sort();
}

const jsFiles = walk(EXT, n => /\.(js|mjs)$/.test(n));
const htmlFiles = walk(EXT, n => /\.html$/.test(n));
const rel = p => relative(EXT, p);
const read = p => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

let manifest = null;
try { manifest = JSON.parse(read(join(EXT, "manifest.json"))); } catch {}

const mainWorldScripts = [];
if (manifest) {
  for (const cs of manifest.content_scripts || []) {
    if (cs.world === "MAIN") mainWorldScripts.push(...(cs.js || []));
  }
}

const isScreen = p => /(?:^|\/)(?:popup|options|ashlyv|dashboard|niche-index|country-feed)\//.test(rel(p));
const isBackstage = p => /(?:^|\/)(?:background|content|knowledge)\//.test(rel(p));

section("1. Syntax of every first party script");
{
  const broken = [];
  for (const f of jsFiles) {
    try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
    catch (e) { broken.push(rel(f) + ": " + String(e.stderr || "").split("\n").filter(Boolean)[1]); }
  }
  if (broken.length) broken.forEach(fail);
  else ok(jsFiles.length + " js and mjs files parse");
}

section("1b. Chrome can read every script as UTF-8");
{
  const NONCHAR = /[\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  let bad = 0;
  for (const f of jsFiles) {
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(f)); }
    catch (e) { bad++; fail(rel(f) + " is not valid UTF-8, and Chrome refuses to load the whole extension over one such file"); continue; }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = NONCHAR.exec(lines[i]);
      if (m) { bad++; fail(rel(f) + ":" + (i + 1) + " holds U+" + m[0].charCodeAt(0).toString(16).toUpperCase() + ", a Unicode noncharacter; Chrome reports the file as not UTF-8 and refuses the whole extension. Write it as an escape"); break; }
    }
  }
  if (!bad) ok("the " + jsFiles.length + " scripts decode as strict UTF-8 with no noncharacters");
}

section("2. Manifest declares only files that exist");
{
  if (!manifest) fail("manifest.json does not parse, every other manifest check is skipped");
  else {
    ok("manifest.json parses, version " + manifest.version);
    const declared = [];
    for (const cs of manifest.content_scripts || []) {
      declared.push(...(cs.js || []), ...(cs.css || []));
    }
    if (manifest.background && manifest.background.service_worker) declared.push(manifest.background.service_worker);
    if (manifest.action && manifest.action.default_popup) declared.push(manifest.action.default_popup);
    if (manifest.options_ui && manifest.options_ui.page) declared.push(manifest.options_ui.page);
    if (manifest.side_panel && manifest.side_panel.default_path) declared.push(manifest.side_panel.default_path.split(/[?#]/)[0]);
    Object.values(manifest.icons || {}).forEach(v => declared.push(v));
    if (manifest.action && manifest.action.default_icon) {
      const di = manifest.action.default_icon;
      if (typeof di === "string") declared.push(di); else Object.values(di).forEach(v => declared.push(v));
    }
    const missing = [...new Set(declared)].filter(p => !existsSync(join(EXT, p)));
    if (missing.length) missing.forEach(p => fail("the manifest declares " + p + " and it is not on disk"));
    else ok(new Set(declared).size + " files declared by the manifest are on disk");

    let emptyGlobs = 0;
    for (const entry of manifest.web_accessible_resources || []) {
      for (const pattern of entry.resources || []) {
        if (!pattern.includes("*")) {
          if (!existsSync(join(EXT, pattern))) { emptyGlobs++; fail("web_accessible_resources lists " + pattern + " and it is not on disk"); }
          continue;
        }
        const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
        const dir = join(EXT, pattern.split("*")[0].replace(/[^/]*$/, ""));
        const hit = walk(existsSync(dir) ? dir : EXT, () => true, true).some(f => re.test(rel(f)));
        if (!hit) { emptyGlobs++; fail("web_accessible_resources pattern " + pattern + " matches no file, so it exposes nothing"); }
      }
    }
    if (!emptyGlobs) ok("every web_accessible_resources entry matches something on disk");

    const bundle = join(EXT, "content/nsp-bundle.js");
    if (existsSync(bundle)) {
      const printed = /\[NSP\]\s*v([0-9]+\.[0-9]+\.[0-9]+)/.exec(read(bundle).slice(0, 4000));
      if (!printed) warn("content/nsp-bundle.js does not print a version on startup, so the console cannot say which build is running");
      else if (printed[1] !== manifest.version) warn("version drift: the manifest says " + manifest.version + " and the bundle prints " + printed[1]);
      else ok("the version the bundle prints matches the manifest");
    }
  }
}

section("3. Every src and href in every page resolves");
{
  let broken = 0, checked = 0;
  for (const page of htmlFiles) {
    const html = read(page).replace(/<!--[\s\S]*?-->/g, "");
    const refs = [];
    for (const m of html.matchAll(/<(?:script|img|source|iframe)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
    for (const m of html.matchAll(/<(?:link|a)\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
    for (const ref of refs) {
      if (/^(?:https?:|data:|blob:|mailto:|javascript:|chrome:|chrome-extension:|#|\/\/)/i.test(ref)) continue;
      const target = ref.split("?")[0].split("#")[0];
      if (!target) continue;
      checked++;
      if (!existsSync(join(dirname(page), target))) {
        broken++;
        fail(rel(page) + " points at " + ref + " and that file is not on disk, so the page loads without it and says nothing");
      }
    }
  }
  if (!broken) ok(checked + " local references across " + htmlFiles.length + " pages resolve");
}

section("4. No inline script and no inline handler, the CSP blocks both");
{
  const linked = page => {
    const base = rel(page).split("/").pop();
    if (manifest && JSON.stringify(manifest).includes(base)) return true;
    return htmlFiles.concat(jsFiles).some(other => other !== page && read(other).includes(base));
  };
  let bad = 0;
  for (const page of htmlFiles) {
    const html = read(page);
    const inline = (html.match(/<script(?![^>]*\ssrc)[^>]*>[\s\S]*?<\/script>/gi) || [])
      .filter(b => b.replace(/<\/?script[^>]*>/gi, "").trim().length > 0);
    if (!inline.length) continue;
    if (linked(page)) { bad++; fail(rel(page) + " has " + inline.length + " inline script block(s) and something links to it, so the CSP kills the page inside Chrome"); }
    else warn(rel(page) + " has inline script, and nothing links to it, so it never loads inside Chrome");
  }
  for (const page of htmlFiles) {
    const stripped = read(page)
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const found = [];
    for (const tag of stripped.match(/<[a-zA-Z][^>]*>/g) || []) {
      for (const at of tag.match(/\son[a-z]{2,}\s*=/g) || []) found.push(at.trim().replace(/\s*=$/, ""));
    }
    if (!found.length) continue;
    bad++;
    fail(rel(page) + " has " + found.length + " inline handler(s) (" + [...new Set(found)].join(", ") + "). The CSP blocks them, so the attribute looks like it protects the page and does nothing. Move it to addEventListener");
  }
  if (!bad) ok(htmlFiles.length + " pages with no inline script and no inline handler");
}

section("5. Scanner engine still exports what the overlay calls");
{
  const bundle = join(EXT, "content/nsp-bundle.js");
  if (!existsSync(bundle)) fail("content/nsp-bundle.js is missing, the scanner has no engine");
  else {
    const src = read(bundle);
    const needed = ["calcScore", "makeBadge", "processCard", "runAshlyVScan", "showAshlyVScanOverlay"];
    const absent = needed.filter(f => !new RegExp("function\\s+" + f + "\\b").test(src));
    if (absent.length) fail("the overlay calls these and the bundle no longer defines them: " + absent.join(", "));
    else ok("the " + needed.length + " entry points of the scan engine are defined");
  }
}

// Strings the user reads. Comment lines, console lines, regex literals and CSS inside
// style attributes are dropped first, so only text that can reach a screen is judged.
// Only the codes this repo keys a per-language table on. Codes that double as ordinary
// identifiers here (id, it, no, el, da, tr) are left out on purpose: exempting a table row
// must never exempt a line that simply sits under "var el = ...".
const LANG_CODES = "es|es-419|es-mx|en|en-us|en-gb|de|fr|fr-ca|pt|pt-br|pl|ja|ko|zh|zh-cn|zh-tw|nl|sv|ru|vi|tl|hi|ar|th";
const LANG_KEY = new RegExp("(?:^|[{,(\\s])['\"]?(?:" + LANG_CODES + ")['\"]?\\s*:\\s*[\\[{'\"]", "i");
const LANG_GUARD = new RegExp("(?:lang|language|locale|hl|idioma)\\s*(?:===?|!==?)\\s*['\"](?:" + LANG_CODES + ")['\"]", "i");
const LANG_NAME = new RegExp("^(?:" + LANG_CODES + ")$", "i");
// A string carrying regex syntax is a matcher built at runtime with new RegExp, not copy.
const REGEX_SOURCE = /\\[bdswBDSW]|\(\?:|\[\^|\\\\[bdsw]/;

// Data, not copy. Every entry is a table the scanner matches against YouTube or sends
// to YouTube as a query, so its Spanish is part of the data and has to stay.
const DATA_TABLES = new Set([
  "queries",                        // ashlyv-engine.js: search queries per niche and language
  "detect",                         // ashlyv-engine.js: niche detection keywords per language
  "NICHE_LABEL_QUERY",              // nsp-bundle.js: the query that names each niche
  "NSP_NICHE_SEEDS",                // nsp-bundle.js: seed queries for the sweep
  "NSP_FACELESS_QUERIES_BY_LANG",   // nsp-bundle.js: faceless queries per language
  "FACELESS_QUERY_LIBRARY",         // nsp-bundle.js: the same library by niche
  "AI_FACELESS_CHANNEL_WHITELIST",  // nsp-bundle.js and lib/nsp-faceless-data.js: channel names as they appear on YouTube
  "AI_FACELESS_TITLE_PATTERNS",     // lib/nsp-faceless-data.js: title patterns matched against YouTube
  "NICHE_RPM",                      // country-feed.js: niche matchers with their RPM
  "searches",                       // nsp-bundle.js: the YouTube search a channel report links to, per language
  "NICHE_KEYWORDS",                 // ashlyv-engine.js: niche keywords per language
  "FACELESS_LANGUAGE_BANK",         // nsp-bundle.js: search keywords for each of the 44 languages
  "STOP"                            // knowledge/reverse-engine.js: stop words for the title formula
]);
const DATA_FILES = new Set(["niche-detector.test.js"]);
// Written for Node, never loaded by Chrome, so their strings reach no screen.
const TOOLING = new Set(["smoke.mjs", "niche-detector.test.js", "icons/make-icons.js"]);
const DECLARATION = /^\s*(?:var|const|let)\s+([A-Za-z0-9_$]+)\s*=|^\s*function\s+([A-Za-z0-9_$]+)|^\s*['"]?([A-Za-z0-9_$-]+)['"]?\s*:\s*(?:function|\{|\[)/;

function enclosingNames(lines, index) {
  const names = [];
  for (let j = index; j >= 0 && j > index - 500; j--) {
    const m = DECLARATION.exec(lines[j]);
    if (!m) continue;
    names.push(m[3] ? ":" + m[3] : (m[1] || m[2]));
    if (/^\s*(?:var|const|let|function)\s/.test(lines[j])) break;
  }
  return names;
}

function jsStrings(file) {
  const rp = rel(file);
  if (DATA_FILES.has(rp)) return [];
  const lines = read(file).split("\n");
  const out = [];
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (inBlockComment) { if (trimmed.includes("*/")) inBlockComment = false; return; }
    if (trimmed.startsWith("/*")) { if (!trimmed.includes("*/")) inBlockComment = true; return; }
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (/console\s*\.\s*(?:log|warn|error|info|debug|trace)\s*\(/.test(line)) return;
    const withoutRegex = line.replace(/(^|[=(,:[!&|?+]|\breturn|\bcase)(\s*)\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[gimsuy]*/g, "$1$2 REGEX ");
    const literals = [...withoutRegex.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n$]|\\.)*)`/g)]
      .map(m => m[1] ?? m[2] ?? m[3] ?? "")
      .filter(text => text.length >= 4);
    for (const text of literals) {
      if (/^[a-z0-9_$.:;#%/,()\s-]*$/i.test(text) && !/\s\S+\s/.test(text)) continue;
      out.push({ file: rp, line: i + 1, text, context: lines.slice(Math.max(0, i - 2), i + 1).join("\n"), names: enclosingNames(lines, i) });
    }
  });
  return out;
}

function htmlStrings(file) {
  const rp = rel(file);
  const raw = read(file);
  const lines = raw.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    if (/^\s*(?:\/\/|<!--)/.test(line)) return;
    const stripped = line.replace(/<!--[\s\S]*?-->/g, "").replace(/style\s*=\s*"[^"]*"/gi, "");
    for (const m of stripped.matchAll(/\b(?:placeholder|title|alt|aria-label|value|data-label)\s*=\s*"([^"]{3,})"/gi)) {
      out.push({ file: rp, line: i + 1, text: m[1], context: line, names: [] });
    }
    for (const m of stripped.matchAll(/>([^<>{}]{3,})</g)) {
      const text = m[1].trim();
      if (text) out.push({ file: rp, line: i + 1, text, context: line, names: [] });
    }
  });
  return out;
}

function isData(entry) {
  if (REGEX_SOURCE.test(entry.text)) return true;
  if (LANG_KEY.test(entry.context) || LANG_GUARD.test(entry.context)) return true;
  if (entry.names.some(n => DATA_TABLES.has(n.replace(/^:/, "")))) return true;
  if (entry.names.some(n => n.startsWith(":") && LANG_NAME.test(n.slice(1)))) return true;
  if (/aria-label\s*\*?=|^\s*[.#[]/.test(entry.text)) return true;
  return false;
}

const shipped = f => !/^(?:icons|scripts|tests)\//.test(rel(f)) && !TOOLING.has(rel(f));
const userStrings = [
  ...jsFiles.filter(shipped).flatMap(jsStrings),
  ...htmlFiles.filter(shipped).flatMap(htmlStrings)
];

section("6. No Spanish in the strings the user reads");
{
  const SPANISH = /[áéíóúñÁÉÍÓÚÑ¿¡]|\b(?:el|la|los|las|una|unos|unas|para|porque|pero|con|sin|desde|hasta|sobre|entre|cuando|donde|nada|nadie|algo|más|menos|muy|este|esta|estos|estas|ese|esa|eso|hay|ser|estar|tiene|tienen|puede|pueden|debe|deben|hace|hacen|dice|dicen|guardar|guardado|cargar|cargando|buscar|buscando|encontramos|espacios|cercanos)\b/i;
  const hits = userStrings.filter(e => /\s/.test(e.text) && SPANISH.test(e.text) && !isData(e));
  if (!hits.length) ok("the " + userStrings.length + " strings that can reach a screen are all English, and the documented data tables are exempt");
  else {
    const byFile = new Map();
    for (const h of hits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file).push(h); }
    for (const [file, list] of byFile) {
      fail(file + ": " + list.length + " Spanish string(s) the user reads, first at line " + list[0].line + ' "' + list[0].text.slice(0, 70) + '"');
      list.slice(1, 4).forEach(h => console.log("          line " + h.line + ' "' + h.text.slice(0, 70) + '"'));
    }
  }
}

section("7. No emoji in the strings the user reads");
{
  const EMOJI = /\p{Extended_Pictographic}/u;
  const FLAGS_ONLY = /^[\p{Regional_Indicator}\s\p{L}\p{N}.,()/-]*$/u;
  const NICHE_SENTINEL = /General|Otros/;
  const hits = userStrings.filter(e => {
    if (NICHE_SENTINEL.test(e.text) && e.text.length < 24) return false;
    if (FLAGS_ONLY.test(e.text)) return false;
    return EMOJI.test(e.text);
  });
  if (!hits.length) ok("no emoji in the " + userStrings.length + " strings that can reach a screen");
  else {
    const byFile = new Map();
    for (const h of hits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file).push(h); }
    for (const [file, list] of byFile) {
      fail(file + ": " + list.length + " string(s) with emoji, first at line " + list[0].line + ' "' + list[0].text.slice(0, 60) + '"');
      list.slice(1, 4).forEach(h => console.log("          line " + h.line + ' "' + h.text.slice(0, 60) + '"'));
    }
  }
}

section("8. Every message a screen sends has a handler");
{
  const sent = new Map();
  let backstage = "";
  for (const f of jsFiles) {
    const src = read(f);
    if (isBackstage(f)) backstage += src;
  }
  for (const f of jsFiles) {
    if (!isScreen(f)) continue;
    const src = read(f);
    for (const m of src.matchAll(/['"]((?:NSP|ZERACK|ASHLYV)_[A-Z0-9_]{3,})['"]/g)) {
      if (!sent.has(m[1])) sent.set(m[1], rel(f));
    }
  }
  const orphans = [...sent].filter(([type]) => !backstage.includes(type));
  if (!orphans.length) ok("the " + sent.size + " message types the screens send all have a handler");
  else for (const [type, where] of orphans) {
    fail(where + " sends " + type + " and nothing handles it, so that control answers and does nothing");
  }
}

section("9. Every storage key the page world touches is on the bridge allowlist");
{
  const bridge = join(EXT, "content/ashlyv-bridge.js");
  const block = /var\s+NSP_RELAY_KEYS\s*=\s*\{([\s\S]*?)\}\s*;/.exec(read(bridge));
  if (!block) fail("content/ashlyv-bridge.js has no NSP_RELAY_KEYS allowlist, so nothing limits what the page world can read out of storage");
  else {
    const allowed = new Set([...block[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*1/g)].map(m => m[1]));
    const roBlock = /var\s+NSP_RELAY_READONLY\s*=\s*\{([\s\S]*?)\}\s*;/.exec(read(bridge));
    const readOnly = new Set(roBlock ? [...roBlock[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*1/g)].map(m => m[1]) : []);
    const written = new Set();
    const writtenAt = new Map();
    const refused = /key|token|secret|password|auth/i;
    const KEY_SHAPE = /^(?:nsp|ashlyv|zerack)_[a-z0-9_]+$/;
    const CALLS = /(?:nspStore\s*\.\s*(?:get|set|remove)|ashlyVStorageGet|ashlyVStorageSet|ashlyv_safeStorageSet)\s*\(/g;
    const used = new Map();
    for (const script of mainWorldScripts) {
      const src = read(join(EXT, script));
      if (!src) continue;
      const lineAt = offset => src.slice(0, offset).split("\n").length;
      for (const m of src.matchAll(CALLS)) {
        const window = src.slice(m.index, m.index + 400);
        const isWrite = /\.\s*(?:set|remove)\s*\(|StorageSet|safeStorageSet/.test(m[0]);
        const found = [...window.matchAll(/['"]([a-z0-9_]+)['"]/g)].map(x => x[1]);
        if (isWrite) {
          const call = window.slice(0, window.indexOf(")") + 1 || window.length);
          for (const k of call.matchAll(/[{,]\s*([a-z0-9_]+)\s*:/g)) found.push(k[1]);
        }
        for (const key of found) {
          if (!KEY_SHAPE.test(key)) continue;
          if (isWrite) { written.add(key); if (!writtenAt.has(key)) writtenAt.set(key, script + ":" + lineAt(m.index)); }
          if (!used.has(key)) used.set(key, script + ":" + lineAt(m.index));
        }
      }
      for (const m of src.matchAll(/payload\s*(?:\.\s*([a-z0-9_]+)|\[\s*['"]([a-z0-9_]+)['"]\s*\])\s*=/g)) {
        const key = m[1] || m[2];
        if (KEY_SHAPE.test(key) && !used.has(key)) used.set(key, script + ":" + lineAt(m.index));
      }
    }
    const blocked = [...used].filter(([k]) => refused.test(k) || (!allowed.has(k) && !(readOnly.has(k) && !written.has(k))));
    if (!blocked.length) ok("the " + used.size + " storage keys the page world touches are all on the bridge allowlist of " + allowed.size + (readOnly.size ? ", " + readOnly.size + " of them read only" : ""));
    else for (const [key, where] of blocked) {
      const why = refused.test(key)
        ? "nspRelayKeyAllowed refuses any key whose name contains key, token, secret, password or auth, so this read always comes back empty"
        : readOnly.has(key)
          ? "it is on NSP_RELAY_READONLY, so the page world may read it but never write it; a write here is exactly what that list exists to refuse"
          : "it is not in NSP_RELAY_KEYS, so the bridge answers no_allowed_keys and the read comes back empty";
      fail((readOnly.has(key) && writtenAt.has(key) ? writtenAt.get(key) + " writes " : where + " reads or writes ") + key + " from the page world and " + why);
    }
    const unusedAllow = [...allowed].filter(k => ![...used.keys()].includes(k));
    if (unusedAllow.length > 0 && unusedAllow.length === allowed.size) fail("NSP_RELAY_KEYS allows " + allowed.size + " keys and the page world asks for none of them");
  }

  let leaks = 0;
  for (const script of mainWorldScripts) {
    read(join(EXT, script)).split("\n").forEach((line, i) => {
      if (!/localStorage\s*\.\s*getItem\s*\(\s*['"][a-z0-9_]*(?:api_key|apikey|_key|_token)['"]/i.test(line)) return;
      leaks++;
      fail(script + ":" + (i + 1) + " pulls a key out of localStorage, and this file runs inside youtube.com, so any script on the page can read it and spend your quota. The key belongs in Options and the data in a request through the bridge");
    });
  }
  if (!leaks) ok("no script in the page world pulls a key out of localStorage");
}

section("10. The model catalog is loaded everywhere it is used");
{
  const catalog = join(EXT, "lib/nsp-models.js");
  if (!existsSync(catalog)) fail("lib/nsp-models.js is missing, so every model picker falls back to a single hardcoded entry");
  else {
    const consumers = jsFiles.filter(f => f !== catalog && shipped(f) && /\bNSP_MODELS\b/.test(read(f)));
    const manifestJson = manifest ? JSON.stringify(manifest) : "";
    let holes = 0;
    for (const f of consumers) {
      const consumer = rel(f);
      const base = consumer.split("/").pop();
      let loaded = false, where = "";
      if (mainWorldScripts.includes(consumer)) {
        loaded = mainWorldScripts.includes("lib/nsp-models.js")
          && mainWorldScripts.indexOf("lib/nsp-models.js") < mainWorldScripts.indexOf(consumer);
        where = "the MAIN world content_scripts block";
      } else if (/^background\//.test(consumer)) {
        loaded = /importScripts\([^)]*nsp-models\.js/.test(read(f));
        where = "importScripts in " + consumer;
      } else {
        for (const page of htmlFiles) {
          const html = read(page);
          const iConsumer = html.search(new RegExp('src="[^"]*' + base.replace(/\./g, "\\.") + '[?"]'));
          if (iConsumer < 0) continue;
          const iCatalog = html.search(/src="[^"]*nsp-models\.js[?"]/);
          where = rel(page);
          loaded = iCatalog >= 0 && iCatalog < iConsumer;
          if (!loaded) break;
        }
      }
      if (!loaded) {
        holes++;
        fail(consumer + " uses NSP_MODELS and " + (where || "nothing that loads it") + " never loads lib/nsp-models.js before it, so the model picker silently falls back to one entry");
      }
    }
    if (!holes) ok("the model catalog is loaded before each of the " + consumers.length + " places that read NSP_MODELS");
    if (manifestJson && !manifestJson.includes("lib/nsp-models.js")) warn("the manifest never declares lib/nsp-models.js, so no content script can see the catalog");
  }
}

section("11. Names Chrome refuses to load");
{
  const offenders = [];
  (function step(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const p = join(dir, name);
      if (SKIP_DIRS.some(s => (p + "/").includes(s))) continue;
      if (name.startsWith("_")) offenders.push(rel(p));
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) step(p);
    }
  })(EXT);
  if (offenders.length) offenders.forEach(p => fail(p + " starts with an underscore, and Chrome refuses to load an extension that contains one"));
  else ok("no file or folder starts with an underscore");
}

section("12. No page builds a localhost address out of location");
{
  let offenders = 0;
  for (const f of jsFiles) {
    if (isBackstage(f) && !/^content\//.test(rel(f))) continue;
    read(f).split("\n").forEach((line, i) => {
      if (!/location\s*\.\s*(?:protocol|host|hostname|origin)/.test(line)) return;
      if (!/:\s*\d{4}|:'\s*\+|PORT|127\.0\.0\.1|localhost/.test(line)) return;
      offenders++;
      fail(rel(f) + ":" + (i + 1) + " builds a server address out of location, and inside chrome-extension:// that gives an address nothing answers");
    });
  }
  if (!offenders) ok("no script builds a server address out of location");
}

section("13. Every host permission has a caller");
{
  if (!manifest) warn("no manifest, host permissions not checked");
  else {
    const sources = jsFiles.map(read).join("\n") + htmlFiles.map(read).join("\n");
    const unused = [];
    for (const pattern of manifest.host_permissions || []) {
      const host = pattern.replace(/^https?:\/\//, "").replace(/\/\*$/, "").replace(/^\*\./, "");
      if (!host) continue;
      if (!sources.includes(host)) unused.push(pattern);
    }
    if (!unused.length) ok((manifest.host_permissions || []).length + " host permissions, each with at least one caller in this code");
    else unused.forEach(p => fail("the manifest asks for " + p + " and nothing in this code calls it, so the install prompt asks for access the extension never uses"));
  }
}

section("14. Pages nobody can reach");
{
  const entryPoints = new Set();
  if (manifest) {
    if (manifest.action && manifest.action.default_popup) entryPoints.add(manifest.action.default_popup.split("/").pop());
    if (manifest.options_ui && manifest.options_ui.page) entryPoints.add(manifest.options_ui.page.split("/").pop());
    if (manifest.side_panel && manifest.side_panel.default_path) entryPoints.add(manifest.side_panel.default_path.split(/[?#]/)[0].split("/").pop());
  }
  const allSources = jsFiles.concat(htmlFiles);
  const unreachable = [];
  for (const page of htmlFiles) {
    const base = rel(page).split("/").pop();
    if (entryPoints.has(base)) continue;
    const linked = allSources.some(other => other !== page && read(other).includes(base));
    if (!linked) unreachable.push(rel(page));
  }
  if (!unreachable.length) ok("every page has a link that opens it");
  else unreachable.forEach(p => warn(p + " has no link from any page or script, so it only opens by typing the address"));
}

section("15. Nothing turns Trusted Types off on youtube.com");
{
  // YouTube requires Trusted Types. A policy named "default" that returns its input unchanged makes every
  // innerHTML on the page, YouTube's own and any third party's, accept markup again.
  const hits = jsFiles.filter(f => /createPolicy\s*\(\s*['"]default['"]/.test(read(f))).map(rel);
  if (hits.length) hits.forEach(f => fail(f + " registers a Trusted Types policy named default, which switches the protection off for every script on youtube.com; write HTML through nspSetHTML instead"));
  else ok("no script registers a default Trusted Types policy");
}

section("16. No regex with an empty alternative");
{
  // An empty branch, as in /a||b/, matches every string. A text purge once left dozens of them, and a
  // reject list that matches everything rejects every video without a word.
  const LITERAL = /(^|[=(,:!&|?;{}\s])\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n\[])+)\/[gimsuy]*(?=\s*(?:\.(?:test|exec|match|source)|[;,)\]}]|$))/g;
  let bad = 0;
  for (const f of jsFiles.filter(f => !/\.min\.js$/.test(f))) {
    read(f).split("\n").forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      for (const m of line.matchAll(LITERAL)) {
        const body = m[2].replace(/\\./g, "x").replace(/\[[^\]]*\]/g, "x");
        if (!/[|]/.test(body) || /^[\s\d.+\-*()]+$/.test(body)) continue;
        if (/^\||\|$|\|\||\(\||\(\?:\||\(\?[=!]\||\|\)/.test(body)) { bad++; fail(rel(f) + ":" + (i + 1) + " has a regex with an empty alternative, so it matches every string: " + m[0].trim().slice(0, 80)); }
      }
    });
  }
  if (!bad) ok("no regex literal has an empty alternative");
}

section("17. The service worker names who may send every message it routes");
{
  const sw = read(join(EXT, "background/service-worker.js"));
  const block = /var\s+NSP_MESSAGE_CALLERS\s*=\s*\{([\s\S]*?)\n\};/.exec(sw);
  if (!block) fail("background/service-worker.js has no NSP_MESSAGE_CALLERS table, so no message is checked for who sent it");
  else {
    const table = new Map([...block[1].matchAll(/^\s*'?([A-Za-z_:]+)'?\s*:\s*(.+?),?\s*$/gm)].map(m => [m[1], m[2].trim()]));
    const routed = new Set([...sw.matchAll(/msg\.type === '([A-Za-z_:]+)'/g)].map(m => m[1]));
    const missing = [...routed].filter(t => !table.has(t));
    const stale = [...table.keys()].filter(t => !routed.has(t));
    missing.forEach(t => fail("the worker routes " + t + " but NSP_MESSAGE_CALLERS does not name who may send it, so the door lets it fall through unanswered"));
    stale.forEach(t => fail("NSP_MESSAGE_CALLERS lists " + t + " and no handler routes it"));
    const EXT_ONLY_TYPES = ["NSP_AGENT_LIST_TABS", "NSP_AGENT_SWITCH_TAB", "NSP_AGENT_CLOSE_TAB", "NSP_AGENT_NAVIGATE", "NSP_AGENT_FETCH_URL"];
    EXT_ONLY_TYPES.forEach(t => { if (table.get(t) !== "NSP_EXT_ONLY") fail(t + " must be NSP_EXT_ONLY: a content script on youtube.com speaks for every script on the page"); });
    ["ASHLYV_CHAT_REQUEST"].forEach(t => { if (/youtube/.test(table.get(t) || "")) fail(t + " takes a free prompt and spends the user's keys, so youtube.com must not have a seat on it"); });
    ["NSP_AI_TASK", "ASHLYV_VISION_JUDGE", "NSP_AGENT_OPEN_TAB"].forEach(t => { if (!/youtube:\s*'grant'/.test(table.get(t) || "")) fail(t + " must be youtube: 'grant', so a YouTube tab spends only inside a grant"); });
    const bridge = read(join(EXT, "content/ashlyv-bridge.js"));
    const relay = /var\s+NSP_RELAY_CALLS\s*=\s*\{([\s\S]*?)\}\s*;/.exec(bridge);
    const forwarded = new Set([...bridge.matchAll(/nspBridgeSend\(\s*\{\s*type:\s*'([A-Z_]+)'/g)].map(m => m[1]).concat(relay ? [...relay[1].matchAll(/([A-Z_]+)\s*:\s*1/g)].map(m => m[1]) : []));
    const unseated = [...forwarded].filter(t => !/youtube|NSP_EXT_AND_YOUTUBE|NSP_ALL_CALLERS/.test(table.get(t) || ""));
    unseated.forEach(t => fail("content/ashlyv-bridge.js forwards " + t + " and the worker gives youtube.com no seat on it, so that page control fails"));
    if (!missing.length && !stale.length && !unseated.length) ok("the " + table.size + " message types each name their callers, and the " + forwarded.size + " the bridge forwards all have a seat for youtube.com");
  }
}

section("18. Behaviour tests");
{
  const dir = join(EXT, "tests");
  const tests = existsSync(dir) ? readdirSync(dir).filter(n => /\.test\.mjs$/.test(n)).sort() : [];
  if (!tests.length) warn("no tests/*.test.mjs to run");
  for (const t of tests) {
    try {
      const outText = execFileSync(process.execPath, [join(dir, t)], { stdio: "pipe", encoding: "utf8", timeout: 180000 });
      ok(t + ": " + String(outText).trim().split("\n").pop());
    } catch (e) {
      const lines = String(e.stdout || "").split("\n").filter(l => /FAIL/.test(l)).slice(0, 6);
      fail(t + " is red" + (lines.length ? ":\n        " + lines.join("\n        ") : ": " + String(e.stderr || e.message).split("\n").slice(0, 3).join(" ")));
    }
  }
}

console.log("");
if (failures) console.log("\x1b[31mRED\x1b[0m: " + failures + " failure(s), " + warnings + " warning(s)");
else console.log("\x1b[32mGREEN\x1b[0m: 0 failures, " + warnings + " warning(s)");
process.exit(failures ? 1 : 0);
