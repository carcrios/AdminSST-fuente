#!/usr/bin/env node
/* ============================================================
   grabar-videos.js — Graba los videos cortos del manual (ayuda.html)
   ------------------------------------------------------------
   Recorre la empresa demo en un celular simulado, con subtítulos y un
   punto donde se toca, y deja un .mp4 por guía en videos/. Se vuelven a
   grabar cuando cambie una pantalla.

   Uso (Playwright y ffmpeg instalados; la demo servida en un puerto):
     node herramientas/armar-demo.js /tmp/sitio-demo
     (cd /tmp/sitio-demo && python3 -m http.server 8766) &
     node herramientas/grabar-videos.js http://localhost:8766 [solo-este-id]
   ============================================================ */
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); } })();
const BASE = (process.argv[2] || 'http://localhost:8766').replace(/\/+$/, '') + '/';
const SOLO = process.argv[3] || '';
const SALIDA = path.join(__dirname, '..', 'videos');
const TAM = { width: 390, height: 780 };

/* Subtítulos y el punto del toque (se pintan dentro de la página). */
const AYUDAS = `(() => {
  const css = '#__cap{position:fixed;left:10px;right:10px;bottom:14px;z-index:2147483647;background:rgba(21,27,36,.93);color:#fff;font:600 15px/1.35 system-ui,Arial;padding:11px 14px;border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,.35);transition:opacity .25s;pointer-events:none}' +
    '#__tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(242,194,0,.55);border:3px solid #f2c200;z-index:2147483646;pointer-events:none;opacity:0;transition:opacity .15s}';
  const ini = () => { if (document.getElementById('__cap')) return; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    const c = document.createElement('div'); c.id = '__cap'; c.style.opacity = 0; document.body.appendChild(c); const t = document.createElement('div'); t.id = '__tap'; document.body.appendChild(t); };
  window.__cap = (txt) => { ini(); const c = document.getElementById('__cap'); c.textContent = txt || ''; c.style.opacity = txt ? 1 : 0; };
  window.__tap = (x, y) => { ini(); const t = document.getElementById('__tap'); t.style.left = x + 'px'; t.style.top = y + 'px'; t.style.opacity = 1; setTimeout(() => { t.style.opacity = 0; }, 650); };
  document.addEventListener('DOMContentLoaded', ini);
})();`;

