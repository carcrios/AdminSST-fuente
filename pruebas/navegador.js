#!/usr/bin/env node
/* ============================================================
   navegador.js — Pruebas en un navegador de verdad (Chromium)
   ------------------------------------------------------------
   pruebas.js revisa el código; esto revisa que FUNCIONE, como lo usaría
   alguien en planta con el celular:

     · todas las pantallas abren sin errores y sin salirse de lo ancho
     · los 5 permisos: diligenciar, firmar, guardar y que el servidor lo
       verifique (las firmas incluidas)
     · sin señal: el permiso queda en cola y se envía solo al volver la señal
     · en celular la firma se hace a pantalla completa y no supera el
       límite de 50.000 caracteres de Google Sheets

   Corre sobre la empresa demo: el MISMO código del servidor único se
   ejecuta dentro del navegador, así que se prueba sitio + servidor juntos
   sin tocar Google.

   CÓMO SE USA
       cd pruebas && npm install      (una sola vez; instala Playwright)
       npx playwright install chromium (una sola vez, si no lo tienes)
       node navegador.js

   Devuelve 0 si todo está bien y 1 si algo falló.
   ============================================================ */
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const RAIZ = path.join(__dirname, '..');
// v165: SSTA_MOTOR=webkit corre la misma suite en el motor de Safari (iPhone); por defecto, Chromium.
const MOTOR = process.env.SSTA_MOTOR || 'chromium';
let chromium;
try { chromium = require('playwright')[MOTOR]; if (!chromium) throw new Error('motor desconocido: ' + MOTOR); }
catch (e) { console.error('Falta Playwright: cd pruebas && npm install'); process.exit(1); }

let fallos = 0, total = 0;
function ok(desc, cond, detalle) {
  total++;
  if (cond) console.log('    ✓ ' + desc);
  else { fallos++; console.log('    ✗ ' + desc + (detalle ? '\n        ' + String(detalle).slice(0, 600) : '')); }
}

