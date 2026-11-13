/* ============================================================
   common.js — Utilidades compartidas del Portal SSTA
   Usado por todas las pantallas del portal.

   v167 · ESTE ARCHIVO SE GENERA: no lo edites a mano. Su código vive en
   fuente/common/ (un archivo por tema). Cambia la parte y corre
   node herramientas/armar-common.js
   ============================================================ */

/**
 * esc: escapa texto antes de insertarlo con innerHTML. Los datos que
 * vienen de la hoja de cálculo (nombres, sitios, responsables, cédulas)
 * los escribe cualquier persona con acceso al formulario — sin escapar,
 * un valor como <img src=x onerror=...> se ejecutaría en el navegador
 * de quien lo vea después (dashboard, listas de permisos abiertos, etc).
 */
/** v145: solo una imagen de verdad (o un enlace https) puede ir en src: nada con comillas ni código. */
function srcSeguro(v) { v = String(v || ''); return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) || /^https:\/\/[^"'<>\s]+$/.test(v) ? v : ''; }
function esc(v){
  return String(v==null?'':v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/**
 * fetchWithRetry: como fetch(), pero reintenta automáticamente si hay
 * un fallo de red (típico en zonas de planta con señal débil), con
 * espera creciente entre intentos.
 */
/* ── v120: los módulos por ?modulo= y no por /módulo ──
   Con algunas cuentas, Google pide iniciar sesión en «…/exec/sgsst» aunque «…/exec» esté abierta
   para cualquier usuario (caso real). El servidor único ya entiende «?modulo=sgsst», así que aquí se
   reescribe toda llamada a «…/exec/<módulo>» (de cualquier servidor, también los de los clientes desde
   la consola). Si viaja como consulta por POST, el módulo va también dentro de la consulta. */
(function () {
  if (typeof window === 'undefined' || !window.fetch) return;
  const original = window.fetch.bind(window);
  // Cualquier servidor «…/exec/<módulo>» (Google, y la demo, que así prueba este mismo camino).
  const RE = /^(https?:\/\/[^?#]+\/exec)\/([a-z]+)\/?(\?.*)?$/;
  window.fetch = function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : '';
    const m = RE.exec(url);
    if (!m) return original(entrada, opciones);
    const nueva = m[1] + '?modulo=' + m[2] + (m[3] ? '&' + m[3].slice(1) : '');
    if (opciones && typeof opciones.body === 'string' && opciones.body.indexOf('__consulta') !== -1) {
      try { const b = JSON.parse(opciones.body); if (b && b.__consulta && !b.__consulta.modulo) { b.__consulta.modulo = m[2]; opciones = Object.assign({}, opciones, { body: JSON.stringify(b) }); } } catch (e) {}
    }
    return original(nueva, opciones);
  };
})();

/* ── v110: la clave del portal y la sesión no viajan en la dirección ──
   Las consultas al servidor (GET con token= o sesion=) se mandan por POST con
   { __consulta: {…} }: la dirección queda limpia y la clave no queda en los
   registros. Solo si el servidor único de la empresa lo anuncia en su raíz
   («consultaPost»); con un servidor sin actualizar sigue el GET de siempre. */
(function () {
  if (typeof window === 'undefined' || !window.fetch || typeof EMPRESA === 'undefined' || !EMPRESA.servidor) return;
  const base = String(EMPRESA.servidor).replace(/\/+$/, '');
  const LS = 'ssta-consulta-post|' + base, original = window.fetch.bind(window);
  let modo = null, pendiente = null;
  try { const g = JSON.parse(localStorage.getItem(LS) || 'null'); if (g && (g.m === 'si' || Date.now() - g.t < 6 * 3600000)) modo = g.m; } catch (e) {}
  function averiguar() {
    if (modo) return Promise.resolve(modo);
    if (!pendiente) pendiente = original(base).then((r) => r.json()).then((j) => {
      modo = j && Array.isArray(j.capacidades) && j.capacidades.indexOf('consultaPost') !== -1 ? 'si' : 'no';
      try { localStorage.setItem(LS, JSON.stringify({ m: modo, t: Date.now() })); } catch (e) {}
      return modo;
    }).catch(() => { pendiente = null; return 'no'; });   // sin señal: se vuelve a averiguar después
    return pendiente;
  }
  // Sesion se define más abajo en este archivo; cuando se hace una petición ya existe.
  function sesionActual() { try { return (typeof Sesion !== 'undefined' && Sesion.token()) || ''; } catch (e) { return ''; } }
  window.ConsultaPost = { averiguar, modo: () => modo };
  window.fetch = async function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || '';
    const metodo = String((opciones && opciones.method) || (entrada && typeof entrada !== 'string' && entrada.method) || 'GET').toUpperCase();
    // v112: los permisos, el ATS, las charlas, el EPP y el personal piden usuario también en el
    // servidor: todo envío al servidor del portal lleva la sesión de quien entró (si no la trae ya).
    if (metodo === 'POST' && url.indexOf(base + '/') === 0 && opciones && typeof opciones.body === 'string') {
      const ses = sesionActual();
      if (ses) { try { const b = JSON.parse(opciones.body); if (b && typeof b === 'object' && !Array.isArray(b) && !b.sesion && !b.__consulta) { b.sesion = ses; opciones = Object.assign({}, opciones, { body: JSON.stringify(b) }); } } catch (e) {} }
    }
    if (metodo !== 'GET' || url.indexOf(base + '/') !== 0 || !/[?&](token|sesion)=/.test(url)) return original(entrada, opciones);
    if ((await averiguar()) !== 'si') return original(entrada, opciones);
    const u = new URL(url), consulta = {};
    u.searchParams.forEach((v, k) => { consulta[k] = v; });
    if (!consulta.sesion) { const ses = sesionActual(); if (ses) consulta.sesion = ses; }
    u.search = '';
    return original(u.toString(), Object.assign({}, opciones, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ __consulta: consulta }) }));
  };
})();
/* v137 · Sello de las firmas: todo envío que lleva una firma va con el equipo (navegador) y, si la persona
   lo permitió, la ubicación GPS. El servidor les pone su hora, la huella y el código de verificación. */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.fetch) return;
  let gps = null; try { gps = JSON.parse(sessionStorage.getItem('ssta-gps') || 'null'); } catch (e) {}
  let pedido = false;
  function pedirGps() {
    if (pedido || gps || !navigator.geolocation) return; pedido = true;
    try { navigator.geolocation.getCurrentPosition((p) => { gps = { lat: p.coords.latitude, lon: p.coords.longitude, prec: p.coords.accuracy, t: Date.now() }; try { sessionStorage.setItem('ssta-gps', JSON.stringify(gps)); } catch (e) {} }, () => {}, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }); } catch (e) {}
  }
  // Se pide la ubicación al empezar a firmar (no al abrir la página).
  document.addEventListener('pointerdown', (e) => { const c = e.target && e.target.closest && e.target.closest('canvas'); if (c && /firma|sig|pad/i.test((c.id || '') + ' ' + (c.className || '') + ' ' + ((c.parentElement && c.parentElement.className) || ''))) pedirGps(); }, true);
  const previo = window.fetch;
  // v141: el equipo y el GPS solo viajan cuando hay una FIRMA (no con fotos sueltas). Si alguna
  // firma es «sin trazo», se manda su huella con el nombre y la cédula para que el sello lo diga.
  const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const alternasDe = (o, out, prof) => { if (!o || typeof o !== 'object' || prof > 12) return out; Object.keys(o).forEach((k) => { const v = o[k]; if (typeof v === 'string' && /firma|sig/i.test(k) && v.indexOf('data:image') === 0 && typeof FirmaAlterna !== 'undefined' && FirmaAlterna._mapa.has(v)) out.push([v, FirmaAlterna._mapa.get(v)]); else if (v && typeof v === 'object') alternasDe(v, out, prof + 1); }); return out; };
  window.fetch = function (entrada, opciones) {
    try {
      if (opciones && typeof opciones.body === 'string' && String(opciones.method || '').toUpperCase() === 'POST' && /"[^"]*(?:firma|sig)[^"]*"\s*:\s*"data:image/i.test(opciones.body)) {
        const b = JSON.parse(opciones.body);
        if (b && typeof b === 'object' && !Array.isArray(b) && !b._disp) {
          b._disp = { ua: navigator.userAgent, gps: gps && Date.now() - gps.t < 3600000 ? { lat: gps.lat, lon: gps.lon, prec: gps.prec } : null };
          const alt = alternasDe(b, [], 0);
          if (alt.length && window.crypto && crypto.subtle) {
            const self = this;
            return Promise.all(alt.map(([v, a]) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)).then((h) => ({ huella: hex(h), nombre: a.nombre, cedula: a.cedula }))))
              .then((l) => { b._disp.alternas = l; return previo.call(self, entrada, Object.assign({}, opciones, { body: JSON.stringify(b) })); });
          }
          opciones = Object.assign({}, opciones, { body: JSON.stringify(b) });
        }
      }
    } catch (e) {}
    return previo.call(this, entrada, opciones);
  };
  window.SelloFirmas = { pedirGps };
})();

/* v144: con señal débil (el celular cree que hay red pero no pasa nada) la petición ya no espera para
   siempre: se corta a los 25 s (lecturas) o 60 s (envíos). Un envío pesado (fotos) que falla NO se vuelve a
   subir dos veces más: se reporta y el que llamó lo deja en la cola para cuando vuelva la señal. */
async function fetchWithRetry(url, options, retries = 2, backoffMs = 800) {
  let lastErr;
  const esPost = options && String(options.method || '').toUpperCase() === 'POST';
  const pesado = esPost && typeof options.body === 'string' && options.body.length > 200000;
  if (pesado) retries = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = typeof AbortController !== 'undefined' && !(options && options.signal) ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), esPost ? 60000 : 25000) : null;
    try {
      const res = await fetch(url, ctl ? Object.assign({}, options, { signal: ctl.signal }) : options);
      if (t) clearTimeout(t);
      // Si un backend rechaza la clave del portal, se pide aquí, en un solo
      // lugar, para todas las páginas (sin tocar cómo lee cada una la respuesta).
      if (String(url).indexOf('script.google') !== -1 && res && res.clone) {
        res.clone().json().then((j) => { if (ClavePortal.esErrorDeClave(j)) ClavePortal.pedir(); }).catch(() => {});
      }
      return res;
    } catch (err) {
      if (t) clearTimeout(t);
      lastErr = err && err.name === 'AbortError' ? new Error('La red tardó demasiado (señal débil)') : err;
      // v145: un envío cortado por tiempo pudo haber llegado: solo se repite si trae opId (el servidor lo reconoce)
      if (err && err.name === 'AbortError' && esPost && !/"opId"\s*:\s*"[^"]+"/.test(String(options.body || ''))) break;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/* ================= CLAVE DEL PORTAL =================
   El token de config.js es público (GitHub): cualquiera con él podía leer
   nombres, cédulas y firmas. Ahora cada backend puede exigir una CLAVE que
   no está en GitHub: se escribe una vez en cada celular y queda guardada
   en ese equipo. Mientras un equipo no tenga clave, se sigue usando el
   token de config.js (los backends que aún no tengan clave lo aceptan). */
/* v115: la consola del administrador (admin.html, asesor.html) guarda su sesión y su
   clave aparte (ssta-admin-…): en el mismo equipo no se mezclan con las de un cliente. */
const Consola = {
  activa() { return typeof EMPRESA !== 'undefined' && !!EMPRESA.consola; },
  clave(k) { return this.activa() ? k.replace(/^ssta-/, 'ssta-admin-') : k; },
  /** ¿En este equipo entró el administrador general? (ve los detalles técnicos). */
  esEquipoAdmin() {
    try { const s = JSON.parse(localStorage.getItem('ssta-admin-sesion') || 'null'); return !!(s && s.token && s.exp > Date.now() && s.yo && s.yo.rol === 'admin'); } catch (e) { return false; }
  }
};
const ClavePortal = {
  get KEY() { return Consola.clave('ssta-clave-portal'); },
  get() { try { return localStorage.getItem(this.KEY) || ''; } catch (e) { return ''; } },
  tiene() { return !!this.get(); },
  guardar(v) {
    try { if (v) localStorage.setItem(this.KEY, v); else localStorage.removeItem(this.KEY); } catch (e) { /* modo privado */ }
    this.aplicar();
  },
  aplicar() {
    if (typeof PORTAL_CONFIG === 'undefined') return;
    if (PORTAL_CONFIG._tokenOriginal === undefined) PORTAL_CONFIG._tokenOriginal = PORTAL_CONFIG.API_TOKEN;
    PORTAL_CONFIG.API_TOKEN = this.get() || PORTAL_CONFIG._tokenOriginal;
  },
  esErrorDeClave(j) {
    return !!(j && j.ok === false && (j.codigoError === 'CLAVE' || /token inv[aá]lido/i.test(String(j.error || ''))));
  },
  _abierto: false,
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body) return;
    if (document.body.hasAttribute('data-sin-clave')) return;   // v174: el auditor entra con su enlace; nunca se le pide la clave del portal
    this._abierto = true;
    const tenia = this.tiene();
    const fondo = document.createElement('div');
    fondo.className = 'clave-fondo';
    fondo.innerHTML =
      '<div class="clave-caja" role="dialog" aria-modal="true" aria-labelledby="claveTitulo">' +
      '<h3 id="claveTitulo">🔑 Clave del portal</h3>' +
      '<p>' + esc(motivo || (tenia
        ? 'El servidor no aceptó la clave guardada en este equipo. Escribe la clave vigente (la da el área SSTA).'
        : 'Para ver y guardar datos del personal, este equipo necesita la clave del portal. Se escribe una sola vez: queda guardada en este celular.')) + '</p>' +
      '<input type="password" id="claveInput" autocomplete="current-password" placeholder="Clave del portal">' +
      '<label class="clave-ver"><input type="checkbox" id="claveVer"> Mostrar</label>' +
      '<div class="clave-acc"><button type="button" class="btn-main" id="claveGuardar">Guardar clave</button>' +
      '<button type="button" class="btn-secondary" id="claveCancelar">Ahora no</button></div>' +
      (tenia ? '<button type="button" class="clave-quitar" id="claveQuitar">Quitar la clave de este equipo</button>' : '') +
      '</div>';
    document.body.appendChild(fondo);
    const inp = fondo.querySelector('#claveInput');
    const cerrar = () => { fondo.remove(); this._abierto = false; };
    fondo.querySelector('#claveVer').addEventListener('change', (e) => { inp.type = e.target.checked ? 'text' : 'password'; });
    fondo.querySelector('#claveCancelar').addEventListener('click', cerrar);
    const q = fondo.querySelector('#claveQuitar');
    if (q) q.addEventListener('click', () => { this.guardar(''); cerrar(); ClavePortal._despues(); });
    const guardarla = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      this.guardar(v); cerrar(); ClavePortal._despues();
    };
    fondo.querySelector('#claveGuardar').addEventListener('click', guardarla);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarla(); });
    setTimeout(() => inp.focus(), 50);
  },
  /* Después de cambiar la clave: lo pendiente se reintenta con la nueva. Las
     páginas sin formulario (inicio, tablero) se recargan para volver a
     consultar; en un formulario NO se recarga, para no perder lo escrito. */
  async _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    const hayFormulario = document.querySelector('#app, #atsApp, form');
    if (!hayFormulario) location.reload();
    else await Dialogo.avisar('Clave guardada en este equipo. Vuelve a intentar lo que estabas haciendo (buscar, guardar o abrir).');
  }
};
ClavePortal.aplicar();

/* ================= JORNADA: ATS → PERMISOS → CHARLA → ANEXO =================
   Antes eran cuatro formatos que se llenaban por separado con los MISMOS
   datos (trabajo, sitio, fechas, personal). Ahora, al guardar el ATS, se
   inicia una "jornada": cada paso se abre con lo del ATS ya puesto y, al
   guardarse, queda marcado. Una barra arriba muestra el avance y lleva al
   siguiente paso. Vive en este equipo (localStorage) hasta que se termina o
   pasan 20 horas. */
const Jornada = {
  KEY: 'ssta-jornada',
  FLAG: 'ssta-jornada-en-curso',
  VIGENCIA_MS: 20 * 3600 * 1000,
  _leer() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  _escribir(j) { try { localStorage.setItem(this.KEY, JSON.stringify(j)); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** datos: { atsCode, trabajo, sitio, desde, hasta, horaDesde, horaHasta, responsable, personas:[{nombre,cc,cargo}], permisosReq:['alturas',…] } */
  iniciar(datos) {
    const prev = this._leer();
    const mismo = prev && prev.atsCode === datos.atsCode;
    const j = Object.assign({}, datos, { t: Date.now(), hechos: mismo ? (prev.hechos || {}) : {} });
    this._escribir(j);
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    return j;
  },
  actual() {
    const j = this._leer();
    if (!j || !j.atsCode || Date.now() - (j.t || 0) > this.VIGENCIA_MS) return null;
    return j;
  },
  terminar() { try { localStorage.removeItem(this.KEY); sessionStorage.removeItem(this.FLAG); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** ¿Esta página se abrió como parte de la jornada? (enlace con ?jornada=1 o la misma pestaña). */
  enJornada() {
    if (!this.actual()) return false;
    if (/[?&]jornada=1\b/.test(location.search)) { try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {} return true; }
    try { return sessionStorage.getItem(this.FLAG) === '1'; } catch (e) { return false; }
  },
  marcar(paso, info) {
    const j = this.actual();
    if (!j) return;
    j.hechos = j.hechos || {};
    j.hechos[paso] = Object.assign({ t: Date.now() }, info || {});
    this._escribir(j);
    if (!(info && info.omitido)) setTimeout(() => this._avisoPaso(paso), 600);
  },
  /** Lo llama el permiso al guardarse: solo cuenta si es del ATS de la jornada. */
  marcarPermiso(tipo, code, atsCode, pendiente) {
    const j = this.actual();
    if (!j || !tipo || (atsCode && atsCode !== j.atsCode) || !atsCode) return;
    this.marcar('permiso:' + tipo, { code, pendiente: !!pendiente });
  },
  pasos(j) {
    j = j || this.actual();
    if (!j) return [];
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const h = j.hechos || {};
    const out = [{ id: 'ats', titulo: 'ATS', icono: '🧭', hecho: { code: j.atsCode } }];
    (j.permisosReq || []).forEach((k) => {
      if (!B[k]) return;
      out.push({ id: 'permiso:' + k, titulo: B[k].nombre.replace(/^Trabajo (en |)/i, ''), icono: B[k].icono || '📝', hecho: h['permiso:' + k] || null });
    });
    out.push({ id: 'charla', titulo: 'Charla', icono: '🗣️', hecho: h.charla || null });
    out.push({ id: 'anexo', titulo: 'Anexo', icono: '👷', hecho: h.anexo || null });
    return out;
  },
  siguiente(j) { return this.pasos(j).find((p) => !p.hecho) || null; },
  /** Qué paso es esta página (si es uno de la jornada). */
  pasoDeEstaPagina() {
    const aqui = (location.pathname.split('/').pop() || '');
    if (aqui === 'asistencia.html') return 'charla';
    if (aqui === 'personal-autorizado.html') return 'anexo';
    if (aqui === 'ats.html') return 'ats';
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x].archivo === aqui);
    return k ? 'permiso:' + k : null;
  },
  /** Va al paso. A los permisos se les deja el prellenado del ATS (como el botón del ATS). */
  async abrir(id) {
    const j = this.actual();
    if (!j) return;
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    const B = PORTAL_CONFIG.BACKENDS;
    if (id === 'ats') { location.href = 'ats.html?code=' + encodeURIComponent(j.atsCode) + '&jornada=1'; return; }
    if (id === 'charla') { location.href = 'asistencia.html?jornada=1'; return; }
    if (id === 'anexo') { location.href = 'personal-autorizado.html?jornada=1'; return; }
    if (id.indexOf('permiso:') === 0) {
      const k = id.slice(8);
      if (!B[k]) return;
      const prefill = { t: Date.now(), tipo: k, atsCode: j.atsCode, trabajo: j.trabajo || '', sitio: j.sitio || '',
        desde: j.desde || '', hasta: j.hasta || j.desde || '', horaDesde: j.horaDesde || '', horaHasta: j.horaHasta || '',
        responsable: j.responsable || '', personas: j.personas || [] };
      try { localStorage.setItem('ssta-prefill-permiso', JSON.stringify(prefill)); } catch (e) { await Dialogo.avisar('No se pudo preparar el permiso (memoria del equipo llena).'); return; }
      location.href = B[k].archivo + '?desdeAts=1&jornada=1';
    }
  },
  omitir(id) { this.marcar(id, { omitido: true }); },
  /** Ir a un paso. Si el paso es esta misma página (charla o anexo), no se recarga: la página lo abre. */
  ir(id) {
    if (id === this.pasoDeEstaPagina() && (id === 'charla' || id === 'anexo')) { window.dispatchEvent(new CustomEvent('jornada-ir', { detail: id })); return; }
    this.abrir(id);
  },
  /** Aviso abajo al terminar un paso, con botón al siguiente (la barra queda arriba, fuera de vista). */
  _avisoPaso(paso) {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    const j = this.actual(); if (!j) return;
    const sig = this.siguiente(j);
    const hecho = (this.pasos(j).find((p) => p.id === paso) || {}).titulo || 'Paso';
    const prev = document.getElementById('jornadaAviso'); if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'jornadaAviso';
    el.className = 'jornada-aviso';
    el.innerHTML = '<span>✓ ' + esc(hecho) + ' listo.' + (sig ? ' Siguiente: <b>' + esc(sig.icono + ' ' + sig.titulo) + '</b>' : ' <b>Jornada completa.</b>') + '</span>' +
      (sig ? '<button type="button">Ir →</button>' : '') + '<button type="button" class="x" aria-label="Cerrar">✕</button>';
    document.body.appendChild(el);
    const b = el.querySelector('button:not(.x)');
    if (b) b.onclick = () => { el.remove(); this.ir(sig.id); };
    el.querySelector('.x').onclick = () => el.remove();
    setTimeout(() => { if (el.parentNode) el.remove(); }, 15000);
  },
  /** Barra de avance arriba de la página (solo si la página es parte de la jornada). */
  barra() {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    if (this._pintar) { this._pintar(); return; } // ya está puesta: solo se repinta
    const pintar = () => {
      const j = this.actual();
      let el = document.getElementById('jornadaBarra');
      if (!j) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'jornadaBarra';
        el.className = 'jornada-barra';
        document.body.insertBefore(el, document.body.firstChild);
      }
      const pasos = this.pasos(j), sig = this.siguiente(j);
      const aquiPaso = this.pasoDeEstaPagina();
      el.innerHTML = '<div class="jb-fila"><span class="jb-tit">🗂️ Jornada · <b>' + esc(j.atsCode) + '</b></span>' +
        '<button type="button" class="jb-ver">Ver pasos</button></div>' +
        '<div class="jb-pasos">' + pasos.map((p) => '<span class="jb-paso' + (p.hecho ? (p.hecho.omitido ? ' omit' : ' ok') : '') + '">' +
          (p.hecho ? (p.hecho.omitido ? '–' : '✓') : '○') + ' ' + esc(p.titulo) + '</span>').join('') + '</div>' +
        (!sig ? '<div class="jb-fin">✓ Jornada completa. <button type="button" class="jb-terminar">Terminar</button></div>'
          : (sig.id === aquiPaso && sig.id.indexOf('permiso:') === 0)
            ? '<div class="jb-aqui">✍️ Estás en este paso: diligencia y guarda el permiso para seguir.</div>'
            : '<button type="button" class="jb-sig" data-paso="' + esc(sig.id) + '">Siguiente: ' + esc(sig.icono + ' ' + sig.titulo) + ' →</button>');
      const bs = el.querySelector('.jb-sig');
      if (bs) bs.onclick = () => this.ir(sig.id);
      el.querySelector('.jb-ver').onclick = () => this.mostrarPanel();
      const bt = el.querySelector('.jb-terminar');
      if (bt) bt.onclick = () => { this.terminar(); };
    };
    this._pintar = pintar;
    pintar();
    window.addEventListener('jornada-cambio', pintar);
    window.addEventListener('storage', (e) => { if (e.key === this.KEY) pintar(); });
    window.addEventListener('pageshow', pintar);
  },
  /** Ventana con todos los pasos: abrir, omitir o terminar la jornada. */
  async mostrarPanel() {
    const j = this.actual();
    if (!j) { await Dialogo.avisar('No hay una jornada en curso en este equipo.'); return; }
    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:86vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja); document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    const pinta = () => {
      const jj = this.actual();
      if (!jj) { cerrar(); return; }
      const pasos = this.pasos(jj);
      caja.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><h3 style="margin:0;font-size:var(--fs-campo);">🗂️ Jornada del ' + esc(jj.atsCode) + '</h3>' +
        '<button type="button" data-cerrar style="border:1px solid var(--line);background:#fff;border-radius:var(--r-s);padding:7px 12px;font-weight:700;cursor:pointer;">Cerrar</button></div>' +
        '<p style="margin:6px 0 12px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.45;">' + esc(jj.trabajo || '') + (jj.sitio ? ' · ' + esc(jj.sitio) : '') + '<br>Cada paso se abre con los datos y el personal del ATS (' + (jj.personas || []).length + ' persona(s)) ya puestos. Cada persona firma en cada formato.</p>' +
        pasos.map((p, i) => {
          const h = p.hecho;
          const estado = !h ? '<span style="color:var(--ambar-700);font-weight:700;">Pendiente</span>'
            : h.omitido ? '<span style="color:var(--n-400);font-weight:700;">Omitido</span>'
            : '<span style="color:var(--ok);font-weight:700;">✓ ' + (h.code ? esc(h.code) : 'Hecho') + (h.pendiente ? ' (en cola)' : '') + '</span>';
          const acc = p.id === 'ats' ? '' :
            '<div style="display:flex;gap:7px;margin-top:8px;"><button type="button" data-abrir="' + esc(p.id) + '" style="flex:1;padding:10px;border:none;background:' + (h ? '#fff;border:1.5px solid var(--line);color:var(--ink)' : '#c9a227;color:var(--ink)') + ';border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">' + (h ? 'Abrir de nuevo' : 'Abrir ' + esc(p.titulo.toLowerCase())) + '</button>' +
            (h ? '' : '<button type="button" data-omitir="' + esc(p.id) + '" style="padding:10px 12px;border:1.5px solid var(--line);background:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);color:var(--ink-soft);cursor:pointer;">No aplica</button>') + '</div>';
          return '<div style="border:1px solid var(--line);border-radius:var(--r-m);padding:11px 12px;margin-bottom:8px;' + (h ? '' : 'border-left:4px solid var(--ambar-600);') + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:var(--fs-base);"><b>' + (i + 1) + '. ' + esc(p.icono + ' ' + p.titulo) + '</b>' + estado + '</div>' + acc + '</div>';
        }).join('') +
        '<button type="button" data-terminar style="width:100%;margin-top:6px;padding:11px;border:1.5px solid var(--rojo-200);background:#fff;color:var(--warn);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Terminar la jornada en este equipo</button>';
      caja.querySelector('[data-cerrar]').onclick = cerrar;
      caja.querySelectorAll('[data-abrir]').forEach((b) => { b.onclick = () => { cerrar(); this.abrir(b.dataset.abrir); }; });
      caja.querySelectorAll('[data-omitir]').forEach((b) => { b.onclick = () => { this.omitir(b.dataset.omitir); pinta(); }; });
      caja.querySelector('[data-terminar]').onclick = async () => { if (await Dialogo.confirmar('¿Terminar la jornada? Lo que ya se guardó no se borra; solo se quita la barra de avance de este equipo.')) { this.terminar(); cerrar(); } };
    };
    pinta();
  }
};

/* ================= TRAER PERSONAL DE UN ATS =================
   La gente que firmó el ATS del día es casi siempre la misma que firma la
   charla y el anexo. Este selector lista los ATS abiertos y devuelve sus
   participantes (nombre, cédula, cargo) para agregarlos con un toque; cada
   persona firma de nuevo en el formato donde se agrega.
   Uso:  const r = await TraerDeAts.elegir();  // null si se cancela
         r → { code, trabajo, area, personas:[{nombre, cedula, cargo}] } */
const TraerDeAts = {
  elegir() {
    return new Promise(async (resolve) => {
      const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.ats) || {};
      if (!B.url) { await Dialogo.avisar('El ATS no tiene servidor configurado en config.js.'); resolve(null); return; }
      const fondo = document.createElement('div');
      fondo.className = 'tda-fondo';
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
      const caja = document.createElement('div');
      caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:82vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
      fondo.appendChild(caja);
      document.body.appendChild(fondo);
      const cerrar = (r) => { fondo.remove(); resolve(r); };
      fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
      const cab = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;"><h3 style="margin:0;font-size:var(--fs-campo);">🧭 Traer personal de un ATS</h3>' +
        '<button type="button" data-cerrar style="border:1px solid var(--line);background:#fff;border-radius:var(--r-s);padding:7px 12px;font-weight:700;cursor:pointer;">Cancelar</button></div>' +
        '<p style="margin:0 0 12px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.45;">Se traen nombre, cédula y cargo de quienes están en el ATS. Cada persona debe firmar aquí.</p>';
      const pinta = (html) => { caja.innerHTML = cab + html; caja.querySelector('[data-cerrar]').onclick = () => cerrar(null); };
      pinta('<div style="text-align:center;color:var(--ink-soft);font-size:var(--fs-base);padding:18px;">Buscando ATS abiertos…</div>');
      const token = encodeURIComponent(PORTAL_CONFIG.API_TOKEN);
      fetchWithRetry(B.url + '?list=1&token=' + token).then((r) => r.json()).then((data) => {
        if (!data || !data.ok || !Array.isArray(data.rows)) throw new Error((data && data.error) || 'el servidor del ATS no respondió con datos');
        const abiertos = data.rows.filter((r) => String(r.estado || '').toUpperCase() !== 'CERRADO')
          .sort((a, b) => String(b.fechaDesde || b.updatedAt || '').localeCompare(String(a.fechaDesde || a.updatedAt || ''))).slice(0, 40);
        if (!abiertos.length) { pinta('<div style="padding:14px;text-align:center;color:var(--ink-soft);font-size:var(--fs-base);">No hay ATS abiertos en este momento.</div>'); return; }
        pinta(abiertos.map((r) => {
          const venc = (typeof atsVencido === 'function' && atsVencido(r)) ? ' · <b style="color:var(--warn);">vencido</b>' : '';
          const f = String(r.fechaDesde || '').slice(0, 10);
          return '<button type="button" data-ats="' + esc(r.code) + '" style="display:block;width:100%;text-align:left;border:1.5px solid var(--line);background:#fff;border-radius:var(--r-m);padding:11px 12px;margin-bottom:8px;cursor:pointer;font-family:inherit;">' +
            '<b class="u-fs-base">' + esc(r.code) + '</b><span style="float:right;font-size:var(--fs-etiqueta);font-weight:700;background:var(--bg);border-radius:var(--r-xl);padding:2px 8px;">' + (Number(r.participantes) || 0) + ' 👤</span><br>' +
            '<span style="font-size:var(--fs-menor);color:var(--ink);">' + esc(String(r.trabajo || '').slice(0, 90)) + '</span><br>' +
            '<span style="font-size:var(--fs-etiqueta);color:var(--ink-soft);">' + esc([f, r.area, r.centroCostos].filter(Boolean).join(' · ')) + venc + '</span></button>';
        }).join(''));
        caja.querySelectorAll('[data-ats]').forEach((b) => {
          b.onclick = async () => {
            const code = b.dataset.ats;
            b.disabled = true; b.style.opacity = '.6';
            try {
              const res = await fetchWithRetry(B.url + '?code=' + encodeURIComponent(code) + '&token=' + token);
              const j = await res.json();
              if (!j || !j.ok || !j.ats) throw new Error((j && j.error) || 'no se pudo abrir el ATS');
              const personas = (j.ats.participantes || []).map((p) => ({
                nombre: (String(p.nombres || '') + ' ' + String(p.apellidos || '')).trim() || String(p.nombre || '').trim(),
                cedula: String(p.cedula || '').trim(), cargo: String(p.cargo || '').trim()
              })).filter((p) => p.nombre);
              const cabAts = j.ats.cab || {};
              cerrar({ code, trabajo: cabAts.trabajo || '', area: cabAts.area || '', personas });
            } catch (e) {
              b.disabled = false; b.style.opacity = '1';
              await Dialogo.avisar('No se pudo traer el personal de ' + code + ': ' + e.message);
            }
          };
        });
      }).catch((e) => {
        pinta('<div style="padding:12px;background:var(--rojo-50);border:1px solid var(--rojo-200);color:var(--rojo-900);border-radius:var(--r-m);font-size:var(--fs-menor);line-height:1.45;">No se pudo consultar los ATS: ' + esc(e.message || 'sin conexión') + '.</div>');
      });
    });
  }
};

