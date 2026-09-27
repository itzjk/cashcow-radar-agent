import { load, source, check, done } from "./engines.mjs";

const G = load(["lib/nsp-gate.js"], { URL }).NSP_GATE;

function click(label, where, extra) {
  const u = new URL("https://" + (where || "shop.example.com/products/1"));
  return G.check(Object.assign({ names: [label], host: u.hostname, path: u.pathname, where: u.host + u.pathname, what: 'click button "' + label + '"' }, extra || {}));
}
const needsPress = d => d && d.ok === false && d.code === "needs_press" && typeof d.kind === "string" && typeof d.line === "string";
const refused = d => d && d.ok === false && d.code === "refused" && typeof d.reason === "string";
const free = d => d && d.ok === true;

const MEASURED_PASSING = ["Place your order", "Place order", "Complete purchase", "Complete order", "Confirm and pay", "Proceed to checkout", "Save", "Refund", "Issue refund", "Cancel order", "Unpublish", "Archive", "Deactivate", "Renew", "Boost", "Promote", "Launch campaign", "Hire", "Accept offer", "Release payment", "Transfer", "Withdraw", "Approve", "Upgrade", "Subscribe", "Apply now", "Message", "Connect"];
const MONEY_OUT = ["Release payment", "Transfer", "Withdraw"];
check("the design lists 28 labels that passed without a press", MEASURED_PASSING.length === 28, MEASURED_PASSING.length);

for (const label of MEASURED_PASSING) {
  if (MONEY_OUT.includes(label)) continue;
  const where = label === "Save" ? "admin.shopify.com/store/x/products/1" : "shop.example.com/products/1";
  const d = click(label, where);
  check('"' + label + '" now needs a press', needsPress(d), d);
}
for (const label of MONEY_OUT) {
  const d = click(label);
  check('"' + label + '" is refused, a press cannot allow it', refused(d), d);
}

const NAMED = [
  ["Place your order", "Pay"], ["Complete purchase", "Pay"], ["Refund", "Pay"], ["Archive", "Delete"], ["Unpublish", "Delete"],
  ["Boost", "Pay"], ["Promote", "Pay"], ["Hire", "Pay"], ["Accept offer", "Pay"], ["Subscribe", "Pay"], ["Upgrade", "Pay"],
  ["Cancel order", "Delete"], ["Deactivate", "Delete"], ["Launch campaign", "Pay"], ["Renew", "Pay"], ["Confirm and pay", "Pay"],
  ["Message", "Send"], ["Invite to connect", "Send"], ["Apply now", "Send"], ["Submit a proposal", "Send"], ["Leave review", "Send"]
];
for (const [label, kind] of NAMED) {
  const d = click(label);
  check('"' + label + '" asks as ' + kind, needsPress(d) && d.kind === kind, d);
}

for (const where of ["admin.shopify.com/store/x/products/1", "shop.myshopify.com/admin/products/1", "sellercentral.amazon.com/inventory", "kdp.amazon.com/en_US/bookshelf", "www.etsy.com/your/shops/me/tools/listings", "blog.example.com/wp-admin/post.php", "business.google.com/locations", "adsmanager.facebook.com/adsmanager/manage", "dashboard.stripe.com/settings"]) {
  check("Save needs a press on the admin host " + where.split("/")[0], needsPress(click("Save", where)), click("Save", where));
  check("Update needs a press on the admin host " + where.split("/")[0], needsPress(click("Update product", where)), click("Update product", where));
}
check("Save stays free on a page that is not an admin", free(click("Save", "www.example.com/recipes/1")), click("Save", "www.example.com/recipes/1"));
check("etsy.com outside /your is not an admin", free(click("Save", "www.etsy.com/listing/1")));

