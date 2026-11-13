/* ============================================================
   unitarias.js — Pruebas de LÓGICA (v162)
   ------------------------------------------------------------
   A diferencia de las comprobaciones que leen el código, estas
   EJECUTAN las funciones del portal con datos conocidos y revisan
   el resultado exacto: festivos de Colombia, plazos legales en días
   hábiles, indicadores de la Res. 0312 (art. 30), el porcentaje de
   estándares, la habilitación del personal y el servidor (quién ve
   datos de salud, idempotencia, bitácora encadenada).

   Se corren solas (node pruebas/unitarias.js) o dentro de pruebas.js.
   ============================================================ */
const vm = require('vm'), fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

/** Carga los módulos del navegador en un entorno mínimo (sin DOM real). */
function entornoCliente(ahora) {
  const store = {};
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {}, children: [], setAttribute() {}, getAttribute: () => null, hasAttribute: () => false,
    appendChild() {}, insertAdjacentElement() {}, insertAdjacentHTML() {}, addEventListener() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', innerHTML: '' });
  const ctx = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, Math, JSON, URL, URLSearchParams, Promise, TextEncoder, atob, btoa,
    Date: ahora ? class extends Date { constructor(...a) { a.length ? super(...a) : super(ahora); } static now() { return new Date(ahora).getTime(); } } : Date,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, navigator: { onLine: true, userAgent: 'node' },
    location: { href: 'http://x/index.html', pathname: '/index.html', search: '', hash: '', origin: 'http://x' }, history: { state: null, replaceState() {}, pushState() {}, back() {} },
    screen: { width: 390, height: 844 }, innerWidth: 390, innerHeight: 844, requestAnimationFrame: () => 0, getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addEventListener() {} }),
    MutationObserver: function () { return { observe() {}, disconnect() {} }; }, CustomEvent: function () {}, Event: function () {}, indexedDB: { open: () => ({}) },
    fetch: () => Promise.reject(new Error('sin red')), crypto: require('crypto').webcrypto,
    document: { readyState: 'complete', addEventListener() {}, removeEventListener() {}, createElement: el, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], head: el(), body: el(), documentElement: el(), cookie: '' } };
  ctx.window = ctx; ctx.self = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {}; ctx.dispatchEvent = () => {};
  vm.createContext(ctx);
  const exp = ';this.__m={Festivos:typeof Festivos!=="undefined"?Festivos:undefined,Habilitacion:typeof Habilitacion!=="undefined"?Habilitacion:undefined,INFORME:typeof INFORME!=="undefined"?INFORME:undefined,EVIDENCIAS:typeof EVIDENCIAS!=="undefined"?EVIDENCIAS:undefined};';
  ['empresa.js', 'config.js', 'common.js', 'informe-reglas.js', 'auditorias-plantillas.js', 'evidencias-reglas.js'].forEach((f) => {
    try { vm.runInContext(leer(f) + exp, ctx, { filename: f }); } catch (e) { if (!/is not iterable|Cannot read properties of null/.test(e.message)) throw new Error(f + ': ' + e.message); vm.runInContext(exp, ctx); }
  });
  return ctx.__m;
}

