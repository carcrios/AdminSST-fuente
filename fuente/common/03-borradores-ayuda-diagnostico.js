/* ================= AVISO: SIN BASE DE PERSONAL =================
   Antes era un recuadro rojo flotante abajo a la izquierda que tapaba
   botones y el contador de "preguntas sin responder". Ahora es una franja
   delgada arriba de la página, con "¿Por qué?" y una ✕ para cerrarla (queda
   cerrada mientras no se cierre la pestaña). Lo usan el ATS y los permisos. */
const AvisoPersonal = {
  CLAVE: 'ssta-aviso-personal-cerrado',
  mostrar(motivo, reintentar) {
    let cerrado = false;
    try { cerrado = sessionStorage.getItem(this.CLAVE) === '1'; } catch (e) {}
    let el = document.getElementById('avisoPersonal');
    if (cerrado) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'avisoPersonal';
      el.className = 'aviso-personal';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="txt"></span><button type="button" class="por-que">¿Por qué?</button><button type="button" class="cerrar" aria-label="Cerrar aviso">✕</button>';
      document.body.insertBefore(el, document.body.firstChild);
      el.querySelector('.cerrar').addEventListener('click', () => {
        try { sessionStorage.setItem(this.CLAVE, '1'); } catch (e) {}
        el.remove();
      });
    }
    el.querySelector('.txt').textContent = '⚠️ Sin base de personal: escribe nombres y cédulas a mano, no se pierde nada.';
    const pq = el.querySelector('.por-que');
    pq.onclick = async () => {
      await Dialogo.avisar('Búsqueda de personal no disponible\n\n' + (motivo || 'No se pudo cargar la base de personal.') + '\n\nPuedes seguir escribiendo nombres y cédulas a mano; no se pierde nada.\n\nSe va a reintentar ahora.');
      el.querySelector('.txt').textContent = '⏳ Reintentando…';
      if (reintentar) reintentar();
    };
  },
  ocultar() { const el = document.getElementById('avisoPersonal'); if (el) el.remove(); }
};

/**
 * DraftStore: guarda/recupera un borrador del formulario en localStorage
 * para que no se pierda el trabajo si se cierra la pestaña, se va la señal
 * o el celular bloquea la página a medio llenar.
 */
const DraftStore = {
  _avisoMostrado: false,
  save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: new Date().toISOString() }));
      return true;
    } catch (e) {
      // El guardado automático del borrador falló (cuota de almacenamiento
      // llena por firmas en base64, modo privado de Safari, etc.). Antes esto
      // se ignoraba en silencio: el usuario creía tener un respaldo local que
      // en realidad no existe. Se avisa una sola vez por sesión — no en cada
      // tecla, ya que save() se llama muy seguido mientras se escribe.
      if (!this._avisoMostrado) {
        this._avisoMostrado = true;
        console.error('DraftStore.save falló:', e);
        window.dispatchEvent(new CustomEvent('draft-guardado-fallido', { detail: { error: e } }));
      }
      return false;
    }
  },
  load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* no-op */ }
  }
};

// Aviso visible si el borrador automático deja de poder guardarse — se activa
// solo (no necesita que cada página lo llame), ya que common.js está en todas.
window.addEventListener('draft-guardado-fallido', () => {
  if (document.getElementById('draftFailBanner')) return;
  const el = document.createElement('div');
  el.id = 'draftFailBanner';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;background:var(--rojo-700);color:#fff;font-weight:600;font-size:var(--fs-base);padding:10px 14px;border-radius:var(--r-s);box-shadow:0 2px 10px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:space-between;gap:10px;';
  el.innerHTML = '<span>⚠️ El respaldo automático de este formulario no se está guardando en este dispositivo (memoria llena o modo privado). Si cierras la página sin guardar, podrías perder lo escrito — guarda cuanto antes.</span>';
  const btn = document.createElement('button');
  btn.textContent = '✕';
  btn.style.cssText = 'background:none;border:none;color:#fff;font-size:var(--fs-campo);cursor:pointer;flex-shrink:0;';
  btn.addEventListener('click', () => el.remove());
  el.appendChild(btn);
  document.body.appendChild(el);
});

