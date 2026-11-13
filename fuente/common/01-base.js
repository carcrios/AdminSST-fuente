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

