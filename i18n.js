/* ============================================================
   i18n.js — Reportes y gerencia en inglés (v169)
   ------------------------------------------------------------
   Las multinacionales piden los reportes en inglés. En vez de reescribir cada
   pantalla, se traduce lo que la pantalla YA pintó: los textos visibles, las
   etiquetas para lectores de pantalla y el HTML de los PDF. Lo hace con un
   diccionario de frases (i18n-en.js) y unos patrones para las frases con
   números y fechas.

   Qué pantallas: las que tienen <body data-i18n> (informe mensual, indicadores,
   tablero gerencial y pantalla de planta). En ellas aparece el botón ES | EN.
   El idioma se recuerda en el equipo (y se puede forzar con ?lang=en).

   Los datos que escribió la gente (nombres, descripciones, hallazgos) NO se
   traducen: son evidencia y se muestran tal como se registraron.

   Para encontrar lo que falta traducir: ?lang=en&i18n=faltan → en la consola
   del navegador, I18N.faltan() lista las frases en español que quedaron.
   ============================================================ */
const I18N = (function () {
  const CLAVE = 'ssta-idioma';
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams('');
  let lang = (q.get('lang') || '').toLowerCase();
  if (lang !== 'en' && lang !== 'es') {
    try {
      lang = localStorage.getItem(CLAVE) || 'es';
    } catch (e) {
      lang = 'es';
    }
  }
  const recoger = q.get('i18n') === 'faltan',
    faltan = new Set();
  const D = () => (typeof I18N_EN !== 'undefined' ? I18N_EN : { frases: {}, patrones: [] });
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const ES = /[áéíóúñ¿¡]|\b(de|del|los|las|el|la|con|sin|por|para|mes|año|días?|acciones?|reportes?)\b/i;

  /** Traduce una frase completa. Lo que no está en el diccionario se deja igual. */
  function t(s) {
    if (lang !== 'en' || s == null) return s;
    const txt = String(s),
      n = norm(txt);
    if (!n || !/[a-záéíóúñ]/i.test(n)) return txt;
    const d = D(),
      ex = d.frases[n];
    if (ex != null) return conEspacios(txt, ex);
    for (const [re, f] of d.patrones) {
      const m = re.exec(n);
      if (m) return conEspacios(txt, typeof f === 'function' ? f(m) : n.replace(re, f));
    }
    if (recoger && ES.test(n) && n.length < 400) faltan.add(n);
    return txt;
  }
  const conEspacios = (orig, nuevo) => {
    const a = /^\s*/.exec(orig)[0],
      b = /\s*$/.exec(orig)[0];
    return a + nuevo + b;
  };
  const ATR = ['placeholder', 'aria-label', 'title', 'alt'];
  const SALTAR = 'script,style,textarea,input,select option[data-dato],[data-no-traducir],[contenteditable]';
  /** Traduce los textos y atributos visibles dentro de un nodo (no los datos que la gente escribió). */
  function traducir(root) {
    if (lang !== 'en' || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest(SALTAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const l = [];
    while (w.nextNode()) l.push(w.currentNode);
    l.forEach((n) => {
      const v = t(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
    });
    (root.querySelectorAll ? [root].concat([...root.querySelectorAll('[' + ATR.join('],[') + ']')]) : []).forEach((el) => {
      if (!el.getAttribute) return;
      ATR.forEach((a) => {
        const v = el.getAttribute(a);
        if (v) {
          const x = t(v);
          if (x !== v) el.setAttribute(a, x);
        }
      });
    });
  }
  /** Traduce un pedazo de HTML (lo que va al PDF). */
  function html(h) {
    if (lang !== 'en' || typeof document === 'undefined') return h;
    const tpl = document.createElement('template');
    tpl.innerHTML = h;
    traducir(tpl.content);
    const d = document.createElement('div');
    d.appendChild(tpl.content.cloneNode(true));
    return d.innerHTML;
  }
  let obs = null;
  function vigilar() {
    if (lang !== 'en' || obs || typeof MutationObserver === 'undefined') return;
    let pend = false;
    obs = new MutationObserver(() => {
      if (pend) return;
      pend = true;
      requestAnimationFrame(() => {
        pend = false;
        obs.disconnect();
        traducir(document.body);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
      });
    });
    traducir(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function poner(l) {
    try {
      localStorage.setItem(CLAVE, l);
    } catch (e) {}
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.replace(u.toString());
  }
  /** El botón ES | EN en las pantallas que se traducen. */
  function boton() {
    if (document.getElementById('i18nBtn')) return;
    const hdr = document.querySelector('.hdr') || document.body,
      b = document.createElement('div');
    b.id = 'i18nBtn';
    b.className = 'i18n-btn';
    b.setAttribute('role', 'group');
    b.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Idioma');
    b.innerHTML =
      '<button type="button" data-l="es" aria-pressed="' +
      (lang === 'es') +
      '">ES</button><button type="button" data-l="en" aria-pressed="' +
      (lang === 'en') +
      '">EN</button>';
    b.addEventListener('click', (e) => {
      const x = e.target.closest('[data-l]');
      if (x && x.dataset.l !== lang) poner(x.dataset.l);
    });
    hdr.appendChild(b);
  }
  function iniciar() {
    if (typeof document === 'undefined' || !document.body || !document.body.hasAttribute('data-i18n')) return;
    document.documentElement.lang = lang;
    boton();
    vigilar();
    // Los PDF salen en el idioma de la pantalla.
    if (lang === 'en' && typeof UI !== 'undefined' && UI.imprimir && !UI.imprimir.__i18n) {
      const orig = UI.imprimir;
      UI.imprimir = function (paginas, ...resto) {
        return orig.call(
          UI,
          (paginas || []).map((p) => html(p)),
          ...resto,
        );
      };
      UI.imprimir.__i18n = true;
    }
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
  }
  return { t, traducir, html, idioma: () => lang, poner, faltan: () => [...faltan].sort(), iniciar };
})();
if (typeof module !== 'undefined') module.exports = I18N;
