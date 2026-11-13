/* ============================================================
   backend-asistencia.gs — Control de asistencia a capacitación, eventos y
   reuniones (SSTA-F-005) — Portal SSTA
   ------------------------------------------------------------
   El formato en papel es SEMANAL: una hoja por semana y lugar de trabajo,
   con el tema de la charla de cada día (hora, duración, ejecutor) y una fila
   por trabajador que firma en la columna de cada día que asistió.

   Aquí se guarda igual:
     · Hoja "Semanas": UNA FILA POR SEMANA (código, semana del/al, lugar,
       temas, cuántas charlas y asistentes). Es la hoja para consultar.
     · Hoja "Datos": la semana completa en JSON, troceada si pasa el límite
       de 50.000 caracteres por celda (mismo problema que tuvieron los
       permisos con las firmas).
     · Hoja "Firmas": las imágenes aparte, troceadas si hace falta.
     · Hoja "Asistencias": UNA FILA POR PERSONA POR CHARLA (fecha, tema,
       ejecutor, lugar, cédula, nombre, firmó). Sirve para indicadores de
       cobertura de capacitación sin abrir cada semana: quién asistió a
       qué, cuántas horas, qué temas se han dado.
     · Hoja "Eventos": bitácora inmutable de cada intento de escritura.
     · Idempotencia por opId: un reenvío desde la cola sin señal no duplica.

   VARIOS CELULARES A LA VEZ: cada guardado es de UN DÍA y se MEZCLA con lo
   que ya hay (no reemplaza la semana entera). Si dos personas toman firmas
   el mismo día en dos celulares, quedan las de los dos. Quitar a alguien es
   explícito (lista `quitar`), así un celular desactualizado no borra lo que
   agregó el otro.

   DESPLIEGUE: hoja de cálculo nueva → Extensiones → Apps Script → pegar este
   archivo → Implementar → Nueva implementación → Aplicación web → Ejecutar
   como: yo, Acceso: cualquier usuario → copiar la URL /exec en config.js
   (BACKENDS.asistencia.url).

   ACTUALIZAR SIN CAMBIAR LA URL: pegar este archivo encima del anterior →
   Implementar → Administrar implementaciones → ✏️ editar → Versión: "Nueva
   versión" → Implementar. (Una "Nueva implementación" da otra URL.)
   ============================================================ */

const API_TOKEN = 'PON-AQUI-EL-TOKEN'; // debe ser IDÉNTICO al del cliente (config.js)

/* ── CLAVE DEL PORTAL ──────────────────────────────────────────
   El API_TOKEN de arriba está escrito en config.js, que es PÚBLICO en
   GitHub. La clave del portal NO va en GitHub: se escribe AQUÍ, en el Apps
   Script (que solo ve quien lo administra), y cada celular la ingresa una vez.
   Mientras CLAVE_PORTAL diga ESCRIBE_AQUI…, este backend sigue aceptando el
   token de config.js. También se puede poner en Configuración del proyecto →
   Propiedades de la secuencia de comandos, con el nombre CLAVE_PORTAL. */
const CLAVE_PORTAL = 'ESCRIBE_AQUI_LA_CLAVE_DEL_PORTAL';

