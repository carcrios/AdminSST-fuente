/* ats.app.js — código de ats.html (v162: fuera del HTML para que el celular lo guarde en caché). */
/* ============================================================
   ATS interactivo (SSTA-F-007)
   Todo el estado vive en `ats` y se guarda como borrador en el dispositivo
   en cada cambio. La hoja impresa se arma desde ese estado, con la misma
   forma del formato en Excel.
   ============================================================ */
OfflineBanner.init();
if (typeof ScrollProgress !== 'undefined') ScrollProgress.init('#0f5e63');

const $ = (id) => document.getElementById(id);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PEL = Object.fromEntries(PELIGROS.map((p) => [p.id, p]));
const TAR = Object.fromEntries(TAREAS.map((t) => [t.id, t]));
const CLASE = Object.fromEntries(CLASES_GTC45.map((c) => [c.id, c]));
/* Un ATS guardado lleva escritas la clase y la subclase de cada peligro, así
   se sigue leyendo igual aunque el catálogo cambie después. Estas funciones
   usan el catálogo si el peligro existe y, si no, lo que quedó guardado. */
function pelDe(pi) {
  return PEL[pi.id] || { id: pi.id, clase: null, sub: pi.sub || '', texto: pi.texto || '', efectos: pi.efectos || '',
    controles: [], generales: [], epp: [], emergencia: [], claves: [] };
}
function claseDe(pi) { const p = PEL[pi.id]; return p ? CLASE[p.clase].nombre : (pi.clase || 'Otro'); }
const CLAVE_BORRADOR = 'ats-borrador';
const CLAVE_PLANTILLAS = 'ats-plantillas';
let uidSeq = Date.now();
const uid = () => 'u' + (uidSeq++).toString(36);
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

$('codFormato').textContent = $('codFormatoMenu').textContent = [ATS_FORMATO.codigo, ATS_FORMATO.version ? 'Versión ' + ATS_FORMATO.version : ''].filter(Boolean).join(' · ');

/* ================= ESTADO ================= */
function nuevoAts() {
  return {
    v: 1,
    code: null,      // se asigna al primer guardado en el servidor (ATS-AAAAMMDD-NNNNNN)
    version: 0,      // versión que tiene el servidor según este dispositivo
    subidoEn: null,  // cuándo se subió por última vez
    sucio: false,    // hay cambios que no se han subido
    cab: {
      centro: [], centroOtro: '', desde: hoyISO(), hasta: '', horaDesde: '07:00', horaHasta: '17:00',
      area: '', trabajo: '', requiere: '', permisos: [], permisoOtro: '',
      epp: EPP.filter((e) => e.base).map((e) => e.id), eppDescartados: [], eppOtro: '',
      herr: [], herrOtro: '', herrOtros: {},
      emergencia: EMERGENCIA.filter((e) => e.base).map((e) => e.id), emergDescartados: [], emergOtro: '',
      ambiental: AMBIENTAL.filter((e) => e.base).map((e) => e.id), ambOtro: ''
    },
    participantes: [],
    tareas: [],
    firmas: { lider: { nombre: '', firma: null }, jefe: { nombre: '', firma: null }, sst: { nombre: '', firma: null } }
  };
}
let ats = nuevoAts();
let editando = null;      // copia de la tarea en edición (o null)
let ultimaGuardada = null; // para sugerir "¿qué sigue?"

/* Instancia de un peligro dentro de una tarea: se copia el texto del
   catálogo para que se pueda ajustar a la tarea sin cambiar el catálogo. */
function instanciaPeligro(id) {
  const p = PEL[id];
  return { id, clase: CLASE[p.clase].nombre, sub: p.sub, texto: p.texto, efectos: p.efectos,
    ctrls: p.controles.map(([t, j]) => ({ t, j, on: true })), abierto: false };
}
function generalesSugeridos(peligros) {
  const set = new Set(GENERALES_BASE);
  peligros.forEach((pi) => (PEL[pi.id] && PEL[pi.id].generales || []).forEach((g) => set.add(g)));
  return Array.from(set);
}
function tareaDesdePlantilla(tid) {
  const t = TAR[tid];
  const peligros = t.peligros.map(instanciaPeligro);
  return {
    uid: uid(), plantilla: tid, titulo: t.nombre, desc: t.desc, conds: [], condOtro: '',
    peligros, generales: generalesSugeridos(peligros), generalesOtro: '',
    responsables: ['Supervisor de obra', 'Personal SSTA', 'Personal operativo'], rescate: false
  };
}
function tareaVacia() {
  return { uid: uid(), plantilla: null, titulo: '', desc: '', conds: [], condOtro: '', peligros: [], generales: GENERALES_BASE.slice(), generalesOtro: '',
    responsables: ['Supervisor de obra', 'Personal SSTA', 'Personal operativo'], rescate: false };
}
function tareaRescate() {
  const peligros = ['loc', 'cargas', 'biologico', 'tec_caliente', 'mec_manual', 'ruido', 'electrico', 'natural', 'vapores', 'alturas', 'confinados'].map(instanciaPeligro);
  return { uid: uid(), plantilla: 'rescate', titulo: PLAN_RESCATE.nombre, desc: '', conds: [], peligros,
    generales: ['Informar al jefe inmediato y a SST'], generalesOtro: '',
    rescatePasos: PLAN_RESCATE.pasos.map((t) => ({ t, on: true })),
    responsables: ['Supervisor de obra', 'Personal SSTA', 'Personal operativo'], rescate: true };
}

/* ================= SUGERENCIAS POR TEXTO =================
   Las palabras clave se buscan desde el inicio de palabra ("sold" encuentra
   "soldadura" y "soldar", pero "sol" no se confunde con "soldadura"). */
function contiene(textoNorm, clave) {
  const k = norm(clave).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + k).test(textoNorm);
}
function peligrosDetectados(texto) {
  const t = norm(texto);
  const res = [];
  if (!t.trim()) return res;
  PELIGROS.forEach((p) => { if ((p.claves || []).some((k) => contiene(t, k))) res.push(p.id); });
  return res;
}
function plantillasPorTexto(texto, max) {
  const t = norm(texto);
  if (t.trim().length < 3) return [];
  // Lo que se va escribiendo también cuenta a medias: "valv" ya encuentra
  // "Cambio de válvulas" aunque la palabra no esté completa.
  const escritas = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  return TAREAS.map((tar) => {
    let s = 0;
    (tar.claves || []).forEach((k) => { if (contiene(t, k)) s += 3; });
    const palabras = norm(tar.nombre + ' ' + (tar.claves || []).join(' ')).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
    norm(tar.nombre).split(/[^a-z0-9]+/).filter((w) => w.length > 4).forEach((w) => { if (contiene(t, w)) s += 1; });
    escritas.forEach((e) => { if (palabras.some((w) => w.startsWith(e) && w !== e)) s += 2; });
    return { tar, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, max || 5).map((x) => x.tar);
}
/* Condiciones que sugiere lo escrito o la tarea tipo escogida. */
function condicionesSugeridas(t) {
  const txt = norm((t.titulo || '') + ' ' + (t.desc || ''));
  const base = new Set((TAR[t.plantilla] && TAR[t.plantilla].peligros) || []);
  const out = {};
  CONDICIONES.forEach((c) => {
    if (t.conds.includes(c.id)) return;
    if ((c.claves || []).some((k) => contiene(txt, k))) out[c.id] = 'por lo que escribiste';
    else if (!c.soloTexto && c.peligros.length && c.peligros.every((x) => base.has(x)) && t.plantilla) out[c.id] = 'por la tarea tipo';
  });
  return out;
}
/* Controles que ofrece el catálogo para un peligro (los de siempre y los
   adicionales), para mostrar sin marcar los que la tarea todavía no tiene. */
function controlesCatalogo(id) {
  const p = PEL[id];
  if (!p) return [];
  return p.controles.concat((typeof CONTROLES_ADICIONALES !== 'undefined' && CONTROLES_ADICIONALES[id]) || []);
}

/* ================= GUARDADO ================= */
let timerGuardar = null;
function guardar(opts) {
  if (!(opts && opts.sinCambios)) ats.sucio = true;
  clearTimeout(timerGuardar);
  timerGuardar = setTimeout(() => {
    const ok = DraftStore.save(CLAVE_BORRADOR, ats);
    if (!ok) { $('estadoGuardado').textContent = '⚠️ No se pudo guardar el borrador en este dispositivo.'; return; }
    actualizarEstado();
  }, 600);
}
/* La barra de abajo dice en qué punto está el ATS: solo en el celular, con
   cambios sin subir, o igual al servidor. */
function actualizarEstado() {
  // El botón para agregar gente que llega después depende de que el ATS ya
  // esté en el servidor: se actualiza aquí, que es lo que corre al guardar.
  $('btnModoAgregar').hidden = !(ats.code && urlAts());
  $('btnCerrarEste').hidden = !(ats.code && urlAts());
  // Un ATS cerrado se puede consultar e imprimir, pero ya no se sube.
  const cerrado = ats.estado === 'CERRADO';
  document.body.classList.toggle('ats-cerrado', cerrado);
  $('bannerCerrado').innerHTML = cerrado ? textoCierre(ats) + '<br>Queda solo para consulta e impresión: los cambios que hagas aquí no se suben.' : '';
  const el = $('estadoGuardado');
  el.classList.remove('sucio', 'subido');
  const hora = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (!urlAts()) { el.textContent = 'Borrador guardado en este dispositivo.'; return; }
  if (!ats.code) { el.textContent = 'Guardado solo en este dispositivo: todavía no se ha subido.'; return; }
  if (cerrado) { el.textContent = '🔒 ' + ats.code + ' cerrado · solo consulta e impresión'; return; }
  if (ats.sucio) { el.textContent = ats.code + ' · hay cambios sin subir al servidor'; el.classList.add('sucio'); return; }
  el.textContent = '✓ ' + ats.code + ' guardado en el servidor (versión ' + ats.version + (ats.subidoEn ? ', ' + hora(ats.subidoEn) : '') + ')';
  el.classList.add('subido');
}
/* Si la página se cierra o el celular se bloquea justo después de firmar,
   se guarda YA, sin esperar las pausas de arriba: firmar y cerrar es
   exactamente lo que hace alguien que termina el ATS. */
function guardarYa() {
  clearTimeout(timerGuardar);
  lectoresFirma.forEach((f) => { try { f(); } catch (e) { /* lienzo ya retirado */ } });
  DraftStore.save(CLAVE_BORRADOR, ats);
}
window.addEventListener('pagehide', guardarYa);
document.addEventListener('visibilitychange', () => { if (document.hidden) guardarYa(); });
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ================= FICHAS GENÉRICAS ================= */
function fichas(cont, opciones, seleccion, alCambiar, opts) {
  opts = opts || {};
  cont.innerHTML = '';
  opciones.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ficha' + (seleccion.includes(o.id) ? ' on' : '') + (o.marca ? ' permiso-marcado' : '');
    b.innerHTML = esc(o.nombre) + (o.pista ? '<span class="pista">' + esc(o.pista) + '</span>' : '');
    b.setAttribute('aria-pressed', seleccion.includes(o.id) ? 'true' : 'false');
    b.addEventListener('click', () => {
      const i = seleccion.indexOf(o.id);
      if (opts.unica) { seleccion.length = 0; if (i === -1) seleccion.push(o.id); }
      else if (i === -1) seleccion.push(o.id); else seleccion.splice(i, 1);
      alCambiar(o.id, i === -1);
    });
    cont.appendChild(b);
  });
}

/* ================= ENCABEZADO ================= */
/* "Otro" va solo en la pantalla y en la hoja: no está en el catálogo
   porque no tiene peligros asociados (no debe disparar la alerta de permisos). */
const PERMISOS_UI = PERMISOS.concat([{ id: 'otro', nombre: 'Otro (escribir)' }]);
function renderCab() {
  const c = ats.cab;
  fichas($('fCentro'), CENTROS_COSTO.map((x) => ({ id: x, nombre: x })), c.centro, () => { renderCab(); guardar(); });
  fichas($('fRequiere'), [{ id: 'SI', nombre: 'Sí' }, { id: 'NO', nombre: 'No' }], c.requiere ? [c.requiere] : [], (id, on) => {
    c.requiere = on ? id : '';
    if (c.requiere !== 'SI') c.permisos = [];
    renderCab(); renderAlertaPermisos(); guardar();
  }, { unica: true });
  $('bloquePermisos').style.display = c.requiere === 'SI' ? 'block' : 'none';
  fichas($('fPermisos'), PERMISOS_UI, c.permisos, (id, on) => {
    renderCab(); renderAlertaPermisos(); guardar();
    if (id === 'otro' && on) $('permisoOtro').focus();
  });
  $('permisoOtro').hidden = !(c.requiere === 'SI' && c.permisos.includes('otro'));
  sincronizarPermisosAsociados();
  renderAbrirPermisos();
  renderEpp(); renderHerr(); renderEmerg(); renderAmb();
}
function enlazarCampo(id, ruta) {
  const el = $(id);
  el.value = ats.cab[ruta] || '';
  el.addEventListener('input', () => { ats.cab[ruta] = el.value; guardar(); });
}
function cargarCamposCab() {
  [['centroOtro', 'centroOtro'], ['fDesde', 'desde'], ['fHasta', 'hasta'], ['hDesde', 'horaDesde'], ['hHasta', 'horaHasta'],
   ['fArea', 'area'], ['fTrabajo', 'trabajo'], ['eppOtro', 'eppOtro'], ['herrOtro', 'herrOtro'], ['permisoOtro', 'permisoOtro'], ['emergOtro', 'emergOtro'], ['ambOtro', 'ambOtro']]
    .forEach(([id, r]) => { $(id).value = ats.cab[r] || ''; });
}
[['centroOtro', 'centroOtro'], ['fDesde', 'desde'], ['fHasta', 'hasta'], ['hDesde', 'horaDesde'], ['hHasta', 'horaHasta'],
 ['fArea', 'area'], ['fTrabajo', 'trabajo'], ['eppOtro', 'eppOtro'], ['herrOtro', 'herrOtro'], ['permisoOtro', 'permisoOtro'], ['emergOtro', 'emergOtro'], ['ambOtro', 'ambOtro']]
  .forEach(([id, r]) => $(id).addEventListener('input', () => { ats.cab[r] = $(id).value; guardar(); }));

/* Peligros de todas las tareas guardadas (para sugerir EPP, emergencia y permisos). */
function peligrosDelAts() {
  const set = new Set();
  ats.tareas.forEach((t) => t.peligros.forEach((p) => set.add(p.id)));
  return set;
}
/* Qué tarea pide cada sugerencia, para mostrar el porqué. */
function sugerenciasDe(campo) {
  const out = {};
  ats.tareas.forEach((t, i) => t.peligros.forEach((pi) => (pelDe(pi)[campo] || []).forEach((x) => {
    (out[x] = out[x] || new Set()).add(pelDe(pi).sub);
  })));
  return out;
}
function bloqueSugeridos(cont, titulo, faltantes, alAgregar, alAgregarTodos) {
  cont.innerHTML = '';
  if (!faltantes.length) return;
  const d = document.createElement('div');
  d.className = 'sugeridos';
  d.innerHTML = '<span class="etq">' + esc(titulo) + '</span><div class="fichas"></div>';
  const f = d.querySelector('.fichas');
  faltantes.forEach((x) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ficha sug';
    b.innerHTML = esc(x.nombre) + (x.pista ? '<span class="pista">' + esc(x.pista) + '</span>' : '');
    b.addEventListener('click', () => alAgregar(x.id));
    f.appendChild(b);
  });
  if (faltantes.length > 1) {
    const t = document.createElement('button');
    t.type = 'button'; t.className = 'btn-mini'; t.textContent = 'Agregar todos';
    t.addEventListener('click', alAgregarTodos);
    d.appendChild(t);
  }
  cont.appendChild(d);
}
function renderEpp() {
  const c = ats.cab;
  fichas($('fEpp'), EPP, c.epp, (id, on) => {
    if (!on && !c.eppDescartados.includes(id)) c.eppDescartados.push(id);
    if (on) c.eppDescartados = c.eppDescartados.filter((x) => x !== id);
    renderEpp(); guardar();
  });
  const porque = sugerenciasDe('epp');
  const falt = Object.keys(porque).filter((id) => !c.epp.includes(id)).map((id) => ({ id, nombre: EPP.find((e) => e.id === id).nombre, pista: 'por: ' + Array.from(porque[id]).slice(0, 2).join(', ') }));
  bloqueSugeridos($('sugEpp'), 'Sugeridos por los peligros de las tareas', falt,
    (id) => { c.epp.push(id); c.eppDescartados = c.eppDescartados.filter((x) => x !== id); renderEpp(); guardar(); },
    () => { falt.forEach((x) => c.epp.push(x.id)); c.eppDescartados = []; renderEpp(); guardar(); });
  $('cuentaEpp').textContent = '(' + (c.epp.length + (c.eppOtro ? 1 : 0)) + ')';
}
const herrAbiertos = new Set();   // grupos desplegados (se recuerdan al repintar)
function renderHerr() {
  const c = ats.cab;
  c.herrOtros = c.herrOtros || {};
  const cont = $('fHerr');
  cont.innerHTML = '';
  HERRAMIENTAS.forEach((g) => {
    const n = g.items.filter((x) => c.herr.includes(x)).length + ((c.herrOtros[g.grupo] || '').trim() ? 1 : 0);
    const d = document.createElement('details');
    d.className = 'herr-grupo';
    d.open = herrAbiertos.has(g.grupo);
    d.innerHTML = '<summary><span>' + esc(g.grupo) + '</span><small>' + (n ? n + ' marcada' + (n > 1 ? 's' : '') : '') + '</small></summary>' +
      '<div class="cuerpo"><div class="fichas"></div><input type="text" class="inp" placeholder="✏️ Otra en ' + esc(g.grupo.toLowerCase()) + '…"></div>';
    d.addEventListener('toggle', () => { if (d.open) herrAbiertos.add(g.grupo); else herrAbiertos.delete(g.grupo); });
    fichas(d.querySelector('.fichas'), g.items.map((x) => ({ id: x, nombre: x })), c.herr, () => { herrAbiertos.add(g.grupo); renderHerr(); guardar(); });
    const inO = d.querySelector('input');
    inO.value = c.herrOtros[g.grupo] || '';
    inO.addEventListener('input', () => {
      c.herrOtros[g.grupo] = inO.value;
      const k = g.items.filter((x) => c.herr.includes(x)).length + (inO.value.trim() ? 1 : 0);
      d.querySelector('summary small').textContent = k ? k + ' marcada' + (k > 1 ? 's' : '') : '';
      contarHerr(); guardar();
    });
    cont.appendChild(d);
  });
  const sug = new Set();
  ats.tareas.forEach((t) => ((TAR[t.plantilla] && TAR[t.plantilla].herr) || []).forEach((h) => sug.add(h)));
  if (ats.tareas.some((t) => t.peligros.some((p) => p.id === 'tec_caliente'))) ['Extintor multipropósito', 'Manta ignífuga'].forEach((h) => sug.add(h));
  if (ats.tareas.some((t) => t.peligros.some((p) => p.id === 'alturas' || p.id === 'loc_objetos'))) sug.add('Cinta y conos de delimitación');
  const falt = Array.from(sug).filter((h) => !c.herr.includes(h)).map((h) => ({ id: h, nombre: h }));
  bloqueSugeridos($('sugHerr'), 'Sugeridas por las tareas', falt,
    (id) => { c.herr.push(id); renderHerr(); guardar(); },
    () => { falt.forEach((x) => c.herr.push(x.id)); renderHerr(); guardar(); });
  contarHerr();
}
function contarHerr() {
  const c = ats.cab;
  const nHerr = c.herr.length + (c.herrOtro && c.herrOtro.trim() ? 1 : 0) + Object.values(c.herrOtros || {}).filter((v) => v && v.trim()).length;
  $('cuentaHerr').textContent = nHerr ? '(' + nHerr + ')' : '';
}
function renderEmerg() {
  const c = ats.cab;
  fichas($('fEmerg'), EMERGENCIA, c.emergencia, (id, on) => {
    if (!on && !c.emergDescartados.includes(id)) c.emergDescartados.push(id);
    renderEmerg(); guardar();
  });
  const porque = sugerenciasDe('emergencia');
  const falt = Object.keys(porque).filter((id) => !c.emergencia.includes(id)).map((id) => ({ id, nombre: EMERGENCIA.find((e) => e.id === id).nombre, pista: 'por: ' + Array.from(porque[id]).join(', ') }));
  bloqueSugeridos($('sugEmerg'), 'Sugeridos por los peligros de las tareas', falt,
    (id) => { c.emergencia.push(id); renderEmerg(); guardar(); },
    () => { falt.forEach((x) => c.emergencia.push(x.id)); renderEmerg(); guardar(); });
}
function renderAmb() {
  fichas($('fAmb'), AMBIENTAL, ats.cab.ambiental, () => { renderAmb(); guardar(); });
}
/* Si las tareas tienen trabajo en alturas, caliente, confinado o izaje y el
   permiso no está marcado arriba, se avisa (no se marca solo: es una
   decisión de quien firma el ATS). */