/** debounce: evita guardar en cada tecla; agrupa cambios rápidos en uno solo. */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Formatea una fecha ISO a texto legible en español. */
function formatSavedAt(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

/**
 * OfflineBanner: muestra/oculta un aviso fijo cuando el navegador detecta
 * que no hay conexión, para que en zonas de planta con señal débil quede
 * claro que lo que se ve puede ser una copia guardada (caché) y no la
 * versión más reciente. No interfiere con el borrador local: ese sigue
 * guardando normalmente sin conexión.
 */
/**
 * UpdateManager: detecta cuando hay una versión nueva del portal ya
 * descargada (Service Worker "esperando") y muestra un banner para que
 * el usuario decida cuándo actualizar — nunca se recarga la página solo,
 * para no perder un permiso a medio llenar.
 * Requiere sw.js v2 (que no hace skipWaiting automático).
 */
/* Versión del portal (sitio). El panel del asesor la compara con la del servidor de cada cliente. */
const VERSION_PORTAL_WEB = 'v179';
/* v162 · Ayuda corta: en los formularios largos (instalación), un párrafo de ayuda muy largo muestra solo su
   primera frase y el resto queda tras «¿Qué es esto?». Así el primer campo no se va fuera de la pantalla. */
const AyudaCorta = {
  revisar(raiz) {
    (raiz || document).querySelectorAll('.card p.ayuda:not([data-corta]), .card div.ayuda:not([data-corta]), .card .sub:not([data-corta])').forEach((el) => {
      el.dataset.corta = '1';
      const txt = el.textContent.replace(/\s+/g, ' ').trim();
      if (txt.length < 170 || el.querySelector('a, button, input, select, textarea, ol, ul, img, canvas')) return;
      const m = /^(.{40,180}?[.:;])\s/.exec(txt); if (!m) return;
      const html = el.innerHTML, corte = m[1].length;
      // Se parte el texto (no el HTML) para no romper etiquetas: la primera frase en texto plano y el resto completo al abrir.
      el.innerHTML = ''; const a = document.createElement('span'); a.textContent = m[1] + ' ';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ayuda-mas'; b.textContent = '¿Qué es esto?'; b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', () => { el.innerHTML = html; el.dataset.abierta = '1'; });
      el.appendChild(a); el.appendChild(b); el.title = txt.slice(corte).trim().slice(0, 300);
    });
  }
};
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', () => { if (document.body && document.body.hasAttribute('data-ayuda-corta')) { AyudaCorta.revisar(); setTimeout(() => AyudaCorta.revisar(), 1500); } });
/* v162 · Etiqueta que no desaparece: un campo cuyo único rótulo es el placeholder muestra ese texto como
   etiqueta pequeña arriba en cuanto se escribe (y lo anuncia a los lectores de pantalla). */
if (typeof document !== 'undefined') document.addEventListener('input', (e) => {
  const i = e.target; if (!i || !i.matches || !i.matches('input[placeholder]:not([type="search"]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea[placeholder]')) return;
  const ph = i.getAttribute('placeholder') || ''; if (ph.length < 4 || /^ej\.?[: ]/i.test(ph)) return;
  if ((i.labels && i.labels.length) || i.closest('label') || i.getAttribute('aria-labelledby') || (i.closest('.field') && i.closest('.field').querySelector('label'))) return;
  if (!i.getAttribute('aria-label')) i.setAttribute('aria-label', ph);
  let s = i.previousElementSibling; const tiene = s && s.classList && s.classList.contains('etq-flot');
  if (i.value && !tiene) { s = document.createElement('span'); s.className = 'etq-flot'; s.textContent = ph; s.setAttribute('aria-hidden', 'true'); i.insertAdjacentElement('beforebegin', s); }
  else if (!i.value && tiene) s.remove();
});
/* v162 · Búsqueda global (Ctrl/Cmd + K o «/»): módulos del portal y registros del SG-SST (los que tu usuario puede
   ver), con el lugar donde abrir cada uno. «permiso de Juan», «extintores vencidos», «SSTA-F-116»… */
