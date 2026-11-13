// ===== Backend de Google Sheets para el Anexo SSTA-F-149 (Personal Autorizado) =====
// Pega este código en Extensiones > Apps Script de un Google Sheet nuevo.
// Sigue el mismo patrón de seguridad que los backends de permisos: valida
// token, usa LockService, y es idempotente ante reintentos del Outbox.
//
// Estructura: cuatro hojas —
//  "Obras": una fila por obra/proyecto (se crea una vez al iniciar la obra).
//  "Registros": una fila por cada día registrado de cada obra (obraId+fecha
//               es la clave — si ya existe esa combinación, se actualiza en
//               vez de duplicar).
//  "Personal": base de datos de trabajadores (cédula, nombre, cargo) —
//              se llena una sola vez por persona y se reutiliza con
//              autocompletar al registrar personal cada día.
//  "Eventos":  NUEVO — bitácora inmutable. Ver abajo.
//
// ===== NUEVO EN ESTA VERSIÓN: REGISTRO INMUTABLE =====
//
// El problema que resuelve: el token vive en config.js, que el navegador tiene
// que descargar para funcionar. No es un secreto: cualquiera que abra el portal
// puede leerlo y mandar peticiones directas a esta URL. Y este backend tenía
// tres operaciones destructivas sin ninguna red de seguridad:
//   · eliminarPersona hacía deleteRow — la fila desaparecía sin dejar rastro.
//   · guardarRegistro sobrescribía el registro del día. Si un reintento del
//     Outbox llegaba tarde con datos viejos, se perdía lo más nuevo.
//   · vincularPermisos reemplazaba la lista completa de permisos de la obra.
// El registro diario de personal en obra es un documento con valor probatorio:
// dice quién estuvo, qué día, bajo qué permiso y quién lo verificó. Que se
// pueda borrar o alterar sin rastro es el riesgo de fondo.
//
// Cómo funciona ahora:
//   · La hoja "Eventos" recibe UNA FILA POR CADA INTENTO DE ESCRITURA, con
//     marca de tiempo. Solo se agregan filas: este código nunca hace setValues,
//     update ni delete sobre ella.
//   · Antes de borrar una persona se guarda en la bitácora el contenido de la
//     fila que se va a eliminar, así que un borrado siempre es recuperable.
//   · Cada versión de un registro diario queda guardada, no solo la última.
//   · verificarIntegridad() compara las hojas contra la bitácora y avisa por
//     correo si algo no cuadra.
//   · reconstruirDesdeEventos() reescribe Obras y Registros desde la bitácora.
//
// Qué NO cambia: las respuestas de doGet son idénticas, así que
// personal-autorizado.html no necesita ningún ajuste.
//
// ---------------------------------------------------------------------------
// DESPUÉS DE PEGAR ESTE CÓDIGO, HAZ ESTO UNA SOLA VEZ:
//   1. Ejecuta  migrarHistorialExistente()  desde el editor (menú Ejecutar).
//   2. Ejecuta  verificarIntegridad()  — debería decir que todo cuadra.
//   3. Despliega como "Nueva versión" (NO "Nueva implementación"), para que la
//      URL de config.js siga siendo la misma.
//   4. Recomendado: clic derecho en la pestaña "Eventos" → Proteger hoja, y
//      quítale permiso de edición a todos menos a ti. El script sigue
//      escribiendo; las personas no.
// ---------------------------------------------------------------------------

const SHEET_OBRAS = 'Obras';
const SHEET_REGISTROS = 'Registros';
const SHEET_PERSONAL = 'Personal';
const SHEET_EVENTOS = 'Eventos';
const API_TOKEN = 'PON-AQUI-EL-TOKEN'; // debe ser IDÉNTICO al del cliente (config.js)

// Correos que reciben la alerta de verificarIntegridad(). Deja el arreglo vacío
// para no enviar nada y revisar solo por el log de ejecución.
const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];

function getPersonalSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PERSONAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PERSONAL);
    sheet.appendRow(filaSegura_(['cedula', 'nombre', 'cargo', 'updatedAt']));
  }
  return sheet;
}
function getObrasSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_OBRAS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_OBRAS);
    sheet.appendRow(filaSegura_(['obraId', 'nombre', 'area', 'fechaInicio', 'fechaFin', 'permisosJson', 'createdAt']));
  }
  return sheet;
}
function getRegistrosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_REGISTROS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTROS);
    // Columnas E/F (cantidad, verificador): resumen para que el historial no
    // tenga que abrir el dataJson de cada día. Mismo truco que las columnas
    // responsable/sitio de los backends de permisos.
    sheet.appendRow(filaSegura_(['obraId', 'fecha', 'dataJson', 'updatedAt', 'cantidad', 'verificador']));
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
   LECTURA EFICIENTE DE LAS HOJAS
   ------------------------------------------------------------
   Antes todo usaba getDataRange().getValues(), que trae TODAS las
   filas con TODAS las columnas — incluidos los dataJson completos
   de cada registro diario. Se hacía en cada guardado y en cada
   consulta, y crecía sin techo con el histórico. Ahora se lee
   únicamente lo que hace falta.
   ============================================================ */

/** Busca una fila por el valor de una columna, leyendo SOLO esa columna. */
function buscarFila_(sheet, col, valor) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const vals = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]) === String(valor)) return i + 2;
  }
  return -1;
}

