/* ================= CLAVE DEL PORTAL =================
   El token de config.js es público (GitHub): cualquiera con él podía leer
   nombres, cédulas y firmas. Ahora cada backend puede exigir una CLAVE que
   no está en GitHub: se escribe una vez en cada celular y queda guardada
   en ese equipo. Mientras un equipo no tenga clave, se sigue usando el
   token de config.js (los backends que aún no tengan clave lo aceptan). */
/* v115: la consola del administrador (admin.html, asesor.html) guarda su sesión y su
   clave aparte (ssta-admin-…): en el mismo equipo no se mezclan con las de un cliente. */
const Consola = {
  activa() { return typeof EMPRESA !== 'undefined' && !!EMPRESA.consola; },
  clave(k) { return this.activa() ? k.replace(/^ssta-/, 'ssta-admin-') : k; },
  /** ¿En este equipo entró el administrador general? (ve los detalles técnicos). */
  esEquipoAdmin() {
    try { const s = JSON.parse(localStorage.getItem('ssta-admin-sesion') || 'null'); return !!(s && s.token && s.exp > Date.now() && s.yo && s.yo.rol === 'admin'); } catch (e) { return false; }
  }
};
const ClavePortal = {
  get KEY() { return Consola.clave('ssta-clave-portal'); },
  get() { try { return localStorage.getItem(this.KEY) || ''; } catch (e) { return ''; } },
  tiene() { return !!this.get(); },
  guardar(v) {
    try { if (v) localStorage.setItem(this.KEY, v); else localStorage.removeItem(this.KEY); } catch (e) { /* modo privado */ }
    this.aplicar();
  },
  aplicar() {
    if (typeof PORTAL_CONFIG === 'undefined') return;
    if (PORTAL_CONFIG._tokenOriginal === undefined) PORTAL_CONFIG._tokenOriginal = PORTAL_CONFIG.API_TOKEN;
    PORTAL_CONFIG.API_TOKEN = this.get() || PORTAL_CONFIG._tokenOriginal;
  },
  esErrorDeClave(j) {
    return !!(j && j.ok === false && (j.codigoError === 'CLAVE' || /token inv[aá]lido/i.test(String(j.error || ''))));
  },
  _abierto: false,
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body) return;
    if (document.body.hasAttribute('data-sin-clave')) return;   // v174: el auditor entra con su enlace; nunca se le pide la clave del portal
    this._abierto = true;
    const tenia = this.tiene();
    const fondo = document.createElement('div');
    fondo.className = 'clave-fondo';
    fondo.innerHTML =
      '<div class="clave-caja" role="dialog" aria-modal="true" aria-labelledby="claveTitulo">' +
      '<h3 id="claveTitulo">🔑 Clave del portal</h3>' +
      '<p>' + esc(motivo || (tenia
        ? 'El servidor no aceptó la clave guardada en este equipo. Escribe la clave vigente (la da el área SSTA).'
        : 'Para ver y guardar datos del personal, este equipo necesita la clave del portal. Se escribe una sola vez: queda guardada en este celular.')) + '</p>' +
      '<input type="password" id="claveInput" autocomplete="current-password" placeholder="Clave del portal">' +
      '<label class="clave-ver"><input type="checkbox" id="claveVer"> Mostrar</label>' +
      '<div class="clave-acc"><button type="button" class="btn-main" id="claveGuardar">Guardar clave</button>' +
      '<button type="button" class="btn-secondary" id="claveCancelar">Ahora no</button></div>' +
      (tenia ? '<button type="button" class="clave-quitar" id="claveQuitar">Quitar la clave de este equipo</button>' : '') +
      '</div>';
    document.body.appendChild(fondo);
    const inp = fondo.querySelector('#claveInput');
    const cerrar = () => { fondo.remove(); this._abierto = false; };
    fondo.querySelector('#claveVer').addEventListener('change', (e) => { inp.type = e.target.checked ? 'text' : 'password'; });
    fondo.querySelector('#claveCancelar').addEventListener('click', cerrar);
    const q = fondo.querySelector('#claveQuitar');
    if (q) q.addEventListener('click', () => { this.guardar(''); cerrar(); ClavePortal._despues(); });
    const guardarla = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      this.guardar(v); cerrar(); ClavePortal._despues();
    };
    fondo.querySelector('#claveGuardar').addEventListener('click', guardarla);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') guardarla(); });
    setTimeout(() => inp.focus(), 50);
  },
  /* Después de cambiar la clave: lo pendiente se reintenta con la nueva. Las
     páginas sin formulario (inicio, tablero) se recargan para volver a
     consultar; en un formulario NO se recarga, para no perder lo escrito. */
  async _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    const hayFormulario = document.querySelector('#app, #atsApp, form');
    if (!hayFormulario) location.reload();
    else await Dialogo.avisar('Clave guardada en este equipo. Vuelve a intentar lo que estabas haciendo (buscar, guardar o abrir).');
  }
};
ClavePortal.aplicar();

