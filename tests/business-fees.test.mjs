// What a sale leaves on the Phase 4 businesses: the Upwork rate that keeps a take-home target, the digital platforms and plans side by side, a paid newsletter subscription, and KDP eBooks, paperbacks and seller orders, each from the published fees.
import { load, check, done } from "./engines.mjs";

const PB = ["etsy", "shopify", "seo", "builders", "creators", "freelance", "local", "amazon", "newsletter", "digital", "index"].map(f => "knowledge/playbooks/" + f + ".js");
const C = load(["lib/nsp-dinero-equilibrio.js", "lib/nsp-business.js"].concat(PB), { URL });
const B = C.NSP_BUSINESS, P = C.NSP_PLAYBOOKS, E = C.NspDineroEquilibrio;
const even = (id, args) => B.breakEven(args, P.get(id), E);

{
  const r = even("freelance", { takeHome: 20, feePct: 10 });
  check("to keep $20 an hour at a 10% fee, bid $22.22, the example on Upwork's page", r.ok && r.rateToBid === 22.22 && r.feePct === 10 && r.feeAssumed === false, r);
  const a = even("freelance", { takeHome: 40 });
  check("with no fee given, the page's 10% example is used and said to be an example", a.rateToBid === 44.44 && a.feeAssumed === true && /your proposal form shows the real fee/.test(a.line), a.line);
  const k = even("freelance", { price: 60, feePct: 15, connects: 16 });
  check("a $60 rate at 15% keeps $51, and 16 Connects cost $2.40 whether or not you win", k.keep === 51 && k.connectsCost === 2.4 && /whether or not you win/.test(k.line), k.line);
  check("a fee outside 0% to 15% is refused", even("freelance", { takeHome: 20, feePct: 30 }).code === "bad_fee");
  check("with neither a target nor a rate it asks, it never guesses", even("freelance", {}).code === "missing");
}

{
  const g = even("digital", { price: 29 });
  check("a $29 Gumroad sale pays 10% plus $0.50 and 2.9% plus $0.30 of card fees", g.ok && g.fees.map(f => f.amount).join() === "3.4,1.14" && g.marginPerSale === 24.46 && g.assumed && /no cost per copy/.test(g.assumed[0]), g.fees);
  const d = even("digital", { price: 29, plan: "discover" });
  check("from Discover the flat 30% includes processing", d.fees.length === 1 && d.fees[0].amount === 8.7 && d.marginPerSale === 20.3);
  const plus = even("digital", { price: 29, plan: "payhip-plus", salesPerMonth: 50 });
  check("Payhip Plus adds its $29 a month as a fixed cost and says how many sales cover it", plus.fixedMonthly === 29 && plus.salesToCoverFixed === 2 && plus.plan === "Payhip Plus", plus);
  check("every platform is compared at the user's sales: Lemon Squeezy leaves the most at 50 sales of $29", plus.plans[0].plan === "lemonsqueezy" && plus.plans[0].perMonth === 1352.5 && plus.plans.find(x => x.plan === "payhip-pro").perMonth === 1294 && /At 50 sales a month the best is Lemon Squeezy/.test(plus.line), plus.plans);
  const big = even("digital", { price: 29, salesPerMonth: 400 });
  check("at 400 sales a month the Payhip plans overtake the free one", big.plans.findIndex(x => x.plan === "payhip-pro") < big.plans.findIndex(x => x.plan === "payhip"), big.plans.map(x => x.plan));
}

{
  const s = even("newsletter", { price: 8 });
  check("an $8 Substack payment leaves $6.61 after 10%, 2.9% plus $0.30 and 0.7% billing", s.ok && s.feesTotal === 1.39 && s.marginPerSale === 6.61 && s.fees.length === 3, s.fees);
}

{
  const e = even("amazon", { price: 4.99, format: "ebook" });
  check("a $4.99 eBook in the 70% band leaves $3.43 after the $0.06 average delivery cost", e.ok && e.marginPerSale === 3.43 && e.format === "ebook" && /30% of the list price and a delivery cost of \$0\.06/.test(e.fees[0].label), e.fees);
  const high = even("amazon", { price: 14.99, format: "ebook" });
  check("above $12.99 the eBook falls to the 35% option, and says why", high.marginPerSale === 5.25 && /outside the \$2\.99 to \$12\.99 band/.test(high.fees[0].label), high.fees[0]);
  const p = even("amazon", { price: 15, format: "paperback", printCost: 5 });
  check("a $15 paperback with $5 printing leaves $4.00, the example on KDP's page", p.marginPerSale === 4 && p.fees.length === 2, p.fees);
  check("a paperback with no printing cost asks for it", even("amazon", { price: 15, format: "paperback" }).missing.join() === "printCost");
  const s = even("amazon", { price: 40, cost: 12, referralPct: 15 });
  check("a seller order takes the referral fee the user gives and the Professional plan as a monthly cost", s.marginPerSale === 22 && s.fixedMonthly === 39.99 && s.fees[0].amount === 6, s);
  const i = even("amazon", { price: 40, cost: 12, referralPct: 15, plan: "individual" });
  check("on the Individual plan $0.99 goes with every item instead", i.fees.map(f => f.amount).join() === "6,0.99" && i.fixedMonthly === 0);
  check("with no referral fee it asks, because it depends on the category", even("amazon", { price: 40, cost: 12 }).missing.join() === "referralPct");
}

check("creators and local businesses have no fees to work out", even("creators", { price: 10, cost: 1 }).code === "no_fees" && even("local", { price: 10, cost: 1 }).code === "no_fees");

done("business-fees");
