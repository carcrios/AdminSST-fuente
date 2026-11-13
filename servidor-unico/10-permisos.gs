/* ============================================================
   10-permisos.gs — Los 5 permisos de trabajo del Portal SSTA
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
/* Es el mismo backends/permisos/core.gs de siempre. Cada permiso (caliente,
   alturas, confinados, izajes, eléctrico) es una instancia aparte con su
   propio libro; lo que en la instalación original va en config-<permiso>.gs aquí son los
   parámetros PERMISO_NOMBRE y PERMISO_CODIGO. */
function fabricaPermiso_(__clave, __libro, PERMISO_NOMBRE, PERMISO_CODIGO) {
  return (function () {
    const __entorno = entornoModulo_(__clave, __libro);
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

    const API_TOKEN = tokenPortal_();

// ===== NÚCLEO COMPARTIDO de los backends de permisos de trabajo =====
// Este archivo es IDÉNTICO en los cinco proyectos de Apps Script (Caliente,
// Alturas, Espacios Confinados, Izajes y Eléctrico). Lo único que cambia
// entre uno y otro vive en config-<tipo>.gs, que va como SEGUNDO archivo del
// mismo proyecto y define PERMISO_NOMBRE, PERMISO_CODIGO y API_TOKEN.
//
// Antes cada permiso tenía su propia copia completa de estas ~700 líneas y
// solo se diferenciaban en cuatro textos de correo: cualquier arreglo había
// que aplicarlo cinco veces, y bastaba olvidar uno para que ese permiso se
// quedara atrás sin que nadie lo notara.
//
// Para actualizar: se pega este mismo contenido en los cinco proyectos, sin
// editar nada. Si hay que tocar algo por permiso, va en su config, no aquí.
//
// Pega este código en Extensiones > Apps Script de tu Google Sheet, reemplazando el actual.
//
// Cambios sobre la versión anterior:
//  1. VALIDA EL TOKEN (antes se recibía pero nunca se comparaba — cualquiera con la
//     URL /exec podía leer o escribir permisos sin conocer el token real).
//  2. Evita que un cierre ya guardado se sobrescriba por una condición de carrera o
//     por un reintento del Outbox — si ya estaba CERRADO y llega la misma info,
//     responde "ok" sin tocar la fila; si llega info distinta, la rechaza.
//  3. Usa LockService para que dos guardados casi simultáneos no se pisen.
//  4. Guarda "openedAt" (fecha real de apertura) por separado de "updatedAt"
//     (última vez que se tocó la fila por cualquier motivo). openedAt se fija una
//     sola vez y no se vuelve a tocar. Compatible con filas antiguas sin esa columna.
//
//  5. ===== NUEVO: REGISTRO INMUTABLE (bitácora de eventos) =====
//     Este es el cambio importante de esta versión.
//
//     El problema que resuelve: el token vive en config.js, que el navegador
//     tiene que descargar para funcionar. O sea que NO es un secreto: cualquiera
//     que abra el portal puede leerlo y mandar peticiones directas a esta URL.
//     Mientras la hoja "Permisos" fuera la única fuente de verdad y sus filas se
//     sobrescribieran, alguien con el token podía ALTERAR un permiso ya firmado
//     y no quedaba rastro. Para un documento con valor probatorio, eso es lo
//     grave — no que alguien meta datos basura, sino que se pueda cambiar lo que
//     ya se firmó sin que se note.
//
//     Cómo funciona ahora:
//       · La hoja "Eventos" recibe UNA FILA POR CADA INTENTO DE ESCRITURA, con
//         marca de tiempo. Solo se agregan filas: este código nunca hace
//         setValues, update ni delete sobre ella. Ahí está la historia completa.
//       · También se registran los intentos RECHAZADOS. Si alguien trata de
//         modificar un permiso cerrado, queda constancia de qué mandó y cuándo.
//       · La hoja "Permisos" pasa a ser una PROYECCIÓN: un resumen del estado
//         actual, para que el dashboard siga siendo rápido. Si se corrompiera
//         (por manipulación o por un error), se reconstruye entera desde
//         "Eventos" con reconstruirPermisosDesdeEventos() — ver más abajo.
//       · verificarIntegridad() compara la proyección contra la bitácora y
//         avisa por correo si alguna no cuadra.
//
//     Qué NO cambia: la respuesta de doGet es idéntica a la anterior, así que el
//     frontend (permiso-core.js, dashboard.html) no necesita ningún ajuste.
//
//  6. El token ya no se guarda en la hoja. Antes el JSON almacenado era el body
//     completo, token incluido, así que el token quedaba escrito en cada fila.
//
// ---------------------------------------------------------------------------
// DESPUÉS DE PEGAR ESTE CÓDIGO, HAZ ESTO UNA SOLA VEZ:
//   1. Ejecuta la función  migrarHistorialExistente()  desde el editor
//      (menú Ejecutar). Crea los eventos de las filas que ya tienes, para que
//      la bitácora arranque completa y no en blanco.
//   2. Despliega como "Nueva versión" (NO "Nueva implementación"), para que la
//      URL de config.js siga siendo la misma.
//   3. Opcional pero recomendado: en la hoja de cálculo, clic derecho sobre la
//      pestaña "Eventos" → Proteger hoja, y quítale permiso de edición a todo
//      el mundo excepto a ti. El script sigue pudiendo escribir; las personas no.
// ---------------------------------------------------------------------------

const SHEET_NAME = 'Permisos';
const EVENTOS_SHEET_NAME = 'Eventos';
// API_TOKEN, PERMISO_NOMBRE y PERMISO_CODIGO los define config-<tipo>.gs

/* v162 · Ficha 360: ¿en qué registros de este módulo aparece esta cédula? Se busca con TextFinder en la columna
   de datos (rápido aunque la hoja sea grande) y se confirma leyendo el JSON, para no confundir números parecidos. */
function cedulaEnJson_(json, k) {
  let o; try { o = JSON.parse(json); } catch (e) { return ''; }
  let rol = '';
  (function rec(x, campo, prof) {
    if (rol || prof > 8 || x === null || x === undefined) return;
    if (Array.isArray(x)) { x.forEach(function (y) { rec(y, campo, prof + 1); }); return; }
    if (typeof x === 'object') { Object.keys(x).forEach(function (c) { rec(x[c], c, prof + 1); }); return; }
    if (/^(cc|cedula|cédula|documento|doc|numId)$/i.test(campo || '') && String(x).replace(/\D/g, '') === k) rol = campo;
  })(o, '', 0);
  return rol;
}
function filasConCedula_(sheet, col, k) {
  const last = sheet.getLastRow(); if (last < 2 || k.length < 5) return [];
  return sheet.getRange(2, col, last - 1, 1).createTextFinder(k).findAll().map(function (r) { return r.getRow(); }).slice(0, 200);
}
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // hastaFecha/hastaHora van en columnas propias, igual que responsable y
    // sitio: el dashboard necesita saber cuándo vence cada permiso y leer el
    // JSON de cada fila solo para eso sería caro.
    sheet.appendRow(filaSegura_(['permitCode', 'status', 'dataJson', 'updatedAt', 'openedAt',
                     'responsable', 'sitio', 'hastaFecha', 'hastaHora']));
  }
  return sheet;
}

/* ── CLAVE DEL PORTAL ──────────────────────────────────────────
   El API_TOKEN de arriba está escrito en config.js, que es PÚBLICO en
   GitHub: con él cualquiera podía leer nombres, cédulas y firmas. La clave
   del portal NO va en GitHub: se escribe AQUÍ, en el Apps Script (que solo
   ve quien lo administra), y cada celular la ingresa una vez.

   Mientras CLAVE_PORTAL diga ESCRIBE_AQUI…, este backend sigue aceptando
   el token viejo (nada se cae mientras se actualizan los backends uno por
   uno). En cuanto se escribe la clave, el token público deja de servir.
   Usa una clave larga (mínimo 10 caracteres, ej. "Obra-Segura-2026!").
   También se puede poner en Configuración del proyecto → Propiedades de
   la secuencia de comandos, con el nombre CLAVE_PORTAL (tiene prioridad). */
const CLAVE_PORTAL = 'ESCRIBE_AQUI_LA_CLAVE_DEL_PORTAL';

function claveConfigurada_() {
  let c = '';
  try { c = PropertiesService.getScriptProperties().getProperty('CLAVE_PORTAL') || ''; } catch (e) { c = ''; }
  if (!c && CLAVE_PORTAL && CLAVE_PORTAL.indexOf('ESCRIBE_AQUI') !== 0) c = CLAVE_PORTAL;
  return String(c).trim();
}

function checkToken_(token) {
  const clave = claveConfigurada_();
  // Con clave configurada, SOLO la clave sirve: el token de config.js es público.
  if (clave) return String(token || '') === clave;
  return token === API_TOKEN; // todavía sin clave: como antes
}

/* ============================================================
   LECTURA EFICIENTE DE LA HOJA
   ------------------------------------------------------------
   Antes, cada guardado, apertura y listado hacía
   getDataRange().getValues(), que trae TODAS las filas con TODAS
   las columnas — incluida la C (dataJson), donde vive el permiso
   completo. Con 200 permisos de 4 KB, eso son ~800 KB que Sheets
   le entrega al script cada vez que alguien abre el dashboard,
   solo para leer códigos y fechas. Y crece sin techo con el
   histórico: el sistema se iba poniendo más lento cada mes.
   Ahora se lee únicamente lo que se necesita.
   ============================================================ */

/** Busca la fila de un permiso leyendo SOLO la columna A. Devuelve el número de
 *  fila (base 1) o -1. Reemplaza al recorrido sobre la hoja completa. */
function buscarFilaPorCodigo_(sheet, code) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const codigos = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < codigos.length; i++) {
    if (codigos[i][0] === code) return i + 2; // +2: fila 1 es encabezado, índice base 0
  }
  return -1;
}

/** Trae una fila puntual completa (7 columnas). Se usa solo tras localizarla. */
function leerFila_(sheet, rowIndex) {
  return sheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
}

