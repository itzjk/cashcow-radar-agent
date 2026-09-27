(function(root) {
  if (Object.prototype.hasOwnProperty.call(root, 'NSP_GATE')) return;

  var FAMILIES = [
    {
      kind: 'Publish',
      re: /^(publish|upload|go live|premiere|schedule|post|publicar|subir|programar|estrenar|emitir|carregar|veroffentlichen|hochladen|planen|posten|publier|mettre en ligne|programmer)\b/,
      more: /^(approve|aprobar)\b/
    },
    {
      kind: 'Delete',
      re: /^(delete|remove|discard|erase|trash|clear (all )?(watch |search )?history|eliminar|borrar|quitar|descartar|suprimir|excluir|apagar|remover|loschen|entfernen|verwerfen|supprimer|effacer|retirer)\b/,
      more: /^(archive|deactivate|unpublish|cancel (the |this |my |your )?(order|subscription|membership|plan|listing|booking)|archivar|desactivar|despublicar|cancelar (el |la |mi |tu )?(pedido|orden|suscripcion|membresia|plan))\b/
    },
    {
      kind: 'Send',
      re: /^(send|submit|reply|comment|report|flag|enviar|responder|comentar|denunciar|reportar|senden|absenden|antworten|kommentieren|melden|envoyer|soumettre|repondre|commenter|signaler)\b/,
      more: /^(dm|direct message|send (a )?(dm|direct message)|message|invite|connect|apply( now| for| to| with)?(?! (filters?|coupons?|codes?|discounts?|promo))|easy apply|quick apply|review|leave (a )?(review|feedback)|write (a )?review|mensaje|invitar|conectar|postular|postularme|aplicar ahora|resena|dejar (una )?resena)\b/
    },
    {
      kind: 'Fulfill',
      re: /^(fulfill|mark (it |this |the )?(orders? )?as (fulfilled|shipped|dispatched)|confirm shipment|ship (the |this )?order)\b/,
      more: /^(marcar como (enviado|preparado|despachado))\b/
    },
    {
      kind: 'Pay',
      re: /^(buy|purchase|pay|checkout|join|rent|donate|tip|super thanks|super chat|comprar|pagar|unirme|unirse|hazte miembro|alquilar|donar|assinar|seja membro|kaufen|bezahlen|beitreten|mieten|spenden|acheter|payer|rejoindre|louer|faire un don)\b/,
      more: /^(place|complete (my |your |the )?(purchase|order|checkout|payment|booking|transaction|subscription)|confirm (and|&) pay|confirm (the )?(purchase|payment|order|booking|subscription)|proceed to (checkout|payment|pay)|boost|promote|launch|budget|(set|increase|raise|change|edit|update|adjust) (the |your |my )?([a-z]+ ){0,2}budget|renew|hire|accept (the |this |an? )?(offer|proposal|contract|quote|bid)|subscribe|upgrade|(issue (a )?|give (a )?)?refund|realizar (el )?pedido|finalizar (la )?compra|confirmar (y pagar|compra|pago|pedido)|contratar|renovar|promocionar|impulsar|reembolsar|reembolso|suscribirme|suscribirse|mejorar (el )?plan)\b/
    }
  ];

  var KINDS = { Publish: 1, Delete: 1, Send: 1, Pay: 1, Fulfill: 1 };

  var IDS = { 'submit-button': 'Send', 'send-button': 'Send', 'publish-button': 'Publish', 'upload-button': 'Publish', 'delete-button': 'Delete', 'place_order': 'Pay', 'place-order': 'Pay', 'placeorder': 'Pay', 'submit-order': 'Pay', 'submit_order': 'Pay' };

  var ORDER = /\b(?:bestellen|kaufen|zahlungspflichtig|kostenpflichtig|commander|(?:valider|passer|confirmer) (?:ma |la |votre )?commande|acquista(?:re)?|comprar|finalizar (?:el )?pedido|confirmar (?:el )?pedido|realizar (?:el )?pedido|hacer (?:el )?pedido|order now|buy now|pay now|start (?:my |your |a |the )?(?:free )?trial|start (?:my |your |the )?subscription|subscribe now)\b/;
  var ORDER_WORDS = 5;

  var INFORMED = /\b(?:boost\w*|promot\w*|campaigns?|budgets?|adverti\w*|sponsor\w*|impulsar|promocion\w*|campanas?|presupuestos?|anuncios?|publicidad)\b|\bads?\b(?!\s?-?\s?free)/;

  var NEVER = [
    { why: 'it hands the account or its assets to someone else', link: true, re: /(^|\s)(transfer|transferir) (the |this |my |your |la |el |mi |tu )?(ownership|owner|channel|account|store|shop|domain|propiedad|canal|cuenta|tienda|dominio)\b/ },
    { why: 'it moves money out of the account', link: true, re: /(^|\s)(withdraw(al|als)?|transfer(s)?|release (the )?(payment|payments|funds|escrow|milestone)|pay ?outs?|cash ?out|send money|wire (money|funds)|retirar|retiro|transferir|transferencia|liberar (el )?pago)\b/ },
    { why: 'it changes bank or payout details', link: true, re: /(^|\s)(bank (account|accounts|details|info|information)|routing number|iban|swift code|datos bancarios|cuenta bancaria)\b/ },
    { why: 'it changes how the account signs in', re: /(^|\s)(passwords?|passcodes?|2fa|mfa|two[ -]?(factor|step)|2[ -]step|authenticator|security (keys?|questions?)|passkeys?|recovery (email|phone|codes?)|backup codes?|contrasena|verificacion en dos pasos)\b/ },
    { why: 'it changes the account email', re: /(^|\s)(change|update|edit|replace|add|remove|verify|cambiar|actualizar) (your |my |the |tu |mi |el )?(email|e-mail|correo)( address)?\b/ },
    { why: 'it creates or reveals an API key or a token', re: /(^|\s)(api ?keys?|access tokens?|secret keys?|(create|generate|regenerate|roll|revoke|reveal|show|copy) (a |an |the |new )*(api |secret |access )?(key|keys|token|tokens|secret))\b/ },
    { why: 'it deletes or closes the whole account', link: true, re: /(^|\s)(delete|close|deactivate|terminate|eliminar|cerrar) (my |your |this |the |mi |tu |la |el )?(account|channel|store|shop|cuenta|canal|tienda)\b/ }
  ];

  var SAFE_SUBMIT = /^(search|filter|filters|apply filters?|sort|preview|next page|previous page|next|previous|prev|add to (cart|bag|basket|wishlist|wish list)|buscar|filtrar|vista previa|siguiente|anterior|anadir al carrito|agregar al carrito)\b/;

  var ADMIN_SAVE = /^(save|update|guardar|actualizar)\b/;

  var MONEY_IN = /^(capture( the)?( payment| funds)?|mark (it |this |the )?(order )?as paid|collect( the)? payment|charge (the |this )?customer|record (a )?payment|accept (a )?payment|marcar como pagad[oa]|cobrar( el pago)?|capturar( el pago)?)\b/;

  var CHECKOUT_PATH = /\/(checkouts?|cart|carts|payments?|billing|payouts?|upgrade|plans|kasse|panier|carrito|warenkorb|carrello|cesta|order\/review|order\/confirm(?:ation)?|review-order|place-order)(\/|$|[._-])/;

  var PAY_FRAME_HOSTS = /(^|\.)(stripe\.com|stripe\.network|paypal\.com|paypalobjects\.com|shop\.app|pay\.shopify\.com|braintreegateway\.com|adyen\.com|squareup\.com|squarecdn\.com|klarna\.com|pay\.google\.com|payments\.google\.com)$/;

  var SENSITIVE = /pass|pwd|\botp\b|one.?time|\b2fa\b|\bmfa\b|totp|verification code|security code|\bcvv|\bcvc|\bcsc\b|credit ?card|card ?number|cardnumber|\biban\b|routing number|account number|secret|token|\bssn\b|social security|\bpin\b|contrasena|clave de acceso|codigo de verificacion|codigo de seguridad|numero de tarjeta|tarjeta de credito|passwort|kennwort|mot de passe/;
  var SENSITIVE_MORE = /name on (the )?card|card ?holder|expir(y|ation)|\bexp (date|month|year)\b|\bmm ?\/ ?yy\b|api ?key|apikey|tax ?(id|number)|taxpayer|\bvat (id|number)\b|\bitin\b|bank ?(account|details|name|code)|sort code|\bswift\b|\bbic\b|nombre (en|de) la tarjeta|titular de la tarjeta|vencimiento|caducidad|fecha de expiracion|numero fiscal|\brfc\b|\bnif\b|\bcuit\b/;

  var PROFILES = {
    youtube: { id: 'youtube', hosts: /(^|\.)youtube\.com$/, free: /^(subscribe|suscribirme|suscribirse|suscribete|upgrade|mejorar|like|dislike|me gusta|no me gusta)\b/ }
  };
  var WEB = { id: 'web', hosts: null, free: null };

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
  }

  function lead(s) {
    return norm(s).replace(/^[^a-z0-9\u00df-\uffff]+/, '');
  }

  function profileFor(host) {
    host = String(host || '').toLowerCase();
    for (var k in PROFILES) {
      if (PROFILES.hasOwnProperty(k) && PROFILES[k].hosts.test(host)) return PROFILES[k];
    }
    return WEB;
  }

  function isAdmin(host, path) {
    host = String(host || '').toLowerCase();
    path = String(path || '/').toLowerCase();
    if (host === 'admin.shopify.com') return true;
    if (/\.myshopify\.com$/.test(host) && /^\/admin(\/|$)/.test(path)) return true;
    if (/^sellercentral(-europe|-japan)?\.amazon\./.test(host)) return true;
    if (host === 'kdp.amazon.com') return true;
    if (/(^|\.)etsy\.com$/.test(host) && /^\/your(\/|$)/.test(path)) return true;
    if (/\/wp-admin(\/|$)/.test(path)) return true;
    if (host === 'business.google.com') return true;
    if (host === 'adsmanager.facebook.com' || host === 'business.facebook.com') return true;
    if (host === 'dashboard.stripe.com') return true;
    return false;
  }

  function checkoutPath(path) {
    return CHECKOUT_PATH.test(String(path || '').toLowerCase());
  }

  function paymentFrame(src) {
    var host = '';
    try { host = String(new URL(String(src || '')).hostname || '').toLowerCase(); } catch (e) { return false; }
    return PAY_FRAME_HOSTS.test(host);
  }

  function place(f) {
    return String(f.where || (String(f.host || '') + String(f.path || '')));
  }

  function spends(f) {
    var names = (f.names || []).map(lead);
    for (var i = 0; i < names.length; i++) {
      if (names[i] && MONEY_IN.test(names[i])) return false;
    }
    return !MONEY_IN.test(lead(f.what));
  }

  function informed(f) {
    var names = (f.names || []).map(lead).concat([lead(f.what)]);
    for (var i = 0; i < names.length; i++) {
      if (names[i] && INFORMED.test(names[i])) return true;
    }
    return false;
  }

  function press(kind, f, rule) {
    var out = { ok: false, code: 'needs_press', kind: kind, rule: rule, line: kind + ': ' + String(f.what || 'act') + ' on ' + place(f) };
    if (kind === 'Pay') {
      out.spend = spends(f);
      out.informed = out.spend && informed(f);
    }
    return out;
  }

  function refuse(why, f) {
    return { ok: false, code: 'refused', why: why, reason: String(f.what || 'this action') + ' on ' + place(f) + ': ' + why };
  }

  function compileRules(rules) {
    var out = { press: [], never: [] };
    if (!rules || typeof rules !== 'object') return out;
    [].concat(rules.never || []).forEach(function(n) {
      try {
        if (n && typeof n.source === 'string' && n.source && n.why) out.never.push({ why: String(n.why), link: n.link === true, re: new RegExp(n.source) });
      } catch (e) {}
    });
    [].concat(rules.press || []).forEach(function(p) {
      try {
        if (p && typeof p.source === 'string' && p.source && KINDS.hasOwnProperty(p.kind)) out.press.push({ kind: p.kind, re: new RegExp(p.source) });
      } catch (e) {}
    });
    return out;
  }

  function check(f) {
    f = f || {};
    var names = (f.names || []).map(lead);
    var ids = (f.ids || []).map(function(x) { return String(x || '').toLowerCase(); });
    var nav = !!f.link;
    var profile = profileFor(f.host);
    var admin = isAdmin(f.host, f.path);
    var i, j, m;
    var linkNever = nav && profile.id !== 'youtube';
    if ((!nav || linkNever) && !f.field) {
      for (i = 0; i < names.length; i++) {
        if (!names[i]) continue;
        for (j = 0; j < NEVER.length; j++) {
          if (nav && !NEVER[j].link) continue;
          m = NEVER[j].re.exec(names[i]);
          if (m && (i === 0 ? names[i].length <= 80 && (!nav || m.index === 0 || names[i].split(' ').length <= 4) : m.index === 0)) return refuse(NEVER[j].why, f);
        }
      }
    }
    var rules = f.rules && f.rules.press && f.rules.never ? f.rules : null;
    if (rules && !f.field) {
      for (i = 0; i < names.length; i++) {
        if (!names[i]) continue;
        for (j = 0; j < rules.never.length; j++) {
          if (nav && !rules.never[j].link) continue;
          if (rules.never[j].re.test(names[i]) && (i === 0 || names[i].length <= 80)) return refuse(rules.never[j].why, f);
        }
      }
    }
    if (f.kind) return press(String(f.kind), f, 'forced');
    if (!f.field) {
      for (i = 0; i < ids.length; i++) {
        if (IDS.hasOwnProperty(ids[i])) return press(IDS[ids[i]], f, 'id');
      }
      for (i = 0; i < names.length; i++) {
        var nm = names[i];
        if (!nm) continue;
        if (profile.free && profile.free.test(nm)) continue;
        if (rules && !nav) {
          for (j = 0; j < rules.press.length; j++) {
            if (rules.press[j].re.test(nm)) return press(rules.press[j].kind, f, 'playbook');
          }
        }
        for (j = 0; j < FAMILIES.length; j++) {
          if (FAMILIES[j].re.test(nm) || (!nav && FAMILIES[j].more.test(nm))) return press(FAMILIES[j].kind, f, 'word');
        }
        if (!nav && nm.split(' ').length <= ORDER_WORDS && !SAFE_SUBMIT.test(nm) && ORDER.test(nm)) return press('Pay', f, 'order_word');
        if (admin && !nav && ADMIN_SAVE.test(nm)) return press('Publish', f, 'admin_word');
      }
    }
    if (nav) return { ok: true };
    if (f.cardFields || f.payFrame) return press('Pay', f, 'payment_page');
    if (checkoutPath(f.path)) return press('Pay', f, 'checkout_path');
    var safe = SAFE_SUBMIT.test(names[0] || '');
    if (f.submit && admin && !safe) return press('Publish', f, 'admin_submit');
    if (f.submit && String(f.method || '').toLowerCase() === 'post' && !safe) return press('Send', f, 'post_submit');
    return { ok: true };
  }

  function sensitiveField(f) {
    f = f || {};
    if (String(f.type || '').toLowerCase() === 'password') return true;
    if (/one-time-code|current-password|new-password|(^|\s)cc-/.test(String(f.autocomplete || '').toLowerCase())) return true;
    var h = norm(f.hint);
    var spaced = h.replace(/[_.:\/-]+/g, ' ');
    return SENSITIVE.test(h) || SENSITIVE_MORE.test(h) || SENSITIVE.test(spaced) || SENSITIVE_MORE.test(spaced);
  }

  root.NSP_GATE = Object.freeze({
    version: 4,
    kinds: Object.keys(KINDS),
    norm: norm,
    check: check,
    compileRules: compileRules,
    sensitiveField: sensitiveField,
    paymentFrame: paymentFrame,
    isAdmin: isAdmin,
    checkoutPath: checkoutPath,
    profileFor: function(host) { return profileFor(host).id; }
  });
})(typeof self !== 'undefined' ? self : this);
