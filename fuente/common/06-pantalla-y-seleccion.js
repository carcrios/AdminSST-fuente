 * en un documento largo de 10 secciones diligenciado en celular, no
 * decoración. Color configurable por página (color de marca del permiso).
 */
const ScrollProgress = {
  init(color) {
    if (document.getElementById('scrollProgress')) return;
    const el = document.createElement('div');
    el.id = 'scrollProgress';
    if (color) el.style.setProperty('--progress-color', color);
    document.body.prepend(el);
    const update = () => {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      const pct = scrollable > 0 ? (h.scrollTop / scrollable) * 100 : 0;
      el.style.width = Math.min(100, Math.max(0, pct)) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
};

const OfflineBanner = {
  init() {
    if (document.getElementById('offlineBanner')) return; // ya existe
    const el = document.createElement('div');
    el.id = 'offlineBanner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.prepend(el);
    // v143: el texto solo existe sin señal (un lector de pantalla no anuncia «sin conexión» por error) y no asusta
    const update = () => { const sin = !navigator.onLine; el.style.display = sin ? 'block' : 'none'; el.textContent = sin ? 'Sin señal: lo que guardes queda en el celular y se envía solo cuando vuelva.' : ''; };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }
};

/**
 * SeleccionMultiple: fichas que se tocan para elegir varias opciones, con un
 * campo libre al final para lo que no esté en la lista.
 *
 * Reemplaza a los campos de texto donde había que escribir a mano cosas que
 * casi siempre son las mismas ("¿cuál permiso adicional?", "herramientas a
 * utilizar"): en obra, con guantes y de pie, escribir es lo más incómodo del
 * formulario. Además, al quedar los valores normalizados se pueden contar y
 * filtrar después, cosa imposible con texto libre.
 *
 * Se guarda como un solo texto separado por " · " para que lo que ya está
 * registrado en la hoja siga leyéndose igual y no haya que migrar nada.
 *
 *   const sel = SeleccionMultiple.crear(document.getElementById('x'), {
 *     opciones: ['Taladro','Pulidora'],
 *     placeholderLibre: 'Otras herramientas…'
 *   });
 *   sel.get();          // "Taladro · Pulidora · lo que se escribió"
 *   sel.set(texto);     // reconstruye la selección desde ese texto
 */
const SeleccionMultiple = {
  crear(contenedor, opts) {
    opts = opts || {};
    const opciones = opts.opciones || [];
    const seleccion = new Set();

    const fichas = document.createElement('div');
    fichas.className = 'sm-fichas';
    const libre = document.createElement('input');
    libre.type = 'text';
    libre.className = 'sm-libre';
    libre.placeholder = opts.placeholderLibre || 'Otro (escribe aquí)…';

    opciones.forEach((op) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sm-ficha';
      b.textContent = op;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => {
        if (seleccion.has(op)) { seleccion.delete(op); b.classList.remove('on'); b.setAttribute('aria-pressed','false'); }
        else { seleccion.add(op); b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        if (opts.onChange) opts.onChange();
      });
      fichas.appendChild(b);
    });
    if (opts.onChange) libre.addEventListener('input', opts.onChange);

    contenedor.innerHTML = '';
    contenedor.appendChild(fichas);
    contenedor.appendChild(libre);

    return {
      get() {
        const partes = opciones.filter(o => seleccion.has(o));
        const extra = libre.value.trim();
        if (extra) partes.push(extra);
        return partes.join(' · ');
      },
      set(texto) {
        seleccion.clear();
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          b.classList.remove('on'); b.setAttribute('aria-pressed','false');
        });
        libre.value = '';
        if (!texto) return;
        // Lo que coincida con una opción se marca como ficha; el resto vuelve
        // al campo libre. Así un permiso guardado antes de este cambio, con
        // texto escrito a mano, se sigue viendo completo.
        const sueltos = [];
        String(texto).split('·').map(x => x.trim()).filter(Boolean).forEach(parte => {
          const op = opciones.find(o => o.toLowerCase() === parte.toLowerCase());
          if (op) { seleccion.add(op); }
          else sueltos.push(parte);
        });
        fichas.querySelectorAll('.sm-ficha').forEach(b => {
          if (seleccion.has(b.textContent)) { b.classList.add('on'); b.setAttribute('aria-pressed','true'); }
        });
        libre.value = sueltos.join(' · ');
      },
      vacio() { return !this.get(); }
    };
  }
};

