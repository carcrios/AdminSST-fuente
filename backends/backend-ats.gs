/* ============================================================
   backend-ats.gs — Análisis de Trabajo Seguro (SSTA-F-007) — Portal SSTA
   ------------------------------------------------------------
   Mismo diseño que los demás backends del portal, con una diferencia
   importante:

     · Hoja "ATS": UNA FILA POR ATS con el resumen (código, fecha, centro de
       costos, área, trabajo, permisos, número de tareas y participantes,
       quién lo lidera). Es la hoja para consultar y filtrar.
     · Hoja "Datos": el ATS completo en JSON, PARTIDO EN TROZOS. A diferencia
       de un permiso, un ATS de bodega con 20 tareas y 10 peligros cada una
       pasa fácil los 50.000 caracteres que admite una celda de Google Sheets
       — el mismo límite que hizo perder firmas en los permisos. Por eso el
       contenido va troceado en filas, igual que las firmas.
     · Hoja "Firmas": imágenes aparte, troceadas si superan una celda.
     · Hoja "Peligros": una fila por cada peligro de cada tarea, con su clase
       GTC 45 y cuántos controles de cada jerarquía se marcaron. Sirve para
       indicadores (qué peligros son más frecuentes, en qué centro de costos,
       cuántos controles de ingeniería vs. solo EPP) sin abrir cada ATS.
     · Hoja "Eventos": bitácora inmutable de cada intento de escritura.
     · Idempotencia por opId: un reenvío desde la cola sin señal no duplica.

   El ATS se puede volver a guardar las veces que haga falta durante su
   vigencia (se suman participantes, se firma después): cada guardado
   reemplaza el contenido, sube la versión y queda en la bitácora.

   CIERRE: acción cerrarAts (fecha, hora, motivo, observaciones y firma de
   quien cierra). Un ATS cerrado ya no se sobrescribe ni recibe personal.

   ACTUALIZAR SIN CAMBIAR LA URL: pegar este archivo encima del anterior →
   Implementar → Administrar implementaciones → ✏️ editar → Versión: "Nueva
   versión" → Implementar. (Una "Nueva implementación" da otra URL.)

   DESPLIEGUE: ver README.md → "Desplegar un backend". Resumen: hoja de
   cálculo nueva → Extensiones → Apps Script → pegar este archivo →
   Implementar → Nueva implementación → Aplicación web → Ejecutar como: yo,
   Acceso: cualquier usuario → copiar la URL en config.js (BACKENDS.ats.url).
   ============================================================ */

const API_TOKEN = 'PON-AQUI-EL-TOKEN'; // debe ser IDÉNTICO al del cliente (config.js)

const ATS_SHEET = 'ATS';
const DATOS_SHEET = 'Datos';
const FIRMAS_SHEET = 'Firmas';
const PELIGROS_SHEET = 'Peligros';
const EVENTOS_SHEET = 'Eventos';

const COLS_ATS = ['atsCode', 'version', 'fechaDesde', 'fechaHasta', 'centroCostos', 'area', 'trabajo',
                  'permisos', 'tareas', 'peligros', 'participantes', 'firmasParticipantes', 'lider',
                  'nombresParticipantes', 'createdAt', 'updatedAt',
                  'estado', 'cerradoEn', 'cerradoPor', 'motivoCierre'];
// Posición (desde 0) de las columnas de estado dentro de una fila de "ATS".
const C_ESTADO = 16, C_CERRADO_EN = 17, C_CERRADO_POR = 18, C_MOTIVO = 19;
const esCerrado_ = (fila) => String(fila[C_ESTADO] || '').toUpperCase() === 'CERRADO';

// Máximo de caracteres por celda que se usa. Google Sheets admite 50.000;
// se deja margen.
const MAX_CHARS_CELDA = 32000;   // v142: tope de Excel (respaldo .xlsx)

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

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ================= HOJAS ================= */

/* El libro donde se guarda todo. Si el script se creó desde la hoja
   (Extensiones → Apps Script) es esa hoja. Si se creó suelto en
   script.google.com (por ejemplo desde el celular), getActiveSpreadsheet()
   devuelve null y antes TODO fallaba: ahora se crea un libro
   "ATS - Portal SSTA" en el Drive de quien implementó y se recuerda su id. */
function libro_() {
  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ATS_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  // Sin bloqueo propio: los guardados ya llegan aquí dentro del bloqueo de
  // doPost, y el libro solo se crea una vez (la primera petición).
  const nuevo = SpreadsheetApp.create('ATS - Portal SSTA');
  props.setProperty('ATS_SHEET_ID', nuevo.getId());
  return nuevo;
}

/** Ejecutar a mano desde el editor (▶ Ejecutar → verLibro): autoriza el
 *  script y muestra en el registro la URL de la hoja donde se guardan los ATS. */
function verLibro() {
  const ss = libro_();
  getAtsSheet_(); getDatosSheet_(); getFirmasSheet_(); getPeligrosSheet_(); getEventosSheet_();
  console.log('Hoja de los ATS: ' + ss.getUrl());
}

function hoja_(nombre, encabezado) {
  const ss = libro_();
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(filaSegura_(encabezado));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}
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
function getAtsSheet_() {
  const sheet = hoja_(ATS_SHEET, COLS_ATS);
  // Una hoja creada con la versión anterior del backend no tiene las columnas
  // de estado/cierre en el encabezado: se completan (los datos no se tocan).
  if (sheet.getRange(1, COLS_ATS.length).getValue() !== COLS_ATS[COLS_ATS.length - 1]) {
    sheet.getRange(1, 1, 1, COLS_ATS.length).setValues(filaSegura_([COLS_ATS]));
  }
  return sheet;
}
function getDatosSheet_() { return hoja_(DATOS_SHEET, ['atsCode', 'parte', 'texto', 'updatedAt']); }
function getFirmasSheet_() { return hoja_(FIRMAS_SHEET, ['atsCode', 'sigKey', 'dataUrl', 'updatedAt']); }
function getPeligrosSheet_() {
  return hoja_(PELIGROS_SHEET, ['atsCode', 'fechaDesde', 'centroCostos', 'area', 'tareaN', 'tarea',
                                'claseGTC45', 'subclase', 'peligro', 'consecuencia', 'controlesMarcados',
                                'eliminacion', 'sustitucion', 'ingenieria', 'administrativos', 'epp', 'agregados']);
}
function getEventosSheet_() {
  return hoja_(EVENTOS_SHEET, ['ts', 'atsCode', 'accion', 'resultado', 'detalle', 'opId', 'version', 'resumen']);
}