/* ============================================================
   BITÁCORA INMUTABLE (hoja "Eventos")
   ------------------------------------------------------------
   Regla única y no negociable de esta sección: aquí SOLO se
   agregan filas. Ninguna función de este archivo modifica ni
   borra una fila ya escrita en "Eventos". Si algún día alguien
   necesita "corregir" un evento, la forma correcta es agregar
   otro evento que lo corrija, no editar el anterior.
   ============================================================ */

function getEventosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTOS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTOS_SHEET_NAME);
    sheet.appendRow(filaSegura_(['ts', 'permitCode', 'accion', 'resultado', 'detalle', 'opId', 'responsable', 'sitio', 'dataJson']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Agrega un evento a la bitácora. Se llama SIEMPRE, tanto si la operación se
 * aplicó como si se rechazó — un intento rechazado de tocar un permiso cerrado
 * es justo lo que uno querría poder demostrar después.
 *
 * accion:    'ABRIR' | 'ACTUALIZAR' | 'CERRAR' | 'ADD_WORKERS' | 'MIGRACION'
 * resultado: 'APLICADO' | 'RECHAZADO' | 'DUPLICADO'
 * detalle:   motivo del rechazo o nota corta (texto libre)
 * dataJson:  el contenido enviado, ya sin firmas (llevan SIGREF) y sin token
 */
function registrarEvento_(code, accion, resultado, detalle, opId, responsable, sitio, dataJson) {
  try {
    getEventosSheet_().appendRow(filaSegura_([
      new Date(),
      code || '',
      accion || '',
      resultado || '',
      detalle || '',
      opId || '',
      responsable || '',
      sitio || '',
      dataJson || ''
    ]));
  } catch (err) {
    // Si la bitácora falla no se tumba la operación del usuario en obra, pero sí
    // queda en el log de ejecución de Apps Script para poder revisarlo.
    console.error('No se pudo registrar el evento: ' + err);
  }
}

// ===== Firmas guardadas aparte (evita superar el límite de 50.000 =====
// ===== caracteres por celda de Google Sheets cuando hay muchas firmas) =====
// En vez de guardar cada firma (imagen base64, ~10.000-30.000 caracteres)
// dentro del mismo JSON del permiso, se guarda en la hoja "Firmas" y en el
// JSON principal solo queda una referencia corta tipo "SIGREF:ab12cd34".
// Esta hoja también es de solo-agregar: una firma guardada nunca se sobrescribe.
/** Devuelve los números de fila donde `columna` vale exactamente `valor`.
 *  Usa TextFinder, que resuelve la búsqueda del lado de Google y devuelve solo
 *  las coincidencias — a diferencia de traerse la columna entera al script,
 *  que era lo que hacía que todo se fuera poniendo lento a medida que la hoja
 *  crecía. Devuelve [] si la hoja está vacía. */
function filasPorValor_(sheet, columna, valor) {
  const last = sheet.getLastRow();
  if (last < 2 || !valor) return [];
  const encontrados = sheet.getRange(2, columna, last - 1, 1)
    .createTextFinder(String(valor))
    .matchEntireCell(true)
    .matchCase(true)
    .findAll();
  return encontrados.map(r => r.getRow());
}

function getFirmasSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Firmas');
  if (!sheet) {
    sheet = ss.insertSheet('Firmas');
    sheet.appendRow(filaSegura_(['permitCode', 'sigKey', 'dataUrl', 'updatedAt']));
    SpreadsheetApp.flush();
  }
  return sheet;
}

// Clave corta y determinística basada en el contenido de la firma (no aleatoria):
// así, la MISMA firma reenviada (ej. un reintento sin conexión) siempre produce
// la misma referencia, sin duplicar filas ni romper la detección de reenvíos.
function sigKeyFromDataUrl_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('').substring(0, 12);
}

// Recorre el objeto a guardar y saca cualquier campo de firma (imagen base64)
// que encuentre en cualquier nivel, sin importar la forma exacta del permiso
// (ejecutantes, responsables, cierre, trabajadores, roles, etc.).
function extraerFirmas_(obj, mapaFirmas) {
  if (Array.isArray(obj)) {
    return obj.map(item => extraerFirmas_(item, mapaFirmas));
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'string' && val.indexOf('data:image') === 0 &&
          key.toLowerCase().indexOf('sig') !== -1) {
        const sigKey = sigKeyFromDataUrl_(val);
        mapaFirmas.push({ sigKey: sigKey, dataUrl: val });
        out[key] = 'SIGREF:' + sigKey;
      } else {
        out[key] = extraerFirmas_(val, mapaFirmas);
      }
    }
    return out;
  }
  return obj;
}

// Máximo de caracteres que Google Sheets admite en UNA celda. Si una firma
// supera esto, la escritura falla y la firma se pierde en silencio (la fila del
// permiso queda con los nombres pero sin imágenes). Se deja margen bajo el tope
// real de 50.000 para no quedar al borde.
const MAX_CHARS_CELDA = 32000;   // v142: tope de Excel (respaldo .xlsx)

// Parte una firma larga en trozos que sí quepan en una celda. Cada trozo se
// guarda en su propia fila, con la clave marcada como "abc123~2/5" (trozo 2 de
// 5). Una firma que cabe entera se guarda como siempre, con su clave a secas —
// por eso las firmas ya guardadas antes de este cambio se siguen leyendo bien.
function trocearFirma_(sigKey, dataUrl) {
  if (dataUrl.length <= MAX_CHARS_CELDA) return [{ key: sigKey, texto: dataUrl }];
  const total = Math.ceil(dataUrl.length / MAX_CHARS_CELDA);
  const trozos = [];
  for (let i = 0; i < total; i++) {
    trozos.push({
      key: sigKey + '~' + (i + 1) + '/' + total,
      texto: dataUrl.substr(i * MAX_CHARS_CELDA, MAX_CHARS_CELDA)
    });
  }
  return trozos;
}

// Devuelve la clave base de una fila, sin la marca de trozo: "abc123~2/5" → "abc123".
function claveBaseFirma_(key) {
  const pos = String(key).indexOf('~');
  return pos === -1 ? String(key) : String(key).substring(0, pos);
}

function guardarFirmas_(code, mapaFirmas) {
  if (!mapaFirmas.length) return;
  const sheet = getFirmasSheet_();
  const last = sheet.getLastRow();
  // Qué firmas de ESTE permiso ya están guardadas. Antes se recorría la hoja
  // completa (todas las firmas de todos los permisos) solo para averiguarlo;
  // ahora se piden únicamente las filas de este código.
  // Se compara por clave BASE: si una firma ya está guardada en trozos, no debe
  // volver a escribirse al reenviarse la misma operación.
  const existentes = {};
  const filasDelCodigo = filasPorValor_(sheet, 1, code);
  if (filasDelCodigo.length) {
    const minR = Math.min.apply(null, filasDelCodigo);
    const maxR = Math.max.apply(null, filasDelCodigo);
    const claves = sheet.getRange(minR, 2, maxR - minR + 1, 1).getValues();
    filasDelCodigo.forEach(r => {
      existentes[code + '|' + claveBaseFirma_(claves[r - minR][0])] = true;
    });
  }
  const ahora = new Date();
  const filas = [];
  mapaFirmas.forEach(f => {
    if (existentes[code + '|' + f.sigKey]) return; // ya guardada antes
    trocearFirma_(f.sigKey, f.dataUrl).forEach(t => {
      filas.push([code, t.key, "'" + t.texto, ahora]);
    });
  });
  if (filas.length) {
    sheet.getRange(last + 1, 1, filas.length, 4).setValues(filaSegura_(filas));
  }
}

// Hace el proceso inverso al leer: reemplaza cada "SIGREF:xxxx" por la
// imagen real, buscándola en el mapa de firmas de ese permiso.
function inyectarFirmas_(obj, mapaPorKey) {
  if (Array.isArray(obj)) {
    return obj.map(item => inyectarFirmas_(item, mapaPorKey));
  }
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'string' && val.indexOf('SIGREF:') === 0) {
        out[key] = mapaPorKey[val.substring(7)] || null;
      } else {
        out[key] = inyectarFirmas_(val, mapaPorKey);
      }
    }
    return out;
  }
  return obj;
}

function cargarFirmasPorCodigo_(code) {
  const sheet = getFirmasSheet_();
  const mapa = {};
  // Paso 1: pedir directamente las filas de este permiso, en vez de recorrer
  // toda la hoja para irlas filtrando.
  const rows = filasPorValor_(sheet, 1, code);
  if (!rows.length) return mapa;
  rows.sort((a, b) => a - b);
  const minK = rows[0], maxK = rows[rows.length - 1];
  const clavesRango = sheet.getRange(minK, 2, maxK - minK + 1, 1).getValues();
  const filas = rows.map(r => ({ row: r, key: clavesRango[r - minK][0] }));
  // Paso 2: traer los base64 de un solo rango que cubra esas filas. Las firmas
  // de un mismo permiso se escriben juntas, así que en la práctica el rango es
  // pequeño. En el peor caso abarca la hoja entera, que es exactamente lo que
  // hacía antes SIEMPRE — de modo que nunca queda peor que como estaba.
  const minRow = filas[0].row, maxRow = filas[filas.length - 1].row;
  const urls = sheet.getRange(minRow, 3, maxRow - minRow + 1, 1).getValues();
  // Reensambla las firmas que se guardaron partidas en varios trozos (claves
  // tipo "abc123~2/5"), y deja tal cual las que caben en una sola celda. Los
  // trozos se ordenan por su número, no por el orden en que aparezcan las filas.
  const partes = {};
  filas.forEach(f => {
    const texto = urls[f.row - minRow][0];
    const key = String(f.key);
    const pos = key.indexOf('~');
    if (pos === -1) { mapa[key] = texto; return; }
    const base = key.substring(0, pos);
    const n = parseInt(key.substring(pos + 1).split('/')[0], 10) || 1;
    if (!partes[base]) partes[base] = [];
    partes[base].push({ n: n, texto: texto });
  });
  for (const base in partes) {
    partes[base].sort((a, b) => a.n - b.n);
    { const u = {}; partes[base].forEach(p => { u[p.n] = p.texto; }); mapa[base] = Object.keys(u).map(Number).sort((a, b) => a - b).map(n => u[n]).join(''); }   // v144: trozos repetidos: vale el último
  }
  return mapa;
}

