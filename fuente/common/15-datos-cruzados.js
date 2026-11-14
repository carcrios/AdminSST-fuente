/* ============================================================
   15-datos-cruzados.js — Lo que ya está en el portal no se vuelve a pedir (v179)
   ------------------------------------------------------------
   Un dato se escribe una vez y las demás pantallas lo traen solas.
   Aquí: los peligros de un cargo salen de la matriz de peligros
   (columna «Cargos expuestos»), para la matriz de EPP por cargo, el
   profesiograma y donde se pidan.
   Coincide si el cargo está en «Cargos expuestos» (igual, contenido, o
   «todos»); si ningún peligro nombra el cargo, prueba con las palabras
   del cargo en el proceso, la zona o la actividad (p. ej. «Operario de
   producción» ↔ proceso «Producción»).
   Es puro (sin pantalla): lo prueban las pruebas en Node.
   ============================================================ */
const DatosCruzados = (function () {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const VACIAS = /^(de|del|la|las|el|los|y|en|para|con|operario|operaria|auxiliar|asistente|tecnico|tecnica|jefe|lider|coordinador|coordinadora|profesional|analista|general|senior|junior)$/;
  const res = (p) => (p && p.resumen) || p || {};
  /** Peligros de la matriz que aplican a un cargo. peligros = filas de tipo «peligro» ({resumen} o el doc). */
  function peligrosDelCargo(cargo, peligros) {
    const n = norm(cargo);
    if (!n) return { lista: [], texto: '', como: '' };
    const filas = peligros || [];
    const nombra = filas.filter((p) => {
      const c = norm(res(p).cargos);
      if (!c) return false;
      const lst = c.split(/[,;/\n]| y /).map((x) => x.trim()).filter(Boolean);
      return lst.some((k) => k === n || /^todos?( los cargos| el personal)?$/.test(k) || (k.length > 3 && (n.indexOf(k) !== -1 || k.indexOf(n) !== -1)));
    });
    let lista = nombra,
      como = nombra.length ? 'cargos expuestos' : '';
    if (!lista.length) {
      const pal = n.split(' ').filter((w) => w.length > 3 && !VACIAS.test(w));
      if (pal.length) {
        lista = filas.filter((p) => {
          const r = res(p),
            t = norm([r.proceso, r.zona, r.actividad, r.tarea].join(' '));
          return pal.some((w) => new RegExp('\\b' + w.replace(/[^a-z0-9]/g, '').slice(0, Math.max(4, w.length - 2))).test(t));
        });
        if (lista.length) como = 'proceso o actividad';
      }
    }
    const textos = [];
    lista.forEach((p) => {
      const r = res(p),
        t = [r.clasificacion, r.peligro || r.subtipo].filter(Boolean).join(': ');
      if (t && textos.indexOf(t) === -1) textos.push(t);
    });
    return { lista, texto: textos.join('; '), como };
  }
  return { peligrosDelCargo, norm };
})();
