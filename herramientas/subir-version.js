#!/usr/bin/env node
/* ============================================================
   subir-version.js — Sube la versión del portal en TODOS lados a la vez
   ------------------------------------------------------------
   La versión vive en dos sitios que deben coincidir (las pruebas lo exigen):
     · sw.js            const CACHE_NAME = 'ssta-portal-vNNN'
     · cada pantalla    «Portal SSTA · versión vNNN»
   Sin subir CACHE_NAME los celulares siguen mostrando la versión vieja.

   Uso:  node herramientas/subir-version.js          → siguiente (v109 → v110)
         node herramientas/subir-version.js v115     → esa versión exacta
   ============================================================ */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');

function versionActual() {
  const m = /const CACHE_NAME = 'ssta-portal-v(\d+)'/.exec(fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8'));
  if (!m) throw new Error('sw.js: no se encontró CACHE_NAME');
  return Number(m[1]);
}

/** v167: en qué parte de fuente/common/ está una constante de common.js. */
function parteDe(nombre) {
  const dir = path.join(RAIZ, 'fuente', 'common');
  const f = fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort().find((x) => fs.readFileSync(path.join(dir, x), 'utf8').indexOf('const ' + nombre + ' = ') !== -1);
  if (!f) throw new Error('Ninguna parte de fuente/common/ tiene const ' + nombre);
  return 'fuente/common/' + f;
}

function subir(destino) {
  const antes = versionActual();
  const nueva = destino ? Number(String(destino).replace(/^v/i, '')) : antes + 1;
  if (!Number.isInteger(nueva) || nueva <= antes) throw new Error(`La versión nueva (v${nueva}) debe ser mayor que la actual (v${antes}).`);
  const cambiados = [];
  const sw = path.join(RAIZ, 'sw.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(`const CACHE_NAME = 'ssta-portal-v${antes}'`, `const CACHE_NAME = 'ssta-portal-v${nueva}'`));
  cambiados.push('sw.js');
  for (const n of fs.readdirSync(RAIZ)) {
    if (!n.endsWith('.html')) continue;
    const f = path.join(RAIZ, n), t = fs.readFileSync(f, 'utf8');
    const r = t.split(`Portal SSTA · versión v${antes}`).join(`Portal SSTA · versión v${nueva}`);
    if (r !== t) { fs.writeFileSync(f, r); cambiados.push(n); }
  }
  // Constantes de versión: el panel del asesor compara sitio y servidores.
  const CONSTANTES = [
    [parteDe('VERSION_PORTAL_WEB'), 'VERSION_PORTAL_WEB'], ['estado.html', 'VERSION'],
    ['backends/backend-sgsst.gs', 'VERSION_SGSST'], ['herramientas/servidor-unico-portal.gs', 'VERSION_PORTAL']
  ];
  for (const [archivo, nombre] of CONSTANTES) {
    const f = path.join(RAIZ, archivo), t = fs.readFileSync(f, 'utf8');
    const r = t.replace(`const ${nombre} = 'v${antes}'`, `const ${nombre} = 'v${nueva}'`);
    if (r === t) throw new Error(`${archivo}: no se encontró const ${nombre} = 'v${antes}'`);
    fs.writeFileSync(f, r); if (!cambiados.includes(archivo)) cambiados.push(archivo);
  }
  require('./armar-common').armar();   // v167: common.js sale de fuente/common/ (la versión se cambió en su parte)
  require('./csp').carpeta(path.join(__dirname, '..'));   // v163: huellas de los <script> en la CSP
  require('./armar-servidor-unico').armar();   // el servidor único lleva las versiones nuevas
  require('./indice-preop').actualizar();      // la lista corta de preoperacionales del inicio
  cambiados.push('servidor-unico/');
  fs.writeFileSync(path.join(RAIZ, 'MAPA-DEL-CODIGO.md'), require('./mapa').generar());   // v167: el mapa del código, al día con cada versión
  return { antes, nueva, cambiados };
}

if (require.main === module) {
  const r = subir(process.argv[2]);
  console.log(`v${r.antes} → v${r.nueva} en ${r.cambiados.length} archivos.`);
  console.log('Anota los cambios en CHANGELOG.md y corre: node pruebas/pruebas.js');
}
module.exports = { subir, versionActual, parteDe };
