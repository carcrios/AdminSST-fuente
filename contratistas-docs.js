/* v162 · Documentos que se piden a los contratistas (los usan Contratistas y el portal del contratista).
   La empresa puede cambiarlos en EMPRESA.contratistas.documentos. */
const DOCS_BASE = [
  { k: 'camara', n: 'Certificado de existencia y representación legal (Cámara de Comercio)', meses: 3 },
  { k: 'rut', n: 'RUT', meses: 0 },
  { k: 'arl', n: 'Certificado de afiliación de la empresa a la ARL (clase de riesgo)', meses: 1 },
  { k: 'pila', n: 'Planilla de pago de seguridad social (PILA) del último mes', meses: 1 },
  { k: 'autoevaluacion', n: 'Autoevaluación de estándares mínimos (Res. 0312) y plan de mejoramiento', meses: 12 },
  { k: 'responsable', n: 'Responsable del SG-SST: licencia o curso de 50 horas', meses: 0, opcional: true },
  { k: 'peligros', n: 'Matriz de peligros o análisis de riesgos del servicio', meses: 12 },
  { k: 'procedimientos', n: 'Procedimientos y permisos para tareas de alto riesgo', meses: 12, opcional: true },
  { k: 'poliza', n: 'Póliza de responsabilidad civil extracontractual', meses: 12, opcional: true },
  { k: 'emergencias', n: 'Plan de emergencias propio o adhesión al de la empresa', meses: 12, opcional: true },
  // v148: RUC 3.2.1 e ISO 45001 8.1.4 / 14001 8.1
  { k: 'comunicacion', n: 'Constancia firmada: se le comunicaron los peligros, controles y emergencias del sitio antes de empezar', meses: 12 },
  { k: 'ambiental', n: 'Requisitos ambientales del servicio: manejo de residuos, químicos y permisos', meses: 12, opcional: true },
  { k: 'subcontratistas', n: 'Traslado de los requisitos de SST a sus subcontratistas (si subcontrata)', meses: 12, opcional: true }
];
const DOCS_CONTRATISTA = (typeof EMPRESA !== 'undefined' && EMPRESA.contratistas && EMPRESA.contratistas.documentos) || DOCS_BASE;
