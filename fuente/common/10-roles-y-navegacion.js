/* ================= SISTEMA DE GESTIÓN POR ROL (v106) =================
   Lo de campo (permisos, ATS, charlas, preoperacionales, reportar) lo abre
   cualquiera. Los módulos del sistema de gestión, cuando el servidor usa
   usuarios, piden entrar y muestran solo lo que el rol permite (la tabla está
   en empresa.js: Empresa.accesoRol). Los datos sensibles los sigue cuidando
   el servidor (salud solo para Administrador y SST, quejas cifradas). */
const AccesoRol = {
  ROLES: { admin: 'Administrador', sst: 'SST', supervisor: 'Supervisor / campo', comite: 'Integrante de comité', consulta: 'Solo consulta' },
  modulo() {
    if (typeof Empresa === 'undefined' || !Empresa.moduloDeHref) return null;
    return Empresa.moduloDeHref(location.pathname.split('/').pop() || 'index.html');
  },
  /** null = puede entrar; 'entrar' = falta su usuario; 'rol' = su rol no tiene acceso. */
  revisar() {
    const m = this.modulo();
    if (!m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || !Sesion.modo()) return null;
    // v148: el participante que llega con el enlace de firma de un ATS no necesita usuario (solo se agrega a ese ATS).
    if (/ats\.html$/.test(location.pathname) && /[?&]agregar=1/.test(location.search) && /[?&]k=[\w-]{10,}/.test(location.search)) return null;
    const yo = Sesion.yo();
    if (!yo) return 'entrar';
    return Empresa.accesoRol(m, yo.rol) ? null : 'rol';
  },
  vigilar() {
    const r = this.revisar();
    if (!r) { this._preguntar(); return; }
    if (document.getElementById('accesoRol')) return;
    const yo = Sesion.yo(), d = document.createElement('div');
    d.id = 'accesoRol'; d.className = 'acceso-rol';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'arTit');
    d.innerHTML = '<div class="ar-caja"><span class="ar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<div class="ar-sup">Sistema de gestión</div>' +
      (r === 'entrar'
        ? '<h2 id="arTit">Entra con tu usuario</h2><p>Esta parte del portal pide usuario y contraseña. Sin usuario solo se hacen los <b>preoperacionales</b> y los <b>reportes</b>.</p>' +
          '<button type="button" id="arEntrar" class="ar-si">Entrar</button>'
        : '<h2 id="arTit">Tu usuario no tiene acceso aquí</h2><p>Entraste como <b>' + esc(yo.nombre) + '</b> (' + esc(this.ROLES[yo.rol] || yo.rol) + '). Si necesitas este módulo, pídeselo al administrador del portal.</p>') +
      '<a href="index.html" class="ar-no">Volver al inicio</a></div>';
    // v143: lo de atrás queda inerte (ni el teclado ni el lector de pantalla llegan a él) y el foco va a la ventana
    const inertes = [...document.body.children].filter((x) => x !== d && !x.inert && !/^(SCRIPT|STYLE)$/.test(x.tagName));
    inertes.forEach((x) => { x.inert = true; });
    document.body.appendChild(d);
    const b = document.getElementById('arEntrar');
    if (b) b.addEventListener('click', () => Sesion.pedir('Entra con tu usuario para abrir este módulo del sistema de gestión.'));
    setTimeout(() => { try { (b || d.querySelector('a')).focus(); } catch (e) {} }, 50);
    // Al entrar con un rol que sí lo ve, se quita el aviso sin recargar.
    if (!this._esperando) { this._esperando = true; const t = setInterval(() => { if (!this.revisar()) { clearInterval(t); this._esperando = false; const x = document.getElementById('accesoRol'); if (x) { x.remove(); inertes.forEach((y) => { y.inert = false; }); } } }, 800); }
  },
  /** v111: en un celular que nunca habló con el servidor no se sabe si hay usuarios.
   *  Si la página es del sistema de gestión, se pregunta (sin clave ni sesión) y se vuelve a revisar. */
  _preguntar() {
    const m = this.modulo();
    if (this._pregunto || !m || Empresa.esPublico(m) || typeof Sesion === 'undefined' || Sesion.modo() || Sesion.yo()) return;
    if (typeof SGSST === 'undefined' || !SGSST.url() || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    this._pregunto = true;
    fetchWithRetry(SGSST.url() + '?action=ping&token=' + encodeURIComponent(SGSST.token())).then((res) => res.json()).then((j) => {
      if (j && j.ok) { Sesion.marcar(j); this.vigilar(); }
    }).catch(() => {});
  }
};
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AccesoRol.vigilar()); else AccesoRol.vigilar();
}

