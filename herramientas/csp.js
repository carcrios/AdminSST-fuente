#!/usr/bin/env node
/* ============================================================
   csp.js — Política de seguridad SIN 'unsafe-inline' para scripts (v163)
   ------------------------------------------------------------
   Cada <script> que va dentro de una página se permite por su huella
   (sha256) y nada más: un <script> o un onclick que alguien logre meter con
   innerHTML ya no corre. La huella cambia si cambia una sola letra del
   script, así que esto se corre después de cualquier cambio a un .html:
     node herramientas/csp.js            (actualiza las páginas del repositorio)
   Lo corren solos subir-version.js, minificar.js (después de achicar) y
   armar-demo.js. pruebas.js falla si alguna página quedó desactualizada.
   ============================================================ */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RE_META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
function huellas(html) {
  const out = [], re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { if (/type=["'](?!text\/javascript|module)/i.test(m[1])) continue; out.push("'sha256-" + crypto.createHash('sha256').update(m[2].replace(/\r\n?/g, '\n'), 'utf8').digest('base64') + "'"); }
  return [...new Set(out)];
}
function politica(html, extra) {
  const m = RE_META.exec(html); if (!m) return null;
  const partes = m[2].split(';').map((s) => s.trim()).filter(Boolean);
  const i = partes.findIndex((p) => /^script-src\b/.test(p));
  const conEval = i >= 0 && /'unsafe-eval'/.test(partes[i]);
  const src = ['script-src', "'self'"].concat(conEval || extra === 'eval' ? ["'unsafe-eval'"] : [], huellas(html)).join(' ');
  if (i >= 0) partes[i] = src; else partes.splice(1, 0, src);
  return html.replace(RE_META, (x, a, b, c) => a + partes.join('; ') + c);
}
function archivo(p, extra) { const t = fs.readFileSync(p, 'utf8'), n = politica(t, extra); if (n && n !== t) { fs.writeFileSync(p, n); return 1; } return 0; }
function carpeta(dir, extra) { return fs.readdirSync(dir).filter((f) => f.endsWith('.html')).reduce((a, f) => a + archivo(path.join(dir, f), extra), 0); }
function aldia(html) { const n = politica(html); return !n || n === html; }
module.exports = { politica, carpeta, archivo, aldia, huellas };
if (require.main === module) {
  const arg = process.argv.slice(2), d = arg.find((x) => !x.startsWith('--')) || path.join(__dirname, '..');
  if (arg.includes('--check')) {   // v165: solo revisa (para el pre-commit): sale con 1 si alguna página está vieja
    const viejas = fs.readdirSync(d).filter((f) => f.endsWith('.html')).filter((f) => !aldia(fs.readFileSync(path.join(d, f), 'utf8')));
    if (viejas.length) { console.log('✗ CSP desactualizada en: ' + viejas.join(', ')); process.exit(1); }
    console.log('✓ CSP al día'); process.exit(0);
  }
  console.log('CSP con huellas: ' + carpeta(d) + ' página(s) actualizada(s).');
}