function claveConfigurada_() {
  let c = '';
  try { c = PropertiesService.getScriptProperties().getProperty('CLAVE_PORTAL') || ''; } catch (e) { c = ''; }
  if (!c && CLAVE_PORTAL && CLAVE_PORTAL.indexOf('ESCRIBE_AQUI') !== 0) c = CLAVE_PORTAL;
  return String(c).trim();
}
function checkToken_(token) {
  const clave = claveConfigurada_();
  if (clave) return String(token || '') === clave;
  return token === API_TOKEN;
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const SEMANAS_SHEET = 'Semanas';
const DATOS_SHEET = 'Datos';
const FIRMAS_SHEET = 'Firmas';
const ASISTENCIAS_SHEET = 'Asistencias';
const EVENTOS_SHEET = 'Eventos';
const COLS_SEMANAS = ['code', 'semanaDel', 'semanaAl', 'lugar', 'version', 'charlas', 'asistentes',
                      'firmas', 'temas', 'createdAt', 'updatedAt'];
const MAX_CHARS_CELDA = 32000;   // v142: tope de Excel (respaldo .xlsx)
const DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const NOMBRE_DIA = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' };

/* ================= LIBRO Y HOJAS ================= */

/* Si el script se creó desde la hoja (Extensiones → Apps Script) usa esa
   hoja. Si se creó suelto en script.google.com, crea un libro nuevo en el
   Drive de quien implementó y recuerda su id. */
function libro_() {
  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ASISTENCIA_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const nuevo = SpreadsheetApp.create('Asistencia a charlas - Portal SSTA');
  props.setProperty('ASISTENCIA_SHEET_ID', nuevo.getId());
  return nuevo;
}
/** Ejecutar a mano (▶ Ejecutar → verLibro): autoriza el script y muestra la URL de la hoja. */
function verLibro() {
  const ss = libro_();
  getSemanasSheet_(); getDatosSheet_(); getFirmasSheet_(); getAsistenciasSheet_(); getEventosSheet_();
  console.log('Hoja de asistencia: ' + ss.getUrl());
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
function getSemanasSheet_() { return hoja_(SEMANAS_SHEET, COLS_SEMANAS); }
function getDatosSheet_() { return hoja_(DATOS_SHEET, ['code', 'parte', 'texto', 'updatedAt']); }
function getFirmasSheet_() { return hoja_(FIRMAS_SHEET, ['code', 'sigKey', 'dataUrl', 'updatedAt']); }
function getAsistenciasSheet_() {
  return hoja_(ASISTENCIAS_SHEET, ['code', 'fecha', 'dia', 'tema', 'hora', 'duracion', 'ejecutor', 'lugar',
                                   'cedula', 'nombre', 'cargo', 'firmo', 'updatedAt']);
}
function getEventosSheet_() {
  return hoja_(EVENTOS_SHEET, ['ts', 'code', 'accion', 'resultado', 'detalle', 'opId', 'version', 'resumen']);
}

function filasPorValor_(sheet, columna, valor) {
  const last = sheet.getLastRow();
  if (last < 2 || !valor) return [];
  return sheet.getRange(2, columna, last - 1, 1)
    .createTextFinder(String(valor)).matchEntireCell(true).matchCase(true).findAll()
    .map(function (r) { return r.getRow(); });
}
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

/* ================= FECHAS =================
   Google Sheets convierte el texto "2026-09-28" en FECHA al escribirlo y al
   leerlo devuelve un Date. Toda fecha que se lee de la hoja pasa por aquí
   antes de compararla o devolverla (el mismo error dañó el anexo). */
function fechaISO_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    let tz = 'America/Bogota';
    try { tz = libro_().getSpreadsheetTimeZone() || tz; } catch (e) {}
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? '' : v).trim());
  return m ? m[1] : String(v == null ? '' : v).trim();
}
/** Suma días a una fecha "AAAA-MM-DD" sin pasar por zonas horarias. */
function sumarDias_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
/** Lunes de la semana de esa fecha. */
function lunesDe_(iso) {
  const p = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); // 0 = domingo
  return sumarDias_(iso, dow === 0 ? -6 : 1 - dow);
}
const esFecha_ = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); };

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
  const rows = filasPorValor_(sheet, 6, opId);
  for (let i = 0; i < rows.length; i++) {
    if (sheet.getRange(rows[i], 4).getValue() === 'APLICADO') return true;
  }
  return false;
}

/* ================= TROCEO Y FIRMAS ================= */