/** ¿Este opId ya se aplicó antes? Se consulta contra la bitácora, que es donde
 *  queda constancia de la primera vez. Sirve para reconocer un reenvío (mismo
 *  envío repetido por un reintento de red) y no volver a aplicarlo. */
function opIdYaAplicado_(opId) {
  if (!opId) return false;
  const sheet = getEventosSheet_();
  // Se piden solo las filas con este opId (columna F), en vez de recorrer la
  // bitácora entera — que es la hoja que más rápido crece de todas.
  const rows = filasPorValor_(sheet, 6, opId);
  for (let i = 0; i < rows.length; i++) {
    if (sheet.getRange(rows[i], 4).getValue() === 'APLICADO') return true; // col D = resultado
  }
  return false;
}

/* ================= ESCRITURA ================= */


/* ===== v137 · SELLO DE AUDITORÍA DE LAS FIRMAS =====
   Cada firma (imagen data:image en un campo «firma…» o «sig…») recibe al llegar al servidor un sello
   a su lado (<campo>_sello): fecha y hora DEL SERVIDOR, quién (si hay usuario), el equipo (navegador),
   el GPS si la persona lo permitió, la huella SHA-256 de la imagen y un código HMAC con una clave que
   solo conoce este servidor. Así no se puede fabricar ni mover una firma a otro registro sin que se
   note. Si la misma firma vuelve a llegar (guardar de nuevo), se conserva su sello original. */
