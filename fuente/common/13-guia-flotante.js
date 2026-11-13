/* ============================================================
   13-guia-flotante.js — La guía, flotando en cada pantalla (v173)
   ------------------------------------------------------------
   Un botón redondo abajo a la derecha abre «Pregúntale a la guía» sin salir
   de la pantalla. Propone primero las preguntas de ESA pantalla. Las guías
   y respuestas (ayuda-guias.js, guia-preguntas.js) se cargan solo al abrirla,
   para no hacer más pesada ninguna pantalla.
   Lo que no sabe responder se anota (solo el texto) para agregarlo después.
   No aparece en Ayuda (ya la tiene arriba), en la pantalla de planta ni al imprimir.
   ============================================================ */
const GuiaFlotante = (function () {
  const NO = /(^|\/)(ayuda|pantalla-planta|offline|404|instalar)\.html$/;
  const pagina = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  let panel = null,
    boton = null,
    listo = null;
  const cargarJs = (src) =>
    new Promise((ok, mal) => {
      if (document.querySelector('script[src="' + src + '"]')) return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => ok();
      s.onerror = () => mal(new Error(src));
      document.head.appendChild(s);
    });
  function preparar() {
    if (!listo)
      listo = (typeof GUIAS === 'undefined' ? cargarJs('ayuda-guias.js') : Promise.resolve())
        .then(() => (typeof GUIA_PREGUNTAS === 'undefined' ? cargarJs('guia-preguntas.js') : null))
        .then(() => {
          const vis = (g) => {
            try {
              if (typeof Empresa !== 'undefined' && Empresa.visible && !Empresa.visible('ayuda', g.id)) return false;
              return !g.mod || typeof Empresa === 'undefined' || !Empresa.moduloActivo || g.mod.some((m) => Empresa.moduloActivo(m));
            } catch (e) {
              return true;
            }
          };
          GUIA_PREGUNTAS.armar({ guias: (typeof GUIAS !== 'undefined' ? GUIAS : []).filter(vis), faq: [] });
          GUIA_PREGUNTAS.enviarCola();
        });
    return listo;
  }
  /** Las preguntas de esta pantalla (las respuestas que llevan a ella); si no hay, las generales. */
  function deEstaPantalla() {
    const p = pagina(),
      l = GUIA_PREGUNTAS.RESPUESTAS.filter((x) => (x.a || []).some(([, h]) => h.split(/[?#]/)[0].toLowerCase() === p)).map((x) => x.p[0]);
    return (l.length ? l : GUIA_PREGUNTAS.SUGERIDAS).slice(0, 4);
  }
  const chip = (t) => '<button type="button" class="gf-chip" data-gf="' + esc(t) + '">' + esc(t) + '</button>';
  /* v174 · Como un chat: la guía saluda y pregunta en qué ayuda; cada pregunta queda en burbujas. */
  const burbuja = (quien, html) => {
    const res = panel.querySelector('.gf-res'),
      d = document.createElement('div');
    d.className = 'gf-b ' + (quien === 'yo' ? 'gf-yo' : 'gf-guia');
    d.innerHTML = html;
    res.appendChild(d);
    res.scrollTop = res.scrollHeight;
    return d;
  };
  function saludar() {
    const y = typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo(),
      n = y && y.nombre ? ' ' + String(y.nombre).split(' ')[0] : '';
    burbuja(
      'guia',
      '<div class="gf-r">¡Hola' +
        esc(n) +
        '! 👋 ¿En qué te ayudo? Escríbeme tu pregunta o toca una de estas:</div>' +
        '<div class="gf-otra">' +
        deEstaPantalla().map(chip).join('') +
        '</div>',
    );
  }
  function responder(q) {
    q = String(q || '').trim();
    if (!q) return;
    panel.querySelector('input').value = '';
    burbuja('yo', esc(q));
    const l = GUIA_PREGUNTAS.preguntar(q),
      x = l[0];
    if (!x) GUIA_PREGUNTAS.reportar(q);
    burbuja(
      'guia',
      x
        ? '<b>' +
            esc(x.t) +
            '</b><div class="gf-r">' +
            esc(x.r) +
            '</div>' +
            (x.a || []).map(([t, h]) => '<a class="btn-mini" href="' + esc(h) + '">' + esc(t) + ' →</a>').join(' ') +
            (l.length > 1
              ? '<div class="gf-otra">También: ' +
                l
                  .slice(1)
                  .map((y) => chip(y.t))
                  .join('') +
                '</div>'
              : '') +
            '<div class="gf-r gf-sigue">¿Algo más?</div>'
        : '<div class="gf-r">No tengo esa respuesta todavía. Ya quedó anotada para agregarla. ¿Me lo preguntas con otras palabras? También puedes mirar el <a href="ayuda.html">manual</a>.</div>',
    );
  }
  function abrir() {
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'guiaPanel';
      panel.className = 'gf-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Guía del portal');
      panel.innerHTML =
        '<div class="gf-cab"><b>Guía del portal</b><button type="button" class="gf-x" aria-label="Cerrar la guía">✕</button></div>' +
        '<div class="gf-res" aria-live="polite"><div class="gf-b gf-guia gf-cargando"><div class="gf-r">Un momento…</div></div></div>' +
        '<form class="gf-f"><input type="search" aria-label="Tu pregunta" placeholder="Escribe tu pregunta…" autocomplete="off">' +
        '<button type="submit" class="gf-ir" aria-label="Preguntar">➜</button></form>' +
        '<div class="gf-pie">Sin señal también funciona. <a href="ayuda.html">Manual completo</a></div>';
      document.body.appendChild(panel);
      panel.querySelector('.gf-x').addEventListener('click', cerrar);
      panel.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        responder(panel.querySelector('input').value);
      });
      panel.addEventListener('click', (e) => {
        const b = e.target.closest('[data-gf]');
        if (!b) return;
        panel.querySelector('input').value = b.dataset.gf;
        responder(b.dataset.gf);
      });
      panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrar();
      });
    }
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    panel.querySelector('input').focus();
    preparar()
      .then(() => {
        const c = panel.querySelector('.gf-cargando');
        if (c) c.remove();
        if (!panel.querySelector('.gf-b')) saludar();
      })
      .catch(() => {
        panel.querySelector('.gf-res').innerHTML = '<div class="gf-r">No se pudo abrir la guía. Abre el <a href="ayuda.html">manual</a>.</div>';
      });
  }
  function cerrar() {
    if (panel) panel.hidden = true;
    if (boton) {
      boton.setAttribute('aria-expanded', 'false');
      boton.focus();
    }
  }
  function iniciar() {
    if (boton || NO.test(pagina()) || !document.body || document.body.classList.contains('tv') || document.body.hasAttribute('data-sin-guia')) return;
    boton = document.createElement('button');
    boton.type = 'button';
    boton.id = 'guiaBtn';
    boton.className = 'gf-btn';
    boton.setAttribute('aria-label', 'Pregúntale a la guía');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-controls', 'guiaPanel');
    boton.title = 'Pregúntale a la guía';
    boton.innerHTML = '<span aria-hidden="true">?</span>';
    boton.addEventListener('click', () => (panel && !panel.hidden ? cerrar() : abrir()));
    document.body.appendChild(boton);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else setTimeout(iniciar, 0);
  }
  return { iniciar, abrir, cerrar };
})();
