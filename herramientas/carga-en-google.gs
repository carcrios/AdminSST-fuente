/* ============================================================
   carga-en-google.gs — Prueba de carga DENTRO de Google (tiempos reales)
   ------------------------------------------------------------
   herramientas/carga.js dice cuánto trabajo hace cada operación; esto dice
   cuántos SEGUNDOS tarda en Google, que es lo que siente la gente.

   SOLO EN UN PROYECTO DE PRUEBA. Nunca en el servidor de una empresa.
     1. script.google.com → Nuevo proyecto → «Carga Portal SSTA».
     2. Pega backends/backend-sgsst.gs en un archivo y ESTE en otro.
        (El servidor suelto crea su propio libro nuevo: no toca nada tuyo.)
     3. ▶ cargaSembrar. Llena hasta CARGA_META registros. Google corta a los
        6 minutos: si el registro dice «ejecuta otra vez», vuelve a darle ▶.
     4. ▶ cargaMedir. El registro de ejecución muestra la tabla de tiempos.
     5. Sube CARGA_META (10000 → 25000 → 50000) y repite 3 y 4.
     6. Al terminar, borra el proyecto y el libro «Gestión SG-SST».

   Los tiempos son del servidor por dentro. Al celular hay que sumarle el
   arranque de la aplicación web de Google y el viaje de la respuesta por la
   red: para eso está herramientas/carga-concurrente.js.
   ============================================================ */
const CARGA_META = 10000;     // registros a los que se quiere llegar
const CARGA_PERSONAS = 500;   // de ellos, cuántos son personal habilitado
const CARGA_MEZCLA = [['preop', 45], ['inspeccion', 20], ['reporte', 12], ['accion', 10], ['induccion', 8], ['examen', 5]];

function cargaToken_() { return claveConfigurada_() || API_TOKEN; }
function cargaPost_(o) { return JSON.parse(doPost({ postData: { contents: JSON.stringify(Object.assign({ token: cargaToken_() }, o)) } }).getContent()); }
function cargaGet_(q) { return doGet({ parameter: Object.assign({ token: cargaToken_() }, q) }).getContent(); }
function cargaItems_(n) {
  const o = [];
  for (let i = 0; i < n; i++) o.push({ id: 'i' + i, texto: 'Punto de revisión número ' + i, r: i % 9 ? 'C' : 'NC', obs: i % 9 ? '' : 'Ajustar' });
  return o;
}
function cargaDoc_(tipo, hoy) {
  const t = 'Se observa condición que requiere corrección según el procedimiento vigente del área. ';
  const per = { nombre: 'Persona Modelo Apellido Prueba', cedula: '1000000007' };
  if (tipo === 'trabajador') return { nombre: per.nombre, cedula: per.cedula, cargo: 'Operario', area: 'Producción', empresa: 'Empresa de prueba', estado: 'HABILITADO' };
  if (tipo === 'preop') return { equipo: 'Montacargas 7', placa: 'EQ-7', fecha: hoy, operador: per.nombre, cedula: per.cedula, area: 'Bodega', items: cargaItems_(25) };
  if (tipo === 'inspeccion') return { categoria: 'Extintores', fecha: hoy, area: 'Bodega', inspector: per.nombre, items: cargaItems_(20) };
  if (tipo === 'reporte') return { clase: 'Condición insegura', fecha: hoy, lugar: 'Bodega', area: 'Bodega', descripcion: t + t + t, reporta: per.nombre, potencial: 'Medio' };
  if (tipo === 'accion') return { origen: 'Inspección', hallazgo: t, accion: 'Corregir y verificar. ' + t, responsable: per.nombre, fechaCompromiso: hoy, estado: 'ABIERTA', area: 'Bodega' };
  if (tipo === 'induccion') return { nombre: per.nombre, cedula: per.cedula, fecha: hoy, tipoInduccion: 'Inducción', nota: 90, aprobado: true, autorizaDatos: true };
  return { cedula: per.cedula, nombre: per.nombre, fecha: hoy, tipoExamen: 'Periódico', concepto: 'Apto' };
}
/** Filas de una hoja cuyo valor en `col` es `id` (tal como quedaron al guardar de verdad). */
function cargaFilas_(sheet, col, id, ncols) {
  return filasPorValor_(sheet, col, id).map(function (f) { return sheet.getRange(f, 1, 1, ncols).getValues()[0]; });
}

