/* ============================================================
   registros.js — Formularios por esquema para los módulos de planeación
   (matriz de peligros, emergencias, plan anual, salud, documental y
   revisión por la dirección). Cada módulo describe sus campos y aquí se
   pintan, se leen y se guardan igual en todos.
     campo = { k, l (etiqueta), t: text|textarea|date|month|number|select|check|checks|persona,
               op: [opciones o [valor, etiqueta]], ph, ayuda, req, medio (va de a dos por fila), def }
   ============================================================ */
const Registros = (function () {
  let n = 0;
  function campoHTML(c, v, id) {
    const val = v == null ? (c.def == null ? '' : c.def) : v;
    const ph = c.ph ? ' placeholder="' + esc(c.ph) + '"' : '';
    let inp;
    if (c.t === 'textarea') inp = '<textarea id="' + id + '"' + ph + '>' + esc(val) + '</textarea>';
    else if (c.t === 'select') {
      // Un valor escrito en «Otro» (que no está en la lista) se conserva al volver a abrir el registro.
      const vals = c.op.map((o) => String(Array.isArray(o) ? o[0] : o)), propio = val !== '' && vals.indexOf(String(val)) === -1 && vals.some((x) => /^otr[oa]s?\b/i.test(x));
      inp = '<select id="' + id + '">' + (c.vacio ? '<option value="">—</option>' : '') + c.op.map((o) => { const ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o;
        return '<option value="' + esc(ov) + '"' + (String(ov) === String(val) ? ' selected' : '') + '>' + esc(ol) + '</option>' + (propio && /^otr[oa]s?\b/i.test(String(ov)) ? '<option value="' + esc(val) + '" data-otro-txt="1" selected>Otro: ' + esc(val) + '</option>' : ''); }).join('') + '</select>';
    }
    else if (c.t === 'check') return '<label class="check"><input type="checkbox" id="' + id + '"' + (val === true || val === 'Sí' ? ' checked' : '') + '> ' + esc(c.l) + '</label>';
    else if (c.t === 'checks') return '<div class="field"><label>' + esc(c.l) + '</label><div class="chips" id="' + id + '">' + c.op.map((o) => { const ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o; return '<button type="button" data-v="' + esc(ov) + '" class="' + ((val || []).map(String).indexOf(String(ov)) !== -1 ? 'on' : '') + '">' + esc(ol) + '</button>'; }).join('') + '</div>' + (c.ayuda ? '<div class="ayuda">' + esc(c.ayuda) + '</div>' : '') + '</div>';
    else inp = '<input type="' + ({ date: 'date', month: 'month', number: 'number', tel: 'tel' }[c.t] || 'text') + '" id="' + id + '" value="' + esc(val) + '"' + ph + (c.t === 'number' ? ' inputmode="decimal" step="any"' : '') + (c.t === 'tel' ? ' inputmode="tel" autocomplete="off"' : '') + (c.t === 'persona' ? ' data-persona="1"' : '') + '>';
    return '<div class="field"><label>' + esc(c.l) + (c.req ? ' *' : '') + '</label>' + inp + (c.ayuda ? '<div class="ayuda">' + esc(c.ayuda) + '</div>' : '') + '</div>';
  }
  /** HTML del formulario. Los campos "medio" consecutivos van de a dos. */
  function form(campos, datos, pref) {
    pref = pref || ('rg' + (++n) + '_');
    datos = datos || {};
    let h = '', par = [];
    const vaciar = () => { if (par.length) { h += par.length === 2 ? '<div class="grid2">' + par.join('') + '</div>' : par[0]; par = []; } };
    campos.forEach((c) => {
      const x = campoHTML(c, datos[c.k], pref + c.k);
      if (c.medio && c.t !== 'check') { par.push(x); if (par.length === 2) vaciar(); }
      else { vaciar(); h += x; }
    });
    vaciar();
    return h;
  }
  function leer(campos, raiz, pref) {
    const o = {};
    campos.forEach((c) => {
      const el = raiz.querySelector('#' + pref + c.k); if (!el) return;
      if (c.t === 'check') o[c.k] = el.checked;
      else if (c.t === 'checks') o[c.k] = [...el.querySelectorAll('button.on')].map((b) => b.dataset.v);
      else if (c.t === 'number') o[c.k] = el.value === '' ? '' : Number(el.value);
      else o[c.k] = el.value.trim();
    });
    return o;
  }
  function faltan(campos, o) { return campos.filter((c) => c.req && (o[c.k] === '' || o[c.k] == null || (Array.isArray(o[c.k]) && !o[c.k].length))).map((c) => c.l); }
  function activar(raiz, alElegirPersona) {
    raiz.querySelectorAll('input[data-persona]').forEach((i) => UI.autocompletar(i, (p) => { i.value = p.nombre; if (alElegirPersona) alElegirPersona(i, p); }));
    raiz.querySelectorAll('.chips[id]').forEach((c) => c.addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) b.classList.toggle('on'); }));
  }
  /** Ventana con el formulario. alGuardar(valores) devuelve true si se puede cerrar. */
  function editar(o) {
    const pref = 'ed' + (++n) + '_';
    const m = UI.modal('<h3>' + esc(o.titulo) + '</h3>' + (o.antes || '') + form(o.campos, o.datos, pref) + (o.despues || '') +
      '<div data-adjuntos></div>' +
      '<button type="button" class="btn amber" data-guardar>' + esc(o.boton || 'Guardar') + '</button>' +
      (o.borrar ? '<button type="button" class="btn ghost u-mal" data-borrar>Borrar</button>' : '') +
      '<button type="button" class="btn ghost" data-cerrar>Cancelar</button><div class="status-msg" data-msg></div>', true);
    activar(m.el, o.alElegirPersona ? (i, p) => o.alElegirPersona(i, p, m.el, pref) : null);
    // Un registro ya guardado: adjuntos (Drive) e historial de cambios.
    const d0 = o.datos || {};
    if (d0.id && d0.version && !d0.nuevo && o.adjuntos !== false) {
      UI.adjuntos(m.el.querySelector('[data-adjuntos]'), { id: d0.id, lista: d0.adjuntos || [], refs: o.refsAdjuntos, alCambiar: (l) => { d0.adjuntos = l; } });
      m.el.querySelector('[data-cerrar]').insertAdjacentElement('beforebegin', UI.botonHistorial(d0.id, o.titulo));
    }
    if (o.alAbrir) o.alAbrir(m.el, pref);
    const msg = m.el.querySelector('[data-msg]');
    m.el.querySelector('[data-guardar]').addEventListener('click', async () => {
      const v = Object.assign({}, o.datos || {}, leer(o.campos, m.el, pref));
      const f = faltan(o.campos, v);
      if (f.length) {
        // v107: además de decir qué falta, se resalta cada campo vacío y se lleva la vista al primero.
        if (typeof Valida !== 'undefined') { Valida.limpiar(m.el); o.campos.filter((c) => f.indexOf(c.l) !== -1).forEach((c) => Valida.marcar(m.el.querySelector('#' + pref + c.k), 'falta')); const p1 = m.el.querySelector('.v-falta'); if (p1) try { p1.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }
        msg.textContent = 'Falta: ' + f.join(', ') + '.'; return;
      }
      const b = m.el.querySelector('[data-guardar]'); b.disabled = true; msg.textContent = 'Guardando…';
      let ok = false;
      try { ok = await o.alGuardar(v, m.el, pref); } catch (e) { msg.textContent = e.message; }
      b.disabled = false;
      if (ok === true) m.cerrar(); else if (typeof ok === 'string') msg.textContent = ok;
    });
    if (o.borrar) m.el.querySelector('[data-borrar]').addEventListener('click', async () => { if (!await Dialogo.confirmar('¿Borrar este registro?')) return; if (await o.borrar()) m.cerrar(); });
    return m;
  }
  /** Guarda un documento completo. Nuevo: versionBase 0 (si ya existía, conflicto). */
  async function guardar(tipo, id, doc, version) {
    const limpio = Object.assign({}, doc); ['id', 'tipo', 'version', 'creado', 'actualizado', 'pendiente', 'nuevo', 'adjuntos', 'registradoPor', 'modificadoPor'].forEach((k) => delete limpio[k]);
    const r = await SGSST.enviar({ action: 'guardar', tipo, id, doc: limpio, versionBase: version || 0 }, { fecha: '', titulo: '', resumen: limpio });
    if (r.ok && r.enCola) UI.toast('⏳ Guardado en el equipo; se envía al volver la señal.');
    if (!r.ok) return r.conflicto ? 'Otra persona cambió este registro. Ciérralo y vuelve a abrirlo.' : Errores.texto('guardó', r);
    return r;
  }
  async function borrar(id, motivo) {
    const r = await SGSST.enviar({ action: 'borrar', id, motivo: motivo || '' });
    if (!r.ok) { UI.toast(Errores.texto('borró', r), 'mal'); return false; }
    return true;
  }
  /** Abre el documento completo; si tiene cambios sin enviar desde este equipo, avisa. */
  async function abrir(id) {
    if (SGSST._lsGet('ssta-sgsst-pend', {})[id]) { UI.toast('Este registro tiene cambios sin enviar desde este equipo. Ábrelo cuando se envíen.', 'mal'); return null; }
    const d = await SGSST.doc(id);
    if (!d) { UI.toast('No se pudo abrir (¿sin señal?).', 'mal'); return null; }
    delete d.nuevo;   // un registro guardado nunca es nuevo (se edita con su versión)
    return d;
  }
  /** Crea en el plan de acción una acción por cada línea nueva (desde la n.º ya creadas) y anota
   *  cuántas van en el registro con un parche. Se llama DESPUÉS de guardar el registro. */
  async function accionesPorLinea(lineas, yaCreadas, tipo, id, base, pregunta) {
    const nuevas = lineas.slice(yaCreadas || 0);
    if (!nuevas.length) return yaCreadas || 0;
    if (!await Dialogo.confirmar(pregunta || ('¿Crear ' + nuevas.length + ' acción(es) en el plan de acción?'))) return yaCreadas || 0;
    const resp = await Dialogo.pedir('Responsable:', ''); if (!resp) return yaCreadas || 0;
    let n = yaCreadas || 0;
    for (const t of nuevas) { const r = await UI.guardarAccion(Object.assign({ responsable: resp }, base(t))); if (r.ok) n++; else break; }
    await SGSST.enviar({ action: 'parche', tipo, id, campos: { accionesCreadas: n } });
    return n;
  }
  const sumarMeses = (iso, m) => (iso ? Festivos.sumarMeses(iso, Number(m) || 0) : '');
  return { form, leer, faltan, activar, editar, guardar, borrar, abrir, sumarMeses, accionesPorLinea };
})();
