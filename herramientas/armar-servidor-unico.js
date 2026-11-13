#!/usr/bin/env node
/* ============================================================
   armar-servidor-unico.js — Genera el Apps Script de UNA empresa nueva
   ------------------------------------------------------------
   Los módulos nacieron como 9 proyectos de Apps Script (uno por módulo,
   carpeta backends/). Para cada empresa eso es mucho trabajo de instalación, así que este generador
   toma los MISMOS .gs de backends/ (sin cambiarles nada) y los empaqueta
   en un solo proyecto de 6 archivos:

     00-Portal.gs      ← el enrutador (no se edita)
     01-Empresa.gs     ← el único que se edita (nombre de la empresa y correos);
                         las actualizaciones nunca lo reemplazan
     10-permisos.gs    ← los 5 permisos (core.gs una sola vez, 5 instancias)
     11-personal.gs, 12-ats.gs, 13-asistencia.gs, 14-epp.gs

   Cada módulo:
     - responde en <url>/exec/<modulo>  (p. ej. .../exec/ats?list=1)
     - guarda en SU PROPIO libro de Google Sheets (no se mezclan hojas)
     - comparte la clave del portal y el token con los demás

   Uso:  node herramientas/armar-servidor-unico.js
   Sale en servidor-unico/ (se copia y pega cada archivo en Apps Script).
   ============================================================ */
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'servidor-unico');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const PERMISOS = [
  { clave: 'caliente',   libro: 'Permisos de trabajo en caliente', config: 'backends/permisos/config-caliente.gs' },
  { clave: 'alturas',    libro: 'Permisos de trabajo en alturas',  config: 'backends/permisos/config-alturas.gs' },
  { clave: 'confinados', libro: 'Permisos de espacios confinados', config: 'backends/permisos/config-confinados.gs' },
  { clave: 'izajes',     libro: 'Permisos de izajes de cargas',    config: 'backends/permisos/config-izajes.gs' },
  { clave: 'electrico',  libro: 'Permisos de trabajo eléctrico',   config: 'backends/permisos/config-electrico.gs' }
];
const OTROS = [
  { clave: 'personal',   libro: 'Anexo de personal autorizado',     archivo: 'backends/backend-personal-autorizado.gs' },
  { clave: 'ats',        libro: 'ATS - Análisis de Trabajo Seguro', archivo: 'backends/backend-ats.gs' },
  { clave: 'asistencia', libro: 'Asistencia a charlas',             archivo: 'backends/backend-asistencia.gs' },
  { clave: 'epp',        libro: 'Inspección de EPP',                archivo: 'backends/backend-epp.gs' },
  { clave: 'sgsst',      libro: 'Gestión SG-SST',                   archivo: 'backends/backend-sgsst.gs' }
];
const MODULOS = PERMISOS.map((p) => p.clave).concat(OTROS.map((o) => o.clave));

/* Lo único que se cambia del código original: el token y los correos salen
   de las Propiedades del proyecto (las escribe instalar()), no del archivo. */
