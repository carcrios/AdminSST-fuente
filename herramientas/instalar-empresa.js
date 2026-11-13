#!/usr/bin/env node
/* ============================================================
   instalar-empresa.js — El servidor de una empresa NUEVA con un comando (v167)
   ------------------------------------------------------------
   Antes: crear el proyecto en Apps Script, pegar el servidor, cambiar tres
   líneas, poner la zona horaria, implementar como aplicación web, copiar
   la URL y anotarla en la lista de clientes. Unos 10 minutos a mano y
   varios sitios donde equivocarse.

   Ahora este comando:
     1. crea el proyecto de Apps Script (clasp create),
     2. le pone el servidor de esta versión con 01-Empresa ya lleno
        (nombre, correos y WhatsApp) y la zona horaria de Bogotá,
     3. lo sube, crea la versión y lo publica como aplicación web
        («Ejecutar como: yo», «Acceso: cualquier usuario»),
     4. anota la empresa en tu lista de clientes (clientes.json), que es la
        misma que usa actualizar-servidores.js,
     5. te dice los DOS pasos que solo puede hacer una persona.

   DE QUIÉN QUEDA EL PROYECTO: de la cuenta de Google con la que hiciste
   «clasp login». Para que el servidor y los datos queden en la cuenta de
   la empresa (lo que dice el contrato), entra con la cuenta de ELLA:
       clasp logout   y luego   clasp login   (con la cuenta de la empresa)
   Al terminar, comparte el proyecto contigo como Editor y vuelve a entrar
   con tu cuenta: desde ahí lo actualizas con actualizar-servidores.js.

   PREPARACIÓN (una vez): Node 18+, npm install -g @google/clasp, y activar
   la API de Apps Script en https://script.google.com/home/usersettings
   (en la cuenta que va a quedar de dueña).

   USO:
     node herramientas/instalar-empresa.js --codigo acme-sas --nombre "ACME S.A.S." \
          --correos sst@empresa.com,gerencia@empresa.com \
          [--contacto "Laura Gómez"] [--whatsapp "+57 300 123 4567"] \
          [--clientes ~/clientes.json] [--probar]

     --probar   arma la carpeta del servidor y la muestra; no crea nada en Google.

   LO QUE NO SE PUEDE AUTOMATIZAR (Google exige que lo haga el dueño):
     · ▶ instalar una vez, para aceptar los permisos y crear los libros.
     · ▶ verConfiguracion, para copiar la clave del portal al configurador.
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..');
const FUENTE = path.join(RAIZ, 'servidor-unico');
const CLASP = process.env.CLASP || 'clasp';

function versionPortal() {
  const t = fs.readFileSync(path.join(FUENTE, '00-Portal.gs'), 'utf8');
  return (/const VERSION_PORTAL = '([^']+)'/.exec(t) || [])[1] || '';
}
function clasp(args, cwd) {
  // shell en Windows (clasp es un .cmd); por eso ningún argumento lleva espacios.
  return execFileSync(CLASP, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
}

/** Lee --clave valor de la línea de comandos. */
function argumentos(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2), sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) o[k] = true; else { o[k] = sig; i++; }
  }
  return o;
}

