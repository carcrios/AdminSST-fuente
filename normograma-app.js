/* ============================================================
   normograma-app.js — Normograma dentro de la matriz legal (v180)
   ------------------------------------------------------------
   Antes era una página aparte; ahora es la vista «Normograma» de
   Documentos → Matriz legal (y normograma.html abre ahí). Cada requisito de la
   matriz legal con su evidencia AUTOMÁTICA del portal, el responsable, cuándo
   se revisó y si una fuente oficial publicó algo que pueda cambiarlo.
   ============================================================ */
const Normograma = (function () {
  const ESTILO =
    '.ng-t{width:100%;border-collapse:collapse;font-size:var(--fs-menor);}' +
    '.ng-t th,.ng-t td{border-bottom:1px solid var(--n-150);padding:6px;text-align:left;vertical-align:top;}' +
    '.ng-t th{font-size:var(--fs-etiqueta);text-transform:uppercase;color:var(--tenue,var(--ink-muted));}' +
    '.ng-wrap{overflow-x:auto;}' +
    '@media (max-width:700px){ .ng-t thead{display:none;}' +
    '.ng-t tr{display:block;border-bottom:2px solid var(--n-300);padding:6px 0;}' +
    '.ng-t td{display:block;border:0;padding:2px 0;}' +
    '.ng-t td::before{content:attr(data-l) \': \';font-weight:700;color:var(--tenue,var(--ink-muted));} }';
  let $ = (id) => document.getElementById(id);
  let rows = [],
    nov = [],
    esSst = false;
  const de = (t) => rows.filter((x) => x.tipo === t),
    hoy = UI.hoy(),
    anio = hoy.slice(0, 4),
    hace = (d) => Festivos.sumarDias(hoy, -d);
  const N = (t) =>
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  const req = (k) =>
    de('trabajador').filter(
      (x) => x.resumen.activo !== false && x.resumen.req && x.resumen.req[k] && (!x.resumen.req[k].vence || x.resumen.req[k].vence >= hoy),
    ).length;
  /** Evidencia del portal según el tema (o las palabras) de la norma: [texto, ok|pronto|mal, enlace]. */
  function evidencia(s) {
    const t = N([s.tema, s.norma, s.requisito].join(' '));
    const R = (txt, c, href) => [txt, c, href];
    if (/0312|sg-sst|1072|estandares/.test(t)) {
      const p = de('plananual').some((x) => String(x.resumen.anio) === anio),
        m = de('mes').filter((x) => String(x.resumen.mes).startsWith(anio)).length;
      return R((p ? 'Plan anual ' + anio : 'Sin plan anual ' + anio) + ' · ' + m + ' cierre(s) de mes', p && m ? 'ok' : 'pronto', 'evidencias.html');
    }
    if (/copasst|2013 de 1986/.test(t)) {
      const r = de('reunion').filter((x) => N(x.resumen.comite).includes('copasst') && String(x.resumen.fecha) >= hace(45));
      return R(r.length + ' reunión(es) del COPASST en 45 días', r.length ? 'ok' : 'mal', 'copasst.html');
    }
    if (/convivencia|1010|3461/.test(t)) {
      const r = de('reunion').filter((x) => N(x.resumen.comite).includes('convivencia') && String(x.resumen.fecha) >= hace(100));
      return R(r.length + ' reunión(es) de Convivencia en el trimestre', r.length ? 'ok' : 'mal', 'convivencia.html');
    }
    if (/1401|accidente|156 de 2005|furat/.test(t)) {
      const at = de('reporte').filter((x) => /Accidente|Incidente/.test(x.resumen.clase || '')),
        si = at.filter((x) => (x.resumen.investigacion || {}).estado === 'CERRADA');
      return R(
        si.length + ' de ' + at.length + ' eventos investigados',
        !at.length || si.length === at.length ? 'ok' : 'mal',
        'reportes.html?tab=investigaciones',
      );
    }
    if (/alturas|4272/.test(t)) {
      const n = req('alturas');
      return R(n + ' persona(s) con curso de alturas vigente', n ? 'ok' : 'pronto', 'habilitacion.html');
    }
    if (/confinad|0491/.test(t)) {
      const n = req('confinados');
      return R(n + ' persona(s) con curso de confinados vigente', n ? 'ok' : 'pronto', 'habilitacion.html');
    }
    if (/electric|retie|5018/.test(t)) {
      const n = req('electrico');
      return R(n + ' persona(s) competentes en riesgo eléctrico', n ? 'ok' : 'pronto', 'habilitacion.html');
    }
    if (/quimic|sga|1496|773/.test(t)) {
      const n = de('sustancia').length;
      return R(n + ' sustancia(s) en el inventario', n ? 'ok' : 'pronto', 'quimicos.html');
    }
    if (/emergencia|simulacro|1523/.test(t)) {
      const e = de('emergencia').length,
        s2 = de('simulacro').filter((x) => String(x.resumen.fecha).startsWith(anio)).length;
      return R((e ? 'Plan de emergencias' : 'Sin plan') + ' · ' + s2 + ' simulacro(s) en ' + anio, e && s2 ? 'ok' : 'mal', 'emergencias.html');
    }
    if (/medic|1843|examen/.test(t))
      return esSst
        ? R(de('examen').filter((x) => String(x.resumen.fecha) >= hace(365)).length + ' examen(es) en el último año', 'ok', 'salud.html')
        : R('Lo ve SST', '', '');
    if (/psicosocial|2646|2764/.test(t))
      return esSst
        ? R(de('psico').length ? 'Batería aplicada' : 'Sin batería registrada', de('psico').length ? 'ok' : 'mal', 'salud.html')
        : R('Lo ve SST', '', '');
    if (/capacita|induccion|4927/.test(t)) {
      const n = de('induccion').filter((x) => String(x.resumen.fecha || x.fecha) >= hace(365)).length;
      return R(n + ' inducción(es) en el último año', n ? 'ok' : 'pronto', 'induccion.html');
    }
    if (/epp|proteccion personal|dotacion|2400/.test(t)) {
      const n = de('entrega').filter((x) => String(x.resumen.fecha || x.fecha) >= hace(180)).length;
      return R(n + ' entrega(s) de EPP en 6 meses', n ? 'ok' : 'pronto', 'entrega-epp.html');
    }
    if (/peligro|gtc 45|riesgo/.test(t)) {
      const n = de('peligro').length;
      return R(n + ' peligro(s) valorados', n ? 'ok' : 'mal', 'peligros.html');
    }
    if (/inspecci/.test(t)) {
      const n = de('inspeccion').filter((x) => String(x.resumen.fecha) >= hace(90)).length;
      return R(n + ' inspección(es) en 90 días', n ? 'ok' : 'pronto', 'inspecciones.html');
    }
    return R(s.evidencia || 'Evidencia escrita a mano', s.evidencia ? 'ok' : 'pronto', '');
  }
  async function cargar() {
    if (UI.avisoServidor(document.createElement('div'))) return;
    const rol = Sesion.rol();
    esSst = !Sesion.modo() || ['admin', 'sst'].includes(rol);
    const r = await SGSST.listar(
      'legal,reunion,reporte,trabajador,sustancia,emergencia,simulacro,induccion,entrega,peligro,inspeccion,plananual,mes' + (esSst ? ',examen,psico' : ''),
    );
    rows = r.rows || [];
    try {
      const j = await SGSST.consultar({ action: 'novedadesNormas' });
      nov = (j && j.novedades) || [];
    } catch (e) {
      nov = [];
    }
    pintar();
  }
  function pintar() {
    const q = N($('ngQ').value),
      solo = $('ngSolo').checked;
    const l = de('legal')
      .filter((x) => x.resumen.vigente !== 'No')
      .map((x) => {
        const s = x.resumen,
          ev = evidencia(s),
          rev = s.proximaRevision && s.proximaRevision < hoy;
        const nn = N(s.norma)
            .replace(/de \d{4}/, '')
            .trim(),
          cambios = nov.filter((n) => nn.length > 6 && N(n.titulo).includes(nn));
        return { x, s, ev, rev, cambios, atencion: ev[1] === 'mal' || rev || cambios.length || s.cumple === 'No' };
      })
      .filter((y) => (!q || N([y.s.norma, y.s.tema, y.s.requisito, y.s.responsable].join(' ')).includes(q)) && (!solo || y.atencion));
    const todos = de('legal').length,
      at = l.filter((y) => y.atencion).length;
    $('ngK').innerHTML =
      '<div class="fx-s"><div class="n">Requisitos</div><div class="v">' +
      todos +
      '</div></div><div class="fx-s ' +
      (at ? 'mal' : 'ok') +
      '"><div class="n">Necesitan atención</div><div class="v">' +
      at +
      '</div></div>' +
      '<div class="fx-s ' +
      (nov.length ? 'pronto' : '') +
      '"><div class="n">Novedades en fuentes oficiales</div><div class="v">' +
      nov.length +
      '</div></div>';
    $('ngLista').innerHTML = !todos
      ? '<div class="empty">La matriz legal está vacía. Empiézala en la vista «Matriz» con «Cargar normas base».</div>'
      : l.length
        ? '<table class="ng-t"><thead><tr><th>Norma</th><th>Requisito</th><th>Evidencia del portal</th><th>Responsable</th><th>Revisión</th></tr></thead><tbody>' +
          l
            .map(
              (y) =>
                '<tr>' +
                '<td data-l="Norma"><b>' +
                esc(y.s.norma) +
                '</b>' +
                (y.s.articulos ? '<br><small>' + esc(y.s.articulos) + '</small>' : '') +
                (y.cambios.length
                  ? '<br><span class="chip pronto" title="' + esc(y.cambios.map((c) => c.titulo).join(' | ')) + '">Posible cambio</span>'
                  : '') +
                '</td>' +
                '<td data-l="Requisito">' +
                esc(y.s.requisito || y.s.tema || '') +
                '</td>' +
                '<td data-l="Evidencia">' +
                (y.ev[2] ? '<a href="' + esc(y.ev[2]) + '">' + esc(y.ev[0]) + '</a>' : esc(y.ev[0])) +
                (y.ev[1]
                  ? ' <span class="chip ' + y.ev[1] + '">' + (y.ev[1] === 'ok' ? 'Con evidencia' : y.ev[1] === 'mal' ? 'Sin evidencia' : 'Revisar') + '</span>'
                  : '') +
                '</td>' +
                '<td data-l="Responsable">' +
                esc(y.s.responsable || '—') +
                '</td>' +
                '<td data-l="Revisión">' +
                esc(y.s.fechaRevision ? UI.corta(y.s.fechaRevision) : 'Sin revisar') +
                (y.s.proximaRevision
                  ? '<br><small>' +
                    (y.rev ? '<b class="u-mal">Vencida: ' : 'Próxima: ') +
                    esc(UI.corta(y.s.proximaRevision)) +
                    (y.rev ? '</b>' : '') +
                    '</small>'
                  : '') +
                '</td></tr>',
            )
            .join('') +
          '</tbody></table>'
        : '<div class="empty">Nada con ese filtro.</div>';
  }

  /** Pinta el normograma dentro de «el» (con buscador y «solo lo que necesita atención»). */
  async function montar(el) {
    if (!document.getElementById('estiloNormograma')) {
      const st = document.createElement('style');
      st.id = 'estiloNormograma';
      st.textContent = ESTILO;
      document.head.appendChild(st);
    }
    el.innerHTML =
      '<div class="card"><div class="fx-sem" id="ngK"></div><div class="field u-mt8"><label for="ngQ">Buscar</label><input type="search" id="ngQ" data-no-ac placeholder="Ej.: alturas,' +
        ' 0312, COPASST"></div>' +
      '<label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" id="ngSolo"> Solo lo que necesita atención</label></div>' +
      '<div class="card"><div id="ngLista" class="ng-wrap"><div class="empty">Cargando…</div></div></div>' +
      '<p class="ayuda">La evidencia sale de los registros del portal (permisos, actas, inspecciones, exámenes…). «Posible cambio» se marca cuando una fuente oficial publicó algo sobre' +
        ' esa norma: revísala y actualiza la matriz.</p>';
    $ = (id) => el.querySelector('#' + id);
    $('ngQ').addEventListener('input', pintar);
    $('ngSolo').addEventListener('change', pintar);
    await cargar();
  }
  return { montar };
})();
