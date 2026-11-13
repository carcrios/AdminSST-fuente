/* ============================================================
   simulador-apps-script.js — corre un backend .gs en Node, sin Google
   ------------------------------------------------------------
   Imita lo justo de SpreadsheetApp, LockService, ContentService, Utilities,
   MailApp y Session para ejecutar doPost/doGet de verdad y revisar qué
   queda escrito en cada hoja.

   Hace cumplir el límite REAL de Google Sheets: una celda con más de 50.000
   caracteres lanza el mismo error que en Google. Es el límite que hizo
   perder firmas en los permisos, así que aquí se prueba contra él.

   No reemplaza probar el despliegue real; atrapa antes de subir los errores
   de lógica (troceo, versiones, duplicados, auditoría).
   ============================================================ */
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
function crearEntorno(archivoGs, opciones) {
  opciones = opciones || {};
  const hojas = {};
  // Como Google Sheets: un texto "AAAA-MM-DD" escrito en una celda queda
  // guardado como FECHA y al leerlo vuelve un Date (medianoche local). Es
  // opcional para no cambiar las pruebas de los demás backends.
  // Un texto que empieza con ' se guarda como texto, sin el apóstrofo (como en Google).
  // Los textos que Google tomaría como fórmula (= + - @ sin ' delante) quedan anotados.
  const formulas = [];
  const comoSheets = (v) => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1)
    : (typeof v === 'string' && /^[=+\-@]/.test(v) && formulas.push(v) && false) ? v
    : (opciones.fechasComoSheets && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? new Date(v + 'T00:00:00') : v;
  const correos = [], cache = {};
  class Hoja {
    constructor(n) { this.nombre = n; this.filas = []; }
    _chk(v) { if (typeof v === 'string' && v.length > 50000) throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.'); }
    appendRow(r) { r.forEach((v) => this._chk(v)); this.filas.push(r.map(comoSheets)); }
    getLastRow() { return this.filas.length; }
    getLastColumn() { return Math.max(0, ...this.filas.map((f) => f.length)); }
    getDataRange() { return this.getRange(1, 1, this.filas.length, Math.max(1, ...this.filas.map((f) => f.length))); }
    setFrozenRows() {}
    protect() { const h = this; h.protegida = true; const p = { setDescription() { return p; }, removeEditors() { return p; }, getEditors: () => [], canDomainEdit: () => false, setDomainEdit() { return p; } }; return p; }
    deleteRows(inicio, n) { this.filas.splice(inicio - 1, n); }
    getRange(fila, col, nf = 1, nc = 1) {
      const h = this;
      return {
        getValues() { const out = []; for (let i = 0; i < nf; i++) { const r = h.filas[fila - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(r[col - 1 + j] === undefined ? '' : r[col - 1 + j]); out.push(o); } return out; },
        getValue() { return this.getValues()[0][0]; },
        setValue(v) { return this.setValues([[v]]); },
        setValues(v) { v.forEach((r, i) => { r.forEach((x) => h._chk(x)); const idx = fila - 1 + i; while (h.filas.length <= idx) h.filas.push([]); r.forEach((x, j) => { h.filas[idx][col - 1 + j] = comoSheets(x); }); }); return this; },
        createTextFinder(t) { let entire = false; const f = { matchEntireCell(b) { entire = b; return f; }, matchCase() { return f; },
          findAll() { const out = []; for (let i = 0; i < nf; i++) { const r = h.filas[fila - 1 + i] || []; const v = String(r[col - 1] === undefined ? '' : r[col - 1]); if (entire ? v === t : v.includes(t)) out.push({ getRow: () => fila + i }); } return out; } }; return f; }
      };
    }
  }
  const libros = {};   // id → { nombre, hojas } (SpreadsheetApp.create / openById)
  const nuevoLibro = (nombre, h, id) => {
    id = id || 'libro-' + (Object.keys(libros).length + 1);
    const lib = { id, nombre, hojas: h || {} };
    libros[id] = lib;
    return { getSheetByName: (n) => lib.hojas[n] || null, insertSheet: (n) => (lib.hojas[n] = new Hoja(n)), getSpreadsheetTimeZone: () => 'America/Bogota',
             getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id, getName: () => nombre, getSheets: () => Object.values(lib.hojas) };
  };
  const ss = nuevoLibro('activo', hojas, 'activo');
  const propiedades = {}, activadores = [], carpetas = [], archivos = {};
  // Drive: carpetas (con sus archivos) y archivos (bytes con signo, como en Java).
  const firmados = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
  const sinSigno = (arr) => Buffer.from(arr.map((b) => (b < 0 ? b + 256 : b)));
  const aBuffer = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : sinSigno(x));
  const nuevaCarpeta = (n, padre) => { const c = { id: 'carpeta-' + (carpetas.length + 1), nombre: n, padre, archivos: [] }; carpetas.push(c); return c; };
  const iterador = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
  const blob = (bytes, mime, nombre) => { const b = { _bytes: bytes, _mime: mime || 'application/octet-stream', _nombre: nombre || '',
    getBytes: () => bytes.slice(), getContentType: () => b._mime, getName: () => b._nombre, setName(n) { b._nombre = n; return b; }, getAs: (m) => blob(bytes.slice(), m, b._nombre.replace(/\.[^.]*$/, '') + '.pdf'), getDataAsString: () => sinSigno(bytes).toString('utf8') }; return b; };
  const nuevoArchivo = (nombre, mime, bytes, carpetaId) => { const id = 'archivo-' + (Object.keys(archivos).length + 1); archivos[id] = { id, nombre, mime, bytes, carpeta: carpetaId, papelera: false };
    const c = carpetas.find((x) => x.id === carpetaId); if (c) c.archivos.push(id); return id; };
  const archivoObj = (id) => {
    const a = archivos[id];
    const o = { getId: () => id,
      moveTo: (f) => { const c = carpetas.find((x) => x.id === f.getId()); if (c) c.archivos.push(id); if (a) a.carpeta = f.getId(); return o; },
      isTrashed: () => !!(a && a.papelera), setTrashed: (v) => { if (!a) throw new Error('No existe el archivo ' + id); a.papelera = !!v; return o; },
      getName: () => (a ? a.nombre : (libros[id] ? libros[id].nombre : id)), setName: (n) => { if (a) a.nombre = n; return o; },
      getBlob: () => { if (!a) throw new Error('No existe el archivo ' + id); return blob(a.bytes, a.mime, a.nombre); },
      getSize: () => (a ? a.bytes.length : 0), getUrl: () => 'https://drive.google.com/file/d/' + id, setSharing: (acc, perm) => { if (a) a.compartido = acc + ':' + perm; return o; }, _a: a,
      makeCopy: (n, carpeta) => { if (!a && !libros[id]) throw new Error('No existe el archivo ' + id); return archivoObj(nuevoArchivo(n, a ? a.mime : 'application/vnd.google-apps.spreadsheet', a ? a.bytes : [], carpeta.getId())); } };
    return o;
  };
  const carpetaObj = (c) => ({ getId: () => c.id, getName: () => c.nombre, isTrashed: () => !!c.papelera, setTrashed: (v) => { c.papelera = !!v; }, getUrl: () => 'https://drive.google.com/drive/folders/' + c.id, _c: c,
    createFolder: (n) => carpetaObj(nuevaCarpeta(n, c.id)),
    getFoldersByName: (n) => iterador(carpetas.filter((x) => x.padre === c.id && x.nombre === n).map(carpetaObj)),
    createFile: (b) => archivoObj(nuevoArchivo(b._nombre, b._mime, b._bytes, c.id)),
    getFiles: () => iterador(c.archivos.filter((id) => archivos[id] && !archivos[id].papelera).map(archivoObj)) });
  const ctx = {
    console: { log: (...a) => ctx._log.push(a.join(' ')), error: (...a) => ctx._log.push('ERROR ' + a.join(' ')), warn: (...a) => ctx._log.push(a.join(' ')) }, _log: [],
    SpreadsheetApp: { getActiveSpreadsheet: () => (opciones.sinLibroActivo ? null : ss), flush() {},
      create: (n) => nuevoLibro(n), openById: (id) => { if (!libros[id]) throw new Error('No existe el libro ' + id); return nuevoLibro(libros[id].nombre, libros[id].hojas, id); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in propiedades ? propiedades[k] : null), setProperty(k, v) { propiedades[k] = String(v); return this; },
      deleteProperty(k) { delete propiedades[k]; return this; }, getProperties: () => Object.assign({}, propiedades) }) },
    ScriptApp: { getProjectTriggers: () => activadores.slice(), deleteTrigger: (t) => { const i = activadores.indexOf(t); if (i >= 0) activadores.splice(i, 1); },
      newTrigger: (f) => { const t = { getHandlerFunction: () => f }; const b = { timeBased: () => b, everyDays: () => b, everyWeeks: () => b, atHour: () => b, everyHours: () => b, inTimezone: () => b, nearMinute: () => b, onWeekDay: () => b, create: () => { activadores.push(t); return t; } }; return b; },
      WeekDay: { SUNDAY: 'SUNDAY', MONDAY: 'MONDAY' },
      getService: () => ({ getUrl: () => opciones.urlServicio || null }) },
    DriveApp: {
      createFolder: (n) => carpetaObj(nuevaCarpeta(n, null)),
      getFolderById: (id) => { const c = carpetas.find((x) => x.id === id); if (!c) throw new Error('sin carpeta'); return carpetaObj(c); },
      getFileById: (id) => archivoObj(id), Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' } },
    // v163: candado como el de Apps Script: uno solo por script; pedirlo teniéndolo ya se cuenta (anidado) para que las
    // pruebas detecten que soltar el de adentro deja sin candado al de afuera.
    _candado: { tomado: false, anidado: 0, sueltosAdentro: 0 },
    LockService: { getScriptLock: () => { const c = ctx._candado; let mio = false; const tomar = () => { if (c.tomado) c.anidado++; c.tomado = true; mio = true; return true; };
      return { waitLock: tomar, tryLock: tomar, hasLock: () => mio, releaseLock() { mio = false; c.tomado = false; } }; } },
    ContentService: { MimeType: { JSON: 'json', ICAL: 'ical', TEXT: 'text' }, createTextOutput: (t) => ({ setMimeType() { return this; }, _t: t, getContent() { return t; } }) },
    Utilities: {
      DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'UTF-8' },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg === 'sha256' ? 'sha256' : 'md5').update(s, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      computeHmacSha256Signature: (v, k) => firmados(crypto.createHmac('sha256', aBuffer(k)).update(aBuffer(v)).digest()),
      getUuid: () => crypto.randomUUID(),
      base64Encode: (x) => aBuffer(x).toString('base64'),
      base64EncodeWebSafe: (x) => aBuffer(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: (t) => { if (!/^[A-Za-z0-9+/=\s]*$/.test(t)) throw new Error('Could not decode string.'); return firmados(Buffer.from(t, 'base64')); },
      base64DecodeWebSafe: (t) => firmados(Buffer.from(String(t).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      // v153: .zip real (método «store», sin comprimir) para poder abrirlo en las pruebas.
      zip: (blobs, nombre) => { const partes = [], central = []; let off = 0;
        const crc = (buf) => { let c, t = crc._t || (crc._t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let x = 0xFFFFFFFF; for (const b of buf) x = t[(x ^ b) & 0xFF] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
        blobs.forEach((b) => { const datos = sinSigno(b.getBytes()), n = Buffer.from(b.getName(), 'utf8'), c = crc(datos);
          const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt32LE(c, 14); h.writeUInt32LE(datos.length, 18); h.writeUInt32LE(datos.length, 22); h.writeUInt16LE(n.length, 26);
          const ce = Buffer.alloc(46); ce.writeUInt32LE(0x02014b50, 0); ce.writeUInt16LE(20, 4); ce.writeUInt16LE(20, 6); ce.writeUInt16LE(0x0800, 8); ce.writeUInt32LE(c, 16); ce.writeUInt32LE(datos.length, 20); ce.writeUInt32LE(datos.length, 24); ce.writeUInt16LE(n.length, 28); ce.writeUInt32LE(off, 42);
          partes.push(h, n, datos); central.push(ce, n); off += 30 + n.length + datos.length; });
        const cd = Buffer.concat(central), fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(blobs.length, 8); fin.writeUInt16LE(blobs.length, 10); fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(off, 16);
        return blob(firmados(Buffer.concat([...partes, cd, fin])), 'application/zip', nombre || 'archivo.zip'); },
      newBlob: (x, mime, nombre) => blob(typeof x === 'string' ? firmados(Buffer.from(x, 'utf8')) : x, mime, nombre),
      formatDate: (d, tz, f) => { const x = new Date(d); const p = (n) => String(n).padStart(2, '0'); return f.replace('yyyy', x.getFullYear()).replace('MM', p(x.getMonth() + 1)).replace('dd', p(x.getDate())).replace('HH', p(x.getHours())).replace('mm', p(x.getMinutes())).replace('ss', p(x.getSeconds())); }
    },
    MailApp: { sendEmail: (...a) => { if (ctx.__cuotaCorreo !== undefined) { if (ctx.__cuotaCorreo <= 0) throw new Error('Service invoked too many times for one day: email.'); ctx.__cuotaCorreo--; } correos.push(a); }, getRemainingDailyQuota: () => (ctx.__cuotaCorreo !== undefined ? ctx.__cuotaCorreo : 100) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'dueno@ejemplo.invalid' }), getScriptTimeZone: () => 'America/Bogota' },
    // v116: llamadas a otros servidores (la consola publica módulos y vigila a los clientes). La prueba pone ctx.__fetch(url, opciones) → { codigo, texto } o lanza.
    UrlFetchApp: {
      fetch: (url, op) => { const r = ctx.__fetch ? ctx.__fetch(url, op || {}) : { codigo: 404, texto: 'sin red' }; return { getContentText: () => r.texto, getResponseCode: () => r.codigo }; },
      fetchAll: (reqs) => reqs.map((q) => ctx.UrlFetchApp.fetch(q.url, q))
    },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache[k] || null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    Date, JSON, Math, String, Number, Array, Object, RegExp, parseInt, isNaN, Error
  };
  vm.createContext(ctx);
  // Uno o varios .gs (como los archivos de un mismo proyecto de Apps Script).
  (Array.isArray(archivoGs) ? archivoGs : [archivoGs]).forEach((f) => vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
  const post = (obj, ruta) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(obj) }, pathInfo: ruta })._t);
  const get = (params, ruta) => JSON.parse(ctx.doGet({ parameter: params, pathInfo: ruta })._t);
  return { ctx, formulas, hojas, libros, propiedades, activadores, carpetas, archivos, correos, post, get };
}
module.exports = { crearEntorno };
