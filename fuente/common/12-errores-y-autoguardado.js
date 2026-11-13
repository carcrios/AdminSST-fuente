/* ============================================================
   v132 · Errores — el mismo tipo de mensaje en todo el portal:
   «No se guardó. <qué pasó>. <qué hacer>».
   ============================================================ */
const Errores = {
  detalle(r) {
    if (!r) return 'No hubo respuesta del servidor. Revisa la señal e intenta de nuevo.';
    const e = String(r.error || '').trim().replace(/\.$/, '');
    if (r.conflicto) return 'Otra persona cambió este registro mientras lo tenías abierto. Ábrelo de nuevo para ver los cambios.';
    if (r.codigoError === 'SESION') return (e || 'Tu sesión venció') + '. Vuelve a entrar con tu usuario (botón de arriba).';
    if (r.codigoError === 'CAMBIAR') return 'Primero cambia tu clave temporal (botón de tu usuario, arriba).';
    if (r.codigoError === 'CLAVE') return 'Este celular no tiene la clave del portal: escríbela en «Clave», arriba.';
    if (r.codigoError === 'TEMPORAL') return 'El sistema estaba ocupado; se vuelve a intentar solo en unos segundos.';
    if (/failed to fetch|networkerror|sin conexi|timeout|tard[oó]/i.test(e)) return 'Sin conexión con el servidor. Revisa la señal e intenta de nuevo.';
    return e ? e + '.' : 'Error sin detalle. Intenta de nuevo; si sigue pasando, avísale al área SST (Estado → Enviar por WhatsApp).';
  },
  /** Errores.texto('guardó', r) → «No se guardó. …» */
  texto(accion, r) { return 'No se ' + accion + '. ' + this.detalle(r); }
};

/* ================= AUTOGUARDADO (v138–v139) =================
   Todo lo que se escribe en cualquier formulario del portal se guarda solo en
   el equipo, un momento después de cada cambio y al salir de la página (o al
   bloquear el celular). Si se sale sin guardar —se cerró la ventana, se tocó
   fuera del recuadro, se fue la batería— al volver a abrir el mismo formulario
   en blanco se rellena con lo que llevaba, con un aviso y la opción de
   descartarlo. Se borra solo cuando el registro se guarda (o queda en cola).
   v139: también fotos y firmas (en IndexedDB, que aguanta lo que pesan), lo
   último que se usó en área/lugar/equipo/supervisor, «Te falta esto» al
   guardar, aviso al salir con algo a medias y plantillas de tareas frecuentes.
   El ATS y los permisos ya tienen su propio borrador completo: ahí no se activa. */