function renderAlertaPermisos() {
  const cont = $('alertaPermisos');
  const pel = peligrosDelAts();
  const faltan = PERMISOS.filter((p) => p.peligros.some((x) => pel.has(x) && ['tec_caliente', 'alturas', 'confinados', 'mec_izaje'].includes(x)) && !ats.cab.permisos.includes(p.id));
  if (!faltan.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = '<div class="alerta">⚠️ Las tareas incluyen <b>' + faltan.map((p) => esc(p.nombre.toLowerCase())).join(', ') +
    '</b> pero ese permiso no está marcado. <button type="button" class="btn-mini" id="btnMarcarPermisos">Marcar</button></div>';
  $('btnMarcarPermisos').addEventListener('click', () => {
    ats.cab.requiere = 'SI';
    faltan.forEach((p) => ats.cab.permisos.push(p.id));
    renderCab(); renderAlertaPermisos(); guardar();
  });
}

/* ================= TAREAS: LISTA ================= */
function resumenTarea(t) {
  const nCtrl = t.rescate ? t.rescatePasos.filter((x) => x.on).length
    : t.peligros.reduce((a, p) => a + p.ctrls.filter((c) => c.on).length + (p.extra || []).length, 0);
  return t.peligros.length + (t.peligros.length === 1 ? ' peligro' : ' peligros') + ' · ' + nCtrl + (t.rescate ? ' pasos de atención' : ' controles');
}
function renderTareas() {
  const cont = $('listaTareas');
  cont.innerHTML = '';
  $('cuentaTareas').textContent = ats.tareas.length ? '(' + ats.tareas.length + (ats.tareas.length === 1 ? ' tarea)' : ' tareas)') : '';
  ats.tareas.forEach((t, i) => {
    if (editando && editando.uid === t.uid) return; // se está editando abajo
    const clases = Array.from(new Set(t.peligros.map((p) => claseDe(p))));
    const d = document.createElement('div');
    d.className = 'tarea-card';
    d.innerHTML =
      '<div class="t-cab"><span class="t-num">' + (i + 1) + '</span><div class="t-titulo">' + esc(t.titulo || '(sin nombre)') +
      '<div class="t-resumen">' + resumenTarea(t) + '</div><div class="t-clases">' + clases.map((c) => '<span>' + esc(c) + '</span>').join('') + '</div>' +
      (t.agregadaDespues ? '<span class="t-despues">Agregada después de firmado · ' + esc(fechaHora(t.agregadaDespues)) + '</span>' : '') + '</div></div>' +
      '<div class="t-acciones"><button type="button" class="editar">✏️ Revisar / editar</button>' +
      (i > 0 ? '<button type="button" data-a="subir" aria-label="Subir">↑</button>' : '') +
      (i < ats.tareas.length - 1 ? '<button type="button" data-a="bajar" aria-label="Bajar">↓</button>' : '') +
      '<button type="button" data-a="duplicar">Duplicar</button><button type="button" data-a="despues">+ Tarea después</button><button type="button" class="quitar" data-a="quitar">Quitar</button></div>';
    d.querySelector('.editar').addEventListener('click', () => abrirEditor(JSON.parse(JSON.stringify(t))));
    d.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.a;
      if (a === 'despues') { abrirEditor(tareaVacia(), i + 1); return; }
      if (a === 'subir') { ats.tareas.splice(i - 1, 0, ats.tareas.splice(i, 1)[0]); }
      else if (a === 'bajar') { ats.tareas.splice(i + 1, 0, ats.tareas.splice(i, 1)[0]); }
      else if (a === 'duplicar') { const c = JSON.parse(JSON.stringify(t)); c.uid = uid(); ats.tareas.splice(i + 1, 0, c); toast('Tarea duplicada: cámbiale el nombre a la copia.'); }
      else if (a === 'quitar') { if (!await Dialogo.confirmar('¿Quitar la tarea "' + (t.titulo || '') + '"?')) return; ats.tareas.splice(i, 1); }
      renderTodoTareas(); guardar();
    }));
    cont.appendChild(d);
  });
  if (!ats.tareas.length && !editando) {
    cont.innerHTML = '<div class="vacio">Todavía no hay tareas.<br>Empieza con las tareas de inicio que llevan todos los ATS, y después agrega las del trabajo.</div>';
  }
  const acc = $('accionesTareas');
  acc.innerHTML = '';
  if (editando) return;
  if (!ats.tareas.length) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn';
    b.textContent = 'Agregar las 3 tareas de inicio';
    b.addEventListener('click', () => {
      TAREAS.filter((t) => t.inicio).sort((a, b) => a.inicio - b.inicio).forEach((t) => ats.tareas.push(tareaDesdePlantilla(t.id)));
      ultimaGuardada = ats.tareas[ats.tareas.length - 1];
      aplicarSugerenciasCab(); renderTodoTareas(); guardar();
      toast('Se agregaron inspección, pausas y charla, y divulgación del ATS.');
    });
    acc.appendChild(b);
  }
  const n = document.createElement('button');
  n.type = 'button'; n.className = 'btn' + (ats.tareas.length ? '' : ' sec');
  n.textContent = '+ Agregar tarea';
  n.addEventListener('click', () => abrirEditor(tareaVacia()));
  acc.appendChild(n);
  const r = document.createElement('button');
  r.type = 'button'; r.className = 'btn sec';
  r.textContent = '+ Plan de rescate';
  r.title = 'Fila con los pasos de atención de emergencias, como en el ATS del tanque de 20.000 L';
  if (!ats.tareas.some((t) => t.rescate)) {
    r.addEventListener('click', () => { ats.tareas.push(tareaRescate()); renderTodoTareas(); guardar(); });
    acc.appendChild(r);
  }
}
/* "¿Qué sigue?": después de guardar una tarea se sugieren las que suelen
   venir a continuación, y siempre se recuerda cerrar con orden y aseo. */
function renderQueSigue() {
  const cont = $('queSigue');
  cont.innerHTML = '';
  if (editando || !ats.tareas.length) return;
  const ult = ultimaGuardada || ats.tareas[ats.tareas.length - 1];
  const yaEstan = new Set(ats.tareas.map((t) => t.plantilla));
  let ids = ((TAR[ult.plantilla] && TAR[ult.plantilla].siguiente) || []).filter((x) => !yaEstan.has(x) || ['soldadura', 'desbaste', 'corte', 'tintas'].includes(x));
  if (!yaEstan.has('orden') && !ids.includes('orden')) ids.push('orden');
  ids = ids.slice(0, 6);
  if (!ids.length) return;
  const d = document.createElement('div');
  d.className = 'que-sigue';
  d.innerHTML = '<span class="etq">¿Qué sigue después de «' + esc((ult.titulo || '').slice(0, 60)) + (ult.titulo && ult.titulo.length > 60 ? '…' : '') + '»?</span><div class="fichas"></div>';
  const f = d.querySelector('.fichas');
  ids.forEach((id) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ficha sug';
    b.textContent = TAR[id].nombre;
    b.addEventListener('click', () => abrirEditor(tareaDesdePlantilla(id)));
    f.appendChild(b);
  });
  cont.appendChild(d);
}
function renderTodoTareas() {
  renderTareas(); renderEditor(); renderQueSigue(); renderAlertaPermisos();
  renderEpp(); renderHerr(); renderEmerg();
}

/* Al guardar una tarea, el EPP y los equipos de emergencia que exigen sus
   peligros se agregan solos al encabezado (salvo que alguien los haya
   quitado a propósito). Las herramientas solo se sugieren. */
function aplicarSugerenciasCab() {
  const c = ats.cab;
  const agregados = [];
  Object.keys(sugerenciasDe('epp')).forEach((id) => {
    if (!c.epp.includes(id) && !c.eppDescartados.includes(id)) { c.epp.push(id); agregados.push(EPP.find((e) => e.id === id).nombre); }
  });
  Object.keys(sugerenciasDe('emergencia')).forEach((id) => {
    if (!c.emergencia.includes(id) && !c.emergDescartados.includes(id)) { c.emergencia.push(id); agregados.push(EMERGENCIA.find((e) => e.id === id).nombre); }
  });
  return agregados;
}

/* ================= TAREAS: EDITOR ================= */
/* Dónde queda una tarea nueva: si ya está "Orden y aseo" (la de cierre), la
   nueva va antes de ella; si no, al final. Así una tarea olvidada no queda
   después del cierre. Se puede cambiar en el editor. */
function posicionPorDefecto(t) {
  if (TAR[t.plantilla] && TAR[t.plantilla].fin) return ats.tareas.length;
  const i = ats.tareas.findIndex((x) => TAR[x.plantilla] && TAR[x.plantilla].fin);
  return i === -1 ? ats.tareas.length : i;
}
/* Hay firmas en el ATS: lo que se agregue ahora se marca como agregado
   después, para que se socialice con quienes ya firmaron. */
