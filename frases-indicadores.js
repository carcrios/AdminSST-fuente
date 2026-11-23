/* ============================================================
   frases-indicadores.js — Indicadores que hablan (v182)
   ------------------------------------------------------------
   Convierte dos valores (este periodo y el de comparación) en una frase corta:
   «Tu frecuencia de accidentalidad está 18 % por debajo del año pasado».
   Lo usan Indicadores, el informe del mes (valor para el gerente) y Gerencia.
   Es puro (sin pantalla): lo prueban las pruebas en Node.
   ============================================================ */
const FrasesInd = (function () {
  const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
  const fmt = (n, d) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: d == null ? 1 : d });
  /**
   * @param {string} nombre   «tu frecuencia de accidentalidad», «los actos y condiciones reportados»
   * @param {*} actual
   * @param {*} antes
   * @param {string} contra   «el mes pasado», «el mismo mes del año pasado», «el año pasado»
   * @param {boolean} menosEsMejor  true para accidentes, días perdidos…; false para reportes, inspecciones…
   * @returns {{texto, tono: 'bien'|'mal'|'igual'}|null}
   */
  function comparar(nombre, actual, antes, contra, menosEsMejor) {
    const a = num(actual),
      b = num(antes);
    if (a === null || b === null) return null;
    const Nom = nombre.charAt(0).toUpperCase() + nombre.slice(1);
    if (a === b) return { texto: Nom + ' está igual que ' + contra + ' (' + fmt(a) + ').', tono: 'igual' };
    if (b === 0) {
      const sube = a > b,
        bien = sube !== menosEsMejor;
      return { texto: Nom + ' pasó de 0 a ' + fmt(a) + ' frente a ' + contra + '.', tono: bien ? 'bien' : 'mal' };
    }
    const p = Math.round((Math.abs(a - b) / Math.abs(b)) * 100),
      sube = a > b,
      bien = sube !== menosEsMejor;
    if (a === 0 && menosEsMejor) return { texto: Nom + ': 0, frente a ' + fmt(b) + ' ' + contra + '.', tono: 'bien' };
    return {
      texto: Nom + ' está ' + p + ' % ' + (sube ? 'por encima' : 'por debajo') + ' de ' + contra + ' (' + fmt(a) + ' frente a ' + fmt(b) + ').',
      tono: bien ? 'bien' : 'mal',
    };
  }
  /** Días seguidos sin accidentes hasta «hoy» (fechas de los AT). */
  function diasSinAT(fechasAT, hoy) {
    const l = (fechasAT || [])
      .map((f) => String(f || '').slice(0, 10))
      .filter((f) => f && f <= hoy)
      .sort();
    if (!l.length) return null;
    return Math.round((Date.parse(hoy + 'T12:00:00Z') - Date.parse(l[l.length - 1] + 'T12:00:00Z')) / 864e5);
  }
  /** HTML de una lista de frases (ya filtradas las null). */
  function html(lista, esc) {
    const l = (lista || []).filter(Boolean);
    if (!l.length) return '';
    return '<ul class="frases-ind">' + l.map((f) => '<li class="' + f.tono + '">' + esc(f.texto) + '</li>').join('') + '</ul>';
  }
  const CSS =
    '.frases-ind{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px;}.frases-ind li{padding:8px 12px;border-radius:var(--r-m);border-left:5px solid' +
      ' var(--n-300);background:var(--n-0);font-size:var(--fs-base);}' +
    '.frases-ind li.bien{border-color:var(--verde-600);}.frases-ind li.mal{border-color:var(--rojo-700);}';
  return { comparar, diasSinAT, html, CSS };
})();
if (typeof module !== 'undefined') module.exports = FrasesInd;
