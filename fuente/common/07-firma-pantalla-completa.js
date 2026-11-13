/* ============================================================
 * AnclaGiro: al girar el celular, la pantalla vuelve sola a donde estaba.
 * ------------------------------------------------------------
 * Al pasar de vertical a horizontal (o al revés) el alto de toda la página
 * cambia y el navegador pierde la posición: quedas en otra parte del permiso
 * y toca buscar otra vez el recuadro de la firma.
 *
 * La versión anterior (v62) fallaba por tres motivos, y los tres se
 * reprodujeron en pruebas antes de corregir:
 *  1. Recordaba el último lienzo TOCADO: si alguien ya había firmado el
 *     recuadro de otro ejecutante, al girar mandaba a ese, lejos del actual.
 *  2. Si no se había tocado ninguno, se anclaba a una sección entera, y
 *     "centrar" una sección de 3 pantallas de alto deja cualquier cosa a la vista.
 *  3. Corregía a los 120 y 370 ms; en Android el giro puede terminar después
 *     y el navegador deshacía la corrección.
 *
 * Ahora:
 *  - Se recuerda lo que SE ESTÁ VIENDO, actualizado cada vez que la pantalla
 *    queda quieta: primero un recuadro de firma visible; si no hay, el campo
 *    más cercano al centro (nunca un bloque más alto que media pantalla).
 *  - El giro se detecta por la orientación real del aparato, no por el alto
 *    de la ventana: abrir el teclado encoge la ventana y no debe contar.
 *  - Se vuelve al punto varias veces durante 1,5 s mientras el giro termina
 *    de acomodarse, y se deja de insistir en cuanto la persona toca la pantalla.
 * ============================================================ */