function atsYaFirmado() {
  return ats.participantes.some((p) => p.firma) || ['lider', 'jefe', 'sst'].some((k) => ats.firmas[k] && ats.firmas[k].firma);
}
async function abrirEditor(t, pos) {
  if (ats.estado === 'CERRADO') { await Dialogo.avisar('Este ATS está cerrado: ya no se le pueden agregar ni cambiar tareas. Puedes copiarlo como un ATS nuevo.'); return; }
  const esNueva = !ats.tareas.some((x) => x.uid === t.uid);
  if (esNueva && t._pos == null) t._pos = pos != null ? pos : posicionPorDefecto(t);
  editando = t;
  renderTodoTareas();
  requestAnimationFrame(() => $('editorTarea').scrollIntoView({ block: 'start', behavior: 'smooth' }));
}
function cerrarEditor() {
  editando = null;
  renderTodoTareas();
}
function aplicarPlantilla(tid) {
  const nueva = tareaDesdePlantilla(tid);
  nueva.uid = editando.uid;
  editando = nueva;
  renderEditor();
}
function agregarPeligro(id, abierto) {
  if (editando.peligros.some((p) => p.id === id)) return;
  const pi = instanciaPeligro(id);
  pi.abierto = !!abierto;
  editando.peligros.push(pi);
  (PEL[id].generales || []).forEach((g) => { if (!editando.generales.includes(g)) editando.generales.push(g); });
}
function renderEditor() {
  const cont = $('editorTarea');
  cont.innerHTML = '';
  if (!editando) return;
  const t = editando;
  const esNueva = !ats.tareas.some((x) => x.uid === t.uid);
  const ed = document.createElement('div');
  ed.className = 'editor';
  ed.innerHTML = '<h3>' + (esNueva ? 'Nueva tarea (#' + ((t._pos != null ? t._pos : ats.tareas.length) + 1) + ')' : 'Editar tarea') + '</h3>';
  if (esNueva && ats.tareas.length) {
    const pos = document.createElement('div');
    pos.className = 'pos-tarea';
    pos.innerHTML = '<span class="etq">¿Dónde va esta tarea?</span><select id="edPos"></select>' +
      (atsYaFirmado() ? '<p class="ayuda" style="margin:6px 0 0;">⚠️ Este ATS ya tiene firmas: la tarea quedará marcada como <b>agregada después</b>. Socialízala con el personal que ya firmó.</p>' : '');
    const sel = pos.querySelector('select');
    sel.innerHTML = ats.tareas.map((x, i) => '<option value="' + i + '">Antes de ' + (i + 1) + '. ' + esc((x.titulo || '').slice(0, 55)) + '</option>').join('') +
      '<option value="' + ats.tareas.length + '">Al final (después de ' + ats.tareas.length + '. ' + esc((ats.tareas[ats.tareas.length - 1].titulo || '').slice(0, 40)) + ')</option>';
    sel.value = String(t._pos != null ? t._pos : ats.tareas.length);
    sel.addEventListener('change', () => { t._pos = +sel.value; ed.querySelector('h3').textContent = 'Nueva tarea (#' + (t._pos + 1) + ')'; });
    ed.appendChild(pos);
  }

  /* Paso 1: qué se va a hacer */
  const p1 = document.createElement('div');
  p1.className = 'paso-ed';
  p1.innerHTML = '<span class="etq"><b>1</b>¿Qué se va a hacer?</span>' +
    '<input type="text" class="inp" id="edTitulo" placeholder="Escribe la tarea: ej. soldadura de soportes en altura" autocomplete="off">' +
    '<div class="plantillas-sug" id="edPlantillas"></div>' +
    '<details class="todas-tareas" id="edTodas"><summary>📋 Ver todas las tareas tipo (' + TAREAS.length + ')</summary><div class="sug-vivo"></div></details>' +
    '<span class="etq u-mt10">Descripción</span><textarea class="inp area" id="edDesc" placeholder="Cómo se hace, con qué equipos, dónde…"></textarea>';
  ed.appendChild(p1);
  const inT = p1.querySelector('#edTitulo'), inD = p1.querySelector('#edDesc');
  inT.value = t.titulo; inD.value = t.desc;
  const usarPlantilla = (tar) => {
    const titulo = inT.value.trim();
    const pos = t._pos, conds = t.conds.slice(), condOtro = t.condOtro;
    aplicarPlantilla(tar.id);
    // Se conserva dónde va la tarea y las condiciones ya marcadas.
    editando._pos = pos; editando.condOtro = condOtro;
    conds.forEach((cid) => { if (!editando.conds.includes(cid)) { editando.conds.push(cid); const o = CONDICIONES.find((c) => c.id === cid); if (o) o.peligros.forEach((x) => agregarPeligro(x)); } });
    // Si ya habían escrito un nombre propio (ej. "CN-096 Fabricación de ductos"),
    // se conserva: la plantilla solo trae peligros, controles y descripción.
    if (titulo && norm(titulo) !== norm(tar.nombre) && titulo.length > 12) editando.titulo = titulo;
    renderEditor();
    toast('Se trajeron ' + editando.peligros.length + ' peligros con sus controles. Revisa las condiciones y los controles.');
  };
  const filaTarea = (tar) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = esc(tar.nombre) + '<small>' + esc(tar.peligros.length + ' peligros · ' + (tar.desc || '').slice(0, 90) + ((tar.desc || '').length > 90 ? '…' : '')) + '</small>';
    b.addEventListener('click', () => usarPlantilla(tar));
    return b;
  };
  // Todas las tareas tipo, para quien no sabe qué escribir.
  const todas = p1.querySelector('#edTodas .sug-vivo');
  TAREAS.forEach((tar) => todas.appendChild(filaTarea(tar)));
  const pintarPlantillas = () => {
    const c = p1.querySelector('#edPlantillas');
    const txt = inT.value + ' ' + inD.value;
    let lista = plantillasPorTexto(txt, 6);
    let rotulo = '💡 Tareas parecidas: toca una para traer sus peligros y controles';
    if (!lista.length && !inT.value.trim()) {
      const antes = t._pos != null && t._pos > 0 ? ats.tareas[t._pos - 1] : ats.tareas[ats.tareas.length - 1];
      const sig = antes && TAR[antes.plantilla] ? TAR[antes.plantilla].siguiente || [] : [];
      lista = (sig.length ? sig : ['fabricacion', 'soldadura', 'traslado_manual', 'andamio', 'izaje', 'valvulas']).map((id) => TAR[id]).filter(Boolean);
      rotulo = sig.length ? '💡 Suele seguir después de «' + (antes.titulo || '').slice(0, 40) + '»' : '💡 Tareas frecuentes';
    }
    c.innerHTML = '';
    if (t.plantilla && t.plantilla !== 'rescate' && lista.every((x) => x.id === t.plantilla)) return;
    if (!lista.length) {
      if (inT.value.trim().length >= 3) c.innerHTML = '<p class="ayuda" style="margin:6px 0 0;">No hay una tarea tipo parecida: sigue con las condiciones (paso 2) y los peligros sugeridos (paso 3), o mira todas las tareas tipo.</p>';
      return;
    }
    const caja = document.createElement('div');
    caja.className = 'sug-vivo';
    caja.innerHTML = '<span class="rot">' + esc(rotulo) + '</span>';
    lista.forEach((tar) => caja.appendChild(filaTarea(tar)));
    c.appendChild(caja);
  };
  const alEscribir = () => { t.titulo = inT.value; t.desc = inD.value; pintarPlantillas(); pintarDetectados(); pintarConds(); };
  inT.addEventListener('input', alEscribir);
  inD.addEventListener('input', alEscribir);

  /* Paso 2: condiciones */
  const p2 = document.createElement('div');
  p2.className = 'paso-ed';
  p2.innerHTML = '<span class="etq"><b>2</b>¿En qué condiciones se hace?</span>' +
    '<p class="ayuda" style="margin:0 0 6px;">Marca todas las que apliquen: cada una agrega sus peligros. Las de borde amarillo son sugeridas.</p>' +
    '<div class="fichas" id="edConds"></div>' +
    '<input type="text" class="inp libre" id="edCondOtro" placeholder="✏️ ¿Qué otra condición? Escríbela aquí…" hidden>';
  ed.appendChild(p2);
  const inCO = p2.querySelector('#edCondOtro');
  inCO.value = t.condOtro || '';
  inCO.addEventListener('input', () => { t.condOtro = inCO.value; });
  const pintarConds = () => {
    const sug = condicionesSugeridas(t);
    const opciones = CONDICIONES.map((c) => {
      const porPermiso = c.permiso && ats.cab.permisos.includes(c.permiso) && !t.conds.includes(c.id);
      return { id: c.id, nombre: c.nombre, marca: porPermiso || !!sug[c.id],
        pista: porPermiso ? 'el ATS tiene este permiso' : (sug[c.id] ? 'sugerida ' + sug[c.id] : '') };
    }).concat([{ id: 'otra', nombre: 'Otra (escribir)' }]);
    inCO.hidden = !t.conds.includes('otra');
    fichas(p2.querySelector('#edConds'), opciones, t.conds, (id, on) => {
      if (id === 'otra') { pintarConds(); if (on) inCO.focus(); return; }
      const cnd = CONDICIONES.find((c) => c.id === id);
      if (on) cnd.peligros.forEach((pid) => agregarPeligro(pid));
      else {
        // Quitar solo los peligros que vinieron por esta condición y que no
        // son propios de la tarea tipo ni de otra condición marcada.
        const base = new Set((TAR[t.plantilla] && TAR[t.plantilla].peligros) || []);
        t.conds.forEach((cid) => { const o = CONDICIONES.find((c) => c.id === cid); if (o) o.peligros.forEach((x) => base.add(x)); });
        t.peligros = t.peligros.filter((p) => base.has(p.id) || !cnd.peligros.includes(p.id));
      }
      renderEditor();
    });
  };
  pintarConds();

  /* Paso 3: peligros y controles */
  const p3 = document.createElement('div');
  p3.className = 'paso-ed';
  p3.innerHTML = '<span class="etq"><b>3</b>Peligros (GTC 45) y medidas de control</span><div id="edDetectados"></div><div id="edPeligros"></div><div id="edMas"></div>';
  ed.appendChild(p3);
  const pintarDetectados = () => {
    const c = p3.querySelector('#edDetectados');
    const det = peligrosDetectados(inT.value + ' ' + inD.value).filter((id) => !t.peligros.some((p) => p.id === id));
    c.innerHTML = '';
    if (!det.length) return;
    const d = document.createElement('div');
    d.className = 'sugeridos';
    d.innerHTML = '<span class="etq">Sugeridos por lo que escribiste</span><div class="fichas"></div>';
    det.forEach((id) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ficha sug';
      b.innerHTML = esc(CLASE[PEL[id].clase].nombre + ' · ' + PEL[id].sub) + '<span class="pista">' + esc(PEL[id].texto.slice(0, 70)) + '</span>';
      b.addEventListener('click', () => { agregarPeligro(id); renderEditor(); });
      d.querySelector('.fichas').appendChild(b);
    });
    if (det.length > 1) {
      const all = document.createElement('button');
      all.type = 'button'; all.className = 'btn-mini'; all.textContent = 'Agregar todos (' + det.length + ')';
      all.addEventListener('click', () => { det.forEach((id) => agregarPeligro(id)); renderEditor(); });
      d.appendChild(all);
    }
    c.appendChild(d);
  };
  const pintarPeligros = () => {
    const c = p3.querySelector('#edPeligros');
    c.innerHTML = '';
    if (!t.peligros.length) {
      c.innerHTML = '<p class="ayuda" style="margin:8px 0 0;">Aún no hay peligros. Escoge una tarea parecida arriba, toca las sugerencias o agrégalos desde la lista de la GTC 45.</p>';
    }
    // Ordenados por clase de la GTC 45, como se leen en la tabla.
    const ordenClase = Object.fromEntries(CLASES_GTC45.map((x, i) => [x.id, i]));
    t.peligros.forEach((pi) => {
      const p = pelDe(pi);
      const card = document.createElement('div');
      card.className = 'pel-card' + (pi.abierto ? ' abierto' : '');
      const nOn = pi.ctrls.filter((x) => x.on).length + (pi.extra || []).length;
      card.innerHTML =
        '<div class="pel-cab"><span class="pel-txt"><span class="pel-clase">' + esc(claseDe(pi) + ' · ' + p.sub) + '</span>' +
        '<span class="pel-desc">' + esc(pi.texto) + '</span>' +
        '<span class="pel-conteo' + (nOn ? '' : ' cero') + '">' + (nOn ? '✓ ' + nOn + ' controles · toca para revisar' : '⚠️ Sin controles marcados') + '</span></span>' +
        '<button type="button" class="pel-quitar" aria-label="Quitar peligro">✕</button></div>' +
        '<div class="pel-cuerpo">' +
        '<span class="etq">Peligro (así se imprime)</span><textarea class="inp area" data-f="texto"></textarea>' +
        '<span class="etq u-mt8">Consecuencia</span><textarea class="inp area" data-f="efectos"></textarea>' +
        '<span class="etq u-mt10">Controles (marca los que aplican; en cada tipo puedes escribir otro)</span>' +
        '<div class="ctrls"></div>' +
        '</div>';
      card.querySelector('.pel-cab').addEventListener('click', (e) => {
        if (e.target.closest('.pel-quitar')) return;
        pi.abierto = !pi.abierto;
        card.classList.toggle('abierto', pi.abierto);
      });
      card.querySelector('.pel-quitar').addEventListener('click', () => {
        t.peligros = t.peligros.filter((x) => x !== pi);
        renderEditor();
      });
      card.querySelectorAll('textarea[data-f]').forEach((ta) => {
        ta.value = pi[ta.dataset.f];
        ta.addEventListener('input', () => { pi[ta.dataset.f] = ta.value; });
      });
      const cc = card.querySelector('.ctrls');
      // Los 5 tipos de control (jerarquía) siempre visibles: los del ATS,
      // los adicionales del catálogo sin marcar, y un campo para escribir otro.
      Object.keys(JERARQUIA).sort((a, b) => JERARQUIA[a].orden - JERARQUIA[b].orden).forEach((j) => {
        const lista = pi.ctrls.filter((x) => x.j === j);
        const tiene = new Set(pi.ctrls.map((x) => norm(x.t)));
        const disp = controlesCatalogo(pi.id).filter(([tx, jj]) => jj === j && !tiene.has(norm(tx)));
        const g = document.createElement('div');
        g.className = 'j-grupo';
        g.innerHTML = '<span class="j-badge j-' + j + '">' + esc(JERARQUIA[j].nombre) + '</span>';
        lista.forEach((ct) => {
          const l = document.createElement('label');
          l.className = 'ctrl' + (ct.propio ? ' propio' : '');
          l.innerHTML = '<input type="checkbox"' + (ct.on ? ' checked' : '') + '><span>' + esc(ct.t) + '</span>';
          l.querySelector('input').addEventListener('change', (e) => {
            if (ct.propio && !e.target.checked) { pi.ctrls = pi.ctrls.filter((x) => x !== ct); renderEditor(); return; }
            ct.on = e.target.checked; actualizarConteo();
          });
          g.appendChild(l);
        });
        disp.forEach(([tx]) => {
          const l = document.createElement('label');
          l.className = 'ctrl opcional';
          l.innerHTML = '<input type="checkbox"><span>' + esc(tx) + '</span>';
          l.querySelector('input').addEventListener('change', (e) => {
            if (!e.target.checked) return;
            pi.ctrls.push({ t: tx, j, on: true }); pi.abierto = true; renderEditor();
          });
          g.appendChild(l);
        });
        if (!lista.length && !disp.length) g.insertAdjacentHTML('beforeend', '<p class="j-vacio">Sin controles de este tipo para este peligro.</p>');
        const otro = document.createElement('div');
        otro.className = 'j-otro';
        otro.innerHTML = '<input type="text" class="inp" placeholder="✏️ Otro control…" aria-label="Otro control de ' + esc(JERARQUIA[j].nombre.toLowerCase()) + '"><button type="button" class="btn-mini">+ Agregar</button>';
        const inO = otro.querySelector('input');
        const agregarOtro = () => {
          const v = inO.value.trim();
          if (!v) { inO.focus(); return; }
          pi.ctrls.push({ t: v, j, on: true, propio: true }); pi.abierto = true; renderEditor();
        };
        otro.querySelector('button').addEventListener('click', agregarOtro);
        inO.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarOtro(); } });
        g.appendChild(otro);
        cc.appendChild(g);
      });
      if ((pi.extra || []).length) {
        const g = document.createElement('div');
        g.className = 'j-grupo';
        g.innerHTML = '<span class="j-badge j-A">Agregados en este ATS</span>';
        pi.extra.forEach((tx, k) => {
          const l = document.createElement('label');
          l.className = 'ctrl';
          l.innerHTML = '<input type="checkbox" checked><span>' + esc(tx) + '</span>';
          l.querySelector('input').addEventListener('change', () => { pi.extra.splice(k, 1); renderEditor(); });
          g.appendChild(l);
        });
        cc.appendChild(g);
      }
      function actualizarConteo() {
        const n = pi.ctrls.filter((x) => x.on).length + (pi.extra || []).length;
        const s = card.querySelector('.pel-conteo');
        s.textContent = n ? '✓ ' + n + ' controles · toca para revisar' : '⚠️ Sin controles marcados';
        s.classList.toggle('cero', !n);
      }
      card._orden = ordenClase[p.clase];
      c.appendChild(card);
    });
  };
  const pintarMas = () => {
    const c = p3.querySelector('#edMas');
    c.innerHTML = '<span class="etq u-mt12">Agregar otro peligro (tabla GTC 45)</span>';
    CLASES_GTC45.forEach((cl) => {
      const disp = PELIGROS.filter((p) => p.clase === cl.id && !t.peligros.some((x) => x.id === p.id));
      const det = document.createElement('details');
      det.className = 'gtc-clase';
      det.innerHTML = '<summary>' + esc(cl.nombre) + ' <small>(' + disp.length + ' disponibles)</small></summary><p>' + esc(cl.desc) + '</p><div class="fichas"></div>';
      disp.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ficha sug';
        b.innerHTML = esc(p.sub) + '<span class="pista">' + esc(p.texto.slice(0, 80)) + '</span>';
        b.addEventListener('click', () => { agregarPeligro(p.id, true); renderEditor(); });
        det.querySelector('.fichas').appendChild(b);
      });
      if (!disp.length) det.querySelector('.fichas').innerHTML = '<span class="ayuda u-m0">Ya están todos en la tarea.</span>';
      c.appendChild(det);
    });
  };

  /* Paso 3b: pasos de atención (solo plan de rescate) */
  let pRes = null;
  if (t.rescate) {
    pRes = document.createElement('div');
    pRes.className = 'paso-ed';
    pRes.innerHTML = '<span class="etq">Pasos de atención (van en la columna de medidas)</span>';
    t.rescatePasos.forEach((ps) => {
      const l = document.createElement('label');
      l.className = 'ctrl';
      l.innerHTML = '<input type="checkbox"' + (ps.on ? ' checked' : '') + '><span>' + esc(ps.t) + '</span>';
      l.querySelector('input').addEventListener('change', (e) => { ps.on = e.target.checked; });
      pRes.appendChild(l);
    });
  }

  /* Paso 4: generales y responsables */
  const p4 = document.createElement('div');
  p4.className = 'paso-ed';
  p4.innerHTML = '<span class="etq"><b>4</b>Controles generales</span><div class="fichas" id="edGen"></div>' +
    '<input type="text" class="inp libre" id="edGenOtro" placeholder="Otro control general…">' +
    '<span class="etq u-mt12">Responsable</span><div class="fichas" id="edResp"></div>';
  ed.appendChild(p4);
  const opcionesGen = Array.from(new Set(GENERALES_BASE.concat(GENERALES_EXTRA, t.generales))).map((g) => ({ id: g, nombre: g }));
  const pintarGen = () => fichas(p4.querySelector('#edGen'), opcionesGen, t.generales, pintarGen);
  pintarGen();
  const inGO = p4.querySelector('#edGenOtro');
  inGO.value = t.generalesOtro || '';
  inGO.addEventListener('input', () => { t.generalesOtro = inGO.value; });
  const pintarResp = () => fichas(p4.querySelector('#edResp'), RESPONSABLES.map((r) => ({ id: r, nombre: r })), t.responsables, pintarResp);
  pintarResp();

  if (pRes) ed.insertBefore(pRes, p4);

  /* Acciones */
  const acc = document.createElement('div');
  acc.className = 'ed-acciones';
  acc.innerHTML = '<button type="button" class="btn" id="edGuardar">Guardar tarea</button><button type="button" class="btn sec" id="edCancelar">Cancelar</button>';
  ed.appendChild(acc);
  acc.querySelector('#edCancelar').addEventListener('click', cerrarEditor);
  acc.querySelector('#edGuardar').addEventListener('click', async () => {
    t.titulo = inT.value.trim(); t.desc = inD.value.trim();
    if (!t.titulo) { await Dialogo.avisar('Escribe qué se va a hacer en esta tarea.'); inT.focus(); return; }
    if (!t.peligros.length) { await Dialogo.avisar('La tarea no tiene peligros. Agrega al menos uno.'); return; }
    const sinCtrl = t.peligros.filter((p) => !p.ctrls.some((c) => c.on) && !(p.extra || []).length);
    if (sinCtrl.length && !await Dialogo.confirmar('Hay ' + sinCtrl.length + ' peligro(s) sin ningún control marcado:\n\n• ' + sinCtrl.map((p) => pelDe(p).sub).join('\n• ') + '\n\n¿Guardar de todas formas?')) return;
    t.peligros.forEach((p) => { p.abierto = false; });
    if (!t.conds.includes('otra')) t.condOtro = '';
    const i = ats.tareas.findIndex((x) => x.uid === t.uid);
    let tardia = false;
    if (i === -1) {
      const pos = t._pos != null ? Math.max(0, Math.min(t._pos, ats.tareas.length)) : ats.tareas.length;
      delete t._pos;
      if (atsYaFirmado()) { t.agregadaDespues = new Date().toISOString(); tardia = true; }
      ats.tareas.splice(pos, 0, t);
    } else { delete t._pos; ats.tareas[i] = t; }
    ultimaGuardada = t;
    editando = null;
    const agregados = aplicarSugerenciasCab();
    renderTodoTareas(); guardar();
    toast((tardia ? 'Tarea agregada después de firmado: socialízala con el personal' + (ats.code ? ' y guarda (☁️) para subirla' : '') + '.' : 'Tarea guardada.') +
      (agregados.length ? ' Se agregó al encabezado: ' + agregados.join(', ') + '.' : ''));
    requestAnimationFrame(() => $('queSigue').scrollIntoView({ block: 'center', behavior: 'smooth' }));
  });

  cont.appendChild(ed);
  pintarPlantillas(); pintarDetectados(); pintarPeligros(); pintarMas();
}

/* ================= PERSONAL (autocompletar) ================= */
let personal = [];
let personalMotivo = '';
/* Si la base no carga, se dice por qué (igual que en los permisos): antes
   cualquier falla se tragaba en silencio y el buscador simplemente no
   sugería nada, sin forma de saber si era la señal, el token o config.js. */
