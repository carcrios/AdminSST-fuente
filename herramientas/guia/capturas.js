#!/usr/bin/env node
/* ============================================================
   capturas.js — Vuelve a tomar las capturas de la guía (v163)
   ------------------------------------------------------------
   Las imágenes c-01…c-11 de la guía salen de las pantallas REALES del
   portal: si cambia el instalador o la consola, se corre esto y luego
   hacer-guia.js, y la guía muestra lo que el cliente va a ver.
     node herramientas/guia/capturas.js
   Usa Chromium de Playwright (pruebas/node_modules). 01–08 se toman en
   este sitio («tu marca»); 09–11 en la consola de la empresa demo.
   ============================================================ */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const RAIZ = path.join(__dirname, '..', '..'), G = __dirname;
const { chromium } = require(require.resolve('playwright', { paths: [path.join(RAIZ, 'pruebas')] }));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.vtt': 'text/vtt', '.mp4': 'video/mp4' };
function servir(dir) {
  return new Promise((listo) => { const s = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html'; const p = path.join(dir, f);
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TIPOS[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
    s.listen(0, '127.0.0.1', () => listo({ url: 'http://127.0.0.1:' + s.address().port, cerrar: () => s.close() })); });
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function foto(pg, nombre, sel, alto) {
  const ruta = path.join(G, nombre);
  if (sel) { const el = await pg.$(sel); if (!el) throw new Error(nombre + ': no está ' + sel); await el.scrollIntoViewIfNeeded(); await espera(300);
    // la barra «Instalando:» queda fija arriba y taparía la mitad de una foto larga
    await pg.addStyleTag({ content: '.que-instalo{position:static !important;}' }).catch(() => {});
    const b = await el.boundingBox(); if (alto && b && b.height > alto) { await pg.evaluate((y) => window.scrollTo(0, y), b.y + (await pg.evaluate(() => window.scrollY)) - 8); await espera(300); const b2 = await el.boundingBox(); await pg.screenshot({ path: ruta, type: 'jpeg', quality: 86, clip: { x: b2.x, y: b2.y, width: b2.width, height: alto } }); }
    else await el.screenshot({ path: ruta, type: 'jpeg', quality: 86 }); }
  else await pg.screenshot({ path: ruta, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: pg.viewportSize().width, height: alto || pg.viewportSize().height } });
  console.log('✓ ' + nombre);
}
(async () => {
  const S = await servir(RAIZ);
  const demo = fs.mkdtempSync(path.join(os.tmpdir(), 'ssta-guia-')); require('../armar-demo').armar(demo); const D = await servir(demo);
  const nav = await chromium.launch();
  const CEL = { viewport: { width: 420, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' };
  const sinAvisos = (c) => c.addInitScript(() => { try { localStorage.setItem('ssta-aviso-privacidad', '2026-10'); } catch (e) {} window.__sstaDialogoAuto = 'aceptar'; });
  try {
    // 01–03: instalar paso a paso
    let ctx = await nav.newContext(CEL); await sinAvisos(ctx); let pg = await ctx.newPage();
    await pg.goto(S.url + '/instalar.html'); await espera(900); await foto(pg, 'c-01-instalar-elegir.jpg', null, 740);
    await pg.click('[data-camino="a"]'); await espera(600); await pg.click('[data-hecho="0"]'); await espera(900);
    await pg.evaluate(() => window.scrollTo(0, 0)); await espera(400); await foto(pg, 'c-02-instalar-camino-a.jpg', null, 820);
    const p6 = '.paso[data-i="5"]';
    await pg.fill(p6 + ' [data-url]', 'https://script.google.com/macros/s/AKfycbEJEMPLO/exec'); await pg.click(p6 + ' [data-probar]');
    await pg.waitForFunction((s) => (document.querySelector(s + ' [data-res]') || {}).textContent, p6, { timeout: 20000 }).catch(() => {}); await espera(500);
    await foto(pg, 'c-03-probar-servidor.jpg', p6); await ctx.close();
    // 04–08: el configurador
    ctx = await nav.newContext(CEL); await sinAvisos(ctx); pg = await ctx.newPage();
    await pg.goto(S.url + '/configurar-empresa.html'); await espera(1200); await foto(pg, 'c-04-configurador-elegir.jpg', null, 720);
    await pg.click('[data-inst="proveedor"]'); await espera(900); await pg.evaluate(() => window.scrollTo(0, 0)); await espera(300); await foto(pg, 'c-05-configurador-mi-sitio.jpg', null, 600);
    await ctx.close(); ctx = await nav.newContext(CEL); await sinAvisos(ctx); pg = await ctx.newPage();
    await pg.goto(S.url + '/configurar-empresa.html'); await espera(1200); await pg.click('[data-inst="cliente"]'); await espera(700);
    await pg.fill('#cCodigo', 'acme-sas'); await pg.fill('#cNombre', 'ACME Construcciones S.A.S.'); await pg.fill('#cCorto', 'ACME'); await espera(500);
    await pg.evaluate(() => window.scrollTo(0, 0)); await espera(300); await foto(pg, 'c-06-configurador-cliente.jpg', null, 575);
    await pg.evaluate(() => { const d = document.querySelector('#cModulos details.mod-cat'); if (d) d.open = true; }); await espera(300);
    await foto(pg, 'c-07-modulos.jpg', '#cModulos', 620);
    // El botón de la consola sale cuando el administrador tiene su sesión abierta; para la foto se muestra tal cual.
    await pg.evaluate(() => { const b = document.getElementById('bConsola'); if (b) b.hidden = false; const t = document.getElementById('tFinal'); if (t) t.textContent = 'Revisar y guardar'; }); await espera(300);
    await foto(pg, 'c-08-guardar.jpg', '#cFinal', 880); await ctx.close();
    // 09–11: la consola (empresa demo)
    ctx = await nav.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1.2, serviceWorkers: 'block' }); await sinAvisos(ctx); pg = await ctx.newPage();
    await pg.goto(D.url + '/admin.html'); await espera(1500);
    await pg.fill('#aUsr', 'sandra.sst'); await pg.fill('#aClave', 'Demo2026'); await pg.click('#aEntrar');
    await pg.waitForFunction(() => document.querySelectorAll('[data-mod]').length > 0, null, { timeout: 30000 }); await espera(800);
    const tarjeta = await pg.evaluateHandle(() => { const b = [...document.querySelectorAll('[data-mod]')].find((x) => !x.disabled) || document.querySelector('[data-mod]'); let c = b; while (c && c.parentElement && !/c-card|cli|empresa/.test(c.className)) c = c.parentElement; c.id = c.id || 'tarjetaGuia'; return c.id; });
    await foto(pg, 'c-09-consola-menus.jpg', '#' + (await tarjeta.jsonValue()));
    // La ventana «Menús» tal como la arma la consola (en la demo, que no es multiempresa, el botón está apagado).
    await pg.evaluate(() => { const nom = (/Clínica Dental Sonrisa \(ficticia\)/.exec(document.body.innerText) || ['Empresa cliente'])[0];
      const apag = { caliente: false, alturas: false, confinados: false, izajes: false, electrico: false, ats: false };
      const m = UI.modal('<h3>Menús de ' + esc(nom.trim()) + '</h3><p class="ayuda">Marca lo que esta empresa ve y ponle a sus formatos el nombre y el código que usa. Al tocar <b>Guardar y publicar</b> queda guardado en tu servidor: no hay que descargar ni subir nada. Sus celulares lo ven la próxima vez que abran el portal.</p>' +
        '<div id="mMenus" style="max-height:58vh;overflow:auto;margin:8px 0;">' + MenusEmpresa.html({ modulos: apag, bautizos: { preop: { taladro: { nombre: 'Taladro percutor', codigo: 'SST-F-031' } } } }) + '</div><button type="button" class="btn amber" id="mGuardar">Guardar y publicar</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button>');
      MenusEmpresa.activar(m.el.querySelector('#mMenus')); m.el.id = 'modalGuia'; const d = m.el.querySelector('details'); if (d) d.open = true; }); await espera(800);
    const mid = '#modalGuia';
    await foto(pg, 'c-10-menus.jpg', mid);
    await pg.evaluate((m) => { const c = document.querySelector(m + ' input[data-me="preop"][data-id="taladro"]') || document.querySelector(m + ' input[data-me="preop"]'); if (c) { const d = c.closest('details'); if (d) d.open = true; c.scrollIntoView({ block: 'center' }); } }, mid); await espera(500);
    await foto(pg, 'c-11-nombre-codigo.jpg', mid); await ctx.close();
    // v165: sello de las pantallas fotografiadas: verificar-release.js avisa si cambian y la guía queda vieja.
    fs.writeFileSync(path.join(G, 'capturas.json'), JSON.stringify({ huella: require('../verificar-release').huellaPantallas(), tomadas: new Date().toISOString().slice(0, 10) }, null, 1) + '\n');
  } finally { await nav.close(); S.cerrar(); D.cerrar(); fs.rmSync(demo, { recursive: true, force: true }); }
})().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
