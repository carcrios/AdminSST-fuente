/* ============================================================
   auditorias-plantillas.js — Listas de verificación de auditoría
   ------------------------------------------------------------
   · RES0312: autoevaluación de los 60 estándares mínimos (Res. 0312 de
     2019, art. 16 y tabla de valores del art. 27). Se califica: cumple
     (valor completo), no cumple (0) o no aplica justificado (valor
     completo). Valoración del art. 28: <60 % crítico, 60–85 %
     moderadamente aceptable, >85 % aceptable.
   · DEC1072: alcance de la auditoría de cumplimiento del SG-SST
     (Decreto 1072 de 2015, art. 2.2.4.6.30).
   · ISO45001: preguntas propias por capítulo de la norma (4 a 10).
   · CONTRATISTA: requisitos de SST que suelen pedir los clientes a sus
     contratistas (preguntas propias, no es la guía RUC).
   · ISO14001: preguntas propias por capítulo de la norma ambiental.
   · RUC: sin preguntas: se pega la lista de la Guía RUC vigente (numeral,
     requisito y peso) desde Excel, y se calcula la calificación ponderada.
   Las preguntas son de este portal; los textos oficiales están en cada norma.
   ============================================================ */
const PLANTILLAS_AUDITORIA = {
  RES0312: {
    nombre: 'Autoevaluación de estándares mínimos (Res. 0312 de 2019)',
    corto: 'Estándares mínimos Res. 0312',
    tipo: 'puntaje',
    criterios: 'Resolución 0312 de 2019 (60 estándares, empresas de más de 50 trabajadores o riesgo IV y V); Decreto 1072 de 2015.',
    origenAccion: 'Autoevaluación Res. 0312',
    items: [
      // I. PLANEAR (25 %) — Recursos (10 %)
      ['1.1.1', 'Planear', 'Recursos', 0.5, 'Responsable del SG-SST designado por escrito, con la formación exigida y la licencia en SST vigente cuando aplique.'],
      ['1.1.2', 'Planear', 'Recursos', 0.5, 'Responsabilidades en SST asignadas a todos los niveles de la organización y documentadas.'],
      ['1.1.3', 'Planear', 'Recursos', 0.5, 'Recursos financieros, técnicos, humanos y de otra índole asignados para el SG-SST.'],
      ['1.1.4', 'Planear', 'Recursos', 0.5, 'Todos los trabajadores (de planta, temporales, contratistas) afiliados al Sistema General de Riesgos Laborales.'],
      ['1.1.5', 'Planear', 'Recursos', 0.5, 'Trabajadores de alto riesgo identificados y con la cotización especial de pensión cuando aplique.'],
      ['1.1.6', 'Planear', 'Recursos', 0.5, 'COPASST (o vigía) conformado, con periodo vigente, y funcionando (reuniones mensuales con acta).'],
      ['1.1.7', 'Planear', 'Recursos', 0.5, 'Integrantes del COPASST (o vigía) capacitados para cumplir sus funciones.'],
      ['1.1.8', 'Planear', 'Recursos', 0.5, 'Comité de Convivencia Laboral conformado y funcionando según la norma vigente.'],
      ['1.2.1', 'Planear', 'Recursos', 2, 'Programa de capacitación anual en promoción y prevención, según los peligros identificados, y ejecutado.'],
      ['1.2.2', 'Planear', 'Recursos', 2, 'Inducción y reinducción en SST a todos los trabajadores, con registro.'],
      ['1.2.3', 'Planear', 'Recursos', 2, 'Responsable(s) del SG-SST con el curso virtual de 50 horas (y actualización de 20 horas cuando aplique).'],
      // Gestión integral del SG-SST (15 %)
      ['2.1.1', 'Planear', 'Gestión integral', 1, 'Política de SST firmada, fechada, comunicada al COPASST y divulgada; revisada anualmente.'],
      ['2.2.1', 'Planear', 'Gestión integral', 1, 'Objetivos del SG-SST definidos, claros, medibles y coherentes con la política.'],
      ['2.3.1', 'Planear', 'Gestión integral', 1, 'Evaluación inicial del SG-SST realizada y prioridades establecidas a partir de ella.'],
      ['2.4.1', 'Planear', 'Gestión integral', 2, 'Plan anual de trabajo con metas, responsables, recursos y cronograma, firmado por el empleador y el responsable.'],
      ['2.5.1', 'Planear', 'Gestión integral', 2, 'Archivo y retención documental del SG-SST según los tiempos exigidos.'],
      ['2.6.1', 'Planear', 'Gestión integral', 1, 'Rendición de cuentas anual de quienes tienen responsabilidades en el SG-SST.'],
      ['2.7.1', 'Planear', 'Gestión integral', 2, 'Matriz legal actualizada con las normas de SST aplicables a la empresa.'],
      ['2.8.1', 'Planear', 'Gestión integral', 1, 'Mecanismos de comunicación, auto reporte y respuesta a inquietudes de los trabajadores en SST.'],
      ['2.9.1', 'Planear', 'Gestión integral', 1, 'Procedimiento para identificar y evaluar las especificaciones de SST en las compras de productos y servicios.'],
      ['2.10.1', 'Planear', 'Gestión integral', 2, 'Evaluación y selección de proveedores y contratistas con criterios de SST.'],
      ['2.11.1', 'Planear', 'Gestión integral', 1, 'Procedimiento para evaluar el impacto de los cambios internos y externos en la SST (gestión del cambio).'],
      // II. HACER (60 %) — Gestión de la salud (20 %)
      ['3.1.1', 'Hacer', 'Gestión de la salud', 1, 'Descripción sociodemográfica y diagnóstico de condiciones de salud de los trabajadores, actualizados.'],
      ['3.1.2', 'Hacer', 'Gestión de la salud', 1, 'Actividades de medicina del trabajo y de promoción y prevención según las prioridades del diagnóstico.'],
      ['3.1.3', 'Hacer', 'Gestión de la salud', 1, 'Información al médico que hace las evaluaciones ocupacionales sobre los perfiles de cargo y los peligros.'],
      ['3.1.4', 'Hacer', 'Gestión de la salud', 1, 'Evaluaciones médicas ocupacionales (ingreso, periódicas, retiro) según peligros, con la periodicidad definida.'],
      ['3.1.5', 'Hacer', 'Gestión de la salud', 1, 'Custodia de las historias clínicas por la IPS o el médico responsable.'],
      ['3.1.6', 'Hacer', 'Gestión de la salud', 1, 'Restricciones y recomendaciones médico laborales acatadas y comunicadas a quien corresponde.'],
      ['3.1.7', 'Hacer', 'Gestión de la salud', 1, 'Programas de estilos de vida y entornos saludables (alcohol, tabaco, drogas, actividad física…).'],
      ['3.1.8', 'Hacer', 'Gestión de la salud', 1, 'Agua potable, servicios sanitarios y manejo de basuras adecuados para los trabajadores.'],
      ['3.1.9', 'Hacer', 'Gestión de la salud', 1, 'Eliminación adecuada de residuos sólidos, líquidos o gaseosos.'],
      ['3.2.1', 'Hacer', 'Gestión de la salud', 2, 'Accidentes de trabajo y enfermedades laborales reportados a la ARL y EPS dentro de los 2 días hábiles (y a la Dirección Territorial cuando es grave o mortal).'],
      ['3.2.2', 'Hacer', 'Gestión de la salud', 2, 'Investigación de incidentes, accidentes y enfermedades laborales con el COPASST y acciones derivadas (Res. 1401 de 2007).'],
      ['3.2.3', 'Hacer', 'Gestión de la salud', 1, 'Registro y análisis estadístico de accidentes y enfermedades laborales, con resultados a la alta dirección.'],
      ['3.3.1', 'Hacer', 'Gestión de la salud', 1, 'Medición de la frecuencia de la accidentalidad (mensual).'],
      ['3.3.2', 'Hacer', 'Gestión de la salud', 1, 'Medición de la severidad de la accidentalidad (mensual).'],
      ['3.3.3', 'Hacer', 'Gestión de la salud', 1, 'Medición de la mortalidad por accidentes de trabajo (anual).'],
      ['3.3.4', 'Hacer', 'Gestión de la salud', 1, 'Medición de la prevalencia de la enfermedad laboral (anual).'],
      ['3.3.5', 'Hacer', 'Gestión de la salud', 1, 'Medición de la incidencia de la enfermedad laboral (anual).'],
      ['3.3.6', 'Hacer', 'Gestión de la salud', 1, 'Medición del ausentismo por causa médica (mensual).'],
      // Gestión de peligros y riesgos (30 %)
      ['4.1.1', 'Hacer', 'Peligros y riesgos', 4, 'Metodología para identificar peligros, evaluar y valorar riesgos, aplicada a todos los procesos, actividades rutinarias y no rutinarias.'],
      ['4.1.2', 'Hacer', 'Peligros y riesgos', 4, 'Identificación de peligros con participación de los trabajadores de todos los niveles, actualizada al menos una vez al año.'],
      ['4.1.3', 'Hacer', 'Peligros y riesgos', 3, 'Identificación y priorización de sustancias carcinógenas o con toxicidad aguda, con medidas de control.'],
      ['4.1.4', 'Hacer', 'Peligros y riesgos', 4, 'Mediciones ambientales de los riesgos prioritarios (químicos, físicos, biológicos) cuando se requieren.'],
      ['4.2.1', 'Hacer', 'Peligros y riesgos', 2.5, 'Medidas de prevención y control implementadas según la jerarquía (eliminación, sustitución, ingeniería, administrativas, EPP).'],
      ['4.2.2', 'Hacer', 'Peligros y riesgos', 2.5, 'Verificación de la aplicación de las medidas de prevención y control por parte de los trabajadores.'],
      ['4.2.3', 'Hacer', 'Peligros y riesgos', 2.5, 'Procedimientos, instructivos, fichas y protocolos de seguridad elaborados y divulgados.'],
      ['4.2.4', 'Hacer', 'Peligros y riesgos', 2.5, 'Inspecciones a instalaciones, maquinaria y equipos realizadas con participación del COPASST.'],
      ['4.2.5', 'Hacer', 'Peligros y riesgos', 2.5, 'Mantenimiento periódico de instalaciones, equipos, máquinas y herramientas, con registro.'],
      ['4.2.6', 'Hacer', 'Peligros y riesgos', 2.5, 'Entrega de EPP según los peligros, con registro, capacitación en su uso y reposición.'],
      // Gestión de amenazas (10 %)
      ['5.1.1', 'Hacer', 'Amenazas', 5, 'Plan de prevención, preparación y respuesta ante emergencias, con análisis de amenazas y vulnerabilidad, divulgado y con simulacro anual.'],
      ['5.1.2', 'Hacer', 'Amenazas', 5, 'Brigada de prevención y atención de emergencias conformada, capacitada y dotada.'],
      // III. VERIFICAR (5 %)
      ['6.1.1', 'Verificar', 'Verificación', 1.25, 'Indicadores de estructura, proceso y resultado definidos y medidos.'],
      ['6.1.2', 'Verificar', 'Verificación', 1.25, 'Auditoría del SG-SST realizada por lo menos una vez al año.'],
      ['6.1.3', 'Verificar', 'Verificación', 1.25, 'Revisión anual del SG-SST por la alta dirección, con resultados comunicados al COPASST y al responsable.'],
      ['6.1.4', 'Verificar', 'Verificación', 1.25, 'Auditoría planificada con la participación del COPASST.'],
      // IV. ACTUAR (10 %)
      ['7.1.1', 'Actuar', 'Mejoramiento', 2.5, 'Acciones preventivas y correctivas definidas a partir de los resultados de la supervisión, inspecciones e indicadores.'],
      ['7.1.2', 'Actuar', 'Mejoramiento', 2.5, 'Acciones de mejora a partir de la revisión de la alta dirección.'],
      ['7.1.3', 'Actuar', 'Mejoramiento', 2.5, 'Acciones de mejora a partir de las investigaciones de accidentes de trabajo y enfermedades laborales.'],
      ['7.1.4', 'Actuar', 'Mejoramiento', 2.5, 'Plan de mejoramiento con las medidas y acciones correctivas que pidan las autoridades y la ARL.']
    ]
  },
  DEC1072: {
    nombre: 'Auditoría interna del SG-SST (Decreto 1072 de 2015)',
    corto: 'Auditoría interna Dec. 1072',
    tipo: 'hallazgos',
    criterios: 'Decreto 1072 de 2015, arts. 2.2.4.6.29 a 2.2.4.6.31; Resolución 0312 de 2019; procedimientos internos del SG-SST.',
    origenAccion: 'Auditoría',
    items: [
      ['A1', 'Política', 'Art. 2.2.4.6.30 num. 1', 0, '¿Se cumple la política de SST? ¿Está firmada, divulgada, disponible y revisada en el último año?'],
      ['A2', 'Indicadores', 'Art. 2.2.4.6.30 num. 2', 0, '¿Se miden los indicadores de estructura, proceso y resultado y se analizan sus resultados frente a las metas?'],
      ['A3', 'Participación', 'Art. 2.2.4.6.30 num. 3', 0, '¿Participan los trabajadores (COPASST, reportes, identificación de peligros, investigaciones)?'],
      ['A4', 'Responsabilidades', 'Art. 2.2.4.6.30 num. 4', 0, '¿Se cumplen las responsabilidades asignadas y se hizo la rendición de cuentas?'],
      ['A5', 'Comunicación', 'Art. 2.2.4.6.30 num. 5', 0, '¿Funciona el mecanismo para comunicar el SG-SST a los trabajadores y recibir sus inquietudes?'],
      ['A6', 'Planificación', 'Art. 2.2.4.6.30 num. 6', 0, '¿El plan anual de trabajo se planificó, se ejecuta y tiene avance medido?'],
      ['A7', 'Gestión del cambio', 'Art. 2.2.4.6.30 num. 7', 0, '¿Se evalúa el impacto en la SST de los cambios (procesos, instalaciones, personal, normas)?'],
      ['A8', 'Adquisiciones', 'Art. 2.2.4.6.30 num. 8', 0, '¿Las compras de equipos, productos y servicios consideran los requisitos de SST?'],
      ['A9', 'Contratistas', 'Art. 2.2.4.6.30 num. 9', 0, '¿El SG-SST se aplica a proveedores y contratistas (selección, afiliaciones, inducción, supervisión)?'],
      ['A10', 'Supervisión y medición', 'Art. 2.2.4.6.30 num. 10', 0, '¿Se hacen inspecciones, supervisión y medición de resultados, y se registran?'],
      ['A11', 'Investigaciones', 'Art. 2.2.4.6.30 num. 11', 0, '¿Se investigan los incidentes, accidentes y enfermedades laborales y las acciones mejoran la SST?'],
      ['A12', 'Auditoría', 'Art. 2.2.4.6.30 num. 12', 0, '¿El proceso de auditoría se planificó con el COPASST y el auditor es independiente del proceso auditado?'],
      ['A13', 'Revisión por la dirección', 'Art. 2.2.4.6.30 num. 13', 0, '¿La alta dirección revisó el SG-SST en el último año y se definieron acciones?'],
      ['A14', 'Peligros y riesgos', 'Art. 2.2.4.6.15', 0, '¿La matriz de peligros está actualizada y los controles definidos están implementados en campo?'],
      ['A15', 'Emergencias', 'Art. 2.2.4.6.25', 0, '¿El plan de emergencias está actualizado, divulgado y se hizo simulacro en el último año?'],
      ['A16', 'Acciones', 'Art. 2.2.4.6.33', 0, '¿Las acciones correctivas y preventivas se cierran a tiempo y se verifica su eficacia?']
    ]
  },
  ISO45001: {
    nombre: 'Auditoría ISO 45001:2018',
    corto: 'ISO 45001',
    tipo: 'hallazgos',
    criterios: 'NTC-ISO 45001:2018; requisitos legales aplicables; documentación del sistema.',
    origenAccion: 'Auditoría',
    items: [
      ['4.1', 'Contexto', '4.1', 0, '¿Se determinaron las cuestiones internas y externas que afectan al sistema de gestión de SST?'],
      ['4.2', 'Contexto', '4.2', 0, '¿Se identificaron los trabajadores y demás partes interesadas, sus necesidades y cuáles son requisitos legales?'],
      ['4.3', 'Contexto', '4.3', 0, '¿El alcance del sistema está definido, documentado y disponible?'],
      ['4.4', 'Contexto', '4.4', 0, '¿Los procesos del sistema y sus interacciones están establecidos y se mantienen?'],
      ['5.1', 'Liderazgo', '5.1', 0, '¿La alta dirección demuestra liderazgo: asume la responsabilidad, asigna recursos, protege a quien reporta?'],
      ['5.2', 'Liderazgo', '5.2', 0, '¿La política incluye los compromisos exigidos, está documentada, comunicada y disponible?'],
      ['5.3', 'Liderazgo', '5.3', 0, '¿Los roles, responsabilidades y autoridades están asignados y comunicados?'],
      ['5.4', 'Liderazgo', '5.4', 0, '¿Hay consulta y participación de los trabajadores no directivos (peligros, controles, investigaciones, cambios)?'],
      ['6.1.1', 'Planificación', '6.1.1', 0, '¿Se determinaron los riesgos y oportunidades del sistema y cómo abordarlos?'],
      ['6.1.2', 'Planificación', '6.1.2', 0, '¿La identificación de peligros es continua y proactiva, incluida la de situaciones de emergencia y cambios?'],
      ['6.1.3', 'Planificación', '6.1.3', 0, '¿Se tienen identificados y al día los requisitos legales y otros requisitos?'],
      ['6.1.4', 'Planificación', '6.1.4', 0, '¿Se planificaron acciones para riesgos, oportunidades y requisitos legales, y se evalúa su eficacia?'],
      ['6.2', 'Planificación', '6.2', 0, '¿Los objetivos de SST son medibles, tienen plan (qué, quién, cuándo) y se hace seguimiento?'],
      ['7.1', 'Apoyo', '7.1', 0, '¿Se proporcionan los recursos necesarios para el sistema?'],
      ['7.2', 'Apoyo', '7.2', 0, '¿Se determinó y asegura la competencia de los trabajadores (formación, experiencia) con evidencia?'],
      ['7.3', 'Apoyo', '7.3', 0, '¿Los trabajadores conocen la política, los peligros de su labor, su aporte y que pueden retirarse ante un peligro inminente?'],
      ['7.4', 'Apoyo', '7.4', 0, '¿Se planificó la comunicación interna y externa (qué, cuándo, a quién, cómo)?'],
      ['7.5', 'Apoyo', '7.5', 0, '¿La información documentada se controla (aprobación, versiones, disponibilidad, conservación)?'],
      ['8.1.1', 'Operación', '8.1.1', 0, '¿Los procesos operacionales tienen criterios y controles de SST y se aplican?'],
      ['8.1.2', 'Operación', '8.1.2', 0, '¿Se aplica la jerarquía de controles para eliminar peligros y reducir riesgos?'],
      ['8.1.3', 'Operación', '8.1.3', 0, '¿Se gestionan los cambios planificados, temporales y permanentes?'],
      ['8.1.4', 'Operación', '8.1.4', 0, '¿Se controlan las compras, los contratistas y los procesos contratados externamente?'],
      ['8.2', 'Operación', '8.2', 0, '¿Hay preparación y respuesta ante emergencias, con simulacros y evaluación?'],
      ['9.1.1', 'Evaluación', '9.1.1', 0, '¿Se definió qué se mide, cómo y cuándo, y se analizan los resultados del desempeño en SST?'],
      ['9.1.2', 'Evaluación', '9.1.2', 0, '¿Se evalúa periódicamente el cumplimiento de los requisitos legales?'],
      ['9.2', 'Evaluación', '9.2', 0, '¿Hay programa de auditoría interna, auditores objetivos e informes a la dirección?'],
      ['9.3', 'Evaluación', '9.3', 0, '¿La revisión por la dirección trató las entradas exigidas y dejó decisiones registradas?'],
      ['10.2', 'Mejora', '10.2', 0, '¿Los incidentes y no conformidades se investigan, se corrigen las causas y se verifica la eficacia?'],
      ['10.3', 'Mejora', '10.3', 0, '¿Hay evidencia de mejora continua del desempeño y de la cultura de SST?']
    ]
  },
  CONTRATISTA: {
    nombre: 'Auditoría de cliente o de contratista (SST)',
    corto: 'Cliente / contratista',
    tipo: 'hallazgos',
    criterios: 'Requisitos de SST del cliente o del contrato; Decreto 1072 de 2015; Resolución 0312 de 2019.',
    origenAccion: 'Auditoría',
    items: [
      ['C1', 'Documentos', '', 0, '¿El personal en la obra tiene afiliación vigente a EPS, AFP y ARL, y el pago de seguridad social del mes?'],
      ['C2', 'Documentos', '', 0, '¿Se cuenta con la inducción del cliente y la inducción propia en SST de todo el personal?'],
      ['C3', 'Documentos', '', 0, '¿Los conceptos médicos de aptitud están vigentes y las restricciones se respetan?'],
      ['C4', 'Competencia', '', 0, '¿Quienes hacen tareas de alto riesgo tienen el certificado vigente (alturas, confinados, izajes, eléctrico, caliente)?'],
      ['C5', 'Planeación', '', 0, '¿Cada tarea tiene su ATS o análisis de riesgos firmado por quienes la ejecutan?'],
      ['C6', 'Permisos', '', 0, '¿Los trabajos de alto riesgo tienen permiso de trabajo diligenciado, firmado y vigente en el sitio?'],
      ['C7', 'Permisos', '', 0, '¿Se aplica el bloqueo y etiquetado de energías cuando corresponde?'],
      ['C8', 'EPP', '', 0, '¿El EPP es el adecuado, está en buen estado, se usa correctamente y hay registro de entrega?'],
      ['C9', 'Equipos', '', 0, '¿Herramientas, equipos de alturas, eslingas y extintores están inspeccionados y en buen estado?'],
      ['C10', 'Sitio', '', 0, '¿El área está demarcada, ordenada y limpia, con señalización de los riesgos?'],
      ['C11', 'Sustancias', '', 0, '¿Las sustancias químicas están rotuladas, con hoja de seguridad disponible y almacenadas correctamente?'],
      ['C12', 'Emergencias', '', 0, '¿El personal conoce el plan de emergencias del sitio, las rutas y el punto de encuentro; hay botiquín y brigadista?'],
      ['C13', 'Supervisión', '', 0, '¿Hay supervisor o coordinador de SST en el sitio durante los trabajos de alto riesgo?'],
      ['C14', 'Reportes', '', 0, '¿Se reportan y investigan los incidentes y accidentes, y se informa al cliente?'],
      ['C15', 'Ambiental', '', 0, '¿Los residuos se separan y disponen según el plan del cliente?']
    ]
  },
  ISO14001: {
    nombre: 'Auditoría ISO 14001:2015 (ambiental)',
    corto: 'ISO 14001',
    tipo: 'hallazgos',
    criterios: 'NTC-ISO 14001:2015; requisitos legales ambientales aplicables; documentación del sistema.',
    origenAccion: 'Auditoría',
    items: [
      ['4.1', 'Contexto', '4.1', 0, '¿Se determinaron las cuestiones internas y externas, incluidas las condiciones ambientales que afectan o son afectadas por la organización?'],
      ['4.2', 'Contexto', '4.2', 0, '¿Se identificaron las partes interesadas, sus necesidades y cuáles se vuelven requisitos legales u otros requisitos?'],
      ['4.3', 'Contexto', '4.3', 0, '¿El alcance del sistema de gestión ambiental está definido y documentado?'],
      ['5.1', 'Liderazgo', '5.1', 0, '¿La alta dirección demuestra liderazgo y compromiso con el sistema de gestión ambiental?'],
      ['5.2', 'Liderazgo', '5.2', 0, '¿La política ambiental incluye la protección del medio ambiente, el cumplimiento de requisitos y la mejora continua, y se comunica?'],
      ['5.3', 'Liderazgo', '5.3', 0, '¿Los roles, responsabilidades y autoridades ambientales están asignados y comunicados?'],
      ['6.1.1', 'Planificación', '6.1.1', 0, '¿Se determinaron los riesgos y oportunidades del sistema de gestión ambiental?'],
      ['6.1.2', 'Planificación', '6.1.2', 0, '¿Se identificaron los aspectos ambientales y sus impactos, con perspectiva de ciclo de vida, y se determinaron los significativos?'],
      ['6.1.3', 'Planificación', '6.1.3', 0, '¿Se identificaron y se tienen disponibles los requisitos legales y otros requisitos ambientales?'],
      ['6.1.4', 'Planificación', '6.1.4', 0, '¿Se planificaron acciones para los aspectos significativos, los requisitos y los riesgos, y se evalúa su eficacia?'],
      ['6.2', 'Planificación', '6.2', 0, '¿Hay objetivos ambientales medibles, con responsables, recursos, plazos e indicadores?'],
      ['7.2', 'Apoyo', '7.2', 0, '¿Se asegura la competencia de quienes realizan trabajos que afectan el desempeño ambiental?'],
      ['7.3', 'Apoyo', '7.3', 0, '¿El personal conoce la política, los aspectos significativos de su trabajo y las consecuencias de no cumplir?'],
      ['7.4', 'Apoyo', '7.4', 0, '¿Están definidas la comunicación interna y externa sobre el sistema de gestión ambiental?'],
      ['7.5', 'Apoyo', '7.5', 0, '¿La información documentada exigida existe, está controlada y se conserva?'],
      ['8.1', 'Operación', '8.1', 0, '¿Hay controles operacionales para los aspectos significativos, incluidos contratistas y proveedores (ciclo de vida)?'],
      ['8.2', 'Operación', '8.2', 0, '¿Se preparó y se pone a prueba la respuesta ante emergencias ambientales (derrames, incendios)?'],
      ['9.1.1', 'Evaluación', '9.1.1', 0, '¿Se hace seguimiento y medición del desempeño ambiental (residuos, consumos, vertimientos, emisiones) con equipos calibrados?'],
      ['9.1.2', 'Evaluación', '9.1.2', 0, '¿Se evalúa periódicamente el cumplimiento de los requisitos legales y otros requisitos?'],
      ['9.2', 'Evaluación', '9.2', 0, '¿Hay programa de auditoría interna con auditores objetivos?'],
      ['9.3', 'Evaluación', '9.3', 0, '¿La revisión por la dirección trató las entradas exigidas y dejó decisiones?'],
      ['10.2', 'Mejora', '10.2', 0, '¿Las no conformidades se corrigen, se analizan sus causas y se verifica la eficacia de las acciones?'],
      ['10.3', 'Mejora', '10.3', 0, '¿Hay evidencia de mejora continua del desempeño ambiental?']
    ]
  },
  ISO9001: {
    nombre: 'Auditoría ISO 9001:2015 (calidad)',
    corto: 'ISO 9001',
    tipo: 'hallazgos',
    criterios: 'NTC-ISO 9001:2015; requisitos del cliente y legales del producto o servicio; documentación del sistema.',
    origenAccion: 'Auditoría',
    items: [
      ['4.1', 'Contexto', '4.1', 0, '¿Se determinaron las cuestiones internas y externas pertinentes (DOFA) y se les hace seguimiento?'],
      ['4.2', 'Contexto', '4.2', 0, '¿Se identificaron las partes interesadas pertinentes y sus requisitos, y se revisan?'],
      ['4.3', 'Contexto', '4.3', 0, '¿El alcance del sistema de gestión de la calidad está definido, documentado y justifica los requisitos que no aplican?'],
      ['4.4', 'Contexto', '4.4', 0, '¿Los procesos están determinados, con sus entradas, salidas, secuencia, responsables, recursos e indicadores?'],
      ['5.1', 'Liderazgo', '5.1', 0, '¿La alta dirección demuestra liderazgo y compromiso, incluido el enfoque al cliente?'],
      ['5.2', 'Liderazgo', '5.2', 0, '¿La política de calidad es apropiada, incluye el compromiso de cumplir requisitos y de mejora continua, y se comunica?'],
      ['5.3', 'Liderazgo', '5.3', 0, '¿Los roles, responsabilidades y autoridades están asignados y comunicados?'],
      ['6.1', 'Planificación', '6.1', 0, '¿Se determinaron los riesgos y oportunidades, con acciones para abordarlos y evaluación de su eficacia?'],
      ['6.2', 'Planificación', '6.2', 0, '¿Hay objetivos de calidad medibles, coherentes con la política, con plan para lograrlos y seguimiento?'],
      ['6.3', 'Planificación', '6.3', 0, '¿Los cambios en el sistema se planifican de forma controlada?'],
      ['7.1', 'Apoyo', '7.1', 0, '¿Se proporcionan los recursos (personas, infraestructura, ambiente, equipos de medición calibrados, conocimiento)?'],
      ['7.2', 'Apoyo', '7.2', 0, '¿Se determinó y asegura la competencia del personal, con evidencia (formación, evaluación de eficacia)?'],
      ['7.3', 'Apoyo', '7.3', 0, '¿El personal conoce la política, los objetivos, su contribución y las consecuencias de no cumplir?'],
      ['7.4', 'Apoyo', '7.4', 0, '¿Están definidas las comunicaciones internas y externas?'],
      ['7.5', 'Apoyo', '7.5', 0, '¿La información documentada exigida existe, está controlada (aprobación, versión, distribución) y se conserva?'],
      ['8.1', 'Operación', '8.1', 0, '¿Se planifican y controlan los procesos operativos, con criterios y registros?'],
      ['8.2', 'Operación', '8.2', 0, '¿Se determinan y revisan los requisitos del cliente antes de comprometerse, y se gestiona la comunicación con él?'],
      ['8.3', 'Operación', '8.3', 0, 'Diseño y desarrollo (si aplica): ¿se planifica, verifica y valida?'],
      ['8.4', 'Operación', '8.4', 0, '¿Se seleccionan, evalúan y reevalúan los proveedores externos con criterios definidos, y se controla lo que suministran?'],
      ['8.5', 'Operación', '8.5', 0, '¿La producción o prestación del servicio se hace en condiciones controladas, con identificación, trazabilidad y preservación?'],
      ['8.6', 'Operación', '8.6', 0, '¿Se verifica que el producto o servicio cumple los requisitos antes de entregarlo, con registros de liberación?'],
      ['8.7', 'Operación', '8.7', 0, '¿Las salidas no conformes se identifican y controlan (corrección, segregación, concesión), con registro?'],
      ['9.1.2', 'Evaluación', '9.1.2', 0, '¿Se hace seguimiento a la percepción del cliente (satisfacción, quejas y reclamos)?'],
      ['9.1.3', 'Evaluación', '9.1.3', 0, '¿Se analizan los datos (conformidad, satisfacción, desempeño de procesos y proveedores, eficacia de acciones)?'],
      ['9.2', 'Evaluación', '9.2', 0, '¿Hay programa de auditoría interna con auditores objetivos e imparciales, y se toman acciones?'],
      ['9.3', 'Evaluación', '9.3', 0, '¿La revisión por la dirección trató las entradas exigidas y dejó decisiones y recursos?'],
      ['10.2', 'Mejora', '10.2', 0, '¿Las no conformidades se corrigen, se analizan sus causas, se toman acciones y se verifica su eficacia?'],
      ['10.3', 'Mejora', '10.3', 0, '¿Hay evidencia de mejora continua del sistema de gestión de la calidad?']
    ]
  },
  RUC: {
    nombre: 'RUC · Registro Uniforme de Contratistas (pega la guía vigente)',
    corto: 'RUC',
    tipo: 'hallazgos',
    criterios: 'Guía RUC del Consejo Colombiano de Seguridad (versión vigente); requisitos del cliente.',
    origenAccion: 'Auditoría',
    pegar: true,
    items: []
  },
  LIBRE: {
    nombre: 'Otra auditoría (lista propia)',
    corto: 'Otra',
    tipo: 'hallazgos',
    criterios: '',
    origenAccion: 'Auditoría',
    items: []
  }
};
const TIPOS_HALLAZGO = { ncMayor: 'No conformidad mayor', ncMenor: 'No conformidad menor', obs: 'Observación', om: 'Oportunidad de mejora' };
/** Valoración de la autoevaluación (Res. 0312 de 2019, art. 28). */
function valoracion0312(p) {
  if (p < 60) return { n: 'CRÍTICO', c: 'mal', que: 'Plan de mejoramiento de inmediato; enviar a la ARL el reporte de avances en máximo 3 meses. Seguimiento anual y visita del Ministerio del Trabajo.' };
  if (p <= 85) return { n: 'MODERADAMENTE ACEPTABLE', c: 'pronto', que: 'Plan de mejoramiento; enviar a la ARL el reporte de avances en máximo 6 meses. Plan de visita del Ministerio del Trabajo.' };
  return { n: 'ACEPTABLE', c: 'ok', que: 'Mantener la calificación e incluir las mejoras detectadas en el plan anual de trabajo.' };
}


