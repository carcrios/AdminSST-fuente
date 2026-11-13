/* reportes.app.js — código de reportes.html (v162: fuera del HTML para que el celular lo guarde en caché). */
OfflineBanner.init();
OutboxBadge.init();
if (typeof Outbox !== 'undefined') Outbox.flush();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();

const $ = UI.$;
const AT = 'Accidente de trabajo';
const LISTAS = {
  parte: ['Cabeza', 'Ojos', 'Cuello', 'Tronco', 'Tórax', 'Abdomen', 'Miembros superiores', 'Manos', 'Miembros inferiores', 'Pies', 'Ubicaciones múltiples', 'Lesiones generales u otras'],
  tipo: ['Golpe, contusión o aplastamiento', 'Herida', 'Trauma superficial (raspón, rasguño)', 'Fractura', 'Luxación', 'Torcedura, esguince o desgarro muscular', 'Quemadura', 'Amputación o enucleación',
    'Conmoción o trauma interno', 'Envenenamiento o intoxicación', 'Efecto de la electricidad', 'Asfixia', 'Cuerpo extraño en ojo', 'Lesiones múltiples', 'Otra'],
  mecanismo: ['Caída de personas', 'Caída de objetos', 'Pisadas, choques o golpes', 'Atrapamiento', 'Sobreesfuerzo o falso movimiento', 'Contacto con temperatura extrema',
    'Contacto con electricidad', 'Contacto con sustancias nocivas o radiaciones', 'Proyección de partículas', 'Otro'],
  agente: ['Máquinas o equipos', 'Herramientas o implementos', 'Medios de transporte', 'Aparatos (calderas, recipientes a presión…)', 'Materiales o sustancias', 'Ambiente de trabajo (superficies, escaleras, andamios)', 'Animales', 'Otros']
};
const CAUSAS = {
  actos: ['Operar equipos sin autorización', 'No señalizar o no advertir', 'No asegurar ni bloquear energías', 'Operar a velocidad inadecuada', 'Anular o retirar dispositivos de seguridad',
    'Usar equipo o herramienta defectuosa', 'No usar o usar mal el EPP', 'Cargar o levantar de forma incorrecta', 'Ubicarse o adoptar una posición inadecuada', 'Mantenimiento de equipos en movimiento o energizados',
    'Bromas o distracciones', 'Trabajar bajo efectos de alcohol o drogas', 'Usar equipos de forma inapropiada', 'No seguir el procedimiento, el ATS o el permiso de trabajo'],
  condiciones: ['Guardas o barreras inadecuadas', 'EPP inadecuado o insuficiente', 'Herramientas, equipos o materiales defectuosos', 'Espacio limitado o congestionado', 'Señalización o alarmas insuficientes',
    'Peligro de incendio o explosión', 'Orden y aseo deficientes', 'Exposición a ruido', 'Temperaturas extremas', 'Iluminación deficiente', 'Ventilación insuficiente',
    'Atmósfera peligrosa (gases, polvos, humos, vapores)', 'Superficies inseguras (resbalosas, desniveles, aberturas)', 'Trabajo en altura sin protección contra caídas', 'Energías peligrosas sin control'],
  personales: ['Capacidad física inadecuada', 'Capacidad mental o psicológica inadecuada', 'Tensión física (fatiga, carga de trabajo)', 'Tensión mental (estrés, presión de tiempo)',
    'Falta de conocimiento o de entrenamiento', 'Falta de habilidad o de experiencia', 'Motivación inadecuada'],
  trabajo: ['Liderazgo o supervisión inadecuada', 'Ingeniería o diseño inadecuado', 'Compras inadecuadas (equipos, EPP, materiales)', 'Mantenimiento inadecuado', 'Herramientas o equipos inadecuados',
    'Estándares o procedimientos inadecuados o inexistentes', 'Desgaste por uso normal', 'Abuso o mal uso', 'Comunicación deficiente']
};
let filas = [], acciones = [], tab = 'abiertos', clase = '', actual = null, fotosNuevo = null, padsEquipo = 0;
/* v109: PQRS (las mismas de Calidad → PQRS: tipo de registro «pqrs») y filtros de las cifras */
let pqrs = [], filtro = '', fotosPqrs = null, conLista = false;
const PQ = 'PQRS';
const DIAS_PQRS = Number(((typeof EMPRESA !== 'undefined' && EMPRESA.calidad) || {}).diasPQRS) || 15;   // el mismo plazo de calidad.html
const AYUDA_TIPO = { 'Petición': 'Petición: pides información, un documento o un servicio.', 'Queja': 'Queja: estás inconforme con el trato o la actitud de una persona.',
  'Reclamo': 'Reclamo: algo no se cumplió como se acordó (servicio, entrega, calidad, pago).', 'Sugerencia': 'Sugerencia: propones una idea para mejorar.', 'Felicitación': 'Felicitación: quieres reconocer algo que se hizo bien.' };
const ICONO_PQRS = { 'Petición': '📝', 'Queja': '😠', 'Reclamo': '⚠️', 'Sugerencia': '💡', 'Felicitación': '👏' };
$('areasPqrs').innerHTML = ['Operaciones en obra', 'Mantenimiento', 'Seguridad y salud en el trabajo', 'Calidad', 'Compras', 'Talento humano', 'Administración y pagos', 'Atención al cliente']
  .concat(EMPRESA.centrosCosto || []).map((c)=> '<option value="' + esc(c) + '">').join('');

