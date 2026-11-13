/* proveedores.app.js — código de proveedores.html (v162: fuera del HTML para que el celular lo guarde en caché). */
OfflineBanner.init();
OutboxBadge.init();
if (typeof Outbox !== 'undefined') Outbox.flush();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();

/* Evaluación de proveedores y contratistas (Dec. 1072 de 2015, arts. 2.2.4.6.27 y 2.2.4.6.28;
   Res. 0312 de 2019, estándares 2.9.1 y 2.10.1). Criterios, pesos, rangos y requisitos en proveedores-catalogo.js. */
const $ = UI.$, P = Proveedores;
let rows = [], tab = 'matriz', anioCrono = Number(UI.hoy().slice(0, 4)), hashAbierto = false;
const F = { q: '', tipo: '', clas: '', estado: 'activos', crit: false, verCerrados: false };
const prov = ()=> rows.filter((x)=> x.tipo === 'proveedor');
const esSst = ()=> { try { return !Sesion.modo() || !Sesion.yo() || ['admin', 'sst'].indexOf(Sesion.rol()) !== -1; } catch (e) { return true; } };
const pctTxt = (v)=> (v === '' || v == null || isNaN(Number(v)) ? '—' : String(Math.round(Number(v) * 10) / 10).replace('.', ',') + ' %');
const num = (v)=> (v === '' || v == null ? '' : Number(v));
const dinero = (v)=> (v === '' || v == null ? '—' : '$ ' + Number(v).toLocaleString('es-CO'));
const porFecha = (a, b)=> String(a.fecha || '').localeCompare(String(b.fecha || ''));
const catNombre = (s)=> s.categoriaNombre || (P.categoria(s.categoria) || {}).n || '';
const reqsDe = (d)=> P.requisitos(d.categoria === 'OTRO' ? d.categoriaBase : d.categoria);
const ultimaEval = (d)=> (d.evaluaciones || []).slice().sort(porFecha).pop() || null;
const fechasDe = (s)=> String(s.fechasEval || '').split(/\s*,\s*/).filter((f)=> /^\d{4}-\d{2}-\d{2}$/.test(f));
const corto = (c)=> ({ 'ACEPTABLE CON PLAN DE MEJORA': 'CON PLAN DE MEJORA', 'NO APTO (requisito excluyente)': 'NO APTO ★' })[c] || c;
function show(id){ document.querySelectorAll('.screen').forEach((s)=>s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
async function cargar(){
  if (UI.avisoServidor($('avisoSrv'))) { $('panel').innerHTML = ''; return; }
  const r = await SGSST.listar('proveedor,compraprov');
  UI.avisoCopia($('avisoCopia'), r);
  rows = r.rows; pintar();
  const h = decodeURIComponent((location.hash || '').slice(1));
  if (!hashAbierto && h && prov().some((x)=> x.id === h)) { hashAbierto = true; verFicha(h); }
  else if (!hashAbierto && h && procs().some((x)=> x.id === h)) { hashAbierto = true; continuarProceso(h); }
}
/* v109: las cifras de arriba llevan a la lista filtrada (UI: .kpi[data-ir="tab:matriz|filtro:x"]). */
window.filtrarKpi = (x)=> { Object.assign(F, { q: '', tipo: '', crit: false, estado: 'activos', clas: x === 'activos' ? '' : x, verCerrados: false }); tab = 'matriz'; document.querySelectorAll('#tabs button').forEach((b)=> b.classList.toggle('on', b.dataset.tab === 'matriz')); pintar(); };
function estadoDe(s){ return P.estadoReev(s.proximaEvaluacion, UI.hoy(), s.resultado); }
function evaluado(s){ return !!s.resultado && s.resultado !== 'PENDIENTE'; }
function pintar(){
  const act = prov().filter((x)=> x.resumen.activo !== false), ev = act.filter((x)=> evaluado(x.resumen));
  const conf = ev.filter((x)=> P.color(x.resumen.resultado) === 'ok').length, venc = act.filter((x)=> estadoDe(x.resumen) === 'VENCIDA'), prox = act.filter((x)=> estadoDe(x.resumen) === 'Próxima (≤30 días)');
  const conFecha = act.filter((x)=> x.resumen.proximaEvaluacion), exc = act.filter((x)=> Number(x.resumen.excluyentesFaltan) > 0), hom = act.filter((x)=> x.resumen.homologado === true);
  const pctConf = ev.length ? Math.round(conf * 100 / ev.length) : null;
  $('nMat').textContent = act.length; $('nReev').textContent = venc.length + prox.length;
  const ab = abiertos(), enCot = ab.filter((x)=> Number(x.resumen.etapa) === 2);
  $('kpis').innerHTML = '<div class="kpi" data-ir="tab:matriz|filtro:activos"><div class="v">' + act.length + '</div><div class="n">proveedores y contratistas activos</div><div class="f">' + act.filter((x)=> x.resumen.critico === true).length + ' críticos</div></div>' +
    '<div class="kpi ' + (pctConf == null ? '' : pctConf >= 80 ? 'ok' : 'mal') + '"' + (ev.length - conf ? ' data-ir="tab:matriz|filtro:noconf"' : '') + '><div class="v">' + (pctConf == null ? '—' : pctConf + ' %') + '</div><div class="n">confiables (meta ≥ 80 %)</div><div class="f">' + conf + ' de ' + ev.length + ' evaluados</div></div>' +
    '<div class="kpi ' + (venc.length ? 'mal' : 'ok') + '"' + (venc.length ? ' data-ir="tab:matriz|filtro:vencida"' : '') + '><div class="v">' + venc.length + '</div><div class="n">reevaluaciones vencidas</div><div class="f">' + (conFecha.length ? 'cumplimiento ' + Math.round((1 - venc.length / conFecha.length) * 100) + ' % · ' : '') + prox.length + ' en 30 días</div></div>' +
    '<div class="kpi ' + (exc.length ? 'mal' : 'ok') + '"' + (exc.length ? ' data-ir="tab:matriz|filtro:excl"' : '') + '><div class="v">' + exc.length + '</div><div class="n">con requisitos excluyentes ★ sin cumplir</div></div>' +
    '<div class="kpi ' + (act.length - ev.length ? 'mal' : 'ok') + '"' + (act.length - ev.length ? ' data-ir="tab:matriz|filtro:sin"' : '') + '><div class="v">' + (act.length - ev.length) + '</div><div class="n">sin evaluar</div></div>' +
    '<div class="kpi ' + (ab.length ? 'pronto' : '') + '"' + (ab.length ? ' data-ir="tab:matriz|filtro:curso"' : '') + '><div class="v">' + ab.length + '</div><div class="n">ingresos en curso</div><div class="f">' + enCot.length + ' en cotización</div></div>' +
    '<div class="kpi"' + (hom.length ? ' data-ir="tab:matriz|filtro:hom"' : '') + '><div class="v">' + hom.length + '</div><div class="n">homologados</div></div>';
  ({ matriz: pintarMatriz, inicial: pintarInicial, reev: pintarReev, crono: pintarCrono, sst: pintarSst })[tab]($('panel'));
}
function item(x, titulo, sub, chip, clase, claseChip){ return '<button type="button" class="item ' + (clase || '') + '" data-id="' + esc(x.id) + '"><div class="fila"><div><div class="t">' + titulo + '</div>' + (sub || []).filter(Boolean).map((s)=> '<div class="m">' + s + '</div>').join('') + (x.pendiente ? '<div class="m"><span class="pend">⏳ pendiente de enviar</span></div>' : '') + '</div>' + (chip ? '<span class="chip ' + (claseChip || clase || '') + '">' + chip + '</span>' : '') + '</div></button>'; }
function itemProv(x){
  const s = x.resumen, est = estadoDe(s), c = s.activo === false ? 'gris' : est === 'VENCIDA' ? 'mal' : P.color(s.resultado);
  return item(x, esc(s.nombre) + (s.homologado === true ? ' · <span class="chip azul">Homologado</span>' : ''),
    [esc([s.nit && 'NIT ' + s.nit, s.tipoProveedor, catNombre(s)].filter(Boolean).join(' · ')),
     esc([s.nivel && 'Nivel ' + s.nivel, s.critico === true ? 'Crítico' : s.nivel ? 'No crítico' : '', s.docsPct !== '' && s.docsPct != null ? 'Documentos ' + pctTxt(s.docsPct) : ''].filter(Boolean).join(' · ')) +
       (Number(s.excluyentesFaltan) > 0 ? ' · <b class="u-mal">★ ' + esc(s.excluyentesFaltan) + ' excluyente(s) sin cumplir</b>' : ''),
     evaluado(s) ? esc((s.tipoEval || 'Evaluación') + ' ' + UI.corta(s.fechaEvaluacion) + ' · ' + pctTxt(s.puntaje)) + (s.proximaEvaluacion ? ' · próxima ' + esc(UI.corta(s.proximaEvaluacion)) + (est === 'VENCIDA' ? ' <b class="u-mal">(vencida)</b>' : '') : '') : 'Sin evaluación'],
    esc(s.activo === false ? 'Inactivo' : corto(s.resultado) || 'Sin evaluar'), c, s.activo === false ? 'gris' : P.color(s.resultado));
}
function filtrar(l){
  const q = UI.norm(F.q).trim();
  return l.filter((x)=> { const s = x.resumen, c = P.color(s.resultado);
    if (F.estado === 'activos' && s.activo === false) return false;
    if (F.estado === 'inactivos' && s.activo !== false) return false;
    if (F.tipo && s.tipoProveedor !== F.tipo) return false;
    if (F.crit && s.critico !== true) return false;
    if (F.clas === 'sin' && evaluado(s)) return false;
    if (F.clas === 'vencida' && estadoDe(s) !== 'VENCIDA') return false;
    if (F.clas === 'excl' && !(Number(s.excluyentesFaltan) > 0)) return false;
    if (F.clas === 'noconf' && (!evaluado(s) || c === 'ok')) return false;
    if (F.clas === 'hom' && s.homologado !== true) return false;
    if (F.clas === 'curso') return false;
    if (/^(ok|pronto|mal)$/.test(F.clas) && (c !== F.clas || !evaluado(s))) return false;
    if (q && !UI.norm([s.nombre, s.nit, catNombre(s), s.servicio, s.categoria].join(' ')).includes(q)) return false;
    return true; }).sort((a, b)=> String(a.resumen.nombre).localeCompare(String(b.resumen.nombre)));
}

/* ── Matriz ── */
function pintarMatriz(panel){
  panel.innerHTML = '<div class="acciones-top">' + (esSst() ? '<button type="button" class="btn amber" id="nProv">+ Nuevo proveedor (por etapas)</button>' : '') + '<button type="button" class="btn ghost" id="pdfMat">Matriz de proveedores (PDF)</button><button type="button" class="btn ghost" id="csvMat">Exportar CSV</button>' +
      (esSst() ? '<button type="button" class="btn ghost" id="nProvYa" title="Para pasar a la matriz un proveedor que ya trabaja con la empresa, sin cotizaciones">Cargar uno ya contratado</button>' : '') + '</div>' +
    '<div id="lProc"></div>' +
    '<input type="search" class="buscar" id="fQ" placeholder="Buscar por nombre, NIT o categoría" value="' + esc(F.q) + '">' +
    '<div class="filtros"><select id="fTipo" aria-label="Tipo" data-sin-otro><option value="">Todos los tipos</option>' + P.TIPOS_PROVEEDOR.map((t)=> '<option' + (F.tipo === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
    '<select id="fClas" aria-label="Clasificación" data-sin-otro>' + [['', 'Todas las clasificaciones'], ['ok', 'Confiables'], ['pronto', 'Condicionados / con plan de mejora'], ['mal', 'No aptos / rechazados'], ['noconf', 'No confiables (condicionados y no aptos)'], ['sin', 'Sin evaluar'], ['vencida', 'Reevaluación vencida'], ['excl', 'Con ★ excluyentes sin cumplir'], ['hom', 'Homologados'], ['curso', 'Solo ingresos en curso']].map((o)=> '<option value="' + o[0] + '"' + (F.clas === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
    '<select id="fEst" aria-label="Estado" data-sin-otro>' + [['activos', 'Activos'], ['inactivos', 'Inactivos / retirados'], ['todos', 'Activos e inactivos']].map((o)=> '<option value="' + o[0] + '"' + (F.estado === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
    '<label class="check"><input type="checkbox" id="fCrit"' + (F.crit ? ' checked' : '') + '> Solo críticos</label></div><div id="lProv"></div><div id="lCand"></div>';
  const lista = ()=> { const l = filtrar(prov());
    $('lProv').innerHTML = F.clas === 'curso' ? '' : (l.length ? '<div class="ayuda u-mb6">' + l.length + ' de ' + prov().length + '</div>' + l.map(itemProv).join('') : '<div class="empty">' + (prov().length ? 'Nadie coincide con el filtro.' : 'Aún no hay proveedores ni contratistas. Empieza con «+ Nuevo proveedor (por etapas)»: necesidad, cotizaciones, selección, documentos, evaluación y alta.') + '</div>');
    $('lProv').querySelectorAll('[data-id]').forEach((b)=> b.addEventListener('click', ()=> verFicha(b.dataset.id)));
    pintarProcesos($('lProc')); pintarCandidatos($('lCand')); };
  $('fQ').addEventListener('input', ()=> { F.q = $('fQ').value; lista(); });
  [['fTipo', 'tipo'], ['fClas', 'clas'], ['fEst', 'estado']].forEach((p)=> $(p[0]).addEventListener('change', ()=> { F[p[1]] = $(p[0]).value; lista(); }));
  $('fCrit').addEventListener('change', ()=> { F.crit = $('fCrit').checked; lista(); });
  lista();
  if ($('nProv')) $('nProv').addEventListener('click', nuevoProceso);
  if ($('nProvYa')) $('nProvYa').addEventListener('click', ()=> editar({ id: SGSST.nuevoId('PRV'), nuevo: true, activo: true, requisitos: {}, evaluaciones: [] }));
  $('pdfMat').addEventListener('click', ()=> pdfMatriz(filtrar(prov())));
  $('csvMat').addEventListener('click', ()=> csvMatriz(filtrar(prov())));
}

/* ── Ficha del proveedor ── */
async function verFicha(id){
  const d = await Registros.abrir(id); if (!d) return;
  const h = UI.hoy(), reqs = reqsDe(d), r12 = P.revisarDocs(reqs, d.requisitos, [1, 2], h), r3 = P.revisarDocs(reqs, d.requisitos, [3], h), todo = P.revisarDocs(reqs, d.requisitos, null, h);
  const u = ultimaEval(d), est = P.estadoReev(d.proximaEvaluacion, h, d.resultado), c = P.color(d.resultado), cand = P.candidatoHomologacion(d.evaluaciones);
  const s = $('scrFicha'), puede = esSst();
  const marca = (q)=> { const m = (d.requisitos || {})[q.k] || {}; const venc = m.e === 'Sí' && m.v && m.v < h;
    return venc ? '<span class="chip mal">Vencido ' + esc(UI.corta(m.v)) + '</span>' : m.e === 'Sí' ? '<span class="chip ok">Sí' + (m.v ? ' · vence ' + esc(UI.corta(m.v)) : '') + '</span>' : m.e === 'No' ? '<span class="chip mal">No</span>' : m.e === 'N.A.' ? '<span class="chip">N.A.</span>' : '<span class="chip pronto">Sin verificar</span>'; };
  s.innerHTML = '<div class="hdr"><a class="back" href="#" data-volver>← Volver</a><div class="eyebrow">' + esc(d.id) + '</div><h1>' + esc(d.nombre) + '</h1><p>' + esc([d.nit && 'NIT ' + d.nit, d.tipoProveedor].filter(Boolean).join(' · ')) + '</p></div>' +
    '<div class="acciones-top">' + (puede ? '<button type="button" class="btn amber" id="fEval">' + (u ? 'Reevaluar' : 'Evaluación inicial') + '</button><button type="button" class="btn ghost" id="fEdit">Datos y documentos</button>' : '') +
      (u ? '<button type="button" class="btn ghost" id="fPdf">Formato de evaluación (PDF)</button>' : '') + (puede && u ? '<button type="button" class="btn ghost" id="fEvalI">Nueva evaluación inicial</button>' : '') + (puede ? '<button type="button" class="btn ghost" id="fAcc">+ Acción de mejora</button>' : '') + '</div>' +
    '<div class="resultado ' + (est === 'VENCIDA' ? 'mal' : c === 'gris' ? '' : c) + '"><div class="grande">' + esc(d.resultado || 'Sin evaluar') + (u ? ' · ' + pctTxt(u.pct) : d.puntaje !== '' && d.puntaje != null ? ' · ' + pctTxt(d.puntaje) : '') + '</div>' +
      (u ? '<div class="m">' + esc(u.tipo === 'Inicial' ? 'Evaluación inicial' : 'Reevaluación ' + String(u.tipoReev || '').toLowerCase()) + ' del ' + esc(UI.corta(u.fecha)) + '</div>' : '') +
      (P.DECISION[d.resultado] ? '<p class="ayuda" style="margin:6px 0 0;">' + esc(P.DECISION[d.resultado]) + '</p>' : '') +
      '<div class="dato"><span>Próxima evaluación</span><b>' + (d.proximaEvaluacion ? esc(UI.corta(d.proximaEvaluacion)) + ' · ' + esc(est) : esc(est || (u ? 'No se programa' : 'Hacer la evaluación inicial antes de contratar'))) + '</b></div>' +
      '<div class="dato"><span>Periodicidad</span><b>' + esc(d.nivel ? P.periodicidad(d.critico === true) + (d.critico === true ? ' (crítico)' : '') : '—') + '</b></div>' +
      '<div class="dato"><span>Homologación</span><b>' + (d.homologado === true ? 'Homologado' + (d.fechaHomologacion ? ' desde ' + esc(UI.corta(d.fechaHomologacion)) : '') : cand ? 'Candidato: dos evaluaciones CONFIABLE seguidas (proponer a Gerencia)' : 'No homologado') + '</b></div></div>' +
    (reqs.length ? '<div class="aviso ' + (r12.estado === 'CUMPLE' && r3.estado === 'CUMPLE' ? 'ok' : r12.estado === 'NO CUMPLE' || r3.estado === 'NO CUMPLE' ? '' : 'amar') + '">' +
      '<b>Excluyentes ★ para contratar (etapas 1 y 2):</b> ' + esc(r12.estado) + (r12.faltan.length ? ' — falta: ' + esc(r12.faltan.join('; ')) : r12.pendientes.length ? ' — sin verificar: ' + r12.pendientes.length : '') +
      '<br><b>Excluyentes ★ para iniciar o continuar el servicio (etapa 3):</b> ' + esc(r3.estado) + (r3.faltan.length ? ' — no puede iniciar ni continuar hasta corregir: ' + esc(r3.faltan.join('; ')) : r3.pendientes.length ? ' — sin verificar: ' + r3.pendientes.length : '') +
      (todo.vencidos.length ? '<br><b>Vencidos:</b> ' + esc(todo.vencidos.join('; ')) : '') + '</div>' : '<div class="aviso amar">Sin categoría de la matriz: elige la categoría en «Datos y documentos» para ver los requisitos de cada etapa.</div>') +
    '<div class="card"><h2>Datos</h2>' + [['Categoría', [d.categoria && d.categoria !== 'OTRO' ? d.categoria : '', catNombre(d) || '—'].filter(Boolean).join(' · ') + (d.categoria === 'OTRO' && P.categoria(d.categoriaBase) ? ' (requisitos de ' + P.categoria(d.categoriaBase).n + ')' : '')],
      ['Nivel de riesgo', d.nivel || '—'], ['Proveedor crítico', d.critico === true ? 'Sí' : d.nivel ? 'No' : '—'], ['Qué suministra o hace', d.servicio || '—'], ['Persona', d.tipoPersona || '—'], ['Ciudad', d.ciudad || '—'],
      ['Contacto', d.contacto || '—'], ['Correo', d.correo || '—'], ['Teléfono', d.telefono || '—'], ['Calificación de sus estándares mínimos', d.calificacion0312 === '' || d.calificacion0312 == null ? '—' : d.calificacion0312 + ' %'],
      ['Documentos de la matriz', pctTxt(d.docsPct)], ['Estado', d.activo === false ? 'Inactivo / retirado' : 'Activo']].map((p)=> '<div class="dato"><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>').join('') +
      (d.observaciones ? '<div class="texto-largo u-mt8">' + esc(d.observaciones) + '</div>' : '') + '</div>' +
    (reqs.length ? '<div class="card"><h2>Documentos y requisitos por etapa</h2>' + [1, 2, 3, 4].map((e)=> { const l = reqs.filter((q)=> q.etapa === e); return l.length ? '<div class="grupo-t">' + esc(P.ETAPAS[e]) + '</div>' + l.map((q)=> '<div class="dato"><span>' + (q.excl ? '<b class="estrella">★</b> ' : '') + esc(q.texto) + '</span>' + marca(q) + '</div>').join('') : ''; }).join('') + '</div>' : '') +
    '<div class="card"><h2>Evaluaciones</h2>' + ((d.evaluaciones || []).length ? d.evaluaciones.slice().sort(porFecha).reverse().map((v)=> '<button type="button" class="item ' + P.color(v.clasificacion) + '" data-ev="' + esc(v.uid) + '"><div class="fila"><div><div class="t">' + esc(v.tipo === 'Inicial' ? 'Evaluación inicial' : 'Reevaluación ' + String(v.tipoReev || '').toLowerCase()) + ' · ' + esc(UI.corta(v.fecha)) + '</div><div class="m">' + pctTxt(v.pct) + ' · ' + esc(v.clasificacion) + ' · PDF del formato</div></div><span class="chip ' + P.color(v.clasificacion) + '">' + esc(corto(v.clasificacion)) + '</span></div></button>').join('')
      : (d.resultado ? '<div class="m">Evaluación anterior (lista de criterios SST): ' + esc(d.resultado) + ' · ' + pctTxt(d.puntaje) + ' · ' + esc(UI.corta(d.fechaEvaluacion)) + '. Las nuevas se hacen con el formato completo.</div>' : '<div class="empty">Sin evaluaciones. Haz la evaluación inicial antes de contratar.</div>')) + '</div>' +
    '<div class="card"><div id="fAdj"></div><div id="fHist"></div></div>';
  UI.adjuntos($('fAdj'), { id: d.id, lista: d.adjuntos || [], titulo: 'Soportes (RUT, cámara de comercio, certificados…)', soloLectura: !puede });
  $('fHist').appendChild(UI.botonHistorial(d.id, d.nombre));
  if ($('fEdit')) $('fEdit').addEventListener('click', ()=> editar(d));
  if ($('fEval')) $('fEval').addEventListener('click', ()=> (u ? evaluarReev(d) : evaluarInicial(d)));
  if ($('fEvalI')) $('fEvalI').addEventListener('click', ()=> evaluarInicial(d));
  if ($('fPdf')) $('fPdf').addEventListener('click', ()=> pdfEvaluacion(d, u));
  if ($('fAcc')) $('fAcc').addEventListener('click', ()=> UI.nuevaAccion({ origen: 'Evaluación de proveedores', origenRef: d.id, hallazgo: d.nombre + (d.resultado ? ': ' + d.resultado + (u ? ' (' + pctTxt(u.pct) + ')' : '') : '') }));
  s.querySelectorAll('[data-ev]').forEach((b)=> b.addEventListener('click', ()=> pdfEvaluacion(d, d.evaluaciones.find((v)=> v.uid === b.dataset.ev))));
  show('scrFicha');
}

/* ── Requisitos por etapa (Sí / No / N.A. y fecha de vencimiento) ── */
function htmlReqs(reqs, marcas, etapas, conFecha){
  return [1, 2, 3, 4].filter((e)=> !etapas || etapas.indexOf(e) !== -1).map((e)=> { const l = reqs.filter((q)=> q.etapa === e); if (!l.length) return '';
    return '<div class="etapa"><h3>' + esc(P.ETAPAS[e]) + '</h3><div class="ayuda">' + esc(P.ETAPA_CUANDO[e]) + '</div>' + l.map((q)=> { const m = marcas[q.k] || {};
      return '<div class="req' + (q.excl ? ' excl' : '') + '" data-rq="' + esc(q.k) + '"><div class="req-t">' + (q.excl ? '<b class="estrella" title="Excluyente">★</b> ' : '') + esc(q.texto) + '</div>' +
        '<div class="req-m">' + esc([q.aplica === 'Siempre' ? 'Siempre' + (q.cond ? ' (' + q.cond.toLowerCase() + ')' : '') : q.aplica, q.vig && 'Vigencia: ' + q.vig, 'Verifica: ' + q.ver, q.base].filter(Boolean).join(' · ')) + '</div>' +
        '<div class="req-b"><div class="seg-btn" data-req="' + esc(q.k) + '">' + ['Sí', 'No', 'N.A.'].map((v)=> '<button type="button" data-v="' + v + '"' + (m.e === v ? ' class="on"' : '') + ' aria-label="' + v + ': ' + esc(q.texto) + '">' + v + '</button>').join('') + '</div>' +
        (conFecha && q.vig ? '<label class="req-v"><small>Vence</small><input type="date" data-vence="' + esc(q.k) + '" value="' + esc(m.v || '') + '" aria-label="Vence: ' + esc(q.texto) + '"></label>' : '') + '</div></div>'; }).join('') + '</div>'; }).join('');
}
function activarReqs(raiz, marcas, alCambiar){
  raiz.querySelectorAll('.seg-btn[data-req]').forEach((g)=> g.addEventListener('click', (e)=> { const b = e.target.closest('[data-v]'); if (!b) return;
    const k = g.dataset.req, on = b.classList.contains('on'); g.querySelectorAll('button').forEach((x)=> x.classList.remove('on'));
    marcas[k] = Object.assign({}, marcas[k]); if (on) delete marcas[k].e; else { b.classList.add('on'); marcas[k].e = b.dataset.v; }
    const r = g.closest('.req'); r.classList.remove('v-falta'); const nx = r.nextElementSibling; if (nx && nx.classList.contains('v-msg')) nx.remove();
    if (alCambiar) alCambiar(); }));
  raiz.querySelectorAll('[data-vence]').forEach((i)=> i.addEventListener('change', ()=> { const k = i.dataset.vence; marcas[k] = Object.assign({}, marcas[k], { v: i.value }); if (alCambiar) alCambiar(); }));
}
/* Seg-btn de una sola opción (Sí/No, 1–5): devuelve el valor al tocar. */
function activarSeg(g, alElegir){ g.addEventListener('click', (e)=> { const b = e.target.closest('[data-v]'); if (!b) return; g.querySelectorAll('button').forEach((x)=> x.classList.toggle('on', x === b));
  g.classList.remove('v-falta'); const p = g.closest('.crit-c'); if (p) p.classList.remove('v-falta'); [g.nextElementSibling, p && p.nextElementSibling].forEach((nx)=> { if (nx && nx.classList && nx.classList.contains('v-msg')) nx.remove(); }); alElegir(b.dataset.v); }); }
function telError(v){ const d = String(v || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''); return !String(v || '').trim() ? 'falta' : d.length < 7 || d.length > 10 ? 'escribe un teléfono de 7 a 10 dígitos' : ''; }

/* Recalcula lo que va en la lista (resumen) a partir de los documentos y de la última evaluación. */
function recalcular(v){
  const h = UI.hoy(), reqs = reqsDe(v), todo = P.revisarDocs(reqs, v.requisitos, null, h), r123 = P.revisarDocs(reqs, v.requisitos, [1, 2, 3], h), r3 = P.revisarDocs(reqs, v.requisitos, [3], h);
  v.docsPct = todo.pct == null ? '' : todo.pct;
  v.excluyentesFaltan = reqs.length ? r123.faltan.length + r123.pendientes.length : '';
  v.faltan3 = reqs.length ? r3.faltan.length + r3.pendientes.length : '';
  const ev = (v.evaluaciones || []).slice().sort(porFecha), u = ev[ev.length - 1];
  v.fechasEval = ev.map((x)=> x.fecha);
  if (u) {
    v.fechaEvaluacion = u.fecha; v.puntaje = Math.round(u.pct); v.resultado = u.clasificacion;
    v.tipoEval = u.tipo === 'Inicial' ? 'Evaluación inicial' : 'Reevaluación ' + String(u.tipoReev || '').toLowerCase();
    v.proximaEvaluacion = P.proxima(u.fecha, u.clasificacion, v.critico === true);
    v.sstPct = u.cal && u.cal[0] ? u.cal[0] * 20 : '';
    v.planMejora = (u.plan || []).length ? u.plan.filter((p)=> p.estado === 'Cerrada eficaz').length + ' de ' + u.plan.length + ' acciones cerradas eficazmente' : u.clasificacion === 'ACEPTABLE CON PLAN DE MEJORA' ? 'Pendiente' : '';
  }
  return v;
}

/* ── Alta y edición: datos, categoría y documentos ── */
function editar(d0){
  const d = JSON.parse(JSON.stringify(d0)), marcas = JSON.parse(JSON.stringify(d.requisitos || {})), s = $('scrEdit');
  const cats = P.categorias(), op = (c)=> '<option value="' + c.c + '">' + esc(c.c + ' · ' + c.n) + '</option>';
  const opCat = '<option value="">— Elige la categoría —</option><optgroup label="Suministro de bienes">' + cats.filter((c)=> c.b === 'Bien').map(op).join('') + '</optgroup><optgroup label="Servicios y contratistas">' + cats.filter((c)=> c.b !== 'Bien').map(op).join('') + '</optgroup><option>Otro</option>';
  const cand = P.candidatoHomologacion(d.evaluaciones);
  s.innerHTML = '<div class="hdr"><a class="back" href="#" data-volver>← Volver</a><div class="eyebrow">' + esc(d.nuevo ? 'Nuevo' : d.id) + '</div><h1>' + (d.nuevo ? 'Nuevo proveedor o contratista' : esc(d.nombre)) + '</h1><p>Datos, categoría de la matriz y documentos por etapa</p></div>' +
    '<div class="card"><h2>Datos</h2><div class="field"><label>Razón social o nombre *</label><input type="text" id="eNom" maxlength="140" value="' + esc(d.nombre || '') + '"></div>' +
    '<div class="grid2">' + campoNit('eNit', 'NIT o cédula *', d.nit) +
    '<div class="field"><label>Persona</label><select id="ePer" data-sin-otro><option value="">—</option><option' + (d.tipoPersona === 'Jurídica' ? ' selected' : '') + '>Jurídica</option><option' + (d.tipoPersona === 'Natural' ? ' selected' : '') + '>Natural</option></select></div></div>' +
    '<div class="grid2"><div class="field"><label>Contacto (nombre) *</label><input type="text" id="eCon" maxlength="80" value="' + esc(d.contacto || '') + '"></div><div class="field"><label>Ciudad</label><input type="text" id="eCiu" maxlength="60" value="' + esc(d.ciudad || '') + '"></div></div>' +
    '<div class="grid2"><div class="field"><label>Correo *</label><input type="email" id="eCor" maxlength="120" value="' + esc(d.correo || '') + '"></div><div class="field"><label>Teléfono *</label><input type="tel" id="eTel" maxlength="20" value="' + esc(d.telefono || '') + '"></div></div></div>' +
    '<div class="card"><h2>Qué suministra</h2><div class="field"><label>Tipo *</label><select id="eTipo" data-sin-otro><option value="">—</option>' + P.TIPOS_PROVEEDOR.map((t)=> '<option' + (d.tipoProveedor === t ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select><div class="ayuda">Define la ponderación de la evaluación inicial: bienes o servicios / contratistas.</div></div>' +
    '<div class="field"><label>Categoría (matriz de requisitos) *</label><select id="eCat">' + opCat + '</select></div><div id="eOtro"></div><div id="eCatInfo" class="ayuda"></div>' +
    '<div class="field"><label>Qué suministra o hace *</label><input type="text" id="eSer" maxlength="140" placeholder="Ej.: Alquiler de andamio certificado y montaje" value="' + esc(d.servicio || '') + '"></div>' +
    '<div class="field"><label>Su calificación de estándares mínimos (Res. 0312) %</label><input type="number" id="e0312" min="0" max="100" step="1" value="' + esc(d.calificacion0312 == null ? '' : d.calificacion0312) + '"></div></div>' +
    '<div class="card"><h2>Documentos y requisitos</h2><p class="ayuda">★ = excluyente: si falta o está vencido, no se contrata (etapa 2) o no puede iniciar ni continuar el servicio (etapa 3). «N.A.» solo en los que dicen «Si aplica».</p><div id="eRes"></div><div id="eReqs"></div><button type="button" class="btn ghost" id="eCorreo">Copiar correo para pedir los documentos</button></div>' +
    '<div class="card"><h2>Estado</h2><label class="check"><input type="checkbox" id="eAct"' + (d.activo !== false ? ' checked' : '') + '> Activo (se le compra o se le contrata)</label>' +
    '<div class="grid2"><div class="field"><label>Homologación</label><select id="eHom" data-sin-otro><option value="No">No homologado</option><option value="Sí"' + (d.homologado === true ? ' selected' : '') + '>Homologado (aprobó Gerencia)</option></select></div><div class="field"><label>Homologado desde</label><input type="date" id="eHomF" value="' + esc(d.fechaHomologacion || '') + '"></div></div>' +
    (cand && d.homologado !== true ? '<div class="aviso info">Dos evaluaciones CONFIABLE seguidas: se puede proponer a Gerencia para la lista de homologados.</div>' : '') +
    '<div class="field"><label>Observaciones</label><textarea id="eObs" maxlength="1500">' + esc(d.observaciones || '') + '</textarea></div></div>' +
    '<div id="eMsg"></div><div class="barra-guardar"><button type="button" class="btn amber" id="eOk">Guardar</button><button type="button" class="btn ghost" data-volver>Cancelar</button></div>';
  show('scrEdit');
  const sel = $('eCat');
  if (d.categoria === 'OTRO' && d.categoriaNombre) sel.value = d.categoriaNombre; else if (d.categoria) sel.value = d.categoria;
  const codigo = ()=> { const v = sel.value; return P.categoria(v) ? v : v && v !== 'Otro' ? 'OTRO' : v; };
  const base = ()=> (codigo() === 'OTRO' ? ($('eBase') ? $('eBase').value : '') : codigo());
  const resumenDocs = ()=> { const reqs = P.requisitos(base()), h = UI.hoy(); if (!reqs.length) { $('eRes').innerHTML = ''; return; }
    const r12 = P.revisarDocs(reqs, marcas, [1, 2], h), r3 = P.revisarDocs(reqs, marcas, [3], h), t = P.revisarDocs(reqs, marcas, null, h);
    $('eRes').innerHTML = '<div class="aviso ' + (r12.estado === 'CUMPLE' && r3.estado === 'CUMPLE' ? 'ok' : r12.estado === 'NO CUMPLE' || r3.estado === 'NO CUMPLE' ? '' : 'amar') + '">Etapas 1 y 2: ★ ' + esc(r12.estado) + ' · Etapa 3: ★ ' + esc(r3.estado) + ' · Cumplimiento documental ' + pctTxt(t.pct) +
      (t.naObligatorio.length ? '<br>⚠ N.A. en requisito obligatorio: ' + esc(t.naObligatorio.join('; ')) : '') + '</div>'; };
  const pintarReqs = ()=> { const reqs = P.requisitos(base()); $('eReqs').innerHTML = reqs.length ? htmlReqs(reqs, marcas, null, true) : '<div class="ayuda">Elige la categoría para ver sus requisitos.</div>'; activarReqs($('eReqs'), marcas, resumenDocs); resumenDocs(); $('eCorreo').hidden = !reqs.length; };
  const pintarCat = ()=> {
    const c = codigo(), cat = P.categoria(c);
    if (c === 'OTRO') {
      if (!$('eBase')) $('eOtro').innerHTML = '<div class="field"><label>Categoría más parecida (para los requisitos) *</label><select id="eBase" data-sin-otro><option value="">— Elige —</option>' + cats.map(op).join('') + '</select></div>' +
        '<div class="grid2"><div class="field"><label>Nivel de riesgo *</label><select id="eNiv" data-sin-otro><option value="">—</option>' + Object.keys(P.NIVELES).map((n)=> '<option>' + n + '</option>').join('') + '</select></div><div class="field"><label>¿Proveedor crítico? *</label><select id="eCri" data-sin-otro><option value="">—</option><option>Sí</option><option>No</option></select></div></div>';
      const b = $('eBase'); if (d.categoriaBase && !b.value) { b.value = d.categoriaBase; $('eNiv').value = d.nivel || ''; $('eCri').value = d.critico === true ? 'Sí' : d.critico === false ? 'No' : ''; }
      if (!b.dataset.ok) { b.dataset.ok = '1'; b.addEventListener('change', ()=> { const cb = P.categoria(b.value); if (cb) { if (!$('eNiv').value) $('eNiv').value = cb.nivel; if (!$('eCri').value) $('eCri').value = cb.critico ? 'Sí' : 'No'; } pintarReqs(); }); }
      $('eCatInfo').textContent = 'Si la compra no corresponde a ninguna categoría, se clasifica en la más parecida y se pide incluirla en la matriz.';
    } else {
      $('eOtro').innerHTML = '';
      $('eCatInfo').textContent = cat ? (cat.b === 'Bien' ? 'Suministro (bien)' : 'Servicio') + ' · nivel ' + cat.nivel + ' · ' + (cat.critico ? 'crítico · reevaluación semestral' : 'no crítico · reevaluación anual') + ' · ' + P.NIVELES[cat.nivel].aplica.toLowerCase() : '';
      if (cat && !$('eTipo').value) $('eTipo').value = P.tipoSegunCategoria(c);
      if (cat && cat.b === 'Bien' && $('eTipo').value !== 'Proveedor de bienes') $('eTipo').value = 'Proveedor de bienes';
      if (cat && cat.b !== 'Bien' && $('eTipo').value === 'Proveedor de bienes') $('eTipo').value = 'Proveedor de servicios';
    }
    pintarReqs();
  };
  sel.addEventListener('change', pintarCat); pintarCat();
  activarNit($('eNit'));
  $('eCorreo').addEventListener('click', async ()=> { const t = P.plantillaCorreo(base(), EMPRESA.nombre || '', ''); try { await navigator.clipboard.writeText(t); UI.toast('✓ Correo copiado: pégalo en tu correo o WhatsApp.'); } catch (e) { UI.modal('<h3>Correo para pedir los documentos</h3><textarea style="width:100%;min-height:300px;">' + esc(t) + '</textarea><button type="button" class="btn ghost" data-cerrar>Cerrar</button>'); } });
  $('eOk').addEventListener('click', async ()=> {
    const v = (id)=> ($(id) ? $(id).value.trim() : ''), c = codigo(), nit = P.validarNit(v('eNit'));
    const otroNit = nit.base && prov().find((x)=> x.id !== d.id && String(x.resumen.nit || '').replace(/\D/g, '').slice(0, nit.base.length) === nit.base);
    const reglas = [
      { el: $('eNom'), etiqueta: 'Razón social', error: ()=> Valida.texto(v('eNom'), 3) },
      { el: $('eNit'), etiqueta: 'NIT', error: ()=> nit.error || (otroNit ? 'ya está registrado: ' + otroNit.resumen.nombre : '') },
      { el: $('eCon'), etiqueta: 'Contacto', error: ()=> Valida.texto(v('eCon'), 3) },
      { el: $('eCor'), etiqueta: 'Correo', error: ()=> (!v('eCor') ? 'falta' : Valida.correoMal(v('eCor')) ? 'no es un correo válido' : '') },
      { el: $('eTel'), etiqueta: 'Teléfono', error: ()=> telError(v('eTel')) },
      { el: $('eTipo'), etiqueta: 'Tipo', error: ()=> (v('eTipo') ? '' : 'falta') },
      { el: sel, etiqueta: 'Categoría', error: ()=> (!c ? 'falta' : sel.value === 'Otro' ? 'escribe cuál' : '') },
      { el: $('eBase'), etiqueta: 'Categoría más parecida', error: ()=> (c === 'OTRO' && !v('eBase') ? 'falta' : '') },
      { el: $('eNiv'), etiqueta: 'Nivel de riesgo', error: ()=> (c === 'OTRO' && !v('eNiv') ? 'falta' : '') },
      { el: $('eCri'), etiqueta: '¿Proveedor crítico?', error: ()=> (c === 'OTRO' && !v('eCri') ? 'falta' : '') },
      { el: $('eSer'), etiqueta: 'Qué suministra o hace', error: ()=> Valida.texto(v('eSer'), 3) },
      { el: $('e0312'), etiqueta: 'Calificación de estándares mínimos', error: ()=> Valida.numero(v('e0312'), { min: 0, max: 100 }) },
      { el: $('eHomF'), etiqueta: 'Homologado desde', error: ()=> (v('eHom') === 'Sí' ? Valida.pasada(v('eHomF')) : '') }
    ].filter((r)=> r.el);
    if (Valida.revisar(s, reglas, $('eMsg')).length) return;
    const cod = c === 'OTRO' ? 'OTRO' : c, b = base(), cat = P.categoria(b), pre = b + '|';
    const req = {}; Object.keys(marcas).forEach((k)=> { if (k.indexOf(pre) === 0 && (marcas[k].e || marcas[k].v)) req[k] = marcas[k]; });
    const doc = Object.assign({}, d, { nombre: v('eNom'), nit: nit.texto, tipoPersona: v('ePer'), contacto: v('eCon'), ciudad: v('eCiu'), correo: v('eCor'), telefono: v('eTel'), tipoProveedor: v('eTipo'), servicio: v('eSer'),
      categoria: cod, categoriaNombre: cod === 'OTRO' ? sel.value : cat.n, categoriaBase: cod === 'OTRO' ? b : '', nivel: cod === 'OTRO' ? v('eNiv') : cat.nivel, critico: cod === 'OTRO' ? v('eCri') === 'Sí' : cat.critico,
      calificacion0312: num(v('e0312')), activo: $('eAct').checked, homologado: v('eHom') === 'Sí', fechaHomologacion: v('eHom') === 'Sí' ? v('eHomF') : '', observaciones: v('eObs'), requisitos: req });
    recalcular(doc);
    $('eOk').disabled = true; $('eMsg').innerHTML = '<div class="status-msg">Guardando…</div>';
    const r = await Registros.guardar('proveedor', d.id, doc, d.nuevo ? 0 : d.version);
    $('eOk').disabled = false;
    if (typeof r === 'string') { $('eMsg').innerHTML = '<div class="v-resumen">' + esc(r) + '</div>'; return; }
    UI.toast(r.enCola ? '⏳ Guardado en el equipo; se envía al volver la señal.' : '✓ Guardado.');
    await cargar(); if (r.enCola) show('scrLista'); else verFicha(d.id);
  });
}

/* ── Responsables con firma (en el PDF) ── */
function htmlResp(roles, vals){
  return roles.map((r, i)=> { const x = (vals || [])[i] || {}; return '<div class="resp"><div class="resp-r">' + esc(r[0]) + (r[2] ? ' *' : '') + '</div><div class="grid2"><div class="field"><label>Nombre' + (r[2] ? ' *' : '') + '</label><input type="text" data-resp="' + i + '" data-persona="1" maxlength="80" value="' + esc(x.nombre || '') + '"></div>' +
    '<div class="field"><label>Cargo</label><input type="text" data-cargo="' + i + '" maxlength="80" value="' + esc(x.cargo || r[1] || '') + '"></div></div></div>'; }).join('');
}
const leerResp = (raiz, roles)=> roles.map((r, i)=> ({ rol: r[0], nombre: raiz.querySelector('[data-resp="' + i + '"]').value.trim(), cargo: raiz.querySelector('[data-cargo="' + i + '"]').value.trim() }));
const ROLES_INI = [['Evaluó (criterios comerciales y técnicos)', 'Compras', true], ['Verificó requisitos SST', 'Responsable de SST'], ['Validó especificaciones (área solicitante)', ''], ['Aprobó selección (según monto)', '']];
const ROLES_REEV = [['Consolidó evidencias y calificó (criterios 2 a 5)', 'Compras', true], ['Calificó criterio SST', 'Responsable de SST'], ['Aportó información (criterio 6)', 'Contabilidad'], ['Validó desempeño técnico', 'Supervisor del contrato'], ['Aprobó clasificación y acciones', 'Gerencia General']];

function hdrEval(d, titulo){ return '<div class="hdr"><a class="back" href="#" data-ficha="' + esc(d.id) + '">← Volver</a><div class="eyebrow">' + esc(titulo) + '</div><h1>' + esc(d.nombre) + '</h1><p>' + esc([d.nit && 'NIT ' + d.nit, catNombre(d), d.nivel && 'nivel ' + d.nivel, d.critico === true ? 'crítico' : ''].filter(Boolean).join(' · ')) + '</p></div>'; }
async function guardarEval(d, ev, marcasNuevas){
  const doc = JSON.parse(JSON.stringify(d));
  doc.evaluaciones = (doc.evaluaciones || []).concat([ev]);
  if (marcasNuevas) doc.requisitos = Object.assign({}, doc.requisitos || {}, marcasNuevas);
  recalcular(doc);
  if (ev.clasificacion === 'RECHAZADO' && await Dialogo.confirmar('RECHAZADO: el procedimiento lo retira de la base de datos por decisión de Gerencia. ¿Marcarlo como inactivo (retirado)?')) doc.activo = false;
  const r = await Registros.guardar('proveedor', d.id, doc, d.version);
  if (typeof r === 'string') return r;
  UI.toast(r.enCola ? '⏳ Evaluación guardada en el equipo; se envía al volver la señal.' : '✓ Evaluación guardada: ' + ev.clasificacion + ' (' + pctTxt(ev.pct) + ').');
  await cargar();
  if (r.enCola) show('scrLista'); else await verFicha(d.id);
  accionResultado(d, ev);
  return true;
}
/* Resultado bajo → acción en el plan de acción (origen «Evaluación de proveedores»). */
function accionResultado(d, ev){
  if (P.color(ev.clasificacion) === 'pronto' || P.color(ev.clasificacion) === 'mal') {
    const malo = P.color(ev.clasificacion) === 'mal';
    UI.nuevaAccion({ origen: 'Evaluación de proveedores', origenRef: d.id, prioridad: malo ? 'Alta' : 'Media', tipoAccion: 'Correctiva',
      hallazgo: d.nombre + (d.nit ? ' (NIT ' + d.nit + ')' : '') + ': ' + ev.clasificacion + ' (' + pctTxt(ev.pct) + ') en la ' + (ev.tipo === 'Inicial' ? 'evaluación inicial' : 'reevaluación') + ' del ' + UI.corta(ev.fecha) +
        ((ev.docs && ev.docs.faltan && ev.docs.faltan.length) ? '. Excluyentes sin cumplir: ' + ev.docs.faltan.join('; ') : '') + (ev.bajos && ev.bajos.length ? '. Criterios bajos: ' + ev.bajos.join('; ') : ''),
      accion: ev.tipo === 'Inicial' ? (malo ? 'Informar al oferente que no es apto y no contratarlo hasta que cumpla; buscar otro oferente.' : 'Registrar las condiciones a cumplir, obtener aprobación de Gerencia y priorizarlo en el monitoreo.')
        : (malo ? 'Retirarlo de la base de datos (aprobación de Gerencia) y notificarlo formalmente.' : 'Pedir el plan de mejora (30 días) y reevaluar a los 6 meses.'),
      fechaCompromiso: Festivos.sumarDias(UI.hoy(), malo ? 7 : P.PARAM.diasPlan) });
  }
}

/* ── Evaluación inicial (selección) ── */
function evaluarInicial(d, o){
  o = o || {};   // v109: o = { cont, cabecera, pie, proceso, valores, sugPrecio, alGuardar } cuando la usa el ingreso por etapas
  const s = o.cont || $('scrEval'), reqs = reqsDe(d).filter((q)=> q.etapa <= 2), marcas = JSON.parse(JSON.stringify(d.requisitos || {})), v0 = o.valores || {};
  const vv = (k, def)=> esc(v0[k] == null || v0[k] === '' ? (def == null ? '' : def) : v0[k]);
  const tipo = d.tipoProveedor || P.tipoSegunCategoria(d.categoria) || 'Proveedor de servicios', ps = P.pesos(tipo), bien = P.esBien(tipo);
  const ev = { cal: [null, null, null, null, null, null], sst: '', conf: '' };
  s.innerHTML = (o.cabecera || hdrEval(d, 'Evaluación inicial y selección')) +
    (reqs.length ? '' : '<div class="aviso amar">Este proveedor no tiene categoría de la matriz: primero elige su categoría en «Datos y documentos» para verificar sus requisitos.</div>') +
    '<div class="card"><h2>A. Datos de la necesidad</h2><div class="grid2"><div class="field"><label>Fecha de evaluación *</label><input type="date" id="iFec" value="' + vv('fecha', UI.hoy()) + '" max="' + UI.hoy() + '"></div><div class="field"><label>N.° solicitud de compra</label><input type="text" id="iSol" maxlength="40" value="' + vv('solicitud') + '"></div></div>' +
    '<div class="field"><label>Descripción del bien o servicio</label><input type="text" id="iDes" maxlength="160" value="' + vv('descripcion', d.servicio || '') + '"></div>' +
    '<div class="grid2"><div class="field"><label>Área solicitante</label><input type="text" id="iArea" maxlength="80" value="' + vv('area') + '"></div><div class="field"><label>Monto estimado de la compra ($)</label><input type="number" id="iMon" min="0" step="1" inputmode="numeric" value="' + vv('monto') + '"></div></div>' +
    '<div class="grid2"><div class="field"><label>Valor cotizado sin IVA ($)</label><input type="number" id="iVal" min="0" step="1" inputmode="numeric" value="' + vv('valor') + '"></div><div class="field"><label>Tiempo de entrega ofrecido (días)</label><input type="number" id="iDias" min="0" step="1" inputmode="numeric" value="' + vv('dias') + '"></div></div>' +
    '<div id="iMonInfo" class="ayuda"></div><div class="ayuda">Ponderación aplicada: <b>' + (bien ? 'Bienes' : 'Servicios / contratistas') + '</b> (' + esc(tipo) + ').</div></div>' +
    '<div class="card"><h2>C. Requisitos de la matriz y excluyentes</h2>' + (o.proceso ? '<div id="iReqs">' + resumenReqsProc(reqs, marcas) + '</div>' : '<p class="ayuda">Marca cada requisito de las etapas 1 y 2. Si falta un ★, el oferente es NO APTO aunque tenga buen puntaje.</p><div id="iReqs">' + htmlReqs(reqs, marcas, [1, 2], false) + '</div>') +
    '<div class="crit-c"><div class="crit-t"><b>Documentación SST y ambiental verificada por el responsable de SST / ambiental *</b></div><div class="seg-btn u-mt8" id="iSst"><button type="button" data-v="Sí">Sí</button><button type="button" data-v="No">No</button></div></div>' +
    '<div class="crit-c"><div class="crit-t"><b>Sin conflicto de interés declarado por quien evalúa *</b></div><div class="seg-btn u-mt8" id="iConf"><button type="button" data-v="Sí">Sí</button><button type="button" data-v="No">No</button></div></div></div>' +
    '<div class="card"><h2>D. Calificación por criterio</h2><p class="ayuda">1 = Muy deficiente · 2 = Deficiente · 3 = Aceptable · 4 = Bueno · 5 = Excelente. Puntaje (%) = Σ (calificación × ponderación) ÷ 5 × 100.</p>' +
      P.INICIAL.map((c, i)=> '<div class="crit-c" data-ci="' + i + '"><div class="crit-t"><b>' + esc(c.c) + '</b><span class="peso">' + Math.round(ps[i] * 100) + ' %</span></div><div class="req-m">' + esc(c.d) + ' · Califica: ' + esc(c.quien) + '</div>' +
        '<div class="seg-btn notas" data-cal="' + i + '">' + [1, 2, 3, 4, 5].map((n)=> '<button type="button" data-v="' + n + '" aria-label="' + esc(c.c) + ': ' + n + ' ' + P.ESCALA[n - 1] + '">' + n + '</button>').join('') + '</div><div class="crit-d" id="iCd' + i + '">Elige de 1 (muy deficiente) a 5 (excelente).</div></div>').join('') + '</div>' +
    '<div id="iRes"></div>' +
    '<div class="card"><h2>E. Justificación de la selección / condiciones</h2><div class="field"><label id="iJusL">Justificación o condiciones a cumplir</label><textarea id="iJus" maxlength="1500" placeholder="Obligatorio si queda CONDICIONADO o si se elige un oferente distinto al recomendado"></textarea></div></div>' +
    '<div class="card"><h2>F. Responsables</h2>' + htmlResp(ROLES_INI, [{ nombre: quienSoy() }]) + '</div>' +
    '<div id="iMsg"></div>' + (o.pie || '<div class="barra-guardar"><button type="button" class="btn amber" id="iOk">Guardar evaluación</button><button type="button" class="btn ghost" data-ficha="' + esc(d.id) + '">Cancelar</button></div>');
  if (!o.cont) show('scrEval');
  Registros.activar(s);
  const calc = ()=> {
    const docs = P.revisarDocs(reqs, marcas, [1, 2]), excl = P.excluyentesInicial(docs, ev.sst, ev.conf), pts = P.puntaje(ev.cal, ps), clas = P.clasificarInicial(pts && pts.pct, excl);
    return { docs, excl, pts, clas };
  };
  const pintarRes = ()=> {
    const r = calc(), monto = $('iMon').value, c = P.color(r.clas);
    const ap = P.aprobacion(monto, d.critico === true), cot = P.cotizacionesMinimas(monto);
    $('iMonInfo').innerHTML = monto ? 'Aprobación requerida: <b>' + esc(ap) + '</b> · cotizaciones mínimas: <b>' + cot + '</b>' : '';
    $('iRes').innerHTML = '<div class="resultado ' + (c === 'gris' ? '' : c) + '"><div class="grande">' + esc(r.clas) + (r.pts ? ' · ' + pctTxt(r.pts.pct) : '') + '</div>' +
      '<div class="dato"><span>Puntaje (sobre 5,0)</span><b>' + (r.pts ? String(r.pts.sobre5.toFixed(2)).replace('.', ',') : 'faltan ' + ev.cal.filter((x)=> !x).length + ' criterio(s)') + '</b></div>' +
      '<div class="dato"><span>Requisitos excluyentes</span><b>' + esc(r.excl) + '</b></div><div class="dato"><span>% cumplimiento documental (etapas 1 y 2)</span><b>' + pctTxt(r.docs.pct) + '</b></div>' +
      (r.docs.faltan.length ? '<div class="m" style="color:var(--mal);font-weight:700;">★ Sin cumplir: ' + esc(r.docs.faltan.join('; ')) + '</div>' : '') +
      (r.docs.naObligatorio.length ? '<div class="m">⚠ N.A. en requisito obligatorio: ' + esc(r.docs.naObligatorio.join('; ')) + '</div>' : '') +
      (P.DECISION[r.clas] ? '<p class="ayuda" style="margin:6px 0 0;">' + esc(P.DECISION[r.clas]) + '</p>' : '') + '</div>';
    $('iJusL').textContent = r.clas === 'CONDICIONADO' ? 'Condiciones a cumplir (aprobación de Gerencia) *' : 'Justificación o condiciones a cumplir';
  };
  activarReqs($('iReqs'), marcas, pintarRes);
  activarSeg($('iSst'), (v)=> { ev.sst = v; pintarRes(); });
  activarSeg($('iConf'), (v)=> { ev.conf = v; pintarRes(); });
  s.querySelectorAll('[data-cal]').forEach((g)=> activarSeg(g, (v)=> { const i = +g.dataset.cal; ev.cal[i] = Number(v); $('iCd' + i).textContent = v + ' – ' + P.ESCALA[v - 1] + ': ' + P.INICIAL[i].esc[v - 1]; pintarRes(); }));
  $('iMon').addEventListener('input', pintarRes);
  pintarRes();
  if (o.sugPrecio) { const b = s.querySelector('[data-cal="1"] [data-v="' + o.sugPrecio + '"]'); if (b) { b.click(); $('iCd1').textContent += ' (sugerida por el cuadro comparativo de cotizaciones)'; } }
  $('iOk').addEventListener('click', async ()=> {
    const r = calc(), val = (id)=> $(id).value.trim();
    const reglas = [{ el: $('iFec'), etiqueta: 'Fecha de evaluación', error: ()=> Valida.pasada(val('iFec')) },
      { el: $('iMon'), etiqueta: 'Monto estimado', error: ()=> Valida.numero(val('iMon'), { min: 0 }) }, { el: $('iVal'), etiqueta: 'Valor cotizado', error: ()=> Valida.numero(val('iVal'), { min: 0 }) },
      { el: $('iDias'), etiqueta: 'Tiempo de entrega', error: ()=> Valida.numero(val('iDias'), { min: 0, entero: true }) }]
      .concat(reqs.filter((q)=> q.excl && !(marcas[q.k] || {}).e).map((q)=> ({ el: s.querySelector('[data-rq="' + q.k + '"]') || $('iReqs'), etiqueta: '★ ' + q.texto, error: 'márcalo (Sí, No o N.A.)' })))
      .concat([{ el: $('iSst'), etiqueta: 'Documentación SST verificada', error: ev.sst ? '' : 'falta' }, { el: $('iConf'), etiqueta: 'Sin conflicto de interés', error: ev.conf ? '' : 'falta' }])
      .concat(P.INICIAL.map((c, i)=> ({ el: s.querySelector('[data-ci="' + i + '"]'), etiqueta: c.c, error: ev.cal[i] ? '' : 'califícalo de 1 a 5' })))
      .concat([{ el: $('iJus'), etiqueta: 'Condiciones (CONDICIONADO)', error: ()=> (r.clas === 'CONDICIONADO' ? Valida.texto(val('iJus'), 10) : '') },
        { el: s.querySelector('[data-resp="0"]'), etiqueta: 'Quién evaluó', error: ()=> Valida.texto(s.querySelector('[data-resp="0"]').value, 3) }]);
    if (Valida.revisar(s, reglas, $('iMsg')).length) return;
    const nuevas = {}; reqs.forEach((q)=> { if (marcas[q.k]) nuevas[q.k] = marcas[q.k]; });
    const evo = { uid: SGSST.nuevoOpId(), tipo: 'Inicial', fecha: val('iFec'), solicitud: val('iSol'), descripcion: val('iDes'), area: val('iArea'), monto: num(val('iMon')), valorCotizado: num(val('iVal')), diasEntrega: num(val('iDias')),
      aprobacion: P.aprobacion(val('iMon'), d.critico === true), homologadoAlEvaluar: d.homologado === true, categoria: catNombre(d), tipoProveedor: tipo, ponderacion: bien ? 'Bienes' : 'Servicios / contratistas', pesos: ps,
      docs: { estado: r.docs.estado, pct: r.docs.pct, faltan: r.docs.faltan, naObligatorio: r.docs.naObligatorio }, marcas: nuevas, sstVerificada: ev.sst, sinConflicto: ev.conf, excluyentes: r.excl,
      cal: ev.cal, sobre5: r.pts.sobre5, pct: r.pts.pct, clasificacion: r.clas, justificacion: val('iJus'), responsables: leerResp(s, ROLES_INI),
      bajos: P.INICIAL.filter((c, i)=> ev.cal[i] <= 2).map((c)=> c.c) };
    if (o.proceso) evo.proceso = o.proceso;
    $('iOk').disabled = true; $('iMsg').innerHTML = '<div class="status-msg">Guardando…</div>';
    const g = o.alGuardar ? await o.alGuardar(evo, nuevas) : await guardarEval(d, evo, nuevas);
    if ($('iOk')) $('iOk').disabled = false;
    if (typeof g === 'string' && $('iMsg')) $('iMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>';
  });
}

/* ── Reevaluación (desempeño real del periodo) ── */
const EVID = [['entregas', 'N.° de entregas / servicios en el período', 'OC y remisiones – Compras'], ['aTiempo', 'N.° entregas / servicios a tiempo', 'OC vs. fecha real – Compras'],
  ['conNC', 'N.° entregas con no conformidad', 'Registro de NC – Compras / supervisor'], ['diasCierre', 'Promedio de días hábiles para cerrar NC / reclamos', 'Registro de NC – Compras'],
  ['mesesLabor', 'Meses del período con personal del contratista en labor (0 si es bien)', 'Supervisor del contrato'], ['mesesSS', 'Meses con seguridad social verificada', 'Lista de chequeo SST'],
  ['inspecciones', 'N.° inspecciones SST realizadas', 'Formato de inspección – SST'], ['conHallazgos', 'N.° inspecciones con hallazgos', 'Formato de inspección – SST'],
  ['incidentes', 'N.° incidentes graves / accidentes atribuibles al contratista', 'Reporte de incidentes – SST'], ['reqAplicables', 'N.° requisitos de la matriz aplicables en el período', 'Matriz de requisitos (etapas 3 y 4)'],
  ['reqVencidos', 'N.° requisitos vencidos o no entregados a tiempo', 'Matriz de requisitos'], ['exclVencidos', 'N.° requisitos excluyentes ★ vencidos durante el servicio', 'Matriz de requisitos']];
function evaluarReev(d){
  const s = $('scrEval'), u = ultimaEval(d), h = UI.hoy(), reqs = reqsDe(d).filter((q)=> q.etapa >= 3), M = d.requisitos || {};
  const est = (q)=> { const m = M[q.k] || {}; return m.e === 'Sí' && m.v && m.v < h ? 'Vencido' : m.e || ''; };
  const apl = reqs.filter((q)=> est(q) !== 'N.A.'), venc = apl.filter((q)=> est(q) === 'No' || est(q) === 'Vencido');
  const pre = reqs.length ? { reqAplicables: apl.length, reqVencidos: venc.length, exclVencidos: venc.filter((q)=> q.excl).length } : {};
  const asig = [null, null, null, null, null, null], plan = [];
  const ant = u || (d.resultado ? { clasificacion: d.resultado, pct: d.puntaje, fecha: d.fechaEvaluacion } : null);
  const tipoDef = ant && ant.clasificacion === 'ACEPTABLE CON PLAN DE MEJORA' ? 'SEGUIMIENTO A PLAN DE MEJORA' : 'ORDINARIA';
  s.innerHTML = hdrEval(d, 'Reevaluación de desempeño') +
    '<div class="card"><h2>A. Datos del período</h2><div class="grid2"><div class="field"><label>Período evaluado desde *</label><input type="date" id="rDes" value="' + esc((ant && ant.fecha) || '') + '"></div><div class="field"><label>Período evaluado hasta *</label><input type="date" id="rHas" value="' + h + '"></div></div>' +
    '<div class="grid2"><div class="field"><label>Fecha de reevaluación *</label><input type="date" id="rFec" value="' + h + '" max="' + h + '"></div><div class="field"><label>Tipo de reevaluación *</label><select id="rTipo" data-sin-otro>' + P.TIPOS_REEV.map((t)=> '<option' + (t === tipoDef ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div>' +
    '<div class="dato"><span>Clasificación anterior</span><b>' + esc(ant ? ant.clasificacion + ' · ' + pctTxt(ant.pct) : 'NUEVO (sin evaluación previa)') + '</b></div><div class="dato"><span>¿Homologado actualmente?</span><b>' + (d.homologado === true ? 'Sí' : 'No') + '</b></div>' +
    '<div class="dato"><span>Bien o servicio</span><b>' + esc(d.servicio || '—') + '</b></div></div>' +
    '<div class="card"><h2>B. Evidencias del período (monitoreo)</h2><p class="ayuda">Con estos datos el portal sugiere la calificación de cada criterio.' + (reqs.length ? ' Los requisitos de la matriz se tomaron de los documentos marcados (etapas 3 y 4); corrígelos si hace falta.' : '') + '</p>' +
      '<div class="grid2">' + EVID.map((e)=> '<div class="field"><label>' + esc(e[1]) + '</label><input type="number" min="0" step="' + (e[0] === 'diasCierre' ? 'any' : '1') + '" inputmode="decimal" data-evid="' + e[0] + '" value="' + esc(pre[e[0]] == null ? '' : pre[e[0]]) + '"><div class="ayuda">' + esc(e[2]) + '</div></div>').join('') + '</div><div id="rInd"></div></div>' +
    '<div class="card"><h2>C. Calificación por criterio</h2><p class="ayuda">La sugerida (subrayada) sale de las evidencias. Si asignas otra, escribe por qué.</p>' +
      P.REEV.map((c, i)=> '<div class="crit-c" data-ci="' + i + '"><div class="crit-t"><b>' + esc(c.c) + '</b><span class="peso">' + Math.round(c.p * 100) + ' %</span></div><div class="req-m">' + esc(c.fuente) + ' · Califica: ' + esc(c.quien) + '</div><div class="req-m" id="rEv' + i + '"></div>' +
        '<div class="seg-btn notas" data-cal="' + i + '">' + [1, 2, 3, 4, 5].map((n)=> '<button type="button" data-v="' + n + '" aria-label="' + esc(c.c) + ': ' + n + '">' + n + '</button>').join('') + '</div><div class="crit-d" id="rCd' + i + '"></div>' +
        '<div class="field" id="rJw' + i + '" hidden><label>Justificación (la calificación difiere de la sugerida) *</label><input type="text" id="rJ' + i + '" maxlength="300"></div></div>').join('') + '</div>' +
    '<div id="rRes"></div>' +
    '<div class="card" id="rPlanC"><h2>D. Plan de mejora del proveedor</h2><p class="ayuda" id="rPlanA">Obligatorio si queda ACEPTABLE CON PLAN DE MEJORA.</p><div id="rPlan"></div><button type="button" class="btn ghost mini" id="rPlanAdd">+ Acción del plan</button></div>' +
    '<div class="card"><h2>E. Observaciones y retroalimentación al proveedor</h2><div class="field"><label>Observaciones</label><textarea id="rObs" maxlength="1500"></textarea></div>' +
      '<div class="grid2"><div class="field"><label>Fecha de comunicación al proveedor</label><input type="date" id="rCom"></div><div class="field"><label>Medio</label><select id="rMed"><option value="">—</option><option>Correo</option><option>Carta</option><option>Otro</option></select></div></div></div>' +
    '<div class="card"><h2>F. Responsables</h2>' + htmlResp(ROLES_REEV, [{ nombre: quienSoy() }]) + '</div>' +
    '<div id="rMsg"></div><div class="barra-guardar"><button type="button" class="btn amber" id="rOk">Guardar reevaluación</button><button type="button" class="btn ghost" data-ficha="' + esc(d.id) + '">Cancelar</button></div>';
  show('scrEval');
  Registros.activar(s);
  const evid = ()=> { const o = {}; s.querySelectorAll('[data-evid]').forEach((i)=> { o[i.dataset.evid] = i.value === '' ? '' : Number(i.value); }); return o; };
  const textoEv = (i, e, I)=> [ (I.ss != null ? 'SS ' + pctTxt(I.ss * 100) + ' · ' : '') + (I.hallazgos != null ? 'Hallazgos ' + pctTxt(I.hallazgos * 100) + ' · ' : '') + 'Incidentes: ' + (Number(e.incidentes) || 0) + (Number(e.exclVencidos) > 0 ? ' · ★ vencidos: ' + e.exclVencidos : ''),
    I.nc != null ? 'NC: ' + pctTxt(I.nc * 100) : 'Sin datos', I.aTiempo != null ? 'A tiempo: ' + pctTxt(I.aTiempo * 100) : 'Sin datos', 'Comparar con cotizaciones de mercado / incrementos',
    e.conNC === '' ? 'Sin datos' : Number(e.conNC) === 0 ? 'Sin reclamaciones' : 'Cierre: ' + (e.diasCierre === '' ? '—' : e.diasCierre) + ' días', (I.doc != null ? 'Documentos de la matriz: ' + pctTxt(I.doc * 100) + ' · ' : '') + 'Contabilidad (facturas)'][i];
  const calc = ()=> { const e = evid(), sug = P.sugeridas(e), fin = P.finales(sug, asig), pts = fin.every((x)=> x) ? P.puntaje(fin, P.REEV.map((c)=> c.p)) : null; return { e, I: P.indicadores(e), sug, fin, pts, clas: P.clasificarReev(pts && pts.pct) }; };
  const pintarPlan = ()=> { $('rPlan').innerHTML = plan.map((p, i)=> '<div class="plan-f" data-pi="' + i + '"><div class="field"><label>Hallazgo / criterio con baja calificación *</label><input type="text" data-pk="hallazgo" maxlength="200" value="' + esc(p.hallazgo || '') + '"></div>' +
      '<div class="field"><label>Acción comprometida por el proveedor *</label><input type="text" data-pk="accion" maxlength="200" value="' + esc(p.accion || '') + '"></div>' +
      '<div class="grid2"><div class="field"><label>Responsable (proveedor)</label><input type="text" data-pk="responsable" maxlength="80" value="' + esc(p.responsable || '') + '"></div><div class="field"><label>Fecha compromiso *</label><input type="date" data-pk="fecha" value="' + esc(p.fecha || '') + '"></div></div>' +
      '<div class="grid2"><div class="field"><label>Estado</label><select data-pk="estado" data-sin-otro>' + ['Abierta', 'En curso', 'Cerrada eficaz', 'Cerrada no eficaz'].map((x)=> '<option' + (p.estado === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></div><div class="field"><label>Verificación de eficacia</label><input type="text" data-pk="eficacia" maxlength="200" value="' + esc(p.eficacia || '') + '"></div></div>' +
      '<button type="button" class="quitar" data-pq="' + i + '">Quitar</button></div>').join('') || '<div class="ayuda">Sin acciones registradas.</div>';
    $('rPlan').querySelectorAll('[data-pk]').forEach((x)=> x.addEventListener('input', ()=> { plan[+x.closest('[data-pi]').dataset.pi][x.dataset.pk] = x.value; }));
    $('rPlan').querySelectorAll('[data-pk]').forEach((x)=> x.addEventListener('change', ()=> { plan[+x.closest('[data-pi]').dataset.pi][x.dataset.pk] = x.value; }));
    $('rPlan').querySelectorAll('[data-pq]').forEach((b)=> b.addEventListener('click', ()=> { plan.splice(+b.dataset.pq, 1); pintarPlan(); })); };
  const pintarRes = ()=> {
    const r = calc(), c = P.color(r.clas), extra = P.alertaExtraordinaria(r.e), inc = P.incoherencias(r.e), fec = $('rFec').value;
    $('rInd').innerHTML = '<table class="mini-tabla"><tr><th>Indicador</th><th class="n">Resultado</th></tr>' + [['% entregas a tiempo', r.I.aTiempo, 'Sin entregas'], ['% entregas con NC', r.I.nc, 'Sin entregas'], ['% seguridad social verificada', r.I.ss, 'N.A.'], ['% inspecciones con hallazgos', r.I.hallazgos, 'N.A.'], ['% cumplimiento documental según matriz', r.I.doc, 'Sin datos']]
      .map((x)=> '<tr><td>' + x[0] + '</td><td class="n">' + (x[1] == null ? x[2] : pctTxt(x[1] * 100)) + '</td></tr>').join('') + '<tr><td>¿Activa reevaluación extraordinaria?</td><td class="n"><b' + (extra ? ' style="color:var(--mal);"' : '') + '>' + (extra ? 'SÍ' : 'No') + '</b></td></tr></table>' +
      (inc.length ? '<div class="aviso">' + inc.map(esc).join('<br>') + '</div>' : '');
    r.sug.forEach((sg, i)=> { $('rEv' + i).textContent = textoEv(i, r.e, r.I) + ' · Sugerida: ' + (typeof sg === 'number' ? sg : sg === 'Manual' ? 'asignar a mano' : 'faltan datos');
      const g = s.querySelector('[data-cal="' + i + '"]'); g.querySelectorAll('button').forEach((b)=> { b.classList.toggle('sug', Number(b.dataset.v) === sg); b.classList.toggle('on', Number(b.dataset.v) === r.fin[i]); });
      $('rCd' + i).textContent = r.fin[i] ? r.fin[i] + ' – ' + P.REEV[i].esc[r.fin[i] - 1] : '';
      $('rJw' + i).hidden = !(asig[i] != null && typeof sg === 'number' && asig[i] !== sg); });
    const prox = P.proxima(fec, r.clas, d.critico === true), varia = r.pts && ant && ant.pct !== '' && ant.pct != null ? r.pts.pct - Number(ant.pct) : null;
    $('rRes').innerHTML = '<div class="resultado ' + (c === 'gris' ? '' : c) + '"><div class="grande">' + esc(r.clas === 'PENDIENTE' ? 'PENDIENTE – faltan ' + r.fin.filter((x)=> !x).length + ' criterio(s)' : r.clas) + (r.pts ? ' · ' + pctTxt(r.pts.pct) : '') + '</div>' +
      '<div class="dato"><span>Puntaje total (sobre 5,0)</span><b>' + (r.pts ? r.pts.sobre5.toFixed(2).replace('.', ',') : '—') + '</b></div>' +
      (varia != null ? '<div class="dato"><span>Variación frente a la evaluación anterior</span><b>' + (varia >= 0 ? '▲ +' : '▼ ') + pctTxt(varia) + '</b></div>' : '') +
      (r.pts ? '<div class="dato"><span>Acción</span><b>' + esc(P.accionReev(r.clas, ant && ant.clasificacion)) + '</b></div>' : '') +
      (r.clas === 'ACEPTABLE CON PLAN DE MEJORA' ? '<div class="dato"><span>Fecha límite del plan de mejora</span><b>' + esc(UI.corta(P.limitePlan(fec))) + '</b></div>' : '') +
      (r.pts ? '<div class="dato"><span>Próxima reevaluación</span><b>' + (prox ? esc(UI.corta(prox)) : 'N.A. – retirado') + '</b></div>' : '') +
      ($('rTipo').value === 'SEGUIMIENTO A PLAN DE MEJORA' && r.pts && r.clas !== 'CONFIABLE' ? '<div class="m" style="color:var(--mal);font-weight:700;">No alcanzó 80 % tras el plan de mejora: decisión de Gerencia.</div>' : '') + '</div>';
    $('rPlanA').textContent = r.clas === 'ACEPTABLE CON PLAN DE MEJORA' ? 'Obligatorio: el proveedor presenta su plan en 30 días calendario.' : 'Obligatorio si queda ACEPTABLE CON PLAN DE MEJORA.';
  };
  s.querySelectorAll('[data-evid]').forEach((i)=> i.addEventListener('input', pintarRes));
  s.querySelectorAll('[data-cal]').forEach((g)=> activarSeg(g, (v)=> { const i = +g.dataset.cal; asig[i] = Number(v); pintarRes(); }));
  $('rFec').addEventListener('change', pintarRes); $('rTipo').addEventListener('change', pintarRes);
  $('rPlanAdd').addEventListener('click', ()=> { plan.push({ estado: 'Abierta' }); pintarPlan(); });
  pintarPlan(); pintarRes();
  $('rOk').addEventListener('click', async ()=> {
    const r = calc(), val = (id)=> $(id).value.trim(), inc = P.incoherencias(r.e);
    const reglas = [{ el: $('rDes'), etiqueta: 'Período desde', error: ()=> Valida.fecha(val('rDes')) }, { el: $('rHas'), etiqueta: 'Período hasta', error: ()=> Valida.fecha(val('rHas')) || Valida.orden(val('rDes'), val('rHas'), 'el inicio del período') },
      { el: $('rFec'), etiqueta: 'Fecha de reevaluación', error: ()=> Valida.pasada(val('rFec')) }]
      .concat([...s.querySelectorAll('[data-evid]')].map((i)=> ({ el: i, etiqueta: EVID.find((e)=> e[0] === i.dataset.evid)[1], error: ()=> Valida.numero(i.value, { min: 0, entero: i.dataset.evid !== 'diasCierre' }) })))
      .concat(inc.map((t)=> ({ el: s.querySelector('[data-evid="' + (/^Entregas a tiempo/.test(t) ? 'aTiempo' : /^Entregas con/.test(t) ? 'conNC' : /^Meses/.test(t) ? 'mesesSS' : /^Inspecciones/.test(t) ? 'conHallazgos' : 'reqVencidos') + '"]'), etiqueta: 'Evidencias', error: t })))
      .concat(P.REEV.map((c, i)=> ({ el: s.querySelector('[data-ci="' + i + '"]'), etiqueta: c.c, error: r.fin[i] ? '' : (r.sug[i] === '' ? 'faltan evidencias o califícalo a mano' : 'califícalo de 1 a 5') })))
      .concat(P.REEV.map((c, i)=> ({ el: $('rJ' + i), etiqueta: 'Justificación de «' + c.c + '»', error: ()=> (!$('rJw' + i).hidden ? Valida.texto(val('rJ' + i), 5) : '') })))
      .concat(r.clas === 'ACEPTABLE CON PLAN DE MEJORA' && !plan.length ? [{ el: $('rPlanAdd'), etiqueta: 'Plan de mejora', error: 'agrega al menos una acción del proveedor' }] : [])
      .concat([].concat(...plan.map((p, i)=> { const f = $('rPlan').querySelector('[data-pi="' + i + '"]'); return [{ el: f.querySelector('[data-pk=hallazgo]'), etiqueta: 'Plan ' + (i + 1) + ': hallazgo', error: ()=> Valida.texto(p.hallazgo, 3) },
        { el: f.querySelector('[data-pk=accion]'), etiqueta: 'Plan ' + (i + 1) + ': acción', error: ()=> Valida.texto(p.accion, 3) }, { el: f.querySelector('[data-pk=fecha]'), etiqueta: 'Plan ' + (i + 1) + ': fecha compromiso', error: ()=> Valida.fecha(p.fecha) }]; })))
      .concat([{ el: $('rCom'), etiqueta: 'Fecha de comunicación', error: ()=> (val('rCom') ? Valida.fecha(val('rCom')) || Valida.orden(val('rFec'), val('rCom'), 'la fecha de reevaluación') : '') },
        { el: s.querySelector('[data-resp="0"]'), etiqueta: 'Quién consolidó y calificó', error: ()=> Valida.texto(s.querySelector('[data-resp="0"]').value, 3) }]);
    if (Valida.revisar(s, reglas, $('rMsg')).length) return;
    const evo = { uid: SGSST.nuevoOpId(), tipo: 'Reevaluación', tipoReev: val('rTipo'), desde: val('rDes'), hasta: val('rHas'), fecha: val('rFec'), categoria: catNombre(d), servicio: d.servicio || '',
      anterior: ant ? { clasificacion: ant.clasificacion, pct: ant.pct } : null, homologadoAlEvaluar: d.homologado === true, evid: r.e, ind: r.I, sug: r.sug, asig: asig.slice(), just: P.REEV.map((c, i)=> (!$('rJw' + i).hidden ? val('rJ' + i) : '')),
      cal: r.fin, pesos: P.REEV.map((c)=> c.p), sobre5: r.pts.sobre5, pct: r.pts.pct, clasificacion: r.clas, accion: P.accionReev(r.clas, ant && ant.clasificacion), extraordinaria: P.alertaExtraordinaria(r.e),
      limitePlan: r.clas === 'ACEPTABLE CON PLAN DE MEJORA' ? P.limitePlan(val('rFec')) : '', plan: plan.map((p)=> Object.assign({}, p)), observaciones: val('rObs'), fechaComunicacion: val('rCom'), medio: $('rMed').value,
      responsables: leerResp(s, ROLES_REEV), bajos: P.REEV.filter((c, i)=> r.fin[i] <= 2).map((c)=> c.c) };
    $('rOk').disabled = true; $('rMsg').innerHTML = '<div class="status-msg">Guardando…</div>';
    const g = await guardarEval(d, evo, null);
    $('rOk').disabled = false;
    if (typeof g === 'string') $('rMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>';
  });
}
function quienSoy(){ try { return Sesion.nombre() || ''; } catch (e) { return ''; } }
async function elegir(titulo, lista, alElegir){
  if (!lista.length) { UI.toast('No hay proveedores activos: agrégalos en la pestaña Matriz.', 'mal'); return; }
  const m = UI.modal('<h3>' + esc(titulo) + '</h3><input type="search" class="buscar" id="elQ" placeholder="Buscar por nombre o NIT"><div id="elL"></div><button type="button" class="btn ghost" data-cerrar>Cancelar</button>');
  const pintarL = ()=> { const q = UI.norm(m.el.querySelector('#elQ').value); m.el.querySelector('#elL').innerHTML = lista.filter((x)=> !q || UI.norm(x.resumen.nombre + ' ' + x.resumen.nit).includes(q)).slice(0, 40).map(itemProv).join('') || '<div class="empty">Nadie coincide.</div>';
    m.el.querySelectorAll('#elL [data-id]').forEach((b)=> b.addEventListener('click', async ()=> { m.cerrar(); const d = await Registros.abrir(b.dataset.id); if (d) alElegir(d); })); };
  m.el.querySelector('#elQ').addEventListener('input', pintarL); pintarL();
}

/* ── Pestaña: evaluación inicial ── */
function pintarInicial(panel){
  const act = prov().filter((x)=> x.resumen.activo !== false), sin = act.filter((x)=> !fechasDe(x.resumen).length && !evaluado(x.resumen));
  const ini = act.filter((x)=> /inicial/i.test(x.resumen.tipoEval || '') && evaluado(x.resumen)), grupos = {};
  ini.forEach((x)=> { const k = catNombre(x.resumen) || 'Sin categoría'; (grupos[k] = grupos[k] || []).push(x); });
  panel.innerHTML = '<div class="acciones-top">' + (esSst() ? '<button type="button" class="btn amber" id="nIni">+ Evaluar un proveedor u oferente</button>' : '') + '<button type="button" class="btn ghost" id="pdfIni">Cuadro comparativo (PDF)</button></div>' +
    '<div class="card"><h2>Criterios y pesos (selección)</h2><table class="mini-tabla"><tr><th>Criterio</th><th class="n">Bienes</th><th class="n">Servicios / contratistas</th></tr>' + P.INICIAL.map((c)=> '<tr><td>' + esc(c.c) + '<br><small>Califica: ' + esc(c.quien) + '</small></td><td class="n">' + Math.round(c.b * 100) + ' %</td><td class="n">' + Math.round(c.s * 100) + ' %</td></tr>').join('') + '<tr><td><b>Total</b></td><td class="n"><b>100 %</b></td><td class="n"><b>100 %</b></td></tr></table>' +
      '<p class="ayuda">CONFIABLE ≥ 80 % · CONDICIONADO 60 % a 79 % (aprueba Gerencia) · NO APTO &lt; 60 %. Un requisito excluyente ★ sin cumplir = NO APTO, sin importar el puntaje. Compras hasta $ 200.000 (caja menor) no requieren evaluación.</p></div>' +
    '<div class="grupo-t">Sin evaluación inicial (' + sin.length + ')</div>' + (sin.length ? sin.map(itemProv).join('') : '<div class="empty">Todos los proveedores activos tienen evaluación.</div>') +
    '<div class="grupo-t">Posición entre oferentes aptos, por categoría</div>' + (Object.keys(grupos).length ? Object.keys(grupos).sort().map((k)=> { const l = grupos[k].slice().sort((a, b)=> Number(b.resumen.puntaje) - Number(a.resumen.puntaje)); let pos = 0;
      return '<div class="card"><h2>' + esc(k) + '</h2>' + l.map((x)=> { const s = x.resumen, apto = /^(CONFIABLE|CONDICIONADO)$/.test(s.resultado); if (apto) pos++;
        return '<div class="dato"><span>' + (apto ? '<b>' + pos + '.</b> ' : '– ') + esc(s.nombre) + '</span><b><span class="chip ' + P.color(s.resultado) + '">' + esc(corto(s.resultado)) + '</span> ' + pctTxt(s.puntaje) + '</b></div>'; }).join('') + '</div>'; }).join('') : '<div class="empty">Aún no hay evaluaciones iniciales.</div>');
  panel.querySelectorAll('[data-id]').forEach((b)=> b.addEventListener('click', async ()=> { if (!esSst()) return verFicha(b.dataset.id); const d = await Registros.abrir(b.dataset.id); if (d) evaluarInicial(d); }));
  if ($('nIni')) $('nIni').addEventListener('click', ()=> elegir('¿A quién vas a evaluar?', act, evaluarInicial));
  $('pdfIni').addEventListener('click', ()=> pdfComparativo(grupos));
}
/* ── Pestaña: reevaluación ── */
function pintarReev(panel){
  const h = UI.hoy(), act = prov().filter((x)=> x.resumen.activo !== false && evaluado(x.resumen) && P.color(x.resumen.resultado) !== 'mal');
  const venc = act.filter((x)=> estadoDe(x.resumen) === 'VENCIDA'), prox = act.filter((x)=> estadoDe(x.resumen) === 'Próxima (≤30 días)'), plan = act.filter((x)=> P.color(x.resumen.resultado) === 'pronto' && estadoDe(x.resumen) === 'Vigente');
  const ord = (l)=> l.sort((a, b)=> String(a.resumen.proximaEvaluacion).localeCompare(String(b.resumen.proximaEvaluacion)));
  panel.innerHTML = '<div class="acciones-top">' + (esSst() ? '<button type="button" class="btn amber" id="nRe">+ Reevaluar un proveedor</button>' : '') + '<button type="button" class="btn ghost" id="pdfCon">Consolidado (PDF)</button></div>' +
    '<div class="grupo-t">Vencidas (' + venc.length + ')</div>' + (venc.length ? ord(venc).map(itemProv).join('') : '<div class="empty">Ninguna vencida.</div>') +
    '<div class="grupo-t">Próximas 30 días (' + prox.length + ')</div>' + (prox.length ? ord(prox).map(itemProv).join('') : '<div class="empty">Nada en los próximos 30 días.</div>') +
    (plan.length ? '<div class="grupo-t">Con plan de mejora o condicionados (' + plan.length + ')</div>' + ord(plan).map(itemProv).join('') : '') +
    '<div class="card"><h2>Criterios y pesos (reevaluación)</h2><table class="mini-tabla"><tr><th>Criterio</th><th class="n">Peso</th></tr>' + P.REEV.map((c)=> '<tr><td>' + esc(c.c) + '<br><small>' + esc(c.fuente) + '</small></td><td class="n">' + Math.round(c.p * 100) + ' %</td></tr>').join('') + '</table>' +
      '<p class="ayuda">CONFIABLE ≥ 80 % · ACEPTABLE CON PLAN DE MEJORA 60 % a 79 % (plan en 30 días, se reevalúa a los 6 meses) · RECHAZADO &lt; 60 % (se retira; no puede presentarse en 12 meses).</p>' +
      '<table class="mini-tabla"><tr><th>Tipo de proveedor</th><th>Periodicidad</th></tr><tr><td>Categoría crítica</td><td>Semestral</td></tr><tr><td>Categoría no crítica con compras en el período</td><td>Anual (enero)</td></tr><tr><td>CONDICIONADO / con plan de mejora</td><td>A los 6 meses de presentado el plan</td></tr><tr><td>Con alertas (≥ 2 NC en el trimestre, incidente grave, seguridad social sin pagar, ★ vencido)</td><td>Extraordinaria</td></tr></table></div>';
  panel.querySelectorAll('[data-id]').forEach((b)=> b.addEventListener('click', async ()=> { if (!esSst()) return verFicha(b.dataset.id); const d = await Registros.abrir(b.dataset.id); if (d) evaluarReev(d); }));
  if ($('nRe')) $('nRe').addEventListener('click', ()=> elegir('¿A quién vas a reevaluar?', prov().filter((x)=> x.resumen.activo !== false), (d)=> (ultimaEval(d) || d.resultado ? evaluarReev(d) : evaluarInicial(d))));
  $('pdfCon').addEventListener('click', ()=> pdfMatriz(prov().filter((x)=> x.resumen.activo !== false), true));
}
/* ── Pestaña: cronograma ── */
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function filasCrono(anio){
  const h = UI.hoy();
  return prov().filter((x)=> x.resumen.activo !== false && (x.resumen.proximaEvaluacion || fechasDe(x.resumen).length)).map((x)=> { const s = x.resumen;
    return { x, s, c: P.cronograma({ proxima: s.proximaEvaluacion, critico: s.critico === true, evaluaciones: fechasDe(s).map((f)=> ({ fecha: f })) }, anio, h) }; })
    .filter((f)=> f.c.estado).sort((a, b)=> String(a.s.nombre).localeCompare(String(b.s.nombre)));
}
function pintarCrono(panel){
  const fs = filasCrono(anioCrono), n = (m)=> fs.reduce((t, f)=> t + Object.values(f.c.meses).filter((v)=> v === m).length, 0);
  const prog = n('●') + n('✔') + n('⚠'), hech = n('✔'), venc = n('⚠');
  panel.innerHTML = '<div class="acciones-top"><button type="button" class="btn ghost" id="pdfCro">Cronograma ' + anioCrono + ' (PDF)</button><button type="button" class="btn ghost" id="csvCro">Exportar CSV</button></div>' +
    '<div class="anios">' + [anioCrono - 1, anioCrono, anioCrono + 1].map((a)=> '<button type="button" class="btn mini ' + (a === anioCrono ? '' : 'ghost') + '" data-anio="' + a + '">' + a + '</button>').join('') + '</div>' +
    '<div class="kpis"><div class="kpi"><div class="v">' + prog + '</div><div class="n">evaluaciones programadas</div></div><div class="kpi ok"><div class="v">' + hech + '</div><div class="n">ejecutadas</div></div><div class="kpi ' + (venc ? 'mal' : 'ok') + '"><div class="v">' + venc + '</div><div class="n">vencidas</div></div>' +
      '<div class="kpi"><div class="v">' + (hech + venc ? Math.round(hech * 100 / (hech + venc)) + ' %' : '—') + '</div><div class="n">cumplimiento del cronograma (meta 100 %)</div></div></div>' +
    '<p class="ayuda">● programada · ✔ ejecutada · ⚠ vencida. Críticos: semestral · no críticos: anual · con plan de mejora: a los 6 meses. Se aprueba con Gerencia en noviembre y se revisa cada mes.</p>' +
    (fs.length ? fs.map((f)=> { const s = f.s, est = f.c.estado;
      return '<button type="button" class="item ' + (est === 'VENCIDA' ? 'mal' : est === 'Ejecutada' ? 'ok' : '') + '" data-id="' + esc(f.x.id) + '"><div class="fila"><div><div class="t">' + esc(s.nombre) + '</div><div class="m">' + esc([catNombre(s), P.periodicidad(s.critico === true), 'última ' + (UI.corta(s.fechaEvaluacion) || '—'), 'próxima ' + (UI.corta(s.proximaEvaluacion) || '—'), 'Compras' + (s.critico === true ? ' y responsable de SST' : '')].filter(Boolean).join(' · ')) + '</div></div>' +
        '<span class="chip ' + (est === 'VENCIDA' ? 'mal' : est === 'Ejecutada' ? 'ok' : 'azul') + '">' + esc(est) + '</span></div><div class="meses">' + MESES.map((m, i)=> { const v = f.c.meses[i + 1] || ''; return '<span class="' + ({ '●': 'p', '✔': 'e', '⚠': 'v' }[v] || '') + '">' + m.slice(0, 1) + '<b>' + (v || '·') + '</b></span>'; }).join('') + '</div></button>'; }).join('')
      : '<div class="empty">Nada programado en ' + anioCrono + '. Las fechas salen de la última evaluación de cada proveedor.</div>');
  panel.querySelectorAll('[data-anio]').forEach((b)=> b.addEventListener('click', ()=> { anioCrono = +b.dataset.anio; pintar(); }));
  panel.querySelectorAll('[data-id]').forEach((b)=> b.addEventListener('click', ()=> verFicha(b.dataset.id)));
  $('pdfCro').addEventListener('click', ()=> pdfCronograma(anioCrono, fs));
  $('csvCro').addEventListener('click', ()=> descargarCSV('cronograma-proveedores-' + anioCrono + '.csv', [['N.°', 'Proveedor', 'Categoría', 'Crítico', 'Periodicidad', 'Última evaluación', 'Próxima evaluación'].concat(MESES, ['Estado', 'Responsable'])]
    .concat(fs.map((f, i)=> [i + 1, f.s.nombre, catNombre(f.s), f.s.critico === true ? 'Sí' : 'No', P.periodicidad(f.s.critico === true), f.s.fechaEvaluacion || '', f.s.proximaEvaluacion || ''].concat(MESES.map((m, k)=> f.c.meses[k + 1] || ''), [f.c.estado, 'Compras' + (f.s.critico === true ? ' y responsable de SST' : '')])))));
}
/* ── Pestaña: criterios SST para proveedores y contratistas ── */
function pintarSst(panel){
  const cats = P.categorias();
  panel.innerHTML = '<div class="card norma"><h2>Qué exige la norma</h2>' +
    '<p><b>Decreto 1072 de 2015, art. 2.2.4.6.27 · Adquisiciones.</b> El empleador debe establecer y mantener un procedimiento con el fin de garantizar que se identifiquen y evalúen, en las especificaciones relativas a las compras o adquisiciones de productos y servicios, las disposiciones relacionadas con el cumplimiento del SG-SST por parte de la empresa.</p>' +
    '<p><b>Decreto 1072 de 2015, art. 2.2.4.6.28 · Contratación.</b> El empleador debe adoptar y mantener las disposiciones que garanticen el cumplimiento de las normas de SST de su empresa por parte de los proveedores, trabajadores dependientes, cooperados, en misión, contratistas y sus trabajadores o subcontratistas, durante el desempeño de las actividades objeto del contrato. Como mínimo:</p>' +
    '<ol><li>Incluir los aspectos de SST en la evaluación y selección de proveedores y contratistas.</li><li>Procurar canales de comunicación para la gestión de SST con proveedores, contratistas y subcontratistas.</li>' +
    '<li>Verificar, antes del inicio del trabajo y periódicamente, la afiliación al Sistema General de Riesgos Laborales, considerando la rotación de su personal.</li>' +
    '<li>Informarles, antes del inicio del contrato, los peligros y riesgos generales y específicos de su zona de trabajo (incluidas las tareas de alto riesgo, rutinarias y no rutinarias), cómo controlarlos y las medidas de prevención y atención de emergencias; revisar durante el año la rotación de su personal para que todos reciban la misma información.</li>' +
    '<li>Instruirlos sobre el deber de informar los presuntos accidentes de trabajo y enfermedades laborales ocurridos durante el contrato.</li><li>Verificar periódicamente, durante el contrato, que cumplen la normatividad en SST.</li></ol>' +
    '<p><b>Resolución 0312 de 2019:</b> estándar 2.9.1 (identificación y evaluación de las especificaciones en SST para la adquisición de productos y servicios) y estándar 2.10.1 (evaluación y selección de proveedores y contratistas con criterios de SST).</p>' +
    '<p>Para el ingreso diario de contratistas (seguridad social del mes, inducción, documentos del personal) usa <a href="contratistas.html">Contratistas</a>.</p></div>' +
    '<div class="card"><h2>Niveles de riesgo de la matriz</h2><table class="mini-tabla"><tr><th>Nivel</th><th>Aplica a</th><th>Requisitos base</th></tr>' + Object.keys(P.NIVELES).map((k)=> '<tr><td><b>' + k + '</b></td><td>' + esc(P.NIVELES[k].aplica) + '</td><td>' + esc(P.NIVELES[k].base) + '</td></tr>').join('') + '</table>' +
      '<p class="ayuda">Proveedor crítico: su bien o servicio impacta directamente la calidad, la seguridad de las personas o el ambiente; se reevalúa cada 6 meses. Requisito excluyente ★: si falta o está vencido, no se contrata (etapa 2) o no se inicia ni continúa el servicio (etapa 3), sin importar el puntaje. Homologación: dos clasificaciones CONFIABLE seguidas → se propone a Gerencia para la lista de homologados (revisión semestral).</p></div>' +
    '<div class="card"><h2>Requisitos por categoría</h2><div class="field"><label>Categoría</label><select id="bCat" data-sin-otro>' + cats.map((c)=> '<option value="' + c.c + '">' + esc(c.c + ' · ' + c.n) + '</option>').join('') + '</select></div><div id="bInfo"></div><div id="bReqs"></div>' +
      '<div class="acciones-top u-mt10"><button type="button" class="btn ghost" id="bCopiar">Copiar correo para pedir los documentos</button></div></div>';
  const ver = ()=> { const c = P.categoria($('bCat').value), l = P.requisitos(c.c);
    $('bInfo').innerHTML = '<div class="aviso info">' + esc((c.b === 'Bien' ? 'Suministro (bien)' : 'Servicio') + ' · nivel ' + c.nivel + ' · ' + (c.critico ? 'crítico · reevaluación semestral' : 'no crítico · reevaluación anual') + ' · ' + l.length + ' requisitos · ' + l.filter((q)=> q.excl).length + ' excluyentes ★') + '</div>';
    $('bReqs').innerHTML = [1, 2, 3, 4].map((e)=> { const g = l.filter((q)=> q.etapa === e); return g.length ? '<div class="grupo-t">' + esc(P.ETAPAS[e]) + '</div>' + g.map((q)=> '<div class="req' + (q.excl ? ' excl' : '') + '"><div class="req-t">' + (q.excl ? '<b class="estrella">★</b> ' : '') + esc(q.texto) + '</div><div class="req-m">' + esc([q.aplica, q.vig && 'Vigencia: ' + q.vig, 'Verifica: ' + q.ver, q.base].filter(Boolean).join(' · ')) + '</div></div>').join('') : ''; }).join(''); };
  $('bCat').addEventListener('change', ver); ver();
  $('bCopiar').addEventListener('click', async ()=> { const t = P.plantillaCorreo($('bCat').value, EMPRESA.nombre || '', ''); try { await navigator.clipboard.writeText(t); UI.toast('✓ Correo copiado.'); } catch (e) { UI.modal('<h3>Correo para pedir los documentos</h3><textarea style="width:100%;min-height:300px;">' + esc(t) + '</textarea><button type="button" class="btn ghost" data-cerrar>Cerrar</button>'); } });
}

/* ── PDF y CSV ── */
function firmas(resp){
  return '<table><tr><td class="l" style="width:30%;">Rol</td><td class="l" style="width:25%;">Nombre</td><td class="l" style="width:20%;">Cargo</td><td class="l">Firma / fecha</td></tr>' +
    (resp || []).map((r)=> '<tr><td>' + esc(r.rol) + '</td><td>' + esc(r.nombre || '') + '</td><td>' + esc(r.cargo || '') + '</td><td style="height:34px;vertical-align:bottom;"><div style="border-top:1px solid #000;font-size:7px;padding-top:1px;">Firma</div></td></tr>').join('') + '</table>';
}
function pdfEvaluacion(d, ev){
  if (!ev) { UI.toast('Este proveedor no tiene evaluaciones con el formato.', 'mal'); return; }
  const datosProv = [['Nombre / razón social', d.nombre || ''], ['NIT', d.nit || ''], ['Persona', d.tipoPersona || ''], ['Ciudad', d.ciudad || ''], ['Contacto', [d.contacto, d.correo, d.telefono].filter(Boolean).join(' · ')], ['Categoría', ev.categoria || catNombre(d)],
    ['Nivel de riesgo', d.nivel || ''], ['¿Proveedor crítico?', d.critico === true ? 'Sí' : 'No']];
  const tablaCrit = (crit, extra)=> '<table><tr><td class="l">Criterio</td><td class="l a">Ponderación</td>' + (extra ? '<td class="l">Indicador / evidencia</td><td class="l a">Sugerida</td><td class="l a">Asignada</td>' : '') + '<td class="l a">Calificación</td><td class="l a">Resultado</td><td class="l">' + (extra ? 'Justificación' : 'Quién califica') + '</td></tr>' +
    crit.map((c, i)=> '<tr><td>' + esc(c.c) + '</td><td class="a">' + Math.round(ev.pesos[i] * 100) + ' %</td>' + (extra ? '<td>' + esc(extra.ind[i] || '') + '</td><td class="a">' + esc(ev.sug[i] === '' ? '—' : ev.sug[i]) + '</td><td class="a">' + esc(ev.asig[i] == null ? '' : ev.asig[i]) + '</td>' : '') +
      '<td class="a">' + esc(ev.cal[i]) + '</td><td class="a">' + (ev.cal[i] * ev.pesos[i]).toFixed(2).replace('.', ',') + '</td><td>' + esc(extra ? (ev.just[i] || '') : c.quien) + '</td></tr>').join('') + '</table>';
  const total = UI.tablaDatos([['Puntaje (sobre 5,0)', String(Number(ev.sobre5).toFixed(2)).replace('.', ',')], ['Porcentaje', pctTxt(ev.pct)], ['Clasificación', ev.clasificacion], [ev.tipo === 'Inicial' ? 'Decisión' : 'Acción', ev.tipo === 'Inicial' ? (P.DECISION[ev.clasificacion] || '') : (ev.accion || '')]]);
  let html;
  if (ev.tipo === 'Inicial') {
    const reqs = reqsDe(d).filter((q)=> q.etapa <= 2), mk = ev.marcas || d.requisitos || {};
    html = UI.cabecera('SG-EVAL-PROVEEDOR', 'EVALUACIÓN INICIAL Y SELECCIÓN DE PROVEEDORES, CONTRATISTAS Y SUBCONTRATISTAS', d.nombre + ' · ' + UI.corta(ev.fecha)) +
      UI.seccion('A. DATOS DE LA NECESIDAD', UI.tablaDatos([['Fecha de evaluación', UI.corta(ev.fecha)], ['N.° solicitud de compra', ev.solicitud || ''], ['Descripción del bien o servicio', ev.descripcion || ''], ['Área solicitante', ev.area || ''],
        ['Monto estimado', dinero(ev.monto)], ['Aprobación requerida', ev.aprobacion || ''], ['Ponderación aplicada', ev.ponderacion], ['Cotizaciones mínimas', P.cotizacionesMinimas(ev.monto) == null ? '' : String(P.cotizacionesMinimas(ev.monto))]])) +
      UI.seccion('B. DATOS DEL OFERENTE', UI.tablaDatos(datosProv.concat([['Valor cotizado sin IVA', dinero(ev.valorCotizado)], ['Tiempo de entrega ofrecido', ev.diasEntrega === '' ? '' : ev.diasEntrega + ' días'], ['¿Homologado?', ev.homologadoAlEvaluar ? 'Sí' : 'No'], ['Tipo', ev.tipoProveedor || '']]))) +
      UI.seccion('C. REQUISITOS DE LA MATRIZ (ETAPAS 1 Y 2) Y EXCLUYENTES', '<table><tr><td class="l a">N.°</td><td class="l">Etapa</td><td class="l">Requisito</td><td class="l">Aplica</td><td class="l a">★</td><td class="l">Verifica</td><td class="l a">Resultado</td></tr>' +
        (reqs.length ? reqs.map((q, i)=> '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(q.etapaTexto) + '</td><td>' + esc(q.texto) + '</td><td>' + esc(q.aplica) + '</td><td class="a">' + (q.excl ? '★' : '') + '</td><td>' + esc(q.ver) + '</td><td class="a">' + esc((mk[q.k] || {}).e || '') + '</td></tr>').join('') : '<tr><td colspan="7">Sin categoría de la matriz.</td></tr>') + '</table>' +
        UI.tablaDatos([['Requisitos excluyentes ★ de la matriz', ev.docs.estado], ['% cumplimiento documental', pctTxt(ev.docs.pct)], ['Documentación SST y ambiental verificada', ev.sstVerificada], ['Sin conflicto de interés declarado', ev.sinConflicto], ['RESULTADO REQUISITOS EXCLUYENTES', ev.excluyentes], ['Excluyentes sin cumplir', (ev.docs.faltan || []).join('; ') || '—']])) +
      UI.seccion('D. CALIFICACIÓN POR CRITERIO (1 = Muy deficiente · 2 = Deficiente · 3 = Aceptable · 4 = Bueno · 5 = Excelente)', tablaCrit(P.INICIAL) + total) +
      UI.seccion('E. JUSTIFICACIÓN DE LA SELECCIÓN / CONDICIONES', UI.textoLargo(ev.justificacion)) +
      UI.seccion('F. RESPONSABLES', firmas(ev.responsables)) +
      '<p style="font-size:7.5px;">Puntaje (%) = Σ (calificación × ponderación) ÷ 5 × 100. CONFIABLE ≥ 80 % · CONDICIONADO 60 % a 79 % (aprobación de Gerencia y condiciones registradas) · NO APTO &lt; 60 %. Un requisito excluyente ★ sin cumplir hace al oferente NO APTO aunque tenga buen puntaje. Decreto 1072 de 2015, arts. 2.2.4.6.27 y 2.2.4.6.28; Resolución 0312 de 2019, estándares 2.9.1 y 2.10.1.</p>';
  } else {
    const e = ev.evid || {}, I = ev.ind || P.indicadores(e);
    const ind = [(I.ss != null ? 'SS ' + pctTxt(I.ss * 100) + ' · ' : '') + (I.hallazgos != null ? 'Hallazgos ' + pctTxt(I.hallazgos * 100) + ' · ' : '') + 'Incidentes: ' + (Number(e.incidentes) || 0), I.nc != null ? 'NC: ' + pctTxt(I.nc * 100) : 'Sin datos', I.aTiempo != null ? 'A tiempo: ' + pctTxt(I.aTiempo * 100) : 'Sin datos', 'Cotizaciones de mercado', Number(e.conNC) === 0 ? 'Sin reclamaciones' : 'Cierre: ' + (e.diasCierre === '' ? '—' : e.diasCierre) + ' días', I.doc != null ? 'Doc. matriz: ' + pctTxt(I.doc * 100) : 'Contabilidad (facturas)'];
    html = UI.cabecera('SG-EVAL-PROVEEDOR', 'REEVALUACIÓN DE DESEMPEÑO DE PROVEEDORES, CONTRATISTAS Y SUBCONTRATISTAS', d.nombre + ' · ' + UI.corta(ev.fecha)) +
      UI.seccion('A. DATOS DEL PROVEEDOR Y DEL PERÍODO', UI.tablaDatos(datosProv.concat([['Bien o servicio suministrado', ev.servicio || d.servicio || ''], ['Tipo de reevaluación', ev.tipoReev], ['Período evaluado', UI.corta(ev.desde) + ' a ' + UI.corta(ev.hasta)], ['Fecha de reevaluación', UI.corta(ev.fecha)],
        ['Clasificación anterior', ev.anterior ? ev.anterior.clasificacion : 'NUEVO (sin evaluación previa)'], ['Porcentaje anterior', ev.anterior ? pctTxt(ev.anterior.pct) : '—'], ['¿Homologado actualmente?', ev.homologadoAlEvaluar ? 'Sí' : 'No'], ['¿Activa reevaluación extraordinaria?', ev.extraordinaria ? 'SÍ' : 'No']]))) +
      UI.seccion('B. EVIDENCIAS DE MONITOREO DEL PERÍODO', '<table><tr><td class="l">Dato</td><td class="l a">Valor</td><td class="l">Fuente / responsable</td></tr>' + EVID.map((x)=> '<tr><td>' + esc(x[1]) + '</td><td class="a">' + esc(e[x[0]] === '' || e[x[0]] == null ? '' : e[x[0]]) + '</td><td>' + esc(x[2]) + '</td></tr>').join('') + '</table>' +
        UI.tablaDatos([['% entregas a tiempo', I.aTiempo == null ? 'Sin entregas' : pctTxt(I.aTiempo * 100)], ['% entregas con NC', I.nc == null ? 'Sin entregas' : pctTxt(I.nc * 100)], ['% seguridad social verificada', I.ss == null ? 'N.A.' : pctTxt(I.ss * 100)], ['% inspecciones con hallazgos', I.hallazgos == null ? 'N.A.' : pctTxt(I.hallazgos * 100)], ['% cumplimiento documental según matriz', I.doc == null ? 'Sin datos' : pctTxt(I.doc * 100)], ['', '']])) +
      UI.seccion('C. CALIFICACIÓN POR CRITERIO', tablaCrit(P.REEV, { ind }) + total + (ev.limitePlan ? UI.tablaDatos([['Fecha límite del plan de mejora', UI.corta(ev.limitePlan)], ['Próxima reevaluación', UI.corta(P.proxima(ev.fecha, ev.clasificacion, d.critico === true)) || 'N.A. – retirado']]) : UI.tablaDatos([['Próxima reevaluación', UI.corta(P.proxima(ev.fecha, ev.clasificacion, d.critico === true)) || 'N.A. – retirado'], ['', '']]))) +
      UI.seccion('D. PLAN DE MEJORA DEL PROVEEDOR', '<table><tr><td class="l">Hallazgo / criterio</td><td class="l a">N.°</td><td class="l">Acción comprometida</td><td class="l">Responsable (proveedor)</td><td class="l">Fecha compromiso</td><td class="l">Estado</td><td class="l">Verificación de eficacia</td></tr>' +
        ((ev.plan || []).length ? ev.plan.map((p, i)=> '<tr><td>' + esc(p.hallazgo) + '</td><td class="a">' + (i + 1) + '</td><td>' + esc(p.accion) + '</td><td>' + esc(p.responsable || '') + '</td><td>' + esc(UI.corta(p.fecha)) + '</td><td>' + esc(p.estado || '') + '</td><td>' + esc(p.eficacia || '') + '</td></tr>').join('') : '<tr><td colspan="7">Sin acciones registradas.</td></tr>') + '</table>') +
      UI.seccion('E. OBSERVACIONES Y RETROALIMENTACIÓN AL PROVEEDOR', UI.textoLargo(ev.observaciones) + UI.tablaDatos([['Fecha de comunicación al proveedor', UI.corta(ev.fechaComunicacion) || ''], ['Medio', ev.medio || '']])) +
      UI.seccion('F. RESPONSABLES', firmas(ev.responsables)) +
      '<p style="font-size:7.5px;">CONFIABLE ≥ 80 % · ACEPTABLE CON PLAN DE MEJORA 60 % a 79 % · RECHAZADO &lt; 60 %. Periodicidad: crítico cada 6 meses, no crítico anual, con plan de mejora a los 6 meses, extraordinaria con alertas. Decreto 1072 de 2015, art. 2.2.4.6.28.</p>';
  }
  UI.imprimir([html]);
}
function pdfMatriz(l, consolidado){
  const h = UI.hoy(), act = l.filter((x)=> x.resumen.activo !== false), ev = act.filter((x)=> evaluado(x.resumen)), conf = ev.filter((x)=> P.color(x.resumen.resultado) === 'ok').length, venc = act.filter((x)=> estadoDe(x.resumen) === 'VENCIDA').length;
  UI.imprimir([UI.cabecera('SG-PROVEEDORES', consolidado ? 'CONSOLIDADO Y BASE DE DATOS DE PROVEEDORES EVALUADOS' : 'MATRIZ DE PROVEEDORES Y CONTRATISTAS', 'Corte ' + UI.corta(h)) +
    UI.tablaDatos([['Proveedores registrados', String(l.length)], ['% proveedores CONFIABLES (meta ≥ 80 %)', ev.length ? Math.round(conf * 100 / ev.length) + ' %' : '—'], ['Reevaluaciones VENCIDAS', String(venc)], ['Homologados', String(act.filter((x)=> x.resumen.homologado === true).length)]]) +
    '<table><tr><td class="l a">N.°</td><td class="l">Proveedor / razón social</td><td class="l">NIT</td><td class="l">Bien / servicio</td><td class="l">Categoría</td><td class="l a">Nivel</td><td class="l a">Crítico</td><td class="l a">Docs.</td><td class="l a">★ sin cumplir</td><td class="l">Última evaluación</td><td class="l a">%</td><td class="l">Clasificación</td><td class="l">Próxima</td><td class="l">Estado reevaluación</td><td class="l">Plan de mejora</td><td class="l a">Homologado</td></tr>' +
    l.map((x, i)=> { const s = x.resumen; return '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(s.nombre) + (s.activo === false ? ' (inactivo)' : '') + '</td><td>' + esc(s.nit || '') + '</td><td>' + esc([s.tipoProveedor, s.servicio].filter(Boolean).join(': ')) + '</td><td>' + esc(catNombre(s)) + '</td><td class="a">' + esc(s.nivel || '') + '</td><td class="a">' + (s.critico === true ? 'Sí' : s.nivel ? 'No' : '') + '</td>' +
      '<td class="a">' + pctTxt(s.docsPct) + '</td><td class="a">' + esc(s.excluyentesFaltan === '' || s.excluyentesFaltan == null ? '' : s.excluyentesFaltan) + '</td><td>' + esc([s.tipoEval, UI.corta(s.fechaEvaluacion)].filter(Boolean).join(' · ')) + '</td><td class="a">' + (evaluado(s) ? pctTxt(s.puntaje) : '') + '</td><td>' + esc(s.resultado || 'Sin evaluar') + '</td><td>' + esc(UI.corta(s.proximaEvaluacion)) + '</td><td>' + esc(estadoDe(s)) + '</td><td>' + esc(s.planMejora || '') + '</td><td class="a">' + (s.homologado === true ? 'Sí' : 'No') + '</td></tr>'; }).join('') + '</table>' +
    '<table><tr><td style="height:40px;vertical-align:bottom;width:50%;"><div style="border-top:1px solid #000;padding-top:2px;">Elaboró (Compras)</div></td><td class="u-abajo"><div style="border-top:1px solid #000;padding-top:2px;">Aprobó (Gerencia General)</div></td></tr></table>'], true);
}
function pdfComparativo(grupos){
  const ks = Object.keys(grupos).sort(); if (!ks.length) { UI.toast('Aún no hay evaluaciones iniciales.', 'mal'); return; }
  UI.imprimir([UI.cabecera('SG-EVAL-PROVEEDOR', 'CUADRO COMPARATIVO DE OFERENTES (EVALUACIÓN INICIAL)', 'Corte ' + UI.corta(UI.hoy())) + ks.map((k)=> { const l = grupos[k].slice().sort((a, b)=> Number(b.resumen.puntaje) - Number(a.resumen.puntaje)); let pos = 0;
    return UI.seccion(k.toUpperCase(), '<table><tr><td class="l a">Posición</td><td class="l">Oferente</td><td class="l">NIT</td><td class="l">Fecha</td><td class="l a">%</td><td class="l">Clasificación</td></tr>' + l.map((x)=> { const s = x.resumen, apto = /^(CONFIABLE|CONDICIONADO)$/.test(s.resultado); if (apto) pos++;
      return '<tr><td class="a">' + (apto ? pos : '–') + '</td><td>' + esc(s.nombre) + '</td><td>' + esc(s.nit || '') + '</td><td>' + esc(UI.corta(s.fechaEvaluacion)) + '</td><td class="a">' + pctTxt(s.puntaje) + '</td><td>' + esc(s.resultado) + '</td></tr>'; }).join('') + '</table>'); }).join('')]);
}
function pdfCronograma(anio, fs){
  UI.imprimir([UI.cabecera('SG-PROVEEDORES', 'CRONOGRAMA ANUAL DE EVALUACIÓN Y REEVALUACIÓN DE PROVEEDORES', 'Año ' + anio) +
    '<table><tr><td class="l a">N.°</td><td class="l">Proveedor</td><td class="l">Categoría</td><td class="l a">Crítico</td><td class="l">Periodicidad</td><td class="l">Última</td><td class="l">Próxima</td>' + MESES.map((m)=> '<td class="l a">' + m + '</td>').join('') + '<td class="l">Responsable</td><td class="l">Estado</td></tr>' +
    (fs.length ? fs.map((f, i)=> '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(f.s.nombre) + '</td><td>' + esc(catNombre(f.s)) + '</td><td class="a">' + (f.s.critico === true ? 'Sí' : 'No') + '</td><td>' + P.periodicidad(f.s.critico === true) + '</td><td>' + esc(UI.corta(f.s.fechaEvaluacion)) + '</td><td>' + esc(UI.corta(f.s.proximaEvaluacion)) + '</td>' +
      MESES.map((m, k)=> '<td class="a">' + esc(f.c.meses[k + 1] || '') + '</td>').join('') + '<td>Compras' + (f.s.critico === true ? ' y responsable de SST' : '') + '</td><td>' + esc(f.c.estado) + '</td></tr>').join('') : '<tr><td colspan="21">Sin evaluaciones programadas.</td></tr>') + '</table>' +
    '<p style="font-size:7.5px;">● programada · ✔ ejecutada · ⚠ vencida. Críticos: semestral · no críticos: anual · con plan de mejora: a los 6 meses.</p>' +
    '<table><tr><td style="height:40px;vertical-align:bottom;width:50%;"><div style="border-top:1px solid #000;padding-top:2px;">Elaboró (Compras)</div></td><td class="u-abajo"><div style="border-top:1px solid #000;padding-top:2px;">Aprobó (Gerencia General)</div></td></tr></table>'], true);
}
function descargarCSV(nombre, filas){
  const c = (t)=> { t = String(t == null ? '' : t); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + filas.map((f)=> f.map(c).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(()=> { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csvMatriz(l){
  if (!l.length) { UI.toast('No hay proveedores para exportar.', 'mal'); return; }
  descargarCSV('proveedores-' + UI.hoy() + '.csv', [['Razón social', 'NIT', 'Persona', 'Tipo', 'Qué suministra', 'Código categoría', 'Categoría', 'Nivel', 'Crítico', 'Ciudad', 'Contacto', 'Correo', 'Teléfono', 'Documentos %', 'Excluyentes sin cumplir', 'Última evaluación', 'Tipo de evaluación', '%', 'Clasificación', 'Próxima evaluación', 'Estado reevaluación', 'Plan de mejora', 'Homologado', 'Activo']]
    .concat(l.map((x)=> { const s = x.resumen; return [s.nombre, s.nit, s.tipoPersona, s.tipoProveedor, s.servicio, s.categoria === 'OTRO' ? 'Otro' : s.categoria, catNombre(s), s.nivel, s.critico === true ? 'Sí' : s.nivel ? 'No' : '', s.ciudad, s.contacto, s.correo, s.telefono, s.docsPct, s.excluyentesFaltan,
      s.fechaEvaluacion, s.tipoEval, evaluado(s) ? s.puntaje : '', s.resultado, s.proximaEvaluacion, estadoDe(s), s.planMejora, s.homologado === true ? 'Sí' : 'No', s.activo === false ? 'No' : 'Sí']; })));
}

/* ══ v109: ingreso de un proveedor nuevo por etapas ══
   1 Necesidad → 2 Cotizaciones (se puede parar aquí: queda «En cotización») → 3 Selección →
   4 Requisitos y documentos → 5 Evaluación inicial → 6 Decisión y alta en la matriz.
   La lógica (qué falta en cada etapa, cuadro comparativo, resumen) está en proveedores-catalogo.js. */
const procs = ()=> rows.filter((x)=> x.tipo === 'compraprov');
const abiertos = ()=> procs().filter((x)=> x.resumen.cerrado !== true && x.resumen.anulado !== true);
let PR = null;   // { d: proceso en edición, n: etapa que se ve }

/* NIT o cédula: la persona escribe solo los números; el guion y el dígito de verificación se ponen solos. */
function campoNit(id, label, valor){
  return '<div class="field" data-sin-valida><label for="' + id + '">' + esc(label) + '</label><input type="text" id="' + id + '" inputmode="numeric" maxlength="16" autocomplete="off" placeholder="Solo los números: 900123456" value="' + esc(valor || '') + '">' +
    '<div class="nit-aviso info" data-nit-aviso>Escribe solo los números: el guion y el dígito de verificación se ponen solos.</div></div>';
}
function activarNit(el, alCambiar){
  if (!el || el.dataset.nitOk) return; el.dataset.nitOk = '1';
  let prev = null; const av = el.parentElement.querySelector('[data-nit-aviso]');
  const pintar = (r)=> { if (!av) return; const malo = r.mal || (!!r.aviso && !r.ok);
    av.className = 'nit-aviso' + (malo ? '' : ' info');
    av.textContent = r.aviso || (r.ok ? 'Dígito de verificación: ' + r.dv + (r.auto ? ' (puesto por el portal)' : '') : 'Escribe solo los números: el guion y el dígito de verificación se ponen solos.'); };
  if (el.value) { prev = P.nitEscribiendo(el.value, null); el.value = prev.texto; pintar(prev); }
  el.addEventListener('input', ()=> {
    const r = P.nitEscribiendo(el.value, prev); prev = r;
    if (el.value !== r.texto) { el.value = r.texto; const pos = r.auto && r.dv !== '' ? r.base.length : r.texto.length; try { el.setSelectionRange(pos, pos); } catch (x) {} }
    pintar(r); if (alCambiar) alCambiar(r.texto);
  });
}
/* Requisitos ya marcados en la etapa 4 (dentro de la evaluación inicial del proceso, solo lectura). */
function resumenReqsProc(reqs, marcas){
  if (!reqs.length) return '<div class="ayuda">Sin requisitos de la matriz para esta categoría.</div>';
  const t = P.revisarDocs(reqs, marcas, [1, 2]);
  return '<p class="ayuda">Se marcaron en la etapa 4 (Requisitos y documentos). Si algo cambió, vuelve a esa etapa.</p>' +
    '<div class="aviso ' + (t.estado === 'CUMPLE' ? 'ok' : t.estado === 'NO CUMPLE' ? '' : 'amar') + '">★ Excluyentes: ' + esc(t.estado) + ' · cumplimiento documental ' + pctTxt(t.pct) + (t.faltan.length ? '<br>Sin cumplir: ' + esc(t.faltan.join('; ')) : '') + '</div>' +
    reqs.filter((q)=> q.excl).map((q)=> { const m = (marcas || {})[q.k] || {}; return '<div class="dato"><span>★ ' + esc(q.texto) + '</span><b>' + esc(m.e || 'Sin marcar') + '</b></div>'; }).join('');
}

/* ── Lista de ingresos en la pestaña Matriz ── */
function pintarProcesos(cont){
  if (!cont) return;
  const ab = abiertos().sort((a, b)=> String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
  const cer = procs().filter((x)=> x.resumen.cerrado === true || x.resumen.anulado === true).sort((a, b)=> String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
  if (!ab.length && !cer.length) { cont.innerHTML = F.clas === 'curso' ? '<div class="empty">No hay ingresos en curso.</div>' : ''; return; }
  const tarjeta = (x)=> { const s = x.resumen, cerr = s.cerrado === true || s.anulado === true, mal = /no apto|anulado/i.test(s.estadoProceso || '');
    return '<div class="proc-c' + (cerr ? (mal ? ' mal' : ' cerrado') : '') + '"><div><div class="t">' + esc(s.necesidad || 'Ingreso sin nombre') + '</div>' +
      '<div class="m">' + esc([s.estadoProceso, s.detalleEtapa].filter(Boolean).join(' · ')) + '</div>' +
      '<div class="m">' + esc([s.elegido ? 'Elegido: ' + s.elegido : (s.candidatos ? 'Cotizan: ' + s.candidatos : ''), s.fecha && 'desde ' + UI.corta(s.fecha)].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button type="button" class="btn ' + (cerr ? 'ghost' : 'amber') + '" data-proc="' + esc(x.id) + '">' + (cerr ? 'Ver' : 'Continuar') + '</button></div>'; };
  cont.innerHTML = (ab.length ? '<div class="grupo-t">Ingresos de proveedores en curso (' + ab.length + ')</div>' + ab.map(tarjeta).join('') : (F.clas === 'curso' ? '<div class="empty">No hay ingresos en curso.</div>' : '')) +
    (cer.length ? '<details' + (F.verCerrados ? ' open' : '') + ' id="procCer"><summary class="grupo-t" style="cursor:pointer;min-height:40px;display:flex;align-items:center;">Ingresos cerrados (' + cer.length + ')</summary>' + cer.slice(0, 30).map(tarjeta).join('') + '</details>' : '');
  cont.querySelectorAll('[data-proc]').forEach((b)=> b.addEventListener('click', ()=> continuarProceso(b.dataset.proc)));
  const d = cont.querySelector('#procCer'); if (d) d.addEventListener('toggle', ()=> { F.verCerrados = d.open; });
}
/* Oferentes que cotizaron y no se eligieron: quedan a la mano para la próxima compra. */
function pintarCandidatos(cont){
  if (!cont) return;
  if (F.clas === 'curso') { cont.innerHTML = ''; return; }
  const l = []; procs().filter((x)=> x.resumen.cerrado === true).forEach((x)=> String(x.resumen.candidatos || '').split(/\s*,\s*/).filter((c)=> c && !/\(elegido\)/.test(c)).forEach((c)=> l.push({ c, n: x.resumen.necesidad, f: x.resumen.fecha })));
  cont.innerHTML = l.length ? '<details class="u-mt12"><summary class="grupo-t" style="cursor:pointer;min-height:40px;display:flex;align-items:center;">Otros oferentes que han cotizado (' + l.length + ')</summary>' +
    l.slice(0, 40).map((o)=> '<div class="dato"><span>' + esc(o.n || '') + (o.f ? ' · ' + esc(UI.corta(o.f)) : '') + '</span><b>' + esc(o.c) + '</b></div>').join('') + '</details>' : '';
}

/* ── Abrir, guardar ── */
function nuevoProceso(){ abrirProceso({ id: SGSST.nuevoId('CPV'), nuevo: true, fecha: UI.hoy(), responsable: quienSoy(), cotizaciones: [], marcas: {}, firmasComp: { elaboro: { nombre: quienSoy(), cargo: '' }, aprobo: {} } }, 1); }
async function continuarProceso(id){ const d = await Registros.abrir(id); if (!d) return; abrirProceso(d, Math.min(P.etapaAlta(d), 6)); }
function abrirProceso(d, n){
  const p = JSON.parse(JSON.stringify(d)); p.cotizaciones = p.cotizaciones || []; p.marcas = p.marcas || {}; p.firmasComp = p.firmasComp || { elaboro: {}, aprobo: {} }; p.seleccion = p.seleccion || {}; p.decision = p.decision || {};
  PR = { d: p, n: n || 1 }; pintarProceso(); show('scrProc');
}
async function guardarProceso(){
  const p = PR.d, res = P.resumenAlta(p);
  const doc = Object.assign({}, p, res, { candidatos: res.candidatos.join(', '), categoriaNombre: p.categoria === 'OTRO' ? p.categoriaNombre : ((P.categoria(p.categoria) || {}).n || ''), cerrado: !!p.cerrado, anulado: !!p.anulado });
  const r = await Registros.guardar('compraprov', p.id, doc, p.nuevo ? 0 : p.version);
  if (typeof r === 'string') return r;
  if (r.enCola) { UI.toast('⏳ Guardado en el equipo; se envía al volver la señal.'); await cargar(); show('scrLista'); return 'cola'; }
  const d2 = await SGSST.doc(p.id); if (d2) { delete d2.nuevo; PR.d = Object.assign(JSON.parse(JSON.stringify(d2)), { cotizaciones: d2.cotizaciones || [], marcas: d2.marcas || {}, firmasComp: d2.firmasComp || { elaboro: {}, aprobo: {} }, seleccion: d2.seleccion || {}, decision: d2.decision || {} }); }
  cargar();
  return true;
}
const valorDe = (o, ruta)=> ruta.split('.').reduce((a, k)=> (a == null ? undefined : a[k]), o);
function ponerValor(o, ruta, v){ const ks = ruta.split('.'); let a = o; ks.slice(0, -1).forEach((k)=> { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
const elegidaDe = (p)=> (p.cotizaciones || []).find((c)=> c.uid === p.elegida) || null;
function faltaHTML(p, n){
  const f = P.faltaEtapa(p, n);
  if (!f.length) return '<div class="falta ok" id="prFalta">✓ Esta etapa está completa.' + (n < 6 ? ' Toca «Guardar y seguir».' : '') + '</div>';
  return '<div class="falta" id="prFalta"><b>Para terminar esta etapa falta:</b><ul>' + f.slice(0, 12).map((x)=> '<li>' + esc(x.etiqueta) + ': ' + esc(x.error) + '</li>').join('') + (f.length > 12 ? '<li>y ' + (f.length - 12) + ' más</li>' : '') + '</ul></div>';
}
const refrescarFalta = ()=> { const b = $('prFalta'); if (b && PR) b.outerHTML = faltaHTML(PR.d, PR.n); };

function pintarProceso(){
  const p = PR.d, n = PR.n, e = P.etapaAlta(p), s = $('scrProc'), cerrado = !!(p.cerrado || p.anulado);
  const pasos = P.ETAPAS_ALTA.map((t, i)=> { const k = i + 1, hecha = k < e || cerrado, puede = k <= e || cerrado;
    return '<button type="button" data-paso="' + k + '" class="' + (k === n ? 'actual' : hecha ? 'hecha' : '') + '"' + (puede ? '' : ' disabled') + ' aria-label="Etapa ' + k + ': ' + esc(t) + '"><b>' + (hecha && k !== n ? '✓' : k) + '</b><span>' + esc(t) + '</span></button>'; }).join('');
  const el = elegidaDe(p), pct = Math.round((Math.min(e, 7) - 1) * 100 / 6);
  s.innerHTML = '<div class="hdr"><a class="back" href="#" data-volver>← Volver</a><div class="eyebrow">' + esc(p.nuevo ? 'Nuevo proveedor' : p.id) + ' · ingreso por etapas</div><h1>' + esc(p.necesidad || 'Nuevo proveedor o contratista') + '</h1>' +
      '<p>' + esc(p.anulado ? 'Proceso anulado' : p.cerrado ? 'Cerrado: ' + ((p.decision || {}).resultado || '') : P.resumenAlta(p).estadoProceso + (el ? ' · elegido: ' + el.nombre : '')) + '</p></div>' +
    '<div class="card"><div class="pasos">' + pasos + '</div><div class="avance"><i style="width:' + pct + '%"></i></div><div class="etapa-t">Etapa ' + n + ' de 6 · <b>' + esc(P.ETAPAS_ALTA[n - 1]) + '</b></div>' + (cerrado ? '' : faltaHTML(p, n)) + '</div>' +
    '<div id="prCuerpo"></div><div id="prMsg"></div>' +
    (n === 5 && !p.evaluacion && !cerrado ? '' : '<div class="barra-guardar">' +
      (cerrado ? '<button type="button" class="btn ghost" data-volver>Volver a la lista</button>' :
        (n < 6 ? '<button type="button" class="btn amber" id="prSig">Guardar y seguir →</button>' : '') +
        '<button type="button" class="btn ghost" id="prGuardar">' + (n === 2 ? 'Guardar: queda en cotización' : 'Guardar y seguir después') + '</button>') + '</div>');
  s.querySelectorAll('[data-paso]').forEach((b)=> b.addEventListener('click', ()=> { if (b.disabled) return; PR.n = +b.dataset.paso; pintarProceso(); window.scrollTo(0, 0); }));
  ({ 1: etapaNecesidad, 2: etapaCotizaciones, 3: etapaSeleccion, 4: etapaDocumentos, 5: etapaEvaluacion, 6: etapaDecision })[n]($('prCuerpo'), cerrado);
  refrescarFalta();
  if (cerrado) $('prCuerpo').querySelectorAll('input,select,textarea,button:not([data-pdf])').forEach((x)=> { if (!x.closest('.cmp-pdf')) x.disabled = true; });
  // Enlaza los campos con el proceso (data-pk = ruta dentro del proceso).
  $('prCuerpo').querySelectorAll('[data-pk]').forEach((inp)=> {
    const k = inp.dataset.pk, tipo = inp.dataset.tipo, v = valorDe(p, k);
    if (inp.type === 'checkbox') inp.checked = v === true; else if (v != null && inp.value === '') inp.value = tipo === 'bool' ? (v === true ? 'Sí' : v === false ? 'No' : '') : v;
    inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'checkbox' || inp.type === 'date' || inp.dataset.repinta ? 'change' : 'input', ()=> {
      let val = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (tipo === 'num') val = inp.value === '' ? '' : Number(inp.value); else if (tipo === 'bool') val = inp.value === 'Sí' ? true : inp.value === 'No' ? false : '';
      else if (typeof val === 'string' && inp.type !== 'date') val = val.replace(/^\s+/, '');
      ponerValor(p, k, val); refrescarFalta(); if (inp.dataset.repinta) { PR.n = n; const y = scrollY; pintarProceso(); window.scrollTo(0, y); }
    });
  });
  if ($('prGuardar')) $('prGuardar').addEventListener('click', async ()=> { $('prGuardar').disabled = true; const g = await guardarProceso(); if ($('prGuardar')) $('prGuardar').disabled = false;
    if (typeof g === 'string' && g !== 'cola') { $('prMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>'; return; }
    if (g === true) { UI.toast('✓ Guardado: ' + P.resumenAlta(PR.d).estadoProceso + '. Lo continúas desde la lista de proveedores.'); show('scrLista'); pintar(); } });
  if ($('prSig')) $('prSig').addEventListener('click', async ()=> {
    const f = P.faltaEtapa(PR.d, n);
    if (f.length) { refrescarFalta(); marcarFaltas(f); const b = $('prFalta'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    $('prSig').disabled = true; const g = await guardarProceso(); if ($('prSig')) $('prSig').disabled = false;
    if (typeof g === 'string') { if (g !== 'cola') $('prMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>'; return; }
    PR.n = Math.min(6, n + 1); pintarProceso(); window.scrollTo(0, 0);
  });
}
/* Resalta los campos que faltan (los que tienen data-pk o data-falta con la misma ruta). */
function marcarFaltas(f){
  const c = $('prCuerpo'); Valida.limpiar(c);
  f.forEach((x)=> { const el = c.querySelector('[data-pk="' + x.campo + '"]') || c.querySelector('[data-falta="' + x.campo + '"]'); if (el) Valida.marcar(el, x.error); });
  const prim = c.querySelector('.v-falta'); if (prim) try { prim.focus({ preventScroll: true }); } catch (e) {}
}

/* Etapa 1: la necesidad */
function etapaNecesidad(c){
  const p = PR.d, cats = P.categorias(), op = (x)=> '<option value="' + x.c + '"' + (p.categoria === x.c ? ' selected' : '') + '>' + esc(x.c + ' · ' + x.n) + '</option>';
  const min = P.cotMinimasProc(p), ap = p.monto === '' || p.monto == null ? '' : P.aprobacion(p.monto, p.critico === true);
  c.innerHTML = '<div class="card"><h2>¿Qué se necesita?</h2>' +
    '<div class="field"><label>Qué se va a comprar o contratar *</label><input type="text" data-pk="necesidad" maxlength="140" placeholder="Ej.: alquiler de andamio certificado con montaje"></div>' +
    '<div class="grid2"><div class="field"><label>Área que lo pide</label><input type="text" data-pk="area" maxlength="80" placeholder="Ej.: Mantenimiento"></div><div class="field"><label>N.° de solicitud de compra</label><input type="text" data-pk="solicitud" maxlength="40"></div></div>' +
    '<div class="grid2"><div class="field"><label>Fecha de la solicitud *</label><input type="date" data-pk="fecha" max="' + UI.hoy() + '"></div><div class="field"><label>Responsable del proceso</label><input type="text" data-pk="responsable" maxlength="80"></div></div>' +
    '<div class="field"><label>Monto estimado de la compra ($) *</label><input type="number" data-pk="monto" data-tipo="num" data-repinta="1" min="0" step="1" inputmode="numeric" placeholder="Ej.: 4500000"></div>' +
    '<div class="aviso info">Cotizaciones que pide el procedimiento: <b>' + (p.unico ? '1 (proveedor único)' : min) + '</b>' + (ap ? ' · aprobación: <b>' + esc(ap) + '</b>' : '') + '. En la etapa 2 se comparan antes de elegir.</div></div>' +
    '<div class="card"><h2>Categoría de la matriz</h2>' +
    '<div class="field"><label>Categoría *</label><select data-pk="categoria" data-repinta="1" data-sin-otro><option value="">— Elige la categoría —</option><optgroup label="Suministro de bienes">' + cats.filter((x)=> x.b === 'Bien').map(op).join('') + '</optgroup><optgroup label="Servicios y contratistas">' + cats.filter((x)=> x.b !== 'Bien').map(op).join('') + '</optgroup><option value="OTRO"' + (p.categoria === 'OTRO' ? ' selected' : '') + '>Otra (escribir)</option></select></div>' +
    (p.categoria === 'OTRO' ? '<div class="field"><label>Nombre de la categoría *</label><input type="text" data-pk="categoriaNombre" maxlength="80"></div>' +
      '<div class="field"><label>Categoría más parecida (para los requisitos) *</label><select data-pk="categoriaBase" data-sin-otro><option value="">— Elige —</option>' + cats.map((x)=> '<option value="' + x.c + '">' + esc(x.c + ' · ' + x.n) + '</option>').join('') + '</select></div>' +
      '<div class="grid2"><div class="field"><label>Nivel de riesgo *</label><select data-pk="nivel" data-sin-otro><option value="">—</option>' + Object.keys(P.NIVELES).map((x)=> '<option>' + x + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>¿Proveedor crítico? *</label><select data-pk="critico" data-tipo="bool" data-repinta="1" data-sin-otro><option value="">—</option><option>Sí</option><option>No</option></select></div></div>' : '') +
    (P.categoria(p.categoria) ? '<div class="ayuda">' + esc((P.categoria(p.categoria).b === 'Bien' ? 'Suministro (bien)' : 'Servicio') + ' · nivel ' + P.categoria(p.categoria).nivel + ' · ' + (P.categoria(p.categoria).critico ? 'crítico' : 'no crítico') + ' · ' + P.requisitos(p.categoria).filter((q)=> q.etapa <= 2 && q.excl).length + ' requisito(s) ★ para contratar') + '</div>' : '') +
    '<div class="field"><label>Tipo *</label><select data-pk="tipoProveedor" data-sin-otro><option value="">—</option>' + P.TIPOS_PROVEEDOR.map((t)=> '<option>' + esc(t) + '</option>').join('') + '</select></div>' +
    '<label class="check"><input type="checkbox" data-pk="unico" data-repinta="1"> Solo hay un proveedor posible (proveedor único)</label>' +
    (p.unico ? '<div class="field"><label>¿Por qué solo hay uno? *</label><textarea data-pk="unicoJust" maxlength="600" placeholder="Ej.: es el representante exclusivo de la marca del equipo"></textarea></div>' : '') + '</div>';
  // Al elegir la categoría: nivel, criticidad y tipo salen de la matriz.
  const cat = P.categoria(p.categoria);
  if (cat) { p.nivel = cat.nivel; p.critico = cat.critico; p.categoriaNombre = cat.n; const t = P.tipoSegunCategoria(p.categoria);
    if (!p.tipoProveedor || (cat.b === 'Bien') !== (p.tipoProveedor === 'Proveedor de bienes')) p.tipoProveedor = t; }
}

/* Etapa 2: cotizaciones y cuadro comparativo */
function etapaCotizaciones(c){
  const p = PR.d, min = P.cotMinimasProc(p), ex = P.exclContratar(p), cs = p.cotizaciones;
  if (!cs.length) for (let i = 0; i < Math.max(1, min); i++) cs.push({ uid: SGSST.nuevoOpId(), excl: {} });
  const fp = (v)=> '<option value="">—</option>' + P.FORMAS_PAGO.map((f)=> '<option' + (v === f ? ' selected' : '') + '>' + esc(f) + '</option>').join('');
  c.innerHTML = '<div class="aviso info">El procedimiento pide <b>' + min + '</b> cotización(es)' + (p.unico ? ' (proveedor único)' : ' para este monto') + '. Puedes guardar con las que tengas y seguir cuando lleguen las demás: el proceso queda <b>«En cotización»</b>.</div>' +
    cs.map((q, i)=> { const fl = P.faltaCot(q), no = q.estado === 'No apto';
      return '<div class="cot' + (no ? ' noapto' : '') + '" data-cot="' + i + '"><div class="cot-h"><b>Cotización ' + (i + 1) + (q.nombre ? ' · ' + esc(q.nombre) : '') + '</b>' +
        '<span class="chip ' + (no ? 'mal' : fl.length ? 'pronto' : 'ok') + '">' + (no ? 'No apto' : fl.length ? 'Incompleta' : 'Completa') + '</span></div>' +
        '<div class="field"><label>Razón social *</label><input type="text" data-pk="cotizaciones.' + i + '.nombre" data-falta="cot:' + i + ':nombre" maxlength="140"></div>' +
        '<div class="grid2">' + campoNit('cNit' + i, 'NIT o cédula *', q.nit).replace('<input ', '<input data-pk="cotizaciones.' + i + '.nit" data-falta="cot:' + i + ':nit" ') +
        '<div class="field"><label>Contacto</label><input type="text" data-pk="cotizaciones.' + i + '.contacto" maxlength="80"></div></div>' +
        '<div class="grid2"><div class="field"><label>Teléfono</label><input type="tel" data-pk="cotizaciones.' + i + '.telefono" maxlength="20"></div><div class="field"><label>Correo</label><input type="email" data-pk="cotizaciones.' + i + '.correo" maxlength="120"></div></div>' +
        '<div class="grid2"><div class="field"><label>Valor sin IVA ($) *</label><input type="number" min="0" step="1" inputmode="numeric" data-pk="cotizaciones.' + i + '.valor" data-falta="cot:' + i + ':valor" data-tipo="num"></div>' +
        '<div class="field"><label>Plazo de entrega (días) *</label><input type="number" min="0" step="1" inputmode="numeric" data-pk="cotizaciones.' + i + '.plazo" data-falta="cot:' + i + ':plazo" data-tipo="num"></div></div>' +
        '<div class="grid2"><div class="field"><label>Forma de pago *</label><select data-pk="cotizaciones.' + i + '.formaPago" data-falta="cot:' + i + ':formaPago" data-sin-otro>' + fp(q.formaPago) + '</select></div>' +
        '<div class="field"><label>Garantía (meses) *</label><input type="number" min="0" step="1" inputmode="numeric" data-pk="cotizaciones.' + i + '.garantia" data-falta="cot:' + i + ':garantia" data-tipo="num" placeholder="0 si no ofrece"></div></div>' +
        '<div class="field"><label>¿Cumple la especificación de SST (EPP certificado, fichas, personal competente…)? *</label><select data-pk="cotizaciones.' + i + '.cumpleSst" data-falta="cot:' + i + ':cumpleSst" data-sin-otro><option value="">—</option><option' + (q.cumpleSst === 'Sí' ? ' selected' : '') + '>Sí</option><option' + (q.cumpleSst === 'No' ? ' selected' : '') + '>No</option></select></div>' +
        (ex.length ? '<details><summary>Requisitos ★ para contratar que ya mostró (' + ex.filter((x)=> (q.excl || {})[x.k]).length + ' de ' + ex.length + ')</summary>' + ex.map((x)=> '<label class="chk"><input type="checkbox" data-pk="cotizaciones.' + i + '.excl.' + x.k.replace(/\./g, '_') + '" data-exk="' + esc(x.k) + '"> <span>' + esc(x.texto) + '</span></label>').join('') + '</details>' : '') +
        '<div class="field"><label>Observaciones</label><input type="text" data-pk="cotizaciones.' + i + '.obs" maxlength="200"></div>' +
        '<div class="pq-bots" style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" class="btn-mini" data-noapto="' + i + '">' + (no ? 'Ya no es «no apto»' : 'Marcar «no apto»') + '</button>' + (cs.length > 1 ? '<button type="button" class="btn-mini u-mal" data-qcot="' + i + '">Quitar</button>' : '') + '</div></div>'; }).join('') +
    (cs.length < 6 ? '<button type="button" class="btn ghost" id="cAdd" data-falta="cotAdd">+ Agregar otra cotización</button>' : '') +
    '<div id="prCmp"></div>';
  // Los requisitos ★ se guardan con su clave real (la de la matriz), no con la ruta de data-pk.
  c.querySelectorAll('[data-exk]').forEach((chk)=> { const i = +chk.closest('[data-cot]').dataset.cot, k = chk.dataset.exk; chk.checked = !!((cs[i].excl || {})[k]); chk.removeAttribute('data-pk');
    chk.addEventListener('change', ()=> { cs[i].excl = cs[i].excl || {}; if (chk.checked) cs[i].excl[k] = true; else delete cs[i].excl[k]; pintarCmp(); refrescarFalta(); }); });
  c.querySelectorAll('input[id^="cNit"]').forEach((inp)=> activarNit(inp));
  c.addEventListener('change', (ev)=> { if (ev.target.closest('[data-cot]')) pintarCmp(); });
  c.addEventListener('focusout', (ev)=> { const k = ev.target.closest('[data-cot]'); if (!k) return; const i = +k.dataset.cot, fl = P.faltaCot(cs[i]), ch = k.querySelector('.cot-h .chip'), no = cs[i].estado === 'No apto';
    if (ch) { ch.className = 'chip ' + (no ? 'mal' : fl.length ? 'pronto' : 'ok'); ch.textContent = no ? 'No apto' : fl.length ? 'Incompleta' : 'Completa'; }
    const t = k.querySelector('.cot-h b'); if (t) t.textContent = 'Cotización ' + (i + 1) + (cs[i].nombre ? ' · ' + cs[i].nombre : ''); });
  c.querySelectorAll('[data-noapto]').forEach((b)=> b.addEventListener('click', ()=> { const q = cs[+b.dataset.noapto]; q.estado = q.estado === 'No apto' ? '' : 'No apto'; if (q.estado && p.elegida === q.uid) p.elegida = ''; const y = scrollY; pintarProceso(); window.scrollTo(0, y); }));
  c.querySelectorAll('[data-qcot]').forEach((b)=> b.addEventListener('click', async ()=> { const q = cs[+b.dataset.qcot]; if ((q.nombre || q.valor) && !await Dialogo.confirmar('¿Quitar la cotización de ' + (q.nombre || 'este oferente') + '?')) return; if (p.elegida === q.uid) p.elegida = ''; cs.splice(+b.dataset.qcot, 1); const y = scrollY; pintarProceso(); window.scrollTo(0, y); }));
  if ($('cAdd')) $('cAdd').addEventListener('click', ()=> { cs.push({ uid: SGSST.nuevoOpId(), excl: {} }); pintarProceso(); const u = document.querySelectorAll('[data-cot]'); if (u.length) u[u.length - 1].scrollIntoView({ block: 'start' }); });
  pintarCmp();
}
/* Cuadro comparativo: aparece cuando ya están las cotizaciones mínimas completas. */
function pintarCmp(forzar){
  const box = $('prCmp'); if (!box) return;
  const p = PR.d, min = P.cotMinimasProc(p), ok = p.cotizaciones.filter((q)=> !P.faltaCot(q).length && q.estado !== 'No apto').length;
  // No se repinta si nada del cuadro cambió (así el toque en «Elegir» no se pierde al salir de un campo).
  const firma = JSON.stringify([ok, min, p.elegida, ok >= min ? P.comparar(p).filas : null]);
  if (!forzar && box.dataset.firma === firma) return; box.dataset.firma = firma;
  if (ok < min) { box.innerHTML = '<div class="aviso amar">Cuadro comparativo: van <b>' + ok + ' de ' + min + '</b> cotizaciones completas. Cuando estén todas, aquí se comparan y se elige.</div>'; return; }
  const cmp = P.comparar(p), ex = cmp.totalExcl, filas = cmp.filas.slice().sort((a, b)=> (b.cumple - a.cumple) || (b.puntaje - a.puntaje));
  box.innerHTML = '<div class="card"><h2>Cuadro comparativo</h2><p class="ayuda">Puntaje con los pesos de la evaluación inicial (SST y requisitos ★, precio, plazo y garantía). Promedio de las cotizaciones: <b>' + dinero(cmp.promedio) + '</b>.</p>' +
    filas.map((f)=> '<div class="cmp' + (f.recomendado ? ' rec' : '') + (f.uid === p.elegida ? ' elegida' : '') + (f.cumple ? '' : ' nocumple') + '"><div class="cmp-h"><div class="t">' + esc(f.nombre) + '</div><b>' + String(f.puntaje).replace('.', ',') + ' pts</b></div>' +
      '<div class="chips-r">' + (f.recomendado ? '<span class="chip ok">Más conveniente</span>' : '') + (f.masBarato ? '<span class="chip azul">Más barato</span>' : '') + (f.masRapido ? '<span class="chip">Entrega más rápida</span>' : '') + (f.uid === p.elegida ? '<span class="chip">Elegido</span>' : '') + (!f.cumple ? '<span class="chip mal">' + (f.noApto ? 'No apto' : 'No cumple SST') + '</span>' : '') + '</div>' +
      '<div class="cmp-g"><div><span>Valor sin IVA</span>' + dinero(f.valor) + ' (' + (f.vsPromedio > 0 ? '+' : '') + String(f.vsPromedio).replace('.', ',') + ' % vs. promedio)</div><div><span>Entrega</span>' + f.plazo + ' días</div>' +
      '<div><span>Garantía</span>' + f.garantia + ' meses</div><div><span>Pago</span>' + esc(f.formaPago || '—') + '</div>' + (ex ? '<div><span>Requisitos ★ mostrados</span>' + f.nExcl + ' de ' + ex + '</div>' : '') + '</div>' +
      (f.cumple ? '<button type="button" class="btn ' + (f.uid === p.elegida ? 'ghost' : 'amber') + ' btn-elegir" data-elegir="' + esc(f.uid) + '">' + (f.uid === p.elegida ? '✓ Elegido' : 'Elegir este proveedor') + '</button>' : '') + '</div>').join('') +
    '<div class="field" data-falta="elegida"></div>' +
    '<div class="field"><label>Justificación de la elección' + (cmp.masBarato === p.elegida && cmp.recomendado === p.elegida ? '' : ' *') + '</label><textarea id="cJus" data-falta="justificacion" maxlength="800" placeholder="' + (p.elegida && cmp.masBarato !== p.elegida ? 'No es el más barato: explica por qué se elige (calidad, plazo, garantía, SST…)' : 'Por qué se elige este proveedor') + '">' + esc(p.justificacion || '') + '</textarea></div>' +
    '<div class="grid2"><div class="field"><label>Elaboró el cuadro *</label><input type="text" id="cEla" data-falta="firmasComp.elaboro.nombre" maxlength="80" value="' + esc(((p.firmasComp || {}).elaboro || {}).nombre || '') + '"></div><div class="field"><label>Cargo</label><input type="text" id="cElaC" maxlength="60" value="' + esc(((p.firmasComp || {}).elaboro || {}).cargo || '') + '"></div></div>' +
    '<div class="grid2"><div class="field"><label>Aprobó</label><input type="text" id="cApr" maxlength="80" value="' + esc(((p.firmasComp || {}).aprobo || {}).nombre || '') + '"></div><div class="field"><label>Cargo</label><input type="text" id="cAprC" maxlength="60" value="' + esc(((p.firmasComp || {}).aprobo || {}).cargo || '') + '"></div></div>' +
    '<div class="cmp-pdf"><button type="button" class="btn ghost" id="cPdf" data-pdf>Cuadro comparativo (PDF)</button></div></div>';
  box.querySelectorAll('[data-elegir]').forEach((b)=> b.addEventListener('click', ()=> { p.elegida = b.dataset.elegir; pintarCmp(true); refrescarFalta(); }));
  const liga = (id, ruta)=> { const el = $(id); if (el) el.addEventListener('input', ()=> { ponerValor(p, ruta, el.value); refrescarFalta(); }); };
  liga('cJus', 'justificacion'); liga('cEla', 'firmasComp.elaboro.nombre'); liga('cElaC', 'firmasComp.elaboro.cargo'); liga('cApr', 'firmasComp.aprobo.nombre'); liga('cAprC', 'firmasComp.aprobo.cargo');
  $('cPdf').addEventListener('click', ()=> pdfCotizaciones(p));
}
function pdfCotizaciones(p){
  const cmp = P.comparar(p), el = elegidaDe(p), f = p.firmasComp || {};
  UI.imprimir([UI.cabecera('SG-EVAL-PROVEEDOR', 'CUADRO COMPARATIVO DE COTIZACIONES', (p.necesidad || '') + ' · ' + UI.corta(p.fecha || UI.hoy())) +
    UI.tablaDatos([['Necesidad', p.necesidad || ''], ['Área', p.area || ''], ['Solicitud N.°', p.solicitud || ''], ['Monto estimado', dinero(p.monto)], ['Categoría', p.categoria === 'OTRO' ? p.categoriaNombre : ((P.categoria(p.categoria) || {}).n || '')], ['Cotizaciones requeridas', String(P.cotMinimasProc(p))]]) +
    '<table><tr><td class="l">Oferente</td><td class="l">NIT</td><td class="l a">Valor sin IVA</td><td class="l a">Entrega (días)</td><td class="l a">Garantía (meses)</td><td class="l">Pago</td><td class="l a">SST</td><td class="l a">Puntaje</td></tr>' +
    cmp.filas.map((x)=> '<tr><td>' + esc(x.nombre) + (x.uid === p.elegida ? ' <b>(elegido)</b>' : '') + (x.recomendado ? ' · más conveniente' : '') + '</td><td>' + esc(x.nit || '') + '</td><td class="a">' + dinero(x.valor) + '</td><td class="a">' + x.plazo + '</td><td class="a">' + x.garantia + '</td><td>' + esc(x.formaPago || '') + '</td><td class="a">' + (x.cumple ? 'Cumple' : 'No cumple') + '</td><td class="a">' + String(x.puntaje).replace('.', ',') + '</td></tr>').join('') + '</table>' +
    UI.seccion('ELECCIÓN', '<p>' + esc(el ? el.nombre + ' — ' + dinero(el.valor) : 'Sin elegir') + '</p><p>' + esc(p.justificacion || '') + '</p>') +
    '<table><tr><td style="height:46px;vertical-align:bottom;width:50%;"><div style="border-top:1px solid #000;padding-top:2px;">Elaboró: ' + esc((f.elaboro || {}).nombre || '') + (f.elaboro && f.elaboro.cargo ? ' · ' + esc(f.elaboro.cargo) : '') + '</div></td>' +
    '<td class="u-abajo"><div style="border-top:1px solid #000;padding-top:2px;">Aprobó: ' + esc((f.aprobo || {}).nombre || '') + (f.aprobo && f.aprobo.cargo ? ' · ' + esc(f.aprobo.cargo) : '') + '</div></td></tr></table>'], true);
}

/* Etapa 3: datos del elegido */
function etapaSeleccion(c){
  const p = PR.d, el = elegidaDe(p), s = p.seleccion = p.seleccion || {};
  if (!el) { c.innerHTML = '<div class="aviso amar">Primero elige el proveedor en el cuadro comparativo (etapa 2).</div>'; return; }
  if (!s.contacto && el.contacto) s.contacto = el.contacto; if (!s.correo && el.correo) s.correo = el.correo; if (!s.telefono && el.telefono) s.telefono = el.telefono;
  const base = P.validarNit(el.nit).base, ya = base && prov().find((x)=> String(x.resumen.nit || '').replace(/\D/g, '').slice(0, base.length) === base);
  s.proveedorExistente = ya ? ya.id : '';
  c.innerHTML = '<div class="card"><h2>' + esc(el.nombre) + '</h2><div class="dato"><span>NIT</span><b>' + esc(P.validarNit(el.nit).texto || el.nit || '') + '</b></div><div class="dato"><span>Valor</span><b>' + dinero(el.valor) + '</b></div>' +
      '<div class="dato"><span>Entrega</span><b>' + esc(el.plazo) + ' días</b></div><div class="dato"><span>Garantía</span><b>' + esc(el.garantia) + ' meses</b></div>' +
      (ya ? '<div class="aviso info">Ya está en la matriz como «' + esc(ya.resumen.nombre) + '»: al dar de alta se le agrega esta evaluación (no se duplica).</div>' : '') + '</div>' +
    '<div class="card"><h2>Datos para la matriz</h2>' +
    '<div class="field"><label>Persona *</label><select data-pk="seleccion.tipoPersona" data-sin-otro><option value="">—</option><option>Jurídica</option><option>Natural</option></select></div>' +
    '<div class="grid2"><div class="field"><label>Contacto *</label><input type="text" data-pk="seleccion.contacto" maxlength="80"></div><div class="field"><label>Ciudad</label><input type="text" data-pk="seleccion.ciudad" maxlength="60"></div></div>' +
    '<div class="grid2"><div class="field"><label>Correo *</label><input type="email" data-pk="seleccion.correo" maxlength="120"></div><div class="field"><label>Teléfono *</label><input type="tel" data-pk="seleccion.telefono" maxlength="20"></div></div></div>';
}

/* Etapa 4: requisitos y documentos de la matriz */
function etapaDocumentos(c, cerrado){
  const p = PR.d, cod = p.categoria === 'OTRO' ? p.categoriaBase : p.categoria, reqs = P.requisitos(cod);
  if (!reqs.length) { c.innerHTML = '<div class="aviso amar">Esta categoría no tiene requisitos en la matriz.</div>'; return; }
  const resumen = ()=> { const t = P.revisarDocs(reqs, p.marcas, [1, 2]); const b = $('dRes'); if (b) b.innerHTML = '<div class="aviso ' + (t.estado === 'CUMPLE' ? 'ok' : t.estado === 'NO CUMPLE' ? '' : 'amar') + '">★ Para contratar: ' + esc(t.estado) + ' · cumplimiento documental ' + pctTxt(t.pct) + (t.faltan.length ? '<br>Sin cumplir: ' + esc(t.faltan.join('; ')) : '') + '</div>'; refrescarFalta(); };
  c.innerHTML = '<div class="card"><h2>Documentos que debe entregar</h2><p class="ayuda">★ = excluyente: si falta, no se contrata. Marca lo que ya entregó. Los de la etapa 3 se piden antes de iniciar el servicio.</p>' +
    '<div class="acciones-top"><button type="button" class="btn ghost" id="dCorreo" data-pdf>Copiar correo para pedir los documentos</button></div><div id="dRes"></div><div id="dReqs">' + htmlReqs(reqs, p.marcas, [1, 2, 3], true) + '</div>' +
    (p.nuevo ? '' : '<div id="dAdj"></div>') + '</div>';
  c.querySelectorAll('.req').forEach((r)=> r.setAttribute('data-falta', 'rq:' + r.dataset.rq));
  activarReqs($('dReqs'), p.marcas, resumen); resumen();
  if (!p.nuevo) UI.adjuntos($('dAdj'), { id: p.id, lista: p.adjuntos || [], titulo: 'Documentos recibidos (RUT, cámara de comercio, certificados…)', soloLectura: !!cerrado });
  $('dCorreo').addEventListener('click', async ()=> { const t = P.plantillaCorreo(cod, EMPRESA.nombre || '', ''); try { await navigator.clipboard.writeText(t); UI.toast('✓ Correo copiado: pégalo en tu correo o WhatsApp.'); } catch (e) { UI.modal('<h3>Correo para pedir los documentos</h3><textarea style="width:100%;min-height:260px;">' + esc(t) + '</textarea><button type="button" class="btn ghost" data-cerrar>Cerrar</button>'); } });
}

/* Etapa 5: evaluación inicial del elegido (la misma del formato, ya llena con lo que se sabe) */
function datosProvTemporal(p){
  const el = elegidaDe(p) || {}, cat = P.categoria(p.categoria);
  return { id: p.id, nombre: el.nombre || '', nit: P.validarNit(el.nit).texto || el.nit || '', tipoProveedor: p.tipoProveedor, categoria: p.categoria, categoriaBase: p.categoriaBase || '', categoriaNombre: p.categoria === 'OTRO' ? p.categoriaNombre : (cat ? cat.n : ''),
    nivel: cat ? cat.nivel : p.nivel, critico: cat ? cat.critico : p.critico === true, requisitos: p.marcas || {}, servicio: p.necesidad || '', homologado: false };
}
function etapaEvaluacion(c, cerrado){
  const p = PR.d, el = elegidaDe(p);
  if (!el) { c.innerHTML = '<div class="aviso amar">Primero elige el proveedor (etapa 2).</div>'; return; }
  if (p.evaluacion && !PR.reevaluar) {
    const e = p.evaluacion, col = P.color(e.clasificacion);
    c.innerHTML = '<div class="resultado ' + (col === 'gris' ? '' : col) + '"><div class="grande">' + esc(e.clasificacion) + ' · ' + pctTxt(e.pct) + '</div><div class="m">Evaluación inicial del ' + esc(UI.corta(e.fecha)) + ' · ' + esc(e.excluyentes || '') + '</div>' +
      (P.DECISION[e.clasificacion] ? '<p class="ayuda" style="margin:6px 0 0;">' + esc(P.DECISION[e.clasificacion]) + '</p>' : '') + '</div>' +
      (cerrado ? '' : '<button type="button" class="btn ghost" id="evOtra">Volver a calificar</button>');
    if ($('evOtra')) $('evOtra').addEventListener('click', ()=> { PR.reevaluar = true; pintarProceso(); });
    return;
  }
  const valores = p.cotizaciones.filter((q)=> !P.faltaCot(q).length).map((q)=> q.valor);
  evaluarInicial(datosProvTemporal(p), { cont: c, cabecera: '<div class="aviso info">Evaluación inicial de <b>' + esc(el.nombre) + '</b>. Los datos de la necesidad y de la cotización ya están llenos; el precio sugerido sale del cuadro comparativo.</div>',
    pie: '<div class="barra-guardar"><button type="button" class="btn amber" id="iOk">Guardar la evaluación y seguir →</button>' + (p.evaluacion ? '<button type="button" class="btn ghost" id="evCancel">Cancelar</button>' : '') + '</div>',
    proceso: p.id, valores: { fecha: UI.hoy(), solicitud: p.solicitud, descripcion: p.necesidad, area: p.area, monto: p.monto, valor: el.valor, dias: el.plazo },
    sugPrecio: P.sugerirPrecio(el.valor, valores),
    alGuardar: async (evo, nuevas)=> { PR.d.evaluacion = evo; Object.assign(PR.d.marcas, nuevas || {}); PR.d.decision = PR.d.decision || {}; PR.d.decision.resultado = P.decisionDe(evo.clasificacion);
      const g = await guardarProceso(); if (typeof g === 'string') return g === 'cola' ? true : g; PR.reevaluar = false; PR.n = 6; pintarProceso(); window.scrollTo(0, 0); return true; } });
  if ($('evCancel')) $('evCancel').addEventListener('click', ()=> { PR.reevaluar = false; pintarProceso(); });
}

/* Etapa 6: decisión y alta en la matriz */
function etapaDecision(c, cerrado){
  const p = PR.d, el = elegidaDe(p), e = p.evaluacion, d = p.decision = p.decision || {};
  if (!e) { c.innerHTML = '<div class="aviso amar">Falta la evaluación inicial (etapa 5).</div>'; return; }
  const sug = P.decisionDe(e.clasificacion);
  c.innerHTML = '<div class="card"><h2>Decisión</h2><div class="resultado ' + P.color(e.clasificacion) + '"><div class="grande">' + esc(el ? el.nombre : '') + ': ' + esc(e.clasificacion) + ' · ' + pctTxt(e.pct) + '</div><p class="ayuda" style="margin:6px 0 0;">Decisión sugerida por la evaluación: <b>' + esc(sug) + '</b>.</p></div>' +
    '<div class="field"><label>Decisión *</label><select data-pk="decision.resultado" data-repinta="1" data-sin-otro><option value="">—</option>' + ['Aprobado', 'Condicionado', 'No apto'].map((x)=> '<option>' + x + '</option>').join('') + '</select></div>' +
    (d.resultado === 'Condicionado' ? '<div class="field"><label>Condiciones a cumplir *</label><textarea data-pk="decision.condiciones" maxlength="800" placeholder="Qué debe cumplir y para cuándo"></textarea></div>' : '') +
    (d.resultado && d.resultado !== 'No apto' ? '<div class="grid2"><div class="field"><label>Aprueba (nombre) *</label><input type="text" data-pk="decision.aprobo.nombre" maxlength="80"></div><div class="field"><label>Cargo</label><input type="text" data-pk="decision.aprobo.cargo" maxlength="60" placeholder="Ej.: Gerente"></div></div>' : '') +
    '<div class="field"><label>Observaciones</label><textarea data-pk="decision.observaciones" maxlength="800"></textarea></div>' +
    (cerrado ? '' : d.resultado === 'No apto'
      ? '<div class="aviso">No apto: no se contrata. Puedes volver a la etapa 2 y elegir otro oferente, o cerrar el proceso.</div><div class="acciones-top"><button type="button" class="btn amber" id="dOtro">Elegir otro oferente</button><button type="button" class="btn ghost" id="dCerrar" data-falta="cerrar">Cerrar el proceso sin contratar</button></div>'
      : '<button type="button" class="btn verde" id="dAlta" data-falta="cerrar" style="width:100%;">Dar de alta en la matriz de proveedores ✓</button>') +
    (cerrado && p.proveedorId ? '<button type="button" class="btn amber" id="dVer" data-pdf>Ver el proveedor en la matriz</button>' : '') +
    '<button type="button" class="btn ghost" id="dPdf" data-pdf>Cuadro comparativo (PDF)</button>' +
    (cerrado ? '' : '<button type="button" class="btn ghost u-mal" id="dAnular">Anular este ingreso</button>') + '</div>';
  if ($('dPdf')) $('dPdf').addEventListener('click', ()=> pdfCotizaciones(p));
  if ($('dVer')) $('dVer').addEventListener('click', ()=> verFicha(p.proveedorId));
  if ($('dOtro')) $('dOtro').addEventListener('click', ()=> { const q = elegidaDe(p); if (q) q.estado = 'No apto'; p.elegida = ''; p.justificacion = ''; delete p.evaluacion; p.decision = {}; PR.n = 2; pintarProceso(); window.scrollTo(0, 0); });
  if ($('dCerrar')) $('dCerrar').addEventListener('click', async ()=> { if (!await Dialogo.confirmar('¿Cerrar el ingreso sin contratar a nadie?')) return; p.cerrado = true; const g = await guardarProceso(); if (typeof g === 'string' && g !== 'cola') { $('prMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>'; p.cerrado = false; return; } accionResultado({ id: p.id, nombre: el.nombre, nit: el.nit }, e); show('scrLista'); pintar(); });
  if ($('dAnular')) $('dAnular').addEventListener('click', async ()=> { const m = await Dialogo.pedir('¿Por qué se anula este ingreso?'); if (!m) return; p.anulado = true; p.motivoAnulacion = m; const g = await guardarProceso(); if (typeof g === 'string' && g !== 'cola') { $('prMsg').innerHTML = '<div class="v-resumen">' + esc(g) + '</div>'; p.anulado = false; return; } show('scrLista'); pintar(); });
  if ($('dAlta')) $('dAlta').addEventListener('click', async ()=> {
    const f = P.faltaEtapa(p, 6).filter((x)=> x.campo !== 'cerrar');
    if (f.length) { refrescarFalta(); marcarFaltas(f); return; }
    $('dAlta').disabled = true; const r = await darDeAlta(p); if ($('dAlta')) $('dAlta').disabled = false;
    if (typeof r === 'string') $('prMsg').innerHTML = '<div class="v-resumen">' + esc(r) + '</div>';
  });
}
/* Crea (o actualiza, si el NIT ya estaba) el proveedor en la matriz con la evaluación y los documentos del proceso. */
async function darDeAlta(p){
  const el = elegidaDe(p), s = p.seleccion || {}, cat = P.categoria(p.categoria), nit = P.validarNit(el.nit);
  const ev = Object.assign({}, p.evaluacion, { decision: p.decision.resultado, aprobo: p.decision.aprobo || {}, condiciones: p.decision.condiciones || '', proceso: p.id });
  let d = s.proveedorExistente ? await Registros.abrir(s.proveedorExistente) : null;
  const nuevo = !d;
  d = d || { id: SGSST.nuevoId('PRV'), activo: true, requisitos: {}, evaluaciones: [] };
  const doc = Object.assign({}, d, { nombre: el.nombre, nit: nit.texto || el.nit, tipoPersona: s.tipoPersona, contacto: s.contacto, ciudad: s.ciudad || d.ciudad || '', correo: s.correo, telefono: s.telefono,
    tipoProveedor: p.tipoProveedor, servicio: p.necesidad, categoria: p.categoria, categoriaNombre: p.categoria === 'OTRO' ? p.categoriaNombre : (cat ? cat.n : ''), categoriaBase: p.categoria === 'OTRO' ? p.categoriaBase : '',
    nivel: cat ? cat.nivel : p.nivel, critico: cat ? cat.critico : p.critico === true, activo: true,
    requisitos: Object.assign({}, d.requisitos || {}, p.marcas || {}), evaluaciones: (d.evaluaciones || []).concat([ev]),
    observaciones: [d.observaciones, p.decision.resultado === 'Condicionado' ? 'Condiciones de ingreso: ' + p.decision.condiciones : ''].filter(Boolean).join('\n'), procesoIngreso: p.id });
  recalcular(doc);
  const r = await Registros.guardar('proveedor', doc.id, doc, nuevo ? 0 : d.version);
  if (typeof r === 'string') return r;
  p.cerrado = true; p.proveedorId = doc.id;
  const g = await guardarProceso(); if (typeof g === 'string' && g !== 'cola') return g;
  UI.toast('✓ ' + el.nombre + ' quedó en la matriz: ' + p.decision.resultado + '.');
  await cargar(); verFicha(doc.id);
  accionResultado(doc, ev);
  return true;
}

$('tabs').addEventListener('click', (e)=>{ const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach((x)=> x.classList.toggle('on', x === b)); pintar(); });
document.addEventListener('click', (e)=>{
  const v = e.target.closest('[data-volver]'); if (v) { e.preventDefault(); show('scrLista'); pintar(); return; }
  const f = e.target.closest('[data-ficha]'); if (f) { e.preventDefault(); verFicha(f.dataset.ficha); }
});
window.addEventListener('outbox-enviado', ()=> cargar());
cargar();
