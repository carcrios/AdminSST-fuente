#!/usr/bin/env node
/* ============================================================
   actualizar-servidores.js — Actualiza el servidor de TODAS tus empresas
   cliente con un solo comando
   ------------------------------------------------------------
   Cada empresa tiene su servidor (Apps Script) en SU cuenta de Google.
   Si la empresa compartió ese proyecto contigo como editor, este script,
   para cada una:
     1. descarga su proyecto (clasp clone),
     2. conserva su 01-Empresa.gs (nombre, correos, WhatsApp) y su
        appsscript.json; si viene de antes de la v99 (sin 01-Empresa), lo
        arma con los datos que tenía en 00-Portal,
     3. reemplaza los demás archivos por los de servidor-unico/,
     4. sube el código (clasp push), crea una versión y la publica en LA
        MISMA implementación (la URL /exec no cambia),
     5. comprueba que el servidor responde con la versión nueva.

   PREPARACIÓN (una vez, en tu computador):
     · Node 18 o superior.   · npm install -g @google/clasp
     · clasp login   (con TU cuenta de Google)
     · Activa la API de Apps Script en https://script.google.com/home/usersettings
     · Cada empresa: en su Apps Script → Compartir → tu correo como Editor.
       El ID del proyecto sale en ⚙ Configuración del proyecto → ID de la secuencia de comandos.

   LISTA DE EMPRESAS (un archivo JSON, guárdalo FUERA del repositorio):
     [ { "codigo": "acme", "nombre": "ACME S.A.S.",
         "scriptId": "1AbC…", "servidor": "https://script.google.com/macros/s/AKfy…/exec" } ]
   ("servidor" es la URL de la aplicación web: de ahí sale la implementación).

   USO:
     node herramientas/actualizar-servidores.js ~/clientes.json            # todas
     node herramientas/actualizar-servidores.js ~/clientes.json --solo acme
     node herramientas/actualizar-servidores.js ~/clientes.json --probar   # arma todo, no sube nada
     node herramientas/actualizar-servidores.js ~/clientes.json --estado   # v167: ¿en qué versión va cada una? (no cambia nada, no usa clasp)

   EMPRESA NUEVA: node herramientas/instalar-empresa.js (crea su servidor y la anota en la lista).

   ARCHIVOS PROPIOS: todo .gs del proyecto de la empresa se reemplaza por los
   del portal, menos 01-Empresa y los que empiecen por "propio" (p. ej.
   propio-Informes.gs). Si alguien agregó código suyo con otro nombre, se
   borra: renómbralo antes. El resumen dice qué archivos se quitaron.

   Si una versión nueva pide permisos nuevos de Google, el dueño de cada
   proyecto debe abrirlo y ejecutar ▶ instalar una vez (el resumen lo avisa).
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const FUENTE = path.join(RAIZ, 'servidor-unico');
const CLASP = process.env.CLASP || 'clasp';
const EDITABLE = '01-Empresa';

function versionPortal() {
  const t = fs.readFileSync(path.join(FUENTE, '00-Portal.gs'), 'utf8');
  return (/const VERSION_PORTAL = '([^']+)'/.exec(t) || [])[1] || '';
}
function clasp(args, cwd) {
  // shell en Windows (clasp es un .cmd); en Linux/Mac, directo.
  return execFileSync(CLASP, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
}
const implementacion = (url) => (/\/macros\/s\/([\w-]+)\/exec/.exec(String(url || '')) || [])[1] || '';

/** Saca de un 00-Portal viejo (antes de v99) las tres constantes de la empresa. */
function extraerDatosEmpresa(texto) {
  const tomar = (re) => { const m = re.exec(texto); return m ? m[0] : null; };
  const nombre = tomar(/^const EMPRESA_NOMBRE = [^\n]*;/m);
  const correos = tomar(/^const CORREOS_SSTA = \[[\s\S]*?\];/m);
  const contacto = tomar(/^const CONTACTO_EPP = \{[\s\S]*?\};/m);
  if (!nombre || !correos) return null;
  const plantilla = fs.readFileSync(path.join(FUENTE, EDITABLE + '.gs'), 'utf8');
  let s = plantilla.replace(/^const EMPRESA_NOMBRE = [^\n]*;/m, nombre).replace(/^const CORREOS_SSTA = \[[\s\S]*?\];/m, correos);
  if (contacto) s = s.replace(/^const CONTACTO_EPP = \{[\s\S]*?\};/m, contacto);
  return s;
}

