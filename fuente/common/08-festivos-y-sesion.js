/* ================= FESTIVOS DE COLOMBIA Y DÍAS HÁBILES =================
   Ley 51 de 1983 ("Emiliani") y Semana Santa. La misma cuenta está en
   backend-sgsst.gs, para que el celular y el correo digan el mismo plazo
   (reporte a la ARL: 2 días hábiles). */
const Festivos = {
  _cache: {},
  de(anio) {
    if (this._cache[anio]) return this._cache[anio];
    const iso = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
    const f = (m, d) => new Date(Date.UTC(anio, m - 1, d));
    const lunes = (d) => { const w = d.getUTCDay(); if (w !== 1) d.setUTCDate(d.getUTCDate() + ((8 - w) % 7)); return d; };
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, g = Math.floor((8 * b + 13) / 25);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 19 * l) / 433);
    const mes = Math.floor((h + l - 7 * m + 90) / 25), dia = (h + l - 7 * m + 33 * mes + 19) % 32;
    const pascua = f(mes, dia);
    const mas = (n) => { const x = new Date(pascua.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };
    const set = {};
    [f(1, 1), f(5, 1), f(7, 20), f(8, 7), f(12, 8), f(12, 25), mas(-3), mas(-2),
      lunes(f(1, 6)), lunes(f(3, 19)), lunes(f(6, 29)), lunes(f(8, 15)), lunes(f(10, 12)), lunes(f(11, 1)), lunes(f(11, 11)),
      lunes(mas(39)), lunes(mas(60)), lunes(mas(68))].forEach((x) => { set[iso(x)] = true; });
    return (this._cache[anio] = set);
  },
  esHabil(iso) { const p = iso.split('-').map(Number); const w = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); return w !== 0 && w !== 6 && !this.de(p[0])[iso]; },
  sumarDias(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return d.toISOString().slice(0, 10); },
  sumarHabiles(iso, n) { let d = iso, k = 0; while (k < n) { d = this.sumarDias(d, 1); if (this.esHabil(d)) k++; } return d; },
  hoy() { return new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10); },   // v148: siempre hora de Colombia (UTC−5, sin horario de verano), aunque el celular tenga otra zona
  sumarMeses(iso, n) { const p = iso.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1 + n, p[2])); if (d.getUTCDate() !== p[2]) d.setUTCDate(0); return d.toISOString().slice(0, 10); },
  corta(iso) { return /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : (iso || ''); }
};

/* ================= USUARIOS CON NOMBRE (SG-SST) =================
   Opcional: si el servidor SG-SST tiene usuarios, cada quien entra con su
   usuario y su clave. La clave NUNCA sale del celular: se deriva una "prueba"
   (PBKDF2, 150.000 vueltas) con la sal del usuario y eso es lo que viaja.
   La sesión dura 30 días en un equipo personal y 12 horas en uno compartido. */