const NEVER = [
  "Withdraw funds", "Withdraw", "Transfer", "Transfer to bank", "Release payment", "Approve & release payment", "Request payout", "Payouts", "Cash out",
  "Add bank account", "Edit bank details", "Change password", "Reset password", "Turn on 2FA", "Two-factor authentication", "Set up 2-step verification",
  "Change email", "Update email address", "Create API key", "Regenerate API key", "Reveal secret key", "Generate token", "Delete account", "Close account",
  "Transfer ownership"
];
for (const label of NEVER) {
  const d = click(label);
  check('"' + label + '" is never done', refused(d), d);
  const forced = G.check({ names: [label], host: "shop.example.com", path: "/", what: "x", kind: "Pay" });
  check('"' + label + '" stays refused even when a press is asked for', refused(forced), forced);
}
check("a refusal names what and where", /Withdraw funds.*shop\.example\.com\/products\/1: it moves money/.test(click("Withdraw funds").reason), click("Withdraw funds").reason);
check("the never list does not stop a link that only navigates", free(click("Transfer window news", "www.youtube.com/results", { link: true })), click("Transfer window news", "www.youtube.com/results", { link: true }));
for (const label of ["Withdraw funds", "Withdraw", "Release payment", "Request payout", "Payouts", "Cash out", "Transfer to bank", "Send money", "Add bank account", "Transfer ownership", "Delete account", "Close my account"]) {
  const d = click(label, "seller.example.com/balance", { link: true });
  check('a link labelled "' + label + '" is refused outside YouTube', refused(d), d);
}
check("a money-out link on a checkout path is refused, not waved through as navigation", refused(click("Withdraw funds", "seller.example.com/billing", { link: true })));
check("a link only counts when its own label starts with the words", free(click("How to withdraw funds safely", "blog.example.com/", { link: true })) && free(click("Our payouts policy explained in detail", "blog.example.com/", { link: true })));
check("a link to the password settings page still navigates", free(click("Change password", "shop.example.com/account", { link: true })));
check("an ancestor label of a link counts only when it starts with the words", refused(G.check({ names: ["", "Withdraw funds"], host: "seller.example.com", path: "/", link: true, what: "click" })) && free(G.check({ names: ["Open", "Learn how to withdraw"], host: "seller.example.com", path: "/", link: true, what: "click" })));

const card = { cardFields: true };
check("with card fields on the page any button counts as Pay", needsPress(click("Continue", "shop.example.com/step", card)) && click("Continue", "shop.example.com/step", card).kind === "Pay");
check("with a Stripe frame on the page any button counts as Pay", needsPress(click("Next", "shop.example.com/step", { payFrame: true })));
check("a link on that page is still free", free(click("Return to cart", "shop.example.com/step", Object.assign({ link: true }, card))));
for (const path of ["/checkout", "/checkouts/cn/abc", "/cart", "/payment/method", "/billing", "/settings/payouts", "/upgrade", "/plans"]) {
  const d = click("Continue", "shop.example.com" + path);
  check("a click on " + path + " needs a press", needsPress(d) && d.kind === "Pay", d);
}
check("a navigation link on a checkout path is free", free(click("Back to shop", "shop.example.com/checkout", { link: true })));
check("a path that only looks like cart is not a checkout path", free(click("Continue", "shop.example.com/cartoons")));

check("an admin form submit needs a press", needsPress(click("Apply", "blog.example.com/wp-admin/edit.php", { submit: true, method: "get" })));
check("an admin search submit stays free", free(click("Search", "blog.example.com/wp-admin/edit.php", { submit: true, method: "get" })));
check("an admin Filter submit stays free", free(click("Filter", "blog.example.com/wp-admin/edit.php", { submit: true, method: "get" })));
check("an admin Next page submit stays free", free(click("Next page", "admin.shopify.com/store/x/orders", { submit: true })));
check("an unknown submit in a POST form needs a press", needsPress(click("Continue", "forum.example.com/new", { submit: true, method: "post" })));
check("and it asks as Send", click("Continue", "forum.example.com/new", { submit: true, method: "post" }).kind === "Send");
check("a GET form submit stays free", free(click("Go", "www.example.com/find", { submit: true, method: "get" })));
check("Add to cart in a POST form stays free", free(click("Add to cart", "shop.example.com/products/1", { submit: true, method: "post" })));
check("Enter in a search field of a GET form stays free", free(G.check({ names: ["Search"], host: "www.youtube.com", path: "/", field: true, submit: true, method: "get", what: "send" })));
check("Enter in a field of a POST form needs a press", needsPress(G.check({ names: ["Title"], host: "forum.example.com", path: "/new", field: true, submit: true, method: "post", what: "send" })));
check("a forced Send kind always needs a press", needsPress(G.check({ names: ["Add a comment"], host: "www.youtube.com", path: "/watch", field: true, kind: "Send", what: "send" })));