function selloSecreto_() {
  const p = PropertiesService.getScriptProperties(); let s = p.getProperty('SELLO_SECRETO');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SELLO_SECRETO', s); }
  return s;
}
function selloHex_(b) { return b.map(function (x) { return ((x < 0 ? x + 256 : x).toString(16)).padStart(2, '0'); }).join(''); }
function selloCodigo_(s) { return selloHex_(Utilities.computeHmacSha256Signature([s.huella, s.fecha, s.usuario, s.equipo, s.gps, s.ref].join('|'), selloSecreto_())); }
function selloValido_(s, huella) { return !!(s && typeof s === 'object' && s.huella === huella && s.codigo === selloCodigo_(s)); }
function ctxSello_(body, usuario, ref) {
  const d = (body && body._disp && typeof body._disp === 'object') ? body._disp : {}, g = d.gps || {};
  const gps = isFinite(g.lat) && isFinite(g.lon) && g.lat !== null && g.lon !== null ? Number(g.lat).toFixed(5) + ',' + Number(g.lon).toFixed(5) + (isFinite(g.prec) && g.prec !== null ? ' ±' + Math.round(g.prec) + ' m' : '') : '';
  return { usuario: String(usuario || '').slice(0, 120), equipo: String(d.ua || '').slice(0, 180), gps: gps, ref: String(ref || '').slice(0, 80) };
}
function sellarFirmas_(obj, ctx, prof) {
  prof = prof || 0; if (!obj || typeof obj !== 'object' || prof > 12) return 0;
  let n = 0;
  if (Array.isArray(obj)) { obj.forEach(function (x) { n += sellarFirmas_(x, ctx, prof + 1); }); return n; }
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    if (/_sello$/.test(k) || k === '_disp') return;
    if (typeof v === 'string' && v.indexOf('data:image') === 0 && /firma|sig/i.test(k)) {
      const huella = selloHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v));
      if (selloValido_(obj[k + '_sello'], huella)) return;
      const s = { fecha: new Date().toISOString(), usuario: ctx.usuario, equipo: ctx.equipo, gps: ctx.gps, ref: ctx.ref, huella: huella };
      s.codigo = selloCodigo_(s); obj[k + '_sello'] = s; n++;
    } else if (v && typeof v === 'object') n += sellarFirmas_(v, ctx, prof + 1);
  });
  return n;
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  sinImagenesFalsas_(body);
  if (!checkToken_(body.token)) {
    // Se registra el intento, pero SIN el contenido enviado: si alguien está
    // probando tokens al azar, no tiene sentido llenar la bitácora con su basura.
    registrarEvento_(body.permitCode, 'DESCONOCIDA', 'RECHAZADO', 'Token inválido', '', '', '', '');
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  const code = body.permitCode;
  if (!code) {
    return jsonOut_({ ok: false, error: 'permitCode requerido' });
  }

  try { sellarFirmas_(body, ctxSello_(body, '', 'permiso:' + code)); } catch (e) { console.log('Sello: ' + e.message); }
  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(15000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    const sheet = getSheet_();
    // Se localiza la fila leyendo solo la columna A, y después se trae esa fila
    // puntual. Antes se cargaba la hoja entera (con todos los dataJson) en cada
    // guardado, incluso cuando el permiso era nuevo y no había nada que buscar.
    const rowIndex = buscarFilaPorCodigo_(sheet, code);
    const fila = rowIndex === -1 ? null : leerFila_(sheet, rowIndex);

    // "addWorkers": agrega ejecutantes a un permiso ya abierto SIN reescribir
    // el registro completo — antes, "Agregar personal" reenviaba TODO el
    // permiso (collectOpenData() completo), lo que permitía que dos personas
    // agregando gente al mismo permiso a la vez se pisaran, o que un reintento
    // del Outbox sobrescribiera con datos viejos si la respuesta original se
    // había perdido pero el envío sí llegó. Esta acción solo AGREGA, leyendo
    // el estado más reciente del permiso (no el que el celular tenía cargado),
    // y es segura de reintentar gracias a opId.
    if (body.action === 'addWorkers') {
      if (rowIndex === -1) {
        registrarEvento_(code, 'ADD_WORKERS', 'RECHAZADO', 'Permiso no encontrado', body.opId, '', '', '');
        return jsonOut_({ ok: false, error: 'Permiso no encontrado' });
      }
      const estadoActual = fila[1];
      if (estadoActual === 'CERRADO') {
        registrarEvento_(code, 'ADD_WORKERS', 'RECHAZADO', 'El permiso ya estaba cerrado', body.opId, '', '', '');
        return jsonOut_({ ok: false, error: 'Este permiso ya fue cerrado, no se puede agregar personal.' });
      }
      let registroActual;
      try { registroActual = JSON.parse(fila[2]); }
      catch (err) {
        registrarEvento_(code, 'ADD_WORKERS', 'RECHAZADO', 'JSON del permiso ilegible', body.opId, '', '', '');
        return jsonOut_({ ok: false, error: 'No se pudo leer el registro actual del permiso.' });
      }
      registroActual._appliedOps = registroActual._appliedOps || [];
      if (body.opId && registroActual._appliedOps.indexOf(body.opId) !== -1) {
        // Esta MISMA operación ya se aplicó antes (reintento del Outbox u otro) — no se duplica.
        registrarEvento_(code, 'ADD_WORKERS', 'DUPLICADO', 'opId ya aplicado; no se repite', body.opId, '', '', '');
        return jsonOut_({ ok: true, permitCode: code });
      }
      const mapaFirmasNuevas = [];
      const nuevasFilasSinFirmas = extraerFirmas_(body.newWorkers || [], mapaFirmasNuevas);
      registroActual.ejecutantes = (registroActual.ejecutantes || []).concat(nuevasFilasSinFirmas);
      if (body.opId) {
        registroActual._appliedOps.push(body.opId);
        if (registroActual._appliedOps.length > 30) registroActual._appliedOps = registroActual._appliedOps.slice(-30);
      }
      guardarFirmas_(code, mapaFirmasNuevas);
      // La bitácora se escribe ANTES de tocar la proyección: si el script se
      // quedara sin tiempo justo aquí, preferimos un evento registrado sin
      // aplicar (detectable y reconstruible) que un cambio aplicado sin rastro.
      registrarEvento_(code, 'ADD_WORKERS', 'APLICADO', nuevasFilasSinFirmas.length + ' ejecutante(s) agregado(s)',
                       body.opId, '', '', JSON.stringify(nuevasFilasSinFirmas));
      sheet.getRange(rowIndex, 3, 1, 2).setValues(filaSegura_([[JSON.stringify(registroActual), new Date()]]));
      return jsonOut_({ ok: true, permitCode: code });
    }

    // v146: novedades de la jornada sin reescribir el permiso: ampliar la
    // vigencia, suspender / reanudar (lluvia, tormenta eléctrica, alarma) y
    // entregar el turno a otro responsable. Solo agrega, bajo el candado y con opId.
    if (body.action === 'novedad') {
      if (rowIndex === -1) return jsonOut_({ ok: false, error: 'Permiso no encontrado' });
      if (fila[1] === 'CERRADO') return jsonOut_({ ok: false, error: 'Este permiso ya fue cerrado.' });
      const TIPOS = ['ampliar', 'suspender', 'reanudar', 'turno'];
      const n = body.novedad || {};
      if (TIPOS.indexOf(n.tipo) === -1) return jsonOut_({ ok: false, error: 'Novedad no válida' });
      let reg;
      try { reg = JSON.parse(fila[2]); } catch (err) { return jsonOut_({ ok: false, error: 'No se pudo leer el registro actual del permiso.' }); }
      reg._appliedOps = reg._appliedOps || [];
      if (body.opId && reg._appliedOps.indexOf(body.opId) !== -1) return jsonOut_({ ok: true, permitCode: code });
      const limpio = function (v, max) { return String(v == null ? '' : v).slice(0, max || 300); };
      const item = { tipo: n.tipo, quien: limpio(n.quien, 120), nota: limpio(n.nota, 500), en: new Date().toISOString() };
      if (n.tipo === 'ampliar') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.hastaFecha || '')) || !/^\d{2}:\d{2}$/.test(String(n.hastaHora || ''))) return jsonOut_({ ok: false, error: 'Indica la nueva fecha y hora de fin.' });
        // v148: la ampliación es hacia adelante y dentro de la jornada (máximo 24 h desde ahora).
        const finNuevo = new Date(n.hastaFecha + 'T' + n.hastaHora + ':00-05:00').getTime();
        if (!(finNuevo > Date.now()) || finNuevo - Date.now() > 24 * 3600000) return jsonOut_({ ok: false, error: 'La nueva hora de fin debe ser posterior a ahora y dentro de las próximas 24 horas. Para otro día, repite el permiso.' });
        item.antes = (reg.hastaFecha || '') + ' ' + (reg.hastaHora || '');
        reg.hastaFecha = n.hastaFecha; reg.hastaHora = n.hastaHora;
        item.hasta = n.hastaFecha + ' ' + n.hastaHora;
      }
      if (n.tipo === 'suspender') reg.suspendido = true;
      if (n.tipo === 'reanudar') reg.suspendido = false;
      if ((n.tipo === 'suspender' || n.tipo === 'reanudar') && !item.nota) return jsonOut_({ ok: false, error: 'Escribe el motivo o lo que se verificó.' });
      if (n.tipo === 'turno') { item.cedula = String(n.cedula || '').replace(/\D/g, '').slice(0, 15); if (!item.quien || item.cedula.length < 5) return jsonOut_({ ok: false, error: 'Indica nombre y cédula de quien recibe el turno.' }); item.antes = reg.responsableTrabajo || reg.responsable || ''; reg.responsableTrabajo = item.quien; }
      reg.novedades = (reg.novedades || []).concat([item]).slice(-100);
      if (body.opId) { reg._appliedOps.push(body.opId); if (reg._appliedOps.length > 30) reg._appliedOps = reg._appliedOps.slice(-30); }
      registrarEvento_(code, 'NOVEDAD', 'APLICADO', n.tipo + (item.hasta ? ' hasta ' + item.hasta : '') + (item.quien ? ' · ' + item.quien : ''), body.opId, '', '', JSON.stringify(item));
      sheet.getRange(rowIndex, 3, 1, 2).setValues(filaSegura_([[JSON.stringify(reg), new Date()]]));
      if (n.tipo === 'ampliar') sheet.getRange(rowIndex, 8, 1, 2).setValues(filaSegura_([[reg.hastaFecha, reg.hastaHora]]));
      if (n.tipo === 'turno') sheet.getRange(rowIndex, 6).setValue(filaSegura_(item.quien));
      return jsonOut_({ ok: true, permitCode: code, novedad: item });
    }

    // No se guardan token, firstSave ni opId: son datos DEL ENVÍO, no del
    // permiso.
    //
    // Guardarlos causó un fallo serio: el panel de lectura de gases descarga el
    // permiso y lo reenvía con la lectura nueva, así que arrastraba de vuelta el
    // firstSave:true y el opId del guardado original. El servidor lo leía como
    // "reintento del mismo envío inicial", respondía ok y NO escribía nada — la
    // lectura se perdía y el usuario veía "guardado" igual. Lo mismo le pasaba a
    // cualquier reenvío de un permiso ya descargado.
    const cuerpoLimpio = {};
    for (const k in body) {
      if (k === 'token' || k === 'firstSave' || k === 'opId') continue;
      cuerpoLimpio[k] = body[k];
    }

    const mapaFirmas = [];
    const cuerpoSinFirmas = extraerFirmas_(cuerpoLimpio, mapaFirmas);
    const json = JSON.stringify(cuerpoSinFirmas);
    const ahora = new Date();
    const esCierre = body.status === 'CERRADO';
    // v148: el servidor también exige lo mínimo (un POST directo o una cola manipulada no abren un permiso vacío).
    if (body.status === 'ABIERTO' && body.firstSave === true) {
      const conNombre = (body.ejecutantes || []).filter(function (x) { return x && String(x.nombre || '').trim(); });
      if (!conNombre.length) return jsonOut_({ ok: false, error: 'El permiso necesita al menos un ejecutante.' });
      if (/^PTC-|^PEC-|confin/i.test(code) && body.gases && !(body.gases.lecturas || []).length) return jsonOut_({ ok: false, error: 'Espacio confinado sin medición de gases: no se abre.' });
    }

    if (rowIndex === -1) {
      // Fila nueva: openedAt se fija aquí, una sola vez.
      guardarFirmas_(code, mapaFirmas);
      registrarEvento_(code, esCierre ? 'CERRAR' : 'ABRIR', 'APLICADO', 'Primer registro del permiso',
                       body.opId, body.responsable || '', body.sitio || '', json);
      sheet.appendRow(filaSegura_([code, body.status || 'ABIERTO', json, ahora, ahora, body.responsable || '', body.sitio || '', body.hastaFecha || '', body.hastaHora || '']));
      return jsonOut_({ ok: true, permitCode: code });
    }

    const existingStatus = fila[1];
    const existingJson = fila[2];

    // El cliente manda firstSave:true únicamente en el primer guardado de un
    // permiso recién creado. Si en ese momento YA existe una fila con este
    // código, es una colisión real (dos permisos distintos generaron por azar
    // el mismo código) — se rechaza para que el cliente genere uno nuevo y
    // reintente, en vez de mezclar los datos de dos permisos diferentes.
    if (body.firstSave === true) {
      // Antes de tratarlo como colisión: ¿es simplemente un REENVÍO de este
      // mismo guardado? Pasa cuando el envío llegó al servidor pero la respuesta
      // se perdió por señal intermitente y el cliente reintentó. El opId no
      // cambia entre reintentos del mismo permiso, así que si ya está aplicado
      // en la bitácora, esta fila la creó este mismo envío: se confirma ok en
      // vez de mandar al cliente a generar otro código (lo que duplicaba el
      // permiso con dos códigos distintos).
      if (body.opId && opIdYaAplicado_(body.opId)) {
        registrarEvento_(code, 'ABRIR', 'DUPLICADO', 'Reenvío del mismo guardado inicial (opId ya aplicado)',
                         body.opId, body.responsable || '', body.sitio || '', '');
        return jsonOut_({ ok: true, permitCode: code });
      }
      registrarEvento_(code, 'ABRIR', 'RECHAZADO', 'Código ya existe (colisión); el cliente genera otro',
                       body.opId, '', '', '');
      return jsonOut_({ ok: false, error: 'CODE_COLLISION' });
    }

    if (existingStatus === 'CERRADO') {
      // Un permiso cerrado no se puede modificar de NINGUNA forma — ni reabrir
      // enviando status:'ABIERTO', ni cambiar sus datos. Dos excepciones, ambas
      // reenvíos del mismo cierre y no errores reales:
      //   a) mismo opId ya aplicado (el cliente ahora manda opId en el cierre,
      //      así que un reintento del Outbox se reconoce aunque el JSON difiera
      //      en algún detalle menor);
      //   b) JSON idéntico (respaldo para clientes viejos sin opId).
      let opsAplicadas = [];
      try { opsAplicadas = (JSON.parse(existingJson)._appliedOps) || []; } catch (err) { /* JSON viejo o ilegible */ }
      if (body.opId && opsAplicadas.indexOf(body.opId) !== -1) {
        registrarEvento_(code, 'CERRAR', 'DUPLICADO', 'Reenvío del mismo cierre (opId ya aplicado)', body.opId, '', '', '');
        return jsonOut_({ ok: true, permitCode: code });
      }
      if (existingJson === json && esCierre) {
        registrarEvento_(code, 'CERRAR', 'DUPLICADO', 'Reenvío del mismo cierre (JSON idéntico)', body.opId, '', '', '');
        return jsonOut_({ ok: true, permitCode: code });
      }
      // Intento real de modificar un permiso cerrado. Se rechaza Y SE GUARDA
      // lo que se intentó escribir: si alguna vez hay que investigar algo, esta
      // es la fila que importa.
      registrarEvento_(code, esCierre ? 'CERRAR' : 'ACTUALIZAR', 'RECHAZADO',
                       'Intento de modificar un permiso ya CERRADO', body.opId,
                       body.responsable || '', body.sitio || '', json);
      return jsonOut_({ ok: false, error: 'Este permiso ya fue cerrado, no se puede modificar.' });
    }

    // Se arrastran las operaciones ya aplicadas para que el opId del cierre
    // quede registrado y un reintento posterior se reconozca como duplicado.
    let opsPrevias = [];
    try { opsPrevias = (JSON.parse(existingJson)._appliedOps) || []; } catch (err) { /* fila vieja */ }
    if (body.opId && opsPrevias.indexOf(body.opId) === -1) opsPrevias.push(body.opId);
    if (opsPrevias.length > 30) opsPrevias = opsPrevias.slice(-30);
    cuerpoSinFirmas._appliedOps = opsPrevias;
    // v147: el cierre (o un reenvío) se UNE con lo que ya está guardado: antes reemplazaba el
    // permiso entero y se perdían la excepción de habilitación, la fecha de creación, las
    // novedades de la jornada y el personal que otro equipo agregó mientras tanto.
    let previo = null; try { previo = JSON.parse(existingJson); } catch (err) {}
    if (previo && typeof previo === 'object') {
      ['createdAt', 'habilitacion', 'novedades', 'suspendido', '_disp', 'sesion', 'atsRelacionado'].forEach(function (k) {
        if (previo[k] !== undefined && previo[k] !== null && previo[k] !== '') cuerpoSinFirmas[k] = previo[k];
      });
      const nov = previo.novedades || [];
      if (nov.some(function (n) { return n.tipo === 'ampliar'; })) { cuerpoSinFirmas.hastaFecha = previo.hastaFecha; cuerpoSinFirmas.hastaHora = previo.hastaHora; }
      if (nov.some(function (n) { return n.tipo === 'turno'; })) cuerpoSinFirmas.responsableTrabajo = previo.responsableTrabajo;
      const llave = function (x) { return String((x && (x.cc || x.cedula || x.nombre)) || '').replace(/\s/g, '').toLowerCase(); };
      const nuevos = cuerpoSinFirmas.ejecutantes || [], vistos = {};
      nuevos.forEach(function (x) { vistos[llave(x)] = x; });
      (previo.ejecutantes || []).forEach(function (x) {
        const k = llave(x); if (!k) return;
        if (!vistos[k]) { nuevos.push(x); vistos[k] = x; }
        else ['habilitacion', 'excepcion', 'autorizo'].forEach(function (c) { if (x[c] !== undefined && vistos[k][c] === undefined) vistos[k][c] = x[c]; });
      });
      if (nuevos.length) cuerpoSinFirmas.ejecutantes = nuevos;
    }
    const jsonFinal = JSON.stringify(cuerpoSinFirmas);

    guardarFirmas_(code, mapaFirmas);
    registrarEvento_(code, esCierre ? 'CERRAR' : 'ACTUALIZAR', 'APLICADO', '',
                     body.opId, body.responsable || '', body.sitio || '', jsonFinal);

    // Solo se actualizan columnas B, C, D (status, dataJson, updatedAt).
    // La columna E (openedAt) nunca se vuelve a tocar tras la primera vez.
    sheet.getRange(rowIndex, 2, 1, 3).setValues(filaSegura_([[body.status || 'ABIERTO', jsonFinal, ahora]]));
    // Columnas F/G (responsable, sitio) — solo lectura rápida para el dashboard;
    // se recalculan en cada guardado por si cambian con "Agregar personal" u otros ajustes.
    sheet.getRange(rowIndex, 6, 1, 4).setValues(filaSegura_([[cuerpoSinFirmas.responsableTrabajo && previo && (previo.novedades || []).some(function (n) { return n.tipo === 'turno'; }) ? cuerpoSinFirmas.responsableTrabajo : (body.responsable || ''), body.sitio || '', cuerpoSinFirmas.hastaFecha || '', cuerpoSinFirmas.hastaHora || '']]));
    return jsonOut_({ ok: true, permitCode: code });
  } finally {
    lock.releaseLock();
  }
}