/** Prepara la carpeta de una empresa: devuelve qué archivos quedan y si hubo que armar 01-Empresa. */
function preparar(dir) {
  const archivos = fs.readdirSync(dir).filter((f) => /\.(gs|js)$/.test(f));
  const ext = archivos.some((f) => f.endsWith('.gs')) ? '.gs' : '.js';
  const base = (f) => f.replace(/\.(gs|js)$/, '');
  let editable = archivos.find((f) => base(f) === EDITABLE);
  let migrado = false;
  if (!editable) {
    // Antes de la v99 los datos estaban arriba de 00-Portal.
    const viejo = archivos.find((f) => base(f) === '00-Portal') || archivos.find((f) => /const EMPRESA_NOMBRE =/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
    const datos = viejo ? extraerDatosEmpresa(fs.readFileSync(path.join(dir, viejo), 'utf8')) : null;
    if (!datos) throw new Error('No encontré los datos de la empresa (EMPRESA_NOMBRE y CORREOS_SSTA) en su proyecto. ¿Es un servidor único del portal?');
    editable = EDITABLE + ext;
    fs.writeFileSync(path.join(dir, editable), datos);
    migrado = true;
  }
  // Fuera todo el código viejo menos 01-Empresa y los archivos "propio…" (appsscript.json no se toca).
  const nuevos = fs.readdirSync(FUENTE).filter((f) => f.endsWith('.gs') && base(f) !== EDITABLE).sort();
  const delPortal = new Set(nuevos.map(base));
  const quitados = [];
  fs.readdirSync(dir).filter((f) => /\.(gs|js)$/.test(f) && base(f) !== EDITABLE && !/^propio/i.test(base(f))).forEach((f) => { if (!delPortal.has(base(f))) quitados.push(f); fs.unlinkSync(path.join(dir, f)); });
  nuevos.forEach((f) => fs.copyFileSync(path.join(FUENTE, f), path.join(dir, base(f) + ext)));
  return { ext, migrado, quitados, archivos: [editable].concat(nuevos.map((f) => base(f) + ext)) };
}

async function comprobar(url, version) {
  if (typeof fetch === 'undefined') return { ok: null, nota: 'Node sin fetch: compruébalo abriendo la URL.' };
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { redirect: 'follow' });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (e) {}
      if (j && j.version === version) return { ok: true };
      if (j && j.version) return { ok: false, nota: 'responde ' + j.version + ' (espera unos segundos y vuelve a probar)' };
      if (/accounts\.google|authoriz|autoriz/i.test(t)) return { ok: false, nota: 'Google pide autorizar: el dueño debe abrir el proyecto y ejecutar ▶ instalar' };
    } catch (e) { /* reintento */ }
    await new Promise((ok) => setTimeout(ok, 3000));
  }
  return { ok: false, nota: 'no respondió con la versión nueva' };
}

/** v167: qué dice la respuesta de un servidor frente a la versión del portal. */
function clasificar(texto, version) {
  let j = null; try { j = JSON.parse(String(texto || '')); } catch (e) {}
  if (j && j.version) return { estado: j.version === version ? 'al-dia' : 'atrasado', version: String(j.version) };
  if (/accounts\.google|authoriz|autoriz/i.test(String(texto || ''))) return { estado: 'autorizar', version: '' };
  return { estado: 'sin-respuesta', version: '' };
}
const ESTADOS = { 'al-dia': '✓ al día', atrasado: '↑ falta actualizar', autorizar: '! Google pide autorizar: el dueño debe ejecutar ▶ instalar', 'sin-respuesta': '✗ no responde (revisa la URL o que esté implementado)' };

/** v167: en qué versión va el servidor de cada empresa. Solo lee: no cambia nada. `traer` se puede reemplazar en las pruebas. */
async function estado(clientes, version, traer) {
  traer = traer || (async (url) => { const r = await fetch(url, { redirect: 'follow' }); return r.text(); });
  const res = [];
  for (const c of clientes) {
    let r;
    if (!implementacion(c.servidor)) r = { estado: 'sin-respuesta', version: '', nota: '"servidor" no es una URL /exec' };
    else { try { r = clasificar(await traer(c.servidor), version); } catch (e) { r = { estado: 'sin-respuesta', version: '' }; } }
    res.push(Object.assign({ codigo: c.codigo, nombre: c.nombre }, r));
  }
  return res;
}
function tablaEstado(res, version) {
  const ancho = Math.max(8, ...res.map((r) => String(r.nombre || r.codigo || '').length));
  const filas = res.map((r) => '  ' + String(r.nombre || r.codigo || '').padEnd(ancho) + '  ' + String(r.version || '—').padEnd(6) + '  ' + ESTADOS[r.estado] + (r.nota ? ' (' + r.nota + ')' : ''));
  const bien = res.filter((r) => r.estado === 'al-dia').length;
  return ['Portal ' + version + ' · ' + res.length + ' empresa(s)'].concat(filas, '', bien + ' de ' + res.length + ' al día.' + (bien < res.length ? ' Por actualizar o revisar: ' + res.filter((r) => r.estado !== 'al-dia').map((r) => r.codigo).join(', ') : '')).join('\n');
}

