/* ============================================================
   empezar-reglas.js — Por dónde iniciar (v172; v174 sin la fase de instalar)
   ------------------------------------------------------------
   Un solo camino, en orden, desde instalar el portal hasta cerrar el primer
   mes. Cada paso se marca solo cuando el portal ve que ya está hecho (hay
   registros de ese tipo); los que no se pueden ver, se marcan a mano.
   Lo usan empezar.html (el camino completo) y el inicio («Tu siguiente paso»).
   Es puro (sin pantalla) para poder probarlo en Node.
   ============================================================ */
const EMPEZAR = (function () {
  /*  id, fase, título, por qué (la norma), cómo (una línea), página, cómo se sabe que está hecho
      hecho: 'srv' servidor · 'emp' datos de la empresa · 'usu' usuarios · 'tipo:x' hay registros de x
             'comite:x' comité x conformado · null = se marca a mano */
  const PASOS = [
    [
      'personal',
      1,
      'Sube el personal',
      'Todo sale de aquí: permisos, EPP, inducciones, exámenes.',
      'Pega la lista de Excel: nombre, cédula y cargo.',
      'habilitacion.html',
      'tipo:trabajador',
    ],
    [
      'politica',
      1,
      'Política y objetivos del SG-SST',
      'Res. 0312: política firmada, comunicada y con objetivos medibles.',
      'Documental → Política y objetivos: «Corregir», guarda y saca el PDF para firmar.',
      'documental.html',
      'tipo:politica',
    ],
    [
      'peligros',
      1,
      'Matriz de peligros',
      'Base de todo el sistema: de aquí salen controles, EPP e inspecciones.',
      'Peligros → un peligro por proceso o tarea, con su valoración y controles.',
      'peligros.html',
      'tipo:peligro',
    ],
    [
      'legal',
      1,
      'Matriz legal',
      'Las normas que le aplican a la empresa y si las cumple.',
      'Documental → Matriz legal: «+ Norma» o cárgala desde Excel.',
      'documental.html',
      'tipo:legal',
    ],
    [
      'copasst',
      1,
      'Conforma el COPASST (o el vigía)',
      'Obligatorio. Vigía si son menos de 10 trabajadores.',
      'COPASST → conformación con el acta de elección.',
      'copasst.html',
      'comite:copasst',
    ],
    [
      'convivencia',
      1,
      'Conforma el Comité de Convivencia',
      'Obligatorio (Res. 652 de 2012); se reúne cada 3 meses.',
      'Convivencia → conformación.',
      'convivencia.html',
      'comite:convivencia',
    ],
    [
      'plananual',
      1,
      'Arma el plan anual de trabajo',
      'Res. 0312: plan firmado con responsables, fechas y recursos.',
      'Plan anual → «Sugerencias según la empresa» lo arranca por ti.',
      'plan-anual.html',
      'tipo:plananual',
    ],
    [
      'emergencias',
      1,
      'Plan de emergencias y brigada',
      'Análisis de amenazas, brigada y al menos un simulacro al año.',
      'Emergencias → amenazas, brigada y puntos de encuentro.',
      'emergencias.html',
      'tipo:emergencia',
    ],
    [
      'induccion',
      2,
      'Haz la inducción del personal',
      'Antes de empezar a trabajar, con registro y evaluación.',
      'Inducción → por grupo; firman en el celular.',
      'induccion.html',
      'tipo:induccion',
    ],
    [
      'equipos',
      2,
      'Registra los equipos e imprime los QR',
      'Así se hacen los preoperacionales y las inspecciones desde el celular.',
      'Inspecciones → equipos; luego Etiquetas QR.',
      'inspecciones.html',
      'tipo:equipo',
    ],
    [
      'inspeccion',
      2,
      'Haz la primera inspección',
      'El cronograma de inspecciones sale de la matriz de peligros.',
      'Inspecciones → elige la plantilla y recorre el sitio.',
      'inspecciones.html',
      'tipo:inspeccion',
    ],
    [
      'entrega',
      2,
      'Registra la primera entrega de EPP',
      'Con firma del trabajador: es la prueba ante la ARL.',
      'Entrega de EPP → busca la cédula y firma.',
      'entrega-epp.html',
      'tipo:entrega',
    ],
    [
      'cierre',
      2,
      'Cierra el primer mes',
      'Indicadores y el informe mensual para la gerencia o el cliente.',
      'Cierre del mes; luego Informe mensual → PDF.',
      'cierre-mes.html',
      'tipo:cierremes',
    ],
  ];
  const FASES = { 1: 'Montar la base del SG-SST', 2: 'Poner a andar el primer mes' };   // v174: sin «instalar el portal»
  /** Los tipos de registro que hay que pedir para saber qué está hecho. */
  const TIPOS = [
    ...new Set(
      PASOS.map((p) => p[6])
        .filter((h) => h && /^(tipo|comite):/.test(h))
        .map((h) => (h.indexOf('comite:') === 0 ? 'comite' : h.slice(5))),
    ),
  ];

  /**
   * @param {object} c { servidor:bool, empresa:bool, usuarios:bool|null, rows:[], manual:{id:true}, activo:(href)=>bool }
   * @returns { pasos:[{id,fase,t,porque,como,href,hecho,auto}], hechos, total, siguiente, fases }
   */
  function evaluar(c) {
    const rows = c.rows || [],
      man = c.manual || {},
      activo = c.activo || (() => true);
    const hay = (t) => rows.some((x) => x.tipo === t);
    const comite = (k) =>
      rows.some(
        (x) =>
          x.tipo === 'comite' &&
          (String((x.resumen || {}).comite || '').toLowerCase() === k || String(x.id || '').toUpperCase() === 'CMT-' + k.toUpperCase()),
      );
    const pasos = PASOS.filter((p) => activo(p[5])).map((p) => {
      const h = p[6];
      let auto = null;
      if (h === 'srv') auto = !!c.servidor;
      else if (h === 'emp') auto = !!c.empresa;
      else if (h === 'usu') auto = c.usuarios === null || c.usuarios === undefined ? null : !!c.usuarios;
      else if (h && h.indexOf('tipo:') === 0) auto = c.rows ? hay(h.slice(5)) : null;
      else if (h && h.indexOf('comite:') === 0) auto = c.rows ? comite(h.slice(7)) : null;
      return { id: p[0], fase: p[1], t: p[2], porque: p[3], como: p[4], href: p[5], auto: auto === true, hecho: auto === true || !!man[p[0]] };
    });
    const hechos = pasos.filter((p) => p.hecho).length;
    return {
      pasos,
      hechos,
      total: pasos.length,
      siguiente: pasos.find((p) => !p.hecho) || null,
      fases: Object.keys(FASES).map((f) => ({ n: Number(f), t: FASES[f], pasos: pasos.filter((p) => p.fase === Number(f)) })),
    };
  }
  return { PASOS, FASES, TIPOS, evaluar };
})();
if (typeof module !== 'undefined') module.exports = EMPEZAR;