async function nuevo(navegador, id) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-' + id + '-'));
  const ctx = await navegador.newContext({ viewport: TAM, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-CO', timezoneId: 'America/Bogota', serviceWorkers: 'block', recordVideo: { dir, size: TAM },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36' });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await ctx.addInitScript(AYUDAS);
  await ctx.addInitScript(() => { window.print = () => {}; });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Sandra Torres' : undefined));
  return { ctx, p, dir };
}
const espera = (p, ms) => p.waitForTimeout(ms);
// v162: cada subtítulo queda con su tiempo para escribir el .vtt (subtítulos accesibles, además de los que se ven en el video).
let LINEA = [], T0 = 0;
async function cap(p, txt, ms) { LINEA.push({ t: Date.now() - T0, txt: txt || '' }); await p.evaluate((t) => window.__cap && window.__cap(t), txt); await espera(p, ms || 2200); }
const hms = (ms) => { const s = Math.max(0, ms) / 1000, h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = (s % 60).toFixed(3).padStart(6, '0'); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + x; };
function vtt(linea, fin) {
  const c = linea.filter((x, i) => x.txt && (i === linea.length - 1 || linea[i + 1].t > x.t));
  return 'WEBVTT\n\n' + c.map((x, i) => { const sig = linea.find((y) => y.t > x.t); return (i + 1) + '\n' + hms(x.t) + ' --> ' + hms(sig ? sig.t : fin) + '\n' + x.txt + '\n'; }).join('\n');
}
async function tocar(p, sel, txt, ms) {
  const el = typeof sel === 'string' ? await p.waitForSelector(sel, { timeout: 15000 }) : sel;
  await el.scrollIntoViewIfNeeded(); await espera(p, 250);
  const b = await el.boundingBox();
  if (txt) await cap(p, txt, 1300);
  if (b) await p.evaluate(([x, y]) => window.__tap && window.__tap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
  await espera(p, 350); try { await el.click({ timeout: 5000 }); } catch (e) { await el.evaluate((x) => x.click()); } await espera(p, ms || 1200);
}
async function escribir(p, sel, texto) { const el = await p.waitForSelector(sel); await el.scrollIntoViewIfNeeded(); await el.click(); await p.keyboard.type(texto, { delay: 35 }); await espera(p, 300); }
async function bajar(p, px, ms) { await p.mouse.wheel(0, px); await espera(p, ms || 900); }
async function entrarDemo(p) {
  // v162: si la página pide usuario primero muestra «Entra con tu usuario»; se toca «Entrar» y luego el usuario de la demo.
  const ar = await p.$('.acceso-rol .ar-si'); if (ar) { await tocar(p, ar, 'Esta parte pide usuario: toca «Entrar»', 1200); }
  const b = await p.waitForSelector('[data-demo="0"]', { timeout: 5000 }).catch(() => null);
  if (b) { await tocar(p, b, 'Entra con tu usuario (en la demo, con un toque)', 3500); }
}

const GUIONES = {
  async entrar(p) {
    await p.goto(BASE + 'index.html'); await espera(p, 1800);
    await cap(p, 'Sin usuario: preoperacional, reportes, inducción y emergencia', 3000);
    await tocar(p, '#btnGestion', 'El sistema de gestión pide usuario: toca «Gestión»');
    await entrarDemo(p); await espera(p, 1200);
    await cap(p, 'Arriba, «Hoy» y «Lo mío hoy»: lo que te toca, con un toque', 3200);
    await bajar(p, 500); await cap(p, 'Más abajo, los módulos ordenados como se trabaja el SG-SST', 2600);
    await bajar(p, -900, 500);
    await escribir(p, '#searchInput', 'inspección'); await cap(p, 'O búscalo por nombre', 2600);
    await p.fill('#searchInput', ''); await espera(p, 400);
    await tocar(p, '#btnMas', 'En «Más» están el modo sol, la letra y la ayuda', 1500);
    await tocar(p, '#menuMas [role="menuitem"]:last-child', 'En Ayuda está este manual, con videos', 2500);
    await cap(p, 'Sin señal también funciona: lo que guardes se envía solo cuando vuelva la señal', 3500);
  },
  async reporte(p) {
    await p.goto(BASE + 'reportes.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Reportes e investigación: actos, condiciones, incidentes y accidentes', 2600);
    await tocar(p, '#btnReportar', 'Toca Reportar');
    await tocar(p, '[data-c="Condición insegura"]', '¿Qué pasó? Una condición insegura');
    await escribir(p, '#nLugar', 'Bodega, pasillo 3');
    await escribir(p, '#nDesc', 'Estiba rota a la entrada del pasillo; alguien se puede tropezar.');
    await cap(p, 'Puedes agregar fotos y reportar de forma anónima', 2400);
    await tocar(p, '#btnEnviar', 'Envía el reporte', 2500);
    await cap(p, 'SST lo recibe y, si hace falta, crea la acción para corregirlo', 3000);
  },
  async inspeccion(p) {
    await p.goto(BASE + 'inspecciones.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Inspecciones: lo que toca inspeccionar y lo que tiene algo vencido', 2600);
    await tocar(p, '#btnInspeccionar', 'Toca Inspeccionar');
    await tocar(p, '#catsSel [data-cat="extintor"]', 'Elige qué vas a inspeccionar');
    await tocar(p, '.modal [data-eqi]', 'Y cuál del inventario');
    await cap(p, 'Responde cada pregunta: C cumple, NC no cumple, NA no aplica', 2600);
    await tocar(p, '#btnTodoC', '«Todo cumple» marca lo que falte');
    const nc = await p.$('#inItems .preg[data-i="3"] [data-v="NC"]'); await tocar(p, nc, 'Si algo no cumple, márcalo NC');
    await escribir(p, '#inItems .preg[data-i="3"] .obs', 'Manómetro en zona roja');
    await cap(p, 'Escribe tu nombre, firma y guarda: cada NC se vuelve una acción del plan', 3200);
    await tocar(p, '#scrInsp [data-volver]', 'Vuelve a la lista', 1200);
    await tocar(p, '[data-tab="cronograma"]', 'El cronograma muestra lo programado frente a lo hecho en el año', 3500);
  },
  async plan(p) {
    await p.goto(BASE + 'plan-accion.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Plan de acción: todas las acciones, de todos los orígenes', 2600);
    await tocar(p, '#lista .item', 'Abre una acción');
    await cap(p, 'Aquí está el hallazgo, el responsable, la fecha y de dónde salió', 2600);
    await escribir(p, '#segTexto', 'Se pidió el repuesto al proveedor');
    await tocar(p, '#btnSeg', 'Anota el avance', 1800);
    await bajar(p, 500); await cap(p, 'Al terminar, ciérrala con la evidencia y di si fue eficaz', 3200);
  },
  async excel(p) {
    await p.goto(BASE + 'habilitacion.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Para no digitar uno por uno: carga desde Excel', 2400);
    await tocar(p, '#btnExcel', 'Toca «Cargar desde Excel»');
    await cap(p, 'Descarga la plantilla, llénala en Excel y copia las celdas con los títulos', 3000);
    await escribir(p, '.modal [data-pegar]', 'Nombre completo\tCédula\tCargo\tCurso de trabajo en alturas (fecha)\nAna Ruiz\t1020304050\tSoldadora\t15/01/2026\nLuis Mora\t80222333\tTubero\t\nSin cédula\t\tAyudante\t');
    await espera(p, 600); await bajar(p, 300);
    await cap(p, 'Antes de guardar ves qué es nuevo, qué actualiza y qué tiene errores', 3200);
    await tocar(p, '.modal [data-cargar]', 'Carga las filas buenas', 3500);
    await cap(p, 'Listo: el vencimiento de cada curso se calcula solo', 2600);
  },
  async quimicos(p) {
    await p.goto(BASE + 'quimicos.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Sustancias químicas: inventario con los pictogramas del SGA', 2600);
    await bajar(p, 400); await cap(p, 'En rojo, lo que falta: fichas de seguridad o etiquetas', 2400);
    await bajar(p, -800, 400);
    await tocar(p, '[data-tab="almacen"]', 'Almacenamiento: qué no puede ir junto en cada lugar', 2000);
    await cap(p, 'Inflamable con comburente, ácido con base… con el porqué', 3000);
    await tocar(p, '[data-tab="gestion"]', 'Res. 773: el semáforo de las obligaciones', 3200);
  },
  async kit(p) {
    await p.goto(BASE + 'documentos.html'); await espera(p, 2200); await entrarDemo(p);
    await cap(p, 'Kit documental: los documentos del SG-SST con los datos de la empresa', 2800);
    await bajar(p, 300); await cap(p, 'Cada uno dice qué estándar cubre y si le aplica a la empresa', 2600);
    await tocar(p, '[data-ver="REGLAMENTO"]', 'Ábrelo para revisarlo', 1500);
    await bajar(p, 400); await cap(p, 'El reglamento toma los peligros de la matriz de la empresa', 3000);
    await cap(p, 'Sácalo en PDF o en Word para ajustarlo, y apruébalo: queda en el listado maestro', 3500);
  },
  async calidad(p) {
    await p.goto(BASE + 'calidad.html'); await espera(p, 1800); await entrarDemo(p);
    await cap(p, 'Gestión de la calidad: contexto, riesgos, objetivos, no conformes, PQRS y satisfacción', 3200);
    await tocar(p, '[data-tab="pqrs"]', 'PQRS de los clientes');
    await tocar(p, '#nPqrB', 'Registra la queja o el reclamo');
    await escribir(p, '.modal [id$="_cliente"]', 'Cliente Alimentos del Norte');
    await escribir(p, '.modal [id$="_descripcion"]', 'Pidió cambiar la fecha de la parada de planta');
    await cap(p, 'El plazo de respuesta se calcula solo (días hábiles)', 2400);
    await tocar(p, '.modal [data-guardar]', 'Guarda', 2200);
    await tocar(p, '[data-tab="satisfaccion"]', 'Satisfacción: encuestas, % y NPS de 12 meses', 3200);
  },
  async gerencia(p) {
    await p.goto(BASE + 'gerencia.html'); await espera(p, 2500); await entrarDemo(p); await espera(p, 1500);
    await cap(p, 'Tablero de la gerencia: todo el SG-SST en una pantalla', 3000);
    await bajar(p, 500, 1500); await cap(p, 'Con semáforos: lo verde va bien, lo rojo necesita atención', 2800);
    await bajar(p, 600, 1500); await cap(p, 'El informe en PDF sirve para la revisión por la dirección', 3000);
  },
  async asesor(p) {
    // v162: el panel del asesor está detrás de la consola: se entra con el usuario administrador de la demo.
    await p.goto(BASE + 'admin.html'); await espera(p, 1500);
    if (await p.$('#aUsr')) { await escribir(p, '#aUsr', 'sandra.sst'); await escribir(p, '#aClave', 'Demo2026'); await tocar(p, '#aEntrar', 'Entra a tu consola', 1800); }
    await p.goto(BASE + 'asesor.html'); await espera(p, 2200); await entrarDemo(p); await espera(p, 1000);
    await cap(p, 'Panel del asesor: tus empresas cliente con su segmento de 7, 21 o 60 estándares', 3200);
    await tocar(p, '[data-id="CLI-DEMO-1"]', 'Abre un cliente', 3500);
    const ce = await p.$('#ceU'); if (ce) { await p.fill('#ceU', 'sandra.sst'); await p.fill('#ceC', 'Demo2026'); await tocar(p, '#ceOk', 'Entra a su portal', 3500); }
    await cap(p, 'Sus tareas, la versión de su servidor y los avisos por correo', 3000);
    await bajar(p, 400); await cap(p, 'Deja tareas en su plan de acción o las de sus estándares en un clic', 3200);
  }
};

(async () => {
  if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA);
  const nav = await chromium.launch();
  const ids = Object.keys(GUIONES).filter((k) => !SOLO || k === SOLO);
  for (const id of ids) {
    const { ctx, p, dir } = await nuevo(nav, id);
    LINEA = []; T0 = Date.now();
    let error = '';
    try { await GUIONES[id](p); await cap(p, '', 600); } catch (e) { error = e.message.split('\n')[0]; if (process.env.VIDEO_ERR) try { await p.screenshot({ path: path.join(process.env.VIDEO_ERR, id + '.png') }); } catch (x) {} }
    const video = p.video(); await ctx.close();
    const webm = await video.path(), mp4 = path.join(SALIDA, id + '.mp4');
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]); }
    catch (e) { error += ' · ffmpeg: ' + e.message; }
    try { fs.writeFileSync(path.join(SALIDA, id + '.vtt'), vtt(LINEA, Date.now() - T0)); } catch (e) { error += ' · vtt: ' + e.message; }
    // v162: póster (un cuadro del video) para que en 3G no se vea un rectángulo negro mientras carga.
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.5', '-i', mp4, '-frames:v', '1', '-q:v', '6', path.join(SALIDA, id + '.jpg')]); } catch (e) { error += ' · póster: ' + e.message; }
    fs.rmSync(dir, { recursive: true, force: true });
    console.log((error ? '✗ ' : '✓ ') + id + (fs.existsSync(mp4) ? ' (' + Math.round(fs.statSync(mp4).size / 1024) + ' KB)' : '') + (error ? ' — ' + error : ''));
  }
  await nav.close();
})();
