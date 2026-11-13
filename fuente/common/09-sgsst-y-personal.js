/* ================= SERVIDOR SG-SST =================
   Personal habilitado, reportes, plan de acción, indicadores, equipos e
   inspecciones viven en un solo backend (backend-sgsst.gs). Aquí: listar
   (con copia en el equipo para ver sin señal), abrir un documento y enviar
   (si no hay señal, a la cola; se manda solo al volver). */
const SGSST = {
  url() { const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.sgsst) || {}; return B.url || ''; },
  token() { return (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || ''; },
  nuevoId(prefijo) {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return prefijo + '-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  },
  nuevoOpId() { return 'sg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); },
  _lsGet(k, def) { try { const v = localStorage.getItem(Consola.clave(k)); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  _lsSet(k, v) { try { localStorage.setItem(Consola.clave(k), JSON.stringify(v)); } catch (e) { /* memoria llena: no es grave */ } },
  async _json(res) {
    const t = await res.text();
    try { return JSON.parse(t); } catch (e) { const err = new Error(Outbox.describirPagina ? Outbox.describirPagina(t, res.status) : 'Respuesta no válida'); err.pagina = true; throw err; }
  },
  /** Lista de un tipo (o varios separados por coma). Sin señal devuelve la última copia. */
  /** v148: tipos con datos de salud o reservados: sin copia en el celular (una tablet compartida no los muestra sin señal). */
  RESERVADOS: ['examen', 'ausencia', 'perfil', 'sve', 'pvecaso', 'psico', 'preopsalud', 'cliente', 'queja', 'buzon'],
  /* v168 · La copia de cada lista vive en IndexedDB (cabe lo que haga falta y no le quita espacio a los borradores
     ni a las firmas, que usan localStorage). Si el navegador no deja, sigue en localStorage como antes. */
  _copiaDb: null,
  _idb() {
    if (this._copiaDb) return this._copiaDb;
    this._copiaDb = new Promise((ok) => {
      try {
        if (typeof indexedDB === 'undefined') return ok(null);
        const r = indexedDB.open('ssta-listas', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null);
      } catch (e) { ok(null); }
    });
    return this._copiaDb;
  },
  _copiaClave(clave) { return ((typeof EMPRESA !== 'undefined' && EMPRESA.codigo) || '') + '|' + Consola.clave(clave); },
  async _copiaOp(modo, fn) {
    const db = await this._idb(); if (!db) return undefined;
    return new Promise((ok) => {
      try {
        const tx = db.transaction('kv', modo), q = fn(tx.objectStore('kv'));
        tx.oncomplete = () => ok(q && q.result !== undefined ? q.result : true);
        tx.onerror = tx.onabort = () => ok(undefined);
      } catch (e) { ok(undefined); }
    });
  },
  async _copiaGet(clave) {
    const v = await this._copiaOp('readonly', (s) => s.get(this._copiaClave(clave)));
    return v && v !== true ? v : this._lsGet(clave, null);   // la copia de antes de la v168 estaba en localStorage
  },
  async _copiaSet(clave, v) {
    const bien = await this._copiaOp('readwrite', (s) => s.put(v, this._copiaClave(clave)));
    if (bien) { try { localStorage.removeItem(Consola.clave(clave)); } catch (e) {} } else this._lsSet(clave, v);
  },
  async _copiaDel(clave) {
    await this._copiaOp('readwrite', (s) => s.delete(this._copiaClave(clave)));
    try { localStorage.removeItem(Consola.clave(clave)); } catch (e) {}
  },
  /** v168: une la copia del celular con lo que cambió en el servidor. Mismo orden que la hoja: lo modificado queda
   *  en su sitio y lo nuevo al final. */
  unirCambios(base, j) {
    const fuera = {}, nuevas = {};
    (j.borrados || []).forEach((id) => { fuera[id] = 1; });
    (j.rows || []).forEach((r) => { nuevas[r.id] = r; });
    const out = [];
    (base || []).forEach((r) => { if (fuera[r.id]) return; if (nuevas[r.id]) { out.push(nuevas[r.id]); delete nuevas[r.id]; } else out.push(r); });
    (j.rows || []).forEach((r) => { if (nuevas[r.id]) out.push(r); });
    return out;
  },
  LISTA_COMPLETA_CADA_MS: 24 * 3600 * 1000,
  async listar(tipos, opciones) {
    const clave = 'ssta-sgsst-lista:' + tipos;
    const reservado = String(tipos).split(',').some((t) => this.RESERVADOS.indexOf(t.trim()) !== -1);
    if (reservado) await this._copiaDel(clave);
    const copia = reservado ? null : await this._copiaGet(clave);
    if (!this.url()) return { rows: (copia && copia.rows) || [], sinServidor: true };
    try {
      const base = this.url() + '?action=list&tipo=' + encodeURIComponent(tipos) + '&token=' + encodeURIComponent(this.token()) + this._ses();
      // v168: si la copia es de este servidor y se completó hace menos de un día, se piden solo los cambios desde entonces.
      const fresca = copia && copia.completa && Date.now() - Date.parse(copia.completa) < this.LISTA_COMPLETA_CADA_MS;
      const sirve = fresca && Array.isArray(copia.rows) && copia.hasta && copia.gen;
      const enc = encodeURIComponent;
      const cambios = sirve ? '&cambios=' + enc(copia.hasta) + '&gen=' + enc(copia.gen) + '&vista=' + enc(copia.vista || '') : '';
      let j = await this._json(await fetchWithRetry(base + cambios));
      if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pintarChip(); if (!(opciones && opciones.sinPedir)) Sesion.pedir(j.error); return { rows: [], sinSesion: true, error: j.error }; }
      if (!j.ok) { const e = new Error(j.error || 'error del servidor'); e.json = j; throw e; }
      let delServidor = j.rows, completa = new Date().toISOString();
      if (j.delta) {
        delServidor = this.unirCambios(copia.rows, j); completa = copia.completa;
        // Si la cuenta no cuadra con la del servidor, la copia no sirve: se pide la lista entera.
        if (j.total !== undefined && delServidor.length !== j.total) {
          j = await this._json(await fetchWithRetry(base));
          if (!j.ok) { const e = new Error(j.error || 'error del servidor'); e.json = j; throw e; }
          delServidor = j.rows; completa = new Date().toISOString();
        }
      }
      Sesion.marcar(j);
      const rows = delServidor.concat(this.pendientesLocales(tipos).filter((p) => !delServidor.some((r) => r.id === p.id)));
      const nueva = { rows: delServidor, en: new Date().toISOString(), gen: j.gen || '', vista: j.vista || '', hasta: j.hasta || '', completa };
      if (!reservado) await this._copiaSet(clave, nueva);
      return { rows };
    } catch (e) {
      if (e.json && ClavePortal.esErrorDeClave(e.json)) ClavePortal.pedir();
      const rows = ((copia && copia.rows) || []).concat(this.pendientesLocales(tipos).filter((p) => !((copia && copia.rows) || []).some((r) => r.id === p.id)));
      return { rows, desdeCopia: true, copiaDel: copia && copia.en, error: e.message };
    }
  },
  async doc(id) {
    const local = this._lsGet('ssta-sgsst-doc:' + id, null);
    if (!this.url()) return local;
    try {
      const res = await fetchWithRetry(this.url() + '?action=doc&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(this.token()) + this._ses());
      const j = await this._json(res);
      if (j.ok) { const d = Object.assign({}, j.doc, { version: j.version }); return d; }
      this.ultimoError = j.error || '';
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); return null; }
      if (j.codigoError === 'PERMISO') return null;
      return local;
    } catch (e) { return local; }
  },
  /* Lo enviado sin señal se muestra igual en las listas ("pendiente"). */
  pendientesLocales(tipos) {
    const p = this._lsGet('ssta-sgsst-pend', {}), t = String(tipos || '').split(',');
    return Object.keys(p).map((k) => p[k]).filter((x) => t.indexOf(x.tipo) !== -1);
  },
  /** Envía {action:'guardar'|'parche'|'borrar', tipo, id, …}. Devuelve {ok, enCola, …}.
   *  opciones.sinCola: si no hay conexión NO se guarda para después (p. ej. la
   *  clave del Comité de Convivencia: un cambio de clave atrasado sería peligroso). */
  _ses() { const t = Sesion.token(); return t ? '&sesion=' + encodeURIComponent(t) : ''; },
  /** GET con la clave del portal y la sesión (historial, adjuntos, usuarios…). */
  async consultar(params) {
    const q = Object.keys(params).map((k) => k + '=' + encodeURIComponent(params[k])).join('&');
    const res = await fetchWithRetry(this.url() + '?' + q + '&token=' + encodeURIComponent(this.token()) + this._ses());
    const j = await this._json(res);
    if (!j.ok && j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.pedir(j.error); }
    return j;
  },
  async enviar(body, filaLocal, opciones) {
    body = Object.assign({ opId: this.nuevoOpId(), token: this.token(), sesion: Sesion.token() }, body);
    // v134: contra spam en lo que se envía sin usuario: campo trampa invisible y tiempo mínimo en la página
    if (!Sesion.token() && body.action === 'guardar') {
      const tr = document.querySelector('#sstaTrampa input'); if (tr && tr.value) return { ok: true, id: body.id };
      if (body._ms == null) body._ms = Math.round((typeof performance !== 'undefined' ? performance.now() : 5000));
    }
    const encolar = async (motivo) => {
      if (opciones && opciones.sinCola) return { ok: false, error: 'Se necesita conexión (' + motivo + '). Inténtalo de nuevo con señal.', sinConexion: true };
      await Outbox.add(this.url(), body);
      if (filaLocal) { const p = this._lsGet('ssta-sgsst-pend', {}); p[body.id] = Object.assign({ id: body.id, tipo: body.tipo, pendiente: true }, filaLocal); this._lsSet('ssta-sgsst-pend', p); }
      return { ok: true, enCola: true, motivo };
    };
    if (!this.url()) return { ok: false, error: 'El servidor SG-SST no está configurado (config.js → BACKENDS.sgsst).' };
    if (!navigator.onLine) return encolar('sin señal');
    try {
      const res = await fetchWithRetry(this.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
      const j = await this._json(res);
      if (j.ok) return j;
      if (ClavePortal.esErrorDeClave(j)) { ClavePortal.pedir(); return { ok: false, error: j.error, clave: true }; }
      if (j.codigoError === 'SESION') { Sesion.rechazada(); Sesion.marcar({ ok: true, usuarios: true }); Sesion.pedir(j.error); return j; }
      if (j.codigoError === 'CAMBIAR') { if (Sesion.yo()) Sesion.cambiarClave(true); return j; }
      // v142: dato de salud sin autorización de la persona: se pide la base legal y se reintenta.
      if (j.codigoError === 'AUTORIZACION' && body.doc && !body._baseLegalPedida && typeof Dialogo !== 'undefined') {
        const si = await Dialogo.confirmar(j.error + '\n\n¿La persona autoriza que se guarden?');
        if (si) return this.enviar(Object.assign({}, body, { _baseLegalPedida: true, doc: Object.assign({}, body.doc, { autorizaSalud: true }) }), filaLocal, opciones);
        return j;
      }
      if (Outbox._esTemporal(j)) return encolar('servidor ocupado');
      return j;
    } catch (e) {
      return encolar(e.pagina ? 'el servidor no respondió con datos' : 'sin conexión');
    }
  }
};
window.addEventListener('outbox-fallido', (ev) => {
  const b = ev.detail && ev.detail.item && ev.detail.item.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});
window.addEventListener('outbox-enviado', (ev) => {
  const b = ev.detail && ev.detail.body;
  if (!b || !b.id) return;
  const p = SGSST._lsGet('ssta-sgsst-pend', {});
  if (p[b.id]) { delete p[b.id]; SGSST._lsSet('ssta-sgsst-pend', p); }
});

/* ================= PERSONAL HABILITADO =================
   Al escribir o traer la cédula de alguien en un permiso, el ATS o el anexo,
   aparece debajo si está habilitado: "✓ Habilitado", "⚠ Curso de alturas
   vencido el 12/08/2026", "Vence pronto…". Al guardar, si alguien no está
   habilitado, se pide confirmar y queda anotado en el registro.
   Los requisitos y lo que exige cada formato vienen de empresa.js. */
/* v154 · Departamentos y áreas de la empresa (se definen en areas.html y quedan en el perfil de la empresa).
   Todos los campos de «Área» del portal los ofrecen al escribir, para que se llamen igual en todas partes
   (y los informes por área cuadren). Se guardan en el equipo para usarlos también sin señal. */
const Areas = {
  K: 'ssta-areas',
  lista() { try { return JSON.parse(localStorage.getItem(this.K) || '[]'); } catch (e) { return []; } },
  guardarLocal(l) { try { localStorage.setItem(this.K, JSON.stringify(l || [])); } catch (e) {} },
  deTexto(t) { return String(t || '').split(/\n/).map((x) => x.split('|')[0].trim()).filter(Boolean); },
  async refrescar() {
    try {
      if (typeof SGSST === 'undefined' || !SGSST.url() || (typeof Sesion !== 'undefined' && Sesion.modo && Sesion.modo() && !Sesion.yo())) return this.lista();
      const r = await SGSST.listar('empresa', { sinPedir: true }); const f = ((r && r.rows) || []).find((x) => x.id === 'EMPRESA-PERFIL');
      if (f && f.resumen && f.resumen.areasTexto !== undefined) { this.guardarLocal(this.deTexto(f.resumen.areasTexto)); this.enlazar(); }
    } catch (e) {}
    return this.lista();
  },
  SEL: '#inArea, #pArea, #fArea, #obraArea, #iArea, #eArea, #areaAlt, #eqArea, #pProceso, [data-areas]',
  enlazar(raiz) {
    const l = this.lista(); if (!l.length || typeof document === 'undefined') return;
    let dl = document.getElementById('ssta-areas-dl');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'ssta-areas-dl'; document.body.appendChild(dl); }
    const html = l.map((a) => '<option value="' + String(a).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])) + '">').join('');
    if (dl._html !== html) { dl._html = html; dl.innerHTML = html; }
    (raiz || document).querySelectorAll(this.SEL).forEach((i) => {
      const otro = i.getAttribute('list');
      // v162 · El área se escribe igual siempre: si coincide con una oficial (sin importar tildes ni mayúsculas) queda
      // con la ortografía oficial; si es nueva, se avisa en el campo (sin bloquear).
      if (!i.dataset.areaCanon) { i.dataset.areaCanon = '1'; i.addEventListener('change', () => this.canon(i)); }
      if (!otro) { i.setAttribute('list', 'ssta-areas-dl'); i.setAttribute('autocomplete', 'off'); return; }
      if (otro === 'ssta-areas-dl') return;
      const d2 = document.getElementById(otro); if (!d2) return;
      const ya = new Set([...d2.options].map((o) => o.value)); l.forEach((a) => { if (!ya.has(a)) { const o = document.createElement('option'); o.value = a; d2.appendChild(o); } });
    });
  },
  canon(i) {
    const l = this.lista(), v = String(i.value || '').trim(); if (!l.length || !v) return;
    const n = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const of = l.find((a) => n(a) === n(v)); let av = i.parentNode && i.parentNode.querySelector('.area-nueva');
    if (of) { if (of !== v) { i.value = of; i.dispatchEvent(new Event('input', { bubbles: true })); } if (av) av.remove(); return; }
    if (!av) { av = document.createElement('div'); av.className = 'ayuda area-nueva'; i.insertAdjacentElement('afterend', av); }
    av.textContent = '«' + v + '» no está en la lista de áreas. Si es nueva, agrégala en Departamentos y áreas para que los informes no la cuenten aparte.';
  },
  vigilar() {
    if (typeof document === 'undefined' || this._v) return; this._v = true;
    const ir = () => { this.enlazar(); new MutationObserver(() => { clearTimeout(this._t); this._t = setTimeout(() => this.enlazar(), 120); }).observe(document.body, { childList: true, subtree: true }); setTimeout(() => this.refrescar(), 1500); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ir); else ir();
  }
};
if (typeof document !== 'undefined') Areas.vigilar();

