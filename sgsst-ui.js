/* ============================================================
   sgsst-ui.js — Piezas comunes de las pantallas del SG-SST
   (habilitación, reportes, plan de acción, indicadores, inspecciones,
   comités y auditorías):
   avisos, ventanas, fotos comprimidas, firmas, buscador de personas,
   hoja para PDF con el encabezado de la empresa y el plan de acción
   compartido (crear una acción desde cualquier módulo).
   ============================================================ */
const UI = (function () {
  const $ = (id) => document.getElementById(id);

  function toast(msg, tipo) {
    const t = document.createElement('div');
    t.className = 'toast' + (tipo ? ' ' + tipo : '');
    t.textContent = msg; document.body.appendChild(t);
    // v162: en un error, «Copiar diagnóstico» (versión, empresa, página, señal, cola y el error) para mandarlo a soporte.
    if (tipo === 'mal' && typeof Diagnostico !== 'undefined') {
      Diagnostico.anotar(msg);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-diag'; b.textContent = 'Copiar diagnóstico';
      b.addEventListener('click', async () => { b.textContent = (await Diagnostico.copiar()) ? '✓ Copiado' : 'No se pudo copiar'; });
      t.appendChild(b); t.style.pointerEvents = 'auto';
    }
    setTimeout(() => t.remove(), tipo === 'mal' ? 10000 : tipo ? 6000 : 3500);
  }
  /** Ventana inferior. Devuelve {el, cerrar}. fijo: no se cierra tocando afuera. */
  function modal(html, fijo) {
    const f = document.createElement('div');
    f.className = 'modal-fondo';
    f.innerHTML = '<div class="modal">' + html + '</div>';
    document.body.appendChild(f);
    const cerrar = () => f.remove();
    f.addEventListener('click', (e) => { if ((e.target === f && !fijo) || e.target.closest('[data-cerrar]')) cerrar(); });
    return { el: f.querySelector('.modal'), cerrar };
  }
  /** Si falta el servidor SG-SST en config.js, lo dice en vez de fallar callado. */
  function avisoServidor(el) {
    if (SGSST.url()) return false;
    el.innerHTML = '<div class="aviso">⚙️ Falta configurar el servidor <b>SG-SST</b>. Este módulo guarda en <code>backends/backend-sgsst.gs</code>: ' +
      'crea ese Apps Script (igual que los demás), implementa como aplicación web y pega la URL /exec en <code>config.js → BACKENDS.sgsst.url</code>. ' +
      'En una empresa con servidor único ya viene incluido.</div>';
    return true;
  }
  function avisoCopia(el, r) {
    if (!el) return;
    if (r && r.sinSesion) {
      // v148: no asusta a quien sí puede llenar el formulario sin usuario (preoperacional, reporte)
      el.innerHTML = '<div class="aviso info">' + (/preoperacional|reportes/.test(location.pathname) ? 'Puedes llenar el formulario sin usuario. El historial de lo ya hecho es solo para usuarios del portal.' : '🔒 Esta información es solo para usuarios del portal.') + ' <button type="button" class="btn-mini" data-entrar>Entrar con mi usuario</button></div>';
      el.querySelector('[data-entrar]').addEventListener('click', () => Sesion.pedir());
      return;
    }
    el.innerHTML = r && r.desdeCopia ? '<div class="aviso amar">📴 Sin conexión: se muestra lo último que se cargó en este equipo' + (r.copiaDel ? ' (' + new Date(r.copiaDel).toLocaleString('es-CO') + ')' : '') + '. Lo que registres se envía solo al volver la señal.</div>' : '';
  }

  /* Una imagen que viene del servidor solo se pinta si de verdad es una imagen
     (así un texto malicioso guardado como "foto" no puede ejecutar nada). */
  function src(s) { return /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(String(s || '')) ? String(s) : ''; }
  function imgs(lista, estilo) { return (lista || []).map(src).filter(Boolean).map((f) => '<img src="' + f + '"' + (estilo ? ' style="' + estilo + '"' : '') + ' alt="Foto">').join(''); }

  /* ── Fechas ── */
  const hoy = () => Festivos.hoy();
  const corta = (iso) => Festivos.corta(iso);
  function semaforo(vence, diasAviso) {
    if (!vence) return 'gris';
    const h = hoy();
    if (vence < h) return 'mal';
    if (vence <= Festivos.sumarDias(h, diasAviso == null ? 15 : diasAviso)) return 'pronto';
    return 'ok';
  }
  function diasHasta(iso) {
    if (!iso) return null;
    const a = new Date(hoy() + 'T12:00:00'), b = new Date(iso + 'T12:00:00');
    return Math.round((b - a) / 86400000);
  }
  function cuandoTexto(iso) {
    const d = diasHasta(iso);
    if (d === null) return '';
    if (d === 0) return 'hoy';
    if (d === 1) return 'mañana';
    if (d === -1) return 'ayer';
    return d > 0 ? 'en ' + d + ' días' : 'hace ' + (-d) + ' días';
  }

  /* ── Fotos: se reducen a ~1024 px en JPEG (≈80–150 KB) antes de guardar ── */
  // v144: calidad 0,6 (cada foto pesa ~40 % menos al subir con datos móviles; se sigue viendo bien en el PDF)
  // y, si el celular lo permite, se decodifica sin pasar por un texto base64 gigante (más rápido y menos memoria).
  function comprimir(archivo, max, calidad) {
    max = max || 1024; calidad = calidad || 0.6;
    if (typeof createImageBitmap === 'function' && archivo instanceof Blob) {
      return createImageBitmap(archivo).then((img) => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        if (img.close) img.close();
        return c.toDataURL('image/jpeg', calidad);
      }).catch(() => comprimirViejo(archivo, max, calidad));
    }
    return comprimirViejo(archivo, max, calidad);
  }
  function comprimirViejo(archivo, max, calidad) {
    return new Promise((ok, mal) => {
      const fr = new FileReader();
      fr.onerror = () => mal(fr.error);
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => mal(new Error('No se pudo leer la imagen'));
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', calidad));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(archivo);
    });
  }
  /** Galería de fotos con botón de cámara. Devuelve {get, set}. */
  function fotos(contenedor, opciones) {
    opciones = opciones || {};
    const max = opciones.max || 4;
    let lista = (opciones.inicial || []).slice();
    const pintar = () => {
      contenedor.innerHTML = '<div class="fotos">' + lista.map((f, i) => '<div class="f"><img src="' + src(f) + '" alt="Foto ' + (i + 1) + '"><button type="button" data-q="' + i + '" aria-label="Quitar foto">✕</button></div>').join('') +
        (lista.length < max ? '<label class="add"><span>📷</span>Agregar foto<input type="file" accept="image/*" capture="environment"></label>' : '') + '</div>';
      const inp = contenedor.querySelector('input[type=file]');
      if (inp) inp.addEventListener('change', async () => {
        const f = inp.files[0]; if (!f) return;
        try { lista.push(await comprimir(f)); pintar(); if (opciones.alCambiar) opciones.alCambiar(); } catch (e) { toast('No se pudo agregar la foto: ' + e.message, 'mal'); }
      });
      contenedor.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { lista.splice(+b.dataset.q, 1); pintar(); if (opciones.alCambiar) opciones.alCambiar(); }));
    };
    pintar();
    const api = { get: () => lista.slice(), set: (l) => { lista = (l || []).slice(); pintar(); } };
    // v139: las fotos también quedan en el autoguardado (si se sale sin guardar, no se pierden).
    if (typeof AutoGuardado !== 'undefined' && AutoGuardado.registrarExtra) {
      const marcar = () => AutoGuardado.marcar(contenedor);
      const previo = opciones.alCambiar; opciones.alCambiar = () => { marcar(); if (previo) previo(); };
      const n = contenedor.id || contenedor.getAttribute('data-fotos') || ('f' + [...document.querySelectorAll('.fotos')].indexOf(contenedor.querySelector('.fotos')));
      AutoGuardado.registrarExtra(contenedor, 'fotos:' + n, { get: api.get, set: (l) => { api.set(l); if (previo) previo(); } });
    }
    return api;
  }

  /* ── Firmas ── */
  const sig = SignaturePad.createManager({ signedLabel: 'Firmado ✓', unsignedLabel: 'Sin firmar' });
  sig.bindOrientationChange();
  document.addEventListener('click', (e) => {
    const c = e.target.closest('button[data-clear]'); if (c) { sig.pads[c.dataset.clear] && sig.pads[c.dataset.clear].clear(); return; }
    const u = e.target.closest('button[data-undo]'); if (u) { sig.pads[u.dataset.undo] && sig.pads[u.dataset.undo].undo(); }
  });
  function padHTML(id) {
    return '<canvas class="mini-pad" id="' + id + '"></canvas><div class="sig-actions"><button type="button" data-clear="' + id + '">Borrar firma</button>' +
      '<button type="button" data-undo="' + id + '">Deshacer trazo</button><span class="sig-status" id="status_' + id + '">Sin firmar</span></div>';
  }
  function activarPad(id, firma) {
    const c = $(id); if (!c) return;
    sig.setup(c);
    setTimeout(() => { sig.refreshIn(c.parentElement); if (firma && sig.pads[id]) sig.pads[id].setDataUrl(firma); }, 60);
    // v141: las firmas NO se autoguardan: una firma a medias no puede reaparecer en el registro de otra persona.
  }
  const firma = (id) => (sig.pads[id] ? sig.pads[id].getDataUrl() : null);

  /* ── Personas (base del anexo + personal habilitado) para autocompletar ── */
  let personas = null;
  async function cargarPersonas() {
    if (personas) return personas;
    const mapa = {};
    const agregar = (p) => { const k = Habilitacion.clave(p.cedula) || ('N:' + String(p.nombre || '').toUpperCase()); if (!p.nombre) return; if (!mapa[k]) mapa[k] = { nombre: p.nombre, cedula: p.cedula || '', cargo: p.cargo || '', area: p.area || '', empresa: p.empresa || '' }; else ['cargo', 'area', 'empresa'].forEach((c) => { if (!mapa[k][c] && p[c]) mapa[k][c] = p[c]; }); };
    // v174: SOLO el personal que la empresa incluyó en Personal habilitado (activo y ya revisado). Antes se mezclaba
    // la base del anexo de permisos (personas de otras obras o de contratistas) y aparecía gente que nunca se agregó.
    try { const m = await Habilitacion.cargar(); Object.keys(m || {}).forEach((k) => { const p = m[k] || {}; if (p.activo !== false && !p.porRevisar && !p.fusionadoCon) agregar(p); }); } catch (e) {}
    try { SGSST._lsSet('ssta-personal-lista', []); } catch (e) {}
    personas = Object.keys(mapa).map((k) => mapa[k]).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return personas;
  }
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /** Autocompletar en un campo de nombre. alElegir(persona).
      Al tocar el campo ya muestra la lista (las primeras personas); al escribir, filtra por nombre o cédula. */
  function autocompletar(input, alElegir) {
    const field = input.closest('.field') || input.parentElement;
    if (!input || input.dataset.acListo) return; input.dataset.acListo = '1';
    let caja = null, turno = 0;
    const cerrar = () => { if (caja) { caja.remove(); caja = null; } };
    input.setAttribute('autocomplete', 'off');
    const mostrar = async () => {
      const yo = ++turno, q = norm(input.value).trim();
      const todas = await cargarPersonas();
      if (yo !== turno || document.activeElement !== input) return;
      cerrar();
      const l = (q ? todas.filter((p) => norm(p.nombre).includes(q) || String(p.cedula).includes(q)) : todas).slice(0, 8);
      if (q && l.length === 1 && norm(l[0].nombre) === q) return;
      caja = document.createElement('div'); caja.className = 'ac';
      caja.innerHTML = l.length ? l.map((p, i) => '<button type="button" data-i="' + i + '">' + esc(p.nombre) + '<small>' + esc([p.cedula && 'C.C. ' + p.cedula, p.cargo].filter(Boolean).join(' · ')) + '</small></button>').join('') +
          (!q && todas.length > 8 ? '<div class="ac-nota">Escribe para buscar entre ' + todas.length + ' personas</div>' : '')
        : '<div class="ac-nota">' + (todas.length ? 'Nadie coincide: se guarda tal como lo escribes.' : 'Aún no hay personas en Personal habilitado. Escribe el nombre completo.') + '</div>';
      field.appendChild(caja);
      caja.addEventListener('mousedown', (e) => e.preventDefault());
      caja.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; alElegir(l[+b.dataset.i]); cerrar(); input.dispatchEvent(new Event('change', { bubbles: true })); });
    };
    input.addEventListener('input', mostrar);
    input.addEventListener('focus', mostrar);
    input.addEventListener('blur', () => setTimeout(cerrar, 150));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
  }

  /* Cualquier otro campo que pida un nombre de persona (responsable, inspector, quien recibe…)
     también ofrece el personal habilitado, sin que cada página lo tenga que pedir. */
  const PIDE_NOMBRE = /nombre|responsable|inspector|quien|qui[eé]n|encargad|supervisor|trabajador|elabor|revis|aprob|recib|entreg/i;
  const NO_PERSONA = /empresa|equipo|producto|sustancia|actividad|proveedor|archivo|obra|centro|lugar|correo|placa|marca|modelo|curso|tema|programa|formato|plan|cargo|c[eé]dula/i;
  function pideNombre(i) {
    if (i.dataset.acListo || i.dataset.noAc != null || i.type !== 'text' || i.closest('.ac, [data-no-ac]')) return false;
    const lab = (i.labels && i.labels[0] && i.labels[0].textContent) || (i.closest('.field') && (i.closest('.field').querySelector('label') || {}).textContent) || '';
    const t = [i.id, i.name, i.placeholder, i.getAttribute('aria-label'), lab].join(' ');
    return PIDE_NOMBRE.test(t) && !NO_PERSONA.test(t);
  }
  function enlazarNombres(raiz) {
    (raiz || document).querySelectorAll('input[type="text"]:not([data-ac-listo])').forEach((i) => { if (pideNombre(i)) autocompletar(i, (p) => { i.value = p.nombre; llenarVecinos(i, p); }); });
  }
  /* v159 · Autollenado por cédula: AutoCedula (common.js) llena los demás campos del bloque. */
  const llenarVecinos = (i, p) => { if (typeof AutoCedula !== 'undefined') AutoCedula.llenarVecinos(i, p); };
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    const arrancar = () => { enlazarNombres(); let t = null; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => enlazarNombres(), 120); }).observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(arrancar, 0)); else setTimeout(arrancar, 0);
  }

  /* ── Hoja para PDF con el encabezado de la empresa ── */
  let logoData = null;
  try { fetch(EMPRESA.logo).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!b) return; const fr = new FileReader(); fr.onload = () => { logoData = fr.result; }; fr.readAsDataURL(b); }).catch(() => {}); } catch (e) {}
  function cabecera(idFormato, titulo, subtitulo) {
    const f = Empresa.formato(idFormato);
    if (/^SG-/.test(f.codigo || '')) f.codigo = '';   // formato de gestión sin código asignado
    const meta = [f.codigo ? 'Código: <b>' + esc(f.codigo) + '</b>' : '', f.version ? 'Versión del formato: ' + esc(f.version) : '', f.fecha ? 'Fecha del formato: ' + esc(f.fecha) : '', f.actualizacion ? 'Actualización: ' + esc(f.actualizacion) : ''].filter(Boolean).join('<br>');
    return '<table class="hp-cab"><colgroup><col style="width:16%"><col><col style="width:22%"></colgroup><tr>' +
      '<td class="hp-logo"><img src="' + (logoData || EMPRESA.logo) + '" alt="Logo"></td>' +
      '<td class="hp-tit">' + esc(titulo) + (subtitulo ? '<div>' + esc(subtitulo) + '</div>' : '') + '</td>' +
      '<td class="hp-meta">' + (meta || esc(EMPRESA.nombre || '')) + '</td></tr></table>';
  }
  function seccion(titulo, filas) {
    return '<div class="hp-sec"><table><tr><td class="hp-st">' + esc(titulo) + '</td></tr></table>' + filas + '</div>';
  }
  /** pares: [[etiqueta, valor], …] en una tabla de 4 columnas. */
  function tablaDatos(pares) {
    let h = '<table><colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>';
    for (let i = 0; i < pares.length; i += 2) {
      const a = pares[i], b = pares[i + 1];
      h += '<tr><td class="l">' + esc(a[0]) + '</td><td' + (b ? '' : ' colspan="3"') + '>' + (a[2] ? a[1] : esc(a[1])) + '</td>' +
        (b ? '<td class="l">' + esc(b[0]) + '</td><td>' + (b[2] ? b[1] : esc(b[1])) + '</td>' : '') + '</tr>';
    }
    return h + '</table>';
  }
  function textoLargo(t) { return '<table><tr><td style="white-space:pre-wrap;">' + esc(t || '—') + '</td></tr></table>'; }
  function fotosHoja(lista) {
    if (!lista || !lista.length) return '';
    return '<table><tr><td>' + imgs(lista, 'height:120px;max-width:31%;object-fit:cover;margin:2px;border:1px solid var(--n-450);') + '</td></tr></table>';
  }
  function firmaHoja(img) { return src(img) ? '<img src="' + src(img) + '" style="max-height:38px;max-width:100%;">' : ''; }
  /** v148: bloque «Elaboró / Revisó / Aprobó» para matrices, informes y actas (lo pide cualquier auditor).
   *  roles: lista de etiquetas; firmas: { etiqueta: {nombre, cargo, firma, fecha} } opcional. */
  function firmasAprobacion(firmas, roles) {
    roles = roles || ['Elaboró (responsable del SG-SST)', 'Revisó (COPASST o vigía)', 'Aprobó (representante legal)'];
    firmas = firmas || {};
    return seccion('Aprobación', '<table><tr>' + roles.map((r) => { const f = firmas[r] || {};
      return '<td style="width:' + Math.floor(100 / roles.length) + '%;vertical-align:bottom;height:70px;">' + (f.firma ? firmaHoja(f.firma) : '') +
        '<div style="border-top:1px solid var(--n-700,#333);margin-top:30px;padding-top:2px;"><b>' + esc(r) + '</b><br>Nombre: ' + esc(f.nombre || '') + '<br>Cargo: ' + esc(f.cargo || '') + '<br>Fecha: ' + esc(f.fecha || '') + '</div></td>'; }).join('') + '</tr></table>');
  }
  /** opciones (v148): { registro: {id, version, actualizado, por}, borrador: 'texto de marca de agua' } */
  async function imprimir(hojas, horizontal, opciones) {
    opciones = opciones || {};
    let cont = $('hojaPermiso');
    if (!cont) { cont = document.createElement('div'); cont.id = 'hojaPermiso'; document.body.appendChild(cont); }
    cont.classList.add('hp-sgsst'); cont.setAttribute('lang', 'es');   // v148: estilos de documento (pt, no px) solo para estos formatos
    const rg = opciones.registro, traza = rg ? 'Registro ' + esc(rg.id || '') + (rg.version ? ' · versión ' + esc(rg.version) : '') + (rg.actualizado ? ' · última modificación ' + esc(String(rg.actualizado).slice(0, 16).replace('T', ' ')) : '') + (rg.por ? ' por ' + esc(rg.por) : '') + ' · ' : '';
    cont.innerHTML = hojas.map((h, i) => '<div class="hp"' + (i ? ' style="break-before:page;page-break-before:always;"' : '') + '>' +
      (opciones.borrador ? '<div style="border:2px solid var(--rojo-700,#b42318);color:var(--rojo-700,#b42318);font-weight:800;text-align:center;padding:4px;margin-bottom:6px;">' + esc(opciones.borrador) + '</div>' : '') + h +
      '<div class="hp-pie">' + traza + 'Impreso el ' + esc(new Date().toLocaleString('es-CO')) + ' desde el ' + esc(Empresa.pie()) + '</div></div>').join('');
    // v148: los títulos de columna se repiten en cada hoja (fila de <th> → <thead>)
    cont.querySelectorAll('table').forEach((t) => { if (t.tHead) return; const f = t.rows[0]; if (f && f.cells.length > 1 && [...f.cells].every((c) => c.tagName === 'TH')) { const th = t.createTHead(); th.appendChild(f); } });
    // v148: código, versión y título del formato arriba de cada hoja; trazabilidad abajo de cada hoja (no solo al final)
    const meta = String((cont.querySelector('.hp-meta') || {}).innerHTML || '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'), tit = ((cont.querySelector('.hp-tit') || {}).firstChild || {}).textContent || '';
    const q = (t) => '"' + String(t || '').replace(/[\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) + '"';
    const pieTxt = (rg ? 'Registro ' + (rg.id || '') + (rg.version ? ' · v' + rg.version : '') + ' · ' : '') + 'Impreso el ' + new Date().toLocaleString('es-CO') + ' · ' + (typeof EMPRESA !== 'undefined' ? EMPRESA.nombre || '' : '');
    let st = $('paginaSgsst');
    if (!st) { st = document.createElement('style'); st.id = 'paginaSgsst'; document.head.appendChild(st); }
    // v148: «Página X de Y» en cada hoja impresa
    const caja = 'font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#333;';
    st.textContent = '@media print{@page{size:letter ' + (horizontal ? 'landscape' : 'portrait') + ';margin:14mm 10mm 13mm;' +
      '@top-left{content:' + q(tit) + ';' + caja + '}@top-right{content:' + q(meta) + ';' + caja + '}' +
      '@bottom-left{content:' + q(pieTxt) + ';' + caja + '}@bottom-right{content:"Página " counter(page) " de " counter(pages);' + caja + '}}}';
    document.body.classList.add('hp-lista');
    const imgs = [...cont.querySelectorAll('img')].filter((i) => !i.complete);
    if (imgs.length) await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))), new Promise((r) => setTimeout(r, 2500))]);
    window.print();
  }
  window.addEventListener('afterprint', () => document.body.classList.remove('hp-lista'));

  /* ── Plan de acción compartido: cualquier módulo crea acciones ── */
  const ORIGENES = ['Reporte de acto/condición', 'Incidente', 'Accidente de trabajo', 'Inspección planeada', 'Inspección de EPP', 'Auditoría', 'Autoevaluación Res. 0312', 'Requerimiento ARL/MinTrabajo', 'COPASST', 'Comité de convivencia', 'Revisión por la dirección', 'Matriz de peligros', 'Simulacro', 'Plan de emergencias', 'Gestión del cambio', 'Matriz legal', 'Evaluación de proveedores', 'Batería psicosocial', 'Programa de alto riesgo', 'PESV', 'Contratistas', 'Ambiental', 'Sustancias químicas', 'Calidad', 'Asesor SST', 'Preoperacional', 'Otro'];
  /** Ventana para crear una acción ya relacionada con su origen. */
  function nuevaAccion(pre, alGuardar) {
    pre = pre || {};
    const m = modal('<h3>➕ Acción para el plan de acción</h3>' +
      (pre.origenRef ? '<div class="aviso info u-mb10">Origen: ' + esc(pre.origen || '') + ' · ' + esc(pre.origenRef) + '</div>' : '') +
      '<div class="field"><label>Hallazgo (qué se encontró)</label><textarea id="naHallazgo">' + esc(pre.hallazgo || '') + '</textarea></div>' +
      '<div class="field"><label>Acción (qué se va a hacer)</label><textarea id="naAccion" placeholder="Ej: Cambiar la guarda de la pulidora y reentrenar en su uso">' + esc(pre.accion || '') + '</textarea></div>' +
      '<div class="grid2"><div class="field"><label>Tipo</label><select id="naTipo"><option>Correctiva</option><option>Preventiva</option><option>De mejora</option></select></div>' +
      '<div class="field"><label>Prioridad</label><select id="naPrioridad"><option>Alta</option><option selected>Media</option><option>Baja</option></select></div></div>' +
      '<div class="field"><label>Responsable</label><input type="text" id="naResp" placeholder="Nombre (escribe para buscar)" value="' + esc(pre.responsable || '') + '"></div>' +
      '<div class="field"><label>Fecha de compromiso</label><input type="date" id="naFecha" value="' + esc(pre.fechaCompromiso || Festivos.sumarDias(hoy(), pre.prioridad === 'Alta' ? 7 : 15)) + '"></div>' +
      '<button type="button" class="btn amber" id="naGuardar">Guardar acción</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button>');
    if (pre.tipoAccion) m.el.querySelector('#naTipo').value = pre.tipoAccion;
    if (pre.prioridad) m.el.querySelector('#naPrioridad').value = pre.prioridad;
    autocompletar(m.el.querySelector('#naResp'), (p) => { m.el.querySelector('#naResp').value = p.nombre; });
    m.el.querySelector('#naGuardar').addEventListener('click', async () => {
      const v = (id) => m.el.querySelector(id).value.trim();
      if (!v('#naAccion')) { toast('Escribe la acción.', 'mal'); return; }
      if (!v('#naResp')) { toast('Falta el responsable.', 'mal'); return; }
      const b = m.el.querySelector('#naGuardar'); b.disabled = true; b.textContent = 'Guardando…';
      const r = await guardarAccion(Object.assign({}, pre, { hallazgo: v('#naHallazgo'), accion: v('#naAccion'), tipoAccion: v('#naTipo'), prioridad: v('#naPrioridad'), responsable: v('#naResp'), fechaCompromiso: v('#naFecha') }));
      b.disabled = false; b.textContent = 'Guardar acción';
      if (!r.ok) { toast(Errores.texto('guardó', r), 'mal'); return; }
      m.cerrar();
      toast(r.enCola ? '⏳ Acción guardada en el equipo: se envía al volver la señal.' : '✓ Acción agregada al plan de acción.');
      if (alGuardar) alGuardar(r);
    });
  }
  /** Crea una acción sin preguntar (p. ej. desde una inspección con no conformes). */
  async function guardarAccion(a) {
    const id = a.id || SGSST.nuevoId('ACC');
    const doc = { origen: a.origen || 'Otro', origenRef: a.origenRef || '', hallazgo: a.hallazgo || '', accion: a.accion || '', tipoAccion: a.tipoAccion || 'Correctiva',
      prioridad: a.prioridad || 'Media', responsable: a.responsable || '', fechaCompromiso: a.fechaCompromiso || Festivos.sumarDias(hoy(), 15), centro: a.centro || '',
      fotos: a.fotos || [], estado: 'ABIERTA', fecha: hoy(), creadoPor: a.creadoPor || '', seguimiento: [] };
    const r = await SGSST.enviar({ action: 'guardar', tipo: 'accion', id, doc },
      { estado: 'ABIERTA', fecha: doc.fecha, titulo: doc.accion, responsable: doc.responsable, vence: doc.fechaCompromiso,
        resumen: { origen: doc.origen, origenRef: doc.origenRef, hallazgo: doc.hallazgo, accion: doc.accion, responsable: doc.responsable, fechaCompromiso: doc.fechaCompromiso, prioridad: doc.prioridad, tipoAccion: doc.tipoAccion } });
    return Object.assign({ id }, r);
  }

  /* ── Historial de un registro: quién, cuándo y qué cambió (bitácora del servidor) ── */
  const ACCIONES_HIST = { CREAR: 'Creó', ACTUALIZAR: 'Modificó', PARCHE: 'Actualizó', BORRAR: 'Borró', GUARDAR: 'Intentó guardar', ADJUNTAR: 'Intentó adjuntar', ENTRAR: 'Entró al portal', CLAVE: 'Cambió su clave', USUARIO: 'Usuario', RESPALDO: 'Respaldo' };
  async function historial(id, titulo, consulta) {
    const m = modal('<h3>🕘 Historial</h3><p class="ayuda">' + esc(titulo || id) + '</p><div id="histLista"><div class="status-msg">Cargando…</div></div><button type="button" class="btn ghost" data-cerrar>Cerrar</button>');
    const cont = m.el.querySelector('#histLista');
    if (!navigator.onLine) { cont.innerHTML = '<div class="aviso">Se necesita conexión para ver el historial.</div>'; return; }
    try {
      const j = await SGSST.consultar(consulta || { action: 'historial', id });
      if (!j.ok) { cont.innerHTML = '<div class="aviso">' + esc(j.error || 'No se pudo cargar.') + '</div>'; return; }
      if (!j.eventos.length) { cont.innerHTML = '<div class="empty">Sin movimientos registrados.</div>'; return; }
      cont.innerHTML = j.eventos.map((e) => {
        const rech = e.resultado !== 'APLICADO' && e.resultado !== 'DUPLICADO';
        const det = String(e.detalle || ''), k = det.indexOf(' · cambió: ');
        return '<div class="hist' + (rech ? ' rech' : '') + '"><b>' + esc((ACCIONES_HIST[e.accion] || e.accion) + (rech ? ' (rechazado)' : e.resultado === 'DUPLICADO' ? ' (reenvío repetido)' : '')) + '</b>' +
          (e.usuario ? ' · ' + esc(e.usuario) : '') + (e.ref ? ' · ' + esc(e.ref) : '') + '<small>' + esc(new Date(e.ts).toLocaleString('es-CO')) + (e.version ? ' · v' + esc(e.version) : '') + '</small>' +
          (k !== -1 ? '<small>Cambió: ' + esc(det.slice(k + 11)) + '</small>' : rech ? '<small>' + esc(det) + '</small>' : '') + '</div>';
      }).join('');
    } catch (e) { cont.innerHTML = '<div class="aviso">Sin conexión con el servidor.</div>'; }
    // v137: el sello de auditoría de cada firma (fecha del servidor, quién, GPS, equipo y código de verificación).
    if (consulta) return;
    try {
      const sj = await SGSST.consultar({ action: 'sellos', id });
      if (sj && sj.ok && sj.firmas && sj.firmas.length) cont.insertAdjacentHTML('beforeend', '<h4 style="margin:14px 0 6px;">Sello de las firmas</h4>' + sj.firmas.map((f) =>
        '<div class="hist' + (f.sellada && !f.valida ? ' rech' : '') + '"><b>' + (f.valida ? (f.sinTrazo ? '✓ Firma sin trazo verificada: ' + esc(f.sinTrazo) : '✓ Firma verificada') : f.sellada ? '✗ El sello no coincide (la firma o sus datos cambiaron)' : 'Firma sin sello (anterior a la v137)') + '</b>' +
        (f.sellada ? '<small>' + esc(new Date(f.fecha).toLocaleString('es-CO')) + ' (hora del servidor)' + (f.usuario ? ' · ' + esc(f.usuario) : '') + (f.gps ? ' · GPS ' + esc(f.gps) : '') + '</small><small>Código ' + esc(f.codigo) + '… · ' + esc(f.equipo) + '</small>' : '') + '</div>').join(''));
    } catch (e) {}
  }
  /** Botón 🕘 Historial para poner en cualquier detalle. */
  function botonHistorial(id, titulo) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost btn-hist'; b.textContent = '🕘 Historial de cambios';
    b.addEventListener('click', () => historial(id, titulo));
    return b;
  }

  /* ── v127: eliminar lo que se agregó mal (una cosa o varias) ──
     El servidor no borra la fila: la marca «BORRADO» con fecha, motivo y quién (queda en el
     historial). Solo Administrador y SST; el servidor también lo exige. */
  const puedeEliminar = () => { try { const r = Sesion.rol(); return !r || r === 'admin' || r === 'sst'; } catch (e) { return true; } };
  async function eliminarVarios(ids, que) {
    const n = ids.length; if (!n) return false;
    const m = modal('<h3>¿Eliminar ' + (n === 1 ? esc(que || 'este registro') : n + ' registros') + '?</h3>' +
      '<p class="ayuda">Deja de aparecer en las listas. No se pierde: queda en el historial con la fecha y quién lo eliminó.</p>' +
      '<div class="field"><label>¿Por qué? (opcional)</label><input type="text" id="elMot" maxlength="200" placeholder="Ej.: se registró por error, persona duplicada…"></div>' +
      '<button type="button" class="btn rojo" id="elOk">Eliminar' + (n > 1 ? ' ' + n : '') + '</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button><div class="status-msg" id="elMsg"></div>');
    return new Promise((fin) => {
      let hecho = false;
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!hecho) fin(false); } });
      obs.observe(document.body, { childList: true });
      m.el.querySelector('#elOk').addEventListener('click', async () => {
        const b = m.el.querySelector('#elOk'), msg = m.el.querySelector('#elMsg'), mot = m.el.querySelector('#elMot').value.trim();
        b.disabled = true; let ok = 0, mal = '';
        for (let i = 0; i < n; i++) {
          msg.textContent = 'Eliminando ' + (i + 1) + ' de ' + n + '…';
          const r = await SGSST.enviar({ action: 'borrar', id: ids[i], motivo: mot || 'Eliminado desde el portal' });
          if (r && r.ok) ok++; else mal = (r && r.error) || 'sin respuesta';
        }
        hecho = true;
        if (ok === n) { m.cerrar(); deshacer(ids, n === 1 ? 'Eliminado' : n + ' eliminados'); fin(true); }
        else { msg.textContent = 'Se eliminaron ' + ok + ' de ' + n + '. ' + mal; b.disabled = false; if (ok) fin(true); }
      });
    });
  }
  /** v139: «Deshacer» durante 10 s después de eliminar; y la papelera (30 días) para después. */
  function deshacer(ids, texto) {
    const v = document.querySelector('.deshacer-barra'); if (v) v.remove();
    const b = document.createElement('div'); b.className = 'deshacer-barra'; b.setAttribute('role', 'status');
    b.innerHTML = '<span>' + esc(texto) + '. </span><a href="papelera.html">Papelera</a>';
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Deshacer'; b.appendChild(btn);
    document.body.appendChild(b);
    const quitar = setTimeout(() => b.remove(), 10000);
    btn.addEventListener('click', async () => {
      clearTimeout(quitar); btn.disabled = true; b.querySelector('span').textContent = 'Recuperando…';
      let ok = 0, sinSenal = false; for (const id of ids) { const r = await SGSST.enviar({ action: 'restaurar', id }, null, { sinCola: true }); if (r && r.ok && !r.enCola) ok++; else if (r && r.sinConexion) sinSenal = true; }
      b.remove();
      if (ok === ids.length) { toast('Recuperado. Volvió a las listas.'); setTimeout(() => location.reload(), 900); }
      else toast(sinSenal ? 'Sin señal no se pudo recuperar. Hazlo desde la Papelera cuando haya conexión.' : 'Se recuperaron ' + ok + ' de ' + ids.length + '. Lo demás está en la Papelera.', 'mal');
    });
  }
  /** Botón «Eliminar» para la ficha de un registro. alTerminar() se llama si se eliminó. */
  function botonEliminar(id, que, alTerminar) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost btn-eliminar'; b.textContent = 'Eliminar';
    if (!puedeEliminar()) { b.hidden = true; return b; }
    b.addEventListener('click', async () => { if (await eliminarVarios([id], que)) { if (alTerminar) alTerminar(); } });
    return b;
  }
  /** Selección de varios para eliminar en una lista cuyos elementos tienen [data-<atributo>]=id.
      seleccionVarios({ lista, barra, atributo: 'id', que: 'personas', alTerminar }) */
  function seleccionVarios(o) {
    if (!o.lista || !o.barra || !puedeEliminar() || o.lista.dataset.selVarios) return;
    o.lista.dataset.selVarios = '1';
    const at = o.atributo || 'id', sel = new Set();
    let activo = false;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn ghost mini sel-varios'; btn.textContent = 'Seleccionar para eliminar';
    o.barra.appendChild(btn);
    const pie = document.createElement('div'); pie.className = 'sel-pie'; pie.hidden = true;
    pie.innerHTML = '<span class="sel-n">0 seleccionados</span><button type="button" class="btn ghost mini" data-todo>Todos</button><button type="button" class="btn rojo mini" data-elim disabled>Eliminar</button><button type="button" class="btn ghost mini" data-salir>Cancelar</button>';
    document.body.appendChild(pie);
    const items = () => [...o.lista.querySelectorAll('[data-' + at + ']')];
    const marcar = () => {
      items().forEach((el) => { const on = sel.has(el.getAttribute('data-' + at)); el.classList.toggle('sel-on', activo && on); el.classList.toggle('sel-modo', activo); });
      pie.querySelector('.sel-n').textContent = sel.size + (sel.size === 1 ? ' seleccionado' : ' seleccionados');
      pie.querySelector('[data-elim]').disabled = !sel.size;
      pie.querySelector('[data-elim]').textContent = 'Eliminar' + (sel.size ? ' ' + sel.size : '');
    };
    const salir = () => { activo = false; sel.clear(); pie.hidden = true; btn.textContent = 'Seleccionar para eliminar'; marcar(); };
    btn.addEventListener('click', () => { if (activo) { salir(); return; } activo = true; pie.hidden = false; btn.textContent = 'Terminar selección'; marcar(); });
    // En modo selección, tocar un elemento lo marca en vez de abrirlo.
    o.lista.addEventListener('click', (e) => {
      if (!activo) return; const el = e.target.closest('[data-' + at + ']'); if (!el || !o.lista.contains(el)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const id = el.getAttribute('data-' + at); if (sel.has(id)) sel.delete(id); else sel.add(id); marcar();
    }, true);
    new MutationObserver(() => { if (activo) marcar(); }).observe(o.lista, { childList: true, subtree: true });
    pie.querySelector('[data-salir]').addEventListener('click', salir);
    pie.querySelector('[data-todo]').addEventListener('click', () => { const ids = items().map((el) => el.getAttribute('data-' + at)); const todos = ids.every((i) => sel.has(i)); ids.forEach((i) => { if (todos) sel.delete(i); else sel.add(i); }); marcar(); });
    pie.querySelector('[data-elim]').addEventListener('click', async () => { if (await eliminarVarios([...sel], o.que)) { salir(); if (o.alTerminar) o.alTerminar(); } });
    if (!document.getElementById('estiloSelVarios')) {
      const st = document.createElement('style'); st.id = 'estiloSelVarios';
      st.textContent = '.sel-barra{display:flex;justify-content:flex-end;margin:2px 0 8px;}.sel-barra[hidden]{display:none;}.sel-pie[hidden]{display:none !important;}.sel-barra .sel-varios{width:auto;margin:0;min-height:38px;font-size:var(--fs-base);}.btn-eliminar{color:var(--rojo-700) !important;}' + '.sel-modo{position:relative;padding-left:46px !important;}.sel-modo::before{content:"";position:absolute;left:14px;top:50%;width:20px;height:20px;margin-top:-10px;border:2px solid var(--n-400);border-radius:var(--r-xs);background:#fff;}' +
        '.sel-on{outline:2.5px solid var(--rojo-500);outline-offset:-2px;}.sel-on::before{background:#d92d20 url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%273.5%27%3E%3Cpath d=%27M5 12l5 5L20 7%27/%3E%3C/svg%3E") center/14px no-repeat;border-color:var(--rojo-500);}' +
        '.sel-pie{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(92px + env(safe-area-inset-bottom));z-index:60;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;background:var(--tinta);color:#fff;border-radius:var(--r-l);padding:10px 12px;box-shadow:0 14px 34px rgba(16,33,58,.35);max-width:calc(100vw - 24px);}' +
        '.sel-pie .sel-n{font-weight:800;font-size:var(--fs-base);padding:0 4px;}.sel-pie .btn{margin:0 !important;min-height:40px;width:auto;}.btn.rojo{background:var(--rojo-500) !important;color:#fff !important;border-color:var(--rojo-500) !important;}.btn.rojo:disabled{opacity:.45;}';
      document.head.appendChild(st);
    }
  }

  /* ── v176 · Seleccionar varios y eliminar, EN TODAS LAS LISTAS ──
     Antes solo lo tenían Personal, Inspecciones, Preoperacionales y Entregas de EPP. Ahora cualquier lista de
     registros (elementos con data-id/-abrir/-ver = un id del portal, como INS-…, EXA-…) recibe «Seleccionar para
     eliminar» arriba. Lo eliminado va a la Papelera (30 días) y se puede deshacer. Solo Administrador y SST. */
  const RE_ID = /^[A-Z]{2,8}-[A-Za-z0-9_-]{3,}$/;
  const SIN_AUTO = /(^|\/)(papelera|auditor|asesor|admin|gerencia|informe|informe-mes|indicadores|pantalla-planta|convivencia|index|estado|ayuda)\.html$/;
  function autoSeleccion() {
    if (!puedeEliminar() || SIN_AUTO.test(location.pathname) || document.body.hasAttribute('data-sin-seleccion')) return;
    const grupos = new Map();
    document.querySelectorAll('[data-id],[data-abrir],[data-ver]').forEach((el) => {
      const at = el.hasAttribute('data-id') ? 'id' : el.hasAttribute('data-abrir') ? 'abrir' : 'ver', v = el.getAttribute('data-' + at), p = el.parentElement;
      if (!p || !RE_ID.test(v || '') || el.closest('.modal,.ui-modal,dialog,header,nav,.sel-pie,[data-sin-seleccion]')) return;
      if (p.dataset.selVarios || p.dataset.selAuto) return;
      if (!grupos.has(p)) grupos.set(p, at);
    });
    grupos.forEach((at, lista) => {
      lista.dataset.selAuto = '1';
      const barra = document.createElement('div'); barra.className = 'sel-barra';
      lista.parentElement.insertBefore(barra, lista);
      seleccionVarios({ lista, barra, atributo: at, que: 'este registro', alTerminar: () => setTimeout(() => location.reload(), 600) });
    });
  }
  if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
    let tAuto = 0;
    const lanzar = () => { clearTimeout(tAuto); tAuto = setTimeout(autoSeleccion, 500); };
    const iniciarAuto = () => { lanzar(); new MutationObserver(lanzar).observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarAuto); else iniciarAuto();
  }

  /* ── Adjuntos (certificados, actas escaneadas, hojas de seguridad…) ──
     Van a Google Drive a través del servidor; en el registro queda la ficha.
     adjuntos(contenedor, { id, lista?, refs?: {clave: 'nombre'}, ref?, soloLectura?, titulo? }) */
  const MIME_EXT = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', txt: 'text/plain', csv: 'text/csv' };
  const MAX_ADJ = 10 * 1024 * 1024;
  const pesoTexto = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const iconoMime = (m) => (/pdf/.test(m) ? '📄' : /^image/.test(m) ? '🖼️' : /sheet|excel|csv/.test(m) ? '📊' : /word/.test(m) ? '📝' : /presentation/.test(m) ? '📽️' : '📎');
  function leerBase64(archivo) {
    return new Promise((ok, mal) => { const fr = new FileReader(); fr.onerror = () => mal(fr.error); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(archivo); });
  }
  function adjuntos(cont, o) {
    o = o || {};
    let lista = o.lista ? o.lista.slice() : null;
    const pend = [];
    const pintar = () => {
      if (!o.id) { cont.innerHTML = '<div class="adj"><div class="adj-t">📎 Adjuntos</div><div class="ayuda">Guarda primero el registro para poder adjuntar archivos (certificados, actas, soportes).</div></div>'; return; }
      if (!lista) { cont.innerHTML = '<div class="adj"><div class="adj-t">📎 Adjuntos</div><div class="ayuda">Cargando…</div></div>'; return; }
      const act = lista.filter((a) => !a.retirado && (!o.ref || a.ref === o.ref)), ret = lista.filter((a) => a.retirado && (!o.ref || a.ref === o.ref));
      const fila = (a, retirado) => '<div class="adj-f' + (retirado ? ' ret' : '') + '"><button type="button" class="adj-ver" data-ver="' + esc(a.uid) + '">' + iconoMime(a.mime) + ' ' + esc(a.nombre) + '</button>' +
        '<small>' + esc([o.refs && a.ref && o.refs[a.ref], pesoTexto(a.tamano || 0), a.en && new Date(a.en).toLocaleDateString('es-CO'), a.por].filter(Boolean).join(' · ')) +
        (retirado ? ' · RETIRADO' + (a.retirado.motivo ? ': ' + esc(a.retirado.motivo) : '') : '') + '</small>' +
        (!retirado && !o.soloLectura ? '<button type="button" class="adj-q" data-quitar="' + esc(a.uid) + '" aria-label="Quitar ' + esc(a.nombre) + '">✕</button>' : '') + '</div>';
      cont.innerHTML = '<div class="adj"><div class="adj-t">📎 ' + esc(o.titulo || 'Adjuntos') + (act.length ? ' (' + act.length + ')' : '') + '</div>' +
        (act.length ? act.map((a) => fila(a)).join('') : '<div class="ayuda">Sin archivos.</div>') +
        pend.map((p) => '<div class="adj-f pend">⏳ ' + esc(p.nombre) + ' <small>' + esc(p.estado) + '</small></div>').join('') +
        (ret.length ? '<details><summary>' + ret.length + ' retirado(s)</summary>' + ret.map((a) => fila(a, true)).join('') + '</details>' : '') +
        (o.soloLectura ? '' : (o.refs && !o.ref ? '<select class="adj-ref"><option value="">¿De qué es el archivo?</option>' + Object.keys(o.refs).map((k) => '<option value="' + esc(k) + '">' + esc(o.refs[k]) + '</option>').join('') + '</select>' : '') +
          '<label class="btn ghost adj-sub">📎 Adjuntar archivo<input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.pptx,.txt,.csv" hidden></label><div class="ayuda">PDF, foto, Word, Excel… hasta 10 MB. Queda guardado en Google Drive de la empresa.</div>') + '</div>';
      const inp = cont.querySelector('input[type=file]');
      if (inp) inp.addEventListener('change', () => { const f = inp.files[0]; inp.value = ''; if (f) subir(f); });
      cont.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => ver(b.dataset.ver)));
      cont.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => quitar(b.dataset.quitar)));
    };
    async function subir(f) {
      const ext = String(f.name || '').split('.').pop().toLowerCase();
      let mime = f.type || MIME_EXT[ext] || '';
      if (!Object.keys(MIME_EXT).some((k) => MIME_EXT[k] === mime)) { toast('Ese tipo de archivo no se puede adjuntar (PDF, imagen, Word, Excel, PowerPoint, texto o CSV).', 'mal'); return; }
      const sel = cont.querySelector('.adj-ref'), ref = o.ref || (sel ? sel.value : '');
      if (o.refs && !o.ref && !ref) { toast('Elige primero de qué es el archivo.', 'mal'); return; }
      const p = { nombre: f.name || 'archivo', estado: 'Preparando…' }; pend.push(p); pintar();
      try {
        let base64, nombre = f.name || 'archivo';
        // Las fotos grandes se reducen (una foto de celular pesa 4–8 MB).
        if (/^image\/(jpeg|png|webp)$/.test(mime) && f.size > 1500000) { base64 = (await comprimir(f, 1800, 0.8)).split(',')[1]; mime = 'image/jpeg'; nombre = nombre.replace(/\.\w+$/, '') + '.jpg'; }
        else base64 = await leerBase64(f);
        if (base64.length * 0.75 > MAX_ADJ) { pend.splice(pend.indexOf(p), 1); pintar(); toast('El archivo pasa de 10 MB.', 'mal'); return; }
        p.estado = 'Subiendo…'; pintar();
        const uid = 'adj-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const r = await SGSST.enviar({ action: 'adjuntar', id: o.id, uid, nombre, mime, base64, ref });
        pend.splice(pend.indexOf(p), 1);
        if (!r.ok) { pintar(); toast(Errores.texto('adjuntó', r), 'mal'); return; }
        if (r.enCola) { pend.push({ nombre, estado: 'en el equipo; se envía al volver la señal' }); pintar(); return; }
        lista = (lista || []).concat([r.adjunto || { uid, nombre, mime, tamano: Math.round(base64.length * 0.75), ref, en: new Date().toISOString(), por: Sesion.nombre() }]);
        pintar(); toast('✓ Archivo adjuntado.');
        if (o.alCambiar) o.alCambiar(lista);
      } catch (e) { const i = pend.indexOf(p); if (i !== -1) pend.splice(i, 1); pintar(); toast('No se pudo leer el archivo: ' + e.message, 'mal'); }
    }
    async function ver(uid) {
      if (!navigator.onLine) { toast('Se necesita conexión para abrir el archivo.', 'mal'); return; }
      const it = (lista || []).find((x) => x.uid === uid) || {};
      // PDF e imágenes se abren en otra pestaña: se abre YA (al tocar), si no el celular la bloquea.
      const verEnPestana = /^(application\/pdf|image\/)/.test(it.mime || '');
      const w = verEnPestana ? window.open('', '_blank') : null;
      if (w) try { w.document.title = it.nombre || 'Adjunto'; w.document.body.innerHTML = '<p style="font:16px system-ui;padding:20px;">Abriendo ' + esc(it.nombre || 'el archivo') + '…</p>'; } catch (e) {}
      toast('Abriendo…');
      try {
        const j = await SGSST.consultar({ action: 'adjunto', id: o.id, uid });
        if (!j.ok) { if (w) w.close(); toast(j.error || 'No se pudo abrir.', 'mal'); return; }
        const bin = atob(j.base64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([u8], { type: j.mime }));
        if (w) {
          // Si el equipo no muestra el archivo (p. ej. un PDF en Android), lo descarga: la pestaña queda con el enlace.
          try { w.document.body.innerHTML = '<p style="font:16px system-ui;padding:20px;">Si el archivo no se abrió, revisa las descargas del equipo o <a href="' + url + '" download="' + esc(j.nombre) + '">toca aquí para descargar ' + esc(j.nombre) + '</a>.</p>'; } catch (e) {}
          w.location.href = url;
        }
        else { const a = document.createElement('a'); a.href = url; a.download = j.nombre; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      } catch (e) { if (w) w.close(); toast('Sin conexión con el servidor.', 'mal'); }
    }
    async function quitar(uid) {
      const a = (lista || []).find((x) => x.uid === uid); if (!a) return;
      const motivo = await Dialogo.pedir('¿Por qué se quita «' + a.nombre + '»? (el archivo no se borra: queda como retirado)', '');
      if (motivo === null) return;
      const r = await SGSST.enviar({ action: 'quitarAdjunto', id: o.id, uid, motivo });
      if (!r.ok) { toast(Errores.texto('quitó', r), 'mal'); return; }
      a.retirado = { en: new Date().toISOString(), por: Sesion.nombre(), motivo };
      pintar(); if (o.alCambiar) o.alCambiar(lista);
    }
    pintar();
    if (!lista && o.id) SGSST.doc(o.id).then((d) => { lista = (d && d.adjuntos) || []; pintar(); }).catch(() => { lista = []; pintar(); });
    return { lista: () => lista || [] };
  }

  /* ── Perfil de la empresa: trabajadores y clase de riesgo → 7, 21 o 60 estándares ──
     (la regla está en auditorias-plantillas.js → grupo0312; la página debe cargarlo). */
  const ID_PERFIL = 'EMPRESA-PERFIL';
  async function perfilEmpresa(filas){
    const f = (filas || (await SGSST.listar('empresa')).rows || []).find((x)=> x.tipo === 'empresa' || x.id === ID_PERFIL);
    return f ? Object.assign({ id: f.id }, f.resumen) : perfilInstalacion();
  }
  /** v113: el perfil que se definió al instalar (configurar-empresa → EMPRESA.perfil0312).
   *  Se usa mientras SST no haya guardado el perfil de la empresa en el SG-SST. */
  function perfilInstalacion(){
    const p = typeof EMPRESA !== 'undefined' && EMPRESA.perfil0312;
    if (!p || !Number(p.trabajadores)) return null;
    const agro = !!p.agropecuaria, g = typeof grupo0312 === 'function' ? grupo0312(p.trabajadores, p.claseRiesgo, agro) : (Number(p.grupo0312) || 60);
    return { nombre: EMPRESA.nombre || '', nit: EMPRESA.nit || '', trabajadores: Number(p.trabajadores), claseRiesgo: p.claseRiesgo || 'I', agropecuaria: agro, grupo0312: g, desdeInstalacion: true };
  }
  function textoGrupo(g){ return g === 3 ? '3 estándares (unidad agropecuaria de hasta 10 trabajadores permanentes, riesgo I a III · art. 7)' : g === 7 ? '7 estándares (hasta 10 trabajadores, riesgo I a III · art. 3)' : g === 21 ? '21 estándares (11 a 50 trabajadores, riesgo I a III · art. 9)' : '60 estándares (más de 50 trabajadores, o riesgo IV o V · art. 16)'; }
  async function editarPerfil(alGuardar){
    const d = (await SGSST.doc(ID_PERFIL)) || Object.assign({ nuevo: true, nombre: (typeof EMPRESA !== 'undefined' && EMPRESA.nombre) || '', nit: (typeof EMPRESA !== 'undefined' && EMPRESA.nit) || '' }, perfilInstalacion() || {});
    const m = modal('<h3>Perfil de la empresa</h3><p class="ayuda">Define qué estándares mínimos le aplican (Res. 0312 de 2019). Cuenta a todos los trabajadores (de planta, temporales y en misión) y usa la clase de riesgo más alta de la afiliación a la ARL.</p>' +
      '<div class="field"><label>Razón social</label><input type="text" id="peNom" value="' + esc(d.nombre || '') + '"></div>' +
      '<div class="grid2"><div class="field"><label>NIT</label><input type="text" id="peNit" value="' + esc(d.nit || '') + '"></div><div class="field"><label>Actividad económica</label><input type="text" id="peAct" value="' + esc(d.actividad || '') + '"></div></div>' +
      '<div class="grid2"><div class="field"><label>Número de trabajadores *</label><input type="number" min="1" id="peTrab" value="' + esc(d.trabajadores || '') + '"></div>' +
      '<div class="field"><label>Clase de riesgo más alta *</label><select id="peRies">' + ['I', 'II', 'III', 'IV', 'V'].map((r)=> '<option' + (r === d.claseRiesgo ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div></div>' +
      '<label class="ayuda" style="display:flex;gap:8px;align-items:center;margin:0 0 10px;"><input type="checkbox" id="peAgro"' + (d.agropecuaria ? ' checked' : '') + '> Unidad de producción agropecuaria (hasta 10 trabajadores permanentes: 3 estándares, art. 7)</label>' +
      '<div class="aviso info" id="peGrupo"></div>' +
      '<div class="grid2"><div class="field"><label>Correo del responsable del SG-SST</label><input type="email" id="peCS" autocapitalize="none" value="' + esc(d.correoSST || '') + '"></div><div class="field"><label>Correo del asesor SST externo</label><input type="email" id="peCA" autocapitalize="none" value="' + esc(d.correoAsesor || '') + '"></div></div>' +
      '<div class="ayuda" style="margin:-4px 0 10px;">Si un asesor externo deja tareas en este portal, el responsable recibe el aviso por correo y el asesor, copia y el aviso cuando se cierran.</div>' +
      '<button type="button" class="btn amber" id="peOk">Guardar</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button><div class="status-msg" id="peMsg"></div>', true);
    const g = ()=> grupo0312(m.el.querySelector('#peTrab').value, m.el.querySelector('#peRies').value, m.el.querySelector('#peAgro').checked);
    const ver = ()=> { m.el.querySelector('#peGrupo').textContent = m.el.querySelector('#peTrab').value ? 'Le aplican ' + textoGrupo(g()) + '.' : 'Escribe el número de trabajadores.'; };
    m.el.querySelector('#peTrab').addEventListener('input', ver); m.el.querySelector('#peRies').addEventListener('change', ver); m.el.querySelector('#peAgro').addEventListener('change', ver); ver();
    m.el.querySelector('#peOk').addEventListener('click', async ()=> {
      const t = Number(m.el.querySelector('#peTrab').value); if (!t) { m.el.querySelector('#peMsg').textContent = 'Falta el número de trabajadores.'; return; }
      const v = Object.assign({}, d, { nombre: m.el.querySelector('#peNom').value.trim(), nit: m.el.querySelector('#peNit').value.trim(), actividad: m.el.querySelector('#peAct').value.trim(),
        trabajadores: t, claseRiesgo: m.el.querySelector('#peRies').value, agropecuaria: m.el.querySelector('#peAgro').checked, grupo0312: g(), fechaActualizacion: hoy(),
        correoSST: m.el.querySelector('#peCS').value.trim().toLowerCase(), correoAsesor: m.el.querySelector('#peCA').value.trim().toLowerCase() });
      const malC = [v.correoSST, v.correoAsesor].find((x)=> x && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(x)); if (malC) { m.el.querySelector('#peMsg').textContent = 'Revisa el correo: ' + malC; return; }
      const r = await Registros.guardar('empresa', ID_PERFIL, v, d.nuevo ? 0 : d.version);
      if (typeof r === 'string') { m.el.querySelector('#peMsg').textContent = r; return; }
      m.cerrar(); toast('✓ Perfil guardado: ' + textoGrupo(v.grupo0312)); if (alGuardar) alGuardar(v);
    });
  }

  /* ── v109: cifras que llevan a lo que falta ──
     Una tarjeta <div class="kpi" data-ir="…"> se vuelve un botón:
       data-ir="tab:pendientes"            → abre esa pestaña (botón [data-tab])
       data-ir="tab:pendientes|filtro:mal" → y además deja ese filtro (window.filtrarKpi)
       data-ir="url:habilitacion.html#x"   → abre otra página
       data-ir="fn:nombre"                 → llama window.nombre()
       data-ir="sel:#idDeLaLista"          → baja hasta ese elemento */
  function irKpi(destino) {
    String(destino || '').split('|').forEach((parte) => {
      const i = parte.indexOf(':'), tipo = parte.slice(0, i), v = parte.slice(i + 1);
      if (tipo === 'tab') { const b = document.querySelector('[data-tab="' + v + '"]'); if (b) b.click(); }
      else if (tipo === 'url') location.href = v;
      else if (tipo === 'fn' && typeof window[v] === 'function') window[v]();
      else if (tipo === 'filtro' && typeof window.filtrarKpi === 'function') window.filtrarKpi(v);
      else if (tipo === 'sel') { const el = document.querySelector(v); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    });
    // Después de cambiar de pestaña o filtro, se baja a la lista.
    //  Si quedó un filtro puesto (chips .filtro-kpi), se baja hasta esos chips.
    setTimeout(() => { const f = /(^|\|)filtro:./.test(destino) && document.querySelector('.filtro-kpi');
      const l = f || document.querySelector('.tabs') || document.querySelector('.kpis'); if (l && !/^url:|(^|\|)sel:/.test(destino)) { const r = l.getBoundingClientRect(), y = (f ? r.top - 12 : r.bottom) + scrollY - 70; if (f ? Math.abs(scrollY - y) > 40 : scrollY < y - 40) window.scrollTo({ top: y, behavior: 'smooth' }); } }, 120);
  }
  function marcarKpis(raiz) {
    (raiz || document).querySelectorAll('.kpi[data-ir]:not([data-ir-listo])').forEach((k) => {
      k.setAttribute('data-ir-listo', '1'); k.setAttribute('role', 'button'); k.tabIndex = 0;
      if (!k.querySelector('.kpi-ir')) k.insertAdjacentHTML('beforeend', '<span class="kpi-ir" aria-hidden="true">Ver →</span>');
      const n = k.querySelector('.n'); k.setAttribute('aria-label', 'Ver ' + ((k.querySelector('.v') || {}).textContent || '') + ' ' + (n ? n.textContent : ''));
    });
  }
  /* v109: chips de filtro arriba de una lista, para que se vea qué filtro dejó la cifra.
     chipsFiltro([['', 'Todos (9)'], ['vencidos', 'Vencidos (2)']], actual) → HTML; cada botón lleva data-f. */
  function chipsFiltro(opciones, actual) {
    actual = actual || ''; const puesto = opciones.find((o) => o[0] === actual);
    return '<div class="chips filtro-kpi" role="group" aria-label="Filtrar la lista">' +
      opciones.map((o) => '<button type="button" data-f="' + o[0] + '" class="' + (o[0] === actual ? 'on' : '') + '" aria-pressed="' + (o[0] === actual) + '">' + o[1] + '</button>').join('') +
      (actual && puesto ? '<div class="filtro-puesto" role="status">Mostrando solo: <b>' + puesto[1].replace(/\s*\(\d+\)$/, '') + '</b> <button type="button" data-f="">Ver todos ✕</button></div>' : '') + '</div>';
  }
  /* Otra página puede abrir esta ya filtrada: pagina.html#ir=tab:x|filtro:y (lo mismo que data-ir). */
  function irDesdeHash() {
    const m = /^#ir=(.+)$/.exec(location.hash || ''); if (!m) return;
    const destino = decodeURIComponent(m[1]); let tocado = false, n = 0;
    // Se quita de la dirección antes de que la página lo lea como un código de registro (#ID).
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
    document.addEventListener('pointerdown', () => { tocado = true; }, { once: true });
    const t = setInterval(() => {
      n++; if (!document.querySelector('.kpi') && n < 40) return;
      clearInterval(t); irKpi(destino);
      setTimeout(() => { if (!tocado) irKpi(destino); }, 1200); // por si la lista se repinta con los datos del servidor
    }, 150);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => { const k = e.target.closest && e.target.closest('.kpi[data-ir]'); if (k) irKpi(k.dataset.ir); });
    document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.kpi[data-ir]')) { e.preventDefault(); irKpi(e.target.dataset.ir); } });
    const arrancar = () => { marcarKpis(); new MutationObserver(() => marcarKpis()).observe(document.body, { childList: true, subtree: true }); irDesdeHash(); };
    if (document.body) arrancar(); else document.addEventListener('DOMContentLoaded', arrancar);
  }

  Sesion.montarChip();

  return { deshacer, $, toast, modal, src, imgs, avisoServidor, avisoCopia, hoy, corta, semaforo, diasHasta, cuandoTexto, comprimir, fotos, sig, padHTML, activarPad, firma,
           cargarPersonas, autocompletar, norm, cabecera, seccion, tablaDatos, textoLargo, fotosHoja, firmaHoja, firmasAprobacion, imprimir, ORIGENES, nuevaAccion, guardarAccion,
           historial, botonHistorial, botonEliminar, seleccionVarios, eliminarVarios, adjuntos, perfilEmpresa, perfilInstalacion, editarPerfil, textoGrupo, irKpi, chipsFiltro };
})();