/* v151 · Guardar más rápido: el servidor de Google «se duerme» y la primera petición tarda 2–5 s en
   despertarlo. Apenas la persona empieza a llenar un formulario se le manda un ping, así cuando pulsa
   «Guardar» el servidor ya está despierto. Máximo un ping cada 4 minutos por equipo. */
if (typeof document !== 'undefined') {
  const despertar = () => {
    try {
      if (typeof SGSST === 'undefined' || !SGSST.url() || navigator.onLine === false) return;
      const k = 'ssta-despierto', ahora = Date.now(), ult = Number(sessionStorage.getItem(k) || 0);
      if (ahora - ult < 240000) return;
      sessionStorage.setItem(k, String(ahora));
      fetch(SGSST.url() + '?action=ping&token=' + encodeURIComponent(SGSST.token())).catch(() => {});
    } catch (e) {}
  };
  document.addEventListener('input', despertar, { passive: true });
  document.addEventListener('pointerdown', (ev) => { if (ev.target && ev.target.closest && ev.target.closest('canvas, .pad, [data-c], .chips button')) despertar(); }, { passive: true });
}

/* ================= SUBIR ARRIBA (v107) =================
   En las páginas largas (plan anual, matriz, PESV…) aparece abajo a la
   izquierda un botón para volver al inicio de la página de un toque. */
(function () {
  if (typeof document === 'undefined') return;
  const montar = () => {
    if (document.getElementById('subirArriba')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'subirArriba'; b.className = 'subir-arriba'; b.hidden = true;
    b.setAttribute('aria-label', 'Subir al inicio de la página'); b.title = 'Subir';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 5l-7 7m7-7l7 7M12 5v14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    b.addEventListener('click', () => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } });
    document.body.appendChild(b);
    const barra = document.querySelector('.footer-actions');
    if (barra && getComputedStyle(barra).position === 'fixed') b.classList.add('con-barra');
    // v109: solo aparece cuando la persona SUBE la página con el dedo (intención de volver
    // arriba) y se esconde al bajar, a los 2,5 s sin moverse o al tocar un campo. Así no
    // queda encima de las opciones (Sí / No / N.A.) ni se toca sin querer al marcar algo.
    let t = 0, yAnt = window.scrollY || 0, subida = 0, esconder = 0;
    const ocultar = () => { b.hidden = true; subida = 0; };
    const ver = () => {
      t = 0; const y = window.scrollY || document.documentElement.scrollTop, dy = y - yAnt; yAnt = y;
      if (y < 900 || dy > 0) { subida = 0; b.hidden = true; return; }
      subida += -dy; if (subida > 160) b.hidden = false;
      clearTimeout(esconder); esconder = setTimeout(ocultar, 2500);
    };
    window.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(ver); }, { passive: true });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#subirArriba')) ocultar(); }, { passive: true, capture: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();


/* ================= ICONOS Y SEÑALES (v112) =================
   Iconos de línea (en lugar de emojis) y señales ISO 7010 para cada tipo de
   permiso, el ATS y lo demás de la obra. Iconos.senal('alturas') devuelve el HTML. */
