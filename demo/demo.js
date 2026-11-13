/* ============================================================
   demo.js — Empresa demo: el portal completo SIN Google
   ------------------------------------------------------------
   Lo carga empresa.js solo cuando EMPRESA.demo === true.

   Las llamadas al "servidor" (EMPRESA.servidor) no salen a internet:
   las atiende el MISMO código del servidor único, corriendo en este
   navegador (apps-script-navegador.js). Los datos de ejemplo vienen de
   demo/semilla.json y lo que se registre queda guardado solo en este
   equipo. El botón 🧪 DEMO permite reiniciar.
   ============================================================ */
(function () {
  'use strict';
  const BASE = String((typeof EMPRESA !== 'undefined' && EMPRESA.servidor) || 'https://demo.portal-ssta.invalid/exec').replace(/\/+$/, '');
  const TOKEN = (typeof EMPRESA !== 'undefined' && EMPRESA.apiToken) || 'token-demo';
  const ARCHIVOS = ['00-Portal.gs', '01-Empresa.gs', '10-permisos.gs', '11-personal.gs', '12-ats.gs', '13-asistencia.gs', '14-epp.gs', '15-sgsst.gs'];
  const DB = 'ssta-demo', TIENDA = 'kv', LLAVE = 'estado';

  // El simulador se carga ya (va antes del resto del portal).
  document.write('<script src="demo/apps-script-navegador.js"><\/script>');

  const fetchOriginal = window.fetch.bind(window);

  /* ── Guardado en este equipo (IndexedDB) ── */
  function abrir() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(TIENDA);
      r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
    });
  }
  async function leer() {
    try { const db = await abrir(); return await new Promise((ok) => { const q = db.transaction(TIENDA).objectStore(TIENDA).get(LLAVE); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); }
    catch (e) { return null; }
  }
  async function escribir(valor) {
    try { const db = await abrir(); await new Promise((ok) => { const t = db.transaction(TIENDA, 'readwrite'); valor === null ? t.objectStore(TIENDA).delete(LLAVE) : t.objectStore(TIENDA).put(valor, LLAVE); t.oncomplete = ok; t.onerror = ok; }); }
    catch (e) { /* modo privado: la demo sigue, sin recordar */ }
  }
  // Cada guardado se escribe en el equipo ANTES de responder "ok": si la
  // persona cambia de página enseguida, no se pierde nada.
  let cola = Promise.resolve();
  function guardar(estado) {
    const texto = AppsScriptNavegador.serializar(estado);
    cola = cola.then(() => escribir(texto)).then(() => {
      try { miVersion = String(Number(versionGuardada()) + 1); localStorage.setItem(VERSION, miVersion); } catch (e) {}
    });
    return cola;
  }

  /* ── Datos de ejemplo siempre recientes ──
     La semilla se grabó un día X. Al abrir la demo, todas sus fechas se
     corren las semanas completas que hayan pasado desde X (semanas, para
     que las charlas sigan cayendo en su día). Se corren también los
     códigos (ATS-AAAAMMDD-…) para que todo siga cuadrando. */
  function semillaAlDia(texto) {
    const s = JSON.parse(texto);
    const estado = JSON.stringify(s.estado || s);
    const ref = s.fechaReferencia;
    if (!ref) return estado;
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
    const dias = Math.max(0, Math.floor((hoy - new Date(ref + 'T12:00:00')) / 86400000 / 7) * 7);
    if (!dias) return estado;
    const correr = (a, m, d) => { const x = new Date(Date.UTC(+a, +m - 1, +d + dias)); return [x.getUTCFullYear(), String(x.getUTCMonth() + 1).padStart(2, '0'), String(x.getUTCDate()).padStart(2, '0')]; };
    // Los meses (datos de indicadores: MES-AAAA-MM) se corren los mismos meses que la fecha de referencia.
    const p0 = ref.split('-').map(Number), r1 = correr(p0[0], p0[1], p0[2]);
    const meses = (r1[0] - p0[0]) * 12 + (Number(r1[1]) - p0[1]);
    const correrMes = (a, m) => { const x = new Date(Date.UTC(+a, +m - 1 + meses, 1)); return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0'); };
    return estado
      .replace(/\b(20\d\d)-(\d\d)(?![-\d])/g, (t, a, m) => correrMes(a, m))
      .replace(/\b(20\d\d)-(\d\d)-(\d\d)/g, (t, a, m, d) => correr(a, m, d).join('-'))
      .replace(/-(20\d\d)(\d\d)(\d\d)-/g, (t, a, m, d) => '-' + correr(a, m, d).join('') + '-')
      .replace(/\b(\d\d)\/(\d\d)\/(20\d\d)\b/g, (t, d, m, a) => { const x = correr(a, m, d); return x[2] + '/' + x[1] + '/' + x[0]; });
  }

  /* ── Arranque del servidor simulado (una vez por página) ── */
  // Varias pestañas abiertas: cada guardado sube un contador compartido; si
  // otra pestaña guardó después, esta vuelve a leer antes de escribir (así no
  // pisa lo que la otra registró).
  const VERSION = 'ssta-demo-version';
  const versionGuardada = () => { try { return localStorage.getItem(VERSION) || '0'; } catch (e) { return '0'; } };
  let miVersion = null;
  let listo = null;
  function iniciar() {
    if (listo) return listo;
    listo = (async () => {
      miVersion = versionGuardada();
      const fuentes = await Promise.all(ARCHIVOS.map((f) => fetchOriginal('servidor-unico/' + f).then((r) => { if (!r.ok) throw new Error('falta servidor-unico/' + f); return r.text(); })));
      let texto = await leer(), nuevo = false;
      if (!texto) {
        nuevo = true;
        try { const r = await fetchOriginal('demo/semilla.json', { cache: 'no-store' }); if (r.ok) texto = semillaAlDia(await r.text()); } catch (e) { console.warn('demo: semilla', e); }
      }
      const m = AppsScriptNavegador.cargar(fuentes, texto ? AppsScriptNavegador.revivir(texto) : null);
      // En la demo no se pide clave: cualquier celular entra con el token fijo.
      // (Se pone ANTES de instalar: cada módulo lee el token al crearse.)
      const sinInstalar = !m.estado.propiedades.API_TOKEN;
      m.estado.propiedades.API_TOKEN = TOKEN;
      if (sinInstalar) { try { m.servidor.instalar(); } catch (e) { console.warn('demo: instalar', e); } }
      delete m.estado.propiedades.CLAVE_PORTAL;
      if (nuevo) await guardar(m.estado);
      return m;
    })();
    listo.catch(() => { listo = null; });   // sin señal al abrir: se reintenta en la próxima llamada
    return listo;
  }
  window.DemoPortal = { iniciar, base: BASE, exportar: async () => AppsScriptNavegador.serializar((await iniciar()).estado),
    correr: async (n) => { const m = await iniciar(); const r = m.servidor.correr(n); await guardar(m.estado); return r; } };

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  window.fetch = async function (entrada, opciones) {
    const url = typeof entrada === 'string' ? entrada : (entrada && entrada.url) || String(entrada);
    if (url.indexOf(BASE) !== 0) return fetchOriginal(entrada, opciones);
    try {
      if (listo && miVersion !== null && versionGuardada() !== miVersion) listo = null;   // otra pestaña guardó
      const m = await iniciar();
      const u = new URL(url);
      const ruta = u.pathname.replace(/^.*?\/exec\/?/, '').replace(/\/+$/, '');
      // v122: cuenta cómo llegan las llamadas (con Google, «/exec/<módulo>» puede pedir sesión: debe llegar ?modulo=)
      const R = window.DemoPortal.rutas = window.DemoPortal.rutas || { ruta: 0, modulo: 0 };
      if (ruta) R.ruta++; else if (u.searchParams.get('modulo')) R.modulo++;
      const parameter = {};
      u.searchParams.forEach((v, k) => { parameter[k] = v; });
      if ('token' in parameter) parameter.token = TOKEN;
      const metodo = String((opciones && opciones.method) || (entrada && entrada.method) || 'GET').toUpperCase();
      await espera(80 + Math.random() * 160);   // que se sienta como un servidor
      let salida;
      if (metodo === 'POST') {
        let cuerpo = opciones && opciones.body;
        if (typeof cuerpo !== 'string') cuerpo = cuerpo ? await new Response(cuerpo).text() : (entrada && entrada.text ? await entrada.text() : '');
        try { const o = JSON.parse(cuerpo); if (o && typeof o === 'object' && 'token' in o) { o.token = TOKEN; cuerpo = JSON.stringify(o); } } catch (e) {}
        salida = m.servidor.doPost({ postData: { contents: cuerpo, type: 'text/plain' }, parameter, pathInfo: ruta });
        await guardar(m.estado);
      } else {
        salida = m.servidor.doGet({ parameter, pathInfo: ruta });
      }
      return new Response(salida._t, { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      console.error('demo:', err);
      return new Response(JSON.stringify({ ok: false, codigoError: 'TEMPORAL', error: 'Demo: ' + (err && err.message || err) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  };

  /* ── Botón 🧪 DEMO ── */
  async function reiniciar() {
    await escribir(null);
    try { Object.keys(localStorage).forEach((k) => { if (/^(ssta-)/.test(k)) localStorage.removeItem(k); }); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try { indexedDB.deleteDatabase('ssta-outbox'); } catch (e) {}
    location.href = 'index.html';
  }
  function boton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'botonDemo';
    b.textContent = '🧪 DEMO';
    b.setAttribute('aria-label', 'Modo demostración: ver opciones');
    b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:10050;border:0;border-radius:16px;padding:5px 9px;font:700 11px/1 Inter,system-ui,sans-serif;' +
      'background:#5b2a86;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer;opacity:.85;';
    b.addEventListener('click', () => {
      const f = document.createElement('div');
      f.style.cssText = 'position:fixed;inset:0;z-index:10060;background:rgba(15,25,35,.55);display:flex;align-items:flex-end;justify-content:center;';
      f.innerHTML = '<div style="background:#fff;color:#151b24;width:100%;max-width:560px;border-radius:16px 16px 0 0;padding:18px 18px 24px;font-family:Inter,system-ui,sans-serif;">' +
        '<h3 style="margin:0 0 8px;font-size:17px;">🧪 Esto es una demostración</h3>' +
        '<p style="margin:0 0 10px;font-size:13.5px;line-height:1.5;color:#3c4752;">La empresa, las personas y los registros son <b>ficticios</b>. Todo funciona igual que en una empresa real (permisos, ATS, charlas, anexo, EPP y PDF), pero lo que registres se guarda <b>solo en este equipo</b>: no se envía a ningún servidor.</p>' +
        '<p style="margin:0 0 14px;font-size:12.5px;color:#5c6a76;">En una empresa real, los datos quedan en la cuenta de Google de esa empresa.</p>' +
        '<button type="button" data-r style="width:100%;min-height:46px;border:0;border-radius:11px;background:#5b2a86;color:#fff;font-weight:700;font-size:14px;margin-bottom:8px;cursor:pointer;">↺ Reiniciar la demo (volver a los datos de ejemplo)</button>' +
        '<button type="button" data-c style="width:100%;min-height:44px;border:1.5px solid #dde3e8;border-radius:11px;background:#fff;font-weight:700;font-size:14px;cursor:pointer;">Cerrar</button></div>';
      document.body.appendChild(f);
      f.addEventListener('click', (e) => {
        if (e.target === f || e.target.closest('[data-c]')) f.remove();
        else if (e.target.closest('[data-r]') && confirm('¿Borrar lo que registraste en la demo y volver a los datos de ejemplo?')) reiniciar();
      });
    });
    document.body.appendChild(b);
    // A los 5 s queda solo el ícono, para no tapar botones de la parte de abajo.
    setTimeout(() => { b.textContent = '🧪'; b.style.padding = '6px 8px'; b.style.opacity = '.6'; }, 5000);
    const st = document.createElement('style');
    st.textContent = 'body{padding-bottom:max(38px, env(safe-area-inset-bottom));}@media print{#botonDemo{display:none !important;}body{padding-bottom:0;}}';
    document.head.appendChild(st);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boton); else boton();
})();
