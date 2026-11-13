#!/usr/bin/env node
/* ============================================================
   publicar.js — UN solo comando para sacar una versión (v165)
   ------------------------------------------------------------
   Antes había que acordarse de 7 pasos en orden. Ahora:

     1. Escribe en CHANGELOG.md la entrada «## vNNN — …» (lo único a mano).
     2. node herramientas/publicar.js vNNN

   Y hace, en orden, deteniéndose en el primer error (si algo falla NO hay versión):
     · revisa que el CHANGELOG tenga la entrada de vNNN;
     · sube la versión en todos lados y recalcula la CSP de cada página;
     · regenera el servidor único y el servidor todo-en-uno;
     · lint de seguridad, pruebas de lógica y pruebas del código;
     · si cambiaron las pantallas del instalador, vuelve a tomar las capturas;
       y genera la guía de instalación de esta versión;
     · arma la entrega (con las pruebas en navegador sobre el sitio minificado),
       verifica el paquete y deja el .zip.
   Opcional:
     --git    exige árbol limpio al empezar y al final hace commit y la etiqueta vNNN
     --push   además sube a GitHub (GitHub Actions corre las pruebas y publica)
     --salida <carpeta>   dónde dejar la entrega (por defecto ../portal-vNNN)
   ============================================================ */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const a = process.argv.slice(2), destino = a.find((x) => /^v?\d+$/.test(x));
const conGit = a.includes('--git') || a.includes('--push'), conPush = a.includes('--push');
const iS = a.indexOf('--salida');
let paso = 0;
const titulo = (t) => console.log('\n' + (++paso) + '. ' + t);
const correr = (args, opc) => execFileSync(process.execPath, args, Object.assign({ cwd: RAIZ, stdio: 'inherit' }, opc || {}));
const git = (args) => execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8' }).trim();
/** Comprime una carpeta en un .zip, sin programas externos. Devuelve cuántos archivos metió. */
function comprimir(carpeta, zip) {
  const fflate = require(path.join(RAIZ, 'fflate.min.js')), archivos = {};
  (function rec(d, pre) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name), k = pre + e.name;
    if (e.isDirectory()) rec(p, k + '/'); else archivos[k] = [new Uint8Array(fs.readFileSync(p)), { level: /\.(png|jpe?g|webp|mp4|webm|woff2?|zip|docx|pdf)$/i.test(e.name) ? 0 : 6 }]; }); })(carpeta, '');
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  fs.writeFileSync(zip, fflate.zipSync(archivos));
  const n = Object.keys(fflate.unzipSync(new Uint8Array(fs.readFileSync(zip)), { filter: () => false }) || {}).length;   // se puede abrir
  return Object.keys(archivos).length;
}
module.exports = { comprimir };
function fallar(msg) { console.error('\n✗ ' + msg + '\n  No se sacó la versión. Corrige y vuelve a correr el mismo comando.'); process.exit(1); }

