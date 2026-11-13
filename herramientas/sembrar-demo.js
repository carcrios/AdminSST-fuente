#!/usr/bin/env node
/* ============================================================
   sembrar-demo.js — Crea demo/semilla.json (los datos de ejemplo de la demo)
   ------------------------------------------------------------
   Abre el sitio de la demo en un navegador (Playwright), empezando de
   cero, y registra datos de una obra ficticia usando el MISMO portal:
   personal, 2 ATS (uno cerrado), permisos en caliente y en alturas
   abiertos desde el ATS (diligenciados y firmados en pantalla), anexo de
   personal autorizado, charlas de dos semanas, inspecciones de EPP y la
   gestión del SG-SST (personal habilitado, reportes con investigación,
   inventario e inspecciones, plan de acción, datos de indicadores, COPASST,
   Comité de Convivencia con quejas cifradas y auditorías), planeación,
   contratistas con soportes adjuntos y, al final, usuarios con nombre.
   Al final exporta el estado del servidor simulado a demo/semilla.json.

   La demo corre las fechas por semanas completas al abrirse, así que
   los datos siempre se ven recientes.

   Uso (necesita Playwright y el sitio de la demo servido en un puerto):
     node herramientas/armar-demo.js /tmp/sitio-demo
     (cd /tmp/sitio-demo && python3 -m http.server 8766) &
     node herramientas/sembrar-demo.js http://localhost:8766
   ============================================================ */
const fs = require('fs'), path = require('path');
const { chromium } = (() => {   // Playwright: el del proyecto, el global o el de las herramientas del equipo
  const intentos = ['playwright', require('child_process').execSync('npm root -g').toString().trim() + '/playwright', '/opt/node-tools/node_modules/playwright'];
  for (const r of intentos) { try { return require(r); } catch (e) {} }
  throw new Error('Falta Playwright: npm install -g playwright');
})();
const BASE = (process.argv[2] || 'http://localhost:8766').replace(/\/+$/, '');
const SALIDA = path.join(__dirname, '..', 'demo', 'semilla.json');

const PERSONAS = [
  ['Jorge Andrés', 'Díaz Molina', '80111222', 'Supervisor de obra'],
  ['Luis Fernando', 'Pérez Rojas', '1010200301', 'Soldador'],
  ['Pedro Antonio', 'Gómez Vargas', '79555444', 'Tubero'],
  ['Wilson', 'Cárdenas Ruiz', '1022334455', 'Armador'],
  ['Camilo', 'Rincón Patiño', '1033445566', 'Ayudante'],
  ['Diego Alejandro', 'Suárez León', '1044556677', 'Soldador'],
  ['Marta Lucía', 'Ruiz Castaño', '52000111', 'Electricista'],
  ['Andrés Felipe', 'Moreno Gil', '1055667788', 'Rigger'],
  ['Óscar Iván', 'Beltrán Silva', '1066778899', 'Operador de grúa'],
  ['Sandra Milena', 'Torres Ávila', '52333444', 'Coordinadora SST'],
  ['Héctor', 'Ramírez Ortiz', '79888777', 'Ayudante'],
  ['Juliana', 'Castro Peña', '1077889900', 'Inspectora HSE']
];

/* Firma "a mano" con trazos curvos, distinta por nombre (PNG transparente). */
const FIRMA = `window.firmaFalsa = function (nombre) {
  let s = 0; for (let i = 0; i < nombre.length; i++) s = (s * 31 + nombre.charCodeAt(i)) >>> 0;
  const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  const c = document.createElement('canvas'); c.width = 300; c.height = 100;
  const g = c.getContext('2d'); g.strokeStyle = '#1b2a5e'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
  let x = 18 + r() * 12, y = 58 + r() * 10;
  g.beginPath(); g.moveTo(x, y);
  const letras = Math.min(9, Math.max(4, nombre.split(' ')[0].length + 2));
  for (let i = 0; i < letras; i++) {
    const w = 16 + r() * 16, h = 18 + r() * 30;
    g.bezierCurveTo(x + w * 0.2, y - h, x + w * 0.9, y - h * (0.4 + r()), x + w * 0.6, y + 4);
    g.bezierCurveTo(x + w * 0.4, y + 10 + r() * 10, x + w * 1.1, y + 6, x + w, y - 2 + r() * 6);
    x += w * 0.85; y += (r() - 0.5) * 6;
  }
  g.stroke();
  g.beginPath(); g.moveTo(20 + r() * 20, 76 + r() * 8);
  g.bezierCurveTo(90, 92 + r() * 6, 170, 60 + r() * 10, 272 - r() * 30, 70 + r() * 12); g.stroke();
  return c.toDataURL('image/png');
};
window.isoMas = function (n) { const d = new Date(); d.setDate(d.getDate() + n); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
window.srv = async function (modulo, cuerpo, get) {
  const url = PORTAL_CONFIG.BACKENDS[modulo].url;
  const r = get ? await fetch(url + '?' + new URLSearchParams(Object.assign({ token: 'x' }, cuerpo))) : await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ token: 'x' }, cuerpo)) });
  const j = await r.json();
  if (j && j.ok === false) throw new Error(modulo + ': ' + j.error);
  return j;
};`;

