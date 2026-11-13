/* ============================================================
   menus-empresa.js — Qué ve cada empresa en sus menús (v124)
   Lo usan la consola del administrador (botón «Menús» de cada empresa) y el
   configurador (v125: también el nombre y el código de cada preoperacional e inspección
   → config.bautizos). Tres partes:
     · Módulos, por categoría (lo que sale en Gestión, en la barra de abajo y lo
       que el servidor acepta) → config.modulos
     · Preoperacionales que se ofrecen          → config.ocultos.preop
     · Listas de inspección que se ofrecen      → config.ocultos.inspecciones
   Lo apagado no se borra: los registros viejos se siguen viendo.
   ============================================================ */
const MenusEmpresa = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const limpio = (t) => String(t || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();   // sin el emoji del catálogo
  const CHEV = '<svg class="me-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

  function preops() {
    const p = typeof PREOP_FORMULARIOS !== 'undefined' ? PREOP_FORMULARIOS : [], b = typeof PREOP_BASE !== 'undefined' ? PREOP_BASE : [];
    return p.concat(b.filter((x) => !p.some((f) => f.id === x.id || (f.codigo && f.codigo === x.codigo))))
      .filter((f) => !f.salud).map((f) => ({ id: f.id, t: f.nombre, g: f.grupo || 'Otros', c: f.codigo || '' }));
  }
  function inspecciones() {
    return (typeof PLANTILLAS_INSPECCION !== 'undefined' ? PLANTILLAS_INSPECCION : []).filter((p) => !p.retirada).map((p) => ({ id: p.id, t: p.nombre, g: p.equipo ? 'De equipos' : 'De áreas y puestos', c: p.codigo || '' }));
  }
  /* v129: qué tipos de reporte se ofrecen y qué guías salen en «Ayuda». */
  const TIPOS_REPORTE = [['Acto seguro', 'Actos y condiciones'], ['Acto inseguro', 'Actos y condiciones'], ['Condición insegura', 'Actos y condiciones'], ['Hallazgo ambiental', 'Actos y condiciones'],
    ['Incidente', 'Eventos'], ['Accidente de trabajo', 'Eventos'], ['PQRS', 'Otros reportes'], ['Queja al Comité de Convivencia', 'Otros reportes'], ['Reporte de acoso sexual', 'Otros reportes']];
  const REPORTES_OCULTOS_FABRICA = ['Accidente de trabajo'];
  function reportes() { return TIPOS_REPORTE.map(([t, g]) => ({ id: t, t, g, c: '' })); }
  function ayuda() { return (typeof GUIAS !== 'undefined' ? GUIAS : []).map((x) => ({ id: x.id, t: x.t, g: x.rol && x.rol.indexOf('todos') !== -1 ? 'Para todos' : x.rol && x.rol.indexOf('campo') !== -1 ? 'Campo' : 'SST, comités y gerencia', c: '' })); }
  function modulos() {
    const cat = typeof CATALOGO_MODULOS !== 'undefined' ? CATALOGO_MODULOS : [], nom = {};
    cat.forEach(([k, t]) => { nom[k] = limpio(t); });
    const cats = typeof CATEGORIAS_MODULOS !== 'undefined' ? CATEGORIAS_MODULOS : [];
    const en = [].concat.apply([], cats.map((c) => c[3]));
    const out = [];
    cats.forEach(([, n, , ks]) => ks.forEach((k) => { if (nom[k] && k !== 'asesor') out.push({ id: k, t: nom[k], g: n, c: '' }); }));
    cat.forEach(([k]) => { if (en.indexOf(k) === -1 && k !== 'asesor') out.push({ id: k, t: nom[k], g: 'Otros', c: '' }); });
    return out;
  }

  function grupo(tipo, g, items, apagado, baut) {
    const on = items.filter((x) => !apagado(x.id)).length;
    // v125: preoperacionales e inspecciones llevan, además, el nombre y el código que les pone la empresa.
    const fila = (x) => { const b = (baut && baut[x.id]) || {};
      return '<div class="me-it me-con"><label class="me-chk"><input type="checkbox" data-me="' + tipo + '" data-id="' + esc(x.id) + '"' + (apagado(x.id) ? '' : ' checked') + '><span>' + esc(x.t) + '</span></label>' +
        // v162: etiquetas fijas (no se borran al escribir); el placeholder es solo un ejemplo.
        '<div class="me-baut"><label><span class="etq-fija">Nombre en esta empresa (opcional)</span><input type="text" data-bn="' + tipo + '" data-id="' + esc(x.id) + '" value="' + esc(b.nombre || '') + '" placeholder="Ej.: ' + esc(x.t) + '" maxlength="80"></label>' +
        '<label><span class="etq-fija">Código</span><input type="text" data-bc="' + tipo + '" data-id="' + esc(x.id) + '" value="' + esc(b.codigo || '') + '" placeholder="' + (x.c ? 'Hoy: ' + esc(x.c) : 'Ej.: SST-F-01') + '" maxlength="30"></label></div></div>'; };
    return '<details class="me-g"><summary><span class="me-gt">' + esc(g) + '</span><span class="me-n" data-n>' + on + ' de ' + items.length + '</span>' +
      '<button type="button" class="me-todos" data-todos>' + (on === items.length ? 'Ninguno' : 'Todos') + '</button>' + CHEV + '</summary><div class="me-items">' +
      items.map((x) => baut ? fila(x) : '<label class="me-it"><input type="checkbox" data-me="' + tipo + '" data-id="' + esc(x.id) + '"' + (apagado(x.id) ? '' : ' checked') + '><span>' + esc(x.t) + (x.c ? '<small>' + esc(x.c) + '</small>' : '') + '</span></label>').join('') + '</div></details>';
  }
  function seccion(tipo, titulo, ayuda, items, apagado, baut) {
    if (!items.length) return '';
    const gs = []; items.forEach((x) => { if (gs.indexOf(x.g) === -1) gs.push(x.g); });
    return '<section class="me-sec" data-sec="' + tipo + '"><h4>' + esc(titulo) + '</h4><p class="me-ayuda">' + esc(ayuda) + '</p>' +
      gs.map((g) => grupo(tipo, g, items.filter((x) => x.g === g), apagado, baut)).join('') + '</section>';
  }

  /** HTML de las tres partes, según la configuración de la empresa (config.modulos y config.ocultos). */
  function html(config, opciones) {
    config = config || {}; opciones = opciones || {};
    const mods = config.modulos || {}, o = config.ocultos || {}, bz = config.bautizos || {};
    const en = (l) => (id) => (Array.isArray(o[l]) ? o[l] : (l === 'reportes' ? REPORTES_OCULTOS_FABRICA : [])).indexOf(id) !== -1;
    return '<div class="me">' +
      (opciones.sinModulos ? '' : seccion('modulo', 'Módulos del menú', 'Lo apagado sale de Gestión, de la barra de abajo y del inicio, y su servidor deja de aceptar registros de eso.', modulos(), (k) => mods[k] === false)) +
      seccion('preop', 'Preoperacionales', 'Marca los que se ofrecen en la tarjeta «Preoperacional» del inicio. Vienen sin código: escribe el nombre y el código con que esta empresa los tiene en su listado maestro (si lo dejas vacío, sale el nombre de la izquierda y sin código).', preops(), en('preop'), bz.preop || {}) +
      seccion('reportes', 'Tipos de reporte', 'Lo que se ofrece en «Reportar» del inicio. El accidente de trabajo viene apagado: lo registra SST.', reportes(), en('reportes')) +
      seccion('ayuda', 'Ayuda', 'Las guías que ven en «Ayuda». Además, solo salen las de los módulos que la empresa tiene prendidos.', ayuda(), en('ayuda')) +
      seccion('inspecciones', 'Listas de inspección', 'Marca las que se pueden escoger en «Inspecciones planeadas». También puedes ponerles el nombre y el código de esta empresa.', inspecciones(), en('inspecciones'), bz.inspecciones || {}) +
      '</div>';
  }
  /** Después de pintar html(): activa «Todos / Ninguno» y los contadores. */
  function activar(raiz) {
    estilos();
    const contar = (d) => { const cs = [...d.querySelectorAll('input[data-me]')], on = cs.filter((c) => c.checked).length; d.querySelector('[data-n]').textContent = on + ' de ' + cs.length; d.querySelector('[data-todos]').textContent = on === cs.length ? 'Ninguno' : 'Todos'; d.classList.toggle('me-off', !on); };
    raiz.querySelectorAll('.me-g').forEach(contar);
    raiz.addEventListener('click', (e) => {
      const b = e.target.closest('[data-todos]'); if (!b || !raiz.contains(b)) return; e.preventDefault();
      const d = b.closest('.me-g'), cs = [...d.querySelectorAll('input[data-me]')], todos = cs.every((c) => c.checked);
      cs.forEach((c) => { c.checked = !todos; }); contar(d);
    });
    raiz.addEventListener('change', (e) => { const d = e.target.closest && e.target.closest('.me-g'); if (d) contar(d); });
  }
  /** Lee lo marcado: { modulos: {k: bool}, ocultos: { preop: [ids], inspecciones: [ids] } }. */
  function leer(raiz, modulosAntes) {
    const modulos = Object.assign({}, modulosAntes || {}), ocultos = { preop: [], inspecciones: [], reportes: [], ayuda: [] };
    raiz.querySelectorAll('input[data-me]').forEach((c) => {
      if (c.dataset.me === 'modulo') modulos[c.dataset.id] = c.checked;
      else if (!c.checked) ocultos[c.dataset.me].push(c.dataset.id);
    });
    const bautizos = { preop: {}, inspecciones: {} };
    raiz.querySelectorAll('input[data-bn]').forEach((i) => {
      const l = i.dataset.bn, id = i.dataset.id, c = raiz.querySelector('input[data-bc="' + l + '"][data-id="' + id + '"]');
      const nombre = i.value.trim().slice(0, 80), codigo = c ? c.value.trim().slice(0, 30) : '';
      if (nombre || codigo) bautizos[l][id] = Object.assign({}, nombre ? { nombre } : {}, codigo ? { codigo } : {});
    });
    return { modulos, ocultos, bautizos };
  }
  let puesto = false;
  function estilos() {
    if (puesto || typeof document === 'undefined') return; puesto = true;
    const st = document.createElement('style');
    st.textContent = '.me{color:var(--tinta);}.me-sec{margin:14px 0 6px;}.me-sec h4{margin:0 0 2px;font-size:var(--fs-titulo);}.me-ayuda{margin:0 0 8px;font-size:var(--fs-menor);color:var(--muted,var(--ink-soft));}' +
      '.me-g{border:1.5px solid var(--line,var(--line));border-radius:var(--r-l);margin-bottom:8px;background:#fff;}.me-g.me-off{opacity:.7;}' +
      '.me-g summary{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;list-style:none;}.me-g summary::-webkit-details-marker{display:none;}' +
      '.me-gt{font-weight:800;font-size:var(--fs-base);}.me-n{margin-left:auto;font-size:var(--fs-menor);font-weight:800;background:var(--bg);color:var(--tinta);border-radius:var(--r-pill);padding:3px 10px;white-space:nowrap;}' +
      '.me-todos{border:1.5px solid var(--line,var(--line));background:#fff;color:var(--tinta);border-radius:var(--r-pill);padding:5px 11px;font:700 12.5px inherit;font-family:inherit;cursor:pointer;min-height:34px;}' +
      '.me-chev{width:18px;height:18px;flex:none;transition:transform .2s;}.me-g[open] .me-chev{transform:rotate(180deg);}' +
      '.me-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:2px 10px;padding:0 12px 10px;}' +
      '.me-it{color:var(--tinta);display:flex;gap:9px;align-items:flex-start;font-size:var(--fs-base);padding:7px 2px;cursor:pointer;}.me-it input{width:20px;height:20px;flex:none;margin:1px 0 0;}' +
      '.me-it small{display:block;font-size:var(--fs-menor);color:var(--muted,var(--ink-soft));}' +
      '.me-items:has(.me-con){grid-template-columns:1fr;}.me-con{flex-direction:column;gap:6px;border-top:1px solid var(--bg);padding:9px 2px;cursor:default;}.me-con:first-child{border-top:0;}' +
      '.me-chk{display:flex;gap:9px;align-items:flex-start;font-weight:700;cursor:pointer;}.me-chk input{width:20px;height:20px;flex:none;margin:1px 0 0;}' +
      '.me-baut{display:grid;grid-template-columns:2fr 1fr;gap:6px;padding-left:29px;}.me-baut label{display:block;margin:0;}.me-baut input{width:100%;}.me-baut input{min-height:38px;border:1.5px solid var(--line);border-radius:var(--r-m);padding:6px 10px;font:inherit;font-size:var(--fs-base);color:var(--tinta);background:#fff;width:100%;box-sizing:border-box;}' +
      '@media (max-width:520px){.me-baut{grid-template-columns:1fr;}}';
    document.head.appendChild(st);
  }
  return { html, activar, leer, preops, inspecciones, modulos };
})();
if (typeof module !== 'undefined') module.exports = MenusEmpresa;