/* ================= JORNADA: ATS → PERMISOS → CHARLA → ANEXO =================
   Antes eran cuatro formatos que se llenaban por separado con los MISMOS
   datos (trabajo, sitio, fechas, personal). Ahora, al guardar el ATS, se
   inicia una "jornada": cada paso se abre con lo del ATS ya puesto y, al
   guardarse, queda marcado. Una barra arriba muestra el avance y lleva al
   siguiente paso. Vive en este equipo (localStorage) hasta que se termina o
   pasan 20 horas. */
const Jornada = {
  KEY: 'ssta-jornada',
  FLAG: 'ssta-jornada-en-curso',
  VIGENCIA_MS: 20 * 3600 * 1000,
  _leer() { try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; } },
  _escribir(j) { try { localStorage.setItem(this.KEY, JSON.stringify(j)); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** datos: { atsCode, trabajo, sitio, desde, hasta, horaDesde, horaHasta, responsable, personas:[{nombre,cc,cargo}], permisosReq:['alturas',…] } */
  iniciar(datos) {
    const prev = this._leer();
    const mismo = prev && prev.atsCode === datos.atsCode;
    const j = Object.assign({}, datos, { t: Date.now(), hechos: mismo ? (prev.hechos || {}) : {} });
    this._escribir(j);
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    return j;
  },
  actual() {
    const j = this._leer();
    if (!j || !j.atsCode || Date.now() - (j.t || 0) > this.VIGENCIA_MS) return null;
    return j;
  },
  terminar() { try { localStorage.removeItem(this.KEY); sessionStorage.removeItem(this.FLAG); } catch (e) {} window.dispatchEvent(new CustomEvent('jornada-cambio')); },
  /** ¿Esta página se abrió como parte de la jornada? (enlace con ?jornada=1 o la misma pestaña). */
  enJornada() {
    if (!this.actual()) return false;
    if (/[?&]jornada=1\b/.test(location.search)) { try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {} return true; }
    try { return sessionStorage.getItem(this.FLAG) === '1'; } catch (e) { return false; }
  },
  marcar(paso, info) {
    const j = this.actual();
    if (!j) return;
    j.hechos = j.hechos || {};
    j.hechos[paso] = Object.assign({ t: Date.now() }, info || {});
    this._escribir(j);
    if (!(info && info.omitido)) setTimeout(() => this._avisoPaso(paso), 600);
  },
  /** Lo llama el permiso al guardarse: solo cuenta si es del ATS de la jornada. */
  marcarPermiso(tipo, code, atsCode, pendiente) {
    const j = this.actual();
    if (!j || !tipo || (atsCode && atsCode !== j.atsCode) || !atsCode) return;
    this.marcar('permiso:' + tipo, { code, pendiente: !!pendiente });
  },
  pasos(j) {
    j = j || this.actual();
    if (!j) return [];
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const h = j.hechos || {};
    const out = [{ id: 'ats', titulo: 'ATS', icono: '🧭', hecho: { code: j.atsCode } }];
    (j.permisosReq || []).forEach((k) => {
      if (!B[k]) return;
      out.push({ id: 'permiso:' + k, titulo: B[k].nombre.replace(/^Trabajo (en |)/i, ''), icono: B[k].icono || '📝', hecho: h['permiso:' + k] || null });
    });
    out.push({ id: 'charla', titulo: 'Charla', icono: '🗣️', hecho: h.charla || null });
    out.push({ id: 'anexo', titulo: 'Anexo', icono: '👷', hecho: h.anexo || null });
    return out;
  },
  siguiente(j) { return this.pasos(j).find((p) => !p.hecho) || null; },
  /** Qué paso es esta página (si es uno de la jornada). */
  pasoDeEstaPagina() {
    const aqui = (location.pathname.split('/').pop() || '');
    if (aqui === 'asistencia.html') return 'charla';
    if (aqui === 'personal-autorizado.html') return 'anexo';
    if (aqui === 'ats.html') return 'ats';
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x].archivo === aqui);
    return k ? 'permiso:' + k : null;
  },
  /** Va al paso. A los permisos se les deja el prellenado del ATS (como el botón del ATS). */
  async abrir(id) {
    const j = this.actual();
    if (!j) return;
    try { sessionStorage.setItem(this.FLAG, '1'); } catch (e) {}
    const B = PORTAL_CONFIG.BACKENDS;
    if (id === 'ats') { location.href = 'ats.html?code=' + encodeURIComponent(j.atsCode) + '&jornada=1'; return; }
    if (id === 'charla') { location.href = 'asistencia.html?jornada=1'; return; }
    if (id === 'anexo') { location.href = 'personal-autorizado.html?jornada=1'; return; }
    if (id.indexOf('permiso:') === 0) {
      const k = id.slice(8);
      if (!B[k]) return;
      const prefill = { t: Date.now(), tipo: k, atsCode: j.atsCode, trabajo: j.trabajo || '', sitio: j.sitio || '',
        desde: j.desde || '', hasta: j.hasta || j.desde || '', horaDesde: j.horaDesde || '', horaHasta: j.horaHasta || '',
        responsable: j.responsable || '', personas: j.personas || [] };
      try { localStorage.setItem('ssta-prefill-permiso', JSON.stringify(prefill)); } catch (e) { await Dialogo.avisar('No se pudo preparar el permiso (memoria del equipo llena).'); return; }
      location.href = B[k].archivo + '?desdeAts=1&jornada=1';
    }
  },
  omitir(id) { this.marcar(id, { omitido: true }); },
  /** Ir a un paso. Si el paso es esta misma página (charla o anexo), no se recarga: la página lo abre. */
  ir(id) {
    if (id === this.pasoDeEstaPagina() && (id === 'charla' || id === 'anexo')) { window.dispatchEvent(new CustomEvent('jornada-ir', { detail: id })); return; }
    this.abrir(id);
  },
  /** Aviso abajo al terminar un paso, con botón al siguiente (la barra queda arriba, fuera de vista). */
  _avisoPaso(paso) {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    const j = this.actual(); if (!j) return;
    const sig = this.siguiente(j);
    const hecho = (this.pasos(j).find((p) => p.id === paso) || {}).titulo || 'Paso';
    const prev = document.getElementById('jornadaAviso'); if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'jornadaAviso';
    el.className = 'jornada-aviso';
    el.innerHTML = '<span>✓ ' + esc(hecho) + ' listo.' + (sig ? ' Siguiente: <b>' + esc(sig.icono + ' ' + sig.titulo) + '</b>' : ' <b>Jornada completa.</b>') + '</span>' +
      (sig ? '<button type="button">Ir →</button>' : '') + '<button type="button" class="x" aria-label="Cerrar">✕</button>';
    document.body.appendChild(el);
    const b = el.querySelector('button:not(.x)');
    if (b) b.onclick = () => { el.remove(); this.ir(sig.id); };
    el.querySelector('.x').onclick = () => el.remove();
    setTimeout(() => { if (el.parentNode) el.remove(); }, 15000);
  },
  /** Barra de avance arriba de la página (solo si la página es parte de la jornada). */
  barra() {
    if (typeof document === 'undefined' || !this.enJornada()) return;
    if (this._pintar) { this._pintar(); return; } // ya está puesta: solo se repinta
    const pintar = () => {
      const j = this.actual();
      let el = document.getElementById('jornadaBarra');
      if (!j) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'jornadaBarra';
        el.className = 'jornada-barra';
        document.body.insertBefore(el, document.body.firstChild);
      }
      const pasos = this.pasos(j), sig = this.siguiente(j);
      const aquiPaso = this.pasoDeEstaPagina();
      el.innerHTML = '<div class="jb-fila"><span class="jb-tit">🗂️ Jornada · <b>' + esc(j.atsCode) + '</b></span>' +
        '<button type="button" class="jb-ver">Ver pasos</button></div>' +
        '<div class="jb-pasos">' + pasos.map((p) => '<span class="jb-paso' + (p.hecho ? (p.hecho.omitido ? ' omit' : ' ok') : '') + '">' +
          (p.hecho ? (p.hecho.omitido ? '–' : '✓') : '○') + ' ' + esc(p.titulo) + '</span>').join('') + '</div>' +
        (!sig ? '<div class="jb-fin">✓ Jornada completa. <button type="button" class="jb-terminar">Terminar</button></div>'
          : (sig.id === aquiPaso && sig.id.indexOf('permiso:') === 0)
            ? '<div class="jb-aqui">✍️ Estás en este paso: diligencia y guarda el permiso para seguir.</div>'
            : '<button type="button" class="jb-sig" data-paso="' + esc(sig.id) + '">Siguiente: ' + esc(sig.icono + ' ' + sig.titulo) + ' →</button>');
      const bs = el.querySelector('.jb-sig');
      if (bs) bs.onclick = () => this.ir(sig.id);
      el.querySelector('.jb-ver').onclick = () => this.mostrarPanel();
      const bt = el.querySelector('.jb-terminar');
      if (bt) bt.onclick = () => { this.terminar(); };
    };
    this._pintar = pintar;
    pintar();
    window.addEventListener('jornada-cambio', pintar);
    window.addEventListener('storage', (e) => { if (e.key === this.KEY) pintar(); });
    window.addEventListener('pageshow', pintar);
  },
  /** Ventana con todos los pasos: abrir, omitir o terminar la jornada. */
  async mostrarPanel() {
    const j = this.actual();
    if (!j) { await Dialogo.avisar('No hay una jornada en curso en este equipo.'); return; }
    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:86vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja); document.body.appendChild(fondo);
    const cerrar = () => fondo.remove();
    fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
    const pinta = () => {
      const jj = this.actual();
      if (!jj) { cerrar(); return; }
      const pasos = this.pasos(jj);
      caja.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><h3 style="margin:0;font-size:var(--fs-campo);">🗂️ Jornada del ' + esc(jj.atsCode) + '</h3>' +
        '<button type="button" data-cerrar style="border:1px solid var(--line);background:#fff;border-radius:var(--r-s);padding:7px 12px;font-weight:700;cursor:pointer;">Cerrar</button></div>' +
        '<p style="margin:6px 0 12px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.45;">' + esc(jj.trabajo || '') + (jj.sitio ? ' · ' + esc(jj.sitio) : '') + '<br>Cada paso se abre con los datos y el personal del ATS (' + (jj.personas || []).length + ' persona(s)) ya puestos. Cada persona firma en cada formato.</p>' +
        pasos.map((p, i) => {
          const h = p.hecho;
          const estado = !h ? '<span style="color:var(--ambar-700);font-weight:700;">Pendiente</span>'
            : h.omitido ? '<span style="color:var(--n-400);font-weight:700;">Omitido</span>'
            : '<span style="color:var(--ok);font-weight:700;">✓ ' + (h.code ? esc(h.code) : 'Hecho') + (h.pendiente ? ' (en cola)' : '') + '</span>';
          const acc = p.id === 'ats' ? '' :
            '<div style="display:flex;gap:7px;margin-top:8px;"><button type="button" data-abrir="' + esc(p.id) + '" style="flex:1;padding:10px;border:none;background:' + (h ? '#fff;border:1.5px solid var(--line);color:var(--ink)' : '#c9a227;color:var(--ink)') + ';border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">' + (h ? 'Abrir de nuevo' : 'Abrir ' + esc(p.titulo.toLowerCase())) + '</button>' +
            (h ? '' : '<button type="button" data-omitir="' + esc(p.id) + '" style="padding:10px 12px;border:1.5px solid var(--line);background:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);color:var(--ink-soft);cursor:pointer;">No aplica</button>') + '</div>';
          return '<div style="border:1px solid var(--line);border-radius:var(--r-m);padding:11px 12px;margin-bottom:8px;' + (h ? '' : 'border-left:4px solid var(--ambar-600);') + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:var(--fs-base);"><b>' + (i + 1) + '. ' + esc(p.icono + ' ' + p.titulo) + '</b>' + estado + '</div>' + acc + '</div>';
        }).join('') +
        '<button type="button" data-terminar style="width:100%;margin-top:6px;padding:11px;border:1.5px solid var(--rojo-200);background:#fff;color:var(--warn);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Terminar la jornada en este equipo</button>';
      caja.querySelector('[data-cerrar]').onclick = cerrar;
      caja.querySelectorAll('[data-abrir]').forEach((b) => { b.onclick = () => { cerrar(); this.abrir(b.dataset.abrir); }; });
      caja.querySelectorAll('[data-omitir]').forEach((b) => { b.onclick = () => { this.omitir(b.dataset.omitir); pinta(); }; });
      caja.querySelector('[data-terminar]').onclick = async () => { if (await Dialogo.confirmar('¿Terminar la jornada? Lo que ya se guardó no se borra; solo se quita la barra de avance de este equipo.')) { this.terminar(); cerrar(); } };
    };
    pinta();
  }
};

