/* ============================================================
   PORTAL SSTA — SERVIDOR COMPLETO EN UN SOLO ARCHIVO
   1. En script.google.com → Nuevo proyecto, borra lo que trae y PEGA TODO ESTE ARCHIVO.
   2. Cambia SOLO las 3 líneas de «DATOS DE LA EMPRESA» (aquí abajo).
   3. Guarda (💾), elige «instalar» arriba y ▶ Ejecutar. Sigue la guía.
   Para actualizar después: pega el archivo nuevo encima (los datos quedan guardados) y
   Implementar → Gestionar implementaciones → ✏️ → Nueva versión.
   ============================================================ */

/* ─────────── DATOS DE LA EMPRESA (cambia solo esto) ─────────── */
const EMPRESA_NOMBRE = 'ESCRIBE AQUÍ EL NOMBRE DE LA EMPRESA';
// Correos que reciben avisos (permisos sin cerrar, reposición de EPP, revisiones).
const CORREOS_SSTA = ['correo-sst@empresa.com'];
// Quién recibe por WhatsApp la foto de un EPP en mal estado (sale en el correo de reposición).
const CONTACTO_EPP = { nombre: 'Responsable de SST', whatsapp: '' };
/* ─────────── FIN DE LOS DATOS. No cambies nada de aquí para abajo. ─────────── */

/* ═════════ 00-Portal.gs ═════════ */
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
const VERSION_PORTAL = 'v175';

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
  reintegro: 'salud', presupuesto: 'presupuesto', gasto: 'presupuesto', cumple1040: 'convivencia' };   // v169
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


/* ═════════ 10-permisos.gs ═════════ */
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


/* ═════════ 11-personal.gs ═════════ */
/* ============================================================
   11-personal.gs — Módulo "personal" del Portal SSTA (mismo código de backends/backend-personal-autorizado.gs)
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
var __personal;
function modulo_personal_() {
  if (__personal) return __personal;
  __personal = (function () {
    const __entorno = entornoModulo_('personal', 'Anexo de personal autorizado');
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

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
const API_TOKEN = tokenPortal_();

// Correos que reciben la alerta de verificarIntegridad(). Deja el arreglo vacío
// para no enviar nada y revisar solo por el log de ejecución.
const CORREOS_AVISO = correosPortal_();

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


    return {
      doGet: doGet,
      doPost: doPost,
      libro: __entorno.libro,
      funciones: { verificarIntegridad: verificarIntegridad, personasEliminadas: personasEliminadas, reconstruirDesdeEventos: reconstruirDesdeEventos, migrarHistorialExistente: migrarHistorialExistente }
    };
  })();
  return __personal;
}
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['personal'] = modulo_personal_;

/* Funciones de mantenimiento de "personal" (menú ▶ Ejecutar del editor). */
function personal__verificarIntegridad() { return modulo_personal_().funciones.verificarIntegridad.apply(null, arguments); }
function personal__personasEliminadas() { return modulo_personal_().funciones.personasEliminadas.apply(null, arguments); }
function personal__reconstruirDesdeEventos() { return modulo_personal_().funciones.reconstruirDesdeEventos.apply(null, arguments); }
function personal__migrarHistorialExistente() { return modulo_personal_().funciones.migrarHistorialExistente.apply(null, arguments); }


/* ═════════ 12-ats.gs ═════════ */
/* ============================================================
   12-ats.gs — Módulo "ats" del Portal SSTA (mismo código de backends/backend-ats.gs)
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
var __ats;
function modulo_ats_() {
  if (__ats) return __ats;
  __ats = (function () {
    const __entorno = entornoModulo_('ats', 'ATS - Análisis de Trabajo Seguro');
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

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

const API_TOKEN = tokenPortal_();

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


    return {
      doGet: doGet,
      doPost: doPost,
      libro: __entorno.libro,
      funciones: { verLibro: verLibro, auditarIntegridad: auditarIntegridad, investigarATS: investigarATS }
    };
  })();
  return __ats;
}
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['ats'] = modulo_ats_;

/* Funciones de mantenimiento de "ats" (menú ▶ Ejecutar del editor). */
function ats__verLibro() { return modulo_ats_().funciones.verLibro.apply(null, arguments); }
function ats__auditarIntegridad() { return modulo_ats_().funciones.auditarIntegridad.apply(null, arguments); }
function ats__investigarATS() { return modulo_ats_().funciones.investigarATS.apply(null, arguments); }


/* ═════════ 13-asistencia.gs ═════════ */
/* ============================================================
   13-asistencia.gs — Módulo "asistencia" del Portal SSTA (mismo código de backends/backend-asistencia.gs)
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
var __asistencia;
function modulo_asistencia_() {
  if (__asistencia) return __asistencia;
  __asistencia = (function () {
    const __entorno = entornoModulo_('asistencia', 'Asistencia a charlas');
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

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

const API_TOKEN = tokenPortal_();

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


    return {
      doGet: doGet,
      doPost: doPost,
      libro: __entorno.libro,
      funciones: { verLibro: verLibro }
    };
  })();
  return __asistencia;
}
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['asistencia'] = modulo_asistencia_;

/* Funciones de mantenimiento de "asistencia" (menú ▶ Ejecutar del editor). */
function asistencia__verLibro() { return modulo_asistencia_().funciones.verLibro.apply(null, arguments); }


/* ═════════ 14-epp.gs ═════════ */
/* ============================================================
   14-epp.gs — Módulo "epp" del Portal SSTA (mismo código de backends/backend-epp.gs)
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
var __epp;
function modulo_epp_() {
  if (__epp) return __epp;
  __epp = (function () {
    const __entorno = entornoModulo_('epp', 'Inspección de EPP');
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

/* ============================================================
   backend-epp.gs — Inspección de EPP (SSTA-F-006) — Portal SSTA
   ------------------------------------------------------------
   Sigue exactamente el mismo diseño que los backends de permisos:

     · Hoja "Inspecciones": UNA FILA POR PERSONA INSPECCIONADA. No se
       guarda una fila por formulario de 8 casillas como en el papel —
       cada persona es un registro independiente, porque en la práctica
       se revisa de a una y así se puede consultar el historial de EPP
       de un trabajador puntual.
     · Hoja "Firmas": las imágenes van aparte del JSON, troceadas si
       superan el máximo de 50.000 caracteres por celda de Google Sheets.
     · Hoja "Eventos": bitácora inmutable, una fila por cada intento de
       escritura (aplicado, rechazado o duplicado).
     · Idempotencia por opId: un reenvío desde el Outbox no duplica.

   NOVEDAD respecto a los otros backends: al guardar una persona cuyo
   EPP tenga elementos calificados como M (malo), se envía automáticamente
   un correo solicitando la reposición de esos elementos.

   ⚠️ ANTES DE USAR: llena CORREOS_REPOSICION más abajo con los correos
   reales a los que debe llegar la solicitud (almacén / compras / SSTA).
   ============================================================ */

const API_TOKEN = tokenPortal_();

// A quién le llega la solicitud de reposición cuando algo se marca como MALO.
// La responsable de aprobar la reposición recibe tanto la solicitud formal por correo como la foto del
// elemento por WhatsApp, y es quien aprueba el cambio. Se puede agregar más de
// uno separado por coma si en el futuro debe llegarle a alguien más.
const CORREOS_REPOSICION = correosPortal_();

// WhatsApp al que hay que mandar la FOTO del elemento en mal estado. El correo
// deja el registro formal, pero la foto es lo que permite aprobar el cambio sin
// tener que ir a ver el elemento físicamente — por eso se recuerda en el correo
// y se ofrece un botón directo en el portal.
const WHATSAPP_APROBACION = contactoEpp_().whatsapp || '(sin número)';
const WHATSAPP_RESPONSABLE = contactoEpp_().nombre || 'Responsable de SST';

// Copia opcional al inspector (si escribió su correo en el formulario).
const COPIAR_AL_INSPECTOR = true;

const SHEET_NAME = 'Inspecciones';
const FIRMAS_SHEET_NAME = 'Firmas';
const EVENTOS_SHEET_NAME = 'Eventos';

/* ── Los dos formatos que atiende este backend ──
   SSTA-F-006 (EPP general) y SSTA-F-147 (dotación de brigadistas). Comparten
   hoja, flujo y correos: solo cambian los elementos y, en brigadistas, que
   además se cuenta cuántas unidades hay.

   Un solo backend en vez de dos: en este portal la duplicación ya causó
   fallos que se arreglaron en una copia y no en la otra.

   `cantidad` es lo que DEBE haber. Un botiquín con 1 tapabocas de 3 está
   incompleto aunque lo que haya esté en buen estado, así que también se pide. */
const FORMATOS_EPP = {
  epp: {
    codigo: 'SSTA-F-006',
    titulo: 'Inspección de EPP',
    elementos: [
      'CASCO CON BARBUQUEJO','SOPORTE BASCULANTE','VISOR','CARETA DE SOLDAR',
      'GAFAS TRANSPARENTES','GAFAS OSCURAS','GAFAS DE SOBREPONER','PROTECTOR AUDITIVO',
      'PROTECCIÓN RESPIRATORIA MEDIA CARA','FILTROS / CARTUCHO','PREFILTRO',
      'PETO MANGAS / CHAQUETA SOLDADOR','GUANTES DE CAUCHO NITRILO','GUANTES DE VAQUETA',
      'GUANTES DE PRECISIÓN','BOTAS DE SEGURIDAD','CARNÉT'
    ].map(function(n){ return { nombre: n, cantidad: null }; })
  },
  brigadista: {
    codigo: 'SSTA-F-147',
    titulo: 'Inspección de EPP — Brigadistas',
    elementos: [
      { nombre:'CANGURO',             cantidad:1  },
      { nombre:'TAPABOCAS',           cantidad:3  },
      { nombre:'GUANTES QUIRÚRGICOS', cantidad:5  },
      { nombre:'MÁSCARA RCP',         cantidad:1  },
      { nombre:'SILBATO',             cantidad:1  },
      { nombre:'CURITAS',             cantidad:10 },
      { nombre:'GASAS',               cantidad:6  },
      { nombre:'LINTERNA',            cantidad:1  },
      { nombre:'ALCOHOL',             cantidad:1  }
    ]
  }
};

/** Devuelve el formato pedido. Las inspecciones guardadas antes de que
 *  existiera el de brigadistas no tienen tipo: esas son del de EPP. */
function formatoDe_(tipo) {
  return FORMATOS_EPP[tipo] || FORMATOS_EPP.epp;
}

// Se mantiene por compatibilidad: varias partes del código ya la usaban.
const ELEMENTOS_EPP = FORMATOS_EPP.epp.elementos.map(function(e){ return e.nombre; });

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

/* ================= HOJA DE VIDA POR SERIAL (v148) ================= */
// Un equipo de alturas (arnés, eslinga, línea de vida) que soportó una caída o salió MALO queda RETIRADO
// y así lo ve cualquiera que lo busque por su serial. Res. 4272 de 2021: inspección pre-uso y anual por persona competente.
const HOJA_SERIALES = 'Equipos por serial';
function getSerialesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HOJA_SERIALES);
  if (!sh) { sh = ss.insertSheet(HOJA_SERIALES); sh.appendRow(filaSegura_(['serial', 'estado', 'ultimaInspeccion', 'tipoInspeccion', 'ultimaAnual', 'resultado', 'asignadoA', 'inspeccionId', 'motivo', 'actualizado'])); sh.setFrozenRows(1); }
  return sh;
}
function actualizarSeriales_(d, inspeccionId, body) {
  const lista = String(d.serial || '').split(/[,;\n]+/).map(function (x) { return x.trim().toUpperCase(); }).filter(String);
  if (!lista.length) return;
  const sh = getSerialesSheet_(), hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  const caida = /s[ií]/i.test(d.caida || ''), malo = (d.malos || []).length > 0;
  lista.forEach(function (ser) {
    const filas = filasPorValor_(sh, 1, ser), previo = filas.length ? sh.getRange(filas[0], 1, 1, 10).getValues()[0] : null;
    const yaRetirado = previo && String(previo[1]) === 'RETIRADO';
    const estado = caida || malo || yaRetirado ? 'RETIRADO' : 'EN SERVICIO';
    const motivo = yaRetirado ? String(previo[8]) : caida ? 'Soportó caída o impacto' : malo ? 'Inspección con elementos en MALO' : '';
    const anual = /anual|peri[oó]dic/i.test(d.tipoInspeccion || '') ? hoy : (previo ? previo[4] : '');
    const fila = [ser, estado, hoy, d.tipoInspeccion || 'Pre-uso', anual, malo ? 'MALO' : 'BUENO', body.nombre || '', inspeccionId, motivo, new Date()];
    if (filas.length) sh.getRange(filas[0], 1, 1, 10).setValues(filaSegura_([fila])); else sh.appendRow(filaSegura_(fila));
  });
}
function consultaSerial_(serial) {
  const ser = String(serial || '').trim().toUpperCase(); if (!ser) return { ok: false, error: 'Falta el serial.' };
  const sh = getSerialesSheet_(), filas = filasPorValor_(sh, 1, ser);
  if (!filas.length) return { ok: true, serial: ser, conocido: false };
  const f = sh.getRange(filas[0], 1, 1, 10).getValues()[0];
  return { ok: true, serial: ser, conocido: true, estado: String(f[1]), ultimaInspeccion: String(f[2]).slice(0, 10), ultimaAnual: String(f[4]).slice(0, 10), motivo: String(f[8]) };
}

/* ================= HOJAS ================= */

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(filaSegura_(['inspeccionId', 'cedula', 'nombre', 'cargo', 'fechaInspeccion',
                     'inspector', 'malos', 'dataJson', 'updatedAt']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

/** Devuelve los números de fila donde `columna` vale exactamente `valor`.
 *  Usa TextFinder, que resuelve la búsqueda del lado de Google y devuelve solo
 *  las coincidencias — en vez de traerse la columna entera al script, que se
 *  vuelve más lento a medida que la hoja crece. */
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
  let sheet = ss.getSheetByName(FIRMAS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FIRMAS_SHEET_NAME);
    sheet.appendRow(filaSegura_(['inspeccionId', 'sigKey', 'dataUrl', 'updatedAt']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function getEventosSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(EVENTOS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTOS_SHEET_NAME);
    sheet.appendRow(filaSegura_(['ts', 'inspeccionId', 'accion', 'resultado', 'detalle', 'opId', 'nombre', 'inspector', 'dataJson']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

/**
 * Bitácora. Se llama SIEMPRE, tanto si la operación se aplicó como si se
 * rechazó — un intento rechazado es justo lo que uno querría poder demostrar
 * después en una auditoría.
 * accion:    'INSPECCION' | 'CORREO'
 * resultado: 'APLICADO' | 'RECHAZADO' | 'DUPLICADO'
 */
function registrarEvento_(inspeccionId, accion, resultado, detalle, opId, nombre, inspector, dataJson) {
  try {
    getEventosSheet_().appendRow(filaSegura_([
      new Date(), inspeccionId || '', accion, resultado, detalle || '',
      opId || '', nombre || '', inspector || '', dataJson || ''
    ]));
  } catch (e) {
    // La bitácora nunca debe tumbar la operación principal.
  }
}

/** ¿Este opId ya se aplicó antes? Reconoce un reenvío (mismo envío repetido por
 *  un reintento de red) para no volver a aplicarlo ni reenviar el correo. */
function opIdYaAplicado_(opId) {
  if (!opId) return false;
  const sheet = getEventosSheet_();
  const rows = filasPorValor_(sheet, 6, opId); // col F = opId
  for (let i = 0; i < rows.length; i++) {
    if (sheet.getRange(rows[i], 4).getValue() === 'APLICADO') return true; // col D = resultado
  }
  return false;
}

/* ================= FIRMAS ================= */

function sigKeyFromDataUrl_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('').substring(0, 12);
}

// Saca del objeto cualquier campo de firma (imagen base64) y lo reemplaza por
// una referencia corta "SIGREF:xxxx", para que el JSON principal quede liviano.
function extraerFirmas_(obj, mapaFirmas) {
  if (Array.isArray(obj)) return obj.map(item => extraerFirmas_(item, mapaFirmas));
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
// supera esto, la escritura falla y la firma se pierde en silencio. Se deja
// margen bajo el tope real de 50.000.
const MAX_CHARS_CELDA = 32000;   // v142: tope de Excel (respaldo .xlsx)

// Parte una firma larga en trozos que sí quepan en una celda. Cada trozo va en
// su propia fila con la clave marcada como "abc123~2/5". Una firma que cabe
// entera se guarda con su clave a secas.
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

function claveBaseFirma_(key) {
  const pos = String(key).indexOf('~');
  return pos === -1 ? String(key) : String(key).substring(0, pos);
}

function guardarFirmas_(inspeccionId, mapaFirmas) {
  if (!mapaFirmas.length) return;
  const sheet = getFirmasSheet_();
  const last = sheet.getLastRow();
  const existentes = {};
  const filasDelId = filasPorValor_(sheet, 1, inspeccionId);
  if (filasDelId.length) {
    const minR = Math.min.apply(null, filasDelId);
    const maxR = Math.max.apply(null, filasDelId);
    const claves = sheet.getRange(minR, 2, maxR - minR + 1, 1).getValues();
    filasDelId.forEach(r => {
      existentes[inspeccionId + '|' + claveBaseFirma_(claves[r - minR][0])] = true;
    });
  }
  const ahora = new Date();
  const filas = [];
  mapaFirmas.forEach(f => {
    if (existentes[inspeccionId + '|' + f.sigKey]) return;
    trocearFirma_(f.sigKey, f.dataUrl).forEach(t => {
      filas.push([inspeccionId, t.key, "'" + t.texto, ahora]);
    });
  });
  if (filas.length) sheet.getRange(last + 1, 1, filas.length, 4).setValues(filaSegura_(filas));
}

function cargarFirmasPorId_(inspeccionId) {
  const sheet = getFirmasSheet_();
  const mapa = {};
  const rows = filasPorValor_(sheet, 1, inspeccionId);
  if (!rows.length) return mapa;
  rows.sort((a, b) => a - b);
  const minK = rows[0], maxK = rows[rows.length - 1];
  const clavesRango = sheet.getRange(minK, 2, maxK - minK + 1, 1).getValues();
  const filas = rows.map(r => ({ row: r, key: clavesRango[r - minK][0] }));
  const minRow = filas[0].row, maxRow = filas[filas.length - 1].row;
  const urls = sheet.getRange(minRow, 3, maxRow - minRow + 1, 1).getValues();
  // Reensambla las firmas guardadas en varios trozos y deja tal cual las que
  // caben en una sola celda.
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

// Hace el proceso inverso al leer: reemplaza cada "SIGREF:xxxx" por la imagen.
function rehidratarFirmas_(obj, mapa) {
  if (Array.isArray(obj)) return obj.map(item => rehidratarFirmas_(item, mapa));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const key in obj) {
      const val = obj[key];
      if (typeof val === 'string' && val.indexOf('SIGREF:') === 0) {
        out[key] = mapa[val.substring(7)] || '';
      } else {
        out[key] = rehidratarFirmas_(val, mapa);
      }
    }
    return out;
  }
  return obj;
}

/* ================= CORREO DE REPOSICIÓN ================= */

/**
 * Arma y envía la solicitud de reposición con los elementos calificados como
 * MALO. Devuelve un texto con lo ocurrido, que queda en la bitácora.
 * Nunca lanza: si el correo falla, la inspección YA quedó guardada y no debe
 * perderse por eso — el fallo queda registrado en "Eventos".
 */
function enviarSolicitudReposicion_(datos, inspeccionId) {
  const malos = datos.malos || [];
  const faltantes = datos.faltantes || [];
  if (!malos.length && !faltantes.length) return 'Sin elementos por reponer; no se envía correo.';

  const destinatarios = CORREOS_REPOSICION.filter(c => c && c.indexOf('@') !== -1);
  if (COPIAR_AL_INSPECTOR && datos.inspectorCorreo && datos.inspectorCorreo.indexOf('@') !== -1) {
    destinatarios.push(datos.inspectorCorreo);
  }
  if (!destinatarios.length) {
    return 'No hay destinatarios configurados (revisar CORREOS_REPOSICION en el script).';
  }

  const fecha = datos.fechaInspeccion || Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy');
  const tituloFormato = (datos.formato && datos.formato.titulo) ? datos.formato.titulo : 'Inspección de EPP';
  const codigoFormato = (datos.formato && datos.formato.codigo) ? datos.formato.codigo : '';   // v126: sin código de fábrica
  const asunto = 'Solicitud de reposición — ' + tituloFormato + ' — ' + (datos.nombre || 's/n');

  let cuerpo = '';
  cuerpo += 'SOLICITUD DE REPOSICIÓN DE ELEMENTOS\n';
  cuerpo += (codigoFormato ? 'Formato ' + codigoFormato + ' · ' : '') + tituloFormato + '\n';
  cuerpo += '------------------------------------------------------------\n\n';
  cuerpo += 'Trabajador:  ' + (datos.nombre || '') + '\n';
  cuerpo += 'Cédula:      ' + (datos.cedula || '') + '\n';
  cuerpo += 'Cargo:       ' + (datos.cargo || '') + '\n';
  cuerpo += 'Inspección:  ' + fecha + '\n';
  cuerpo += 'Inspector:   ' + (datos.inspector || '') + '\n';
  cuerpo += 'Registro:    ' + inspeccionId + '\n\n';
  if (malos.length) {
    cuerpo += 'EN MAL ESTADO — requieren reposición (' + malos.length + '):\n\n';
    malos.forEach((m, i) => { cuerpo += '  ' + (i + 1) + '. ' + m + '\n'; });
    cuerpo += '\n';
  }
  // Los incompletos van aparte: no están dañados, simplemente no alcanzan.
  // Separarlos le dice a quien repone si debe cambiar o solo completar.
  if (faltantes.length) {
    cuerpo += 'INCOMPLETOS — falta cantidad (' + faltantes.length + '):\n\n';
    faltantes.forEach((f, i) => { cuerpo += '  ' + (i + 1) + '. ' + f + '\n'; });
    cuerpo += '\n';
  }

  // Los elementos en REGULAR no se piden, pero se informan: sirven para
  // anticipar la próxima reposición sin que se conviertan en una urgencia.
  const regulares = datos.regulares || [];
  if (regulares.length) {
    cuerpo += '\nEn estado REGULAR (no se solicitan aún, pero conviene vigilarlos):\n\n';
    regulares.forEach((r, i) => { cuerpo += '  ' + (i + 1) + '. ' + r + '\n'; });
  }

  if (datos.observaciones) {
    cuerpo += '\nObservaciones del inspector:\n' + datos.observaciones + '\n';
  }

  cuerpo += '\n------------------------------------------------------------\n';
  cuerpo += 'PARA APROBAR EL CAMBIO\n';
  cuerpo += 'Enviar la FOTO de cada elemento en mal estado por WhatsApp a\n';
  cuerpo += WHATSAPP_RESPONSABLE + ' — ' + WHATSAPP_APROBACION + '\n';
  cuerpo += 'indicando el nombre del trabajador y el registro ' + inspeccionId + '.\n';
  cuerpo += 'Sin la foto no se puede aprobar la reposición.\n';
  cuerpo += '------------------------------------------------------------\n';
  cuerpo += 'Mensaje generado automáticamente por el Portal SSTA al registrar\n';
  cuerpo += 'la inspección. No responder a este correo.\n';

  try {
    MailApp.sendEmail(destinatarios.join(','), asunto, cuerpo);
    return 'Correo enviado a: ' + destinatarios.join(', ') +
           ' (' + malos.length + ' en mal estado, ' + faltantes.length + ' incompleto(s))';
  } catch (e) {
    return 'ERROR al enviar el correo: ' + e.message;
  }
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
    registrarEvento_('', 'INSPECCION', 'RECHAZADO', 'Token inválido', '', '', '', '');
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  try { sellarFirmas_(body, ctxSello_(body, '', body.action || '')); } catch (e) { console.log('Sello: ' + e.message); }

  // Envío manual del resumen del día, disparado por el botón del portal. Va
  // antes del lock porque no escribe en la hoja de inspecciones: solo lee y
  // manda el correo, así que no necesita bloquear a nadie.
  if (body.action === 'resumenDiario') {
    const resultado = enviarResumenDiario(body.fecha || '', body.inspector || '');
    const seEnvio = resultado.indexOf('Resumen enviado') === 0;
    return jsonOut_({ ok: seEnvio, mensaje: resultado });
  }

  const lock = LockService.getScriptLock();
  // v142: si está ocupado, responde TEMPORAL en JSON (antes salía una página de error y el celular no sabía reintentar).
  if (!lock.tryLock(15000)) return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El sistema está ocupado. Se vuelve a intentar solo en un momento: no cierres esta pantalla.' });
  try {
    // Reenvío del mismo guardado (la respuesta se perdió y el cliente reintentó):
    // se confirma sin volver a escribir NI volver a mandar el correo.
    if (body.opId && opIdYaAplicado_(body.opId)) {
      registrarEvento_(body.inspeccionId || '', 'INSPECCION', 'DUPLICADO',
                       'opId ya aplicado; no se repite', body.opId,
                       body.nombre || '', body.inspector || '', '');
      return jsonOut_({ ok: true, inspeccionId: body.inspeccionId, duplicado: true });
    }

    const inspeccionId = body.inspeccionId || genInspeccionId_();
    const ahora = new Date();

    // Recalcular los MALOS/REGULARES en el servidor, no confiar en lo que
    // mande el cliente: el correo de reposición es el efecto real de este
    // formato, y debe corresponder exactamente a lo que quedó guardado.
    const tipo = (body.tipo === 'brigadista') ? 'brigadista' : 'epp';
    const formato = formatoDe_(tipo);
    const items = body.items || {};
    const unidades = body.unidades || {};
    const malos = [], regulares = [], faltantes = [];
    // v156: en EPP los elementos salen de la matriz de EPP y se eligen al inspeccionar: se revisan los que llegaron.
    const elementos = tipo === 'epp'
      ? Object.keys(items).filter(function (k) { return String(k).length <= 80; }).slice(0, 80).map(function (k) { const f = formato.elementos.find(function (x) { return x.nombre === k; }); return f || { nombre: k, cantidad: null }; })
      : formato.elementos;
    elementos.forEach(e => {
      const el = e.nombre;
      if (items[el] === 'M') malos.push(el);
      else if (items[el] === 'R') regulares.push(el);
      // Incompleto por cantidad: se pide igual aunque lo que haya esté bueno.
      // Un campo sin diligenciar NO cuenta como faltante: significa "no lo
      // conté", no "hay cero".
      if (e.cantidad && items[el] !== 'N/A' && unidades[el] !== undefined && unidades[el] !== null) {
        const hay = Number(unidades[el]);
        if (!isNaN(hay) && hay < e.cantidad) {
          faltantes.push(el + ' (hay ' + hay + ', deben ser ' + e.cantidad + ')');
        }
      }
    });

    const mapaFirmas = [];
    const limpio = extraerFirmas_({
      tipo: tipo,
      formato: formato.codigo,
      items: items,
      unidades: unidades,
      faltantes: faltantes,
      observaciones: body.observaciones || '',
      sigTrabajador: body.sigTrabajador || '',
      sigInspector: body.sigInspector || '',
      malos: malos,
      regulares: regulares,
      formVersion: body.formVersion || formato.codigo,
      // v148: hoja de vida por serial de los equipos de alturas (Res. 4272 de 2021)
      serial: String(body.serial || '').slice(0, 120), tipoInspeccion: String(body.tipoInspeccion || '').slice(0, 40),
      caida: String(body.caida || '').slice(0, 40), inspectorCompetencia: String(body.inspectorCompetencia || '').slice(0, 160)
    }, mapaFirmas);

    const sheet = getSheet_();
    const filasExistentes = filasPorValor_(sheet, 1, inspeccionId);
    const fila = [
      inspeccionId,
      body.cedula || '',
      body.nombre || '',
      body.cargo || '',
      body.fechaInspeccion || Utilities.formatDate(ahora, 'America/Bogota', 'dd/MM/yyyy'),
      body.inspector || '',
      malos.concat(faltantes).join(' | '),
      JSON.stringify(limpio),
      ahora
    ];
    if (filasExistentes.length) {
      sheet.getRange(filasExistentes[0], 1, 1, fila.length).setValues(filaSegura_([fila]));
    } else {
      sheet.appendRow(filaSegura_(fila));
    }
    guardarFirmas_(inspeccionId, mapaFirmas);
    try { actualizarSeriales_(limpio, inspeccionId, body); } catch (e) { console.log('Hoja de vida por serial: ' + e.message); }

    registrarEvento_(inspeccionId, 'INSPECCION', 'APLICADO',
                     malos.length + ' elemento(s) en MALO, ' + regulares.length + ' en REGULAR',
                     body.opId, body.nombre || '', body.inspector || '', JSON.stringify(limpio));

    // El correo va DESPUÉS de guardar y registrar: si el envío falla, la
    // inspección ya está a salvo y el fallo queda anotado en la bitácora.
    const resultadoCorreo = enviarSolicitudReposicion_({
      tipo: tipo, formato: formato,
      faltantes: faltantes,
      nombre: body.nombre, cedula: body.cedula, cargo: body.cargo,
      inspector: body.inspector, inspectorCorreo: body.inspectorCorreo,
      fechaInspeccion: body.fechaInspeccion,
      observaciones: body.observaciones,
      malos: malos, regulares: regulares
    }, inspeccionId);
    // Nota: 'faltantes' va aparte de 'malos' porque son cosas distintas — uno
    // está dañado y el otro no alcanza — pero ambos se solicitan.
    registrarEvento_(inspeccionId, 'CORREO', malos.length ? 'APLICADO' : 'DUPLICADO',
                     resultadoCorreo, '', body.nombre || '', body.inspector || '', '');

    return jsonOut_({
      ok: true,
      inspeccionId: inspeccionId,
      malos: malos,
      regulares: regulares,
      correo: resultadoCorreo
    });
  } catch (err) {
    registrarEvento_(body.inspeccionId || '', 'INSPECCION', 'RECHAZADO', 'Error: ' + err.message,
                     body.opId, body.nombre || '', body.inspector || '', '');
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function genInspeccionId_() {
  const d = new Date();
  return 'EPP-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
    + '-' + String(Math.floor(Math.random() * 900000) + 100000);
}

/* ================= LECTURA ================= */

function doGet(e) {
  if (!checkToken_(e.parameter.token)) return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });

  // Catálogo de elementos: el frontend lo pide para no tener la lista duplicada
  // en dos sitios que se puedan desincronizar.
  if (e.parameter.action === 'elementos') {
    return jsonOut_({ ok: true, elementos: ELEMENTOS_EPP });
  }
  if (e.parameter.action === 'serial') return jsonOut_(consultaSerial_(e.parameter.serial));   // v148

  // Detalle de una inspección puntual, con las firmas rehidratadas.
  if (e.parameter.id) {
    const sheet = getSheet_();
    const rows = filasPorValor_(sheet, 1, e.parameter.id);
    if (!rows.length) return jsonOut_({ ok: false, error: 'No encontrada.' });
    const f = sheet.getRange(rows[0], 1, 1, 9).getValues()[0];
    let datos = {};
    try { datos = JSON.parse(f[7] || '{}'); } catch (err) { datos = {}; }
    datos = rehidratarFirmas_(datos, cargarFirmasPorId_(e.parameter.id));
    return jsonOut_({
      ok: true, inspeccionId: f[0], cedula: f[1], nombre: f[2], cargo: f[3],
      fechaInspeccion: f[4], inspector: f[5], malos: f[6], datos: datos, updatedAt: f[8]
    });
  }

  // Historial de una persona (para ver qué se le ha entregado/pedido antes).
  // Con &full=1 devuelve además el detalle de cada inspección (calificación de
  // los 17 elementos, observaciones y firmas), que es lo que necesita la ficha
  // imprimible del trabajador. Sin ese parámetro devuelve solo el resumen,
  // que es lo que consulta el formulario mientras se diligencia.
  if (e.parameter.cedula) {
    const sheet = getSheet_();
    const rows = filasPorValor_(sheet, 2, e.parameter.cedula);
    const completo = e.parameter.full === '1';
    const tipoPedido = e.parameter.tipo || '';
    const out = [];
    rows.forEach(r => {
      const f = sheet.getRange(r, 1, 1, 9).getValues()[0];
      let datos = {};
      try { datos = JSON.parse(f[7] || '{}'); } catch (err) { datos = {}; }
      const tipoFila = datos.tipo || 'epp';
      if (tipoPedido && tipoFila !== tipoPedido) return; // no mezclar formatos en la ficha
      const reg = { inspeccionId: f[0], cedula: f[1], nombre: f[2], cargo: f[3],
                    fechaInspeccion: f[4], inspector: f[5], malos: f[6],
                    tipo: tipoFila, updatedAt: f[8] };
      if (completo) reg.datos = rehidratarFirmas_(datos, cargarFirmasPorId_(f[0]));
      out.push(reg);
    });
    out.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    // Se acota el detalle completo: una ficha con cientos de inspecciones sería
    // impagable de descargar en obra y nadie la imprimiría entera igual.
    return jsonOut_({ ok: true, rows: completo ? out.slice(0, 40) : out });
  }

  // Listado general (últimas inspecciones), sin el dataJson para que sea liviano.
  if (e.parameter.list) {
    const sheet = getSheet_();
    const last = sheet.getLastRow();
    const rows = [];
    // Con &tipo= se devuelve solo ese formato. Las inspecciones guardadas antes
    // de que existiera el de brigadistas no tienen tipo dentro del JSON: se
    // cuentan como del formato de EPP, que es lo que eran.
    const tipoPedido = e.parameter.tipo || '';
    if (last >= 2) {
      const a = sheet.getRange(2, 1, last - 1, 8).getValues(); // hasta H = dataJson
      const u = sheet.getRange(2, 9, last - 1, 1).getValues();
      for (let i = 0; i < a.length; i++) {
        if (!a[i][0]) continue;
        let tipoFila = 'epp';
        try { tipoFila = (JSON.parse(a[i][7] || '{}').tipo) || 'epp'; } catch (err) {}
        if (tipoPedido && tipoFila !== tipoPedido) continue;
        rows.push({ inspeccionId: a[i][0], cedula: a[i][1], nombre: a[i][2], cargo: a[i][3],
                    fechaInspeccion: a[i][4], inspector: a[i][5], malos: a[i][6],
                    tipo: tipoFila, updatedAt: u[i][0] });
      }
    }
    rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return jsonOut_({ ok: true, rows: rows.slice(0, 300) });
  }

  return jsonOut_({ ok: false, error: 'Acción no reconocida.' });
}

/* ================= RESUMEN DIARIO ==================================
   Los correos que salen al guardar cada inspección son individuales: si en un
   día se revisan quince trabajadores, llegan quince correos y toca sumarlos a
   mano para saber cuántos guantes o cuántas gafas hay que comprar.

   Esta parte manda UN solo correo al final del día con el consolidado: cuántas
   unidades de cada elemento se pidieron y de qué trabajador salió cada una.
   No reemplaza los correos individuales — esos siguen saliendo igual, porque
   son el registro formal de cada inspección.

   Se envía desde el botón "Enviar resumen del día" que está en el portal, en
   la pantalla de historial. Así sale cuando el inspector ya terminó la jornada
   y no a una hora fija que puede caer a mitad de las revisiones.

   OPCIONAL — envío automático: si además se quiere que salga solo a una hora
   fija, en el editor de Apps Script seleccionar la función
   instalarResumenDiario en el menú de arriba y darle a Ejecutar (una sola
   vez). Para desactivarlo, borrar el disparador desde el ícono del reloj
   (Activadores). El botón sigue funcionando con o sin esto.
   ================================================================== */

// Hora a la que sale el resumen (formato 24h, hora de Colombia). El disparador
// de Apps Script dispara dentro de la hora indicada, no al minuto exacto.
const HORA_RESUMEN_DIARIO = 17;

// A quién le llega el consolidado. Por defecto los mismos de las solicitudes.
const CORREOS_RESUMEN_DIARIO = CORREOS_REPOSICION;

/* Crea el disparador diario. Ejecutar UNA vez desde el editor. Si ya existía,
   lo borra primero para no terminar con dos resúmenes cada tarde. */
// OJO: sin guion bajo al final. En Apps Script, una función que termina en "_"
// es privada y NO aparece en el desplegable del editor, así que no se podría
// ejecutar a mano — que es justo para lo que sirve esta.
function instalarResumenDiario() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'enviarResumenDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarResumenDiario')
    .timeBased().atHour(HORA_RESUMEN_DIARIO).everyDays(1)
    .inTimezone('America/Bogota').create();
  return 'Resumen diario programado para las ' + HORA_RESUMEN_DIARIO + ':00.';
}

/* La llama el disparador. También se puede ejecutar a mano para probar.
   Sin argumento usa el día de hoy; se le puede pasar 'dd/MM/yyyy' para
   reenviar el resumen de un día anterior. */
/**
 * Resumen del día. Si se pasa `inspectorFiltro`, solo incluye las inspecciones
 * hechas por esa persona — útil cuando varios revisan el mismo día y cada uno
 * quiere mandar lo suyo, en vez de un consolidado donde no se distingue quién
 * revisó qué. Sin filtro incluye a todos, que es como lo manda el disparador
 * automático de la tarde.
 */
function enviarResumenDiario(fechaTexto, inspectorFiltro) {
  // Desde el activador diario llega un objeto (el evento), no una fecha: se usa hoy.
  const hoy = (typeof fechaTexto === 'string' && fechaTexto) ? fechaTexto : Utilities.formatDate(new Date(), 'America/Bogota', 'dd/MM/yyyy');
  const filtro = String(inspectorFiltro || '').trim().toLowerCase();
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return 'Hoja vacía.';

  // Columnas: A id, B cédula, C nombre, D cargo, E fecha, F inspector, G malos
  const datos = sheet.getRange(2, 1, last - 1, 7).getValues();

  const conteo = {};          // elemento -> cantidad
  const quienes = {};         // elemento -> [nombres]
  const trabajadores = [];    // detalle por persona
  let totalInspecciones = 0;

  datos.forEach(f => {
    if (!f[0]) return;
    const fecha = f[4] instanceof Date
      ? Utilities.formatDate(f[4], 'America/Bogota', 'dd/MM/yyyy')
      : String(f[4] || '').trim();
    if (fecha !== hoy) return;
    if (filtro && String(f[5] || '').trim().toLowerCase() !== filtro) return; // F = inspector
    totalInspecciones++;

    const malos = String(f[6] || '').split('|').map(s => s.trim()).filter(Boolean);
    if (!malos.length) return;

    trabajadores.push({ nombre: f[2], cedula: f[1], cargo: f[3], id: f[0], malos: malos });
    malos.forEach(m => {
      conteo[m] = (conteo[m] || 0) + 1;
      if (!quienes[m]) quienes[m] = [];
      quienes[m].push(f[2] || 'Sin nombre');
    });
  });

  if (!totalInspecciones) return 'No hubo inspecciones el ' + hoy + '; no se envía resumen.';
  if (!trabajadores.length) {
    return 'Hubo ' + totalInspecciones + ' inspección(es) el ' + hoy +
           ' pero ninguna con elementos en mal estado; no se envía resumen.';
  }

  // Se ordena de mayor a menor cantidad: lo que más se pidió va primero, que es
  // lo que interesa mirar cuando esto llega a compras.
  const elementos = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a] || a.localeCompare(b));
  const totalUnidades = elementos.reduce((s, el) => s + conteo[el], 0);

  let cuerpo = '';
  cuerpo += 'RESUMEN DIARIO DE REPOSICIÓN DE EPP — ' + hoy + '\n';
  cuerpo += '============================================================\n\n';
  cuerpo += 'Inspecciones del día:        ' + totalInspecciones + '\n';
  cuerpo += 'Con elementos en mal estado: ' + trabajadores.length + '\n';
  cuerpo += 'Unidades a reponer:          ' + totalUnidades + '\n\n';

  cuerpo += 'TOTAL POR ELEMENTO\n';
  cuerpo += '------------------------------------------------------------\n';
  elementos.forEach(el => {
    cuerpo += '  ' + conteo[el] + ' x ' + el + '\n';
    cuerpo += '      (' + quienes[el].join(', ') + ')\n';
  });

  cuerpo += '\nDETALLE POR TRABAJADOR\n';
  cuerpo += '------------------------------------------------------------\n';
  trabajadores.forEach(t => {
    cuerpo += '\n' + (t.nombre || 'Sin nombre');
    if (t.cedula) cuerpo += ' — CC ' + t.cedula;
    if (t.cargo) cuerpo += ' — ' + t.cargo;
    cuerpo += '\n  Registro: ' + t.id + '\n';
    t.malos.forEach(m => { cuerpo += '  - ' + m + '\n'; });
  });

  cuerpo += '\n------------------------------------------------------------\n';
  cuerpo += 'RECORDATORIO\n';
  cuerpo += 'Solo se aprueba la reposición de los elementos cuya FOTO haya\n';
  cuerpo += 'llegado por WhatsApp a ' + WHATSAPP_RESPONSABLE + ' — ' + WHATSAPP_APROBACION + '.\n';
  cuerpo += 'Verificar contra este listado antes de tramitar la compra.\n';
  cuerpo += '------------------------------------------------------------\n';
  cuerpo += 'Mensaje generado automáticamente por el Portal SSTA.\n';
  cuerpo += 'No responder a este correo.\n';

  const destinatarios = (CORREOS_RESUMEN_DIARIO || []).filter(c => c && c.indexOf('@') !== -1);
  if (!destinatarios.length) return 'No hay destinatarios configurados para el resumen diario.';

  // El correo se manda en HTML (tablas) porque quien lo recibe lo usa para
  // tramitar la compra: en tabla se lee de una y se puede copiar y pegar a una
  // hoja de cálculo. El texto plano de arriba viaja igual como alternativa,
  // para los correos que no muestran HTML.
  const html = armarHtmlResumenDiario_(hoy, totalInspecciones, trabajadores,
                                       totalUnidades, elementos, conteo, quienes);

  const asunto = 'Resumen EPP ' + hoy
    + (filtro ? ' — ' + (inspectorFiltro || '') : '')
    + ' — ' + totalUnidades + ' elemento(s) por reponer';
  try {
    MailApp.sendEmail({
      to: destinatarios.join(','),
      subject: asunto,
      body: cuerpo,
      htmlBody: html
    });
    registrarEvento_('', 'RESUMEN_DIARIO', 'APLICADO',
                     'Enviado a ' + destinatarios.join(', ') + ' (' + totalUnidades + ' unidades)',
                     '', '', '', '');
    return 'Resumen enviado a: ' + destinatarios.join(', ');
  } catch (e) {
    registrarEvento_('', 'RESUMEN_DIARIO', 'ERROR', e.message, '', '', '', '');
    return 'ERROR al enviar el resumen: ' + e.message;
  }
}


/* Arma el resumen diario en HTML. Se usan tablas y estilos en línea a propósito:
   es lo único que Gmail y Outlook muestran igual, y este correo se abre tanto
   en el computador de la oficina como en el celular en obra. */
function armarHtmlResumenDiario_(hoy, totalInspecciones, trabajadores,
                                 totalUnidades, elementos, conteo, quienes) {
  const TINTA = '#23282d', SUAVE = '#6b7379', LINEA = '#d9dde0';
  const esc = t => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let h = '';
  h += '<div style="font-family:Arial,Helvetica,sans-serif;color:' + TINTA + ';max-width:640px;">';

  // Encabezado
  h += '<div style="border-bottom:3px solid ' + TINTA + ';padding-bottom:10px;margin-bottom:16px;">'
     + '<div style="font-size:18px;font-weight:bold;">Resumen diario de reposición de EPP</div>'
     + '<div style="font-size:13px;color:' + SUAVE + ';margin-top:3px;">'
     + esc(hoy) + '</div></div>';

  // Cifras del día, en recuadros
  h += '<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:20px;"><tr>';
  [['Inspecciones', totalInspecciones],
   ['Con elementos malos', trabajadores.length],
   ['Unidades a reponer', totalUnidades]].forEach((c, i) => {
    h += '<td style="width:33%;padding:' + (i === 1 ? '0 6px' : '0') + ';">'
       + '<div style="border:1px solid ' + LINEA + ';border-radius:6px;padding:11px;text-align:center;">'
       + '<div style="font-size:22px;font-weight:bold;">' + c[1] + '</div>'
       + '<div style="font-size:11px;color:' + SUAVE + ';text-transform:uppercase;letter-spacing:.4px;">'
       + esc(c[0]) + '</div></div></td>';
  });
  h += '</tr></table>';

  // Total por elemento
  h += '<div style="font-size:14px;font-weight:bold;margin-bottom:7px;">Total por elemento</div>';
  h += '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;'
     + 'font-size:13px;margin-bottom:22px;">';
  h += '<tr style="background:#f2f3f4;">'
     + '<th align="center" style="padding:8px;border:1px solid ' + LINEA + ';width:52px;">Cant.</th>'
     + '<th align="left" style="padding:8px;border:1px solid ' + LINEA + ';">Elemento</th>'
     + '<th align="left" style="padding:8px;border:1px solid ' + LINEA + ';">Trabajadores</th></tr>';
  elementos.forEach((el, i) => {
    h += '<tr' + (i % 2 ? ' style="background:#fafbfb;"' : '') + '>'
       + '<td align="center" style="padding:8px;border:1px solid ' + LINEA + ';font-weight:bold;">'
       + conteo[el] + '</td>'
       + '<td style="padding:8px;border:1px solid ' + LINEA + ';">' + esc(el) + '</td>'
       + '<td style="padding:8px;border:1px solid ' + LINEA + ';color:' + SUAVE + ';font-size:12px;">'
       + esc(quienes[el].join(', ')) + '</td></tr>';
  });
  h += '</table>';

  // Detalle por trabajador
  h += '<div style="font-size:14px;font-weight:bold;margin-bottom:7px;">Detalle por trabajador</div>';
  h += '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;'
     + 'font-size:13px;margin-bottom:22px;">';
  h += '<tr style="background:#f2f3f4;">'
     + '<th align="left" style="padding:8px;border:1px solid ' + LINEA + ';">Trabajador</th>'
     + '<th align="left" style="padding:8px;border:1px solid ' + LINEA + ';">Registro</th>'
     + '<th align="left" style="padding:8px;border:1px solid ' + LINEA + ';">Elementos en mal estado</th></tr>';
  trabajadores.forEach((t, i) => {
    let quien = '<b>' + esc(t.nombre || 'Sin nombre') + '</b>';
    const extra = [t.cedula ? 'CC ' + esc(t.cedula) : '', esc(t.cargo || '')].filter(Boolean).join(' · ');
    if (extra) quien += '<br><span style="color:' + SUAVE + ';font-size:11.5px;">' + extra + '</span>';
    h += '<tr' + (i % 2 ? ' style="background:#fafbfb;"' : '') + '>'
       + '<td valign="top" style="padding:8px;border:1px solid ' + LINEA + ';">' + quien + '</td>'
       + '<td valign="top" style="padding:8px;border:1px solid ' + LINEA + ';font-family:monospace;font-size:11.5px;">'
       + esc(t.id) + '</td>'
       + '<td valign="top" style="padding:8px;border:1px solid ' + LINEA + ';">'
       + '<ul style="margin:0;padding-left:16px;">'
       + t.malos.map(m => '<li>' + esc(m) + '</li>').join('')
       + '</ul></td></tr>';
  });
  h += '</table>';

  // Recordatorio de la foto
  h += '<div style="border:1px solid #e08a80;background:#fdecea;color:#7a1f14;'
     + 'border-radius:6px;padding:12px;font-size:12.5px;line-height:1.55;">'
     + '<b>RECORDATORIO</b><br>'
     + 'Solo se aprueba la reposición de los elementos cuya <b>FOTO</b> haya llegado '
     + 'por WhatsApp a ' + esc(WHATSAPP_RESPONSABLE) + ' — ' + esc(WHATSAPP_APROBACION) + '.<br>'
     + 'Verificar contra este listado antes de tramitar la compra.</div>';

  h += '<div style="margin-top:16px;font-size:11px;color:' + SUAVE + ';line-height:1.5;">'
     + 'Mensaje generado automáticamente por el Portal SSTA. No responder a este correo.</div>';
  h += '</div>';
  return h;
}

/* ══════════════════════════════════════════════════════════════════
   AUDITORÍA DE INTEGRIDAD — inspecciones de EPP
   Mismo propósito que la de los permisos: revisar lo YA guardado para
   saber qué quedó incompleto por los fallos que se corrigieron después.
   No modifica nada; escribe en la hoja "Auditoria" y manda el resumen.
   Se ejecuta a mano desde el editor: elegir auditarIntegridad → Ejecutar.
   ══════════════════════════════════════════════════════════════════ */

function getAuditoriaSheetEpp_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Auditoria');
  if (!sheet) {
    sheet = ss.insertSheet('Auditoria');
    sheet.appendRow(filaSegura_(['revisadoEl', 'inspeccionId', 'fecha', 'trabajador', 'inspector',
                     'elementosCalificados', 'firmaTrabajador', 'firmaInspector', 'problemas']));
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function auditarIntegridad() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) { console.log('No hay inspecciones registradas en esta hoja.'); return 'No hay inspecciones registradas.'; }

  const datos = sheet.getRange(2, 1, last - 1, 9).getValues();
  const ahora = new Date();
  const filas = [], conProblemas = [];
  let total = 0, sanas = 0;

  datos.forEach(f => {
    const id = f[0];
    if (!id) return;
    total++;
    let d = {};
    try { d = JSON.parse(f[7] || '{}'); } catch (e) { d = null; }
    const problemas = [];
    if (d === null) {
      problemas.push('JSON ilegible');
      filas.push([ahora, id, f[4], f[2], f[5], '', '', '', problemas.join(' · ')]);
      conProblemas.push({ id: id, fecha: f[4], nombre: f[2], problemas: problemas });
      return;
    }

    const mapa = cargarFirmasPorId_(id);
    const estado = (s) => {
      if (!s) return 'sin firmar';
      if (String(s).indexOf('SIGREF:') === 0) {
        const img = mapa[String(s).substring(7)];
        return (img && String(img).length > 100) ? 'ok' : 'imagen perdida';
      }
      return String(s).length > 100 ? 'ok' : 'sin firmar';
    };
    const ft = estado(d.sigTrabajador), fi = estado(d.sigInspector);
    const calificados = d.items ? Object.keys(d.items).filter(k => d.items[k]).length : 0;

    if (ft === 'imagen perdida') problemas.push('la firma del trabajador se perdió');
    if (fi === 'imagen perdida') problemas.push('la firma del inspector se perdió');
    if (ft === 'sin firmar') problemas.push('el trabajador no firmó');
    if (fi === 'sin firmar') problemas.push('el inspector no firmó');
    if (calificados < ELEMENTOS_EPP.length) {
      problemas.push('solo ' + calificados + ' de ' + ELEMENTOS_EPP.length + ' elementos calificados');
    }

    filas.push([ahora, id, f[4], f[2], f[5], calificados, ft, fi,
                problemas.length ? problemas.join(' · ') : 'OK']);
    if (problemas.length) conProblemas.push({ id: id, fecha: f[4], nombre: f[2], problemas: problemas });
    else sanas++;
  });

  if (filas.length) {
    const h = getAuditoriaSheetEpp_();
    h.getRange(h.getLastRow() + 1, 1, filas.length, 9).setValues(filaSegura_(filas));
  }

  let cuerpo = 'AUDITORÍA DE INSPECCIONES DE EPP\n';
  cuerpo += Utilities.formatDate(ahora, 'America/Bogota', 'dd/MM/yyyy HH:mm') + '\n';
  cuerpo += '------------------------------------------------------------\n\n';
  cuerpo += 'Inspecciones revisadas : ' + total + '\n';
  cuerpo += 'Sin problemas          : ' + sanas + '\n';
  cuerpo += 'Con problemas          : ' + conProblemas.length + '\n\n';
  if (conProblemas.length) {
    cuerpo += 'DETALLE:\n\n';
    conProblemas.slice().reverse().forEach(p => {
      cuerpo += '  ' + p.id + '  ' + (p.fecha || '') + '  ' + (p.nombre || '') + '\n';
      p.problemas.forEach(x => { cuerpo += '      - ' + x + '\n'; });
    });
    cuerpo += '\n"Se perdió" significa que la inspección guardó la referencia a la\n';
    cuerpo += 'firma pero la imagen nunca llegó a escribirse. No se recupera: esa\n';
    cuerpo += 'inspección queda sin el respaldo de la firma.\n';
  } else {
    cuerpo += 'No se encontraron inspecciones incompletas.\n';
  }
  cuerpo += '\nEl detalle completo quedó en la hoja "Auditoria".\n';

  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
      'Auditoría de inspecciones EPP — ' + conProblemas.length + ' con problemas de ' + total, cuerpo);
  } catch (e) {}

  const resumen = total + ' inspecciones revisadas · ' + conProblemas.length + ' con problemas.';
  console.log(resumen);
  console.log('Detalle completo en la hoja "Auditoria" y en el correo enviado.');
  if (conProblemas.length) {
    console.log('--- inspecciones con problemas ---');
    conProblemas.slice().reverse().forEach(p => {
      console.log('  ' + p.id + ' ' + (p.fecha || '') + ' ' + (p.nombre || '') + ' → ' + p.problemas.join(' · '));
    });
  }
  return resumen;
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
      funciones: { instalarResumenDiario: instalarResumenDiario, enviarResumenDiario: enviarResumenDiario, auditarIntegridad: auditarIntegridad }
    };
  })();
  return __epp;
}
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['epp'] = modulo_epp_;

/* Funciones de mantenimiento de "epp" (menú ▶ Ejecutar del editor). */
function epp__instalarResumenDiario() { return modulo_epp_().funciones.instalarResumenDiario.apply(null, arguments); }
function epp__enviarResumenDiario() { return modulo_epp_().funciones.enviarResumenDiario.apply(null, arguments); }
function epp__auditarIntegridad() { return modulo_epp_().funciones.auditarIntegridad.apply(null, arguments); }


/* ═════════ 15-sgsst.gs ═════════ */
/* ============================================================
   15-sgsst.gs — Módulo "sgsst" del Portal SSTA (mismo código de backends/backend-sgsst.gs)
   GENERADO por herramientas/armar-servidor-unico.js: no se edita a mano.
   ============================================================ */
var __sgsst;
function modulo_sgsst_() {
  if (__sgsst) return __sgsst;
  __sgsst = (function () {
    const __entorno = entornoModulo_('sgsst', 'Gestión SG-SST');
    const SpreadsheetApp = __entorno.SpreadsheetApp, PropertiesService = __entorno.PropertiesService, ScriptApp = __entorno.ScriptApp, MailApp = __entorno.MailApp;

/* ============================================================
   backend-sgsst.gs — Gestión del SG-SST — Portal SSTA
   ------------------------------------------------------------
   Un solo servidor para los módulos de gestión:
     · trabajador  → personal habilitado (requisitos con vencimiento)
     · reporte     → actos y condiciones inseguras, incidentes y accidentes
                     (reporte a la ARL e investigación, Res. 1401 de 2007)
     · accion      → plan de acción único (de reportes, inspecciones, EPP…)
     · mes         → datos del mes para los indicadores (Res. 0312 de 2019)
     · equipo      → inventario con vencimientos (extintores, arneses…)
     · inspeccion  → inspecciones planeadas y preoperacionales
     · comite      → conformación del COPASST y del Comité de Convivencia
                     (periodos, integrantes, capacitaciones)
     · reunion     → actas de reunión de los comités
     · queja       → quejas del Comité de Convivencia. LLEGAN CIFRADAS desde
                     el celular (clave del comité): aquí solo se guardan el
                     código, las fechas y la etapa. Ni el dueño de la hoja
                     puede leer el contenido.
     · auditoria   → programa de auditorías, autoevaluación Res. 0312,
                     auditoría interna (Dec. 1072), ISO 45001, clientes
     · Planeación y salud (TIPOS_GEN, más abajo): matriz de peligros,
       sustancias, mediciones, emergencias, simulacros, plan anual,
       profesiograma, exámenes médicos (solo concepto, nunca diagnóstico),
       condiciones de salud, SVE, batería psicosocial (solo resultados
       agregados), ausentismo, política, matriz legal, listado maestro,
       gestión del cambio, proveedores, revisión por la dirección y
       rendición de cuentas.
     · Contratistas (documentos de la empresa) e ingresos a obra.

   USUARIOS CON NOMBRE (opcional): mientras no exista la hoja "Usuarios",
   todo funciona como siempre (con la clave del portal). Al crear el primer
   administrador (▶ codigoAdministrador y luego el portal → Usuarios), cada
   cambio exige iniciar sesión, queda firmado con el nombre de quien lo hizo
   (bitácora "Eventos" y el propio registro) y cada rol ve y cambia solo lo
   suyo. Las claves de las personas NUNCA llegan aquí: el celular manda una
   "prueba" derivada (PBKDF2) y aquí se guarda solo su huella.

   ADJUNTOS: certificados, actas escaneadas, hojas de seguridad… se guardan en
   Google Drive (carpeta "Adjuntos SG-SST") y quedan enlazados al registro.
   Se bajan a través de este servidor (Drive no se comparte con nadie).

   RESPALDO: ▶ instalarRespaldo copia cada semana las hojas a la carpeta
   "Respaldos SG-SST" y conserva para siempre el primero de cada mes
   (Dec. 1072, art. 2.2.4.6.13: hay registros que se guardan 20 años).

   Cómo guarda (igual de cuidadoso que los permisos):
     · "Registros": UNA FILA POR DOCUMENTO (id, tipo, estado, fechas y un
       resumen corto en JSON). Es lo que se lista rápido en el celular.
     · "Datos": el documento completo en JSON, troceado si pasa el límite de
       50.000 caracteres por celda.
     · "Imagenes": fotos y firmas aparte, troceadas.
     · Una hoja legible por módulo ("Requisitos", "Reportes", "Plan de
       acción", "Equipos", "Inspecciones", "Indicadores") para consultar o
       filtrar en Google Sheets.
     · "Eventos": bitácora de cada intento de escritura.
     · Idempotencia por opId: un reenvío desde la cola sin señal no duplica.
     · "parche": cambia solo los campos enviados (dos celulares que actualizan
       cosas distintas del mismo documento no se pisan).

   DESPLIEGUE: igual que los demás (Aplicación web · Ejecutar como: yo ·
   Acceso: cualquier usuario) → URL /exec en config.js (BACKENDS.sgsst.url).
   Avisos diarios por correo: se programan solos (v136). Para apagarlos: propiedad AVISOS_APAGADOS = 1.
   ============================================================ */

const VERSION_SGSST = 'v175';   // la muestra el panel del asesor para saber qué clientes están desactualizados
const API_TOKEN = tokenPortal_();
const CORREOS_AVISO = correosPortal_();
// Otras hojas que se copian en el respaldo semanal junto con esta (permisos, ATS,
// EPP, charlas, anexo…): pega aquí la URL de cada una, entre comillas y con coma.
const RESPALDAR_TAMBIEN = [];

/* ── CLAVE DEL PORTAL (igual que en los demás backends) ── */
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

/* Tipos "genéricos": lo que se lista, las columnas de "Registros" y su hoja legible
   salen de esta tabla (campos cortos; las listas se cuentan). */
const TIPOS_GEN = {
  peligro: { hoja: 'Matriz de peligros', titulo: 'peligro', fecha: 'fechaRevision', estado: 'aceptabilidad', responsable: 'proceso', vence: '',
    campos: ['proceso', 'zona', 'actividad', 'tarea', 'rutinaria', 'clasificacion', 'subtipo', 'peligro', 'efectos', 'expuestos', 'nd', 'ne', 'np', 'nc', 'nr', 'nivel', 'aceptabilidad', 'controlesPendientes', 'fechaRevision', 'cargos', 'ctrlIndividuo', 'controlesTexto'], largos: ['controlesTexto'], largoMax: 700 },   // v109: cargos y EPP → sugerencias de la matriz de EPP
  sustancia: { hoja: 'Sustancias químicas', titulo: 'nombre', fecha: 'fechaHoja', estado: 'estado', responsable: 'ubicacion', vence: 'venceHoja',
    campos: ['nombre', 'fabricante', 'uso', 'area', 'ubicacion', 'cantidad', 'estadoFisico', 'cas', 'onu', 'pictogramas', 'palabra', 'frasesH', 'carcinogena', 'toxicidadAguda',
             'corrosivoTipo', 'hojaSeguridad', 'fdsEspanol', 'fechaHoja', 'venceHoja', 'etiquetaSGA', 'trasvasa', 'envasesRotulados', 'epp', 'controles', 'expuestos', 'estado',
             'consejosP', 'telProveedor', 'telEmergencia', 'nfpa', 'lugarId'], largos: ['frasesH', 'consejosP'] },   // v107: lo de la etiqueta SGA viaja en la lista (se imprime sin abrir cada una)
  lugarquim: { hoja: 'Lugares de almacenamiento de químicos', titulo: 'nombre', fecha: 'fechaRevision', estado: 'tipoLugar', responsable: 'responsable', vence: '',
    campos: ['nombre', 'area', 'tipoLugar', 'responsable', 'capacidad', 'unidadCapacidad', 'ventilacion', 'contencion', 'kitDerrames', 'extintor', 'lavaojos', 'senalizacion', 'observaciones', 'fechaRevision', 'activo'] },
  gestquim: { hoja: 'Gestión del riesgo químico', titulo: 'responsable', fecha: 'capacitacionSGA', estado: '', responsable: 'responsable', vence: 'proximaCapacitacion',
    campos: ['responsable', 'capacitacionSGA', 'proximaCapacitacion', 'capacitados', 'senalizacion', 'kitDerrames', 'lavaojos', 'fdsDisponibles', 'procedimiento', 'inventarioRevisado'] },
  medicion: { hoja: 'Mediciones ambientales', titulo: 'agente', fecha: 'fecha', estado: 'resultado', responsable: 'area', vence: 'proxima',
    campos: ['agente', 'area', 'fecha', 'proveedor', 'valor', 'limite', 'resultado', 'proxima'] },
  revmatriz: { hoja: 'Revisiones de la matriz', titulo: 'alcance', fecha: 'fecha', estado: '', responsable: 'responsable', vence: '',
    campos: ['fecha', 'alcance', 'responsable', 'participantes', 'cambios'] },
  emergencia: { hoja: 'Plan de emergencias', titulo: 'sede', fecha: 'fechaActualizacion', estado: 'estado', responsable: 'coordinador', vence: 'proximaRevision',
    campos: ['sede', 'direccion', 'ocupantes', 'coordinador', 'amenazas', 'riesgoAlto', 'riesgoMedio', 'brigadistas', 'brigadistasCapacitados', 'dotacionFaltantes', 'fechaActualizacion', 'proximaRevision', 'estado',
             'puntoEncuentro', 'hospital', 'hospitalDireccion', 'hospitalTelefono', 'hospitalTiempo', 'ambulanciaTelefono', 'arlNombre', 'arlTelefono', 'medevacTransporte', 'ponTexto'] },   // v140: MEDEVAC; v150: PON para cruzar con las emergencias ambientales
  simulacro: { hoja: 'Simulacros', titulo: 'escenario', fecha: 'fecha', estado: 'calificacion', responsable: 'sede', vence: '',
    campos: ['fecha', 'tipoSimulacro', 'escenario', 'sede', 'participantes', 'tiempoTotal', 'conteoCompleto', 'calificacion', 'hallazgos'] },
  plananual: { hoja: 'Plan anual de trabajo', titulo: 'anio', fecha: 'fechaFirma', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['anio', 'responsable', 'actividades', 'programadas', 'ejecutadas', 'cumplimiento', 'avance', 'capProgramadas', 'capEjecutadas', 'cobertura', 'presupuesto', 'fechaFirma', 'firmado', 'estado'] },
  cargo: { hoja: 'Profesiograma', titulo: 'nombre', fecha: '', estado: '', responsable: 'area', vence: '',
    campos: ['nombre', 'area', 'peligros', 'exposiciones', 'examenes', 'periodicidad', 'enfasis'] },
  examen: { hoja: 'Exámenes médicos', titulo: 'nombre', fecha: 'fecha', estado: 'concepto', responsable: 'cargo', vence: 'proxima',
    campos: ['nombre', 'cedula', 'cargo', 'tipoExamen', 'fecha', 'ips', 'concepto', 'tieneRestricciones', 'temporalidad', 'venceRestriccion', 'proxima', 'comunicada', 'seguimiento', 'exposiciones', 'pruebas', 'pveIngresa', 'pve', 'restringePara'] },
  perfil: { hoja: 'Condiciones de salud', titulo: 'anio', fecha: 'fecha', estado: '', responsable: 'ips', vence: '',
    campos: ['anio', 'fecha', 'ips', 'trabajadores', 'actividades'] },
  sve: { hoja: 'Vigilancia epidemiológica', titulo: 'programa', fecha: 'fechaInicio', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['programa', 'programaOtro', 'responsable', 'poblacion', 'intervenidos', 'cobertura', 'actividades', 'fechaInicio', 'estado', 'cumplimiento', 'actProgramadas', 'actEjecutadas', 'metaPrevalencia', 'metaCobertura'] },
  /* v157: pedido de reposición que sale de la inspección de EPP (elementos en MALO); se cierra al entregarlos. */
  solrepo: { hoja: 'Reposición pedida (EPP)', titulo: 'nombre', fecha: 'fecha', estado: 'estado', responsable: 'cargo', vence: '',
    campos: ['nombre', 'cedula', 'cargo', 'fecha', 'inspeccionId', 'accionId', 'elementosTexto', 'estado', 'fechaEntrega', 'entregaId'] },
  /* v155: persona dentro de un programa de vigilancia (PVE). Sin diagnóstico: clasificación del programa,
     origen (examen médico, encuesta, manual), seguimientos y próxima evaluación. Solo SST. */
  pvecaso: { hoja: 'PVE · personas', titulo: 'nombre', fecha: 'fechaIngreso', estado: 'estado', responsable: 'programa', vence: 'proximaEvaluacion',
    campos: ['sveId', 'programa', 'nombre', 'cedula', 'cargo', 'area', 'clasificacion', 'origen', 'examenId', 'fechaIngreso', 'estado', 'fechaEgreso', 'proximaEvaluacion', 'ultimoSeguimiento', 'nSeguimientos', 'recomendaciones'], largos: ['recomendaciones'], largoMax: 1500, saltos: true },
  psico: { hoja: 'Riesgo psicosocial', titulo: 'fecha', fecha: 'fecha', estado: 'nivelGeneral', responsable: 'profesional', vence: 'proxima',
    campos: ['fecha', 'profesional', 'participantes', 'cobertura', 'intralaboralA', 'intralaboralB', 'extralaboral', 'estres', 'nivelGeneral', 'proxima', 'intervenciones'] },
  // v169 · Reintegro laboral: regreso después de una incapacidad, con sus restricciones y el seguimiento a que se cumplan.
  // Es dato de salud (solo admin y SST) y nunca lleva diagnóstico: solo lo que la persona puede o no hacer en el trabajo.
  reintegro: { hoja: 'Reintegro laboral', titulo: 'nombre', fecha: 'fechaRetorno', estado: 'estado', responsable: 'cargo', vence: 'proximoSeguimiento',
    campos: ['nombre', 'cedula', 'cargo', 'area', 'jefe', 'origen', 'diasIncapacidad', 'ausenciaId', 'fechaRetorno', 'evaluacionPost',
      'tipoReintegro', 'cargoAsignado', 'restricciones', 'restringePara',
      'temporalidad', 'venceRestriccion', 'comunicadoJefe', 'comunicadoTrabajador', 'frecuencia', 'proximoSeguimiento', 'ultimoSeguimiento',
      'nSeguimientos', 'ultimoCumple', 'estado', 'fechaCierre', 'motivoCierre', 'estabilidad'],
    largos: ['restricciones'], largoMax: 1500, saltos: true },
  // v169 · Presupuesto del SG-SST (uno por año, con sus rubros) y lo que se gasta contra cada rubro (estándar 1.1.3).
  // v175 · Decreto 1040 de 2026 (acoso, violencia basada en género y discriminación): el cumplimiento de la empresa.
  cumple1040: { hoja: 'Decreto 1040 (cumplimiento)', titulo: 'anio', fecha: 'actualizado1040', estado: '', responsable: 'responsable', vence: '',
    campos: ['anio', 'politicaParticipativa', 'politicaFirmada', 'politicaPublicada', 'protocolo', 'canales', 'designacion', 'responsable',
      'reglamento', 'contratos', 'socializacion', 'capacitacion', 'estadistica', 'actualizado1040'] },
  presupuesto: { hoja: 'Presupuesto SG-SST', titulo: 'anio', fecha: 'fechaAprobacion', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['anio', 'responsable', 'aprobadoPor', 'fechaAprobacion', 'estado', 'totalPresupuestado', 'rubros'] },
  // v174 · Tareas y recordatorios propios (calendario de Gestión): cada quien anota lo suyo y el correo diario se lo recuerda.
  tarea: { hoja: 'Tareas y recordatorios', titulo: 'titulo', fecha: 'fecha', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['titulo', 'fecha', 'hora', 'recordar', 'notas', 'responsable', 'usuario', 'estado'] },
  gasto: { hoja: 'Gastos SG-SST', titulo: 'concepto', fecha: 'fecha', estado: 'rubro', responsable: 'proveedor', vence: '',
    campos: ['anio', 'rubroId', 'rubro', 'fecha', 'concepto', 'valor', 'proveedor', 'soporte'] },
  ausencia: { hoja: 'Ausentismo', titulo: 'nombre', fecha: 'inicio', estado: 'causa', responsable: 'cargo', vence: '',
    campos: ['nombre', 'cedula', 'cargo', 'inicio', 'fin', 'dias', 'causa', 'mes', 'prorroga'] },
  politica: { hoja: 'Política y objetivos', titulo: 'versionDoc', fecha: 'fechaFirma', estado: 'estado', responsable: 'firmante', vence: 'proximaRevision',
    campos: ['versionDoc', 'fechaFirma', 'firmante', 'proximaRevision', 'objetivos', 'divulgaciones', 'estado'] },
  legal: { hoja: 'Matriz legal', titulo: 'norma', fecha: 'fechaRevision', estado: 'cumple', responsable: 'responsable', vence: 'proximaRevision',
    campos: ['norma', 'anio', 'emisor', 'tema', 'articulos', 'requisito', 'evidencia', 'cumple', 'responsable', 'fechaRevision', 'proximaRevision', 'vigente', 'tipoRequisito', 'sistema', 'evaluo'] },
  documento: { hoja: 'Listado maestro', titulo: 'nombre', fecha: 'fechaAprobacion', estado: 'estado', responsable: 'aprobo', vence: 'proximaRevision',
    campos: ['codigo', 'nombre', 'tipoDoc', 'versionDoc', 'fechaAprobacion', 'aprobo', 'proximaRevision', 'retencion', 'ubicacion', 'estado'] },
  cambio: { hoja: 'Gestión del cambio', titulo: 'descripcion', fecha: 'fecha', estado: 'estado', responsable: 'solicitante', vence: 'fechaImplementacion',
    campos: ['descripcion', 'tipoCambio', 'fecha', 'solicitante', 'riesgos', 'actualizarMatriz', 'capacitacion', 'aprobo', 'fechaImplementacion', 'estado', 'acciones'] },
  proveedor: { hoja: 'Proveedores y contratistas', titulo: 'nombre', fecha: 'fechaEvaluacion', estado: 'resultado', responsable: 'servicio', vence: 'proximaEvaluacion',
    campos: ['nombre', 'nit', 'tipoProveedor', 'servicio', 'puntaje', 'resultado', 'calificacion0312', 'fechaEvaluacion', 'proximaEvaluacion', 'activo',
             /* v107: matriz y evaluación de proveedores (proveedores.html) */
             'categoria', 'categoriaNombre', 'nivel', 'critico', 'ciudad', 'contacto', 'correo', 'telefono', 'tipoEval', 'homologado', 'docsPct', 'excluyentesFaltan', 'sstPct', 'planMejora', 'evaluaciones', 'fechasEval', 'faltan3'] },
  /* v109: ingreso de un proveedor nuevo por etapas (necesidad → cotizaciones → selección → documentos → evaluación → alta) */
  compraprov: { hoja: 'Ingreso de proveedores (cotizaciones)', titulo: 'necesidad', fecha: 'fecha', estado: 'estadoProceso', responsable: 'responsable', vence: '',
    campos: ['necesidad', 'area', 'solicitud', 'fecha', 'responsable', 'monto', 'categoria', 'categoriaNombre', 'tipoProveedor', 'etapa', 'estadoProceso', 'detalleEtapa',
             'nCotizaciones', 'cotMinimas', 'elegido', 'elegidoNit', 'valorElegido', 'resultado', 'candidatos', 'cerrado', 'anulado', 'proveedorId'] },
  revision: { hoja: 'Revisión por la dirección', titulo: 'periodo', fecha: 'fecha', estado: 'estado', responsable: 'gerente', vence: '',
    campos: ['periodo', 'fecha', 'gerente', 'conclusion', 'decisiones', 'acciones', 'estado'] },
  rendicion: { hoja: 'Rendición de cuentas', titulo: 'nombre', fecha: 'fecha', estado: '', responsable: 'rol', vence: '',
    campos: ['nombre', 'rol', 'fecha', 'periodo', 'resumen'] },
  contratista: { hoja: 'Contratistas', titulo: 'nombre', fecha: 'fechaRevision', estado: 'estado', responsable: 'responsableSst', vence: 'venceDocs',
    campos: ['nombre', 'nit', 'servicio', 'arl', 'contacto', 'telefono', 'responsableSst', 'documentos', 'docsFaltan', 'docsVencidos', 'venceDocs', 'fechaRevision', 'estado', 'seleccionPuntaje', 'evalFecha', 'evalPuntaje', 'evalResultado'] },
  ingreso: { hoja: 'Ingresos de contratistas', titulo: 'contratista', fecha: 'fecha', estado: 'resultado', responsable: 'autorizo', vence: '',
    campos: ['fecha', 'contratista', 'sitio', 'trabajo', 'tareas', 'personas', 'autorizadas', 'noAutorizadas', 'resultado', 'autorizo'] },
  // v95: EPP, inducción, programas de alto riesgo y PESV
  eppcargo: { hoja: 'Matriz de EPP', titulo: 'cargo', fecha: 'fechaRevision', estado: '', responsable: 'area', vence: '',
    campos: ['cargo', 'area', 'elementosTexto', 'elementos', 'fechaRevision'], largos: ['elementosTexto'] },
  entrega: { hoja: 'Entregas de EPP', titulo: 'nombre', fecha: 'fecha', estado: 'motivo', responsable: 'entrego', vence: 'reponer',
    campos: ['nombre', 'cedula', 'cargo', 'fecha', 'motivo', 'elementosTexto', 'vencimientos', 'reponer', 'entrego', 'capacitado', 'reposicionTexto'], largos: ['elementosTexto', 'vencimientos', 'reposicionTexto'] },
  induccion: { hoja: 'Inducciones y reinducciones', titulo: 'nombre', fecha: 'fecha', estado: 'resultado', responsable: 'dicto', vence: 'vence',
    campos: ['nombre', 'cedula', 'cargo', 'empresa', 'tipoInduccion', 'fecha', 'temas', 'preguntas', 'puntaje', 'resultado', 'dicto', 'vence', 'autoservicio', 'autorizaDatos', 'autorizaSalud', 'intensidadHoras'] },
  programa: { hoja: 'Programas de alto riesgo', titulo: 'nombre', fecha: 'fechaRevision', estado: 'estado', responsable: 'coordinador', vence: 'proximaRevision',
    campos: ['programa', 'nombre', 'coordinador', 'cumplimiento', 'elementos', 'fechaRevision', 'proximaRevision', 'estado', 'personalTotal', 'personalVigente', 'equiposTotal', 'equiposAlDia'] },   // v109: personal y equipos en la lista
  pesv: { hoja: 'PESV', titulo: 'nivel', fecha: 'fechaRevision', estado: 'estado', responsable: 'lider', vence: 'proximaAuditoria',
    campos: ['nivel', 'vehiculos', 'conductores', 'lider', 'cumplimiento', 'pasosCumplen', 'pasosAplican', 'fechaRevision', 'proximaAuditoria', 'estado'] },
  vehiculo: { hoja: 'Vehículos', titulo: 'placa', fecha: '', estado: 'estado', responsable: 'conductor', vence: 'venceDocs',
    campos: ['placa', 'tipoVehiculo', 'marca', 'modelo', 'propiedad', 'conductor', 'soat', 'rtm', 'poliza', 'mantenimiento', 'venceDocs', 'estado'] },
  conductor: { hoja: 'Conductores', titulo: 'nombre', fecha: 'fechaEvaluacion', estado: 'estado', responsable: 'cargo', vence: 'vence',
    campos: ['nombre', 'cedula', 'cargo', 'categoria', 'venceLicencia', 'simit', 'capacitacionVial', 'pruebaConduccion', 'fechaEvaluacion', 'vence', 'estado'] },
  siniestro: { hoja: 'Siniestros viales', titulo: 'placa', fecha: 'fecha', estado: 'estado', responsable: 'conductor', vence: '',
    campos: ['fecha', 'placa', 'conductor', 'tipoSiniestro', 'lesionados', 'fallecidos', 'danos', 'investigacion', 'estado'] },
  // v96: ambiental (ISO 14001) y reporte anual de estándares mínimos
  aspecto: { hoja: 'Aspectos e impactos ambientales', titulo: 'aspecto', fecha: 'fechaRevision', estado: 'significancia', responsable: 'proceso', vence: '',
    campos: ['proceso', 'actividad', 'aspecto', 'impacto', 'condicion', 'frecuencia', 'severidad', 'alcance', 'legal', 'valor', 'significancia', 'controles', 'fechaRevision', 'tipoImpacto', 'norma', 'grupoAspecto'], largos: ['impacto'] },
  residuo: { hoja: 'Residuos', titulo: 'corriente', fecha: 'fecha', estado: 'clase', responsable: 'gestor', vence: '',
    campos: ['fecha', 'mes', 'clase', 'corriente', 'cantidad', 'unidad', 'gestor', 'certificado', 'manifiesto', 'densidad', 'kg'] },   // v107: kg = cantidad pasada a kilos (L o galones solo con densidad), para la media de RESPEL
  consumo: { hoja: 'Consumos', titulo: 'mes', fecha: 'fecha', estado: '', responsable: 'sede', vence: '',
    campos: ['mes', 'sede', 'agua', 'energia', 'combustible', 'gas', 'papel', 'trabajadores', 'produccion', 'unidadProduccion', 'observaciones'] },
  /* v107: inscripción del generador de RESPEL en el Registro Único Ambiental (RUA, Res. 0839 de 2023 de MinAmbiente;
     Decreto 1076 de 2015). Reporte anual según el último dígito del NIT: la fecha la calcula ambiental.html. */
  respel: { hoja: 'Registro de generador RESPEL', titulo: 'categoriaInscrita', fecha: 'ultimaActualizacion', estado: 'inscrito', responsable: 'autoridad', vence: 'proximaActualizacion',
    campos: ['inscrito', 'numeroRegistro', 'autoridad', 'categoriaInscrita', 'fechaInscripcion', 'ultimaActualizacion', 'periodoReportado', 'proximaActualizacion', 'pgirespel', 'nit'] },
  // v97: perfil de la empresa (define los estándares 7, 21 o 60) y clientes del asesor
  empresa: { hoja: 'Perfil de la empresa', titulo: 'nombre', fecha: 'fechaActualizacion', estado: 'grupo0312', responsable: 'claseRiesgo', vence: '',
    campos: ['nombre', 'nit', 'actividad', 'trabajadores', 'claseRiesgo', 'grupo0312', 'fechaActualizacion', 'correoSST', 'correoAsesor', 'areasTexto'], largos: ['areasTexto'], largoMax: 4000, saltos: true },
  cliente: { hoja: 'Clientes del asesor', titulo: 'nombre', fecha: 'ultimaVisita', estado: 'estado', responsable: 'contacto', vence: 'proximaVisita',
    campos: ['nombre', 'nit', 'ciudad', 'actividad', 'trabajadores', 'claseRiesgo', 'grupo0312', 'contacto', 'correo', 'telefono', 'sitio', 'codigo', 'ultimaVisita', 'proximaVisita', 'puntaje', 'tareasAbiertas', 'tareasVencidas', 'sincronizado', 'versionServidor', 'estado', 'tareasCerradas',
      // v116: configuración publicada desde la consola y vigilancia diaria de su servidor
      'publicado', 'modulosOn', 'modulosTotal', 'plan', 'estadoServidor', 'detalleServidor', 'revisadoServidor', 'apagadosServidor', 'usoServidor', 'guiaServidor'] },
  plantillainsp: { hoja: 'Listas de chequeo', titulo: 'nombre', fecha: '', estado: 'activa', responsable: 'reemplaza', vence: '',
    campos: ['nombre', 'icono', 'frecuencia', 'preoperacional', 'reemplaza', 'activa', 'vencimientosTexto', 'itemsTexto'], largos: ['vencimientosTexto', 'itemsTexto'], largoMax: 6000, saltos: true },
  proginsp: { hoja: 'Programa de inspecciones', titulo: 'titulo', fecha: '', estado: 'tipoInspeccion', responsable: 'responsable', vence: '',
    campos: ['anio', 'titulo', 'tipoInspeccion', 'plantilla', 'meses', 'responsable', 'activo'] },
  /* v149: dotación (CST art. 230): entregas con firma y tallas por persona */
  dotacion: { hoja: 'Entregas de dotación', titulo: 'nombre', fecha: 'fecha', estado: 'periodo', responsable: 'entrego', vence: '',
    campos: ['nombre', 'cedula', 'cargo', 'fecha', 'periodo', 'periodoNombre', 'itemsTexto', 'explicoUso', 'entrego'] },
  dotaperfil: { hoja: 'Tallas y derecho a dotación', titulo: 'nombre', fecha: '', estado: 'derecho', responsable: '', vence: '',
    campos: ['nombre', 'cedula', 'derecho', 'camisa', 'pantalon', 'calzado', 'otras'] },
  /* v150: informe trimestral/anual del Comité de Convivencia (Res. 3461 de 2025): solo cifras, sin nombres */
  informecc: { hoja: 'Informes Comité de Convivencia', titulo: 'periodoNombre', fecha: 'fechaInforme', estado: 'tipoInforme', responsable: '', vence: '',
    campos: ['periodo', 'periodoNombre', 'tipoInforme', 'fechaInforme', 'estadisticasTexto', 'actividades', 'recomendaciones'], largos: ['estadisticasTexto', 'actividades', 'recomendaciones'], largoMax: 6000, saltos: true },
  /* v148: aprobación de recursos por la gerencia (estándar 1.1.3 de la Res. 0312) */
  aprobrec: { hoja: 'Recursos aprobados', titulo: 'concepto', fecha: 'fecha', estado: 'estado', responsable: 'aprobo', vence: '',
    campos: ['concepto', 'monto', 'fecha', 'aprobo', 'cargo', 'estado', 'observaciones'] },
  /* v148: evidencia manual o «No aplica» justificado de un estándar de la Res. 0312 (carpeta de evidencias) */
  evid0312: { hoja: 'Evidencias 0312 a mano', titulo: 'estandar', fecha: 'fecha', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['estandar', 'estado', 'justificacion', 'fecha', 'responsable'] },
  /* v148: certificación de custodia de historias clínicas (estándar 3.1.5): el portal no guarda historias, solo la certificación */
  custodiahc: { hoja: 'Custodia de historias clínicas', titulo: 'ips', fecha: 'fecha', estado: 'estado', responsable: 'medico', vence: 'vence',
    campos: ['ips', 'medico', 'licencia', 'fecha', 'vence', 'certificado', 'estado'] },
  /* v147: matrices del sistema integrado (matrices-iso.html) */
  competencia: { hoja: 'Competencias por cargo', titulo: 'cargo', fecha: '', estado: 'sistema', responsable: 'responsable', vence: '',
    campos: ['cargo', 'sistema', 'educacion', 'formacion', 'experiencia', 'verificacion', 'responsable'] },
  auditorint: { hoja: 'Auditores internos', titulo: 'nombre', fecha: 'fechaFormacion', estado: 'estado', responsable: 'nombre', vence: '',
    campos: ['nombre', 'sistema', 'formacion', 'fechaFormacion', 'auditorias', 'procesoPropio', 'evaluacion', 'estado'] },
  calibracion: { hoja: 'Calibración de equipos', titulo: 'equipo', fecha: 'fechaCalibracion', estado: 'estado', responsable: 'laboratorio', vence: 'proxima',
    campos: ['equipo', 'codigo', 'sistema', 'uso', 'tipoControl', 'laboratorio', 'fechaCalibracion', 'proxima', 'certificado', 'estado'] },
  comunicacion: { hoja: 'Matriz de comunicaciones', titulo: 'queComunica', fecha: '', estado: 'tipoCom', responsable: 'responsable', vence: '',
    campos: ['queComunica', 'sistema', 'tipoCom', 'aQuien', 'cuando', 'como', 'responsable', 'evidencia'] },
  retencion: { hoja: 'Retención de registros', titulo: 'registro', fecha: '', estado: 'disposicion', responsable: 'responsable', vence: '',
    campos: ['registro', 'sistema', 'ubicacion', 'responsable', 'proteccion', 'anios', 'disposicion', 'base'] },
  /* Calidad (ISO 9001) */
  contextocal: { hoja: 'Contexto de la organización', titulo: 'alcance', fecha: 'fechaRevision', estado: '', responsable: 'responsable', vence: 'proximaRevision',
    campos: ['sistema', 'alcance', 'exclusiones', 'fortalezas', 'debilidades', 'oportunidades', 'amenazas', 'partes', 'fechaRevision', 'proximaRevision', 'responsable'] },
  riesgocal: { hoja: 'Riesgos y oportunidades', titulo: 'descripcion', fecha: 'fechaIdentificacion', estado: 'estado', responsable: 'responsable', vence: 'fechaCompromiso',
    campos: ['sistema', 'proceso', 'tipoRO', 'descripcion', 'causa', 'probabilidad', 'impacto', 'nivel', 'tratamiento', 'responsable', 'fechaIdentificacion', 'fechaCompromiso', 'estado', 'accionId'] },
  objcal: { hoja: 'Objetivos de calidad', titulo: 'objetivo', fecha: 'ultimoPeriodo', estado: 'cumple', responsable: 'responsable', vence: '',
    campos: ['sistema', 'objetivo', 'indicador', 'formula', 'meta', 'sentido', 'unidad', 'frecuencia', 'responsable', 'ultimoValor', 'ultimoPeriodo', 'cumple', 'estado'] },
  pnc: { hoja: 'Producto o servicio no conforme', titulo: 'producto', fecha: 'fecha', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['fecha', 'producto', 'cliente', 'descripcion', 'detectadoEn', 'cantidad', 'tratamiento', 'responsable', 'costo', 'requiereAC', 'accionId', 'estado', 'fechaCierre'] },
  // v162 · Derechos del titular (Ley 1581 de 2012, arts. 8, 14 y 15): consulta 10 días hábiles, reclamo 15.
  habeas: { hoja: 'Solicitudes de datos personales', titulo: 'nombre', fecha: 'fecha', estado: 'estado', responsable: 'responsable', vence: 'vence',
    campos: ['fecha', 'radicado', 'clase', 'derecho', 'nombre', 'cedula', 'contacto', 'detalle', 'estado', 'vence', 'responsable', 'respuesta', 'fechaRespuesta', 'verificacion'], largos: ['detalle', 'respuesta'], largoMax: 1500 },
  pqrs: { hoja: 'PQRS de clientes', titulo: 'cliente', fecha: 'fecha', estado: 'estado', responsable: 'responsable', vence: 'fechaLimite',
    campos: ['fecha', 'cliente', 'tipoPQRS', 'canal', 'descripcion', 'responsable', 'fechaLimite', 'respuesta', 'fechaRespuesta', 'procede', 'accionId', 'estado', 'presenta', 'contacto', 'area', 'origen', 'nFotos'], largos: ['descripcion'], largoMax: 400 },   // v109: también llegan desde «Reportar un evento» (sin usuario, ver limpiarPqrsPublica_)
  encuesta: { hoja: 'Satisfacción del cliente', titulo: 'cliente', fecha: 'fecha', estado: '', responsable: 'encuestado', vence: '',
    campos: ['fecha', 'cliente', 'periodo', 'calidad', 'oportunidad', 'atencion', 'precio', 'nps', 'promedio', 'comentario', 'encuestado'] },
  /* v107: encuestas que se envían al cliente por enlace (la clave del enlace NO va en la lista ni en la hoja) y lo que responde el cliente sin usuario */
  encuestacli: { hoja: 'Encuestas enviadas a clientes', titulo: 'cliente', fecha: 'fechaEnvio', estado: 'estado', responsable: 'contacto', vence: '',
    campos: ['cliente', 'contacto', 'cargo', 'correo', 'telefono', 'periodo', 'fechaEnvio', 'fechaLimite', 'nPreguntas', 'estado', 'fechaRespuesta', 'respuestaId', 'promedio', 'nps', 'enviadaPor'] },
  encresp: { hoja: 'Respuestas de clientes (enlace)', titulo: 'cliente', fecha: 'fecha', estado: '', responsable: 'encuestado', vence: '',
    campos: ['fecha', 'cliente', 'periodo', 'encuestaId', 'calidad', 'oportunidad', 'atencion', 'precio', 'nps', 'promedio', 'comentario', 'encuestado', 'cargo', 'canal', 'accionId', 'pqrsId'], largos: ['comentario'], largoMax: 1500 },
  /* v107: los trabajadores identifican los peligros de su trabajo (encuesta por categorías GTC 45, sin usuario) */
  encpeligro: { hoja: 'Percepción de peligros (trabajadores)', titulo: 'area', fecha: 'fecha', estado: '', responsable: 'cargo', vence: '',
    campos: ['fecha', 'area', 'proceso', 'cargo', 'nombre', 'anonima', 'nPeligros', 'clases', 'peligrosTexto', 'sugerencias'], largos: ['peligrosTexto', 'sugerencias'], largoMax: 3000 },
  /* v106: preoperacionales (los formularios de Google de la empresa, dentro del portal) */
  preop: { hoja: 'Preoperacionales', titulo: 'nombreFormulario', fecha: 'fecha', estado: 'resultado', responsable: 'responsable', vence: '',
    campos: ['formulario', 'nombreFormulario', 'codigo', 'fecha', 'responsable', 'cedula', 'cargo', 'codigoEquipo', 'equipoId', 'centro', 'resultado', 'malos', 'detalle'], largos: ['detalle'], largoMax: 6000, saltos: true },
  preopsalud: { hoja: 'Condiciones de salud (preoperacional)', titulo: 'nombreFormulario', fecha: 'fecha', estado: 'resultado', responsable: 'responsable', vence: '',
    campos: ['formulario', 'nombreFormulario', 'codigo', 'fecha', 'responsable', 'cedula', 'cargo', 'centro', 'resultado', 'malos', 'detalle'], largos: ['detalle'], largoMax: 6000, saltos: true },
  /* v105: cierre del mes (foto de cómo quedó cada mes, con el informe) */
  cierremes: { hoja: 'Cierres de mes', titulo: 'mes', fecha: 'fechaCierre', estado: 'estado', responsable: 'cerradoPor', vence: '',
    campos: ['mes', 'fechaCierre', 'cerradoPor', 'trabajadores', 'accidentes', 'frecuencia', 'severidad', 'ausentismo', 'inspProgramadas', 'inspHechas', 'planProgramadas', 'planHechas',
             'accionesAbiertas', 'accionesVencidas', 'accionesCerradas', 'pasosOk', 'pasosTotal', 'observaciones', 'estado'] },
  /* v128: buzón reservado del Comité de Convivencia (quejas de acoso laboral y reportes de acoso sexual).
     El trabajador lo llena sin usuario y llega CIFRADO con la llave pública del comité: el servidor
     y la hoja solo ven el código, la clase y la fecha. Solo el comité, con su clave, lo puede leer. */
  buzon: { hoja: 'Buzón del comité (sin datos)', titulo: 'clase', fecha: 'fecha', estado: 'estado', responsable: '', vence: '',
    campos: ['codigo', 'clase', 'fecha', 'estado'] },
  reporteanual: { hoja: 'Reporte anual 0312', titulo: 'anio', fecha: 'fechaRegistro', estado: 'estado', responsable: 'responsable', vence: '',
    campos: ['anio', 'puntaje', 'valoracion', 'fechaAutoevaluacion', 'acciones', 'fechaRegistro', 'radicado', 'fechaArl', 'responsable', 'estado'] },
  // v139: plantillas de tareas frecuentes (lo que se llena siempre igual en un formulario), para todo el equipo.
  plantillaform: { hoja: 'Plantillas de formularios', titulo: 'nombre', fecha: '', estado: '', responsable: 'pagina', vence: '',
    campos: ['nombre', 'pagina', 'grupo', 'datos'], largos: ['datos'], largoMax: 6000 }
};
/* Qué dice el correo diario cuando vence algo de estos tipos. */
const AVISO_GEN = { habeas: 'Responder solicitud de datos personales (Ley 1581)', sustancia: 'Hoja de seguridad', medicion: 'Medición ambiental', emergencia: 'Actualizar el plan de emergencias', examen: 'Examen médico', psico: 'Aplicar la batería psicosocial',
  politica: 'Revisar la política de SST', legal: 'Revisar la norma', documento: 'Revisar el documento', proveedor: 'Reevaluar al proveedor', cambio: 'Implementar el cambio',
  contratista: 'Documentos del contratista', induccion: 'Reinducción en SST', programa: 'Revisar el programa', pesv: 'PESV: auditoría anual',
  vehiculo: 'Documentos del vehículo (SOAT, revisión técnico-mecánica, mantenimiento)', conductor: 'Requisitos del conductor (licencia, capacitación)',
  cliente: 'Visita al cliente', pqrs: 'Responder la PQRS', riesgocal: 'Tratar el riesgo u oportunidad', calibracion: 'Calibrar el equipo de medición', custodiahc: 'Renovar la certificación de custodia de historias clínicas', contextocal: 'Revisar el contexto (DOFA y partes interesadas)', gestquim: 'Capacitación anual en el SGA (Res. 773 de 2021, art. 21)',
  respel: 'Reportar el año anterior en el Registro Único Ambiental (RUA) como generador de RESPEL (fecha según el último dígito del NIT · Res. 0839 de 2023)' };
const TIPOS = ['trabajador', 'reporte', 'accion', 'mes', 'equipo', 'inspeccion', 'comite', 'reunion', 'queja', 'auditoria'].concat(Object.keys(TIPOS_GEN));
/* De una queja solo se aceptan estos campos; todo lo demás va dentro de "cifrado". */
// v175: Decreto 1040 de 2026 (solo fechas y una marca, fuera del cifrado)
const CAMPOS_QUEJA = [
  'codigo', 'fechaRecepcion', 'etapa', 'estado', 'fechaCierre', 'inicioEtapa', 'venceEtapa', 'venceTotal', 'cifrado', 'medSolicitud', 'medAdopcion', 'medSexual', 'protegeHasta'];
const COLS_REG = ['id', 'tipo', 'version', 'estado', 'fecha', 'titulo', 'responsable', 'vence', 'resumen', 'createdAt', 'updatedAt', 'borrado'];
const MAX_CHARS_CELDA = 32000;   // v142: tope de Excel por celda (el respaldo .xlsx no trunca los trozos)

/* ================= LIBRO Y HOJAS ================= */
function libro_() {
  const activa = SpreadsheetApp.getActiveSpreadsheet();
  if (activa) return activa;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SGSST_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const nuevo = SpreadsheetApp.create('Gestión SG-SST - Portal SSTA');
  props.setProperty('SGSST_SHEET_ID', nuevo.getId());
  return nuevo;
}
/** ▶ Ejecutar a mano: autoriza el script y muestra la URL de la hoja. */
function verLibro() {
  const ss = libro_();
  regSheet_(); datosSheet_(); imgSheet_(); eventosSheet_();
  Object.keys(VISTAS).forEach(function (t) { vistaSheet_(t); });
  console.log('Hoja del SG-SST: ' + ss.getUrl());
}
// v151: en una misma petición cada hoja se busca una sola vez (antes, varias veces por cada guardado).
let HOJAS_CACHE_ = {};
function hoja_(nombre, encabezado) {
  if (HOJAS_CACHE_[nombre]) return HOJAS_CACHE_[nombre];
  const ss = libro_();
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(encabezado);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  HOJAS_CACHE_[nombre] = sheet;
  return sheet;
}
function regSheet_() { return hoja_('Registros', COLS_REG); }
function datosSheet_() { return hoja_('Datos', ['id', 'parte', 'texto', 'updatedAt']); }
function imgSheet_() { return hoja_('Imagenes', ['id', 'imgKey', 'dataUrl', 'updatedAt']); }
function eventosSheet_() { return hoja_('Eventos', ['ts', 'id', 'accion', 'resultado', 'detalle', 'opId', 'version', 'tipo']); }

function filasPorValor_(sheet, columna, valor) {
  const last = sheet.getLastRow();
  if (last < 2 || !valor) return [];
  return sheet.getRange(2, columna, last - 1, 1)
    .createTextFinder(String(valor)).matchEntireCell(true).matchCase(true).findAll()
    .map(function (r) { return r.getRow(); });
}
function borrarFilasDe_(sheet, id) {
  const filas = filasPorValor_(sheet, 1, id).sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < filas.length) {
    let inicio = filas[i], cuantas = 1;
    while (i + cuantas < filas.length && filas[i + cuantas] === inicio - 1) { inicio--; cuantas++; }
    sheet.deleteRows(inicio, cuantas);
    i += cuantas;
  }
}

/* ================= FECHAS ================= */
let ZONA_ = null;   // v142: la zona del libro se pide una sola vez por ejecución (antes, dos veces por fila de cada lista)
function zonaHoraria_() { if (ZONA_) return ZONA_; ZONA_ = 'America/Bogota'; try { ZONA_ = libro_().getSpreadsheetTimeZone() || ZONA_; } catch (e) {} return ZONA_; }
function fechaISO_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, zonaHoraria_(), 'yyyy-MM-dd');
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? '' : v).trim());
  return m ? m[1] : String(v == null ? '' : v).trim();
}
function hoyISO_() { return Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'); }
function sumarDias_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
/* Festivos de Colombia (Ley 51 de 1983 "Emiliani" y Semana Santa). La misma
   cuenta está en common.js (Festivos) para que el celular y el correo digan
   el mismo plazo. */
function festivosCO_(anio) {
  const iso = function (d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); };
  const lunes = function (d) { const w = d.getUTCDay(); if (w !== 1) d.setUTCDate(d.getUTCDate() + ((8 - w) % 7)); return d; };
  const f = function (m, d) { return new Date(Date.UTC(anio, m - 1, d)); };
  // Domingo de Pascua (algoritmo de Butcher)
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 19 * l) / 433);
  const mes = Math.floor((h + l - 7 * m + 90) / 25), dia = (h + l - 7 * m + 33 * mes + 19) % 32;
  const pascua = f(mes, dia);
  const masPascua = function (n) { const x = new Date(pascua.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
  const lista = [f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25), masPascua(-3), masPascua(-2),
    lunes(f(1, 6)), lunes(f(3, 19)), lunes(f(6, 29)), lunes(f(8, 15)), lunes(f(10, 12)), lunes(f(11, 1)), lunes(f(11, 11)),
    lunes(masPascua(39)), lunes(masPascua(60)), lunes(masPascua(68))];
  const out = {}; lista.forEach(function (x) { out[iso(x)] = true; });
  return out;
}
function esHabil_(iso) {
  const p = iso.split('-').map(Number), w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return w !== 0 && w !== 6 && !festivosCO_(p[0])[iso];
}
function sumarHabiles_(iso, n) { let d = iso, k = 0; while (k < n) { d = sumarDias_(d, 1); if (esHabil_(d)) k++; } return d; }

/* ================= BITÁCORA E IDEMPOTENCIA ================= */
function registrarEvento_(id, accion, resultado, detalle, opId, version, tipo) {
  try {
    const fila = [new Date(), celda_(String(id || '').slice(0, 120)), accion, resultado, celda_(String(detalle || '').slice(0, 2000)), celda_(String(opId || '').slice(0, 120)), version || '', celda_(String(tipo || '').slice(0, 40))];   // v145: nada sin limpiar en la bitácora
    const quien = etiquetaUsuario_();
    const s = eventosSheet_();
    // Bitácoras creadas antes de los usuarios o de la cadena: se agregan los títulos de las columnas.
    if (!CTX_.colUsuario) { if (s.getRange(1, 9).getValue() !== 'usuario') s.getRange(1, 9, 1, 3).setValues([['usuario', 'hash', 'hashAnterior']]); else if (s.getRange(1, 10).getValue() !== 'hash') s.getRange(1, 10, 1, 2).setValues([['hash', 'hashAnterior']]); CTX_.colUsuario = true; }
    fila.push(quien ? celda_(quien) : '');
    // v162 · Bitácora encadenada: cada fila lleva SHA-256(hash de la fila anterior + la fila). Si alguien edita,
    // borra o mete una fila a mano en la hoja, «verificarBitacora» dice desde cuál se rompió la cadena.
    // v163: si quien llama YA tiene el candado (doPost, restaurar, archivar) no se pide otra vez: en Apps Script el
    // candado del script no se anida, y soltarlo aquí dejaba sin protección el resto del guardado.
    const yaBloqueado = LOCK_TOMADO_ > 0;
    const lock = yaBloqueado ? null : LockService.getScriptLock(); let tengo = false;
    if (!yaBloqueado) try { lock.waitLock(10000); tengo = true; } catch (e) {}
    try {
      const ult = s.getLastRow(), ant = ult >= 2 ? String(s.getRange(ult, 10).getValue() || '') : '';
      fila.push(hashEvento_(ant, fila), ant);
      s.appendRow(fila);
    } finally { if (tengo) lock.releaseLock(); }
  } catch (e) {}
}
/** La fila tal como se encadena: fecha al segundo en UTC y las columnas 2 a 9 como texto. */
function textoEvento_(fila) {
  const ts = fila[0] instanceof Date ? Utilities.formatDate(fila[0], 'UTC', "yyyy-MM-dd'T'HH:mm:ss") : String(fila[0] || '');
  return [ts].concat(fila.slice(1, 9).map(function (v) { return v instanceof Date ? Utilities.formatDate(v, 'UTC', "yyyy-MM-dd'T'HH:mm:ss") : String(v === null || v === undefined ? '' : v); })).join('\u241f');
}
function hashEvento_(anterior, fila) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(anterior || '') + '\u241e' + textoEvento_(fila), Utilities.Charset.UTF_8)); }
/** Revisa la cadena de la bitácora. Devuelve {ok, filas, sinCadena, primeraRota (fila de la hoja), motivo}. */
function verificarBitacora_() {
  const s = eventosSheet_(), n = s.getLastRow() - 1; if (n < 1) return { ok: true, filas: 0, sinCadena: 0 };
  const v = s.getRange(2, 1, n, 11).getValues();
  let previo = null, sinCadena = 0, revisadas = 0;
  for (let i = 0; i < v.length; i++) {
    const h = String(v[i][9] || ''), ant = String(v[i][10] || '');
    if (!h) { if (previo === null) { sinCadena++; continue; } return { ok: false, filas: revisadas, sinCadena: sinCadena, primeraRota: i + 2, motivo: 'fila sin huella en medio de la cadena (agregada a mano)' }; }
    if (previo !== null && ant !== previo) return { ok: false, filas: revisadas, sinCadena: sinCadena, primeraRota: i + 2, motivo: 'no sigue a la fila anterior (se borró o se movió una fila)' };
    if (hashEvento_(ant, v[i]) !== h) return { ok: false, filas: revisadas, sinCadena: sinCadena, primeraRota: i + 2, motivo: 'el contenido de la fila cambió después de escrita' };
    previo = h; revisadas++;
  }
  return { ok: true, filas: revisadas, sinCadena: sinCadena };
}
/** Para ejecutar a mano desde el editor de Apps Script. */
function verificarBitacora() { const r = verificarBitacora_(); console.log(JSON.stringify(r)); return r.ok ? 'Bitácora íntegra: ' + r.filas + ' fila(s) encadenadas' + (r.sinCadena ? ' (' + r.sinCadena + ' anteriores a la cadena)' : '') + '.' : 'BITÁCORA ALTERADA desde la fila ' + r.primeraRota + ': ' + r.motivo + '.'; }
function opIdYaAplicado_(opId) {
  if (!opId) return false;
  const sheet = eventosSheet_();
  const rows = filasPorValor_(sheet, 6, opId);
  for (let i = 0; i < rows.length; i++) if (sheet.getRange(rows[i], 4).getValue() === 'APLICADO') return true;
  return false;
}

/* ================= USUARIOS, SESIONES Y PERMISOS =================
   Mientras no exista la hoja "Usuarios", nada de esto se aplica (modo de
   siempre: la clave del portal basta). Con usuarios:
     · escribir exige sesión (salvo crear un reporte o una acción nueva:
       cualquiera puede reportar un peligro sin usuario);
     · leer exige sesión (salvo la lista de personal habilitado, que usan los
       permisos de trabajo en campo);
     · cada rol escribe solo lo suyo (ESCRIBE_ROL) y los datos de salud
       individuales los ven solo Administrador y SST. */
const ROLES = { admin: 'Administrador', sst: 'SST (todo el SG-SST)', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta (gerencia, auditor)' };
const ESCRIBE_ROL = {
  supervisor: ['tarea', 'reporte', 'inspeccion', 'equipo', 'accion', 'simulacro', 'ingreso', 'entrega', 'solrepo', 'dotacion', 'dotaperfil', 'induccion', 'siniestro', 'preop', 'preopsalud', 'encpeligro', 'plantillaform'],
  comite: ['tarea', 'cumple1040', 'reunion', 'queja', 'buzon', 'comite', 'informecc', 'accion', 'reporte', 'inspeccion', 'proginsp', 'preop', 'preopsalud', 'encpeligro'],
  consulta: ['tarea', 'revision', 'aprobrec']   // v148: la alta dirección firma su revisión y aprueba recursos (Dec. 1072, art. 2.2.4.6.31; estándar 1.1.3)
};
const LIBRE_SIN_SESION = ['reporte', 'accion', 'preop', 'preopsalud', 'encresp', 'encpeligro', 'induccion', 'pqrs', 'buzon', 'habeas'];   // v162: habeas = solicitudes de derechos del titular   // crear (no editar) sin usuario (el preoperacional lo llena quien usa el equipo; encresp: el cliente responde la encuesta del enlace, ver validarRespuestaEnc_; pqrs: v109, la arma el servidor con limpiarPqrsPublica_)
const SOLO_SST = ['examen', 'ausencia', 'perfil', 'sve', 'pvecaso', 'psico', 'preopsalud', 'cliente', 'habeas', 'reintegro'];   // v169: reintegro   // salud individual y conexiones a clientes
const ITER_USUARIO = 150000;
const USR_COLS = ['usuario', 'nombre', 'cedula', 'cargo', 'rol', 'correo', 'activo', 'salt', 'iter', 'hash', 'debeCambiar', 'sesionDesde', 'intentos', 'bloqueadoHasta', 'ultimoIngreso', 'creado', 'actualizado', 'comites'];   // v148: comites al final (las hojas viejas la ganan sola)
const HORAS_SESION = { personal: 24 * 30, compartido: 12, sensible: 12 };   // v142: admin y SST (ven salud) 12 h

/* Contexto de la petición en curso (se reinicia en cada doGet/doPost). */
var CTX_ = { modo: false, u: null, colUsuario: false };
// v163: cuántas veces tiene ESTA ejecución el candado del script (para no pedirlo dos veces).
var LOCK_TOMADO_ = 0;
/* v162 · ENLACES PARA AUDITORES (ARL, Ministerio, consultor, cliente): el administrador crea un enlace con nombre,
   vencimiento y los módulos que puede ver. Quien lo abre entra sin usuario, SOLO a leer esos módulos (nunca salud ni
   quejas de convivencia) y cada consulta queda en la bitácora con su nombre. Se puede revocar en cualquier momento.
   En las propiedades solo se guarda la huella del enlace, no el enlace. */
const GRUPOS_AUDITOR_ = { personal: ['trabajador', 'induccion'], inspecciones: ['inspeccion', 'equipo', 'proginsp'], reportes: ['reporte', 'accion'], plan: ['plananual', 'mes', 'politica'],
  peligros: ['peligro', 'revmatriz', 'legal'], comites: ['comite', 'reunion'], epp: ['entrega', 'eppcargo'], emergencias: ['emergencia', 'simulacro'], documentos: ['documento'], auditorias: ['auditoria', 'revision', 'evid0312'], contratistas: ['contratista', 'proveedor'] };
function enlacesAuditor_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('ENLACES_AUDITOR') || '[]'); } catch (e) { return []; } }
function guardarEnlacesAuditor_(l) { PropertiesService.getScriptProperties().setProperty('ENLACES_AUDITOR', JSON.stringify(l.slice(-40))); }
function huellaAuditor_(t) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'aud|' + String(t), Utilities.Charset.UTF_8)); }
function contextoAuditor_(p) {
  const h = huellaAuditor_(texto_(p.auditor)), a = enlacesAuditor_().find(function (x) { return x.h === h; });
  if (!a || a.revocado || a.vence < hoyISO_()) return { ok: false, codigoError: 'PERMISO', error: 'Este enlace de auditoría no existe, venció o fue revocado. Pídele uno nuevo a la empresa.' };
  const tipos = [].concat.apply([], (a.grupos || []).map(function (g) { return GRUPOS_AUDITOR_[g] || []; })).filter(function (t) { return SOLO_SST.indexOf(t) === -1 && TIPOS_SALUD_.indexOf(t) === -1; });
  CTX_.modo = true; CTX_.u = { usuario: 'auditor', nombre: 'Auditor: ' + a.nombre, rol: 'consulta', debeCambiar: 'No', auditor: true };
  if (p.action === 'auditorInfo') return { ok: true, nombre: a.nombre, vence: a.vence, grupos: a.grupos, tipos: tipos, empresa: nombreEmpresa_(perfilEmpresa_()) };
  const pide = p.action === 'list' || p.list ? texto_(p.tipo).split(',').filter(Boolean) : (p.action === 'doc' || p.id) ? [(function () { const f = filaDe_(texto_(p.id)); return f === -1 ? '' : leerFila_(f).tipo; })()] : null;
  if (!pide || !pide.length || pide.some(function (t) { return tipos.indexOf(t) === -1; })) { registrarEvento_(texto_(p.id || p.tipo), 'AUDITOR', 'RECHAZADO', 'Fuera del alcance del enlace (' + a.nombre + ')', '', '', 'auditor'); return { ok: false, codigoError: 'PERMISO', error: 'Ese módulo no está en tu enlace de auditoría.' }; }
  registrarEvento_(texto_(p.id || p.tipo), 'AUDITOR', 'APLICADO', 'Consulta de ' + a.nombre + (p.id ? ' · ' + texto_(p.id) : ' · lista'), '', '', 'auditor');
  return null;   // sigue el camino normal de lectura, con rol de solo consulta
}
function crearEnlaceAuditor_(body) {
  const no = soloAdmin_(); if (no) return no;
  const nombre = corto_(body.nombre, 80), dias = Math.max(1, Math.min(30, Number(body.dias) || 7)), grupos = (Array.isArray(body.grupos) ? body.grupos : []).filter(function (g) { return GRUPOS_AUDITOR_[g]; });
  if (nombre.length < 3 || !grupos.length) return { ok: false, error: 'Escribe quién es el auditor y elige al menos un módulo.' };
  const t = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), l = enlacesAuditor_();
  const x = { id: 'AUD-' + Utilities.getUuid().slice(0, 8), h: huellaAuditor_(t), nombre: nombre, grupos: grupos, vence: sumarDias_(hoyISO_(), dias), creado: hoyISO_(), por: etiquetaUsuario_() };
  l.push(x); guardarEnlacesAuditor_(l);
  registrarEvento_(x.id, 'AUDITOR', 'CREADO', 'Enlace para ' + nombre + ' hasta el ' + x.vence + ': ' + grupos.join(', '), body.opId || '', '', 'auditor');
  return { ok: true, token: t, enlace: { id: x.id, nombre: nombre, grupos: grupos, vence: x.vence } };
}
function revocarEnlaceAuditor_(body) {
  const no = soloAdmin_(); if (no) return no;
  const l = enlacesAuditor_(), x = l.find(function (y) { return y.id === texto_(body.id); }); if (!x) return { ok: false, error: 'No existe ese enlace.' };
  x.revocado = hoyISO_(); guardarEnlacesAuditor_(l); registrarEvento_(x.id, 'AUDITOR', 'APLICADO', 'Enlace de ' + x.nombre + ' revocado', body.opId || '', '', 'auditor');
  return { ok: true };
}
function iniciarContexto_(tokenSesion) {
  CTX_ = { modo: false, u: null, colUsuario: false, sesionVencida: false };
  CTX_.modo = modoUsuarios_();
  if (CTX_.modo && tokenSesion) {
    const r = validarSesion_(tokenSesion);
    if (r && r.vencida) CTX_.sesionVencida = true; else if (r) CTX_.u = r;
  }
}
function etiquetaUsuario_() {
  if (!CTX_.modo) return '';
  return CTX_.u ? CTX_.u.nombre + ' (' + CTX_.u.usuario + ')' : 'Sin sesión';
}
function yo_() { const u = CTX_.u; return u ? { usuario: u.usuario, nombre: u.nombre, rol: u.rol, cargo: u.cargo, debeCambiar: u.debeCambiar === 'Sí' } : null; }
function errSesion_() {
  return { ok: false, codigoError: 'SESION', error: CTX_.sesionVencida ? 'Tu sesión venció: vuelve a entrar con tu usuario.' : 'Entra con tu usuario del portal para hacer esto.' };
}
function errPermiso_(m) { return { ok: false, codigoError: 'PERMISO', error: m }; }

function usuariosSheet_(crear) {
  const ss = libro_();
  let s = ss.getSheetByName('Usuarios');
  if (!s && crear) { s = hoja_('Usuarios', USR_COLS); }
  if (s && s.getLastColumn() < USR_COLS.length) s.getRange(1, USR_COLS.length).setValue(USR_COLS[USR_COLS.length - 1]);   // v148
  return s;
}
function modoUsuarios_() { const s = usuariosSheet_(false); return !!(s && s.getLastRow() >= 2); }
function ms_(v) { if (v instanceof Date) return v.getTime(); const n = Number(v); return isNaN(n) ? 0 : n; }
function leerUsuarios_() {
  if (CTX_.usuarios) return CTX_.usuarios;
  const s = usuariosSheet_(false), out = [];
  if (s && s.getLastRow() >= 2) {
    s.getRange(2, 1, s.getLastRow() - 1, USR_COLS.length).getValues().forEach(function (v, i) {
      if (!v[0]) return;
      const o = { _fila: i + 2 }; USR_COLS.forEach(function (c, j) { o[c] = v[j]; });
      o.usuario = String(o.usuario).trim().toLowerCase();
      out.push(o);
    });
  }
  CTX_.usuarios = out;
  return out;
}
function buscarUsuario_(u) { u = String(u || '').trim().toLowerCase(); return leerUsuarios_().filter(function (x) { return x.usuario === u; })[0] || null; }
function escribirUsuario_(o) {
  const s = usuariosSheet_(true);
  const fila = USR_COLS.map(function (c) {
    const v = o[c] == null ? '' : o[c];
    // Textos que Sheets convertiría en número o fecha (cédula, sal, huella) van como texto.
    return ['usuario', 'cedula', 'salt', 'hash', 'nombre', 'cargo', 'correo'].indexOf(c) !== -1 ? "'" + String(v) : v;
  });
  if (o._fila) s.getRange(o._fila, 1, 1, fila.length).setValues([fila]);
  else { s.appendRow(fila); o._fila = s.getLastRow(); }
  CTX_.usuarios = null;
}

/* ── Firma de las sesiones (HMAC con un secreto que solo vive en este proyecto) ── */
function secretoSesion_() {
  const p = PropertiesService.getScriptProperties();
  let s = p.getProperty('SECRETO_SESION');
  if (!s) {
    // Se crea una sola vez, con candado (dos peticiones a la vez no deben crear dos).
    const l = LockService.getScriptLock(); let tengo = false;
    try { tengo = l.tryLock(10000); } catch (e) {}
    try { s = p.getProperty('SECRETO_SESION'); if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SECRETO_SESION', s); } }
    finally { if (tengo) try { l.releaseLock(); } catch (e) {} }
  }
  return s;
}
function b64url_(bytesOTexto) { return Utilities.base64EncodeWebSafe(bytesOTexto).replace(/=+$/, ''); }
/** v145: compara dos textos sin revelar por el tiempo cuántos caracteres coinciden. */
function igualSeguro_(a, b) { a = String(a || ''); b = String(b || ''); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; }
function hmac_(texto) { return b64url_(Utilities.computeHmacSha256Signature(texto, secretoSesion_())); }
function hex_(bytes) { return bytes.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join(''); }
function firmarSesion_(usuario, compartido, desde, rol) {
  // Siempre posterior al último cierre de sesiones (si no, nacería cerrada).
  const ahora = Math.max(Date.now(), ms_(desde) + 1);
  const horas = compartido ? HORAS_SESION.compartido : (rol === 'admin' || rol === 'sst' ? HORAS_SESION.sensible : HORAS_SESION.personal);
  const carga = b64url_(JSON.stringify({ u: usuario, iat: ahora, exp: ahora + horas * 3600000, c: compartido ? 1 : 0 }));
  return { token: 'v1.' + carga + '.' + hmac_(carga), exp: ahora + horas * 3600000 };
}
function validarSesion_(tok) {
  const p = String(tok || '').split('.');
  if (p.length !== 3 || p[0] !== 'v1' || !p[1] || !igualSeguro_(hmac_(p[1]), p[2])) return null;   // v145: comparación en tiempo constante
  let c;
  try { c = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(p[1] + '==='.slice((p[1].length + 3) % 4))).getDataAsString()); } catch (e) { return null; }
  if (!c || !c.u || !(c.exp > Date.now())) return { vencida: true };
  const u = buscarUsuario_(c.u);
  if (!u || u.activo !== 'Sí') return null;
  if (Number(c.iat) <= ms_(u.sesionDesde)) return { vencida: true };   // se cerraron sus sesiones o cambió la clave
  u._compartido = !!c.c;
  return u;
}

/** v112: el enrutador del servidor único (00-Portal) pregunta aquí si una petición a lo de la
 *  obra (permisos, ATS, charlas, EPP, personal autorizado) trae una sesión válida.
 *  { modo:false } = la empresa no usa usuarios (todo sigue como antes);
 *  { modo:true, error } = falta entrar o cambiar la clave temporal; { modo:true, usuario, nombre, rol } = sí. */
function revisarSesionObra(tokenSesion) {
  iniciarContexto_(tokenSesion);
  if (!CTX_.modo) return { modo: false };
  if (!CTX_.u) return { modo: true, error: errSesion_() };
  if (CTX_.u.debeCambiar === 'Sí') return { modo: true, error: { ok: false, codigoError: 'CAMBIAR', error: 'Primero cambia tu clave temporal (botón 👤 arriba).' } };
  return { modo: true, usuario: CTX_.u.usuario, nombre: CTX_.u.nombre, rol: CTX_.u.rol };
}

/* ── Quién puede qué ── */
function esSst_() { return !CTX_.modo || (CTX_.u && (CTX_.u.rol === 'admin' || CTX_.u.rol === 'sst')); }
function puedeEscribir_(tipo, accion, existe) {
  if (!CTX_.modo) return null;
  const u = CTX_.u;
  const libre = !existe && accion === 'guardar' && LIBRE_SIN_SESION.indexOf(tipo) !== -1;
  if (!u) return libre ? null : errSesion_();
  if (u.debeCambiar === 'Sí') return { ok: false, codigoError: 'CAMBIAR', error: 'Primero cambia tu clave temporal (botón 👤 arriba).' };
  if (u.rol === 'admin' || u.rol === 'sst' || libre) return null;
  if ((ESCRIBE_ROL[u.rol] || []).indexOf(tipo) !== -1) {
    // v148: un supervisor o el comité pueden CREAR el preoperacional de salud de alguien, no leer ni cambiar uno ya guardado.
    if (existe && (SOLO_SST.indexOf(tipo) !== -1 || tipo === 'queja' && u.rol !== 'comite')) return errPermiso_('Tu usuario no puede modificar este registro.');
    return null;
  }
  return errPermiso_('Tu usuario (' + (ROLES[u.rol] || u.rol) + ') no puede modificar este tipo de registro. Pídeselo al área SST.');
}
/* v134: contra spam en lo que se crea sin usuario (reportes, PQRS, preoperacional, buzón…):
   envíos hechos en menos de 1,5 s desde que abrió la página (robot) y más de 40 por tipo cada 10 minutos. */
function antiSpam_(tipo, body, existe) {
  if (!CTX_.modo || CTX_.u || existe || body.action !== 'guardar' || LIBRE_SIN_SESION.indexOf(tipo) === -1) return null;
  if (body._ms != null && Number(body._ms) < 1500) return { ok: false, codigoError: 'SPAM', error: 'Envío demasiado rápido. Revisa los datos y vuelve a enviar.' };
  // v145: lo que llega sin usuario no puede pesar de más ni traer campos que solo pone el área SST
  // (estado, origen del asesor, investigación, reportes a la ARL…): se quitan antes de guardar.
  const d = body.doc || {};
  let pesa = 0; try { pesa = JSON.stringify(d).length; } catch (e) {}
  if (pesa > 4 * 1024 * 1024) return { ok: false, codigoError: 'SPAM', error: 'El envío es demasiado grande (muchas fotos). Envía máximo 6 fotos.' };
  ['origen', 'asignadaPor', 'investigacion', 'furat', 'mintrabajo', 'remisionArl', 'cierre', 'verificacion', 'eficaz'].forEach(function (k) { delete d[k]; });
  if (d.estado != null && !/^(ABIERTO|ABIERTA|PENDIENTE|NUEVO)$/i.test(String(d.estado))) d.estado = 'ABIERTO';   // no puede llegar «cerrado» sin usuario
  if (Array.isArray(d.fotos) && d.fotos.length > 6) d.fotos = d.fotos.slice(0, 6);
  const c = cacheScript_(); if (!c) return null;
  const k = 'anon:' + tipo + ':' + Math.floor(Date.now() / 600000), n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 900);
  return n > 40 ? { ok: false, codigoError: 'SPAM', error: 'Llegaron demasiados envíos sin usuario en pocos minutos. Espera un rato o entra con tu usuario.' } : null;
}
function puedeLeer_(tipo) {
  // v142: sin usuarios creados, la clave del portal es pública: los datos de salud, el buzón y las
  // quejas NO se entregan a nadie hasta que exista el administrador (antes cualquiera los leía).
  if (!CTX_.modo) return SOLO_SST.indexOf(tipo) === -1 && tipo !== 'buzon' && tipo !== 'queja';   // v145: tampoco las conexiones a clientes; v148: ni las quejas de convivencia
  if (!CTX_.u || CTX_.u.debeCambiar === 'Sí') return false;
  if (tipo === 'buzon' || tipo === 'queja') return esSst_() || (CTX_.u.rol === 'comite' && deConvivencia_());   // v148: Res. 3461 de 2025, reserva de las quejas   // v128: aunque va cifrado, ni que exista se muestra a otros
  return SOLO_SST.indexOf(tipo) === -1 || esSst_();
}
/* Las restricciones médicas (texto libre) solo las ven Administrador y SST;
   los demás ven si es apto o no (lo que necesitan los permisos de trabajo). */
/** v142: Ley 1581 art. 6. Lo que la PERSONA declara de su salud (preoperacional de salud) exige su
 *  autorización expresa. Lo que registra el área SST (exámenes, ausencias, SVE, psicosocial) se trata por
 *  obligación legal: si la persona no dio la autorización en su ficha, queda escrita la base legal. */
const TIPOS_SALUD_ = ['examen', 'sve', 'pvecaso', 'psico', 'ausencia', 'preopsalud', 'reintegro'];
const BASE_LEGAL_SST_ = 'Obligación legal del empleador (Decreto 1072 de 2015, art. 2.2.4.6.24; Resolución 1843 de 2025): vigilancia de la salud de los trabajadores. Registrado por el área SST.';
function autorizacionSalud_(tipo, d) {
  if (TIPOS_SALUD_.indexOf(tipo) === -1) return null;
  if (d.autorizaSalud === true || texto_(d.baseLegal).trim().length >= 10) return null;
  if (tipo === 'preopsalud') return { ok: false, codigoError: 'AUTORIZACION', error: 'Para guardar datos de tu salud hace falta tu autorización (Ley 1581 de 2012).' };
  const ced = texto_(d.cedula).replace(/\D/g, '');
  if (ced) {
    try {
      const sh = regSheet_(), m = sh.getLastRow();
      if (m > 1) { const f = sh.getRange(2, 1, m - 1, 12).getValues().filter(function (r) { if (r[1] !== 'trabajador' || r[11]) return false; try { return String(JSON.parse(r[8] || '{}').cedula || '').replace(/\\D/g, '') === ced; } catch (e) { return false; } })[0];   // v145: cédula con o sin puntos
        if (f) { const res = JSON.parse(f[8] || '{}'); if (res.autorizacion && res.autorizacion.sensibles === true) { d.autorizaSalud = true; return null; } } }
    } catch (e) {}
  }
  d.baseLegal = BASE_LEGAL_SST_;
  return null;
}
/** v142: lo que se entrega del personal SIN sesión: nombre, cédula, cargo y vigencia de requisitos,
 *  sin restricciones médicas, área, fecha de ingreso ni contacto de emergencia. */
function trabajadorPublico_(r) {
  const req = {}; Object.keys(r.req || {}).forEach(function (k) { const x = r.req[k] || {}; req[k] = { fecha: x.fecha, vence: x.vence, apto: x.apto }; if (!x.apto && k !== 'medico' && x.soporte) req[k].soporte = x.soporte; });   // apto: lo usan los permisos en campo; v148: sin foto del concepto médico
  const out = {}; Object.keys(r).forEach(function (k) { if (['area', 'fechaIngreso', 'emer', 'autorizacion', 'celular', 'cedulasAnteriores'].indexOf(k) === -1) out[k] = r[k]; });
  out.req = req; return out;
}
function sinRestricciones_(req) {
  // v148: también la foto del concepto médico (soporte de un requisito con aptitud): mostraba lo que escribió el médico.
  Object.keys(req || {}).forEach(function (k) { const x = req[k]; if (!x) return; if (x.restricciones) x.restricciones = '(reservado)'; if ((x.apto || k === 'medico') && x.soporte) x.soporte = ''; });
}
/** v148: el quórum lo calcula el servidor (mitad más uno de los principales; el suplente cubre al principal ausente). */
function quorumActa_(as) {
  as = (as || []).filter(Boolean);
  const princ = as.filter(function (a) { return a.calidad === 'Principal'; }), total = princ.length || as.length;
  let pres = 0;
  if (!princ.length) pres = as.filter(function (a) { return a.asistio === 'Sí'; }).length;
  else ['Empleador', 'Trabajadores'].forEach(function (rep) {
    const p = as.filter(function (a) { return a.representa === rep && a.calidad === 'Principal'; }), s = as.filter(function (a) { return a.representa === rep && a.calidad === 'Suplente'; });
    const pp = p.filter(function (a) { return a.asistio === 'Sí'; }).length;
    pres += pp + Math.min(s.filter(function (a) { return a.asistio === 'Sí'; }).length, p.length - pp);
  });
  return total > 0 && pres >= Math.floor(total / 2) + 1;
}
/** v148: SST con usuario de verdad. Sin usuarios creados la clave del portal es pública: nadie ve lo médico. */
function sstConSesion_() { return !!(CTX_.modo && CTX_.u && (CTX_.u.rol === 'admin' || CTX_.u.rol === 'sst')); }
/** v148: las actas del Comité de Convivencia solo las leen el comité y SST (Res. 3461 de 2025, art. 8). */
function actaReservada_(tipo, res) { return tipo === 'reunion' && String((res && res.comite) || '').toLowerCase() === 'convivencia' && !(CTX_.modo && CTX_.u && (esSst_() || (CTX_.u.rol === 'comite' && deConvivencia_()))); }
/** v148: un integrante del COPASST o de Emergencias no ve lo de Convivencia. Si al usuario no se le marcó ningún comité, vale como antes. */
function deConvivencia_() { const c = String((CTX_.u && CTX_.u.comites) || '').trim(); return !c || c.split(',').indexOf('convivencia') !== -1; }
function soloAdmin_() {
  if (!CTX_.modo) return errPermiso_('Primero crea el administrador (▶ codigoAdministrador en Apps Script).');
  if (!CTX_.u) return errSesion_();
  if (CTX_.u.rol !== 'admin') return errPermiso_('Solo un administrador puede hacer esto.');
  if (CTX_.u.debeCambiar === 'Sí') return { ok: false, codigoError: 'CAMBIAR', error: 'Primero cambia tu clave temporal (botón 👤 arriba).' };
  return null;
}

/* ── Entrar, cambiar la clave y administrar usuarios ── */
function salDe_(usuario) {
  const u = buscarUsuario_(usuario);
  // A un usuario que no existe se le da una sal fija (no se revela quién existe).
  return u ? { salt: String(u.salt), iter: Number(u.iter) || ITER_USUARIO } : { salt: hex_(Utilities.computeHmacSha256Signature('sal|' + String(usuario).toLowerCase(), secretoSesion_())).slice(0, 32), iter: ITER_USUARIO };
}
/** v137: muchos intentos fallidos en una hora (de cualquier usuario, también inventados) avisa: alguien está probando claves. */
function fallosEntrada_() {
  const c = cacheScript_(); if (!c) return;
  const k = 'fallos:' + Math.floor(Date.now() / 3600000), n = Number(c.get(k) || 0) + 1; c.put(k, String(n), 3700);
  if (n === 20) alarma_('fallos-hora', 'Muchos intentos de entrada fallidos', 'En la última hora hubo 20 intentos de entrar al portal con usuario o clave incorrectos. Puede ser alguien probando claves. Revisa la bitácora (ENTRAR · RECHAZADO) y, si hace falta, cambia las claves.', 120);
}
function entrar_(body) {
  const u = buscarUsuario_(body.usuario), ahora = Date.now();
  // Un solo mensaje para todo (usuario que no existe, clave mala o bloqueado): no revela quién existe.
  const malo = { ok: false, codigoError: 'ENTRAR', error: 'Usuario o clave incorrectos. Después de 5 intentos fallidos hay que esperar 15 minutos.' };
  // v145: un usuario que no existe tarda lo mismo que una clave mala (no se puede saber quién existe por el tiempo)
  if (!u || u.activo !== 'Sí') { registrarEvento_('', 'ENTRAR', 'RECHAZADO', 'Usuario desconocido o inactivo: ' + corto_(body.usuario, 40), body.opId, '', 'usuario'); fallosEntrada_(); try { Utilities.sleep(250 + Math.floor(Math.random() * 350)); } catch (e) {} return malo; }
  // v147: el bloqueo de 15 minutos es por equipo (disp): alguien que prueba claves desde su
  // celular no deja por fuera al dueño de la cuenta en el suyo. El bloqueo de toda la cuenta
  // queda solo para 20 fallos seguidos (muchos equipos a la vez = ataque).
  const disp = String(body.disp || '').replace(/[^\w-]/g, '').slice(0, 40);
  const cache = CacheService.getScriptCache(), kDisp = disp ? 'fallo:' + u.usuario + ':' + disp : '';
  const fallosDisp = kDisp ? Number(cache.get(kDisp)) || 0 : 0;
  if (kDisp && fallosDisp >= 5) { registrarEvento_('', 'ENTRAR', 'RECHAZADO', 'Equipo bloqueado por intentos fallidos: ' + u.usuario, body.opId, '', 'usuario'); return malo; }
  if (ms_(u.bloqueadoHasta) > ahora) { registrarEvento_('', 'ENTRAR', 'RECHAZADO', 'Bloqueado por intentos fallidos: ' + u.usuario, body.opId, '', 'usuario'); return malo; }
  if (!body.prueba || hashPrueba_(body.prueba) !== String(u.hash)) {
    if (kDisp) cache.put(kDisp, String(fallosDisp + 1), 15 * 60);
    u.intentos = (Number(u.intentos) || 0) + 1;
    if (u.intentos >= (disp ? 20 : 5)) { u.intentos = 0; u.bloqueadoHasta = ahora + 15 * 60000; alarma_('bloqueo:' + u.usuario, 'Usuario bloqueado por claves incorrectas', 'Alguien escribió 5 veces una clave incorrecta para el usuario «' + u.usuario + '» (' + texto_(u.nombre) + '). Quedó bloqueado 15 minutos. Si no fue esa persona, cámbiale la clave en Usuarios.', 60); }
    escribirUsuario_(u);
    registrarEvento_('', 'ENTRAR', 'RECHAZADO', 'Clave incorrecta: ' + u.usuario, body.opId, '', 'usuario');
    fallosEntrada_();
    return malo;
  }
  u.intentos = 0; u.bloqueadoHasta = ''; u.ultimoIngreso = new Date();
  if (kDisp) cache.remove(kDisp);
  escribirUsuario_(u);
  CTX_.u = u;
  registrarEvento_('', 'ENTRAR', 'APLICADO', body.compartido ? 'Equipo compartido (12 h)' : 'Equipo personal', body.opId, '', 'usuario');
  const s = firmarSesion_(u.usuario, !!body.compartido, u.sesionDesde, u.rol);
  return { ok: true, sesion: s.token, exp: s.exp, yo: yo_() };
}
function validarClaveNueva_(body) {
  if (!/^[0-9a-f]{32}$/.test(String(body.salt || ''))) return 'Sal inválida.';
  if (!body.pruebaNueva || String(body.pruebaNueva).length < 20) return 'Falta la clave nueva.';
  const it = Number(body.iter);
  if (!(it >= 100000 && it <= 2000000)) return 'Parámetros de la clave inválidos.';
  return '';
}
function cambiarMiClave_(body) {
  const u = CTX_.u; if (!u) return errSesion_();
  if (ms_(u.bloqueadoHasta) > Date.now()) return { ok: false, error: 'Demasiados intentos fallidos: espera 15 minutos.' };
  if (!body.prueba || hashPrueba_(body.prueba) !== String(u.hash)) {
    u.intentos = (Number(u.intentos) || 0) + 1;
    if (u.intentos >= 5) { u.intentos = 0; u.bloqueadoHasta = Date.now() + 15 * 60000; }
    escribirUsuario_(u);
    registrarEvento_('', 'CLAVE', 'RECHAZADO', 'Clave actual incorrecta', body.opId, '', 'usuario');
    return { ok: false, error: 'La clave actual no es correcta.' };
  }
  const e = validarClaveNueva_(body); if (e) return { ok: false, error: e };
  if (hashPrueba_(body.pruebaNueva) === String(u.hash)) return { ok: false, error: 'La clave nueva debe ser distinta de la actual.' };
  u.salt = body.salt; u.iter = Number(body.iter) || ITER_USUARIO; u.hash = hashPrueba_(body.pruebaNueva);
  u.debeCambiar = 'No'; u.sesionDesde = Date.now(); u.actualizado = new Date();
  escribirUsuario_(u);
  registrarEvento_('', 'CLAVE', 'APLICADO', 'Cambió su clave (se cerraron sus otras sesiones)', body.opId, '', 'usuario');
  const s = firmarSesion_(u.usuario, !!u._compartido, u.sesionDesde, u.rol);
  return { ok: true, sesion: s.token, exp: s.exp, yo: yo_() };
}
function admins_() { return leerUsuarios_().filter(function (x) { return x.rol === 'admin' && x.activo === 'Sí'; }); }
function datosUsuario_(o, body) {
  const nombre = corto_(body.nombre, 80);
  if (!nombre) return 'Falta el nombre.';
  if (body.rol && !ROLES[body.rol]) return 'Rol desconocido.';
  o.nombre = nombre; o.cedula = corto_(body.cedula, 20); o.cargo = corto_(body.cargo, 60); o.correo = corto_(body.correo, 80);
  if (body.rol) o.rol = body.rol;
  if (body.comites !== undefined) o.comites = String(body.comites || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return ['copasst', 'convivencia', 'emergencias'].indexOf(x) !== -1; }).join(',');
  return '';
}
function guardarUsuario_(body) {
  const no = soloAdmin_(); if (no) return no;
  const usuario = String(body.usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return { ok: false, error: 'El usuario va en minúsculas, sin espacios (3 a 30 letras, números, punto o guion).' };
  let o = buscarUsuario_(usuario);
  if (o && body.nuevo) return { ok: false, error: 'Ya existe el usuario «' + usuario + '». Ábrelo en la lista para cambiarlo.' };
  const nuevo = !o;
  if (nuevo) o = { usuario: usuario, activo: 'Sí', rol: 'consulta', intentos: 0, sesionDesde: 0, creado: new Date() };
  const e = datosUsuario_(o, body); if (e) return { ok: false, error: e };
  if (body.activo === false || body.activo === 'No') o.activo = 'No'; else if (body.activo === true || body.activo === 'Sí') o.activo = 'Sí';
  // Nunca queda el portal sin administrador activo.
  if (!nuevo && (o.rol !== 'admin' || o.activo !== 'Sí') && admins_().filter(function (x) { return x.usuario !== o.usuario; }).length === 0) return { ok: false, error: 'Tiene que quedar al menos un administrador activo.' };
  let detalle = nuevo ? 'Creó el usuario (' + (ROLES[o.rol] || o.rol) + ')' : 'Cambió los datos (' + (ROLES[o.rol] || o.rol) + (o.activo === 'Sí' ? '' : ', INACTIVO') + ')';
  if (body.pruebaNueva) {
    const e2 = validarClaveNueva_(body); if (e2) return { ok: false, error: e2 };
    o.salt = body.salt; o.iter = Number(body.iter) || ITER_USUARIO; o.hash = hashPrueba_(body.pruebaNueva);
    o.debeCambiar = 'Sí'; o.intentos = 0; o.bloqueadoHasta = ''; o.sesionDesde = Date.now();
    detalle += nuevo ? ' con clave temporal' : ' · clave temporal nueva (se cerraron sus sesiones)';
  } else if (nuevo) return { ok: false, error: 'Falta la clave temporal.' };
  if (body.cerrarSesiones || o.activo !== 'Sí') { o.sesionDesde = Date.now(); if (body.cerrarSesiones) detalle += ' · cerró sus sesiones'; }
  const eraAdmin = !nuevo && buscarUsuario_(o.usuario) && buscarUsuario_(o.usuario).rol === 'admin';
  o.actualizado = new Date();
  escribirUsuario_(o);
  if (o.rol === 'admin' && o.activo === 'Sí' && (nuevo || !eraAdmin)) alarma_('admin:' + o.usuario, 'Nuevo administrador del portal', 'Se ' + (nuevo ? 'creó' : 'le dio rol de administrador a') + ' el usuario «' + o.usuario + '» (' + texto_(o.nombre) + '), por ' + (CTX_.u ? CTX_.u.usuario : 'el sistema') + '. Un administrador puede ver y cambiar todo. Si no lo reconoces, desactívalo en Usuarios.', 1);
  registrarEvento_(o.usuario, 'USUARIO', 'APLICADO', detalle, body.opId, '', 'usuario');
  return { ok: true, usuario: publicoUsuario_(o) };
}
function publicoUsuario_(o) {
  return { usuario: o.usuario, nombre: texto_(o.nombre), cedula: texto_(o.cedula), cargo: texto_(o.cargo), rol: texto_(o.rol), correo: texto_(o.correo),
           comites: texto_(o.comites), activo: o.activo === 'Sí', debeCambiar: o.debeCambiar === 'Sí', bloqueado: ms_(o.bloqueadoHasta) > Date.now(),
           ultimoIngreso: o.ultimoIngreso instanceof Date ? o.ultimoIngreso.toISOString() : texto_(o.ultimoIngreso) };
}
/** ▶ Ejecutar a mano: da un código (vale 2 horas, un solo uso) para crear el
 *  primer administrador desde el portal, o para recuperar el acceso si nadie
 *  recuerda la clave de administrador. Solo lo ve quien abre este proyecto. */
function codigoAdministrador() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = '';
  for (let i = 0; i < 10; i++) c += a.charAt(Math.floor(Math.random() * a.length));
  c = c.slice(0, 5) + '-' + c.slice(5);
  PropertiesService.getScriptProperties().setProperty('CODIGO_ADMIN', JSON.stringify({ codigo: c, exp: Date.now() + 2 * 3600000 }));
  console.log('Código de administrador (vale 2 horas, un solo uso): ' + c + '\nEn el portal: Inicio → Usuarios → "Crear o recuperar el administrador".');
  return c;
}
function primerAdmin_(body) {
  const p = PropertiesService.getScriptProperties();
  let c = null; try { c = JSON.parse(p.getProperty('CODIGO_ADMIN') || 'null'); } catch (e) {}
  if (!c || !c.codigo || c.exp < Date.now() || String(body.codigo || '').trim().toUpperCase() !== c.codigo) {
    registrarEvento_('', 'USUARIO', 'RECHAZADO', 'Código de administrador inválido o vencido', body.opId, '', 'usuario');
    return { ok: false, error: 'Código inválido o vencido. Genera otro con ▶ codigoAdministrador en Apps Script.' };
  }
  const usuario = String(body.usuario || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return { ok: false, error: 'El usuario va en minúsculas, sin espacios (3 a 30 letras, números, punto o guion).' };
  const e2 = validarClaveNueva_(body); if (e2) return { ok: false, error: e2 };
  let o = buscarUsuario_(usuario); const nuevo = !o;
  if (nuevo) o = { usuario: usuario, creado: new Date() };
  const e = datosUsuario_(o, Object.assign({}, body, { rol: 'admin' })); if (e) return { ok: false, error: e };
  o.activo = 'Sí'; o.salt = body.salt; o.iter = Number(body.iter) || ITER_USUARIO; o.hash = hashPrueba_(body.pruebaNueva);
  o.debeCambiar = 'No'; o.intentos = 0; o.bloqueadoHasta = ''; o.sesionDesde = Date.now(); o.actualizado = new Date();
  escribirUsuario_(o);
  p.deleteProperty('CODIGO_ADMIN');
  CTX_.modo = true; CTX_.u = o;
  registrarEvento_(o.usuario, 'USUARIO', 'APLICADO', nuevo ? 'Administrador creado con código' : 'Administrador recuperado con código', body.opId, '', 'usuario');
  const s = firmarSesion_(o.usuario, false, o.sesionDesde, o.rol);
  return { ok: true, sesion: s.token, exp: s.exp, yo: yo_() };
}

/* ── Qué cambió (para la bitácora): campos de primer nivel distintos ── */
const NO_COMPARAR_ = { id: 1, tipo: 1, version: 1, creado: 1, actualizado: 1, registradoPor: 1, modificadoPor: 1 };
function camposCambiados_(antes, despues) {
  const ks = {}, out = [];
  Object.keys(antes || {}).forEach(function (k) { ks[k] = 1; }); Object.keys(despues || {}).forEach(function (k) { ks[k] = 1; });
  Object.keys(ks).forEach(function (k) { if (!NO_COMPARAR_[k] && JSON.stringify((antes || {})[k]) !== JSON.stringify((despues || {})[k])) out.push(k); });
  return out;
}

/* ================= TROCEO E IMÁGENES ================= */
function trocear_(clave, texto) {
  if (texto.length <= MAX_CHARS_CELDA) return [{ key: clave, texto: texto }];
  const total = Math.ceil(texto.length / MAX_CHARS_CELDA), out = [];
  for (let i = 0; i < total; i++) out.push({ key: clave + '~' + (i + 1) + '/' + total, texto: texto.substr(i * MAX_CHARS_CELDA, MAX_CHARS_CELDA) });
  return out;
}
// v145: si un guardado anterior dejó filas (p. ej. se cortó al borrar), vale SOLO la última versión escrita:
// la última fila de cada clave dice si fue en una celda o en N trozos, y solo se usan los trozos de ese total.
function reensamblar_(filas) {
  const mapa = {}, partes = {}, ultima = {};
  filas.forEach(function (f) {
    const key = String(f.key), pos = key.indexOf('~');
    if (pos === -1) { mapa[key] = f.texto; ultima[key] = 'uno'; return; }
    const base = key.substring(0, pos), resto = key.substring(pos + 1).split('/'), n = parseInt(resto[0], 10) || 1, total = parseInt(resto[1], 10) || 0;
    (partes[base] = partes[base] || []).push({ n: n, total: total, texto: f.texto });
    ultima[base] = 'trozos' + total;
  });
  for (const base in partes) {
    if (ultima[base] === 'uno') continue;   // lo último escrito fue en una sola celda
    const total = parseInt(ultima[base].slice(6), 10) || 0, ult = {};
    partes[base].forEach(function (p) { if (!total || p.total === total) ult[p.n] = p.texto; });
    mapa[base] = Object.keys(ult).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return ult[n]; }).join('');
  }
  return mapa;
}
function leerTrozos_(sheet, id) {
  const rows = filasPorValor_(sheet, 1, id).sort(function (a, b) { return a - b; });
  if (!rows.length) return [];
  const minR = rows[0], maxR = rows[rows.length - 1];
  const vals = sheet.getRange(minR, 2, maxR - minR + 1, 2).getValues();
  return rows.map(function (r) { return { key: vals[r - minR][0], texto: vals[r - minR][1] }; });
}
function claveImg_(dataUrl) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, dataUrl);
  return digest.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('').substring(0, 14);
}
/** Cambia cada imagen (data:image…) por "IMGREF:xxxx" y la anota aparte. */
function extraerImagenes_(obj, mapa) {
  // También las que van sueltas en listas (fotos: ["data:image…", …]).
  if (typeof obj === 'string') {
    if (obj.indexOf('data:image') !== 0) return obj;
    const key = claveImg_(obj); mapa.push({ key: key, dataUrl: obj }); return 'IMGREF:' + key;
  }
  if (Array.isArray(obj)) return obj.map(function (x) { return extraerImagenes_(x, mapa); });
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).forEach(function (k) { if (!CLAVE_PELIGROSA_[k]) out[k] = extraerImagenes_(obj[k], mapa); });
    return out;
  }
  return obj;
}
function rehidratar_(obj, mapa) {
  if (typeof obj === 'string') return obj.indexOf('IMGREF:') === 0 ? (mapa[obj.substring(7)] || '') : obj;
  if (Array.isArray(obj)) return obj.map(function (x) { return rehidratar_(x, mapa); });
  if (obj && typeof obj === 'object') {
    const out = {};
    Object.keys(obj).forEach(function (k) { if (!CLAVE_PELIGROSA_[k]) out[k] = rehidratar_(obj[k], mapa); });
    return out;
  }
  return obj;
}
/* Un texto que empieza con = + - @ en una celda lo ejecuta Sheets como fórmula.
   Los trozos de datos y fotos van siempre con ' delante: un trozo que empiece por
   "-10-02" o "+Ab" Sheets lo convertiría en número, fecha o fórmula. */
function celda_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function guardarImagenes_(id, mapa) {
  if (!mapa.length) return;
  const sheet = imgSheet_(), existentes = {};
  leerTrozos_(sheet, id).forEach(function (f) { const k = String(f.key); existentes[k.indexOf('~') === -1 ? k : k.substring(0, k.indexOf('~'))] = true; });
  const ahora = new Date(), filas = [], vistas = {};
  mapa.forEach(function (f) {
    if (existentes[f.key] || vistas[f.key]) return;
    vistas[f.key] = true;
    trocear_(f.key, f.dataUrl).forEach(function (t) { filas.push([id, t.key, "'" + t.texto, ahora]); });
  });
  if (filas.length) sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, 4).setValues(filas);
}

/* ================= DOCUMENTOS ================= */
/** v142: el resumen nunca se corta a la mitad (quedaba un JSON inválido y el registro salía en blanco):
 *  si no cabe, se acortan los textos y listas más largos hasta que quepa. */
function resumenCelda_(r) {
  let t = JSON.stringify(r); if (t.length <= 30000) return t;
  const o = JSON.parse(t);
  for (let lim = 2000; lim >= 50 && t.length > 30000; lim = Math.floor(lim / 2)) {
    Object.keys(o).forEach(function (k) {
      if (typeof o[k] === 'string' && o[k].length > lim) o[k] = o[k].slice(0, lim - 1) + '…';
      else if (Array.isArray(o[k]) && JSON.stringify(o[k]).length > lim * 4) o[k] = o[k].slice(0, Math.max(5, Math.floor(o[k].length / 2)));
      else if (o[k] && typeof o[k] === 'object' && JSON.stringify(o[k]).length > lim * 4) { const ks = Object.keys(o[k]); ks.slice(Math.floor(ks.length / 2)).forEach(function (x) { delete o[k][x]; }); o[k]._recortado = true; }
    });
    t = JSON.stringify(o);
  }
  if (t.length > 30000) t = JSON.stringify({ _recortado: true, titulo: String(r.titulo || r.nombre || '').slice(0, 200) });
  return t;
}
function texto_(x) { return x == null ? '' : String(x); }
function corto_(x, n) { const t = texto_(x).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
function filaDe_(id) { const r = filasPorValor_(regSheet_(), 1, id); return r.length ? r[0] : -1; }
/* ═══ v149: firma de actas con enlace ═══
   El secretario del comité comparte un enlace (WhatsApp o QR) por acta. Quien lo abre ve esa acta
   (fecha, número, comité; de Convivencia nada del contenido) y firma con su nombre y cédula. La clave
   es un HMAC del id del acta: sirve solo para ESA acta y solo para firmar. */
/* v162 · PORTAL DEL CONTRATISTA: un enlace (o QR) por contratista con una clave HMAC de su id. Con él ve sus
   documentos y vencimientos, sube los soportes y registra a su personal; todo queda «por revisar» hasta que SST
   lo apruebe. No ve nada más de la empresa. Si SST cambia la clave (nuevo enlace), el anterior deja de servir. */
function claveContratista_(id) {
  const pr = PropertiesService.getScriptProperties();
  let sec = pr.getProperty('ENLACES_CONTRATISTAS'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('ENLACES_CONTRATISTAS', sec); }
  const v = pr.getProperty('CTR_VER_' + id) || '1';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('ctr:' + String(id || '') + ':' + v, sec)).slice(0, 24);
}
/* v169 · PANTALLA DE PLANTA: un televisor en la planta muestra días sin accidentes, reportes del mes y acciones
   vencidas. Un televisor no inicia sesión, así que entra con un enlace con clave (HMAC), que SST puede cambiar para
   dejar sin servicio el anterior. Solo entrega CIFRAS: ningún nombre, cédula ni descripción. */
function clavePantalla_() {
  const pr = PropertiesService.getScriptProperties();
  let sec = pr.getProperty('ENLACE_PANTALLA'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('ENLACE_PANTALLA', sec); }
  const v = pr.getProperty('PANTALLA_VER') || '1';
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('pantalla:' + v, sec)).slice(0, 24);
}
function enlacePantalla_(p) {
  if (CTX_.modo && !sstConSesion_()) return CTX_.u ? errPermiso_('El enlace de la pantalla lo crea SST.') : errSesion_();
  if (p.nuevo === '1') {
    const pr = PropertiesService.getScriptProperties(); pr.setProperty('PANTALLA_VER', String(Number(pr.getProperty('PANTALLA_VER') || '1') + 1));
    registrarEvento_('PANTALLA', 'PANTALLA', 'APLICADO', 'Enlace de la pantalla de planta cambiado (el anterior dejó de servir)', '', '', '');
  }
  return { ok: true, k: clavePantalla_() };
}
function pantallaPlanta_(p) {
  if (!p.k || texto_(p.k) !== clavePantalla_()) return { ok: false, codigoError: 'CLAVE', error: 'Este enlace de pantalla ya no sirve. Pide uno nuevo al área SST.' };
  const hoy = hoyISO_(), mes = hoy.slice(0, 7), reg = regSheet_(), last = reg.getLastRow();
  const filas = last < 2 ? [] : reg.getRange(2, 1, last - 1, COLS_REG.length).getValues();
  const acc = [], rep = { actos: 0, condiciones: 0, incidentes: 0, accidentes: 0, total: 0 };
  let abiertas = 0, vencidas = 0, inspMes = 0;
  filas.forEach(function (v) {
    if (!v[0] || v[11]) return; const tipo = v[1];
    if (tipo !== 'reporte' && tipo !== 'accion' && tipo !== 'inspeccion') return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    if (tipo === 'reporte') {
      const f = texto_(r.fecha).slice(0, 10), c = texto_(r.clase);
      if (/Accidente de trabajo/i.test(c) && /^\d{4}-\d{2}-\d{2}$/.test(f)) acc.push(f);
      if (f.slice(0, 7) !== mes) return;
      rep.total++;
      if (/Accidente/i.test(c)) rep.accidentes++; else if (/Incidente/i.test(c)) rep.incidentes++; else if (/Acto/i.test(c)) rep.actos++; else if (/Condici/i.test(c)) rep.condiciones++;
    } else if (tipo === 'accion' && v[3] !== 'CERRADA') {
      abiertas++; const fc = texto_(r.fechaCompromiso).slice(0, 10); if (fc && fc < hoy) vencidas++;
    } else if (tipo === 'inspeccion' && texto_(r.fecha).slice(0, 7) === mes) inspMes++;
  });
  acc.sort();
  const dias = function (a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); };
  const ultimo = acc.length ? acc[acc.length - 1] : '';
  let record = 0; for (let i = 1; i < acc.length; i++) record = Math.max(record, dias(acc[i - 1], acc[i]));
  const sinAcc = ultimo ? Math.max(0, dias(ultimo, hoy)) : null;
  if (sinAcc !== null) record = Math.max(record, sinAcc);
  const perfil = perfilEmpresa_();
  const accAnio = acc.filter(function (f) { return f.slice(0, 4) === hoy.slice(0, 4); }).length;
  return { ok: true, empresa: nombreEmpresa_(perfil), hoy: hoy, diasSinAccidente: sinAcc, ultimoAccidente: ultimo, record: record, accidentesAnio: accAnio,
    reportesMes: rep, accionesAbiertas: abiertas, accionesVencidas: vencidas, inspeccionesMes: inspMes, generado: new Date().toISOString() };
}
function contratistaDeEnlace_(id, k) {
  id = texto_(id); if (!/^CTR-|^CON-|^[A-Z]{2,5}-/.test(id) || !k || texto_(k) !== claveContratista_(id)) return null;
  const f = filaDe_(id); if (f === -1) return null; const r = leerFila_(f); if (r.borrado || r.tipo !== 'contratista') return null;
  return { id: id, doc: leerDoc_(id, false) || {}, fila: r };
}
function contratistaPortal_(p) {
  const c = contratistaDeEnlace_(p.id, p.k); if (!c) return { ok: false, codigoError: 'PERMISO', error: 'El enlace no es válido o fue cambiado. Pídele uno nuevo al área SST de la empresa.' };
  const d = c.doc, nom = normalizar_(texto_(d.nombre)).trim(), reg = regSheet_(), last = reg.getLastRow(), tr = [];
  if (last >= 2) reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (v[1] !== 'trabajador' || v[11]) return; let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    if (normalizar_(texto_(r.empresa)).trim() !== nom || r.activo === false) return;
    const req = {}; Object.keys(r.req || {}).forEach(function (q) { if (q !== 'medico' && q !== 'alimentos') req[q] = { vence: texto_((r.req[q] || {}).vence) }; });
    tr.push({ nombre: texto_(r.nombre), cedula: '••••' + texto_(r.cedula).replace(/\D/g, '').slice(-4), cargo: texto_(r.cargo), req: req, porRevisar: !!r.porRevisar });
  });
  registrarEvento_(c.id, 'CONTRATISTA', 'APLICADO', 'Consulta del portal del contratista', '', '', 'contratista');
  return { ok: true, empresa: nombreEmpresa_(perfilEmpresa_()), contratista: { id: c.id, nombre: texto_(d.nombre), nit: texto_(d.nit) }, documentos: d.documentos || {}, trabajadores: tr };
}
function contratistaEscribe_(body) {
  const c = contratistaDeEnlace_(body.id, body.k); if (!c) return { ok: false, codigoError: 'PERMISO', error: 'El enlace no es válido o fue cambiado.' };
  iniciarContexto_(''); const antes = CTX_.u;
  CTX_.u = { usuario: 'contratista', nombre: 'Contratista ' + texto_(c.doc.nombre), rol: 'sst', debeCambiar: 'No' };   // solo para pasar por los caminos internos, ya validado el enlace
  try {
    if (body.action === 'contratistaSubir') {
      const k = texto_(body.doc).replace(/[^a-z0-9_]/gi, '').slice(0, 30), fecha = texto_(body.fecha).slice(0, 10), meses = Math.max(0, Math.min(24, Number(body.meses) || 0));
      if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoyISO_()) return { ok: false, error: 'Elige el documento y la fecha de expedición (no futura).' };
      if (!body.base64) return { ok: false, error: 'Adjunta el archivo (PDF o foto).' };
      const uid = 'ctr-' + k + '-' + Utilities.getUuid().slice(0, 8);
      const ad = adjuntar_({ id: c.id, uid: uid, nombre: texto_(body.nombre).slice(0, 120) || (k + '.pdf'), mime: texto_(body.mime), base64: body.base64, ref: k, opId: texto_(body.opId) });
      if (!ad.ok) return ad;
      const docs = Object.assign({}, c.doc.documentos || {}), vence = meses ? (function () { const q = fecha.split('-').map(Number); return Utilities.formatDate(new Date(q[0], q[1] - 1 + meses, q[2]), 'America/Bogota', 'yyyy-MM-dd'); })() : '';
      docs[k] = Object.assign({}, docs[k] || {}, { fecha: fecha, vence: vence, adjunto: uid, porRevisar: true, subido: hoyISO_() });
      const r = guardar_({ action: 'parche', tipo: 'contratista', id: c.id, campos: { documentos: docs }, opId: texto_(body.opId) + '-d', _interno: true });
      return r.ok ? { ok: true, documento: k, vence: vence } : r;
    }
    const ced = texto_(body.cedula).replace(/\D/g, ''), nombre = corto_(body.nombre, 120);
    if (ced.length < 6 || ced.length > 10 || nombre.length < 5) return { ok: false, error: 'Escribe el nombre completo y la cédula (6 a 10 dígitos).' };
    const id = 'TRB-' + ced, f = filaDe_(id);
    if (f !== -1) { const prev = leerDoc_(id, false) || {}; if (normalizar_(texto_(prev.empresa)).trim() !== normalizar_(texto_(c.doc.nombre)).trim()) return { ok: false, error: 'Esa persona ya está registrada con otra empresa: pídele a SST que la cambie.' }; }
    const campos = { nombre: nombre, cedula: ced, cargo: corto_(body.cargo, 80), empresa: texto_(c.doc.nombre), activo: true, porRevisar: true };
    const r = f === -1 ? guardar_({ action: 'guardar', tipo: 'trabajador', id: id, doc: Object.assign({ req: {} }, campos), versionBase: 0, opId: texto_(body.opId), _interno: true })
      : guardar_({ action: 'parche', tipo: 'trabajador', id: id, campos: { nombre: nombre, cargo: campos.cargo, porRevisar: true }, opId: texto_(body.opId), _interno: true });
    return r.ok ? { ok: true, id: id } : r;
  } finally { CTX_.u = antes; }
}
function enlaceContratista_(p) { if (CTX_.modo && !sstConSesion_()) return CTX_.u ? errPermiso_('El enlace del contratista lo crea SST.') : errSesion_();
  const id = texto_(p.id); if (p.nuevo === '1') { const pr = PropertiesService.getScriptProperties(); pr.setProperty('CTR_VER_' + id, String(Number(pr.getProperty('CTR_VER_' + id) || '1') + 1)); registrarEvento_(id, 'CONTRATISTA', 'APLICADO', 'Enlace del contratista cambiado', '', '', 'contratista'); }
  return { ok: true, k: claveContratista_(id) }; }
/* v162 · Certificados de capacitación e inducción con QR: el QR lleva el id y una clave (HMAC del id). Quien lo
   escanea ve, sin usuario, solo lo necesario para comprobar que es auténtico: curso, fecha, horas, resultado y el
   nombre y la cédula a medias. Si alguien cambia el PDF, el QR sigue mostrando lo verdadero. */
function claveCert_(id) {
  const pr = PropertiesService.getScriptProperties();
  let sec = pr.getProperty('CERTIFICADOS'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('CERTIFICADOS', sec); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('cert:' + String(id || ''), sec)).slice(0, 22);
}
function verificarCertificado_(p) {
  const id = texto_(p.c || p.id), k = texto_(p.k);
  if (!id || !k || k !== claveCert_(id)) return { ok: true, valido: false, motivo: 'El código no corresponde a ningún certificado de esta empresa.' };
  const f = filaDe_(id); if (f === -1) return { ok: true, valido: false, motivo: 'El certificado ya no existe.' };
  const r = leerFila_(f); if (r.borrado || r.tipo !== 'induccion') return { ok: true, valido: false, motivo: 'El certificado fue anulado.' };
  const d = leerDoc_(id, false) || {}, nom = texto_(d.nombre).trim().split(/\s+/), ced = texto_(d.cedula).replace(/\D/g, '');
  return { ok: true, valido: d.resultado !== 'REPROBADA', empresa: nombreEmpresa_(perfilEmpresa_()), persona: nom.slice(0, 1).concat(nom.slice(1).map(function (x) { return x.charAt(0) + '.'; })).join(' '),
    cedula: ced ? '••••' + ced.slice(-4) : '', curso: texto_(d.tipoInduccion) || 'Inducción en SST', temas: (d.temas || []).slice(0, 12), fecha: texto_(d.fecha).slice(0, 10), horas: texto_(d.intensidadHoras),
    instructor: texto_(d.dicto), resultado: texto_(d.resultado), vence: texto_(d.vence).slice(0, 10), id: id };
}
function claveActa_(id) {
  const pr = PropertiesService.getScriptProperties();
  let sec = pr.getProperty('FIRMA_ACTAS'); if (!sec) { sec = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('FIRMA_ACTAS', sec); }
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('acta:' + String(id || ''), sec)).slice(0, 22);
}
function actaDeEnlace_(id, k) {
  id = texto_(id); if (!id || !k || String(k) !== claveActa_(id)) return { error: { ok: false, codigoError: 'PERMISO', error: 'El enlace no es válido o ya no sirve. Pídele uno nuevo al secretario del comité.' } };
  const f = filaDe_(id); if (f === -1) return { error: { ok: false, error: 'No se encontró el acta.' } };
  const r = leerFila_(f); if (r.tipo !== 'reunion' || r.borrado) return { error: { ok: false, error: 'No se encontró el acta.' } };
  const d = leerDoc_(id, false); if (!d) return { error: { ok: false, error: 'No se pudo leer el acta.' } };
  return { fila: f, reg: r, doc: d };
}
function actaPublica_(p) {
  const a = actaDeEnlace_(p.id, p.k); if (a.error) return a.error;
  const d = a.doc, conv = String(d.comite).toLowerCase() === 'convivencia';
  return { ok: true, id: texto_(p.id), comite: texto_(d.comite), numero: texto_(d.numero), fecha: texto_(d.fecha), lugar: conv ? '' : texto_(d.lugar), tipoReunion: texto_(d.tipoReunion),
           temas: conv ? [] : (d.ordenDia || []).slice(0, 12).map(function (t) { return corto_(t, 160); }), cerrada: /FIRMAD|CERRAD/i.test(texto_(a.reg.estado)),
           asistentes: (d.asistentes || []).map(function (x, i) { return { i: i, nombre: texto_(x.nombre), cargo: texto_(x.cargo), firmado: !!x.firma }; }) };
}
/* v151 · Contacto de emergencia sin usuario. Solo con la cédula EXACTA (no hay lista ni búsqueda por nombre),
   devuelve lo necesario para atender a la persona: nombre, cargo, RH, EPS, ARL y su contacto. Queda en Eventos. */
function contactoEmergencia_(p) {
  const ced = texto_(p.cedula).replace(/\D/g, '');
  if (ced.length < 5) return { ok: false, error: 'Escribe la cédula completa.' };
  const sh = regSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: false, error: 'No hay personal registrado.' };
  const v = sh.getRange(2, 1, n, COLS_REG.length).getValues(), iT = COLS_REG.indexOf('tipo'), iR = COLS_REG.indexOf('resumen'), iB = COLS_REG.indexOf('borrado');
  for (let i = 0; i < v.length; i++) {
    if (v[i][iT] !== 'trabajador' || v[i][iB]) continue;
    let r = {}; try { r = JSON.parse(v[i][iR] || '{}'); } catch (e) {}
    if (texto_(r.cedula).replace(/\D/g, '') !== ced) continue;
    const d = leerDoc_(v[i][0]) || {}, em = d.emergencia || {};
    registrarEvento_(v[i][0], 'CONTACTO_EMERGENCIA', 'CONSULTADO', 'Consulta sin usuario desde Emergencia (C.C. …' + ced.slice(-4) + ')', '', '', 'trabajador');
    return { ok: true, nombre: texto_(r.nombre), cargo: texto_(r.cargo), empresa: texto_(r.empresa),
             emergencia: { nombre: texto_(em.nombre), parentesco: texto_(em.parentesco), telefono: texto_(em.telefono), telefono2: texto_(em.telefono2), rh: texto_(em.rh), eps: texto_(em.eps), arl: texto_(em.arl) } };
  }
  return { ok: false, error: 'No encontramos esa cédula en el personal.' };
}
function firmarActa_(body) {
  const a = actaDeEnlace_(body.id, body.clave); if (a.error) return a.error;
  const d = a.doc, firma = texto_(body.firma), ced = texto_(body.cedula).replace(/\D/g, '').slice(0, 15), nombre = corto_(body.nombre, 90);
  if (firma.indexOf('data:image') !== 0) return { ok: false, error: 'Falta tu firma.' };
  if (!nombre || ced.length < 5) return { ok: false, error: 'Escribe tu nombre y tu cédula.' };
  d.asistentes = d.asistentes || [];
  let i = Number(body.i);
  if (!(i >= 0 && i < d.asistentes.length)) {
    i = d.asistentes.findIndex(function (x) { return String(x.cedula || '').replace(/\D/g, '') === ced; });
    if (i === -1) { d.asistentes.push({ nombre: nombre, cedula: ced, cargo: corto_(body.cargo, 60), representa: 'Invitado', calidad: 'Invitado', rol: 'Invitado', asistio: 'Sí', firma: '' }); i = d.asistentes.length - 1; }
  }
  const x = d.asistentes[i];
  if (x.firma) return { ok: true, id: texto_(body.id), yaFirmado: true };
  if (x.cedula && String(x.cedula).replace(/\D/g, '') !== ced) return { ok: false, error: 'La cédula no coincide con la de ' + texto_(x.nombre) + '.' };
  x.firma = firma; x.cedula = x.cedula || ced; x.asistio = 'Sí'; x.firmaEnlace = { en: new Date().toISOString(), cedula: ced };
  const r = guardar_({ action: 'parche', tipo: 'reunion', id: texto_(body.id), campos: { asistentes: d.asistentes }, opId: body.opId, _interno: true, _sinVersion: true, _sistema: true });
  registrarEvento_(texto_(body.id), 'FIRMA_ENLACE', r.ok ? 'APLICADO' : 'RECHAZADO', nombre + ' (C.C. …' + ced.slice(-4) + ') firmó el acta con el enlace', body.opId, '', 'reunion');
  return r.ok ? { ok: true, id: texto_(body.id) } : r;
}
function leerFila_(fila) {
  const v = regSheet_().getRange(fila, 1, 1, COLS_REG.length).getValues()[0];
  const o = {}; COLS_REG.forEach(function (c, i) { o[c] = v[i]; });
  return o;
}
function leerDoc_(id, conImagenes) {
  const mapa = reensamblar_(leerTrozos_(datosSheet_(), id));
  if (!mapa.doc) return null;
  let doc;
  try { doc = JSON.parse(mapa.doc); } catch (e) { return null; }
  return conImagenes ? rehidratar_(doc, reensamblar_(leerTrozos_(imgSheet_(), id))) : doc;
}
// v142: primero se escribe lo nuevo y solo después se borra lo viejo. Antes se borraba primero:
// si la escritura fallaba (libro lleno, error de Google, corte de 6 min) el registro se perdía.
function escribirDoc_(id, doc) {
  const sheet = datosSheet_();
  const viejas = filasPorValor_(sheet, 1, id);
  const ahora = new Date();
  const filas = trocear_('doc', JSON.stringify(doc)).map(function (t) { return [id, t.key, "'" + t.texto, ahora]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, 4).setValues(filas);
  SpreadsheetApp.flush();
  borrarFilas_(sheet, viejas);
}
function borrarFilas_(sheet, filas) {
  filas = filas.slice().sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < filas.length) {
    let inicio = filas[i], cuantas = 1;
    while (i + cuantas < filas.length && filas[i + cuantas] === inicio - 1) { inicio--; cuantas++; }
    sheet.deleteRows(inicio, cuantas);
    i += cuantas;
  }
}
/** v142: borra de «Imagenes» las fotos y firmas de este registro que el documento ya no usa
 *  (al cambiar una foto, la anterior se quedaba para siempre y el libro solo crecía). */
function limpiarImagenes_(id, doc) {
  try {
    const usadas = {}, txt = JSON.stringify(doc), re = /IMGREF:([0-9a-f]{6,20})/g; let m;
    while ((m = re.exec(txt))) usadas[m[1]] = true;
    const sh = imgSheet_(), filas = filasPorValor_(sh, 1, id); if (!filas.length) return 0;
    const minR = Math.min.apply(null, filas), maxR = Math.max.apply(null, filas), vals = sh.getRange(minR, 2, maxR - minR + 1, 1).getValues();
    const sobran = filas.filter(function (r) { const k = String(vals[r - minR][0]); return !usadas[k.indexOf('~') === -1 ? k : k.substring(0, k.indexOf('~'))]; });
    borrarFilas_(sh, sobran); return sobran.length;
  } catch (e) { return 0; }
}
/** Mezcla profunda: los objetos se mezclan campo a campo; listas y valores se reemplazan. */
/* Claves que en JavaScript cambian el "prototipo" de un objeto: nunca se copian
   (un "__proto__" en los datos podría colar campos que el servidor protege). */
const CLAVE_PELIGROSA_ = { '__proto__': true, constructor: true, prototype: true };
function mezclar_(base, cambios) {
  const out = (base && typeof base === 'object' && !Array.isArray(base)) ? JSON.parse(JSON.stringify(base)) : {};
  Object.keys(cambios || {}).forEach(function (k) {
    if (CLAVE_PELIGROSA_[k]) return;
    const v = cambios[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = mezclar_(out[k], v);
    else out[k] = v;
  });
  return out;
}

/* ── Lo que se lista de cada tipo (sin fotos ni textos largos) ── */
function resumen_(tipo, d) {
  if (tipo === 'trabajador') {
    const req = {};
    Object.keys(d.requisitos || {}).forEach(function (k) {
      const r = d.requisitos[k] || {};
      req[k] = { fecha: texto_(r.fecha), vence: texto_(r.vence), apto: texto_(r.apto), restricciones: corto_(r.restricciones, 120), soporte: !!r.soporte };
    });
    const aut = d.autorizacionDatos || null;
    return { nombre: corto_(d.nombre, 90), cedula: texto_(d.cedula), personaId: texto_(d.personaId), cedulasAnteriores: (Array.isArray(d.cedulasAnteriores) ? d.cedulasAnteriores : []).map(texto_).slice(0, 20), fusionadoCon: texto_(d.fusionadoCon), cargo: corto_(d.cargo, 60), area: corto_(d.area, 60), fechaIngreso: texto_(d.fechaIngreso), celular: texto_(d.celular).replace(/\D/g, '').slice(0, 15), empresa: corto_(d.empresa, 60), activo: d.activo !== false, porRevisar: d.porRevisar ? true : undefined, origen: d.porRevisar ? corto_(d.origen, 60) : undefined, descartado: d.descartado ? true : undefined, tipoDoc: /^(TI|CE|PPT|PEP|PA)$/.test(texto_(d.tipoDoc)) ? texto_(d.tipoDoc) : undefined, pensionEspecial: d.pensionEspecial === 'Sí' ? 'Sí' : '', req: req, emer: !!(d.emergencia && d.emergencia.telefono), restr: d.restriccionMed && (d.restriccionMed.para || []).length ? { para: d.restriccionMed.para.slice(0, 10), hasta: texto_(d.restriccionMed.hasta), fecha: texto_(d.restriccionMed.fecha) } : null,   // v140: el contacto viaja solo en el registro (pide usuario)
             autorizacion: aut ? { general: aut.general === true, sensibles: aut.sensibles === true, fecha: texto_(aut.fecha) } : null };
  }
  if (tipo === 'reporte') {
    const inv = d.investigacion || {};
    return { clase: texto_(d.clase), categoria: corto_(d.categoria, 120), fecha: texto_(d.fecha), hora: texto_(d.hora), lugar: corto_(d.lugar, 80), centro: corto_(d.centro, 60),
             descripcion: corto_(d.descripcion, 160), potencial: texto_(d.potencial), reportadoPor: corto_(d.anonimo ? 'Anónimo' : d.reportadoPor, 60),
             lesionado: corto_(d.lesionado && d.lesionado.nombre, 60), lesionadoCc: texto_(d.lesionado && d.lesionado.cedula).replace(/\D/g, '').slice(0, 15), diasIncapacidad: Number(d.diasIncapacidad) || 0, diasCargados: Number(d.diasCargados) || 0,
             mortal: !!d.mortal, grave: !!d.grave, fotos: (d.fotos || []).length,
             furat: { radicado: !!(d.furat && d.furat.radicado), numero: texto_(d.furat && d.furat.numero), fecha: texto_(d.furat && d.furat.fecha) },
             investigacion: { estado: texto_(inv.estado), fecha: texto_(inv.fecha) }, acciones: (d.acciones || []).length,
             mintrabajo: { fecha: texto_(d.mintrabajo && d.mintrabajo.fecha), radicado: corto_(d.mintrabajo && d.mintrabajo.radicado, 40) },   // v143: AT grave o mortal
             remisionArl: { fecha: texto_(d.remisionArl && d.remisionArl.fecha), radicado: corto_(d.remisionArl && d.remisionArl.radicado, 40) } };
  }
  if (tipo === 'accion') {
    return { origen: texto_(d.origen), origenRef: texto_(d.origenRef), hallazgo: corto_(d.hallazgo, 180), accion: corto_(d.accion, 180), tipoAccion: texto_(d.tipoAccion),
             responsable: corto_(d.responsable, 60), fechaCompromiso: texto_(d.fechaCompromiso), prioridad: texto_(d.prioridad),
             fechaCierre: texto_(d.cierre && d.cierre.fecha), eficaz: texto_(d.cierre && d.cierre.eficaz), centro: corto_(d.centro, 60),
             verificada: !!(d.verificada && d.verificada.fecha), asignadaPor: corto_(d.asignadaPor, 60), lote: corto_(d.lote, 40),
             // v107: avance que ve el asesor en su panel (cuántas anotaciones y la última)
             avances: (d.seguimiento || []).length, ultimoAvance: (d.seguimiento || []).length ? corto_(d.seguimiento[d.seguimiento.length - 1].texto, 120) + ' (' + texto_(d.seguimiento[d.seguimiento.length - 1].fecha) + ')' : '' };
  }
  if (tipo === 'mes') {
    return { mes: texto_(d.mes), trabajadores: Number(d.trabajadores) || 0, diasProgramados: Number(d.diasProgramados) || 0,
             diasAusencia: Number(d.diasAusencia) || 0, hht: Number(d.hht) || 0, casosEL: Number(d.casosEL) || 0, casosELNuevos: Number(d.casosELNuevos) || 0,
             inspeccionesProgramadas: Number(d.inspeccionesProgramadas) || 0, capacitacionesProgramadas: Number(d.capacitacionesProgramadas) || 0 };
  }
  if (tipo === 'equipo') {
    const ven = {};
    Object.keys(d.vencimientos || {}).forEach(function (k) { ven[k] = texto_(d.vencimientos[k]); });
    const hec = {}; Object.keys(d.hechas || {}).forEach(function (k) { hec[k] = texto_(d.hechas[k]); });   // v154: p. ej. fecha en que se recargó el extintor
    return { categoria: texto_(d.categoria), codigo: corto_(d.codigo, 40), nombre: corto_(d.nombre, 80), ubicacion: corto_(d.ubicacion, 80), subtipo: corto_(d.subtipo, 20), hechas: hec, area: corto_(d.area, 80), mantTipo: corto_(d.mantTipo, 30), contenido: Array.isArray(d.contenido) ? d.contenido.slice(0, 80).map(function (x) { return { e: corto_(x && x.e, 80), u: corto_(x && x.u, 40), min: Number(x && x.min) || 0 }; }) : undefined, mantUltimo: texto_(d.mantUltimo).slice(0, 10), mantProximo: texto_(d.mantProximo).slice(0, 10),
             // v160: hoja de vida (datos técnicos e historial de mantenimientos)
             marca: corto_(d.marca, 60), modelo: corto_(d.modelo, 60), serie: corto_(d.serie, 60), fechaCompra: texto_(d.fechaCompra).slice(0, 10), proveedor: corto_(d.proveedor, 80), caracteristicas: corto_(d.caracteristicas, 400),
             mantHist: Array.isArray(d.mantHist) ? d.mantHist.slice(-60).map(function (m) { return { f: texto_(m && m.f).slice(0, 10), t: corto_(m && m.t, 20), d: corto_(m && m.d, 300), q: corto_(m && m.q, 80), c: corto_(m && m.c, 30) }; }) : undefined,
             frecuencia: texto_(d.frecuencia), ultimaInspeccion: texto_(d.ultimaInspeccion), ultimoResultado: texto_(d.ultimoResultado),
             vencimientos: ven, activo: d.activo !== false };
  }
  if (tipo === 'inspeccion') {
    const nc = (d.items || []).filter(function (i) { return i && i.r === 'NC'; });
    return { categoria: texto_(d.categoria), plantilla: texto_(d.plantilla), equipoId: texto_(d.equipoId), equipo: corto_(d.equipoNombre, 80),
             fecha: texto_(d.fecha), lugar: corto_(d.lugar, 80), inspector: corto_(d.inspector && d.inspector.nombre, 60),
             resultado: nc.length ? 'NO CONFORME' : 'CONFORME', nc: nc.length, items: (d.items || []).length, noConformes: nc.slice(0, 8).map(function (i) { return corto_(i.t, 80); }),
             tipoInspeccion: texto_(d.tipoInspeccion), participantes: (d.participantes || []).length, progId: texto_(d.progId) };
  }
  if (tipo === 'comite') {
    const per = periodoActual_(d);
    const c = d.cifrado && d.cifrado.actual;
    return { comite: texto_(d.comite), trabajadores: Number(d.trabajadores) || 0,
             periodo: per ? { inicio: texto_(per.inicio), fin: texto_(per.fin), miembros: (per.miembros || []).map(function (m) {
               return { nombre: corto_(m.nombre, 80), cargo: corto_(m.cargo, 60), representa: texto_(m.representa), calidad: texto_(m.calidad), rol: texto_(m.rol) }; }) } : null,
             periodos: (d.periodos || []).length, capacitaciones: (d.capacitaciones || []).length,
             // Para abrir las quejas en el celular (no son secretos: sin la clave no sirven).
             cifrado: c ? { actual: claveCifrado_(c), anterior: d.cifrado.anterior ? claveCifrado_(d.cifrado.anterior) : null } : null };
  }
  if (tipo === 'reunion') {
    const as = d.asistentes || [];
    return { comite: texto_(d.comite), numero: texto_(d.numero), tipo: texto_(d.tipoReunion), fecha: texto_(d.fecha), lugar: corto_(d.lugar, 80),
             asistentes: as.filter(function (a) { return a && a.asistio === 'Sí'; }).length, convocados: as.length, quorum: quorumActa_(as),
             // v148: de Convivencia no se copian motivo ni temas a la hoja (pueden nombrar una queja): solo en el acta.
             motivo: String(d.comite).toLowerCase() === 'convivencia' ? '' : corto_(d.motivo, 120), compromisos: (d.compromisos || []).length,
             temas: String(d.comite).toLowerCase() === 'convivencia' ? [] : (d.ordenDia || []).slice(0, 6).map(function (t) { return corto_(t, 80); }) };
  }
  if (tipo === 'queja') {
    return { codigo: texto_(d.codigo), fechaRecepcion: texto_(d.fechaRecepcion), etapa: texto_(d.etapa), estado: texto_(d.estado || 'ABIERTA'),
             fechaCierre: texto_(d.fechaCierre), inicioEtapa: texto_(d.inicioEtapa), venceEtapa: texto_(d.venceEtapa), venceTotal: texto_(d.venceTotal),
             kid: texto_(d.cifrado && d.cifrado.kid),
             medSolicitud: iso10_(d.medSolicitud), medAdopcion: iso10_(d.medAdopcion), medSexual: d.medSexual === 'si' || d.medSexual === true, protegeHasta: iso10_(d.protegeHasta) };
  }
  if (tipo === 'auditoria') {
    const h = { ncMayor: 0, ncMenor: 0, obs: 0, om: 0 };
    (d.hallazgos || []).forEach(function (x) { if (x && h[x.tipo] !== undefined) h[x.tipo]++; });
    const items = d.items || [];
    return { tipoAuditoria: texto_(d.tipoAuditoria), plantilla: texto_(d.plantilla), titulo: corto_(d.titulo, 120), fechaPlan: texto_(d.fechaPlan),
             fechaEjecucion: texto_(d.fechaEjecucion), auditor: corto_(d.auditor && d.auditor.nombre, 60), alcance: corto_(d.alcance, 160),
             estado: texto_(d.estado || 'PROGRAMADA'), puntaje: d.puntaje == null ? null : Number(d.puntaje), valoracion: texto_(d.valoracion),
             hallazgos: h, items: items.length, respondidos: items.filter(function (i) { return i && i.r; }).length, acciones: (d.acciones || []).length };
  }
  if (tipo === 'presupuesto') {   // v169: los rubros van en la lista (la pantalla compara cada uno con lo gastado)
    const rub = (Array.isArray(d.rubros) ? d.rubros : []).slice(0, 60).map(function (r) {
      return { id: corto_(r && r.id, 40), rubro: corto_(r && r.rubro, 120), valor: Math.round(Number(r && r.valor) || 0) };
    });
    return { anio: texto_(d.anio), responsable: corto_(d.responsable, 120), aprobadoPor: corto_(d.aprobadoPor, 120), fechaAprobacion: texto_(d.fechaAprobacion), estado: texto_(d.estado),
      totalPresupuestado: rub.reduce(function (a, r) { return a + r.valor; }, 0), rubros: rub };
  }
  if (TIPOS_GEN[tipo]) {
    const o = {};
    TIPOS_GEN[tipo].campos.forEach(function (k) {
      const v = d[k];
      if (v == null || v === '') { o[k] = ''; return; }
      if (typeof v === 'number' || typeof v === 'boolean') { o[k] = v; return; }
      const esLargo = (TIPOS_GEN[tipo].largos || []).indexOf(k) !== -1, largo = esLargo ? (TIPOS_GEN[tipo].largoMax || 1500) : 200;
      if (esLargo && TIPOS_GEN[tipo].saltos && typeof v === 'string') { const t = v.replace(/[ \t\f\v\r]+/g, ' ').replace(/ *\n+ */g, '\n').trim(); o[k] = t.length > largo ? t.slice(0, largo - 1) + '…' : t; return; }
      if (Array.isArray(v)) { o[k] = v.every(function (x) { return typeof x === 'string'; }) ? corto_(v.join(', '), largo) : v.length; return; }
      if (typeof v === 'object') { o[k] = Object.keys(v).length; return; }
      o[k] = corto_(v, largo);
    });
    return o;
  }
  return {};
}
function claveCifrado_(c) { return { kid: texto_(c.kid), salt: texto_(c.salt), iter: Number(c.iter) || 0, verif: c.verif ? { iv: texto_(c.verif.iv), data: texto_(c.verif.data) } : null }; }
function periodoActual_(d) { const l = d.periodos || []; return l.length ? l[l.length - 1] : null; }
/* Lo que va en las columnas de "Registros". */
function columnas_(tipo, d, id) {
  const r = resumen_(tipo, d);
  if (tipo === 'trabajador') {
    let vence = '';
    Object.keys(r.req).forEach(function (k) { const v = r.req[k].vence; if (v && (!vence || v < vence)) vence = v; });
    return { estado: r.activo ? 'ACTIVO' : 'INACTIVO', fecha: '', titulo: r.nombre, responsable: r.cargo, vence: vence, resumen: r };
  }
  if (tipo === 'reporte') return { estado: texto_(d.estado || 'ABIERTO'), fecha: r.fecha, titulo: r.clase + ' · ' + r.descripcion, responsable: r.reportadoPor, vence: '', resumen: r };
  if (tipo === 'accion') return { estado: texto_(d.estado || 'ABIERTA'), fecha: texto_(d.fecha), titulo: r.accion || r.hallazgo, responsable: r.responsable, vence: r.fechaCompromiso, resumen: r };
  if (tipo === 'mes') return { estado: '', fecha: r.mes + '-01', titulo: 'Datos de ' + r.mes, responsable: '', vence: '', resumen: r };
  if (tipo === 'equipo') {
    let vence = ''; Object.keys(r.vencimientos).forEach(function (k) { const v = r.vencimientos[k]; if (v && (!vence || v < vence)) vence = v; });
    return { estado: r.activo ? 'ACTIVO' : 'DE BAJA', fecha: r.ultimaInspeccion, titulo: (r.codigo ? r.codigo + ' · ' : '') + r.nombre, responsable: r.ubicacion, vence: vence, resumen: r };
  }
  if (tipo === 'inspeccion') return { estado: r.resultado, fecha: r.fecha, titulo: r.categoria + ' · ' + r.equipo, responsable: r.inspector, vence: '', resumen: r };
  if (tipo === 'comite') {
    const per = r.periodo, pres = per ? per.miembros.filter(function (m) { return /presidente/i.test(m.rol); })[0] : null;
    return { estado: per ? (per.fin && per.fin < hoyISO_() ? 'VENCIDO' : 'VIGENTE') : 'SIN CONFORMAR', fecha: per ? per.inicio : '', titulo: NOMBRE_COMITE_[r.comite] || r.comite,
             responsable: pres ? pres.nombre : '', vence: per ? per.fin : '', resumen: r };
  }
  if (tipo === 'reunion') return { estado: 'REALIZADA', fecha: r.fecha, titulo: (NOMBRE_COMITE_[r.comite] || r.comite) + ' · Acta ' + r.numero + ' (' + r.tipo + ')', responsable: '', vence: '', resumen: r };
  if (tipo === 'queja') {
    const v = r.estado === 'ABIERTA' ? [r.venceEtapa, r.venceTotal].filter(Boolean).sort()[0] || '' : '';
    return { estado: r.estado, fecha: r.fechaRecepcion, titulo: r.codigo + ' · ' + r.etapa, responsable: '', vence: v, resumen: r };
  }
  if (tipo === 'auditoria') return { estado: r.estado, fecha: r.fechaEjecucion || r.fechaPlan, titulo: r.titulo || r.tipoAuditoria, responsable: r.auditor, vence: r.estado === 'PROGRAMADA' ? r.fechaPlan : '', resumen: r };
  if (TIPOS_GEN[tipo]) {
    const t = TIPOS_GEN[tipo], g = function (k) { return k ? texto_(r[k]) : ''; };
    return { estado: g(t.estado), fecha: g(t.fecha), titulo: g(t.titulo) || id, responsable: g(t.responsable), vence: /^\d{4}-\d{2}-\d{2}$/.test(g(t.vence)) ? g(t.vence) : '', resumen: r };
  }
  return { estado: '', fecha: '', titulo: id, responsable: '', vence: '', resumen: {} };
}

const NOMBRE_COMITE_ = { copasst: 'COPASST', convivencia: 'Comité de Convivencia Laboral', emergencias: 'Comité de emergencias' };
const MODULO_COMITE_ = { copasst: 'copasst.html', convivencia: 'convivencia.html', emergencias: 'comite-emergencias.html' };

/* ── Hojas legibles (una por módulo) ── */
const VISTAS = {
  trabajador: { hoja: 'Requisitos', cols: ['id', 'cédula', 'nombre', 'cargo', 'empresa', 'requisito', 'fecha', 'vence', 'apto', 'restricciones', 'actualizado'],
    filas: function (id, d) { const req = d.requisitos || {}; const ks = Object.keys(req); if (!ks.length) ks.push('');
      return ks.map(function (k) { const r = req[k] || {}; return [id, texto_(d.cedula), texto_(d.nombre), texto_(d.cargo), texto_(d.empresa), k, texto_(r.fecha), texto_(r.vence), texto_(r.apto), texto_(r.restricciones), new Date()]; }); } },
  reporte: { hoja: 'Reportes', cols: ['id', 'clase', 'fecha', 'hora', 'lugar', 'centro', 'descripción', 'potencial', 'reportado por', 'lesionado', 'días incapacidad', 'FURAT', 'investigación', 'estado', 'actualizado', 'categoría', 'acción tomada', 'relacionados', 'plan sugerido', 'consecuencias que se evitan'],
    filas: function (id, d) { return [[id, texto_(d.clase), texto_(d.fecha), texto_(d.hora), texto_(d.lugar), texto_(d.centro), corto_(d.descripcion, 2000), texto_(d.potencial),
      d.anonimo ? 'Anónimo' : texto_(d.reportadoPor), texto_(d.lesionado && d.lesionado.nombre), Number(d.diasIncapacidad) || 0,
      d.furat && d.furat.radicado ? 'Radicado ' + texto_(d.furat.numero) : '', texto_(d.investigacion && d.investigacion.estado), texto_(d.estado || 'ABIERTO'), new Date(),
      // v128: lo nuevo del reporte de actos y condiciones (al final, para no mover las columnas de siempre)
      corto_(d.categoria === 'Otros' ? 'Otros: ' + texto_(d.categoriaOtra) : d.categoria, 200), corto_((d.accionTomada || []).join(', ') + (d.accionTomadaOtra ? ' · ' + texto_(d.accionTomadaOtra) : ''), 300),
      corto_(d.relacionados, 500), corto_(d.planSugerido, 1000), corto_(d.consecuencias, 1000)]]; } },
  accion: { hoja: 'Plan de acción', cols: ['id', 'origen', 'referencia', 'hallazgo', 'acción', 'tipo', 'responsable', 'fecha compromiso', 'estado', 'fecha cierre', 'eficaz', 'actualizado'],
    filas: function (id, d) { return [[id, texto_(d.origen), texto_(d.origenRef), corto_(d.hallazgo, 2000), corto_(d.accion, 2000), texto_(d.tipoAccion), texto_(d.responsable),
      texto_(d.fechaCompromiso), texto_(d.estado || 'ABIERTA'), texto_(d.cierre && d.cierre.fecha), texto_(d.cierre && d.cierre.eficaz), new Date()]]; } },
  mes: { hoja: 'Indicadores', cols: ['mes', 'trabajadores', 'días programados', 'días ausencia', 'HHT', 'casos EL', 'casos EL nuevos', 'inspecciones programadas', 'capacitaciones programadas', 'actualizado'],
    filas: function (id, d) { return [["'" + texto_(d.mes), Number(d.trabajadores) || 0, Number(d.diasProgramados) || 0, Number(d.diasAusencia) || 0, Number(d.hht) || 0,
      Number(d.casosEL) || 0, Number(d.casosELNuevos) || 0, Number(d.inspeccionesProgramadas) || 0, Number(d.capacitacionesProgramadas) || 0, new Date()]]; }, clave: function (d) { return texto_(d.mes); } },
  equipo: { hoja: 'Equipos', cols: ['id', 'categoría', 'código', 'nombre', 'ubicación', 'frecuencia', 'última inspección', 'resultado', 'vencimientos', 'estado', 'actualizado'],
    filas: function (id, d) { const v = d.vencimientos || {}; return [[id, texto_(d.categoria), texto_(d.codigo), texto_(d.nombre), texto_(d.ubicacion), texto_(d.frecuencia),
      texto_(d.ultimaInspeccion), texto_(d.ultimoResultado), Object.keys(v).map(function (k) { return k + ': ' + v[k]; }).join(' · '), d.activo === false ? 'DE BAJA' : 'ACTIVO', new Date()]]; } },
  inspeccion: { hoja: 'Inspecciones', cols: ['id', 'categoría', 'equipo', 'fecha', 'lugar', 'inspector', 'resultado', 'no conformes', 'actualizado'],
    filas: function (id, d) { const r = resumen_('inspeccion', d); return [[id, r.categoria, r.equipo, r.fecha, r.lugar, r.inspector, r.resultado, r.noConformes.join(' | '), new Date()]]; } },
  comite: { hoja: 'Comités', cols: ['id', 'comité', 'inicio del periodo', 'fin del periodo', 'nombre', 'cédula', 'cargo', 'representa a', 'calidad', 'rol', 'actualizado'],
    filas: function (id, d) { const per = periodoActual_(d); const ms = per && per.miembros && per.miembros.length ? per.miembros : [{}];
      return ms.map(function (m) { return [id, NOMBRE_COMITE_[d.comite] || texto_(d.comite), texto_(per && per.inicio), texto_(per && per.fin), texto_(m.nombre), texto_(m.cedula), texto_(m.cargo), texto_(m.representa), texto_(m.calidad), texto_(m.rol), new Date()]; }); } },
  reunion: { hoja: 'Actas de comités', cols: ['id', 'comité', 'acta', 'tipo', 'fecha', 'lugar', 'asistentes', 'quórum', 'temas', 'compromisos', 'actualizado'],
    filas: function (id, d) { const r = resumen_('reunion', d); return [[id, NOMBRE_COMITE_[r.comite] || r.comite, r.numero, r.tipo, r.fecha, r.lugar, r.asistentes + ' de ' + r.convocados, r.quorum ? 'Sí' : 'No', r.temas.join(' | '), r.compromisos, new Date()]]; } },
  queja: { hoja: 'Quejas convivencia (sin datos)', cols: ['id', 'código', 'recibida', 'etapa', 'estado', 'vence la etapa', 'límite total (65 días)', 'cierre', 'actualizado'],
    filas: function (id, d) { return [[id, texto_(d.codigo), texto_(d.fechaRecepcion), texto_(d.etapa), texto_(d.estado), texto_(d.venceEtapa), texto_(d.venceTotal), texto_(d.fechaCierre), new Date()]]; } },
  auditoria: { hoja: 'Auditorías', cols: ['id', 'tipo', 'título', 'planeada', 'ejecutada', 'auditor', 'estado', 'puntaje', 'valoración', 'NC mayores', 'NC menores', 'observaciones', 'oportunidades de mejora', 'actualizado'],
    filas: function (id, d) { const r = resumen_('auditoria', d); return [[id, r.tipoAuditoria, r.titulo, r.fechaPlan, r.fechaEjecucion, r.auditor, r.estado, r.puntaje == null ? '' : r.puntaje, r.valoracion, r.hallazgos.ncMayor, r.hallazgos.ncMenor, r.hallazgos.obs, r.hallazgos.om, new Date()]]; } }
};
Object.keys(TIPOS_GEN).forEach(function (t) {
  const g = TIPOS_GEN[t];
  VISTAS[t] = { hoja: g.hoja, cols: ['id'].concat(g.campos, ['actualizado']),
    filas: function (id, d) { const r = resumen_(t, d); return [[id].concat(g.campos.map(function (k) { return r[k]; }), [new Date()])]; } };
});
function vistaSheet_(tipo) { return hoja_(VISTAS[tipo].hoja, VISTAS[tipo].cols); }
/* Si una versión nueva agregó columnas a un tipo genérico, la hoja legible vieja queda con el
   encabezado de antes: se rehace una vez desde "Registros" (el resumen trae los mismos campos). */
function encabezadoAlDia_(tipo, sheet) {
  const v = VISTAS[tipo], g = TIPOS_GEN[tipo];
  if (!g && v && sheet.getLastRow() >= 1 && sheet.getLastColumn() < v.cols.length) {
    // v128: hojas de siempre a las que se les agregan columnas al final: solo se completan los títulos.
    const ya = sheet.getLastColumn();
    sheet.getRange(1, ya + 1, 1, v.cols.length - ya).setValues([v.cols.slice(ya)]).setFontWeight('bold');
    return;
  }
  if (!g || sheet.getLastRow() < 1) return;
  CTX_.vistasRevisadas = CTX_.vistasRevisadas || {};
  if (CTX_.vistasRevisadas[tipo]) return; CTX_.vistasRevisadas[tipo] = true;
  const ancho = Math.max(v.cols.length, sheet.getLastColumn());
  const h = sheet.getRange(1, 1, 1, ancho).getValues()[0].map(texto_);
  // Columnas que la empresa agregó a la derecha (fórmulas, notas) no obligan a rehacer la hoja.
  if (h.slice(0, v.cols.length).join('|') === v.cols.join('|')) return;
  const filas = [];
  const reg = regSheet_(), last = reg.getLastRow();
  if (last >= 2) reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (x) {
    if (x[1] !== tipo || x[11]) return; let r = {}; try { r = JSON.parse(x[8] || '{}'); } catch (e) {}
    filas.push([x[0]].concat(g.campos.map(function (k) { return r[k] == null ? '' : r[k]; }), [x[10]]).map(celda_));
  });
  if (sheet.getLastRow() >= 2) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(1, 1, 1, ancho).setValues([v.cols.concat(new Array(ancho - v.cols.length).fill(''))]);
  if (filas.length) sheet.getRange(2, 1, filas.length, v.cols.length).setValues(filas);
}
function escribirVista_(tipo, id, d, borrado) {
  const v = VISTAS[tipo]; if (!v) return;
  const sheet = vistaSheet_(tipo);
  try { encabezadoAlDia_(tipo, sheet); } catch (e) { console.log('Encabezado de ' + v.hoja + ': ' + e.message); }
  borrarFilasDe_(sheet, v.clave ? v.clave(d) : id);
  if (borrado) return;
  const filas = v.filas(id, d).map(function (f) { return f.map(celda_); });
  if (filas.length) sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
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
function selloCodigo_(s) { return selloHex_(Utilities.computeHmacSha256Signature([s.huella, s.fecha, s.usuario, s.equipo, s.gps, s.ref].concat(s.alterna ? [s.alterna] : []).join('|'), selloSecreto_())); }
function selloValido_(s, huella, ref) { return !!(s && typeof s === 'object' && s.huella === huella && s.codigo === selloCodigo_(s) && (ref === undefined || s.ref === ref)); }
/** v141: firma sin trazo (nombre y cédula): ¿la cédula es de alguien del personal registrado? */
function alternaDe_(ctx, huella) {
  const a = (ctx.alternas || []).filter(function (x) { return x && x.huella === huella; })[0]; if (!a) return null;
  const ced = String(a.cedula || '').replace(/\D/g, '').slice(0, 12), nombre = String(a.nombre || '').slice(0, 100);
  let registrado = false;
  try { const sh = regSheet_(), m = sh.getLastRow(); if (m > 1 && ced) registrado = sh.getRange(2, 1, m - 1, 12).getValues().some(function (r) { return r[1] === 'trabajador' && !r[11] && String(r[8] || '').indexOf('"cedula":"' + ced + '"') !== -1; }); } catch (e) {}
  return { nombre: nombre, cedula: ced, registrado: registrado };
}
function ctxSello_(body, usuario, ref) {
  const d = (body && body._disp && typeof body._disp === 'object') ? body._disp : {}, g = d.gps || {};
  const gps = isFinite(g.lat) && isFinite(g.lon) && g.lat !== null && g.lon !== null ? Number(g.lat).toFixed(5) + ',' + Number(g.lon).toFixed(5) + (isFinite(g.prec) && g.prec !== null ? ' ±' + Math.round(g.prec) + ' m' : '') : '';
  const alternas = Array.isArray(d.alternas) ? d.alternas.slice(0, 20) : [];
  return { usuario: String(usuario || '').slice(0, 120), equipo: String(d.ua || '').slice(0, 180), gps: gps, ref: String(ref || '').slice(0, 80), alternas: alternas };
}
// v141: el sello solo vale en SU registro (ref = tipo:id): uno copiado de otro registro se rehace.
// Al editar, si la firma es la misma que ya estaba en el servidor, se conserva el sello original
// (quién firmó y cuándo), aunque el celular no lo haya reenviado.
function sellarFirmas_(obj, ctx, prof, previo) {
  prof = prof || 0; if (!obj || typeof obj !== 'object' || prof > 12) return 0;
  let n = 0;
  if (Array.isArray(obj)) { obj.forEach(function (x, i) { n += sellarFirmas_(x, ctx, prof + 1, Array.isArray(previo) ? previo[i] : null); }); return n; }
  Object.keys(obj).forEach(function (k) {
    const v = obj[k], pv = previo && typeof previo === 'object' ? previo[k] : null;
    if (/_sello$/.test(k) || k === '_disp') return;
    if (typeof v === 'string' && v.indexOf('data:image') === 0 && /firma|sig/i.test(k)) {
      const huella = selloHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v));
      if (selloValido_(obj[k + '_sello'], huella, ctx.ref)) return;
      const ps = previo && typeof previo === 'object' ? previo[k + '_sello'] : null;
      if (selloValido_(ps, huella, ctx.ref)) { obj[k + '_sello'] = ps; return; }
      const s = { fecha: new Date().toISOString(), usuario: ctx.usuario, equipo: ctx.equipo, gps: ctx.gps, ref: ctx.ref, huella: huella };
      const alt = alternaDe_(ctx, huella); if (alt) s.alterna = alt.nombre + ' · C.C. ' + alt.cedula + (alt.registrado ? '' : ' (cédula NO registrada en el personal)');
      s.codigo = selloCodigo_(s); obj[k + '_sello'] = s; n++;
    } else if (v && typeof v === 'object') n += sellarFirmas_(v, ctx, prof + 1, pv && typeof pv === 'object' ? pv : null);
  });
  return n;
}

function doPost(e) {
  HOJAS_CACHE_ = {};
  CTX_ = { modo: false, u: null, colUsuario: false };
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return jsonOut_({ ok: false, error: 'Los datos llegaron incompletos. Vuelve a enviar el formulario.' }); }
  sinImagenesFalsas_(body);
  // v162: el contratista sube sus documentos y su personal con su propio enlace (sin la clave del portal ni usuario).
  if (body.action === 'contratistaSubir' || body.action === 'contratistaTrabajador') return jsonOut_(contratistaEscribe_(body));
  if (!checkToken_(body.token)) {
    registrarEvento_(body.id, body.action || 'GUARDAR', 'RECHAZADO', 'Token inválido', '', '', body.tipo);
    return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
  }
  // El respaldo copia libros enteros (tarda): va sin el candado, para no frenar a los demás.
  if (body.action === 'respaldar') { iniciarContexto_(body.sesion); return jsonOut_(respaldarAhora_()); }
  // v116: revisar los servidores de los clientes llama a cada uno (tarda): también sin el candado.
  if (body.action === 'vigilarAhora') { iniciarContexto_(body.sesion); const no = soloAdmin_(); return jsonOut_(no || vigilarClientes_(false)); }
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); }
  catch (err) { return jsonOut_({ ok: false, codigoError: 'TEMPORAL', error: 'El servidor está ocupado; se reintenta solo.' }); }
  LOCK_TOMADO_++;
  try {
    iniciarContexto_(body.sesion);
    delete body._interno; delete body._sinVersion; delete body._sistema;   // solo los usa el propio servidor
    if (body.opId && opIdYaAplicado_(body.opId)) {
      registrarEvento_(body.id, body.action, 'DUPLICADO', 'opId ya aplicado', body.opId, '', body.tipo);
      const f = filaDe_(texto_(body.id));
      return jsonOut_({ ok: true, id: body.id, duplicado: true, version: f === -1 ? 0 : leerFila_(f).version });
    }
    if (body.action === 'firmarActa') return jsonOut_(firmarActa_(body));   // v149: firma con el enlace del acta, sin usuario
    if (body.action === 'guardar' || body.action === 'parche') return jsonOut_(guardar_(body));
    if (body.action === 'asegurarPersona') return jsonOut_(asegurarPersona_(body));   // v164: alta en el maestro desde el anexo de personal
    if (body.action === 'guardarLote') return jsonOut_(guardarLote_(body));
    if (body.action === 'borrar') return jsonOut_(borrar_(body));
    if (body.action === 'restaurar') return jsonOut_(restaurar_(body));
    if (body.action === 'adjuntar') return jsonOut_(adjuntar_(body));
    if (body.action === 'paqueteCliente') return jsonOut_(paqueteCliente_(body));   // v153: documentación para un cliente, en un .zip
    if (body.action === 'carpetaAuditoria') return jsonOut_(carpetaAuditoria_(body));
    if (body.action === 'exportarTodo') return jsonOut_(exportarTodo_(body));
    if (body.action === 'crearEnlaceAuditor') return jsonOut_(crearEnlaceAuditor_(body));
    if (body.action === 'guardarMisAvisos') return jsonOut_(guardarMisAvisos_(body));
    if (body.action === 'avisosPorRol') return jsonOut_(avisosPorRol_(body));
    if (body.action === 'revocarEnlaceAuditor') return jsonOut_(revocarEnlaceAuditor_(body));   // v162: todo de la empresa, para irse o respaldar aparte   // v159: carpeta para el auditor, por numeral
    if (body.action === 'quitarAdjunto') return jsonOut_(quitarAdjunto_(body));
    if (body.action === 'entrar') return jsonOut_(entrar_(body));
    if (body.action === 'cambiarMiClave') return jsonOut_(cambiarMiClave_(body));
    if (body.action === 'guardarUsuario') return jsonOut_(guardarUsuario_(body));
    if (body.action === 'primerAdmin') return jsonOut_(primerAdmin_(body));
    if (body.action === 'publicarCliente') { const no = soloAdmin_(); return jsonOut_(no || publicarCliente_(texto_(body.id))); }
    return jsonOut_({ ok: false, error: 'Acción no reconocida.' });
  } catch (err) {
    registrarEvento_(body.id, body.action, 'RECHAZADO', 'Error: ' + err.message, body.opId, '', body.tipo);
    return jsonOut_({ ok: false, error: 'Error en el servidor SG-SST: ' + err.message });
  } finally {
    LOCK_TOMADO_--; lock.releaseLock();
  }
}

/* Carga masiva desde Excel (importar.js): hasta 10 registros por llamada, cada uno como
   un "parche" (crea si no existe; si existe, cambia solo lo que trae). Cada registro pasa
   por las mismas reglas y permisos que uno guardado a mano. */
const TIPOS_LOTE_ = ['trabajador', 'equipo', 'sustancia', 'legal', 'peligro', 'documento', 'proveedor'];
function guardarLote_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return { ok: false, error: 'No llegó ningún registro.' };
  if (items.length > 10) return { ok: false, error: 'Máximo 10 registros por envío.' };
  const base = texto_(body.opId) || ('lote-' + Date.now());
  const resultados = items.map(function (it, i) {
    it = it || {};
    const tipo = texto_(it.tipo);
    if (TIPOS_LOTE_.indexOf(tipo) === -1) return { ok: false, error: 'No se puede cargar en lote: ' + tipo };
    if (!it.campos || typeof it.campos !== 'object' || Array.isArray(it.campos)) return { ok: false, error: 'Registro vacío.' };
    try {
      // Si el envío se cortó a mitad y el celular lo repite, lo que ya quedó no se aplica otra vez.
      if (opIdYaAplicado_(base + ':' + i)) return { ok: true, id: texto_(it.id), repetido: true };
      const r = guardar_({ action: 'parche', tipo: tipo, id: texto_(it.id), campos: it.campos, opId: base + ':' + i });
      return r.ok ? { ok: true, id: r.id, version: r.version } : { ok: false, error: r.error || 'error', codigoError: r.codigoError };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  const malos = resultados.filter(function (r) { return !r.ok; });
  // Sin sesión o sin permiso: todos fallan igual; se devuelve como error general.
  if (malos.length === resultados.length && malos[0].codigoError && /SESION|PERMISO|CAMBIAR/.test(malos[0].codigoError)) return { ok: false, codigoError: malos[0].codigoError, error: malos[0].error };
  return { ok: true, resultados: resultados, cargados: resultados.length - malos.length };
}

function guardar_(body) {
  const tipo = texto_(body.tipo), id = texto_(body.id).trim();
  if (TIPOS.indexOf(tipo) === -1) return { ok: false, error: 'Tipo desconocido: ' + tipo };
  if (!/^[A-Za-z0-9_.:-]{3,80}$/.test(id)) return { ok: false, error: 'Identificador inválido.' };
  const fila = filaDe_(id);
  const prev = fila === -1 ? null : leerFila_(fila);
  if (prev && prev.tipo !== tipo) return { ok: false, error: 'Ese identificador ya es de otro tipo.' };
  const versionActual = prev ? Number(prev.version) || 0 : 0;
  let doc;
  if (prev && prev.borrado) return { ok: false, error: 'Ese registro fue borrado.', borrado: true };
  const sinPermiso = body._sistema ? null : puedeEscribir_(tipo, body.action, !!prev);
  if (sinPermiso) { registrarEvento_(id, body.action === 'parche' ? 'PARCHE' : 'GUARDAR', 'RECHAZADO', sinPermiso.error, body.opId, versionActual, tipo); return sinPermiso; }
  const spam = body._sistema ? null : antiSpam_(tipo, body, !!prev);
  if (spam) { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', spam.error || 'spam', body.opId, versionActual, tipo); return spam; }
  const sinAut = body._sistema || prev ? null : autorizacionSalud_(tipo, body.action === 'parche' ? (body.campos || (body.campos = {})) : (body.doc || (body.doc = {})));   // v145: también si el registro nace por parche
  if (sinAut) { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', sinAut.error, body.opId, versionActual, tipo); return sinAut; }
  // Lo que pone el servidor (quién y adjuntos) no se acepta del celular.
  let prevRes = {}, prevResFallo = false; try { prevRes = prev ? JSON.parse(prev.resumen || '{}') : {}; } catch (e) { prevResFallo = true; }
  let prevDocCache;
  const prevDoc = function () { if (prevDocCache === undefined) prevDocCache = prev ? (leerDoc_(id, false) || {}) : {}; return prevDocCache; };
  const PROPIOS = ['registradoPor', 'modificadoPor', 'adjuntos'];
  if (!body._interno) {
    if (body.doc) PROPIOS.forEach(function (k) { delete body.doc[k]; });
    if (body.campos) PROPIOS.forEach(function (k) { delete body.campos[k]; });
    if (body.agregar) PROPIOS.forEach(function (k) { delete body.agregar[k]; });
  }
  if (tipo === 'queja') {
    // Las quejas de convivencia son reservadas: solo llegan cifradas y completas.
    if (body.action !== 'guardar') return { ok: false, error: 'Las quejas se guardan completas (cifradas).' };
    const err = validarQueja_(body.doc || {}, body);
    if (err) { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', err, body.opId, versionActual, tipo); return { ok: false, error: err }; }
  }
  if (tipo === 'buzon' && !body._sistema) {
    // v128: solo se crea (no se edita) y solo llega cifrado con la llave pública del comité.
    const eb = body.action !== 'guardar' || prev ? 'Lo que llega al buzón no se modifica.' : (!/^BZN-[A-Za-z0-9-]{6,40}$/.test(id) ? 'Identificador inválido.' : '');
    const lb = eb ? eb : limpiarBuzon_(body.doc || {});
    if (typeof lb === 'string') { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', lb, body.opId, versionActual, tipo); return { ok: false, error: lb }; }
    body.doc = lb;
  }
  if (tipo === 'encpeligro' && !body._sistema) {
    // v107: la encuesta de peligros de los trabajadores se limpia en el servidor (solo se crea, no se edita).
    if (body.action !== 'guardar' || prev) return { ok: false, error: 'La encuesta de peligros no se modifica.' };
    body.doc = limpiarEncPeligro_(body.doc || {});
    if (!body.doc.peligros.length) return { ok: false, error: 'Marca por lo menos un peligro.' };
  }
  if (tipo === 'induccion' && !body._sistema && CTX_.modo && !CTX_.u) {
    // v109: la persona responde su inducción desde el inicio, sin usuario (solo se crea, no se edita).
    if (body.action !== 'guardar' || prev) return { ok: false, error: 'La inducción ya registrada solo la modifica el área SST.' };
    body.doc = limpiarInduccionPublica_(body.doc || {});
    if (!body.doc.nombre || !body.doc.cedula) return { ok: false, error: 'Faltan el nombre y la cédula.' };
  }
  if (tipo === 'pqrs' && !body._sistema && (!esSst_() || (body.action === 'guardar' && !prev && body.doc && body.doc.publica === true))) {
    // v109: PQRS desde «Reportar un evento» o sin usuario SST: solo se crea y la arma el servidor (campos acotados y limpios).
    const ep = body.action !== 'guardar' || prev ? 'La PQRS ya fue recibida: la responde el área encargada desde Calidad.' : (!/^PQR-[A-Za-z0-9-]{3,60}$/.test(id) ? 'Identificador de PQRS inválido.' : '');
    const lp = ep ? ep : limpiarPqrsPublica_(body.doc || {});
    if (typeof lp === 'string') { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', lp, body.opId, versionActual, tipo); return { ok: false, error: lp }; }
    body.doc = lp;
  }
  if (tipo === 'habeas' && !body._sistema && !(esSst_() && prev)) {   // SST solo la actualiza (crearla siempre pasa por aquí)
    // v162: la solicitud la arma el servidor (campos acotados, plazo legal y radicado); quien la presenta no puede cambiarla después.
    if (body.action !== 'guardar' || prev || !/^HAB-[A-Za-z0-9-]{3,60}$/.test(id)) { registrarEvento_(id, 'GUARDAR', 'RECHAZADO', 'Solicitud inválida', body.opId, versionActual, tipo); return { ok: false, error: 'La solicitud ya fue recibida: la responde el área encargada.' }; }
    const d = body.doc || {}, clase = /actualiz|correg|revoc|suprim|reclam/i.test(texto_(d.derecho)) ? 'Reclamo' : 'Consulta', hoy = hoyISO_();
    const ced = texto_(d.cedula).replace(/\D/g, '');
    if (texto_(d.nombre).trim().length < 5 || ced.length < 5 || texto_(d.contacto).trim().length < 6) return { ok: false, error: 'Escribe tu nombre, tu cédula y un correo o celular para responderte.' };
    body.doc = { fecha: hoy, radicado: id, clase: clase, derecho: corto_(d.derecho, 80), nombre: corto_(d.nombre, 120), cedula: ced, contacto: corto_(d.contacto, 120), detalle: corto_(d.detalle, 1500),
      estado: 'RECIBIDA', vence: sumarHabiles_(hoy, clase === 'Reclamo' ? 15 : 10), verificacion: 'Pendiente: confirmar la identidad antes de entregar o cambiar datos' };
  }
  if ((tipo === 'encresp' || tipo === 'encuestacli') && !body._sistema) {
    // v107: la respuesta del cliente la arma el servidor (nunca se confía en lo que manda el navegador).
    const re = tipo === 'encresp' ? validarRespuestaEnc_(body, id, prev) : validarEncuestaCli_(body, prev);
    if (re) { registrarEvento_(id, body.action === 'parche' ? 'PARCHE' : 'GUARDAR', 'RECHAZADO', re.error, body.opId, versionActual, tipo); return re; }
  }
  if (body.action === 'parche') {
    // Reportes, acciones e inspecciones se crean con "guardar". Si llega antes
    // un cambio (la cola sin señal los mandó en desorden), se espera: si se
    // creara aquí, el "guardar" que llega después borraría ese cambio.
    if (!prev && ['reporte', 'accion', 'inspeccion', 'plantillainsp'].indexOf(tipo) !== -1) {
      return { ok: false, codigoError: 'TEMPORAL', error: 'El registro todavía no ha llegado al servidor; este cambio se reenvía solo.' };
    }
    doc = mezclar_(prevDoc(), body.campos || {});
    // "agregar": se suma a la lista del SERVIDOR (no se reemplaza con la copia
    // del celular). Así dos celulares que anotan avances no se borran entre sí.
    const ag = body.agregar || {};
    Object.keys(ag).forEach(function (k) {
      const lista = Array.isArray(doc[k]) ? doc[k] : [];
      (Array.isArray(ag[k]) ? ag[k] : [ag[k]]).forEach(function (it) {
        const ya = lista.some(function (x) { return (it && typeof it === 'object' && it.uid) ? (x && x.uid === it.uid) : JSON.stringify(x) === JSON.stringify(it); });
        if (!ya) lista.push(it);
      });
      doc[k] = lista;
    });
    // Anotar un avance pone en proceso una acción abierta; nunca reabre una cerrada.
    if (tipo === 'accion' && ag.seguimiento && (doc.estado || 'ABIERTA') === 'ABIERTA') doc.estado = 'EN PROCESO';
  } else {
    if (prev && body.versionBase !== undefined && body.versionBase !== null && Number(body.versionBase) !== versionActual) {
      registrarEvento_(id, 'GUARDAR', 'RECHAZADO', 'Conflicto de versión (base ' + body.versionBase + ', actual ' + versionActual + ')', body.opId, versionActual, tipo);
      return { ok: false, conflicto: true, version: versionActual, error: 'Otra persona actualizó este registro. Ábrelo de nuevo para ver los cambios.' };
    }
    doc = body.doc || {};
  }
  // Los adjuntos se agregan y retiran solo con "adjuntar" / "quitarAdjunto": fuera
  // de eso, lo que vale es lo que ya tiene el servidor (nunca lo que manda el celular).
  if (!body._interno) {
    const pa = prev && (prevResFallo || Number(prevRes._adjTotal) > 0) ? prevDoc().adjuntos : null;
    if (pa && pa.length) doc.adjuntos = pa; else delete doc.adjuntos;
  }
  // v169 · Un gasto del SG-SST tiene un valor positivo y razonable, y un año de 4 cifras.
  if (tipo === 'gasto') {
    const val = Number(doc.valor);
    const eg = !isFinite(val) || val <= 0 || val > 1e11 ? 'El valor del gasto debe ser un número mayor que cero.' : !/^\d{4}$/.test(texto_(doc.anio)) ? 'Falta el año del gasto.' : '';
    if (eg) { registrarEvento_(id, body.action, 'RECHAZADO', eg, body.opId, versionActual, tipo); return { ok: false, error: eg }; }
    doc.valor = Math.round(val);
  }
  // v164 · Maestro de personas: el personaId y las cédulas anteriores los pone el servidor, nunca el celular.
  if (tipo === 'trabajador') {
    const ef = identidadPersona_(doc, prev ? prevDoc() : null, !!body._interno, id);
    if (ef) { registrarEvento_(id, body.action, 'RECHAZADO', ef, body.opId, versionActual, tipo); return { ok: false, error: ef }; }
  }
  // La clave del Comité de Convivencia: crearla, cambiarla y cerrar el cambio
  // tienen reglas estrictas (ver reglaCifradoComite_).
  if (tipo === 'comite') {
    const r = reglaCifradoComite_(prevDoc(), doc, body) || reglaBuzon_(prevDoc(), doc, body);
    if (r) { registrarEvento_(id, body.action, 'RECHAZADO', r.error, body.opId, versionActual, tipo); return r; }
  }
  const ahora = new Date();
  // Adjuntar o quitar un adjunto no cambia la versión: así quien tiene el registro
  // abierto puede guardarlo igual (los adjuntos los conserva el servidor).
  const version = body._sinVersion && prev ? versionActual : versionActual + 1;
  if (CTX_.modo && tipo !== 'queja' && tipo !== 'buzon') {   // en las quejas (reservadas) no se anota nombre en el registro
    if (prev) prevDoc();   // se lee ANTES de escribir, para anotar qué cambió
    const quien = etiquetaUsuario_();
    const por = prev ? (doc.registradoPor || prevRes._por || '') : quien;
    if (por) doc.registradoPor = por;
    doc.modificadoPor = quien;
  }
  if (tipo !== 'queja' && tipo !== 'buzon') { try { sellarFirmas_(doc, ctxSello_(body, CTX_.u ? etiquetaUsuario_() : '', tipo + ':' + id), 0, prev ? prevDoc() : null); } catch (e) { console.log('Sello: ' + e.message); } }
  doc.id = id; doc.tipo = tipo; doc.version = version;
  doc.creado = doc.creado || (prev ? texto_(prev.createdAt && prev.createdAt.toISOString ? prev.createdAt.toISOString() : prev.createdAt) : ahora.toISOString());
  doc.actualizado = ahora.toISOString();
  const mapa = [];
  const limpio = extraerImagenes_(doc, mapa);
  guardarImagenes_(id, mapa);
  escribirDoc_(id, limpio);
  if (prev) limpiarImagenes_(id, limpio);
  const c = columnas_(tipo, limpio, id);
  const adj = (limpio.adjuntos || []).filter(function (a) { return a && !a.retirado; }).length;
  if (adj) c.resumen._adj = adj;
  if ((limpio.adjuntos || []).length) c.resumen._adjTotal = limpio.adjuntos.length;
  if (limpio.registradoPor) c.resumen._por = corto_(limpio.registradoPor, 120);
  // Qué cambió, para la bitácora (solo con usuarios: cuesta una lectura más).
  let cambio = '';
  if (CTX_.modo && tipo !== 'queja' && tipo !== 'buzon') {
    const ks = body.action === 'parche' ? Object.keys(body.campos || {}).concat(Object.keys(body.agregar || {}).map(function (k) { return k + ' (+)'; }))
      : (prev ? camposCambiados_(prevDoc(), limpio) : []);
    if (ks.length) cambio = ' · cambió: ' + ks.slice(0, 15).join(', ') + (ks.length > 15 ? '…' : '');
  }
  const valores = [celda_(id), celda_(tipo), version, celda_(c.estado), celda_(c.fecha), celda_(corto_(c.titulo, 300)), celda_(corto_(c.responsable, 120)), celda_(c.vence),   // v145: ninguna celda puede volverse fórmula
                   resumenCelda_(c.resumen), prev ? prev.createdAt : ahora, ahora, ''];
  const reg = regSheet_();
  if (fila === -1) reg.appendRow(valores); else reg.getRange(fila, 1, 1, valores.length).setValues([valores]);
  escribirVista_(tipo, id, limpio, false);
  registrarEvento_(id, body.action === 'parche' ? 'PARCHE' : (prev ? 'ACTUALIZAR' : 'CREAR'), 'APLICADO', corto_(c.titulo, 300) + cambio, body.opId, version, tipo);
  if (tipo === 'reporte' && !prev && limpio.clase === 'Accidente de trabajo') avisarAccidente_(id, limpio);
  if (tipo === 'buzon' && !prev) avisarBuzon_(limpio);
  if (tipo === 'accion' && limpio.origen === ORIGEN_ASESOR_ && texto_(limpio.asignadaPor).trim()) {
    try {
      if (!prev && puedeAvisarTarea_()) avisarTareaAsesor_(id, limpio, 'nueva');
      else if (limpio.estado === 'CERRADA' && texto_(prev.estado) !== 'CERRADA') avisarTareaAsesor_(id, limpio, 'cerrada');
    } catch (e) { registrarEvento_(id, 'CORREO', 'RECHAZADO', 'No salió el aviso de la tarea: ' + e.message, '', '', tipo); }
  }
  if (tipo === 'trabajador' && limpio.fusionadoCon && (!prev || texto_(prevDoc().fusionadoCon) !== texto_(limpio.fusionadoCon))) { try { efectoFusion_(id, limpio); } catch (e) { registrarEvento_(id, 'PERSONA', 'RECHAZADO', 'No se pasaron las cédulas a la ficha que queda: ' + e.message, '', '', tipo); } }
  if (tipo === 'reintegro' && !body._sistema) {
    try { efectoReintegro_(id, limpio); }
    catch (e) { registrarEvento_(id, 'HABILITACION', 'RECHAZADO', 'No se pasó la restricción del reintegro a Personal habilitado: ' + e.message, '', '', tipo); }
  }
  if (tipo === 'examen' && !body._sistema) { try { efectoExamen_(id, limpio); } catch (e) { registrarEvento_(id, 'HABILITACION', 'RECHAZADO', 'No se pasó la restricción a Personal habilitado: ' + e.message, '', '', tipo); } }
  if (tipo === 'induccion' && !body._sistema) { try { efectoInduccion_(limpio); } catch (e) { registrarEvento_(id, 'HABILITACION', 'RECHAZADO', 'No se actualizó Personal habilitado: ' + e.message, '', '', tipo); } }
  if ((tipo === 'reporte' || tipo === 'preop') && !prev && !body._sistema) { try { efectoAccionAuto_(tipo, id, limpio); } catch (e) { registrarEvento_(id, 'ACCION', 'RECHAZADO', 'No se creó la acción automática: ' + e.message, '', '', tipo); } }
  if (tipo === 'encresp' && !prev) { try { efectoRespuestaEnc_(id, limpio); } catch (e) { registrarEvento_(id, 'ENCUESTA', 'RECHAZADO', 'No se marcó la encuesta como respondida: ' + e.message, '', '', tipo); } }
  return puedeLeer_(tipo) ? { ok: true, id: id, version: version, resumen: c.resumen, estado: c.estado } : { ok: true, id: id, version: version, estado: c.estado };   // v148: sin resumen si no lo puede leer
}

/* Una inducción o reinducción APROBADA deja al día el requisito "induccion" de la
   persona en Personal habilitado (la crea si no existe). Lo hace el servidor: un
   supervisor puede registrar inducciones aunque no pueda editar el personal. */
/* v157 · Restricciones médicas que frenan el trabajo. Del examen solo pasa a Personal habilitado PARA QUÉ
   trabajos tiene restricción (alturas, confinados…), hasta cuándo y el concepto; nunca el diagnóstico.
   Así el permiso y el ATS no dejan incluir a la persona en esos trabajos. Manda el examen más reciente. */
const RESTRINGE_ = { 'Trabajo en alturas': 'alturas', 'Espacios confinados': 'confinados', 'Trabajo en caliente': 'caliente', 'Riesgo eléctrico': 'electrico', 'Izaje de cargas': 'izajes', 'Manipulación manual de cargas': 'cargas', 'Conducción de vehículos': 'conduccion' };
function efectoExamen_(id, d) {
  if (!d.cedula || !/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.fecha)) || d.tipoExamen === 'Egreso') return;
  const tid = fichaDePersona_(d.cedula);   // v164: por el maestro (cédula corregida o ficha unificada)
  if (clavePersonaCed_(d.cedula).length < 3 || filaDe_(tid) === -1) return;
  const actual = leerDoc_(tid, false) || {}, ya = actual.restriccionMed;
  if (ya && texto_(ya.fecha) > texto_(d.fecha) && ya.fuente !== id) return;   // hay un examen más reciente
  const lista = Array.isArray(d.restringePara) ? d.restringePara : String(d.restringePara || '').split(/\s*[,;|]\s*/);
  const para = lista.map(function (x) { return RESTRINGE_[texto_(x)] || ''; }).filter(Boolean);
  if (d.concepto === 'No apto') para.push('todo');
  const campos = { restriccionMed: { para: para, hasta: d.temporalidad === 'Temporales' ? texto_(d.venceRestriccion) : '', concepto: texto_(d.concepto), fecha: texto_(d.fecha), fuente: id } };
  const r = guardar_({ action: 'parche', tipo: 'trabajador', id: tid, campos: campos, opId: '', _interno: true, _sistema: true });
  if (!r.ok) throw new Error(r.error || 'error');
}
/* v169 · El reintegro con restricciones bloquea en Personal habilitado los trabajos que la persona no puede hacer
   (igual que un examen con restricciones), mientras el caso esté en seguimiento. Al cerrarlo con las restricciones
   levantadas, se quita ese bloqueo (si lo puso este reintegro). */
function efectoReintegro_(id, d) {
  if (!d.cedula) return;
  const tid = fichaDePersona_(d.cedula);
  if (clavePersonaCed_(d.cedula).length < 3 || filaDe_(tid) === -1) return;
  const actual = leerDoc_(tid, false) || {}, ya = actual.restriccionMed || null;
  if (texto_(d.estado) === 'CERRADO') {
    if (ya && ya.fuente === id) {
      const r0 = guardar_({ action: 'parche', tipo: 'trabajador', id: tid, campos: { restriccionMed: null }, opId: '', _interno: true, _sistema: true });
      if (!r0.ok) throw new Error(r0.error || 'error');
    }
    return;
  }
  const lista = Array.isArray(d.restringePara) ? d.restringePara : String(d.restringePara || '').split(/\s*[,;|]\s*/);
  const para = lista.map(function (x) { return RESTRINGE_[texto_(x)] || ''; }).filter(Boolean);
  if (!para.length) return;
  const fecha = texto_(d.fechaRetorno);
  if (ya && ya.fuente !== id && texto_(ya.fecha) > fecha) return;   // hay una restricción más reciente (examen o reintegro)
  const restr = { para: para, hasta: d.temporalidad === 'Temporales' ? texto_(d.venceRestriccion) : '', concepto: 'Reintegro con restricciones', fecha: fecha, fuente: id };
  const r = guardar_({ action: 'parche', tipo: 'trabajador', id: tid, campos: { restriccionMed: restr }, opId: '', _interno: true, _sistema: true });
  if (!r.ok) throw new Error(r.error || 'error');
}
/* v159 · Acciones automáticas: un acto o condición insegura, un incidente o un preoperacional con novedad crean
   SOLOS su acción en el plan de acción (id fijo ACC-<registro>, así nunca se duplica), con el responsable del área
   (Departamentos y áreas: «Área | Responsable») y una fecha según el potencial. El accidente de trabajo no: ese
   va por la investigación, que define sus propias acciones. */
function efectoAccionAuto_(tipo, id, d) {
  let origen = '', hallazgo = '', centro = texto_(d.centro), lugar = '', alta = false;
  if (tipo === 'reporte') {
    if (!/Acto|Condici|Incidente/i.test(texto_(d.clase))) return;
    origen = /Incidente/i.test(texto_(d.clase)) ? 'Incidente' : 'Reporte de actos y condiciones';
    hallazgo = texto_(d.clase) + (d.categoria ? ' · ' + texto_(d.categoria) : '') + ': ' + texto_(d.descripcion);
    lugar = texto_(d.lugar); alta = d.potencial === 'Alto' || /Incidente/i.test(texto_(d.clase));
  } else {
    if (!(Number(d.malos) > 0)) return;
    origen = 'Preoperacional';
    hallazgo = texto_(d.nombreFormulario) + (d.codigoEquipo ? ' ' + texto_(d.codigoEquipo) : '') + ': ' + (d.hallazgos || []).map(function (x) { return texto_(x.p) + ' → ' + texto_(x.v) + (x.obs ? ' (' + texto_(x.obs) + ')' : ''); }).join('; ');
    alta = true;
  }
  const aid = 'ACC-' + id;
  if (filaDe_(aid) !== -1) return;
  const responsable = responsableDeArea_([lugar, centro, texto_(d.area)].join(' '));
  const hoy = hoyISO_();
  const doc = { origen: origen, origenRef: id, hallazgo: hallazgo.slice(0, 1500), accion: 'Corregir y definir cómo evitar que se repita: ' + hallazgo.slice(0, 160), tipoAccion: 'Correctiva', prioridad: alta ? 'Alta' : 'Media',
    responsable: responsable, fechaCompromiso: sumarDias_(hoy, alta ? 5 : 15), centro: centro, fotos: [], estado: 'ABIERTA', fecha: hoy, creadoPor: 'Portal (automática)', seguimiento: [], automatica: true };
  const r = guardar_({ action: 'guardar', tipo: 'accion', id: aid, doc: doc, versionBase: 0, opId: '', _interno: true, _sistema: true });
  if (!r.ok) throw new Error(r.error || 'error');
}
function responsableDeArea_(texto) {
  const t = normalizar_(texto); if (!t.trim()) return '';
  const perfil = filaDe_('EMPRESA-PERFIL') === -1 ? null : leerDoc_('EMPRESA-PERFIL', false);
  const lineas = texto_(perfil && perfil.areasTexto).split('\n');
  for (let i = 0; i < lineas.length; i++) { const p = lineas[i].split('|'), a = normalizar_(p[0]).trim(); if (a.length >= 3 && p[1] && t.indexOf(a) !== -1) return texto_(p[1]).trim(); }
  return '';
}
function efectoInduccion_(d) {
  if (d.resultado !== 'APROBADA' || !d.cedula || d.tipoInduccion === 'Visitante' || !/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.fecha))) return;
  const tid = fichaDePersona_(d.cedula);   // v164: por el maestro (cédula corregida o ficha unificada)
  if (clavePersonaCed_(d.cedula).length < 3) return;
  const f = filaDe_(tid), actual = f === -1 ? null : (leerDoc_(tid, false) || {});
  const ya = actual && actual.requisitos && actual.requisitos.induccion;
  if (ya && texto_(ya.fecha) >= texto_(d.fecha)) return;   // ya tiene una más reciente
  const campos = { requisitos: { induccion: { fecha: d.fecha, vence: texto_(d.vence) || '', fuente: d.id } } };
  // v110: la autorización de datos firmada con la inducción queda en la ficha de la persona (Salud la consulta).
  const aut = d.autorizacionDatos;
  if (aut && typeof aut === 'object') campos.autorizacionDatos = { general: aut.general === true, sensibles: aut.sensibles === true, version: texto_(aut.version), fecha: texto_(d.fecha), fuente: d.id };
  // v174: quien llega por una inducción queda «por revisar»: SST decide si es del personal.
  if (!actual) Object.assign(campos, { nombre: d.nombre, cedula: d.cedula, cargo: d.cargo || '', empresa: d.empresa || '', activo: true, porRevisar: true, origen: 'Inducción' });
  const r = guardar_({ action: 'parche', tipo: 'trabajador', id: tid, campos: campos, opId: '', _interno: true, _sistema: true });
  if (!r.ok) throw new Error(r.error || 'error');
}
/* ── v107: encuestas de satisfacción que responde el cliente por enlace, sin usuario ──
   El SST crea la encuesta (encuestacli) con una clave aleatoria larga; el enlace lleva
   id + clave. El servidor solo entrega las preguntas de ESA encuesta si la clave coincide,
   acepta UNA respuesta (id fijo RSP-<encuesta>), solo mientras está abierta y sin vencer,
   con textos acotados, y calcula él mismo el promedio y el NPS. */
const ENC_TIPOS_ = ['escala', 'nps', 'sino', 'texto'];
function textoLimpio_(v, max) { return texto_(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+$/g, '').slice(0, max); }
function encuestaDeEnlace_(e, k) {
  const id = texto_(e).trim(), clave = texto_(k).trim();
  if (!/^ENV-[A-Za-z0-9-]{3,60}$/.test(id) || !/^[A-Za-z0-9]{24,64}$/.test(clave)) return null;
  const f = filaDe_(id); if (f === -1) return null;
  const r = leerFila_(f); if (r.borrado || r.tipo !== 'encuestacli') return null;
  const d = leerDoc_(id, false);
  if (!d || texto_(d.clave) !== clave) return null;
  return d;
}
function estadoEncuesta_(d) {
  if (texto_(d.estado) === 'RESPONDIDA' || d.respuestaId) return { cerrada: true, error: 'Esta encuesta ya fue respondida. ¡Gracias!' };
  if (texto_(d.estado) !== 'ABIERTA') return { cerrada: true, error: 'Esta encuesta ya no recibe respuestas.' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.fechaLimite)) && texto_(d.fechaLimite) < hoyISO_()) return { cerrada: true, error: 'El plazo para responder esta encuesta terminó.' };
  return null;
}
function preguntasEnc_(d) { return (Array.isArray(d.preguntas) ? d.preguntas : []).filter(function (q) { return q && ENC_TIPOS_.indexOf(q.tipo) !== -1 && /^[a-z0-9_]{1,24}$/i.test(texto_(q.id)); }).slice(0, 20); }
/** GET encuestaPublica (sin usuario): solo lo necesario para responder ESA encuesta. */
function encuestaPublica_(p) {
  const d = encuestaDeEnlace_(p.e, p.k);
  if (!d) return { ok: false, codigoError: 'NOENCUESTA', error: 'No encontramos esta encuesta. Revisa que el enlace esté completo.' };
  const est = estadoEncuesta_(d);
  if (est) return { ok: false, codigoError: 'CERRADA', cerrada: true, error: est.error };
  return { ok: true, cliente: textoLimpio_(d.cliente, 120), contacto: textoLimpio_(d.contacto, 120), periodo: textoLimpio_(d.periodo, 80), intro: textoLimpio_(d.intro, 600), fechaLimite: texto_(d.fechaLimite),
           preguntas: preguntasEnc_(d).map(function (q) { return { id: texto_(q.id), texto: textoLimpio_(q.texto, 300), tipo: q.tipo, obligatoria: q.obligatoria !== false }; }) };
}
function validarEncuestaCli_(body, prev) {
  const d = body.action === 'parche' ? (body.campos || {}) : (body.doc || {});
  if (prev && body.action !== 'parche') return { ok: false, error: 'La encuesta ya existe: se actualiza con un cambio puntual (parche).' };
  if (body.action !== 'parche' || d.clave !== undefined) { if (!/^[A-Za-z0-9]{24,64}$/.test(texto_(d.clave))) return { ok: false, error: 'La encuesta necesita una clave aleatoria de 24 a 64 letras y números.' }; }
  if (d.preguntas !== undefined) {
    if (!Array.isArray(d.preguntas) || !d.preguntas.length || d.preguntas.length > 20) return { ok: false, error: 'La encuesta debe tener de 1 a 20 preguntas.' };
    if (d.preguntas.some(function (q) { return !q || ENC_TIPOS_.indexOf(q.tipo) === -1 || !/^[a-z0-9_]{1,24}$/i.test(texto_(q.id)) || !texto_(q.texto).trim() || texto_(q.texto).length > 300; })) return { ok: false, error: 'Hay una pregunta vacía, muy larga o de un tipo desconocido.' };
    const ids = d.preguntas.map(function (q) { return texto_(q.id); });
    if (ids.some(function (x, i) { return ids.indexOf(x) !== i; })) return { ok: false, error: 'Hay dos preguntas con el mismo código.' };
    if (d.preguntas.filter(function (q) { return q.tipo === 'nps'; }).length > 1) return { ok: false, error: 'La encuesta lleva una sola pregunta de recomendación (NPS de 0 a 10).' };
  }
  if (texto_(d.intro).length > 600) return { ok: false, error: 'El mensaje de presentación es muy largo (máximo 600 letras).' };
  if (d.estado !== undefined && ['ABIERTA', 'CERRADA', 'RESPONDIDA'].indexOf(texto_(d.estado)) === -1) return { ok: false, error: 'Estado de la encuesta no válido.' };
  if (prev && body.action === 'parche' && d.estado === 'ABIERTA' && (texto_(prev.estado) === 'RESPONDIDA' || /"respuestaId":"RSP-/.test(texto_(prev.resumen)))) return { ok: false, error: 'Esta encuesta ya fue respondida: no se puede reabrir (envía una nueva).' };
  // Lo que pone el servidor al responder no se cambia desde el navegador.
  if (prev && body.action === 'parche') ['respuestaId', 'fechaRespuesta', 'promedio', 'nps'].forEach(function (k) { delete d[k]; });
  return null;
}
function validarRespuestaEnc_(body, id, prev) {
  if (body.action === 'parche') {
    // Solo se anotan los enlaces a la acción o la PQRS que se crearon desde la respuesta.
    const ks = Object.keys(body.campos || {});
    if (!prev || body.agregar || !ks.length || ks.some(function (k) { return ['accionId', 'pqrsId'].indexOf(k) === -1; })) return { ok: false, error: 'La respuesta del cliente no se modifica.' };
    ks.forEach(function (k) { body.campos[k] = textoLimpio_(body.campos[k], 80); });
    return null;
  }
  if (prev) return { ok: false, codigoError: 'CERRADA', error: 'Esta encuesta ya fue respondida. ¡Gracias!' };
  const r = body.doc || {};
  const enc = encuestaDeEnlace_(r.e, r.k);
  if (!enc) return { ok: false, codigoError: 'NOENCUESTA', error: 'No encontramos esta encuesta. Revisa que el enlace esté completo.' };
  if (id !== 'RSP-' + texto_(enc.id || r.e)) return { ok: false, error: 'Identificador de respuesta inválido.' };
  const est = estadoEncuesta_(enc); if (est) return { ok: false, codigoError: 'CERRADA', error: est.error };
  const dadas = (r.respuestas && typeof r.respuestas === 'object' && !Array.isArray(r.respuestas)) ? r.respuestas : {};
  const out = [], faltan = [], escalas = [];
  let nps = '';
  preguntasEnc_(enc).forEach(function (q) {
    const v = dadas[q.id], vacio = v == null || v === '';
    let val = '';
    if (q.tipo === 'escala') { const n = Number(v); if (!vacio && (n !== Math.round(n) || n < 1 || n > 5)) faltan.push(q.texto); else if (!vacio) { val = n; escalas.push(n); } }
    else if (q.tipo === 'nps') { const n = Number(v); if (!vacio && (n !== Math.round(n) || n < 0 || n > 10)) faltan.push(q.texto); else if (!vacio) { val = n; nps = n; } }
    else if (q.tipo === 'sino') { if (!vacio && ['Sí', 'No'].indexOf(texto_(v)) === -1) faltan.push(q.texto); else val = vacio ? '' : texto_(v); }
    else val = textoLimpio_(v, 1500).trim();
    if ((val === '' || val == null) && q.obligatoria !== false && faltan.indexOf(q.texto) === -1) faltan.push(q.texto);
    out.push({ id: texto_(q.id), texto: textoLimpio_(q.texto, 300), tipo: q.tipo, valor: val });
  });
  if (faltan.length) return { ok: false, codigoError: 'FALTAN', faltan: faltan.slice(0, 20), error: 'Falta responder: ' + faltan.slice(0, 5).join(' · ') + (faltan.length > 5 ? '…' : '') };
  const doc = { encuestaId: texto_(enc.id || r.e), cliente: texto_(enc.cliente), periodo: texto_(enc.periodo), fecha: hoyISO_(), canal: 'Enlace', respuestas: out,
                comentario: textoLimpio_(r.comentario, 1500).trim(), encuestado: textoLimpio_(r.encuestado, 120).trim() || texto_(enc.contacto), cargo: textoLimpio_(r.cargo, 80).trim(),
                promedio: escalas.length ? Math.round(escalas.reduce(function (a, b) { return a + b; }, 0) / escalas.length * 100) / 100 : '', nps: nps };
  ['calidad', 'oportunidad', 'atencion', 'precio'].forEach(function (k) { const x = out.filter(function (q) { return q.id === k && q.tipo === 'escala'; })[0]; doc[k] = x && x.valor !== '' ? x.valor : ''; });
  out.forEach(function (q) { if (q.tipo === 'texto' && q.id === 'comentario' && !doc.comentario) doc.comentario = q.valor; });
  body.doc = doc;
  return null;
}
/** Encuesta de peligros (trabajadores): textos acotados, clases conocidas, máximo 80 peligros. */
const CLASES_GTC45_ = ['Biológico', 'Físico', 'Químico', 'Psicosocial', 'Biomecánico', 'Condiciones de seguridad', 'Fenómenos naturales'];
const FREC_PEL_ = ['Todos los días', 'Varias veces por semana', 'De vez en cuando', 'Rara vez'];
/* v109: inducción respondida por la persona en el inicio (sin usuario). El servidor arma el
   registro: fecha de hoy, textos acotados, nota recalculada con las respuestas y vencimiento. */
const TIPOS_IND_PUBLICA_ = ['Inducción', 'Reinducción anual', 'Inducción de contratista', 'Visitante'];
/* v110: autorización de datos (Ley 1581) que firma la persona con su inducción.
   Solo verdadero/falso y la versión del texto; la fecha la pone el servidor. */
function limpiarAutorizacion_(a) {
  if (!a || typeof a !== 'object') return null;
  return { version: textoLimpio_(a.version, 30).trim(), fecha: new Date().toISOString(), general: a.general === true, sensibles: a.sensibles === true };
}
function limpiarInduccionPublica_(d) {
  const hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  const tipoI = TIPOS_IND_PUBLICA_.indexOf(texto_(d.tipoInduccion)) !== -1 ? texto_(d.tipoInduccion) : 'Inducción';
  const resp = (Array.isArray(d.respuestas) ? d.respuestas : []).slice(0, 40).map(function (r) {
    return { pregunta: textoLimpio_(r && r.pregunta, 300).trim(), respuesta: textoLimpio_(r && r.respuesta, 300).trim(), correcta: !!(r && r.correcta === true) };
  }).filter(function (r) { return r.pregunta; });
  const aprueba = Math.min(100, Math.max(50, Number(d.aprueba) || 80));
  const visitante = tipoI === 'Visitante';
  const nota = resp.length ? Math.round(resp.filter(function (r) { return r.correcta; }).length * 100 / resp.length) : 0;
  const resultado = visitante ? 'REALIZADA' : (resp.length && nota >= aprueba ? 'APROBADA' : 'REPROBADA');
  const vence = resultado === 'APROBADA' ? Utilities.formatDate(new Date(new Date(hoy + 'T12:00:00').getTime() + 364 * 86400000), 'America/Bogota', 'yyyy-MM-dd') : '';
  const firma = typeof d.firma === 'string' && /^data:image\/(png|jpeg);base64,/.test(d.firma) && d.firma.length < 120000 ? d.firma : '';
  return {
    tipoInduccion: tipoI, fecha: hoy, nombre: textoLimpio_(d.nombre, 120).trim(), cedula: String(d.cedula || '').replace(/\D/g, '').slice(0, 12),
    cargo: textoLimpio_(d.cargo, 80).trim(), empresa: textoLimpio_(d.empresa, 120).trim(), dicto: textoLimpio_(d.dicto, 120).trim() || 'Autoservicio (respondida en el portal)',
    temas: (Array.isArray(d.temas) ? d.temas : []).slice(0, 30).map(function (t) { return textoLimpio_(t, 200).trim(); }).filter(String),
    preguntas: resp.length, respuestas: resp, puntaje: visitante ? '' : nota, aprueba: aprueba, resultado: resultado, vence: vence, firma: firma, autoservicio: true,
    autorizacionDatos: limpiarAutorizacion_(d.autorizacionDatos), autorizaDatos: d.autorizacionDatos && d.autorizacionDatos.general === true ? 'SÍ' : 'NO',
    autorizaSalud: d.autorizacionDatos && d.autorizacionDatos.sensibles === true ? 'SÍ' : 'NO'
  };
}
function limpiarEncPeligro_(d) {
  const peligros = (Array.isArray(d.peligros) ? d.peligros : []).slice(0, 80).filter(function (x) { return x && CLASES_GTC45_.indexOf(texto_(x.clase)) !== -1 && textoLimpio_(x.tipo, 120).trim(); })
    .map(function (x) { return { clase: texto_(x.clase), tipo: textoLimpio_(x.tipo, 120).trim(), frecuencia: FREC_PEL_.indexOf(texto_(x.frecuencia)) !== -1 ? texto_(x.frecuencia) : '', comentario: textoLimpio_(x.comentario, 300).trim() }; });
  const anon = d.anonima !== false;
  return { fecha: hoyISO_(), area: textoLimpio_(d.area, 80).trim() || 'Sin área', proceso: textoLimpio_(d.proceso, 80).trim(), cargo: textoLimpio_(d.cargo, 80).trim(),
           nombre: anon ? '' : textoLimpio_(d.nombre, 80).trim(), anonima: anon, peligros: peligros, nPeligros: peligros.length,
           clases: CLASES_GTC45_.filter(function (c) { return peligros.some(function (x) { return x.clase === c; }); }).join(', '),
           peligrosTexto: peligros.map(function (x) { return x.clase + ': ' + x.tipo + (x.frecuencia ? ' (' + x.frecuencia + ')' : ''); }).join('\n'),
           sugerencias: textoLimpio_(d.sugerencias, 1000).trim() };
}
/** v109: PQRS que llega sin usuario (cliente, trabajador, contratista, comunidad): el servidor
 *  arma el registro con listas cerradas, textos acotados, fecha de hoy, estado ABIERTA y plazo
 *  (el del navegador solo si es una fecha entre hoy y 60 días; si no, 15 días hábiles). */
const TIPOS_PQRS_ = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación'];
const PRESENTA_PQRS_ = ['Cliente', 'Trabajador', 'Contratista', 'Comunidad', 'Otro'];
function limpiarPqrsPublica_(d) {
  const tipo = texto_(d.tipoPQRS);
  if (TIPOS_PQRS_.indexOf(tipo) === -1) return 'Elige si es petición, queja, reclamo, sugerencia o felicitación.';
  const descripcion = textoLimpio_(d.descripcion, 1500).trim();
  if (descripcion.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '').length < 8) return 'Cuéntanos con más detalle la PQRS.';
  const anon = d.anonima === true, presenta = PRESENTA_PQRS_.indexOf(texto_(d.presenta)) !== -1 ? texto_(d.presenta) : 'Otro';
  const nombre = anon ? '' : textoLimpio_(d.nombre, 80).trim(), empresa = anon ? '' : textoLimpio_(d.empresa, 100).trim();
  const hoy = hoyISO_(), lim = texto_(d.fechaLimite);
  const plazo = /^\d{4}-\d{2}-\d{2}$/.test(lim) && lim >= hoy && lim <= sumarDias_(hoy, 60) ? lim : sumarHabiles_(hoy, 15);
  const fotos = (Array.isArray(d.fotos) ? d.fotos : []).filter(function (f) { return typeof f === 'string' && f.length <= 700000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(f); }).slice(0, 3);
  return { fecha: hoy, tipoPQRS: tipo, presenta: presenta, anonima: anon, nombre: nombre, empresa: empresa, contacto: anon ? '' : textoLimpio_(d.contacto, 120).trim(),
           cliente: empresa || nombre || ('Anónimo (' + presenta.toLowerCase() + ')'), area: textoLimpio_(d.area, 80).trim(), descripcion: descripcion,
           canal: 'Portal (Reportar un evento)', origen: 'Reportar un evento', fotos: fotos, nFotos: fotos.length, responsable: '', respuesta: '', fechaRespuesta: '',
           procede: 'Por analizar', estado: 'ABIERTA', fechaLimite: plazo, limiteAuto: plazo };
}
/** Con la respuesta guardada, la encuesta queda RESPONDIDA (ya no recibe otra). */
function efectoRespuestaEnc_(id, d) {
  const r = guardar_({ action: 'parche', tipo: 'encuestacli', id: d.encuestaId, campos: { estado: 'RESPONDIDA', fechaRespuesta: d.fecha, respuestaId: id, promedio: d.promedio, nps: d.nps }, opId: '', _interno: true, _sistema: true });
  if (!r.ok) throw new Error(r.error || 'error');
}
function hashPrueba_(p) {
  if (!p) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(p))
    .map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('');
}
function cifradoConvivencia_() { const d = leerDoc_('CMT-CONVIVENCIA', false); return (d && d.cifrado) || null; }
/* Solo quien tiene la clave del comité puede escribir o borrar quejas: el celular
   manda la "prueba" (sale de la clave, pero no sirve para descifrar). */
function pruebaValida_(body, conf) { return !!(conf && conf.pruebaHash && body.prueba && hashPrueba_(body.prueba) === conf.pruebaHash); }
function validarQueja_(d, body) {
  const permitidos = CAMPOS_QUEJA.concat(['id', 'tipo', 'version', 'creado', 'actualizado']);
  for (const k in d) {
    if (permitidos.indexOf(k) === -1) return 'Campo no permitido en una queja: ' + k + ' (todo el contenido va cifrado).';
    if (k !== 'cifrado' && d[k] != null && (typeof d[k] !== 'string' || d[k].length > 60)) return 'Dato no permitido fuera del cifrado: ' + k + '.';
  }
  const c = d.cifrado, b64 = /^[A-Za-z0-9+/=]+$/;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return 'La queja debe llegar cifrada con la clave del comité.';
  for (const k in c) if (['v', 'kid', 'iv', 'data'].indexOf(k) === -1) return 'La queja debe llegar cifrada con la clave del comité.';
  if (!b64.test(texto_(c.iv)) || !b64.test(texto_(c.data)) || !/^[0-9a-f]{6,32}$/.test(texto_(c.kid))) return 'La queja debe llegar cifrada con la clave del comité.';
  const conf = cifradoConvivencia_();
  if (!conf || !conf.actual) return 'El Comité de Convivencia todavía no tiene clave.';
  if (c.kid !== conf.actual.kid) return 'La clave del comité cambió: cierra las quejas y ábrelas con la clave nueva.';
  if (!pruebaValida_(body, conf.actual)) return 'Clave del comité incorrecta.';
  return '';
}
function quejasConKid_(kid) {
  const reg = regSheet_(), last = reg.getLastRow(); let n = 0;
  if (last < 2 || !kid) return 0;
  reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (v[1] !== 'queja' || v[11]) return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) {}
    if (r.kid === kid) n++;
  });
  return n;
}
/** Reglas de la clave del comité. Devuelve null si se acepta, o el error. */
function reglaCifradoComite_(antes, doc, body) {
  const A = antes.cifrado || null, N = doc.cifrado || null;
  const kA = A && A.actual ? A.actual.kid : '', kN = N && N.actual ? N.actual.kid : '';
  const aA = A && A.anterior ? A.anterior.kid : '', aN = N && N.anterior ? N.anterior.kid : '';
  const no = function (m, extra) { return Object.assign({ ok: false, error: m }, extra || {}); };
  if (!kA) {                                   // todavía no hay clave: se crea
    if (!kN) { if (N) delete doc.cifrado; return null; }
    if (aN) return no('Una clave nueva no puede traer clave anterior.');
    if (!body.pruebaNueva) return no('Falta la prueba de la clave nueva.');
    doc.cifrado = { actual: Object.assign({}, N.actual, { pruebaHash: hashPrueba_(body.pruebaNueva) }), anterior: null };
    return null;
  }
  if (!kN) return no('No se puede quitar la clave del comité.', { claveExiste: true });
  if (kN !== kA) {                             // cambio de clave
    if (!body.cambioClave) return no('El comité ya tiene una clave. Para cambiarla usa "Cambiar la clave del comité".', { claveExiste: true });
    if (body.kidBase !== kA) return no('La clave del comité ya cambió en otro equipo. Recarga la página.', { conflicto: true });
    if (aA) return no('Hay un cambio de clave sin terminar: termínalo antes de cambiarla otra vez.');
    if (!pruebaValida_(body, A.actual)) return no('Clave del comité incorrecta.');
    if (!body.pruebaNueva) return no('Falta la prueba de la clave nueva.');
    doc.cifrado = { actual: Object.assign({}, N.actual, { pruebaHash: hashPrueba_(body.pruebaNueva) }), anterior: A.actual };
    return null;
  }
  // Misma clave: el celular no puede alterarla; se conserva la del servidor.
  if (aN !== aA) {
    if (aN) return no('No se puede cambiar la clave anterior.');
    if (!pruebaValida_(body, A.actual)) return no('Clave del comité incorrecta.');
    const quedan = quejasConKid_(aA);
    if (quedan) return no('Todavía hay ' + quedan + ' queja(s) con la clave anterior.');
    doc.cifrado = { actual: A.actual, anterior: null };
    return null;
  }
  doc.cifrado = { actual: A.actual, anterior: A.anterior || null };
  return null;
}

/* ── v128: buzón reservado del comité ──
   comite.buzon = { publica: JWK RSA-OAEP (pública, la usan los celulares para cifrar),
                    privada: {v, kid, iv, data} (la privada, cifrada con la clave del comité),
                    correo: a dónde se avisa que llegó algo (sin contenido) }. */
function reglaBuzon_(antes, doc, body) {
  const A = antes.buzon || null, N = doc.buzon || null;
  if (JSON.stringify(A) === JSON.stringify(N)) return null;
  if (!N) { if (A) doc.buzon = A; return null; }                       // no se quita por un parche que no lo trae
  const conf = (doc.cifrado && doc.cifrado.actual) || (antes.cifrado && antes.cifrado.actual);
  if (!conf || !pruebaValida_(body, conf)) { doc.buzon = A; if (!A) delete doc.buzon; return { ok: false, error: 'Para activar o cambiar el buzón hace falta la clave del comité.' }; }
  const pub = N.publica, pri = N.privada, b64 = /^[A-Za-z0-9+/=_-]+$/;
  if (!pub || typeof pub !== 'object' || pub.kty !== 'RSA' || !b64.test(texto_(pub.n)) || !b64.test(texto_(pub.e)) || texto_(pub.n).length > 1200) return { ok: false, error: 'Llave pública del buzón inválida.' };
  if (!pri || typeof pri !== 'object' || !b64.test(texto_(pri.iv)) || !b64.test(texto_(pri.data)) || texto_(pri.data).length > 8000) return { ok: false, error: 'Llave privada del buzón inválida.' };
  const correo = texto_(N.correo).trim();
  if (correo && !/^[^\s@]{1,64}@[^\s@]{1,120}\.[a-z]{2,}$/i.test(correo)) return { ok: false, error: 'El correo del comité no es válido.' };
  doc.buzon = { publica: { kty: 'RSA', n: texto_(pub.n), e: texto_(pub.e), alg: 'RSA-OAEP-256', ext: true }, privada: { v: 1, kid: texto_(pri.kid), iv: texto_(pri.iv), data: texto_(pri.data) }, correo: correo.slice(0, 120) };
  return null;
}
/** Lo que necesita el formulario público: la llave pública y el correo del comité. */
function buzonPublico_() {
  const d = leerDoc_('CMT-CONVIVENCIA', false) || {}, b = d.buzon || {};
  return { ok: true, activo: !!(b.publica && b.publica.n), publica: b.publica || null, correo: texto_(b.correo), empresa: texto_(PropertiesService.getScriptProperties().getProperty('EMPRESA')) };
}
/** De lo que llega al buzón solo se acepta: clase, fecha, código y el bloque cifrado. */
function limpiarBuzon_(d) {
  const clase = texto_(d.clase);
  if (['convivencia', 'acoso'].indexOf(clase) === -1) return 'Clase inválida.';
  const c = d.cifrado, b64 = /^[A-Za-z0-9+/=]+$/;
  if (!c || typeof c !== 'object') return 'Debe llegar cifrado.';
  for (const k in c) if (['v', 'kp', 'ek', 'iv', 'data'].indexOf(k) === -1) return 'Debe llegar cifrado.';
  if (!b64.test(texto_(c.ek)) || !b64.test(texto_(c.iv)) || !b64.test(texto_(c.data)) || !/^[0-9a-f]{8,40}$/.test(texto_(c.kp))) return 'Debe llegar cifrado.';
  if (texto_(c.data).length > 9000000) return 'Es demasiado grande: deja menos evidencias o envíalas al correo del comité.';
  const b = buzonPublico_(); if (!b.activo) return 'El comité todavía no ha activado el buzón.';
  return { clase: clase, fecha: hoyISO_(), codigo: corto_(d.codigo, 20), estado: 'RECIBIDA', cifrado: { v: 1, kp: texto_(c.kp), ek: texto_(c.ek), iv: texto_(c.iv), data: texto_(c.data) } };
}
/** Aviso al correo del comité: solo que llegó algo y su código (nunca el contenido). */
function avisarBuzon_(d) {
  try {
    const b = buzonPublico_(); if (!b.correo) return;
    const que = d.clase === 'acoso' ? 'un reporte de acoso sexual' : 'una queja de convivencia laboral';
    MailApp.sendEmail(b.correo, 'Buzón del comité: llegó ' + que + ' (' + d.codigo + ')',
      'Llegó ' + que + ' al buzón reservado del portal, con el código ' + d.codigo + ' (' + d.fecha + ').\n\n' +
      'Por reserva, este correo no trae el contenido. Ábrelo en el portal: Gestión → Comité de Convivencia → Buzón, con la clave del comité.');
  } catch (e) { registrarEvento_('BUZON', 'CORREO', 'RECHAZADO', 'No salió el aviso del buzón: ' + e.message, '', '', 'buzon'); }
}

function borrar_(body) {
  const id = texto_(body.id), fila = filaDe_(id);
  if (fila === -1) return { ok: true, id: id, noExistia: true };
  const prev = leerFila_(fila);
  const sinPermiso = puedeEscribir_(prev.tipo, 'borrar', true);
  if (sinPermiso) { registrarEvento_(id, 'BORRAR', 'RECHAZADO', sinPermiso.error, body.opId, prev.version, prev.tipo); return sinPermiso; }
  if (prev.tipo === 'comite') return { ok: false, error: 'La conformación de un comité no se borra (queda como historial).' };
  if (prev.borrado) return { ok: true, id: id, yaBorrado: true };   // v141: no se reescribe la fecha ni el motivo
  const frenado = controlBorrado_(); if (frenado) { registrarEvento_(id, 'BORRAR', 'RECHAZADO', frenado.error, body.opId, prev.version, prev.tipo); return frenado; }
  if (prev.tipo === 'queja' || prev.tipo === 'buzon') { const conf = cifradoConvivencia_(); if (!conf || !pruebaValida_(body, conf.actual)) return { ok: false, error: 'Clave del comité incorrecta.' }; }
  regSheet_().getRange(fila, 12).setValue('BORRADO ' + new Date().toISOString() + (body.motivo ? ' · ' + corto_(body.motivo, 200) : ''));
  try { escribirVista_(prev.tipo, id, { mes: prev.tipo === 'mes' ? JSON.parse(prev.resumen || '{}').mes : '' }, true); } catch (e) {}
  registrarEvento_(id, 'BORRAR', 'APLICADO', body.motivo || '', body.opId, prev.version, prev.tipo);
  return { ok: true, id: id };
}

/* ===== v139 · DESHACER Y PAPELERA =====
   Lo borrado no se pierde (columna «borrado»). «restaurar» lo devuelve a las listas, con quien
   tenga permiso de borrar ese tipo, y queda en el historial. La papelera muestra lo borrado en
   los últimos 30 días. */
function restaurar_(body) {
  const id = texto_(body.id), fila = filaDe_(id);
  if (fila === -1) return { ok: false, error: 'Ese registro no existe.' };
  const prev = leerFila_(fila);
  if (!prev.borrado) return { ok: true, id: id, noEstabaBorrado: true };
  const sinPermiso = puedeEscribir_(prev.tipo, 'borrar', true) || (puedeLeer_(prev.tipo) ? null : (CTX_.u ? errPermiso_('Tu usuario no puede ver este registro.') : errSesion_()));
  if (sinPermiso) { registrarEvento_(id, 'RESTAURAR', 'RECHAZADO', sinPermiso.error, body.opId, prev.version, prev.tipo); return sinPermiso; }
  if (prev.tipo === 'queja' || prev.tipo === 'buzon') { const conf = cifradoConvivencia_(); if (!conf || !pruebaValida_(body, conf.actual)) return { ok: false, error: 'Clave del comité incorrecta.' }; }
  regSheet_().getRange(fila, 11, 1, 2).setValues([[new Date(), '']]);   // v168: la restauración cuenta como cambio (las listas la traen)
  try { escribirVista_(prev.tipo, id, leerDoc_(id, false) || {}, false); } catch (e) {}
  registrarEvento_(id, 'RESTAURAR', 'APLICADO', '', body.opId, prev.version, prev.tipo);
  return { ok: true, id: id, tipo: prev.tipo };
}
function papelera_() {
  if (CTX_.modo && !CTX_.u) return errSesion_();
  const sh = regSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, rows: [] };
  const lim = Date.now() - 30 * 864e5, vals = sh.getRange(2, 1, n, COLS_REG.length).getValues(), rows = [], puede = {};
  vals.forEach(function (v) {
    const b = String(v[11] || ''), m = /^BORRADO (\S+)(?: · (.*))?$/.exec(b);
    if (!m) return;
    const t = Date.parse(m[1]); if (!(t >= lim)) return;
    const tipo = String(v[1]);
    if (tipo === 'queja' || tipo === 'buzon' || tipo === 'comite') return;
    if (!(tipo in puede)) puede[tipo] = !puedeEscribir_(tipo, 'borrar', true) && puedeLeer_(tipo) && (!!CTX_.u || !CTX_.modo) && (CTX_.modo || SOLO_SST.indexOf(tipo) === -1);
    if (!puede[tipo]) return;
    rows.push({ id: String(v[0]), tipo: tipo, titulo: String(v[5] || ''), fecha: v[4] instanceof Date ? v[4].toISOString().slice(0, 10) : String(v[4] || ''), responsable: String(v[6] || ''), borradoEn: m[1], motivo: m[2] || '' });
  });
  rows.sort(function (a, b) { return a.borradoEn < b.borradoEn ? 1 : -1; });
  return { ok: true, rows: rows.slice(0, 300) };
}

/* ================= ADJUNTOS (Google Drive) =================
   El archivo va a Drive (carpeta "Adjuntos SG-SST/<tipo>") y en el registro
   queda la ficha: nombre, tamaño, quién y cuándo. Nada se borra: "quitar"
   lo marca como retirado y renombra el archivo (queda la evidencia). */
const MIME_ADJ = /^(application\/pdf|image\/(jpeg|png|webp|gif)|application\/msword|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|text\/plain|text\/csv)$/;
const MAX_ADJ = 10 * 1024 * 1024;
function carpetaRaiz_(prop, nombre) {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty(prop);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* se borró: se crea otra */ } }
  // En el servidor único va dentro de la carpeta de la empresa.
  const c = (typeof carpeta_ === 'function') ? carpeta_().createFolder(nombre) : DriveApp.createFolder('Portal SSTA - ' + nombre);
  p.setProperty(prop, c.getId());
  return c;
}
function subcarpeta_(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}
function nombreArchivo_(n) { return corto_(String(n || 'archivo').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_'), 120) || 'archivo'; }
function adjuntar_(body) {
  const id = texto_(body.id), fila = filaDe_(id);
  if (fila === -1) return { ok: false, codigoError: 'TEMPORAL', error: 'El registro todavía no ha llegado al servidor; el adjunto se reenvía solo.' };
  const prev = leerFila_(fila);
  if (prev.borrado) return { ok: false, error: 'Ese registro fue borrado.' };
  if (prev.tipo === 'queja') return { ok: false, error: 'Las quejas de convivencia no llevan adjuntos (todo va cifrado).' };
  const sinPermiso = puedeEscribir_(prev.tipo, 'parche', true);
  if (sinPermiso) { registrarEvento_(id, 'ADJUNTAR', 'RECHAZADO', sinPermiso.error, body.opId, prev.version, prev.tipo); return sinPermiso; }
  const uid = texto_(body.uid);
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(uid)) return { ok: false, error: 'Identificador del adjunto inválido.' };
  const mime = texto_(body.mime).toLowerCase();
  if (!MIME_ADJ.test(mime)) return { ok: false, error: 'Tipo de archivo no permitido (PDF, imagen, Word, Excel, PowerPoint, texto o CSV).' };
  let bytes;
  try { bytes = Utilities.base64Decode(texto_(body.base64)); } catch (e) { return { ok: false, error: 'El archivo llegó dañado.' }; }
  if (!bytes.length) return { ok: false, error: 'El archivo está vacío.' };
  if (bytes.length > MAX_ADJ) return { ok: false, error: 'El archivo pasa de 10 MB.' };
  const doc = leerDoc_(id, false) || {};
  const ya = (doc.adjuntos || []).filter(function (a) { return a && a.uid === uid; })[0];
  if (ya) return { ok: true, id: id, version: prev.version, adjunto: ya, duplicado: true };
  const nombre = nombreArchivo_(body.nombre);
  const carpeta = subcarpeta_(carpetaRaiz_('CARPETA_ADJUNTOS', 'Adjuntos SG-SST'), prev.tipo);
  const archivo = carpeta.createFile(Utilities.newBlob(bytes, mime, id + ' - ' + nombre));
  const item = { uid: uid, nombre: nombre, mime: mime, tamano: bytes.length, fileId: archivo.getId(), en: new Date().toISOString(),
                 por: etiquetaUsuario_(), ref: corto_(body.ref, 60), nota: corto_(body.nota, 200) };
  const r = guardar_({ action: 'parche', tipo: prev.tipo, id: id, campos: {}, agregar: { adjuntos: [item] }, opId: body.opId, _interno: true, _sinVersion: true });
  if (!r.ok) { try { archivo.setTrashed(true); } catch (e) {} return r; }
  return Object.assign(r, { adjunto: item });
}
/* v153 · Paquete de documentación para un cliente. Arma un .zip con:
   - 00 Índice.pdf (lo arma el portal: relación de personal, equipos y programas de vigilancia),
   - Personal/<nombre - CC>/: los soportes adjuntos y las fotos de los soportes de cada requisito,
   - Equipos/<código - nombre>/: los documentos del equipo (ficha técnica, certificados…),
   - Programas de vigilancia/<programa>/: los documentos del programa.
   Los conceptos médicos solo van si se marca expresamente (y nunca historias clínicas: no están en el portal).
   El .zip queda en Drive («Paquetes para clientes»); si pesa poco también se devuelve para descargarlo de una vez. */
const MAX_PAQUETE = 40 * 1024 * 1024, MAX_PAQUETE_DIRECTO = 15 * 1024 * 1024;
function paqueteCliente_(body) {
  if (CTX_.modo && !sstConSesion_()) return CTX_.u ? errPermiso_('Solo el administrador y SST arman paquetes para clientes.') : errSesion_();
  const cliente = nombreArchivo_(corto_(body.cliente, 60) || 'Cliente'), hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  const medico = body.incluirMedico === true, blobs = [], omitidos = [], usados = {};
  let total = 0;
  const ruta = function (r) { let x = r, i = 2; while (usados[x]) { x = r.replace(/(\.[^.\/]+)?$/, ' (' + (i++) + ')$1'); } usados[x] = 1; return x; };
  const meter = function (b, r) {
    const n = b.getBytes().length;
    if (total + n > MAX_PAQUETE) { omitidos.push(r + ' (el paquete pasaría de 40 MB)'); return; }
    total += n; blobs.push(b.setName(ruta(r)));
  };
  const deAdjuntos = function (doc, carpeta, filtro) {
    (doc.adjuntos || []).forEach(function (a) {
      if (!a || a.retirado || !a.fileId) return;
      if (filtro && !filtro(a)) return;
      try { meter(DriveApp.getFileById(a.fileId).getBlob(), carpeta + '/' + nombreArchivo_(a.nombre)); }
      catch (e) { omitidos.push(carpeta + '/' + a.nombre + ' (no está en Drive)'); }
    });
  };
  const ids = function (l) { return (Array.isArray(l) ? l : []).map(texto_).filter(Boolean).slice(0, 400); };
  const leer = function (id, tipo) { const f = filaDe_(id); if (f === -1) return null; const r = leerFila_(f); if (r.borrado || r.tipo !== tipo) return null; return leerDoc_(id, true); };
  const MED = /medic|aptitud|examen|concepto|historia|epicrisis|incapac/i;
  ids(body.personas).forEach(function (id) {
    const d = leer(id, 'trabajador'); if (!d) return;
    const c = 'Personal/' + nombreArchivo_((d.nombre || id) + (d.cedula ? ' - CC ' + d.cedula : ''));
    deAdjuntos(d, c, function (a) { return medico || !(a.ref === 'medico' || MED.test(String(a.ref || '') + ' ' + String(a.nombre || ''))); });
    Object.keys(d.requisitos || {}).forEach(function (k) {
      const q = d.requisitos[k] || {}, foto = String(q.soporte || '');
      if (foto.indexOf('data:image') !== 0) return;
      if (!medico && (k === 'medico' || q.apto)) return;
      const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(foto); if (!m) return;
      try { meter(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'x'), c + '/Soporte ' + nombreArchivo_(k) + (m[1] === 'image/png' ? '.png' : '.jpg')); } catch (e) {}
    });
  });
  ids(body.equipos).forEach(function (id) {
    const d = leer(id, 'equipo'); if (!d) return;
    deAdjuntos(d, 'Equipos/' + nombreArchivo_([d.codigo, d.nombre].filter(Boolean).join(' - ') || id));
  });
  ids(body.programas).forEach(function (id) {
    const f = filaDe_(id); if (f === -1) return; const r = leerFila_(f); if (r.borrado || (r.tipo !== 'sve' && r.tipo !== 'programa')) return;
    const d = leerDoc_(id, true) || {};
    deAdjuntos(d, 'Programas de vigilancia/' + nombreArchivo_(d.programa === 'Otro' ? d.programaOtro : (d.nombre || d.programa || id)));
  });
  const html = String(body.indiceHtml || '');
  if (html) {
    try { const pdf = Utilities.newBlob(html.slice(0, 900000), 'text/html', 'indice.html').getAs('application/pdf'); total += pdf.getBytes().length; blobs.unshift(pdf.setName('00 Índice - ' + cliente + '.pdf')); }
    catch (e) { blobs.unshift(Utilities.newBlob(html, 'text/html', '00 Índice - ' + cliente + '.html')); }
  }
  if (!blobs.length) return { ok: false, error: 'No hay nada para empacar: elige personas, equipos o programas.' };
  const nombre = 'Paquete ' + cliente + ' ' + hoy + '.zip';
  const zip = Utilities.zip(blobs, nombre);
  const archivo = carpetaRaiz_('CARPETA_PAQUETES', 'Paquetes para clientes').createFile(zip);
  let compartido = false;
  if (body.compartir === true) { try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); compartido = true; } catch (e) {} }
  const bytes = zip.getBytes();
  registrarEvento_('PAQUETE', 'PAQUETE_CLIENTE', 'CREADO', cliente + ': ' + blobs.length + ' archivo(s), ' + Math.round(bytes.length / 1024) + ' KB' + (medico ? ' · con conceptos médicos' : '') + (compartido ? ' · compartido con enlace' : ''), body.opId || '', '', 'paquete');
  return { ok: true, nombre: nombre, archivos: blobs.length, tamano: bytes.length, omitidos: omitidos, url: archivo.getUrl(), id: archivo.getId(), compartido: compartido,
           base64: bytes.length <= MAX_PAQUETE_DIRECTO ? Utilities.base64Encode(bytes) : '' };
}
/* v159 · Carpeta de auditoría con un clic: un .zip con una carpeta por estándar de la Res. 0312 (numeral y nombre),
   y adentro los soportes adjuntos de los registros del portal que lo evidencian y una lista de esos registros.
   Nunca datos de salud. Solo Administrador y SST. */
function esc_(t) { return texto_(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function carpetaAuditoria_(body) {
  if (CTX_.modo && !sstConSesion_()) return CTX_.u ? errPermiso_('Solo el administrador y SST arman la carpeta de auditoría.') : errSesion_();
  const hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'), blobs = [], omitidos = [], usados = {};
  let total = 0;
  const ruta = function (r) { let x = r, i = 2; while (usados[x]) { x = r.replace(/(\.[^.\/]+)?$/, ' (' + (i++) + ')$1'); } usados[x] = 1; return x; };
  const meter = function (b, r) { const n = b.getBytes().length; if (total + n > MAX_PAQUETE) { omitidos.push(r + ' (la carpeta pasaría de 40 MB)'); return; } total += n; blobs.push(b.setName(ruta(r))); };
  const carpetas = (Array.isArray(body.carpetas) ? body.carpetas : []).slice(0, 80);
  carpetas.forEach(function (c) {
    const nom = nombreArchivo_(corto_(c && c.nombre, 90) || 'Estándar'), lineas = [];
    (Array.isArray(c && c.ids) ? c.ids : []).map(texto_).filter(Boolean).slice(0, 25).forEach(function (id) {
      const f = filaDe_(id); if (f === -1) return; const r = leerFila_(f);
      if (r.borrado || TIPOS_SALUD_.indexOf(r.tipo) !== -1) return;
      lineas.push('<tr><td>' + esc_(id) + '</td><td>' + esc_(texto_(r.fecha).slice(0, 10)) + '</td><td>' + esc_(corto_(r.titulo, 160)) + '</td><td>' + esc_(texto_(r.estado)) + '</td></tr>');
      const d = leerDoc_(id, true) || {};
      (d.adjuntos || []).forEach(function (a) {
        if (!a || a.retirado || !a.fileId || a.ref === 'medico') return;
        try { meter(DriveApp.getFileById(a.fileId).getBlob(), nom + '/' + nombreArchivo_(a.nombre)); } catch (e) { omitidos.push(nom + '/' + a.nombre + ' (no está en Drive)'); }
      });
    });
    const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial;font-size:10pt;"><h3>' + esc_(corto_(c && c.nombre, 200)) + '</h3><p>' + esc_(corto_(c && c.evidencia, 1500)) + '</p>' +
      (lineas.length ? '<table border="1" cellpadding="4" style="border-collapse:collapse;"><tr><th>Registro</th><th>Fecha</th><th>Detalle</th><th>Estado</th></tr>' + lineas.join('') + '</table>' : '<p>Sin registros en el portal para este estándar.</p>') + '</body></html>';
    try { meter(Utilities.newBlob(html, 'text/html', 'x').getAs('application/pdf'), nom + '/00 Registros del portal.pdf'); } catch (e) { meter(Utilities.newBlob(html, 'text/html', 'x'), nom + '/00 Registros del portal.html'); }
  });
  const ind = String(body.indiceHtml || '');
  if (ind) { try { const pdf = Utilities.newBlob(ind.slice(0, 900000), 'text/html', 'indice.html').getAs('application/pdf'); total += pdf.getBytes().length; blobs.unshift(pdf.setName('00 Índice de evidencias.pdf')); } catch (e) { blobs.unshift(Utilities.newBlob(ind, 'text/html', '00 Índice de evidencias.html')); } }
  if (!blobs.length) return { ok: false, error: 'No hay nada para la carpeta.' };
  const nombre = 'Carpeta de auditoria SG-SST ' + hoy + '.zip', zip = Utilities.zip(blobs, nombre);
  const archivo = carpetaRaiz_('CARPETA_PAQUETES', 'Paquetes para clientes').createFile(zip), bytes = zip.getBytes();
  registrarEvento_('AUDITORIA', 'CARPETA_AUDITORIA', 'CREADO', carpetas.length + ' estándar(es), ' + blobs.length + ' archivo(s), ' + Math.round(bytes.length / 1024) + ' KB', body.opId || '', '', 'paquete');
  return { ok: true, nombre: nombre, archivos: blobs.length, tamano: bytes.length, omitidos: omitidos, url: archivo.getUrl(), id: archivo.getId(), base64: bytes.length <= MAX_PAQUETE_DIRECTO ? Utilities.base64Encode(bytes) : '' };
}
/* v162 · Exportación completa (portabilidad): un .zip con TODOS los registros del SG-SST en JSON por tipo, un índice
   CSV, la bitácora, un README con el esquema y, si se pide, los soportes adjuntos. Responde a «¿y si me quiero ir?»
   y sirve de respaldo independiente de Google. Solo el administrador. */
function exportarTodo_(body) {
  const no = CTX_.modo ? soloAdmin_() : null; if (no) return no;
  const hoy = hoyISO_(), blobs = [], omitidos = []; let total = 0;
  const meter = function (b, r) { const n = b.getBytes().length; if (total + n > MAX_PAQUETE) { omitidos.push(r); return false; } total += n; blobs.push(b.setName(r)); return true; };
  const csv = function (filas) { return '\ufeff' + filas.map(function (f) { return f.map(function (x) { const t = x instanceof Date ? Utilities.formatDate(x, 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ss") : String(x === null || x === undefined ? '' : x); return /[",;\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(','); }).join('\r\n'); };
  // 1) Documentos completos: se lee la hoja «Datos» una sola vez y se arma cada registro.
  const ds = datosSheet_(), dl = ds.getLastRow(), trozos = {};
  if (dl >= 2) ds.getRange(2, 1, dl - 1, 3).getValues().forEach(function (f) { (trozos[f[0]] = trozos[f[0]] || []).push({ key: f[1], texto: String(f[2]).replace(/^'/, '') }); });
  const reg = regSheet_(), rl = reg.getLastRow(), porTipo = {}, indice = [['id', 'tipo', 'estado', 'fecha', 'titulo', 'responsable', 'vence', 'version', 'actualizado', 'borrado']];
  if (rl >= 2) reg.getRange(2, 1, rl - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (!v[0]) return; let res = {}, doc = null; try { res = JSON.parse(v[8] || '{}'); } catch (e) {}
    try { const m = reensamblar_(trozos[v[0]] || []); doc = m.doc ? JSON.parse(m.doc) : null; } catch (e) {}
    (porTipo[v[1]] = porTipo[v[1]] || []).push({ id: v[0], tipo: v[1], version: v[2], estado: v[3], fecha: v[4], titulo: v[5], responsable: v[6], vence: v[7], creado: v[9], actualizado: v[10], borrado: !!v[11], resumen: res, doc: doc });
    indice.push([v[0], v[1], v[3], v[4], v[5], v[6], v[7], v[2], v[10], v[11] ? 'sí' : '']);
  });
  Object.keys(porTipo).sort().forEach(function (t) { meter(Utilities.newBlob(JSON.stringify(porTipo[t], null, 1), 'application/json', 'x'), 'registros/' + t + '.json'); });
  meter(Utilities.newBlob(csv(indice), 'text/csv', 'x'), 'indice-registros.csv');
  // 2) Bitácora
  const ev = eventosSheet_(), el = ev.getLastRow();
  if (el >= 1) meter(Utilities.newBlob(csv(ev.getRange(1, 1, el, Math.min(11, ev.getLastColumn())).getValues()), 'text/csv', 'x'), 'bitacora-eventos.csv');
  // 3) README del esquema
  const tipos = Object.keys(porTipo).sort().map(function (t) { const T = (typeof TIPOS_GEN !== 'undefined' && TIPOS_GEN[t]) || {}; return '- ' + t + ' (' + porTipo[t].length + ')' + (T.hoja ? ': ' + T.hoja : ''); });
  meter(Utilities.newBlob(['EXPORTACIÓN COMPLETA DEL SG-SST — ' + nombreEmpresa_(perfilEmpresa_()), 'Fecha: ' + hoy, '',
    'registros/<tipo>.json  Un archivo por tipo de registro. Cada elemento: id, tipo, version, estado, fecha, titulo, responsable, vence,',
    '                       creado, actualizado, borrado, resumen (lo que muestran las listas) y doc (el registro completo, sin firmas ni fotos).',
    'indice-registros.csv   Una fila por registro (para abrir en Excel).',
    'bitacora-eventos.csv   Quién hizo qué y cuándo, con la huella encadenada (columnas hash y hashAnterior).',
    'adjuntos/<tipo>/<id>/  Los soportes subidos (si se pidieron al exportar).', '',
    'Las fechas van en formato AAAA-MM-DD. Las cédulas, sin puntos. Las firmas y fotos quedan en la hoja «Imagenes» del libro de Google.', '',
    'Tipos incluidos:'].concat(tipos).join('\r\n'), 'text/plain', 'x'), 'LEAME.txt');
  // 4) Adjuntos (opcional)
  if (body.adjuntos) Object.keys(porTipo).forEach(function (t) { porTipo[t].forEach(function (r) { ((r.doc && r.doc.adjuntos) || []).forEach(function (a) {
    if (!a || a.retirado || !a.fileId) return; try { meter(DriveApp.getFileById(a.fileId).getBlob(), 'adjuntos/' + t + '/' + nombreArchivo_(r.id) + '/' + nombreArchivo_(a.nombre)); } catch (e) { omitidos.push('adjuntos/' + r.id + '/' + a.nombre + ' (no está en Drive)'); } }); }); });
  const nombre = 'Exportacion SG-SST ' + hoy + '.zip', zip = Utilities.zip(blobs, nombre);
  const archivo = carpetaRaiz_('CARPETA_RESPALDOS', 'Respaldos SG-SST').createFile(zip), bytes = zip.getBytes();
  registrarEvento_('EXPORTACION', 'EXPORTAR', 'APLICADO', Object.keys(porTipo).length + ' tipo(s), ' + (indice.length - 1) + ' registro(s), ' + Math.round(bytes.length / 1024) + ' KB', body.opId || '', '', 'export');
  return { ok: true, nombre: nombre, registros: indice.length - 1, tipos: Object.keys(porTipo).length, archivos: blobs.length, tamano: bytes.length, omitidos: omitidos, url: archivo.getUrl(), base64: bytes.length <= MAX_PAQUETE_DIRECTO ? Utilities.base64Encode(bytes) : '' };
}
function quitarAdjunto_(body) {
  const id = texto_(body.id), fila = filaDe_(id);
  if (fila === -1) return { ok: false, codigoError: 'TEMPORAL', error: 'El registro todavía no ha llegado al servidor.' };
  const prev = leerFila_(fila);
  const sinPermiso = puedeEscribir_(prev.tipo, 'parche', true);
  if (sinPermiso) return sinPermiso;
  const doc = leerDoc_(id, false) || {};
  const lista = doc.adjuntos || [], it = lista.filter(function (a) { return a && a.uid === body.uid; })[0];
  if (!it) return { ok: false, error: 'Ese adjunto no está en el registro.' };
  if (it.retirado) return { ok: true, id: id, version: prev.version, duplicado: true };
  it.retirado = { en: new Date().toISOString(), por: etiquetaUsuario_(), motivo: corto_(body.motivo, 200) };
  try { const f = DriveApp.getFileById(it.fileId); f.setName('RETIRADO - ' + f.getName()); } catch (e) {}
  return guardar_({ action: 'parche', tipo: prev.tipo, id: id, campos: { adjuntos: lista }, opId: body.opId, _interno: true, _sinVersion: true });
}
function leerAdjunto_(p) {
  const id = texto_(p.id), fila = filaDe_(id);
  if (fila === -1) return { ok: false, error: 'No existe ' + id };
  const r = leerFila_(fila);
  if (r.borrado) return { ok: false, error: 'Ese registro fue borrado.' };
  if (!puedeLeer_(r.tipo)) return CTX_.u ? errPermiso_('Tu usuario no puede ver este registro.') : errSesion_();
  const doc = leerDoc_(id, false) || {};
  const it = (doc.adjuntos || []).filter(function (a) { return a && a.uid === p.uid; })[0];
  if (!it) return { ok: false, error: 'Ese adjunto no está en el registro.' };
  if (it.ref === 'medico' && !sstConSesion_()) return errPermiso_('El concepto médico solo lo ven el administrador y SST.');
  // v148: en Personal habilitado solo los soportes de cursos y seguridad social salen a otros roles; en un reporte, las incapacidades no.
  if (!sstConSesion_() && ((r.tipo === 'trabajador' && !/^(alturas|confinados|izajes|electrico|caliente|induccion|seguridad_social|pila|curso)/i.test(String(it.ref || ''))) || (r.tipo === 'reporte' && /incapac|medic|epicrisis|historia/i.test(String(it.ref || '') + ' ' + String(it.nombre || ''))))) return errPermiso_('Este soporte solo lo ven el administrador y SST (dato de salud).');
  let blob;
  try { blob = DriveApp.getFileById(it.fileId).getBlob(); } catch (e) { return { ok: false, error: 'No se encontró el archivo en Drive (¿lo borraron de la carpeta?).' }; }
  return { ok: true, nombre: it.nombre, mime: it.mime, base64: Utilities.base64Encode(blob.getBytes()) };
}

/* ================= HISTORIAL DE UN REGISTRO ================= */
function historial_(p) {
  const id = texto_(p.id), fila = filaDe_(id);
  if (fila === -1) return { ok: false, error: 'No existe ' + id };
  const r = leerFila_(fila);
  if (!puedeLeer_(r.tipo)) return CTX_.u ? errPermiso_('Tu usuario no puede ver este registro.') : errSesion_();
  const s = eventosSheet_(), filas = filasPorValor_(s, 2, id).sort(function (a, b) { return b - a; }).slice(0, 150), out = [];
  if (!filas.length) return { ok: true, id: id, eventos: [] };
  // Se leen por bloques de filas cercanas (no una lectura por fila).
  const valores = {};
  for (let i = 0; i < filas.length;) {
    let j = i; while (j + 1 < filas.length && filas[i] - filas[j + 1] < 400) j++;
    const lo = filas[j], b = s.getRange(lo, 1, filas[i] - lo + 1, 9).getValues();
    for (let k = i; k <= j; k++) valores[filas[k]] = b[filas[k] - lo];
    i = j + 1;
  }
  filas.forEach(function (n) {
    const v = valores[n];
    out.push({ ts: v[0] instanceof Date ? v[0].toISOString() : texto_(v[0]), accion: texto_(v[2]), resultado: texto_(v[3]), detalle: texto_(v[4]), version: texto_(v[6]), usuario: texto_(v[8]) });
  });
  return { ok: true, id: id, eventos: out };
}

/* Lo que ha hecho un usuario (para el administrador). */
function actividad_(p) {
  const no = soloAdmin_(); if (no) return no;
  const u = buscarUsuario_(p.usuario); if (!u) return { ok: false, error: 'No existe ese usuario.' };
  const s = eventosSheet_(), last = s.getLastRow(), out = [];
  if (last < 2 || s.getLastColumn() < 9) return { ok: true, eventos: [] };
  const filas = s.getRange(2, 9, last - 1, 1).createTextFinder('(' + u.usuario + ')').matchCase(true).findAll().map(function (r) { return r.getRow(); })
    .concat(filasPorValor_(s, 2, u.usuario)).sort(function (a, b) { return b - a; }).filter(function (x, i, l) { return l.indexOf(x) === i; }).slice(0, 150);
  filas.forEach(function (n) {
    const v = s.getRange(n, 1, 1, 9).getValues()[0];
    out.push({ ts: v[0] instanceof Date ? v[0].toISOString() : texto_(v[0]), ref: texto_(v[1]) + (v[7] ? ' (' + texto_(v[7]) + ')' : ''), accion: texto_(v[2]), resultado: texto_(v[3]), detalle: texto_(v[4]), version: texto_(v[6]), usuario: '' });
  });
  return { ok: true, eventos: out };
}

/* v162 · Búsqueda global (Ctrl/Cmd + K): busca en el título, el responsable y el resumen de todos los registros
   que el usuario puede leer, y dice en qué módulo abrir cada uno. */
function buscar_(p) {
  const q = texto_(p.q).trim(); if (q.length < 3) return { ok: true, rows: [] };
  const s = regSheet_(), last = s.getLastRow(); if (last < 2) return { ok: true, rows: [] };
  const filas = {};
  [COLS_REG.indexOf('id') + 1, COLS_REG.indexOf('titulo') + 1, COLS_REG.indexOf('responsable') + 1, COLS_REG.indexOf('resumen') + 1].forEach(function (c) {
    s.getRange(2, c, last - 1, 1).createTextFinder(q).matchCase(false).findAll().slice(0, 200).forEach(function (r) { filas[r.getRow()] = (filas[r.getRow()] || 0) + (c === 6 || c === 1 ? 3 : 1); });
  });
  const out = [];
  Object.keys(filas).map(Number).sort(function (a, b) { return filas[b] - filas[a] || b - a; }).some(function (n) {
    const v = s.getRange(n, 1, 1, COLS_REG.length).getValues()[0]; if (v[11] || !puedeLeer_(texto_(v[1]))) return false;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) {}
    if (actaReservada_(texto_(v[1]), r)) return false;
    out.push({ tipo: texto_(v[1]), id: texto_(v[0]), titulo: corto_(v[5], 120), estado: texto_(v[3]), fecha: v[4] instanceof Date ? Utilities.formatDate(v[4], 'America/Bogota', 'yyyy-MM-dd') : texto_(v[4]).slice(0, 10), modulo: MODULO_TIPO_[texto_(v[1])] || '' });
    return out.length >= 25;
  });
  return { ok: true, rows: out };
}
/* v162 · Calendario (ICS) de vencimientos: cursos y requisitos del personal, recargas y mantenimientos de equipos,
   reposiciones de EPP, compromisos del plan de acción y actividades del plan anual. Nunca datos de salud (ni
   exámenes): un calendario se comparte fácil. La llave es aparte de la clave del portal y se puede cambiar. */
function icsEnlace_(nuevo) {
  const pr = PropertiesService.getScriptProperties(); let k = pr.getProperty('ICS_LLAVE');
  if (!k || nuevo) { k = Utilities.getUuid().replace(/-/g, ''); pr.setProperty('ICS_LLAVE', k); registrarEvento_('ICS', 'CALENDARIO', 'APLICADO', nuevo ? 'Llave del calendario cambiada (el enlace anterior dejó de servir)' : 'Calendario activado', '', '', 'config'); }
  return { ok: true, llave: k };
}
function calendarioIcs_(p) {
  const k = PropertiesService.getScriptProperties().getProperty('ICS_LLAVE');
  const txt = function (t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.ICAL || ContentService.MimeType.TEXT); };
  if (!k || texto_(p.k) !== k) return txt('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Portal SSTA//ES\r\nX-WR-CALNAME:Enlace vencido\r\nEND:VCALENDAR\r\n');
  const ev = [], hoy = hoyISO_(), desde = sumarDias_(hoy, -30), hasta = sumarDias_(hoy, 400);
  const add = function (f, titulo, desc, uid) { f = texto_(f).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f < desde || f > hasta) return; ev.push({ f: f, t: titulo, d: desc || '', u: uid }); };
  const reg = regSheet_(), last = reg.getLastRow();
  if (last >= 2) reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (!v[0] || v[11]) return; const tipo = v[1]; if (TIPOS_SALUD_.indexOf(tipo) !== -1 || SOLO_SST.indexOf(tipo) !== -1) return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    if (tipo === 'trabajador' && r.activo !== false && !r.porRevisar) Object.keys(r.req || {}).forEach(function (q) { if (q === 'medico' || q === 'alimentos') return; add((r.req[q] || {}).vence, 'Vence ' + q.replace(/_/g, ' ') + ': ' + texto_(r.nombre), 'Personal habilitado', v[0] + '-' + q); });
    if (tipo === 'equipo' && r.activo !== false) { Object.keys(r.vencimientos || {}).forEach(function (q) { add(r.vencimientos[q], q + ': ' + texto_(r.codigo || r.nombre), 'Inventario de equipos', v[0] + '-' + q); }); if (r.mantTipo && r.mantTipo !== 'No aplica') add(r.mantProximo, 'Mantenimiento ' + texto_(r.mantTipo).toLowerCase() + ': ' + texto_(r.codigo || r.nombre), 'Inventario de equipos', v[0] + '-mant'); }
    if (tipo === 'accion' && v[3] !== 'CERRADA') add(r.fechaCompromiso, 'Acción: ' + corto_(r.accion || v[5], 80), 'Plan de acción · ' + texto_(r.responsable), v[0]);
    if (tipo === 'entrega') texto_(r.vencimientos).split(/\s*;\s*/).forEach(function (x, i) { const q = x.split('|'); if (q[1]) add(q[1], 'Reponer ' + q[0] + ': ' + texto_(r.nombre), 'EPP por vida útil', v[0] + '-' + i); });
    if (tipo === 'contratista') add(r.venceDocs, 'Vencen documentos: ' + texto_(r.nombre), 'Contratistas', v[0] + '-docs');
  });
  const esc = function (t) { return String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); };
  const sello = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'"), nom = nombreEmpresa_(perfilEmpresa_());
  const lin = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Portal SSTA//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc('SG-SST ' + nom), 'X-WR-TIMEZONE:America/Bogota', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];
  ev.forEach(function (x) { const d = x.f.replace(/-/g, ''), d2 = sumarDias_(x.f, 1).replace(/-/g, '');
    lin.push('BEGIN:VEVENT', 'UID:' + esc(x.u) + '@portal-ssta', 'DTSTAMP:' + sello, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + d2, 'SUMMARY:' + esc(x.t), 'DESCRIPTION:' + esc(x.d), 'BEGIN:VALARM', 'TRIGGER:-P7D', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(x.t), 'END:VALARM', 'END:VEVENT'); });
  lin.push('END:VCALENDAR');
  return txt(lin.map(function (l) { return l.length > 74 ? l.match(/.{1,74}/g).join('\r\n ') : l; }).join('\r\n') + '\r\n');
}
/* v162 · Índice de vínculos de una persona: en qué registros del SG-SST aparece (por su cédula en cualquier campo de
   cédula, o por su nombre como responsable), con el ROL que tuvo y el registro tal como quedó (su «foto» de ese día).
   Se busca con TextFinder sobre el resumen; cada tipo respeta quién lo puede leer (salud, solo SST). */
const ROL_CAMPO_ = { cedula: 'titular', lesionadoCc: 'lesionado', cedulaInstructor: 'instructor', responsableCc: 'responsable', inspectorCc: 'inspector', cedulas: 'participante', participantes: 'participante', asistentes: 'asistente', integrantes: 'integrante', miembros: 'integrante' };
/* ============================================================
   v164 · MAESTRO ÚNICO DE PERSONAS
   ------------------------------------------------------------
   Cada persona (tipo «trabajador», Personal habilitado) tiene un personaId que no cambia nunca: ni si
   le corrigen la cédula (la vieja queda en «cedulasAnteriores» y se sigue encontrando por ella), ni si
   se unifica con una ficha repetida (la que queda recoge las cédulas y el personaId de la otra en
   «personasFusionadas»). Es la llave para integrar con nómina o PILA: personas_() la entrega.
   Los demás módulos (permisos, ATS, charlas, anexo) siguen guardando la cédula del día; la ficha 360
   los cruza con TODAS las cédulas de la persona.
   ============================================================ */
const RE_PERSONA_ID_ = /^P-[0-9A-Z]{12}$/;
function nuevoPersonaId_() { return 'P-' + (Utilities.getUuid().replace(/[^0-9A-Za-z]/g, '') + Utilities.getUuid().replace(/[^0-9A-Za-z]/g, '')).slice(0, 12).toUpperCase(); }
function clavePersonaCed_(x) { return texto_(x).replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }
function unicos_(l) { const v = {}; return l.filter(function (x) { if (!x || v[x]) return false; v[x] = 1; return true; }); }
/** Pone y protege la identidad de la persona en el documento que se va a guardar. Devuelve un error o ''. */
function identidadPersona_(doc, prev, interno, id) {
  const ced = clavePersonaCed_(doc.cedula);
  if (prev) {
    if (!interno || !RE_PERSONA_ID_.test(texto_(doc.personaId))) doc.personaId = prev.personaId;
    if (!interno) { doc.cedulasAnteriores = (prev.cedulasAnteriores || []).slice(); doc.personasFusionadas = (prev.personasFusionadas || []).slice(); }
    const pc = clavePersonaCed_(prev.cedula);
    if (pc && ced && pc !== ced) doc.cedulasAnteriores = (doc.cedulasAnteriores || []).concat([pc]);   // corrigieron la cédula: la vieja sigue siendo de ella
  } else if (!interno) { delete doc.personaId; delete doc.cedulasAnteriores; delete doc.personasFusionadas; }
  if (!RE_PERSONA_ID_.test(texto_(doc.personaId))) doc.personaId = nuevoPersonaId_();
  if (doc.cedulasAnteriores) doc.cedulasAnteriores = unicos_(doc.cedulasAnteriores.map(clavePersonaCed_)).filter(function (c) { return c !== ced; }).slice(-20);
  if (doc.personasFusionadas) doc.personasFusionadas = unicos_(doc.personasFusionadas.map(texto_)).filter(function (x) { return RE_PERSONA_ID_.test(x) && x !== doc.personaId; }).slice(-20);
  if (doc.fusionadoCon !== undefined && doc.fusionadoCon !== '' && doc.fusionadoCon !== null) {
    const dest = texto_(doc.fusionadoCon);
    if (dest === id || !/^[A-Za-z0-9_.:-]{3,80}$/.test(dest)) return 'No se puede unificar una ficha consigo misma.';
    const f = filaDe_(dest), fila = f === -1 ? null : leerFila_(f);
    if (!fila || fila.tipo !== 'trabajador' || fila.borrado) return 'La ficha con la que se unifica no existe en Personal habilitado.';
    doc.activo = false;
  }
  return '';
}
/** La ficha que queda recoge las cédulas y el personaId de la que se unificó con ella (así se sigue encontrando). */
function efectoFusion_(id, d) {
  const dest = texto_(d.fusionadoCon), destino = leerDoc_(dest, false); if (!destino) return;
  const ceds = (destino.cedulasAnteriores || []).concat([clavePersonaCed_(d.cedula)], d.cedulasAnteriores || []);
  const pers = (destino.personasFusionadas || []).concat([texto_(d.personaId)], d.personasFusionadas || []);
  guardar_({ action: 'parche', tipo: 'trabajador', id: dest, campos: { cedulasAnteriores: ceds, personasFusionadas: pers }, agregar: { historial: { fecha: hoyISO_(), texto: 'Se unificó con ' + id + ' (' + texto_(d.nombre) + ')' } }, opId: '', _interno: true, _sistema: true });
}
/** Filas de personas del registro: [{ fila, id, r (resumen) }]. */
function filasPersonas_() {
  const s = regSheet_(), last = s.getLastRow(), out = []; if (last < 2) return out;
  s.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v, i) {
    if (v[1] !== 'trabajador' || v[11]) return; let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    out.push({ fila: i + 2, id: texto_(v[0]), r: r });
  });
  return out;
}
/** Encuentra a la persona por personaId (también uno ya unificado), por su cédula de hoy o por una anterior.
 *  Si la ficha se unificó con otra, devuelve la que quedó. */
function personaDe_(p, filas) {
  const pid = texto_(p.personaId).toUpperCase(), ced = clavePersonaCed_(p.cedula); if (!pid && ced.length < 5) return null;
  const l = filas || filasPersonas_(), porId = {}; l.forEach(function (x) { porId[x.id] = x; });
  let x = l.filter(function (y) { return pid ? (texto_(y.r.personaId) === pid || (y.r.personasFusionadas || []).indexOf(pid) !== -1) : (clavePersonaCed_(y.r.cedula) === ced || (y.r.cedulasAnteriores || []).indexOf(ced) !== -1); })
    .sort(function (a, b) { return (a.r.fusionadoCon ? 1 : 0) - (b.r.fusionadoCon ? 1 : 0) || (b.r.activo === false ? -1 : 0) - (a.r.activo === false ? -1 : 0); })[0];
  for (let n = 0; x && x.r.fusionadoCon && porId[x.r.fusionadoCon] && n < 5; n++) x = porId[x.r.fusionadoCon];
  if (!x) return null;
  const ceds = unicos_([clavePersonaCed_(x.r.cedula)].concat(x.r.cedulasAnteriores || []));
  l.forEach(function (y) { if (y.r.fusionadoCon === x.id) ceds.push(clavePersonaCed_(y.r.cedula)); });   // unificadas antes de v164
  return { personaId: texto_(x.r.personaId), id: x.id, nombre: texto_(x.r.nombre), cedula: texto_(x.r.cedula), cedulas: unicos_(ceds), activo: x.r.activo !== false };
}
/** Les da personaId a las personas que no lo tienen todavía (las de antes de v164) y pasa las cédulas de las
 *  unificadas a la ficha que quedó. Se puede correr las veces que sea: solo toca a quien le falta. */
function asegurarPersonaIds_(max) {
  let n = 0; const l = filasPersonas_();
  l.forEach(function (x) {
    if (n >= (max || 400)) return;
    if (!RE_PERSONA_ID_.test(texto_(x.r.personaId))) { const r = guardar_({ action: 'parche', tipo: 'trabajador', id: x.id, campos: {}, opId: '', _interno: true, _sistema: true, _sinVersion: true }); if (r.ok) n++; }
  });
  filasPersonas_().forEach(function (x) {
    if (n >= (max || 400) || !x.r.fusionadoCon) return;
    const dest = l.filter(function (y) { return y.id === x.r.fusionadoCon; })[0]; if (!dest) return;
    const ya = filasPersonas_().filter(function (y) { return y.id === dest.id; })[0];
    if (ya && (ya.r.cedulasAnteriores || []).indexOf(clavePersonaCed_(x.r.cedula)) !== -1) return;
    efectoFusion_(x.id, leerDoc_(x.id, false) || {}); n++;
  });
  return n;
}
/** La ficha (id) donde va lo de esta cédula: la de la persona en el maestro (aunque sea una cédula anterior o
 *  una ficha unificada); si no está, la de siempre «TRB-<cédula>». */
function fichaDePersona_(ced) { const k = clavePersonaCed_(ced); try { const per = k.length >= 5 ? personaDe_({ cedula: k }) : null; if (per) return per.id; } catch (e) {} return 'TRB-' + k; }
/** Para correr a mano una vez después de actualizar (también se hace sola al abrir el maestro). */
function asignarPersonaIds() { const n = asegurarPersonaIds_(5000); return n ? '✓ ' + n + ' persona(s) recibieron su personaId o sus cédulas unificadas.' : '✓ Todas las personas ya tienen su personaId.'; }
/** El maestro de personas: una fila por persona (sin las unificadas), sin datos de salud. Para SST y para
 *  integrar con nómina o PILA. */
function personas_(p) {
  if (CTX_.modo && !CTX_.u) return errSesion_();
  if (CTX_.modo && !sstConSesion_()) return errPermiso_('El maestro de personas lo ven el administrador y SST.');
  const l = filasPersonas_();
  if (l.some(function (x) { return !RE_PERSONA_ID_.test(texto_(x.r.personaId)); })) {
    const lock = LockService.getScriptLock(); if (lock.tryLock(5000)) { LOCK_TOMADO_++; try { asegurarPersonaIds_(400); } finally { LOCK_TOMADO_--; lock.releaseLock(); } }
  }
  const rows = filasPersonas_().filter(function (x) { return !x.r.fusionadoCon && (p.todos === '1' || x.r.activo !== false); }).map(function (x) {
    return { personaId: texto_(x.r.personaId), id: x.id, cedula: texto_(x.r.cedula), cedulasAnteriores: x.r.cedulasAnteriores || [], nombre: texto_(x.r.nombre), cargo: texto_(x.r.cargo), area: texto_(x.r.area),
             empresa: texto_(x.r.empresa), fechaIngreso: texto_(x.r.fechaIngreso), activo: x.r.activo !== false };
  });
  return { ok: true, rows: rows };
}
/** Alta en el maestro desde el anexo de personal u otro módulo: si la persona ya está (por cualquiera de sus
 *  cédulas) devuelve su personaId; si no, la crea con lo mínimo y «por revisar» para SST. */
function asegurarPersona_(body) {
  if (CTX_.modo && !CTX_.u) return errSesion_();
  if (CTX_.modo && ['admin', 'sst', 'supervisor'].indexOf(CTX_.u.rol) === -1) return errPermiso_('Tu usuario no puede agregar personas.');
  const ced = clavePersonaCed_(body.cedula), nombre = corto_(body.nombre, 120);
  if (ced.length < 5 || ced.length > 15 || nombre.trim().length < 5) return { ok: false, error: 'Escribe el nombre completo y la cédula.' };
  const ya = personaDe_({ cedula: ced }); if (ya) return { ok: true, existia: true, personaId: ya.personaId, id: ya.id, nombre: ya.nombre };
  let id = 'TRB-' + ced; if (filaDe_(id) !== -1) id = 'TRB-' + ced + '-' + Utilities.getUuid().slice(0, 4);
  const r = guardar_({ action: 'guardar', tipo: 'trabajador', id: id, versionBase: 0, opId: texto_(body.opId), _interno: true, _sistema: true,
    doc: { nombre: nombre, cedula: ced, cargo: corto_(body.cargo, 80), empresa: corto_(body.empresa, 120), activo: true, porRevisar: true, origen: corto_(body.origen || 'Anexo de personal autorizado', 80), req: {} } });
  if (!r.ok) return r;
  return { ok: true, creado: true, personaId: texto_((leerDoc_(id, false) || {}).personaId), id: id, nombre: nombre };
}
function vinculos_(p) {
  const k = texto_(p.cedula).replace(/\D/g, ''), nom = normalizar_(texto_(p.nombre)).replace(/\s+/g, ' ').trim();
  // v164: con el maestro de personas se busca por TODAS sus cédulas (la de hoy, las corregidas y las de fichas unificadas).
  const per = (k.length >= 5 || texto_(p.personaId)) ? personaDe_(p) : null;
  const cedulas = per ? per.cedulas.map(function (c) { return c.replace(/\D/g, ''); }).filter(function (c) { return c.length >= 5; }) : (k.length >= 5 ? [k] : []), esSuya = {};
  cedulas.forEach(function (c) { esSuya[c] = 1; });
  if (!cedulas.length && nom.length < 6) return { ok: false, error: 'Falta la cédula.' };
  const s = regSheet_(), last = s.getLastRow(); if (last < 2) return { ok: true, rows: [], persona: per };
  const col = COLS_REG.indexOf('resumen') + 1, filas = {};
  // La cédula puede estar escrita con puntos (1.023.456.789): se buscan las dos formas.
  cedulas.forEach(function (kc) { [kc, kc.replace(/\B(?=(\d{3})+(?!\d))/g, '.')].forEach(function (q) { s.getRange(2, col, last - 1, 1).createTextFinder(q).findAll().forEach(function (r) { filas[r.getRow()] = 1; }); }); });
  if (nom.length >= 6) { const cr = COLS_REG.indexOf('responsable') + 1; s.getRange(2, cr, last - 1, 1).createTextFinder(texto_(p.nombre).trim()).matchCase(false).findAll().forEach(function (r) { filas[r.getRow()] = 1; }); }
  const out = [], nums = Object.keys(filas).map(Number).sort(function (a, b) { return b - a; }).slice(0, 400);
  // v168: antes era una lectura por cada registro de la persona (100 registros = 100 llamadas a la hoja).
  // Ahora las filas cercanas se leen juntas.
  const leidas = filasPorTramos_(s, nums.slice().reverse(), COLS_REG.length);
  nums.forEach(function (n) {
    const v = leidas[n]; if (v[11]) return;
    const tipo = texto_(v[1]); if (!puedeLeer_(tipo)) return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    let rol = '';
    (function rec(x, campo, prof) {
      if (rol || prof > 6 || x === null || x === undefined) return;
      if (Array.isArray(x)) { x.forEach(function (y) { rec(y, campo, prof + 1); }); return; }
      if (typeof x === 'object') { Object.keys(x).forEach(function (c) { rec(x[c], c, prof + 1); }); return; }
      if (/c[eé]dula|cc$|^cc|documento|^doc$/i.test(campo || '') && esSuya[String(x).replace(/\D/g, '')]) rol = ROL_CAMPO_[campo] || 'aparece';
      else if (/^(cedulas|participantes|asistentes|integrantes|miembros|cedulasAnteriores)$/.test(campo || '') && String(x).replace(/[^\d,;]/g, '').split(/[,;]/).some(function (c) { return esSuya[c]; })) rol = ROL_CAMPO_[campo] || 'aparece';
    })(r, '', 0);
    if (!rol && nom && normalizar_(texto_(v[6])).replace(/\s+/g, ' ').trim() === nom) rol = 'responsable';
    if (!rol) return;
    out.push({ tipo: tipo, id: texto_(v[0]), titulo: corto_(v[5], 160), estado: texto_(v[3]), fecha: v[4] instanceof Date ? Utilities.formatDate(v[4], 'America/Bogota', 'yyyy-MM-dd') : texto_(r.fecha || v[4]).slice(0, 10), rol: rol, vence: v[7] instanceof Date ? Utilities.formatDate(v[7], 'America/Bogota', 'yyyy-MM-dd') : texto_(v[7]).slice(0, 10) });
  });
  return { ok: true, rows: out, persona: per };
}
/* v162 · Visor de la bitácora dentro del portal: lo último primero, con filtros por usuario, acción, resultado,
   fechas y texto, y la verificación de la cadena de huellas. Solo administrador y SST. */
function puedeVerBitacora_() { if (!CTX_.modo) return null; if (!CTX_.u) return errSesion_(); return sstConSesion_() ? null : errPermiso_('La bitácora la ven el administrador y SST.'); }
function bitacora_(p) {
  const no = puedeVerBitacora_(); if (no) return no;
  const s = eventosSheet_(), last = s.getLastRow(); if (last < 2) return { ok: true, eventos: [], total: 0 };
  const n = Math.min(last - 1, 6000), ini = last - n + 1, v = s.getRange(ini, 1, n, Math.max(9, Math.min(11, s.getLastColumn()))).getValues();
  const q = normalizar_(texto_(p.q)), usu = normalizar_(texto_(p.usuario)), acc = texto_(p.accion), res = texto_(p.resultado), desde = texto_(p.desde).slice(0, 10), hasta = texto_(p.hasta).slice(0, 10);
  const out = [];
  for (let i = v.length - 1; i >= 0 && out.length < 300; i--) {
    const r = v[i], f = r[0] instanceof Date ? Utilities.formatDate(r[0], 'America/Bogota', 'yyyy-MM-dd HH:mm:ss') : texto_(r[0]);
    if (desde && f.slice(0, 10) < desde) continue; if (hasta && f.slice(0, 10) > hasta) continue;
    if (acc && texto_(r[2]) !== acc) continue; if (res && texto_(r[3]) !== res) continue;
    if (usu && normalizar_(texto_(r[8])).indexOf(usu) === -1) continue;
    if (q && normalizar_([r[1], r[2], r[4], r[7], r[8]].join(' ')).indexOf(q) === -1) continue;
    out.push({ fila: ini + i, ts: f, ref: texto_(r[1]), accion: texto_(r[2]), resultado: texto_(r[3]), detalle: corto_(r[4], 400), version: texto_(r[6]), tipo: texto_(r[7]), usuario: texto_(r[8]), sellada: !!r[9] });
  }
  return { ok: true, eventos: out, total: last - 1, revisadas: n };
}

/* ================= RESPALDO SEMANAL ================= */
function idDeHoja_(x) { const m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(String(x)); return m ? m[1] : String(x || '').trim(); }
function librosParaRespaldar_() {
  const ids = [libro_().getId()];
  const sumar = function (x) { const id = idDeHoja_(x); if (id && /^[A-Za-z0-9_-]{10,}$/.test(id) && ids.indexOf(id) === -1) ids.push(id); };
  RESPALDAR_TAMBIEN.forEach(sumar);
  if (typeof librosDelPortal_ === 'function') librosDelPortal_().forEach(sumar);   // servidor único: todos los módulos
  return ids;
}
/** ▶ Lo corre el activador cada domingo (o "Respaldar ahora" en el portal). */
/* ===== v137 · ALARMAS DE SEGURIDAD Y RESPALDO FUERA DE LA CUENTA ===== */
/** A quién se avisa de algo raro: CORREOS_AVISO y los administradores con correo. */
function destinosSeguridad_() {
  const l = correos_().slice();
  try { admins_().forEach(function (u) { const c = correoValido_(u.correo); if (c && l.indexOf(c) === -1) l.push(c); }); } catch (e) {}
  return l;
}
function alarma_(clave, asunto, cuerpo, cadaMin) {
  const c = cacheScript_(); if (c && c.get('alarma:' + clave)) return false;   // no repetir la misma alarma seguido
  if (c) c.put('alarma:' + clave, '1', (cadaMin || 60) * 60);
  const dest = destinosSeguridad_(); if (!dest.length) return false;
  try { MailApp.sendEmail(dest.join(','), '🔒 ' + asunto + ' — ' + nombreEmpresa_(perfilEmpresa_()), cuerpo + '\n\nFecha: ' + new Date().toISOString() + '\n\nCorreo automático de seguridad del Portal SSTA.'); } catch (e) { console.log('Alarma: ' + e.message); return false; }
  registrarEvento_('', 'ALARMA', 'APLICADO', asunto, '', '', 'seguridad');
  return true;
}
/** Borrado masivo: más de 15 borrados de la misma persona en 10 minutos avisa; más de 40 la frena una hora. */
function controlBorrado_() {
  const c = cacheScript_(); if (!c) return null;
  const quien = (CTX_.u && CTX_.u.usuario) || 'sin-usuario', kb = 'bloq-borrar:' + quien;
  if (c.get(kb)) return { ok: false, codigoError: 'FRENADO', error: 'Se frenaron los borrados de tu usuario por seguridad (demasiados en pocos minutos). El administrador ya fue avisado; intenta en una hora.' };
  const k = 'borra:' + quien + ':' + Math.floor(Date.now() / 600000), n = Number(c.get(k) || 0) + 1; c.put(k, String(n), 900);
  if (n === 15) alarma_('borra15:' + quien, 'Muchos registros borrados', 'El usuario «' + quien + '» borró 15 registros en menos de 10 minutos. Si no fue algo planeado, cámbiale la clave en Usuarios y revisa la bitácora.', 30);
  if (n >= 40) { c.put(kb, '1', 3600); alarma_('borra40:' + quien, 'Borrado masivo FRENADO', 'El usuario «' + quien + '» intentó borrar 40 registros en menos de 10 minutos: se le frenaron los borrados por una hora. Los registros borrados no se pierden (quedan marcados y en la bitácora).', 60); }
  return null;
}
/** Respaldo fuera de la cuenta de Google: un Excel de cada hoja, por correo, a una dirección de otra cuenta
 *  (propiedad RESPALDO_EXTERNO, o el correo del asesor). Si roban la cuenta, la copia está en otra parte. */
function respaldoExterno_(hoy) {
  const pf = perfilEmpresa_(), prop = PropertiesService.getScriptProperties().getProperty('RESPALDO_EXTERNO') || '';
  // v148: solo a la dirección que la empresa puso a propósito (antes, por defecto, al correo del asesor externo:
  // el libro lleva datos de salud y eso es transmitir datos sensibles a un tercero sin acuerdo — Ley 1581, art. 25).
  const dest = String(prop || '').split(/[,;\s]+/).map(correoValido_).filter(String);
  if (!dest.length) return 'sin destino (pon RESPALDO_EXTERNO en las propiedades del script)';
  const token = ScriptApp.getOAuthToken(), adj = [], omitidos = []; let total = 0;
  librosParaRespaldar_().forEach(function (id) {
    let nombre = id; try { nombre = DriveApp.getFileById(id).getName(); } catch (e) {}
    try {
      const r = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) { omitidos.push(nombre + ' (Google respondió ' + r.getResponseCode() + ')'); return; }
      const b = r.getBlob(), n = b.getBytes().length;
      if (total + n > 20 * 1024 * 1024) { omitidos.push(nombre + ' (' + Math.round(n / 1048576) + ' MB: no cabe en el correo)'); return; }   // el correo admite 25 MB
      total += n; b.setName(nombre + ' — ' + hoy + '.xlsx'); adj.push(b);
    } catch (e) { omitidos.push(nombre + ': ' + e.message); }
  });
  // v142: lo que no se pudo mandar se reporta como error (antes se omitía en silencio).
  if (omitidos.length) RESPALDO_OMITIDOS_ = omitidos;
  if (!adj.length) throw new Error('no se pudo exportar ningún libro' + (omitidos.length ? ': ' + omitidos.join('; ') : ''));
  MailApp.sendEmail(dest.join(','), 'Respaldo SG-SST ' + nombreEmpresa_(pf) + ' — ' + hoy, 'Copia de seguridad semanal del SG-SST (' + adj.length + ' archivo(s) de Excel).\n\nCONFIDENCIAL: incluye datos de salud de los trabajadores (Ley 1581 de 2012). Guárdala en una cuenta de la empresa con acceso restringido y no la reenvíes.\n\nGuárdala: si algún día se pierde o se daña la cuenta de Google de la empresa, con estos archivos se recupera la información.\n\nCorreo automático del Portal SSTA.', { attachments: adj });
  return adj.length + ' archivo(s) a ' + dest.join(', ') + (omitidos.length ? ' · SIN ENVIAR: ' + omitidos.join('; ') : '');
}
var RESPALDO_OMITIDOS_ = null;
function respaldoSemanal() {
  const hoy = hoyISO_(), carpeta = carpetaRaiz_('CARPETA_RESPALDOS', 'Respaldos SG-SST'), hechos = [], errores = [];
  librosParaRespaldar_().forEach(function (id) {
    try { const f = DriveApp.getFileById(id); f.makeCopy(f.getName() + ' — respaldo ' + hoy, carpeta); hechos.push(f.getName()); }
    catch (e) { errores.push(id + ': ' + e.message); }
  });
  let depurados = 0; try { depurados = depurarRespaldos_(carpeta, hoy); } catch (e) { errores.push('Depurar: ' + e.message); }
  let externo = ''; RESPALDO_OMITIDOS_ = null; try { externo = respaldoExterno_(hoy); } catch (e) { externo = 'error: ' + e.message; errores.push('Respaldo externo: ' + e.message); }
  if (RESPALDO_OMITIDOS_) errores.push('Respaldo externo sin enviar: ' + RESPALDO_OMITIDOS_.join('; '));
  try { const rot = rotarEventos_(); if (rot) hechos.push('Eventos: ' + rot + ' fila(s) antiguas pasadas al archivo'); } catch (e) { errores.push('Rotar bitácora: ' + e.message); }
  const estado = { fecha: hoy, en: new Date().toISOString(), libros: hechos.length, nombres: hechos, errores: errores, depurados: depurados, externo: externo };
  PropertiesService.getScriptProperties().setProperty('RESPALDO_ULTIMO', JSON.stringify(estado));
  registrarEvento_('', 'RESPALDO', errores.length ? 'CON ERRORES' : 'APLICADO', hechos.length + ' hoja(s) copiadas' + (errores.length ? ' · errores: ' + errores.join(' | ') : ''), '', '', 'respaldo');
  if (errores.length) { const dest = correos_(); if (dest.length) try { MailApp.sendEmail(dest.join(','), '⚠ Respaldo del SG-SST con errores — ' + hoy, 'No se pudieron copiar:\n· ' + errores.join('\n· ')); } catch (e) {} }
  console.log('Respaldo: ' + hechos.length + ' hoja(s) en ' + carpeta.getUrl() + (errores.length ? '\nErrores: ' + errores.join('\n') : ''));
  return estado;
}
/* Se conservan los respaldos de las últimas 8 semanas y, para siempre, el
   primero de cada mes de cada hoja. Los demás van a la papelera de Drive. */
function depurarRespaldos_(carpeta, hoy) {
  const limite = sumarDias_(hoy, -56), it = carpeta.getFiles(), grupos = {};
  while (it.hasNext()) {
    const f = it.next(), m = /^(.*) — respaldo (\d{4}-\d{2}-\d{2})$/.exec(f.getName());
    if (!m) continue;
    const k = m[1] + '|' + m[2].slice(0, 7);
    (grupos[k] = grupos[k] || []).push({ f: f, fecha: m[2] });
  }
  let n = 0;
  Object.keys(grupos).forEach(function (k) {
    const l = grupos[k].sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    l.slice(1).forEach(function (x) { if (x.fecha < limite) { x.f.setTrashed(true); n++; } });
  });
  // v142: de los mensuales se guardan los últimos 24 meses (antes, para siempre: llenaba el Drive).
  const lim24 = sumarDias_(hoy, -730);
  Object.keys(grupos).forEach(function (k) { const x = grupos[k][0]; if (x && x.fecha < lim24 && !x.f.isTrashed()) { x.f.setTrashed(true); n++; } });
  return n;
}
/* v142 · La bitácora «Eventos» no crece sin fin: lo de más de 12 meses pasa al libro «SG-SST Archivo»
   (hoja «Eventos»), en tandas de 20.000 filas. Corre con el respaldo semanal. */
function rotarEventos_() {
  const sh = eventosSheet_(), n = sh.getLastRow() - 1; if (n < 50000) return 0;
  const lim = new Date(Date.now() - 365 * 864e5), cuantas = Math.min(n, 20000), vals = sh.getRange(2, 1, cuantas, 11).getValues();   // v162: con usuario y la cadena de huellas
  let k = 0; while (k < vals.length && vals[k][0] instanceof Date && vals[k][0] < lim) k++;
  if (!k) return 0;
  const lib = libroArchivo_(), h = lib.getSheetByName('Eventos') || lib.insertSheet('Eventos');
  if (h.getLastRow() === 0) h.appendRow(['ts', 'id', 'accion', 'resultado', 'detalle', 'opId', 'version', 'tipo', 'usuario', 'hash', 'hashAnterior']);
  const antes = h.getLastRow();
  h.getRange(antes + 1, 1, k, 11).setValues(vals.slice(0, k)); SpreadsheetApp.flush();
  if (h.getLastRow() - antes !== k) throw new Error('la copia de la bitácora no se verificó');   // v145: se cuenta lo que se agregó
  sh.deleteRows(2, k);
  return k;
}
function libroArchivo_() {
  const props = PropertiesService.getScriptProperties(); let id = props.getProperty('ARCHIVO_LIBRO');
  if (id) try { return SpreadsheetApp.openById(id); } catch (e) {}
  const lib = SpreadsheetApp.create('SG-SST Archivo — bitácora'); id = lib.getId(); props.setProperty('ARCHIVO_LIBRO', id);
  try { DriveApp.getFileById(id).moveTo(carpetaRaiz_('CARPETA_RESPALDOS', 'Respaldos SG-SST')); } catch (e) {}
  return lib;
}

/* v142 · RESTAURAR UN RESPALDO (antes no existía y nunca se había probado).
   ▶ probarRestauracion(): abre el respaldo más reciente del libro principal y compara hojas,
     encabezados y cantidad de filas con el libro actual. No cambia nada. Hazlo cada mes.
   ▶ restaurarDesdeRespaldo('<id del archivo de respaldo>'): reemplaza las hojas del libro actual
     por las del respaldo. Antes copia cada hoja actual como «<hoja> (antes de restaurar <fecha>)»,
     así que se puede deshacer. Úsalo solo si los datos actuales se dañaron. */
function respaldoMasReciente_() {
  const carpeta = carpetaRaiz_('CARPETA_RESPALDOS', 'Respaldos SG-SST'), nombre = libro_().getName(), it = carpeta.getFiles();
  let mejor = null;
  while (it.hasNext()) { const f = it.next(), m = /^(.*) — respaldo (\d{4}-\d{2}-\d{2})$/.exec(f.getName()); if (m && m[1] === nombre && !f.isTrashed() && (!mejor || m[2] > mejor.fecha)) mejor = { f: f, fecha: m[2] }; }
  return mejor;
}
function compararLibros_(origen, destino) {
  const out = [];
  ['Registros', 'Datos', 'Imagenes'].forEach(function (n) {
    const a = origen.getSheetByName(n), b = destino.getSheetByName(n);
    if (!a) { out.push({ hoja: n, ok: false, nota: 'no está en el respaldo' }); return; }
    const encA = a.getLastColumn() ? a.getRange(1, 1, 1, a.getLastColumn()).getValues()[0].join('|') : '', encB = b && b.getLastColumn() ? b.getRange(1, 1, 1, b.getLastColumn()).getValues()[0].join('|') : '';
    out.push({ hoja: n, ok: encA === encB || !b, filasRespaldo: a.getLastRow() - 1, filasActual: b ? b.getLastRow() - 1 : 0, nota: encA === encB ? '' : 'encabezados distintos' });
  });
  return out;
}
function probarRestauracion() {
  const r = respaldoMasReciente_();
  if (!r) { console.log('No hay respaldos en la carpeta «Respaldos SG-SST». Ejecuta respaldoSemanal() primero.'); return { ok: false }; }
  const lib = SpreadsheetApp.openById(r.f.getId()), comp = compararLibros_(lib, libro_());
  // Se lee un registro al azar del respaldo para comprobar que se puede reconstruir.
  let muestra = 'sin registros';
  try { const reg = lib.getSheetByName('Registros'), n = reg.getLastRow() - 1; if (n > 0) { const fila = 2 + Math.floor(Math.random() * n), id = reg.getRange(fila, 1).getValue();
    const dat = lib.getSheetByName('Datos'), filas = dat.getRange(2, 1, Math.max(1, dat.getLastRow() - 1), 3).getValues().filter(function (x) { return x[0] === id; });
    const texto = reensamblar_(filas.map(function (x) { return { key: x[1], texto: x[2] }; })).doc; JSON.parse(texto); muestra = 'registro ' + id + ' reconstruido bien'; } }
  catch (e) { muestra = 'ERROR al reconstruir un registro: ' + e.message; }
  const ok = comp.every(function (c) { return c.ok; }) && !/ERROR/.test(muestra);
  const estado = { fecha: hoyISO_(), respaldo: r.f.getName(), comparacion: comp, muestra: muestra, ok: ok };
  PropertiesService.getScriptProperties().setProperty('RESTAURACION_PROBADA', JSON.stringify(estado));
  registrarEvento_('', 'PRUEBA RESTAURACION', ok ? 'APLICADO' : 'CON ERRORES', r.f.getName() + ' · ' + muestra, '', '', 'respaldo');
  console.log((ok ? '✓ El respaldo se puede restaurar. ' : '⚠ Revisar: ') + r.f.getName() + '\n' + comp.map(function (c) { return c.hoja + ': ' + c.filasRespaldo + ' filas en el respaldo, ' + c.filasActual + ' hoy' + (c.nota ? ' (' + c.nota + ')' : ''); }).join('\n') + '\n' + muestra);
  return estado;
}
function restaurarDesdeRespaldo(idRespaldo) {
  if (!idRespaldo) { const r = respaldoMasReciente_(); if (!r) throw new Error('No hay respaldos.'); idRespaldo = r.f.getId(); }
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) throw new Error('El portal está ocupado guardando; intenta en un minuto.');
  LOCK_TOMADO_++;
  try {
    const origen = SpreadsheetApp.openById(idRespaldo), destino = libro_(), sello = Utilities.formatDate(new Date(), zonaHoraria_(), 'yyyy-MM-dd HHmm');
    const comp = compararLibros_(origen, destino); if (!comp.every(function (c) { return c.ok; })) throw new Error('El respaldo no coincide con este libro: ' + JSON.stringify(comp));
    // v145: primero se copian TODAS las hojas del respaldo (con nombre temporal); solo si todas llegaron se
    // renombran las actuales y se ponen las nuevas. Si algo falla a mitad, el libro sigue como estaba.
    const hojas = origen.getSheets().filter(function (h) { return h.getName().indexOf('(antes de restaurar') === -1; });
    const copias = hojas.map(function (h) { return { nombre: h.getName(), copia: h.copyTo(destino) }; });
    copias.forEach(function (x) { const actual = destino.getSheetByName(x.nombre); if (actual) actual.setName(x.nombre + ' (antes de restaurar ' + sello + ')'); });
    copias.forEach(function (x) { x.copia.setName(x.nombre); });
    HOJAS_CACHE_ = {};   // v151: las hojas cambiaron: no usar las que se habían buscado antes
    registrarEvento_('', 'RESTAURAR RESPALDO', 'APLICADO', origen.getName(), '', '', 'respaldo');
    console.log('✓ Restaurado desde «' + origen.getName() + '». Las hojas anteriores quedaron con «(antes de restaurar ' + sello + ')»: bórralas cuando confirmes que todo está bien.');
    return { ok: true, desde: origen.getName() };
  } finally { LOCK_TOMADO_--; lock.releaseLock(); }
}
/** v142: cuota de correos de Google (100 al día con Gmail gratis). Lo importante primero. */
function puedeEnviarCorreo_(prioridad) {
  try { const q = MailApp.getRemainingDailyQuota(); return prioridad === 'alta' ? q > 0 : q > 10; } catch (e) { return true; }
}
function protegerBitacora_() {
  try {
    const p = eventosSheet_().protect().setDescription('Bitácora del SG-SST: no se edita a mano');
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
  } catch (e) { console.log('No se pudo proteger la bitácora: ' + e.message); }
}
/** ▶ Ejecutar una vez (pide permiso de Google Drive): respaldo cada domingo
 *  a las 2 a. m. y protege la bitácora. Hace el primer respaldo de una vez. */
function instalarRespaldo(sinCopiaAhora) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'respaldoSemanal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('respaldoSemanal').timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
  PropertiesService.getScriptProperties().setProperty('RESPALDO_INSTALADO', '1');
  protegerBitacora_();
  if (sinCopiaAhora === true) return 'Respaldo programado (domingos, 2 a. m.).';
  return respaldoSemanal();
}
/* "Respaldar ahora" desde el portal: el administrador; sin usuarios, máximo uno cada 6 horas. */
function respaldarAhora_() {
  if (CTX_.modo) { const no = soloAdmin_(); if (no) return no; }
  else {
    let u = null; try { u = JSON.parse(PropertiesService.getScriptProperties().getProperty('RESPALDO_ULTIMO') || 'null'); } catch (e) {}
    if (u && u.en && Date.now() - new Date(u.en).getTime() < 6 * 3600000) return { ok: false, error: 'Ya se hizo un respaldo hace menos de 6 horas.' };
  }
  return Object.assign({ ok: true }, respaldoSemanal());
}
function estadoRespaldo_() {
  const p = PropertiesService.getScriptProperties();
  let u = null; try { u = JSON.parse(p.getProperty('RESPALDO_ULTIMO') || 'null'); } catch (e) {}
  let url = ''; try { const id = p.getProperty('CARPETA_RESPALDOS'); if (id) url = DriveApp.getFolderById(id).getUrl(); } catch (e) {}
  return { ok: true, instalado: p.getProperty('RESPALDO_INSTALADO') === '1', ultimo: u, carpeta: url, libros: librosParaRespaldar_().length };
}


/* ================= NOVEDADES NORMATIVAS (v107) =================
   El navegador no puede leer otros sitios (CORS): el servidor consulta fuentes públicas
   y devuelve las normas recientes de SST, ambiente, transporte (PESV) y calidad.
   Son AVISOS para revisar en la matriz legal, no un análisis jurídico. Se guardan en
   caché 6 horas; si una fuente no responde, se sigue con las demás. */
const FUENTES_NORMAS_ = [
  { id: 'safetya', nombre: 'SafetYA · normatividad SST', url: 'https://safetya.co/normatividad/feed/' },
  { id: 'mintrabajo', nombre: 'SafetYA · Ministerio del Trabajo', url: 'https://safetya.co/emisor/ministerio-del-trabajo/feed/' },
  { id: 'anla', nombre: 'ANLA · normativa ambiental', url: 'https://www.anla.gov.co/wanla/eureka/normativa?format=feed&type=rss' },
  { id: 'gnews-sst', nombre: 'Noticias · normas de riesgos laborales', url: 'https://news.google.com/rss/search?q=%28resoluci%C3%B3n+OR+decreto+OR+circular%29+%28%22seguridad+y+salud+en+el+trabajo%22+OR+%22riesgos+laborales%22%29+Colombia&hl=es-419&gl=CO&ceid=CO:es-419' },
  { id: 'gnews-amb', nombre: 'Noticias · normas ambientales y viales', url: 'https://news.google.com/rss/search?q=%28resoluci%C3%B3n+OR+decreto%29+%28%22residuos+peligrosos%22+OR+%22seguridad+vial%22+OR+PESV+OR+vertimientos%29+Colombia&hl=es-419&gl=CO&ceid=CO:es-419' }
];
const CLAVES_NORMAS_ = ['seguridad y salud en el trabajo', 'sg-sst', 'riesgos laborales', 'arl', 'accidente de trabajo', 'enfermedad laboral', 'estandares minimos', '0312', '1072', 'copasst', 'vigia',
  'convivencia laboral', 'acoso laboral', 'psicosocial', 'alturas', 'espacios confinados', 'energias peligrosas', 'izaje', 'sustancias quimicas', 'sga', 'proteccion personal', 'examenes medicos',
  'evaluaciones medicas', 'ruido', 'iluminacion', 'retilap', 'retie', 'emergencias', 'brigada', 'teletrabajo', 'jornada laboral', 'ambiental', 'residuos', 'respel', 'raee', 'vertimientos', 'emisiones',
  'plasticos', 'envases', 'aceites usados', 'seguridad vial', 'pesv', 'plan estrategico de seguridad vial', 'transito', 'conductores', 'mercancias peligrosas', 'iso 9001', 'iso 14001', 'iso 45001', 'calidad', 'metrologia'];
const EXCLUIR_NORMAS_ = ['nombramiento', 'encargo', 'comision de servicios', 'vacaciones', 'dias habiles'];
function normalizar_(t) { return texto_(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function itemsRss_(xml) {
  const out = [], items = String(xml).match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const tag = function (it, t) { const m = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)<\\/' + t + '>', 'i').exec(it); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : ''; };
  items.slice(0, 40).forEach(function (it) { out.push({ titulo: tag(it, 'title'), enlace: tag(it, 'link'), fecha: tag(it, 'pubDate') }); });
  return out;
}
function iso10_(t) { const x = texto_(t).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : ''; }   // v175
function fechaIso_(t) { const d = new Date(t); return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd'); }
/** "Resolución 1843 de 2025" → clave para saber si ya está en la matriz legal. */
function claveNorma_(t) {
  const n = normalizar_(t), m = /(ley|decreto|resolucion|circular)\s+(?:no\.?\s*)?(\d{1,6})\s+(?:de|del)\s+(\d{4})/.exec(n);
  return m ? m[1] + ' ' + Number(m[2]) + ' ' + m[3] : '';
}
function novedadesNormas_(forzar) {
  const cache = CacheService.getScriptCache();
  let base = null;
  if (!forzar) { try { base = JSON.parse(cache.get('NOVEDADES_NORMAS') || 'null'); } catch (e) {} }
  if (!base) {
    const fuentes = [], vistos = {}, lista = [];
    let resp = [];
    try { resp = UrlFetchApp.fetchAll(FUENTES_NORMAS_.map(function (f) { return { url: f.url, muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalSSTA)' } }; })); } catch (e) { resp = []; }
    FUENTES_NORMAS_.forEach(function (f, i) {
      const r = resp[i]; let n = 0, estado = 'sin respuesta';
      try {
        if (r && r.getResponseCode() === 200) {
          itemsRss_(r.getContentText()).forEach(function (it) {
            const t = normalizar_(it.titulo); if (!it.titulo || !it.enlace) return;
            if (!CLAVES_NORMAS_.some(function (k) { return t.indexOf(k) !== -1; }) && f.id.indexOf('gnews') === -1 && f.id !== 'anla') return;
            if (EXCLUIR_NORMAS_.some(function (k) { return t.indexOf(k) !== -1; })) return;
            const k = claveNorma_(it.titulo) || it.enlace; if (vistos[k]) return; vistos[k] = 1;
            lista.push({ titulo: it.titulo.slice(0, 240), enlace: it.enlace.slice(0, 500), fecha: fechaIso_(it.fecha), fuente: f.nombre, clave: claveNorma_(it.titulo) }); n++;
          });
          estado = 'ok';
        } else if (r) estado = 'HTTP ' + r.getResponseCode();
      } catch (e) { estado = 'error'; }
      fuentes.push({ nombre: f.nombre, estado: estado, items: n });
    });
    lista.sort(function (a, b) { return String(b.fecha).localeCompare(String(a.fecha)); });
    base = { consultado: new Date().toISOString(), fuentes: fuentes, novedades: lista.slice(0, 60) };
    try { cache.put('NOVEDADES_NORMAS', JSON.stringify(base), 6 * 3600); } catch (e) {}
  }
  // ¿Ya está en la matriz legal?
  const enMatriz = {};
  const reg = regSheet_(), last = reg.getLastRow();
  if (last >= 2) reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (x) { if (x[1] !== 'legal' || x[11]) return; let r = {}; try { r = JSON.parse(x[8] || '{}'); } catch (e) {} const k = claveNorma_(r.norma); if (k) enMatriz[k] = x[0]; });
  return { ok: true, consultado: base.consultado, fuentes: base.fuentes, novedades: base.novedades.map(function (n) { return Object.assign({}, n, { enMatriz: n.clave && enMatriz[n.clave] ? enMatriz[n.clave] : '' }); }) };
}

/* ================= LECTURA ================= */
/* ═══ v168 · LISTAS QUE TRAEN SOLO LO QUE CAMBIÓ ═══
   Antes, cada lista leía la hoja «Registros» completa (12 columnas) y devolvía TODOS los registros del tipo:
   con 25.000 registros eran megas por cada pantalla. Ahora el celular guarda su copia y manda «cambios» (la
   hora del servidor de su última lectura). El servidor lee solo 4 columnas angostas (id, tipo, cuándo cambió
   y borrado), y devuelve completas únicamente las filas que cambiaron desde entonces, más los id borrados.
   Cuándo NO se responde con cambios, sino con la lista completa (lo de siempre):
     · el celular no manda «cambios» (primera vez, portal viejo, tipos reservados sin copia);
     · cambió «gen»: se archivaron registros (salieron filas de la hoja);
     · cambió «vista»: otro usuario u otro rol ven otra cosa;
     · enlaces de auditor.
   El margen cubre un guardado que estaba a medio escribir cuando se leyó la vez pasada. «total» deja que el
   celular compruebe que su copia quedó completa; si no cuadra, pide la lista entera. */
const LISTA_MARGEN_MS_ = 10 * 60 * 1000;
function listaGen_() { try { return PropertiesService.getScriptProperties().getProperty('LISTA_GEN') || '1'; } catch (e) { return '1'; } }
function subirListaGen_() { try { PropertiesService.getScriptProperties().setProperty('LISTA_GEN', String(Date.now())); } catch (e) {} }
function listaVista_() {
  if (!CTX_.modo) return 'abierto';
  if (!CTX_.u) return 'sin-sesion';
  return 'u:' + texto_(CTX_.u.usuario) + ':' + texto_(CTX_.u.rol) + (sstConSesion_() ? ':sst' : '');
}
function msDe_(v) { if (v instanceof Date) return v.getTime(); const x = Date.parse(texto_(v)); return isNaN(x) ? 0 : x; }
/** Lee filas sueltas (números de fila en orden ascendente) en pocas llamadas. Las que quedan a menos de TRAMO_HUECO_
 *  filas se leen juntas, y nunca se hacen más de TRAMOS_MAX_ llamadas: si salen más tramos, se parte solo por los
 *  huecos más grandes. Una llamada a la hoja cuesta mucho más que leer filas de sobra. Devuelve { fila: valores }. */
const TRAMO_HUECO_ = 500, TRAMOS_MAX_ = 12;
function filasPorTramos_(sheet, filas, ncols) {
  const out = {}; if (!filas.length) return out;
  // Dónde se corta: en los huecos de más de TRAMO_HUECO_ filas; si son demasiados, solo en los más grandes.
  let cortes = [];
  for (let i = 1; i < filas.length; i++) if (filas[i] - filas[i - 1] > TRAMO_HUECO_) cortes.push(i);
  if (cortes.length > TRAMOS_MAX_ - 1) {
    cortes = cortes.sort(function (a, b) { return (filas[b] - filas[b - 1]) - (filas[a] - filas[a - 1]); }).slice(0, TRAMOS_MAX_ - 1);
  }
  cortes.sort(function (a, b) { return a - b; });
  let k = 0;
  cortes.concat(filas.length).forEach(function (hasta) {
    const ini = filas[k], bloque = sheet.getRange(ini, 1, filas[hasta - 1] - ini + 1, ncols).getValues();
    for (let j = k; j < hasta; j++) out[filas[j]] = bloque[filas[j] - ini];
    k = hasta;
  });
  return out;
}
/** Una fila de «Registros» como sale en las listas, o null si este usuario no la puede ver o está borrada. */
function filaLista_(v, libre) {
  if (!v[0] || v[11]) return null;
  if (!puedeLeer_(v[1]) && !(libre && v[1] === 'trabajador')) return null;
  let res = {}; try { res = JSON.parse(v[8] || '{}'); } catch (err) {}
  if (actaReservada_(v[1], res)) return null;
  if (v[1] === 'trabajador' && !sstConSesion_()) sinRestricciones_(res.req);
  if (v[1] === 'trabajador' && !CTX_.u) res = trabajadorPublico_(res);
  return { id: v[0], tipo: v[1], version: v[2], estado: v[3], fecha: fechaISO_(v[4]), titulo: v[5], responsable: v[6], vence: fechaISO_(v[7]),
    resumen: res, actualizado: v[10] instanceof Date ? v[10].toISOString() : texto_(v[10]), creado: v[9] instanceof Date ? v[9].toISOString() : texto_(v[9]) };
}
/** Lo que cambió desde `desdeMs`: filas completas de lo creado o modificado, e id de lo borrado o que ya no se puede ver. */
function listaCambios_(tipos, libre, desdeMs) {
  const reg = regSheet_(), n = reg.getLastRow() - 1, out = { rows: [], borrados: [] };
  let total = 0;
  if (n >= 1) {
    const ids = reg.getRange(2, 1, n, 2).getValues(), marcas = reg.getRange(2, 11, n, 2).getValues(), cambiadas = [];
    for (let i = 0; i < n; i++) {
      const tipo = ids[i][1];
      if (!ids[i][0] || (tipos.length && tipos.indexOf(tipo) === -1)) continue;
      const borrado = texto_(marcas[i][1]);
      if (!borrado && (puedeLeer_(tipo) || (libre && tipo === 'trabajador'))) total++;
      const cuando = Math.max(msDe_(marcas[i][0]), borrado ? msDe_((/^BORRADO (\S+)/.exec(borrado) || [])[1]) : 0);
      if (cuando && cuando < desdeMs) continue;   // sin fecha legible se manda siempre: mejor de más que de menos
      if (borrado) out.borrados.push(texto_(ids[i][0])); else cambiadas.push(i);
    }
    // Las filas que cambiaron se leen completas por tramos (lo nuevo queda junto, al final de la hoja).
    const filas = cambiadas.map(function (i) { return i + 2; }), leidas = filasPorTramos_(reg, filas, COLS_REG.length);
    filas.forEach(function (n) {
      const v = leidas[n], f = filaLista_(v, libre);
      if (f) out.rows.push(f); else out.borrados.push(texto_(v[0]));
    });
  }
  if (tipos.indexOf('reunion') === -1) out.total = total;   // las actas reservadas se filtran por contenido: ahí no hay conteo
  return out;
}

function doGet(e) {
  HOJAS_CACHE_ = {};
  CTX_ = { modo: false, u: null, colUsuario: false };
  const p = e.parameter || {};
  // v116: los celulares de cada cliente leen aquí su configuración por su código, sin la clave de
  // ESTE servidor (no la tienen). Es lo mismo que antes estaba público en empresas/<código>.json.
  if (p.action === 'empresaPublica') return jsonOut_(empresaPublica_(p.codigo));
  // v162: calendario de vencimientos para Google Calendar / Outlook (lo pide el calendario, sin sesión: la llave va en el enlace).
  if (p.action === 'ics') return calendarioIcs_(p);
  if (p.action === 'verificarCertificado') return jsonOut_(verificarCertificado_(p));
  if (p.action === 'pantalla') return jsonOut_(pantallaPlanta_(p));   // v169: el televisor de la planta, con su enlace (solo cifras)
  if (p.action === 'contratistaPortal') return jsonOut_(contratistaPortal_(p));   // v162: el contratista ve lo suyo con su enlace   // v162: el QR del certificado, sin usuario
  // v162 · Modo auditor: un enlace con vencimiento, solo lectura y solo de los módulos que se le dieron.
  // v174: el enlace ES la llave del auditor; no se le pide la clave del portal (antes la pedía y la rechazaba).
  if (p.auditor) { iniciarContexto_(''); const ra = contextoAuditor_(p); if (ra) return jsonOut_(ra); }
  else {
    if (!checkToken_(p.token)) return jsonOut_({ ok: false, error: 'La clave del portal no es correcta. Pídele la clave vigente al líder SST y vuelve a entrar.', codigoError: 'CLAVE' });
    iniciarContexto_(p.sesion);
  }
  if (p.action === 'ping') return jsonOut_({ ok: true, servicio: 'SG-SST', version: VERSION_SGSST, usuarios: CTX_.modo, yo: yo_() });
  if (p.action === 'sal') return jsonOut_(Object.assign({ ok: true }, salDe_(p.usuario)));
  if (p.action === 'historial') return jsonOut_(historial_(p));
  if (p.action === 'actividad') return jsonOut_(actividad_(p));
  if (p.action === 'bitacora') return jsonOut_(bitacora_(p));
  if (p.action === 'buscar') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); return jsonOut_(buscar_(p)); }   // v162: búsqueda global
  if (p.action === 'misAvisos') { if (!CTX_.modo || !CTX_.u) return jsonOut_(errSesion_()); return jsonOut_({ ok: true, pref: prefAvisos_(CTX_.u), roles: CTX_.u.rol === 'admin' ? prefsAvisos_('AVISOS_ROL') : undefined, correo: !!CTX_.u.correo }); }
  if (p.action === 'enlacesAuditor') { const no = soloAdmin_(); if (no) return jsonOut_(no); return jsonOut_({ ok: true, enlaces: enlacesAuditor_().map(function (x) { return { id: x.id, nombre: x.nombre, grupos: x.grupos, vence: x.vence, creado: x.creado, revocado: x.revocado || '' }; }).reverse() }); }
  if (p.action === 'enlaceContratista') return jsonOut_(enlaceContratista_(p));
  if (p.action === 'enlacePantalla') return jsonOut_(enlacePantalla_(p));
  if (p.action === 'certificadoClave') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); if (!puedeLeer_('induccion')) return jsonOut_(errPermiso_('Tu usuario no puede ver inducciones.')); return jsonOut_({ ok: true, k: claveCert_(texto_(p.id)) }); }
  if (p.action === 'icsEnlace') { if (CTX_.modo && !sstConSesion_()) return jsonOut_(CTX_.u ? errPermiso_('El calendario lo activa SST.') : errSesion_()); return jsonOut_(icsEnlace_(p.nuevo === '1')); }
  if (p.action === 'personas') return jsonOut_(personas_(p));   // v164: el maestro de personas (SST)
  if (p.action === 'persona') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); const per = personaDe_(p); return jsonOut_(per ? { ok: true, persona: per } : { ok: false, error: 'No está en el maestro de personas.' }); }
  if (p.action === 'vinculos') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); return jsonOut_(vinculos_(p)); }   // v162: ficha 360   // v162: visor de la bitácora (administrador y SST)
  if (p.action === 'verificarBitacora') { const no = puedeVerBitacora_(); if (no) return jsonOut_(no); return jsonOut_(Object.assign({ ok: true }, { resultado: verificarBitacora_() })); }
  if (p.action === 'adjunto') return jsonOut_(leerAdjunto_(p));
  if (p.action === 'encuestaPublica') return jsonOut_(encuestaPublica_(p));
  if (p.action === 'buzonPublico') return jsonOut_(buzonPublico_());   // v128: llave pública y correo del comité (sin usuario)   // v107: el cliente responde sin usuario (solo ESA encuesta, con su clave)
  if (p.action === 'novedadesNormas') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); return jsonOut_(novedadesNormas_(p.forzar === '1')); }

  if (p.action === 'actaPublica') return jsonOut_(actaPublica_(p));
  if (p.action === 'contactoEmergencia') return jsonOut_(contactoEmergencia_(p));   // v151: en una emergencia, sin usuario, con la cédula exacta   // v149: quien recibe el enlace ve SOLO esa acta, sin usuario
  if (p.action === 'enlaceActa') { if (CTX_.modo && !CTX_.u) return jsonOut_(errSesion_()); if (!puedeLeer_('reunion')) return jsonOut_(errPermiso_('Tu usuario no puede ver actas.')); return jsonOut_({ ok: true, id: texto_(p.id), clave: claveActa_(p.id) }); }
  if (p.action === 'papelera') return jsonOut_(papelera_());
  if (p.action === 'sellos') return jsonOut_(verificarSellos_(texto_(p.id)));
  if (p.action === 'list' || p.list) {
    const tipos = texto_(p.tipo).split(',').filter(Boolean);
    // Sin usuario solo se lee el personal habilitado (lo consultan los permisos en campo).
    const libre = tipos.length === 1 && tipos[0] === 'trabajador';
    if (CTX_.modo && !CTX_.u && !libre) return jsonOut_(errSesion_());
    // v168: «hasta» se toma ANTES de leer; el celular lo devuelve la próxima vez para pedir solo lo que cambió.
    const sello = { gen: listaGen_(), vista: listaVista_(), hasta: new Date().toISOString() };
    const desde = !p.auditor && p.cambios && p.gen === sello.gen && p.vista === sello.vista ? msDe_(p.cambios) : 0;
    let r;
    if (desde) {
      r = listaCambios_(tipos, libre, desde - LISTA_MARGEN_MS_);
      r.ok = true; r.delta = true;
    } else {
      const reg = regSheet_(), last = reg.getLastRow(), rows = [];
      if (last >= 2) {
        reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
          if (tipos.length && tipos.indexOf(v[1]) === -1) return;
          const f = filaLista_(v, libre); if (f) rows.push(f);
        });
      }
      r = { ok: true, rows: rows };
      if (tipos.indexOf('reunion') === -1) r.total = rows.length;
    }
    r.gen = sello.gen; r.vista = sello.vista; r.hasta = sello.hasta;
    if (CTX_.modo) { r.usuarios = true; r.yo = yo_(); }
    return jsonOut_(r);
  }

  if (p.action === 'doc' || p.id) {
    const id = texto_(p.id), fila = filaDe_(id);
    if (fila === -1) return jsonOut_({ ok: false, error: 'No existe ' + id });
    const r = leerFila_(fila);
    if (r.borrado) return jsonOut_({ ok: false, error: 'Ese registro fue borrado.', borrado: true });
    if (!puedeLeer_(r.tipo)) return jsonOut_(CTX_.u ? errPermiso_('Tu usuario no puede ver este registro.') : errSesion_());
    const doc = leerDoc_(id, true);
    if (!doc) return jsonOut_({ ok: false, error: 'No se pudo leer ' + id });
    if (actaReservada_(r.tipo, doc)) return jsonOut_(errPermiso_('Las actas del Comité de Convivencia son reservadas.'));
    if (r.tipo === 'trabajador' && !sstConSesion_()) sinRestricciones_(doc.requisitos);
    // v148: lesión e incapacidad de un accidente son datos de salud: solo SST y el comité (que investiga) los ven.
    if (r.tipo === 'reporte' && !sstConSesion_() && !(CTX_.u && CTX_.u.rol === 'comite') && doc.lesionado) { doc.lesionado = { nombre: doc.lesionado.nombre || '' }; delete doc.incapacidad; }
    // v141: RH y contacto de emergencia (datos sensibles): solo con usuario, y solo SST, admin y supervisores (MEDEVAC).
    if (r.tipo === 'trabajador' && doc.emergencia && !(CTX_.modo && CTX_.u && ['admin', 'sst', 'supervisor'].indexOf(CTX_.u.rol) !== -1)) delete doc.emergencia;
    return jsonOut_({ ok: true, id: id, version: r.version, doc: doc });
  }

  // ¿Ya se aplicó este envío? (la cola sin señal lo pregunta antes de reenviar)
  if (p.action === 'opAplicado') return jsonOut_({ ok: true, aplicado: opIdYaAplicado_(texto_(p.opId)) });
  if (p.action === 'usuarios') { const no = soloAdmin_(); return jsonOut_(no || { ok: true, usuarios: leerUsuarios_().map(publicoUsuario_), roles: ROLES, yo: yo_() }); }
  if (p.action === 'pendientes') { asegurarAvisos_(); return jsonOut_(pendientesLista_(p.dias)); }
  if (p.action === 'responsables') return jsonOut_(responsables_());   // v107: a quién le deja tareas el asesor
  if (p.action === 'respaldo') { if (CTX_.modo && !esSst_()) return jsonOut_(CTX_.u ? errPermiso_('Solo Administrador o SST.') : errSesion_()); return jsonOut_(estadoRespaldo_()); }

  return jsonOut_({ ok: false, error: 'Acción no reconocida.' });
}

/* ================= CONSOLA DEL ADMINISTRADOR: CLIENTES (v116) =================
   Cada cliente es un registro «cliente» en ESTE servidor (el del sitio). Desde la
   consola se guarda en él su configuración (lo que antes era empresas/<código>.json):
     · empresaPublica: los celulares del cliente la leen por su código, sin usuario.
       Lleva lo mismo que el archivo (nombre, logo, módulos, servidor y apiToken, que
       igual son públicos en su sitio); nunca la clave ni la llave del proveedor.
     · publicarCliente: le avisa a SU servidor qué módulos están apagados, firmado
       con la llave que ese servidor generó al instalarse (verConfiguracion). Así lo
       no contratado también se bloquea en el servidor, no solo en la pantalla.
     · vigilarClientes: todos los días prueba cada servidor, anota su estado y avisa
       por correo lo que falle o esté desactualizado. */
const CODIGO_EMP_ = /^[a-z0-9][a-z0-9-]{1,39}$/;
function cacheScript_() { try { return typeof CacheService !== 'undefined' ? CacheService.getScriptCache() : null; } catch (e) { return null; } }
/** Los registros «cliente» vigentes: [{ id, estado, resumen }]. */
function clientesVigentes_() {
  const reg = regSheet_(), last = reg.getLastRow(), out = [];
  if (last < 2) return out;
  reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (!v[0] || v[11] || v[1] !== 'cliente') return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) {}
    out.push({ id: texto_(v[0]), estado: texto_(v[3]), resumen: r });
  });
  return out;
}
function empresaPublica_(codigo) {
  codigo = texto_(codigo).trim().toLowerCase();
  if (!CODIGO_EMP_.test(codigo)) return { ok: false, error: 'Código de empresa inválido.' };
  const cache = cacheScript_(), k = 'empPub:' + codigo;
  if (cache) { try { const c = cache.get(k); if (c) return JSON.parse(c); } catch (e) {} }
  const cli = clientesVigentes_().filter(function (x) { return String(x.resumen.codigo || '').toLowerCase() === codigo && x.estado !== 'INACTIVO'; })[0];
  if (!cli) return { ok: false, codigoError: 'NOEXISTE', error: 'No hay ninguna empresa con el código «' + codigo + '».' };
  const d = leerDoc_(cli.id, true) || {};
  if (!d.config || typeof d.config !== 'object' || Array.isArray(d.config)) return { ok: false, codigoError: 'NOEXISTE', error: 'La empresa «' + codigo + '» todavía no tiene su configuración publicada.' };
  const emp = JSON.parse(JSON.stringify(d.config));
  ['clave', 'llaveProveedor', 'scriptId', 'multiempresa', 'producto', 'demo', 'empresaPorDefecto', 'consola', 'editandoCliente'].forEach(function (x) { delete emp[x]; });
  const out = { ok: true, codigo: codigo, empresa: emp, generado: texto_(d.publicado) };
  if (cache) { try { const t = JSON.stringify(out); if (t.length < 95000) cache.put(k, t, 300); } catch (e) {} }
  return out;
}
/** URL base del servidor de un cliente y si es un servidor único (raíz con /<módulo>). */
function servidorCliente_(d) {
  const b = texto_(d.servidor).trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(b)) return null;
  return { base: b, unico: d.modo !== 'sgsst' };
}
function apagadosDe_(config) {
  const m = (config && config.modulos) || {};
  return Object.keys(m).filter(function (k) { return m[k] === false; }).sort();
}
/** Le manda a SU servidor la lista de módulos apagados, firmada con su llave. */
function enviarModulos_(d) {
  const s = servidorCliente_(d);
  if (!s || !s.unico) return { ok: false, error: 'Su servidor no es un servidor único: los módulos solo se ocultan en la pantalla.' };
  const llave = texto_(d.llaveProveedor).trim();
  if (!llave) return { ok: false, error: 'Falta la llave del proveedor (sale en su verConfiguracion).' };
  const carga = JSON.stringify({ apagados: apagadosDe_(d.config), ts: Date.now() });
  const firma = Utilities.base64Encode(Utilities.computeHmacSha256Signature(carga, llave));
  try {
    const res = UrlFetchApp.fetch(s.base, { method: 'post', contentType: 'text/plain;charset=utf-8', payload: JSON.stringify({ __proveedor: { carga: carga, firma: firma } }), muteHttpExceptions: true, followRedirects: true });
    let j = null; try { j = JSON.parse(res.getContentText()); } catch (e) {}
    if (!j) return { ok: false, error: 'Su servidor respondió una página, no datos (¿implementación pública y actualizada?).' };
    return j.ok ? { ok: true, apagados: j.apagados || [] } : { ok: false, error: j.error || 'Su servidor no aceptó los módulos.' };
  } catch (e) { return { ok: false, error: 'Su servidor no respondió: ' + e.message }; }
}
function publicarCliente_(id) {
  const fila = filaDe_(id);
  if (fila === -1) return { ok: false, error: 'No existe ' + id };
  const r = leerFila_(fila);
  if (r.tipo !== 'cliente' || r.borrado) return { ok: false, error: 'Ese registro no es un cliente vigente.' };
  const d = leerDoc_(id, true) || {};
  if (!d.config) return { ok: false, error: 'Ese cliente todavía no tiene configuración guardada.' };
  const cache = cacheScript_(); if (cache && d.codigo) { try { cache.remove('empPub:' + String(d.codigo).toLowerCase()); } catch (e) {} }
  const m = enviarModulos_(d);
  return { ok: true, publicado: true, modulos: m };
}
/** ▶ Ejecutar (o cada mañana con instalarVigilancia): prueba el servidor de cada cliente. */
function vigilarClientes() { CTX_ = { modo: false, u: null, colUsuario: false }; return vigilarClientes_(true); }
function vigilarClientes_(conCorreo) {
  const lista = clientesVigentes_().filter(function (x) { return x.estado !== 'INACTIVO'; });
  const docs = lista.map(function (x) { return leerDoc_(x.id, false) || {}; });
  const pedidos = [], idx = [];
  docs.forEach(function (d, i) {
    const s = servidorCliente_(d);
    if (!s) return;
    idx.push(i);
    pedidos.push({ url: s.unico ? s.base : s.base + '?action=ping&token=' + encodeURIComponent(texto_(d.clave)), muteHttpExceptions: true, followRedirects: true });
  });
  let respuestas = [];
  try { respuestas = pedidos.length ? UrlFetchApp.fetchAll(pedidos) : []; } catch (e) { respuestas = pedidos.map(function () { return null; }); }
  const ahora = new Date().toISOString(), resultados = [], problemas = [];
  lista.forEach(function (x, i) {
    const d = docs[i], k = idx.indexOf(i);
    let est = 'sin', det = 'Sin servidor registrado', ver = '', apag = null, uso = null, guia = null;
    if (k !== -1) {
      const res = respuestas[k];
      let j = null; try { j = res ? JSON.parse(res.getContentText()) : null; } catch (e) {}
      if (!res) { est = 'mal'; det = 'No respondió'; }
      else if (!j) { est = 'mal'; det = 'Responde una página, no datos (¿implementación pública?)'; }
      else if (j.ok) {
        est = 'ok'; ver = texto_(j.version); det = 'Responde' + (ver ? ' · ' + ver : ''); if (Array.isArray(j.apagados)) apag = j.apagados.slice().sort();
        if (j.uso && typeof j.uso === 'object') uso = JSON.stringify(j.uso).slice(0, 4000);   // v169: registros por módulo y mes
        if (Array.isArray(j.guia)) { const g = j.guia.slice(0, 30); while (g.length && JSON.stringify(g).length > 3800) g.pop(); guia = JSON.stringify(g); }   // v173: lo que su guía no supo responder
      }
      else if (j.codigoError === 'CLAVE') { est = 'mal'; det = 'No acepta la clave guardada para este cliente'; }
      else if (j.codigoError === 'SESION') { est = 'ok'; det = 'Responde (pide usuario)'; }
      else { est = 'mal'; det = texto_(j.error) || 'Error del servidor'; }
    }
    if (est === 'ok' && ver && ver !== VERSION_SGSST) det += ' · por actualizar a ' + VERSION_SGSST;
    // Si su servidor no tiene los módulos que dice la consola, se los vuelve a mandar.
    let reenvio = null;
    if (est === 'ok' && apag && d.config && d.llaveProveedor && JSON.stringify(apag) !== JSON.stringify(apagadosDe_(d.config))) { reenvio = enviarModulos_(d); if (reenvio.ok) apag = apagadosDe_(d.config); }
    const antes = texto_(x.resumen.estadoServidor);
    guardar_({ action: 'parche', tipo: 'cliente', id: x.id, campos: { estadoServidor: est, detalleServidor: det, revisadoServidor: ahora, versionServidor: ver || texto_(x.resumen.versionServidor), apagadosServidor: apag ? apag.join(',') : texto_(x.resumen.apagadosServidor),
                         usoServidor: uso || texto_(x.resumen.usoServidor), guiaServidor: guia || texto_(x.resumen.guiaServidor) },
               opId: 'vig-' + x.id + '-' + ahora, _interno: true, _sinVersion: true, _sistema: true });
    const r = { id: x.id, nombre: texto_(x.resumen.nombre), estado: est, detalle: det, version: ver, nuevo: antes !== est || texto_(x.resumen.detalleServidor) !== det, reenvioModulos: reenvio };
    resultados.push(r);
    if (est === 'mal' || (est === 'ok' && ver && ver !== VERSION_SGSST)) problemas.push(r);
  });
  if (conCorreo && problemas.length) {
    const lunes = new Date().getDay() === 1, nuevos = problemas.filter(function (r) { return r.nuevo; });
    const dest = correos_();
    if (dest.length && (nuevos.length || lunes)) {
      try { MailApp.sendEmail(dest.join(','), '⚠ Servidores de clientes: ' + problemas.length + ' por revisar', 'Revisión de los servidores de tus clientes (' + ahora.slice(0, 10) + '):\n\n' +
        problemas.map(function (r) { return '· ' + r.nombre + ': ' + r.detalle + (r.nuevo ? '  (NUEVO)' : ''); }).join('\n') +
        '\n\nPara actualizar los desactualizados: node herramientas/actualizar-servidores.js clientes.json (la consola descarga clientes.json).'); } catch (e) {}
    }
  }
  return { ok: true, revisados: resultados.length, problemas: problemas.length, resultados: resultados, en: ahora };
}
/** ▶ Ejecutar una vez en TU servidor: revisa los servidores de los clientes cada mañana (6 a. m.). */
function instalarVigilancia() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'vigilarClientes') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('vigilarClientes').timeBased().everyDays(1).atHour(6).create();
  return 'Vigilancia programada: cada día a las 6 a. m. (avisa por correo a CORREOS_AVISO).';
}

/* ================= AVISOS POR CORREO ================= */
function correos_() { return CORREOS_AVISO.filter(function (c) { return c && c.indexOf('pon-aqui') === -1 && c.indexOf('@empresa.com') === -1; }); }
function avisarAccidente_(id, d) {
  const dest = correos_(); if (!dest.length) return;
  const limite = sumarHabiles_(texto_(d.fecha) || hoyISO_(), 2);
  const cuerpo = 'Se reportó un ACCIDENTE DE TRABAJO en el Portal SSTA.\n\n' +
    'Registro: ' + id + '\nFecha: ' + texto_(d.fecha) + ' ' + texto_(d.hora) + '\nLugar: ' + texto_(d.lugar) + '\n' +
    'Lesionado: ' + texto_(d.lesionado && d.lesionado.nombre) + ' (' + texto_(d.lesionado && d.lesionado.cedula) + ')\n\n' +
    'Descripción:\n' + texto_(d.descripcion) + '\n\n' +
    '⚠ Reporte a la ARL (FURAT): a más tardar el ' + limite + ' (2 días hábiles).\n' +
    '⚠ Investigación (Res. 1401 de 2007): dentro de los 15 días siguientes, a más tardar el ' + sumarDias_(texto_(d.fecha) || hoyISO_(), 15) + '.' +
    (d.grave || d.mortal ? '\n⚠ Accidente GRAVE o MORTAL: la investigación se remite a la ARL y, si es mortal, también a la Dirección Territorial del Ministerio de Trabajo.' : '');
  try { MailApp.sendEmail(dest.join(','), '⚠ Accidente de trabajo reportado — ' + id, cuerpo); } catch (e) {}
}

/* ── Tareas que deja el asesor SST externo (panel del asesor) ──
   Cuando el asesor deja una tarea en este portal, le llega un correo al responsable;
   cuando la empresa la cierra, le llega al asesor para que la verifique; y el correo
   diario recuerda las que están por vencer o vencidas. Los destinatarios salen SOLO de
   lo que conoce este servidor (perfil de la empresa, usuarios y CORREOS_AVISO): nunca
   de lo que mande el celular. Tope diario de correos inmediatos para evitar abusos. */
const ORIGEN_ASESOR_ = 'Asesor SST';
const TOPE_CORREOS_TAREA_ = 30;
/** Quién puede disparar el correo de una tarea nueva: con usuarios, solo Administrador o SST
 *  (el asesor entra con rol SST); sin usuarios, solo si el portal tiene su propia clave
 *  (con el token de fábrica, que es público, no sale ningún correo). */
function puedeAvisarTarea_() {
  if (CTX_.modo) return !!(CTX_.u && (CTX_.u.rol === 'admin' || CTX_.u.rol === 'sst'));
  return !!claveConfigurada_();
}
function correoValido_(c) { c = texto_(c).trim(); return /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(c) && c.length <= 120 ? c.toLowerCase() : ''; }
function normNombre_(t) { return texto_(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
function perfilEmpresa_() { try { return filaDe_('EMPRESA-PERFIL') === -1 ? {} : (leerDoc_('EMPRESA-PERFIL', false) || {}); } catch (e) { return {}; } }
/** Para quién es el aviso de una tarea: el responsable del SG-SST del perfil y el usuario
 *  que se llame como el responsable; si no hay ninguno, CORREOS_AVISO. Copia: el asesor. */
function destinosTarea_(responsable, perfil) {
  const para = [], add = function (c) { c = correoValido_(c); if (c && para.indexOf(c) === -1) para.push(c); };
  add(perfil.correoSST);
  const n = normNombre_(responsable);
  if (n) leerUsuarios_().forEach(function (u) { if (u.activo !== false && String(u.activo).toUpperCase() !== 'NO' && normNombre_(u.nombre) === n) add(u.correo); });
  if (!para.length) correos_().forEach(add);
  const cc = correoValido_(perfil.correoAsesor);
  return { para: para, cc: cc && para.indexOf(cc) === -1 ? cc : '' };
}
function cupoCorreoTarea_() {
  const pr = PropertiesService.getScriptProperties(), hoy = hoyISO_();
  let c = null; try { c = JSON.parse(pr.getProperty('CORREOS_TAREA') || 'null'); } catch (e) {}
  if (!c || c.fecha !== hoy) c = { fecha: hoy, n: 0 };
  if (c.n >= TOPE_CORREOS_TAREA_) return false;
  c.n++; pr.setProperty('CORREOS_TAREA', JSON.stringify(c));
  return true;
}
function nombreEmpresa_(perfil) { return texto_(perfil.nombre) || 'la empresa'; }
function avisarTareaAsesor_(id, d, que) {
  const perfil = perfilEmpresa_(), emp = nombreEmpresa_(perfil);
  // Tareas creadas en lote ("Tareas de sus estándares"): un solo correo, al llegar la última.
  const lote = corto_(d.lote, 40), n = Number(d.loteN) || 0;
  if (que === 'nueva' && lote && n > 1) {
    if (Number(d.loteI) !== n) return false;
    const reg = regSheet_(), last = reg.getLastRow(), titulos = [];
    if (last >= 2) reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
      if (v[1] !== 'accion' || v[11]) return; let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
      if (r.lote === lote) titulos.push('· ' + corto_(r.accion, 160) + (r.fechaCompromiso ? ' (para el ' + r.fechaCompromiso + ')' : ''));
    });
    if (titulos.indexOf('· ' + corto_(d.accion, 160) + (d.fechaCompromiso ? ' (para el ' + texto_(d.fechaCompromiso) + ')' : '')) === -1) titulos.push('· ' + corto_(d.accion, 160));
    const dst = destinosTarea_(d.responsable, perfil);
    if (!dst.para.length || !cupoCorreoTarea_()) return false;
    MailApp.sendEmail(dst.para.join(','), titulos.length + ' tareas nuevas de tu asesor SST', 'Hola,\n\n' + corto_(d.asignadaPor, 80) + ' dejó ' + titulos.length + ' tareas en el SG-SST de ' + emp + ' (responsable: ' + corto_(d.responsable, 60) + '):\n\n' +
      titulos.slice(0, 80).join('\n') + (titulos.length > 80 ? '\n…' : '') + '\n\nPara verlas, anotar avances y cerrarlas con su evidencia: Portal SSTA → Plan de acción.\n\nCorreo automático del Portal SSTA.', dst.cc ? { cc: dst.cc } : {});
    registrarEvento_(id, 'CORREO', 'APLICADO', 'Aviso de ' + titulos.length + ' tareas (lote) a ' + dst.para.concat(dst.cc ? [dst.cc] : []).join(', '), '', '', 'accion');
    return true;
  }
  const datos = 'Tarea: ' + corto_(d.accion, 300) + '\n' + (d.hallazgo ? 'Detalle: ' + corto_(d.hallazgo, 800) + '\n' : '') +
    'Responsable: ' + corto_(d.responsable, 80) + '\nFecha límite: ' + corto_(d.fechaCompromiso, 12) + '\nPrioridad: ' + corto_(d.prioridad, 12) + '\nRegistro: ' + id + '\n';
  let para, cc = '', asunto, cuerpo;
  if (que === 'nueva') {
    const dst = destinosTarea_(d.responsable, perfil); para = dst.para; cc = dst.cc;
    asunto = 'Nueva tarea de tu asesor SST — ' + corto_(d.accion, 70);
    cuerpo = 'Hola,\n\n' + (corto_(d.asignadaPor, 80) || 'Tu asesor SST') + ' dejó una tarea en el SG-SST de ' + emp + '.\n\n' + datos +
      '\nPara verla, anotar avances y cerrarla con su evidencia: Portal SSTA → Plan de acción.\n\nCorreo automático del Portal SSTA.';
  } else {
    para = [correoValido_(perfil.correoAsesor)].filter(String);
    asunto = 'Tarea cerrada en ' + emp + ' — por verificar';
    const ci = d.cierre || {};
    cuerpo = emp + ' cerró una tarea que dejaste.\n\n' + datos + '\nCierre: ' + corto_(ci.fecha, 12) + (ci.descripcion || ci.evidencia ? ' — ' + corto_(ci.descripcion || ci.evidencia, 400) : '') + (ci.eficaz ? '\nEficaz: ' + corto_(ci.eficaz, 20) : '') +
      '\n\nVerifícala desde el panel del asesor (Verificar o Reabrir).\n\nCorreo automático del Portal SSTA.';
  }
  if (!para.length || !cupoCorreoTarea_()) return false;
  const op = cc ? { cc: cc } : {};
  MailApp.sendEmail(para.join(','), asunto, cuerpo, op);
  registrarEvento_(id, 'CORREO', 'APLICADO', 'Aviso de tarea (' + que + ') a ' + para.concat(cc ? [cc] : []).join(', '), '', '', 'accion');
  return true;
}
/** Parte del correo diario: tareas del asesor que vencen en 3 días o están vencidas
 *  (se recuerdan el día siguiente al vencimiento y luego cada 7 días). Un correo por destinatario. */
function avisoTareasAsesor_() {
  const reg = regSheet_(), last = reg.getLastRow(); if (last < 2) return 0;
  const hoy = hoyISO_(), en3 = sumarDias_(hoy, 3), perfil = perfilEmpresa_(), grupos = {};
  reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (!v[0] || v[11] || v[1] !== 'accion' || v[3] === 'CERRADA') return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    if (r.origen !== ORIGEN_ASESOR_ || !/^\d{4}-\d{2}-\d{2}$/.test(texto_(r.fechaCompromiso))) return;
    const f = r.fechaCompromiso; let linea = '';
    if (f === en3) linea = 'Vence el ' + f + ' (en 3 días): ';
    else if (f < hoy) { const dias = Math.round((new Date(hoy + 'T12:00:00Z') - new Date(f + 'T12:00:00Z')) / 864e5); if (dias % 7 === 1) linea = 'VENCIDA hace ' + dias + ' día(s) (' + f + '): '; }
    if (!linea) return;
    const dst = destinosTarea_(r.responsable, perfil), k = dst.para.join(',') + '|' + dst.cc;
    if (!dst.para.length) return;
    (grupos[k] = grupos[k] || { dst: dst, l: [] }).l.push('· ' + linea + corto_(r.accion, 160) + ' — ' + corto_(r.responsable, 60));
  });
  let n = 0;
  Object.keys(grupos).forEach(function (k) {
    const g = grupos[k];
    MailApp.sendEmail(g.dst.para.join(','), 'Tareas de tu asesor SST en ' + nombreEmpresa_(perfil) + ': ' + g.l.length + ' por atender',
      'Estas tareas que dejó tu asesor SST necesitan atención:\n\n' + g.l.join('\n') + '\n\nPortal SSTA → Plan de acción (anota el avance o ciérrala con su evidencia).\n\nCorreo automático del Portal SSTA.', g.dst.cc ? { cc: g.dst.cc } : {});
    n++;
  });
  return n;
}

/** ▶ Ejecutar una vez: correo diario (6:00 a. m.) con lo que vence. */
function instalarAvisosDiarios() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'avisoDiario' || t.getHandlerFunction() === 'avisoSemanal') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('avisoDiario').timeBased().everyDays(1).atHour(6).inTimezone('America/Bogota').create();
  // Los lunes, a cada persona lo suyo de la semana (v105).
  ScriptApp.newTrigger('avisoSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone('America/Bogota').create();
  console.log('Listo: el aviso diario sale a las 6 a. m. a ' + correos_().join(', ') + ' y el resumen de la semana, los lunes a las 7 a. m., a cada usuario con correo.');
}

/* ================= PENDIENTES =================
   Una sola lista de lo que vence o toca, de todos los módulos. La usan el correo
   diario (igual que antes), el resumen del lunes a cada persona y la lista de
   pendientes del inicio. Cada pendiente:
   {nivel: 'vencido'|'pronto', texto, fecha, responsable, modulo, tipo, id, diario}
   (diario: false → no va en el correo diario; son tareas del mes, no vencimientos). */
const MODULO_TIPO_ = { cumple1040: 'convivencia.html#d1040',
  tarea: 'index.html#agenda', reintegro: 'salud.html', habeas: 'habeas.html', solrepo: 'entrega-epp.html', pvecaso: 'pve.html', sve: 'pve.html', informecc: 'convivencia.html', dotacion: 'dotacion.html', dotaperfil: 'dotacion.html', custodiahc: 'matrices-iso.html?m=custodiahc', evid0312: 'evidencias.html', competencia: 'matrices-iso.html', auditorint: 'matrices-iso.html?m=auditorint', calibracion: 'matrices-iso.html?m=calibracion', comunicacion: 'matrices-iso.html', retencion: 'matrices-iso.html', trabajador: 'habilitacion.html', equipo: 'inspecciones.html', accion: 'plan-accion.html', reporte: 'reportes.html', queja: 'convivencia.html',
  auditoria: 'auditorias.html', sustancia: 'quimicos.html', gestquim: 'quimicos.html', lugarquim: 'quimicos.html', respel: 'ambiental.html#residuos', medicion: 'peligros.html', emergencia: 'emergencias.html', examen: 'salud.html', psico: 'salud.html',
  politica: 'documental.html', legal: 'documental.html', documento: 'documental.html', proveedor: 'proveedores.html', compraprov: 'proveedores.html', cambio: 'documental.html', contratista: 'contratistas.html',
  induccion: 'induccion.html', programa: 'programas.html', pesv: 'pesv.html', vehiculo: 'pesv.html', conductor: 'pesv.html', cliente: 'asesor.html', pqrs: 'calidad.html',
  riesgocal: 'calidad.html', contextocal: 'calidad.html', entrega: 'entrega-epp.html', proginsp: 'inspecciones.html#cronograma', plananual: 'plan-anual.html', mes: 'indicadores.html',
  cierremes: 'cierre-mes.html', preop: 'preoperacional.html', reporteanual: 'gerencia.html', respaldo: 'usuarios.html' };
/* Actividades del plan anual que el portal da por hechas si hay un registro ese mes (igual que plan-anual.html). */
function hechoAuto_(auto, v, r) {
  const t = v[1];
  if (auto === 'inspecciones' && t === 'inspeccion') return r.fecha;
  if ((auto === 'copasst' || auto === 'convivencia') && t === 'reunion' && r.tipo === 'Ordinaria' && r.comite === auto) return r.fecha;
  if (auto === 'simulacro' && t === 'simulacro') return r.fecha;
  if (auto === 'auditoria' && t === 'auditoria' && v[3] === 'CERRADA') return r.fechaEjecucion;
  if (auto === 'revision' && t === 'revision') return r.fecha;
  if (auto === 'revmatriz' && t === 'revmatriz') return r.fecha;
  if (auto === 'examenes' && t === 'examen') return r.fecha;
  if (auto === 'indicadores' && t === 'mes' && r.trabajadores) return r.mes + '-01';
  return '';
}
/* Nombre de los requisitos de fábrica del personal habilitado (empresa.js puede tener otros: salen con su clave). */
const NOMBRE_REQ_ = { seguridad_social: 'pago de seguridad social (PILA)', induccion: 'inducción / reinducción en SST', medico: 'concepto médico ocupacional', alturas: 'curso de trabajo en alturas',
  confinados: 'curso de espacios confinados', izajes: 'certificación de izaje', electrico: 'competencia en riesgo eléctrico', caliente: 'capacitación en trabajo en caliente' };
/** ¿El responsable escrito en un registro es esta persona? Nombre completo igual, o todas las palabras
 *  del más corto (mínimo dos) dentro del otro: «Sandra Torres» = «Sandra Milena Torres Ávila»,
 *  pero «Ana» no es «Juliana Ríos» ni «Luis» cualquier Luis. */
function mismoNombre_(a, b) {
  const x = normNombre_(a).split(' ').filter(Boolean), y = normNombre_(b).split(' ').filter(Boolean);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  const corto = x.length <= y.length ? x : y, largo = corto === x ? y : x;
  return corto.length >= 2 && corto.every(function (w) { return largo.indexOf(w) !== -1; });
}
function ultimoDiaMes_(mes) { return sumarDias_(sumarDias_(mes + '-01', 32).slice(0, 8) + '01', -1); }
/** dias: ventana de lo próximo (15 por defecto; el calendario del inicio pide hasta 62). */
function pendientes_(dias) {
  const hoy = hoyISO_(), en15 = sumarDias_(hoy, Math.min(62, Math.max(15, Number(dias) || 15))), items = [];
  const add = function (nivel, texto, fecha, extra) { items.push(Object.assign({ nivel: nivel, texto: texto, fecha: fecha || '', responsable: '', modulo: '', tipo: '', id: '', diario: true }, extra || {})); };
  const comites = {}, reunidos = {}, gen = [], epp = {}, inactivos = {}, reportesAnuales = {}, inspHechas = [], progs = [], autoMes = {}, mesesConDatos = {}, cierres = {}, planes = {};
  const reg = regSheet_(), last = reg.getLastRow();
  const filas = last < 2 ? [] : reg.getRange(2, 1, last - 1, COLS_REG.length).getValues();
  filas.forEach(function (v) {
    if (!v[0] || v[11]) return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) {}
    const tipo = v[1], base = { tipo: tipo, id: v[0], modulo: MODULO_TIPO_[tipo] || '' };
    const anotar = function (fecha, txt, extra) {
      if (!fecha) return;
      const x = Object.assign({}, base, extra || {});
      if (fecha < hoy) add('vencido', txt, fecha, x); else if (fecha <= en15) add('pronto', txt, fecha, x);
    };
    if (tipo === 'trabajador' && r.activo !== false && !r.porRevisar) Object.keys(r.req || {}).forEach(function (k) { anotar(r.req[k].vence, r.nombre + ' — ' + (NOMBRE_REQ_[k] || k)); });
    if (tipo === 'equipo' && r.activo !== false) Object.keys(r.vencimientos || {}).forEach(function (k) { anotar(r.vencimientos[k], (r.codigo || r.nombre) + ' — ' + k, { modulo: 'inspecciones.html#' + v[0] }); });
    // v157: más fuentes en los pendientes (bandeja de cada persona)
    if (tipo === 'equipo' && r.activo !== false && r.mantTipo && r.mantTipo !== 'No aplica') anotar(r.mantProximo, (r.codigo || r.nombre) + ' — mantenimiento ' + String(r.mantTipo).toLowerCase(), { modulo: 'inspecciones.html#' + v[0] });
    if (tipo === 'solrepo' && r.estado !== 'ENTREGADA') add(sumarHabiles_(r.fecha, 3) < hoy ? 'vencido' : 'pronto', 'Entregar reposición de EPP a ' + r.nombre + ': ' + corto_(r.elementosTexto, 80), sumarHabiles_(r.fecha, 3), Object.assign({}, base, { modulo: 'entrega-epp.html' }));
    if (tipo === 'reintegro' && r.estado !== 'CERRADO') {   // v169
      anotar(r.proximoSeguimiento, 'Reintegro: seguimiento a las restricciones de ' + r.nombre, { modulo: 'salud.html#reintegro' });
      const aQuien = !r.comunicadoJefe ? 'al jefe' : 'al trabajador', enRei = Object.assign({}, base, { modulo: 'salud.html#reintegro' });
      if (!r.comunicadoJefe || !r.comunicadoTrabajador) {
        add('vencido', 'Reintegro de ' + r.nombre + ': falta comunicar las restricciones ' + aQuien + ' (Ley 776 de 2002, art. 4)', texto_(r.fechaRetorno), enRei);
      }
      const txtVence = 'Reintegro: vencen las restricciones de ' + r.nombre + ' (pedir concepto de control antes de levantarlas)';
      if (r.temporalidad === 'Temporales') anotar(r.venceRestriccion, txtVence, { modulo: 'salud.html#reintegro' });
    }
    if (tipo === 'tarea' && r.estado !== 'HECHA' && r.fecha) {   // v174: tareas propias y su recordatorio
      const ext = { responsable: texto_(r.responsable), modulo: 'index.html#agenda' }, antes = { 'Un día antes': 1, 'Tres días antes': 3, 'Una semana antes': 7 }[r.recordar] || 0;
      anotar(r.fecha, 'Tarea: ' + corto_(r.titulo, 90) + (r.hora ? ' (' + texto_(r.hora).slice(0, 5) + ')' : ''), ext);
      if (antes) { const f = sumarDias_(r.fecha, -antes); if (f >= hoy) anotar(f, 'Recordatorio: «' + corto_(r.titulo, 80) + '» es el ' + r.fecha, Object.assign({ recordatorio: true }, ext)); }
    }
    if (tipo === 'pvecaso' && r.estado !== 'Egresado') anotar(r.proximaEvaluacion, 'PVE ' + corto_(r.programa, 40) + ': evaluación de ' + r.nombre, { modulo: 'pve.html' });
    if (tipo === 'trabajador' && r.activo !== false && r.restr && r.restr.hasta) anotar(r.restr.hasta, r.nombre + ' — termina la restricción médica (pedir concepto de control)', { tipo: 'examen', modulo: 'salud.html' });
    // v107: las tareas del asesor salen siempre (no solo a 15 días), destacadas y con su responsable.
    if (tipo === 'accion' && v[3] !== 'CERRADA' && r.origen === ORIGEN_ASESOR_) { const fa = texto_(r.fechaCompromiso).slice(0, 10);
      add(fa && fa < hoy ? 'vencido' : 'pronto', 'Tarea del asesor SST: ' + corto_(r.accion || r.hallazgo, 90) + ' — ' + r.responsable, fa, Object.assign({}, base, { responsable: texto_(r.responsable), modulo: 'plan-accion.html#' + v[0], asesor: true, diario: !!fa && fa <= en15 })); }
    else if (tipo === 'accion' && v[3] !== 'CERRADA') anotar(r.fechaCompromiso, 'Acción: ' + corto_(r.accion || r.hallazgo, 90) + ' — ' + r.responsable, { responsable: texto_(r.responsable), modulo: 'plan-accion.html#' + v[0] });
    if (tipo === 'reporte' && r.clase === 'Accidente de trabajo') {
      if (!(r.furat || {}).radicado) anotar(sumarHabiles_(r.fecha, 2), 'FURAT pendiente ' + v[0], { modulo: 'reportes.html#' + v[0] });
      if ((r.investigacion || {}).estado !== 'CERRADA') anotar(sumarDias_(r.fecha, 15), 'Investigación pendiente ' + v[0], { modulo: 'reportes.html#' + v[0] });
    }
    if (tipo === 'reporte' && r.clase === 'Incidente' && (r.investigacion || {}).estado !== 'CERRADA') anotar(sumarDias_(r.fecha, 15), 'Investigación de incidente ' + v[0], { modulo: 'reportes.html#' + v[0] });
    if (tipo === 'comite' && r.periodo) {
      comites[r.comite] = true;
      const f = r.periodo.fin, nom = NOMBRE_COMITE_[r.comite] || r.comite, x = { tipo: 'comite', id: v[0], modulo: MODULO_COMITE_[r.comite] || 'copasst.html', sinSufijo: true };
      // La elección toma tiempo: se avisa 45 días antes.
      if (f && f < hoy) add('vencido', nom + ': el periodo venció el ' + f + ' (hay que elegir el nuevo)', f, x);
      else if (f && f <= sumarDias_(hoy, 45)) add('pronto', nom + ': el periodo vence el ' + f + ' (organizar la elección)', f, x);
    }
    if (tipo === 'reunion' && r.tipo === 'Ordinaria' && texto_(r.fecha).slice(0, 7) === hoy.slice(0, 7)) reunidos[r.comite] = true;
    if (tipo === 'queja' && r.estado === 'ABIERTA') {
      // Solo el código: el contenido de la queja es reservado.
      anotar(r.venceEtapa, 'Convivencia ' + r.codigo + ' — ' + r.etapa);
      anotar(r.venceTotal, 'Convivencia ' + r.codigo + ' — límite de 65 días');
    }
    // v175 · Decreto 1040 de 2026: en acoso sexual, las medidas de protección pedidas se adoptan en máximo 5 días hábiles.
    if (tipo === 'queja' && r.medSexual && r.medSolicitud && !r.medAdopcion) {
      anotar(sumarHabiles_(r.medSolicitud, 5), 'Convivencia ' + r.codigo + ' — adoptar las medidas de protección (Decreto 1040: 5 días hábiles)');
    }
    // Cumplimiento del Decreto 1040: la capacitación y la socialización son anuales.
    if (tipo === 'cumple1040' && r.capacitacion) anotar(sumarDias_(r.capacitacion, 365), 'Decreto 1040: repetir la capacitación anual sobre acoso y violencia en el trabajo');
    if (tipo === 'auditoria' && r.estado === 'PROGRAMADA') anotar(r.fechaPlan, 'Auditoría: ' + r.titulo);
    // v162: una solicitud de datos personales es pendiente desde que llega (plazo legal corto), no solo 15 días antes.
    if (tipo === 'habeas' && r.estado !== 'RESPONDIDA') { add(r.vence < hoy ? 'vencido' : 'pronto', 'Responder ' + (r.clase || 'solicitud').toLowerCase() + ' de datos personales de ' + texto_(r.nombre) + ' (Ley 1581)', r.vence, base); return; }
    if (AVISO_GEN[tipo] && v[7]) gen.push({ tipo: tipo, r: r, v: v });
    if (tipo === 'reporteanual' && r.fechaRegistro) reportesAnuales[String(r.anio)] = true;
    if (tipo === 'inspeccion') inspHechas.push({ progId: r.progId || '', tipo: r.tipoInspeccion || '', plantilla: r.plantilla || '', equipo: r.equipoId || '', mes: texto_(r.fecha).slice(0, 7) });
    if (tipo === 'proginsp' && r.activo !== false) progs.push({ id: v[0], r: r });
    if (tipo === 'mes' && r.trabajadores) mesesConDatos[r.mes] = true;
    if (tipo === 'cierremes') cierres[texto_(r.mes)] = true;
    if (tipo === 'plananual') planes[v[0]] = true;   // solo los que no están borrados
    ['inspecciones', 'copasst', 'convivencia', 'simulacro', 'auditoria', 'revision', 'revmatriz', 'examenes', 'indicadores'].forEach(function (a) { const f = texto_(hechoAuto_(a, v, r)).slice(0, 7); if (f) autoMes[a + '|' + f] = true; });
    // EPP: de cada persona y elemento cuenta la ÚLTIMA entrega ("Casco|2027-03-01; Guantes|…").
    if (tipo === 'trabajador' && r.activo === false) inactivos[String(r.cedula || '').replace(/[^0-9A-Za-z]/g, '')] = true;
    if (tipo === 'entrega') String(r.vencimientos || '').split(/\s*;\s*/).forEach(function (x) {
      const p = x.split('|'); if (p.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(p[1])) return;
      // v148: misma normalización que la pantalla (sin tildes ni espacios dobles) y se recuerda la cédula para quitar a los retirados
      const cedE = String(r.cedula || '').replace(/[^0-9A-Za-z]/g, ''), elem = String(p[0]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').replace(/\bde\b /g, '').trim();
      const k = (cedE || r.nombre) + '|' + elem, f = fechaISO_(v[4]);
      if (!epp[k] || f > epp[k].f) epp[k] = { f: f, vence: p[1], txt: 'Reponer EPP: ' + p[0] + ' de ' + r.nombre, id: v[0], ced: cedE, egreso: /egreso|retiro/i.test(r.motivo || '') };
    });
  });
  // De exámenes, baterías, políticas y mediciones solo cuenta el MÁS RECIENTE de cada persona o tema
  // (un examen viejo ya reemplazado no debe salir vencido todos los días).
  const ultimo = {};
  gen.forEach(function (g) {
    const ced = function (c) { return String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); };
    const r = g.r, k = g.tipo === 'examen' ? 'ex|' + (ced(r.cedula) || g.v[5]) : g.tipo === 'psico' ? 'psico' : g.tipo === 'politica' ? 'politica' : g.tipo === 'medicion' ? 'med|' + r.agente + '|' + r.area :
      g.tipo === 'induccion' ? 'ind|' + (ced(r.cedula) || g.v[5]) : g.tipo === 'pesv' ? 'pesv' : g.tipo === 'programa' ? 'prog|' + r.programa : g.v[0];
    if (!ultimo[k] || fechaISO_(g.v[4]) > fechaISO_(ultimo[k].v[4])) ultimo[k] = g;
  });
  Object.keys(ultimo).forEach(function (k) {
    const g = ultimo[k], r = g.r;
    if (/BAJA|OBSOLETO|INACTIVO|IMPLEMENTADO|CERRAD[OA]|RECHAZADO|FUERA DE USO|RESPONDIDA|TRATAD[OA]/i.test(texto_(g.v[3]))) return;
    if ((g.tipo === 'examen' && r.tipoExamen === 'Egreso') || (g.tipo === 'proveedor' && r.activo === false) || (g.tipo === 'legal' && r.vigente === 'No') ||
        (g.tipo === 'induccion' && (r.tipoInduccion === 'Visitante' || r.resultado !== 'APROBADA'))) return;
    const f = fechaISO_(g.v[7]), txt = AVISO_GEN[g.tipo] + ': ' + texto_(g.v[5]);
    // Responsable: el de los tipos que lo tienen como persona (PQRS, riesgos, cambios…).
    const resp = ['pqrs', 'riesgocal', 'contextocal', 'gestquim', 'cambio', 'legal', 'programa'].indexOf(g.tipo) !== -1 ? texto_(g.v[6]) : '';
    const x = { tipo: g.tipo, id: g.v[0], modulo: MODULO_TIPO_[g.tipo] || '', responsable: resp };
    if (f < hoy) add('vencido', txt, f, x); else if (f <= en15) add('pronto', txt, f, x);
  });
  Object.keys(epp).forEach(function (k) { const e = epp[k]; if (e.egreso || (e.ced && inactivos[e.ced])) return; const x = { tipo: 'entrega', id: e.id, modulo: 'entrega-epp.html' }; if (e.vence < hoy) add('vencido', e.txt, e.vence, x); else if (e.vence <= en15) add('pronto', e.txt, e.vence, x); });
  // Reporte anual de estándares mínimos (Res. 0312): del 15 de noviembre en adelante, si no se ha registrado el del año.
  if (hoy.slice(5) >= '11-15') {
    const anio = hoy.slice(0, 4);
    if (!reportesAnuales[anio]) add('pronto', 'Estándares mínimos ' + anio + ': registrar la autoevaluación y el plan de mejoramiento (revisa la fecha límite que fije el Ministerio del Trabajo)', '', { tipo: 'reporteanual', modulo: 'gerencia.html' });
  }
  // El respaldo semanal debe estar al día (si se instaló).
  const pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('RESPALDO_INSTALADO') === '1') {
    let u = null; try { u = JSON.parse(pr.getProperty('RESPALDO_ULTIMO') || 'null'); } catch (e) {}
    if (!u || !u.fecha || u.fecha < sumarDias_(hoy, -9)) add('vencido', 'Respaldo semanal de las hojas: no se hace desde ' + (u && u.fecha ? u.fecha : 'su instalación') + ' (revisa el activador "respaldoSemanal")', '', { tipo: 'respaldo', modulo: 'usuarios.html' });
    else if (u.errores && u.errores.length) add('pronto', 'El último respaldo (' + u.fecha + ') tuvo errores: ' + u.errores.join(' | '), '', { tipo: 'respaldo', modulo: 'usuarios.html' });
  }
  // Programa de inspecciones gerenciales / del COPASST: desde el día 20 se avisa lo del mes sin hacer;
  // los primeros 5 días del mes, lo del mes anterior que quedó sin hacer. En la lista del inicio,
  // lo del mes en curso sale desde el día 1 (para planearlo).
  const dia = Number(hoy.slice(8, 10)), mes = hoy.slice(0, 7), mesAnt = sumarDias_(mes + '-01', -1).slice(0, 7), finMes = ultimoDiaMes_(mes);
  const revisarProg = function (m, vencido, diario) {
    progs.forEach(function (p) {
      const r = p.r, lista = String(r.meses || '').split(/\s*,\s*/).filter(String);
      // Meses "AAAA-MM" (o, en registros viejos, números del 1 al 12 del año "anio").
      const toca = lista.indexOf(m) !== -1 || (String(r.anio) === m.slice(0, 4) && lista.some(function (x) { return /^\d{1,2}$/.test(x) && Number(x) === Number(m.slice(5, 7)); }));
      if (!toca) return;
      const hecha = inspHechas.some(function (h) { return h.mes === m && (h.progId === p.id || (!h.progId && !h.equipo && r.tipoInspeccion && r.tipoInspeccion !== 'Rutinaria' && h.tipo === r.tipoInspeccion && h.plantilla === r.plantilla)); });
      if (hecha) return;
      const txt = 'Inspección ' + (r.tipoInspeccion || 'programada').toLowerCase() + ' de ' + m + ' sin hacer: ' + texto_(r.titulo) + (r.responsable ? ' — ' + r.responsable : '');
      add(vencido ? 'vencido' : 'pronto', txt, vencido ? ultimoDiaMes_(m) : finMes, { tipo: 'proginsp', id: p.id, modulo: 'inspecciones.html#cronograma', responsable: texto_(r.responsable), sinSufijo: true, diario: diario });
    });
  };
  revisarProg(mes, false, dia >= 20);
  if (dia <= 5) revisarProg(mesAnt, true, true);
  if (dia >= 20) Object.keys(comites).forEach(function (c) { if (!reunidos[c] && c !== 'emergencias') add('pronto', (NOMBRE_COMITE_[c] || c) + ': falta la reunión ordinaria de este mes', finMes, { tipo: 'reunion', modulo: MODULO_COMITE_[c] || 'copasst.html', sinSufijo: true }); });
  else Object.keys(comites).forEach(function (c) { if (!reunidos[c] && c === 'copasst') add('pronto', 'COPASST: reunión ordinaria de este mes', finMes, { tipo: 'reunion', modulo: 'copasst.html', sinSufijo: true, diario: false }); });

  /* ── Tareas del mes (solo lista del inicio y resumen del lunes) ── */
  // Cierre del mes: datos de indicadores y el informe del mes (Res. 0312: indicadores mensuales).
  if (dia >= Number(finMes.slice(8, 10)) - 4) {
    if (!mesesConDatos[mes]) add('pronto', 'Registrar los datos del mes para los indicadores (' + mes + ')', finMes, { tipo: 'mes', modulo: 'indicadores.html', sinSufijo: true, diario: false });
    if (!cierres[mes]) add('pronto', 'Cerrar el mes ' + mes + ': revisar lo pendiente y sacar el informe', finMes, { tipo: 'cierremes', modulo: 'cierre-mes.html', sinSufijo: true, diario: false });
  }
  // El mes pasado: los primeros 10 días son para cerrarlo (por hacer); después, vencido hasta que se cierre.
  if (filas.length) {
    const nAnt = dia <= 10 ? 'pronto' : 'vencido', fAnt = dia <= 10 ? mes + '-10' : ultimoDiaMes_(mesAnt);
    if (!mesesConDatos[mesAnt]) add(nAnt, 'Faltan los datos de indicadores de ' + mesAnt, fAnt, { tipo: 'mes', modulo: 'indicadores.html', sinSufijo: true, diario: false });
    if (!cierres[mesAnt]) add(nAnt, 'Falta cerrar el mes ' + mesAnt + ' (informe del mes)', fAnt, { tipo: 'cierremes', modulo: 'cierre-mes.html?mes=' + mesAnt, sinSufijo: true, diario: false });
  }
  // Plan anual de trabajo: lo programado este mes que aún no está hecho (y, los primeros 5 días, lo del mes pasado).
  // Si la actividad se marca sola con algo que ya tiene su propio pendiente (indicadores, COPASST, cronograma de
  // inspecciones), no se repite.
  const cubre = function (auto) {
    if (auto === 'indicadores') return items.some(function (x) { return x.tipo === 'mes'; });
    if (auto === 'copasst' || auto === 'convivencia') return items.some(function (x) { return x.tipo === 'reunion' && x.modulo === auto + '.html'; });
    if (auto === 'inspecciones') return items.some(function (x) { return x.tipo === 'proginsp'; });
    return false;
  };
  const anio = hoy.slice(0, 4);
  try {
    const revisarPlan = function (a, m, nivel) {
      if (!planes['PAT-' + a]) return;
      const plan = leerDoc_('PAT-' + a, false) || {}, nm = Number(m.slice(5, 7));
      (plan.actividades || []).forEach(function (act) {
        if ((act.meses || []).indexOf(nm) === -1) return;
        const e = ((plan.ejec || {})[act.uid] || {})[nm];
        if ((e && e.hecho) || (act.auto && (autoMes[act.auto + '|' + m] || cubre(act.auto)))) return;
        add(nivel, 'Plan anual: ' + corto_(act.actividad, 90) + (nivel === 'vencido' ? ' (quedó sin hacer en ' + m + ')' : ''), ultimoDiaMes_(m),
          { tipo: 'plananual', id: 'PAT-' + a, modulo: 'plan-anual.html', responsable: texto_(act.responsable), sinSufijo: true, diario: false });
      });
    };
    revisarPlan(anio, mes, 'pronto');
    if (dia <= 5) revisarPlan(mesAnt.slice(0, 4), mesAnt, 'vencido');
  } catch (e) { console.log('Plan anual en los pendientes: ' + e.message); }
  items.sort(function (a, b) { return (a.nivel === b.nivel ? 0 : a.nivel === 'vencido' ? -1 : 1) || String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')); });
  return { hoy: hoy, items: items };
}
function lineaAviso_(x) { return x.texto + (x.fecha && !x.sinSufijo ? (x.nivel === 'vencido' ? ' (venció ' : ' (vence ') + x.fecha + ')' : ''); }
function cuerpoAviso_(items) {
  const v = items.filter(function (x) { return x.nivel === 'vencido'; }).map(lineaAviso_), p = items.filter(function (x) { return x.nivel === 'pronto'; }).map(lineaAviso_);
  return { vencido: v.length, pronto: p.length, texto: (v.length ? 'VENCIDO (' + v.length + '):\n· ' + v.join('\n· ') + '\n\n' : '') + (p.length ? 'VENCE EN LOS PRÓXIMOS 15 DÍAS (' + p.length + '):\n· ' + p.join('\n· ') + '\n' : '') };
}
/** Pendientes para la lista del inicio. Quien no es SST no ve los de salud individual. */
function pendientesLista_(dias) {
  if (CTX_.modo && !CTX_.u) return errSesion_();
  if (CTX_.modo && CTX_.u.debeCambiar === 'Sí') return { ok: false, codigoError: 'CAMBIAR', error: 'Primero cambia tu clave temporal.' };
  const p = pendientes_(dias);
  const items = p.items.filter(function (x) { return !CTX_.modo || esSst_() || SOLO_SST.indexOf(x.tipo) === -1; }).map(function (x) {
    // v148: a quien no es SST no se le dice a quién le toca examen médico (dato de salud): texto genérico.
    const txt = !sstConSesion_() && x.tipo === 'trabajador' && /m[eé]dic|examen|concepto/i.test(x.texto) ? String(x.texto).split(/\s+[—-]\s+/)[0] + ' — requisito de Personal habilitado por renovar' : x.texto;
    return { nivel: x.nivel, texto: txt, fecha: x.fecha, responsable: x.responsable, modulo: x.modulo, tipo: x.tipo, id: x.id, asesor: !!x.asesor };
  });
  return { ok: true, hoy: p.hoy, items: items, yo: yo_(), usuarios: CTX_.modo };
}

/** v107: a quién se le puede dejar una tarea (panel del asesor): nombre, cargo y rol de los
 *  usuarios activos, sin correo, cédula ni usuario. Con usuarios, solo Administrador o SST
 *  (el asesor entra con rol SST); sin usuarios no hay lista: solo el responsable del perfil. */
function responsables_() {
  if (CTX_.modo && !CTX_.u) return errSesion_();
  if (CTX_.modo && !esSst_()) return errPermiso_('Solo Administrador o SST.');
  const pf = perfilEmpresa_();
  const l = CTX_.modo ? leerUsuarios_().filter(function (u) { return u.activo === 'Sí' && texto_(u.nombre); })
    .map(function (u) { return { nombre: texto_(u.nombre), cargo: texto_(u.cargo), rol: texto_(u.rol) }; }) : [];
  const orden = { sst: 1, admin: 2, supervisor: 3, comite: 4, consulta: 5 };
  l.sort(function (a, b) { return (orden[a.rol] || 9) - (orden[b.rol] || 9) || a.nombre.localeCompare(b.nombre); });
  return { ok: true, usuarios: l, responsableSST: texto_(pf.responsableSST), roles: ROLES };
}

/** Lo que vence: requisitos del personal, equipos, acciones, FURAT e investigaciones,
 *  periodos y reuniones de los comités, plazos de quejas (solo el código) y auditorías. */
/* v159 · Informe del mes automático: el día 1 (con el aviso diario) sale a gerencia y SST el resumen del mes que
   terminó: accidentalidad, reportes, inspecciones, preoperacionales, acciones y lo que vence, con el enlace al
   informe gerencial completo del portal. Se puede ejecutar a mano («informeMensual») para probarlo. */
function datosMes_(mes) {
  const reg = regSheet_(), last = reg.getLastRow(), o = { at: 0, dias: 0, inc: 0, actos: 0, insp: 0, nc: 0, preop: 0, preopNov: 0, accNuevas: 0, accCerradas: 0, accAbiertas: 0, accVencidas: 0, charlas: 0, pct0312: '' };
  if (last < 2) return o;
  const hoy = hoyISO_();
  reg.getRange(2, 1, last - 1, COLS_REG.length).getValues().forEach(function (v) {
    if (!v[0] || v[11]) return;
    let r = {}; try { r = JSON.parse(v[8] || '{}'); } catch (e) { return; }
    const tipo = v[1], f = texto_(r.fecha || (v[4] instanceof Date ? Utilities.formatDate(v[4], 'America/Bogota', 'yyyy-MM-dd') : v[4])).slice(0, 10), en = f.slice(0, 7) === mes;
    if (tipo === 'reporte' && en) { if (r.clase === 'Accidente de trabajo') { o.at++; o.dias += Number(r.diasIncapacidad) || 0; } else if (/Incidente/.test(texto_(r.clase))) o.inc++; else o.actos++; }
    if (tipo === 'inspeccion' && en) { o.insp++; if (r.resultado === 'NO CONFORME') o.nc++; }
    if (tipo === 'preop' && en) { o.preop++; if (Number(r.malos) > 0) o.preopNov++; }
    if (tipo === 'accion') {
      if (en) o.accNuevas++;
      if (v[3] === 'CERRADA' && texto_(r.fechaCierre).slice(0, 7) === mes) o.accCerradas++;
      if (v[3] !== 'CERRADA') { o.accAbiertas++; if (r.fechaCompromiso && texto_(r.fechaCompromiso) < hoy) o.accVencidas++; }
    }
    if (tipo === 'mes' && texto_(r.mes) === mes && r.pct0312 !== undefined && r.pct0312 !== '') o.pct0312 = r.pct0312;
  });
  return o;
}
function informeMensual() {
  const hoy = hoyISO_(), mes = sumarDias_(hoy.slice(0, 8) + '01', -1).slice(0, 7);
  const perfil = perfilEmpresa_(), emp = nombreEmpresa_(perfil), sitio = texto_(perfil.sitio);
  const dest = {}; correos_().forEach(function (c) { dest[c] = 1; }); const cs = correoValido_(perfil.correoSST); if (cs) dest[cs] = 1;
  try { if (modoUsuarios_()) leerUsuarios_().forEach(function (u) { if (u.correo && u.activo === 'Sí' && (u.rol === 'admin' || u.rol === 'sst' || u.rol === 'gerencia')) { const c = correoValido_(u.correo); if (c) dest[c] = 1; } }); } catch (e) {}
  const para = Object.keys(dest); if (!para.length) return 'Sin correos para el informe.';
  const p = PropertiesService.getScriptProperties(); if (p.getProperty('INFORME_MES_ENVIADO') === mes) return 'Ya se envió el informe de ' + mes + '.';
  const d = datosMes_(mes), pend = pendientes_().items, venc = pend.filter(function (x) { return x.nivel === 'vencido'; }).length;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], nom = MESES[Number(mes.slice(5, 7)) - 1] + ' de ' + mes.slice(0, 4);
  const cuerpo = 'Informe SG-SST de ' + emp + ' — ' + nom + '\n\n' +
    'ACCIDENTALIDAD\n· Accidentes de trabajo: ' + d.at + (d.at ? ' (' + d.dias + ' días de incapacidad)' : '') + '\n· Incidentes: ' + d.inc + '\n· Actos y condiciones reportados: ' + d.actos + '\n\n' +
    'PREVENCIÓN\n· Inspecciones: ' + d.insp + (d.insp ? ' (' + d.nc + ' no conformes)' : '') + '\n· Preoperacionales: ' + d.preop + (d.preop ? ' (' + d.preopNov + ' con novedad)' : '') + '\n\n' +
    'PLAN DE ACCIÓN\n· Acciones nuevas: ' + d.accNuevas + '\n· Cerradas en el mes: ' + d.accCerradas + '\n· Abiertas hoy: ' + d.accAbiertas + (d.accVencidas ? ' (' + d.accVencidas + ' vencidas)' : '') + '\n\n' +
    (d.pct0312 !== '' ? 'ESTÁNDARES MÍNIMOS (Res. 0312)\n· Avance estimado: ' + d.pct0312 + ' %\n\n' : '') +
    'PENDIENTES DEL SISTEMA\n· ' + pend.length + ' en total, ' + venc + ' vencidos.\n\n' +
    'Informe gerencial completo con gráficas: Portal SSTA → Informes' + (sitio ? '\n' + sitio.replace(/\/?$/, '/') + 'informe.html?p=mes&v=' + mes : '') + '\n\nCorreo automático del Portal SSTA (sale el día 1 de cada mes).';
  if (typeof puedeEnviarCorreo_ === 'function' && !puedeEnviarCorreo_('baja')) return 'Sin cupo de correos hoy.';
  MailApp.sendEmail(para.join(','), 'Informe SG-SST ' + nom + ' — ' + emp, cuerpo);
  p.setProperty('INFORME_MES_ENVIADO', mes);
  registrarEvento_('', 'CORREO', 'APLICADO', 'Informe del mes ' + mes + ' a ' + para.join(', '), '', '', 'informe');
  return 'Informe de ' + mes + ' enviado a ' + para.join(', ') + '.';
}
function avisoDiario() {
  // Servidores actualizados desde una versión anterior: el resumen del lunes se programa solo la primera vez.
  try { if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'avisoSemanal'; }))
    ScriptApp.newTrigger('avisoSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).inTimezone('America/Bogota').create(); } catch (e) { console.log('Resumen del lunes: ' + e.message); }
  let tareas = 0; try { tareas = avisoTareasAsesor_(); } catch (e) { console.log('Avisos de tareas del asesor: ' + e.message); }
  let personales = 0; try { personales = avisoPersonalDiario_(); } catch (e) { console.log('Avisos personales: ' + e.message); }
  try { if (hoyISO_().slice(8) === '01') informeMensual(); } catch (e) { console.log('Informe del mes: ' + e.message); }
  const dest = correos_(); if (!dest.length) return 'Sin correos configurados.' + (tareas ? ' Avisos de tareas del asesor: ' + tareas + '.' : '');
  const hoy = hoyISO_();
  if (regSheet_().getLastRow() < 2) return 'Nada que revisar.';
  const items = pendientes_().items.filter(function (x) { return x.diario; });
  if (!items.length) return 'Nada vence en los próximos 15 días.';
  const c = cuerpoAviso_(items);
  MailApp.sendEmail(dest.join(','), 'SG-SST: ' + c.vencido + ' vencido(s), ' + c.pronto + ' por vencer — ' + hoy, c.texto);
  return 'Aviso enviado.';
}

/** Los lunes: a cada usuario con correo, lo suyo de la semana (lo vencido y lo que vence en 7 días).
 *  Administrador y SST (y CORREOS_AVISO) reciben todo; los demás, lo que tiene su nombre como responsable.
 *  Los correos salen solo de la hoja Usuarios y de CORREOS_AVISO (nunca de lo que escribe alguien en un registro). */
/** v136: cada mañana, a cada usuario con correo, SOLO si algo suyo vence hoy o mañana o venció ayer
 *  («Hoy te vence esto y tienes N atrasados»). Si no hay nada nuevo, no le llega nada: así no se vuelve spam. */
const FREC_AVISOS_ = ['diario', 'semanal', 'criticos', 'no'];
function prefsAvisos_(k) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(k) || '{}'); } catch (e) { return {}; } }
/** Preferencia de una persona: la suya, si no la de su rol, si no «diario» sin fines de semana. */
function prefAvisos_(u) { const mia = prefsAvisos_('AVISOS_USUARIOS')[String(u.usuario).toLowerCase()], rol = prefsAvisos_('AVISOS_ROL')[u.rol];
  return Object.assign({ frec: 'diario', finde: false }, rol || {}, mia || {}); }
function guardarMisAvisos_(body) {
  if (!CTX_.modo || !CTX_.u) return errSesion_();
  if (FREC_AVISOS_.indexOf(body.frec) === -1) return { ok: false, error: 'Frecuencia no válida.' };
  const m = prefsAvisos_('AVISOS_USUARIOS'); m[String(CTX_.u.usuario).toLowerCase()] = { frec: body.frec, finde: !!body.finde };
  PropertiesService.getScriptProperties().setProperty('AVISOS_USUARIOS', JSON.stringify(m));
  return { ok: true, pref: prefAvisos_(CTX_.u) };
}
function avisosPorRol_(body) {
  const no = soloAdmin_(); if (no) return no;
  // v174: además de la frecuencia, cada rol puede tener correos adicionales (varios) que reciben el resumen de ese rol.
  const malos = [], r = {};
  Object.keys(body.roles || {}).forEach(function (k) {
    if (!ROLES[k] || FREC_AVISOS_.indexOf(body.roles[k]) === -1) return;
    const cs = [];
    String((body.correos || {})[k] || '').split(/[\s,;]+/).filter(Boolean).forEach(function (c) {
      const v = correoValido_(c); if (!v) malos.push(c); else if (cs.indexOf(v) === -1) cs.push(v);
    });
    r[k] = { frec: body.roles[k] }; if (cs.length) r[k].correos = cs.slice(0, 8);
  });
  if (malos.length) return { ok: false, error: 'Revisa estos correos: ' + malos.slice(0, 5).join(', ') + '.' };
  PropertiesService.getScriptProperties().setProperty('AVISOS_ROL', JSON.stringify(r)); return { ok: true, roles: r };
}
function avisoPersonalDiario_() {
  if (!modoUsuarios_() || regSheet_().getLastRow() < 2) return 0;
  const hoy = hoyISO_(), manana = sumarDias_(hoy, 1), ayer = sumarDias_(hoy, -1);
  const items = pendientes_().items, perfil = perfilEmpresa_(), emp = nombreEmpresa_(perfil), sitio = texto_(perfil.sitio), ya = {};
  correos_().forEach(function (c) { ya[c] = true; });   // quienes ya reciben el resumen general
  let n = 0;
  leerUsuarios_().filter(function (u) { return u.correo && u.activo === 'Sí' && u.debeCambiar !== 'Sí'; }).forEach(function (u) {
    const correo = correoValido_(u.correo); if (!correo || ya[correo]) return; ya[correo] = true;
    const sst = u.rol === 'admin' || u.rol === 'sst';
    // v162 · Cada persona elige cómo le llegan los avisos (o lo define el administrador para su rol).
    const pref = prefAvisos_(u), dia = new Date(hoy + 'T12:00:00').getDay();
    if (pref.frec === 'no' || (!pref.finde && (dia === 0 || dia === 6)) || (pref.frec === 'semanal' && dia !== 1)) return;
    const suyos = items.filter(function (x) { if (SOLO_SST.indexOf(x.tipo) !== -1 && !sst) return false; return mismoNombre_(x.responsable, u.nombre) || (sst && !x.responsable); });
    const en7 = sumarDias_(hoy, 7);
    const nuevo = suyos.filter(function (x) { if (pref.frec === 'criticos') return x.nivel === 'vencido' && (x.fecha === ayer || dia === 1); if (pref.frec === 'semanal') return x.fecha && x.fecha <= en7; return x.fecha && (x.fecha === hoy || x.fecha === manana || (x.nivel === 'vencido' && x.fecha === ayer)); });
    if (!nuevo.length) return;
    const atras = suyos.filter(function (x) { return x.nivel === 'vencido'; }).length;
    const ln = function (x) { return '· ' + (x.fecha === hoy ? 'HOY: ' : x.fecha === manana ? 'Mañana: ' : 'Venció ayer: ') + x.texto; };
    if (!puedeEnviarCorreo_('baja')) { registrarEvento_('', 'CORREO', 'OMITIDO', 'Cuota diaria de correos casi agotada: no se envió el aviso a ' + correo, '', '', 'aviso'); return; }   // v142: deja cupo para alarmas y respaldo
    MailApp.sendEmail(correo, 'SG-SST ' + emp + ': ' + nuevo.length + ' para hoy' + (atras ? ' y ' + atras + ' atrasado(s)' : ''),
      'Hola ' + texto_(u.nombre).split(' ')[0] + ',\n\n' + nuevo.map(ln).join('\n') + (atras ? '\n\nTienes ' + atras + ' pendiente(s) atrasado(s).' : '') +
      '\n\nÁbrelo en el portal: Gestión → Hoy.' + (sitio ? '\n' + sitio : '') + '\n\nCorreo automático del Portal SSTA.');
    n++;
  });
  // v174 · Correos adicionales por rol: reciben lo de ese rol (SST y administrador: todo; los demás: lo que no es solo de SST).
  const porRol = prefsAvisos_('AVISOS_ROL'), dia2 = new Date(hoy + 'T12:00:00').getDay(), en7b = sumarDias_(hoy, 7);
  Object.keys(porRol).forEach(function (rol) {
    const pr = porRol[rol] || {}, sst = rol === 'admin' || rol === 'sst';
    if (!Array.isArray(pr.correos) || pr.frec === 'no' || dia2 === 0 || dia2 === 6 || (pr.frec === 'semanal' && dia2 !== 1)) return;
    const suyos = items.filter(function (x) { return sst || SOLO_SST.indexOf(x.tipo) === -1; });
    const nuevo = suyos.filter(function (x) {
      if (pr.frec === 'criticos') return x.nivel === 'vencido' && (x.fecha === ayer || dia2 === 1);
      if (pr.frec === 'semanal') return x.fecha && x.fecha <= en7b;
      return x.fecha && (x.fecha === hoy || x.fecha === manana || x.fecha === ayer);
    });
    if (!nuevo.length) return;
    pr.correos.forEach(function (c) {
      const correo = correoValido_(c); if (!correo || ya[correo]) return; ya[correo] = true;
      if (!puedeEnviarCorreo_('baja')) return;
      MailApp.sendEmail(correo, 'SG-SST ' + emp + ' (' + (ROLES[rol] || rol) + '): ' + nuevo.length + ' pendiente(s)',
        'Resumen para el rol ' + (ROLES[rol] || rol) + ':\n\n' + nuevo.slice(0, 60).map(function (x) { return '· ' + (x.fecha ? x.fecha + ': ' : '') + x.texto; }).join('\n') +
        '\n\nÁbrelo en el portal: Gestión → Hoy.' + (sitio ? '\n' + sitio : '') +
        '\n\nCorreo automático del Portal SSTA. Para dejar de recibirlo, pídele al administrador que quite tu correo del rol.');
      n++;
    });
  });
  return n;
}
/** v136: los avisos por correo se programan solos la primera vez que alguien abre sus pendientes
 *  (antes había que ejecutar instalarAvisosDiarios a mano). Se revisa una vez al día. */
function asegurarAvisos_() {
  try {
    const c = cacheScript_(); if (c && c.get('avisos-ok')) return;
    if (c) c.put('avisos-ok', '1', 21600);
    if (PropertiesService.getScriptProperties().getProperty('AVISOS_APAGADOS') === '1') return;
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'avisoDiario'; })) instalarAvisosDiarios();
  } catch (e) { console.log('Avisos automáticos: ' + e.message); }
}
/** v137: verifica los sellos de las firmas de un registro (para el historial y para una auditoría). */
function verificarSellos_(id) {
  const fila = filaDe_(id); if (fila === -1) return { ok: false, error: 'No existe ese registro.' };
  const prev = leerFila_(fila);
  if (!puedeLeer_(prev.tipo)) return CTX_.u ? errPermiso_('Tu usuario no puede ver este registro.') : errSesion_();
  const doc = leerDoc_(id, true) || {}, l = [];
  (function andar(o, ruta, prof) {
    if (!o || typeof o !== 'object' || prof > 12) return;
    Object.keys(o).forEach(function (k) {
      const v = o[k];
      if (typeof v === 'string' && v.indexOf('data:image') === 0 && /firma|sig/i.test(k)) {
        const huella = selloHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v)), s = o[k + '_sello'];
        l.push({ campo: (ruta ? ruta + '.' : '') + k, sellada: !!s, valida: selloValido_(s, huella, prev.tipo + ':' + id), sinTrazo: s && s.alterna ? s.alterna : '', fecha: s ? s.fecha : '', usuario: s ? s.usuario : '', gps: s ? s.gps : '', equipo: s ? String(s.equipo || '').slice(0, 90) : '', codigo: s ? String(s.codigo || '').slice(0, 16) : '' });
      } else if (v && typeof v === 'object' && !/_sello$/.test(k)) andar(v, (ruta ? ruta + '.' : '') + k, prof + 1);
    });
  })(doc, '', 0);
  return { ok: true, firmas: l };
}
/* ===== v137 · ARCHIVO ANUAL =====
   Con los años la hoja Registros crece (preoperacionales diarios, reportes, acciones…) y el portal se pone
   lento. Esto mueve a un libro aparte («SG-SST Archivo …», en la carpeta de respaldos) lo CERRADO de los años
   anteriores al pasado: preoperacionales, reportes cerrados, acciones cerradas, inspecciones y lo borrado.
   El año en curso y el anterior quedan en línea (indicadores y autoevaluación). Nada se pierde: se copia,
   se verifica la copia y solo entonces se quita de la base activa. Se conserva 20 años (Dec. 1072).
   ▶ Ejecutar «archivoAnualVistaPrevia» para ver cuántos se moverían, y «archivarAniosAnteriores» para hacerlo. */
function archivoCriterio_(v, corte) {
  const f = v[4] instanceof Date ? Utilities.formatDate(v[4], 'America/Bogota', 'yyyy-MM-dd') : String(v[4] || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || f >= corte) return false;
  const tipo = v[1], estado = String(v[3] || '');
  if (v[11]) return true;                                                   // borrado
  if (tipo === 'preop' || tipo === 'preopsalud' || tipo === 'inspeccion') return true;
  if (tipo === 'reporte' && estado === 'CERRADO') return true;
  if (tipo === 'accion' && estado === 'CERRADA') return true;
  return false;
}
function archivoCorte_() { return (Number(hoyISO_().slice(0, 4)) - 1) + '-01-01'; }
function archivoVistaPrevia() {
  const reg = regSheet_(), last = reg.getLastRow(), corte = archivoCorte_(); if (last < 2) return 'Nada que archivar.';
  const vals = reg.getRange(2, 1, last - 1, COLS_REG.length).getValues(), por = {};
  vals.forEach(function (v) { if (archivoCriterio_(v, corte)) por[v[1]] = (por[v[1]] || 0) + 1; });
  const n = Object.keys(por).reduce(function (a, k) { return a + por[k]; }, 0);
  const t = 'Registros activos: ' + vals.length + '. Se moverían al archivo ' + n + ' (anteriores al ' + corte + '): ' + JSON.stringify(por);
  console.log(t); return t;
}
function archivoAnualVistaPrevia() { return archivoVistaPrevia(); }
function archivarAniosAnteriores() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000); LOCK_TOMADO_++;
  try {
    const reg = regSheet_(), last = reg.getLastRow(), corte = archivoCorte_(); if (last < 2) return 'Nada que archivar.';
    const vals = reg.getRange(2, 1, last - 1, COLS_REG.length).getValues();
    let mover = []; const quedan = [], ids = {}, vistos = {};
    // v141: lotes de 1500 y sin filas repetidas (una corrida cortada a medias se arregla sola al repetirla).
    vals.forEach(function (v) { if (vistos[v[0]]) return; vistos[v[0]] = true; if (archivoCriterio_(v, corte) && mover.length < 1500) { mover.push(v); ids[v[0]] = v[1]; } else quedan.push(v); });
    if (!mover.length) return 'Nada que archivar (todo es de ' + corte.slice(0, 4) + ' en adelante o sigue abierto).';
    // 1) El libro del archivo (uno por corte), en la carpeta de respaldos.
    const props = PropertiesService.getScriptProperties(), clave = 'ARCHIVO_' + corte.slice(0, 4);
    let libro = null; try { if (props.getProperty(clave)) libro = SpreadsheetApp.openById(props.getProperty(clave)); } catch (e) { libro = null; }
    if (!libro) {
      libro = SpreadsheetApp.create('SG-SST Archivo (antes del ' + corte + ') — ' + nombreEmpresa_(perfilEmpresa_()));
      try { DriveApp.getFileById(libro.getId()).moveTo(carpetaRaiz_('CARPETA_RESPALDOS', 'Respaldos SG-SST')); } catch (e) {}
      props.setProperty(clave, libro.getId());
    }
    const hojaA = function (nombre, cols) { let h = libro.getSheetByName(nombre); if (!h) { h = libro.insertSheet(nombre); h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); } return h; };
    const agregar = function (h, filas) { if (filas.length) h.getRange(h.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas); };
    // 2) Copiar: registros, sus datos y sus imágenes.
    const partir = function (sh, ncols) { const n = sh.getLastRow(); if (n < 2) return { va: [], queda: [] }; const t = sh.getRange(2, 1, n - 1, ncols).getValues(), va = [], queda = [], vis = {}; t.forEach(function (r) { const k = r[0] + '|' + r[1]; if (vis[k]) return; vis[k] = true; (ids[r[0]] ? va : queda).push(r); }); return { va: va, queda: queda }; };
    const dSh = datosSheet_(), iSh = imgSheet_(), D = partir(dSh, 4), I = partir(iSh, 4);
    const hR = hojaA('Registros', COLS_REG), hD = hojaA('Datos', ['id', 'parte', 'texto', 'updatedAt']), hI = hojaA('Imagenes', ['id', 'imgKey', 'dataUrl', 'updatedAt']);
    // v141: si una corrida anterior quedó a medias, lo que ya está en el archivo no se copia de nuevo.
    const ya = {}; if (hR.getLastRow() > 1) hR.getRange(2, 1, hR.getLastRow() - 1, 1).getValues().forEach(function (r) { ya[r[0]] = true; });
    mover = mover.filter(function (r) { return !ya[r[0]]; }); D.va = D.va.filter(function (r) { return !ya[r[0]]; }); I.va = I.va.filter(function (r) { return !ya[r[0]]; });
    const antes = [hR.getLastRow(), hD.getLastRow(), hI.getLastRow()];
    agregar(hR, mover.map(function (r) { return r.map(function (x) { return (typeof x === 'string' && /^[=+\-@]/.test(x)) ? "'" + x : x; }); })); agregar(hD, D.va.map(function (r) { return [r[0], r[1], "'" + String(r[2]), r[3]]; })); agregar(hI, I.va.map(function (r) { return [r[0], r[1], "'" + String(r[2]), r[3]]; }));
    SpreadsheetApp.flush();
    // 3) Verificar la copia antes de quitar nada.
    if (hR.getLastRow() - antes[0] !== mover.length || hD.getLastRow() - antes[1] !== D.va.length || hI.getLastRow() - antes[2] !== I.va.length) throw new Error('La copia al archivo no quedó completa: no se quitó nada de la base activa.');
    // 4) Quitar de la base activa (se reescribe cada hoja con lo que queda).
    // Primero se escribe encima lo que queda y después se limpia la cola: nunca hay un momento con la hoja vacía.
    const reescribir = function (sh, filas, ncols) { const n = sh.getLastRow();
      const seguro = function (x, i) { if (i === 2 && ncols === 4) return "'" + String(x); return (typeof x === 'string' && /^[=+\-@]/.test(x)) ? "'" + x : x; };
      if (filas.length) sh.getRange(2, 1, filas.length, ncols).setValues(filas.map(function (r) { return r.map(seguro); }));
      if (n - 1 > filas.length) sh.getRange(2 + filas.length, 1, n - 1 - filas.length, ncols).clearContent(); };
    reescribir(reg, quedan, COLS_REG.length); reescribir(dSh, D.queda, 4); reescribir(iSh, I.queda, 4);
    subirListaGen_();   // v168: salieron filas de la hoja: cada celular vuelve a pedir sus listas completas
    Object.keys(ids).forEach(function (id) { try { escribirVista_(ids[id], id, {}, true); } catch (e) {} });
    const t = Object.keys(ids).length + ' registro(s) anteriores al ' + corte + ' movidos al archivo: ' + libro.getUrl();
    registrarEvento_('', 'ARCHIVO', 'APLICADO', t, '', '', 'archivo');
    console.log(t + (Object.keys(ids).length >= 1500 ? '\nQuedan más: vuelve a ejecutarlo.' : ''));
    return t;
  } finally { LOCK_TOMADO_--; lock.releaseLock(); }
}
function avisoSemanal() {
  const hoy = hoyISO_(), en7 = sumarDias_(hoy, 7);
  if (regSheet_().getLastRow() < 2) return 'Nada que revisar.';
  // Lo vencido, lo que vence en 7 días y las tareas del mes (plan anual, inspecciones programadas, comités, cierre).
  const DEL_MES = ['plananual', 'proginsp', 'reunion', 'mes', 'cierremes'];
  const todos = pendientes_().items.filter(function (x) { return x.nivel === 'vencido' || !x.fecha || x.fecha <= en7 || DEL_MES.indexOf(x.tipo) !== -1 || x.asesor; });
  if (!todos.length) return 'Nada para esta semana.';
  const perfil = perfilEmpresa_(), emp = nombreEmpresa_(perfil), enviados = {}, sitio = texto_(perfil.sitio);
  const armar = function (lista, nombre) {
    const v = lista.filter(function (x) { return x.nivel === 'vencido'; }), s = lista.filter(function (x) { return x.nivel !== 'vencido'; });
    const ln = function (x) { return '· ' + lineaAviso_(x); };
    return 'Hola' + (nombre ? ' ' + nombre.split(' ')[0] : '') + ',\n\nEsto es lo del SG-SST de ' + emp + ' para esta semana' + ' (' + hoy + ' a ' + en7 + ').\n\n' +
      (v.length ? 'YA VENCIDO (' + v.length + '):\n' + v.map(ln).join('\n') + '\n\n' : '') + (s.length ? 'ESTA SEMANA (' + s.length + '):\n' + s.map(ln).join('\n') + '\n\n' : '') +
      'Ábrelo en el portal: en el inicio, «Pendientes».' + (sitio ? '\n' + sitio : '') + '\n';
  };
  const enviar = function (correo, lista, nombre) {
    correo = correoValido_(correo); if (!correo || enviados[correo] || !lista.length) return;
    enviados[correo] = true;
    if (!puedeEnviarCorreo_('baja')) { registrarEvento_('', 'CORREO', 'OMITIDO', 'Cuota diaria de correos casi agotada: no se envió el resumen a ' + correo, '', '', 'aviso'); return; }
    MailApp.sendEmail(correo, 'SG-SST ' + emp + ': ' + lista.length + ' pendiente(s) esta semana', armar(lista, nombre));
  };
  // Primero CORREOS_AVISO (reciben todo); luego cada usuario activo y con su clave ya cambiada (la temporal no lee nada).
  correos_().forEach(function (c) { enviar(c, todos, ''); });
  const usuarios = modoUsuarios_() ? leerUsuarios_().filter(function (u) { return u.correo && u.activo === 'Sí' && u.debeCambiar !== 'Sí'; }) : [];
  usuarios.forEach(function (u) {
    const sst = u.rol === 'admin' || u.rol === 'sst';
    const suyos = todos.filter(function (x) {
      if (SOLO_SST.indexOf(x.tipo) !== -1 && !sst) return false;          // salud individual: solo SST
      if (sst) return true;
      return mismoNombre_(x.responsable, u.nombre);
    });
    enviar(u.correo, suyos, texto_(u.nombre));
  });
  return 'Resumen semanal enviado a ' + Object.keys(enviados).length + ' persona(s).';
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


    return {
      doGet: doGet,
      doPost: doPost,
      libro: __entorno.libro,
      funciones: { verLibro: verLibro, verificarBitacora: verificarBitacora, revisarSesionObra: revisarSesionObra, codigoAdministrador: codigoAdministrador, asignarPersonaIds: asignarPersonaIds, respaldoSemanal: respaldoSemanal, probarRestauracion: probarRestauracion, restaurarDesdeRespaldo: restaurarDesdeRespaldo, instalarRespaldo: instalarRespaldo, vigilarClientes: vigilarClientes, instalarVigilancia: instalarVigilancia, instalarAvisosDiarios: instalarAvisosDiarios, informeMensual: informeMensual, avisoDiario: avisoDiario, archivoVistaPrevia: archivoVistaPrevia, archivoAnualVistaPrevia: archivoAnualVistaPrevia, archivarAniosAnteriores: archivarAniosAnteriores, avisoSemanal: avisoSemanal }
    };
  })();
  return __sgsst;
}
(globalThis.MODULOS_PORTAL = globalThis.MODULOS_PORTAL || {})['sgsst'] = modulo_sgsst_;

/* Funciones de mantenimiento de "sgsst" (menú ▶ Ejecutar del editor). */
function sgsst__verLibro() { return modulo_sgsst_().funciones.verLibro.apply(null, arguments); }
function sgsst__verificarBitacora() { return modulo_sgsst_().funciones.verificarBitacora.apply(null, arguments); }
function sgsst__revisarSesionObra() { return modulo_sgsst_().funciones.revisarSesionObra.apply(null, arguments); }
function sgsst__codigoAdministrador() { return modulo_sgsst_().funciones.codigoAdministrador.apply(null, arguments); }
function sgsst__asignarPersonaIds() { return modulo_sgsst_().funciones.asignarPersonaIds.apply(null, arguments); }
function sgsst__respaldoSemanal() { return modulo_sgsst_().funciones.respaldoSemanal.apply(null, arguments); }
function sgsst__probarRestauracion() { return modulo_sgsst_().funciones.probarRestauracion.apply(null, arguments); }
function sgsst__restaurarDesdeRespaldo() { return modulo_sgsst_().funciones.restaurarDesdeRespaldo.apply(null, arguments); }
function sgsst__instalarRespaldo() { return modulo_sgsst_().funciones.instalarRespaldo.apply(null, arguments); }
function sgsst__vigilarClientes() { return modulo_sgsst_().funciones.vigilarClientes.apply(null, arguments); }
function sgsst__instalarVigilancia() { return modulo_sgsst_().funciones.instalarVigilancia.apply(null, arguments); }
function sgsst__instalarAvisosDiarios() { return modulo_sgsst_().funciones.instalarAvisosDiarios.apply(null, arguments); }
function sgsst__informeMensual() { return modulo_sgsst_().funciones.informeMensual.apply(null, arguments); }
function sgsst__avisoDiario() { return modulo_sgsst_().funciones.avisoDiario.apply(null, arguments); }
function sgsst__archivoVistaPrevia() { return modulo_sgsst_().funciones.archivoVistaPrevia.apply(null, arguments); }
function sgsst__archivoAnualVistaPrevia() { return modulo_sgsst_().funciones.archivoAnualVistaPrevia.apply(null, arguments); }
function sgsst__archivarAniosAnteriores() { return modulo_sgsst_().funciones.archivarAniosAnteriores.apply(null, arguments); }
function sgsst__avisoSemanal() { return modulo_sgsst_().funciones.avisoSemanal.apply(null, arguments); }
