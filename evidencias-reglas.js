/* ============================================================
   evidencias-reglas.js — Carpeta de evidencias por estándar (v105)
   ------------------------------------------------------------
   Para cada estándar mínimo (Res. 0312 de 2019) busca en el portal
   la evidencia que lo soporta y dice en qué estado está:
     ok      → hay evidencia vigente
     parcial → hay algo, pero vencido o incompleto
     falta   → no hay nada en el portal
     manual  → el portal no lo registra: se revisa a mano
     reservado → datos de salud que solo ven Administrador y SST
   No es la calificación oficial: es la guía para preparar la
   autoevaluación y la carpeta que se le muestra al auditor.
   ============================================================ */
const EVIDENCIAS = (function () {
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /** ctx: {rows, perfil, hoy, esSst, docDe(id) → Promise<doc>} */
  function preparar(ctx) {
    const rows = ctx.rows || [], hoy = ctx.hoy, anio = hoy.slice(0, 4);
    const menos = (dias) => { const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
    const de = (t) => rows.filter((x) => x.tipo === t);
    const kit = (id) => { const x = rows.find((r) => r.id === 'DOC-KIT-' + id); return x && x.resumen && x.resumen.estado !== 'Obsoleto' ? x : null; };
    const vigente = (x) => !!x && (!x.resumen.proximaRevision || x.resumen.proximaRevision >= hoy);
    const desde = (t, campo, dias) => de(t).filter((x) => String((x.resumen || {})[campo] || x.fecha || '') >= menos(dias));
    const trab = de('trabajador').filter((x) => x.resumen.activo !== false);
    const reqVig = (k) => trab.filter((x) => { const q = (x.resumen.req || {})[k]; return q && (q.fecha || q.vence) && (!q.vence || q.vence >= hoy); }).length;
    const acc = de('accion');
    return { rows, hoy, anio, menos, de, kit, vigente, desde, trab, reqVig, acc, perfil: ctx.perfil || {}, esSst: ctx.esSst !== false, docDe: ctx.docDe };
  }
  const R = (e, ev, href, que) => ({ e, ev: [].concat(ev || []).filter(Boolean), href: href || '', que: que || '' });
  const docKit = (c, id, nombre) => { const x = c.kit(id); return x ? nombre + ' v' + (x.resumen.versionDoc || '1') + ' aprobado el ' + x.resumen.fechaAprobacion + (c.vigente(x) ? '' : ' (revisión vencida)') : ''; };
  const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;

  const REGLAS = {
    '1.1.1': (c) => { const d = docKit(c, 'DESIGNACION', 'Designación del responsable'), r = c.perfil.responsableSST;
      return R(d && r ? 'ok' : d || r ? 'parcial' : 'falta', [r ? 'Responsable en el perfil: ' + r + (c.perfil.responsableLicencia ? ' (licencia ' + c.perfil.responsableLicencia + ')' : '') : '', d], 'documentos.html', 'Escribe el responsable en el kit documental y aprueba la designación firmada.'); },
    '1.1.2': (c) => { const d = docKit(c, 'ROLES', 'Roles y responsabilidades'); return R(d ? 'ok' : 'falta', d, 'documentos.html', 'Aprueba el documento de roles y responsabilidades del kit.'); },
    '1.1.3': (c) => { const d = docKit(c, 'RECURSOS', 'Asignación de recursos'), p = c.de('plananual').find((x) => String(x.resumen.anio) === c.anio && x.resumen.presupuesto);
      const ap = c.de('aprobrec').filter((x) => String(x.resumen.fecha || '').slice(0, 4) === c.anio);   // v148: aprobaciones de la gerencia
      return R(d || ap.length ? 'ok' : p ? 'parcial' : 'falta', [d, ap.length ? ap.length + ' aprobación(es) de recursos de la gerencia en ' + c.anio : '', p ? 'Presupuesto en el plan anual ' + c.anio + ': ' + (isNaN(Number(p.resumen.presupuesto)) ? p.resumen.presupuesto : '$ ' + Number(p.resumen.presupuesto).toLocaleString('es-CO')) : ''], 'documentos.html', 'Aprueba la asignación de recursos (kit) y anota el presupuesto en el plan anual.'); },
    '1.1.4': (c) => { const n = c.reqVig('seguridad_social'); return !c.trab.length ? R('falta', '', 'habilitacion.html', 'Registra al personal con su pago de seguridad social (PILA).') :
      R(n === c.trab.length ? 'ok' : n ? 'parcial' : 'falta', n + ' de ' + c.trab.length + ' personas con la seguridad social al día (Personal habilitado)', 'habilitacion.html', 'Carga el soporte de la PILA del mes de cada persona.'); },
    '1.1.5': (c) => { const ar = c.trab.filter((x) => x.resumen.pensionEspecial === 'Sí'), con = ar.filter((x) => { const q = (x.resumen.req || {}).seguridad_social; return q && (!q.vence || q.vence >= c.hoy); });
      return ar.length ? R(con.length === ar.length ? 'ok' : 'parcial', con.length + ' de ' + ar.length + ' trabajador(es) de alto riesgo (Dec. 2090 de 2003) con la cotización especial verificada en la PILA', 'habilitacion.html', 'Marca en Personal habilitado quién hace tareas de alto riesgo para pensión y carga su PILA.')
        : R('manual', '', 'habilitacion.html', 'Marca en Personal habilitado quién hace tareas de alto riesgo para pensión (Dec. 2090 de 2003), o registra «No aplica» con su justificación.'); },
    '1.1.6': (c) => { const cm = c.de('comite').find((x) => x.resumen.comite === 'copasst'), per = cm && cm.resumen.periodo, vig = per && per.fin >= c.hoy;
      const reu = c.de('reunion').filter((x) => x.resumen.comite === 'copasst' && x.resumen.tipo === 'Ordinaria' && x.resumen.fecha >= c.menos(365));
      const reciente = reu.some((x) => x.resumen.fecha >= c.menos(62));
      return R(vig && reciente ? 'ok' : cm ? 'parcial' : 'falta', [per ? 'Periodo ' + per.inicio + ' a ' + per.fin + (vig ? '' : ' (vencido)') + ', ' + (per.miembros || []).length + ' integrantes' : '', reu.length + ' reunión(es) ordinaria(s) con acta en los últimos 12 meses'], 'copasst.html', cm ? 'Que el periodo esté vigente y haya reunión cada mes con acta.' : 'Conforma el COPASST (o designa el vigía) en el portal.'); },
    '1.1.7': (c) => { const cm = c.de('comite').find((x) => x.resumen.comite === 'copasst'), n = cm ? Number(cm.resumen.capacitaciones) || 0 : 0;
      return R(n ? 'ok' : cm ? 'parcial' : 'falta', cm ? n + ' capacitación(es) del comité registradas' : '', 'copasst.html', 'Registra la capacitación de los integrantes en el COPASST.'); },
    '1.1.8': (c) => { const cm = c.de('comite').find((x) => x.resumen.comite === 'convivencia'), per = cm && cm.resumen.periodo, vig = per && per.fin >= c.hoy;
      const reu = c.de('reunion').filter((x) => x.resumen.comite === 'convivencia' && x.resumen.fecha >= c.menos(365));
      return R(vig && reu.length ? 'ok' : cm ? 'parcial' : 'falta', [per ? 'Periodo ' + per.inicio + ' a ' + per.fin + (vig ? '' : ' (vencido)') : '', reu.length + ' reunión(es) con acta en los últimos 12 meses'], 'convivencia.html', 'Comité conformado, con periodo vigente y reuniones con acta.'); },
    '1.2.1': (c) => { const p = c.de('plananual').find((x) => String(x.resumen.anio) === c.anio), d = docKit(c, 'PROG-CAPACITACION', 'Programa de capacitación');
      const cap = p ? Number(p.resumen.capProgramadas) || 0 : 0;
      return R(cap && d ? 'ok' : cap || d ? 'parcial' : 'falta', [d, p ? 'Plan de capacitación ' + c.anio + ': ' + (p.resumen.capEjecutadas || 0) + ' de ' + cap + ' ejecutadas a la fecha' + (p.resumen.cobertura !== '' && p.resumen.cobertura != null ? ', cobertura ' + p.resumen.cobertura + ' %' : '') : ''], 'plan-anual.html', 'Programa de capacitación aprobado y capacitaciones en el plan anual.'); },
    '1.2.2': (c) => { const n = c.reqVig('induccion'), l = c.desde('induccion', 'fecha', 365).length;
      return !c.trab.length ? R(l ? 'parcial' : 'falta', l ? l + ' inducción(es) en el año' : '', 'induccion.html', 'Registra al personal y sus inducciones.') :
        R(n === c.trab.length ? 'ok' : n ? 'parcial' : 'falta', [n + ' de ' + c.trab.length + ' personas con la inducción vigente', l + ' inducción(es) y reinducción(es) con evaluación en los últimos 12 meses'], 'induccion.html', 'Inducción o reinducción a quien la tenga vencida.'); },
    '1.2.3': (c) => R(c.perfil.responsableCurso ? 'ok' : 'falta', c.perfil.responsableCurso ? 'Curso virtual de 50 horas del responsable: ' + c.perfil.responsableCurso : '', 'documentos.html', 'Anota la fecha del curso de 50 horas del responsable (datos del kit documental) y adjunta el certificado.'),
    '2.1.1': (c) => { const d = docKit(c, 'POLITICA', 'Política de SST'), p = c.de('politica').find((x) => !/OBSOLET/i.test(x.estado) && c.vigente(x));
      return R(d || p ? (c.vigente(c.kit('POLITICA')) || p ? 'ok' : 'parcial') : 'falta', [d, p ? 'Política firmada el ' + p.resumen.fechaFirma + (p.resumen.divulgaciones ? ', ' + p.resumen.divulgaciones + ' divulgación(es)' : '') : ''], 'documental.html', 'Política firmada, fechada, divulgada y revisada cada año.'); },
    '2.2.1': (c) => { const d = docKit(c, 'OBJETIVOS', 'Objetivos del SG-SST'), p = c.de('politica').find((x) => Number(x.resumen.objetivos) > 0);
      return R(d || p ? 'ok' : 'falta', [d, p ? p.resumen.objetivos + ' objetivo(s) con la política' : ''], 'documentos.html', 'Objetivos claros y medibles, coherentes con la política.'); },
    '2.3.1': (c) => { const a = c.de('auditoria').filter((x) => /^RES0312/.test(x.resumen.plantilla) && x.estado === 'CERRADA');
      return R(a.length ? 'ok' : 'falta', a.length ? 'Autoevaluación del ' + a.map((x) => x.resumen.fechaEjecucion).sort().slice(-1)[0] + ' (' + a.length + ' en total)' : '', 'auditorias.html', 'Haz la evaluación inicial (autoevaluación de estándares mínimos).'); },
    '2.4.1': (c) => { const p = c.de('plananual').find((x) => String(x.resumen.anio) === c.anio);
      return R(p && p.resumen.firmado === true ? 'ok' : p ? 'parcial' : 'falta', p ? 'Plan ' + c.anio + ': ' + (p.resumen.programadas || 0) + ' ejecuciones programadas, cumplimiento ' + (p.resumen.cumplimiento || 0) + ' %' + (p.resumen.firmado === true ? ', firmado' : ', sin firmas') : '', 'plan-anual.html', p ? 'Falta que lo firmen el empleador y el responsable.' : 'Arma el plan anual (hay una opción que lo arma según la empresa).'); },
    '2.5.1': (c) => { const d = docKit(c, 'PROC-DOCUMENTOS', 'Control de documentos y registros'), n = c.de('documento').length;
      return R(d ? 'ok' : n ? 'parcial' : 'falta', [d, n + ' documento(s) en el listado maestro'], 'documental.html', 'Procedimiento de control de documentos con los tiempos de retención.'); },
    '2.6.1': (c) => { const l = c.desde('rendicion', 'fecha', 400); return R(l.length ? 'ok' : 'falta', l.length ? l.length + ' rendición(es) de cuentas en el último año' : '', 'revision-direccion.html', 'Registra la rendición de cuentas de quienes tienen responsabilidades en SST.'); },
    '2.7.1': (c) => { const l = c.de('legal').filter((x) => x.resumen.vigente !== 'No'), venc = l.filter((x) => x.resumen.proximaRevision && x.resumen.proximaRevision < c.hoy);
      return R(l.length && !venc.length ? 'ok' : l.length ? 'parcial' : 'falta', l.length ? l.length + ' norma(s) en la matriz legal' + (venc.length ? ', ' + venc.length + ' con revisión vencida' : '') : '', 'documental.html', 'Matriz legal con las normas que aplican, revisada.'); },
    '2.8.1': (c) => { const d = docKit(c, 'PROC-COMUNICACION', 'Comunicación, participación y consulta'), r = c.desde('reporte', 'fecha', 365).length;
      return R(d ? 'ok' : r ? 'parcial' : 'falta', [d, r ? r + ' reporte(s) de actos, condiciones o eventos de los trabajadores en el año (auto reporte)' : ''], 'documentos.html', 'Procedimiento de comunicación y el canal de auto reporte (Reportar un evento).'); },
    '2.9.1': (c) => { const d = docKit(c, 'PROC-COMPRAS', 'Adquisiciones con criterios de SST'); return R(d ? 'ok' : 'falta', d, 'documentos.html', 'Aprueba el procedimiento de compras con criterios de SST del kit.'); },
    '2.10.1': (c) => { const p = c.de('proveedor').filter((x) => x.resumen.fechaEvaluacion), ct = c.de('contratista').filter((x) => x.estado !== 'INACTIVO');
      return R(p.length ? 'ok' : ct.length ? 'parcial' : 'falta', [p.length ? p.length + ' proveedor(es) o contratista(s) evaluados' : '', ct.length ? ct.length + ' contratista(s) con control de documentos' : ''], 'documental.html', 'Evalúa a proveedores y contratistas con criterios de SST.'); },
    '2.11.1': (c) => { const d = docKit(c, 'PROC-CAMBIO', 'Gestión del cambio'), n = c.de('cambio').length;
      return R(d ? 'ok' : n ? 'parcial' : 'falta', [d, n ? n + ' cambio(s) evaluados' : ''], 'documental.html', 'Procedimiento de gestión del cambio y los cambios evaluados.'); },
    '3.1.1': (c) => { if (!c.esSst) return R('reservado'); const l = c.de('perfil').filter((x) => String(x.resumen.anio) >= String(Number(c.anio) - 1));
      return R(l.length ? 'ok' : c.de('perfil').length ? 'parcial' : 'falta', l.length ? 'Diagnóstico de condiciones de salud ' + l.map((x) => x.resumen.anio).join(', ') : '', 'salud.html', 'Diagnóstico de condiciones de salud y perfil sociodemográfico actualizados.'); },
    '3.1.2': (c) => { if (!c.esSst) return R('reservado'); const s = c.de('sve').filter((x) => !/INACTIV|CERRAD/i.test(x.estado)), p = c.de('perfil').some((x) => Number(x.resumen.actividades) > 0);
      return R(s.length || p ? 'ok' : 'falta', [s.length ? s.length + ' programa(s) de vigilancia epidemiológica' : '', p ? 'Actividades de promoción y prevención registradas en el diagnóstico' : ''], 'salud.html', 'Actividades de medicina del trabajo y PyP según el diagnóstico.'); },
    '3.1.3': (c) => { const n = c.de('cargo').length; return R(n ? 'ok' : 'falta', n ? 'Profesiograma con ' + n + ' cargo(s), peligros y exámenes' : '', 'salud.html', 'Profesiograma (perfiles de cargo y peligros) para el médico.'); },
    '3.1.4': (c) => { if (!c.esSst) return R('reservado'); const ced = new Set(c.desde('examen', 'fecha', 395).map((x) => String(x.resumen.cedula).replace(/\D/g, '')));
      const con = c.trab.filter((x) => ced.has(String(x.resumen.cedula).replace(/\D/g, ''))).length, d = docKit(c, 'PROG-MEDICO', 'Programa de evaluaciones médicas');
      return R(c.trab.length && con === c.trab.length ? 'ok' : con || d ? 'parcial' : 'falta', [con + ' de ' + c.trab.length + ' personas activas con examen en los últimos 13 meses', d], 'salud.html', 'Exámenes periódicos según el profesiograma.'); },
    '3.1.5': (c) => { const x = c.de('custodiahc').filter((y) => !y.resumen.vence || y.resumen.vence >= c.hoy)[0];
      return x ? R('ok', 'Certificación de custodia de ' + (x.resumen.ips || 'la IPS') + (x.resumen.vence ? ', vigente hasta ' + x.resumen.vence : ''), 'matrices-iso.html?m=custodiahc')
        : R(c.de('custodiahc').length ? 'parcial' : 'falta', c.de('custodiahc').length ? 'Certificación de custodia vencida' : '', 'matrices-iso.html?m=custodiahc', 'Registra la certificación de la IPS que custodia las historias clínicas (el portal no guarda historias).'); },
    '3.1.6': (c) => { if (!c.esSst) return R('reservado'); if (!c.desde('examen', 'fecha', 395).length) return R('falta', '', 'salud.html', 'No hay exámenes médicos cargados en los últimos 13 meses: sin ellos no se pueden revisar restricciones.'); const r = c.de('examen').filter((x) => x.resumen.tieneRestricciones === 'Sí'), sin = r.filter((x) => x.resumen.comunicada !== 'Sí');
      return R(!sin.length ? 'ok' : 'parcial', r.length ? r.length + ' examen(es) con restricciones, ' + (r.length - sin.length) + ' comunicadas' : 'No hay restricciones registradas', 'salud.html', 'Comunica cada restricción al trabajador y al jefe, con registro.'); },
    '3.1.7': (c) => { const p = c.de('plananual').find((x) => String(x.resumen.anio) === c.anio);
      const acts = ((p && p.resumen.actividades) || []).filter((a) => /estilo|saludable|pyp|promoci|tabaco|alcohol|actividad f[ií]sica|nutrici/i.test(norm(a.actividad || a.nombre || '')));
      const hechas = acts.filter((a) => a.hecha || a.estado === 'Hecha' || a.ejecutada);
      return acts.length ? R(hechas.length === acts.length ? 'ok' : hechas.length ? 'parcial' : 'falta', hechas.length + ' de ' + acts.length + ' actividad(es) de estilos de vida saludables del plan ' + c.anio + ' ejecutadas', 'plan-anual.html', 'Ejecuta y registra las actividades de estilos de vida y entornos saludables.')
        : R('manual', p ? 'Revisa en el plan anual ' + c.anio + ' las actividades de estilos de vida saludables y su ejecución' : '', 'plan-anual.html', 'Actividades de estilos de vida y entornos saludables, con registro.'); },
    '3.1.8': (c) => { const l = c.desde('inspeccion', 'fecha', 365).filter((x) => x.resumen.plantilla === 'SANEAMIENTO' || /locativ|instalacion|sanitari|bano|cocina|saneamiento/.test(norm(x.resumen.categoria + ' ' + x.resumen.plantilla)));
      return R(l.length ? 'ok' : 'falta', l.length ? l.length + ' inspección(es) locativas en el año' : '', 'inspecciones.html', 'Agua potable, baños y basuras: inspección locativa con registro.'); },
    '3.1.9': (c) => { const r = c.desde('residuo', 'fecha', 365), a = c.de('aspecto');
      return R(r.length ? 'ok' : a.length ? 'parcial' : 'falta', [r.length ? r.length + ' registro(s) de residuos en el año' : '', a.length ? a.length + ' aspecto(s) ambientales identificados' : ''], 'ambiental.html', 'Registro de la generación y entrega de residuos (RESPEL con certificado).'); },
    '3.2.1': (c) => { const at = c.desde('reporte', 'fecha', 365).filter((x) => x.resumen.clase === 'Accidente de trabajo'), sin = at.filter((x) => !(x.resumen.furat || {}).radicado);
      const meses = c.desde('mes', 'mes', 365).filter((x) => x.resumen.trabajadores).length;
      if (!at.length && meses < 3) return R('parcial', 'Sin accidentes registrados, pero solo ' + meses + ' mes(es) con datos de trabajadores: no se puede afirmar que no hubo', 'indicadores.html', 'Registra cada mes el número de trabajadores y los accidentes (aunque sean cero).');
      return R(!sin.length ? 'ok' : 'parcial', at.length ? at.length + ' accidente(s) en el año, ' + (at.length - sin.length) + ' con FURAT radicado' : 'Sin accidentes de trabajo en los últimos 12 meses (' + meses + ' meses con datos)', 'reportes.html', 'Radica el FURAT de cada accidente dentro de los 2 días hábiles.'); },
    '3.2.2': (c) => { const ev = c.desde('reporte', 'fecha', 365).filter((x) => /Accidente|Incidente/.test(x.resumen.clase)), ab = ev.filter((x) => (x.resumen.investigacion || {}).estado !== 'CERRADA'), d = docKit(c, 'PROC-INVESTIGACION', 'Procedimiento de investigación');
      return R(!ab.length && d ? 'ok' : !ab.length || d ? 'parcial' : 'falta', [d, ev.length ? ev.length + ' evento(s) en el año, ' + (ev.length - ab.length) + ' investigados' : 'Sin accidentes ni incidentes en el año'], 'reportes.html', 'Investiga cada incidente y accidente con el COPASST (Res. 1401 de 2007).'); },
    '3.2.3': (c) => { const m = c.de('mes').filter((x) => x.resumen.trabajadores && x.resumen.mes >= c.menos(365).slice(0, 7)).length;
      return R(m >= 10 ? 'ok' : m ? 'parcial' : 'falta', m + ' mes(es) con datos de indicadores en el último año', 'indicadores.html', 'Registra los datos de cada mes y presenta el análisis a la gerencia.'); },
    '3.3.1': (c) => REGLAS._mensual(c, 'frecuencia de la accidentalidad'),
    '3.3.2': (c) => REGLAS._mensual(c, 'severidad de la accidentalidad'),
    '3.3.3': (c) => REGLAS._anual(c, 'mortalidad por accidente de trabajo'),
    '3.3.4': (c) => REGLAS._anual(c, 'prevalencia de enfermedad laboral'),
    '3.3.5': (c) => REGLAS._anual(c, 'incidencia de enfermedad laboral'),
    '3.3.6': (c) => REGLAS._mensual(c, 'ausentismo por causa médica'),
    _mensual: (c, que) => { const ult = c.de('mes').filter((x) => x.resumen.trabajadores).map((x) => x.resumen.mes).sort().slice(-1)[0] || '';
      return R(ult >= c.menos(62).slice(0, 7) ? 'ok' : ult ? 'parcial' : 'falta', ult ? 'Indicadores calculados por el portal; último mes con datos: ' + ult : '', 'indicadores.html', 'Registra los datos del mes: el portal calcula la ' + que + '.'); },
    _anual: (c, que) => { const n = c.de('mes').filter((x) => x.resumen.trabajadores && String(x.resumen.mes).slice(0, 4) === c.anio).length;
      return R(n ? 'ok' : 'falta', n ? 'Se calcula en el tablero de la gerencia con ' + n + ' mes(es) de ' + c.anio : '', 'gerencia.html', 'Con los datos mensuales el portal calcula la ' + que + ' del año.'); },
    '4.1.1': (c) => { const n = c.de('peligro').length, d = docKit(c, 'PROC-PELIGROS', 'Procedimiento de identificación de peligros');
      return R(n && d ? 'ok' : n || d ? 'parcial' : 'falta', [n ? 'Matriz GTC 45 con ' + n + ' peligro(s) valorados' : '', d], 'peligros.html', 'Matriz de peligros de todos los procesos (rutinarios y no rutinarios) y su procedimiento.'); },
    '4.1.2': (c) => { const r = c.desde('revmatriz', 'fecha', 365);
      return R(r.length ? 'ok' : c.de('revmatriz').length ? 'parcial' : 'falta', r.length ? 'Revisión del ' + r.map((x) => x.resumen.fecha).sort().slice(-1)[0] + (r[0].resumen.participantes ? ' con ' + r[0].resumen.participantes + ' participante(s)' : '') : '', 'peligros.html', 'Revisa la matriz al menos una vez al año, con los trabajadores.'); },
    '4.1.3': (c) => { const s = c.de('sustancia').filter((x) => x.resumen.estado !== 'Fuera de uso'), p = s.filter((x) => x.resumen.carcinogena === true || x.resumen.carcinogena === 'Sí' || x.resumen.toxicidadAguda === true || x.resumen.toxicidadAguda === 'Sí'), sinC = p.filter((x) => !x.resumen.controles);
      return !s.length ? R('manual', '', 'quimicos.html', 'Si la empresa no usa sustancias químicas, justifícalo como no aplica; si las usa, regístralas.') :
        R(!sinC.length ? 'ok' : 'parcial', [s.length + ' sustancia(s) en el inventario', p.length ? p.length + ' carcinógena(s) o de toxicidad aguda, ' + (p.length - sinC.length) + ' con controles' : 'Ninguna carcinógena ni de toxicidad aguda'], 'quimicos.html', 'Prioriza las carcinógenas y de toxicidad aguda con sus controles.'); },
    '4.1.4': (c) => { const m = c.desde('medicion', 'fecha', 730);
      // v148: si la matriz tiene ruido, iluminación o químicos en riesgo alto (I o II) y no hay medición, falta.
      const altos = c.de('peligro').filter((x) => /^(I|II)$/.test(String(x.resumen.nivelRiesgo || x.resumen.nr || '').trim()) && /ruido|iluminaci|qu[ií]mic|temperatura|vibraci|radiaci|polvo|gases|vapores/i.test(norm((x.resumen.clasificacion || '') + ' ' + (x.resumen.peligro || '') + ' ' + (x.resumen.descripcion || ''))));
      return R(m.length ? 'ok' : altos.length ? 'falta' : 'manual', m.length ? m.length + ' medición(es) ambientales en los últimos 2 años' : altos.length ? altos.length + ' peligro(s) higiénicos con riesgo alto en la matriz y sin medición' : '', 'peligros.html', 'Mediciones de los riesgos prioritarios cuando se requieren (o registra «No aplica» con la justificación).'); },
    '4.2.1': (c) => { const p = c.de('peligro'), pend = p.reduce((a, x) => a + (Number(x.resumen.controlesPendientes) || 0), 0);
      return R(p.length && !pend ? 'ok' : p.length ? 'parcial' : 'falta', p.length ? (pend ? pend + ' medida(s) de intervención por implementar' : 'Medidas de intervención implementadas en la matriz') : '', 'peligros.html', 'Implementa las medidas de la matriz según la jerarquía de controles.'); },
    '4.2.2': (c) => { const i = c.desde('inspeccion', 'fecha', 92).length; return R(i ? 'ok' : 'falta', i ? i + ' inspección(es) en los últimos 3 meses' : '', 'inspecciones.html', 'Verifica en campo que se cumplan las medidas (inspecciones).'); },
    '4.2.3': (c) => { const d = c.de('documento').filter((x) => /Procedimiento|Instructivo|Programa/.test(x.resumen.tipoDoc)).length, pr = c.de('programa').length;
      return R(d ? 'ok' : pr ? 'parcial' : 'falta', [d ? d + ' procedimiento(s), instructivo(s) o programa(s) en el listado maestro' : '', pr ? pr + ' programa(s) de alto riesgo' : ''], 'documental.html', 'Procedimientos e instructivos de las tareas críticas, divulgados.'); },
    '4.2.4': (c) => { const l = c.desde('inspeccion', 'fecha', 365), cop = l.filter((x) => /COPASST|Vig/i.test(x.resumen.tipoInspeccion) || Number(x.resumen.participantes) > 0);
      return R(cop.length ? 'ok' : l.length ? 'parcial' : 'falta', l.length ? l.length + ' inspección(es) en el año, ' + cop.length + ' con participación del COPASST o vigía' : '', 'inspecciones.html', 'Programa inspecciones con el COPASST en el cronograma.'); },
    '4.2.5': (c) => { const e = c.de('equipo').filter((x) => x.resumen.activo !== false), v = e.filter((x) => Object.values(x.resumen.vencimientos || {}).some((f) => f && f < c.hoy));
      return R(e.length && !v.length ? 'ok' : e.length ? 'parcial' : 'falta', e.length ? e.length + ' equipo(s) en el inventario' + (v.length ? ', ' + v.length + ' con mantenimiento o certificación vencidos' : ', con sus fechas al día') : '', 'inspecciones.html', 'Inventario de equipos con sus fechas de mantenimiento al día.'); },
    '4.2.6': (c) => { const m = c.de('eppcargo').length, e = c.desde('entrega', 'fecha', 365).length;
      return R(m && e ? 'ok' : m || e ? 'parcial' : 'falta', [m ? 'Matriz de EPP con ' + m + ' cargo(s)' : '', e ? e + ' entrega(s) con firma en el año' : ''], 'entrega-epp.html', 'Matriz de EPP por cargo y entregas firmadas con capacitación.'); },
    '5.1.1': (c) => { const p = c.de('emergencia').filter((x) => c.vigente(x)), s = c.desde('simulacro', 'fecha', 365);
      return R(p.length && s.length ? 'ok' : p.length || s.length || c.de('emergencia').length ? 'parcial' : 'falta', [c.de('emergencia').length ? c.de('emergencia').length + ' plan(es) de emergencia' + (p.length < c.de('emergencia').length ? ' (alguno por actualizar)' : '') : '', s.length ? 'Simulacro del ' + s.map((x) => x.resumen.fecha).sort().slice(-1)[0] : 'Sin simulacro en el último año'], 'emergencias.html', 'Plan vigente y simulacro al menos una vez al año.'); },
    '5.1.2': (c) => { const b = c.de('emergencia').reduce((a, x) => a + (Number(x.resumen.brigadistas) || 0), 0), cap = c.de('emergencia').reduce((a, x) => a + (Number(x.resumen.brigadistasCapacitados) || 0), 0);
      return R(b && cap >= b ? 'ok' : b ? 'parcial' : 'falta', b ? b + ' brigadista(s), ' + cap + ' con capacitación vigente' : '', 'emergencias.html', 'Brigada conformada, capacitada y dotada.'); },
    '6.1.1': (c) => { const m = c.de('mes').filter((x) => x.resumen.trabajadores && x.resumen.mes >= c.menos(62).slice(0, 7)).length, p = c.de('plananual').find((x) => String(x.resumen.anio) === c.anio);
      return R(m && p ? 'ok' : m || p ? 'parcial' : 'falta', [m ? 'Indicadores de resultado al día' : '', p ? 'Indicadores de proceso: cumplimiento del plan anual ' + (p.resumen.cumplimiento || 0) + ' %' : ''], 'indicadores.html', 'Indicadores de estructura, proceso y resultado medidos.'); },
    '6.1.2': (c) => { const a = c.desde('auditoria', 'fechaEjecucion', 365).filter((x) => x.estado === 'CERRADA');
      return R(a.length ? 'ok' : c.de('auditoria').some((x) => x.estado !== 'CERRADA') ? 'parcial' : 'falta', a.length ? a.length + ' auditoría(s) cerrada(s) en el último año' : '', 'auditorias.html', 'Al menos una auditoría al año.'); },
    '6.1.3': (c) => { const r = c.desde('revision', 'fecha', 400); return R(r.length ? 'ok' : 'falta', r.length ? 'Revisión por la dirección del ' + r.map((x) => x.resumen.fecha).sort().slice(-1)[0] : '', 'revision-direccion.html', 'Revisión anual de la alta dirección, comunicada al COPASST.'); },
    '6.1.4': async (c) => { const a = c.desde('auditoria', 'fechaEjecucion', 365).filter((x) => x.estado === 'CERRADA').sort((x, y) => String(y.resumen.fechaEjecucion).localeCompare(String(x.resumen.fechaEjecucion)))[0];
      if (!a) return R('falta', '', 'auditorias.html', 'Planea la auditoría con el COPASST.');
      let d = null; try { d = c.docDe ? await c.docDe(a.id) : null; } catch (e) {}
      const si = !!(d && d.copasst && d.copasst.participo);
      return R(si ? 'ok' : 'parcial', a.resumen.titulo + ' (' + a.resumen.fechaEjecucion + ')' + (si ? ': participó el COPASST' + (d.copasst.nombre ? ' (' + d.copasst.nombre + ')' : '') : ': no figura la participación del COPASST'), 'auditorias.html#' + a.id, 'Anota en la auditoría quién del COPASST participó.'); },
    '7.1.1': (c) => REGLAS._acciones(c, /Inspecci|Reporte de acto|Matriz de peligros|Programa|Simulacro|Auditor/, 'de inspecciones, reportes, auditorías y la matriz'),
    '7.1.2': (c) => REGLAS._acciones(c, /Revisión por la dirección/, 'de la revisión por la dirección'),
    '7.1.3': (c) => REGLAS._acciones(c, /Accidente|Incidente/, 'de investigaciones de incidentes y accidentes'),
    '7.1.4': (c) => { const a = c.acc.filter((x) => /Autoevaluación|Requerimiento ARL/.test(x.resumen.origen));
      return R(a.length ? 'ok' : 'manual', a.length ? a.length + ' acción(es) del plan de mejoramiento de la autoevaluación' : '', 'plan-accion.html', 'Plan de mejoramiento con lo que pidan el Ministerio o la ARL (si lo pidieron).'); },
    _acciones: (c, re, que) => { const a = c.acc.filter((x) => re.test(x.resumen.origen)), venc = a.filter((x) => x.estado !== 'CERRADA' && x.resumen.fechaCompromiso && x.resumen.fechaCompromiso < c.hoy);
      return R(a.length && !venc.length ? 'ok' : a.length ? 'parcial' : 'manual', a.length ? a.length + ' acción(es) ' + que + ', ' + a.filter((x) => x.estado === 'CERRADA').length + ' cerradas' + (venc.length ? ', ' + venc.length + ' vencidas' : '') : '', 'plan-accion.html', 'Acciones con responsable y fecha a partir de los hallazgos (o justifica si no hubo hallazgos).'); }
  };

  /** items: [[id, ciclo, grupo, valor, texto], …] de la plantilla que le aplica. Devuelve [{id, …, e, ev, href, que}] */
  async function evaluar(items, ctx) {
    const c = preparar(ctx), out = [];
    for (const it of items) {
      const f = REGLAS[it[0]];
      let r = R('manual', '', '', 'Revisa este estándar a mano.');
      try { if (f) r = await f(c); } catch (e) { r = R('manual', '', '', 'No se pudo revisar con los datos del portal: ' + e.message); }
      // v148: lo que el portal no registra se puede soportar a mano: «No aplica» justificado o evidencia con fecha (tipo evid0312).
      if (r.e === 'manual' || r.e === 'falta') {
        const m = c.de('evid0312').filter((x) => x.resumen.estandar === it[0] && String(x.resumen.fecha || '') >= c.menos(400)).sort((a, b) => String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)))[0];
        if (m) r = R('ok', (m.resumen.estado === 'No aplica' ? 'No aplica: ' : 'Evidencia registrada: ') + (m.resumen.justificacion || '') + ' (' + m.resumen.fecha + ')', r.href, '');
        r.registrable = true;
      }
      out.push(Object.assign({ id: it[0], ciclo: it[1], grupo: it[2], valor: it[3], texto: it[4] }, r));
    }
    return out;
  }
  function resumen(lista) {
    const tot = lista.reduce((a, x) => a + (Number(x.valor) || 0), 0), ok = lista.filter((x) => x.e === 'ok');
    const cnt = (e) => lista.filter((x) => x.e === e).length;
    return { pct: tot ? Math.round(ok.reduce((a, x) => a + (Number(x.valor) || 0), 0) * 1000 / tot) / 10 : 0, ok: cnt('ok'), parcial: cnt('parcial'), falta: cnt('falta'), manual: cnt('manual'), reservado: cnt('reservado'), total: lista.length };
  }
  return { evaluar, resumen, REGLAS };
})();
if (typeof module !== 'undefined') module.exports = EVIDENCIAS;