if (require.main === module) (async () => {
  if (!destino) fallar('Uso: node herramientas/publicar.js vNNN [--git] [--push] [--salida carpeta]');
  const { versionActual } = require('./subir-version');
  const actual = versionActual(), nueva = Number(destino.replace(/^v/i, ''));
  const salida = iS !== -1 ? path.resolve(a[iS + 1]) : path.join(RAIZ, '..', 'portal-v' + nueva);
  console.log('Portal SSTA · publicar v' + nueva + (nueva === actual ? ' (la versión ya estaba subida: se rehace lo demás)' : ' (actual v' + actual + ')'));

  titulo('Antes de empezar');
  if (nueva < actual) fallar('v' + nueva + ' es menor que la actual (v' + actual + ').');
  if (!new RegExp('^## v' + nueva + '\\b', 'm').test(fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8'))) fallar('Falta en CHANGELOG.md la entrada «## v' + nueva + ' — …» con lo que cambió (es lo único que se escribe a mano).');
  if (conGit) { let st = ''; try { st = git(['status', '--porcelain']); } catch (e) { fallar('Esto no es un repositorio de git (quita --git).'); } if (st.split('\n').filter((l) => l && !/CHANGELOG\.md$/.test(l)).length) fallar('Hay cambios sin commit (fuera del CHANGELOG). Haz commit primero: la versión debe salir de un árbol limpio.'); }
  console.log('   ✓ CHANGELOG con la entrada de v' + nueva);

  titulo('Versión y política de seguridad');
  if (nueva > actual) { const r = require('./subir-version').subir('v' + nueva); console.log('   ✓ v' + r.antes + ' → v' + r.nueva + ' en ' + r.cambiados.length + ' archivos (CSP recalculada)'); }
  else { require('./armar-common').armar(); require('./csp').carpeta(RAIZ); require('./armar-servidor-unico').armar(); console.log('   ✓ CSP recalculada y servidor regenerado'); }
  fs.writeFileSync(path.join(RAIZ, 'MAPA-DEL-CODIGO.md'), require('./mapa').generar());   // v167: mapa del código al día

  titulo('Lint de seguridad');
  try { correr([path.join(__dirname, 'lint', 'revisar.js')]); } catch (e) { fallar('El lint encontró problemas (o falta: cd herramientas/lint && npm ci).'); }

  titulo('Pruebas del código y de lógica');
  try { correr([path.join(RAIZ, 'pruebas', 'pruebas.js')], { stdio: ['ignore', 'ignore', 'inherit'] }); console.log('   ✓ todas correctas'); } catch (e) { fallar('Fallaron las pruebas: node pruebas/pruebas.js para ver cuáles.'); }

  titulo('Guía de instalación');
  const { huellaPantallas } = require('./verificar-release'), sello = path.join(__dirname, 'guia', 'capturas.json');
  const tomada = fs.existsSync(sello) ? JSON.parse(fs.readFileSync(sello, 'utf8')).huella : '';
  if (tomada !== huellaPantallas()) { console.log('   Las pantallas del instalador cambiaron: se vuelven a tomar las capturas…'); try { correr([path.join(__dirname, 'guia', 'capturas.js')]); } catch (e) { fallar('No se pudieron tomar las capturas de la guía.'); } }
  else console.log('   ✓ capturas al día');
  try { correr([path.join(__dirname, 'guia', 'hacer-guia.js'), 'GUIA-DE-INSTALACION.docx']); } catch (e) { fallar('No se pudo generar la guía (cd herramientas && npm i docx).'); }

  titulo('Entrega (incluye las pruebas en navegador sobre el sitio minificado)');
  let ok = false;
  for (let intento = 1; intento <= 2 && !ok; intento++) {   // Chromium a veces se cae en máquinas cargadas: un reintento
    try { correr([path.join(__dirname, 'empaquetar.js'), salida], { env: Object.assign({}, process.env, { SSTA_MIN: '1' }) }); ok = true; }
    catch (e) { if (intento === 2) fallar('No se pudo armar la entrega (mira el mensaje de arriba).'); console.log('   …se reintenta una vez'); }
  }

  titulo('Documentos comerciales (propuesta, contrato y anexos)');
  try { const c = await require('./comercial').armar(path.join(salida, 'COMERCIAL')); console.log('   ✓ ' + c.docx + ' documentos' + (c.pdf ? ' en Word y PDF' : ' en Word (instala LibreOffice para el PDF)')); }
  catch (e) { fallar('No se pudieron armar los documentos comerciales: ' + e.message); }

  titulo('Verificación de la versión y del paquete');
  const v = require('./verificar-release').verificar({ paquete: salida });
  v.errores.forEach((x) => console.log('   ✗ ' + x));
  if (v.errores.length) fallar('La verificación encontró ' + v.errores.length + ' problema(s).');
  console.log('   ✓ v' + v.version + ' completa y consistente');

  titulo('Archivo .zip');
  const zip = salida.replace(/[\\/]+$/, '') + '.zip';
  // v166: el .zip lo arma Node con fflate (ya viene en el proyecto): funciona igual en Windows, Mac y Linux.
  try { const n = comprimir(salida, zip); console.log('   ✓ ' + zip + ' (' + n + ' archivos, ' + Math.round(fs.statSync(zip).size / 1048576) + ' MB)'); }
  catch (e) { fallar('No se pudo crear el .zip: ' + e.message); }

  if (conGit) {
    titulo('Commit y etiqueta');
    git(['add', '-A']); try { git(['commit', '-m', 'v' + nueva + ': ' + ((/^## v\d+ — (.*)$/m.exec(fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8')) || [])[1] || 'versión nueva')]); } catch (e) { console.log('   (nada nuevo para commit)'); }
    git(['tag', '-f', 'v' + nueva]); console.log('   ✓ etiqueta v' + nueva);
    if (conPush) { git(['push']); git(['push', '-f', 'origin', 'v' + nueva]); console.log('   ✓ subido: GitHub Actions corre las pruebas y publica'); }
  }
  console.log('\n✅ v' + nueva + ' lista. Entrega en ' + salida + '\n   Volver atrás si algo sale mal: RELEASE.md («Volver a la versión anterior»).');
})().catch((e) => fallar(e.message));