/** Revisa los datos antes de tocar Google. Devuelve la lista de errores (vacía si todo bien). */
function validar(d) {
  const e = [];
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(String(d.codigo || ''))) e.push('--codigo: minúsculas, números y guiones, de 2 a 40 (por ejemplo acme-sas).');
  if (!String(d.nombre || '').trim() || d.nombre === true) e.push('--nombre: la razón social, entre comillas.');
  const correos = listaCorreos(d.correos);
  if (!correos.length) e.push('--correos: al menos un correo de SST (varios, separados por coma).');
  correos.forEach((c) => { if (!/^[^\s@,;'"]+@[^\s@,;'"]+\.[a-z]{2,}$/i.test(c)) e.push('--correos: «' + c + '» no parece un correo.'); });
  if (d.whatsapp && d.whatsapp !== true && !/^\+?[\d\s-]{7,20}$/.test(String(d.whatsapp))) e.push('--whatsapp: solo números (por ejemplo "+57 300 123 4567").');
  return e;
}
const listaCorreos = (t) => (t === true ? '' : String(t || '')).split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
/** Texto dentro de comillas simples de JavaScript, sin que un apóstrofo lo rompa. */
const js = (t) => "'" + String(t === true ? '' : t || '').replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/'/g, "\\'").trim() + "'";

/** 01-Empresa.gs con los datos de esta empresa (parte de la plantilla de servidor-unico). */
function empresaGs(d) {
  const plantilla = fs.readFileSync(path.join(FUENTE, '01-Empresa.gs'), 'utf8');
  const RE = [/^const EMPRESA_NOMBRE = [^\n]*;/m, /^const CORREOS_SSTA = \[[\s\S]*?\];/m, /^const CONTACTO_EPP = \{[\s\S]*?\};/m];
  RE.forEach((re) => { if (!re.test(plantilla)) throw new Error('servidor-unico/01-Empresa.gs cambió de forma: no encontré ' + re); });
  return plantilla
    .replace(RE[0], () => 'const EMPRESA_NOMBRE = ' + js(d.nombre) + ';')
    .replace(RE[1], () => 'const CORREOS_SSTA = [' + listaCorreos(d.correos).map(js).join(', ') + '];')
    .replace(RE[2], () => 'const CONTACTO_EPP = { nombre: ' + js(d.contacto || 'Responsable de SST') + ', whatsapp: ' + js(d.whatsapp) + ' };');
}

/** El manifiesto: zona horaria de Colombia y aplicación web abierta (la protege la clave del portal). */
function manifiesto(previo) {
  const m = Object.assign({}, previo || {});
  m.timeZone = 'America/Bogota'; m.runtimeVersion = 'V8';
  if (!m.exceptionLogging) m.exceptionLogging = 'STACKDRIVER';
  m.webapp = { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' };
  delete m.oauthScopes;   // Google deduce los permisos del código: así ▶ instalar pide exactamente los que hacen falta
  return m;
}

/** Deja en `dir` el servidor completo de la empresa. Devuelve los nombres de los archivos. */
function armarCarpeta(dir, d) {
  // Fuera el archivo vacío que a veces deja Google (Code.js / Código.js).
  fs.readdirSync(dir).filter((f) => /\.(gs|js)$/.test(f)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  const archivos = fs.readdirSync(FUENTE).filter((f) => f.endsWith('.gs')).sort();
  archivos.forEach((f) => { if (f !== '01-Empresa.gs') fs.copyFileSync(path.join(FUENTE, f), path.join(dir, f)); });
  fs.writeFileSync(path.join(dir, '01-Empresa.gs'), empresaGs(d));
  const mf = path.join(dir, 'appsscript.json');
  let previo = {}; try { previo = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) {}
  fs.writeFileSync(mf, JSON.stringify(manifiesto(previo), null, 2) + '\n');
  return archivos.concat('appsscript.json');
}

function leerClientes(archivo) {
  if (!archivo || !fs.existsSync(archivo)) return [];
  const l = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  if (!Array.isArray(l)) throw new Error(archivo + ' no es una lista de clientes.');
  return l;
}
const carpetaUsuario = (p) => String(p).replace(/^~(?=$|[\\/])/, os.homedir());

async function instalar(d, opciones) {
  const o = opciones || {}, pasos = [], version = versionPortal();
  const errores = validar(d);
  if (errores.length) throw new Error('Revisa los datos:\n  · ' + errores.join('\n  · '));
  const lista = d.clientes && d.clientes !== true ? path.resolve(carpetaUsuario(d.clientes)) : '';
  const clientes = leerClientes(lista);
  if (clientes.some((c) => c.codigo === d.codigo)) throw new Error('Ya hay una empresa con el código «' + d.codigo + '» en ' + lista + '. Para actualizarla: node herramientas/actualizar-servidores.js ' + lista + ' --solo ' + d.codigo);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-nueva-' + d.codigo + '-'));
  if (o.probar) {
    const a = armarCarpeta(dir, d);
    return { ok: true, probar: true, dir, archivos: a, pasos: ['PRUEBA: servidor armado en ' + dir + ' (' + a.length + ' archivos); no se creó nada en Google'] };
  }
  try { clasp(['create', '--type', 'standalone', '--title', 'Portal-SSTA-' + d.codigo], dir); }
  catch (e) {
    const t = String((e && (e.stderr || e.message)) || '');
    if (e && e.code === 'ENOENT') throw new Error('No encontré «clasp». Instálalo una vez: npm install -g @google/clasp   y entra: clasp login');
    if (/login|credential|unauth|logged/i.test(t)) throw new Error('clasp no tiene sesión: corre «clasp login» con la cuenta que va a quedar de dueña del servidor.');
    if (/Apps Script API|not enabled|usersettings/i.test(t)) throw new Error('Falta activar la API de Apps Script en https://script.google.com/home/usersettings (en la cuenta con la que entraste a clasp).');
    throw new Error('No se pudo crear el proyecto: ' + t.trim().split('\n').slice(-2).join(' '));
  }
  let scriptId = '';
  try { scriptId = JSON.parse(fs.readFileSync(path.join(dir, '.clasp.json'), 'utf8')).scriptId || ''; } catch (e) {}
  if (!scriptId) throw new Error('clasp creó el proyecto pero no dejó su ID (.clasp.json). Míralo en script.google.com y sigue a mano con la guía.');
  pasos.push('proyecto creado');
  // Desde aquí, si algo falla, el proyecto YA existe: el mensaje dice cuál es para no crear otro.
  const ya = ' El proyecto ya existe (https://script.google.com/d/' + scriptId + '/edit): corrige y termina ahí, o bórralo antes de volver a correr este comando.';
  let servidor = '';
  try {
    armarCarpeta(dir, d);
    clasp(['push', '--force'], dir); pasos.push('servidor ' + version + ' subido');
    const etiqueta = 'Portal-' + version;
    const sal = String(clasp(['version', etiqueta], dir));
    const nv = (/Created version (\d+)/i.exec(sal) || /versi[oó]n\D{0,12}(\d+)/i.exec(sal) || [])[1];
    if (!nv) throw new Error('clasp no dijo qué versión creó: ' + sal);
    const dep = String(clasp(['deploy', '--versionNumber', nv, '--description', etiqueta], dir));
    const id = (/\b(AKfy[\w-]{6,})/.exec(dep) || [])[1];
    if (!id) throw new Error('clasp no dijo cuál es la implementación: ' + dep);
    servidor = 'https://script.google.com/macros/s/' + id + '/exec';
    pasos.push('publicado como aplicación web');
  } catch (e) { throw new Error(String(e.message || e).split('\n')[0] + '.' + ya); }
  const ficha = { codigo: d.codigo, nombre: String(d.nombre).trim(), scriptId, servidor };
  if (lista) {
    fs.mkdirSync(path.dirname(lista), { recursive: true });
    fs.writeFileSync(lista, JSON.stringify(clientes.concat(ficha), null, 2) + '\n');
    pasos.push('anotada en ' + lista);
  }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return { ok: true, ficha, pasos, version };
}

function loQueFalta(r, conLista) {
  const f = r.ficha;
  return [
    '',
    'Servidor de «' + f.nombre + '» creado (' + r.version + ').',
    '  Proyecto:  https://script.google.com/d/' + f.scriptId + '/edit',
    '  Servidor:  ' + f.servidor,
    '',
    'FALTAN DOS PASOS QUE SOLO PUEDE HACER EL DUEÑO DE LA CUENTA (2 minutos):',
    '  1. Abre el proyecto → arriba elige la función «instalar» → ▶ Ejecutar → Revisar permisos → Permitir.',
    '     (crea los libros en su Drive y deja el aviso diario programado)',
    '  2. Elige «verConfiguracion» → ▶ Ejecutar. Copia «servidor» y «apiToken» al configurador',
    '     (configurar-empresa.html → Empresa dentro de tu sitio multiempresa → código: ' + f.codigo + ').',
    '',
    'Si entraste a clasp con la cuenta de la empresa: Compartir → tu correo como Editor, y vuelve a tu cuenta (clasp logout / clasp login).',
    conLista ? 'Para comprobar que quedó respondiendo:  node herramientas/actualizar-servidores.js <clientes.json> --estado'
      : 'OJO: no diste --clientes. Anota tú esta empresa en tu clientes.json:\n  ' + JSON.stringify(f),
    ''
  ].join('\n');
}

if (require.main === module) {
  const d = argumentos(process.argv.slice(2));
  if (d.ayuda || d.help || !Object.keys(d).length) {
    console.log('Uso: node herramientas/instalar-empresa.js --codigo acme-sas --nombre "ACME S.A.S." --correos sst@empresa.com,gerencia@empresa.com\n' +
      '       [--contacto "Laura Gómez"] [--whatsapp "+57 300 123 4567"] [--clientes ~/clientes.json] [--probar]');
    process.exit(2);
  }
  instalar(d, { probar: !!d.probar }).then((r) => {
    console.log('✓ ' + r.pasos.join(' · '));
    if (!r.probar) console.log(loQueFalta(r, !!(d.clientes && d.clientes !== true)));
  }, (e) => { console.error('✗ ' + e.message); process.exit(1); });
}
module.exports = { instalar, validar, empresaGs, manifiesto, armarCarpeta, argumentos, loQueFalta };
