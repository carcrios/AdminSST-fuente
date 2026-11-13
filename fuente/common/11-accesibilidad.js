/* ============================================================
   v130 · Accesible — accesibilidad y estados de carga en todo el portal
   ------------------------------------------------------------
   · Foco visible con teclado (anillo de color) en todo lo que se toca.
   · Todo botón o enlace sin texto (solo ícono) recibe un nombre accesible
     (de su title, su imagen o su ícono), para lectores de pantalla.
   · Los mensajes (toasts, «status-msg») se anuncian solos (aria-live).
   · Las ventanas son diálogos de verdad: role="dialog", foco adentro, Escape cierra.
   · «Cargando…» se reemplaza por un esqueleto de la lista (la pantalla no salta).
   · Quien pide menos movimiento en su teléfono, no ve animaciones.
   ============================================================ */
/* v137 · Modo sol: se recuerda en el celular y se aplica en todas las páginas. */
const ModoSol = (function () {
  const K = 'ssta-modo-sol';
  const leer = () => { try { return localStorage.getItem(K) === '1'; } catch (e) { return false; } };
  const aplicar = (on) => { if (typeof document !== 'undefined') document.documentElement.classList.toggle('modo-sol', !!on); };
  aplicar(leer());
  function alternar() { const on = !leer(); try { localStorage.setItem(K, on ? '1' : '0'); } catch (e) {} aplicar(on); return on; }
  return { activo: leer, alternar };
})();
/* v137 · Dictado por voz: el trabajador habla y el texto se escribe solo (más detalle, menos «todo bien»).
   Usa el reconocimiento de voz del navegador del celular (Chrome en Android, Safari en iPhone). */
const MIC_SVG = '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const Dictado = (function () {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  let rec = null, activo = null, boton = null;
  function parar() { try { if (rec) rec.stop(); } catch (e) {} }
  function fin() { if (boton) { boton.innerHTML = MIC_SVG + 'Dictar'; boton.classList.remove('oyendo'); } activo = null; boton = null; rec = null; }
  function alternar(campo, b) {
    if (activo === campo) { parar(); return; }
    parar();
    try {
      rec = new SR(); rec.lang = 'es-CO'; rec.interimResults = false; rec.continuous = true; rec.maxAlternatives = 1;
      activo = campo; boton = b; b.innerHTML = MIC_SVG + 'Escuchando… toca para parar'; b.classList.add('oyendo');
      rec.onresult = (e) => {
        let txt = ''; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) txt += e.results[i][0].transcript;
        txt = txt.trim(); if (!txt) return;
        const v = campo.value; campo.value = v + (v && !/\s$/.test(v) ? ' ' : '') + txt.charAt(0).toUpperCase() + txt.slice(1);
        campo.dispatchEvent(new Event('input', { bubbles: true })); campo.dispatchEvent(new Event('change', { bubbles: true }));
      };
      rec.onerror = (e) => { if (e && e.error === 'not-allowed' && typeof UI !== 'undefined' && UI.toast) UI.toast('Para dictar, permite el micrófono en el navegador.', 'mal'); };
      rec.onend = fin;
      rec.start();
    } catch (e) { fin(); }
  }
  return { disponible: !!SR, alternar };
})();
/* ================= v140 · ACCESIBILIDAD =================
   · Letra: A− A A+ (se recuerda en el celular y aplica en todas las páginas).
   · Leer: botón «Escuchar» arriba en cada página; el celular lee en voz alta lo que
     se ve (o la ventana abierta), sin internet ni app aparte.
   · FirmaAlterna: para quien no puede trazar la firma (visión, lesión en la mano):
     firma con nombre y cédula; queda como imagen con la marca «sin trazo» y el
     servidor la sella igual que cualquier firma (hora, equipo, código). */