const AutoGuardado = (function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { activo: false };
  const DIAS = 7, ESPERA = 600;
  // v141: buzón, convivencia y salud nunca se guardan en el equipo (ni plantillas): son confidenciales.
  const omitirPagina = () => /\/(ats|buzon|convivencia|salud)\.html$/.test(location.pathname) || !!document.querySelector('script[src*="permiso-core.js"]') || document.documentElement.hasAttribute('data-sin-autoguardado');
  const pagina = () => location.pathname.replace(/\/index\.html$/, '/');
  const conPref = (k) => typeof Consola !== 'undefined' ? Consola.clave(k) : k;
  const clave = () => conPref('ssta-auto|' + pagina());
  const leer = () => { try { const v = JSON.parse(localStorage.getItem(clave()) || '{}'); const lim = Date.now() - DIAS * 864e5; Object.keys(v).forEach((g) => { if (!v[g] || !v[g].t || v[g].t < lim) { delete v[g]; try { IDB.borrarPrefijo(clave() + '|' + g + '|'); } catch (e) {} } }); return v; } catch (e) { return {}; } };
  const escribir = (v) => { try { if (Object.keys(v).length) localStorage.setItem(clave(), JSON.stringify(v)); else localStorage.removeItem(clave()); } catch (e) { window.dispatchEvent(new CustomEvent('draft-guardado-fallido', { detail: { error: e } })); } };

  /* ── IndexedDB para fotos y firmas ── */
  const IDB = (function () {
    let db = null;
    const abrir = () => db || (db = new Promise((ok, mal) => { try { const r = indexedDB.open('ssta-auto', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); } catch (e) { mal(e); } }));
    const tx = (modo, fn) => abrir().then((d) => new Promise((ok, mal) => { const t = d.transaction('kv', modo), st = t.objectStore('kv'); const r = fn(st); t.oncomplete = () => ok(r && r.result); t.onerror = () => mal(t.error); }));
    return {
      put: (k, v) => tx('readwrite', (st) => st.put(v, k)).catch(() => {}),
      get: (k) => tx('readonly', (st) => st.get(k)).catch(() => undefined),
      claves: () => tx('readonly', (st) => st.getAllKeys()).catch(() => []),
      borrarPrefijo: (pre) => tx('readwrite', (st) => { const r = st.openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; if (String(c.key).indexOf(pre) === 0) c.delete(); c.continue(); }; }).catch(() => {})
    };
  })();

  function idCampo(el) { return el.id || el.name || ''; }
  function sirve(el) {
    if (!el || !el.matches || !el.matches('input,textarea,select')) return false;
    if (el.closest('[data-sin-borrador],#sstaTrampa,.dlg-fondo,.dialogo,.ag-panel')) return false;
    const t = (el.type || '').toLowerCase();
    if (/^(password|file|hidden|search|button|submit|reset|image)$/.test(t)) return false;
    const n = idCampo(el);
    if (!n || /buscar|filtro|search|clave|password|token|sesion|pin\b/i.test(n)) return false;
    return true;
  }
  function contenedor(el) { return el.closest('.modal') || el.closest('form') || document.body; }
  function grupo(c, sinId) {
    let g;
    if (c.classList && c.classList.contains('modal')) { const h = c.querySelector('h1,h2,h3,.modal-titulo'); g = 'modal:' + ((h && h.textContent) || '').trim().slice(0, 60); }
    else if (c.tagName === 'FORM') g = 'form:' + (c.id || c.getAttribute('name') || [...document.forms].indexOf(c));
    else g = 'pagina';
    if (sinId) return g;
    const idReg = [...c.querySelectorAll('input[type=hidden]')].find((h) => /^(id|.*Id|.*_id)$/.test(idCampo(h)) && h.value);
    return idReg ? g + '#' + idReg.value : g;
  }
  function campos(c) { return [...c.querySelectorAll('input,textarea,select')].filter((el) => sirve(el) && contenedor(el) === c); }
  function valor(el) { const t = (el.type || '').toLowerCase(); if (t === 'checkbox') return !!el.checked; if (t === 'radio') return el.checked ? el.value : undefined; if (el.multiple) return [...el.selectedOptions].map((o) => o.value); return el.value; }
  const esTexto = (el) => el.tagName === 'TEXTAREA' || /^(text|email|tel|number|url|)$/.test((el.type || '').toLowerCase());
  function conTexto(c) { return campos(c).some((el) => esTexto(el) && !el.dataset.agReciente && el.value.trim()); }
  function etiqueta(el) {
    let l = el.id && document.querySelector('label[for="' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) + '"]');
    if (!l) l = el.closest('label') || (el.closest('.field') && el.closest('.field').querySelector('label'));
    return ((l && l.textContent) || el.getAttribute('aria-label') || el.placeholder || idCampo(el)).replace(/\s+/g, ' ').trim();
  }
  function aplicar(el, x) {
    const t = (el.type || '').toLowerCase(); let prev;
    if (t === 'checkbox') { if (el.checked === !!x) return null; prev = el.checked; el.checked = !!x; }
    else if (t === 'radio') { if (el.value !== x || el.checked) return null; prev = false; el.checked = true; }
    else if (el.multiple && Array.isArray(x)) { prev = [...el.selectedOptions].map((o) => o.value); [...el.options].forEach((o) => { o.selected = x.indexOf(o.value) !== -1; }); }
    else { if (String(el.value) === String(x)) return null; prev = el.value; el.value = x; }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    return [el, prev];
  }
  function deshacerAplicados(aplicados) {
    aplicados.forEach(([el, prev]) => { const t = (el.type || '').toLowerCase(); if (t === 'checkbox' || t === 'radio') el.checked = prev; else if (el.multiple && Array.isArray(prev)) [...el.options].forEach((o) => { o.selected = prev.indexOf(o.value) !== -1; }); else el.value = prev; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  }

  /* ── Extras (fotos, firmas): cada uno se registra con get/set ── */
  const extras = new WeakMap(); // contenedor → Map(clave → {get,set,vacio})
  function registrarExtra(el, k, api) {
    if (!el) return; const c = contenedor(el);
    if (!extras.has(c)) extras.set(c, new Map());
    extras.get(c).set(k, api);
  }
  function marcar(el) { if (suprimir || !el) return; const c = contenedor(el); pendientes.add(c); clearTimeout(tSave); tSave = setTimeout(guardarYa, ESPERA); }

  const restaurados = new WeakSet(), prellenados = new WeakSet(), pendientes = new Set();
  let tSave = null, suprimir = false;
  function guardarYa() {
    clearTimeout(tSave); tSave = null;
    if (!pendientes.size) return;
    const v = leer();
    pendientes.forEach((c) => {
      if (!document.body.contains(c)) return;
      const g = grupo(c), datos = {}, xs = [];
      campos(c).forEach((el) => { const x = valor(el); if (x !== undefined) datos[idCampo(el)] = x; });
      const ex = extras.get(c);
      if (ex) ex.forEach((api, k) => { let x; try { x = api.get(); } catch (e) {} if (x && (!Array.isArray(x) || x.length)) { xs.push(k); IDB.put(clave() + '|' + g + '|' + k, x); } });
      if (conTexto(c) || xs.length) v[g] = { t: Date.now(), d: datos, x: xs }; else delete v[g];
    });
    pendientes.clear();
    escribir(v);
  }
  function alCambiar(e) {
    if (suprimir) return;
    const el = e.target; if (!sirve(el)) return;
    delete el.dataset.agReciente;
    const c = contenedor(el); restaurados.add(c); pendientes.add(c); c._agToque = 0;
    if (e.type === 'change') recordar(el);
    clearTimeout(tSave); tSave = setTimeout(guardarYa, ESPERA);
    const p = c.querySelector(':scope > .ag-falta, .ag-falta'); if (p && contenedor(p) === c) revisarFaltantes(c, p);
  }

  /* ── Lo último que se usó (área, lugar, equipo, supervisor…) ── */
  const REC = /area|lugar|sitio|ubicaci|sede|frente|obra|equipo|supervisor|proceso|contratista|turno|zona|dependencia/i;
  const REC_NO = /fecha|hora|cedula|documento|telefono|correo|email|codigo|nombre(?!.*(supervisor|equipo))|descrip|observ/i;
  const claveRec = () => conPref('ssta-recientes');
  const recSirve = (el) => sirve(el) && /^(text|)$/.test((el.type || '').toLowerCase()) && el.tagName === 'INPUT' && REC.test(idCampo(el)) && !REC_NO.test(idCampo(el)) && !el.readOnly;
  function leerRec() { try { return JSON.parse(localStorage.getItem(claveRec()) || '{}'); } catch (e) { return {}; } }
  function recordar(el) {
    if (!recSirve(el)) return; const x = el.value.trim(); if (!x || x.length > 80) return;
    const r = leerRec(), k = idCampo(el), l = (r[k] || []).filter((o) => o.v !== x), prev = (r[k] || []).find((o) => o.v === x);
    l.unshift({ v: x, n: (prev ? prev.n : 0) + 1, t: Date.now() }); r[k] = l.slice(0, 12);
    try { localStorage.setItem(claveRec(), JSON.stringify(r)); } catch (e) {}
  }
  function prellenar(c) {
    if (prellenados.has(c)) return; prellenados.add(c);
    const r = leerRec(); let n = 0;
    campos(c).filter(recSirve).forEach((el) => {
      const l = r[idCampo(el)]; if (!l || !l.length) return;
      // Sugerencias: las más usadas primero (sin pisar una lista que ya tenga el campo).
      if (!el.getAttribute('list')) {
        const dl = document.createElement('datalist'); dl.id = 'agRec-' + idCampo(el).replace(/[^\w-]/g, '_');
        if (!document.getElementById(dl.id)) { dl.innerHTML = l.slice().sort((a, b) => b.n - a.n).slice(0, 8).map((o) => '<option value="' + esc(o.v) + '">').join(''); document.body.appendChild(dl); }
        el.setAttribute('list', dl.id);
      }
      if (!el.value) { suprimir = true; el.value = l[0].v; el.dataset.agReciente = '1'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); suprimir = false; n++; }
    });
    if (n) { const h = document.createElement('div'); h.className = 'ag-reciente'; h.textContent = 'Puse lo de la última vez en ' + (n === 1 ? 'un campo' : n + ' campos') + ' (área, lugar, equipo…). Cámbialo si hoy es distinto.'; insertarArriba(c, h); }
  }

  function insertarArriba(c, nodo) {
    if (c === document.body) { const m = document.querySelector('main') || document.querySelector('.wrap'); const ref = m && (m.querySelector('.card') || m.firstElementChild); if (ref && ref.parentNode) ref.parentNode.insertBefore(nodo, ref); else document.body.insertBefore(nodo, document.body.firstChild); }
    else { const h = c.querySelector(':scope > h1, :scope > h2, :scope > h3'); if (h) h.after(nodo); else c.insertBefore(nodo, c.firstChild); }
  }
  function aviso(c, g, cuando, aplicados, extrasPrev) {
    const b = document.createElement('div');
    b.className = 'autoguardado-aviso'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>Recuperamos lo que estabas escribiendo (' + formatSavedAt(new Date(cuando).toISOString()) + ').</span>';
    const des = document.createElement('button'); des.type = 'button'; des.className = 'btn btn-sec'; des.textContent = 'Descartar';
    des.addEventListener('click', () => {
      suprimir = true; deshacerAplicados(aplicados); extrasPrev.forEach(([api, prev]) => { try { api.set(prev); } catch (e) {} }); suprimir = false;
      const v = leer(); delete v[g]; escribir(v); IDB.borrarPrefijo(clave() + '|' + g + '|'); b.remove();
    });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'btn'; ok.textContent = 'Seguir'; ok.addEventListener('click', () => b.remove());
    b.appendChild(ok); b.appendChild(des);
    insertarArriba(c, b);
  }
  async function restaurar(c) {
    if (restaurados.has(c)) return;
    const lista = campos(c); if (!lista.length) return;
    const g = grupo(c), v = leer(), r = v[g];
    if (conTexto(c)) { restaurados.add(c); return; } // ya trae datos (edición): no se pisa
    // v152: se quitó el botón «Plantillas» en todos los formularios (pedido del usuario).
    if (false) ponerPlantillas(c);
    if (!r) { prellenar(c); return; }
    restaurados.add(c); prellenados.add(c);
    const aplicados = []; suprimir = true;
    lista.forEach((el) => { const n = idCampo(el); if (!(n in r.d)) return; const a = aplicar(el, r.d[n]); if (a) aplicados.push(a); });
    suprimir = false;
    const extrasPrev = [], ex = extras.get(c);
    if (ex && r.x && r.x.length) await new Promise((ok) => setTimeout(ok, 1000));
    // v141: si en ese segundo la página cargó un registro (apareció su id), las fotos del borrador no se le ponen.
    if (ex && r.x && r.x.length && document.body.contains(c) && grupo(c) === g) {
      for (const k of r.x) { const api = ex.get(k); if (!api) continue; const val = await IDB.get(clave() + '|' + g + '|' + k); if (val == null) continue; let prev; try { prev = api.get(); } catch (e) {} suprimir = true; try { api.set(val); extrasPrev.push([api, prev]); } catch (e) {} suprimir = false; }
    }
    if ((aplicados.length || extrasPrev.length) && !c.querySelector('.autoguardado-aviso')) aviso(c, g, r.t, aplicados, extrasPrev);
    // Si la página limpia su formulario al terminar de abrir (su «nuevo()»), se vuelve a poner.
    const textos = aplicados.map((a) => a[0]).filter((el) => esTexto(el) && el.value);
    if (textos.length && !(c._agRevisado > 3)) {
      c._agRevisado = (c._agRevisado || 0) + 1; const marca = c._agToque = Date.now();
      [300, 1000, 2500].forEach((ms) => setTimeout(() => {
        if (c._agToque !== marca || !document.body.contains(c) || !leer()[g]) return;
        if (textos.every((el) => !el.value.trim())) { restaurados.delete(c); restaurar(c); }
      }, ms));
    }
  }
  let tBus = null;
  function buscar() { clearTimeout(tBus); tBus = setTimeout(() => { const cs = new Set(); document.querySelectorAll('input,textarea,select').forEach((el) => { if (sirve(el)) cs.add(contenedor(el)); }); cs.forEach(restaurar); }, 250); }

  /* ── «Te falta esto» al tocar Guardar / Enviar / Firmar ── */
  const BOTON_GUARDAR = /^(guardar|enviar|registrar|firmar|reportar|crear|agregar y guardar|cerrar y guardar)/i;
  function obligatorio(el) {
    if (el.disabled || el.offsetParent === null) return false;
    if (el.required) return true;
    const l = etiqueta(el); return /\*\s*$/.test(l) || /\*\s*\(/.test(l);
  }
  function vacio(el) { const t = (el.type || '').toLowerCase(); if (t === 'checkbox') return false; if (t === 'radio') { const gr = el.name && document.querySelectorAll('input[type=radio][name="' + el.name + '"]'); return gr ? ![...gr].some((x) => x.checked) : !el.checked; } return !String(el.value || '').trim(); }
  function faltantes(c) {
    const vistos = new Set();
    return [...c.querySelectorAll('input,textarea,select')].filter((el) => contenedor(el) === c && !/^(hidden|button|submit|file)$/i.test(el.type || '') && obligatorio(el) && vacio(el)).filter((el) => { const k = el.type === 'radio' ? 'r:' + el.name : el; if (vistos.has(k)) return false; vistos.add(k); return true; });
  }
  function revisarFaltantes(c, panel) {
    const f = faltantes(c);
    if (!f.length) { panel.remove(); return; }
    panel.innerHTML = '<b>Te falta esto (' + f.length + '):</b>';
    const ul = document.createElement('div'); ul.className = 'ag-falta-lista';
    f.slice(0, 12).forEach((el) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ag-falta-item'; b.textContent = etiqueta(el).replace(/\s*\*\s*$/, ''); b.addEventListener('click', () => { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }, 250); }); ul.appendChild(b); });
    panel.appendChild(ul);
  }
  function alTocarGuardar(e) {
    const b = e.target && e.target.closest && e.target.closest('button,[type=submit]');
    if (!b || b.closest('.ag-panel,.dlg-fondo,.autoguardado-aviso,.ag-falta')) return;
    if ([...contenedor(b).querySelectorAll('.status-msg')].some((m) => contenedor(m) === contenedor(b))) return;   // v143: la página ya dice qué falta (sin mensajes repetidos)
    const txt = (b.textContent || b.value || '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (!BOTON_GUARDAR.test(txt)) return;
    const c = contenedor(b);
    let p = [...c.querySelectorAll('.ag-falta')].find((x) => contenedor(x) === c);
    const f = faltantes(c);
    if (!f.length) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.className = 'ag-falta'; p.setAttribute('role', 'alert'); b.parentNode.insertBefore(p, b); }
    revisarFaltantes(c, p);
  }

  /* ── Aviso al salir con algo a medias ── */
  function hayAMedias() { if (pendientes.size) guardarYa(); return Object.keys(leer()).length > 0 && [...document.querySelectorAll('input,textarea,select')].some((el) => sirve(el) && esTexto(el) && !el.dataset.agReciente && el.value.trim()); }
  function alTocarEnlace(e) {
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || a.target === '_blank' || a.hasAttribute('download') || e.ctrlKey || e.metaKey) return;
    const href = a.getAttribute('href'); if (!href || href[0] === '#' || /^(javascript|mailto|tel|whatsapp|sms):/i.test(href)) return;
    let u; try { u = new URL(href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || u.pathname === location.pathname) return;
    if (typeof window.__sstaDialogoAuto !== 'undefined' && !window.__sstaAvisoSalir) return; // pruebas automáticas
    if (!hayAMedias() || typeof Dialogo === 'undefined') return;
    e.preventDefault();
    Dialogo.confirmar('¿Salir de este formulario?\nLo que escribiste queda guardado en este celular y lo encuentras al volver.').then((si) => { if (si) location.href = u.href; });
  }

  /* ── Plantillas de tareas frecuentes ── */
  const claveTpl = () => conPref('ssta-plantillas|' + pagina());
  function tplLocales(g) { try { return (JSON.parse(localStorage.getItem(claveTpl()) || '{}')[g] || []); } catch (e) { return []; } }
  function tplGuardarLocal(g, t) { try { const o = JSON.parse(localStorage.getItem(claveTpl()) || '{}'); o[g] = [t].concat((o[g] || []).filter((x) => x.nombre !== t.nombre)).slice(0, 30); localStorage.setItem(claveTpl(), JSON.stringify(o)); } catch (e) {} }
  async function tplServidor(g) {
    if (typeof SGSST === 'undefined' || !SGSST.url()) return [];
    try { const r = await SGSST.listar('plantillaform', { sinPedir: true }); return (r.rows || []).map((x) => x.resumen || {}).filter((x) => x.pagina === pagina() && x.grupo === g).map((x) => { let d = {}; try { d = JSON.parse(x.datos || '{}'); } catch (e) {} return { nombre: x.nombre, d, comun: true }; }); } catch (e) { return []; }
  }
  function ponerPlantillas(c) {
    if (c.querySelector('.ag-tpl-btn') || campos(c).filter(esTexto).length < 3 || c === document.body && !document.querySelector('main,.wrap')) return;
    if (/\/(index|usuarios|configuracion|etiquetas-qr|papelera|reportes|buzon)\.html$|\/$/.test(location.pathname)) return;   // v151: los reportes no llevan plantillas
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost ag-tpl-btn'; b.textContent = 'Plantillas';
    b.addEventListener('click', () => abrirPlantillas(c, b));
    insertarArriba(c, b);
  }
  async function abrirPlantillas(c, boton) {
    const viejo = c.querySelector('.ag-panel'); if (viejo) { viejo.remove(); return; }
    const g = grupo(c, true), p = document.createElement('div'); p.className = 'ag-panel';
    p.innerHTML = '<b>Plantillas de tareas frecuentes</b><p class="ayuda">Llenan el formulario con lo que se repite (peligros, controles, EPP…). Luego revisa y completa lo de hoy.</p><div class="ag-tpl-lista">Cargando…</div>';
    const g2 = document.createElement('button'); g2.type = 'button'; g2.className = 'btn btn-sec'; g2.textContent = 'Guardar lo escrito como plantilla';
    p.appendChild(g2); boton.after(p);
    const pintar = async () => {
      const todas = (await tplServidor(g)).concat(tplLocales(g).filter((l) => true));
      const vistos = new Set(), l = todas.filter((t) => !vistos.has(t.nombre) && vistos.add(t.nombre));
      const cont = p.querySelector('.ag-tpl-lista'); cont.innerHTML = l.length ? '' : '<div class="empty">Aún no hay plantillas para este formulario. Llénalo una vez y toca «Guardar lo escrito como plantilla».</div>';
      l.forEach((t) => { const x = document.createElement('button'); x.type = 'button'; x.className = 'ag-falta-item'; x.textContent = t.nombre + (t.comun ? '' : ' (solo este celular)'); x.addEventListener('click', () => {
        campos(c).forEach((el) => { const n = idCampo(el); if (n in t.d) aplicar(el, t.d[n]); }); p.remove();
        const h = document.createElement('div'); h.className = 'ag-reciente'; h.textContent = 'Plantilla «' + t.nombre + '» aplicada. Revisa que todo aplique a la tarea de hoy.'; insertarArriba(c, h); marcar(campos(c)[0]);
      }); cont.appendChild(x); });
    };
    g2.addEventListener('click', async () => {
      const nombre = await Dialogo.pedir('Nombre de la plantilla (la tarea), por ejemplo «Cambio de lámina en altura»:', ''); if (!nombre || !nombre.trim()) return;
      const d = {}; campos(c).forEach((el) => { if (/fecha|hora|firma|cedula|nombre|foto/i.test(idCampo(el)) && !REC.test(idCampo(el))) return; const x = valor(el); if (x !== undefined && x !== '' && x !== false) d[idCampo(el)] = x; });
      const t = { nombre: nombre.trim().slice(0, 80), d };
      let comun = false;
      if (typeof SGSST !== 'undefined' && SGSST.url()) { try { const r = await SGSST.enviar({ action: 'guardar', tipo: 'plantillaform', id: 'TPL-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), doc: { nombre: t.nombre, pagina: pagina(), grupo: g, datos: JSON.stringify(d).slice(0, 6000) } }, null, { sinCola: true }); comun = !!(r && r.ok); } catch (e) {} }
      if (!comun) tplGuardarLocal(g, t);
      if (typeof UI !== 'undefined' && UI.toast) UI.toast(comun ? 'Plantilla guardada para todo el equipo.' : 'Plantilla guardada en este celular.');
      pintar();
    });
    pintar();
  }

  // Solo cuenta un envío que la persona acaba de pedir (tocó un botón hace
  // poco): un reenvío de la cola al volver la señal no borra lo que se está
  // escribiendo ahora. Y solo se borra lo escrito antes de ese envío.
  let ultimoToque = 0, ultimoGrupo = null, ultimoGrupoBase = null;
  const ACCIONES = /^(guardar\w*|parche|crearObra|cerrarAts|agregarParticipantes|addWorkers|encuestaPublica)$/;
  function limpiar(desde, body) {
    desde = desde || Date.now();
    if (desde - ultimoToque > 8000) return;
    if (body && body.tipo === 'plantillaform') return;
    clearTimeout(tSave); pendientes.clear();
    // v141: solo se borra el borrador del formulario que se guardó (el del botón que se tocó), no los demás.
    const v = leer(); Object.keys(v).forEach((g) => { const base = g.split('#')[0]; if (v[g].t <= desde && (g === ultimoGrupo || (base === ultimoGrupoBase && g.indexOf('#') === -1))) { delete v[g]; IDB.borrarPrefijo(clave() + '|' + g + '|'); } }); escribir(v);
    document.querySelectorAll('.autoguardado-aviso,.ag-falta,.ag-reciente').forEach((b) => { const cb = contenedor(b); if (grupo(cb) === ultimoGrupo || grupo(cb, true) === ultimoGrupoBase) b.remove(); });
  }
  const cuerpo = (b) => { try { return (typeof b === 'string' ? JSON.parse(b) : b) || {}; } catch (e) { return {}; } };

  function iniciar() {
    if (omitirPagina()) return;
    document.addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button,[type=submit],.btn,a'); if (b) { ultimoToque = Date.now(); const cb = contenedor(b); ultimoGrupo = grupo(cb); ultimoGrupoBase = grupo(cb, true); } }, true);
    document.addEventListener('click', alTocarGuardar, true);
    document.addEventListener('click', alTocarEnlace);
    document.addEventListener('input', alCambiar, true);
    document.addEventListener('change', alCambiar, true);
    window.addEventListener('pagehide', guardarYa);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') guardarYa(); });
    // Un formulario en ventana se guarda al cerrarse, aunque sea tocando fuera.
    // v144: solo cuando se cierra una ventana con algo pendiente se guarda de una; y solo se busca
    // formularios nuevos si lo agregado tiene campos (no por cada foto o lista que se pinta).
    const conCampos = (n) => n.nodeType === 1 && (n.matches('input,textarea,select,.modal,form') || !!n.querySelector('input,textarea,select'));
    new MutationObserver((ms) => {
      if (pendientes.size && ms.some((m) => [...m.removedNodes].some((n) => n.nodeType === 1 && (n.matches('.modal,.modal-fondo,form') || !!n.querySelector('.modal,form'))))) guardarYa();
      if (ms.some((m) => [...m.addedNodes].some(conCampos))) buscar();
    }).observe(document.body, { childList: true, subtree: true });
    buscar(); setTimeout(buscar, 1200);
    // v141: fotos de borradores que ya vencieron o se descartaron no se quedan en el equipo.
    setTimeout(() => { try { const vivos = Object.keys(leer()).map((g) => clave() + '|' + g + '|'); IDB.claves().then((ks) => (ks || []).forEach((k) => { if (String(k).indexOf(clave() + '|') === 0 && !vivos.some((p) => String(k).indexOf(p) === 0)) IDB.borrarPrefijo(String(k)); })); } catch (e) {} }, 3000);
    if (typeof SGSST !== 'undefined' && SGSST.enviar && !SGSST.enviar._auto) {
      const orig = SGSST.enviar;
      SGSST.enviar = async function (body) { const t0 = Date.now(); const r = await orig.apply(this, arguments); try { if (r && r.ok && body && ACCIONES.test(body.action || '')) limpiar(t0, body); } catch (e) {} return r; };
      SGSST.enviar._auto = true;
    }
    // Las páginas que guardan en otros servidores (EPP, asistencia…) también.
    const f0 = window.fetch;
    window.fetch = function (u, o) {
      const p = f0.apply(this, arguments);
      try {
        const b = o && typeof o.body === 'string' ? cuerpo(o.body) : null;
        if (b && String(o.method || '').toUpperCase() === 'POST' && /script\.google/.test(String(u)) && ACCIONES.test(b.action || '')) {
          const t0 = Date.now();
          p.then((res) => res && res.clone && res.clone().json().then((j) => { if (j && j.ok) limpiar(t0, b); }).catch(() => {})).catch(() => {});
        }
      } catch (e) {}
      return p;
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else setTimeout(iniciar, 0);
  return { activo: true, guardarYa, limpiar, marcar, registrarExtra, faltantes, _clave: () => clave(), _idb: IDB };
})();

/* v163: acciones sin onclick en línea (la CSP ya no permite JavaScript dentro de los atributos). */
function accionSinOnclick_(e) {
  const t = e.target && e.target.closest ? e.target.closest('[data-recargar],[data-seleccionar],[data-imprimir]') : null; if (!t) return;
  if (t.hasAttribute('data-recargar')) location.reload();
  else if (t.hasAttribute('data-seleccionar') && t.select) t.select();
  else if (t.hasAttribute('data-imprimir')) window.print();
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', accionSinOnclick_);
