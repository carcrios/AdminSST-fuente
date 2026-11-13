/* ============================================================
   permiso-core.js — Núcleo compartido de los 4 permisos de trabajo
   "gemelos" (caliente, eléctrico, izajes, confinados).

   Extraído de las ~30 funciones que estaban copy-pasteadas casi
   idénticas en los 4 archivos. Cada HTML de permiso ahora solo
   define su contenido específico (arrays de checklist, campos
   extra) y un objeto de configuración por tipo, y llama a
   PermisoCore.init(cfg).

   permiso-trabajo-alturas.html NO usa este núcleo: su backend usa
   un formato distinto (arrays posicionales bajo un sobre
   {action,code,data,token} en vez de un registro plano con campos
   nombrados) — migrarlo requeriría también tocar el Apps Script
   desplegado, así que queda para una fase aparte.

   Convención: igual que UpdateManager/Outbox/OutboxBadge en
   common.js, un objeto singleton con .init(cfg). Como cada página
   solo carga un tipo de permiso a la vez, un único estado interno
   por closure es seguro (no hay dos formularios en la misma página).

   Carga: <script src="config.js"> → <script src="common.js"> →
   <script src="permiso-core.js"> → <script> inline con los datos
   del tipo + PermisoCore.init(cfg).
   ============================================================ */
