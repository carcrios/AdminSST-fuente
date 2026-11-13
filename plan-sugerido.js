/* ============================================================
   plan-sugerido.js — Plan anual de trabajo armado según la empresa (v105)
   ------------------------------------------------------------
   Propone las actividades del año con lo que el portal ya sabe:
   · estándares que le aplican (7, 21 o 60, Res. 0312 de 2019),
   · número de trabajadores (COPASST o vigía),
   · peligros de la matriz (alturas, confinados, eléctrico, caliente,
     izaje, químico, biomecánico, psicosocial, físico),
   · sustancias químicas, vehículos y contratistas registrados.
   Cada actividad dice POR QUÉ se propone. Es una propuesta: el
   responsable del SG-SST la revisa, quita, agrega y asigna.
   v107: fases del PHVA con su explicación y la fase sugerida, tipos,
   formas de darla por cumplida y el cálculo del avance (por actividad,
   mes, fase y total, con la cobertura de las capacitaciones).
   ============================================================ */
const PLAN_SUGERIDO = (function () {
  const T = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], TRIM = [3, 6, 9, 12];
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /** Peligros de la matriz que hablan de un tema (por tipo, descripción o tarea). */
  function buscar(peligros, re, clase) {
    return (peligros || []).filter((p) => (clase && norm(p.clasificacion) === norm(clase)) || re.test(norm([p.subtipo, p.peligro, p.tarea, p.actividad].join(' '))));
  }
  const expuestos = (l) => l.reduce((a, p) => a + (Number(p.expuestos) || 0), 0);
  function porMatriz(l, que) { const n = expuestos(l); return 'En la matriz de peligros: ' + que + (n ? ' (' + n + ' expuestos)' : '') + '.'; }

  /** ctx: {grupo, trabajadores, responsable, peligros:[…], sustancias, vehiculos, contratistas, copasst} */
  function proponer(ctx) {
    const g = Number(ctx.grupo) || 60, trab = Number(ctx.trabajadores) || 0, R = ctx.responsable || '', out = [];
    const add = (clave, ciclo, actividad, tipo, meses, por, extra) => out.push(Object.assign({ clave, ciclo, actividad, tipo, meses: meses.slice(), auto: '', responsable: R, recursos: '', metaPersonas: '', por }, extra || {}));
    const grupoTxt = 'Le aplican ' + g + ' estándares (Res. 0312 de 2019).';
    // ── Planear
    add('firma-plan', 'Planear', 'Aprobar y firmar el plan anual de trabajo (empleador y responsable del SG-SST)', 'Documental', [1], 'Estándar 2.4.1: el plan lo firman el empleador y el responsable.');
    add('rev-matriz', 'Planear', 'Actualizar la matriz de peligros con participación de los trabajadores', 'Peligros', [1], 'Se actualiza al menos una vez al año (estándares 4.1.1 y 4.1.2).', { auto: 'revmatriz' });
    add('politica', 'Planear', 'Revisar la política y los objetivos del SG-SST', 'Documental', [1], 'La política se revisa cada año (estándar 2.1.1).');
    if (g >= 21) add('matriz-legal', 'Planear', 'Actualizar la matriz legal', 'Documental', [1, 7], 'Estándar 2.7.1 y normas nuevas del semestre.');
    add('autoevaluacion', 'Planear', 'Autoevaluación de estándares mínimos (Res. 0312)', 'Auditoría', [1], grupoTxt);
    if (g >= 21) add('sociodemografico', 'Planear', 'Actualizar el perfil sociodemográfico y el diagnóstico de condiciones de salud', 'Salud', [2], 'Estándar 3.1.1.');
    // ── Hacer: personas
    add('induccion', 'Hacer', 'Inducción y reinducción en SST', 'Capacitación', [2], 'Estándar 1.2.2: a todos los trabajadores, con registro.', { metaPersonas: trab || '', auto: 'induccion' });
    add('charlas', 'Hacer', 'Charlas de seguridad sobre los peligros prioritarios', 'Capacitación', T, 'Estándar 1.2.1: programa de capacitación según los peligros identificados.', { metaPersonas: trab || '', auto: 'charlas' });
    add('examenes', 'Hacer', 'Exámenes médicos ocupacionales periódicos', 'Salud', [3], 'Estándar 3.1.4 y Res. 1843 de 2025.', { auto: 'examenes' });
    add('epp', 'Hacer', 'Entrega y reposición de EPP, con capacitación en su uso', 'EPP', [6, 12], 'Estándar 4.2.6.');
    if (g >= 21) add('mantenimiento', 'Hacer', 'Mantenimiento preventivo de instalaciones, equipos y herramientas', 'Inspección', [2, 5, 8, 11], 'Estándar 4.2.5.');
    if (g >= 21) add('estilos', 'Hacer', 'Actividades de estilos de vida y entornos saludables', 'Salud', [4, 9], 'Estándares 3.1.2 y 3.1.7.');
    // Comités: con 10 o más trabajadores, COPASST (reunión mensual); con menos, vigía.
    const conCopasst = trab >= 10 || !!ctx.copasst;
    if (conCopasst) add('copasst', 'Hacer', 'Reunión mensual del COPASST', 'Comité', T, (trab ? trab + ' trabajadores: ' : '') + 'COPASST con reunión mensual (Res. 2013 de 1986).', { auto: 'copasst', responsable: 'Presidente del COPASST' });
    else add('vigia', 'Hacer', 'Seguimiento del Vigía de SST a inspecciones, reportes y acciones', 'Comité', TRIM, 'Con menos de 10 trabajadores el SG-SST tiene Vigía de SST.');
    if (g >= 60) add('cap-copasst', 'Hacer', 'Capacitación del ' + (conCopasst ? 'COPASST' : 'Vigía de SST') + ' para cumplir sus funciones', 'Capacitación', [2], 'Estándar 1.1.7.');
    add('convivencia', 'Hacer', 'Reunión ordinaria del Comité de Convivencia Laboral', 'Comité', TRIM, 'Estándar 1.1.8: comité conformado y funcionando.', { auto: 'convivencia', responsable: 'Presidente del Comité de Convivencia' });
    add('inspecciones', 'Hacer', 'Inspecciones planeadas (cronograma de inspecciones)', 'Inspección', T, 'Estándar 4.2.4: con participación del COPASST o vigía.', { auto: 'inspecciones' });
    // ── Hacer: según los peligros de la matriz
    const P = ctx.peligros || [];
    const alt = buscar(P, /altura|caida|andamio|escalera|techo|arnes/);
    if (alt.length) {
      add('alturas-cap', 'Hacer', 'Curso o reentrenamiento en trabajo en alturas (Res. 4272 de 2021)', 'Capacitación', [3], porMatriz(alt, 'trabajo en alturas'), { metaPersonas: expuestos(alt) || '' });
      add('alturas-prog', 'Hacer', 'Programa de protección contra caídas: inspección de equipos y sistemas de acceso', 'Inspección', TRIM, porMatriz(alt, 'trabajo en alturas'));
    }
    const conf = buscar(P, /confinad|tanque|pozo|silo|alcantarilla/);
    if (conf.length) add('confinados', 'Hacer', 'Capacitación en espacios confinados y rescate (Res. 491 de 2020)', 'Capacitación', [4], porMatriz(conf, 'espacios confinados'), { metaPersonas: expuestos(conf) || '' });
    const ele = buscar(P, /electric|tension|energizad|tablero/);
    if (ele.length) add('electrico', 'Hacer', 'Capacitación en riesgo eléctrico y bloqueo y etiquetado', 'Capacitación', [5], porMatriz(ele, 'riesgo eléctrico'), { metaPersonas: expuestos(ele) || '' });
    const cal = buscar(P, /soldad|oxicorte|caliente|esmeril|chispa|llama/);
    if (cal.length) add('caliente', 'Hacer', 'Capacitación en trabajo en caliente y prevención de incendios', 'Capacitación', [6], porMatriz(cal, 'trabajo en caliente'), { metaPersonas: expuestos(cal) || '' });
    const iza = buscar(P, /izaje|carga suspendida|grua|polipasto|montacarga|diferencial/);
    if (iza.length) add('izaje', 'Hacer', 'Capacitación en izaje de cargas (operador y aparejador)', 'Capacitación', [7], porMatriz(iza, 'izaje de cargas'), { metaPersonas: expuestos(iza) || '' });
    const qui = buscar(P, /quimic|solvente|vapor|gas|polvo|humo/, 'Químico');
    if (qui.length || ctx.sustancias) {
      const por = ctx.sustancias ? ctx.sustancias + ' sustancia(s) química(s) en el inventario.' : porMatriz(qui, 'peligro químico');
      add('sga-cap', 'Hacer', 'Capacitación en el SGA: etiquetas, pictogramas y fichas de seguridad (Res. 773 de 2021, art. 21)', 'Capacitación', [8], por, { metaPersonas: expuestos(qui) || '' });
      add('sga-inv', 'Hacer', 'Revisar el inventario de sustancias, sus fichas de seguridad y la compatibilidad en el almacenamiento', 'Peligros', [2, 8], por);
    }
    const bio = buscar(P, /postura|carga manual|movimiento repetitivo|biomecanic|levantamiento/, 'Biomecánico');
    if (bio.length) add('biomecanico', 'Hacer', 'Pausas activas y prevención de lesiones osteomusculares', 'Salud', TRIM, porMatriz(bio, 'peligro biomecánico'), { metaPersonas: expuestos(bio) || '' });
    const psi = buscar(P, /psicosocial|estres|carga mental|jornada/, 'Psicosocial');
    if (g >= 21 || psi.length) add('psicosocial', 'Hacer', 'Aplicar o hacer seguimiento a la batería de riesgo psicosocial (Res. 2764 de 2022)', 'Salud', [5], psi.length ? porMatriz(psi, 'peligro psicosocial') : grupoTxt);
    const fis = buscar(P, /ruido|iluminacion|vibracion|temperatura|radiacion/, 'Físico');
    if (fis.length && g >= 60) add('mediciones', 'Hacer', 'Mediciones ambientales de los peligros físicos prioritarios', 'Peligros', [5], porMatriz(fis, 'peligro físico') + ' Estándar 4.1.4.');
    // ── Emergencias
    if (g >= 21) add('brigada', 'Hacer', 'Capacitación y dotación de la brigada de emergencias', 'Emergencias', [3, 8], 'Estándar 5.1.2.');
    add('simulacro', 'Hacer', 'Simulacro de evacuación', 'Emergencias', [10], 'Plan de emergencias con simulacro al menos una vez al año (Dec. 1072, art. 2.2.4.6.25).', { auto: 'simulacro' });
    // ── Vehículos y contratistas
    if (ctx.vehiculos) {
      add('pesv', 'Hacer', 'Seguimiento al plan estratégico de seguridad vial (Res. 40595 de 2022)', 'Seguridad vial', TRIM, ctx.vehiculos + ' vehículo(s) registrado(s).');
      add('vial-cap', 'Hacer', 'Capacitación en seguridad vial para conductores', 'Capacitación', [4], ctx.vehiculos + ' vehículo(s) registrado(s).', { metaPersonas: ctx.conductores || '' });
    }
    if (ctx.contratistas || g >= 21) add('contratistas', 'Hacer', 'Evaluación de contratistas y proveedores en SST', 'Contratistas', [6, 12], ctx.contratistas ? ctx.contratistas + ' contratista(s) registrado(s). Estándar 2.10.1.' : 'Estándar 2.10.1.');
    // ── Verificar y actuar
    add('indicadores', 'Verificar', 'Medición de indicadores del SG-SST', 'Indicadores', T, 'Res. 0312, art. 30: indicadores mensuales.', { auto: 'indicadores' });
    if (g >= 21) add('auditoria', 'Verificar', 'Auditoría interna del SG-SST (con el COPASST o vigía)', 'Auditoría', [11], 'Estándares 6.1.2 y 6.1.4.', { auto: 'auditoria' });
    add('revision', 'Verificar', 'Revisión por la alta dirección', 'Documental', [12], 'Estándar 6.1.3.', { auto: 'revision' });
    if (g >= 60) add('rendicion', 'Verificar', 'Rendición de cuentas', 'Documental', [12], 'Estándar 2.6.1.');
    add('seguimiento', 'Actuar', 'Seguimiento al plan de acción', 'Mejora', TRIM, 'Estándares 7.1.1 a 7.1.4.');
    return out;
  }
  /* ── Ciclo PHVA (v107): qué es cada fase y cuál sugerir según lo que se escribe ── */
  const CICLOS_INFO = {
    Planear: { que: 'Definir, programar y documentar', ej: 'Política y objetivos, matriz de peligros, matriz legal, presupuesto, programas, autoevaluación.' },
    Hacer: { que: 'Ejecutar lo programado', ej: 'Capacitaciones y charlas, inspecciones, exámenes médicos, entrega de EPP, simulacros, reuniones de comités.' },
    Verificar: { que: 'Medir y revisar si funcionó', ej: 'Indicadores, auditoría interna, revisión por la dirección, rendición de cuentas.' },
    Actuar: { que: 'Corregir y mejorar', ej: 'Acciones correctivas, preventivas y de mejora (también las que salen de la auditoría y de la revisión por la dirección).' }
  };
  /* Tipos de actividad y la fase en que suelen ir. «Otro» deja escribir el tipo. */
  const TIPOS = ['Capacitación', 'Inspección', 'Comité', 'Salud', 'Emergencias', 'Peligros', 'EPP', 'Documental', 'Indicadores', 'Auditoría', 'Mejora'];
  const TIPO_CICLO = { 'Capacitación': 'Hacer', 'Inspección': 'Hacer', 'Comité': 'Hacer', 'Salud': 'Hacer', 'Emergencias': 'Hacer', 'EPP': 'Hacer', 'Peligros': 'Planear', 'Documental': 'Planear', 'Indicadores': 'Verificar', 'Auditoría': 'Verificar', 'Mejora': 'Actuar' };
  /* Cómo se da por cumplida: con un registro del portal (la clave) o la marca quien la hace (''). */
  const AUTO = [['inspecciones', 'Inspecciones registradas en el portal'], ['copasst', 'Acta de reunión ordinaria del COPASST'], ['convivencia', 'Acta de reunión ordinaria del Comité de Convivencia'],
    ['charlas', 'Asistencia a charlas (planillas firmadas)'], ['induccion', 'Inducciones y reinducciones registradas'], ['simulacro', 'Simulacro registrado'], ['auditoria', 'Auditoría cerrada'],
    ['revision', 'Revisión por la dirección registrada'], ['revmatriz', 'Revisión de la matriz de peligros'], ['examenes', 'Exámenes médicos registrados'], ['indicadores', 'Datos de indicadores del mes'],
    // v157: más actividades que se cumplen solas con lo que ya queda en el portal
    ['entregaepp', 'Entregas de EPP registradas'], ['dotacion', 'Entregas de dotación registradas'], ['pve', 'Seguimientos de los programas de vigilancia'], ['inspeccionesemerg', 'Inspección de extintores, botiquines y camillas']];
  const AUTO_CICLO = { inspecciones: 'Hacer', copasst: 'Hacer', convivencia: 'Hacer', charlas: 'Hacer', induccion: 'Hacer', simulacro: 'Hacer', examenes: 'Hacer', auditoria: 'Verificar', revision: 'Verificar', indicadores: 'Verificar', revmatriz: 'Planear', entregaepp: 'Hacer', dotacion: 'Hacer', pve: 'Hacer', inspeccionesemerg: 'Hacer' };
  // Por palabras de la actividad (se revisan en este orden: lo más específico primero).
  const REGLAS_CICLO = [
    ['Actuar', /plan de (accion|mejoramiento)|acciones? (correctiv|preventiv|de mejora)|mejora continua|cierre de (las )?acciones|lecciones aprendidas/, 'es una acción de mejora'],
    ['Verificar', /auditori|indicador|revision por la (alta )?direccion|rendicion de cuentas|evaluar el (cumplimiento|plan|sg)|verificar|medir el/, 'es medir, auditar o revisar resultados'],
    ['Planear', /actualizar|definir|programar|elaborar|disenar|documentar|politica|objetivos|matriz legal|presupuesto|aprobar|identificar|autoevaluacion|sociodemografico|diagnostico|procedimiento/, 'es definir, programar o documentar'],
    ['Hacer', /capacita|charla|induccion|curso|entrenamiento|inspecci|examen|simulacro|reunion|entrega|pausas|vacun|mantenimiento|brigada|jornada|campana|intervencion|bateria|mediciones ambientales|inventario|taller|dotacion/, 'es ejecutar en campo']
  ];
  /** Fase sugerida: {ciclo, por}. Primero las palabras de la actividad, luego el registro que la cumple y por último el tipo. */
  function sugerirCiclo(actividad, tipo, auto) {
    const t = norm(actividad);
    for (const r of REGLAS_CICLO) if (t && r[1].test(t)) return { ciclo: r[0], por: 'por lo que dice la actividad (' + r[2] + ')' };
    if (AUTO_CICLO[auto]) return { ciclo: AUTO_CICLO[auto], por: 'porque se cumple con: ' + ((AUTO.find((x) => x[0] === auto) || [])[1] || '').toLowerCase() };
    if (TIPO_CICLO[tipo]) return { ciclo: TIPO_CICLO[tipo], por: 'porque es de tipo ' + tipo };
    return { ciclo: 'Hacer', por: 'porque la mayoría de actividades del plan son de ejecución' };
  }
  /** Tipo que parece por el nombre de la actividad ('' si no se sabe). */
  function sugerirTipo(actividad) {
    const t = norm(actividad);
    const R = [['Capacitación', /capacita|charla|induccion|curso|entrenamiento|taller/], ['Inspección', /inspecci|mantenimiento/], ['Comité', /copasst|vigia|convivencia|comite/], ['Emergencias', /simulacro|brigada|emergencia|evacuacion/],
      ['Salud', /examen|medic[oa]|pausas|vacun|psicosocial|estilos de vida|salud/], ['EPP', /\bepp\b|proteccion personal|dotacion/], ['Indicadores', /indicador/], ['Auditoría', /auditori|autoevaluacion/], ['Mejora', /plan de accion|acciones? (correctiv|preventiv|de mejora)|mejora/],
      ['Peligros', /peligro|riesgo|matriz de|sustancia|quimic/], ['Documental', /politica|objetivos|matriz legal|documento|procedimiento|rendicion|revision por la/]];
    const x = R.find((r) => r[1].test(t)); return x ? x[0] : '';
  }

  /* ── Avance del plan (v107): por actividad, por mes, por fase y total ──
     auto[clave][mes] = {n, personas, fecha, det}: lo que el portal encontró hecho.
     Cuenta lo de los meses ya cerrados; el mes en curso solo si ya está hecho (no baja el % el día 1). */
  const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Math.max(0, Number(v)));
  function mesHoy(anio, hoy) { const a = String(anio), h = String(hoy).slice(0, 4); return a < h ? 13 : a > h ? 0 : Number(String(hoy).slice(5, 7)); }
  function estadoMes(plan, a, m, auto, hoy) {
    if ((a.meses || []).indexOf(m) === -1) return '';
    const e = ((plan.ejec || {})[a.uid] || {})[m];
    if (e && e.hecho) return e.origen ? 'auto' : 'hecho';
    if (a.auto && auto && auto[a.auto] && auto[a.auto][m]) return 'auto';
    return m < mesHoy(plan.anio, hoy) ? 'atraso' : 'pend';
  }
  /** Personas esperadas y asistentes de una ejecución (null si no se sabe). */
  function sesion(plan, a, m, auto) {
    const e = ((plan.ejec || {})[a.uid] || {})[m] || {}, d = a.auto && auto && auto[a.auto] && auto[a.auto][m];
    const esperados = num(e.esperados) != null ? num(e.esperados) : num(a.metaPersonas);
    const asistentes = e.hecho && !e.origen ? num(e.asistentes) : (d && d.personas != null ? num(d.personas) : num(e.asistentes));
    return { esperados, asistentes };
  }
  const pct = (a, b) => (b ? Math.round(a * 100 / b) : 0);
  function calcular(plan, auto, hoy) {
    const mh = mesHoy(plan.anio, hoy), porMes = {}, porCiclo = {}, porAct = {};
    for (let m = 1; m <= 12; m++) porMes[m] = { prog: 0, hechas: 0 };
    let prog = 0, hechas = 0, progHasta = 0, hechasHasta = 0, capP = 0, capH = 0, capEsp = 0, capAsis = 0;
    (plan.actividades || []).forEach((a) => {
      const c = porCiclo[a.ciclo] = porCiclo[a.ciclo] || { prog: 0, hechas: 0, progHasta: 0, hechasHasta: 0 };
      const x = porAct[a.uid] = { prog: 0, hechas: 0, esp: 0, asis: 0 };
      (a.meses || []).forEach((m) => {
        const st = estadoMes(plan, a, m, auto, hoy), ok = st === 'hecho' || st === 'auto', vence = m < mh || (m === mh && ok);
        prog++; c.prog++; x.prog++; porMes[m].prog++;
        if (ok) { hechas++; c.hechas++; x.hechas++; porMes[m].hechas++; }
        if (vence) { progHasta++; c.progHasta++; if (ok) { hechasHasta++; c.hechasHasta++; } }
        if (a.tipo === 'Capacitación' && ok) { const s = sesion(plan, a, m, auto); if (s.esperados && s.asistentes != null) { x.esp += s.esperados; x.asis += s.asistentes; if (vence) { capEsp += s.esperados; capAsis += s.asistentes; } } }
        if (a.tipo === 'Capacitación' && vence) { capP++; if (ok) capH++; }
      });
      x.pct = pct(x.hechas, x.prog); x.cobertura = x.esp ? pct(x.asis, x.esp) : null;
    });
    Object.keys(porCiclo).forEach((k) => { const c = porCiclo[k]; c.pct = pct(c.hechas, c.prog); c.cumplimiento = c.progHasta ? pct(c.hechasHasta, c.progHasta) : null; });
    return { prog, hechas, progHasta, hechasHasta, cumplimiento: progHasta ? pct(hechasHasta, progHasta) : 0, avance: pct(hechas, prog), capP, capH, ejecCap: capP ? pct(capH, capP) : 0,
      capEsp, capAsis, cobertura: capEsp ? pct(capAsis, capEsp) : null, porMes, porCiclo, porAct, mesHoy: mh };
  }

  /* Nombres con que venían estas actividades en la plantilla típica (planes creados antes de la v105). */
  const ANTES = { charlas: 'Capacitaciones por peligros prioritarios (charlas)', convivencia: 'Reunión mensual del Comité de Convivencia', inspecciones: 'Inspecciones planeadas',
    psicosocial: 'Intervención del riesgo psicosocial', brigada: 'Capacitación de la brigada de emergencias', epp: 'Entrega y reposición de EPP' };
  /** Lo que ya está en el plan (por clave, por el mismo nombre, por su nombre de antes o porque se marca solo con lo mismo) no se vuelve a proponer. */
  function faltantes(propuesta, actividades) {
    const l = actividades || [], ya = new Set(l.map((a) => a.clave).filter(Boolean)), nombres = new Set(l.map((a) => norm(a.actividad))), autos = new Set(l.map((a) => a.auto).filter(Boolean));
    return propuesta.filter((p) => !ya.has(p.clave) && !nombres.has(norm(p.actividad)) && !(ANTES[p.clave] && nombres.has(norm(ANTES[p.clave]))) && !(p.auto && autos.has(p.auto)));
  }
  return { proponer, faltantes, CICLOS_INFO, TIPOS, TIPO_CICLO, AUTO, sugerirCiclo, sugerirTipo, mesHoy, estadoMes, sesion, calcular };
})();
if (typeof module !== 'undefined') module.exports = PLAN_SUGERIDO;
