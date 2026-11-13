#!/usr/bin/env node
/* ============================================================
   minificar.js — Achica el sitio que se sube (v132)
   ------------------------------------------------------------
   Lo que va a GitHub (PASO-2-SITIO) sale minificado: el JavaScript con terser
   (sin cambiar nombres globales: las páginas comparten funciones entre archivos)
   y el CSS con clean-css; en cada .html se achican sus <script> y <style>.
   La copia de «avanzado/» queda legible, como siempre.
   No se tocan los archivos que la empresa edita (empresa.js, config.js) ni los datos.
   Necesita (una vez): cd herramientas && npm i --no-save --prefix . terser@5 clean-css@5
   Uso: node herramientas/minificar.js <carpeta>
   ============================================================ */
const fs = require('fs'), path = require('path');
const NO_TOCAR = new Set(['empresa.js', 'config.js', 'manifest.json']);
let terser, CleanCSS;
try { terser = require(path.join(__dirname, 'node_modules', 'terser')); CleanCSS = require(path.join(__dirname, 'node_modules', 'clean-css')); } catch (e) { terser = null; }

const OPC_JS = { ecma: 2020, compress: { passes: 2, drop_console: false, keep_fargs: true, keep_fnames: true, toplevel: false }, mangle: { toplevel: false, keep_fnames: true }, format: { comments: false } };
async function js(codigo) { const r = await terser.minify(codigo, OPC_JS); if (r.error) throw r.error; return r.code; }
function css(codigo) { const r = new CleanCSS({ level: 1 }).minify(codigo); if (r.errors.length) throw new Error(r.errors.join('; ')); return r.styles; }

async function archivo(p) {
  const n = path.basename(p); if (NO_TOCAR.has(n)) return 0;
  const antes = fs.statSync(p).size;
  let s = fs.readFileSync(p, 'utf8');
  if (n.endsWith('.js')) s = await js(s);
  else if (n.endsWith('.css')) s = css(s);
  else if (n.endsWith('.html')) {
    const partes = [];
    s.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g, (m, at, c, i) => { partes.push({ i, m, at, c, t: 'js' }); return m; });
    s.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, at, c, i) => { partes.push({ i, m, at, c, t: 'css' }); return m; });
    partes.sort((a, b) => b.i - a.i);
    for (const x of partes) {
      if (x.t === 'js' && /type="(?!text\/javascript)/.test(x.at)) continue;   // JSON u otros tipos: tal cual
      const nuevo = x.t === 'js' ? '<script' + x.at + '>' + (await js(x.c)) + '</script>' : '<style' + x.at + '>' + css(x.c) + '</style>';
      s = s.slice(0, x.i) + nuevo + s.slice(x.i + x.m.length);
    }
    s = require('./csp').politica(s) || s;   // v163: la huella del script ya minificado
  } else return 0;
  fs.writeFileSync(p, s);
  return antes - Buffer.byteLength(s);
}
async function carpeta(dir, recursivo) {
  if (!terser) throw new Error('Falta instalar terser y clean-css: cd herramientas && npm i --no-save --prefix . terser@5 clean-css@5');
  let ahorro = 0;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) { if (recursivo && !/^(demo|servidor|videos|fonts|empresas)/.test(d.name)) ahorro += await carpeta(p, true); continue; }
    if (/\.(js|css|html)$/.test(d.name)) {
      try { ahorro += await archivo(p); } catch (e) { throw new Error(d.name + ': ' + e.message); }
    }
  }
  return ahorro;
}
module.exports = { carpeta, archivo };
if (require.main === module) carpeta(process.argv[2], true).then((a) => console.log('Ahorro: ' + Math.round(a / 1024) + ' KB')).catch((e) => { console.error(e.message); process.exit(1); });