const Letra = (function () {
  const K = 'ssta-letra', NIV = ['', 'letra-1', 'letra-2'];
  const leer = () => { try { const n = Number(localStorage.getItem(K) || 0); return n >= 0 && n <= 2 ? n : 0; } catch (e) { return 0; } };
  const aplicar = (n) => { if (typeof document === 'undefined') return; NIV.forEach((c) => c && document.documentElement.classList.remove(c)); if (NIV[n]) document.documentElement.classList.add(NIV[n]); };
  aplicar(leer());
  function poner(n) { n = Math.max(0, Math.min(2, n)); try { localStorage.setItem(K, String(n)); } catch (e) {} aplicar(n); return n; }
  return { nivel: leer, poner, mas: () => poner(leer() + 1), menos: () => poner(leer() - 1) };
})();
const Leer = (function () {
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  let boton = null, hablando = false;
  const SVG = '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  function textoDe(raiz) {
    const partes = [];
    const recorrer = (n) => {
      if (n.nodeType === 3) { const t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) partes.push(t); return; }
      if (n.nodeType !== 1) return;
      const el = n; if (el.hidden || el.getAttribute('aria-hidden') === 'true' || /^(SCRIPT|STYLE|SVG|svg|TEMPLATE|NOSCRIPT|DATALIST|OPTION)$/.test(el.tagName)) return;
      if (el.matches('.btn-leer,.btn-mic,.btn-firma-alt,.saltar-contenido,.barra-inferior,#sstaTrampa')) return;
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
      if (el.matches('input,textarea,select')) { const t = (el.type || '').toLowerCase(); if (/hidden|password|file|button|submit/.test(t)) return;
        const v = t === 'checkbox' || t === 'radio' ? (el.checked ? 'marcado' : 'sin marcar') : (el.tagName === 'SELECT' ? ((el.selectedOptions[0] || {}).textContent || '') : el.value);
        partes.push(v ? '(' + v + ')' : '(vacío)'); return; }
      if (el.tagName === 'CANVAS') { partes.push(el._pad && el._pad.hasInk && el._pad.hasInk() ? '(firmado)' : '(sin firmar)'); return; }
      el.childNodes.forEach(recorrer);
      if (/^(P|DIV|LI|H1|H2|H3|H4|TR|LABEL|BUTTON|SECTION)$/.test(el.tagName)) partes.push('.');
    };
    recorrer(raiz);
    return partes.join(' ').replace(/(\s*\.\s*)+/g, '. ').replace(/\s+([,.;:])/g, '$1').trim();
  }
  function zona() {
    const ms = document.querySelectorAll('.modal-fondo .modal, .dlg-fondo .dlg'); if (ms.length) return ms[ms.length - 1];
    return document.querySelector('.screen.active') || document.querySelector('main, [role="main"]') || document.body;
  }
  function parar() { try { speechSynthesis.cancel(); } catch (e) {} hablando = false; if (boton) { boton.innerHTML = SVG + '<span>Escuchar</span>'; boton.setAttribute('aria-pressed', 'false'); } }
  function leer(texto, b) {
    if (!ok) return false;
    parar(); if (b) boton = b;
    const trozos = String(texto || '').match(/[^.!?]{1,220}[.!?]?/g) || [];
    if (!trozos.length) return false;
    hablando = true; if (boton) { boton.innerHTML = SVG + '<span>Parar</span>'; boton.setAttribute('aria-pressed', 'true'); }
    const voces = speechSynthesis.getVoices().filter((v) => /^es/i.test(v.lang)), voz = voces.find((v) => /CO|419|MX|US/i.test(v.lang)) || voces[0];
    trozos.forEach((t, i) => { const u = new SpeechSynthesisUtterance(t.trim()); u.lang = voz ? voz.lang : 'es-CO'; if (voz) u.voice = voz; u.rate = 0.95; if (i === trozos.length - 1) u.onend = () => parar(); speechSynthesis.speak(u); });
    return true;
  }
  function alternar(b) { if (hablando) { parar(); return; } leer(textoDe(zona()), b); }
  function montar() {
    if (!ok || document.querySelector('.btn-leer[data-global]') || document.documentElement.hasAttribute('data-sin-leer')) return;
    const h = document.querySelector('.hdr'); if (!h) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-leer'; b.dataset.global = '1'; b.setAttribute('aria-pressed', 'false');
    b.title = 'El celular lee en voz alta lo que hay en la pantalla'; b.innerHTML = SVG + '<span>Escuchar</span>';
    b.addEventListener('click', () => alternar(b));
    const t = h.querySelector('h1'); (t && t.parentElement ? t.parentElement : h).appendChild(b);
    window.addEventListener('pagehide', parar);
  }
  return { disponible: ok, leer, parar, alternar, textoDe, montar };
})();
/* v159 · Mi firma: quien entra con su usuario guarda su firma UNA vez en su equipo y la pone con un toque
   (con confirmación). No viaja a ningún lado hasta que se usa en un registro; al cerrar sesión se puede borrar. */
