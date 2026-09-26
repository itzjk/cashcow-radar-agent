(function (raiz) {
  'use strict';

  var LADO_BASE = { w: 160, h: 90 };
  var LADO_GRANDE = { w: 480, h: 270 };
  var LADO_FEED = { w: 168, h: 94 };

  function reducir(data, w, h, nw, nh) {
    var out = new Uint8ClampedArray(nw * nh * 4);
    var sx = w / nw, sy = h / nh;
    for (var y = 0; y < nh; y++) {
      var y0 = Math.floor(y * sy);
      var y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) * sy)));
      for (var x = 0; x < nw; x++) {
        var x0 = Math.floor(x * sx);
        var x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) * sx)));
        var r = 0, g = 0, b = 0, n = 0;
        for (var yy = y0; yy < y1; yy++) {
          var fila = yy * w * 4;
          for (var xx = x0; xx < x1; xx++) {
            var i = fila + xx * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
          }
        }
        var o = (y * nw + x) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
      }
    }
    return { data: out, w: nw, h: nh };
  }

  function luma(data, w, h) {
    var n = w * h, l = new Float32Array(n);
    for (var i = 0, p = 0; p < n; i += 4, p++) l[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    return l;
  }

  function energiaBorde(l, w, h) {
    var suma = 0, cuenta = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = y * w + x;
        var gx = l[i + 1] - l[i - 1], gy = l[i + w] - l[i - w];
        suma += Math.sqrt(gx * gx + gy * gy); cuenta++;
      }
    }
    return cuenta ? suma / cuenta : 0;
  }

  function medirPixeles(data, W, H) {
    var n = W * H, sumL = 0, sumL2 = 0, sumSat = 0, minL = 255, maxL = 0;
    var lum = new Float32Array(n);
    for (var i = 0, p = 0; p < n; i += 4, p++) {
      var r = data[i], g = data[i + 1], b = data[i + 2];
      var L = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[p] = L; sumL += L; sumL2 += L * L;
      if (L < minL) minL = L;
      if (L > maxL) maxL = L;
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sumSat += (mx === 0 ? 0 : (mx - mn) / mx);
    }
    var meanL = sumL / n;
    return {
      meanL: meanL,
      stdL: Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL)),
      meanSat: sumSat / n,
      dynRange: maxL - minL,
      edgeAvg: energiaBorde(lum, W, H)
    };
  }

  function cl(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function consejo(tips, codigos, codigo, texto) {
    tips.push(texto);
    codigos.push(codigo);
  }

  function puntuar(m, anchoNativo) {
    var sC = Math.round(cl(m.stdL / 55 * 30, 0, 30));
    var sS = Math.round(cl(m.meanSat / 0.5 * 22, 0, 22));
    var sD = Math.round(cl(m.dynRange / 220 * 16, 0, 16));
    var sComp = Math.round(cl(22 - Math.abs(m.edgeAvg - 14) * 1.3, 0, 22));
    var sB = Math.round(cl(10 - Math.abs(m.meanL - 130) / 12, 0, 10));
    var total = cl(sC + sS + sD + sComp + sB, 0, 100);
    var verdict, color;
    if (total >= 75) { verdict = 'READS STRONG'; color = '#00DC82'; }
    else if (total >= 58) { verdict = 'SOLID'; color = '#7FE3B5'; }
    else if (total >= 40) { verdict = 'NEEDS WORK'; color = '#FFD93D'; }
    else { verdict = 'HARD TO READ'; color = '#FF6B6B'; }
    var tips = [];
    var codigos = [];
    if (sC < 20) consejo(tips, codigos, 'contraste_bajo', 'Raise the CONTRAST: separate the subject from the background with light, shadow or a colored edge.');
    if (sS < 14) consejo(tips, codigos, 'color_pobre', 'More COLOR: saturate oranges, yellows and reds, they stand out in the feed.');
    if (sD < 10) consejo(tips, codigos, 'sin_rango', 'You are missing pure blacks and pure whites, add depth.');
    if (m.edgeAvg > 24) consejo(tips, codigos, 'muy_cargada', 'It is VERY busy: remove elements, leave ONE focal point.');
    else if (m.edgeAvg < 7) consejo(tips, codigos, 'plana', 'It is flat: add an element of intrigue, an arrow, a circle, contrast.');
    if (m.meanL < 80) consejo(tips, codigos, 'oscura_para_movil', 'It is DARK: on a phone screen it barely shows. Raise the exposure.');
    else if (m.meanL > 185) consejo(tips, codigos, 'quemada', 'It is BLOWN OUT: bring the highlights down.');
    var nw = Number(anchoNativo) || 0;
    if (nw && nw < 1000) consejo(tips, codigos, 'poca_resolucion', 'Low resolution (' + nw + 'px): export at 1280x720 so it stays sharp.');
    if (!tips.length) consejo(tips, codigos, 'nada_fuera_de_rango', 'Nothing measured here is out of range. Test it against a variant with the native YouTube thumbnail test.');
    return {
      thumbScore: total, verdict: verdict, color: color,
      breakdown: [
        { label: 'Contrast', score: sC, max: 30, note: 'luminance std ' + Math.round(m.stdL) },
        { label: 'Color / vibrance', score: sS, max: 22, note: Math.round(m.meanSat * 100) + '% saturation' },
        { label: 'Dynamic range', score: sD, max: 16, note: Math.round(m.dynRange) + '/255' },
        { label: 'Composition (1 focus)', score: sComp, max: 22, note: 'clutter ' + m.edgeAvg.toFixed(1) },
        { label: 'Brightness (mobile)', score: sB, max: 10, note: 'mean luma ' + Math.round(m.meanL) }
      ],
      tips: tips,
      tipoCodigos: codigos
    };
  }

  var RETENCION_ALTA = 0.60;
  var RETENCION_BAJA = 0.51;
  var BORDE_MINIMO = 0.5;

  function legibilidadFeed(data, w, h) {
    var grande = reducir(data, w, h, LADO_GRANDE.w, LADO_GRANDE.h);
    var feed = reducir(data, w, h, LADO_FEED.w, LADO_FEED.h);
    var lg = luma(grande.data, grande.w, grande.h);
    var lf = luma(feed.data, feed.w, feed.h);
    var eG = energiaBorde(lg, grande.w, grande.h);
    var eF = energiaBorde(lf, feed.w, feed.h);
    var escala = LADO_FEED.w / LADO_GRANDE.w;

    var sum = 0, sum2 = 0, n = lf.length;
    for (var i = 0; i < n; i++) { sum += lf[i]; sum2 += lf[i] * lf[i]; }
    var media = sum / n;
    var contrasteFeed = Math.sqrt(Math.max(0, sum2 / n - media * media));

    var retencion = eG > BORDE_MINIMO ? cl((eF * escala) / eG, 0, 2) : 0;

    var estado = eG <= BORDE_MINIMO ? 'sin_bordes'
      : (retencion >= RETENCION_ALTA ? 'alta' : (retencion >= RETENCION_BAJA ? 'media' : 'baja'));
    var pct = Math.round(retencion * 100);
    var dice = estado === 'sin_bordes'
      ? 'There is almost no edge energy to begin with: this image is nearly flat, so there is nothing to lose at feed size.'
      : estado === 'alta'
        ? 'Keeps ' + pct + '% of its edge energy at ' + LADO_FEED.w + 'x' + LADO_FEED.h + ', the top quarter of the winners measured.'
        : estado === 'media'
          ? 'Keeps ' + pct + '% of its edge energy at ' + LADO_FEED.w + 'x' + LADO_FEED.h + ', the middle half of the winners measured.'
          : 'Keeps ' + pct + '% of its edge energy at ' + LADO_FEED.w + 'x' + LADO_FEED.h + ', the bottom quarter of the winners measured.';
    return {
      ok: true,
      retencion: Math.round(retencion * 1000) / 1000,
      contrasteFeed: Math.round(contrasteFeed * 10) / 10,
      bordeGrande: Math.round(eG * 100) / 100,
      bordeFeed: Math.round(eF * 100) / 100,
      lado: LADO_FEED.w + 'x' + LADO_FEED.h,
      reduccion: Math.round((w / LADO_FEED.w) * 10) / 10,
      estado: estado,
      dice: dice,
      feed: feed
    };
  }

  var TRAZO_SALTO = 60;
  var DENSIDAD_FILA = 0.10;
  var FILAS_MINIMAS = 4;

  function bandasDeTrazo(data, w, h) {
    var g = reducir(data, w, h, LADO_GRANDE.w, LADO_GRANDE.h);
    var l = luma(g.data, g.w, g.h);
    var W = g.w, H = g.h;
    var densidad = new Float32Array(H);
    for (var y = 0; y < H; y++) {
      var saltos = 0;
      for (var x = 1; x < W - 1; x++) {
        var i = y * W + x;
        if (Math.abs(l[i + 1] - l[i - 1]) > TRAZO_SALTO) saltos++;
      }
      densidad[y] = saltos / W;
    }
    var bandas = [], y0 = -1, hueco = 0;
    for (var yy = 0; yy < H; yy++) {
      if (densidad[yy] >= DENSIDAD_FILA) { if (y0 < 0) y0 = yy; hueco = 0; }
      else if (y0 >= 0) {
        hueco++;
        if (hueco > 2) {
          var y1 = yy - hueco;
          if (y1 - y0 + 1 >= FILAS_MINIMAS) bandas.push([y0, y1]);
          y0 = -1; hueco = 0;
        }
      }
    }
    if (y0 >= 0 && H - y0 >= FILAS_MINIMAS) bandas.push([y0, H - 1]);

    var factor = LADO_FEED.h / H;
    var filas = 0;
    var salida = bandas.map(function (b) {
      var alto = b[1] - b[0] + 1;
      filas += alto;
      var pico = 0;
      for (var y = b[0]; y <= b[1]; y++) if (densidad[y] > pico) pico = densidad[y];
      return {
        desde: Math.round(b[0] / H * 1000) / 10,
        hasta: Math.round((b[1] + 1) / H * 1000) / 10,
        altoFeed: Math.round(alto * factor * 10) / 10,
        densidadPico: Math.round(pico * 1000) / 1000
      };
    });
    var altoMax = salida.reduce(function (a, b) { return Math.max(a, b.altoFeed); }, 0);
    return {
      ok: true,
      bandas: salida,
      cobertura: Math.round(filas / H * 1000) / 10,
      altoFeedMax: altoMax,
      dice: salida.length
        ? salida.length + ' dense stroke band' + (salida.length > 1 ? 's' : '') + ', the tallest ' + altoMax + ' px once the thumbnail is drawn at ' + LADO_FEED.w + 'x' + LADO_FEED.h + '.'
        : 'No dense stroke band found, so there is no text or logo block big enough to measure.'
    };
  }

  var TONOS = 12;

  function paleta(data, w, h) {
    var g = reducir(data, w, h, 120, 68);
    var d = g.data, n = g.w * g.h;
    var pesos = new Float64Array(TONOS);
    var sumSat = 0, sumL = 0, sumL2 = 0, total = 0;
    for (var i = 0, p = 0; p < n; i += 4, p++) {
      var r = d[i] / 255, gr = d[i + 1] / 255, b = d[i + 2] / 255;
      var mx = Math.max(r, gr, b), mn = Math.min(r, gr, b), c = mx - mn;
      var s = mx === 0 ? 0 : c / mx;
      var L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      sumSat += s; sumL += L; sumL2 += L * L; total++;
      if (c < 0.08) continue;
      var hgr;
      if (mx === r) hgr = ((gr - b) / c + 6) % 6;
      else if (mx === gr) hgr = (b - r) / c + 2;
      else hgr = (r - gr) / c + 4;
      var grado = hgr * 60;
      var cubo = Math.floor(grado / (360 / TONOS)) % TONOS;
      pesos[cubo] += s * mx;
    }
    var suma = 0;
    for (var k = 0; k < TONOS; k++) suma += pesos[k];
    var tonos = [];
    for (var t = 0; t < TONOS; t++) {
      tonos.push({ tono: t, grado: Math.round(t * (360 / TONOS) + (360 / TONOS) / 2), peso: suma ? Math.round(pesos[t] / suma * 1000) / 10 : 0 });
    }
    var media = sumL / total;
    return {
      ok: true,
      tonos: tonos,
      dominantes: tonos.slice().sort(function (a, b) { return b.peso - a.peso; }).filter(function (x) { return x.peso >= 8; }).slice(0, 3),
      saturacion: Math.round(sumSat / total * 1000) / 10,
      luma: Math.round(media * 10) / 10,
      contraste: Math.round(Math.sqrt(Math.max(0, sumL2 / total - media * media)) * 10) / 10
    };
  }

  function medirCompleto(data, w, h, anchoNativo) {
    var base = reducir(data, w, h, LADO_BASE.w, LADO_BASE.h);
    var m = medirPixeles(base.data, base.w, base.h);
    var p = puntuar(m, anchoNativo || w);
    return {
      ok: true,
      ancho: w, alto: h,
      medidas: m,
      puntuacion: p,
      feed: legibilidadFeed(data, w, h),
      trazo: bandasDeTrazo(data, w, h),
      paleta: paleta(data, w, h)
    };
  }

  function hayLienzo() {
    return typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';
  }

  function lienzo(w, h) {
    if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  var CORS = 'Could not read the pixels: the image comes from another domain (CORS). Upload the file instead of pasting the URL.';

  function analizarImagen(img) {
    try {
      if (!hayLienzo()) return { error: 'No canvas available in this context.' };
      var c = lienzo(LADO_BASE.w, LADO_BASE.h);
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, LADO_BASE.w, LADO_BASE.h);
      var data;
      try { data = ctx.getImageData(0, 0, LADO_BASE.w, LADO_BASE.h).data; }
      catch (e) { return { error: CORS }; }
      return puntuar(medirPixeles(data, LADO_BASE.w, LADO_BASE.h), img.naturalWidth || 0);
    } catch (e) {
      return { error: 'Analysis error: ' + (e && e.message || e) };
    }
  }

  var TOPE_LADO = 1280;

  function pixelesDeImagen(img) {
    if (!hayLienzo()) return { ok: false, motivo: 'sin_lienzo', razon: 'No canvas available in this context.' };
    var w = img.naturalWidth || img.width || 0, h = img.naturalHeight || img.height || 0;
    if (!w || !h) return { ok: false, motivo: 'sin_imagen', razon: 'The image has no pixels to read.' };
    if (w > TOPE_LADO) { h = Math.max(1, Math.round(h * (TOPE_LADO / w))); w = TOPE_LADO; }
    var c = lienzo(w, h);
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    try { return { ok: true, data: ctx.getImageData(0, 0, w, h).data, w: w, h: h, nativo: img.naturalWidth || w }; }
    catch (e) { return { ok: false, motivo: 'cors', razon: CORS }; }
  }

  function analizarImagenCompleta(img) {
    var px = pixelesDeImagen(img);
    if (!px.ok) return px;
    var out = medirCompleto(px.data, px.w, px.h, px.nativo);
    out.nativo = px.nativo;
    return out;
  }

  function caraEnMiniatura(url) {
    var caras = raiz.NspCaras || (typeof NspCaras !== 'undefined' ? NspCaras : null);
    if (!caras) return Promise.resolve({ ok: false, motivo: 'sin_motor', razon: 'The face engine is not loaded on this page.' });
    return caras.mirarUna(url).then(function (v) {
      if (!v || !v.soportado || v.incierto) {
        return { ok: false, motivo: 'sin_veredicto', razon: 'The face engine could not check this thumbnail, and what was not checked is not the same as having no face.' };
      }
      return {
        ok: true,
        cara: !!v.cara,
        caras: v.caras || 0,
        dice: v.cara
          ? (v.caras === 1 ? 'One face detected on the thumbnail.' : v.caras + ' faces detected on the thumbnail.')
          : 'No face detected on the thumbnail.'
      };
    }, function () {
      return { ok: false, motivo: 'sin_veredicto', razon: 'The face engine failed on this thumbnail.' };
    });
  }

  raiz.NspMiniatura = {
    LADO_BASE: LADO_BASE,
    LADO_GRANDE: LADO_GRANDE,
    LADO_FEED: LADO_FEED,
    RETENCION_ALTA: RETENCION_ALTA,
    RETENCION_BAJA: RETENCION_BAJA,
    BORDE_MINIMO: BORDE_MINIMO,
    reducir: reducir,
    luma: luma,
    energiaBorde: energiaBorde,
    medirPixeles: medirPixeles,
    puntuar: puntuar,
    legibilidadFeed: legibilidadFeed,
    bandasDeTrazo: bandasDeTrazo,
    paleta: paleta,
    medirCompleto: medirCompleto,
    analizarImagen: analizarImagen,
    pixelesDeImagen: pixelesDeImagen,
    analizarImagenCompleta: analizarImagenCompleta,
    caraEnMiniatura: caraEnMiniatura
  };
})(typeof self !== 'undefined' ? self : this);
