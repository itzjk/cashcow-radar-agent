(function (raiz) {
  'use strict';

  function veredicto() {
    return raiz.NSP_VEREDICTO || (typeof NSP_VEREDICTO !== 'undefined' ? NSP_VEREDICTO : null);
  }

  var MIN_JOVENES = 3;
  var JOVENES_PARA_CERRAR = 5;

  function canales(n, reciente) {
    return n + ' ' + (reciente ? 'recent ' : '') + (n === 1 ? 'channel' : 'channels');
  }

  function medir(saturacion) {
    var V = veredicto();
    var MIRARLO = V ? V.MIRARLO : 'HAY QUE MIRARLO';

    if (!saturacion || !saturacion.ok) {
      return {
        ok: false,
        veredicto: MIRARLO,
        etiqueta: V ? V.etiqueta(MIRARLO) : 'LOOK AT IT',
        cifra: '',
        razon: (saturacion && saturacion.razon) || 'There is no saturation reading, so the door cannot be called open or shut.'
      };
    }

    var jov = saturacion.jovenes;
    var lleg = saturacion.jovenesQueAterrizan;
    var piso = saturacion.pisoUtil.toLocaleString('en-US');
    var palabra, razon, cifra, accion;

    if (jov === 0) {
      palabra = MIRARLO;
      cifra = '0 of ' + canales(saturacion.canales) + ' can be proven younger than ' + saturacion.jovenDias + ' days';
      razon = 'Nobody new can be measured here. That is not a closed door and it is not an open one: it is a niche where nothing recent was swept. Sweep newer channels before deciding.';
      accion = 'Sweep more channels, sorted by newest, before opening anything.';
    } else if (lleg > 0 && jov >= MIN_JOVENES) {
      palabra = V ? V.SIRVE : 'SIRVE';
      cifra = lleg + ' of ' + canales(jov) + ' opened in the last ' + saturacion.jovenDias + ' days already ' + (lleg === 1 ? 'clears ' : 'clear ') + piso + ' median views';
      razon = 'Newcomers enter and they land. The door is open and somebody walked through it recently, which is the only proof that matters.';
      accion = 'Open here. Copy the format of the youngest channel that landed, not the biggest one.';
    } else if (lleg === 0 && jov >= JOVENES_PARA_CERRAR) {
      palabra = V ? V.NO_SIRVE : 'NO SIRVE';
      cifra = '0 of ' + canales(jov) + ' opened in the last ' + saturacion.jovenDias + ' days clear ' + piso + ' median views';
      razon = jov + ' channels tried recently and not one is landing. The incumbents hold the audience and a new channel would be the ' + (jov + 1) + 'th to bounce off.';
      accion = 'Do not open here. Take the format to another language or another niche.';
    } else if (lleg > 0) {
      palabra = MIRARLO;
      cifra = lleg + ' of ' + canales(jov, true) + (lleg === 1 ? ' lands' : ' land') + ', but only ' + canales(jov, true) + (jov === 1 ? ' was' : ' were') + ' swept';
      razon = 'Somebody new is landing, but with only ' + canales(jov, true) + ' that could be one lucky operator rather than an open door. ' + MIN_JOVENES + ' recent channels are needed before betting a channel on it.';
      accion = 'Sweep more recent channels in this niche and read this again.';
    } else {
      palabra = MIRARLO;
      cifra = '0 of ' + canales(jov, true) + (jov === 1 ? ' clears ' : ' clear ') + piso + ' median views';
      razon = (jov === 1 ? 'The one recent arrival is not landing, and one is' : 'The recent arrivals are not landing, but there are only ' + jov + ' of them, and that is') + ' too few to call the niche shut: ' + JOVENES_PARA_CERRAR + ' are needed before that word is used.';
      accion = 'Sweep more recent channels before ruling this niche out.';
    }

    return {
      ok: true,
      veredicto: palabra,
      etiqueta: V ? V.etiqueta(palabra) : palabra,
      cifra: cifra,
      razon: razon,
      accion: accion,
      jovenes: jov,
      jovenesQueAterrizan: lleg,
      canales: saturacion.canales,
      pisoUtil: saturacion.pisoUtil,
      minJovenes: MIN_JOVENES,
      jovenesParaCerrar: JOVENES_PARA_CERRAR
    };
  }

  raiz.NSP_RIVAL_VENTANA = { medir: medir, MIN_JOVENES: MIN_JOVENES, JOVENES_PARA_CERRAR: JOVENES_PARA_CERRAR };
})(typeof window !== 'undefined' ? window : globalThis);