/* ================= VIGENCIA DE UN ATS =================
   Un ATS vale hasta el final del día de su fecha "hasta" (o de su fecha
   "desde" si no tiene). Después de eso, si sigue abierto, está VENCIDO: es
   de lo primero que se marca en una auditoría. Lo usan el tablero, el
   inicio y las listas del ATS. */
function atsVence(row) {
  const f = String((row && (row.fechaHasta || row.fechaDesde)) || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0, 0);
}
function atsVencido(row) {
  if (!row || row.estado === 'CERRADO') return false;
  const v = atsVence(row);
  return !!v && v.getTime() < Date.now();
}

/* ================= AVISO: SIN BASE DE PERSONAL =================
   Antes era un recuadro rojo flotante abajo a la izquierda que tapaba
   botones y el contador de "preguntas sin responder". Ahora es una franja
   delgada arriba de la página, con "¿Por qué?" y una ✕ para cerrarla (queda
   cerrada mientras no se cierre la pestaña). Lo usan el ATS y los permisos. */
const AvisoPersonal = {
  CLAVE: 'ssta-aviso-personal-cerrado',
  mostrar(motivo, reintentar) {
    let cerrado = false;
    try { cerrado = sessionStorage.getItem(this.CLAVE) === '1'; } catch (e) {}
    let el = document.getElementById('avisoPersonal');
    if (cerrado) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'avisoPersonal';
      el.className = 'aviso-personal';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="txt"></span><button type="button" class="por-que">¿Por qué?</button><button type="button" class="cerrar" aria-label="Cerrar aviso">✕</button>';
      document.body.insertBefore(el, document.body.firstChild);
      el.querySelector('.cerrar').addEventListener('click', () => {
        try { sessionStorage.setItem(this.CLAVE, '1'); } catch (e) {}
        el.remove();
      });
    }
    el.querySelector('.txt').textContent = '⚠️ Sin base de personal: escribe nombres y cédulas a mano, no se pierde nada.';
    const pq = el.querySelector('.por-que');
    pq.onclick = async () => {
      await Dialogo.avisar('Búsqueda de personal no disponible\n\n' + (motivo || 'No se pudo cargar la base de personal.') + '\n\nPuedes seguir escribiendo nombres y cédulas a mano; no se pierde nada.\n\nSe va a reintentar ahora.');
      el.querySelector('.txt').textContent = '⏳ Reintentando…';
      if (reintentar) reintentar();
    };
  },
  ocultar() { const el = document.getElementById('avisoPersonal'); if (el) el.remove(); }
};

/**
 * DraftStore: guarda/recupera un borrador del formulario en localStorage
 * para que no se pierda el trabajo si se cierra la pestaña, se va la señal
 * o el celular bloquea la página a medio llenar.
 */
const DraftStore = {
  _avisoMostrado: false,
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
      return true;
    } catch (e) {
      // El guardado automático del borrador falló (cuota de almacenamiento
      // llena por firmas en base64, modo privado de Safari, etc.). Antes esto
      // se ignoraba en silencio: el usuario creía tener un respaldo local que
      // en realidad no existe. Se avisa una sola vez por sesión — no en cada
      // tecla, ya que save() se llama muy seguido mientras se escribe.
      if (!this._avisoMostrado) {
        this._avisoMostrado = true;
        console.error('DraftStore.save falló:', e);
        window.dispatchEvent(new CustomEvent('draft-guardado-fallido', { detail: { error: e } }));
      }
      return false;
    }
  },
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* no-op */ }
  }
};

// Aviso visible si el borrador automático deja de poder guardarse — se activa
// solo (no necesita que cada página lo llame), ya que common.js está en todas.
window.addEventListener('draft-guardado-fallido', () => {
  if (document.getElementById('draftFailBanner')) return;
  const el = document.createElement('div');
  el.id = 'draftFailBanner';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:var(--rojo-700);color:#fff;font-weight:600;font-size:var(--fs-base);padding:10px 14px;border-radius:var(--r-s);box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;gap:10px;';
  el.innerHTML = '<span>⚠️ El respaldo automático de este formulario no se está guardando en este dispositivo (memoria llena o modo privado). Si cierras la página sin guardar, podrías perder lo escrito — guarda cuanto antes.</span>';
  const btn = document.createElement('button');
  btn.textContent = '✕';
  btn.style.cssText = 'background:none;border:none;color:#fff;font-size:var(--fs-campo);cursor:pointer;flex-shrink:0;';
  btn.addEventListener('click', () => el.remove());
  el.appendChild(btn);
  document.body.appendChild(el);
});

/** debounce: evita guardar en cada tecla; agrupa cambios rápidos en uno solo. */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Formatea una fecha ISO a texto legible en español. */
function formatSavedAt(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

/**
 * OfflineBanner: muestra/oculta un aviso fijo cuando el navegador detecta
 * que no hay conexión, para que en zonas de planta con señal débil quede
 * claro que lo que se ve puede ser una copia guardada (caché) y no la
 * versión más reciente. No interfiere con el borrador local: ese sigue
 * guardando normalmente sin conexión.
 */
/**
 * UpdateManager: detecta cuando hay una versión nueva del portal ya
 * descargada (Service Worker "esperando") y muestra un banner para que
 * el usuario decida cuándo actualizar — nunca se recarga la página solo,
 * para no perder un permiso a medio llenar.
 * Requiere sw.js v2 (que no hace skipWaiting automático).
 */
/* Versión del portal (sitio). El panel del asesor la compara con la del servidor de cada cliente. */
const VERSION_PORTAL_WEB = 'v174';
/* v162 · Ayuda corta: en los formularios largos (instalación), un párrafo de ayuda muy largo muestra solo su
   primera frase y el resto queda tras «¿Qué es esto?». Así el primer campo no se va fuera de la pantalla. */
const AyudaCorta = {
  revisar(raiz) {
    (raiz || document).querySelectorAll('.card p.ayuda:not([data-corta]), .card div.ayuda:not([data-corta]), .card .sub:not([data-corta])').forEach((el) => {
      el.dataset.corta = '1';
      const txt = el.textContent.replace(/\s+/g, ' ').trim();
      if (txt.length < 170 || el.querySelector('a, button, input, select, textarea, ol, ul, img, canvas')) return;
      const m = /^(.{40,180}?[.:;])\s/.exec(txt); if (!m) return;
      const html = el.innerHTML, corte = m[1].length;
      // Se parte el texto (no el HTML) para no romper etiquetas: la primera frase en texto plano y el resto completo al abrir.
      el.innerHTML = ''; const a = document.createElement('span'); a.textContent = m[1] + ' ';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ayuda-mas'; b.textContent = '¿Qué es esto?'; b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => { el.innerHTML = html; el.dataset.abierta = '1'; });
      el.appendChild(a); el.appendChild(b); el.title = txt.slice(corte).trim().slice(0, 300);
    });
  }
};
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { if (document.body && document.body.hasAttribute('data-ayuda-corta')) { AyudaCorta.revisar(); setTimeout(() => AyudaCorta.revisar(), 1500); } });
/* v162 · Etiqueta que no desaparece: un campo cuyo único rótulo es el placeholder muestra ese texto como
   etiqueta pequeña arriba en cuanto se escribe (y lo anuncia a los lectores de pantalla). */
if (typeof document !== 'undefined') document.addEventListener('input', (e) => {
  const i = e.target; if (!i || !i.matches || !i.matches('input[placeholder]:not([type="search"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea[placeholder]')) return;
  const ph = i.getAttribute('placeholder') || ''; if (ph.length < 4 || /^ej\.?[: ]/i.test(ph)) return;
  if ((i.labels && i.labels.length) || i.closest('label') || i.getAttribute('aria-labelledby') || (i.closest('.field') && i.closest('.field').querySelector('label'))) return;
  if (!i.getAttribute('aria-label')) i.setAttribute('aria-label', ph);
  let s = i.previousElementSibling; const tiene = s && s.classList && s.classList.contains('etq-flot');
  if (i.value && !tiene) { s = document.createElement('span'); s.className = 'etq-flot'; s.textContent = ph; s.setAttribute('aria-hidden', 'true'); i.insertAdjacentElement('beforebegin', s); }
  else if (!i.value && tiene) s.remove();
});
/* v162 · Búsqueda global (Ctrl/Cmd + K o «/»): módulos del portal y registros del SG-SST (los que tu usuario puede
   ver), con el lugar donde abrir cada uno. «permiso de Juan», «extintores vencidos», «SSTA-F-116»… */