const BuscarTodo = {
  PAGINAS: [['Reportes e investigación', 'reportes.html'], ['Investigación de accidentes', 'reportes.html?tab=investigaciones'], ['Plan de acción', 'plan-accion.html'], ['Inspecciones e inventario', 'inspecciones.html'],
    ['Personal habilitado', 'habilitacion.html'], ['Ficha del trabajador', 'persona.html'], ['Ficha del equipo', 'equipo.html'], ['Ficha de área o contratista', 'ficha.html'], ['Matriz de peligros', 'peligros.html'],
    ['Plan anual', 'plan-anual.html'], ['Indicadores', 'indicadores.html'], ['Cierre del mes', 'cierre-mes.html'], ['Evidencias 0312', 'evidencias.html'], ['Análisis y alertas', 'analitica.html'], ['Bitácora', 'bitacora.html'],
    ['Entrega de EPP', 'entrega-epp.html'], ['Dotación', 'dotacion.html'], ['Inducción', 'induccion.html'], ['Contratistas', 'contratistas.html'], ['Emergencias', 'emergencias.html'], ['COPASST', 'copasst.html'],
    ['Convivencia', 'convivencia.html'], ['Químicos', 'quimicos.html'], ['Salud', 'salud.html'], ['Vigilancia epidemiológica (PVE)', 'pve.html'], ['Documentos', 'documental.html'], ['Normograma', 'normograma.html'], ['Charlas', 'asistencia.html'], ['ATS', 'ats.html'],
    ['Permiso de alturas', 'permiso-trabajo-alturas.html'], ['Permiso en caliente', 'permiso-trabajo-caliente.html'], ['Espacios confinados', 'permiso-espacios-confinados.html'], ['Preoperacional', 'preoperacional.html'],
    ['Datos personales (Ley 1581)', 'habeas.html'], ['Tus avisos por correo', 'mis-avisos.html'], ['Usuarios', 'usuarios.html'], ['Ayuda', 'ayuda.html']],
  NOMBRE: { reporte: 'Reporte', accion: 'Acción', inspeccion: 'Inspección', equipo: 'Equipo', trabajador: 'Persona', induccion: 'Inducción', peligro: 'Peligro', documento: 'Documento', contratista: 'Contratista', entrega: 'Entrega EPP', reunion: 'Acta', comite: 'Comité', plananual: 'Plan anual', legal: 'Norma' },
  abrir() {
    if (document.getElementById('buscarTodo')) return;
    const n = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const f = document.createElement('div'); f.id = 'buscarTodo'; f.className = 'bt-fondo'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', 'Buscar en todo el portal');
    f.innerHTML = '<div class="bt-caja"><input type="search" id="btInput" placeholder="Buscar módulos, personas, permisos, acciones, códigos…" autocomplete="off" data-no-ac aria-label="Buscar en todo el portal"><div id="btRes" role="listbox"></div><div class="bt-pie">Enter abre · Esc cierra · Ctrl+K desde cualquier página</div></div>';
    document.body.appendChild(f);
    const i = f.querySelector('#btInput'), res = f.querySelector('#btRes'); let t = null, sel = 0, items = [];
    const cerrar = () => f.remove();
    const pintar = () => { res.innerHTML = items.length ? items.map((x, k) => '<a href="' + x.href.replace(/"/g, '&quot;') + '" role="option" class="bt-it' + (k === sel ? ' on' : '') + '"><b></b><small></small></a>').join('') : '<div class="bt-vacio">' + (i.value.trim().length < 2 ? 'Escribe al menos 2 letras' : 'Sin resultados') + '</div>';
      [...res.querySelectorAll('.bt-it')].forEach((a, k) => { a.querySelector('b').textContent = items[k].t; a.querySelector('small').textContent = items[k].m; }); };
    const buscar = async () => {
      const q = i.value.trim(); sel = 0;
      items = q.length < 2 ? [] : this.PAGINAS.filter(([nom]) => n(nom).includes(n(q))).slice(0, 6).map(([nom, href]) => ({ t: nom, m: 'Módulo', href }));
      pintar();
      if (q.length < 3 || typeof SGSST === 'undefined' || !SGSST.url() || (Sesion.modo && Sesion.modo() && !Sesion.yo())) return;
      try { const r = await SGSST.consultar({ action: 'buscar', q }); if (i.value.trim() !== q || !r.ok) return;
        items = items.concat((r.rows || []).map((x) => ({ t: x.titulo || x.id, m: (this.NOMBRE[x.tipo] || x.tipo) + ' · ' + x.id + (x.fecha ? ' · ' + Festivos.corta(x.fecha) : '') + (x.estado ? ' · ' + x.estado : ''), href: (x.modulo || 'index.html').replace(/#.*$/, '') + '#' + encodeURIComponent(x.id) }))); pintar(); } catch (e) {}
    };
    i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 250); });
    i.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); pintar(); e.preventDefault(); } else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); pintar(); e.preventDefault(); } else if (e.key === 'Enter' && items[sel]) location.href = items[sel].href; else if (e.key === 'Escape') cerrar(); });
    f.addEventListener('click', (e) => { if (e.target === f) cerrar(); });
    i.focus(); pintar();
  }
};
if (typeof document !== 'undefined') document.addEventListener('keydown', (e) => {
  const tecleando = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
  if (((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) || (e.key === '/' && !tecleando)) { e.preventDefault(); BuscarTodo.abrir(); }
});
/* v162 · Diagnóstico para soporte: lo que sirve para entender un error sin ir y volver por WhatsApp. */
const Diagnostico = {
  _ultimo: '', _hora: '',
  anotar(msg) { this._ultimo = String(msg || '').slice(0, 400); this._hora = new Date().toLocaleString('es-CO'); },
  async texto() {
    let cola = '—'; try { cola = String(await Outbox.count()); } catch (e) {}
    const yo = (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || null;
    return ['Diagnóstico del Portal SSTA — ' + new Date().toLocaleString('es-CO'),
      'Versión: ' + VERSION_PORTAL_WEB, 'Empresa: ' + ((typeof EMPRESA !== 'undefined' && (EMPRESA.nombreCorto || EMPRESA.nombre)) || '—'),
      'Página: ' + location.pathname.split('/').pop() + location.hash, 'Señal: ' + (navigator.onLine ? 'con internet' : 'sin internet'),
      'Pendientes por enviar: ' + cola, 'Usuario: ' + (yo ? (yo.usuario || yo.nombre) + ' (' + (yo.rol || '') + ')' : 'sin usuario'),
      'Último error' + (this._hora ? ' (' + this._hora + ')' : '') + ': ' + (this._ultimo || '—'), 'Equipo: ' + navigator.userAgent].join('\n');
  },
  async copiar() { const t = await this.texto(); try { await navigator.clipboard.writeText(t); return true; } catch (e) { try { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (x) { return false; } } }
};
// v162 · Política de seguridad (CSP en cada página): si algo la viola, queda en el diagnóstico y en la consola.
if (typeof document !== 'undefined') document.addEventListener('securitypolicyviolation', (e) => { try { const t = 'CSP bloqueó ' + (e.blockedURI || 'inline') + ' (' + e.violatedDirective + ')'; Diagnostico.anotar(t); (window.__cspViolaciones = window.__cspViolaciones || []).push(t); console.warn(t); } catch (x) {} });
if (typeof window !== 'undefined') window.addEventListener('error', (e) => { try { Diagnostico.anotar((e.message || 'Error') + (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : '')); } catch (x) {} });