/* ── Estándares según el tamaño y el riesgo (Res. 0312 de 2019) ──
   · Unidad de producción agropecuaria con 10 o menos trabajadores permanentes y riesgo
     I, II o III: 3 estándares (art. 7). (v113)
   · Hasta 10 trabajadores y riesgo I, II o III: 7 estándares (art. 3).
   · De 11 a 50 trabajadores y riesgo I, II o III: 21 estándares (art. 9).
   · Más de 50 trabajadores, o riesgo IV o V (cualquier tamaño): los 60 (art. 16).
   Cada estándar de los grupos de 7 y 21 se califica contra el numeral equivalente de
   los 60 (así salen las mismas pistas del portal). En estos grupos el porcentaje es el
   de estándares que se cumplen, todos con el mismo peso: verifícalo con el formato de
   tu ARL o del Ministerio del Trabajo. */
function grupo0312(trabajadores, riesgo, agropecuaria) {
  const n = Number(trabajadores) || 0, r = String(riesgo || '').toUpperCase().replace(/[^IV]/g, '');
  if (r === 'IV' || r === 'V' || n > 50) return 60;
  if (n >= 11) return 21;
  if (n >= 1 && (agropecuaria === true || agropecuaria === 'Sí' || agropecuaria === 'si' || agropecuaria === 1)) return 3;
  return n >= 1 ? 7 : 60;
}
/** Artículo de la Res. 0312 que fija cada grupo. */
const ARTICULO_0312 = { 3: 'art. 7', 7: 'art. 3', 21: 'art. 9', 60: 'art. 16' };
/** A quién aplica cada grupo (para mostrarlo). */
const QUIEN_0312 = { 3: 'unidad de producción agropecuaria con 10 o menos trabajadores permanentes, riesgo I, II o III',
  7: 'hasta 10 trabajadores, riesgo I, II o III', 21: 'de 11 a 50 trabajadores, riesgo I, II o III', 60: 'más de 50 trabajadores, o riesgo IV o V con cualquier número' };
