#!/usr/bin/env node
/* ============================================================
   carga.js — Prueba de carga del servidor SG-SST, sin Google (v167)
   ------------------------------------------------------------
   Corre el servidor de verdad (backends/backend-sgsst.gs) en el simulador
   de Apps Script y lo llena con registros como los de una empresa real,
   hasta 50.000. En cada escalón mide, por operación, lo que el servidor le
   pide a la hoja de cálculo: cuántas llamadas hace, cuántas celdas lee y
   escribe y cuánto pesa la respuesta que viaja al celular.

   Qué SÍ dice: cómo crece el trabajo con el tamaño (si una operación lee
   toda la hoja o solo lo suyo) y cuándo se llega a los topes de Google.
   Qué NO dice: los segundos reales. Eso depende de Google y se mide con
   herramientas/carga-en-google.gs dentro de un Apps Script de prueba.

   Uso:  node herramientas/carga.js                 (1.000 → 50.000 registros)
         node herramientas/carga.js 2000 10000      (escalones a medida)
         node herramientas/carga.js --json salida.json
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const { crearEntorno } = require(path.join(RAIZ, 'pruebas', 'simulador-apps-script.js'));

/* Mezcla de una empresa en operación: mucho preoperacional e inspección, algo de reportes y acciones. */
const MEZCLA = [['preop', 45], ['inspeccion', 20], ['reporte', 12], ['accion', 10], ['induccion', 8], ['examen', 5]];
const AREAS = ['Producción', 'Mantenimiento', 'Bodega', 'Logística', 'Calidad', 'Administración'];
const lorem = 'Se observa condición que requiere corrección según el procedimiento vigente del área. ';
const items = (n) => Array.from({ length: n }, (_, i) => ({ id: 'i' + i, texto: 'Punto de revisión número ' + i, r: i % 9 ? 'C' : 'NC', obs: i % 9 ? '' : 'Ajustar' }));

function docDe(tipo, n, hoy, personas) {
  const p = personas[n % personas.length], area = AREAS[n % AREAS.length];
  if (tipo === 'preop') {
    return { equipo: 'Montacargas ' + (n % 40), placa: 'EQ-' + (n % 40), fecha: hoy, operador: p.nombre, cedula: p.cedula, area, items: items(25), novedad: n % 15 === 0 };
  }
  if (tipo === 'inspeccion') return { categoria: 'Extintores', fecha: hoy, area, inspector: p.nombre, items: items(20) };
  if (tipo === 'reporte') return { clase: 'Condición insegura', fecha: hoy, lugar: area, area, descripcion: lorem.repeat(3), reporta: p.nombre, potencial: 'Medio' };
  if (tipo === 'accion') {
    const estado = n % 3 ? 'ABIERTA' : 'CERRADA';
    return { origen: 'Inspección', hallazgo: lorem, accion: 'Corregir y verificar. ' + lorem, responsable: p.nombre, fechaCompromiso: hoy, estado, area };
  }
  if (tipo === 'induccion') return { nombre: p.nombre, cedula: p.cedula, fecha: hoy, tipoInduccion: 'Inducción', nota: 90, aprobado: true, autorizaDatos: true };
  return { cedula: p.cedula, nombre: p.nombre, fecha: hoy, tipoExamen: 'Periódico', concepto: 'Apto' };
}

/** Cuenta lo que se le pide a las hojas: llamadas, celdas leídas y celdas escritas. */
function contador(E) {
  const c = { llamadas: 0, leidas: 0, escritas: 0 };
  let puesto = false;
  const poner = () => {
    if (puesto) return; const h = Object.values(E.hojas)[0]; if (!h) return;
    const P = Object.getPrototypeOf(h), getRange = P.getRange, appendRow = P.appendRow;
    P.appendRow = function (r) { c.llamadas++; c.escritas += r.length; return appendRow.call(this, r); };
    P.getRange = function (f, col, nf = 1, nc = 1) {
      const r = getRange.call(this, f, col, nf, nc), gv = r.getValues, sv = r.setValues, tf = r.createTextFinder;
      r.getValues = function () { c.llamadas++; c.leidas += nf * nc; return gv.call(r); };
      r.setValues = function (v) { c.llamadas++; c.escritas += v.length * (v[0] ? v[0].length : 0); return sv.call(r, v); };
      // El buscador de Google corre en el servidor de Sheets: es UNA llamada, pero recorre la columna.
      r.createTextFinder = function (t) {
        const x = tf.call(r, t), fa = x.findAll;
        x.findAll = function () { c.llamadas++; c.buscadas = (c.buscadas || 0) + nf; return fa.call(x); };
        return x;
      };
      return r;
    };
    puesto = true;
  };
  return { c, poner, cero() { c.llamadas = 0; c.leidas = 0; c.escritas = 0; c.buscadas = 0; } };
}