function adaptar(fuente, nombre) {
  const tenia = /^const API_TOKEN = /m.test(fuente);
  let s = fuente.replace(/^const API_TOKEN = '[^']*';.*$/m, 'const API_TOKEN = tokenPortal_();');
  s = s.replace(/^const (CORREOS_[A-Z_]+) = \[[^\]]*\];.*$/gm, 'const $1 = correosPortal_();');
  s = s.replace(/^const WHATSAPP_APROBACION = '[^']*';.*$/m, 'const WHATSAPP_APROBACION = contactoEpp_().whatsapp || \'(sin número)\';');
  s = s.replace(/^const WHATSAPP_RESPONSABLE = '[^']*';.*$/m, 'const WHATSAPP_RESPONSABLE = contactoEpp_().nombre || \'Responsable de SST\';');
  // Ningún dato real puede quedar en el servidor de una empresa: ni correos
  // (solo los de ejemplo), ni celulares, ni tokens escritos en el código.
  const fuga = datoReal(s);
  if (fuga) throw new Error(nombre + ': quedó un dato real en el código: ' + fuga);
  if (tenia && !s.includes('tokenPortal_()')) throw new Error(nombre + ': no se pudo adaptar API_TOKEN');
  return s;
}
/** Correos que no son de ejemplo, celulares colombianos o tokens largos escritos en el código. */
function datoReal(s) {
  const correo = /[\w.+-]+@([\w-]+\.)+[a-z]{2,}/gi; let m;
  while ((m = correo.exec(s))) if (!/@(empresa\.com(\.co)?|ejemplo\.com|example\.com|tuempresa\.com|[\w.-]+\.invalid)$/i.test(m[0]) && !/^(noreply|no-reply)@/i.test(m[0])) return m[0];
  const cel = /\+?57[ -]?3\d{2}[ -]?\d{3}[ -]?\d{4}|\b3\d{2}[ -]\d{3}[ -]\d{4}\b/.exec(s.replace(/300 000 0000/g, ''));
  if (cel) return cel[0];
  const tok = /API_TOKEN = '([^']{20,})'/.exec(s);
  if (tok) return 'API_TOKEN';
  return '';
}
function publicas(fuente) {
  const out = [];
  const re = /^function ([A-Za-z][A-Za-z0-9]*[A-Za-z0-9])\s*\(/gm; let m;
  while ((m = re.exec(fuente))) if (m[1] !== 'doGet' && m[1] !== 'doPost' && out.indexOf(m[1]) === -1) out.push(m[1]);
  return out;
}
const comillas = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
function cabecera(nombre, descr) {
  return '/* ============================================================\n   ' + nombre + ' — ' + descr + '\n' +
    '   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.\n' +
    '   ============================================================ */\n';
}
function cierre(fns, fuente) {
  // Si un backend no tuviera doGet/doPost, "typeof doGet" vería el del router y se
  // llamaría a sí mismo para siempre: se decide aquí, mirando el código.
  return '    return {\n' +
    '      doGet: ' + (/^function doGet\s*\(/m.test(fuente) ? 'doGet' : 'null') + ',\n' +
    '      doPost: ' + (/^function doPost\s*\(/m.test(fuente) ? 'doPost' : 'null') + ',\n' +
    '      libro: __entorno.libro,\n' +
    '      funciones: {' + fns.map((f) => ' ' + f + ': ' + f).join(',') + ' }\n' +
    '    };\n';
}
const ENTORNO = '    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;\n\n';
function envoltorios(clave, ident, fns) {
  return '\n/* Funciones de mantenimiento de "' + clave + '" (menú ▶ Ejecutar del editor). */\n' +
    fns.map((f) => 'function ' + clave + '__' + f + '() { return ' + ident + '().funciones.' + f + '.apply(null, arguments); }').join('\n') + '\n';
}
const registrar = (clave, ident) => "(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['" + clave + "'] = " + ident + ';\n';

function armar() {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA);
  fs.readdirSync(SALIDA).filter((f) => /\.gs$/.test(f)).forEach((f) => fs.unlinkSync(path.join(SALIDA, f)));
  const archivos = [];
  const escribir = (n, t) => { fs.writeFileSync(path.join(SALIDA, n), t); archivos.push(n); };
  escribir('00-Portal.gs', leer('herramientas/servidor-unico-portal.gs'));
  escribir('01-Empresa.gs', leer('herramientas/servidor-unico-empresa.gs'));

  // ── Permisos: core.gs una vez; cada permiso es una instancia con su nombre y código.
  const core = adaptar(leer('backends/permisos/core.gs'), 'core.gs');
  const fnsCore = publicas(core);
  let gs = cabecera('10-permisos.gs', 'Los 5 permisos de trabajo del Portal SSTA') +
    '/* Es el mismo backends/permisos/core.gs de siempre. Cada permiso (caliente,\n' +
    '   alturas, confinados, izajes, eléctrico) es una instancia aparte con su\n' +
    '   propio libro; lo que en la instalación original va en config-<permiso>.gs aquí son los\n' +
    '   parámetros PERMISO_NOMBRE y PERMISO_CODIGO. */\n' +
    'function fabricaPermiso_(__clave, __libro, PERMISO_NOMBRE, PERMISO_CODIGO) {\n' +
    '  return (function () {\n' +
    '    const __entorno = entornoModulo_(__clave, __libro);\n' + ENTORNO +
    '    const API_TOKEN = tokenPortal_();\n\n' + core + '\n\n' + cierre(fnsCore, core) +
    '  })();\n}\nvar __permisos = {};\n';
  PERMISOS.forEach((p) => {
    const cfg = leer(p.config);
    const nombre = (/^const PERMISO_NOMBRE = '([^']*)'/m.exec(cfg) || [])[1];
    const codigo = (/^const PERMISO_CODIGO = '([^']*)'/m.exec(cfg) || [])[1];
    if (!nombre || !codigo) throw new Error(p.config + ': falta PERMISO_NOMBRE o PERMISO_CODIGO');
    const ident = 'modulo_' + p.clave + '_';
    gs += '\nfunction ' + ident + '() { return __permisos.' + p.clave + ' || (__permisos.' + p.clave + ' = fabricaPermiso_(' +
      [comillas(p.clave), comillas(p.libro), comillas(nombre), comillas(codigo)].join(', ') + ')); }\n' + registrar(p.clave, ident);
  });
  PERMISOS.forEach((p) => { gs += envoltorios(p.clave, 'modulo_' + p.clave + '_', fnsCore); });
  escribir('10-permisos.gs', gs);

  // ── Los demás módulos: cada backend completo en su propio espacio.
  OTROS.forEach((m, i) => {
    const fuente = adaptar(leer(m.archivo), m.archivo);
    const fns = publicas(fuente);
    const ident = 'modulo_' + m.clave + '_';
    const nombre = (11 + i) + '-' + m.clave + '.gs';
    escribir(nombre, cabecera(nombre, 'Módulo "' + m.clave + '" del Portal SSTA (mismo código de ' + m.archivo + ')') +
      'var __' + m.clave + ';\n' +
      'function ' + ident + '() {\n' +
      '  if (__' + m.clave + ') return __' + m.clave + ';\n' +
      '  __' + m.clave + ' = (function () {\n' +
      '    const __entorno = entornoModulo_(' + comillas(m.clave) + ', ' + comillas(m.libro) + ');\n' + ENTORNO +
      fuente + '\n\n' + cierre(fns, fuente) +
      '  })();\n' +
      '  return __' + m.clave + ';\n' +
      '}\n' + registrar(m.clave, ident) + (fns.length ? envoltorios(m.clave, ident, fns) : ''));
  });
  armarTodoEnUno(archivos);
  return archivos;
}

