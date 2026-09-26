import vm from "node:vm";
import zlib from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./sw-harness.mjs";

export { check, done } from "./sw-harness.mjs";

export function load(files, extra) {
  const context = Object.assign({ console }, extra || {});
  vm.createContext(context);
  for (const f of files) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), context, { filename: f });
  return context;
}

export const source = f => readFileSync(join(ROOT, f), "utf8");

function ownerData(name) {
  const path = join(ROOT, "tests/fixtures", name);
  if (existsSync(path)) return path;
  console.log("  ..    skipped: tests/fixtures/" + name + " is the owner's sweep data and is not published, so this test only runs on his machine");
  process.exit(0);
}

export const fixture = name => JSON.parse(readFileSync(ownerData(name), "utf8"));

export function rancho() {
  return fixture("rancho-channel.json").map(v => ({ videoId: v.videoId, title: v.title, viewsNum: v.views, published: v.cuando }));
}

export function titleCorpus() {
  const c = JSON.parse(zlib.gunzipSync(readFileSync(ownerData("title-corpus.json.gz"))).toString("utf8"));
  return c.videos.map(r => ({ titulo: r[0], vph: r[1], vistas: r[2], canal: r[3], tema: r[4], mercado: r[5] }));
}

export function note(text) {
  console.log("  ..    " + text);
}

export const RIVAL = ["lib/nsp-veredicto.js", "lib/nsp-cadencia.js", "lib/nsp-packaging.js", "lib/nsp-rpm-tabla.js", "lib/nsp-rival-formula.js", "lib/nsp-rival-quiebre.js", "lib/nsp-rival-replicable.js", "lib/nsp-rival-expediente.js"];
export const TITLES = ["lib/nsp-rpm-tabla.js", "lib/nsp-packaging.js", "lib/nsp-titulos-senales.js", "lib/nsp-titulos-tabla.js", "lib/nsp-titulos-juicio.js"];