const Iconos = (function () {
  const P = {
    llama: 'M12 3c.8 3 4.2 4.6 4.2 8.3a4.2 4.2 0 0 1-8.4 0c0-1.6.6-2.7 1.6-3.7.2 1.2.9 1.8 1.6 1.9C11 8 11.6 5.6 12 3z',
    escalera: 'M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8',
    tanque: 'M6 6c0-1.7 2.7-3 6-3s6 1.3 6 3v12c0 1.7-2.7 3-6 3s-6-1.3-6-3zM6 6c0 1.7 2.7 3 6 3s6-1.3 6-3M10 13h4',
    grua: 'M4 21h16M7 21V7M7 7h12M19 7v6M17 13h4M7 11l5-4',
    rayo: 'M13 3L5 13h6l-1 8 8-10h-6z',
    brujula: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    escudo: 'M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM9 12l2 2 4-4',
    personas: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.3M15.5 5.2a3.5 3.5 0 0 1 0 6.6',
    mas: 'M12 5v14M5 12h14',
    repetir: 'M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4',
    candado: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
    cerrar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 4.5-5',
    lista: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    carpeta: 'M3 6h6l2 2h10v11H3z',
    reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    alerta: 'M12 4l9 16H3zM12 10v4M12 17.3v.01',
    flecha: 'M9 6l6 6-6 6'
  };
  // Tipo → [icono, forma ISO]. tri = advertencia, circ = obligación, cuad = seguridad.
  const TIPO = { caliente: ['llama', 'tri'], alturas: ['escalera', 'circ'], confinados: ['tanque', 'tri'], izajes: ['grua', 'tri'], electrico: ['rayo', 'tri'],
    ats: ['brujula', 'cuad'], epp: ['escudo', 'circ'], personal: ['personas', 'violeta'], asistencia: ['personas', 'circ'],
    cerrar: ['cerrar', 'cuad'], agregar: ['personas', 'violeta'], tablero: ['lista', 'circ'], repetir: ['repetir', 'naranja'] };
  const svg = (n) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (P[n] || P.alerta) + '"/></svg>';
  /** Clave del tipo a partir de un nombre o archivo: 'Trabajo en Alturas', 'permiso-trabajo-alturas.html'… */
  function tipoDe(x) {
    const s = String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/calient/.test(s)) return 'caliente'; if (/altur/.test(s)) return 'alturas'; if (/confin/.test(s)) return 'confinados';
    if (/izaj/.test(s)) return 'izajes'; if (/electr/.test(s)) return 'electrico'; if (/\bats\b|ats\.html|analisis de trabajo/.test(s)) return 'ats';
    if (/epp/.test(s)) return 'epp'; if (/personal/.test(s)) return 'personal'; if (/asist|charla/.test(s)) return 'asistencia';
    return '';
  }
  function senal(tipo, tam) {
    const t = TIPO[tipoDe(tipo) || tipo] || ['alerta', 'tri'];
    return '<span class="sg-iso ' + t[1] + (tam ? ' ' + tam : '') + '" aria-hidden="true">' + svg(t[0]) + '</span>';
  }
  // Las pantallas marcan dónde va una señal con data-senal="alturas" (antes había un emoji).
  function pintar(raiz) { (raiz || document).querySelectorAll('[data-senal]:empty').forEach((el) => { el.innerHTML = senal(el.dataset.senal, 'grande'); }); }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => pintar()); else pintar(); }
  return { svg, senal, tipoDe, pintar, P };
})();


/* ================= BARRA INFERIOR (v112) =================
   Barra flotante de vidrio con Inicio · Permisos · Gestión · Ayuda, para quien
   entró con su usuario (sin usuario solo hay preoperacional y reportes: no la
   necesita). No sale en las pantallas que ya tienen abajo su propia barra
   (Guardar, Enviar…), para no tapar nada, ni al imprimir. */