/* v119: lo mismo en UN solo archivo para instalar a mano (se copia y se pega una vez).
   Va en otra carpeta: el actualizador (clasp) sigue usando los 8 archivos de servidor-unico/
   y, si encuentra este archivo en un proyecto, saca de él los datos de la empresa. */
const TODO_EN_UNO = path.join(RAIZ, 'servidor-todo-en-uno');
function armarTodoEnUno(archivos) {
  if (!fs.existsSync(TODO_EN_UNO)) fs.mkdirSync(TODO_EN_UNO);
  const orden = ['01-Empresa.gs'].concat(archivos.filter((f) => f !== '01-Empresa.gs'));
  const empresa = fs.readFileSync(path.join(SALIDA, '01-Empresa.gs'), 'utf8').replace(/^\/\*[\s\S]*?\*\/\s*/, '');
  const txt = '/* ============================================================\n' +
    '   PORTAL SSTA — SERVIDOR COMPLETO EN UN SOLO ARCHIVO\n' +
    '   1. En script.google.com → Nuevo proyecto, borra lo que trae y PEGA TODO ESTE ARCHIVO.\n' +
    '   2. Cambia SOLO las 3 líneas de «DATOS DE LA EMPRESA» (aquí abajo).\n' +
    '   3. Guarda (💾), elige «instalar» arriba y ▶ Ejecutar. Sigue la guía.\n' +
    '   Para actualizar después: pega el archivo nuevo encima (los datos quedan guardados) y\n' +
    '   Implementar → Gestionar implementaciones → ✏️ → Nueva versión.\n' +
    '   ============================================================ */\n\n' +
    '/* ─────────── DATOS DE LA EMPRESA (cambia solo esto) ─────────── */\n' + empresa.trim() + '\n' +
    '/* ─────────── FIN DE LOS DATOS. No cambies nada de aquí para abajo. ─────────── */\n\n' +
    orden.slice(1).map((f) => '/* ═════════ ' + f + ' ═════════ */\n' + fs.readFileSync(path.join(SALIDA, f), 'utf8')).join('\n\n');
  fs.writeFileSync(path.join(TODO_EN_UNO, 'Portal-SSTA.gs'), txt);
}

if (require.main === module) {
  const a = armar();
  console.log('Servidor único generado en servidor-unico/:\n  ' + a.map((f) => f + '  (' + Math.round(fs.statSync(path.join(SALIDA, f)).size / 1024) + ' KB)').join('\n  '));
}
module.exports = { armar, MODULOS, SALIDA, TODO_EN_UNO };