const YT = "www.youtube.com/watch";
for (const label of ["Subscribe", "Subscribe to Veritasium.", "Like", "like this video along with 1,234 other people", "Dislike this video", "Upgrade", "Suscribirse", "Suscribirme a Rick Astley.", "Me gusta este video", "No me gusta este video"]) {
  check('"' + label + '" stays free on YouTube', free(click(label, YT)), click(label, YT));
}
check("Subscribe stays free on m.youtube.com", free(click("Subscribe", "m.youtube.com/watch")));
check("Subscribe needs a press outside YouTube", needsPress(click("Subscribe", "www.substack.example/about")));
check("the Spanish Subscribe needs a press outside YouTube", needsPress(click("Suscribirse", "www.substack.example/about")));
check("a host that only ends like youtube.com is not YouTube", needsPress(click("Subscribe", "notyoutube.com/x")));

const OLD = [["Pay now", "Pay"], ["Buy now", "Pay"], ["Checkout", "Pay"], ["Join", "Pay"], ["Publish listing", "Publish"], ["Post", "Publish"], ["Upload video", "Publish"], ["Send proposal", "Send"], ["Reply", "Send"], ["Report", "Send"], ["Delete", "Delete"], ["Remove from playlist", "Delete"], ["Clear all watch history", "Delete"], ["Publicar", "Publish"], ["Eliminar", "Delete"], ["Enviar", "Send"], ["Comprar", "Pay"], ["Hazte miembro", "Pay"]];
for (const [label, kind] of OLD) {
  check('"' + label + '" keeps asking as ' + kind + " on YouTube", needsPress(click(label, YT)) && click(label, YT).kind === kind, click(label, YT));
}
check("an old word still asks on a navigation link, as before", needsPress(click("Upload video", YT, { link: true })));
check("a new word does not stop a video link", free(click("Review of the new phone", "www.youtube.com/results", { link: true })));
check("the YouTube comment button id still asks as Send", needsPress(G.check({ names: [""], ids: ["", "submit-button"], host: "www.youtube.com", path: "/watch", what: "click" })));
check("leading symbols are ignored", needsPress(click("+ Upload", YT)));
check("the confirm line keeps its shape", click("Delete", YT).line === 'Delete: click button "Delete" on www.youtube.com/watch', click("Delete", YT).line);
check("an ordinary button stays free", free(click("Filters", "www.youtube.com/results")) && free(click("Show more", YT)) && free(click("Continue", "shop.example.com/products/1")));
check("an ancestor label only counts when it starts with the word", free(G.check({ names: ["Open menu", "Ways to transfer money explained"], host: "www.example.com", path: "/", what: "x" })));

const SENSITIVE = ["Card number", "Name on card", "Cardholder name", "Expiration date", "Expiry (MM/YY)", "MM / YY", "Security code", "CVV", "Routing number", "API key", "Tax ID", "VAT number", "Access token", "Password", "One-time code", "IBAN", "Bank account number"];
for (const hint of SENSITIVE) check('"' + hint + '" is a sensitive field', G.sensitiveField({ hint }) === true, hint);
for (const hint of ["Search", "Email", "Phone", "Promo code", "Discount code", "Coupon", "Add a comment...", "Title", "Description", "Channel name"]) {
  check('"' + hint + '" is an ordinary field', G.sensitiveField({ hint }) === false, hint);
}
check("a password input is sensitive whatever its label", G.sensitiveField({ type: "password", hint: "Name" }) === true);
check("an autocomplete cc- field is sensitive", G.sensitiveField({ autocomplete: "cc-exp", hint: "Month" }) === true);
check("ids with separators are read as words", G.sensitiveField({ hint: "api_key" }) === true && G.sensitiveField({ hint: "tax-id" }) === true);