const MiFirma = (function () {
  const yo = () => (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || null;
  const clave = () => { const y = yo(); return y ? 'ssta-mi-firma-' + String(y.usuario || y.nombre || '').toLowerCase() : ''; };
  const leer = () => { try { return clave() ? localStorage.getItem(clave()) || '' : ''; } catch (e) { return ''; } };
  const disponible = () => !!yo();
  function boton(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt btn-mi-firma';
    const pinta = () => { b.textContent = leer() ? '✍ Poner mi firma' : '✍ Guardar como mi firma'; };
    pinta();
    b.addEventListener('click', async () => {
      const pad = c._pad; if (!pad) return; const guardada = leer();
      if (!guardada) {
        const u = pad.getDataUrl && pad.getDataUrl();
        if (!u) { await Dialogo.avisar('Firma una vez en el recuadro y vuelve a tocar «Guardar como mi firma». Desde ahí la pones con un toque en cualquier formulario de este equipo.'); return; }
        if (!await Dialogo.confirmar('¿Guardar esta firma como la de ' + yo().nombre + ' en este equipo? Solo se usa cuando tú la pongas.')) return;
        try { localStorage.setItem(clave(), u); } catch (e) {} pinta(); if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ Firma guardada en este equipo'); return;
      }
      if (!await Dialogo.confirmar('¿Firmar como ' + yo().nombre + '?')) return;
      pad.setDataUrl(guardada); c.dataset.miFirma = '1';
      c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return b;
  }
  function borrar() { try { localStorage.removeItem(clave()); } catch (e) {} }
  return { disponible, leer, boton, borrar };
})();
const FirmaAlterna = (function () {
  const mapa = new Map();
  function imagen(nombre, cedula) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 170; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#10213a'; x.lineWidth = 2; x.strokeRect(4, 4, c.width - 8, c.height - 8);
    x.fillStyle = '#10213a'; x.font = 'bold 34px Arial, sans-serif'; x.fillText(nombre.slice(0, 34), 20, 60);
    x.font = '24px Arial, sans-serif'; x.fillText('C.C. ' + cedula, 20, 100);
    const d = new Date(); x.font = '18px Arial, sans-serif'; x.fillStyle = '#333';
    x.fillText('Firma sin trazo (nombre y cédula) · ' + d.toLocaleDateString('es-CO') + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), 20, 142);
    return c.toDataURL('image/png');
  }
  async function pedir(canvas) {
    const pad = canvas && canvas._pad; if (!pad || typeof Dialogo === 'undefined') return false;
    const nombre = await Dialogo.pedir('Firmar sin dibujar.\nEscribe el nombre completo de quien firma (o díctalo):', ''); if (!nombre || nombre.trim().length < 5) return false;
    let ced = await Dialogo.pedir('Cédula de ' + nombre.trim() + ' (solo números):', ''); ced = String(ced || '').replace(/\D/g, '');
    if (ced.length < 5 || ced.length > 12) { if (ced) Dialogo.avisar('La cédula debe tener entre 5 y 12 números. No se firmó.'); return false; }
    const si = await Dialogo.confirmar('¿' + nombre.trim() + ', C.C. ' + ced + ', confirma que firma este documento?\nQueda con la hora del servidor, el equipo y un código de verificación, igual que una firma a mano.');
    if (!si) return false;
    pad.setDataUrl(imagen(nombre.trim(), ced)); canvas.dataset.firmaAlterna = ced; canvas.dataset.altNombre = nombre.trim().slice(0, 100);
    // v141: lo que exporte este recuadro queda anotado como «sin trazo» (viaja al sello del servidor).
    if (!pad._altEnvuelto) {
      pad._altEnvuelto = true;
      const g = pad.getDataUrl, cl = pad.clear;
      pad.getDataUrl = function () { const u = g.apply(this, arguments); if (u && canvas.dataset.firmaAlterna) mapa.set(u, { nombre: canvas.dataset.altNombre, cedula: canvas.dataset.firmaAlterna }); return u; };
      if (cl) pad.clear = function () { delete canvas.dataset.firmaAlterna; delete canvas.dataset.altNombre; return cl.apply(this, arguments); };
      canvas.addEventListener('pointerdown', () => { delete canvas.dataset.firmaAlterna; delete canvas.dataset.altNombre; });
    }
    canvas.dispatchEvent(new Event('input', { bubbles: true })); canvas.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof AutoGuardado !== 'undefined' && AutoGuardado.marcar) AutoGuardado.marcar(canvas);
    return true;
  }
  return { pedir, imagen, _mapa: mapa };
})();
/* v174 · Subir la firma: una foto o un escaneo de la firma de la persona (papel blanco, tinta oscura).
   Se limpia el fondo (lo claro queda blanco y el trazo en tinta) y se pone en el recuadro, como si la hubiera trazado. */
