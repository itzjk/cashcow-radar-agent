// Per-site consent: which sites ZERACK may read or act on, keyed by host and checked against Chrome's own permission.
import { load, check, done } from "./engines.mjs";

const S = load(["lib/nsp-sites.js"], { URL }).NSP_SITES;

check("the host of a web page is its lowercase hostname", S.hostOf("https://Admin.Shopify.com/store/x") === "admin.shopify.com" && S.hostOf("http://127.0.0.1:8765/a") === "127.0.0.1");
check("pages that are not http or https have no host", ["chrome://settings", "chrome-extension://abc/chat.html", "file:///etc/hosts", "javascript:alert(1)", "about:blank", ""].every(u => S.hostOf(u) === ""));
check("the Chrome pattern covers the host on its scheme and every port", S.patternOf("http://127.0.0.1:8765/x?y") === "http://127.0.0.1/*" && S.patternOf("https://www.etsy.com/your/shops") === "https://www.etsy.com/*");
check("the Chrome Web Store is never scriptable", !S.scriptable("https://chromewebstore.google.com/detail/x") && !S.scriptable("https://chrome.google.com/webstore/x") && S.scriptable("https://shop.example.com/"));
check("YouTube hosts are recognised and nothing that only ends like them", S.isYouTube("www.youtube.com") && S.isYouTube("studio.youtube.com") && !S.isYouTube("notyoutube.com") && !S.isYouTube("youtube.com.evil.test"));
check("a site gets the web playbook, YouTube keeps its own", S.playbookFor("admin.shopify.com") === "web" && S.playbookFor("www.youtube.com") === "youtube");

const now = 1700000000000;
let map = S.withSite({}, "Admin.Shopify.com", "act", now);
check("allowing a site stores its mode, playbook and date", JSON.stringify(map) === JSON.stringify({ "admin.shopify.com": { mode: "act", playbook: "web", since: now } }), map);
check("access reads the stored mode", S.accessIn(map, "admin.shopify.com") === "act" && S.accessIn(map, "www.etsy.com") === "none");
map = S.withSite(map, "www.etsy.com", "read", now + 1);
check("read only is its own mode", S.accessIn(map, "www.etsy.com") === "read");
check("act allows reading and acting, read allows only reading", S.allows("act", "act") && S.allows("act", "read") && S.allows("read", "read") && !S.allows("read", "act") && !S.allows("none", "read"));
check("an unknown mode is not stored", JSON.stringify(S.withSite({}, "x.example", "admin", now)) === "{}");
check("a host with a path or a scheme is not a host", JSON.stringify(S.withSite({}, "https://x.example/", "act", now)) === "{}" && JSON.stringify(S.withSite({}, "x.example/admin", "act", now)) === "{}");
map = S.withoutSite(map, "admin.shopify.com");
check("forgetting a site removes it", S.accessIn(map, "admin.shopify.com") === "none" && S.accessIn(map, "www.etsy.com") === "read");
const dirty = { "a.example": { mode: "act", since: 1 }, "b.example": { mode: "root" }, "c d": { mode: "act" }, "d.example": "act", "e.example": { mode: "read", playbook: 7 } };
const clean = S.clean(dirty);
check("stored entries are rebuilt to their shape, and anything else is dropped", JSON.stringify(Object.keys(clean)) === JSON.stringify(["a.example", "e.example"]) && clean["a.example"].playbook === "web" && clean["e.example"].playbook === "web", clean);
let big = {};
for (let i = 0; i < 305; i++) big = S.withSite(big, "s" + i + ".example", "act", now + i);
check("the list keeps the 300 most recent sites", Object.keys(big).length === 300 && !big["s0.example"] && !!big["s304.example"]);
check("the library cannot be replaced once loaded", Object.isFrozen(S));

done("sites");