function show(id){ document.querySelectorAll('.screen').forEach((s)=>s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
function opciones(sel, lista){ $(sel).innerHTML = '<option value="">—</option>' + lista.map((x)=>'<option>' + esc(x) + '</option>').join(''); }
['parte', 'tipo', 'mecanismo', 'agente'].forEach((k)=> opciones({ parte:'lParte', tipo:'lTipo', mecanismo:'lMecanismo', agente:'lAgente' }[k], LISTAS[k]));
$('centros').innerHTML = (EMPRESA.centrosCosto || []).map((c)=> '<option value="' + esc(c) + '">').join('');

/* Plazos legales de un accidente o incidente. */
function plazos(r){
  const res = r.resumen || r, out = [];
  if (!res.fecha) return out;
  if (res.clase === AT) {
    const lim = Festivos.sumarHabiles(res.fecha, 2);
    out.push(res.furat && res.furat.radicado ? { c:'ok', t:'Reporte a la ARL (FURAT) radicado', d: (res.furat.numero ? 'N.º ' + res.furat.numero : '') + (res.furat.fecha ? ' · ' + UI.corta(res.furat.fecha) : '') }
      : { c: lim < UI.hoy() ? 'mal' : 'pronto', t:'Reporte a la ARL (FURAT): ' + (lim < UI.hoy() ? 'VENCIDO el ' : 'a más tardar el ') + UI.corta(lim), d:'2 días hábiles desde el accidente. Regístralo abajo cuando se radique.' });
  }
  // v143: AT grave o mortal: reporte a la Dirección Territorial del Ministerio del Trabajo (Res. 0312 de 2019, estándar 3.2.1)
  // en 2 días hábiles, y el informe de la investigación a la ARL dentro de los 15 días siguientes a terminarla (Res. 1401 de 2007, art. 14).
  if (res.clase === AT && (res.grave || res.mortal)) {
    const lim = Festivos.sumarHabiles(res.fecha, 2), mt = res.mintrabajo || {};
    out.push(mt.fecha ? { c:'ok', t:'Reportado al Ministerio del Trabajo', d: UI.corta(mt.fecha) + (mt.radicado ? ' · ' + mt.radicado : '') }
      : { c: lim < UI.hoy() ? 'mal' : 'pronto', t:'Reporte al Ministerio del Trabajo (Dirección Territorial): ' + (lim < UI.hoy() ? 'VENCIDO el ' : 'a más tardar el ') + UI.corta(lim), d:'Accidente grave o mortal: 2 días hábiles (Res. 0312 de 2019, estándar 3.2.1). Regístralo abajo.' });
    const inv = res.investigacion || {}, ra = res.remisionArl || {};
    if (inv.estado === 'CERRADA') { const l2 = Festivos.sumarDias(inv.fecha || res.fecha, 15);
      out.push(ra.fecha ? { c:'ok', t:'Informe de la investigación enviado a la ARL', d: UI.corta(ra.fecha) + (ra.radicado ? ' · ' + ra.radicado : '') }
        : { c: l2 < UI.hoy() ? 'mal' : 'pronto', t:'Enviar la investigación a la ARL: ' + (l2 < UI.hoy() ? 'VENCIDO el ' : 'a más tardar el ') + UI.corta(l2), d:'Res. 1401 de 2007, art. 14: 15 días después de terminarla. Regístralo abajo.' }); }
  }
  if (res.clase === AT || res.clase === 'Incidente') {
    const lim = Festivos.sumarDias(res.fecha, 15), inv = res.investigacion || {};
    out.push(inv.estado === 'CERRADA' ? { c:'ok', t:'Investigación terminada', d: inv.fecha ? UI.corta(inv.fecha) : '' }
      : { c: lim < UI.hoy() ? 'mal' : 'pronto', t:'Investigación: ' + (lim < UI.hoy() ? 'VENCIDA el ' : 'a más tardar el ') + UI.corta(lim), d:'Res. 1401 de 2007: dentro de los 15 días siguientes.' + ((res.grave || res.mortal) ? ' Grave o mortal: el informe se remite a la ARL (art. 14); el reporte a la Dirección Territorial del Ministerio va aparte, en 2 días hábiles (Dec. 1072, art. 2.2.4.1.7).' : '') });
  }
  return out;
}
const iconoClase = (c)=> ({ 'Acto seguro':'✅', 'Acto inseguro':'🙅', 'Condición insegura':'⚠️', 'Hallazgo ambiental':'🌱', 'Incidente':'😮', [AT]:'🚑' }[c] || '•');
/* v128: reporte de actos y condiciones (seguridad y ambiental), con su categoría y la acción tomada. */
const OBSERVACION = ['Acto seguro', 'Acto inseguro', 'Condición insegura', 'Hallazgo ambiental'];
const CATEGORIAS = {
  'Seguridad y salud en el trabajo': ['No uso o uso incorrecto de EPP', 'Trabajo sin seguir el procedimiento o permiso de trabajo', 'Intervenir equipos energizados sin bloqueo/etiquetado',
    'Anular guardas o sistemas de seguridad de equipos', 'Manipulación insegura de herramientas o equipos', 'Trabajos en alturas sin protección adecuada',
    'Levantamiento o transporte manual de cargas inadecuado', 'Desorden, obstrucciones, fugas o derrames en el área', 'Superficies resbalosas o irregulares',
    'Señalización, demarcación o dispositivos de emergencia ausentes', 'Conducción / tránsito inseguro dentro de la empresa', 'Comportamiento riesgoso entre compañeros (bromas, empujones, etc.)',
    'Presión por producir ignorando medidas de seguridad'],
  'Ambiental': ['Derrame o fuga de sustancias químicas sin contención ni reporte', 'Disposición incorrecta de residuos peligrosos (RESPEL)', 'Vertimiento de líquidos contaminantes a desagües o suelo',
    'Quema no autorizada de materiales o residuos', 'Emisiones de gases, vapores o partículas sin control', 'Uso excesivo o desperdicio de agua y/o energía sin justificación',
    'Daño a zonas verdes, fauna o flora dentro o alrededor de la empresa']
};
const ACCIONES_TOMADAS = ['Detuvo la tarea', 'Señalizó o aisló el área', 'Prestó primeros auxilios', 'Informó al jefe', 'Informó al Supervisor SSTA', 'No se tomó acción', 'Otros'];
function pintarCategorias(c){
  const grupos = Object.keys(CATEGORIAS), orden = c === 'Hallazgo ambiental' ? grupos.slice().reverse() : grupos;
  $('nCategoria').innerHTML = '<option value="">Elige la categoría</option>' + orden.map((g)=> '<optgroup label="' + esc(g) + '">' + CATEGORIAS[g].map((x)=> '<option>' + esc(x) + '</option>').join('') + '</optgroup>').join('') + '<option>Otros</option>';
  $('nCategoriaOtra').hidden = true; $('nCategoriaOtra').value = '';
}
$('nAccionTomada').innerHTML = ACCIONES_TOMADAS.map((a)=> '<label><input type="checkbox" value="' + esc(a) + '"> <span>' + esc(a) + '</span></label>').join('');
$('nAccionTomada').addEventListener('change', (e)=> {
  const i = e.target; if (!i || i.type !== 'checkbox') return;
  // «No se tomó acción» no va con las demás.
  if (i.checked && i.value === 'No se tomó acción') $('nAccionTomada').querySelectorAll('input').forEach((x)=> { if (x !== i) x.checked = false; });
  else if (i.checked) { const n = $('nAccionTomada').querySelector('input[value="No se tomó acción"]'); if (n) n.checked = false; }
  $('nAccionOtra').hidden = !$('nAccionTomada').querySelector('input[value="Otros"]').checked;
});
$('nCategoria').addEventListener('change', ()=> { $('nCategoriaOtra').hidden = $('nCategoria').value !== 'Otros'; });

async function cargar(){
  if (UI.avisoServidor($('avisoSrv'))) { $('lista').innerHTML = ''; $('btnReportar').disabled = true; return; }
  // Con usuarios, cualquiera puede REPORTAR sin entrar; la lista sí es solo para usuarios.
  const r = await SGSST.listar('reporte,pqrs', { sinPedir: true });
  UI.avisoCopia($('avisoCopia'), r);
  if (r.sinSesion) {
    // v135: sin usuario, la pantalla es solo para reportar: sin cifras, pestañas, buscador ni lista (eso es del área SST).
    $('avisoCopia').innerHTML = '<p class="u-nota" style="margin:0 0 12px;">Cuenta qué viste: un acto, una condición insegura, un incidente o una PQRS. No necesitas usuario.</p>';
    ['kpis', 'pendLegales', 'tabs', 'filtroActivo', 'buscar', 'lista'].forEach((id) => { if ($(id)) $(id).style.display = 'none'; });
    $('btnReportar').style.minHeight = '64px';
    const h1 = document.querySelector('.hdr h1'), ey = document.querySelector('.hdr .eyebrow'), sub = h1 && h1.nextElementSibling;
    if (h1) h1.textContent = 'Reportar'; if (ey) ey.textContent = 'Sin usuario'; if (sub) sub.textContent = 'Lo que viste en el trabajo: actos, condiciones, incidentes o PQRS';
    $('btnReportar').insertAdjacentHTML('afterend', '<p class="u-nota" style="text-align:center;margin:4px 0 12px;">¿Eres del área SST o supervisor? <button type="button" class="btn-mini" id="btnEntrarRep">Entra para ver los reportes</button></p>');
  }
  if ($('btnEntrarRep')) $('btnEntrarRep').addEventListener('click', ()=> Sesion.pedir());
  conLista = !r.sinSesion;
  filas = r.rows.filter((x)=> x.tipo !== 'pqrs'); pqrs = r.rows.filter((x)=> x.tipo === 'pqrs');
  pintar();
}
/* ── Lo que falta (cifras clicables → lista filtrada) ── */
const invPend = (x)=> { const s = x.resumen; return (s.clase === AT || s.clase === 'Incidente') && (s.investigacion || {}).estado !== 'CERRADA'; };   // v148: cerrar el reporte no borra la deuda
const graveAT = (x)=> x.resumen.clase === AT && (x.resumen.grave || x.resumen.mortal);
const mtPend = (x)=> graveAT(x) && !(x.resumen.mintrabajo || {}).fecha;
const arlPend = (x)=> graveAT(x) && (x.resumen.investigacion || {}).estado === 'CERRADA' && !(x.resumen.remisionArl || {}).fecha;
const invVencida = (x)=> invPend(x) && Festivos.sumarDias(x.resumen.fecha, 15) < UI.hoy();
const furatPend = (x)=> x.resumen.clase === AT && !(x.resumen.furat || {}).radicado;
const sinAccion = (x)=> x.estado !== 'CERRADO' && !Number(x.resumen.acciones);
const pqAbierta = (x)=> x.estado === 'ABIERTA';
const pqVencida = (x)=> pqAbierta(x) && x.resumen.fechaLimite && x.resumen.fechaLimite < UI.hoy();
const FILTROS = { sinaccion: ['Abiertos sin acciones', sinAccion], sininvestigar: ['Investigaciones pendientes', invPend], invvencida: ['Investigaciones vencidas', invVencida],
  furat: ['FURAT por radicar', furatPend], mintrabajo: ['Reporte al Ministerio pendiente (AT grave o mortal)', mtPend], remisionarl: ['Investigación por enviar a la ARL (grave o mortal)', arlPend], pqrsabiertas: ['PQRS abiertas', pqAbierta, true], pqrsvencidas: ['PQRS vencidas', pqVencida, true] };
window.filtrarKpi = (f)=> { filtro = FILTROS[f] ? f : ''; pintar(); };
function pintarKpis(){
  if (!conLista) { $('kpis').innerHTML = ''; return; }
  const sa = filas.filter(sinAccion), ab = filas.filter((x)=> x.estado !== 'CERRADO'), ip = filas.filter(invPend), iv = filas.filter(invVencida), fp = filas.filter(furatPend),
    fv = fp.filter((x)=> Festivos.sumarHabiles(x.resumen.fecha, 2) < UI.hoy()), pa = pqrs.filter(pqAbierta), pv = pqrs.filter(pqVencida);
  const k = (c, v, n, f, ir)=> '<div class="kpi ' + c + '" data-ir="' + ir + '"><div class="v">' + v + '</div><div class="n">' + n + '</div><div class="f">' + f + '</div></div>';
  $('kpis').innerHTML = k(sa.length ? 'pronto' : 'ok', sa.length, 'reportes abiertos sin acciones', 'de ' + ab.length + ' abierto(s)', 'tab:todos|filtro:sinaccion') +
    k(iv.length ? 'mal' : ip.length ? 'pronto' : 'ok', ip.length, 'investigaciones pendientes', iv.length + ' vencida(s) · plazo 15 días', 'tab:todos|filtro:' + (iv.length ? 'invvencida' : 'sininvestigar')) +
    k(fv.length ? 'mal' : fp.length ? 'pronto' : 'ok', fp.length, 'FURAT por radicar a la ARL', fv.length + ' vencido(s) · plazo 2 días hábiles', 'tab:todos|filtro:furat') +
    (filas.some(graveAT) ? k(filas.filter(mtPend).length ? 'mal' : 'ok', filas.filter(mtPend).length, 'reportes al Ministerio pendientes', 'AT grave o mortal · 2 días hábiles', 'tab:todos|filtro:mintrabajo') +
      k(filas.filter(arlPend).length ? 'pronto' : 'ok', filas.filter(arlPend).length, 'investigaciones por enviar a la ARL', 'grave o mortal · 15 días', 'tab:todos|filtro:remisionarl') : '') +
    k(pv.length ? 'mal' : pa.length ? 'pronto' : 'ok', pa.length, 'PQRS abiertas', pv.length + ' vencida(s) · plazo ' + DIAS_PQRS + ' días hábiles', 'tab:pqrs|filtro:' + (pv.length ? 'pqrsvencidas' : 'pqrsabiertas'));
}
function ponerTab(t){ tab = t; document.querySelectorAll('#tabs button').forEach((x)=> x.classList.toggle('on', x.dataset.tab === t)); }
/* PQRS: se listan aquí y se gestionan (respuesta, plazo, acción) en Calidad → PQRS. */
function pintarPqrs(q){
  let l = pqrs.slice();
  if (filtro && FILTROS[filtro][2]) l = l.filter(FILTROS[filtro][1]);
  if (q) l = l.filter((x)=> UI.norm([x.resumen.cliente, x.resumen.descripcion, x.resumen.area, x.resumen.presenta, x.resumen.tipoPQRS, x.id].join(' ')).includes(q));
  l.sort((a, b)=> (a.estado !== 'ABIERTA') - (b.estado !== 'ABIERTA') || (pqVencida(b) - pqVencida(a)) || String(a.resumen.fechaLimite || '').localeCompare(String(b.resumen.fechaLimite || '')));
  $('lista').innerHTML = '<div class="acciones-top"><button type="button" class="btn amber" id="btnNuevaPqrs">+ Registrar una PQRS</button><a class="btn ghost" href="calidad.html#PQRS">Responder en Calidad → PQRS</a></div>' +
    (l.length ? l.map((x)=> { const s = x.resumen, venc = pqVencida(x), c = x.estado !== 'ABIERTA' ? 'ok' : venc ? 'mal' : 'pronto';
      return '<a class="item ' + c + '" href="calidad.html#' + encodeURIComponent(x.id) + '"><div class="fila"><div><div class="t">' + (ICONO_PQRS[s.tipoPQRS] || '💬') + ' ' + esc(s.tipoPQRS || 'PQRS') + ' · ' + esc(s.cliente || '') + '</div>' +
        '<div class="m">' + esc(s.descripcion || '') + '</div><div class="m">' + esc(x.id) + ' · ' + esc(UI.corta(s.fecha)) + (s.presenta ? ' · ' + esc(s.presenta) : '') + (s.area ? ' · ' + esc(s.area) : '') +
        (x.estado === 'ABIERTA' && s.fechaLimite ? ' · ' + (venc ? '<b>venció el ' : 'responder antes del ') + esc(UI.corta(s.fechaLimite)) + (venc ? '</b>' : '') : '') + (x.pendiente ? ' · <span class="pend">⏳ pendiente de enviar</span>' : '') + '</div></div>' +
        '<span class="chip ' + c + '">' + (venc ? 'Vencida' : x.estado === 'ABIERTA' ? 'Abierta' : x.estado === 'RESPONDIDA' ? 'Respondida' : 'Cerrada') + '</span></div></a>'; }).join('')
      : '<div class="empty">' + (pqrs.length ? 'Ninguna PQRS en esta lista.' : 'Todavía no hay PQRS. Cualquiera puede presentarla desde «Reportar ahora» → PQRS, sin usuario.') + '</div>');
  $('btnNuevaPqrs').addEventListener('click', ()=> { nuevo(); ponerClase(PQ); });
}
function pintar(){
  const q = UI.norm($('buscar').value).trim();
  const ab = filas.filter((x)=> x.estado !== 'CERRADO');
  $('nAb').textContent = ab.length; $('nAt').textContent = filas.filter((x)=> x.resumen.clase === AT).length; $('nTo').textContent = filas.length; $('nPq').textContent = pqrs.filter(pqAbierta).length;
  const invs = filas.filter((x)=> x.resumen.clase === AT || x.resumen.clase === 'Incidente'); $('nInv').textContent = invs.filter(invPend).length || invs.length;
  pintarKpis();
  if (filtro && !!FILTROS[filtro][2] !== (tab === 'pqrs')) filtro = '';   // un filtro de reportes no aplica a las PQRS (ni al revés)
  $('filtroActivo').innerHTML = filtro ? '<div class="filtro-activo"><span>Mostrando: ' + esc(FILTROS[filtro][0]) + '</span><button type="button" id="quitarFiltro">Quitar filtro ✕</button></div>' : '';
  if ($('quitarFiltro')) $('quitarFiltro').addEventListener('click', ()=> { filtro = ''; pintar(); });
  // Lo legal pendiente, arriba y en rojo.
  const pend = [];
  filas.forEach((x)=> plazos(x).forEach((p)=>{ if (p.c !== 'ok') pend.push({ x, p }); }));
  $('pendLegales').innerHTML = pend.map(({ x, p })=> '<button type="button" class="plazo ' + p.c + '" data-id="' + esc(x.id) + '" style="width:100%;text-align:left;cursor:pointer;font-family:inherit;"><b>' + esc(p.t) + '</b>' + esc(x.resumen.clase + ' · ' + UI.corta(x.resumen.fecha) + ' · ' + (x.resumen.lesionado || x.resumen.lugar || '')) + '</button>').join('');
  if (tab === 'pqrs') { pintarPqrs(q); return; }
  if (tab === 'investigaciones') { pintarInvestigaciones(q); return; }
  let l = tab === 'abiertos' ? ab : tab === 'accidentes' ? filas.filter((x)=> x.resumen.clase === AT) : filas.slice();
  if (filtro) l = l.filter(FILTROS[filtro][1]);
  if (q) l = l.filter((x)=> UI.norm([x.resumen.lugar, x.resumen.descripcion, x.resumen.lesionado, x.resumen.reportadoPor, x.resumen.centro].join(' ')).includes(q));
  l.sort((a, b)=> String(b.resumen.fecha + b.resumen.hora).localeCompare(String(a.resumen.fecha + a.resumen.hora)));
  $('lista').innerHTML = l.length ? l.map((x)=>{
    const s = x.resumen, pl = plazos(x), c = x.estado === 'CERRADO' ? 'gris' : pl.some((p)=> p.c === 'mal') ? 'mal' : (s.clase === AT || s.potencial === 'Alto') ? 'pronto' : 'ok';
    return '<button type="button" class="item ' + c + '" data-id="' + esc(x.id) + '"><div class="fila"><div><div class="t">' + iconoClase(s.clase) + ' ' + esc(s.clase) + (s.lugar ? ' · ' + esc(s.lugar) : '') + '</div>' + (s.categoria ? '<div class="m"><b>' + esc(s.categoria) + '</b></div>' : '') +
      '<div class="m">' + esc(s.descripcion) + '</div><div class="m">' + esc(UI.corta(s.fecha)) + (s.hora ? ' ' + esc(s.hora) : '') + (s.reportadoPor ? ' · ' + esc(s.reportadoPor) : '') +
      (s.fotos ? ' · 📷 ' + s.fotos : '') + (s.acciones ? ' · ' + s.acciones + ' acción(es)' : '') + (x.pendiente ? ' · <span class="pend">⏳ pendiente de enviar</span>' : '') + '</div></div>' +
      '<span class="chip ' + (x.estado === 'CERRADO' ? '' : c) + '">' + esc(x.estado === 'CERRADO' ? 'Cerrado' : (s.potencial ? 'Potencial ' + s.potencial.toLowerCase() : 'Abierto')) + '</span></div></button>';
  }).join('') : '<div class="empty">' + (filas.length ? 'Nada en esta lista.' : 'Todavía no hay reportes. Cada acto o condición insegura reportado a tiempo es un accidente que no pasa.') + '</div>';
}

/* v161 · Investigación de accidentes: todos los accidentes e incidentes con el estado de su investigación,
   el plazo de 15 días y el acceso directo a investigarlos o a sacar el formato. */
function pintarInvestigaciones(q){
  let l = filas.filter((x)=> x.resumen.clase === AT || x.resumen.clase === 'Incidente');
  if (q) l = l.filter((x)=> UI.norm([x.resumen.lugar, x.resumen.descripcion, x.resumen.lesionado].join(' ')).includes(q));
  const est = (x)=> (x.resumen.investigacion || {}).estado || 'PENDIENTE';
  l.sort((a, b)=> (est(a) === 'CERRADA') - (est(b) === 'CERRADA') || String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
  $('lista').innerHTML = '<div class="aviso">Para investigar un accidente primero se reporta (con los datos del FURAT). <button type="button" class="btn-mini" id="btnNuevoAt">⚠️ Reportar un accidente o incidente</button></div>' +
    (l.length ? l.map((x)=> { const s = x.resumen, e = est(x), lim = Festivos.sumarDias(s.fecha, 15), venc = e !== 'CERRADA' && lim < UI.hoy();
      const c = e === 'CERRADA' ? 'ok' : venc ? 'mal' : 'pronto';
      return '<button type="button" class="item ' + c + '" data-id="' + esc(x.id) + '" data-inv="1"><div class="fila"><div><div class="t">' + iconoClase(s.clase) + ' ' + esc(s.clase) + (s.lesionado ? ' · ' + esc(s.lesionado) : '') + '</div>' +
        '<div class="m">' + esc(UI.corta(s.fecha)) + (s.lugar ? ' · ' + esc(s.lugar) : '') + ' · ' + esc(s.descripcion) + '</div>' +
        '<div class="m">' + (e === 'CERRADA' ? 'Terminada el ' + esc(UI.corta((s.investigacion || {}).fecha || '')) : (venc ? '<b class="u-mal">Plazo vencido el ' : 'Plazo: ') + esc(UI.corta(lim)) + (venc ? '</b>' : '')) + '</div></div>' +
        '<span class="chip ' + c + '">' + esc(e === 'CERRADA' ? 'Investigada' : e === 'EN CURSO' ? 'En curso' : 'Por investigar') + '</span></div></button>'; }).join('')
      : '<div class="empty">No hay accidentes ni incidentes reportados.</div>');
  $('btnNuevoAt').addEventListener('click', ()=> { nuevo(); ponerClase(AT); });
}

/* ── Nuevo reporte ── */
function ponerClase(c){
  clase = c;
  document.querySelectorAll('#clases button').forEach((b)=> b.classList.toggle('on', b.dataset.c === c));
  Valida.limpiar($('scrNuevo')); $('msgNuevo').innerHTML = '';
  const esPq = c === PQ;
  $('cardPqrs').hidden = !esPq; $('cardEvento').hidden = $('cardQuien').hidden = esPq;
  $('btnEnviar').textContent = esPq ? 'Enviar PQRS' : 'Enviar reporte'; $('nTitulo').textContent = esPq ? 'Nueva PQRS' : 'Nuevo reporte';
  $('cardLesion').hidden = c !== AT;
  const obs = OBSERVACION.indexOf(c) !== -1, conAnon = ['Acto inseguro', 'Condición insegura', 'Hallazgo ambiental'].indexOf(c) !== -1;
  $('filaAnonimo').style.display = conAnon ? '' : 'none';
  if (!conAnon) $('nAnonimo').checked = false;
  // v128: actos y condiciones (seguridad y ambiental): categoría, acción tomada, relacionados, plan y consecuencias.
  // v151: incidente y accidente llevan los mismos cuadros que los actos y condiciones (la categoría es solo de observaciones);
  // la acción inmediata siempre se marca con las mismas casillas, para que se vea igual en todos los reportes.
  const amplio = (obs || c === 'Incidente' || c === AT) && c !== 'Acto seguro';
  $('filaCategoria').hidden = !obs || c === 'Acto seguro'; $('filaRelacionados').hidden = !(obs || amplio);
  $('filaAccionTomada').hidden = !amplio; $('filaInmediataTxt').hidden = true;
  $('filaPlan').hidden = $('filaConsecuencias').hidden = !amplio;
  // v129: el acto seguro no lleva potencial de daño ni campo de reconocimiento.
  $('filaPot').hidden = c === 'Acto seguro'; if (c === 'Acto seguro') $('filaInmediataTxt').hidden = true;
  if (obs) pintarCategorias(c);

}
function nuevo(){
  const ahora = new Date(); ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  $('nFecha').value = ahora.toISOString().slice(0, 10); $('nHora').value = ahora.toISOString().slice(11, 16);
  ['nLugar', 'nCentro', 'nDesc', 'nInmediata', 'lNombre', 'lCedula', 'lCargo', 'nRelacionados', 'nPlan', 'nConsecuencias', 'nAccionOtra', 'nCategoriaOtra'].forEach((id)=> $(id).value = '');
  $('nAccionTomada').querySelectorAll('input').forEach((x)=> { x.checked = false; }); $('nAccionOtra').hidden = true;
  ['lParte', 'lTipo', 'lMecanismo', 'lAgente'].forEach((id)=> $(id).value = '');
  $('lGrave').checked = $('lMortal').checked = $('nAnonimo').checked = false;
  $('lAtencion').selectedIndex = 0;
  $('nPot').querySelectorAll('button').forEach((x)=> x.classList.toggle('on', x.dataset.v === 'Medio'));
  try { $('nQuien').value = localStorage.getItem('ssta-reporta') || ''; $('nLugar').value = localStorage.getItem('ssta-reporta-lugar') || ''; } catch (e) {}
  fotosNuevo = UI.fotos($('nFotos'), { max: 4 });
  // PQRS
  ['pEmpresa', 'pNombre', 'pContacto', 'pArea', 'pDesc'].forEach((id)=> $(id).value = '');
  $('pAnonima').checked = false; $('pDatos').hidden = false;
  $('pTipo').querySelectorAll('button').forEach((x)=> x.classList.remove('on')); $('pPresenta').querySelectorAll('button').forEach((x)=> x.classList.remove('on'));
  $('pTipoAyuda').textContent = 'Elige una opción.'; $('pFilaEmpresa').hidden = true;
  fotosPqrs = UI.fotos($('pFotos'), { max: 2 });
  $('pPlazo').textContent = 'Plazo para responder: ' + DIAS_PQRS + ' días hábiles (a más tardar el ' + UI.corta(Festivos.sumarHabiles(UI.hoy(), DIAS_PQRS)) + ').';
  ponerClase(''); $('msgNuevo').textContent = '';
  show('scrNuevo');
}
/* v129: solo los tipos de reporte que la empresa ofrece (consola → Menús → Tipos de reporte). */
(function(){
  const ve = (t)=> typeof Empresa === 'undefined' || !Empresa.visible || Empresa.visible('reportes', t);
  document.querySelectorAll('#clases [data-c]').forEach((b)=> { if (!ve(b.dataset.c)) b.hidden = true; });
  if (!ve('Accidente de trabajo')) { const t = document.querySelector('#tabs [data-tab="accidentes"]'); if (t) t.hidden = true; }
  if (!ve('PQRS')) { const t = document.querySelector('#tabs [data-tab="pqrs"]'); if (t) t.hidden = true; }
})();
$('clases').addEventListener('click', (e)=>{ const b = e.target.closest('[data-c]'); if (b) ponerClase(b.dataset.c); });
$('nPot').addEventListener('click', (e)=>{ const b = e.target.closest('[data-v]'); if (!b) return; $('nPot').querySelectorAll('button').forEach((x)=> x.classList.toggle('on', x === b)); });
/* PQRS: una sola opción por grupo; la empresa solo para cliente o contratista; anónima oculta los datos. */
function unaSola(cont, alElegir){ cont.addEventListener('click', (e)=>{ const b = e.target.closest('[data-v]'); if (!b) return; cont.querySelectorAll('button').forEach((x)=> x.classList.toggle('on', x === b)); if (alElegir) alElegir(b.dataset.v); }); }
const elegido = (cont)=> ((cont.querySelector('button.on') || {}).dataset || {}).v || '';
unaSola($('pTipo'), (v)=> { $('pTipoAyuda').textContent = AYUDA_TIPO[v] || ''; });
unaSola($('pPresenta'), (v)=> { $('pFilaEmpresa').hidden = !(v === 'Cliente' || v === 'Contratista'); });
$('pAnonima').addEventListener('change', ()=> { $('pDatos').hidden = $('pAnonima').checked; });
UI.autocompletar($('nQuien'), (p)=> { $('nQuien').value = p.nombre; });
UI.autocompletar($('lNombre'), (p)=> { $('lNombre').value = p.nombre; $('lCedula').value = p.cedula || ''; $('lCargo').value = p.cargo || ''; });

$('btnEnviar').addEventListener('click', async ()=>{
  const msg = $('msgNuevo');
  // v143: sin tipo elegido se dicen TODOS los faltantes de una vez (antes salían de a uno en cada intento)
  if (!clase) { Valida.revisar($('scrNuevo'), [{ el: $('clases'), etiqueta: 'Qué vas a reportar', error: 'elige una opción (arriba)' },
    { el: $('nDesc'), etiqueta: '¿Qué sucedió?', error: ()=> Valida.texto($('nDesc').value, 10) === 'falta' ? 'cuenta qué pasó' : '' },
    { el: $('nQuien'), etiqueta: 'Quién reporta', error: ()=> $('nAnonimo').checked || $('nQuien').value.trim().length >= 3 ? '' : 'escribe tu nombre o marca «Reportar sin dar mi nombre»' }], msg); window.scrollTo(0, 0); try { $('clases').querySelector('button,input').focus(); } catch (e) {} return; }
  if (clase === PQ) { enviarPqrs(); return; }
  const anonimo = $('nAnonimo').checked;
  // v109: dice QUÉ falta y marca cada campo.
  const problemas = Valida.revisar($('scrNuevo'), [
    { el: $('nFecha'), etiqueta: 'Fecha', error: ()=> Valida.pasada($('nFecha').value) },
    { el: $('nCategoria'), etiqueta: 'Categoría del acto o condición', error: ()=> $('filaCategoria').hidden ? '' : (!$('nCategoria').value ? 'elige una categoría' : ($('nCategoria').value === 'Otros' && !$('nCategoriaOtra').value.trim() ? 'escribe cuál' : '')) },
    { el: $('nDesc'), etiqueta: '¿Qué sucedió?', error: ()=> { const e = Valida.texto($('nDesc').value, 10); return e === 'es muy corto' ? 'cuenta un poco más (qué, dónde y cómo)' : e; } },
    { el: $('nRelacionados'), etiqueta: 'Persona(s), equipo(s), máquina(s) o instalaciones relacionadas', error: ()=> $('filaRelacionados').hidden ? '' : (Valida.texto($('nRelacionados').value, 3) === 'falta' ? 'escribe a quién o a qué se refiere' : '') },
    { el: $('nAccionTomada'), etiqueta: 'Acción inmediata tomada', error: ()=> $('filaAccionTomada').hidden ? '' : (!$('nAccionTomada').querySelector('input:checked') ? 'marca una opción' : ($('nAccionTomada').querySelector('input[value="Otros"]:checked') && !$('nAccionOtra').value.trim() ? 'escribe cuál otra' : '')) },
    { el: $('lNombre'), etiqueta: 'Persona lesionada', error: ()=> clase === AT ? Valida.texto($('lNombre').value, 3) : '' },
    { el: $('lCedula'), etiqueta: 'Cédula del lesionado', error: ()=> clase === AT && $('lCedula').value.trim() ? Valida.cedula($('lCedula').value) : '' },
    { el: $('nQuien'), etiqueta: 'Quién reporta', error: ()=> anonimo ? '' : (Valida.texto($('nQuien').value, 3) === 'falta' ? 'escribe tu nombre o marca «Reportar sin dar mi nombre»' : Valida.texto($('nQuien').value, 3)) }
  ], msg);
  if (problemas.length) return;
  const doc = { clase, fecha: $('nFecha').value, hora: $('nHora').value, lugar: $('nLugar').value.trim(), centro: $('nCentro').value.trim(),
    descripcion: $('nDesc').value.trim(), fotos: fotosNuevo.get(), potencial: ($('nPot').querySelector('.on') || {}).dataset.v || 'Medio',
    accionInmediata: $('nInmediata').value.trim(), anonimo, reportadoPor: anonimo ? '' : $('nQuien').value.trim(), estado: clase === 'Acto seguro' ? 'CERRADO' : 'ABIERTO', acciones: [] };
  if (OBSERVACION.indexOf(clase) !== -1 || clase === 'Incidente' || clase === AT) {
    Object.assign(doc, { relacionados: $('nRelacionados').value.trim() });
    if (clase !== 'Acto seguro') {
      const tomadas = [...$('nAccionTomada').querySelectorAll('input:checked')].map((x)=> x.value);
      Object.assign(doc, { categoria: $('nCategoria').value, categoriaOtra: $('nCategoria').value === 'Otros' ? $('nCategoriaOtra').value.trim() : '',
        accionTomada: tomadas, accionTomadaOtra: tomadas.indexOf('Otros') !== -1 ? $('nAccionOtra').value.trim() : '',
        planSugerido: $('nPlan').value.trim(), consecuencias: $('nConsecuencias').value.trim() });
      doc.accionInmediata = tomadas.filter((x)=> x !== 'Otros').concat(doc.accionTomadaOtra ? [doc.accionTomadaOtra] : []).join(', ');
    }
  }
  if (clase === AT) {
    doc.lesionado = { nombre: $('lNombre').value.trim(), cedula: $('lCedula').value.trim(), cargo: $('lCargo').value.trim(), parteCuerpo: $('lParte').value,
      tipoLesion: $('lTipo').value, mecanismo: $('lMecanismo').value, agente: $('lAgente').value, atencion: $('lAtencion').value };
    doc.grave = $('lGrave').checked; doc.mortal = $('lMortal').checked; doc.diasIncapacidad = 0; doc.diasCargados = 0; doc.furat = { radicado: false };
  }
  if (clase === AT || clase === 'Incidente') doc.investigacion = { estado: 'PENDIENTE' };
  if (!anonimo) try { localStorage.setItem('ssta-reporta', doc.reportadoPor); } catch (e) {}
  try { if (doc.lugar) localStorage.setItem('ssta-reporta-lugar', doc.lugar); } catch (e) {}
  const id = SGSST.nuevoId('REP');
  $('btnEnviar').disabled = true; msg.textContent = 'Enviando…';
  const res = { clase, categoria: doc.categoria || '', fecha: doc.fecha, hora: doc.hora, lugar: doc.lugar, centro: doc.centro, descripcion: doc.descripcion.slice(0, 160), potencial: doc.potencial,
    reportadoPor: anonimo ? 'Anónimo' : doc.reportadoPor, lesionado: doc.lesionado ? doc.lesionado.nombre : '', fotos: doc.fotos.length, furat: { radicado: false }, investigacion: doc.investigacion || {}, mortal: !!doc.mortal, grave: !!doc.grave };
  const r = await SGSST.enviar({ action:'guardar', tipo:'reporte', id, doc }, { estado: doc.estado, fecha: doc.fecha, resumen: res });
  $('btnEnviar').disabled = false;
  if (!r.ok) { msg.textContent = Errores.texto('envió', r); return; }
  filas.unshift({ id, tipo:'reporte', estado: doc.estado, fecha: doc.fecha, resumen: r.resumen || res, pendiente: !!r.enCola });
  UI.toast(r.enCola ? '⏳ Reporte guardado en el equipo: se envía al volver la señal.' : '✓ Reporte enviado. ¡Gracias por reportar!');
  // v143: quien reporta sin usuario ve una pantalla de gracias con su código (no la ficha del área SST)
  let conUsuarios = false; try { conUsuarios = typeof Sesion !== 'undefined' && localStorage.getItem(Sesion.KEY_MODO) === '1'; } catch (e) {}
  if (conUsuarios && !Sesion.token()) {
    $('gCodigo').textContent = id; $('gTitulo').textContent = 'Tu reporte quedó registrado';
    const eb = document.querySelector('#scrGracias .eyebrow'), sub = document.querySelector('#scrGracias .hdr p'); if (eb) eb.textContent = 'Reporte'; if (sub) sub.textContent = 'Recibimos tu reporte';
    $('gPlazo').innerHTML = (r.enCola ? '⏳ <b>Quedó guardado en este equipo</b> y se envía solo cuando vuelva la señal.<br>' : '') + 'El encargado de seguridad lo revisará. Guarda el código si quieres preguntar por él.';
    show('scrGracias'); try { $('gTitulo').setAttribute('tabindex', '-1'); $('gTitulo').focus(); } catch (e) {}
    return;
  }
  actual = Object.assign({ id, version: r.version || 1 }, doc);
  pintarDetalle();
  show('scrDetalle');
});

/* ── PQRS: se guarda como el registro «pqrs» de Calidad (sin usuario: el servidor la limpia y solo la crea) ── */
async function enviarPqrs(){
  const msg = $('msgNuevo'), anon = $('pAnonima').checked, contacto = $('pContacto').value.trim();
  const problemas = Valida.revisar($('scrNuevo'), [
    { el: $('pTipo'), etiqueta: '¿Qué es?', error: ()=> elegido($('pTipo')) ? '' : 'elige petición, queja, reclamo, sugerencia o felicitación' },
    { el: $('pPresenta'), etiqueta: '¿Quién la presenta?', error: ()=> elegido($('pPresenta')) ? '' : 'elige una opción' },
    { el: $('pNombre'), etiqueta: 'Tu nombre', error: ()=> !anon && $('pNombre').value.trim() && /\d/.test($('pNombre').value) ? 'no puede llevar números' : '' },
    { el: $('pContacto'), etiqueta: 'Correo o teléfono', error: ()=> { if (anon || !contacto) return ''; if (/@/.test(contacto)) return Valida.correoMal(contacto) ? 'el correo no es válido' : ''; return contacto.replace(/\D/g, '').length < 7 ? 'escribe un correo o un teléfono completo' : ''; } },
    { el: $('pDesc'), etiqueta: 'Qué pasa o qué propones', error: ()=> { const e = Valida.texto($('pDesc').value, 15); return e === 'es muy corto' ? 'cuéntanos un poco más (mínimo una frase)' : e; } }
  ], msg);
  if (problemas.length) return;
  const tipo = elegido($('pTipo')), presenta = elegido($('pPresenta')), hoy = UI.hoy(), lim = Festivos.sumarHabiles(hoy, DIAS_PQRS);
  const nombre = anon ? '' : $('pNombre').value.trim(), empresa = anon || $('pFilaEmpresa').hidden ? '' : $('pEmpresa').value.trim();
  const doc = { publica: true, fecha: hoy, tipoPQRS: tipo, presenta, anonima: anon, nombre, empresa, contacto: anon ? '' : contacto, area: $('pArea').value.trim(),
    descripcion: $('pDesc').value.trim(), fotos: fotosPqrs.get(), canal: 'Portal (Reportar un evento)', procede: 'Por analizar', estado: 'ABIERTA', fechaLimite: lim, limiteAuto: lim };
  const cliente = empresa || nombre || 'Anónimo (' + presenta.toLowerCase() + ')', id = SGSST.nuevoId('PQR');
  const res = { fecha: hoy, cliente, tipoPQRS: tipo, presenta, area: doc.area, descripcion: doc.descripcion.slice(0, 400), canal: doc.canal, fechaLimite: lim, procede: 'Por analizar', estado: 'ABIERTA', nFotos: doc.fotos.length };
  $('btnEnviar').disabled = true; msg.textContent = 'Enviando…';
  const r = await SGSST.enviar({ action: 'guardar', tipo: 'pqrs', id, doc }, { estado: 'ABIERTA', fecha: hoy, titulo: cliente, resumen: res });
  $('btnEnviar').disabled = false;
  if (!r.ok) { msg.textContent = Errores.texto('envió', r); return; }
  msg.textContent = '';
  pqrs.unshift({ id, tipo: 'pqrs', estado: 'ABIERTA', fecha: hoy, resumen: r.resumen || res, pendiente: !!r.enCola });
  $('gCodigo').textContent = id;
  $('gTitulo').textContent = 'Tu PQRS (' + tipo.toLowerCase() + ') quedó registrada';
  $('gPlazo').innerHTML = (r.enCola ? '⏳ <b>Quedó guardada en este equipo</b> y se envía sola cuando vuelva la señal.<br>' : '') +
    (/Felicitación|Sugerencia/.test(tipo) ? 'El área encargada la revisará' : 'El área encargada debe responder a más tardar el <b>' + esc(UI.corta(lim)) + '</b> (' + DIAS_PQRS + ' días hábiles)') +
    (anon ? '. Como es anónima, pregunta por ella con el código.' : contacto ? '. Te responderemos a: ' + esc(contacto) + '.' : '. No dejaste contacto: pregunta por ella con el código.');
  show('scrGracias');
}
$('gCopiar').addEventListener('click', async ()=> { const t = $('gCodigo').textContent; try { await navigator.clipboard.writeText(t); UI.toast('✓ Código copiado'); } catch (e) { UI.toast('Mantén presionado el código para copiarlo.'); } });
$('gOtra').addEventListener('click', ()=> nuevo());

/* ── Detalle ── */
async function abrir(id){
  const fila = filas.find((x)=> x.id === id);
  $('dTitulo').textContent = fila ? fila.resumen.clase : 'Reporte';
  $('dDatos').innerHTML = '<div class="status-msg">Abriendo…</div>';
  $('dFurat').hidden = $('dInv').hidden = true; $('dPlazos').innerHTML = '';
  show('scrDetalle');
  const d = await SGSST.doc(id);
  if (!d) { $('dDatos').innerHTML = '<div class="aviso">No se pudo abrir el reporte' + (fila && fila.pendiente ? ' (todavía está pendiente de enviar desde este equipo)' : '') + '. Revisa la conexión.</div>'; return; }
  actual = d; pintarDetalle();
}
function dato(et, v){ return v ? '<div class="dato"><span>' + esc(et) + '</span><b>' + esc(v) + '</b></div>' : ''; }
function pintarDetalle(){
  const d = actual;
  $('dCodigo').textContent = d.id + (d.estado === 'CERRADO' ? ' · CERRADO' : '');
  $('dTitulo').textContent = iconoClase(d.clase) + ' ' + d.clase;
  $('dSub').textContent = UI.corta(d.fecha) + (d.hora ? ' ' + d.hora : '') + (d.lugar ? ' · ' + d.lugar : '');
  $('dPlazos').innerHTML = plazos(d).map((p)=> '<div class="plazo ' + p.c + '"><b>' + esc(p.t) + '</b>' + esc(p.d) + '</div>').join('');
  const l = d.lesionado || {};
  $('dDatos').innerHTML = '<h2>Reporte</h2><div class="texto-largo">' + esc(d.descripcion) + '</div>' +
    (d.fotos && d.fotos.length ? '<div class="fotos u-mt10">' + d.fotos.map(UI.src).filter(Boolean).map((f)=> '<div class="f"><img src="' + f + '" alt="Foto"></div>').join('') + '</div>' : '') +
    '<div class="u-mt8">' + dato('Categoría', d.categoria === 'Otros' ? 'Otros: ' + (d.categoriaOtra || '') : d.categoria) + dato('Relacionados', d.relacionados) + dato('Centro de costo', d.centro) + dato('Potencial', d.potencial) + dato('Acción inmediata', d.accionInmediata) + dato('Plan de acción sugerido', d.planSugerido) + dato('Consecuencias que se evitan', d.consecuencias) + dato('Reportado por', d.anonimo ? 'Anónimo' : d.reportadoPor) +
    (d.clase === AT ? dato('Lesionado', [l.nombre, l.cedula && 'C.C. ' + l.cedula, l.cargo].filter(Boolean).join(' · ')) + dato('Parte del cuerpo', l.parteCuerpo) + dato('Tipo de lesión', l.tipoLesion) +
      dato('Mecanismo', l.mecanismo) + dato('Agente', l.agente) + dato('Atención', l.atencion) + dato('Gravedad', d.mortal ? 'MORTAL' : d.grave ? 'Grave' : 'Leve') : '') + '</div>' +
    (d.cierre && d.cierre.fecha ? '<div class="aviso ok u-mt10">Cerrado el ' + esc(UI.corta(d.cierre.fecha)) + (d.cierre.nota ? ': ' + esc(d.cierre.nota) : '') + '</div>' : '');
  // FURAT e incapacidad (solo accidentes)
  if (d.clase === AT) {
    const f = d.furat || {};
    $('dFurat').hidden = false;
    $('dFurat').innerHTML = '<h2>Reporte a la ARL e incapacidad</h2>' +
      '<div class="grid2"><div class="field"><label>FURAT radicado el</label><input type="date" id="fFecha" value="' + esc(f.fecha || '') + '"></div>' +
      '<div class="field"><label>N.º de radicado</label><input type="text" id="fNumero" value="' + esc(f.numero || '') + '"></div></div>' +
      '<div class="grid2"><div class="field"><label>Días de incapacidad</label><input type="number" min="0" id="fDias" value="' + esc(d.diasIncapacidad || 0) + '"></div>' +
      '<div class="field"><label>Días cargados</label><input type="number" min="0" id="fCargados" value="' + esc(d.diasCargados || (d.mortal ? 6000 : 0)) + '"><div class="ayuda">Por muerte o secuelas permanentes (tabla de días cargados, ANSI Z16.1 / NTC 3701: muerte = 6.000). 0 si no aplica.</div></div></div>' +
      '<div class="grid2"><div class="field"><label><input type="checkbox" id="fGrave"' + (d.grave ? ' checked' : '') + '> Accidente grave (Res. 1401 de 2007, art. 3)</label></div><div class="field"><label><input type="checkbox" id="fMortal"' + (d.mortal ? ' checked' : '') + '> Accidente mortal</label><div class="ayuda">SST corrige la gravedad cuando llega el diagnóstico; queda en el historial.</div></div></div>' +
      ((d.grave || d.mortal) ? '<h3 class="u-mt8">Accidente ' + (d.mortal ? 'mortal' : 'grave') + '</h3>' +
        '<div class="grid2"><div class="field"><label for="mtFecha">Reportado al Ministerio del Trabajo el</label><input type="date" id="mtFecha" value="' + esc((d.mintrabajo || {}).fecha || '') + '"><div class="ayuda">Dirección Territorial, 2 días hábiles.</div></div>' +
        '<div class="field"><label for="mtRad">N.º de radicado</label><input type="text" id="mtRad" value="' + esc((d.mintrabajo || {}).radicado || '') + '"></div></div>' +
        '<div class="grid2"><div class="field"><label for="raFecha">Investigación enviada a la ARL el</label><input type="date" id="raFecha" value="' + esc((d.remisionArl || {}).fecha || '') + '"><div class="ayuda">15 días después de terminarla.</div></div>' +
        '<div class="field"><label for="raRad">N.º de radicado</label><input type="text" id="raRad" value="' + esc((d.remisionArl || {}).radicado || '') + '"></div></div>' : '') +
      '<button type="button" class="btn" id="btnFurat">Guardar</button>';
    $('btnFurat').addEventListener('click', async ()=>{
      const fecha = $('fFecha').value, hoyS = UI.hoy(), ev = String(d.fecha || '').slice(0, 10);
      // v148: las fechas de radicado van entre el día del evento y hoy, con su número; la remisión, después de terminar la investigación.
      const malF = (f, que)=> f && ((ev && f < ev) || f > hoyS) ? que + ': la fecha debe estar entre el día del evento y hoy.' : '';
      const errs = [malF(fecha, 'FURAT'), fecha && !$('fNumero').value.trim() ? 'FURAT: falta el número de radicado.' : ''];
      if ($('mtFecha')) { errs.push(malF($('mtFecha').value, 'Ministerio del Trabajo'), $('mtFecha').value && !$('mtRad').value.trim() ? 'Ministerio: falta el radicado.' : '', malF($('raFecha').value, 'Envío a la ARL'), $('raFecha').value && !$('raRad').value.trim() ? 'Envío a la ARL: falta el radicado.' : '');
        const fi = (d.investigacion || {}).fecha; if ($('raFecha').value && (!fi || (d.investigacion || {}).estado !== 'CERRADA' || $('raFecha').value < fi)) errs.push('Envío a la ARL: debe ser después de terminar la investigación.'); }
      const e1 = errs.filter(Boolean); if (e1.length) { await Dialogo.avisar(e1.join('\n')); return; }
      const mortal = $('fMortal').checked, grave = $('fGrave').checked || mortal;
      let carg = +$('fCargados').value || 0; if (mortal && !carg) carg = 6000;
      const campos = { furat: { radicado: !!fecha, fecha, numero: $('fNumero').value.trim() }, diasIncapacidad: +$('fDias').value || 0, diasCargados: carg, grave, mortal };
      if ($('mtFecha')) { campos.mintrabajo = { fecha: $('mtFecha').value, radicado: $('mtRad').value.trim() }; campos.remisionArl = { fecha: $('raFecha').value, radicado: $('raRad').value.trim() }; }
      await parche(campos, '✓ Guardado');
    });
  } else $('dFurat').hidden = true;
  // Investigación
  if (d.clase === AT || d.clase === 'Incidente' || d.investigacion) {
    const inv = d.investigacion || {};
    $('dInv').hidden = false;
    const causas = inv.causas ? Object.keys(inv.causas).reduce((n, k)=> n + (inv.causas[k] || []).length, 0) : 0;
    $('dInv').innerHTML = '<h2>Investigación</h2><div class="m u-nota">' +
      (inv.estado === 'CERRADA' ? '✅ Terminada el ' + esc(UI.corta(inv.fecha)) + ' · ' + causas + ' causa(s) identificada(s) · ' + (inv.equipo || []).length + ' investigador(es)' :
       inv.estado === 'EN CURSO' ? '🔎 En curso · ' + causas + ' causa(s) marcada(s)' : 'Sin iniciar') + '</div>' +
      '<button type="button" class="btn ' + (inv.estado === 'CERRADA' ? 'ghost' : 'amber') + '" id="btnInv">' + (inv.estado === 'CERRADA' ? 'Ver o corregir la investigación' : inv.estado === 'EN CURSO' ? 'Continuar investigación' : 'Iniciar investigación') + '</button>';
    $('btnInv').addEventListener('click', abrirInvestigacion);
  } else $('dInv').hidden = true;
  $('btnCerrarRep').style.display = d.estado === 'CERRADO' ? 'none' : '';
  $('msgDet').textContent = '';
  // Soportes: FURAT radicado, incapacidades, informe de investigación, fotos de la escena…
  UI.adjuntos($('dAdj'), { id: d.id, lista: d.adjuntos || [], titulo: 'Soportes (FURAT, incapacidad, investigación…)', alCambiar: (l)=> { d.adjuntos = l; } });
  $('dHist').innerHTML = ''; $('dHist').appendChild(UI.botonHistorial(d.id, d.clase));
  cargarAcciones();
}
async function cargarAcciones(){
  const r = await SGSST.listar('accion', { sinPedir: true });
  acciones = r.rows.filter((a)=> a.resumen.origenRef === actual.id);
  $('dAcciones').innerHTML = acciones.length ? acciones.map((a)=>{
    const c = a.estado === 'CERRADA' ? 'ok' : UI.semaforo(a.resumen.fechaCompromiso, 5);
    return '<a class="item ' + c + '" href="plan-accion.html#' + encodeURIComponent(a.id) + '"><div class="fila"><div><div class="t">' + esc(a.resumen.accion || a.resumen.hallazgo) + '</div>' +
      '<div class="m">' + esc(a.resumen.responsable) + ' · ' + esc(UI.corta(a.resumen.fechaCompromiso)) + (a.pendiente ? ' · <span class="pend">⏳ pendiente</span>' : '') + '</div></div>' +
      '<span class="chip ' + c + '">' + (a.estado === 'CERRADA' ? 'Cerrada' : c === 'mal' ? 'Vencida' : 'Abierta') + '</span></div></a>';
  }).join('') : '<div class="m" style="font-size:var(--fs-base);color:var(--muted);margin-bottom:6px;">Sin acciones todavía. Toda causa encontrada debe tener su acción.</div>';
}
async function parche(campos, ok){
  $('msgDet').textContent = 'Guardando…';
  const r = await SGSST.enviar({ action:'parche', tipo:'reporte', id: actual.id, campos });
  if (!r.ok) { $('msgDet').textContent = Errores.texto('guardó', r); return false; }
  Object.assign(actual, campos);
  const i = filas.findIndex((x)=> x.id === actual.id);
  if (i !== -1 && r.resumen) { filas[i].resumen = r.resumen; filas[i].estado = r.estado || filas[i].estado; }
  else if (i !== -1) { Object.assign(filas[i].resumen, campos); if (campos.estado) filas[i].estado = campos.estado; }
  pintarDetalle();
  $('msgDet').textContent = r.enCola ? '⏳ Guardado en el equipo; se envía al volver la señal.' : ok;
  return true;
}
$('btnAccion').addEventListener('click', ()=>{
  const origen = actual.clase === AT ? 'Accidente de trabajo' : actual.clase === 'Incidente' ? 'Incidente' : 'Reporte de acto/condición';
  UI.nuevaAccion({ origen, origenRef: actual.id, hallazgo: actual.descripcion, centro: actual.centro, prioridad: actual.potencial === 'Alto' || actual.clase === AT ? 'Alta' : 'Media' }, async (r)=>{
    await SGSST.enviar({ action:'parche', tipo:'reporte', id: actual.id, campos: {}, agregar: { acciones: [r.id] } });
    actual.acciones = (actual.acciones || []).concat([r.id]);
    cargarAcciones();
  });
});
$('btnCerrarRep').addEventListener('click', async ()=>{
  const inv = actual.investigacion || {};
  // v143: un accidente grave o mortal no se cierra sin el reporte al Ministerio ni el envío de la investigación a la ARL
  if (actual.clase === AT && (actual.grave || actual.mortal)) {
    const f = []; if (!(actual.mintrabajo || {}).fecha) f.push('el reporte al Ministerio del Trabajo'); if (inv.estado !== 'CERRADA') f.push('terminar la investigación'); else if (!(actual.remisionArl || {}).fecha) f.push('el envío de la investigación a la ARL');
    if (f.length) { await Dialogo.avisar('Para cerrar un accidente ' + (actual.mortal ? 'mortal' : 'grave') + ' falta: ' + f.join(', ') + '. Regístralo en «Reporte a la ARL e incapacidad».'); return; }
  }
  // v148: Res. 1401 de 2007 — todo AT e incidente se investiga y deja al menos una acción; todo AT lleva FURAT.
  if (actual.clase === AT || actual.clase === 'Incidente') {
    const f = [];
    if (actual.clase === AT && !(actual.furat || {}).fecha) f.push('el FURAT radicado ante la ARL');
    if (inv.estado !== 'CERRADA') f.push('terminar la investigación');
    if (!acciones.length) f.push('al menos una acción en el plan de acción');
    const vencidas = acciones.filter((a)=> a.estado !== 'CERRADA' && a.fechaCompromiso && a.fechaCompromiso < UI.hoy()).length;
    if (vencidas) f.push('cerrar o reprogramar ' + vencidas + ' acción(es) vencida(s)');
    if (f.length) { await Dialogo.avisar('Para cerrar este ' + (actual.clase === AT ? 'accidente' : 'incidente') + ' falta: ' + f.join(', ') + '.'); return; }
  }
  const abiertas = acciones.filter((a)=> a.estado !== 'CERRADA').length;
  if (abiertas && !await Dialogo.confirmar('Hay ' + abiertas + ' acción(es) sin cerrar. El reporte se cierra, pero las acciones siguen en el plan de acción. ¿Continuar?')) return;
  const nota = await Dialogo.pedir('Nota de cierre (opcional):', '') ;
  if (nota === null) return;
  await parche({ estado:'CERRADO', cierre: { fecha: UI.hoy(), nota } }, '✓ Reporte cerrado');
  // v157: cerrar el ciclo: lo aprendido vuelve a la matriz de peligros y, si hubo lesionado, a la vigilancia.
  if (actual.clase === AT || actual.clase === 'Incidente') {
    const les = actual.lesionado && actual.lesionado.nombre, q = encodeURIComponent([actual.categoria, actual.lugar].filter(Boolean).join(' ').slice(0, 60));
    UI.modal('<h3>Cerrar el ciclo</h3><p class="ayuda">Lo que dejó este ' + (actual.clase === AT ? 'accidente' : 'incidente') + ' debe volver al sistema (Res. 1401 de 2007, art. 12; Dec. 1072, 2.2.4.6.15):</p>' +
      '<a class="btn amber" href="peligros.html?buscar=' + q + '">1. Revisar el peligro en la matriz (valoración y controles)</a>' +
      (les ? '<a class="btn ghost" href="pve.html">2. Valorar si ' + esc(les) + ' entra a un programa de vigilancia</a>' : '') +
      '<a class="btn ghost" href="persona.html?ced=' + encodeURIComponent((actual.lesionado && actual.lesionado.cedula) || '') + '"' + (les ? '' : ' hidden') + '>Ver la ficha de ' + esc(les || '') + '</a>' +
      '<button type="button" class="btn ghost" data-cerrar>Ahora no</button>');
  }
});

/* ── Investigación ── */
function abrirInvestigacion(){
  const inv = actual.investigacion || {};
  $('iCodigo').textContent = actual.id + ' · ' + actual.clase;
  $('iHechos').value = inv.hechos || actual.descripcion || '';
  $('iAnalisis').value = inv.analisis || ''; $('iConclusiones').value = inv.conclusiones || '';
  const marcar = (cont, lista, sel)=> { const propias = (sel || []).filter((t)=> lista.indexOf(t) === -1);
    $(cont).innerHTML = lista.concat(propias).map((t)=> '<label' + (lista.indexOf(t) === -1 ? ' class="propia"' : '') + '><input type="checkbox" value="' + esc(t) + '"' + ((sel || []).indexOf(t) !== -1 ? ' checked' : '') + '><span>' + esc(t) + '</span></label>').join('') +
      '<div class="otra-causa"><input type="text" placeholder="Otra: escribe la causa" maxlength="160" aria-label="Otra causa"><button type="button" class="btn-mini">Agregar</button></div>'; };
  // v109: 5 porqués guiados (el problema se precarga con la descripción del evento).
  const resp = (inv.porques || []).filter(Boolean).slice(0, 5);
  pqEst = { problema: inv.problema || recortar(actual.descripcion || '', 300), resp, raizEn: Number.isInteger(inv.raizEn) && inv.raizEn < resp.length ? inv.raizEn : -1, abierto: null };
  pqEst.abierto = siguientePaso();
  $('iRaiz').value = inv.raiz || ''; $('iLicencia').value = inv.licencia || '';
  const c = inv.causas || {};
  marcar('cActos', CAUSAS.actos, c.actos); marcar('cCondiciones', CAUSAS.condiciones, c.condiciones); marcar('cPersonales', CAUSAS.personales, c.personales); marcar('cTrabajo', CAUSAS.trabajo, c.trabajo);
  contarCausas(); pintarMedidas();
  $('iEquipo').innerHTML = ''; padsEquipo = 0;
  const eq = inv.equipo && inv.equipo.length ? inv.equipo : [{ rol:'Jefe inmediato o supervisor' }, { rol:'Representante del COPASST o vigía' }, { rol:'Responsable de SST' }].concat(actual.clase === AT && (actual.grave || actual.mortal) ? [{ rol:'Profesional con licencia en SST' }] : []);
  eq.forEach(agregarIntegrante);
  $('msgInv').textContent = '';
  pintarPorques();
  $('iFurPersona').innerHTML = '<div class="empty">Cargando datos…</div>';
  Habilitacion.cargar().catch(()=> null).then(()=> { if (document.getElementById('scrInv').classList.contains('active')) pintarFurat(); });
  show('scrInv');
}
/* «Otra» causa: se agrega al grupo ya marcada. */
document.addEventListener('click', (e)=> {
  const b = e.target.closest('.otra-causa button'); if (!b) return;
  const inp = b.parentElement.querySelector('input'), t = inp.value.replace(/\s+/g, ' ').trim(); if (!t) { inp.focus(); return; }
  const g = b.closest('.checks');
  if ([...g.querySelectorAll('input[type=checkbox]')].some((c)=> c.value.toLowerCase() === t.toLowerCase())) { UI.toast('Esa causa ya está en la lista.'); return; }
  const l = document.createElement('label'); l.className = 'propia'; l.innerHTML = '<input type="checkbox" checked value="' + esc(t) + '"><span>' + esc(t) + '</span>';
  b.parentElement.insertAdjacentElement('beforebegin', l); inp.value = ''; contarCausas(); pintarMedidas(); pasosInv();
});
document.addEventListener('keydown', (e)=> { if (e.key === 'Enter' && e.target.closest('.otra-causa input')) { e.preventDefault(); e.target.parentElement.querySelector('button').click(); } });
/* ── v109: 5 porqués guiados ──
   «¿Qué pasó?» (el problema) → «¿Por qué 1?» → cada respuesta se vuelve la siguiente pregunta
   («¿Por qué <respuesta anterior>?») hasta 5, o se para antes marcando «esta es la causa raíz».
   En cada paso: ejemplo, qué es una buena respuesta, sugerencias según el nivel y alertas. */
let pqEst = { problema: '', resp: [], raizEn: -1, abierto: null };
const recortar = (t, n)=> { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const sinPorque = (t)=> String(t || '').trim().replace(/^porque\s+/i, '').replace(/[.\s]+$/, '');
const minus = (t)=> t && !/^[A-ZÁÉÍÓÚÑ]{2}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
/** La pregunta del porqué i (0 = el primero) a partir del problema y las respuestas anteriores. */
/** La primera frase del problema (la pregunta no arrastra los detalles: «No había nadie debajo»). */
const primeraFrase = (t)=> { const x = String(t || '').replace(/\s+/g, ' ').trim(); const m = /^(.{12,}?[^\d\s])[.;!?](\s|$)/.exec(x); return m ? m[1] : x; };
function preguntaPorque(problema, resp, i){ const b = minus(sinPorque(i === 0 ? primeraFrase(problema) : primeraFrase(resp[i - 1]))); return b ? '¿Por qué ' + recortar(b, 160) + '?' : '¿Por qué pasó?'; }
const NIVEL_PQ = [
  { de: [0, 1], titulo: 'Actos y condiciones (causas inmediatas)', guia: 'Describe el acto o la condición que había justo antes del evento: lo que se ve o se puede comprobar en el sitio.',
    sug: ['no usaba el EPP o lo usaba mal', 'no se bloqueó ni se aseguró la energía', 'la guarda estaba retirada o dañada', 'la herramienta o el equipo estaba defectuoso', 'no siguió el procedimiento, el ATS o el permiso', 'el piso estaba resbaloso, con desnivel o abertura', 'faltaba orden y aseo en el área', 'no había señalización ni barreras', 'adoptó una posición insegura (línea de fuego)'] },
  { de: [2, 3], titulo: 'Factores personales y del trabajo (causas básicas · Res. 1401 de 2007)', guia: 'Busca por qué existía ese acto o esa condición: conocimiento, experiencia, fatiga o presión de tiempo (personales); supervisión, procedimiento, equipo, mantenimiento o comunicación (del trabajo).',
    sug: ['no conocía el riesgo ni el procedimiento (no se le entrenó)', 'tenía poca experiencia en esa tarea', 'estaba fatigado por la carga de trabajo o el turno', 'había presión para terminar rápido', 'nadie supervisó la tarea', 'no había procedimiento o no era claro', 'la herramienta no era la adecuada para la tarea', 'el equipo no tenía mantenimiento', 'la instrucción no se comunicó bien (cambio de turno, orden verbal)'] },
  { de: [4], titulo: 'Fallas del sistema de gestión', guia: 'Llega a lo que falló en el sistema de gestión y que la acción va a corregir: procedimiento, capacitación, supervisión, mantenimiento, compras o diseño.',
    sug: ['el procedimiento no existe o no está actualizado', 'la capacitación no incluyó esta tarea', 'la supervisión no verifica que se cumpla', 'el mantenimiento preventivo no incluye este equipo', 'se compró sin requisitos de seguridad', 'el diseño del puesto o del equipo no tiene controles de ingeniería', 'el peligro no estaba en la matriz de peligros'] }
];
const nivelPq = (i)=> NIVEL_PQ.find((n)=> n.de.indexOf(i) !== -1) || NIVEL_PQ[2];
/* v109: sugerencias según lo que pasó (palabras del evento y de las respuestas) y las causas ya marcadas. */
const CASOS_PQ = [
  [/cay[oó] (una|un|el|la|los|las) (?!persona|trabajador)|caida de objet|se le cay[oó]|se solt[oó]|desde (la|el) (plataforma|andamio|altura|techo|cubierta)/, ['la herramienta no estaba amarrada', 'la plataforma no tenía rodapié', 'el área de abajo no estaba demarcada ni restringida', 'había materiales sueltos en el borde']],
  [/se cay[oó]|resbal|tropez|caida de (altura|nivel|la escalera|del andamio)|perdi[oó] el equilibrio/, ['no tenía línea de vida ni punto de anclaje', 'la escalera o el andamio no estaba asegurado', 'el piso estaba húmedo o con obstáculos', 'faltaba baranda en el borde']],
  [/cort[oó]|corte|disco|pulidora|esmeril|cuchill|filo|sierra/, ['la guarda estaba retirada', 'el disco no era el adecuado para el equipo', 'no usaba guantes de corte', 'la pieza no estaba sujeta']],
  [/golpe|golpe[oó]|atrap|aplast|machuc|prens/, ['la carga no estaba guiada con cuerda', 'se puso entre la carga y una estructura (línea de fuego)', 'el equipo no estaba bloqueado', 'no había señalero en la maniobra']],
  [/quem|chispa|soldad|caliente|fuego|incendio|oxicorte/, ['no había manta ignífuga ni vigía de fuego', 'había material combustible cerca', 'no se hizo el permiso de trabajo en caliente', 'el EPP de soldador estaba incompleto']],
  [/electr|descarga|tablero|cable|energiz|corto/, ['no se aplicó bloqueo y etiquetado', 'no se verificó la ausencia de tensión', 'el cable o la extensión estaba dañado', 'el tablero estaba abierto o sin señalizar']],
  [/quimic|salpic|vapor|sustancia|acido|solvente|thinner|gas/, ['no se leyó la hoja de seguridad', 'el recipiente no tenía etiqueta', 'no usaba protección de ojos ni guantes adecuados', 'no había ducha ni lavaojos cerca']],
  [/vehicul|montacarg|camion|atropell|reversa|grua/, ['no había separación entre peatones y vehículos', 'la alarma de reversa no funcionaba', 'el conductor no tenía visibilidad', 'no había señalero en la maniobra']],
  [/levant|carga manual|espalda|esfuerzo|lumbar/, ['levantó solo una carga de más de 25 kg', 'no había ayudas mecánicas', 'la postura era forzada por el espacio']],
  [/ojo|particula|esquirla|proyect/, ['no usaba gafas o careta', 'no había pantalla que contuviera las partículas']]
];
function sugPq(i){
  const nv = nivelPq(i), visto = new Set(), caso = [];
  // No se sugiere lo que ya se respondió (misma idea con otras palabras).
  const previas = [pqEst.problema].concat(pqEst.resp.slice(0, i)).map(palabrasPq);
  const repetida = (x)=> { const b = palabrasPq(x); return b.size && previas.some((a)=> [...b].filter((w)=> a.has(w)).length / b.size >= 0.5); };
  const add = (l, x)=> { const k = UI.norm(x); if (!visto.has(k) && !repetida(x)) { visto.add(k); l.push(x); } };
  // Causas marcadas en la investigación: inmediatas para los primeros porqués, básicas para los siguientes.
  const grupos = i <= 1 ? ['#cActos', '#cCondiciones'] : i <= 3 ? ['#cPersonales', '#cTrabajo'] : [];
  grupos.forEach((g)=> document.querySelectorAll(g + ' input:checked').forEach((c)=> add(caso, minus(c.value))));
  if (i <= 1) { const txt = UI.norm([pqEst.problema].concat(pqEst.resp.slice(0, i)).join(' '));
    CASOS_PQ.forEach(([re, l])=> { if (re.test(txt)) l.forEach((x)=> add(caso, x)); }); }
  const base = []; nv.sug.forEach((x)=> add(base, x));
  return { caso: caso.slice(0, 8), base };
}
const chipPq = (x, oculto)=> '<button type="button" data-pqs="' + esc(x) + '"' + (oculto ? ' hidden' : '') + '>' + esc(x.charAt(0).toUpperCase() + x.slice(1)) + '</button>';
const EJEMPLO_PQ = ['Porque el disco de la pulidora se rompió y un fragmento le golpeó la mano.', 'Porque la pulidora no tenía la guarda puesta.', 'Porque la guarda se retiró para poder usar un disco más grande.',
  'Porque no había discos del tamaño correcto en el almacén y había que terminar el turno.', 'Porque la compra de discos no tiene stock mínimo ni revisión de que sirvan para el equipo.'];
const CULPA_PQ = /falta de atenci|desatenci|descuid|imprudenc|negligen|no prest[oó] atenci|error humano|\bculpa|distra[ií]d|exceso de confianza|irresponsab|no quiso|desobedec|por gusto|falta de compromiso/i;
const palabrasPq = (t)=> new Set(UI.norm(sinPorque(t)).split(/[^a-z0-9ñ]+/).filter((w)=> w.length > 3));
/** Alertas de la respuesta i: [{c:'mal'|'' , t}] (vacía si está bien). */
function alertasPorque(i, texto){
  const t = sinPorque(texto), out = []; if (!t) return out;
  if (t.length < 15 || t.split(/\s+/).length < 3) out.push({ c: '', t: 'Muy corta: di qué pasó exactamente (qué, con qué, cómo). Ej.: «' + EJEMPLO_PQ[Math.min(i, 4)] + '»' });
  const ant = i === 0 ? pqEst.problema : pqEst.resp[i - 1], a = palabrasPq(ant), b = palabrasPq(t);
  if (ant && (UI.norm(sinPorque(ant)) === UI.norm(t) || (b.size && [...b].filter((w)=> a.has(w)).length / Math.max(1, new Set([...a, ...b]).size) >= 0.6)))
    out.push({ c: '', t: 'Se parece mucho a ' + (i === 0 ? 'lo que pasó' : 'la respuesta anterior') + ': pregunta por qué pasó ESO, un paso más atrás.' });
  if (CULPA_PQ.test(t)) out.push({ c: 'mal', t: 'Eso describe a la persona, no la causa. «Falta de atención», «descuido» o «error humano» no son causa raíz: pregunta qué del trabajo permitió que pasara (procedimiento, supervisión, equipo, capacitación…).' });
  return out;
}
const alertasHTML = (l)=> l.map((a)=> '<div class="pq-alerta ' + a.c + '">' + esc(a.t) + '</div>').join('');
/** Lo que está escrito en el paso abierto pasa al estado (sin moverse de paso). */
function capturarPorque(){
  const ta = $('iPorques').querySelector('textarea[data-pq]'); if (!ta) return;
  const i = +ta.dataset.pq, v = ta.value.trim();
  if (i === -1) { pqEst.problema = v; return; }
  if (i < pqEst.resp.length) { if (v) pqEst.resp[i] = v; }
  else if (v) pqEst.resp.push(v);
}
function siguientePaso(){ return !pqEst.problema ? -1 : (pqEst.raizEn === -1 && pqEst.resp.length < 5 ? pqEst.resp.length : null); }
function pintarPorques(){
  const e = pqEst, n = e.resp.length;
  $('iPqBarra').innerHTML = [0, 1, 2, 3, 4].map((i)=> '<span class="' + (i === e.raizEn ? 'r' : i < n ? 'ok' : '') + '"></span>').join('');
  let h = '';
  // Paso 0: el problema
  if (e.abierto === -1) h += '<div class="pq-paso"><div class="pq-q"><small>Paso 1 · el problema</small>¿Qué pasó?</div>' +
    '<textarea data-pq="-1" maxlength="300" placeholder="El evento como un hecho: qué, dónde y cuándo">' + esc(e.problema) + '</textarea>' +
    '<details><summary>Ayuda para este paso</summary><p><b>Ejemplo:</b> «El ayudante se cortó la mano izquierda con el disco de la pulidora en el taller, a las 10:20».</p><p>Sin culpables ni suposiciones: solo lo que pasó.</p></details>' +
    '<div class="pq-bots"><button type="button" class="prim" data-pqa="sig">' + (n ? 'Guardar' : 'Empezar: ¿por qué pasó? →') + '</button></div></div>';
  else h += '<div class="pq-paso hecho"><div class="pq-q"><small>Lo que pasó</small></div><div class="pq-r">' + esc(e.problema || '—') + '</div>' +
    '<div class="pq-bots"><button type="button" data-pqa="editar" data-i="-1">Editar</button></div></div>';
  const pasos = n + (e.abierto === n && n < 5 ? 1 : 0);
  for (let i = 0; i < pasos; i++) {
    const q = preguntaPorque(e.problema, e.resp, i), nv = nivelPq(i), raiz = i === e.raizEn;
    if (e.abierto === i) {
      const val = e.resp[i] || '', nuevo = i >= n;
      h += '<div class="pq-paso"><div class="pq-q"><small>Por qué ' + (i + 1) + ' de 5 · ' + esc(nv.titulo) + '</small>' + esc(q) + '</div>' +
        '<textarea data-pq="' + i + '" maxlength="300" placeholder="Porque…">' + esc(val) + '</textarea><div data-pqal>' + alertasHTML(alertasPorque(i, val)) + '</div>' +
        (()=> { const sg = sugPq(i), nb = sg.caso.length ? 2 : 4;
          return (sg.caso.length ? '<div class="pq-sug"><div class="t">Según este caso (tócala y ajústala):</div><div class="chips">' + sg.caso.map((x)=> chipPq(x)).join('') + '</div></div>' : '') +
          '<div class="pq-sug"><div class="t">' + (sg.caso.length ? 'Otras causas frecuentes en este nivel:' : 'Sugerencias (tócala y ajústala a este caso):') + '</div><div class="chips">' + sg.base.map((x, k)=> chipPq(x, k >= nb)).join('') +
          (sg.base.length > nb ? '<button type="button" data-pqmas>Ver ' + (sg.base.length - nb) + ' más…</button>' : '') + '</div></div>'; })() +
        '<details><summary>Ayuda para este paso</summary><p>' + esc(nv.guia) + '</p><p><b>Ejemplo:</b> «' + esc(EJEMPLO_PQ[i]) + '»</p>' +
        '<p><b>Una buena respuesta</b> es un hecho que se puede comprobar (qué, con qué, cómo), sin culpas ni nombres. «Falta de atención» o «descuido» no sirven como causa raíz: siempre hay algo del trabajo detrás.</p>' +
        (i >= 2 ? '<p>Pregúntate: <b>si corrijo esto, ¿se evita que vuelva a pasar?</b> Si la respuesta es sí, márcala como causa raíz.</p>' : '') + '</details>' +
        '<div class="pq-bots">' + (i < 4 ? '<button type="button" class="prim" data-pqa="sig">' + (nuevo ? 'Siguiente: ¿por qué? →' : 'Guardar cambio') + '</button>' : '') +
        '<button type="button" class="raizb" data-pqa="raiz" data-i="' + i + '">Esta es la causa raíz ✓</button>' +
        (!nuevo ? '<button type="button" class="quitar" data-pqa="quitar" data-i="' + i + '">Quitar</button>' : '') + '</div></div>';
    } else {
      h += '<div class="pq-paso hecho' + (raiz ? ' raiz' : '') + '"><div class="pq-q"><small>Por qué ' + (i + 1) + (raiz ? ' · 🎯 causa raíz' : '') + '</small>' + esc(q) + '</div><div class="pq-r">' + esc(e.resp[i]) + '</div>' +
        alertasHTML(alertasPorque(i, e.resp[i]).filter((a)=> a.c === 'mal')) +
        '<div class="pq-bots"><button type="button" data-pqa="editar" data-i="' + i + '">Editar</button><button type="button" class="quitar" data-pqa="quitar" data-i="' + i + '">Quitar</button></div></div>';
    }
  }
  $('iPorques').innerHTML = h;
  // Causa raíz encontrada: se sugiere crear la acción y se puede seguir preguntando.
  const r = $('iRaiz').value.trim();
  $('iRaizCaja').innerHTML = e.raizEn !== -1 ? '<div class="raiz-caja"><b>🎯 Causa raíz en el porqué ' + (e.raizEn + 1) + '.</b> Ahora crea la acción que la corrige (queda abajo, en «Medidas por causa»).' +
    (r ? '<button type="button" class="btn verde" data-pqa="accion">+ Acción para la causa raíz</button>' : '') +
    (e.raizEn === n - 1 && n < 5 ? '<button type="button" class="btn ghost" data-pqa="seguir">Seguir preguntando por qué</button>' : '') + '</div>'
    : (n >= 5 ? '<div class="pq-alerta">Ya van 5 porqués: marca cuál es la causa raíz (botón «Editar» → «Esta es la causa raíz») o escríbela abajo.</div>' : '');
  pasosInv();
}
$('iPorques').addEventListener('input', (ev)=> { const ta = ev.target.closest('textarea[data-pq]'); if (!ta || ta.dataset.pq === '-1') return;
  const al = ta.parentElement.querySelector('[data-pqal]'); if (al) al.innerHTML = alertasHTML(alertasPorque(+ta.dataset.pq, ta.value)); });
$('iPorques').addEventListener('keydown', (ev)=> { if (ev.key === 'Enter' && !ev.shiftKey && ev.target.matches('textarea[data-pq]')) { ev.preventDefault(); const b = ev.target.parentElement.querySelector('[data-pqa="sig"], [data-pqa="raiz"]'); if (b) b.click(); } });
document.addEventListener('click', async (ev)=> {
  const mas = ev.target.closest('#iPorques [data-pqmas]');
  if (mas) { mas.parentElement.querySelectorAll('[data-pqs][hidden]').forEach((x)=> x.hidden = false); mas.remove(); return; }
  const s = ev.target.closest('#iPorques [data-pqs]');
  if (s) { const ta = $('iPorques').querySelector('textarea[data-pq]'); if (!ta) return; const v = ta.value.trim();
    ta.value = v && !/^porque\s*$/i.test(v) ? v.replace(/[.\s]+$/, '') + ' y ' + s.dataset.pqs : 'Porque ' + s.dataset.pqs; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); return; }
  const b = ev.target.closest('[data-pqa]'); if (!b || !b.closest('#scrInv')) return;
  const a = b.dataset.pqa, i = b.dataset.i === undefined ? null : +b.dataset.i, e = pqEst;
  if (a === 'sig') {
    const ta = $('iPorques').querySelector('textarea[data-pq]'), k = +ta.dataset.pq;
    if (!ta.value.trim()) { Valida.limpiar($('iPorques')); Valida.marcar(ta, k === -1 ? 'escribe qué pasó' : 'escribe la respuesta (empieza con «Porque…»)'); ta.focus(); return; }
    capturarPorque(); e.abierto = siguientePaso();
  } else if (a === 'raiz') {
    const ta = $('iPorques').querySelector('textarea[data-pq]');
    if (!ta.value.trim()) { Valida.limpiar($('iPorques')); Valida.marcar(ta, 'escribe la respuesta antes de marcarla como causa raíz'); ta.focus(); return; }
    const t = sinPorque(ta.value);
    if (CULPA_PQ.test(t) && !await Dialogo.confirmar('«' + recortar(t, 80) + '» habla de la persona, no de lo que falló en el trabajo. Una causa raíz así no evita que se repita. ¿Marcarla de todas formas?')) return;
    if (i === 0 && !await Dialogo.confirmar('Casi siempre la causa raíz aparece entre el porqué 3 y el 5. ¿Seguro que el primer porqué ya es la causa raíz?')) return;
    capturarPorque(); e.raizEn = i; e.abierto = null;
    const raiz = sinPorque(e.resp[i]); $('iRaiz').value = raiz ? raiz.charAt(0).toUpperCase() + raiz.slice(1) : '';
    pintarMedidas();
  } else if (a === 'editar') { capturarPorque(); e.abierto = i; }
  else if (a === 'quitar') {
    capturarPorque();
    if (!await Dialogo.confirmar('¿Quitar el porqué ' + (i + 1) + '?' + (i < e.resp.length - 1 ? ' Los siguientes quedan, y sus preguntas se vuelven a formular.' : ''))) return;
    e.resp.splice(i, 1);
    if (e.raizEn === i) { e.raizEn = -1; $('iRaiz').value = ''; pintarMedidas(); } else if (e.raizEn > i) e.raizEn--;
    e.abierto = siguientePaso();
  } else if (a === 'seguir') { e.raizEn = -1; e.abierto = siguientePaso(); }
  else if (a === 'accion') { const t = $('iRaiz').value.trim(), btn = $('iMedidas').querySelector('[data-raiz="1"]'); if (btn) btn.click(); else if (t) UI.toast('La causa raíz ya tiene su acción.'); return; }
  else return;
  pintarPorques();
  const ta = $('iPorques').querySelector('textarea[data-pq]'); if (ta && a !== 'quitar') { try { ta.focus({ preventScroll: true }); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }
});
$('iRaiz').addEventListener('input', ()=> pintarMedidas());
/* Medidas: cada causa marcada con su botón para crear la acción. */
function pintarMedidas(){
  const sel = [...document.querySelectorAll('#cActos input:checked, #cCondiciones input:checked, #cPersonales input:checked, #cTrabajo input:checked')].map((c)=> c.value);
  // v109: la causa raíz de los 5 porqués también necesita su medida.
  const raiz = $('iRaiz').value.trim(), iRaiz = raiz && sel.indexOf(raiz) === -1 ? sel.push(raiz) - 1 : sel.indexOf(raiz);
  const ya = new Set((acciones || []).map((a)=> String((a.resumen || {}).hallazgo || '')));
  $('iMedidas').innerHTML = sel.length ? sel.map((t, i)=> '<div class="medida"><span>' + (raiz && i === iRaiz ? '<b>🎯 Causa raíz:</b> ' : '') + esc(t) + '</span>' + (ya.has('Causa: ' + t) ? '<span class="chip ok">Con acción</span>' : '<button type="button" class="btn-mini" data-med="' + i + '"' + (raiz && i === iRaiz ? ' data-raiz="1"' : '') + '>+ Acción</button>') + '</div>').join('')
    : '<div class="m u-nota">Marca las causas arriba y aquí aparecen para asignarles su medida.</div>';
  $('iMedidas').querySelectorAll('[data-med]').forEach((b)=> b.addEventListener('click', ()=> {
    const t = sel[+b.dataset.med], origen = actual.clase === AT ? 'Accidente de trabajo' : actual.clase === 'Incidente' ? 'Incidente' : 'Reporte de acto/condición';
    UI.nuevaAccion({ origen, origenRef: actual.id, hallazgo: 'Causa: ' + t, centro: actual.centro, prioridad: 'Alta', tipoAccion: 'Correctiva' }, async (r)=> {
      await SGSST.enviar({ action:'parche', tipo:'reporte', id: actual.id, campos: {}, agregar: { acciones: [r.id] } });
      actual.acciones = (actual.acciones || []).concat([r.id]);
      (acciones = acciones || []).push({ id: r.id, estado: 'ABIERTA', resumen: { hallazgo: 'Causa: ' + t } }); pintarMedidas(); pasosInv(); cargarAcciones();
    });
  }));
}
/* ── v161 · Datos del FURAT (formato de investigación, Res. 1401 de 2007) ──
   Se precargan del reporte, de Personal habilitado y del perfil de la empresa; se guardan en investigacion.furat. */
const FUR_OP = {
  vinculacion: ['Planta', 'Misión', 'Cooperado', 'Estudiante o aprendiz', 'Independiente'], tipoId: ['CC', 'CE', 'NU', 'TI', 'PEP', 'PA'], sexo: ['M', 'F'], zona: ['Urbana', 'Rural'],
  jornadaHab: ['Diurna', 'Nocturna', 'Mixta', 'Turnos'], jornada: ['Normal', 'Extra'], siNo: ['Sí', 'No'], noSi: ['No', 'Sí'],
  tipoAcc: ['Propios del trabajo', 'Violencia', 'Tránsito', 'Deportivo', 'Recreativo', 'Ambiental'], dentro: ['Dentro de la empresa', 'Fuera de la empresa'],
  sitio: ['(1) Almacenes o depósitos', '(2) Áreas de producción', '(3) Áreas recreativas o deportivas', '(4) Corredores o pasillos', '(5) Escaleras', '(6) Parqueaderos o áreas de circulación vehicular', '(7) Oficinas', '(8) Otras áreas comunes', '(9) Otro'],
  lesion: ['(10) Fractura', '(20) Luxación', '(25) Torcedura, esguince, desgarro muscular, hernia o laceración sin herida', '(30) Conmoción o trauma interno', '(40) Amputación o enucleación', '(41) Herida', '(50) Trauma superficial', '(55) Golpe, contusión o aplastamiento', '(60) Quemadura', '(70) Envenenamiento, intoxicación aguda o alergia', '(80) Efecto del tiempo, del clima u otro del ambiente', '(81) Asfixia', '(82) Efecto de la electricidad', '(83) Efecto nocivo de la radiación', '(90) Lesiones múltiples', '(99) Otro'],
  parte: ['(1) Cabeza', '(1.12) Ojo', '(2) Cuello', '(3) Tronco', '(3.32) Tórax', '(3.33) Abdomen', '(4) Miembros superiores', '(4.46) Manos', '(5) Miembros inferiores', '(5.56) Pies', '(6) Ubicaciones múltiples', '(7) Lesiones generales u otras'],
  agente: ['(1) Máquinas y/o equipos', '(2) Medios de transporte', '(3) Aparatos', '(3.36) Herramientas, implementos o utensilios', '(4) Materiales o sustancias', '(4.4) Radiaciones', '(5) Ambiente de trabajo', '(6) Otros agentes no clasificados', '(6.61) Animales', '(7) Agentes no clasificados por falta de datos'],
  mecanismo: ['(1) Caída de personas', '(2) Caída de objetos', '(3) Pisadas, choques o golpes', '(4) Atrapamientos', '(5) Sobreesfuerzo, esfuerzo excesivo o falso movimiento', '(6) Exposición o contacto con temperatura extrema', '(7) Exposición o contacto con la electricidad', '(8) Exposición o contacto con sustancias nocivas, radiaciones o salpicaduras', '(9) Otro']
};
const FUR_PERSONA = [['vinculacion', 'Tipo de vinculación', 'sel', 'vinculacion'], ['apellido1', 'Primer apellido'], ['apellido2', 'Segundo apellido'], ['nombre1', 'Primer nombre'], ['nombre2', 'Segundo nombre'],
  ['tipoId', 'Tipo de identificación', 'sel', 'tipoId'], ['numId', 'Número de identificación'], ['nacimiento', 'Fecha de nacimiento', 'date'], ['sexo', 'Sexo', 'sel', 'sexo'],
  ['direccion', 'Dirección de residencia'], ['telefono', 'Teléfono'], ['depto', 'Departamento'], ['municipio', 'Municipio'], ['zona', 'Zona', 'sel', 'zona'], ['cargo', 'Cargo'],
  ['ocupacion', 'Ocupación habitual'], ['tiempoOcup', 'Tiempo en la ocupación habitual (ej. 9 meses)'], ['ingreso', 'Fecha de ingreso a la empresa', 'date'], ['salario', 'Salario u honorarios mensuales', 'num'], ['jornadaHab', 'Jornada de trabajo habitual', 'sel', 'jornadaHab']];
const FUR_ACC = [['fecha', 'Fecha del accidente', 'date'], ['hora', 'Hora del accidente', 'time'], ['dia', 'Día de la semana'], ['jornada', 'Jornada en que sucede', 'sel', 'jornada'], ['laborHabitual', '¿Realizaba su labor habitual?', 'sel', 'siNo'],
  ['laborCual', '¿Cuál? (solo si no era la habitual)'], ['tiempoPrevio', 'Tiempo laborado previo al evento (hh:mm)', 'time'], ['tipoAcc', 'Tipo de accidente', 'sel', 'tipoAcc'], ['muerte', '¿Causó la muerte?', 'sel', 'noSi'], ['fechaMuerte', 'Fecha de la muerte', 'date'],
  ['deptoAcc', 'Departamento del accidente'], ['municipioAcc', 'Municipio del accidente'], ['zonaAcc', 'Zona del accidente', 'sel', 'zona'], ['dentro', 'Lugar donde ocurrió', 'sel', 'dentro'], ['sitio', 'Sitio', 'sel', 'sitio'], ['sitioOtro', 'Otro sitio (especifique)'],
  ['lesion', 'Tipo de lesión (una o varias)', 'multi', 'lesion'], ['lesionOtra', 'Otra lesión (especifique)'], ['parte', 'Parte del cuerpo afectada (una o varias)', 'multi', 'parte'], ['agente', 'Agente del accidente (con qué se lesionó)', 'sel', 'agente'], ['mecanismo', 'Mecanismo o forma del accidente', 'sel', 'mecanismo'], ['mecanismoOtro', 'Otro mecanismo (especifique)']];
const FUR_RESP = [['respNombre', 'Apellidos y nombres'], ['respTipoId', 'Tipo de identificación', 'sel', 'tipoId'], ['respNum', 'Número'], ['respCargo', 'Cargo'], ['respFecha', 'Fecha de diligenciamiento', 'date']];
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Busca en una lista de códigos la opción que mejor corresponde a un texto del reporte (p. ej. «Manos» → «(4.46) Manos»). */
function codigoDe(lista, txt){ const t = UI.norm(txt || '').replace(/[^a-z ]/g, ' ').trim(); if (!t) return ''; const pal = t.split(/\s+/).filter((w)=> w.length > 3);
  let mejor = '', m = 0; lista.forEach((o)=> { const n = UI.norm(o.replace(/^\([^)]*\)\s*/, '')); const k = pal.filter((w)=> n.includes(w.slice(0, 5))).length; if (k > m) { m = k; mejor = o; } }); return mejor; }
function prellenarFurat(){
  const d = actual, l = d.lesionado || {}, k = Habilitacion.clave(l.cedula), t = (Habilitacion._mapa || {})[k] || {}, perfil = UI.perfilInstalacion() || {};
  const pal = String(l.nombre || t.nombre || '').trim().toUpperCase().split(/\s+/).filter(Boolean);
  const nN = pal.length >= 4 ? 2 : 1, noms = pal.slice(0, pal.length >= 3 ? nN : 1), aps = pal.slice(noms.length);
  const yo = (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || {};
  const f = String(d.fecha || '').slice(0, 10), dia = f ? DIAS[new Date(f + 'T12:00:00').getDay()] : '';
  return { vinculacion: 'Planta', apellido1: aps[0] || '', apellido2: aps.slice(1).join(' '), nombre1: noms[0] || '', nombre2: noms.slice(1).join(' '), tipoId: 'CC', numId: l.cedula || t.cedula || '',
    telefono: t.celular || '', depto: perfil.departamento || '', municipio: perfil.ciudad || perfil.municipio || '', zona: 'Urbana', cargo: l.cargo || t.cargo || '', ocupacion: l.cargo || t.cargo || '', ingreso: t.fechaIngreso || '', jornadaHab: 'Diurna',
    fecha: f, hora: d.hora || '', dia, jornada: 'Normal', laborHabitual: 'Sí', tipoAcc: 'Propios del trabajo', muerte: d.mortal ? 'Sí' : 'No', deptoAcc: perfil.departamento || '', municipioAcc: perfil.ciudad || perfil.municipio || '', zonaAcc: 'Urbana', dentro: 'Dentro de la empresa',
    lesion: [codigoDe(FUR_OP.lesion, l.tipoLesion)].filter(Boolean), parte: [codigoDe(FUR_OP.parte, l.parteCuerpo)].filter(Boolean), agente: codigoDe(FUR_OP.agente, l.agente), mecanismo: codigoDe(FUR_OP.mecanismo, l.mecanismo),
    respNombre: yo.nombre || '', respTipoId: 'CC', respNum: yo.cedula || '', respCargo: yo.cargo || 'Responsable SST', respFecha: UI.hoy(), testigos: [] };
}
function campoFur(c, v){
  const [k, et, tipo, op] = c, id = 'fu_' + k;
  if (tipo === 'sel') return '<div class="field"><label for="' + id + '">' + esc(et) + '</label><select id="' + id + '" data-fur="' + k + '"><option value=""></option>' + FUR_OP[op].map((o)=> '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select></div>';
  if (tipo === 'multi') { const sel = Array.isArray(v) ? v : []; return '<div class="field ancho"><label>' + esc(et) + '</label><div class="fur-multi" data-fur="' + k + '" data-multi>' + FUR_OP[op].map((o)=> '<label><input type="checkbox" value="' + esc(o) + '"' + (sel.indexOf(o) !== -1 ? ' checked' : '') + '>' + esc(o) + '</label>').join('') + '</div></div>'; }
  return '<div class="field"><label for="' + id + '">' + esc(et) + '</label><input id="' + id + '" data-fur="' + k + '" data-no-ac type="' + ({ date: 'date', time: 'time', num: 'number' }[tipo] || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (tipo === 'num' ? ' min="0" inputmode="numeric"' : ' maxlength="160"') + '></div>';
}
function pintarFurat(){
  const inv = actual.investigacion || {}, base = prellenarFurat(), f = Object.assign({}, base, inv.furat || {});
  Object.keys(base).forEach((k)=> { if ((f[k] === '' || f[k] == null || (Array.isArray(f[k]) && !f[k].length)) && base[k]) f[k] = base[k]; });
  $('iFurPersona').innerHTML = FUR_PERSONA.map((c)=> campoFur(c, f[c[0]])).join('');
  $('iFurAccidente').innerHTML = FUR_ACC.map((c)=> campoFur(c, f[c[0]])).join('');
  $('iFurResp').innerHTML = FUR_RESP.map((c)=> campoFur(c, f[c[0]])).join('');
  $('iTestigos').innerHTML = ''; (f.testigos || []).forEach(agregarTestigo); contarTestigos();
  $('iLicExp').value = inv.licExpedida || ''; $('iRepLegal').value = inv.repLegal || (UI.perfilInstalacion() || {}).representante || '';
  const fe = $('fu_fecha'); if (fe) fe.addEventListener('change', ()=> { if (fe.value) $('fu_dia').value = DIAS[new Date(fe.value + 'T12:00:00').getDay()]; });
}
function agregarTestigo(t){
  t = t || {}; const d = document.createElement('div'); d.className = 'testigo';
  d.innerHTML = '<div class="fur-grid"><div class="field"><label>Apellidos y nombres</label><input type="text" class="tNom" value="' + esc(t.nombre || '') + '"></div>' +
    '<div class="field"><label>Documento</label><input type="text" class="tDoc" inputmode="numeric" placeholder="Cédula" value="' + esc(t.doc || '') + '"></div>' +
    '<div class="field"><label>Cargo</label><input type="text" class="tCargo" value="' + esc(t.cargo || '') + '"></div>' +
    '<div class="field ancho"><label>Declaración</label><textarea class="tDecl" rows="2" maxlength="1500">' + esc(t.declaracion || '') + '</textarea></div></div><button type="button" class="btn-mini" data-quitar-testigo>Quitar</button>';
  $('iTestigos').appendChild(d); contarTestigos();
}
const contarTestigos = ()=> { $('nTestigos').textContent = $('iTestigos').children.length || ''; };
$('btnMasTestigo').addEventListener('click', ()=> agregarTestigo({}));
$('iTestigos').addEventListener('click', (e)=> { const b = e.target.closest('[data-quitar-testigo]'); if (b) { b.closest('.testigo').remove(); contarTestigos(); } });
function leerFurat(){
  if (!$('iFuratCard').querySelector('[data-fur]')) return (actual.investigacion || {}).furat || null;   // aún no se pintó: no se borra lo guardado
  const f = {};
  $('iFuratCard').querySelectorAll('[data-fur]').forEach((x)=> { f[x.dataset.fur] = x.dataset.multi != null ? [...x.querySelectorAll('input:checked')].map((c)=> c.value) : x.value.trim(); });
  f.testigos = [...$('iTestigos').querySelectorAll('.testigo')].map((d)=> ({ nombre: d.querySelector('.tNom').value.trim(), doc: d.querySelector('.tDoc').value.trim(), cargo: d.querySelector('.tCargo').value.trim(), declaracion: d.querySelector('.tDecl').value.trim() })).filter((x)=> x.nombre);
  return f;
}
/* Formato de investigación (Res. 1401 de 2007) con las secciones del FURAT, en el orden del formato de la empresa. */
function formatoInvestigacion(){
  const d = actual, inv = Object.assign({}, d.investigacion || {}, leerInv((d.investigacion || {}).estado || 'EN CURSO')), f = inv.furat || {}, c = inv.causas || {};
  const X = (v, o)=> (Array.isArray(v) ? v.indexOf(o) !== -1 : v === o) ? '☒' : '☐';
  const marcas = (op, v)=> FUR_OP[op].map((o)=> X(v, o) + ' ' + esc(o)).join('&nbsp;&nbsp; ');
  const td = (t, v, cs)=> '<td' + (cs ? ' colspan="' + cs + '"' : '') + '><div class="l">' + esc(t) + '</div>' + (v || '&nbsp;') + '</td>';
  const sec = (t, cuerpo)=> UI.seccion(t, cuerpo);
  const nomPers = [f.apellido1, f.apellido2, f.nombre1, f.nombre2].filter(Boolean).join(' ');
  let h = UI.cabecera('SG-INV-AT', 'INVESTIGACIÓN DE ACCIDENTES DE TRABAJO', 'Res. 1401 de 2007 · ' + d.id + (inv.estado === 'CERRADA' ? ' · terminada el ' + UI.corta(inv.fecha) : ' · en curso'));
  h += sec('0. Evento ocurrido', '<table><tr>' + td('Evento', '☒ Laboral &nbsp; ☐ Ambiental', 2) + '</tr></table>');
  h += sec('I. Información de la persona que se accidentó', '<table><tr>' + td('Tipo de vinculación', marcas('vinculacion', f.vinculacion), 4) + '</tr>' +
    '<tr>' + td('Primer apellido', esc(f.apellido1)) + td('Segundo apellido', esc(f.apellido2)) + td('Primer nombre', esc(f.nombre1)) + td('Segundo nombre', esc(f.nombre2)) + '</tr>' +
    '<tr>' + td('Tipo de identificación', marcas('tipoId', f.tipoId)) + td('Número', esc(f.numId)) + td('Fecha de nacimiento', esc(f.nacimiento ? UI.corta(f.nacimiento) : '')) + td('Sexo', marcas('sexo', f.sexo)) + '</tr>' +
    '<tr>' + td('Dirección', esc(f.direccion), 2) + td('Teléfono', esc(f.telefono)) + td('Zona', marcas('zona', f.zona)) + '</tr>' +
    '<tr>' + td('Departamento', esc(f.depto)) + td('Municipio', esc(f.municipio)) + td('Cargo', esc(f.cargo), 2) + '</tr>' +
    '<tr>' + td('Ocupación habitual', esc(f.ocupacion), 2) + td('Tiempo en la ocupación habitual', esc(f.tiempoOcup), 2) + '</tr>' +
    '<tr>' + td('Fecha de ingreso a la empresa', esc(f.ingreso ? UI.corta(f.ingreso) : '')) + td('Salario u honorarios (mensual)', f.salario ? '$' + esc(Number(f.salario).toLocaleString('es-CO')) : '') + td('Jornada de trabajo habitual', marcas('jornadaHab', f.jornadaHab), 2) + '</tr></table>');
  h += sec('II. Información sobre el accidente', '<table><tr>' + td('Fecha del accidente', esc(f.fecha ? UI.corta(f.fecha) : '')) + td('Hora (0-23)', esc(f.hora)) + td('Día de la semana', esc(f.dia), 2) + '</tr>' +
    '<tr>' + td('Jornada en que sucede', marcas('jornada', f.jornada)) + td('¿Realizaba su labor habitual?', marcas('siNo', f.laborHabitual) + (f.laborCual ? '<br>Cuál: ' + esc(f.laborCual) : ''), 2) + td('Tiempo laborado previo', esc(f.tiempoPrevio)) + '</tr>' +
    '<tr>' + td('Tipo de accidente', marcas('tipoAcc', f.tipoAcc), 4) + '</tr>' +
    '<tr>' + td('¿Causó la muerte?', marcas('noSi', f.muerte) + (f.fechaMuerte ? ' · ' + esc(UI.corta(f.fechaMuerte)) : '')) + td('Departamento del accidente', esc(f.deptoAcc)) + td('Municipio del accidente', esc(f.municipioAcc)) + td('Zona', marcas('zona', f.zonaAcc)) + '</tr>' +
    '<tr>' + td('Lugar donde ocurrió', marcas('dentro', f.dentro), 4) + '</tr>' +
    '<tr>' + td('Sitio', marcas('sitio', f.sitio) + (f.sitioOtro ? '<br>Otro: ' + esc(f.sitioOtro) : ''), 4) + '</tr>' +
    '<tr>' + td('Tipo de lesión', marcas('lesion', f.lesion) + (f.lesionOtra ? '<br>Otro: ' + esc(f.lesionOtra) : ''), 4) + '</tr>' +
    '<tr>' + td('Parte del cuerpo aparentemente afectada', marcas('parte', f.parte), 4) + '</tr>' +
    '<tr>' + td('Agente del accidente (con qué se lesionó)', marcas('agente', f.agente), 2) + td('Mecanismo o forma del accidente', marcas('mecanismo', f.mecanismo) + (f.mecanismoOtro ? '<br>Otro: ' + esc(f.mecanismoOtro) : ''), 2) + '</tr></table>');
  const tes = f.testigos || [];
  h += sec('III. Descripción del accidente', UI.textoLargo(inv.hechos || d.descripcion || '') +
    '<table><tr>' + td('¿Hubo personas que presenciaron el accidente?', tes.length ? '☒ Sí &nbsp; ☐ No' : '☐ Sí &nbsp; ☒ No', 4) + '</tr>' + tes.map((t)=> '<tr>' + td('Apellidos y nombres', esc(t.nombre)) + td('Documento', esc(t.doc)) + td('Cargo', esc(t.cargo)) + td('Firma', '') + '</tr><tr>' + td('Declaración', esc(t.declaracion), 4) + '</tr>').join('') + '</table>');
  h += sec('IV. Persona responsable del informe (representante o delegado)', '<table><tr>' + td('Apellidos y nombres', esc(f.respNombre), 2) + td('Documento', esc((f.respTipoId || 'CC') + ' ' + (f.respNum || ''))) + td('Cargo', esc(f.respCargo)) + '</tr><tr>' + td('Firma', '', 2) + td('Fecha de diligenciamiento', esc(f.respFecha ? UI.corta(f.respFecha) : ''), 2) + '</tr></table>');
  h += sec('V. Dibujo o fotos', (d.fotos || []).length ? UI.fotosHoja(d.fotos) : UI.textoLargo('Ver anexos.'));
  const pqs = inv.porques || [];
  h += sec('VI. Análisis de causa raíz (5 porqués)', (pqs.length ? '<table>' + (inv.problema ? '<tr><td class="l" style="width:22%">Qué pasó</td><td>' + esc(inv.problema) + '</td></tr>' : '') + pqs.map((t, i)=> '<tr><td class="l" style="width:22%">' + (i + 1) + '. ' + esc(preguntaPorque(inv.problema, pqs, i)) + '</td><td>' + esc(t) + '</td></tr>').join('') + '</table>' : '') +
    UI.tablaDatos([['Causa raíz', inv.raiz || '']]));
  const lst = (x)=> (x || []).length ? (x || []).map((y)=> '• ' + esc(y)).join('<br>') : '—';
  h += sec('VII. Resumen de causas y conclusiones', '<table><tr><th colspan="2">Causas básicas</th><th colspan="2">Causas inmediatas</th></tr><tr><th>Factores personales</th><th>Factores de trabajo</th><th>Condición subestándar</th><th>Actos subestándar</th></tr>' +
    '<tr><td>' + lst(c.personales) + '</td><td>' + lst(c.trabajo) + '</td><td>' + lst(c.condiciones) + '</td><td>' + lst(c.actos) + '</td></tr></table>' + (inv.conclusiones ? UI.tablaDatos([['Conclusiones', inv.conclusiones]]) : ''));
  h += sec('VIII. Soluciones: cómo prevenir que ocurran pérdidas', acciones.length ? '<table><tr><th style="width:8%">Causa N.º</th><th>Solución o recomendación</th><th>Responsable</th><th>Fecha acordada para cierre</th></tr>' + acciones.map((a, i)=> '<tr><td>' + (i + 1) + '</td><td>' + esc(a.resumen.accion || a.resumen.hallazgo || '') + '</td><td>' + esc(a.resumen.responsable || '') + '</td><td>' + esc(UI.corta(a.resumen.fechaCompromiso || '')) + '</td></tr>').join('') + '</table>' : UI.textoLargo('Sin acciones registradas todavía.'));
  const ciudad = f.municipioAcc || f.municipio || '', fe = inv.fecha || UI.hoy();
  h += sec('IX. Participantes de la investigación', '<table><tr><th>Nombre</th><th>Cargo / rol</th><th>Ciudad</th><th>Fecha</th><th>Firma y documento</th></tr>' + (inv.equipo || []).map((x)=> '<tr><td>' + esc(x.nombre) + '</td><td>' + esc(x.rol) + '</td><td>' + esc(ciudad) + '</td><td>' + esc(UI.corta(fe)) + '</td><td>' + UI.firmaHoja(x.firma) + (x.cedula ? '<br>CC ' + esc(x.cedula) : '') + '</td></tr>').join('') + '</table>' +
    '<table><tr>' + td('Representante legal', esc(inv.repLegal || '') + '<br><br>Firma y documento:') + td('Profesional en SST', esc(((inv.equipo || []).find((x)=> /licencia|profesional|sst/i.test(x.rol || '')) || {}).nombre || '') + '<br>Licencia N.º ' + esc(inv.licencia || '') + (inv.licExpedida ? ' · expedida por ' + esc(inv.licExpedida) : '') + '<br>Firma y documento:') + '</tr></table>');
  const sinFirmas = inv.estado !== 'CERRADA' || !(inv.equipo || []).length || (inv.equipo || []).some((x)=> !x.firma);
  UI.imprimir([h], false, { registro: { id: d.id, version: d.version, actualizado: d.updatedAt }, borrador: sinFirmas ? 'BORRADOR — investigación sin terminar o sin las firmas del equipo' : '' });
}
$('btnFormatoInv').addEventListener('click', formatoInvestigacion);

/* Avance de la investigación (Res. 1401 de 2007). */
function pasosInv(){
  const eq = [...$('iEquipo').querySelectorAll('.equipo-inv')].filter((d)=> d.querySelector('.nom').value.trim());
  const nCausas = document.querySelectorAll('#cActos input:checked, #cCondiciones input:checked, #cPersonales input:checked, #cTrabajo input:checked').length;
  const P = [['Equipo', eq.length >= 2], ['Hechos', !!$('iHechos').value.trim()], ['Causas', nCausas > 0], ['Por qué', !!$('iRaiz').value.trim()], ['Medidas', (nCausas > 0 || !!$('iRaiz').value.trim()) && !$('iMedidas').querySelector('[data-med]')], ['Firmas', eq.length >= 2 && eq.every((d)=> UI.firma('padInv' + d.dataset.n))]];
  const h = P.filter((x)=> x[1]).length;
  $('iPasos').innerHTML = '<div class="pi-top"><b>Avance: ' + h + ' de ' + P.length + '</b><span>' + (h === P.length ? 'Lista para terminar' : 'Falta: ' + P.filter((x)=> !x[1]).map((x)=> x[0].toLowerCase()).join(', ')) + '</span></div><div class="pi-pasos">' + P.map((x, i)=> '<span class="' + (x[1] ? 'ok' : '') + '">' + (x[1] ? '✓' : i + 1) + ' ' + x[0] + '</span>').join('') + '</div>';
}
document.addEventListener('change', (e)=> { if (e.target.closest('#scrInv')) { if (e.target.closest('.checks')) pintarMedidas(); pasosInv(); } });
document.addEventListener('input', (e)=> { if (e.target.closest('#scrInv') && /iHechos|iRaiz/.test(e.target.id || '') || (e.target.classList && e.target.classList.contains('nom'))) pasosInv(); });
document.addEventListener('pointerup', (e)=> { if (e.target.closest && e.target.closest('#iEquipo canvas')) setTimeout(pasosInv, 50); });
function contarCausas(){ document.querySelectorAll('summary span[data-n]').forEach((s)=>{ const id = { actos:'cActos', condiciones:'cCondiciones', personales:'cPersonales', trabajo:'cTrabajo' }[s.dataset.n]; const n = $(id).querySelectorAll('input:checked').length; s.textContent = n ? '· ' + n + ' marcada(s)' : ''; }); }
document.addEventListener('change', (e)=>{ if (e.target.closest('.checks')) contarCausas(); });
function agregarIntegrante(p){
  const n = ++padsEquipo, d = document.createElement('div');
  d.className = 'equipo-inv'; d.dataset.n = n;
  d.innerHTML = '<div class="rol"><input type="text" class="rolTxt" value="' + esc(p.rol || '') + '" placeholder="Rol en la investigación" style="border:0;background:transparent;font-weight:700;font-size:var(--fs-etiqueta);text-transform:uppercase;color:var(--muted);width:100%;padding:0;"></div>' +
    '<div class="field"><input type="text" class="nom" placeholder="Nombre (escribe para buscar)" value="' + esc(p.nombre || '') + '"></div>' +
    '<div class="field"><input type="text" class="ced" placeholder="Cédula" inputmode="numeric" value="' + esc(p.cedula || '') + '"></div>' + UI.padHTML('padInv' + n);
  $('iEquipo').appendChild(d);
  UI.activarPad('padInv' + n, p.firma);
  UI.autocompletar(d.querySelector('.nom'), (x)=>{ d.querySelector('.nom').value = x.nombre; d.querySelector('.ced').value = x.cedula || ''; });
}
$('btnMasEquipo').addEventListener('click', ()=> agregarIntegrante({ rol:'Integrante' }));
function leerInv(estado){
  const sel = (id)=> [...$(id).querySelectorAll('input:checked')].map((c)=> c.value);
  const prev = actual.investigacion || {};
  // v148: corregir una investigación ya cerrada no le cambia la fecha de terminación (antes quedaba «fuera de plazo»).
  return { furat: leerFurat(), licExpedida: $('iLicExp').value.trim(), repLegal: $('iRepLegal').value.trim(), estado, fecha: estado === 'CERRADA' ? (prev.estado === 'CERRADA' && prev.fecha ? prev.fecha : UI.hoy()) : (prev.fecha || ''), licencia: ($('iLicencia') && $('iLicencia').value.trim()) || prev.licencia || '', inicio: prev.inicio || UI.hoy(), hechos: $('iHechos').value.trim(), analisis: $('iAnalisis').value.trim(), conclusiones: $('iConclusiones').value.trim(),
    problema: (capturarPorque(), pqEst.problema), porques: pqEst.resp.filter(Boolean), raizEn: pqEst.raizEn, raiz: $('iRaiz').value.trim(),
    causas: { actos: sel('cActos'), condiciones: sel('cCondiciones'), personales: sel('cPersonales'), trabajo: sel('cTrabajo') },
    equipo: [...$('iEquipo').querySelectorAll('.equipo-inv')].map((d)=> ({ rol: d.querySelector('.rolTxt').value.trim(), nombre: d.querySelector('.nom').value.trim(), cedula: d.querySelector('.ced').value.trim(), firma: UI.firma('padInv' + d.dataset.n) || null })).filter((x)=> x.nombre) };
}
async function guardarInv(estado){
  const inv = leerInv(estado);
  if (estado === 'CERRADA') {
    const falta = [];
    if (inv.equipo.length < 2) falta.push('al menos 2 integrantes del equipo investigador');
    // v143: Res. 1401 de 2007, art. 7: jefe inmediato, COPASST o vigía y responsable de SST; si es grave o mortal, profesional con licencia en SST
    // v148: cada rol obligatorio lo cubre una persona distinta; «COPASST» ya no cuenta como «SST».
    const roles = inv.equipo.map((x)=> UI.norm(x.rol || ''));
    const usados = new Set(), tomar = (re, no)=> { const i = roles.findIndex((r, k)=> !usados.has(k) && re.test(r) && !(no && no.test(r))); if (i === -1) return false; usados.add(i); return true; };
    if (!tomar(/jefe|supervisor/)) falta.push('el jefe inmediato o supervisor en el equipo');
    if (!tomar(/copasst|vigia/)) falta.push('un representante del COPASST o el vigía (otra persona)');
    if (!tomar(/responsable.*(sst|seguridad)|\bsg-?sst\b|coordinador.*sst|lider.*sst|^sst/, /copasst|vigia|licencia/)) falta.push('el responsable de SST (otra persona; «representante del COPASST» no cuenta)');
    if (actual.clase === AT && (actual.grave || actual.mortal) && !roles.some((r)=> /licencia/.test(r))) falta.push('un profesional con licencia en SST (accidente ' + (actual.mortal ? 'mortal' : 'grave') + ')');
    if (actual.clase === AT && (actual.grave || actual.mortal) && !inv.licencia) falta.push('el número de la licencia en SST del profesional');
    if (inv.equipo.some((x)=> !x.firma)) falta.push('la firma de cada integrante');
    const nc = Object.keys(inv.causas).reduce((n, k)=> n + inv.causas[k].length, 0);
    if (!nc) falta.push('las causas (inmediatas y básicas)');
    if (!inv.hechos) falta.push('la descripción de los hechos');
    if (!inv.raiz) falta.push('la causa raíz (responde los porqués y marca «Esta es la causa raíz», o escríbela)');
    Valida.limpiar($('scrInv'));
    if (!inv.hechos) Valida.marcar($('iHechos'), 'falta'); if (!inv.raiz) Valida.marcar($('iRaiz'), 'falta');
    if (falta.length) { $('msgInv').textContent = 'Para terminar falta: ' + falta.join(', ') + '.'; return; }
    if (CULPA_PQ.test(inv.raiz) && !await Dialogo.confirmar('La causa raíz «' + recortar(inv.raiz, 80) + '» habla de la persona (falta de atención, descuido…), no de lo que falló en el trabajo. ¿Terminar así de todas formas?')) return;
  }
  $('msgInv').textContent = 'Guardando…';
  const ok = await parche({ investigacion: inv }, '✓ Investigación guardada');
  if (!ok) { $('msgInv').textContent = $('msgDet').textContent; return; }
  $('msgInv').textContent = '';
  show('scrDetalle');
  if (estado === 'CERRADA' && !acciones.length) UI.toast('Ahora registra las medidas como acciones del plan de acción.');
}
$('btnGuardarInv').addEventListener('click', ()=> guardarInv('EN CURSO'));
$('btnCerrarInv').addEventListener('click', ()=> guardarInv('CERRADA'));
$('volverInv').addEventListener('click', (e)=>{ e.preventDefault(); show('scrDetalle'); });

/* ── PDF del reporte (con la investigación y sus acciones) ── */
$('btnPdfRep').addEventListener('click', ()=>{
  const d = actual, l = d.lesionado || {}, inv = d.investigacion || {}, f = d.furat || {};
  let h = UI.cabecera('SG-REPORTE', d.clase === AT || d.clase === 'Incidente' ? 'REPORTE E INVESTIGACIÓN DE ' + d.clase.toUpperCase() : 'REPORTE DE ' + d.clase.toUpperCase(), 'Registro ' + d.id + (d.estado === 'CERRADO' ? ' · CERRADO' : ''));
  h += UI.seccion('1. Datos del evento', UI.tablaDatos([['Clase', d.clase], ['Fecha y hora', UI.corta(d.fecha) + ' ' + (d.hora || '')], ['Lugar', d.lugar || '—'], ['Centro de costo', d.centro || '—'],
    ['Potencial', d.potencial || '—'], ['Reportado por', d.anonimo ? 'Anónimo' : (d.reportadoPor || '—')]]) + UI.textoLargo(d.descripcion) +
    (d.categoria || d.relacionados ? UI.tablaDatos([['Categoría', d.categoria === 'Otros' ? 'Otros: ' + (d.categoriaOtra || '') : (d.categoria || '')], ['Relacionados', d.relacionados || '']]) : '') +
    (d.accionInmediata ? UI.tablaDatos([['Acción inmediata', d.accionInmediata]]) : '') +
    (d.planSugerido || d.consecuencias ? UI.tablaDatos([['Plan de acción sugerido', d.planSugerido || ''], ['Consecuencias que se evitan', d.consecuencias || '']]) : '') + UI.fotosHoja(d.fotos));
  if (d.clase === AT) h += UI.seccion('2. Persona lesionada y reporte a la ARL', UI.tablaDatos([['Nombre', l.nombre || '—'], ['Cédula', l.cedula || '—'], ['Cargo', l.cargo || '—'], ['Atención', l.atencion || '—'],
    ['Parte del cuerpo', l.parteCuerpo || '—'], ['Tipo de lesión', l.tipoLesion || '—'], ['Mecanismo', l.mecanismo || '—'], ['Agente', l.agente || '—'],
    ['Gravedad', d.mortal ? 'MORTAL' : d.grave ? 'GRAVE' : 'Leve'], ['Días de incapacidad / cargados', (d.diasIncapacidad || 0) + ' / ' + (d.diasCargados || 0)],
    ['FURAT', f.radicado ? 'Radicado el ' + UI.corta(f.fecha) + (f.numero ? ' · N.º ' + f.numero : '') : 'Pendiente (plazo ' + UI.corta(Festivos.sumarHabiles(d.fecha, 2)) + ')'], ['', '']]));
  if (inv.estado && inv.estado !== 'PENDIENTE') {
    const c = inv.causas || {}, lista = (t, x)=> '<tr><td class="l" style="width:22%">' + esc(t) + '</td><td>' + ((x || []).length ? (x || []).map(esc).join(' · ') : '—') + '</td></tr>';
    h += UI.seccion('3. Investigación (Res. 1401 de 2007) · ' + (inv.estado === 'CERRADA' ? 'terminada el ' + UI.corta(inv.fecha) : 'en curso'),
      UI.textoLargo(inv.hechos) + '<table>' + lista('Actos subestándar', c.actos) + lista('Condiciones subestándar', c.condiciones) + lista('Factores personales', c.personales) + lista('Factores del trabajo', c.trabajo) + '</table>' +
      ((inv.porques || []).length ? '<table><tr><td class="l" colspan="2">5 PORQUÉS · CADENA DE CAUSAS</td></tr>' + (inv.problema ? '<tr><td class="l" style="width:22%">Qué pasó</td><td>' + esc(inv.problema) + '</td></tr>' : '') +
        inv.porques.map((t, i)=> '<tr><td class="l" style="width:22%">Por qué ' + (i + 1) + (i === inv.raizEn ? '<br>CAUSA RAÍZ' : '') + '</td><td' + (i === inv.raizEn ? ' style="background:var(--verde-50);"' : '') + '><i>' + esc(preguntaPorque(inv.problema || d.descripcion, inv.porques, i)) + '</i><br>' + (i === inv.raizEn ? '<b>' + esc(t) + '</b>' : esc(t)) + '</td></tr>').join('') + '</table>' : '') +
      (inv.raiz ? UI.tablaDatos([['Causa raíz', inv.raiz]]) : '') + (inv.analisis ? UI.tablaDatos([['Análisis', inv.analisis]]) : '') + (inv.conclusiones ? UI.tablaDatos([['Conclusiones', inv.conclusiones]]) : '') +
      '<table><tr><th>Rol</th><th>Nombre</th><th>Cédula</th><th>Firma</th></tr>' + (inv.equipo || []).map((x)=> '<tr><td>' + esc(x.rol) + '</td><td>' + esc(x.nombre) + '</td><td>' + esc(x.cedula) + '</td><td>' + UI.firmaHoja(x.firma) + '</td></tr>').join('') + '</table>');
  }
  h += UI.seccion('Acciones (plan de acción)', acciones.length ? '<table><tr><th>Acción</th><th>Responsable</th><th>Compromiso</th><th>Estado</th></tr>' +
    acciones.map((a)=> '<tr><td>' + esc(a.resumen.accion) + '</td><td>' + esc(a.resumen.responsable) + '</td><td>' + esc(UI.corta(a.resumen.fechaCompromiso)) + '</td><td>' + esc(a.estado) + '</td></tr>').join('') + '</table>' : UI.textoLargo('Sin acciones registradas.'));
  const inv0 = actual.investigacion || {}, sinFirmas = inv0.estado !== 'CERRADA' || !(inv0.equipo || []).length || (inv0.equipo || []).some((x)=> !x.firma);
  UI.imprimir([h], false, { registro: { id: actual.id, version: actual.version, actualizado: actual.updatedAt }, borrador: (actual.clase === AT || actual.clase === 'Incidente') && sinFirmas ? 'BORRADOR — investigación sin terminar o sin las firmas del equipo investigador (Res. 1401 de 2007)' : '' });
});

/* ── Navegación ── */
$('btnReportar').addEventListener('click', nuevo);
$('tabs').addEventListener('click', (e)=>{ const b = e.target.closest('[data-tab]'); if (!b) return; filtro = ''; ponerTab(b.dataset.tab); pintar(); });
$('buscar').addEventListener('input', pintar);
document.addEventListener('click', (e)=>{
  const it = e.target.closest('#lista [data-id], #pendLegales [data-id]'); if (it) { const r = abrir(it.dataset.id); if (it.dataset.inv) Promise.resolve(r).then(()=> { if (actual && actual.id === it.dataset.id) abrirInvestigacion(); }); return; }
  if (e.target.closest('[data-volver]')) { e.preventDefault(); show('scrLista'); pintar(); }
});
window.addEventListener('outbox-enviado', ()=> cargar());
// v109: ?nuevo=1&pqrs=1 (tarjeta «PQRS» del inicio) abre el formulario ya en PQRS; se puede cambiar de opción arriba.
cargar().then(()=>{ if (/[?&]tab=investigaciones/.test(location.search)) { ponerTab('investigaciones'); pintar(); } if (/[?&]nuevo=1/.test(location.search)) { nuevo(); if (/[?&]pqrs=1/.test(location.search)) ponerClase(PQ); } else if (location.hash.length > 1) abrir(decodeURIComponent(location.hash.slice(1))); });