/** Filas donde `columna` vale exactamente `valor` (TextFinder: la búsqueda
 *  la resuelve Google, no se trae la columna entera al script). */
function filasPorValor_(sheet, columna, valor) {
  const last = sheet.getLastRow();
  if (last < 2 || !valor) return [];
  return sheet.getRange(2, columna, last - 1, 1)
    .createTextFinder(String(valor)).matchEntireCell(true).matchCase(true).findAll()
    .map(function (r) { return r.getRow(); });
}

/** Borra todas las filas donde la columna A vale `code`, de abajo hacia arriba
 *  (así los números de las filas que faltan no se corren). Agrupa filas
 *  seguidas para no hacer un llamado por fila. */
function borrarFilasDe_(sheet, code) {
  const filas = filasPorValor_(sheet, 1, code).sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < filas.length) {
    let inicio = filas[i], cuantas = 1;
    while (i + cuantas < filas.length && filas[i + cuantas] === inicio - 1) { inicio--; cuantas++; }
    sheet.deleteRows(inicio, cuantas);
    i += cuantas;
  }
}

/* ================= BITÁCORA ================= */

function registrarEvento_(code, accion, resultado, detalle, opId, version, resumen) {
  try {
    getEventosSheet_().appendRow(filaSegura_([new Date(), code || '', accion, resultado, detalle || '',
                                  opId || '', version || '', resumen || '']));
  } catch (e) { /* la bitácora nunca debe tumbar la operación principal */ }
}

function opIdYaAplicado_(opId) {
  if (!opId) return false;
  const sheet = getEventosSheet_();
  const rows = filasPorValor_(sheet, 6, opId); // F = opId
  for (let i = 0; i < rows.length; i++) {
    if (sheet.getRange(rows[i], 4).getValue() === 'APLICADO') return true; // D = resultado
  }
  return false;
}

/* ================= TROCEO DE TEXTO ================= */

function trocear_(clave, texto) {
  if (texto.length <= MAX_CHARS_CELDA) return [{ key: clave, texto: texto }];
  const total = Math.ceil(texto.length / MAX_CHARS_CELDA);
  const out = [];
  for (let i = 0; i < total; i++) {
    out.push({ key: clave + '~' + (i + 1) + '/' + total, texto: texto.substr(i * MAX_CHARS_CELDA, MAX_CHARS_CELDA) });
  }
  return out;
}
/** Reensambla trozos {key, texto} (pueden venir desordenados). */
function reensamblar_(filas) {
  const mapa = {}, partes = {};
  filas.forEach(function (f) {
    const key = String(f.key);
    const pos = key.indexOf('~');
    if (pos === -1) { mapa[key] = f.texto; return; }
    const base = key.substring(0, pos);
    const n = parseInt(key.substring(pos + 1).split('/')[0], 10) || 1;
    (partes[base] = partes[base] || []).push({ n: n, texto: f.texto });
  });
  for (const base in partes) {
    partes[base].sort(function (a, b) { return a.n - b.n; });
    { const u = {}; partes[base].forEach(function (p) { u[p.n] = p.texto; }); mapa[base] = Object.keys(u).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return u[n]; }).join(''); }   // v144: trozos repetidos: vale el último
  }
  return mapa;
}
/** Lee las filas de `code` en una hoja con columnas [code, clave, texto, ...]. */
function leerTrozos_(sheet, code) {
  const rows = filasPorValor_(sheet, 1, code).sort(function (a, b) { return a - b; });
  if (!rows.length) return [];
  const minR = rows[0], maxR = rows[rows.length - 1];
  const vals = sheet.getRange(minR, 2, maxR - minR + 1, 2).getValues();
  return rows.map(function (r) { return { key: vals[r - minR][0], texto: vals[r - minR][1] }; });
}

/* ================= FIRMAS ================= */

function sigKeyFromDataUrl_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('').substring(0, 12);
}

/** Saca del objeto toda imagen base64 (las firmas) y la cambia por
 *  "SIGREF:xxxx". En el ATS las firmas viven en campos `firma`, no en campos
 *  que contengan "sig" como en los permisos: por eso aquí se reconoce por el
 *  contenido (data:image...), no por el nombre del campo. */
function extraerFirmas_(obj, mapaFirmas) {
  if (Array.isArray(obj)) return obj.map(function (x) { return extraerFirmas_(x, mapaFirmas); });
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k in obj) {
      const v = obj[k];
      if (typeof v === 'string' && v.indexOf('data:image') === 0) {
        const key = sigKeyFromDataUrl_(v);
        mapaFirmas.push({ sigKey: key, dataUrl: v });
        out[k] = 'SIGREF:' + key;
      } else {
        out[k] = extraerFirmas_(v, mapaFirmas);
      }
    }
    return out;
  }
  return obj;
}

function rehidratarFirmas_(obj, mapa) {
  if (Array.isArray(obj)) return obj.map(function (x) { return rehidratarFirmas_(x, mapa); });
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k in obj) {
      const v = obj[k];
      out[k] = (typeof v === 'string' && v.indexOf('SIGREF:') === 0) ? (mapa[v.substring(7)] || '') : rehidratarFirmas_(v, mapa);
    }
    return out;
  }
  return obj;
}

/** Guarda solo las firmas que todavía no están para este ATS (una firma que
 *  no cambió entre guardados no se vuelve a escribir). */
