#!/usr/bin/env node
/* v162 · Saca el <script> grande de una página a «<página>.app.js» (archivo aparte: el celular lo guarda en caché y
   se revisa y versiona por separado). El HTML queda con <script src="…">, en el mismo lugar (mismo orden).
   Uso: node herramientas/extraer-js.js ats.html reportes.html … */
const fs = require('fs'), path = require('path'), RAIZ = path.join(__dirname, '..');
process.argv.slice(2).forEach((pag) => {
  const p = path.join(RAIZ, pag), t = fs.readFileSync(p, 'utf8'), re = /<script>([\s\S]*?)<\/script>/g; let m, mayor = null;
  while ((m = re.exec(t))) if (!mayor || m[1].length > mayor.cod.length) mayor = { i: m.index, len: m[0].length, cod: m[1] };
  if (!mayor || mayor.cod.length < 20000) { console.log('· ' + pag + ': nada grande que sacar'); return; }
  const js = pag.replace(/\.html$/, '.app.js');
  fs.writeFileSync(path.join(RAIZ, js), '/* ' + js + ' — código de ' + pag + ' (v162: fuera del HTML para que el celular lo guarde en caché). */\n' + mayor.cod.replace(/^\n/, ''));
  fs.writeFileSync(p, t.slice(0, mayor.i) + '<script src="' + js + '"></script>' + t.slice(mayor.i + mayor.len));
  console.log('✓ ' + pag + ' → ' + js + ' (' + Math.round(mayor.cod.length / 1024) + ' KB)');
});
