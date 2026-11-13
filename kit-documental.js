/* ============================================================
   kit-documental.js — Documentos del SG-SST con los datos de la empresa
   ------------------------------------------------------------
   Cada documento sale con la razón social, el NIT, la actividad, el
   número de trabajadores, la ARL, el representante legal y el
   responsable del SG-SST del perfil de la empresa, y con lo que ya hay
   en el portal (peligros de la matriz, comités, códigos de formatos).
   Son una base técnica revisada contra el Decreto 1072 de 2015 (Libro 2,
   Parte 2, Título 4, Capítulo 6) y la Resolución 0312 de 2019: la
   empresa los revisa, los ajusta a su realidad y los aprueba.

   KIT_DOCUMENTOS: [{ id, formato, titulo, tipo, estandar (numeral de la
     Res. 0312), norma, generar(c) → [[título de sección, html], …] }]
   ============================================================ */
const KIT_DOCUMENTOS = (function () {
  const e = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p = (t) => '<p>' + t + '</p>';
  const ul = (l) => '<ul>' + l.filter(Boolean).map((x) => '<li>' + x + '</li>').join('') + '</ul>';
  const ol = (l) => '<ol>' + l.filter(Boolean).map((x) => '<li>' + x + '</li>').join('') + '</ol>';
  const tabla = (cab, filas, anchos) => '<table><tr>' + cab.map((h, i) => '<th' + (anchos && anchos[i] ? ' style="width:' + anchos[i] + '"' : '') + '>' + h + '</th>').join('') + '</tr>' +
    filas.map((f) => '<tr>' + f.map((x) => '<td>' + x + '</td>').join('') + '</tr>').join('') + '</table>';
  // "del COPASST" / "al Vigía" (con la contracción bien hecha).
  const delC = (c) => e(String(c.comiteTxt).replace(/^el /, 'del '));
  const alC = (c) => e(String(c.comiteTxt).replace(/^el /, 'al '));
  const ref = (c, id, nombre) => '<i>' + nombre + '</i>' + (c.cod(id) ? ' (' + e(c.cod(id)) + ')' : '');
  const alcance = (c) => p('Aplica a todos los trabajadores de ' + e(c.emp) + ', independientemente de su forma de contratación o vinculación, incluidos contratistas, subcontratistas, trabajadores en misión y visitantes, en todos sus centros de trabajo' + (c.sedes ? ' (' + e(c.sedes) + ')' : '') + '.');

  return [
    /* ───────────── POLÍTICA ───────────── */
    { id: 'POLITICA', formato: 'SG-POLITICA', titulo: 'Política de seguridad y salud en el trabajo', tipo: 'Política', estandar: '2.1.1', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.5 a 2.2.4.6.7',
      generar: (c) => [
        ['', p('<b>' + e(c.emp) + '</b>' + (c.nit ? ', identificada con NIT ' + e(c.nit) + ',' : '') + ' empresa dedicada a ' + e(c.act || 'su actividad económica') + ', con ' + e(c.trab) + ' trabajadores y clase de riesgo ' + e(c.riesgo) + ' ante su ARL' + (c.arl ? ' (' + e(c.arl) + ')' : '') + ', se compromete con la protección de la seguridad y la salud de todos sus trabajadores, contratistas, subcontratistas y visitantes, mediante la implementación, el mantenimiento y la mejora continua del Sistema de Gestión de la Seguridad y Salud en el Trabajo (SG-SST).') +
          p('Para ello, la empresa se compromete a:') +
          ul(['Identificar los peligros, evaluar y valorar los riesgos y establecer los respectivos controles' + (c.peligros.length ? ', con especial atención a los peligros prioritarios de sus procesos (' + c.peligros.slice(0, 5).map((x) => e(x.clase.toLowerCase())).join(', ') + ')' : '') + '.',
            'Proteger la seguridad y salud de todos los trabajadores mediante la mejora continua del SG-SST.',
            'Cumplir la normatividad nacional vigente aplicable en materia de riesgos laborales y los demás requisitos que suscriba la organización.',
            'Prevenir las lesiones y enfermedades laborales y promover la calidad de vida laboral.',
            'Asignar los recursos financieros, técnicos y humanos necesarios para el SG-SST.',
            'Promover la participación y la consulta de los trabajadores y ' + delC(c) + '.',
            'Prepararse y responder ante emergencias.']) +
          p('Esta política es de obligatorio cumplimiento para todos los niveles de la organización. Se divulga a todos los trabajadores, se comunica ' + alC(c) + ', está disponible para todas las partes interesadas y se revisa como mínimo una vez al año, y se actualiza cuando cambien las condiciones de la empresa o la normatividad.') +
          p('Dada en ' + e(c.ciudad || '__________') + ', el ' + e(c.fechaLarga) + '.')]
      ] },

    /* ───────────── OBJETIVOS ───────────── */
    { id: 'OBJETIVOS', formato: 'SG-OBJETIVOS', titulo: 'Objetivos del SG-SST', tipo: 'Documento', estandar: '2.2.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.18; Res. 0312 de 2019, art. 30',
      generar: (c) => [
        ['Propósito', p('Definir los objetivos del SG-SST de ' + e(c.emp) + ', coherentes con la política de SST, claros, medibles y cuantificables, con metas definidas para su cumplimiento. Se revisan y evalúan mínimo una vez al año y se actualizan según las prioridades de la empresa.')],
        ['Objetivos, metas e indicadores', tabla(['Objetivo', 'Meta', 'Indicador', 'Frecuencia'], [
          ['Identificar los peligros, evaluar y valorar los riesgos y aplicar los controles en todos los procesos.', '100 % de los procesos con peligros identificados; 100 % de los riesgos no aceptables con control.', 'Riesgos no aceptables intervenidos / riesgos no aceptables identificados × 100', 'Semestral'],
          ['Proteger la seguridad y salud de los trabajadores, reduciendo los accidentes de trabajo.', 'Disminuir la frecuencia de accidentalidad frente al año anterior (meta que fija la empresa).', 'Frecuencia de accidentalidad: n.º de AT en el mes / n.º de trabajadores en el mes × 100', 'Mensual'],
          ['Disminuir los días perdidos por accidentes de trabajo.', 'Disminuir la severidad frente al año anterior.', 'Severidad: días de incapacidad por AT + días cargados en el mes / n.º de trabajadores en el mes × 100', 'Mensual'],
          ['Prevenir la enfermedad laboral.', 'Cero casos nuevos de enfermedad laboral.', 'Incidencia y prevalencia de enfermedad laboral (por cada 100.000 trabajadores)', 'Anual'],
          ['Controlar el ausentismo por causa médica.', 'Mantenerlo por debajo del valor que fije la empresa.', 'Días de ausencia por incapacidad / días de trabajo programados × 100', 'Mensual'],
          ['Cumplir la normatividad vigente en SST.', '100 % de requisitos legales aplicables evaluados; plan de acción para los no cumplidos.', 'Requisitos cumplidos / requisitos aplicables × 100 (matriz legal)', 'Anual'],
          ['Ejecutar el plan anual de trabajo y el programa de capacitación.', '≥ 90 % de las actividades programadas ejecutadas.', 'Actividades ejecutadas / actividades programadas × 100', 'Trimestral'],
          ['Mejorar continuamente el SG-SST.', 'Cumplimiento de los estándares mínimos ≥ 86 % (aceptable).', 'Resultado de la autoevaluación de estándares mínimos (Res. 0312 de 2019)', 'Anual']
        ], ['30%', '24%', '30%', '16%'])],
        ['Seguimiento', p('Los indicadores se calculan en el portal (Indicadores, Plan anual, Matriz legal, Auditorías). Sus resultados se presentan en la revisión por la alta dirección y se comunican ' + alC(c) + '. Las metas numéricas las ajusta la gerencia cada año según los resultados del año anterior.')]
      ] },

    /* ───────────── DESIGNACIÓN DEL RESPONSABLE ───────────── */
    { id: 'DESIGNACION', formato: 'SG-DESIGNACION', titulo: 'Designación del responsable del SG-SST', tipo: 'Documento', estandar: '1.1.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.8; Res. 0312 de 2019',
      generar: (c) => [
        ['', p(e(c.ciudad || '__________') + ', ' + e(c.fechaLarga)) +
          p('Señor(a)<br><b>' + e(c.resp || '______________________') + '</b><br>' + (c.respCc ? 'C.C. ' + e(c.respCc) + '<br>' : '') + 'Ciudad') +
          p('<b>Asunto:</b> designación como responsable del Sistema de Gestión de la Seguridad y Salud en el Trabajo.') +
          p('En mi calidad de representante legal de <b>' + e(c.emp) + '</b>' + (c.nit ? ', NIT ' + e(c.nit) : '') + ', me permito designarle como responsable del diseño, la implementación, la ejecución, la evaluación y la mejora del Sistema de Gestión de la Seguridad y Salud en el Trabajo (SG-SST) de la empresa, con las siguientes responsabilidades:') +
          ul(['Planificar, organizar, dirigir, desarrollar y aplicar el SG-SST y, como mínimo una vez al año, realizar su evaluación.',
            'Informar a la alta dirección sobre el funcionamiento y los resultados del SG-SST.',
            'Promover la participación de todos los miembros de la empresa en la implementación del SG-SST.',
            'Coordinar la identificación de peligros, la evaluación y valoración de riesgos y los controles.',
            'Elaborar el plan anual de trabajo y el programa de capacitación, y hacerles seguimiento.',
            'Coordinar el reporte e investigación de incidentes, accidentes de trabajo y enfermedades laborales.',
            'Mantener actualizados los registros y documentos del SG-SST.']) +
          p('Para el ejercicio de esta designación usted cuenta con licencia en seguridad y salud en el trabajo' + (c.respLic ? ' n.º ' + e(c.respLic) : ' vigente') + ' y con el curso virtual de cincuenta (50) horas en SG-SST' + (c.respCurso ? ' (certificado del ' + e(c.respCurso) + ')' : '') + ', con su actualización cuando corresponda. La empresa le asignará los recursos necesarios para cumplir estas funciones.') +
          '<table style="margin-top:28px;"><tr><td style="width:50%;height:70px;vertical-align:bottom;">_______________________________<br><b>' + e(c.rep || 'Representante legal') + '</b><br>Representante legal' + (c.repCc ? ' · C.C. ' + e(c.repCc) : '') + '</td>' +
          '<td class="u-abajo">_______________________________<br><b>' + e(c.resp || 'Responsable del SG-SST') + '</b><br>Acepto la designación' + (c.respCc ? ' · C.C. ' + e(c.respCc) : '') + '</td></tr></table>']
      ], sinFirmas: true },

    /* ───────────── ROLES Y RESPONSABILIDADES ───────────── */
    { id: 'ROLES', formato: 'SG-ROLES', titulo: 'Roles y responsabilidades en el SG-SST', tipo: 'Documento', estandar: '1.1.2', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.8 y 2.2.4.6.10',
      generar: (c) => [
        ['Objetivo', p('Definir y comunicar las responsabilidades en seguridad y salud en el trabajo de todos los niveles de ' + e(c.emp) + '.')],
        ['Alcance', alcance(c)],
        ['Responsabilidades', tabla(['Rol', 'Responsabilidades'], [
          ['<b>Alta dirección (gerencia)</b>', ul(['Definir, firmar y divulgar la política de SST.', 'Asignar los recursos financieros, técnicos y humanos del SG-SST.', 'Designar al responsable del SG-SST.', 'Rendir cuentas sobre su desempeño en SST.', 'Revisar el SG-SST como mínimo una vez al año.', 'Garantizar la participación de los trabajadores y el funcionamiento de los comités.'])],
          ['<b>Responsable del SG-SST</b>', ul(['Diseñar, implementar, evaluar y mejorar el SG-SST.', 'Coordinar la identificación de peligros y la valoración de riesgos.', 'Elaborar y hacer seguimiento al plan anual de trabajo, la capacitación y los indicadores.', 'Coordinar el reporte e investigación de incidentes y accidentes.', 'Informar a la alta dirección sobre el funcionamiento del sistema.'])],
          ['<b>Jefes, coordinadores y supervisores</b>', ul(['Hacer cumplir los procedimientos y controles de SST en sus áreas.', 'Participar en la identificación de peligros y en las investigaciones de su área.', 'Diligenciar y verificar permisos de trabajo, ATS e inspecciones.', 'Facilitar la capacitación de su personal.', 'Reportar de inmediato incidentes, accidentes y condiciones inseguras.'])],
          ['<b>Trabajadores</b>', ul(['Procurar el cuidado integral de su salud.', 'Suministrar información clara, veraz y completa sobre su estado de salud.', 'Cumplir las normas, reglamentos e instrucciones del SG-SST.', 'Informar oportunamente sobre los peligros y riesgos latentes en su sitio de trabajo.', 'Participar en las actividades de capacitación definidas en el plan de capacitación.', 'Participar y contribuir al cumplimiento de los objetivos del SG-SST.'])],
          ['<b>' + e(c.comite) + '</b>', ul(['Proponer medidas de prevención y participar en las actividades de promoción.', 'Participar en las inspecciones planeadas y en la investigación de incidentes y accidentes.', 'Vigilar el cumplimiento del SG-SST.', 'Recibir y tramitar las sugerencias de los trabajadores en SST.' + (c.trab >= 10 ? ' Reunirse por lo menos una vez al mes.' : '')])],
          ['<b>Comité de Convivencia Laboral</b>', ul(['Recibir y tramitar las quejas de acoso laboral con confidencialidad.', 'Desarrollar las medidas preventivas y correctivas del acoso laboral, según la norma vigente.'])],
          ['<b>Brigada de emergencias</b>', ul(['Prepararse y actuar en la prevención y atención de emergencias según el plan de emergencias.'])],
          ['<b>Contratistas y proveedores</b>', ul(['Cumplir los requisitos de SST de la empresa y la normatividad vigente.', 'Afiliar a su personal al Sistema de Seguridad Social Integral.', 'Reportar los incidentes y accidentes de su personal.'])]
        ], ['26%', '74%'])],
        ['Comunicación y rendición de cuentas', p('Estas responsabilidades se comunican en la inducción y la reinducción, y quienes tienen responsabilidades en el SG-SST rinden cuentas de su desempeño por lo menos una vez al año (portal: Revisión por la dirección → rendición de cuentas).')]
      ] },

    /* ───────────── RECURSOS ───────────── */
    { id: 'RECURSOS', formato: 'SG-RECURSOS', titulo: 'Asignación de recursos para el SG-SST', tipo: 'Documento', estandar: '1.1.3', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.8, num. 4',
      generar: (c) => [
        ['', p('La gerencia de <b>' + e(c.emp) + '</b> asigna para el año ' + e(c.anio) + ' los siguientes recursos para el diseño, la implementación, la revisión, la evaluación y la mejora del SG-SST. Su ejecución se revisa en la revisión por la alta dirección.')],
        ['Recursos', tabla(['Tipo', 'Concepto', 'Valor / descripción', 'Responsable'], [
          ['Humanos', 'Responsable del SG-SST' + (c.resp ? ' (' + e(c.resp) + ')' : ''), '', ''], ['Humanos', e(c.comite) + ' y Comité de Convivencia: horas para reuniones y capacitación', '', ''], ['Humanos', 'Brigada de emergencias: tiempo de capacitación y simulacros', '', ''],
          ['Financieros', 'Evaluaciones médicas ocupacionales', '', ''], ['Financieros', 'Elementos de protección personal', '', ''], ['Financieros', 'Capacitación y entrenamiento (alturas, primeros auxilios, etc.)', '', ''],
          ['Financieros', 'Mediciones ambientales e higiene industrial', '', ''], ['Financieros', 'Señalización, equipos de emergencia y botiquines', '', ''], ['Técnicos', 'Plataforma del SG-SST (portal), equipos y software', '', ''], ['Técnicos', 'Asesoría externa en SST', '', ''],
          ['', '<b>Total</b>', '', '']
        ], ['14%', '46%', '22%', '18%'])]
      ] },

    /* ───────────── REGLAMENTO DE HIGIENE ───────────── */
    { id: 'REGLAMENTO', formato: 'SG-REGLAMENTO', titulo: 'Reglamento de higiene y seguridad industrial', tipo: 'Documento', estandar: '', norma: 'Código Sustantivo del Trabajo, arts. 349 a 352',
      generar: (c) => [
        ['', p('<b>Razón social:</b> ' + e(c.emp) + (c.nit ? ' · <b>NIT:</b> ' + e(c.nit) : '') + '<br><b>Dirección:</b> ' + e(c.dir || '__________') + ' · <b>Ciudad:</b> ' + e(c.ciudad || '__________') + '<br><b>Actividad económica:</b> ' + e(c.act || '__________') + '<br><b>ARL:</b> ' + e(c.arl || '__________') + ' · <b>Clase de riesgo:</b> ' + e(c.riesgo) + '<br><b>Trabajadores:</b> ' + e(c.trab))],
        ['Artículo 1', p('La empresa se compromete a dar cumplimiento a las disposiciones legales vigentes, tendientes a garantizar los mecanismos que aseguren una oportuna y adecuada prevención de los accidentes de trabajo y enfermedades laborales, de conformidad con el Código Sustantivo del Trabajo, la Ley 9 de 1979, la Resolución 2400 de 1979, el Decreto 1072 de 2015, la Resolución 0312 de 2019 y demás normas que se establezcan.')],
        ['Artículo 2', p('La empresa se obliga a promover y garantizar la constitución y el funcionamiento ' + delC(c) + ' y del Comité de Convivencia Laboral, de conformidad con la normatividad vigente.')],
        ['Artículo 3', p('La empresa se compromete a destinar los recursos necesarios para desarrollar actividades permanentes, de conformidad con el Sistema de Gestión de la Seguridad y Salud en el Trabajo, elaborado de acuerdo con el Decreto 1072 de 2015, que contempla, como mínimo: medicina preventiva y del trabajo, higiene y seguridad industrial, y prevención, preparación y respuesta ante emergencias.')],
        ['Artículo 4', p('Los peligros existentes en la empresa están constituidos principalmente por:') +
          (c.peligros.length ? tabla(['Clasificación', 'Peligros identificados (matriz de peligros)'], c.peligros.map((x) => [e(x.clase), e(x.ejemplos.join('; '))]), ['28%', '72%']) : p('<i>(Se completa con los peligros de la matriz de peligros de la empresa.)</i>')) +
          p('Parágrafo: para que los peligros contemplados en el presente artículo no se traduzcan en accidentes de trabajo o enfermedades laborales, la empresa ejerce su control en la fuente, en el medio transmisor o en el trabajador, de conformidad con lo estipulado en el SG-SST, el cual se da a conocer a todos los trabajadores al servicio de ella.')],
        ['Artículo 5', p('La empresa y sus trabajadores darán estricto cumplimiento a las disposiciones legales, así como a las normas técnicas e internas que se adopten para lograr la implantación de las actividades de medicina preventiva y del trabajo, higiene y seguridad industrial, que sean concordantes con el presente reglamento y con el SG-SST.')],
        ['Artículo 6', p('La empresa ha implantado un proceso de inducción del trabajador a las actividades que debe desempeñar, capacitándolo respecto a las medidas de prevención y seguridad que exija el medio ambiente laboral y el trabajo específico que vaya a realizar.')],
        ['Artículo 7', p('Este reglamento permanecerá exhibido en, por lo menos, dos lugares visibles de los centros de trabajo, junto con la resolución aprobatoria si la hubiere, cuyos contenidos se dan a conocer a todos los trabajadores en el momento de su ingreso.')],
        ['Artículo 8', p('El presente reglamento entra en vigor a partir de su publicación y durante el tiempo que la empresa conserve, sin cambios sustanciales, las condiciones existentes en el momento de su aprobación, tales como actividad económica, métodos de producción, instalaciones locativas, o cuando se dicten disposiciones gubernamentales que modifiquen las normas del reglamento o que limiten su vigencia.')] ,
        ['Nota', p('<i>El Código Sustantivo del Trabajo (art. 349) exige este reglamento a los empleadores con diez (10) o más trabajadores permanentes.' + (c.trab < 10 ? ' Con ' + e(c.trab) + ' trabajadores no es obligatorio, pero es una buena práctica.' : '') + ' Verifica el texto vigente de la norma.</i>')]
      ] },

    /* ───────────── PROCEDIMIENTOS ───────────── */
    { id: 'PROC-PELIGROS', formato: 'SG-PROC-PELIGROS', titulo: 'Procedimiento de identificación de peligros, evaluación y valoración de riesgos', tipo: 'Procedimiento', estandar: '4.1.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.15; GTC 45 de 2012',
      generar: (c) => [
        ['Objetivo', p('Establecer la metodología para identificar los peligros, evaluar y valorar los riesgos y determinar los controles en todos los procesos, actividades y tareas de ' + e(c.emp) + '.')],
        ['Alcance', alcance(c) + p('Incluye actividades rutinarias y no rutinarias, internas o externas, máquinas, equipos, instalaciones y todos los centros de trabajo.')],
        ['Metodología', p('Se usa la Guía Técnica Colombiana GTC 45 (2012):') + ol(['Clasificar los procesos, actividades y tareas.', 'Identificar los peligros (biológico, físico, químico, psicosocial, biomecánico, condiciones de seguridad y fenómenos naturales) y sus efectos posibles.', 'Identificar los controles existentes (fuente, medio, individuo).',
          'Evaluar el riesgo: nivel de probabilidad NP = nivel de deficiencia (ND) × nivel de exposición (NE); nivel de riesgo NR = NP × nivel de consecuencia (NC).', 'Valorar el riesgo: nivel I (no aceptable), II (no aceptable o aceptable con control específico), III (mejorable) y IV (aceptable).',
          'Definir las medidas de intervención en orden de jerarquía: eliminación, sustitución, controles de ingeniería, controles administrativos y elementos de protección personal.', 'Llevar las medidas por implementar al plan de acción, con responsable y fecha.'])],
        ['Participación y actualización', p('La identificación se hace con la participación de trabajadores de todos los niveles y ' + delC(c) + '. La matriz se actualiza como mínimo una vez al año y cada vez que ocurra un accidente de trabajo mortal o un evento catastrófico, o cuando haya cambios en los procesos, las instalaciones, la maquinaria o los equipos.')],
        ['Registros', ul(['Matriz de identificación de peligros y valoración de riesgos (portal: Matriz de peligros).', 'Registro de las revisiones con participación de los trabajadores.', 'Acciones en el plan de acción.'])]
      ] },
    { id: 'PROC-INVESTIGACION', formato: 'SG-PROC-INVESTIGACION', titulo: 'Procedimiento de reporte e investigación de incidentes, accidentes de trabajo y enfermedades laborales', tipo: 'Procedimiento', estandar: '3.2.2', norma: 'Resolución 1401 de 2007; Decreto 1072 de 2015, art. 2.2.4.6.32',
      generar: (c) => [
        ['Objetivo', p('Establecer cómo se reportan e investigan los incidentes, accidentes de trabajo y enfermedades laborales en ' + e(c.emp) + ', para identificar sus causas y evitar que se repitan.')],
        ['Alcance', alcance(c)],
        ['Definiciones', ul(['<b>Incidente:</b> suceso acaecido en el curso del trabajo o en relación con este, que tuvo el potencial de ser un accidente, en el que hubo personas involucradas sin que sufrieran lesiones.', '<b>Accidente de trabajo:</b> suceso repentino que sobreviene por causa o con ocasión del trabajo y que produce en el trabajador una lesión orgánica, una perturbación funcional o psiquiátrica, una invalidez o la muerte (Ley 1562 de 2012, art. 3).', '<b>Enfermedad laboral:</b> la contraída como resultado de la exposición a factores de riesgo inherentes a la actividad laboral o al medio en que el trabajador se ha visto obligado a trabajar (Ley 1562 de 2012, art. 4).'])],
        ['Reporte', ol(['El trabajador o quien presencie el evento informa de inmediato a su jefe y al responsable del SG-SST.', 'Se brinda la atención de primeros auxilios y se remite al centro asistencial de la red de la ARL' + (c.arl ? ' (' + e(c.arl) + ')' : '') + '.',
          'El accidente de trabajo o la enfermedad laboral diagnosticada se reportan a la ARL y a la EPS dentro de los <b>dos (2) días hábiles</b> siguientes (FURAT/FUREL).', 'Todo incidente, acto o condición insegura se registra en el portal (Reportes).'])],
        ['Investigación', p('Se investigan todos los incidentes, accidentes de trabajo y enfermedades laborales, dentro de los <b>quince (15) días</b> siguientes a su ocurrencia, por un equipo investigador conformado como mínimo por el jefe inmediato o supervisor del trabajador, un representante ' + delC(c) + ' y el responsable del SG-SST. Cuando el accidente sea grave o produzca la muerte, participa un profesional con licencia en SST, y el informe se remite a la ARL dentro de los quince (15) días siguientes a la ocurrencia.') +
          ol(['Recolectar la información: sitio, testigos, fotos, documentos.', 'Describir el evento.', 'Analizar las causas inmediatas (actos y condiciones) y básicas (factores personales y del trabajo).', 'Definir las medidas de control y llevarlas al plan de acción con responsable y fecha.', 'Comunicar las lecciones aprendidas y hacer seguimiento a las acciones.'])],
        ['Análisis estadístico', p('Mensualmente se calculan los indicadores de frecuencia, severidad y ausentismo, y anualmente los de mortalidad, prevalencia e incidencia de enfermedad laboral (portal: Indicadores). Los resultados se presentan a la gerencia y ' + alC(c) + '.')],
        ['Registros', ul(['Reporte del evento e investigación (portal: Reportes).', 'Copia del FURAT/FUREL radicado.', 'Acciones en el plan de acción.'])]
      ] },
    { id: 'PROC-ACCIONES', formato: 'SG-PROC-ACCIONES', titulo: 'Procedimiento de acciones correctivas, preventivas y de mejora', tipo: 'Procedimiento', estandar: '7.1.1', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.33 y 2.2.4.6.34',
      generar: (c) => [
        ['Objetivo', p('Definir cómo se identifican, documentan, implementan y verifican las acciones correctivas, preventivas y de mejora del SG-SST de ' + e(c.emp) + '.')],
        ['Fuentes de acciones', ul(['Inspecciones planeadas y de EPP.', 'Reportes de actos y condiciones inseguras.', 'Investigación de incidentes, accidentes y enfermedades laborales.', 'Matriz de peligros y mediciones ambientales.', 'Auditorías y autoevaluación de estándares mínimos.', 'Revisión por la alta dirección.', 'Recomendaciones ' + delC(c) + ', la ARL y las autoridades.'])],
        ['Procedimiento', ol(['Registrar el hallazgo en el plan de acción del portal, con su origen.', 'Analizar la causa raíz (cuando se trata de una no conformidad).', 'Definir la acción, el tipo (correctiva, preventiva o de mejora), el responsable, la fecha de compromiso y la prioridad.', 'Ejecutar y registrar los avances.', 'Cerrar la acción con su evidencia.', 'Verificar la eficacia: ¿se eliminó la causa? Si no, se reabre o se define una acción nueva.'])],
        ['Seguimiento', p('El responsable del SG-SST revisa mensualmente las acciones vencidas (el portal envía un correo diario con lo que vence) y presenta su estado en la revisión por la alta dirección.')]
      ] },
    { id: 'PROC-CAMBIO', formato: 'SG-PROC-CAMBIO', titulo: 'Procedimiento de gestión del cambio', tipo: 'Procedimiento', estandar: '2.11.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.26',
      generar: (c) => [
        ['Objetivo', p('Evaluar el impacto que puedan generar sobre la seguridad y salud en el trabajo los cambios internos y externos de ' + e(c.emp) + ', antes de implementarlos.')],
        ['Cambios que se evalúan', ul(['Nuevos procesos, métodos de trabajo, instalaciones, maquinaria, equipos o sustancias.', 'Cambios en la estructura organizacional o en los cargos.', 'Cambios en la legislación aplicable.', 'Evolución del conocimiento en SST.', 'Nuevos centros de trabajo, clientes o contratistas.'])],
        ['Procedimiento', ol(['Quien propone el cambio lo registra en el portal (Documental → Gestión del cambio).', 'El responsable del SG-SST identifica los peligros y riesgos asociados y los requisitos legales.', 'Se definen los controles, la capacitación y los documentos que hay que actualizar.', 'La gerencia aprueba el cambio.', 'Se implementan los controles antes del cambio, se informa y capacita a los trabajadores afectados.', 'Se actualiza la matriz de peligros y la documentación.'])],
        ['Registros', ul(['Registro de gestión del cambio.', 'Matriz de peligros actualizada.', 'Registros de capacitación.'])]
      ] },
    { id: 'PROC-AUDITORIA', formato: 'SG-PROC-AUDITORIA', titulo: 'Procedimiento de auditoría interna del SG-SST', tipo: 'Procedimiento', estandar: '6.1.2', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.29 y 2.2.4.6.30',
      generar: (c) => [
        ['Objetivo', p('Verificar como mínimo una vez al año el cumplimiento del SG-SST de ' + e(c.emp) + ' mediante una auditoría planificada con la participación ' + delC(c) + '.')],
        ['Auditor', p('Personal idóneo, competente e independiente del área o proceso auditado (interno o externo).')],
        ['Alcance de la auditoría', p('Abarca, entre otros, los temas del art. 2.2.4.6.30 del Decreto 1072 de 2015:') + ul(['Cumplimiento de la política de SST.', 'Resultado de los indicadores.', 'Participación de los trabajadores.', 'Responsabilidades y rendición de cuentas.', 'Mecanismos de comunicación.', 'Planificación, desarrollo y aplicación del SG-SST.', 'Gestión del cambio.', 'Prevención, preparación y respuesta ante emergencias.', 'Consideración de la SST en las nuevas adquisiciones.', 'Alcance y aplicación del SG-SST frente a proveedores y contratistas.', 'Supervisión y medición de los resultados.', 'Proceso de investigación de incidentes, accidentes y enfermedades laborales.', 'Desarrollo del proceso de auditoría.', 'Evaluación por parte de la alta dirección.'])],
        ['Procedimiento', ol(['Programa anual de auditorías (portal: Auditorías → programa).', 'Plan de auditoría: alcance, criterios, fecha, auditor; se comunica ' + alC(c) + '.', 'Ejecución con la lista de verificación (Decreto 1072 o estándares mínimos).', 'Informe con hallazgos: no conformidades, observaciones y oportunidades de mejora.', 'Cada hallazgo genera una acción en el plan de acción.', 'Los resultados se presentan en la revisión por la alta dirección.'])]
      ] },
    { id: 'PROC-REVISION', formato: 'SG-PROC-REVISION', titulo: 'Procedimiento de revisión por la alta dirección', tipo: 'Procedimiento', estandar: '6.1.3', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.31',
      generar: (c) => [
        ['Objetivo', p('Que la alta dirección de ' + e(c.emp) + ' revise como mínimo una vez al año el SG-SST, para determinar si se cumplen la política y los objetivos y si se controlan los riesgos.')],
        ['Entradas', ul(['Cumplimiento del plan anual de trabajo y su cronograma.', 'Resultado de los indicadores y de la autoevaluación de estándares mínimos.', 'Estrategias implementadas y su eficacia frente a los objetivos.', 'Capacidad del SG-SST para satisfacer las necesidades de la empresa en SST.', 'Necesidad de cambios en el SG-SST, incluidos la política y los objetivos.', 'Suficiencia de los recursos.', 'Resultados de las auditorías y de la investigación de incidentes y accidentes.', 'Cumplimiento de los requisitos legales.', 'Rendición de cuentas.', 'Recomendaciones ' + delC(c) + '.'])],
        ['Salidas y comunicación', p('Decisiones sobre cambios en la política, los objetivos, los recursos y las acciones de mejora (al plan de acción). Los resultados se documentan y se comunican ' + alC(c) + ' y al responsable del SG-SST (portal: Revisión por la dirección).')]
      ] },
    { id: 'PROC-DOCUMENTOS', formato: 'SG-PROC-DOCUMENTOS', titulo: 'Procedimiento de control de documentos y conservación de registros', tipo: 'Procedimiento', estandar: '2.5.1', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.12 y 2.2.4.6.13',
      generar: (c) => [
        ['Objetivo', p('Asegurar que los documentos del SG-SST de ' + e(c.emp) + ' estén identificados, aprobados, actualizados y disponibles, y que los registros se conserven el tiempo exigido.')],
        ['Control de documentos', ul(['Cada documento tiene código, versión, fecha y aprobación; se registran en el listado maestro (portal: Documental).', 'Se revisan como mínimo una vez al año o cuando hay cambios.', 'Los documentos obsoletos se identifican y se retiran de uso.', 'Pueden estar en papel o en medio digital, y deben ser legibles, fácilmente identificables y accesibles para los trabajadores que los requieran.'])],
        ['Conservación (mínimo 20 años)', p('Se conservan por un periodo mínimo de veinte (20) años, contados a partir del momento en que cese la relación laboral del trabajador con la empresa:') + ul(['Los resultados de los perfiles epidemiológicos de salud de los trabajadores y los conceptos de los exámenes de ingreso, periódicos y de retiro.', 'Cuando la empresa cuente con médico especialista en salud ocupacional, los resultados de exámenes complementarios.', 'Los resultados de las mediciones y monitoreo a los ambientes de trabajo.', 'Los registros de las actividades de capacitación, formación y entrenamiento.', 'El registro del suministro de elementos y equipos de protección personal.']) + p('Las historias clínicas ocupacionales las custodia la IPS o el médico que hace las evaluaciones, según la normatividad vigente; la empresa no las conserva.')],
        ['Confidencialidad', p('La información de salud de los trabajadores es reservada; en el portal la ven solo los roles autorizados y nunca se registra el diagnóstico.')]
      ] },
    { id: 'PROC-COMUNICACION', formato: 'SG-PROC-COMUNICACION', titulo: 'Procedimiento de comunicación, participación y consulta', tipo: 'Procedimiento', estandar: '2.8.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.14',
      generar: (c) => [
        ['Objetivo', p('Definir cómo se recibe, documenta y responde la información de SST, interna y externa, en ' + e(c.emp) + ', y cómo participan los trabajadores.')],
        ['Comunicación interna', ul(['Inducción, reinducción, charlas y capacitaciones (registro de asistencia).', 'Carteleras, correo, mensajería y el portal.', 'Reuniones ' + delC(c) + ' y del Comité de Convivencia.', 'Divulgación de la política, los objetivos, los peligros y los resultados del SG-SST.'])],
        ['Auto reporte y respuesta a inquietudes', p('Los trabajadores reportan condiciones de salud, actos y condiciones inseguras y sugerencias en el portal (Reportes, incluso de forma anónima) o directamente a su jefe, al responsable del SG-SST o ' + alC(c) + '. Cada reporte se atiende y, cuando corresponde, genera una acción con respuesta al trabajador.')],
        ['Comunicación externa', ul(['ARL y EPS: reporte de accidentes y enfermedades laborales.', 'Ministerio del Trabajo y autoridades: requerimientos y reporte anual de estándares mínimos.', 'Contratistas y visitantes: requisitos de SST e inducción.', 'Comunidad y organismos de socorro: plan de emergencias.'])]
      ] },
    { id: 'PROC-COMPRAS', formato: 'SG-PROC-COMPRAS', titulo: 'Procedimiento de adquisiciones y contratación con criterios de SST', tipo: 'Procedimiento', estandar: '2.9.1', norma: 'Decreto 1072 de 2015, arts. 2.2.4.6.27 y 2.2.4.6.28',
      generar: (c) => [
        ['Objetivo', p('Identificar y evaluar las especificaciones de SST en las compras de productos y servicios y en la contratación de proveedores y contratistas de ' + e(c.emp) + '.')],
        ['Compras', ul(['Antes de comprar EPP, sustancias químicas, máquinas, equipos o herramientas, se definen sus especificaciones de SST (norma técnica, certificado, ficha de datos de seguridad en español, manual en español).', 'Al recibirlos se verifica que cumplan; las sustancias químicas se incluyen en el inventario con su etiqueta del SGA.'])],
        ['Contratistas', ol(['Selección y evaluación con criterios de SST (portal: Contratistas / proveedores).', 'Verificación de la afiliación y el pago de seguridad social de su personal.', 'Inducción en los peligros y las normas de la empresa antes de iniciar.', 'Verificación de competencias y certificados para tareas de alto riesgo.', 'Seguimiento a su desempeño en SST y reporte de sus incidentes y accidentes.', 'Reevaluación periódica.'])]
      ] },
    { id: 'PROC-EMERGENCIAS', formato: 'SG-PROC-EMERGENCIAS', titulo: 'Procedimiento de prevención, preparación y respuesta ante emergencias', tipo: 'Procedimiento', estandar: '5.1.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.25',
      generar: (c) => [
        ['Objetivo', p('Prevenir, prepararse y responder ante las emergencias que puedan afectar a los trabajadores, contratistas, visitantes e instalaciones de ' + e(c.emp) + '.')],
        ['Contenido del plan', ul(['Identificación sistemática de las amenazas y análisis de vulnerabilidad de cada centro de trabajo.', 'Recursos para la prevención, preparación y respuesta (equipos, brigada, apoyo externo).', 'Planes de acción y procedimientos operativos normalizados (evacuación, incendio, sismo, primeros auxilios, derrames, etc.).', 'Brigada conformada, capacitada y dotada.', 'Simulacros como mínimo una vez al año, con la participación de todos los trabajadores.', 'Inspección de los equipos de emergencia.', 'Articulación con los organismos de socorro y el plan de gestión del riesgo local.'])],
        ['Registros', ul(['Plan de emergencias (portal: Emergencias).', 'Informes de simulacros.', 'Inspecciones de extintores, botiquines y camillas.'])]
      ] },

    /* ───────────── PROGRAMAS ───────────── */
    { id: 'PROG-CAPACITACION', formato: 'SG-PROG-CAPACITACION', titulo: 'Programa de capacitación, inducción y reinducción en SST', tipo: 'Programa', estandar: '1.2.1', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.11',
      generar: (c) => [
        ['Objetivo', p('Desarrollar las competencias de los trabajadores de ' + e(c.emp) + ' para identificar los peligros y controlar los riesgos de su trabajo, según la matriz de peligros.')],
        ['Inducción y reinducción', p('Todo trabajador, contratista o visitante recibe inducción en SST antes de iniciar labores: política, peligros y controles de su cargo, procedimientos, emergencias, reporte de incidentes y derechos y deberes. La reinducción se hace como mínimo una vez al año o cuando hay cambios (portal: Inducción y reinducción, con evaluación).')],
        ['Temas del programa', tabla(['Tema', 'Dirigido a', 'Frecuencia'], [
          ['Política, objetivos y SG-SST', 'Todos', 'Anual'], ['Peligros de la matriz y sus controles' + (c.peligros.length ? ' (' + c.peligros.slice(0, 4).map((x) => e(x.clase.toLowerCase())).join(', ') + ')' : ''), 'Expuestos', 'Anual'],
          ['Reporte de actos, condiciones, incidentes y accidentes', 'Todos', 'Anual'], ['Uso y cuidado de EPP', 'Expuestos', 'Al entregar y anual'],
          ['Plan de emergencias, evacuación y simulacro', 'Todos', 'Anual'], ['Brigada: primeros auxilios, incendios, evacuación', 'Brigadistas', 'Según el plan'],
          [e(c.comite) + ': funciones', 'Integrantes', 'Al elegirse'], ['Comité de Convivencia: acoso laboral', 'Integrantes', 'Al elegirse'],
          ['Tareas de alto riesgo (alturas, espacios confinados, eléctrico, caliente, izajes)', 'Quienes las ejecutan', 'Según la norma de cada una'],
          ['SGA: etiquetas, pictogramas y fichas de datos de seguridad', 'Quienes manejan químicos', 'Anual'], ['Estilos de vida saludables', 'Todos', 'Anual']
        ], ['56%', '24%', '20%'])],
        ['Evaluación', p('Se registra la asistencia (portal: Asistencia a charlas) y se mide la cobertura (personas capacitadas / programadas) y la eficacia (evaluaciones). El cronograma va en el plan anual de trabajo.')]
      ] },
    { id: 'PROG-INSPECCIONES', formato: 'SG-PROG-INSPECCIONES', titulo: 'Programa de inspecciones planeadas', tipo: 'Programa', estandar: '4.2.4', norma: 'Decreto 1072 de 2015, art. 2.2.4.6.24; Res. 2013 de 1986',
      generar: (c) => [
        ['Objetivo', p('Identificar oportunamente las condiciones inseguras en las instalaciones, máquinas, equipos y herramientas de ' + e(c.emp) + ', con la participación ' + delC(c) + '.')],
        ['Qué se inspecciona', tabla(['Inspección', 'Frecuencia', 'Responsable'], [['Extintores, botiquines y camillas', 'Mensual', 'Brigada / SST'], ['Equipos de protección contra caídas, escaleras y andamios', 'Antes de cada uso y mensual', 'Usuario / supervisor'],
          ['Herramientas eléctricas, equipos de soldadura y oxicorte', 'Diaria (preoperacional)', 'Usuario'], ['Vehículos', 'Diaria (preoperacional)', 'Conductor'], ['Áreas de trabajo (locativa)', 'Mensual', 'Jefe de área'],
          ['Almacenamiento de sustancias químicas', 'Mensual', 'SST'], ['Instalaciones eléctricas', 'Trimestral', 'Mantenimiento'], ['Inspección gerencial', 'Según el cronograma', 'Gerencia'], ['Inspección del ' + e(c.comite), 'Según el cronograma', e(c.comite)]], ['50%', '25%', '25%'])],
        ['Procedimiento', ol(['El cronograma anual sale del inventario y de las inspecciones programadas (portal: Inspecciones → Cronograma).', 'Se inspecciona con la lista de chequeo de cada elemento; cada no conforme lleva observación y foto.', 'Los no conformes van al plan de acción con responsable y fecha.', 'Se mide el cumplimiento del cronograma (programadas frente a ejecutadas).'])]
      ] },
    { id: 'PROG-MEDICO', formato: 'SG-PROG-MEDICO', titulo: 'Programa de evaluaciones médicas ocupacionales', tipo: 'Programa', estandar: '3.1.4', norma: 'Resolución 1843 de 2025; Decreto 1072 de 2015',
      generar: (c) => [
        ['Objetivo', p('Realizar las evaluaciones médicas ocupacionales de ' + e(c.emp) + ' según los peligros de cada cargo, para conocer las condiciones de salud de los trabajadores en relación con su trabajo.')],
        ['Evaluaciones', ul(['<b>De ingreso:</b> antes de iniciar labores, según el perfil del cargo.', '<b>Periódicas:</b> con la frecuencia que defina el profesiograma según los peligros y los resultados.', '<b>De retiro:</b> al terminar la relación laboral.', '<b>Por cambio de ocupación y post incapacidad o reintegro,</b> cuando corresponda.'])],
        ['Responsabilidades', ul(['La empresa contrata las evaluaciones con médicos o IPS con licencia en SST y les informa los perfiles de cargo y sus peligros (profesiograma).', 'La empresa recibe solo el concepto de aptitud y las recomendaciones; <b>no recibe ni guarda el diagnóstico</b> (la historia clínica la custodia la IPS).', 'Las restricciones y recomendaciones se comunican al trabajador y a su jefe y se acatan.', 'El diagnóstico de condiciones de salud de la IPS alimenta los programas de vigilancia epidemiológica.'])],
        ['Registros', ul(['Profesiograma y programación de exámenes (portal: Salud en el trabajo).', 'Conceptos de aptitud (portal: Personal habilitado, solo apto/no apto y restricciones).']) + p('<i>Verifica el texto vigente de la Resolución 1843 de 2025 y lo que pida tu IPS.</i>')]
      ] },

    /* ───────────── MANUAL ───────────── */
    { id: 'MANUAL', formato: 'SG-MANUAL', titulo: 'Manual del Sistema de Gestión de la Seguridad y Salud en el Trabajo', tipo: 'Manual', estandar: '', norma: 'Decreto 1072 de 2015; Resolución 0312 de 2019',
      generar: (c) => [
        ['1. La empresa', p('<b>' + e(c.emp) + '</b>' + (c.nit ? ', NIT ' + e(c.nit) : '') + '. Actividad: ' + e(c.act || '—') + '. Trabajadores: ' + e(c.trab) + '. Clase de riesgo: ' + e(c.riesgo) + (c.arl ? '. ARL: ' + e(c.arl) : '') + '. Le aplican ' + e(c.grupo) + ' estándares mínimos (Resolución 0312 de 2019).')],
        ['2. Alcance', alcance(c)],
        ['3. Ciclo PHVA del SG-SST', tabla(['Etapa', 'Qué incluye', 'Dónde está'], [
          ['<b>Planear</b>', 'Política y objetivos, evaluación inicial, matriz legal, identificación de peligros, plan anual de trabajo, recursos, responsabilidades.', ref(c, 'SG-POLITICA', 'Política') + ', ' + ref(c, 'SG-OBJETIVOS', 'Objetivos') + ', ' + ref(c, 'SG-PROC-PELIGROS', 'Procedimiento de peligros') + ', portal: Plan anual, Matriz legal, Matriz de peligros'],
          ['<b>Hacer</b>', 'Medidas de prevención y control, capacitación, inspecciones, EPP, salud en el trabajo, emergencias, contratistas, gestión del cambio, tareas de alto riesgo.', ref(c, 'SG-PROG-CAPACITACION', 'Programa de capacitación') + ', ' + ref(c, 'SG-PROG-INSPECCIONES', 'Programa de inspecciones') + ', ' + ref(c, 'SG-PROC-EMERGENCIAS', 'Emergencias') + ', ' + ref(c, 'SG-PROC-CAMBIO', 'Gestión del cambio')],
          ['<b>Verificar</b>', 'Indicadores, investigación de incidentes y accidentes, auditoría, revisión por la alta dirección.', ref(c, 'SG-PROC-INVESTIGACION', 'Investigación') + ', ' + ref(c, 'SG-PROC-AUDITORIA', 'Auditoría') + ', ' + ref(c, 'SG-PROC-REVISION', 'Revisión por la dirección')],
          ['<b>Actuar</b>', 'Acciones correctivas, preventivas y de mejora; plan de mejoramiento.', ref(c, 'SG-PROC-ACCIONES', 'Acciones correctivas y preventivas') + ', portal: Plan de acción']
        ], ['14%', '46%', '40%'])],
        ['4. Organización', p('Representante legal: ' + e(c.rep || '—') + '. Responsable del SG-SST: ' + e(c.resp || '—') + '. ' + e(c.comite) + ' y Comité de Convivencia Laboral conformados según la norma. Las responsabilidades están en ' + ref(c, 'SG-ROLES', 'Roles y responsabilidades') + '.')],
        ['5. Documentos y registros', p('Los documentos del SG-SST se controlan según ' + ref(c, 'SG-PROC-DOCUMENTOS', 'Control de documentos') + ' y están en el listado maestro del portal. Los registros de la operación diaria (permisos de trabajo, ATS, inspecciones, entregas de EPP, capacitaciones, reportes, actas) se diligencian y se conservan en el portal.')]
      ] }
  ];
})();
/* Los formatos del kit (código, versión y fechas salen de empresa.js; si no están, se ven con el código de fábrica). */
const KIT_FORMATOS = KIT_DOCUMENTOS.reduce((o, d) => { o[d.formato] = d.titulo; return o; }, {});