function trocear_(clave, texto) {
  if (texto.length <= MAX_CHARS_CELDA) return [{ key: clave, texto: texto }];
  const total = Math.ceil(texto.length / MAX_CHARS_CELDA), out = [];
  for (let i = 0; i < total; i++) out.push({ key: clave + '~' + (i + 1) + '/' + total, texto: texto.substr(i * MAX_CHARS_CELDA, MAX_CHARS_CELDA) });
  return out;
}
function reensamblar_(filas) {
  const mapa = {}, partes = {};
  filas.forEach(function (f) {
    const key = String(f.key), pos = key.indexOf('~');
    if (pos === -1) { mapa[key] = f.texto; return; }
    const base = key.substring(0, pos), n = parseInt(key.substring(pos + 1).split('/')[0], 10) || 1;
    (partes[base] = partes[base] || []).push({ n: n, texto: f.texto });
  });
  for (const base in partes) {
    partes[base].sort(function (a, b) { return a.n - b.n; });
    { const u = {}; partes[base].forEach(function (p) { u[p.n] = p.texto; }); mapa[base] = Object.keys(u).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return u[n]; }).join(''); }   // v144: trozos repetidos: vale el último
  }
  return mapa;
}
function leerTrozos_(sheet, code) {
  const rows = filasPorValor_(sheet, 1, code).sort(function (a, b) { return a - b; });
  if (!rows.length) return [];
  const minR = rows[0], maxR = rows[rows.length - 1];
  const vals = sheet.getRange(minR, 2, maxR - minR + 1, 2).getValues();
  return rows.map(function (r) { return { key: vals[r - minR][0], texto: vals[r - minR][1] }; });
}
function sigKeyFromDataUrl_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('').substring(0, 12);
}
/** Cambia cada firma (data:image…) por "SIGREF:xxxx" y la anota en mapaFirmas. */
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
      } else out[k] = extraerFirmas_(v, mapaFirmas);
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
function guardarFirmas_(code, mapaFirmas) {
  if (!mapaFirmas.length) return;
  const sheet = getFirmasSheet_(), existentes = {};
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

/* ================= LECTURA DE UNA SEMANA ================= */

function texto_(x) { return x == null ? '' : String(x); }
/** Clave de una persona: su cédula (solo dígitos y letras) o, sin cédula, su nombre. */
function clavePersona_(p) {
  const c = texto_(p && p.cedula).replace(/[^0-9A-Za-z]/g, '');
  return c ? 'C:' + c : 'N:' + sinTildes_(texto_(p && p.nombre)).trim().toUpperCase().replace(/\s+/g, ' ');
}
/** v148: «José» y «JOSE», «Tocancipá» y «Tocancipa» son lo mismo. */
function sinTildes_(s) { return texto_(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function normLugar_(s) { return sinTildes_(s).trim().toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

function filaSemana_(code) {
  const rows = filasPorValor_(getSemanasSheet_(), 1, code);
  return rows.length ? rows[0] : -1;
}
/** La semana tal como está guardada (con SIGREF, sin las imágenes). */
function leerDoc_(code) {
  const mapa = reensamblar_(leerTrozos_(getDatosSheet_(), code));
  if (!mapa.doc) return null;
  try { return JSON.parse(mapa.doc); } catch (e) { return null; }
}
function escribirDoc_(code, doc) {
  const sheet = getDatosSheet_();
  borrarFilasDe_(sheet, code);
  const ahora = new Date();
  const filas = trocear_('doc', JSON.stringify(doc)).map(function (t) { return [code, t.key, "'" + t.texto, ahora]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, 4).setValues(filaSegura_(filas));
}
function leerSemanaCompleta_(code) {
  const doc = leerDoc_(code);
  if (!doc) return null;
  return rehidratarFirmas_(doc, reensamblar_(leerTrozos_(getFirmasSheet_(), code)));
}

function resumen_(doc) {
  const personas = {};
  let charlas = 0, firmas = 0;
  const temas = [];
  DIAS.forEach(function (d) {
    const x = doc.dias && doc.dias[d];
    if (!x) return;
    if (texto_(x.tema).trim()) { charlas++; temas.push(NOMBRE_DIA[d] + ': ' + texto_(x.tema).trim()); }
    (x.asistentes || []).forEach(function (a) {
      personas[clavePersona_(a)] = true;
      if (a.firma) firmas++;
    });
  });
  return { charlas: charlas, asistentes: Object.keys(personas).length, firmas: firmas, temas: temas.join(' | ') };
}
function escribirResumen_(code, doc, fila) {
  const r = resumen_(doc), sheet = getSemanasSheet_();
  const valores = [code, doc.semanaDel, doc.semanaAl, doc.lugar, doc.version, r.charlas, r.asistentes, r.firmas,
                   r.temas.slice(0, 45000), doc.createdAt, doc.updatedAt];
  if (fila === -1) sheet.appendRow(filaSegura_(valores));
  else sheet.getRange(fila, 1, 1, valores.length).setValues(filaSegura_([valores]));
  return r;
}
/** Una fila por persona por charla, para indicadores. Se rehace la semana entera. */
function escribirAsistencias_(code, doc) {
  const sheet = getAsistenciasSheet_();
  borrarFilasDe_(sheet, code);
  const ahora = new Date(), filas = [];
  DIAS.forEach(function (d, i) {
    const x = doc.dias && doc.dias[d];
    if (!x) return;
    (x.asistentes || []).forEach(function (a) {
      filas.push([code, sumarDias_(doc.semanaDel, i), NOMBRE_DIA[d], texto_(x.tema), texto_(x.hora), texto_(x.duracion),
                  texto_(x.ejecutor), doc.lugar, texto_(a.cedula), texto_(a.nombre), texto_(a.cargo), a.firma ? 'SÍ' : 'NO', ahora]);
    });
  });
  if (filas.length) sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filaSegura_(filas));
}

/** Busca una semana con la misma fecha de inicio y el mismo lugar (así dos
 *  celulares que abren "la charla de hoy" en el mismo sitio caen en la MISMA
 *  hoja, no en dos). */
function buscarSemana_(semanaDel, lugar) {
  const sheet = getSemanasSheet_(), last = sheet.getLastRow();
  if (last < 2) return '';
  const vals = sheet.getRange(2, 1, last - 1, 4).getValues(), L = normLugar_(lugar);
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i][0] && fechaISO_(vals[i][1]) === semanaDel && normLugar_(vals[i][3]) === L) return String(vals[i][0]);
  }
  return '';
}
function genCode_(semanaDel) {
  return 'ASI-' + semanaDel.replace(/-/g, '') + '-' + String(Math.floor(Math.random() * 900000) + 100000);
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
    registrarEvento_(body.code || '', body.action || 'DESCONOCIDA', 'RECHAZADO', 'Token inválido', body.opId, '', '');
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  try { sellarFirmas_(body, ctxSello_(body, '', body.action || '')); } catch (e) { console.log('Sello: ' + e.message); }
  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(20000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    if (body.action === 'abrirSemana') return jsonOut_(abrirSemana_(body));
    if (body.action === 'guardarDia') return jsonOut_(guardarDia_(body));
    return jsonOut_({ ok: false, error: 'Esta opción no está disponible en esta versión. Cierra y vuelve a abrir el portal e inténtalo de nuevo.' });
  } catch (err) {
    registrarEvento_(body.code || '', body.action || '', 'ERROR', String(err && err.message || err), body.opId, '', '');
    return jsonOut_({ ok: false, error: 'No se pudo guardar. Tus datos siguen en este celular: inténtalo en unos minutos y, si se repite, avisa al líder SST. (Detalle: ' + (err && err.message || err) + ')' });
  } finally {
    lock.releaseLock();
  }
}

/** Crea la semana (o devuelve la que ya existe para esa fecha y lugar). */
function abrirSemana_(body) {
  const fecha = fechaISO_(body.fecha || body.semanaDel);
  const lugar = texto_(body.lugar).trim();
  if (!esFecha_(fecha)) return { ok: false, error: 'Falta la fecha.' };
  if (!lugar) return { ok: false, error: 'Falta el lugar de trabajo.' };
  const semanaDel = lunesDe_(fecha);
  const existente = buscarSemana_(semanaDel, lugar);
  if (existente) return { ok: true, code: existente, existia: true, semana: leerSemanaCompleta_(existente) };
  const ahora = new Date().toISOString();
  const code = genCode_(semanaDel);
  const doc = { code: code, semanaDel: semanaDel, semanaAl: sumarDias_(semanaDel, 6), lugar: lugar,
                dias: {}, version: 1, opIds: [], createdAt: ahora, updatedAt: ahora };
  escribirDoc_(code, doc);
  escribirResumen_(code, doc, -1);
  registrarEvento_(code, 'ABRIR_SEMANA', 'APLICADO', semanaDel + ' · ' + lugar, body.opId, 1, '');
  return { ok: true, code: code, existia: false, semana: doc };
}

/** Guarda UN día: tema, hora, duración, ejecutor y asistentes (se MEZCLAN
 *  con los que ya había; `quitar` saca a los indicados). */
function guardarDia_(body) {
  let code = texto_(body.code);
  const dia = texto_(body.dia);
  if (!code) return { ok: false, error: 'Falta el código de la semana.' };
  if (DIAS.indexOf(dia) === -1) return { ok: false, error: 'La fecha no corresponde a esta semana. Elige un día entre lunes y domingo.' };
  if (opIdYaAplicado_(body.opId)) {
    registrarEvento_(code, 'GUARDAR_DIA', 'DUPLICADO', 'opId ya aplicado', body.opId, '', '');
    return { ok: true, code: code, duplicado: true };
  }
  let fila = filaSemana_(code);
  let doc = fila === -1 ? null : leerDoc_(code);
  if (!doc) {
    // Sin señal el celular arma la semana con un código propio y guarda el
    // día en cola. Al llegar aquí: si ya existe una semana de ese lugar y esa
    // fecha (la abrió otro celular), el día se suma a ESA; si no, se crea.
    const semanaDel = esFecha_(fechaISO_(body.semanaDel)) ? lunesDe_(fechaISO_(body.semanaDel)) : '';
    const lugar = texto_(body.lugar).trim();
    if (!semanaDel || !lugar) {
      registrarEvento_(code, 'GUARDAR_DIA', 'RECHAZADO', 'Semana no encontrada y sin fecha/lugar para crearla', body.opId, '', '');
      return { ok: false, error: 'La semana ' + code + ' no existe en el servidor.' };
    }
    const existente = buscarSemana_(semanaDel, lugar);
    if (existente) {
      code = existente; fila = filaSemana_(code); doc = leerDoc_(code);
    } else {
      if (!/^ASI-\d{8}-\d{6}$/.test(code) || filaSemana_(code) !== -1) code = genCode_(semanaDel);
      const ahora = new Date().toISOString();
      doc = { code: code, semanaDel: semanaDel, semanaAl: sumarDias_(semanaDel, 6), lugar: lugar,
              dias: {}, version: 1, opIds: [], createdAt: ahora, updatedAt: ahora };
      registrarEvento_(code, 'ABRIR_SEMANA', 'APLICADO', semanaDel + ' · ' + lugar + ' (desde un guardado sin señal)', body.opId, 1, '');
      fila = -1;
    }
  }
  const mapaFirmas = [];
  const limpio = extraerFirmas_({ asistentes: Array.isArray(body.asistentes) ? body.asistentes : [] }, mapaFirmas);
  const previo = doc.dias[dia] || { tema: '', hora: '', duracion: '', ejecutor: '', asistentes: [] };
  const quitar = {}, quitados = [];
  (Array.isArray(body.quitar) ? body.quitar : []).forEach(function (k) { quitar[String(k)] = true; });
  // Mezcla: se conservan los que ya estaban (menos los que se pidió quitar) y
  // cada persona que llega reemplaza a la misma persona si ya estaba.
  const lista = [], indice = {};
  (previo.asistentes || []).forEach(function (a) {
    const k = clavePersona_(a);
    if (quitar[k]) { quitados.push({ nombre: a.nombre, cedula: a.cedula, firmo: !!a.firma, por: texto_(body.quien || body.verificador || ''), en: new Date().toISOString() }); return; }   // v148: queda rastro de quién se quitó
    indice[k] = lista.length; lista.push(a);
  });
  limpio.asistentes.forEach(function (a) {
    if (!texto_(a.nombre).trim()) return;
    const p = { nombre: texto_(a.nombre).trim(), cedula: texto_(a.cedula).trim(), cargo: texto_(a.cargo).trim(),
                firma: a.firma || '', hora: texto_(a.hora) };
    const k = clavePersona_(p);
    if (k in indice) {
      const ya = lista[indice[k]];
      // v148: dos personas sin cédula con el mismo nombre y firmas distintas: se guardan las dos.
      if (k.indexOf('N:') === 0 && p.firma && ya.firma && p.firma !== ya.firma) { lista.push(p); return; }
      // Si llega sin firma no se borra la que ya tenía.
      if (!p.firma) p.firma = ya.firma || '';
      lista[indice[k]] = p;
    } else { indice[k] = lista.length; lista.push(p); }
  });
  // v148: un celular con el día viejo (o en cola sin señal) no borra el tema, la hora ni el ejecutor que puso otro.
  const campo = function (k) { const n = Object.prototype.hasOwnProperty.call(body, k) ? texto_(body[k]).trim() : ''; return n || texto_(previo[k]); };
  doc.dias[dia] = { tema: campo('tema'), hora: campo('hora'), duracion: campo('duracion'), ejecutor: campo('ejecutor'),
                    ejecutorCedula: campo('ejecutorCedula'), ejecutorFirma: (String(body.ejecutorFirma || '').indexOf('data:image') === 0 ? body.ejecutorFirma : '') || previo.ejecutorFirma || '', asistentes: lista, quitados: (previo.quitados || []).concat(quitados).slice(-200) };
  if (texto_(body.lugar).trim() && normLugar_(body.lugar) !== normLugar_(doc.lugar)) doc.lugar = texto_(body.lugar).trim();
  doc.version = (Number(doc.version) || 1) + 1;
  doc.updatedAt = new Date().toISOString();
  doc.opIds = (doc.opIds || []).concat(body.opId ? [body.opId] : []).slice(-200);
  guardarFirmas_(code, mapaFirmas);
  escribirDoc_(code, doc);
  const r = escribirResumen_(code, doc, fila);
  escribirAsistencias_(code, doc);
  registrarEvento_(code, 'GUARDAR_DIA', 'APLICADO', NOMBRE_DIA[dia] + ': ' + doc.dias[dia].tema + ' · ' + lista.length + ' asistentes',
                   body.opId, doc.version, JSON.stringify(r).slice(0, 45000));
  return { ok: true, code: code, version: doc.version, dia: dia, asistentes: lista.length, resumen: r };
}

/* ================= LECTURA ================= */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!checkToken_(p.token)) return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });

  if (p.action === 'porCedula') {
    const k = String(p.cedula || '').replace(/\D/g, ''), sh = getSemanasSheet_(), out = [], cA = COLS_SEMANAS.indexOf('asistentes') + 1;
    filasConCedula_(sh, cA, k).forEach(function (n) { const f = sh.getRange(n, 1, 1, COLS_SEMANAS.length).getValues()[0]; if (!cedulaEnJson_(f[cA - 1], k)) return;
      let temas = ''; try { const t = JSON.parse(f[COLS_SEMANAS.indexOf('temas')] || '{}'); temas = Object.keys(t).map(function (d) { return t[d]; }).filter(Boolean).join(' · ').slice(0, 200); } catch (e) {}
      out.push({ code: f[0], del: f[1], al: f[2], lugar: f[3], temas: temas }); });
    return jsonOut_({ ok: true, rows: out });
  }
  if (p.list) {
    const sheet = getSemanasSheet_(), last = sheet.getLastRow(), rows = [];
    if (last >= 2) {
      sheet.getRange(2, 1, last - 1, COLS_SEMANAS.length).getValues().forEach(function (f) {
        if (!f[0]) return;
        rows.push({ code: f[0], semanaDel: fechaISO_(f[1]), semanaAl: fechaISO_(f[2]), lugar: f[3], version: f[4],
                    charlas: f[5], asistentes: f[6], firmas: f[7], temas: texto_(f[8]).slice(0, 400), updatedAt: f[10] });
      });
    }
    rows.sort(function (a, b) { return a.semanaDel < b.semanaDel ? 1 : a.semanaDel > b.semanaDel ? -1 : 0; });
    return jsonOut_({ ok: true, rows: rows.slice(0, Number(p.limite) || 60) });
  }

  if (p.code) {
    const semana = leerSemanaCompleta_(texto_(p.code));
    if (!semana) return jsonOut_({ ok: false, error: 'No encontramos esa semana. Revisa el código o créala de nuevo.' });
    return jsonOut_({ ok: true, code: semana.code, version: semana.version, semana: semana });
  }

  if (p.action === 'history' && p.clave) {
    const hojaEv = getEventosSheet_(), lastEv = hojaEv.getLastRow(), eventos = [];
    if (lastEv >= 2) {
      hojaEv.getRange(2, 1, lastEv - 1, 7).getValues().forEach(function (f) {
        if (f[1] === p.clave) eventos.push({ ts: f[0], accion: f[2], resultado: f[3], detalle: f[4], opId: f[5], version: f[6] });
      });
    }
    return jsonOut_({ ok: true, clave: p.clave, eventos: eventos });
  }
  return jsonOut_({ ok: false, error: 'Esta opción no está disponible en esta versión. Cierra y vuelve a abrir el portal e inténtalo de nuevo.' });
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
