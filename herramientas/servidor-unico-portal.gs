/* ============================================================
   00-Portal.gs — Servidor único del Portal SSTA para UNA empresa
   ------------------------------------------------------------
   Este proyecto de Apps Script tiene TODOS los módulos del portal
   (permisos, ATS, charlas, anexo, EPP). Cada módulo responde en
   <URL de la implementación>/<módulo>, por ejemplo .../exec/ats, y
   guarda en su propio libro de Google Sheets dentro de la carpeta
   "Portal SSTA - <empresa>" en el Drive de quien lo instala.

   PASOS (detalle en INSTALAR-NUEVA-EMPRESA.md):
     1. En 01-Empresa.gs escribe el nombre de la empresa y los correos de SST.
     2. ▶ Ejecutar → instalar   (autoriza con la cuenta de la empresa).
     3. Implementar → Nueva implementación → Aplicación web
        (Ejecutar como: Yo · Acceso: Cualquier usuario).
     4. ▶ Ejecutar → verConfiguracion  y copia lo que sale a empresa.js.

   Los datos quedan en la cuenta de Google de la empresa: nadie más
   (tampoco quien vende el portal) los ve, salvo que la empresa comparta
   la carpeta.
   ============================================================ */

// Los datos de la empresa (nombre, correos, WhatsApp de EPP) están en 01-Empresa.gs:
// así una actualización del portal puede reemplazar este archivo sin tocarlos.
const VERSION_PORTAL = 'v174';

/* ════════════════════════════════════════════════════════════
   De aquí para abajo no hace falta tocar nada.
   ════════════════════════════════════════════════════════════ */

function modulosPortal_() { return globalThis.MODULOS_PORTAL || {}; }

function doGet(e) { return despachar_(e, 'doGet'); }
function doPost(e) {
  // v110: una CONSULTA enviada por POST ({ __consulta: {…} }) se atiende igual que el
  // GET de siempre. Así la clave del portal y la sesión no viajan en la dirección
  // (que queda en registros); el sitio la usa solo si la raíz anuncia «consultaPost».
  const q = consultaPorPost_(e);
  if (q) return despachar_({ parameter: q, parameters: Object.keys(q).reduce(function (o, k) { o[k] = [q[k]]; return o; }, {}), pathInfo: e.pathInfo, queryString: '' }, 'doGet');
  return despachar_(e, 'doPost');
}
function consultaPorPost_(e) {
  try {
    const b = JSON.parse((e && e.postData && e.postData.contents) || '');
    if (!b || typeof b.__consulta !== 'object' || b.__consulta === null || Array.isArray(b.__consulta)) return null;
    const q = {};
    Object.keys(b.__consulta).slice(0, 40).forEach(function (k) { q[String(k).slice(0, 60)] = String(b.__consulta[k]).slice(0, 4000); });
    if (e && e.parameter && e.parameter.modulo) q.modulo = e.parameter.modulo;
    return q;
  } catch (err) { return null; }
}

function salidaJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function despachar_(e, metodo) {
  const ruta = String((e && e.pathInfo) || (e && e.parameter && e.parameter.modulo) || '').replace(/^\/+/, '').split('/')[0];
  const mods = modulosPortal_();
  if (!ruta) {
    if (metodo === 'doPost') { const pr = comandoProveedor_(e); if (pr) return salidaJson_(pr); }
    if (metodo === 'doPost') { const g = guardarPreguntaGuia_(e); if (g) return salidaJson_(g); }   // v173
    return salidaJson_({ ok: true, servicio: 'Portal SSTA', version: VERSION_PORTAL, empresa: nombreEmpresa_(), modulos: Object.keys(mods), correos: estadoCorreos_(),
                         capacidades: ['consultaPost', 'modulosProveedor', 'uso', 'guia'], apagados: modulosApagados_(), uso: usoResumen_(), guia: guiaResumen_(),
                         nota: 'Cada módulo responde en esta misma URL terminada en /<módulo>.' });
  }
  if (!mods[ruta]) return salidaJson_({ ok: false, error: 'Módulo desconocido: ' + ruta + '. Disponibles: ' + Object.keys(mods).join(', ') });
  e = tokenPublicoComoClave_(e);
  const apagado = moduloApagadoEn_(ruta, e, metodo);
  if (apagado) return salidaJson_(apagado);
  const sinSesion = exigirSesionObra_(ruta, e, metodo);
  if (sinSesion) return salidaJson_(sinSesion);
  if (metodo === 'doPost') contarUso_(ruta, e);
  try {
    const m = mods[ruta]();
    if (!m[metodo]) return salidaJson_({ ok: false, error: 'El módulo ' + ruta + ' no atiende ' + metodo });
    return m[metodo](e);
  } catch (err) {
    // TEMPORAL: los celulares conservan el registro en la cola y lo reenvían
    // (un bloqueo ocupado o un servicio de Google caído un momento no deben
    // hacer que un permiso firmado se descarte).
    console.error('[' + ruta + '] ' + (err && err.stack || err));
    return salidaJson_({ ok: false, codigoError: 'TEMPORAL', error: 'Error en el servidor (' + ruta + '): ' + (err && err.message || err) });
  }
}