/** Fecha como texto "AAAA-MM-DD".
 *  Google Sheets convierte el texto "2026-09-30" en una FECHA al escribir la
 *  fila, y al leerla devuelve un objeto Date, no el texto. Antes se comparaba
 *  ese Date con el texto que manda el portal y NUNCA coincidía: no se
 *  encontraba el registro del día (cada guardado agregaba otra fila en vez de
 *  actualizar, el historial mostraba "2026-09-30T05:00:00.000Z" y no se podía
 *  abrir un día guardado). Se usa la zona horaria de la hoja, que es la misma
 *  con la que Sheets convirtió el texto. */
function fechaISO_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    let tz = 'America/Bogota';
    try { tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || tz; } catch (e) {}
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  const t = String(v == null ? '' : v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  return m ? m[1] : t;
}

/** Busca la fila de un registro diario por obraId + fecha, leyendo solo A:B. */
function buscarFilaRegistro_(sheet, obraId, fecha) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const vals = sheet.getRange(2, 1, last - 1, 2).getValues();
  const buscada = fechaISO_(fecha);
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0] === obraId && fechaISO_(vals[i][1]) === buscada) return i + 2;
  }
  return -1;
}

/* ============================================================
   BITÁCORA INMUTABLE (hoja "Eventos")
   ------------------------------------------------------------
   Regla única y no negociable: aquí SOLO se agregan filas.
   Ninguna función de este archivo modifica ni borra una fila ya
   escrita. Si algún día hay que "corregir" un evento, la forma
   correcta es agregar otro que lo corrija.
   ============================================================ */

function getEventosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_EVENTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EVENTOS);
    sheet.appendRow(filaSegura_(['ts', 'entidad', 'clave', 'accion', 'resultado', 'detalle', 'opId', 'dataJson']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Agrega un evento. Se llama SIEMPRE, tanto si la operación se aplicó como si
 * se rechazó — un intento rechazado es justo lo que uno querría poder mostrar
 * después si hay que investigar algo.
 *
 * entidad:   'PERSONA' | 'OBRA' | 'REGISTRO'
 * clave:     cédula | obraId | 'obraId|fecha'
 * accion:    'GUARDAR_PERSONA' | 'ELIMINAR_PERSONA' | 'CREAR_OBRA' |
 *            'VINCULAR_PERMISOS' | 'GUARDAR_REGISTRO' | 'MIGRACION'
 * resultado: 'APLICADO' | 'RECHAZADO' | 'DUPLICADO'
 * dataJson:  contenido involucrado, ya sin firmas (llevan SIGREF) y sin token
 */
function registrarEvento_(entidad, clave, accion, resultado, detalle, opId, dataJson) {
  try {
    getEventosSheet_().appendRow(filaSegura_([
      new Date(), entidad || '', clave || '', accion || '',
      resultado || '', detalle || '', opId || '', dataJson || ''
    ]));
  } catch (err) {
    // Si la bitácora falla no se tumba la operación de quien está en obra, pero
    // queda en el log de ejecución de Apps Script para poder revisarlo.
    console.error('No se pudo registrar el evento: ' + err);
  }
}

// ===== Firmas guardadas aparte (evita superar el límite de 50.000 =====
// ===== caracteres por celda de Google Sheets cuando hay muchas firmas) =====
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
    sheet.appendRow(filaSegura_(['registroKey', 'sigKey', 'dataUrl', 'updatedAt']));
    SpreadsheetApp.flush();
  }
  return sheet;
}
function sigKeyFromDataUrl_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('').substring(0, 12);
}
/* Saca TODA imagen (data:image…) del registro y la cambia por "SIGREF:xxxx".
   ANTES solo reconocía campos cuyo nombre tuviera "sig" (como en los
   permisos: sigEmisor…), pero el anexo llama a sus firmas `firma`
   (trabajadores[].firma, verificador.firma): las imágenes se quedaban DENTRO
   del JSON. Con dos o tres firmas de celular el JSON pasaba de 50.000
   caracteres, Google Sheets rechazaba la celda, el script fallaba y el
   celular solo veía "Load failed": el registro quedaba en cola para siempre.
   Ahora se reconoce por el contenido, se llame como se llame el campo. */
