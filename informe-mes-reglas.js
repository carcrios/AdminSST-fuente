/* ============================================================
   informe-mes-reglas.js — Cálculo del informe mensual de actividades (v171)
   ------------------------------------------------------------
   Junta lo que pasó en UN mes, de todos los servidores del portal:
   permisos de trabajo y ATS, accidentes e incidentes, inspecciones y sus
   hallazgos, charlas, inducciones, inspecciones y entregas de EPP,
   preoperacionales, simulacros, comités y plan de acción.
   Es puro (sin pantalla) para poder probarlo en Node.
   No usa nombres de personas: el informe sale con cifras, temas y hallazgos.
   ============================================================ */
const INFORME_MES = (function () {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const n0 = (v) => Number(v) || 0;
  const dos = (n) => (n < 10 ? '0' : '') + n;
  /** Fecha ISO (AAAA-MM-DD) de lo que mande cualquier servidor: texto, fecha o marca de tiempo. */
  function iso(v) {
    if (v === null || v === undefined || v === '') return '';
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  const enMes = (v, mes) => iso(v).slice(0, 7) === mes;
  const nombreMes = (mes) => MESES[Number(mes.slice(5, 7)) - 1] + ' de ' + mes.slice(0, 4);
  /** Los últimos 13 meses, el actual primero. */
  function opciones(hoy) {
    const a = Number(hoy.slice(0, 4)),
      m = Number(hoy.slice(5, 7)) - 1;
    return [...Array(13)].map((_, i) => {
      const k = a * 12 + m - i,
        v = Math.floor(k / 12) + '-' + dos((k % 12) + 1);
      return { v, t: nombreMes(v).replace(/^./, (c) => c.toUpperCase()) };
    });
  }
  /** Mes por defecto: los primeros 5 días se informa el mes que acaba de cerrar. */
  function porDefecto(hoy) {
    const o = opciones(hoy);
    return Number(hoy.slice(8, 10)) <= 5 ? o[1].v : o[0].v;
  }
  const contar = (l, f) => {
    const o = {};
    l.forEach((x) => {
      const k = f(x);
      if (k) o[k] = (o[k] || 0) + 1;
    });
    return Object.keys(o)
      .map((k) => ({ k, n: o[k] }))
      .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));
  };
  /** «2 × Casco, 1 × Guantes de vaqueta» → [{e:'Casco', n:2}, …] */
  function elementos(txt) {
    return String(txt || '')
      .split(/\s*[,;|]\s*/)
      .map((t) => {
        const m = /^(\d+)\s*[×x*]\s*(.+)$/i.exec(t.trim());
        return m ? { e: m[2].trim(), n: Number(m[1]) } : { e: t.trim(), n: 1 };
      })
      .filter((x) => x.e);
  }
  /** Los temas de la semana de charlas: {"lun":"Orden y aseo",…} (puede venir recortado). */
  function temas(txt) {
    const s = String(txt || ''),
      out = [];
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object') return Object.keys(o).map((k) => String(o[k] || '').trim()).filter(Boolean);
    } catch (e) {}
    const re = /"[^"]*"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(s))) if (m[1].trim()) out.push(m[1].replace(/\\"/g, '"').trim());
    if (!out.length && s && s.charAt(0) !== '{') s.split(/\s*[·|]\s*/).forEach((t) => t && out.push(t));
    const dia = /^(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|lun|mar|mie|jue|vie|sab|dom)\s*:\s*/i;
    return out.map((t) => t.replace(dia, '').trim()).filter(Boolean);
  }

  /**
   * @param {object} d { mes:'AAAA-MM', hoy, rows (SG-SST), permisos:[{tipo, rows}], ats, epp, charlas }
   *   permisos/ats/epp/charlas en null = ese servidor no respondió (sale «sin datos», no cero).
   */
  function calcular(d) {
    const mes = d.mes,
      hoy = d.hoy || iso(new Date()),
      rows = d.rows || [];
    const de = (t) => rows.filter((x) => x.tipo === t);
    const R = { mes, nombre: nombreMes(mes), futuro: mes > hoy.slice(0, 7), enCurso: mes === hoy.slice(0, 7) };

    // Permisos de trabajo (cada tipo es un servidor) y ATS
    const tipos = (d.permisos || []).map((p) => {
      if (!p.rows) return { tipo: p.tipo, sinDatos: true, abiertos: 0, cerrados: 0, siguen: 0 };
      const ab = p.rows.filter((r) => enMes(r.openedAt || r.updatedAt, mes));
      return {
        tipo: p.tipo,
        abiertos: ab.length,
        cerrados: ab.filter((r) => r.status === 'CERRADO').length,
        siguen: ab.filter((r) => r.status === 'ABIERTO').length,
      };
    });
    const atsM = d.ats ? d.ats.filter((r) => enMes(r.fechaDesde || r.updatedAt, mes)) : null;
    R.permisos = {
      tipos,
      total: tipos.reduce((a, x) => a + x.abiertos, 0),
      cerrados: tipos.reduce((a, x) => a + x.cerrados, 0),
      siguen: tipos.reduce((a, x) => a + x.siguen, 0),
      faltan: tipos.filter((x) => x.sinDatos).map((x) => x.tipo),
      ats: atsM ? atsM.length : null,
      atsCerrados: atsM ? atsM.filter((r) => r.estado === 'CERRADO').length : null,
    };

    // Accidentes, incidentes, actos y condiciones (Reportes)
    const rep = de('reporte').filter((x) => enMes(x.resumen.fecha || x.fecha, mes));
    const es = (x, re) => re.test(String(x.resumen.clase || ''));
    const at = rep.filter((x) => es(x, /^Accidente/i));
    R.eventos = {
      total: rep.length,
      accidentes: at.length,
      graves: at.filter((x) => x.resumen.grave || x.resumen.mortal).length,
      mortales: at.filter((x) => x.resumen.mortal).length,
      incidentes: rep.filter((x) => es(x, /^Incidente/i)).length,
      actos: rep.filter((x) => es(x, /^Acto/i)).length,
      condiciones: rep.filter((x) => es(x, /^Condici/i)).length,
      dias: at.reduce((a, x) => a + n0(x.resumen.diasIncapacidad) + n0(x.resumen.diasCargados), 0),
      sinFurat: at.filter((x) => !(x.resumen.furat || {}).radicado).length,
      sinInvestigar: rep.filter((x) => es(x, /^(Accidente|Incidente)/i) && (x.resumen.investigacion || {}).estado !== 'CERRADA').length,
      porClase: contar(rep, (x) => x.resumen.clase || 'Otro'),
      lista: rep
        .filter((x) => es(x, /^(Accidente|Incidente)/i))
        .map((x) => ({ fecha: iso(x.resumen.fecha || x.fecha), clase: x.resumen.clase, lugar: x.resumen.lugar || '', descripcion: x.resumen.descripcion || '', dias: n0(x.resumen.diasIncapacidad) }))
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    };

    // Inspecciones planeadas y sus hallazgos
    const ins = de('inspeccion').filter((x) => enMes(x.resumen.fecha || x.fecha, mes));
    const nc = ins.filter((x) => x.resumen.resultado === 'NO CONFORME');
    R.inspecciones = {
      total: ins.length,
      conformes: ins.length - nc.length,
      noConformes: nc.length,
      hallazgos: ins.reduce((a, x) => a + n0(x.resumen.nc), 0),
      porCategoria: contar(ins, (x) => x.resumen.categoria || 'Otra'),
      lista: nc
        .map((x) => ({
          fecha: iso(x.resumen.fecha || x.fecha),
          que: [x.resumen.categoria, x.resumen.equipo].filter(Boolean).join(' · '),
          lugar: x.resumen.lugar || '',
          items: (x.resumen.noConformes || []).slice(0, 8),
          n: n0(x.resumen.nc),
        }))
        .sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
    };

    // Charlas (servidor de asistencia: una fila por semana) e inducciones
    const sem = d.charlas ? d.charlas.filter((s) => enMes(s.semanaDel, mes)) : null;
    const lt = [];
    (sem || []).forEach((s) => temas(s.temas).forEach((t) => lt.indexOf(t) === -1 && lt.push(t)));
    const ind = de('induccion').filter((x) => enMes(x.resumen.fecha || x.fecha, mes));
    R.formacion = {
      semanas: sem ? sem.length : null,
      charlas: sem ? sem.reduce((a, s) => a + n0(s.charlas), 0) : null,
      asistentes: sem ? sem.reduce((a, s) => a + n0(s.asistentes), 0) : null,
      temas: lt,
      inducciones: ind.filter((x) => !/re/i.test(String(x.resumen.tipoInduccion || '').slice(0, 2))).length,
      reinducciones: ind.filter((x) => /^re/i.test(String(x.resumen.tipoInduccion || ''))).length,
      horas: ind.reduce((a, x) => a + n0(x.resumen.intensidadHoras), 0),
    };

    // EPP: revisados (inspección de EPP) y entregados
    const insE = d.epp ? d.epp.filter((r) => (r.tipo || 'epp') === 'epp' && enMes(r.fechaInspeccion || r.updatedAt, mes)) : null;
    const malos = [];
    (insE || []).forEach((r) =>
      String(r.malos || '')
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => malos.push(t)),
    );
    const ent = de('entrega').filter((x) => enMes(x.resumen.fecha || x.fecha, mes));
    const tot = {};
    ent.forEach((x) => elementos(x.resumen.reposicionTexto || x.resumen.elementosTexto).forEach((y) => (tot[y.e] = (tot[y.e] || 0) + y.n)));
    R.epp = {
      revisados: insE ? insE.length : null,
      conNovedad: insE ? insE.filter((r) => String(r.malos || '').trim()).length : null,
      novedades: contar(malos, (t) => t),
      brigada: d.epp ? d.epp.filter((r) => r.tipo === 'brigadistas' && enMes(r.fechaInspeccion || r.updatedAt, mes)).length : null,
      entregas: ent.length,
      personas: new Set(ent.map((x) => String(x.resumen.cedula || x.resumen.nombre || x.id))).size,
      porReposicion: ent.filter((x) => /repos|da[ñn]o|desgaste|p[ée]rdida/i.test(String(x.resumen.motivo || ''))).length,
      sinCapacitar: ent.filter((x) => x.resumen.capacitado === false || x.resumen.capacitado === 'No').length,
      elementos: Object.keys(tot)
        .map((k) => ({ k, n: tot[k] }))
        .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k)),
      unidades: Object.keys(tot).reduce((a, k) => a + tot[k], 0),
    };

    // Preoperacionales, simulacros, comités y plan de acción
    const pre = de('preop').filter((x) => enMes(x.resumen.fecha || x.fecha, mes));
    R.otros = {
      preop: pre.length,
      preopNovedad: pre.filter((x) => /CON NOVEDAD|NO APTO|RECHAZ/i.test(String(x.resumen.resultado || x.estado || ''))).length,
      preopPorFormato: contar(pre, (x) => x.resumen.nombreFormulario || x.resumen.formulario),
      simulacros: de('simulacro').filter((x) => enMes(x.resumen.fecha || x.fecha, mes)).length,
      reuniones: contar(
        de('reunion').filter((x) => enMes(x.resumen.fecha || x.fecha, mes)),
        (x) => x.resumen.comite || x.resumen.tipo || 'Comité',
      ),
    };
    const fin = mes + '-31';
    const acc = de('accion');
    R.acciones = {
      nuevas: acc.filter((x) => enMes(x.fecha || x.resumen.fecha, mes)).length,
      cerradas: acc.filter((x) => x.estado === 'CERRADA' && enMes(x.resumen.fechaCierre || x.actualizado, mes)).length,
      abiertas: acc.filter((x) => x.estado !== 'CERRADA' && iso(x.fecha) <= fin).length,
      vencidas: acc.filter((x) => x.estado !== 'CERRADA' && x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < (R.enCurso ? hoy : fin)).length,
    };
    return R;
  }

  /** Lo más relevante del mes en frases cortas (va arriba en pantalla y en el PDF). */
  function destacados(R) {
    const o = [],
      p = R.permisos,
      e = R.eventos,
      i = R.inspecciones,
      f = R.formacion,
      q = R.epp;
    const pl = (n, s, pp) => n + ' ' + (n === 1 ? s : pp);
    o.push(pl(p.total, 'permiso de trabajo', 'permisos de trabajo') + (p.ats !== null ? ' y ' + pl(p.ats, 'ATS', 'ATS') : '') + (p.siguen ? ' · ' + p.siguen + ' siguen abiertos' : ''));
    o.push(
      e.accidentes
        ? pl(e.accidentes, 'accidente de trabajo', 'accidentes de trabajo') + ' (' + pl(e.dias, 'día perdido', 'días perdidos') + ')'
        : 'Sin accidentes de trabajo',
    );
    const cond = pl(e.condiciones, 'condición insegura', 'condiciones inseguras');
    o.push(pl(e.incidentes, 'incidente', 'incidentes') + ', ' + pl(e.actos, 'acto inseguro', 'actos inseguros') + ' y ' + cond + ' reportados');
    o.push(pl(i.total, 'inspección', 'inspecciones') + ' con ' + pl(i.hallazgos, 'hallazgo', 'hallazgos') + (i.noConformes ? ' (' + i.noConformes + ' no conformes)' : ''));
    if (f.charlas !== null) o.push(pl(f.charlas, 'charla', 'charlas') + ' con ' + pl(f.asistentes, 'asistencia', 'asistencias') + (f.temas.length ? ' · ' + pl(f.temas.length, 'tema', 'temas') : ''));
    if (q.revisados !== null) o.push(pl(q.revisados, 'persona con el EPP revisado', 'personas con el EPP revisado') + (q.conNovedad ? ' (' + q.conNovedad + ' con novedad)' : ''));
    o.push(pl(q.entregas, 'entrega de EPP', 'entregas de EPP') + (q.unidades ? ' · ' + pl(q.unidades, 'elemento', 'elementos') : ''));
    if (R.acciones.vencidas) o.push(pl(R.acciones.vencidas, 'acción vencida', 'acciones vencidas') + ' en el plan de acción');
    if (e.sinFurat) o.push('⚠ ' + pl(e.sinFurat, 'accidente sin FURAT radicado', 'accidentes sin FURAT radicado'));
    return o;
  }

  return { calcular, destacados, opciones, porDefecto, nombreMes, iso, elementos, temas };
})();
if (typeof module !== 'undefined') module.exports = INFORME_MES;