/* ── Módulos contratados (v116) ──────────────────────────────────────────────
   Quien vende el portal apaga módulos desde su consola; su servidor se lo avisa a
   este con un mensaje firmado (HMAC-SHA256) con la LLAVE_PROVEEDOR que este servidor
   generó al instalarse (sale en verConfiguracion). Con un módulo apagado, este
   servidor no acepta registros nuevos de ese módulo (lo ya guardado se sigue leyendo).
   Sin mensajes del proveedor, todo queda prendido, como siempre. */
const MODULO_DE_TIPO_ = { trabajador: 'habilitacion', reporte: 'reportes', equipo: 'inspecciones', inspeccion: 'inspecciones', plantillainsp: 'inspecciones', proginsp: 'inspecciones',
  queja: 'convivencia', auditoria: 'auditorias', peligro: 'peligros', revmatriz: 'peligros', medicion: 'peligros', sustancia: 'quimicos', lugarquim: 'quimicos', gestquim: 'quimicos',
  emergencia: 'emergencias', simulacro: 'emergencias', plananual: 'plananual', cargo: 'salud', examen: 'salud', perfil: 'salud', sve: 'salud', psico: 'salud', ausencia: 'salud',
  politica: 'documental', legal: 'documental', documento: 'documental', cambio: 'documental', proveedor: 'proveedores', compraprov: 'proveedores', revision: 'revision', rendicion: 'revision',
  contratista: 'contratistas', ingreso: 'contratistas', eppcargo: 'dotacion', entrega: 'dotacion', induccion: 'induccion', programa: 'programas', pesv: 'pesv', vehiculo: 'pesv', conductor: 'pesv', siniestro: 'pesv',
  aspecto: 'ambiental', residuo: 'ambiental', consumo: 'ambiental', respel: 'ambiental', contextocal: 'calidad', riesgocal: 'calidad', objcal: 'calidad', pnc: 'calidad', encuesta: 'calidad', encuestacli: 'calidad', encresp: 'calidad',
  preop: 'preop', preopsalud: 'preop', cierremes: 'cierre', cliente: 'asesor',
  reintegro: 'salud', presupuesto: 'presupuesto', gasto: 'presupuesto' };   // v169
