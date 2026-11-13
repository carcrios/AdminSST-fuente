/* ============================================================
   informe-mes.app.js — Informe mensual de actividades (v171)
   ------------------------------------------------------------
   Pide a cada servidor lo suyo (permisos, ATS, inspección de EPP, charlas y
   el SG-SST), lo junta para el mes elegido (informe-mes-reglas.js) y lo
   muestra con el PDF firmado para la gerencia o el cliente.
   Si un servidor no responde, su parte dice «sin datos» en vez de mostrar
   un cero que no es cierto.
   ============================================================ */
OfflineBanner.init();
if (typeof OutboxBadge !== 'undefined') OutboxBadge.init();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();
const $ = UI.$;
const IM = INFORME_MES;
const TIPOS_SG = 'reporte,inspeccion,induccion,entrega,preop,simulacro,reunion,accion';
let datos = null,
  mes = IM.porDefecto(UI.hoy()),
  R = null;

(function () {
  try {
    const v = new URLSearchParams(location.search).get('mes');
    if (/^\d{4}-\d{2}$/.test(v || '')) mes = v;
  } catch (e) {}
})();

const tok = () => '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN) + (SGSST._ses ? SGSST._ses() : '');
/** Lista de un servidor aparte; null si no está configurado o no respondió. */
async function lista(B, extra) {
  if (!B || !B.url || B.url.indexOf('http') !== 0) return null;
  try {
    const j = await (await fetchWithRetry(B.url + '?' + (extra || 'list=1') + tok())).json();
    return j && j.ok && Array.isArray(j.rows) ? j.rows : null;
  } catch (e) {
    return null;
  }
}

async function cargar() {
  if (UI.avisoServidor($('avisoSrv'))) {
    $('contenido').innerHTML = '';
    return;
  }
  $('btnAct').disabled = true;
  const B = PORTAL_CONFIG.BACKENDS || {};
  const pPerm = Promise.all(getPermitBackends(false).map(async (b) => ({ tipo: b.nombre, rows: await lista(b) })));
  const [r, permisos, ats, epp, charlas] = await Promise.all([SGSST.listar(TIPOS_SG), pPerm, lista(B.ats), lista(B.epp), lista(B.asistencia, 'list=1&limite=600')]);
  $('btnAct').disabled = false;
  UI.avisoCopia($('avisoCopia'), r);
  if (r.sinSesion) {
    $('contenido').innerHTML = '';
    return;
  }
  datos = { rows: r.rows || [], permisos, ats, epp, charlas };
  calcular();
}
function calcular() {
  if (!datos) return;
  try {
    history.replaceState(null, '', location.pathname + '?mes=' + mes);
  } catch (e) {}
  R = IM.calcular(Object.assign({ mes, hoy: UI.hoy() }, datos));
  pintar();
}

