#!/usr/bin/env node
/* ============================================================
   empaquetar.js — Arma la entrega completa con UN comando
   ------------------------------------------------------------
   Este repositorio (sitio-de-tu-marca) es la ÚNICA fuente. Todo lo demás
   se genera, así nunca hay dos copias que se desactualicen:

     1. corre las pruebas (si algo sale en rojo, se detiene)
     2. regenera servidor-unico/ desde backends/
     3. copia el sitio a <salida>/sitio-de-tu-marca/
     4. arma la demo en <salida>/sitio-demo/
     5. deja LEEME.txt y CHANGELOG.md en <salida>/

   Uso:  node herramientas/empaquetar.js [carpeta]     (por defecto ../portal-vNNN)
   ============================================================ */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const NO_COPIAR = new Set(['node_modules', '.git', 'sitio-demo']);
const { versionActual } = require('./subir-version');

function copiar(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  for (const d of fs.readdirSync(origen, { withFileTypes: true })) {
    if (NO_COPIAR.has(d.name)) continue;
    const o = path.join(origen, d.name), t = path.join(destino, d.name);
    if (d.isDirectory()) copiar(o, t); else fs.copyFileSync(o, t);
  }
}

function leeme(v) {
  return `PORTAL SSTA v${v}

EMPIEZA POR AQUÍ: abre GUIA-DE-INSTALACION.docx (Word). Todo lo demás lo explica ella.

QUÉ HAY EN ESTA CARPETA
  GUIA-DE-INSTALACION.docx   La guía paso a paso, en palabras sencillas.
  PASO-1-SERVIDOR/           Portal-SSTA.gs: el servidor en UN solo archivo. Se copia y se
                             pega en Google Apps Script (uno por empresa, en SU cuenta).
  PASO-2-SITIO/              Lo que se sube a GitHub, en tandas de menos de 100 archivos:
                               1-paginas/                las pantallas
                               2-archivos/               lo demás (estilos, fuentes, videos…)
                               3-solo-la-primera-vez/    empresa.js y manifest.json (tu marca).
                                                         Al ACTUALIZAR, esta carpeta NO se sube.
  CHANGELOG.md               Qué cambió en cada versión (dice si hay que actualizar servidores).
  COMERCIAL/                 Propuesta, contrato y sus anexos (precios, datos personales, niveles
                             de servicio, revendedor), en Word y PDF. Son para tus clientes: NO se
                             suben a GitHub. Llena los espacios [___] de cada cliente.
  avanzado/                  NO se sube a ningún lado. Guárdalo como respaldo (en tu Drive):
                               sitio-de-tu-marca/  el proyecto completo (pruebas, herramientas,
                                                   servidor por partes). De aquí se parte para
                                                   hacer cambios al portal.
                               sitio-demo/         empresa de ejemplo con datos inventados, para
                                                   mostrarle el portal a un cliente.

CUANDO TE LLEGA UNA VERSIÓN NUEVA: Parte D de la guía (sube 1-paginas y 2-archivos, NUNCA la 3;
y si el CHANGELOG lo pide, pega Portal-SSTA.gs en cada servidor → Gestionar implementaciones →
lápiz → Nueva versión). DÓNDE SE CAMBIA CADA COSA (menús, marca, usuarios): Parte E.

CON VARIAS EMPRESAS (desde avanzado/sitio-de-tu-marca, con Node y clasp; ver INSTALAR-NUEVA-EMPRESA.md):
  node herramientas/instalar-empresa.js --codigo … --nombre "…" --correos …   crea el servidor de una empresa nueva
  node herramientas/actualizar-servidores.js clientes.json --estado          en qué versión va cada empresa
  node herramientas/actualizar-servidores.js clientes.json                   las actualiza todas
`;
}

/* v119: lo que se sube a GitHub, en tandas de menos de 100 archivos (límite de «Upload files»). */
const SOLO_FUENTE = new Set(['backends', 'pruebas', 'herramientas', 'servidor-unico', 'demo', 'node_modules', '.git', '.github', 'sitio-demo', 'comercial', 'fuente']);   // v166: comercial/ (precios y contrato) nunca va al sitio público
/* v175: herramientas de QUIEN VENDE el portal. No van al sitio público: sin el servidor (Portal-SSTA.gs), el
   configurador, la consola, el panel del asesor y el instalador, nadie puede montar el portal por su cuenta.
   Se usan desde la copia privada (herramientas/proveedor.js las abre en el computador). */
