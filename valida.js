/* ============================================================
   valida.js — Reglas de datos de los formularios (v107)
   Que no se pueda poner "cualquier cosa": cédula solo con dígitos
   (6 a 10), nombres sin números, fechas que existen y que no son
   futuras cuando el hecho ya pasó, números ≥ 0. Marca en rojo cada
   campo con problema, le pone el motivo debajo y dice QUÉ falta.
   Lo usan Salud, Entrega de EPP e Inducción (se puede usar en otros).
   Además (Valida.auto, se activa solo en todas las páginas):
   · listas con «Otro»: aparece un campo para escribir cuál, y eso es lo que se guarda;
   · cédula y NIT solo con dígitos; teléfono y correo revisados al salir del campo;
   · números que no pueden ser negativos; fechas de lo que ya pasó, no futuras;
   · pares inicio / fin: el fin no puede quedar antes del inicio;
   · Valida.faltan(raiz, salida): dice QUÉ campos obligatorios faltan.
   ============================================================ */
const Valida = (function () {
  const LETRAS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
  const hoy = () => (typeof UI !== 'undefined' && UI.hoy) ? UI.hoy() : new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const txt = (v) => String(v == null ? '' : v).trim();

  /** "1.023.456.789" o "1023 456" → "1023456789" (puntos, espacios y guiones fuera). */
  function limpiarCedula(v) { return txt(v).replace(/[.\s,-]/g, ''); }
  /** '' si está bien; si no, el motivo. */
  function cedula(v) {
    const s = limpiarCedula(v);
    if (!s) return 'falta';
    if (!/^\d+$/.test(s)) return 'solo números, sin letras';
    if (s.length < 6 || s.length > 10) return 'debe tener de 6 a 10 dígitos (tiene ' + s.length + ')';
    if (/^(\d)\1+$/.test(s)) return 'no parece una cédula real';
    return '';
  }
  /** Nombre y apellido: solo letras, sin números ni símbolos. */
  function nombre(v, opc) {
    const s = txt(v); opc = opc || {};
    if (!s) return 'falta';
    if (/\d/.test(s)) return 'no puede llevar números';
    if (!new RegExp('^[' + LETRAS + "' .-]+$").test(s)) return 'solo letras (sin símbolos)';
    if (s.replace(new RegExp('[^' + LETRAS + ']', 'g'), '').length < 3) return 'es muy corto';
    if (opc.completo !== false && s.split(/\s+/).filter((p) => p.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '').length >= 2).length < 2) return 'escribe nombre y apellido';
    return '';
  }
  /** Texto que debe tener letras (no solo números o símbolos). */
  function texto(v, min) {
    const s = txt(v);
    if (!s) return 'falta';
    if (!new RegExp('[' + LETRAS + ']').test(s)) return 'escribe palabras, no solo números o símbolos';
    if (s.length < (min || 3)) return 'es muy corto';
    return '';
  }
  /** Fecha AAAA-MM-DD que existe. */
  function fecha(v) {
    const s = txt(v);
    if (!s) return 'falta';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'no es una fecha válida';
    const d = new Date(s + 'T12:00:00');
    if (isNaN(d) || d.toISOString().slice(0, 10) !== s) return 'no es una fecha válida';
    const a = Number(s.slice(0, 4)); if (a < 1950 || a > 2100) return 'el año no es válido';
    return '';
  }
  /** Para algo que YA pasó (un examen hecho, una entrega, una inducción). */
  function pasada(v) { const e = fecha(v); if (e) return e; return txt(v) > hoy() ? 'no puede ser posterior a hoy' : ''; }
  /** fin ≥ inicio (las dos opcionales: si falta alguna no se compara). */
  function orden(ini, fin, etiquetaIni) { return ini && fin && String(fin) < String(ini) ? 'no puede ser anterior a ' + (etiquetaIni || 'la fecha inicial') : ''; }
  /** Número entre min y max; entero si se pide. */
  function numero(v, o) {
    o = o || {};
    if (v === '' || v == null) return o.req ? 'falta' : '';
    const n = Number(v);
    if (!isFinite(n)) return 'no es un número';
    if (o.entero && !Number.isInteger(n)) return 'debe ser un número entero';
    if (o.min != null && n < o.min) return o.min === 0 ? 'no puede ser negativo' : 'debe ser ' + o.min + ' o más';
    if (o.max != null && n > o.max) return 'no puede pasar de ' + o.max;
    return '';
  }

  /* ── Marcado en pantalla ── */
  function estilos() {
    if (typeof document === 'undefined' || document.getElementById('valida-css')) return;
    const s = document.createElement('style'); s.id = 'valida-css';
    s.textContent = '.v-falta{border-color:var(--mal,var(--rojo-700))!important;background:var(--rojo-50)!important;}' +
      '.chips.v-falta{border:1.5px solid var(--mal,var(--rojo-700));border-radius:var(--r-m);padding:6px;background:var(--rojo-50);}' +
      '.v-msg{color:var(--mal,var(--rojo-700));font-size:var(--fs-menor);font-weight:700;margin-top:4px;line-height:1.3;}' +
      '.v-otro{margin-top:6px;width:100%;}' +
      '.v-resumen{background:var(--rojo-50);border:1.5px solid var(--mal,var(--rojo-700));color:var(--rojo-900);border-radius:var(--r-m);padding:8px 10px;font-size:var(--fs-base);line-height:1.4;margin-top:8px;text-align:left;}';
    document.head.appendChild(s);
  }
  function limpiar(raiz) {
    if (!raiz) return;
    raiz.querySelectorAll('.v-falta').forEach((e) => { e.classList.remove('v-falta'); e.removeAttribute('aria-invalid'); });
    raiz.querySelectorAll('.v-msg').forEach((e) => e.remove());
  }
  function marcar(el, msg) {
    if (!el) return; estilos();
    el.classList.add('v-falta'); el.setAttribute('aria-invalid', 'true');
    if (msg) { const m = document.createElement('div'); m.className = 'v-msg'; m.textContent = msg; el.insertAdjacentElement('afterend', m); }
    const quitar = () => { el.classList.remove('v-falta'); el.removeAttribute('aria-invalid'); const n = el.nextElementSibling; if (n && n.classList.contains('v-msg')) n.remove(); };
    el.addEventListener(el.classList.contains('chips') ? 'click' : 'input', quitar, { once: true });
    if (el.tagName === 'SELECT') el.addEventListener('change', quitar, { once: true });
  }
  /** reglas: [{ el, etiqueta, error }] → marca cada una, escribe el resumen en `salida` y
   *  devuelve la lista de problemas ([] = todo bien). */
  function revisar(raiz, reglas, salida) {
    limpiar(raiz); estilos();
    const problemas = [];
    reglas.forEach((r) => { const e = typeof r.error === 'function' ? r.error() : r.error; if (!e) return; problemas.push(r.etiqueta + ': ' + e); marcar(r.el, e); });
    if (salida) {
      salida.innerHTML = problemas.length ? '<div class="v-resumen"><b>Revisa ' + (problemas.length === 1 ? 'este dato' : 'estos ' + problemas.length + ' datos') + ':</b><br>• ' + problemas.map(escapar).join('<br>• ') + '</div>' : '';
    }
    const primero = raiz && raiz.querySelector('.v-falta');
    if (primero) { try { primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} if (primero.focus && primero.tagName !== 'DIV') try { primero.focus({ preventScroll: true }); } catch (e) {} }
    return problemas;
  }
  function escapar(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ── Ayudas al escribir ── */
  function soloDigitos(inp, max) {
    if (!inp || inp.dataset.vDig) return; inp.dataset.vDig = '1';
    inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('autocomplete', 'off'); inp.maxLength = (max || 10) + 4;
    inp.addEventListener('input', () => { const c = inp.value.replace(/\D/g, '').slice(0, max || 10); if (c !== inp.value) inp.value = c; });
  }
  function soloNombre(inp) {
    if (!inp || inp.dataset.vNom) return; inp.dataset.vNom = '1';
    inp.setAttribute('autocapitalize', 'words');
    inp.addEventListener('input', () => { const c = inp.value.replace(/[0-9]/g, ''); if (c !== inp.value) inp.value = c; });
  }
  function hastaHoy(inp) { if (inp) inp.max = hoy(); }


  /* ══ Capa automática (todas las páginas) ══ */
  const etiquetaDe = (el) => { const f = el.closest('.field, label, .grid2 > div, td'); const l = f && (f.tagName === 'LABEL' ? f : f.querySelector('label')); return txt((l && l.textContent) || el.getAttribute('aria-label') || el.placeholder || el.id || ''); };
  const pista = (el) => (etiquetaDe(el) + ' ' + (el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
  function correoMal(v) { return txt(v).split(/[,;\s]+/).filter(Boolean).find((c) => !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(c)); }
  /** «Otro»: la opción abre un campo para escribir; lo escrito queda como opción elegida (select.value = texto). */
  function otro(sel) {
    if (!sel || sel.dataset.vOtro || sel.multiple || sel.hasAttribute('data-sin-otro')) return;
    const op = [...sel.options].find((o) => /^otr[oa]s?(\b|\s|…|\.\.\.)/i.test(txt(o.textContent)) && txt(o.value) === txt(o.textContent));
    if (!op) return;
    sel.dataset.vOtro = '1';
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'v-otro'; inp.maxLength = 140;
    inp.placeholder = 'Escribe cuál'; inp.setAttribute('aria-label', 'Escribe cuál (' + etiquetaDe(sel).replace(/\*/g, '').trim() + ')'); inp.hidden = true;
    sel.insertAdjacentElement('afterend', inp);
    let propia = [...sel.options].find((o) => o.dataset.otroTxt) || null;
    const enOtro = () => { const o = sel.options[sel.selectedIndex]; return o === op || (o && !!o.dataset.otroTxt); };
    const ver = () => { inp.hidden = !enOtro(); if (propia && sel.options[sel.selectedIndex] === propia) inp.value = propia.value; };
    sel.addEventListener('change', () => { ver(); if (!inp.hidden && sel.options[sel.selectedIndex] === op) setTimeout(() => inp.focus(), 30); });
    inp.addEventListener('input', () => {
      const t = inp.value.replace(/\s+/g, ' ').trim();
      if (t) { if (!propia) { propia = new Option(t, t); propia.dataset.otroTxt = '1'; op.insertAdjacentElement('afterend', propia); } propia.text = 'Otro: ' + t; propia.value = t; propia.selected = true; }
      else { if (propia) { propia.remove(); propia = null; } op.selected = true; }
    });
    inp.addEventListener('change', () => sel.dispatchEvent(new Event('change', { bubbles: true })));
    sel._vOtroPoner = (v) => { if (!propia) { propia = new Option(v, v); propia.dataset.otroTxt = '1'; op.insertAdjacentElement('afterend', propia); } propia.text = 'Otro: ' + v; propia.value = v; propia.selected = true; inp.value = v; ver(); };
    ver();
  }
  /* sel.value = 'algo que no está en la lista' en una lista con «Otro» → queda como «Otro: algo». */
  if (typeof HTMLSelectElement !== 'undefined' && !HTMLSelectElement.prototype._vValor) {
    const d = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (d && d.set) {
      HTMLSelectElement.prototype._vValor = true;
      Object.defineProperty(HTMLSelectElement.prototype, 'value', { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); },
        set(v) { d.set.call(this, v); const s = v == null ? '' : String(v); if (s && d.get.call(this) !== s) { if (!this.dataset.vOtro) otro(this); if (this._vOtroPoner) this._vOtroPoner(s); } } });
    }
  }
  function mostrarError(el, msg) { const n = el.nextElementSibling; if (n && n.classList.contains('v-msg')) n.remove(); el.classList.remove('v-falta'); if (msg) marcar(el, msg); }
  function preparar(el) {
    if (!el || el.dataset.vAuto || el.closest('[data-sin-valida]')) return;
    el.dataset.vAuto = '1';
    if (el.tagName === 'SELECT') { otro(el); return; }
    if (el.tagName !== 'INPUT') return;
    const t = (el.type || 'text').toLowerCase(), q = pista(el);
    if (t === 'number') {
      if (el.min === '' && !/temperatura|diferencia|variaci|saldo|ajuste/.test(q)) el.min = '0';
      if (Number(el.min) >= 0) {
        el.addEventListener('keydown', (e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault(); });
        el.addEventListener('blur', () => mostrarError(el, el.value !== '' && Number(el.value) < Number(el.min) ? (Number(el.min) === 0 ? 'no puede ser negativo' : 'debe ser ' + el.min + ' o más') : (el.max !== '' && el.value !== '' && Number(el.value) > Number(el.max) ? 'no puede pasar de ' + el.max : '')));
      }
      return;
    }
    if (t === 'date') {
      if (/nacimiento|fecha (del|de la) (accidente|incidente|evento|suceso)|cu[aá]ndo (pas[oó]|ocurri[oó])/.test(q) && !el.max) el.max = hoy();
      el.addEventListener('blur', () => { if (!el.value) return mostrarError(el, ''); const e = fecha(el.value) || (el.max && el.value > el.max ? (el.max === hoy() ? 'no puede ser posterior a hoy' : 'no puede ser después del ' + el.max) : '') || (el.min && el.value < el.min ? 'no puede ser antes del ' + el.min.split('-').reverse().join('/') : ''); mostrarError(el, e); });
      if (/\b(fin|hasta|t[eé]rmino|terminaci[oó]n|cierre|final)\b/.test(q)) {
        const caja = el.closest('.grid2, .grid3, .fila, .modal, form, .card') || document;
        const ini = [...caja.querySelectorAll('input[type=date]')].find((x) => x !== el && /\b(inicio|desde|comienzo|inicial)\b/.test(pista(x)));
        if (ini) { const fijar = () => { if (ini.value) el.min = ini.value; else el.removeAttribute('min'); }; ini.addEventListener('change', fijar); ini.addEventListener('input', fijar); fijar(); }
      }
      return;
    }
    if (t === 'email' || (/correo|e-?mail/.test(q) && t === 'text')) {
      el.setAttribute('autocapitalize', 'none'); el.setAttribute('inputmode', 'email');
      el.addEventListener('blur', () => { const m = el.value.trim() && correoMal(el.value); mostrarError(el, m ? 'correo no válido: ' + m : ''); });
      return;
    }
    if (!/^(text|tel|search|)$/.test(t)) return;
    if (/buscar|filtr/.test(q)) return;
    if (/c[eé]dula|n[uú]mero de documento|documento de identidad|n[uú]m\.? de identificaci|\bc\.c\b/.test(q) && !/nombre/.test(q)) {
      soloDigitos(el, 10);
      el.addEventListener('blur', () => { mostrarError(el, el.value ? cedula(el.value) : ''); });
      return;
    }
    if (/\bnit\b/.test(q) && !/nombre|raz[oó]n/.test(q)) {
      el.setAttribute('inputmode', 'numeric');
      el.addEventListener('input', () => { const c = el.value.replace(/[^\d.-]/g, ''); if (c !== el.value) el.value = c; });
      el.addEventListener('blur', () => { const s = el.value.replace(/\./g, ''); mostrarError(el, s && !/^\d{5,12}(-\d)?$/.test(s) ? 'NIT con dígitos y, si quieres, el de verificación (900123456-7)' : ''); });
      return;
    }
    if (t === 'tel' || /tel[eé]fono|celular|whats/.test(q)) {
      el.setAttribute('inputmode', 'tel');
      el.addEventListener('input', () => { const c = el.value.replace(/[^\d+\s()-]/g, ''); if (c !== el.value) el.value = c; });
      el.addEventListener('blur', () => { const n = el.value.replace(/\D/g, '').length; mostrarError(el, el.value && (n < 7 || n > 13) ? 'escribe un teléfono de 7 a 10 dígitos' : ''); });
      return;
    }
    if (/nombre completo|nombres y apellidos|nombre y apellido|nombre del trabajador|nombre de la persona/.test(q)) {
      el.addEventListener('blur', () => { mostrarError(el, el.value ? nombre(el.value) : ''); });
    }
  }
  function revisarTodo(raiz) { (raiz || document).querySelectorAll('input, select').forEach(preparar); }
  /** Los obligatorios (required o etiqueta con *) que están vacíos: los marca y dice cuáles. */
  function faltan(raiz, salida) {
    raiz = raiz || document; limpiar(raiz); estilos();
    const lista = [];
    raiz.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.disabled || el.type === 'hidden' || el.type === 'file' || el.closest('[hidden]') || el.offsetParent === null) return;
      const lab = etiquetaDe(el), req = el.required || /\*\s*$/.test(lab) || /\*/.test(lab.slice(-3));
      if (!req) return;
      let vacio;
      if (el.type === 'checkbox' || el.type === 'radio') { const g = el.name ? raiz.querySelectorAll('input[name="' + el.name + '"]') : [el]; vacio = ![...g].some((x) => x.checked); if (el.name && lista.some((x) => x.n === el.name)) return; }
      else vacio = !txt(el.value);
      if (vacio) { lista.push({ n: el.name || el.id, etiqueta: lab.replace(/\*/g, '').trim() || 'Campo' }); marcar(el, 'falta'); }
    });
    if (salida) salida.innerHTML = lista.length ? '<div class="v-resumen"><b>Falta' + (lista.length === 1 ? '' : 'n') + ' ' + lista.length + ':</b> ' + lista.map((x) => escapar(x.etiqueta)).join(' · ') + '</div>' : '';
    const primero = raiz.querySelector('.v-falta'); if (primero) try { primero.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    return lista.map((x) => x.etiqueta);
  }
  function auto() {
    if (typeof document === 'undefined' || auto.listo) return; auto.listo = true; estilos();
    const ir = () => {
      revisarTodo(document);
      try { new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; if (/^(INPUT|SELECT)$/.test(n.tagName)) preparar(n); else if (n.querySelectorAll) revisarTodo(n); }))).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    };
    // v133: mientras se escribe: al salir de un obligatorio vacío avisa «falta»; al escribir se quita el aviso
    document.addEventListener('focusout', (e) => { const el = e.target; if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.closest('[data-sin-valida]') || /^(checkbox|radio|file|hidden|button|submit)$/.test(el.type)) return;
      if (!el.dataset.vToco) return; const lab = etiquetaDe(el); if ((el.required || /\*/.test(lab.slice(-3))) && !txt(el.value) && !(el.nextElementSibling && el.nextElementSibling.classList.contains('v-msg'))) marcar(el, 'falta'); }, true);
    document.addEventListener('input', (e) => { const el = e.target; if (!el || !el.classList) return; el.dataset.vToco = '1'; if (el.classList.contains('v-falta')) { const n = el.nextElementSibling; if (n && n.classList.contains('v-msg') && /^falta$/.test(n.textContent.trim())) { n.remove(); el.classList.remove('v-falta'); el.removeAttribute('aria-invalid'); } } }, true);
    document.addEventListener('focusin', (e) => { const el = e.target; if (el && el.dataset && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.dataset.vToco = '1'; }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ir); else ir();
  }

  /** v162 · NIT con su dígito de verificación (DIAN): '' si está bien o vacío; si no, el motivo. */
  function nit(v) {
    const s = txt(v).replace(/[.\s,]/g, ''); if (!s) return '';
    const m = /^(\d+)(?:-(\d))?$/.exec(s); if (!m) return 'solo números y el dígito de verificación (ej.: 900123456-7)';
    const b = m[1]; if (b.length < 6 || b.length > 10) return 'el NIT tiene de 6 a 10 dígitos antes del guion';
    const P = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]; let t = 0;
    for (let i = 0; i < b.length; i++) t += Number(b[b.length - 1 - i]) * P[i];
    const r = t % 11, dv = r > 1 ? 11 - r : r;
    if (m[2] == null) return 'falta el dígito de verificación (es ' + b + '-' + dv + ')';
    return Number(m[2]) === dv ? '' : 'el dígito de verificación no corresponde (para ' + b + ' es ' + dv + ')';
  }
  return { nit, limpiarCedula, cedula, nombre, texto, fecha, pasada, orden, numero, limpiar, marcar, revisar, soloDigitos, soloNombre, hastaHoy, hoy, otro, preparar, faltan, auto, correoMal };
})();
if (typeof document !== 'undefined') Valida.auto();
if (typeof module !== 'undefined') module.exports = Valida;
