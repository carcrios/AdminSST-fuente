#!/usr/bin/env node
/* ============================================================
   verificar-release.js — Lo que tiene que estar bien ANTES de entregar (v165)
   ------------------------------------------------------------
   No reemplaza las pruebas: revisa que la versión esté COMPLETA y CONSISTENTE,
   lo que antes dependía de acordarse:
     · la misma versión en sw.js, common.js, estado.html, el servidor SG-SST, el
       enrutador, el servidor generado, el CHANGELOG y el pie de cada página;
     · CSP de cada página al día (huellas) y sin 'unsafe-inline' para scripts;
     · ningún onclick u otro manejador en línea;
     · el núcleo sin señal (sw.js) con todo el JS y CSS de sus pantallas;
     · el servidor generado (servidor-unico/, servidor-todo-en-uno/) igual a lo que
       sale de backends/ HOY;
     · la guía (.docx) de esta versión y sus capturas tomadas sobre las pantallas
       actuales del instalador;
     · con --paquete <carpeta>: el paquete entregado (PASO-1 = servidor generado,
       sin node_modules ni archivos internos, tandas de menos de 100 archivos para
       subir a GitHub por la web).
   Uso:  node herramientas/verificar-release.js            (todo)
         node herramientas/verificar-release.js --rapido   (sin regenerar: para el pre-commit)
         node herramientas/verificar-release.js --paquete ../portal-v165
   Sale con 1 si algo falla.
   ============================================================ */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RAIZ = path.join(__dirname, '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const existe = (f) => fs.existsSync(path.join(RAIZ, f));

/** Huella de las pantallas que salen en las capturas de la guía (sin versión ni CSP, que cambian en cada entrega). */
const PANTALLAS_GUIA = ['instalar.html', 'configurar-empresa.html', 'menus-empresa.js', 'empresa-motor.js'];   // v170: los grupos de módulos salen de empresa-motor.js
function huellaPantallas() {
  const h = crypto.createHash('sha256');
  PANTALLAS_GUIA.forEach((f) => h.update(f + '\n' + leer(f).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g, '').replace(/versión v\d+/g, 'versión v').replace(/'v\d+'/g, "'v'")));
  return h.digest('hex').slice(0, 16);
}

function versionDe(f, re) { const m = re.exec(leer(f)); return m ? Number(m[1]) : null; }