function guardarFirmas_(code, mapaFirmas) {
  if (!mapaFirmas.length) return;
  const sheet = getFirmasSheet_();
  const existentes = {};
  leerTrozos_(sheet, code).forEach(function (f) {
    const k = String(f.key); existentes[k.indexOf('~') === -1 ? k : k.substring(0, k.indexOf('~'))] = true;
  });
  const ahora = new Date(), filas = [], vistas = {};
  mapaFirmas.forEach(function (f) {
    if (existentes[f.sigKey] || vistas[f.sigKey]) return;
    vistas[f.sigKey] = true;
    trocear_(f.sigKey, f.dataUrl).forEach(function (t) { filas.push([code, t.key, "'" + t.texto, ahora]); });
  });
  if (filas.length) sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, 4).setValues(filaSegura_(filas));
}

/* ================= RESUMEN CALCULADO EN EL SERVIDOR =================
   Los campos de la hoja "ATS" y de "Peligros" se calculan aquí a partir del
   contenido, no se toman de lo que diga el cliente: así siempre corresponden
   a lo que realmente quedó guardado. */

function texto_(x) { return x == null ? '' : String(x); }

function resumir_(ats) {
  const cab = ats.cab || {};
  const tareas = Array.isArray(ats.tareas) ? ats.tareas : [];
  const part = Array.isArray(ats.participantes) ? ats.participantes : [];
  // Firmado = imagen presente, o su referencia (SIGREF) cuando se resume el
  // contenido tal como está guardado en la hoja "Datos".
  const firmado = function (f) { return typeof f === 'string' && (f.length > 100 || f.indexOf('SIGREF:') === 0); };
  const centro = (Array.isArray(cab.centro) ? cab.centro : []).concat(texto_(cab.centroOtro).trim() ? [texto_(cab.centroOtro).trim()] : []);
  const peligros = tareas.reduce(function (a, t) { return a + (Array.isArray(t.peligros) ? t.peligros.length : 0); }, 0);
  return {
    fechaDesde: texto_(cab.desde), fechaHasta: texto_(cab.hasta),
    centroCostos: centro.join(', '), area: texto_(cab.area), trabajo: texto_(cab.trabajo),
    permisos: cab.requiere === 'SI'
      ? (cab.permisos || []).map(function (x) { return x === 'otro' ? 'otro: ' + String(cab.permisoOtro || '').trim() : x; }).join(', ')
      : (cab.requiere === 'NO' ? 'NO' : ''),
    tareas: tareas.length, peligros: peligros,
    // v148: el auditor ve en la hoja si el ATS quedó incompleto (peligros sin control, participantes o firmas finales sin firmar)
    pendientes: (function () {
      const f = [];
      const sinCtl = tareas.reduce(function (a, t) { return a + (t.peligros || []).filter(function (p) { return !(p.controles || []).length && !texto_(p.control || p.controlesOtro).trim(); }).length; }, 0);
      if (sinCtl) f.push(sinCtl + ' peligro(s) sin control');
      const sinF = part.filter(function (p) { return !firmado(p.firma); }).length; if (sinF) f.push(sinF + ' participante(s) sin firma');
      ['lider', 'jefe', 'sst'].forEach(function (k) { if (!firmado(((ats.firmas || {})[k] || {}).firma)) f.push('falta firma ' + k); });
      return f.join('; ');
    })(),
    participantes: part.length,
    firmasParticipantes: part.filter(function (p) { return firmado(p.firma); }).length,
    tardios: part.filter(function (p) { return p.tardio; }).length,
    firmasFinales: ['lider', 'jefe', 'sst'].filter(function (k) { return ats.firmas && ats.firmas[k] && firmado(ats.firmas[k].firma); }).length,
    lider: ats.firmas && ats.firmas.lider ? texto_(ats.firmas.lider.nombre) : '',
    nombresParticipantes: part.map(function (p) { return (texto_(p.nombres) + ' ' + texto_(p.apellidos)).trim(); }).filter(String).join(', ')
  };
}

function filasPeligros_(code, ats, r) {
  const out = [];
  (ats.tareas || []).forEach(function (t, i) {
    (t.peligros || []).forEach(function (p) {
      const ctr = Array.isArray(p.ctrls) ? p.ctrls.filter(function (c) { return c && c.on; }) : [];
      const cuenta = function (j) { return ctr.filter(function (c) { return c.j === j; }).length; };
      out.push([code, r.fechaDesde, r.centroCostos, r.area, i + 1, texto_(t.titulo).slice(0, 300),
                texto_(p.clase), texto_(p.sub), texto_(p.texto).slice(0, 500), texto_(p.efectos).slice(0, 500),
                ctr.length + (Array.isArray(p.extra) ? p.extra.length : 0),
                cuenta('E'), cuenta('S'), cuenta('I'), cuenta('A'), cuenta('P'),
                Array.isArray(p.extra) ? p.extra.length : 0]);
    });
  });
  return out;
}

