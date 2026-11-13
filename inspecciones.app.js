/* inspecciones.app.js — código de inspecciones.html (v162: fuera del HTML para que el celular lo guarde en caché). */
OfflineBanner.init();
OutboxBadge.init();
if (typeof Outbox !== 'undefined') Outbox.flush();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();

const $ = UI.$;
let PL = {}, LISTA = [];
let equipos = [], inspecciones = [], propias = [], progs = [], tab = 'pendientes', eqActual = null, insp = null, fotosInsp = null, fotosNC = {};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
let anioCron = Number(UI.hoy().slice(0, 4));
let fCat = '';   // v160: filtro del inventario por elemento (extintor, botiquín, arnés…)
let ultimosFiltrados = [];
const equiposFiltrados = ()=> ultimosFiltrados.map((x)=> x.e);
/** El «elemento» de un equipo: su descripción sin el código ni números de serie (p. ej. «Extintor PQS 20 lb»). */
const elementoDe = (e)=> String(e.resumen.nombre || '').replace(/\s+/g, ' ').trim();
const pasaFiltroEq = (e)=> !fCat || (fCat.startsWith('el:') ? UI.norm(elementoDe(e)) === fCat.slice(3) : (e.resumen.categoria || '') === fCat);
let fHist = '';   // v109: filtro del historial (lo dejan las cifras «este mes» y «no conformes»)
window.filtrarKpi = (v)=> { fHist = v || ''; pintar(); };

