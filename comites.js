/* ============================================================
   comites.js — COPASST y Comité de Convivencia Laboral
   ------------------------------------------------------------
   Lo común a los dos comités (lo usan copasst.html y convivencia.html):
     · Conformación por periodos de 2 años, con la cantidad de integrantes
       que pide la norma según el número de trabajadores.
     · Calendario de reuniones ordinarias (una por mes) y actas con
       asistencia, quórum (mitad más uno), firmas y compromisos.
     · Los compromisos van al plan de acción único.
     · Capacitaciones del comité (estándar 1.1.7 de la Res. 0312).
   Las quejas de convivencia NO pasan por aquí: van cifradas (convivencia.html).
   ============================================================ */
const Comite = (function () {
  const $ = UI.$;
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  let C = null;                 // configuración del comité (ver copasst.html / convivencia.html)
  let comite = null;            // fila de la lista (resumen)
  let reuniones = [], acciones = [], tab = 'reuniones';
  let acta = null, compNuevos = [], conf = null;
  /* v109: las cifras de arriba dejan la lista filtrada. Una pestaña extra (p. ej. Quejas) puede traer su propio `filtrar`. */
  let fComp = '';
  window.filtrarKpi = (v) => { const extra = (C.tabsExtra || []).find((t) => t.id === tab); if (extra && extra.filtrar) { extra.filtrar(v || ''); return; } fComp = v || ''; pintar(); };

  /* ── Reglas de conformación ── */
  const REGLAS = {
    // Res. 2013 de 1986, art. 2 (periodo de 2 años: Decreto 1295 de 1994, art. 63)
    copasst: (t) => {
      if (!t) return null;
      if (t < 10) return { porParte: 0, vigia: true, texto: 'Menos de 10 trabajadores: no se conforma COPASST sino un Vigía de SST (con su suplente).' };
      const n = t < 50 ? 1 : t < 500 ? 2 : t < 1000 ? 3 : 4;
      return { porParte: n, suplentes: true, texto: t + ' trabajadores: ' + n + ' representante' + (n > 1 ? 's' : '') + ' del empleador y ' + n + ' de los trabajadores, cada uno con su suplente (Res. 2013 de 1986, art. 2).' };
    },
    // Res. 3461 de 2025, art. 3
    convivencia: (t) => {
      if (!t) return null;
      if (t < 5) return { porParte: 1, suplentes: false, texto: 'Menos de 5 trabajadores: 1 representante del empleador y 1 de los trabajadores (Res. 3461 de 2025, art. 3).' };
      const n = t < 20 ? 1 : 2;
      return { porParte: n, suplentes: true, texto: t + ' trabajadores: ' + n + ' representante' + (n > 1 ? 's' : '') + ' del empleador y ' + n + ' de los trabajadores, todos con suplente (Res. 3461 de 2025, art. 3).' };
    }
  };

  function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
  const anio = () => UI.hoy().slice(0, 4);
  const periodo = () => (comite && comite.resumen && comite.resumen.periodo) || null;
  const vigente = () => { const p = periodo(); return p && (!p.fin || p.fin >= UI.hoy()); };
  const delComite = (r) => r.resumen && r.resumen.comite === C.clave;
  function sumarAnios(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + n); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

  /* ── Pantallas ── */
  function montar() {
    $('raizComite').innerHTML =
      '<div class="screen active" id="scrInicio"><div class="hdr"><a class="back" href="index.html">← Volver al portal</a>' +
      '<div class="marca-titulo"><span class="marca" role="img" aria-label="Logo de la empresa"></span><div><div class="eyebrow">Gestión SST · Comités</div>' +
      '<h1 id="tituloComite">' + esc(C.nombre) + '</h1><p>' + esc(C.subtitulo) + '</p></div></div></div>' +
      '<div id="avisoSrv"></div><div id="avisoCopia"></div><div id="alertas"></div><div class="kpis" id="kpis"></div>' +
      '<div class="tabs" id="tabs"><button type="button" class="on" data-tab="reuniones">Reuniones</button><button type="button" data-tab="conformacion">Conformación</button>' +
      '<button type="button" data-tab="compromisos">Compromisos <span class="n" id="nComp">0</span></button>' +
      (C.tabsExtra || []).map((t) => '<button type="button" data-tab="' + t.id + '">' + esc(t.nombre) + '</button>').join('') + '</div>' +
      '<div id="panel"><div class="empty">Cargando…</div></div><div class="version-portal">Portal SSTA · versión v109</div></div>' +
      '<div class="screen" id="scrActa"></div><div class="screen" id="scrConf"></div>' + (C.pantallasExtra || '');
    $('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); pintar(); });
    document.addEventListener('click', (e) => { const v = e.target.closest('[data-volver]'); if (v) { e.preventDefault(); show('scrInicio'); pintar(); } });
  }

  async function cargar() {
    if (UI.avisoServidor($('avisoSrv'))) { $('panel').innerHTML = ''; return; }
    const [rc, rr, ra] = await Promise.all([SGSST.listar('comite'), SGSST.listar('reunion'), SGSST.listar('accion')]);
    UI.avisoCopia($('avisoCopia'), rc.desdeCopia ? rc : rr);
    comite = rc.rows.find((x) => x.id === C.id) || null;
    reuniones = rr.rows.filter(delComite).sort((a, b) => String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
    acciones = ra.rows.filter((x) => x.resumen && x.resumen.origen === C.origen);
    const r = (C.regla || REGLAS[C.clave])(comite && comite.resumen.trabajadores);
    if (r && r.vigia && C.clave === 'copasst') { $('tituloComite').textContent = 'Vigía de SST'; }
    if (C.alCargar) await C.alCargar({ comite, reuniones, acciones });
    pintar();
  }

  function pintar() {
    const p = periodo(), h = UI.hoy(), a = anio();
    const ord = reuniones.filter((x) => x.resumen.tipo === 'Ordinaria' && String(x.resumen.fecha).slice(0, 4) === a);
    const mesesHechos = new Set(ord.map((x) => String(x.resumen.fecha).slice(5, 7)));
    const mesesCorridos = Number(h.slice(5, 7));
    const ab = acciones.filter((x) => x.estado !== 'CERRADA'), ve = ab.filter((x) => x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < h);
    $('nComp').textContent = ab.length;
    $('kpis').innerHTML =
      '<div class="kpi ' + (!p ? 'mal' : vigente() ? (UI.semaforo(p.fin, 45) === 'pronto' ? '' : 'ok') : 'mal') + '" data-ir="tab:conformacion"><div class="v">' + (!p ? '—' : vigente() ? '✓' : '✗') + '</div><div class="n">' +
        (!p ? 'sin conformar' : vigente() ? 'periodo vigente' : 'periodo vencido') + '</div>' + (p && p.fin ? '<div class="f">hasta ' + esc(UI.corta(p.fin)) + '</div>' : '') + '</div>' +
      (C.trimestral ? (()=> { const tri = new Set([...mesesHechos].map((m) => Math.ceil(Number(m) / 3))), tc = Math.ceil(mesesCorridos / 3);
          return '<div class="kpi ' + (tri.size >= tc - 1 ? 'ok' : 'mal') + '" data-ir="tab:reuniones"><div class="v">' + tri.size + ' / ' + tc + '</div><div class="n">trimestres con reunión ordinaria en ' + a + '</div></div>'; })()
        : '<div class="kpi ' + (mesesHechos.size >= mesesCorridos - (Number(h.slice(8, 10)) < 25 ? 1 : 0) ? 'ok' : 'mal') + '" data-ir="tab:reuniones"><div class="v">' + mesesHechos.size + ' / ' + mesesCorridos + '</div><div class="n">meses con reunión ordinaria en ' + a + '</div></div>') +
      '<div class="kpi" data-ir="tab:compromisos|filtro:abiertos"><div class="v">' + ab.length + '</div><div class="n">compromisos abiertos</div></div>' +
      '<div class="kpi ' + (ve.length ? 'mal' : 'ok') + '" data-ir="tab:compromisos|filtro:' + (ve.length ? 'vencidos' : 'abiertos') + '"><div class="v">' + ve.length + '</div><div class="n">compromisos vencidos</div></div>';
    const alertas = [];
    if (!p) alertas.push('<div class="aviso">El ' + esc(C.corto) + ' no está conformado en el portal. Ve a <b>Conformación</b> y registra a sus integrantes.</div>');
    else if (!vigente()) alertas.push('<div class="aviso">El periodo venció el ' + esc(UI.corta(p.fin)) + '. Hay que hacer la elección y registrar el nuevo periodo.</div>');
    else if (UI.semaforo(p.fin, 45) === 'pronto') alertas.push('<div class="aviso amar">El periodo vence el ' + esc(UI.corta(p.fin)) + ' (' + esc(UI.cuandoTexto(p.fin)) + '): organiza la elección.</div>');
    if (C.alertas) alertas.push.apply(alertas, C.alertas({ comite, reuniones, acciones }) || []);
    $('alertas').innerHTML = alertas.join('');
    const panel = $('panel');
    if (tab === 'reuniones') return pintarReuniones(panel, mesesHechos);
    if (tab === 'conformacion') return pintarConformacion(panel);
    if (tab === 'compromisos') return pintarCompromisos(panel);
    const extra = (C.tabsExtra || []).find((t) => t.id === tab);
    if (extra) extra.pintar(panel);
  }

  function pintarReuniones(panel, mesesHechos) {
    const h = UI.hoy(), mesHoy = Number(h.slice(5, 7));
    const triHoy = Math.ceil(mesHoy / 3);
    const cal = C.trimestral ? ['Ene – Mar', 'Abr – Jun', 'Jul – Sep', 'Oct – Dic'].map((t, i) => {
      const hecho = [1, 2, 3].some((k) => mesesHechos.has(('0' + (i * 3 + k)).slice(-2))), c = hecho ? 'ok' : (i + 1 < triHoy ? 'mal' : i + 1 === triHoy ? 'pronto' : 'gris');
      return '<div class="mes ' + c + '"><b>' + t + '</b><span>' + (hecho ? '✓' : (i + 1 < triHoy ? 'Falta' : i + 1 === triHoy ? 'Este trimestre' : '')) + '</span></div>';
    }).join('') : MESES.map((m, i) => {
      const mm = ('0' + (i + 1)).slice(-2), hecho = mesesHechos.has(mm);
      const c = hecho ? 'ok' : (i + 1 < mesHoy ? 'mal' : i + 1 === mesHoy ? 'pronto' : 'gris');
      return '<div class="mes ' + c + '"><b>' + m + '</b><span>' + (hecho ? '✓' : (i + 1 < mesHoy ? 'Falta' : i + 1 === mesHoy ? 'Este mes' : '')) + '</span></div>';
    }).join('');
    panel.innerHTML = '<div class="acciones-top"><button type="button" class="btn amber" id="btnOrd">+ Reunión ordinaria</button><button type="button" class="btn ghost" id="btnExt">+ Reunión extraordinaria</button>' + (C.clave === 'copasst' ? '<button type="button" class="btn rojo" id="btnRiesgo">⚠ Riesgo inminente / accidente grave</button>' : '') + '</div>' +
      '<div class="card"><h2>Reuniones ordinarias ' + anio() + '</h2><div class="calendario' + (C.trimestral ? ' tri' : '') + '">' + cal + '</div>' +
      '<p class="ayuda">' + esc(C.ayudaReuniones) + '</p></div>' +
      (C.avisoActa ? '<div class="aviso info">' + C.avisoActa + '</div>' : '') +
      (reuniones.length ? reuniones.map((x) => {
        const s = x.resumen;
        return '<button type="button" class="item ' + (s.quorum ? 'ok' : 'pronto') + '" data-acta="' + esc(x.id) + '"><div class="fila"><div><div class="t">Acta ' + esc(s.numero) + ' · ' + esc(s.tipo) + '</div>' +
          '<div class="m">📅 ' + esc(UI.corta(s.fecha)) + (s.lugar ? ' · ' + esc(s.lugar) : '') + ' · ' + s.asistentes + ' de ' + s.convocados + ' asistentes' + (s.compromisos ? ' · ' + s.compromisos + ' compromiso(s)' : '') +
          (x.pendiente ? ' · <span class="pend">⏳ pendiente de enviar</span>' : '') + '</div>' + (s.motivo ? '<div class="m">Motivo: ' + esc(s.motivo) + '</div>' : '') + '</div>' +
          '<span class="chip ' + (s.quorum ? 'ok' : 'pronto') + '">' + (s.quorum ? 'Con quórum' : 'Sin quórum') + '</span></div></button>';
      }).join('') : '<div class="empty">Aún no hay actas registradas.</div>');
    panel.querySelectorAll('[data-acta]').forEach((b) => b.addEventListener('click', () => abrirActa(b.dataset.acta)));
    $('btnOrd').addEventListener('click', () => nuevaActa('Ordinaria'));
    $('btnExt').addEventListener('click', () => nuevaActa('Extraordinaria'));
    if ($('btnRiesgo')) $('btnRiesgo').addEventListener('click', () => nuevaActa('Extraordinaria', { riesgo: true }));
  }

  function pintarCompromisos(panel) {
    const h = UI.hoy(), abiertos = (x) => x.estado !== 'CERRADA', vencidos = (x) => abiertos(x) && x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < h;
    const l = acciones.filter((x) => fComp === 'abiertos' ? abiertos(x) : fComp === 'vencidos' ? vencidos(x) : true).sort((a, b) => (a.estado === 'CERRADA') - (b.estado === 'CERRADA') || String(a.resumen.fechaCompromiso).localeCompare(String(b.resumen.fechaCompromiso)));
    panel.innerHTML = (acciones.length ? UI.chipsFiltro([['', 'Todos (' + acciones.length + ')'], ['abiertos', 'Abiertos (' + acciones.filter(abiertos).length + ')'], ['vencidos', 'Vencidos (' + acciones.filter(vencidos).length + ')']], fComp) : '') + (l.length ? l.map((x) => {
      const s = x.resumen, c = x.estado === 'CERRADA' ? 'ok' : UI.semaforo(s.fechaCompromiso, 5);
      return '<a class="item ' + c + '" href="plan-accion.html#' + encodeURIComponent(x.id) + '"><div class="fila"><div><div class="t">' + esc(s.accion) + '</div><div class="m">👤 ' + esc(s.responsable) + (s.origenRef ? ' · ' + esc(s.origenRef) : '') + '</div></div>' +
        '<span class="chip ' + c + '">' + (x.estado === 'CERRADA' ? 'Cerrada' : (s.fechaCompromiso < h ? 'Venció ' : '') + esc(UI.corta(s.fechaCompromiso))) + '</span></div></a>';
    }).join('') : '<div class="empty">' + (acciones.length ? 'Ningún compromiso en este filtro ✓' : 'Los compromisos que se escriban en las actas aparecen aquí y en el plan de acción.') + '</div>') +
      '<a class="btn ghost" href="plan-accion.html">Abrir el plan de acción</a>';
    panel.querySelectorAll('.filtro-kpi [data-f]').forEach((b) => b.addEventListener('click', () => { fComp = b.dataset.f; pintar(); }));
  }

  /* ── Conformación ── */
  function pintarConformacion(panel) {
    const p = periodo(), t = comite && comite.resumen.trabajadores, regla = (C.regla || REGLAS[C.clave])(t);
    const ms = (p && p.miembros) || [];
    const cuenta = (rep, cal) => ms.filter((m) => m.representa === rep && m.calidad === cal).length;
    let chequeo = '';
    if (regla && p && !regla.sinConteo) {
      const falta = [];
      if (regla.vigia) { if (!ms.length) falta.push('el vigía'); }
      else ['Empleador', 'Trabajadores'].forEach((rep) => {
        if (cuenta(rep, 'Principal') < regla.porParte) falta.push((regla.porParte - cuenta(rep, 'Principal')) + ' principal(es) de ' + rep.toLowerCase());
        if (regla.suplentes && cuenta(rep, 'Suplente') < regla.porParte) falta.push((regla.porParte - cuenta(rep, 'Suplente')) + ' suplente(s) de ' + rep.toLowerCase());
      });
      chequeo = falta.length ? '<div class="aviso amar">Según la norma faltan: ' + esc(falta.join(', ')) + '.</div>' : '<div class="aviso ok">✓ La conformación cumple con el número de integrantes.</div>';
    }
    panel.innerHTML = '<div class="card"><h2>Periodo actual</h2>' + (p ?
      '<div class="dato"><span>Periodo</span><b>' + esc(UI.corta(p.inicio)) + ' a ' + esc(UI.corta(p.fin)) + '</b></div>' +
      '<div class="dato"><span>Trabajadores de la empresa</span><b>' + esc(t || '—') + '</b></div>' +
      (regla ? '<p class="ayuda u-mt8">' + esc(regla.texto) + '</p>' : '') + chequeo +
      '<table class="tabla"><tr><th>Integrante</th><th>Representa</th><th>Calidad</th></tr>' + ms.map((m) => '<tr><td><b>' + esc(m.nombre) + '</b>' + (m.rol && m.rol !== 'Integrante' ? ' <span class="chip azul">' + esc(m.rol) + '</span>' : '') +
        '<br><small>' + esc(m.cargo || '') + '</small></td><td>' + esc(m.representa) + '</td><td>' + esc(m.calidad) + '</td></tr>').join('') + '</table>'
      : '<div class="empty">Sin conformar. Registra el periodo y sus integrantes.</div>') +
      '<div class="fila-btn">' + (p ? '<button type="button" class="btn ghost" id="btnEditConf">✏️ Corregir este periodo</button>' : '') +
      '<button type="button" class="btn ' + (p ? 'ghost' : 'amber') + '" id="btnNuevoPer">' + (p ? '🗳️ Nuevo periodo (nueva elección)' : '+ Registrar conformación') + '</button></div>' +
      (p ? '<button type="button" class="btn ghost" id="btnPdfConf">🖨️ PDF de la conformación</button>' : '') + '</div>' +
      '<div class="card"><h2>Capacitaciones del comité</h2><div id="listaCap"><div class="status-msg">Cargando…</div></div>' +
      '<button type="button" class="btn ghost" id="btnCap">+ Registrar capacitación</button><p class="ayuda u-mt8">' + esc(C.ayudaCapacitacion) + '</p></div>' +
      (C.conformacionExtra ? C.conformacionExtra() : '');
    if ($('btnEditConf')) $('btnEditConf').addEventListener('click', () => editarConformacion(false));
    $('btnNuevoPer').addEventListener('click', () => editarConformacion(true));
    if ($('btnPdfConf')) $('btnPdfConf').addEventListener('click', pdfConformacion);
    $('btnCap').addEventListener('click', nuevaCapacitacion);
    if (C.alPintarConformacion) C.alPintarConformacion(panel);
    pintarCapacitaciones();
  }
  async function docComite() { return comite ? await SGSST.doc(C.id) : null; }
  async function pintarCapacitaciones() {
    const el = $('listaCap'); if (!el) return;
    if (!comite) { el.innerHTML = '<div class="m u-nota">Sin registros.</div>'; return; }
    const d = await docComite();
    const l = ((d && d.capacitaciones) || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    if (!$('listaCap')) return;
    $('listaCap').innerHTML = l.length ? '<table class="tabla"><tr><th>Fecha</th><th>Tema</th><th>Horas</th></tr>' + l.map((c) => '<tr><td>' + esc(UI.corta(c.fecha)) + '</td><td>' + esc(c.tema) + (c.entidad ? '<br><small>' + esc(c.entidad) + '</small>' : '') + '</td><td>' + esc(c.horas || '') + '</td></tr>').join('') + '</table>'
      : '<div class="m" style="font-size:var(--fs-base);color:var(--muted);margin-bottom:6px;">Sin capacitaciones registradas.</div>';
  }
  function nuevaCapacitacion() {
    const m = UI.modal('<h3>Capacitación del comité</h3><div class="grid2"><div class="field"><label>Fecha</label><input type="date" id="cpF" value="' + UI.hoy() + '"></div>' +
      '<div class="field"><label>Horas</label><input type="number" id="cpH" min="0" step="0.5" value="2"></div></div>' +
      '<div class="field"><label>Tema</label><input type="text" id="cpT" placeholder="' + esc(C.ejemploCapacitacion) + '"></div>' +
      '<div class="field"><label>Quién la dio</label><input type="text" id="cpE" placeholder="Ej: ARL, responsable del SG-SST"></div>' +
      '<button type="button" class="btn amber" id="cpOk">Guardar</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button>');
    m.el.querySelector('#cpOk').addEventListener('click', async () => {
      const v = (id) => m.el.querySelector(id).value.trim();
      if (!v('#cpT')) { UI.toast('Escribe el tema.', 'mal'); return; }
      const cap = { uid: SGSST.nuevoOpId(), fecha: v('#cpF'), tema: v('#cpT'), horas: v('#cpH'), entidad: v('#cpE') };
      const r = await SGSST.enviar({ action: 'parche', tipo: 'comite', id: C.id, campos: { comite: C.clave }, agregar: { capacitaciones: [cap] } });
      if (!r.ok) { UI.toast(Errores.texto('guardó', r), 'mal'); return; }
      m.cerrar(); UI.toast(r.enCola ? '⏳ Guardada en el equipo.' : '✓ Capacitación registrada.'); cargar();
    });
  }

  async function editarConformacion(nuevo) {
    const leido = await docComite();
    if (comite && (!leido || !leido.version)) { UI.toast('Sin conexión no se puede editar la conformación (se perdería el historial). Inténtalo con señal.', 'mal'); return; }
    const d = leido || { comite: C.clave, periodos: [] };
    const per = !nuevo && d.periodos && d.periodos.length ? JSON.parse(JSON.stringify(d.periodos[d.periodos.length - 1])) : { uid: SGSST.nuevoOpId(), inicio: UI.hoy(), fin: Festivos.sumarDias(sumarAnios(UI.hoy(), 2), -1), fechaEleccion: '', mecanismo: '', miembros: [] };
    if (nuevo && d.periodos && d.periodos.length) {
      // Se precargan los integrantes del periodo anterior para no escribirlos todos.
      per.miembros = JSON.parse(JSON.stringify(d.periodos[d.periodos.length - 1].miembros || [])).map((m) => Object.assign(m, C.clave === 'convivencia' ? { confidencialidad: false, inhabilidad: false } : {}));
    }
    conf = { d, per, nuevo };
    const s = $('scrConf');
    s.innerHTML = '<div class="hdr"><a class="back" href="#" data-volver>← Volver</a><div class="eyebrow">' + esc(C.nombre) + '</div><h1>' + (nuevo ? 'Nuevo periodo' : 'Corregir periodo') + '</h1><p>Integrantes y periodo de 2 años</p></div>' +
      '<div class="card"><div class="field"><label>Número de trabajadores de la empresa</label><input type="number" id="cfTrab" min="1" value="' + esc(d.trabajadores || '') + '"><div class="ayuda" id="cfRegla"></div></div>' +
      '<div class="grid2"><div class="field"><label>Inicio del periodo</label><input type="date" id="cfIni" value="' + esc(per.inicio) + '"><div class="ayuda">Fecha de comunicación de la conformación.</div></div>' +
      '<div class="field"><label>Fin del periodo</label><input type="date" id="cfFin" value="' + esc(per.fin) + '"><div class="ayuda">2 años.</div></div></div>' +
      '<div class="grid2"><div class="field"><label>Fecha de la elección</label><input type="date" id="cfElec" value="' + esc(per.fechaEleccion || '') + '"></div>' +
      '<div class="field"><label>Cómo se eligió a los trabajadores</label><select id="cfMec"><option>Votación secreta de los trabajadores</option><option>Votación virtual</option><option>Aclamación (único candidato)</option><option>Otro</option></select></div></div>' +
      '<p class="ayuda">' + esc(C.ayudaConformacion) + '</p></div>' +
      '<div class="card"><h2>Integrantes</h2><div id="cfMiembros"></div><button type="button" class="btn ghost" id="cfAdd">+ Agregar integrante</button></div>' +
      '<button type="button" class="btn amber" id="cfGuardar">Guardar conformación</button><div class="status-msg" id="cfMsg"></div>';
    if (per.mecanismo) $('cfMec').value = per.mecanismo;
    const regla = () => { const r = (C.regla || REGLAS[C.clave])(Number($('cfTrab').value)); $('cfRegla').textContent = r ? r.texto : ''; };
    $('cfTrab').addEventListener('input', regla); regla();
    $('cfIni').addEventListener('change', () => { if ($('cfIni').value) $('cfFin').value = sumarAnios($('cfIni').value, 2); });
    $('cfAdd').addEventListener('click', () => { leerMiembros(); conf.per.miembros.push({ nombre: '', cedula: '', cargo: '', representa: 'Trabajadores', calidad: 'Principal', rol: 'Integrante' }); pintarMiembros(); });
    $('cfGuardar').addEventListener('click', guardarConformacion);
    if (!per.miembros.length) per.miembros.push({ nombre: '', cedula: '', cargo: '', representa: 'Empleador', calidad: 'Principal', rol: 'Presidente' });
    pintarMiembros();
    show('scrConf');
  }
  function pintarMiembros() {
    const extra = C.clave === 'convivencia';
    $('cfMiembros').innerHTML = conf.per.miembros.map((m, i) => '<div class="miembro" data-i="' + i + '">' +
      '<div class="field"><label>Nombre</label><input type="text" data-k="nombre" value="' + esc(m.nombre) + '" placeholder="Escribe para buscar"></div>' +
      '<div class="grid2"><div class="field"><label>Cédula</label><input type="text" data-k="cedula" inputmode="numeric" value="' + esc(m.cedula || '') + '"></div>' +
      '<div class="field"><label>Cargo</label><input type="text" data-k="cargo" value="' + esc(m.cargo || '') + '"></div></div>' +
      '<div class="grid3"><div class="field"><label>Representa</label><select data-k="representa"><option>Empleador</option><option>Trabajadores</option></select></div>' +
      '<div class="field"><label>Calidad</label><select data-k="calidad"><option>Principal</option><option>Suplente</option></select></div>' +
      '<div class="field"><label>Rol</label><select data-k="rol"><option>Integrante</option><option>Presidente</option><option>Secretario</option>' + (C.clave === 'copasst' ? '<option>Vigía</option>' : '') + '</select></div></div>' +
      (extra ? '<label class="check"><input type="checkbox" data-k="confidencialidad"' + (m.confidencialidad ? ' checked' : '') + '> Firmó el acuerdo de confidencialidad</label>' +
        '<label class="check"><input type="checkbox" data-k="inhabilidad"' + (m.inhabilidad ? ' checked' : '') + '> Declaró no haber sido denunciado ni víctima de acoso laboral en el último año</label>' : '') +
      '<button type="button" class="btn mini ghost" data-quitar="' + i + '">Quitar</button></div>').join('');
    $('cfMiembros').querySelectorAll('.miembro').forEach((el) => {
      const m = conf.per.miembros[+el.dataset.i];
      el.querySelectorAll('select[data-k]').forEach((s) => { s.value = m[s.dataset.k] || s.options[0].value; });
      const n = el.querySelector('[data-k="nombre"]');
      UI.autocompletar(n, (p) => { n.value = p.nombre; el.querySelector('[data-k="cedula"]').value = p.cedula || ''; el.querySelector('[data-k="cargo"]').value = p.cargo || ''; });
    });
    $('cfMiembros').querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => { leerMiembros(); conf.per.miembros.splice(+b.dataset.quitar, 1); pintarMiembros(); }));
  }
  function leerMiembros() {
    conf.per.miembros = [...$('cfMiembros').querySelectorAll('.miembro')].map((el) => {
      const o = {};
      el.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.type === 'checkbox' ? x.checked : x.value.trim(); });
      return o;
    });
  }
  async function guardarConformacion() {
    leerMiembros();
    const per = conf.per, d = conf.d;
    per.inicio = $('cfIni').value; per.fin = $('cfFin').value; per.fechaEleccion = $('cfElec').value; per.mecanismo = $('cfMec').value;
    per.miembros = per.miembros.filter((m) => m.nombre);
    const msg = $('cfMsg');
    if (!per.inicio || !per.fin) { msg.textContent = 'Faltan las fechas del periodo.'; return; }
    if (!per.miembros.length) { msg.textContent = 'Agrega al menos un integrante.'; return; }
    if (C.clave === 'convivencia' && per.miembros.some((m) => !m.confidencialidad) && !await Dialogo.confirmar('Hay integrantes sin el acuerdo de confidencialidad firmado (Res. 3461 de 2025). ¿Guardar de todas formas?')) return;
    // v148: quien fue denunciado o víctima de acoso en el último año no puede integrar el comité (Res. 3461 de 2025).
    if (C.clave === 'convivencia' && per.miembros.some((m) => !m.inhabilidad)) { await Dialogo.avisar('Falta la declaración de inhabilidad de: ' + per.miembros.filter((m) => !m.inhabilidad).map((m) => m.nombre || '(sin nombre)').join(', ') + '.\n\nQuien haya sido denunciado o víctima de acoso laboral en el último año no puede integrar el comité. Marca la declaración cuando la firme.'); return; }
    const doc = Object.assign({}, d, { comite: C.clave, trabajadores: Number($('cfTrab').value) || 0 });
    doc.periodos = (d.periodos || []).slice();
    if (conf.nuevo || !doc.periodos.length) doc.periodos.push(per); else doc.periodos[doc.periodos.length - 1] = per;
    ['id', 'tipo', 'creado', 'actualizado'].forEach((k) => delete doc[k]);
    const versionBase = d.version; delete doc.version;
    msg.textContent = 'Guardando…';
    // versionBase 0 = "debe ser nuevo": si ya existía (lista vieja, sin señal), el servidor lo rechaza en vez de borrar el historial.
    const r = await SGSST.enviar({ action: 'guardar', tipo: 'comite', id: C.id, doc, versionBase: comite ? versionBase : 0 },
      { estado: 'VIGENTE', fecha: per.inicio, titulo: C.nombre, vence: per.fin, resumen: { comite: C.clave, trabajadores: doc.trabajadores, periodo: { inicio: per.inicio, fin: per.fin, miembros: per.miembros } } });
    if (!r.ok) { msg.textContent = r.conflicto ? 'Alguien cambió la conformación mientras editabas. Vuelve a abrirla.' : Errores.texto('guardó', r); return; }
    UI.toast(r.enCola ? '⏳ Guardado en el equipo; se envía al volver la señal.' : '✓ Conformación guardada.');
    show('scrInicio'); await cargar();
  }
  async function pdfConformacion() {
    const d = await docComite(); if (!d) return;
    const per = d.periodos[d.periodos.length - 1];
    const filas = (per.miembros || []).map((m, i) => '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(m.nombre) + '</td><td>' + esc(m.cedula || '') + '</td><td>' + esc(m.cargo || '') + '</td><td>' + esc(m.representa) + '</td><td>' + esc(m.calidad) + '</td><td>' + esc(m.rol || '') + '</td>' +
      (C.clave === 'convivencia' ? '<td>' + (m.confidencialidad ? 'Sí' : 'No') + '</td>' : '') + '<td style="height:30px;"></td></tr>').join('');
    const t = '<table><tr><th style="width:4%">N°</th><th>Nombre</th><th style="width:11%">Cédula</th><th style="width:15%">Cargo</th><th style="width:10%">Representa</th><th style="width:8%">Calidad</th><th style="width:9%">Rol</th>' +
      (C.clave === 'convivencia' ? '<th style="width:9%">Acuerdo confid.</th>' : '') + '<th style="width:14%">Firma</th></tr>' + filas + '</table>';
    UI.imprimir([UI.cabecera(C.formatoConformacion, 'CONFORMACIÓN DEL ' + C.nombre.toUpperCase(), 'Periodo ' + UI.corta(per.inicio) + ' a ' + UI.corta(per.fin)) +
      UI.seccion('DATOS', UI.tablaDatos([['Empresa', EMPRESA.nombre || ''], ['Trabajadores', String(d.trabajadores || '')], ['Fecha de elección', UI.corta(per.fechaEleccion) || '—'], ['Mecanismo', per.mecanismo || '—'], ['Norma', C.norma]])) +
      UI.seccion('INTEGRANTES', t)]);
  }

  /* ── Actas ── */
  function siguienteNumero(fecha) {
    const a = String(fecha).slice(0, 4);
    const n = reuniones.filter((x) => String(x.resumen.fecha).slice(0, 4) === a).length + 1;
    return ('0' + n).slice(-2) + '-' + a;
  }
  async function nuevaActa(tipoReunion, opc) {
    if (!periodo()) { UI.toast('Primero registra la conformación del comité.', 'mal'); tab = 'conformacion'; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === 'conformacion')); pintar(); return; }
    const d = await docComite();
    const per = d && d.periodos ? d.periodos[d.periodos.length - 1] : { miembros: periodo().miembros };
    acta = { id: SGSST.nuevoId('REU'), nuevo: true, comite: C.clave, tipoReunion, numero: siguienteNumero(UI.hoy()), fecha: UI.hoy(), horaInicio: '', horaFin: '', lugar: '', modalidad: 'Presencial', motivo: '',
      asistentes: (per.miembros || []).map((m) => ({ nombre: m.nombre, cedula: m.cedula || '', cargo: m.cargo || '', representa: m.representa, calidad: m.calidad, rol: m.rol || 'Integrante', asistio: m.calidad === 'Principal' ? 'Sí' : 'No', firma: '' })),
      invitados: '', ordenDia: (tipoReunion === 'Ordinaria' ? C.ordenOrdinaria : C.ordenExtraordinaria).slice(), desarrollo: '', compromisos: [], compromisosDetalle: [], seguimiento: [], proximaReunion: '' };
    if (opc && opc.riesgo) {
      /* Res. 2013 de 1986 art. 9: ante accidente grave o riesgo inminente el COPASST se reúne de forma
         extraordinaria dentro de los cinco días siguientes a la ocurrencia del hecho. */
      acta.motivo = 'Riesgo inminente / accidente grave: ';
      acta.fechaHecho = UI.hoy();
      acta.ordenDia = ['Verificación del quórum', 'Descripción del hecho (accidente grave o riesgo inminente)', 'Medidas inmediatas tomadas', 'Análisis de causas y recomendaciones', 'Compromisos y responsables'];
    }
    compNuevos = [];
    pintarActa();
  }
  async function abrirActa(id) {
    const f = reuniones.find((x) => x.id === id);
    if (SGSST._lsGet('ssta-sgsst-pend', {})[id]) { UI.toast('Esta acta tiene cambios sin enviar desde este equipo. Ábrela cuando se envíen.', 'mal'); return; }
    const d = await SGSST.doc(id);
    if (!d) { UI.toast('No se pudo abrir' + (f && f.pendiente ? ' (aún está pendiente de enviar)' : '') + '.', 'mal'); return; }
    acta = d; compNuevos = [];
    pintarActa();
  }
  function quorum(asis) {
    const princ = asis.filter((a) => a.calidad === 'Principal'), total = princ.length || asis.length;
    let pres = 0;
    ['Empleador', 'Trabajadores'].forEach((rep) => {
      const p = asis.filter((a) => a.representa === rep && a.calidad === 'Principal'), s = asis.filter((a) => a.representa === rep && a.calidad === 'Suplente');
      const pp = p.filter((a) => a.asistio === 'Sí').length;
      pres += pp + Math.min(s.filter((a) => a.asistio === 'Sí').length, p.length - pp);   // el suplente reemplaza al principal ausente
    });
    if (!princ.length) pres = asis.filter((a) => a.asistio === 'Sí').length;
    const min = Math.floor(total / 2) + 1;
    return { pres, total, min, ok: pres >= min };
  }
  function pintarActa() {
    const a = acta, s = $('scrActa');
    s.innerHTML = '<div class="hdr"><a class="back" href="#" data-volver>← Volver</a><div class="eyebrow">' + esc(C.nombre) + '</div><h1>Acta ' + esc(a.numero) + ' · Reunión ' + esc(a.tipoReunion.toLowerCase()) + '</h1><p id="actaSub">' + (a.nuevo ? 'Nueva' : esc(a.id)) + '</p></div>' +
      (C.avisoActa ? '<div class="aviso info">' + C.avisoActa + '</div>' : '') +
      '<div class="card"><div class="grid2"><div class="field"><label>Fecha</label><input type="date" id="aFecha" value="' + esc(a.fecha) + '"></div><div class="field"><label>Acta N°</label><input type="text" id="aNum" value="' + esc(a.numero) + '"></div></div>' +
      '<div class="grid2"><div class="field"><label>Hora de inicio</label><input type="time" id="aHi" value="' + esc(a.horaInicio || '') + '"></div><div class="field"><label>Hora de fin</label><input type="time" id="aHf" value="' + esc(a.horaFin || '') + '"></div></div>' +
      '<div class="grid2"><div class="field"><label>Lugar</label><input type="text" id="aLugar" value="' + esc(a.lugar || '') + '" placeholder="Ej: Sala de reuniones"></div><div class="field"><label>Modalidad</label><select id="aMod"><option>Presencial</option><option>Virtual</option><option>Mixta</option></select></div></div>' +
      (a.tipoReunion === 'Extraordinaria' ? '<div class="field"><label>Motivo de la reunión extraordinaria</label><input type="text" id="aMotivo" value="' + esc(a.motivo || '') + '" placeholder="' + esc(C.ejemploMotivo) + '"></div>' : '') +
      (a.fechaHecho !== undefined ? '<div class="field"><label>Fecha del hecho (accidente grave o riesgo inminente)</label><input type="date" id="aFechaHecho" value="' + esc(a.fechaHecho || '') + '"><div class="ayuda">La reunión debe hacerse dentro de los 5 días siguientes al hecho (Res. 2013 de 1986, art. 9).</div></div>' : '') + '</div>' +
      '<div class="card"><h2>Asistencia</h2><div id="aAsis"></div><div id="aQuorum"></div>' +
      '<div class="field u-mt10"><label>Invitados (uno por línea: nombre — cargo)</label><textarea id="aInv" placeholder="Ej: Juan Pérez — Jefe de mantenimiento">' + esc(a.invitados || '') + '</textarea></div></div>' +
      '<div class="card"><h2>Orden del día</h2><div class="field"><textarea id="aOrden" style="min-height:140px;">' + esc((a.ordenDia || []).join('\n')) + '</textarea><div class="ayuda">Un tema por línea.</div></div></div>' +
      '<div class="card"><h2>Seguimiento a compromisos anteriores</h2><div id="aSeg"></div><button type="button" class="btn ghost mini" id="aSegAct">↻ Actualizar estado desde el plan de acción</button></div>' +
      '<div class="card"><h2>Desarrollo y conclusiones</h2>' + (C.botonDatosMes ? '<button type="button" class="btn ghost mini u-mb8" id="aDatos">' + esc(C.botonDatosMes) + '</button>' : '') +
      '<div class="field"><textarea id="aDes" style="min-height:180px;" placeholder="Lo que se trató en cada tema y lo que se decidió.">' + esc(a.desarrollo || '') + '</textarea></div></div>' +
      '<div class="card"><h2>Compromisos</h2><div id="aComp"></div><button type="button" class="btn ghost" id="aCompAdd">+ Agregar compromiso</button><p class="ayuda u-mt8">Cada compromiso queda en el plan de acción (origen: ' + esc(C.origen) + ').</p></div>' +
      '<div class="card"><div class="field"><label>Próxima reunión</label><input type="date" id="aProx" value="' + esc(a.proximaReunion || '') + '"></div></div>' +
      '<div class="card"><h2>Firmas de los asistentes</h2><div id="aFirmas"></div></div>' +
      '<button type="button" class="btn amber" id="aGuardar">Guardar acta</button><button type="button" class="btn ghost" id="aPdf">🖨️ PDF del acta</button><div class="status-msg" id="aMsg"></div>' +
      (a.nuevo ? '' : '<div class="card"><div id="aAdj"></div><div id="aHist"></div></div>');
    $('aMod').value = a.modalidad || 'Presencial';
    pintarAsistencia(); pintarSeguimiento(false); pintarCompromisosActa();
    $('aInv').addEventListener('input', () => { a.invitados = $('aInv').value; });
    $('aSegAct').addEventListener('click', () => pintarSeguimiento(true));
    $('aCompAdd').addEventListener('click', () => { leerCompromisos(); compNuevos.push({ accion: '', responsable: '', fecha: Festivos.sumarDias(UI.hoy(), 30) }); pintarCompromisosActa(); });
    if ($('aDatos')) $('aDatos').addEventListener('click', async () => { const t = await C.datosMes($('aFecha').value || UI.hoy()); $('aDes').value = ($('aDes').value ? $('aDes').value.trim() + '\n\n' : '') + t; });
    $('aGuardar').addEventListener('click', guardarActa);
    $('aPdf').addEventListener('click', () => { leerActa(); pdfActa(); });
    // El acta firmada escaneada, presentaciones, listas de asistencia…
    if (!a.nuevo) { UI.adjuntos($('aAdj'), { id: a.id, lista: a.adjuntos || [], titulo: 'Acta firmada y anexos', alCambiar: (l) => { a.adjuntos = l; } }); $('aHist').appendChild(UI.botonHistorial(a.id, 'Acta ' + a.numero));
      // v149: enlace para que cada asistente firme desde su celular (sin usuario)
      const bE = document.createElement('button'); bE.type = 'button'; bE.className = 'btn ghost'; bE.textContent = 'Enviar enlace para firmar'; $('aHist').appendChild(bE);
      bE.addEventListener('click', () => compartirFirma(a)); }
    show('scrActa');
  }
  function pintarAsistencia() {
    const a = acta;
    $('aAsis').innerHTML = a.asistentes.map((p, i) => '<div class="asis"><div><b>' + esc(p.nombre) + '</b><small>' + esc([p.rol !== 'Integrante' ? p.rol : '', p.representa, p.calidad].filter(Boolean).join(' · ')) + '</small></div>' +
      '<div class="seg-btn" data-i="' + i + '">' + ['Sí', 'No', 'Excusa'].map((v) => '<button type="button" data-v="' + v + '" class="' + (p.asistio === v ? 'on' : '') + '">' + v + '</button>').join('') + '</div></div>').join('');
    $('aAsis').querySelectorAll('.seg-btn').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      guardarFirmas(); a.asistentes[+g.dataset.i].asistio = b.dataset.v; pintarAsistencia();
    }));
    const q = quorum(a.asistentes);
    $('aQuorum').innerHTML = '<div class="aviso ' + (q.ok ? 'ok' : 'amar') + '" style="margin-top:10px;">' + (q.ok ? '✓ Hay quórum: ' : '⚠ Sin quórum: ') + q.pres + ' de ' + q.total + ' integrantes con voto (se necesitan ' + q.min + ', la mitad más uno).</div>';
    pintarFirmas();
  }
  async function compartirFirma(a) {
    let r; try { r = await (await fetchWithRetry(SGSST.url() + '?action=enlaceActa&id=' + encodeURIComponent(a.id) + '&token=' + encodeURIComponent(SGSST.token()) + SGSST._ses())).json(); } catch (e) { r = { ok: false, error: 'Sin señal: el enlace se genera con conexión.' }; }
    if (!r.ok) { UI.toast(r.error || 'No se pudo crear el enlace.', 'mal'); return; }
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'firmar-acta.html?id=' + encodeURIComponent(a.id) + '&k=' + encodeURIComponent(r.clave);
    let qr = ''; try { if (typeof QR !== 'undefined') qr = '<div style="text-align:center;margin:10px 0;"><img src="' + QR.comoImagen(url, { px: 220 }) + '" alt="QR para firmar el acta"></div>'; } catch (e) {}
    const wa = 'https://wa.me/?text=' + encodeURIComponent('Firma el acta ' + a.numero + ' del ' + C.nombre + ' (' + UI.corta(a.fecha) + '): ' + url);
    const m = UI.modal('<h3>Firmar el acta ' + esc(a.numero) + '</h3><p class="ayuda">Quien abra el enlace o escanee el QR ve solo esta acta' + (C.clave === 'convivencia' ? ' (sin el contenido, que es reservado)' : '') + ' y firma con su nombre y su cédula. No necesita usuario.</p>' + qr +
      '<div class="field"><input type="text" readonly value="' + esc(url) + '" id="urlFirma"></div>' +
      '<a class="btn amber" style="display:block;text-align:center;text-decoration:none;" href="' + esc(wa) + '" target="_blank" rel="noopener">Enviar por WhatsApp</a><button type="button" class="btn ghost" id="copiarFirma">Copiar enlace</button><button type="button" class="btn ghost" data-cerrar>Cerrar</button>');
    m.el.querySelector('#copiarFirma').addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); UI.toast('Enlace copiado.'); } catch (e) { m.el.querySelector('#urlFirma').select(); } });
  }
  function guardarFirmas() { acta.asistentes.forEach((p, i) => { const f = UI.firma('fA_' + i); if (f) p.firma = f; else if (document.getElementById('fA_' + i)) p.firma = ''; }); }
  function pintarFirmas() {
    const a = acta, l = a.asistentes.map((p, i) => ({ p, i })).filter((x) => x.p.asistio === 'Sí');
    $('aFirmas').innerHTML = l.length ? l.map((x) => '<div class="field"><label>' + esc(x.p.nombre) + (x.p.rol !== 'Integrante' ? ' (' + esc(x.p.rol) + ')' : '') + '</label>' + UI.padHTML('fA_' + x.i) + '</div>').join('') : '<div class="m u-nota">Marca quién asistió.</div>';
    l.forEach((x) => UI.activarPad('fA_' + x.i, x.p.firma));
  }
  async function pintarSeguimiento(refrescar) {
    const a = acta;
    if (refrescar || (a.nuevo && !a.seguimiento.length)) {
      const r = await SGSST.listar('accion');
      const prev = r.rows.filter((x) => x.resumen && x.resumen.origen === C.origen && x.resumen.origenRef !== a.id && (a.compromisos || []).indexOf(x.id) === -1);
      const ids = new Set((a.seguimiento || []).map((x) => x.id));
      const sel = refrescar && !a.nuevo ? prev.filter((x) => ids.has(x.id) || x.estado !== 'CERRADA') : prev.filter((x) => x.estado !== 'CERRADA' || (x.resumen.fechaCierre && x.resumen.fechaCierre >= Festivos.sumarDias(a.fecha, -35)));
      a.seguimiento = sel.map((x) => ({ id: x.id, accion: x.resumen.accion, responsable: x.resumen.responsable, fechaCompromiso: x.resumen.fechaCompromiso, estado: x.estado, acta: x.resumen.origenRef }));
    }
    const h = a.fecha || UI.hoy();
    $('aSeg').innerHTML = a.seguimiento.length ? '<table class="tabla"><tr><th>Compromiso</th><th>Responsable</th><th>Estado</th></tr>' + a.seguimiento.map((x) => '<tr><td>' + esc(x.accion) + '<br><small>Fecha: ' + esc(UI.corta(x.fechaCompromiso)) + '</small></td><td>' + esc(x.responsable) + '</td><td>' +
      '<span class="chip ' + (x.estado === 'CERRADA' ? 'ok' : x.fechaCompromiso < h ? 'mal' : 'pronto') + '">' + esc(x.estado === 'CERRADA' ? 'Cumplido' : x.fechaCompromiso < h ? 'Vencido' : 'En curso') + '</span></td></tr>').join('') + '</table>'
      : '<div class="m" style="font-size:var(--fs-base);color:var(--muted);margin-bottom:8px;">No hay compromisos anteriores pendientes.</div>';
  }
  function pintarCompromisosActa() {
    const a = acta;
    const previos = (a.compromisosDetalle || []).map((c) => '<div class="dato"><span>' + esc(c.accion) + '</span><b>' + esc(c.responsable) + ' · ' + esc(UI.corta(c.fecha)) + '</b></div>').join('');
    $('aComp').innerHTML = previos + compNuevos.map((c, i) => '<div class="comp" data-i="' + i + '"><div class="field"><label>Compromiso</label><textarea data-k="accion" class="u-alto56">' + esc(c.accion) + '</textarea></div>' +
      '<div class="grid2"><div class="field"><label>Responsable</label><input type="text" data-k="responsable" value="' + esc(c.responsable) + '"></div><div class="field"><label>Fecha</label><input type="date" data-k="fecha" value="' + esc(c.fecha) + '"></div></div>' +
      '<button type="button" class="btn mini ghost" data-qc="' + i + '">Quitar</button></div>').join('');
    $('aComp').querySelectorAll('.comp').forEach((el) => { const r = el.querySelector('[data-k="responsable"]'); UI.autocompletar(r, (p) => { r.value = p.nombre; }); });
    $('aComp').querySelectorAll('[data-qc]').forEach((b) => b.addEventListener('click', () => { leerCompromisos(); compNuevos.splice(+b.dataset.qc, 1); pintarCompromisosActa(); }));
  }
  function leerCompromisos() {
    compNuevos = [...$('aComp').querySelectorAll('.comp')].map((el) => { const o = {}; el.querySelectorAll('[data-k]').forEach((x) => { o[x.dataset.k] = x.value.trim(); }); return o; });
  }
  function leerActa() {
    const a = acta, v = (id) => ($(id) ? $(id).value.trim() : '');
    a.fecha = v('aFecha'); a.numero = v('aNum'); a.horaInicio = v('aHi'); a.horaFin = v('aHf'); a.lugar = v('aLugar'); a.modalidad = v('aMod');
    if ($('aMotivo')) a.motivo = v('aMotivo');
    a.invitados = $('aInv').value; a.ordenDia = $('aOrden').value.split('\n').map((x) => x.trim()).filter(Boolean);
    a.desarrollo = $('aDes').value; a.proximaReunion = v('aProx');
    guardarFirmas(); leerCompromisos();
    a.quorum = quorum(a.asistentes).ok;
  }
  async function guardarActa() {
    leerActa();
    const a = acta, msg = $('aMsg');
    if (!a.fecha) { msg.textContent = 'Falta la fecha.'; return; }
    if ($('aFechaHecho')) {
      a.fechaHecho = $('aFechaHecho').value;
      const lim = a.fechaHecho ? new Date(a.fechaHecho + 'T12:00:00') : null;
      if (lim) lim.setDate(lim.getDate() + 5);
      if (lim && a.fecha && new Date(a.fecha + 'T12:00:00') > lim) UI.toast('Ojo: la reunión quedó a más de 5 días del hecho.', 'mal');
    }
    if (a.tipoReunion === 'Extraordinaria' && !a.motivo) { msg.textContent = 'Escribe el motivo de la reunión extraordinaria.'; return; }
    const sinFirma = a.asistentes.filter((p) => p.asistio === 'Sí' && !p.firma).length;
    if (sinFirma && !await Dialogo.confirmar(sinFirma + ' asistente(s) sin firma. ¿Guardar así? (se puede firmar después abriendo el acta)')) return;
    const nuevos = compNuevos.filter((c) => c.accion);
    if (nuevos.some((c) => !c.responsable)) { msg.textContent = 'Cada compromiso necesita responsable.'; return; }
    const b = $('aGuardar'); b.disabled = true; msg.textContent = 'Guardando…';
    // 1) Compromisos → plan de acción
    for (const c of nuevos) {
      const r = await UI.guardarAccion({ origen: C.origen, origenRef: a.id, hallazgo: 'Acta ' + a.numero + ' del ' + C.corto + ' (' + UI.corta(a.fecha) + ')', accion: c.accion, responsable: c.responsable, fechaCompromiso: c.fecha, tipoAccion: 'Preventiva' });
      if (!r.ok) { b.disabled = false; msg.textContent = Errores.texto('guardó un compromiso', r); return; }
      a.compromisos = (a.compromisos || []).concat(r.id);
      a.compromisosDetalle = (a.compromisosDetalle || []).concat({ id: r.id, accion: c.accion, responsable: c.responsable, fecha: c.fecha });
    }
    compNuevos = [];
    // 2) El acta
    const doc = {}; ['comite', 'tipoReunion', 'numero', 'fecha', 'horaInicio', 'horaFin', 'lugar', 'modalidad', 'motivo', 'asistentes', 'invitados', 'ordenDia', 'seguimiento', 'desarrollo', 'compromisos', 'compromisosDetalle', 'proximaReunion', 'quorum', 'fechaHecho'].forEach((k) => { doc[k] = a[k]; });
    const r = await SGSST.enviar({ action: 'guardar', tipo: 'reunion', id: a.id, doc, versionBase: a.nuevo ? 0 : a.version },
      { estado: 'REALIZADA', fecha: a.fecha, titulo: C.corto + ' · Acta ' + a.numero, resumen: { comite: C.clave, numero: a.numero, tipo: a.tipoReunion, fecha: a.fecha, lugar: a.lugar, asistentes: a.asistentes.filter((p) => p.asistio === 'Sí').length, convocados: a.asistentes.length, quorum: a.quorum, motivo: a.motivo, compromisos: (a.compromisos || []).length, temas: a.ordenDia.slice(0, 6) } });
    b.disabled = false;
    if (!r.ok) { msg.textContent = r.conflicto ? 'Otra persona cambió esta acta. Vuelve a abrirla.' : Errores.texto('guardó', r); pintarCompromisosActa(); return; }
    if (r.enCola) { UI.toast('⏳ Acta guardada en el equipo; se envía al volver la señal.'); show('scrInicio'); await cargar(); return; }
    if (r.version) a.version = r.version;
    a.nuevo = false;
    UI.toast('✓ Acta guardada.');
    await cargar();
    pintarActa();
  }
  function pdfActa() {
    const a = acta, q = quorum(a.asistentes);
    const asis = '<table><tr><th style="width:4%">N°</th><th>Nombre</th><th style="width:16%">Cargo</th><th style="width:11%">Representa</th><th style="width:9%">Calidad</th><th style="width:8%">Asistió</th><th style="width:20%">Firma</th></tr>' +
      a.asistentes.map((p, i) => '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(p.nombre) + (p.rol && p.rol !== 'Integrante' ? ' (' + esc(p.rol) + ')' : '') + '</td><td>' + esc(p.cargo || '') + '</td><td>' + esc(p.representa) + '</td><td>' + esc(p.calidad) + '</td><td>' + esc(p.asistio) + '</td><td>' + UI.firmaHoja(p.firma) + '</td></tr>').join('') + '</table>' +
      '<table><tr><td><b>Quórum:</b> ' + (q.ok ? 'Sí' : 'No') + ' — ' + q.pres + ' de ' + q.total + ' integrantes con voto (mínimo ' + q.min + ').' + (a.invitados ? '<br><b>Invitados:</b> ' + esc(a.invitados.split('\n').filter(Boolean).join('; ')) : '') + '</td></tr></table>';
    const orden = '<table><tr><td>' + (a.ordenDia || []).map((t, i) => (i + 1) + '. ' + esc(t)).join('<br>') + '</td></tr></table>';
    const seg = a.seguimiento && a.seguimiento.length ? '<table><tr><th>Compromiso</th><th style="width:20%">Responsable</th><th style="width:12%">Fecha</th><th style="width:12%">Estado</th></tr>' + a.seguimiento.map((x) => '<tr><td>' + esc(x.accion) + '</td><td>' + esc(x.responsable) + '</td><td>' + esc(UI.corta(x.fechaCompromiso)) + '</td><td>' + esc(x.estado === 'CERRADA' ? 'Cumplido' : x.fechaCompromiso < a.fecha ? 'Vencido' : 'En curso') + '</td></tr>').join('') + '</table>' : '<table><tr><td>Sin compromisos anteriores pendientes.</td></tr></table>';
    const comp = (a.compromisosDetalle || []).length ? '<table><tr><th style="width:4%">N°</th><th>Compromiso</th><th style="width:22%">Responsable</th><th style="width:12%">Fecha</th></tr>' + a.compromisosDetalle.map((c, i) => '<tr><td class="a">' + (i + 1) + '</td><td>' + esc(c.accion) + '</td><td>' + esc(c.responsable) + '</td><td>' + esc(UI.corta(c.fecha)) + '</td></tr>').join('') + '</table>' : '<table><tr><td>Sin compromisos nuevos.</td></tr></table>';
    const pres = a.asistentes.find((p) => /presidente|vigía/i.test(p.rol)), sec = a.asistentes.find((p) => /secretario/i.test(p.rol));
    const firmas = '<table><tr><td style="width:50%;height:60px;vertical-align:bottom;">' + UI.firmaHoja(pres && pres.firma) + '<br><b>' + esc(pres ? pres.nombre : '') + '</b><br>Presidente</td><td class="u-abajo">' + UI.firmaHoja(sec && sec.firma) + '<br><b>' + esc(sec ? sec.nombre : '') + '</b><br>Secretario</td></tr></table>';
    UI.imprimir([UI.cabecera(C.formatoActa, 'ACTA DE REUNIÓN DEL ' + C.nombre.toUpperCase(), 'Acta N° ' + a.numero + ' · Reunión ' + a.tipoReunion.toLowerCase()) +
      UI.seccion('DATOS DE LA REUNIÓN', UI.tablaDatos([['Fecha', UI.corta(a.fecha)], ['Hora', [a.horaInicio, a.horaFin].filter(Boolean).join(' a ') || '—'], ['Lugar', a.lugar || '—'], ['Modalidad', a.modalidad || '—']].concat(a.motivo ? [['Motivo', a.motivo]] : []))) +
      UI.seccion('ASISTENCIA', asis) + UI.seccion('ORDEN DEL DÍA', orden) + UI.seccion('SEGUIMIENTO A COMPROMISOS ANTERIORES', seg) +
      UI.seccion('DESARROLLO Y CONCLUSIONES', UI.textoLargo(a.desarrollo)) + UI.seccion('COMPROMISOS', comp) +
      (a.proximaReunion ? UI.seccion('PRÓXIMA REUNIÓN', '<table><tr><td>' + esc(UI.corta(a.proximaReunion)) + '</td></tr></table>') : '') + UI.seccion('FIRMAS', firmas)]);
  }

  function iniciar(cfg) {
    C = cfg;
    montar();
    window.addEventListener('outbox-enviado', () => cargar());
    return cargar();
  }
  return { iniciar, cargar, pintar, show, REGLAS, quorum, periodo, get comite() { return comite; }, get reuniones() { return reuniones; } };
})();