/* ================= LECTURA ================= */

function doGet(e) {
  if (!checkToken_(e.parameter.token)) {
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  const code = e.parameter.code;

  // Bitácora de un permiso: ?action=history&code=XXX&token=...
  // No lo usa el portal todavía; sirve para auditar un permiso puntual desde el
  // navegador sin tener que abrir la hoja de cálculo.
  if (e.parameter.action === 'porCedula') {
    const k = String(e.parameter.cedula || '').replace(/\D/g, ''), sh = getSheet_(), out = [];
    filasConCedula_(sh, 3, k).forEach(function (n) { const f = sh.getRange(n, 1, 1, 9).getValues()[0]; const rol = cedulaEnJson_(f[2], k); if (!rol) return;
      out.push({ code: f[0], status: f[1], abierto: f[4] || f[3], sitio: f[6] || '', responsable: f[5] || '', hasta: f[7] || '' }); });
    return jsonOut_({ ok: true, rows: out });
  }
  if (e.parameter.action === 'history') {
    if (!code) return jsonOut_({ ok: false, error: 'code requerido' });
    const hojaEv = getEventosSheet_();
    const lastEv = hojaEv.getLastRow();
    if (lastEv < 2) return jsonOut_({ ok: true, permitCode: code, eventos: [] });
    // Solo A:F — se omite la columna I (dataJson), que es la pesada y que este
    // listado no muestra. Para ver el contenido de un evento puntual se abre
    // la hoja "Eventos" directamente.
    const ev = hojaEv.getRange(2, 1, lastEv - 1, 6).getValues();
    const eventos = [];
    for (let i = 0; i < ev.length; i++) {
      if (ev[i][1] !== code) continue;
      eventos.push({
        ts: ev[i][0], accion: ev[i][2], resultado: ev[i][3],
        detalle: ev[i][4], opId: ev[i][5]
      });
    }
    return jsonOut_({ ok: true, permitCode: code, eventos: eventos });
  }

  const sheet = getSheet_();
  const last = sheet.getLastRow();

  if (e.parameter.list === '1') {
    if (last < 2) return jsonOut_({ ok: true, rows: [] });
    // Se leen DOS rangos que saltan deliberadamente la columna C (dataJson):
    // A:B (código, estado) y D:G (fechas, responsable, sitio). El listado no
    // necesita el contenido del permiso, y esa columna es la que pesa. Antes se
    // traía completa para todas las filas, en cada refresco del dashboard, por
    // cada uno de los 5 backends, cada 2 minutos.
    const n = last - 1;
    const colAB = sheet.getRange(2, 1, n, 2).getValues(); // permitCode, status
    const colDG = sheet.getRange(2, 4, n, 6).getValues(); // updatedAt, openedAt, responsable, sitio, hastaFecha, hastaHora
    const rows = [];
    for (let i = 0; i < n; i++) {
      if (!colAB[i][0]) continue;
      // Camino rápido: responsable y sitio salen de sus propias columnas.
      let responsable = colDG[i][2] || '', sitio = colDG[i][3] || '';
      if (!responsable && !sitio) {
        // Respaldo solo para filas antiguas guardadas antes de que existieran
        // estas columnas. Aquí sí se lee el JSON, pero de UNA celda puntual y
        // solo para esas filas viejas — no para toda la hoja.
        try {
          const parsed = JSON.parse(sheet.getRange(i + 2, 3).getValue());
          responsable = parsed.responsable || '';
          sitio = parsed.sitio || '';
        } catch (err) { /* fila sin JSON válido, se ignora */ }
      }
      // La vigencia puede faltar en filas anteriores a estas columnas: se saca
      // del JSON solo en ese caso y solo para permisos ABIERTOS, que son los
      // únicos donde importa saber si ya venció.
      let hastaFecha = colDG[i][4] || '', hastaHora = colDG[i][5] || '';
      if (!hastaFecha && colAB[i][1] === 'ABIERTO') {
        try {
          const parsed = JSON.parse(sheet.getRange(i + 2, 3).getValue());
          hastaFecha = parsed.hastaFecha || '';
          hastaHora = parsed.hastaHora || '';
        } catch (err) { /* fila sin JSON válido */ }
      }
      rows.push({
        permitCode: colAB[i][0],
        status: colAB[i][1],
        updatedAt: colDG[i][0],
        openedAt: colDG[i][1] || colDG[i][0], // filas antiguas sin columna E: se usa updatedAt
        responsable: responsable,
        sitio: sitio,
        hastaFecha: hastaFecha,
        hastaHora: hastaHora
      });
    }
    return jsonOut_({ ok: true, rows });
  }

  if (!code) {
    return jsonOut_({ ok: false, error: 'code requerido' });
  }
  // Se localiza por la columna A y se trae solo la celda del JSON de esa fila.
  const rowIndex = buscarFilaPorCodigo_(sheet, code);
  if (rowIndex === -1) return jsonOut_({ ok: false, error: 'Permiso no encontrado' });
  const raw = sheet.getRange(rowIndex, 3).getValue();
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    return ContentService.createTextOutput(raw).setMimeType(ContentService.MimeType.JSON);
  }
  return jsonOut_(inyectarFirmas_(parsed, cargarFirmasPorCodigo_(code)));
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   HERRAMIENTAS DE AUDITORÍA
   Estas funciones NO se exponen por la web: se ejecutan a mano
   desde el editor de Apps Script (menú Ejecutar). Nadie con el
   token puede invocarlas.
   ============================================================ */

/**
 * Reconstruye el estado de cada permiso a partir ÚNICAMENTE de la bitácora,
 * ignorando por completo la hoja "Permisos". Es la función que le da sentido a
 * todo esto: si la proyección se corrompiera, aquí está la verdad.
 * Devuelve un objeto { permitCode: {status, dataJson, openedAt, updatedAt} }.
 */
function reconstruirDesdeEventos_() {
  const ev = getEventosSheet_().getDataRange().getValues();
  const estados = {};
  for (let i = 1; i < ev.length; i++) {
    const ts = ev[i][0], code = ev[i][1], accion = ev[i][2], resultado = ev[i][3], dataJson = ev[i][8];
    if (!code || resultado !== 'APLICADO') continue; // los rechazados no cambian el estado
    if (!estados[code]) estados[code] = { status: 'ABIERTO', dataJson: '', openedAt: ts, updatedAt: ts };
    const est = estados[code];
    est.updatedAt = ts;
    if (accion === 'ADD_WORKERS') {
      // Solo agrega ejecutantes sobre lo que ya había.
      try {
        const actual = JSON.parse(est.dataJson || '{}');
        actual.ejecutantes = (actual.ejecutantes || []).concat(JSON.parse(dataJson || '[]'));
        est.dataJson = JSON.stringify(actual);
      } catch (err) { /* evento ilegible; se conserva el estado anterior */ }
    } else if (accion === 'ABRIR' || accion === 'ACTUALIZAR' || accion === 'CERRAR' || accion === 'MIGRACION') {
      if (dataJson) est.dataJson = dataJson;
      if (accion === 'CERRAR') est.status = 'CERRADO';
    }
  }
  return estados;
}

/**
 * Compara la hoja "Permisos" con lo que dice la bitácora y reporta diferencias.
 * Ejecútala de vez en cuando (o con un activador semanal). Si una fila de
 * "Permisos" fue alterada por fuera del portal, aparece aquí.
 */
function verificarIntegridad() {
  const estados = reconstruirDesdeEventos_();
  const data = getSheet_().getDataRange().getValues();
  const problemas = [];
  const vistos = {};
  for (let i = 1; i < data.length; i++) {
    const code = data[i][0];
    if (!code) continue;
    vistos[code] = true;
    const esperado = estados[code];
    if (!esperado) {
      problemas.push(code + ': existe en "Permisos" pero NO tiene eventos. Fila agregada por fuera del portal.');
      continue;
    }
    if (esperado.status !== data[i][1]) {
      problemas.push(code + ': estado "' + data[i][1] + '" en la hoja, pero la bitácora dice "' + esperado.status + '".');
    }
    if (esperado.dataJson && esperado.dataJson !== data[i][2]) {
      problemas.push(code + ': el contenido de la fila no coincide con el último evento registrado.');
    }
  }
  for (const code in estados) {
    if (!vistos[code]) problemas.push(code + ': tiene eventos pero desapareció de "Permisos". Fila borrada.');
  }

  const resumen = problemas.length
    ? 'Se encontraron ' + problemas.length + ' diferencia(s):\n\n' + problemas.join('\n')
    : 'Todo cuadra: la hoja "Permisos" coincide con la bitácora de eventos.';
  console.log(resumen);
  if (problemas.length && CORREOS_AVISO.length) {
    CORREOS_AVISO.forEach(correo => {
      MailApp.sendEmail(correo, '⚠ Revisión de integridad — Permisos de ' + PERMISO_NOMBRE, resumen);
    });
  }
  return resumen;
}

/**
 * Reescribe la hoja "Permisos" entera desde la bitácora. Úsala solo si
 * verificarIntegridad() reportó diferencias y decidiste que la bitácora tiene
 * la razón. Antes de reescribir, deja una copia de la hoja actual con la fecha,
 * para no perder nada por si acaso.
 */
function reconstruirPermisosDesdeEventos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_();
  const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  sheet.copyTo(ss).setName('Permisos-respaldo-' + sello);

  const estados = reconstruirDesdeEventos_();
  const filas = [];
  for (const code in estados) {
    const est = estados[code];
    let responsable = '', sitio = '';
    try {
      const parsed = JSON.parse(est.dataJson || '{}');
      responsable = parsed.responsable || '';
      sitio = parsed.sitio || '';
    } catch (err) { /* sin JSON legible */ }
    filas.push([code, est.status, est.dataJson, est.updatedAt, est.openedAt, responsable, sitio]);
  }
  sheet.clear();
  sheet.appendRow(filaSegura_(['permitCode', 'status', 'dataJson', 'updatedAt', 'openedAt', 'responsable', 'sitio']));
  if (filas.length) sheet.getRange(2, 1, filas.length, 7).setValues(filaSegura_(filas));
  SpreadsheetApp.flush();
  const msg = 'Reconstruidos ' + filas.length + ' permiso(s) desde la bitácora. La hoja anterior quedó como "Permisos-respaldo-' + sello + '".';
  console.log(msg);
  return msg;
}

