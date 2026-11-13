#!/usr/bin/env node
/* ============================================================
   carga-concurrente.js — ¿Qué pasa si 20 personas guardan a la vez?
   ------------------------------------------------------------
   El servidor atiende los guardados de a uno (un solo candado) y espera
   hasta 20 segundos por turno; al que no le alcanza le responde «ocupado»
   y el celular reintenta solo. Esto lo prueba de verdad, por internet,
   contra un servidor de PRUEBA: manda N reportes al mismo tiempo y dice
   cuántos entraron, cuántos quedaron para reintento y cuánto esperó cada uno.
   También mide de punta a punta (con el arranque de Google y la red) las
   lecturas que más se usan.

   ESCRIBE REGISTROS: úsalo solo contra el proyecto de carga (ver
   herramientas/carga-en-google.gs, implementado como aplicación web).
   Por eso exige la opción --es-servidor-de-prueba.

   Uso:  node herramientas/carga-concurrente.js <URL /exec> <clave del portal> [cuántos=20] --es-servidor-de-prueba
   ============================================================ */
'use strict';
const pct = (l, p) => { const o = l.slice().sort((a, b) => a - b); return o.length ? o[Math.min(o.length - 1, Math.floor(o.length * p))] : 0; };
const seg = (ms) => (Math.round(ms / 100) / 10).toFixed(1) + ' s';

async function unGuardado(url, token, i, sello) {
  const t0 = Date.now(), id = 'REP-CONC-' + sello + '-' + i;
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const doc = { clase: 'Condición insegura', fecha: hoy, lugar: 'Prueba de carga', descripcion: 'Guardado simultáneo ' + i, reporta: 'Prueba' };
  try {
    const body = JSON.stringify({ token, action: 'guardar', tipo: 'reporte', id, doc, opId: 'opc-' + id });
    const r = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    const estado = j && j.ok ? 'ok' : j && j.codigoError === 'TEMPORAL' ? 'ocupado' : j && j.codigoError === 'CLAVE' ? 'clave' : 'error';
    return { estado, ms: Date.now() - t0, detalle: j ? (j.error || '') : txt.slice(0, 80) };
  } catch (e) { return { estado: 'error', ms: Date.now() - t0, detalle: String(e.message) }; }
}
async function unaLectura(url, token, q) {
  const t0 = Date.now(), u = url + (url.includes('?') ? '&' : '?') + new URLSearchParams(Object.assign({ token }, q));
  try { const txt = await (await fetch(u, { redirect: 'follow' })).text(); return { ms: Date.now() - t0, kb: Math.round(txt.length / 1024), ok: /^\s*\{/.test(txt) }; }
  catch (e) { return { ms: Date.now() - t0, kb: 0, ok: false }; }
}

/** Devuelve el resumen (texto) y los números. */
async function probar(url, token, cuantos) {
  const sello = Date.now().toString(36), o = [];
  const uno = await unGuardado(url, token, 0, sello);
  if (uno.estado === 'clave') throw new Error('La clave del portal no es la de ese servidor.');
  if (uno.estado === 'error') throw new Error('El servidor no aceptó un guardado sencillo: ' + uno.detalle);
  o.push('Un guardado solo: ' + seg(uno.ms));
  const res = await Promise.all(Array.from({ length: cuantos }, (_, i) => unGuardado(url, token, i + 1, sello)));
  const de = (e) => res.filter((r) => r.estado === e), bien = de('ok'), ocup = de('ocupado'), mal = de('error');
  o.push(cuantos + ' guardados a la vez: ' + bien.length + ' entraron, ' + ocup.length + ' quedaron «ocupado» (el celular reintenta solo), ' + mal.length + ' con error.');
  if (bien.length) o.push('  Espera de los que entraron: la mitad en ' + seg(pct(bien.map((r) => r.ms), 0.5)) + ' o menos; el más lento, ' + seg(Math.max(...bien.map((r) => r.ms))) + '.');
  if (mal.length) o.push('  Primer error: ' + mal[0].detalle);
  const lecturas = [['Personal habilitado', { action: 'list', tipo: 'trabajador' }], ['Plan de acción', { action: 'list', tipo: 'accion' }],
    ['Pendientes', { action: 'pendientes' }], ['Ping', { action: 'ping' }]];
  o.push('Lecturas, de punta a punta:');
  const lec = [];
  for (const [nombre, q] of lecturas) {
    const r = await unaLectura(url, token, q); lec.push(Object.assign({ nombre }, r));
    o.push('  ' + nombre.padEnd(22) + seg(r.ms).padStart(8) + String(r.kb).padStart(8) + ' KB' + (r.ok ? '' : '  (no respondió JSON)'));
  }
  return { texto: o.join('\n'), solo: uno, simultaneos: res, lecturas: lec };
}

if (require.main === module) {
  const a = process.argv.slice(2), pos = a.filter((x) => !x.startsWith('--'));
  if (pos.length < 2 || !a.includes('--es-servidor-de-prueba')) {
    console.log('Uso: node herramientas/carga-concurrente.js <URL /exec> <clave del portal> [cuántos=20] --es-servidor-de-prueba\n' +
      'Escribe registros de prueba en ese servidor: NUNCA lo corras contra el de una empresa.');
    process.exit(2);
  }
  probar(pos[0], pos[1], Math.min(60, Math.max(2, Number(pos[2]) || 20))).then((r) => console.log(r.texto), (e) => { console.error('✗ ' + e.message); process.exit(1); });
}
module.exports = { probar, pct };