function medir(nombre, K, fn) {
  K.cero(); const t0 = process.hrtime.bigint();
  let r; try { r = fn(); } catch (e) { r = { ok: false, error: String(e.message) }; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, kb = Math.round(Buffer.byteLength(JSON.stringify(r) || '') / 102.4) / 10;
  const c = K.c;
  return { op: nombre, ok: !!(r && r.ok !== false), llamadas: c.llamadas, leidas: c.leidas, buscadas: c.buscadas || 0, escritas: c.escritas, kb, ms: Math.round(ms),
    error: r && r.ok === false ? r.error : '' };
}

function correr(escalones, opciones) {
  const o = opciones || {}, log = o.silencio ? () => {} : (x) => process.stdout.write(x);
  const T = /API_TOKEN: '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'config.js'), 'utf8'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends', 'backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (b) => E.post(Object.assign({ token: T }, b)), G = (q) => E.get(Object.assign({ token: T }, q));
  const hoy = E.ctx.hoyISO_(), K = contador(E);
  const nPersonas = o.personas || 500;
  const personas = Array.from({ length: nPersonas }, (_, i) => ({ nombre: 'Persona ' + i + ' Apellido Prueba', cedula: String(1000000000 + i * 7) }));
  let n = 0, fallos = 0; const porTipo = {};
  const guardar = (tipo, id, doc) => {
    const r = P({ action: 'guardar', tipo, id, doc, opId: 'op-' + id });
    if (!r.ok) { fallos++; if (fallos < 4) log('\n  ! ' + tipo + ': ' + r.error); }
    n++; porTipo[tipo] = (porTipo[tipo] || 0) + 1; return r;
  };
  personas.forEach((p, i) => {
    guardar('trabajador', 'TRA-' + i, { nombre: p.nombre, cedula: p.cedula, cargo: 'Operario', area: AREAS[i % AREAS.length], empresa: 'Empresa de prueba', estado: 'HABILITADO' });
  });
  K.poner();
  const ciclo = []; MEZCLA.forEach(([t, peso]) => { for (let i = 0; i < peso; i++) ciclo.push(t); });
  const resultados = [];
  for (const meta of escalones) {
    log('Llenando hasta ' + meta + ' registros…');
    const t0 = Date.now();
    while (n < meta) { const tipo = ciclo[(n * 37) % ciclo.length]; guardar(tipo, tipo.slice(0, 3).toUpperCase() + '-' + n, docDe(tipo, n, hoy, personas)); }
    log(' ' + Math.round((Date.now() - t0) / 1000) + ' s\n');
    const idAcc = 'ACC-CARGA-' + meta, u = n;
    // El sello de una lectura completa hecha «hace una hora» (lo guardado hasta ahora se envejece para que no cuente como cambio).
    const sello = (tipo) => {
      const c = G({ action: 'list', tipo });
      E.hojas.Registros.filas.slice(1).forEach((f) => { if (f[10] instanceof Date && f[1] === tipo && !f._viejo) { f[10] = new Date(f[10].getTime() - 3600000); f._viejo = true; } });
      return { cambios: c.hasta, gen: c.gen, vista: c.vista };
    };
    const sA = sello('accion'), sP = sello('preop');
    const ops = [
      medir('Guardar un reporte nuevo', K, () => P({ action: 'guardar', tipo: 'reporte', id: 'REP-CARGA-' + meta, doc: docDe('reporte', u, hoy, personas), opId: 'opc-r' + meta })),
      medir('Guardar un preoperacional', K, () => P({ action: 'guardar', tipo: 'preop', id: 'PRE-CARGA-' + meta, doc: docDe('preop', u, hoy, personas), opId: 'opc-p' + meta })),
      medir('Crear una acción', K, () => P({ action: 'guardar', tipo: 'accion', id: idAcc, doc: docDe('accion', 1, hoy, personas), opId: 'opc-a' + meta })),
      medir('Cambiar esa acción', K, () => { const d = G({ action: 'doc', id: idAcc });
        return P({ action: 'guardar', tipo: 'accion', id: idAcc, doc: Object.assign({}, d.doc, { estado: 'CERRADA' }), versionBase: d.version, opId: 'opc-a2' + meta }); }),
      medir('Abrir un registro', K, () => G({ action: 'doc', id: idAcc })),
      medir('Personal habilitado (lo piden los permisos)', K, () => G({ action: 'list', tipo: 'trabajador' })),
      medir('Lista del plan de acción', K, () => G({ action: 'list', tipo: 'accion' })),
      medir('Lista de preoperacionales', K, () => G({ action: 'list', tipo: 'preop' })),
      // v168: el celular ya tiene su copia y pide solo lo que cambió desde su última lectura.
      medir('Plan de acción, solo cambios (v168)', K, () => G(Object.assign({ action: 'list', tipo: 'accion' }, sA))),
      medir('Preoperacionales, solo cambios (v168)', K, () => G(Object.assign({ action: 'list', tipo: 'preop' }, sP))),
      medir('Pendientes («Lo mío hoy»)', K, () => G({ action: 'pendientes' })),
      medir('Búsqueda global', K, () => G({ action: 'buscar', q: 'Montacargas 7' })),
      medir('Ficha 360 de una persona', K, () => G({ action: 'vinculos', cedula: personas[3].cedula })),
      medir('Ping (¿está vivo?)', K, () => G({ action: 'ping' }))
    ];
    n += 3; // los tres de la medición
    const filas = {}, celdas = {}; let total = 0;
    Object.keys(E.hojas).forEach((h) => {
      const f = E.hojas[h].filas; filas[h] = f.length;
      celdas[h] = f.length * Math.max(1, ...f.slice(0, 50).map((x) => x.length)); total += celdas[h];
    });
    resultados.push({ registros: n, ops, filas, celdas: total, celdasPorRegistro: Math.round(total / n * 10) / 10 });
  }
  return { resultados, porTipo, fallos, personas: nPersonas };
}

function tabla(r) {
  const o = [], pad = (s, w) => String(s).padStart(w), mil = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  r.resultados.forEach((e) => {
    o.push('', '■ ' + mil(e.registros) + ' registros · ' + mil(e.celdas) + ' celdas en el libro (' + e.celdasPorRegistro + ' por registro)',
      '  ' + 'Operación'.padEnd(46) + pad('llamadas', 9) + pad('celdas leídas', 15) + pad('escritas', 10) + pad('respuesta', 11));
    e.ops.forEach((x) => {
      o.push('  ' + (x.ok ? '' : '✗ ') + x.op.padEnd(x.ok ? 46 : 44) + pad(x.llamadas, 9) + pad(mil(x.leidas + x.buscadas), 15) + pad(mil(x.escritas), 10) +
        pad(x.kb + ' KB', 11) + (x.ok ? '' : '  ' + x.error));
    });
  });
  return o.join('\n');
}

if (require.main === module) {
  const a = process.argv.slice(2), ij = a.indexOf('--json'), nums = a.filter((x) => /^\d+$/.test(x)).map(Number).sort((x, y) => x - y);
  const r = correr(nums.length ? nums : [1000, 5000, 10000, 25000, 50000]);
  console.log(tabla(r));
  if (r.fallos) console.log('\n! ' + r.fallos + ' guardados fueron rechazados durante el llenado.');
  if (ij !== -1 && a[ij + 1]) { fs.writeFileSync(a[ij + 1], JSON.stringify(r, null, 1)); console.log('\nDetalle en ' + a[ij + 1]); }
}
module.exports = { correr, tabla };