function show(id){ document.querySelectorAll('.screen').forEach((s)=>s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
/** Listas de chequeo: las del código más las de la empresa (ajustadas y propias). */
function armarListas(){
  // v125: con el nombre y el código que les puso la empresa (Menús de la consola).
  LISTA = plantillasInspeccion(propias).map((p)=> typeof Empresa !== 'undefined' && Empresa.bautizar ? Empresa.bautizar('inspecciones', p) : p); PL = {};
  LISTA.forEach((p)=> { PL[p.id] = p; });
  pintarCategorias();
}
// v124: además de las que apaga SST aquí, las que el administrador apagó para la empresa.
const activas = ()=> LISTA.filter((p)=> p.activa !== false && (typeof Empresa === 'undefined' || !Empresa.visible || Empresa.visible('inspecciones', p.id)));
function pintarCategorias(incluir){
  const l = activas().slice(); if (incluir && PL[incluir] && !l.includes(PL[incluir])) l.push(PL[incluir]);
  $('eqCat').innerHTML = l.map((p)=> '<option value="' + esc(p.id) + '">' + p.icono + ' ' + esc(p.nombre) + '</option>').join('') + '<option value="__nueva">➕ Otra categoría (crearla)…</option>';
}
const pl = (id)=> PL[id] || { id, nombre: id || 'Lista', icono: '📋', items: [], vencimientos: [], frecuencia: 'mensual' };
armarListas();
$('inTipo').innerHTML = TIPOS_INSPECCION.map((t)=> '<option>' + t + '</option>').join('');
$('eqFrec').innerHTML = Object.keys(FRECUENCIAS).map((k)=> '<option value="' + k + '">' + FRECUENCIAS[k].nombre + '</option>').join('');

function proxima(eq){
  const s = eq.resumen || eq, f = FRECUENCIAS[s.frecuencia] || FRECUENCIAS.mensual;
  if (!s.ultimaInspeccion) return UI.hoy();          // nunca inspeccionado: ya toca
  return f.dias ? Festivos.sumarDias(s.ultimaInspeccion, f.dias) : Festivos.sumarMeses(s.ultimaInspeccion, f.meses);
}
function estadoEq(eq){
  const s = eq.resumen;
  if (s.activo === false) return { c:'gris', t:'De baja', motivos:[] };
  const motivos = [], h = UI.hoy(), vale = pl(s.categoria).vencimientos || [];
  // Solo las fechas que pide la lista vigente (si una lista ajustada quitó una, deja de contar).
  Object.keys(s.vencimientos || {}).filter((k)=> !PL[s.categoria] || vale.includes(k)).forEach((k)=>{ const v = s.vencimientos[k]; if (!v) return; if (v < h) motivos.push(k + ' vencida (' + UI.corta(v) + ')'); else if (v <= Festivos.sumarDias(h, 30)) motivos.push(k + ' vence ' + UI.corta(v)); });
  const p = proxima(eq);
  if (s.ultimoResultado === 'NO CONFORME') motivos.unshift('Última inspección: NO CONFORME');
  // v156: mantenimiento preventivo / correctivo
  if (s.mantTipo && s.mantTipo !== 'No aplica' && s.mantProximo) { if (s.mantProximo < h) motivos.push('Mantenimiento vencido (' + UI.corta(s.mantProximo) + ')'); else if (s.mantProximo <= Festivos.sumarDias(h, 30)) motivos.push('Mantenimiento ' + UI.corta(s.mantProximo)); }
  const vencido = motivos.some((m)=> /vencid|NO CONFORME/.test(m));
  return { c: vencido ? 'mal' : (p <= h || motivos.length ? 'pronto' : 'ok'), t: vencido ? 'Atención' : p <= h ? 'Toca inspección' : motivos.length ? 'Por vencer' : 'Al día', motivos, proxima: p };
}

async function cargar(){
  if (UI.avisoServidor($('avisoSrv'))) { $('lista').innerHTML = ''; ['btnInspeccionar', 'btnNuevoEq'].forEach((id)=> $(id).disabled = true); return; }
  const r = await SGSST.listar('equipo,inspeccion,plantillainsp,proginsp');
  UI.avisoCopia($('avisoCopia'), r);
  equipos = r.rows.filter((x)=> x.tipo === 'equipo');
  inspecciones = r.rows.filter((x)=> x.tipo === 'inspeccion');
  propias = r.rows.filter((x)=> x.tipo === 'plantillainsp');
  progs = r.rows.filter((x)=> x.tipo === 'proginsp');
  armarListas();
  pintar();
}
// v127: quitar varios equipos o herramientas del inventario a la vez.
UI.seleccionVarios({ lista: $('lista'), barra: $('selBarra'), atributo: 'eq', que: 'este equipo', alTerminar: ()=> cargar() });
function pintar(){
  const q = UI.norm($('buscar').value).trim();
  const act = equipos.filter((e)=> e.resumen.activo !== false);
  const pend = act.filter((e)=> estadoEq(e).c !== 'ok');
  const mes = UI.hoy().slice(0, 7);
  const delMes = inspecciones.filter((i)=> String(i.resumen.fecha).slice(0, 7) === mes);
  $('nPend').textContent = pend.length; $('nEq').textContent = equipos.length; $('nHist').textContent = inspecciones.length; $('nListas').textContent = activas().length;
  const cron = cronograma(Number(UI.hoy().slice(0, 4)));
  const ncMes = delMes.filter((i)=> i.resumen.resultado === 'NO CONFORME'), ncTodas = inspecciones.filter((i)=> i.resumen.resultado === 'NO CONFORME');
  $('kpis').innerHTML = '<div class="kpi" data-ir="tab:equipos"><div class="v">' + act.length + '</div><div class="n">equipos y áreas en uso</div></div>' +
    '<div class="kpi ' + (pend.length ? 'mal' : 'ok') + '" data-ir="tab:pendientes"><div class="v">' + pend.length + '</div><div class="n">por inspeccionar o con algo vencido</div></div>' +
    '<div class="kpi" data-ir="tab:historial|filtro:mes"><div class="v">' + delMes.length + '</div><div class="n">inspecciones este mes</div></div>' +
    '<div class="kpi ' + (ncMes.length ? 'mal' : '') + '" data-ir="tab:historial|filtro:' + (ncMes.length ? 'ncmes' : 'mes') + '"><div class="v">' + delMes.filter((i)=> i.resumen.resultado === 'NO CONFORME').length + '</div><div class="n">no conformes este mes</div></div>' +
    '<div class="kpi ' + (cron.pct == null ? '' : cron.pct >= 90 ? 'ok' : cron.pct >= 70 ? '' : 'mal') + '" data-ir="tab:cronograma"><div class="v">' + (cron.pct == null ? '—' : cron.pct + '%') + '</div><div class="n">cumplimiento del cronograma ' + UI.hoy().slice(0, 4) + '</div><div class="f">' + cron.ok + ' de ' + cron.due + ' programadas a la fecha</div></div>';
  $('buscar').hidden = tab === 'cronograma' || tab === 'listas';
  $('selBarra').hidden = !(tab === 'equipos' || tab === 'pendientes');
  const vehMes = delMes.filter((i)=> i.resumen.plantilla === 'vehiculo');
  $('fIns').innerHTML = tab === 'historial' && inspecciones.length ? UI.chipsFiltro([['', 'Todas (' + inspecciones.length + ')'], ['mes', 'Este mes (' + delMes.length + ')'], ['ncmes', 'No conformes este mes (' + ncMes.length + ')'], ['nc', 'Todas las no conformes (' + ncTodas.length + ')']]
    .concat(vehMes.length || fHist === 'vehmes' ? [['vehmes', 'Vehículos este mes (' + vehMes.length + ')']] : []), fHist) : '';
  if (tab === 'equipos' || tab === 'pendientes') {
    // v161: filtro por elemento siempre visible: por categoría y por elemento (la descripción: «Arnés», «Extintor PQS 20 lb»…)
    const base = tab === 'pendientes' ? pend : equipos, cuenta = {}, elem = {};
    base.forEach((e)=> { const k = e.resumen.categoria || ''; cuenta[k] = (cuenta[k] || 0) + 1; const n = elementoDe(e); if (n) { const kk = UI.norm(n); elem[kk] = elem[kk] || { n, c: 0 }; elem[kk].c++; } });
    const cats = Object.keys(cuenta).sort((a, b)=> String((PL[a] || {}).nombre || a).localeCompare(String((PL[b] || {}).nombre || b)));
    const els = Object.keys(elem).sort((a, b)=> elem[a].n.localeCompare(elem[b].n));
    if (fCat && !(fCat.startsWith('el:') ? elem[fCat.slice(3)] : cuenta[fCat])) fCat = '';
    $('fIns').innerHTML = base.length ? '<div class="field u-mtn4"><label for="fCatSel">Filtrar por elemento</label><select id="fCatSel"><option value="">Todos (' + base.length + ')</option>' +
      '<optgroup label="Por categoría">' + cats.map((k)=> '<option value="' + esc(k) + '"' + (k === fCat ? ' selected' : '') + '>' + esc(((PL[k] || {}).icono || '') + ' ' + ((PL[k] || {}).nombre || k || 'Sin categoría')) + ' (' + cuenta[k] + ')</option>').join('') + '</optgroup>' +
      (els.length ? '<optgroup label="Por elemento">' + els.map((k)=> '<option value="el:' + esc(k) + '"' + ('el:' + k === fCat ? ' selected' : '') + '>' + esc(elem[k].n) + ' (' + elem[k].c + ')</option>').join('') + '</optgroup>' : '') + '</select></div>' : '';
    if ($('fCatSel')) $('fCatSel').addEventListener('change', ()=> { fCat = $('fCatSel').value; pintar(); });
    const nF = fCat ? base.filter(pasaFiltroEq).length : base.length, nomF = !fCat ? '' : fCat.startsWith('el:') ? elem[fCat.slice(3)].n : ((PL[fCat] || {}).nombre || fCat);
    if (tab === 'equipos' && base.length) $('fIns').insertAdjacentHTML('beforeend', '<button type="button" class="btn ghost mini" id="btnHvTodos">📄 Hojas de vida en PDF: ' + (fCat ? esc(nomF) + ' (' + nF + ')' : 'todo el inventario (' + base.length + ')') + '</button>');
    if ($('btnHvTodos')) $('btnHvTodos').addEventListener('click', ()=> window.hojasDeVidaFiltradas());
  }
  $('fIns').querySelectorAll('[data-f]').forEach((b)=> b.addEventListener('click', ()=> window.filtrarKpi(b.dataset.f)));
  if (tab === 'cronograma') { pintarCronograma(); return; }
  if (tab === 'listas') { pintarListas(); return; }
  const coincide = (txt)=> !q || UI.norm(txt).includes(q);
  if (tab === 'historial') {
    const fh = { vehmes: (i)=> vehMes.includes(i), mes: (i)=> delMes.includes(i), ncmes: (i)=> ncMes.includes(i), nc: (i)=> ncTodas.includes(i) }[fHist] || (()=> true);
    const l = inspecciones.filter(fh).filter((i)=> coincide([i.resumen.equipo, i.resumen.categoria, i.resumen.inspector, i.resumen.lugar].join(' '))).sort((a, b)=> String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
    $('lista').innerHTML = l.length ? l.map((i)=>{ const s = i.resumen, c = s.resultado === 'NO CONFORME' ? 'mal' : 'ok';
      return '<button type="button" class="item ' + c + '" data-insp="' + esc(i.id) + '"><div class="fila"><div><div class="t">' + esc(pl(s.plantilla).icono) + ' ' + esc(s.equipo || s.categoria) + '</div>' +
        '<div class="m">' + esc(UI.corta(s.fecha)) + ' · ' + esc(s.inspector || '') + (s.tipoInspeccion && s.tipoInspeccion !== 'Rutinaria' ? ' · ' + esc(s.tipoInspeccion) + (s.participantes ? ' (' + s.participantes + ' participantes)' : '') : '') + (s.nc ? ' · ' + s.nc + ' no conforme(s): ' + esc(s.noConformes.join('; ')) : '') + (i.pendiente ? ' · <span class="pend">⏳ pendiente</span>' : '') + '</div></div>' +
        '<span class="chip ' + c + '">' + esc(s.resultado === 'NO CONFORME' ? 'No conforme' : 'Conforme') + '</span></div></button>'; }).join('') : '<div class="empty">' + (inspecciones.length ? 'Ninguna inspección en este filtro ✓' : 'Todavía no hay inspecciones.') + '</div>';
    return;
  }
  let l = (tab === 'pendientes' ? pend : equipos).filter(pasaFiltroEq).filter((e)=> coincide([e.resumen.codigo, e.resumen.nombre, e.resumen.ubicacion, (PL[e.resumen.categoria] || {}).nombre].join(' ')));
  l = l.map((e)=> ({ e, s: estadoEq(e) }));
  ultimosFiltrados = l;
  l = l.sort((a, b)=> ({ mal:0, pronto:1, ok:2, gris:3 }[a.s.c] - { mal:0, pronto:1, ok:2, gris:3 }[b.s.c]) || String(a.s.proxima).localeCompare(String(b.s.proxima)));
  $('lista').innerHTML = l.length ? l.map(({ e, s })=>{ const r = e.resumen, p = PL[r.categoria] || {};
    return '<button type="button" class="item ' + s.c + '" data-eq="' + esc(e.id) + '"><div class="fila"><div><div class="t">' + (p.icono || '') + ' ' + esc((r.codigo ? r.codigo + ' · ' : '') + (r.nombre || p.nombre || '')) + '</div>' +
      '<div class="m">' + esc(r.ubicacion || '') + (r.ultimaInspeccion ? ' · última ' + esc(UI.corta(r.ultimaInspeccion)) : ' · sin inspecciones') + ' · próxima ' + esc(UI.corta(s.proxima)) + (e.pendiente ? ' · <span class="pend">⏳ pendiente</span>' : '') + '</div>' +
      '<div class="m eq-cat">' + esc(p.nombre || r.categoria || 'Sin categoría') + (r.subtipo ? ' · tipo ' + esc(r.subtipo) : '') + (r.area ? ' · ' + esc(r.area) : '') + (r.mantTipo && r.mantTipo !== 'No aplica' ? ' · mant. ' + esc(r.mantTipo.toLowerCase()) + (r.mantProximo ? ' ' + esc(UI.corta(r.mantProximo)) : '') : '') + '</div>' +
      (s.motivos.length ? '<div class="m" style="color:' + (s.c === 'mal' ? 'var(--mal)' : '#7a5800') + ';font-weight:600;">' + esc(s.motivos.join(' · ')) + '</div>' : '') +
      '</div><span class="chip ' + s.c + '">' + esc(s.t) + '</span></div></button>'; }).join('')
    : '<div class="empty">' + (tab === 'pendientes' ? (equipos.length ? 'Todo al día. 👍' : 'Agrega al inventario los extintores, botiquines, arneses, herramientas, vehículos y áreas que se inspeccionan.') : 'El inventario está vacío.') + '</div>';
}

/* ── Inventario ── */
function abrirEquipo(id){
  const e = equipos.find((x)=> x.id === id);
  eqActual = e ? Object.assign({ id }, e.resumen) : null;
  const r = eqActual || { categoria: 'extintor', frecuencia: PL.extintor.frecuencia, vencimientos:{}, activo: true };
  pintarCategorias(r.categoria);
  $('eqTitulo').textContent = eqActual ? ((r.codigo ? r.codigo + ' · ' : '') + (r.nombre || pl(r.categoria).nombre)) : 'Agregar al inventario';
  $('eqSub').textContent = eqActual ? (PL[r.categoria] || {}).nombre + ' · ' + estadoEq(e).t : 'Equipo o área que se inspecciona periódicamente';
  $('eqFicha').hidden = !eqActual; if (eqActual) $('eqFicha').href = 'equipo.html?id=' + encodeURIComponent(id);
  $('eqCat').value = r.categoria; $('eqCat').disabled = !!eqActual;
  $('eqCodigo').value = r.codigo || ''; $('eqNombre').value = r.nombre || ''; $('eqUbic').value = r.ubicacion || ''; $('eqArea').value = r.area || ''; $('eqMant').value = r.mantTipo || 'No aplica'; $('eqMantU').value = r.mantUltimo || ''; $('eqMantP').value = r.mantProximo || ''; verMant(); $('eqFrec').value = r.frecuencia || 'mensual';
  $('eqActivo').value = r.activo === false ? '0' : '1';
  $('eqMarca').value = r.marca || ''; $('eqModelo').value = r.modelo || ''; $('eqSerie').value = r.serie || ''; $('eqCompra').value = r.fechaCompra || ''; $('eqProv').value = r.proveedor || ''; $('eqCarac').value = r.caracteristicas || '';
  $('eqHvDet').open = !!(r.marca || r.modelo || r.serie);
  $('btnHvEq').hidden = !eqActual; $('cardMantEq').hidden = !eqActual; pintarMantHist(); $('mantNuevoDet').open = false; $('mnFecha').value = UI.hoy(); ['mnDesc', 'mnQuien', 'mnCosto', 'mnProx'].forEach((k)=> { $(k).value = ''; }); $('msgMant').textContent = '';
  pintarVenc(r.vencimientos || {}, r.hechas || {}, r.subtipo || '');
  contEq = null; pintarCont();
  $('btnInspEq').hidden = !eqActual; $('btnQrEq').hidden = !eqActual; $('msgEq').textContent = '';
  // v127: quitar del inventario lo que se agregó mal (sus inspecciones viejas se conservan).
  const viejo = document.getElementById('btnElimEq'); if (viejo) viejo.remove();
  if (eqActual) { const be = UI.botonEliminar(id, 'este equipo del inventario', ()=> { show('scrLista'); cargar(); }); be.id = 'btnElimEq'; $('msgEq').insertAdjacentElement('beforebegin', be); }
  const hist = eqActual ? inspecciones.filter((i)=> i.resumen.equipoId === id).sort((a, b)=> String(b.resumen.fecha).localeCompare(String(a.resumen.fecha))) : [];
  $('cardHistEq').hidden = !hist.length;
  if (eqActual) UI.adjuntos($('eqAdj'), { id, refs: { ficha: 'Ficha técnica', certificado: 'Certificado / calibración', manual: 'Manual', hojavida: 'Hoja de vida', otro: 'Otro documento' }, titulo: 'Documentos del equipo' });
  else $('eqAdj').innerHTML = '<p class="ayuda">Después de guardar el equipo puedes subir su ficha técnica, certificados y manual (salen en el paquete para el cliente).</p>';
  $('histEq').innerHTML = hist.map((i)=> '<button type="button" class="item ' + (i.resumen.resultado === 'NO CONFORME' ? 'mal' : 'ok') + '" data-insp="' + esc(i.id) + '"><div class="t">' + esc(UI.corta(i.resumen.fecha)) + ' · ' + esc(i.resumen.resultado) + '</div><div class="m">' + esc(i.resumen.inspector || '') + '</div></button>').join('');
  show('scrEquipo');
}
function pintarVenc(v, hechas, subtipo){
  const p0 = PL[$('eqCat').value] || {}, o = PLANTILLAS_INSPECCION.find((x)=> x.id === p0.id) || {};
  // Una lista ajustada por la empresa conserva el tipo y las fechas de la original.
  const p = Object.assign({}, p0, { tipos: p0.tipos || o.tipos, tiposNombre: p0.tiposNombre || o.tiposNombre }), F = p0.fechas || o.fechas || {}; hechas = hechas || {};
  // v154: el tipo (p. ej. botiquín A/B/C de la Res. 0705) y, para fechas como la recarga, cuándo se hizo y cuándo vence.
  $('eqVenc').innerHTML = (p.tipos ? '<div class="field"><label for="eqTipo">' + esc(p.tiposNombre || 'Tipo') + '</label><select id="eqTipo">' + p.tipos.map((t)=> '<option' + (t === (subtipo || p.tipos[0]) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
      (p.id === 'botiquin' ? '<div class="ayuda">Tipo A: hasta 2.000 m² · Tipo B: de 2.000 a 15.000 m² · más de 15.000 m²: dos tipo B o uno tipo C. En la inspección se cuenta cada elemento contra el mínimo de su tipo.</div>' : '') + '</div>' : '') +
    ((p.vencimientos || []).length ? '<div class="grid2">' + p.vencimientos.map((k)=> (F[k] ? '<div class="field"><label>' + esc(F[k].hecha || k) + '</label><input type="date" data-hecha="' + esc(k) + '" data-meses="' + (F[k].meses || 12) + '" value="' + esc(hechas[k] || '') + '"></div>' : '') +
      '<div class="field"><label>' + esc(k) + ' (vence)</label><input type="date" data-venc="' + esc(k) + '" value="' + esc(v[k] || '') + '"><div class="ayuda" data-av></div></div>').join('') + '</div>' : '');
  $('eqVenc').querySelectorAll('[data-venc]').forEach(avisoVence);
}
/** Debajo de cada fecha de vencimiento: si ya venció o vence en 30 días (avisa, no bloquea). */
function avisoVence(i){
  const a = i.parentNode.querySelector('[data-av]'), v = i.value, h = UI.hoy(); if (!a) return;
  // v152: días calendario reales (antes se sumaban días hábiles y el aviso salía con más de un mes de anticipación).
  const dias = v ? Math.round((new Date(v + 'T12:00:00') - new Date(h + 'T12:00:00')) / 86400000) : 0;
  a.textContent = !v ? '' : dias < 0 ? 'Ya venció: el equipo queda en «Atención».' : dias === 0 ? 'Vence hoy.' : dias <= 30 ? 'Vence en ' + dias + (dias === 1 ? ' día.' : ' días.') : '';
  a.style.color = v && v < h ? 'var(--mal)' : '#7a5800'; a.style.fontWeight = '700';
}
$('eqVenc').addEventListener('change', (e)=> {
  if (e.target.dataset.venc != null) avisoVence(e.target);
  // v154: al poner la fecha en que se recargó, el vencimiento se calcula solo (recarga anual, NTC 2885); se puede corregir.
  if (e.target.dataset.hecha != null && e.target.value) { const v = $('eqVenc').querySelector('[data-venc="' + CSS.escape(e.target.dataset.hecha) + '"]'); if (v) { v.value = Festivos.sumarDias(Festivos.sumarMeses(e.target.value, +e.target.dataset.meses || 12), -1); avisoVence(v); } }
});
$('eqCat').addEventListener('change', ()=>{
  // v154: una categoría que no está en la lista se crea aquí mismo (con preguntas generales que se pueden ajustar).
  if ($('eqCat').value === '__nueva') { $('eqCat').value = $('eqCat').dataset.ant || (activas()[0] || {}).id || ''; nuevaCategoria(); return; }
  $('eqCat').dataset.ant = $('eqCat').value;
  const p = pl($('eqCat').value); $('eqFrec').value = p.frecuencia; pintarVenc({}); contEq = null; pintarCont(); });
/* v156 · Contenido del botiquín: arranca con el de su tipo (Res. 0705) y se puede ajustar: agregar o quitar
   elementos y cambiar la cantidad mínima. La inspección cuenta contra este contenido. */
let contEq = null;
function pintarCont(){
  const p = PL[$('eqCat').value] || {}, box = $('eqCont');
  if ((p.id || $('eqCat').value) !== 'botiquin') { box.innerHTML = ''; contEq = null; return; }
  if (!contEq) contEq = ((eqActual && eqActual.contenido) || elementosBotiquin($('eqTipo') ? $('eqTipo').value : 'A').map((x)=> ({ e: x.t.split(' | ')[1], u: x.unidad, min: x.min }))).map((x)=> Object.assign({}, x));
  box.innerHTML = '<div class="field"><label>Contenido del botiquín y cantidad mínima</label><div class="ayuda">Viene del tipo elegido (Res. 0705 de 2007). Agrega, quita o cambia los mínimos según tu botiquín: la inspección cuenta contra esta lista.</div>' +
    '<div class="cont-l">' + contEq.map((x, i)=> '<div class="cont-f" data-i="' + i + '"><input type="text" class="ce" value="' + esc(x.e) + '" aria-label="Elemento"><input type="text" class="cu" value="' + esc(x.u || '') + '" aria-label="Unidad" placeholder="unidad"><input type="number" class="cm" min="0" value="' + esc(x.min) + '" aria-label="Mínimo"><button type="button" class="btn-mini rojo" data-qc="' + i + '" aria-label="Quitar">✕</button></div>').join('') + '</div>' +
    '<div class="fila-btn"><button type="button" class="btn ghost mini" id="contAdd">+ Elemento</button><button type="button" class="btn ghost mini" id="contTipo">Volver al contenido del tipo</button></div></div>';
}
function leerCont(){ if (!contEq) return null; $('eqCont').querySelectorAll('.cont-f').forEach((f)=> { const x = contEq[+f.dataset.i]; x.e = f.querySelector('.ce').value.trim(); x.u = f.querySelector('.cu').value.trim(); x.min = Math.max(0, Number(f.querySelector('.cm').value) || 0); }); return contEq.filter((x)=> x.e); }
$('eqCont').addEventListener('click', (e)=> {
  if (e.target.closest('#contAdd')) { leerCont(); contEq.push({ e: '', u: 'unidad', min: 1 }); pintarCont(); const l = $('eqCont').querySelectorAll('.ce'); l[l.length - 1].focus(); }
  const q = e.target.closest('[data-qc]'); if (q) { leerCont(); contEq.splice(+q.dataset.qc, 1); pintarCont(); }
  if (e.target.closest('#contTipo')) { contEq = null; const keep = eqActual; eqActual = null; pintarCont(); eqActual = keep; }
});
$('eqVenc').addEventListener('change', (e)=> { if (e.target.id === 'eqTipo' && $('eqCat').value === 'botiquin') { contEq = null; const keep = eqActual; eqActual = null; pintarCont(); eqActual = keep; UI.toast('Contenido cambiado al del tipo ' + e.target.value + '.'); } });
function verMant(){ const no = $('eqMant').value === 'No aplica'; $('eqMantF').hidden = no; const v = $('eqMantP').value, h = UI.hoy();
  $('eqMantAv').textContent = no || !v ? '' : v < h ? 'Vencido: programa el mantenimiento.' : 'Faltan ' + Math.round((new Date(v + 'T12:00:00') - new Date(h + 'T12:00:00')) / 86400000) + ' días.'; }
$('eqMant').addEventListener('change', verMant); $('eqMantP').addEventListener('change', verMant);
function nuevaCategoria(){
  editarLista({ id: SGSST.nuevoId('PLI'), nuevo: true, nombre: '', icono: '📋', frecuencia: 'mensual', vencimientos: [],
    items: ['Estado general | Está en buen estado, sin daños ni corrosión', 'Estado general | Está limpio y ordenado', 'Estado general | Está identificado (código o placa) y señalizado',
      'Partes | Tiene todas sus partes y accesorios', 'Partes | Las protecciones y guardas están en su lugar', 'Funcionamiento | Funciona correctamente',
      'Documentos | Tiene ficha técnica o manual disponible'], activa: true }, (id)=> { $('eqCat').value = id; $('eqCat').dataset.ant = id; const p = pl(id); $('eqFrec').value = p.frecuencia; pintarVenc({}); });
}
$('btnGuardarEq').addEventListener('click', async ()=>{
  const cat = $('eqCat').value, p = PL[cat];
  // Qué falta o está mal: se marca cada campo y se dice debajo del botón.
  const cod = $('eqCodigo').value.trim(), otroIgual = cod && equipos.find((x)=> (!eqActual || x.id !== eqActual.id) && UI.norm(x.resumen.codigo) === UI.norm(cod));
  const reglas = [{ el: $('eqCodigo'), etiqueta: 'Código / serial', error: ()=> !cod && !$('eqNombre').value.trim() ? 'escribe el código o la descripción' : otroIgual ? 'ya lo tiene ' + (otroIgual.resumen.nombre || 'otro equipo') + ' en el inventario' : '' }];
  $('eqVenc').querySelectorAll('[data-venc]').forEach((i)=> reglas.push({ el: i, etiqueta: i.dataset.venc + ' (vence)', error: ()=> i.value ? Valida.fecha(i.value) : '' }));
  $('msgEq').textContent = '';
  if (Valida.revisar($('scrEquipo'), reglas, $('msgEq')).length) return;
  const vencidas = [...$('eqVenc').querySelectorAll('[data-venc]')].filter((i)=> i.value && i.value < UI.hoy()).map((i)=> i.dataset.venc + ' (' + UI.corta(i.value) + ')');
  if (vencidas.length && !await Dialogo.confirmar('Ya está vencida: ' + vencidas.join(', ') + '. El equipo queda en «Atención» hasta renovarla. ¿Guardar así?')) return;
  const venc = {}; $('eqVenc').querySelectorAll('[data-venc]').forEach((i)=> { venc[i.dataset.venc] = i.value; });
  const hechas = {}; $('eqVenc').querySelectorAll('[data-hecha]').forEach((i)=> { hechas[i.dataset.hecha] = i.value; });
  // Fechas que ya no pide la lista: se vacían (el parche mezcla y si no, quedarían para siempre).
  if (eqActual) Object.keys(eqActual.vencimientos || {}).forEach((k)=> { if (!(k in venc)) venc[k] = ''; });
  const campos = { categoria: cat, codigo: $('eqCodigo').value.trim(), nombre: $('eqNombre').value.trim() || p.nombre, ubicacion: $('eqUbic').value.trim(), frecuencia: $('eqFrec').value, contenido: $('eqCat').value === 'botiquin' ? leerCont() : undefined, marca: $('eqMarca').value.trim(), modelo: $('eqModelo').value.trim(), serie: $('eqSerie').value.trim(), fechaCompra: $('eqCompra').value, proveedor: $('eqProv').value.trim(), caracteristicas: $('eqCarac').value.trim(), mantTipo: $('eqMant').value, mantUltimo: $('eqMant').value === 'No aplica' ? '' : $('eqMantU').value, mantProximo: $('eqMant').value === 'No aplica' ? '' : $('eqMantP').value, vencimientos: venc, hechas, subtipo: $('eqTipo') ? $('eqTipo').value : '', area: $('eqArea') ? $('eqArea').value : '', activo: $('eqActivo').value === '1' };
  const id = eqActual ? eqActual.id : SGSST.nuevoId('EQP');
  $('btnGuardarEq').disabled = true; $('msgEq').textContent = 'Guardando…';
  const r = await SGSST.enviar({ action:'parche', tipo:'equipo', id, campos }, { resumen: Object.assign({ ultimaInspeccion: eqActual ? eqActual.ultimaInspeccion : '', ultimoResultado: eqActual ? eqActual.ultimoResultado : '' }, campos) });
  $('btnGuardarEq').disabled = false;
  if (!r.ok) { $('msgEq').textContent = Errores.texto('guardó', r); return; }
  const res = r.resumen || Object.assign({}, eqActual || {}, campos);
  const i = equipos.findIndex((x)=> x.id === id);
  if (i === -1) equipos.push({ id, tipo:'equipo', resumen: res, pendiente: !!r.enCola }); else equipos[i].resumen = res;
  eqActual = Object.assign({ id }, res);
  $('msgEq').textContent = r.enCola ? '⏳ Guardado en el equipo; se envía al volver la señal.' : '✓ Guardado';
  $('btnInspEq').hidden = false; $('btnQrEq').hidden = false; $('btnHvEq').hidden = false; $('cardMantEq').hidden = false; $('eqCat').disabled = true;
  $('eqTitulo').textContent = (res.codigo ? res.codigo + ' · ' : '') + res.nombre;
});
$('btnInspEq').addEventListener('click', ()=> iniciarInspeccion(eqActual.categoria, eqActual));

/* ── v160 · Hoja de vida del equipo: datos técnicos, vencimientos, mantenimientos y reparaciones, e inspecciones ── */
function pintarMantHist(){
  const l = ((eqActual && eqActual.mantHist) || []).slice().sort((a, b)=> String(b.f).localeCompare(String(a.f)));
  $('mantLista').innerHTML = l.length ? '<ul class="hv-mant">' + l.map((m)=> '<li><b>' + esc(UI.corta(m.f)) + ' · ' + esc(m.t) + '</b> ' + esc(m.d || '') + (m.q ? ' <small>(' + esc(m.q) + ')</small>' : '') + (m.c ? ' <small>· $' + esc(m.c) + '</small>' : '') + '</li>').join('') + '</ul>' : '<p class="ayuda">Aún no hay mantenimientos registrados.</p>';
}
$('btnMant').addEventListener('click', async ()=> {
  if (!eqActual) return;
  const m = { f: $('mnFecha').value, t: $('mnTipo').value, d: $('mnDesc').value.trim(), q: $('mnQuien').value.trim(), c: $('mnCosto').value.trim() };
  if (!m.f || !m.d) { $('msgMant').textContent = 'Escribe la fecha y qué se hizo.'; return; }
  if (m.f > UI.hoy()) { $('msgMant').textContent = 'La fecha no puede ser futura.'; return; }
  const hist = ((eqActual.mantHist) || []).concat(m), campos = { mantHist: hist };
  if (/Preventivo|Correctivo|Reparaci/.test(m.t) && (!eqActual.mantUltimo || m.f >= eqActual.mantUltimo)) campos.mantUltimo = m.f;
  if ($('mnProx').value) campos.mantProximo = $('mnProx').value;
  if (m.t === 'Recarga' && eqActual.hechas && 'Recarga' in (eqActual.hechas || {})) campos.hechas = Object.assign({}, eqActual.hechas, { Recarga: m.f });
  $('btnMant').disabled = true; $('msgMant').textContent = 'Guardando…';
  const r = await SGSST.enviar({ action: 'parche', tipo: 'equipo', id: eqActual.id, campos }, { resumen: Object.assign({}, eqActual, campos) });
  $('btnMant').disabled = false;
  if (!r.ok) { $('msgMant').textContent = Errores.texto('guardó', r); return; }
  Object.assign(eqActual, campos); const e = equipos.find((x)=> x.id === eqActual.id); if (e) Object.assign(e.resumen, campos);
  $('eqMantU').value = eqActual.mantUltimo || ''; $('eqMantP').value = eqActual.mantProximo || ''; verMant();
  pintarMantHist(); $('mantNuevoDet').open = false; ['mnDesc', 'mnQuien', 'mnCosto', 'mnProx'].forEach((k)=> { $(k).value = ''; });
  $('msgMant').textContent = r.enCola ? '⏳ Guardado; se envía al volver la señal.' : '✓ Mantenimiento registrado';
});
function hojaDeVida(e){
  const r = e.resumen || e, id = e.id, p = PL[r.categoria] || {}, fila = (k, v)=> v ? '<tr><th>' + esc(k) + '</th><td>' + esc(v) + '</td></tr>' : '';
  const insp = inspecciones.filter((i)=> i.resumen.equipoId === id).sort((a, b)=> String(b.resumen.fecha).localeCompare(String(a.resumen.fecha))).slice(0, 40);
  const mant = (r.mantHist || []).slice().sort((a, b)=> String(b.f).localeCompare(String(a.f)));
  const ven = Object.keys(r.vencimientos || {}).filter((k)=> r.vencimientos[k]);
  return UI.cabecera('SG-HV-EQUIPO', 'HOJA DE VIDA DEL EQUIPO', (r.codigo || '') + ' · corte ' + UI.corta(UI.hoy())) +
    '<table class="hp-sec"><tr><td class="hp-st">1. Identificación</td></tr></table><table>' + fila('Código', r.codigo) + fila('Descripción', r.nombre) + fila('Elemento', (p.nombre || r.categoria) + (r.subtipo ? ' · tipo ' + r.subtipo : '')) + fila('Área', r.area) + fila('Ubicación / responsable', r.ubicacion) + fila('Estado', r.activo === false ? 'De baja' : 'En uso') + '</table>' +
    '<table class="hp-sec"><tr><td class="hp-st">2. Datos técnicos</td></tr></table><table>' + (fila('Marca', r.marca) + fila('Modelo / referencia', r.modelo) + fila('Número de serie', r.serie) + fila('Fecha de compra / ingreso', r.fechaCompra ? UI.corta(r.fechaCompra) : '') + fila('Proveedor / fabricante', r.proveedor) + fila('Características', r.caracteristicas) || '<tr><td>Sin datos técnicos registrados.</td></tr>') + '</table>' +
    '<table class="hp-sec"><tr><td class="hp-st">3. Vencimientos y frecuencias</td></tr></table><table>' + fila('Frecuencia de inspección', r.frecuencia) + ven.map((k)=> fila(k, (r.hechas && r.hechas[k] ? 'hecho ' + UI.corta(r.hechas[k]) + ' · ' : '') + 'vence ' + UI.corta(r.vencimientos[k]))).join('') + (r.mantTipo && r.mantTipo !== 'No aplica' ? fila('Mantenimiento', r.mantTipo + (r.mantUltimo ? ' · último ' + UI.corta(r.mantUltimo) : '') + (r.mantProximo ? ' · siguiente ' + UI.corta(r.mantProximo) : '')) : '') + '</table>' +
    (r.categoria === 'botiquin' && (r.contenido || []).length ? '<table class="hp-sec"><tr><td class="hp-st">Contenido</td></tr></table><table><tr><th>Elemento</th><th>Mínimo</th></tr>' + r.contenido.map((c)=> '<tr><td>' + esc(c.e) + '</td><td>' + esc(c.min + ' ' + (c.u || '')) + '</td></tr>').join('') + '</table>' : '') +
    '<table class="hp-sec"><tr><td class="hp-st">4. Mantenimientos y reparaciones</td></tr></table>' + (mant.length ? '<table><tr><th>Fecha</th><th>Tipo</th><th>Qué se hizo</th><th>Quién</th><th>Costo</th></tr>' + mant.map((m)=> '<tr><td>' + esc(UI.corta(m.f)) + '</td><td>' + esc(m.t) + '</td><td>' + esc(m.d) + '</td><td>' + esc(m.q || '') + '</td><td>' + esc(m.c || '') + '</td></tr>').join('') + '</table>' : '<p>Sin mantenimientos registrados.</p>') +
    '<table class="hp-sec"><tr><td class="hp-st">5. Inspecciones</td></tr></table>' + (insp.length ? '<table><tr><th>Fecha</th><th>Inspector</th><th>Resultado</th><th>No conformidades</th></tr>' + insp.map((i)=> '<tr><td>' + esc(UI.corta(i.resumen.fecha)) + '</td><td>' + esc(i.resumen.inspector || '') + '</td><td>' + esc(i.resumen.resultado === 'NO CONFORME' ? 'No conforme' : 'Conforme') + '</td><td>' + esc((i.resumen.noConformes || []).join('; ')) + '</td></tr>').join('') + '</table>' : '<p>Sin inspecciones registradas.</p>') +
    '<table class="hp-sec"><tr><td style="height:40px;vertical-align:bottom;">Responsable del equipo</td><td style="vertical-align:bottom;">SST</td></tr></table>';
}
$('btnHvEq').addEventListener('click', ()=> { if (!eqActual) return; UI.imprimir([hojaDeVida({ id: eqActual.id, resumen: eqActual })], false); });
window.hojasDeVidaFiltradas = ()=> { const l = equiposFiltrados(); if (!l.length) { UI.toast('No hay equipos en el filtro.'); return; } UI.imprimir(l.map((e)=> hojaDeVida(e)), false); };

/* ── Etiquetas QR (v105): se pegan en el equipo; al escanear se abre su inspección ──
   El enlace lleva el código de la empresa en un sitio multiempresa (?e=), así un celular
   nuevo entra a la empresa correcta y vuelve a este equipo. */
function enlaceEquipo(id){
  const base = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  const cod = typeof MultiEmpresa !== 'undefined' && MultiEmpresa.activo && EMPRESA.codigo ? '?e=' + encodeURIComponent(EMPRESA.codigo) : '';
  return base + 'inspecciones.html' + cod + '#ins=' + encodeURIComponent(id);
}
/* Tamaños de etiqueta en hoja carta (215,9 × 279,4 mm; margen 10 mm → 195 × 259 mm útiles).
   Ancho y alto fijos en mm: la grilla queda centrada y ninguna etiqueta se corta en el borde. */
const TAM_QR = {
  grande:  { n: 'Grande',  col: 2, fil: 3, w: 95, h: 80, qr: 54, cod: 16, nom: 10, ubi: 8.5, pie: true },
  mediana: { n: 'Mediana', col: 3, fil: 4, w: 63, h: 60, qr: 36, cod: 12.5, nom: 8.5, ubi: 7.5, pie: true },
  pequena: { n: 'Pequeña', col: 4, fil: 6, w: 48, h: 40, qr: 24, cod: 10, nom: 7, ubi: 0, pie: false }
};
const porHojaQR = (t)=> TAM_QR[t].col * TAM_QR[t].fil;
function etiquetaHTML(e, tam){
  const r = e.resumen || e, p = pl(r.categoria), T = TAM_QR[tam] || TAM_QR.mediana;
  let img = ''; try { img = QR.comoImagen(enlaceEquipo(e.id), { px: 360, margen: 2 }); } catch (err) { return ''; }
  const linea = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;';
  return '<div class="qr-et" style="width:' + T.w + 'mm;height:' + T.h + 'mm;box-sizing:border-box;border:1px dashed var(--n-450);padding:2mm 2mm 1.5mm;text-align:center;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;break-inside:avoid;page-break-inside:avoid;font-family:Arial,Helvetica,sans-serif;color:#000;">' +
    '<img src="' + UI.src(img) + '" alt="QR ' + esc(r.codigo || '') + '" style="width:' + T.qr + 'mm;height:' + T.qr + 'mm;image-rendering:pixelated;flex:0 0 auto;">' +
    '<div style="font-size:' + T.cod + 'pt;font-weight:700;line-height:1.1;margin-top:1mm;' + linea + '">' + esc(r.codigo || p.nombre) + '</div>' +
    '<div style="font-size:' + T.nom + 'pt;line-height:1.15;' + linea + '">' + esc(r.nombre || p.nombre) + '</div>' +
    (T.ubi && r.ubicacion ? '<div style="font-size:' + T.ubi + 'pt;color:var(--n-650);line-height:1.15;' + linea + '">' + esc(r.ubicacion) + '</div>' : '') +
    (T.pie ? '<div style="font-size:' + (T.ubi - 1) + 'pt;margin-top:.8mm;line-height:1.1;">Escanea con la cámara para inspeccionarlo · ' + esc(EMPRESA.nombreCorto || EMPRESA.nombre || '') + '</div>' : '') + '</div>';
}
/** Hojas carta con las etiquetas: cada hoja lleva su título corto y una grilla de tamaño fijo centrada. */
function hojasEtiquetas(lista, tam, titulo){
  const T = TAM_QR[tam] || TAM_QR.mediana, n = porHojaQR(tam);
  const celdas = lista.map((e)=> etiquetaHTML(e, tam)).filter(Boolean);
  const hojas = [], total = Math.ceil(celdas.length / n);
  for (let i = 0; i < celdas.length; i += n) hojas.push('<div style="font-family:Arial,Helvetica,sans-serif;font-size:8pt;display:flex;justify-content:space-between;gap:6mm;margin:0 auto 2mm;width:' + (T.col * T.w) + 'mm;max-width:100%;"><b>ETIQUETAS QR · ' + esc(titulo || 'INVENTARIO') + '</b><span>' + esc(EMPRESA.nombreCorto || EMPRESA.nombre || '') + ' · hoja ' + (i / n + 1) + ' de ' + total + ' · recórtalas por la línea y pégalas (mejor plastificadas)</span></div>' +
    '<div class="qr-hoja" style="display:grid;grid-template-columns:repeat(' + T.col + ',' + T.w + 'mm);grid-auto-rows:' + T.h + 'mm;justify-content:center;gap:0;margin:0 auto;">' + celdas.slice(i, i + n).join('') + '</div>');
  return hojas;
}
function imprimirEtiquetas(lista, tam, titulo){
  const hojas = hojasEtiquetas(lista, tam || 'mediana', titulo);
  if (!hojas.length) { UI.toast('No hay equipos para las etiquetas.', 'mal'); return false; }
  UI.imprimir(hojas);
  return true;
}
const segTam = (sel)=> '<div class="seg-btn qr-tam" role="group" aria-label="Tamaño de la etiqueta">' + Object.keys(TAM_QR).map((k)=> '<button type="button" data-tam="' + k + '" class="' + (k === sel ? 'on' : '') + '">' + TAM_QR[k].n + '<small>' + porHojaQR(k) + ' por hoja</small><small>QR de ' + TAM_QR[k].qr + ' mm</small></button>').join('') + '</div>';
let tamQR = 'mediana'; try { tamQR = TAM_QR[localStorage.getItem('ssta-qr-tam')] ? localStorage.getItem('ssta-qr-tam') : 'mediana'; } catch (e) {}
const fijarTam = (k)=> { tamQR = k; try { localStorage.setItem('ssta-qr-tam', k); } catch (e) {} };
const ordenEq = (a, b)=> String(pl(a.resumen.categoria).nombre).localeCompare(String(pl(b.resumen.categoria).nombre)) || String(a.resumen.codigo).localeCompare(String(b.resumen.codigo), 'es', { numeric: true });

/* Una etiqueta (desde el equipo): se ve el QR, se elige el tamaño y cuántas copias. */
$('btnQrEq').addEventListener('click', ()=> {
  if (!eqActual) return;
  const url = enlaceEquipo(eqActual.id), m = UI.modal('<h3>Etiqueta QR</h3><p class="ayuda">Pégala en el equipo. Quien la escanee con la cámara del celular abre la inspección de <b>' + esc(eqActual.codigo || eqActual.nombre) + '</b> directamente.</p>' +
    '<div class="u-centro"><canvas id="qrEq" style="width:200px;height:200px;image-rendering:pixelated;"></canvas><div style="font-size:var(--fs-menor);color:var(--muted);word-break:break-all;margin-top:6px;">' + esc(url) + '</div></div>' +
    '<div class="field"><label>Tamaño</label>' + segTam(tamQR) + '</div>' +
    '<div class="field"><label for="qrCopias">Copias</label><input type="number" id="qrCopias" min="1" max="24" value="1" inputmode="numeric"></div>' +
    '<button type="button" class="btn amber" id="qrImp">Imprimir o guardar PDF</button><button type="button" class="btn ghost" data-cerrar>Cerrar</button>');
  try { QR.dibujar(m.el.querySelector('#qrEq'), url, { px: 440, margen: 2 }); } catch (e) { m.el.querySelector('#qrEq').replaceWith(document.createTextNode('El enlace es demasiado largo para un QR.')); }
  m.el.querySelector('.qr-tam').addEventListener('click', (e)=> { const b = e.target.closest('[data-tam]'); if (!b) return; fijarTam(b.dataset.tam); m.el.querySelectorAll('[data-tam]').forEach((x)=> x.classList.toggle('on', x === b)); });
  m.el.querySelector('#qrImp').addEventListener('click', ()=> {
    const c = Math.round(Number(m.el.querySelector('#qrCopias').value));
    if (!(c >= 1 && c <= 24)) { Valida.marcar(m.el.querySelector('#qrCopias'), 'de 1 a 24 copias'); return; }
    m.cerrar(); imprimirEtiquetas(Array.from({ length: c }, ()=> ({ id: eqActual.id, resumen: eqActual })), tamQR, eqActual.codigo || eqActual.nombre);
  });
});

/* Varias etiquetas: todas, por tipo de equipo (con conteo) o eligiendo con casillas. */
function abrirEtiquetas(preElegidos){
  const act = equipos.filter((x)=> x.resumen.activo !== false).sort(ordenEq);
  if (!act.length) { UI.toast('El inventario está vacío.', 'mal'); return; }
  const cats = []; act.forEach((e)=> { const c = e.resumen.categoria; let k = cats.find((x)=> x.id === c); if (!k) { k = { id: c, p: pl(c), n: 0 }; cats.push(k); } k.n++; });
  let modo = preElegidos ? 'elegir' : 'todos';
  const elegidos = new Set(preElegidos || []), tipos = new Set();
  const m = UI.modal('<h3>Etiquetas QR del inventario</h3><p class="ayuda">Cada etiqueta abre la inspección de su equipo al escanearla. Salen centradas en hoja carta, con línea para recortar.</p>' +
    '<div class="field"><label>¿Cuáles?</label><div class="seg-btn qr-modo" role="group">' +
      '<button type="button" data-modo="todos">Todos <small>' + act.length + '</small></button><button type="button" data-modo="tipo">Por tipo</button><button type="button" data-modo="elegir">Elegir uno o varios</button></div></div>' +
    '<div data-p="tipo" hidden><div class="qr-cats">' + cats.map((c)=> '<label class="qr-op"><input type="checkbox" data-tipo="' + esc(c.id) + '"><span>' + c.p.icono + ' ' + esc(c.p.nombre) + '</span><b>' + c.n + '</b></label>').join('') + '</div></div>' +
    '<div data-p="elegir" hidden><input type="search" class="buscar u-mb6" id="qrBus" placeholder="Buscar por código, nombre o ubicación">' +
      '<div class="qr-acc"><button type="button" class="btn mini ghost" data-marcar="1">Marcar los que se ven</button><button type="button" class="btn mini ghost" data-marcar="0">Quitar todos</button></div>' +
      '<div class="qr-lista" id="qrLista">' + cats.map((c)=> '<div class="qr-grupo" data-g="' + esc(c.id) + '">' + c.p.icono + ' ' + esc(c.p.nombre) + ' (' + c.n + ')</div>' +
        act.filter((e)=> e.resumen.categoria === c.id).map((e)=> '<label class="qr-op" data-txt="' + esc(UI.norm([e.resumen.codigo, e.resumen.nombre, e.resumen.ubicacion, c.p.nombre].join(' '))) + '"><input type="checkbox" data-eqq="' + esc(e.id) + '"' + (elegidos.has(e.id) ? ' checked' : '') + '><span><b>' + esc(e.resumen.codigo || '—') + '</b> · ' + esc(e.resumen.nombre || c.p.nombre) + (e.resumen.ubicacion ? '<small>' + esc(e.resumen.ubicacion) + '</small>' : '') + '</span></label>').join('')).join('') + '</div></div>' +
    '<div class="field"><label>Tamaño de la etiqueta</label>' + segTam(tamQR) + '</div>' +
    '<div id="qrRes" class="aviso info u-mb10"></div><div id="qrMsg"></div>' +
    '<button type="button" class="btn amber" id="qrImp">Imprimir o guardar PDF</button><button type="button" class="btn ghost" data-cerrar>Cerrar</button>', true);
  const $m = (s)=> m.el.querySelector(s);
  const lista = ()=> modo === 'todos' ? act : modo === 'tipo' ? act.filter((e)=> tipos.has(e.resumen.categoria)) : act.filter((e)=> elegidos.has(e.id));
  const resumen = ()=> { const n = lista().length, h = Math.ceil(n / porHojaQR(tamQR));
    $m('#qrRes').innerHTML = n ? 'Se imprimen <b>' + n + '</b> etiqueta(s) ' + TAM_QR[tamQR].n.toLowerCase() + '(s) en <b>' + h + '</b> hoja(s) carta (' + porHojaQR(tamQR) + ' por hoja).' : (modo === 'tipo' ? 'Marca uno o varios tipos de equipo.' : 'Marca los equipos que quieres imprimir.');
    $m('#qrRes').className = 'aviso ' + (n ? 'info' : 'amar'); if (n) $m('#qrMsg').innerHTML = ''; };
  const verModo = (k)=> { modo = k; m.el.querySelectorAll('[data-modo]').forEach((b)=> b.classList.toggle('on', b.dataset.modo === k)); m.el.querySelectorAll('[data-p]').forEach((d)=> { d.hidden = d.dataset.p !== k; }); resumen(); };
  $m('.qr-modo').addEventListener('click', (e)=> { const b = e.target.closest('[data-modo]'); if (b) verModo(b.dataset.modo); });
  $m('.qr-tam').addEventListener('click', (e)=> { const b = e.target.closest('[data-tam]'); if (!b) return; fijarTam(b.dataset.tam); m.el.querySelectorAll('.qr-tam [data-tam]').forEach((x)=> x.classList.toggle('on', x === b)); resumen(); });
  m.el.addEventListener('change', (e)=> { const t = e.target;
    if (t.dataset.tipo) { if (t.checked) tipos.add(t.dataset.tipo); else tipos.delete(t.dataset.tipo); }
    if (t.dataset.eqq) { if (t.checked) elegidos.add(t.dataset.eqq); else elegidos.delete(t.dataset.eqq); }
    resumen(); });
  $m('#qrBus').addEventListener('input', ()=> { const q = UI.norm($m('#qrBus').value).trim();
    m.el.querySelectorAll('#qrLista label.qr-op').forEach((l)=> { l.hidden = !!q && !l.dataset.txt.includes(q); });
    m.el.querySelectorAll('#qrLista .qr-grupo').forEach((g)=> { g.hidden = ![...m.el.querySelectorAll('#qrLista label.qr-op')].some((l)=> !l.hidden && l.querySelector('[data-eqq]') && act.find((e)=> e.id === l.querySelector('[data-eqq]').dataset.eqq).resumen.categoria === g.dataset.g); }); });
  m.el.querySelectorAll('[data-marcar]').forEach((b)=> b.addEventListener('click', ()=> { const si = b.dataset.marcar === '1';
    m.el.querySelectorAll('#qrLista label.qr-op').forEach((l)=> { if (si && l.hidden) return; const c = l.querySelector('input'); c.checked = si; if (si) elegidos.add(c.dataset.eqq); else elegidos.delete(c.dataset.eqq); }); resumen(); }));
  $m('#qrImp').addEventListener('click', async ()=> {
    const l = lista();
    if (!l.length) { $m('#qrMsg').innerHTML = '<div class="v-resumen"><b>Falta:</b> ' + (modo === 'tipo' ? 'marcar al menos un tipo de equipo' : 'marcar al menos un equipo') + '.</div>'; return; }
    const hojas = Math.ceil(l.length / porHojaQR(tamQR));
    if (hojas > 6 && !await Dialogo.confirmar('Son ' + l.length + ' etiquetas (' + hojas + ' hojas). ¿Imprimirlas todas?')) return;
    const titulo = modo === 'todos' ? 'TODO EL INVENTARIO' : modo === 'tipo' ? cats.filter((c)=> tipos.has(c.id)).map((c)=> c.p.nombre.toUpperCase()).join(', ') : 'EQUIPOS ELEGIDOS';
    m.cerrar(); imprimirEtiquetas(l, tamQR, titulo);
  });
  verModo(modo);
}
$('btnQrTodos').addEventListener('click', ()=> abrirEtiquetas());

/* ── Inspeccionar ── */
$('btnInspeccionar').addEventListener('click', ()=>{
  const m = UI.modal('<h3>¿Qué vas a inspeccionar?</h3><div class="cats" id="catsSel">' + activas().map((p)=>{
    const n = equipos.filter((e)=> e.resumen.categoria === p.id && e.resumen.activo !== false).length;
    return '<button type="button" data-cat="' + esc(p.id) + '"><span>' + p.icono + '</span>' + esc(p.nombre) + '<small>' + n + ' en inventario' + (p.origen !== 'original' ? ' · ' + (p.origen === 'propia' ? 'lista propia' : 'ajustada') : '') + '</small></button>'; }).join('') + '</div><button type="button" class="btn ghost" data-cerrar>Cancelar</button>');
  m.el.querySelector('#catsSel').addEventListener('click', (e)=>{
    const b = e.target.closest('[data-cat]'); if (!b) return;
    const cat = b.dataset.cat, lista = equipos.filter((x)=> x.resumen.categoria === cat && x.resumen.activo !== false);
    if (!lista.length) { m.cerrar(); iniciarInspeccion(cat, null); return; }
    m.el.innerHTML = '<h3>' + esc(PL[cat].nombre) + ': ¿cuál?</h3>' + lista.map((x)=>{ const s = estadoEq(x); return '<button type="button" class="item ' + s.c + '" data-eqi="' + esc(x.id) + '"><div class="t">' + esc((x.resumen.codigo ? x.resumen.codigo + ' · ' : '') + x.resumen.nombre) + '</div><div class="m">' + esc(x.resumen.ubicacion || '') + ' · próxima ' + esc(UI.corta(s.proxima)) + '</div></button>'; }).join('') +
      '<button type="button" class="btn ghost" data-sin="1">Uno que no está en el inventario</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button>';
    m.el.addEventListener('click', (ev)=>{ const q = ev.target.closest('[data-eqi]'); if (q) { m.cerrar(); const x = equipos.find((y)=> y.id === q.dataset.eqi); iniciarInspeccion(cat, Object.assign({ id: x.id }, x.resumen)); } else if (ev.target.closest('[data-sin]')) { m.cerrar(); iniciarInspeccion(cat, null); } });
  });
});
/** v123: «Sección | pregunta» (listas de los formatos de la empresa). */
function partesItem(t){ const m = /^([^|]{2,80}) \| (.+)$/.exec(String(t || '')); return m ? { sec: m[1].trim(), t: m[2].trim() } : { sec: '', t: String(t || '') }; }
function iniciarInspeccion(cat, eq, extra){
  const p = pl(cat); extra = extra || {};
  if (!p.items.length) { UI.toast('Esa lista de chequeo no tiene preguntas.', 'mal'); return; }
  // La lista se copia: si se recargan las listas mientras se inspecciona, esta no cambia.
  // v154: el botiquín suma su contenido según el tipo (Res. 0705 de 2007) y cada elemento se cuenta contra su mínimo.
  const cont = p.id !== 'botiquin' ? [] : eq && Array.isArray(eq.contenido) && eq.contenido.length
    ? eq.contenido.map((x)=> ({ t: 'Contenido del botiquín | ' + x.e, min: Number(x.min) || 0, unidad: x.u || '' }))
    : (typeof elementosBotiquin === 'function' ? elementosBotiquin((eq && eq.subtipo) || 'A') : []);
  const its = p.items.concat(cont.map((x)=> x.t)), req = p.items.map(()=> null).concat(cont);
  insp = { plantilla: cat, p: Object.assign({}, p, { items: its }), req, equipo: eq, progId: extra.progId || '', respuestas: its.map(()=> ({ r:'', obs:'' })), participantes: [] };
  fotosNC = {};
  $('inTipo').value = extra.tipo || (p.preoperacional ? 'Preoperacional' : 'Rutinaria');
  pintarParticipantes();
  $('inCat').textContent = p.icono + ' ' + p.nombre + (p.codigo ? ' · ' + p.codigo : '') + (p.preoperacional ? ' · preoperacional' : '');
  $('inTitulo').textContent = eq ? ((eq.codigo ? eq.codigo + ' · ' : '') + (eq.nombre || p.nombre)) : p.nombre;
  $('inSub').textContent = eq ? (eq.ubicacion || '') : 'Sin equipo del inventario';
  $('inFecha').value = UI.hoy(); $('inLugar').value = extra.lugar || (eq ? (eq.ubicacion || '') : ''); $('inObs').value = '';
  try { $('inInsp').value = localStorage.getItem('ssta-reporta') || ''; } catch (e) {}
  // v123: «Sección | pregunta» → la sección sale como título y la pregunta sin el prefijo.
  let secAnt = '';
  $('inItems').innerHTML = insp.p.items.map((t, i)=> { const pp = partesItem(t), cab = pp.sec && pp.sec !== secAnt ? '<h3 class="sec-insp">' + esc(pp.sec) + '</h3>' : ''; secAnt = pp.sec || secAnt; return cab + '<div class="preg" data-i="' + i + '"><div class="q">' + (i + 1) + '. ' + esc(pp.t) + '</div><div class="op">' +
    ['C', 'NC', 'NA'].map((v)=> '<button type="button" data-v="' + v + '">' + v + '</button>').join('') + '</div>' +
    (insp.req[i] ? '<div class="cant-insp"><span>Mínimo <b>' + insp.req[i].min + '</b> · ' + esc(insp.req[i].unidad) + '</span><label>Hay <input type="number" class="hay" min="0" inputmode="numeric"></label><label>Vence <input type="date" class="vence"></label></div>' : '') +
    '<div class="nc-extra"><div class="field" style="margin:0 0 8px;"><input type="text" class="obs" placeholder="¿Qué se encontró?"></div><div class="fotoNC"></div></div></div>'; }).join('');
  $('inItems').querySelectorAll('.preg').forEach((d)=>{ fotosNC[d.dataset.i] = UI.fotos(d.querySelector('.fotoNC'), { max: 2 }); });
  fotosInsp = UI.fotos($('inFotos'), { max: 3 });
  $('inFirma').innerHTML = UI.padHTML('padInspector'); UI.activarPad('padInspector');
  $('msgInsp').textContent = ''; actualizarResultado();
  show('scrInsp');
}
/* v154: al escribir cuántos hay (y si vence), la respuesta se marca sola: menos del mínimo o vencido = NC. */
$('inItems').addEventListener('input', (e)=> {
  const d = e.target.closest('.preg'); if (!d || !e.target.matches('.hay, .vence')) return;
  const i = +d.dataset.i, q = insp.req[i]; if (!q) return;
  const hay = d.querySelector('.hay').value, ve = d.querySelector('.vence').value;
  if (hay === '') return;
  const falta = Number(hay) < q.min, vencido = ve && ve < UI.hoy();
  insp.respuestas[i].r = falta || vencido ? 'NC' : 'C';
  const o = d.querySelector('.obs'); if (insp.respuestas[i].r === 'NC' && (!o.value || o.dataset.auto)) { o.value = (falta ? 'Hay ' + hay + ' de ' + q.min + ' mínimo' : '') + (falta && vencido ? '; ' : '') + (vencido ? 'vencido (' + UI.corta(ve) + ')' : ''); o.dataset.auto = '1'; }
  d.querySelectorAll('.op button').forEach((x)=> x.classList.toggle('on', x.dataset.v === insp.respuestas[i].r));
  d.classList.toggle('es-nc', insp.respuestas[i].r === 'NC');
  actualizarResultado();
});
$('inItems').addEventListener('click', (e)=>{
  const b = e.target.closest('.op button'); if (!b) return;
  const d = b.closest('.preg'), i = +d.dataset.i;
  insp.respuestas[i].r = insp.respuestas[i].r === b.dataset.v ? '' : b.dataset.v;
  d.querySelectorAll('.op button').forEach((x)=> x.classList.toggle('on', x.dataset.v === insp.respuestas[i].r));
  d.classList.toggle('es-nc', insp.respuestas[i].r === 'NC');
  actualizarResultado();
});
$('btnTodoC').addEventListener('click', async ()=>{
  if (insp.respuestas.some((x)=> x.r) && !await Dialogo.confirmar('¿Marcar como "C" las preguntas que aún no tienen respuesta?')) return;
  $('inItems').querySelectorAll('.preg').forEach((d)=>{ const i = +d.dataset.i; if (!insp.respuestas[i].r) { insp.respuestas[i].r = 'C'; d.querySelector('[data-v="C"]').classList.add('on'); } });
  actualizarResultado();
});
function actualizarResultado(){
  const p = insp.p, sin = insp.respuestas.filter((x)=> !x.r).length, nc = insp.respuestas.filter((x)=> x.r === 'NC').length;
  $('inProg').textContent = sin ? sin + ' de ' + p.items.length + ' sin responder' : 'Todas respondidas';
  $('inResultado').innerHTML = sin ? '' : '<div class="resultado ' + (nc ? 'mal' : 'ok') + '">' + (nc ? '✗ NO CONFORME · ' + nc + ' hallazgo(s)' + (p.preoperacional ? ' · NO APTO PARA USAR hasta corregir' : '') + '. Cada uno queda como acción del plan de acción.' : '✓ CONFORME' + (p.preoperacional ? ' · apto para usar' : '')) + '</div>';
}
UI.autocompletar($('inInsp'), (x)=> { $('inInsp').value = x.nombre; $('inInspCC').value = x.cedula || ''; });

/* ── Participantes (inspecciones gerenciales y del COPASST) ── */
function pintarParticipantes(){
  const t = $('inTipo').value, con = CON_PARTICIPANTES.includes(t);
  $('cardPart').hidden = !con;
  $('inInspTit').textContent = con ? 'Quien dirige la inspección' : 'Inspector';
  $('partAyuda').textContent = t === 'COPASST' ? 'Integrantes del COPASST (o vigía) que hacen la inspección y trabajadores del área que acompañan. Cada uno firma.' : 'Gerente o directivos que recorren el área y quienes acompañan (SST, jefe del área, trabajadores). Cada uno firma.';
  if (!con) return;
  if (!insp.participantes.length) insp.participantes.push({ nombre: '', cargo: '', firma: '' });
  $('inPart').innerHTML = insp.participantes.map(htmlParticipante).join('');
  $('inPart').querySelectorAll('.part').forEach((el)=> { const n = el.querySelector('[data-k="nombre"]'); UI.autocompletar(n, (p)=> { n.value = p.nombre; el.querySelector('[data-k="cargo"]').value = p.cargo || ''; }); });
  insp.participantes.forEach((x, i)=> UI.activarPad('fPart_' + i, x.firma));
}
function htmlParticipante(x, i){
  return '<div class="part" data-i="' + i + '"><div class="grid2"><div class="field"><label>Nombre</label><input type="text" data-k="nombre" value="' + esc(x.nombre) + '" placeholder="Escribe para buscar"></div><div class="field"><label>Cargo / rol</label><input type="text" data-k="cargo" value="' + esc(x.cargo || '') + '"></div></div>' +
    '<div class="field"><label>Firma</label>' + UI.padHTML('fPart_' + i) + '</div></div>';
}
function leerParticipantes(){
  if ($('cardPart').hidden) return;
  insp.participantes = [...$('inPart').querySelectorAll('.part')].map((el, i)=> ({ nombre: el.querySelector('[data-k="nombre"]').value.trim(), cargo: el.querySelector('[data-k="cargo"]').value.trim(), firma: UI.firma('fPart_' + i) || (insp.participantes[i] || {}).firma || '' }));
}
$('inTipo').addEventListener('change', ()=> { leerParticipantes(); pintarParticipantes(); });
// Agregar no vuelve a pintar a los demás (así ninguna firma se redibuja ni se pierde).
$('btnAddPart').addEventListener('click', ()=> {
  const i = $('inPart').querySelectorAll('.part').length;
  $('inPart').insertAdjacentHTML('beforeend', htmlParticipante({ nombre: '', cargo: '' }, i));
  const el = $('inPart').lastElementChild, n = el.querySelector('[data-k="nombre"]');
  UI.autocompletar(n, (p)=> { n.value = p.nombre; el.querySelector('[data-k="cargo"]').value = p.cargo || ''; });
  UI.activarPad('fPart_' + i); n.focus();
});

$('btnGuardarInsp').addEventListener('click', async ()=>{
  const p = insp.p, msg = $('msgInsp');
  const sin = insp.respuestas.findIndex((x)=> !x.r);
  if (sin !== -1) { msg.textContent = 'Falta responder la pregunta ' + (sin + 1) + '.'; $('inItems').querySelector('[data-i="' + sin + '"]').scrollIntoView({ block:'center' }); return; }
  const items = p.items.map((t, i)=>{ const d = $('inItems').querySelector('[data-i="' + i + '"]'), q = insp.req && insp.req[i], x = { t, r: insp.respuestas[i].r, obs: d.querySelector('.obs').value.trim(), fotos: insp.respuestas[i].r === 'NC' ? fotosNC[i].get() : [] };
    if (q) { x.min = q.min; x.unidad = q.unidad; const h = d.querySelector('.hay').value, v = d.querySelector('.vence').value; if (h !== '') x.hay = Number(h); if (v) x.vence = v; }
    return x; });
  const faltaObs = items.findIndex((x)=> x.r === 'NC' && !x.obs);
  if (faltaObs !== -1) { msg.textContent = 'Describe qué se encontró en la pregunta ' + (faltaObs + 1) + ' (no conforme).'; $('inItems').querySelector('[data-i="' + faltaObs + '"] .obs').focus(); return; }
  const tipoI = $('inTipo').value; leerParticipantes();
  const part = insp.participantes.filter((x)=> x.nombre);
  if (CON_PARTICIPANTES.includes(tipoI) && !part.length) { msg.textContent = 'En una inspección ' + (tipoI === 'COPASST' ? 'del COPASST' : 'gerencial') + ' anota a los participantes.'; $('cardPart').scrollIntoView({ block: 'center' }); return; }
  const sinFirma = CON_PARTICIPANTES.includes(tipoI) ? part.find((x)=> !x.firma) : null;
  if (sinFirma) { msg.textContent = 'Falta la firma de ' + sinFirma.nombre + '.'; $('cardPart').scrollIntoView({ block: 'center' }); return; }
  if (Valida.revisar($('scrInsp'), [{ el: $('inFecha'), etiqueta: 'Fecha', error: ()=> Valida.pasada($('inFecha').value) },
    { el: $('inInsp'), etiqueta: CON_PARTICIPANTES.includes(tipoI) ? 'Quien dirige' : 'Inspector', error: ()=> $('inInsp').value.trim() ? '' : 'falta el nombre' },
    { el: $('inInspCC'), etiqueta: 'Cédula del inspector', error: ()=> $('inInspCC').value.trim() ? Valida.cedula($('inInspCC').value) : '' }], msg).length) return;
  const firma = UI.firma('padInspector');
  if (!firma) { msg.textContent = 'Falta la firma del inspector.'; return; }
  try { localStorage.setItem('ssta-reporta', $('inInsp').value.trim()); } catch (e) {}
  const eq = insp.equipo, nc = items.filter((x)=> x.r === 'NC');
  const id = SGSST.nuevoId('INS');
  const doc = { categoria: p.nombre, plantilla: p.id, subtipo: (eq && eq.subtipo) || '', equipoId: eq ? eq.id : '', equipoNombre: eq ? ((eq.codigo ? eq.codigo + ' · ' : '') + (eq.nombre || p.nombre)) : p.nombre,
    fecha: $('inFecha').value, lugar: $('inLugar').value.trim(), items, observaciones: $('inObs').value.trim(), fotos: fotosInsp.get(),
    inspector: { nombre: $('inInsp').value.trim(), cedula: $('inInspCC').value.trim(), firma }, preoperacional: !!p.preoperacional,
    tipoInspeccion: tipoI, participantes: CON_PARTICIPANTES.includes(tipoI) ? part : [], progId: insp.progId || '' };
  $('btnGuardarInsp').disabled = true; msg.textContent = 'Guardando…';
  const resLocal = { categoria: p.nombre, plantilla: p.id, equipoId: doc.equipoId, equipo: doc.equipoNombre, fecha: doc.fecha, lugar: doc.lugar, inspector: doc.inspector.nombre,
    resultado: nc.length ? 'NO CONFORME' : 'CONFORME', nc: nc.length, items: items.length, noConformes: nc.map((x)=> x.t),
    tipoInspeccion: doc.tipoInspeccion, participantes: doc.participantes.length, progId: doc.progId };
  const r = await SGSST.enviar({ action:'guardar', tipo:'inspeccion', id, doc }, { estado: resLocal.resultado, fecha: doc.fecha, resumen: resLocal });
  if (!r.ok) { $('btnGuardarInsp').disabled = false; msg.textContent = Errores.texto('guardó', r); return; }
  inspecciones.push({ id, tipo:'inspeccion', resumen: r.resumen || resLocal, pendiente: !!r.enCola });
  // El equipo queda con su última inspección (para la programación).
  if (eq && (!eq.ultimaInspeccion || doc.fecha >= eq.ultimaInspeccion)) {
    const camposEq = { ultimaInspeccion: doc.fecha, ultimoResultado: resLocal.resultado };
    const re = await SGSST.enviar({ action:'parche', tipo:'equipo', id: eq.id, campos: camposEq }, { resumen: Object.assign({}, eq, camposEq) });
    const k = equipos.findIndex((x)=> x.id === eq.id);
    if (k !== -1) equipos[k].resumen = re.resumen || Object.assign({}, equipos[k].resumen, camposEq);
  }
  // Cada no conforme → acción del plan de acción (responsable y fecha se ajustan allá).
  if (nc.length) {
    const resp = await new Promise((ok)=>{
      const m = UI.modal('<h3>' + nc.length + ' hallazgo(s) al plan de acción</h3><p class="ayuda">Se crea una acción por cada no conforme, con su foto.</p>' +
        '<div class="field"><label>Responsable de corregir</label><input type="text" id="ncResp" placeholder="Escribe para buscar"></div>' +
        '<div class="field"><label>Fecha de compromiso</label><input type="date" id="ncFecha" value="' + Festivos.sumarHabiles(UI.hoy(), p.preoperacional ? 2 : 5) + '"></div>' +
        '<button type="button" class="btn amber" id="ncOk">Crear acciones</button>', true);
      UI.autocompletar(m.el.querySelector('#ncResp'), (x)=> { m.el.querySelector('#ncResp').value = x.nombre; });
      m.el.querySelector('#ncOk').addEventListener('click', ()=>{ const v = m.el.querySelector('#ncResp').value.trim(); if (!v) { UI.toast('Falta el responsable.', 'mal'); return; } const f = m.el.querySelector('#ncFecha').value; m.cerrar(); ok({ v, f }); });
    });
    for (const x of nc) await UI.guardarAccion({ origen: doc.tipoInspeccion === 'COPASST' ? 'COPASST' : 'Inspección planeada', origenRef: id, hallazgo: doc.equipoNombre + ': ' + x.t + (x.obs ? ' — ' + x.obs : ''),
      accion: 'Corregir en ' + doc.equipoNombre + ': ' + (x.obs || x.t), tipoAccion: 'Correctiva', prioridad: p.preoperacional ? 'Alta' : 'Media', responsable: resp.v, fechaCompromiso: resp.f, fotos: x.fotos, creadoPor: doc.inspector.nombre });
  }
  $('btnGuardarInsp').disabled = false;
  UI.toast(r.enCola ? '⏳ Inspección guardada en el equipo; se envía al volver la señal.' : '✓ Inspección guardada' + (nc.length ? ' y ' + nc.length + ' acción(es) creada(s)' : ''));
  show('scrLista'); pintar();
});

/* ── Ver una inspección ── */
async function verInspeccion(id){
  const m = UI.modal('<div class="status-msg">Abriendo…</div>');
  const d = await SGSST.doc(id);
  if (!d) { m.el.innerHTML = '<div class="aviso">No se pudo abrir la inspección (¿sin señal?).</div><button type="button" class="btn ghost" data-cerrar>Cerrar</button>'; return; }
  const nc = (d.items || []).filter((x)=> x.r === 'NC');
  m.el.innerHTML = '<h3>' + esc(d.equipoNombre || d.categoria) + '</h3>' +
    '<div class="resultado ' + (nc.length ? 'mal' : 'ok') + '">' + (nc.length ? '✗ NO CONFORME · ' + nc.length + ' hallazgo(s)' : '✓ CONFORME') + '</div>' +
    '<div class="dato"><span>Fecha</span><b>' + esc(UI.corta(d.fecha)) + '</b></div><div class="dato"><span>Tipo</span><b>' + esc(d.tipoInspeccion || (d.preoperacional ? 'Preoperacional' : 'Rutinaria')) + '</b></div><div class="dato"><span>Inspector</span><b>' + esc((d.inspector || {}).nombre || '') + '</b></div>' +
    ((d.participantes || []).length ? '<div class="dato"><span>Participantes</span><b>' + esc(d.participantes.map((x)=> x.nombre + (x.cargo ? ' (' + x.cargo + ')' : '')).join(', ')) + '</b></div>' : '') +
    (nc.length ? '<h3 class="u-mt12">No conformes</h3>' + nc.map((x)=> '<div class="item mal"><div class="t">' + esc(x.t) + '</div><div class="m">' + esc(x.obs || '') + '</div></div>').join('') +
      '<a class="btn ghost" href="plan-accion.html">Ver en el plan de acción</a>' : '') +
    (d.observaciones ? '<div class="texto-largo u-mt10">' + esc(d.observaciones) + '</div>' : '') +
    '<button type="button" class="btn" id="verPdf">🖨️ PDF de la inspección</button><button type="button" class="btn ghost" data-cerrar>Cerrar</button>';
  m.el.querySelector('#verPdf').addEventListener('click', ()=> { m.cerrar(); pdfInspeccion(id); });
}

/* ── PDF de una inspección ── */
async function pdfInspeccion(id){
  const d = await SGSST.doc(id);
  if (!d) { UI.toast('No se pudo abrir la inspección.', 'mal'); return; }
  const nc = (d.items || []).filter((x)=> x.r === 'NC').length;
  let h = UI.cabecera('SG-INSPECCION', 'INSPECCIÓN: ' + String(d.categoria || '').toUpperCase(), 'Registro ' + d.id + ' · ' + (nc ? 'NO CONFORME (' + nc + ')' : 'CONFORME') + (d.preoperacional ? (nc ? ' · NO APTO' : ' · APTO') : ''));
  h += UI.seccion('Datos', UI.tablaDatos([['Equipo / área', d.equipoNombre || '—'], ['Fecha', UI.corta(d.fecha)], ['Lugar', d.lugar || '—'], ['Tipo de inspección', d.tipoInspeccion || (d.preoperacional ? 'Preoperacional' : 'Rutinaria')], [(d.participantes || []).length ? 'Dirige' : 'Inspector', (d.inspector || {}).nombre || '—']]));
  h += UI.seccion('Lista de chequeo', '<table><tr><th style="width:4%">N°</th><th>Aspecto</th><th style="width:7%">Resultado</th><th style="width:30%">Observación</th></tr>' +
    (d.items || []).map((x, i, arr)=> { const pp = partesItem(x.t), ant = i ? partesItem(arr[i - 1].t).sec : ''; return (pp.sec && pp.sec !== ant ? '<tr><td colspan="4" style="background:var(--bg);font-weight:700;">' + esc(pp.sec) + '</td></tr>' : '') + '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(pp.t) + (x.min != null ? '<br><small>Mínimo ' + x.min + ' ' + esc(x.unidad || '') + (x.hay != null ? ' · hay ' + x.hay : '') + (x.vence ? ' · vence ' + esc(UI.corta(x.vence)) : '') + '</small>' : '') + '</td><td class="a"' + (x.r === 'NC' ? ' style="background:var(--rojo-100);"' : '') + '>' + esc(x.r) + '</td><td>' + esc(x.obs || '') + (x.fotos && x.fotos.length ? '<br>' + UI.imgs(x.fotos, 'height:60px;margin:2px;') : '') + '</td></tr>'; }).join('') + '</table>');
  if (d.observaciones || (d.fotos || []).length) h += UI.seccion('Observaciones', UI.textoLargo(d.observaciones || '') + UI.fotosHoja(d.fotos));
  if ((d.participantes || []).length) h += UI.seccion('Participantes', '<table><tr><th style="width:5%">N°</th><th>Nombre</th><th style="width:28%">Cargo / rol</th><th style="width:28%">Firma</th></tr>' + d.participantes.map((x, i)=> '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(x.nombre) + '</td><td>' + esc(x.cargo || '') + '</td><td>' + UI.firmaHoja(x.firma) + '</td></tr>').join('') + '</table>');
  h += '<table class="u-mt6"><tr><td class="l" style="width:20%">Firma del inspector</td><td>' + UI.firmaHoja((d.inspector || {}).firma) + '<br>' + esc((d.inspector || {}).nombre || '') + ((d.inspector || {}).cedula ? ' · C.C. ' + esc(d.inspector.cedula) : '') + '</td></tr></table>';
  UI.imprimir([h], false);
}

/* ── PDF del inventario ── */
$('btnPdfInv').addEventListener('click', ()=>{
  const act = equipos.filter((e)=> e.resumen.activo !== false);
  if (!act.length) { UI.toast('El inventario está vacío.'); return; }
  const h0 = UI.hoy();
  let t = '<table><tr><th style="width:3%">N°</th><th style="width:13%">Categoría</th><th style="width:9%">Código</th><th style="width:18%">Descripción</th><th style="width:16%">Ubicación</th><th style="width:8%">Frecuencia</th><th style="width:9%">Última</th><th style="width:9%">Próxima</th><th>Vencimientos</th></tr>';
  act.sort((a, b)=> String(a.resumen.categoria).localeCompare(String(b.resumen.categoria)) || String(a.resumen.codigo).localeCompare(String(b.resumen.codigo))).forEach((e, i)=>{
    const r = e.resumen, p = proxima(e), v = r.vencimientos || {};
    t += '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(pl(r.categoria).nombre) + '</td><td>' + esc(r.codigo) + '</td><td>' + esc(r.nombre) + '</td><td>' + esc(r.ubicacion) + '</td><td>' + esc((FRECUENCIAS[r.frecuencia] || {}).nombre || '') + '</td>' +
      '<td' + (r.ultimoResultado === 'NO CONFORME' ? ' style="background:var(--rojo-100);"' : '') + '>' + esc(UI.corta(r.ultimaInspeccion) || '—') + (r.ultimoResultado === 'NO CONFORME' ? '<br>NO CONFORME' : '') + '</td><td' + (p <= h0 ? ' style="background:var(--ambar-100);"' : '') + '>' + esc(UI.corta(p)) + '</td>' +
      '<td>' + Object.keys(v).filter((k)=> v[k]).map((k)=> '<span' + (v[k] < h0 ? ' style="background:var(--rojo-100);"' : '') + '>' + esc(k) + ': ' + esc(UI.corta(v[k])) + '</span>').join('<br>') + '</td></tr>';
  });
  UI.imprimir([UI.cabecera('SG-INVENTARIO', 'INVENTARIO DE EQUIPOS E INSPECCIONES PLANEADAS', 'Corte ' + UI.corta(h0) + ' · ' + act.length + ' equipos y áreas') + t + '</table>'], true);
});

/* ── Cronograma anual: programado frente a ejecutado ──
   Equipos y áreas del inventario: los meses salen de su frecuencia, contando desde
   su última inspección antes del año (o la primera, o desde que se agregó). Las de
   frecuencia diaria, semanal o quincenal se programan todos los meses y el mes
   cuenta como hecho con al menos una inspección (el detalle está en el historial).
   Inspecciones gerenciales y del COPASST: los meses que se programen aquí. */
const idxMes = (y, m)=> y * 12 + m - 1;
/** Con usuarios con nombre, qué roles pueden programar o editar listas (sin usuarios, todos). */
const puede = (roles)=> { const r = typeof Sesion !== 'undefined' ? Sesion.rol() : ''; return !r || roles.includes(r); };
/** Meses programados de una inspección en el año: se guardan como "AAAA-MM" (o, en registros viejos, 1 a 12 del año "anio"). */
function mesesProg(r, anio){
  const l = String(r.meses || '').split(/\s*,\s*/).filter(Boolean), out = new Set();
  l.forEach((x)=> { if (/^\d{4}-\d{2}$/.test(x)) { if (Number(x.slice(0, 4)) === anio) out.add(Number(x.slice(5, 7))); } else if (/^\d{1,2}$/.test(x) && Number(r.anio) === anio) out.add(Number(x)); });
  return out;
}
function cronograma(anio){
  const hoy = UI.hoy(), aA = Number(hoy.slice(0, 4)), mA = Number(hoy.slice(5, 7));
  const pasado = (m)=> anio < aA || (anio === aA && m < mA), esAhora = (m)=> anio === aA && m === mA;
  const filas = [];
  equipos.filter((e)=> e.resumen.activo !== false).forEach((e)=> {
    const r = e.resumen, f = FRECUENCIAS[r.frecuencia] || FRECUENCIAS.mensual;
    const mias = inspecciones.filter((i)=> i.resumen.equipoId === e.id).map((i)=> String(i.resumen.fecha || '')).filter((x)=> /^\d{4}-\d{2}/.test(x)).sort();
    const hechos = {}; mias.forEach((x)=> { if (Number(x.slice(0, 4)) === anio) { const m = Number(x.slice(5, 7)); hechos[m] = (hechos[m] || 0) + 1; } });
    const desde = /^\d{4}-\d{2}/.test(String(e.creado || '')) ? String(e.creado).slice(0, 7) : '';
    const inicio = desde ? idxMes(Number(desde.slice(0, 4)), Number(desde.slice(5, 7))) : -Infinity;
    const prog = new Set();
    if (f.dias) { for (let m = 1; m <= 12; m++) if (idxMes(anio, m) >= inicio) prog.add(m); }
    else {
      const ancla = mias.filter((x)=> x < anio + '-01-01').pop() || mias[0] || (desde ? desde + '-01' : anio + '-01-01');
      const a = idxMes(Number(ancla.slice(0, 4)), Number(ancla.slice(5, 7)));
      // La última inspección (o la primera) solo fija en qué meses toca; desde que se agregó al inventario, todos cuentan.
      for (let m = 1; m <= 12; m++) { const i = idxMes(anio, m); if (i >= inicio && (i - a) % f.meses === 0) prog.add(m); }
    }
    const p = pl(r.categoria);
    filas.push({ grupo: 'Equipos y áreas del inventario', id: e.id, nombre: (r.codigo ? r.codigo + ' · ' : '') + (r.nombre || p.nombre), sub: p.nombre + ' · ' + ((FRECUENCIAS[r.frecuencia] || {}).nombre || ''), prog, hechos });
  });
  progs.filter((x)=> x.resumen.activo !== false).forEach((x)=> {
    const r = x.resumen, prog = mesesProg(r, anio), hechos = {};
    if (!prog.size) return;
    inspecciones.forEach((i)=> { const s = i.resumen, f = String(s.fecha || ''); if (Number(f.slice(0, 4)) !== anio) return;
      if (s.progId === x.id || (!s.progId && !s.equipoId && r.tipoInspeccion && r.tipoInspeccion !== 'Rutinaria' && s.tipoInspeccion === r.tipoInspeccion && s.plantilla === r.plantilla)) { const m = Number(f.slice(5, 7)); hechos[m] = (hechos[m] || 0) + 1; } });
    filas.push({ grupo: 'Inspecciones gerenciales y del COPASST', id: x.id, prog: prog, hechos, r, nombre: r.titulo || 'Inspección programada', sub: (r.tipoInspeccion || '') + ' · ' + pl(r.plantilla).nombre + (r.responsable ? ' · ' + r.responsable : '') });
  });
  let due = 0, ok = 0;
  filas.forEach((f)=> { f.celdas = []; for (let m = 1; m <= 12; m++) { const p = f.prog.has(m), h = f.hechos[m] || 0;
    const c = h ? 'ok' : p && pasado(m) ? 'mal' : p ? 'p' : '';
    if (p && (pasado(m) || (esAhora(m) && h))) { due++; if (h) ok++; }
    f.celdas.push({ m, p, h, c, ahora: esAhora(m) }); } });
  return { filas, due, ok, pct: due ? Math.round(ok * 100 / due) : null, anio };
}
function pintarCronograma(){
  const cr = cronograma(anioCron), aA = Number(UI.hoy().slice(0, 4));
  const anios = [aA + 1, aA, aA - 1, aA - 2];
  let h = '<div class="fila-btn" style="align-items:center;"><select id="cAnio" style="max-width:120px;">' + anios.map((a)=> '<option' + (a === anioCron ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>' +
    '<div class="m" style="flex:1;font-size:var(--fs-base);"><b>' + (cr.pct == null ? 'Sin inspecciones programadas a la fecha' : 'Cumplimiento: ' + cr.pct + '%') + '</b>' + (cr.due ? ' · ' + cr.ok + ' de ' + cr.due + ' programadas a la fecha' : '') + '</div></div>' +
    '<div class="leyenda"><span style="--c:#dff3e6">✓ hecha</span><span style="--c:#fbe0dc">✗ programada y no hecha</span><span style="--c:#fff6d9">P programada</span><span class="sin" style="--c:#fff">sin programar</span></div>';
  if (!cr.filas.length) h += '<div class="empty">Agrega equipos y áreas al inventario, o programa inspecciones gerenciales y del COPASST.</div>';
  else {
    h += '<div class="cron-wrap"><table class="cron"><tr><th style="text-align:left;">Equipo / área / inspección</th>' + MESES.map((m)=> '<th>' + m + '</th>').join('') + '</tr>';
    let g = '';
    cr.filas.forEach((f)=> {
      if (f.grupo !== g) { g = f.grupo; h += '<tr><td class="g" colspan="13">' + esc(g) + '</td></tr>'; }
      h += '<tr><td class="n" data-fila="' + esc(f.id) + '" style="cursor:pointer;">' + esc(f.nombre) + '<small>' + esc(f.sub) + '</small></td>' +
        f.celdas.map((c)=> '<td class="c ' + c.c + (c.ahora ? ' ahora' : '') + '" data-cel="' + esc(f.id) + '|' + c.m + '" title="' + esc(MESES[c.m - 1] + ': ' + (c.h ? c.h + ' hecha(s)' : c.p ? 'programada' : 'sin programar')) + '">' + (c.h ? '✓' + (c.h > 1 ? c.h : '') : c.c === 'mal' ? '✗' : c.p ? 'P' : '') + '</td>').join('') + '</tr>';
    });
    h += '</table></div><p class="ayuda">Toca una celda programada para hacer esa inspección; toca el nombre para ver el equipo o editar lo programado.</p>';
  }
  h += (puede(['admin', 'sst', 'comite']) ? '<button type="button" class="btn amber" id="cProg">+ Programar inspección gerencial o del COPASST</button>' : '') + '<button type="button" class="btn ghost" id="cPdf">🖨️ PDF: cronograma de inspecciones ' + anioCron + '</button>';
  $('lista').innerHTML = h;
  $('cAnio').addEventListener('change', ()=> { anioCron = Number($('cAnio').value); pintarCronograma(); });
  if ($('cProg')) $('cProg').addEventListener('click', ()=> editarProg(null));
  $('cPdf').addEventListener('click', ()=> pdfCronograma(cr));
}
async function clicCronograma(id, m){
  const e = equipos.find((x)=> x.id === id);
  if (e) { if (m == null) { abrirEquipo(id); return; } iniciarInspeccion(e.resumen.categoria, Object.assign({ id: e.id }, e.resumen)); return; }
  const p = progs.find((x)=> x.id === id); if (!p) return;
  if (m == null) { editarProg(p); return; }
  const r = p.resumen, mes = anioCron + '-' + String(m).padStart(2, '0');
  if (mes > UI.hoy().slice(0, 7)) { UI.toast('Esa inspección es de ' + MESES[m - 1] + ' de ' + anioCron + '; se hace cuando llegue el mes.'); return; }
  if (!PL[r.plantilla]) { UI.toast('La lista de chequeo de esta inspección ya no existe. Edita lo programado.', 'mal'); return; }
  if (mes < UI.hoy().slice(0, 7) && !await Dialogo.confirmar('Esta inspección era de ' + MESES[m - 1] + ' de ' + anioCron + '. Se registra con la fecha real (hoy) y cuenta para este mes; ' + MESES[m - 1] + ' queda como no hecha. ¿Continuar?')) return;
  iniciarInspeccion(r.plantilla, null, { tipo: r.tipoInspeccion, progId: p.id, lugar: r.titulo });
}
async function editarProg(x){
  const d = x ? await Registros.abrir(x.id) : { id: SGSST.nuevoId('PIN'), nuevo: true, anio: anioCron, tipoInspeccion: 'Gerencial', plantilla: 'locativa', meses: [], activo: true };
  if (!d) return;
  // En el formulario los meses van como 1 a 12 del año escogido; se guardan como "AAAA-MM".
  const anio0 = Number(d.anio) || anioCron;
  d.anio = anio0; d.meses = [...mesesProg({ meses: (d.meses || []).join(','), anio: anio0 }, anio0)].map(String);
  const campos = [{ k: 'titulo', l: 'Área o alcance', req: true, ph: 'Ej: Planta de producción y bodega' },
    { k: 'tipoInspeccion', l: 'Tipo', t: 'select', op: CON_PARTICIPANTES.concat(['Rutinaria']), medio: true }, { k: 'anio', l: 'Año', t: 'number', req: true, medio: true },
    { k: 'plantilla', l: 'Lista de chequeo', t: 'select', op: activas().concat(d.plantilla && PL[d.plantilla] && PL[d.plantilla].activa === false ? [PL[d.plantilla]] : []).map((p)=> [p.id, p.icono + ' ' + p.nombre]) },
    { k: 'meses', l: 'Meses en que se hace', t: 'checks', op: MESES.map((m, i)=> [String(i + 1), m]), req: true },
    { k: 'responsable', l: 'Responsable de convocarla', t: 'persona' }, { k: 'activo', l: 'Programada (desmarca para quitarla del cronograma)', t: 'check', def: true }];
  Registros.editar({ titulo: d.nuevo ? 'Programar inspección' : 'Inspección programada', campos, datos: d, adjuntos: false,
    antes: '<p class="ayuda">La gerencial la hace la alta dirección recorriendo las áreas; la del COPASST, sus integrantes (o el vigía). Quedan en el cronograma y el correo diario avisa si llega el día 20 y no se han hecho.</p>',
    borrar: d.nuevo ? null : async ()=> { const ok = await Registros.borrar(d.id, 'Quitada del cronograma de inspecciones'); if (ok) cargar(); return ok; },
    alGuardar: async (v)=> { v.anio = Number(v.anio); if (!(v.anio >= 2000 && v.anio <= 2100)) return 'Revisa el año.';
      v.meses = (v.meses || []).map(Number).sort((a, b)=> a - b).map((m)=> v.anio + '-' + String(m).padStart(2, '0'));
      const r = await Registros.guardar('proginsp', d.id, v, d.nuevo ? 0 : d.version); if (typeof r === 'string') return r;
      anioCron = v.anio; await cargar(); return true; } });
}
function pdfCronograma(cr){
  if (!cr.filas.length) { UI.toast('No hay nada programado.'); return; }
  let t = '<table><tr><th style="width:24%;">Equipo / área / inspección</th><th style="width:14%;">Lista · frecuencia</th>' + MESES.map((m)=> '<th>' + m + '</th>').join('') + '</tr>', g = '';
  cr.filas.forEach((f)=> { if (f.grupo !== g) { g = f.grupo; t += '<tr><td colspan="14" class="l">' + esc(g.toUpperCase()) + '</td></tr>'; }
    t += '<tr><td>' + esc(f.nombre) + '</td><td>' + esc(f.sub) + '</td>' + f.celdas.map((c)=> '<td class="a" style="' + (c.c === 'ok' ? 'background:var(--verde-50);' : c.c === 'mal' ? 'background:var(--rojo-100);' : c.c === 'p' ? 'background:var(--ambar-100);' : '') + '">' + (c.h ? 'E' + (c.h > 1 ? ' ' + c.h : '') : c.p ? 'P' : '') + '</td>').join('') + '</tr>'; });
  t += '</table><p style="font-size:9px;margin:4px 0 0;">P: programada · E: ejecutada (número de inspecciones si hubo más de una) · rojo: programada y no ejecutada. Cumplimiento a la fecha: ' + (cr.pct == null ? '—' : cr.pct + ' % (' + cr.ok + ' de ' + cr.due + ')') + '.</p>';
  UI.imprimir([UI.cabecera('SG-INSPECCION', 'CRONOGRAMA DE INSPECCIONES ' + cr.anio, 'Programado frente a ejecutado · corte ' + UI.corta(UI.hoy())) + t], true);
}

/* ── Listas de chequeo de la empresa ──
   Las del código se pueden ajustar (la ajustada toma su lugar y se puede volver a
   la original) y se pueden crear listas propias. Una inspección guarda el texto de
   cada pregunta, así que cambiar una lista no altera las inspecciones ya hechas. */
function pintarListas(){
  const etiqueta = { original: ['Original', 'gris'], ajustada: ['Ajustada', 'pronto'], propia: ['Propia', 'ok'] };
  const todas = LISTA.slice().sort((a, b)=> (a.activa === false) - (b.activa === false));
  $('lista').innerHTML = '<p class="ayuda">Ajusta las preguntas a los formatos de la empresa o crea listas nuevas (cocina, bodega, orden y aseo…). Cambiar una lista no altera las inspecciones ya hechas.</p>' +
    todas.map((p)=> { const e = p.activa === false ? ['Inactiva', 'gris'] : etiqueta[p.origen];
      return '<div class="item ' + (p.activa === false ? 'gris' : 'ok') + ' lst-item"><div class="fila"><div><div class="t">' + p.icono + ' ' + esc(p.nombre) + '</div><div class="m">' + p.items.length + ' preguntas · ' + esc((FRECUENCIAS[p.frecuencia] || {}).nombre || '') + (p.preoperacional ? ' · preoperacional' : '') + (p.vencimientos.length ? ' · controla: ' + esc(p.vencimientos.join(', ')) : '') + '</div></div><span class="chip ' + e[1] + '">' + e[0] + '</span></div>' +
        '<div class="acc">' + (!puede(['admin', 'sst']) ? '' : p.origen === 'original' ? '<button type="button" class="btn-mini" data-ajustar="' + esc(p.id) + '">✏️ Ajustar</button>' : '<button type="button" class="btn-mini" data-editlista="' + esc(p.docId) + '">✏️ Editar</button>') +
        (p.origen === 'ajustada' && puede(['admin', 'sst']) ? '<button type="button" class="btn-mini" style="background:var(--ink-soft);" data-restaurar="' + esc(p.docId) + '">↺ Volver a la original</button>' : '') +
        '<button type="button" class="btn-mini" style="background:var(--ink-soft);" data-verlista="' + esc(p.id) + '">Ver preguntas</button></div></div>'; }).join('') +
    (puede(['admin', 'sst']) ? '<button type="button" class="btn amber" id="lNueva">+ Nueva lista de chequeo</button>' : '<p class="ayuda">Las listas las ajusta Administrador o SST.</p>');
  if ($('lNueva')) $('lNueva').addEventListener('click', ()=> editarLista({ id: SGSST.nuevoId('PLI'), nuevo: true, nombre: '', icono: '📋', frecuencia: 'mensual', items: [], vencimientos: [], activa: true }));
  $('lista').querySelectorAll('[data-ajustar]').forEach((b)=> b.addEventListener('click', async ()=> {
    const p = PL[b.dataset.ajustar], ya = p.docAjuste ? await Registros.abrir(p.docAjuste) : null;
    if (p.docAjuste && !ya) return;
    editarLista(ya ? Object.assign(ya, { activa: true }) : { id: 'PLI-' + p.id, nuevo: true, reemplaza: p.id, nombre: p.nombre, icono: p.icono, frecuencia: p.frecuencia, preoperacional: !!p.preoperacional, items: p.items.slice(), vencimientos: (p.vencimientos || []).slice(), activa: true });
  }));
  $('lista').querySelectorAll('[data-editlista]').forEach((b)=> b.addEventListener('click', async ()=> { const d = await Registros.abrir(b.dataset.editlista); if (d) editarLista(d); }));
  $('lista').querySelectorAll('[data-restaurar]').forEach((b)=> b.addEventListener('click', async ()=> {
    if (!await Dialogo.confirmar('¿Volver a la lista original? Tu ajuste queda guardado y lo puedes retomar con "Ajustar".')) return;
    const r = await SGSST.enviar({ action: 'parche', tipo: 'plantillainsp', id: b.dataset.restaurar, campos: { activa: false } });
    if (!r.ok) { UI.toast(Errores.texto('guardó', r), 'mal'); return; } UI.toast('✓ Volvió la lista original.'); cargar(); }));
  $('lista').querySelectorAll('[data-verlista]').forEach((b)=> b.addEventListener('click', ()=> { const p = PL[b.dataset.verlista];
    UI.modal('<h3>' + p.icono + ' ' + esc(p.nombre) + '</h3><ol style="padding-left:20px;font-size:var(--fs-base);line-height:1.5;">' + p.items.map((t)=> '<li>' + esc(t) + '</li>').join('') + '</ol>' +
      (p.origen === 'ajustada' ? '<p class="ayuda">Ajustada a partir de la lista original "' + esc(p.original.nombre) + '" (' + p.original.items.length + ' preguntas).</p>' : '') + '<button type="button" class="btn ghost" data-cerrar>Cerrar</button>'); }));
}
const lineasTxt = (t)=> String(t || '').split(/\n/).map((x)=> x.replace(/\s+/g, ' ').trim()).filter(Boolean);
function editarLista(d, alGuardar){
  const items = d.items && d.items.length ? d.items : lineasTxt(d.itemsTexto), venc = d.vencimientos && d.vencimientos.length ? d.vencimientos : lineasTxt(d.vencimientosTexto);
  const m = UI.modal('<h3>' + (d.reemplaza ? 'Ajustar: ' + esc(d.nombre) : d.nuevo ? 'Nueva lista de chequeo' : esc(d.nombre)) + '</h3>' +
    (d.reemplaza ? '<p class="ayuda">Reemplaza a la lista original en las inspecciones nuevas. El inventario y el historial siguen igual.</p>' : '') +
    '<div class="field"><label>Nombre *</label><input type="text" id="lNom" value="' + esc(d.nombre || '') + '" placeholder="Ej: Cocina y comedor"></div>' +
    '<div class="field"><label>Ícono</label><div class="chips" id="lIco">' + ICONOS_INSPECCION.map((i)=> '<button type="button" data-v="' + i + '" class="' + (i === (d.icono || '📋') ? 'on' : '') + '">' + i + '</button>').join('') + '</div></div>' +
    '<div class="grid2"><div class="field"><label>Frecuencia sugerida</label><select id="lFrec">' + Object.keys(FRECUENCIAS).map((k)=> '<option value="' + k + '"' + (k === d.frecuencia ? ' selected' : '') + '>' + FRECUENCIAS[k].nombre + '</option>').join('') + '</select></div>' +
    '<div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" id="lPre"' + (d.preoperacional ? ' checked' : '') + '> Preoperacional (apto / no apto)</label></div></div>' +
    '<div class="field"><label>Preguntas * (una por línea)</label><textarea id="lItems" rows="12" style="min-height:220px;">' + esc(items.join('\n')) + '</textarea><div class="ayuda" id="lCuenta"></div></div>' +
    '<div class="field"><label>Fechas que se controlan en el inventario (una por línea)</label><textarea id="lVenc" rows="3" placeholder="Ej: Recarga&#10;Prueba hidrostática">' + esc(venc.join('\n')) + '</textarea></div>' +
    (d.nuevo || d.reemplaza ? '' : '<label class="check"><input type="checkbox" id="lAct"' + (d.activa !== false ? ' checked' : '') + '> Activa (desmarca para no usarla en inspecciones nuevas)</label>') +
    '<button type="button" class="btn amber" id="lOk">Guardar lista</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button><div class="status-msg" id="lMsg"></div>', true);
  const cuenta = ()=> { const n = lineasTxt(m.el.querySelector('#lItems').value).length; m.el.querySelector('#lCuenta').textContent = n + ' pregunta(s). Cada una se responde C / NC / NA; una NC pide observación y foto y se vuelve acción.'; };
  m.el.querySelector('#lItems').addEventListener('input', cuenta); cuenta();
  m.el.querySelector('#lIco').addEventListener('click', (e)=> { const b = e.target.closest('button[data-v]'); if (!b) return; m.el.querySelectorAll('#lIco button').forEach((x)=> x.classList.toggle('on', x === b)); });
  m.el.querySelector('#lOk').addEventListener('click', async ()=> {
    const msg = m.el.querySelector('#lMsg'), nombre = m.el.querySelector('#lNom').value.trim(), it = lineasTxt(m.el.querySelector('#lItems').value).map((x)=> x.slice(0, 200)), ve = lineasTxt(m.el.querySelector('#lVenc').value).map((x)=> x.slice(0, 60)).slice(0, 6);
    if (!nombre) { msg.textContent = 'Falta el nombre.'; return; }
    if (!it.length) { msg.textContent = 'Escribe al menos una pregunta.'; return; }
    if (it.length > 60 || it.join('\n').length > 5800) { msg.textContent = 'La lista es muy larga (máximo 60 preguntas). Divídela en dos listas.'; return; }
    const ico = (m.el.querySelector('#lIco button.on') || {}).dataset;
    const v = { nombre, icono: ico ? ico.v : '📋', frecuencia: m.el.querySelector('#lFrec').value, preoperacional: m.el.querySelector('#lPre').checked, reemplaza: d.reemplaza || '',
      activa: m.el.querySelector('#lAct') ? m.el.querySelector('#lAct').checked : true, items: it, vencimientos: ve, itemsTexto: it.join('\n'), vencimientosTexto: ve.join('\n') };
    msg.textContent = 'Guardando…';
    const r = await Registros.guardar('plantillainsp', d.id, Object.assign({}, d, v), d.nuevo ? 0 : d.version);
    if (typeof r === 'string') { msg.textContent = r; return; }
    m.cerrar(); UI.toast('✓ Lista guardada.'); await cargar(); if (alGuardar) { armarListas(); pintarCategorias(d.id); alGuardar(d.id); }
  });
}

/* ── Inventario desde Excel ── */
$('btnExcel').addEventListener('click', ()=> {
  const L = activas(), fr = Object.keys(FRECUENCIAS).map((k)=> [k, FRECUENCIAS[k].nombre]);
  const cols = [{ k: 'categoria', l: 'Categoría', req: true, tipo: 'lista', op: L.map((p)=> [p.id, p.nombre]), ej: 'Extintor', sin: ['tipo', 'lista'] },
    { k: 'codigo', l: 'Código', req: true, ej: 'EXT-01', sin: ['serial', 'codigo serial'] }, { k: 'nombre', l: 'Descripción', ej: 'Extintor PQS 20 lb', sin: ['nombre'] },
    { k: 'ubicacion', l: 'Ubicación', ej: 'Bodega, puerta norte', sin: ['ubicacion responsable'] }, { k: 'frecuencia', l: 'Frecuencia', tipo: 'lista', op: fr, ej: 'Mensual', vista: false },
    { k: 'activo', l: 'En uso', tipo: 'sino', def: true, ej: 'Sí', vista: false }];
  [1, 2, 3].forEach((i)=> { cols.push({ k: 'vq' + i, l: 'Vencimiento ' + i + ' (qué)', ej: i === 1 ? 'Recarga' : i === 2 ? 'Prueba hidrostática' : '', vista: false }); cols.push({ k: 'vf' + i, l: 'Vencimiento ' + i + ' (fecha)', tipo: 'fecha', ej: i === 1 ? '15/03/2027' : i === 2 ? '20/01/2030' : '', vista: false }); });
  const porCodigo = (c)=> equipos.find((x)=> Importar.norm(x.resumen.codigo) === Importar.norm(c));
  Importar.abrir({ titulo: 'Inventario de equipos y áreas desde Excel', archivo: 'inventario-equipos', columnas: cols, tipoDoc: 'equipo',
    validar: (f)=> { const p = pl(f.categoria), mal = [1, 2, 3].map((i)=> f['vq' + i]).filter((q)=> q && !(p.vencimientos || []).some((v)=> Importar.norm(v) === Importar.norm(q)));
      return mal.length ? 'En ' + p.nombre + ' no se controla «' + mal.join('», «') + '» (sí: ' + ((p.vencimientos || []).join(', ') || 'ninguna fecha') + ')' : ''; },
    id: (f)=> { const e = porCodigo(f.codigo); return e ? e.id : Importar.idDe('EQP', f.codigo); }, existe: (id)=> equipos.some((x)=> x.id === id),
    armar: (f, existe)=> { const p = pl(f.categoria), venc = {};
      [1, 2, 3].forEach((i)=> { const q = f['vq' + i]; if (q && f['vf' + i]) venc[(p.vencimientos || []).find((v)=> Importar.norm(v) === Importar.norm(q))] = f['vf' + i]; });
      const c = existe ? { categoria: f.categoria, codigo: f.codigo, nombre: f.nombre, ubicacion: f.ubicacion, frecuencia: f.frecuencia } : { categoria: f.categoria, codigo: f.codigo, nombre: f.nombre || p.nombre, ubicacion: f.ubicacion || '', frecuencia: f.frecuencia || p.frecuencia || 'mensual' };
      if (typeof f.activo === 'boolean' || !existe) c.activo = f.activo !== false;
      if (Object.keys(venc).length) c.vencimientos = venc; return c; },
    alTerminar: ()=> cargar() });
});

/* ── Navegación ── */
$('btnNuevoEq').addEventListener('click', ()=> abrirEquipo(null));
$('tabs').addEventListener('click', (e)=>{ const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach((x)=> x.classList.toggle('on', x === b)); pintar(); });
$('buscar').addEventListener('input', pintar);
document.addEventListener('click', (e)=>{
  const a = e.target.closest('[data-eq]'); if (a) { abrirEquipo(a.dataset.eq); return; }
  const i = e.target.closest('[data-insp]'); if (i) { verInspeccion(i.dataset.insp); return; }
  const c = e.target.closest('[data-cel]'); if (c) { const p = c.dataset.cel.split('|'); clicCronograma(p[0], Number(p[1])); return; }
  const fi = e.target.closest('[data-fila]'); if (fi) { clicCronograma(fi.dataset.fila, null); return; }
  if (e.target.closest('.screen.active [data-volver]')) { e.preventDefault(); show('scrLista'); pintar(); }
});
window.addEventListener('outbox-enviado', ()=> cargar());
/* Enlaces directos: #INS-… abre una inspección, #EQP-… un equipo, #ins=EQP-… (etiqueta QR) su inspección nueva. */
function abrirDesdeHash(){
  if (location.hash.length < 2) return;
  const id = decodeURIComponent(location.hash.slice(1)), q = /^ins=(EQP-[\w.-]+)$/.exec(id);
  if (q) { const e = equipos.find((x)=> x.id === q[1]); if (e) iniciarInspeccion(e.resumen.categoria, Object.assign({ id: e.id }, e.resumen)); else if (equipos.length) UI.toast('Ese equipo no está en el inventario de esta empresa.', 'mal'); }
  else if (/^INS-/.test(id)) verInspeccion(id); else if (/^EQP-/.test(id)) abrirEquipo(id); else if (id === 'cronograma' || id === 'listas') document.querySelector('#tabs [data-tab="' + id + '"]').click();
}
window.addEventListener('hashchange', abrirDesdeHash);
cargar().then(abrirDesdeHash);