/* Categorías de los estándares (Res. 0312, art. 27) con su peso en la tabla de los 60. */
const CATEGORIAS_0312 = [
  ['Planear', 'Recursos', 'Recursos', 10], ['Planear', 'Gestión integral', 'Gestión integral del SG-SST', 15],
  ['Hacer', 'Gestión de la salud', 'Gestión de la salud', 20], ['Hacer', 'Peligros y riesgos', 'Gestión de peligros y riesgos', 30], ['Hacer', 'Amenazas', 'Gestión de amenazas', 10],
  ['Verificar', 'Verificación', 'Verificación del SG-SST', 5], ['Actuar', 'Mejoramiento', 'Mejoramiento', 10]
];
/** Nombre de cada uno de los 60 estándares, como en la tabla del art. 16 de la Res. 0312 (v113). */
const NOMBRE_0312 = {
  '1.1.1': 'Asignación de una persona que diseñe e implemente el Sistema de Gestión de SST',
  '1.1.2': 'Asignación de responsabilidades en SST',
  '1.1.3': 'Asignación de recursos para el Sistema de Gestión en SST',
  '1.1.4': 'Afiliación al Sistema de Seguridad Social Integral',
  '1.1.5': 'Identificación de trabajadores que se dediquen en forma permanente a actividades de alto riesgo y cotización de pensión especial',
  '1.1.6': 'Conformación y funcionamiento del COPASST',
  '1.1.7': 'Capacitación de los integrantes del COPASST',
  '1.1.8': 'Conformación y funcionamiento del Comité de Convivencia Laboral',
  '1.2.1': 'Programa de capacitación anual',
  '1.2.2': 'Inducción y reinducción en SST',
  '1.2.3': 'Curso virtual de capacitación de cincuenta (50) horas en SST',
  '2.1.1': 'Política de Seguridad y Salud en el Trabajo',
  '2.2.1': 'Objetivos de SST',
  '2.3.1': 'Evaluación inicial del Sistema de Gestión',
  '2.4.1': 'Plan Anual de Trabajo',
  '2.5.1': 'Archivo y retención documental del Sistema de Gestión de SST',
  '2.6.1': 'Rendición de cuentas',
  '2.7.1': 'Matriz legal',
  '2.8.1': 'Mecanismos de comunicación',
  '2.9.1': 'Identificación y evaluación para la adquisición de bienes y servicios',
  '2.10.1': 'Evaluación y selección de proveedores y contratistas',
  '2.11.1': 'Gestión del cambio',
  '3.1.1': 'Descripción sociodemográfica y diagnóstico de condiciones de salud de los trabajadores',
  '3.1.2': 'Actividades de medicina del trabajo y de prevención y promoción de la salud',
  '3.1.3': 'Perfiles de cargos',
  '3.1.4': 'Evaluaciones médicas ocupacionales',
  '3.1.5': 'Custodia de las historias clínicas',
  '3.1.6': 'Restricciones y recomendaciones médico laborales',
  '3.1.7': 'Estilos de vida y entorno saludable',
  '3.1.8': 'Servicios de higiene',
  '3.1.9': 'Manejo de residuos',
  '3.2.1': 'Reporte de accidentes de trabajo y enfermedades laborales',
  '3.2.2': 'Investigación de incidentes, accidentes de trabajo y las enfermedades cuando sean diagnosticadas como laborales',
  '3.2.3': 'Registro y análisis estadístico de accidentes de trabajo y enfermedades laborales',
  '3.3.1': 'Frecuencia de accidentalidad',
  '3.3.2': 'Severidad de accidentalidad',
  '3.3.3': 'Proporción de accidentes de trabajo mortales',
  '3.3.4': 'Prevalencia de la enfermedad laboral',
  '3.3.5': 'Incidencia de la enfermedad laboral',
  '3.3.6': 'Ausentismo por causa médica',
  '4.1.1': 'Metodología para identificación de peligros, evaluación y valoración de riesgos',
  '4.1.2': 'Identificación de peligros y evaluación y valoración de riesgos con participación de todos los niveles de la empresa',
  '4.1.3': 'Identificación de sustancias catalogadas como carcinógenas o con toxicidad aguda',
  '4.1.4': 'Mediciones ambientales',
  '4.2.1': 'Medidas de prevención y control frente a peligros/riesgos identificados',
  '4.2.2': 'Aplicación de medidas de prevención y control por parte de los trabajadores',
  '4.2.3': 'Procedimientos e instructivos internos de seguridad y salud en el trabajo',
  '4.2.4': 'Inspecciones a instalaciones, maquinaria o equipos',
  '4.2.5': 'Mantenimiento periódico de las instalaciones, equipos, máquinas y herramientas',
  '4.2.6': 'Entrega de los elementos de protección personal (EPP) y capacitación en uso adecuado',
  '5.1.1': 'Plan de prevención, preparación y respuesta ante emergencias',
  '5.1.2': 'Brigada de prevención, preparación y respuesta ante emergencias',
  '6.1.1': 'Definición de indicadores del Sistema de Gestión de SST',
  '6.1.2': 'Auditoría anual',
  '6.1.3': 'Revisión por la alta dirección. Alcance de la auditoría del Sistema de Gestión',
  '6.1.4': 'Planificación de la auditoría con el COPASST',
  '7.1.1': 'Acciones preventivas y/o correctivas',
  '7.1.2': 'Acciones de mejora conforme a revisión de la alta dirección',
  '7.1.3': 'Acciones de mejora con base en investigaciones de accidentes de trabajo y enfermedades laborales',
  '7.1.4': 'Plan de mejoramiento'
};
/** Los estándares del grupo (3, 7, 21 o 60) clasificados por ciclo PHVA y categoría.
 *  [{ ciclo, n, categorias: [{ categoria, nombre, n, peso, items: [{ id, nombre, texto, valor }] }] }] */