const BuscarTodo = {
  PAGINAS: [['Reportes e investigación', 'reportes.html'], ['Investigación de accidentes', 'reportes.html?tab=investigaciones'], ['Plan de acción', 'plan-accion.html'], ['Inspecciones e inventario', 'inspecciones.html'],
    ['Personal habilitado', 'habilitacion.html'], ['Ficha del trabajador', 'persona.html'], ['Ficha del equipo', 'equipo.html'], ['Ficha de área o contratista', 'ficha.html'], ['Matriz de peligros', 'peligros.html'],
    ['Plan anual', 'plan-anual.html'], ['Indicadores', 'indicadores.html'], ['Cierre del mes', 'cierre-mes.html'], ['Evidencias 0312', 'evidencias.html'], ['Análisis y alertas', 'analitica.html'], ['Bitácora', 'bitacora.html'],
    ['Entrega de EPP', 'entrega-epp.html'], ['Dotación', 'dotacion.html'], ['Inducción', 'induccion.html'], ['Contratistas', 'contratistas.html'], ['Emergencias', 'emergencias.html'], ['COPASST', 'copasst.html'],
    ['Convivencia', 'convivencia.html'], ['Químicos', 'quimicos.html'], ['Salud', 'salud.html'], ['Vigilancia epidemiológica (PVE)', 'pve.html'], ['Documentos', 'documental.html'], ['Normograma', 'normograma.html'], ['Charlas', 'asistencia.html'], ['ATS', 'ats.html'],
    ['Permiso de alturas', 'permiso-trabajo-alturas.html'], ['Permiso en caliente', 'permiso-trabajo-caliente.html'], ['Espacios confinados', 'permiso-espacios-confinados.html'], ['Preoperacional', 'preoperacional.html'],
    ['Datos personales (Ley 1581)', 'habeas.html'], ['Tus avisos por correo', 'mis-avisos.html'], ['Usuarios', 'usuarios.html'], ['Ayuda', 'ayuda.html']],
  NOMBRE: { reporte: 'Reporte', accion: 'Acción', inspeccion: 'Inspección', equipo: 'Equipo', trabajador: 'Persona', induccion: 'Inducción', peligro: 'Peligro', documento: 'Documento', contratista: 'Contratista', entrega: 'Entrega EPP', reunion: 'Acta', comite: 'Comité', plananual: 'Plan anual', legal: 'Norma' },
  abrir() {
    if (document.getElementById('buscarTodo')) return;
    const n = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const f = document.createElement('div'); f.id = 'buscarTodo'; f.className = 'bt-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', 'Buscar en todo el portal');
    f.innerHTML = '<div class="bt-caja"><input type="search" id="btInput" placeholder="Buscar módulos, personas, permisos, acciones, códigos…" autocomplete="off" data-no-ac aria-label="Buscar en todo el portal"><div id="btRes" role="listbox"></div><div class="bt-pie">Enter abre · Esc cierra · Ctrl+K desde cualquier página</div></div>';
    document.body.appendChild(f);
    const i = f.querySelector('#btInput'), res = f.querySelector('#btRes'); let t = null, sel = 0, items = [];
    const cerrar = () => f.remove();
    const pintar = () => { res.innerHTML = items.length ? items.map((x, k) => '<a href="' + x.href.replace(/"/g, '&quot;') + '" role="option" class="bt-it' + (k === sel ? ' on' : '') + '"><b></b><small></small></a>').join('') : '<div class="bt-vacio">' + (i.value.trim().length < 2 ? 'Escribe al menos 2 letras' : 'Sin resultados') + '</div>';
      [...res.querySelectorAll('.bt-it')].forEach((a, k) => { a.querySelector('b').textContent = items[k].t; a.querySelector('small').textContent = items[k].m; }); };
    const buscar = async () => {
      const q = i.value.trim(); sel = 0;
      items = q.length < 2 ? [] : this.PAGINAS.filter(([nom]) => n(nom).includes(n(q))).slice(0, 6).map(([nom, href]) => ({ t: nom, m: 'Módulo', href }));
      pintar();
      if (q.length < 3 || typeof SGSST === 'undefined' || !SGSST.url() || (Sesion.modo && Sesion.modo() && !Sesion.yo())) return;
      try { const r = await SGSST.consultar({ action: 'buscar', q }); if (i.value.trim() !== q || !r.ok) return;
        items = items.concat((r.rows || []).map((x) => ({ t: x.titulo || x.id, m: (this.NOMBRE[x.tipo] || x.tipo) + ' · ' + x.id + (x.fecha ? ' · ' + Festivos.corta(x.fecha) : '') + (x.estado ? ' · ' + x.estado : ''), href: (x.modulo || 'index.html').replace(/#.*$/, '') + '#' + encodeURIComponent(x.id) }))); pintar(); } catch (e) {}
    };
    i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 250); });
    i.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); pintar(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); pintar(); e.preventDefault(); } else if (e.key === 'Enter' && items[sel]) location.href = items[sel].href; else if (e.key === 'Escape') cerrar(); });
    f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
    i.focus(); pintar();
  }
};
if (typeof document !== 'undefined') document.addEventListener('keydown', (e) => {
  const tecleando = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
  if (((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !tecleando)) { e.preventDefault(); BuscarTodo.abrir(); }
});
/* v162 · Diagnóstico para soporte: lo que sirve para entender un error sin ir y volver por WhatsApp. */
const Diagnostico = {
  _ultimo: '', _hora: '',
  anotar(msg) { this._ultimo = String(msg || '').slice(0, 400); this._hora = new Date().toLocaleString('es-CO'); },
  async texto() {
    let cola = '—'; try { cola = String(await Outbox.count()); } catch (e) {}
    const yo = (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || null;
    return ['Diagnóstico del Portal SSTA — ' + new Date().toLocaleString('es-CO'),
      'Versión: ' + VERSION_PORTAL_WEB, 'Empresa: ' + ((typeof EMPRESA !== 'undefined' && (EMPRESA.nombreCorto || EMPRESA.nombre)) || '—'),
      'Página: ' + location.pathname.split('/').pop() + location.hash, 'Señal: ' + (navigator.onLine ? 'con internet' : 'sin internet'),
      'Pendientes por enviar: ' + cola, 'Usuario: ' + (yo ? (yo.usuario || yo.nombre) + ' (' + (yo.rol || '') + ')' : 'sin usuario'),
      'Último error' + (this._hora ? ' (' + this._hora + ')' : '') + ': ' + (this._ultimo || '—'), 'Equipo: ' + navigator.userAgent].join('\n');
  },
  async copiar() { const t = await this.texto(); try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (x) { return false; } } }
};
// v162 · Política de seguridad (CSP en cada página): si algo la viola, queda en el diagnóstico y en la consola.
if (typeof document !== 'undefined') document.addEventListener('securitypolicyviolation', (e) => { try { const t = 'CSP bloqueó ' + (e.blockedURI || 'inline') + ' (' + e.violatedDirective + ')'; Diagnostico.anotar(t); (window.__cspViolaciones = window.__cspViolaciones || []).push(t); console.warn(t); } catch (x) {} });
if (typeof window !== 'undefined') window.addEventListener('error', (e) => { try { Diagnostico.anotar((e.message || 'Error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); } catch (x) {} });

const UpdateManager = {
  init() {
    if (!('serviceWorker' in navigator)) return;
    // v136: la primera vez (sin Service Worker todavía) se espera a que la página termine de cargar y a un
    // momento libre: así la descarga de todo el portal para usarlo sin señal no compite con lo que la
    // persona está esperando ver. Con señal lenta el inicio abre varios segundos antes.
    if (!navigator.serviceWorker.controller && !this._esperoCarga) {
      this._esperoCarga = true;
      const luego = () => setTimeout(() => this.init(), 0);
      if (document.readyState === 'complete') luego(); else window.addEventListener('load', luego, { once: true });
      return;
    }
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Ya hay un SW nuevo esperando desde antes de esta carga.
      if (reg.waiting) this._showBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            this._showBanner(nuevo);
          }
        });
      });
    }).catch(() => {});

    // Cuando el SW nuevo toma control, recarga una sola vez.
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });

    // Mensaje del SW pidiendo reintentar la cola pendiente (background sync).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'TRY_FLUSH_OUTBOX') Outbox.flush();
    });
  },
  _showBanner(worker) {
    if (document.getElementById('updateBanner')) return;
    const el = document.createElement('div');
    el.id = 'updateBanner';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span>🔄 Hay una versión nueva del portal disponible.</span>
      <button type="button" id="updateBannerBtn">Actualizar ahora</button>`;
    document.body.prepend(el);
    document.getElementById('updateBannerBtn').addEventListener('click', () => {
      worker.postMessage('SKIP_WAITING');
      el.remove();
    });
  }
};

/**
 * Outbox: cola de permisos que no se pudieron guardar por falta de señal.
 * Usa IndexedDB (no localStorage) porque el Service Worker también debe
 * poder leerla/escribirla en segundo plano vía Background Sync.
 * Uso desde los formularios (dentro del catch de fetchWithRetry):
 *   await Outbox.add(CONFIG.SCRIPT_URL, { action:'open', code, data, token });
 * Y al cargar la página: Outbox.flush();  // reintenta lo pendiente
 */
const Outbox = {
  _dbPromise: null,
  _flushing: false, // evita que dos disparos simultáneos (carga de página + evento 'online'
                     // + mensaje del Service Worker) reenvíen el mismo permiso dos veces
  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('ssta-outbox', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },
  /**
   * Encola un permiso pendiente. A diferencia de la versión anterior, la
   * promesa ahora SÍ rechaza si IndexedDB no pudo guardar el registro
   * (cuota llena por las firmas en base64, modo privado de Safari, etc.).
   * Antes la promesa quedaba colgada para siempre y el formulario le
   * mostraba al usuario "quedó guardado y se reintentará solo" sin que
   * realmente hubiera quedado nada guardado — quien llama debe hacer
   * await y avisar al usuario si esto rechaza.
   */
  async add(url, body) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      // v116: lo de la consola del administrador y lo del portal de un cliente no se mezclan en la cola
      // (cada uno sale con su clave y su sesión, y solo desde su lado).
      const nuevo = { url, body, savedAt: new Date().toISOString(), intentos: 0, ambito: Consola.activa() ? 'consola' : 'portal' };
      // v110: la misma operación (mismo opId) no se encola dos veces: si alguien
      // vuelve a guardar sin señal, queda solo la versión más reciente.
      const op = body && body.opId;
      if (!op) store.add(nuevo);
      else {
        const cur = store.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { const v = c.value; if (v.url === url && v.body && v.body.opId === op) c.delete(); c.continue(); }
          else store.add(nuevo);
        };
      }
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Outbox: transacción abortada'));
      tx.oncomplete = () => {
        // Ya quedó guardado en la cola: se confirma YA. Antes se esperaba a
        // que el Service Worker estuviera listo para registrar el Background
        // Sync, y si el Service Worker no estaba activo (primera visita, modo
        // privado, registro fallido) esa espera no terminaba nunca: el botón
        // quedaba en "Guardando…" y el aviso de "quedó en cola" no salía.
        Outbox._avisar();
        resolve();
        // El Background Sync se registra aparte, sin bloquear. Si el navegador
        // no lo soporta, igual se reintenta al volver la señal o al recargar.
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready
            .then((reg) => reg.sync.register('sync-outbox'))
            .catch(() => { /* sin soporte o permiso denegado; no es crítico */ });
        }
      };
    });
  },
  async list() {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readonly');
      const req = tx.objectStore('pending').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  },
  async remove(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').delete(id);
      tx.oncomplete = () => resolve();
    });
  },
  async _incrementarIntentos(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) { item.intentos = (item.intentos || 0) + 1; store.put(item); }
        resolve(item ? item.intentos : 0);
      };
      getReq.onerror = () => resolve(0);
    });
  },
  /** Reintenta enviar todo lo pendiente. Llamar al cargar la página y al volver la señal. */
  async flush() {
    if (!navigator.onLine) return;
    if (this._flushing) return;
    this._flushing = true;
    try {
      const items = await this.list();
      // Cambios del MISMO registro SG-SST (crear, luego FURAT, luego cierre…):
      // si uno no sale, los que siguen esperan a la próxima pasada, para que
      // lleguen en orden y uno viejo no pise a uno nuevo.
      const trabados = new Set();
      const claveDoc = (it) => (it.body && it.body.id && /^(guardar|parche|borrar|adjuntar|quitarAdjunto|restaurar)$/.test(it.body.action || '')) ? it.url + '|' + it.body.id : null;
      const ambito = Consola.activa() ? 'consola' : 'portal';
      for (const item of items) {
        if ((item.ambito || 'portal') !== ambito) continue;
        const cd = claveDoc(item);
        if (cd && trabados.has(cd)) continue;
        if (cd) trabados.add(cd);   // se suelta abajo si salió
        // Lo que quedó en cola se envía con la clave VIGENTE, no con la que
        // había cuando se guardó (si la clave cambió, el envío fallaría).
        if (item.body && Object.prototype.hasOwnProperty.call(item.body, 'token') && typeof PORTAL_CONFIG !== 'undefined') item.body.token = PORTAL_CONFIG.API_TOKEN;
        // SG-SST con usuarios: sale con la sesión vigente (también lo que quedó en cola antes de los usuarios).
        // v112: igual para los permisos, el ATS y lo demás de la obra (todo lo del servidor del portal).
        if (item.body && typeof Sesion !== 'undefined' && ((typeof SGSST !== 'undefined' && SGSST.url() && item.url === SGSST.url()) || Outbox._delPortal(item.url))) item.body.sesion = Sesion.paraReenvio(item.body.sesion, item.sesionRechazada);
        try {
          const res = await fetch(item.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(item.body)
          });
          // Se lee como texto: si el servidor responde con una PÁGINA (error de
          // Apps Script, inicio de sesión, implementación borrada), antes eso se
          // confundía con "sin señal" y el pendiente quedaba en cola sin decir
          // por qué. Ahora se guarda lo que respondió y se ve en la lista.
          const texto = await res.text();
          let json;
          try { json = JSON.parse(texto); }
          catch (errParse) {
            await Outbox._anotarError(item.id, Outbox.describirPagina(texto, res.status));
            continue;
          }
          if (json.ok) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else if (Outbox._esTemporal(json)) {
            // El servidor estaba ocupado (bloqueo, servicio de Google caído un
            // momento): no es culpa del registro. Se conserva SIN contar el
            // intento; se reenvía solo en la próxima pasada.
            await Outbox._anotarError(item.id, 'El servidor estaba ocupado; se reintenta solo. (' + (json.error || 'temporal') + ')');
          } else if (json.codigoError === 'SESION' || json.codigoError === 'CAMBIAR') {
            // Falta entrar con el usuario (o cambiar la clave temporal): no es un
            // error del registro. Se conserva sin contar el intento.
            await Outbox._anotarError(item.id, json.codigoError === 'CAMBIAR' ? 'Cambia tu clave temporal (botón 👤) para enviarlo.' : 'Entra con tu usuario (botón 👤) para enviarlo.', json.codigoError === 'SESION');
            if (typeof Sesion !== 'undefined' && json.codigoError === 'SESION' && item.body && item.body.sesion && item.body.sesion === Sesion.token()) Sesion.rechazada();
            if (typeof Sesion !== 'undefined' && !Sesion.get()) Sesion.pintarChip();
          } else if (ClavePortal.esErrorDeClave(json)) {
            // Clave faltante o vieja: NO es un error del permiso. Antes, a los 5
            // intentos se sacaba de la cola y se perdía. Se conserva y se pide
            // la clave; al guardarla se reenvía.
            await Outbox._anotarError(item.id, 'El servidor no aceptó la clave del portal de este equipo.');
            ClavePortal.pedir();
          } else {
            // El servidor respondió pero con error (token inválido, permiso ya
            // cerrado, etc.) — no es un problema de señal, así que reintentar
            // sin límite nunca lo resolvería solo. Tras 5 intentos fallidos se
            // saca de la cola y se avisa, en vez de reintentar para siempre.
            await Outbox._anotarError(item.id, 'El servidor respondió: ' + (json.error || 'error sin detalle'));
            const intentos = await this._incrementarIntentos(item.id);
            if (intentos >= 5) {
              await this.remove(item.id);
              Outbox._avisarFallidoDefinitivo(item, json.error);
            }
          }
        } catch (e) {
          // No hubo respuesta. Puede ser que no haya señal… o que el envío SÍ
          // llegara y se perdiera la respuesta de vuelta: en ese caso el permiso
          // ya está guardado y este pendiente quedaría en cola para siempre,
          // mostrando un aviso que no corresponde. Se comprueba preguntándole al
          // servidor si ese código ya existe.
          const yaEsta = await Outbox._yaFueGuardado(item);
          if (yaEsta) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else {
            await Outbox._anotarError(item.id, navigator.onLine
              ? 'No hubo respuesta legible del servidor (' + ((e && e.message) || 'error de red') + '). Con buena señal, esto casi siempre es un ERROR DENTRO DEL SCRIPT: Google lo responde de una forma que el navegador no deja leer. En Apps Script → «Ejecuciones» (ícono de reloj) aparece el error exacto.'
              : 'Sin conexión.');
          }
          // Si no se pudo comprobar, se deja en cola y se reintenta luego.
        }
        if (cd && !(await this.list()).some((x) => x.id === item.id)) trabados.delete(cd);
      }
    } finally {
      this._flushing = false;
      Outbox._avisar();
    }
  },
  async count() {
    return (await this.list()).length;
  },
  /** Texto legible de una respuesta que no es de datos (página de Google). */
  describirPagina(html, status) {
    const t = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    let causa = '';
    if (/inicia(r)? sesi|sign in|acceder|cuenta de google|accounts\.google/i.test(t)) causa = ' Parece la pantalla de inicio de sesión de Google: la implementación no está con «Acceso: Cualquier usuario».';
    else if (/autoriza|authoriz|permis/i.test(t)) causa = ' Parece que falta autorizar el script: en Apps Script ejecuta cualquier función una vez (▶) y acepta los permisos.';
    else if (/no se ha encontrado|not found|no encontr|404/i.test(t + status)) causa = ' La URL no corresponde a una implementación activa: revisa la URL en config.js.';
    else if (/error|exception|línea|line \d/i.test(t)) causa = ' Es un error dentro del script.';
    return 'El servidor respondió con una página en vez de datos (HTTP ' + status + ').' + causa + (t ? ' Texto: «' + t.slice(0, 260) + (t.length > 260 ? '…' : '') + '»' : '');
  },
  /* Error del servidor que se arregla solo al reintentar (no debe agotar los 5 intentos). */
  /** v112: ¿esta dirección es del servidor del portal de la empresa (cualquier módulo)? */
  _delPortal(url) {
    try { const base = typeof EMPRESA !== 'undefined' && EMPRESA.servidor ? String(EMPRESA.servidor).replace(/\/+$/, '') : ''; return !!base && String(url || '').indexOf(base + '/') === 0; } catch (e) { return false; }
  },
  _esTemporal(json) {
    return !!json && (json.codigoError === 'TEMPORAL' ||
      /lock timeout|timed out|tiempo de espera|bloqueo|Service (?:invoked too many times|Spreadsheets failed|unavailable)|servicio no disponible|try again later/i.test(String(json.error || '')));
  },
  async _anotarError(id, msg, sesionRechazada) {
    try {
      const db = await this._db();
      await new Promise((resolve) => {
        const tx = db.transaction('pending', 'readwrite');
        const store = tx.objectStore('pending');
        const g = store.get(id);
        g.onsuccess = () => { const it = g.result; if (it) { it.ultimoError = msg; it.ultimoIntento = new Date().toISOString(); if (sesionRechazada) it.sesionRechazada = true; store.put(it); } };
        tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve();
      });
    } catch (e) { /* no es crítico */ }
  },
  /** ¿El permiso de este pendiente ya está guardado en el servidor? Se usa para
   *  no dejar en cola algo que en realidad ya se envió. Devuelve false ante
   *  cualquier duda (sin señal, respuesta rara): más vale reintentar de más que
   *  descartar un permiso que no se guardó. */
  async _yaFueGuardado(item) {
    try {
      const code = item.body && (item.body.permitCode || item.body.code);
      const token = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || (item.body && item.body.token);
      // Registro diario del anexo: no tiene código; se busca por obra y fecha y
      // cuenta como enviado solo si ESE guardado (su opId) ya está aplicado.
      if (item.body && item.body.action === 'guardarRegistro') {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=registro&obraId=' + encodeURIComponent(item.body.obraId) + '&fecha=' + encodeURIComponent(item.body.fecha) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && Array.isArray(j.opIds) && j.opIds.indexOf(item.body.opId) !== -1);
      }
      // SG-SST (habilitación, reportes, plan de acción, inspecciones…): se
      // pregunta si ESE envío (su opId) ya quedó aplicado.
      if (item.body && /^(guardar|parche|borrar|adjuntar|quitarAdjunto|restaurar)$/.test(item.body.action || '') && item.body.id) {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=opAplicado&opId=' + encodeURIComponent(item.body.opId) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && j.ok && j.aplicado);
      }
      if (!code || !token) return false;
      const res = await fetch(item.url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token));
      const json = await res.json();
      if (!json || !json.ok) return false;
      // Un "agregar personal" del ATS solo cuenta como guardado si cada una de
      // esas personas ya aparece en el ATS del servidor (que el ATS exista no
      // basta: si se diera por enviado, esas firmas se perderían).
      if (item.body.action === 'agregarParticipantes') {
        const hay = (json.ats && json.ats.participantes) || [];
        return (item.body.participantes || []).every((p) =>
          hay.some((q) => (p.uid && q.uid === p.uid) || (String(p.cedula || '').trim() && String(q.cedula || '').trim() === String(p.cedula).trim())));
      }
      // Si el pendiente era un CIERRE, solo cuenta como guardado si allá ya
      // figura cerrado; si no, el cierre todavía tiene que salir.
      if (item.body.status === 'CERRADO') return json.status === 'CERRADO';
      if (item.body.action === 'cerrarAts') return json.estado === 'CERRADO';
      // Una charla solo cuenta como enviada si ESE guardado (su opId) ya está
      // aplicado en la semana: que la semana exista no basta, las firmas de
      // ese día se perderían.
      if (item.body.action === 'guardarDia') return !!(json.semana && (json.semana.opIds || []).indexOf(item.body.opId) !== -1);
      return true;
    } catch (e) { return false; }
  },
  _avisar() {
    window.dispatchEvent(new CustomEvent('outbox-cambio'));
  },
  _avisarEnviado(item) {
    window.dispatchEvent(new CustomEvent('outbox-enviado', { detail: item }));
  },
  _avisarFallidoDefinitivo(item, error) {
    window.dispatchEvent(new CustomEvent('outbox-fallido', { detail: { item, error } }));
  }
};
window.addEventListener('online', () => Outbox.flush());

/**
 * OutboxBadge: indicador visible ("N permisos pendientes de enviar") para que
 * el usuario sepa en todo momento si algo quedó en cola sin salir — antes,
 * un permiso podía quedar guardándose en segundo plano sin ningún aviso.
 * Se actualiza solo con los eventos que dispara Outbox.
 */
const OutboxBadge = {
  /* Qué es cada pendiente, según el servidor al que va. Antes todo decía
     "permiso", aunque fuera un ATS o una inspección de EPP. */
  tipoDe(item) {
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x] && B[x].url && B[x].url === item.url);
    if (k === 'ats') return { uno: 'ATS', varios: 'ATS', articulo: 'Un', detalle: 'ATS' };
    if (k === 'epp') return { uno: 'inspección de EPP', varios: 'inspecciones de EPP', articulo: 'Una', detalle: 'Inspección de EPP' };
    if (k === 'personal') return { uno: 'registro de personal', varios: 'registros de personal', articulo: 'Un', detalle: 'Personal autorizado' };
    if (k === 'asistencia') return { uno: 'charla', varios: 'charlas', articulo: 'Una', detalle: 'Asistencia a charla' };
    if (k === 'sgsst') {
      const t = { trabajador: 'Personal habilitado', reporte: 'Reporte SST', accion: 'Plan de acción', mes: 'Indicadores', equipo: 'Equipo', inspeccion: 'Inspección' }[item.body && item.body.tipo] || 'Gestión SST';
      return { uno: 'registro SST', varios: 'registros SST', articulo: 'Un', detalle: t };
    }
    const nombre = k && B[k].nombre ? B[k].nombre : '';
    return { uno: 'permiso', varios: 'permisos', articulo: 'Un', detalle: nombre ? 'Permiso · ' + nombre : 'Permiso' };
  },
  textoBadge(items) {
    const n = items.length;
    const tipos = items.map((it) => this.tipoDe(it));
    const mismo = tipos.every((t) => t.uno === tipos[0].uno);
    if (mismo) return '⏳ ' + n + ' ' + (n === 1 ? tipos[0].uno + ' pendiente' : tipos[0].varios + ' pendientes') + ' de enviar';
    return '⏳ ' + n + ' registros pendientes de enviar';
  },
  init() {
    if (document.getElementById('outboxBadge')) return;
    const el = document.createElement('div');
    el.id = 'outboxBadge';
    el.style.cssText = 'display:none;position:fixed;left:12px;bottom:12px;z-index:9997;background:var(--ambar-600);color:var(--ink);font-weight:700;font-size:var(--fs-menor);padding:8px 14px;border-radius:var(--r-xl);box-shadow:0 2px 10px rgba(0,0,0,.25);';
    document.body.appendChild(el);
    const actualizar = async () => {
      const items = await Outbox.list();
      const n = items.length;
      if (n > 0) {
        el.textContent = OutboxBadge.textoBadge(items);
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    };
    window.addEventListener('outbox-cambio', actualizar);
    window.addEventListener('outbox-enviado', (ev) => {
      actualizar();
      const t = ev && ev.detail && ev.detail.url ? OutboxBadge.tipoDe(ev.detail) : { uno: 'registro', articulo: 'Un' };
      const aviso = document.createElement('div');
      aviso.textContent = '✓ ' + t.articulo + ' ' + t.uno + ' pendiente se envió correctamente.';
      aviso.style.cssText = 'position:fixed;left:12px;bottom:52px;z-index:9998;background:var(--ok);color:#fff;font-weight:600;font-size:var(--fs-menor);padding:8px 14px;border-radius:var(--r-s);box-shadow:0 2px 10px rgba(0,0,0,.25);';
      document.body.appendChild(aviso);
      setTimeout(()=> aviso.remove(), 5000);
    });
    window.addEventListener('outbox-fallido', async (e) => {
      actualizar();
      const t = e.detail && e.detail.item ? OutboxBadge.tipoDe(e.detail.item) : { uno: 'registro' };
      await Dialogo.avisar('No se pudo enviar ' + (t.uno === 'ATS' ? 'un ATS' : 'un(a) ' + t.uno) + ' guardado en cola, incluso con señal (' + (e.detail.error || 'error del servidor') + '). Revísalo manualmente: puede que haya que volver a intentarlo desde el formulario.');
    });

    // El aviso ahora se puede TOCAR para ver qué hay en cola. Antes solo decía
    // "N pendientes" sin forma de saber cuáles ni de quitarlos: si alguno se
    // quedaba trabado, el aviso se volvía permanente y dejaba de significar algo.
    el.style.cursor = 'pointer';
    el.title = 'Toca para ver qué está pendiente';
    el.addEventListener('click', () => OutboxBadge.verPendientes());

    actualizar();
  },

  async verPendientes() {
    const items = await Outbox.list();
    if (!items.length) { await Dialogo.avisar('No hay nada pendiente de enviar.'); return; }

    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:var(--r-l);max-width:460px;width:100%;max-height:80vh;overflow:auto;padding:18px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja);

    const pinta = (lista) => {
      caja.innerHTML =
        '<h3 style="margin:0 0 4px;font-size:var(--fs-campo);">Pendientes de enviar</h3>' +
        '<p style="margin:0 0 14px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.5;">' +
        'Esto se guardó en el celular pero no se ha confirmado que llegara al servidor. ' +
        'Si ya los ves en el dashboard, es que sí llegaron y la confirmación se perdió: usa «Comprobar» para limpiarlos.</p>' +
        lista.map((it,i)=>{
          const code = (it.body && (it.body.permitCode || it.body.code)) || 'sin código';
          const cierre = it.body && (it.body.status === 'CERRADO' || it.body.action === 'cerrarAts');
          const agrego = it.body && (it.body.action === 'agregarParticipantes' || it.body.action === 'addWorkers');
          const tipo = OutboxBadge.tipoDe(it);
          const f = new Date(it.savedAt);
          const cuando = isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-CO') + ' ' + f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
          return '<div style="border:1px solid var(--line);border-radius:var(--r-s);padding:11px;margin-bottom:9px;font-size:var(--fs-menor);line-height:1.5;">' +
            '<span style="color:var(--ink-soft);font-size:var(--fs-menor);">' + esc(tipo.detalle) + '</span><br>' +
            '<b>' + esc(code) + '</b>' + (cierre ? ' <span style="color:var(--warn);">(cierre)</span>' : (agrego ? ' (personal agregado)' : ' (apertura o cambios)')) +
            '<br><span style="color:var(--ink-soft);">Guardado: ' + esc(cuando) + (it.intentos ? ' · ' + it.intentos + ' intento(s)' : '') + '</span>' +
            (it.ultimoError ? '<div style="margin-top:7px;background:var(--rojo-50);border:1px solid var(--rojo-200);color:var(--rojo-900);border-radius:var(--r-s);padding:7px 9px;font-size:var(--fs-menor);line-height:1.45;overflow-wrap:anywhere;"><b>Último intento:</b> ' + esc(it.ultimoError) + '</div>' : '') +
            '<div style="display:flex;gap:7px;margin-top:9px;">' +
            '<button data-comprobar="' + it.id + '" style="flex:1;padding:9px;border:1px solid #1f6f8b;background:#fff;color:#1f6f8b;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);cursor:pointer;">Comprobar</button>' +
            '<button data-descartar="' + it.id + '" style="padding:9px 12px;border:1px solid var(--rojo-300);background:#fff;color:var(--warn);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);cursor:pointer;">Descartar</button>' +
            '</div></div>';
        }).join('') +
        '<button id="obxReenviar" style="width:100%;padding:12px;border:none;background:var(--ambar-600);color:var(--ink);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;margin:2px 0 8px;">↻ Reenviar ahora</button>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="obxTodos" style="flex:1;padding:12px;border:none;background:var(--ink);color:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Comprobar todos</button>' +
        '<button id="obxCerrar" style="padding:12px 16px;border:1px solid var(--line);background:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Cerrar</button>' +
        '</div>';

      caja.querySelector('#obxCerrar').onclick = () => fondo.remove();
      const btnRe = caja.querySelector('#obxReenviar');
      btnRe.onclick = async () => {
        btnRe.disabled = true; btnRe.textContent = 'Reenviando…';
        await Outbox.flush();
        const quedan = await Outbox.list();
        if (!quedan.length) { fondo.remove(); await Dialogo.avisar('✓ Todo se envió correctamente.'); return; }
        pinta(quedan);
      };

      const comprobar = async (item) => {
        const ya = await Outbox._yaFueGuardado(item);
        if (ya) { await Outbox.remove(item.id); return true; }
        return false;
      };

      caja.querySelectorAll('[data-comprobar]').forEach(b=>{
        b.onclick = async () => {
          b.disabled = true; b.textContent = 'Comprobando…';
          const item = lista.find(x=>String(x.id)===b.dataset.comprobar);
          const ya = await comprobar(item);
          if (ya) { await Dialogo.avisar('Eso SÍ está guardado en el servidor. Se quita de la cola.'); }
          else { await Dialogo.avisar('Todavía no aparece en el servidor. Se deja en cola para reintentarlo.'); }
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      caja.querySelectorAll('[data-descartar]').forEach(b=>{
        b.onclick = async () => {
          if (!await Dialogo.confirmar('¿Descartar este pendiente? Si no llegó al servidor, se pierde y habrá que volver a diligenciarlo.')) return;
          await Outbox.remove(b.dataset.descartar);
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      const btnTodos = caja.querySelector('#obxTodos');
      btnTodos.onclick = async () => {
        btnTodos.disabled = true; btnTodos.textContent = 'Comprobando…';
        let limpiados = 0;
        for (const it of lista) { if (await comprobar(it)) limpiados++; }
        Outbox._avisar();
        const quedan = await Outbox.list();
        await Dialogo.avisar(limpiados
          ? limpiados + ' de ' + lista.length + ' ya estaban guardados en el servidor y se quitaron de la cola.'
          : 'Ninguno aparece todavía en el servidor. Se dejan en cola.');
        quedan.length ? pinta(quedan) : fondo.remove();
      };
    };

    pinta(items);
    fondo.addEventListener('click', (e)=>{ if (e.target === fondo) fondo.remove(); });
    document.body.appendChild(fondo);
  }
};

/**
 * SignaturePad: lienzo táctil de firma (dibujar, deshacer trazo, borrar,
 * cargar una firma ya guardada). Antes esta misma lógica (~80 líneas)
 * vivía copiada y pegada en permiso-core.js Y en personal-autorizado.html
 * por separado — un arreglo hecho en un lado (como el bug de firmas que
 * quedaban invisibles al restaurar varias de golpe) había que acordarse
 * de repetirlo a mano en el otro. Ahora vive en un solo lugar y ambos
 * consumidores comparten la misma implementación.
 *
 * Cada página que la usa crea SU PROPIO manager (no hay estado global
 * compartido entre, por ejemplo, un permiso y el anexo de personal):
 *
 *   const sigMgr = SignaturePad.createManager({
 *     statusIdFor: (canvasId) => 'status_' + canvasId  // opcional, este es el default
 *   });
 *   sigMgr.setup(canvasEl);
 *   sigMgr.pads['idDelCanvas'].setDataUrl(firmaGuardada);
 *   sigMgr.refreshIn(contenedor); // ver nota de refreshSize más abajo
 *
 * IMPORTANTE sobre restaurar firmas guardadas en lote (varias filas a la
 * vez, ej. varios ejecutantes de un permiso ya abierto): llama primero
 * refreshIn()/setup() para que el lienzo tenga su tamaño real, y solo
 * después dibuja la firma con setDataUrl — si el <canvas> todavía no está
 * visible (contenedor recién mostrado, sección aún colapsada) su tamaño
 * puede ser 0x0 en ese instante y la firma se "dibuja" en un lienzo sin
 * tamaño, quedando invisible aunque el dato sí se guardó bien.
 */
const SignaturePad = {
  createManager(opts) {
    opts = opts || {};
    const statusIdFor = opts.statusIdFor || ((id) => 'status_' + id);
    const signedLabel = opts.signedLabel || 'Firmado ✓';
    const unsignedLabel = opts.unsignedLabel || 'Sin firmar';
    const pads = {};

    function markSigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = signedLabel; el.classList.add('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.add('con-firma'); // quita la pista "Toca aquí para firmar"
    }
    function markUnsigned(id) {
      const el = document.getElementById(statusIdFor(id));
      if (el) { el.textContent = unsignedLabel; el.classList.remove('done', 'signed'); }
      const c = document.getElementById(id);
      if (c) c.classList.remove('con-firma');
    }

    function setup(canvas) {
      if (canvas.dataset.sigInit) return; // este MISMO elemento ya tiene sus listeners
      canvas.dataset.sigInit = '1';
      // En celular, tocar el recuadro abre la firma a pantalla completa (ver
      // FirmaCompleta). Se registra ANTES que los de dibujo para poder frenar
      // el trazo en el recuadro pequeño. En tablet o computador no hace nada.
      if (!canvas.dataset.completa) {
        canvas.addEventListener('touchstart', (e) => {
          if (canvas.dataset.locked === '1' || !FirmaCompleta.usar()) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          FirmaCompleta.abrir(canvas, pads[canvas.id]);
        }, { passive: false });
      }
      // willReadFrequently: true — le dice al navegador desde el inicio que este
      // lienzo se va a LEER seguido (getImageData para el historial de "deshacer",
      // toDataURL al guardar), no solo dibujar. Sin esto, el navegador por defecto
      // asume que el canvas es para dibujar-y-mostrar nada más, y lo maneja con
      // memoria de video (GPU) — en dispositivos con poca memoria y varias firmas
      // abiertas a la vez en la misma pantalla (los 5-6 recuadros de un permiso),
      // esa memoria de video puede liberarse en segundo plano para los lienzos que
      // quedan fuera de pantalla mientras se sigue llenando el formulario, dejando
      // el dibujo en blanco silenciosamente aunque el estado siga diciendo
      // "Firmado ✓" (ese estado es solo texto, no depende del contenido del
      // lienzo). Con willReadFrequently, el navegador usa memoria normal (CPU) en
      // vez de memoria de video, evitando ese vaciado.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // Historial para "deshacer trazo".
      // ANTES se guardaba una FOTO completa del lienzo por cada trazo (hasta 15).
      // En una tablet de pantalla densa cada foto pesa ~7 MB sin comprimir, así
      // que un solo recuadro podía ocupar ~108 MB y un permiso con 9 firmas casi
      // 1 GB — suficiente para que el navegador matara y recargara la pestaña sin
      // avisar. Ahora se guardan los TRAZOS (las coordenadas por donde pasó el
      // dedo) y el lienzo se redibuja: unos pocos kilobytes, sin tope práctico,
      // y el deshacer queda exacto en vez de aproximado.
      let strokes = [];      // trazos dibujados en esta sesión, en píxeles CSS
      let baseImage = null;  // firma ya existente restaurada de fondo (si la hay)
      function redibujar() {
        const ratio = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (baseImage) {
          ctx.drawImage(baseImage, 0, 0, canvas.width / ratio, canvas.height / ratio);
        }
        strokes.forEach((s) => {
          if (!s.length) return;
          ctx.beginPath();
          ctx.moveTo(s[0][0], s[0][1]);
          if (s.length === 1) ctx.lineTo(s[0][0], s[0][1]); // toque suelto: punto
          else for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
          ctx.stroke();
        });
      }
      // Tamaño en pantalla (px CSS) para el que está armada la imagen interna.
      // Si el recuadro cambia de tamaño y la imagen interna no, el navegador la
      // estira para llenarlo y la raya ya no sale debajo del dedo.
      let tamCss = { w: 0, h: 0 };
      function resize() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // aún oculto, se reintentará al mostrarse
        const ratio = window.devicePixelRatio || 1;
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#1f2a33';
        tamCss = { w: rect.width, h: rect.height };
      }
      resize();

      /**
       * Deja la imagen interna del tamaño exacto del recuadro, conservando lo
       * ya firmado. SÍNCRONO a propósito: se llama al tocar el lienzo, y si
       * restaurara la firma en diferido (como antes, con una imagen que carga
       * después) podía borrar el trazo que se acababa de empezar.
       * Los trazos están guardados como coordenadas, así que se reescalan a la
       * nueva medida sin perder calidad ni el historial de "deshacer".
       */
      function ajustarTamano(forzar) {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const igual = Math.abs(r.width - tamCss.w) < 0.5 && Math.abs(r.height - tamCss.h) < 0.5;
        if (igual && !forzar) return;
        if (tamCss.w && tamCss.h && !igual) {
          const sx = r.width / tamCss.w;
          const sy = r.height / tamCss.h;
          strokes = strokes.map((s) => s.map(([x, y]) => [x * sx, y * sy]));
        }
        resize();
        redibujar();
      }

      // Vigila el tamaño REAL del recuadro, no el evento de girar: cubre el
      // giro (que en muchos Android termina después de que el evento avisa),
      // una sección que se despliega, la barra de desplazamiento que aparece…
      if (typeof ResizeObserver !== 'undefined') {
        let espera = null;
        new ResizeObserver(() => {
          clearTimeout(espera);
          espera = setTimeout(() => { if (!drawing) ajustarTamano(false); }, 60);
        }).observe(canvas);
      }
      let drawing = false, hasInk = false, lastX = 0, lastY = 0;
      function pos(e) {
        const r = canvas.getBoundingClientRect();
        const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
        return [cx, cy];
      }
      function start(e) {
        if (canvas.dataset.locked === '1') return;
        e.preventDefault();
        // Antes de poner el primer punto se confirma que la imagen interna
        // coincide con el recuadro. Es la garantía final: pase lo que pase con
        // los giros, el trazo sale donde está el dedo.
        ajustarTamano(false);
        const [x, y] = pos(e);
        strokes.push([[x, y]]); // arranca un trazo nuevo
        drawing = true;
        [lastX, lastY] = [x, y];
      }
      function move(e) {
        if (!drawing || canvas.dataset.locked === '1') return;
        e.preventDefault();
        const [x, y] = pos(e);
        // Se dibuja el segmento de una vez (rápido) Y se guarda el punto, para
        // poder redibujar el trazo completo si luego se deshace otro.
        const actual = strokes[strokes.length - 1];
        if (actual) actual.push([x, y]);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
        hasInk = true;
        markSigned(canvas.id);
      }
      function end() { drawing = false; }
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);
      // Si el sistema interrumpe el toque (una llamada, un gesto del borde),
      // antes el lienzo se quedaba "dibujando" y el siguiente toque unía los
      // dos trazos con una raya recta.
      canvas.addEventListener('touchcancel', end);

      /* Exporta la firma a una resolución acotada.
         POR QUÉ: el lienzo en pantalla se crea a (ancho CSS × devicePixelRatio).
         En una tablet grande de alta densidad eso da un lienzo enorme, y el PNG
         resultante puede superar los 50.000 caracteres — que es el MÁXIMO que
         Google Sheets admite en una sola celda. El backend guarda cada firma en
         una celda (hoja "Firmas", columna C), así que al pasarse, esa escritura
         falla y la firma se pierde EN SILENCIO: la fila del permiso ya quedó
         guardada con los nombres, pero sin las imágenes. Ese era el motivo de
         que las firmas hechas desde el computador (≈18-49k) sí quedaran y las
         de la tablet (≈63-117k) no.
         Se reduce el tamaño hasta quedar cómodamente bajo el límite. Una firma
         es un trazo simple, así que bajar la resolución no afecta su lectura ni
         su validez como constancia. */
      function exportarFirmaAcotada() {
        const MAX_CARACTERES = 45000; // margen de seguridad bajo el tope de 50.000
        const ANCHO_OBJETIVO = 700;   // px reales; suficiente para un trazo nítido
        let escala = Math.min(1, ANCHO_OBJETIVO / (canvas.width || 1));
        let ultima = null;
        for (let intento = 0; intento < 6; intento++) {
          const w = Math.max(1, Math.round(canvas.width * escala));
          const h = Math.max(1, Math.round(canvas.height * escala));
          const tmp = document.createElement('canvas');
          tmp.width = w;
          tmp.height = h;
          const tctx = tmp.getContext('2d');
          tctx.drawImage(canvas, 0, 0, w, h);
          ultima = tmp.toDataURL('image/png');
          if (ultima.length <= MAX_CARACTERES) return ultima;
          escala *= 0.75; // todavía muy grande: se reduce otro poco y se reintenta
        }
        return ultima;
      }

      pads[canvas.id] = {
        clear: () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          strokes = [];
          baseImage = null;
          hasInk = false;
          markUnsigned(canvas.id);
        },
        undo: () => {
          // Quita el último trazo y redibuja el resto sobre la firma de fondo
          // (si el permiso traía una firma ya guardada, esa no se puede deshacer:
          // deshacer solo aplica a lo dibujado en esta sesión).
          strokes.pop();
          redibujar();
          if (!strokes.length && !baseImage) {
            hasInk = false;
            markUnsigned(canvas.id);
          }
        },
        getDataUrl: () => (hasInk ? exportarFirmaAcotada() : null),
        setDataUrl: (url) => {
          if (!url) return;
          hasInk = true;
          markSigned(canvas.id);
          const img = new Image();
          img.onload = () => {
            // Pasa a ser el fondo sobre el que se dibujan los trazos nuevos.
            baseImage = img;
            strokes = [];
            redibujar();
          };
          img.src = url;
        },
        hasInk: () => hasInk,
        /** Trazos de esta sesión, en px CSS, con la medida del lienzo donde se hicieron. */
        getStrokes: () => ({
          strokes: strokes.map((t) => t.map((pt) => [pt[0], pt[1]])),
          w: tamCss.w,
          h: tamCss.h,
          base: !!baseImage
        }),
        /**
         * Reemplaza lo firmado por estos trazos, ajustados a ESTE lienzo sin
         * deformarlos: se escala igual a lo ancho y a lo alto (una firma hecha
         * en pantalla completa horizontal no queda aplastada en un recuadro
         * vertical) y se centra. Nunca se agranda más allá del trazo original.
         */
        setStrokes: (lista) => {
          ajustarTamano(false);
          const pts = [];
          (lista || []).forEach((t) => t.forEach((pt) => pts.push(pt)));
          baseImage = null;
          if (!pts.length) {
            strokes = [];
            hasInk = false;
            redibujar();
            markUnsigned(canvas.id);
            return;
          }
          const xs = pts.map((pt) => pt[0]), ys = pts.map((pt) => pt[1]);
          const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
          const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);
          const margen = 10;
          const k = Math.min((tamCss.w - 2 * margen) / bw, (tamCss.h - 2 * margen) / bh, 1);
          const dx = (tamCss.w - bw * k) / 2 - minX * k;
          const dy = (tamCss.h - bh * k) / 2 - minY * k;
          strokes = lista.map((t) => t.map((pt) => [pt[0] * k + dx, pt[1] * k + dy]));
          hasInk = true;
          redibujar();
          markSigned(canvas.id);
        },
        // ⚠️ A diferencia de la versión anterior (donde solo el manejador de
        // rotación de pantalla preservaba la firma), refreshSize() SIEMPRE
        // guarda la firma actual antes de redimensionar y la vuelve a
        // dibujar después — fijar canvas.width/height limpia el bitmap, así
        // que sin esto, cualquier llamado a refreshIn() sobre un canvas ya
        // firmado borraría la firma en silencio (el estado seguiría
        // diciendo "Firmado ✓" pero el lienzo quedaría en blanco). Ahora es
        // seguro llamarlo en cualquier momento, sin importar el orden.
        // Usa la copia a resolución completa (no la recortada de getDataUrl),
        // para que girar la pantalla varias veces no degrade la firma.
        refreshSize: () => ajustarTamano(true)
      };
      if (!canvas.dataset.completa) canvas._pad = pads[canvas.id];   // v140: «Firmar sin dibujar» lo usa
    }

    function refreshIn(container) {
      if (!container) return;
      container.querySelectorAll('canvas.pad, canvas.mini-pad').forEach((c) => {
        if (pads[c.id]) pads[c.id].refreshSize();
      });
    }

    /** Registra el reintento de tamaño al girar el celular (con espera para
     *  no recalcular a medio giro). Llamar una sola vez por manager. */
    function bindOrientationChange() {
      // Solo reajusta el tamaño de los lienzos al girar. Volver al recuadro
      // que se estaba firmando lo hace AnclaGiro (más abajo), que funciona
      // en todas las páginas aunque no tengan lienzos.
      let timer = null;
      window.addEventListener('orientationchange', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          Object.keys(pads).forEach((id) => pads[id].refreshSize());
        }, 120);
      });
    }

    return { pads, setup, refreshIn, bindOrientationChange };
  },
  /** Bloquea un lienzo (modo consulta / permiso ya cerrado) — no depende
   *  del manager, se puede llamar directo sobre el <canvas>. */
  lock(canvas) {
    canvas.dataset.locked = '1';
    canvas.classList.add('locked');
  }
};

/**
 * ScrollProgress: barra fina y fija arriba de la pantalla que muestra
 * cuánto lleva recorrido el usuario del formulario — información real
 * en un documento largo de 10 secciones diligenciado en celular, no
 * decoración. Color configurable por página (color de marca del permiso).
 */
const ScrollProgress = {
  init(color) {
    if (document.getElementById('scrollProgress')) return;
    const el = document.createElement('div');
    el.id = 'scrollProgress';
    if (color) el.style.setProperty('--progress-color', color);
    document.body.prepend(el);
    const update = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      const pct = scrollable > 0 ? (h.scrollTop / scrollable) * 100 : 0;
      el.style.width = Math.min(100, Math.max(0, pct)) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
};

const OfflineBanner = {
  init() {
    if (document.getElementById('offlineBanner')) return; // ya existe
    const el = document.createElement('div');
    el.id = 'offlineBanner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.prepend(el);
    // v143: el texto solo existe sin señal (un lector de pantalla no anuncia «sin conexión» por error) y no asusta
    const update = () => { const sin = !navigator.onLine; el.style.display = sin ? 'block' : 'none'; el.textContent = sin ? 'Sin señal: lo que guardes queda en el celular y se envía solo cuando vuelva.' : ''; };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }
};

/**
 * SeleccionMultiple: fichas que se tocan para elegir varias opciones, con un
 * campo libre al final para lo que no esté en la lista.
 *
 * Reemplaza a los campos de texto donde había que escribir a mano cosas que
 * casi siempre son las mismas ("¿cuál permiso adicional?", "herramientas a
 * utilizar"): en obra, con guantes y de pie, escribir es lo más incómodo del
 * formulario. Además, al quedar los valores normalizados se pueden contar y
 * filtrar después, cosa imposible con texto libre.
 *
 * Se guarda como un solo texto separado por " · " para que lo que ya está
 * registrado en la hoja siga leyéndose igual y no haya que migrar nada.
 *
 *   const sel = SeleccionMultiple.crear(document.getElementById('x'), {
 *     opciones: ['Taladro','Pulidora'],
 *     placeholderLibre: 'Otras herramientas…'
 *   });
 *   sel.get();          // "Taladro · Pulidora · lo que se escribió"
 *   sel.set(texto);     // reconstruye la selección desde ese texto
 */
const SeleccionMultiple = {
  crear(contenedor, opts) {
    opts = opts || {};
    const opciones = opts.opciones || [];
    const seleccion = new Set();

    const fichas = document.createElement('div');
    fichas.className = 'sm-fichas';
    const libre = document.createElement('input');
    libre.type = 'text';
    libre.className = 'sm-libre';
    libre.placeholder = opts.placeholderLibre || 'Otro (escribe aquí)…';

    opciones.forEach((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sm-ficha';
      b.textContent = op;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (seleccion.has(op)) { seleccion.delete(op); b.classList.remove('on'); b.setAttribute('aria-pressed','false'); }
        else { seleccion.add(op); b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        if (opts.onChange) opts.onChange();
      });
      fichas.appendChild(b);
    });
    if (opts.onChange) libre.addEventListener('input', opts.onChange);

    contenedor.innerHTML = '';
    contenedor.appendChild(fichas);
    contenedor.appendChild(libre);

    return {
      get() {
        const partes = opciones.filter(o => seleccion.has(o));
        const extra = libre.value.trim();
        if (extra) partes.push(extra);
        return partes.join(' · ');
      },
      set(texto) {
        seleccion.clear();
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          b.classList.remove('on'); b.setAttribute('aria-pressed','false');
        });
        libre.value = '';
        if (!texto) return;
        // Lo que coincida con una opción se marca como ficha; el resto vuelve
        // al campo libre. Así un permiso guardado antes de este cambio, con
        // texto escrito a mano, se sigue viendo completo.
        const sueltos = [];
        String(texto).split('·').map(x => x.trim()).filter(Boolean).forEach(parte => {
          const op = opciones.find(o => o.toLowerCase() === parte.toLowerCase());
          if (op) { seleccion.add(op); }
          else sueltos.push(parte);
        });
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          if (seleccion.has(b.textContent)) { b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        });
        libre.value = sueltos.join(' · ');
      },
      vacio() { return !this.get(); }
    };
  }
};

/* ============================================================
 * AnclaGiro: al girar el celular, la pantalla vuelve sola a donde estaba.
 * ------------------------------------------------------------
 * Al pasar de vertical a horizontal (o al revés) el alto de toda la página
 * cambia y el navegador pierde la posición: quedas en otra parte del permiso
 * y toca buscar otra vez el recuadro de la firma.
 *
 * La versión anterior (v62) fallaba por tres motivos, y los tres se
 * reprodujeron en pruebas antes de corregir:
 *  1. Recordaba el último lienzo TOCADO: si alguien ya había firmado el
 *     recuadro de otro ejecutante, al girar mandaba a ese, lejos del actual.
 *  2. Si no se había tocado ninguno, se anclaba a una sección entera, y
 *     "centrar" una sección de 3 pantallas de alto deja cualquier cosa a la vista.
 *  3. Corregía a los 120 y 370 ms; en Android el giro puede terminar después
 *     y el navegador deshacía la corrección.
 *
 * Ahora:
 *  - Se recuerda lo que SE ESTÁ VIENDO, actualizado cada vez que la pantalla
 *    queda quieta: primero un recuadro de firma visible; si no hay, el campo
 *    más cercano al centro (nunca un bloque más alto que media pantalla).
 *  - El giro se detecta por la orientación real del aparato, no por el alto
 *    de la ventana: abrir el teclado encoge la ventana y no debe contar.
 *  - Se vuelve al punto varias veces durante 1,5 s mientras el giro termina
 *    de acomodarse, y se deja de insistir en cuanto la persona toca la pantalla.
 * ============================================================ */
const AnclaGiro = (() => {
  const SEL_FIRMA = 'canvas.pad, canvas.sigpad, canvas.mini-pad';
  const SEL_CAMPO = SEL_FIRMA + ', .field, .epp-item, .close-q, .check-item, .exec-card, h2, h3, .section-title';
  const REINTENTOS_MS = [0, 120, 300, 550, 900, 1500];
  let ancla = null;
  let ultimoTocado = null;
  let restaurando = false;
  let timers = [];
  let orientacion = null;
  let esperaScroll = null;

  function orientacionActual() {
    if (screen.orientation && screen.orientation.type) return screen.orientation.type.indexOf('portrait') === 0 ? 'v' : 'h';
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90 ? 'h' : 'v';
    return window.innerWidth > window.innerHeight ? 'h' : 'v';
  }
  function enPantalla(el) {
    if (!el || !document.body.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function masCercanoAlCentro(selector, altoMax) {
    const centro = window.innerHeight / 2;
    let mejor = null, mejorDist = Infinity;
    document.querySelectorAll(selector).forEach((el) => {
      if (!enPantalla(el)) return;
      const r = el.getBoundingClientRect();
      if (altoMax && r.height > altoMax) return;
      const d = Math.abs(r.top + r.height / 2 - centro);
      if (d < mejorDist) { mejorDist = d; mejor = el; }
    });
    return mejor;
  }
  function elegir() {
    // El recuadro que se acaba de tocar manda, pero SOLO si sigue a la vista:
    // si la persona bajó a otro ejecutante, ese ya no cuenta.
    if (enPantalla(ultimoTocado)) return ultimoTocado;
    return masCercanoAlCentro(SEL_FIRMA) || masCercanoAlCentro(SEL_CAMPO, window.innerHeight * 0.5);
  }
  function registrar() {
    if (restaurando) return;
    const el = elegir();
    if (el) ancla = el;
  }
  function detener() {
    timers.forEach(clearTimeout);
    timers = [];
    restaurando = false;
  }
  function alGirar() {
    const nueva = orientacionActual();
    if (nueva === orientacion && restaurando) return; // ya se está corrigiendo este giro
    orientacion = nueva;
    const objetivo = ancla;
    detener();
    if (!objetivo || !document.body.contains(objetivo)) return;
    restaurando = true;
    REINTENTOS_MS.forEach((ms, i) => {
      timers.push(setTimeout(() => {
        if (document.body.contains(objetivo)) objetivo.scrollIntoView({ block: 'center', behavior: 'auto' });
        if (i === REINTENTOS_MS.length - 1) {
          restaurando = false;
          registrar();
        }
      }, ms));
    });
  }

  function init() {
    orientacion = orientacionActual();
    registrar();
    // La posición se anota cuando la pantalla queda quieta. La espera también
    // protege contra el propio giro: el navegador mueve la página al empezar
    // a girar, y para cuando esta anotación se ejecutaría, ya se sabe que es
    // un giro y se ignora.
    window.addEventListener('scroll', () => {
      clearTimeout(esperaScroll);
      esperaScroll = setTimeout(registrar, 200);
    }, { passive: true });
    document.addEventListener('touchstart', (e) => {
      // Si la persona toca la pantalla mientras se corrige, manda ella.
      if (restaurando) detener();
      const c = e.target && e.target.closest ? e.target.closest(SEL_FIRMA) : null;
      if (c) { ultimoTocado = c; ancla = c; }
    }, { passive: true, capture: true });
    const revisar = () => { if (orientacionActual() !== orientacion) alGirar(); };
    window.addEventListener('orientationchange', alGirar);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', revisar);
    window.addEventListener('resize', revisar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { _estado: () => ({ ancla, restaurando, orientacion }) };
})();

/* ============================================================
 * FirmaCompleta: en celular, la firma se hace a pantalla completa.
 * ------------------------------------------------------------
 * En un celular el recuadro de firma es angosto, y la solución de siempre
 * era girar el teléfono… con lo que la página entera se reacomodaba y había
 * que volver a buscar el recuadro. Llevamos varias versiones corrigiendo los
 * efectos del giro; esto ataca la causa: al tocar el recuadro se abre un
 * lienzo que ocupa toda la pantalla, sin nada detrás que se mueva. Se firma,
 * se toca "Listo", la firma pasa al recuadro y la pantalla queda ahí mismo.
 *
 * - Solo en celulares (pantalla táctil con el lado corto menor a 600 px). En
 *   tablet y computador el recuadro normal ya es cómodo y no cambia nada.
 * - La firma pasa como trazos, no como imagen: no pierde calidad ni se
 *   deforma, aunque se haya hecho en horizontal y el recuadro sea vertical.
 * - Si el recuadro ya traía una firma guardada, "Listo" sin dibujar la deja
 *   como estaba: no se puede borrar una firma sin querer.
 * - El botón "atrás" de Android cierra la firma en vez de salir del permiso.
 * ============================================================ */
const FirmaCompleta = (() => {
  const MQ = '(pointer: coarse) and (max-width: 599px), (pointer: coarse) and (max-height: 599px)';
  let el = null, pad = null, destino = null, destinoPad = null;
  let abierta = false, empujado = false, ignorarPop = false, teniaBase = false;

  function usar() {
    return !!(window.matchMedia && window.matchMedia(MQ).matches);
  }

  /** Nombre de quien firma, tomado del mismo bloque del recuadro. */
  function nombreFirmante(canvas) {
    const bloque = canvas.closest('.exec-card, tr, .sig-block, .sig-pad-wrap, .field, section') || canvas.parentElement;
    let b = bloque;
    // Sube hasta 3 niveles buscando un campo de nombre con algo escrito.
    for (let i = 0; i < 3 && b; i++, b = b.parentElement) {
      const inp = Array.from(b.querySelectorAll('input')).find((x) => /nombre/i.test(x.id + ' ' + x.name + ' ' + x.placeholder) && x.value.trim());
      if (inp) return inp.value.trim();
    }
    const t = bloque && bloque.querySelector('h5, h4, label, .exec-num');
    return t ? t.textContent.trim() : '';
  }
  function tituloBloque(canvas) {
    const bloque = canvas.closest('.exec-card, .sig-block, .sig-pad-wrap, .field') || canvas.parentElement;
    const card = canvas.closest('.exec-card');
    const t = (card && card.querySelector('.exec-num')) || (bloque && bloque.querySelector('h5, h4, label'));
    return t ? t.textContent.trim() : 'Firma';
  }

  function construir() {
    el = document.createElement('div');
    el.id = 'firmaCompleta';
    el.className = 'firma-completa';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Firmar a pantalla completa');
    el.innerHTML =
      '<div class="fc-cab">' +
        '<div class="fc-quien"><span class="fc-etq" id="fcTitulo">Firma</span><b id="fcNombre"></b></div>' +
        '<span class="fc-giro">💡 Gira el celular si quieres más espacio</span>' +
      '</div>' +
      '<div class="fc-aviso" id="fcAviso">Ya hay una firma guardada. Si firmas aquí, la reemplaza; si tocas Listo sin firmar, queda la que estaba.</div>' +
      '<div class="fc-area"><canvas id="fcPad" class="pad-completa" data-completa="1"></canvas><div class="fc-linea" aria-hidden="true"></div></div>' +
      '<div class="fc-pie">' +
        '<button type="button" data-fc="cancelar">Cancelar</button>' +
        '<button type="button" data-fc="deshacer">Deshacer</button>' +
        '<button type="button" data-fc="borrar">Borrar</button>' +
        '<button type="button" data-fc="listo" class="fc-listo">Listo ✓</button>' +
        '<button type="button" data-fc="alterna">Firmar sin dibujar</button>' +
      '</div>';
    document.body.appendChild(el);
    const mgr = SignaturePad.createManager({ statusIdFor: () => '__fc_sin_estado' });
    const c = document.getElementById('fcPad');
    mgr.setup(c);
    pad = mgr.pads[c.id];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-fc]');
      if (!b) return;
      const acc = b.dataset.fc;
      if (acc === 'borrar') pad.clear();
      else if (acc === 'deshacer') pad.undo();
      else if (acc === 'cancelar') cerrar(false);
      else if (acc === 'listo') cerrar(true);
      // v143: quien no puede trazar firma con nombre y cédula también desde la pantalla completa
      else if (acc === 'alterna' && typeof FirmaAlterna !== 'undefined' && destino && destino._pad) { cerrar(false); setTimeout(() => FirmaAlterna.pedir(destino), 50); }
    });
    // v143: Escape cierra sin cambiar nada (teclado)
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(false); } });
    window.addEventListener('popstate', () => {
      if (ignorarPop) { ignorarPop = false; return; }
      if (abierta) { empujado = false; cerrarInterno(false); }
    });
  }

  function abrir(canvas, padDestino) {
    if (!padDestino) return;
    if (!el) construir();
    destino = canvas;
    destinoPad = padDestino;
    const previo = padDestino.getStrokes ? padDestino.getStrokes() : { strokes: [], base: false };
    teniaBase = !!previo.base;
    document.getElementById('fcTitulo').textContent = tituloBloque(canvas);
    document.getElementById('fcNombre').textContent = nombreFirmante(canvas);
    document.getElementById('fcAviso').style.display = teniaBase ? 'block' : 'none';
    document.documentElement.classList.add('fc-abierta');
    el.classList.add('abierta');
    abierta = true;
    setTimeout(() => { try { el.querySelector('[data-fc="cancelar"]').focus(); } catch (e) {} }, 60);   // v143: el foco entra a la ventana
    try { history.pushState({ firmaCompleta: true }, ''); empujado = true; } catch (e) { empujado = false; }
    // El lienzo mide 0×0 mientras está oculto: se ajusta ya visible.
    requestAnimationFrame(() => {
      pad.refreshSize();
      pad.clear();
      // Si en esta sesión ya se había firmado, se trae para poder corregirla.
      if (!teniaBase && previo.strokes && previo.strokes.length) pad.setStrokes(previo.strokes);
    });
  }

  function cerrarInterno(aceptar) {
    if (!abierta) return;
    if (aceptar) {
      const actual = pad.getStrokes();
      if (actual.strokes.length) destinoPad.setStrokes(actual.strokes);
      else if (!teniaBase) destinoPad.setStrokes([]); // borró todo y confirmó
      // El formulario guarda el borrador al detectar cambios dentro de él; el
      // lienzo grande está fuera, así que se avisa desde el recuadro original.
      destino.dispatchEvent(new Event('input', { bubbles: true }));
      destino.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.classList.remove('abierta');
    document.documentElement.classList.remove('fc-abierta');
    abierta = false;
    const volverA = destino;
    try { if (volverA) { if (!volverA.hasAttribute('tabindex')) volverA.setAttribute('tabindex', '-1'); volverA.focus({ preventScroll: true }); } } catch (e) {}   // v143: el foco vuelve al recuadro
    // Dos veces: si se giró el celular mientras se firmaba, la página detrás
    // cambió de medida y termina de acomodarse un momento después.
    requestAnimationFrame(() => {
      if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' });
      setTimeout(() => { if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' }); }, 300);
    });
  }

  function cerrar(aceptar) {
    cerrarInterno(aceptar);
    if (empujado) {
      empujado = false;
      ignorarPop = true;
      history.back();
    }
  }

  return { usar, abrir, cerrar, estaAbierta: () => abierta };
})();

/* ================= FESTIVOS DE COLOMBIA Y DÍAS HÁBILES =================
   Ley 51 de 1983 ("Emiliani") y Semana Santa. La misma cuenta está en
   backend-sgsst.gs, para que el celular y el correo digan el mismo plazo
   (reporte a la ARL: 2 días hábiles). */
const Festivos = {
  _cache: {},
  de(anio) {
    if (this._cache[anio]) return this._cache[anio];
    const iso = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    const f = (m, d) => new Date(Date.UTC(anio, m - 1, d));
    const lunes = (d) => { const w = d.getUTCDay(); if (w !== 1) d.setUTCDate(d.getUTCDate() + ((8 - w) % 7)); return d; };
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 19 * l) / 433);
    const mes = Math.floor((h + l - 7 * m + 90) / 25), dia = (h + l - 7 * m + 33 * mes + 19) % 32;
    const pascua = f(mes, dia);
    const mas = (n) => { const x = new Date(pascua.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
    const set = {};
    [f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25), mas(-3), mas(-2),
      lunes(f(1, 6)), lunes(f(3, 19)), lunes(f(6, 29)), lunes(f(8, 15)), lunes(f(10, 12)), lunes(f(11, 1)), lunes(f(11, 11)),
      lunes(mas(39)), lunes(mas(60)), lunes(mas(68))].forEach((x) => { set[iso(x)] = true; });
    return (this._cache[anio] = set);
  },
  esHabil(iso) { const p = iso.split('-').map(Number); const w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); return w !== 0 && w !== 6 && !this.de(p[0])[iso]; },
  sumarDias(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); },
  sumarHabiles(iso, n) { let d = iso, k = 0; while (k < n) { d = this.sumarDias(d, 1); if (this.esHabil(d)) k++; } return d; },
  hoy() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); },   // v148: siempre hora de Colombia (UTC−5, sin horario de verano), aunque el celular tenga otra zona
  sumarMeses(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1 + n, p[2])); if (d.getUTCDate() !== p[2]) d.setUTCDate(0); return d.toISOString().slice(0, 10); },
  corta(iso) { return /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : (iso || ''); }
};

/* ================= USUARIOS CON NOMBRE (SG-SST) =================
   Opcional: si el servidor SG-SST tiene usuarios, cada quien entra con su
   usuario y su clave. La clave NUNCA sale del celular: se deriva una "prueba"
   (PBKDF2, 150.000 vueltas) con la sal del usuario y eso es lo que viaja.
   La sesión dura 30 días en un equipo personal y 12 horas en uno compartido. */
const Sesion = {
  get KEY() { return Consola.clave('ssta-sesion'); },
  get KEY_MODO() { return Consola.clave('ssta-sgsst-usuarios'); },
  ITER: 150000,
  get() { try { const s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (s && s.token && s.exp > Date.now()) return s; } catch (e) {} return null; },
  token() { const s = this.get(); return s ? s.token : ''; },
  yo() { const s = this.get(); return s ? s.yo : null; },
  nombre() { const y = this.yo(); return y ? y.nombre : ''; },
  rol() { const y = this.yo(); return y ? y.rol : ''; },
  /** ¿El servidor usa usuarios? (lo dice cada lista que llega). */
  modo() { try { return localStorage.getItem(this.KEY_MODO) === '1'; } catch (e) { return false; } },
  _guardar(r) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ token: r.sesion, exp: r.exp, yo: r.yo })); localStorage.setItem(this.KEY_MODO, '1'); } catch (e) {}
    this.pintarChip();
  },
  /** Lo que dice el servidor en cada lista: si hay usuarios y quién soy (rol al día). */
  marcar(j) {
    if (!j || !j.ok) return;
    try {
      if (j.usuarios) localStorage.setItem(this.KEY_MODO, '1'); else localStorage.removeItem(this.KEY_MODO);
      const s = this.get();
      if (s && j.yo && j.yo.usuario === s.yo.usuario && JSON.stringify(j.yo) !== JSON.stringify(s.yo)) { s.yo = j.yo; localStorage.setItem(this.KEY, JSON.stringify(s)); this.pintarChip(); }
    } catch (e) {}
  },
  // v142: al cerrar sesión se borra del celular todo lo que se leyó o se dejó escrito (listas, registros,
  // personal, borradores, autoguardado). Solo queda lo que espera señal para enviarse (cola) y los ajustes.
  BORRAR_AL_SALIR: /^(ats-borrador|ats-plantillas)|ssta-(auto\||sgsst-lista|sgsst-doc|sgsst-usuarios|personal-lista|habilitacion|recientes|plantillas|ats-ultimo|ats-permisos|asis-personal|asis-doc|asis-borrador|convivencia-informe|prefill-permiso|draft-|reporta|tabla-|buzon-pub|ultimo-usuario|ultimo-sitio-permiso|ultimo-permiso-)/,
  /** v147: antes de salir avisa si hay envíos sin subir (quedan en el celular y se envían al volver la señal). */
  async salirSeguro() {
    let n = 0; try { if (typeof Outbox !== 'undefined') n = (await Outbox.list()).length; } catch (e) {}
    if (n && typeof Dialogo !== 'undefined' && !await Dialogo.confirmar('Hay ' + n + ' envío' + (n === 1 ? '' : 's') + ' sin subir (sin señal). Se quedan en este celular y se envían solos al volver la conexión, aunque cierres la sesión.\n\n¿Salir de todas formas?')) return false;
    this.salir(); location.reload(); return true;
  },
  salir() { try { if (typeof Habilitacion !== 'undefined') { Habilitacion._mapa = null; Habilitacion._cargando = null; } } catch (e) {} try { localStorage.removeItem(this.KEY); localStorage.removeItem('ssta-pendientes'); Object.keys(localStorage).filter((k) => this.BORRAR_AL_SALIR.test(k)).forEach((k) => localStorage.removeItem(k)); Object.keys(sessionStorage).filter((k) => /ssta-/.test(k)).forEach((k) => sessionStorage.removeItem(k)); } catch (e) {} try { if (typeof AutoGuardado !== 'undefined' && AutoGuardado._idb) AutoGuardado._idb.borrarPrefijo(''); } catch (e) {} this.pintarChip(); },
  /** Usuario dentro de un token (sin validar: solo para decidir qué reenviar). */
  _carga(tok) { try { const p = String(tok || '').split('.')[1]; return JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } },
  /** Para la cola: se reenvía con la sesión de ahora si es de la misma persona (o si la del
   *  registro venció o la rechazaron); la de otra persona, vigente, se respeta. */
  paraReenvio(tok, rechazada) {
    const c = this._carga(tok), yo = this.yo(), ahora = this.token();
    if (!ahora) return tok || '';
    if (rechazada || !c || !(c.exp > Date.now()) || (yo && c.u === yo.usuario)) return ahora;
    return tok;
  },
  /** El servidor no aceptó la sesión de este equipo (venció, la cerraron o cambió la clave). */
  rechazada() { if (this.get()) { try { localStorage.removeItem(this.KEY); } catch (e) {} this.pintarChip(); } },
  nuevaSal() { const a = crypto.getRandomValues(new Uint8Array(16)); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); },
  async derivar(clave, salHex, iter) {
    const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
    const sal = new Uint8Array(String(salHex).match(/../g).map((h) => parseInt(h, 16)));
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: Number(iter) || this.ITER }, llave, 256));
    let t = ''; bits.forEach((b) => { t += String.fromCharCode(b); }); return btoa(t);
  },
  claveDebil(c) { c = String(c || ''); return c.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c); },
  async _post(body) {
    const res = await fetch(SGSST.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: SGSST.token(), opId: SGSST.nuevoOpId() }, body)) });
    return SGSST._json(res);
  },
  async _sal(usuario) {
    const res = await fetchWithRetry(SGSST.url() + '?action=sal&usuario=' + encodeURIComponent(usuario) + '&token=' + encodeURIComponent(SGSST.token()));
    const j = await SGSST._json(res);
    if (!j.ok) throw new Error(j.error || 'No se pudo consultar el usuario.');
    return j;
  },
  async entrar(usuario, clave, compartido) {
    usuario = String(usuario || '').trim().toLowerCase();
    const s = await this._sal(usuario);
    let disp = ''; try { disp = localStorage.getItem('ssta-disp') || ''; if (!disp) { disp = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem('ssta-disp', disp); } } catch (e) {}
    const r = await this._post({ action: 'entrar', usuario, prueba: await this.derivar(clave, s.salt, s.iter), compartido: !!compartido, disp });
    if (r.ok) this._guardar(r);
    return r;
  },
  /** Datos para crear o cambiar una clave: sal nueva + prueba (la clave no viaja). */
  async datosClave(clave) { const salt = this.nuevaSal(); return { salt, iter: this.ITER, pruebaNueva: await this.derivar(clave, salt, this.ITER) }; },
  _abierto: false,
  _css() {
    if (document.getElementById('sesionCss')) return;
    const st = document.createElement('style'); st.id = 'sesionCss';
    /* v111: mismo lenguaje del diseño nuevo (vidrio, esquinas grandes, botón degradado). */
    st.textContent = '.ses-chip{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:60;background:var(--tinta);color:#fff;border:0;border-radius:var(--r-pill);padding:7px 12px;font:700 13px/1.2 inherit;font-family:inherit;box-shadow:0 6px 16px rgba(16,33,58,.25);max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}' +
      '.ses-chip.sin{background:#ff9d2e;color:#3a2a00;}' +
      /* v107: en el inicio el botón va dentro de la fila de botones del encabezado (no tapa Estado ni Ayuda) */
      '.hdr-acc .ses-chip{position:static;max-width:30vw;min-height:44px;border-radius:var(--r-xl);padding:0 14px;box-shadow:none;align-self:center;}' +
      '@media(max-width:520px){.hdr-acc .ses-chip{width:44px;min-height:44px;padding:0;font-size:var(--fs-display);}.hdr-acc .ses-chip .ses-nom{display:none;}}' +
      '.ses-fondo{position:fixed;inset:0;background:rgba(10,18,34,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:20050;display:flex;align-items:flex-end;justify-content:center;}' +
      '.ses-caja{background:rgba(255,255,255,.96);color:var(--tinta);width:100%;max-width:440px;border-radius:30px 30px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(16,33,58,.25);max-height:92vh;overflow:auto;}' +
      '.ses-caja:before{content:"";display:block;width:44px;height:5px;border-radius:var(--r-xs);background:var(--line);margin:-8px auto 14px;}' +
      '@media(min-width:600px){.ses-fondo{align-items:center}.ses-caja{border-radius:var(--r-2xl)}.ses-caja:before{display:none}}' +
      '.ses-caja h3{margin:0 0 4px;font-size:var(--fs-subtitulo);font-weight:800;letter-spacing:-.02em}.ses-caja p{margin:0 0 12px;font-size:var(--fs-base);color:var(--pizarra-500);line-height:1.45;font-weight:500}' +
      '.ses-caja label{display:block;font-size:var(--fs-menor);font-weight:700;margin:12px 0 5px;color:var(--pizarra-500);text-transform:uppercase;letter-spacing:.05em}' +
      '.ses-caja input[type=text],.ses-caja input[type=password]{width:100%;box-sizing:border-box;border:1.5px solid transparent;background:var(--bg);border-radius:var(--r-l);padding:14px 16px;font-size:var(--fs-campo);font-weight:600;font-family:inherit;color:var(--tinta)}' +
      '.ses-caja input[type=text]:focus,.ses-caja input[type=password]:focus{outline:none;background:#fff;border-color:var(--azul);box-shadow:0 0 0 4px rgba(47,107,255,.15)}' +
      '.ses-caja .ses-check{display:flex;gap:10px;align-items:center;font-weight:600;font-size:var(--fs-base);color:var(--tinta);text-transform:none;letter-spacing:0}' +
      '.ses-caja .ses-check input{width:20px;height:20px;accent-color:var(--azul)}' +
      '.ses-caja button{width:100%;border:0;border-radius:var(--r-pill);padding:15px;font-size:var(--fs-titulo);font-weight:800;margin-top:10px;cursor:pointer;font-family:inherit;min-height:52px}' +
      '.ses-caja .ses-si{background:linear-gradient(135deg,var(--azul),var(--violeta));color:#fff;box-shadow:0 10px 24px rgba(47,107,255,.35)}.ses-caja .ses-no{background:var(--bg);color:var(--tinta)}' +
      '.ses-caja .ses-msg{min-height:18px;font-size:var(--fs-base);color:var(--rojo-500);margin-top:8px;font-weight:600}';
    document.head.appendChild(st);
  },
  _caja(html) {
    this._css();
    const f = document.createElement('div'); f.className = 'ses-fondo';
    f.innerHTML = '<div class="ses-caja" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(f);
    return { el: f.querySelector('.ses-caja'), cerrar: () => f.remove() };
  },
  /** Ventana para entrar. Se abre sola cuando el servidor pide usuario. */
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body || !SGSST.url()) return;
    this._abierto = true;
    const m = this._caja('<h3>Entrar al sistema de gestión</h3><p>' + esc(motivo || 'Cada cambio queda con el nombre de quien lo hizo. Entra con tu usuario y tu contraseña (te los da el área SST).') + '</p>' +
      '<label for="sesUsr">Usuario</label><input type="text" id="sesUsr" autocomplete="username" autocapitalize="none" spellcheck="false">' +
      '<label for="sesClave">Contraseña</label><input type="password" id="sesClave" autocomplete="current-password">' +
      '<label class="ses-check"><input type="checkbox" id="sesComp"> Equipo compartido (la sesión dura 12 horas)</label>' +
      '<button type="button" class="ses-si" id="sesEntrar">Entrar</button><button type="button" class="ses-no" id="sesNo">Ahora no</button><div class="ses-msg" id="sesMsg"></div>');
    const cerrar = () => { m.cerrar(); this._abierto = false; };
    const usr = m.el.querySelector('#sesUsr'), cl = m.el.querySelector('#sesClave'), msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesEntrar');
    try { usr.value = localStorage.getItem(Consola.clave('ssta-ultimo-usuario')) || ''; } catch (e) {}
    // Empresa demo: usuarios ficticios para probar cada rol con un toque.
    const demo = typeof EMPRESA !== 'undefined' && EMPRESA.demo && EMPRESA.demoUsuarios;
    if (demo) {
      const d = document.createElement('div');
      d.innerHTML = '<p style="margin:14px 0 6px;font-size:var(--fs-menor);font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Demo · entra como</p><div style="display:flex;flex-wrap:wrap;gap:8px;">' + EMPRESA.demoUsuarios.map((u, i) => '<button type="button" class="ses-no" data-demo="' + i + '" style="width:auto;margin:0;padding:9px 14px;min-height:40px;font-size:var(--fs-base);font-weight:700;">' + esc(u[2]) + '</button>').join('') + '</div>';
      m.el.querySelector('#sesMsg').insertAdjacentElement('beforebegin', d);
      d.addEventListener('click', (e) => { const x = e.target.closest('[data-demo]'); if (!x) return; const u = EMPRESA.demoUsuarios[+x.dataset.demo]; usr.value = u[0]; cl.value = u[1]; ir(); });
    }
    m.el.querySelector('#sesNo').addEventListener('click', cerrar);
    const ir = async () => {
      if (!usr.value.trim() || !cl.value) { msg.textContent = 'Escribe el usuario y la clave.'; return; }
      b.disabled = true; msg.textContent = 'Comprobando…';
      try {
        const r = await this.entrar(usr.value, cl.value, m.el.querySelector('#sesComp').checked);
        if (!r.ok) { msg.textContent = r.error || 'No se pudo entrar.'; b.disabled = false; return; }
        try { localStorage.setItem(Consola.clave('ssta-ultimo-usuario'), usr.value.trim().toLowerCase()); } catch (e) {}
        cerrar();
        if (r.yo && r.yo.debeCambiar) this.cambiarClave(true);
        else this._despues();
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    };
    b.addEventListener('click', ir);
    cl.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
    setTimeout(() => (usr.value ? cl : usr).focus(), 60);
  },
  /** Después de entrar: lo pendiente sale; la página se recarga si no hay nada a medio escribir. */
  _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    if (document.querySelector('.modal-fondo')) { if (typeof UI !== 'undefined') UI.toast('✓ Entraste como ' + this.nombre() + '. Vuelve a guardar.'); }
    else location.reload();
  },
  cambiarClave(obligatorio) {
    const m = this._caja('<h3>🔑 ' + (obligatorio ? 'Crea tu clave' : 'Cambiar mi clave') + '</h3><p>' + (obligatorio ? 'Entraste con una clave temporal. Escribe una tuya: mínimo 8 caracteres, con letras y números. Nadie más la conoce (ni el administrador).' : 'Mínimo 8 caracteres, con letras y números. Al cambiarla se cierran tus sesiones en los demás equipos.') + '</p>' +
      '<label for="sesAct">Clave actual' + (obligatorio ? ' (la temporal)' : '') + '</label><input type="password" id="sesAct" autocomplete="current-password">' +
      '<label for="sesN1">Clave nueva</label><input type="password" id="sesN1" autocomplete="new-password">' +
      '<label for="sesN2">Repite la clave nueva</label><input type="password" id="sesN2" autocomplete="new-password">' +
      '<button type="button" class="ses-si" id="sesOk">Guardar mi clave</button>' + (obligatorio ? '' : '<button type="button" class="ses-no" id="sesNo">Cancelar</button>') + '<div class="ses-msg" id="sesMsg"></div>');
    const v = (id) => m.el.querySelector(id).value, msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesOk');
    const no = m.el.querySelector('#sesNo'); if (no) no.addEventListener('click', m.cerrar);
    b.addEventListener('click', async () => {
      if (this.claveDebil(v('#sesN1'))) { msg.textContent = 'La clave nueva necesita mínimo 8 caracteres, con letras y números.'; return; }
      if (v('#sesN1') !== v('#sesN2')) { msg.textContent = 'Las dos claves nuevas no coinciden.'; return; }
      b.disabled = true; msg.textContent = 'Guardando…';
      try {
        const yo = this.yo(); const s = await this._sal(yo.usuario);
        const r = await this._post(Object.assign({ action: 'cambiarMiClave', sesion: this.token(), prueba: await this.derivar(v('#sesAct'), s.salt, s.iter) }, await this.datosClave(v('#sesN1'))));
        if (!r.ok) { msg.textContent = r.error || 'No se pudo cambiar.'; b.disabled = false; return; }
        this._guardar(r); m.cerrar();
        if (obligatorio) this._despues(); else if (typeof UI !== 'undefined') UI.toast('✓ Clave cambiada.');
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    });
  },
  menu() {
    const yo = this.yo();
    if (!yo) { this.pedir(); return; }
    const ROL = { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' };
    const m = this._caja('<h3>👤 ' + esc(yo.nombre) + '</h3><p>Usuario <b>' + esc(yo.usuario) + '</b> · ' + esc(ROL[yo.rol] || yo.rol) + (yo.cargo ? ' · ' + esc(yo.cargo) : '') + '</p>' +
      (yo.rol === 'admin' ? '<button type="button" class="ses-no" id="sesUsuarios">👥 Usuarios y respaldo</button>' : '') +
      '<button type="button" class="ses-no" id="sesCambiar">🔑 Cambiar mi clave</button>' +
      '<button type="button" class="ses-no" id="sesSalir">Salir de este equipo</button><button type="button" class="ses-si" id="sesCerrar">Listo</button>');
    m.el.querySelector('#sesCerrar').addEventListener('click', m.cerrar);
    const u = m.el.querySelector('#sesUsuarios'); if (u) u.addEventListener('click', () => { location.href = 'usuarios.html'; });
    m.el.querySelector('#sesCambiar').addEventListener('click', () => { m.cerrar(); this.cambiarClave(false); });
    m.el.querySelector('#sesSalir').addEventListener('click', () => { m.cerrar(); this.salirSeguro(); });
  },
  /** Botón 👤 arriba a la derecha (solo si el servidor usa usuarios o hay sesión). */
  pintarChip() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.body.classList.contains('consola')) return;   // la consola muestra quién entró en su encabezado
    let c = document.getElementById('sesChip');
    const yo = this.yo();
    if (!yo && !this.modo()) { if (c) c.remove(); return; }
    this._css();
    if (!c) { c = document.createElement('button'); c.type = 'button'; c.id = 'sesChip'; c.addEventListener('click', () => this.menu()); const acc = document.querySelector('.hdr-acc'); if (acc) acc.insertBefore(c, acc.firstChild); else document.body.appendChild(c); }
    c.className = 'ses-chip' + (yo ? '' : ' sin');
    c.innerHTML = '<span aria-hidden="true">👤</span><span class="ses-nom"> ' + esc(yo ? String(yo.nombre || yo.usuario).split(' ')[0] : 'Entrar') + '</span>';
    c.setAttribute('aria-label', yo ? 'Sesión de ' + yo.nombre : 'Entrar con mi usuario');
  },
  montarChip() {
    if (typeof document === 'undefined') return;
    if (document.body) this.pintarChip(); else document.addEventListener('DOMContentLoaded', () => this.pintarChip());
  }
};

/* ================= SERVIDOR SG-SST =================
   Personal habilitado, reportes, plan de acción, indicadores, equipos e
   inspecciones viven en un solo backend (backend-sgsst.gs). Aquí: listar
   (con copia en el equipo para ver sin señal), abrir un documento y enviar
   (si no hay señal, a la cola; se manda solo al volver). */
const SGSST = {
  url() { const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.sgsst) || {}; return B.url || ''; },
  token() { return (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || ''; },
  nuevoId(prefijo) {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return prefijo + '-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  },
  nuevoOpId() { return 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); },
  _lsGet(k, def) { try { const v = localStorage.getItem(Consola.clave(k)); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  _lsSet(k, v) { try { localStorage.setItem(Consola.clave(k), JSON.stringify(v)); } catch (e) { /* memoria llena: no es grave */ } },
  async _json(res) {
    const t = await res.text();
    try { return JSON.parse(t); } catch (e) { const err = new Error(Outbox.describirPagina ? Outbox.describirPagina(t, res.status) : 'Respuesta no válida'); err.pagina = true; throw err; }
  },
  /** Lista de un tipo (o varios separados por coma). Sin señal devuelve la última copia. */
  /** v148: tipos con datos de salud o reservados: sin copia en el celular (una tablet compartida no los muestra sin señal). */
  RESERVADOS: ['examen', 'ausencia', 'perfil', 'sve', 'pvecaso', 'psico', 'preopsalud', 'cliente', 'queja', 'buzon'],
  /* v168 · La copia de cada lista vive en IndexedDB (cabe lo que haga falta y no le quita espacio a los borradores
     ni a las firmas, que usan localStorage). Si el navegador no deja, sigue en localStorage como antes. */
  _copiaDb: null,
  _idb() {
    if (this._copiaDb) return this._copiaDb;
    this._copiaDb = new Promise((ok) => {
      try {
        if (typeof indexedDB === 'undefined') return ok(null);
        const r = indexedDB.open('ssta-listas', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null);
      } catch (e) { ok(null); }
    });
    return this._copiaDb;
  },
  _copiaClave(clave) { return ((typeof EMPRESA !== 'undefined' && EMPRESA.codigo) || '') + '|' + Consola.clave(clave); },
  async _copiaOp(modo, fn) {
    const db = await this._idb(); if (!db) return undefined;
    return new Promise((ok) => {
      try {
        const tx = db.transaction('kv', modo), q = fn(tx.objectStore('kv'));
        tx.oncomplete = () => ok(q && q.result !== undefined ? q.result : true);
        tx.onerror = tx.onabort = () => ok(undefined);
      } catch (e) { ok(undefined); }
    });
  },
  async _copiaGet(clave) {
    const v = await this._copiaOp('readonly', (s) => s.get(this._copiaClave(clave)));
    return v && v !== true ? v : this._lsGet(clave, null);   // la copia de antes de la v168 estaba en localStorage
  },
  async _copiaSet(clave, v) {
    const bien = await this._copiaOp('readwrite', (s) => s.put(v, this._copiaClave(clave)));
    if (bien) { try { localStorage.removeItem(Consola.clave(clave)); } catch (e) {} } else this._lsSet(clave, v);
  },
  async _copiaDel(clave) {
    await this._copiaOp('readwrite', (s) => s.delete(this._copiaClave(clave)));
    try { localStorage.removeItem(Consola.clave(clave)); } catch (e) {}
  },
  /** v168: une la copia del celular con lo que cambió en el servidor. Mismo orden que la hoja: lo modificado queda
   *  en su sitio y lo nuevo al final. */
  unirCambios(base, j) {
    const fuera = {}, nuevas = {};
    (j.borrados || []).forEach((id) => { fuera[id] = 1; });
    (j.rows || []).forEach((r) => { nuevas[r.id] = r; });
    const out = [];
    (base || []).forEach((r) => { if (fuera[r.id]) return; if (nuevas[r.id]) { out.push(nuevas[r.id]); delete nuevas[r.id]; } else out.push(r); });
    (j.rows || []).forEach((r) => { if (nuevas[r.id]) out.push(r); });
    return out;
  },
  LISTA_COMPLETA_CADA_MS: 24 * 3600 * 1000,
  async listar(tipos, opciones) {
    const clave = 'ssta-sgsst-lista:' + tipos;
    const reservado = String(tipos).split(',').some((t) => this.RESERVADOS.indexOf(t.trim()) !== -1);
    if (reservado) await this._copiaDel(clave);
    const copia = reservado ? null : await this._copiaGet(clave);
    if (!this.url()) return { rows: (copia && copia.rows) || [], sinServidor: true };
    try {
      const base = this.url() + '?action=list&tipo=' + encodeURIComponent(tipos) + '&token=' + encodeURIComponent(this.token()) + this._ses();
      // v168: si la copia es de este servidor y se completó hace menos de un día, se piden solo los cambios desde entonces.
      const fresca = copia && copia.completa && Date.now() - Date.parse(copia.completa) < this.LISTA_COMPLETA_CADA_MS;
      const sirve = fresca && Array.isArray(copia.rows) && copia.hasta && copia.gen;
      const enc = encodeURIComponent;
      const cambios = sirve ? '&cambios=' + enc(copia.hasta) + '&gen=' + enc(copia.gen) + '&vista=' + enc(copia.vista || '') : '';
      let j = await this._json(await fetchWithRetry(base + cambios));
      if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pintarChip(); if (!(opciones && opciones.sinPedir)) Sesion.pedir(j.error); return { rows: [], sinSesion: true, error: j.error }; }
      if (!j.ok) { const e = new Error(j.error || 'error del servidor'); e.json = j; throw e; }
      let delServidor = j.rows, completa = new Date().toISOString();
      if (j.delta) {
        delServidor = this.unirCambios(copia.rows, j); completa = copia.completa;
        // Si la cuenta no cuadra con la del servidor, la copia no sirve: se pide la lista entera.
        if (j.total !== undefined && delServidor.length !== j.total) {
          j = await this._json(await fetchWithRetry(base));
          if (!j.ok) { const e = new Error(j.error || 'error del servidor'); e.json = j; throw e; }
          delServidor = j.rows; completa = new Date().toISOString();
        }
      }
      Sesion.marcar(j);
      const rows = delServidor.concat(this.pendientesLocales(tipos).filter((p) => !delServidor.some((r) => r.id === p.id)));
      const nueva = { rows: delServidor, en: new Date().toISOString(), gen: j.gen || '', vista: j.vista || '', hasta: j.hasta || '', completa };
      if (!reservado) await this._copiaSet(clave, nueva);
      return { rows };
    } catch (e) {
      if (e.json && ClavePortal.esErrorDeClave(e.json)) ClavePortal.pedir();
      const rows = ((copia && copia.rows) || []).concat(this.pendientesLocales(tipos).filter((p) => !((copia && copia.rows) || []).some((r) => r.id === p.id)));
      return { rows, desdeCopia: true, copiaDel: copia && copia.en, error: e.message };
    }
  },
  async doc(id) {
    const local = this._lsGet('ssta-sgsst-doc:' + id, null);
    if (!this.url()) return local;
    try {
      const res = await fetchWithRetry(this.url() + '?action=doc&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(this.token()) + this._ses());
      const j = await this._json(res);
      if (j.ok) { const d = Object.assign({}, j.doc, { version: j.version }); return d; }
      this.ultimoError = j.error || '';
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); return null; }
      if (j.codigoError === 'PERMISO') return null;
      return local;
    } catch (e) { return local; }
  },
  /* Lo enviado sin señal se muestra igual en las listas ("pendiente"). */
  pendientesLocales(tipos) {
    const p = this._lsGet('ssta-sgsst-pend', {}), t = String(tipos || '').split(',');
    return Object.keys(p).map((k) => p[k]).filter((x) => t.indexOf(x.tipo) !== -1);
  },
  /** Envía {action:'guardar'|'parche'|'borrar', tipo, id, …}. Devuelve {ok, enCola, …}.
   *  opciones.sinCola: si no hay conexión NO se guarda para después (p. ej. la
   *  clave del Comité de Convivencia: un cambio de clave atrasado sería peligroso). */
  _ses() { const t = Sesion.token(); return t ? '&sesion=' + encodeURIComponent(t) : ''; },
  /** GET con la clave del portal y la sesión (historial, adjuntos, usuarios…). */
  async consultar(params) {
    const q = Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
    const res = await fetchWithRetry(this.url() + '?' + q + '&token=' + encodeURIComponent(this.token()) + this._ses());
    const j = await this._json(res);
    if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); }
    return j;
  },
  async enviar(body, filaLocal, opciones) {
    body = Object.assign({ opId: this.nuevoOpId(), token: this.token(), sesion: Sesion.token() }, body);
    // v134: contra spam en lo que se envía sin usuario: campo trampa invisible y tiempo mínimo en la página
    if (!Sesion.token() && body.action === 'guardar') {
      const tr = document.querySelector('#sstaTrampa input'); if (tr && tr.value) return { ok: true, id: body.id };
      if (body._ms == null) body._ms = Math.round((typeof performance !== 'undefined' ? performance.now() : 5000));
    }
    const encolar = async (motivo) => {
      if (opciones && opciones.sinCola) return { ok: false, error: 'Se necesita conexión (' + motivo + '). Inténtalo de nuevo con señal.', sinConexion: true };
      await Outbox.add(this.url(), body);
      if (filaLocal) { const p = this._lsGet('ssta-sgsst-pend', {}); p[body.id] = Object.assign({ id: body.id, tipo: body.tipo, pendiente: true }, filaLocal); this._lsSet('ssta-sgsst-pend', p); }
      return { ok: true, enCola: true, motivo };
    };
    if (!this.url()) return { ok: false, error: 'El servidor SG-SST no está configurado (config.js → BACKENDS.sgsst).' };
    if (!navigator.onLine) return encolar('sin señal');
    try {
      const res = await fetchWithRetry(this.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const j = await this._json(res);
      if (j.ok) return j;
      if (ClavePortal.esErrorDeClave(j)) { ClavePortal.pedir(); return { ok: false, error: j.error, clave: true }; }
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pedir(j.error); return j; }
      if (j.codigoError === 'CAMBIAR') { if (Sesion.yo()) Sesion.cambiarClave(true); return j; }
      // v142: dato de salud sin autorización de la persona: se pide la base legal y se reintenta.
      if (j.codigoError === 'AUTORIZACION' && body.doc && !body._baseLegalPedida && typeof Dialogo !== 'undefined') {
        const si = await Dialogo.confirmar(j.error + '\n\n¿La persona autoriza que se guarden?');
        if (si) return this.enviar(Object.assign({}, body, { _baseLegalPedida: true, doc: Object.assign({}, body.doc, { autorizaSalud: true }) }), filaLocal, opciones);
        return j;
      }
      if (Outbox._esTemporal(j)) return encolar('servidor ocupado');
      return j;
    } catch (e) {
      return encolar(e.pagina ? 'el servidor no respondió con datos' : 'sin conexión');
    }
  }
};
window.addEventListener('outbox-fallido', (ev) => {
  const b = ev.detail && ev.detail.item && ev.detail.item.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});
window.addEventListener('outbox-enviado', (ev) => {
  const b = ev.detail && ev.detail.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});

/* ================= PERSONAL HABILITADO =================
   Al escribir o traer la cédula de alguien en un permiso, el ATS o el anexo,
   aparece debajo si está habilitado: "✓ Habilitado", "⚠ Curso de alturas
   vencido el 12/08/2026", "Vence pronto…". Al guardar, si alguien no está
   habilitado, se pide confirmar y queda anotado en el registro.
   Los requisitos y lo que exige cada formato vienen de empresa.js. */
/* v154 · Departamentos y áreas de la empresa (se definen en areas.html y quedan en el perfil de la empresa).
   Todos los campos de «Área» del portal los ofrecen al escribir, para que se llamen igual en todas partes
   (y los informes por área cuadren). Se guardan en el equipo para usarlos también sin señal. */
const Areas = {
  K: 'ssta-areas',
  lista() { try { return JSON.parse(localStorage.getItem(this.K) || '[]'); } catch (e) { return []; } },
  guardarLocal(l) { try { localStorage.setItem(this.K, JSON.stringify(l || [])); } catch (e) {} },
  deTexto(t) { return String(t || '').split(/\n/).map((x) => x.split('|')[0].trim()).filter(Boolean); },
  async refrescar() {
    try {
      if (typeof SGSST === 'undefined' || !SGSST.url() || (typeof Sesion !== 'undefined' && Sesion.modo && Sesion.modo() && !Sesion.yo())) return this.lista();
      const r = await SGSST.listar('empresa', { sinPedir: true }); const f = ((r && r.rows) || []).find((x) => x.id === 'EMPRESA-PERFIL');
      if (f && f.resumen && f.resumen.areasTexto !== undefined) { this.guardarLocal(this.deTexto(f.resumen.areasTexto)); this.enlazar(); }
    } catch (e) {}
    return this.lista();
  },
  SEL: '#inArea, #pArea, #fArea, #obraArea, #iArea, #eArea, #areaAlt, #eqArea, #pProceso, [data-areas]',
  enlazar(raiz) {
    const l = this.lista(); if (!l.length || typeof document === 'undefined') return;
    let dl = document.getElementById('ssta-areas-dl');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'ssta-areas-dl'; document.body.appendChild(dl); }
    const html = l.map((a) => '<option value="' + String(a).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])) + '">').join('');
    if (dl._html !== html) { dl._html = html; dl.innerHTML = html; }
    (raiz || document).querySelectorAll(this.SEL).forEach((i) => {
      const otro = i.getAttribute('list');
      // v162 · El área se escribe igual siempre: si coincide con una oficial (sin importar tildes ni mayúsculas) queda
      // con la ortografía oficial; si es nueva, se avisa en el campo (sin bloquear).
      if (!i.dataset.areaCanon) { i.dataset.areaCanon = '1'; i.addEventListener('change', () => this.canon(i)); }
      if (!otro) { i.setAttribute('list', 'ssta-areas-dl'); i.setAttribute('autocomplete', 'off'); return; }
      if (otro === 'ssta-areas-dl') return;
      const d2 = document.getElementById(otro); if (!d2) return;
      const ya = new Set([...d2.options].map((o) => o.value)); l.forEach((a) => { if (!ya.has(a)) { const o = document.createElement('option'); o.value = a; d2.appendChild(o); } });
    });
  },
  canon(i) {
    const l = this.lista(), v = String(i.value || '').trim(); if (!l.length || !v) return;
    const n = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const of = l.find((a) => n(a) === n(v)); let av = i.parentNode && i.parentNode.querySelector('.area-nueva');
    if (of) { if (of !== v) { i.value = of; i.dispatchEvent(new Event('input', { bubbles: true })); } if (av) av.remove(); return; }
    if (!av) { av = document.createElement('div'); av.className = 'ayuda area-nueva'; i.insertAdjacentElement('afterend', av); }
    av.textContent = '«' + v + '» no está en la lista de áreas. Si es nueva, agrégala en Departamentos y áreas para que los informes no la cuenten aparte.';
  },
  vigilar() {
    if (typeof document === 'undefined' || this._v) return; this._v = true;
    const ir = () => { this.enlazar(); new MutationObserver(() => { clearTimeout(this._t); this._t = setTimeout(() => this.enlazar(), 120); }).observe(document.body, { childList: true, subtree: true }); setTimeout(() => this.refrescar(), 1500); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ir); else ir();
  }
};
if (typeof document !== 'undefined') Areas.vigilar();

/* v159 · Autollenado por cédula en TODO el portal (también permisos, ATS, charlas e inspección de EPP):
   al escribir una cédula conocida (Personal habilitado o la base de personal) o al elegir a alguien por su
   nombre, se llenan solos, en el mismo bloque, los campos VACÍOS de nombre, cédula, cargo, área y empresa.
   Nunca se pisa lo que ya está escrito. */
const AutoCedula = (function () {
  const etiq = (i) => [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), (i.labels && i.labels[0] && i.labels[0].textContent) || (i.closest('.field') && (i.closest('.field').querySelector('label') || {}).textContent) || ''].join(' ');
  const QUE = { cedula: /c[eé]dula|\bcc\b|c\.\s?c\.|documento de identidad|n[uú]mero de documento|^documento|\bdocumento\b/i, cargo: /\bcargo\b|oficio/i, area: /\b[aá]rea\b|departamento|dependencia/i, empresa: /empresa|contratista/i, nombre: /nombre/i };
  const NO = /firma|acudiente|contacto|emergencia|placa|equipo|veh[ií]culo|soporte|archivo|nit\b/i;
  const esCedula = (i) => !i.dataset.cedListo && i.dataset.noAc == null && /^(text|number|tel|search)$/.test(i.type || 'text') && QUE.cedula.test(etiq(i)) && !NO.test(etiq(i));
  // El bloque de la persona: el contenedor más grande que tiene UNA sola cédula (así, en una lista de
  // ejecutantes o asistentes, nunca se llenan las filas de otros), sin salir de su tarjeta o formulario.
  function bloqueDe(i) {
    const tope = i.closest('[data-persona-bloque]'); if (tope) return tope;
    const lim = i.closest('.card, form, .modal, section, .screen') || document.body;
    let el = i.parentElement, mejor = null;
    while (el) {
      const ceds = [...el.querySelectorAll('input')].filter((x) => QUE.cedula.test(etiq(x)) && !NO.test(etiq(x))).length;
      if (ceds > 1) break;
      mejor = el;
      if (el === lim) break;
      el = el.parentElement;
    }
    return mejor;
  }
  function llenarVecinos(i, p) {
    const b = bloqueDe(i); if (!b || !p) return;
    b.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]), select').forEach((x) => {
      if (x === i || x.value || x.disabled || x.readOnly) return; const t = etiq(x); if (NO.test(t)) return;
      const v = QUE.cedula.test(t) ? p.cedula : QUE.cargo.test(t) ? p.cargo : (QUE.area.test(t) && !QUE.empresa.test(t)) ? p.area : QUE.empresa.test(t) ? p.empresa : (QUE.nombre.test(t) || x.dataset.persona != null) && !/apellido/i.test(t) ? p.nombre : '';
      if (!v) return;
      if (x.tagName === 'SELECT' && ![...x.options].some((o) => o.value === v)) return;
      x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async function buscar(ced) {
    const k = Habilitacion.clave(ced); if (k.length < 5) return null;
    let p = null;
    try { const m = await Habilitacion.cargar(); if (m && m[k]) p = m[k]; } catch (e) {}
    if (!p) try { const l = JSON.parse(localStorage.getItem('ssta-personal-lista') || '[]'); p = (Array.isArray(l) ? l : []).find((x) => Habilitacion.clave(x.cedula) === k) || null; } catch (e) {}
    return p ? { nombre: p.nombre || '', cedula: p.cedula || ced, cargo: p.cargo || '', area: p.area || '', empresa: p.empresa || '' } : null;
  }
  function enlazar(i) {
    i.dataset.cedListo = '1';
    const ir = async () => { const p = await buscar(i.value); if (p) llenarVecinos(i, p); };
    i.addEventListener('change', ir); i.addEventListener('blur', ir);
  }
  function revisar(raiz) { (raiz || document).querySelectorAll('input:not([data-ced-listo])').forEach((i) => { if (esCedula(i)) enlazar(i); }); }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const arrancar = () => { revisar(); let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => revisar(), 150); }).observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else setTimeout(arrancar, 0);
  }
  return { llenarVecinos, buscar, revisar };
})();

const Habilitacion = {
  CONFIG_FABRICA: {
    requisitos: {
      seguridad_social: { nombre: 'Pago de seguridad social (PILA)', meses: 1 },
      induccion: { nombre: 'Inducción / reinducción en SST', meses: 12 },
      medico: { nombre: 'Concepto médico ocupacional', meses: 12, apto: true },
      alturas: { nombre: 'Curso de trabajo en alturas', meses: 18 },
      confinados: { nombre: 'Curso de espacios confinados', meses: 12 },
      izajes: { nombre: 'Certificación de izaje (rigger / operador)', meses: 12 },
      electrico: { nombre: 'Competencia en riesgo eléctrico', meses: 12 },
      caliente: { nombre: 'Capacitación en trabajo en caliente', meses: 12 },
      // v151: quien manipula alimentos (casino, cocina, cafetería). Res. 2674 de 2013, art. 11–12: certificado médico y capacitación continua.
      alimentos: { nombre: 'Concepto de manipulación de alimentos', meses: 12, apto: true }
    },
    exigir: { todos: ['seguridad_social', 'induccion', 'medico'], alturas: ['alturas'], confinados: ['confinados'], izajes: ['izajes'], electrico: ['electrico'], caliente: ['caliente'] },
    avisarDias: 15
  },
  config() { const e = (typeof EMPRESA !== 'undefined' && EMPRESA.habilitacion) || {}; const f = this.CONFIG_FABRICA;
    // v151: los requisitos nuevos de fábrica (p. ej. manipulación de alimentos) aparecen también en empresas ya configuradas.
    return { requisitos: e.requisitos ? Object.assign({}, f.requisitos, e.requisitos) : f.requisitos, exigir: e.exigir || f.exigir, avisarDias: e.avisarDias || f.avisarDias }; },
  _mapa: null,
  _cargando: null,
  clave(c) { return String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); },
  /** Mapa cédula → trabajador. Se guarda en el equipo para usarlo sin señal. */
  cargar(forzar) {
    if (this._mapa && !forzar) return Promise.resolve(this._mapa);
    if (this._cargando && !forzar) return this._cargando;
    const desdeCopia = SGSST._lsGet('ssta-habilitacion', null);
    if (desdeCopia && !this._mapa) { this._mapa = desdeCopia.mapa; this._copiaDel = desdeCopia.en || ''; }
    this._cargando = (async () => {
      if (!SGSST.url()) return this._mapa || {};
      // En segundo plano: sin usuario (p. ej. el preoperacional público) no pide entrar ni borra la copia.
      const r = await SGSST.listar('trabajador', { sinPedir: true });
      if (!r.desdeCopia && !r.sinSesion && !r.sinServidor) {
        const mapa = {};
        r.rows.forEach((x) => { const k = this.clave(x.resumen && x.resumen.cedula); if (k) mapa[k] = Object.assign({ id: x.id }, x.resumen); });
        this._mapa = mapa; this._copiaDel = new Date().toISOString();
        SGSST._lsSet('ssta-habilitacion', { mapa, en: this._copiaDel });
      } else { const yo = this; setTimeout(() => { if (yo._cargando === p) yo._cargando = null; }, 120000); }   // v148: sin señal se vuelve a intentar en 2 minutos
      return this._mapa || {};
    })();
    const p = this._cargando;
    return this._cargando;
  },
  /** Requisitos que exige un contexto ("general", "alturas", "confinados"… o varios). */
  exigidos(contexto) {
    const ex = this.config().exigir, set = [];
    (ex.todos || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); });
    [].concat(contexto || []).forEach((c) => (ex[c] || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); }));
    return set;
  },
  /** {estado: 'ok'|'pronto'|'mal'|'sin-registro'|'sin-datos', problemas:[], avisos:[]} */
  ALTO_RIESGO: ['alturas', 'confinados', 'izajes', 'electrico', 'caliente'],
  /** v158 · Semáforo de la cuadrilla antes de empezar: cuántos están en verde, por vencer o bloqueados, y por qué.
      filas: [{cc, nombre}]. Pinta en el elemento y devuelve el conteo. */
  semaforo(el, filas, contexto, hasta) {
    if (!el) return null;
    const l = (filas || []).filter((f) => this.clave(f.cc)); if (!l.length) { el.innerHTML = ''; return null; }
    const r = l.map((f) => Object.assign({ f }, this.revisar(f.cc, contexto, hasta)));
    if (r.every((x) => x.estado === 'sin-datos')) { el.innerHTML = ''; return null; }
    const ok = r.filter((x) => x.estado === 'ok'), pr = r.filter((x) => x.estado === 'pronto'), mal = r.filter((x) => x.estado === 'mal'), cl = mal.length ? 'mal' : pr.length ? 'amar' : 'ok';
    const e = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.innerHTML = '<div class="aviso ' + cl + ' sem-cuad"><b>Cuadrilla:</b> ' + ok.length + ' en verde · ' + pr.length + ' por vencer · ' + mal.length + ' no habilitado(s)' +
      (mal.concat(pr).length ? '<ul style="margin:6px 0 0 18px;padding:0;">' + mal.concat(pr).map((x) => '<li><b>' + e(x.f.nombre || x.f.cc) + ':</b> ' + e(x.problemas.concat(x.avisos).slice(0, 3).join(' · ')) + '</li>').join('') + '</ul>' : '') + '</div>';
    return { ok: ok.length, pronto: pr.length, mal: mal.length };
  },
  /** v148: hasta qué fecha debe estar vigente (un permiso de varios días: su último día). */
  revisar(cedula, contexto, hasta) {
    const k = this.clave(cedula);
    if (!k) return { estado: 'sin-datos', problemas: [], avisos: [] };
    const mapa = this._mapa || {};
    if (!Object.keys(mapa).length) return { estado: 'sin-datos', problemas: [], avisos: [] };   // el módulo aún no se usa
    const ctx = [].concat(contexto || []), alto = ctx.some((c) => this.ALTO_RIESGO.indexOf(c) !== -1);
    const t = mapa[k];
    if (!t) return { estado: alto ? 'mal' : 'sin-registro', problemas: ['No está en Personal habilitado'], avisos: [] };   // v148: en alto riesgo, sin registro = no habilitado
    if (t.activo === false) return { estado: 'mal', problemas: ['Está marcado como inactivo en Personal habilitado'], avisos: [], trabajador: t };
    const cfg = this.config(), hoy = Festivos.hoy(), ref = hasta && String(hasta).slice(0, 10) > hoy ? String(hasta).slice(0, 10) : hoy, pronto = Festivos.sumarDias(hoy, cfg.avisarDias);
    const problemas = [], avisos = [];
    // v148: una copia vieja (más de 2 días sin señal) no sirve para decir que alguien está habilitado.
    if (this._copiaDel && Date.now() - new Date(this._copiaDel).getTime() > 48 * 3600000) avisos.push('Lista del personal sin actualizar desde el ' + Festivos.corta(String(this._copiaDel).slice(0, 10)));
    // v157: restricción médica para este trabajo (viene del examen; sin diagnóstico).
    const rm = t.restr;
    if (rm && (rm.para || []).length && (!rm.hasta || rm.hasta >= hoy)) {
      const NOM = { alturas: 'trabajo en alturas', confinados: 'espacios confinados', caliente: 'trabajo en caliente', electrico: 'riesgo eléctrico', izajes: 'izaje de cargas', cargas: 'manipulación de cargas', conduccion: 'conducción', todo: 'el trabajo (concepto no apto)' };
      const afecta = rm.para.filter((p) => p === 'todo' ? alto : ctx.indexOf(p) !== -1);
      afecta.forEach((p) => problemas.push('Restricción médica para ' + NOM[p] + (rm.hasta ? ' hasta el ' + Festivos.corta(rm.hasta) : ' (permanente)')));
      if (!afecta.length) avisos.push('Tiene restricción médica para: ' + rm.para.map((p) => NOM[p] || p).join(', '));
    }
    this.exigidos(ctx).forEach((req) => {
      const def = cfg.requisitos[req] || { nombre: req }, r = (t.req || {})[req];
      if (!r || (!r.fecha && !r.vence)) { problemas.push('Sin ' + def.nombre.charAt(0).toLowerCase() + def.nombre.slice(1)); return; }
      // v148: sin fecha de vencimiento se calcula con la vigencia del requisito (antes quedaba vigente para siempre)
      const vence = String(r.vence || (r.fecha && def.meses ? Festivos.sumarDias(Festivos.sumarMeses(String(r.fecha).slice(0, 10), def.meses), -1) : '') || '').slice(0, 10);
      if (def.apto && !String(r.apto || '').trim()) { problemas.push(def.nombre + ': sin concepto registrado'); return; }
      if (def.apto && /no apto|aplazado/i.test(r.apto || '')) { problemas.push(def.nombre + ': ' + String(r.apto).toUpperCase()); return; }
      if (vence && vence < hoy) { problemas.push(def.nombre + ' vencido el ' + Festivos.corta(vence)); return; }
      if (vence && vence < ref) { problemas.push(def.nombre + ' vence el ' + Festivos.corta(vence) + ', antes de terminar el trabajo'); return; }
      if (vence && vence <= pronto) avisos.push(def.nombre + ' vence el ' + Festivos.corta(vence));
      // Las restricciones (dato de salud) solo se ven en la ficha de la persona. v148: en alto riesgo no pasa sin SST.
      if (def.apto && /restricci/i.test(r.apto || '')) { if (alto) problemas.push('Apto con restricciones: SST debe confirmar que puede hacer este trabajo'); else avisos.push('Apto con restricciones (ver su ficha)'); }
    });
    return { estado: problemas.length ? 'mal' : (avisos.length ? 'pronto' : 'ok'), problemas, avisos, trabajador: t };
  },
  /** v148: LA regla para guardar personas en cualquier formulario (permisos, ATS, registro diario):
   *  no habilitado → solo Administrador o SST con justificación escrita; sin lista → se pregunta y se anota.
   *  filas: [{cc|cedula, nombre}]. Devuelve null si se cancela, o la lista de excepciones/avisos para anotar. */
  async exigir(filas, contexto, op) {
    op = op || {};
    if (typeof SGSST === 'undefined' || !SGSST.url()) return [];
    try { await this.cargar(); } catch (e) {}
    const con = (filas || []).map((f) => ({ cedula: String(f.cc || f.cedula || '').trim(), nombre: f.nombre || '' })).filter((f) => f.cedula);
    if (!con.length) return [];
    if (!this._mapa || !Object.keys(this._mapa).length) {
      const si = await Dialogo.confirmar('No se pudo verificar si estas personas están habilitadas (no hay lista del personal en este celular: sin señal o recién se cerró la sesión).\n\n¿Continuar de todas formas? Quedará anotado.');
      return si ? con.map((f) => Object.assign({ en: new Date().toISOString(), problemas: ['No se pudo verificar la habilitación'] }, f)) : null;
    }
    const malos = [], sinReg = [];
    con.forEach((f) => { const r = this.revisar(f.cedula, contexto, op.hasta), x = Object.assign({}, f, { nombre: f.nombre || (r.trabajador && r.trabajador.nombre) || '', problemas: r.problemas }); if (r.estado === 'mal') malos.push(x); else if (r.estado === 'sin-registro') sinReg.push(x); });
    let excepciones = [];
    if (malos.length) {
      const txt = malos.slice(0, 8).map((p) => '• ' + (p.nombre || 'C.C. ' + p.cedula) + ': ' + p.problemas.join('; ')).join('\n');
      const rol = typeof Sesion !== 'undefined' && Sesion.rol ? Sesion.rol() : '';
      if (rol !== 'admin' && rol !== 'sst') { await Dialogo.avisar((op.que || 'No se puede guardar') + ': no están habilitadas para este trabajo.\n\n' + txt + '\n\nQuítalas o pide al área SST que actualice su curso o concepto (o que autorice una excepción).'); return null; }
      const j = await Dialogo.pedir('Estas personas no están habilitadas:\n\n' + txt + '\n\nComo ' + (rol === 'admin' ? 'administrador' : 'SST') + ' puedes hacer una excepción. Escribe la justificación (queda en el registro):', '');
      if (!j || j.trim().length < 10) return null;
      excepciones = malos.map((p) => Object.assign({ en: new Date().toISOString(), excepcion: j.trim(), autorizo: Sesion.nombre ? Sesion.nombre() : '' }, p));
    }
    const r2 = await this.confirmar(sinReg);
    if (r2 === null) return null;
    return excepciones.concat(r2);
  },
  _pintar(input, contexto) {
    const r = this.revisar(input.value, typeof contexto === 'function' ? contexto() : contexto);
    const cont = input.closest('.exec-fields, .grid2, .field, .fila-campos') || input;
    let el = cont.nextElementSibling && cont.nextElementSibling.classList && cont.nextElementSibling.classList.contains('hab-aviso') ? cont.nextElementSibling : null;
    if (r.estado === 'sin-datos') { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'hab-aviso'; cont.insertAdjacentElement('afterend', el); }
    el.dataset.estado = r.estado;
    el.textContent = r.estado === 'ok' ? '✓ Habilitado' : r.estado === 'pronto' ? '⏳ ' + r.avisos.join(' · ') : '⚠ ' + r.problemas.concat(r.avisos).join(' · ');
  },
  /** Pone el aviso debajo de cada campo de cédula que coincida (también los que se llenan solos). */
  vigilar(raiz, selector, contexto) {
    if (!SGSST.url()) return;
    const vistos = new WeakMap();
    const revisarTodo = () => {
      (raiz || document).querySelectorAll(selector).forEach((inp) => {
        const v = inp.value + '|' + (this._mapa ? 1 : 0) + '|' + JSON.stringify(typeof contexto === 'function' ? contexto() : contexto);
        if (vistos.get(inp) === v) return;
        vistos.set(inp, v);
        this._pintar(inp, contexto);
      });
    };
    this.cargar().then(revisarTodo).catch(() => {});
    setInterval(revisarTodo, 1200);
  },
  /** Para guardar: lista de personas con problemas en esa zona. */
  problemasEn(raiz, selector, contexto, nombreDe) {
    const out = [];
    (raiz || document).querySelectorAll(selector).forEach((inp) => {
      if (!inp.value.trim()) return;
      const r = this.revisar(inp.value, typeof contexto === 'function' ? contexto() : contexto);
      if (r.estado === 'mal' || r.estado === 'sin-registro') out.push({ cedula: inp.value.trim(), nombre: (nombreDe && nombreDe(inp)) || (r.trabajador && r.trabajador.nombre) || '', problemas: r.problemas });
    });
    return out;
  },
  /** Pide confirmar si hay personas no habilitadas. Devuelve null si se cancela, o la lista (para dejarla anotada). */
  async confirmar(lista, anotar) {
    if (!lista.length) return [];
    const txt = 'Estas personas NO están habilitadas según Personal habilitado:\n\n' +
      lista.slice(0, 8).map((p) => '• ' + (p.nombre || 'C.C. ' + p.cedula) + ': ' + p.problemas.join('; ')).join('\n') + (lista.length > 8 ? '\n…y ' + (lista.length - 8) + ' más' : '') +
      '\n\n¿Guardar de todas formas?' + (anotar === false ? '' : ' Quedará anotado en el registro.');
    if (!await Dialogo.confirmar(txt)) return null;
    return lista.map((p) => Object.assign({ en: new Date().toISOString() }, p));
  }
};

/* ================= SISTEMA DE GESTIÓN POR ROL (v106) =================
   Lo de campo (permisos, ATS, charlas, preoperacionales, reportar) lo abre
   cualquiera. Los módulos del sistema de gestión, cuando el servidor usa
   usuarios, piden entrar y muestran solo lo que el rol permite (la tabla está
   en empresa.js: Empresa.accesoRol). Los datos sensibles los sigue cuidando
   el servidor (salud solo para Administrador y SST, quejas cifradas). */
const AccesoRol = {
  ROLES: { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' },
  modulo() {
    if (typeof Empresa === 'undefined' || !Empresa.moduloDeHref) return null;
    return Empresa.moduloDeHref(location.pathname.split('/').pop() || 'index.html');
  },
  /** null = puede entrar; 'entrar' = falta su usuario; 'rol' = su rol no tiene acceso. */
  revisar() {
    const m = this.modulo();
    if (!m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || !Sesion.modo()) return null;
    // v148: el participante que llega con el enlace de firma de un ATS no necesita usuario (solo se agrega a ese ATS).
    if (/ats\.html$/.test(location.pathname) && /[?&]agregar=1/.test(location.search) && /[?&]k=[\w-]{10,}/.test(location.search)) return null;
    const yo = Sesion.yo();
    if (!yo) return 'entrar';
    return Empresa.accesoRol(m, yo.rol) ? null : 'rol';
  },
  vigilar() {
    const r = this.revisar();
    if (!r) { this._preguntar(); return; }
    if (document.getElementById('accesoRol')) return;
    const yo = Sesion.yo(), d = document.createElement('div');
    d.id = 'accesoRol'; d.className = 'acceso-rol';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'arTit');
    d.innerHTML = '<div class="ar-caja"><span class="ar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<div class="ar-sup">Sistema de gestión</div>' +
      (r === 'entrar'
        ? '<h2 id="arTit">Entra con tu usuario</h2><p>Esta parte del portal pide usuario y contraseña. Sin usuario solo se hacen los <b>preoperacionales</b> y los <b>reportes</b>.</p>' +
          '<button type="button" id="arEntrar" class="ar-si">Entrar</button>'
        : '<h2 id="arTit">Tu usuario no tiene acceso aquí</h2><p>Entraste como <b>' + esc(yo.nombre) + '</b> (' + esc(this.ROLES[yo.rol] || yo.rol) + '). Si necesitas este módulo, pídeselo al administrador del portal.</p>') +
      '<a href="index.html" class="ar-no">Volver al inicio</a></div>';
    // v143: lo de atrás queda inerte (ni el teclado ni el lector de pantalla llegan a él) y el foco va a la ventana
    const inertes = [...document.body.children].filter((x) => x !== d && !x.inert && !/^(SCRIPT|STYLE)$/.test(x.tagName));
    inertes.forEach((x) => { x.inert = true; });
    document.body.appendChild(d);
    const b = document.getElementById('arEntrar');
    if (b) b.addEventListener('click', () => Sesion.pedir('Entra con tu usuario para abrir este módulo del sistema de gestión.'));
    setTimeout(() => { try { (b || d.querySelector('a')).focus(); } catch (e) {} }, 50);
    // Al entrar con un rol que sí lo ve, se quita el aviso sin recargar.
    if (!this._esperando) { this._esperando = true; const t = setInterval(() => { if (!this.revisar()) { clearInterval(t); this._esperando = false; const x = document.getElementById('accesoRol'); if (x) { x.remove(); inertes.forEach((y) => { y.inert = false; }); } } }, 800); }
  },
  /** v111: en un celular que nunca habló con el servidor no se sabe si hay usuarios.
   *  Si la página es del sistema de gestión, se pregunta (sin clave ni sesión) y se vuelve a revisar. */
  _preguntar() {
    const m = this.modulo();
    if (this._pregunto || !m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || Sesion.modo() || Sesion.yo()) return;
    if (typeof SGSST === 'undefined' || !SGSST.url() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    this._pregunto = true;
    fetchWithRetry(SGSST.url() + '?action=ping&token=' + encodeURIComponent(SGSST.token())).then((res) => res.json()).then((j) => {
      if (j && j.ok) { Sesion.marcar(j); this.vigilar(); }
    }).catch(() => {});
  }
};
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AccesoRol.vigilar()); else AccesoRol.vigilar();
}

/* v151 · Guardar más rápido: el servidor de Google «se duerme» y la primera petición tarda 2–5 s en
   despertarlo. Apenas la persona empieza a llenar un formulario se le manda un ping, así cuando pulsa
   «Guardar» el servidor ya está despierto. Máximo un ping cada 4 minutos por equipo. */
if (typeof document !== 'undefined') {
  const despertar = () => {
    try {
      if (typeof SGSST === 'undefined' || !SGSST.url() || navigator.onLine === false) return;
      const k = 'ssta-despierto', ahora = Date.now(), ult = Number(sessionStorage.getItem(k) || 0);
      if (ahora - ult < 240000) return;
      sessionStorage.setItem(k, String(ahora));
      fetch(SGSST.url() + '?action=ping&token=' + encodeURIComponent(SGSST.token())).catch(() => {});
    } catch (e) {}
  };
  document.addEventListener('input', despertar, { passive: true });
  document.addEventListener('pointerdown', (ev) => { if (ev.target && ev.target.closest && ev.target.closest('canvas, .pad, [data-c], .chips button')) despertar(); }, { passive: true });
}

/* ================= SUBIR ARRIBA (v107) =================
   En las páginas largas (plan anual, matriz, PESV…) aparece abajo a la
   izquierda un botón para volver al inicio de la página de un toque. */
(function () {
  if (typeof document === 'undefined') return;
  const montar = () => {
    if (document.getElementById('subirArriba')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'subirArriba'; b.className = 'subir-arriba'; b.hidden = true;
    b.setAttribute('aria-label', 'Subir al inicio de la página'); b.title = 'Subir';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5l-7 7m7-7l7 7M12 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } });
    document.body.appendChild(b);
    const barra = document.querySelector('.footer-actions');
    if (barra && getComputedStyle(barra).position === 'fixed') b.classList.add('con-barra');
    // v109: solo aparece cuando la persona SUBE la página con el dedo (intención de volver
    // arriba) y se esconde al bajar, a los 2,5 s sin moverse o al tocar un campo. Así no
    // queda encima de las opciones (Sí / No / N.A.) ni se toca sin querer al marcar algo.
    let t = 0, yAnt = window.scrollY || 0, subida = 0, esconder = 0;
    const ocultar = () => { b.hidden = true; subida = 0; };
    const ver = () => {
      t = 0; const y = window.scrollY || document.documentElement.scrollTop, dy = y - yAnt; yAnt = y;
      if (y < 900 || dy > 0) { subida = 0; b.hidden = true; return; }
      subida += -dy; if (subida > 160) b.hidden = false;
      clearTimeout(esconder); esconder = setTimeout(ocultar, 2500);
    };
    window.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(ver); }, { passive: true });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#subirArriba')) ocultar(); }, { passive: true, capture: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();


/* ================= ICONOS Y SEÑALES (v112) =================
   Iconos de línea (en lugar de emojis) y señales ISO 7010 para cada tipo de
   permiso, el ATS y lo demás de la obra. Iconos.senal('alturas') devuelve el HTML. */
const Iconos = (function () {
  const P = {
    llama: 'M12 3c.8 3 4.2 4.6 4.2 8.3a4.2 4.2 0 0 1-8.4 0c0-1.6.6-2.7 1.6-3.7.2 1.2.9 1.8 1.6 1.9C11 8 11.6 5.6 12 3z',
    escalera: 'M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8',
    tanque: 'M6 6c0-1.7 2.7-3 6-3s6 1.3 6 3v12c0 1.7-2.7 3-6 3s-6-1.3-6-3zM6 6c0 1.7 2.7 3 6 3s6-1.3 6-3M10 13h4',
    grua: 'M4 21h16M7 21V7M7 7h12M19 7v6M17 13h4M7 11l5-4',
    rayo: 'M13 3L5 13h6l-1 8 8-10h-6z',
    brujula: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    escudo: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
    personas: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 5.2a3.5 3.5 0 0 1 0 6.6',
    mas: 'M12 5v14M5 12h14',
    repetir: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
    candado: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    cerrar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 4.5-5',
    lista: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    carpeta: 'M3 6h6l2 2h10v11H3z',
    reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    alerta: 'M12 4l9 16H3zM12 10v4M12 17.3v.01',
    flecha: 'M9 6l6 6-6 6'
  };
  // Tipo → [icono, forma ISO]. tri = advertencia, circ = obligación, cuad = seguridad.
  const TIPO = { caliente: ['llama', 'tri'], alturas: ['escalera', 'circ'], confinados: ['tanque', 'tri'], izajes: ['grua', 'tri'], electrico: ['rayo', 'tri'],
    ats: ['brujula', 'cuad'], epp: ['escudo', 'circ'], personal: ['personas', 'violeta'], asistencia: ['personas', 'circ'],
    cerrar: ['cerrar', 'cuad'], agregar: ['personas', 'violeta'], tablero: ['lista', 'circ'], repetir: ['repetir', 'naranja'] };
  const svg = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || P.alerta) + '"/></svg>';
  /** Clave del tipo a partir de un nombre o archivo: 'Trabajo en Alturas', 'permiso-trabajo-alturas.html'… */
  function tipoDe(x) {
    const s = String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/calient/.test(s)) return 'caliente'; if (/altur/.test(s)) return 'alturas'; if (/confin/.test(s)) return 'confinados';
    if (/izaj/.test(s)) return 'izajes'; if (/electr/.test(s)) return 'electrico'; if (/\bats\b|ats\.html|analisis de trabajo/.test(s)) return 'ats';
    if (/epp/.test(s)) return 'epp'; if (/personal/.test(s)) return 'personal'; if (/asist|charla/.test(s)) return 'asistencia';
    return '';
  }
  function senal(tipo, tam) {
    const t = TIPO[tipoDe(tipo) || tipo] || ['alerta', 'tri'];
    return '<span class="sg-iso ' + t[1] + (tam ? ' ' + tam : '') + '" aria-hidden="true">' + svg(t[0]) + '</span>';
  }
  // Las pantallas marcan dónde va una señal con data-senal="alturas" (antes había un emoji).
  function pintar(raiz) { (raiz || document).querySelectorAll('[data-senal]:empty').forEach((el) => { el.innerHTML = senal(el.dataset.senal, 'grande'); }); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pintar()); else pintar(); }
  return { svg, senal, tipoDe, pintar, P };
})();


/* ================= BARRA INFERIOR (v112) =================
   Barra flotante de vidrio con Inicio · Permisos · Gestión · Ayuda, para quien
   entró con su usuario (sin usuario solo hay preoperacional y reportes: no la
   necesita). No sale en las pantallas que ya tienen abajo su propia barra
   (Guardar, Enviar…), para no tapar nada, ni al imprimir. */
const BarraInferior = (function () {
  if (typeof document === 'undefined') return null;
  if (Consola.activa()) return null;   // v115: la consola del administrador no lleva la barra de los clientes
  const ITEMS = [
    { id: 'inicio', href: 'index.html', txt: 'Inicio', d: 'M4 11l8-7 8 7M6 10v10h12V10' },
    { id: 'permisos', href: 'dashboard.html', txt: 'Permisos', d: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4' },
    { id: 'gestion', href: 'index.html#sg', txt: 'Gestión', d: 'M5 20V10M12 20V4M19 20v-7' },
    { id: 'ayuda', href: 'ayuda.html', txt: 'Ayuda', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17v.01' }
  ];
  const pagina = () => (location.pathname.split('/').pop() || 'index.html');
  function activo() {
    const p = pagina();
    if (p === 'dashboard.html' || /^permiso-/.test(p)) return 'permisos';
    if (p === 'ayuda.html') return 'ayuda';
    if (p === 'index.html') return location.hash === '#sg' ? 'gestion' : 'inicio';
    return 'gestion';
  }
  function hayOtraBarra(nav) {
    // Algo fijo abajo (barra de guardar, cola de pendientes, aviso…) que la barra taparía.
    const vistos = document.querySelectorAll('.footer-actions, .barra-guardar, #pendingNav.show, .fixed-bottom, .acciones-fijas, [data-barra-abajo]');
    for (const el of vistos) { if (el === nav || nav.contains(el)) continue; const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && el.getBoundingClientRect().height > 20 && el.getBoundingClientRect().top < innerHeight) return true; }
    return false;
  }
  let nav = null;
  function montar() {
    if (nav || document.getElementById('barraInferior')) return;
    const yo = typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo();
    if (!yo || !document.body || document.body.dataset.sinBarra !== undefined) return;
    nav = document.createElement('nav');
    nav.id = 'barraInferior'; nav.className = 'barra-inferior'; nav.setAttribute('aria-label', 'Navegación principal');
    const a = activo();
    // v123: sin permisos de trabajo contratados, la barra no los muestra.
    const hayPermisos = typeof Empresa === 'undefined' || !Empresa.moduloActivo || ['caliente', 'alturas', 'confinados', 'izajes', 'electrico'].some((m) => Empresa.moduloActivo(m));
    nav.innerHTML = ITEMS.filter((x) => x.id !== 'permisos' || hayPermisos).map((x) => '<a href="' + x.href + '" data-id="' + x.id + '" aria-label="' + x.txt + '"' + (x.id === a ? ' class="on" aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + x.d + '"/></svg><span>' + x.txt + '</span></a>').join('');
    document.body.appendChild(nav);
    // En el inicio, «Gestión» lleva al sistema de gestión sin recargar.
    nav.querySelector('[data-id="gestion"]').addEventListener('click', (e) => {
      const sg = pagina() === 'index.html' && document.getElementById('sg');
      if (sg) { e.preventDefault(); if (location.hash !== '#sg') location.hash = 'sg'; marcar('gestion'); }   // v117: el inicio cambia a la vista del sistema de gestión
    });
    nav.querySelector('[data-id="inicio"]').addEventListener('click', (e) => {
      if (pagina() === 'index.html') { e.preventDefault(); history.replaceState(null, '', location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }); marcar('inicio'); }
    });
    const revisar = () => { const otra = hayOtraBarra(nav); nav.hidden = otra; document.body.classList.toggle('con-barra-inferior', !otra); };
    revisar(); setInterval(revisar, 1200);
  }
  function marcar(id) { if (!nav) return; nav.querySelectorAll('a').forEach((x) => { const on = x.dataset.id === id; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else setTimeout(montar, 0);
  return { montar, marcar };
})();

/* v156 · El botón «← Atrás» de cada módulo (enlace a index.html) vuelve a donde estabas: si llegaste desde el
   portal, regresa a esa misma página (Gestión, con la categoría abierta y en el mismo punto); si entraste
   directo (enlace, QR, acceso del celular), va a Gestión cuando hay sesión o al inicio cuando no. */
if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.back[href="index.html"], a.back[href="./index.html"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  let deIndex = false;
  try { const r = document.referrer ? new URL(document.referrer) : null; deIndex = !!r && r.origin === location.origin && /\/(index\.html)?$/.test(r.pathname); } catch (x) {}
  // Pantallas internas: volver primero a la primera vista del módulo.
  const act = document.querySelector('.screen.active'), ini = document.querySelector('.screen');
  if (act && ini && act !== ini) { const v = act.querySelector('[data-volver]'); if (v && v !== a) { v.click(); return; } }
  if (deIndex && history.length > 1) { history.back(); return; }
  let conSesion = false; try { conSesion = typeof Sesion !== 'undefined' && !!Sesion.yo(); } catch (x) {}
  location.href = 'index.html' + (conSesion ? '#sg' : '');
}, true);

/* ================= «ATRÁS» VUELVE A DONDE ESTABAS (v123) =================
   Muchas pantallas tienen varias vistas dentro de la misma página (lista → formulario
   → detalle) y ventanas. El botón «atrás» del celular sacaba de la página y llevaba al
   inicio. Ahora cada vista y cada ventana deja su paso en el historial: «atrás» cierra
   la ventana o vuelve a la vista anterior, y solo al final sale de la página. */
const NavAtras = (function () {
  if (typeof window === 'undefined' || typeof history === 'undefined' || typeof document === 'undefined') return null;
  let ignorar = 0, modalesEmpujados = 0;
  const activa = () => document.querySelector('.screen.active');
  const primera = () => document.querySelector('.screen');
  const firmaAbierta = () => { try { return typeof FirmaCompleta !== 'undefined' && FirmaCompleta.estaAbierta(); } catch (e) { return false; } };
  function atrasSilencioso() { ignorar++; history.back(); }
  function alCambiarPantalla() {
    const a = activa(), ini = primera(); if (!a || !ini) return;
    const st = history.state || {};
    if (a === ini) { if (st.__p) atrasSilencioso(); return; }   // volvió con su propio botón: se quita el paso que sobraba
    if (st.__p !== a.id) history.pushState({ __p: a.id }, '');
  }
  function iniciar() {
    const pantallas = document.querySelectorAll('.screen');
    if (pantallas.length > 1) {
      const obs = new MutationObserver(() => setTimeout(alCambiarPantalla, 0));
      pantallas.forEach((s) => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    }
    // Ventanas (UI.modal): «atrás» las cierra.
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo')) {
        modalesEmpujados++;
        // Una ventana que reemplaza a otra recién cerrada reutiliza su paso (no se apilan).
        if (history.state && history.state.__m && document.querySelectorAll('body > .modal-fondo').length === 1) history.replaceState(Object.assign({}, history.state, { __m: modalesEmpujados }), '');
        else history.pushState(Object.assign({}, history.state || {}, { __m: modalesEmpujados }), '');
      } });
      m.removedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo') && n.__porAtras !== true) setTimeout(() => {
        if (!document.querySelector('body > .modal-fondo') && history.state && history.state.__m) atrasSilencioso();
      }, 60); });
    })).observe(document.body, { childList: true });
  }
  window.addEventListener('popstate', (e) => {
    if (ignorar) { ignorar--; return; }
    if (firmaAbierta()) return;
    const fondos = document.querySelectorAll('body > .modal-fondo');
    if (fondos.length) { const f = fondos[fondos.length - 1]; f.__porAtras = true; const c = f.querySelector('[data-cerrar]'); if (c) c.click(); else f.remove(); return; }
    const a = activa(), ini = primera(); if (!a || !ini || a === ini) return;
    const st = e.state || {};
    if (st.__p === a.id) return;
    const destino = st.__p && document.getElementById(st.__p);
    if (destino && destino.classList.contains('screen')) { a.classList.remove('active'); destino.classList.add('active'); window.scrollTo(0, 0); return; }
    // A la primera vista: con su botón «volver» (recarga la lista) o, si no tiene, directo.
    const v = a.querySelector('[data-volver]');
    if (v) v.click(); else { a.classList.remove('active'); ini.classList.add('active'); window.scrollTo(0, 0); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { activa };
})();

/* ============================================================
   v130 · Accesible — accesibilidad y estados de carga en todo el portal
   ------------------------------------------------------------
   · Foco visible con teclado (anillo de color) en todo lo que se toca.
   · Todo botón o enlace sin texto (solo ícono) recibe un nombre accesible
     (de su title, su imagen o su ícono), para lectores de pantalla.
   · Los mensajes (toasts, «status-msg») se anuncian solos (aria-live).
   · Las ventanas son diálogos de verdad: role="dialog", foco adentro, Escape cierra.
   · «Cargando…» se reemplaza por un esqueleto de la lista (la pantalla no salta).
   · Quien pide menos movimiento en su teléfono, no ve animaciones.
   ============================================================ */
/* v137 · Modo sol: se recuerda en el celular y se aplica en todas las páginas. */
const ModoSol = (function () {
  const K = 'ssta-modo-sol';
  const leer = () => { try { return localStorage.getItem(K) === '1'; } catch (e) { return false; } };
  const aplicar = (on) => { if (typeof document !== 'undefined') document.documentElement.classList.toggle('modo-sol', !!on); };
  aplicar(leer());
  function alternar() { const on = !leer(); try { localStorage.setItem(K, on ? '1' : '0'); } catch (e) {} aplicar(on); return on; }
  return { activo: leer, alternar };
})();
/* v137 · Dictado por voz: el trabajador habla y el texto se escribe solo (más detalle, menos «todo bien»).
   Usa el reconocimiento de voz del navegador del celular (Chrome en Android, Safari en iPhone). */
const MIC_SVG = '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const Dictado = (function () {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  let rec = null, activo = null, boton = null;
  function parar() { try { if (rec) rec.stop(); } catch (e) {} }
  function fin() { if (boton) { boton.innerHTML = MIC_SVG + 'Dictar'; boton.classList.remove('oyendo'); } activo = null; boton = null; rec = null; }
  function alternar(campo, b) {
    if (activo === campo) { parar(); return; }
    parar();
    try {
      rec = new SR(); rec.lang = 'es-CO'; rec.interimResults = false; rec.continuous = true; rec.maxAlternatives = 1;
      activo = campo; boton = b; b.innerHTML = MIC_SVG + 'Escuchando… toca para parar'; b.classList.add('oyendo');
      rec.onresult = (e) => {
        let txt = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) txt += e.results[i][0].transcript;
        txt = txt.trim(); if (!txt) return;
        const v = campo.value; campo.value = v + (v && !/\s$/.test(v) ? ' ' : '') + txt.charAt(0).toUpperCase() + txt.slice(1);
        campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
      };
      rec.onerror = (e) => { if (e && e.error === 'not-allowed' && typeof UI !== 'undefined' && UI.toast) UI.toast('Para dictar, permite el micrófono en el navegador.', 'mal'); };
      rec.onend = fin;
      rec.start();
    } catch (e) { fin(); }
  }
  return { disponible: !!SR, alternar };
})();
/* ================= v140 · ACCESIBILIDAD =================
   · Letra: A− A A+ (se recuerda en el celular y aplica en todas las páginas).
   · Leer: botón «Escuchar» arriba en cada página; el celular lee en voz alta lo que
     se ve (o la ventana abierta), sin internet ni app aparte.
   · FirmaAlterna: para quien no puede trazar la firma (visión, lesión en la mano):
     firma con nombre y cédula; queda como imagen con la marca «sin trazo» y el
     servidor la sella igual que cualquier firma (hora, equipo, código). */
const Letra = (function () {
  const K = 'ssta-letra', NIV = ['', 'letra-1', 'letra-2'];
  const leer = () => { try { const n = Number(localStorage.getItem(K) || 0); return n >= 0 && n <= 2 ? n : 0; } catch (e) { return 0; } };
  const aplicar = (n) => { if (typeof document === 'undefined') return; NIV.forEach((c) => c && document.documentElement.classList.remove(c)); if (NIV[n]) document.documentElement.classList.add(NIV[n]); };
  aplicar(leer());
  function poner(n) { n = Math.max(0, Math.min(2, n)); try { localStorage.setItem(K, String(n)); } catch (e) {} aplicar(n); return n; }
  return { nivel: leer, poner, mas: () => poner(leer() + 1), menos: () => poner(leer() - 1) };
})();
const Leer = (function () {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  let boton = null, hablando = false;
  const SVG = '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  function textoDe(raiz) {
    const partes = [];
    const recorrer = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) partes.push(t); return; }
      if (n.nodeType !== 1) return;
      const el = n; if (el.hidden || el.getAttribute('aria-hidden') === 'true' || /^(SCRIPT|STYLE|SVG|svg|TEMPLATE|NOSCRIPT|DATALIST|OPTION)$/.test(el.tagName)) return;
      if (el.matches('.btn-leer,.btn-mic,.btn-firma-alt,.saltar-contenido,.barra-inferior,#sstaTrampa')) return;
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
      if (el.matches('input,textarea,select')) { const t = (el.type || '').toLowerCase(); if (/hidden|password|file|button|submit/.test(t)) return;
        const v = t === 'checkbox' || t === 'radio' ? (el.checked ? 'marcado' : 'sin marcar') : (el.tagName === 'SELECT' ? ((el.selectedOptions[0] || {}).textContent || '') : el.value);
        partes.push(v ? '(' + v + ')' : '(vacío)'); return; }
      if (el.tagName === 'CANVAS') { partes.push(el._pad && el._pad.hasInk && el._pad.hasInk() ? '(firmado)' : '(sin firmar)'); return; }
      el.childNodes.forEach(recorrer);
      if (/^(P|DIV|LI|H1|H2|H3|H4|TR|LABEL|BUTTON|SECTION)$/.test(el.tagName)) partes.push('.');
    };
    recorrer(raiz);
    return partes.join(' ').replace(/(\s*\.\s*)+/g, '. ').replace(/\s+([,.;:])/g, '$1').trim();
  }
  function zona() {
    const ms = document.querySelectorAll('.modal-fondo .modal, .dlg-fondo .dlg'); if (ms.length) return ms[ms.length - 1];
    return document.querySelector('.screen.active') || document.querySelector('main, [role="main"]') || document.body;
  }
  function parar() { try { speechSynthesis.cancel(); } catch (e) {} hablando = false; if (boton) { boton.innerHTML = SVG + '<span>Escuchar</span>'; boton.setAttribute('aria-pressed', 'false'); } }
  function leer(texto, b) {
    if (!ok) return false;
    parar(); if (b) boton = b;
    const trozos = String(texto || '').match(/[^.!?]{1,220}[.!?]?/g) || [];
    if (!trozos.length) return false;
    hablando = true; if (boton) { boton.innerHTML = SVG + '<span>Parar</span>'; boton.setAttribute('aria-pressed', 'true'); }
    const voces = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang)), voz = voces.find((v) => /CO|419|MX|US/i.test(v.lang)) || voces[0];
    trozos.forEach((t, i) => { const u = new SpeechSynthesisUtterance(t.trim()); u.lang = voz ? voz.lang : 'es-CO'; if (voz) u.voice = voz; u.rate = 0.95; if (i === trozos.length - 1) u.onend = () => parar(); speechSynthesis.speak(u); });
    return true;
  }
  function alternar(b) { if (hablando) { parar(); return; } leer(textoDe(zona()), b); }
  function montar() {
    if (!ok || document.querySelector('.btn-leer[data-global]') || document.documentElement.hasAttribute('data-sin-leer')) return;
    const h = document.querySelector('.hdr'); if (!h) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-leer'; b.dataset.global = '1'; b.setAttribute('aria-pressed', 'false');
    b.title = 'El celular lee en voz alta lo que hay en la pantalla'; b.innerHTML = SVG + '<span>Escuchar</span>';
    b.addEventListener('click', () => alternar(b));
    const t = h.querySelector('h1'); (t && t.parentElement ? t.parentElement : h).appendChild(b);
    window.addEventListener('pagehide', parar);
  }
  return { disponible: ok, leer, parar, alternar, textoDe, montar };
})();
/* v159 · Mi firma: quien entra con su usuario guarda su firma UNA vez en su equipo y la pone con un toque
   (con confirmación). No viaja a ningún lado hasta que se usa en un registro; al cerrar sesión se puede borrar. */
const MiFirma = (function () {
  const yo = () => (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || null;
  const clave = () => { const y = yo(); return y ? 'ssta-mi-firma-' + String(y.usuario || y.nombre || '').toLowerCase() : ''; };
  const leer = () => { try { return clave() ? localStorage.getItem(clave()) || '' : ''; } catch (e) { return ''; } };
  const disponible = () => !!yo();
  function boton(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt btn-mi-firma';
    const pinta = () => { b.textContent = leer() ? '✍ Poner mi firma' : '✍ Guardar como mi firma'; };
    pinta();
    b.addEventListener('click', async () => {
      const pad = c._pad; if (!pad) return; const guardada = leer();
      if (!guardada) {
        const u = pad.getDataUrl && pad.getDataUrl();
        if (!u) { await Dialogo.avisar('Firma una vez en el recuadro y vuelve a tocar «Guardar como mi firma». Desde ahí la pones con un toque en cualquier formulario de este equipo.'); return; }
        if (!await Dialogo.confirmar('¿Guardar esta firma como la de ' + yo().nombre + ' en este equipo? Solo se usa cuando tú la pongas.')) return;
        try { localStorage.setItem(clave(), u); } catch (e) {} pinta(); if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ Firma guardada en este equipo'); return;
      }
      if (!await Dialogo.confirmar('¿Firmar como ' + yo().nombre + '?')) return;
      pad.setDataUrl(guardada); c.dataset.miFirma = '1';
      c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return b;
  }
  function borrar() { try { localStorage.removeItem(clave()); } catch (e) {} }
  return { disponible, leer, boton, borrar };
})();
const FirmaAlterna = (function () {
  const mapa = new Map();
  function imagen(nombre, cedula) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 170; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#10213a'; x.lineWidth = 2; x.strokeRect(4, 4, c.width - 8, c.height - 8);
    x.fillStyle = '#10213a'; x.font = 'bold 34px Arial, sans-serif'; x.fillText(nombre.slice(0, 34), 20, 60);
    x.font = '24px Arial, sans-serif'; x.fillText('C.C. ' + cedula, 20, 100);
    const d = new Date(); x.font = '18px Arial, sans-serif'; x.fillStyle = '#333';
    x.fillText('Firma sin trazo (nombre y cédula) · ' + d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), 20, 142);
    return c.toDataURL('image/png');
  }
  async function pedir(canvas) {
    const pad = canvas && canvas._pad; if (!pad || typeof Dialogo === 'undefined') return false;
    const nombre = await Dialogo.pedir('Firmar sin dibujar.\nEscribe el nombre completo de quien firma (o díctalo):', ''); if (!nombre || nombre.trim().length < 5) return false;
    let ced = await Dialogo.pedir('Cédula de ' + nombre.trim() + ' (solo números):', ''); ced = String(ced || '').replace(/\D/g, '');
    if (ced.length < 5 || ced.length > 12) { if (ced) Dialogo.avisar('La cédula debe tener entre 5 y 12 números. No se firmó.'); return false; }
    const si = await Dialogo.confirmar('¿' + nombre.trim() + ', C.C. ' + ced + ', confirma que firma este documento?\nQueda con la hora del servidor, el equipo y un código de verificación, igual que una firma a mano.');
    if (!si) return false;
    pad.setDataUrl(imagen(nombre.trim(), ced)); canvas.dataset.firmaAlterna = ced; canvas.dataset.altNombre = nombre.trim().slice(0, 100);
    // v141: lo que exporte este recuadro queda anotado como «sin trazo» (viaja al sello del servidor).
    if (!pad._altEnvuelto) {
      pad._altEnvuelto = true;
      const g = pad.getDataUrl, cl = pad.clear;
      pad.getDataUrl = function () { const u = g.apply(this, arguments); if (u && canvas.dataset.firmaAlterna) mapa.set(u, { nombre: canvas.dataset.altNombre, cedula: canvas.dataset.firmaAlterna }); return u; };
      if (cl) pad.clear = function () { delete canvas.dataset.firmaAlterna; delete canvas.dataset.altNombre; return cl.apply(this, arguments); };
      canvas.addEventListener('pointerdown', () => { delete canvas.dataset.firmaAlterna; delete canvas.dataset.altNombre; });
    }
    canvas.dispatchEvent(new Event('input', { bubbles: true })); canvas.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof AutoGuardado !== 'undefined' && AutoGuardado.marcar) AutoGuardado.marcar(canvas);
    return true;
  }
  return { pedir, imagen, _mapa: mapa };
})();
/* v174 · Subir la firma: una foto o un escaneo de la firma de la persona (papel blanco, tinta oscura).
   Se limpia el fondo (lo claro queda blanco y el trazo en tinta) y se pone en el recuadro, como si la hubiera trazado. */
const SubirFirma = (function () {
  function limpiar(img) {
    const W = 640, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const k = Math.min((W - 20) / img.width, (H - 20) / img.height, 4), w = img.width * k, h = img.height * k;
    x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const d = x.getImageData(0, 0, W, H), p = d.data;
    let tinta = 0;
    for (let i = 0; i < p.length; i += 4) {
      const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      if (l > 170) { p[i] = p[i + 1] = p[i + 2] = 255; } else { p[i] = 16; p[i + 1] = 33; p[i + 2] = 58; tinta++; }
      p[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return tinta > 60 ? c.toDataURL('image/png') : '';
  }
  function leerArchivo(f) {
    return new Promise((ok, mal) => {
      const r = new FileReader(); r.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      r.onload = () => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('Ese archivo no es una imagen.')); im.src = r.result; };
      r.readAsDataURL(f);
    });
  }
  function boton(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt btn-subir-firma'; b.textContent = 'Subir firma (foto)';
    b.setAttribute('aria-label', 'Subir una foto o un escaneo de la firma');
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    b.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { Dialogo.avisar('La imagen pesa más de 8 MB. Toma la foto más de cerca o recórtala.'); return; }
      try {
        const u = limpiar(await leerArchivo(f));
        if (!u) { Dialogo.avisar('No se ve la firma en esa imagen. Usa una foto de la firma en papel blanco, con buena luz y de cerca.'); return; }
        const pad = c._pad; if (!pad) return;
        pad.setDataUrl(u); c.dataset.firmaSubida = '1';
        c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof AutoGuardado !== 'undefined' && AutoGuardado.marcar) AutoGuardado.marcar(c);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ Firma puesta. Revísala antes de guardar.');
      } catch (e) { Dialogo.avisar(e.message); }
    });
    const w = document.createElement('span'); w.className = 'subir-firma'; w.appendChild(b); w.appendChild(inp);
    return w;
  }
  return { boton, limpiar };
})();
const Accesible = (function () {
  if (typeof document === 'undefined') return {};
  const NOMBRE_ICONO = { ayuda: 'Ayuda', actividad: 'Estado', tablero: 'Gestión', cerrar: 'Cerrar', lupa: 'Buscar', engranaje: 'Configuración', candado: 'Clave', persona: 'Mi usuario',
    imprimir: 'Imprimir', lapiz: 'Editar', camara: 'Foto', 'flecha-arriba': 'Subir', calendario: 'Calendario', llave: 'Clave', chevron: 'Abrir', externo: 'Abrir en otra pestaña' };
  const css = document.createElement('style'); css.id = 'estiloAccesible';
  css.textContent =
    ':where(a,button,summary,select,textarea,input,[role="button"],[tabindex]):focus-visible{outline:3px solid var(--foco,var(--azul));outline-offset:2px;border-radius:var(--r-s,8px);}' +
    ':where(a,button,summary,[role="button"]):focus:not(:focus-visible){outline:none;}' +
    '.solo-lector{position:absolute !important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}' +
    /* Esqueleto de carga: barras grises que «respiran» con la forma de la lista que viene. */
    '.esq{display:flex;flex-direction:column;gap:10px;padding:2px 0;}' +
    '.esq-it{background:var(--paper,#fff);border:1px solid var(--line,var(--line));border-radius:var(--r-l,16px);padding:14px 16px;display:flex;flex-direction:column;gap:9px;}' +
    '.esq-b{height:12px;border-radius:var(--r-pill,999px);background:linear-gradient(90deg,var(--n-150) 0%,var(--n-50) 45%,var(--n-150) 90%);background-size:220% 100%;animation:esqBrillo 1.3s ease-in-out infinite;}' +
    '.esq-b.t{height:15px;width:58%;}.esq-b.m{width:86%;}.esq-b.c{width:40%;}' +
    '@keyframes esqBrillo{0%{background-position:120% 0}100%{background-position:-120% 0}}' +
    '.saltar-contenido{position:absolute;left:8px;top:-60px;z-index:100001;background:var(--tinta);color:#fff;padding:10px 16px;border-radius:var(--r-s,8px);font-weight:800;text-decoration:none;}.saltar-contenido:focus{top:8px;}' +
    '.btn-firma-alt{min-height:40px;padding:0 12px;border-radius:var(--r-pill,999px);border:1.5px solid var(--line);background:#fff;font:inherit;font-weight:700;font-size:var(--fs-menor,13px);cursor:pointer;margin:6px 6px 0 0;}' +
    '.chip.ok::before{content:"\\2713\\00a0";}.chip.mal::before{content:"\\2715\\00a0";}.chip.pronto::before{content:"!\\00a0";font-weight:900;}' +
    '@media (pointer:coarse){:where(.btn,button.btn,.btn-sec,.btn-mic,.ag-falta-item,.sig-actions button,.chips button,.seg-btn button,.tabs button,.back){min-height:44px;}:where(input[type=checkbox],input[type=radio]){min-width:22px;min-height:22px;}}' +
    '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important;}}';
  (document.head || document.documentElement).appendChild(css);

  const tieneNombre = (el) => !!((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby') || (el.textContent || '').trim() ||
    [...el.querySelectorAll('img[alt]')].some((i) => i.alt.trim()));
  function nombreDe(el) {
    if (el.title && el.title.trim()) return el.title.trim();
    const u = el.querySelector('use'); const h = u && (u.getAttribute('href') || u.getAttribute('xlink:href') || '');
    const k = (/#i-([a-z-]+)/.exec(h) || [])[1]; if (k && NOMBRE_ICONO[k]) return NOMBRE_ICONO[k];
    if (el.classList.contains('marca')) return 'Logo de la empresa';
    return '';
  }
  function esqueleto(n) {
    let h = '<div class="esq" aria-busy="true"><span class="solo-lector">Cargando…</span>';
    for (let i = 0; i < (n || 4); i++) h += '<div class="esq-it" aria-hidden="true"><span class="esq-b t"></span><span class="esq-b m"></span><span class="esq-b c"></span></div>';
    return h + '</div>';
  }
  const CARGANDO = /^\s*(Cargando|Abriendo)(…|\.\.\.)?\s*$/;
  function revisar(raiz) {
    // v143: «← Volver» que no navega (href="#") es un botón para el lector de pantalla
    try { (raiz.querySelectorAll ? raiz : document).querySelectorAll('a[href="#"][data-volver]:not([role])').forEach((a) => a.setAttribute('role', 'button')); } catch (e) {}
    const r = raiz && raiz.querySelectorAll ? raiz : document;
    // Botones y enlaces solo con ícono
    r.querySelectorAll('button, a[href], summary, [role="button"]').forEach((el) => {
      if (el.dataset.a11y) return; el.dataset.a11y = '1';
      el.querySelectorAll('svg:not([aria-hidden])').forEach((s) => { if (!s.getAttribute('aria-label') && !s.querySelector('title')) s.setAttribute('aria-hidden', 'true'); });
      if (!tieneNombre(el)) { const n = nombreDe(el); if (n) el.setAttribute('aria-label', n); }
    });
    // v132: campos con su etiqueta conectada (el lector la lee y tocar la etiqueta enfoca el campo)
    r.querySelectorAll('input:not([type=hidden]):not([data-a11y]), select:not([data-a11y]), textarea:not([data-a11y])').forEach((el) => {
      el.dataset.a11y = '1';
      if (el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      const caja = el.closest('.field, .campo, .fila-campo');
      const lb = caja && [...caja.querySelectorAll('label')].find((l) => !l.htmlFor && !l.querySelector('input,select,textarea') && (l.textContent || '').trim());
      if (lb && caja.querySelectorAll('input:not([type=hidden]),select,textarea').length === 1) {
        if (!el.id) el.id = 'cmp' + Math.random().toString(36).slice(2, 9);
        lb.htmlFor = el.id; return;
      }
      const ph = (el.getAttribute('placeholder') || '').trim();
      const op0 = el.tagName === 'SELECT' && el.options.length && el.options[0].value === '' ? (el.options[0].textContent || '').trim() : '';   // «Todos los orígenes»
      const celda = el.closest('[data-l]'), fila = el.closest('tr'), cab = fila && fila.querySelector('td,th');
      const deCelda = celda ? celda.getAttribute('data-l') + (cab && cab !== celda && (cab.textContent || '').trim() ? ' · ' + (cab.textContent || '').trim().slice(0, 40) : '') : '';
      const vecino = !lb && !ph && el.type === 'file' ? ((el.closest('label') || el.parentElement || {}).textContent || '').trim().slice(0, 60) || 'Elegir archivo' : '';
      const txt = lb ? (lb.textContent || '').trim() : (ph || op0 || (el.title || '').trim() || deCelda || vecino);
      if (txt) el.setAttribute('aria-label', txt.replace(/\s*\*\s*$/, ''));
    });
    // v140: el error queda ligado a su campo (el lector lo dice al entrar al campo)
    r.querySelectorAll('.error-txt, .v-msg, .field-error').forEach((m) => {
      const caja = m.closest('.field, .campo') || m.parentElement; if (!caja) return;
      const f = caja.querySelector('input:not([type=hidden]),select,textarea') || (m.previousElementSibling && m.previousElementSibling.matches('input,select,textarea') ? m.previousElementSibling : null);
      if (!f) return; if (!m.id) m.id = 'err' + Math.random().toString(36).slice(2, 8);
      const d = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean); if (d.indexOf(m.id) === -1) d.push(m.id);
      f.setAttribute('aria-describedby', d.join(' ')); f.setAttribute('aria-invalid', 'true');
    });
    document.querySelectorAll('[aria-invalid="true"]').forEach((f) => {
      const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), vivos = ids.filter((i) => { const m = document.getElementById(i); return m && (m.textContent || '').trim() && m.offsetParent !== null; });
      const marcado = f.classList.contains('field-invalid') || f.classList.contains('v-falta') || (f.closest('.field') && f.closest('.field').classList.contains('field-invalid'));
      if (!vivos.length && !marcado) f.removeAttribute('aria-invalid');
    });
    r.querySelectorAll('.field-invalid input:not([aria-invalid]), input.field-invalid:not([aria-invalid]), .v-falta:not([aria-invalid])').forEach((f) => f.setAttribute('aria-invalid', 'true'));
    // v140: «Firmar sin dibujar» junto a cada recuadro de firma
    r.querySelectorAll('canvas').forEach((c) => {
      // v143: el recuadro de firma tiene nombre y estado para el lector de pantalla
      if (c._pad && !c.dataset.completa && !c.hasAttribute('role')) {
        c.setAttribute('role', 'img');
        const caja = c.closest('.field, .sig-block, .firma, .card') || c.parentElement, lb = caja && caja.querySelector('label, .sig-label, h3, h2');
        const st = document.getElementById('status_' + c.id) || (caja && caja.querySelector('.sig-status'));
        if (lb) { if (!lb.id) lb.id = 'lb_' + c.id; }
        if (st) { if (!st.id) st.id = 'st_' + c.id; st.setAttribute('aria-live', 'polite'); }
        const ids = [lb && lb.id, st && st.id].filter(Boolean);
        if (ids.length) c.setAttribute('aria-labelledby', ids.join(' ')); else c.setAttribute('aria-label', 'Recuadro de firma');
      }
      if (c.dataset.altFirma || !c._pad || c.dataset.completa || c.closest('[data-sin-firma-alt]')) return;
      c.dataset.altFirma = '1';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt'; b.textContent = 'Firmar sin dibujar';
      b.setAttribute('aria-label', 'Firmar sin dibujar (con nombre y cédula), para quien no puede trazar la firma');
      b.addEventListener('click', () => FirmaAlterna.pedir(c));
      const acc = c.nextElementSibling && c.nextElementSibling.classList && c.nextElementSibling.classList.contains('sig-actions') ? c.nextElementSibling : null;
      if (acc) acc.appendChild(b); else c.insertAdjacentElement('afterend', b);
      if (typeof MiFirma !== 'undefined' && MiFirma.disponible()) { const m = MiFirma.boton(c); if (acc) acc.appendChild(m); else b.insertAdjacentElement('afterend', m); }
      { const sf = SubirFirma.boton(c); if (acc) acc.appendChild(sf); else b.insertAdjacentElement('afterend', sf); }   // v174
    });
    // Mensajes que se anuncian
    r.querySelectorAll('.status-msg:not([aria-live]), #msgNuevo:not([aria-live])').forEach((el) => el.setAttribute('aria-live', 'polite'));
    r.querySelectorAll('.toast:not([role])').forEach((el) => { el.setAttribute('role', el.classList.contains('mal') ? 'alert' : 'status'); });
    // «Cargando…» → esqueleto
    r.querySelectorAll('.empty').forEach((el) => { if (!el.dataset.esq && el.children.length === 0 && CARGANDO.test(el.textContent)) { el.dataset.esq = '1'; el.classList.remove('empty'); el.innerHTML = esqueleto(4); } });
    // v133: pantalla vacía que dice qué hacer: si hay un botón «+ …» visible en la misma pantalla, se ofrece ahí
    r.querySelectorAll('.empty:not([data-cta])').forEach((el) => {
      if (el.querySelector('button,a') || !/^\s*(Sin |No hay |Aún no |Todavía no )/.test(el.textContent)) return;
      el.dataset.cta = '1';
      const caja = el.closest('.screen, section, main, .card') || document.body;
      const b = [...caja.querySelectorAll('button, a.btn')].find((x) => /^\s*\+/.test(x.textContent) && x.offsetParent !== null && !x.disabled && !el.contains(x));
      if (!b) return;
      const c = document.createElement('button'); c.type = 'button'; c.className = 'btn btn-cta-vacio'; c.textContent = b.textContent.trim();
      c.style.cssText = 'display:block;margin:12px auto 0;'; c.addEventListener('click', () => b.click());
      el.appendChild(c);
    });
    // v137: dictado por voz al lado de cada campo de texto largo (si el celular lo permite)
    if (Dictado.disponible) r.querySelectorAll('textarea:not([data-mic]):not([readonly]):not([disabled])').forEach((t) => {
      if (t.closest('[data-sin-mic]') || t.offsetParent === null) return;
      t.dataset.mic = '1';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-mic'; { const lt = (t.id && document.querySelector('label[for="' + t.id + '"]')) || (t.closest('.field') && t.closest('.field').querySelector('label')); const nm = ((lt && lt.textContent) || t.getAttribute('aria-label') || t.placeholder || '').replace(/[*:]/g, '').trim().slice(0, 50); b.setAttribute('aria-label', nm ? 'Dictar: ' + nm : 'Dictar con la voz'); } b.innerHTML = MIC_SVG + 'Dictar';   // v143: se sabe a qué campo dicta (v145: el texto del botón había quedado comentado)
      b.addEventListener('click', () => Dictado.alternar(t, b));
      t.insertAdjacentElement('afterend', b);
    });
    // Ventanas como diálogos
    r.querySelectorAll('.modal-fondo > .modal:not([role])').forEach((m) => {
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      const t = m.querySelector('h1,h2,h3'); if (t) { if (!t.id) t.id = 'dlg' + Math.random().toString(36).slice(2, 8); m.setAttribute('aria-labelledby', t.id); }
      setTimeout(() => { if (!m.contains(document.activeElement)) { const f = m.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not([disabled])'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} } }, 60);
    });
  }
  // v134: campo trampa para robots (las personas no lo ven ni lo alcanzan con el teclado)
  function trampa() { if (document.getElementById('sstaTrampa') || !document.body) return; const d = document.createElement('div'); d.id = 'sstaTrampa'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    d.innerHTML = '<label for="sitio_web">Sitio web</label><input id="sitio_web" name="sitio_web" type="text" tabindex="-1" autocomplete="off" data-sin-valida="1">'; document.body.appendChild(d); }
  let pend = false;
  // v144: solo se revisa lo que se agregó (antes, todo el documento en cada cambio: tareas de hasta 0,5 s
  // al pintar listas grandes en celulares lentos), y cuando el celular está libre.
  const raices = new Set();
  function programar(ms) {
    (ms || []).forEach((m) => m.addedNodes && m.addedNodes.forEach((n) => { if (n.nodeType === 1) raices.add(n); else if (m.target && m.target.nodeType === 1) raices.add(m.target); }));   // v145: también cambios de texto
    if (pend) return; pend = true;
    const correr = () => {
      pend = false;
      const l = [...raices].filter((n) => n.isConnected); raices.clear();
      const top = l.filter((n) => !l.some((o) => o !== n && o.contains(n)));
      if (top.length > 40) { revisar(document); radios(document); return; }
      top.forEach((n) => { const p = n.parentElement || n; revisar(p); radios(p); });   // el padre: así se revisa también el nodo agregado
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(correr, { timeout: 300 }); else requestAnimationFrame(correr);
  }
  // v140: zona principal marcada y «Saltar al contenido» (lector de pantalla y teclado)
  function principal() {
    let m = document.querySelector('main, [role="main"]');
    if (!m) { const vis = (x) => x && x.offsetParent !== null; m = [...document.querySelectorAll('body > .wrap, body > .container, body > .app, .wrap')].find(vis) || [...document.body.children].find((x) => /^(DIV|SECTION)$/.test(x.tagName) && !x.id.startsWith('ssta') && vis(x) && x.querySelector('h1,h2,form,.card')); if (m) m.setAttribute('role', 'main'); }
    if (!m) return;
    // v154: si la página ya usa id="contenido" (informe, plan anual, evidencias, cierre de mes), no se repite:
    // con dos iguales, la página reemplazaba TODO (cabecera y selector) al pintar su contenido.
    if (!m.id) m.id = document.getElementById('contenido') ? 'contenido-principal' : 'contenido';
    if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');
    if (!document.getElementById('saltarContenido')) {
      const a = document.createElement('a'); a.id = 'saltarContenido'; a.className = 'saltar-contenido'; a.href = '#' + m.id; a.textContent = 'Saltar al contenido';
      a.addEventListener('click', (e) => { e.preventDefault(); try { m.focus({ preventScroll: false }); } catch (er) { m.focus(); } });
      document.body.insertBefore(a, document.body.firstChild);
    }
  }
  // v143: (1) en los grupos de opciones de una sola respuesta (role=radiogroup) cada botón dice si está elegido;
  // (2) al cambiar de pantalla (.screen.active) el foco va al título de la pantalla nueva (antes se perdía).
  function radios(raiz) {
    const base = raiz && raiz.querySelectorAll ? (raiz.closest && raiz.closest('[role="radiogroup"]') ? raiz.closest('[role="radiogroup"]') : raiz) : document;
    [...base.querySelectorAll('[role="radiogroup"] > button, [role="radiogroup"] > * > button')].concat(base.matches && base.matches('[role="radiogroup"]') ? [...base.querySelectorAll(':scope > button, :scope > * > button')] : []).forEach((b) => {
      const g = b.closest('[role="radiogroup"]'); if (g.querySelector('input')) return;
      if (b.getAttribute('role') !== 'radio') b.setAttribute('role', 'radio');
      const on = b.classList.contains('on') || b.classList.contains('sel') || b.getAttribute('aria-pressed') === 'true';
      if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
    });
  }
  function alCambiarClase(ms) {
    let r = false;
    ms.forEach((m) => {
      const t = m.target; if (t.closest && t.closest('[role="radiogroup"]')) r = true;
      if (t.classList && t.classList.contains('screen') && t.classList.contains('active') && !(m.oldValue || '').split(' ').includes('active')) {
        const a = document.activeElement;
        try { revisar(t); radios(t); } catch (e) {}   // v145: lo que estaba oculto se revisa al mostrarse (dictar, etiquetas, firmas)
        if (!a || a === document.body || !t.contains(a)) { const h = t.querySelector('h1, h2'); if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) {} } }
      }
    });
    if (r) radios(document);
  }
  const iniciar = () => { trampa(); principal(); revisar(document); radios(document); Leer.montar(); new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(alCambiarClase).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  // Escape cierra la ventana de arriba (si tiene botón para cerrarse).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const fs = document.querySelectorAll('body > .modal-fondo'); const f = fs[fs.length - 1]; if (!f) return;
    const c = f.querySelector('[data-cerrar]'); if (c) { e.preventDefault(); c.click(); }
  });
  return { revisar, esqueleto };
})();

/* ============================================================
   v132 · Errores — el mismo tipo de mensaje en todo el portal:
   «No se guardó. <qué pasó>. <qué hacer>».
   ============================================================ */
const Errores = {
  detalle(r) {
    if (!r) return 'No hubo respuesta del servidor. Revisa la señal e intenta de nuevo.';
    const e = String(r.error || '').trim().replace(/\.$/, '');
    if (r.conflicto) return 'Otra persona cambió este registro mientras lo tenías abierto. Ábrelo de nuevo para ver los cambios.';
    if (r.codigoError === 'SESION') return (e || 'Tu sesión venció') + '. Vuelve a entrar con tu usuario (botón de arriba).';
    if (r.codigoError === 'CAMBIAR') return 'Primero cambia tu clave temporal (botón de tu usuario, arriba).';
    if (r.codigoError === 'CLAVE') return 'Este celular no tiene la clave del portal: escríbela en «Clave», arriba.';
    if (r.codigoError === 'TEMPORAL') return 'El sistema estaba ocupado; se vuelve a intentar solo en unos segundos.';
    if (/failed to fetch|networkerror|sin conexi|timeout|tard[oó]/i.test(e)) return 'Sin conexión con el servidor. Revisa la señal e intenta de nuevo.';
    return e ? e + '.' : 'Error sin detalle. Intenta de nuevo; si sigue pasando, avísale al área SST (Estado → Enviar por WhatsApp).';
  },
  /** Errores.texto('guardó', r) → «No se guardó. …» */
  texto(accion, r) { return 'No se ' + accion + '. ' + this.detalle(r); }
};

/* ================= AUTOGUARDADO (v138–v139) =================
   Todo lo que se escribe en cualquier formulario del portal se guarda solo en
   el equipo, un momento después de cada cambio y al salir de la página (o al
   bloquear el celular). Si se sale sin guardar —se cerró la ventana, se tocó
   fuera del recuadro, se fue la batería— al volver a abrir el mismo formulario
   en blanco se rellena con lo que llevaba, con un aviso y la opción de
   descartarlo. Se borra solo cuando el registro se guarda (o queda en cola).
   v139: también fotos y firmas (en IndexedDB, que aguanta lo que pesan), lo
   último que se usó en área/lugar/equipo/supervisor, «Te falta esto» al
   guardar, aviso al salir con algo a medias y plantillas de tareas frecuentes.
   El ATS y los permisos ya tienen su propio borrador completo: ahí no se activa. */
const AutoGuardado = (function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { activo: false };
  const DIAS = 7, ESPERA = 600;
  // v141: buzón, convivencia y salud nunca se guardan en el equipo (ni plantillas): son confidenciales.
  const omitirPagina = () => /\/(ats|buzon|convivencia|salud)\.html$/.test(location.pathname) || !!document.querySelector('script[src*="permiso-core.js"]') || document.documentElement.hasAttribute('data-sin-autoguardado');
  const pagina = () => location.pathname.replace(/\/index\.html$/, '/');
  const conPref = (k) => typeof Consola !== 'undefined' ? Consola.clave(k) : k;
  const clave = () => conPref('ssta-auto|' + pagina());
  const leer = () => { try { const v = JSON.parse(localStorage.getItem(clave()) || '{}'); const lim = Date.now() - DIAS * 864e5; Object.keys(v).forEach((g) => { if (!v[g] || !v[g].t || v[g].t < lim) { delete v[g]; try { IDB.borrarPrefijo(clave() + '|' + g + '|'); } catch (e) {} } }); return v; } catch (e) { return {}; } };
  const escribir = (v) => { try { if (Object.keys(v).length) localStorage.setItem(clave(), JSON.stringify(v)); else localStorage.removeItem(clave()); } catch (e) { window.dispatchEvent(new CustomEvent('draft-guardado-fallido', { detail: { error: e } })); } };

  /* ── IndexedDB para fotos y firmas ── */
  const IDB = (function () {
    let db = null;
    const abrir = () => db || (db = new Promise((ok, mal) => { try { const r = indexedDB.open('ssta-auto', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); } catch (e) { mal(e); } }));
    const tx = (modo, fn) => abrir().then((d) => new Promise((ok, mal) => { const t = d.transaction('kv', modo), st = t.objectStore('kv'); const r = fn(st); t.oncomplete = () => ok(r && r.result); t.onerror = () => mal(t.error); }));
    return {
      put: (k, v) => tx('readwrite', (st) => st.put(v, k)).catch(() => {}),
      get: (k) => tx('readonly', (st) => st.get(k)).catch(() => undefined),
      claves: () => tx('readonly', (st) => st.getAllKeys()).catch(() => []),
      borrarPrefijo: (pre) => tx('readwrite', (st) => { const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; if (String(c.key).indexOf(pre) === 0) c.delete(); c.continue(); }; }).catch(() => {})
    };
  })();

  function idCampo(el) { return el.id || el.name || ''; }
  function sirve(el) {
    if (!el || !el.matches || !el.matches('input,textarea,select')) return false;
    if (el.closest('[data-sin-borrador],#sstaTrampa,.dlg-fondo,.dialogo,.ag-panel')) return false;
    const t = (el.type || '').toLowerCase();
    if (/^(password|file|hidden|search|button|submit|reset|image)$/.test(t)) return false;
    const n = idCampo(el);
    if (!n || /buscar|filtro|search|clave|password|token|sesion|pin\b/i.test(n)) return false;
    return true;
  }
  function contenedor(el) { return el.closest('.modal') || el.closest('form') || document.body; }
  function grupo(c, sinId) {
    let g;
    if (c.classList && c.classList.contains('modal')) { const h = c.querySelector('h1,h2,h3,.modal-titulo'); g = 'modal:' + ((h && h.textContent) || '').trim().slice(0, 60); }
    else if (c.tagName === 'FORM') g = 'form:' + (c.id || c.getAttribute('name') || [...document.forms].indexOf(c));
    else g = 'pagina';
    if (sinId) return g;
    const idReg = [...c.querySelectorAll('input[type=hidden]')].find((h) => /^(id|.*Id|.*_id)$/.test(idCampo(h)) && h.value);
    return idReg ? g + '#' + idReg.value : g;
  }
  function campos(c) { return [...c.querySelectorAll('input,textarea,select')].filter((el) => sirve(el) && contenedor(el) === c); }
  function valor(el) { const t = (el.type || '').toLowerCase(); if (t === 'checkbox') return !!el.checked; if (t === 'radio') return el.checked ? el.value : undefined; if (el.multiple) return [...el.selectedOptions].map((o) => o.value); return el.value; }
  const esTexto = (el) => el.tagName === 'TEXTAREA' || /^(text|email|tel|number|url|)$/.test((el.type || '').toLowerCase());
  function conTexto(c) { return campos(c).some((el) => esTexto(el) && !el.dataset.agReciente && el.value.trim()); }
  function etiqueta(el) {
    let l = el.id && document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
    if (!l) l = el.closest('label') || (el.closest('.field') && el.closest('.field').querySelector('label'));
    return ((l && l.textContent) || el.getAttribute('aria-label') || el.placeholder || idCampo(el)).replace(/\s+/g, ' ').trim();
  }
  function aplicar(el, x) {
    const t = (el.type || '').toLowerCase(); let prev;
    if (t === 'checkbox') { if (el.checked === !!x) return null; prev = el.checked; el.checked = !!x; }
    else if (t === 'radio') { if (el.value !== x || el.checked) return null; prev = false; el.checked = true; }
    else if (el.multiple && Array.isArray(x)) { prev = [...el.selectedOptions].map((o) => o.value); [...el.options].forEach((o) => { o.selected = x.indexOf(o.value) !== -1; }); }
    else { if (String(el.value) === String(x)) return null; prev = el.value; el.value = x; }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return [el, prev];
  }
  function deshacerAplicados(aplicados) {
    aplicados.forEach(([el, prev]) => { const t = (el.type || '').toLowerCase(); if (t === 'checkbox' || t === 'radio') el.checked = prev; else if (el.multiple && Array.isArray(prev)) [...el.options].forEach((o) => { o.selected = prev.indexOf(o.value) !== -1; }); else el.value = prev; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  }

  /* ── Extras (fotos, firmas): cada uno se registra con get/set ── */
  const extras = new WeakMap(); // contenedor → Map(clave → {get,set,vacio})
  function registrarExtra(el, k, api) {
    if (!el) return; const c = contenedor(el);
    if (!extras.has(c)) extras.set(c, new Map());
    extras.get(c).set(k, api);
  }
  function marcar(el) { if (suprimir || !el) return; const c = contenedor(el); pendientes.add(c); clearTimeout(tSave); tSave = setTimeout(guardarYa, ESPERA); }

  const restaurados = new WeakSet(), prellenados = new WeakSet(), pendientes = new Set();
  let tSave = null, suprimir = false;
  function guardarYa() {
    clearTimeout(tSave); tSave = null;
    if (!pendientes.size) return;
    const v = leer();
    pendientes.forEach((c) => {
      if (!document.body.contains(c)) return;
      const g = grupo(c), datos = {}, xs = [];
      campos(c).forEach((el) => { const x = valor(el); if (x !== undefined) datos[idCampo(el)] = x; });
      const ex = extras.get(c);
      if (ex) ex.forEach((api, k) => { let x; try { x = api.get(); } catch (e) {} if (x && (!Array.isArray(x) || x.length)) { xs.push(k); IDB.put(clave() + '|' + g + '|' + k, x); } });
      if (conTexto(c) || xs.length) v[g] = { t: Date.now(), d: datos, x: xs }; else delete v[g];
    });
    pendientes.clear();
    escribir(v);
  }
  function alCambiar(e) {
    if (suprimir) return;
    const el = e.target; if (!sirve(el)) return;
    delete el.dataset.agReciente;
    const c = contenedor(el); restaurados.add(c); pendientes.add(c); c._agToque = 0;
    if (e.type === 'change') recordar(el);
    clearTimeout(tSave); tSave = setTimeout(guardarYa, ESPERA);
    const p = c.querySelector(':scope > .ag-falta, .ag-falta'); if (p && contenedor(p) === c) revisarFaltantes(c, p);
  }

  /* ── Lo último que se usó (área, lugar, equipo, supervisor…) ── */
  const REC = /area|lugar|sitio|ubicaci|sede|frente|obra|equipo|supervisor|proceso|contratista|turno|zona|dependencia/i;
  const REC_NO = /fecha|hora|cedula|documento|telefono|correo|email|codigo|nombre(?!.*(supervisor|equipo))|descrip|observ/i;
  const claveRec = () => conPref('ssta-recientes');
  const recSirve = (el) => sirve(el) && /^(text|)$/.test((el.type || '').toLowerCase()) && el.tagName === 'INPUT' && REC.test(idCampo(el)) && !REC_NO.test(idCampo(el)) && !el.readOnly;
  function leerRec() { try { return JSON.parse(localStorage.getItem(claveRec()) || '{}'); } catch (e) { return {}; } }
  function recordar(el) {
    if (!recSirve(el)) return; const x = el.value.trim(); if (!x || x.length > 80) return;
    const r = leerRec(), k = idCampo(el), l = (r[k] || []).filter((o) => o.v !== x), prev = (r[k] || []).find((o) => o.v === x);
    l.unshift({ v: x, n: (prev ? prev.n : 0) + 1, t: Date.now() }); r[k] = l.slice(0, 12);
    try { localStorage.setItem(claveRec(), JSON.stringify(r)); } catch (e) {}
  }
  function prellenar(c) {
    if (prellenados.has(c)) return; prellenados.add(c);
    const r = leerRec(); let n = 0;
    campos(c).filter(recSirve).forEach((el) => {
      const l = r[idCampo(el)]; if (!l || !l.length) return;
      // Sugerencias: las más usadas primero (sin pisar una lista que ya tenga el campo).
      if (!el.getAttribute('list')) {
        const dl = document.createElement('datalist'); dl.id = 'agRec-' + idCampo(el).replace(/[^\w-]/g, '_');
        if (!document.getElementById(dl.id)) { dl.innerHTML = l.slice().sort((a, b) => b.n - a.n).slice(0, 8).map((o) => '<option value="' + esc(o.v) + '">').join(''); document.body.appendChild(dl); }
        el.setAttribute('list', dl.id);
      }
      if (!el.value) { suprimir = true; el.value = l[0].v; el.dataset.agReciente = '1'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); suprimir = false; n++; }
    });
    if (n) { const h = document.createElement('div'); h.className = 'ag-reciente'; h.textContent = 'Puse lo de la última vez en ' + (n === 1 ? 'un campo' : n + ' campos') + ' (área, lugar, equipo…). Cámbialo si hoy es distinto.'; insertarArriba(c, h); }
  }

  function insertarArriba(c, nodo) {
    if (c === document.body) { const m = document.querySelector('main') || document.querySelector('.wrap'); const ref = m && (m.querySelector('.card') || m.firstElementChild); if (ref && ref.parentNode) ref.parentNode.insertBefore(nodo, ref); else document.body.insertBefore(nodo, document.body.firstChild); }
    else { const h = c.querySelector(':scope > h1, :scope > h2, :scope > h3'); if (h) h.after(nodo); else c.insertBefore(nodo, c.firstChild); }
  }
  function aviso(c, g, cuando, aplicados, extrasPrev) {
    const b = document.createElement('div');
    b.className = 'autoguardado-aviso'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Recuperamos lo que estabas escribiendo (' + formatSavedAt(new Date(cuando).toISOString()) + ').</span>';
    const des = document.createElement('button'); des.type = 'button'; des.className = 'btn btn-sec'; des.textContent = 'Descartar';
    des.addEventListener('click', () => {
      suprimir = true; deshacerAplicados(aplicados); extrasPrev.forEach(([api, prev]) => { try { api.set(prev); } catch (e) {} }); suprimir = false;
      const v = leer(); delete v[g]; escribir(v); IDB.borrarPrefijo(clave() + '|' + g + '|'); b.remove();
    });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn'; ok.textContent = 'Seguir'; ok.addEventListener('click', () => b.remove());
    b.appendChild(ok); b.appendChild(des);
    insertarArriba(c, b);
  }
  async function restaurar(c) {
    if (restaurados.has(c)) return;
    const lista = campos(c); if (!lista.length) return;
    const g = grupo(c), v = leer(), r = v[g];
    if (conTexto(c)) { restaurados.add(c); return; } // ya trae datos (edición): no se pisa
    // v152: se quitó el botón «Plantillas» en todos los formularios (pedido del usuario).
    if (false) ponerPlantillas(c);
    if (!r) { prellenar(c); return; }
    restaurados.add(c); prellenados.add(c);
    const aplicados = []; suprimir = true;
    lista.forEach((el) => { const n = idCampo(el); if (!(n in r.d)) return; const a = aplicar(el, r.d[n]); if (a) aplicados.push(a); });
    suprimir = false;
    const extrasPrev = [], ex = extras.get(c);
    if (ex && r.x && r.x.length) await new Promise((ok) => setTimeout(ok, 1000));
    // v141: si en ese segundo la página cargó un registro (apareció su id), las fotos del borrador no se le ponen.
    if (ex && r.x && r.x.length && document.body.contains(c) && grupo(c) === g) {
      for (const k of r.x) { const api = ex.get(k); if (!api) continue; const val = await IDB.get(clave() + '|' + g + '|' + k); if (val == null) continue; let prev; try { prev = api.get(); } catch (e) {} suprimir = true; try { api.set(val); extrasPrev.push([api, prev]); } catch (e) {} suprimir = false; }
    }
    if ((aplicados.length || extrasPrev.length) && !c.querySelector('.autoguardado-aviso')) aviso(c, g, r.t, aplicados, extrasPrev);
    // Si la página limpia su formulario al terminar de abrir (su «nuevo()»), se vuelve a poner.
    const textos = aplicados.map((a) => a[0]).filter((el) => esTexto(el) && el.value);
    if (textos.length && !(c._agRevisado > 3)) {
      c._agRevisado = (c._agRevisado || 0) + 1; const marca = c._agToque = Date.now();
      [300, 1000, 2500].forEach((ms) => setTimeout(() => {
        if (c._agToque !== marca || !document.body.contains(c) || !leer()[g]) return;
        if (textos.every((el) => !el.value.trim())) { restaurados.delete(c); restaurar(c); }
      }, ms));
    }
  }
  let tBus = null;
  function buscar() { clearTimeout(tBus); tBus = setTimeout(() => { const cs = new Set(); document.querySelectorAll('input,textarea,select').forEach((el) => { if (sirve(el)) cs.add(contenedor(el)); }); cs.forEach(restaurar); }, 250); }

  /* ── «Te falta esto» al tocar Guardar / Enviar / Firmar ── */
  const BOTON_GUARDAR = /^(guardar|enviar|registrar|firmar|reportar|crear|agregar y guardar|cerrar y guardar)/i;
  function obligatorio(el) {
    if (el.disabled || el.offsetParent === null) return false;
    if (el.required) return true;
    const l = etiqueta(el); return /\*\s*$/.test(l) || /\*\s*\(/.test(l);
  }
  function vacio(el) { const t = (el.type || '').toLowerCase(); if (t === 'checkbox') return false; if (t === 'radio') { const gr = el.name && document.querySelectorAll('input[type=radio][name="' + el.name + '"]'); return gr ? ![...gr].some((x) => x.checked) : !el.checked; } return !String(el.value || '').trim(); }
  function faltantes(c) {
    const vistos = new Set();
    return [...c.querySelectorAll('input,textarea,select')].filter((el) => contenedor(el) === c && !/^(hidden|button|submit|file)$/i.test(el.type || '') && obligatorio(el) && vacio(el)).filter((el) => { const k = el.type === 'radio' ? 'r:' + el.name : el; if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  function revisarFaltantes(c, panel) {
    const f = faltantes(c);
    if (!f.length) { panel.remove(); return; }
    panel.innerHTML = '<b>Te falta esto (' + f.length + '):</b>';
    const ul = document.createElement('div'); ul.className = 'ag-falta-lista';
    f.slice(0, 12).forEach((el) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ag-falta-item'; b.textContent = etiqueta(el).replace(/\s*\*\s*$/, ''); b.addEventListener('click', () => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }, 250); }); ul.appendChild(b); });
    panel.appendChild(ul);
  }
  function alTocarGuardar(e) {
    const b = e.target && e.target.closest && e.target.closest('button,[type=submit]');
    if (!b || b.closest('.ag-panel,.dlg-fondo,.autoguardado-aviso,.ag-falta')) return;
    if ([...contenedor(b).querySelectorAll('.status-msg')].some((m) => contenedor(m) === contenedor(b))) return;   // v143: la página ya dice qué falta (sin mensajes repetidos)
    const txt = (b.textContent || b.value || '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!BOTON_GUARDAR.test(txt)) return;
    const c = contenedor(b);
    let p = [...c.querySelectorAll('.ag-falta')].find((x) => contenedor(x) === c);
    const f = faltantes(c);
    if (!f.length) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.className = 'ag-falta'; p.setAttribute('role', 'alert'); b.parentNode.insertBefore(p, b); }
    revisarFaltantes(c, p);
  }

  /* ── Aviso al salir con algo a medias ── */
  function hayAMedias() { if (pendientes.size) guardarYa(); return Object.keys(leer()).length > 0 && [...document.querySelectorAll('input,textarea,select')].some((el) => sirve(el) && esTexto(el) && !el.dataset.agReciente && el.value.trim()); }
  function alTocarEnlace(e) {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || a.target === '_blank' || a.hasAttribute('download') || e.ctrlKey || e.metaKey) return;
    const href = a.getAttribute('href'); if (!href || href[0] === '#' || /^(javascript|mailto|tel|whatsapp|sms):/i.test(href)) return;
    let u; try { u = new URL(href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || u.pathname === location.pathname) return;
    if (typeof window.__sstaDialogoAuto !== 'undefined' && !window.__sstaAvisoSalir) return; // pruebas automáticas
    if (!hayAMedias() || typeof Dialogo === 'undefined') return;
    e.preventDefault();
    Dialogo.confirmar('¿Salir de este formulario?\nLo que escribiste queda guardado en este celular y lo encuentras al volver.').then((si) => { if (si) location.href = u.href; });
  }

  /* ── Plantillas de tareas frecuentes ── */
  const claveTpl = () => conPref('ssta-plantillas|' + pagina());
  function tplLocales(g) { try { return (JSON.parse(localStorage.getItem(claveTpl()) || '{}')[g] || []); } catch (e) { return []; } }
  function tplGuardarLocal(g, t) { try { const o = JSON.parse(localStorage.getItem(claveTpl()) || '{}'); o[g] = [t].concat((o[g] || []).filter((x) => x.nombre !== t.nombre)).slice(0, 30); localStorage.setItem(claveTpl(), JSON.stringify(o)); } catch (e) {} }
  async function tplServidor(g) {
    if (typeof SGSST === 'undefined' || !SGSST.url()) return [];
    try { const r = await SGSST.listar('plantillaform', { sinPedir: true }); return (r.rows || []).map((x) => x.resumen || {}).filter((x) => x.pagina === pagina() && x.grupo === g).map((x) => { let d = {}; try { d = JSON.parse(x.datos || '{}'); } catch (e) {} return { nombre: x.nombre, d, comun: true }; }); } catch (e) { return []; }
  }
  function ponerPlantillas(c) {
    if (c.querySelector('.ag-tpl-btn') || campos(c).filter(esTexto).length < 3 || c === document.body && !document.querySelector('main,.wrap')) return;
    if (/\/(index|usuarios|configuracion|etiquetas-qr|papelera|reportes|buzon)\.html$|\/$/.test(location.pathname)) return;   // v151: los reportes no llevan plantillas
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost ag-tpl-btn'; b.textContent = 'Plantillas';
    b.addEventListener('click', () => abrirPlantillas(c, b));
    insertarArriba(c, b);
  }
  async function abrirPlantillas(c, boton) {
    const viejo = c.querySelector('.ag-panel'); if (viejo) { viejo.remove(); return; }
    const g = grupo(c, true), p = document.createElement('div'); p.className = 'ag-panel';
    p.innerHTML = '<b>Plantillas de tareas frecuentes</b><p class="ayuda">Llenan el formulario con lo que se repite (peligros, controles, EPP…). Luego revisa y completa lo de hoy.</p><div class="ag-tpl-lista">Cargando…</div>';
    const g2 = document.createElement('button'); g2.type = 'button'; g2.className = 'btn btn-sec'; g2.textContent = 'Guardar lo escrito como plantilla';
    p.appendChild(g2); boton.after(p);
    const pintar = async () => {
      const todas = (await tplServidor(g)).concat(tplLocales(g).filter((l) => true));
      const vistos = new Set(), l = todas.filter((t) => !vistos.has(t.nombre) && vistos.add(t.nombre));
      const cont = p.querySelector('.ag-tpl-lista'); cont.innerHTML = l.length ? '' : '<div class="empty">Aún no hay plantillas para este formulario. Llénalo una vez y toca «Guardar lo escrito como plantilla».</div>';
      l.forEach((t) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'ag-falta-item'; x.textContent = t.nombre + (t.comun ? '' : ' (solo este celular)'); x.addEventListener('click', () => {
        campos(c).forEach((el) => { const n = idCampo(el); if (n in t.d) aplicar(el, t.d[n]); }); p.remove();
        const h = document.createElement('div'); h.className = 'ag-reciente'; h.textContent = 'Plantilla «' + t.nombre + '» aplicada. Revisa que todo aplique a la tarea de hoy.'; insertarArriba(c, h); marcar(campos(c)[0]);
      }); cont.appendChild(x); });
    };
    g2.addEventListener('click', async () => {
      const nombre = await Dialogo.pedir('Nombre de la plantilla (la tarea), por ejemplo «Cambio de lámina en altura»:', ''); if (!nombre || !nombre.trim()) return;
      const d = {}; campos(c).forEach((el) => { if (/fecha|hora|firma|cedula|nombre|foto/i.test(idCampo(el)) && !REC.test(idCampo(el))) return; const x = valor(el); if (x !== undefined && x !== '' && x !== false) d[idCampo(el)] = x; });
      const t = { nombre: nombre.trim().slice(0, 80), d };
      let comun = false;
      if (typeof SGSST !== 'undefined' && SGSST.url()) { try { const r = await SGSST.enviar({ action: 'guardar', tipo: 'plantillaform', id: 'TPL-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), doc: { nombre: t.nombre, pagina: pagina(), grupo: g, datos: JSON.stringify(d).slice(0, 6000) } }, null, { sinCola: true }); comun = !!(r && r.ok); } catch (e) {} }
      if (!comun) tplGuardarLocal(g, t);
      if (typeof UI !== 'undefined' && UI.toast) UI.toast(comun ? 'Plantilla guardada para todo el equipo.' : 'Plantilla guardada en este celular.');
      pintar();
    });
    pintar();
  }

  // Solo cuenta un envío que la persona acaba de pedir (tocó un botón hace
  // poco): un reenvío de la cola al volver la señal no borra lo que se está
  // escribiendo ahora. Y solo se borra lo escrito antes de ese envío.
  let ultimoToque = 0, ultimoGrupo = null, ultimoGrupoBase = null;
  const ACCIONES = /^(guardar\w*|parche|crearObra|cerrarAts|agregarParticipantes|addWorkers|encuestaPublica)$/;
  function limpiar(desde, body) {
    desde = desde || Date.now();
    if (desde - ultimoToque > 8000) return;
    if (body && body.tipo === 'plantillaform') return;
    clearTimeout(tSave); pendientes.clear();
    // v141: solo se borra el borrador del formulario que se guardó (el del botón que se tocó), no los demás.
    const v = leer(); Object.keys(v).forEach((g) => { const base = g.split('#')[0]; if (v[g].t <= desde && (g === ultimoGrupo || (base === ultimoGrupoBase && g.indexOf('#') === -1))) { delete v[g]; IDB.borrarPrefijo(clave() + '|' + g + '|'); } }); escribir(v);
    document.querySelectorAll('.autoguardado-aviso,.ag-falta,.ag-reciente').forEach((b) => { const cb = contenedor(b); if (grupo(cb) === ultimoGrupo || grupo(cb, true) === ultimoGrupoBase) b.remove(); });
  }
  const cuerpo = (b) => { try { return (typeof b === 'string' ? JSON.parse(b) : b) || {}; } catch (e) { return {}; } };

  function iniciar() {
    if (omitirPagina()) return;
    document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button,[type=submit],.btn,a'); if (b) { ultimoToque = Date.now(); const cb = contenedor(b); ultimoGrupo = grupo(cb); ultimoGrupoBase = grupo(cb, true); } }, true);
    document.addEventListener('click', alTocarGuardar, true);
    document.addEventListener('click', alTocarEnlace);
    document.addEventListener('input', alCambiar, true);
    document.addEventListener('change', alCambiar, true);
    window.addEventListener('pagehide', guardarYa);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarYa(); });
    // Un formulario en ventana se guarda al cerrarse, aunque sea tocando fuera.
    // v144: solo cuando se cierra una ventana con algo pendiente se guarda de una; y solo se busca
    // formularios nuevos si lo agregado tiene campos (no por cada foto o lista que se pinta).
    const conCampos = (n) => n.nodeType === 1 && (n.matches('input,textarea,select,.modal,form') || !!n.querySelector('input,textarea,select'));
    new MutationObserver((ms) => {
      if (pendientes.size && ms.some((m) => [...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches('.modal,.modal-fondo,form') || !!n.querySelector('.modal,form'))))) guardarYa();
      if (ms.some((m) => [...m.addedNodes].some(conCampos))) buscar();
    }).observe(document.body, { childList: true, subtree: true });
    buscar(); setTimeout(buscar, 1200);
    // v141: fotos de borradores que ya vencieron o se descartaron no se quedan en el equipo.
    setTimeout(() => { try { const vivos = Object.keys(leer()).map((g) => clave() + '|' + g + '|'); IDB.claves().then((ks) => (ks || []).forEach((k) => { if (String(k).indexOf(clave() + '|') === 0 && !vivos.some((p) => String(k).indexOf(p) === 0)) IDB.borrarPrefijo(String(k)); })); } catch (e) {} }, 3000);
    if (typeof SGSST !== 'undefined' && SGSST.enviar && !SGSST.enviar._auto) {
      const orig = SGSST.enviar;
      SGSST.enviar = async function (body) { const t0 = Date.now(); const r = await orig.apply(this, arguments); try { if (r && r.ok && body && ACCIONES.test(body.action || '')) limpiar(t0, body); } catch (e) {} return r; };
      SGSST.enviar._auto = true;
    }
    // Las páginas que guardan en otros servidores (EPP, asistencia…) también.
    const f0 = window.fetch;
    window.fetch = function (u, o) {
      const p = f0.apply(this, arguments);
      try {
        const b = o && typeof o.body === 'string' ? cuerpo(o.body) : null;
        if (b && String(o.method || '').toUpperCase() === 'POST' && /script\.google/.test(String(u)) && ACCIONES.test(b.action || '')) {
          const t0 = Date.now();
          p.then((res) => res && res.clone && res.clone().json().then((j) => { if (j && j.ok) limpiar(t0, b); }).catch(() => {})).catch(() => {});
        }
      } catch (e) {}
      return p;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else setTimeout(iniciar, 0);
  return { activo: true, guardarYa, limpiar, marcar, registrarExtra, faltantes, _clave: () => clave(), _idb: IDB };
})();

/* v163: acciones sin onclick en línea (la CSP ya no permite JavaScript dentro de los atributos). */
function accionSinOnclick_(e) {
  const t = e.target && e.target.closest ? e.target.closest('[data-recargar],[data-seleccionar],[data-imprimir]') : null; if (!t) return;
  if (t.hasAttribute('data-recargar')) location.reload();
  else if (t.hasAttribute('data-seleccionar') && t.select) t.select();
  else if (t.hasAttribute('data-imprimir')) window.print();
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', accionSinOnclick_);
/* ============================================================
   13-guia-flotante.js — La guía, flotando en cada pantalla (v173)
   ------------------------------------------------------------
   Un botón redondo abajo a la derecha abre «Pregúntale a la guía» sin salir
   de la pantalla. Propone primero las preguntas de ESA pantalla. Las guías
   y respuestas (ayuda-guias.js, guia-preguntas.js) se cargan solo al abrirla,
   para no hacer más pesada ninguna pantalla.
   Lo que no sabe responder se anota (solo el texto) para agregarlo después.
   No aparece en Ayuda (ya la tiene arriba), en la pantalla de planta ni al imprimir.
   ============================================================ */
const GuiaFlotante = (function () {
  const NO = /(^|\/)(ayuda|pantalla-planta|offline|404|instalar)\.html$/;
  const pagina = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  let panel = null,
    boton = null,
    listo = null;
  const cargarJs = (src) =>
    new Promise((ok, mal) => {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => mal(new Error(src));
      document.head.appendChild(s);
    });
  function preparar() {
    if (!listo)
      listo = (typeof GUIAS === 'undefined' ? cargarJs('ayuda-guias.js') : Promise.resolve())
        .then(() => (typeof GUIA_PREGUNTAS === 'undefined' ? cargarJs('guia-preguntas.js') : null))
        .then(() => {
          const vis = (g) => {
            try {
              if (typeof Empresa !== 'undefined' && Empresa.visible && !Empresa.visible('ayuda', g.id)) return false;
              return !g.mod || typeof Empresa === 'undefined' || !Empresa.moduloActivo || g.mod.some((m) => Empresa.moduloActivo(m));
            } catch (e) {
              return true;
            }
          };
          GUIA_PREGUNTAS.armar({ guias: (typeof GUIAS !== 'undefined' ? GUIAS : []).filter(vis), faq: [] });
          GUIA_PREGUNTAS.enviarCola();
        });
    return listo;
  }
  /** Las preguntas de esta pantalla (las respuestas que llevan a ella); si no hay, las generales. */
  function deEstaPantalla() {
    const p = pagina(),
      l = GUIA_PREGUNTAS.RESPUESTAS.filter((x) => (x.a || []).some(([, h]) => h.split(/[?#]/)[0].toLowerCase() === p)).map((x) => x.p[0]);
    return (l.length ? l : GUIA_PREGUNTAS.SUGERIDAS).slice(0, 4);
  }
  const chip = (t) => '<button type="button" class="gf-chip" data-gf="' + esc(t) + '">' + esc(t) + '</button>';
  /* v174 · Como un chat: la guía saluda y pregunta en qué ayuda; cada pregunta queda en burbujas. */
  const burbuja = (quien, html) => {
    const res = panel.querySelector('.gf-res'),
      d = document.createElement('div');
    d.className = 'gf-b ' + (quien === 'yo' ? 'gf-yo' : 'gf-guia');
    d.innerHTML = html;
    res.appendChild(d);
    res.scrollTop = res.scrollHeight;
    return d;
  };
  function saludar() {
    const y = typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo(),
      n = y && y.nombre ? ' ' + String(y.nombre).split(' ')[0] : '';
    burbuja(
      'guia',
      '<div class="gf-r">¡Hola' +
        esc(n) +
        '! 👋 ¿En qué te ayudo? Escríbeme tu pregunta o toca una de estas:</div>' +
        '<div class="gf-otra">' +
        deEstaPantalla().map(chip).join('') +
        '</div>',
    );
  }
  function responder(q) {
    q = String(q || '').trim();
    if (!q) return;
    panel.querySelector('input').value = '';
    burbuja('yo', esc(q));
    const l = GUIA_PREGUNTAS.preguntar(q),
      x = l[0];
    if (!x) GUIA_PREGUNTAS.reportar(q);
    burbuja(
      'guia',
      x
        ? '<b>' +
            esc(x.t) +
            '</b><div class="gf-r">' +
            esc(x.r) +
            '</div>' +
            (x.a || []).map(([t, h]) => '<a class="btn-mini" href="' + esc(h) + '">' + esc(t) + ' →</a>').join(' ') +
            (l.length > 1
              ? '<div class="gf-otra">También: ' +
                l
                  .slice(1)
                  .map((y) => chip(y.t))
                  .join('') +
                '</div>'
              : '') +
            '<div class="gf-r gf-sigue">¿Algo más?</div>'
        : '<div class="gf-r">No tengo esa respuesta todavía. Ya quedó anotada para agregarla. ¿Me lo preguntas con otras palabras? También puedes mirar el <a href="ayuda.html">manual</a>.</div>',
    );
  }
  function abrir() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'guiaPanel';
      panel.className = 'gf-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Guía del portal');
      panel.innerHTML =
        '<div class="gf-cab"><b>Guía del portal</b><button type="button" class="gf-x" aria-label="Cerrar la guía">✕</button></div>' +
        '<div class="gf-res" aria-live="polite"><div class="gf-b gf-guia gf-cargando"><div class="gf-r">Un momento…</div></div></div>' +
        '<form class="gf-f"><input type="search" aria-label="Tu pregunta" placeholder="Escribe tu pregunta…" autocomplete="off">' +
        '<button type="submit" class="gf-ir" aria-label="Preguntar">➜</button></form>' +
        '<div class="gf-pie">Sin señal también funciona. <a href="ayuda.html">Manual completo</a></div>';
      document.body.appendChild(panel);
      panel.querySelector('.gf-x').addEventListener('click', cerrar);
      panel.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        responder(panel.querySelector('input').value);
      });
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-gf]');
        if (!b) return;
        panel.querySelector('input').value = b.dataset.gf;
        responder(b.dataset.gf);
      });
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrar();
      });
    }
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    panel.querySelector('input').focus();
    preparar()
      .then(() => {
        const c = panel.querySelector('.gf-cargando');
        if (c) c.remove();
        if (!panel.querySelector('.gf-b')) saludar();
      })
      .catch(() => {
        panel.querySelector('.gf-res').innerHTML = '<div class="gf-r">No se pudo abrir la guía. Abre el <a href="ayuda.html">manual</a>.</div>';
      });
  }
  function cerrar() {
    if (panel) panel.hidden = true;
    if (boton) {
      boton.setAttribute('aria-expanded', 'false');
      boton.focus();
    }
  }
  function iniciar() {
    if (boton || NO.test(pagina()) || !document.body || document.body.classList.contains('tv') || document.body.hasAttribute('data-sin-guia')) return;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.id = 'guiaBtn';
    boton.className = 'gf-btn';
    boton.setAttribute('aria-label', 'Pregúntale a la guía');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', 'guiaPanel');
    boton.title = 'Pregúntale a la guía';
    boton.innerHTML = '<span aria-hidden="true">?</span>';
    boton.addEventListener('click', () => (panel && !panel.hidden ? cerrar() : abrir()));
    document.body.appendChild(boton);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else setTimeout(iniciar, 0);
  }
  return { iniciar, abrir, cerrar };
})();