/* v159 · Autollenado por cédula en TODO el portal (también permisos, ATS, charlas e inspección de EPP):
   al escribir una cédula conocida (Personal habilitado o la base de personal) o al elegir a alguien por su
   nombre, se llenan solos, en el mismo bloque, los campos VACÍOS de nombre, cédula, cargo, área y empresa.
   Nunca se pisa lo que ya está escrito. */
const AutoCedula = (function () {
  const etiq = (i) => [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), (i.labels && i.labels[0] && i.labels[0].textContent) || (i.closest('.field') && (i.closest('.field').querySelector('label') || {}).textContent) || ''].join(' ');
  const QUE = { cedula: /c[eé]dula|\bcc\b|c\.\s?c\.|documento de identidad|n[uú]mero de documento|^documento|\bdocumento\b/i, cargo: /\bcargo\b|oficio/i, area: /\b[aá]rea\b|departamento|dependencia/i, empresa: /empresa|contratista/i, nombre: /nombre/i };
  const NO = /firma|acudiente|contacto|emergencia|placa|equipo|veh[ií]culo|soporte|archivo|nit\b/i;
  const esCedula = (i) => !i.dataset.cedListo && i.dataset.noAc == null && /^(text|number|tel|search)$/.test(i.type || 'text') && QUE.cedula.test(etiq(i)) && !NO.test(etiq(i));
  // El bloque de la persona: el contenedor más grande que tiene UNA sola cédula (así, en una lista de
  // ejecutantes o asistentes, nunca se llenan las filas de otros), sin salir de su tarjeta o formulario.
  function bloqueDe(i) {
    const tope = i.closest('[data-persona-bloque]'); if (tope) return tope;
    const lim = i.closest('.card, form, .modal, section, .screen') || document.body;
    let el = i.parentElement, mejor = null;
    while (el) {
      const ceds = [...el.querySelectorAll('input')].filter((x) => QUE.cedula.test(etiq(x)) && !NO.test(etiq(x))).length;
      if (ceds > 1) break;
      mejor = el;
      if (el === lim) break;
      el = el.parentElement;
    }
    return mejor;
  }
  function llenarVecinos(i, p) {
    const b = bloqueDe(i); if (!b || !p) return;
    b.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="date"]), select').forEach((x) => {
      if (x === i || x.value || x.disabled || x.readOnly) return; const t = etiq(x); if (NO.test(t)) return;
      const v = QUE.cedula.test(t) ? p.cedula : QUE.cargo.test(t) ? p.cargo : (QUE.area.test(t) && !QUE.empresa.test(t)) ? p.area : QUE.empresa.test(t) ? p.empresa : (QUE.nombre.test(t) || x.dataset.persona != null) && !/apellido/i.test(t) ? p.nombre : '';
      if (!v) return;
      if (x.tagName === 'SELECT' && ![...x.options].some((o) => o.value === v)) return;
      x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async function buscar(ced) {
    const k = Habilitacion.clave(ced); if (k.length < 5) return null;
    let p = null;
    try { const m = await Habilitacion.cargar(); if (m && m[k]) p = m[k]; } catch (e) {}
    if (!p) try { const l = JSON.parse(localStorage.getItem('ssta-personal-lista') || '[]'); p = (Array.isArray(l) ? l : []).find((x) => Habilitacion.clave(x.cedula) === k) || null; } catch (e) {}
    return p ? { nombre: p.nombre || '', cedula: p.cedula || ced, cargo: p.cargo || '', area: p.area || '', empresa: p.empresa || '' } : null;
  }
  function enlazar(i) {
    i.dataset.cedListo = '1';
    const ir = async () => { const p = await buscar(i.value); if (p) llenarVecinos(i, p); };
    i.addEventListener('change', ir); i.addEventListener('blur', ir);
  }
  function revisar(raiz) { (raiz || document).querySelectorAll('input:not([data-ced-listo])').forEach((i) => { if (esCedula(i)) enlazar(i); }); }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const arrancar = () => { revisar(); let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => revisar(), 150); }).observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else setTimeout(arrancar, 0);
  }
  return { llenarVecinos, buscar, revisar };
})();

