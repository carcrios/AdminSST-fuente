/* ============================================================
   apps-script-navegador.js — El servidor del portal, corriendo en el navegador
   ------------------------------------------------------------
   Solo para la EMPRESA DEMO. Ejecuta el MISMO código del servidor único
   (servidor-unico/*.gs) con imitaciones de SpreadsheetApp, LockService,
   ContentService, etc. Las "hojas de cálculo" viven en memoria y se
   guardan en este equipo (IndexedDB). No sale nada a internet.

   Es la versión de navegador de pruebas/simulador-apps-script.js.
   ============================================================ */
(function () {
  'use strict';

  /* Las fechas "AAAA-MM-DD" escritas en una celda vuelven como Date, igual que en Google. */
  const comoSheets = (v) => (typeof v === 'string' && v.charAt(0) === "'") ? v.slice(1)
    : (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? new Date(v + 'T00:00:00') : v;

  // SHA-256 de verdad (como en Google): la huella de una firma debe coincidir con la del celular.
  function sha256(str) {
    const b = Array.from(new TextEncoder().encode(str)), K = [], H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let n = 2, c = 0; while (c < 64) { let p = true; for (let d = 2; d * d <= n; d++) if (n % d === 0) { p = false; break; } if (p) { K.push((Math.pow(n, 1 / 3) % 1) * 4294967296 | 0); c++; } n++; }
    const l = b.length * 8; b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (let i = 7; i >= 0; i--) b.push(Math.floor(l / Math.pow(2, i * 8)) & 255);
    const r = (x, y) => (x >>> y) | (x << (32 - y));
    for (let o = 0; o < b.length; o += 64) {
      const w = []; for (let i = 0; i < 16; i++) w[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, bb, cc, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) { const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & cc) ^ (bb & cc))) | 0; h = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = bb; bb = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    const out = []; H.forEach((x) => { for (let i = 3; i >= 0; i--) { const v = (x >>> (i * 8)) & 255; out.push(v > 127 ? v - 256 : v); } }); return out;
  }
  function hash16(s) {
    // 16 bytes estables por texto (en Google es MD5; aquí basta con que sea estable).
    const out = [];
    for (let k = 0; k < 4; k++) {
      let h = (0x811c9dc5 ^ (k * 0x9e3779b1)) >>> 0;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; h ^= h >>> 13; }
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
      for (let b = 0; b < 4; b++) { const x = (h >>> (b * 8)) & 255; out.push(x > 127 ? x - 256 : x); }
    }
    return out;
  }

  /* Bytes "con signo" (como los byte[] de Java que entrega Apps Script). */
  const firmados = (u8) => Array.from(u8, (b) => (b > 127 ? b - 256 : b));
  const sinSigno = (arr) => Uint8Array.from(arr, (b) => (b < 0 ? b + 256 : b));
  const utf8 = (t) => new TextEncoder().encode(String(t));
  const aBytes = (x) => (typeof x === 'string' ? utf8(x) : sinSigno(x));
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function desdeB64(t) { const s = atob(String(t).replace(/\s+/g, '')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }

  function crear(estadoInicial) {
    const estado = estadoInicial || { libros: {}, propiedades: {}, carpetas: [], activadores: [] };
    estado.libros = estado.libros || {}; estado.propiedades = estado.propiedades || {}; estado.carpetas = estado.carpetas || []; estado.activadores = estado.activadores || [];
    estado.archivos = estado.archivos || {};
    const correos = [];

    function Hoja(lib, nombre) {
      const filas = lib.hojas[nombre];
      const chk = (v) => { if (typeof v === 'string' && v.length > 50000) throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.'); };
      const h = {
        getName: () => nombre,
        appendRow(r) { r.forEach(chk); filas.push(r.map(comoSheets)); return h; },
        getLastRow: () => filas.length,
        getLastColumn: () => Math.max(0, ...filas.map((f) => f.length)),
        getDataRange() { return h.getRange(1, 1, Math.max(1, filas.length), Math.max(1, ...filas.map((f) => f.length))); },
        setFrozenRows() { return h; }, setColumnWidth() { return h; }, autoResizeColumns() { return h; }, hideColumns() { return h; },
        protect() { const p = { setDescription: () => p, removeEditors: () => p, getEditors: () => [], canDomainEdit: () => false, setDomainEdit: () => p }; return p; },
        deleteRows(i, n) { filas.splice(i - 1, n); },
        deleteRow(i) { filas.splice(i - 1, 1); },
        clear() { filas.length = 0; return h; },
        getRange(fila, col, nf, nc) {
          nf = nf || 1; nc = nc || 1;
          const r = {
            getValues() { const out = []; for (let i = 0; i < nf; i++) { const f = filas[fila - 1 + i] || []; const o = []; for (let j = 0; j < nc; j++) o.push(f[col - 1 + j] === undefined ? '' : f[col - 1 + j]); out.push(o); } return out; },
            getValue() { return r.getValues()[0][0]; },
            getDisplayValues() { return r.getValues().map((f) => f.map((v) => v instanceof Date ? v.toLocaleDateString('es-CO') : String(v))); },
            setValue(v) { return r.setValues([[v]]); },
            setValues(v) { v.forEach((row, i) => { row.forEach(chk); const idx = fila - 1 + i; while (filas.length <= idx) filas.push([]); row.forEach((x, j) => { filas[idx][col - 1 + j] = comoSheets(x); }); }); return r; },
            clearContent() { for (let i = 0; i < nf; i++) { const f = filas[fila - 1 + i]; if (f) for (let j = 0; j < nc; j++) f[col - 1 + j] = ''; } return r; },
            setFontWeight() { return r; }, setBackground() { return r; }, setNumberFormat() { return r; }, setWrap() { return r; },
            createTextFinder(t) {
              let entera = false;
              const f = { matchEntireCell(b) { entera = b; return f; }, matchCase() { return f; },
                findAll() { const out = []; for (let i = 0; i < nf; i++) { const x = filas[fila - 1 + i] || []; const v = String(x[col - 1] === undefined ? '' : x[col - 1]); if (entera ? v === t : v.indexOf(t) !== -1) out.push({ getRow: () => fila + i }); } return out; },
                findNext() { return f.findAll()[0] || null; } };
              return f;
            }
          };
          return r;
        }
      };
      return h;
    }
    function Libro(id) {
      const lib = estado.libros[id];
      return {
        getId: () => id, getName: () => lib.nombre, getUrl: () => '#demo-' + id,
        getSpreadsheetTimeZone: () => 'America/Bogota',
        getSheetByName: (n) => (lib.hojas[n] ? Hoja(lib, n) : null),
        insertSheet: (n) => { lib.hojas[n] = lib.hojas[n] || []; return Hoja(lib, n); },
        getSheets: () => Object.keys(lib.hojas).map((n) => Hoja(lib, n))
      };
    }
    /* Drive: carpetas y archivos (el contenido en base64, guardado con el resto). */
    const iterador = (l) => { let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; };
    const blob = (bytes, mime, nombre) => { const b = { _bytes: bytes, _mime: mime || 'application/octet-stream', _nombre: nombre || '',
      getBytes: () => bytes.slice(), getContentType: () => b._mime, getName: () => b._nombre, setName(n) { b._nombre = n; return b; },
      getDataAsString: () => new TextDecoder().decode(sinSigno(bytes)),
      getAs: () => { throw new Error('En la demo no se convierte a PDF'); } }; return b; };   // v153: el servidor deja el índice en HTML
    const nuevaCarpeta = (n, padre) => { const c = { id: nuevoId(), nombre: n, padre: padre || null, archivos: [] }; estado.carpetas.push(c); return c; };
    const nuevoArchivo = (nombre, mime, bytes, carpetaId) => { const id = nuevoId(); estado.archivos[id] = { nombre, mime, b64: b64(sinSigno(bytes)), carpeta: carpetaId, papelera: false };
      const c = estado.carpetas.find((x) => x.id === carpetaId); if (c) c.archivos.push(id); return id; };
    function Archivo(id) {
      const a = estado.archivos[id];
      const o = { getId: () => id,
        moveTo: (c) => { const x = estado.carpetas.find((k) => k.id === c.getId()); if (x) x.archivos.push(id); if (a) a.carpeta = c.getId(); return o; },
        isTrashed: () => !!(a && a.papelera), setTrashed: (v) => { if (a) a.papelera = !!v; return o; },
        getName: () => (a ? a.nombre : (estado.libros[id] ? estado.libros[id].nombre : id)), setName: (n) => { if (a) a.nombre = n; return o; },
        getBlob: () => { if (!a) throw new Error('No existe el archivo'); return blob(firmados(desdeB64(a.b64)), a.mime, a.nombre); },
        getSize: () => (a ? desdeB64(a.b64).length : 0), getUrl: () => '#demo-archivo-' + id, setSharing: () => o,
        // En la demo la copia de una hoja es una ficha (no se duplican los datos).
        makeCopy: (n, c) => Archivo(nuevoArchivo(n, 'application/vnd.google-apps.spreadsheet', [], c.getId())) };
      return o;
    }
    function Carpeta(c) {
      return { getId: () => c.id, getName: () => c.nombre, getUrl: () => '#demo-carpeta-' + c.id, isTrashed: () => !!c.papelera,
        createFolder: (n) => Carpeta(nuevaCarpeta(n, c.id)),
        getFoldersByName: (n) => iterador(estado.carpetas.filter((x) => x.padre === c.id && x.nombre === n).map(Carpeta)),
        createFile: (b) => Archivo(nuevoArchivo(b._nombre, b._mime, b._bytes, c.id)),
        getFiles: () => iterador(c.archivos.filter((id) => estado.archivos[id] && !estado.archivos[id].papelera).map(Archivo)) };
    }
    /* HMAC estable (en la demo basta con que sea estable y dependa de la llave). */
    const hmac = (v, k) => { const a = hash16(String(k) + '|' + (typeof v === 'string' ? v : v.join(','))), b = hash16(a.join(',') + '|' + k); return a.concat(b); };
    const nuevoId = () => 'demo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

    const G = {
      SpreadsheetApp: {
        getActiveSpreadsheet: () => null,
        flush() {},
        create: (n) => { const id = nuevoId(); estado.libros[id] = { nombre: n, hojas: {} }; return Libro(id); },
        openById: (id) => { if (!estado.libros[id]) throw new Error('No existe el libro ' + id); return Libro(id); }
      },
      PropertiesService: { getScriptProperties: () => {
        const p = estado.propiedades;
        const o = { getProperty: (k) => (Object.prototype.hasOwnProperty.call(p, k) ? p[k] : null), setProperty: (k, v) => { p[k] = String(v); return o; },
                    deleteProperty: (k) => { delete p[k]; return o; }, getProperties: () => Object.assign({}, p) };
        return o;
      } },
      LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {}, hasLock: () => true }) },
      // Caché vacía (en la demo no hay caché del servidor; las consultas externas, como novedades normativas, quedan «sin respuesta»).
      CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
      ContentService: { MimeType: { JSON: 'json', TEXT: 'text' }, createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return t; } }) },
      Utilities: {
        DigestAlgorithm: { MD5: 'md5', SHA_256: 'sha256' }, Charset: { UTF_8: 'UTF-8' },
        computeDigest: (alg, s) => (String(alg).indexOf('256') !== -1 && String(s).indexOf('data:image') === 0 ? sha256(String(s)) : hash16(String(s))),   // huella de firmas = SHA-256 real; lo demás como antes
        formatDate: (d, tz, f) => { const x = new Date(d); const p = (n) => String(n).padStart(2, '0');
          return f.replace('yyyy', x.getFullYear()).replace('MM', p(x.getMonth() + 1)).replace('dd', p(x.getDate())).replace('HH', p(x.getHours())).replace('mm', p(x.getMinutes())).replace('ss', p(x.getSeconds())); },
        getUuid: () => nuevoId() + '-' + Math.random().toString(36).slice(2),
        sleep() {},
        computeHmacSha256Signature: hmac,
        base64Encode: (x) => b64(aBytes(x)),
        base64EncodeWebSafe: (x) => b64(aBytes(x)).replace(/\+/g, '-').replace(/\//g, '_'),
        base64Decode: (t) => firmados(desdeB64(t)),
        base64DecodeWebSafe: (t) => firmados(desdeB64(String(t).replace(/-/g, '+').replace(/_/g, '/'))),
        newBlob: (x, mime, nombre) => blob(typeof x === 'string' ? firmados(utf8(x)) : x, mime, nombre),
        // v153: .zip real (sin comprimir) para el paquete del cliente
        zip: (blobs, nombre) => {
          const T = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
          const crc = (u) => { let x = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) x = T[(x ^ u[i]) & 0xFF] ^ (x >>> 8); return (x ^ 0xFFFFFFFF) >>> 0; };
          const partes = [], central = []; let off = 0;
          const w16 = (v) => [v & 255, (v >>> 8) & 255], w32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
          blobs.forEach((b) => { const d = sinSigno(b.getBytes()), n = utf8(b.getName()), c = crc(d);
            const h = [].concat(w32(0x04034b50), w16(20), w16(0x0800), w16(0), w16(0), w16(0), w32(c), w32(d.length), w32(d.length), w16(n.length), w16(0));
            const ce = [].concat(w32(0x02014b50), w16(20), w16(20), w16(0x0800), w16(0), w16(0), w16(0), w32(c), w32(d.length), w32(d.length), w16(n.length), w16(0), w16(0), w16(0), w16(0), w32(0), w32(off));
            partes.push(Uint8Array.from(h), n, d); central.push(Uint8Array.from(ce), n); off += h.length + n.length + d.length; });
          const cdLen = central.reduce((a, x) => a + x.length, 0), fin = Uint8Array.from([].concat(w32(0x06054b50), w16(0), w16(0), w16(blobs.length), w16(blobs.length), w32(cdLen), w32(off), w16(0)));
          const todo = partes.concat(central, [fin]), out = new Uint8Array(todo.reduce((a, x) => a + x.length, 0)); let i = 0; todo.forEach((x) => { out.set(x, i); i += x.length; });
          return blob(firmados(out), 'application/zip', nombre || 'archivo.zip');
        }
      },
      MailApp: { sendEmail: function () { correos.push([].slice.call(arguments)); }, getRemainingDailyQuota: () => 100 },
      // v116: en la demo no se llama a otros servidores (vigilancia y módulos de clientes responden «no respondió»).
      UrlFetchApp: { fetch: () => { throw new Error('en la demo no se llama a otros servidores'); }, fetchAll: (r) => r.map(() => null) },
      Session: { getEffectiveUser: () => ({ getEmail: () => 'demo@demo.invalid' }), getScriptTimeZone: () => 'America/Bogota' },
      ScriptApp: {
        getProjectTriggers: () => estado.activadores.map((f) => ({ getHandlerFunction: () => f })),
        deleteTrigger: (t) => { const i = estado.activadores.indexOf(t.getHandlerFunction()); if (i >= 0) estado.activadores.splice(i, 1); },
        newTrigger: (f) => { const b = { timeBased: () => b, everyDays: () => b, everyWeeks: () => b, atHour: () => b, everyHours: () => b, inTimezone: () => b, nearMinute: () => b, onWeekDay: () => b, create: () => { estado.activadores.push(f); return { getHandlerFunction: () => f }; } }; return b; },
        WeekDay: { SUNDAY: 'SUNDAY', MONDAY: 'MONDAY' },
        getService: () => ({ getUrl: () => 'demo' })
      },
      DriveApp: {
        createFolder: (n) => Carpeta(nuevaCarpeta(n, null)),
        getFolderById: (id) => { const c = estado.carpetas.find((k) => k.id === id); if (!c) throw new Error('sin carpeta'); return Carpeta(c); },
        getFileById: (id) => Archivo(id), Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' }
      }
    };
    return { G, estado, correos };
  }

  /* Carga el servidor único (los mismos .gs) dentro de una función con las imitaciones. */
  function cargar(fuentes, estadoInicial) {
    const { G, estado, correos } = crear(estadoInicial);
    const nombres = Object.keys(G);
    // correr(nombre): ejecuta una función de mantenimiento (como ▶ Ejecutar en el editor).
    const codigo = fuentes.join('\n\n') + '\n;return { doGet: doGet, doPost: doPost, instalar: instalar, verConfiguracion: verConfiguracion,' +
      ' correr: function (n) { const f = { sgsst__codigoAdministrador: typeof sgsst__codigoAdministrador === "function" ? sgsst__codigoAdministrador : null,' +
      ' sgsst__respaldoSemanal: typeof sgsst__respaldoSemanal === "function" ? sgsst__respaldoSemanal : null, sgsst__avisoDiario: typeof sgsst__avisoDiario === "function" ? sgsst__avisoDiario : null }[n];' +
      ' if (!f) throw new Error("Función desconocida: " + n); return f(); } };';
    // eslint-disable-next-line no-new-func
    const servidor = new Function(nombres.join(','), codigo).apply(null, nombres.map((n) => G[n]));
    return { servidor, estado, correos };
  }

  /* El estado se guarda con las fechas marcadas, para que vuelvan como Date. */
  function serializar(estado) {
    return JSON.stringify(estado, function (k, v) { const o = this[k]; return o instanceof Date ? { $fecha: o.toISOString() } : v; });
  }
  function revivir(texto) {
    return JSON.parse(texto, (k, v) => (v && typeof v === 'object' && typeof v.$fecha === 'string' && Object.keys(v).length === 1) ? new Date(v.$fecha) : v);
  }

  window.AppsScriptNavegador = { cargar, serializar, revivir };
})();