function genCode_() {
  const d = new Date();
  return 'ATS-' + Utilities.formatDate(d, 'America/Bogota', 'yyyyMMdd') + '-' + String(Math.floor(Math.random() * 900000) + 100000);
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
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonOut_({ ok: false, error: 'Los datos llegaron incompletos. Vuelve a enviar el formulario.' }); }
  sinImagenesFalsas_(body);

  if (!checkToken_(body.token)) {
    registrarEvento_(body.code || '', 'GUARDAR', 'RECHAZADO', 'Token inválido', body.opId, '', '');
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  try { sellarFirmas_(body, ctxSello_(body, '', body.action || '')); } catch (e) { console.log('Sello: ' + e.message); }

  if (body.action === 'agregarParticipantes') return agregarParticipantes_(body);
  if (body.action === 'cerrarAts') return cerrarAts_(body);

  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(20000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    if (body.opId && opIdYaAplicado_(body.opId)) {
      registrarEvento_(body.code || '', 'GUARDAR', 'DUPLICADO', 'opId ya aplicado; no se repite', body.opId, '', '');
      return jsonOut_({ ok: true, code: body.code, duplicado: true });
    }
    const ats = body.ats;
    if (!ats || typeof ats !== 'object' || !ats.cab || !Array.isArray(ats.tareas)) {
      registrarEvento_(body.code || '', 'GUARDAR', 'RECHAZADO', 'ATS vacío o con estructura inválida', body.opId, '', '');
      return jsonOut_({ ok: false, error: 'El ATS llegó vacío o incompleto.' });
    }

    // El código lo genera el celular al primer guardado (así la cola sin señal
    // puede comprobar después si ya llegó). Si no viene, se genera aquí.
    const code = /^ATS-\d{8}-\d{4,8}$/.test(texto_(body.code)) ? body.code : genCode_();
    const ahora = new Date();

    // Solo se guarda el contenido del ATS: nada del "sobre" (token, opId).
    const limpio = {};
    ['v', 'cab', 'participantes', 'tareas', 'firmas', 'copiaDe', 'revisadoHoy', 'revisadoPor', 'habilitacion'].forEach(function (k) { if (ats[k] !== undefined) limpio[k] = ats[k]; });   // v148: copia y revisión de hoy quedan para el auditor
    if (limpio.copiaDe && !limpio.revisadoHoy) return jsonOut_({ ok: false, error: 'Este ATS es copia de otro: confirma que se revisó hoy en el sitio antes de guardarlo.' });
    limpio.code = code;

    const mapaFirmas = [];
    const sinFirmas = extraerFirmas_(limpio, mapaFirmas);
    const r = resumir_(ats);

    const sheet = getAtsSheet_();
    const existentes = filasPorValor_(sheet, 1, code);
    let version = 1, creado = ahora;
    if (existentes.length) {
      const prev = sheet.getRange(existentes[0], 1, 1, COLS_ATS.length).getValues()[0];
      // Un ATS cerrado queda en firme: solo se consulta e imprime.
      if (esCerrado_(prev)) {
        registrarEvento_(code, 'GUARDAR', 'RECHAZADO', 'El ATS ya está cerrado', body.opId, prev[1], '');
        return jsonOut_({ ok: false, cerrado: true,
                          error: 'Este ATS ya está cerrado (' + texto_(prev[C_MOTIVO]) + '). Queda solo para consulta e impresión.' });
      }
      version = (Number(prev[1]) || 0) + 1;
      creado = prev[14] || ahora;
    }
    sinFirmas.version = version;

    // Dos dispositivos con el mismo ATS abierto (el supervisor edita en la
    // tablet mientras SSTA firma en su celular): si este envío se armó sobre
    // una versión más vieja que la guardada, NO se sobrescribe — se perderían
    // las firmas o cambios del otro. El celular decide: abrir la del servidor
    // o, si la persona lo confirma, sobrescribir (force).
    const base = Number(body.versionBase) || 0;
    if (existentes.length && base < version - 1 && !body.force) {
      registrarEvento_(code, 'GUARDAR', 'RECHAZADO', 'Conflicto: se envió sobre v' + base + ' y el servidor tiene v' + (version - 1),
                       body.opId, version - 1, '');
      // v148: lo rechazado (con sus firmas) se guarda aparte para poder recuperarlo: antes solo quedaba en ese celular.
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let hr = ss.getSheetByName('ATS rechazados');
        if (!hr) { hr = ss.insertSheet('ATS rechazados'); hr.appendRow(filaSegura_(['code', 'parte', 'contenido', 'recibido', 'opId'])); hr.setFrozenRows(1); }
        const tr = trocear_(code, JSON.stringify(body.ats || {}));
        hr.getRange(hr.getLastRow() + 1, 1, tr.length, 5).setValues(filaSegura_(tr.map(function (t) { return [code, t.key, "'" + t.texto, ahora, body.opId || '']; })));
      } catch (eR) { console.log('ATS rechazado sin copia: ' + eR.message); }
      return jsonOut_({ ok: false, conflicto: true, versionServidor: version - 1,
                        error: 'Otro dispositivo guardó una versión más nueva de este ATS (v' + (version - 1) + ').' });
    }

    // 1) Firmas primero: si algo falla después, al menos las imágenes quedan.
    guardarFirmas_(code, mapaFirmas);

    // 2) Contenido, troceado. Se reemplaza la versión anterior completa.
    const datos = getDatosSheet_();
    borrarFilasDe_(datos, code);
    const trozos = trocear_(code, JSON.stringify(sinFirmas));
    datos.getRange(datos.getLastRow() + 1, 1, trozos.length, 4)
      .setValues(filaSegura_(trozos.map(function (t) { return [code, t.key, "'" + t.texto, ahora]; })));

    // 3) Peligros para indicadores.
    const hp = getPeligrosSheet_();
    borrarFilasDe_(hp, code);
    const fp = filasPeligros_(code, limpio, r);
    if (fp.length) hp.getRange(hp.getLastRow() + 1, 1, fp.length, fp[0].length).setValues(filaSegura_(fp));

    // 4) Resumen: al final, porque es lo que se consulta — si aparece aquí es
    //    porque lo de arriba ya quedó escrito.
    const fila = [code, version, r.fechaDesde, r.fechaHasta, r.centroCostos, r.area, r.trabajo, r.permisos,
                  r.tareas, r.peligros, r.participantes, r.firmasParticipantes, r.lider, r.nombresParticipantes,
                  creado, ahora];
    if (existentes.length) sheet.getRange(existentes[0], 1, 1, fila.length).setValues(filaSegura_([fila]));
    else sheet.appendRow(filaSegura_(fila.concat(['ABIERTO', '', '', ''])));

    const resumenTxt = r.tareas + ' tareas · ' + r.peligros + ' peligros · ' + r.participantes + ' participantes (' +
                       r.firmasParticipantes + ' firmados) · ' + r.firmasFinales + '/3 firmas finales';
    registrarEvento_(code, 'GUARDAR', 'APLICADO', existentes.length ? 'Actualización' : 'Creación', body.opId, version, resumenTxt);

    return jsonOut_({ ok: true, code: code, version: version, resumen: {
      tareas: r.tareas, peligros: r.peligros, participantes: r.participantes,
      firmasParticipantes: r.firmasParticipantes, firmasFinales: r.firmasFinales } });
  } catch (err) {
    registrarEvento_(body.code || '', 'GUARDAR', 'RECHAZADO', 'Error: ' + err.message, body.opId, '', '');
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ================= AGREGAR PERSONAL QUE LLEGA DESPUÉS =================
   Cuando llega gente a la obra con el ATS ya guardado. En vez de reemplazar
   todo el ATS (lo que choca con quien lo esté editando en otro dispositivo),
   aquí solo se SUMAN personas a la versión más reciente que haya en el
   servidor: no importa sobre qué versión se trabajó en el celular.

   - Si una persona ya está (mismo uid, o misma cédula), no se duplica.
   - Cada persona queda con la hora en que se agregó (`ingreso`) y con la
     marca de que se le socializó el ATS: quien llega tarde no estuvo en la
     charla inicial, así que tiene que constar que se le explicó. */
/** v148: clave de firma de un ATS (HMAC del código con un secreto del proyecto). La comprueba también el servidor único. */
function claveFirmaAts_(code) {
  const pr = PropertiesService.getScriptProperties();
  let sec = pr.getProperty('FIRMA_ENLACE'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('FIRMA_ENLACE', sec); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('ats:' + String(code || ''), sec)).slice(0, 22);
}
function agregarParticipantes_(body) {
  const code = texto_(body.code);
  const nuevos = Array.isArray(body.participantes) ? body.participantes : [];
  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(20000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    if (body.opId && opIdYaAplicado_(body.opId)) {
      registrarEvento_(code, 'AGREGAR_PERSONAL', 'DUPLICADO', 'opId ya aplicado; no se repite', body.opId, '', '');
      return jsonOut_({ ok: true, code: code, duplicado: true });
    }
    if (!nuevos.length) return jsonOut_({ ok: false, error: 'No llegó ninguna persona para agregar.' });
    const sheet = getAtsSheet_();
    const filas = filasPorValor_(sheet, 1, code);
    if (!filas.length) {
      registrarEvento_(code, 'AGREGAR_PERSONAL', 'RECHAZADO', 'El ATS no existe', body.opId, '', '');
      return jsonOut_({ ok: false, error: 'No existe un ATS con el código ' + code + '.' });
    }
    const filaAts = sheet.getRange(filas[0], 1, 1, COLS_ATS.length).getValues()[0];
    if (esCerrado_(filaAts)) {
      registrarEvento_(code, 'AGREGAR_PERSONAL', 'RECHAZADO', 'El ATS ya está cerrado', body.opId, filaAts[1], '');
      return jsonOut_({ ok: false, cerrado: true, error: 'El ATS ' + code + ' ya está cerrado: no se puede agregar personal. Si el trabajo sigue, hay que abrir un ATS nuevo.' });
    }
    const datos = getDatosSheet_();
    const texto = reensamblar_(leerTrozos_(datos, code))[code];
    if (!texto) return jsonOut_({ ok: false, error: 'No se encontró el contenido del ATS.' });
    const actual = JSON.parse(texto); // con las firmas como SIGREF: no hace falta traerlas

    const partes = Array.isArray(actual.participantes) ? actual.participantes : (actual.participantes = []);
    const uids = {}, cedulas = {};
    partes.forEach(function (p) { if (p.uid) uids[p.uid] = true; if (texto_(p.cedula).trim()) cedulas[texto_(p.cedula).trim()] = true; });
    const ahora = new Date();
    const agregados = [], omitidos = [], mapaFirmas = [];
    nuevos.forEach(function (p) {
      const nombre = (texto_(p.nombres) + ' ' + texto_(p.apellidos)).trim() || 'sin nombre';
      const ced = texto_(p.cedula).trim();
      if ((p.uid && uids[p.uid]) || (ced && cedulas[ced])) { omitidos.push(nombre + ' (ya estaba)'); return; }
      const limpio = extraerFirmas_({
        uid: texto_(p.uid) || ('s' + ahora.getTime() + agregados.length),
        nombres: texto_(p.nombres), apellidos: texto_(p.apellidos), cedula: ced, cargo: texto_(p.cargo),
        firma: typeof p.firma === 'string' && p.firma.indexOf('data:image') === 0 ? p.firma : null,
        tardio: true, socializado: !!p.socializado, ingreso: p.ingreso || ahora.toISOString()
      }, mapaFirmas);
      partes.push(limpio);
      if (limpio.uid) uids[limpio.uid] = true;
      if (ced) cedulas[ced] = true;
      agregados.push(nombre);
    });
    if (!agregados.length) {
      registrarEvento_(code, 'AGREGAR_PERSONAL', 'DUPLICADO', 'Nadie nuevo: ' + omitidos.join(', '), body.opId, '', '');
      return jsonOut_({ ok: true, code: code, agregados: [], omitidos: omitidos });
    }

    const prev = sheet.getRange(filas[0], 1, 1, COLS_ATS.length).getValues()[0];
    const version = (Number(prev[1]) || 0) + 1;
    actual.version = version;

    guardarFirmas_(code, mapaFirmas);
    borrarFilasDe_(datos, code);
    const trozos = trocear_(code, JSON.stringify(actual));
    datos.getRange(datos.getLastRow() + 1, 1, trozos.length, 4)
      .setValues(filaSegura_(trozos.map(function (t) { return [code, t.key, "'" + t.texto, ahora]; })));

    const r = resumir_(actual);
    sheet.getRange(filas[0], 1, 1, 16).setValues(filaSegura_([[code, version, prev[2], prev[3], prev[4], prev[5], prev[6], prev[7],
      prev[8], prev[9], r.participantes, r.firmasParticipantes, prev[12], r.nombresParticipantes, prev[14], ahora]]));

    registrarEvento_(code, 'AGREGAR_PERSONAL', 'APLICADO', 'Agregados: ' + agregados.join(', ') + (omitidos.length ? ' · Omitidos: ' + omitidos.join(', ') : ''),
                     body.opId, version, r.participantes + ' participantes (' + r.firmasParticipantes + ' firmados)');
    return jsonOut_({ ok: true, code: code, version: version, agregados: agregados, omitidos: omitidos,
                      resumen: { participantes: r.participantes, firmasParticipantes: r.firmasParticipantes } });
  } catch (err) {
    registrarEvento_(code, 'AGREGAR_PERSONAL', 'RECHAZADO', 'Error: ' + err.message, body.opId, '', '');
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ================= CERRAR EL ATS =================
   Igual que el cierre de un permiso: al terminar (o suspender) el trabajo,
   alguien registra fecha, hora, motivo y firma. Desde ahí el ATS queda en
   firme: ya no se puede editar ni sumar personal, solo consultar e imprimir.
   Lo que estuviera pendiente al cerrar (firmas faltantes, etc.) queda escrito
   en el cierre, para que conste que se cerró sabiéndolo. */
const MOTIVOS_CIERRE = ['Actividad finalizada', 'Actividad cancelada', 'Evento no deseado', 'Lluvia / tormenta',
                        'Condiciones y/o actos inseguros'];
function cerrarAts_(body) {
  const code = texto_(body.code);
  const c = body.cierre || {};
  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(20000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    if (body.opId && opIdYaAplicado_(body.opId)) {
      registrarEvento_(code, 'CERRAR', 'DUPLICADO', 'opId ya aplicado; no se repite', body.opId, '', '');
      return jsonOut_({ ok: true, code: code, duplicado: true });
    }
    const faltas = [];
    if (!texto_(c.fecha).trim()) faltas.push('fecha');
    if (!texto_(c.hora).trim()) faltas.push('hora');
    if (MOTIVOS_CIERRE.indexOf(texto_(c.motivo)) === -1) faltas.push('motivo');
    if (!texto_(c.nombre).trim()) faltas.push('nombre de quien cierra');
    if (!(typeof c.firma === 'string' && c.firma.indexOf('data:image') === 0)) faltas.push('firma de quien cierra');
    if (faltas.length) {
      registrarEvento_(code, 'CERRAR', 'RECHAZADO', 'Faltan: ' + faltas.join(', '), body.opId, '', '');
      return jsonOut_({ ok: false, error: 'Para cerrar el ATS falta: ' + faltas.join(', ') + '.' });
    }
    const sheet = getAtsSheet_();
    const filas = filasPorValor_(sheet, 1, code);
    if (!filas.length) {
      registrarEvento_(code, 'CERRAR', 'RECHAZADO', 'El ATS no existe', body.opId, '', '');
      return jsonOut_({ ok: false, error: 'No existe un ATS con el código ' + code + '.' });
    }
    const prev = sheet.getRange(filas[0], 1, 1, COLS_ATS.length).getValues()[0];
    if (esCerrado_(prev)) {
      // Dos personas cerrando a la vez, o un reenvío: el primer cierre es el que vale.
      registrarEvento_(code, 'CERRAR', 'DUPLICADO', 'Ya estaba cerrado', body.opId, prev[1], '');
      return jsonOut_({ ok: true, code: code, yaCerrado: true, version: prev[1],
                        cerradoPor: prev[C_CERRADO_POR], motivo: prev[C_MOTIVO] });
    }
    const datos = getDatosSheet_();
    const texto = reensamblar_(leerTrozos_(datos, code))[code];
    if (!texto) return jsonOut_({ ok: false, error: 'No se encontró el contenido del ATS.' });
    const actual = JSON.parse(texto);

    const ahora = new Date(), mapaFirmas = [];
    actual.cierre = extraerFirmas_({
      fecha: texto_(c.fecha), hora: texto_(c.hora), motivo: texto_(c.motivo),
      observaciones: texto_(c.observaciones).slice(0, 2000),
      nombre: texto_(c.nombre).trim(), cedula: texto_(c.cedula).trim(), cargo: texto_(c.cargo).trim(),
      firma: c.firma,
      pendientes: Array.isArray(c.pendientes) ? c.pendientes.map(texto_).slice(0, 40) : [],
      registradoEn: ahora.toISOString()
    }, mapaFirmas);
    actual.estado = 'CERRADO';
    const version = (Number(prev[1]) || 0) + 1;
    actual.version = version;

    guardarFirmas_(code, mapaFirmas);
    borrarFilasDe_(datos, code);
    const trozos = trocear_(code, JSON.stringify(actual));
    datos.getRange(datos.getLastRow() + 1, 1, trozos.length, 4)
      .setValues(filaSegura_(trozos.map(function (t) { return [code, t.key, "'" + t.texto, ahora]; })));

    // Primero la versión y la fecha; el estado al final: si algo falla antes,
    // el ATS no aparece como cerrado sin tener su cierre escrito.
    sheet.getRange(filas[0], 2, 1, 1).setValues(filaSegura_([[version]]));
    sheet.getRange(filas[0], 16, 1, 1).setValues(filaSegura_([[ahora]]));
    sheet.getRange(filas[0], C_ESTADO + 1, 1, 4).setValues(filaSegura_([['CERRADO', ahora, actual.cierre.nombre, actual.cierre.motivo]]));

    registrarEvento_(code, 'CERRAR', 'APLICADO', actual.cierre.motivo + ' · ' + actual.cierre.nombre +
                     (actual.cierre.pendientes.length ? ' · Pendientes al cerrar: ' + actual.cierre.pendientes.join('; ') : ''),
                     body.opId, version, '');
    return jsonOut_({ ok: true, code: code, version: version, estado: 'CERRADO' });
  } catch (err) {
    registrarEvento_(code, 'CERRAR', 'RECHAZADO', 'Error: ' + err.message, body.opId, '', '');
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ================= LECTURA ================= */

function leerAts_(code) {
  const sheet = getAtsSheet_();
  const rows = filasPorValor_(sheet, 1, code);
  if (!rows.length) return null;
  const f = sheet.getRange(rows[0], 1, 1, COLS_ATS.length).getValues()[0];
  const texto = reensamblar_(leerTrozos_(getDatosSheet_(), code))[code];
  if (!texto) return { fila: f, ats: null, error: 'El resumen existe pero el contenido no se encontró en la hoja "Datos".' };
  let ats;
  try { ats = JSON.parse(texto); } catch (e) { return { fila: f, ats: null, error: 'El contenido está incompleto o dañado.' }; }
  const firmas = reensamblar_(leerTrozos_(getFirmasSheet_(), code));
  // Referencias a firmas cuya imagen no está: se reportan aparte, porque al
  // rehidratar quedan como '' y se confundirían con "no firmó".
  const perdidas = (texto.match(/SIGREF:[0-9a-f]{12}/g) || [])
    .map(function (x) { return x.substring(7); })
    .filter(function (k) { return !firmas[k]; });
  return { fila: f, ats: rehidratarFirmas_(ats, firmas), perdidas: perdidas };
}

function doGet(e) {
  const p = e.parameter || {};
  if (!checkToken_(p.token)) return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });

  if (p.action === 'ping') return jsonOut_({ ok: true, servicio: 'ATS SSTA-F-007' });
  if (p.action === 'porCedula') {
    // La cédula vive en el JSON del ATS (hoja «Datos», en trozos); el resumen sale de la hoja «ATS».
    const k = String(p.cedula || '').replace(/\D/g, ''), dat = getDatosSheet_(), sh = getAtsSheet_(), out = [], codigos = {};
    filasConCedula_(dat, 3, k).forEach(function (n) { const f = dat.getRange(n, 1, 1, 3).getValues()[0], re = /"(cedula|cc)":"([^"]*)"/g; let m;
      while ((m = re.exec(String(f[2])))) if (m[2].replace(/\D/g, '') === k) { codigos[f[0]] = 1; break; } });
    const last = sh.getLastRow();
    if (last >= 2 && Object.keys(codigos).length) sh.getRange(2, 1, last - 1, COLS_ATS.length).getValues().forEach(function (f) { if (!codigos[f[0]]) return;
      out.push({ code: f[0], desde: f[2], hasta: f[3], area: f[5], trabajo: String(f[6] || '').slice(0, 160), estado: f[COLS_ATS.indexOf('estado')] || 'ABIERTO' }); });
    return jsonOut_({ ok: true, rows: out });
  }
  // v148: enlace para que cada participante firme desde SU celular, sin usuario (solo sirve para ESE ATS y para agregarse).
  if (p.action === 'enlaceFirma') return jsonOut_({ ok: true, code: texto_(p.code), clave: claveFirmaAts_(p.code) });

  // Un ATS completo (con firmas). También lo usa la cola sin señal para saber
  // si un envío pendiente ya llegó.
  if (p.code) {
    const res = leerAts_(p.code);
    if (!res) return jsonOut_({ ok: false, error: 'No existe un ATS con ese código.' });
    if (!res.ats) return jsonOut_({ ok: false, error: res.error });
    const r = resumir_(res.ats);
    return jsonOut_({ ok: true, code: p.code, version: res.fila[1], updatedAt: res.fila[15], ats: res.ats,
                      estado: esCerrado_(res.fila) ? 'CERRADO' : 'ABIERTO',
                      resumen: { tareas: r.tareas, peligros: r.peligros, participantes: r.participantes,
                                 firmasParticipantes: r.firmasParticipantes, firmasFinales: r.firmasFinales } });
  }

  // v150: peligros que aparecen en los ATS, agrupados por clase y subclase GTC 45, para cruzarlos con la matriz.
  if (p.action === 'peligrosResumen') {
    const sh = getPeligrosSheet_(), ult = sh.getLastRow(), grupos = {};
    if (ult >= 2) {
      const n = Math.min(ult - 1, 20000);
      sh.getRange(ult - n + 1, 1, n, 9).getValues().forEach(function (f) {
        const clase = texto_(f[6]), sub = texto_(f[7]);
        if (!clase) return;
        const k = clase + '|' + sub, g = grupos[k] = grupos[k] || { clase: clase, sub: sub, n: 0, ats: {}, areas: {}, ultimo: '', ejemplo: '' };
        g.n++; g.ats[f[0]] = 1; if (f[3]) g.areas[texto_(f[3])] = 1;
        const fe = f[1] instanceof Date ? Utilities.formatDate(f[1], 'America/Bogota', 'yyyy-MM-dd') : texto_(f[1]).slice(0, 10);
        if (fe > g.ultimo) g.ultimo = fe;
        if (!g.ejemplo) g.ejemplo = texto_(f[8]).slice(0, 140);
      });
    }
    return jsonOut_({ ok: true, rows: Object.keys(grupos).map(function (k) { const g = grupos[k]; return { clase: g.clase, sub: g.sub, veces: g.n, ats: Object.keys(g.ats).length, areas: Object.keys(g.areas).slice(0, 8), ultimo: g.ultimo, ejemplo: g.ejemplo }; }) });
  }

  // Listado liviano (sin contenido) de los ATS más recientes.
  if (p.list) {
    const sheet = getAtsSheet_();
    const last = sheet.getLastRow();
    const out = [];
    if (last >= 2) {
      sheet.getRange(2, 1, last - 1, COLS_ATS.length).getValues().forEach(function (f) {
        if (!f[0]) return;
        out.push({ code: f[0], version: f[1], fechaDesde: f[2], fechaHasta: f[3], centroCostos: f[4], area: f[5],
                   trabajo: texto_(f[6]).slice(0, 160), permisos: f[7], tareas: f[8], peligros: f[9],
                   participantes: f[10], firmasParticipantes: f[11], lider: f[12], updatedAt: f[15],
                   estado: esCerrado_(f) ? 'CERRADO' : 'ABIERTO', cerradoEn: f[C_CERRADO_EN],
                   cerradoPor: f[C_CERRADO_POR], motivoCierre: f[C_MOTIVO] });
      });
    }
    out.sort(function (a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
    return jsonOut_({ ok: true, rows: out.slice(0, 200) });
  }

  return jsonOut_({ ok: false, error: 'Acción no reconocida.' });
}

/* ================= MANTENIMIENTO (se ejecutan a mano) =================
   Sin guion bajo al final a propósito: así aparecen en el menú de funciones
   del editor de Apps Script.                                              */

/** Revisa todos los ATS guardados y deja el resultado en la hoja "Auditoria"
 *  y en un correo a quien la ejecuta. Busca: contenido perdido o dañado,
 *  firmas cuya imagen no llegó, participantes sin firma, tareas sin peligros
 *  y peligros sin controles marcados. */
function auditarIntegridad() {
  const sheet = getAtsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { console.log('No hay ATS guardados.'); return 'No hay ATS guardados.'; }
  const aud = hoja_('Auditoria', ['revisadoEl', 'atsCode', 'fecha', 'centroCostos', 'tareas', 'participantes', 'problemas']);
  const ahora = new Date(), filas = [], conProblemas = [];
  sheet.getRange(2, 1, last - 1, COLS_ATS.length).getValues().forEach(function (f) {
    const code = f[0];
    if (!code) return;
    const problemas = [];
    const res = leerAts_(code);
    if (!res || !res.ats) problemas.push(res ? res.error : 'no se pudo leer');
    else {
      const a = res.ats;
      if (res.perdidas.length) problemas.push(res.perdidas.length + ' firma(s) con la imagen perdida');
      (a.participantes || []).forEach(function (p, i) {
        const n = ((p.nombres || '') + ' ' + (p.apellidos || '')).trim() || ('participante ' + (i + 1));
        if (p.firma === null || p.firma === undefined) problemas.push(n + ' no firmó');
        if (p.tardio && !p.socializado) problemas.push(n + ' llegó después y no consta que se le socializó el ATS');
      });
      ['lider', 'jefe', 'sst'].forEach(function (k) {
        if (!a.firmas || !a.firmas[k] || a.firmas[k].firma === null || a.firmas[k].firma === undefined) problemas.push('falta la firma de ' + ({ lider: 'líder', jefe: 'jefe de área', sst: 'SSTA' })[k]);
      });
      (a.tareas || []).forEach(function (t, i) {
        if (!(t.peligros || []).length) problemas.push('la tarea ' + (i + 1) + ' no tiene peligros');
        (t.peligros || []).forEach(function (p) {
          const n = (p.ctrls || []).filter(function (c) { return c.on; }).length + (p.extra || []).length;
          if (!n && !t.rescate) problemas.push('tarea ' + (i + 1) + ': "' + (p.sub || p.id) + '" sin controles');
        });
      });
    }
    filas.push([ahora, code, f[2], f[4], f[8], f[10], problemas.length ? problemas.join(' · ') : 'OK']);
    if (problemas.length) conProblemas.push({ code: code, fecha: f[2], problemas: problemas });
  });
  if (filas.length) aud.getRange(aud.getLastRow() + 1, 1, filas.length, 7).setValues(filaSegura_(filas));

  const total = filas.length;
  let cuerpo = 'AUDITORÍA DE ATS\n' + Utilities.formatDate(ahora, 'America/Bogota', 'dd/MM/yyyy HH:mm') + '\n\n';
  cuerpo += 'ATS revisados: ' + total + '\nCon observaciones: ' + conProblemas.length + '\n\n';
  conProblemas.forEach(function (c) {
    cuerpo += c.code + '  ' + (c.fecha || '') + '\n';
    c.problemas.forEach(function (x) { cuerpo += '   - ' + x + '\n'; });
  });
  cuerpo += '\nEl detalle quedó en la hoja "Auditoria".\n';
  try { MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Auditoría de ATS — ' + conProblemas.length + ' con observaciones de ' + total, cuerpo); } catch (e) {}
  const resumen = total + ' ATS revisados · ' + conProblemas.length + ' con observaciones.';
  console.log(resumen);
  conProblemas.forEach(function (c) { console.log('  ' + c.code + ' → ' + c.problemas.join(' · ')); });
  return resumen;
}

/** Muestra en el registro de ejecución todo lo que se sabe de un ATS: su
 *  resumen, cada guardado de la bitácora y si el contenido y las firmas se
 *  pueden leer. Cambiar el código aquí y ejecutar. */
const CODIGO_A_INVESTIGAR = 'ATS-20260927-000000';
function investigarATS() {
  const code = CODIGO_A_INVESTIGAR;
  console.log('=== ' + code + ' ===');
  const res = leerAts_(code);
  if (!res) { console.log('No existe en la hoja "ATS".'); }
  else {
    const f = res.fila;
    console.log('Versión ' + f[1] + ' · ' + f[2] + (f[3] ? ' al ' + f[3] : '') + ' · ' + f[4] + ' · ' + f[5]);
    console.log('Trabajo: ' + f[6]);
    if (!res.ats) console.log('⚠️ ' + res.error);
    else {
      const r = resumir_(res.ats);
      if (res.perdidas.length) console.log('⚠️ ' + res.perdidas.length + ' firma(s) referenciadas cuya imagen no está en la hoja "Firmas".');
      console.log('Contenido legible: ' + r.tareas + ' tareas, ' + r.peligros + ' peligros, ' + r.participantes +
                  ' participantes (' + r.firmasParticipantes + ' con firma), ' + r.firmasFinales + '/3 firmas finales');
    }
  }
  const ev = getEventosSheet_();
  const filas = filasPorValor_(ev, 2, code).sort(function (a, b) { return a - b; });
  console.log('--- bitácora (' + filas.length + ' eventos) ---');
  filas.forEach(function (r) {
    const x = ev.getRange(r, 1, 1, 8).getValues()[0];
    console.log(Utilities.formatDate(new Date(x[0]), 'America/Bogota', 'dd/MM HH:mm:ss') + '  ' + x[2] + ' ' + x[3] + '  v' + x[6] + '  ' + x[4] + '  ' + x[7]);
  });
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