const SOLO_PROVEEDOR = new Set(['servidor-todo-en-uno', 'admin.html', 'configurar-empresa.html', 'asesor.html', 'instalar.html', 'consola.css', 'menus-empresa.js']);
function sitioParaSubir(raiz, destino) {
  const t1 = path.join(destino, '1-paginas'), t2 = path.join(destino, '2-archivos'), t3 = path.join(destino, '3-solo-la-primera-vez');
  [t1, t2, t3].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  for (const d of fs.readdirSync(raiz, { withFileTypes: true })) {
    if (SOLO_FUENTE.has(d.name) || SOLO_PROVEEDOR.has(d.name) || d.name.startsWith('.') || /\.(md|docx)$/i.test(d.name)) continue;
    const o = path.join(raiz, d.name);
    if (d.isDirectory()) { copiar(o, path.join(t2, d.name)); continue; }
    const dest = d.name === 'empresa.js' || d.name === 'manifest.json' ? t3 : d.name.endsWith('.html') ? t1 : t2;
    fs.copyFileSync(o, path.join(dest, d.name));
  }
  const cuenta = (d) => { let n = 0; for (const x of fs.readdirSync(d, { withFileTypes: true })) n += x.isDirectory() ? cuenta(path.join(d, x.name)) : 1; return n; };
  [t1, t2].forEach((d) => { if (cuenta(d) >= 100) throw new Error(path.basename(d) + ' tiene 100 archivos o más: GitHub no deja subirlos de una vez.'); });
}

async function empaquetar(salida) {
  const v = versionActual();
  salida = path.resolve(salida || path.join(RAIZ, '..', 'portal-v' + v));
  console.log('1/4 Pruebas…');
  try { execFileSync(process.execPath, [path.join(RAIZ, 'pruebas/pruebas.js')], { stdio: ['ignore', 'ignore', 'inherit'] }); }
  catch (e) { throw new Error('Las pruebas fallaron: corre node pruebas/pruebas.js y corrige antes de empaquetar.'); }
  let conPlaywright = false; try { require.resolve('playwright', { paths: [path.join(RAIZ, 'pruebas')] }); conPlaywright = true; } catch (e) {}
  if (conPlaywright) {
    console.log('1b/4 Pruebas en navegador…');
    // v132: se prueba el sitio MINIFICADO (lo mismo que se sube a GitHub).
    try { execFileSync(process.execPath, [path.join(RAIZ, 'pruebas/navegador.js')], { cwd: path.join(RAIZ, 'pruebas'), stdio: ['ignore', 'ignore', 'inherit'], env: Object.assign({}, process.env, { SSTA_MIN: '1' }) }); }
    catch (e) { throw new Error('Las pruebas en navegador fallaron: corre cd pruebas && node navegador.js y corrige antes de empaquetar.'); }
  } else console.log('   (sin Playwright: se omiten las pruebas en navegador; GitHub las corre igual al subir)');
  console.log('2/4 Servidor único…');
  require('./armar-servidor-unico').armar();
  console.log('3/4 Sitio de tu marca…');
  fs.rmSync(salida, { recursive: true, force: true });
  copiar(RAIZ, path.join(salida, 'avanzado', 'sitio-de-tu-marca'));
  fs.mkdirSync(path.join(salida, 'PASO-1-SERVIDOR'), { recursive: true });
  fs.copyFileSync(path.join(RAIZ, 'servidor-todo-en-uno', 'Portal-SSTA.gs'), path.join(salida, 'PASO-1-SERVIDOR', 'Portal-SSTA.gs'));
  sitioParaSubir(RAIZ, path.join(salida, 'PASO-2-SITIO'));
  // v132: lo que se sube va minificado (abre más rápido con poca señal); «avanzado/» queda legible.
  const min = require('./minificar');
  const ahorro = (await min.carpeta(path.join(salida, 'PASO-2-SITIO', '1-paginas'), false)) + (await min.carpeta(path.join(salida, 'PASO-2-SITIO', '2-archivos'), false));
  console.log('   minificado: ' + Math.round(ahorro / 1024) + ' KB menos');
  if (fs.existsSync(path.join(RAIZ, 'GUIA-DE-INSTALACION.docx'))) fs.copyFileSync(path.join(RAIZ, 'GUIA-DE-INSTALACION.docx'), path.join(salida, 'GUIA-DE-INSTALACION.docx'));
  console.log('4/4 Sitio demo…');
  require('./armar-demo').armar(path.join(salida, 'avanzado', 'sitio-demo'));
  fs.copyFileSync(path.join(RAIZ, 'CHANGELOG.md'), path.join(salida, 'CHANGELOG.md'));
  fs.writeFileSync(path.join(salida, 'LEEME.txt'), leeme(v));
  return salida;
}

if (require.main === module) {
  empaquetar(process.argv[2]).then((s) => console.log('Entrega lista en ' + s)).catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
}
module.exports = { empaquetar, SOLO_PROVEEDOR };