const Habilitacion = {
  CONFIG_FABRICA: {
    requisitos: {
      seguridad_social: { nombre: 'Pago de seguridad social (PILA)', meses: 1 },
      induccion: { nombre: 'Inducción / reinducción en SST', meses: 12 },
      medico: { nombre: 'Concepto médico ocupacional', meses: 12, apto: true },
      alturas: { nombre: 'Curso de trabajo en alturas', meses: 18 },
      confinados: { nombre: 'Curso de espacios confinados', meses: 12 },
      izajes: { nombre: 'Certificación de izaje (rigger / operador)', meses: 12 },
      electrico: { nombre: 'Competencia en riesgo eléctrico', meses: 12 },
      caliente: { nombre: 'Capacitación en trabajo en caliente', meses: 12 },
      // v151: quien manipula alimentos (casino, cocina, cafetería). Res. 2674 de 2013, art. 11–12: certificado médico y capacitación continua.
      alimentos: { nombre: 'Concepto de manipulación de alimentos', meses: 12, apto: true }
    },
    exigir: { todos: ['seguridad_social', 'induccion', 'medico'], alturas: ['alturas'], confinados: ['confinados'], izajes: ['izajes'], electrico: ['electrico'], caliente: ['caliente'] },
    avisarDias: 15
  },
  config() { const e = (typeof EMPRESA !== 'undefined' && EMPRESA.habilitacion) || {}; const f = this.CONFIG_FABRICA;
    // v151: los requisitos nuevos de fábrica (p. ej. manipulación de alimentos) aparecen también en empresas ya configuradas.
    return { requisitos: e.requisitos ? Object.assign({}, f.requisitos, e.requisitos) : f.requisitos, exigir: e.exigir || f.exigir, avisarDias: e.avisarDias || f.avisarDias }; },
  _mapa: null,
  _cargando: null,
  clave(c) { return String(c || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); },
  /** Mapa cédula → trabajador. Se guarda en el equipo para usarlo sin señal. */
  cargar(forzar) {
    if (this._mapa && !forzar) return Promise.resolve(this._mapa);
    if (this._cargando && !forzar) return this._cargando;
    const desdeCopia = SGSST._lsGet('ssta-habilitacion', null);
    if (desdeCopia && !this._mapa) { this._mapa = desdeCopia.mapa; this._copiaDel = desdeCopia.en || ''; }
    this._cargando = (async () => {
      if (!SGSST.url()) return this._mapa || {};
      // En segundo plano: sin usuario (p. ej. el preoperacional público) no pide entrar ni borra la copia.
      const r = await SGSST.listar('trabajador', { sinPedir: true });
      if (!r.desdeCopia && !r.sinSesion && !r.sinServidor) {
        const mapa = {};
        r.rows.forEach((x) => { const k = this.clave(x.resumen && x.resumen.cedula); if (k) mapa[k] = Object.assign({ id: x.id }, x.resumen); });
        this._mapa = mapa; this._copiaDel = new Date().toISOString();
        SGSST._lsSet('ssta-habilitacion', { mapa, en: this._copiaDel });
      } else { const yo = this; setTimeout(() => { if (yo._cargando === p) yo._cargando = null; }, 120000); }   // v148: sin señal se vuelve a intentar en 2 minutos
      return this._mapa || {};
    })();
    const p = this._cargando;
    return this._cargando;
  },
  /** Requisitos que exige un contexto ("general", "alturas", "confinados"… o varios). */
  exigidos(contexto) {
    const ex = this.config().exigir, set = [];
    (ex.todos || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); });
    [].concat(contexto || []).forEach((c) => (ex[c] || []).forEach((k) => { if (set.indexOf(k) === -1) set.push(k); }));
    return set;
  },
  /** {estado: 'ok'|'pronto'|'mal'|'sin-registro'|'sin-datos', problemas:[], avisos:[]} */
  ALTO_RIESGO: ['alturas', 'confinados', 'izajes', 'electrico', 'caliente'],
  /** v158 · Semáforo de la cuadrilla antes de empezar: cuántos están en verde, por vencer o bloqueados, y por qué.
      filas: [{cc, nombre}]. Pinta en el elemento y devuelve el conteo. */
  semaforo(el, filas, contexto, hasta) {
    if (!el) return null;
    const l = (filas || []).filter((f) => this.clave(f.cc)); if (!l.length) { el.innerHTML = ''; return null; }
    const r = l.map((f) => Object.assign({ f }, this.revisar(f.cc, contexto, hasta)));
    if (r.every((x) => x.estado === 'sin-datos')) { el.innerHTML = ''; return null; }
    const ok = r.filter((x) => x.estado === 'ok'), pr = r.filter((x) => x.estado === 'pronto'), mal = r.filter((x) => x.estado === 'mal'), cl = mal.length ? 'mal' : pr.length ? 'amar' : 'ok';
    const e = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.innerHTML = '<div class="aviso ' + cl + ' sem-cuad"><b>Cuadrilla:</b> ' + ok.length + ' en verde · ' + pr.length + ' por vencer · ' + mal.length + ' no habilitado(s)' +
      (mal.concat(pr).length ? '<ul style="margin:6px 0 0 18px;padding:0;">' + mal.concat(pr).map((x) => '<li><b>' + e(x.f.nombre || x.f.cc) + ':</b> ' + e(x.problemas.concat(x.avisos).slice(0, 3).join(' · ')) + '</li>').join('') + '</ul>' : '') + '</div>';
    return { ok: ok.length, pronto: pr.length, mal: mal.length };
  },
  /** v148: hasta qué fecha debe estar vigente (un permiso de varios días: su último día). */
  revisar(cedula, contexto, hasta) {
    const k = this.clave(cedula);
    if (!k) return { estado: 'sin-datos', problemas: [], avisos: [] };
    const mapa = this._mapa || {};
    if (!Object.keys(mapa).length) return { estado: 'sin-datos', problemas: [], avisos: [] };   // el módulo aún no se usa
    const ctx = [].concat(contexto || []), alto = ctx.some((c) => this.ALTO_RIESGO.indexOf(c) !== -1);
    const t = mapa[k];
    if (!t) return { estado: alto ? 'mal' : 'sin-registro', problemas: ['No está en Personal habilitado'], avisos: [] };   // v148: en alto riesgo, sin registro = no habilitado
    if (t.activo === false) return { estado: 'mal', problemas: ['Está marcado como inactivo en Personal habilitado'], avisos: [], trabajador: t };
    const cfg = this.config(), hoy = Festivos.hoy(), ref = hasta && String(hasta).slice(0, 10) > hoy ? String(hasta).slice(0, 10) : hoy, pronto = Festivos.sumarDias(hoy, cfg.avisarDias);
    const problemas = [], avisos = [];
    // v148: una copia vieja (más de 2 días sin señal) no sirve para decir que alguien está habilitado.
    if (this._copiaDel && Date.now() - new Date(this._copiaDel).getTime() > 48 * 3600000) avisos.push('Lista del personal sin actualizar desde el ' + Festivos.corta(String(this._copiaDel).slice(0, 10)));
    // v157: restricción médica para este trabajo (viene del examen; sin diagnóstico).
    const rm = t.restr;
    if (rm && (rm.para || []).length && (!rm.hasta || rm.hasta >= hoy)) {
      const NOM = { alturas: 'trabajo en alturas', confinados: 'espacios confinados', caliente: 'trabajo en caliente', electrico: 'riesgo eléctrico', izajes: 'izaje de cargas', cargas: 'manipulación de cargas', conduccion: 'conducción', todo: 'el trabajo (concepto no apto)' };
      const afecta = rm.para.filter((p) => p === 'todo' ? alto : ctx.indexOf(p) !== -1);
      afecta.forEach((p) => problemas.push('Restricción médica para ' + NOM[p] + (rm.hasta ? ' hasta el ' + Festivos.corta(rm.hasta) : ' (permanente)')));
      if (!afecta.length) avisos.push('Tiene restricción médica para: ' + rm.para.map((p) => NOM[p] || p).join(', '));
    }
    this.exigidos(ctx).forEach((req) => {
      const def = cfg.requisitos[req] || { nombre: req }, r = (t.req || {})[req];
      if (!r || (!r.fecha && !r.vence)) { problemas.push('Sin ' + def.nombre.charAt(0).toLowerCase() + def.nombre.slice(1)); return; }
      // v148: sin fecha de vencimiento se calcula con la vigencia del requisito (antes quedaba vigente para siempre)
      const vence = String(r.vence || (r.fecha && def.meses ? Festivos.sumarDias(Festivos.sumarMeses(String(r.fecha).slice(0, 10), def.meses), -1) : '') || '').slice(0, 10);
      if (def.apto && !String(r.apto || '').trim()) { problemas.push(def.nombre + ': sin concepto registrado'); return; }
      if (def.apto && /no apto|aplazado/i.test(r.apto || '')) { problemas.push(def.nombre + ': ' + String(r.apto).toUpperCase()); return; }
      if (vence && vence < hoy) { problemas.push(def.nombre + ' vencido el ' + Festivos.corta(vence)); return; }
      if (vence && vence < ref) { problemas.push(def.nombre + ' vence el ' + Festivos.corta(vence) + ', antes de terminar el trabajo'); return; }
      if (vence && vence <= pronto) avisos.push(def.nombre + ' vence el ' + Festivos.corta(vence));
      // Las restricciones (dato de salud) solo se ven en la ficha de la persona. v148: en alto riesgo no pasa sin SST.
      if (def.apto && /restricci/i.test(r.apto || '')) { if (alto) problemas.push('Apto con restricciones: SST debe confirmar que puede hacer este trabajo'); else avisos.push('Apto con restricciones (ver su ficha)'); }
    });
    return { estado: problemas.length ? 'mal' : (avisos.length ? 'pronto' : 'ok'), problemas, avisos, trabajador: t };
  },
  /** v148: LA regla para guardar personas en cualquier formulario (permisos, ATS, registro diario):
   *  no habilitado → solo Administrador o SST con justificación escrita; sin lista → se pregunta y se anota.
   *  filas: [{cc|cedula, nombre}]. Devuelve null si se cancela, o la lista de excepciones/avisos para anotar. */
  async exigir(filas, contexto, op) {
    op = op || {};
    if (typeof SGSST === 'undefined' || !SGSST.url()) return [];
    try { await this.cargar(); } catch (e) {}
    const con = (filas || []).map((f) => ({ cedula: String(f.cc || f.cedula || '').trim(), nombre: f.nombre || '' })).filter((f) => f.cedula);
    if (!con.length) return [];
    if (!this._mapa || !Object.keys(this._mapa).length) {
      const si = await Dialogo.confirmar('No se pudo verificar si estas personas están habilitadas (no hay lista del personal en este celular: sin señal o recién se cerró la sesión).\n\n¿Continuar de todas formas? Quedará anotado.');
      return si ? con.map((f) => Object.assign({ en: new Date().toISOString(), problemas: ['No se pudo verificar la habilitación'] }, f)) : null;
    }
    const malos = [], sinReg = [];
    con.forEach((f) => { const r = this.revisar(f.cedula, contexto, op.hasta), x = Object.assign({}, f, { nombre: f.nombre || (r.trabajador && r.trabajador.nombre) || '', problemas: r.problemas }); if (r.estado === 'mal') malos.push(x); else if (r.estado === 'sin-registro') sinReg.push(x); });
    let excepciones = [];
    if (malos.length) {
      const txt = malos.slice(0, 8).map((p) => '• ' + (p.nombre || 'C.C. ' + p.cedula) + ': ' + p.problemas.join('; ')).join('\n');
      const rol = typeof Sesion !== 'undefined' && Sesion.rol ? Sesion.rol() : '';
      if (rol !== 'admin' && rol !== 'sst') { await Dialogo.avisar((op.que || 'No se puede guardar') + ': no están habilitadas para este trabajo.\n\n' + txt + '\n\nQuítalas o pide al área SST que actualice su curso o concepto (o que autorice una excepción).'); return null; }
      const j = await Dialogo.pedir('Estas personas no están habilitadas:\n\n' + txt + '\n\nComo ' + (rol === 'admin' ? 'administrador' : 'SST') + ' puedes hacer una excepción. Escribe la justificación (queda en el registro):', '');
      if (!j || j.trim().length < 10) return null;
      excepciones = malos.map((p) => Object.assign({ en: new Date().toISOString(), excepcion: j.trim(), autorizo: Sesion.nombre ? Sesion.nombre() : '' }, p));
    }
    const r2 = await this.confirmar(sinReg);
    if (r2 === null) return null;
    return excepciones.concat(r2);
  },
  _pintar(input, contexto) {
    const r = this.revisar(input.value, typeof contexto === 'function' ? contexto() : contexto);
    const cont = input.closest('.exec-fields, .grid2, .field, .fila-campos') || input;
    let el = cont.nextElementSibling && cont.nextElementSibling.classList && cont.nextElementSibling.classList.contains('hab-aviso') ? cont.nextElementSibling : null;
    if (r.estado === 'sin-datos') { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'hab-aviso'; cont.insertAdjacentElement('afterend', el); }
    el.dataset.estado = r.estado;
    el.textContent = r.estado === 'ok' ? '✓ Habilitado' : r.estado === 'pronto' ? '⏳ ' + r.avisos.join(' · ') : '⚠ ' + r.problemas.concat(r.avisos).join(' · ');
  },
  /** Pone el aviso debajo de cada campo de cédula que coincida (también los que se llenan solos). */
  vigilar(raiz, selector, contexto) {
    if (!SGSST.url()) return;
    const vistos = new WeakMap();
    const revisarTodo = () => {
      (raiz || document).querySelectorAll(selector).forEach((inp) => {
        const v = inp.value + '|' + (this._mapa ? 1 : 0) + '|' + JSON.stringify(typeof contexto === 'function' ? contexto() : contexto);
        if (vistos.get(inp) === v) return;
        vistos.set(inp, v);
        this._pintar(inp, contexto);
      });
    };
    this.cargar().then(revisarTodo).catch(() => {});
    setInterval(revisarTodo, 1200);
  },
  /** Para guardar: lista de personas con problemas en esa zona. */
  problemasEn(raiz, selector, contexto, nombreDe) {
    const out = [];
    (raiz || document).querySelectorAll(selector).forEach((inp) => {
      if (!inp.value.trim()) return;
      const r = this.revisar(inp.value, typeof contexto === 'function' ? contexto() : contexto);
      if (r.estado === 'mal' || r.estado === 'sin-registro') out.push({ cedula: inp.value.trim(), nombre: (nombreDe && nombreDe(inp)) || (r.trabajador && r.trabajador.nombre) || '', problemas: r.problemas });
    });
    return out;
  },
  /** Pide confirmar si hay personas no habilitadas. Devuelve null si se cancela, o la lista (para dejarla anotada). */
  async confirmar(lista, anotar) {
    if (!lista.length) return [];
    const txt = 'Estas personas NO están habilitadas según Personal habilitado:\n\n' +
      lista.slice(0, 8).map((p) => '• ' + (p.nombre || 'C.C. ' + p.cedula) + ': ' + p.problemas.join('; ')).join('\n') + (lista.length > 8 ? '\n…y ' + (lista.length - 8) + ' más' : '') +
      '\n\n¿Guardar de todas formas?' + (anotar === false ? '' : ' Quedará anotado en el registro.');
    if (!await Dialogo.confirmar(txt)) return null;
    return lista.map((p) => Object.assign({ en: new Date().toISOString() }, p));
  }
};