const BarraInferior = (function () {
  if (typeof document === 'undefined') return null;
  if (Consola.activa()) return null;   // v115: la consola del administrador no lleva la barra de los clientes
  const ITEMS = [
    { id: 'inicio', href: 'index.html', txt: 'Inicio', d: 'M4 11l8-7 8 7M6 10v10h12V10' },
    { id: 'permisos', href: 'dashboard.html', txt: 'Permisos', d: 'M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 14l2 2 4-4' },
    { id: 'gestion', href: 'index.html#sg', txt: 'Gestión', d: 'M5 20V10M12 20V4M19 20v-7' },
    { id: 'ayuda', href: 'ayuda.html', txt: 'Ayuda', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17v.01' }
  ];
  const pagina = () => (location.pathname.split('/').pop() || 'index.html');
  function activo() {
    const p = pagina();
    if (p === 'dashboard.html' || /^permiso-/.test(p)) return 'permisos';
    if (p === 'ayuda.html') return 'ayuda';
    if (p === 'index.html') return location.hash === '#sg' ? 'gestion' : 'inicio';
    return 'gestion';
  }
  function hayOtraBarra(nav) {
    // Algo fijo abajo (barra de guardar, cola de pendientes, aviso…) que la barra taparía.
    const vistos = document.querySelectorAll('.footer-actions, .barra-guardar, #pendingNav.show, .fixed-bottom, .acciones-fijas, [data-barra-abajo]');
    for (const el of vistos) { if (el === nav || nav.contains(el)) continue; const cs = getComputedStyle(el); if ((cs.position === 'fixed' || cs.position === 'sticky') && cs.display !== 'none' && el.getBoundingClientRect().height > 20 && el.getBoundingClientRect().top < innerHeight) return true; }
    return false;
  }
  let nav = null;
  function montar() {
    if (nav || document.getElementById('barraInferior')) return;
    const yo = typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo();
    if (!yo || !document.body || document.body.dataset.sinBarra !== undefined) return;
    nav = document.createElement('nav');
    nav.id = 'barraInferior'; nav.className = 'barra-inferior'; nav.setAttribute('aria-label', 'Navegación principal');
    const a = activo();
    // v123: sin permisos de trabajo contratados, la barra no los muestra.
    const hayPermisos = typeof Empresa === 'undefined' || !Empresa.moduloActivo || ['caliente', 'alturas', 'confinados', 'izajes', 'electrico'].some((m) => Empresa.moduloActivo(m));
    nav.innerHTML = ITEMS.filter((x) => x.id !== 'permisos' || hayPermisos).map((x) => '<a href="' + x.href + '" data-id="' + x.id + '" aria-label="' + x.txt + '"' + (x.id === a ? ' class="on" aria-current="page"' : '') + '><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + x.d + '"/></svg><span>' + x.txt + '</span></a>').join('');
    document.body.appendChild(nav);
    // En el inicio, «Gestión» lleva al sistema de gestión sin recargar.
    nav.querySelector('[data-id="gestion"]').addEventListener('click', (e) => {
      const sg = pagina() === 'index.html' && document.getElementById('sg');
      if (sg) { e.preventDefault(); if (location.hash !== '#sg') location.hash = 'sg'; marcar('gestion'); }   // v117: el inicio cambia a la vista del sistema de gestión
    });
    nav.querySelector('[data-id="inicio"]').addEventListener('click', (e) => {
      if (pagina() === 'index.html') { e.preventDefault(); history.replaceState(null, '', location.pathname); window.scrollTo({ top: 0, behavior: 'smooth' }); marcar('inicio'); }
    });
    const revisar = () => { const otra = hayOtraBarra(nav); nav.hidden = otra; document.body.classList.toggle('con-barra-inferior', !otra); };
    revisar(); setInterval(revisar, 1200);
  }
  function marcar(id) { if (!nav) return; nav.querySelectorAll('a').forEach((x) => { const on = x.dataset.id === id; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else setTimeout(montar, 0);
  return { montar, marcar };
})();

/* v156 · El botón «← Atrás» de cada módulo (enlace a index.html) vuelve a donde estabas: si llegaste desde el
   portal, regresa a esa misma página (Gestión, con la categoría abierta y en el mismo punto); si entraste
   directo (enlace, QR, acceso del celular), va a Gestión cuando hay sesión o al inicio cuando no. */
if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.back[href="index.html"], a.back[href="./index.html"]');
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  let deIndex = false;
  try { const r = document.referrer ? new URL(document.referrer) : null; deIndex = !!r && r.origin === location.origin && /\/(index\.html)?$/.test(r.pathname); } catch (x) {}
  // Pantallas internas: volver primero a la primera vista del módulo.
  const act = document.querySelector('.screen.active'), ini = document.querySelector('.screen');
  if (act && ini && act !== ini) { const v = act.querySelector('[data-volver]'); if (v && v !== a) { v.click(); return; } }
  if (deIndex && history.length > 1) { history.back(); return; }
  let conSesion = false; try { conSesion = typeof Sesion !== 'undefined' && !!Sesion.yo(); } catch (x) {}
  location.href = 'index.html' + (conSesion ? '#sg' : '');
}, true);

/* ================= «ATRÁS» VUELVE A DONDE ESTABAS (v123) =================
   Muchas pantallas tienen varias vistas dentro de la misma página (lista → formulario
   → detalle) y ventanas. El botón «atrás» del celular sacaba de la página y llevaba al
   inicio. Ahora cada vista y cada ventana deja su paso en el historial: «atrás» cierra
   la ventana o vuelve a la vista anterior, y solo al final sale de la página. */
const NavAtras = (function () {
  if (typeof window === 'undefined' || typeof history === 'undefined' || typeof document === 'undefined') return null;
  let ignorar = 0, modalesEmpujados = 0;
  const activa = () => document.querySelector('.screen.active');
  const primera = () => document.querySelector('.screen');
  const firmaAbierta = () => { try { return typeof FirmaCompleta !== 'undefined' && FirmaCompleta.estaAbierta(); } catch (e) { return false; } };
  function atrasSilencioso() { ignorar++; history.back(); }
  function alCambiarPantalla() {
    const a = activa(), ini = primera(); if (!a || !ini) return;
    const st = history.state || {};
    if (a === ini) { if (st.__p) atrasSilencioso(); return; }   // volvió con su propio botón: se quita el paso que sobraba
    if (st.__p !== a.id) history.pushState({ __p: a.id }, '');
  }
  function iniciar() {
    const pantallas = document.querySelectorAll('.screen');
    if (pantallas.length > 1) {
      const obs = new MutationObserver(() => setTimeout(alCambiarPantalla, 0));
      pantallas.forEach((s) => obs.observe(s, { attributes: true, attributeFilter: ['class'] }));
    }
    // Ventanas (UI.modal): «atrás» las cierra.
    new MutationObserver((ms) => ms.forEach((m) => {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo')) {
        modalesEmpujados++;
        // Una ventana que reemplaza a otra recién cerrada reutiliza su paso (no se apilan).
        if (history.state && history.state.__m && document.querySelectorAll('body > .modal-fondo').length === 1) history.replaceState(Object.assign({}, history.state, { __m: modalesEmpujados }), '');
        else history.pushState(Object.assign({}, history.state || {}, { __m: modalesEmpujados }), '');
      } });
      m.removedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains('modal-fondo') && n.__porAtras !== true) setTimeout(() => {
        if (!document.querySelector('body > .modal-fondo') && history.state && history.state.__m) atrasSilencioso();
      }, 60); });
    })).observe(document.body, { childList: true });
  }
  window.addEventListener('popstate', (e) => {
    if (ignorar) { ignorar--; return; }
    if (firmaAbierta()) return;
    const fondos = document.querySelectorAll('body > .modal-fondo');
    if (fondos.length) { const f = fondos[fondos.length - 1]; f.__porAtras = true; const c = f.querySelector('[data-cerrar]'); if (c) c.click(); else f.remove(); return; }
    const a = activa(), ini = primera(); if (!a || !ini || a === ini) return;
    const st = e.state || {};
    if (st.__p === a.id) return;
    const destino = st.__p && document.getElementById(st.__p);
    if (destino && destino.classList.contains('screen')) { a.classList.remove('active'); destino.classList.add('active'); window.scrollTo(0, 0); return; }
    // A la primera vista: con su botón «volver» (recarga la lista) o, si no tiene, directo.
    const v = a.querySelector('[data-volver]');
    if (v) v.click(); else { a.classList.remove('active'); ini.classList.add('active'); window.scrollTo(0, 0); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { activa };
})();

