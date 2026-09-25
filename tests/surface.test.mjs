// HTML written to pages goes through allow lists or as text, and the bridge loads before the page world.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, check, done } from "./sw-harness.mjs";

const read = f => readFileSync(join(ROOT, f), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const scripts = manifest.content_scripts || [];

check("the bridge loads before the page world", scripts.findIndex(c => c.js.includes("content/ashlyv-bridge.js")) < scripts.findIndex(c => c.world === "MAIN"));

// 6. The HTML setter works from allow lists, and error text is text.
{
  const bundle = read("content/nsp-bundle.js");
  const tags = (bundle.match(/var TAGS = \{([^}]*)\}/) || [])[1] || "";
  check("the sanitizer keeps an allow list of tags", tags.length > 0 && /DIV: 1/.test(tags), tags.slice(0, 80));
  check("STYLE, SVG, ANIMATE, SET, USE, SCRIPT and IFRAME are not on it", !/\b(?:STYLE|SVG|ANIMATE|SET|USE|SCRIPT|IFRAME|OBJECT|EMBED)\b/.test(tags), tags);
  check("an unlisted tag is removed, not kept", /if \(TAGS\[tag\] !== 1\) \{ kid\.remove\(\); return; \}/.test(bundle) && !/var DROP = \{/.test(bundle));
  check("style attributes cannot load URLs", /url\\s\*\\\(/.test(bundle));
  check("the dashboard writes error messages as text", !/innerHTML\s*=[^;]*err\.message/.test(read("dashboard/dashboard.js")));
  check("ThumbLab writes its status label as text", !/statusEl\.innerHTML\s*=[^;]*label/.test(read("ashlyv/tools/thumblab.js")));
}

done("surface");