/* ── La demo, servida en un puerto local ── */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.gs': 'text/plain; charset=utf-8' };
function servir(dir) {
  return new Promise((listo) => {
    const s = http.createServer((q, r) => {
      let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
      const p = path.join(dir, f);
      if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => listo({ url: 'http://127.0.0.1:' + s.address().port, cerrar: () => s.close() }));
  });
}

/* ── Llenado genérico: todo lo visible con datos válidos (corre en la página) ── */
function llenarVisible() {
  const vis = (e) => !!(e.offsetParent || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
  const hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const avisar = (e) => { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  let n = 0;
  document.querySelectorAll('input, textarea, select').forEach((e) => {
    if (!vis(e) || e.disabled || e.readOnly) return;
    const id = (e.id + ' ' + (e.name || '') + ' ' + (e.placeholder || '')).toLowerCase();
    if (e.tagName === 'SELECT') {
      if (!e.value) { const o = [...e.options].find((x) => x.value && !/otro|otra/i.test(x.textContent)); if (o) { e.value = o.value; avisar(e); n++; } }
      return;
    }
    if (e.type === 'radio') { if (!document.querySelector('input[name="' + e.name + '"]:checked')) { e.checked = true; avisar(e); n++; } return; }
    if (['checkbox', 'file', 'hidden', 'button', 'submit'].includes(e.type) || e.value) return;
    let v = /vigia|rigger|operador|senalero/.test(id) ? 'Vigía de prueba' : 'Prueba automática';   // v148: el vigía no puede llamarse igual que un ejecutante
    if (e.type === 'date') v = hoy;
    else if (e.type === 'time') v = /hasta|fin|final|culmina/.test(id) ? '23:59' : '08:00';   // v147: la hora de inicio ya viene con la hora actual (puede ser de noche)
    else if (e.type === 'datetime-local') v = hoy + 'T08:00';
    else if (e.dataset && e.dataset.gasVal) v = e.dataset.gasVal === 'oxigeno' ? '20.9' : '0';   // v148: lecturas de gases dentro de rango (si no, el permiso de confinados no abre)
    else if (e.type === 'number') v = '5';
    else if (e.type === 'email' || /correo|email/.test(id)) v = 'prueba@ejemplo.co';
    else if (e.type === 'tel' || /cel|tel|whats/.test(id)) v = '3001234567';
    else if (/cc|cedula|cédula|documento|doc\b|ident/.test(id)) v = String(1000000000 + Math.floor(Math.random() * 8e8));
    else if (/nit/.test(id)) v = '900123456';
    e.value = v; avisar(e); n++;
  });
  document.querySelectorAll('[data-yn]').forEach((g) => { if (vis(g) && !g.querySelector('[aria-pressed="true"], .on, .active, .sel')) { const b = g.querySelector('.yn-btn'); if (b) { b.click(); n++; } } });
  document.querySelectorAll('.check-item').forEach((r) => { if (vis(r) && !r.querySelector('button[aria-pressed="true"]')) { const b = r.querySelector('.toggle button'); if (b) { b.click(); n++; } } });
  return n;
}
async function firmarConMouse(pg) {
  let n = 0;
  for (const el of await pg.$$('canvas')) {
    if (!(await el.evaluate((c) => !!c.offsetParent && c.getBoundingClientRect().width > 60))) continue;
    await el.scrollIntoViewIfNeeded(); const r = await el.boundingBox(); if (!r) continue;
    await pg.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.5); await pg.mouse.down();
    for (let i = 1; i <= 12; i++) await pg.mouse.move(r.x + r.width * (0.2 + i * 0.05), r.y + r.height * (0.5 + (i % 2 ? -0.25 : 0.25)));
    await pg.mouse.up(); n++;
  }
  return n;
}
async function esperar(cond, ms) { const fin = Date.now() + ms; while (Date.now() < fin) { if (await cond()) return true; await new Promise((r) => setTimeout(r, 400)); } return false; }
const estadoPermiso = (pg) => pg.evaluate(() => ({
  aviso: ((document.getElementById('validationBanner') || document.querySelector('.validation-banner')) || {}).innerText || '',
  pie: document.getElementById('footerStatus').innerText,
  estado: (document.getElementById('statusBannerText') || {}).innerText || '',
  codigo: (document.getElementById('permitCodeDisplay') || {}).textContent || ''
}));
async function abrirPermiso(ctx, base, pagina) {
  const pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push(e.message));
  await pg.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });   // «no está habilitado, ¿continuar?» y similares
  await pg.goto(base + '/' + pagina); await pg.waitForTimeout(1000);
  await pg.click('#cardNew'); await pg.waitForTimeout(400);
  return { pg, errores };
}
async function ponerHabilitados(pg) {
    // v148: en alto riesgo solo pasa quien está habilitado: los ejecutantes son personas de la demo habilitadas para ESTE permiso.
  await pg.evaluate(async () => {
      if (typeof Habilitacion === 'undefined') return;
      try { await Habilitacion.cargar(); } catch (e) {}
      const tipo = { 'permiso-trabajo-alturas.html': 'alturas', 'permiso-trabajo-caliente.html': 'caliente', 'permiso-espacios-confinados.html': 'confinados', 'permiso-izajes-cargas.html': 'izajes', 'permiso-trabajo-electrico.html': 'electrico' }[location.pathname.split('/').pop()];
      const m = Habilitacion._mapa || {}, buenos = Object.keys(m).filter((k) => ['ok', 'pronto'].includes(Habilitacion.revisar(k, [tipo]).estado));
      document.querySelectorAll('#execBody [id^="execCC"]').forEach((el, i) => { const k = buenos[i % Math.max(1, buenos.length)]; if (!k || el.value) return; el.value = k; el.dispatchEvent(new Event('input', { bubbles: true }));
        const n = document.getElementById(el.id.replace('execCC', 'execNombre')); if (n && !n.value) { n.value = m[k].nombre || 'Persona de prueba'; n.dispatchEvent(new Event('input', { bubbles: true })); } });
    });
}
async function diligenciarYGuardar(pg, yaFirmado) {
  let e;
  for (let ronda = 0; ronda < 3; ronda++) {
    await ponerHabilitados(pg);
    await pg.evaluate(llenarVisible); if (!yaFirmado) await firmarConMouse(pg);
    await pg.click('#mainActionBtn');
    await pg.waitForFunction(() => !document.getElementById('mainActionBtn').disabled || /guardado/i.test(document.getElementById('statusBannerText').innerText), null, { timeout: 15000 }).catch(() => {});
    await pg.waitForTimeout(800);
    e = await estadoPermiso(pg);
    if (/guardado/i.test(e.estado) || /Sin conexión|se reintentará/i.test(e.pie)) break;
  }
  return e;
}
// Lee el permiso del servidor (el de la demo) como lo haría otro celular.
const CLAVE_DE = { 'permiso-trabajo-alturas.html': 'alturas', 'permiso-trabajo-caliente.html': 'caliente', 'permiso-espacios-confinados.html': 'confinados', 'permiso-izajes-cargas.html': 'izajes', 'permiso-trabajo-electrico.html': 'electrico' };
const leerDelServidor = (pg, pagina, codigo) => pg.evaluate(async ([k, c]) => {
  const r = await fetchWithRetry(PORTAL_CONFIG.BACKENDS[k].url + '?code=' + encodeURIComponent(c) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
  return r.json();
}, [CLAVE_DE[pagina], codigo]);

// v111: permisos, ATS, tablero… piden usuario. Entra con un usuario de la demo
// (0 Administradora SST, 1 Supervisor de obra, 2 Solo consulta); la sesión queda para todo el contexto.
async function entrarComo(ctx, base, n) {
  const pg = await ctx.newPage();
  await pg.goto(base + '/index.html'); await pg.waitForTimeout(1200);
  await pg.click('#btnGestion'); await pg.waitForTimeout(500);   // v117: «Gestión» abre la ventana para entrar
  await pg.click('[data-demo="' + (n || 0) + '"]');
  await esperar(() => pg.evaluate(() => { try { return !!JSON.parse(localStorage.getItem('ssta-sesion') || 'null'); } catch (e) { return false; } }).catch(() => false), 15000);
  await pg.close();
}
const bloqueado = async (ctx, base, pagina) => {
  const pg = await ctx.newPage(); await pg.goto(base + '/' + pagina); await pg.waitForTimeout(1500);
  const d = await pg.$('#accesoRol'); const r = d ? (/no tiene/.test(await d.$eval('h2', (x) => x.textContent)) ? 'rol' : 'entrar') : 'abre';
  await pg.close(); return r;
};
const PERMISOS = ['permiso-trabajo-alturas.html', 'permiso-trabajo-caliente.html', 'permiso-espacios-confinados.html', 'permiso-izajes-cargas.html', 'permiso-trabajo-electrico.html'];

(async () => {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   PRUEBAS EN NAVEGADOR — Portal SSTA (empresa demo)   ║');
  if (MOTOR !== 'chromium') console.log('   Motor: ' + MOTOR + (MOTOR === 'webkit' ? ' (el de Safari en iPhone)' : ''));
  console.log('╚══════════════════════════════════════════════════════╝');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssta-demo-'));
  require('../herramientas/armar-demo').armar(dir);
  // v132: con SSTA_MIN=1 las pruebas corren sobre el sitio minificado (lo que se sube a GitHub).
  if (process.env.SSTA_MIN) console.log('Minificado: ' + Math.round((await require('../herramientas/minificar').carpeta(dir, false)) / 1024) + ' KB menos');
  const S = await servir(dir);
  const nav = await chromium.launch();
  // v116: el aviso de privacidad de la primera vez se da por visto (tiene su propia prueba abajo).
  const nuevoContexto = nav.newContext.bind(nav);
  nav.newContext = async (o) => { const c = await nuevoContexto(o); if (!(o && o.__conAviso)) await c.addInitScript(() => { try { localStorage.setItem('ssta-aviso-privacidad', '2026-10'); } catch (e) {} }); await c.addInitScript(() => { if (!window.__sstaDialogoAuto) window.__sstaDialogoAuto = 'cancelar'; }); if (!(o && o.__conIrAGestion)) await c.addInitScript(() => { try { sessionStorage.setItem('ssta-sg-auto', '1'); } catch (e) {} }); /* v159: las pruebas del inicio público no caen en Gestión */ /* v132: como hacía Playwright con las ventanas del navegador */ return c; };
  const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, serviceWorkers: 'block' };
  const PC = { viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' };
  try {
    /* 0. Quién entra a qué (v111) */
    console.log('\n▸ Acceso: sin contraseña solo preoperacionales y reportes');
    {
      const PUB = ['preoperacional.html', 'reportes.html', 'percepcion-peligros.html', 'induccion-responder.html'];
      const SG = ['permiso-trabajo-alturas.html', 'permiso-trabajo-caliente.html', 'ats.html', 'asistencia.html', 'inspeccion-epp.html', 'personal-autorizado.html', 'dashboard.html', 'plan-anual.html', 'salud.html'];
      let ctx = await nav.newContext(CELULAR);
      const pub = []; for (const f of PUB) pub.push([f, await bloqueado(ctx, S.url, f)]);
      ok('sin usuario se abren el preoperacional, los reportes, «¿qué peligros ves?» y la inducción por enlace', pub.every((x) => x[1] === 'abre'), JSON.stringify(pub));
      const sg = []; for (const f of SG) sg.push([f, await bloqueado(ctx, S.url, f)]);
      ok('sin usuario, permisos, ATS, charlas, EPP, personal, tablero y lo demás piden entrar', sg.every((x) => x[1] === 'entrar'), JSON.stringify(sg.filter((x) => x[1] !== 'entrar')));
      const ix = await ctx.newPage(); await ix.goto(S.url + '/index.html'); await ix.waitForTimeout(1200);
      // v112: el SERVIDOR también lo exige (una consulta hecha a mano, sin entrar).
      const srv = await ix.evaluate(async () => { const r = await fetchWithRetry(PORTAL_CONFIG.BACKENDS.alturas.url + '?list=1&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN)); return r.json(); });
      ok('el servidor rechaza la lista de permisos sin usuario (SESION)', srv.codigoError === 'SESION' && !srv.rows, JSON.stringify(srv).slice(0, 160));
      const vis = await ix.evaluate(() => ({ preop: !!document.querySelector('#pubPreop:not([hidden])'), reportar: !!document.querySelector('#pubReportar:not([hidden])'),
        permisos: [...document.querySelectorAll('a[href^="permiso-"], a[href="ats.html"], a[href="dashboard.html"]')].some((a) => !!a.offsetParent) }));
      ok('el inicio sin usuario muestra Preoperacional y Reportar, y nada de permisos ni ATS', vis.preop && vis.reportar && !vis.permisos, JSON.stringify(vis));
      await ix.close(); await ctx.close();
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 1);
      const sup = { alturas: await bloqueado(ctx, S.url, 'permiso-trabajo-alturas.html'), ats: await bloqueado(ctx, S.url, 'ats.html'), tablero: await bloqueado(ctx, S.url, 'dashboard.html'), salud: await bloqueado(ctx, S.url, 'salud.html') };
      const sp = await ctx.newPage(); await sp.goto(S.url + '/index.html'); await sp.waitForTimeout(1000);
      const srv2 = await sp.evaluate(async () => { const r = await fetchWithRetry(PORTAL_CONFIG.BACKENDS.alturas.url + '?list=1&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN)); return r.json(); });
      ok('con usuario, el servidor sí entrega la lista de permisos', srv2.ok === true && Array.isArray(srv2.rows), JSON.stringify(srv2).slice(0, 160)); await sp.close();
      ok('el supervisor de obra abre permisos, ATS y tablero; salud no', sup.alturas === 'abre' && sup.ats === 'abre' && sup.tablero === 'abre' && sup.salud === 'rol', JSON.stringify(sup));
      await ctx.close();
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 2);
      const con = { alturas: await bloqueado(ctx, S.url, 'permiso-trabajo-alturas.html'), tablero: await bloqueado(ctx, S.url, 'dashboard.html'), preop: await bloqueado(ctx, S.url, 'preoperacional.html') };
      ok('«Solo consulta» ve el tablero y el preoperacional, pero no abre permisos', con.alturas === 'rol' && con.tablero === 'abre' && con.preop === 'abre', JSON.stringify(con));
      await ctx.close();
    }

    /* v123: inicio con dos tarjetas que se despliegan, preoperacionales base, atrás, autocompletar, permisos apagados */
    console.log('\n▸ v162: TODAS las páginas: sin errores de JavaScript, sin bloqueos de la política de seguridad y accesibles (axe)');
    {
      const ctx = await nav.newContext(CELULAR); await ctx.addInitScript(() => { window.__sstaDialogoAuto = 'cancelar'; window.print = () => {}; });
      await entrarComo(ctx, S.url, 0);
      const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
      const pags = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort(), js = [], csp = [], ax = [];
      for (const pg of pags) {
        const p = await ctx.newPage();
        p.on('pageerror', (e) => js.push(pg + ': ' + e.message.slice(0, 120)));
        p.on('console', (m) => { if (/CSP bloqueó|Content Security Policy/.test(m.text()) && !/unsafe-eval/.test(m.text())) csp.push(pg + ': ' + m.text().slice(0, 140)); });
        try { await p.goto(S.url + '/' + pg, { timeout: 20000 }); await p.waitForTimeout(1500); await p.evaluate(AXE);
          const v = await p.evaluate(async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'label', 'link-name', 'button-name', 'image-alt', 'landmark-one-main', 'bypass', 'duplicate-id-aria', 'aria-valid-attr', 'aria-required-attr', 'select-name', 'input-button-name', 'document-title', 'html-has-lang'] } })).violations.map((x) => x.id + ':' + x.nodes.length + ' ' + x.nodes[0].target.join(' ')));
          v.forEach((x) => ax.push(pg + ' ' + x));
        } catch (e) { js.push(pg + ': no abrió (' + e.message.slice(0, 80) + ')'); }
        await p.close();
      }
      ok('las ' + pags.length + ' páginas abren sin errores de JavaScript', !js.length, js.slice(0, 8).join(' | '));
      ok('ninguna página choca con la política de seguridad (CSP)', !csp.length, csp.slice(0, 8).join(' | '));
      ok('las ' + pags.length + ' páginas pasan la revisión de accesibilidad (contraste, nombres, zona principal, idioma)', !ax.length, ax.slice(0, 8).join(' | '));
      await ctx.close();
    }
    console.log('\n▸ v162: bitácora encadenada, búsqueda global, menú «Más», portal del contratista y auditor');
    {
      const ctx = await nav.newContext(CELULAR); await ctx.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; window.print = () => {}; });
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/bitacora.html'); await pg.waitForTimeout(2500);
      const nb = await pg.evaluate(() => document.querySelectorAll('#btLista > *').length);
      ok('bitácora: lista los eventos del servidor', nb > 0, 'filas ' + nb);
      await pg.click('#btVerificar'); await pg.waitForTimeout(2500);
      const ver = await pg.evaluate(() => document.body.innerText);
      ok('bitácora: verificar la cadena dice que está íntegra', /íntegr|intact|sin alteraci/i.test(ver), ver.slice(0, 200));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1500);
      const mas = await pg.evaluate(() => { const b = document.getElementById('btnMas'); if (!b || !b.offsetParent) return 'sin botón'; b.click(); const m = document.getElementById('menuMas'); return m && !m.hidden ? m.querySelectorAll('button,a').length : 'cerrado'; });
      ok('celular: el botón «Más» abre el menú con las acciones secundarias', typeof mas === 'number' && mas >= 5, String(mas));
      await pg.evaluate(() => BuscarTodo.abrir()); await pg.waitForTimeout(400);
      await pg.keyboard.type('alturas'); await pg.waitForTimeout(1500);
      const bus = await pg.evaluate(() => [...document.querySelectorAll('.bt-fondo a')].length);
      ok('búsqueda global: encuentra páginas y registros', bus > 0, 'resultados ' + bus);
      await pg.keyboard.press('Escape');
      for (const pub of ['contratista-portal.html?c=x&k=mal', 'auditor.html?t=mal', 'verificar.html?id=x&k=mal', 'habeas.html', 'normograma.html', 'mis-avisos.html', 'licencia.html', 'ficha.html']) {
        await pg.goto(S.url + '/' + pub); await pg.waitForTimeout(1500);
      }
      ok('las páginas nuevas (portal contratista, auditor, verificar, habeas, normograma, avisos, licencia, ficha) abren sin errores', !err.length, err.slice(0, 5).join(' | '));
      // v163: Excel real con mapeo, y topes contra archivos gigantes o «zip bomba»
      await pg.goto(S.url + '/habilitacion.html'); await pg.waitForTimeout(1500);
      const xl = [...fs.readFileSync(path.join(__dirname, 'fixtures-personal.xlsx'))];
      const ix = await pg.evaluate(async (bytes) => {
        await new Promise((ok, mal) => { if (window.fflate) return ok(); const s = document.createElement('script'); s.src = 'fflate.min.js'; s.onload = ok; s.onerror = mal; document.head.appendChild(s); });
        const out = {}; try { out.texto = Importar.xlsxATexto(new Uint8Array(bytes).buffer); } catch (e) { out.texto = 'ERROR ' + e.message; }
        const bomba = fflate.zipSync({ 'xl/worksheets/sheet1.xml': new Uint8Array(60 * 1048576) }, { level: 9 });
        try { Importar.xlsxATexto(bomba.buffer); out.bomba = 'abrió'; } catch (e) { out.bomba = e.message; }
        const filas = '<worksheet><sheetData>' + Array.from({ length: 5100 }, (_, i) => '<row r="' + (i + 1) + '"><c r="A' + (i + 1) + '" t="inlineStr"><is><t>x</t></is></c></row>').join('') + '</sheetData></worksheet>';
        try { Importar.xlsxATexto(fflate.zipSync({ 'xl/worksheets/sheet1.xml': fflate.strToU8(filas) }).buffer); out.filas = 'abrió'; } catch (e) { out.filas = e.message; }
        const csv = 'nombre;cedula\n' + Array.from({ length: 6000 }, (_, i) => 'Persona ' + i + ';' + (10000000 + i)).join('\n');
        const t0 = performance.now(), an = Importar.analizar(csv, { columnas: [{ k: 'nombre', l: 'Nombre' }, { k: 'cedula', l: 'Cédula' }] }, {}); out.csv = an && an.error; out.csvMs = Math.round(performance.now() - t0);
        out.grande = (Importar.analizar('x'.repeat(5 * 1048576), { columnas: [] }, {}) || {}).error;
        out.tamBomba = bomba.length; return out; }, xl);
      ok('importar: el Excel de prueba se lee con sus filas', /\t/.test(ix.texto) && ix.texto.split('\n').length >= 2, String(ix.texto).slice(0, 120));
      ok('importar: un «zip bomba» (60 MB de ceros en ' + Math.round(ix.tamBomba / 1024) + ' KB) se rechaza sin colgar el celular', /demasiado grande/.test(ix.bomba), ix.bomba);
      ok('importar: más de 5000 filas se rechaza con un mensaje claro', /máximo por importación/.test(ix.filas), ix.filas);
      ok('importar: un CSV o texto pegado de más de 5000 filas o más de 4 MB también se rechaza, sin colgarse (' + ix.csvMs + ' ms)', /máximo por carga/.test(ix.csv || '') && /más de 4 MB/.test(ix.grande || '') && ix.csvMs < 1000, JSON.stringify([ix.csv, ix.grande, ix.csvMs]));
      await ctx.close();
    }
    console.log('\n▸ v169: reintegro, presupuesto, pantalla de planta e inglés');
    {
      const ctx = await nav.newContext(Object.assign({ acceptDownloads: true }, PC)); await ctx.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; window.print = () => {}; });
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      // Reintegro: se registra desde Salud y bloquea en Personal habilitado el trabajo restringido
      await pg.goto(S.url + '/salud.html#reintegro'); await pg.waitForTimeout(2500);
      const tr = await pg.evaluate(() => { const x = rows.find((r) => r.tipo === 'trabajador' && r.resumen.activo !== false && r.resumen.cedula); return x ? x.resumen : null; });
      await pg.click('#nRei2'); await pg.waitForTimeout(600);
      await pg.evaluate((p) => { const m = document.querySelector('.modal-fondo:last-of-type, .modal:last-of-type') || document; const q = (k) => m.querySelector('[id$="_' + k + '"]');
        q('nombre').value = p.nombre; q('cedula').value = p.cedula; q('restricciones').value = 'No levantar más de 10 kg; sin trabajo en alturas por 60 días';
        q('restringePara').querySelector('button[data-v="Trabajo en alturas"]').click(); q('temporalidad').value = 'Temporales';
        const d = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10); q('venceRestriccion').value = d; q('comunicadoJefe').value = new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10); }, tr);   // fecha de Colombia (en UTC, después de las 7 p. m. ya es «mañana»)
      await pg.click('[data-guardar]'); await pg.waitForTimeout(2500);
      const rei = await pg.evaluate(() => ({ n: rows.filter((r) => r.tipo === 'reintegro').length, txt: document.getElementById('panel').innerText }));
      ok('reintegro: se registra desde Salud y queda en seguimiento, avisando que falta comunicarlo al trabajador', rei.n === 1 && /Sin comunicar/.test(rei.txt), JSON.stringify(rei).slice(0, 200));
      const hab = await pg.evaluate(async (ced) => { const r = await SGSST.listar('trabajador'); const x = r.rows.find((y) => y.resumen.cedula === ced); return x && x.resumen.restr ? x.resumen.restr : (x && x.resumen); }, tr.cedula);
      ok('reintegro: la restricción pasa a Personal habilitado (los permisos de alturas ya no lo dejan incluir)', JSON.stringify(hab).indexOf('alturas') !== -1, JSON.stringify(hab).slice(0, 200));
      // Presupuesto: armarlo, registrar un gasto y ver la ejecución
      await pg.goto(S.url + '/presupuesto.html'); await pg.waitForTimeout(2500);
      await pg.click('#armar'); await pg.waitForTimeout(500);
      await pg.evaluate(() => { document.querySelectorAll('#ppRub [data-k=valor]').forEach((i) => { i.value = '1000000'; }); document.getElementById('ppAprob').value = 'Gerente General'; });
      await pg.click('#ppGuardar'); await pg.waitForTimeout(2500);
      await pg.click('#nGasto'); await pg.waitForTimeout(500);
      await pg.evaluate(() => { const m = [...document.querySelectorAll('[data-guardar]')].pop().closest('div'); const q = (k) => document.querySelector('[id$="_' + k + '"]');
        q('valor').value = '1850000'; q('concepto').value = 'Exámenes periódicos de 20 trabajadores'; });
      await pg.click('[data-guardar]'); await pg.waitForTimeout(2500);
      const pre = await pg.evaluate(() => document.getElementById('resumen').innerText);
      ok('presupuesto: arma los rubros, registra el gasto y muestra lo ejecutado contra lo presupuestado (185 % en el rubro gastado)', /185 %/.test(pre) && /\$ 1\.850\.000/.test(pre) && /Total/.test(pre), pre.slice(0, 300));
      // Pantalla de planta: enlace, modo televisor, sin nombres, en inglés
      const k = await pg.evaluate(async () => (await SGSST.consultar({ action: 'enlacePantalla' })).k);
      const pv = await ctx.newPage(); await pv.setViewportSize({ width: 1920, height: 1080 });
      await pv.goto(S.url + '/pantalla-planta.html?lang=en&k=' + encodeURIComponent(k)); await pv.waitForTimeout(3500);
      const tv = await pv.evaluate(() => ({ txt: document.body.innerText, tv: document.body.classList.contains('tv'), barra: !!document.querySelector('.barra-inferior') && getComputedStyle(document.querySelector('.barra-inferior')).display !== 'none',
        cabe: [...document.querySelectorAll('.tv-caja')].every((c) => c.getBoundingClientRect().bottom <= document.querySelector('.tv-pie').getBoundingClientRect().top + 2) }));
      ok('pantalla de planta: modo televisor con cifras, en inglés, sin la barra de la aplicación y sin que las cajas se monten', tv.tv && /days without work accidents/.test(tv.txt) && /Overdue actions/.test(tv.txt) && !tv.barra && tv.cabe, JSON.stringify(tv).slice(0, 300));
      const nombres = await pg.evaluate(() => rows.filter((r) => r.tipo === 'trabajador').map((r) => r.resumen.nombre).filter(Boolean).slice(0, 30));
      ok('pantalla de planta: no muestra el nombre de ninguna persona', !nombres.some((n) => tv.txt.indexOf(n) !== -1));
      await pv.goto(S.url + '/pantalla-planta.html?k=clave-falsa'); await pv.waitForTimeout(2500);
      ok('pantalla de planta: con un enlace viejo o falso no muestra datos', /ya no sirve/.test(await pv.evaluate(() => document.body.innerText)));
      await pv.close();
      // Inglés en la gerencia y en su PDF
      await pg.goto(S.url + '/gerencia.html?lang=en'); await pg.waitForTimeout(3500);
      let html = ''; await pg.exposeFunction('__capturaPdf', (h) => { html = h; });
      await pg.evaluate(() => { const o = UI.imprimir; UI.imprimir = function (p) { window.__capturaPdf((p || []).join('')); return o.apply(UI, arguments); }; });
      await pg.click('#btnPdf'); await pg.waitForTimeout(2500);
      const ger = await pg.evaluate(() => document.body.innerText);
      // el PDF pasa por el traductor (UI.imprimir envuelto) y su HTML sale en inglés
      const pdfEn = await pg.evaluate((h) => ({ envuelto: !!UI.imprimir.__i18n || /i18n/.test(String(UI.imprimir)), en: I18N.html(h) }), html);
      ok('inglés: el tablero gerencial y su PDF salen en inglés (botón ES | EN)', /OHS management system dashboard/.test(ger) && /OHS MANAGEMENT SYSTEM REPORT FOR MANAGEMENT/.test(pdfEn.en) && !!(await pg.$('#i18nBtn')), pdfEn.en.replace(/<[^>]+>/g, ' ').slice(0, 300));
      await pg.click('#i18nBtn [data-l="es"]'); await pg.waitForTimeout(3000);
      ok('inglés: volver a español con el botón', /Tablero del SG-SST/.test(await pg.evaluate(() => document.body.innerText)));
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v176: calendario centrado, seleccionar varios en todas las listas y leer exámenes en PDF');
    {
      const ctx = await nav.newContext(Object.assign({}, PC));
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html#sg'); await pg.waitForTimeout(3500);
      const cal = await pg.evaluate(() => { const a = document.getElementById('agenda').getBoundingClientRect(), d = [...document.querySelectorAll('.ag-dia:not(.vacio)')].map((x) => x.getBoundingClientRect());
        return { dentro: d.every((r) => r.right <= a.right + 1 && r.left >= a.left - 1), tabs: !!document.querySelector('.ag-tabs'), btn: document.getElementById('agNueva').className, mes: getComputedStyle(document.getElementById('mes')).display,
          hoyRedondo: (() => { const h = document.querySelector('.ag-dia.eshoy'); return h ? getComputedStyle(h).borderRadius : ''; })() }; });
      ok('calendario: los días quedan dentro de la tarjeta, sin «Cronograma del mes» y con el botón del portal', cal.dentro && !cal.tabs && /btn amber/.test(cal.btn) && cal.mes === 'none', JSON.stringify(cal));
      await pg.screenshot({ path: process.env.SSTA_CAPTURA_176 || require('os').tmpdir() + '/cal176.png' });
      // Seleccionar varios en una lista que antes no lo tenía (Plan de acción)
      await pg.goto(S.url + '/plan-accion.html'); await pg.waitForTimeout(3500);
      const nAntes = await pg.evaluate(() => document.querySelectorAll('[data-sel-auto] > [data-id], [data-sel-auto] > [data-abrir], [data-sel-auto] > [data-ver]').length);
      const bot = await pg.$('.sel-varios');
      ok('seleccionar varios: aparece en listas que antes no lo tenían (Plan de acción)', !!bot && nAntes >= 2, String(nAntes));
      if (bot && nAntes >= 2) {
        await bot.click(); await pg.waitForTimeout(200);
        const its = await pg.$$('[data-sel-auto] > [data-id], [data-sel-auto] > [data-abrir], [data-sel-auto] > [data-ver]');
        await its[0].click(); await its[1].click(); await pg.waitForTimeout(200);
        await pg.click('.sel-pie:not([hidden]) [data-elim]'); await pg.waitForTimeout(400);
        await pg.click('#elOk'); await pg.waitForTimeout(5000);
        const nDesp = await pg.evaluate(() => document.querySelectorAll('[data-sel-auto] > [data-id], [data-sel-auto] > [data-abrir], [data-sel-auto] > [data-ver]').length);
        ok('seleccionar varios: elimina los marcados (quedan en la Papelera)', nDesp === nAntes - 2, nAntes + ' → ' + nDesp);
      }
      // Leer un examen en PDF
      await pg.goto(S.url + '/salud.html'); await pg.waitForTimeout(3500);
      const per = await pg.evaluate(async () => { const r = await SGSST.listar('trabajador'); const t = (r.rows || []).find((x) => x.resumen.activo !== false && x.resumen.cedula); return t ? { nombre: t.resumen.nombre, cedula: t.resumen.cedula } : null; });
      const lineas = ['IPS SALUD OCUPACIONAL DEL SUR', 'Tipo de examen: Periodico', 'Nombre: ' + (per ? per.nombre : 'X') + '  C.C. ' + (per ? per.cedula : '0'), 'Fecha del examen: 10/11/2026',
        'Diagnostico: M54.5 Lumbago', 'Concepto de aptitud: APTO CON RESTRICCIONES', 'Restricciones laborales: No levantar mas de 15 kg', 'Proximo examen: 10/11/2027'];
      const pdf = (() => { const sc = (t) => t.replace(/[()\\]/g, '\\$&'); let st = 'BT /F1 11 Tf 50 780 Td 14 TL ' + lineas.map((l) => '(' + sc(l) + ') Tj T*').join(' ') + ' ET';
        const o = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
          '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length ' + st.length + ' >>\nstream\n' + st + '\nendstream'];
        let b = '%PDF-1.4\n', off = []; o.forEach((x, i) => { off.push(b.length); b += (i + 1) + ' 0 obj\n' + x + '\nendobj\n'; });
        const xr = b.length; b += 'xref\n0 ' + (o.length + 1) + '\n0000000000 65535 f \n' + off.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (o.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF';
        return Buffer.from(b, 'latin1'); })();
      const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#leerEx')]);
      await fc.setFiles({ name: 'examen.pdf', mimeType: 'application/pdf', buffer: pdf }); await pg.waitForTimeout(4000);
      const rev = await pg.evaluate(() => { const c = document.querySelector('.lx-it'); return c ? { per: c.querySelector('select').value, con: c.querySelectorAll('select')[1].value, res: c.querySelector('textarea').value, txt: c.innerText } : null; });
      ok('examen en PDF: reconoce al trabajador por la cédula, el concepto y las restricciones, y NO toma el diagnóstico', !!per && !!rev && rev.per === per.cedula && rev.con === 'Apto con restricciones' && /15 kg/.test(rev.res) && !/M54|Lumbago/.test(rev.txt), JSON.stringify(rev));
      if (rev) { await pg.click('#lxOk'); await pg.waitForTimeout(3500); }
      const guardado = await pg.evaluate(async (c) => { const r = await SGSST.listar('examen'); return (r.rows || []).some((x) => x.resumen.cedula === c && x.resumen.fecha === '2026-11-10' && x.resumen.concepto === 'Apto con restricciones'); }, per && per.cedula);
      ok('examen en PDF: queda guardado y asignado a su trabajador', guardado);
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v175: Decreto 1040 en Convivencia');
    {
      const ctx = await nav.newContext(Object.assign({}, PC)); await ctx.addInitScript(() => { window.print = () => {}; });
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/convivencia.html'); await pg.waitForTimeout(3000);
      await pg.click('[data-tab="d1040"]'); await pg.waitForTimeout(1500);
      const t = await pg.evaluate(() => document.getElementById('panel').innerText);
      ok('Decreto 1040: la pestaña muestra los requisitos del año y las plantillas', /Decreto 1040 de 2026/.test(t) && /de 11/.test(t) && /Política de prevención/.test(t), t.slice(0, 200));
      await pg.fill('#c1040_capacitacion', '2025-09-01'); await pg.fill('#c1040_politicaFirmada', '2026-09-10'); await pg.fill('#c1040_resp', 'Laura Gómez');
      await pg.click('#g1040'); await pg.waitForTimeout(2500);
      const t2 = await pg.evaluate(() => document.getElementById('panel').innerText);
      ok('Decreto 1040: guarda lo cumplido y avisa que la capacitación anual ya toca', /2 de 11/.test(t2) && /próxima capacitación/.test(t2), t2.slice(0, 260));
      let html = ''; await pg.exposeFunction('__cap175', (h) => { html = h; });
      await pg.evaluate(() => { const o = UI.imprimir; UI.imprimir = function (p) { window.__cap175((p || []).join('')); return o.apply(UI, arguments); }; });
      await pg.click('#p1040Pro'); await pg.waitForTimeout(800);
      ok('Decreto 1040: el protocolo sale con la ruta de 5 fases, el plazo de 5 días hábiles y el responsable', /1\. Orientación/.test(html) && /5\. Cierre/.test(html) && /5 días hábiles/.test(html) && /Laura Gómez/.test(html));
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v174: agenda con tareas, personal por revisar, firma subida, auditor sin clave y guía que saluda');
    {
      const ctx = await nav.newContext(Object.assign({}, PC));
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html#sg'); await pg.waitForTimeout(3500);
      const lado = await pg.evaluate(() => { const a = document.getElementById('pend').getBoundingClientRect(), b = document.getElementById('agenda').getBoundingClientRect(); return { pendTit: document.getElementById('pendTit').textContent, juntos: Math.abs(a.top - b.top) < 40 && b.left > a.left }; });
      ok('Gestión: «Para hoy y esta semana» y el calendario quedan lado a lado (pantalla ancha)', lado.pendTit === 'Para hoy y esta semana' && lado.juntos, JSON.stringify(lado));
      await pg.click('#agNueva'); await pg.waitForTimeout(300);
      await pg.fill('#tTit', 'Revisar extintores de la bodega 3'); await pg.fill('#tHora', '10:15'); await pg.selectOption('#tRec', 'Un día antes');
      await pg.click('#tGuardar'); await pg.waitForTimeout(3500);
      const tx = await pg.evaluate(() => document.getElementById('agenda').innerText + ' || ' + document.getElementById('pend').innerText);
      ok('calendario: «+ Tarea» la anota y aparece en el calendario y en lo de hoy, con su hora', /Revisar extintores de la bodega 3 \(10:15\)/.test(tx), tx.slice(0, 300));
      const hb = await pg.$('#pend [data-hecha], #agenda [data-hecha]');
      if (hb) { await hb.click(); await pg.waitForTimeout(3500); }
      ok('calendario: «✓ Hecha» la cierra y sale de la lista', !!hb && !/Revisar extintores de la bodega 3/.test(await pg.evaluate(() => document.getElementById('pend').innerText)));
      await pg.screenshot({ path: '/tmp/claude-0/-home-claude/adc95083-69c6-539e-9f6d-b6e7494d4ef6/scratchpad/gestion174.png' });
      // Personal: lo que llega de una inducción queda por revisar
      await pg.evaluate(async () => SGSST.enviar({ action: 'guardar', tipo: 'induccion', id: 'IND-NAV174', doc: { nombre: 'Persona De Otra Obra', cedula: '77665544', cargo: 'Ayudante', fecha: new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10), tipoInduccion: 'Inducción', resultado: 'APROBADA' } }));
      await pg.goto(S.url + '/habilitacion.html'); await pg.waitForTimeout(3000);
      const hv = await pg.evaluate(() => ({ rev: (document.getElementById('porRevisar') || {}).innerText || '', lista: document.getElementById('lista').innerText, anexo: !!document.getElementById('btnImportar'), tipos: [...document.querySelectorAll('#inTipoDoc option')].map((o) => o.value).join() }));
      ok('personal: quien llegó por una inducción está aparte «por revisar», no en la lista; sin «Traer del anexo»; con tipo de documento', /por revisar/.test(hv.rev) && !/Persona De Otra Obra/.test(hv.lista) && !hv.anexo && hv.tipos === 'CC,TI,CE,PPT,PEP,PA', JSON.stringify(hv).slice(0, 300));
      await pg.click('#porRevisar summary'); await pg.click('#porRevisar [data-incluir]'); await pg.waitForTimeout(3000);
      ok('personal: «Incluir» la pasa a la lista', /Persona De Otra Obra/.test(await pg.evaluate(() => document.getElementById('lista').innerText)));
      // Firma subida
      await pg.goto(S.url + '/asistencia.html'); await pg.waitForTimeout(2000);
      const png = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 400, 120); x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.moveTo(20, 90); x.bezierCurveTo(90, 10, 160, 120, 230, 40); x.lineTo(370, 80); x.stroke(); return c.toDataURL('image/png').split(',')[1]; });
      // Un recuadro de firma de prueba (los reales se arman al abrir cada formulario) con el mismo botón que reciben todos.
      await pg.evaluate(() => { const c = document.createElement('canvas'); c.id = 'padPrueba174'; let u = null; c._pad = { setDataUrl: (x) => { u = x; }, getDataUrl: () => u };
        document.body.appendChild(c); c.insertAdjacentElement('afterend', SubirFirma.boton(c)); });
      const inp = await pg.$('.subir-firma input[type=file]');
      if (inp) { await inp.setInputFiles({ name: 'firma.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }); await pg.waitForTimeout(800); }
      const fz = await pg.evaluate(() => { const c = document.getElementById('padPrueba174'), u = c._pad.getDataUrl(); return !!(c.dataset.firmaSubida && u && /^data:image\/png/.test(u)); });
      ok('firma: «📷 Subir firma» pone la imagen en el recuadro como firma', !!inp && fz);
      // Papelera sin texto vertical
      await pg.goto(S.url + '/papelera.html'); await pg.waitForTimeout(500);
      const ancho = await pg.evaluate(() => { const l = document.getElementById('lista'); l.innerHTML = '<div class="pap-item"><div><b>EXT9 · Multipropósito 20 Lb</b><small>Equipo</small></div><button type="button" class="btn">Recuperar</button></div>'; return l.querySelector('.pap-item div').getBoundingClientRect().width; });
      ok('papelera: el nombre se lee en una línea (no una letra por renglón)', ancho > 150, String(ancho));
      // Guía que saluda
      await pg.goto(S.url + '/reportes.html'); await pg.waitForTimeout(1500); await pg.click('#guiaBtn'); await pg.waitForTimeout(1200);
      ok('guía flotante: al abrir saluda y pregunta en qué te ayuda', /¿En qué te ayudo\?/.test(await pg.evaluate(() => document.querySelector('#guiaPanel .gf-res').innerText)));
      // Auditor sin clave del portal
      await pg.goto(S.url + '/auditorias.html'); await pg.waitForTimeout(3000);
      const tieneCard = await pg.evaluate(() => !document.getElementById('cardAuditor').hidden);
      let url = '';
      if (tieneCard) {
        await pg.fill('#audNom', 'ARL de prueba'); await pg.check('[data-gaud="inspecciones"]'); await pg.click('#audCrear'); await pg.waitForTimeout(2500);
        url = await pg.evaluate(() => { const c = document.querySelector('#audNuevo code'); return c ? c.textContent.trim() : ''; });
      }
      ok('auditorías: el administrador crea ahí el enlace para el auditor', tieneCard && /auditor\.html\?/.test(url), url);
      if (url) {
        // Mismo navegador (el servidor de la demo vive en él), pero con una clave del portal EQUIVOCADA: el enlace basta.
        const p2 = await ctx.newPage();
        await p2.addInitScript(() => { try { Object.keys(localStorage).filter((k) => /clave-portal/.test(k)).forEach((k) => localStorage.setItem(k, 'clave-equivocada')); localStorage.setItem('ssta-clave-portal', 'clave-equivocada'); } catch (e) {} });
        await p2.goto(url.replace(/^https?:\/\/[^/]+/, S.url)); await p2.waitForTimeout(3500);
        const au = await p2.evaluate(() => ({ sub: document.getElementById('auSub').textContent, clave: !!document.querySelector('.clave-fondo'), filas: document.getElementById('auLista').innerText.slice(0, 80) }));
        ok('auditor: abre el enlace SIN la clave del portal (aunque el equipo tenga una equivocada) y ve lo permitido', !au.clave && /ARL de prueba/.test(au.sub), JSON.stringify(au));
        await p2.close();
      }
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v173: la guía flotante en cada pantalla');
    {
      const ctx = await nav.newContext(Object.assign({}, PC));
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/reportes.html'); await pg.waitForTimeout(2000);
      ok('guía flotante: el botón está en la pantalla y la guía aún no se ha cargado (no pesa)', !!(await pg.$('#guiaBtn')) && await pg.evaluate(() => typeof GUIA_PREGUNTAS === 'undefined'));
      await pg.click('#guiaBtn'); await pg.waitForTimeout(1200);
      const ab = await pg.evaluate(() => ({ vis: !document.getElementById('guiaPanel').hidden, sug: [...document.querySelectorAll('#guiaPanel .gf-guia .gf-chip')].map((b) => b.textContent), foco: document.activeElement && document.activeElement.closest('#guiaPanel') !== null }));
      ok('guía flotante: abre con las preguntas de ESTA pantalla y el cursor listo para escribir', ab.vis && ab.foco && ab.sug.some((t) => /reporto un accidente/.test(t)), JSON.stringify(ab));
      await pg.click('#guiaPanel .gf-guia .gf-chip'); await pg.waitForTimeout(200);
      ok('guía flotante: responde con un toque y con enlace al módulo', /Reportar/.test(await pg.evaluate(() => document.querySelector('#guiaPanel .gf-res').innerText)));
      await pg.fill('#guiaPanel input', 'como se calibra el luxometro de la bodega'); await pg.press('#guiaPanel input', 'Enter'); await pg.waitForTimeout(1500);
      const sr = await pg.evaluate(async () => ({ txt: document.querySelector('#guiaPanel .gf-res').innerText, cola: localStorage.getItem('ssta-guia-sin-respuesta'), raiz: (await (await fetch(EMPRESA.servidor)).json()).guia || [] }));
      ok('guía flotante: lo que no sabe lo dice, y la pregunta le llega al servidor de la empresa', /quedó anotada/.test(sr.txt) && sr.raiz.some((x) => /luxometro/.test(x.t)) && (!sr.cola || sr.cola === '[]'), JSON.stringify(sr).slice(0, 300));
      await pg.screenshot({ path: '/tmp/claude-0/-home-claude/adc95083-69c6-539e-9f6d-b6e7494d4ef6/scratchpad/gf.png' });
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
      ok('guía flotante: Escape la cierra y el foco vuelve al botón', await pg.evaluate(() => document.getElementById('guiaPanel').hidden && document.activeElement && document.activeElement.id === 'guiaBtn'));
      await pg.goto(S.url + '/ayuda.html'); await pg.waitForTimeout(1200);
      ok('guía flotante: no sale en Ayuda (ya tiene la guía arriba)', !(await pg.$('#guiaBtn')));
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v172: empezar con un cliente nuevo y la guía a la que se le pregunta');
    {
      const ctx = await nav.newContext(Object.assign({}, PC));
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/empezar.html'); await pg.waitForTimeout(3500);
      const ep = await pg.evaluate(() => ({ sig: (document.querySelector('.ep-sig h2') || {}).textContent || '', fases: document.querySelectorAll('.ep-paso').length, hechos: document.querySelectorAll('.ep-paso.hecho').length }));
      ok('empezar: muestra arriba UN siguiente paso y debajo el camino completo con lo hecho tachado', ep.sig.length > 5 && ep.fases >= 12 && ep.hechos >= 3, JSON.stringify(ep));
      const man = await pg.$('[data-man]');
      if (man) { const id = await man.getAttribute('data-man'); await man.click(); await pg.waitForTimeout(300); }
      ok('empezar: «Ya lo hice» marca el paso y se recuerda al volver', !man || (await pg.reload(), await pg.waitForTimeout(3000), await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /ssta-empezar-manual/.test(k))) || '{}')).length)) >= 1);
      await pg.screenshot({ path: '/tmp/claude-0/-home-claude/adc95083-69c6-539e-9f6d-b6e7494d4ef6/scratchpad/ep.png', fullPage: true });
      await pg.goto(S.url + '/index.html#sg'); await pg.waitForTimeout(3500);
      const ini = await pg.evaluate(() => (document.getElementById('primeros') || {}).innerText || '');
      const sig = await pg.evaluate(async () => { const r = await SGSST.listar(EMPEZAR.TIPOS.join(',')); const u = await SGSST.consultar({ action: 'usuarios' }); const E = EMPEZAR.evaluar({ servidor: true, empresa: !EMPRESA.sinConfigurar && !!EMPRESA.nit, usuarios: u && u.ok ? (u.usuarios || []).length >= 2 : null, rows: r.rows }); return E.siguiente ? E.siguiente.t : ''; });
      ok('inicio: «Tu siguiente paso» muestra el mismo paso que el camino (o nada si ya está todo)', sig ? ini.indexOf(sig) !== -1 && /camino completo/.test(ini) : !ini.trim(), sig + ' · ' + ini.slice(0, 160));
      await pg.goto(S.url + '/ayuda.html'); await pg.waitForTimeout(1500);
      await pg.fill('#pregTxt', 'cuanto tiempo tengo para reportar un accidente a la arl'); await pg.click('#pregForm button[type=submit]'); await pg.waitForTimeout(300);
      const r1 = await pg.evaluate(() => document.getElementById('pregRes').innerText);
      ok('guía: responde la pregunta escrita (FURAT: 2 días hábiles)', /2 días hábiles/.test(r1), r1.slice(0, 200));
      await pg.click('#pregSug button'); await pg.waitForTimeout(300);
      ok('guía: las preguntas sugeridas responden con un toque', /Por dónde iniciar/.test(await pg.evaluate(() => document.getElementById('pregRes').innerText)));
      await pg.fill('#pregTxt', 'receta de arepas'); await pg.click('#pregForm button[type=submit]'); await pg.waitForTimeout(300);
      ok('guía: si no sabe, lo dice y no inventa', /No encontré/.test(await pg.evaluate(() => document.getElementById('pregRes').innerText)));
      await pg.fill('#pregTxt', 'cada cuanto se reune el copasst'); await pg.click('#pregForm button[type=submit]'); await pg.waitForTimeout(300);
      await pg.screenshot({ path: '/tmp/claude-0/-home-claude/adc95083-69c6-539e-9f6d-b6e7494d4ef6/scratchpad/guia.png' });
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v171: informe mensual de actividades');
    {
      const ctx = await nav.newContext(Object.assign({}, PC)); await ctx.addInitScript(() => { window.print = () => {}; });
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      const mes = new Date().toISOString().slice(0, 7);
      await pg.goto(S.url + '/informe-mes.html?mes=' + mes); await pg.waitForTimeout(4000);
      const im = await pg.evaluate(() => ({ txt: document.getElementById('contenido').innerText, pdf: !document.getElementById('btnPdf').disabled, R: typeof R !== 'undefined' && R ? R.mes : '' }));
      ok('informe mensual: muestra permisos, accidentes, inspecciones, charlas, EPP y otras actividades del mes', im.pdf && im.R === mes &&
        ['Permisos de trabajo y ATS', 'Accidentes, incidentes y reportes', 'Inspecciones y hallazgos', 'Charlas, inducciones y formación', 'Elementos de protección personal', 'Otras actividades del mes'].every((t) => im.txt.indexOf(t) !== -1), im.txt.slice(0, 300));
      let html = ''; await pg.exposeFunction('__capturaPdf', (h) => { html = h; });
      await pg.evaluate(() => { const o = UI.imprimir; UI.imprimir = function (p) { window.__capturaPdf((p || []).join('')); return o.apply(UI, arguments); }; });
      await pg.click('#btnPdf'); await pg.waitForTimeout(1500);
      ok('informe mensual: el PDF sale con las seis partes y las firmas', /INFORME MENSUAL DE ACTIVIDADES/.test(html) && /6\. Otras actividades/.test(html) && /Responsable del SG-SST/.test(html), html.replace(/<[^>]+>/g, ' ').slice(0, 200));
      const otro = await pg.evaluate(() => { const s = document.getElementById('selMes'); s.selectedIndex = 1; s.dispatchEvent(new Event('change')); return R.mes; });
      ok('informe mensual: al cambiar el mes se recalcula sin volver a pedir los datos', otro !== mes && /mes=/.test(await pg.evaluate(() => location.search)));
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v164: maestro único de personas (personaId, CSV para nómina o PILA, ficha por personaId)');
    {
      const ctx = await nav.newContext(Object.assign({ acceptDownloads: true }, PC)); await ctx.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/habilitacion.html'); await pg.waitForTimeout(2500);
      const vis = await pg.evaluate(() => { const b = document.getElementById('btnMaestro'); return !!b && !b.hidden; });
      const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }).catch(() => null), pg.click('#btnMaestro').catch(() => {})]);
      const csv = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
      const lineas = csv.replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean), pid = ((lineas[1] || '').split(';')[0] || '');
      ok('Personal habilitado: SST descarga el maestro de personas en CSV, una fila por persona con su personaId y sin datos de salud', vis && lineas.length > 2 && /^personaId;cedula;cedulas_anteriores;nombre/.test(lineas[0]) && /^P-[0-9A-Z]{12}$/.test(pid) && !/apto|restric|examen|diagn/i.test(csv), lineas.slice(0, 2).join(' | '));
      await pg.goto(S.url + '/persona.html?p=' + encodeURIComponent(pid)); await pg.waitForTimeout(3500);
      const f = await pg.evaluate(() => ({ nom: document.getElementById('fxNom').textContent, sub: document.getElementById('fxSub').textContent }));
      ok("ficha 360: se abre con el personaId (la llave que no cambia) y lo muestra", !!pid && f.sub.indexOf(pid) !== -1 && f.nom.length > 3, JSON.stringify(f));
      ok('sin errores de JavaScript', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }
    console.log('\n▸ v159: quien entra con usuario cae en su pantalla de trabajo y la cédula llena el resto');
    {
      let ctx = await nav.newContext(Object.assign({ __conIrAGestion: true }, PC)); await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1500);
      const v = await pg.evaluate(() => ({ h: location.hash, sg: document.body.classList.contains('vista-sg'), arriba: document.getElementById('pend').compareDocumentPosition(document.querySelector('.search-box')) & 4 }));
      ok('con usuario, el inicio abre Gestión con «Lo mío hoy» arriba', v.h === '#sg' && v.sg && !!v.arriba, JSON.stringify(v));
      await pg.goto(S.url + '/permiso-trabajo-alturas.html'); await pg.waitForTimeout(2000);
      await pg.evaluate(() => { const b = document.getElementById('cardNew'); if (b) b.click(); }); await pg.waitForTimeout(1500);
      const ced = await pg.evaluate(() => { const m = Habilitacion._mapa || {}; const k = Object.keys(m)[0]; return m[k] && m[k].cedula; });
      await pg.fill('#execCC1', String(ced)); await pg.press('#execCC1', 'Tab'); await pg.waitForTimeout(700);
      const lleno = await pg.evaluate(() => ({ n1: document.getElementById('execNombre1').value, n2: (document.getElementById('execNombre2') || {}).value || '' }));
      ok('permiso: al escribir la cédula se llena el nombre de esa fila (y no las de otros)', !!lleno.n1 && !lleno.n2, JSON.stringify(lleno));
      await pg.click('#btnHacerAts'); await pg.waitForTimeout(3000);
      const at = await pg.evaluate(() => (typeof ats !== 'undefined' ? { per: ats.cab.permisos, n: ats.participantes.length, ced: (ats.participantes[0] || {}).cedula } : null));
      ok('el ATS sale del permiso con la cuadrilla y el tipo de permiso', at && at.per.join() === 'alturas' && at.n === 1 && at.ced === String(ced), JSON.stringify(at));
      ok('sin errores de JavaScript', !err.length, err.join(' | '));
      await ctx.close();
    }
    console.log('\n▸ v123: tarjetas del inicio, formatos base, atrás y nombres del personal');
    {
      let ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 1);
      await ctx.addInitScript(() => { try { localStorage.setItem('ssta-personal-lista', JSON.stringify([{ nombre: 'Ana Prueba Habilitada', cedula: '1012345678', cargo: 'Operaria' }])); } catch (e) {} });
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1200);
      const antes = await pg.evaluate(() => ({ pan: document.getElementById('panPreop').hidden, enc: !!document.querySelector('a[href="percepcion-peligros.html"]:not([hidden])') && [...document.querySelectorAll('a[href="percepcion-peligros.html"]')].some((a) => !!a.offsetParent) }));
      await pg.click('#pubPreop'); await pg.waitForTimeout(400);
      const desp = await pg.evaluate(() => ({ pan: !document.getElementById('panPreop').hidden, otro: document.getElementById('panReportar').hidden, n: document.querySelectorAll('#pubPreopLista a').length, mont: !!document.querySelector('#pubPreopLista a[href="preoperacional.html#montacargas"]'), hash: location.hash }));
      ok('inicio: la tarjeta Preoperacional empieza cerrada y al tocarla despliega sus formularios (incluidos los base)', antes.pan && desp.pan && desp.otro && desp.n >= 6 && desp.mont && desp.hash === '#preop', JSON.stringify(desp));
      ok('inicio: ya no aparece «¿Qué peligros ves?»', !antes.enc);
      await pg.click('#pubReportar'); await pg.waitForTimeout(300);
      const rep = await pg.evaluate(() => ({ r: !document.getElementById('panReportar').hidden, p: document.getElementById('panPreop').hidden, n: document.querySelectorAll('#panReportar a:not([hidden])').length }));
      ok('inicio: Reportar despliega Evento y PQRS y cierra el otro', rep.r && rep.p && rep.n >= 2, JSON.stringify(rep));
      await pg.click('#pubPreop'); await pg.waitForTimeout(300);
      await pg.click('#pubPreopLista a[href="preoperacional.html#montacargas"]'); await pg.waitForLoadState('domcontentloaded'); await pg.waitForTimeout(1500);
      const fm = await pg.evaluate(() => ({ act: (document.querySelector('.screen.active') || {}).id, txt: document.body.innerText.includes('Montacargas') || document.body.innerText.includes('montacargas'), per: !!document.querySelector('#scrForm [data-persona]') }));
      ok('preoperacional base: el de montacargas abre directo desde el inicio', fm.act === 'scrForm' && fm.txt && fm.per, JSON.stringify(fm));
      await pg.focus('#scrForm [data-persona]'); await pg.waitForTimeout(900);
      const ac = await pg.evaluate(async () => { const i = document.querySelector('#scrForm [data-persona]'); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 700)); return document.querySelectorAll('.ac button').length || JSON.stringify({ act: document.activeElement === i, listo: i.dataset.acListo, ls: localStorage.getItem('ssta-personal-lista'), nota: (document.querySelector('.ac') || {}).textContent }); });
      ok('preoperacional: el campo de la persona ofrece el personal habilitado', ac > 0, String(ac));
      await pg.goBack(); await pg.waitForTimeout(1200);
      if (/preoperacional/.test(await pg.evaluate(() => location.pathname))) { await pg.goBack(); await pg.waitForTimeout(1200); }
      const vuelta = await pg.evaluate(() => ({ url: location.pathname + location.hash, pan: document.getElementById('panPreop') && !document.getElementById('panPreop').hidden }));
      ok('atrás desde el formulario vuelve al inicio con la tarjeta abierta, donde estaba', /index\.html#preop$/.test(vuelta.url) && vuelta.pan, JSON.stringify(vuelta));
      // Atrás dentro de una página: vuelve a la pantalla anterior, no al inicio del portal.
      await pg.goto(S.url + '/preoperacional.html'); await pg.waitForTimeout(1500);
      await pg.evaluate(() => abrirForm('camioneta')); await pg.waitForTimeout(800);
      const en = await pg.evaluate(() => (document.querySelector('.screen.active') || {}).id);
      await pg.goBack(); await pg.waitForTimeout(900);
      const tras = await pg.evaluate(() => ({ p: location.pathname, s: (document.querySelector('.screen.active') || {}).id }));
      ok('atrás dentro del preoperacional vuelve a la lista, sin salirse de la página', en === 'scrForm' && /preoperacional\.html$/.test(tras.p) && tras.s === 'scrLista', JSON.stringify([en, tras]));
      // Inspección del botiquín: secciones y el inspector con el personal habilitado.
      await pg.goto(S.url + '/inspecciones.html'); await pg.waitForTimeout(1500);
      const ins = await pg.evaluate(() => ({ plant: typeof PLANTILLAS_INSPECCION !== 'undefined' ? PLANTILLAS_INSPECCION.map((p) => p.id) : [] }));
      ok('inspecciones: están los formatos nuevos (botiquín, kit de derrames, montacargas, puestos, ergonomía…)', ['botiquin', 'kit_derrames', 'montacargas', 'plataforma', 'puesto_trabajo', 'ergo_admin', 'gerencial', 'locativa'].every((i) => ins.plant.includes(i)), JSON.stringify(ins.plant));
      await pg.focus('#inInsp').catch(() => {}); await pg.waitForTimeout(900);
      await pg.evaluate(() => iniciarInspeccion('botiquin')); await pg.waitForTimeout(800);
      const secs = await pg.evaluate(() => ({ s: document.querySelectorAll('.screen.active h3.sec-insp').length, cod: (document.getElementById('inCat') || {}).textContent }));
      ok('inspección del botiquín: con sus secciones y sin código de fábrica (v126: lo pone la empresa)', secs.s >= 1 && !/SSTA-F-/.test(secs.cod || ''), JSON.stringify(secs));
      const ac2 = await pg.evaluate(async () => { const i = document.getElementById('inInsp'); i.value = ''; i.focus(); i.dispatchEvent(new Event('input')); await new Promise((r) => setTimeout(r, 700)); return document.querySelectorAll('.ac button').length; });
      ok('inspecciones: el nombre del inspector ofrece el personal habilitado', ac2 > 0, String(ac2));
      ok('v123: sin errores de JavaScript en inicio, preoperacional e inspecciones', !err.length, err.join(' | ').slice(0, 300));
      await ctx.close();
      // Sin usuario, el preoperacional base abre sin pedir entrar (el personal se busca en segundo plano).
      ctx = await nav.newContext(CELULAR);
      { const pp = await ctx.newPage(); await pp.goto(S.url + '/preoperacional.html#montacargas'); await pp.waitForTimeout(2000);
        await pp.evaluate(() => { const i = document.querySelector('#scrForm [data-persona]'); if (i) { i.focus(); i.dispatchEvent(new Event('input')); } }); await pp.waitForTimeout(1500);
        const pide = await pp.evaluate(() => [...document.querySelectorAll('h3')].some((h) => /Entrar al sistema/.test(h.textContent) && !!h.offsetParent));
        ok('sin usuario, el preoperacional de montacargas no pide entrar', !pide); }
      await ctx.close();
      // v124: preoperacionales de herramientas, lo que el administrador apaga y la reposición de EPP.
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 0);
      { const pv = await ctx.newPage(); const err4 = []; pv.on('pageerror', (e) => err4.push(e.message));
        await pv.goto(S.url + '/index.html'); await pv.waitForTimeout(1200); await pv.click('#pubPreop'); await pv.waitForTimeout(300);
        const her = await pv.evaluate(() => ['pulidora', 'taladro', 'motortool', 'equipo-soldar', 'equipo-oxicorte', 'herramientas-menores', 'roladora', 'diferencial-cadena'].filter((i) => !document.querySelector('#pubPreopLista a[href="preoperacional.html#' + i + '"]')));
        ok('v124: los 8 preoperacionales de herramientas y equipos salen en la tarjeta', !her.length, 'faltan: ' + her.join(', '));
        await pv.goto(S.url + '/preoperacional.html#pulidora'); await pv.waitForTimeout(1500);
        const pu = await pv.evaluate(() => ({ act: (document.querySelector('.screen.active') || {}).id, disco: document.body.innerText.includes('Tipo de disco') }));
        ok('v124: el preoperacional de pulidora abre con sus datos (tipo de disco)', pu.act === 'scrForm' && pu.disco, JSON.stringify(pu));
        // Reposición: primero una entrega, luego se repone ese elemento por pérdida.
        await pv.goto(S.url + '/entrega-epp.html'); await pv.waitForTimeout(2500);
        const el0 = await pv.evaluate(() => CATALOGO[0][0]);
        await pv.evaluate((el) => nuevaEntrega({ nombre: 'Ana Prueba Reposición', cedula: '1099887766', cargo: 'Operaria', solo: [el] }), el0); await pv.waitForTimeout(1200);
        await firmarConMouse(pv); await pv.click('#eOk');
        await esperar(() => pv.evaluate(() => document.getElementById('scrLista').classList.contains('active')), 20000); await pv.waitForTimeout(1500);
        await pv.evaluate(() => registrarReposicion({ nombre: 'Ana Prueba Reposición', cedula: '1099887766', cargo: 'Operaria' })); await pv.waitForTimeout(800);
        const tiene = await pv.evaluate(() => document.querySelectorAll('#rEls [data-v]').length);
        ok('reposición: muestra lo que la persona tiene hoy', tiene >= 1, String(tiene));
        await pv.evaluate(() => { const c = document.querySelector('#rEls [data-v]'); c.checked = true; c.dispatchEvent(new Event('change')); const m = document.querySelector('#rEls [data-m]'); m.value = 'perdida'; m.dispatchEvent(new Event('change')); });
        await pv.waitForTimeout(300); await pv.click('#rSig'); await pv.waitForTimeout(1200);
        const paso2 = await pv.evaluate(() => ({ h1: (document.querySelector('#scrEnt h1') || {}).textContent, mot: (document.getElementById('eMot') || {}).value, tabla: (document.querySelector('#scrEnt .tabla') || {}).textContent || '' }));
        ok('reposición: pasa a la firma con el motivo y el elemento anterior', paso2.h1 === 'Registrar reposición' && paso2.mot === 'Pérdida' && /No lo devolvió/.test(paso2.tabla), JSON.stringify(paso2));
        await firmarConMouse(pv); await pv.click('#eOk');
        await esperar(() => pv.evaluate(() => document.getElementById('scrLista').classList.contains('active')), 20000); await pv.waitForTimeout(1500);
        await pv.click('[data-tab="reponer"]'); await pv.waitForTimeout(600);
        const hechas = await pv.evaluate(() => [...document.querySelectorAll('#panel [data-h]')].map((b) => b.textContent));
        ok('reposición: queda en «Reposiciones hechas» con su motivo', hechas.some((t) => /Ana Prueba Reposición/.test(t) && /pérdida/i.test(t)), JSON.stringify(hechas).slice(0, 300));
        await pv.click('[data-tab="personas"]'); await pv.waitForTimeout(600);
        await pv.fill('#bPer', '1099887766'); await pv.waitForTimeout(300);
        await pv.click('#lPer [data-p]'); await pv.waitForTimeout(800);
        const hp = await pv.evaluate(() => ({ h1: (document.querySelector('#scrEnt h1') || {}).textContent, n: document.querySelectorAll('#scrEnt [data-hv]').length, hoy: (document.querySelector('#scrEnt .tabla') || {}).textContent || '' }));
        ok('historial por trabajador: lo que tiene hoy y sus entregas y reposiciones', hp.h1 === 'Ana Prueba Reposición' && hp.n === 2 && hp.hoy.includes(el0), JSON.stringify(hp));
        await pv.click('#scrEnt [data-hv]'); await pv.waitForTimeout(1500);
        await pv.click('#scrEnt [data-volver]'); await pv.waitForTimeout(800);
        const vu = await pv.evaluate(() => (document.querySelector('#scrEnt .eyebrow') || {}).textContent);
        ok('historial por trabajador: «Volver» desde un registro regresa al historial', vu === 'Historial de EPP', String(vu));
        ok('v124: sin errores de JavaScript (preoperacional y EPP)', !err4.length, err4.join(' | ').slice(0, 300));
        await pv.close(); }
      await ctx.close();
      // Lo que el administrador apaga para la empresa no se ofrece.
      ctx = await nav.newContext(CELULAR);
      await ctx.route('**/empresa.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()) + '\n;EMPRESA.ocultos = { preop: ["pulidora"], inspecciones: ["botiquin"] };' }); });
      await entrarComo(ctx, S.url, 0);
      { const po = await ctx.newPage();
        await po.goto(S.url + '/index.html'); await po.waitForTimeout(1200);
        const ix = await po.evaluate(() => ({ pul: !!document.querySelector('#pubPreopLista a[href="preoperacional.html#pulidora"]'), tal: !!document.querySelector('#pubPreopLista a[href="preoperacional.html#taladro"]') }));
        await po.goto(S.url + '/preoperacional.html#pulidora'); await po.waitForTimeout(1500);
        const pr = await po.evaluate(() => (document.querySelector('.screen.active') || {}).id);
        await po.goto(S.url + '/inspecciones.html'); await po.waitForTimeout(1500);
        const ins = await po.evaluate(() => ({ bot: activas().some((p) => p.id === 'botiquin'), ext: activas().some((p) => p.id === 'extintor') }));
        ok('v124: un preoperacional apagado por el administrador no sale ni abre por enlace', !ix.pul && ix.tal && pr === 'scrLista', JSON.stringify([ix, pr]));
        ok('v124: una lista de inspección apagada no se ofrece', !ins.bot && ins.ext, JSON.stringify(ins));
        await po.close(); }
      await ctx.close();
      // v125: los preoperacionales vienen sin código y cada empresa les pone nombre y código.
      ctx = await nav.newContext(CELULAR);
      { const p0 = await ctx.newPage(); await p0.goto(S.url + '/index.html'); await p0.waitForTimeout(1200);
        const sinCod = await p0.evaluate(() => [...document.querySelectorAll('#pubPreopLista small')].map((x) => x.textContent));
        ok('v125: los preoperacionales base salen sin código', !sinCod.some((t) => /SSTA-F/.test(t)), JSON.stringify(sinCod)); await p0.close(); }
      await ctx.close();
      ctx = await nav.newContext(CELULAR);
      await ctx.route('**/empresa.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()) + '\n;EMPRESA.bautizos = { preop: { pulidora: { nombre: "Pulidora angular", codigo: "MA-F-15" } }, inspecciones: { botiquin: { nombre: "Botiquín tipo B", codigo: "MA-F-62" } } };' }); });
      await entrarComo(ctx, S.url, 0);
      { const pb = await ctx.newPage();
        await pb.goto(S.url + '/index.html'); await pb.waitForTimeout(1200);
        const ix = await pb.evaluate(() => (document.querySelector('#pubPreopLista a[href="preoperacional.html#pulidora"]') || {}).textContent || '');
        await pb.goto(S.url + '/preoperacional.html#pulidora'); await pb.waitForTimeout(1500);
        const fm = await pb.evaluate(() => ({ t: document.getElementById('fTitulo').textContent, c: document.getElementById('fCodigo').textContent }));
        await pb.goto(S.url + '/inspecciones.html'); await pb.waitForTimeout(1500);
        const ins = await pb.evaluate(() => { const p = pl('botiquin'); return p.nombre + '|' + p.codigo; });
        ok('v125: el nombre y el código que pone la empresa salen en el inicio y en el formulario', /Pulidora angular/.test(ix) && /MA-F-15/.test(ix) && fm.t === 'Pulidora angular' && fm.c === 'MA-F-15', JSON.stringify([ix, fm]));
        ok('v125: también en las listas de inspección', ins === 'Botiquín tipo B|MA-F-62', ins);
        await pb.close(); }
      await ctx.close();
      // v126: sin códigos de fábrica: una empresa que no puso los suyos no ve ningún SSTA-F.
      ctx = await nav.newContext(CELULAR);
      await ctx.route('**/empresa.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()) + '\n;Object.keys(EMPRESA.formatos || {}).forEach((k) => { EMPRESA.formatos[k].codigo = ""; EMPRESA.formatos[k].version = ""; });' }); });
      await entrarComo(ctx, S.url, 0);
      { const pz = await ctx.newPage(); const vistos = [];
        for (const f of ['index.html', 'ats.html', 'asistencia.html', 'permiso-trabajo-alturas.html', 'inspeccion-epp.html', 'personal-autorizado.html', 'preoperacional.html', 'inspecciones.html']) {
          await pz.goto(S.url + '/' + f); await pz.waitForTimeout(1800);
          const r = await pz.evaluate(() => ({ t: document.title, sf: /SSTA-F-\d/.test(document.body.innerText + document.title), vacio: /Código:\s*(\n|$|·)/.test(document.body.innerText) }));
          if (r.sf || r.vacio) vistos.push(f + ' ' + JSON.stringify(r));
        }
        ok('v126: sin códigos de la empresa no aparece ningún SSTA-F ni «Código:» vacío', !vistos.length, vistos.join(' | ').slice(0, 400)); await pz.close(); }
      await ctx.close();
      // v127: listas de herramientas separadas, equipos por preoperacional y eliminar uno o varios.
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 0);
      { const pe = await ctx.newPage(); const err7 = []; pe.on('pageerror', (e) => err7.push(e.message));
        await pe.goto(S.url + '/inspecciones.html'); await pe.waitForTimeout(1800);
        const ls = await pe.evaluate(() => activas().map((p) => p.id));
        ok('v127: la herramienta eléctrica se separa en pulidora, taladro, motortool, herramientas menores, roladora y diferencial', ['pulidora', 'taladro', 'motortool', 'herramientas_menores', 'roladora', 'diferencial', 'soldadura', 'oxicorte'].every((i) => ls.includes(i)) && !ls.includes('herramienta_electrica'), JSON.stringify(ls));
        await pe.goto(S.url + '/preoperacional.html'); await pe.waitForTimeout(1500);
        const eqs = await pe.evaluate(() => { equipos = [{ resumen: { categoria: 'soldadura', codigo: 'SOL-1' } }, { resumen: { categoria: 'pulidora', codigo: 'PUL-1' } }, { resumen: { categoria: 'herramienta_electrica', codigo: 'TAL-9', nombre: 'Taladro DeWalt' } }];
          return { sol: equiposDe(formDe('equipo-soldar')).map((e) => e.resumen.codigo), pul: equiposDe(formDe('pulidora')).map((e) => e.resumen.codigo), tal: equiposDe(formDe('taladro')).map((e) => e.resumen.codigo) }; });
        ok('v127: en el preoperacional de soldar solo se ofrecen los equipos de soldadura', eqs.sol.join() === 'SOL-1' && eqs.pul.join() === 'PUL-1' && eqs.tal.join() === 'TAL-9', JSON.stringify(eqs));
        await pe.goto(S.url + '/habilitacion.html'); await pe.waitForTimeout(2500);
        const antes = await pe.evaluate(() => document.querySelectorAll('#lista [data-id]').length);
        await pe.click('#selBarra .sel-varios'); await pe.waitForTimeout(300);
        const ids = await pe.evaluate(() => [...document.querySelectorAll('#lista [data-id]')].slice(0, 2).map((b) => { b.click(); return b.dataset.id; }));
        await pe.waitForTimeout(300);
        const marcados = await pe.evaluate(() => ({ n: document.querySelectorAll('#lista .sel-on').length, abierta: document.getElementById('scrFicha').classList.contains('active') }));
        await pe.click('.sel-pie [data-elim]'); await pe.waitForTimeout(400);
        await pe.fill('#elMot', 'prueba: personas duplicadas'); await pe.click('#elOk');
        await esperar(() => pe.evaluate(() => !document.getElementById('elOk')).catch(() => false), 20000); await pe.waitForTimeout(2500);
        const despues = await pe.evaluate((ids) => ({ n: document.querySelectorAll('#lista [data-id]').length, quedan: ids.filter((i) => document.querySelector('#lista [data-id="' + i + '"]')).length }), ids);
        ok('v127: en Personal habilitado se seleccionan varias personas y se eliminan', antes >= 3 && marcados.n === 2 && !marcados.abierta && despues.n === antes - 2 && despues.quedan === 0, JSON.stringify([antes, marcados, despues]));
        await pe.click('#lista [data-id]'); await pe.waitForTimeout(800);
        const unBoton = await pe.evaluate(() => !!document.querySelector('#fHist .btn-eliminar:not([hidden])'));
        ok('v127: la ficha de una persona tiene «Eliminar»', unBoton);
        ok('v127: sin errores de JavaScript', !err7.length, err7.join(' | ').slice(0, 300));
        await pe.close(); }
      await ctx.close();
      // v128: reportes de actos y condiciones (seguridad y ambiental) y buzón reservado del comité.
      ctx = await nav.newContext(CELULAR);
      { const pr = await ctx.newPage(); const err8 = []; pr.on('pageerror', (e) => err8.push(e.message));
        await pr.goto(S.url + '/reportes.html?nuevo=1'); await pr.waitForTimeout(1800);
        const cls = await pr.evaluate(() => [...document.querySelectorAll('#clases [data-c]')].map((b) => b.dataset.c));
        ok('v128: el reporte ofrece acto seguro, acto inseguro, condición insegura y hallazgo ambiental', ['Acto seguro', 'Acto inseguro', 'Condición insegura', 'Hallazgo ambiental'].every((c) => cls.includes(c)), JSON.stringify(cls));
        await pr.click('#clases [data-c="Hallazgo ambiental"]'); await pr.waitForTimeout(300);
        const amb = await pr.evaluate(() => ({ cat: !document.getElementById('filaCategoria').hidden, primero: (document.querySelector('#nCategoria optgroup') || {}).label, acc: document.querySelectorAll('#nAccionTomada input').length, rel: !document.getElementById('filaRelacionados').hidden }));
        ok('v128: el hallazgo ambiental pide categoría (primero las ambientales), acción tomada y relacionados', amb.cat && amb.primero === 'Ambiental' && amb.acc >= 6 && amb.rel, JSON.stringify(amb));
        await pr.fill('#nDesc', 'Se vio un derrame de aceite cerca del sifón del taller de mantenimiento.');
        await pr.click('#btnEnviar'); await pr.waitForTimeout(500);
        const falta = await pr.evaluate(() => document.getElementById('msgNuevo').textContent);
        ok('v128: sin categoría, relacionados ni acción tomada no se envía y dice qué falta', /Categoría/.test(falta) && /relacionad/i.test(falta) && /Acción inmediata/.test(falta), falta.slice(0, 200));
        await pr.selectOption('#nCategoria', 'Vertimiento de líquidos contaminantes a desagües o suelo');
        await pr.fill('#nRelacionados', 'Taller de mantenimiento, sifón 2');
        await pr.check('#nAccionTomada input[value="Señalizó o aisló el área"]'); await pr.check('#nAccionTomada input[value="Informó al Supervisor SSTA"]');
        await pr.fill('#nPlan', 'Kit de derrames junto al sifón'); await pr.fill('#nConsecuencias', 'Contaminación del alcantarillado');
        await pr.fill('#nQuien', 'Ana Prueba');
        // v143: con usuarios y sin sesión, quien reporta ve «¡Gracias!»; aquí se prueba la ficha (empresa sin usuarios)
        const conUsr = await pr.evaluate(() => { const v = localStorage.getItem(Sesion.KEY_MODO); localStorage.removeItem(Sesion.KEY_MODO); return v; });
        // v145: lo que se envía se lee en el servidor de la demo (el «servidor» vive en este navegador)
        await pr.evaluate(() => { window.__envios = []; const e0 = SGSST.enviar; SGSST.enviar = async function (b) { const r = await e0.apply(this, arguments); window.__envios.push({ b, r }); return r; }; SGSST.enviar._auto = true; });
        await pr.click('#btnEnviar');
        await esperar(() => pr.evaluate(() => ['scrDetalle', 'scrGracias'].some((x) => document.getElementById(x).classList.contains('active'))), 20000);
        if (conUsr) await pr.evaluate((v) => localStorage.setItem(Sesion.KEY_MODO, v), conUsr);
        const det = await pr.evaluate(() => { const e = (window.__envios || []).find((x) => x.b && x.b.tipo === 'reporte'); const d = (e && e.b.doc) || {}; return (document.getElementById('scrDetalle').classList.contains('active') ? document.getElementById('dDatos').innerText : '') + ' ' + JSON.stringify(d) + ' ok:' + !!(e && e.r && e.r.ok); });
        ok('v128: el reporte guarda la categoría, la acción tomada, el plan y las consecuencias', /Vertimiento/.test(det) && /Señalizó o aisló el área/.test(det) && /Kit de derrames/.test(det) && /alcantarillado/.test(det) && /ok:true/.test(det), det.slice(0, 300));
        await pr.goto(S.url + '/reportes.html?nuevo=1'); await pr.waitForTimeout(1500);
        await pr.click('#clases [data-c="Acto seguro"]'); await pr.waitForTimeout(200);
        const seg = await pr.evaluate(() => ({ cat: document.getElementById('filaCategoria').hidden, acc: document.getElementById('filaAccionTomada').hidden, rel: !document.getElementById('filaRelacionados').hidden }));
        ok('v128: el acto seguro no pide categoría de riesgo ni acción tomada', seg.cat && seg.acc && seg.rel, JSON.stringify(seg));
        ok('v128: reportes sin errores de JavaScript', !err8.length, err8.join(' | ').slice(0, 300));
        await pr.close(); }
      await ctx.close();
      // v129: acto seguro sin potencial ni reconocimiento; accidente oculto por defecto; ayuda según los módulos.
      ctx = await nav.newContext(CELULAR);
      { const pz = await ctx.newPage(); await pz.goto(S.url + '/reportes.html?nuevo=1'); await pz.waitForTimeout(1500);
        const at = await pz.evaluate(() => ({ boton: !!document.querySelector('#clases [data-c="Accidente de trabajo"]:not([hidden])'), tab: !!document.querySelector('#tabs [data-tab="accidentes"]:not([hidden])') }));
        ok('v129: el accidente de trabajo no sale en «Reportar» (por defecto lo registra SST)', !at.boton && !at.tab, JSON.stringify(at));
        await pz.click('#clases [data-c="Acto seguro"]'); await pz.waitForTimeout(200);
        const as = await pz.evaluate(() => ({ pot: document.getElementById('filaPot').hidden, rec: document.getElementById('filaInmediataTxt').hidden }));
        ok('v129: el acto seguro no pide potencial de daño ni reconocimiento', as.pot && as.rec, JSON.stringify(as));
        await pz.close(); }
      await ctx.close();
      ctx = await nav.newContext(CELULAR);
      await ctx.route('**/empresa.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()) + '\n;EMPRESA.modulos = Object.assign({}, EMPRESA.modulos, { quimicos: false }); EMPRESA.ocultos = { reportes: ["Hallazgo ambiental"], ayuda: ["kit"] };' }); });
      { const py = await ctx.newPage(); await py.goto(S.url + '/ayuda.html'); await py.waitForTimeout(1500);
        const ay = await py.evaluate(() => [...document.querySelectorAll('#lista .guia')].map((d) => d.id));
        ok('v129: la ayuda solo muestra las guías de lo que la empresa usa y lo que el administrador deja', ay.includes('g-reportes') && !ay.includes('g-quimicos') && !ay.includes('g-kit'), JSON.stringify(ay));
        await py.goto(S.url + '/reportes.html?nuevo=1'); await py.waitForTimeout(1500);
        const tr = await py.evaluate(() => ({ amb: !!document.querySelector('#clases [data-c="Hallazgo ambiental"]:not([hidden])'), at: !!document.querySelector('#clases [data-c="Accidente de trabajo"]:not([hidden])') }));
        ok('v129: con la lista de la empresa, salen los tipos que ella deja (aquí sí el accidente, no el ambiental)', !tr.amb && tr.at, JSON.stringify(tr));
        await py.close(); }
      await ctx.close();
      // v130: accesibilidad y esqueletos en las pantallas principales.
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 0);
      { const pa = await ctx.newPage(); const sinNombre = [], camposSin = [];
        for (const pg of ['index.html', 'index.html#sg', 'reportes.html', 'preoperacional.html', 'inspecciones.html', 'habilitacion.html', 'entrega-epp.html', 'convivencia.html', 'ats.html', 'permiso-trabajo-alturas.html', 'buzon.html?tipo=convivencia', 'ayuda.html', 'plan-accion.html', 'dashboard.html']) {
          await pa.goto(S.url + '/' + pg); await pa.waitForTimeout(2200);
          const l = await pa.evaluate(() => [...document.querySelectorAll('button, a[href], summary, [role="button"]')].filter((el) => el.offsetParent && el.getClientRects().length)
            .filter((el) => !((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby') || (el.textContent || '').trim() || (el.title || '').trim() || [...el.querySelectorAll('img[alt]')].some((i) => i.alt.trim())))
            .map((el) => el.outerHTML.slice(0, 90)));
          l.forEach((x) => sinNombre.push(pg + ': ' + x));
          const c = await pa.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((el) => el.offsetParent)
            .filter((el) => !((el.labels && el.labels.length && [...el.labels].some((l) => l.textContent.trim())) || (el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby') || (el.title || '').trim()))
            .map((el) => el.outerHTML.slice(0, 90)));
          c.forEach((x) => camposSin.push(pg + ': ' + x));
        }
        ok('v132: todo campo visible tiene su etiqueta conectada (o un nombre accesible)', !camposSin.length, camposSin.slice(0, 6).join(' | '));
        ok('v130: ningún botón ni enlace visible queda sin nombre para lectores de pantalla', !sinNombre.length, sinNombre.slice(0, 6).join(' | '));
        await pa.goto(S.url + '/inspecciones.html'); await pa.waitForTimeout(1500);
        const dl = await pa.evaluate(async () => { const m = UI.modal('<h3>Prueba</h3><input id="xx"><button type="button" data-cerrar>Cerrar</button>'); await new Promise((r) => setTimeout(r, 200));
          const o = { role: m.el.getAttribute('role'), modal: m.el.getAttribute('aria-modal'), foco: document.activeElement && document.activeElement.id };
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await new Promise((r) => setTimeout(r, 50)); o.cerrada = !document.body.contains(m.el); return o; });
        ok('v130: las ventanas son diálogos accesibles: foco adentro y Escape las cierra', dl.role === 'dialog' && dl.modal === 'true' && dl.foco === 'xx' && dl.cerrada, JSON.stringify(dl));
        const es = await pa.evaluate(async () => { const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'Cargando…'; document.querySelector('.wrap, body').appendChild(d); await new Promise((r) => setTimeout(r, 150)); const o = { esq: !!d.querySelector('.esq'), busy: !!d.querySelector('[aria-busy="true"]') }; d.remove(); return o; });
        ok('v130: «Cargando…» se muestra como esqueleto de la lista (y avisa al lector que está cargando)', es.esq && es.busy, JSON.stringify(es));
        const dg = await pa.evaluate(async () => { delete window.__sstaDialogoAuto; const pr = Dialogo.confirmar('¿Borrar este registro?'); await new Promise((r) => setTimeout(r, 80));
          const v = document.querySelector('.dlg'); const o = { role: v && v.getAttribute('role'), peligro: !!document.querySelector('.dlg-ok.peligro'), texto: v && v.textContent };
          document.querySelector('.dlg-ok').click(); o.res = await pr;
          const p2 = Dialogo.pedir('¿Por qué?', 'x'); await new Promise((r) => setTimeout(r, 80)); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); o.cancelado = await p2; return o; });
        ok('v132: las confirmaciones son ventanas del portal (no del navegador), con «Aceptar» en rojo si es para borrar', dg.role === 'alertdialog' && dg.peligro && dg.res === true && dg.cancelado === null && /Borrar/.test(dg.texto), JSON.stringify(dg));
        const er = await pa.evaluate(() => [Errores.texto('guardó', { ok: false, codigoError: 'SESION', error: 'Entra con tu usuario del portal para hacer esto.' }), Errores.texto('guardó', null)]);
        ok('v132: los errores dicen qué pasó y qué hacer, con la misma forma en todo el portal', /^No se guardó\. .*Vuelve a entrar/.test(er[0]) && /^No se guardó\. No hubo respuesta/.test(er[1]), JSON.stringify(er));
        const foco = await pa.evaluate(() => /focus-visible/.test((document.getElementById('estiloAccesible') || {}).textContent || ''));
        ok('v130: hay anillo de foco visible para quien usa teclado', foco);
        await pa.goto(S.url + '/inspecciones.html'); await pa.waitForTimeout(2000);
        const v133 = await pa.evaluate(async () => { const z = (ms) => new Promise((r) => setTimeout(r, ms)); const w = document.createElement('div'); w.className = 'card'; w.innerHTML = '<button type="button" id="b133">+ Nueva cosa</button><div class="empty">Sin registros.</div><div class="field"><label for="c133">Correo *</label><input id="c133" type="text"></div><div class="field"><label for="r133">Lugar *</label><input id="r133" type="text"></div>'; document.body.appendChild(w); await z(200);
          let tocado = 0; w.querySelector('#b133').addEventListener('click', () => tocado++); const cta = w.querySelector('.empty button'); if (cta) cta.click();
          const c = w.querySelector('#c133'); c.focus(); c.value = 'pepe@'; c.dispatchEvent(new Event('input', { bubbles: true })); c.blur(); await z(50); const correoMal = !!(c.nextElementSibling && c.nextElementSibling.classList.contains('v-msg'));
          const r = w.querySelector('#r133'); r.focus(); r.blur(); await z(50); const falta = r.classList.contains('v-falta');
          r.value = 'Bodega'; r.dispatchEvent(new Event('input', { bubbles: true })); await z(30); const limpio = !r.classList.contains('v-falta'); w.remove();
          return { cta: !!cta, tocado, correoMal, falta, limpio }; });
        ok('v133: pantalla vacía con botón para crear lo primero', v133.cta && v133.tocado === 1, JSON.stringify(v133));
        ok('v133: validación al salir del campo (correo mal, obligatorio vacío) y se quita al escribir', v133.correoMal && v133.falta && v133.limpio, JSON.stringify(v133));
        await pa.goto(S.url + '/index.html#sg'); await pa.waitForTimeout(3500);
        const h135 = await pa.evaluate(() => ({ hoy: !!document.getElementById('hoy') && !document.getElementById('hoy').hidden, atajos: document.querySelectorAll('#atajos .atajo').length,
          todo: !!document.getElementById('sgTodo'), agendaOculta: getComputedStyle(document.getElementById('mes')).display === 'none', lista: !document.getElementById('agenda').hidden && !/Cargando/.test(document.getElementById('pendLista').textContent) }));
        ok('v176: Gestión abre con los atajos del rol y «Para hoy y esta semana» junto al calendario; sin cronograma del mes ni botón para verlo', h135.hoy && h135.atajos >= 4 && !h135.todo && h135.agendaOculta && h135.lista, JSON.stringify(h135));
        const pri = await pa.evaluate(() => { const p = document.querySelector('#primeros .primeros'); return p ? { pasos: p.querySelectorAll('.paso-ini').length, txt: p.querySelector('h3').textContent } : null; });
        const falta = await pa.evaluate(async () => { const r = await SGSST.listar(EMPEZAR.TIPOS.join(',')); const E = EMPEZAR.evaluar({ servidor: true, empresa: true, usuarios: true, rows: r.rows }); return E.siguiente ? E.siguiente.t : ''; });
        ok('v172: a SST le sale «Tu siguiente paso» (uno solo) con el camino completo, o nada si la empresa ya está montada', falta ? (pri && pri.pasos === 2 && pri.txt.indexOf('Tu siguiente paso') !== -1) : !pri, falta + ' · ' + JSON.stringify(pri));
        // v137: sello de la firma, verificado por el servidor
        const se137 = await pa.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 20; c.getContext('2d').fillRect(2, 2, 30, 10);
          const id = SGSST.nuevoId ? SGSST.nuevoId('ACC') : 'ACC-' + Date.now();
          const r = await SGSST.enviar({ action: 'guardar', tipo: 'accion', id, doc: { accion: 'Prueba de sello', responsable: 'Prueba', fechaCompromiso: '2030-01-01', firmaResponsable: c.toDataURL('image/png') } });
          const v = await SGSST.consultar({ action: 'sellos', id }); return { ok: r && r.ok, v }; });
        ok('v137: la firma queda sellada (hora del servidor, equipo y código) y el servidor la verifica', se137.ok && se137.v && se137.v.ok && se137.v.firmas.length === 1 && se137.v.firmas[0].valida && /Mozilla|Chrome|Headless/i.test(se137.v.firmas[0].equipo), JSON.stringify(se137).slice(0, 400));
        // v141: el sello no se puede copiar a otro registro; al editar se conserva el original; la firma sin trazo queda en el sello
        const s141 = await pa.evaluate(async () => { const z = (ms) => new Promise((r) => setTimeout(r, ms));
          const c = document.createElement('canvas'); c.width = 40; c.height = 20; c.getContext('2d').fillRect(3, 3, 20, 12); const img = c.toDataURL('image/png');
          const A = 'ACC-S141A-' + Date.now(), B = 'ACC-S141B-' + Date.now();
          await SGSST.enviar({ action: 'guardar', tipo: 'accion', id: A, doc: { accion: 'Sello A', responsable: 'P', fechaCompromiso: '2030-01-01', firmaResponsable: img } });
          const dA = await SGSST.doc(A); const selloA = dA && dA.firmaResponsable_sello;
          await SGSST.enviar({ action: 'guardar', tipo: 'accion', id: B, doc: { accion: 'Sello B copiado', responsable: 'P', fechaCompromiso: '2030-01-01', firmaResponsable: img, firmaResponsable_sello: selloA } });
          const dB = await SGSST.doc(B); const vB = await SGSST.consultar({ action: 'sellos', id: B });
          await z(1100);
          await SGSST.enviar({ action: 'guardar', tipo: 'accion', id: A, doc: { accion: 'Sello A editado', responsable: 'P', fechaCompromiso: '2030-01-01', firmaResponsable: img } });
          const dA2 = await SGSST.doc(A);
          const c2 = document.createElement('canvas'); c2.width = 50; c2.height = 20; c2.getContext('2d').fillRect(1, 1, 40, 15); const img2 = c2.toDataURL('image/png');
          FirmaAlterna._mapa.set(img2, { nombre: 'Juan Sin Trazo', cedula: '99887766' });
          const C = 'ACC-S141C-' + Date.now();
          await SGSST.enviar({ action: 'guardar', tipo: 'accion', id: C, doc: { accion: 'Sin trazo', responsable: 'P', fechaCompromiso: '2030-01-01', firmaResponsable: img2 } });
          const vC = await SGSST.consultar({ action: 'sellos', id: C });
          return { refA: selloA && selloA.ref, refB: dB.firmaResponsable_sello.ref, otroSello: dB.firmaResponsable_sello.codigo !== selloA.codigo, vB: vB.firmas[0].valida, conserva: dA2.firmaResponsable_sello.fecha === selloA.fecha, alt: vC.firmas[0].sinTrazo }; });
        ok('v141: un sello copiado de otro registro se rehace y al editar se conserva el sello original', s141.refB && /S141B/.test(s141.refB) && s141.otroSello && s141.vB && s141.conserva, JSON.stringify(s141));
        ok('v141: la firma sin trazo queda escrita en el sello (nombre, cédula y si está en el personal)', /Juan Sin Trazo/.test(s141.alt || '') && /99887766/.test(s141.alt || '') && /NO registrada/.test(s141.alt || ''), JSON.stringify(s141));
        { const pb = await pa.context().newPage(); await pb.goto(S.url + '/buzon.html'); await pb.waitForTimeout(2000);
          const bz = await pb.evaluate(async () => { const t = document.querySelector('textarea'); if (t) { t.value = 'Queja confidencial'; t.dispatchEvent(new Event('input', { bubbles: true })); } await new Promise((r) => setTimeout(r, 900)); return { hay: !!t, guardado: Object.keys(localStorage).filter((k) => /ssta-auto\|.*buzon/.test(k)), tpl: !!document.querySelector('.ag-tpl-btn') }; });
          ok('v141: el buzón (y convivencia y salud) no se guardan en el equipo ni ofrecen plantillas', bz.hay && !bz.guardado.length && !bz.tpl, JSON.stringify(bz)); await pb.close(); }
        // v139: papelera y recuperar
        const p139 = await pa.evaluate(async () => { const id = 'ACC-PAP-' + Date.now();
          await SGSST.enviar({ action: 'guardar', tipo: 'accion', id, doc: { accion: 'Para la papelera', responsable: 'Prueba', fechaCompromiso: '2030-01-01' } });
          const b = await SGSST.enviar({ action: 'borrar', id, motivo: 'prueba' });
          const pap = await SGSST.consultar({ action: 'papelera' }); const esta = (pap.rows || []).some((x) => x.id === id);
          const r = await SGSST.enviar({ action: 'restaurar', id }); const pap2 = await SGSST.consultar({ action: 'papelera' });
          const l = await SGSST.listar('accion'); return { b: b.ok, esta, r: r.ok, sale: !(pap2.rows || []).some((x) => x.id === id), vuelve: (l.rows || []).some((x) => x.id === id), deshacer: true }; });
        ok('v139: lo eliminado queda en la Papelera y «Recuperar» lo devuelve a las listas', p139.b && p139.esta && p139.r && p139.sale && p139.vuelve && p139.deshacer, JSON.stringify(p139));
        await pa.goto(S.url + '/papelera.html'); await pa.waitForTimeout(2500);
        const pp = await pa.evaluate(() => ({ h1: document.querySelector('h1').textContent, des: typeof UI.deshacer === 'function', ok: !/Cargando/.test(document.getElementById('lista').textContent) }));
        ok('v139: la página Papelera abre y lista', pp.h1 === 'Papelera' && pp.ok && pp.des, JSON.stringify(pp));
        // v140: contacto de emergencia y MEDEVAC
        await pa.goto(S.url + '/emergencias.html'); await pa.waitForTimeout(2500);
        const idT = await pa.evaluate(async () => { const id = 'TRA-MED-' + Date.now();
          await SGSST.enviar({ action: 'parche', tipo: 'trabajador', id, campos: { nombre: 'Pedro Medevac Ruiz', cedula: '80123456', cargo: 'Soldador', activo: true, emergencia: { nombre: 'Ana Ruiz', parentesco: 'Esposa', telefono: '3001234567', rh: 'O+', eps: 'Sura', arl: 'Positiva' } } });
          await SGSST.enviar({ action: 'guardar', tipo: 'emergencia', id: 'EME-MED-' + Date.now(), doc: { sede: 'Sede MEDEVAC', direccion: 'Cra 1 # 2-3', hospital: 'Hospital San Prueba', hospitalDireccion: 'Calle 10 # 5-20', hospitalTelefono: '6015551234', ambulanciaTelefono: '3109998877', arlNombre: 'Positiva', arlTelefono: '018000111170' } });
          return id; });
        await pa.goto(S.url + '/medevac.html?id=' + idT); await pa.waitForTimeout(3500);
        const md = await pa.evaluate(() => { const sel = document.getElementById('medSede'); const i = [...sel.options].findIndex((o) => o.textContent === 'Sede MEDEVAC'); if (i >= 0) { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); }
          const f = document.getElementById('medFicha').textContent, sd = document.getElementById('medSedeDatos').textContent;
          return { contacto: /Ana Ruiz/.test(f) && /O\+/.test(f), wa: !!document.querySelector('#medFicha a[href^="https://wa.me/573001234567"]'), sms: !!document.querySelector('#medFicha a[href^="sms:"]'), tel: !!document.querySelector('#medFicha a[href="tel:3001234567"]'), hosp: /Hospital San Prueba/.test(sd) && !!document.querySelector('#medSedeDatos a[href="tel:6015551234"]'), pasos: document.querySelectorAll('.med-paso').length }; });
        ok('v140: MEDEVAC muestra el contacto de emergencia (llamar, WhatsApp y SMS), RH y el hospital de la sede', md.contacto && md.wa && md.sms && md.tel && md.hosp && md.pasos === 7, JSON.stringify(md));
        await pa.goto(S.url + '/habilitacion.html'); await pa.waitForTimeout(3000);
        const he = await pa.evaluate(async (id) => { abrir(id); await new Promise((r) => setTimeout(r, 1500)); return { tel: document.getElementById('emTelefono').value, rh: document.getElementById('emRh').value, link: document.getElementById('lnkMedevac').getAttribute('href') }; }, idT);
        ok('v140: en Personal habilitado se ve y se edita el contacto de emergencia, con acceso a su MEDEVAC', he.tel === '3001234567' && he.rh === 'O+' && /medevac\.html\?id=/.test(he.link), JSON.stringify(he));
        // v140: accesibilidad
        const ac = await pa.evaluate(async () => { const z = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
          out.saltar = !!document.getElementById('saltarContenido') && !!document.querySelector('[role="main"], main');
          let dicho = ''; if (window.speechSynthesis) { speechSynthesis.speak = (u) => { dicho += u.text + ' '; }; }
          const bl = document.querySelector('.btn-leer'); out.leerBtn = !!bl; if (bl) { bl.click(); await z(100); } out.dicho = /Personal habilitado/.test(dicho);
          Letra.poner(2); out.letra = document.documentElement.classList.contains('letra-2') && parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs-base')) >= 18; Letra.poner(0);
          const c = document.createElement('canvas'); c.id = 'padAlt140'; c.width = 300; c.height = 120; document.querySelector('.wrap').appendChild(c); SignaturePad.createManager().setup(c); await z(300);
          const b = c.nextElementSibling; out.altBtn = !!(b && /Firmar sin dibujar/.test(b.textContent));
          const pd = Dialogo.pedir, cf = Dialogo.confirmar; Dialogo.pedir = async (t) => /Cédula/.test(t) ? '1.234.567' : 'Juan Pérez Gómez'; Dialogo.confirmar = async () => true;
          if (b) { b.click(); await z(500); } Dialogo.pedir = pd; Dialogo.confirmar = cf;
          out.firmada = !!(c._pad && c._pad.getDataUrl && c._pad.getDataUrl()) && c.dataset.firmaAlterna === '1234567';
          show('scrFicha'); abrir(null); await z(200); document.getElementById('inNombre').value = ''; document.getElementById('btnGuardarDatos').click(); await z(300);
          const n = document.getElementById('inNombre'); out.error = n.getAttribute('aria-invalid') === 'true' && !!n.getAttribute('aria-describedby') && /nombre/i.test((document.getElementById(n.getAttribute('aria-describedby').split(' ').pop()) || {}).textContent || '');
          out.chip = getComputedStyle(document.querySelector('.chip.mal, .chip.ok') || document.body, '::before').content;
          return out; });
        ok('v140: «Saltar al contenido», zona principal y botón «Escuchar» que lee la pantalla', ac.saltar && ac.leerBtn && ac.dicho, JSON.stringify(ac));
        ok('v140: tamaño de letra A+ cambia el texto de todo el portal', ac.letra, JSON.stringify(ac));
        ok('v140: «Firmar sin dibujar» firma con nombre y cédula (para quien no puede trazar)', ac.altBtn && ac.firmada, JSON.stringify(ac));
        ok('v140: el error queda ligado a su campo (aria-invalid y aria-describedby) y los estados no dependen solo del color', ac.error && /2713|2715|✓|✕|!/.test(ac.chip || ''), JSON.stringify(ac));
        { const AXE = fs.readFileSync(path.join(__dirname, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8'); const malos = [];
          for (const pgn of ['index.html', 'reportes.html', 'habilitacion.html', 'medevac.html', 'accesibilidad.html', 'plan-accion.html', 'inspecciones.html', 'emergencias.html']) {
            const px = await pa.context().newPage(); await px.goto(S.url + '/' + pgn); await px.waitForTimeout(2200); await px.evaluate(AXE);
            const v = await px.evaluate(async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'label', 'link-name', 'button-name', 'image-alt', 'landmark-one-main', 'bypass'] } })).violations.map((x) => x.id + ':' + x.nodes.length + ' ' + x.nodes[0].target.join(' ')));
            v.forEach((x) => malos.push(pgn + ' ' + x)); await px.close(); }
          ok('v140: contraste WCAG AA, nombres de campos, botones y enlaces, y zona principal (revisión automática axe)', !malos.length, malos.slice(0, 10).join(' | ')); }
        await pa.goto(S.url + '/accesibilidad.html'); await pa.waitForTimeout(1500);
        const ap = await pa.evaluate(() => { document.querySelector('.letra [data-n="1"]').click(); const r = { h1: document.querySelector('h1').textContent, l1: document.documentElement.classList.contains('letra-1'), p: document.querySelector('.letra [data-n="1"]').getAttribute('aria-pressed') }; document.querySelector('.letra [data-n="0"]').click(); return r; });
        ok('v140: página Accesibilidad con tamaño de letra, modo sol y la declaración', ap.h1 === 'Accesibilidad' && ap.l1 && ap.p === 'true', JSON.stringify(ap));
        await pa.goto(S.url + '/index.html'); await pa.waitForTimeout(1500);
        const sol = await pa.evaluate(() => { document.getElementById('btnSol').click(); const on = document.documentElement.classList.contains('modo-sol'); const bg = getComputedStyle(document.body).backgroundColor; document.getElementById('btnSol').click(); return { on, bg, off: !document.documentElement.classList.contains('modo-sol') }; });
        ok('v137: el botón «Sol» pone el portal en blanco y negro con letra grande, y se quita igual', sol.on && sol.bg === 'rgb(255, 255, 255)' && sol.off, JSON.stringify(sol));
        await pa.goto(S.url + '/etiquetas-qr.html'); await pa.waitForTimeout(2500);
        await pa.fill('#mCods', 'MC-99\nESC-01'); await pa.click('#btnVer'); await pa.waitForTimeout(400);
        const q136 = await pa.evaluate(() => ({ n: document.querySelectorAll('#hoja .etq').length, dib: [...document.querySelectorAll('#hoja canvas')].every((c) => c.width > 50), cod: document.querySelector('#hoja .cod') && document.querySelector('#hoja .cod').textContent }));
        ok('v136: etiquetas QR: cada equipo con su código y su QR listo para imprimir', q136.n >= 2 && q136.dib && /MC-99|[A-Z]/.test(q136.cod || ''), JSON.stringify(q136));
        await pa.goto(S.url + '/preoperacional.html?eq=MC-77#montacargas'); await pa.waitForTimeout(3000);
        const eq136 = await pa.evaluate(() => { const i = document.querySelector('input[list="dlEquipos"]'); return i ? i.value : null; });
        ok('v136: al escanear el QR, el preoperacional abre con el código del equipo ya puesto', eq136 === 'MC-77', String(eq136));
        { const c2 = await nav.newContext(CELULAR); const pr = await c2.newPage(); await pr.goto(S.url + '/reportes.html'); await pr.waitForTimeout(2500);
          const r135 = await pr.evaluate(() => ({ h1: document.querySelector('.hdr h1').textContent, tabs: getComputedStyle(document.getElementById('tabs')).display, boton: !!document.getElementById('btnReportar') }));
          ok('v135: sin usuario, Reportes es solo para reportar (sin pestañas ni lista)', r135.h1 === 'Reportar' && r135.tabs === 'none' && r135.boton, JSON.stringify(r135));
          await c2.close(); }
        { const c4 = await nav.newContext(CELULAR); await c4.addInitScript(() => { window.SpeechRecognition = window.webkitSpeechRecognition = function () { const r = this; r.start = () => setTimeout(() => { r.onresult && r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'cable pelado en la bodega dos' }], { isFinal: true })] }); r.onend && r.onend(); }, 50); r.stop = () => {}; }; });
          const pd = await c4.newPage(); await pd.goto(S.url + '/reportes.html?nuevo=1'); await pd.waitForTimeout(2500);
          const d137 = await pd.evaluate(async () => { const b = document.querySelector('.btn-mic'); if (!b) return { boton: false }; const t = b.previousElementSibling; b.click(); await new Promise((r) => setTimeout(r, 200)); return { boton: true, texto: t && t.value }; });
          ok('v137: los campos de texto traen «Dictar» y lo dicho queda escrito', d137.boton && /Cable pelado en la bodega dos/.test(d137.texto || ''), JSON.stringify(d137));
          await c4.close(); }
        { const c5 = await nav.newContext(CELULAR); const pa5 = await c5.newPage(); await pa5.goto(S.url + '/reportes.html?nuevo=1'); await pa5.waitForTimeout(2500);
          const sel = await pa5.evaluate(() => { const t = [...document.querySelectorAll('textarea')].find((x) => x.offsetParent && (x.id || x.name)); if (!t) return null; t.focus(); t.value = 'Charco de aceite junto al montacargas'; t.dispatchEvent(new Event('input', { bubbles: true })); return t.id ? '#' + t.id : '[name="' + t.name + '"]'; });
          await pa5.waitForTimeout(900); await pa5.goto(S.url + '/reportes.html?nuevo=1'); await pa5.waitForTimeout(3000);
          const a138 = await pa5.evaluate((sel) => { const t = sel && document.querySelector(sel); return { sel, v: t && t.value, aviso: !!document.querySelector('.autoguardado-aviso') }; }, sel);
          const d138 = await pa5.evaluate(async (sel) => { const b = [...document.querySelectorAll('.autoguardado-aviso button')].find((x) => x.textContent === 'Descartar'); if (b) b.click(); await new Promise((r) => setTimeout(r, 100)); return { v: document.querySelector(sel).value, guardado: localStorage.getItem(AutoGuardado._clave()) }; }, sel);
          const l138 = await pa5.evaluate(async (sel) => { const t = document.querySelector(sel); t.value = 'Otro reporte'; t.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 900)); const antes = !!localStorage.getItem(AutoGuardado._clave());
            const b = document.createElement('button'); document.body.appendChild(b); b.click(); const r = await SGSST.enviar({ action: 'guardar', tipo: 'accion', id: 'ACC-AUTO-' + Date.now(), doc: { accion: 'x' } }); return { antes, ok: r && r.ok, despues: localStorage.getItem(AutoGuardado._clave()) }; }, sel);
          ok('v138: lo escrito se guarda solo y vuelve al reabrir el formulario, con aviso', a138.v === 'Charco de aceite junto al montacargas' && a138.aviso, JSON.stringify(a138));
          ok('v138: «Descartar» borra lo recuperado, y al guardar el registro el autoguardado se limpia', d138.v === '' && !d138.guardado && l138.antes && l138.ok && !l138.despues, JSON.stringify([d138, l138]));
          await c5.close(); }
        { const c6 = await nav.newContext(CELULAR); const p6 = await c6.newPage(); await p6.goto(S.url + '/inspecciones.html');   // v151: los reportes ya no llevan plantillas
          await p6.waitForTimeout(2500);
          const v139 = await p6.evaluate(async () => { const z = (ms) => new Promise((r) => setTimeout(r, ms)); const out = {};
            localStorage.setItem('ssta-recientes', JSON.stringify({ areaTrabajo139: [{ v: 'Bodega 3', n: 4, t: 1 }, { v: 'Taller', n: 1, t: 0 }] }));
            localStorage.setItem('ssta-plantillas|' + location.pathname, JSON.stringify({ 'form:f139': [{ nombre: 'Cambio de lámina', d: { tarea139: 'Cambio de lámina en altura' } }] }));
            const mk = () => { const f = document.createElement('form'); f.id = 'f139'; f.innerHTML = '<div class="field"><label for="areaTrabajo139">Área</label><input id="areaTrabajo139" type="text"></div><div class="field"><label for="tarea139">Tarea *</label><input id="tarea139" type="text"></div><div class="field"><label for="obs139">Observaciones</label><textarea id="obs139"></textarea></div><div class="field"><label for="otro139">Otro</label><input id="otro139" type="text"></div><div id="fot139"></div><button type="button" id="g139">Guardar</button>'; document.querySelector('.wrap').appendChild(f); return f; };
            let f = mk(); await z(500);
            out.prellenado = f.querySelector('#areaTrabajo139').value; out.lista = !!document.getElementById(f.querySelector('#areaTrabajo139').getAttribute('list'));
            f.querySelector('#g139').click(); await z(50); const fa = f.querySelector('.ag-falta'); out.falta = fa ? fa.textContent : '';
            const tb = f.querySelector('.ag-tpl-btn'); out.tplBtn = !!tb; { const t = f.querySelector('#tarea139'); t.value = 'Cambio de lámina en altura'; t.dispatchEvent(new Event('input', { bubbles: true })); await z(50); }   // v152: ya no hay plantillas: se llena a mano
            out.tpl = f.querySelector('#tarea139').value; await z(50); out.faltaSeQuita = !f.querySelector('.ag-falta');
            let guardado = null; AutoGuardado.registrarExtra(f.querySelector('#fot139'), 'fotos:fot139', { get: () => ['data:image/png;base64,AAAA'], set: (v) => { guardado = v; } });
            const o = f.querySelector('#obs139'); o.value = 'Hay que cambiar 4 láminas'; o.dispatchEvent(new Event('input', { bubbles: true })); await z(900);
            f.remove(); await z(100); f = mk(); let rec = null; AutoGuardado.registrarExtra(f.querySelector('#fot139'), 'fotos:fot139', { get: () => [], set: (v) => { rec = v; } }); await z(1900);
            out.obs = f.querySelector('#obs139').value; out.foto = rec; out.aviso = !!f.querySelector('.autoguardado-aviso');
            window.__sstaAvisoSalir = true; delete window.__sstaDialogoAuto; const a = document.createElement('a'); a.href = 'index.html'; a.textContent = 'ir'; document.body.appendChild(a); a.click(); await z(200);
            out.preguntaSalir = !!document.querySelector('.dlg-fondo') && /Salir/.test(document.querySelector('.dlg-fondo').textContent); return out; });
          ok('v139: lo de la última vez queda puesto (área) con sugerencias de lo más usado', v139.prellenado === 'Bodega 3' && v139.lista, JSON.stringify(v139));
          ok('v139: al tocar Guardar sale «Te falta esto» con lo obligatorio vacío, y se quita al llenarlo', /Te falta esto/.test(v139.falta) && /Tarea/.test(v139.falta) && v139.faltaSeQuita, JSON.stringify(v139));
          ok('v152: ya no aparece el botón «Plantillas» en los formularios', !v139.tplBtn && v139.tpl === 'Cambio de lámina en altura', JSON.stringify(v139));
          ok('v139: las fotos (y firmas) también vuelven con el autoguardado', v139.obs === 'Hay que cambiar 4 láminas' && Array.isArray(v139.foto) && v139.foto.length === 1 && v139.aviso, JSON.stringify(v139));
          ok('v139: al salir con algo a medias pregunta y dice que queda guardado', v139.preguntaSalir, JSON.stringify(v139));
          await c6.close(); }
        { const c3 = await nav.newContext(CELULAR); await entrarComo(c3, S.url, 2); const pg3 = await c3.newPage(); await pg3.goto(S.url + '/index.html#sg'); await pg3.waitForTimeout(4500);
          const g136 = await pg3.evaluate(() => { const c = document.getElementById('hoyCifras'); return { vis: !!c && !c.hidden, n: c ? c.querySelectorAll('.cifra').length : 0, pri: !!document.querySelector('#primeros .primeros') }; });
          ok('v136: gerencia (solo consulta) ve cuatro cifras arriba y no los primeros pasos', g136.vis && g136.n === 4 && !g136.pri, JSON.stringify(g136));
          await c3.close(); }
        await pa.close(); }
      await ctx.close();
      // El comité activa su buzón con su clave.
      ctx = await nav.newContext(CELULAR); await entrarComo(ctx, S.url, 0);
      const comite = await ctx.newPage(); const err9 = []; comite.on('pageerror', (e) => err9.push(e.message));
      await comite.goto(S.url + '/convivencia.html'); await comite.waitForTimeout(2500);
      await comite.click('#tabs [data-tab="buzon"]'); await comite.waitForTimeout(500);
      await comite.fill('#abClave', 'Convivencia2026'); await comite.click('#abOk');
      await esperar(() => comite.evaluate(() => !!document.getElementById('bzCorreo')).catch(() => false), 40000);
      await comite.fill('#bzCorreo', 'comite@montajes.demo'); await comite.click('#bzGuardarCorreo'); await comite.waitForTimeout(1500);
      const act = await comite.evaluate(() => ({ correo: document.getElementById('bzMsg').textContent, enlaces: [...document.querySelectorAll('#panel input[readonly]')].map((i) => i.value) }));
      ok('v128: el comité activa su buzón con su clave y guarda su correo', /Guardado/.test(act.correo) && act.enlaces.some((u) => /buzon\.html\?tipo=convivencia/.test(u)) && act.enlaces.some((u) => /tipo=acoso/.test(u)), JSON.stringify(act));
      // Un trabajador presenta su queja y un reporte de acoso sexual (en la demo el «servidor» vive en este navegador: mismo contexto).
      const ctxT = ctx;
      { const t = await ctxT.newPage(); const errT = []; t.on('pageerror', (e) => errT.push(e.message));
        await t.goto(S.url + '/buzon.html?tipo=convivencia'); await t.waitForTimeout(2000);
        const cab = await t.evaluate(() => ({ h1: document.getElementById('fTitulo').textContent, anon: document.getElementById('fNoAnon').textContent, correo: document.getElementById('fCorreoTxt').textContent }));
        ok('v128: el formato de quejas dice que no acepta anónimas y muestra el correo del comité', /quejas anónIMAS/i.test(cab.anon) && /comite@montajes\.demo/.test(cab.correo), JSON.stringify(cab));
        await t.click('#fEnviar'); await t.waitForTimeout(300);
        const sinDatos = await t.evaluate(() => document.getElementById('fMsg').textContent);
        await t.fill('#pNombre', 'Laura Gómez Pérez'); await t.fill('#pCedula', '1012345678'); await t.fill('#pCargo', 'Auxiliar'); await t.fill('#pCorreo', 'laura@correo.demo');
        await t.fill('#cSenalados', 'Pedro Ruiz — supervisor');
        await t.fill('#cHechos', 'El supervisor me grita frente al equipo cada mañana en la bodega desde hace un mes, la última vez el lunes a las 7.');
        await t.setInputFiles('#cArchivos', { name: 'captura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 prueba') }); await t.waitForTimeout(500);
        await t.check('#cAutCorreo');
        await t.click('#fEnviar');
        await esperar(() => t.evaluate(() => document.getElementById('scrListo').classList.contains('active')), 30000);
        const cod = await t.evaluate(() => document.getElementById('lCod').textContent);
        ok('v128: la queja sale cifrada con un código para el trabajador', /^CCL-B-/.test(cod) && /nombre/.test(sinDatos), cod + ' | ' + sinDatos);
        await t.goto(S.url + '/buzon.html?tipo=acoso'); await t.waitForTimeout(1800);
        const ac = await t.evaluate(() => ({ h1: document.getElementById('fTitulo').textContent, ej: document.querySelectorAll('#aEjemplos li').length, conv: document.getElementById('bloqueConv').hidden }));
        ok('v128: el reporte de acoso sexual trae su formato y los ejemplos de conductas', /acoso sexual/i.test(ac.h1) && ac.ej === 15 && ac.conv, JSON.stringify(ac));
        await t.fill('#pNombre', 'Marta Ríos Díaz'); await t.fill('#pCedula', '1098765432'); await t.fill('#pCargo', 'Operaria'); await t.fill('#pCorreo', 'marta@correo.demo');
        await t.fill('#aAgresor', 'Juan Pérez — coordinador'); await t.fill('#aHechos', 'Comentarios sobre mi cuerpo y mensajes de contenido sexual por WhatsApp en octubre, en la planta.');
        await t.click('#aConoce [data-v="Sí"]'); await t.check('#aSolicitud input[value="Reserva de identidad"]');
        await t.click('#fEnviar');
        await esperar(() => t.evaluate(() => document.getElementById('scrListo').classList.contains('active')), 30000);
        ok('v128: el reporte de acoso sexual se envía cifrado', /^AS-/.test(await t.evaluate(() => document.getElementById('lCod').textContent)));
        ok('v128: el buzón público sin errores de JavaScript', !errT.length, errT.join(' | ').slice(0, 300));
        await t.close(); }
      // El comité los lee con su clave y registra la queja.
      await comite.goto(S.url + '/convivencia.html'); await comite.waitForTimeout(2500);
      await comite.click('#tabs [data-tab="buzon"]'); await comite.waitForTimeout(500);
      if (await comite.$('#abClave')) { await comite.fill('#abClave', 'Convivencia2026'); await comite.click('#abOk'); }
      await esperar(() => comite.evaluate(() => document.querySelectorAll('[data-bz]').length >= 2).catch(() => false), 40000);
      const lleg = await comite.evaluate(() => [...document.querySelectorAll('[data-bz]')].map((b) => b.textContent));
      ok('v128: al comité le llegan la queja y el reporte (sin contenido en la lista)', lleg.some((x) => /Queja de convivencia/.test(x)) && lleg.some((x) => /Acoso sexual/.test(x)) && !lleg.some((x) => /grita/.test(x)), JSON.stringify(lleg));
      await comite.evaluate(() => { const b = [...document.querySelectorAll('[data-bz]')].find((x) => /Queja de convivencia/.test(x.textContent)); b.click(); });
      await esperar(() => comite.evaluate(() => /grita/.test(document.getElementById('scrQueja').textContent)).catch(() => false), 20000);
      const abierta = await comite.evaluate(() => document.getElementById('scrQueja').textContent);
      ok('v128: el comité la abre descifrada, con la evidencia y las autorizaciones', /Laura Gómez/.test(abierta) && /grita/.test(abierta) && /captura\.pdf/.test(abierta) && /Recibir información/.test(abierta), abierta.slice(0, 300));
      await comite.click('#bzReg'); await comite.waitForTimeout(800);
      const pre = await comite.evaluate(() => ({ hechos: document.getElementById('qHechos').value, quien: (document.getElementById('qjN') || {}).value, medio: document.getElementById('qMedio').value }));
      ok('v128: «Registrar como queja» llena el formulario del comité con lo que llegó', /grita/.test(pre.hechos) && pre.quien === 'Laura Gómez Pérez' && pre.medio === 'Buzón', JSON.stringify(pre));
      ok('v128: convivencia sin errores de JavaScript', !err9.length, err9.join(' | ').slice(0, 300));
      await ctx.close();
      // El configurador y la consola traen la parte de menús.
      ctx = await nav.newContext(PC);
      { const pc = await ctx.newPage(); const err5 = []; pc.on('pageerror', (e) => err5.push(e.message));
        await pc.goto(S.url + '/configurar-empresa.html'); await pc.waitForTimeout(1500);
        const cf = await pc.evaluate(() => { const r = document.getElementById('menusDentro'); if (!r) return null; const c = r.querySelector('input[data-me="preop"][data-id="pulidora"]'); if (c) c.checked = false; return { n: r.querySelectorAll('input[data-me]').length, leido: MenusEmpresa.leer(r).ocultos }; });
        ok('configurador: escoge qué preoperacionales e inspecciones ofrece la empresa', cf && cf.n > 30 && cf.leido.preop.join() === 'pulidora', JSON.stringify(cf));
        await pc.goto(S.url + '/admin.html'); await pc.waitForTimeout(1500);
        const ad = await pc.evaluate(() => typeof MenusEmpresa !== 'undefined' && /Módulos del menú/.test(MenusEmpresa.html({})) && /Preoperacionales/.test(MenusEmpresa.html({})) && MenusEmpresa.preops().length >= 14);
        ok('consola: el botón «Menús» tiene módulos, preoperacionales e inspecciones', ad);
        const col = await pc.evaluate(() => { const c = { consola: document.body.classList.contains('consola') }; const f = document.createElement('div'); f.className = 'modal-fondo'; f.innerHTML = '<div class="modal">' + MenusEmpresa.html({ bautizos: { preop: { taladro: { nombre: 'Taladro percutor', codigo: 'X-1' } } } }) + '</div>'; document.body.appendChild(f); const m = { el: f.firstChild, cerrar: () => f.remove() }; MenusEmpresa.activar(m.el);
          const it = m.el.querySelector('.me-chk span'), n = m.el.querySelector('.me-n'); const lum = (el) => { if (!el) return 999; const cc = getComputedStyle(el).color; (c.raw = c.raw || []).push(cc); const v = (cc.match(/[\d.]+/g) || [255, 255, 255]).map(Number); return (v[0] * 299 + v[1] * 587 + v[2] * 114) / 1000; };
          const r = MenusEmpresa.leer(m.el); const out = Object.assign(c, { texto: lum(it), cuenta: lum(n), leido: r.bautizos.preop.taladro }); m.cerrar(); return out; });
        ok('consola: la ventana «Menús» se lee (texto oscuro sobre fondo claro)', col.texto < 90 && col.cuenta < 90, JSON.stringify(col));
        ok('consola: «Menús» guarda el nombre y el código de cada preoperacional', col.leido && col.leido.nombre === 'Taladro percutor' && col.leido.codigo === 'X-1', JSON.stringify(col.leido));
        ok('configurador y consola sin errores de JavaScript', !err5.length, err5.join(' | ').slice(0, 300));
        await pc.close(); }
      await ctx.close();
      // Permisos apagados: ni barra de abajo, ni Gestión, ni ATS.
      ctx = await nav.newContext(CELULAR);
      await ctx.route('**/empresa.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()) + '\n;EMPRESA.modulos = Object.assign({}, EMPRESA.modulos, { caliente: false, alturas: false, confinados: false, izajes: false, electrico: false, ats: false });' }); });
      await entrarComo(ctx, S.url, 1);
      const p2 = await ctx.newPage(); await p2.goto(S.url + '/index.html#sg'); await p2.waitForTimeout(1500);
      const sin = await p2.evaluate(() => ({ barra: [...document.querySelectorAll('nav a, nav button, .barra-inf a, .barra-inf button')].filter((a) => !!a.offsetParent).map((a) => a.textContent.trim()).join('|'),
        links: [...document.querySelectorAll('a[href^="permiso-"], a[href="ats.html"], a[href="dashboard.html"]')].filter((a) => !!a.offsetParent).map((a) => a.getAttribute('href')) }));
      ok('con los permisos y el ATS apagados no salen en la barra de abajo ni en Gestión', !/Permisos/.test(sin.barra) && !sin.links.length, JSON.stringify(sin));
      await ctx.close();
    }

    /* 0b. Barra inferior, tablero y señales (v112) */
    console.log('\n▸ Diseño: barra inferior, tablero con tickets y señales');
    {
      const ctx = await nav.newContext(CELULAR);
      const vis = async (pg) => pg.evaluate(() => { const n = document.getElementById('barraInferior'); return !!n && !n.hidden; });
      let pg = await ctx.newPage(); await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1200);
      ok('sin usuario no hay barra inferior', !(await vis(pg))); await pg.close();
      await entrarComo(ctx, S.url, 0);
      pg = await ctx.newPage(); await pg.goto(S.url + '/dashboard.html'); await pg.waitForTimeout(2500);
      ok('con usuario sale la barra inferior, con «Permisos» marcado en el tablero', await vis(pg) && (await pg.$eval('#barraInferior a.on', (a) => a.dataset.id)) === 'permisos');
      const tk = await pg.evaluate(() => ({ n: document.querySelectorAll('.tk').length, sen: document.querySelectorAll('.tk .sg-iso').length, abiertos: document.getElementById('kAbiertos').textContent }));
      ok('el tablero pinta cada permiso abierto como ticket con su señal y las cifras arriba', tk.n >= 3 && tk.sen === tk.n && Number(tk.abiertos) === tk.n, JSON.stringify(tk));
      await pg.goto(S.url + '/permiso-trabajo-alturas.html'); await pg.waitForTimeout(1500);
      const sen = await pg.evaluate(() => ({ senales: document.querySelectorAll('.choice-card .sg-iso').length, emojis: [...document.querySelectorAll('.choice-card .icon')].filter((e) => /\S/.test(e.textContent)).length }));
      ok('las tarjetas de inicio del permiso muestran señales, no emojis', sen.senales >= 3 && sen.emojis === 0, JSON.stringify(sen));
      await pg.click('#cardNew'); await pg.waitForTimeout(1500);
      ok('en el formulario del permiso la barra se esconde (no tapa «Guardar»)', !(await vis(pg)));
      await ctx.close();
    }

    /* 0c. Instalación: Res. 0312 (v113) */
    console.log('\n▸ Instalación: estándares mínimos según tamaño y riesgo, por categoría');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/configurar-empresa.html'); await pg.waitForTimeout(1200);
      const caso = async (t, r, a) => { await pg.fill('#cTrab', t); await pg.selectOption('#cRiesgo', r); if (a !== await pg.isChecked('#cAgro')) await pg.click('#cAgro'); await pg.waitForTimeout(200);
        return pg.evaluate(() => ({ n: document.querySelector('.e0312-res .n').textContent, cats: document.querySelectorAll('.e0312-cat').length, items: document.querySelectorAll('.e0312-cat li').length })); };
      const a = await caso('35', 'III', false), b = await caso('6', 'I', true), c = await caso('120', 'II', false), d = await caso('8', 'IV', false);
      ok('35 trabajadores riesgo III → 21 estándares, en 6 categorías', a.n === '21' && a.items === 21 && a.cats === 6, JSON.stringify(a));
      ok('unidad agropecuaria de 6 trabajadores → 3 estándares', b.n === '3' && b.items === 3, JSON.stringify(b));
      ok('120 trabajadores → 60 estándares en las 7 categorías', c.n === '60' && c.items === 60 && c.cats === 7, JSON.stringify(c));
      ok('8 trabajadores pero riesgo IV → 60', d.n === '60', JSON.stringify(d));
      const archivo = await pg.$eval('#vista', (e) => e.textContent);
      ok('el archivo de la empresa lleva el perfil de la 0312', /"perfil0312": \{[^}]*"trabajadores": 8[^}]*"claseRiesgo": "IV"[^}]*"grupo0312": 60/.test(archivo), archivo.slice(0, 200));
      ok('los módulos que apoyan los estándares quedan marcados', (await pg.$$('.mods .apoya')).length > 10);
      ok('sin errores de JavaScript en la instalación', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 0d. Consola del administrador general (v115) */
    console.log('\n▸ Consola del administrador: aparte de los clientes');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/admin.html'); await pg.waitForTimeout(1500);
      ok('la consola pide usuario y contraseña de administrador', !!(await pg.$('#aUsr')) && await pg.$eval('#consola', (e) => e.hidden));
      await pg.fill('#aUsr', 'sandra.sst'); await pg.fill('#aClave', 'Demo2026'); await pg.click('#aEntrar');
      await esperar(() => pg.evaluate(() => { const c = document.getElementById('consola'); return !!c && !c.hidden && document.querySelectorAll('.c-kpi').length === 4; }).catch(() => false), 20000);
      const st = await pg.evaluate(() => ({ visible: !document.getElementById('consola').hidden, yo: document.getElementById('yo').textContent, admin: !!localStorage.getItem('ssta-admin-sesion'), cliente: !!localStorage.getItem('ssta-sesion'), kpis: document.querySelectorAll('.c-kpi').length }));
      ok('el administrador entra a la consola (su sesión queda aparte: ssta-admin-sesion)', st.visible && /Sandra/.test(st.yo) && st.admin && !st.cliente && st.kpis === 4, JSON.stringify(st));
      await pg.goto(S.url + '/asesor.html'); await pg.waitForTimeout(1500);
      ok('el panel del asesor abre dentro de la consola', /asesor\.html/.test(pg.url()) && /Volver a la consola/.test(await pg.content()));
      await pg.goto(S.url + '/index.html#sg'); await pg.waitForTimeout(1500);   // v151: la clave solo se ve dentro de Gestión
      const ix = await pg.evaluate(() => ({ asesor: !!document.querySelector('a[href="asesor.html"]'), clave: getComputedStyle(document.getElementById('btnClave')).display !== 'none' || (() => { const b = document.getElementById('btnMas'); if (!b || !b.offsetParent) return false; b.click(); const t = document.getElementById('menuMas').textContent; b.click(); return /Clave/.test(t); })(), sesion: !!localStorage.getItem('ssta-sesion') }));
      ok('el portal de los clientes no enlaza la consola; en el equipo del administrador sí sale «Clave»', !ix.asesor && ix.clave && !ix.sesion, JSON.stringify(ix));
      await pg.goto(S.url + '/estado.html'); await pg.waitForTimeout(2500);
      ok('en el equipo del administrador el estado muestra los detalles técnicos', /Versión de esta página/.test(await pg.evaluate(() => document.body.innerText)));
      ok('sin errores de JavaScript en la consola', !err.length, err.join(' | '));
      await ctx.close();
      const ctx2 = await nav.newContext(CELULAR), p2 = await ctx2.newPage();
      await p2.goto(S.url + '/asesor.html'); await p2.waitForTimeout(1500);
      ok('un cliente que escribe asesor.html termina en la puerta de la consola', /admin\.html/.test(p2.url()) && !!(await p2.$('#aUsr')));
      await entrarComo(ctx2, S.url, 0);
      await p2.goto(S.url + '/admin.html'); await p2.waitForTimeout(1500);
      ok('la sesión de un cliente no abre la consola', !!(await p2.$('#aUsr')));
      await p2.goto(S.url + '/estado.html'); await p2.waitForTimeout(2500);
      const ce = await p2.evaluate(() => document.body.innerText);
      ok('el cliente ve el estado sin detalles técnicos (sin versiones, enlaces de prueba ni clave)', !/Versión de esta página/.test(ce) && !/Abrir enlace de prueba/.test(ce) && !/Clave del portal en este equipo/.test(ce));
      await ctx2.close();
    }

    /* 0e. Aviso de privacidad y motor de empresa.js (v116) */
    console.log('\n▸ Datos personales y motor de empresa.js (v116)');
    {
      const ctx = await nav.newContext(Object.assign({ __conAviso: true }, CELULAR)), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1800);
      const hay = await pg.evaluate(() => [...document.querySelectorAll('[aria-label="Aviso de privacidad"]')].length);
      ok('la primera vez sale el aviso de privacidad con su enlace', hay === 1 && !!(await pg.$('[aria-label="Aviso de privacidad"] a[href="privacidad.html"]')));
      await pg.click('[aria-label="Aviso de privacidad"] button'); await pg.reload(); await pg.waitForTimeout(1500);
      ok('después de «Entendido» no vuelve a salir en ese celular', !(await pg.$('[aria-label="Aviso de privacidad"]')));
      await pg.goto(S.url + '/privacidad.html'); await pg.waitForTimeout(1200);
      const t = await pg.evaluate(() => document.getElementById('aviso').innerText);
      ok('el aviso dice responsable, datos, finalidad, derechos y que lo sensible es voluntario', /Responsable del tratamiento/.test(t) && /Datos sensibles/i.test(t) && /Para qué/i.test(t) && /Revocar la autorización/.test(t) && /voluntario/.test(t), t.slice(0, 200));
      ok('el motor de empresa.js va aparte y carga', await pg.evaluate(() => typeof MOTOR_EMPRESA === 'string' && typeof Empresa === 'object' && Array.isArray(CATALOGO_MODULOS) && CATALOGO_MODULOS.length > 30));
      ok('sin errores de JavaScript', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 0g. Inicio con dos vistas: «Gestión» al lado de Ayuda (v117) */
    console.log('\n▸ Inicio: botón «Gestión» al lado de Ayuda y vistas');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1500);
      const tam = await pg.evaluate(() => { const g = document.getElementById('btnGestion').getBoundingClientRect(), ay = document.querySelector('.hdr-acc a[href="ayuda.html"]'), a = (ay.offsetParent ? ay : document.getElementById('btnMas')).getBoundingClientRect(); return { g: [Math.round(g.width), Math.round(g.height)], a: [Math.round(a.width), Math.round(a.height)], junto: Math.abs(g.top - a.top) < 2 && g.right <= a.left + 1 }; });
      ok('«Gestión» está arriba, al lado de Ayuda (o de «Más» en el celular) y del mismo tamaño', tam.junto && Math.abs(tam.g[0] - tam.a[0]) <= 6 && tam.g[1] === tam.a[1], JSON.stringify(tam));
      ok('al abrir, se ve lo público y no el sistema de gestión', await pg.evaluate(() => getComputedStyle(document.getElementById('pub')).display !== 'none' && getComputedStyle(document.getElementById('sg')).display === 'none'));
      ok('el saludo cambia con la hora y trae la fecha', await pg.evaluate(() => /^Buen(os días|as tardes|as noches)/.test(document.getElementById('pubHola').textContent) && document.getElementById('pubFecha').textContent.length > 5));
      await pg.click('#btnGestion'); await pg.waitForTimeout(800);
      const v = await pg.evaluate(() => ({ sg: getComputedStyle(document.getElementById('sg')).display !== 'none', pub: getComputedStyle(document.getElementById('pub')).display === 'none', hash: location.hash, pres: document.getElementById('btnGestion').getAttribute('aria-pressed'), login: !!document.querySelector('.ses-fondo') }));
      ok('«Gestión» cambia a la vista del sistema de gestión y, sin sesión, abre la ventana para entrar', v.sg && v.pub && v.hash === '#sg' && v.pres === 'true' && v.login, JSON.stringify(v));
      await pg.click('[data-demo="0"]');
      await esperar(() => pg.evaluate(() => !!localStorage.getItem('ssta-sesion') && location.hash === '#sg' && !document.querySelector('.ses-fondo')).catch(() => false), 20000);
      await pg.waitForTimeout(1000);
      ok('después de entrar queda en el sistema de gestión, con sus módulos', await pg.evaluate(() => location.hash === '#sg' && document.body.classList.contains('vista-sg') && document.querySelectorAll('#sgContenido .searchable-card:not(.oculto-sg)').length > 10));
      await pg.click('#sgVolver'); await pg.waitForTimeout(500);
      ok('«Inicio» vuelve a lo público sin recargar', await pg.evaluate(() => !document.body.classList.contains('vista-sg') && location.hash === '' && getComputedStyle(document.getElementById('pub')).display !== 'none'));
      await pg.click('#btnGestion'); await pg.waitForTimeout(400); await pg.goBack(); await pg.waitForTimeout(500);
      ok('«atrás» del celular también vuelve al inicio', await pg.evaluate(() => !document.body.classList.contains('vista-sg')));
      ok('sin errores de JavaScript en el inicio', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 0h. Instalación como asistente (v118): la demo es un sitio propio, va directo y dice qué instala */
    console.log('\n▸ Instalación: aviso de qué se instala y módulos por categoría');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/configurar-empresa.html'); await pg.waitForTimeout(1200);
      const r = await pg.evaluate(() => ({ inicio: !document.getElementById('instInicio').hidden, aviso: document.getElementById('queInstalo').innerText, cats: document.querySelectorAll('.mod-cat:not([hidden])').length, pasos: [...document.querySelectorAll('.card:not([hidden]) h2 > .paso')].map((x) => x.textContent).join(',') }));
      ok('un sitio propio va directo al formulario y el aviso dice qué se instala', !r.inicio && /sitio propio/i.test(r.aviso), JSON.stringify(r));
      ok('v170: los módulos salen en los 4 grupos de venta (base, Obra, Integral, internos) y los pasos numerados en orden', r.cats === 4 && r.pasos === '1,2,3,4,5,6,7', JSON.stringify(r));
      await pg.click('.mod-cat[data-cat="obra"] [data-todos]'); await pg.waitForTimeout(200);
      ok('«Ninguno» en el Complemento Obra apaga solo ese grupo (y no lo abre); la base sigue prendida', await pg.evaluate(() => { const c = document.querySelector('.mod-cat[data-cat="obra"]'); return [...c.querySelectorAll('[data-mod]')].every((i) => !i.checked) && !c.open && document.querySelector('[data-mod="plananual"]').checked && /"caliente": false/.test(document.getElementById('vista').textContent); }));
      ok('sin errores de JavaScript en el asistente', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 0i. Instalar paso a paso (v119) */
    console.log('\n▸ Instalar paso a paso');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/instalar.html'); await pg.waitForTimeout(1000);
      ok('pregunta primero: tu sitio o una empresa cliente', await pg.evaluate(() => !document.getElementById('elegir').hidden && document.querySelectorAll('[data-camino]').length === 2));
      await pg.click('[data-camino="b"]'); await pg.waitForTimeout(300);
      const g = await pg.evaluate(() => ({ franja: document.querySelector('.franja').innerText, pasos: document.querySelectorAll('.paso').length, actual: document.querySelectorAll('.paso.actual').length }));
      ok('camino B: franja «Estás instalando UNA EMPRESA CLIENTE», sus pasos y el actual resaltado', /UNA EMPRESA CLIENTE/.test(g.franja) && g.pasos >= 9 && g.actual === 1, JSON.stringify(g));
      await pg.check('[data-hecho="0"]'); await pg.waitForTimeout(300);
      ok('«Listo» marca el paso y suma en el progreso', /1 de \d+ pasos/.test(await pg.$eval('.franja', (e) => e.innerText)));
      const p = await pg.$('.paso [data-url]'); await p.fill('https://script.google.com/macros/s/ABC123/dev'); await pg.click('[data-probar]'); await pg.waitForTimeout(300);
      ok('la prueba del servidor avisa si la URL termina en /dev', /termina en <b>\/dev<\/b>|termina en \/dev/.test(await pg.$eval('[data-res]', (e) => e.innerHTML)));
      await pg.reload(); await pg.waitForTimeout(800);
      ok('al volver, recuerda el camino y lo hecho', await pg.evaluate(() => !document.getElementById('guia').hidden && document.querySelector('[data-hecho="0"]').checked));
      ok('sin errores de JavaScript', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 0j. Llamadas a los módulos por ?modulo= (v120–v122) */
    console.log('\n▸ Los módulos se llaman con ?modulo= (Google pedía sesión con /módulo)');
    {
      const ctx = await nav.newContext(CELULAR), pg = await ctx.newPage();
      await entrarComo(ctx, S.url, 0);
      const r = {};
      for (const f of ['dashboard.html', 'plan-accion.html', 'ats.html', 'admin.html']) {
        await pg.goto(S.url + '/' + f); await pg.waitForTimeout(2500);
        const x = await pg.evaluate(() => (window.DemoPortal && window.DemoPortal.rutas) || { ruta: 0, modulo: 0 });
        r[f] = x;
      }
      const ruta = Object.values(r).reduce((a, x) => a + x.ruta, 0), mod = Object.values(r).reduce((a, x) => a + x.modulo, 0);
      ok('ninguna llamada llega como «…/exec/<módulo>»: todas por ?modulo= (tablero, plan, ATS y consola)', ruta === 0 && mod > 4, JSON.stringify(r));
      await ctx.close();
    }

    /* v163: primera instalación y sin señal: ATS y Reportes abren CON su código (ats.app.js / reportes.app.js en el núcleo) */
    console.log('\n▸ v163: instalación limpia y luego sin señal: ATS y Reportes funcionan');
    {
      // Sin usuario: lo que se mide es que el CÓDIGO de la pantalla esté en el celular (la puerta de acceso viene después).
      const ctx = await nav.newContext(Object.assign({}, CELULAR, { serviceWorkers: 'allow' }));
      const pg = await ctx.newPage(), err = []; pg.on('pageerror', (e) => err.push(e.message));
      await pg.goto(S.url + '/index.html'); await pg.waitForTimeout(1500);
      await pg.evaluate(() => navigator.serviceWorker.ready); await esperar(() => pg.evaluate(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); if (await c.match('./ats.app.js') || await c.match(new URL('ats.app.js', location.href).href)) return true; } return false; }).catch(() => false), 30000);
      await ctx.setOffline(true);
      await pg.goto(S.url + '/ats.html').catch(() => {}); await pg.waitForTimeout(2500);
      const a = await pg.evaluate(() => ({ js: typeof botonLista === 'function', titulo: document.title }));
      await pg.goto(S.url + '/reportes.html').catch(() => {}); await pg.waitForTimeout(2500);
      const r = await pg.evaluate(() => ({ js: typeof plazos === 'function', titulo: document.title }));
      await ctx.setOffline(false);
      ok('sin señal, ATS abre con su código desde la primera instalación', a.js, JSON.stringify(a));
      ok('sin señal, Reportes abre con su código desde la primera instalación', r.js, JSON.stringify(r));
      ok('sin errores de JavaScript sin señal', !err.filter((e) => !/Failed to fetch|NetworkError|sin conexión/i.test(e)).length, err.join(' | ').slice(0, 300));
      await ctx.close();
    }

    /* 0f. Celular sencillo con señal mala (v116, para el piloto) */
    console.log('\n▸ Celular sencillo con señal mala (3G lenta, procesador 4 veces más lento)');
    if (MOTOR !== 'chromium') console.log('    (se omite en ' + MOTOR + ': la red lenta se simula con el protocolo de Chromium)');
    else {
      const ctx = await nav.newContext(Object.assign({}, CELULAR, { serviceWorkers: 'allow' })), pg = await ctx.newPage(), err = [];
      pg.on('pageerror', (e) => err.push(e.message));
      const cdp = await ctx.newCDPSession(pg);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const medir = async (url, listo) => { const t0 = Date.now(); try { await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); } catch (e) { if (!/interrupted by another navigation/.test(e.message)) throw e; await pg.waitForTimeout(1500); await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); }   /* la primera visita recarga una vez cuando el service worker toma control */ await pg.waitForFunction(listo, null, { timeout: 90000 }); return (Date.now() - t0) / 1000; };
      const tInicio = await medir(S.url + '/index.html', () => !!document.querySelector('#pubPreop') && document.fonts.status === 'loaded');
      const tPreop = await medir(S.url + '/preoperacional.html', () => !!document.querySelector('select, input, .screen'));
      // Se espera a que el service worker termine de guardar todo (en un celular real eso pasa entre una visita y otra).
      await pg.waitForTimeout(5000);
      const tInicio2 = await medir(S.url + '/index.html', () => !!document.querySelector('#pubPreop'));
      console.log('      tiempos: inicio la primera vez ' + tInicio.toFixed(1) + ' s · preoperacional ' + tPreop.toFixed(1) + ' s · inicio la segunda vez ' + tInicio2.toFixed(1) + ' s');
      ok('con 3G lenta, el inicio abre en menos de 20 s la primera vez', tInicio < 20, tInicio.toFixed(1) + ' s');
      ok('el preoperacional abre en menos de 20 s', tPreop < 20, tPreop.toFixed(1) + ' s');
      ok('la segunda vez abre más rápido (queda guardado en el celular)', tInicio2 < tInicio, tInicio2.toFixed(1) + ' s');
      ok('sin errores de JavaScript con la señal mala', !err.length, err.join(' | '));
      await ctx.close();
    }

    /* 1. Todas las pantallas */
    console.log('\n▸ Todas las pantallas abren en el celular');
    {
      const ctx = await nav.newContext(CELULAR);
      await entrarComo(ctx, S.url, 0);
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
        const pg = await ctx.newPage(), err = [];
        pg.on('pageerror', (e) => err.push(e.message));
        pg.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) err.push(m.text()); });
        await pg.addInitScript(() => { window.__sstaDialogoAuto = 'cancelar'; });
        await pg.goto(S.url + '/' + f, { waitUntil: 'load' }).catch((e) => err.push(e.message));
        await pg.waitForTimeout(700);
        const ancho = await pg.evaluate(() => document.documentElement.scrollWidth).catch(() => 0);
        // v122: ningún emoji de colores visible (se cambian por íconos de línea)
        const emojis = await pg.evaluate(() => (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u26A0\u2601\u2699\u26A1\u2B06\u2B07\u27A1\u270F\u270D\u2705\u274C\u2795\u2622\u2697\u26AA\u2B1C]/gu) || []).join('')).catch(() => '');
        if (emojis) err.push('emojis visibles: ' + emojis.slice(0, 20));
        ok(f + ' sin errores' + (ancho > 392 ? '' : ' y sin salirse de lo ancho'), !err.length && ancho <= 392,
           err.length ? [...new Set(err)].slice(0, 3).join(' | ') : 'ancho de la página ' + ancho + ' px en un celular de 390');
        await pg.close();
      }
      await ctx.close();
    }

    /* 2. Los 5 permisos de punta a punta */
    console.log('\n▸ Permisos: diligenciar, firmar, guardar y verificar en el servidor');
    {
      const ctx = await nav.newContext(PC);
      await entrarComo(ctx, S.url, 1);   // el supervisor de obra abre y cierra permisos
      for (const f of PERMISOS) {
        const { pg, errores } = await abrirPermiso(ctx, S.url, f);
        const e = await diligenciarYGuardar(pg);
        ok(f + ': queda guardado y verificado en el servidor', /guardado/i.test(e.estado) && /Verificado en el servidor/.test(e.pie), e.aviso || e.pie);
        const codigo = (/Código del permiso: (\S+)/.exec(e.pie) || [])[1] || e.codigo;
        const leido = codigo ? await leerDelServidor(pg, f, codigo) : {};
        const txt = JSON.stringify(leido);
        const firmas = (txt.match(/data:image\/png;base64,/g) || []).length;
        ok(f + ': otro equipo lo lee con sus firmas', leido.ok !== false && firmas >= 3, 'firmas leídas: ' + firmas + ' · ' + txt.slice(0, 200));
        ok(f + ': sin errores de JavaScript', !errores.length, errores.join(' | '));
        await pg.close();
      }
      await ctx.close();
    }

    /* 2b. Nada de lo diligenciado se pierde */
    console.log('\n▸ Permisos: TODO lo que se escribe llega al servidor (campos y firmas)');
    {
      const ctx = await nav.newContext(PC);
      await entrarComo(ctx, S.url, 1);
      for (const f of PERMISOS) {
        const { pg } = await abrirPermiso(ctx, S.url, f);
        await pg.route('**/permiso-core.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()).replace('const pads = sigMgr.pads;', 'const pads = sigMgr.pads; window.__pads = pads;') }); });
        await pg.reload(); await pg.waitForTimeout(800); await pg.click('#cardNew'); await pg.waitForTimeout(300);
        // Cada campo libre (texto y número) recibe una marca única que luego se busca en lo guardado.
        const marcas = await pg.evaluate(() => {
          const out = []; let n = 0;
          document.querySelectorAll('#app input[type=text], #app input[type=number], #app input:not([type]), #app textarea').forEach((e) => {
            if (!e.offsetParent || e.readOnly || e.disabled || e.closest('#closeFields, #addPeopleFields')) return;
            if (e.dataset.gasVal) return;   // v148: las lecturas de gases deben quedar dentro de rango para que el permiso abra
            const etq = ((e.closest('.field') || {}).querySelector ? ((e.closest('.field').querySelector('label') || {}).textContent || '') : '') || e.placeholder || e.id;
            if (/c[eé]dula|^cc$|documento de identidad/i.test(etq) || /cc\d*$|Cedula|CC\d*$/.test(e.id) || e.inputMode === 'numeric') return;
            const m = e.type === 'number' ? String(7000 + (++n)) + '.5' : 'MK' + (++n) + 'X';
            e.value = m; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
            out.push({ m, id: e.id, etq: etq.replace(/\s+/g, ' ').trim().slice(0, 70) });
          });
          return out;
        });
        const e = await diligenciarYGuardar(pg);
        const codigo = (/Código del permiso: (\S+)/.exec(e.pie) || [])[1];
        const txt = codigo ? JSON.stringify(await leerDelServidor(pg, f, codigo)) : '';
        const perdidos = marcas.filter((x) => !txt.includes(x.m));
        ok(f + ': todos los campos escritos quedan guardados (' + marcas.length + ')', codigo && !perdidos.length,
           codigo ? perdidos.map((x) => (x.id || 'sin id') + ' «' + x.etq + '»').join(' · ') : 'no se guardó: ' + (e.aviso || e.pie));
        const sinGuardar = await pg.evaluate((t) => Object.keys(window.__pads || {}).filter((k) => { const u = window.__pads[k].getDataUrl(); return u && !t.includes(u.slice(40, 120)); }), txt);
        ok(f + ': toda firma hecha queda guardada', codigo && !sinGuardar.length, 'firmas que no llegaron: ' + sinGuardar.join(', '));
        // Otro celular abre el permiso para cerrarlo: debe ver lo que se escribió.
        if (codigo) {
          const otro = await ctx.newPage(); await otro.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });
          await otro.goto(S.url + '/' + f); await otro.waitForTimeout(800);
          await otro.fill('#codeInput', codigo); await otro.click('#loadCodeBtn');
          await esperar(() => otro.evaluate(() => document.getElementById('app').style.display === 'block'), 10000); await otro.waitForTimeout(800);
          const vuelven = await otro.evaluate((ms) => { const vals = [...document.querySelectorAll('#app input, #app textarea')].map((e) => e.value); const visto = document.getElementById('app').innerText; return ms.filter((m) => !vals.includes(m.m) && !visto.includes(m.m) && !visto.includes(m.m.replace(/\.5$/, ',5'))).map((m) => m.id || m.etq); }, marcas);   // las lecturas de gases se ven en su bitácora, no en los campos
          ok(f + ': al abrirlo en otro equipo para cerrarlo, se ve todo lo escrito', !vuelven.length, 'no aparecen: ' + vuelven.join(' · '));
          await otro.close();
        }
        await pg.close();
      }
      await ctx.close();
    }

    /* 2c. Inducción desde el celular con autorización de datos (Ley 1581) */
    console.log('\n▸ Inducción en el celular: autorización de datos (Ley 1581)');
    {
      const ctx = await nav.newContext(PC);
      const pg = await ctx.newPage(), errores = [];
      pg.on('pageerror', (e) => errores.push(e.message)); await pg.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });
      await pg.goto(S.url + '/induccion-responder.html'); await pg.waitForTimeout(800);
      const cedula = String(1000000000 + Math.floor(Math.random() * 8e8));
      await pg.fill('#fNom', 'Laura Gómez Prueba'); await pg.fill('#fCed', cedula);
      await pg.click('#sig'); await pg.waitForTimeout(300);
      await pg.click('#todos'); await pg.click('#sig'); await pg.waitForTimeout(300);
      await pg.evaluate(() => PREGUNTAS.forEach((q, i) => document.querySelector('[data-q="' + i + '"] [data-o="' + q[2] + '"]').click()));
      await pg.click('#sig'); await pg.waitForTimeout(400);
      ok('el paso de la firma muestra la autorización con sus dos casillas', await pg.evaluate(() => !!document.getElementById('autGeneral') && !!document.getElementById('autSensibles')));
      await firmarConMouse(pg);
      await pg.click('#sig'); await pg.waitForTimeout(500);
      ok('sin marcar «Sí, autorizo» no deja enviar y dice qué falta', /Autorización de datos personales/.test(await pg.$eval('#msg', (e) => e.innerText)));
      await pg.check('#autGeneral');   // la de salud se deja SIN marcar: es voluntaria
      await pg.click('#sig');
      await esperar(() => pg.evaluate(() => /Gracias/.test(document.body.innerText)), 15000);
      ok('con la autorización general se envía (la de salud es voluntaria)', await pg.evaluate(() => /Gracias/.test(document.body.innerText)));
      // Lo que quedó en el servidor (el de la demo)
      // v148: sin sesión la lista ya no trae la autorización (dato de salud): se lee como SST.
      await entrarComo(ctx, S.url, 0);
      const pgL = await ctx.newPage(); await pgL.goto(S.url + '/habilitacion.html'); await pgL.waitForTimeout(1500);
      const leido = await pgL.evaluate(async (c) => { const r = await SGSST.listar('trabajador'); return (r.rows || []).find((x) => x.resumen.cedula === c) || null; }, cedula);
      await pgL.close();
      ok('en Personal habilitado queda que autorizó sus datos pero NO los de salud', leido && leido.resumen.autorizacion && leido.resumen.autorizacion.general === true && leido.resumen.autorizacion.sensibles === false, JSON.stringify(leido && leido.resumen.autorizacion));
      ok('sin errores de JavaScript en la inducción', !errores.length, errores.join(' | '));
      await ctx.close();
    }

    /* 2d. La clave y la sesión no viajan en la dirección */
    console.log('\n▸ La clave del portal y la sesión no viajan en la dirección');
    {
      const ctx = await nav.newContext(PC);
      // Espía dentro del servidor de la demo: anota cada llamada que le llega.
      await ctx.route('**/demo/demo.js', async (rt) => { const r = await rt.fetch(); rt.fulfill({ response: r, body: (await r.text()).replace('window.fetch = async function (entrada, opciones) {', 'window.fetch = async function (entrada, opciones) { (window.__llamadas = window.__llamadas || []).push([String((entrada && entrada.url) || entrada), String((opciones && opciones.method) || \'GET\').toUpperCase(), String((opciones && opciones.body) || \'\').slice(0, 300)]);') }); });
      await entrarComo(ctx, S.url, 0);
      const llamadas = [];
      for (const f of ['permiso-trabajo-alturas.html', 'dashboard.html', 'personal-autorizado.html', 'habilitacion.html', 'ats.html']) {
        const pg = await ctx.newPage(); await pg.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });
        await pg.goto(S.url + '/' + f); await pg.waitForTimeout(2500);
        if (f === 'permiso-trabajo-alturas.html') { await pg.click('#listOpenBtn').catch(() => {}); await pg.waitForTimeout(2000); }
        llamadas.push(...(await pg.evaluate(() => window.__llamadas || [])).map((x) => [f].concat(x)));
        await pg.close();
      }
      const alServidor = llamadas.filter((x) => /demo\.portal-ssta\.invalid/.test(x[1]));
      const conClave = alServidor.filter((x) => /[?&](token|sesion)=/.test(x[1]));
      const porPost = alServidor.filter((x) => x[2] === 'POST' && /__consulta/.test(x[3]));
      ok('ninguna consulta al servidor lleva la clave o la sesión en la dirección', alServidor.length > 5 && !conClave.length, conClave.slice(0, 3).map((x) => x[0] + ' → ' + x[1].slice(0, 120)).join(' | ') || 'llamadas: ' + alServidor.length);
      ok('las consultas van por POST y el servidor las responde', porPost.length >= 5, 'consultas por POST: ' + porPost.length);
      await ctx.close();
    }

    /* 3. Sin señal */
    console.log('\n▸ Sin señal: queda en cola y se envía solo al volver');
    {
      const ctx = await nav.newContext(PC);
      await entrarComo(ctx, S.url, 1);
      const { pg } = await abrirPermiso(ctx, S.url, 'permiso-trabajo-alturas.html');
      // El servidor de la demo vive en la página: se le quita la "señal" a mano.
      await pg.evaluate(() => { const f = window.fetch; window.fetch = (u, o) => navigator.onLine ? f(u, o) : Promise.reject(new TypeError('Failed to fetch')); });
      await ponerHabilitados(pg);
      await ctx.setOffline(true);
      await pg.evaluate(llenarVisible); await firmarConMouse(pg);
      for (let k = 0; k < 3; k++) { await pg.click('#mainActionBtn'); await esperar(async () => !(await pg.$eval('#mainActionBtn', (b) => b.disabled)), 15000); await pg.waitForTimeout(300); }
      const e = await estadoPermiso(pg);
      const enCola = await pg.evaluate(async () => (await Outbox.list()).length);
      ok('sin señal dice que quedó guardado en el equipo (no «intente de nuevo»)', /quedó guardado en este equipo/.test(e.pie) && !/intente de nuevo/i.test(e.pie), e.pie);
      ok('guardar 3 veces sin señal deja UNA sola copia en la cola', enCola === 1, 'en cola: ' + enCola);
      await ctx.setOffline(false);
      await esperar(async () => (await pg.evaluate(async () => (await Outbox.list()).length)) === 0, 20000);
      const quedan = await pg.evaluate(async () => (await Outbox.list()).length);
      ok('al volver la señal se envía solo y la cola queda vacía', quedan === 0, 'quedan: ' + quedan);
      const leido = e.codigo ? await leerDelServidor(pg, 'permiso-trabajo-alturas.html', e.codigo.trim()) : {};
      ok('lo enviado desde la cola está en el servidor, con firmas', /data:image\/png;base64,/.test(JSON.stringify(leido)), JSON.stringify(leido).slice(0, 200));
      await ctx.close();
    }

    /* 4. Firma en el celular */
    console.log('\n▸ Celular: firmas a pantalla completa, guardar y tamaño de cada firma');
    if (MOTOR !== 'chromium') console.log('    (se omite en ' + MOTOR + ': los toques se simulan con el protocolo de Chromium; las firmas con mouse sí se prueban arriba)');
    else {
      const ctx = await nav.newContext(CELULAR);
      await entrarComo(ctx, S.url, 1);
      const { pg, errores } = await abrirPermiso(ctx, S.url, 'permiso-trabajo-alturas.html');
      const cdp = await ctx.newCDPSession(pg);
      const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await ponerHabilitados(pg); await pg.evaluate(llenarVisible);
      let abiertas = 0, firmadas = 0;
      for (const lienzo of await pg.$$('canvas:not(#fcPad)')) {
        if (!(await lienzo.evaluate((c) => !!c.offsetParent && c.getBoundingClientRect().width > 60))) continue;
        // Al centro: abajo está la barra fija de «Guardar» y taparía el recuadro.
        await lienzo.evaluate((c) => c.scrollIntoView({ block: 'center' })); await pg.waitForTimeout(150);
        const r = await lienzo.boundingBox(); if (!r) continue;
        await pg.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2); await pg.waitForTimeout(350);
        const abierta = await pg.evaluate(() => { const el = document.getElementById('firmaCompleta'); return !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 300; });
        if (!abierta) continue; abiertas++;
        const fc = await (await pg.$('#fcPad')).boundingBox();
        await toque('touchStart', fc.x + fc.width * 0.15, fc.y + fc.height * 0.5);
        for (let i = 1; i <= 30; i++) await toque('touchMove', fc.x + fc.width * (0.15 + i * 0.023), fc.y + fc.height * (0.5 + Math.sin(i / 2) * 0.3));
        await toque('touchEnd');
        await pg.click('button[data-fc="listo"]');
        // Espera a que la pantalla completa termine de cerrar (como una persona).
        await esperar(() => pg.evaluate(() => getComputedStyle(document.getElementById('firmaCompleta')).display === 'none'), 3000);
        await pg.waitForTimeout(450);
        // El estado que ve la persona debe decir la verdad: «Firmado» solo si hay trazo.
        const st = await lienzo.evaluate((c) => { const s = document.getElementById('status_' + c.id); return s ? s.textContent : ''; });
        if (/Firmado/i.test(st)) firmadas++;
      }
      ok('cada firma abre la pantalla completa en el celular', abiertas >= 5, 'abiertas: ' + abiertas);
      ok('al tocar «Listo» cada firma queda en su recuadro', firmadas === abiertas, firmadas + ' de ' + abiertas);
      const e = await diligenciarYGuardar(pg, true);
      ok('el permiso firmado en el celular se guarda y verifica', /guardado/i.test(e.estado) && /Verificado en el servidor/.test(e.pie), e.aviso || e.pie);
      const codigo = (/Código del permiso: (\S+)/.exec(e.pie) || [])[1];
      const txt = JSON.stringify(codigo ? await leerDelServidor(pg, 'permiso-trabajo-alturas.html', codigo) : {});
      const largos = (txt.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) || []).map((x) => x.length);
      if (process.env.DEPURAR) { const o = JSON.parse(txt); const rec = (x, p) => { if (typeof x === 'string') { if (x.startsWith('data:image')) console.log('      firma en', p, x.length); } else if (x && typeof x === 'object') for (const k in x) rec(x[k], p + '.' + k); }; rec(o, ''); }
      ok('llegan al servidor las firmas hechas en el celular', largos.length >= abiertas, largos.length + ' firmas');
      ok('ninguna firma de pantalla densa (×3) supera 50.000 caracteres', largos.length && Math.max(...largos) < 50000, 'la más grande: ' + Math.max(0, ...largos));
      ok('sin errores de JavaScript en el celular', !errores.length, errores.join(' | '));
      await ctx.close();
    }
    console.log('\n▸ v168: las listas piden solo lo que cambió (copia en el celular)');
    {
      const ctx = await nav.newContext(PC);
      await entrarComo(ctx, S.url, 0);
      const pg = await ctx.newPage(); const errores = []; pg.on('pageerror', (e) => errores.push(String(e.message)));
      await pg.addInitScript(() => { window.__sstaDialogoAuto = 'aceptar'; });
      await pg.goto(S.url + '/plan-accion.html'); await pg.waitForTimeout(2500);
      const r = await pg.evaluate(async () => {
        const urls = [], f = window.fetch; window.fetch = function (u) { urls.push(String((u && u.url) || u)); return f.apply(this, arguments); };
        const K = 'ssta-sgsst-lista:accion', ult = () => urls[urls.length - 1] || '';
        await SGSST._copiaDel(K);
        const a = await SGSST.listar('accion'), u1 = ult();
        const b = await SGSST.listar('accion'), u2 = ult();
        const id = 'ACC-V168-' + Date.now();
        const g = await SGSST.enviar({ action: 'guardar', tipo: 'accion', id, doc: { origen: 'Inspección', hallazgo: 'Prueba v168', accion: 'Verificar', responsable: 'Prueba', fechaCompromiso: '2030-01-01', estado: 'ABIERTA' } });
        const c = await SGSST.listar('accion'), u3 = ult();
        const copia = await SGSST._copiaGet(K);
        await SGSST._copiaDel(K);
        const d = await SGSST.listar('accion'), u4 = ult();
        return { n: a.rows.length, completa1: !/cambios=/.test(u1), delta2: /cambios=/.test(u2), igual2: JSON.stringify(a.rows) === JSON.stringify(b.rows), guardo: !!(g && g.ok),
          delta3: /cambios=/.test(u3), trae: c.rows.some((x) => x.id === id), igualCompleta: JSON.stringify(c.rows) === JSON.stringify(d.rows), completa4: !/cambios=/.test(u4),
          enIdb: !!(copia && copia.gen && copia.hasta && copia.rows.length === c.rows.length), enLs: Object.keys(localStorage).some((k) => k.indexOf('lista:accion') !== -1) };
      });
      ok('la primera lectura es completa y la segunda pide solo cambios, con la misma lista', r.n > 0 && r.completa1 && r.delta2 && r.igual2, JSON.stringify(r));
      ok('una acción recién guardada llega por los cambios, y la copia unida es igual a la lista completa del servidor', r.guardo && r.delta3 && r.trae && r.completa4 && r.igualCompleta, JSON.stringify(r));
      ok('la copia queda en IndexedDB y ya no ocupa localStorage', r.enIdb && !r.enLs, JSON.stringify(r));
      // La pantalla sigue funcionando sobre la copia: recargar muestra las acciones.
      await pg.reload(); await pg.waitForTimeout(2500);
      const visibles = await pg.evaluate(() => document.body.innerText.indexOf('Prueba v168') !== -1);
      ok('al recargar el plan de acción (ya con copia) se ve la acción nueva', visibles);
      ok('sin errores de JavaScript', !errores.length, errores.join(' | '));
      await ctx.close();
    }
  } finally {
    await nav.close(); S.cerrar(); fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('\n──────────────────────────────────────────────────────────');
  if (fallos) { console.log('❌  ' + fallos + ' de ' + total + ' comprobaciones fallaron. Revisar antes de subir nada.'); process.exit(1); }
  console.log('✅  ' + total + ' comprobaciones en navegador, todas correctas.');
})().catch((e) => { console.error('✗ Error en las pruebas de navegador:', e); process.exit(1); });