const sd = (v) => (v === null || v === undefined ? '—' : String(v));
function kpi(v, n, f, cl) {
  return '<div class="kpi ' + (cl || '') + '"><div class="v">' + esc(v) + '</div><div class="n">' + esc(n) + '</div>' + (f ? '<div class="f">' + esc(f) + '</div>' : '') + '</div>';
}
const tabla = (cab, filas) =>
  '<div class="tabla-scroll"><table class="im-t"><tr>' +
  cab.map((c) => '<th' + (c.charAt(0) === '#' ? ' class="n">' + esc(c.slice(1)) : '>' + esc(c)) + '</th>').join('') +
  '</tr>' +
  filas.map((f) => '<tr>' + f.map((c, i) => '<td' + (cab[i].charAt(0) === '#' ? ' class="n"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') +
  '</table></div>';
const sinDatos = (q) => '<p class="ayuda">Sin datos: el servidor de ' + esc(q) + ' no respondió o no está configurado.</p>';
const vacio = (t) => '<p class="ayuda">' + esc(t) + '</p>';

function pintar() {
  const p = R.permisos,
    e = R.eventos,
    i = R.inspecciones,
    f = R.formacion,
    q = R.epp,
    o = R.otros,
    a = R.acciones;
  $('btnPdf').disabled = false;
  $('contenido').innerHTML =
    (R.futuro ? '<div class="aviso amar">Ese mes todavía no empieza: las cifras salen en cero.</div>' : '') +
    (R.enCurso ? '<div class="aviso info">El mes está en curso: las cifras van hasta hoy.</div>' : '') +
    '<div class="card"><h2>Lo más importante · ' +
    esc(R.nombre) +
    '</h2><ul class="im-dest">' +
    IM.destacados(R)
      .map((t) => '<li>' + esc(t) + '</li>')
      .join('') +
    '</ul></div>' +
    '<div class="kpis">' +
    kpi(String(p.total), 'permisos de trabajo', p.ats !== null ? p.ats + ' ATS' : '') +
    kpi(String(e.accidentes), 'accidentes de trabajo', e.dias + ' días perdidos', e.accidentes ? 'mal' : 'ok') +
    kpi(String(e.incidentes), 'incidentes', e.actos + e.condiciones + ' actos y condiciones') +
    kpi(String(i.total), 'inspecciones', i.hallazgos + ' hallazgos', i.hallazgos ? '' : 'ok') +
    kpi(sd(f.charlas), 'charlas', f.asistentes !== null ? f.asistentes + ' asistencias' : 'sin datos') +
    kpi(sd(q.revisados), 'EPP revisados', q.conNovedad ? q.conNovedad + ' con novedad' : '') +
    kpi(String(q.entregas), 'entregas de EPP', q.unidades + ' elementos') +
    kpi(String(a.vencidas), 'acciones vencidas', a.abiertas + ' abiertas', a.vencidas ? 'mal' : 'ok') +
    '</div>' +
    // Permisos
    '<div class="card"><h2>Permisos de trabajo y ATS</h2>' +
    (p.tipos.length
      ? tabla(
          ['Tipo', '#Abiertos en el mes', '#Cerrados', '#Siguen abiertos'],
          p.tipos.map((t) => [t.tipo, t.sinDatos ? 'sin datos' : t.abiertos, t.sinDatos ? '' : t.cerrados, t.sinDatos ? '' : t.siguen]).concat([['Total', p.total, p.cerrados, p.siguen]]),
        )
      : vacio('Los permisos de trabajo no están activos en este portal.')) +
    (p.ats === null ? sinDatos('ATS') : '<p class="ayuda u-mt8">Análisis de trabajo seguro (ATS) del mes: <b>' + p.ats + '</b> · cerrados: ' + p.atsCerrados + '</p>') +
    '</div>' +
    // Accidentalidad
    '<div class="card"><h2>Accidentes, incidentes y reportes</h2>' +
    tabla(
      ['Clase', '#Reportes'],
      e.porClase.map((x) => [x.k, x.n]),
    ) +
    (e.lista.length
      ? '<h3 class="u-mt8">Accidentes e incidentes</h3>' +
        tabla(
          ['Fecha', 'Clase', 'Lugar', 'Qué pasó', '#Días'],
          e.lista.map((x) => [UI.corta(x.fecha), x.clase, x.lugar, x.descripcion, x.dias || '']),
        )
      : vacio('No se reportaron accidentes ni incidentes en el mes.')) +
    (e.sinInvestigar ? '<div class="aviso amar u-mt8">' + e.sinInvestigar + ' sin investigación cerrada.</div>' : '') +
    (e.sinFurat ? '<div class="aviso mal u-mt8">' + e.sinFurat + ' accidente(s) sin FURAT radicado.</div>' : '') +
    '</div>' +
    // Inspecciones
    '<div class="card"><h2>Inspecciones y hallazgos</h2>' +
    (i.total
      ? tabla(
          ['Categoría', '#Inspecciones'],
          i.porCategoria.map((x) => [x.k, x.n]),
        ) +
        '<p class="ayuda u-mt8">Conformes: <b>' +
        i.conformes +
        '</b> · No conformes: <b>' +
        i.noConformes +
        '</b> · Hallazgos: <b>' +
        i.hallazgos +
        '</b></p>' +
        i.lista
          .map(
            (x) =>
              '<div class="u-mt8"><b>' +
              esc(UI.corta(x.fecha) + ' · ' + x.que) +
              '</b>' +
              (x.lugar ? ' <span class="ayuda">(' + esc(x.lugar) + ')</span>' : '') +
              '<ul class="im-hz">' +
              x.items.map((t) => '<li>' + esc(t) + '</li>').join('') +
              (x.n > x.items.length ? '<li>… y ' + (x.n - x.items.length) + ' más</li>' : '') +
              '</ul></div>',
          )
          .join('')
      : vacio('No se registraron inspecciones en el mes.')) +
    '</div>' +
    // Formación
    '<div class="card"><h2>Charlas, inducciones y formación</h2>' +
    (f.charlas === null
      ? sinDatos('charlas (asistencia)')
      : '<p class="ayuda u-mt0">' +
        f.charlas +
        ' charlas en ' +
        f.semanas +
        ' semanas · ' +
        f.asistentes +
        ' asistencias firmadas</p>' +
        (f.temas.length ? '<ul class="im-chips">' + f.temas.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>' : vacio('Sin temas registrados.'))) +
    '<p class="ayuda u-mt8">Inducciones: <b>' +
    f.inducciones +
    '</b> · Reinducciones: <b>' +
    f.reinducciones +
    '</b>' +
    (f.horas ? ' · ' + f.horas + ' horas' : '') +
    '</p></div>' +
    // EPP
    '<div class="card"><h2>Elementos de protección personal (EPP)</h2>' +
    (q.revisados === null
      ? sinDatos('inspección de EPP')
      : '<p class="ayuda u-mt0">Revisados: <b>' +
        q.revisados +
        '</b> personas · con novedad: <b>' +
        q.conNovedad +
        '</b>' +
        (q.brigada ? ' · equipos de brigada revisados: ' + q.brigada : '') +
        '</p>' +
        (q.novedades.length
          ? tabla(
              ['Elemento con novedad', '#Veces'],
              q.novedades.slice(0, 15).map((x) => [x.k, x.n]),
            )
          : '')) +
    '<p class="ayuda u-mt8">Entregas: <b>' +
    q.entregas +
    '</b> a ' +
    q.personas +
    ' personas · por reposición: ' +
    q.porReposicion +
    (q.sinCapacitar ? ' · <b class="u-mal">' + q.sinCapacitar + ' sin capacitación en el uso</b>' : '') +
    '</p>' +
    (q.elementos.length
      ? tabla(
          ['Elemento entregado', '#Cantidad'],
          q.elementos.map((x) => [x.k, x.n]),
        )
      : '') +
    '</div>' +
    // Otros
    '<div class="card"><h2>Otras actividades del mes</h2>' +
    tabla(
      ['Actividad', '#Cantidad'],
      [
        ['Preoperacionales diligenciados', o.preop],
        ['Preoperacionales con novedad', o.preopNovedad],
        ['Simulacros', o.simulacros],
      ]
        .concat(o.reuniones.map((x) => ['Reuniones · ' + x.k, x.n]))
        .concat([
          ['Acciones nuevas en el plan de acción', a.nuevas],
          ['Acciones cerradas', a.cerradas],
          ['Acciones abiertas al final del mes', a.abiertas],
          ['Acciones vencidas', a.vencidas],
        ]),
    ) +
    '</div>';
}

/* ── PDF ── */
const tPdf = (cab, filas) =>
  '<table><tr>' +
  cab.map((c) => '<th>' + esc(c) + '</th>').join('') +
  '</tr>' +
  filas.map((f) => '<tr>' + f.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
  '</table>';
function pdf() {
  const p = R.permisos,
    e = R.eventos,
    i = R.inspecciones,
    f = R.formacion,
    q = R.epp,
    o = R.otros,
    a = R.acciones;
  const hz = i.lista.map((x) => [UI.corta(x.fecha), x.que + (x.lugar ? ' (' + x.lugar + ')' : ''), x.items.join(' · ')]);
  UI.imprimir([
    UI.cabecera('SG-INFORME-MES', 'INFORME MENSUAL DE ACTIVIDADES DEL SG-SST', IM.nombreMes(R.mes).replace(/^./, (c) => c.toUpperCase()) + ' · ' + (EMPRESA.nombre || '')) +
      '<h3>Lo más importante</h3><ul>' +
      IM.destacados(R)
        .map((t) => '<li>' + esc(t) + '</li>')
        .join('') +
      '</ul>' +
      '<h3>1. Permisos de trabajo y ATS</h3>' +
      tPdf(
        ['Tipo', 'Abiertos', 'Cerrados', 'Siguen abiertos'],
        p.tipos
          .map((t) => [t.tipo, t.sinDatos ? 'sin datos' : t.abiertos, t.sinDatos ? '' : t.cerrados, t.sinDatos ? '' : t.siguen])
          .concat(p.ats === null ? [] : [['ATS', p.ats, p.atsCerrados, p.ats - p.atsCerrados]]),
      ) +
      '<h3>2. Accidentes, incidentes y reportes</h3>' +
      tPdf(
        ['Accidentes', 'Días perdidos', 'Incidentes', 'Actos inseguros', 'Condiciones inseguras'],
        [[e.accidentes, e.dias, e.incidentes, e.actos, e.condiciones]],
      ) +
      (e.lista.length
        ? tPdf(
            ['Fecha', 'Clase', 'Lugar', 'Qué pasó', 'Días'],
            e.lista.map((x) => [UI.corta(x.fecha), x.clase, x.lugar, x.descripcion, x.dias || '']),
          )
        : '') +
      '<h3>3. Inspecciones y hallazgos</h3>' +
      tPdf(
        ['Inspecciones', 'Conformes', 'No conformes', 'Hallazgos'],
        [[i.total, i.conformes, i.noConformes, i.hallazgos]],
      ) +
      (hz.length ? tPdf(['Fecha', 'Inspección', 'Hallazgos'], hz) : '') +
      '<h3>4. Charlas, inducciones y formación</h3>' +
      tPdf(
        ['Charlas', 'Asistencias', 'Inducciones', 'Reinducciones'],
        [[sd(f.charlas), sd(f.asistentes), f.inducciones, f.reinducciones]],
      ) +
      (f.temas.length ? '<p><b>Temas:</b> ' + esc(f.temas.join(' · ')) + '</p>' : '') +
      '<h3>5. Elementos de protección personal</h3>' +
      tPdf(
        ['EPP revisados', 'Con novedad', 'Entregas', 'Personas', 'Elementos entregados'],
        [[sd(q.revisados), sd(q.conNovedad), q.entregas, q.personas, q.unidades]],
      ) +
      (q.elementos.length ? '<p><b>Entregado:</b> ' + esc(q.elementos.map((x) => x.n + ' × ' + x.k).join(' · ')) + '</p>' : '') +
      (q.novedades.length ? '<p><b>Novedades en la revisión:</b> ' + esc(q.novedades.map((x) => x.k + ' (' + x.n + ')').join(' · ')) + '</p>' : '') +
      '<h3>6. Otras actividades y plan de acción</h3>' +
      tPdf(
        ['Preoperacionales', 'Con novedad', 'Simulacros', 'Reuniones de comités', 'Acciones nuevas', 'Cerradas', 'Vencidas'],
        [[o.preop, o.preopNovedad, o.simulacros, o.reuniones.reduce((s, x) => s + x.n, 0), a.nuevas, a.cerradas, a.vencidas]],
      ) +
      '<p style="font-size:10px;margin-top:8px">Fuente: registros del Portal SSTA. Corte: ' +
      esc(UI.corta(UI.hoy())) +
      '.</p>' +
      '<table style="margin-top:28px"><tr><td style="height:60px;vertical-align:bottom">_________________________<br>Responsable del SG-SST</td>' +
      '<td style="vertical-align:bottom">_________________________<br>Recibido: gerencia / cliente</td></tr></table>',
  ]);
}

$('selMes').innerHTML = IM.opciones(UI.hoy())
  .map((x) => '<option value="' + esc(x.v) + '"' + (x.v === mes ? ' selected' : '') + '>' + esc(x.t) + '</option>')
  .join('');
$('selMes').addEventListener('change', () => {
  mes = $('selMes').value;
  calcular();
});
$('btnAct').addEventListener('click', cargar);
$('btnPdf').addEventListener('click', pdf);
cargar();