async function cargarPersonal() {
  personalMotivo = '';
  try {
    if (typeof PORTAL_CONFIG === 'undefined' || !PORTAL_CONFIG.BACKENDS || !PORTAL_CONFIG.BACKENDS.personal) {
      personalMotivo = 'No se pudo leer la configuración del portal. Avisa al líder SST para que la revise.';
    } else {
      const r = await fetchWithRetry(PORTAL_CONFIG.BACKENDS.personal.url + '?action=listPersonal&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const t = await r.text();
      let d = null;
      try { d = JSON.parse(t); } catch (e) {
        personalMotivo = 'No se pudo cargar la lista de personal. Avisa al líder SST para que revise la conexión del portal (código ' + r.status + ').';
      }
      if (d && !d.ok) personalMotivo = 'La base de personal respondió: ' + String(d.error || 'error sin detalle').replace(/\.$/, '') + '.';
      else if (d && (!d.personal || !d.personal.length)) personalMotivo = 'La base de personal respondió bien, pero no trae ningún registro.';
      else if (d) personal = d.personal;
    }
  } catch (e) {
    personalMotivo = 'No se pudo contactar la base de personal (' + (e && e.message ? e.message : 'sin conexión') + ').';
  }
  avisarPersonal();
}
function avisarPersonal() {
  if (personal.length) { AvisoPersonal.ocultar(); return; }
  AvisoPersonal.mostrar(personalMotivo, cargarPersonal);
}
cargarPersonal();
// Si abrió sin señal, se reintenta sola al volver la conexión.
window.addEventListener('online', () => { if (!personal.length) cargarPersonal(); });
/* En la base el nombre viene completo; el formato pide nombres y apellidos
   aparte. En Colombia casi siempre son los dos últimos. */
function partirNombre(n) {
  const w = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (w.length >= 4) return [w.slice(0, w.length - 2).join(' '), w.slice(-2).join(' ')];
  if (w.length === 3) return [w[0], w.slice(1).join(' ')];
  if (w.length === 2) return [w[0], w[1]];
  return [w.join(' '), ''];
}
function autocompletar(input, alElegir) {
  let box = null;
  const cerrar = () => { if (box) { box.remove(); box = null; } };
  const abrir = () => {
    cerrar();
    const q = norm(input.value.trim());
    if (q.length < 2 || !personal.length) return;
    const m = personal.filter((p) => norm(p.nombre).includes(q)).slice(0, 6);
    if (!m.length) return;
    box = document.createElement('div');
    box.className = 'autocomplete-box';
    const r = input.getBoundingClientRect();
    Object.assign(box.style, { position: 'absolute', left: r.left + scrollX + 'px', top: r.bottom + scrollY + 2 + 'px', width: Math.max(r.width, 260) + 'px' });
    m.forEach((p) => {
      const it = document.createElement('div');
      it.className = 'autocomplete-item';
      it.innerHTML = '<b>' + esc(p.nombre) + '</b><span>CC ' + esc(p.cedula) + (p.cargo ? ' · ' + esc(p.cargo) : '') + '</span>';
      it.addEventListener('mousedown', (e) => { e.preventDefault(); alElegir(p); cerrar(); });
      box.appendChild(it);
    });
    document.body.appendChild(box);
  };
  input.addEventListener('input', abrir);
  input.addEventListener('blur', () => setTimeout(cerrar, 150));
  // No se cierra al desplazar la página: el cuadro va anclado al documento,
  // y en el celular abrir el teclado desplaza la pantalla justo cuando la
  // persona empieza a escribir — se cerraba antes de poder tocar un nombre.
}

/* ================= FIRMAS ================= */
const sigMgr = SignaturePad.createManager();
const lectoresFirma = [];
sigMgr.bindOrientationChange();
/* Conecta un lienzo con un objeto del estado: lo que se firma queda en
   obj.firma (acotado a lo que cabe en una celda, ver exportarFirmaAcotada). */
function conectarFirma(canvas, obj, alCambiar) {
  alCambiar = alCambiar || guardar;
  sigMgr.setup(canvas);
  const pad = sigMgr.pads[canvas.id];
  if (obj.firma) pad.setDataUrl(obj.firma);
  const leer = debounce(() => { obj.firma = pad.getDataUrl(); alCambiar(); }, 150);
  ['touchend', 'mouseup', 'input'].forEach((ev) => canvas.addEventListener(ev, leer));
  // Solo lienzos que siguen en pantalla: al redibujar la lista, uno viejo del
  // mismo participante podría revivir una firma que ya se borró.
  lectoresFirma.push(() => { if (document.body.contains(canvas)) obj.firma = pad.hasInk() ? pad.getDataUrl() : null; });
  return pad;
}
function bloqueFirma(id, obj, statusId) {
  const w = document.createElement('div');
  w.innerHTML = '<canvas class="mini-pad" id="' + id + '"></canvas><div class="sig-actions"><button type="button" data-b="undo">Deshacer</button><button type="button" data-b="clear">Borrar</button><span class="sig-status" id="' + statusId + '">Sin firmar</span></div>';
  return w;
}

const fechaHora = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; const p = (n) => String(n).padStart(2, '0'); return p(d.getDate()) + '-' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
/* Una persona: nombres (con búsqueda en la base), apellidos, cédula, cargo,
   firma y —si llegó después de guardado el ATS— la constancia de que se le
   socializó. La usan la lista normal y el modo "Agregar personal".
   opts: { titulo, alCambiar, alQuitar, cedulasExistentes } */
function filaPersona(p, opts) {
  const d = document.createElement('div');
  d.className = 'part' + (p.tardio ? ' tardio' : '');
  const cid = 'firma_' + p.uid;
  d.innerHTML = '<div class="part-num"><span>' + esc(opts.titulo) + (p.tardio ? ' <span class="tag-tardio">llegó después' + (p.ingreso ? ' · ' + esc(fechaHora(p.ingreso)) : '') + '</span>' : '') + '</span><button type="button">Quitar</button></div>' +
    '<div class="grid2"><input type="text" class="inp" data-f="nombres" placeholder="Nombres (escribe para buscar)" autocomplete="off"><input type="text" class="inp" data-f="apellidos" placeholder="Apellidos"></div>' +
    '<div class="grid2"><input type="text" class="inp" data-f="cedula" placeholder="Cédula" inputmode="numeric"><input type="text" class="inp" data-f="cargo" placeholder="Cargo"></div>' +
    '<div class="aviso-dup" hidden></div>';
  const fb = bloqueFirma(cid, p, 'status_' + cid);
  d.appendChild(fb);
  if (p.tardio) {
    const l = document.createElement('label');
    l.className = 'ctrl socializado';
    l.innerHTML = '<input type="checkbox"' + (p.socializado ? ' checked' : '') + '><span><b>Se le socializó este ATS</b> (tareas, peligros y controles) antes de firmar</span>';
    l.querySelector('input').addEventListener('change', (e) => { p.socializado = e.target.checked; opts.alCambiar(); });
    d.appendChild(l);
  }
  const revisarDup = () => {
    const av = d.querySelector('.aviso-dup');
    const c = String(p.cedula || '').trim();
    const dup = c && opts.cedulasExistentes && opts.cedulasExistentes().includes(c);
    av.hidden = !dup;
    av.textContent = dup ? '⚠️ Esta cédula ya está en el ATS: no hace falta agregarla de nuevo.' : '';
  };
  d.querySelectorAll('input[data-f]').forEach((inp) => {
    inp.value = p[inp.dataset.f] || '';
    inp.addEventListener('input', () => { p[inp.dataset.f] = inp.value; if (inp.dataset.f === 'cedula') revisarDup(); opts.alCambiar(); });
  });
  autocompletar(d.querySelector('[data-f=nombres]'), (per) => {
    const [n, a] = partirNombre(per.nombre);
    Object.assign(p, { nombres: n, apellidos: a, cedula: per.cedula || '', cargo: per.cargo || '' });
    d.querySelectorAll('input[data-f]').forEach((inp) => { inp.value = p[inp.dataset.f] || ''; });
    revisarDup(); opts.alCambiar();
  });
  d.querySelector('.part-num button').addEventListener('click', async () => {
    if ((p.nombres || p.firma) && !await Dialogo.confirmar('¿Quitar a ' + (p.nombres || 'esta persona') + '?')) return;
    opts.alQuitar();
  });
  // Se conecta la firma cuando la fila ya está en pantalla (necesita su tamaño).
  d._conectar = () => {
    const pad = conectarFirma(d.querySelector('canvas'), p, opts.alCambiar);
    fb.querySelector('[data-b=undo]').addEventListener('click', () => { pad.undo(); p.firma = pad.getDataUrl(); opts.alCambiar(); });
    fb.querySelector('[data-b=clear]').addEventListener('click', () => { pad.clear(); p.firma = null; opts.alCambiar(); });
    revisarDup();
  };
  return d;
}
function renderParticipantes() {
  const cont = $('listaPart');
  cont.innerHTML = '';
  // v158: semáforo de la cuadrilla antes de empezar
  setTimeout(() => { if (typeof Habilitacion === 'undefined' || !Habilitacion.semaforo) return; let box = $('semCuadrilla'); if (!box) { box = document.createElement('div'); box.id = 'semCuadrilla'; cont.parentNode.insertBefore(box, cont); }
    Habilitacion.cargar().then(() => Habilitacion.semaforo(box, ats.participantes.map((p) => ({ cc: p.cedula, nombre: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim() })), contextoHabAts(), ats.cab && ats.cab.fechaFin)).catch(() => {}); }, 0);
  ats.participantes.forEach((p, i) => {
    const d = filaPersona(p, {
      titulo: 'Participante ' + (i + 1),
      alCambiar: () => { guardar(); $('cuentaPart').textContent = '(' + ats.participantes.length + ')'; },
      alQuitar: () => { ats.participantes.splice(i, 1); renderParticipantes(); guardar(); },
      cedulasExistentes: () => ats.participantes.filter((x) => x !== p).map((x) => String(x.cedula || '').trim()).filter(Boolean)
    });
    cont.appendChild(d);
    d._conectar();
  });
  $('cuentaPart').textContent = ats.participantes.length ? '(' + ats.participantes.length + ')' : '';
  // Con el ATS ya guardado en el servidor, la gente que llega después se
  // agrega por el modo "Agregar personal": suma sin tocar el resto del ATS.
  $('btnModoAgregar').hidden = !(ats.code && urlAts());
}
$('btnAgregarPart').addEventListener('click', () => {
  // Si el ATS ya se guardó, quien se agrega ahora llegó después de la charla
  // inicial: queda marcado con la hora y debe constar que se le socializó.
  const tarde = !!ats.code;
  ats.participantes.push({ uid: uid(), nombres: '', apellidos: '', cedula: '', cargo: '', firma: null,
    tardio: tarde, socializado: false, ingreso: tarde ? new Date().toISOString() : null });
  renderParticipantes(); guardar();
  const ult = $('listaPart').lastElementChild;
  if (ult) { ult.scrollIntoView({ block: 'center', behavior: 'smooth' }); ult.querySelector('input').focus({ preventScroll: true }); }
});

function renderFirmasFin() {
  const cont = $('firmasFin');
  cont.innerHTML = '';
  [['lider', 'Responsable / líder ejecutante de la tarea'], ['jefe', 'Jefe de área'], ['sst', 'Seguridad industrial SSTA']].forEach(([k, rot]) => {
    const obj = ats.firmas[k];
    const d = document.createElement('div');
    d.innerHTML = '<span class="etq">' + esc(rot) + '</span><input type="text" class="inp u-mb8" placeholder="Nombre (escribe para buscar)" autocomplete="off">';
    const cid = 'firmaFin_' + k;
    const fb = bloqueFirma(cid, obj, 'status_' + cid);
    fb.querySelector('canvas').className = 'pad';
    d.appendChild(fb);
    const inp = d.querySelector('input');
    inp.value = obj.nombre || '';
    inp.addEventListener('input', () => { obj.nombre = inp.value; guardar(); });
    autocompletar(inp, (per) => { obj.nombre = per.nombre; inp.value = per.nombre; guardar(); });
    cont.appendChild(d);
    const pad = conectarFirma(d.querySelector('canvas'), obj);
    fb.querySelector('[data-b=undo]').addEventListener('click', () => { pad.undo(); obj.firma = pad.getDataUrl(); guardar(); });
    fb.querySelector('[data-b=clear]').addEventListener('click', () => { pad.clear(); obj.firma = null; guardar(); });
  });
}

/* ================= HOJA IMPRESA (forma del Excel) ================= */
const fechaCO = (iso) => { if (!iso) return ''; const [a, m, d] = iso.split('-'); return d + '-' + m + '-' + a; };
function textoCondiciones(t) {
  const out = (t.conds || []).map((id) => { const c = CONDICIONES.find((x) => x.id === id); return c ? c.nombre : ''; }).filter(Boolean);
  if ((t.conds || []).includes('otra') && t.condOtro && t.condOtro.trim()) out.push(t.condOtro.trim());
  return out.join(', ');
}
function textoPeligro(pi) { return claseDe(pi) + ': ' + pelDe(pi).sub + ': ' + pi.texto; }
function textoMedidas(t) {
  const gen = t.generales.slice();
  if (t.generalesOtro && t.generalesOtro.trim()) gen.push(t.generalesOtro.trim());
  let s = 'Generales:\n- ' + (gen.join(', ') || '—') + '.';
  if (t.rescate) {
    s += '\n' + t.rescatePasos.filter((x) => x.on).map((x, i) => (i + 1) + '. ' + x.t + '.').join('\n');
    return s;
  }
  s += '\nEspecíficos:\n' + t.peligros.map((pi, i) => {
    const ctrls = pi.ctrls.filter((c) => c.on).sort((a, b) => JERARQUIA[a.j].orden - JERARQUIA[b.j].orden).map((c) => c.t).concat(pi.extra || []);
    return (i + 1) + '. ' + (ctrls.length ? ctrls.join('. ') + '.' : '—');
  }).join('\n');
  return s;
}
function lista(ids, catalogo, otro) {
  const out = ids.map((id) => { const x = catalogo.find((e) => e.id === id); return x ? x.nombre : id; });
  if (otro && otro.trim()) out.push(otro.trim());
  return out.join(', ');
}
function herramientasTexto() {
  const c = ats.cab;
  const otros = c.herrOtros || {};
  const partes = HERRAMIENTAS.map((g) => {
    const it = g.items.filter((x) => c.herr.includes(x));
    if (otros[g.grupo] && otros[g.grupo].trim()) it.push(otros[g.grupo].trim());
    return it.length ? g.grupo + ': ' + it.join(', ') + '.' : '';
  }).filter(Boolean);
  const conocidas = new Set(HERRAMIENTAS.flatMap((g) => g.items));
  const sueltas = c.herr.filter((x) => !conocidas.has(x));
  if (sueltas.length) partes.push('Otras: ' + sueltas.join(', ') + '.');
  if (c.herrOtro && c.herrOtro.trim()) partes.push('Otras: ' + c.herrOtro.trim() + '.');
  return partes.join('\n');
}
const marca = (on) => (on ? '☒' : '☐');
function armarHoja() {
  const c = ats.cab;
  // QR del registro, como en los permisos: lleva al modo "Agregar personal"
  // de este ATS, donde se puede ver completo (para socializarlo) y sumar a
  // quien llegue, pero no modificar lo demás. Solo si ya está en el servidor.
  let qr = '';
  if (ats.code && typeof QR !== 'undefined') {
    try { qr = QR.comoImagen(enlaceAgregar(ats.code), { px: 240, margen: 4 }); } catch (e) { qr = ''; }
  }
  const centro = c.centro.concat(c.centroOtro && c.centroOtro.trim() ? [c.centroOtro.trim()] : []).join(', ');
  const fecha = fechaCO(c.desde) + (c.hasta ? ' al ' + fechaCO(c.hasta) : '');
  const horario = (c.horaDesde || '') + ' HASTA ' + (c.horaHasta || '');
  const permisoTxt = 'SI ' + marca(c.requiere === 'SI') + '    NO ' + marca(c.requiere === 'NO') + '    CUÁL?  ' +
    PERMISOS.map((p) => marca(c.permisos.includes(p.id)) + ' ' + p.nombre.toUpperCase()).join('   ') +
    '   ' + marca(c.permisos.includes('otro')) + ' OTRO: ' + (c.permisos.includes('otro') && c.permisoOtro && c.permisoOtro.trim() ? c.permisoOtro.trim().toUpperCase() : '________') +
    (permisosAsociadosDe(ats).length ? '\nPermisos diligenciados: ' + permisosAsociadosDe(ats).map((x) => x.code + ((PORTAL_CONFIG.BACKENDS[x.tipo] || {}).nombre ? ' (' + PORTAL_CONFIG.BACKENDS[x.tipo].nombre + ')' : '')).join(', ') : '');
  const img = (src) => (srcSeguro(src) ? '<img src="' + srcSeguro(src) + '" alt="firma">' : '');
  const filasPart = ats.participantes.map((p) => '<tr><td>' + esc(p.nombres) +
    (p.tardio ? '\n<span style="font-size:8px;">(ingresó ' + esc(fechaHora(p.ingreso)) + (p.socializado ? ' · ATS socializado' : ' · SIN constancia de socialización') + ')</span>' : '') + '</td><td>' + esc(p.apellidos) + '</td><td>' + esc(p.cedula) + '</td><td>' + esc(p.cargo) + '</td><td class="firma">' + img(p.firma) + '</td></tr>').join('');
  const vacias = Math.max(0, 4 - ats.participantes.length);
  const filasVacias = Array.from({ length: vacias }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td class="firma" style="height:26px;"></td></tr>').join('');
  const filasTareas = ats.tareas.map((t, i) =>
    '<tr><td class="paso"><b>' + (i + 1) + '.\n' + esc(t.titulo) + '</b>' + (t.desc ? '\n' + esc(t.desc) : '') +
    (textoCondiciones(t) ? '\n<i>Condiciones: ' + esc(textoCondiciones(t)) + '.</i>' : '') +
    (t.agregadaDespues ? '\n<span style="font-size:8px;">(Tarea agregada después de firmado el ATS: ' + esc(fechaHora(t.agregadaDespues)) + ')</span>' : '') + '</td>' +
    '<td>' + t.peligros.map((pi, k) => (k + 1) + '. ' + esc(textoPeligro(pi))).join('\n') + '</td>' +
    '<td>' + t.peligros.map((pi, k) => (k + 1) + '. ' + esc(pi.efectos)).join('\n') + '</td>' +
    '<td>' + esc(textoMedidas(t)) + '</td>' +
    '<td>' + esc(t.responsables.join('.\n') + (t.responsables.length ? '.' : '')) + '</td></tr>').join('');
  const F = ats.firmas;
  $('hoja').innerHTML =
    '<table class="cod"><colgroup><col style="width:18%"><col style="width:' + (qr ? 41 : 57) + '%"><col style="width:25%">' + (qr ? '<col style="width:16%">' : '') + '</colgroup>' +
    '<tr><td rowspan="4" class="logo c"><img src="' + esc(EMPRESA.logo) + '" alt="Logo"></td><td rowspan="4" class="titulo">' + esc(ATS_FORMATO.titulo) +
    (ats.code ? '<div style="font-size:9px;font-weight:400;margin-top:4px;">Registro ' + esc(ats.code) + ' · versión ' + (ats.version || 1) + (ats.estado === 'CERRADO' ? ' · CERRADO' : '') + (ats.sucio && ats.estado !== 'CERRADO' ? ' (con cambios sin subir)' : '') + '</div>' : '') + '</td><td>' + esc(ATS_FORMATO.pagina) + '</td>' +
    (qr ? '<td rowspan="4" class="qr-hoja c"><img src="' + qr + '" alt="QR del ATS"><div>' + (ats.estado === 'CERRADO' ? 'Escanea para ver este ATS' : 'Escanea para ver este ATS o agregar personal') + '</div></td>' : '') + '</tr>' +
    '<tr><td>' + (ATS_FORMATO.version ? 'Versión: ' + esc(ATS_FORMATO.version) : '') + '</td></tr><tr><td>' + (ATS_FORMATO.codigo ? 'Código: ' + esc(ATS_FORMATO.codigo) : '') + '</td></tr><tr><td>' + (ATS_FORMATO.fecha ? 'Fecha: ' + esc(ATS_FORMATO.fecha) : '') + '</td></tr></table>' +
    '<table><colgroup><col style="width:18%"><col style="width:40%"><col style="width:17%"><col style="width:25%"></colgroup>' +
    '<tr><td class="r">Centro de costos</td><td>' + esc(centro) + '</td><td class="r">Fecha</td><td>' + esc(fecha) + '</td></tr>' +
    '<tr><td class="r">Área</td><td>' + esc(c.area) + '</td><td class="r">Horario de trabajo</td><td>' + esc(horario) + '</td></tr>' +
    '<tr><td class="r">Trabajo a realizar</td><td colspan="3">' + esc(c.trabajo) + '</td></tr>' +
    '<tr><td class="r">Requiere permiso de trabajo</td><td colspan="3">' + esc(permisoTxt) + '</td></tr>' +
    '<tr><td class="r">Elementos de protección requeridos para la actividad</td><td colspan="3">' + esc(lista(c.epp, EPP, c.eppOtro)) + '</td></tr>' +
    '<tr><td class="r">Herramientas y equipos a utilizar</td><td colspan="3">' + esc(herramientasTexto()) + '</td></tr></table>' +
    '<table><colgroup><col style="width:22%"><col style="width:22%"><col style="width:14%"><col style="width:20%"><col style="width:22%"></colgroup>' +
    '<tr><td colspan="5" class="sub">Participantes en el análisis</td></tr>' +
    '<tr><th>Nombres</th><th>Apellidos</th><th>Cédula</th><th>Cargo</th><th>Firma</th></tr>' + filasPart + filasVacias + '</table>' +
    '<table><colgroup><col style="width:18%"><col style="width:20%"><col style="width:17%"><col style="width:32%"><col style="width:13%"></colgroup>' +
    '<thead><tr><td colspan="5" class="sub">Identificación y control de peligros</td></tr>' +
    '<tr><th>Pasos básicos de la tarea</th><th>Peligros</th><th>Consecuencia</th><th>Medidas preventivas y de control</th><th>Responsable</th></tr></thead>' +
    '<tbody>' + (filasTareas || '<tr><td colspan="5" class="c">—</td></tr>') + '</tbody></table>' +
    '<table><tr><td class="sub">Equipos requeridos para la atención de emergencia</td></tr><tr><td>' + esc(lista(c.emergencia, EMERGENCIA, c.emergOtro)) + '</td></tr>' +
    '<tr><td class="sub">Controles requeridos para minimizar el riesgo de contaminación ambiental</td></tr><tr><td>' + esc(c.ambiental.map((id) => (AMBIENTAL.find((e) => e.id === id) || { nombre: id }).nombre).concat((c.ambOtro || '').trim() ? [c.ambOtro.trim()] : []).map((x) => x + '.').join('\n')) + '</td></tr></table>' +
    '<table><colgroup><col style="width:34%"><col style="width:33%"><col style="width:33%"></colgroup>' +
    '<tr><td class="firma firma-fin" style="height:60px;">' + img(F.lider.firma) + '</td><td class="firma firma-fin">' + img(F.jefe.firma) + '</td><td class="firma firma-fin">' + img(F.sst.firma) + '</td></tr>' +
    '<tr><td class="c">' + esc(F.lider.nombre) + '</td><td class="c">' + esc(F.jefe.nombre) + '</td><td class="c">' + esc(F.sst.nombre) + '</td></tr>' +
    '<tr><td class="r c">Responsable / líder ejecutante de la tarea</td><td class="r c">Jefe de área</td><td class="r c">Seguridad industrial SSTA</td></tr></table>' +
    hojaCierre();
}
/* Cierre del ATS en la hoja impresa (solo si ya se cerró). */
function hojaCierre() {
  const k = ats.cierre;
  if (ats.estado !== 'CERRADO' || !k) return '';
  const img = (src) => (srcSeguro(src) ? '<img src="' + srcSeguro(src) + '" alt="firma">' : '');
  return '<table><colgroup><col style="width:18%"><col style="width:22%"><col style="width:18%"><col style="width:42%"></colgroup>' +
    '<tr><td colspan="4" class="sub">Cierre del ATS</td></tr>' +
    '<tr><td class="r">Fecha y hora de cierre</td><td>' + esc(fechaCO(k.fecha) + ' ' + (k.hora || '')) + '</td><td class="r">Motivo</td><td>' + esc(k.motivo) + '</td></tr>' +
    '<tr><td class="r">Observaciones</td><td colspan="3">' + esc(k.observaciones || '—') + '</td></tr>' +
    ((k.pendientes || []).length ? '<tr><td class="r">Pendientes al cerrar</td><td colspan="3">' + esc(k.pendientes.join('\n')) + '</td></tr>' : '') +
    '<tr><td class="r">Cierra</td><td>' + esc(k.nombre) + (k.cedula ? '\nCC ' + esc(k.cedula) : '') + (k.cargo ? '\n' + esc(k.cargo) : '') + '</td><td class="r">Firma</td><td class="firma firma-fin" style="height:50px;">' + img(k.firma) + '</td></tr></table>';
}
/* Lo que falta, para avisar antes de imprimir (no bloquea: a veces se
   imprime para firmar en papel). */
function pendientes() {
  const c = ats.cab, out = [];
  if (!c.centro.length && !(c.centroOtro || '').trim()) out.push('Centro de costos');
  if (!(c.area || '').trim()) out.push('Área');
  if (!(c.trabajo || '').trim()) out.push('Trabajo a realizar');
  if (!c.requiere) out.push('Si requiere o no permiso de trabajo');
  if (c.requiere === 'SI' && (c.permisos || []).includes('otro') && !(c.permisoOtro || '').trim()) out.push('Escribir cuál es el otro permiso de trabajo');
  if (!ats.tareas.length) out.push('No hay tareas');
  ats.tareas.forEach((t, i) => {
    const sin = t.peligros.filter((p) => !p.ctrls.some((x) => x.on) && !(p.extra || []).length);
    if (sin.length) out.push('Tarea ' + (i + 1) + ': ' + sin.length + ' peligro(s) sin controles');
  });
  if (!ats.tareas.some((t) => t.plantilla === 'orden')) out.push('No hay tarea de orden y aseo al final');
  if (!ats.participantes.length) out.push('No hay participantes');
  const sinFirma = ats.participantes.filter((p) => !p.firma).length;
  if (sinFirma) out.push(sinFirma + ' participante(s) sin firma');
  [['lider', 'Responsable / líder'], ['jefe', 'Jefe de área'], ['sst', 'SSTA']].forEach(([k, n]) => { if (!ats.firmas[k].firma) out.push('Firma de ' + n); });
  return out;
}
function abrirVistaPrevia() {
  armarHoja();
  document.body.classList.add('previa');
  window.scrollTo(0, 0);
}
$('btnVistaPrevia').addEventListener('click', () => {
  const falta = pendientes();
  if (!falta.length) { abrirVistaPrevia(); return; }
  panel('<h3>Antes de imprimir, falta:</h3><ul>' + falta.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
    '<div class="acciones-tareas"><button type="button" class="btn sec" data-cerrar>Completar</button><button type="button" class="btn" id="btnPreviaIgual">Ver el formato de todas formas</button></div>');
  $('btnPreviaIgual').addEventListener('click', () => { cerrarPanel(); abrirVistaPrevia(); });
});
$('btnVolverEditar').addEventListener('click', () => {
  if (document.body.classList.contains('revision')) { salirRevision(); return; }
  document.body.classList.remove('previa'); sigMgr.refreshIn(document.body);
});

/* ================= ATS ↔ PERMISOS =================
   Desde el ATS se abre cada permiso que requiere, con la descripción, el
   área, las fechas y los participantes ya llenos (antes se escribían dos
   veces). El permiso guarda el código del ATS y le devuelve el suyo por este
   mismo equipo; el ATS los lista, los imprime y, al cerrarse, avisa si alguno
   sigue abierto. */
const PERMISO_A_BACKEND = { caliente: 'caliente', alturas: 'alturas', confinados: 'confinados', izaje: 'izajes', electrico: 'electrico' };
function permisosAsociadosDe(a) {
  const out = ((a && a.cab && a.cab.permisosAsociados) || []).slice();
  if (a && a.code) {
    let l = [];
    try { l = JSON.parse(localStorage.getItem('ssta-ats-permisos:' + a.code) || '[]'); } catch (e) { l = []; }
    l.forEach((x) => { if (x && x.code && !out.some((y) => y.code === x.code)) out.push({ tipo: x.tipo, code: x.code, nombre: x.nombre || '' }); });
  }
  return out;
}
function sincronizarPermisosAsociados() {
  if (!ats.code) return;
  const antes = (ats.cab.permisosAsociados || []).length;
  const todos = permisosAsociadosDe(ats);
  if (todos.length !== antes) { ats.cab.permisosAsociados = todos; guardar(); }
}
function renderAbrirPermisos() {
  const cont = $('abrirPermisos');
  if (!cont) return;
  const c = ats.cab;
  const sel = (c.requiere === 'SI' ? c.permisos : []).filter((id) => PERMISO_A_BACKEND[id] && PORTAL_CONFIG.BACKENDS[PERMISO_A_BACKEND[id]]);
  const asociados = permisosAsociadosDe(ats);
  const btnJornada = ats.code ? '<button type="button" class="btn" id="btnJornada" style="width:100%;margin-bottom:10px;">🗂️ Jornada: permisos, charla y anexo con este personal →</button>' : '';
  if (!sel.length && !asociados.length) { cont.innerHTML = btnJornada ? '<div class="abrir-permisos">' + btnJornada + '</div>' : ''; if ($('btnJornada')) $('btnJornada').addEventListener('click', iniciarJornada); return; }
  cont.innerHTML = '<div class="abrir-permisos">' + btnJornada +
    (sel.length ? '<span class="etq">Diligenciar los permisos de este ATS</span>' +
      '<p class="ayuda" style="margin:0 0 8px;">Se abre el permiso con la descripción, el área, las fechas y los participantes de este ATS ya llenos.</p>' +
      '<div class="acciones-tareas u-mt0">' + sel.map((id) => {
        const B = PORTAL_CONFIG.BACKENDS[PERMISO_A_BACKEND[id]];
        return '<button type="button" class="btn sec" data-abrir-permiso="' + id + '">' + esc(B.icono || '📝') + ' Abrir permiso de ' + esc(B.nombre.replace(/^Trabajo (en |)/i, '').toLowerCase()) + '</button>';
      }).join('') + '</div>' : '') +
    (asociados.length ? '<div class="ya-asociados"><b>Permisos diligenciados desde este ATS:</b> ' + asociados.map((x) => {
      const B = PORTAL_CONFIG.BACKENDS[x.tipo] || {};
      return '<a href="' + esc(B.archivo || 'dashboard.html') + '?code=' + encodeURIComponent(x.code) + '">' + esc((B.icono || '') + ' ' + x.code) + '</a>';
    }).join(' · ') + '</div>' : '') + '</div>';
  cont.querySelectorAll('[data-abrir-permiso]').forEach((b) => b.addEventListener('click', () => abrirPermisoDesdeAts(b.dataset.abrirPermiso)));
  if ($('btnJornada')) $('btnJornada').addEventListener('click', iniciarJornada);
}
/* ---------- Jornada: del ATS a permisos, charla y anexo ---------- */
function datosJornadaDesdeAts() {
  const c = ats.cab;
  return {
    atsCode: ats.code,
    trabajo: c.trabajo || '',
    sitio: [c.area, (c.centro || []).concat((c.centroOtro || '').trim() ? [c.centroOtro.trim()] : []).join(', ')].filter(Boolean).join(' · '),
    desde: c.desde || hoyISO(), hasta: c.hasta || c.desde || hoyISO(), horaDesde: c.horaDesde || '', horaHasta: c.horaHasta || '',
    responsable: (ats.firmas.lider && ats.firmas.lider.nombre) || '',
    personas: ats.participantes.map((p) => ({ nombre: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(), cc: p.cedula || '', cargo: p.cargo || '' })).filter((p) => p.nombre),
    permisosReq: (c.requiere === 'SI' ? c.permisos : []).map((id) => PERMISO_A_BACKEND[id]).filter((k) => k && PORTAL_CONFIG.BACKENDS[k])
  };
}
async function iniciarJornada() {
  if (!ats.code) { await Dialogo.avisar('Primero guarda el ATS (☁️ Guardar): la jornada se amarra a su código.'); return; }
  Jornada.iniciar(datosJornadaDesdeAts());
  if (typeof cerrarPanel === 'function') try { cerrarPanel(); } catch (e) {}
  Jornada.barra();
  Jornada.mostrarPanel();
}
async function abrirPermisoDesdeAts(id) {
  const key = PERMISO_A_BACKEND[id];
  const B = PORTAL_CONFIG.BACKENDS[key];
  if (!B) return;
  if (!ats.code && !await Dialogo.confirmar('Este ATS todavía no tiene código (no se ha guardado en el servidor): el permiso se abre con sus datos, pero no quedará amarrado al ATS.\n\nRecomendado: toca ☁️ Guardar primero.\n\n¿Abrir el permiso de todas formas?')) return;
  const c = ats.cab;
  const prefill = {
    t: Date.now(), tipo: key, atsCode: ats.code || null,
    trabajo: c.trabajo || '',
    sitio: [c.area, c.centro.concat((c.centroOtro || '').trim() ? [c.centroOtro.trim()] : []).join(', ')].filter(Boolean).join(' · '),
    desde: c.desde || '', hasta: c.hasta || c.desde || '', horaDesde: c.horaDesde || '', horaHasta: c.horaHasta || '',
    responsable: (ats.firmas.lider && ats.firmas.lider.nombre) || '',
    personas: ats.participantes.map((p) => ({ nombre: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim(), cc: p.cedula || '', cargo: p.cargo || '' })).filter((p) => p.nombre)
  };
  try { localStorage.setItem('ssta-prefill-permiso', JSON.stringify(prefill)); } catch (e) { await Dialogo.avisar('No se pudo preparar el permiso (memoria del equipo llena).'); return; }
  guardarYa();
  location.href = B.archivo + '?desdeAts=1';
}
// Al volver del permiso (botón atrás del celular), se recoge el código generado.
window.addEventListener('pageshow', () => { if (ats && ats.code) { sincronizarPermisosAsociados(); renderAbrirPermisos(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && ats && ats.code) { sincronizarPermisosAsociados(); renderAbrirPermisos(); } });
/* Permisos de un ATS que siguen abiertos (se consulta cada backend). */
async function permisosAbiertosDe(a) {
  const lista = permisosAsociadosDe(a);
  const abiertos = [], sinComprobar = [];
  const tipos = Array.from(new Set(lista.map((x) => x.tipo).filter(Boolean)));
  await Promise.all(tipos.map(async (tipo) => {
    const B = PORTAL_CONFIG.BACKENDS[tipo];
    if (!B || !B.url) return;
    try {
      const res = await fetchWithRetry(B.url + '?' + (B.listQuery || 'list=1') + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const d = await res.json();
      if (!d || !d.ok || !Array.isArray(d.rows)) { sinComprobar.push(B.nombre); return; }
      const codes = lista.filter((x) => x.tipo === tipo).map((x) => x.code);
      d.rows.forEach((r) => { const code = r.code || r.permitCode; if (r.status === 'ABIERTO' && codes.includes(code)) abiertos.push(code + ' (' + B.nombre + ')'); });
    } catch (e) { sinComprobar.push(B.nombre); }
  }));
  return { abiertos, sinComprobar };
}

/* ================= REVISAR UN ATS DE UNA =================
   Al tocar un ATS en cualquier lista se abre directo su formato completo
   (el mismo que se imprime), traído del servidor y sin tocar el borrador de
   este dispositivo. Desde ahí se imprime, se agrega personal o se cierra. */
let revRef = null, revOrigen = 'menu', revScroll = 0, revCargando = false;
async function revisarAts(code, origen) {
  if (revCargando) return;
  revCargando = true;
  try {
    const ref = await traerReferencia(code);
    if (!ref) return;
    revRef = ref; revOrigen = origen || 'menu'; revScroll = window.scrollY;
    const propio = ats; ats = ref; try { armarHoja(); } finally { ats = propio; }
    document.body.classList.add('previa', 'revision');
    document.body.classList.toggle('rev-cerrado', ref.estado === 'CERRADO');
    $('btnVolverEditar').textContent = revOrigen === 'menu' ? '← Volver a la lista' : '← Volver';
    window.scrollTo(0, 0);
  } finally { revCargando = false; }
}
function salirRevision() {
  document.body.classList.remove('previa', 'revision', 'rev-cerrado');
  $('btnVolverEditar').textContent = '← Volver a editar';
  revRef = null;
  if (revOrigen === 'menu') window.scrollTo(0, revScroll);
  else { sigMgr.refreshIn(document.body); window.scrollTo(0, 0); }
}
$('btnRevPersonal').addEventListener('click', () => { const c = revRef && revRef.code, o = revOrigen; salirRevision(); if (c) entrarModoAgregar(c, o); });
$('btnRevCerrar').addEventListener('click', () => { const c = revRef && revRef.code, o = revOrigen; salirRevision(); if (c) entrarModoCerrar(c, o); });
/* ================= COPIAR UN ATS (sin firmas) =================
   Para el trabajo que se repite con las mismas tareas: se copia todo el
   ATS (encabezado, tareas con sus peligros y controles, EPP, herramientas,
   emergencia y ambiental) a uno NUEVO con fecha de hoy, sin ninguna firma
   y sin código (al guardarlo recibe el suyo). La lista de personas es
   opcional; si se copia, cada uno debe volver a firmar. */
function copiaSinFirmas(src, conParticipantes) {
  const c = JSON.parse(JSON.stringify(src));
  const base = nuevoAts();
  const n = Object.assign(base, c);
  n.cab = Object.assign(nuevoAts().cab, c.cab);
  n.code = null; n.version = 0; n.subidoEn = null; n.sucio = true; n.estado = 'ABIERTO';
  delete n.cierre;
  // Fechas: desde hoy, con la misma duración que el original.
  const dur = c.cab && c.cab.desde && c.cab.hasta ? Math.round((new Date(c.cab.hasta) - new Date(c.cab.desde)) / 86400000) : null;
  n.cab.desde = hoyISO();
  if (dur != null && dur >= 0) { const d = new Date(n.cab.desde + 'T12:00:00'); d.setDate(d.getDate() + dur); n.cab.hasta = d.toISOString().slice(0, 10); } else n.cab.hasta = '';
  n.tareas = (c.tareas || []).map((t) => { const x = Object.assign({}, t, { uid: uid() }); delete x.agregadaDespues; delete x._pos; return x; });
  n.cab.permisosAsociados = [];
  n.participantes = conParticipantes ? (c.participantes || []).map((p) => ({ uid: uid(), nombres: p.nombres || '', apellidos: p.apellidos || '', cedula: p.cedula || '', cargo: p.cargo || '', firma: null })) : [];
  const f = nuevoAts().firmas;
  n.firmas = f;   // v148: los firmantes finales (líder, jefe, SSTA) se escriben de nuevo hoy: no se copian
  n.copiaDe = c.code || '';
  n.revisarHoy = true;   // v137: un ATS repetido exige confirmar que se revisaron las condiciones de hoy
  delete n.revisadoHoy;
  return n;
}
function preguntarCopia(src) {
  const np = (src.participantes || []).length;
  panel('<h3>📋 Copiar como ATS nuevo</h3><p class="ayuda">Se copia <b>' + esc(src.code || 'el ATS actual') + '</b> con sus ' + src.tareas.length + ' tareas, peligros, controles, EPP y herramientas, con fecha de hoy y <b>sin ninguna firma</b>. Al guardarlo recibe un código nuevo.</p>' +
    (np ? '<button type="button" class="copia-op" id="cpCon">👷 Copiar con ' + (np === 1 ? 'el mismo participante' : 'los mismos ' + np + ' participantes') + '<small>Nombres, cédulas y cargos; cada uno vuelve a firmar.</small></button>' : '') +
    '<button type="button" class="copia-op" id="cpSin">📄 Copiar sin participantes<small>Solo el trabajo y las tareas; el personal se agrega de nuevo.</small></button>' +
    '<div class="acciones-tareas"><button type="button" class="btn sec" data-cerrar>Cancelar</button></div>');
  const hacer = async (con) => {
    const aSalvo = ats.code && !ats.sucio;
    const hayLocal = ats.tareas.length || ats.participantes.length || (ats.cab.trabajo || '').trim();
    if (!aSalvo && hayLocal && src !== ats && !await Dialogo.confirmar('El ATS que tienes en este equipo tiene cambios sin subir y se reemplaza por la copia. ¿Continuar?')) return;
    ats = copiaSinFirmas(src, con);
    editando = null; ultimaGuardada = null;
    DraftStore.save(CLAVE_BORRADOR, ats);
    cerrarPanel();
    document.body.classList.remove('previa', 'revision', 'rev-cerrado');
    $('btnVolverEditar').textContent = '← Volver a editar';
    revRef = null;
    irAlEditor();
    toast('Copia lista con fecha de hoy. Revisa fechas y condiciones, y que todos firmen. Guarda (☁️) para darle código.');
  };
  if (np) $('cpCon').addEventListener('click', () => hacer(true));
  $('cpSin').addEventListener('click', () => hacer(false));
}
async function copiarDelServidor(code) {
  const ref = await traerReferencia(code);
  if (ref) preguntarCopia(ref);
}
$('btnRevCopiar').addEventListener('click', () => { if (revRef) preguntarCopia(revRef); });
/* Tarea olvidada en un ATS ya guardado: se abre en el editor (si es el
   mismo que está en este equipo, se usa ese para no perder cambios) y se
   abre de una la tarea nueva, que por defecto va antes de "Orden y aseo". */
$('btnRevTarea').addEventListener('click', async () => {
  const code = revRef && revRef.code;
  if (!code) return;
  salirRevision();
  if (ats.code === code) irAlEditor();
  else { await cargarDesdeServidor(code); if (ats.code !== code) return; }
  abrirEditor(tareaVacia());
  toast('Escribe la tarea que faltó y escoge dónde va. Después guarda (☁️) para subirla.');
});

/* Tarjetas de ATS: tocar fuera de los botones = revisar. */
function tarjetasRevisables(cont, origen, antes) {
  cont.querySelectorAll('.pl-item[data-revisar]').forEach((it) => it.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    if (antes) antes();
    revisarAts(it.dataset.revisar, origen);
  }));
}
// En modo "Agregar personal" la hoja que se imprime es la del ATS de referencia.
$('btnImprimirPrevia').addEventListener('click', () => window.print());
// Si imprimen desde el menú del navegador sin pasar por la vista previa, la
// hoja se arma igual en ese momento (si no, saldría en blanco).
// Solo si no está en la vista previa: rearmar la hoja en ese instante crea
// imágenes nuevas (logo, firmas) que no alcanzan a cargar antes de imprimir.
window.addEventListener('beforeprint', () => {
  if (document.body.classList.contains('previa')) return;
  if (atsRef) { const propio = ats; ats = atsRef; try { armarHoja(); } finally { ats = propio; } } else armarHoja();
});
// El logo se precarga para que esté listo cuando se arme la hoja.
(new Image()).src = EMPRESA.logo;

/* ================= SERVIDOR (backends/backend-ats.gs) ================= */
function urlAts() { const b = PORTAL_CONFIG.BACKENDS.ats; return b && b.url && b.url.indexOf('http') === 0 ? b.url : ''; }
/* Por qué falló una consulta al servidor, en palabras claras. "Load failed"
   (iPhone) o "Failed to fetch" (Android) con señal casi nunca es la señal:
   es el Apps Script respondiendo una página de error en vez de datos (código
   pegado con texto de más o incompleto, o implementación sin acceso para
   "Cualquier persona"). Antes se mostraba el mensaje del navegador tal cual. */
function motivoFallaSrv(e) {
  if (!navigator.onLine) return 'Sin señal: inténtalo cuando haya conexión.';
  const m = String((e && e.message) || '');
  if (e instanceof SyntaxError || /JSON|Unexpected token/i.test(m)) {
    return 'No se pudo guardar el ATS en línea. Queda guardado en este celular; avisa al líder SST.';
  }
  if (e instanceof TypeError || /load failed|failed to fetch|networkerror/i.test(m)) {
    return 'No se pudo guardar el ATS en línea. Queda guardado en este celular: inténtalo de nuevo con señal y, si se repite, avisa al líder SST. (Detalle: ' + (m || 'sin detalle') + ')';
  }
  return 'No se pudo consultar: ' + (m || 'error sin detalle');
}
function generarCodigo() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return 'ATS-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + String(Math.floor(Math.random() * 900000) + 100000);
}
/* Lo que se sube: el ATS tal cual, con la clase y subclase GTC 45 escritas en
   cada peligro (para que el registro no dependa del catálogo) y sin los
   campos de pantalla. */
function paraSubir() {
  const c = JSON.parse(JSON.stringify(ats));
  c.tareas.forEach((t) => t.peligros.forEach((pi) => {
    pi.clase = claseDe(pi); pi.sub = pelDe(pi).sub; delete pi.abierto;
  }));
  // v148: también si es copia de otro ATS y la confirmación de que se revisó hoy (con quién y cuándo).
  return { v: c.v, cab: c.cab, participantes: c.participantes, tareas: c.tareas, firmas: c.firmas, copiaDe: c.copiaDe || '', revisadoHoy: c.revisadoHoy || '', revisadoPor: c.revisadoPor || '', habilitacion: c.habilitacion || undefined };
}
/** v148: contexto de habilitación del ATS: los permisos de alto riesgo que pide. */
function contextoHabAts() { const m = { caliente: 'caliente', alturas: 'alturas', confinados: 'confinados', izaje: 'izajes', electrico: 'electrico' }; return (ats.cab.permisos || []).map((p) => m[p]).filter(Boolean); }
function resumenLocal() {
  const firmado = (f) => typeof f === 'string' && f.length > 100;
  return {
    tareas: ats.tareas.length,
    peligros: ats.tareas.reduce((a, t) => a + t.peligros.length, 0),
    participantes: ats.participantes.length,
    firmasParticipantes: ats.participantes.filter((p) => firmado(p.firma)).length,
    firmasFinales: ['lider', 'jefe', 'sst'].filter((k) => firmado(ats.firmas[k].firma)).length
  };
}
async function guardarEnServidor(force) {
  const url = urlAts();
  if (!url) {
    panel('<h3>El guardado en línea del ATS aún no está activado</h3><p class="ayuda">Avisa al líder SST. Mientras tanto el ATS queda guardado en este celular y se puede imprimir o guardar en PDF.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    return;
  }
  guardarYa(); // trae las firmas recién hechas al estado
  // v137: un ATS copiado de otro día no se sube sin confirmar que se revisó HOY en el sitio.
  if (ats.revisarHoy && !ats.revisadoHoy) {
    if (!await Dialogo.confirmar('Este ATS es copia de uno anterior.\n\n¿Revisaste HOY, en el sitio, las tareas, los peligros y los controles, y todos volvieron a firmar?')) return;
    ats.revisadoHoy = new Date().toISOString(); ats.revisadoPor = (typeof Sesion !== 'undefined' && Sesion.nombre && Sesion.nombre()) || (ats.firmas.lider && ats.firmas.lider.nombre) || ''; DraftStore.save(CLAVE_BORRADOR, ats);
  }
  // v148: nadie no habilitado firma un ATS de alto riesgo (misma regla que los permisos).
  if (typeof Habilitacion !== 'undefined' && Habilitacion.exigir) {
    const exc = await Habilitacion.exigir(ats.participantes.map((p) => ({ cc: p.cedula, nombre: ((p.nombres || '') + ' ' + (p.apellidos || '')).trim() })), contextoHabAts(), { hasta: ats.cab.hasta || '', que: 'No se puede guardar el ATS' });
    if (exc === null) return;
    ats.habilitacion = exc.length ? exc : undefined;
  }
  if (!ats.code) ats.code = generarCodigo();
  const body = { token: PORTAL_CONFIG.API_TOKEN, opId: 'ats-' + Date.now() + '-' + Math.random().toString(36).slice(2),
                 code: ats.code, versionBase: ats.version || 0, force: !!force, ats: paraSubir() };
  const local = resumenLocal();
  const btn = $('btnGuardarServidor');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    let res;
    try {
      res = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    } catch (errRed) {
      // Sin señal: a la cola. Se envía sola cuando vuelva la conexión.
      await Outbox.add(url, body);
      DraftStore.save(CLAVE_BORRADOR, ats);
      // v147: también se puede repetir mañana aunque se haya guardado sin señal.
      try { localStorage.setItem('ssta-ats-ultimo', JSON.stringify(copiaSinFirmas(ats, true))); localStorage.setItem('ssta-ats-ultimo-info', JSON.stringify({ code: ats.code, trabajo: (ats.cab.trabajo || '').slice(0, 80), fecha: ats.cab.desde })); } catch (e) {}
      panel('<div class="verif cola"><b>📡 Sin señal: el ATS quedó en cola.</b><br>Se sube solo cuando vuelva la conexión (código ' + esc(ats.code) + '). No borres el borrador de este celular hasta que aparezca como guardado.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      return;
    }
    const r = await res.json();
    if (!r.ok && r.conflicto) {
      panel('<div class="verif mal"><b>⚠️ Otro dispositivo guardó una versión más nueva de este ATS (versión ' + r.versionServidor + ').</b><br>Si guardas lo que tienes aquí, se pierden los cambios o firmas que se hicieron allá.</div>' +
        '<div class="acciones-tareas"><button type="button" class="btn" id="btnTraerServidor">Abrir la versión del servidor</button><button type="button" class="btn peligro" id="btnSobrescribir">Guardar la mía de todas formas</button></div>');
      $('btnTraerServidor').addEventListener('click', () => { cerrarPanel(); cargarDesdeServidor(ats.code, true); });
      $('btnSobrescribir').addEventListener('click', async () => {
        if (!await Dialogo.confirmar('¿Seguro? Se reemplaza la versión ' + r.versionServidor + ' del servidor con la de este dispositivo.')) return;
        cerrarPanel(); guardarEnServidor(true);
      });
      return;
    }
    if (!r.ok && r.cerrado) {
      panel('<div class="verif mal"><b>🔒 ' + esc(r.error || 'Este ATS ya está cerrado.') + '</b></div><p class="ayuda">Los cambios de este dispositivo ya no se pueden subir: se trae la versión cerrada del servidor.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      cargarDesdeServidor(ats.code, true);
      return;
    }
    if (!r.ok) { panel('<div class="verif mal"><b>No se pudo guardar.</b><br>' + esc(r.error || 'Error sin detalle') + '</div><p class="ayuda">El ATS sigue guardado en este dispositivo.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Cerrar</button></div>'); return; }
    ats.code = r.code; ats.version = r.version; ats.subidoEn = new Date().toISOString(); ats.sucio = false;
    try { localStorage.setItem('ssta-ats-ultimo', JSON.stringify(copiaSinFirmas(ats, true))); localStorage.setItem('ssta-ats-ultimo-info', JSON.stringify({ code: ats.code, trabajo: (ats.cab.trabajo || '').slice(0, 80), fecha: ats.cab.desde })); } catch (e) {}
    DraftStore.save(CLAVE_BORRADOR, ats);
    actualizarEstado();
    await verificarGuardado(local);
  } finally {
    btn.disabled = false; btn.textContent = '☁️ Guardar';
  }
}
/* Después de guardar se vuelve a leer del servidor y se compara con lo que hay
   en el celular. Es la misma lección de las firmas perdidas: "ok" del servidor
   no basta, hay que ver que lo guardado esté completo. */
async function verificarGuardado(local) {
  let r = null;
  try {
    const res = await fetchWithRetry(urlAts() + '?code=' + encodeURIComponent(ats.code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
    r = await res.json();
  } catch (e) { r = null; }
  const linea = (s) => s.tareas + ' tareas, ' + s.peligros + ' peligros, ' + s.participantes + ' participantes (' + s.firmasParticipantes + ' con firma), ' + s.firmasFinales + ' de 3 firmas finales';
  if (!r || !r.ok) {
    panel('<div class="verif cola"><b>Se guardó (' + esc(ats.code) + ', versión ' + ats.version + '), pero no se pudo comprobar.</b><br>La señal falló al volver a leerlo. Cuando tengas señal, ábrelo desde 📁 Abrir para confirmar que esté completo.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    return;
  }
  const s = r.resumen;
  const igual = ['tareas', 'peligros', 'participantes', 'firmasParticipantes', 'firmasFinales'].every((k) => s[k] === local[k]);
  if (igual) {
    panel('<div class="verif bien"><b>✓ Guardado y verificado en el servidor</b><br>' + esc(ats.code) + ' · versión ' + ats.version + '<br>' + esc(linea(s)) + '.</div>' +
      '<p class="ayuda">Si después llega gente a la obra, se agrega con «👷 Llegó más gente» (en Participantes) o con el enlace/QR, sin tocar el resto del ATS.</p>' +
      '<button type="button" class="btn" id="btnJornadaTrasGuardar" style="width:100%;margin:4px 0 8px;">🗂️ Siguiente: permisos, charla y anexo →</button>' +
      '<div class="acciones-tareas"><button type="button" class="btn sec" id="btnEnlaceTrasGuardar">📲 Enlace para agregar personal</button><button type="button" class="btn sec" data-cerrar>Listo</button></div>');
    $('btnEnlaceTrasGuardar').addEventListener('click', () => compartirAgregar(ats.code));
    $('btnJornadaTrasGuardar').addEventListener('click', iniciarJornada);
    // Si ya hay una jornada de este ATS, se actualiza su personal (llegó más gente).
    const jAct = Jornada.actual();
    if (jAct && jAct.atsCode === ats.code) Jornada.iniciar(datosJornadaDesdeAts());
  } else {
    panel('<div class="verif mal"><b>⚠️ Lo guardado no coincide con lo que hay en este celular.</b><br>En el servidor: ' + esc(linea(s)) + '.<br>Aquí: ' + esc(linea(local)) + '.</div><p class="ayuda">No borres nada de este dispositivo y vuelve a tocar ☁️ Guardar.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    ats.sucio = true; actualizarEstado();
  }
}
async function cargarDesdeServidor(code, sinPreguntar) {
  const url = urlAts();
  if (!url) return;
  if (!sinPreguntar && ats.sucio && (ats.tareas.length || ats.participantes.length) && ats.code !== code &&
      !await Dialogo.confirmar('Tienes un ATS con cambios sin subir en este dispositivo. Si abres otro, esos cambios se reemplazan. ¿Continuar?')) return;
  toast('Abriendo ' + code + '…');
  try {
    const res = await fetchWithRetry(url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
    const r = await res.json();
    if (!r.ok) { await Dialogo.avisar('No se pudo abrir ' + code + ': ' + (r.error || 'error sin detalle')); return; }
    const base = nuevoAts();
    ats = Object.assign(base, r.ats);
    ats.cab = Object.assign(base.cab, r.ats.cab);
    ats.code = r.code; ats.version = Number(r.version) || 1; ats.subidoEn = r.updatedAt || null; ats.sucio = false;
    ats.estado = r.estado || 'ABIERTO';
    ats.tareas.forEach((t) => { if (!t.uid) t.uid = uid(); });
    ats.participantes.forEach((p) => { if (!p.uid) p.uid = uid(); });
    editando = null; ultimaGuardada = null;
    DraftStore.save(CLAVE_BORRADOR, ats);
    $('bannerBorrador').classList.remove('show');
    irAlEditor();
    toast(code + ' abierto (versión ' + ats.version + ')' + (ats.estado === 'CERRADO' ? ' · cerrado' : '') + '.');
  } catch (e) {
    await Dialogo.avisar('No se pudo abrir ' + code + '. ' + motivoFallaSrv(e));
  }
}
$('btnGuardarServidor').addEventListener('click', () => guardarEnServidor(false));
window.addEventListener('outbox-enviado', (e) => {
  const b = e.detail && e.detail.body;
  if (b && b.action === 'agregarParticipantes') { toast('Se agregaron ' + (b.participantes || []).length + ' persona(s) a ' + b.code + '.'); return; }
  if (b && b.action === 'cerrarAts') {
    try { localStorage.removeItem(claveCierre(b.code)); } catch (err) {}
    cacheLista = null;
    if (ats.code === b.code) { ats.estado = 'CERRADO'; DraftStore.save(CLAVE_BORRADOR, ats); actualizarEstado(); }
    toast(b.code + ' quedó cerrado en el servidor.');
    return;
  }
  if (!(b && b.code && b.code === ats.code)) return;
  // Si se aplicó, el servidor quedó en la versión siguiente a la que se usó
  // de base. Hay que anotarla: si no, el próximo guardado desde este celular
  // se vería como armado sobre una versión vieja y daría un conflicto falso.
  ats.version = Math.max(ats.version || 0, (Number(b.versionBase) || 0) + 1);
  ats.subidoEn = new Date().toISOString();
  ats.sucio = false;
  DraftStore.save(CLAVE_BORRADOR, ats); actualizarEstado();
  toast(b.code + ' se subió al servidor.');
});
// Un envío de la cola que el servidor rechazó 5 veces (por ejemplo, porque
// otro dispositivo guardó una versión más nueva mientras este no tenía señal).
window.addEventListener('outbox-fallido', (e) => {
  const b = e.detail && e.detail.item && e.detail.item.body;
  if (b && b.action === 'cerrarAts') {
    panel('<div class="verif mal"><b>El cierre pendiente de ' + esc(b.code) + ' no se pudo enviar.</b><br>' + esc((e.detail && e.detail.error) || '') + '</div>' +
      '<p class="ayuda">Lo diligenciado sigue en este celular: búscalo en ☰ Menú → Cerrar un ATS e inténtalo de nuevo.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    return;
  }
  if (!(b && b.code && b.code === ats.code)) return;
  ats.sucio = true; actualizarEstado();
  panel('<div class="verif mal"><b>El envío pendiente de ' + esc(b.code) + ' no se pudo subir.</b><br>' + esc((e.detail && e.detail.error) || '') + '</div>' +
    '<p class="ayuda">Lo que tienes en este celular sigue aquí. Toca ☁️ Guardar para intentarlo de nuevo y ver qué pasa.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
});

/* ================= MODO "AGREGAR PERSONAL" =================
   Para la gente que llega a la obra con el ATS ya guardado. Se trabaja sobre
   una copia de referencia del ATS (atsRef), sin tocar el borrador principal
   de este dispositivo, y al guardar solo se SUMAN personas en el servidor
   (acción agregarParticipantes): no se sobrescribe nada de lo demás. */
let atsRef = null;        // ATS del servidor, solo para mostrar
let nuevos = [];          // personas por agregar
const claveNuevos = (code) => 'ats-agregar-' + code;
/* v148: el enlace lleva la clave de ESE ATS: quien lo abre se agrega y firma desde su celular sin usuario (no puede cambiar nada más). */
let claveEnlace = (()=> { try { return new URLSearchParams(location.search).get('k') || ''; } catch (e) { return ''; } })();
function enlaceAgregar(code) { return location.origin + location.pathname + '?code=' + encodeURIComponent(code) + '&agregar=1' + (claveEnlace ? '&k=' + encodeURIComponent(claveEnlace) : ''); }
async function pedirClaveEnlace(code) {
  try { const r = await (await fetchWithRetry(urlAts() + '?action=enlaceFirma&code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN) + (SGSST._ses ? SGSST._ses() : ''))).json(); if (r.ok && r.clave) claveEnlace = r.clave; } catch (e) {}
}
function guardarNuevos() {
  if (!atsRef) return;
  try { localStorage.setItem(claveNuevos(atsRef.code), JSON.stringify(nuevos)); } catch (e) { /* memoria llena: sigue en pantalla */ }
}
/* Trae un ATS del servidor como referencia (para agregar personal o cerrar),
   sin tocar el borrador principal de este dispositivo. */
async function traerReferencia(code) {
  if (!urlAts()) { guardarEnServidor(false); return null; } // muestra el aviso de "sin servidor"
  code = String(code || '').trim().toUpperCase();
  if (!/^ATS-\d{8}-\d{4,8}$/.test(code)) { await Dialogo.avisar('Ese código no tiene la forma de un ATS (ej. ATS-20260928-482173).'); return null; }
  toast('Abriendo ' + code + '…');
  let r;
  try {
    const res = await fetchWithRetry(urlAts() + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN) + (claveEnlace ? '&k=' + encodeURIComponent(claveEnlace) : ''));
    r = await res.json();
  } catch (e) { await Dialogo.avisar('No se pudo abrir ' + code + '. ' + motivoFallaSrv(e)); return null; }
  if (!r.ok) { await Dialogo.avisar('No se pudo abrir ' + code + ': ' + (r.error || '')); return null; }
  const ref = Object.assign(nuevoAts(), r.ats, { code: r.code, version: Number(r.version) || 1, sucio: false, estado: r.estado || 'ABIERTO' });
  ref.cab = Object.assign(nuevoAts().cab, r.ats.cab);
  return ref;
}
async function entrarModoAgregar(code, origen) {
  const ref = await traerReferencia(code);
  if (!ref) return;
  origenModo = origen || 'menu';
  atsRef = ref; code = ref.code;
  try { nuevos = JSON.parse(localStorage.getItem(claveNuevos(code)) || '[]'); } catch (e) { nuevos = []; }
  if (!nuevos.length) nuevos.push(personaNueva());
  editando = null;
  document.body.classList.remove('en-menu', 'modo-cerrar', 'previa');
  document.body.classList.add('modo-agregar');
  document.body.classList.toggle('ref-cerrado', atsRef.estado === 'CERRADO');
  history.replaceState(null, '', enlaceAgregar(code).replace(location.origin, ''));
  pintarModoAgregar();
  window.scrollTo(0, 0);
}
function personaNueva() {
  return { uid: uid(), nombres: '', apellidos: '', cedula: '', cargo: '', firma: null, tardio: true, socializado: false, ingreso: new Date().toISOString() };
}
/* Resumen de un ATS del servidor (cabecera de los modos agregar y cerrar). */
function resumenRef(a) {
  const c = a.cab;
  const firmados = a.participantes.filter((p) => p.firma).length;
  return '<b class="cod">' + esc(a.code) + '</b> · versión ' + a.version +
    ' <span class="etiqueta-estado ' + (a.estado === 'CERRADO' ? 'cerrado">CERRADO' : 'abierto">ABIERTO') + '</span><br>' +
    '<b>' + esc(c.trabajo || '(sin trabajo)') + '</b><br>' +
    esc([c.centro.join(', '), c.centroOtro, c.area].filter(Boolean).join(' · ')) + '<br>' +
    esc(fechaCO(c.desde) + (c.hasta ? ' al ' + fechaCO(c.hasta) : '')) + ' · ' + a.tareas.length + ' tareas<br>' +
    'Están <b>' + a.participantes.length + ' participantes</b> (' + firmados + ' firmaron)' +
    (a.participantes.length ? ': <span style="color:var(--ink-muted)">' + esc(a.participantes.map((p) => ((p.nombres || '') + ' ' + (p.apellidos || '')).trim()).filter(Boolean).join(', ')) + '</span>' : '');
}
/* Cómo se cerró un ATS (para mostrarlo en pantalla). */
function textoCierre(a) {
  const k = a.cierre || {};
  return '<b>🔒 ATS cerrado</b> el ' + esc(fechaCO(k.fecha)) + ' a las ' + esc(k.hora || '') + '<br>' +
    'Motivo: <b>' + esc(k.motivo || '') + '</b><br>' +
    'Cerró: ' + esc([k.nombre, k.cargo].filter(Boolean).join(' · ')) +
    (k.observaciones ? '<br>Observaciones: ' + esc(k.observaciones) : '') +
    ((k.pendientes || []).length ? '<br><span style="color:var(--ambar-700)">Pendientes al cerrar: ' + esc(k.pendientes.join('; ')) + '</span>' : '');
}
function pintarModoAgregar() {
  const a = atsRef;
  $('refAts').innerHTML = resumenRef(a) +
    (a.estado === 'CERRADO' ? '<div class="cerrado-info" style="margin:10px 0 0;">' + textoCierre(a) + '<br>Ya no se puede agregar personal. Si el trabajo sigue, hay que abrir un ATS nuevo.</div>' : '');
  const cont = $('listaNuevos');
  cont.innerHTML = '';
  if (a.estado === 'CERRADO') return;
  const cedAts = a.participantes.map((p) => String(p.cedula || '').trim()).filter(Boolean);
  nuevos.forEach((p, i) => {
    const d = filaPersona(p, {
      titulo: 'Persona nueva ' + (i + 1),
      alCambiar: guardarNuevos,
      alQuitar: () => { nuevos.splice(i, 1); if (!nuevos.length) nuevos.push(personaNueva()); guardarNuevos(); pintarModoAgregar(); },
      cedulasExistentes: () => cedAts.concat(nuevos.filter((x) => x !== p).map((x) => String(x.cedula || '').trim()).filter(Boolean))
    });
    cont.appendChild(d);
    d._conectar();
  });
}
async function salirModoAgregar() {
  if (atsRef && atsRef.estado !== 'CERRADO' && nuevos.some((p) => p.nombres || p.firma) &&
      !await Dialogo.confirmar('Hay personas sin guardar. Quedan en este celular para cuando vuelvas a este ATS. ¿Salir?')) return;
  atsRef = null; nuevos = [];
  if (origenModo === 'editor') irAlEditor(); else irAlMenu();
}
async function guardarPersonal() {
  guardarYa();
  const listos = nuevos.filter((p) => p.nombres || p.apellidos || p.cedula || p.firma);
  if (!listos.length) { await Dialogo.avisar('Escribe al menos una persona.'); return; }
  const cedAts = atsRef.participantes.map((p) => String(p.cedula || '').trim());
  const faltas = [];
  listos.forEach((p) => {
    const n = ((p.nombres || '') + ' ' + (p.apellidos || '')).trim() || 'Una persona';
    if (!p.nombres) faltas.push(n + ': falta el nombre');
    if (!String(p.cedula || '').trim()) faltas.push(n + ': falta la cédula');
    else if (cedAts.includes(String(p.cedula).trim())) faltas.push(n + ': ya está en el ATS');
    if (!p.firma) faltas.push(n + ': falta la firma');
    if (!p.socializado) faltas.push(n + ': falta marcar que se le socializó el ATS');
  });
  if (faltas.length) {
    panel('<h3>Antes de guardar:</h3><ul>' + faltas.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Completar</button></div>');
    return;
  }
  const body = { action: 'agregarParticipantes', token: PORTAL_CONFIG.API_TOKEN, clave: claveEnlace || undefined,
                 opId: 'atsp-' + Date.now() + '-' + Math.random().toString(36).slice(2), code: atsRef.code, participantes: listos };
  const btn = $('btnGuardarPersonal');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    let r;
    try {
      const res = await fetchWithRetry(urlAts(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      r = await res.json();
    } catch (errRed) {
      await Outbox.add(urlAts(), body);
      nuevos = [personaNueva()]; guardarNuevos(); pintarModoAgregar();
      panel('<div class="verif cola"><b>📡 Sin señal: quedó en cola.</b><br>' + listos.length + ' persona(s) se agregan solas a ' + esc(atsRef.code) + ' cuando vuelva la conexión.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      return;
    }
    if (!r.ok && r.cerrado) {
      // Alguien lo cerró mientras tanto: se vuelve a leer para mostrar el cierre.
      panel('<div class="verif mal"><b>🔒 ' + esc(r.error || 'El ATS ya está cerrado.') + '</b></div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      entrarModoAgregar(atsRef.code, origenModo);
      return;
    }
    if (!r.ok) { panel('<div class="verif mal"><b>No se pudo guardar.</b><br>' + esc(r.error || '') + '</div><p class="ayuda">Las personas siguen en pantalla; inténtalo de nuevo.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Cerrar</button></div>'); return; }
    // Verificación: se vuelve a leer y se confirma que cada persona quedó, con firma.
    let v = null;
    try { v = await (await fetchWithRetry(urlAts() + '?code=' + encodeURIComponent(atsRef.code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN))).json(); } catch (e) { v = null; }
    const ced = (x) => String(x.cedula || '').trim();
    const faltan = v && v.ok ? listos.filter((p) => !v.ats.participantes.some((q) => ced(q) === ced(p) && q.firma && q.firma.length > 100)) : null;
    if (v && v.ok) {
      atsRef = Object.assign(nuevoAts(), v.ats, { code: v.code, version: Number(v.version) || 1, sucio: false });
      atsRef.cab = Object.assign(nuevoAts().cab, v.ats.cab);
      // Si el borrador principal de este celular es este mismo ATS y no tiene
      // cambios pendientes, se pone al día para que no quede atrasado.
      if (ats.code === v.code && !ats.sucio) {
        ats = JSON.parse(JSON.stringify(atsRef)); ats.subidoEn = new Date().toISOString();
        DraftStore.save(CLAVE_BORRADOR, ats);
      }
    }
    nuevos = [personaNueva()];
    try { localStorage.removeItem(claveNuevos(atsRef.code)); } catch (e) {}
    pintarModoAgregar();
    const lista = (r.agregados || []).map((n) => '<li>' + esc(n) + '</li>').join('');
    const omit = (r.omitidos || []).length ? '<p class="ayuda">No se agregaron porque ya estaban: ' + esc(r.omitidos.join(', ')) + '</p>' : '';
    if (faltan === null) {
      panel('<div class="verif cola"><b>Se guardó, pero no se pudo comprobar.</b></div><ul>' + lista + '</ul>' + omit + '<div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    } else if (faltan.length) {
      panel('<div class="verif mal"><b>⚠️ No aparecen completas en el servidor:</b> ' + esc(faltan.map((p) => p.nombres).join(', ')) + '.</div><p class="ayuda">Vuelve a agregarlas.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    } else {
      panel('<div class="verif bien"><b>✓ Agregado y verificado en ' + esc(atsRef.code) + '</b> (versión ' + atsRef.version + ')</div>' +
        (lista ? '<ul>' + lista + '</ul>' : '') + omit +
        '<div class="acciones-tareas"><button type="button" class="btn sec" data-cerrar>Agregar a alguien más</button><button type="button" class="btn" id="btnSalirTrasGuardar">Salir</button></div>');
      $('btnSalirTrasGuardar').addEventListener('click', () => { cerrarPanel(); salirModoAgregar(); });
    }
  } finally {
    btn.disabled = false; btn.textContent = '☁️ Guardar personal';
  }
}
async function compartirAgregar(code) {
  if (!claveEnlace) await pedirClaveEnlace(code);
  const url = enlaceAgregar(code);
  let qr = '';
  try { qr = '<div class="qr-ats"><img src="' + QR.comoImagen(url, { px: 220 }) + '" alt="QR para agregar personal"></div>'; } catch (e) { qr = ''; }
  const wa = 'https://wa.me/?text=' + encodeURIComponent('Para agregar personal al ' + code + ' (ATS), abre: ' + url);
  panel('<h3>Agregar personal a ' + esc(code) + '</h3><p class="ayuda">Quien tenga este enlace o escanee el QR entra directo a agregar gente a este ATS (sin poder cambiar el resto).</p>' + qr +
    '<div class="acciones-tareas"><a class="btn" style="display:inline-flex;align-items:center;text-decoration:none;" href="' + esc(wa) + '" target="_blank" rel="noopener">Enviar por WhatsApp</a>' +
    '<button type="button" class="btn sec" id="btnCopiarEnlace">Copiar enlace</button><button type="button" class="btn sec" data-cerrar>Cerrar</button></div>');
  $('btnCopiarEnlace').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); toast('Enlace copiado.'); } catch (e) { await Dialogo.pedir('Copia el enlace:', url); }
  });
}
$('btnModoAgregar').addEventListener('click', () => entrarModoAgregar(ats.code, 'editor'));
$('btnOtroNuevo').addEventListener('click', () => {
  nuevos.push(personaNueva()); guardarNuevos(); pintarModoAgregar();
  const ult = $('listaNuevos').lastElementChild;
  if (ult) { ult.scrollIntoView({ block: 'center', behavior: 'smooth' }); ult.querySelector('input').focus({ preventScroll: true }); }
});
$('btnGuardarPersonal').addEventListener('click', guardarPersonal);
$('btnSalirAgregar').addEventListener('click', salirModoAgregar);
$('btnCompartirAgregar').addEventListener('click', () => compartirAgregar(atsRef.code));
$('btnVerAtsRef').addEventListener('click', () => {
  // La hoja se arma desde el ATS de referencia sin tocar el borrador principal.
  const propio = ats; ats = atsRef; try { armarHoja(); } finally { ats = propio; }
  document.body.classList.add('previa'); window.scrollTo(0, 0);
});

/* ================= MODO "CERRAR ATS" =================
   Como el cierre de los permisos: fecha, hora, motivo, observaciones y firma
   de quien cierra. Se trabaja sobre el ATS del servidor (atsRef), sin tocar
   el borrador principal. Lo que falte al cerrar no bloquea (a veces el
   trabajo se suspende a la mitad), pero queda escrito en el cierre. */
let cierre = null;
const claveCierre = (code) => 'ats-cierre-' + code;
function guardarCierreLocal() {
  if (!atsRef || !cierre) return;
  try { localStorage.setItem(claveCierre(atsRef.code), JSON.stringify(cierre)); } catch (e) { /* memoria llena: sigue en pantalla */ }
}
function horaAhora() { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return p(d.getHours()) + ':' + p(d.getMinutes()); }
/* Lo que le falta al ATS de referencia, más lo propio de la gente que llegó tarde. */
function pendientesDe(a) {
  const propio = ats; ats = a;
  let out;
  try { out = pendientes(); } finally { ats = propio; }
  a.participantes.filter((p) => p.tardio && !p.socializado).forEach((p) =>
    out.push(((p.nombres || '') + ' ' + (p.apellidos || '')).trim() + ': llegó después y no consta que se le socializó'));
  return out;
}
async function entrarModoCerrar(code, origen) {
  const ref = await traerReferencia(code);
  if (!ref) return;
  origenModo = origen || 'menu';
  atsRef = ref;
  editando = null;
  document.body.classList.remove('en-menu', 'modo-agregar', 'previa');
  document.body.classList.add('modo-cerrar');
  document.body.classList.toggle('ref-cerrado', atsRef.estado === 'CERRADO');
  history.replaceState(null, '', location.pathname + '?code=' + encodeURIComponent(atsRef.code) + '&cerrar=1');
  pintarModoCerrar();
  window.scrollTo(0, 0);
}
function pintarModoCerrar() {
  const a = atsRef;
  $('refCerrar').innerHTML = resumenRef(a);
  if (a.estado === 'CERRADO') {
    $('infoCerrado').innerHTML = '<div class="cerrado-info">' + textoCierre(a) + '<br>Queda solo para consulta e impresión.</div>';
    return;
  }
  $('infoCerrado').innerHTML = '';
  try { cierre = JSON.parse(localStorage.getItem(claveCierre(a.code)) || 'null'); } catch (e) { cierre = null; }
  if (!cierre) cierre = { fecha: hoyISO(), hora: horaAhora(), motivo: '', observaciones: '', nombre: '', cedula: '', cargo: '', firma: null };
  const pend = pendientesDe(a);
  const sinSubir = ats.code === a.code && ats.sucio;
  $('pendCierre').innerHTML =
    (sinSubir ? '<div class="pend-cierre" style="background:var(--rojo-50);border-color:var(--rojo-300);color:var(--rojo-900);"><b>⚠️ Este dispositivo tiene cambios de este ATS sin subir.</b> Súbelos antes de cerrar (☰ Menú → Continuar el ATS en curso → ☁️ Guardar); al cerrar ya no se podrán subir.</div>' : '') +
    (pend.length
      ? '<div class="pend-cierre"><b>El ATS tiene pendientes.</b> Se puede cerrar igual (por ejemplo, si el trabajo se suspendió), pero quedan anotados en el cierre:<ul>' + pend.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>'
      : '<div class="pend-cierre ok">✓ El ATS está completo: todos firmaron y no falta nada.</div>');
  ['Fecha', 'Hora', 'Motivo', 'Obs', 'Nombre', 'Cedula', 'Cargo'].forEach((k) => {
    const campo = { Fecha: 'fecha', Hora: 'hora', Motivo: 'motivo', Obs: 'observaciones', Nombre: 'nombre', Cedula: 'cedula', Cargo: 'cargo' }[k];
    const el = $('c' + k);
    el.value = cierre[campo] || '';
    el.oninput = el.onchange = () => { cierre[campo] = el.value; guardarCierreLocal(); };
  });
  // La firma se arma de nuevo cada vez: el lienzo necesita estar visible.
  const w = $('cFirmaWrap');
  w.innerHTML = '';
  const fb = bloqueFirma('firmaCierre', cierre, 'status_firmaCierre');
  fb.querySelector('canvas').className = 'pad';
  w.appendChild(fb);
  const pad = conectarFirma(fb.querySelector('canvas'), cierre, guardarCierreLocal);
  fb.querySelector('[data-b=undo]').addEventListener('click', () => { pad.undo(); cierre.firma = pad.getDataUrl(); guardarCierreLocal(); });
  fb.querySelector('[data-b=clear]').addEventListener('click', () => { pad.clear(); cierre.firma = null; guardarCierreLocal(); });
}
// El buscador de personal para quien cierra (se conecta una sola vez).
autocompletar($('cNombre'), (per) => {
  if (!cierre) return;
  cierre.nombre = per.nombre; cierre.cedula = String(per.cedula || ''); cierre.cargo = per.cargo || '';
  $('cNombre').value = cierre.nombre; $('cCedula').value = cierre.cedula; $('cCargo').value = cierre.cargo;
  guardarCierreLocal();
});
async function confirmarCierre() {
  guardarYa(); // trae la firma recién hecha
  const a = atsRef, k = cierre;
  const faltas = [];
  if (!k.fecha) faltas.push('Fecha de cierre');
  if (!k.hora) faltas.push('Hora de cierre');
  if (!k.motivo) faltas.push('Motivo del cierre');
  if (!(k.nombre || '').trim()) faltas.push('Nombre de quien cierra');
  if (!k.firma) faltas.push('Firma de quien cierra');
  if (faltas.length) {
    panel('<h3>Para cerrar falta:</h3><ul>' + faltas.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Completar</button></div>');
    return;
  }
  if (permisosAsociadosDe(a).length && navigator.onLine) {
    toast('Revisando si los permisos de este ATS siguen abiertos…');
    const r = await permisosAbiertosDe(a);
    if (r.abiertos.length && !await Dialogo.confirmar('Estos permisos de ' + a.code + ' siguen ABIERTOS:\n\n• ' + r.abiertos.join('\n• ') + '\n\nLo correcto es cerrarlos primero. ¿Cerrar el ATS de todas formas?')) return;
    if (!r.abiertos.length && r.sinComprobar.length && !await Dialogo.confirmar('No se pudo comprobar si siguen abiertos los permisos de: ' + r.sinComprobar.join(', ') + '.\n\n¿Cerrar el ATS de todas formas?')) return;
  }
  // v149: si este celular tiene firmas o personal de este ATS sin subir, primero se suben (al cerrarlo se rechazarían y se perderían)
  try { const enCola = (await Outbox.list()).filter((it)=> it.body && it.body.code === a.code && it.body.action !== 'cerrarAts');
    if (enCola.length) { await Dialogo.avisar('Este celular tiene ' + enCola.length + ' envío(s) de ' + a.code + ' sin subir (firmas o personal). Espera a tener señal para que se suban y luego ciérralo; si lo cierras ahora, esas firmas no quedarían en el ATS.'); if (navigator.onLine) Outbox.flush(); return; } } catch (e) {}
  const pend = pendientesDe(a);
  if (!await Dialogo.confirmar('¿Cerrar ' + a.code + '?\n\nDespués de cerrado ya no se puede modificar ni agregar personal.' +
               (pend.length ? '\n\nQuedan anotados como pendientes al cerrar:\n- ' + pend.join('\n- ') : ''))) return;
  const body = { action: 'cerrarAts', token: PORTAL_CONFIG.API_TOKEN,
                 opId: 'atsc-' + Date.now() + '-' + Math.random().toString(36).slice(2), code: a.code,
                 cierre: { fecha: k.fecha, hora: k.hora, motivo: k.motivo, observaciones: k.observaciones || '',
                           nombre: k.nombre.trim(), cedula: (k.cedula || '').trim(), cargo: (k.cargo || '').trim(), firma: k.firma, pendientes: pend } };
  const btn = $('btnConfirmarCierre');
  btn.disabled = true; btn.textContent = 'Cerrando…';
  try {
    let r;
    try {
      const res = await fetchWithRetry(urlAts(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      r = await res.json();
    } catch (errRed) {
      await Outbox.add(urlAts(), body);
      panel('<div class="verif cola"><b>📡 Sin señal: el cierre quedó en cola.</b><br>' + esc(a.code) + ' se cierra solo cuando vuelva la conexión. No borres los datos de este celular hasta que se envíe.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      return;
    }
    if (!r.ok) { panel('<div class="verif mal"><b>No se pudo cerrar.</b><br>' + esc(r.error || 'Error sin detalle') + '</div><p class="ayuda">Lo diligenciado sigue en pantalla.</p><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>'); return; }
    // Verificación: se vuelve a leer y se confirma que quedó cerrado y con la firma.
    let v = null;
    try { v = await (await fetchWithRetry(urlAts() + '?code=' + encodeURIComponent(a.code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN))).json(); } catch (e) { v = null; }
    const bien = v && v.ok && v.estado === 'CERRADO' && v.ats.cierre && typeof v.ats.cierre.firma === 'string' && v.ats.cierre.firma.length > 100;
    if (r.yaCerrado) {
      panel('<div class="verif cola"><b>Este ATS ya lo había cerrado ' + esc(r.cerradoPor || 'otra persona') + '</b> (' + esc(r.motivo || '') + '). Vale ese primer cierre.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    } else if (!v || !v.ok) {
      panel('<div class="verif cola"><b>Se cerró, pero no se pudo comprobar.</b><br>Cuando tengas señal, búscalo en el historial para confirmar.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
    } else if (!bien) {
      panel('<div class="verif mal"><b>⚠️ El servidor no muestra el cierre completo.</b><br>Vuelve a intentarlo.</div><div class="acciones-tareas"><button type="button" class="btn" data-cerrar>Entendido</button></div>');
      return;
    }
    try { localStorage.removeItem(claveCierre(a.code)); } catch (e) {}
    if (v && v.ok) {
      atsRef = Object.assign(nuevoAts(), v.ats, { code: v.code, version: Number(v.version) || 1, sucio: false, estado: v.estado });
      atsRef.cab = Object.assign(nuevoAts().cab, v.ats.cab);
      // Si el borrador principal es este mismo ATS, queda igual al cerrado.
      if (ats.code === v.code) {
        ats = JSON.parse(JSON.stringify(atsRef)); ats.subidoEn = new Date().toISOString();
        DraftStore.save(CLAVE_BORRADOR, ats);
      }
    }
    document.body.classList.toggle('ref-cerrado', atsRef.estado === 'CERRADO');
    pintarModoCerrar();
    window.scrollTo(0, 0);
    if (bien && !r.yaCerrado) {
      panel('<div class="verif bien"><b>✓ ' + esc(a.code) + ' cerrado y verificado</b><br>' + esc(k.motivo) + ' · ' + esc(fechaCO(k.fecha)) + ' ' + esc(k.hora) + ' · cerró ' + esc(k.nombre) + '</div>' +
        '<div class="acciones-tareas"><button type="button" class="btn sec" id="btnImprimirCerrado">🖨️ Ver e imprimir</button><button type="button" class="btn" id="btnMenuTrasCerrar">Volver al menú</button></div>');
      $('btnImprimirCerrado').addEventListener('click', () => { cerrarPanel(); verRefCompleto(); });
      $('btnMenuTrasCerrar').addEventListener('click', () => { cerrarPanel(); irAlMenu(); });
    }
  } finally {
    btn.disabled = false; btn.textContent = '✅ Cerrar ATS';
  }
}
function salirModoCerrar() {
  guardarYa(); guardarCierreLocal();
  atsRef = null; cierre = null;
  if (origenModo === 'editor') irAlEditor(); else irAlMenu();
}
/* La hoja completa de un ATS del servidor, sin tocar el borrador principal. */
function verRefCompleto() {
  const propio = ats; ats = atsRef; try { armarHoja(); } finally { ats = propio; }
  document.body.classList.add('previa'); window.scrollTo(0, 0);
}
$('btnConfirmarCierre').addEventListener('click', confirmarCierre);
$('btnSalirCerrar').addEventListener('click', salirModoCerrar);
$('btnVerAtsCerrar').addEventListener('click', verRefCompleto);

/* ================= MENÚ Y NAVEGACIÓN ================= */
let origenModo = 'menu';   // a dónde vuelve "Salir" de los modos agregar/cerrar
function irAlMenu() {
  guardarYa();
  document.body.classList.remove('modo-agregar', 'modo-cerrar', 'ref-cerrado', 'previa');
  document.body.classList.add('en-menu');
  atsRef = null; nuevos = []; cierre = null; cacheLista = null;
  history.replaceState(null, '', location.pathname);
  pintarMenu();
  window.scrollTo(0, 0);
}
function irAlEditor() {
  document.body.classList.remove('en-menu', 'modo-agregar', 'modo-cerrar', 'ref-cerrado', 'previa');
  history.replaceState(null, '', location.pathname + (ats.code ? '?code=' + encodeURIComponent(ats.code) : ''));
  // Se vuelve a pintar con la página ya visible: los lienzos de firma
  // necesitan su tamaño real.
  cargarTodo(); actualizarEstado();
  window.scrollTo(0, 0);
}
function hayBorrador() { return !!(ats.tareas.length || ats.participantes.length || (ats.cab.trabajo || '').trim()); }
function pintarMenu() {
  const hay = hayBorrador();
  $('menuContinuar').hidden = !hay;
  $('menuEnCurso').hidden = !hay;
  $('menuNuevo').className = hay ? 'btn sec' : 'btn';
  if (hay) {
    $('menuEnCurso').innerHTML = '<b>En curso en este dispositivo:</b> ' + esc((ats.cab.trabajo || '(sin trabajo escrito)').slice(0, 90)) + '<br>' +
      ats.tareas.length + ' tareas · ' + ats.participantes.length + ' participantes · ' +
      (ats.code ? esc(ats.code) + (ats.estado === 'CERRADO' ? ' (cerrado)' : ats.sucio ? ' (cambios sin subir)' : ' (en el servidor)') : 'sin subir al servidor');
  }
  const srv = !!urlAts();
  ['opCerrar', 'opAgregar'].forEach((id) => {
    const op = $(id);
    op.querySelectorAll('button,input').forEach((b) => { b.disabled = !srv; });
    let aviso = op.querySelector('.sin-srv');
    if (!srv && !aviso) { aviso = document.createElement('div'); aviso.className = 'sin-srv'; aviso.textContent = 'Necesita el guardado en línea del ATS (avisa al líder SST).'; op.appendChild(aviso); }
  });
}
let cacheLista = null;
async function listaServidor(forzar) {
  if (!forzar && cacheLista && Date.now() - cacheLista.t < 30000) return cacheLista.rows;
  const res = await fetchWithRetry(urlAts() + '?list=1&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
  const r = await res.json();
  if (!r.ok) throw new Error(r.error || 'error sin detalle');
  cacheLista = { t: Date.now(), rows: r.rows };
  return r.rows;
}
const f10 = (x) => (x ? String(x).slice(0, 10) : '');
function filaLista(x, botones) {
  const cerrado = x.estado === 'CERRADO';
  return '<div class="pl-item" data-revisar="' + esc(x.code) + '"><span><b>' + esc(x.code) + '</b><span class="etiqueta-estado ' + (cerrado ? 'cerrado">CERRADO' : 'abierto">ABIERTO') + '</span>' +
    (atsVencido(x) ? '<span class="etiqueta-estado vencido">VENCIDO</span>' : '') +
    '<small><br>' + esc(fechaCO(f10(x.fechaDesde))) + (x.fechaHasta ? ' al ' + esc(fechaCO(f10(x.fechaHasta))) : '') + ' · ' + esc([x.centroCostos, x.area].filter(Boolean).join(' · ')) + '<br>' +
    esc(x.trabajo || '') + '<br>' + x.participantes + ' participantes (' + x.firmasParticipantes + ' firmados)' +
    (cerrado ? '<br>Cerrado: ' + esc(x.motivoCierre || '') + (x.cerradoPor ? ' · ' + esc(x.cerradoPor) : '') : '') + '</small><span class="toca">👁 Toca para revisarlo</span></span>' +
    '<span style="display:flex;flex-direction:column;gap:6px;">' + botones + '</span></div>';
}
async function pintarLista(cont, filtro, botones, vacio, conBuscador) {
  cont.innerHTML = '<p class="ayuda">Cargando…</p>';
  let rows;
  try { rows = await listaServidor(); } catch (e) {
    cont.innerHTML = '<p class="ayuda">' + esc(motivoFallaSrv(e)) + '</p>';
    return;
  }
  const todos = rows.filter(filtro);
  const pintar = (q) => {
    const n = norm(q || '');
    const vis = todos.filter((x) => !n || norm([x.code, x.trabajo, x.area, x.centroCostos, x.cerradoPor, x.lider].join(' ')).includes(n)).slice(0, 40);
    const lista = cont.querySelector('.filas');
    lista.innerHTML = vis.length ? vis.map((x) => filaLista(x, botones(x))).join('') : '<p class="ayuda">' + esc(n ? 'Nada coincide con la búsqueda.' : vacio) + '</p>';
    lista.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener('click', () => {
      const code = b.dataset.code;
      if (b.dataset.accion === 'cerrar' || b.dataset.accion === 'ver') entrarModoCerrar(code, 'menu');
      else if (b.dataset.accion === 'personal') entrarModoAgregar(code, 'menu');
    }));
    tarjetasRevisables(lista, 'menu');
  };
  cont.innerHTML = (conBuscador ? '<input type="text" class="inp" placeholder="Buscar por código, trabajo, área o quién cerró…" style="margin:4px 0 6px;">' : '') + '<div class="filas"></div>';
  if (conBuscador) cont.querySelector('input').addEventListener('input', (e) => pintar(e.target.value));
  pintar('');
}
const botonLista = (accion, code, texto) => '<button type="button" class="btn-mini u-m0" data-accion="' + accion + '" data-code="' + esc(code) + '">' + texto + '</button>';
$('menuContinuar').addEventListener('click', irAlEditor);
$('menuNuevo').addEventListener('click', async () => { if (await empezarNuevo()) irAlEditor(); });
// v137: «Repetir el último ATS»: para trabajos de varios días. Llega sin firmas y con fecha de hoy;
// al guardar pide confirmar que se revisaron las condiciones de hoy.
(function () {
  let info = null; try { info = JSON.parse(localStorage.getItem('ssta-ats-ultimo-info') || 'null'); } catch (e) {}
  const b = $('menuRepetir'); if (!b || !info) return;
  b.hidden = false; b.textContent = 'Repetir el último ATS' + (info.trabajo ? ': ' + info.trabajo : '') + (info.fecha ? ' (' + info.fecha.split('-').reverse().join('/') + ')' : '');
  b.addEventListener('click', async () => {
    let src = null; try { src = JSON.parse(localStorage.getItem('ssta-ats-ultimo') || 'null'); } catch (e) {}
    if (!src) { b.hidden = true; return; }
    const aSalvo = ats.code && !ats.sucio, hayLocal = ats.tareas.length || ats.participantes.length || (ats.cab.trabajo || '').trim();
    if (!aSalvo && hayLocal && !await Dialogo.confirmar('El ATS que tienes en este equipo tiene cambios sin subir y se reemplaza por la copia. ¿Continuar?')) return;
    ats = copiaSinFirmas(src, true); editando = null; ultimaGuardada = null;
    DraftStore.save(CLAVE_BORRADOR, ats); cargarTodo(); actualizarEstado(); irAlEditor();
    toast('Copia con fecha de hoy y sin firmas. Revisa en el sitio las condiciones de hoy y que todos firmen.');
  });
})();
$('menuAbrirGuardado').addEventListener('click', () => { irAlEditor(); $('btnPlantillas').click(); });
$('menuBuscarCerrar').addEventListener('click', () => { const c = $('menuCodCerrar').value.trim(); if (!c) { $('menuCodCerrar').focus(); return; } entrarModoCerrar(c, 'menu'); });
$('menuBuscarAgregar').addEventListener('click', () => { const c = $('menuCodAgregar').value.trim(); if (!c) { $('menuCodAgregar').focus(); return; } entrarModoAgregar(c, 'menu'); });
$('menuCodCerrar').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('menuBuscarCerrar').click(); });
$('menuCodAgregar').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('menuBuscarAgregar').click(); });
$('menuAbiertosCerrar').addEventListener('click', () => pintarLista($('menuListaCerrar'), (x) => x.estado !== 'CERRADO',
  (x) => botonLista('cerrar', x.code, 'Cerrar'), 'No hay ATS abiertos.', true));
$('menuHistorial').addEventListener('click', () => pintarLista($('menuListaCerrar'), (x) => x.estado === 'CERRADO',
  (x) => botonLista('ver', x.code, 'Ver'), 'Todavía no hay ATS cerrados.', true));
$('menuAbiertosAgregar').addEventListener('click', () => pintarLista($('menuListaAgregar'), (x) => x.estado !== 'CERRADO',
  (x) => botonLista('personal', x.code, '+ Personal'), 'No hay ATS abiertos.', true));
$('btnIrMenu').addEventListener('click', irAlMenu);

/* ================= PANEL / PLANTILLAS ================= */
function panel(html) { $('panelCaja').innerHTML = html; $('panel').classList.add('show'); document.body.classList.add('con-panel'); $('panelCaja').querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', cerrarPanel)); }
function cerrarPanel() { $('panel').classList.remove('show'); document.body.classList.remove('con-panel'); }
$('panel').addEventListener('click', (e) => { if (e.target === $('panel')) cerrarPanel(); });
function leerPlantillas() { try { return JSON.parse(localStorage.getItem(CLAVE_PLANTILLAS) || '[]'); } catch (e) { return []; } }
function escribirPlantillas(l) { try { localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(l)); return true; } catch (e) { return false; } }
/* Una plantilla guarda el trabajo y las tareas, pero no fechas, personas ni
   firmas: sirve para el ATS que se repite (ej. la bodega cada semana). */
function comoPlantilla() {
  const c = JSON.parse(JSON.stringify(ats));
  c.participantes = [];
  c.firmas = nuevoAts().firmas;
  c.cab.desde = ''; c.cab.hasta = '';
  c.code = null; c.version = 0; c.subidoEn = null; c.sucio = false;
  return c;
}
$('btnPlantillas').addEventListener('click', () => {
  const l = leerPlantillas();
  panel((ats.tareas.length ? '<button type="button" class="copia-op" id="cpActual" style="margin:0 0 14px;">📋 Copiar el ATS actual como nuevo<small>Mismas tareas y controles, fecha de hoy, sin firmas.</small></button>' : '') +
    (urlAts() ? '<h3>ATS guardados en el servidor</h3><div id="srvLista"><p class="ayuda">Cargando…</p></div>' : '') +
    '<h3' + (urlAts() ? ' style="margin-top:18px;"' : '') + '>Plantillas de ATS</h3><p class="ayuda">Guarda un ATS que se repite (por ejemplo, la bodega semanal) y cárgalo la próxima vez: trae el trabajo, las tareas, el EPP y las herramientas, pero sin fechas, participantes ni firmas. Se guardan en este dispositivo.</p>' +
    '<div id="plLista">' + (l.length ? l.map((p, i) => '<div class="pl-item"><span><b>' + esc(p.nombre) + '</b><small>' + p.data.tareas.length + ' tareas · ' + esc(p.fecha) + '</small></span><span><button type="button" class="btn-mini" data-cargar="' + i + '">Usar</button> <button type="button" class="btn-mini" style="border-color:var(--rojo-200);color:var(--rojo-800);" data-borrar="' + i + '">✕</button></span></div>').join('') : '<p class="ayuda">Todavía no hay plantillas.</p>') + '</div>' +
    '<div class="field" style="margin-top:14px;"><label>Guardar el ATS actual como plantilla</label><input type="text" class="inp" id="plNombre" placeholder="Nombre: ej. Bodega semanal"></div>' +
    '<div class="acciones-tareas"><button type="button" class="btn" id="plGuardar">Guardar plantilla</button><button type="button" class="btn sec" data-cerrar>Cerrar</button><button type="button" class="btn peligro" id="plNuevo">Empezar ATS nuevo</button></div>');
  if ($('cpActual')) $('cpActual').addEventListener('click', () => preguntarCopia(ats));
  $('plNombre').value = (ats.cab.trabajo || '').slice(0, 60);
  $('plGuardar').addEventListener('click', async () => {
    const nombre = $('plNombre').value.trim();
    if (!nombre) { $('plNombre').focus(); return; }
    if (!ats.tareas.length) { await Dialogo.avisar('El ATS no tiene tareas: no hay nada que guardar como plantilla.'); return; }
    const lista2 = leerPlantillas().filter((p) => p.nombre !== nombre);
    lista2.unshift({ nombre, fecha: new Date().toLocaleDateString('es-CO'), data: comoPlantilla() });
    if (!escribirPlantillas(lista2)) { await Dialogo.avisar('No se pudo guardar: la memoria del dispositivo está llena.'); return; }
    cerrarPanel(); toast('Plantilla «' + nombre + '» guardada.');
  });
  $('panelCaja').querySelectorAll('[data-cargar]').forEach((b) => b.addEventListener('click', async () => {
    if (ats.tareas.length && !await Dialogo.confirmar('Esto reemplaza el ATS que tienes abierto. ¿Continuar?')) return;
    const p = leerPlantillas()[+b.dataset.cargar];
    ats = Object.assign(nuevoAts(), JSON.parse(JSON.stringify(p.data)));
    ats.code = null; ats.version = 0; ats.subidoEn = null; // una plantilla da un ATS NUEVO
    ats.cab.desde = hoyISO();
    ats.tareas.forEach((t) => { t.uid = uid(); });
    cerrarPanel(); cargarTodo(); guardar(); toast('Plantilla cargada. Revisa las fechas, agrega participantes y firmas.');
  }));
  $('panelCaja').querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', async () => {
    const l2 = leerPlantillas(); const p = l2[+b.dataset.borrar];
    if (!await Dialogo.confirmar('¿Borrar la plantilla «' + p.nombre + '»?')) return;
    l2.splice(+b.dataset.borrar, 1); escribirPlantillas(l2); $('btnPlantillas').click();
  }));
  $('plNuevo').addEventListener('click', () => { cerrarPanel(); empezarNuevo(); });
  if (urlAts()) pintarListaServidor();
});
async function pintarListaServidor() {
  const cont = $('srvLista');
  try {
    const res = await fetchWithRetry(urlAts() + '?list=1&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
    const r = await res.json();
    if (!document.body.contains(cont)) return;
    if (!r.ok) { cont.innerHTML = '<p class="ayuda">No se pudo consultar: ' + esc(r.error || '') + '</p>'; return; }
    if (!r.rows.length) { cont.innerHTML = '<p class="ayuda">Todavía no hay ATS guardados.</p>'; return; }
    const f = (x) => (x ? String(x).slice(0, 10) : '');
    cont.innerHTML = r.rows.slice(0, 40).map((x) =>
      '<div class="pl-item" data-revisar="' + esc(x.code) + '"><span><b>' + esc(x.code) + (x.code === ats.code ? ' · en este equipo' : '') + '</b><span class="etiqueta-estado ' + (x.estado === 'CERRADO' ? 'cerrado">CERRADO' : 'abierto">ABIERTO') + '</span><small><br>' + esc(f(x.fechaDesde)) + (x.fechaHasta ? ' al ' + esc(f(x.fechaHasta)) : '') + ' · ' + esc(x.centroCostos || '') + ' · ' + esc(x.area || '') + '<br>' + esc(x.trabajo || '') + '<br>' +
      x.tareas + ' tareas · ' + x.participantes + ' participantes (' + x.firmasParticipantes + ' firmados) · v' + x.version + '</small><span class="toca">👁 Toca para revisarlo</span></span>' +
      '<span style="display:flex;flex-direction:column;gap:6px;"><button type="button" class="btn-mini u-m0" data-abrir="' + esc(x.code) + '">Abrir</button><button type="button" class="btn-mini u-m0" data-copiar="' + esc(x.code) + '">Copiar</button>' + (x.estado === 'CERRADO' ? '' : '<button type="button" class="btn-mini u-m0" data-personal="' + esc(x.code) + '">+ Personal</button><button type="button" class="btn-mini u-m0" data-cerrarats="' + esc(x.code) + '">Cerrar</button>') + '</span></div>').join('');
    cont.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => { cerrarPanel(); cargarDesdeServidor(b.dataset.abrir); }));
    cont.querySelectorAll('[data-personal]').forEach((b) => b.addEventListener('click', () => { cerrarPanel(); entrarModoAgregar(b.dataset.personal, 'editor'); }));
    cont.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiarDelServidor(b.dataset.copiar)));
    cont.querySelectorAll('[data-cerrarats]').forEach((b) => b.addEventListener('click', () => { cerrarPanel(); entrarModoCerrar(b.dataset.cerrarats, 'editor'); }));
    tarjetasRevisables(cont, 'editor', cerrarPanel);
  } catch (e) {
    if (document.body.contains(cont)) cont.innerHTML = '<p class="ayuda">' + esc(motivoFallaSrv(e)) + '</p>';
  }
}

/* ================= INICIO ================= */
async function empezarNuevo() {
  // Si el ATS en curso ya está completo en el servidor, no hay nada que perder.
  const aSalvo = ats.code && !ats.sucio;
  if (!aSalvo && (ats.tareas.length || ats.participantes.length) && !await Dialogo.confirmar('¿Empezar un ATS nuevo? El actual se borra de este dispositivo (guárdalo antes como plantilla o PDF si lo necesitas).')) return false;
  ats = nuevoAts(); editando = null; ultimaGuardada = null;
  DraftStore.clear(CLAVE_BORRADOR);
  $('bannerBorrador').classList.remove('show');
  cargarTodo(); actualizarEstado();
  window.scrollTo(0, 0);
  return true;
}
$('btnCerrarEste').addEventListener('click', async () => {
  if (ats.sucio && !await Dialogo.confirmar('Este ATS tiene cambios sin subir. Si lo cierras ahora, esos cambios no quedan en el servidor. ¿Seguir al cierre de todas formas?')) return;
  entrarModoCerrar(ats.code, 'editor');
});
$('btnNuevoDesdeBanner').addEventListener('click', empezarNuevo);
function cargarTodo() {
  cargarCamposCab(); renderCab(); renderTodoTareas(); renderParticipantes(); renderFirmasFin(); renderAlertaPermisos();
}
/* v159 · ATS precargado desde un permiso: el trabajo, el sitio, las fechas, la cuadrilla y el tipo de permiso. */
async function atsDesdePermiso() {
  let d = null; try { d = JSON.parse(sessionStorage.getItem('ssta-ats-desde') || 'null'); sessionStorage.removeItem('ssta-ats-desde'); } catch (e) {}
  if (!d) return;
  if ((ats.tareas.length || ats.participantes.length) && !(ats.code && !ats.sucio) && !await Dialogo.confirmar('Tienes un ATS a medias en este equipo. ¿Reemplazarlo por uno nuevo con los datos del permiso?')) { irAlEditor(); return; }
  ats = nuevoAts(); DraftStore.clear(CLAVE_BORRADOR);
  const c = ats.cab;
  c.trabajo = d.trabajo || ''; c.area = d.area || ''; if (d.desde) c.desde = d.desde; if (d.hasta) c.hasta = d.hasta;
  if (d.horaDesde) c.horaDesde = d.horaDesde; if (d.horaHasta) c.horaHasta = d.horaHasta;
  if (d.permiso) { c.requiere = 'SI'; c.permisos = [d.permiso]; }
  (d.personas || []).forEach((p) => { const n = String(p.nombre || '').trim().split(/\s+/), corte = n.length > 2 ? 2 : 1;
    ats.participantes.push({ uid: uid(), nombres: n.slice(0, corte).join(' '), apellidos: n.slice(corte).join(' '), cedula: String(p.cedula || ''), cargo: p.cargo || '', firma: null, tardio: false, socializado: false, ingreso: null }); });
  irAlEditor(); guardar();
  toast('ATS precargado con ' + (d.personas || []).length + ' persona(s) del permiso' + (d.permisoCode ? ' ' + d.permisoCode : '') + '. Agrega las tareas y firmen.');
}
(function iniciar() {
  const b = DraftStore.load(CLAVE_BORRADOR);
  if (b && b.data && b.data.v === 1) {
    const base = nuevoAts();
    ats = Object.assign(base, b.data);
    ats.cab = Object.assign(base.cab, b.data.cab);
    const hayAlgo = ats.tareas.length || ats.participantes.length || ats.cab.trabajo;
    if (hayAlgo) {
      $('bannerTexto').textContent = 'Se recuperó el ATS en curso (guardado ' + formatSavedAt(b.savedAt) + ').';
      $('bannerBorrador').classList.add('show');
    }
  }
  actualizarEstado();
  // Se entra por el menú (como en los permisos). Un enlace directo va al modo
  // que pide: ?code=…&agregar=1 (QR de la hoja), ?code=…&cerrar=1, o ?code=…
  // para abrirlo en el editor.
  const qs = new URLSearchParams(location.search);
  const codeUrl = qs.get('code');
  pintarMenu();
  if (qs.get('desde') === 'permiso') { atsDesdePermiso(); return; }
  if (codeUrl && qs.get('ver') === '1') revisarAts(codeUrl, 'menu');
  else if (codeUrl && qs.get('agregar') === '1') entrarModoAgregar(codeUrl, 'menu');
  else if (codeUrl && qs.get('cerrar') === '1') entrarModoCerrar(codeUrl, 'menu');
  else if (codeUrl && codeUrl !== ats.code) cargarDesdeServidor(codeUrl);
  else if (codeUrl) irAlEditor();
  if (urlAts()) { OutboxBadge.init(); Outbox.flush(); }
  Jornada.barra();
  // Personal habilitado: aviso debajo de la cédula de cada participante.
  Habilitacion.vigilar(document, 'input[data-f="cedula"]', contextoHabAts);
})();
window.addEventListener('load', () => { if (typeof UpdateManager !== 'undefined') UpdateManager.init(); });