/** ▶ Llena el libro de PRUEBA hasta `meta` registros (por defecto CARGA_META). Se puede ejecutar varias veces. */
function cargaSembrar(meta) {
  meta = Number(meta) || CARGA_META;
  const t0 = Date.now(), props = PropertiesService.getScriptProperties(), hoy = hoyISO_();
  HOJAS_CACHE_ = {};
  if (regSheet_().getLastRow() > 1 && props.getProperty('CARGA_PRUEBA') !== 'si') {
    throw new Error('Este libro ya tiene registros que no son de la prueba de carga. Usa un proyecto NUEVO: nunca el servidor de una empresa.');
  }
  props.setProperty('CARGA_PRUEBA', 'si');
  // 1. Un registro modelo de cada tipo, guardado por el camino real (así las filas tienen la forma exacta de esta versión).
  const tipos = ['trabajador'].concat(CARGA_MEZCLA.map(function (m) { return m[0]; })), modelo = {};
  tipos.forEach(function (tipo) {
    const id = 'MOD-' + tipo;
    if (filaDe_(id) === -1) {
      const r = cargaPost_({ action: 'guardar', tipo: tipo, id: id, doc: cargaDoc_(tipo, hoy), opId: 'op-' + id });
      if (!r.ok) throw new Error('No se pudo guardar el modelo de ' + tipo + ': ' + r.error);
    }
    HOJAS_CACHE_ = {};
    const ev = cargaFilas_(eventosSheet_(), 2, id, eventosSheet_().getLastColumn());
    modelo[tipo] = { reg: cargaFilas_(regSheet_(), 1, id, COLS_REG.length)[0], datos: cargaFilas_(datosSheet_(), 1, id, 4), ev: ev[ev.length - 1] };
  });
  // 2. Copias de los modelos, escritas de a 2.000 registros por llamada.
  const ciclo = []; CARGA_MEZCLA.forEach(function (m) { for (let i = 0; i < m[1]; i++) ciclo.push(m[0]); });
  let n = Number(props.getProperty('CARGA_N') || 0), cortado = false;
  const agregar = function (sheet, filas) { if (filas.length) sheet.getRange(sheet.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas); };
  while (regSheet_().getLastRow() - 1 < meta) {
    if (Date.now() - t0 > 270000) { cortado = true; break; }   // Google corta a los 6 minutos: se para antes
    const hay = regSheet_().getLastRow() - 1, lote = Math.min(2000, meta - hay), R = [], D = [], E = [];
    for (let k = 0; k < lote; k++) {
      const tipo = n < CARGA_PERSONAS ? 'trabajador' : ciclo[(n * 37) % ciclo.length], m = modelo[tipo], id = tipo.slice(0, 3).toUpperCase() + '-C' + n;
      const r = m.reg.slice(); r[0] = id; R.push(r);
      m.datos.forEach(function (d) { const x = d.slice(); x[0] = id; D.push(x); });
      const e = m.ev.slice(); e[1] = id; e[5] = 'opc-' + id; E.push(e);
      n++;
    }
    agregar(regSheet_(), R); agregar(datosSheet_(), D); agregar(eventosSheet_(), E);
    props.setProperty('CARGA_N', String(n));
    SpreadsheetApp.flush();
  }
  const total = regSheet_().getLastRow() - 1;
  const msg = cortado ? 'Van ' + total + ' de ' + meta + ' registros. Ejecuta ▶ cargaSembrar otra vez para seguir.'
    : 'Listo: ' + total + ' registros en ' + Math.round((Date.now() - t0) / 1000) + ' s. Ahora ▶ cargaMedir. Libro: ' + libro_().getUrl();
  console.log(msg);
  return msg;
}

/** ▶ Mide cada operación 3 veces y muestra la mediana, en segundos. */
function cargaMedir() {
  if (PropertiesService.getScriptProperties().getProperty('CARGA_PRUEBA') !== 'si') throw new Error('Primero ▶ cargaSembrar (en un proyecto de prueba).');
  HOJAS_CACHE_ = {};
  const hoy = hoyISO_(), total = regSheet_().getLastRow() - 1, sello = String(Date.now());
  let vez = 0;
  const idAcc = 'ACC-MED-' + sello;
  cargaPost_({ action: 'guardar', tipo: 'accion', id: idAcc, doc: cargaDoc_('accion', hoy), opId: 'opm-' + idAcc });
  const nuevo = function (tipo) {
    vez++; const id = tipo.slice(0, 3).toUpperCase() + '-MED-' + sello + '-' + vez;
    return JSON.stringify(cargaPost_({ action: 'guardar', tipo: tipo, id: id, doc: cargaDoc_(tipo, hoy), opId: 'opm-' + id }));
  };
  const OPS = [
    ['Guardar un reporte nuevo', function () { return nuevo('reporte'); }],
    ['Guardar un preoperacional', function () { return nuevo('preop'); }],
    ['Abrir un registro', function () { return cargaGet_({ action: 'doc', id: idAcc }); }],
    ['Personal habilitado (lo piden los permisos)', function () { return cargaGet_({ action: 'list', tipo: 'trabajador' }); }],
    ['Lista del plan de acción', function () { return cargaGet_({ action: 'list', tipo: 'accion' }); }],
    ['Lista de preoperacionales', function () { return cargaGet_({ action: 'list', tipo: 'preop' }); }],
    ['Pendientes («Lo mío hoy»)', function () { return cargaGet_({ action: 'pendientes' }); }],
    ['Búsqueda global', function () { return cargaGet_({ action: 'buscar', q: 'Montacargas' }); }],
    ['Ficha 360 de una persona', function () { return cargaGet_({ action: 'vinculos', cedula: '1000000007' }); }]
  ];
  const filas = [['Operación', 'segundos (mediana de 3)', 'peor de 3', 'respuesta KB']], T0 = Date.now();
  OPS.forEach(function (op) {
    const ms = []; let kb = 0, error = '';
    for (let i = 0; i < 3 && Date.now() - T0 < 300000; i++) {
      const a = Date.now(); let txt = '';
      try { txt = String(op[1]() || ''); } catch (e) { error = String(e.message || e).slice(0, 80); }
      ms.push(Date.now() - a); kb = Math.round(txt.length / 1024);
    }
    ms.sort(function (x, y) { return x - y; });
    const seg = function (x) { return x === undefined ? 'sin tiempo' : (Math.round(x / 100) / 10).toFixed(1); };
    filas.push([op[0], seg(ms[Math.floor(ms.length / 2)]), seg(ms[ms.length - 1]), error ? 'ERROR: ' + error : String(kb)]);
  });
  const txt = 'PRUEBA DE CARGA · ' + total + ' registros · ' + VERSION_SGSST + '\n' + filas.map(function (f) { return f.join(' | '); }).join('\n');
  console.log(txt);
  return txt;
}