/**
 * EJECUTAR UNA SOLA VEZ tras instalar esta versión.
 * Crea un evento por cada permiso que ya existía antes de que hubiera bitácora,
 * para que el histórico no arranque vacío. Si detecta que ya hay eventos, no
 * hace nada — es seguro ejecutarla dos veces por error.
 */
function migrarHistorialExistente() {
  const eventos = getEventosSheet_();
  if (eventos.getLastRow() > 1) {
    const msg = 'La bitácora ya tiene eventos; no se migra nada para no duplicar.';
    console.log(msg);
    return msg;
  }
  const data = getSheet_().getDataRange().getValues();
  const filas = [];
  for (let i = 1; i < data.length; i++) {
    const code = data[i][0];
    if (!code) continue;
    const openedAt = data[i][4] || data[i][3] || new Date();
    const updatedAt = data[i][3] || openedAt;
    // Evento de apertura, con la fecha real que ya tenías registrada.
    filas.push([openedAt, code, 'MIGRACION', 'APLICADO',
                'Permiso existente antes de la bitácora', '', data[i][5] || '', data[i][6] || '', data[i][2]]);
    // Si ya estaba cerrado, un segundo evento de cierre con la última fecha conocida.
    if (data[i][1] === 'CERRADO') {
      filas.push([updatedAt, code, 'CERRAR', 'APLICADO',
                  'Cierre existente antes de la bitácora', '', data[i][5] || '', data[i][6] || '', data[i][2]]);
    }
  }
  if (filas.length) {
    eventos.getRange(2, 1, filas.length, 9).setValues(filaSegura_(filas));
    SpreadsheetApp.flush();
  }
  const msg = 'Migrados ' + filas.length + ' evento(s) desde ' + (data.length - 1) + ' permiso(s) existentes.';
  console.log(msg);
  return msg;
}

// ===== Recordatorio automático de permisos abiertos =====
// Configura un trigger de tiempo (menú del reloj ⏰ en el editor de Apps Script →
// Activadores → Añadir activador → función "recordatorioPermisosAbiertos" →
// basado en tiempo → cada 1 hora).
const HORAS_ALERTA = 8;
const CORREOS_AVISO = correosPortal_();

function recordatorioPermisosAbiertos() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return;
  // Solo A:B y D:E. Este trigger corre cada hora en cada uno de los 5 backends;
  // leer la hoja completa con todos los dataJson 120 veces al día, para revisar
  // fechas, era gasto puro de cuota de ejecución.
  const colAB = sheet.getRange(2, 1, last - 1, 2).getValues();
  const colDE = sheet.getRange(2, 4, last - 1, 2).getValues();
  const ahora = new Date();
  const pendientes = [];
  for (let i = 0; i < colAB.length; i++) {
    if (colAB[i][1] !== 'ABIERTO') continue;
    const abierto = new Date(colDE[i][1] || colDE[i][0]);
    const horas = (ahora - abierto) / 36e5;
    if (horas >= HORAS_ALERTA) {
      pendientes.push(colAB[i][0] + ' — abierto hace ' + horas.toFixed(1) + ' h');
    }
  }
  if (pendientes.length === 0) return; // nada que avisar
  const cuerpo = 'Estos permisos de ' + PERMISO_NOMBRE + ' llevan abiertos '
    + HORAS_ALERTA + ' horas o más sin cerrarse:\n\n' + pendientes.join('\n');
  CORREOS_AVISO.forEach(correo => {
    MailApp.sendEmail(correo, 'Permisos de ' + PERMISO_NOMBRE + ' pendientes de cierre', cuerpo);
  });
}

/* ══════════════════════════════════════════════════════════════════
   AUDITORÍA DE INTEGRIDAD DE LO YA GUARDADO
   ------------------------------------------------------------------
   POR QUÉ EXISTE

   Este backend perdió datos EN SILENCIO más de una vez: firmas que
   superaban el máximo de una celda de Google Sheets, y guardados que se
   descartaban por confundirlos con un reintento. En los dos casos el
   servidor respondía "ok" y el usuario veía "guardado".

   Ya se corrigieron las causas y el portal ahora verifica cada guardado.
   Pero los permisos escritos ANTES de esos arreglos siguen como quedaron,
   y nadie sabe cuáles están incompletos.

   Esto los revisa uno por uno y dice exactamente cuáles tienen problemas.
   No modifica nada: solo lee, escribe un reporte en la hoja "Auditoria" y
   manda un correo con el resumen.

   CÓMO SE USA
     Abrir el editor de Apps Script → elegir la función auditarIntegridad
     en el desplegable → Ejecutar. Tarda según el tamaño de la hoja.
   ══════════════════════════════════════════════════════════════════ */

const AUDITORIA_SHEET_NAME = 'Auditoria';

function getAuditoriaSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AUDITORIA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AUDITORIA_SHEET_NAME);
    sheet.appendRow(filaSegura_(['revisadoEl', 'permitCode', 'status', 'abiertoEl', 'responsable',
                     'ejecutantes', 'firmasEjecutantes', 'firmasResponsables',
                     'firmasRotas', 'lecturasGases', 'problemas']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

/** Recorre un objeto buscando campos de firma y clasifica cada uno:
 *  presente (imagen real), rota (quedó la referencia pero la imagen no existe)
 *  o vacía. Una firma ROTA es la huella exacta del fallo de las 50.000 celdas:
 *  el permiso guardó la referencia y la imagen nunca llegó a escribirse. */
function clasificarFirmas_(obj, mapaFirmas, acc) {
  acc = acc || { presentes: 0, rotas: 0, vacias: 0 };
  if (Array.isArray(obj)) {
    obj.forEach(x => clasificarFirmas_(x, mapaFirmas, acc));
    return acc;
  }
  if (obj && typeof obj === 'object') {
    for (const k in obj) {
      const v = obj[k];
      if (k.toLowerCase().indexOf('sig') !== -1 && typeof v === 'string') {
        if (v.indexOf('SIGREF:') === 0) {
          const img = mapaFirmas[v.substring(7)];
          if (img && String(img).length > 100) acc.presentes++;
          else acc.rotas++;
        } else if (v.indexOf('data:image') === 0) {
          acc.presentes++;
        } else if (!v) {
          acc.vacias++;
        }
      } else {
        clasificarFirmas_(v, mapaFirmas, acc);
      }
    }
  }
  return acc;
}

function auditarIntegridad() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { console.log('No hay permisos registrados en esta hoja.'); return 'No hay permisos registrados.'; }

  const datos = sheet.getRange(2, 1, last - 1, 7).getValues();
  const ahora = new Date();
  const filasReporte = [];
  const conProblemas = [];
  let total = 0, sanos = 0;

  datos.forEach(f => {
    const code = f[0];
    if (!code) return;
    total++;
    let d = {};
    try { d = JSON.parse(f[2] || '{}'); } catch (e) { d = null; }

    const problemas = [];
    if (d === null) {
      problemas.push('JSON ilegible');
      filasReporte.push([ahora, code, f[1], f[4], f[5], '', '', '', '', '', problemas.join(' · ')]);
      conProblemas.push({ code: code, status: f[1], fecha: f[4], problemas: problemas });
      return;
    }

    const mapa = cargarFirmasPorCodigo_(code);

    const ejec = Array.isArray(d.ejecutantes) ? d.ejecutantes : [];
    const resp = Array.isArray(d.responsablesSigs) ? d.responsablesSigs : [];
    const fEjec = clasificarFirmas_(ejec, mapa);
    const fResp = clasificarFirmas_(resp, mapa);
    const rotas = fEjec.rotas + fResp.rotas;
    const lecturas = (d.gases && Array.isArray(d.gases.lecturas)) ? d.gases.lecturas.length : '';

    // Un ejecutante con nombre pero sin firma es un permiso incompleto:
    // la firma es lo que acredita que esa persona fue informada del riesgo.
    const ejecConNombre = ejec.filter(e => e && String(e.nombre || '').trim()).length;

    if (rotas > 0) problemas.push(rotas + ' firma(s) con la imagen perdida');
    if (ejecConNombre > 0 && fEjec.presentes === 0) problemas.push('ningún ejecutante tiene firma');
    else if (fEjec.presentes < ejecConNombre) problemas.push((ejecConNombre - fEjec.presentes) + ' ejecutante(s) sin firma');
    if (resp.length > 0 && fResp.presentes === 0) problemas.push('ningún responsable tiene firma');
    if (d.gases && lecturas === 0) problemas.push('espacio confinado sin ninguna lectura de gases');
    if (f[1] === 'CERRADO' && !d.cierreFecha && !d.closeFields) {
      // solo informativo: algunos formatos guardan el cierre con otras claves
    }

    filasReporte.push([ahora, code, f[1], f[4], f[5], ejecConNombre,
                       fEjec.presentes, fResp.presentes, rotas, lecturas,
                       problemas.length ? problemas.join(' · ') : 'OK']);
    if (problemas.length) conProblemas.push({ code: code, status: f[1], fecha: f[4], problemas: problemas });
    else sanos++;
  });

  if (filasReporte.length) {
    const hoja = getAuditoriaSheet_();
    hoja.getRange(hoja.getLastRow() + 1, 1, filasReporte.length, 11).setValues(filaSegura_(filasReporte));
  }

  let cuerpo = 'AUDITORÍA DE INTEGRIDAD — ' + PERMISO_NOMBRE + '\n';
  cuerpo += Utilities.formatDate(ahora, 'America/Bogota', 'dd/MM/yyyy HH:mm') + '\n';
  cuerpo += '------------------------------------------------------------\n\n';
  cuerpo += 'Permisos revisados : ' + total + '\n';
  cuerpo += 'Sin problemas      : ' + sanos + '\n';
  cuerpo += 'Con problemas      : ' + conProblemas.length + '\n\n';

  if (conProblemas.length) {
    cuerpo += 'DETALLE (del más reciente al más antiguo):\n\n';
    conProblemas.slice().reverse().forEach(p => {
      cuerpo += '  ' + p.code + '  [' + p.status + ']  ' + (p.fecha || '') + '\n';
      p.problemas.forEach(x => { cuerpo += '      - ' + x + '\n'; });
    });
    cuerpo += '\nQué significa cada cosa:\n';
    cuerpo += '  · "firma con la imagen perdida": el permiso guardó la referencia\n';
    cuerpo += '    pero la imagen nunca se escribió. Es el rastro del fallo de las\n';
    cuerpo += '    firmas que superaban el máximo de una celda. No se puede recuperar.\n';
    cuerpo += '  · "sin firma": esa persona quedó registrada sin firmar.\n';
    cuerpo += '  · "sin lectura de gases": el permiso se abrió sin registrar ninguna.\n\n';
    cuerpo += 'Estos permisos están incompletos como documento. Los que sigan\n';
    cuerpo += 'abiertos se pueden completar; los cerrados quedan como están y\n';
    cuerpo += 'conviene saberlo antes de que los pida alguien.\n';
  } else {
    cuerpo += 'No se encontraron permisos incompletos.\n';
  }
  cuerpo += '\nEl detalle completo, permiso por permiso, quedó en la hoja "Auditoria".\n';

  const correo = (typeof CORREOS_AUDITORIA !== 'undefined' && CORREOS_AUDITORIA)
    ? CORREOS_AUDITORIA
    : Session.getEffectiveUser().getEmail();
  try {
    MailApp.sendEmail(correo, 'Auditoría de permisos — ' + PERMISO_NOMBRE + ' — ' +
                      conProblemas.length + ' con problemas de ' + total, cuerpo);
  } catch (e) { /* si falla el correo, el reporte igual quedó en la hoja */ }

  // console.log además del return: el registro de ejecución de Apps Script
  // solo muestra lo que se escribe explícitamente, así que devolver el
  // resultado no sirve de nada para quien la ejecuta a mano.
  const resumen = total + ' permisos revisados · ' + conProblemas.length + ' con problemas.';
  console.log(resumen);
  console.log('Detalle completo en la hoja "Auditoria" y en el correo enviado a ' + correo);
  if (conProblemas.length) {
    console.log('--- permisos con problemas ---');
    conProblemas.slice().reverse().forEach(p => {
      console.log('  ' + p.code + ' [' + p.status + '] ' + (p.fecha || '') + ' → ' + p.problemas.join(' · '));
    });
  }
  return resumen;
}

/* ══════════════════════════════════════════════════════════════════
   VIGILANCIA DE INTENTOS SOSPECHOSOS
   ------------------------------------------------------------------
   El token viaja dentro de config.js, que es público: cualquiera que abra
   el código del sitio lo ve. No se puede evitar con un sitio estático y
   Apps Script — restringir el despliegue al dominio de Google rompería el
   portal, porque las peticiones salen sin sesión iniciada.

   Lo que sí se puede es NOTARLO. Un intento con token equivocado no es un
   error de un trabajador: el portal siempre manda el token correcto. Es
   alguien probando desde fuera.

   Instalar una vez con instalarVigilancia(). Revisa cada día y solo
   escribe correo si hay algo — una alarma que suena sin motivo deja de
   leerse.
   ══════════════════════════════════════════════════════════════════ */

// OJO: sin guion bajo al final. En Apps Script, una función que termina en "_"
// es privada y NO aparece en el desplegable del editor, así que no se podría
// ejecutar a mano — que es justo para lo que sirve esta.
function instalarVigilancia() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'revisarIntentosSospechosos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarIntentosSospechosos').timeBased().everyDays(1).atHour(7).create();
  const msg = 'Vigilancia instalada: revisa cada día a las 7 a.m.';
  console.log(msg);
  return msg;
}

function revisarIntentosSospechosos() {
  const sheet = getEventosSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return 'Bitácora vacía.';

  const desde = new Date(Date.now() - 24 * 3600 * 1000);
  const datos = sheet.getRange(2, 1, last - 1, 6).getValues(); // A ts … F opId
  const sospechosos = [];

  datos.forEach(f => {
    const ts = f[0] instanceof Date ? f[0] : new Date(f[0]);
    if (isNaN(ts.getTime()) || ts < desde) return;
    const resultado = String(f[3] || '');
    const detalle = String(f[4] || '');
    // Token inválido es la señal clara: el portal nunca manda uno malo.
    if (resultado === 'RECHAZADO' && detalle.indexOf('Token') !== -1) {
      sospechosos.push({ ts: ts, code: f[1], detalle: detalle });
    }
  });

  if (!sospechosos.length) { console.log('Sin intentos sospechosos en las últimas 24 horas.'); return 'Sin intentos sospechosos en las últimas 24 horas.'; }

  let cuerpo = 'INTENTOS DE ACCESO CON TOKEN INVÁLIDO\n';
  cuerpo += PERMISO_NOMBRE + '\n';
  cuerpo += '------------------------------------------------------------\n\n';
  cuerpo += 'Se registraron ' + sospechosos.length + ' intento(s) en las últimas 24 horas.\n\n';
  sospechosos.slice(0, 40).forEach(s => {
    cuerpo += '  ' + Utilities.formatDate(s.ts, 'America/Bogota', 'dd/MM/yyyy HH:mm') +
              '  ' + (s.code || '(sin código)') + '  — ' + s.detalle + '\n';
  });
  cuerpo += '\nEl portal siempre envía el token correcto, así que esto NO lo causa\n';
  cuerpo += 'un trabajador usando la aplicación: es alguien probando desde fuera.\n\n';
  cuerpo += 'Qué hacer:\n';
  cuerpo += '  · Si son pocos y aislados, puede ser un dispositivo con una versión\n';
  cuerpo += '    vieja del portal en caché tras un cambio de token.\n';
  cuerpo += '  · Si son muchos o insisten, conviene rotar el token siguiendo el\n';
  cuerpo += '    procedimiento de tres fases del README.\n';
  cuerpo += '\nNinguno de estos intentos modificó datos: quedaron rechazados y\n';
  cuerpo += 'registrados en la hoja "Eventos".\n';

  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      '⚠ ' + sospechosos.length + ' intento(s) con token inválido — ' + PERMISO_NOMBRE, cuerpo);
  } catch (e) {}
  const m = sospechosos.length + ' intento(s) sospechoso(s). Se envió aviso por correo.';
  console.log(m);
  return m;
}

/* ══════════════════════════════════════════════════════════════════
   INVESTIGAR UN PERMISO — ¿en qué momento se perdieron las firmas?
   ------------------------------------------------------------------
   La hoja "Permisos" solo guarda el estado ACTUAL. La bitácora, en
   cambio, guardó el contenido de CADA escritura. Así que si un permiso
   hoy aparece sin firmas, aquí se puede ver si alguna vez las tuvo y en
   qué operación desaparecieron.

   Esto distingue dos cosas que se ven iguales en la auditoría pero son
   muy distintas:
     · nunca se firmó  → falla de uso o del formulario al abrir
     · se firmó y el CIERRE lo borró → falla grave: una operación
       posterior pisó datos buenos con vacíos

   CÓMO SE USA
     Cambiar el código en CODIGO_A_INVESTIGAR, elegir investigarPermiso
     en el desplegable y Ejecutar. El resultado sale en el registro.
   ══════════════════════════════════════════════════════════════════ */

const CODIGO_A_INVESTIGAR = 'PTC-20260904-525281';   // ← cambiar por el que se quiera revisar