function clasificar0312(grupo) {
  const g = [3, 7, 21].indexOf(Number(grupo)) !== -1 ? Number(grupo) : 60;
  const P = PLANTILLAS_AUDITORIA[g === 60 ? 'RES0312' : 'RES0312_' + g];
  const ciclos = [];
  CATEGORIAS_0312.forEach(function (c) {
    const items = P.items.filter(function (i) { return i[1] === c[0] && i[2] === c[1]; }).map(function (i) {
      const corto = g === 60 ? (NOMBRE_0312[i[0]] || String(i[4])) : String(i[4]).split(' — ')[0];
      return { id: i[0], nombre: corto, texto: i[4], valor: i[3] };
    });
    if (!items.length) return;
    let ci = ciclos.filter(function (x) { return x.ciclo === c[0]; })[0];
    if (!ci) { ci = { ciclo: c[0], n: 0, categorias: [] }; ciclos.push(ci); }
    ci.categorias.push({ categoria: c[1], nombre: c[2], n: items.length, peso: Math.round(items.reduce(function (s, x) { return s + x.valor; }, 0) * 100) / 100, items: items });
    ci.n += items.length;
  });
  return ciclos;
}
const SUBGRUPOS_0312 = {
  // v113 · art. 7: unidades de producción agropecuaria. El 3.º no tiene numeral equivalente en los 60 (va con su propio código).
  3: [['4.1.1', 'Identificar los peligros, evaluar y valorar los riesgos y establecer los controles'], ['4.2.1', 'Actividades para prevenir accidentes de trabajo y enfermedades laborales'],
    ['UPA.3', 'Proteger la seguridad y salud de todas las personas que trabajan en la unidad', 'Hacer', 'Peligros y riesgos', 'Proteger la seguridad y salud de todas las personas que desarrollan actividades productivas en la unidad de producción agropecuaria (art. 7, numeral 3).']],
  7: [['1.1.1', 'Asignación de persona que diseña el Sistema de Gestión de SST'], ['1.1.4', 'Afiliación al Sistema de Seguridad Social Integral'],
    ['1.2.1', 'Capacitación en SST'], ['2.4.1', 'Plan anual de trabajo'], ['3.1.4', 'Evaluaciones médicas ocupacionales'],
    ['4.1.1', 'Identificación de peligros; evaluación y valoración de riesgos'], ['4.2.1', 'Medidas de prevención y control frente a peligros y riesgos identificados']],
  21: [['1.1.1', 'Asignación de persona que diseña el Sistema de Gestión de SST'], ['1.1.3', 'Asignación de recursos para el SG-SST'],
    ['1.1.4', 'Afiliación al Sistema de Seguridad Social Integral'], ['1.1.6', 'Conformación y funcionamiento del COPASST (o vigía)'],
    ['1.1.8', 'Conformación y funcionamiento del Comité de Convivencia Laboral'], ['1.2.1', 'Programa de capacitación anual'],
    ['2.1.1', 'Política de Seguridad y Salud en el Trabajo'], ['2.4.1', 'Plan anual de trabajo'], ['2.5.1', 'Archivo o retención documental del SG-SST'],
    ['3.1.1', 'Descripción sociodemográfica y diagnóstico de condiciones de salud'], ['3.1.2', 'Actividades de medicina del trabajo y de prevención y promoción de la salud'],
    ['3.1.4', 'Evaluaciones médicas ocupacionales'], ['3.1.6', 'Restricciones y recomendaciones médico-laborales'], ['3.2.1', 'Reporte de los accidentes de trabajo y las enfermedades laborales'],
    ['3.2.2', 'Investigación de incidentes, accidentes de trabajo y enfermedades laborales'], ['4.1.1', 'Identificación de peligros; evaluación y valoración de riesgos'],
    ['4.2.5', 'Mantenimiento periódico de instalaciones, equipos, máquinas y herramientas'], ['4.2.6', 'Entrega de elementos de protección personal y capacitación en su uso'],
    ['5.1.1', 'Plan de prevención, preparación y respuesta ante emergencias'], ['5.1.2', 'Brigada de prevención, preparación y respuesta ante emergencias'],
    ['6.1.3', 'Revisión por la alta dirección y alcance de la auditoría del SG-SST']]
};
(function () {
  const base = {}; PLANTILLAS_AUDITORIA.RES0312.items.forEach(function (i) { base[i[0]] = i; });
  [3, 7, 21].forEach(function (n) {
    const art = ARTICULO_0312[n];
    PLANTILLAS_AUDITORIA['RES0312_' + n] = {
      nombre: 'Autoevaluación de ' + n + ' estándares mínimos (Res. 0312, ' + art + ')',
      corto: n + ' estándares mínimos Res. 0312',
      tipo: 'puntaje',
      grupo0312: n,
      criterios: 'Resolución 0312 de 2019, ' + art + ' (' + QUIEN_0312[n] + '); Decreto 1072 de 2015.',
      origenAccion: 'Autoevaluación Res. 0312',
      // [id (numeral equivalente de los 60), ciclo, grupo, valor, texto]
      items: SUBGRUPOS_0312[n].map(function (x) { const b = base[x[0]]; return b ? [x[0], b[1], b[2], 100 / n, x[1] + ' — ' + b[4]] : [x[0], x[2], x[3], 100 / n, x[1] + ' — ' + x[4]]; })
    };
  });
  PLANTILLAS_AUDITORIA.RES0312.grupo0312 = 60;
})();
