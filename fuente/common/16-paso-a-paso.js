/* ============================================================
   16-paso-a-paso.js — Formularios largos como asistente de pasos (v182)
   ------------------------------------------------------------
   Muestra un formulario por partes: «Paso 2 de 5 · ¿Quién?», con Atrás y
   Siguiente, y en el último paso el botón de guardar. «Ver todo junto»
   vuelve al formulario completo (para quien ya lo conoce). No cambia los
   campos ni cómo se guardan: solo esconde lo que no es del paso actual.
   Los elementos que la pantalla esconde por su cuenta (hidden) siguen
   escondidos: aquí se usa una clase aparte (.pp-fuera).
     const w = PasoAPaso.montar({ raiz, antes, fin, pasos: [{ titulo, els: [el, …], validar }] });
     w.destruir();
   ============================================================ */
const PasoAPaso = (function () {
  const CLAVE = 'ssta-paso-a-paso';
  let estilo = false;
  function css() {
    if (estilo || typeof document === 'undefined') return;
    estilo = true;
    const st = document.createElement('style');
    st.textContent =
      '.pp-fuera{display:none !important;}' +
      '.pp-cab{position:sticky;top:0;z-index:5;background:var(--bg);padding:8px 0 10px;margin-bottom:6px;}' +
      '.pp-tit{font-weight:800;font-size:var(--fs-titulo);margin:0 0 6px;}' +
      '.pp-barra{display:flex;gap:4px;}.pp-barra span{flex:1;height:6px;border-radius:var(--r-xs);background:var(--n-150);}' +
      '.pp-barra span.on{background:var(--ambar-500);}' +
      '.pp-nav{display:flex;gap:8px;margin:12px 0;}.pp-nav .btn{flex:1;min-height:52px;}' +
      '.pp-todo{background:none;border:0;color:var(--azul-700);text-decoration:underline;font-size:var(--fs-menor);cursor:pointer;padding:4px 0;}';
    document.head.appendChild(st);
  }
  const todoJunto = () => {
    try {
      return localStorage.getItem(CLAVE) === 'todo';
    } catch (e) {
      return false;
    }
  };
  function montar(o) {
    css();
    const pasos = (o.pasos || []).map((p) => Object.assign({}, p, { els: (p.els || []).filter(Boolean) })).filter((p) => p.els.length);
    if (pasos.length < 2) return { destruir() {}, ir() {} };
    const todos = [];
    pasos.forEach((p) => p.els.forEach((e) => todos.push(e)));
    let i = 0;
    const cab = document.createElement('div');
    cab.className = 'pp-cab';
    const nav = document.createElement('div');
    nav.className = 'pp-nav';
    nav.innerHTML = '<button type="button" class="btn ghost" data-pp="atras">← Atrás</button><button type="button" class="btn amber" data-pp="sig">Siguiente →</button>';
    const ref = o.antes || pasos[0].els[0];
    ref.parentNode.insertBefore(cab, ref);
    const fin = o.fin || null;
    if (o.navTras) o.navTras.insertAdjacentElement('afterend', nav);
    else (fin || todos[todos.length - 1]).insertAdjacentElement('beforebegin', nav);
    function pintar() {
      const todo = todoJunto();
      todos.forEach((e) => e.classList.toggle('pp-fuera', !todo && pasos[i].els.indexOf(e) === -1));
      if (fin) fin.classList.toggle('pp-fuera', !todo && i < pasos.length - 1);
      nav.hidden = todo;
      nav.querySelector('[data-pp="atras"]').style.visibility = i ? '' : 'hidden';
      nav.querySelector('[data-pp="sig"]').classList.toggle('pp-fuera', i === pasos.length - 1);
      cab.innerHTML = todo
        ? '<button type="button" class="pp-todo" data-pp="pasos">Llenar por pasos</button>'
        : '<p class="pp-tit">Paso ' + (i + 1) + ' de ' + pasos.length + ' · ' + esc(pasos[i].titulo) + '</p><div class="pp-barra" aria-hidden="true">' +
          pasos.map((p, k) => '<span class="' + (k <= i ? 'on' : '') + '"></span>').join('') + '</div><button type="button" class="pp-todo" data-pp="todo">Ver todo junto</button>';
    }
    function ir(k) {
      i = Math.max(0, Math.min(pasos.length - 1, k));
      pintar();
      try {
        cab.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {}
    }
    const clic = (e) => {
      const b = e.target.closest('[data-pp]');
      if (!b) return;
      const a = b.dataset.pp;
      if (a === 'atras') ir(i - 1);
      else if (a === 'sig') {
        const v = pasos[i].validar ? pasos[i].validar() : '';
        if (v) {
          if (typeof UI !== 'undefined' && UI.toast) UI.toast(v, 'mal');
          return;
        }
        ir(i + 1);
      } else {
        try {
          localStorage.setItem(CLAVE, a === 'todo' ? 'todo' : 'pasos');
        } catch (er) {}
        pintar();
      }
    };
    cab.addEventListener('click', clic);
    nav.addEventListener('click', clic);
    // Si al guardar falta algo de otro paso, se va a ese paso (la pantalla marca el campo con aria-invalid o field-invalid).
    const alGuardar = () =>
      setTimeout(() => {
        const mal = todos.find((e) => e.matches('[aria-invalid="true"], .field-invalid') || e.querySelector('[aria-invalid="true"], .field-invalid'));
        if (!mal || todoJunto()) return;
        const k = pasos.findIndex((p) => p.els.indexOf(mal) !== -1);
        if (k !== -1 && k !== i) ir(k);
      }, 120);
    if (fin) fin.addEventListener('click', alGuardar);
    pintar();
    return {
      ir,
      destruir() {
        todos.forEach((e) => e.classList.remove('pp-fuera'));
        if (fin) { fin.classList.remove('pp-fuera'); fin.removeEventListener('click', alGuardar); }
        cab.remove();
        nav.remove();
      },
    };
  }
  return { montar };
})();
