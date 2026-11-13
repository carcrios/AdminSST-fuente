/* ============================================================
   empresa.js — Sitio multiempresa (tu marca)
   Ábrelo con configurar-empresa.html → «Tu sitio multiempresa (tu marca)»
   para poner el nombre de tu producto, tus datos y tu logo.
   Las empresas cliente van en empresas/<código>.json.
   ============================================================ */

const EMPRESA = {
  "nombre": "Tu empresa asesora S.A.S.",
  "nombreCorto": "TU MARCA",
  "nit": "",
  "subtitulo": "Sistema de Gestión SST",
  "logo": "",
  "colorMarca": "#1f3b57",
  "sinConfigurar": true,
  "formatos": {
    "SSTA-F-005": {
      "codigo": "",
      "titulo": "Control de asistencia a capacitación, eventos y reuniones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-006": {
      "codigo": "",
      "titulo": "Inspección de EPP",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-007": {
      "codigo": "",
      "titulo": "Análisis de Trabajo Seguro (ATS)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-116": {
      "codigo": "",
      "titulo": "Permiso de trabajo en alturas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-117": {
      "codigo": "",
      "titulo": "Permiso de espacios confinados",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-118": {
      "codigo": "",
      "titulo": "Permiso de izajes de cargas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-119": {
      "codigo": "",
      "titulo": "Permiso de trabajo en caliente",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-147": {
      "codigo": "",
      "titulo": "Inspección de EPP de brigadistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-149": {
      "codigo": "",
      "titulo": "Anexo de personal autorizado",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SSTA-F-180": {
      "codigo": "",
      "titulo": "Permiso de trabajo eléctrico",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REPORTE": {
      "codigo": "",
      "titulo": "Reporte e investigación de actos, condiciones, incidentes y accidentes",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN": {
      "codigo": "",
      "titulo": "Plan de acción del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-HABILITACION": {
      "codigo": "",
      "titulo": "Estado de habilitación del personal",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INSPECCION": {
      "codigo": "",
      "titulo": "Inspección planeada / preoperacional",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INVENTARIO": {
      "codigo": "",
      "titulo": "Inventario de equipos e inspecciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INDICADORES": {
      "codigo": "",
      "titulo": "Informe de indicadores del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COMITE-CONFORMACION": {
      "codigo": "",
      "titulo": "Conformación de comités (COPASST / Convivencia)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EMERGENCIAS-ACTA": {
      "codigo": "",
      "titulo": "Acta de reunión del comité de emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COPASST-ACTA": {
      "codigo": "",
      "titulo": "Acta de reunión del COPASST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-ACTA": {
      "codigo": "",
      "titulo": "Acta de reunión del Comité de Convivencia Laboral",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-QUEJA": {
      "codigo": "",
      "titulo": "Expediente de queja (Comité de Convivencia)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONVIVENCIA-INFORME": {
      "codigo": "",
      "titulo": "Informe de gestión del Comité de Convivencia",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUDITORIA": {
      "codigo": "",
      "titulo": "Informe de auditoría del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUDITORIA-PROGRAMA": {
      "codigo": "",
      "titulo": "Programa anual de auditorías",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-ANUAL": {
      "codigo": "",
      "titulo": "Plan anual de trabajo del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-CAPACITACION": {
      "codigo": "",
      "titulo": "Plan de capacitación",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-PELIGROS": {
      "codigo": "",
      "titulo": "Matriz de identificación de peligros y valoración de riesgos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SUSTANCIAS": {
      "codigo": "",
      "titulo": "Inventario de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PLAN-EMERGENCIAS": {
      "codigo": "",
      "titulo": "Plan de prevención, preparación y respuesta ante emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SIMULACRO": {
      "codigo": "",
      "titulo": "Informe de simulacro",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROFESIOGRAMA": {
      "codigo": "",
      "titulo": "Profesiograma",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EXAMENES": {
      "codigo": "",
      "titulo": "Programación de evaluaciones médicas ocupacionales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-AUSENTISMO": {
      "codigo": "",
      "titulo": "Informe de ausentismo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-POLITICA": {
      "codigo": "",
      "titulo": "Política de seguridad y salud en el trabajo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-LEGAL": {
      "codigo": "",
      "titulo": "Matriz de requisitos legales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-LISTADO-MAESTRO": {
      "codigo": "",
      "titulo": "Listado maestro de documentos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROVEEDORES": {
      "codigo": "",
      "titulo": "Evaluación de proveedores y contratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EVAL-PROVEEDOR": {
      "codigo": "",
      "titulo": "Evaluación y reevaluación de proveedores, contratistas y subcontratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REVISION-DIRECCION": {
      "codigo": "",
      "titulo": "Revisión por la alta dirección",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RENDICION": {
      "codigo": "",
      "titulo": "Rendición de cuentas en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONTRATISTA": {
      "codigo": "",
      "titulo": "Ficha y documentos del contratista",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INGRESO-CONTRATISTA": {
      "codigo": "",
      "titulo": "Control de ingreso de contratistas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MATRIZ-EPP": {
      "codigo": "",
      "titulo": "Matriz de elementos de protección personal por cargo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ENTREGA-EPP": {
      "codigo": "",
      "titulo": "Registro de entrega de elementos de protección personal",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INDUCCION": {
      "codigo": "",
      "titulo": "Inducción y reinducción en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROGRAMA-ALTO-RIESGO": {
      "codigo": "",
      "titulo": "Programas de tareas de alto riesgo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PESV": {
      "codigo": "",
      "titulo": "Plan estratégico de seguridad vial",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-TABLERO-GERENCIA": {
      "codigo": "",
      "titulo": "Informe del SG-SST para la gerencia",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REPORTE-ANUAL-0312": {
      "codigo": "",
      "titulo": "Reporte anual de estándares mínimos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ASPECTOS-AMBIENTALES": {
      "codigo": "",
      "titulo": "Matriz de aspectos e impactos ambientales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RESIDUOS": {
      "codigo": "",
      "titulo": "Registro de generación de residuos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-INFORME-ASESORIA": {
      "codigo": "",
      "titulo": "Informe de asesoría en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-COMPATIBILIDAD": {
      "codigo": "",
      "titulo": "Matriz de compatibilidad de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-GESTION-QUIMICA": {
      "codigo": "",
      "titulo": "Gestión del riesgo químico (SGA)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-LUGARES-QUIMICOS": {
      "codigo": "",
      "titulo": "Lugares de almacenamiento de sustancias químicas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONSUMOS": {
      "codigo": "",
      "titulo": "Informe de consumos de agua, energía y combustibles",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CRONOGRAMA-INSP": {
      "codigo": "",
      "titulo": "Cronograma de inspecciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-OBJETIVOS": {
      "codigo": "",
      "titulo": "Objetivos del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-DESIGNACION": {
      "codigo": "",
      "titulo": "Designación del responsable del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ROLES": {
      "codigo": "",
      "titulo": "Roles y responsabilidades en el SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RECURSOS": {
      "codigo": "",
      "titulo": "Asignación de recursos para el SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-REGLAMENTO": {
      "codigo": "",
      "titulo": "Reglamento de higiene y seguridad industrial",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-PELIGROS": {
      "codigo": "",
      "titulo": "Procedimiento de identificación de peligros, evaluación y valoración de riesgos",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-INVESTIGACION": {
      "codigo": "",
      "titulo": "Procedimiento de reporte e investigación de incidentes, accidentes de trabajo y enfermedades laborales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-ACCIONES": {
      "codigo": "",
      "titulo": "Procedimiento de acciones correctivas, preventivas y de mejora",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-CAMBIO": {
      "codigo": "",
      "titulo": "Procedimiento de gestión del cambio",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-AUDITORIA": {
      "codigo": "",
      "titulo": "Procedimiento de auditoría interna del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-REVISION": {
      "codigo": "",
      "titulo": "Procedimiento de revisión por la alta dirección",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-DOCUMENTOS": {
      "codigo": "",
      "titulo": "Procedimiento de control de documentos y conservación de registros",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-COMUNICACION": {
      "codigo": "",
      "titulo": "Procedimiento de comunicación, participación y consulta",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-COMPRAS": {
      "codigo": "",
      "titulo": "Procedimiento de adquisiciones y contratación con criterios de SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROC-EMERGENCIAS": {
      "codigo": "",
      "titulo": "Procedimiento de prevención, preparación y respuesta ante emergencias",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-CAPACITACION": {
      "codigo": "",
      "titulo": "Programa de capacitación, inducción y reinducción en SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-INSPECCIONES": {
      "codigo": "",
      "titulo": "Programa de inspecciones planeadas",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PROG-MEDICO": {
      "codigo": "",
      "titulo": "Programa de evaluaciones médicas ocupacionales",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-MANUAL": {
      "codigo": "",
      "titulo": "Manual del Sistema de Gestión de la Seguridad y Salud en el Trabajo",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CONTEXTO": {
      "codigo": "",
      "titulo": "Contexto de la organización (DOFA y partes interesadas)",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-RIESGOS-CALIDAD": {
      "codigo": "",
      "titulo": "Matriz de riesgos y oportunidades",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-OBJETIVOS-CALIDAD": {
      "codigo": "",
      "titulo": "Objetivos e indicadores de calidad",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PNC": {
      "codigo": "",
      "titulo": "Registro de producto o servicio no conforme",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PQRS": {
      "codigo": "",
      "titulo": "Informe de PQRS de clientes",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-SATISFACCION": {
      "codigo": "",
      "titulo": "Encuesta e informe de satisfacción del cliente",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-PREOPERACIONAL": {
      "codigo": "",
      "titulo": "Inspección preoperacional",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-CIERRE-MES": {
      "codigo": "",
      "titulo": "Informe mensual del SG-SST",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-EVIDENCIAS": {
      "codigo": "",
      "titulo": "Índice de evidencias del SG-SST por estándar",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    },
    "SG-ETIQUETAS-QR": {
      "codigo": "",
      "titulo": "Etiquetas QR de equipos e instalaciones",
      "version": "",
      "fecha": "",
      "actualizacion": ""
    }
  },
  "modulos": {
    "caliente": true,
    "alturas": true,
    "confinados": true,
    "izajes": true,
    "electrico": true,
    "ats": true,
    "asistencia": true,
    "personal": true,
    "epp": true,
    "brigadistas": true,
    "tablero": true,
    "reportes": true,
    "habilitacion": true,
    "plan": true,
    "inspecciones": true,
    "indicadores": true,
    "copasst": true,
    "convivencia": true,
    "comiteemergencias": true,
    "auditorias": true,
    "plananual": true,
    "peligros": true,
    "emergencias": true,
    "salud": true,
    "documental": true,
    "revision": true,
    "contratistas": true,
    "usuarios": true,
    "dotacion": true,
    "induccion": true,
    "programas": true,
    "pesv": true,
    "gerencia": true,
    "ambiental": true,
    "quimicos": true,
    "kit": true,
    "calidad": true,
    "asesor": true,
    "cierre": true,
    "evidencias": true,
    "preop": true,
    "proveedores": true
  },
  "correos": {
    "aprobacionEpp": "",
    "dominio": ""
  },
  "contactoEpp": {
    "nombre": "",
    "cargo": "",
    "whatsapp": ""
  },
  "habilitacion": {
    "requisitos": {
      "seguridad_social": {
        "nombre": "Pago de seguridad social (PILA)",
        "meses": 1
      },
      "induccion": {
        "nombre": "Inducción / reinducción en SST",
        "meses": 12
      },
      "medico": {
        "nombre": "Concepto médico ocupacional",
        "meses": 12,
        "apto": true
      },
      "alturas": {
        "nombre": "Curso de trabajo en alturas",
        "meses": 18
      },
      "confinados": {
        "nombre": "Curso de espacios confinados",
        "meses": 12
      },
      "izajes": {
        "nombre": "Certificación de izaje (rigger / operador)",
        "meses": 12
      },
      "electrico": {
        "nombre": "Competencia en riesgo eléctrico",
        "meses": 12
      },
      "caliente": {
        "nombre": "Capacitación en trabajo en caliente",
        "meses": 12
      },
      "alimentos": {
        "nombre": "Concepto de manipulación de alimentos",
        "meses": 12,
        "apto": true
      }
    },
    "exigir": {
      "todos": [
        "seguridad_social",
        "induccion",
        "medico"
      ],
      "alturas": [
        "alturas"
      ],
      "confinados": [
        "confinados"
      ],
      "izajes": [
        "izajes"
      ],
      "electrico": [
        "electrico"
      ],
      "caliente": [
        "caliente"
      ]
    },
    "avisarDias": 15
  },
  "acceso": null,
  "centrosCosto": [],
  "servidor": "",
  "apiToken": "",
  "demo": false,
  "multiempresa": true,
  "empresaPorDefecto": "",
  "producto": "Portal SSTA"
};