const AnclaGiro = (() => {
  const SEL_FIRMA = 'canvas.pad, canvas.sigpad, canvas.mini-pad';
  const SEL_CAMPO = SEL_FIRMA + ', .field, .epp-item, .close-q, .check-item, .exec-card, h2, h3, .section-title';
  const REINTENTOS_MS = [0, 120, 300, 550, 900, 1500];
  let ancla = null;
  let ultimoTocado = null;
  let restaurando = false;
  let timers = [];
  let orientacion = null;
  let esperaScroll = null;

  function orientacionActual() {
    if (screen.orientation && screen.orientation.type) return screen.orientation.type.indexOf('portrait') === 0 ? 'v' : 'h';
    if (typeof window.orientation === 'number') return Math.abs(window.orientation) === 90 ? 'h' : 'v';
    return window.innerWidth > window.innerHeight ? 'h' : 'v';
  }
  function enPantalla(el) {
    if (!el || !document.body.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }
  function masCercanoAlCentro(selector, altoMax) {
    const centro = window.innerHeight / 2;
    let mejor = null, mejorDist = Infinity;
    document.querySelectorAll(selector).forEach((el) => {
      if (!enPantalla(el)) return;
      const r = el.getBoundingClientRect();
      if (altoMax && r.height > altoMax) return;
      const d = Math.abs(r.top + r.height / 2 - centro);
      if (d < mejorDist) { mejorDist = d; mejor = el; }
    });
    return mejor;
  }
  function elegir() {
    // El recuadro que se acaba de tocar manda, pero SOLO si sigue a la vista:
    // si la persona bajó a otro ejecutante, ese ya no cuenta.
    if (enPantalla(ultimoTocado)) return ultimoTocado;
    return masCercanoAlCentro(SEL_FIRMA) || masCercanoAlCentro(SEL_CAMPO, window.innerHeight * 0.5);
  }
  function registrar() {
    if (restaurando) return;
    const el = elegir();
    if (el) ancla = el;
  }
  function detener() {
    timers.forEach(clearTimeout);
    timers = [];
    restaurando = false;
  }
  function alGirar() {
    const nueva = orientacionActual();
    if (nueva === orientacion && restaurando) return; // ya se está corrigiendo este giro
    orientacion = nueva;
    const objetivo = ancla;
    detener();
    if (!objetivo || !document.body.contains(objetivo)) return;
    restaurando = true;
    REINTENTOS_MS.forEach((ms, i) => {
      timers.push(setTimeout(() => {
        if (document.body.contains(objetivo)) objetivo.scrollIntoView({ block: 'center', behavior: 'auto' });
        if (i === REINTENTOS_MS.length - 1) {
          restaurando = false;
          registrar();
        }
      }, ms));
    });
  }

  function init() {
    orientacion = orientacionActual();
    registrar();
    // La posición se anota cuando la pantalla queda quieta. La espera también
    // protege contra el propio giro: el navegador mueve la página al empezar
    // a girar, y para cuando esta anotación se ejecutaría, ya se sabe que es
    // un giro y se ignora.
    window.addEventListener('scroll', () => {
      clearTimeout(esperaScroll);
      esperaScroll = setTimeout(registrar, 200);
    }, { passive: true });
    document.addEventListener('touchstart', (e) => {
      // Si la persona toca la pantalla mientras se corrige, manda ella.
      if (restaurando) detener();
      const c = e.target && e.target.closest ? e.target.closest(SEL_FIRMA) : null;
      if (c) { ultimoTocado = c; ancla = c; }
    }, { passive: true, capture: true });
    const revisar = () => { if (orientacionActual() !== orientacion) alGirar(); };
    window.addEventListener('orientationchange', alGirar);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', revisar);
    window.addEventListener('resize', revisar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { _estado: () => ({ ancla, restaurando, orientacion }) };
})();

/* ============================================================
 * FirmaCompleta: en celular, la firma se hace a pantalla completa.
 * ------------------------------------------------------------
 * En un celular el recuadro de firma es angosto, y la solución de siempre
 * era girar el teléfono… con lo que la página entera se reacomodaba y había
 * que volver a buscar el recuadro. Llevamos varias versiones corrigiendo los
 * efectos del giro; esto ataca la causa: al tocar el recuadro se abre un
 * lienzo que ocupa toda la pantalla, sin nada detrás que se mueva. Se firma,
 * se toca "Listo", la firma pasa al recuadro y la pantalla queda ahí mismo.
 *
 * - Solo en celulares (pantalla táctil con el lado corto menor a 600 px). En
 *   tablet y computador el recuadro normal ya es cómodo y no cambia nada.
 * - La firma pasa como trazos, no como imagen: no pierde calidad ni se
 *   deforma, aunque se haya hecho en horizontal y el recuadro sea vertical.
 * - Si el recuadro ya traía una firma guardada, "Listo" sin dibujar la deja
 *   como estaba: no se puede borrar una firma sin querer.
 * - El botón "atrás" de Android cierra la firma en vez de salir del permiso.
 * ============================================================ */
const FirmaCompleta = (() => {
  const MQ = '(pointer: coarse) and (max-width: 599px), (pointer: coarse) and (max-height: 599px)';
  let el = null, pad = null, destino = null, destinoPad = null;
  let abierta = false, empujado = false, ignorarPop = false, teniaBase = false;

  function usar() {
    return !!(window.matchMedia && window.matchMedia(MQ).matches);
  }

  /** Nombre de quien firma, tomado del mismo bloque del recuadro. */
  function nombreFirmante(canvas) {
    const bloque = canvas.closest('.exec-card, tr, .sig-block, .sig-pad-wrap, .field, section') || canvas.parentElement;
    let b = bloque;
    // Sube hasta 3 niveles buscando un campo de nombre con algo escrito.
    for (let i = 0; i < 3 && b; i++, b = b.parentElement) {
      const inp = Array.from(b.querySelectorAll('input')).find((x) => /nombre/i.test(x.id + ' ' + x.name + ' ' + x.placeholder) && x.value.trim());
      if (inp) return inp.value.trim();
    }
    const t = bloque && bloque.querySelector('h5, h4, label, .exec-num');
    return t ? t.textContent.trim() : '';
  }
  function tituloBloque(canvas) {
    const bloque = canvas.closest('.exec-card, .sig-block, .sig-pad-wrap, .field') || canvas.parentElement;
    const card = canvas.closest('.exec-card');
    const t = (card && card.querySelector('.exec-num')) || (bloque && bloque.querySelector('h5, h4, label'));
    return t ? t.textContent.trim() : 'Firma';
  }

  function construir() {
    el = document.createElement('div');
    el.id = 'firmaCompleta';
    el.className = 'firma-completa';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Firmar a pantalla completa');
    el.innerHTML =
      '<div class="fc-cab">' +
        '<div class="fc-quien"><span class="fc-etq" id="fcTitulo">Firma</span><b id="fcNombre"></b></div>' +
        '<span class="fc-giro">💡 Gira el celular si quieres más espacio</span>' +
      '</div>' +
      '<div class="fc-aviso" id="fcAviso">Ya hay una firma guardada. Si firmas aquí, la reemplaza; si tocas Listo sin firmar, queda la que estaba.</div>' +
      '<div class="fc-area"><canvas id="fcPad" class="pad-completa" data-completa="1"></canvas><div class="fc-linea" aria-hidden="true"></div></div>' +
      '<div class="fc-pie">' +
        '<button type="button" data-fc="cancelar">Cancelar</button>' +
        '<button type="button" data-fc="deshacer">Deshacer</button>' +
        '<button type="button" data-fc="borrar">Borrar</button>' +
        '<button type="button" data-fc="listo" class="fc-listo">Listo ✓</button>' +
        '<button type="button" data-fc="alterna">Firmar sin dibujar</button>' +
      '</div>';
    document.body.appendChild(el);
    const mgr = SignaturePad.createManager({ statusIdFor: () => '__fc_sin_estado' });
    const c = document.getElementById('fcPad');
    mgr.setup(c);
    pad = mgr.pads[c.id];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-fc]');
      if (!b) return;
      const acc = b.dataset.fc;
      if (acc === 'borrar') pad.clear();
      else if (acc === 'deshacer') pad.undo();
      else if (acc === 'cancelar') cerrar(false);
      else if (acc === 'listo') cerrar(true);
      // v143: quien no puede trazar firma con nombre y cédula también desde la pantalla completa
      else if (acc === 'alterna' && typeof FirmaAlterna !== 'undefined' && destino && destino._pad) { cerrar(false); setTimeout(() => FirmaAlterna.pedir(destino), 50); }
    });
    // v143: Escape cierra sin cambiar nada (teclado)
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); cerrar(false); } });
    window.addEventListener('popstate', () => {
      if (ignorarPop) { ignorarPop = false; return; }
      if (abierta) { empujado = false; cerrarInterno(false); }
    });
  }

  function abrir(canvas, padDestino) {
    if (!padDestino) return;
    if (!el) construir();
    destino = canvas;
    destinoPad = padDestino;
    const previo = padDestino.getStrokes ? padDestino.getStrokes() : { strokes: [], base: false };
    teniaBase = !!previo.base;
    document.getElementById('fcTitulo').textContent = tituloBloque(canvas);
    document.getElementById('fcNombre').textContent = nombreFirmante(canvas);
    document.getElementById('fcAviso').style.display = teniaBase ? 'block' : 'none';
    document.documentElement.classList.add('fc-abierta');
    el.classList.add('abierta');
    abierta = true;
    setTimeout(() => { try { el.querySelector('[data-fc="cancelar"]').focus(); } catch (e) {} }, 60);   // v143: el foco entra a la ventana
    try { history.pushState({ firmaCompleta: true }, ''); empujado = true; } catch (e) { empujado = false; }
    // El lienzo mide 0×0 mientras está oculto: se ajusta ya visible.
    requestAnimationFrame(() => {
      pad.refreshSize();
      pad.clear();
      // Si en esta sesión ya se había firmado, se trae para poder corregirla.
      if (!teniaBase && previo.strokes && previo.strokes.length) pad.setStrokes(previo.strokes);
    });
  }

  function cerrarInterno(aceptar) {
    if (!abierta) return;
    if (aceptar) {
      const actual = pad.getStrokes();
      if (actual.strokes.length) destinoPad.setStrokes(actual.strokes);
      else if (!teniaBase) destinoPad.setStrokes([]); // borró todo y confirmó
      // El formulario guarda el borrador al detectar cambios dentro de él; el
      // lienzo grande está fuera, así que se avisa desde el recuadro original.
      destino.dispatchEvent(new Event('input', { bubbles: true }));
      destino.dispatchEvent(new Event('change', { bubbles: true }));
    }
    el.classList.remove('abierta');
    document.documentElement.classList.remove('fc-abierta');
    abierta = false;
    const volverA = destino;
    try { if (volverA) { if (!volverA.hasAttribute('tabindex')) volverA.setAttribute('tabindex', '-1'); volverA.focus({ preventScroll: true }); } } catch (e) {}   // v143: el foco vuelve al recuadro
    // Dos veces: si se giró el celular mientras se firmaba, la página detrás
    // cambió de medida y termina de acomodarse un momento después.
    requestAnimationFrame(() => {
      if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' });
      setTimeout(() => { if (volverA && document.body.contains(volverA)) volverA.scrollIntoView({ block: 'center', behavior: 'auto' }); }, 300);
    });
  }

  function cerrar(aceptar) {
    cerrarInterno(aceptar);
    if (empujado) {
      empujado = false;
      ignorarPop = true;
      history.back();
    }
  }

  return { usar, abrir, cerrar, estaAbierta: () => abierta };
})();