function extraerFirmas_(obj, mapaFirmas) {
  if (Array.isArray(obj)) return obj.map(item => extraerFirmas_(item, mapaFirmas));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'string' && val.indexOf('data:image') === 0) {
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
// registro queda con los nombres pero sin imágenes). Se deja margen bajo el tope
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

function guardarFirmas_(registroKey, mapaFirmas) {
  if (!mapaFirmas.length) return;
  const sheet = getFirmasSheet_();
  const last = sheet.getLastRow();
  // Qué firmas de ESTE registro ya están guardadas. Antes se recorría la hoja
  // completa (todas las firmas de todas las obras) solo para averiguarlo.
  // Se compara por clave BASE, para que una firma ya guardada en trozos no se
  // vuelva a escribir al reenviarse la misma operación.
  const existentes = {};
  const filasDelRegistro = filasPorValor_(sheet, 1, registroKey);
  if (filasDelRegistro.length) {
    const minR = Math.min.apply(null, filasDelRegistro);
    const maxR = Math.max.apply(null, filasDelRegistro);
    const claves = sheet.getRange(minR, 2, maxR - minR + 1, 1).getValues();
    filasDelRegistro.forEach(r => {
      existentes[registroKey + '|' + claveBaseFirma_(claves[r - minR][0])] = true;
    });
  }
  const ahora = new Date();
  const filas = [];
  mapaFirmas.forEach(f => {
    if (existentes[registroKey + '|' + f.sigKey]) return; // ya guardada antes
    trocearFirma_(f.sigKey, f.dataUrl).forEach(t => {
      filas.push([registroKey, t.key, "'" + t.texto, ahora]);
    });
  });
  if (filas.length) sheet.getRange(last + 1, 1, filas.length, 4).setValues(filaSegura_(filas));
}
function inyectarFirmas_(obj, mapaPorKey) {
  if (Array.isArray(obj)) return obj.map(item => inyectarFirmas_(item, mapaPorKey));
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
function cargarFirmasPorRegistro_(registroKey) {
  const sheet = getFirmasSheet_();
  const mapa = {};
  // Paso 1: pedir directamente las filas de este registro, en vez de recorrer
  // toda la hoja para irlas filtrando.
  const rows = filasPorValor_(sheet, 1, registroKey);
  if (!rows.length) return mapa;
  rows.sort((a, b) => a - b);
  const minK = rows[0], maxK = rows[rows.length - 1];
  const clavesRango = sheet.getRange(minK, 2, maxK - minK + 1, 1).getValues();
  const filas = rows.map(r => ({ row: r, key: clavesRango[r - minK][0] }));
  // Paso 2: traer los base64 en un solo rango que cubra esas filas. Las firmas
  // de un mismo día se escriben juntas, así que el rango es pequeño; en el peor
  // caso abarca la hoja entera, que es lo que se hacía antes siempre.
  const minRow = filas[0].row, maxRow = filas[filas.length - 1].row;
  const urls = sheet.getRange(minRow, 3, maxRow - minRow + 1, 1).getValues();
  // Reensambla las firmas guardadas en varios trozos (claves tipo "abc123~2/5")
  // y deja tal cual las que caben en una sola celda.
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

function jsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function genObraId_() {
  const d = new Date();
  return 'OBRA-' + d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0')
    + '-' + String(Math.floor(Math.random()*9000)+1000);
}

/** ¿Este opId ya se aplicó antes? Evita duplicar una operación reenviada por el
 *  Outbox. Se consulta contra la bitácora, que es justamente el sitio donde
 *  quedó constancia de la primera vez. */
function opIdYaAplicado_(opId) {
  if (!opId) return false;
  const sheet = getEventosSheet_();
  // Se piden solo las filas con este opId (columna G), en vez de recorrer la
  // bitácora entera — que es la hoja que más rápido crece de todas.
  const rows = filasPorValor_(sheet, 7, opId);
  for (let i = 0; i < rows.length; i++) {
    if (sheet.getRange(rows[i], 5).getValue() === 'APLICADO') return true; // col E = resultado
  }
  return false;
}

/* ================= MEZCLA DEL REGISTRO DIARIO ================= */
function clavePersona_(p) {
  const c = String((p && p.cedula) || '').replace(/[^0-9A-Za-z]/g, '');
  return c ? 'C:' + c : 'N:' + String((p && p.nombre) || '').trim().toUpperCase().replace(/\s+/g, ' ');
}
/** Suma `nuevo` a `previo`. Personas: se conservan las que había (menos las de
 *  `quitar`) y cada una que llega reemplaza a la misma persona (si llega sin
 *  firma, conserva la que tenía). Verificador: solo cambia si llega uno con
 *  nombre. Permisos vinculados: se juntan sin repetir. */
function mezclarRegistro_(previo, nuevo, quitar, opId, fecha) {
  previo = previo || {};
  nuevo = nuevo || {};
  const fuera = {};
  (Array.isArray(quitar) ? quitar : []).forEach(k => { fuera[String(k)] = true; });
  const lista = [], indice = {};
  (previo.trabajadores || []).forEach(t => {
    const k = clavePersona_(t);
    if (fuera[k] || !String(t.nombre || '').trim()) return;
    indice[k] = lista.length; lista.push(t);
  });
  (nuevo.trabajadores || []).forEach(t => {
    if (!String(t.nombre || '').trim()) return;
    const p = { nombre: String(t.nombre).trim(), cedula: String(t.cedula || '').trim(), cargo: String(t.cargo || '').trim(), firma: t.firma || null };
    const k = clavePersona_(p);
    if (k in indice) { if (!p.firma) p.firma = lista[indice[k]].firma || null; lista[indice[k]] = p; }
    else { indice[k] = lista.length; lista.push(p); }
  });
  const v = nuevo.verificador && String(nuevo.verificador.nombre || '').trim() ? nuevo.verificador : (previo.verificador || null);
  const permisos = [], vistos = {};
  (previo.permisos || []).concat(nuevo.permisos || []).forEach(p => {
    const c = p && p.code;
    if (!c || vistos[c]) return;
    vistos[c] = true; permisos.push(p);
  });
  return {
    fecha: fecha,
    trabajadores: lista,
    verificador: v,
    permisos: permisos,
    savedAt: nuevo.savedAt || previo.savedAt || new Date().toISOString(),
    opIds: (previo.opIds || []).concat(opId ? [opId] : []).slice(-100)
  };
}

/* ================= LECTURA ================= */

function doGet(e) {
  if (!checkToken_(e.parameter.token)) return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  const action = e.parameter.action;

  if (action === 'listPersonal') {
    const sheet = getPersonalSheet_();
    const last = sheet.getLastRow();
    const personal = [];
    if (last >= 2) {
      const data = sheet.getRange(2, 1, last - 1, 3).getValues(); // sin la columna updatedAt
      for (let i = 0; i < data.length; i++) {
        if (!data[i][0]) continue;
        personal.push({ cedula: data[i][0], nombre: data[i][1], cargo: data[i][2] });
      }
    }
    personal.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    return jsonOut_({ ok: true, personal });
  }

  if (action === 'listObras') {
    const sheet = getObrasSheet_();
    const data = sheet.getDataRange().getValues();
    const obras = [];
    for (let i = 1; i < data.length; i++) {
      let permisos = [];
      try { permisos = JSON.parse(data[i][5] || '[]'); } catch (err) { /* ignora fila corrupta */ }
      obras.push({
        obraId: data[i][0], nombre: data[i][1], area: data[i][2],
        fechaInicio: fechaISO_(data[i][3]), fechaFin: fechaISO_(data[i][4]), permisos: permisos, createdAt: data[i][6]
      });
    }
    obras.reverse(); // más recientes primero
    return jsonOut_({ ok: true, obras });
  }

  if (action === 'historial') {
    const obraId = e.parameter.obraId;
    if (!obraId) return jsonOut_({ ok: false, error: 'obraId requerido' });
    const sheet = getRegistrosSheet_();
    const last = sheet.getLastRow();
    const registros = [];
    if (last >= 2) {
      // Camino rápido: A:B (obra, fecha) y E:F (cantidad, verificador). Antes se
      // traía el dataJson de TODOS los registros de TODAS las obras y se parseaba
      // uno por uno, solo para contar trabajadores y sacar un nombre.
      const colAB = sheet.getRange(2, 1, last - 1, 2).getValues();
      const colEF = sheet.getRange(2, 5, last - 1, 2).getValues();
      for (let i = 0; i < colAB.length; i++) {
        if (colAB[i][0] !== obraId) continue;
        let cantidad = colEF[i][0], verificador = colEF[i][1] || '';
        if (cantidad === '' || cantidad === null) {
          // Respaldo para filas guardadas antes de que existieran las columnas
          // E/F: se lee esa celda puntual, no la hoja entera.
          try {
            const parsed = JSON.parse(sheet.getRange(i + 2, 3).getValue());
            cantidad = (parsed.trabajadores || []).length;
            verificador = (parsed.verificador && parsed.verificador.nombre) || '';
          } catch (err) { continue; }
        }
        registros.push({ fecha: fechaISO_(colAB[i][1]), cantidad: cantidad, verificador: verificador });
      }
    }
    registros.sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    return jsonOut_({ ok: true, registros });
  }

  if (action === 'registro') {
    const obraId = e.parameter.obraId, fecha = fechaISO_(e.parameter.fecha);
    if (!obraId || !fecha) return jsonOut_({ ok: false, error: 'obraId y fecha requeridos' });
    const sheet = getRegistrosSheet_();
    const rowIndex = buscarFilaRegistro_(sheet, obraId, fecha);
    if (rowIndex === -1) return jsonOut_({ ok: false, error: 'No hay registro para esa fecha' });
    const raw = sheet.getRange(rowIndex, 3).getValue(); // solo la celda del JSON
    let parsed;
    try { parsed = JSON.parse(raw); } catch (err) {
      return ContentService.createTextOutput(raw).setMimeType(ContentService.MimeType.JSON);
    }
    return jsonOut_(inyectarFirmas_(parsed, cargarFirmasPorRegistro_(obraId + '|' + fecha)));
  }

  if (action === 'ultimoRegistro') {
    const obraId = e.parameter.obraId;
    // antesDe=YYYY-MM-DD: el último registro ANTERIOR a esa fecha (para
    // "Copiar último registro" sin traer el del mismo día).
    const antesDe = e.parameter.antesDe ? fechaISO_(e.parameter.antesDe) : '';
    if (!obraId) return jsonOut_({ ok: false, error: 'obraId requerido' });
    const sheet = getRegistrosSheet_();
    const last = sheet.getLastRow();
    if (last < 2) return jsonOut_({ ok: false, error: 'Sin registros previos', antesDe: antesDe || undefined });
    // Se busca la fecha más reciente leyendo solo A:B; el dataJson se trae
    // después, y solo el de esa única fila.
    const colAB = sheet.getRange(2, 1, last - 1, 2).getValues();
    let mejorFila = -1, mejorFecha = null;
    for (let i = 0; i < colAB.length; i++) {
      if (colAB[i][0] !== obraId) continue;
      const f = fechaISO_(colAB[i][1]);
      if (antesDe && f >= antesDe) continue;
      if (mejorFecha === null || f > mejorFecha) { mejorFecha = f; mejorFila = i + 2; }
    }
    if (mejorFila === -1) return jsonOut_({ ok: false, error: 'Sin registros previos', antesDe: antesDe || undefined });
    const rawUltimo = sheet.getRange(mejorFila, 3).getValue();
    let parsedUltimo;
    try { parsedUltimo = JSON.parse(rawUltimo); } catch (err) {
      return ContentService.createTextOutput(rawUltimo).setMimeType(ContentService.MimeType.JSON);
    }
    const salida = inyectarFirmas_(parsedUltimo, cargarFirmasPorRegistro_(obraId + '|' + mejorFecha));
    salida.fecha = mejorFecha;
    return jsonOut_(salida);
  }

  // Bitácora de una obra o de una persona: ?action=history&clave=OBRA-...&token=...
  // No lo usa el portal todavía; sirve para auditar desde el navegador sin
  // tener que abrir la hoja de cálculo.
  if (action === 'history') {
    const clave = e.parameter.clave;
    if (!clave) return jsonOut_({ ok: false, error: 'clave requerida' });
    const hojaEv = getEventosSheet_();
    const lastEv = hojaEv.getLastRow();
    if (lastEv < 2) return jsonOut_({ ok: true, clave: clave, eventos: [] });
    // Solo A:F — se omite la columna H (dataJson), que es la pesada y que este
    // listado no muestra. Para ver el contenido de un evento puntual se abre la
    // hoja "Eventos" directamente.
    const ev = hojaEv.getRange(2, 1, lastEv - 1, 6).getValues();
    const eventos = [];
    for (let i = 0; i < ev.length; i++) {
      // Coincide con la clave exacta o con cualquier registro de esa obra
      // (las claves de registro son "obraId|fecha").
      if (ev[i][2] !== clave && String(ev[i][2]).indexOf(clave + '|') !== 0) continue;
      eventos.push({
        ts: ev[i][0], entidad: ev[i][1], clave: ev[i][2],
        accion: ev[i][3], resultado: ev[i][4], detalle: ev[i][5]
      });
    }
    return jsonOut_({ ok: true, clave: clave, eventos: eventos });
  }

  return jsonOut_({ ok: false, error: 'Esta opción no está disponible en esta versión. Cierra y vuelve a abrir el portal e inténtalo de nuevo.' });
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
  // Cualquier error se devuelve como DATOS ({ok:false, error}). Si el script
  // fallara sin atraparlo, Google responde con una página que el navegador no
  // deja leer y el celular solo ve "Load failed", sin saber por qué.
  try {
    return doPostInterno_(e);
  } catch (err) {
    try { registrarEvento_('', '', 'ERROR', 'RECHAZADO', String(err && err.message || err).slice(0, 500), '', ''); } catch (e2) {}
    return jsonOut_({ ok: false, error: 'Error en el servidor del anexo: ' + (err && err.message || err) });
  }
}

function doPostInterno_(e) {
  const body = JSON.parse(e.postData.contents);
  sinImagenesFalsas_(body);
  if (!checkToken_(body.token)) {
    // Se registra el intento SIN el contenido: si alguien está probando tokens
    // al azar, no tiene sentido llenar la bitácora con su basura.
    registrarEvento_('', '', body.action || 'DESCONOCIDA', 'RECHAZADO', 'Token inválido', '', '');
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  try { sellarFirmas_(body, ctxSello_(body, '', body.action || '')); } catch (e) { console.log('Sello: ' + e.message); }

  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(15000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    if (body.action === 'guardarPersona') {
      const cedula = String(body.cedula || '').trim();
      if (!cedula) return jsonOut_({ ok: false, error: 'Cédula requerida' });
      const sheet = getPersonalSheet_();
      const rowIndex = buscarFila_(sheet, 1, cedula); // busca leyendo solo la columna A
      const nuevo = { cedula: cedula, nombre: body.nombre || '', cargo: body.cargo || '' };
      // Si ya existía, se guarda también cómo estaba ANTES: así un cambio de
      // nombre o cargo no borra la versión anterior de la historia.
      let anterior = null;
      if (rowIndex !== -1) {
        const f = sheet.getRange(rowIndex, 1, 1, 3).getValues()[0];
        anterior = { cedula: f[0], nombre: f[1], cargo: f[2] };
      }
      registrarEvento_('PERSONA', cedula, 'GUARDAR_PERSONA', 'APLICADO',
                       rowIndex === -1 ? 'Alta de persona' : 'Actualización de persona',
                       body.opId, JSON.stringify({ anterior: anterior, nuevo: nuevo }));
      if (rowIndex === -1) {
        sheet.appendRow(filaSegura_([cedula, nuevo.nombre, nuevo.cargo, new Date()]));
      } else {
        sheet.getRange(rowIndex, 2, 1, 3).setValues(filaSegura_([[nuevo.nombre, nuevo.cargo, new Date()]]));
      }
      return jsonOut_({ ok: true });
    }

    if (body.action === 'eliminarPersona') {
      const cedula = String(body.cedula || '');
      if (!cedula) return jsonOut_({ ok: false, error: 'Cédula requerida' });
      const sheet = getPersonalSheet_();
      const rowIndex = buscarFila_(sheet, 1, cedula);
      if (rowIndex === -1) {
        registrarEvento_('PERSONA', cedula, 'ELIMINAR_PERSONA', 'RECHAZADO', 'Cédula no encontrada', body.opId, '');
        return jsonOut_({ ok: true }); // no encontrarla no es un error para el usuario
      }
      const f = sheet.getRange(rowIndex, 1, 1, 3).getValues()[0];
      // La fila completa queda guardada en la bitácora ANTES de borrarla.
      // Este es el punto del cambio: un borrado deja de ser irreversible.
      // Si alguien elimina a la persona equivocada, aquí están sus datos.
      registrarEvento_('PERSONA', cedula, 'ELIMINAR_PERSONA', 'APLICADO',
                       'Fila eliminada de la hoja Personal (recuperable desde este evento)',
                       body.opId,
                       JSON.stringify({ cedula: f[0], nombre: f[1], cargo: f[2] }));
      sheet.deleteRow(rowIndex);
      return jsonOut_({ ok: true });
    }

    if (body.action === 'crearObra') {
      // Sin idempotencia el reintento de un envío perdido crearía una obra
      // duplicada. El portal no encola crearObra en el Outbox hoy, pero si
      // llega opId se respeta, y de paso queda cubierto para el futuro.
      if (opIdYaAplicado_(body.opId)) {
        registrarEvento_('OBRA', '', 'CREAR_OBRA', 'DUPLICADO', 'opId ya aplicado; no se crea otra obra', body.opId, '');
        return jsonOut_({ ok: true, duplicado: true });
      }
      const sheet = getObrasSheet_();
      const obraId = genObraId_();
      const datos = {
        obraId: obraId, nombre: body.nombre || '', area: body.area || '',
        fechaInicio: body.fechaInicio || '', fechaFin: body.fechaFin || '',
        permisos: body.permisos || []
      };
      registrarEvento_('OBRA', obraId, 'CREAR_OBRA', 'APLICADO', '', body.opId, JSON.stringify(datos));
      sheet.appendRow(filaSegura_([obraId, datos.nombre, datos.area, datos.fechaInicio, datos.fechaFin,
        JSON.stringify(datos.permisos), new Date()]));
      return jsonOut_({ ok: true, obraId });
    }

    if (body.action === 'vincularPermisos') {
      const obraId = body.obraId;
      if (!obraId) return jsonOut_({ ok: false, error: 'obraId requerido' });
      const sheet = getObrasSheet_();
      const rowIndex = buscarFila_(sheet, 1, obraId);
      if (rowIndex === -1) {
        registrarEvento_('OBRA', obraId, 'VINCULAR_PERMISOS', 'RECHAZADO', 'Obra no encontrada', body.opId, '');
        return jsonOut_({ ok: false, error: 'Obra no encontrada' });
      }
      const nuevos = JSON.stringify(body.permisos || []);
      // Esta acción REEMPLAZA la lista completa de permisos vinculados, así que
      // se guarda la lista anterior junto con la nueva.
      registrarEvento_('OBRA', obraId, 'VINCULAR_PERMISOS', 'APLICADO', '', body.opId,
                       JSON.stringify({ anterior: sheet.getRange(rowIndex, 6).getValue() || '[]', nuevo: nuevos }));
      sheet.getRange(rowIndex, 6).setValue(nuevos);
      return jsonOut_({ ok: true });
    }

    if (body.action === 'guardarRegistro') {
      const obraId = body.obraId, fecha = fechaISO_(body.fecha);
      if (!obraId || !fecha) return jsonOut_({ ok: false, error: 'obraId y fecha requeridos' });
      const clave = obraId + '|' + fecha;
      if (opIdYaAplicado_(body.opId)) {
        registrarEvento_('REGISTRO', clave, 'GUARDAR_REGISTRO', 'DUPLICADO', 'opId ya aplicado', body.opId, '');
        return jsonOut_({ ok: true, duplicado: true });
      }
      const sheet = getRegistrosSheet_();
      const rowIndex = buscarFilaRegistro_(sheet, obraId, fecha); // solo lee A:B
      const mapaFirmas = [];
      const nuevo = extraerFirmas_(body.data || {}, mapaFirmas);
      // ANTES cada guardado REEMPLAZABA el registro del día: si dos supervisores
      // registraban la misma obra el mismo día, el último borraba al primero, y
      // no se podía volver para agregar a quien llegó tarde. Ahora se SUMA a lo
      // que ya había (por cédula, o por nombre si no tiene); quitar a alguien es
      // explícito (`quitar`), así un celular desactualizado no borra a nadie.
      let previo = null;
      if (rowIndex !== -1) {
        try { previo = JSON.parse(sheet.getRange(rowIndex, 3).getValue() || 'null'); } catch (err) { previo = null; }
        // Registros guardados antes de la corrección de firmas pueden traer las
        // imágenes dentro del JSON: se pasan a la hoja Firmas al mezclar.
        if (previo) previo = extraerFirmas_(previo, mapaFirmas);
      }
      const datos = mezclarRegistro_(previo, nuevo, body.quitar, body.opId, fecha);
      const json = JSON.stringify(datos);
      // Resumen para las columnas E/F, para que el historial no tenga que abrir
      // el dataJson de cada día.
      const cantidad = (datos.trabajadores || []).length;
      const verificador = (datos.verificador && datos.verificador.nombre) || '';
      guardarFirmas_(clave, mapaFirmas);
      // CADA versión del registro del día queda guardada en la bitácora.
      registrarEvento_('REGISTRO', clave, 'GUARDAR_REGISTRO', 'APLICADO',
                       rowIndex === -1 ? 'Primer registro del día' : 'Se sumó al registro del día (' + cantidad + ' personas)',
                       body.opId, json);
      if (rowIndex === -1) {
        sheet.appendRow(filaSegura_([obraId, fecha, json, new Date(), cantidad, verificador]));
      } else {
        sheet.getRange(rowIndex, 3, 1, 4).setValues(filaSegura_([[json, new Date(), cantidad, verificador]]));
      }
      return jsonOut_({ ok: true, cantidad: cantidad, verificador: verificador,
                        personas: datos.trabajadores.map(t => ({ nombre: t.nombre, cedula: t.cedula, firmado: !!t.firma })) });
    }

    return jsonOut_({ ok: false, error: 'Esta opción no está disponible en esta versión. Cierra y vuelve a abrir el portal e inténtalo de nuevo.' });
  } finally {
    lock.releaseLock();
  }
}

/* ============================================================
   HERRAMIENTAS DE AUDITORÍA
   No se exponen por la web: se ejecutan a mano desde el editor
   de Apps Script (menú Ejecutar). Nadie con el token puede
   invocarlas.
   ============================================================ */

/**
 * Reconstruye Obras y Registros usando ÚNICAMENTE la bitácora.
 * Devuelve { obras: {obraId: {...}}, registros: {'obraId|fecha': {...}} }.
 */
function reconstruirDesdeEventos_() {
  const ev = getEventosSheet_().getDataRange().getValues();
  const obras = {}, registros = {};
  for (let i = 1; i < ev.length; i++) {
    const ts = ev[i][0], entidad = ev[i][1], clave = ev[i][2], accion = ev[i][3];
    const resultado = ev[i][4], dataJson = ev[i][7];
    if (resultado !== 'APLICADO') continue; // los rechazados no cambian el estado
    let d = null;
    try { d = dataJson ? JSON.parse(dataJson) : null; } catch (err) { continue; }

    if (entidad === 'OBRA' && (accion === 'CREAR_OBRA' || accion === 'MIGRACION') && d) {
      obras[clave] = {
        obraId: clave, nombre: d.nombre || '', area: d.area || '',
        fechaInicio: d.fechaInicio || '', fechaFin: d.fechaFin || '',
        permisosJson: JSON.stringify(d.permisos || []), createdAt: ts
      };
    } else if (entidad === 'OBRA' && accion === 'VINCULAR_PERMISOS' && d && obras[clave]) {
      obras[clave].permisosJson = d.nuevo || '[]';
    } else if (entidad === 'REGISTRO' && (accion === 'GUARDAR_REGISTRO' || accion === 'MIGRACION')) {
      const partes = String(clave).split('|');
      registros[clave] = { obraId: partes[0], fecha: partes[1], dataJson: dataJson, updatedAt: ts };
    }
  }
  return { obras: obras, registros: registros };
}

/**
 * Compara las hojas con la bitácora y reporta diferencias. Si una fila fue
 * alterada, agregada o borrada por fuera del portal, aparece aquí.
 * Vale la pena ponerle un activador semanal.
 */
function verificarIntegridad() {
  const esperado = reconstruirDesdeEventos_();
  const problemas = [];

  const obras = getObrasSheet_().getDataRange().getValues();
  const obrasVistas = {};
  for (let i = 1; i < obras.length; i++) {
    const id = obras[i][0];
    if (!id) continue;
    obrasVistas[id] = true;
    const esp = esperado.obras[id];
    if (!esp) { problemas.push('Obra ' + id + ': está en la hoja pero no tiene eventos.'); continue; }
    if (String(esp.permisosJson) !== String(obras[i][5] || '[]')) {
      problemas.push('Obra ' + id + ': los permisos vinculados no coinciden con el último evento.');
    }
    if (String(esp.nombre) !== String(obras[i][1])) {
      problemas.push('Obra ' + id + ': el nombre en la hoja no coincide con el evento de creación.');
    }
  }
  for (const id in esperado.obras) {
    if (!obrasVistas[id]) problemas.push('Obra ' + id + ': tiene eventos pero desapareció de la hoja.');
  }

  const regs = getRegistrosSheet_().getDataRange().getValues();
  const regsVistos = {};
  for (let i = 1; i < regs.length; i++) {
    if (!regs[i][0]) continue;
    const clave = regs[i][0] + '|' + fechaISO_(regs[i][1]);
    regsVistos[clave] = true;
    const esp = esperado.registros[clave];
    if (!esp) { problemas.push('Registro ' + clave + ': está en la hoja pero no tiene eventos.'); continue; }
    if (String(esp.dataJson) !== String(regs[i][2])) {
      problemas.push('Registro ' + clave + ': el contenido no coincide con el último evento.');
    }
  }
  for (const clave in esperado.registros) {
    if (!regsVistos[clave]) problemas.push('Registro ' + clave + ': tiene eventos pero desapareció de la hoja.');
  }

  const resumen = problemas.length
    ? 'Se encontraron ' + problemas.length + ' diferencia(s):\n\n' + problemas.join('\n')
    : 'Todo cuadra: las hojas Obras y Registros coinciden con la bitácora.';
  console.log(resumen);
  if (problemas.length && CORREOS_AVISO.length) {
    CORREOS_AVISO.forEach(correo => {
      MailApp.sendEmail(correo, '⚠ Revisión de integridad — Personal Autorizado', resumen);
    });
  }
  return resumen;
}

/**
 * Devuelve las personas que fueron eliminadas y no se han vuelto a dar de alta.
 * Es la función que hace útil el cambio en eliminarPersona: si alguien borró a
 * quien no era, aquí están sus datos para volver a crearla.
 */
function personasEliminadas() {
  const ev = getEventosSheet_().getDataRange().getValues();
  const estado = {};
  for (let i = 1; i < ev.length; i++) {
    if (ev[i][1] !== 'PERSONA' || ev[i][4] !== 'APLICADO') continue;
    const cedula = ev[i][2];
    if (ev[i][3] === 'ELIMINAR_PERSONA') {
      let d = null;
      try { d = JSON.parse(ev[i][7] || 'null'); } catch (err) { /* sin datos */ }
      estado[cedula] = { eliminadaEl: ev[i][0], datos: d };
    } else if (ev[i][3] === 'GUARDAR_PERSONA') {
      delete estado[cedula]; // se volvió a dar de alta
    }
  }
  const lista = [];
  for (const c in estado) {
    lista.push(c + ' — eliminada el ' + estado[c].eliminadaEl +
               ' — ' + JSON.stringify(estado[c].datos));
  }
  const resumen = lista.length ? lista.join('\n') : 'No hay personas eliminadas pendientes de restaurar.';
  console.log(resumen);
  return resumen;
}

/**
 * Reescribe Obras y Registros desde la bitácora. Úsala solo si
 * verificarIntegridad() reportó diferencias y decidiste que la bitácora tiene
 * la razón. Antes de reescribir deja copias con la fecha, por si acaso.
 * NOTA: no toca la hoja Personal — para restaurar una persona borrada usa
 * personasEliminadas() y vuelve a crearla desde el portal.
 */
function reconstruirDesdeEventos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sello = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmm');
  const esperado = reconstruirDesdeEventos_();

  const hojaObras = getObrasSheet_();
  hojaObras.copyTo(ss).setName('Obras-respaldo-' + sello);
  const filasObras = [];
  for (const id in esperado.obras) {
    const o = esperado.obras[id];
    filasObras.push([o.obraId, o.nombre, o.area, o.fechaInicio, o.fechaFin, o.permisosJson, o.createdAt]);
  }
  hojaObras.clear();
  hojaObras.appendRow(filaSegura_(['obraId', 'nombre', 'area', 'fechaInicio', 'fechaFin', 'permisosJson', 'createdAt']));
  if (filasObras.length) hojaObras.getRange(2, 1, filasObras.length, 7).setValues(filaSegura_(filasObras));

  const hojaRegs = getRegistrosSheet_();
  hojaRegs.copyTo(ss).setName('Registros-respaldo-' + sello);
  const filasRegs = [];
  for (const clave in esperado.registros) {
    const r = esperado.registros[clave];
    filasRegs.push([r.obraId, r.fecha, r.dataJson, r.updatedAt]);
  }
  hojaRegs.clear();
  hojaRegs.appendRow(filaSegura_(['obraId', 'fecha', 'dataJson', 'updatedAt']));
  if (filasRegs.length) hojaRegs.getRange(2, 1, filasRegs.length, 4).setValues(filaSegura_(filasRegs));

  SpreadsheetApp.flush();
  const msg = 'Reconstruidas ' + filasObras.length + ' obra(s) y ' + filasRegs.length +
              ' registro(s). Las hojas anteriores quedaron como "-respaldo-' + sello + '".';
  console.log(msg);
  return msg;
}

/**
 * EJECUTAR UNA SOLA VEZ tras instalar esta versión.
 * Crea un evento por cada obra, registro y persona que ya existía antes de que
 * hubiera bitácora. Si detecta que ya hay eventos, no hace nada — es seguro
 * ejecutarla dos veces por error.
 */
function migrarHistorialExistente() {
  const eventos = getEventosSheet_();
  if (eventos.getLastRow() > 1) {
    const msg = 'La bitácora ya tiene eventos; no se migra nada para no duplicar.';
    console.log(msg);
    return msg;
  }
  const filas = [];

  const obras = getObrasSheet_().getDataRange().getValues();
  for (let i = 1; i < obras.length; i++) {
    if (!obras[i][0]) continue;
    let permisos = [];
    try { permisos = JSON.parse(obras[i][5] || '[]'); } catch (err) { /* fila corrupta */ }
    filas.push([obras[i][6] || new Date(), 'OBRA', obras[i][0], 'MIGRACION', 'APLICADO',
      'Obra existente antes de la bitácora', '',
      JSON.stringify({ obraId: obras[i][0], nombre: obras[i][1], area: obras[i][2],
        fechaInicio: obras[i][3], fechaFin: obras[i][4], permisos: permisos })]);
  }

  const regs = getRegistrosSheet_().getDataRange().getValues();
  for (let i = 1; i < regs.length; i++) {
    if (!regs[i][0]) continue;
    filas.push([regs[i][3] || new Date(), 'REGISTRO', regs[i][0] + '|' + regs[i][1], 'MIGRACION', 'APLICADO',
      'Registro existente antes de la bitácora', '', regs[i][2]]);
  }

  const personal = getPersonalSheet_().getDataRange().getValues();
  for (let i = 1; i < personal.length; i++) {
    if (!personal[i][0]) continue;
    filas.push([personal[i][3] || new Date(), 'PERSONA', String(personal[i][0]), 'MIGRACION', 'APLICADO',
      'Persona existente antes de la bitácora', '',
      JSON.stringify({ cedula: personal[i][0], nombre: personal[i][1], cargo: personal[i][2] })]);
  }

  if (filas.length) {
    eventos.getRange(2, 1, filas.length, 8).setValues(filaSegura_(filas));
    SpreadsheetApp.flush();
  }
  const msg = 'Migrados ' + filas.length + ' evento(s).';
  console.log(msg);
  return msg;
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