const SubirFirma = (function () {
  function limpiar(img) {
    const W = 640, H = 200, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const k = Math.min((W - 20) / img.width, (H - 20) / img.height, 4), w = img.width * k, h = img.height * k;
    x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const d = x.getImageData(0, 0, W, H), p = d.data;
    let tinta = 0;
    for (let i = 0; i < p.length; i += 4) {
      const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      if (l > 170) { p[i] = p[i + 1] = p[i + 2] = 255; } else { p[i] = 16; p[i + 1] = 33; p[i + 2] = 58; tinta++; }
      p[i + 3] = 255;
    }
    x.putImageData(d, 0, 0);
    return tinta > 60 ? c.toDataURL('image/png') : '';
  }
  function leerArchivo(f) {
    return new Promise((ok, mal) => {
      const r = new FileReader(); r.onerror = () => mal(new Error('No se pudo leer la imagen.'));
      r.onload = () => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('Ese archivo no es una imagen.')); im.src = r.result; };
      r.readAsDataURL(f);
    });
  }
  function boton(c) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt btn-subir-firma'; b.textContent = 'Subir firma (foto)';
    b.setAttribute('aria-label', 'Subir una foto o un escaneo de la firma');
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true;
    b.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { Dialogo.avisar('La imagen pesa más de 8 MB. Toma la foto más de cerca o recórtala.'); return; }
      try {
        const u = limpiar(await leerArchivo(f));
        if (!u) { Dialogo.avisar('No se ve la firma en esa imagen. Usa una foto de la firma en papel blanco, con buena luz y de cerca.'); return; }
        const pad = c._pad; if (!pad) return;
        pad.setDataUrl(u); c.dataset.firmaSubida = '1';
        c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof AutoGuardado !== 'undefined' && AutoGuardado.marcar) AutoGuardado.marcar(c);
        if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ Firma puesta. Revísala antes de guardar.');
      } catch (e) { Dialogo.avisar(e.message); }
    });
    const w = document.createElement('span'); w.className = 'subir-firma'; w.appendChild(b); w.appendChild(inp);
    return w;
  }
  return { boton, limpiar };
})();
const Accesible = (function () {
  if (typeof document === 'undefined') return {};
  const NOMBRE_ICONO = { ayuda: 'Ayuda', actividad: 'Estado', tablero: 'Gestión', cerrar: 'Cerrar', lupa: 'Buscar', engranaje: 'Configuración', candado: 'Clave', persona: 'Mi usuario',
    imprimir: 'Imprimir', lapiz: 'Editar', camara: 'Foto', 'flecha-arriba': 'Subir', calendario: 'Calendario', llave: 'Clave', chevron: 'Abrir', externo: 'Abrir en otra pestaña' };
  const css = document.createElement('style'); css.id = 'estiloAccesible';
  css.textContent =
    ':where(a,button,summary,select,textarea,input,[role="button"],[tabindex]):focus-visible{outline:3px solid var(--foco,var(--azul));outline-offset:2px;border-radius:var(--r-s,8px);}' +
    ':where(a,button,summary,[role="button"]):focus:not(:focus-visible){outline:none;}' +
    '.solo-lector{position:absolute !important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}' +
    /* Esqueleto de carga: barras grises que «respiran» con la forma de la lista que viene. */
    '.esq{display:flex;flex-direction:column;gap:10px;padding:2px 0;}' +
    '.esq-it{background:var(--paper,#fff);border:1px solid var(--line,var(--line));border-radius:var(--r-l,16px);padding:14px 16px;display:flex;flex-direction:column;gap:9px;}' +
    '.esq-b{height:12px;border-radius:var(--r-pill,999px);background:linear-gradient(90deg,var(--n-150) 0%,var(--n-50) 45%,var(--n-150) 90%);background-size:220% 100%;animation:esqBrillo 1.3s ease-in-out infinite;}' +
    '.esq-b.t{height:15px;width:58%;}.esq-b.m{width:86%;}.esq-b.c{width:40%;}' +
    '@keyframes esqBrillo{0%{background-position:120% 0}100%{background-position:-120% 0}}' +
    '.saltar-contenido{position:absolute;left:8px;top:-60px;z-index:100001;background:var(--tinta);color:#fff;padding:10px 16px;border-radius:var(--r-s,8px);font-weight:800;text-decoration:none;}.saltar-contenido:focus{top:8px;}' +
    '.btn-firma-alt{min-height:40px;padding:0 12px;border-radius:var(--r-pill,999px);border:1.5px solid var(--line);background:#fff;font:inherit;font-weight:700;font-size:var(--fs-menor,13px);cursor:pointer;margin:6px 6px 0 0;}' +
    '.chip.ok::before{content:"\\2713\\00a0";}.chip.mal::before{content:"\\2715\\00a0";}.chip.pronto::before{content:"!\\00a0";font-weight:900;}' +
    '@media (pointer:coarse){:where(.btn,button.btn,.btn-sec,.btn-mic,.ag-falta-item,.sig-actions button,.chips button,.seg-btn button,.tabs button,.back){min-height:44px;}:where(input[type=checkbox],input[type=radio]){min-width:22px;min-height:22px;}}' +
    '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;scroll-behavior:auto !important;}}';
  (document.head || document.documentElement).appendChild(css);

  const tieneNombre = (el) => !!((el.getAttribute('aria-label') || '').trim() || el.getAttribute('aria-labelledby') || (el.textContent || '').trim() ||
    [...el.querySelectorAll('img[alt]')].some((i) => i.alt.trim()));
  function nombreDe(el) {
    if (el.title && el.title.trim()) return el.title.trim();
    const u = el.querySelector('use'); const h = u && (u.getAttribute('href') || u.getAttribute('xlink:href') || '');
    const k = (/#i-([a-z-]+)/.exec(h) || [])[1]; if (k && NOMBRE_ICONO[k]) return NOMBRE_ICONO[k];
    if (el.classList.contains('marca')) return 'Logo de la empresa';
    return '';
  }
  function esqueleto(n) {
    let h = '<div class="esq" aria-busy="true"><span class="solo-lector">Cargando…</span>';
    for (let i = 0; i < (n || 4); i++) h += '<div class="esq-it" aria-hidden="true"><span class="esq-b t"></span><span class="esq-b m"></span><span class="esq-b c"></span></div>';
    return h + '</div>';
  }
  const CARGANDO = /^\s*(Cargando|Abriendo)(…|\.\.\.)?\s*$/;
  function revisar(raiz) {
    // v143: «← Volver» que no navega (href="#") es un botón para el lector de pantalla
    try { (raiz.querySelectorAll ? raiz : document).querySelectorAll('a[href="#"][data-volver]:not([role])').forEach((a) => a.setAttribute('role', 'button')); } catch (e) {}
    const r = raiz && raiz.querySelectorAll ? raiz : document;
    // Botones y enlaces solo con ícono
    r.querySelectorAll('button, a[href], summary, [role="button"]').forEach((el) => {
      if (el.dataset.a11y) return; el.dataset.a11y = '1';
      el.querySelectorAll('svg:not([aria-hidden])').forEach((s) => { if (!s.getAttribute('aria-label') && !s.querySelector('title')) s.setAttribute('aria-hidden', 'true'); });
      if (!tieneNombre(el)) { const n = nombreDe(el); if (n) el.setAttribute('aria-label', n); }
    });
    // v132: campos con su etiqueta conectada (el lector la lee y tocar la etiqueta enfoca el campo)
    r.querySelectorAll('input:not([type=hidden]):not([data-a11y]), select:not([data-a11y]), textarea:not([data-a11y])').forEach((el) => {
      el.dataset.a11y = '1';
      if (el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')) || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return;
      const caja = el.closest('.field, .campo, .fila-campo');
      const lb = caja && [...caja.querySelectorAll('label')].find((l) => !l.htmlFor && !l.querySelector('input,select,textarea') && (l.textContent || '').trim());
      if (lb && caja.querySelectorAll('input:not([type=hidden]),select,textarea').length === 1) {
        if (!el.id) el.id = 'cmp' + Math.random().toString(36).slice(2, 9);
        lb.htmlFor = el.id; return;
      }
      const ph = (el.getAttribute('placeholder') || '').trim();
      const op0 = el.tagName === 'SELECT' && el.options.length && el.options[0].value === '' ? (el.options[0].textContent || '').trim() : '';   // «Todos los orígenes»
      const celda = el.closest('[data-l]'), fila = el.closest('tr'), cab = fila && fila.querySelector('td,th');
      const deCelda = celda ? celda.getAttribute('data-l') + (cab && cab !== celda && (cab.textContent || '').trim() ? ' · ' + (cab.textContent || '').trim().slice(0, 40) : '') : '';
      const vecino = !lb && !ph && el.type === 'file' ? ((el.closest('label') || el.parentElement || {}).textContent || '').trim().slice(0, 60) || 'Elegir archivo' : '';
      const txt = lb ? (lb.textContent || '').trim() : (ph || op0 || (el.title || '').trim() || deCelda || vecino);
      if (txt) el.setAttribute('aria-label', txt.replace(/\s*\*\s*$/, ''));
    });
    // v140: el error queda ligado a su campo (el lector lo dice al entrar al campo)
    r.querySelectorAll('.error-txt, .v-msg, .field-error').forEach((m) => {
      const caja = m.closest('.field, .campo') || m.parentElement; if (!caja) return;
      const f = caja.querySelector('input:not([type=hidden]),select,textarea') || (m.previousElementSibling && m.previousElementSibling.matches('input,select,textarea') ? m.previousElementSibling : null);
      if (!f) return; if (!m.id) m.id = 'err' + Math.random().toString(36).slice(2, 8);
      const d = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean); if (d.indexOf(m.id) === -1) d.push(m.id);
      f.setAttribute('aria-describedby', d.join(' ')); f.setAttribute('aria-invalid', 'true');
    });
    document.querySelectorAll('[aria-invalid="true"]').forEach((f) => {
      const ids = (f.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean), vivos = ids.filter((i) => { const m = document.getElementById(i); return m && (m.textContent || '').trim() && m.offsetParent !== null; });
      const marcado = f.classList.contains('field-invalid') || f.classList.contains('v-falta') || (f.closest('.field') && f.closest('.field').classList.contains('field-invalid'));
      if (!vivos.length && !marcado) f.removeAttribute('aria-invalid');
    });
    r.querySelectorAll('.field-invalid input:not([aria-invalid]), input.field-invalid:not([aria-invalid]), .v-falta:not([aria-invalid])').forEach((f) => f.setAttribute('aria-invalid', 'true'));
    // v140: «Firmar sin dibujar» junto a cada recuadro de firma
    r.querySelectorAll('canvas').forEach((c) => {
      // v143: el recuadro de firma tiene nombre y estado para el lector de pantalla
      if (c._pad && !c.dataset.completa && !c.hasAttribute('role')) {
        c.setAttribute('role', 'img');
        const caja = c.closest('.field, .sig-block, .firma, .card') || c.parentElement, lb = caja && caja.querySelector('label, .sig-label, h3, h2');
        const st = document.getElementById('status_' + c.id) || (caja && caja.querySelector('.sig-status'));
        if (lb) { if (!lb.id) lb.id = 'lb_' + c.id; }
        if (st) { if (!st.id) st.id = 'st_' + c.id; st.setAttribute('aria-live', 'polite'); }
        const ids = [lb && lb.id, st && st.id].filter(Boolean);
        if (ids.length) c.setAttribute('aria-labelledby', ids.join(' ')); else c.setAttribute('aria-label', 'Recuadro de firma');
      }
      if (c.dataset.altFirma || !c._pad || c.dataset.completa || c.closest('[data-sin-firma-alt]')) return;
      c.dataset.altFirma = '1';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-firma-alt'; b.textContent = 'Firmar sin dibujar';
      b.setAttribute('aria-label', 'Firmar sin dibujar (con nombre y cédula), para quien no puede trazar la firma');
      b.addEventListener('click', () => FirmaAlterna.pedir(c));
      const acc = c.nextElementSibling && c.nextElementSibling.classList && c.nextElementSibling.classList.contains('sig-actions') ? c.nextElementSibling : null;
      if (acc) acc.appendChild(b); else c.insertAdjacentElement('afterend', b);
      if (typeof MiFirma !== 'undefined' && MiFirma.disponible()) { const m = MiFirma.boton(c); if (acc) acc.appendChild(m); else b.insertAdjacentElement('afterend', m); }
      { const sf = SubirFirma.boton(c); if (acc) acc.appendChild(sf); else b.insertAdjacentElement('afterend', sf); }   // v174
    });
    // Mensajes que se anuncian
    r.querySelectorAll('.status-msg:not([aria-live]), #msgNuevo:not([aria-live])').forEach((el) => el.setAttribute('aria-live', 'polite'));
    r.querySelectorAll('.toast:not([role])').forEach((el) => { el.setAttribute('role', el.classList.contains('mal') ? 'alert' : 'status'); });
    // «Cargando…» → esqueleto
    r.querySelectorAll('.empty').forEach((el) => { if (!el.dataset.esq && el.children.length === 0 && CARGANDO.test(el.textContent)) { el.dataset.esq = '1'; el.classList.remove('empty'); el.innerHTML = esqueleto(4); } });
    // v133: pantalla vacía que dice qué hacer: si hay un botón «+ …» visible en la misma pantalla, se ofrece ahí
    r.querySelectorAll('.empty:not([data-cta])').forEach((el) => {
      if (el.querySelector('button,a') || !/^\s*(Sin |No hay |Aún no |Todavía no )/.test(el.textContent)) return;
      el.dataset.cta = '1';
      const caja = el.closest('.screen, section, main, .card') || document.body;
      const b = [...caja.querySelectorAll('button, a.btn')].find((x) => /^\s*\+/.test(x.textContent) && x.offsetParent !== null && !x.disabled && !el.contains(x));
      if (!b) return;
      const c = document.createElement('button'); c.type = 'button'; c.className = 'btn btn-cta-vacio'; c.textContent = b.textContent.trim();
      c.style.cssText = 'display:block;margin:12px auto 0;'; c.addEventListener('click', () => b.click());
      el.appendChild(c);
    });
    // v137: dictado por voz al lado de cada campo de texto largo (si el celular lo permite)
    if (Dictado.disponible) r.querySelectorAll('textarea:not([data-mic]):not([readonly]):not([disabled])').forEach((t) => {
      if (t.closest('[data-sin-mic]') || t.offsetParent === null) return;
      t.dataset.mic = '1';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-mic'; { const lt = (t.id && document.querySelector('label[for="' + t.id + '"]')) || (t.closest('.field') && t.closest('.field').querySelector('label')); const nm = ((lt && lt.textContent) || t.getAttribute('aria-label') || t.placeholder || '').replace(/[*:]/g, '').trim().slice(0, 50); b.setAttribute('aria-label', nm ? 'Dictar: ' + nm : 'Dictar con la voz'); } b.innerHTML = MIC_SVG + 'Dictar';   // v143: se sabe a qué campo dicta (v145: el texto del botón había quedado comentado)
      b.addEventListener('click', () => Dictado.alternar(t, b));
      t.insertAdjacentElement('afterend', b);
    });
    // Ventanas como diálogos
    r.querySelectorAll('.modal-fondo > .modal:not([role])').forEach((m) => {
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
      const t = m.querySelector('h1,h2,h3'); if (t) { if (!t.id) t.id = 'dlg' + Math.random().toString(36).slice(2, 8); m.setAttribute('aria-labelledby', t.id); }
      setTimeout(() => { if (!m.contains(document.activeElement)) { const f = m.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not([disabled])'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} } }, 60);
    });
  }
  // v134: campo trampa para robots (las personas no lo ven ni lo alcanzan con el teclado)
  function trampa() { if (document.getElementById('sstaTrampa') || !document.body) return; const d = document.createElement('div'); d.id = 'sstaTrampa'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
    d.innerHTML = '<label for="sitio_web">Sitio web</label><input id="sitio_web" name="sitio_web" type="text" tabindex="-1" autocomplete="off" data-sin-valida="1">'; document.body.appendChild(d); }
  let pend = false;
  // v144: solo se revisa lo que se agregó (antes, todo el documento en cada cambio: tareas de hasta 0,5 s
  // al pintar listas grandes en celulares lentos), y cuando el celular está libre.
  const raices = new Set();
  function programar(ms) {
    (ms || []).forEach((m) => m.addedNodes && m.addedNodes.forEach((n) => { if (n.nodeType === 1) raices.add(n); else if (m.target && m.target.nodeType === 1) raices.add(m.target); }));   // v145: también cambios de texto
    if (pend) return; pend = true;
    const correr = () => {
      pend = false;
      const l = [...raices].filter((n) => n.isConnected); raices.clear();
      const top = l.filter((n) => !l.some((o) => o !== n && o.contains(n)));
      if (top.length > 40) { revisar(document); radios(document); return; }
      top.forEach((n) => { const p = n.parentElement || n; revisar(p); radios(p); });   // el padre: así se revisa también el nodo agregado
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(correr, { timeout: 300 }); else requestAnimationFrame(correr);
  }
  // v140: zona principal marcada y «Saltar al contenido» (lector de pantalla y teclado)
  function principal() {
    let m = document.querySelector('main, [role="main"]');
    if (!m) { const vis = (x) => x && x.offsetParent !== null; m = [...document.querySelectorAll('body > .wrap, body > .container, body > .app, .wrap')].find(vis) || [...document.body.children].find((x) => /^(DIV|SECTION)$/.test(x.tagName) && !x.id.startsWith('ssta') && vis(x) && x.querySelector('h1,h2,form,.card')); if (m) m.setAttribute('role', 'main'); }
    if (!m) return;
    // v154: si la página ya usa id="contenido" (informe, plan anual, evidencias, cierre de mes), no se repite:
    // con dos iguales, la página reemplazaba TODO (cabecera y selector) al pintar su contenido.
    if (!m.id) m.id = document.getElementById('contenido') ? 'contenido-principal' : 'contenido';
    if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1');
    if (!document.getElementById('saltarContenido')) {
      const a = document.createElement('a'); a.id = 'saltarContenido'; a.className = 'saltar-contenido'; a.href = '#' + m.id; a.textContent = 'Saltar al contenido';
      a.addEventListener('click', (e) => { e.preventDefault(); try { m.focus({ preventScroll: false }); } catch (er) { m.focus(); } });
      document.body.insertBefore(a, document.body.firstChild);
    }
  }
  // v143: (1) en los grupos de opciones de una sola respuesta (role=radiogroup) cada botón dice si está elegido;
  // (2) al cambiar de pantalla (.screen.active) el foco va al título de la pantalla nueva (antes se perdía).
  function radios(raiz) {
    const base = raiz && raiz.querySelectorAll ? (raiz.closest && raiz.closest('[role="radiogroup"]') ? raiz.closest('[role="radiogroup"]') : raiz) : document;
    [...base.querySelectorAll('[role="radiogroup"] > button, [role="radiogroup"] > * > button')].concat(base.matches && base.matches('[role="radiogroup"]') ? [...base.querySelectorAll(':scope > button, :scope > * > button')] : []).forEach((b) => {
      const g = b.closest('[role="radiogroup"]'); if (g.querySelector('input')) return;
      if (b.getAttribute('role') !== 'radio') b.setAttribute('role', 'radio');
      const on = b.classList.contains('on') || b.classList.contains('sel') || b.getAttribute('aria-pressed') === 'true';
      if (b.getAttribute('aria-checked') !== String(on)) b.setAttribute('aria-checked', String(on));
    });
  }
  function alCambiarClase(ms) {
    let r = false;
    ms.forEach((m) => {
      const t = m.target; if (t.closest && t.closest('[role="radiogroup"]')) r = true;
      if (t.classList && t.classList.contains('screen') && t.classList.contains('active') && !(m.oldValue || '').split(' ').includes('active')) {
        const a = document.activeElement;
        try { revisar(t); radios(t); } catch (e) {}   // v145: lo que estaba oculto se revisa al mostrarse (dictar, etiquetas, firmas)
        if (!a || a === document.body || !t.contains(a)) { const h = t.querySelector('h1, h2'); if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) {} } }
      }
    });
    if (r) radios(document);
  }
  const iniciar = () => { trampa(); principal(); revisar(document); radios(document); Leer.montar(); new MutationObserver(programar).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(alCambiarClase).observe(document.body, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  // Escape cierra la ventana de arriba (si tiene botón para cerrarse).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const fs = document.querySelectorAll('body > .modal-fondo'); const f = fs[fs.length - 1]; if (!f) return;
    const c = f.querySelector('[data-cerrar]'); if (c) { e.preventDefault(); c.click(); }
  });
  return { revisar, esqueleto };
})();

