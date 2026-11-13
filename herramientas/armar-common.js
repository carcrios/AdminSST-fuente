#!/usr/bin/env node
/* ============================================================
   armar-common.js — common.js sale de fuente/common/ (v167)
   ------------------------------------------------------------
   common.js llegó a más de 3.600 líneas con 40 módulos distintos. Para
   que se pueda leer y cambiar sin perderse, su código vive ahora en
   fuente/common/, un archivo por tema (01-base, 04-actualizacion-y-cola-
   sin-senal, 05-firma…). common.js es la unión de esos archivos, en
   orden de nombre y SIN cambiar una sola letra: las páginas, el service
   worker y los celulares siguen cargando un solo common.js.

   REGLA: common.js NO se edita a mano. Se cambia la parte en
   fuente/common/ y se corre este comando (publicar.js y subir-version.js
   ya lo hacen solos). La carpeta fuente/ nunca se sube al sitio.

   Uso:  node herramientas/armar-common.js            (arma common.js)
         node herramientas/armar-common.js --check    (¿está al día?)
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const FUENTE = path.join(RAIZ, 'fuente', 'common');
const SALIDA = path.join(RAIZ, 'common.js');

/** Las partes, en el orden en que se unen (por nombre: 01-…, 02-…). */
function partes() {
  return fs.readdirSync(FUENTE).filter((f) => /^\d\d-[\w-]+\.js$/.test(f)).sort();
}
function unir() {
  const p = partes();
  if (!p.length) throw new Error('No hay partes en fuente/common/.');
  return p.map((f) => fs.readFileSync(path.join(FUENTE, f), 'utf8')).join('');
}
/** Escribe common.js. Devuelve true si cambió. */
function armar() {
  const nuevo = unir(), viejo = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (nuevo === viejo) return false;
  fs.writeFileSync(SALIDA, nuevo);
  return true;
}
/** '' si common.js es igual a la unión de las partes; si no, el motivo. */
function revisar() {
  if (!fs.existsSync(SALIDA)) return 'common.js no existe: corre node herramientas/armar-common.js';
  const nuevo = unir(), viejo = fs.readFileSync(SALIDA, 'utf8');
  if (nuevo === viejo) return '';
  const a = nuevo.split('\n'), b = viejo.split('\n'); let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return 'common.js no coincide con fuente/common/ (primera diferencia en la línea ' + (i + 1) + ' de common.js). ' +
    'Si cambiaste una parte, corre node herramientas/armar-common.js. Si editaste common.js a mano, pasa ese cambio a su parte en fuente/common/.';
}
/** En qué parte y línea queda una línea de common.js (para ubicar un error que reporta el navegador). */
function ubicar(linea) {
  let n = 0;
  for (const f of partes()) {
    const c = fs.readFileSync(path.join(FUENTE, f), 'utf8').split('\n').length - 1;
    if (linea <= n + c) return { parte: 'fuente/common/' + f, linea: linea - n };
    n += c;
  }
  return null;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--check') { const m = revisar(); if (m) { console.error('✗ ' + m); process.exit(1); } console.log('common.js al día (' + partes().length + ' partes).'); }
  else if (a[0] === '--linea') { const u = ubicar(Number(a[1])); console.log(u ? 'common.js:' + a[1] + ' → ' + u.parte + ':' + u.linea : 'Esa línea no existe.'); }
  else console.log(armar() ? 'common.js armado con ' + partes().length + ' partes.' : 'common.js ya estaba al día.');
}
module.exports = { armar, revisar, partes, unir, ubicar };