function correr(ok, grupo) {
  const M = entornoCliente(), F = M.Festivos, I = M.INFORME, EV = M.EVIDENCIAS, H = M.Habilitacion;

  grupo('Lógica · festivos y plazos (se ejecutan, no se leen)', () => {
    const f26 = Object.keys(F.de(2026)).sort().join(' ');
    // Calendario oficial de festivos de Colombia 2026 (Ley 51 de 1983, «Ley Emiliani»).
    ok('los 18 festivos de Colombia 2026 son exactamente los oficiales', f26 === '2026-01-01 2026-01-12 2026-03-23 2026-04-02 2026-04-03 2026-05-01 2026-05-18 2026-06-08 2026-06-15 2026-06-29 2026-07-20 2026-08-07 2026-08-17 2026-10-12 2026-11-02 2026-11-16 2026-12-08 2026-12-25', f26);
    const f27 = Object.keys(F.de(2027));
    ok('2027: Semana Santa (25 y 26 de marzo), Reyes el lunes 11 de enero y 18 festivos', f27.length === 18 && F.de(2027)['2027-03-25'] && F.de(2027)['2027-03-26'] && F.de(2027)['2027-01-11'], f27.sort().join(' '));
    ok('un festivo que cae en lunes no se corre (12 de octubre de 2026 es lunes)', F.de(2026)['2026-10-12'] === true && !F.de(2026)['2026-10-19']);
    ok('sábado, domingo y festivo no son hábiles; un martes normal sí', !F.esHabil('2026-11-14') && !F.esHabil('2026-11-15') && !F.esHabil('2026-11-16') && F.esHabil('2026-11-17'));
    ok('FURAT: accidente el viernes 13-nov-2026 + 2 días hábiles = miércoles 18 (salta el puente festivo)', F.sumarHabiles('2026-11-13', 2) === '2026-11-18', F.sumarHabiles('2026-11-13', 2));
    ok('FURAT: accidente un sábado + 2 hábiles = martes', F.sumarHabiles('2026-10-31', 2) === '2026-11-04', F.sumarHabiles('2026-10-31', 2));   // lunes 2 es festivo
    ok('PQRS: 15 días hábiles desde el 1-dic-2026 = 23-dic (8 de diciembre es festivo)', F.sumarHabiles('2026-12-01', 15) === '2026-12-23', F.sumarHabiles('2026-12-01', 15));
    ok('sumar días cruza el año y los bisiestos', F.sumarDias('2026-12-31', 1) === '2027-01-01' && F.sumarDias('2028-02-28', 1) === '2028-02-29' && F.sumarDias('2027-02-28', 1) === '2027-03-01');
    ok('sumar meses al último día del mes no se pasa (31-ene + 1 mes = 28-feb)', F.sumarMeses('2026-01-31', 1) === '2026-02-28' && F.sumarMeses('2028-01-31', 1) === '2028-02-29' && F.sumarMeses('2026-03-31', -1) === '2026-02-28');
    ok('vencimiento a 12 y 18 meses (inducción y alturas) caen el mismo día del mes', F.sumarMeses('2026-05-15', 12) === '2027-05-15' && F.sumarMeses('2026-05-15', 18) === '2027-11-15');
    const tarde = entornoCliente('2026-11-10T04:30:00Z').Festivos;   // 11:30 p. m. del 9 en Colombia
    ok('«hoy» es la fecha de Colombia aunque en UTC ya sea el día siguiente', tarde.hoy() === '2026-11-09', tarde.hoy());
    ok('fecha corta dd/mm/aaaa', F.corta('2026-03-05') === '05/03/2026' && F.corta('') === '');
  });

  grupo('Lógica · indicadores de accidentalidad (Res. 0312 de 2019, art. 30)', () => {
    const r = (tipo, resumen) => ({ tipo, resumen });
    const AT = 'Accidente de trabajo';
    const rows = [
      r('mes', { mes: '2026-03', trabajadores: 80, diasProgramados: 1760, diasAusencia: 44, casosEL: 1, casosELNuevos: 1 }),
      r('mes', { mes: '2026-04', trabajadores: 100, diasProgramados: 2200, diasAusencia: 22 }),
      r('reporte', { clase: AT, fecha: '2026-03-03', lesionadoCc: '111', diasIncapacidad: 5 }),
      r('reporte', { clase: AT, fecha: '2026-03-20', lesionadoCc: '222', diasIncapacidad: 10 }),
      r('reporte', { clase: 'Incidente', fecha: '2026-03-21' }),
      r('reporte', { clase: AT, fecha: '2026-04-28', lesionadoCc: '333', diasIncapacidad: 0, diasCargados: 300 }),
      // La incapacidad del AT del 20-mar se registra en ausentismo y cruza a abril: 12 días de marzo y 3 de abril.
      r('ausencia', { causa: AT, cedula: '222', inicio: '2026-03-20', fin: '2026-04-03' })
    ];
    const mar = I.mesInd(rows, '2026-03'), abr = I.mesInd(rows, '2026-04');
    ok('frecuencia = AT del mes ÷ trabajadores × 100 (2 ÷ 80 × 100 = 2,5); los incidentes no cuentan', mar.at === 2 && Math.abs(mar.frecuencia - 2.5) < 1e-9, JSON.stringify(mar));
    ok('severidad: los días por ausentismo cuentan en el mes en que se pierden (5 + 12 = 17 en marzo)', mar.dias === 17 && Math.abs(mar.severidad - 21.25) < 1e-9, mar.dias + ' días');
    ok('abril: 3 días que vienen de marzo + 300 días cargados del AT de abril', abr.dias === 303 && Math.abs(abr.severidad - 303) < 1e-9, abr.dias + ' días');
    ok('ausentismo = días de ausencia ÷ días programados × 100', Math.abs(mar.ausentismo - 2.5) < 1e-9 && Math.abs(abr.ausentismo - 1) < 1e-9);
    const sinT = I.mesInd([r('reporte', { clase: AT, fecha: '2026-05-02' })], '2026-05');
    ok('un mes con accidentes y sin el número de trabajadores lo dice (no inventa una tasa)', sinT.sinTrabajadores === true && sinT.frecuencia === null);
    const an = I.anual(rows, '2026', '2026-04-30');
    ok('año: frecuencia acumulada = AT del año ÷ promedio de trabajadores × 100 (3 ÷ 90 × 100)', Math.abs(an.frecuenciaAcum - 3 / 90 * 100) < 1e-9 && an.at === 3, String(an.frecuenciaAcum));
    ok('año: severidad acumulada = días del año ÷ promedio × 100 ((17 + 303) ÷ 90 × 100)', Math.abs(an.severidadAcum - 320 / 90 * 100) < 1e-9, String(an.severidadAcum));
    ok('mortalidad: sin AT mortales es 0 %', an.mortalidad === 0);
    const mort = I.diasAT([r('reporte', { clase: AT, fecha: '2026-06-01', mortal: true })], '2026-06');
    ok('un AT mortal sin días cargados registrados cuenta 6.000 (ANSI Z16.1) y lo avisa', mort.cargados === 6000 && mort.mortalSinCargados === true);
    ok('prevalencia de enfermedad laboral por 100.000 trabajadores', Math.abs(an.prevalencia - 1 / 90 * 100000) < 1e-6, String(an.prevalencia));
  });

  grupo('Lógica · porcentaje de estándares mínimos', () => {
    const R = EV.resumen([{ e: 'ok', valor: 5 }, { e: 'ok', valor: 2.5 }, { e: 'falta', valor: 2.5 }, { e: 'parcial', valor: 10 }, { e: 'reservado', valor: 0 }]);
    ok('el porcentaje es ponderado por el valor de cada estándar (7,5 de 20 = 37,5 %), no por cuántos son', R.pct === 37.5 && R.ok === 2 && R.falta === 1 && R.parcial === 1 && R.total === 5, JSON.stringify(R));
    ok('sin estándares el porcentaje es 0 (no divide por cero)', EV.resumen([]).pct === 0);
    const c = {}; vm.createContext(c); vm.runInContext(leer('auditorias-plantillas.js') + ';this.P=PLANTILLAS_AUDITORIA', c);
    const suma = (k) => c.P[k].items.reduce((a, x) => a + (Number(x[3]) || 0), 0);
    ok('la plantilla de 60 estándares tiene 60 ítems y suma 100 puntos (Res. 0312, tabla de valores)', c.P.RES0312.items.length === 60 && Math.abs(suma('RES0312') - 100) < 1e-6, String(suma('RES0312')));
    ok('las de 3, 7 y 21 estándares tienen esos ítems y suman 100 puntos', [3, 7, 21].every((n) => c.P['RES0312_' + n].items.length === n && Math.abs(suma('RES0312_' + n) - 100) < 1e-6), [3, 7, 21].map((n) => suma('RES0312_' + n)).join(' / '));
    ok('los 60 numerales no se repiten', new Set(c.P.RES0312.items.map((x) => x[0])).size === 60);
  });

  grupo('Lógica · habilitación del personal', () => {
    const hoy = F.hoy(), mas = (d) => F.sumarDias(hoy, d);
    const req = (vence, extra) => Object.assign({ vence }, extra || {});
    H._mapa = {
      '111': { cedula: '111', nombre: 'Ana', activo: true, req: { seguridad_social: req(mas(20)), induccion: req(mas(200)), medico: req(mas(200), { apto: true }), alturas: req(mas(300)) } },
      '222': { cedula: '222', nombre: 'Beto', activo: true, req: { seguridad_social: req(mas(20)), induccion: req(mas(-1)), medico: req(mas(200), { apto: true }) } },
      '333': { cedula: '333', nombre: 'Caro', activo: true, req: { seguridad_social: req(mas(5)), induccion: req(mas(200)), medico: req(mas(200), { apto: true }) } },
      '444': { cedula: '444', nombre: 'Dani', activo: false, req: {} },
      '555': { cedula: '555', nombre: 'Eva', activo: true, req: { seguridad_social: req(mas(20)), induccion: req(mas(200)), medico: req(mas(200), { apto: true }), alturas: req(mas(300)) }, restr: { para: ['alturas'], hasta: mas(30) } }
    };
    H._copiaDel = null;
    const e = (c, ctx) => H.revisar(c, ctx).estado;
    ok('con todo vigente está habilitada para alturas', e('111', ['alturas']) === 'ok', JSON.stringify(H.revisar('111', ['alturas'])));
    ok('inducción vencida ayer = NO habilitado', e('222', []) === 'mal');
    ok('seguridad social que vence en 5 días = habilitado con aviso (por vencer)', e('333', []) === 'pronto');
    ok('sin el curso de alturas no se habilita para alturas aunque lo general esté bien', e('333', ['alturas']) === 'mal');
    ok('inactivo en Personal habilitado = no habilitado', e('444', []) === 'mal');
    ok('restricción médica vigente para alturas bloquea alturas pero no el trabajo general', e('555', ['alturas']) === 'mal' && e('555', []) !== 'mal');
    ok('una cédula con puntos y espacios se encuentra igual', H.clave('1.111 ') === H.clave('1111'));
    ok('quien no está registrado: en alto riesgo es «no habilitado»; en trabajo general, «sin registro»', e('999', ['alturas']) === 'mal' && e('999', []) === 'sin-registro');
    H._mapa = null;
  });

  grupo('Lógica · licencia firmada (ECDSA P-256)', () => {
    const os = require('os'), { execFileSync } = require('child_process'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lic-')), priv = path.join(tmp, 'p.json');
    const copia = path.join(tmp, 'licencia.js'); fs.copyFileSync(path.join(RAIZ, 'licencia.js'), copia);
    const hp = path.join(tmp, 'h.js'); fs.writeFileSync(hp, fs.readFileSync(path.join(RAIZ, 'herramientas/licencia.js'), 'utf8').replace("path.join(__dirname, '..', 'licencia.js')", JSON.stringify(copia)));
    const env = Object.assign({}, process.env, { SSTA_LICENCIA_PRIVADA: priv });
    let res = [];
    try {
      execFileSync('node', [hp, 'llaves'], { env });
      const L = execFileSync('node', [hp, 'firmar', '--empresa', 'Demo SAS', '--nit', '900123456-8', '--hasta', '2030-12-31'], { env }).toString().trim();
      const prueba = path.join(tmp, 't.js');
      fs.writeFileSync(prueba, 'const vm=require("vm"),fs=require("fs");const ctx={atob,TextDecoder,TextEncoder,crypto:require("crypto").webcrypto,EMPRESA:{nit:"900.123.456-8"},console};vm.createContext(ctx);' +
        'vm.runInContext(fs.readFileSync(' + JSON.stringify(copia) + ',"utf8")+";this.L=Licencia",ctx);const L=' + JSON.stringify(L) + ';' +
        '(async()=>{const r=[];r.push((await ctx.L.revisar(L,"2026-11-09")).estado);r.push((await ctx.L.revisar(L.slice(0,-3)+"AAA","2026-11-09")).estado);r.push((await ctx.L.revisar(L,"2031-01-02")).estado);' +
        'const otro=Buffer.from(JSON.stringify({empresa:"Demo SAS",nit:"900123456-8",hasta:"2099-12-31"})).toString("base64").replace(/=+$/,"")+"."+L.split(".")[1];r.push((await ctx.L.revisar(otro,"2026-11-09")).estado);' +
        'ctx.EMPRESA.nit="800.111.222-3";r.push((await ctx.L.revisar(L,"2026-11-09")).estado);ctx.EMPRESA.nit="900.123.456-8";r.push((await ctx.L.revisar(L,"2030-12-15")).estado);console.log(JSON.stringify(r));})();');
      res = JSON.parse(execFileSync('node', [prueba]).toString());
    } catch (e) { res = ['error: ' + e.message.slice(0, 120)]; }
    fs.rmSync(tmp, { recursive: true, force: true });
    ok('licencia firmada y vigente = «vigente»; 30 días antes de vencer = «por-vencer»', res[0] === 'vigente' && res[5] === 'por-vencer', JSON.stringify(res));
    ok('firma alterada o datos cambiados (otra fecha con la firma vieja) = «invalida»', res[1] === 'invalida' && res[3] === 'invalida', JSON.stringify(res));
    ok('vencida = «vencida»; la de otro NIT no sirve para esta empresa', res[2] === 'vencida' && res[4] === 'invalida', JSON.stringify(res));
    ok('la llave privada nunca está en el proyecto (va en la carpeta del usuario) y el portal no se bloquea sin licencia', /os\.homedir\(\), '\.ssta-licencia-privada\.json'/.test(leer('herramientas/licencia.js')) && /nunca bloquea/i.test(leer('licencia.js')) && !/location\.(href|replace)|throw /.test(leer('licencia.js').split('const Licencia')[1]));
  });
  grupo('Lógica · servidor (se ejecuta en el simulador de Apps Script)', () => {
    const { crearEntorno } = require('./simulador-apps-script');
    const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
    const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
    const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
    const hoy = E.ctx.hoyISO_();
    const a = P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-U1', doc: { categoria: 'Extintores', fecha: hoy, items: [] }, opId: 'op-unico' });
    const b = P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-U1', doc: { categoria: 'Extintores', fecha: hoy, items: [] }, opId: 'op-unico' });
    ok('idempotencia: el mismo envío dos veces (reintento sin señal) guarda una sola vez', a.ok && b.ok && (G({ action: 'list', tipo: 'inspeccion' }).rows || []).filter((x) => x.id === 'INS-U1').length === 1);
    const c = P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-U1', doc: { categoria: 'Extintores', fecha: hoy, items: [], nota: 'b' }, versionBase: 0, opId: 'op-2' });
    ok('conflicto de versión: guardar sobre una versión vieja se rechaza (no pisa lo de otro)', c.ok === false);
    P({ action: 'guardar', tipo: 'examen', id: 'EXA-U1', doc: { cedula: '111', nombre: 'Ana', fecha: hoy, tipoExamen: 'Periódico', concepto: 'Apto' }, opId: 'ex1' });
    ok('bitácora: cada cambio queda en la hoja de eventos', E.hojas.Eventos && E.hojas.Eventos.filas.length >= 3);
    // v162 · Ficha 360: vínculos de una persona en el SG-SST, con su rol.
    P({ action: 'guardar', tipo: 'reporte', id: 'REP-U9', doc: { clase: 'Accidente de trabajo', fecha: hoy, descripcion: 'Golpe', lesionado: { nombre: 'Ana Ruiz', cedula: '1023456789' } }, opId: 'v1' });
    P({ action: 'guardar', tipo: 'induccion', id: 'IND-U9', doc: { nombre: 'Ana Ruiz', cedula: '1.023.456.789', fecha: hoy, tipoInduccion: 'Inducción' }, opId: 'v2' });
    P({ action: 'guardar', tipo: 'induccion', id: 'IND-U8', doc: { nombre: 'Otra', cedula: '102345678', fecha: hoy }, opId: 'v3' });
    const vin = G({ action: 'vinculos', cedula: '1023456789' }), ids = (vin.rows || []).map((x) => x.id + ':' + x.rol);
    ok('vínculos: encuentra a la persona por su cédula en cualquier registro y dice su rol (lesionado, titular)', vin.ok && ids.indexOf('REP-U9:lesionado') !== -1 && ids.indexOf('IND-U9:titular') !== -1, ids.join(' '));
    ok('vínculos: una cédula parecida (un dígito menos) no se confunde', ids.every((x) => x.indexOf('IND-U8') === -1));
    ok('vínculos: sin usuarios, los datos de salud no salen en la ficha', (G({ action: 'vinculos', cedula: '111' }).rows || []).every((x) => x.tipo !== 'examen'));
    // v162 · Calendario ICS de vencimientos
    P({ action: 'guardar', tipo: 'accion', id: 'ACC-U1', doc: { origen: 'Inspección', hallazgo: 'Extintor sin recarga', accion: 'Recargar extintor; bodega', responsable: 'Ana', fechaCompromiso: E.ctx.sumarDias_(hoy, 10), estado: 'ABIERTA' }, opId: 'ic1' });
    const lk = G({ action: 'icsEnlace' }), ics = (k) => E.ctx.doGet({ parameter: { action: 'ics', k } })._t;
    const cal = ics(lk.llave);
    ok('calendario ICS: con la llave trae los vencimientos como eventos de día completo con aviso 7 días antes', lk.ok && /^BEGIN:VCALENDAR/.test(cal) && /SUMMARY:Acción: Recargar extintor\\; bodega/.test(cal) && /TRIGGER:-P7D/.test(cal) && /DTSTART;VALUE=DATE:\d{8}/.test(cal), cal.slice(0, 300));
    ok('calendario ICS: sin la llave correcta no entrega nada, y nunca lleva exámenes médicos', !/VEVENT/.test(ics('mala')) && !/[Ee]xamen/.test(cal));
    const lk2 = G({ action: 'icsEnlace', nuevo: '1' });
    ok('calendario ICS: cambiar la llave deja sin servicio el enlace anterior', lk2.llave !== lk.llave && !/VEVENT/.test(ics(lk.llave)) && /VEVENT/.test(ics(lk2.llave)));
    // v162 · Derechos del titular
    const hb = P({ action: 'guardar', tipo: 'habeas', id: 'HAB-20261109-ABC123', doc: { derecho: 'Revocar mi autorización (reclamo)', nombre: 'Ana Ruiz', cedula: '1023456789', contacto: 'ana@x.co', estado: 'RESPONDIDA', vence: '2030-01-01' }, opId: 'h1' });
    const hd = E.ctx.leerDoc_('HAB-20261109-ABC123', false) || {};
    ok('derechos del titular: la solicitud entra como reclamo con 15 días hábiles y el servidor pone estado y plazo (no los del navegador)', hb.ok && hd.clase === 'Reclamo' && hd.estado === 'RECIBIDA' && hd.vence === E.ctx.sumarHabiles_(hoy, 15), JSON.stringify(hd).slice(0, 200));
    const pend = E.ctx.pendientes_(); ok('derechos del titular: aparece en los pendientes del SG-SST con su plazo', (pend.items || []).some((x) => x.tipo === 'habeas'), JSON.stringify((pend.items || []).map((x) => x.tipo)).slice(0, 200) + ' ' + JSON.stringify(hb));
    // v162 · Portal del contratista
    P({ action: 'guardar', tipo: 'contratista', id: 'CTR-U1', doc: { nombre: 'Andamios del Sur SAS', nit: '900123456-8', documentos: {} }, opId: 'c1' });
    const kc = G({ action: 'enlaceContratista', id: 'CTR-U1' }).k;
    const pt = G({ action: 'contratistaPortal', id: 'CTR-U1', k: kc }), malo = G({ action: 'contratistaPortal', id: 'CTR-U1', k: (kc.charAt(0) === 'x' ? 'y' : 'x') + kc.slice(1) });
    const sub = E.post({ action: 'contratistaSubir', id: 'CTR-U1', k: kc, doc: 'arl', fecha: hoy, meses: 1, nombre: 'arl.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64'), opId: 'cs1' });
    const tr = E.post({ action: 'contratistaTrabajador', id: 'CTR-U1', k: kc, nombre: 'Pedro Pérez', cedula: '1098765432', cargo: 'Andamiero', opId: 'ct1' });
    const dctr = E.ctx.leerDoc_('CTR-U1', false), dtr = E.ctx.leerDoc_('TRB-1098765432', false) || {};
    ok('portal del contratista: con su enlace ve lo suyo; con una clave cambiada, nada', pt.ok && pt.contratista.nombre === 'Andamios del Sur SAS' && malo.ok === false, JSON.stringify(malo).slice(0, 120));
    ok('portal del contratista: sube un soporte (queda adjunto, con vencimiento calculado y «por revisar»)', sub.ok && dctr.documentos.arl.porRevisar === true && dctr.documentos.arl.vence > hoy && (dctr.adjuntos || []).some((a) => a.ref === 'arl'), JSON.stringify(sub));
    ok('portal del contratista: registra a su personal con su empresa y «por revisar»; sin enlace no puede escribir', tr.ok && dtr.empresa === 'Andamios del Sur SAS' && dtr.porRevisar === true && E.post({ action: 'contratistaTrabajador', id: 'CTR-U1', k: 'malo', nombre: 'X Y', cedula: '1234567', opId: 'ct2' }).ok === false);
    const k2 = G({ action: 'enlaceContratista', id: 'CTR-U1', nuevo: '1' }).k;
    ok('portal del contratista: al cambiar el enlace, el anterior deja de servir', k2 !== kc && G({ action: 'contratistaPortal', id: 'CTR-U1', k: kc }).ok === false && G({ action: 'contratistaPortal', id: 'CTR-U1', k: k2 }).ok);
    const ex = P({ action: 'exportarTodo' });
    // v169 · Uso por módulo (en el enrutador del servidor único)
    {
      const U = crearEntorno(path.join(RAIZ, 'servidor-todo-en-uno/Portal-SSTA.gs'));
      const tokU = vm.runInContext("typeof API_TOKEN !== 'undefined' ? API_TOKEN : ''", U.ctx);
      U.post({ token: tokU, action: 'guardar', tipo: 'reporte', id: 'REP-U1', doc: { clase: 'Acto inseguro', fecha: hoy, descripcion: 'Sin casco en zona de obra', lugar: 'Bodega' }, opId: 'u1' }, 'sgsst');
      U.post({ token: tokU, action: 'guardar', tipo: 'reporte', id: 'REP-U2', doc: { clase: 'Condición insegura', fecha: hoy, descripcion: 'Cable pelado junto al tablero', lugar: 'Taller' }, opId: 'u2' }, 'sgsst');
      U.post({ token: tokU, action: 'guardar', tipo: 'presupuesto', id: 'PRE-2026', doc: { anio: '2026', rubros: [] }, opId: 'u3' }, 'sgsst');
      U.post({ __consulta: { action: 'listar', tipos: 'reporte' } }, 'sgsst');
      const raiz = U.get({}, ''), mes = Object.keys(raiz.uso || {}).pop(), u = (raiz.uso || {})[mes] || {};
      ok('uso por módulo: cada servidor cuenta lo que se guarda en cada módulo por mes (las consultas no cuentan) y la raíz lo entrega', u.reportes === 2 && u.presupuesto === 1 && Object.keys(u).length === 2, JSON.stringify(raiz.uso));
      ok('uso por módulo: solo números por módulo, ningún dato de las personas', !/Sin casco|Cable pelado|Bodega/.test(JSON.stringify(raiz.uso)));
    }
    // v173 · Lo que la guía no supo responder: la raíz lo guarda (solo el texto) y lo entrega a la consola
    {
      const U = crearEntorno(path.join(RAIZ, 'servidor-todo-en-uno/Portal-SSTA.gs'));
      const g1 = U.post({ __guia: { texto: '¿Cómo hago la matriz de EPP por cargo?' } }, '');
      U.post({ __guia: { texto: '¿cómo hago la matriz de EPP por cargo?' } }, '');
      U.post({ __guia: { texto: 'Dónde subo el RUT <script>' } }, '');
      const vac = U.post({ __guia: { texto: ' ' } }, '');
      const gr = U.get({}, '').guia || [];
      const m = gr.find((x) => /matriz de EPP/i.test(x.t)) || {};
      ok('guía: la raíz del servidor anota lo que la guía no supo responder, junta las repetidas y lo entrega a la consola', g1.ok && m.n === 2 && gr.length === 2 && vac.ok === false, JSON.stringify(gr));
      ok('guía: guarda solo el texto limpio (sin etiquetas) y recortado', gr.every((x) => !/[<>]/.test(x.t) && x.t.length <= 140 && Object.keys(x).join() === 't,n,u'));
      for (let i = 0; i < 70; i++) U.post({ __guia: { texto: 'pregunta de relleno numero ' + i } }, '');
      ok('guía: guarda como máximo 60 preguntas (no crece sin límite)', U.get({}, '').guia.length <= 40 && JSON.parse(vm.runInContext("propiedades_().getProperty('GUIA_SIN_RESPUESTA')", U.ctx)).length === 60);
    }
    // v174 · Tareas propias con recordatorio, correos por rol y personas que llegan de otros módulos «por revisar»
    {
      const sum = (d) => { const x = new Date(hoy + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
      P({ action: 'guardar', tipo: 'tarea', id: 'TAR-1', doc: { titulo: 'Llamar a la ARL por el FURAT', fecha: sum(3), hora: '09:30', recordar: 'Tres días antes', responsable: 'Ana Pérez', estado: 'PENDIENTE' }, opId: 't1' });
      P({ action: 'guardar', tipo: 'tarea', id: 'TAR-2', doc: { titulo: 'Tarea ya hecha', fecha: sum(1), responsable: 'Ana Pérez', estado: 'HECHA' }, opId: 't2' });
      const pe = G({ action: 'pendientes', dias: 45 }), it = pe.items || [];
      const t1 = it.filter((x) => x.id === 'TAR-1');
      ok('tareas: la tarea sale en la agenda con su hora y, si pidió recordatorio, también el día del recordatorio; las hechas no', t1.some((x) => /Tarea: Llamar a la ARL por el FURAT \(09:30\)/.test(x.texto) && x.responsable === 'Ana Pérez') &&
        t1.some((x) => /^Recordatorio: «Llamar a la ARL/.test(x.texto) && x.fecha === hoy) && !it.some((x) => x.id === 'TAR-2'), JSON.stringify(t1));
      P({ action: 'guardar', tipo: 'induccion', id: 'IND-R1', doc: { nombre: 'Visitante Nuevo Uno', cedula: '99887766', cargo: 'Ayudante', fecha: hoy, tipoInduccion: 'Inducción', resultado: 'APROBADA', vence: sum(365) }, opId: 'i1' });
      const tr = (G({ action: 'list', tipo: 'trabajador' }).rows || []).find((x) => x.resumen && x.resumen.cedula === '99887766');
      ok('personal: quien llega por una inducción queda «por revisar» (no se mete solo a la lista)', tr && tr.resumen.porRevisar === true && tr.resumen.origen === 'Inducción', JSON.stringify(tr && tr.resumen));
      P({ action: 'parche', tipo: 'trabajador', id: tr.id, campos: { requisitos: { seguridad_social: { fecha: sum(-40), vence: sum(-5) } } }, opId: 'i2' });
      ok('personal: lo de alguien «por revisar» no llena los pendientes de Gestión', !(G({ action: 'pendientes', dias: 45 }).items || []).some((x) => /Visitante Nuevo Uno/.test(x.texto)));
      P({ action: 'parche', tipo: 'trabajador', id: tr.id, campos: { porRevisar: false, tipoDoc: 'PPT' }, opId: 'i3' });
      const tr2 = (G({ action: 'list', tipo: 'trabajador' }).rows || []).find((x) => x.id === tr.id);
      ok('personal: al incluirla queda en la lista con su tipo de documento (PPT) y sus vencimientos vuelven a los pendientes', !tr2.resumen.porRevisar && tr2.resumen.tipoDoc === 'PPT' &&
        (G({ action: 'pendientes', dias: 45 }).items || []).some((x) => /Visitante Nuevo Uno/.test(x.texto)));
    }
    // v169 · Presupuesto: los rubros viajan en la lista (con su valor) y un gasto sin valor se rechaza
    {
      P({ action: 'guardar', tipo: 'presupuesto', id: 'PRE-2026', doc: { anio: '2026', rubros: [{ id: 'R1', rubro: 'EPP', valor: 1500000 }, { id: 'R2', rubro: 'Exámenes', valor: '2000000' }], aprobadoPor: 'Gerente' }, opId: 'pp1' });
      const lp = G({ action: 'list', tipo: 'presupuesto' }), pr = ((lp.rows || []).find((x) => x.id === 'PRE-2026') || {}).resumen || {};
      ok('presupuesto: la lista trae los rubros con su valor y el total', Array.isArray(pr.rubros) && pr.rubros.length === 2 && pr.rubros[1].valor === 2000000 && pr.totalPresupuestado === 3500000, JSON.stringify(pr));
      const g0 = P({ action: 'guardar', tipo: 'gasto', id: 'GAS-0', doc: { anio: '2026', rubroId: 'R1', fecha: hoy, concepto: 'Arneses', valor: 0 }, opId: 'pp2' });
      const g1 = P({ action: 'guardar', tipo: 'gasto', id: 'GAS-1', doc: { anio: '2026', rubroId: 'R1', fecha: hoy, concepto: 'Arneses', valor: '1250000.6' }, opId: 'pp3' });
      ok('presupuesto: un gasto en cero o sin valor se rechaza; el valor se guarda redondeado', g0.ok === false && g1.ok && (E.ctx.leerDoc_('GAS-1', false) || {}).valor === 1250001);
    }
    // v169 · Reintegro laboral
    {
      const rd = (id) => E.ctx.leerDoc_(id, false) || {};
      P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-R1', doc: { nombre: 'Rosa Reintegro Uno', cedula: '41222333', cargo: 'Operaria', req: {} }, opId: 'r1' });
      const base = { nombre: 'Rosa Reintegro Uno', cedula: '41222333', cargo: 'Operaria', origen: 'Accidente de trabajo', fechaRetorno: hoy, tipoReintegro: 'Con modificaciones', restricciones: 'No levantar más de 10 kg; no subir escaleras', restringePara: ['Trabajo en alturas'], temporalidad: 'Temporales', venceRestriccion: E.ctx.sumarDias_(hoy, 60), frecuencia: 30, proximoSeguimiento: E.ctx.sumarDias_(hoy, -1), estado: 'EN SEGUIMIENTO' };
      P({ action: 'guardar', tipo: 'reintegro', id: 'REI-1', doc: base, opId: 'r2' });
      const rm = rd('TRB-R1').restriccionMed || {};
      ok('reintegro: las restricciones bloquean en Personal habilitado los trabajos que la persona no puede hacer', JSON.stringify(rm.para) === '["alturas"]' && rm.fuente === 'REI-1', JSON.stringify(rm));
      const pe = G({ action: 'pendientes' }), tx = JSON.stringify(pe.items || pe.rows || pe);
      ok('reintegro: avisa el seguimiento vencido y que falta comunicar las restricciones al jefe y al trabajador', /seguimiento a las restricciones de Rosa/.test(tx) && /falta comunicar las restricciones al jefe/.test(tx), tx.slice(0, 300));
      ok('reintegro: es dato de salud (solo SST) y no se puede ver sin permiso de salud', vm.runInContext("SOLO_SST.indexOf('reintegro') !== -1 && TIPOS_SALUD_.indexOf('reintegro') !== -1", E.ctx));
      P({ action: 'parche', tipo: 'reintegro', id: 'REI-1', campos: { estado: 'CERRADO', fechaCierre: hoy, motivoCierre: 'Restricciones levantadas por concepto médico' }, opId: 'r3' });
      ok('reintegro: al cerrarlo se quita el bloqueo que puso (y no toca uno que haya puesto un examen)', !rd('TRB-R1').restriccionMed, JSON.stringify(rd('TRB-R1').restriccionMed));
    }
    // v164 · Maestro único de personas
    {
      const RE = /^P-[0-9A-Z]{12}$/, rd = (id) => E.ctx.leerDoc_(id, false) || {};
      P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-M1', doc: { nombre: 'Marta Maestra Uno', cedula: '52111222', cargo: 'Soldadora', personaId: 'P-AAAAAAAAAAAA', cedulasAnteriores: ['999'], req: {} }, opId: 'm1' });
      const m1 = rd('TRB-M1');
      ok('maestro: el servidor le da a cada persona un personaId propio (el que manda el celular no vale)', RE.test(m1.personaId) && m1.personaId !== 'P-AAAAAAAAAAAA' && !m1.cedulasAnteriores, JSON.stringify([m1.personaId, m1.cedulasAnteriores]));
      P({ action: 'parche', tipo: 'trabajador', id: 'TRB-M1', campos: { cedula: '52111223', personaId: 'P-BBBBBBBBBBBB' }, opId: 'm2' });
      const m1b = rd('TRB-M1');
      ok('maestro: al corregir la cédula el personaId no cambia y la vieja queda en «cédulas anteriores»', m1b.personaId === m1.personaId && JSON.stringify(m1b.cedulasAnteriores) === '["52111222"]', JSON.stringify(m1b));
      const pv = G({ action: 'persona', cedula: '52.111.222' });
      ok('maestro: se encuentra a la persona también por su cédula anterior (con o sin puntos)', pv.ok && pv.persona.id === 'TRB-M1' && pv.persona.cedulas.join() === '52111223,52111222', JSON.stringify(pv));
      P({ action: 'guardar', tipo: 'induccion', id: 'IND-M1', doc: { nombre: 'Marta Maestra Uno', cedula: '52111222', fecha: hoy, cargo: 'Soldadora' }, opId: 'm3' });
      const vi = G({ action: 'vinculos', cedula: '52111223' });
      ok('ficha 360: lo registrado con la cédula vieja sale en la ficha de la persona', vi.ok && vi.rows.some((x) => x.id === 'IND-M1') && vi.persona && vi.persona.personaId === m1.personaId, JSON.stringify(vi).slice(0, 200));
      // Duplicado y unificación
      P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-M2', doc: { nombre: 'Marta M. Uno', cedula: '1012000333', req: {} }, opId: 'm4' });
      const m2 = rd('TRB-M2');
      const auto = P({ action: 'parche', tipo: 'trabajador', id: 'TRB-M2', campos: { fusionadoCon: 'TRB-M2' }, opId: 'm5' });
      ok('maestro: no se puede unificar una ficha consigo misma', auto.ok === false);
      P({ action: 'parche', tipo: 'trabajador', id: 'TRB-M2', campos: { activo: false, fusionadoCon: 'TRB-M1' }, opId: 'm6' });
      const m1c = rd('TRB-M1'), pf = G({ action: 'persona', personaId: m2.personaId });
      ok('unificar: la ficha que queda recoge la cédula y el personaId de la otra', m1c.cedulasAnteriores.indexOf('1012000333') !== -1 && m1c.personasFusionadas.indexOf(m2.personaId) !== -1, JSON.stringify(m1c));
      ok('unificar: buscar por el personaId o la cédula de la unificada lleva a la que quedó', pf.ok && pf.persona.id === 'TRB-M1' && G({ action: 'persona', cedula: '1012000333' }).persona.id === 'TRB-M1');
      // Alta desde el anexo y lista para nómina/PILA
      const al = P({ action: 'asegurarPersona', nombre: 'Pedro Anexo Nuevo', cedula: '80999888', cargo: 'Ayudante', opId: 'm7' });
      const al2 = P({ action: 'asegurarPersona', nombre: 'Marta Maestra', cedula: '52111222', opId: 'm8' });
      ok('anexo de personal: una persona nueva entra al maestro «por revisar»; una que ya está (aun por su cédula vieja) no se repite', al.ok && al.creado && RE.test(al.personaId) && rd(al.id).porRevisar === true && al2.ok && al2.existia && al2.id === 'TRB-M1', JSON.stringify([al, al2]));
      // Personas de antes de v164 (sin personaId): las completa el servidor
      const fila = E.ctx.filaDe_('TRB-M1'); const vieja = E.hojas.Registros.filas.find((f) => f[0] === 'TRB-M2');
      P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-OLD', doc: { nombre: 'Persona Antigua', cedula: '70111000', req: {} }, opId: 'm9' });
      { const f = E.hojas.Registros.filas.find((x) => x[0] === 'TRB-OLD'); const r = JSON.parse(f[8]); delete r.personaId; f[8] = JSON.stringify(r); const d = E.ctx.leerDoc_('TRB-OLD', false); delete d.personaId; E.ctx.escribirDoc_('TRB-OLD', d); }
      const ma = G({ action: 'personas' });
      const old = (ma.rows || []).find((x) => x.id === 'TRB-OLD');
      ok('maestro de personas: una fila por persona con personaId (también a las de antes), sin las unificadas ni datos de salud', ma.ok && old && RE.test(old.personaId) && !ma.rows.some((x) => x.id === 'TRB-M2') && !JSON.stringify(ma.rows).match(/req|apto|restric|emer/i), JSON.stringify(ma.rows).slice(0, 300));
      ok('maestro: asignarPersonaIds() se puede correr de nuevo sin cambiar nada', /ya tienen/.test(E.ctx.asignarPersonaIds()) && rd('TRB-OLD').personaId === old.personaId);
      P({ action: 'guardar', tipo: 'induccion', id: 'IND-M2', doc: { nombre: 'Marta M. Uno', cedula: '1012000333', fecha: hoy, resultado: 'APROBADA', tipoInduccion: 'Ingreso' }, opId: 'm10' });
      ok('una inducción con la cédula de la ficha unificada llega a la ficha que quedó (no a la inactiva)', ((rd('TRB-M1').requisitos || {}).induccion || {}).fuente === 'IND-M2' && !((rd('TRB-M2').requisitos || {}).induccion), JSON.stringify(rd('TRB-M1').requisitos));
      ok('sin sesión el público (permisos en campo) no ve las cédulas anteriores', !JSON.stringify(E.ctx.trabajadorPublico_({ nombre: 'x', cedulasAnteriores: ['1'] })).includes('cedulasAnteriores'));
    }
    // v162 · Modo auditor (necesita usuarios: se crea el administrador en un entorno aparte)
    {
      const E2 = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true }), cr = require('crypto');
      const P2 = (o) => E2.post(Object.assign({ token: T }, o)), G2 = (o) => E2.get(Object.assign({ token: T }, o));
      const sal = cr.randomBytes(16).toString('hex'), pr = cr.pbkdf2Sync('ClaveAdmin2026', Buffer.from(sal, 'hex'), 150000, 32, 'sha256').toString('base64');
      const adm = P2({ action: 'primerAdmin', codigo: E2.ctx.codigoAdministrador(), usuario: 'admin', nombre: 'Admin', salt: sal, iter: 150000, pruebaNueva: pr, opId: 'a' });
      P2({ action: 'guardar', tipo: 'inspeccion', id: 'INS-A1', doc: { categoria: 'Extintores', fecha: hoy, items: [] }, sesion: adm.sesion, opId: 'i' });
      P2({ action: 'guardar', tipo: 'examen', id: 'EXA-A1', doc: { cedula: '1', nombre: 'X', fecha: hoy, tipoExamen: 'Periódico', concepto: 'Apto' }, sesion: adm.sesion, opId: 'e' });
      const en = P2({ action: 'crearEnlaceAuditor', sesion: adm.sesion, nombre: 'ARL Demo', grupos: ['inspecciones'], dias: 7, opId: 'en' });
      const li = G2({ action: 'list', tipo: 'inspeccion', auditor: en.token }), fuera = G2({ action: 'list', tipo: 'accion', auditor: en.token }), sal2 = G2({ action: 'list', tipo: 'examen', auditor: en.token });
      const esc2 = E2.post({ token: T, action: 'guardar', tipo: 'inspeccion', id: 'INS-A2', doc: { categoria: 'X', fecha: hoy, items: [] }, auditor: en.token, opId: 'w' });
      ok('modo auditor: con el enlace lee SOLO los módulos que se le dieron, nunca salud, y no puede escribir', en.ok && li.ok && li.rows.some((x) => x.id === 'INS-A1') && fuera.ok === false && sal2.ok === false && esc2.ok === false, JSON.stringify([en.ok, li.ok, fuera.ok, sal2.ok, esc2.ok]));
      const sinClave = E2.get({ action: 'list', tipo: 'inspeccion', auditor: en.token }), infoSin = E2.get({ action: 'auditorInfo', auditor: en.token }), otroSin = E2.get({ action: 'list', tipo: 'inspeccion', auditor: 'enlace-falso' });
      ok('modo auditor (v174): el auditor entra SOLO con su enlace, sin la clave del portal; un enlace falso no entra', sinClave.ok && sinClave.rows.some((x) => x.id === 'INS-A1') && infoSin.ok && otroSin.ok === false, JSON.stringify([sinClave.ok, infoSin.error, otroSin.ok]));
      ok('modo auditor: cada consulta queda en la bitácora con el nombre del auditor', E2.hojas.Eventos.filas.some((f) => f[2] === 'AUDITOR' && /ARL Demo/.test(f[4])));
      const mal = P2({ sesion: adm.sesion, action: 'avisosPorRol', roles: { sst: 'diario' }, correos: { sst: 'gerente@empresa.com, no-es-correo' }, opId: 'a1' });
      const bien = P2({ sesion: adm.sesion, action: 'avisosPorRol', roles: { sst: 'diario', supervisor: 'semanal' }, correos: { sst: 'Gerente@Empresa.com; copasst@empresa.com', supervisor: '' }, opId: 'a2' });
      ok('avisos por rol: varios correos por rol (se validan y se guardan en minúscula); uno malo se rechaza', mal.ok === false && /no-es-correo/.test(mal.error) && bien.ok &&
        JSON.stringify(bien.roles.sst.correos) === '["gerente@empresa.com","copasst@empresa.com"]' && !bien.roles.supervisor.correos, JSON.stringify(bien));
      P2({ action: 'revocarEnlaceAuditor', sesion: adm.sesion, id: en.enlace.id, opId: 'rv' });
      ok('modo auditor: un enlace revocado deja de servir de inmediato', G2({ action: 'list', tipo: 'inspeccion', auditor: en.token }).ok === false && !JSON.stringify(E2.ctx.enlacesAuditor_()).includes(en.token));
    }
    ok('exportación completa: un .zip con un JSON por tipo, índice CSV, bitácora y LEAME', ex.ok && ex.registros >= 5 && ex.archivos >= 4 && !!ex.base64 && /LEAME\.txt/.test(Buffer.from(ex.base64, 'base64').toString('latin1')) && /registros\/accion\.json/.test(Buffer.from(ex.base64, 'base64').toString('latin1')), JSON.stringify(ex).slice(0, 200));
    const EA = crearEntorno(path.join(RAIZ, 'backends/backend-ats.gs'));
    EA.post({ token: T, opId: 'a1', code: 'ATS-20261109-000001', versionBase: 0, ats: { v: 1, cab: { desde: hoy, area: 'Bodega', trabajo: 'Cargue', requiere: 'NO', permisos: [] }, participantes: [{ nombres: 'Ana', apellidos: 'Ruiz', cedula: '1023456789', cargo: 'Op', firma: null }], tareas: [] } });
    const pa = EA.get({ token: T, action: 'porCedula', cedula: '1023456789' }), pb = EA.get({ token: T, action: 'porCedula', cedula: '102345678' });
    ok('ATS: «porCedula» trae los ATS donde participó la persona (y no los de una cédula parecida)', pa.ok && pa.rows.length === 1 && pa.rows[0].code === 'ATS-20261109-000001' && pb.ok && !pb.rows.length, JSON.stringify(pa).slice(0, 200));
    if (typeof E.ctx.verificarBitacora_ === 'function') {
      const v = E.ctx.verificarBitacora_();
      ok('bitácora encadenada: la verificación da íntegra', v.ok === true && v.filas >= 3, JSON.stringify(v));
      const f = E.hojas.Eventos.filas; const col = f[2].length - 2; f[2][4] = 'ALTERADO A MANO';
      const v2 = E.ctx.verificarBitacora_();
      ok('bitácora encadenada: si alguien edita una fila en la hoja, la verificación lo detecta y dice cuál', v2.ok === false && v2.primeraRota >= 2, JSON.stringify(v2) + ' col ' + col);
    }
  });
}

module.exports = { correr, entornoCliente };

if (require.main === module) {
  let n = 0, mal = 0;
  correr((t, c, d) => { n++; if (c) console.log('  ✓ ' + t); else { mal++; console.log('  ✗ ' + t + (d ? '\n      ' + String(d).slice(0, 300) : '')); } }, (g, fn) => { console.log('\n▸ ' + g); fn(); });
  console.log('\n' + (mal ? '❌  ' + mal + ' de ' + n + ' fallaron.' : '✅  ' + n + ' pruebas de lógica, todas correctas.'));
  process.exit(mal ? 1 : 0);
}
