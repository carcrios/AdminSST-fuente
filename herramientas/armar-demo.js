#!/usr/bin/env node
/* ============================================================
   armar-demo.js — Arma el sitio de la EMPRESA DEMO
   ------------------------------------------------------------
   Copia el portal completo a sitio-demo/ y cambia SOLO empresa.js por
   el de la empresa demo (demo/empresa-demo.js; el motor está en empresa-motor.js).
   El resultado se publica tal cual en GitHub Pages, en una cuenta
   DISTINTA a la de los portales reales (ver INSTALAR-NUEVA-EMPRESA.md).

   Uso:  node herramientas/armar-demo.js [carpeta-destino]
   ============================================================ */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const NO_COPIAR = new Set(['pruebas', 'herramientas', 'backends', 'empresas', 'sitio-demo', 'node_modules', '.git', 'TRASPASO.md',
  // v167: la demo se publica en un repositorio abierto: sin precios ni contrato, sin documentos internos ni el código por partes
  'comercial', 'fuente', 'RELEASE.md', 'INSTALAR-NUEVA-EMPRESA.md', 'GUIA-DE-INSTALACION.docx', 'MAPA-DEL-CODIGO.md', 'PRUEBA-DE-CARGA.md']);

function empresaDemo() {
  // v116: el motor va en empresa-motor.js (se copia con el sitio); empresa.js solo lleva los datos.
  return fs.readFileSync(path.join(RAIZ, 'demo/empresa-demo.js'), 'utf8').trim() + '\n';
}
function copiar(origen, destino) {
  fs.mkdirSync(destino, { recursive: true });
  fs.readdirSync(origen, { withFileTypes: true }).forEach((d) => {
    if (NO_COPIAR.has(d.name)) return;
    const o = path.join(origen, d.name), t = path.join(destino, d.name);
    if (d.isDirectory()) copiar(o, t); else fs.copyFileSync(o, t);
  });
}
function armar(destino) {
  destino = destino || path.join(RAIZ, 'sitio-demo');
  fs.rmSync(destino, { recursive: true, force: true });
  copiar(RAIZ, destino);
  fs.writeFileSync(path.join(destino, 'empresa.js'), empresaDemo());
  // La demo también funciona sin señal (reunión en planta): su servidor y sus
  // datos de ejemplo quedan en la caché del Service Worker.
  const sw = path.join(destino, 'sw.js');
  const extra = ['./demo/demo.js', './demo/apps-script-navegador.js', './demo/semilla.json', './demo/logo-demo.svg']
    .concat(fs.readdirSync(path.join(RAIZ, 'servidor-unico')).filter((f) => f.endsWith('.gs')).map((f) => './servidor-unico/' + f));
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace("  './empresa.js',", "  './empresa.js',\n" + extra.map((x) => "  '" + x + "',").join('\n')));
  // Nombre de la app al instalarla en el celular.
  const man = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
  man.name = 'Portal SSTA — Demo'; man.short_name = 'SSTA Demo';
  fs.writeFileSync(path.join(destino, 'manifest.json'), JSON.stringify(man, null, 2));
  // v162: SOLO en la demo, la política de seguridad deja evaluar código: el servidor de Apps Script corre dentro del
  // navegador (demo/apps-script-navegador.js). El portal real no lo permite.
  fs.readdirSync(destino).filter((f) => f.endsWith('.html')).forEach((f) => { const p = path.join(destino, f), t = fs.readFileSync(p, 'utf8');
    const n = require('./csp').politica(t, 'eval'); if (n && n !== t) fs.writeFileSync(p, n); });
  return destino;
}
if (require.main === module) console.log('Sitio de la demo en ' + armar(process.argv[2] && path.resolve(process.argv[2])));
module.exports = { armar, empresaDemo };