check("payment frames are recognised by host", G.paymentFrame("https://js.stripe.com/v3/elements-inner-card.html") && G.paymentFrame("https://www.paypal.com/smart/buttons") && G.paymentFrame("https://shop.app/pay") && !G.paymentFrame("https://www.youtube.com/embed/x") && !G.paymentFrame("https://evilstripe.com/x"));

const SHOP_ADMIN = "https://example-shop.com/admin/orders/1";
for (const [label, want] of [["Fulfill items", "Fulfill"], ["Fulfill", "Fulfill"], ["Mark as fulfilled", "Fulfill"], ["Mark as shipped", "Fulfill"], ["Confirm shipment", "Fulfill"], ["DM", "Send"], ["Direct message", "Send"], ["Send DM", "Send"]]) {
  const d = click(label, SHOP_ADMIN);
  check('"' + label + '" waits for a press as ' + want + " on any site, the words the last check flagged", needsPress(d) && d.kind === want, d);
}
check("Fulfill is one of the kinds the gate names", G.kinds.includes("Fulfill") && G.version === 4);
for (const label of ["Place your order", "Boost listing", "Promote", "Launch campaign", "Set daily budget", "Renew", "Upgrade", "Refund", "Buy shipping label", "Confirm and pay"]) {
  const d = click(label);
  check('"' + label + '" asks as Pay and counts as spending', needsPress(d) && d.kind === "Pay" && d.spend === true, d);
}
for (const label of ["Boost listing", "Promote", "Launch campaign", "Set daily budget", "Increase budget", "Boost post", "Increase ad budget", "Edit campaign daily budget", "Buy ad credits"]) {
  check('"' + label + '" is ad spend a measured test informs, so it needs evidence first', click(label).informed === true, click(label));
}
for (const label of ["Place your order", "Renew", "Upgrade", "Buy shipping label", "Confirm and pay", "Buy now", "Buy ad-free plan"]) {
  check('"' + label + '" is an ordinary purchase: the Pay press, no A/B test needed', click(label).informed === false, click(label));
}
for (const [label, where] of [["Zahlungspflichtig bestellen", "shop.example/kasse/"], ["Jetzt kaufen", "shop.example/order/review"], ["Kostenpflichtig bestellen", "shop.example/products/1"], ["Commander", "shop.example/panier/validation"], ["Valider ma commande", "shop.example/products/1"], ["Finalizar pedido", "shop.example/products/1"], ["Acquista ora", "shop.example/products/1"], ["Bestellen", "shop.example/products/1"], ["Order now", "shop.example/products/1"], ["Start free trial", "shop.example/products/1"]]) {
  const d = click(label, where);
  check('"' + label + '" places an order, so it waits for the Pay press', needsPress(d) && d.kind === "Pay" && d.spend === true, d);
}
check("inside a POST form a final-order button still asks as Pay, not Send", click("Zahlungspflichtig bestellen", "shop.example/kasse/", { submit: true, method: "post" }).kind === "Pay" && click("Place order", "shop.example/checkout", { submit: true, method: "post", ids: ["place_order"] }).kind === "Pay");
check("WooCommerce's place_order button asks as Pay whatever its label", click("Weiter", "shop.example/kasse/", { ids: ["place_order"] }).kind === "Pay");
check("localized cart and checkout paths count as payment pages", ["/kasse/", "/panier/validation", "/carrito", "/warenkorb", "/order/review"].every(p => G.checkoutPath(p)));
for (const label of ["Add to cart", "Weiter einkaufen", "Seguir comprando", "Order history", "Voir ma commande", "Ordina per prezzo"]) {
  check('"' + label + '" on a product page stays free', free(click(label)), click(label));
}
for (const label of ["Capture payment", "Mark as paid", "Collect payment", "Charge customer", "Mark order as paid"]) {
  const d = click(label, SHOP_ADMIN, { kind: "Pay" });
  check('"' + label + '" asks as Pay but brings money in, so it is not spending', needsPress(d) && d.kind === "Pay" && d.spend === false, d);
}
check("a payment page press counts as spending", click("Continue", "shop.example.com/checkout").spend === true && click("Continue", "shop.example.com/products/1", { cardFields: true }).spend === true);
check("a press that is not Pay carries no spending flag", !("spend" in click("Publish")) && !("spend" in click("Delete")));
check("the hands pass the spending flag on with the press", /out\.spend = d\.spend !== false/.test(source("lib/nsp-hands.js")));
check("hands that confirm in the page themselves ask an evidence hook before a spending press, and without one say what is missing", /var spends = d\.kind === 'Pay' && d\.spend !== false && d\.informed === true;/.test(source("lib/nsp-hands.js")) && /typeof hooks\.evidence === 'function'/.test(source("lib/nsp-hands.js")) && /code: 'needs_evidence'/.test(source("lib/nsp-hands.js")));
check("a Fulfill link that only opens a page stays free", free(click("Fulfillment settings", SHOP_ADMIN, { link: true })) && free(click("Unfulfilled", SHOP_ADMIN, { link: true })));
{
  const rules = G.compileRules({ press: [{ kind: "Fulfill", source: "^(complete (the )?order)\\b" }, { kind: "Nope", source: "^x" }, { kind: "Pay", source: "(" }], never: [{ why: "it is the playbook's own no", source: "^(disavow)" }, { source: "^y" }] });
  check("playbook words compile, and a bad kind, a broken pattern or a missing reason are dropped", rules.press.length === 1 && rules.never.length === 1 && typeof rules.press[0].re.test === "function");
  check("a playbook word outranks the general word list", click("Complete order", "https://www.etsy.com/your/orders", { rules }).kind === "Fulfill" && click("Complete order", "https://shop.example.com/checkout").kind === "Pay");
  check("a playbook never refuses even with a press forced", refused(click("Disavow links", "https://search.google.com/search-console", { rules, kind: "Pay" })));
  check("playbook words never reach a field's typing check", free(G.check({ names: ["Complete order"], host: "www.etsy.com", path: "/", field: true, what: "type", rules })));
  check("the hands compile the words they are given once and pass them to every check", /G\.compileRules\(hooks\.rules\)/.test(source("lib/nsp-hands.js")) && /rules: RULES/.test(source("lib/nsp-hands.js")));
}

const manifest = JSON.parse(source("manifest.json"));
const main = (manifest.content_scripts || []).find(c => c.world === "MAIN" && (c.js || []).includes("content/nsp-bundle.js"));
const order = main ? main.js : [];
check("the bundle's MAIN list loads the gate, then the hands, then the bundle", order.indexOf("lib/nsp-gate.js") !== -1 && order.indexOf("lib/nsp-gate.js") < order.indexOf("lib/nsp-hands.js") && order.indexOf("lib/nsp-hands.js") < order.indexOf("content/nsp-bundle.js"), order);
const bundle = source("content/nsp-bundle.js");
check("the bundle keeps no copy of the word lists", !/NSP_AGENT_ONE_PRESS|NSP_AGENT_SENSITIVE_FIELD|function nspAgentOnePress/.test(bundle));
check("the hands read the gate and keep no word list of their own", /G\.check\(/.test(source("lib/nsp-hands.js")) && !/checkout\|join/.test(source("lib/nsp-hands.js")));
check("the gate cannot be swapped out from the page", Object.isFrozen(G));

done("gate");
