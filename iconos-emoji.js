/* iconos-emoji.js — v122 */
/* ================= EMOJIS → ÍCONOS (v122) =================
   El portal se ve más serio con íconos de línea que con emojis de colores (cada
   celular los dibuja distinto). En vez de reescribir cientos de textos, aquí se
   cambia cada emoji por su ícono al pintarse la página (también lo que se pinta
   después). Los signos simples (✓ ✕ ★ ☐) se dejan: son letras, no dibujos.
   En listas desplegables (<option>) y campos de texto el emoji solo se quita. */
var EmojiIcono = (function () {
  if (typeof document === 'undefined') return null;
  const P = {
    imprimir: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
    alerta: 'M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4.5M12 17.2v.1',
    ok: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM8 12.5l2.7 2.7L16 10',
    error: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 9l6 6M15 9l-6 6',
    candado: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    abierto: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2',
    portapapeles: 'M9 3h6v3H9zM9 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-3M8.5 11h7M8.5 15h5',
    lapiz: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
    persona: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    personas: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
    nube: 'M7 18h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z',
    llave: 'M7.5 15.5a4.5 4.5 0 1 0 0 .1zM10.7 12.3 20 3M16.5 6.5l3 3M13.5 9.5l2 2',
    brujula: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15.5 8.5l-2 5-5 2 2-5z',
    bajar: 'M12 4v12M6.5 10.5 12 16l5.5-5.5M5 20h14',
    subir: 'M12 20V8M6.5 13.5 12 8l5.5 5.5M5 4h14',
    edificio: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3',
    carpeta: 'M3 7a2 2 0 0 1 2-2h4.2l2 2.2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    clip: 'M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7',
    idea: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
    documento: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
    camara: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    escudo: 'M12 3 5 6v5.5c0 4.3 3 8 7 9.5 4-1.5 7-5.2 7-9.5V6z',
    casco: 'M2.5 18h19M5 18v-3a7 7 0 0 1 14 0v3M10 8.2V5h4v3.2',
    herramienta: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
    fuego: 'M12 3c.8 3 4.2 4.6 4.2 8.3a4.2 4.2 0 0 1-8.4 0c0-1.6.6-2.7 1.6-3.7.2 1.2.9 1.8 1.6 1.9C11 8 11.6 5.6 12 3z',
    rayo: 'M13 2 4 14h7l-1 8 9-12h-7z',
    salud: 'M4 7h16v13H4zM9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M12 10.5v6M9 13.5h6',
    matraz: 'M9 2.5h6M10 2.5V9l-5.6 9.6A2 2 0 0 0 6.1 21.5h11.8a2 2 0 0 0 1.7-2.9L14 9V2.5M7.2 15h9.6',
    cono: 'M9.5 4h5L19 20H5zM7.5 12h9M8.7 8h6.6M3 20h18',
    ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    escalera: 'M8 3v18M16 3v18M8 7.5h8M8 12h8M8 16.5h8',
    chat: 'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 20.5l1.4-5.2A8.5 8.5 0 1 1 21 11.5z',
    correo: 'M3 6h18v12H3zM3 7l9 6 9-6',
    celular: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
    calendario: 'M3 4.5h18V21H3zM3 9.5h18M8 2.5v4M16 2.5v4',
    reloj: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
    grafico: 'M3 21h18M6.5 17v-5M12 17V6M17.5 17v-8',
    hoja: 'M11 20A7 7 0 0 1 4 13c0-6 5-9 16-9 0 11-3 16-9 16zM4 21c3.5-4 7-7.5 11-10',
    etiqueta: 'M3 12V4h8l10 10-8 8zM7.5 8.5h.01',
    ubicacion: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    tarjeta: 'M2.5 5h19v14h-19zM8 11a2.2 2.2 0 1 0 0-.1zM4.8 16.2a3.4 3.4 0 0 1 6.4 0M14 10h5M14 13.5h3.5',
    hueco: 'M12 9c5 0 9 1.3 9 3s-4 3-9 3-9-1.3-9-3 4-3 9-3zM3 12v4c0 1.7 4 3 9 3s9-1.3 9-3v-4',
    engranaje: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.8 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1A2 2 0 1 1 7 4.3l.1.1A1.6 1.6 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.9 10H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
    mas: 'M12 5v14M5 12h14',
    lupa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16',
    guardar: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
    flecha: 'M5 12h14M13 6l6 6-6 6',
    repetir: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
    vehiculo: 'M3.5 16.5V12l2-5.2A2 2 0 0 1 7.4 5.5h9.2a2 2 0 0 1 1.9 1.3l2 5.2v4.5M3.5 12h17M7.5 18.5a2 2 0 1 0 0-.1zM16.5 18.5a2 2 0 1 0 0-.1z',
    medalla: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.6 14 7 22l5-3 5 3-1.6-8',
    maletin: 'M3 7h18v13H3zM8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 12.5h18',
    limpieza: 'M14 3l-4 9M6 12h12l-1 9H7zM9 16v2M12 16v2M15 16v2',
    cara: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM9 10h.01M15 10h.01M9 16c1.5-1 4.5-1 6 0',
    pantalla: 'M3 4h18v12H3zM8 20h8M12 16v4',
    punto: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    estrella: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    cohete: 'M5 15c-1 1-1.5 4-1.5 4.5S6 19 7 18M14.5 3.5C18 3 21 6 20.5 9.5L13 17l-6-6zM9.5 14.5 7 17'
  };
  const MAPA = {
    '🖨': 'imprimir', '⚠': 'alerta', '🚨': 'alerta', '✅': 'ok', '👍': 'ok', '👏': 'ok', '❌': 'error', '🙅': 'error',
    '🔒': 'candado', '🔐': 'candado', '🔓': 'abierto', '📋': 'portapapeles', '📝': 'portapapeles', '🗳': 'portapapeles',
    '✏': 'lapiz', '✍': 'lapiz', '👤': 'persona', '🧑': 'persona', '👷': 'casco', '👋': 'persona', '👥': 'personas', '🤝': 'personas', '🗣': 'personas',
    '☁': 'nube', '📡': 'nube', '🔑': 'llave', '🧭': 'brujula', '⬇': 'bajar', '📥': 'bajar', '⬆': 'subir', '🏢': 'edificio', '🏭': 'edificio', '🏛': 'edificio',
    '🗂': 'carpeta', '📁': 'carpeta', '📦': 'carpeta', '📎': 'clip', '💡': 'idea', '🎯': 'idea', '📄': 'documento', '📚': 'documento', '🧾': 'documento', '📽': 'documento', '🖼': 'documento',
    '📷': 'camara', '🦺': 'escudo', '🛡': 'escudo', '🏗': 'casco', '🧰': 'herramienta', '🛠': 'herramienta', '🔧': 'herramienta', '🔥': 'fuego', '🧯': 'fuego', '⚡': 'rayo', '🔌': 'rayo',
    '🚑': 'salud', '🩺': 'salud', '🩹': 'salud', '⚗': 'matraz', '🧪': 'matraz', '☢': 'matraz', '🚧': 'cono', '🟢': 'punto', '🔴': 'punto', '⚪': 'punto', '⬜': 'punto',
    '💰': 'maletin', '👁': 'ojo', '🧗': 'escalera', '🪜': 'escalera', '🪢': 'escalera', '💬': 'chat', '📧': 'correo', '📲': 'celular', '📴': 'celular', '📅': 'calendario', '🗓': 'calendario', '🕘': 'reloj',
    '📊': 'grafico', '📈': 'grafico', '🌱': 'hoja', '🌳': 'hoja', '🕊': 'hoja', '🏷': 'etiqueta', '📌': 'ubicacion', '📍': 'ubicacion', '🪪': 'tarjeta', '🕳': 'hueco', '⚙': 'engranaje',
    '➕': 'mas', '🔎': 'lupa', '🔍': 'lupa', '💾': 'guardar', '➡': 'flecha', '🚀': 'cohete', '🔄': 'repetir', '🔁': 'repetir', '🚚': 'vehiculo', '🚗': 'vehiculo',
    '🏅': 'medalla', '🎓': 'medalla', '💼': 'maletin', '🧹': 'limpieza', '🍽': 'limpieza', '🚻': 'personas', '😮': 'cara', '😠': 'cara', '🖥': 'pantalla'
  };
  const COLOR = { '🟢': '#1d9a5b', '🔴': '#d92d20', '✅': '#1d9a5b', '❌': '#d92d20', '⚪': '#9aa6b6', '⬜': '#9aa6b6' };
  const claves = Object.keys(MAPA).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const RE = new RegExp('(' + claves.join('|') + ')\\uFE0F?', 'g');
  const PRUEBA = new RegExp('(' + claves.join('|') + ')');
  const NO = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, TITLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1 };
  function svg(nombre, color) {
    return '<svg class="ic-emo" viewBox="0 0 24 24" aria-hidden="true" fill="' + (nombre === 'punto' ? (color || 'currentColor') : 'none') + '" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + P[nombre] + '"/></svg>';
  }
  function cambiarTexto(nodo) {
    const t = nodo.nodeValue; if (!t || !PRUEBA.test(t)) return;
    const padre = nodo.parentNode; if (!padre || NO[padre.nodeName] || padre.closest && padre.closest('[data-sin-iconos]')) return;
    if (padre.nodeName === 'OPTION' || padre.nodeName === 'OPTGROUP' || (padre.closest && padre.closest('select'))) { nodo.nodeValue = t.replace(RE, '').replace(/^\s+/, ''); return; }
    if (padre.namespaceURI && padre.namespaceURI !== 'http://www.w3.org/1999/xhtml') return;
    const tmp = document.createElement('span');
    tmp.innerHTML = t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(RE, (m, k) => svg(MAPA[k], COLOR[k]));
    const frag = document.createDocumentFragment(); while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    padre.replaceChild(frag, nodo);
  }
  function recorrer(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { cambiarTexto(raiz); return; }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
    if (raiz.nodeType === 1 && NO[raiz.nodeName]) return;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT), lista = [];
    while (w.nextNode()) if (PRUEBA.test(w.currentNode.nodeValue)) lista.push(w.currentNode);
    lista.forEach(cambiarTexto);
    // Atributos que se leen en pantalla (placeholder, botones de texto): sin emoji.
    if (raiz.querySelectorAll) raiz.querySelectorAll('[placeholder],input[type=button],input[type=submit]').forEach((el) => { ['placeholder', 'value'].forEach((a) => { const v = el.getAttribute(a); if (v && PRUEBA.test(v) && (a === 'placeholder' || el.type === 'button' || el.type === 'submit')) el.setAttribute(a, v.replace(RE, '').trim()); }); });
  }
  function iniciar() {
    const st = document.createElement('style');
    st.textContent = '.ic-emo{width:1.15em;height:1.15em;vertical-align:-.2em;flex:0 0 auto;display:inline-block;margin:0 .1em;}';
    document.head.appendChild(st);
    recorrer(document.body);
    new MutationObserver((ms) => ms.forEach((m) => {
      if (m.type === 'characterData') cambiarTexto(m.target);
      else m.addedNodes.forEach(recorrer);
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  /** Para textos fuera de la página (alertas): el mismo texto sin emojis. */
  return { limpiar: (t) => String(t == null ? '' : t).replace(RE, '').replace(/\s{2,}/g, ' ').trim(), svg, MAPA };
})();

if (typeof window !== 'undefined' && EmojiIcono) ['alert', 'confirm', 'prompt'].forEach((f) => { const o = window[f]; if (typeof o === 'function') window[f] = function (msg, def) { return o.call(window, EmojiIcono.limpiar(msg), def); }; });
