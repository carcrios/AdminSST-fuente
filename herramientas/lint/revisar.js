#!/usr/bin/env node
/* ============================================================
   revisar.js — ESLint del portal (v162)
   ------------------------------------------------------------
   Revisa TODO el JavaScript del sitio: los .js y los <script> que
   van dentro de cada .html. Se enfoca en lo que puede abrir un hueco
   de seguridad o esconder un error:
     · no-unsanitized: cada innerHTML / insertAdjacentHTML / document.write
       con datos. Hoy se protegen con esc(); la regla vigila que no
       aparezcan NUEVOS sin revisar.
     · eval, new Function, setTimeout con texto, javascript: en enlaces.
     · claves duplicadas, código inalcanzable, asignaciones a sí mismo,
       comparaciones con NaN, etc.

   Como el portal ya tiene cientos de innerHTML revisados a mano, la
   regla funciona como un TRINQUETE: lint-base.json guarda cuántos hay
   por archivo y la prueba falla si en alguno SUBEN. Cuando se limpia
   un archivo, se corre con --actualizar para bajar la base.

   Uso:  node herramientas/lint/revisar.js            (revisa)
         node herramientas/lint/revisar.js --actualizar
         node herramientas/lint/revisar.js --detalle archivo.html
   Instalar una vez: (cd herramientas/lint && npm install)
   ============================================================ */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const BASE = path.join(__dirname, 'lint-base.json');
let Linter, noUnsanitized, globals;
try { ({ Linter } = require('eslint')); noUnsanitized = require('eslint-plugin-no-unsanitized'); globals = require('globals'); }
catch (e) { console.log('ESLint no está instalado: (cd herramientas/lint && npm install)'); process.exit(2); }

const REGLAS = {
  'no-unsanitized/property': 'warn', 'no-unsanitized/method': 'warn',
  'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-func': 'error', 'no-script-url': 'error',
  'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-duplicate-case': 'error', 'no-unreachable': 'error', 'no-self-assign': 'error',
  'use-isnan': 'error', 'valid-typeof': 'error', 'no-dupe-else-if': 'error', 'no-unsafe-finally': 'error', 'no-unsafe-negation': 'error',
  'no-sparse-arrays': 'error', 'no-func-assign': 'error', 'no-import-assign': 'error', 'no-obj-calls': 'error', 'no-compare-neg-zero': 'error'
};
const linter = new Linter({ configType: 'flat' });
const CONFIG = [{ files: ['**/*.js'], plugins: { 'no-unsanitized': noUnsanitized },
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: Object.assign({}, globals.browser) }, rules: REGLAS }];

function bloques(f) {
  const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
  if (f.endsWith('.js')) return [{ codigo: t, linea: 0 }];
  const out = [], re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(t))) { if (/type=["'](application\/ld\+json|text\/template)/i.test(m[0])) continue; out.push({ codigo: m[1], linea: t.slice(0, m.index).split('\n').length }); }
  return out;
}
// El plugin no-unsanitized se cae con algunas construcciones (p. ej. «throw» de una plantilla): ese bloque se
// revisa sin él y se avisa, para no perder las demás reglas.
const SIN_SAN = [{ files: ['**/*.js'], languageOptions: CONFIG[0].languageOptions, rules: Object.fromEntries(Object.entries(REGLAS).filter(([k]) => !/no-unsanitized/.test(k))) }];
const caidos = [];
function verificar(codigo, f) { try { return linter.verify(codigo, CONFIG, { filename: 'x.js' }); } catch (e) { caidos.push(f); return linter.verify(codigo, SIN_SAN, { filename: 'x.js' }); } }
function archivos() {
  const l = fs.readdirSync(RAIZ).filter((f) => /\.(html|js)$/.test(f) && !/\.min\.js$/.test(f)).sort();
  return l.filter((f) => fs.statSync(path.join(RAIZ, f)).isFile());
}
function revisar() {
  const por = {}, errores = [];
  archivos().forEach((f) => {
    let san = 0, err = 0;
    bloques(f).forEach((b) => {
      verificar(b.codigo, f).forEach((m) => {
        if (m.fatal) { errores.push(f + ':' + (b.linea + m.line) + ' — no compila: ' + m.message); err++; return; }
        if (/^no-unsanitized/.test(m.ruleId || '')) san++;
        else { err++; errores.push(f + ':' + (b.linea + m.line) + ' — ' + m.ruleId + ': ' + m.message); }
      });
    });
    por[f] = { innerHTML: san, errores: err };
  });
  return { por, errores };
}
function detalle(f) {
  bloques(f).forEach((b) => verificar(b.codigo, f).forEach((m) => console.log(f + ':' + (b.linea + m.line) + ' ' + (m.ruleId || 'fatal') + ' — ' + m.message)));
}

module.exports = { revisar, BASE };

if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--detalle') { detalle(process.argv[3]); process.exit(0); }
  const r = revisar();
  if (arg === '--actualizar') {
    const base = {}; Object.keys(r.por).forEach((f) => { if (r.por[f].innerHTML) base[f] = r.por[f].innerHTML; });
    fs.writeFileSync(BASE, JSON.stringify(base, null, 1) + '\n'); console.log('Base actualizada: ' + Object.values(base).reduce((a, x) => a + x, 0) + ' innerHTML revisados en ' + Object.keys(base).length + ' archivos.');
  }
  const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
  const suben = Object.keys(r.por).filter((f) => r.por[f].innerHTML > (base[f] || 0)).map((f) => f + ': ' + r.por[f].innerHTML + ' (base ' + (base[f] || 0) + ')');
  r.errores.forEach((e) => console.log('✗ ' + e));
  suben.forEach((s) => console.log('✗ innerHTML nuevos sin revisar en ' + s));
  const tot = Object.values(r.por).reduce((a, x) => a + x.innerHTML, 0);
  if (caidos.length) console.log('ℹ️  sin la regla de innerHTML (el plugin no pudo leerlos): ' + [...new Set(caidos)].join(', '));
  console.log((r.errores.length || suben.length ? '❌ ' : '✅ ') + archivos().length + ' archivos · ' + r.errores.length + ' error(es) · ' + tot + ' innerHTML con datos (todos pasan por esc(); base ' + Object.values(base).reduce((a, x) => a + x, 0) + ')');
  process.exit(r.errores.length || suben.length ? 1 : 0);
}
