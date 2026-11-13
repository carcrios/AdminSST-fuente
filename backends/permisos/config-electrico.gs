/* ============================================================
   config-electrico.gs — Lo ÚNICO propio del permiso de Trabajo Eléctrico
   ------------------------------------------------------------
   Va junto a core.gs dentro del mismo proyecto de Apps Script.
   core.gs es idéntico en los cinco permisos; este archivo es el que
   los diferencia.

   En Apps Script todos los archivos .gs de un proyecto comparten el
   mismo ámbito global, así que core.gs ve estas constantes sin
   necesidad de importar nada.
   ============================================================ */

const PERMISO_NOMBRE = 'Trabajo Eléctrico';
const PERMISO_CODIGO = 'SSTA-F-180';

// Debe ser IDÉNTICO al API_TOKEN de config.js en el sitio web.
// Para rotarlo, ver el procedimiento en el README.
const API_TOKEN = 'PON-AQUI-EL-TOKEN';
