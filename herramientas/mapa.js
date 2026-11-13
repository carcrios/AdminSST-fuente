#!/usr/bin/env node
/* ============================================================
   mapa.js — MAPA-DEL-CODIGO.md: dónde está cada cosa (v167)
   ------------------------------------------------------------
   Para quien llega al proyecto (o vuelve después de meses): una tabla con
   cada archivo de código, cuánto pesa, qué módulos define y qué pantallas
   lo cargan. Se GENERA leyendo el código, así no se desactualiza: las
   pruebas fallan si el mapa guardado no coincide con el código.

   Uso:  node herramientas/mapa.js            (escribe MAPA-DEL-CODIGO.md)
         node herramientas/mapa.js --check    (¿está al día?)
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'MAPA-DEL-CODIGO.md');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const lista = (dir, re) => fs.existsSync(path.join(RAIZ, dir)) ? fs.readdirSync(path.join(RAIZ, dir)).filter((f) => re.test(f)).sort() : [];
const lineas = (t) => t.split('\n').length - (t.endsWith('\n') ? 1 : 0);

/** Módulos de primer nivel: «const Nombre = {», «const Nombre = (function», «const Nombre = (() =>» y funciones sueltas. */
function modulos(t) {
  const m = [], re = /^const ([A-Z][A-Za-z0-9]+) = (?:\{|\(function|\(\(\) =>|\(\(\)=>|function)/gm; let x;
  while ((x = re.exec(t))) if (!m.includes(x[1])) m.push(x[1]);
  return m;
}
const funciones = (t) => (t.match(/^(?:async )?function [A-Za-z_]\w*/gm) || []).length;
/** Primera línea útil del comentario de cabecera: de qué trata el archivo. */
function titulo(t) {
  const c = /^\/\*[\s\S]*?\*\//.exec(t.replace(/^#![^\n]*\n/, ''));
  if (!c) return '';
  const l = c[0].split('\n').map((s) => s.replace(/^[\s/*=-]+|[\s/*=-]+$/g, '')).filter(Boolean)[0] || '';
  return l.replace(/^[\w.-]+\.(js|gs)\s*[—–-]\s*/, '').replace(/\|/g, '/').slice(0, 110);
}
/** Qué .js locales carga cada pantalla. */
function usos() {
  const u = {};
  lista('', /\.html$/).forEach((h) => { const re = /<script[^>]*\ssrc="([^"?#:]+\.js)"/g, t = leer(h); let x; while ((x = re.exec(t))) (u[x[1]] = u[x[1]] || []).push(h.replace(/\.html$/, '')); });
  return u;
}

function generar() {
  const U = usos(), nHtml = lista('', /\.html$/).length, o = [];
  const fila = (f, t, extra) => '| `' + f + '` | ' + lineas(t) + ' | ' + titulo(t) + ' | ' + extra + ' |';
  const quien = (f) => { const p = U[f] || []; return !p.length ? '—' : p.length >= nHtml - 5 ? 'todas' : p.length > 4 ? p.length + ' pantallas' : p.join(', '); };
  const mods = (t) => { const m = modulos(t); return m.length ? m.slice(0, 14).join(', ') + (m.length > 14 ? '…' : '') : funciones(t) + ' funciones'; };
  o.push('# Mapa del código', '',
    'Generado por `node herramientas/mapa.js` a partir del código: **no se edita a mano**. Dice dónde está cada cosa;',
    'el porqué de las decisiones está en [TRASPASO.md](TRASPASO.md) y cómo sacar una versión, en [RELEASE.md](RELEASE.md).', '',
    '## 1. `common.js`, por partes', '',
    '`common.js` lo cargan todas las pantallas. Se **genera** uniendo estos archivos de `fuente/common/` en orden',
    '(`node herramientas/armar-common.js`). Se cambia la parte, nunca `common.js`. Si el navegador reporta un error en',
    '`common.js:1234`, `node herramientas/armar-common.js --linea 1234` dice en qué parte y línea está.', '',
    '| Parte | Líneas | Módulos que define |', '|---|---|---|');
  lista('fuente/common', /\.js$/).forEach((f) => { const t = leer('fuente/common/' + f); o.push('| `' + f + '` | ' + lineas(t) + ' | ' + mods(t) + ' |'); });
  o.push('', '## 2. Código del sitio', '', '| Archivo | Líneas | De qué trata | Lo cargan |', '|---|---|---|---|');
  lista('', /\.js$/).filter((f) => f !== 'common.js' && !/\.min\.js$/.test(f)).forEach((f) => o.push(fila(f, leer(f), quien(f))));
  o.push('', '## 3. Pantallas', '',
    'Cada pantalla es un `.html` con su código al final (las 5 más grandes lo tienen aparte en `*.app.js`).', '',
    '| Pantalla | Líneas | Scripts propios (además de los comunes) |', '|---|---|---|');
  const comunes = new Set(Object.keys(U).filter((f) => (U[f] || []).length >= nHtml / 2));
  lista('', /\.html$/).forEach((h) => { const t = leer(h), re = /<script[^>]*\ssrc="([^"?#:]+\.js)"/g, s = []; let x; while ((x = re.exec(t))) if (!comunes.has(x[1])) s.push(x[1]); o.push('| `' + h + '` | ' + lineas(t) + ' | ' + (s.join(', ') || '—') + ' |'); });
  o.push('', '## 4. Servidor (Apps Script)', '',
    'Se edita en `backends/`. `servidor-unico/` (por partes) y `servidor-todo-en-uno/` (un solo archivo para pegar) se',
    '**generan** con `node herramientas/armar-servidor-unico.js`.', '', '| Archivo | Líneas | De qué trata | Funciones |', '|---|---|---|---|');
  lista('backends', /\.gs$/).map((f) => 'backends/' + f).concat(lista('backends/permisos', /\.gs$/).map((f) => 'backends/permisos/' + f)).forEach((f) => { const t = leer(f); o.push(fila(f, t, String(funciones(t)))); });
  o.push('', '## 5. Herramientas', '', '| Comando | Para qué |', '|---|---|');
  lista('herramientas', /\.js$/).forEach((f) => o.push('| `node herramientas/' + f + '` | ' + titulo(leer('herramientas/' + f)) + ' |'));
  o.push('', '## 6. Pruebas', '', '| Archivo | Líneas | Qué revisa |', '|---|---|---|',
    '| `pruebas/pruebas.js` | ' + lineas(leer('pruebas/pruebas.js')) + ' | El código: reglas de la casa, servidor simulado, caché, versiones, datos reales que no deben colarse |',
    '| `pruebas/unitarias.js` | ' + lineas(leer('pruebas/unitarias.js')) + ' | Lógica pura: se ejecuta la función y se compara el resultado |',
    '| `pruebas/navegador.js` | ' + lineas(leer('pruebas/navegador.js')) + ' | Un navegador de verdad con tamaño de celular: pantallas, permisos, firmas, sin señal |', '');
  return o.join('\n');
}
function revisar() { return fs.existsSync(SALIDA) && fs.readFileSync(SALIDA, 'utf8') === generar() ? '' : 'MAPA-DEL-CODIGO.md no está al día: corre node herramientas/mapa.js'; }

if (require.main === module) {
  if (process.argv[2] === '--check') { const m = revisar(); if (m) { console.error('✗ ' + m); process.exit(1); } console.log('Mapa al día.'); }
  else { fs.writeFileSync(SALIDA, generar()); console.log('MAPA-DEL-CODIGO.md escrito.'); }
}
module.exports = { generar, revisar, modulos };