const Sesion = {
  get KEY() { return Consola.clave('ssta-sesion'); },
  get KEY_MODO() { return Consola.clave('ssta-sgsst-usuarios'); },
  ITER: 150000,
  get() { try { const s = JSON.parse(localStorage.getItem(this.KEY) || 'null'); if (s && s.token && s.exp > Date.now()) return s; } catch (e) {} return null; },
  token() { const s = this.get(); return s ? s.token : ''; },
  yo() { const s = this.get(); return s ? s.yo : null; },
  nombre() { const y = this.yo(); return y ? y.nombre : ''; },
  rol() { const y = this.yo(); return y ? y.rol : ''; },
  /** ¿El servidor usa usuarios? (lo dice cada lista que llega). */
  modo() { try { return localStorage.getItem(this.KEY_MODO) === '1'; } catch (e) { return false; } },
  _guardar(r) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ token: r.sesion, exp: r.exp, yo: r.yo })); localStorage.setItem(this.KEY_MODO, '1'); } catch (e) {}
    this.pintarChip();
  },
  /** Lo que dice el servidor en cada lista: si hay usuarios y quién soy (rol al día). */
  marcar(j) {
    if (!j || !j.ok) return;
    try {
      if (j.usuarios) localStorage.setItem(this.KEY_MODO, '1'); else localStorage.removeItem(this.KEY_MODO);
      const s = this.get();
      if (s && j.yo && j.yo.usuario === s.yo.usuario && JSON.stringify(j.yo) !== JSON.stringify(s.yo)) { s.yo = j.yo; localStorage.setItem(this.KEY, JSON.stringify(s)); this.pintarChip(); }
    } catch (e) {}
  },
  // v142: al cerrar sesión se borra del celular todo lo que se leyó o se dejó escrito (listas, registros,
  // personal, borradores, autoguardado). Solo queda lo que espera señal para enviarse (cola) y los ajustes.
  BORRAR_AL_SALIR: /^(ats-borrador|ats-plantillas)|ssta-(auto\||sgsst-lista|sgsst-doc|sgsst-usuarios|personal-lista|habilitacion|recientes|plantillas|ats-ultimo|ats-permisos|asis-personal|asis-doc|asis-borrador|convivencia-informe|prefill-permiso|draft-|reporta|tabla-|buzon-pub|ultimo-usuario|ultimo-sitio-permiso|ultimo-permiso-)/,
  /** v147: antes de salir avisa si hay envíos sin subir (quedan en el celular y se envían al volver la señal). */
  async salirSeguro() {
    let n = 0; try { if (typeof Outbox !== 'undefined') n = (await Outbox.list()).length; } catch (e) {}
    if (n && typeof Dialogo !== 'undefined' && !await Dialogo.confirmar('Hay ' + n + ' envío' + (n === 1 ? '' : 's') + ' sin subir (sin señal). Se quedan en este celular y se envían solos al volver la conexión, aunque cierres la sesión.\n\n¿Salir de todas formas?')) return false;
    this.salir(); location.reload(); return true;
  },
  salir() { try { if (typeof Habilitacion !== 'undefined') { Habilitacion._mapa = null; Habilitacion._cargando = null; } } catch (e) {} try { localStorage.removeItem(this.KEY); localStorage.removeItem('ssta-pendientes'); Object.keys(localStorage).filter((k) => this.BORRAR_AL_SALIR.test(k)).forEach((k) => localStorage.removeItem(k)); Object.keys(sessionStorage).filter((k) => /ssta-/.test(k)).forEach((k) => sessionStorage.removeItem(k)); } catch (e) {} try { if (typeof AutoGuardado !== 'undefined' && AutoGuardado._idb) AutoGuardado._idb.borrarPrefijo(''); } catch (e) {} this.pintarChip(); },
  /** Usuario dentro de un token (sin validar: solo para decidir qué reenviar). */
  _carga(tok) { try { const p = String(tok || '').split('.')[1]; return JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; } },
  /** Para la cola: se reenvía con la sesión de ahora si es de la misma persona (o si la del
   *  registro venció o la rechazaron); la de otra persona, vigente, se respeta. */
  paraReenvio(tok, rechazada) {
    const c = this._carga(tok), yo = this.yo(), ahora = this.token();
    if (!ahora) return tok || '';
    if (rechazada || !c || !(c.exp > Date.now()) || (yo && c.u === yo.usuario)) return ahora;
    return tok;
  },
  /** El servidor no aceptó la sesión de este equipo (venció, la cerraron o cambió la clave). */
  rechazada() { if (this.get()) { try { localStorage.removeItem(this.KEY); } catch (e) {} this.pintarChip(); } },
  nuevaSal() { const a = crypto.getRandomValues(new Uint8Array(16)); return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join(''); },
  async derivar(clave, salHex, iter) {
    const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
    const sal = new Uint8Array(String(salHex).match(/../g).map((h) => parseInt(h, 16)));
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: Number(iter) || this.ITER }, llave, 256));
    let t = ''; bits.forEach((b) => { t += String.fromCharCode(b); }); return btoa(t);
  },
  claveDebil(c) { c = String(c || ''); return c.length < 8 || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(c) || !/\d/.test(c); },
  async _post(body) {
    const res = await fetch(SGSST.url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: SGSST.token(), opId: SGSST.nuevoOpId() }, body)) });
    return SGSST._json(res);
  },
  async _sal(usuario) {
    const res = await fetchWithRetry(SGSST.url() + '?action=sal&usuario=' + encodeURIComponent(usuario) + '&token=' + encodeURIComponent(SGSST.token()));
    const j = await SGSST._json(res);
    if (!j.ok) throw new Error(j.error || 'No se pudo consultar el usuario.');
    return j;
  },
  async entrar(usuario, clave, compartido) {
    usuario = String(usuario || '').trim().toLowerCase();
    const s = await this._sal(usuario);
    let disp = ''; try { disp = localStorage.getItem('ssta-disp') || ''; if (!disp) { disp = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem('ssta-disp', disp); } } catch (e) {}
    const r = await this._post({ action: 'entrar', usuario, prueba: await this.derivar(clave, s.salt, s.iter), compartido: !!compartido, disp });
    if (r.ok) this._guardar(r);
    return r;
  },
  /** Datos para crear o cambiar una clave: sal nueva + prueba (la clave no viaja). */
  async datosClave(clave) { const salt = this.nuevaSal(); return { salt, iter: this.ITER, pruebaNueva: await this.derivar(clave, salt, this.ITER) }; },
  _abierto: false,
  _css() {
    if (document.getElementById('sesionCss')) return;
    const st = document.createElement('style'); st.id = 'sesionCss';
    /* v111: mismo lenguaje del diseño nuevo (vidrio, esquinas grandes, botón degradado). */
    st.textContent = '.ses-chip{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:60;background:var(--tinta);color:#fff;border:0;border-radius:var(--r-pill);padding:7px 12px;font:700 13px/1.2 inherit;font-family:inherit;box-shadow:0 6px 16px rgba(16,33,58,.25);max-width:46vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;}' +
      '.ses-chip.sin{background:#ff9d2e;color:#3a2a00;}' +
      /* v107: en el inicio el botón va dentro de la fila de botones del encabezado (no tapa Estado ni Ayuda) */
      '.hdr-acc .ses-chip{position:static;max-width:30vw;min-height:44px;border-radius:var(--r-xl);padding:0 14px;box-shadow:none;align-self:center;}' +
      '@media(max-width:520px){.hdr-acc .ses-chip{width:44px;min-height:44px;padding:0;font-size:var(--fs-display);}.hdr-acc .ses-chip .ses-nom{display:none;}}' +
      '.ses-fondo{position:fixed;inset:0;background:rgba(10,18,34,.5);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:20050;display:flex;align-items:flex-end;justify-content:center;}' +
      '.ses-caja{background:rgba(255,255,255,.96);color:var(--tinta);width:100%;max-width:440px;border-radius:30px 30px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(16,33,58,.25);max-height:92vh;overflow:auto;}' +
      '.ses-caja:before{content:"";display:block;width:44px;height:5px;border-radius:var(--r-xs);background:var(--line);margin:-8px auto 14px;}' +
      '@media(min-width:600px){.ses-fondo{align-items:center}.ses-caja{border-radius:var(--r-2xl)}.ses-caja:before{display:none}}' +
      '.ses-caja h3{margin:0 0 4px;font-size:var(--fs-subtitulo);font-weight:800;letter-spacing:-.02em}.ses-caja p{margin:0 0 12px;font-size:var(--fs-base);color:var(--pizarra-500);line-height:1.45;font-weight:500}' +
      '.ses-caja label{display:block;font-size:var(--fs-menor);font-weight:700;margin:12px 0 5px;color:var(--pizarra-500);text-transform:uppercase;letter-spacing:.05em}' +
      '.ses-caja input[type=text],.ses-caja input[type=password]{width:100%;box-sizing:border-box;border:1.5px solid transparent;background:var(--bg);border-radius:var(--r-l);padding:14px 16px;font-size:var(--fs-campo);font-weight:600;font-family:inherit;color:var(--tinta)}' +
      '.ses-caja input[type=text]:focus,.ses-caja input[type=password]:focus{outline:none;background:#fff;border-color:var(--azul);box-shadow:0 0 0 4px rgba(47,107,255,.15)}' +
      '.ses-caja .ses-check{display:flex;gap:10px;align-items:center;font-weight:600;font-size:var(--fs-base);color:var(--tinta);text-transform:none;letter-spacing:0}' +
      '.ses-caja .ses-check input{width:20px;height:20px;accent-color:var(--azul)}' +
      '.ses-caja button{width:100%;border:0;border-radius:var(--r-pill);padding:15px;font-size:var(--fs-titulo);font-weight:800;margin-top:10px;cursor:pointer;font-family:inherit;min-height:52px}' +
      '.ses-caja .ses-si{background:linear-gradient(135deg,var(--azul),var(--violeta));color:#fff;box-shadow:0 10px 24px rgba(47,107,255,.35)}.ses-caja .ses-no{background:var(--bg);color:var(--tinta)}' +
      '.ses-caja .ses-msg{min-height:18px;font-size:var(--fs-base);color:var(--rojo-500);margin-top:8px;font-weight:600}';
    document.head.appendChild(st);
  },
  _caja(html) {
    this._css();
    const f = document.createElement('div'); f.className = 'ses-fondo';
    f.innerHTML = '<div class="ses-caja" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(f);
    return { el: f.querySelector('.ses-caja'), cerrar: () => f.remove() };
  },
  /** Ventana para entrar. Se abre sola cuando el servidor pide usuario. */
  pedir(motivo) {
    if (this._abierto || typeof document === 'undefined' || !document.body || !SGSST.url()) return;
    this._abierto = true;
    const m = this._caja('<h3>Entrar al sistema de gestión</h3><p>' + esc(motivo || 'Cada cambio queda con el nombre de quien lo hizo. Entra con tu usuario y tu contraseña (te los da el área SST).') + '</p>' +
      '<label for="sesUsr">Usuario</label><input type="text" id="sesUsr" autocomplete="username" autocapitalize="none" spellcheck="false">' +
      '<label for="sesClave">Contraseña</label><input type="password" id="sesClave" autocomplete="current-password">' +
      '<label class="ses-check"><input type="checkbox" id="sesComp"> Equipo compartido (la sesión dura 12 horas)</label>' +
      '<button type="button" class="ses-si" id="sesEntrar">Entrar</button><button type="button" class="ses-no" id="sesNo">Ahora no</button><div class="ses-msg" id="sesMsg"></div>');
    const cerrar = () => { m.cerrar(); this._abierto = false; };
    const usr = m.el.querySelector('#sesUsr'), cl = m.el.querySelector('#sesClave'), msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesEntrar');
    try { usr.value = localStorage.getItem(Consola.clave('ssta-ultimo-usuario')) || ''; } catch (e) {}
    // Empresa demo: usuarios ficticios para probar cada rol con un toque.
    const demo = typeof EMPRESA !== 'undefined' && EMPRESA.demo && EMPRESA.demoUsuarios;
    if (demo) {
      const d = document.createElement('div');
      d.innerHTML = '<p style="margin:14px 0 6px;font-size:var(--fs-menor);font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Demo · entra como</p><div style="display:flex;flex-wrap:wrap;gap:8px;">' + EMPRESA.demoUsuarios.map((u, i) => '<button type="button" class="ses-no" data-demo="' + i + '" style="width:auto;margin:0;padding:9px 14px;min-height:40px;font-size:var(--fs-base);font-weight:700;">' + esc(u[2]) + '</button>').join('') + '</div>';
      m.el.querySelector('#sesMsg').insertAdjacentElement('beforebegin', d);
      d.addEventListener('click', (e) => { const x = e.target.closest('[data-demo]'); if (!x) return; const u = EMPRESA.demoUsuarios[+x.dataset.demo]; usr.value = u[0]; cl.value = u[1]; ir(); });
    }
    m.el.querySelector('#sesNo').addEventListener('click', cerrar);
    const ir = async () => {
      if (!usr.value.trim() || !cl.value) { msg.textContent = 'Escribe el usuario y la clave.'; return; }
      b.disabled = true; msg.textContent = 'Comprobando…';
      try {
        const r = await this.entrar(usr.value, cl.value, m.el.querySelector('#sesComp').checked);
        if (!r.ok) { msg.textContent = r.error || 'No se pudo entrar.'; b.disabled = false; return; }
        try { localStorage.setItem(Consola.clave('ssta-ultimo-usuario'), usr.value.trim().toLowerCase()); } catch (e) {}
        cerrar();
        if (r.yo && r.yo.debeCambiar) this.cambiarClave(true);
        else this._despues();
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    };
    b.addEventListener('click', ir);
    cl.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
    setTimeout(() => (usr.value ? cl : usr).focus(), 60);
  },
  /** Después de entrar: lo pendiente sale; la página se recarga si no hay nada a medio escribir. */
  _despues() {
    try { if (typeof Outbox !== 'undefined') Outbox.flush(); } catch (e) {}
    if (document.querySelector('.modal-fondo')) { if (typeof UI !== 'undefined') UI.toast('✓ Entraste como ' + this.nombre() + '. Vuelve a guardar.'); }
    else location.reload();
  },
  cambiarClave(obligatorio) {
    const m = this._caja('<h3>🔑 ' + (obligatorio ? 'Crea tu clave' : 'Cambiar mi clave') + '</h3><p>' + (obligatorio ? 'Entraste con una clave temporal. Escribe una tuya: mínimo 8 caracteres, con letras y números. Nadie más la conoce (ni el administrador).' : 'Mínimo 8 caracteres, con letras y números. Al cambiarla se cierran tus sesiones en los demás equipos.') + '</p>' +
      '<label for="sesAct">Clave actual' + (obligatorio ? ' (la temporal)' : '') + '</label><input type="password" id="sesAct" autocomplete="current-password">' +
      '<label for="sesN1">Clave nueva</label><input type="password" id="sesN1" autocomplete="new-password">' +
      '<label for="sesN2">Repite la clave nueva</label><input type="password" id="sesN2" autocomplete="new-password">' +
      '<button type="button" class="ses-si" id="sesOk">Guardar mi clave</button>' + (obligatorio ? '' : '<button type="button" class="ses-no" id="sesNo">Cancelar</button>') + '<div class="ses-msg" id="sesMsg"></div>');
    const v = (id) => m.el.querySelector(id).value, msg = m.el.querySelector('#sesMsg'), b = m.el.querySelector('#sesOk');
    const no = m.el.querySelector('#sesNo'); if (no) no.addEventListener('click', m.cerrar);
    b.addEventListener('click', async () => {
      if (this.claveDebil(v('#sesN1'))) { msg.textContent = 'La clave nueva necesita mínimo 8 caracteres, con letras y números.'; return; }
      if (v('#sesN1') !== v('#sesN2')) { msg.textContent = 'Las dos claves nuevas no coinciden.'; return; }
      b.disabled = true; msg.textContent = 'Guardando…';
      try {
        const yo = this.yo(); const s = await this._sal(yo.usuario);
        const r = await this._post(Object.assign({ action: 'cambiarMiClave', sesion: this.token(), prueba: await this.derivar(v('#sesAct'), s.salt, s.iter) }, await this.datosClave(v('#sesN1'))));
        if (!r.ok) { msg.textContent = r.error || 'No se pudo cambiar.'; b.disabled = false; return; }
        this._guardar(r); m.cerrar();
        if (obligatorio) this._despues(); else if (typeof UI !== 'undefined') UI.toast('✓ Clave cambiada.');
      } catch (e) { msg.textContent = 'Sin conexión con el servidor: ' + e.message; b.disabled = false; }
    });
  },
  menu() {
    const yo = this.yo();
    if (!yo) { this.pedir(); return; }
    const ROL = { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' };
    const m = this._caja('<h3>👤 ' + esc(yo.nombre) + '</h3><p>Usuario <b>' + esc(yo.usuario) + '</b> · ' + esc(ROL[yo.rol] || yo.rol) + (yo.cargo ? ' · ' + esc(yo.cargo) : '') + '</p>' +
      (yo.rol === 'admin' ? '<button type="button" class="ses-no" id="sesUsuarios">👥 Usuarios y respaldo</button>' : '') +
      '<button type="button" class="ses-no" id="sesCambiar">🔑 Cambiar mi clave</button>' +
      '<button type="button" class="ses-no" id="sesSalir">Salir de este equipo</button><button type="button" class="ses-si" id="sesCerrar">Listo</button>');
    m.el.querySelector('#sesCerrar').addEventListener('click', m.cerrar);
    const u = m.el.querySelector('#sesUsuarios'); if (u) u.addEventListener('click', () => { location.href = 'usuarios.html'; });
    m.el.querySelector('#sesCambiar').addEventListener('click', () => { m.cerrar(); this.cambiarClave(false); });
    m.el.querySelector('#sesSalir').addEventListener('click', () => { m.cerrar(); this.salirSeguro(); });
  },
  /** Botón 👤 arriba a la derecha (solo si el servidor usa usuarios o hay sesión). */
  pintarChip() {
    if (typeof document === 'undefined' || !document.body) return;
    if (document.body.classList.contains('consola')) return;   // la consola muestra quién entró en su encabezado
    let c = document.getElementById('sesChip');
    const yo = this.yo();
    if (!yo && !this.modo()) { if (c) c.remove(); return; }
    this._css();
    if (!c) { c = document.createElement('button'); c.type = 'button'; c.id = 'sesChip'; c.addEventListener('click', () => this.menu()); const acc = document.querySelector('.hdr-acc'); if (acc) acc.insertBefore(c, acc.firstChild); else document.body.appendChild(c); }
    c.className = 'ses-chip' + (yo ? '' : ' sin');
    c.innerHTML = '<span aria-hidden="true">👤</span><span class="ses-nom"> ' + esc(yo ? String(yo.nombre || yo.usuario).split(' ')[0] : 'Entrar') + '</span>';
    c.setAttribute('aria-label', yo ? 'Sesión de ' + yo.nombre : 'Entrar con mi usuario');
  },
  montarChip() {
    if (typeof document === 'undefined') return;
    if (document.body) this.pintarChip(); else document.addEventListener('DOMContentLoaded', () => this.pintarChip());
  }
};