function verificar(opciones) {
  const o = opciones || {}, errores = [], avisos = [];
  const mal = (s) => errores.push(s), ojo = (s) => avisos.push(s);

  // 1. La misma versión en todos lados
  const v = versionDe('sw.js', /const CACHE_NAME = 'ssta-portal-v(\d+)'/);
  if (!v) mal('sw.js: no se encontró CACHE_NAME');
  const DONDE = [
    ['common.js', /const VERSION_PORTAL_WEB = 'v(\d+)'/], ['estado.html', /const VERSION = 'v(\d+)'/],
    ['backends/backend-sgsst.gs', /const VERSION_SGSST = 'v(\d+)'/], ['herramientas/servidor-unico-portal.gs', /const VERSION_PORTAL = 'v(\d+)'/],
    ['servidor-unico/00-Portal.gs', /const VERSION_PORTAL = 'v(\d+)'/], ['CHANGELOG.md', /^## v(\d+)\b/m]
  ];
  DONDE.forEach(([f, re]) => { if (!existe(f)) return mal(f + ': no existe'); const x = versionDe(f, re); if (x !== v) mal(f + ': dice v' + x + ' y sw.js v' + v + (f === 'CHANGELOG.md' ? ' (falta la entrada de esta versión en el CHANGELOG)' : '')); });
  if (existe('servidor-todo-en-uno/Portal-SSTA.gs')) { const x = versionDe('servidor-todo-en-uno/Portal-SSTA.gs', /const VERSION_PORTAL = 'v(\d+)'/); if (x !== v) mal('servidor-todo-en-uno/Portal-SSTA.gs: dice v' + x + ' (regenerar el servidor)'); }
  const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html'));
  const pieViejo = htmls.filter((f) => { const m = leer(f).match(/Portal SSTA · versión v(\d+)/g) || []; return m.some((x) => Number(x.replace(/\D/g, '')) !== v); });
  if (pieViejo.length) mal('pie con otra versión en: ' + pieViejo.join(', '));

  // 2. CSP al día y sin 'unsafe-inline' para scripts
  const CSP = require('./csp');
  const sinCsp = [], vieja = [];
  htmls.forEach((f) => { const t = leer(f); const m = /script-src ([^;"]*)/.exec(t); if (!m || /unsafe-inline/.test(m[1])) sinCsp.push(f); else if (!CSP.aldia(t)) vieja.push(f); });
  if (sinCsp.length) mal('CSP sin huellas o con unsafe-inline: ' + sinCsp.join(', '));
  if (vieja.length) mal('CSP desactualizada (corre node herramientas/csp.js): ' + vieja.join(', '));

  // 3. Ningún manejador en línea
  const enLinea = fs.readdirSync(RAIZ).filter((f) => /\.(html|js)$/.test(f) && !/\.min\.js$/.test(f)).filter((f) => /\son(click|change|input|submit|load|error|keydown|keyup|focus|blur)\s*=\s*\\?["']/.test(leer(f)));
  if (enLinea.length) mal('onclick u otro manejador en línea en: ' + enLinea.join(', '));

  // 4. Núcleo sin señal completo
  const sw = leer('sw.js'), N = new Set(((/const NUCLEO = \[([\s\S]*?)\];/.exec(sw) || [])[1] || '').match(/'\.\/[^']*'/g).map((s) => s.slice(3, -1)));
  const falta = [];
  [...N].filter((f) => f.endsWith('.html')).forEach((f) => { (leer(f).match(/<script src="[^"]+"|<link[^>]*href="[^"]+\.css"/g) || []).forEach((x) => { const u = /(?:src|href)="([^"]+)"/.exec(x)[1].replace(/^\.\//, ''); if (!/^https?:/.test(u) && !N.has(u)) falta.push(u + ' (' + f + ')'); }); });
  if (falta.length) mal('le falta al núcleo sin señal de sw.js: ' + falta.join(', '));
  const enSw = new Set((sw.match(/'\.\/[^']+'/g) || []).map((s) => s.slice(3, -1)));
  const sinCache = fs.readdirSync(RAIZ).filter((f) => /\.(html|js|css)$/.test(f) && !/^(sw|config|empresa)\.js$/.test(f) && !enSw.has(f) && f !== '404.html');
  if (sinCache.length) mal('archivos que no están en la caché de sw.js (no abrirían sin señal): ' + sinCache.join(', '));

  // 4b. v167: common.js igual a la unión de fuente/common/ (nadie lo editó a mano)
  if (existe('fuente/common')) { const m = require('./armar-common').revisar(); if (m) mal(m); } else mal('falta fuente/common/ (el código de common.js)');

  // 4c. v167: el mapa del código al día y ninguna línea kilométrica nueva
  if (!o.rapido) { const m = require('./mapa').revisar(); if (m) mal(m); }
  require('./lineas-largas').revisar().subieron.forEach(([f, a, h]) => {
    mal(f + ': ' + h + ' líneas de más de 200 caracteres (antes ' + a + '): pártelas (node herramientas/lineas-largas.js --detalle ' + f + ')');
  });

  // 5. Servidor generado igual a lo que sale de backends/ hoy
  if (!o.rapido) {
    const carpetas = ['servidor-unico', 'servidor-todo-en-uno'].filter(existe);
    const antes = {}; carpetas.forEach((c) => fs.readdirSync(path.join(RAIZ, c)).forEach((f) => { antes[c + '/' + f] = leer(c + '/' + f); }));
    require('./armar-servidor-unico').armar();
    const cambio = []; carpetas.forEach((c) => fs.readdirSync(path.join(RAIZ, c)).forEach((f) => { if (antes[c + '/' + f] !== leer(c + '/' + f)) cambio.push(c + '/' + f); }));
    if (cambio.length) mal('el servidor generado estaba desactualizado (ya se regeneró; revisa y vuelve a correr): ' + cambio.join(', '));
  }

  // 6. Guía de esta versión y capturas sobre las pantallas actuales
  if (o.sinGuia) { /* pre-commit: la guía se revisa al publicar */ } else if (existe('GUIA-DE-INSTALACION.docx')) {
    try {
      const fflate = require(path.join(RAIZ, 'fflate.min.js'));
      const z = fflate.unzipSync(new Uint8Array(fs.readFileSync(path.join(RAIZ, 'GUIA-DE-INSTALACION.docx'))), { filter: (f) => f.name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(f.name) });
      const txt = Object.values(z).map((b) => Buffer.from(b).toString('utf8')).join(' ');
      if (v && txt.indexOf('v' + v) === -1 && txt.indexOf(String(v)) === -1) mal('GUIA-DE-INSTALACION.docx no es de v' + v + ' (corre node herramientas/guia/hacer-guia.js GUIA-DE-INSTALACION.docx)');
    } catch (e) { ojo('no se pudo leer la guía: ' + e.message); }
  } else mal('falta GUIA-DE-INSTALACION.docx');
  const sello = path.join(__dirname, 'guia', 'capturas.json');
  if (!o.sinGuia) {
  const huella = huellaPantallas(), tomada = fs.existsSync(sello) ? JSON.parse(fs.readFileSync(sello, 'utf8')).huella : '';
  if (huella !== tomada) mal('las capturas de la guía son de unas pantallas que ya cambiaron (instalar / configurar / menús): corre node herramientas/guia/capturas.js y luego hacer-guia.js');
  }

  // 7. El paquete entregado
  if (o.paquete) {
    const P = path.resolve(o.paquete), r = (x) => path.join(P, x);
    if (!fs.existsSync(P)) mal('no existe el paquete ' + P);
    else {
      const g1 = r('PASO-1-SERVIDOR/Portal-SSTA.gs'), g0 = path.join(RAIZ, 'servidor-todo-en-uno', 'Portal-SSTA.gs');
      if (!fs.existsSync(g1) || fs.readFileSync(g1, 'utf8') !== fs.readFileSync(g0, 'utf8')) mal('PASO-1-SERVIDOR/Portal-SSTA.gs no es el servidor generado de esta versión');
      const todos = []; (function rec(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === '.git') mal('el paquete trae ' + path.relative(P, p)); else rec(p); } else todos.push(path.relative(P, p)); }); })(P);
      const sitio = todos.filter((f) => f.startsWith('PASO-2-SITIO' + path.sep));
      const internos = sitio.filter((f) => /(^|[\\/])(TRASPASO\.md|backends|pruebas|herramientas|servidor-unico|comercial|fuente)([\\/]|$)/.test(f));
      // v167: el sitio demo se sube a un repositorio público: sin precios ni contrato, sin documentos internos y sin el código por partes
      const INTERNOS_DEMO = /(^|[\\/])(comercial|fuente|backends|pruebas|herramientas|TRASPASO\.md|RELEASE\.md|INSTALAR-NUEVA-EMPRESA\.md|GUIA-DE-INSTALACION\.docx)([\\/]|$)/;
      const demoInt = todos.filter((f) => f.startsWith(path.join('avanzado', 'sitio-demo') + path.sep) && INTERNOS_DEMO.test(f));
      if (demoInt.length) mal('el sitio demo trae archivos internos: ' + demoInt.slice(0, 5).join(', '));
      if (internos.length) mal('el sitio a subir trae archivos internos: ' + internos.slice(0, 5).join(', '));
      const porCarpeta = {}; sitio.forEach((f) => { const c = f.split(path.sep).slice(0, 2).join('/'); porCarpeta[c] = (porCarpeta[c] || 0) + 1; });
      Object.keys(porCarpeta).forEach((c) => { if (porCarpeta[c] >= 100) mal(c + ' tiene ' + porCarpeta[c] + ' archivos: GitHub por la web sube menos de 100 por tanda'); });
      if (!fs.existsSync(r('GUIA-DE-INSTALACION.docx'))) mal('el paquete no trae la guía');
      // v166: los documentos comerciales (propuesta, contrato y anexos) de ESTA versión, con los planes que tiene el código
      const com = r('COMERCIAL'), DOCS = require('./comercial').DOCS;
      if (!fs.existsSync(com)) mal('el paquete no trae la carpeta COMERCIAL (propuesta, contrato y anexos)');
      else {
        const fflate = require(path.join(RAIZ, 'fflate.min.js'));
        const texto = (f) => { try { const z = fflate.unzipSync(new Uint8Array(fs.readFileSync(f)), { filter: (x) => /^word\/(document|header\d*)\.xml$/.test(x.name) }); return Object.values(z).map((b) => Buffer.from(b).toString('utf8').replace(/<[^>]+>/g, '')).join(' '); } catch (e) { return ''; } };
        DOCS.forEach(([, nombre]) => { const f = path.join(com, nombre + '.docx'); if (!fs.existsSync(f)) return mal('COMERCIAL: falta ' + nombre + '.docx'); if (texto(f).indexOf('v' + v) === -1) mal('COMERCIAL/' + nombre + '.docx no es de v' + v); });
        const a1 = texto(path.join(com, '3-ANEXO-1-PRECIOS.docx')), sb = { EMPRESA: { modulos: {} }, console }; sb.window = sb; sb.globalThis = sb;
        try { require('vm').runInNewContext(leer('empresa-motor.js'), sb); } catch (e) {}
        Object.values(sb.PLANES_PORTAL || {}).forEach((p) => { if (a1.indexOf(p.nombre) === -1) mal('el Anexo 1 no tiene el plan «' + p.nombre + '» que sí tiene el portal'); });
      }
      if (!fs.existsSync(r('CHANGELOG.md')) || !new RegExp('^## v' + v + '\\b', 'm').test(fs.readFileSync(r('CHANGELOG.md'), 'utf8'))) mal('el paquete no trae el CHANGELOG de v' + v);
      const html = sitio.filter((f) => f.endsWith('.html'));
      const malCsp = html.filter((f) => { const t = fs.readFileSync(r(f), 'utf8'); return !CSP.aldia(t) || /script-src[^;"]*unsafe-inline/.test(t); });
      if (malCsp.length) mal('en el paquete, CSP que no coincide con el código minificado: ' + malCsp.slice(0, 5).join(', '));
    }
  }
  return { version: v, errores, avisos };
}

module.exports = { verificar, huellaPantallas };

if (require.main === module) {
  const a = process.argv.slice(2), i = a.indexOf('--paquete');
  const r = verificar({ rapido: a.includes('--rapido'), sinGuia: a.includes('--sin-guia'), paquete: i !== -1 ? a[i + 1] : null });
  r.avisos.forEach((x) => console.log('ℹ️  ' + x));
  r.errores.forEach((x) => console.log('✗ ' + x));
  console.log(r.errores.length ? '❌ La versión v' + r.version + ' NO está lista: ' + r.errores.length + ' problema(s).' : '✅ v' + r.version + ' completa y consistente.');
  process.exit(r.errores.length ? 1 : 0);
}