/* ================= TRAER PERSONAL DE UN ATS =================
   La gente que firmó el ATS del día es casi siempre la misma que firma la
   charla y el anexo. Este selector lista los ATS abiertos y devuelve sus
   participantes (nombre, cédula, cargo) para agregarlos con un toque; cada
   persona firma de nuevo en el formato donde se agrega.
   Uso:  const r = await TraerDeAts.elegir();  // null si se cancela
         r → { code, trabajo, area, personas:[{nombre, cedula, cargo}] } */
const TraerDeAts = {
  elegir() {
    return new Promise(async (resolve) => {
      const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS && PORTAL_CONFIG.BACKENDS.ats) || {};
      if (!B.url) { await Dialogo.avisar('El ATS no tiene servidor configurado en config.js.'); resolve(null); return; }
      const fondo = document.createElement('div');
      fondo.className = 'tda-fondo';
      fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10001;display:flex;align-items:flex-end;justify-content:center;';
      const caja = document.createElement('div');
      caja.style.cssText = 'background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:680px;max-height:82vh;overflow:auto;padding:16px 16px 22px;font-family:var(--font-family,sans-serif);';
      fondo.appendChild(caja);
      document.body.appendChild(fondo);
      const cerrar = (r) => { fondo.remove(); resolve(r); };
      fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(null); });
      const cab = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px;"><h3 style="margin:0;font-size:var(--fs-campo);">🧭 Traer personal de un ATS</h3>' +
        '<button type="button" data-cerrar style="border:1px solid var(--line);background:#fff;border-radius:var(--r-s);padding:7px 12px;font-weight:700;cursor:pointer;">Cancelar</button></div>' +
        '<p style="margin:0 0 12px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.45;">Se traen nombre, cédula y cargo de quienes están en el ATS. Cada persona debe firmar aquí.</p>';
      const pinta = (html) => { caja.innerHTML = cab + html; caja.querySelector('[data-cerrar]').onclick = () => cerrar(null); };
      pinta('<div style="text-align:center;color:var(--ink-soft);font-size:var(--fs-base);padding:18px;">Buscando ATS abiertos…</div>');
      const token = encodeURIComponent(PORTAL_CONFIG.API_TOKEN);
      fetchWithRetry(B.url + '?list=1&token=' + token).then((r) => r.json()).then((data) => {
        if (!data || !data.ok || !Array.isArray(data.rows)) throw new Error((data && data.error) || 'el servidor del ATS no respondió con datos');
        const abiertos = data.rows.filter((r) => String(r.estado || '').toUpperCase() !== 'CERRADO')
          .sort((a, b) => String(b.fechaDesde || b.updatedAt || '').localeCompare(String(a.fechaDesde || a.updatedAt || ''))).slice(0, 40);
        if (!abiertos.length) { pinta('<div style="padding:14px;text-align:center;color:var(--ink-soft);font-size:var(--fs-base);">No hay ATS abiertos en este momento.</div>'); return; }
        pinta(abiertos.map((r) => {
          const venc = (typeof atsVencido === 'function' && atsVencido(r)) ? ' · <b style="color:var(--warn);">vencido</b>' : '';
          const f = String(r.fechaDesde || '').slice(0, 10);
          return '<button type="button" data-ats="' + esc(r.code) + '" style="display:block;width:100%;text-align:left;border:1.5px solid var(--line);background:#fff;border-radius:var(--r-m);padding:11px 12px;margin-bottom:8px;cursor:pointer;font-family:inherit;">' +
            '<b class="u-fs-base">' + esc(r.code) + '</b><span style="float:right;font-size:var(--fs-etiqueta);font-weight:700;background:var(--bg);border-radius:var(--r-xl);padding:2px 8px;">' + (Number(r.participantes) || 0) + ' 👤</span><br>' +
            '<span style="font-size:var(--fs-menor);color:var(--ink);">' + esc(String(r.trabajo || '').slice(0, 90)) + '</span><br>' +
            '<span style="font-size:var(--fs-etiqueta);color:var(--ink-soft);">' + esc([f, r.area, r.centroCostos].filter(Boolean).join(' · ')) + venc + '</span></button>';
        }).join(''));
        caja.querySelectorAll('[data-ats]').forEach((b) => {
          b.onclick = async () => {
            const code = b.dataset.ats;
            b.disabled = true; b.style.opacity = '.6';
            try {
              const res = await fetchWithRetry(B.url + '?code=' + encodeURIComponent(code) + '&token=' + token);
              const j = await res.json();
              if (!j || !j.ok || !j.ats) throw new Error((j && j.error) || 'no se pudo abrir el ATS');
              const personas = (j.ats.participantes || []).map((p) => ({
                nombre: (String(p.nombres || '') + ' ' + String(p.apellidos || '')).trim() || String(p.nombre || '').trim(),
                cedula: String(p.cedula || '').trim(), cargo: String(p.cargo || '').trim()
              })).filter((p) => p.nombre);
              const cabAts = j.ats.cab || {};
              cerrar({ code, trabajo: cabAts.trabajo || '', area: cabAts.area || '', personas });
            } catch (e) {
              b.disabled = false; b.style.opacity = '1';
              await Dialogo.avisar('No se pudo traer el personal de ' + code + ': ' + e.message);
            }
          };
        });
      }).catch((e) => {
        pinta('<div style="padding:12px;background:var(--rojo-50);border:1px solid var(--rojo-200);color:var(--rojo-900);border-radius:var(--r-m);font-size:var(--fs-menor);line-height:1.45;">No se pudo consultar los ATS: ' + esc(e.message || 'sin conexión') + '.</div>');
      });
    });
  }
};

/* ================= VIGENCIA DE UN ATS =================
   Un ATS vale hasta el final del día de su fecha "hasta" (o de su fecha
   "desde" si no tiene). Después de eso, si sigue abierto, está VENCIDO: es
   de lo primero que se marca en una auditoría. Lo usan el tablero, el
   inicio y las listas del ATS. */
function atsVence(row) {
  const f = String((row && (row.fechaHasta || row.fechaDesde)) || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], 23, 59, 0, 0);
}
function atsVencido(row) {
  if (!row || row.estado === 'CERRADO') return false;
  const v = atsVence(row);
  return !!v && v.getTime() < Date.now();
}