async function firmarCanvas(p, sel) {
  const c = await p.$(sel); if (!c) return false;
  await c.evaluate((el) => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(120);   // lejos de barras fijas
  const b = await c.boundingBox(); if (!b || b.width < 20) return false;
  const seed = sel.length;
  await p.mouse.move(b.x + 16, b.y + b.height * 0.6); await p.mouse.down();
  for (let k = 0; k < 22; k++) await p.mouse.move(b.x + 16 + k * (b.width - 40) / 22, b.y + b.height * (0.5 + 0.28 * Math.sin(k * 0.9 + seed)));
  await p.mouse.up(); await p.waitForTimeout(80);
  // Si el portal abrió la firma a pantalla completa, se firma ahí.
  const fc = await p.$('#fcPad');
  if (fc && await fc.isVisible()) {
    const fb = await fc.boundingBox();
    await p.mouse.move(fb.x + 40, fb.y + fb.height / 2); await p.mouse.down();
    for (let k = 0; k < 18; k++) await p.mouse.move(fb.x + 40 + k * 20, fb.y + fb.height / 2 + Math.sin(k) * 40);
    await p.mouse.up();
    await p.click('button[data-fc=listo]'); await p.waitForTimeout(150);
  }
  return true;
}

(async () => {
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 1180, height: 900 }, serviceWorkers: 'block', locale: 'es-CO', timezoneId: 'America/Bogota' });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  // Se siembra desde cero: si el sitio ya trae una semilla, no se carga (si no, se duplicaría todo).
  await ctx.route(/demo\/semilla\.json/, (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(FIRMA);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('  ! error de página:', e.message));
  p.on('dialog', (d) => d.accept());
  const ir = async (pag) => { await p.goto(BASE + '/' + pag); await p.waitForFunction(() => window.DemoPortal); await p.evaluate(() => DemoPortal.iniciar()); await p.waitForTimeout(400); };

  // ── 1. Base de personal (autocompletar en todos los formatos)
  await ir('index.html');
  await p.evaluate(async (personas) => {
    for (const [n, a, c, cargo] of personas) await srv('personal', { action: 'guardarPersona', nombre: n + ' ' + a, cedula: c, cargo });
  }, PERSONAS);
  console.log('✓ personal');

  // ── 2. ATS: uno abierto (ayer → +12 días) y uno cerrado (hace 8 días)
  await ir('ats.html');
  const ats = await p.evaluate(async (personas) => {
    const nombre = (x) => x[0] + ' ' + x[1];
    const armar = (desde, hasta, area, trabajo, centro, tareas, gente, permisos) => {
      const a = nuevoAts();
      Object.assign(a.cab, { centro: [centro], desde, hasta, horaDesde: '07:00', horaHasta: '17:00', area, trabajo, requiere: permisos.length ? 'SI' : 'NO', permisos });
      a.tareas = tareas.map(tareaDesdePlantilla);
      a.participantes = gente.map((x) => ({ uid: uid(), nombres: x[0], apellidos: x[1], cedula: x[2], cargo: x[3], firma: firmaFalsa(nombre(x)), tardio: false, socializado: true, ingreso: null }));
      a.firmas = { lider: { nombre: nombre(personas[0]), firma: firmaFalsa(nombre(personas[0])) },
                   jefe: { nombre: 'Ing. Ricardo Salazar', firma: firmaFalsa('Ricardo Salazar') },
                   sst: { nombre: nombre(personas[9]), firma: firmaFalsa(nombre(personas[9])) } };
      return a;
    };
    const cod = (f, n) => 'ATS-' + f.replace(/-/g, '') + '-' + n;
    const a1 = armar(isoMas(-1), isoMas(12), 'Planta de bebidas · Cuarto de calderas', 'Cambio de tramo de tubería de vapor de 4" y soportes en el cuarto de calderas',
      'Cliente Bebidas La Sabana', ['inspeccion', 'divulgacion', 'loto', 'andamio', 'corte', 'soldadura', 'tuberia', 'presion', 'orden'],
      personas.slice(0, 6).concat([personas[10]]), ['caliente', 'alturas']);
    const c1 = cod(a1.cab.desde, '418230');
    await srv('ats', { opId: 's-a1', code: c1, versionBase: 0, ats: a1 });
    const a2 = armar(isoMas(-8), isoMas(-7), 'Línea de envasado 2', 'Mantenimiento de banda transportadora y cambio de rodillos',
      'Cliente Alimentos del Norte', ['inspeccion', 'divulgacion', 'loto', 'banda', 'tornilleria', 'orden'], [personas[0], personas[3], personas[4], personas[6]], []);
    const c2 = cod(a2.cab.desde, '377105');
    await srv('ats', { opId: 's-a2', code: c2, versionBase: 0, ats: a2 });
    await srv('ats', { action: 'cerrarAts', code: c2, opId: 's-a2c', cierre: { fecha: isoMas(-7), hora: '16:40', motivo: 'Actividad finalizada', observaciones: 'Área entregada limpia al cliente.',
      nombre: nombre(personas[0]), cedula: personas[0][2], cargo: personas[0][3], firma: firmaFalsa(nombre(personas[0])) } });
    return { c1, a1 };
  }, PERSONAS);
  console.log('✓ ATS', ats.c1);

  // ── 3. Permisos abiertos desde el ATS, diligenciados y firmados en pantalla
  const permisos = [];
  for (const [tipo, archivo] of [['caliente', 'permiso-trabajo-caliente.html'], ['alturas', 'permiso-trabajo-alturas.html']]) {
    await p.evaluate(({ tipo, a, code, personas }) => {
      localStorage.setItem('ssta-prefill-permiso', JSON.stringify({
        t: Date.now(), tipo, atsCode: code, trabajo: a.cab.trabajo, sitio: a.cab.area,
        desde: isoMas(0), hasta: isoMas(0), horaDesde: '07:00', horaHasta: '17:00', responsable: personas[0][0] + ' ' + personas[0][1],
        personas: (tipo === 'caliente' ? personas.slice(1, 4) : [personas[3], personas[4], personas[10]]).map((x) => ({ nombre: x[0] + ' ' + x[1], cc: x[2], cargo: x[3] }))
      }));
    }, { tipo, a: ats.a1, code: ats.c1, personas: PERSONAS });
    await ir(archivo + '?desdeAts=1');
    await p.waitForTimeout(800);
    // Lo que el ATS no trae: equipos y herramientas, inspector, fechas de mantenimiento…
    await p.evaluate(() => {
      const val = (id, v) => { const e = document.getElementById(id); if (e && !e.value) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } };
      val('herramientas', 'Equipo de soldadura SMAW, pulidora 4½", andamio certificado, arnés y eslinga'); val('mantDia', '15'); val('mantMes', '08'); val('mantAnio', String(new Date().getFullYear()));
      val('extDia', '20'); val('extMes', '06'); val('extAnio', String(new Date().getFullYear()));
      val('observaciones', 'Se coordina con operación del cliente el bloqueo de la línea de vapor.');
      val('inspectorNombreInput', 'Juliana Castro Peña'); val('inspectorCedulaInput', '1077889900');
      val('fechaInicioAlt', isoMas(0)); val('horaInicioAlt', '07:00'); val('fechaCulminacionAlt', isoMas(0)); val('horaCulminacionAlt', '17:00');
      val('areaAlt', 'Cuarto de calderas · andamio a 4,5 m'); val('descripcionAlt', 'Desmonte y montaje de tramo de tubería de vapor en altura');
      // Roles responsables (supervisor, SSTA, coordinador de alturas…).
      const roles = [['Jorge Andrés Díaz Molina', '80111222'], ['Sandra Milena Torres Ávila', '52333444'], ['Juliana Castro Peña', '1077889900'], ['Ricardo Salazar Neira', '79123456'],
                     ['Andrés Felipe Moreno Gil', '1055667788'], ['Héctor Ramírez Ortiz', '79888777'], ['Óscar Iván Beltrán Silva', '1066778899']];
      for (let i = 0; i < 7; i++) { val('resp' + i + 'nombre', roles[i][0]); val('resp' + i + 'cc', roles[i][1]); }
      // Alturas: cálculo de distancias que SÍ cumple (AMT > DTR).
      [['calc-at', '1.80'], ['calc-rc', '1.00'], ['calc-dcl', '1.80'], ['calc-da', '1.07'], ['calc-amt', '6.50']].forEach(([id, v]) => {
        const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } });
      document.querySelectorAll('select').forEach((s) => { if (!s.value && s.options.length > 1 && s.offsetParent) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); } });
    });
    for (const b of await p.$$('.cat-todo')) { if (await b.isVisible()) { await b.click(); await p.waitForTimeout(60); } }
    // Preguntas sí/no que quedaran sueltas: "SÍ".
    await p.evaluate(() => {
      document.querySelectorAll('#app .yn, #app [data-yn]').forEach((grupo) => {
        if (grupo.querySelector('[aria-pressed="true"]')) return;
        const si = [...grupo.querySelectorAll('button')].find((b) => /^S[IÍ]$/i.test(b.textContent.trim()) || /^C$/.test(b.textContent.trim()));
        if (si) si.click();
      });
    });
    const lienzos = await p.$$eval('#openPhase canvas, #app .section:not(#closeSectionBody) canvas, #responsablesSigs canvas, #execBody canvas', (cs) =>
      [...new Set(cs.filter((c) => c.offsetParent && !c.closest('#closeFields')).map((c) => '#' + c.id))].filter((x) => x.length > 1));
    if (process.env.DEPURAR) console.log('  lienzos', tipo, lienzos.join(' '));
    for (const sel of lienzos) await firmarCanvas(p, sel);
    await p.waitForTimeout(500);
    await p.click('#mainActionBtn'); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ code: (document.getElementById('permitCodeDisplay') || {}).textContent, estado: (document.getElementById('statusBannerText') || {}).textContent,
      pendiente: (document.getElementById('validationBanner') || {}).textContent, pie: (document.getElementById('footerStatus') || {}).textContent }));
    console.log('  permiso ' + tipo + ':', JSON.stringify(r).slice(0, process.env.DEPURAR ? 2000 : 300));
    permisos.push({ tipo, code: (r.code || '').trim() });
  }
  const listas = await p.evaluate(async () => ({ caliente: (await srv('caliente', { list: '1' }, true)).rows.length, alturas: (await srv('alturas', { list: '1' }, true)).rows.length }));
  console.log('✓ permisos en el servidor:', listas);

  // ── 4. Anexo de personal autorizado: una obra con 4 días
  await ir('personal-autorizado.html');
  await p.evaluate(async ({ personas, atsCode, permisos }) => {
    const n = (x) => x[0] + ' ' + x[1];
    const o = await srv('personal', { action: 'crearObra', nombre: 'Cambio de tubería de vapor · Calderas', area: 'Planta de bebidas', fechaInicio: isoMas(-3), fechaFin: isoMas(12), permisos: [] });
    const vinc = [{ code: atsCode, tipo: 'ATS', icono: '🧭', archivo: 'ats.html', area: 'Cuarto de calderas' }]
      .concat(permisos.filter((x) => x.code).map((x) => ({ code: x.code, tipo: x.tipo === 'caliente' ? 'Trabajo en Caliente' : 'Trabajo en Alturas', icono: x.tipo === 'caliente' ? '🔥' : '🧗', archivo: x.tipo === 'caliente' ? 'permiso-trabajo-caliente.html' : 'permiso-trabajo-alturas.html', area: 'Cuarto de calderas' })));
    await srv('personal', { action: 'vincularPermisos', obraId: o.obraId, permisos: vinc });
    const dias = [[-3, [0, 1, 2, 4]], [-2, [0, 1, 2, 3, 4]], [-1, [0, 1, 2, 3, 4, 5, 10]], [0, [0, 1, 2, 3, 5, 10]]];
    for (const [d, idx] of dias) {
      const f = isoMas(d);
      await srv('personal', { action: 'guardarRegistro', obraId: o.obraId, fecha: f, opId: 's-r' + d, quitar: [],
        data: { fecha: f, trabajadores: idx.map((i) => ({ nombre: n(personas[i]), cedula: personas[i][2], cargo: personas[i][3], firma: firmaFalsa(n(personas[i]) + f) })),
                verificador: { nombre: n(personas[9]), cedula: personas[9][2], firma: firmaFalsa(n(personas[9])) }, permisos: vinc, savedAt: new Date().toISOString() } });
    }
  }, { personas: PERSONAS, atsCode: ats.c1, permisos });
  console.log('✓ anexo');

  // ── 5. Charlas: semana anterior y esta semana
  await ir('asistencia.html');
  await p.evaluate(async (personas) => {
    const n = (x) => x[0] + ' ' + x[1];
    const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const temas = ['Orden y aseo en el frente de trabajo', 'Uso correcto del arnés y la línea de vida', 'Riesgo eléctrico y bloqueo de energías (LOTO)', 'Prevención de quemaduras en trabajos en caliente',
      'Levantamiento seguro de cargas', 'Reporte de actos y condiciones inseguras', 'Hidratación y pausas activas', 'Plan de emergencias y punto de encuentro', 'Socialización del ATS del día'];
    let t = 0;
    // Dos semanas: desde el lunes de la semana pasada hasta hoy (con -11 días fijos salían 3 semanas según el día).
    const inicio = -((new Date(isoMas(0) + 'T12:00:00').getDay() + 6) % 7) - 7;
    for (let d = inicio; d <= 0; d++) {
      const f = isoMas(d), wd = new Date(f + 'T12:00:00').getDay();
      if (wd === 0 || wd === 6) continue;
      const sem = (await srv('asistencia', { action: 'abrirSemana', fecha: f, lugar: 'Planta de bebidas · Calderas', opId: 's-ab' + d })).semana;
      const gente = personas.filter((x, i) => [0, 1, 2, 3, 4, 5, 10].includes(i) && (i + d) % 5 !== 0);
      await srv('asistencia', { action: 'guardarDia', code: sem.code, semanaDel: sem.semanaDel, lugar: sem.lugar, dia: DIAS[wd], tema: temas[t++ % temas.length], hora: '07:00', duracion: '15 min',
        ejecutor: n(personas[0]) + (d % 3 === 0 ? ' / ' + n(personas[9]) : ''), ejecutorCedula: personas[0][2],
        asistentes: gente.map((x) => ({ nombre: n(x), cedula: x[2], cargo: x[3], firma: firmaFalsa(n(x) + f) })), quitar: [], opId: 's-gd' + d });
    }
  }, PERSONAS);
  console.log('✓ charlas');

  // ── 6. Inspecciones de EPP (una con elementos en mal estado)
  await ir('inspeccion-epp.html');
  await p.evaluate(async (personas) => {
    const n = (x) => x[0] + ' ' + x[1];
    const fechaCorta = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
    const lista = ELEMENTOS.slice();
    const casos = [[1, -6, {}], [2, -6, { 'GUANTES DE VAQUETA': 'M' }], [3, -2, {}], [5, -1, { 'CARETA DE SOLDAR': 'R', 'FILTROS / CARTUCHO': 'M' }]];
    for (const [i, d, raros] of casos) {
      const items = {}; lista.forEach((e) => { items[e] = raros[e] || (/CARETA|PETO|SOPORTE|VISOR/.test(e) && personas[i][3] !== 'Soldador' ? 'N/A' : 'B'); });
      await srv('epp', { opId: 's-epp' + i, nombre: n(personas[i]), cedula: personas[i][2], cargo: personas[i][3], inspector: n(personas[11]), inspectorCorreo: 'sst@montajesandinos.demo',
        fechaInspeccion: fechaCorta(isoMas(d)), tipo: 'epp', items, unidades: {}, observaciones: Object.keys(raros).length ? 'Se solicita reposición.' : '',
        sigTrabajador: firmaFalsa(n(personas[i])), sigInspector: firmaFalsa(n(personas[11])) });
    }
  }, PERSONAS);
  console.log('✓ EPP');

  // ── 7. Gestión del SG-SST: habilitación, reportes, inspecciones, plan de acción e indicadores
  await ir('inspecciones.html');
  await p.evaluate(async (personas) => {
    const n = (x) => x[0] + ' ' + x[1];
    const sg = (cuerpo) => srv('sgsst', cuerpo);
    const mesesMas = (iso, k) => Festivos.sumarMeses(iso, k);
    // Foto de ejemplo (dibujo simple, sin personas reales).
    const foto = (texto, color) => { const c = document.createElement('canvas'); c.width = 640; c.height = 420; const g = c.getContext('2d');
      g.fillStyle = color || '#8aa0b4'; g.fillRect(0, 0, 640, 420); g.fillStyle = '#ffffffcc'; g.fillRect(0, 330, 640, 90);
      g.fillStyle = '#2b3a48'; g.font = 'bold 30px Arial'; g.fillText('📷 ' + texto, 24, 385); g.strokeStyle = '#2b3a48'; g.lineWidth = 6;
      g.strokeRect(120, 60, 400, 220); g.beginPath(); g.moveTo(120, 280); g.lineTo(320, 120); g.lineTo(520, 280); g.stroke(); return c.toDataURL('image/jpeg', 0.7); };
    // a) Personal habilitado
    const req = (fecha, meses, extra) => Object.assign({ fecha, vence: mesesMas(fecha, meses) }, extra || {});
    const pila = isoMas(0).slice(0, 8) + '01';
    for (let i = 0; i < personas.length; i++) {
      const x = personas[i], r = {
        seguridad_social: req(i === 10 ? Festivos.sumarMeses(pila, -2) : pila, 1),
        induccion: req(isoMas(-200 + i * 7), 12),
        medico: req(isoMas(-150 - i * 9), 12, { apto: i === 2 ? 'Apto con restricciones' : 'Apto', restricciones: i === 2 ? 'No levantar más de 20 kg' : '' })
      };
      if ([0, 1, 2, 3, 4, 5].indexOf(i) !== -1) r.alturas = i === 4 ? { fecha: isoMas(-560), vence: isoMas(-12) } : i === 5 ? { fecha: isoMas(-530), vence: isoMas(10) } : req(isoMas(-90 - i * 30), 18);
      if (i === 2 || i === 3) r.confinados = req(isoMas(-60), 12);
      if (i === 6) r.electrico = req(isoMas(-100), 12);
      if (i === 7 || i === 8) r.izajes = req(isoMas(-180), 12);
      if (i === 1 || i === 5) r.caliente = req(isoMas(-45), 12);
      await sg({ action: 'parche', tipo: 'trabajador', id: 'TRB-' + x[2], campos: { nombre: n(x), cedula: x[2], cargo: x[3], empresa: i === 8 ? 'Grúas del Centro (contratista)' : 'Montajes Andinos', activo: true, requisitos: r } });
    }
    // b) Reportes
    const rep = async (id, doc) => sg({ action: 'guardar', tipo: 'reporte', id, doc: Object.assign({ estado: 'ABIERTO', acciones: [] }, doc) });
    const acc = async (id, a) => sg({ action: 'guardar', tipo: 'accion', id, doc: Object.assign({ tipoAccion: 'Correctiva', prioridad: 'Media', estado: 'ABIERTA', seguimiento: [], fotos: [] }, a) });
    const idR = (d, s) => 'REP-' + isoMas(d).replace(/-/g, '') + '-' + s;
    const idA = (d, s) => 'ACC-' + isoMas(d).replace(/-/g, '') + '-' + s;
    const r1 = idR(-6, 'DEM001'), r2 = idR(-3, 'DEM002'), r3 = idR(-12, 'DEM003'), r4 = idR(-5, 'DEM004');
    const a1 = idA(-6, 'DEM101'), a2 = idA(-11, 'DEM102'), a3 = idA(-11, 'DEM103'), a4 = idA(-4, 'DEM104'), a5 = idA(-3, 'DEM105');
    await rep(r1, { clase: 'Acto inseguro', fecha: isoMas(-6), hora: '10:20', lugar: 'Taller de fabricación', centro: 'Planta propia', potencial: 'Alto',
      descripcion: 'Trabajador esmerilando sin careta facial; solo con gafas. Proyección de partículas hacia la cara.', accionInmediata: 'Se detuvo la tarea y se entregó careta.',
      anonimo: false, reportadoPor: n(personas[9]), estado: 'CERRADO', cierre: { fecha: isoMas(-4), nota: 'Se reforzó el uso de careta en la charla del día.' }, acciones: [a1], fotos: [foto('Esmerilado sin careta', '#9b8a6a')] });
    await acc(a1, { origen: 'Reporte de acto/condición', origenRef: r1, hallazgo: 'Esmerilado sin careta facial', accion: 'Charla de protección facial y revisión de caretas en el taller', responsable: n(personas[0]),
      fechaCompromiso: isoMas(-3), fecha: isoMas(-6), estado: 'CERRADA', cierre: { fecha: isoMas(-4), evidencia: 'Charla dictada a 7 personas; 2 caretas repuestas.', eficaz: 'Sí', quien: n(personas[0]), fotos: [] } });
    await rep(r2, { clase: 'Condición insegura', fecha: isoMas(-3), hora: '08:05', lugar: 'Bodega · rack 3', centro: 'Planta propia', potencial: 'Medio',
      descripcion: 'Estantería sin anclaje al muro, con material pesado en el nivel superior.', accionInmediata: 'Se bajó el material pesado al nivel inferior.', anonimo: true, reportadoPor: '', acciones: [a5], fotos: [foto('Estantería sin anclaje', '#7c8f6a')] });
    await acc(a5, { origen: 'Reporte de acto/condición', origenRef: r2, hallazgo: 'Estantería del rack 3 sin anclaje', accion: 'Anclar las estanterías de la bodega al muro', responsable: n(personas[3]), fechaCompromiso: isoMas(9), fecha: isoMas(-3), prioridad: 'Alta' });
    await rep(r3, { clase: 'Incidente', fecha: isoMas(-12), hora: '14:40', lugar: 'Cuarto de calderas · andamio norte', centro: 'Cliente Bebidas La Sabana', potencial: 'Alto',
      descripcion: 'Cayó una llave de tubo desde la plataforma del andamio (4 m) al piso de tránsito. No había nadie debajo.', accionInmediata: 'Se demarcó el área inferior y se instaló rodapié provisional.',
      anonimo: false, reportadoPor: n(personas[1]), acciones: [a2, a3], fotos: [foto('Andamio sin rodapié', '#6a7f9b')],
      investigacion: { estado: 'CERRADA', fecha: isoMas(-8), inicio: isoMas(-11), hechos: 'Durante el desmonte de tubería, la llave quedó sobre la plataforma sin rodapié y cayó al moverse el tubo.',
        causas: { actos: ['Ubicarse o adoptar una posición inadecuada'], condiciones: ['Guardas o barreras inadecuadas'], personales: ['Falta de conocimiento o de entrenamiento'], trabajo: ['Liderazgo o supervisión inadecuada', 'Estándares o procedimientos inadecuados o inexistentes'] },
        analisis: '¿Por qué cayó? No había rodapié. ¿Por qué? El andamio se armó sin el kit completo. ¿Por qué? No se verificó con la lista de chequeo antes de subir.', conclusiones: 'Toda plataforma debe tener rodapié; inspección del andamio antes de usarlo.',
        equipo: [{ rol: 'Jefe inmediato o supervisor', nombre: n(personas[0]), cedula: personas[0][2], firma: firmaFalsa(n(personas[0])) }, { rol: 'Representante del COPASST o vigía', nombre: n(personas[6]), cedula: personas[6][2], firma: firmaFalsa(n(personas[6])) },
          { rol: 'Responsable de SST', nombre: n(personas[9]), cedula: personas[9][2], firma: firmaFalsa(n(personas[9])) }] } });
    await acc(a2, { origen: 'Incidente', origenRef: r3, hallazgo: 'Andamio sin rodapié', accion: 'Comprar 10 rodapiés y completar el kit de los andamios', responsable: n(personas[0]), fechaCompromiso: isoMas(-2), fecha: isoMas(-11), prioridad: 'Alta',
      estado: 'CERRADA', cierre: { fecha: isoMas(-4), evidencia: 'Rodapiés instalados en los 3 andamios.', eficaz: 'Pendiente de verificar', quien: n(personas[0]), fotos: [foto('Rodapié instalado', '#6a9b7c')] } });
    await acc(a3, { origen: 'Incidente', origenRef: r3, hallazgo: 'No se usa la lista de chequeo del andamio', accion: 'Inspeccionar cada andamio con el portal antes de usarlo (tarjeta verde/roja)', responsable: n(personas[9]), fechaCompromiso: isoMas(-1), fecha: isoMas(-11),
      seguimiento: [{ fecha: isoMas(-7), texto: 'Se agregaron los andamios al inventario de inspecciones.', quien: n(personas[9]) }] });
    await rep(r4, { clase: 'Accidente de trabajo', fecha: isoMas(-5), hora: '15:10', lugar: 'Cuarto de calderas', centro: 'Cliente Bebidas La Sabana', potencial: 'Medio',
      descripcion: 'Al aflojar una brida con llave de tubo, la llave se deslizó y golpeó la mano izquierda del trabajador.', accionInmediata: 'Primeros auxilios en sitio y remisión a la IPS de la ARL.',
      anonimo: false, reportadoPor: n(personas[0]), lesionado: { nombre: n(personas[1]), cedula: personas[1][2], cargo: personas[1][3], parteCuerpo: 'Manos', tipoLesion: 'Golpe, contusión o aplastamiento',
        mecanismo: 'Pisadas, choques o golpes', agente: 'Herramientas o implementos', atencion: 'Remitido a IPS / urgencias' }, grave: false, mortal: false, diasIncapacidad: 2, diasCargados: 0,
      furat: { radicado: true, fecha: isoMas(-4), numero: 'FURAT-2219834' }, acciones: [a4],
      investigacion: { estado: 'EN CURSO', inicio: isoMas(-3), hechos: 'La llave de tubo no era del tamaño de la brida y se deslizó al aplicar fuerza.', causas: { actos: ['Usar equipo o herramienta defectuosa'], condiciones: [], personales: [], trabajo: ['Herramientas o equipos inadecuados'] }, equipo: [] } });
    await acc(a4, { origen: 'Accidente de trabajo', origenRef: r4, hallazgo: 'Llave de tubo de tamaño inadecuado', accion: 'Dotar el carro de herramientas con juego de llaves de golpe para bridas', responsable: n(personas[0]), fechaCompromiso: isoMas(6), fecha: isoMas(-4), prioridad: 'Alta' });
    await acc(idA(-30, 'DEM106'), { origen: 'COPASST', origenRef: '', hallazgo: 'Ruta de evacuación de la bodega sin señalizar', accion: 'Señalizar la ruta de evacuación y el punto de encuentro de la bodega', responsable: n(personas[3]), fechaCompromiso: isoMas(10), fecha: isoMas(-30), tipoAccion: 'Preventiva' });
    await acc(idA(-40, 'DEM107'), { origen: 'Auditoría', origenRef: '', hallazgo: 'La matriz de peligros no incluye la tarea de izaje con grúa', accion: 'Actualizar la matriz de peligros con las tareas de izaje', responsable: n(personas[9]), fechaCompromiso: isoMas(-3), fecha: isoMas(-40), tipoAccion: 'Preventiva', prioridad: 'Alta' });
    // c) Inventario e inspecciones
    const PL = {}; PLANTILLAS_INSPECCION.forEach((x) => { PL[x.id] = x; });
    const eq = async (id, campos) => sg({ action: 'parche', tipo: 'equipo', id, campos: Object.assign({ activo: true, vencimientos: {} }, campos) });
    await eq('EQP-DEMO-EXT01', { categoria: 'extintor', codigo: 'EXT-01', nombre: 'Extintor PQS 20 lb', ubicacion: 'Bodega, puerta norte', frecuencia: 'mensual', vencimientos: { 'Recarga': isoMas(40), 'Prueba hidrostática': isoMas(900) } });
    await eq('EQP-DEMO-EXT02', { categoria: 'extintor', codigo: 'EXT-02', nombre: 'Extintor CO2 15 lb', ubicacion: 'Cuarto de calderas', frecuencia: 'mensual', vencimientos: { 'Recarga': isoMas(-10), 'Prueba hidrostática': isoMas(600) } });
    await eq('EQP-DEMO-BOT01', { categoria: 'botiquin', codigo: 'BOT-01', nombre: 'Botiquín tipo A', ubicacion: 'Oficina de obra', frecuencia: 'mensual', vencimientos: { 'Insumo más próximo a vencer': isoMas(75) } });
    await eq('EQP-DEMO-ARN03', { categoria: 'arnes', codigo: 'ARN-03', nombre: 'Arnés cuerpo entero 4 argollas', ubicacion: 'Almacén de EPP', frecuencia: 'mensual', vencimientos: { 'Inspección certificada anual': isoMas(110), 'Vida útil (fabricante)': isoMas(1300) } });
    await eq('EQP-DEMO-AND01', { categoria: 'andamio', codigo: 'AND-01', nombre: 'Andamio multidireccional 3 cuerpos', ubicacion: 'Cuarto de calderas', frecuencia: 'semanal' });
    await eq('EQP-DEMO-PUL02', { categoria: 'herramienta_electrica', codigo: 'PUL-02', nombre: 'Pulidora 4½" 900 W', ubicacion: 'Taller', frecuencia: 'diaria' });
    await eq('EQP-DEMO-VEH01', { categoria: 'vehiculo', codigo: 'VEH-01', nombre: 'Camioneta de obra (placa ficticia DEM 123)', ubicacion: 'Parqueadero', frecuencia: 'diaria', vencimientos: { 'SOAT': isoMas(200), 'Revisión técnico-mecánica': isoMas(28), 'Licencia del conductor': isoMas(700) } });
    await eq('EQP-DEMO-LOC01', { categoria: 'locativa', codigo: 'LOC-BOD', nombre: 'Bodega principal', ubicacion: 'Sede', frecuencia: 'mensual' });
    const insp = async (dia, eqId, cat, nombre, lugar, ncIdx, obs, sfx) => {
      const p0 = PL[cat], id = 'INS-' + isoMas(dia).replace(/-/g, '') + '-' + sfx;
      const items = p0.items.map((t, i) => ({ t, r: ncIdx.indexOf(i) !== -1 ? 'NC' : 'C', obs: ncIdx.indexOf(i) !== -1 ? obs : '', fotos: ncIdx.indexOf(i) !== -1 ? [foto(obs, '#9b6a6a')] : [] }));
      await sg({ action: 'guardar', tipo: 'inspeccion', id, doc: { categoria: p0.nombre, plantilla: cat, equipoId: eqId, equipoNombre: nombre, fecha: isoMas(dia), lugar, items, observaciones: '', fotos: [],
        inspector: { nombre: n(personas[11]), cedula: personas[11][2], firma: firmaFalsa(n(personas[11])) }, preoperacional: !!p0.preoperacional } });
      await sg({ action: 'parche', tipo: 'equipo', id: eqId, campos: { ultimaInspeccion: isoMas(dia), ultimoResultado: ncIdx.length ? 'NO CONFORME' : 'CONFORME' } });
      return id;
    };
    await insp(-20, 'EQP-DEMO-EXT01', 'extintor', 'EXT-01 · Extintor PQS 20 lb', 'Bodega', [], '', 'DEM201');
    await insp(-34, 'EQP-DEMO-EXT02', 'extintor', 'EXT-02 · Extintor CO2 15 lb', 'Cuarto de calderas', [], '', 'DEM202');
    await insp(-25, 'EQP-DEMO-BOT01', 'botiquin', 'BOT-01 · Botiquín tipo A', 'Oficina de obra', [], '', 'DEM203');
    await insp(-2, 'EQP-DEMO-ARN03', 'arnes', 'ARN-03 · Arnés cuerpo entero 4 argollas', 'Almacén de EPP', [], '', 'DEM204');
    await insp(-4, 'EQP-DEMO-AND01', 'andamio', 'AND-01 · Andamio multidireccional 3 cuerpos', 'Cuarto de calderas', [], '', 'DEM205');
    await insp(-36, 'EQP-DEMO-LOC01', 'locativa', 'LOC-BOD · Bodega principal', 'Sede', [], '', 'DEM206');
    const iPul = await insp(-1, 'EQP-DEMO-PUL02', 'herramienta_electrica', 'PUL-02 · Pulidora 4½" 900 W', 'Taller', [2], 'Guarda suelta, no ajusta', 'DEM207');
    await acc(idA(-1, 'DEM108'), { origen: 'Inspección planeada', origenRef: iPul, hallazgo: 'PUL-02 · Pulidora 4½" 900 W: Guarda de protección instalada y bien ajustada — Guarda suelta, no ajusta',
      accion: 'Corregir en PUL-02: cambiar la abrazadera de la guarda (fuera de uso hasta entonces)', responsable: n(personas[0]), fechaCompromiso: isoMas(2), fecha: isoMas(-1), prioridad: 'Alta' });
    // d) Datos de indicadores: este mes y los dos anteriores
    for (let k = 0; k < 3; k++) {
      const m = Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', -k).slice(0, 7);
      let hab = 0, d = m + '-01'; while (d.slice(0, 7) === m) { if (Festivos.esHabil(d)) hab++; d = Festivos.sumarDias(d, 1); }
      const trab = [44, 42, 41][k];
      await sg({ action: 'parche', tipo: 'mes', id: 'MES-' + m, campos: { mes: m, trabajadores: trab, diasProgramados: trab * hab, diasAusencia: [6, 11, 3][k], hht: trab * hab * 8,
        casosEL: 0, casosELNuevos: 0, inspeccionesProgramadas: 8, capacitacionesProgramadas: 20 } });
    }
  }, PERSONAS);
  console.log('✓ gestión del SG-SST');

  // ── 8. Comités (COPASST y Convivencia, con quejas CIFRADAS) y auditorías
  await ir('convivencia.html');
  await p.evaluate(async (personas) => {
    const sg = (cuerpo) => srv('sgsst', cuerpo);
    const n = (x) => x[0] + ' ' + x[1];
    const M = (i, representa, calidad, rol, extra) => Object.assign({ nombre: n(personas[i]), cedula: personas[i][2], cargo: personas[i][3], representa, calidad, rol: rol || 'Integrante' }, extra || {});
    const dosAnios = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 2); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
    const acc = async (id, a) => sg({ action: 'guardar', tipo: 'accion', id, doc: Object.assign({ tipoAccion: 'Preventiva', prioridad: 'Media', estado: 'ABIERTA', seguimiento: [], fotos: [], centro: '' }, a) });
    const idA = (d, s) => 'ACC-' + isoMas(d).replace(/-/g, '') + '-' + s;
    const hab = (iso) => { let d = iso; while (!Festivos.esHabil(d)) d = Festivos.sumarDias(d, 1); return d; };
    // Meses del año en curso que ya pasaron (las reuniones ordinarias del 8 de cada mes, o el hábil siguiente)
    const hoy = isoMas(0), mesesPasados = [];
    for (let m = 1; m < Number(hoy.slice(5, 7)); m++) mesesPasados.push(hab(hoy.slice(0, 4) + '-' + ('0' + m).slice(-2) + '-08'));

    // a) COPASST (44 trabajadores → 2 por parte, con suplentes)
    const ini = isoMas(-400);
    const copMiembros = [M(0, 'Empleador', 'Principal', 'Presidente'), M(9, 'Empleador', 'Principal'), M(11, 'Empleador', 'Suplente'), M(8, 'Empleador', 'Suplente'),
      M(1, 'Trabajadores', 'Principal', 'Secretario'), M(3, 'Trabajadores', 'Principal'), M(2, 'Trabajadores', 'Suplente'), M(7, 'Trabajadores', 'Suplente')];
    await sg({ action: 'guardar', tipo: 'comite', id: 'CMT-COPASST', doc: { comite: 'copasst', trabajadores: 44, periodos: [{ uid: 'demo-p1', inicio: ini, fin: dosAnios(ini), fechaEleccion: Festivos.sumarDias(ini, -10), mecanismo: 'Votación secreta de los trabajadores', miembros: copMiembros }],
      capacitaciones: [{ uid: 'demo-k1', fecha: isoMas(-380), tema: 'Funciones y responsabilidades del COPASST', horas: '4', entidad: 'ARL' }, { uid: 'demo-k2', fecha: isoMas(-150), tema: 'Investigación de incidentes y accidentes (Res. 1401)', horas: '8', entidad: 'ARL' }] } });
    const temasCop = ['Verificación del quórum', 'Lectura y aprobación del acta anterior', 'Seguimiento a compromisos', 'Accidentes e incidentes del mes', 'Inspecciones y condiciones reportadas', 'Propuestas e inquietudes de los trabajadores', 'Compromisos y varios'];
    const actaCopMesPasado = 'REU-' + (mesesPasados[mesesPasados.length - 1] || isoMas(-25)).replace(/-/g, '') + '-DEMCOP';
    for (let k = 0; k < mesesPasados.length; k++) {
      const f = mesesPasados[k], ultimo = k === mesesPasados.length - 1, id = ultimo ? actaCopMesPasado : 'REU-' + f.replace(/-/g, '') + '-DC' + k;
      const asis = copMiembros.map((m, i) => Object.assign({}, m, { asistio: m.calidad === 'Principal' ? (k % 4 === 1 && i === 1 ? 'Excusa' : 'Sí') : (k % 4 === 1 && i === 2 ? 'Sí' : 'No') }));
      asis.forEach((a) => { a.firma = a.asistio === 'Sí' ? firmaFalsa(a.nombre) : ''; });
      await sg({ action: 'guardar', tipo: 'reunion', id, doc: { comite: 'copasst', tipoReunion: 'Ordinaria', numero: ('0' + (k + 1)).slice(-2) + '-' + f.slice(0, 4), fecha: f, horaInicio: '07:00', horaFin: '08:00', lugar: 'Sala de reuniones de la sede', modalidad: 'Presencial', motivo: '',
        asistentes: asis, invitados: '', ordenDia: temasCop, seguimiento: [], quorum: true, proximaReunion: '',
        desarrollo: ultimo ? 'Se revisó el accidente del mes (golpe en mano con llave de tubo) y el incidente del andamio sin rodapié: las acciones están en curso.\nSe recorrió la bodega: la ruta de evacuación no está señalizada.\nLos trabajadores piden más caretas de esmerilar en el taller.' : 'Se revisaron los reportes e inspecciones del mes. Sin novedades graves. Compromisos anteriores al día.',
        compromisos: ultimo ? [idA(-30, 'DEM106')] : [], compromisosDetalle: ultimo ? [{ id: idA(-30, 'DEM106'), accion: 'Señalizar la ruta de evacuación y el punto de encuentro de la bodega', responsable: n(personas[3]), fecha: isoMas(10) }] : [] } });
    }
    await sg({ action: 'parche', tipo: 'accion', id: idA(-30, 'DEM106'), campos: { origenRef: actaCopMesPasado } });

    // a2) Comité de emergencias (v107): reunión cada trimestre
    const emeMiembros = [M(0, 'Empleador', 'Principal', 'Presidente'), M(3, 'Trabajadores', 'Principal', 'Secretario'), M(1, 'Trabajadores', 'Principal'), M(9, 'Empleador', 'Principal')];
    await sg({ action: 'guardar', tipo: 'comite', id: 'CMT-EMERGENCIAS', doc: { comite: 'emergencias', trabajadores: 44, periodos: [{ uid: 'demo-e1', inicio: isoMas(-300), fin: dosAnios(isoMas(-300)), fechaEleccion: isoMas(-305), mecanismo: 'Designación de la alta dirección', miembros: emeMiembros }],
      capacitaciones: [{ uid: 'demo-k4', fecha: isoMas(-260), tema: 'Sistema comando de incidentes y plan de emergencias', horas: '8', entidad: 'ARL' }] } });
    const triPasados = mesesPasados.filter((f) => [3, 6, 9].indexOf(Number(f.slice(5, 7))) !== -1);
    for (let k = 0; k < triPasados.length; k++) {
      const f = triPasados[k], asis = emeMiembros.map((m) => Object.assign({}, m, { asistio: 'Sí', firma: firmaFalsa(m.nombre) }));
      await sg({ action: 'guardar', tipo: 'reunion', id: 'REU-' + f.replace(/-/g, '') + '-DE' + k, doc: { comite: 'emergencias', tipoReunion: 'Ordinaria', numero: ('0' + (k + 1)).slice(-2) + '-' + f.slice(0, 4), fecha: f, horaInicio: '10:00', horaFin: '11:00',
        lugar: 'Sala de reuniones de la sede', modalidad: 'Presencial', motivo: '', asistentes: asis, invitados: '', ordenDia: ['Verificación del quórum', 'Seguimiento a compromisos', 'Brigada: capacitación y dotación', 'Simulacros'], seguimiento: [], quorum: true, proximaReunion: '', compromisos: [], compromisosDetalle: [],
        desarrollo: 'Se revisó la dotación de la brigada y el estado de los extintores. ' + (k === triPasados.length - 1 ? 'Se preparó el simulacro de evacuación del semestre.' : 'Sin novedades.') } });
    }

    // b) Comité de Convivencia: clave del comité y quejas cifradas
    const iniC = isoMas(-200);
    const conMiembros = [M(9, 'Empleador', 'Principal', 'Presidente'), M(11, 'Empleador', 'Principal'), M(8, 'Empleador', 'Suplente'), M(0, 'Empleador', 'Suplente'),
      M(6, 'Trabajadores', 'Principal', 'Secretario'), M(5, 'Trabajadores', 'Principal'), M(7, 'Trabajadores', 'Suplente'), M(10, 'Trabajadores', 'Suplente')].map((m) => Object.assign(m, { confidencialidad: true, inhabilidad: true }));
    const nueva = await Cifrado.crear('Convivencia2026');
    await sg({ action: 'guardar', tipo: 'comite', id: 'CMT-CONVIVENCIA', pruebaNueva: nueva.llave.prueba, doc: { comite: 'convivencia', trabajadores: 44, cifrado: { actual: nueva.config, anterior: null },
      periodos: [{ uid: 'demo-c1', inicio: iniC, fin: dosAnios(iniC), fechaEleccion: Festivos.sumarDias(iniC, -7), mecanismo: 'Votación secreta de los trabajadores', miembros: conMiembros }],
      capacitaciones: [{ uid: 'demo-k3', fecha: isoMas(-180), tema: 'Resolución de conflictos y comunicación asertiva', horas: '4', entidad: 'ARL' }] } });
    const temasCon = ['Verificación del quórum', 'Lectura y aprobación del acta anterior', 'Estado general de los casos (solo códigos y etapas)', 'Seguimiento a compromisos y planes de mejora', 'Actividades de prevención del acoso laboral', 'Varios'];
    const mesesCon = mesesPasados.filter((f) => f >= iniC);
    for (let k = 0; k < mesesCon.length; k++) {
      const f = mesesCon[k];
      const asis = conMiembros.map((m) => Object.assign({}, m, { asistio: m.calidad === 'Principal' ? 'Sí' : 'No' }));
      asis.forEach((a) => { a.firma = a.asistio === 'Sí' ? firmaFalsa(a.nombre) : ''; });
      await sg({ action: 'guardar', tipo: 'reunion', id: 'REU-' + f.replace(/-/g, '') + '-DV' + k, doc: { comite: 'convivencia', tipoReunion: 'Ordinaria', numero: ('0' + (k + 1)).slice(-2) + '-' + f.slice(0, 4), fecha: f, horaInicio: '15:00', horaFin: '15:45',
        lugar: 'Sala de reuniones de la sede', modalidad: 'Presencial', motivo: '', asistentes: asis, invitados: '', ordenDia: temasCon, seguimiento: [], quorum: true, proximaReunion: '', compromisos: [], compromisosDetalle: [],
        desarrollo: 'Estado de los casos: ' + (k === mesesCon.length - 1 ? 'CCL-001 cerrado con acuerdo cumplido.' : 'sin casos nuevos.') + '\nSe programa la charla de buen trato para el próximo mes.' } });
    }
    const cod = (k) => 'CCL-' + isoMas(-80).slice(0, 4) + '-00' + k;
    const queja = async (id, pub, datos) => sg({ action: 'guardar', tipo: 'queja', id, prueba: nueva.llave.prueba, doc: Object.assign({}, pub, { cifrado: await Cifrado.cifrar(nueva.llave, datos) }) });
    await queja('QJA-' + isoMas(-80).replace(/-/g, '') + '-DEMQ1', { codigo: cod(1), fechaRecepcion: isoMas(-80), etapa: 'Cerrada', estado: 'CERRADA', fechaCierre: isoMas(-38), inicioEtapa: isoMas(-38), venceEtapa: '', venceTotal: isoMas(-15) }, {
      recepcion: { medio: 'Por escrito' }, sexual: false, quejoso: { nombre: 'Trabajadora A (nombre ficticio)', cargo: 'Auxiliar de bodega', area: 'Bodega' }, querellados: [{ nombre: 'Trabajador B (nombre ficticio)', cargo: 'Montacarguista', area: 'Bodega' }],
      relacion: 'Entre compañeros', modalidades: ['Maltrato laboral'], hechos: 'Burlas y apodos frente al grupo durante varias semanas.', fechasHechos: 'Durante el mes anterior a la queja', testigos: 'Dos compañeros de turno', pruebas: 'Ninguna documental',
      actuaciones: [{ uid: 'a1', fecha: isoMas(-78), tipo: 'Trámite y comunicación a las partes', texto: 'Se informa a las partes el inicio del trámite.' }, { uid: 'a2', fecha: isoMas(-74), tipo: 'Escucha de la parte que se queja', texto: 'Se escucha a la trabajadora.' },
        { uid: 'a3', fecha: isoMas(-73), tipo: 'Escucha de la parte señalada', texto: 'Se escucha al trabajador; reconoce los apodos.' }, { uid: 'a4', fecha: isoMas(-66), tipo: 'Reunión de diálogo', texto: 'Reunión con las dos partes.', acuerdos: 'Trato respetuoso; no usar apodos.' },
        { uid: 'a5', fecha: isoMas(-38), tipo: 'Seguimiento de compromisos', texto: 'Las partes confirman que el acuerdo se cumple.' }],
      compromisos: [{ uid: 'c1', texto: 'No usar apodos ni burlas', responsable: 'Trabajador B', fecha: isoMas(-36), cumplido: true, fechaCumplido: isoMas(-38) }, { uid: 'c2', texto: 'Charla de buen trato para el turno', responsable: 'Jefe de bodega', fecha: isoMas(-45), cumplido: true, fechaCumplido: isoMas(-47) }],
      cierre: { fecha: isoMas(-38), motivo: 'Acuerdo y compromisos cumplidos', remitidaA: '', observaciones: '' } });
    await queja('QJA-' + isoMas(-9).replace(/-/g, '') + '-DEMQ2', { codigo: cod(2), fechaRecepcion: isoMas(-9), etapa: 'Escucha de las partes', estado: 'ABIERTA', fechaCierre: '', inicioEtapa: isoMas(-3), venceEtapa: isoMas(2), venceTotal: isoMas(56) }, {
      recepcion: { medio: 'Correo electrónico' }, sexual: false, quejoso: { nombre: 'Trabajador C (nombre ficticio)', cargo: 'Soldador', area: 'Taller' }, querellados: [{ nombre: 'Persona D (nombre ficticio)', cargo: 'Supervisor', area: 'Taller' }],
      relacion: 'Jefe a colaborador', modalidades: ['Persecución laboral', 'Inequidad laboral'], hechos: 'Le asignan siempre las tareas más pesadas y le niegan los permisos que sí dan a otros.', fechasHechos: 'Últimos dos meses', testigos: '', pruebas: 'Correos de permisos negados (copia en el archivo físico)',
      actuaciones: [{ uid: 'b1', fecha: isoMas(-8), tipo: 'Trámite y comunicación a las partes', texto: 'Se recibe y se comunica a las partes.' }, { uid: 'b2', fecha: isoMas(-6), tipo: 'Examen del caso', texto: 'El comité revisa los correos aportados.' },
        { uid: 'b3', fecha: isoMas(-3), tipo: 'Cambio de etapa', texto: 'Pasa de "En examen" a "Escucha de las partes".' }], compromisos: [] });

  }, PERSONAS);
  await ir('auditorias.html');
  await p.evaluate(async (personas) => {
    const sg = (cuerpo) => srv('sgsst', cuerpo);
    const n = (x) => x[0] + ' ' + x[1];
    const acc = async (id, a) => sg({ action: 'guardar', tipo: 'accion', id, doc: Object.assign({ tipoAccion: 'Correctiva', prioridad: 'Media', estado: 'ABIERTA', seguimiento: [], fotos: [], centro: '' }, a) });
    const items = (pl, res) => PLANTILLAS_AUDITORIA[pl].items.map((i) => Object.assign({ id: i[0], grupo: i[1], ref: i[2], valor: i[3], texto: i[4], r: 'C', just: '', evid: '', sev: 'ncMenor', hdesc: '' }, res[i[0]] || {}));
    // Autoevaluación de estándares mínimos hace 2 meses: 85 % (moderadamente aceptable)
    const id1 = 'AUD-' + isoMas(-60).replace(/-/g, '') + '-DEMA1';
    const nc0312 = { '4.1.4': 'Sin mediciones de ruido en el taller', '5.1.2': 'Brigada sin dotación completa', '4.1.3': 'Sin inventario de sustancias químicas con su clasificación', '2.11.1': 'No hay procedimiento de gestión del cambio', '1.2.3': 'El responsable suplente no tiene el curso de 50 horas' };
    const res1 = { '1.1.5': { r: 'NA', just: 'No hay trabajadores en actividades de alto riesgo para pensión especial' } };
    Object.keys(nc0312).forEach((k) => { res1[k] = { r: 'NC', evid: nc0312[k] }; });
    const it1 = items('RES0312', res1);
    const hall1 = [], acc1 = [];
    let k = 0;
    for (const id of Object.keys(nc0312)) {
      const it = it1.find((x) => x.id === id), aid = 'ACC-' + isoMas(-60).replace(/-/g, '') + '-DEMA' + (++k);
      await acc(aid, { origen: 'Autoevaluación Res. 0312', origenRef: id1, hallazgo: 'Estándar ' + id + ' (no cumple): ' + it.texto, accion: { '4.1.4': 'Contratar mediciones de ruido e iluminación', '5.1.2': 'Comprar la dotación de la brigada (camilla, botiquín, radios)', '4.1.3': 'Hacer el inventario de sustancias químicas con sus hojas de seguridad', '2.11.1': 'Elaborar el procedimiento de gestión del cambio', '1.2.3': 'Inscribir al responsable suplente en el curso de 50 horas' }[id],
        responsable: n(personas[9]), fechaCompromiso: isoMas([-5, 20, 35, -2, 15][k - 1]), fecha: isoMas(-60), prioridad: 'Alta',
        estado: k === 4 || k === 1 ? 'CERRADA' : 'ABIERTA', cierre: k === 4 || k === 1 ? { fecha: isoMas(-10), evidencia: 'Hecho (ver soporte en la carpeta del SG-SST).', eficaz: 'Sí', quien: n(personas[9]), fotos: [] } : undefined });
      hall1.push({ uid: 'it-' + id, itemId: id, tipo: 'ncMenor', requisito: 'Estándar ' + id, descripcion: it.texto, evidencia: nc0312[id], accionId: aid }); acc1.push(aid);
    }
    await sg({ action: 'guardar', tipo: 'auditoria', id: id1, doc: { plantilla: 'RES0312', tipoAuditoria: PLANTILLAS_AUDITORIA.RES0312.corto, titulo: 'Autoevaluación de estándares mínimos ' + isoMas(-60).slice(0, 4), fechaPlan: isoMas(-62), fechaEjecucion: isoMas(-60), estado: 'CERRADA',
      auditor: { nombre: n(personas[9]), cargo: personas[9][3], independiente: true }, equipo: n(personas[11]), alcance: 'Todo el SG-SST de la empresa', objetivo: 'Evaluar el cumplimiento de los estándares mínimos y definir el plan de mejoramiento.', criterios: PLANTILLAS_AUDITORIA.RES0312.criterios,
      copasst: { participo: true, nombre: n(personas[1]) }, items: it1, hallazgos: hall1, acciones: acc1, puntaje: 85, valoracion: 'MODERADAMENTE ACEPTABLE', auditados: n(personas[0]) + ' — Supervisor de obra\n' + n(personas[11]) + ' — Inspectora HSE',
      fortalezas: 'Reporte e investigación de incidentes al día; COPASST activo con reuniones mensuales.', conclusiones: 'Resultado moderadamente aceptable: plan de mejoramiento con 5 acciones; reporte de avances a la ARL en máximo 6 meses.',
      firmaAuditor: firmaFalsa(n(personas[9])), firmaAuditado: firmaFalsa(n(personas[0])), auditadoNombre: n(personas[0]) } });
    // Auditoría del cliente hace 20 días
    const id2 = 'AUD-' + isoMas(-20).replace(/-/g, '') + '-DEMA2', aid2 = 'ACC-' + isoMas(-20).replace(/-/g, '') + '-DEMA9';
    const it2 = items('CONTRATISTA', { C9: { r: 'NC', sev: 'ncMenor', hdesc: 'Dos eslingas sin la inspección del mes ni etiqueta de capacidad', evid: 'Revisión en el sitio' }, C12: { r: 'OBS', hdesc: 'Un trabajador nuevo no conocía el punto de encuentro', evid: 'Entrevista' } });
    await acc(aid2, { origen: 'Auditoría', origenRef: id2, hallazgo: 'No conformidad menor · C9: Dos eslingas sin la inspección del mes ni etiqueta de capacidad', accion: 'Inspeccionar y rotular todas las eslingas; retirar las que no tengan etiqueta', responsable: n(personas[7]), fechaCompromiso: isoMas(4), fecha: isoMas(-20), prioridad: 'Media' });
    await sg({ action: 'guardar', tipo: 'auditoria', id: id2, doc: { plantilla: 'CONTRATISTA', tipoAuditoria: PLANTILLAS_AUDITORIA.CONTRATISTA.corto, titulo: 'Auditoría del cliente Bebidas La Sabana', fechaPlan: isoMas(-20), fechaEjecucion: isoMas(-20), estado: 'CERRADA',
      auditor: { nombre: 'Auditor del cliente (nombre ficticio)', cargo: 'HSE de Bebidas La Sabana', independiente: true }, equipo: '', alcance: 'Obra: cambio de tubería de vapor · cuarto de calderas', objetivo: 'Verificar los requisitos de SST del contrato.', criterios: PLANTILLAS_AUDITORIA.CONTRATISTA.criterios,
      copasst: { participo: false, nombre: '' }, items: it2, hallazgos: [{ uid: 'it-C9', itemId: 'C9', tipo: 'ncMenor', requisito: 'C9', descripcion: 'Dos eslingas sin la inspección del mes ni etiqueta de capacidad', evidencia: 'Revisión en el sitio', accionId: aid2 }, { uid: 'it-C12', itemId: 'C12', tipo: 'obs', requisito: 'C12', descripcion: 'Un trabajador nuevo no conocía el punto de encuentro', evidencia: 'Entrevista' }],
      acciones: [aid2], auditados: n(personas[0]) + ' — Supervisor de obra', fortalezas: 'Permisos de trabajo completos y firmados en el sitio.', conclusiones: 'Cumplimiento alto; una no conformidad menor en elementos de izaje.', firmaAuditor: firmaFalsa('Auditor cliente'), firmaAuditado: firmaFalsa(n(personas[0])), auditadoNombre: n(personas[0]) } });
    // Auditoría interna programada (con el COPASST)
    await sg({ action: 'guardar', tipo: 'auditoria', id: 'AUD-' + isoMas(0).replace(/-/g, '') + '-DEMA3', doc: { plantilla: 'DEC1072', tipoAuditoria: PLANTILLAS_AUDITORIA.DEC1072.corto, titulo: 'Auditoría interna del SG-SST ' + isoMas(0).slice(0, 4), fechaPlan: isoMas(25), fechaEjecucion: '', estado: 'PROGRAMADA',
      auditor: { nombre: 'Auditora externa (nombre ficticio)', cargo: 'Auditora ISO 45001', independiente: true }, equipo: '', alcance: 'Sede y obras activas', objetivo: 'Verificar el cumplimiento del SG-SST (Dec. 1072, art. 2.2.4.6.30).', criterios: PLANTILLAS_AUDITORIA.DEC1072.criterios,
      copasst: { participo: true, nombre: n(personas[1]) }, items: items('DEC1072', {}).map((i) => Object.assign(i, { r: '' })), hallazgos: [], acciones: [] } });
  }, PERSONAS);
  console.log('✓ comités y auditorías');

  // ── 9. Planear y revisar: plan anual, matriz de peligros, emergencias, salud, documental, revisión por la dirección
  const COMUN = `window.sg = (c) => srv('sgsst', c);
    window.gd = (tipo, id, doc) => srv('sgsst', { action: 'guardar', tipo, id, doc });
    window.nom = (x) => x[0] + ' ' + x[1];
    window.acc9 = (id, a) => srv('sgsst', { action: 'guardar', tipo: 'accion', id, doc: Object.assign({ tipoAccion: 'Preventiva', prioridad: 'Media', estado: 'ABIERTA', seguimiento: [], fotos: [], centro: '', fecha: isoMas(0) }, a) });`;
  await ctx.addInitScript(COMUN);
  await ir('plan-anual.html');
  await p.evaluate(async (personas) => {
    const anio = isoMas(0).slice(0, 4), mesHoy = Number(isoMas(0).slice(5, 7));
    const resp = { Planear: nom(personas[9]), Hacer: nom(personas[11]), Verificar: nom(personas[9]), Actuar: nom(personas[9]) };
    const actividades = PLANTILLA.map((x, i) => ({ uid: 'demo-a' + i, ciclo: x[0], actividad: x[1], tipo: x[2], meses: x[3].slice(), auto: x[4], responsable: x[1].indexOf('COPASST') !== -1 ? nom(personas[0]) : resp[x[0]], recursos: '', metaPersonas: x[2] === 'Capacitación' ? 40 : '' }));
    const ejec = {};
    actividades.forEach((a, i) => { if (a.auto) return; a.meses.filter((m) => m < mesHoy).forEach((m) => { if ((i + m) % 7 === 3) return; // algunas quedan atrasadas
      (ejec[a.uid] = ejec[a.uid] || {})[m] = { hecho: true, fecha: anio + '-' + ('0' + m).slice(-2) + '-15', asistentes: a.tipo === 'Capacitación' ? 34 + (m % 5) : '', evidencia: a.tipo === 'Capacitación' ? 'Registro de asistencia' : 'Soporte en la carpeta del SG-SST' }; }); });
    const doc = { anio, actividades, ejec, responsable: nom(personas[9]), empleador: 'Gerente general (nombre ficticio)', presupuesto: 48000000, fechaFirma: anio + '-01-20',
      metas: 'Cumplimiento del plan ≥ 90 %; frecuencia de accidentalidad menor que el año anterior; cobertura de capacitación ≥ 90 %.', recursos: 'Responsable del SG-SST de tiempo completo, inspectora HSE, presupuesto aprobado por la gerencia.',
      firmaEmpleador: firmaFalsa('Gerente general'), firmaResponsable: firmaFalsa(nom(personas[9])), firmado: true, estado: 'EN EJECUCIÓN' };
    const viejo = plan; plan = doc; const k = calcular(); plan = viejo;
    Object.assign(doc, { programadas: k.prog, ejecutadas: k.hechas, cumplimiento: k.cumplimiento, avance: k.avance, capProgramadas: k.capP, capEjecutadas: k.capH, cobertura: k.cobertura == null ? '' : k.cobertura });
    await gd('plananual', 'PAT-' + anio, doc);
    // v105: los dos meses anteriores ya cerrados (cierre del mes con su informe)
    for (const atras of [2, 1]) {
      const d = new Date(isoMas(0) + 'T12:00:00'); d.setDate(15); d.setMonth(d.getMonth() - atras);
      const mes = d.toISOString().slice(0, 7), sig = new Date(d); sig.setMonth(sig.getMonth() + 1); sig.setDate(atras === 1 ? 3 : 2);
      await gd('cierremes', 'CIE-' + mes, { mes, fechaCierre: sig.toISOString().slice(0, 10), cerradoPor: nom(personas[9]), trabajadores: 42, accidentes: atras === 2 ? 1 : 0, pasosOk: atras === 2 ? 6 : 7, pasosTotal: 7,
        observaciones: atras === 2 ? 'Quedó una inspección gerencial para la primera semana del mes siguiente.' : 'Mes cerrado sin pendientes.', estado: atras === 2 ? 'CERRADO CON PENDIENTES' : 'CERRADO' });
    }
  }, PERSONAS);
  await ir('peligros.html');
  await p.evaluate(async (personas) => {
    const P = (id, d) => { const e = evaluar(d); return gd('peligro', 'PEL-DEMO-' + id, Object.assign({ rutinaria: 'Sí', fechaRevision: isoMas(-200), medidas: {} }, d, { np: e.np, nr: e.nr, nivel: e.nivel, aceptabilidad: e.aceptabilidad,
      controlesPendientes: Object.keys(d.medidas || {}).filter((k) => d.medidas[k].estado === 'Por implementar' && !d.medidas[k].cerrada).length })); };
    const accLV = 'ACC-' + isoMas(-200).replace(/-/g, '') + '-DEMP01';
    await acc9(accLV, { origen: 'Matriz de peligros', origenRef: 'PEL-DEMO-01', hallazgo: 'Caída a distinto nivel en montaje de tubería · nivel I', accion: 'Controles de ingeniería: instalar puntos de anclaje certificados en el cuarto de calderas', responsable: nom(personas[0]), fechaCompromiso: isoMas(12), prioridad: 'Alta', fecha: isoMas(-200) });
    await P('01', { proceso: 'Montaje de tubería', zona: 'Cuarto de calderas (cliente)', actividad: 'Montaje y desmonte', tarea: 'Trabajo en andamio a más de 2 m', clasificacion: 'Condiciones de seguridad', subtipo: 'Trabajo en alturas', peligro: 'Caída a distinto nivel desde andamio', efectos: 'Fracturas, trauma craneoencefálico, muerte', expuestos: 6, cargos: 'Tubero, soldador, armador',
      ctrlFuente: 'Andamio certificado', ctrlMedio: 'Demarcación inferior', ctrlIndividuo: 'Arnés y doble eslinga', nd: 6, ne: 3, nc: 100, peorConsecuencia: 'Muerte', requisitoLegal: 'Res. 4272 de 2021',
      medidas: { ingenieria: { texto: 'Instalar puntos de anclaje certificados', estado: 'Por implementar', accionId: accLV }, administrativos: { texto: 'Permiso de trabajo en alturas y ATS', estado: 'Existente' }, epp: { texto: 'Arnés cuerpo entero, eslinga de doble terminal, casco con barbuquejo', estado: 'Existente' } } });
    await P('02', { proceso: 'Soldadura', zona: 'Taller', actividad: 'Soldadura de bridas', tarea: 'Soldadura SMAW', clasificacion: 'Químico', subtipo: 'Humos metálicos y no metálicos', peligro: 'Inhalación de humos de soldadura', efectos: 'Irritación respiratoria, intoxicación', expuestos: 3,
      ctrlMedio: 'Ventilación natural', ctrlIndividuo: 'Respirador para humos', nd: 6, ne: 3, nc: 25, peorConsecuencia: 'Enfermedad respiratoria', medidas: { ingenieria: { texto: 'Extractor localizado de humos', estado: 'Por implementar' }, epp: { texto: 'Respirador con filtro P100', estado: 'Existente' } } });
    await P('03', { proceso: 'Soldadura', zona: 'Taller', actividad: 'Esmerilado', tarea: 'Corte y pulido con pulidora', clasificacion: 'Condiciones de seguridad', subtipo: 'Mecánico', peligro: 'Proyección de partículas y contacto con disco', efectos: 'Lesiones oculares, cortaduras', expuestos: 5,
      ctrlFuente: 'Guarda de la pulidora', ctrlIndividuo: 'Careta y gafas', nd: 2, ne: 2, nc: 25, peorConsecuencia: 'Pérdida de visión', medidas: { administrativos: { texto: 'Inspección preoperacional diaria de la pulidora', estado: 'Existente' } } });
    await P('04', { proceso: 'Soldadura', zona: 'Taller', actividad: 'Soldadura y corte', tarea: 'Trabajo en caliente', clasificacion: 'Físico', subtipo: 'Ruido', peligro: 'Exposición a ruido de esmerilado', efectos: 'Hipoacusia', expuestos: 5, ctrlIndividuo: 'Protector auditivo de inserción', nd: 6, ne: 4, nc: 25, peorConsecuencia: 'Pérdida auditiva', requisitoLegal: 'Res. 1792 de 1990',
      medidas: { administrativos: { texto: 'Rotación de tareas y programa de conservación auditiva', estado: 'Por implementar' }, epp: { texto: 'Protector tipo copa', estado: 'Existente' } } });
    await P('05', { proceso: 'Izaje de cargas', zona: 'Obra', actividad: 'Izaje de tubería', tarea: 'Izaje con grúa (contratista)', clasificacion: 'Condiciones de seguridad', subtipo: 'Mecánico', peligro: 'Caída de la carga suspendida', efectos: 'Aplastamiento, muerte', expuestos: 4, ctrlFuente: 'Grúa certificada', ctrlMedio: 'Zona de exclusión', nd: 2, ne: 2, nc: 100, rutinaria: 'No', peorConsecuencia: 'Muerte',
      medidas: { administrativos: { texto: 'Plan de izaje y permiso de izaje', estado: 'Existente' } } });
    await P('06', { proceso: 'Montaje de tubería', zona: 'Obra', actividad: 'Manejo de materiales', tarea: 'Levantamiento manual de tubos y bridas', clasificacion: 'Biomecánico', subtipo: 'Manipulación manual de cargas', peligro: 'Sobreesfuerzo al levantar tubería', efectos: 'Lesiones lumbares', expuestos: 8, nd: 2, ne: 2, nc: 25,
      medidas: { ingenieria: { texto: 'Uso de diferencial o montacargas', estado: 'Existente' }, administrativos: { texto: 'Capacitación en manejo de cargas', estado: 'Existente' } } });
    await P('07', { proceso: 'Administrativo', zona: 'Oficina', actividad: 'Trabajo en computador', tarea: 'Digitación', clasificacion: 'Biomecánico', subtipo: 'Postura', peligro: 'Postura sedente prolongada', efectos: 'Molestias musculoesqueléticas', expuestos: 4, nd: 2, ne: 4, nc: 10, medidas: { administrativos: { texto: 'Pausas activas', estado: 'Existente' } } });
    await P('08', { proceso: 'Transporte', zona: 'Vías', actividad: 'Desplazamiento a obras', tarea: 'Conducción de la camioneta', clasificacion: 'Condiciones de seguridad', subtipo: 'Accidentes de tránsito', peligro: 'Accidente de tránsito', efectos: 'Lesiones múltiples', expuestos: 2, rutinaria: 'Sí', nd: 2, ne: 2, nc: 60, requisitoLegal: 'Ley 1503 de 2011',
      medidas: { administrativos: { texto: 'Inspección preoperacional y PESV', estado: 'Existente' } } });
    const part = [0, 1, 2, 3, 6, 9, 11].map((i) => ({ nombre: nom(personas[i]), cargo: personas[i][3], firma: firmaFalsa(nom(personas[i])) }));
    await gd('revmatriz', 'RVM-DEMO-1', { fecha: isoMas(-200), alcance: 'Revisión anual de la matriz de peligros', responsable: nom(personas[9]), participantes: part, cambios: 'Se agregó el izaje con grúa del contratista y la exposición a ruido del taller.' });
    const S = (id, d) => gd('sustancia', 'SUS-DEMO-' + id, Object.assign({ estado: 'En uso', hojaSeguridad: 'Sí', fdsEspanol: true, fechaHoja: isoMas(-400), venceHoja: isoMas(1425), carcinogena: false, toxicidadAguda: false, etiquetaSGA: 'Conforme al SGA', estadoFisico: 'Líquido', corrosivoTipo: '' }, d));
    await S('1', { nombre: 'Thinner', fabricante: 'Proveedor ficticio', uso: 'Limpieza de piezas', area: 'Taller', ubicacion: 'Bodega de químicos', cantidad: '4 galones', pictogramas: ['Inflamable', 'Irritante / nocivo', 'Peligro grave para la salud'], palabra: 'Peligro', frasesH: 'H225, H304, H336, H373', expuestos: 6, trasvasa: true, envasesRotulados: true, epp: 'Guantes de nitrilo, monogafas, respirador para vapores orgánicos', controles: 'Almacenamiento ventilado, lejos de fuentes de ignición; guantes de nitrilo.' });
    await S('2', { nombre: 'Acetileno', fabricante: 'Proveedor ficticio', uso: 'Oxicorte', area: 'Taller', ubicacion: 'Taller', cantidad: '2 cilindros', estadoFisico: 'Gas', onu: '1001', pictogramas: ['Inflamable', 'Gas a presión'], palabra: 'Peligro', frasesH: 'H220, H230, H280', expuestos: 3, controles: 'Cilindros asegurados y con capuchón.' });
    await S('3', { nombre: 'Oxígeno industrial', fabricante: 'Proveedor ficticio', uso: 'Oxicorte', area: 'Taller', ubicacion: 'Taller', cantidad: '2 cilindros', estadoFisico: 'Gas', onu: '1072', pictogramas: ['Comburente', 'Gas a presión'], palabra: 'Peligro', frasesH: 'H270, H280', expuestos: 3 });
    await S('4', { nombre: 'Desengrasante industrial', fabricante: 'Proveedor ficticio', uso: 'Mantenimiento', area: 'Mantenimiento', ubicacion: 'Bodega de químicos', cantidad: '1 galón', pictogramas: ['Corrosivo'], corrosivoTipo: 'Base', palabra: 'Peligro', frasesH: 'H314', hojaSeguridad: 'No', fechaHoja: '', venceHoja: '', etiquetaSGA: 'Incompleta', expuestos: 2 });
    await S('5', { nombre: 'Ácido muriático', fabricante: 'Proveedor ficticio', uso: 'Limpieza de soldaduras', area: 'Taller', ubicacion: 'Bodega de químicos', cantidad: '2 galones', cas: '7647-01-0', pictogramas: ['Corrosivo', 'Irritante / nocivo'], corrosivoTipo: 'Ácido', palabra: 'Peligro', frasesH: 'H290, H314, H335', expuestos: 2, epp: 'Guantes de neopreno, careta facial, delantal' });
    await S('6', { nombre: 'Aceite hidráulico ISO 68', fabricante: 'Proveedor ficticio', uso: 'Mantenimiento de equipos', area: 'Mantenimiento', ubicacion: 'Bodega de químicos', cantidad: '1 caneca de 55 gal', pictogramas: [], palabra: 'Sin palabra de advertencia', fechaHoja: isoMas(-2000), venceHoja: isoMas(-175), expuestos: 4 });
    // v107: lugares de almacenamiento (los nombres coinciden con la ubicación de las sustancias)
    await gd('lugarquim', 'LUQ-DEMO-1', { nombre: 'Bodega de químicos', area: 'Bodega', tipoLugar: 'Bodega', responsable: nom(personas[9]), capacidad: 200, unidadCapacidad: 'galones', ventilacion: true, contencion: true, kitDerrames: true, extintor: true, lavaojos: false, senalizacion: true, observaciones: 'Falta ducha o lavaojos cerca (hay corrosivos).', fechaRevision: isoMas(-20), activo: true });
    await gd('lugarquim', 'LUQ-DEMO-2', { nombre: 'Taller', area: 'Taller', tipoLugar: 'Jaula de cilindros', responsable: nom(personas[0]), capacidad: 6, unidadCapacidad: 'cilindros', ventilacion: true, contencion: false, kitDerrames: false, extintor: true, lavaojos: false, senalizacion: true, observaciones: 'Cilindros de acetileno y oxígeno separados por muro.', fechaRevision: isoMas(-35), activo: true });
    const accR = 'ACC-' + isoMas(-60).replace(/-/g, '') + '-DEMP02';
    await gd('medicion', 'MED-DEMO-1', { agente: 'Ruido', area: 'Taller · esmerilado', fecha: isoMas(-60), proveedor: 'Laboratorio ficticio de higiene', valor: '91 dB(A)', limite: '85 dB(A) / 8 h', resultado: 'No cumple', proxima: isoMas(305), observaciones: 'Implementar programa de conservación auditiva.' });
    await acc9(accR, { origen: 'Matriz de peligros', origenRef: 'MED-DEMO-1', hallazgo: 'Ruido en el taller: 91 dB(A) (límite 85 dB(A))', accion: 'Programa de conservación auditiva y rotación en esmerilado', responsable: nom(personas[9]), fechaCompromiso: isoMas(30), prioridad: 'Alta', fecha: isoMas(-60) });
    await gd('medicion', 'MED-DEMO-2', { agente: 'Iluminación', area: 'Oficina', fecha: isoMas(-60), proveedor: 'Laboratorio ficticio de higiene', valor: '520 lux', limite: '500 lux', resultado: 'Cumple', proxima: isoMas(670) });
  }, PERSONAS);
  await ir('emergencias.html');
  await p.evaluate(async (personas) => {
    const cap = (i, d) => ({ uid: 'b' + i, nombre: nom(personas[i]), cedula: personas[i][2], cargo: personas[i][3], rol: d, capacitaciones: [{ fecha: isoMas(-120), tema: 'Primeros auxilios y control de incendios', horas: 8, entidad: 'ARL' }] });
    await gd('emergencia', 'EME-DEMO-SEDE', { sede: 'Sede principal', direccion: 'Calle ficticia 12 # 34-56', ocupantes: 30, horario: 'Lunes a viernes 7:00 a 17:00', coordinador: nom(personas[9]), puntoEncuentro: 'Parqueadero frente a la portería',
      rutas: 'Salida principal por la portería; salida alterna por el portón de la bodega.', telefonos: 'Línea de emergencias: 123\nARL: línea de la ARL\nBomberos: 119\nCruz Roja: 132', fechaActualizacion: isoMas(-90), proximaRevision: isoMas(275), divulgacionFecha: isoMas(-80), divulgacionPersonas: 38,
      amenazasLista: [['Sismo', 'Natural', 'a', 'a', 'a', 'v'], ['Incendio', 'Tecnológica', 'a', 'a', 'v', 'v'], ['Derrame de sustancias químicas', 'Tecnológica', 'a', 'v', 'a', 'v'], ['Asalto o hurto', 'Social', 'a', 'v', 'v', 'v'], ['Emergencia médica masiva', 'Social', 'v', 'a', 'v', 'v']]
        .map((x, i) => ({ uid: 'am' + i, amenaza: x[0], origen: x[1], calif: { amenaza: x[2], personas: x[3], recursos: x[4], sistemas: x[5] } })),
      pon: ['Evacuación', 'Incendio', 'Sismo', 'Primeros auxilios', 'Derrame de sustancias químicas', 'Rescate en alturas'],
      brigada: [cap(9, 'Líder de brigada'), cap(11, 'Primeros auxilios'), cap(0, 'Evacuación y rescate'), Object.assign(cap(7, 'Control de incendios'), { capacitaciones: [{ fecha: isoMas(-500), tema: 'Control de incendios', horas: 4, entidad: 'Bomberos' }] })],
      dotacion: { 'Camilla': 'Completo', 'Botiquín': 'Completo', 'Extintores': 'Completo', 'Inmovilizadores': 'Completo', 'Radios': 'Incompleto', 'Megáfono o pito': 'Completo', 'Linternas': 'Completo', 'Chalecos de brigada': 'Completo', 'DEA (desfibrilador)': 'No tiene' },
      amenazas: 5, riesgoAlto: 0, riesgoMedio: 3, brigadistas: 4, brigadistasCapacitados: 3, estado: 'VIGENTE' });
    await gd('simulacro', 'SIM-DEMO-1', { fecha: isoMas(-125), tipoSimulacro: 'Evacuación', sede: 'Sede principal', escenario: 'Sismo con evacuación total', participantes: 32, observadores: nom(personas[11]), horaAlarma: '10:00', horaLlegada: '10:05', tiempoTotal: 5, conteoCompleto: true, calificacion: 'Bueno',
      fortalezas: 'Evacuación ordenada; la brigada dirigió bien el conteo.', hallazgosTexto: 'La alarma no se escucha en el taller', hallazgos: 1, accionesCreadas: 1 });
    await acc9('ACC-' + isoMas(-125).replace(/-/g, '') + '-DEMP03', { origen: 'Simulacro', origenRef: 'SIM-DEMO-1', hallazgo: 'Simulacro: la alarma no se escucha en el taller', accion: 'Instalar una segunda sirena en el taller', responsable: nom(personas[3]), fechaCompromiso: isoMas(-30), fecha: isoMas(-125), estado: 'CERRADA', cierre: { fecha: isoMas(-40), evidencia: 'Sirena instalada y probada.', eficaz: 'Sí', quien: nom(personas[3]), fotos: [] } });
  }, PERSONAS);
  await ir('salud.html');
  await p.evaluate(async (personas) => {
    const cargos = [...new Set(personas.map((x) => x[3]))];
    const pruebas = { 'Soldador': ['Examen médico ocupacional', 'Espirometría', 'Audiometría', 'Visiometría', 'Énfasis para trabajo en alturas'], 'Tubero': ['Examen médico ocupacional', 'Énfasis osteomuscular', 'Énfasis para trabajo en alturas'], 'Operador de grúa': ['Examen médico ocupacional', 'Prueba psicosensométrica', 'Visiometría', 'Audiometría'] };
    for (let i = 0; i < cargos.length; i++) await gd('cargo', 'CAR-DEMO-' + i, { nombre: cargos[i], area: /Coordinadora|Inspectora/.test(cargos[i]) ? 'SST' : 'Operaciones', peligros: /Soldador|Tubero|Armador|Ayudante|Rigger/.test(cargos[i]) ? 'Alturas, humos, ruido, manipulación de cargas' : 'Postura, conducción', examenes: pruebas[cargos[i]] || ['Examen médico ocupacional', 'Énfasis osteomuscular'], periodicidad: 12, enfasis: '' });
    for (let i = 0; i < personas.length; i++) {
      const x = personas[i], f = isoMas(-150 - i * 9);
      await gd('examen', 'EXA-DEMO-' + i, { nombre: nom(x), cedula: x[2], cargo: x[3], tipoExamen: 'Periódico', fecha: f, ips: 'IPS ficticia de salud ocupacional', concepto: i === 2 ? 'Apto con restricciones' : 'Apto', restricciones: i === 2 ? 'No levantar más de 20 kg' : '', tieneRestricciones: i === 2,
        temporalidad: i === 2 ? 'Temporales' : '—', venceRestriccion: i === 2 ? isoMas(60) : '', proxima: Festivos.sumarMeses(f, 12), comunicada: i === 2 ? Festivos.sumarDias(f, 3) : '', seguimiento: i === 2 ? 1 : 0, seguimientos: i === 2 ? [{ uid: 's1', fecha: Festivos.sumarDias(f, 30), texto: 'Se verificó en campo que no levanta cargas pesadas.' }] : [],
        // v107: ingreso a vigilancia epidemiológica según el concepto (solo el programa, sin diagnóstico)
        pveIngresa: i % 3 === 2 ? 'Sí' : 'No', pveLista: i % 3 === 2 ? (/Soldador/.test(x[3]) ? ['Conservación auditiva', 'Osteomuscular'] : ['Osteomuscular']) : [], pve: i % 3 === 2 ? (/Soldador/.test(x[3]) ? ['Conservación auditiva', 'Osteomuscular'] : ['Osteomuscular']) : [] });
    }
    await gd('perfil', 'PER-' + isoMas(0).slice(0, 4), { anio: isoMas(0).slice(0, 4), fecha: isoMas(-140), ips: 'IPS ficticia de salud ocupacional', trabajadores: 41, edadPromedio: 36, hombres: 35, mujeres: 6, fumadores: 12, sedentarismo: 45, sobrepeso: 38, alcohol: 9,
      hallazgos: 'Predominan sobrepeso y sedentarismo; hallazgos osteomusculares leves en personal operativo.', recomendaciones: 'Programa de estilos de vida saludable; pausas activas; vigilancia osteomuscular.', actividades: 3,
      actividadesPyP: [{ uid: 'p1', fecha: isoMas(-110), tipo: 'Estilos de vida saludable', actividad: 'Tamizaje de peso y presión arterial', participantes: 36 }, { uid: 'p2', fecha: isoMas(-70), tipo: 'Pausas activas', actividad: 'Pausas activas guiadas en obra', participantes: 28 }, { uid: 'p3', fecha: isoMas(-30), tipo: 'Campaña', actividad: 'Campaña de hidratación', participantes: 40 }] });
    await gd('sve', 'SVE-DEMO-1', { programa: 'Osteomuscular (desórdenes musculoesqueléticos)', responsable: nom(personas[9]), fechaInicio: isoMas(-300), poblacion: 30, intervenidos: 24, cobertura: 80, objetivo: 'Prevenir desórdenes musculoesqueléticos en el personal operativo.', actividadesTexto: 'Encuesta de síntomas\nEscuela de espalda\nPausas activas', actividades: 3, estado: 'Activo' });
    await gd('sve', 'SVE-DEMO-2', { programa: 'Conservación auditiva', responsable: nom(personas[9]), fechaInicio: isoMas(-50), poblacion: 6, intervenidos: 2, cobertura: 33, objetivo: 'Controlar la exposición a ruido en el taller.', actividadesTexto: 'Audiometrías\nEntrega de protectores tipo copa', actividades: 2, estado: 'Activo' });
    await gd('psico', 'PSI-DEMO-1', { fecha: isoMas(-300), profesional: 'Psicóloga especialista (nombre ficticio)', participantes: 38, totalTrabajadores: 41, cobertura: 93, intralaboralA: 'Riesgo medio', intralaboralB: 'Riesgo medio', extralaboral: 'Riesgo bajo', estres: 'Riesgo medio',
      nivelGeneral: 'Riesgo medio', proxima: Festivos.sumarMeses(isoMas(-300), 24), dominios: 'Demandas del trabajo (jornada) y recompensas.', intervencionesTexto: 'Taller de manejo del estrés', intervenciones: 1, accionesCreadas: 0 });
    const aus = [[1, -50, -49, 'Accidente de trabajo'], [4, -40, -38, 'Enfermedad general'], [10, -22, -22, 'Enfermedad general'], [6, -15, -14, 'Calamidad doméstica'], [3, -8, -6, 'Enfermedad general'], [8, -3, -3, 'Enfermedad general']];
    for (let k = 0; k < aus.length; k++) { const [i, a, b, c] = aus[k], ini = isoMas(a), fin = isoMas(b);
      await gd('ausencia', 'AUS-DEMO-' + k, { nombre: nom(personas[i]), cedula: personas[i][2], cargo: personas[i][3], inicio: ini, fin, dias: b - a + 1, causa: c, mes: ini.slice(0, 7), prorroga: false, observacion: '' }); }
  }, PERSONAS);
  await ir('documental.html');
  await p.evaluate(async (personas) => {
    const pf = isoMas(-270);
    await gd('politica', 'POL-DEMO-1', { versionDoc: '1', texto: textoPolitica(), fechaFirma: pf, firmante: 'Gerente general (nombre ficticio)', firma: firmaFalsa('Gerente general'), comunicadaCopasst: Festivos.sumarDias(pf, 10), proximaRevision: Festivos.sumarMeses(pf, 12), estado: 'VIGENTE',
      objetivosLista: [{ objetivo: 'Disminuir la accidentalidad', indicador: 'Frecuencia de accidentalidad', meta: 'Menor que el año anterior' }, { objetivo: 'Cumplir el plan anual de trabajo', indicador: 'Cumplimiento del plan anual de trabajo', meta: '≥ 90 %' }, { objetivo: 'Cumplir los requisitos legales', indicador: 'Cumplimiento legal', meta: '100 %' }],
      objetivos: 3, divulgacionesLista: [{ uid: 'd1', fecha: Festivos.sumarDias(pf, 15), medio: 'Charla', personas: 37 }, { uid: 'd2', fecha: isoMas(-60), medio: 'Inducción', personas: 4 }], divulgaciones: 2 });
    const evalua = { 'Resolución 4272 de 2021': ['Cumple', 'Programa de protección contra caídas; certificados en Personal habilitado'], 'Resolución 0312 de 2019': ['Cumple parcialmente', 'Autoevaluación 85 %: plan de mejoramiento en curso'], 'Resolución 2764 de 2022': ['Cumple', 'Batería aplicada; próxima en 2 años'],
      'Resolución 0773 de 2021': ['Cumple parcialmente', 'Falta hoja de seguridad del desengrasante'], 'Resolución 40595 de 2022': ['No cumple', 'PESV en elaboración'], 'Ley 2365 de 2024': ['Sin evaluar', ''] };
    for (let i = 0; i < NORMAS_BASE.length; i++) { const n = NORMAS_BASE[i], e = evalua[n[0]] || (i % 9 === 4 ? ['No aplica', 'La empresa no realiza esa actividad'] : ['Cumple', 'Soportes en la carpeta del SG-SST']);
      await gd('legal', 'LEG-BASE-' + String(i + 1).padStart(3, '0'), { norma: n[0], anio: n[1], emisor: n[2], tema: n[3], articulos: n[4], requisito: n[5], cumple: e[0], evidencia: e[1], vigente: 'Sí', responsable: e[0] === 'Sin evaluar' ? '' : nom(personas[9]), fechaRevision: e[0] === 'Sin evaluar' ? '' : isoMas(-100), proximaRevision: e[0] === 'Sin evaluar' ? '' : isoMas(265) }); }
    const F = EMPRESA.formatos; let k = 0;
    for (const id of Object.keys(F)) { const f = F[id]; const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(f.fecha || '');
      await gd('documento', 'DOC-DEMO-' + (k++), { codigo: f.codigo, nombre: f.titulo, tipoDoc: 'Formato', versionDoc: f.version || '1', fechaAprobacion: m ? m[3] + '-' + m[2] + '-' + m[1] : '', aprobo: nom(personas[9]), proximaRevision: k === 3 ? isoMas(-20) : isoMas(200 + k), retencion: 20, ubicacion: 'Portal SSTA', estado: 'Vigente' }); }
    await gd('cambio', 'CAM-DEMO-1', { descripcion: 'Compra de una máquina de corte por plasma para el taller', tipoCambio: 'Equipos o maquinaria', fecha: isoMas(-45), solicitante: nom(personas[0]), fechaImplementacion: isoMas(15), riesgos: 'Radiación UV, humos, riesgo eléctrico, ruido.', actualizarMatriz: true, capacitacion: true,
      accionesTexto: 'Capacitar a los soldadores en el uso del plasma\nActualizar la matriz de peligros del taller', acciones: 2, accionesCreadas: 0, aprobo: 'Gerente general (nombre ficticio)', estado: 'Aprobado' });
    const crit = (n) => { const o = {}; for (let i = 0; i < 12; i++) o[i] = i < n ? 'Sí' : i < 10 ? 'No' : 'N/A'; return o; };
    await gd('proveedor', 'PRV-DEMO-1', { nombre: 'Grúas del Centro S.A.S. (ficticio)', nit: '900.000.001-1', tipoProveedor: 'Contratista', servicio: 'Izaje con grúa', contacto: 'Coordinador HSE', calificacion0312: 88, fechaEvaluacion: isoMas(-90), evaluador: nom(personas[9]), criterios: crit(10), puntaje: 100, resultado: 'Aprobado', proximaEvaluacion: isoMas(275), activo: true });
    await gd('proveedor', 'PRV-DEMO-2', { nombre: 'Andamios Express (ficticio)', nit: '900.000.002-2', tipoProveedor: 'Proveedor de servicios', servicio: 'Alquiler de andamios', contacto: 'Comercial', calificacion0312: 64, fechaEvaluacion: isoMas(-30), evaluador: nom(personas[9]), criterios: crit(7), puntaje: 70, resultado: 'Aprobado con plan de mejora', proximaEvaluacion: isoMas(335), activo: true });
    // v107: proveedores con la matriz de requisitos y el formato de evaluación (proveedores.html). Datos ficticios.
    const mk = (cod, hasta, extra) => { const o = {}; for (let i = 1; i <= hasta; i++) o[cod + '|' + i] = { e: 'Sí' }; return Object.assign(o, extra || {}); };
    const sst = nom(personas[9]), resI = [{ rol: 'Evaluó (criterios comerciales y técnicos)', nombre: 'Compras (nombre ficticio)', cargo: 'Compras' }, { rol: 'Verificó requisitos SST', nombre: sst, cargo: 'Responsable de SST' }, { rol: 'Validó especificaciones (área solicitante)', nombre: nom(personas[0]), cargo: 'Supervisor de obra' }, { rol: 'Aprobó selección (según monto)', nombre: 'Gerente general (nombre ficticio)', cargo: 'Gerencia General' }];
    const PB = [0.15, 0.3, 0.25, 0.15, 0.1, 0.05], PS = [0.3, 0.2, 0.2, 0.15, 0.1, 0.05], PR = [0.25, 0.25, 0.2, 0.15, 0.1, 0.05];
    const ini = (uid, f, cat, pesos, cal, pct, clas, docs, extra) => Object.assign({ uid, tipo: 'Inicial', fecha: f, categoria: cat, ponderacion: pesos === PB ? 'Bienes' : 'Servicios / contratistas', pesos, cal, sobre5: pct / 20, pct, clasificacion: clas, docs, sstVerificada: 'Sí', sinConflicto: 'Sí',
      excluyentes: docs.estado, responsables: resI, descripcion: cat, monto: 3500000, aprobacion: 'Gerencia General', justificacion: '' }, extra || {});
    const base = (o) => Object.assign({ tipoPersona: 'Jurídica', ciudad: 'Bogotá', activo: true, homologado: false, evaluaciones: [] }, o);
    await gd('proveedor', 'PRV-DEMO-3', base({ nombre: 'Ferretería Industrial Ficticia S.A.S.', nit: '900.345.678-9', contacto: 'Asesora comercial (ficticia)', correo: 'ventas@ferreteria-ficticia.invalid', telefono: '6015550101', tipoProveedor: 'Proveedor de bienes', servicio: 'Tornillería, soldadura y herramienta menor',
      categoria: 'S01', categoriaNombre: 'Suministro de Materiales', nivel: 'Básico', critico: false, requisitos: mk('S01', 5), docsPct: 50, excluyentesFaltan: 0, faltan3: 0,
      evaluaciones: [ini('ev3a', isoMas(-300), 'Suministro de Materiales', PB, [4, 5, 4, 4, 4, 4], 86, 'CONFIABLE', { estado: 'CUMPLE', pct: 100, faltan: [] })], fechasEval: [isoMas(-300)],
      fechaEvaluacion: isoMas(-300), puntaje: 86, resultado: 'CONFIABLE', tipoEval: 'Evaluación inicial', proximaEvaluacion: isoMas(65), sstPct: 80 }));
    await gd('proveedor', 'PRV-DEMO-4', base({ nombre: 'Andamios Certificados Ficticios S.A.S.', nit: '901.234.560-6', contacto: 'Coordinador HSE (ficticio)', correo: 'hse@andamios-ficticios.invalid', telefono: '3105550102', tipoProveedor: 'Contratista', servicio: 'Alquiler, montaje y certificación de andamio multidireccional',
      categoria: 'V03', categoriaNombre: 'Alquiler de Andamios', nivel: 'Alto', critico: true, calificacion0312: 91, requisitos: mk('V03', 23), docsPct: 88.5, excluyentesFaltan: 0, faltan3: 0,
      evaluaciones: [ini('ev4a', isoMas(-400), 'Alquiler de Andamios', PS, [4, 4, 4, 5, 4, 4], 83, 'CONFIABLE', { estado: 'CUMPLE', pct: 100, faltan: [] }),
        { uid: 'ev4b', tipo: 'Reevaluación', tipoReev: 'ORDINARIA', desde: isoMas(-400), hasta: isoMas(-215), fecha: isoMas(-210), categoria: 'Alquiler de Andamios', anterior: { clasificacion: 'CONFIABLE', pct: 83 },
          evid: { entregas: 6, aTiempo: 6, conNC: 1, diasCierre: 2, mesesLabor: 6, mesesSS: 6, inspecciones: 8, conHallazgos: 1, incidentes: 0, reqAplicables: 11, reqVencidos: 0, exclVencidos: 0 },
          sug: [4, 2, 5, 'Manual', 5, 5], asig: [5, 4, 4, null, null, 4], just: ['Sin incidentes y hallazgos menores cerrados el mismo día', 'La NC fue de documentación, sin afectar el servicio', 'Una entrega con retraso de una hora', '', '', 'Facturas con un ajuste'],
          cal: [5, 4, 4, 4, 5, 4], pesos: PR, sobre5: 4.35, pct: 87, clasificacion: 'CONFIABLE', accion: 'Continúa en la base de datos. Candidato a homologación: proponer a Gerencia.', extraordinaria: false, plan: [], responsables: [{ rol: 'Consolidó evidencias y calificó (criterios 2 a 5)', nombre: 'Compras (nombre ficticio)', cargo: 'Compras' }, { rol: 'Calificó criterio SST', nombre: sst, cargo: 'Responsable de SST' }] }],
      fechasEval: [isoMas(-400), isoMas(-210)], fechaEvaluacion: isoMas(-210), puntaje: 87, resultado: 'CONFIABLE', tipoEval: 'Reevaluación ordinaria', proximaEvaluacion: isoMas(-27), sstPct: 100 }));
    await gd('proveedor', 'PRV-DEMO-5', base({ nombre: 'Transportes de Carga Ficticios Ltda.', nit: '830.456.789-0', ciudad: 'Funza', contacto: 'Jefe de operaciones (ficticio)', correo: 'operaciones@transportes-ficticios.invalid', telefono: '3205550103', tipoProveedor: 'Proveedor de servicios', servicio: 'Transporte de tubería y herramienta a obra',
      categoria: 'V07', categoriaNombre: 'Transporte de Materiales y Herramientas', nivel: 'Alto', critico: true, calificacion0312: 68, requisitos: mk('V07', 13, { 'V07|11': { e: 'No' }, 'V07|14': { e: 'Sí', v: isoMas(-5) } }), docsPct: 50, excluyentesFaltan: 5, faltan3: 5,
      evaluaciones: [ini('ev5a', isoMas(-120), 'Transporte de Materiales y Herramientas', PS, [3, 4, 3, 4, 3, 4], 68, 'CONDICIONADO', { estado: 'CUMPLE', pct: 100, faltan: [] }, { justificacion: 'Aprobado por Gerencia con condición: entregar el plan de mantenimiento de la flota y el PESV antes de 60 días.' })],
      fechasEval: [isoMas(-120)], fechaEvaluacion: isoMas(-120), puntaje: 68, resultado: 'CONDICIONADO', tipoEval: 'Evaluación inicial', proximaEvaluacion: isoMas(62), sstPct: 60 }));
    await gd('proveedor', 'PRV-DEMO-6', base({ nombre: 'Laboratorio Metrológico Ficticio S.A.S.', nit: '901.987.654-0', contacto: 'Directora técnica (ficticia)', correo: 'lab@metrologia-ficticia.invalid', telefono: '6015550104', tipoProveedor: 'Proveedor de servicios', servicio: 'Calibración de manómetros y multímetros',
      categoria: 'V20', categoriaNombre: 'Calibración y Metrología', nivel: 'Básico', critico: false, requisitos: mk('V20', 5, { 'V20|6': { e: 'No' } }), docsPct: 62.5, excluyentesFaltan: 1, faltan3: 0,
      evaluaciones: [ini('ev6a', isoMas(-20), 'Calibración y Metrología', PS, [4, 4, 4, 4, 4, 4], 80, 'NO APTO (requisito excluyente)', { estado: 'NO CUMPLE', pct: 83.3, faltan: ['Acreditación ONAC (ISO/IEC 17025) del laboratorio de calibración'] }, { excluyentes: 'NO CUMPLE' })],
      fechasEval: [isoMas(-20)], fechaEvaluacion: isoMas(-20), puntaje: 80, resultado: 'NO APTO (requisito excluyente)', tipoEval: 'Evaluación inicial', proximaEvaluacion: '', sstPct: 80 }));
    await gd('proveedor', 'PRV-DEMO-7', base({ nombre: 'Dotaciones y EPP Ficticios S.A.S.', nit: '900.765.432-6', ciudad: 'Medellín', contacto: 'Ejecutivo de cuenta (ficticio)', correo: 'pedidos@dotaciones-ficticias.invalid', telefono: '6045550105', tipoProveedor: 'Proveedor de bienes', servicio: 'Botas, guantes, gafas y overoles',
      categoria: 'S02', categoriaNombre: 'Suministro de Dotación y EPP', nivel: 'Básico', critico: true, requisitos: mk('S02', 2), docsPct: 16.7, excluyentesFaltan: 3, faltan3: 0, fechasEval: [] }));
  }, PERSONAS);
  // v109: un ingreso de proveedor por etapas que quedó «En cotización» (2 de 3 cotizaciones)
  await ir('proveedores.html');
  await p.evaluate(async (personas) => {
    const cat = Proveedores.categorias().find((c) => c.b !== 'Bien') || Proveedores.categorias()[0];
    const cpv = { necesidad: 'Mantenimiento preventivo del compresor de aire', area: 'Mantenimiento', solicitud: 'SC-118', fecha: isoMas(-6), responsable: nom(personas[9]), monto: 6500000,
      categoria: cat.c, categoriaNombre: cat.n, nivel: cat.nivel, critico: cat.critico, tipoProveedor: Proveedores.tipoSegunCategoria(cat.c), marcas: {}, firmasComp: { elaboro: { nombre: nom(personas[9]), cargo: 'Coordinadora SST' }, aprobo: {} },
      cotizaciones: [{ uid: 'q1', nombre: 'Compresores del Norte Ficticios S.A.S.', nit: '900111222-' + Proveedores.dvNit('900111222'), contacto: 'Asesor comercial (ficticio)', valor: 6200000, plazo: 4, formaPago: 'Crédito 30 días', garantia: 6, cumpleSst: 'Sí', excl: {} },
        { uid: 'q2', nombre: 'Servicios Neumáticos Ficticios S.A.S.', nit: '900333444-' + Proveedores.dvNit('900333444'), contacto: 'Jefe de servicio (ficticio)', valor: 5800000, plazo: 7, formaPago: 'Contado', garantia: 3, cumpleSst: 'Sí', excl: {} }] };
    const rs = Proveedores.resumenAlta(cpv);
    await gd('compraprov', 'CPV-DEMO-1', Object.assign({}, cpv, rs, { candidatos: rs.candidatos.join(', '), cerrado: false, anulado: false }));
  }, PERSONAS);
  await ir('revision-direccion.html');
  await p.evaluate(async (personas) => {
    const f = isoMas(-280), anio = f.slice(0, 4);
    await gd('revision', 'REV-DEMO-1', { periodo: anio, fecha: f, gerente: 'Gerente general (nombre ficticio)', asistentes: nom(personas[9]) + ' (responsable del SG-SST), ' + nom(personas[0]) + ' (supervisor)', estado: 'CERRADA',
      entradas: [{ titulo: 'Resumen', datos: [['Accidentes de trabajo', '3'], ['Cumplimiento del plan anual', '88 %'], ['Autoevaluación de estándares mínimos', '79 % · moderadamente aceptable']] }],
      aspectos: ASPECTOS.reduce((o, a, i) => { o[i] = 'Revisado con los indicadores del periodo.'; return o; }, {}), conclusion: 'El SG-SST requiere ajustes', conclusionTexto: 'Se cumplió la mayor parte del plan; faltan las mediciones ambientales y el PESV.',
      decisiones: 'Asignar presupuesto para mediciones de higiene y para el PESV.', accionesTexto: 'Contratar mediciones de ruido e iluminación', acciones: 1, accionesCreadas: 1, comunicadaCopasst: Festivos.sumarDias(f, 7), comunicadaResponsable: f, firma: firmaFalsa('Gerente general') });
    for (const [i, rol] of [[9, 'Responsable del SG-SST'], [0, 'Supervisor de obra']]) await gd('rendicion', 'REN-DEMO-' + i, { nombre: nom(personas[i]), rol, fecha: Festivos.sumarDias(f, -5), periodo: Festivos.sumarDias(f, -5).slice(0, 4), responsabilidades: rol === 'Supervisor de obra' ? 'ATS, permisos e inspecciones en obra.' : 'Diseño y ejecución del SG-SST.',
      resumen: 'Cumplió las actividades a su cargo del plan anual.', pendientes: 'Ninguno crítico.', firma: firmaFalsa(nom(personas[i])) });
  }, PERSONAS);
  console.log('✓ planear y revisar el SG-SST');

  // ── 10. Contratistas, adjuntos (en el "Drive" de la demo) y, al final, usuarios con nombre
  //       (al activar los usuarios, todo lo demás pide sesión: por eso va de último).
  await ir('contratistas.html');
  await p.evaluate(async (personas) => {
    // PDF mínimo de una página (válido, con su tabla xref) para los soportes de ejemplo.
    const pdf = (lineas) => {
      const txt = lineas.map((l, i) => 'BT /F1 ' + (i ? 12 : 16) + ' Tf 60 ' + (740 - i * 24) + ' Td (' + l.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '') + ') Tj ET').join('\n');
      const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        '<< /Length ' + txt.length + ' >>\nstream\n' + txt + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
      let out = '%PDF-1.4\n'; const pos = [];
      objs.forEach((o, i) => { pos.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      const x = out.length;
      out += 'xref\n0 6\n0000000000 65535 f \n' + pos.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF';
      return btoa(out);
    };
    const adj = (id, uid, nombre, ref, lineas) => sg({ action: 'adjuntar', id, uid, nombre, mime: 'application/pdf', base64: pdf(lineas), ref });
    const pila = isoMas(0).slice(0, 8) + '01';
    // a) Personal de los contratistas (en Personal habilitado, con el nombre de su empresa)
    await sg({ action: 'parche', tipo: 'trabajador', id: 'TRB-' + personas[8][2], campos: { empresa: 'Grúas del Centro S.A.S.' } });
    const ext = [['Ricardo', 'Peña Mora', '1088990011', 'Armador de andamios', 300], ['Fabio', 'León Quintero', '1099001122', 'Armador de andamios', 200], ['Nelson', 'Ortiz Prada', '1100112233', 'Ayudante', -15]];
    for (const x of ext) await sg({ action: 'parche', tipo: 'trabajador', id: 'TRB-' + x[2], campos: { nombre: x[0] + ' ' + x[1], cedula: x[2], cargo: x[3], empresa: 'Andamios Express S.A.S.', activo: true,
      requisitos: { seguridad_social: { fecha: pila, vence: Festivos.sumarMeses(pila, 1) }, induccion: { fecha: isoMas(-30), vence: Festivos.sumarMeses(isoMas(-30), 12) }, medico: { fecha: isoMas(-90), vence: Festivos.sumarMeses(isoMas(-90), 12), apto: 'Apto' },
        alturas: { fecha: Festivos.sumarMeses(isoMas(x[4]), -18), vence: isoMas(x[4]) } } } });
    // b) Las dos empresas: una al día y otra con la PILA vencida
    const docs = (pilaVence) => ({ camara: { fecha: isoMas(-40), vence: isoMas(50) }, rut: { fecha: isoMas(-400) }, arl: { fecha: isoMas(-10), vence: isoMas(20) }, pila: { fecha: isoMas(-25), vence: isoMas(pilaVence) },
      autoevaluacion: { fecha: isoMas(-200), vence: isoMas(165) }, responsable: { fecha: isoMas(-700) }, peligros: { fecha: isoMas(-120), vence: isoMas(245) }, procedimientos: { fecha: isoMas(-120), vence: isoMas(245) }, poliza: { fecha: isoMas(-150), vence: isoMas(215) }, emergencias: { noAplica: true } });
    const ctr = async (id, d) => { const e = estadoDocs(d.documentos); await gd('contratista', id, Object.assign(d, { docsFaltan: e.faltan.length, docsVencidos: e.vencidos.length, venceDocs: e.vence, fechaRevision: isoMas(-5), estado: 'ACTIVO' })); };
    await ctr('CTR-DEMO-1', { nombre: 'Grúas del Centro S.A.S.', nit: '900.000.001-1', servicio: 'Izaje con grúa telescópica', arl: 'ARL (ficticia)', contacto: 'Coordinador HSE', telefono: '300 000 0001', responsableSst: 'Tecnóloga SST (nombre ficticio)', documentos: docs(6) });
    await ctr('CTR-DEMO-2', { nombre: 'Andamios Express S.A.S.', nit: '900.000.002-2', servicio: 'Montaje y alquiler de andamios', arl: 'ARL (ficticia)', contacto: 'Residente de obra', telefono: '300 000 0002', responsableSst: 'Técnico SST (nombre ficticio)', documentos: docs(-4) });
    await adj('CTR-DEMO-1', 'adj-demo-c1', 'Camara de comercio Gruas del Centro.pdf', 'camara', ['CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL', 'Gruas del Centro S.A.S. - documento de ejemplo (demo)']);
    await adj('CTR-DEMO-1', 'adj-demo-c2', 'Certificado ARL Gruas del Centro.pdf', 'arl', ['CERTIFICADO DE AFILIACION A LA ARL', 'Documento de ejemplo (demo)']);
    await adj('CTR-DEMO-1', 'adj-demo-c3', 'PILA del mes Gruas del Centro.pdf', 'pila', ['PLANILLA DE SEGURIDAD SOCIAL', 'Documento de ejemplo (demo)']);
    await adj('CTR-DEMO-2', 'adj-demo-c4', 'Camara de comercio Andamios Express.pdf', 'camara', ['CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL', 'Andamios Express S.A.S. - documento de ejemplo (demo)']);
    // c) Ingresos a obra (con la verificación que hace la pantalla)
    const ing = (id, d) => gd('ingreso', id, Object.assign({ induccion: true, epp: true, permisos: true, observaciones: '', firma: firmaFalsa(nom(personas[0])), autorizo: nom(personas[0]), docsFaltan: [], docsVencidos: [] }, d));
    await ing('ING-DEMO-1', { fecha: isoMas(-12), contratistaId: 'CTR-DEMO-1', contratista: 'Grúas del Centro S.A.S.', nit: '900.000.001-1', sitio: 'Cliente Bebidas La Sabana · bodega', trabajo: 'Izaje de tanque de 3 t', tareas: ['Izaje de cargas'],
      personas: 1, autorizadas: 1, noAutorizadas: 0, resultado: 'AUTORIZADO', motivo: '1 persona(s) habilitadas.', lista: [{ nombre: nom(personas[8]), cedula: personas[8][2], estado: 'ok', problemas: [], avisos: [], autorizada: true }] });
    await ing('ING-DEMO-2', { fecha: isoMas(-6), contratistaId: 'CTR-DEMO-2', contratista: 'Andamios Express S.A.S.', nit: '900.000.002-2', sitio: 'Planta propia · fachada norte', trabajo: 'Montaje de andamio tubular de 12 m', tareas: ['Trabajo en alturas'],
      personas: 3, autorizadas: 2, noAutorizadas: 1, resultado: 'AUTORIZADO PARCIAL', motivo: 'Ingresan solo: Ricardo Peña Mora, Fabio León Quintero. No ingresan: Nelson Ortiz Prada.',
      lista: ext.map((x) => ({ nombre: x[0] + ' ' + x[1], cedula: x[2], estado: x[4] < 0 ? 'mal' : 'ok', problemas: x[4] < 0 ? ['Curso de trabajo en alturas vencido'] : [], avisos: [], autorizada: x[4] >= 0 })) });
    await ing('ING-DEMO-3', { fecha: isoMas(-1), contratistaId: 'CTR-DEMO-2', contratista: 'Andamios Express S.A.S.', nit: '900.000.002-2', sitio: 'Cliente Química Andina · tanque 4', trabajo: 'Desmonte de andamio', tareas: ['Trabajo en alturas'],
      personas: 2, autorizadas: 0, noAutorizadas: 2, resultado: 'NO AUTORIZADO', motivo: 'La empresa tiene documentos faltantes o vencidos.', docsVencidos: ['Planilla de pago de seguridad social (PILA) del último mes'],
      lista: ext.slice(0, 2).map((x) => ({ nombre: x[0] + ' ' + x[1], cedula: x[2], estado: 'ok', problemas: [], avisos: [], autorizada: false })) });
    // d) Soportes en otros módulos: certificado de alturas, evidencia de cierre y acta firmada
    await adj('TRB-' + personas[0][2], 'adj-demo-t1', 'Certificado alturas ' + nom(personas[0]) + '.pdf', 'alturas', ['CERTIFICADO DE TRABAJO SEGURO EN ALTURAS', nom(personas[0]) + ' - nivel avanzado (ejemplo demo)']);
    const lista = (await srv('sgsst', { action: 'list', tipo: 'accion,reunion' }, true)).rows;
    const cerrada = lista.find((r) => r.tipo === 'accion' && r.estado === 'CERRADA'), acta = lista.find((r) => r.tipo === 'reunion');
    if (cerrada) await adj(cerrada.id, 'adj-demo-a1', 'Evidencia de cierre.pdf', '', ['EVIDENCIA DE CIERRE DE LA ACCION', 'Registro fotografico y lista de asistencia (ejemplo demo)']);
    if (acta) await adj(acta.id, 'adj-demo-r1', 'Acta firmada escaneada.pdf', '', ['ACTA DE REUNION FIRMADA', 'Copia escaneada (ejemplo demo)']);
  }, PERSONAS);
  console.log('✓ contratistas y adjuntos');
  // f) v95: matriz y entregas de EPP, inducciones, programas de alto riesgo y PESV
  await ir('entrega-epp.html');
  await p.evaluate(async (personas) => {
    const M = { 'Soldador': [['Careta y guantes de soldador', 'ANSI Z87.1 / EN 12477', 6], ['Peto o chaqueta de cuero', 'Soldadura', 12], ['Botas de seguridad con puntera', 'ASTM F2413', 6], ['Respirador media cara', 'NIOSH 42 CFR 84', 12]],
      'Armador': [['Casco de seguridad con barbuquejo', 'ANSI Z89.1', 36], ['Guantes de vaqueta', 'EN 388', 1], ['Arnés de cuerpo completo', 'ANSI Z359.11', 60], ['Botas de seguridad con puntera', 'ASTM F2413', 6]],
      'Ayudante': [['Casco de seguridad con barbuquejo', 'ANSI Z89.1', 36], ['Guantes de vaqueta', 'EN 388', 1], ['Gafas de seguridad', 'ANSI Z87.1', 6], ['Botas de seguridad con puntera', 'ASTM F2413', 6]],
      'Electricista': [['Casco de seguridad con barbuquejo', 'ANSI Z89.1 clase E', 36], ['Guantes dieléctricos', 'ASTM D120', 6], ['Botas dieléctricas', 'ASTM F2413 EH', 6], ['Gafas de seguridad', 'ANSI Z87.1', 6]] };
    let k = 0;
    for (const cargo of Object.keys(M)) await gd('eppcargo', 'EPC-DEMO-' + (k++), { cargo, area: 'Operaciones', peligros: cargo === 'Soldador' ? 'Radiación, humos metálicos, quemaduras' : cargo === 'Electricista' ? 'Eléctrico, arco eléctrico' : 'Mecánico, caídas, golpes',
      elementos: M[cargo].map((e) => ({ elemento: e[0], norma: e[1], vidaUtil: e[2] })), elementosTexto: M[cargo].map((e) => e[0] + ' (' + e[2] + ' m)').join(', '), fechaRevision: isoMas(-60) });
    const ent = async (i, dias, motivo, cargo, solo) => { const f = isoMas(dias), els = M[cargo].filter((e) => !solo || solo.indexOf(e[0]) !== -1).map((e) => ({ elemento: e[0], norma: e[1], cantidad: 1, talla: '', vidaUtil: e[2], vence: Festivos.sumarMeses(f, e[2]) }));
      await gd('entrega', 'ENT-DEMO-' + i + '-' + (-dias), { nombre: nom(personas[i]), cedula: personas[i][2], cargo: personas[i][3], fecha: f, motivo, elementos: els, elementosTexto: els.map((e) => e.elemento).join(', '),
        vencimientos: els.map((e) => e.elemento + '|' + e.vence).join('; '), reponer: els.map((e) => e.vence).sort()[0], capacitado: true, firma: firmaFalsa(nom(personas[i])), entrego: nom(personas[9]) }); };
    await ent(1, -150, 'Ingreso', 'Soldador'); await ent(5, -210, 'Ingreso', 'Soldador'); await ent(3, -90, 'Ingreso', 'Armador'); await ent(3, -20, 'Reposición por desgaste', 'Armador', ['Guantes de vaqueta']);
    await ent(4, -45, 'Ingreso', 'Ayudante'); await ent(10, -100, 'Ingreso', 'Ayudante'); await ent(6, -170, 'Ingreso', 'Electricista');
    // Inducciones (el servidor deja al día el requisito en Personal habilitado)
    const preg = 10;
    for (const [i, dias, tipo, nota] of [[1, -40, 'Reinducción anual', 90], [3, -35, 'Reinducción anual', 100], [4, -30, 'Inducción', 80], [10, -12, 'Inducción', 60], [6, -60, 'Reinducción anual', 90]]) {
      const f = isoMas(dias), ok = nota >= 80;
      await gd('induccion', 'IND-DEMO-' + i, { tipoInduccion: tipo, fecha: f, nombre: nom(personas[i]), cedula: personas[i][2], cargo: personas[i][3], empresa: '', dicto: nom(personas[9]), temas: ['Política y objetivos de SST', 'Peligros y controles del cargo (matriz de peligros)', 'Plan de emergencias, rutas y punto de encuentro', 'Cómo reportar actos, condiciones, incidentes y accidentes', 'Uso, cuidado y reposición del EPP'],
        preguntas: preg, respuestas: [], puntaje: nota, aprueba: 80, resultado: ok ? 'APROBADA' : 'REPROBADA', vence: ok ? Festivos.sumarDias(Festivos.sumarMeses(f, 12), -1) : '', firma: firmaFalsa(nom(personas[i])) });
    }
    await gd('induccion', 'IND-DEMO-VIS', { tipoInduccion: 'Visitante', fecha: isoMas(-3), nombre: 'Auditor del cliente (ficticio)', cedula: '1000000001', empresa: 'Cliente Bebidas La Sabana', dicto: nom(personas[9]), temas: ['Plan de emergencias, rutas y punto de encuentro', 'Uso, cuidado y reposición del EPP'], preguntas: 0, respuestas: [], puntaje: '', resultado: 'REALIZADA', vence: '', firma: firmaFalsa('Auditor') });
    // Programas de alto riesgo
    const prog = async (k, nombre, n, malos, coord) => { const el = {}; for (let i = 0; i < n; i++) el[i] = { estado: malos.indexOf(i) !== -1 ? 'Parcial' : 'Cumple', evidencia: malos.indexOf(i) !== -1 ? 'En implementación' : 'Carpeta del SG-SST' };
      await gd('programa', 'PRG-' + k.toUpperCase(), { programa: k, nombre, coordinador: coord, estado: 'ACTIVO', metas: 'Cero accidentes en la tarea; 100 % del personal con certificación vigente.', elementos: el, evaluados: n, sinEvaluar: 0,
        cumplimiento: Math.round((n - malos.length * 0.5) * 100 / n), fechaRevision: isoMas(-30), proximaRevision: Festivos.sumarMeses(isoMas(-30), 12) }); };
    await prog('alturas', 'Protección contra caídas (trabajo en alturas)', 11, [8], nom(personas[0]));
    await prog('caliente', 'Trabajo en caliente', 8, [], nom(personas[0]));
    await prog('confinados', 'Trabajo en espacios confinados', 9, [4, 6], nom(personas[9]));
    await prog('izajes', 'Izaje de cargas', 8, [0], nom(personas[7]));
    // PESV, vehículos, conductores y un siniestro
    const pasos = {}; for (let i = 0; i < 24; i++) pasos[i] = { estado: [13].indexOf(i) !== -1 ? 'No aplica' : [11, 20, 21].indexOf(i) !== -1 ? 'Parcial' : [22].indexOf(i) !== -1 ? 'No cumple' : 'Cumple', evidencia: '' };
    await gd('pesv', 'PESV-EMPRESA', { vehiculos: 12, conductores: 9, nivel: 'Básico', lider: nom(personas[0]), ultimaAuditoria: isoMas(-300), proximaAuditoria: Festivos.sumarMeses(isoMas(-300), 12), pasos, pasosAplican: 23, pasosCumplen: 19,
      cumplimiento: Math.round((19 + 1.5) * 100 / 23), fechaRevision: isoMas(-20), estado: 'EN IMPLEMENTACIÓN' });
    const veh = [['TRK101', 'Camioneta', 'Toyota', '2021', 60, 200, 40, nom(personas[0])], ['TRK102', 'Camión', 'Chevrolet', '2019', -4, 90, 15, nom(personas[8])], ['MOT201', 'Motocicleta', 'Yamaha', '2022', 150, 300, 25, nom(personas[6])]];
    for (const v of veh) await gd('vehiculo', 'VEH-DEMO-' + v[0], { placa: v[0], tipoVehiculo: v[1], marca: v[2], modelo: v[3], propiedad: 'Propio', conductor: v[7], soat: isoMas(v[4]), rtm: isoMas(v[5]), mantenimiento: isoMas(v[6]), venceDocs: [isoMas(v[4]), isoMas(v[5]), isoMas(v[6])].sort()[0], estado: 'ACTIVO' });
    for (const [i, cat, lic, simit] of [[0, 'B1', 900, -10], [8, 'C2', 25, -40], [6, 'A2', 600, -5]]) await gd('conductor', 'CON-DEMO-' + i, { nombre: nom(personas[i]), cedula: personas[i][2], cargo: personas[i][3], categoria: cat, venceLicencia: isoMas(lic), simit: isoMas(simit), comparendos: 0,
      capacitacionVial: isoMas(-120), pruebaConduccion: isoMas(-200), fechaEvaluacion: isoMas(-200), vence: [isoMas(lic), Festivos.sumarMeses(isoMas(simit), 1), Festivos.sumarMeses(isoMas(-120), 12)].sort()[0], estado: 'ACTIVO' });
    await gd('siniestro', 'SIN-DEMO-1', { fecha: isoMas(-75), hora: '07:40', placa: 'TRK102', conductor: nom(personas[8]), tipoSiniestro: 'Choque', lugar: 'Vía a la planta', lesionados: 0, fallecidos: 0, danos: 'Leves', enMision: 'Sí',
      descripcion: 'Al retroceder en el parqueadero, el camión golpeó un poste. Sin lesionados.', causas: 'Sin señalero; espejos mal ajustados.', investigacion: 'Cerrada', estado: 'CERRADO' });
  }, PERSONAS);
  console.log('✓ EPP, inducciones, programas y PESV');
  // g) v96: ambiental (aspectos, residuos, consumos)
  await ir('ambiental.html');
  await p.evaluate(async () => {
    const asp = [['Taller', 'Mantenimiento de equipos', 'Generación de residuos peligrosos (trapos y filtros con aceite)', 'Contaminación del suelo', 'Normal', 3, 2, 2, 'Aplica y se cumple', 'Decreto 1076 de 2015'],
      ['Taller', 'Almacenamiento de combustibles', 'Derrame de ACPM', 'Contaminación del suelo y el agua', 'Emergencia', 1, 3, 2, 'Aplica y se cumple', 'Decreto 1076 de 2015'],
      ['Obra', 'Soldadura y corte', 'Emisión de humos metálicos', 'Contaminación del aire', 'Normal', 3, 1, 1, 'No aplica', ''],
      ['Oficina', 'Labores administrativas', 'Consumo de energía eléctrica', 'Agotamiento de recursos', 'Normal', 3, 1, 1, 'No aplica', ''],
      ['Obra', 'Montaje', 'Generación de chatarra metálica', 'Aprovechamiento de residuos (positivo)', 'Normal', 2, 1, 1, 'No aplica', '']];
    let i = 0;
    for (const a of asp) { const v = a[5] * a[6] * a[7], pos = /positivo/.test(a[3]);
      await gd('aspecto', 'ASP-DEMO-' + (i++), { proceso: a[0], actividad: a[1], aspecto: a[2], impacto: a[3], condicion: a[4], tipoImpacto: pos ? 'Positivo' : 'Negativo', frecuencia: String(a[5]), severidad: String(a[6]), alcance: String(a[7]), legal: a[8], norma: a[9],
        valor: v, significancia: pos ? 'POSITIVO' : v >= 12 || (a[4] === 'Emergencia' && a[6] === 3) ? 'SIGNIFICATIVO' : 'NO SIGNIFICATIVO', controles: 'Kit antiderrames, bodega con dique, gestor autorizado.', fechaRevision: isoMas(-40) }); }
    for (let k = 1; k <= 6; k++) { const f = isoMas(-30 * k + 5);
      await gd('residuo', 'RES-DEMO-P' + k, { fecha: f, mes: f.slice(0, 7), clase: 'Peligroso (RESPEL)', corriente: 'Trapos, filtros y guantes con hidrocarburos', cantidad: 14 + k * 2, unidad: 'kg', gestor: 'Gestor ambiental autorizado (ficticio)', certificado: k === 1 ? '' : 'CD-' + (900 + k), manifiesto: 'MT-' + (500 + k) });
      await gd('residuo', 'RES-DEMO-A' + k, { fecha: f, mes: f.slice(0, 7), clase: 'Aprovechable (reciclable)', corriente: 'Chatarra y cartón', cantidad: 80 + k * 10, unidad: 'kg', gestor: 'Asociación de recicladores (ficticio)', certificado: 'CA-' + k });
      await gd('residuo', 'RES-DEMO-O' + k, { fecha: f, mes: f.slice(0, 7), clase: 'No aprovechable (ordinario)', corriente: 'Ordinarios', cantidad: 60 + k * 5, unidad: 'kg', gestor: 'Empresa de aseo' }); }
    for (let k = 1; k <= 8; k++) { const m = Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', -k).slice(0, 7);
      await gd('consumo', 'CNS-DEMO-' + k, { mes: m, fecha: m + '-01', sede: 'Planta propia', agua: 30 + (k % 3) * 4 + (k === 2 ? 12 : 0), energia: 1100 + k * 25, combustible: 160 + (k % 4) * 10, papel: 4, trabajadores: 40 }); }
  });
  console.log('✓ ambiental');
  // h) v97: perfil de la empresa y clientes del panel del asesor (uno es la propia demo, conectado)
  await ir('asesor.html');
  await p.evaluate(async (personas) => {
    await gd('empresa', 'EMPRESA-PERFIL', { nombre: EMPRESA.nombre, nit: EMPRESA.nit, actividad: 'Montajes industriales', trabajadores: 41, claseRiesgo: 'IV', grupo0312: 60, fechaActualizacion: isoMas(-10) });
    const cli = [['CLI-DEMO-1', 'Montajes Andinos S.A.S. (esta misma demo)', '900.000.000-0', 'Bogotá', 'Montajes industriales', 41, 'IV', nom(personas[9]), EMPRESA.servidor, 'unico', 'index.html', 10],
      ['CLI-DEMO-2', 'Panadería La Espiga (ficticia)', '900.000.010-1', 'Chía', 'Panadería', 7, 'I', 'Propietaria', '', 'unico', '', -5],
      ['CLI-DEMO-3', 'Transportes El Cóndor (ficticia)', '900.000.020-2', 'Funza', 'Transporte de carga', 28, 'IV', 'Coordinador HSE', '', 'unico', '', 20],
      ['CLI-DEMO-4', 'Clínica Dental Sonrisa (ficticia)', '900.000.030-3', 'Bogotá', 'Odontología', 16, 'III', 'Administradora', '', 'unico', '', 45]];
    for (const c of cli) await gd('cliente', c[0], { nombre: c[1], nit: c[2], ciudad: c[3], actividad: c[4], trabajadores: c[5], claseRiesgo: c[6], grupo0312: grupo0312(c[5], c[6]), contacto: c[7], servidor: c[8], modo: c[9], clave: '', sitio: c[10],
      proximaVisita: isoMas(c[11]), ultimaVisita: isoMas(c[11] - 30), estado: 'ACTIVO', visitas: [{ uid: 'v-' + c[0], fecha: isoMas(c[11] - 30), nota: 'Visita de seguimiento al plan anual (ejemplo).' }], notas: '' });
    // Tareas del asesor en la propia demo (las verá en su plan de acción)
    for (const [i, t, est, dias, cerrada] of [[1, 'Actualizar la matriz legal con las normas de 2026', '2.7.1', 15, false], [2, 'Programar las mediciones de ruido del taller', '4.1.4', -5, false], [3, 'Firmar el plan anual de trabajo', '2.4.1', -20, true]])
      await gd('accion', 'ACC-ASESOR-' + i, { origen: 'Asesor SST', origenRef: 'ASESOR', estandar: est, hallazgo: 'Estándar ' + est + '. Tarea de la asesoría (ejemplo).', accion: t, tipoAccion: 'Preventiva', prioridad: 'Media', responsable: nom(personas[9]),
        fechaCompromiso: isoMas(dias), centro: '', fotos: [], estado: cerrada ? 'CERRADA' : 'ABIERTA', fecha: isoMas(-40), asignadaPor: 'Asesor SST (ficticio)', seguimiento: [],
        cierre: cerrada ? { fecha: isoMas(-22), evidencia: 'Plan firmado por gerencia', eficaz: 'Sí', quien: nom(personas[9]) } : undefined });
  }, PERSONAS);
  console.log('✓ panel del asesor');

  // i) v98: riesgo químico (Res. 773), listas de chequeo propias, inspecciones gerenciales y del COPASST, avisos a clientes
  await ir('inspecciones.html');
  await p.evaluate(async (personas) => {
    await gd('gestquim', 'QUIMICOS-GESTION', { responsable: nom(personas[9]), capacitacionSGA: isoMas(-300), proximaCapacitacion: isoMas(65), capacitados: 18, inventarioRevisado: isoMas(-30), senalizacion: true, fdsDisponibles: true, kitDerrames: true, lavaojos: false, procedimiento: true });
    const items5s = ['Solo están los elementos necesarios para el trabajo (clasificar)', 'Cada cosa tiene su lugar señalado y está en él (ordenar)', 'Pisos, mesas y equipos limpios (limpiar)', 'Hay estándares visibles de orden y aseo (estandarizar)', 'Se hace la rutina diaria de 5 minutos de orden y aseo (disciplina)', 'Canecas de residuos con el código de colores', 'Pasillos y salidas despejados'];
    await gd('plantillainsp', 'PLI-DEMO-5S', { nombre: 'Orden y aseo (5S)', icono: '🧹', frecuencia: 'quincenal', preoperacional: false, reemplaza: '', activa: true, items: items5s, itemsTexto: items5s.join('\n'), vencimientos: [], vencimientosTexto: '' });
    const ext = PLANTILLAS_INSPECCION.find((x) => x.id === 'extintor').items.concat(['Tarjeta de inspección mensual firmada (formato de la empresa)']);
    await gd('plantillainsp', 'PLI-extintor', { nombre: 'Extintor', icono: '🧯', frecuencia: 'mensual', preoperacional: false, reemplaza: 'extintor', activa: true, items: ext, itemsTexto: ext.join('\n'), vencimientos: ['Recarga'], vencimientosTexto: 'Recarga' });
    await srv('sgsst', { action: 'parche', tipo: 'equipo', id: 'EQP-DEMO-QUI01', campos: { categoria: 'quimicos', codigo: 'ALM-QUI', nombre: 'Bodega de químicos', ubicacion: 'Sede', frecuencia: 'mensual', activo: true, vencimientos: {} } });
    const anio = Number(isoMas(0).slice(0, 4)), mesA = Number(isoMas(0).slice(5, 7));
    await gd('proginsp', 'PIN-DEMO-GER', { anio, titulo: 'Planta, taller y bodega', tipoInspeccion: 'Gerencial', plantilla: 'locativa', meses: [3, 6, 9, 12].map((m) => anio + '-' + String(m).padStart(2, '0')), responsable: 'Gerente general (nombre ficticio)', activo: true });
    await gd('proginsp', 'PIN-DEMO-COP', { anio, titulo: 'Recorrido del COPASST por las áreas', tipoInspeccion: 'COPASST', plantilla: 'locativa', meses: Array.from({ length: 12 }, (_, i) => anio + '-' + String(i + 1).padStart(2, '0')), responsable: nom(personas[3]), activo: true });
    const loc = PLANTILLAS_INSPECCION.find((x) => x.id === 'locativa');
    const gi = async (prog, tipo, m, quienes, nc) => { const f = anio + '-' + String(m).padStart(2, '0') + '-14', id = 'INS-' + f.replace(/-/g, '') + '-' + (tipo === 'Gerencial' ? 'GER' : 'COP');
      await gd('inspeccion', id, { categoria: loc.nombre, plantilla: 'locativa', equipoId: '', equipoNombre: prog === 'PIN-DEMO-GER' ? 'Planta, taller y bodega' : 'Recorrido del COPASST por las áreas', fecha: f, lugar: 'Sede',
        items: loc.items.map((t, i) => ({ t, r: i === nc ? 'NC' : 'C', obs: i === nc ? 'Hallazgo de ejemplo' : '', fotos: [] })), observaciones: '', fotos: [], inspector: { nombre: quienes[0].nombre, cedula: '', firma: firmaFalsa(quienes[0].nombre) }, preoperacional: false,
        tipoInspeccion: tipo, participantes: quienes.map((q) => Object.assign({ firma: firmaFalsa(q.nombre) }, q)), progId: prog }); };
    const ger = [{ nombre: 'Gerente general (nombre ficticio)', cargo: 'Gerente' }, { nombre: nom(personas[9]), cargo: personas[9][3] }];
    const cop = [{ nombre: nom(personas[3]), cargo: 'Presidente del COPASST' }, { nombre: nom(personas[6]), cargo: 'Representante de los trabajadores' }];
    for (const m of [3, 6, 9]) if (m < mesA) await gi('PIN-DEMO-GER', 'Gerencial', m, ger, m === 6 ? 7 : -1);
    for (let m = 1; m < mesA; m++) if (m !== mesA - 2) await gi('PIN-DEMO-COP', 'COPASST', m, cop, -1);
    const pf = (await srv('sgsst', { action: 'doc', id: 'EMPRESA-PERFIL' }, true)).doc || {};
    delete pf.id; delete pf.tipo; delete pf.version; delete pf.creado; delete pf.actualizado;
    await gd('empresa', 'EMPRESA-PERFIL', Object.assign(pf, { correoSST: 'sst@montajesandinos.invalid', correoAsesor: 'asesor@consultor.invalid' }));
  }, PERSONAS);
  console.log('✓ riesgo químico, listas propias e inspecciones gerenciales y del COPASST');

  // j) v101-v102: datos del kit documental, documentos aprobados y gestión de la calidad
  await ir('calidad.html');
  await p.evaluate(async (personas) => {
    const pf = (await srv('sgsst', { action: 'doc', id: 'EMPRESA-PERFIL' }, true)).doc || {};
    await srv('sgsst', { action: 'parche', tipo: 'empresa', id: 'EMPRESA-PERFIL', campos: { representante: 'Gerente general (nombre ficticio)', repCedula: '79.000.000', ciudad: 'Bogotá', direccion: 'Calle ficticia 1 # 2-3', arl: 'ARL ficticia', sedes: 'Planta propia y obras en clientes',
      responsableSST: nom(personas[9]), responsableCedula: personas[9][2], responsableLicencia: 'Licencia ficticia 0000 de 2020', responsableCurso: '15/03/2025' } });
    for (const [id, titulo, tipo, cod, v] of [['POLITICA', 'Política de seguridad y salud en el trabajo', 'Política', 'SG-POLITICA', '2'], ['OBJETIVOS', 'Objetivos del SG-SST', 'Otro', 'SG-OBJETIVOS', '1'], ['ROLES', 'Roles y responsabilidades en el SG-SST', 'Otro', 'SG-ROLES', '1'], ['REGLAMENTO', 'Reglamento de higiene y seguridad industrial', 'Otro', 'SG-REGLAMENTO', '1']])
      await gd('documento', 'DOC-KIT-' + id, { codigo: (EMPRESA.formatos[cod] || {}).codigo || cod, tipoDoc: tipo, nombre: titulo, versionDoc: v, fechaAprobacion: isoMas(-60), aprobo: 'Gerente general (nombre ficticio)', proximaRevision: isoMas(305), retencion: 20, ubicacion: 'Kit documental del portal (documentos.html)', estado: 'Vigente' });
    await gd('contextocal', 'CTX-CALIDAD', { alcance: 'Montaje y mantenimiento de tuberías y estructuras metálicas para la industria de alimentos y bebidas.', fortalezas: ['Personal certificado en trabajo en alturas y soldadura', 'Clientes de larga trayectoria'], debilidades: ['Dependencia de un proveedor de tubería', 'Rotación de ayudantes'],
      oportunidades: ['Ampliación de plantas de los clientes', 'Certificación RUC'], amenazas: ['Competencia por precio', 'Variación del precio del acero'],
      partes: [{ parte: 'Clientes', necesidades: 'Trabajos a tiempo, seguros y sin reprocesos', seguimiento: 'Encuesta semestral y PQRS' }, { parte: 'Trabajadores', necesidades: 'Pago puntual, trabajo seguro', seguimiento: 'COPASST y reuniones' }, { parte: 'Proveedores', necesidades: 'Pagos a tiempo, pedidos claros', seguimiento: 'Evaluación anual' }],
      responsable: nom(personas[9]), fechaRevision: isoMas(-40), proximaRevision: isoMas(325) });
    await gd('riesgocal', 'RIC-DEMO-1', { proceso: 'Compras', tipoRO: 'Riesgo', descripcion: 'Retraso del único proveedor de tubería inoxidable', causa: 'Un solo proveedor calificado', probabilidad: '4', impacto: '4', nivel: 'Alto', tratamiento: 'Calificar un segundo proveedor', responsable: nom(personas[0]), fechaIdentificacion: isoMas(-40), fechaCompromiso: isoMas(30), estado: 'EN TRATAMIENTO' });
    await gd('riesgocal', 'RIC-DEMO-2', { proceso: 'Comercial', tipoRO: 'Oportunidad', descripcion: 'Ampliación de la planta de un cliente', causa: 'Proyecto anunciado para el próximo año', probabilidad: '3', impacto: '5', nivel: 'Alto', tratamiento: 'Preparar propuesta técnica', responsable: 'Gerente general (nombre ficticio)', fechaIdentificacion: isoMas(-20), fechaCompromiso: isoMas(60), estado: 'ABIERTO' });
    const med = [93, 96, 91, 97, 98, 95];
    await gd('objcal', 'OBC-DEMO-1', { objetivo: 'Entregar a tiempo los trabajos', indicador: 'Entregas a tiempo', formula: 'trabajos entregados a tiempo / trabajos entregados × 100', meta: 95, sentido: 'mayor', unidad: '%', frecuencia: 'Mensual', responsable: nom(personas[0]), estado: 'VIGENTE',
      mediciones: med.map((v, i) => { const m = Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', i - med.length).slice(0, 7); return { uid: 'OBC-DEMO-1:' + m, periodo: m, valor: v, analisis: v < 95 ? 'Retrasos de transporte' : '', fecha: m + '-05' }; }),
      ultimoValor: med[med.length - 1], ultimoPeriodo: Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', -1).slice(0, 7), cumple: 'Sí' });
    await gd('objcal', 'OBC-DEMO-2', { objetivo: 'Reducir los reprocesos de soldadura', indicador: 'Juntas reprocesadas', formula: 'juntas reprocesadas / juntas inspeccionadas × 100', meta: 2, sentido: 'menor', unidad: '%', frecuencia: 'Mensual', responsable: nom(personas[1]), estado: 'VIGENTE',
      mediciones: [3.1, 2.4].map((v, i) => { const m = Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', i - 2).slice(0, 7); return { uid: 'OBC-DEMO-2:' + m, periodo: m, valor: v, fecha: m + '-05' }; }), ultimoValor: 2.4, ultimoPeriodo: Festivos.sumarMeses(isoMas(0).slice(0, 8) + '01', -1).slice(0, 7), cumple: 'No' });
    await gd('pnc', 'PNC-DEMO-1', { fecha: isoMas(-12), producto: 'Spool de 6" inoxidable', cliente: 'Cliente Bebidas La Sabana', descripcion: 'Porosidad en la soldadura detectada en la prueba con tintas', detectadoEn: 'Inspección final', cantidad: '2 juntas', tratamiento: 'Corrección / reproceso', responsable: nom(personas[1]), costo: 380000, requiereAC: 'No', estado: 'CERRADO', fechaCierre: isoMas(-10) });
    await gd('pqrs', 'PQR-DEMO-1', { fecha: isoMas(-8), cliente: 'Cliente Alimentos del Norte', tipoPQRS: 'Reclamo', canal: 'Correo', descripcion: 'El equipo llegó una hora tarde a la parada de planta', responsable: nom(personas[0]), fechaLimite: Festivos.sumarHabiles(isoMas(-8), 15), respuesta: '', procede: 'Por analizar', estado: 'ABIERTA' });
    await gd('pqrs', 'PQR-DEMO-2', { fecha: isoMas(-30), cliente: 'Cliente Bebidas La Sabana', tipoPQRS: 'Felicitación', canal: 'WhatsApp', descripcion: 'Felicitan al equipo por el orden y aseo en la obra', responsable: nom(personas[9]), fechaLimite: Festivos.sumarHabiles(isoMas(-30), 15), respuesta: 'Se compartió con el equipo en la charla del lunes', fechaRespuesta: isoMas(-28), procede: 'No', estado: 'CERRADA' });
    for (const [i, c, cal, op, at, pr, nps, com] of [[1, 'Cliente Bebidas La Sabana', 5, 4, 5, 4, 9, 'Buen trabajo en seguridad'], [2, 'Cliente Alimentos del Norte', 4, 3, 4, 4, 7, 'Mejorar la puntualidad'], [3, 'Cliente Bebidas La Sabana', 5, 5, 5, 3, 10, '']]) {
      const prom = Math.round((cal + op + at + pr) / 4 * 100) / 100;
      await gd('encuesta', 'ENC-DEMO-' + i, { fecha: isoMas(-90 + i * 25), cliente: c, periodo: 'Semestre', calidad: cal, oportunidad: op, atencion: at, precio: pr, nps, promedio: prom, comentario: com, encuestado: 'Jefe de mantenimiento (ficticio)' });
    }
    // v107: encuestas enviadas por enlace (una ya respondida por el cliente, una esperando respuesta y una vencida)
    const clave = () => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = new Uint8Array(32); crypto.getRandomValues(b); return [...b].map((x) => A[x % 62]).join(''); };
    const preg = [['calidad', 'Calidad del producto o servicio', 'escala'], ['oportunidad', 'Cumplimiento y oportunidad', 'escala'], ['atencion', 'Atención y comunicación', 'escala'], ['precio', 'Relación calidad / precio', 'escala'],
      ['nps', '¿Qué tan probable es que nos recomiende con otra empresa?', 'nps'], ['comentario', '¿Qué podemos mejorar? Cuéntenos lo que quiera.', 'texto']].map(([id, texto, tipo]) => ({ id, texto, tipo, obligatoria: tipo !== 'texto' }));
    const envios = [['ENV-DEMO-1', 'Cliente Bebidas La Sabana', 'Jefe de mantenimiento (ficticio)', isoMas(-12), isoMas(3)], ['ENV-DEMO-2', 'Cliente Alimentos del Norte', 'Coordinadora de compras (ficticia)', isoMas(-4), isoMas(11)], ['ENV-DEMO-3', 'Cliente Lácteos del Valle', 'Jefe de producción (ficticio)', isoMas(-40), isoMas(-25)]];
    const claves = {};
    for (const [id, cliente, contacto, envio, limite] of envios) {
      claves[id] = clave();
      await gd('encuestacli', id, { cliente, contacto, cargo: '', correo: '', telefono: '', periodo: 'Semestre', fechaEnvio: envio, fechaLimite: limite, intro: '', preguntas: preg, nPreguntas: preg.length, estado: 'ABIERTA', clave: claves[id], enviadaPor: nom(personas[9]) });
    }
    await srv('sgsst', { action: 'guardar', tipo: 'encresp', id: 'RSP-ENV-DEMO-1', doc: { e: 'ENV-DEMO-1', k: claves['ENV-DEMO-1'], respuestas: { calidad: 5, oportunidad: 4, atencion: 5, precio: 4, nps: 9, comentario: 'Muy buen manejo de la seguridad en la parada de planta' }, encuestado: 'Jefe de mantenimiento (ficticio)' } });
    // v107: respuestas de trabajadores a la encuesta de percepción de peligros (anónimas)
    const ep = [['Taller de fabricación', 'Soldador', [['Químico', 'Humos metálicos y no metálicos', 'Todos los días', 'En la soldadura de tanques'], ['Físico', 'Ruido', 'Todos los días', 'Esmeril y pulidora'], ['Biomecánico', 'Postura', 'Varias veces por semana', '']], 'Mejorar la extracción de humos en la cabina 2'],
      ['Taller de fabricación', 'Ayudante', [['Biomecánico', 'Manipulación manual de cargas', 'Todos los días', 'Láminas y perfiles'], ['Condiciones de seguridad', 'Locativo', 'De vez en cuando', 'Retales en el piso'], ['Físico', 'Ruido', 'Todos los días', '']], ''],
      ['Bodega', 'Almacenista', [['Químico', 'Gases y vapores', 'Varias veces por semana', 'Al trasvasar thinner'], ['Condiciones de seguridad', 'Locativo', 'Rara vez', 'Rack 3 sin anclar']], 'Poner una ducha lavaojos en la bodega'],
      ['Cuarto de calderas (cliente)', 'Técnico de montaje', [['Físico', 'Temperaturas extremas', 'Todos los días', ''], ['Condiciones de seguridad', 'Trabajo en alturas', 'Varias veces por semana', 'Andamio norte'], ['Psicosocial', 'Jornada de trabajo', 'De vez en cuando', 'Turnos largos en paradas de planta']], '']];
    for (let i = 0; i < ep.length; i++) { const [area, cargo, pel, sug] = ep[i];
      await srv('sgsst', { action: 'guardar', tipo: 'encpeligro', id: 'EPL-DEMO-' + (i + 1), doc: { area, cargo, anonima: true, nombre: '', peligros: pel.map(([clase, tipo, frecuencia, comentario]) => ({ clase, tipo, frecuencia, comentario })), sugerencias: sug } }); }
  }, PERSONAS);
  console.log('✓ kit documental y calidad');

  // e) Usuarios con nombre: el código de administrador sale del "Apps Script" de la demo.
  await p.evaluate(async (personas) => {
    const codigo = await DemoPortal.correr('sgsst__codigoAdministrador');
    const clave = 'Demo2026';
    const adm = await Sesion._post(Object.assign({ action: 'primerAdmin', codigo, usuario: 'sandra.sst', nombre: nom(personas[9]), cargo: personas[9][3], correo: 'sst@montajesandinos.invalid' }, await Sesion.datosClave(clave)));
    if (!adm.ok) throw new Error('primerAdmin: ' + adm.error);
    for (const [u, i, rol, cargo] of [['jorge.obra', 0, 'supervisor', personas[0][3]], ['gerencia', -1, 'consulta', 'Gerente general']]) {
      const r = await Sesion._post(Object.assign({ action: 'guardarUsuario', sesion: adm.sesion, usuario: u, nombre: i >= 0 ? nom(personas[i]) : 'Gerente general (nombre ficticio)', rol, cargo }, await Sesion.datosClave('Temporal1')));
      if (!r.ok) throw new Error('guardarUsuario: ' + r.error);
      const s = await Sesion._sal(u);
      const e = await Sesion._post({ action: 'entrar', usuario: u, prueba: await Sesion.derivar('Temporal1', s.salt, s.iter) });
      const c = await Sesion._post(Object.assign({ action: 'cambiarMiClave', sesion: e.sesion, prueba: await Sesion.derivar('Temporal1', s.salt, s.iter) }, await Sesion.datosClave(clave)));
      if (!c.ok) throw new Error('cambiarMiClave: ' + c.error);
    }
    // Unas acciones con nombre, para que el historial muestre quién hizo qué.
    const yo = adm.sesion, l = (await srv('sgsst', { action: 'list', tipo: 'accion', sesion: yo }, true)).rows.filter((r) => r.estado !== 'CERRADA').slice(0, 2);
    for (const r of l) await srv('sgsst', { action: 'parche', tipo: 'accion', id: r.id, sesion: yo, campos: {}, agregar: { seguimiento: [{ uid: 'seg-' + r.id, fecha: isoMas(0), quien: nom(personas[9]), texto: 'Revisado en la reunión de seguimiento del SG-SST.' }] } });
    try { localStorage.removeItem('ssta-sesion'); } catch (e) {}
  }, PERSONAS);
  console.log('✓ usuarios con nombre (sandra.sst, jorge.obra, gerencia · clave Demo2026)');

  // ── 11. Exportar
  const estado = await p.evaluate(() => DemoPortal.exportar());
  const hoy = await p.evaluate(() => isoMas(0));
  fs.writeFileSync(SALIDA, JSON.stringify({ fechaReferencia: hoy, estado: JSON.parse(estado) }));
  console.log('✓ demo/semilla.json (' + Math.round(fs.statSync(SALIDA).size / 1024) + ' KB, fecha de referencia ' + hoy + ')');
  await navegador.close();
})().catch((e) => { console.error(e); process.exit(1); });
