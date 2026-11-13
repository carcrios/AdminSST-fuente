/* ============================================================
   informe-reglas.js — Informe del SG-SST con sugerencias (v107)
   ------------------------------------------------------------
   Toma lo que ya está registrado en el portal (todos los módulos) y,
   para un periodo (mes, trimestre o año):
     · calcula las cifras (accidentalidad, plan anual, acciones,
       inspecciones, comités, salud, emergencias, químicos…);
     · arma las SUGERENCIAS DE MEJORA con reglas claras: cada una dice
       por qué sale (con el dato), la norma y el módulo donde se arregla;
     · dibuja las gráficas en SVG propio (sin librerías).
   Es código puro (sin pantalla): lo usan informe.html y gerencia.html,
   y las pruebas lo ejecutan en Node.
   Los datos de salud individual solo entran si quien mira es SST
   (el servidor tampoco los manda a otros roles).
   ============================================================ */
const INFORME = (function () {
  const AT = 'Accidente de trabajo';
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const TRIM = ['primer', 'segundo', 'tercer', 'cuarto'];
  const pad = (n) => String(n).padStart(2, '0');
  const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
  const mesMas = (m, n) => { const p = m.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1 + n, 1)).toISOString().slice(0, 7); };
  const finMes = (m) => sumarDias(mesMas(m, 1) + '-01', -1);
  const nombreMes = (m) => MESES[Number(m.slice(5, 7)) - 1] + ' de ' + m.slice(0, 4);
  const enMes = (f, m) => String(f || '').slice(0, 7) === m;
  const n0 = (v) => Number(v) || 0;
  /** Fecha AAAA-MM-DD → DD/MM/AAAA para los textos. */
  const fd = (iso) => /^\d{4}-\d{2}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 10).split('-').reverse().join('/') : String(iso || '');
  const fmt = (v, d) => v === null || v === undefined || isNaN(v) ? '—' : Number(v).toLocaleString('es-CO', { maximumFractionDigits: d == null ? 1 : d });
  /* Días hábiles (sin sábados ni domingos) si no llega el calendario de festivos. */
  const habilesSimple = (iso, n) => { let d = iso, k = 0; while (k < n) { d = sumarDias(d, 1); const w = new Date(d + 'T12:00:00Z').getUTCDay(); if (w !== 0 && w !== 6) k++; } return d; };

  /* ── Periodos ──
     tipo 'mes' (valor AAAA-MM), 'trimestre' (AAAA-T1…T4) o 'anio' (AAAA). */
  function periodo(tipo, valor) {
    let meses, nombre, anterior;
    if (tipo === 'trimestre') {
      const a = Number(valor.slice(0, 4)), t = Number(valor.slice(-1));
      meses = [0, 1, 2].map((i) => a + '-' + pad((t - 1) * 3 + 1 + i));
      nombre = TRIM[t - 1] + ' trimestre de ' + a; anterior = t === 1 ? (a - 1) + '-T4' : a + '-T' + (t - 1);
    } else if (tipo === 'anio') {
      meses = [...Array(12)].map((_, i) => valor + '-' + pad(i + 1)); nombre = 'año ' + valor; anterior = String(Number(valor) - 1);
    } else { tipo = 'mes'; meses = [valor]; nombre = nombreMes(valor); anterior = mesMas(valor, -1); }
    return { tipo, valor, meses, ini: meses[0] + '-01', fin: finMes(meses[meses.length - 1]), nombre, anterior };
  }
  /** Las opciones de cada tipo de periodo, de la más reciente hacia atrás. */
  function opciones(tipo, hoy) {
    const m = hoy.slice(0, 7), a = Number(hoy.slice(0, 4)), t = Math.floor((Number(hoy.slice(5, 7)) - 1) / 3) + 1;
    if (tipo === 'trimestre') return [...Array(8)].map((_, i) => { const k = (t - 1) - i, aa = a + Math.floor(k / 4), tt = ((k % 4) + 4) % 4 + 1; return { v: aa + '-T' + tt, t: TRIM[tt - 1].replace(/^./, (c) => c.toUpperCase()) + ' trimestre ' + aa }; });
    if (tipo === 'anio') return [0, 1, 2].map((i) => ({ v: String(a - i), t: 'Año ' + (a - i) }));
    return [...Array(13)].map((_, i) => { const mm = mesMas(m, -i); return { v: mm, t: nombreMes(mm).replace(/^./, (c) => c.toUpperCase()) }; });
  }
  /** Periodo por defecto: los primeros 10 días del mes, el mes pasado (es el que se está cerrando). */
  function porDefecto(hoy) { return Number(hoy.slice(8, 10)) <= 10 ? mesMas(hoy.slice(0, 7), -1) : hoy.slice(0, 7); }

  /* ── Indicadores de accidentalidad (Res. 0312 de 2019, art. 30) ──
     Los mismos cálculos del tablero de la gerencia y de indicadores. */
  /** v148: LOS días de un mes para la severidad, iguales en Indicadores, Gerencia, Cierre del mes e Informe (Res. 0312, art. 30).
   *  - Incapacidad: los días del registro de ausentismo por AT cuentan en el mes en que se pierden.
   *  - Un AT del mes sin ausencias registradas para esa persona: sus días de incapacidad cuentan en el mes del AT.
   *  - Cargados: en el mes del AT (mortal sin dato = 6.000, ANSI Z16.1). */
  const cc = (v) => String(v || '').replace(/\D/g, '');
  function diasAT(rows, m) {
    const ini = m + '-01', fin = sumarDias(mesMas(m, 1) + '-01', -1);
    const aus = rows.filter((x) => x.tipo === 'ausencia' && x.resumen.causa === AT && x.resumen.inicio && x.resumen.fin);
    const conAus = new Set(aus.map((x) => cc(x.resumen.cedula)).filter(Boolean));
    let inc = 0;
    aus.forEach((x) => { const a = x.resumen.inicio > ini ? x.resumen.inicio : ini, b = x.resumen.fin < fin ? x.resumen.fin : fin; if (b >= a) inc += Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1; });
    const atM = rows.filter((x) => x.tipo === 'reporte' && x.resumen.clase === AT && enMes(x.resumen.fecha, m));
    atM.forEach((x) => { const c = cc(x.resumen.lesionadoCc); if (!c || !conAus.has(c)) inc += n0(x.resumen.diasIncapacidad); });
    const carg = atM.reduce((a, x) => a + (n0(x.resumen.diasCargados) || (x.resumen.mortal ? 6000 : 0)), 0);
    return { incapacidad: inc, cargados: carg, total: inc + carg, mortalSinCargados: atM.some((x) => x.resumen.mortal && !n0(x.resumen.diasCargados)) };
  }
  function mesInd(rows, m) {
    const de = (t) => rows.filter((x) => x.tipo === t);
    const dm = (de('mes').find((x) => x.resumen.mes === m) || {}).resumen || {}, trab = n0(dm.trabajadores);
    const at = de('reporte').filter((x) => x.resumen.clase === AT && enMes(x.resumen.fecha, m));
    const dias = diasAT(rows, m).total;
    return { m, trab, at: at.length, dias, sinTrabajadores: !trab && at.length > 0, frecuencia: trab ? at.length / trab * 100 : null, severidad: trab ? dias / trab * 100 : null,
      ausentismo: n0(dm.diasProgramados) ? n0(dm.diasAusencia) / n0(dm.diasProgramados) * 100 : null, casosEL: dm.casosEL, elNuevos: n0(dm.casosELNuevos) };
  }
  const mesesDe = (anio) => [...Array(12)].map((_, i) => anio + '-' + pad(i + 1));
  /** Indicadores mínimos del año con los datos de cada mes (hasta el mes de hoy). */
  function anual(rows, anio, hoy) {
    const ms = mesesDe(anio).filter((m) => m <= hoy.slice(0, 7)).map((m) => mesInd(rows, m)), conTrab = ms.filter((x) => x.trab);
    const prom = conTrab.length ? conTrab.reduce((a, x) => a + x.trab, 0) / conTrab.length : 0;
    const atA = rows.filter((x) => x.tipo === 'reporte' && x.resumen.clase === AT && String(x.resumen.fecha).slice(0, 4) === anio), mort = atA.filter((x) => x.resumen.mortal).length;
    // v148: frecuencia y severidad del año acumuladas (AT del año ÷ promedio de trabajadores), no promedio de tasas
    const diasA = ms.reduce((a, x) => a + x.dias, 0);
    const ultEL = [...ms].reverse().find((x) => x.casosEL !== undefined && x.casosEL !== '');
    const promDe = (l, k) => l.length ? l.reduce((a, x) => a + x[k], 0) / l.length : null;
    const conAus = ms.filter((x) => x.ausentismo !== null);
    return { ms, prom, at: atA.length, mort, mortalidad: atA.length ? mort * 100 / atA.length : null, frecuenciaAcum: prom ? atA.length / prom * 100 : null, severidadAcum: prom ? diasA / prom * 100 : null,
      prevalencia: prom && ultEL ? n0(ultEL.casosEL) / prom * 100000 : null, incidencia: prom ? ms.reduce((a, x) => a + x.elNuevos, 0) / prom * 100000 : null,
      frecuenciaProm: promDe(conTrab, 'frecuencia'), severidadProm: promDe(conTrab, 'severidad'), ausentismoProm: promDe(conAus, 'ausentismo') };
  }
  /* ¿Hecho por el portal? (las mismas reglas que el plan anual y el cierre del mes) */
  function hechoAuto(rows, auto, m) {
    return rows.some((x) => { const s = x.resumen || {};
      if (auto === 'inspecciones') return x.tipo === 'inspeccion' && enMes(s.fecha, m);
      if (auto === 'copasst' || auto === 'convivencia') return x.tipo === 'reunion' && s.tipo === 'Ordinaria' && s.comite === auto && enMes(s.fecha, m);
      if (auto === 'simulacro') return x.tipo === 'simulacro' && enMes(s.fecha, m);
      if (auto === 'auditoria') return x.tipo === 'auditoria' && x.estado === 'CERRADA' && enMes(s.fechaEjecucion, m);
      if (auto === 'revision') return x.tipo === 'revision' && enMes(s.fecha, m);
      if (auto === 'revmatriz') return x.tipo === 'revmatriz' && enMes(s.fecha, m);
      if (auto === 'examenes') return x.tipo === 'examen' && enMes(s.fecha, m);
      if (auto === 'indicadores') return x.tipo === 'mes' && s.mes === m && s.trabajadores;
      if (auto === 'entregaepp') return x.tipo === 'entrega' && enMes(s.fecha || x.fecha, m);
      if (auto === 'dotacion') return x.tipo === 'dotacion' && enMes(s.fecha || x.fecha, m);
      if (auto === 'pve') return x.tipo === 'pvecaso' && enMes(s.ultimoSeguimiento, m);
      if (auto === 'inspeccionesemerg') return x.tipo === 'inspeccion' && /extintor|botiqu|camilla/i.test(String(s.plantilla || '') + ' ' + String(s.categoria || '')) && enMes(s.fecha, m);
      return false; });
  }
  /** Plan anual: programado y hecho en un mes (con el documento completo del plan). */
  function planMes(plan, rows, m) {
    const nm = Number(m.slice(5, 7)), acts = ((plan && plan.actividades) || []).filter((a) => (a.meses || []).indexOf(nm) !== -1);
    const hechas = acts.filter((a) => { const e = ((plan.ejec || {})[a.uid] || {})[nm]; return (e && e.hecho) || (a.auto && hechoAuto(rows, a.auto, m)); });
    return { m, prog: acts.length, hechas: hechas.length, faltan: acts.filter((a) => hechas.indexOf(a) === -1) };
  }
  const ultimo = (l, k) => l.map((x) => String((x.resumen || {})[k] || '')).filter(Boolean).sort().slice(-1)[0] || '';
  const FREC_DIAS = { diaria: 1, semanal: 7, quincenal: 15, mensual: 30, bimestral: 60, trimestral: 91, semestral: 182, anual: 365 };
  const EMERGENCIA = ['extintor', 'botiquin', 'camilla'];

  /* ═════════════ Cálculo de todo lo del periodo ═════════════
     ctx = { rows, hoy, periodo, esSst, plan (doc del plan anual del año), evid (lista de EVIDENCIAS.evaluar),
             perfil, charlas (sesiones de asistencia) | null, habilitado(fila) opcional, sumarHabiles opcional,
             nombresCategoria {id: nombre} opcional, calidad (true si el módulo está activo) } */
  function calcular(ctx) {
    const rows = ctx.rows || [], hoy = ctx.hoy, P = ctx.periodo, anio = P.meses[P.meses.length - 1].slice(0, 4);
    const de = (t) => rows.filter((x) => x.tipo === t);
    const enP = (f) => { f = String(f || '').slice(0, 10); return f >= P.ini && f <= P.fin; };
    const hab = ctx.sumarHabiles || habilesSimple;
    const corte = P.fin < hoy ? P.fin : hoy;               // hasta dónde se mira el periodo (si está en curso, hasta hoy)
    const transcurridos = P.meses.filter((m) => m <= hoy.slice(0, 7));
    const cerrados = P.meses.filter((m) => m < hoy.slice(0, 7));
    const K = { P, hoy, anio, corte, esSst: ctx.esSst !== false, perfil: ctx.perfil || {}, enCurso: P.fin >= hoy && P.ini <= hoy, futuro: P.ini > hoy };

    /* Accidentalidad: cada mes del periodo y los 12 meses de tendencia */
    const reps = de('reporte');
    K.meses = P.meses.map((m) => { const r = mesInd(rows, m), rm = reps.filter((x) => enMes(x.resumen.fecha, m));
      return Object.assign(r, { incidentes: rm.filter((x) => x.resumen.clase === 'Incidente').length, actos: rm.filter((x) => /Acto|Condici/.test(x.resumen.clase)).length,
        insp: de('inspeccion').filter((x) => enMes(x.resumen.fecha, m)).length }); });
    const finT = P.fin.slice(0, 7) < hoy.slice(0, 7) ? P.fin.slice(0, 7) : hoy.slice(0, 7);
    K.tendencia = [...Array(12)].map((_, i) => mesInd(rows, mesMas(finT, i - 11))).map((x) => Object.assign(x, { enP: P.meses.indexOf(x.m) !== -1 }));
    const Pa = periodo(P.tipo, P.anterior), mAnt = Pa.meses.map((m) => mesInd(rows, m));
    const prom = (l, k) => { const v = l.filter((x) => x[k] !== null && x.trab); return v.length ? v.reduce((a, x) => a + x[k], 0) / v.length : null; };
    const mT = K.meses.filter((x) => x.m <= hoy.slice(0, 7));
    const repP = reps.filter((x) => enP(x.resumen.fecha)), atP = repP.filter((x) => x.resumen.clase === AT);
    const evento = (x) => x.resumen.clase === AT || x.resumen.clase === 'Incidente';
    K.acc = {
      at: atP.length, atAnt: mAnt.reduce((a, x) => a + x.at, 0), mortales: atP.filter((x) => x.resumen.mortal).length, graves: atP.filter((x) => x.resumen.grave).length,
      dias: atP.reduce((a, x) => a + n0(x.resumen.diasIncapacidad) + n0(x.resumen.diasCargados), 0),
      incidentes: repP.filter((x) => x.resumen.clase === 'Incidente').length, actos: repP.filter((x) => /Acto|Condici/.test(x.resumen.clase)).length,
      frec: prom(mT, 'frecuencia'), frecAnt: prom(mAnt, 'frecuencia'), sev: prom(mT, 'severidad'), sevAnt: prom(mAnt, 'severidad'),
      aus: (() => { const v = mT.filter((x) => x.ausentismo !== null); return v.length ? v.reduce((a, x) => a + x.ausentismo, 0) / v.length : null; })(),
      ausAnt: (() => { const v = mAnt.filter((x) => x.ausentismo !== null); return v.length ? v.reduce((a, x) => a + x.ausentismo, 0) / v.length : null; })(),
      porClase: (() => { const o = {}; repP.forEach((x) => { const c = x.resumen.clase || 'Otro'; o[c] = (o[c] || 0) + 1; }); return o; })(),
      // Eventos (de cualquier fecha) con plazos vencidos a hoy
      sinInv: reps.filter((x) => evento(x) && (x.resumen.investigacion || {}).estado !== 'CERRADA' && x.resumen.fecha && sumarDias(x.resumen.fecha, 15) < hoy),
      sinFurat: reps.filter((x) => x.resumen.clase === AT && !(x.resumen.furat || {}).radicado && x.resumen.fecha && hab(x.resumen.fecha, 2) < hoy),
      anual: anual(rows, anio, hoy)
    };
    K.datos = { sinMes: cerrados.filter((m) => !de('mes').some((x) => x.resumen.mes === m && x.resumen.trabajadores)),
      sinCierre: cerrados.filter((m) => !de('cierremes').some((x) => x.resumen.mes === m || x.id === 'CIE-' + m)) };

    /* Plan de acción */
    const acc = de('accion'), ab = acc.filter((x) => x.estado !== 'CERRADA');
    const venc = ab.filter((x) => x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < hoy);
    const cerrP = acc.filter((x) => x.estado === 'CERRADA' && enP(x.resumen.fechaCierre));
    const ase = acc.filter((x) => x.resumen.origen === 'Asesor SST');
    K.acciones = { total: acc.length, abiertas: ab.length, vencidas: venc.length, alDia: ab.length - venc.length,
      vencidas30: venc.filter((x) => diasEntre(x.resumen.fechaCompromiso, hoy) > 30).sort((a, b) => String(a.resumen.fechaCompromiso).localeCompare(String(b.resumen.fechaCompromiso))),
      vencidasL: venc, cerradasP: cerrP.length, nuevasP: acc.filter((x) => enP(x.fecha)).length,
      eficaces: cerrP.filter((x) => /^s[ií]/i.test(x.resumen.eficaz)).length, noEficaces: cerrP.filter((x) => /^no/i.test(x.resumen.eficaz)).length,
      cerradas: acc.filter((x) => x.estado === 'CERRADA').length,
      asesorAbiertas: ase.filter((x) => x.estado !== 'CERRADA').length, asesorVencidas: ase.filter((x) => x.estado !== 'CERRADA' && x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < hoy).length,
      informe: acc.filter((x) => x.resumen.origen === 'Informe del SG-SST') };

    /* Plan anual de trabajo */
    const pat = de('plananual').find((x) => String(x.resumen.anio) === anio), plan = ctx.plan || null;
    K.plan = { existe: !!pat, id: pat ? pat.id : '', firmado: !!(pat && pat.resumen.firmado === true), cumplimiento: pat ? n0(pat.resumen.cumplimiento) : null, avance: pat ? n0(pat.resumen.avance) : null,
      capP: pat ? n0(pat.resumen.capProgramadas) : 0, capH: pat ? n0(pat.resumen.capEjecutadas) : 0, cobertura: pat && pat.resumen.cobertura !== '' && pat.resumen.cobertura != null ? n0(pat.resumen.cobertura) : null,
      responsable: pat ? String(pat.resumen.responsable || '') : '',
      anioMeses: plan ? mesesDe(anio).map((m) => planMes(plan, rows, m)) : [],
      periodo: plan ? transcurridos.map((m) => planMes(plan, rows, m)) : [] };
    K.plan.atrasadas = K.plan.periodo.filter((x) => x.m < hoy.slice(0, 7)).reduce((a, x) => a.concat(x.faltan.map((f) => ({ m: x.m, actividad: f.actividad, responsable: f.responsable || '' }))), []);

    /* Inspecciones: las del periodo, lo programado (cronograma) y los equipos sin inspección al día */
    const insP = de('inspeccion').filter((x) => enP(x.resumen.fecha));
    const progs = de('proginsp').filter((x) => x.resumen.activo !== false);
    const progMes = (m) => progs.filter((x) => String(x.resumen.meses || '').split(/\s*,\s*/).some((v) => v === m || (String(x.resumen.anio) === m.slice(0, 4) && /^\d{1,2}$/.test(v) && Number(v) === Number(m.slice(5, 7)))));
    let progN = 0, progH = 0;
    cerrados.concat(transcurridos.filter((m) => cerrados.indexOf(m) === -1)).forEach((m) => { progMes(m).forEach((p) => { const hecha = de('inspeccion').some((h) => enMes(h.resumen.fecha, m) && (h.resumen.progId === p.id || (!h.resumen.progId && !h.resumen.equipoId && p.resumen.tipoInspeccion && p.resumen.tipoInspeccion !== 'Rutinaria' && h.resumen.tipoInspeccion === p.resumen.tipoInspeccion && h.resumen.plantilla === p.resumen.plantilla)));
      if (m < hoy.slice(0, 7) || hecha) { progN++; if (hecha) progH++; } }); });
    const eq = de('equipo').filter((x) => x.resumen.activo !== false), cats = {};
    eq.forEach((x) => { const r = x.resumen, f = FREC_DIAS[r.frecuencia]; if (!f || f < 30) return;   // las diarias y semanales son preoperacionales
      const c = cats[r.categoria] = cats[r.categoria] || { cat: r.categoria, nombre: (ctx.nombresCategoria || {})[r.categoria] || r.categoria, equipos: 0, atrasados: 0, ultima: '', frec: f };
      c.equipos++; const u = String(r.ultimaInspeccion || '').slice(0, 10); if (u > c.ultima) c.ultima = u;
      if (!u || diasEntre(u, hoy) > f + 15) c.atrasados++; });
    K.insp = { periodo: insP.length, nc: insP.filter((x) => x.resumen.resultado === 'NO CONFORME').length, prog: progN, progHechas: progH,
      ult3m: de('inspeccion').filter((x) => String(x.resumen.fecha) >= sumarDias(hoy, -92)).length, total: de('inspeccion').length,
      categorias: Object.keys(cats).map((k) => Object.assign(cats[k], { dias: cats[k].ultima ? diasEntre(cats[k].ultima, hoy) : null })),
      equiposVencidos: eq.filter((x) => Object.values(x.resumen.vencimientos || {}).some((f) => f && f < hoy)).length };

    /* Comités */
    const comite = (k) => { const c = de('comite').find((x) => x.resumen.comite === k), per = c && c.resumen.periodo;
      const reu = de('reunion').filter((x) => x.resumen.comite === k && (k !== 'copasst' || x.resumen.tipo === 'Ordinaria'));
      const ult = ultimo(reu, 'fecha');
      return { existe: !!c, vigente: !!(per && per.fin >= hoy), fin: per ? per.fin : '', ultima: ult, dias: ult ? diasEntre(ult, hoy) : null, reunionesP: reu.filter((x) => enP(x.resumen.fecha)).length, creado: c ? String(c.creado || c.fecha || '').slice(0, 10) : '' }; };
    K.comites = { copasst: comite('copasst'), convivencia: comite('convivencia'), quejasAbiertas: de('queja').filter((x) => x.estado === 'ABIERTA' || x.resumen.estado === 'ABIERTA').length,
      trabajadores: n0(K.perfil.trabajadores) };

    /* Salud (solo SST): exámenes periódicos vencidos (el último de cada persona) y restricciones */
    if (K.esSst) {
      const ult = {}; de('examen').forEach((x) => { const k = String(x.resumen.cedula || x.resumen.nombre).replace(/\D/g, '') || x.resumen.nombre; if (!ult[k] || String(x.resumen.fecha) > String(ult[k].resumen.fecha)) ult[k] = x; });
      const vig = Object.keys(ult).map((k) => ult[k]).filter((x) => x.resumen.tipoExamen !== 'Egreso');
      K.salud = { examenes: vig.length, vencidos: vig.filter((x) => x.resumen.proxima && x.resumen.proxima < hoy).length, enP: de('examen').filter((x) => enP(x.resumen.fecha)).length,
        restriccionesSinComunicar: de('examen').filter((x) => x.resumen.tieneRestricciones === 'Sí' && x.resumen.comunicada !== 'Sí').length,
        diagnostico: !!de('perfil').some((x) => String(x.resumen.anio) >= String(Number(anio) - 1)) };
    } else K.salud = null;

    /* Autoevaluación, auditorías y revisión por la dirección */
    const autos = de('auditoria').filter((x) => /^RES0312/.test(x.resumen.plantilla) && x.estado === 'CERRADA').sort((a, b) => String(b.resumen.fechaEjecucion).localeCompare(String(a.resumen.fechaEjecucion)));
    const au = autos[0];
    K.auto = au ? { id: au.id, puntaje: n0(au.resumen.puntaje), fecha: String(au.resumen.fechaEjecucion || ''), dias: au.resumen.fechaEjecucion ? diasEntre(au.resumen.fechaEjecucion, hoy) : null } : null;
    K.auditorias12 = de('auditoria').filter((x) => x.estado === 'CERRADA' && String(x.resumen.fechaEjecucion) >= sumarDias(hoy, -365)).length;
    K.revision = ultimo(de('revision'), 'fecha');
    K.politica = de('politica').filter((x) => !/OBSOLET/i.test(x.estado)).sort((a, b) => String(b.resumen.fechaFirma).localeCompare(String(a.resumen.fechaFirma)))[0] || null;

    /* Matriz de peligros */
    const pel = de('peligro'), crit = pel.filter((x) => ['I', 'II'].indexOf(x.resumen.nivel) !== -1);
    K.peligros = { total: pel.length, criticos: crit.length, criticosPend: crit.filter((x) => n0(x.resumen.controlesPendientes) > 0).length,
      pendientes: pel.reduce((a, x) => a + n0(x.resumen.controlesPendientes), 0), revision: ultimo(de('revmatriz'), 'fecha') };

    /* Emergencias */
    const em = de('emergencia');
    K.emergencias = { planes: em.length, vigentes: em.filter((x) => !x.resumen.proximaRevision || x.resumen.proximaRevision >= hoy).length, simulacro: ultimo(de('simulacro'), 'fecha'),
      simulacrosP: de('simulacro').filter((x) => enP(x.resumen.fecha)).length,
      brigadistas: em.reduce((a, x) => a + n0(x.resumen.brigadistas), 0), capacitados: em.reduce((a, x) => a + n0(x.resumen.brigadistasCapacitados), 0) };

    /* Químicos */
    const sus = de('sustancia').filter((x) => x.resumen.estado !== 'Fuera de uso' && x.estado !== 'Fuera de uso'), gq = de('gestquim')[0];
    K.quimicos = { sustancias: sus.length, fdsVencidas: sus.filter((x) => x.resumen.venceHoja && x.resumen.venceHoja < hoy).length, sinFds: sus.filter((x) => x.resumen.hojaSeguridad === 'No').length,
      sinEtiqueta: sus.filter((x) => x.resumen.etiquetaSGA && !/^Conforme/i.test(x.resumen.etiquetaSGA)).length,
      capVencida: !!(gq && gq.resumen.proximaCapacitacion && gq.resumen.proximaCapacitacion < hoy) };

    /* Ambiental */
    K.ambiental = { aspectos: de('aspecto').length, significativos: de('aspecto').filter((x) => x.estado === 'SIGNIFICATIVO' || /signific/i.test(x.resumen.significancia || '') && !/no/i.test(x.resumen.significancia || '')).length,
      respelSinCert: de('residuo').filter((x) => /Peligroso/i.test(x.estado || x.resumen.clase || '') && String(x.resumen.fecha || x.fecha).slice(0, 4) === anio && !x.resumen.certificado).length,
      residuosP: de('residuo').filter((x) => enP(x.resumen.fecha || x.fecha)).length };

    /* Calidad (ISO 9001), si el módulo está activo */
    const cerradaPqrs = (x) => /RESPONDIDA|CERRAD/i.test(x.estado || x.resumen.estado || '');
    K.calidad = ctx.calidad === false ? null : { pqrsP: de('pqrs').filter((x) => enP(x.resumen.fecha)).length,
      pqrsVencidas: de('pqrs').filter((x) => !cerradaPqrs(x) && x.resumen.fechaLimite && x.resumen.fechaLimite < hoy).length,
      riesgosVencidos: de('riesgocal').filter((x) => !/TRATAD|CERRAD/i.test(x.estado || '') && x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < hoy).length };

    /* Contratistas, EPP, personas y capacitación */
    const ctr = de('contratista').filter((x) => x.estado !== 'INACTIVO');
    K.contratistas = { total: ctr.length, problemas: ctr.filter((x) => n0(x.resumen.docsFaltan) > 0 || n0(x.resumen.docsVencidos) > 0 || (x.resumen.venceDocs && x.resumen.venceDocs < hoy)).length };
    const rep = {}; de('entrega').forEach((x) => String(x.resumen.vencimientos || '').split(/\s*;\s*/).forEach((v) => { const p = v.split('|'); if (p.length < 2) return; const k = String(x.resumen.cedula || x.resumen.nombre) + '|' + p[0].toLowerCase(); if (!rep[k] || String(x.fecha || x.resumen.fecha) > rep[k].f) rep[k] = { f: String(x.fecha || x.resumen.fecha), v: p[1] }; }));
    K.epp = { controlados: Object.keys(rep).length, vencidos: Object.keys(rep).filter((k) => rep[k].v < hoy).length, entregasP: de('entrega').filter((x) => enP(x.resumen.fecha || x.fecha)).length };
    const trab = de('trabajador').filter((x) => x.resumen.activo !== false);
    const habOk = ctx.habilitado || ((x) => Object.keys(x.resumen.req || {}).every((k) => { const q = x.resumen.req[k]; return q && (q.vence ? q.vence >= hoy : q.fecha) && !/no apto|aplazado/i.test(q.apto || ''); }));
    K.personas = { activos: trab.length, habilitados: trab.filter(habOk).length, induccion: trab.filter((x) => { const q = (x.resumen.req || {}).induccion; return q && (q.fecha || q.vence) && (!q.vence || q.vence >= hoy); }).length,
      induccionesP: de('induccion').filter((x) => enP(x.resumen.fecha)).length };
    const ch = ctx.charlas || null;
    K.capacitacion = { charlasOk: !!ch, charlasP: ch ? ch.filter((s) => enP(s.semanaDel)).reduce((a, x) => a + n0(x.charlas), 0) : null,
      asistentesP: ch ? ch.filter((s) => enP(s.semanaDel)).reduce((a, x) => a + n0(x.asistentes), 0) : null };

    /* Evidencias por estándar (si se evaluaron) y reporte anual */
    if (ctx.evid && ctx.evid.length) {
      const l = ctx.evid, tot = l.reduce((a, x) => a + n0(x.valor), 0), ok = l.filter((x) => x.e === 'ok');
      K.evid = { total: l.length, ok: ok.length, parcial: l.filter((x) => x.e === 'parcial').length, falta: l.filter((x) => x.e === 'falta').length,
        manual: l.filter((x) => x.e === 'manual' || x.e === 'reservado').length, pct: tot ? Math.round(ok.reduce((a, x) => a + n0(x.valor), 0) * 1000 / tot) / 10 : 0,
        faltan: l.filter((x) => x.e === 'falta').sort((a, b) => n0(b.valor) - n0(a.valor)) };
    } else K.evid = null;
    K.reporteAnual = { registrado: de('reporteanual').some((x) => String(x.resumen.anio) === hoy.slice(0, 4) && x.resumen.fechaRegistro) };
    return K;
  }

  /* ═════════════ Sugerencias de mejora ═════════════
     Cada regla mira un dato y, si hace falta, devuelve:
     { id, prioridad: 'alta'|'media'|'baja', area, titulo, porque (con el dato), norma, href, accion: {hallazgo, accion, tipoAccion, prioridad} } */
  const S = (id, prioridad, area, titulo, porque, norma, href, accion, tipo) => ({ id, prioridad, area, titulo, porque, norma, href,
    accion: { hallazgo: titulo + '. ' + porque, accion: accion, tipoAccion: tipo || 'Correctiva', prioridad: prioridad === 'alta' ? 'Alta' : prioridad === 'media' ? 'Media' : 'Baja' } });
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  function sugerencias(K) {
    const out = [], add = (x) => { if (x) out.push(x); }, hoy = K.hoy, mesHoy = Number(hoy.slice(5, 7)), A = K.acc;
    const pctTxt = (v) => fmt(v, 0) + ' %';
    /* Datos para medir */
    if (!K.perfil.trabajadores) add(S('perfil', 'media', 'Sistema', 'Falta el perfil de la empresa', 'Sin el número de trabajadores y la clase de riesgo no se sabe si aplican 7, 21 o 60 estándares.', 'Res. 0312 de 2019, arts. 3, 9 y 16', 'gerencia.html', 'Definir el perfil de la empresa (trabajadores y clase de riesgo).', 'De mejora'));
    if (K.datos.sinMes.length) add(S('datos_mes', 'alta', 'Indicadores', plural(K.datos.sinMes.length, 'mes sin datos', 'meses sin datos') + ' para los indicadores', 'Faltan los trabajadores, días programados y ausencias de ' + K.datos.sinMes.map(nombreMes).join(', ') + ': sin ellos no se calculan frecuencia, severidad ni ausentismo.', 'Res. 0312 de 2019, art. 30', 'indicadores.html', 'Registrar los datos del mes en Indicadores (nómina y ausentismo).'));
    /* Plan anual */
    if (!K.plan.existe) add(S('plan_anual', 'alta', 'Plan anual', 'No hay plan anual de trabajo ' + K.anio, 'El plan anual con metas, responsables, recursos y cronograma es obligatorio y es la base de este informe.', 'Dec. 1072 de 2015, art. 2.2.4.6.8 num. 7; Res. 0312 de 2019, estándar 2.4.1', 'plan-anual.html', 'Armar y firmar el plan anual de trabajo ' + K.anio + '.'));
    else {
      const c = K.plan.cumplimiento, esperado = K.anio === hoy.slice(0, 4) ? Math.round(mesHoy * 100 / 12) : 100;
      if (c !== null && c < 90 && (K.plan.periodo.some((x) => x.prog) || !K.plan.anioMeses.length)) add(S('plan_bajo', c < 70 ? 'alta' : 'media', 'Plan anual', 'El plan anual va al ' + pctTxt(c) + ' de lo programado a la fecha',
        'Cumplimiento a la fecha ' + pctTxt(c) + ' (meta ≥ 90 %); avance del año ' + pctTxt(K.plan.avance) + (K.anio === hoy.slice(0, 4) ? ' y estamos en ' + MESES[mesHoy - 1] + ' (lo esperado sería cerca del ' + esperado + ' %)' : '') + '.' +
        (K.plan.atrasadas.length ? ' Atrasadas: ' + K.plan.atrasadas.slice(0, 4).map((a) => a.actividad).join('; ') + (K.plan.atrasadas.length > 4 ? '…' : '') + '.' : ''),
        'Dec. 1072 de 2015, art. 2.2.4.6.8 num. 7; Res. 0312 de 2019, estándar 2.4.1', 'plan-anual.html', 'Reprogramar las actividades atrasadas del plan anual con responsable y fecha, y revisar los recursos.'));
      if (!K.plan.firmado) add(S('plan_firmas', 'media', 'Plan anual', 'El plan anual ' + K.anio + ' no está firmado', 'El plan debe estar firmado por el empleador y el responsable del SG-SST.', 'Res. 0312 de 2019, estándar 2.4.1', 'plan-anual.html', 'Firmar el plan anual (empleador y responsable del SG-SST).', 'De mejora'));
      if (K.plan.capP && K.plan.capH * 100 / K.plan.capP < 80) add(S('capacitacion', 'media', 'Capacitación', 'La capacitación va al ' + pctTxt(K.plan.capH * 100 / K.plan.capP), K.plan.capH + ' de ' + K.plan.capP + ' capacitaciones programadas a la fecha' + (K.plan.cobertura !== null ? ', cobertura ' + pctTxt(K.plan.cobertura) : '') + '.', 'Dec. 1072 de 2015, art. 2.2.4.6.11; Res. 0312 de 2019, estándar 1.2.1', 'plan-anual.html', 'Programar las capacitaciones atrasadas y medir su cobertura.'));
    }
    /* Plan de acción */
    const v30 = K.acciones.vencidas30;
    if (v30.length) add(S('acciones_30', v30.length >= 3 ? 'alta' : 'media', 'Plan de acción', plural(v30.length, 'acción vencida', 'acciones vencidas') + ' con más de 30 días',
      'La más antigua venció el ' + fd(v30[0].resumen.fechaCompromiso) + ' (' + (v30[0].resumen.accion || v30[0].resumen.hallazgo || '') + (v30[0].resumen.responsable ? ', ' + v30[0].resumen.responsable : '') + ').',
      'Dec. 1072 de 2015, art. 2.2.4.6.33; Res. 0312 de 2019, estándar 7.1.1', 'plan-accion.html', 'Revisar con cada responsable las acciones vencidas: cerrarlas con evidencia o reprogramarlas con causa justificada.'));
    else if (K.acciones.vencidas) add(S('acciones_vencidas', 'media', 'Plan de acción', plural(K.acciones.vencidas, 'acción vencida', 'acciones vencidas'), 'De ' + K.acciones.abiertas + ' abiertas, ' + K.acciones.vencidas + ' ya pasaron su fecha de compromiso.', 'Dec. 1072 de 2015, art. 2.2.4.6.33', 'plan-accion.html', 'Hacer seguimiento a las acciones vencidas y cerrarlas con evidencia.'));
    if (K.acciones.noEficaces) add(S('acciones_eficacia', 'media', 'Plan de acción', plural(K.acciones.noEficaces, 'acción cerrada no fue eficaz', 'acciones cerradas no fueron eficaces') + ' en el periodo', 'Se cerraron pero la verificación dice que no eliminaron la causa.', 'Dec. 1072 de 2015, art. 2.2.4.6.33 (verificar la eficacia)', 'plan-accion.html', 'Replantear las acciones no eficaces con un nuevo análisis de causas.'));
    if (K.acciones.asesorVencidas) add(S('tareas_asesor', 'media', 'Plan de acción', plural(K.acciones.asesorVencidas, 'tarea del asesor vencida', 'tareas del asesor vencidas'), 'El asesor SST dejó tareas que ya pasaron su fecha límite (' + K.acciones.asesorAbiertas + ' abiertas en total).', 'Dec. 1072 de 2015, art. 2.2.4.6.33', 'plan-accion.html', 'Atender las tareas del asesor SST: anotar avances o cerrarlas con su evidencia.'));
    /* Accidentalidad */
    const sube = (a, b) => a !== null && b !== null && b > 0 ? (a - b) / b * 100 : null;
    const dF = sube(A.frec, A.frecAnt);
    if (A.at && ((dF !== null && dF >= 20) || (dF === null && A.at > A.atAnt))) add(S('accidentalidad', 'alta', 'Accidentalidad', dF !== null ? 'La accidentalidad subió ' + fmt(dF, 0) + ' %' : 'Hubo más accidentes que en el periodo anterior',
      plural(A.at, 'accidente de trabajo', 'accidentes de trabajo') + ' en el periodo frente a ' + A.atAnt + ' en el anterior' + (dF !== null ? '; frecuencia promedio ' + fmt(A.frec, 2) + ' frente a ' + fmt(A.frecAnt, 2) + ' AT por cada 100 trabajadores' : '') + '.',
      'Dec. 1072 de 2015, art. 2.2.4.6.22; Res. 0312 de 2019, art. 30', 'reportes.html', 'Analizar las causas comunes de los accidentes del periodo, actualizar la matriz de peligros y reforzar los controles en las tareas involucradas.'));
    if (A.mortales || A.graves) add(S('at_graves', 'alta', 'Accidentalidad', plural(A.mortales + A.graves, 'accidente grave o mortal', 'accidentes graves o mortales') + ' en el periodo', 'La investigación de los graves y mortales se remite a la ARL (y la de los mortales también a la Dirección Territorial del Ministerio del Trabajo).', 'Res. 1401 de 2007, art. 14', 'reportes.html', 'Verificar que la investigación se remitió a la ARL dentro del plazo y que sus recomendaciones están en el plan de acción.'));
    if (A.sinFurat.length) add(S('furat', 'alta', 'Accidentalidad', plural(A.sinFurat.length, 'accidente sin FURAT radicado', 'accidentes sin FURAT radicado'), 'Pasaron más de 2 días hábiles: ' + A.sinFurat.slice(0, 3).map((x) => x.id + ' (' + x.resumen.fecha + ')').join(', ') + '.', 'Dec. 1072 de 2015, art. 2.2.4.1.7; Res. 0156 de 2005', 'reportes.html', 'Radicar el FURAT en la ARL y anotar el número en el reporte.'));
    if (A.sinInv.length) add(S('investigaciones', 'alta', 'Accidentalidad', plural(A.sinInv.length, 'incidente o accidente sin investigar', 'incidentes o accidentes sin investigar'), 'Pasaron más de 15 días sin cerrar la investigación: ' + A.sinInv.slice(0, 3).map((x) => x.id).join(', ') + (A.sinInv.length > 3 ? '…' : '') + '.', 'Res. 1401 de 2007, art. 4; Res. 0312 de 2019, estándar 3.2.2', 'reportes.html', 'Investigar con el COPASST o vigía y el jefe inmediato, y pasar las medidas al plan de acción.'));
    const dA = sube(A.aus, A.ausAnt);
    if (dA !== null && dA >= 20 && A.aus >= 1) add(S('ausentismo', 'media', 'Salud', 'El ausentismo por causa médica subió ' + fmt(dA, 0) + ' %', 'Promedio ' + fmt(A.aus, 1) + ' % frente a ' + fmt(A.ausAnt, 1) + ' % en el periodo anterior.', 'Res. 0312 de 2019, art. 30', 'indicadores.html', 'Revisar las causas del ausentismo con el médico laboral y definir actividades de prevención.', 'Preventiva'));
    /* Inspecciones */
    K.insp.categorias.filter((c) => c.atrasados).forEach((c) => {
      const em = EMERGENCIA.indexOf(c.cat) !== -1, larga = c.dias === null || c.dias >= 90;
      add(S('insp_' + c.cat, em && larga ? 'alta' : 'media', 'Inspecciones', c.dias === null ? 'Sin inspecciones de ' + c.nombre.toLowerCase() + ' registradas' : 'Sin inspección de ' + c.nombre.toLowerCase() + ' en ' + (c.dias >= 60 ? Math.floor(c.dias / 30) + ' meses' : c.dias + ' días'),
        c.atrasados + ' de ' + c.equipos + ' en el inventario con la inspección atrasada' + (c.ultima ? '; la última fue el ' + c.ultima : '') + '.',
        'Res. 0312 de 2019, estándares 4.2.4 y 4.2.5' + (c.cat === 'extintor' ? '; NTC 2885 (extintores)' : ''), 'inspecciones.html', 'Inspeccionar ' + c.nombre.toLowerCase() + ' y dejar el registro en el portal.', 'Preventiva'));
    });
    if (K.insp.prog && K.insp.progHechas < K.insp.prog) add(S('insp_cronograma', 'media', 'Inspecciones', 'El cronograma de inspecciones va al ' + pctTxt(K.insp.progHechas * 100 / K.insp.prog), K.insp.progHechas + ' de ' + K.insp.prog + ' inspecciones programadas en el periodo.', 'Res. 0312 de 2019, estándar 4.2.4', 'inspecciones.html#cronograma', 'Hacer las inspecciones programadas pendientes (gerenciales y del COPASST).', 'Preventiva'));
    if (!K.insp.ult3m && (K.insp.total || K.personas.activos)) add(S('insp_ninguna', 'alta', 'Inspecciones', 'Ninguna inspección en los últimos 3 meses', 'Sin inspecciones no se verifica en campo que se cumplan los controles.', 'Res. 0312 de 2019, estándar 4.2.2', 'inspecciones.html', 'Programar y hacer inspecciones planeadas de las áreas y equipos críticos.', 'Preventiva'));
    if (K.insp.equiposVencidos) add(S('equipos_vencidos', 'media', 'Inspecciones', plural(K.insp.equiposVencidos, 'equipo con mantenimiento o certificación vencidos', 'equipos con mantenimiento o certificación vencidos'), 'Recargas, pruebas hidrostáticas o certificaciones con la fecha pasada.', 'Res. 0312 de 2019, estándar 4.2.5', 'inspecciones.html', 'Programar el mantenimiento o la certificación de los equipos vencidos.'));
    /* Comités */
    const cop = K.comites.copasst, nom = K.comites.trabajadores && K.comites.trabajadores < 10 ? 'Vigía de SST' : 'COPASST';
    if (!cop.existe) add(S('copasst', 'alta', 'Comités', 'No hay ' + nom + ' conformado en el portal', 'Toda empresa debe tener COPASST (10 o más trabajadores) o Vigía de SST (menos de 10).', 'Res. 2013 de 1986; Dec. 1072 de 2015, art. 2.2.4.6.8 num. 9; Res. 0312 de 2019, estándar 1.1.6', 'copasst.html', 'Convocar la elección y conformar el ' + nom + '.'));
    else {
      if (!cop.vigente) add(S('copasst_periodo', 'alta', 'Comités', 'El periodo del ' + nom + ' está vencido', cop.fin ? 'Venció el ' + fd(cop.fin) + ' (el periodo es de 2 años).' : 'No tiene periodo vigente.', 'Res. 2013 de 1986, art. 6', 'copasst.html', 'Organizar la elección del nuevo ' + nom + '.'));
      const sinReu = cop.dias === null ? (cop.creado && diasEntre(cop.creado, hoy) > 45) : cop.dias > 62;
      if (sinReu) add(S('copasst_reunion', 'alta', 'Comités', cop.dias === null ? 'El ' + nom + ' no tiene reuniones registradas' : 'El ' + nom + ' lleva ' + Math.floor(cop.dias / 30) + ' meses sin reunión', cop.ultima ? 'La última reunión ordinaria con acta fue el ' + fd(cop.ultima) + '; debe reunirse cada mes.' : 'Debe reunirse por lo menos una vez al mes, con acta.', 'Res. 2013 de 1986, art. 7', 'copasst.html', 'Programar la reunión mensual del ' + nom + ' y dejar el acta.'));
    }
    const cv = K.comites.convivencia;
    if (!cv.existe) add(S('convivencia', 'media', 'Comités', 'No hay Comité de Convivencia Laboral en el portal', 'Es obligatorio para prevenir y atender el acoso laboral.', 'Ley 1010 de 2006; Res. 3461 de 2025', 'convivencia.html', 'Conformar el Comité de Convivencia Laboral.'));
    else {
      if (!cv.vigente) add(S('convivencia_periodo', 'media', 'Comités', 'El periodo del Comité de Convivencia está vencido', cv.fin ? 'Venció el ' + fd(cv.fin) + '.' : 'No tiene periodo vigente.', 'Res. 3461 de 2025', 'convivencia.html', 'Elegir el nuevo Comité de Convivencia Laboral.'));
      if (cv.dias !== null ? cv.dias > 62 : (cv.creado && diasEntre(cv.creado, hoy) > 45)) add(S('convivencia_reunion', 'media', 'Comités', 'El Comité de Convivencia ' + (cv.dias === null ? 'no tiene reuniones registradas' : 'lleva ' + Math.floor(cv.dias / 30) + ' meses sin reunión'), 'Se reúne ordinariamente cada mes' + (cv.ultima ? '; la última fue el ' + cv.ultima : '') + '.', 'Res. 3461 de 2025, art. 9', 'convivencia.html', 'Programar la reunión mensual del Comité de Convivencia y dejar el acta.'));
    }
    /* Salud (solo SST) */
    if (K.salud) {
      if (K.salud.vencidos) add(S('examenes', K.salud.vencidos >= 3 ? 'alta' : 'media', 'Salud', plural(K.salud.vencidos, 'examen médico periódico vencido', 'exámenes médicos periódicos vencidos'), 'De ' + K.salud.examenes + ' personas con examen, ' + K.salud.vencidos + ' ya pasaron la fecha del siguiente (solo cantidades: sin nombres ni diagnósticos).', 'Res. 1843 de 2025 (evaluaciones médicas ocupacionales); Res. 0312 de 2019, estándar 3.1.4', 'salud.html', 'Programar con la IPS los exámenes periódicos vencidos según el profesiograma.'));
      if (K.salud.restriccionesSinComunicar) add(S('restricciones', 'media', 'Salud', plural(K.salud.restriccionesSinComunicar, 'restricción médica sin comunicar', 'restricciones médicas sin comunicar'), 'Las recomendaciones y restricciones se comunican por escrito al trabajador y se aplican en su cargo.', 'Res. 0312 de 2019, estándar 3.1.6', 'salud.html', 'Comunicar las restricciones médicas al trabajador y al jefe, con registro.'));
      if (!K.salud.diagnostico) add(S('diagnostico_salud', 'baja', 'Salud', 'Sin diagnóstico de condiciones de salud reciente', 'No hay diagnóstico de salud del año pasado ni de este.', 'Res. 0312 de 2019, estándar 3.1.1', 'salud.html', 'Pedir a la IPS el diagnóstico de condiciones de salud y actualizar el perfil sociodemográfico.', 'Preventiva'));
    }
    /* Autoevaluación, evidencias, auditoría y revisión */
    if (!K.auto || K.auto.dias > 365) add(S('autoevaluacion', 'alta', 'Revisar y mejorar', K.auto ? 'La autoevaluación de estándares mínimos tiene más de un año' : 'No hay autoevaluación de estándares mínimos', K.auto ? 'La última fue el ' + fd(K.auto.fecha) + '.' : 'Sin autoevaluación cerrada en el portal.', 'Res. 0312 de 2019, arts. 27 y 28', 'auditorias.html', 'Hacer la autoevaluación de estándares mínimos (Auditorías) y su plan de mejoramiento.'));
    else if (K.auto.puntaje < 60) add(S('valoracion_critica', 'alta', 'Revisar y mejorar', 'La autoevaluación quedó en estado crítico (' + fmt(K.auto.puntaje, 1) + ' %)', 'Con menos del 60 %: plan de mejoramiento inmediato, enviarlo a la ARL y reportar avances cada 3 meses.', 'Res. 0312 de 2019, art. 28', 'auditorias.html', 'Ejecutar el plan de mejoramiento de la autoevaluación y reportar avances a la ARL.'));
    else if (K.auto.puntaje <= 85) add(S('valoracion_moderada', 'media', 'Revisar y mejorar', 'La autoevaluación quedó moderadamente aceptable (' + fmt(K.auto.puntaje, 1) + ' %)', 'Entre 60 % y 85 %: plan de mejoramiento y reporte de avances a la ARL a los 6 meses.', 'Res. 0312 de 2019, art. 28', 'auditorias.html', 'Ejecutar el plan de mejoramiento y reportar avances a la ARL.'));
    if (K.evid && K.evid.falta) add(S('evidencias', K.evid.falta >= 5 ? 'alta' : 'media', 'Revisar y mejorar', plural(K.evid.falta, 'estándar sin evidencia', 'estándares sin evidencia') + ' en el portal', 'Los de más peso: ' + K.evid.faltan.slice(0, 4).map((x) => x.id + ' ' + String(x.texto).split(' — ')[0].slice(0, 60)).join('; ') + '.', 'Res. 0312 de 2019 (estándares mínimos)', 'evidencias.html', 'Completar la evidencia de los estándares que faltan (ver la carpeta de evidencias).', 'De mejora'));
    if (!K.auditorias12) add(S('auditoria', 'media', 'Revisar y mejorar', 'Sin auditoría del SG-SST en el último año', 'La auditoría se hace por lo menos una vez al año, planificada con el COPASST.', 'Dec. 1072 de 2015, art. 2.2.4.6.29; Res. 0312 de 2019, estándar 6.1.2', 'auditorias.html', 'Programar la auditoría anual del SG-SST con participación del COPASST.', 'De mejora'));
    if (!K.revision || diasEntre(K.revision, hoy) > 400) add(S('revision', 'media', 'Revisar y mejorar', 'Sin revisión por la dirección en el último año', K.revision ? 'La última fue el ' + fd(K.revision) + '.' : 'No hay revisión por la dirección registrada.', 'Dec. 1072 de 2015, art. 2.2.4.6.31; Res. 0312 de 2019, estándar 6.1.3', 'revision-direccion.html', 'Hacer la revisión anual por la dirección y comunicar sus resultados al COPASST.', 'De mejora'));
    if (!K.politica) add(S('politica', 'media', 'Planear', 'No hay política de SST firmada en el portal', 'La política debe estar firmada, fechada, divulgada y revisarse cada año.', 'Dec. 1072 de 2015, arts. 2.2.4.6.5 a 2.2.4.6.7; Res. 0312 de 2019, estándar 2.1.1', 'documental.html', 'Firmar y divulgar la política de SST.'));
    else if (K.politica.resumen.proximaRevision && K.politica.resumen.proximaRevision < hoy) add(S('politica_revision', 'baja', 'Planear', 'La política de SST pasó su fecha de revisión', 'Revisión prevista para el ' + K.politica.resumen.proximaRevision + '.', 'Dec. 1072 de 2015, art. 2.2.4.6.7', 'documental.html', 'Revisar y volver a divulgar la política de SST.', 'De mejora'));
    /* Peligros */
    if (!K.peligros.total) add(S('matriz', 'alta', 'Peligros', 'No hay matriz de peligros', 'Sin identificar y valorar los peligros no se pueden priorizar los controles.', 'Dec. 1072 de 2015, art. 2.2.4.6.15; Res. 0312 de 2019, estándar 4.1.1', 'peligros.html', 'Elaborar la matriz de peligros (GTC 45) de todos los procesos, con los trabajadores.'));
    else {
      if (!K.peligros.revision || diasEntre(K.peligros.revision, hoy) > 365) add(S('matriz_revision', 'media', 'Peligros', 'La matriz de peligros no se ha revisado en el último año', K.peligros.revision ? 'Última revisión: ' + fd(K.peligros.revision) + '.' : 'Sin revisiones registradas.', 'Dec. 1072 de 2015, art. 2.2.4.6.15 parág. 3; Res. 0312 de 2019, estándar 4.1.2', 'peligros.html', 'Revisar la matriz de peligros con los trabajadores (y después de cada accidente o cambio).', 'Preventiva'));
      if (K.peligros.criticosPend) add(S('controles', 'alta', 'Peligros', plural(K.peligros.criticosPend, 'riesgo no aceptable con controles pendientes', 'riesgos no aceptables con controles pendientes'), K.peligros.pendientes + ' medida(s) de intervención por implementar en la matriz.', 'Dec. 1072 de 2015, art. 2.2.4.6.24; Res. 0312 de 2019, estándar 4.2.1', 'peligros.html', 'Implementar las medidas de control de los riesgos I y II según la jerarquía de controles.', 'Preventiva'));
    }
    /* Emergencias */
    if (!K.emergencias.planes) add(S('emergencias', 'alta', 'Emergencias', 'No hay plan de emergencias', 'El plan de prevención, preparación y respuesta ante emergencias es obligatorio.', 'Dec. 1072 de 2015, art. 2.2.4.6.25; Res. 0312 de 2019, estándar 5.1.1', 'emergencias.html', 'Elaborar el plan de emergencias con su análisis de amenazas y vulnerabilidad.'));
    else {
      if (K.emergencias.vigentes < K.emergencias.planes) add(S('emergencias_revision', 'media', 'Emergencias', 'Plan de emergencias por actualizar', (K.emergencias.planes - K.emergencias.vigentes) + ' de ' + K.emergencias.planes + ' plan(es) pasaron su fecha de revisión.', 'Dec. 1072 de 2015, art. 2.2.4.6.25', 'emergencias.html', 'Actualizar el plan de emergencias.', 'Preventiva'));
      if (K.emergencias.brigadistas && K.emergencias.capacitados < K.emergencias.brigadistas) add(S('brigada', 'media', 'Emergencias', 'Brigadistas sin capacitación vigente', K.emergencias.capacitados + ' de ' + K.emergencias.brigadistas + ' brigadistas con capacitación vigente.', 'Dec. 1072 de 2015, art. 2.2.4.6.25 num. 11; Res. 0312 de 2019, estándar 5.1.2', 'emergencias.html', 'Capacitar y dotar a la brigada de emergencias.', 'Preventiva'));
    }
    if (!K.emergencias.simulacro || diasEntre(K.emergencias.simulacro, hoy) > 365) add(S('simulacro', 'media', 'Emergencias', 'Sin simulacro en el último año', K.emergencias.simulacro ? 'El último fue el ' + fd(K.emergencias.simulacro) + '.' : 'No hay simulacros registrados.', 'Dec. 1072 de 2015, art. 2.2.4.6.25 num. 12; Res. 0312 de 2019, estándar 5.1.1', 'emergencias.html', 'Programar un simulacro con la participación de todos los trabajadores.', 'Preventiva'));
    /* Químicos y ambiental */
    if (K.quimicos.fdsVencidas || K.quimicos.sinFds || K.quimicos.sinEtiqueta) add(S('quimicos', 'media', 'Químicos', 'Sustancias químicas con documentación incompleta', [K.quimicos.fdsVencidas ? K.quimicos.fdsVencidas + ' con la ficha de seguridad vencida' : '', K.quimicos.sinFds ? K.quimicos.sinFds + ' sin ficha de seguridad' : '', K.quimicos.sinEtiqueta ? K.quimicos.sinEtiqueta + ' sin etiqueta conforme al SGA' : ''].filter(Boolean).join('; ') + '.', 'Res. 773 de 2021 (SGA)', 'quimicos.html', 'Actualizar las fichas de seguridad y etiquetar los envases según el SGA.'));
    if (K.quimicos.capVencida) add(S('quimicos_cap', 'media', 'Químicos', 'Capacitación anual en el SGA vencida', 'Los trabajadores que manejan químicos se capacitan en el SGA por lo menos una vez al año.', 'Res. 773 de 2021, art. 21', 'quimicos.html', 'Programar la capacitación anual en el SGA.', 'Preventiva'));
    if (K.ambiental.respelSinCert) add(S('respel', 'media', 'Ambiental', plural(K.ambiental.respelSinCert, 'entrega de residuos peligrosos sin certificado', 'entregas de residuos peligrosos sin certificado') + ' en ' + K.anio, 'El generador debe conservar los certificados de aprovechamiento, tratamiento o disposición final.', 'Dec. 1076 de 2015, art. 2.2.6.1.3.1', 'ambiental.html', 'Pedir al gestor los certificados de disposición final de los RESPEL.'));
    /* Calidad, contratistas, EPP y personas */
    if (K.calidad && K.calidad.pqrsVencidas) add(S('pqrs', 'media', 'Calidad', plural(K.calidad.pqrsVencidas, 'PQRS vencida', 'PQRS vencidas'), 'Quejas o reclamos de clientes sin respuesta en el plazo.', 'ISO 9001:2015, num. 8.2.1 y 9.1.2', 'calidad.html', 'Responder las PQRS vencidas y analizar si requieren acción correctiva.'));
    if (K.calidad && K.calidad.riesgosVencidos) add(S('riesgos_calidad', 'baja', 'Calidad', plural(K.calidad.riesgosVencidos, 'riesgo de calidad sin tratar a tiempo', 'riesgos de calidad sin tratar a tiempo'), 'Tratamientos con la fecha de compromiso pasada.', 'ISO 9001:2015, num. 6.1', 'calidad.html', 'Hacer seguimiento al tratamiento de los riesgos y oportunidades.', 'Preventiva'));
    if (K.contratistas.problemas) add(S('contratistas', 'media', 'Contratistas', plural(K.contratistas.problemas, 'contratista con documentos faltantes o vencidos', 'contratistas con documentos faltantes o vencidos'), 'De ' + K.contratistas.total + ' contratistas activos.', 'Dec. 1072 de 2015, art. 2.2.4.6.28; Res. 0312 de 2019, estándar 2.10.1', 'contratistas.html', 'Pedir a los contratistas los documentos faltantes (seguridad social, ARL, SG-SST) antes de su próximo ingreso.'));
    if (K.epp.vencidos) add(S('epp', 'media', 'EPP', plural(K.epp.vencidos, 'elemento de protección con reposición vencida', 'elementos de protección con reposición vencida'), 'De ' + K.epp.controlados + ' elementos entregados con control de reposición.', 'Dec. 1072 de 2015, art. 2.2.4.6.24 parág. 1; Res. 0312 de 2019, estándar 4.2.6', 'entrega-epp.html', 'Reponer los EPP vencidos y registrar la entrega firmada.'));
    if (K.personas.activos && K.personas.induccion < K.personas.activos) add(S('induccion', K.personas.induccion < K.personas.activos * 0.8 ? 'media' : 'baja', 'Personas', (K.personas.activos - K.personas.induccion) + ' persona(s) sin inducción vigente', K.personas.induccion + ' de ' + K.personas.activos + ' personas activas con la inducción o reinducción al día.', 'Dec. 1072 de 2015, art. 2.2.4.6.11; Res. 0312 de 2019, estándar 1.2.2', 'induccion.html', 'Hacer la inducción o reinducción en SST a quien la tenga vencida.', 'Preventiva'));
    if (K.personas.activos && K.personas.habilitados < K.personas.activos) add(S('habilitacion', 'media', 'Personas', (K.personas.activos - K.personas.habilitados) + ' persona(s) con requisitos vencidos o faltantes', 'Cursos, aptitud médica o seguridad social sin soporte vigente (hoy).', 'Dec. 1072 de 2015, art. 2.2.4.6.8; Res. 0312 de 2019, estándar 1.1.4', 'habilitacion.html', 'Actualizar los requisitos del personal (PILA, cursos y conceptos de aptitud).'));
    /* Cierre del mes y reporte anual */
    if (K.datos.sinCierre.length) add(S('cierre_mes', K.datos.sinCierre.length > 1 ? 'media' : 'baja', 'Sistema', plural(K.datos.sinCierre.length, 'mes sin cerrar', 'meses sin cerrar'), 'Falta el cierre de ' + K.datos.sinCierre.map(nombreMes).join(', ') + ' (revisión de lo pendiente e informe del mes).', 'Dec. 1072 de 2015, art. 2.2.4.6.20 (indicadores de estructura, proceso y resultado)', 'cierre-mes.html', 'Cerrar los meses pendientes en «Cerrar el mes».', 'De mejora'));
    if (hoy.slice(5) >= '11-15' && !K.reporteAnual.registrado) add(S('reporte_anual', 'alta', 'Revisar y mejorar', 'Falta registrar la autoevaluación ' + hoy.slice(0, 4) + ' en la plataforma', 'La autoevaluación y el plan de mejoramiento se registran cada año (revisa la fecha límite que fije el Ministerio del Trabajo).', 'Res. 0312 de 2019, arts. 27 y 28', 'gerencia.html', 'Registrar la autoevaluación y el plan de mejoramiento en la plataforma del Ministerio del Trabajo.'));
    const orden = { alta: 0, media: 1, baja: 2 };
    return out.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);
  }
  /** Lo que va bien (para el resumen y para no dar solo malas noticias). */
  function fortalezas(K) {
    const l = [];
    if (!K.acc.at && K.meses.some((x) => x.m <= K.hoy.slice(0, 7))) l.push('Sin accidentes de trabajo en el periodo.');
    else if (K.acc.at < K.acc.atAnt) l.push('Menos accidentes que en el periodo anterior (' + K.acc.at + ' frente a ' + K.acc.atAnt + ').');
    if (K.plan.existe && K.plan.cumplimiento >= 90) l.push('El plan anual va al ' + fmt(K.plan.cumplimiento, 0) + ' % de lo programado a la fecha.');
    if (K.acciones.abiertas && !K.acciones.vencidas) l.push('Ninguna acción del plan de acción está vencida.');
    if (K.acciones.cerradasP) l.push(plural(K.acciones.cerradasP, 'acción cerrada', 'acciones cerradas') + ' en el periodo' + (K.acciones.eficaces ? ', ' + K.acciones.eficaces + ' eficaces' : '') + '.');
    if (K.comites.copasst.existe && K.comites.copasst.dias !== null && K.comites.copasst.dias <= 40) l.push('El COPASST se reúne al día (última reunión el ' + fd(K.comites.copasst.ultima) + ').');
    if (K.insp.periodo) l.push(plural(K.insp.periodo, 'inspección hecha', 'inspecciones hechas') + ' en el periodo.');
    if (K.auto && K.auto.puntaje > 85 && K.auto.dias <= 365) l.push('Autoevaluación aceptable (' + fmt(K.auto.puntaje, 1) + ' %).');
    if (K.evid && K.evid.pct >= 85) l.push('El ' + fmt(K.evid.pct, 1) + ' % de los estándares tiene evidencia al día.');
    if (K.salud && K.salud.examenes && !K.salud.vencidos) l.push('Exámenes médicos periódicos al día.');
    return l;
  }
  /** Resumen ejecutivo: pocas frases con lo esencial del periodo. */
  function resumen(K, sug) {
    const alta = sug.filter((x) => x.prioridad === 'alta').length, f = [];
    const corte = String(K.corte || '').split('-').reverse().join('/');
    f.push('Informe del SG-SST ' + (K.P.tipo === 'mes' ? 'de ' : 'del ') + K.P.nombre + (K.enCurso ? ' (en curso, con corte al ' + corte + ')' : '') + '.');
    f.push(K.acc.at ? plural(K.acc.at, 'accidente de trabajo', 'accidentes de trabajo') + ' en el periodo (' + K.acc.atAnt + ' en el anterior)' + (K.acc.dias ? ', ' + K.acc.dias + ' días perdidos' : '') + '.' : 'Sin accidentes de trabajo en el periodo.');
    if (K.plan.existe) f.push('El plan anual va al ' + fmt(K.plan.cumplimiento, 0) + ' % de lo programado a la fecha (avance del año ' + fmt(K.plan.avance, 0) + ' %).');
    f.push(K.acciones.abiertas + ' acciones abiertas, ' + K.acciones.vencidas + ' vencidas; ' + K.acciones.cerradasP + ' cerradas en el periodo.');
    f.push(sug.length ? plural(sug.length, 'sugerencia de mejora', 'sugerencias de mejora') + (alta ? ', ' + alta + ' de prioridad alta' : '') + '.' : 'Sin sugerencias de mejora: todo lo que el portal revisa está al día.');
    return f;
  }

  /* ═════════════ Gráficas en SVG (sin librerías) ═════════════
     Colores sobrios y fijos por función; cada marca lleva data-tip (lo que dice al tocarla)
     y <title> (lector de pantalla y PDF). Ancho 320 unidades: se escalan al contenedor. */
  const COLOR = { serie: '#2a78d6', serie2: '#eb6834', ref: '#c3ccd5', ok: '#1d7a4c', alerta: '#b07a00', mal: '#b3261e', neutro: '#8794a1', texto: '#3c4752', suave: '#5c6a76', reja: '#e6eaee' };
  const e = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svg = (w, h, cuerpo, titulo) => '<svg class="graf" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + e(titulo) + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;font-family:inherit;">' + cuerpo + '</svg>';
  const techo = (max) => { if (max <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(max))), k = max / p; return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * p; };
  /** Barra con la punta redondeada (4 px) y la base recta sobre el eje. */
  const barra = (x, y, w, h, color, tip) => { if (h <= 0) return ''; const r = Math.min(4, w / 2, h);
    return '<path d="M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z" fill="' + color + '" data-tip="' + e(tip) + '"><title>' + e(tip) + '</title></path>'; };
  /** Barras verticales. datos: [{et, v, sel, tip}] */
  function barras(datos, o) {
    o = o || {}; const W = 320, H = o.alto || 150, L = 26, R = 6, T = 14, B = 22, ancho = W - L - R, alto = H - T - B;
    const max = techo(Math.max(0, ...datos.map((d) => d.v || 0))), paso = ancho / Math.max(1, datos.length), bw = Math.max(4, Math.min(26, paso - 4));
    let s = '';
    [0, 0.5, 1].forEach((k) => { const y = T + alto - alto * k; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + COLOR.reja + '" stroke-width="1"/><text x="' + (L - 4) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end" fill="' + COLOR.suave + '">' + e(fmt(max * k, max < 4 ? 1 : 0)) + '</text>'; });
    datos.forEach((d, i) => { const h = (d.v || 0) / max * alto, x = L + i * paso + (paso - bw) / 2;
      s += '<rect x="' + (L + i * paso) + '" y="' + T + '" width="' + paso + '" height="' + alto + '" fill="transparent" data-tip="' + e(d.tip || (d.et + ': ' + fmt(d.v, 2))) + '"/>';
      s += barra(x, T + alto - h, bw, h, d.sel === false ? COLOR.ref : o.color || COLOR.serie, d.tip || (d.et + ': ' + fmt(d.v, 2)));
      if (d.sel !== false && d.v) s += '<text x="' + (x + bw / 2) + '" y="' + (T + alto - h - 3) + '" font-size="9" text-anchor="middle" fill="' + COLOR.texto + '">' + e(fmt(d.v, o.dec == null ? 1 : o.dec)) + '</text>';
      if (datos.length <= 12 || i % 2 === 0) s += '<text x="' + (L + i * paso + paso / 2) + '" y="' + (H - 7) + '" font-size="9" text-anchor="middle" fill="' + COLOR.suave + '">' + e(d.et) + '</text>'; });
    return svg(W, H, s, o.titulo || '');
  }
  /** Barras agrupadas de dos series (programado y ejecutado). datos: [{et, a, b}] */
  function barrasPar(datos, o) {
    o = o || {}; const W = 320, H = o.alto || 160, L = 26, R = 6, T = 14, B = 22, ancho = W - L - R, alto = H - T - B;
    const max = techo(Math.max(0, ...datos.map((d) => Math.max(d.a || 0, d.b || 0)))), paso = ancho / Math.max(1, datos.length), bw = Math.max(3, Math.min(11, (paso - 6) / 2));
    let s = '';
    [0, 0.5, 1].forEach((k) => { const y = T + alto - alto * k; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + COLOR.reja + '"/><text x="' + (L - 4) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end" fill="' + COLOR.suave + '">' + e(fmt(max * k, 0)) + '</text>'; });
    datos.forEach((d, i) => { const x0 = L + i * paso + paso / 2 - bw - 1, tip = d.et + ': ' + (d.a || 0) + ' ' + (o.na || 'programadas') + ', ' + (d.b || 0) + ' ' + (o.nb || 'hechas');
      s += '<rect x="' + (L + i * paso) + '" y="' + T + '" width="' + paso + '" height="' + alto + '" fill="transparent" data-tip="' + e(tip) + '"/>';
      s += barra(x0, T + alto - (d.a || 0) / max * alto, bw, (d.a || 0) / max * alto, COLOR.ref, tip) + barra(x0 + bw + 2, T + alto - (d.b || 0) / max * alto, bw, (d.b || 0) / max * alto, d.atraso ? COLOR.serie2 : COLOR.serie, tip);
      s += '<text x="' + (L + i * paso + paso / 2) + '" y="' + (H - 7) + '" font-size="9" text-anchor="middle" fill="' + COLOR.suave + '">' + e(d.et) + '</text>'; });
    return svg(W, H, s, o.titulo || '');
  }
  /** Línea (una serie; los nulos cortan la línea). datos: [{et, v, sel}] */
  function linea(datos, o) {
    o = o || {}; const W = 320, H = o.alto || 130, L = 30, R = 8, T = 14, B = 22, ancho = W - L - R, alto = H - T - B;
    const vals = datos.map((d) => d.v).filter((v) => v !== null && v !== undefined), max = techo(Math.max(0, ...vals)), paso = ancho / Math.max(1, datos.length - 1);
    const X = (i) => L + (datos.length === 1 ? ancho / 2 : i * paso), Y = (v) => T + alto - v / max * alto;
    let s = '', tramo = '';
    [0, 0.5, 1].forEach((k) => { const y = T + alto - alto * k; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="' + COLOR.reja + '"/><text x="' + (L - 4) + '" y="' + (y + 3) + '" font-size="9" text-anchor="end" fill="' + COLOR.suave + '">' + e(fmt(max * k, max < 4 ? 1 : 0)) + '</text>'; });
    datos.forEach((d, i) => { if (d.v === null || d.v === undefined) { if (tramo) s += '<path d="' + tramo + '" fill="none" stroke="' + (o.color || COLOR.serie) + '" stroke-width="2" stroke-linejoin="round"/>'; tramo = ''; return; } tramo += (tramo ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(d.v).toFixed(1); });
    if (tramo) s += '<path d="' + tramo + '" fill="none" stroke="' + (o.color || COLOR.serie) + '" stroke-width="2" stroke-linejoin="round"/>';
    datos.forEach((d, i) => { const tip = d.et + ': ' + (d.v === null || d.v === undefined ? 'sin datos' : fmt(d.v, 2) + (o.unidad || ''));
      s += '<rect x="' + (X(i) - paso / 2) + '" y="' + T + '" width="' + Math.max(paso, 12) + '" height="' + alto + '" fill="transparent" data-tip="' + e(tip) + '"><title>' + e(tip) + '</title></rect>';
      if (d.v !== null && d.v !== undefined) s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(d.v).toFixed(1) + '" r="' + (d.sel ? 4 : 2.5) + '" fill="' + (d.sel ? (o.color || COLOR.serie) : '#fff') + '" stroke="' + (o.color || COLOR.serie) + '" stroke-width="2" data-tip="' + e(tip) + '"/>';
      if (datos.length <= 12 || i % 2 === 0) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 7) + '" font-size="9" text-anchor="middle" fill="' + COLOR.suave + '">' + e(d.et) + '</text>'; });
    const ult = [...datos].reverse().find((d) => d.v !== null && d.v !== undefined);
    if (ult) { const i = datos.indexOf(ult); s += '<text x="' + Math.min(X(i), W - R - 2).toFixed(1) + '" y="' + (Y(ult.v) - 7).toFixed(1) + '" font-size="9.5" font-weight="700" text-anchor="end" fill="' + COLOR.texto + '">' + e(fmt(ult.v, 2) + (o.unidad || '')) + '</text>'; }
    return svg(W, H, s, o.titulo || '');
  }
  /** Anillo con la cifra en el centro y la leyenda al lado. partes: [{n, v, color}] */
  function anillo(partes, o) {
    o = o || {}; const W = 320, H = 140, cx = 70, cy = 70, R = 54, r = 36, tot = partes.reduce((a, p) => a + (p.v || 0), 0);
    let s = '', ang = -Math.PI / 2;
    const pto = (a, rad) => (cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2);
    if (!tot) s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + COLOR.reja + '" stroke-width="' + (R - r) + '"/>';
    partes.forEach((p) => { if (!p.v) return; const da = p.v / tot * Math.PI * 2, gap = partes.filter((x) => x.v).length > 1 ? 0.03 : 0, a0 = ang + gap / 2, a1 = ang + da - gap / 2, big = da - gap > Math.PI ? 1 : 0, tip = p.n + ': ' + p.v + ' (' + Math.round(p.v * 100 / tot) + ' %)';
      s += da >= Math.PI * 2 - 0.001 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="' + p.color + '" stroke-width="' + (R - r) + '" data-tip="' + e(tip) + '"><title>' + e(tip) + '</title></circle>'
        : '<path d="M' + pto(a0, R) + 'A' + R + ',' + R + ' 0 ' + big + ' 1 ' + pto(a1, R) + 'L' + pto(a1, r) + 'A' + r + ',' + r + ' 0 ' + big + ' 0 ' + pto(a0, r) + 'Z" fill="' + p.color + '" data-tip="' + e(tip) + '"><title>' + e(tip) + '</title></path>';
      ang += da; });
    s += '<text x="' + cx + '" y="' + (cy + 2) + '" font-size="20" font-weight="700" text-anchor="middle" fill="' + COLOR.texto + '">' + e(o.centro != null ? o.centro : tot) + '</text><text x="' + cx + '" y="' + (cy + 16) + '" font-size="9" text-anchor="middle" fill="' + COLOR.suave + '">' + e(o.sub || 'total') + '</text>';
    partes.forEach((p, i) => { const y = 24 + i * 22; s += '<rect x="152" y="' + (y - 9) + '" width="11" height="11" rx="3" fill="' + p.color + '"/><text x="170" y="' + y + '" font-size="11" fill="' + COLOR.texto + '">' + e(p.n) + ' <tspan font-weight="700">' + e(p.v) + '</tspan></text>'; });
    return svg(W, H, s, o.titulo || '');
  }
  /** Barras horizontales (categorías con nombre largo). datos: [{n, v}] */
  function barrasH(datos, o) {
    o = o || {}; const W = 320, fila = 22, H = Math.max(30, datos.length * fila + 6), L = 132, R = 26, max = techo(Math.max(0, ...datos.map((d) => d.v || 0)));
    let s = '';
    datos.forEach((d, i) => { const y = 4 + i * fila, w = (d.v || 0) / max * (W - L - R), tip = d.n + ': ' + d.v;
      s += '<text x="' + (L - 6) + '" y="' + (y + 13) + '" font-size="10" text-anchor="end" fill="' + COLOR.texto + '">' + e(String(d.n).length > 24 ? String(d.n).slice(0, 23) + '…' : d.n) + '</text>';
      if (w > 0) { const r = Math.min(4, w); s += '<path d="M' + L + ',' + (y + 3) + 'H' + (L + w - r) + 'Q' + (L + w) + ',' + (y + 3) + ' ' + (L + w) + ',' + (y + 3 + r) + 'V' + (y + 17 - r) + 'Q' + (L + w) + ',' + (y + 17) + ' ' + (L + w - r) + ',' + (y + 17) + 'H' + L + 'Z" fill="' + (d.color || o.color || COLOR.serie) + '" data-tip="' + e(tip) + '"><title>' + e(tip) + '</title></path>'; }
      s += '<text x="' + (L + w + 4) + '" y="' + (y + 14) + '" font-size="10" font-weight="700" fill="' + COLOR.texto + '">' + e(d.v) + '</text>'; });
    return svg(W, H, s, o.titulo || '');
  }
  const etiquetaMes = (m) => MES_CORTO[Number(m.slice(5, 7)) - 1];

  return { periodo, opciones, porDefecto, diasAT, mesInd, anual, hechoAuto, planMes, calcular, sugerencias, fortalezas, resumen,
    graf: { barras, barrasPar, linea, anillo, barrasH, COLOR }, etiquetaMes, nombreMes, mesMas, fmt, sumarDias, diasEntre };
})();
if (typeof module !== 'undefined') module.exports = INFORME;