async function actualizarUna(c, opciones) {
  const version = versionPortal();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-' + (c.codigo || 'empresa') + '-'));
  const r = { codigo: c.codigo, nombre: c.nombre, ok: false, pasos: [] };
  try {
    if (!c.scriptId) throw new Error('Falta "scriptId".');
    const dep = implementacion(c.servidor);
    if (!dep) throw new Error('"servidor" no es una URL /exec de Apps Script.');
    clasp(['clone', c.scriptId], dir); r.pasos.push('descargado');
    const p = preparar(dir); r.pasos.push(p.migrado ? '01-Empresa armado con sus datos' : '01-Empresa conservado');
    if (p.quitados.length) r.pasos.push('OJO, se quitaron archivos que no son del portal: ' + p.quitados.join(', '));
    if (opciones.probar) { r.ok = true; r.pasos.push('PRUEBA: no se subió nada (' + dir + ')'); return r; }
    clasp(['push', '--force'], dir); r.pasos.push('código subido');
    // Descripciones sin espacios: en Windows clasp corre en una consola que partiría el texto.
    const etiqueta = 'Portal-' + version;
    const sal = clasp(['version', etiqueta], dir);
    const nv = (/Created version (\d+)/i.exec(String(sal)) || /versi[oó]n\D{0,12}(\d+)/i.exec(String(sal)) || [])[1];   // "Created version 7." (clasp 2 y 3)
    if (!nv) throw new Error('clasp no dijo qué versión creó: ' + sal);
    r.pasos.push('versión ' + nv);
    try { clasp(['redeploy', dep, nv, etiqueta], dir); }
    catch (e) { clasp(['deploy', '--deploymentId', dep, '--versionNumber', nv, '--description', etiqueta], dir); }
    r.pasos.push('publicada en la misma URL');
    const v = opciones.sinComprobar ? { ok: null } : await comprobar(c.servidor, version);
    r.ok = v.ok !== false; if (v.nota) r.pasos.push(v.nota); else if (v.ok) r.pasos.push('responde ' + version);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  } catch (e) {
    r.error = String((e.stderr || '') + ' ' + (e.message || e)).trim().slice(0, 400);
  }
  return r;
}

async function principal(argv) {
  const iSolo = argv.indexOf('--solo');
  const lista = argv.find((a, i) => !a.startsWith('--') && !(iSolo !== -1 && i === iSolo + 1));
  if (!lista) { console.log('Uso: node herramientas/actualizar-servidores.js <clientes.json> [--solo <código>] [--probar] [--estado]'); return 2; }
  if (!fs.existsSync(lista)) { console.log('No existe ' + lista + '. Es tu lista de empresas (se crea sola con node herramientas/instalar-empresa.js … --clientes ' + lista + ').'); return 2; }
  let clientes = JSON.parse(fs.readFileSync(lista, 'utf8'));
  const solo = iSolo !== -1 ? String(argv[iSolo + 1] || '') : '';
  if (iSolo !== -1) {
    if (!solo || solo.startsWith('--')) { console.log('Falta el código después de --solo.'); return 2; }
    clientes = clientes.filter((c) => c.codigo === solo);
    if (!clientes.length) { console.log('No hay ninguna empresa con el código «' + solo + '» en ' + lista + '.'); return 2; }
  }
  const opciones = { probar: argv.includes('--probar'), sinComprobar: argv.includes('--sin-comprobar') };
  const version = versionPortal();
  if (argv.includes('--estado')) { const res = await estado(clientes, version); console.log(tablaEstado(res, version)); return res.every((r) => r.estado === 'al-dia') ? 0 : 1; }
  console.log('Portal ' + version + ' → ' + clientes.length + ' empresa(s)' + (opciones.probar ? ' (PRUEBA)' : ''));
  const res = [];
  for (const c of clientes) {
    process.stdout.write('· ' + (c.nombre || c.codigo) + '… ');
    const r = await actualizarUna(c, opciones); res.push(r);
    console.log(r.ok ? '✓ ' + r.pasos.join(' · ') : '✗ ' + (r.error || r.pasos.join(' · ')));
  }
  const mal = res.filter((r) => !r.ok);
  console.log('\n' + (res.length - mal.length) + ' de ' + res.length + ' al día.' + (mal.length ? ' Revisar: ' + mal.map((r) => r.codigo).join(', ') : ''));
  return mal.length ? 1 : 0;
}

if (require.main === module) principal(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
module.exports = { clasificar, estado, tablaEstado, principal, preparar, extraerDatosEmpresa, implementacion, actualizarUna, versionPortal };
