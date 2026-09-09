// Guía de herramientas — solo cabecera + botón a Opciones.
(function () {
  'use strict';
  TK.mountHead('Guía de herramientas', 'ZERACK · CÓMO USAR');
  var op = document.getElementById('op');
  if (op) op.addEventListener('click', TK.openOptions);
})();
