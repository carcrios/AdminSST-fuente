#!/usr/bin/env node
/* ============================================================
   lineas-largas.js — Tope a las líneas kilométricas (v167)
   ------------------------------------------------------------
   Una línea de 600 caracteres con cinco instrucciones seguidas no se
   puede leer ni revisar en un cambio. El portal ya tiene muchas; partirlas
   todas de golpe sería arriesgado. Por eso esto es un TRINQUETE (igual
   que el del lint): lineas-largas.json guarda cuántas líneas de más de
   200 caracteres tiene hoy cada archivo, y la prueba falla si en alguno
   SUBEN o si un archivo nuevo trae alguna. Solo puede bajar.

   Se revisa el código que se escribe a mano: los .js del sitio (common.js
   por sus partes de fuente/common/), los .gs de backends/ y las
   herramientas. No lo generado, lo minificado ni los catálogos de datos.

   Uso:  node herramientas/lineas-largas.js               (revisa)
         node herramientas/lineas-largas.js --actualizar  (después de partir líneas: baja la base)
         node herramientas/lineas-largas.js --detalle archivo.js
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const BASE = path.join(__dirname, 'lineas-largas.json');
const TOPE = 200;
// Generados, de terceros o tablas de datos (una fila larga por registro es su forma natural).
// v169: i18n-xx.js es un diccionario (datos, como los catálogos): sus frases largas no se parten.
const NO = /^(common\.js|fflate\.min\.js|qr\.js|iconos-emoji\.js|preop-formularios\.js|i18n-[a-z]{2}\.js)$|-(catalogo|plantillas|banco|base|guias)\.js$|\.min\.js$/;

function archivos() {
  const de = (dir, re) => fs.existsSync(path.join(RAIZ, dir)) ? fs.readdirSync(path.join(RAIZ, dir)).filter((f) => re.test(f)).map((f) => (dir ? dir + '/' : '') + f) : [];
  return de('', /\.js$/).filter((f) => !NO.test(f))
    .concat(de('fuente/common', /\.js$/), de('backends', /\.gs$/), de('backends/permisos', /\.gs$/), de('herramientas', /\.(js|gs)$/), de('demo', /\.js$/))
    .sort();
}
const largas = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8').split('\n').map((l, i) => [i + 1, l.length]).filter((x) => x[1] > TOPE);
function contar() { const o = {}; archivos().forEach((f) => { const n = largas(f).length; if (n) o[f] = n; }); return o; }
/** Devuelve { subieron: [[archivo, antes, ahora]], bajaron: [...], total } frente a la base guardada. */
function revisar() {
  const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {}, hoy = contar();
  const subieron = [], bajaron = [];
  Object.keys(hoy).forEach((f) => { const a = base[f] || 0; if (hoy[f] > a) subieron.push([f, a, hoy[f]]); });
  Object.keys(base).forEach((f) => { const h = hoy[f] || 0; if (h < base[f]) bajaron.push([f, base[f], h]); });
  return { subieron, bajaron, total: Object.values(hoy).reduce((a, b) => a + b, 0), tope: TOPE };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--actualizar') { const h = contar(); fs.writeFileSync(BASE, JSON.stringify(h, null, 1) + '\n'); console.log('Base actualizada: ' + Object.values(h).reduce((x, y) => x + y, 0) + ' líneas de más de ' + TOPE + ' caracteres en ' + Object.keys(h).length + ' archivos.'); }
  else if (a[0] === '--detalle') { largas(a[1]).forEach(([n, c]) => console.log(a[1] + ':' + n + '  ' + c + ' caracteres')); }
  else {
    const r = revisar();
    r.subieron.forEach(([f, x, y]) => console.error('✗ ' + f + ': ' + y + ' líneas de más de ' + TOPE + ' caracteres (antes ' + x + '). Pártelas: node herramientas/lineas-largas.js --detalle ' + f));
    if (r.subieron.length) process.exit(1);
    console.log('Líneas largas: ' + r.total + ' en total, ninguna nueva.' + (r.bajaron.length ? ' Bajaron en ' + r.bajaron.length + ' archivo(s): corre --actualizar para fijar la mejora.' : ''));
  }
}
module.exports = { revisar, contar, archivos, TOPE };
