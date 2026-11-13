/* ============================================================
   empresa.js — EMPRESA DEMO (ficticia) para mostrar el Portal SSTA
   ------------------------------------------------------------
   demo: true → el portal no usa Google: un servidor simulado corre en el
   navegador (demo/demo.js) con datos de ejemplo. Nada sale del equipo.
   Solo trae los DATOS; herramientas/armar-demo.js le agrega el motor
   de empresa.js y arma el sitio de la demo.
   Para una empresa real, usa el empresa.js normal (o el configurador).
   ============================================================ */

const EMPRESA = {
  nombre: 'Montajes Andinos S.A.S. (empresa demo)',
  nombreCorto: 'MONTAJES ANDINOS',
  nit: '900.000.000-0',
  subtitulo: 'Sistema de Gestión SST',
  logo: 'demo/logo-demo.svg',
  colorMarca: '#e0912a',

  formatos: {
    'SSTA-F-005': { codigo: 'MA-SST-F-12', titulo: 'Control de asistencia a capacitación, eventos y reuniones', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-006': { codigo: 'MA-SST-F-20', titulo: 'Inspección de EPP', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-007': { codigo: 'MA-SST-F-03', titulo: 'Análisis de Trabajo Seguro (ATS)', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-116': { codigo: 'MA-SST-F-31', titulo: 'Permiso de trabajo en alturas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-117': { codigo: 'MA-SST-F-32', titulo: 'Permiso de espacios confinados', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-118': { codigo: 'MA-SST-F-33', titulo: 'Permiso de izajes de cargas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-119': { codigo: 'MA-SST-F-30', titulo: 'Permiso de trabajo en caliente', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-147': { codigo: 'MA-SST-F-21', titulo: 'Inspección de EPP de brigadistas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-149': { codigo: 'MA-SST-F-35', titulo: 'Anexo de personal autorizado', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SSTA-F-180': { codigo: 'MA-SST-F-34', titulo: 'Permiso de trabajo eléctrico', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-REPORTE': { codigo: 'MA-SST-F-40', titulo: 'Reporte e investigación de actos, condiciones, incidentes y accidentes', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PLAN': { codigo: 'MA-SST-F-41', titulo: 'Plan de acción del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-HABILITACION': { codigo: 'MA-SST-F-42', titulo: 'Estado de habilitación del personal', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INSPECCION': { codigo: 'MA-SST-F-43', titulo: 'Inspección planeada / preoperacional', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INVENTARIO': { codigo: 'MA-SST-F-44', titulo: 'Inventario de equipos e inspecciones', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INDICADORES': { codigo: 'MA-SST-F-45', titulo: 'Informe de indicadores del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-COMITE-CONFORMACION': { codigo: 'MA-SST-F-46', titulo: 'Conformación de comités (COPASST / Convivencia)', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-COPASST-ACTA': { codigo: 'MA-SST-F-47', titulo: 'Acta de reunión del COPASST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CONVIVENCIA-ACTA': { codigo: 'MA-SST-F-48', titulo: 'Acta de reunión del Comité de Convivencia Laboral', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CONVIVENCIA-QUEJA': { codigo: 'MA-SST-F-49', titulo: 'Expediente de queja (Comité de Convivencia)', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CONVIVENCIA-INFORME': { codigo: 'MA-SST-F-50', titulo: 'Informe de gestión del Comité de Convivencia', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-AUDITORIA': { codigo: 'MA-SST-F-51', titulo: 'Informe de auditoría del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-AUDITORIA-PROGRAMA': { codigo: 'MA-SST-F-52', titulo: 'Programa anual de auditorías', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PLAN-ANUAL': { codigo: 'MA-SST-F-53', titulo: 'Plan anual de trabajo del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PLAN-CAPACITACION': { codigo: 'MA-SST-F-54', titulo: 'Plan de capacitación', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-MATRIZ-PELIGROS': { codigo: 'MA-SST-F-55', titulo: 'Matriz de identificación de peligros y valoración de riesgos', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-SUSTANCIAS': { codigo: 'MA-SST-F-56', titulo: 'Inventario de sustancias químicas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PLAN-EMERGENCIAS': { codigo: 'MA-SST-F-57', titulo: 'Plan de prevención, preparación y respuesta ante emergencias', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-SIMULACRO': { codigo: 'MA-SST-F-58', titulo: 'Informe de simulacro', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROFESIOGRAMA': { codigo: 'MA-SST-F-59', titulo: 'Profesiograma', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-EXAMENES': { codigo: 'MA-SST-F-60', titulo: 'Programación de evaluaciones médicas ocupacionales', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-AUSENTISMO': { codigo: 'MA-SST-F-61', titulo: 'Informe de ausentismo', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-POLITICA': { codigo: 'MA-SST-F-62', titulo: 'Política de seguridad y salud en el trabajo', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-MATRIZ-LEGAL': { codigo: 'MA-SST-F-63', titulo: 'Matriz de requisitos legales', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-LISTADO-MAESTRO': { codigo: 'MA-SST-F-64', titulo: 'Listado maestro de documentos', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROVEEDORES': { codigo: 'MA-SST-F-65', titulo: 'Evaluación de proveedores y contratistas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-REVISION-DIRECCION': { codigo: 'MA-SST-F-66', titulo: 'Revisión por la alta dirección', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-RENDICION': { codigo: 'MA-SST-F-67', titulo: 'Rendición de cuentas en SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CONTRATISTA': { codigo: 'MA-SST-F-68', titulo: 'Ficha y documentos del contratista', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INGRESO-CONTRATISTA': { codigo: 'MA-SST-F-69', titulo: 'Control de ingreso de contratistas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-MATRIZ-EPP': { codigo: 'MA-SST-F-70', titulo: 'Matriz de elementos de protección personal por cargo', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-ENTREGA-EPP': { codigo: 'MA-SST-F-71', titulo: 'Registro de entrega de elementos de protección personal', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INDUCCION': { codigo: 'MA-SST-F-72', titulo: 'Inducción y reinducción en SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROGRAMA-ALTO-RIESGO': { codigo: 'MA-SST-F-73', titulo: 'Programas de tareas de alto riesgo', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PESV': { codigo: 'MA-SST-F-74', titulo: 'Plan estratégico de seguridad vial', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-TABLERO-GERENCIA': { codigo: 'MA-SST-F-75', titulo: 'Informe del SG-SST para la gerencia', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-REPORTE-ANUAL-0312': { codigo: 'MA-SST-F-76', titulo: 'Reporte anual de estándares mínimos', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-ASPECTOS-AMBIENTALES': { codigo: 'MA-SST-F-77', titulo: 'Matriz de aspectos e impactos ambientales', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-RESIDUOS': { codigo: 'MA-SST-F-78', titulo: 'Registro de generación de residuos', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-INFORME-ASESORIA': { codigo: 'MA-SST-F-79', titulo: 'Informe de asesoría en SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-COMPATIBILIDAD': { codigo: 'MA-SST-F-80', titulo: 'Matriz de compatibilidad de sustancias químicas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-GESTION-QUIMICA': { codigo: 'MA-SST-F-81', titulo: 'Gestión del riesgo químico (SGA)', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CRONOGRAMA-INSP': { codigo: 'MA-SST-F-82', titulo: 'Cronograma de inspecciones', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-OBJETIVOS': { codigo: 'MA-SST-D-01', titulo: 'Objetivos del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-DESIGNACION': { codigo: 'MA-SST-D-02', titulo: 'Designación del responsable del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-ROLES': { codigo: 'MA-SST-D-03', titulo: 'Roles y responsabilidades en el SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-RECURSOS': { codigo: 'MA-SST-D-04', titulo: 'Asignación de recursos para el SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-REGLAMENTO': { codigo: 'MA-SST-D-05', titulo: 'Reglamento de higiene y seguridad industrial', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-PELIGROS': { codigo: 'MA-SST-D-06', titulo: 'Procedimiento de identificación de peligros, evaluación y valoración de riesgos', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-INVESTIGACION': { codigo: 'MA-SST-D-07', titulo: 'Procedimiento de reporte e investigación de incidentes, accidentes de trabajo y enfermedades laborales', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-ACCIONES': { codigo: 'MA-SST-D-08', titulo: 'Procedimiento de acciones correctivas, preventivas y de mejora', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-CAMBIO': { codigo: 'MA-SST-D-09', titulo: 'Procedimiento de gestión del cambio', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-AUDITORIA': { codigo: 'MA-SST-D-10', titulo: 'Procedimiento de auditoría interna del SG-SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-REVISION': { codigo: 'MA-SST-D-11', titulo: 'Procedimiento de revisión por la alta dirección', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-DOCUMENTOS': { codigo: 'MA-SST-D-12', titulo: 'Procedimiento de control de documentos y conservación de registros', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-COMUNICACION': { codigo: 'MA-SST-D-13', titulo: 'Procedimiento de comunicación, participación y consulta', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-COMPRAS': { codigo: 'MA-SST-D-14', titulo: 'Procedimiento de adquisiciones y contratación con criterios de SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROC-EMERGENCIAS': { codigo: 'MA-SST-D-15', titulo: 'Procedimiento de prevención, preparación y respuesta ante emergencias', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROG-CAPACITACION': { codigo: 'MA-SST-D-16', titulo: 'Programa de capacitación, inducción y reinducción en SST', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROG-INSPECCIONES': { codigo: 'MA-SST-D-17', titulo: 'Programa de inspecciones planeadas', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PROG-MEDICO': { codigo: 'MA-SST-D-18', titulo: 'Programa de evaluaciones médicas ocupacionales', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-MANUAL': { codigo: 'MA-SST-D-19', titulo: 'Manual del Sistema de Gestión de la Seguridad y Salud en el Trabajo', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-CONTEXTO': { codigo: 'MA-CAL-F-01', titulo: 'Contexto de la organización (DOFA y partes interesadas)', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-RIESGOS-CALIDAD': { codigo: 'MA-CAL-F-02', titulo: 'Matriz de riesgos y oportunidades', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-OBJETIVOS-CALIDAD': { codigo: 'MA-CAL-F-03', titulo: 'Objetivos e indicadores de calidad', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PNC': { codigo: 'MA-CAL-F-04', titulo: 'Registro de producto o servicio no conforme', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-PQRS': { codigo: 'MA-CAL-F-05', titulo: 'Informe de PQRS de clientes', version: '1', fecha: '15/01/2025', actualizacion: '' },
    'SG-SATISFACCION': { codigo: 'MA-CAL-F-06', titulo: 'Encuesta e informe de satisfacción del cliente', version: '1', fecha: '15/01/2025', actualizacion: '' }
  },

  modulos: {
    caliente: true, alturas: true, confinados: true, izajes: true, electrico: true,
    ats: true, asistencia: true, personal: true, epp: true, brigadistas: true, tablero: true,
    reportes: true, habilitacion: true, plan: true, inspecciones: true, indicadores: true,
    copasst: true, convivencia: true, auditorias: true,
    plananual: true, peligros: true, emergencias: true, salud: true, documental: true, revision: true, contratistas: true, usuarios: true, dotacion: true, induccion: true, programas: true, pesv: true, gerencia: true, ambiental: true, quimicos: true, kit: true, calidad: true, asesor: true
  },

  correos: {
    aprobacionEpp: 'sst@montajesandinos.demo',  // a quién se pide aprobar la reposición de EPP
    dominio: 'montajesandinos.demo'                       // solo para el ejemplo del campo de correo
  },
  // Quién recibe por WhatsApp la foto de un EPP en mal estado (para aprobar el cambio).
  contactoEpp: { nombre: 'Sandra Milena Torres', cargo: 'Coordinadora SST', whatsapp: '' },
  // Clientes / centros de costo para el ATS y los preoperacionales.
  centrosCosto: ['Planta propia', 'Cliente Alimentos del Norte', 'Cliente Bebidas La Sabana', 'Cliente Química Andina'],

  servidor: 'https://demo.portal-ssta.invalid/exec',
  apiToken: 'token-demo',
  demo: true,
  // Usuarios de la demo (ficticios): la ventana de entrar los muestra para probar cada rol.
  demoUsuarios: [['sandra.sst', 'Demo2026', 'Administradora (SST)'], ['jorge.obra', 'Demo2026', 'Supervisor de obra'], ['gerencia', 'Demo2026', 'Solo consulta']]
};