const PermisoCore = (function () {
  let cfg = null;
  let MODE = null; // 'open' | 'close'
  let permitCode = null;
  let firstSaveDone = false; // se resetea al iniciar un permiso nuevo; ver startNewPermit()
  let locked = false;
  const states = {}; // stateKey -> { chk_0:'C'|'NA'|null, ... } — uno por grupo de checklist
  let execCounter = 0;
  let execBody = null;
  let personalCache = [];
  let personalMotivo = '';
  let loadedData = null; // v148: el permiso abierto que se está cerrando (para saber si está suspendido)
  let closedPermitsCache = [];
  let addPeopleData = null;
  let baseExecCount = 0; // cuántos ejecutantes ya existían ANTES de esta sesión de "agregar personal"
  let opIdAddWorkers = null; // clave de idempotencia del guardado de personal en curso
  let opIdApertura = null; // clave de idempotencia del primer guardado del permiso (ver startNewPermit)

  const TOGGLE_2STATE = [
    { val: 'C', label: 'Cumple', cls: 'active-c' },
    { val: 'NA', label: 'No aplica', cls: 'active-na' }
  ];
  const TOGGLE_3STATE = [
    { val: 'SI', label: 'Sí', cls: 'active-si' },
    { val: 'NO', label: 'No', cls: 'active-no' },
    { val: 'NA', label: 'No aplica', cls: 'active-na' }
  ];

  const $ = (id) => document.getElementById(id);

  /* ================= RENDER TOGGLE GROUPS ================= */
  // Clave estable derivada del TEXTO de la pregunta, no de su posición en la
  // lista — antes se usaba prefix+"_"+índice (ej. "chk_3"), que en el fondo
  // sigue siendo la posición: si mañana se agrega o reordena una pregunta del
  // checklist, las respuestas ya guardadas de las preguntas que NO cambiaron
  // quedarían apuntando a la pregunta equivocada al reabrir un permiso viejo
  // en modo consulta — grave en un documento con valor legal. Con esta clave,
  // dos preguntas con el mismo texto siempre producen la misma clave, sin
  // importar en qué orden ni en qué posición estén.
  function keyFromText(prefix, text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return prefix + '_' + Math.abs(hash).toString(36);
  }

  /* v148: verificaciones que, si no se cumplen, NO dejan abrir el permiso (Res. 4272/2021, 0491/2020, RETIE art. 18,
     NFPA 51B). Se reconocen por su texto en cualquier tipo de permiso; cada página puede agregar las suyas (cfg.criticos). */
  const CRITICO_RE = /sin tensi[oó]n|ausencia de tensi[oó]n|puestas? a tierra|aterrizamiento|control de energ[ií]as|bloqueo y etiquetado|plan de izaje|plan de rescate|equipo de rescate|extintor|medidor de gases|dentro de (los )?par[aá]metros|5000 libras|sistema de acceso|vig[ií]a|acompa[ñn]e/i;
  const esCritico_ = (t) => CRITICO_RE.test(String(t || '')) || (cfg.criticos || []).some((c) => String(t || '').indexOf(c) !== -1);
  function renderToggleGroup(container, data, statePrefix, stateObj, progressElId, toggleStates) {
    const states_ = toggleStates || cfg.toggleStates || TOGGLE_2STATE;
    data.forEach((cat) => {
      const catDiv = document.createElement('div');
      catDiv.className = 'check-cat';
      const h4 = document.createElement('h4');
      h4.className = 'cat-cab';
      h4.innerHTML = '<span class="cat-nombre"></span><span class="cat-avance"></span>' +
        '<button type="button" class="cat-todo">✓ Todo ' + esc(states_[0].label) + '</button>';
      h4.querySelector('.cat-nombre').textContent = cat.cat;
      catDiv.appendChild(h4);
      cat.items.forEach((text) => {
        const key = keyFromText(statePrefix, text);
        if (!(key in stateObj)) stateObj[key] = null;
        const row = document.createElement('div');
        row.className = 'check-item' + (esCritico_(text) ? ' critico' : '');
        const btns = states_
          .map((s) => `<button type="button" data-key="${key}" data-val="${s.val}" aria-pressed="false">${s.label}</button>`)
          .join('');
        row.innerHTML = `<p>${text}</p><div class="toggle" role="group" aria-label="${text.replace(/"/g, '&quot;')}">${btns}</div>`;
        catDiv.appendChild(row);
      });
      /* "Todo C / Todo SÍ": en listas de 40+ preguntas casi todas cumplen.
         Marca SOLO las que no tienen respuesta (un NA ya puesto no se toca) y
         pide confirmar que se verificaron: es una declaración, no un trámite. */
      h4.querySelector('.cat-todo').addEventListener('click', async () => {
        if (locked) return;
        // v148: lo crítico (tensión, gases, rescate, extintor…) no se marca en bloque: se verifica uno por uno.
        const pendientes = [...catDiv.querySelectorAll('.check-item:not(.critico)')].filter((r) => !r.querySelector('button[aria-pressed="true"]'));
        if (!pendientes.length) { await Dialogo.avisar('Todas las preguntas de «' + cat.cat + '» ya tienen respuesta.'); return; }
        if (!await Dialogo.confirmar('Marcar ' + pendientes.length + ' pregunta(s) sin responder de «' + cat.cat + '» como «' + states_[0].label + '».\n\n¿Confirmas que las verificaste en campo? Las que no cumplan, cámbialas después.')) return;
        pendientes.forEach((r) => { const b = r.querySelector('button[data-val="' + states_[0].val + '"]'); if (b) b.click(); });
      });
      const pintarAvance = () => {
        const filas = catDiv.querySelectorAll('.check-item');
        const hechas = [...filas].filter((r) => r.querySelector('button[aria-pressed="true"]')).length;
        const av = h4.querySelector('.cat-avance');
        av.textContent = hechas + '/' + filas.length;
        av.classList.toggle('completo', hechas === filas.length);
        h4.querySelector('.cat-todo').hidden = hechas === filas.length;
      };
      catDiv.addEventListener('click', () => setTimeout(pintarAvance, 0));
      catDiv._pintarAvance = pintarAvance;
      pintarAvance();
      container.appendChild(catDiv);
    });
    container.addEventListener('click', (e) => {
      if (locked) return;
      const btn = e.target.closest('button[data-key]');
      if (!btn) return;
      const key = btn.dataset.key,
        val = btn.dataset.val;
      stateObj[key] = val;
      const allClasses = states_.map((s) => s.cls);
      btn.parentElement.querySelectorAll('button').forEach((b) => {
        b.classList.remove(...allClasses);
        b.setAttribute('aria-pressed', 'false');
      });
      const matched = states_.find((s) => s.val === val);
      if (matched) btn.classList.add(matched.cls);
      btn.setAttribute('aria-pressed', 'true');
      updateProgress(stateObj, progressElId);
    });
  }
  function updateProgress(stateObj, elId) {
    const total = Object.keys(stateObj).length,
      done = Object.values(stateObj).filter((v) => v !== null).length;
    const el = $(elId);
    if (el) el.textContent = `${done}/${total}`;
  }
  function applyToggleState(stateObj, toggleStates) {
    setTimeout(() => document.querySelectorAll('.check-cat').forEach((c) => c._pintarAvance && c._pintarAvance()), 0);
    const states_ = toggleStates || cfg.toggleStates || TOGGLE_2STATE;
    document.querySelectorAll('button[data-key]').forEach((btn) => {
      const key = btn.dataset.key,
        val = stateObj[key];
      if (!val) return;
      const allClasses = states_.map((s) => s.cls);
      if (btn.dataset.val === val) {
        const matched = states_.find((s) => s.val === val);
        btn.classList.add(matched.cls);
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove(...allClasses);
      }
    });
  }

  /* ================= SIGNATURE PAD =================
     La implementación del lienzo de firma vive ahora en common.js
     (SignaturePad), compartida con personal-autorizado.html — antes
     estaba copiada y pegada en los dos archivos por separado. Aquí solo
     se configura el caso particular de este núcleo: el <span> de estado
     de los pads de cierre usa el prefijo 'padCierre' en vez de 'status_'. */
  const sigMgr = SignaturePad.createManager({
    statusIdFor: (id) => (id.startsWith('padCierre') ? 'status' + id.replace('pad', '') : 'status_' + id)
  });
  const pads = sigMgr.pads; // id -> {clear,undo,getDataUrl,setDataUrl,hasInk,refreshSize}
  const setupPad = sigMgr.setup;
  const refreshPadsIn = sigMgr.refreshIn;
  function lockPad(canvas) {
    SignaturePad.lock(canvas);
  }
  sigMgr.bindOrientationChange();
  // Dibuja las firmas de ejecutantes que quedaron pendientes en addExecRow
  // (ver comentario ahí). Se debe llamar SIEMPRE después de refreshPadsIn(execBody),
  // una vez que todas las filas del lote ya están en el DOM y con su tamaño real
  // asegurado — así ninguna firma guardada queda invisible por timing.
  function applyPendingExecSignatures() {
    execBody.querySelectorAll('.exec-card').forEach((card) => {
      const sig = card.dataset.pendingSig;
      if (!sig) return;
      const canvas = card.querySelector('canvas.mini-pad');
      if (canvas && pads[canvas.id]) pads[canvas.id].setDataUrl(sig);
      delete card.dataset.pendingSig;
    });
  }

  /* ================= RESPONSABLES ================= */
  function buildResponsablesUI() {
    const cont = $('responsablesSigs');
    cont.innerHTML = '';
    (cfg.responsables || []).forEach((label, i) => {
      const id = 'resp' + i;
      const div = document.createElement('div');
      div.className = 'sig-block';
      div.innerHTML = `<h5>${label}</h5>
        <div class="sig-fields"><input type="text" placeholder="Nombre completo (escribe para buscar)" id="${id}nombre"><input type="text" placeholder="Cédula" id="${id}cc" inputmode="numeric"></div>
        <canvas class="pad" id="pad_${id}"></canvas>
        <div class="sig-actions"><button type="button" data-clear="pad_${id}">Borrar firma</button><button type="button" data-undo="pad_${id}">Deshacer trazo</button><span class="sig-status" id="status_pad_${id}">Sin firmar</span></div>`;
      cont.appendChild(div);
      attachPersonalAutocomplete($(id + 'nombre'), (persona) => {
        $(id + 'nombre').value = persona.nombre;
        $(id + 'cc').value = persona.cedula;
      });
    });
    ['cierre1', 'cierre2'].forEach((id) => {
      const nombreEl = $(id + 'nombre');
      if (!nombreEl) return;
      attachPersonalAutocomplete(nombreEl, (persona) => {
        $(id + 'nombre').value = persona.nombre;
        $(id + 'cc').value = persona.cedula;
        $(id + 'cargo').value = persona.cargo || '';
      });
    });
  }

  /* ================= EJECUTANTES ================= */
  function addExecRow(prefill) {
    execCounter++;
    const n = execCounter;
    const card = document.createElement('div');
    card.className = 'exec-card';
    // cfg.execExtraFields: lista de campos extra por tipo de permiso (más allá
    // de nombre/documento/cargo/firma). Cada uno: {id, field, type:'text'|'select',
    // placeholder, options:[{value,label}]}. Por compatibilidad, cfg.execExtraField
    // (singular, un solo campo de texto) se sigue soportando como caso especial.
    const extras = cfg.execExtraFields || (cfg.execExtraField ? [Object.assign({ type: 'text' }, cfg.execExtraField)] : []);
    const extrasHtml = extras
      .map((ex) => {
        if (ex.type === 'select') {
          const opts = (ex.options || []).map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
          return `<select id="${ex.id}${n}"><option value="">${ex.placeholder || ''}</option>${opts}</select>`;
        }
        return `<input type="text" placeholder="${ex.placeholder || ''}" id="${ex.id}${n}">`;
      })
      .join('\n        ');
    card.innerHTML = `
      <div class="exec-card-top">
        <span class="exec-num">Ejecutante ${n}</span>
        <button type="button" class="remove-exec-btn" data-remove-row="${n}" title="Quitar">✕ Quitar</button>
      </div>
      <div class="exec-fields">
        <input type="text" placeholder="Nombre completo (escribe para buscar)" id="execNombre${n}" autocomplete="off">
        <input type="text" placeholder="Documento (C.C.)" id="execCC${n}" inputmode="numeric">
        <input type="text" placeholder="Cargo" id="execCargo${n}">
        ${extrasHtml}
      </div>
      <div class="sig-pad-wrap">
        <label>Firma</label>
        <canvas class="mini-pad" id="execPad${n}"></canvas>
        <div class="sig-actions">
          <button type="button" data-clear="execPad${n}">Borrar firma</button>
          <button type="button" data-undo="execPad${n}">Deshacer trazo</button>
          <span class="sig-status" id="status_execPad${n}">Sin firmar</span>
        </div>
      </div>`;
    execBody.appendChild(card);
    const c = $('execPad' + n);
    setupPad(c);
    if (prefill) {
      $('execNombre' + n).value = prefill.nombre || '';
      $('execCC' + n).value = prefill.cc || '';
      $('execCargo' + n).value = prefill.cargo || '';
      extras.forEach((ex) => {
        const el = $(ex.id + n);
        if (el) el.value = prefill[ex.field] || '';
      });
      // OJO: la firma guardada NO se dibuja aquí. Si esta fila se está creando
      // dentro de un lote (cargar un permiso existente con varios ejecutantes
      // ya firmados), el lienzo puede no tener todavía su tamaño real en este
      // instante exacto (mismo problema que ya se había resuelto para las
      // firmas de responsables — ver refreshPadsIn en loadOpenDataIntoForm).
      // Si se dibuja de una, algunas firmas quedan invisibles (canvas 0x0)
      // aunque el dato sí se guardó bien. Por eso se guarda como "pendiente"
      // y se dibuja en un segundo paso, después de refreshPadsIn(execBody),
      // vía applyPendingExecSignatures().
      if (prefill.sig) card.dataset.pendingSig = prefill.sig;
    }
    attachPersonalAutocomplete($('execNombre' + n), (persona) => {
      $('execNombre' + n).value = persona.nombre;
      $('execCC' + n).value = persona.cedula;
      $('execCargo' + n).value = persona.cargo || '';
    });
    card.querySelector('[data-remove-row]').addEventListener('click', () => {
      if (locked) return;
      delete pads['execPad' + n];
      card.remove();
    });
    return n;
  }
  // v148: para que un tipo de permiso compruebe que el vigía no sea ejecutante.
  window.collectNombresEjecutantes_ = () => collectExecRows().map((r) => String(r.nombre || '').trim().toLowerCase()).filter(Boolean);
  function collectExecRows() {
    const rows = [];
    const extras = cfg.execExtraFields || (cfg.execExtraField ? [Object.assign({ type: 'text' }, cfg.execExtraField)] : []);
    for (let i = 1; i <= execCounter; i++) {
      const nombreEl = $('execNombre' + i);
      if (!nombreEl) continue;
      const row = {
        nombre: nombreEl.value,
        cc: $('execCC' + i).value,
        cargo: $('execCargo' + i).value,
        sig: pads['execPad' + i] ? pads['execPad' + i].getDataUrl() : null
      };
      extras.forEach((ex) => {
        const el = $(ex.id + i);
        row[ex.field] = el ? el.value : '';
      });
      rows.push(row);
    }
    return rows;
  }
  /* ================= PREGUNTAS SI/NO/N-A SUELTAS (freeformYN) =================
     Para permisos donde las preguntas no vienen agrupadas en listas por
     categoría (como checklistGroups), sino intercaladas a mano dentro de las
     secciones del formulario junto con fechas, campos de texto, etc. — el
     caso de Alturas. Se activa con cfg.freeformYN = true. */
  function keyFromText(prefix, text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    return prefix + '_' + Math.abs(hash).toString(36);
  }
  function ynGroupKey(group, idx) {
    const label = group.previousElementSibling;
    const texto = label ? label.textContent.trim() : null;
    return texto ? keyFromText('yn', texto) : keyFromText('yn', 'sinEtiqueta_' + idx);
  }
  function initFreeformYN() {
    document.querySelectorAll('.yn-opts').forEach((group) => {
      if (group.dataset.freeformInit) return; // evita doble "escucha" de clic si initRender() corre más de una vez
      group.dataset.freeformInit = '1';
      if (!group.hasAttribute('data-mode')) {
        group.innerHTML = '<button type="button" class="yn-btn" data-v="SI">SI</button><button type="button" class="yn-btn" data-v="N/A">N/A</button>';
      }
      const rowLabel = (group.closest('.yn-row') || group.closest('.field') || {}).querySelector
        ? (group.closest('.yn-row') || group.closest('.field')).querySelector('.yn-label,label')
        : null;
      const labelTxt = rowLabel ? rowLabel.textContent.trim() : '';
      group.setAttribute('role', 'group');
      if (labelTxt) group.setAttribute('aria-label', labelTxt);
      group.querySelectorAll('button').forEach((btn) => {
        btn.classList.add('yn-btn');
        // v143: el grupo ya dice la pregunta; cada botón solo su respuesta («N/A» se lee «No aplica»)
        btn.setAttribute('aria-label', btn.dataset.v === 'SI' ? 'Sí' : btn.dataset.v === 'N/A' ? 'No aplica' : btn.dataset.v === 'NO' ? 'No' : btn.textContent.trim());
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
          if (locked) return;
          const already = btn.classList.contains('active-si') || btn.classList.contains('active-na') || btn.classList.contains('active-no');
          group.querySelectorAll('button').forEach((b) => {
            b.classList.remove('active-si', 'active-na', 'active-no');
            b.setAttribute('aria-pressed', 'false');
          });
          if (already) return;
          const v = btn.dataset.v;
          if (v === 'SI') btn.classList.add('active-si');
          else if (v === 'NO') btn.classList.add('active-no');
          else btn.classList.add('active-na');
          btn.setAttribute('aria-pressed', 'true');
          if (cfg.onYNChange) cfg.onYNChange();
        });
      });
    });
  }
  /* Mismo atajo para las preguntas SÍ/N-A sueltas (alturas): un botón por
     sección que tenga 3 o más, solo sobre las que no tienen respuesta. */
  function initTodoSiPorSeccion() {
    document.querySelectorAll('#app .section').forEach((sec) => {
      const grupos = [...sec.querySelectorAll('.yn-opts')];
      const titulo = sec.querySelector('.section-title');
      if (grupos.length < 3 || !titulo || titulo.querySelector('.cat-todo')) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'cat-todo en-seccion'; btn.textContent = '✓ Todo SÍ';
      titulo.appendChild(btn);
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (locked) return;
        const pend = grupos.filter((g) => g.getClientRects().length && !g.querySelector('.active-si,.active-no,.active-na') && !esCritico_((g.closest('.yn-row, .field') || {}).textContent));
        if (!pend.length) { await Dialogo.avisar('Todas las preguntas de esta sección ya tienen respuesta.'); return; }
        if (!await Dialogo.confirmar('Marcar ' + pend.length + ' pregunta(s) sin responder de esta sección como «SÍ».\n\n¿Confirmas que las verificaste en campo? Las que no apliquen, cámbialas después.')) return;
        pend.forEach((g) => { const b = g.querySelector('button[data-v="SI"]'); if (b) b.click(); });
      });
    });
  }
  function collectFreeformYN(container) {
    const out = {};
    [...container.querySelectorAll('.yn-opts')].forEach((g, i) => {
      const active = g.querySelector('.active-si,.active-na,.active-no');
      out[ynGroupKey(g, i)] = active ? active.dataset.v : '';
    });
    return out;
  }
  // Convierte un estado guardado con esquema VIEJO (arreglo por posición) al
  // esquema nuevo (objeto por clave-de-texto) — para permisos que ya estaban
  // abiertos ANTES de activar freeformYN.
  function migrarFreeformYNAntiguo(valores, container) {
    if (!Array.isArray(valores)) return valores;
    const migrado = {};
    [...container.querySelectorAll('.yn-opts')].forEach((g, i) => {
      if (valores[i] !== undefined) migrado[ynGroupKey(g, i)] = valores[i];
    });
    return migrado;
  }
  function applyFreeformYN(container, valoresGuardados) {
    const values = migrarFreeformYNAntiguo(valoresGuardados || {}, container);
    [...container.querySelectorAll('.yn-opts')].forEach((g, i) => {
      const v = values[ynGroupKey(g, i)];
      g.querySelectorAll('button').forEach((b) => {
        b.classList.remove('active-si', 'active-na', 'active-no');
        b.setAttribute('aria-pressed', 'false');
      });
      if (!v) return;
      const btn = [...g.querySelectorAll('button')].find((b) => b.dataset.v === v);
      if (btn) {
        btn.classList.add(v === 'SI' ? 'active-si' : v === 'NO' ? 'active-no' : 'active-na');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
    if (cfg.onYNChange) cfg.onYNChange();
  }
  function validateFreeformYN(container, missing) {
    container.querySelectorAll('.yn-opts').forEach((g) => g.classList.remove('field-invalid'));
    container.querySelectorAll('.yn-opts').forEach((g) => {
      const active = g.querySelector('.active-si,.active-na,.active-no');
      if (!active) {
        g.classList.add('field-invalid');
        const row = g.closest('.yn-row') || g.closest('.field') || g.closest('.row');
        if (row) row.classList.add('field-invalid');
        const label = row ? (row.querySelector('.yn-label,label') || {}).textContent : null;
        missing.push(label ? label.trim() : 'una pregunta SI/N-A');
      }
    });
  }

  function collectResponsables() {
    const arr = [];
    (cfg.responsables || []).forEach((label, i) => {
      const id = 'resp' + i;
      arr.push({
        label,
        nombre: $(id + 'nombre').value,
        cc: $(id + 'cc').value,
        sig: pads['pad_' + id] ? pads['pad_' + id].getDataUrl() : null
      });
    });
    return arr;
  }

  /* ================= INIT RENDER ================= */
  /* v148: datos críticos por tipo de permiso (vigía de fuego, LOTO, plan de izaje…): cfg.criticosApertura y
     cfg.criticosCierre = [{ id, label, tipo: 'text'|'select'|'number', op, req, ph, ayuda }]. */
  function campoCritico_(c) {
    const ctrl = c.tipo === 'select' ? '<select id="' + c.id + '"><option value="">Elige…</option>' + (c.op || []).map((o) => '<option>' + esc(o) + '</option>').join('') + '</select>'
      : c.tipo === 'textarea' ? '<textarea id="' + c.id + '" placeholder="' + esc(c.ph || '') + '"></textarea>'
      : '<input type="' + (c.tipo || 'text') + '" id="' + c.id + '" placeholder="' + esc(c.ph || '') + '"' + (c.tipo === 'number' ? ' min="0" inputmode="numeric"' : '') + '>';
    return '<div class="field"><label for="' + c.id + '">' + esc(c.label) + (c.req ? ' *' : '') + '</label>' + ctrl + (c.ayuda ? '<div class="ayuda">' + esc(c.ayuda) + '</div>' : '') + '</div>';
  }
  function pintarCriticos_() {
    if ((cfg.criticosApertura || []).length && !$('titleSecCrit')) {
      const ref = $('titleSec1') && $('titleSec1').closest('.section');
      if (ref) {
        const sec = document.createElement('div'); sec.className = 'section';
        sec.innerHTML = '<div class="section-title" id="titleSecCrit">Controles críticos de este trabajo</div><div class="section-body">' + cfg.criticosApertura.map(campoCritico_).join('') + '</div>';
        ref.parentNode.insertBefore(sec, ref.nextSibling);
        if (cfg.lockSectionIds && cfg.lockSectionIds.indexOf('titleSecCrit') === -1) cfg.lockSectionIds.push('titleSecCrit');
      }
    }
    if ((cfg.criticosCierre || []).length && $('closeFields') && !$('critCierre')) {
      const d = document.createElement('div'); d.id = 'critCierre';
      d.innerHTML = cfg.criticosCierre.map(campoCritico_).join('');
      $('closeFields').insertBefore(d, $('closeFields').firstChild);
    }
  }
  const leerCriticos_ = (lista) => { const o = {}; (lista || []).forEach((c) => { const el = $(c.id); if (el) o[c.id] = el.value; }); return o; };
  function faltanCriticos_(lista, missing) { (lista || []).forEach((c) => { const el = $(c.id); if (c.req && el && !String(el.value || '').trim()) missing.push({ msg: c.label, el }); }); }
  // v158: semáforo de la cuadrilla (se actualiza al escribir cédulas)
  function semaforoCuadrilla_() {
    const body = $('execBody'); if (!body || typeof Habilitacion === 'undefined' || !Habilitacion.semaforo) return;
    let box = $('semCuadrilla'); if (!box) { box = document.createElement('div'); box.id = 'semCuadrilla'; body.parentNode.insertBefore(box, body); }
    const hasta = ($('hastaFecha') && $('hastaFecha').value) || ($('fechaCulminacionAlt') && $('fechaCulminacionAlt').value) || '';
    Habilitacion.semaforo(box, collectExecRows(), contextoHab_(), hasta);
    botonAtsDesdePermiso_(box);
  }
  /* v159 · El ATS sale del permiso: trabajo, sitio, fechas, cuadrilla y tipo de permiso pasan solos al ATS nuevo. */
  function botonAtsDesdePermiso_(box) {
    if ($('btnHacerAts') || atsRelacionado) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'btnHacerAts'; b.className = 'btn-mini'; b.textContent = '🧭 Hacer el ATS con estos datos';
    box.parentNode.insertBefore(b, box);
    b.addEventListener('click', () => {
      const v = (id) => ($(id) && $(id).value) || '';
      const f = location.pathname.split('/').pop(), tipo = (/caliente/.test(f) && 'caliente') || (/alturas/.test(f) && 'alturas') || (/confinad/.test(f) && 'confinados') || (/izaje/.test(f) && 'izaje') || (/electric/.test(f) && 'electrico') || '';
      const personas = collectExecRows().filter((r) => r.nombre || r.cc).map((r) => ({ nombre: r.nombre, cedula: r.cc, cargo: r.cargo }));
      const datos = { trabajo: v('descripcion'), area: v('areaAlt') || v('sitio'), desde: v('desdeFecha'), hasta: v('hastaFecha') || v('fechaCulminacionAlt'), horaDesde: v('desdeHora'), horaHasta: v('hastaHora'), permiso: tipo, permisoCode: permitCode || '', personas };
      try { sessionStorage.setItem('ssta-ats-desde', JSON.stringify(datos)); } catch (e) {}
      location.href = 'ats.html?desde=permiso';
    });
  }
  let semT = null;
  document.addEventListener('input', (e) => { if (e.target && e.target.id && /^exec(CC|Nombre)\d+$/.test(e.target.id)) { clearTimeout(semT); semT = setTimeout(semaforoCuadrilla_, 400); } });
  document.addEventListener('change', (e) => { if (e.target && e.target.id && (/^exec(CC|Nombre)\d+$/.test(e.target.id) || e.target.id === 'cualPermiso' || e.target.id === 'hastaFecha')) semaforoCuadrilla_(); });
  if (typeof Habilitacion !== 'undefined' && Habilitacion.cargar) setTimeout(() => { Habilitacion.cargar().then(semaforoCuadrilla_).catch(() => {}); }, 800);
  function initRender() {
    // v149: «Volver» arriba a la izquierda, como en el resto del portal (antes los permisos no lo tenían en la cabecera)
    document.querySelectorAll('#app .hdr').forEach((h) => { if (!h.querySelector('a.back')) { const a = document.createElement('a'); a.className = 'back'; a.href = 'index.html'; a.textContent = '← Atrás'; h.insertBefore(a, h.firstChild); } });
    pintarCriticos_();
    (cfg.checklistGroups || []).forEach((g) => {
      states[g.stateKey] = states[g.stateKey] || {};
      renderToggleGroup($(g.containerId), g.data, g.statePrefix, states[g.stateKey], g.progressId, g.toggleStates);
      updateProgress(states[g.stateKey], g.progressId);
    });
    buildResponsablesUI();
    document.querySelectorAll('canvas.pad').forEach((c) => setupPad(c));
    for (let i = 0; i < 3; i++) addExecRow();
    if (cfg.freeformYN) { initFreeformYN(); initTodoSiPorSeccion(); }
    if (cfg.extraOnInitRender) cfg.extraOnInitRender();
    initPendingNav();
    actualizarPendientes();
  }

  /* ================= SET / COLLECT / LOCK ================= */
  function setFieldValues(vals) {
    if ($('descripcion')) $('descripcion').value = vals.descripcion || '';
    if ($('cualPermiso')) $('cualPermiso').value = vals.cualPermiso || '';
    document.querySelectorAll('input[name=permAdicional]').forEach((r) => {
      r.checked = r.value === vals.permAdicional;
    });
    if ($('desdeFecha')) $('desdeFecha').value = vals.desdeFecha || '';
    if ($('desdeHora')) $('desdeHora').value = vals.desdeHora || '';
    if ($('hastaFecha')) $('hastaFecha').value = vals.hastaFecha || '';
    if ($('hastaHora')) $('hastaHora').value = vals.hastaHora || '';
    if ($('sitio')) $('sitio').value = vals.sitio || '';
    if ($('responsable')) $('responsable').value = (vals.responsableTrabajo !== undefined ? vals.responsableTrabajo : vals.responsable) || '';
    if ($('observaciones')) $('observaciones').value = vals.observaciones || '';
    if (cfg.freeformYN && $('openPhase')) applyFreeformYN($('openPhase'), vals.yn);
    Object.keys(vals.criticos || {}).forEach((k) => { if ($(k)) $(k).value = vals.criticos[k]; });
    if (cfg.extraSetFieldValues) cfg.extraSetFieldValues(vals);
  }
  function lockOpenSections() {
    locked = true;
    actualizarPendientes(); // ya no se puede responder nada: el botón se retira
    document
      .querySelectorAll('#app .section-body input, #app .section-body textarea, #app .section-body select, #app .grid input, #app .grid textarea, #app .grid select')
      .forEach((el) => {
        if (!el.closest('#closeFields')) el.disabled = true;
      });
    document.querySelectorAll('#app button[data-key]').forEach((b) => (b.disabled = true));
    document.querySelectorAll('#app canvas.pad, #app canvas.mini-pad').forEach((c) => {
      if (!c.closest('#closeFields')) lockPad(c);
    });
    document.querySelectorAll('#app .sig-actions button').forEach((b) => {
      if (!b.closest('#closeFields')) b.disabled = true;
    });
    document.querySelectorAll('#app .remove-exec-btn').forEach((b) => (b.disabled = true));
    const addRowBtn = $(cfg.addRowBtnId || 'addRowBtn');
    if (addRowBtn) addRowBtn.style.display = 'none';
    // Lista explícita por tipo (viene de cfg, construida leyendo el markup real de
    // cada archivo) — a diferencia del array copiado a mano de antes, un id que no
    // exista simplemente se ignora en vez de lanzar una excepción que rompía en
    // silencio el resto de la transición a modo cierre.
    (cfg.lockSectionIds || []).forEach((id) => {
      const el = $(id);
      if (el) el.classList.add('locked');
    });
  }
  function genCode() {
    const d = new Date();
    return (
      cfg.codePrefix +
      '-' +
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      '-' +
      String(Math.floor(Math.random() * 900000) + 100000)
    );
  }
  /* Personal habilitado: si algún ejecutante no cumple lo que exige este
     permiso (curso vencido, sin concepto médico…), se pide confirmar y queda
     anotado en el permiso. Devuelve null si la persona decide no guardar. */
  // v143: quien tiene el curso vencido o no es apto NO entra a un trabajo de alto riesgo (Res. 4272 de 2021,
  // Res. 491 de 2020, Res. 5018 de 2019). Solo Administrador o SST pueden hacer una excepción, con justificación
  // escrita que queda en el permiso. Quien no está en la base (sin registro) sigue pidiendo confirmación.
  // (Antes la respuesta no se esperaba: el aviso no frenaba nada.)
  /* v148: la regla está en Habilitacion.exigir (common.js) y es la misma para ATS y registro diario.
     Contexto: el tipo de permiso más el permiso adicional marcado; vigente hasta el último día del permiso. */
  function contextoHab_() {
    const c = [tipoDeEstaPagina_()];
    const adic = ($('cualPermiso') && $('cualPermiso').value) || '';
    [['alturas', /altura/i], ['caliente', /caliente|soldad/i], ['confinados', /confinad/i], ['izajes', /izaj/i], ['electrico', /el[eé]ctric/i]].forEach(([k, re]) => { if (re.test(adic) && c.indexOf(k) === -1) c.push(k); });
    return c.filter(Boolean);
  }
  async function revisarHabilitacion_(filas, agregar) {
    if (typeof Habilitacion === 'undefined' || !Habilitacion.exigir) return [];
    const hasta = ($('hastaFecha') && $('hastaFecha').value) || ($('fechaCulminacionAlt') && $('fechaCulminacionAlt').value) || '';
    return Habilitacion.exigir(filas, contextoHab_(), { hasta, que: agregar ? 'No se puede agregar a estas personas al permiso' : 'No se puede abrir el permiso' });
  }
  function collectOpenData() {
    // formVersion: se guarda con cada registro para saber, ante una auditoría o
    // un cambio futuro de checklist, con qué versión del formulario se llenó
    // este permiso en particular — sube cada vez que cambie la ESTRUCTURA del
    // formulario (no el contenido/redacción de una pregunta puntual).
    const base = { permitCode, status: 'ABIERTO', formVersion: cfg.formVersion || 1, createdAt: new Date().toISOString() };
    if ($('descripcion')) base.descripcion = $('descripcion').value;
    if ($('cualPermiso')) base.cualPermiso = $('cualPermiso').value;
    if (document.querySelector('input[name=permAdicional]')) {
      base.permAdicional = (document.querySelector('input[name=permAdicional]:checked') || {}).value || 'No';
    }
    if ($('desdeFecha')) base.desdeFecha = $('desdeFecha').value;
    if ($('desdeHora')) base.desdeHora = $('desdeHora').value;
    if ($('hastaFecha')) base.hastaFecha = $('hastaFecha').value;
    if ($('hastaHora')) base.hastaHora = $('hastaHora').value;
    if ($('sitio')) base.sitio = $('sitio').value;
    if ($('responsable')) base.responsableTrabajo = $('responsable').value;
    // "responsable" es lo que se muestra en el dashboard como "quién abrió el
    // permiso" — se usa uno de los responsables firmantes (índice configurable
    // por tipo) en vez del campo libre "Responsable del trabajo", que igual
    // queda guardado aparte (responsableTrabajo) por si se necesita.
    const dashIdx = cfg.responsableDashboardIndex;
    const dashEl = dashIdx !== undefined ? $('resp' + dashIdx + 'nombre') : null;
    base.responsable = (dashEl && dashEl.value) || ($('responsable') ? $('responsable').value : '') || '';
    (cfg.checklistGroups || []).forEach((g) => {
      base[g.stateKey] = states[g.stateKey];
    });
    if ($('observaciones')) base.observaciones = $('observaciones').value;
    base.responsablesSigs = collectResponsables();
    base.ejecutantes = collectExecRows();
    if (cfg.freeformYN && $('openPhase')) base.yn = collectFreeformYN($('openPhase'));
    if (cfg.extraCollectOpenData) Object.assign(base, cfg.extraCollectOpenData());
    if ((cfg.criticosApertura || []).length) base.criticos = leerCriticos_(cfg.criticosApertura);
    if (atsRelacionado) base.atsRelacionado = atsRelacionado;
    if (copiadoDe) base.copiadoDe = copiadoDe;
    return base;
  }
  function collectCloseData() {
    // cfg.closeSigners: permite personalizar quién firma el cierre. Si no se
    // define, se usa el par fijo cierre1/cierre2 (nombre+cédula+cargo por
    // separado) que ya usan los 4 permisos gemelos. Alturas define el suyo
    // porque su cierre pide un campo combinado "Nombre / Cédula" para dos
    // roles con nombre propio (Coordinador, Supervisor de proyecto), no el
    // par genérico "Trabajador autorizado / Supervisor SSTA".
    const signers = cfg.closeSigners || [
      { idPrefix: 'cierre1', padKey: 'padCierre1', field: 'cierre1', combined: false },
      { idPrefix: 'cierre2', padKey: 'padCierre2', field: 'cierre2', combined: false }
    ];
    const base = {
      cierreFecha: $('cierreFecha').value,
      cierreHora: $('cierreHora').value,
      motivoCierre: $('motivoCierre').value,
      q1: (document.querySelector('input[name=q1]:checked') || {}).value || '',
      q2: (document.querySelector('input[name=q2]:checked') || {}).value || '',
      q3: (document.querySelector('input[name=q3]:checked') || {}).value || '',
      q4: (document.querySelector('input[name=q4]:checked') || {}).value || '',
      closedAt: new Date().toISOString()
    };
    if ((cfg.criticosCierre || []).length) base.criticosCierre = leerCriticos_(cfg.criticosCierre);
    signers.forEach((s) => {
      const sig = pads[s.padKey] ? pads[s.padKey].getDataUrl() : null;
      if (s.combined) {
        base[s.field] = { nombreCedula: ($(s.idPrefix) || {}).value || '', sig };
      } else {
        base[s.field] = {
          nombre: ($(s.idPrefix + 'nombre') || {}).value || '',
          cc: ($(s.idPrefix + 'cc') || {}).value || '',
          cargo: ($(s.idPrefix + 'cargo') || {}).value || '',
          sig
        };
      }
    });
    return base;
  }
  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  // Convierte un estado de checklist guardado con el esquema VIEJO (clave =
  // posición, ej. "chk_3") al esquema nuevo (clave = texto de la pregunta).
  // Necesario para que los permisos que ya estaban abiertos ANTES de este
  // cambio se seguían restaurando bien — sin esto, se hubieran visto como
  // "todo sin responder" la primera vez que alguien los reabriera después
  // de actualizar el portal. Asume que el orden de las preguntas en `data`
  // es el mismo que tenían cuando se guardó ese permiso (válido para migrar
  // lo que hay guardado HOY; si más adelante se reordenan preguntas, los
  // permisos guardados DESPUÉS de esta migración ya usan la clave nueva y
  // no dependen del orden).
  function migrarClaveEstadoAntigua(guardado, prefix, data) {
    if (!guardado) return guardado;
    const pareceEsquemaViejo = Object.keys(guardado).some((k) => new RegExp('^' + prefix + '_\\d+$').test(k));
    if (!pareceEsquemaViejo) return guardado;
    const migrado = {};
    let idx = 0;
    data.forEach((cat) => {
      cat.items.forEach((text) => {
        const claveVieja = prefix + '_' + idx++;
        const claveNueva = keyFromText(prefix, text);
        if (claveVieja in guardado) migrado[claveNueva] = guardado[claveVieja];
      });
    });
    return migrado;
  }

  function loadOpenDataIntoForm(data) {
    permitCode = data.permitCode;
    atsRelacionado = data.atsRelacionado || null;
    setTimeout(pintarAtsRelacionado_, 0);
    (cfg.checklistGroups || []).forEach((g) => {
      states[g.stateKey] = states[g.stateKey] || {};
      const guardadoMigrado = migrarClaveEstadoAntigua(data[g.stateKey], g.statePrefix, g.data);
      Object.assign(states[g.stateKey], guardadoMigrado || {});
    });
    setFieldValues(data);
    // Antes de arreglar esto, un archivo con un 3er grupo de checklist (ej.
    // "controles" en eléctrico) restauraba el estado visual de los botones
    // pero se le olvidaba refrescar su contador "X/Y" — acá se hace para
    // TODOS los grupos declarados en cfg, así que no se puede volver a olvidar.
    (cfg.checklistGroups || []).forEach((g) => {
      applyToggleState(states[g.stateKey], g.toggleStates);
      updateProgress(states[g.stateKey], g.progressId);
    });
    refreshPadsIn($('responsablesSigs')); // asegura tamaño correcto del lienzo antes de dibujar la firma guardada
    (data.responsablesSigs || []).forEach((r, i) => {
      const id = 'resp' + i;
      const nEl = $(id + 'nombre'),
        cEl = $(id + 'cc');
      if (nEl) nEl.value = r.nombre || '';
      if (cEl) cEl.value = r.cc || '';
      if (pads['pad_' + id] && r.sig) pads['pad_' + id].setDataUrl(r.sig);
    });
    execBody.innerHTML = '';
    execCounter = 0;
    (data.ejecutantes || []).forEach((row) => addExecRow(row));
    if ((data.ejecutantes || []).length === 0) {
      for (let i = 0; i < 3; i++) addExecRow();
    }
    // Igual que con responsablesSigs arriba: primero se asegura el tamaño
    // real de TODOS los lienzos del lote, y solo después se dibujan las
    // firmas guardadas — si no, algunas quedan invisibles.
    refreshPadsIn(execBody);
    applyPendingExecSignatures();
  }

  /* ================= BACKEND (Google Apps Script) ================= */
  function getWebAppUrl() {
    return PORTAL_CONFIG.BACKENDS[cfg.key].url;
  }
  /* v110: si quedó en la cola del equipo, se dice ESO (antes salía «Verifique su
     conexión e intente de nuevo» y la gente volvía a guardar el mismo permiso). */
  const MSG_EN_COLA = 'Sin conexión: el permiso quedó guardado en este equipo y se enviará solo al volver la señal. No hace falta volver a guardarlo; verás un aviso abajo mientras esté pendiente.';
  async function sendToSheet(payload) {
    const url = getWebAppUrl();
    if (!url) return { ok: false };
    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify(Object.assign({}, payload, { token: PORTAL_CONFIG.API_TOKEN })),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return await res.json();
    } catch (err) {
      return { ok: false, error: 'No se pudo conectar con el backend. Revisa tu conexión e intenta de nuevo.' };
    }
  }
  async function fetchFromSheet(code) {
    const url = getWebAppUrl();
    if (!url) return null;
    try {
      const res = await fetchWithRetry(url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const data = await res.json();
      if (data.ok === false) {
        await Dialogo.avisar(data.error || 'Permiso no encontrado');
        return null;
      }
      // firstSave y opId describen el ENVÍO que creó el permiso, no el permiso.
      // Los backends viejos los dejaron guardados dentro del JSON, así que al
      // descargar un permiso vienen de vuelta; si luego se reenvía (por ejemplo
      // al registrar una lectura de gases), el servidor lo toma por un reintento
      // del guardado inicial, responde ok y descarta el cambio en silencio.
      // Se quitan aquí para que los permisos ya guardados también queden a salvo,
      // sin depender de volver a desplegar el backend.
      delete data.firstSave;
      delete data.opId;
      return data;
    } catch (err) {
      await Dialogo.avisar('No se pudo conectar con el backend. Revisa tu conexión e intenta de nuevo.');
      return null;
    }
  }
  function listQuery() {
    return (PORTAL_CONFIG.BACKENDS[cfg.key] || {}).listQuery || 'list=1';
  }
  async function fetchOpenList() {
    const url = getWebAppUrl();
    if (!url) return [];
    try {
      const res = await fetchWithRetry(url + '?' + listQuery() + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const data = await res.json();
      return (data.rows || []).filter((r) => r.status === 'ABIERTO');
    } catch (err) {
      return [];
    }
  }
  async function fetchClosedList() {
    const url = getWebAppUrl();
    if (!url) return [];
    try {
      const res = await fetchWithRetry(url + '?' + listQuery() + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const data = await res.json();
      return (data.rows || []).filter((r) => r.status === 'CERRADO');
    } catch (err) {
      return [];
    }
  }

  /* ================= PERSONAL COMPARTIDO (autocompletar) ================= */
  /**
   * Antes, cualquier fallo aquí se tragaba en silencio: el autocompletar
   * simplemente dejaba de sugerir y nadie sabía por qué (¿sin señal?, ¿token
   * cambiado?, ¿hoja vacía?). Ahora se guarda el motivo y, si falla, aparece
   * un aviso tocable para reintentar y ver el detalle — mismo criterio que con
   * las firmas: si un dato no llegó, el formulario lo dice, no lo esconde.
   */
  async function cargarPersonalCompartido() {
    personalMotivo = '';
    try {
      const res = await fetchWithRetry(
        PORTAL_CONFIG.BACKENDS.personal.url + '?action=listPersonal&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN)
      );
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch (e) {
        // Apps Script devuelve HTML (pantalla de login o de error) cuando el
        // despliegue no es público o la URL ya no existe.
        personalMotivo = 'El anexo de personal respondió con una página web en vez de datos (HTTP ' + res.status + '). Suele pasar cuando el despliegue de Apps Script quedó como privado o la URL cambió.';
        personalCache = [];
        avisarPersonal();
        return;
      }
      if (!data.ok) {
        personalMotivo = 'El anexo de personal respondió: ' + (data.error || 'error sin detalle') + '. Si dice token, hay que igualar API_TOKEN en config.js y en personal.gs.';
        personalCache = [];
      } else if (!data.personal || !data.personal.length) {
        personalMotivo = 'El anexo de personal respondió correctamente, pero no trae ningún registro. Revisa que la hoja de Personal Autorizado tenga filas.';
        personalCache = [];
      } else {
        personalCache = data.personal;
      }
    } catch (err) {
      personalMotivo = 'No se pudo contactar el anexo de personal (' + (err && err.message ? err.message : 'sin conexión') + ').';
      personalCache = [];
    }
    avisarPersonal();
  }

  /** Muestra (o quita) el aviso de que el autocompletar de personal no está disponible. */
  function avisarPersonal() {
    if (personalCache.length) { AvisoPersonal.ocultar(); return; }
    AvisoPersonal.mostrar(personalMotivo, cargarPersonalCompartido);
  }
  function attachPersonalAutocomplete(inputEl, onSelect) {
    if (inputEl.dataset.autocompleteInit) return; // evita duplicar listeners si la sección se reconstruye
    inputEl.dataset.autocompleteInit = '1';
    let box = null;
    function cerrar() {
      if (box) {
        box.remove();
        box = null;
      }
    }
    function abrir() {
      cerrar();
      const q = inputEl.value.trim().toLowerCase();
      if (!q) return;
      const matches = personalCache.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) return;
      box = document.createElement('div');
      box.className = 'autocomplete-box';
      const rect = inputEl.getBoundingClientRect();
      box.style.position = 'absolute';
      box.style.left = rect.left + window.scrollX + 'px';
      box.style.top = rect.bottom + window.scrollY + 2 + 'px';
      box.style.width = rect.width + 'px';
      matches.forEach((p) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<b>${esc(p.nombre)}</b><span>CC ${esc(p.cedula)}${p.cargo ? ' · ' + esc(p.cargo) : ''}</span>`;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          onSelect(p);
          cerrar();
        });
        box.appendChild(item);
      });
      document.body.appendChild(box);
    }
    inputEl.addEventListener('input', abrir);
    inputEl.addEventListener('focus', abrir);
    inputEl.addEventListener('blur', () => setTimeout(cerrar, 150));
    window.addEventListener('scroll', cerrar, true);
  }

  /* ================= VALIDACIÓN ================= */
  /* ================= NAVEGADOR DE PENDIENTES =================
     Botón flotante que lleva al siguiente ítem sin responder. En permisos con
     60+ preguntas repartidas en varias secciones, encontrar cuáles faltan
     obligaba a recorrer el formulario entero a ojo (o a darle Guardar solo
     para que el validador dijera cuántas faltaban). Cuenta lo mismo que el
     contador de cada sección, pero además te lleva ahí. Se esconde solo
     cuando no queda ninguno, cuando el permiso ya está bloqueado, o en el
     modo de agregar personal (donde el resto del formulario no aplica). */
  let pendingNavEl = null;
  let pendingIdx = 0;
  function itemsPendientes() {
    const out = [];
    const visible = (el) => el && el.offsetParent !== null;
    document.querySelectorAll('#app .check-item').forEach((row) => {
      if (visible(row) && !row.querySelector('button[aria-pressed="true"]')) out.push(row);
    });
    document.querySelectorAll('#app .yn-opts').forEach((group) => {
      if (!visible(group)) return;
      if (group.querySelector('button[aria-pressed="true"]')) return;
      out.push(group.closest('.yn-row') || group.closest('.field') || group);
    });
    return out;
  }
  function actualizarPendientes() {
    if (!pendingNavEl) return;
    const oculto = locked || document.body.classList.contains('modo-agregar-personal') ||
                   $('app').style.display === 'none';
    const n = oculto ? 0 : itemsPendientes().length;
    document.body.classList.toggle('con-pendientes', !!n);
    if (!n) {
      pendingNavEl.classList.remove('show');
      return;
    }
    pendingNavEl.querySelector('.pn-count').textContent = n;
    pendingNavEl.querySelector('.pn-text').textContent =
      n === 1 ? 'pregunta sin responder' : 'preguntas sin responder';
    pendingNavEl.classList.add('show');
  }
  function initPendingNav() {
    if (pendingNavEl) return;
    pendingNavEl = document.createElement('button');
    pendingNavEl.type = 'button';
    pendingNavEl.id = 'pendingNav';
    pendingNavEl.innerHTML =
      '<span class="pn-count">0</span><span class="pn-text">preguntas sin responder</span><span class="pn-arrow">↓</span>';
    pendingNavEl.setAttribute('aria-label', 'Ir a la siguiente pregunta sin responder');
    document.body.appendChild(pendingNavEl);
    pendingNavEl.addEventListener('click', () => {
      const pend = itemsPendientes();
      if (!pend.length) { actualizarPendientes(); return; }
      if (pendingIdx >= pend.length) pendingIdx = 0;
      const destino = pend[pendingIdx];
      pendingIdx = (pendingIdx + 1) % pend.length; // el próximo toque sigue de largo
      destino.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Resalte breve para que se note cuál es, sin dejar el formulario marcado.
      destino.classList.add('pn-target');
      setTimeout(() => destino.classList.remove('pn-target'), 1600);
    });
    // Al responder cualquier pregunta se recalcula. Se usa un solo escucha en
    // todo el documento en vez de uno por ítem (son cientos).
    document.addEventListener('click', (e) => {
      if (e.target.closest('#pendingNav')) return;
      if (e.target.closest('button[data-key], .yn-opts button')) {
        setTimeout(actualizarPendientes, 0); // deja que el clic marque el botón primero
      }
    });
  }

  function scrollToEl(el) {
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function validateOpenData() {
    const missing = [];
    (cfg.requiredOpenFields || []).forEach((f) => {
      const el = $(f.id);
      if (el && !el.value.trim()) missing.push({ msg: f.label, el });
    });
    if ($('cualPermiso') && document.querySelector('input[name=permAdicional]')) {
      const permAdicional = (document.querySelector('input[name=permAdicional]:checked') || {}).value;
      if (permAdicional === 'Si' && !$('cualPermiso').value.trim()) {
        missing.push({ msg: cfg.cualPermisoLabel || '¿Cuál permiso adicional?', el: $('cualPermiso') });
      }
    }
    if (cfg.dateRange) {
      const dr = cfg.dateRange;
      const desdeFecha = dr.desdeFecha ? $(dr.desdeFecha) : null;
      const hastaFecha = dr.hastaFecha ? $(dr.hastaFecha) : null;
      const desdeHora = dr.desdeHora ? $(dr.desdeHora) : null;
      const hastaHora = dr.hastaHora ? $(dr.hastaHora) : null;
      if (desdeFecha && !desdeFecha.value) missing.push({ msg: `Fecha "Desde" (${dr.sectionLabel})`, el: desdeFecha });
      if (desdeHora && !desdeHora.value) missing.push({ msg: `Hora "Desde" (${dr.sectionLabel})`, el: desdeHora });
      if (hastaFecha && !hastaFecha.value) missing.push({ msg: `Fecha "Hasta" (${dr.sectionLabel})`, el: hastaFecha });
      if (hastaHora && !hastaHora.value) missing.push({ msg: `Hora "Hasta" (${dr.sectionLabel})`, el: hastaHora });
      if (desdeFecha && hastaFecha && desdeFecha.value && hastaFecha.value) {
        if (desdeHora && hastaHora) {
          if (desdeHora.value && hastaHora.value) {
            const inicio = new Date(desdeFecha.value + 'T' + desdeHora.value);
            const fin = new Date(hastaFecha.value + 'T' + hastaHora.value);
            if (fin <= inicio) missing.push({ msg: `La fecha/hora "Hasta" debe ser posterior a "Desde" (${dr.sectionLabel})`, el: hastaFecha });
          }
        } else if (new Date(hastaFecha.value) < new Date(desdeFecha.value)) {
          missing.push({ msg: `La fecha "Hasta" debe ser posterior o igual a "Desde" (${dr.sectionLabel})`, el: hastaFecha });
        }
      }
    }
    (cfg.checklistGroups || []).forEach((g) => {
      const pending = Object.values(states[g.stateKey] || {}).filter((v) => v === null).length;
      if (pending > 0) {
        missing.push({ msg: `${pending} ítem(s) sin marcar en ${g.label} (${g.sectionLabel})`, el: $(g.containerId) });
      }
      // v148: una verificación crítica en «No» / «No aplica» no deja abrir el permiso.
      (g.data || []).forEach((cat) => (cat.items || []).forEach((text) => {
        if (!esCritico_(text)) return;
        const v = (states[g.stateKey] || {})[keyFromText(g.statePrefix, text)];
        if (v && v !== 'C' && v !== 'SI') missing.push({ msg: 'Verificación crítica sin cumplir: «' + text.slice(0, 90) + '». Corrige en campo antes de abrir.', el: $(g.containerId) });
      }));
    });
    document.querySelectorAll('#app .yn-opts').forEach((gr) => {
      const lab = (gr.closest('.yn-row, .field') || {}).textContent || '';
      if (gr.getClientRects().length && esCritico_(lab) && gr.querySelector('.active-no')) missing.push({ msg: 'Verificación crítica en «NO»: «' + lab.replace(/\s+/g, ' ').trim().slice(0, 90) + '»', el: gr });
    });
    // v148: el permiso es por jornada; más de 24 horas no se abre (cada empresa puede ajustar EMPRESA.permisos.maxHoras).
    if (cfg.dateRange) {
      const dr = cfg.dateRange, df = $(dr.desdeFecha), dh = $(dr.desdeHora), hf = $(dr.hastaFecha), hh = $(dr.hastaHora);
      const maxH = Number(((typeof EMPRESA !== 'undefined' && EMPRESA.permisos) || {}).maxHoras) || 24;
      if (df && hf && df.value && hf.value) { const ini = new Date(df.value + 'T' + ((dh && dh.value) || '00:00')), fin = new Date(hf.value + 'T' + ((hh && hh.value) || '23:59'));
        if ((fin - ini) / 3600000 > maxH) missing.push({ msg: 'El permiso es por jornada: máximo ' + maxH + ' horas. Para trabajos de varios días, repite el permiso cada día.', el: hf }); }
    }
    const RESPONSABLES_OPCIONALES = cfg.responsablesOpcionales || [];
    (cfg.responsables || []).forEach((label, i) => {
      if (RESPONSABLES_OPCIONALES.includes(label)) return;
      const id = 'resp' + i;
      const nombreEl = $(id + 'nombre'),
        ccEl = $(id + 'cc');
      const sig = pads['pad_' + id] ? pads['pad_' + id].getDataUrl() : null;
      if (!nombreEl.value.trim() || !ccEl.value.trim() || !sig) {
        missing.push({ msg: `Datos y/o firma de "${label}" (${cfg.responsablesSectionLabel || 'sección de responsables'})`, el: nombreEl });
      }
    });
    let execValid = 0;
    for (let i = 1; i <= execCounter; i++) {
      const nombreEl = $('execNombre' + i);
      if (!nombreEl) continue;
      const ccEl = $('execCC' + i);
      const sig = pads['execPad' + i] ? pads['execPad' + i].getDataUrl() : null;
      const tieneAlgo = nombreEl.value.trim() || ccEl.value.trim() || sig;
      if (tieneAlgo) {
        if (!nombreEl.value.trim() || !ccEl.value.trim() || !sig) {
          missing.push({ msg: `Fila ${i} de ejecutantes incompleta (falta nombre, documento o firma)`, el: nombreEl });
        } else {
          execValid++;
        }
      }
    }
    if (execValid === 0) {
      missing.push({ msg: 'Debe registrarse al menos un ejecutante completo (nombre, documento y firma)', el: $('execSection') });
    }
    if (cfg.freeformYN && $('openPhase')) {
      const missingLabels = [];
      validateFreeformYN($('openPhase'), missingLabels);
      missingLabels.forEach((label) => missing.push({ msg: label, el: $('openPhase') }));
    }
    faltanCriticos_(cfg.criticosApertura, missing);
    if (cfg.validarCriticos) cfg.validarCriticos(leerCriticos_(cfg.criticosApertura), missing, 'apertura');
    if (cfg.extraValidateOpen) cfg.extraValidateOpen(missing);
    return missing;
  }
  function validateCloseData() {
    const missing = [];
    const cierreFecha = $('cierreFecha'),
      cierreHora = $('cierreHora');
    const motivo = $('motivoCierre');
    if (!cierreFecha.value) missing.push({ msg: 'Fecha real del cierre', el: cierreFecha });
    if (!cierreHora.value) missing.push({ msg: 'Hora de cierre', el: cierreHora });
    if (!motivo.value) missing.push({ msg: 'Motivo del cierre', el: motivo });
    // cfg.closeQuestions === false: para un permiso que no tenga estas 4
    // preguntas en su sección de cierre — sin este guard se bloquearía el
    // guardado pidiendo respuestas a preguntas que ni siquiera están en
    // pantalla. Hoy los cinco permisos las tienen (alturas era la excepción
    // y se unificó), pero el guard se conserva por si se agrega un formato
    // nuevo con otra estructura de cierre.
    if (cfg.closeQuestions !== false) {
      ['q1', 'q2', 'q3', 'q4'].forEach((q, i) => {
        if (!document.querySelector(`input[name=${q}]:checked`)) {
          missing.push({ msg: `Respuesta a la pregunta ${i + 1} de cierre`, el: document.querySelector(`input[name=${q}]`) });
        }
      });
      // v148: no se cierra un permiso con personal todavía en el área.
      const q2 = document.querySelector('input[name=q2]:checked');
      if (q2 && q2.value === 'No') missing.push({ msg: 'El personal debe estar fuera del área antes de cerrar (pregunta 2 en «No»)', el: q2 });
    }
    // v148: un permiso suspendido no se cierra como «finalizado» sin reanudarlo.
    if (loadedData && loadedData.suspendido && /finalizad/i.test(motivo.value || '')) missing.push({ msg: 'El permiso está suspendido: reanúdalo o ciérralo como «Actividad Cancelada» / «Condiciones y/o actos inseguros»', el: motivo });
    faltanCriticos_(cfg.criticosCierre, missing);
    if (cfg.validarCriticos) cfg.validarCriticos(leerCriticos_(cfg.criticosCierre), missing, 'cierre');
    const signers = cfg.closeSigners || [
      { idPrefix: 'cierre1', padKey: 'padCierre1', label: 'Trabajador autorizado', combined: false },
      { idPrefix: 'cierre2', padKey: 'padCierre2', label: 'Supervisor SSTA', combined: false }
    ];
    signers.forEach((s) => {
      const sig = pads[s.padKey] ? pads[s.padKey].getDataUrl() : null;
      if (s.combined) {
        const el = $(s.idPrefix);
        if (!el || !el.value.trim() || !sig) missing.push({ msg: `Datos y/o firma de "${s.label}"`, el });
      } else {
        const nombreEl = $(s.idPrefix + 'nombre'),
          ccEl = $(s.idPrefix + 'cc');
        if (!nombreEl.value.trim() || !ccEl.value.trim() || !sig) {
          missing.push({ msg: `Datos y/o firma de "${s.label}"`, el: nombreEl });
        }
      }
    });
    return missing;
  }
  function showMissing(missing) {
    document.querySelectorAll('.field-invalid').forEach((el) => el.classList.remove('field-invalid'));
    const banner = $('validationBanner');
    const total = missing.length;
    banner.innerHTML =
      '<strong id="vbTitulo">' +
      (total === 1 ? 'Falta 1 campo por diligenciar' : 'Faltan ' + total + ' campos por diligenciar') +
      '</strong><p class="vb-hint">Toca cualquiera de la lista para ir directo a ese campo.</p>' +
      '<ol class="vb-list">' +
      missing.map((m, i) => `<li><button type="button" class="vb-item" data-idx="${i}">${esc(m.msg)}</button></li>`).join('') +
      '</ol>';
    banner.classList.add('show');

    // Marca en rojo cada campo y deja listo el "tachado" en vivo: apenas la
    // persona llena uno, su renglón se marca como resuelto y el contador baja,
    // sin tener que volver a tocar Guardar para saber si va bien. Antes la
    // lista quedaba congelada y el formulario seguía todo en rojo aunque ya
    // se hubieran corregido casi todos los campos.
    missing.forEach((m, i) => {
      if (!m.el) return;
      const target = m.el.type === 'radio' || m.el.type === 'checkbox' ? m.el.closest('.field') || m.el : m.el;
      target.classList.add('field-invalid');
      const esCampoDeTexto = /^(INPUT|TEXTAREA|SELECT)$/.test(m.el.tagName || '');
      if (!esCampoDeTexto) return;
      const alCorregir = () => {
        if (!m.el.value || !String(m.el.value).trim()) return; // sigue vacío
        target.classList.remove('field-invalid');
        marcarResuelto(i);
        m.el.removeEventListener('input', alCorregir);
        m.el.removeEventListener('change', alCorregir);
      };
      m.el.addEventListener('input', alCorregir);
      m.el.addEventListener('change', alCorregir);
    });

    // Tocar un renglón lleva al campo y le pone el foco.
    banner.querySelectorAll('.vb-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = missing[parseInt(btn.dataset.idx, 10)];
        if (!m || !m.el) return;
        scrollToEl(m.el);
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(m.el.tagName || '')) {
          setTimeout(() => { try { m.el.focus({ preventScroll: true }); } catch (e) { m.el.focus(); } }, 350);
        }
      });
    });

    // Se lleva a la vista el aviso (no el primer campo): así se alcanza a leer
    // la lista completa antes de empezar a corregir. Antes saltaba de una al
    // primer campo y la lista pasaba desapercibida.
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function marcarResuelto(idx) {
    const banner = $('validationBanner');
    const btn = banner.querySelector('.vb-item[data-idx="' + idx + '"]');
    if (btn) btn.classList.add('done');
    const restantes = banner.querySelectorAll('.vb-item:not(.done)').length;
    const titulo = $('vbTitulo');
    if (restantes === 0) {
      hideValidationBanner();
      return;
    }
    if (titulo) {
      titulo.textContent = restantes === 1
        ? 'Falta 1 campo por diligenciar'
        : 'Faltan ' + restantes + ' campos por diligenciar';
    }
  }
  function hideValidationBanner() {
    const banner = $('validationBanner');
    banner.classList.remove('show');
    banner.innerHTML = '';
  }

  /* ================= DRAFTS ================= */
  function draftKeyOpen() {
    return 'ssta-draft-' + cfg.draftSlug + '-open';
  }
  function draftKeyClose(code) {
    return 'ssta-draft-' + cfg.draftSlug + '-close-' + code;
  }
  function dismissOpenDraftBannerOnEdit() {
    // Antes esto ocultaba el aviso apenas el usuario tocaba cualquier campo,
    // sin haber elegido "Restaurar" ni "Descartar" — el borrador anterior
    // quedaba pisado por el autoguardado 1.2s después, sin ningún rastro
    // visible de que eso había pasado. Ahora el aviso se queda fijo en
    // pantalla hasta que el usuario elige explícitamente una de las dos
    // opciones, aunque siga escribiendo en el formulario nuevo mientras tanto.
  }
  function checkForOpenDraft() {
    const draft = DraftStore.load(draftKeyOpen());
    const banner = $('draftBanner');
    if (!draft) {
      banner.classList.remove('show');
      return;
    }
    $('draftBannerText').textContent = `Hay un borrador sin guardar de un permiso de apertura (${formatSavedAt(draft.savedAt)}). Si sigues escribiendo aquí sin elegir una opción, ese borrador anterior se va a perder.`;
    banner.classList.add('show');
    $('draftRestoreBtn').onclick = () => {
      if (draft.data.permitCode) {
        permitCode = draft.data.permitCode;
        $('permitCodeDisplay').textContent = permitCode;
      }
      loadOpenDataIntoForm(draft.data);
      banner.classList.remove('show');
      $('footerStatus').textContent = 'Borrador restaurado. Continúe diligenciando y guarde cuando termine.';
    };
    $('draftDiscardBtn').onclick = () => {
      DraftStore.clear(draftKeyOpen());
      banner.classList.remove('show');
    };
  }
  function checkForCloseDraft(code) {
    const draft = DraftStore.load(draftKeyClose(code));
    const banner = $('draftBanner');
    if (!draft) {
      banner.classList.remove('show');
      return;
    }
    $('draftBannerText').textContent = `Hay un borrador sin guardar del cierre de este permiso (${formatSavedAt(draft.savedAt)}).`;
    banner.classList.add('show');
    $('draftRestoreBtn').onclick = () => {
      $('cierreFecha').value = draft.data.cierreFecha || '';
      $('cierreHora').value = draft.data.cierreHora || '';
      $('motivoCierre').value = draft.data.motivoCierre || '';
      ['q1', 'q2', 'q3', 'q4'].forEach((q) => {
        if (draft.data[q]) {
          const r = document.querySelector(`input[name=${q}][value="${draft.data[q]}"]`);
          if (r) r.checked = true;
        }
      });
      const signers = cfg.closeSigners || [
        { idPrefix: 'cierre1', padKey: 'padCierre1', field: 'cierre1', combined: false },
        { idPrefix: 'cierre2', padKey: 'padCierre2', field: 'cierre2', combined: false }
      ];
      signers.forEach((s) => {
        const d = draft.data[s.field] || {};
        if (s.combined) {
          if ($(s.idPrefix)) $(s.idPrefix).value = d.nombreCedula || '';
        } else {
          if ($(s.idPrefix + 'nombre')) $(s.idPrefix + 'nombre').value = d.nombre || '';
          if ($(s.idPrefix + 'cc')) $(s.idPrefix + 'cc').value = d.cc || '';
          if ($(s.idPrefix + 'cargo')) $(s.idPrefix + 'cargo').value = d.cargo || '';
        }
        if (pads[s.padKey] && d.sig) pads[s.padKey].setDataUrl(d.sig);
      });
      banner.classList.remove('show');
      $('footerStatus').textContent = 'Borrador de cierre restaurado. Continúe y guarde cuando termine.';
    };
    $('draftDiscardBtn').onclick = () => {
      DraftStore.clear(draftKeyClose(code));
      banner.classList.remove('show');
    };
  }

  /* ================= FLUJO DE PANTALLAS ================= */
  function goToApp() {
    $('landing').style.display = 'none';
    $('app').style.display = 'block';
    $('footerActions').style.display = 'flex';
  }
  function startNewPermit() {
    MODE = 'open';
    permitCode = genCode();
    firstSaveDone = false;
    // Clave de idempotencia del PRIMER guardado de este permiso. Se genera una
    // sola vez por permiso y NO cambia entre reintentos: si el envío llega al
    // servidor pero la respuesta se pierde (señal intermitente), el reintento
    // llega con el mismo opId y el backend lo reconoce como reenvío en vez de
    // hacer que el cliente genere otro código — que era como se podía terminar
    // con el mismo permiso duplicado bajo dos códigos distintos.
    opIdApertura = permitCode + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    goToApp();
    initRender();
    $('statusBanner').className = 'status-banner open';
    $('statusBannerText').textContent = 'Apertura de permiso en curso';
    $('permitCodeDisplay').textContent = permitCode;
    $('footerStatus').textContent = 'Diligencia toda la información y firma. Anota el código para el cierre.';
    $('mainActionBtn').textContent = 'Guardar apertura en la hoja';
    $('closeLockedMsg').classList.remove('hidden');
    $('closeFields').classList.add('hidden');
    atsRelacionado = null; codigoAvisadoAlAts = null; copiadoDe = null;
    pintarAtsRelacionado_();
    checkForOpenDraft();
    aplicarPrefillDesdeAts_();
    prellenarBasicos_();
  }
  /* v146: el supervisor no vuelve a escribir lo obvio. Solo llena campos vacíos
     (no pisa un borrador ni lo que vino del ATS). */
  const CLAVE_ULT_SITIO = 'ssta-ultimo-sitio-permiso';
  function prellenarBasicos_() {
    const poner = (ids, v) => {
      if (!v) return;
      for (const id of ids) {
        const el = $(id);
        if (el && !String(el.value || '').trim()) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return; }
      }
    };
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const hoy = d.toISOString().slice(0, 10), hora = d.toISOString().slice(11, 16);
    poner(['desdeFecha', 'fechaInicioAlt'], hoy);
    poner(['hastaFecha', 'fechaCulminacionAlt'], hoy);
    poner(['desdeHora', 'horaInicioAlt'], hora);
    try { poner(['responsable'], (typeof Sesion !== 'undefined' && Sesion.nombre) ? Sesion.nombre() : ''); } catch (e) {}
    let ult = ''; try { ult = localStorage.getItem(CLAVE_ULT_SITIO) || ''; } catch (e) {}
    poner(['sitio', 'areaAlt'], ult);
  }
  function recordarSitio_() {
    const el = $('sitio') || $('areaAlt');
    if (el && el.value) try { localStorage.setItem(CLAVE_ULT_SITIO, el.value); } catch (e) {}
  }
  async function openCloseModeWithCode(code) {
    if (!code) return;
    const data = await fetchFromSheet(code);
    if (!data) return;
    MODE = 'close';
    goToApp();
    initRender();
    loadOpenDataIntoForm(data);
    mostrarQrDelPermiso();
    lockOpenSections();
    $('statusBanner').className = data.status === 'CERRADO' ? 'status-banner closed' : 'status-banner open';
    $('statusBannerText').textContent = data.status === 'CERRADO' ? 'Permiso ya cerrado (modo consulta)' : 'Permiso abierto — completa el cierre';
    $('permitCodeDisplay').textContent = permitCode;
    $('closeLockedMsg').classList.add('hidden');
    $('closeFields').classList.remove('hidden');
    refreshPadsIn($('closeFields'));
    const closeTitle = $(cfg.closeSectionTitleId || 'titleSec7');
    if (closeTitle) closeTitle.classList.remove('locked');
    $('footerStatus').textContent = 'Revisa los datos de apertura (bloqueados) y diligencia la sección de cierre.';
    $('mainActionBtn').textContent = 'Guardar cierre en la hoja';
    if (data.status === 'CERRADO') {
      loadCloseDataIntoForm(data);
      lockCloseSections();
      $('mainActionBtn').disabled = true;
      $('mainActionBtn').style.display = 'none';
      $('draftBanner').classList.remove('show');
      $('footerStatus').textContent = 'Permiso cerrado — solo consulta. No se puede modificar.';
    } else {
      $('mainActionBtn').style.display = '';
      checkForCloseDraft(permitCode);
      loadedData = data; pintarNovedades_(data);
    }
  }
  /* v146: durante la jornada — ampliar la vigencia, suspender / reanudar y
     entregar el turno, sin tocar el resto del permiso. */
  function pintarNovedades_(data) {
    const ref = $('closeFields'); if (!ref) return;
    let caja = $('novedadesPermiso');
    if (!caja) { caja = document.createElement('section'); caja.id = 'novedadesPermiso'; caja.className = 'card'; caja.setAttribute('aria-labelledby', 'novTit'); ref.parentNode.insertBefore(caja, ref); }
    const nov = (data.novedades || []);
    const NOM = { ampliar: 'Vigencia ampliada', suspender: 'Suspendido', reanudar: 'Reanudado', turno: 'Turno entregado' };
    const bt = (k, t) => '<button type="button" class="btn-main" data-nov="' + k + '" style="flex:1 1 140px;">' + t + '</button>';
    caja.innerHTML = '<h3 id="novTit" style="margin:0 0 8px;">Durante el trabajo</h3>' +
      (data.suspendido ? '<p style="font-weight:700;color:var(--rojo-900,#7a1010);">Trabajo suspendido: nadie trabaja hasta reanudar.</p>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + bt('ampliar', 'Ampliar vigencia') + (data.suspendido ? bt('reanudar', 'Reanudar trabajo') : bt('suspender', 'Suspender trabajo')) + bt('turno', 'Entregar turno') + '</div>' +
      (nov.length ? '<ul style="margin:10px 0 0;padding-left:18px;font-size:var(--fs-menor);">' + nov.slice(-8).map((x) => '<li>' + esc(NOM[x.tipo] || x.tipo) + ' · ' + esc(String(x.en || '').slice(0, 16).replace('T', ' ')) + (x.hasta ? ' · hasta ' + esc(x.hasta) : '') + (x.quien ? ' · ' + esc(x.quien) : '') + (x.nota ? ' — ' + esc(x.nota) : '') + '</li>').join('') + '</ul>' : '');
    caja.querySelectorAll('[data-nov]').forEach((b) => { b.onclick = () => registrarNovedad_(b.dataset.nov, data); });
  }
  async function registrarNovedad_(tipo, data) {
    const n = { tipo };
    // v148: Res. 0491 de 2020 — en espacios confinados no se amplía ni se reanuda sin una lectura de gases reciente y en rango.
    if (tipoDeEstaPagina_() === 'confinados' && (tipo === 'ampliar' || tipo === 'reanudar')) {
      const ls = (data.gases && data.gases.lecturas) || [], u = ls[ls.length - 1];
      const reciente = u && u.fecha && Date.now() - new Date(u.fecha).getTime() <= 15 * 60000;
      const enRango = u && typeof gasTypes !== 'undefined' && gasTypes.every((g) => evaluarGas(g, (u.valores || {})[g.key]) !== 'alerta');
      if (!reciente || !enRango) { await Dialogo.avisar('Primero registra una lectura de gases (menú «Registrar lectura de gases») de los últimos 15 minutos y dentro de rango. Después vuelve a abrir este permiso.'); return; }
    }
    let yo = ''; try { yo = (typeof Sesion !== 'undefined' && Sesion.nombre) ? Sesion.nombre() : ''; } catch (e) {}
    if (tipo === 'ampliar') {
      const v = await Dialogo.pedir('Nueva hora de fin (HH:MM). Si es otro día, escribe AAAA-MM-DD HH:MM.', data.hastaHora || '');
      if (v == null) return;
      const m = String(v).trim().match(/^(?:(\d{4}-\d{2}-\d{2})\s+)?(\d{1,2}):(\d{2})$/);
      if (!m) { await Dialogo.avisar('Escribe la hora así: 17:30 (o 2026-11-05 07:00 si sigue otro día).'); return; }
      n.hastaFecha = m[1] || data.hastaFecha || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      n.hastaHora = ('0' + m[2]).slice(-2) + ':' + m[3];
      n.quien = yo;
      n.nota = (await Dialogo.pedir('¿Por qué se amplía? (se verificaron de nuevo las condiciones)', '')) || '';
    } else if (tipo === 'turno') {
      const q = await Dialogo.pedir('¿Quién recibe el turno? Nombre completo del nuevo responsable.', '');
      if (!q || !q.trim()) return;
      n.quien = q.trim();
      // v148: quien recibe deja su cédula y acepta (Res. 4272: el responsable acepta el permiso).
      const cc = String(await Dialogo.pedir('Cédula de ' + n.quien + ' (quien recibe):', '') || '').replace(/\D/g, '');
      if (cc.length < 5) { await Dialogo.avisar('Falta la cédula de quien recibe el turno.'); return; }
      if (typeof Habilitacion !== 'undefined' && Habilitacion.exigir && await Habilitacion.exigir([{ cc, nombre: n.quien }], contextoHab_(), { que: 'No puede recibir el turno' }) === null) return;
      if (!await Dialogo.confirmar(n.quien + ': ¿revisaste en el sitio las condiciones, los controles y al personal, y aceptas el permiso desde ahora?')) return;
      n.cedula = cc;
      n.nota = (await Dialogo.pedir('Qué se entrega (avance, riesgos pendientes, equipos):', '')) || '';
    } else {
      n.quien = yo;
      n.nota = (await Dialogo.pedir(tipo === 'suspender' ? 'Motivo de la suspensión (lluvia, tormenta, alarma, condición insegura…):' : '¿Se verificaron de nuevo las condiciones? Anota qué se revisó:', '')) || '';
      if (!n.nota.trim()) { await Dialogo.avisar(tipo === 'suspender' ? 'Escribe el motivo de la suspensión.' : 'Escribe qué se verificó antes de reanudar.'); return; }
    }
    const payload = { action: 'novedad', permitCode: permitCode, novedad: n, opId: permitCode + '-nov-' + Date.now() + '-' + Math.random().toString(36).slice(2), token: PORTAL_CONFIG.API_TOKEN };
    let res;
    try { const r = await fetchWithRetry(getWebAppUrl(), { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } }); res = await r.json(); }
    catch (e) { res = { ok: false, error: 'Sin conexión. Intenta de nuevo cuando tengas señal.' }; }
    if (!res || !res.ok) { await Dialogo.avisar('No se guardó: ' + ((res && res.error) || 'error desconocido')); return; }
    data.novedades = (data.novedades || []).concat([res.novedad || n]);
    if (tipo === 'ampliar') { data.hastaFecha = n.hastaFecha; data.hastaHora = n.hastaHora; }
    if (tipo === 'suspender') data.suspendido = true;
    if (tipo === 'reanudar') data.suspendido = false;
    pintarNovedades_(data);
    $('footerStatus').textContent = 'Novedad guardada.';
  }

  /* Rellena la sección de cierre con lo que quedó guardado en la hoja. Antes
     solo se restauraban fecha, hora y motivo: las 4 preguntas, los nombres de
     quienes firmaron y sus firmas quedaban en blanco, así que un permiso ya
     cerrado se veía como si nunca se hubiera cerrado. */
  function loadCloseDataIntoForm(data) {
    if ($('cierreFecha')) $('cierreFecha').value = data.cierreFecha || '';
    if ($('cierreHora')) $('cierreHora').value = data.cierreHora || '';
    if ($('motivoCierre')) $('motivoCierre').value = data.motivoCierre || '';
    ['q1', 'q2', 'q3', 'q4'].forEach((q) => {
      if (!data[q]) return;
      const r = document.querySelector(`input[name=${q}][value="${data[q]}"]`);
      if (r) r.checked = true;
    });
    const signers = cfg.closeSigners || [
      { idPrefix: 'cierre1', padKey: 'padCierre1', field: 'cierre1', combined: false },
      { idPrefix: 'cierre2', padKey: 'padCierre2', field: 'cierre2', combined: false }
    ];
    signers.forEach((s) => {
      const d = data[s.field] || {};
      if (s.combined) {
        if ($(s.idPrefix)) $(s.idPrefix).value = d.nombreCedula || '';
      } else {
        if ($(s.idPrefix + 'nombre')) $(s.idPrefix + 'nombre').value = d.nombre || '';
        if ($(s.idPrefix + 'cc')) $(s.idPrefix + 'cc').value = d.cc || '';
        if ($(s.idPrefix + 'cargo')) $(s.idPrefix + 'cargo').value = d.cargo || '';
      }
      if (pads[s.padKey] && d.sig) pads[s.padKey].setDataUrl(d.sig);
    });
  }

  /* Bloquea la sección de cierre. lockOpenSections() excluye a propósito todo
     lo que esté dentro de #closeFields (para poder diligenciarlo); esta función
     es la contraparte para cuando el permiso YA está cerrado. */
  function lockCloseSections() {
    const cf = $('closeFields');
    if (!cf) return;
    cf.querySelectorAll('input, textarea, select, button').forEach((el) => (el.disabled = true));
    cf.querySelectorAll('canvas.pad, canvas.mini-pad').forEach((c) => lockPad(c));
  }
  async function cargarParaAgregarPersonal(code) {
    if (!code) {
      await Dialogo.avisar('Escribe el código del permiso.');
      return;
    }
    const btn = $('loadAddPeopleBtn');
    btn.disabled = true;
    btn.textContent = 'Buscando…';
    const data = await fetchFromSheet(code);
    btn.disabled = false;
    btn.textContent = 'Cargar permiso y agregar personal';
    if (!data) return;
    if (data.status !== 'ABIERTO') {
      await Dialogo.avisar('Este permiso no está abierto actualmente (estado: ' + (data.status || 'desconocido') + '), no se puede agregar personal.');
      return;
    }
    addPeopleData = data;
    $('landing').style.display = 'none';
    $('app').style.display = 'block';
    $('app').classList.add('modo-agregar-personal');
    document.body.classList.add('modo-agregar-personal');
    actualizarPendientes(); // aquí solo se agrega gente: el resto del formulario no aplica
    $('statusBanner').className = 'status-banner open';
    $('statusBannerText').textContent = 'Permiso abierto — agregando personal sin cerrarlo';
    $('permitCodeDisplay').textContent = data.permitCode;
    execCounter = 0;
    execBody.innerHTML = '';
    (data.ejecutantes || []).forEach((row) => addExecRow(row));
    baseExecCount = execCounter; // todo lo que se agregue DESPUÉS de este punto es "nuevo" para esta sesión
    opIdAddWorkers = null;
    addExecRow(); // fila extra en blanco lista para la persona nueva
    // Mismo arreglo que en loadOpenDataIntoForm: asegura el tamaño real de
    // los lienzos (la sección recién se hizo visible con modo-agregar-personal)
    // antes de dibujar las firmas ya guardadas de los ejecutantes existentes.
    refreshPadsIn(execBody);
    applyPendingExecSignatures();
    $('addPeopleStatus').textContent = '';
  }
  function renderClosedPermits(rows) {
    const listEl = $('closedList');
    if (rows.length === 0) {
      listEl.innerHTML = '<em>No hay permisos cerrados aún.</em>';
      return;
    }
    listEl.innerHTML = '';
    rows
      .slice()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .forEach((r) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px 10px;border:1px solid var(--line);border-radius:var(--r-xs);margin-bottom:6px;background:var(--n-50);cursor:pointer;';
        const updTxt = r.updatedAt
          ? new Date(r.updatedAt).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—';
        div.innerHTML = `<b>${esc(r.permitCode)}</b> <span style="color:var(--ok);float:right;font-weight:700;">CERRADO</span>
          <div style="margin-top:3px;color:var(--steel);">Responsable: ${r.responsable ? esc(r.responsable) : '<em>sin dato</em>'}</div>
          ${r.sitio ? `<div style="color:var(--muted);font-size:var(--fs-menor);">Sitio: ${esc(r.sitio)}</div>` : ''}
          <div style="color:var(--muted);font-size:var(--fs-menor);">Actualizado: ${updTxt}</div>
          <div style="color:var(--muted);font-size:var(--fs-menor);margin-top:3px;">Toca para ver el permiso completo</div>`;
        // Antes estas tarjetas eran solo texto: no había forma de abrir un
        // permiso ya cerrado desde la lista. Ahora abren el modo consulta.
        div.addEventListener('click', () => openCloseModeWithCode(r.permitCode));
        listEl.appendChild(div);
      });
  }
  function renderOpenList(container, rows, onPick) {
    if (rows.length === 0) {
      container.innerHTML = '<em>No hay permisos abiertos.</em>';
      return;
    }
    container.innerHTML = '';
    rows.forEach((r) => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px 10px;border:1px solid var(--line);border-radius:var(--r-xs);margin-bottom:6px;cursor:pointer;background:#fff;';
      div.innerHTML = `<b>${esc(r.permitCode)}</b> <span style="color:var(--muted);float:right;">${r.status}</span>
        <div style="margin-top:3px;color:var(--steel);">Abierto por: ${r.responsable ? esc(r.responsable) : '<em>sin dato</em>'}</div>
        ${r.sitio ? `<div style="color:var(--muted);font-size:var(--fs-menor);">Sitio: ${esc(r.sitio)}</div>` : ''}`;
      div.addEventListener('click', () => onPick(r.permitCode));
      container.appendChild(div);
    });
  }

  /* ================= WIRING (llamado una vez desde init) ================= */
  function wireEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-clear]');
      if (!btn) return;
      if (locked && !btn.closest('#closeFields')) return;
      const id = btn.dataset.clear;
      if (pads[id]) pads[id].clear();
    });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-undo]');
      if (!btn) return;
      if (locked && !btn.closest('#closeFields')) return;
      const id = btn.dataset.undo;
      if (pads[id]) pads[id].undo();
    });

    const addRowBtn = $(cfg.addRowBtnId || 'addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', () => { if (!locked) addExecRow(); });

    // Quita la marca roja de un campo en tiempo real, apenas el usuario lo completa
    // (sin esperar a que vuelva a intentar guardar).
    $('app').addEventListener(
      'blur',
      (e) => {
        const el = e.target;
        if (!el.classList || !el.classList.contains('field-invalid')) return;
        if ((el.value || '').trim()) el.classList.remove('field-invalid');
      },
      true
    );
    $('app').addEventListener('input', (e) => {
      const el = e.target;
      if (el.classList && el.classList.contains('field-invalid') && (el.value || '').trim()) el.classList.remove('field-invalid');
    });
    $('app').addEventListener('click', () => {
      (cfg.checklistGroups || []).forEach((g) => {
        const cont = $(g.containerId);
        if (!cont || !cont.classList.contains('field-invalid')) return;
        if (Object.values(states[g.stateKey] || {}).every((v) => v !== null)) cont.classList.remove('field-invalid');
      });
      document.querySelectorAll('input[name=q1],input[name=q2],input[name=q3],input[name=q4]').forEach((r) => {
        if (r.checked) r.closest('.field')?.classList.remove('field-invalid');
      });
    });

    $('cardNew').addEventListener('click', startNewPermit);
    ponerOpcionRepetir_();
    if (typeof Jornada !== 'undefined') Jornada.barra();
    $('loadCodeBtn').addEventListener('click', async () => {
      const code = $('codeInput').value.trim();
      if (!code) {
        await Dialogo.avisar('Escribe el código del permiso.');
        return;
      }
      openCloseModeWithCode(code);
    });

    $('loadAddPeopleBtn').addEventListener('click', () => {
      cargarParaAgregarPersonal($('addPeopleCodeInput').value.trim());
    });
    $('listOpenForAddBtn').addEventListener('click', async () => {
      const listEl = $('openListForAdd');
      listEl.innerHTML = 'Buscando…';
      const rows = await fetchOpenList();
      renderOpenList(listEl, rows, (code) => cargarParaAgregarPersonal(code));
    });
    $('backFromAddPeopleBtn').addEventListener('click', () => {
      $('app').classList.remove('modo-agregar-personal');
      document.body.classList.remove('modo-agregar-personal');
      $('app').style.display = 'none';
      $('landing').style.display = 'block';
      $('addPeopleCodeInput').value = '';
    });
    $('saveAddPeopleBtn').addEventListener('click', async () => {
      if (!addPeopleData) return;
      const statusEl = $('addPeopleStatus');
      const btn = $('saveAddPeopleBtn');
      btn.disabled = true;
      statusEl.textContent = 'Guardando…';
      // Solo se envían las filas NUEVAS agregadas en esta sesión (no el registro
      // completo) — antes esto reescribía TODO el permiso con collectOpenData(),
      // lo que significaba: (a) dos personas agregando gente al mismo permiso al
      // tiempo se pisaban entre sí, y (b) un reintento del Outbox podía sobrescribir
      // con datos viejos si la respuesta original se perdió mas el envío sí llegó.
      // El backend ahora aplica esto como un "solo agregar", bajo su propio
      // candado, leyendo el estado MÁS RECIENTE del permiso — no el que este
      // celular tenía cargado hace rato.
      const todasLasFilas = collectExecRows();
      const filasNuevas = todasLasFilas.slice(baseExecCount);
      const habNuevos = await revisarHabilitacion_(filasNuevas, true);
      if (habNuevos === null) { btn.disabled = false; statusEl.textContent = ''; return; }
      habNuevos.forEach((h) => { const f = filasNuevas.find((x) => String(x.cc || '').trim() === h.cedula); if (f) { f.habilitacion = h.problemas; if (h.excepcion) { f.excepcion = h.excepcion; f.autorizo = h.autorizo; } } });   // v145: la justificación de la excepción queda en el permiso
      if (!opIdAddWorkers) opIdAddWorkers = addPeopleData.permitCode + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const payload = { action: 'addWorkers', permitCode: addPeopleData.permitCode, newWorkers: filasNuevas, opId: opIdAddWorkers, token: PORTAL_CONFIG.API_TOKEN };
      let res;
      try {
        const r = await fetchWithRetry(getWebAppUrl(), { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
        res = await r.json();
      } catch (err) {
        // v147: sin señal el personal agregado queda en cola (mismo opId: el servidor no lo duplica).
        if (typeof Outbox !== 'undefined') {
          try { await Outbox.add(getWebAppUrl(), payload); opIdAddWorkers = null; btn.disabled = false;
            statusEl.textContent = 'Sin señal: el personal quedó guardado en este celular y se envía solo al volver la conexión.'; return; } catch (e2) {}
        }
        res = { ok: false, error: 'No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.' };
      }
      btn.disabled = false;
      if (res.ok) {
        const nombres = todasLasFilas.filter((f) => f.nombre && f.nombre.trim()).length;
        statusEl.textContent = '✓ Guardado — ' + new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        // Comprobar que el personal agregado realmente quedó: este camino
        // escribe solo las filas nuevas, así que un fallo aquí es fácil de
        // pasar por alto.
        const verifAdd = await verificarGuardado_(addPeopleData.permitCode, {
          permitCode: addPeopleData.permitCode,
          status: addPeopleData.status,
          ejecutantes: todasLasFilas,
          responsablesSigs: addPeopleData.responsablesSigs
        });
        if (verifAdd.estado === 'difiere') {
          statusEl.textContent = '⚠ El servidor confirmó pero al releer no coincide: ' + verifAdd.diferencias.join(' · ');
          await Dialogo.avisar('⚠ ATENCIÓN: se guardó el personal pero al releer el permiso no coincide:\n\n  · ' +
                verifAdd.diferencias.join('\n  · ') +
                '\n\nNo cierres esta página. Vuelve a guardar y verifica en el permiso.');
          return;
        }
        $('backFromAddPeopleBtn').style.cssText = 'background:var(--ok,var(--ok));color:#fff;border-color:var(--ok,var(--ok));font-weight:700;';
        baseExecCount = todasLasFilas.length; // lo recién guardado ya no cuenta como "nuevo" si se sigue agregando más
        opIdAddWorkers = null; // esta operación ya se completó; la siguiente necesita su propia clave
        await Dialogo.avisar(
          `✓ Personal guardado correctamente.\n\nEste permiso ahora tiene ${nombres} ejecutante(s) registrado(s) en total.\n\nPuedes seguir agregando más gente, o tocar "Volver al inicio" cuando termines.`
        );
      } else {
        statusEl.textContent = res.error || 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.';
        await Dialogo.avisar(Errores.texto('pudo guardar', res));
      }
    });

    const btnHist = $('historyBtn');
    if (btnHist) btnHist.addEventListener('click', () => {
      const cont = $('historialPermiso');
      // Segundo toque: se cierra. Es un panel de consulta, no algo permanente.
      if (cont && cont.classList.contains('show')) {
        cont.classList.remove('show');
        cont.innerHTML = '';
        btnHist.textContent = 'Ver historial';
        return;
      }
      btnHist.textContent = 'Ocultar historial';
      verHistorialDelPermiso();
    });

    $('listOpenBtn').addEventListener('click', async () => {
      const listEl = $('openList');
      listEl.innerHTML = 'Buscando…';
      const rows = await fetchOpenList();
      renderOpenList(listEl, rows, (code) => openCloseModeWithCode(code));
    });
    $('listClosedBtn').addEventListener('click', async () => {
      const panel = $('historyPanel');
      const listEl = $('closedList');
      const opening = panel.style.display === 'none';
      panel.style.display = opening ? 'block' : 'none';
      if (!opening) return;
      listEl.innerHTML = 'Buscando…';
      closedPermitsCache = await fetchClosedList();
      renderClosedPermits(closedPermitsCache);
    });
    $('historySearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        renderClosedPermits(closedPermitsCache);
        return;
      }
      renderClosedPermits(closedPermitsCache.filter((r) => (r.permitCode || '').toLowerCase().includes(q) || (r.responsable || '').toLowerCase().includes(q)));
    });

    $('mainActionBtn').addEventListener('click', async () => {
      const btn = $('mainActionBtn');
      hideValidationBanner();
      if (MODE === 'open') {
        const missing = validateOpenData();
        if (missing.length > 0) {
          showMissing(missing);
          return;
        }
      } else if (MODE === 'close') {
        const missing = validateCloseData();
        if (missing.length > 0) {
          showMissing(missing);
          return;
        }
      }
      const habAdvertencias = MODE === 'open' ? await revisarHabilitacion_(collectExecRows()) : [];
      if (habAdvertencias === null) return;
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Guardando…';
      if (MODE === 'open') {
        const data = collectOpenData();
        if (habAdvertencias.length) data.habilitacion = habAdvertencias;
        data.firstSave = !firstSaveDone; // le dice al backend si esto es la primera vez que se guarda este código
        if (!opIdApertura) {
          opIdApertura = permitCode + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        }
        data.opId = opIdApertura;
        let res = await sendToSheet(data);
        let intentosColision = 0;
        // Si el backend detecta que este código ya existe con OTRO permiso distinto
        // (colisión, muy improbable pero posible con generación aleatoria), se genera
        // un código nuevo y se reintenta automáticamente, sin que el usuario lo note.
        while (res.error === 'CODE_COLLISION' && intentosColision < 3) {
          intentosColision++;
          permitCode = genCode();
          $('permitCodeDisplay').textContent = permitCode;
          data.permitCode = permitCode;
          // Código nuevo ⇒ operación distinta: necesita su propia clave. Si se
          // reusara la anterior, el backend la vería como reenvío ya aplicado y
          // daría por guardado algo que en realidad no se escribió.
          opIdApertura = permitCode + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
          data.opId = opIdApertura;
          res = await sendToSheet(data);
        }
        if (res.ok) {
          firstSaveDone = true; try { recordarUltimoPermiso_(); } catch (e) {}
          avisarAlAts_(); // por si el código cambió (colisión) antes de guardarse
          if (typeof Jornada !== 'undefined') Jornada.marcarPermiso(tipoDeEstaPagina_(), permitCode, atsRelacionado);
          $('statusBanner').className = 'status-banner open';
          $('statusBannerText').textContent = 'Permiso guardado en la hoja ✓ — comparte el código con quien hará el cierre';
          $('footerStatus').textContent = 'Código del permiso: ' + permitCode;
          // Releer del servidor y comparar ANTES de dar el permiso por bueno y
          // de borrar el borrador: si algo no quedó, lo diligenciado no se pierde.
          const verif = await verificarGuardado_(permitCode, data);
          if (await mostrarVerificacion_(verif, 'apertura')) {
            lockOpenSections();
            mostrarQrDelPermiso();
            DraftStore.clear(draftKeyOpen());
          } else {
            btn.disabled = false; // se puede reintentar sin volver a llenar nada
          }
        } else {
          btn.disabled = false;
          if (typeof Outbox !== 'undefined') {
            try {
              await Outbox.add(getWebAppUrl(), Object.assign({}, data, { token: PORTAL_CONFIG.API_TOKEN }));
              if (typeof Jornada !== 'undefined') Jornada.marcarPermiso(tipoDeEstaPagina_(), permitCode, atsRelacionado, true);
              $('footerStatus').textContent = MSG_EN_COLA;
            } catch (e) {
              $('footerStatus').textContent = 'No se pudo guardar ni en el servidor ni localmente (memoria llena o modo privado). Copie los datos de este permiso antes de salir de la página.';
            }
          } else {
            $('footerStatus').textContent = res.error || 'Sin conexión — quedó guardado y se reintentará solo. Verás un aviso abajo mientras esté pendiente.';
          }
        }
      } else if (MODE === 'close') {
        const openData = collectOpenData();
        const closeData = collectCloseData();
        const full = Object.assign({}, openData, { status: 'CERRADO' }, closeData);
        const res = await sendToSheet(full);
        if (res.ok) {
          $('statusBanner').className = 'status-banner closed';
          $('statusBannerText').textContent = 'Permiso cerrado y guardado en la hoja ✓';
          $('footerStatus').textContent = 'El registro quedó actualizado en Google Sheets.';
          const verif = await verificarGuardado_(permitCode, full);
          if (await mostrarVerificacion_(verif, 'cierre')) {
            DraftStore.clear(draftKeyClose(permitCode));
          } else {
            btn.disabled = false;
          }
        } else {
          btn.disabled = false;
          if (typeof Outbox !== 'undefined') {
            try {
              await Outbox.add(getWebAppUrl(), Object.assign({}, full, { token: PORTAL_CONFIG.API_TOKEN }));
              $('footerStatus').textContent = MSG_EN_COLA;
            } catch (e) {
              $('footerStatus').textContent = 'No se pudo guardar ni en el servidor ni localmente (memoria llena o modo privado). Copie los datos de este permiso antes de salir de la página.';
            }
          } else {
            $('footerStatus').textContent = res.error || 'Sin conexión — quedó guardado y se reintentará solo. Verás un aviso abajo mientras esté pendiente.';
          }
        }
      }
      btn.textContent = originalText;
    });

    $('app').addEventListener('input', () => {
      if (MODE === 'open') {
        dismissOpenDraftBannerOnEdit();
        saveOpenDraftDebounced();
      } else if (MODE === 'close') {
        saveCloseDraftDebounced();
      }
    });
    ['change', 'click', 'mouseup', 'touchend'].forEach((evt) => {
      $('app').addEventListener(evt, () => {
        if (MODE === 'open') {
          dismissOpenDraftBannerOnEdit();
          saveOpenDraftDebounced();
        } else if (MODE === 'close') {
          saveCloseDraftDebounced();
        }
      });
    });

    $('printBtn').addEventListener('click', imprimirHoja);
    $('backToStartBtn').addEventListener('click', () => {
      $('footerActions').style.display = 'none';
      location.href = 'index.html';
    });

    // Si se llega desde un enlace con ?code=XXX (ej. desde el dashboard de permisos),
    // abre ese permiso directamente en modo consulta/cierre, sin pasar por la pantalla de inicio.
    const codeFromUrl = new URLSearchParams(location.search).get('code');
    if (!codeFromUrl && new URLSearchParams(location.search).get('desdeAts') === '1') {
      // Después de que la página termine de definir sus selectores (herramientas,
      // gases…): init() corre antes de eso y abrir el permiso aquí mismo fallaba.
      setTimeout(() => { startNewPermit(); history.replaceState(null, '', location.pathname); }, 0);
    }
    if (codeFromUrl) {
      $('codeInput').value = codeFromUrl;
      openCloseModeWithCode(codeFromUrl);
    }

    window.addEventListener('load', () => {
      if (typeof UpdateManager !== 'undefined') UpdateManager.init();
      if (typeof Outbox !== 'undefined') Outbox.flush(); // reintenta lo pendiente si ya hay señal al abrir la página
    });
  }

  let saveOpenDraftDebounced = null;
  let saveCloseDraftDebounced = null;

  /* ================= REPETIR UN PERMISO ANTERIOR =================
     En trabajos de varios días se volvía a escribir todo el permiso cada
     mañana. Ahora se elige uno anterior de este mismo tipo y se copia lo que
     DESCRIBE el trabajo (descripción, sitio, herramientas, equipos, EPP,
     cálculos, ejecutantes y responsables), pero NO lo que se debe hacer de
     nuevo hoy: las verificaciones del checklist (C / SÍ / NO), las mediciones
     de gases, las observaciones y TODAS las firmas. Las fechas quedan en hoy.
     El permiso nuevo es otro registro, con su propio código, y guarda de cuál
     se copió (copiadoDe). */
  let copiadoDe = null;
  const NO_COPIAR_ = ['permitCode', 'status', 'createdAt', 'closedAt', 'updatedAt', 'openedAt', 'cierreFecha', 'cierreHora', 'motivoCierre',
    'q1', 'q2', 'q3', 'q4', 'cierre1', 'cierre2', 'atsRelacionado', 'copiadoDe', 'yn', 'gases', 'observaciones',
    '_appliedOps', 'firstSave', 'opId', 'ok'];
  function sinFirmas_(v) {
    if (Array.isArray(v)) return v.map(sinFirmas_);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach((k) => { o[k] = sinFirmas_(v[k]); }); return o; }
    return (typeof v === 'string' && (v.indexOf('data:image') === 0 || v.indexOf('SIGREF:') === 0)) ? null : v;
  }
  function copiaParaRepetir_(data) {
    const c = sinFirmas_(JSON.parse(JSON.stringify(data || {})));
    NO_COPIAR_.forEach((k) => { delete c[k]; });
    (cfg.checklistGroups || []).forEach((g) => { delete c[g.stateKey]; });
    (cfg.closeSigners || []).forEach((x) => { delete c[x.field]; });
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    const hoy = d.toISOString().slice(0, 10);
    c.desdeFecha = hoy; c.hastaFecha = hoy;
    return c;
  }
  function ponerOpcionRepetir_() {
    const nueva = $('cardNew');
    if (!nueva || $('cardRepetir')) return;
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.id = 'cardRepetir';
    card.innerHTML = '<div class="icon" aria-hidden="true">' + (typeof Iconos !== 'undefined' ? Iconos.senal('repetir', 'grande') : '') + '</div><h3>Repetir un permiso anterior</h3>' +
      '<p>Para trabajos de varios días: copia la descripción, el sitio, los equipos y el personal de un permiso anterior. Las verificaciones, mediciones y firmas se hacen de nuevo hoy.</p>';
    nueva.parentNode.insertBefore(card, nueva.nextSibling);
    card.addEventListener('click', elegirParaRepetir_);
    let ult = null; try { ult = JSON.parse(localStorage.getItem(CLAVE_ULT_PERMISO) || 'null'); } catch (e) {}
    if (ult && ult.code) {
      const b = document.createElement('button');
      b.type = 'button'; b.id = 'btnRepetirAyer'; b.className = 'btn-main';
      b.style.cssText = 'display:block;width:100%;min-height:52px;margin:0 0 12px;font-weight:700;';
      b.textContent = 'Repetir mi último permiso (' + ult.code + (ult.sitio ? ' · ' + ult.sitio : '') + ')';
      b.addEventListener('click', () => repetirPermiso_(ult.code));
      nueva.parentNode.insertBefore(b, nueva);
    }
  }
  const CLAVE_ULT_PERMISO = 'ssta-ultimo-permiso-' + location.pathname.split('/').pop();
  function recordarUltimoPermiso_() {
    const el = $('sitio') || $('areaAlt');
    try { localStorage.setItem(CLAVE_ULT_PERMISO, JSON.stringify({ code: permitCode, sitio: el ? el.value : '' })); } catch (e) {}
    recordarSitio_();
  }
  async function elegirParaRepetir_() {
    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:84vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);color:var(--ink);';
    fondo.appendChild(caja); document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    const cab = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><h3 style="margin:0;font-size:var(--fs-campo);">¿Qué permiso repetir?</h3>' +
      '<button type="button" data-cerrar style="border:1px solid var(--line);background:#fff;border-radius:var(--r-s);padding:7px 12px;font-weight:700;cursor:pointer;">Cancelar</button></div>' +
      '<input type="search" id="repBuscar" placeholder="Buscar por código, sitio o responsable…" style="width:100%;border:1.5px solid var(--line);border-radius:var(--r-s);padding:11px 12px;font-size:var(--fs-titulo);margin:12px 0 10px;">';
    caja.innerHTML = cab + '<div id="repLista" style="text-align:center;color:var(--ink-soft);font-size:var(--fs-base);padding:14px;">Buscando permisos anteriores…</div>';
    caja.querySelector('[data-cerrar]').onclick = cerrar;
    let rows = [];
    try {
      const res = await fetchWithRetry(getWebAppUrl() + '?' + listQuery() + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const d = await res.json();
      if (!d || !d.ok || !Array.isArray(d.rows)) throw new Error((d && d.error) || 'el servidor no respondió con datos');
      rows = d.rows.slice().sort((a, b) => String(b.openedAt || b.updatedAt || '').localeCompare(String(a.openedAt || a.updatedAt || ''))).slice(0, 60);
    } catch (e) {
      $('repLista').innerHTML = '<div style="background:var(--rojo-50);border:1px solid var(--rojo-200);color:var(--rojo-900);border-radius:var(--r-m);padding:11px;text-align:left;">No se pudieron traer los permisos: ' + esc(e.message || 'sin conexión') + '.</div>';
      return;
    }
    const pinta = () => {
      const q = ($('repBuscar').value || '').trim().toLowerCase();
      const lista = rows.filter((r) => !q || [r.permitCode || r.code, r.sitio, r.responsable].some((v) => String(v || '').toLowerCase().includes(q)));
      if (!lista.length) { $('repLista').innerHTML = '<div style="padding:14px;color:var(--ink-soft);">No hay permisos que coincidan.</div>'; return; }
      $('repLista').innerHTML = lista.slice(0, 25).map((r) => {
        const code = r.permitCode || r.code;
        const f = String(r.openedAt || r.updatedAt || '').slice(0, 10);
        return '<button type="button" data-rep="' + esc(code) + '" style="display:block;width:100%;text-align:left;border:1.5px solid var(--line);background:#fff;border-radius:var(--r-m);padding:10px 12px;margin-bottom:8px;cursor:pointer;font-family:inherit;">' +
          '<b class="u-fs-base">' + esc(code) + '</b><span style="float:right;font-size:var(--fs-etiqueta);font-weight:700;border-radius:var(--r-xl);padding:2px 8px;background:' + (r.status === 'ABIERTO' ? '#e3f4ea;color:var(--ok)' : '#eef1f4;color:var(--ink-soft)') + ';">' + esc(r.status || '') + '</span><br>' +
          '<span style="font-size:var(--fs-menor);">' + esc(r.sitio || 'Sin sitio') + '</span><br><span style="font-size:var(--fs-etiqueta);color:var(--ink-soft);">' + esc([f, r.responsable].filter(Boolean).join(' · ')) + '</span></button>';
      }).join('');
      $('repLista').style.textAlign = 'left'; $('repLista').style.padding = '0';
      $('repLista').querySelectorAll('[data-rep]').forEach((b) => { b.onclick = () => { cerrar(); repetirPermiso_(b.dataset.rep); }; });
    };
    $('repBuscar').addEventListener('input', pinta);
    pinta();
  }
  async function repetirPermiso_(code) {
    const data = await fetchFromSheet(code);
    if (!data) return;
    startNewPermit();
    const copia = copiaParaRepetir_(data);
    copia.permitCode = permitCode;            // el código NUEVO, no el del permiso copiado
    loadOpenDataIntoForm(copia);
    atsRelacionado = null; pintarAtsRelacionado_();
    copiadoDe = code;
    const ejec = (copia.ejecutantes || []).filter((x) => x && x.nombre).length;
    $('footerStatus').textContent = 'Datos tomados del permiso ' + code + '. Verifica en campo, completa y firma.';
    if (saveOpenDraftDebounced) saveOpenDraftDebounced();
    if (typeof actualizarPendientes === 'function') try { actualizarPendientes(); } catch (e) {}
    await Dialogo.avisar('Se copió el permiso ' + code + ': descripción, sitio, equipos y ' + ejec + ' ejecutante(s).\n\nLas fechas quedaron en HOY. Las verificaciones (C / SÍ / NO), las mediciones y TODAS las firmas se hacen de nuevo: revisa en campo antes de firmar.');
  }

  /* ================= PERMISO ABIERTO DESDE UN ATS =================
     Antes el ATS y sus permisos eran registros sueltos: las mismas personas
     se escribían dos veces y nada decía qué permiso iba con qué ATS. Ahora el
     ATS abre el permiso con ?desdeAts=1 y deja en este equipo los datos del
     trabajo y del personal; el permiso los toma, guarda el código del ATS
     (atsRelacionado, queda en la hoja con el resto del permiso) y le avisa al
     ATS qué código de permiso se generó. */
  let atsRelacionado = null;
  let codigoAvisadoAlAts = null;
  const CLAVE_PREFILL_ATS = 'ssta-prefill-permiso';
  function tipoDeEstaPagina_() {
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const f = location.pathname.split('/').pop();
    return Object.keys(B).find((k) => B[k].archivo === f) || null;
  }
  function avisarAlAts_() {
    if (!atsRelacionado || !permitCode) return;
    const k = 'ssta-ats-permisos:' + atsRelacionado;
    let l = [];
    try { l = JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { l = []; }
    const tipo = tipoDeEstaPagina_();
    l = l.filter((x) => x.code !== permitCode && x.code !== codigoAvisadoAlAts);
    l.push({ tipo, code: permitCode, nombre: cfg && cfg.nombre ? cfg.nombre : ((PORTAL_CONFIG.BACKENDS[tipo] || {}).nombre || ''), t: Date.now() });
    try { localStorage.setItem(k, JSON.stringify(l)); } catch (e) { /* memoria llena */ }
    codigoAvisadoAlAts = permitCode;
  }
  function pintarAtsRelacionado_() {
    let chip = $('atsRelacionadoChip');
    if (!atsRelacionado) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'atsRelacionadoChip';
      chip.className = 'ats-relacionado';
      const sb = $('statusBanner');
      if (sb && sb.parentNode) sb.parentNode.insertBefore(chip, sb.nextSibling);
    }
    chip.innerHTML = '🧭 ATS relacionado: <a href="ats.html?code=' + encodeURIComponent(atsRelacionado) + '&ver=1"><b>' + esc(atsRelacionado) + '</b></a>';
  }
  async function aplicarPrefillDesdeAts_() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(CLAVE_PREFILL_ATS) || 'null'); } catch (e) { p = null; }
    if (!p || Date.now() - (p.t || 0) > 30 * 60000) return false;
    const tipo = tipoDeEstaPagina_();
    if (p.tipo && tipo && p.tipo !== tipo) return false;
    try { localStorage.removeItem(CLAVE_PREFILL_ATS); } catch (e) {}
    atsRelacionado = p.atsCode || null;
    const poner = (ids, v) => {
      if (!v) return;
      for (const id of ids) {
        const el = $(id);
        if (el && !String(el.value || '').trim()) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return; }
      }
    };
    poner(['descripcion', 'descripcionAlt'], p.trabajo);
    poner(['sitio', 'areaAlt'], p.sitio);
    poner(['desdeFecha', 'fechaInicioAlt'], p.desde);
    poner(['desdeHora', 'horaInicioAlt'], p.horaDesde);
    poner(['hastaFecha', 'fechaCulminacionAlt'], p.hasta || p.desde);
    poner(['hastaHora', 'horaCulminacionAlt'], p.horaHasta);
    poner(['responsable'], p.responsable);
    // Ejecutantes: primero las filas vacías que ya existen, después filas nuevas.
    (p.personas || []).forEach((per) => {
      let n = null;
      for (let i = 1; i <= execCounter; i++) {
        const el = $('execNombre' + i);
        if (el && !el.value.trim()) { n = i; break; }
      }
      if (n === null) n = addExecRow();
      if ($('execNombre' + n)) $('execNombre' + n).value = per.nombre || '';
      if ($('execCC' + n)) $('execCC' + n).value = per.cc || '';
      if ($('execCargo' + n)) $('execCargo' + n).value = per.cargo || '';
    });
    if (execBody) refreshPadsIn(execBody);
    avisarAlAts_();
    pintarAtsRelacionado_();
    await Dialogo.avisar('🧭 Se trajeron del ATS' + (atsRelacionado ? ' ' + atsRelacionado : '') + ': descripción, sitio, fechas y ' + (p.personas || []).length + ' persona(s).\n\nRevísalos y completa el permiso. Cada ejecutante firma aquí.');
    if (saveOpenDraftDebounced) saveOpenDraftDebounced();
    return true;
  }

  /* ================= HOJA COMPACTA PARA IMPRIMIR / PDF =================
     Antes se imprimía el formulario tal como se ve en pantalla: una pregunta
     por renglón con botones grandes, pensado para el dedo. Un permiso lleno
     salía en 6 a 9 hojas. Ahora, al imprimir, se arma una hoja en tablas como
     la del ATS (carta horizontal): campos de a tres por renglón, preguntas de
     a dos con su respuesta, firmas en cuadrícula y ejecutantes en una tabla.

     Se arma LEYENDO lo que está en pantalla (no los datos guardados), así
     sirve igual para los cinco permisos, con sus secciones propias (gases en
     confinados, cálculos y EPCC en alturas, tensiones en eléctrico) y
     siempre imprime exactamente lo que la persona ve. Lo oculto no sale. */
  const fechaHoja_ = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v.slice(8, 10) + '-' + v.slice(5, 7) + '-' + v.slice(0, 4) : v);
  const limpio_ = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  function visibleHoja_(el) { return el.type === 'hidden' || el.getClientRects().length > 0; }
  function textoPropio_(el) {
    return limpio_([...el.childNodes].filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('progress-pill') && n.tagName !== 'BUTTON')).map((n) => n.textContent).join(''));
  }
  function valorHoja_(el) {
    if (el.tagName === 'SELECT') { const o = el.options[el.selectedIndex]; return el.value && o ? limpio_(o.textContent) : ''; }
    if (el.type === 'date') return fechaHoja_(el.value);
    return String(el.value || '').trim();
  }
  function respuestaHoja_(g) {
    if (!g) return '';
    const a = g.querySelector('.active-si,.active-no,.active-na,.active-c,button[aria-pressed="true"]');
    return a ? limpio_(a.textContent) : '';
  }
  function firmaHoja_(canvas) {
    if (!canvas) return null;
    const p = pads[canvas.id];
    if (p) return p.hasInk && !p.hasInk() ? null : p.getDataUrl();
    try { return canvas.toDataURL('image/png'); } catch (e) { return null; }
  }
  const NOMBRES_OCULTOS_ = { cualPermiso: '¿Cuál permiso adicional?', herramientas: 'Herramientas y/o equipos', gasesDetecta: 'Gases que detecta el equipo' };
  function etiquetaPrevia_(el) {
    let prev = el.previousElementSibling;
    while (prev && !limpio_(prev.textContent) && prev.tagName !== 'LABEL') prev = prev.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'B' || prev.classList.contains('tension-sub'))) return limpio_(prev.textContent);
    return NOMBRES_OCULTOS_[el.id] || '';
  }
  function campoHoja_(field, items) {
    const lab = field.querySelector(':scope > label');
    const etiqueta = lab ? limpio_(lab.textContent) : '';
    const yn = field.querySelector('.yn-opts, .toggle');
    if (yn) { items.push({ t: 'qa', q: etiqueta, a: respuestaHoja_(yn) }); return; }
    const vals = [];
    let largo = false;
    field.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.type === 'radio') { if (el.checked) vals.push(limpio_(el.parentElement.textContent) || el.value); return; }
      if (el.type === 'checkbox') { if (el.checked) vals.push(limpio_(el.parentElement.textContent) || el.value); return; }
      if (el.type !== 'hidden' && !visibleHoja_(el)) return;
      if (el.tagName === 'TEXTAREA') largo = true;
      const v = valorHoja_(el);
      if (v) vals.push(v);
    });
    const v = vals.join(' · ');
    items.push({ t: 'campo', l: etiqueta, v, largo: largo || v.length > 70 || !etiqueta });
  }
  function tablaHoja_(tabla) {
    const c = tabla.cloneNode(true);
    const orig = [...tabla.querySelectorAll('input, select, textarea, .yn-opts, .toggle')];
    [...c.querySelectorAll('input, select, textarea, .yn-opts, .toggle')].forEach((el, i) => {
      const o = orig[i];
      let v = '';
      if (o.classList && (o.classList.contains('yn-opts') || o.classList.contains('toggle'))) v = respuestaHoja_(o);
      else if (o.type === 'checkbox' || o.type === 'radio') v = o.checked ? '☒' : '☐';
      else v = valorHoja_(o);
      el.replaceWith(document.createTextNode(v));
    });
    c.querySelectorAll('button').forEach((b) => b.remove());
    c.removeAttribute('id'); c.removeAttribute('style'); c.className = 'hp-tabla';
    c.querySelectorAll('[style]').forEach((x) => x.removeAttribute('style'));
    return c.outerHTML;
  }
  function recolectarHoja_(nodo, items) {
    for (const el of nodo.children) {
      if (!visibleHoja_(el)) continue;
      const c = el.classList;
      if (c.contains('section-title') || c.contains('sig-actions') || c.contains('add-row-btn') || c.contains('autocomplete-box') ||
          c.contains('tension-sub') || el.tagName === 'BUTTON' || el.tagName === 'CANVAS' || el.id === 'closeLockedMsg' || /Sel$/.test(el.id)) continue;
      if (c.contains('check-cat') && el.querySelector('.check-item')) {
        const h = el.querySelector('h4');
        if (h) items.push({ t: 'sub', x: limpio_((h.querySelector('.cat-nombre') || h).textContent) });
        el.querySelectorAll('.check-item').forEach((ci) => items.push({ t: 'qa', q: limpio_((ci.querySelector('p') || ci).textContent), a: respuestaHoja_(ci.querySelector('.toggle')) }));
        continue;
      }
      if (c.contains('check-item')) { items.push({ t: 'qa', q: limpio_((el.querySelector('p') || el).textContent), a: respuestaHoja_(el.querySelector('.toggle')) }); continue; }
      if (c.contains('yn-row')) { items.push({ t: 'qa', q: limpio_((el.querySelector('.yn-label') || el).textContent), a: respuestaHoja_(el.querySelector('.yn-opts')) }); continue; }
      if (c.contains('close-q')) {
        const ch = el.querySelector('input:checked');
        items.push({ t: 'qa', q: limpio_((el.querySelector('p') || el).textContent), a: ch ? limpio_(ch.parentElement.textContent) || ch.value : '' });
        continue;
      }
      if (c.contains('exec-card')) {
        const campos = [...el.querySelectorAll('.exec-fields input, .exec-fields select')];
        items.push({ t: 'ejec',
          cab: campos.map((i) => limpio_((i.placeholder || (i.tagName === 'SELECT' && i.options[0] ? i.options[0].textContent : '')).replace(/\(escribe para buscar\)/i, ''))),
          vals: campos.map(valorHoja_), firma: firmaHoja_(el.querySelector('canvas')) });
        continue;
      }
      if (c.contains('sig-block')) {
        const vals = [...el.querySelectorAll('input:not([type=hidden]), select')].map(valorHoja_).filter(Boolean);
        items.push({ t: 'firma', rol: limpio_((el.querySelector('h5') || {}).textContent), nombre: vals.join(' · '), firma: firmaHoja_(el.querySelector('canvas')) });
        continue;
      }
      if (c.contains('sig-pad-wrap')) {
        items.push({ t: 'firma', rol: limpio_((el.querySelector('label') || {}).textContent) || 'Firma', nombre: '', firma: firmaHoja_(el.querySelector('canvas')) });
        continue;
      }
      if (c.contains('calc-row')) {
        const sp = el.querySelectorAll('span'), inp = el.querySelector('input');
        items.push({ t: 'campo', l: limpio_(sp[0] ? sp[0].textContent : ''), v: inp ? valorHoja_(inp) : limpio_(sp[sp.length - 1].textContent) });
        continue;
      }
      if (el.tagName === 'TABLE') { items.push({ t: 'tabla', html: tablaHoja_(el) }); continue; }
      // Bitácora de lecturas de gases (confinados): una fila por lectura.
      if (c.contains('gasLog')) {
        const lecturas = [...el.children].filter((x) => x.querySelector('[data-del-lectura]'));
        if (!lecturas.length) { items.push({ t: 'nota', x: 'Lecturas registradas: ninguna.' }); continue; }
        items.push({ t: 'sub', x: 'Lecturas registradas (' + lecturas.length + ')' });
        lecturas.forEach((lec) => {
          const partes = [...lec.children];
          const cab = partes[0] ? limpio_(partes[0].textContent.replace(/Eliminar\s*$/, '')) : '';
          // En blanco y negro 🔴 y 🟢 se ven iguales: se escribe el estado.
          const vals = partes[1] ? [...partes[1].querySelectorAll('span')].map((x) => {
            const t = limpio_(x.textContent);
            if (t.indexOf('🔴') === 0) return '⚠ ' + limpio_(t.slice(2)) + ' FUERA DE RANGO';
            if (t.indexOf('🟢') === 0) return limpio_(t.slice(2)) + ' ✓';
            return t;
          }).join('   ') : '';
          items.push({ t: 'campo', l: cab, v: vals, largo: true });
        });
        continue;
      }
      if (c.contains('gasAlertBanner')) { items.push({ t: 'nota', x: limpio_(el.textContent), fuerte: true }); continue; }
      if (c.contains('section-note') || c.contains('alert-result') || el.tagName === 'P') {
        const x = limpio_(el.textContent);
        if (x) items.push({ t: 'nota', x, fuerte: c.contains('alert-result') });
        continue;
      }
      if (c.contains('field')) { campoHoja_(el, items); continue; }
      if (c.contains('radio-row')) {
        const ch = el.querySelector('input:checked');
        const labPropio = [...el.children].find((x) => x.tagName === 'LABEL' && !x.querySelector('input'));
        const extra = [...el.querySelectorAll('select')].map(valorHoja_).filter(Boolean);
        const v = [ch ? limpio_(ch.parentElement.textContent) || ch.value : ''].concat(extra).filter(Boolean).join(' · ');
        items.push({ t: 'campo', l: labPropio ? limpio_(labPropio.textContent) : etiquetaPrevia_(el), v });
        continue;
      }
      // Grupo de casillas (EPP de confinados, tensiones de eléctrico…): se
      // imprimen todas las opciones marcadas ☒ o no ☐, como en el ATS.
      const casillas = [...el.children].filter((x) => x.tagName === 'LABEL' && x.querySelector('input[type=checkbox]'));
      if (casillas.length >= 2) {
        const v = casillas.map((x) => (x.querySelector('input').checked ? '☒ ' : '☐ ') + limpio_(x.textContent)).join('   ');
        const l = etiquetaPrevia_(el);
        items.push({ t: 'campo', l, v, largo: true });
        continue;
      }
      if (el.tagName === 'B' || el.tagName === 'STRONG' || el.tagName === 'H4' || el.tagName === 'H5') { items.push({ t: 'sub', x: limpio_(el.textContent) }); continue; }
      if (el.tagName === 'LABEL' && !el.querySelector('input')) continue; // se usa como etiqueta del bloque siguiente
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.type === 'radio' || el.type === 'checkbox') continue;
        const v = valorHoja_(el);
        if (el.type === 'hidden' && !v) continue;
        items.push({ t: 'campo', l: etiquetaPrevia_(el) || limpio_(el.placeholder), v, largo: el.tagName === 'TEXTAREA' || v.length > 70 });
        continue;
      }
      recolectarHoja_(el, items);
    }
  }
  function bloquesHoja_(items) {
    // Agrupa elementos seguidos del mismo tipo (los subtítulos van con las preguntas).
    const out = [];
    items.forEach((it) => {
      const tipo = it.t === 'sub' ? 'qa' : it.t;
      const ult = out[out.length - 1];
      if (ult && ult.tipo === tipo && tipo !== 'tabla') ult.items.push(it);
      else out.push({ tipo, items: [it] });
    });
    return out;
  }
  function htmlBloque_(b) {
    const e = esc;
    if (b.tipo === 'campo') {
      let h = '<table class="hp-campos"><colgroup><col style="width:13%"><col style="width:20.33%"><col style="width:13%"><col style="width:20.33%"><col style="width:13%"><col style="width:20.34%"></colgroup>';
      let fila = [];
      const cerrarFila = () => {
        if (!fila.length) return;
        while (fila.length < 3) fila.push('<td class="l"></td><td></td>');
        h += '<tr>' + fila.join('') + '</tr>'; fila = [];
      };
      b.items.forEach((it) => {
        if (it.largo) {
          cerrarFila();
          h += '<tr>' + (it.l ? '<td class="l">' + e(it.l) + '</td><td colspan="5">' + e(it.v) + '</td>' : '<td colspan="6">' + e(it.v) + '</td>') + '</tr>';
        } else {
          fila.push('<td class="l">' + e(it.l) + '</td><td>' + e(it.v) + '</td>');
          if (fila.length === 3) cerrarFila();
        }
      });
      cerrarFila();
      return h + '</table>';
    }
    if (b.tipo === 'qa') {
      let h = '<table class="hp-qa"><colgroup><col style="width:42%"><col style="width:8%"><col style="width:42%"><col style="width:8%"></colgroup>';
      let par = [];
      const cerrar = () => {
        if (!par.length) return;
        if (par.length === 1) par.push('<td></td><td></td>');
        h += '<tr>' + par.join('') + '</tr>'; par = [];
      };
      b.items.forEach((it) => {
        if (it.t === 'sub') { cerrar(); h += '<tr><td colspan="4" class="sub">' + e(it.x) + '</td></tr>'; return; }
        par.push('<td>' + e(it.q) + '</td><td class="a">' + e(it.a) + '</td>');
        if (par.length === 2) cerrar();
      });
      cerrar();
      return h + '</table>';
    }
    if (b.tipo === 'firma') {
      let h = '<table class="hp-firmas"><colgroup><col><col><col></colgroup>';
      for (let i = 0; i < b.items.length; i += 3) {
        h += '<tr>' + [0, 1, 2].map((k) => {
          const it = b.items[i + k];
          if (!it) return '<td></td>';
          return '<td><div class="rol">' + e(it.rol) + '</div><div class="img">' + (it.firma ? '<img src="' + it.firma + '" alt="firma">' : '') + '</div><div class="nom">' + e(it.nombre) + '</div></td>';
        }).join('') + '</tr>';
      }
      return h + '</table>';
    }
    if (b.tipo === 'ejec') {
      const cab = b.items[0].cab;
      let h = '<table class="hp-ejec"><thead><tr><th style="width:4%">N°</th>' + cab.map((x) => '<th>' + e(x) + '</th>').join('') + '<th style="width:20%">Firma</th></tr></thead><tbody>';
      b.items.forEach((it, i) => {
        h += '<tr><td class="a">' + (i + 1) + '</td>' + it.vals.map((v) => '<td>' + e(v) + '</td>').join('') + '<td class="firma">' + (it.firma ? '<img src="' + it.firma + '" alt="firma">' : '') + '</td></tr>';
      });
      return h + '</tbody></table>';
    }
    if (b.tipo === 'nota') return '<table><tr><td class="nota">' + b.items.map((it) => (it.fuerte ? '<b>' + e(it.x) + '</b>' : e(it.x))).join('<br>') + '</td></tr></table>';
    if (b.tipo === 'tabla') return b.items.map((it) => it.html).join('');
    return '';
  }
  function armarHojaImpresion() {
    const app = $('app');
    const hdr = app.querySelector('.hdr');
    const titulo = limpio_((hdr.querySelector('h1') || {}).textContent);
    const meta = hdr.querySelector('.meta') ? hdr.querySelector('.meta').innerText.split(/\n| · /).map(limpio_).filter(Boolean) : [];
    const estado = limpio_(($('statusBannerText') || {}).textContent);
    const qrImg = $('qrPermiso') && $('qrPermiso').querySelector('img');
    const secciones = [...app.querySelectorAll('.section')].filter(visibleHoja_).map((sec) => {
      const t = sec.querySelector('.section-title');
      const items = [];
      recolectarHoja_(sec, items);
      return { titulo: t ? textoPropio_(t) : '', items };
    });
    let h = '<div class="hp">' +
      '<table class="hp-cab"><colgroup><col style="width:14%"><col><col style="width:22%">' + (qrImg ? '<col style="width:12%">' : '') + '</colgroup><tr>' +
      '<td class="hp-logo"><img src="' + (logoHoja_ || EMPRESA.logo) + '" alt="Logo"></td>' +
      '<td class="hp-tit">' + esc(titulo) + '<div>' + (permitCode ? 'Registro ' + esc(permitCode) + ' · ' : '') + esc(estado) + '</div>' +
      (atsRelacionado ? '<div>ATS relacionado: <b>' + esc(atsRelacionado) + '</b></div>' : '') +
      (copiadoDe ? '<div>Datos tomados del permiso ' + esc(copiadoDe) + ' (verificado y firmado de nuevo)</div>' : '') + '</td>' +
      '<td class="hp-meta">' + meta.map(esc).join('<br>') + '<br><span>Respuestas: C = cumple · SÍ / NO · NA = no aplica</span></td>' +
      (qrImg ? '<td class="hp-qr"><img src="' + qrImg.src + '" alt="QR"><div>Escanea para abrir este permiso</div></td>' : '') +
      '</tr></table>';
    secciones.forEach((sec) => {
      h += '<div class="hp-sec"><table><tr><td class="hp-st">' + esc(sec.titulo) + '</td></tr></table>';
      if (!sec.items.length) h += '<table><tr><td class="nota">' + (/cierre/i.test(sec.titulo) ? 'Pendiente de cierre.' : '—') + '</td></tr></table>';
      bloquesHoja_(sec.items).forEach((b) => { h += htmlBloque_(b); });
      h += '</div>';
    });
    h += '<div class="hp-pie">Impreso el ' + esc(new Date().toLocaleString('es-CO')) + ' desde el ' + esc(Empresa.pie()) + '</div></div>';
    let cont = $('hojaPermiso');
    if (!cont) { cont = document.createElement('div'); cont.id = 'hojaPermiso'; document.body.appendChild(cont); }
    cont.innerHTML = h;
    // Carta horizontal, como el ATS. Se inyecta aquí (y no en common.css) para
    // no cambiar la orientación de las otras páginas que usan common.css.
    if (!$('paginaHojaPermiso')) {
      const st = document.createElement('style');
      st.id = 'paginaHojaPermiso';
      st.textContent = '@media print{@page{size:letter landscape;margin:8mm;}}';
      document.head.appendChild(st);
    }
    document.body.classList.add('hp-lista');
  }
  let hojaArmadaEn_ = 0;
  function prepararImpresion() {
    hojaArmadaEn_ = Date.now();
    try { armarHojaImpresion(); }
    catch (e) {
      // Si algo del armado falla, se imprime el formulario como antes: nunca
      // debe quedar alguien sin poder imprimir el permiso.
      document.body.classList.remove('hp-lista');
      console.error('Hoja compacta:', e);
    }
  }
  // Las imágenes recién puestas (logo, firmas, QR) deben alcanzar a cargar
  // antes de abrir el diálogo de impresión; si no, salen en blanco.
  function imagenesListas_(cont, maxMs) {
    const imgs = [...cont.querySelectorAll('img')].filter((i) => !i.complete);
    if (!imgs.length) return Promise.resolve();
    return Promise.race([
      Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
      new Promise((r) => setTimeout(r, maxMs || 2000))
    ]);
  }
  async function imprimirHoja() {
    prepararImpresion();
    const cont = $('hojaPermiso');
    if (cont) await imagenesListas_(cont, 2000);
    window.print();
  }
  // El logo se guarda como dataURL: así sale siempre, incluso al imprimir
  // desde el menú del navegador (no hay tiempo de esperar a que cargue).
  let logoHoja_ = null;
  try {
    fetch(EMPRESA.logo).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (!b) return;
      const fr = new FileReader();
      fr.onload = () => { logoHoja_ = fr.result; };
      fr.readAsDataURL(b);
    }).catch(() => {});
  } catch (e) { /* sin logo: la hoja sale igual */ }
  // Imprimir desde el menú del navegador (o compartir → imprimir en el
  // celular) también usa la hoja compacta. Si el botón acaba de armarla, no se
  // vuelve a armar: las imágenes nuevas no alcanzarían a cargar.
  window.addEventListener('beforeprint', () => {
    if (Date.now() - hojaArmadaEn_ < 5000) return;
    if ($('app') && $('app').offsetParent !== null) prepararImpresion();
  });

  /* ================= INIT ================= */
  function init(userCfg) {
    cfg = userCfg;
    execBody = $('execBody');
    OfflineBanner.init();
    OutboxBadge.init();
    if (typeof ScrollProgress !== 'undefined' && cfg.themeColor) ScrollProgress.init(cfg.themeColor);
    cargarPersonalCompartido();
    saveOpenDraftDebounced = debounce(() => {
      if (MODE !== 'open') return;
      DraftStore.save(draftKeyOpen(), collectOpenData());
    }, 1200);
    saveCloseDraftDebounced = debounce(() => {
      if (MODE !== 'close') return;
      DraftStore.save(draftKeyClose(permitCode), collectCloseData());
    }, 1200);
    wireEvents();
    conectarPersonalACamposComunes();
    // Personal habilitado: aviso debajo de la cédula de cada ejecutante.
    if (typeof Habilitacion !== 'undefined') Habilitacion.vigilar(document, '#execBody [id^="execCC"]', () => [tipoDeEstaPagina_()]);
    if (new URLSearchParams(location.search).get('debug') === '1') initDebugPanel_();
  }

  /* Conecta la base de personal a los campos donde antes había que escribir el
     nombre completo a mano: responsable del trabajo y los firmantes del cierre.
     Es la misma lista que ya usan los ejecutantes, así que los nombres quedan
     escritos igual en todo el permiso — antes el mismo trabajador podía aparecer
     de tres formas distintas según quién lo escribiera. */
  function conectarPersonalACamposComunes() {
    const responsable = $('responsable');
    if (responsable) {
      attachPersonalAutocomplete(responsable, (p) => { responsable.value = p.nombre; });
    }
    const signers = cfg.closeSigners || [
      { idPrefix: 'cierre1', combined: false },
      { idPrefix: 'cierre2', combined: false }
    ];
    signers.forEach((s) => {
      if (s.combined) {
        // Campo único "Nombre — Cédula": se rellenan los dos de una vez.
        const el = $(s.idPrefix);
        if (el) attachPersonalAutocomplete(el, (p) => { el.value = p.nombre + ' — ' + p.cedula; });
      } else {
        const nom = $(s.idPrefix + 'nombre');
        if (!nom) return;
        attachPersonalAutocomplete(nom, (p) => {
          nom.value = p.nombre;
          const cc = $(s.idPrefix + 'cc'); if (cc) cc.value = p.cedula;
          const cargo = $(s.idPrefix + 'cargo'); if (cargo && !cargo.value) cargo.value = p.cargo || '';
        });
      }
    });
    // Campos propios de un tipo de permiso (ej. el inspector de accesos en
    // alturas): cada página los declara en cfg.personalFields.
    (cfg.personalFields || []).forEach((f) => {
      const nom = $(f.nombre);
      if (!nom) return;
      attachPersonalAutocomplete(nom, (p) => {
        nom.value = p.nombre;
        if (f.cc && $(f.cc)) $(f.cc).value = p.cedula;
        if (f.cargo && $(f.cargo)) $(f.cargo).value = p.cargo || '';
      });
    });
  }

  /* ================= HISTORIAL DEL PERMISO (BITÁCORA) =================
     Cada backend registra en la hoja "Eventos" una fila por CADA intento de
     escritura: aplicado, rechazado o duplicado. Es la mejor herramienta de
     diagnóstico que tiene el portal — con ella se encontraron dos de los tres
     fallos graves que ha tenido — pero para leerla había que entrar a la hoja
     de cálculo.

     Aquí se consulta desde el propio permiso. Sirve en una auditoría y cuando
     alguien pregunta por qué un permiso quedó como quedó. */
  const ETIQUETA_ACCION = {
    ABRIR: 'Apertura del permiso',
    ACTUALIZAR: 'Modificación',
    CERRAR: 'Cierre del permiso',
    ADD_WORKERS: 'Personal agregado',
    MIGRACION: 'Migración de datos'
  };

  async function verHistorialDelPermiso() {
    const cont = $('historialPermiso');
    if (!cont || !permitCode) return;
    cont.classList.add('show');
    cont.innerHTML = '<div class="hp-titulo">Historial del permiso</div>' +
                     '<div class="hp-cuerpo"><div class="hp-vacio">Consultando…</div></div>';
    const url = getWebAppUrl();
    if (!url) { cont.innerHTML = ''; cont.classList.remove('show'); return; }
    try {
      const res = await fetchWithRetry(url + '?action=history&code=' + encodeURIComponent(permitCode) +
                                       '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const data = await res.json();
      const eventos = (data.ok && Array.isArray(data.eventos)) ? data.eventos : [];
      let cuerpo;
      if (!eventos.length) {
        // Los permisos anteriores a la bitácora no tienen eventos: conviene
        // decirlo en vez de dejar un recuadro vacío que parezca un error.
        cuerpo = '<div class="hp-vacio">No hay eventos registrados para este permiso. ' +
                 'Puede ser anterior a que existiera la bitácora.</div>';
      } else {
        cuerpo = eventos.slice().reverse().map((ev) => {
          const r = String(ev.resultado || '').toLowerCase();
          const f = new Date(ev.ts);
          const cuando = isNaN(f.getTime()) ? String(ev.ts || '')
            : f.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
              ' · ' + f.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
          return '<div class="hp-evento">' +
            '<span class="hp-marca ' + esc(r) + '">' + esc(ev.resultado || '—') + '</span>' +
            '<span class="hp-txt"><b>' + esc(ETIQUETA_ACCION[ev.accion] || ev.accion || '—') + '</b>' +
            (ev.detalle ? ' — ' + esc(ev.detalle) : '') +
            '<span class="hp-cuando">' + esc(cuando) + '</span></span></div>';
        }).join('');
      }
      cont.innerHTML = '<div class="hp-titulo">Historial del permiso · ' + esc(permitCode) + '</div>' +
                       '<div class="hp-cuerpo">' + cuerpo + '</div>';
    } catch (e) {
      cont.innerHTML = '<div class="hp-titulo">Historial del permiso</div>' +
        '<div class="hp-cuerpo"><div class="hp-vacio">No se pudo consultar. ' +
        'El historial necesita señal.</div></div>';
    }
  }

  /* ================= CÓDIGO QR DEL PERMISO =================
     Quien abre el permiso tiene que pasarle el código a quien lo cierra, y
     dictar "PTC-20260914-259129" por radio o por teléfono es una fuente segura
     de errores. El QR lleva la dirección que abre ESE permiso: se escanea y
     entra directo, sin escribir nada.

     Aparece al guardar y sale en la impresión, para pegar la hoja en el sitio
     de trabajo. Se genera aquí mismo (qr.js) y no con un servicio de internet,
     porque en planta muchas veces no hay señal y una imagen pedida a otro sitio
     no cargaría justo cuando se necesita. */
  function mostrarQrDelPermiso() {
    if (typeof QR === 'undefined' || !permitCode) return;
    const cont = $('qrPermiso');
    if (!cont) return;
    const url = location.origin + location.pathname + '?code=' + encodeURIComponent(permitCode);
    try {
      cont.innerHTML =
        '<img src="' + QR.comoImagen(url, { px: 220 }) + '" alt="Código QR del permiso ' + esc(permitCode) + '">' +
        '<div class="qr-pie"><b>' + esc(permitCode) + '</b><span>Escanea para abrir y cerrar este permiso</span></div>';
      cont.classList.add('show');
    } catch (e) {
      cont.classList.remove('show');   // si algo falla, el permiso sigue igual
    }
  }

  /* ================= VERIFICACIÓN DESPUÉS DE GUARDAR =================

     Este portal ha perdido datos EN SILENCIO tres veces: las firmas que
     superaban el máximo de una celda de Sheets, las lecturas de gases con ids
     duplicados, y los reenvíos que el backend descartaba por confundirlos con
     un reintento. En los tres casos el servidor respondía "ok", la pantalla
     decía "guardado" y el dato no quedaba. Se descubrieron por casualidad,
     semanas o días después.

     La causa de fondo es siempre la misma: NADA comprobaba que lo guardado
     quedara guardado. Eso es lo que hace esto: después de cada guardado exitoso
     vuelve a leer el permiso del servidor y compara lo esencial con lo que se
     envió. Si no coincide, avisa fuerte y NO borra el borrador.

     No compara todo el contenido a propósito: el servidor añade campos propios
     (_appliedOps, marcas de tiempo) y quita otros, así que una comparación
     exacta daría falsas alarmas constantes y nadie volvería a creerle. Compara
     lo que de verdad importa para un permiso: que exista, en qué estado quedó,
     cuánta gente tiene y — sobre todo — cuántas firmas. */

  function contarFirmas_(lista) {
    if (!Array.isArray(lista)) return 0;
    return lista.filter((x) => x && typeof x.sig === 'string' && x.sig.length > 100).length;
  }

  /** Reduce un permiso a las pocas cosas que deben coincidir sí o sí. */
  function resumenVerificable_(data) {
    if (!data) return null;
    const r = {
      code: data.permitCode || data.code || '',
      status: data.status || '',
      ejecutantes: Array.isArray(data.ejecutantes) ? data.ejecutantes.length : 0,
      firmasEjecutantes: contarFirmas_(data.ejecutantes),
      firmasResponsables: contarFirmas_(data.responsablesSigs)
    };
    // Cada tipo de permiso puede sumar lo suyo (ej. las lecturas de gases en
    // espacios confinados, que fue justo uno de los datos que se perdía).
    if (cfg.resumenVerificable) {
      try { Object.assign(r, cfg.resumenVerificable(data) || {}); } catch (e) {}
    }
    return r;
  }

  const ETIQUETAS_VERIF = {
    code: 'código del permiso',
    status: 'estado',
    ejecutantes: 'cantidad de ejecutantes',
    firmasEjecutantes: 'firmas de ejecutantes',
    firmasResponsables: 'firmas de responsables',
    lecturas: 'lecturas de gases'
  };

  /**
   * Relee el permiso del servidor y compara. Devuelve:
   *   { estado:'ok' }                      todo coincide
   *   { estado:'difiere', diferencias:[] } se guardó algo distinto
   *   { estado:'sin-verificar', motivo }   no se pudo comprobar (sin señal…)
   */
  async function verificarGuardado_(code, enviado) {
    const url = getWebAppUrl();
    if (!url) return { estado: 'sin-verificar', motivo: 'sin backend configurado' };
    try {
      const res = await fetchWithRetry(url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(PORTAL_CONFIG.API_TOKEN));
      const guardado = await res.json();
      if (!guardado || guardado.ok === false) {
        return { estado: 'difiere', diferencias: ['el permiso no aparece en el servidor'] };
      }
      const a = resumenVerificable_(enviado);
      const b = resumenVerificable_(guardado);
      const diferencias = [];
      Object.keys(a).forEach((k) => {
        if (a[k] !== b[k]) {
          diferencias.push((ETIQUETAS_VERIF[k] || k) + ': se envió ' + a[k] + ' y quedó ' + b[k]);
        }
      });
      return diferencias.length ? { estado: 'difiere', diferencias } : { estado: 'ok' };
    } catch (e) {
      return { estado: 'sin-verificar', motivo: 'no se pudo releer del servidor' };
    }
  }

  /** Muestra el resultado y decide si se puede dar el guardado por bueno. */
  async function mostrarVerificacion_(verif, contexto) {
    const st = $('footerStatus');
    if (verif.estado === 'ok') {
      if (st) st.textContent = (st.textContent || '') + ' · Verificado en el servidor ✓';
      return true;
    }
    if (verif.estado === 'sin-verificar') {
      if (st) st.textContent = (st.textContent || '') + ' · No se pudo verificar (' + verif.motivo + '). Revisa el permiso cuando tengas señal.';
      return true; // el envío fue correcto; solo no se pudo confirmar
    }
    // Difiere: esto es grave y tiene que verse.
    const detalle = verif.diferencias.join('\n  · ');
    if (st) st.textContent = '⚠ Lo guardado NO coincide con lo enviado. NO cierres esta página.';
    $('statusBanner').className = 'status-banner warn';
    $('statusBannerText').textContent = '⚠ El guardado no quedó completo — revisa antes de continuar';
    await Dialogo.avisar(
      '⚠ ATENCIÓN: el servidor confirmó el guardado, pero al releer el permiso\n' +
      'los datos NO coinciden con lo que se envió:\n\n  · ' + detalle + '\n\n' +
      'Lo que diligenciaste sigue en esta página y el borrador NO se borró.\n' +
      'Vuelve a guardar. Si se repite, avisa antes de dar el permiso por bueno.'
    );
    return false;
  }

  // ================= PANEL DE DIAGNÓSTICO (solo con ?debug=1 en la URL) =================
  // No afecta el funcionamiento normal del portal — es un panel flotante, visible SOLO
  // si se pide explícitamente por la URL, para poder ver en pantalla (sin consola ni
  // cable) el estado real de los pads de firma en un dispositivo específico: si hay
  // tinta capturada (hasInk), si getDataUrl() devuelve algo, y cualquier error de
  // JavaScript que ocurra en la página mientras se prueba. Se puede quitar este bloque
  // (y la línea que lo llama arriba) cuando ya no haga falta.
  function initDebugPanel_() {
    const panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:var(--n-1000);color:#0f0;font:11px/1.4 monospace;padding:10px;border-radius:var(--r-s);max-height:45vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.5);';
    panel.innerHTML =
      '<div style="display:flex;gap:6px;margin-bottom:6px;">' +
      '<button id="dbgRefrescar" style="flex:1;padding:8px;font-weight:700;">Ver estado de firmas</button>' +
      '<button id="dbgCerrar" style="padding:8px 12px;">✕</button>' +
      '</div><pre id="dbgOut" style="margin:0;white-space:pre-wrap;word-break:break-all;"></pre>';
    document.body.appendChild(panel);
    const out = panel.querySelector('#dbgOut');
    function log(line) {
      out.textContent += line + '\n';
      panel.scrollTop = panel.scrollHeight;
    }
    panel.querySelector('#dbgCerrar').addEventListener('click', () => panel.remove());
    panel.querySelector('#dbgRefrescar').addEventListener('click', () => {
      out.textContent = '--- ' + new Date().toLocaleTimeString('es-CO') + ' ---\n';
      const ids = Object.keys(pads);
      if (!ids.length) { log('(no hay pads registrados todavía)'); return; }
      ids.forEach((id) => {
        const p = pads[id];
        let info;
        try {
          const url = p.getDataUrl();
          info = 'hasInk=' + p.hasInk() + ' | getDataUrl()=' + (url ? url.length + ' caracteres' : 'null');
        } catch (err) {
          info = '⚠️ ERROR al leer: ' + err.name + ': ' + err.message;
        }
        log(id + '  →  ' + info);
      });
    });
    window.addEventListener('error', (e) => {
      log('⚠️ ERROR JS: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')');
    });
    log('Panel de diagnóstico activo. Firma, luego toca "Ver estado de firmas" antes Y después de tocar Guardar, para comparar.');
  }

  return {
    TOGGLE_2STATE,
    TOGGLE_3STATE,
    init,
    getMode: () => MODE,
    getPermitCode: () => permitCode,
    isLocked: () => locked,
    getState: (key) => states[key],
    prepararImpresion,
    // Expuestos para los hooks extraOnInitRender/extraCollectOpenData/etc. de
    // tipos con subsistemas propios (ej. gases/EPP en confinados).
    setupPad,
    getPad: (id) => pads[id] || null,   // v110: firmas propias de un tipo (inspector de acceso en alturas)
    refreshPadsIn,
    attachPersonalAutocomplete,
    renderToggleGroup,
    updateProgress,
    applyToggleState,
    downloadJson,
    // Expuestos para pantallas propias de un tipo (ej. la "lectura rápida"
    // de confinados) que necesitan hablar con el backend fuera del flujo
    // genérico open/close.
    getWebAppUrl,
    sendToSheet,
    fetchFromSheet,
    // La lista de permisos abiertos también se reusa desde esas pantallas
    // propias, para no duplicar la consulta ni el formato de la lista.
    fetchOpenList,
    renderOpenList,
    // Verificación de lo guardado: se expone para que las pantallas propias de
    // un permiso (como la lectura de gases) puedan comprobar igual que el núcleo.
    verificarGuardado: verificarGuardado_,
    resumenVerificable: resumenVerificable_
  };
})();

/* v143: los campos de código y los botones repetidos dicen para qué son (lector de pantalla) */
(function () {
  if (typeof document === 'undefined') return;
  const poner = () => {
    const a = (id, t) => { const el = document.getElementById(id); if (el && !el.getAttribute('aria-label')) el.setAttribute('aria-label', t); };
    a('codeInput', 'Código del permiso a cerrar'); a('addPeopleCodeInput', 'Código del permiso al que se agrega personal');
    a('listOpenBtn', 'Ver permisos abiertos para cerrar uno'); a('listOpenForAddBtn', 'Ver permisos abiertos para agregar personal');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
})();
