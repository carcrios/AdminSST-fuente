/* ============================================================
   dialogo.js — Ventanas del portal en vez de las del navegador (v132)
   ------------------------------------------------------------
   Reemplaza alert(), confirm() y prompt(): con la marca del portal, legibles,
   accesibles (role="alertdialog", foco adentro, Escape cancela) y sin el riesgo
   de que el celular las bloquee. Devuelven una promesa:
     await Dialogo.avisar(texto)              → undefined
     await Dialogo.confirmar(texto)           → true / false
     await Dialogo.pedir(texto, valor)        → texto escrito, o null si cancela
   Para pruebas automáticas: window.__sstaDialogoAuto = 'aceptar' | 'cancelar'.
   ============================================================ */
const Dialogo = (function () {
  const PELIGRO = /\b(borrar|eliminar|quitar|reemplaz|descartar|cerrar el mes|limpiar)/i;
  let estilo = false;
  function ponerEstilo() {
    if (estilo || typeof document === 'undefined') return; estilo = true;
    const st = document.createElement('style'); st.id = 'estiloDialogo';
    st.textContent =
      '.dlg-fondo{position:fixed;inset:0;z-index:100000;background:rgba(16,33,58,.45);display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:dlgEntra .16s ease-out;}' +
      '@media (min-width:640px){.dlg-fondo{align-items:center;}}' +
      '.dlg{background:var(--paper,#fff);color:var(--tinta,#10213a);width:100%;max-width:460px;border-radius:var(--r-xl,24px);padding:20px 18px 16px;box-shadow:0 24px 60px rgba(16,33,58,.35);max-height:85vh;overflow:auto;}' +
      '.dlg-t{font-size:var(--fs-titulo,15px);line-height:1.5;white-space:pre-line;margin:0 0 16px;font-weight:600;}' +
      '.dlg input{width:100%;box-sizing:border-box;min-height:48px;border:1.5px solid var(--line,#dde3e8);border-radius:var(--r-m,12px);padding:10px 12px;font:inherit;font-size:var(--fs-campo,16px);margin:0 0 14px;color:inherit;background:#fff;}' +
      '.dlg-b{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}' +
      '.dlg-b button{min-height:46px;min-width:110px;padding:0 18px;border-radius:var(--r-pill,999px);font:inherit;font-weight:800;font-size:var(--fs-titulo,15px);cursor:pointer;border:1.5px solid var(--line,#dde3e8);background:#fff;color:var(--tinta,#10213a);}' +
      '.dlg-b .dlg-ok{border:0;background:var(--tinta,#10213a);color:#fff;}.dlg-b .dlg-ok.peligro{background:var(--rojo-500,#d92d20);}' +
      '@keyframes dlgEntra{from{opacity:0}to{opacity:1}}';
    (document.head || document.documentElement).appendChild(st);
  }
  /* v147: el botón dice lo que hace («Borrar», «Cerrar»…) en vez de «Aceptar». */
  function verbo(tipo, texto) {
    if (tipo === 'pedir') return 'Continuar';
    const m = /^\s*¿\s*([a-záéíóúñ]+?(?:ar|er|ir))(?:lo|la|los|las|le|les)?\b/i.exec(String(texto || ''));
    return m && m[1].length > 3 ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : 'Sí, continuar';
  }
  function abrir(tipo, texto, valor) {
    const auto = typeof window !== 'undefined' && window.__sstaDialogoAuto;
    if (auto) return Promise.resolve(tipo === 'confirmar' ? auto === 'aceptar' : tipo === 'pedir' ? (auto === 'aceptar' ? String(valor == null ? '' : valor) : null) : undefined);
    if (typeof document === 'undefined' || !document.body) {   // sin pantalla (muy raro): el comportamiento del navegador
      return Promise.resolve(tipo === 'confirmar' ? window.confirm(texto) : tipo === 'pedir' ? window.prompt(texto, valor) : window.alert(texto));
    }
    ponerEstilo();
    return new Promise((fin) => {
      const antes = document.activeElement;
      const f = document.createElement('div'); f.className = 'dlg-fondo';
      const id = 'dlg' + Math.random().toString(36).slice(2, 8);
      const peligro = tipo === 'confirmar' && PELIGRO.test(String(texto));
      f.innerHTML = '<div class="dlg" role="' + (tipo === 'avisar' ? 'alertdialog' : 'alertdialog') + '" aria-modal="true" aria-labelledby="' + id + '">' +
        '<p class="dlg-t" id="' + id + '"></p>' + (tipo === 'pedir' ? '<input type="text" aria-labelledby="' + id + '">' : '') +
        '<div class="dlg-b">' + (tipo === 'avisar' ? '' : '<button type="button" class="dlg-no">Cancelar</button>') +
        '<button type="button" class="dlg-ok' + (peligro ? ' peligro' : '') + '">' + (tipo === 'avisar' ? 'Entendido' : verbo(tipo, texto)) + '</button></div></div>';
      f.querySelector('.dlg-t').textContent = String(texto == null ? '' : texto);
      const inp = f.querySelector('input'); if (inp) inp.value = valor == null ? '' : String(valor);
      document.body.appendChild(f);
      const cerrar = (v) => { f.remove(); document.removeEventListener('keydown', tecla, true); try { if (antes && antes.focus) antes.focus({ preventScroll: true }); } catch (e) {} fin(v); };
      const ok = () => cerrar(tipo === 'confirmar' ? true : tipo === 'pedir' ? inp.value : undefined);
      const no = () => cerrar(tipo === 'confirmar' ? false : tipo === 'pedir' ? null : undefined);
      function tecla(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); no(); }
        else if (e.key === 'Enter' && (tipo !== 'confirmar' || document.activeElement === f.querySelector('.dlg-ok'))) { e.preventDefault(); ok(); }
        else if (e.key === 'Tab') {   // el foco no se sale de la ventana
          const b = [...f.querySelectorAll('input,button')]; const i = b.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); b[b.length - 1].focus(); } else if (!e.shiftKey && i === b.length - 1) { e.preventDefault(); b[0].focus(); }
        }
      }
      document.addEventListener('keydown', tecla, true);
      f.querySelector('.dlg-ok').addEventListener('click', ok);
      const bn = f.querySelector('.dlg-no'); if (bn) bn.addEventListener('click', no);
      f.addEventListener('click', (e) => { if (e.target === f && tipo !== 'avisar') no(); });
      setTimeout(() => { (inp || (peligro && bn) || f.querySelector('.dlg-ok')).focus(); if (inp) inp.select(); }, 30);
    });
  }
  return {
    avisar: (t) => abrir('avisar', t),
    confirmar: (t) => abrir('confirmar', t),
    pedir: (t, v) => abrir('pedir', t, v)
  };
})();
if (typeof module !== 'undefined') module.exports = Dialogo;