function llaveProveedor_() {
  const p = propiedades_();
  let k = p.getProperty('LLAVE_PROVEEDOR');
  if (!k) { k = aleatorio_(48); p.setProperty('LLAVE_PROVEEDOR', k); }
  return k;
}
function modulosApagados_() { try { const a = JSON.parse(propiedades_().getProperty('MODULOS_APAGADOS') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function cuerpoJson_(e) { try { return JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (err) { return null; } }
/* v169 · USO POR MÓDULO: cuántos registros se guardan en cada módulo cada mes (solo el número: ningún dato de
   las personas). La consola de quien vende el portal lo lee al revisar el servidor de cada cliente y así sabe qué
   usa cada empresa: qué mantener, a quién capacitar y qué plan ofrecerle. Se guardan los últimos 13 meses. */
function contarUso_(ruta, e) {
  try {
    const b = cuerpoJson_(e);
    if (!b || b.__consulta || b.__proveedor) return;
    const tipo = String(b.tipo || '').toLowerCase();
    let mod = (tipo && MODULO_DE_TIPO_[tipo]) || (ruta === 'sgsst' && tipo ? tipo : ruta);
    mod = String(mod).toLowerCase(); if (!/^[a-z0-9]{2,30}$/.test(mod)) return;
    const lock = LockService.getScriptLock(); if (!lock.tryLock(300)) return;   // si hay mucho movimiento, se pierde una cuenta, nunca un registro
    try {
      const pr = propiedades_(), mes = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM'), k = 'USO_' + mes;
      let u = {}; try { u = JSON.parse(pr.getProperty(k) || '{}'); } catch (x) { u = {}; }
      u[mod] = (Number(u[mod]) || 0) + 1;
      pr.setProperty(k, JSON.stringify(u));
      if (pr.getProperty('USO_ULTIMO_MES') !== mes) {   // al empezar mes, se borran los de hace más de 13 meses
        pr.setProperty('USO_ULTIMO_MES', mes);
        const tope = Utilities.formatDate(new Date(Date.now() - 400 * 86400000), 'America/Bogota', 'yyyy-MM');
        Object.keys(pr.getProperties()).filter(function (x) { return /^USO_\d{4}-\d{2}$/.test(x) && x.slice(4) < tope; }).forEach(function (x) { pr.deleteProperty(x); });
      }
    } finally { lock.releaseLock(); }
  } catch (err) { /* contar el uso nunca impide guardar */ }
}
/* v173 · Lo que la guía del portal no supo responder. Solo el texto de la pregunta (recortado), cuántas veces y
   cuándo fue la última: así quien vende el portal agrega esas respuestas. Sin nombre de quien pregunta. */
function guardarPreguntaGuia_(e) {
  const b = cuerpoJson_(e);
  if (!b || !b.__guia) return null;
  const t = String(b.__guia.texto || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (t.length < 4) return { ok: false, error: 'Pregunta vacía.' };
  const lock = LockService.getScriptLock(); if (!lock.tryLock(2000)) return { ok: false, codigoError: 'TEMPORAL', error: 'Ocupado, se reintenta.' };
  try {
    const pr = propiedades_(); let l = []; try { l = JSON.parse(pr.getProperty('GUIA_SIN_RESPUESTA') || '[]'); } catch (x) { l = []; }
    const k = t.toLowerCase(), hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'), x = l.filter(function (y) { return String(y.t).toLowerCase() === k; })[0];
    if (x) { x.n = (Number(x.n) || 0) + 1; x.u = hoy; } else l.push({ t: t, n: 1, u: hoy });
    l.sort(function (a, c) { return (c.u > a.u ? 1 : c.u < a.u ? -1 : 0) || c.n - a.n; });
    pr.setProperty('GUIA_SIN_RESPUESTA', JSON.stringify(l.slice(0, 60)));
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function guiaResumen_() {
  try { return JSON.parse(propiedades_().getProperty('GUIA_SIN_RESPUESTA') || '[]').slice(0, 40); } catch (err) { return []; }
}
/** { 'yyyy-MM': { módulo: registros } } de los últimos 3 meses. */
function usoResumen_() {
  try {
    const pr = propiedades_().getProperties(), out = {};
    Object.keys(pr).filter(function (k) { return /^USO_\d{4}-\d{2}$/.test(k); }).sort().slice(-3).forEach(function (k) { try { out[k.slice(4)] = JSON.parse(pr[k]); } catch (x) {} });
    return out;
  } catch (err) { return {}; }
}
/** Mensaje firmado de quien vende el portal: { __proveedor: { carga: '{"apagados":[…],"ts":…}', firma } }. */
function comandoProveedor_(e) {
  const b = cuerpoJson_(e);
  if (!b || !b.__proveedor) return null;
  const carga = String(b.__proveedor.carga || ''), firma = String(b.__proveedor.firma || '');
  const esperada = Utilities.base64Encode(Utilities.computeHmacSha256Signature(carga, llaveProveedor_()));
  if (!carga || firma.length !== esperada.length || firma !== esperada) return { ok: false, codigoError: 'FIRMA', error: 'Firma del proveedor inválida.' };
  let c; try { c = JSON.parse(carga); } catch (err) { return { ok: false, error: 'Mensaje ilegible.' }; }
  if (!c || !Array.isArray(c.apagados) || !(Math.abs(Date.now() - Number(c.ts)) < 15 * 60000)) return { ok: false, error: 'Mensaje vencido o incompleto.' };
  const ultimo = Number(propiedades_().getProperty('MODULOS_TS') || 0);
  if (Number(c.ts) <= ultimo) return { ok: false, error: 'Mensaje repetido.' };
  const ap = c.apagados.map(String).filter(function (x) { return /^[a-z0-9]{2,30}$/.test(x); }).slice(0, 80).sort();
  propiedades_().setProperty('MODULOS_APAGADOS', JSON.stringify(ap));
  propiedades_().setProperty('MODULOS_TS', String(Number(c.ts)));
  return { ok: true, apagados: ap };
}
/** ¿La petición es para escribir en un módulo apagado? */
function moduloApagadoEn_(ruta, e, metodo) {
  const ap = modulosApagados_();
  if (!ap.length || metodo !== 'doPost') return null;
  const no = function (m) { return { ok: false, codigoError: 'MODULO', error: 'El módulo «' + m + '» no está contratado para esta empresa.' }; };
  if (OBRA_PORTAL.indexOf(ruta) !== -1) return ap.indexOf(ruta) !== -1 ? no(ruta) : null;
  if (ruta !== 'sgsst') return null;
  const b = cuerpoJson_(e) || {};
  const tipos = [b.tipo].concat(Array.isArray(b.items) ? b.items.map(function (x) { return x && x.tipo; }) : []).filter(Boolean);
  for (let i = 0; i < tipos.length; i++) { const m = MODULO_DE_TIPO_[String(tipos[i])]; if (m && ap.indexOf(m) !== -1) return no(m); }
  return null;
}

/* ── Con usuarios, no se pide la clave del portal en cada celular (v123) ──────
   La clave del portal protegía los datos cuando todos entraban igual. Con usuarios con
   nombre, cada lectura y cada cambio ya exige su sesión (y lo público —preoperacional y
   reportes— es público a propósito). Entonces el token del sitio vale como la clave: los
   celulares no la piden. Sin usuarios activos, la clave sigue siendo obligatoria. */
function usuariosActivos_() {
  let cache = null; try { cache = CacheService.getScriptCache(); const v = cache.get('portal.usuariosActivos'); if (v) return v === '1'; } catch (err) {}
  const mods = modulosPortal_();
  let r = false;
  if (mods.sgsst && propiedades_().getProperty('sgsst.LIBRO')) { try { r = !!(mods.sgsst().funciones.revisarSesionObra('') || {}).modo; } catch (err) { r = false; } }
  try { if (cache) cache.put('portal.usuariosActivos', r ? '1' : '0', 600); } catch (err) {}
  return r;
}
function tokenPublicoComoClave_(e) {
  const p = propiedades_(), clave = p.getProperty('CLAVE_PORTAL'), api = p.getProperty('API_TOKEN');
  if (!clave || !api || !e) return e;
  const par = e.parameter || {};
  let body = null; try { body = JSON.parse((e.postData && e.postData.contents) || ''); } catch (err) { body = null; }
  const enGet = par.token === api, enPost = !!(body && typeof body === 'object' && body.token === api);
  if (!enGet && !enPost) return e;
  if (!usuariosActivos_()) return e;
  const nuevo = {}; Object.keys(e).forEach(function (k) { nuevo[k] = e[k]; });
  if (enGet) { nuevo.parameter = {}; Object.keys(par).forEach(function (k) { nuevo.parameter[k] = par[k]; }); nuevo.parameter.token = clave; }
  if (enPost) { body.token = clave; nuevo.postData = { contents: JSON.stringify(body), type: (e.postData && e.postData.type) || 'text/plain', length: 0, name: 'postData' }; }
  return nuevo;
}

/* ── Lo de la obra pide usuario (v112) ──────────────────────────────────────
   Desde v111 el sitio solo deja sin contraseña los preoperacionales y los reportes
   (los atiende el módulo sgsst). Los permisos, el ATS, las charlas, la inspección de
   EPP y el personal autorizado piden entrar. Aquí el SERVIDOR también lo exige: si la
   empresa usa usuarios, una petición a esos módulos sin una sesión válida se rechaza
   con codigoError 'SESION' (el celular conserva lo que tenía en cola y pide entrar).
   Sin usuarios activos, todo sigue como antes (solo con la clave del portal). */
const OBRA_PORTAL = ['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'asistencia', 'epp', 'personal'];
function sesionDePeticion_(e) {
  const p = (e && e.parameter) || {};
  if (p.sesion) return String(p.sesion);
  try { const b = JSON.parse((e && e.postData && e.postData.contents) || ''); if (b && b.sesion) return String(b.sesion); } catch (err) {}
  return '';
}
function claveFirmaEnlace_(code) {
  const pr = PropertiesService.getScriptProperties();   // el módulo ATS la guarda con su prefijo: «ats.FIRMA_ENLACE»
  let sec = pr.getProperty('ats.FIRMA_ENLACE'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('ats.FIRMA_ENLACE', sec); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('ats:' + String(code || ''), sec)).slice(0, 22);
}
function exigirSesionObra_(ruta, e, metodo) {
  if (OBRA_PORTAL.indexOf(ruta) === -1) return null;
  const mods = modulosPortal_();
  if (!mods.sgsst) return null;                          // instalación sin el SG-SST: no hay usuarios
  if (!propiedades_().getProperty('sgsst.LIBRO')) return null;   // el SG-SST aún no tiene libro: tampoco hay usuarios (y no se crea uno de paso)
  let r;
  try { r = mods.sgsst().funciones.revisarSesionObra(sesionDePeticion_(e)); }
  catch (err) { console.error('[sesión ' + ruta + '] ' + (err && err.stack || err)); return { ok: false, codigoError: 'TEMPORAL', error: 'No se pudo revisar la sesión: ' + (err && err.message || err) }; }
  if (!r || !r.modo) return null;
  // v148: el participante de un ATS firma con el enlace del supervisor (clave del ATS), sin usuario: solo se puede agregar a ESE ATS.
  if (ruta === 'ats' && (r.error || !r.rol)) {
    try {
      if (metodo === 'doPost') { const b = JSON.parse((e.postData && e.postData.contents) || '{}');
        if (b.action === 'agregarParticipantes' && b.clave && String(b.clave) === claveFirmaEnlace_(b.code)) return null; }
      else { const q = e.parameter || {}; if (q.code && q.k && !q.action && String(q.k) === claveFirmaEnlace_(q.code)) return null; }
    } catch (err) {}
  }
  if (r.error) return r.error;
  // v145: «Solo consulta» y el comité ven, pero no crean, editan ni borran permisos, ATS, charlas, EPP ni personal.
  if (metodo === 'doPost' && (r.rol === 'consulta' || r.rol === 'comite')) return { ok: false, codigoError: 'PERMISO', error: 'Tu usuario es de consulta: puede ver, pero no guardar ni borrar aquí.' };
  return null;
}

/* ── Correos con cuota (v110) ──────────────────────────────────────────────
   Google limita los correos que un proyecto puede mandar al día, y el tope es
   bastante más bajo en una cuenta Gmail gratuita que en Google Workspace. Todos
   los módulos mandan por aquí: antes de enviar se mira cuánto queda.
     · Sin cupo: no se intenta (MailApp lanzaría un error y cortaría el aviso
       diario a mitad de camino) y queda anotado.
     · Con poco cupo: se guardan los últimos CORREO_RESERVA para lo urgente
       (accidente reportado, integridad o respaldo con errores).
   Lo anotado se ve en 🩺 Estado y en la respuesta de la URL del servidor. */
const CORREO_RESERVA = 5;
function correoUrgente_(asunto) { return /accidente|integridad|respaldo/i.test(String(asunto || '')); }
function cuotaCorreo_() { try { return MailApp.getRemainingDailyQuota(); } catch (e) { return null; } }
function hoyPortal_() {
  let tz = 'America/Bogota'; try { tz = Session.getScriptTimeZone() || tz; } catch (e) {}
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}
function anotarCorreoSinCuota_(asunto, quedan) {
  const p = propiedades_(), hoy = hoyPortal_();
  let r = {}; try { r = JSON.parse(p.getProperty('CORREOS_SIN_CUOTA') || '{}'); } catch (e) {}
  if (r.fecha !== hoy) r = { fecha: hoy, n: 0, asuntos: [] };
  r.n++; r.quedan = quedan;
  if (r.asuntos.length < 10) r.asuntos.push(String(asunto || '').slice(0, 90));
  p.setProperty('CORREOS_SIN_CUOTA', JSON.stringify(r));
  console.warn('Correo NO enviado por cuota diaria (' + quedan + ' disponibles): ' + asunto);
}
function estadoCorreos_() {
  let r = {}; try { r = JSON.parse(propiedades_().getProperty('CORREOS_SIN_CUOTA') || '{}'); } catch (e) {}
  return { quedanHoy: cuotaCorreo_(), sinEnviarHoy: r.fecha === hoyPortal_() ? r.n : 0, asuntosSinEnviar: r.fecha === hoyPortal_() ? r.asuntos : [] };
}
const MailAppConCuota = {
  sendEmail: function () {
    const a = arguments, asunto = (a[0] && typeof a[0] === 'object') ? a[0].subject : a[1];
    const quedan = cuotaCorreo_();
    if (quedan !== null && (quedan <= 0 || (quedan <= CORREO_RESERVA && !correoUrgente_(asunto)))) { anotarCorreoSinCuota_(asunto, quedan); return null; }
    return MailApp.sendEmail.apply(MailApp, a);
  },
  getRemainingDailyQuota: function () { return cuotaCorreo_(); }
};

/* ── Lo que comparten todos los módulos ── */
function propiedades_() { return PropertiesService.getScriptProperties(); }
function nombreEmpresa_() {
  return propiedades_().getProperty('EMPRESA') || (EMPRESA_NOMBRE.indexOf('ESCRIBE') === 0 ? 'Empresa' : EMPRESA_NOMBRE);
}
function tokenPortal_() {
  // Mientras no se haya ejecutado instalar(), un valor que nadie conoce.
  return propiedades_().getProperty('API_TOKEN') || 'SIN-INSTALAR-' + Math.random();
}
function correosPortal_() {
  // Se leen del archivo (arriba); si allí siguen los de ejemplo (por ejemplo, después de pegar
  // un archivo nuevo para actualizar), se usan los que guardó instalar().
  const delArchivo = CORREOS_SSTA.join(',').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x && x.indexOf('@empresa.com') === -1; });
  if (delArchivo.length) return delArchivo;
  return String(propiedades_().getProperty('CORREOS') || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}
/** v119: a quién se manda la foto de un EPP en mal estado (archivo o, si está de ejemplo, lo guardado). */
function contactoEpp_() {
  const c = CONTACTO_EPP || {};
  if (c.whatsapp || (c.nombre && c.nombre !== 'Responsable de SST')) return c;
  try { const g = JSON.parse(propiedades_().getProperty('CONTACTO_EPP') || 'null'); if (g) return g; } catch (e) {}
  return c;
}

/* Cada módulo ve su propio SpreadsheetApp/PropertiesService/ScriptApp:
   - getActiveSpreadsheet() es SU libro (se crea la primera vez).
   - Sus propiedades llevan el prefijo del módulo, salvo la clave y el token,
     que son de todo el portal.
   - Sus activadores llevan el prefijo del módulo (ver funciones modulo__x). */
function entornoModulo_(mod, nombreLibro) {
  const props = propiedades_();
  const GLOBAL = { CLAVE_PORTAL: true, API_TOKEN: true };
  const k = function (c) { return GLOBAL[c] ? c : mod + '.' + c; };
  let libroCache = null;
  function libro() {
    if (libroCache) return libroCache;
    const id = props.getProperty(mod + '.LIBRO');
    if (id) {
      // Si el libro existe pero no abre (Google caído un momento), se reporta el
      // error y NUNCA se crea otro: eso dejaría los datos viejos por fuera.
      // v151: la revisión de la papelera (una llamada a Drive, lenta) se hace máximo una vez cada 10 minutos.
      let enPapelera = false;
      const cache = CacheService.getScriptCache(), ck = 'papelera.' + id;
      if (!cache.get(ck)) {
        try { enPapelera = DriveApp.getFileById(id).isTrashed(); } catch (e) { /* sin permiso de Drive: se sigue */ }
        if (!enPapelera) try { cache.put(ck, '1', 600); } catch (e) {}
      }
      if (enPapelera) throw new Error('El libro de "' + nombreLibro + '" está en la papelera de Google Drive. Restáuralo (Drive → Papelera → Restaurar).');
      libroCache = SpreadsheetApp.openById(id);
      return libroCache;
    }
    libroCache = SpreadsheetApp.create('Portal SSTA - ' + nombreEmpresa_() + ' - ' + nombreLibro);
    props.setProperty(mod + '.LIBRO', libroCache.getId());
    try { DriveApp.getFileById(libroCache.getId()).moveTo(carpeta_()); } catch (e) { /* sin permiso de Drive: queda en la raíz */ }
    return libroCache;
  }
  const propsModulo = {
    getProperty: function (c) { return props.getProperty(k(c)); },
    setProperty: function (c, v) { props.setProperty(k(c), v); return propsModulo; },
    deleteProperty: function (c) { props.deleteProperty(k(c)); return propsModulo; }
  };
  const envolver = function (t) { return { getHandlerFunction: function () { return String(t.getHandlerFunction()).replace(mod + '__', ''); }, __t: t }; };
  return {
    libro: libro,
    MailApp: MailAppConCuota,
    SpreadsheetApp: {
      getActiveSpreadsheet: libro,
      getActive: libro,
      openById: function (id) { return SpreadsheetApp.openById(id); },
      create: function (n) { return SpreadsheetApp.create(n); },
      flush: function () { return SpreadsheetApp.flush(); }
    },
    PropertiesService: { getScriptProperties: function () { return propsModulo; } },
    ScriptApp: {
      newTrigger: function (f) { return ScriptApp.newTrigger(mod + '__' + f); },
      getProjectTriggers: function () {
        return ScriptApp.getProjectTriggers().filter(function (t) { return String(t.getHandlerFunction()).indexOf(mod + '__') === 0; }).map(envolver);
      },
      deleteTrigger: function (t) { return ScriptApp.deleteTrigger(t && t.__t ? t.__t : t); },
      WeekDay: ScriptApp.WeekDay,
      getService: function () { return ScriptApp.getService(); }
    }
  };
}

/* Los libros de todos los módulos (el respaldo semanal los copia todos). */
function librosDelPortal_() {
  const p = propiedades_();
  return Object.keys(modulosPortal_()).map(function (m) { return p.getProperty(m + '.LIBRO'); }).filter(Boolean);
}

function carpeta_() {
  const props = propiedades_();
  const id = props.getProperty('CARPETA');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const c = DriveApp.createFolder('Portal SSTA - ' + nombreEmpresa_());
  props.setProperty('CARPETA', c.getId());
  return c;
}

function aleatorio_(n, alfabeto) {
  const a = alfabeto || 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += a.charAt(Math.floor(Math.random() * a.length));
  return s;
}

/** ▶ PASO 2. Crea la carpeta, un libro por módulo, la clave del portal y
 *  el token. Se puede volver a ejecutar: no borra ni cambia lo que ya existe. */
function instalar() {
  const p = propiedades_();
  if (EMPRESA_NOMBRE.indexOf('ESCRIBE') !== 0) p.setProperty('EMPRESA', EMPRESA_NOMBRE);
  // v119: también quedan guardados los correos y el contacto: al actualizar pegando el archivo nuevo no se pierden.
  const cs = CORREOS_SSTA.filter(function (x) { return x && String(x).indexOf('@empresa.com') === -1; });
  if (cs.length) p.setProperty('CORREOS', cs.join(','));
  if (CONTACTO_EPP && (CONTACTO_EPP.whatsapp || CONTACTO_EPP.nombre !== 'Responsable de SST')) p.setProperty('CONTACTO_EPP', JSON.stringify(CONTACTO_EPP));
  if (!p.getProperty('API_TOKEN')) p.setProperty('API_TOKEN', aleatorio_(40));
  // Clave corta y fácil de dictar por teléfono (sin 0/O ni 1/l).
  if (!p.getProperty('CLAVE_PORTAL')) p.setProperty('CLAVE_PORTAL', aleatorio_(4, 'ABCDEFGHJKMNPQRSTUVWXYZ') + '-' + aleatorio_(4, '23456789'));
  const mods = modulosPortal_();
  Object.keys(mods).forEach(function (m) { mods[m]().libro(); });
  // Aviso diario del SG-SST por correo (vencimientos, FURAT, investigaciones, acciones).
  if (mods.sgsst) { try { mods.sgsst().funciones.instalarAvisosDiarios(); } catch (e) { console.log('⚠ No se pudo programar el aviso diario del SG-SST: ' + e.message); } }
  // Respaldo semanal de TODOS los libros (domingos, 2 a. m.) y bitácora protegida.
  if (mods.sgsst) { try { mods.sgsst().funciones.instalarRespaldo(true); } catch (e) { console.log('⚠ No se pudo programar el respaldo semanal: ' + e.message); } }
  console.log('✅ Instalado para ' + nombreEmpresa_() + ': ' + Object.keys(mods).length + ' módulos, cada uno con su libro en la carpeta "Portal SSTA - ' + nombreEmpresa_() + '".');
  verConfiguracion();
}

/** ▶ PASO 4. Muestra lo que va en empresa.js y la clave para los celulares. */
function verConfiguracion() {
  const p = propiedades_();
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  const lineas = [
    '────────── Copia esto en empresa.js ──────────',
    "  servidor: '" + (url || 'PRIMERO IMPLEMENTA COMO APLICACIÓN WEB Y VUELVE A EJECUTAR verConfiguracion') + "',",
    "  apiToken: '" + (p.getProperty('API_TOKEN') || 'EJECUTA PRIMERO instalar') + "',",
    "  clave: '" + (p.getProperty('CLAVE_PORTAL') || '') + "',",
    "  llaveProveedor: '" + llaveProveedor_() + "',",
    "  scriptId: '" + (function () { try { return ScriptApp.getScriptId(); } catch (e) { return ''; } })() + "',",
    '───────────────────────────────────────────────',
    '(Las líneas clave, llaveProveedor y scriptId son para la consola de quien instala el portal: no van en empresa.js.)',
    (url && !/\/exec$/.test(url) ? '⚠ Esa URL no termina en /exec: usa la de Implementar → Gestionar implementaciones (Aplicación web).\n' : '') +
    'Clave del portal para cada celular (botón 🔑 Clave): ' + (p.getProperty('CLAVE_PORTAL') || 'EJECUTA PRIMERO instalar'),
    'Correos de avisos: ' + (correosPortal_().join(', ') || '⚠ ninguno (escríbelos en CORREOS_SSTA, en 01-Empresa)'),
    'Usuarios con nombre (opcional): ▶ sgsst__codigoAdministrador y en el portal → Usuarios.',
    'WhatsApp para fotos de EPP: ' + (contactoEpp_().nombre || '—') + ' ' + (contactoEpp_().whatsapp || '')
  ];
  const mods = modulosPortal_();
  Object.keys(mods).forEach(function (m) {
    const id = p.getProperty(m + '.LIBRO');
    lineas.push('  · ' + m + ': ' + (id ? 'https://docs.google.com/spreadsheets/d/' + id : '(se crea con instalar)'));
  });
  console.log(lineas.join('\n'));
  return lineas.join('\n');
}

/** Cambiar la llave con la que la consola del proveedor manda los módulos contratados
 *  (si se filtró). Después, pega la nueva en la consola (Datos del cliente). */
function nuevaLlaveProveedor() {
  const k = aleatorio_(48);
  propiedades_().setProperty('LLAVE_PROVEEDOR', k);
  console.log('Nueva llave del proveedor: ' + k);
  return k;
}

/** Cambiar la clave del portal (si se filtró o se fue alguien). Después,
 *  cada celular la vuelve a escribir en 🔑 Clave. */
function cambiarClave() {
  const nueva = aleatorio_(4, 'ABCDEFGHJKMNPQRSTUVWXYZ') + '-' + aleatorio_(4, '23456789');
  propiedades_().setProperty('CLAVE_PORTAL', nueva);
  console.log('Nueva clave del portal: ' + nueva);
  return nueva;
}