function investigarPermiso() {
  const code = CODIGO_A_INVESTIGAR;
  const sheet = getEventosSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { console.log('Bitácora vacía.'); return; }

  const datos = sheet.getRange(2, 1, last - 1, 9).getValues();
  const eventos = datos.filter(f => String(f[1]) === code);
  if (!eventos.length) { console.log('No hay eventos para ' + code); return; }

  console.log('HISTORIA DE ' + code + ' — ' + eventos.length + ' evento(s)');
  console.log('='.repeat(64));

  eventos.forEach(f => {
    const ts = f[0] instanceof Date ? Utilities.formatDate(f[0], 'America/Bogota', 'dd/MM/yyyy HH:mm:ss') : String(f[0]);
    const accion = f[2], resultado = f[3], detalle = f[4];
    let resumen = '';
    if (f[8]) {
      let d = null;
      try { d = JSON.parse(f[8]); } catch (e) {}
      if (d) {
        const cuenta = (lista) => {
          if (!Array.isArray(lista)) return null;
          const con = lista.filter(x => x && typeof x.sig === 'string' && x.sig.length > 10).length;
          return con + '/' + lista.length;
        };
        if (Array.isArray(d)) {
          // ADD_WORKERS guarda SOLO las filas nuevas, no el permiso entero. Sin
          // esta rama el contador no encontraba d.ejecutantes y mostraba "0/0",
          // que parecía una pérdida de firmas cuando no lo era.
          resumen = 'solo las filas agregadas en esta operación — con firma: ' + cuenta(d);
        } else {
          const e = cuenta(d.ejecutantes), r = cuenta(d.responsablesSigs);
          if (e === null && r === null) {
            resumen = '(esta operación no guarda el permiso completo)';
          } else {
            resumen = 'ejecutantes con firma: ' + (e || 'n/d') +
                      ' · responsables con firma: ' + (r || 'n/d');
          }
        }
      }
    }
    console.log(ts + '  ' + accion + ' / ' + resultado);
    if (detalle) console.log('      ' + detalle);
    if (resumen) console.log('      ' + resumen);
  });

  console.log('='.repeat(64));
  console.log('Cómo leerlo:');
  console.log('  · Compara ABRIR con CERRAR: si ABRIR muestra firmas y CERRAR');
  console.log('    muestra 0, esa operación las borró.');
  console.log('  · ADD_WORKERS solo registra las filas que se agregaron, no el');
  console.log('    permiso completo: ahí no hay nada que comparar.');
  console.log('  · Si las firmas no aparecen desde el ABRIR, nunca se guardaron.');
}

/** v145: una «imagen» que no es una imagen de verdad (p. ej. con comillas o código escondido) se descarta
 *  antes de guardarla: así nunca llega a pintarse en una página (XSS almacenado). */
function sinImagenesFalsas_(o, prof) {
  prof = prof || 0; if (!o || typeof o !== 'object' || prof > 14) return o;
  Object.keys(o).forEach(function (k) {
    const v = o[k];
    if (typeof v === 'string' && v.slice(0, 5) === 'data:' && !/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) && !/^data:application\/pdf;base64,[A-Za-z0-9+\/=]+$/.test(v)) o[k] = '';
    else if (v && typeof v === 'object') sinImagenesFalsas_(v, prof + 1);
  });
  return o;
}

/** v145: ninguna celda que escriba este servidor puede volverse fórmula (=, +, -, @ al inicio). */
function filaSegura_(v) {
  if (Array.isArray(v)) return v.map(filaSegura_);
  return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v;
}


    return {
      doGet: doGet,
      doPost: doPost,
      libro: __entorno.libro,
      funciones: { verificarIntegridad: verificarIntegridad, reconstruirPermisosDesdeEventos: reconstruirPermisosDesdeEventos, migrarHistorialExistente: migrarHistorialExistente, recordatorioPermisosAbiertos: recordatorioPermisosAbiertos, auditarIntegridad: auditarIntegridad, instalarVigilancia: instalarVigilancia, revisarIntentosSospechosos: revisarIntentosSospechosos, investigarPermiso: investigarPermiso }
    };
  })();
}
var __permisos = {};

function modulo_caliente_() { return __permisos.caliente || (__permisos.caliente = fabricaPermiso_('caliente', 'Permisos de trabajo en caliente', 'Trabajo en Caliente', 'SSTA-F-119')); }
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['caliente'] = modulo_caliente_;

function modulo_alturas_() { return __permisos.alturas || (__permisos.alturas = fabricaPermiso_('alturas', 'Permisos de trabajo en alturas', 'Trabajo en Alturas', 'SSTA-F-116')); }
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['alturas'] = modulo_alturas_;

function modulo_confinados_() { return __permisos.confinados || (__permisos.confinados = fabricaPermiso_('confinados', 'Permisos de espacios confinados', 'Espacios Confinados', 'SSTA-F-117')); }
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['confinados'] = modulo_confinados_;

function modulo_izajes_() { return __permisos.izajes || (__permisos.izajes = fabricaPermiso_('izajes', 'Permisos de izajes de cargas', 'Izajes de Cargas', 'SSTA-F-118')); }
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['izajes'] = modulo_izajes_;

function modulo_electrico_() { return __permisos.electrico || (__permisos.electrico = fabricaPermiso_('electrico', 'Permisos de trabajo eléctrico', 'Trabajo Eléctrico', 'SSTA-F-180')); }
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['electrico'] = modulo_electrico_;

/* Funciones de mantenimiento de "caliente" (menú ▶ Ejecutar del editor). */
function caliente__verificarIntegridad() { return modulo_caliente_().funciones.verificarIntegridad.apply(null, arguments); }
function caliente__reconstruirPermisosDesdeEventos() { return modulo_caliente_().funciones.reconstruirPermisosDesdeEventos.apply(null, arguments); }
function caliente__migrarHistorialExistente() { return modulo_caliente_().funciones.migrarHistorialExistente.apply(null, arguments); }
function caliente__recordatorioPermisosAbiertos() { return modulo_caliente_().funciones.recordatorioPermisosAbiertos.apply(null, arguments); }
function caliente__auditarIntegridad() { return modulo_caliente_().funciones.auditarIntegridad.apply(null, arguments); }
function caliente__instalarVigilancia() { return modulo_caliente_().funciones.instalarVigilancia.apply(null, arguments); }
function caliente__revisarIntentosSospechosos() { return modulo_caliente_().funciones.revisarIntentosSospechosos.apply(null, arguments); }
function caliente__investigarPermiso() { return modulo_caliente_().funciones.investigarPermiso.apply(null, arguments); }

/* Funciones de mantenimiento de "alturas" (menú ▶ Ejecutar del editor). */
function alturas__verificarIntegridad() { return modulo_alturas_().funciones.verificarIntegridad.apply(null, arguments); }
function alturas__reconstruirPermisosDesdeEventos() { return modulo_alturas_().funciones.reconstruirPermisosDesdeEventos.apply(null, arguments); }
function alturas__migrarHistorialExistente() { return modulo_alturas_().funciones.migrarHistorialExistente.apply(null, arguments); }
function alturas__recordatorioPermisosAbiertos() { return modulo_alturas_().funciones.recordatorioPermisosAbiertos.apply(null, arguments); }
function alturas__auditarIntegridad() { return modulo_alturas_().funciones.auditarIntegridad.apply(null, arguments); }
function alturas__instalarVigilancia() { return modulo_alturas_().funciones.instalarVigilancia.apply(null, arguments); }
function alturas__revisarIntentosSospechosos() { return modulo_alturas_().funciones.revisarIntentosSospechosos.apply(null, arguments); }
function alturas__investigarPermiso() { return modulo_alturas_().funciones.investigarPermiso.apply(null, arguments); }

/* Funciones de mantenimiento de "confinados" (menú ▶ Ejecutar del editor). */
function confinados__verificarIntegridad() { return modulo_confinados_().funciones.verificarIntegridad.apply(null, arguments); }
function confinados__reconstruirPermisosDesdeEventos() { return modulo_confinados_().funciones.reconstruirPermisosDesdeEventos.apply(null, arguments); }
function confinados__migrarHistorialExistente() { return modulo_confinados_().funciones.migrarHistorialExistente.apply(null, arguments); }
function confinados__recordatorioPermisosAbiertos() { return modulo_confinados_().funciones.recordatorioPermisosAbiertos.apply(null, arguments); }
function confinados__auditarIntegridad() { return modulo_confinados_().funciones.auditarIntegridad.apply(null, arguments); }
function confinados__instalarVigilancia() { return modulo_confinados_().funciones.instalarVigilancia.apply(null, arguments); }
function confinados__revisarIntentosSospechosos() { return modulo_confinados_().funciones.revisarIntentosSospechosos.apply(null, arguments); }
function confinados__investigarPermiso() { return modulo_confinados_().funciones.investigarPermiso.apply(null, arguments); }

/* Funciones de mantenimiento de "izajes" (menú ▶ Ejecutar del editor). */
function izajes__verificarIntegridad() { return modulo_izajes_().funciones.verificarIntegridad.apply(null, arguments); }
function izajes__reconstruirPermisosDesdeEventos() { return modulo_izajes_().funciones.reconstruirPermisosDesdeEventos.apply(null, arguments); }
function izajes__migrarHistorialExistente() { return modulo_izajes_().funciones.migrarHistorialExistente.apply(null, arguments); }
function izajes__recordatorioPermisosAbiertos() { return modulo_izajes_().funciones.recordatorioPermisosAbiertos.apply(null, arguments); }
function izajes__auditarIntegridad() { return modulo_izajes_().funciones.auditarIntegridad.apply(null, arguments); }
function izajes__instalarVigilancia() { return modulo_izajes_().funciones.instalarVigilancia.apply(null, arguments); }
function izajes__revisarIntentosSospechosos() { return modulo_izajes_().funciones.revisarIntentosSospechosos.apply(null, arguments); }
function izajes__investigarPermiso() { return modulo_izajes_().funciones.investigarPermiso.apply(null, arguments); }

/* Funciones de mantenimiento de "electrico" (menú ▶ Ejecutar del editor). */
function electrico__verificarIntegridad() { return modulo_electrico_().funciones.verificarIntegridad.apply(null, arguments); }
function electrico__reconstruirPermisosDesdeEventos() { return modulo_electrico_().funciones.reconstruirPermisosDesdeEventos.apply(null, arguments); }
function electrico__migrarHistorialExistente() { return modulo_electrico_().funciones.migrarHistorialExistente.apply(null, arguments); }
function electrico__recordatorioPermisosAbiertos() { return modulo_electrico_().funciones.recordatorioPermisosAbiertos.apply(null, arguments); }
function electrico__auditarIntegridad() { return modulo_electrico_().funciones.auditarIntegridad.apply(null, arguments); }
function electrico__instalarVigilancia() { return modulo_electrico_().funciones.instalarVigilancia.apply(null, arguments); }
function electrico__revisarIntentosSospechosos() { return modulo_electrico_().funciones.revisarIntentosSospechosos.apply(null, arguments); }
function electrico__investigarPermiso() { return modulo_electrico_().funciones.investigarPermiso.apply(null, arguments); }
