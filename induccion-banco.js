/* ============================================================
   induccion-banco.js — Temas y evaluación de la inducción en SST
   ------------------------------------------------------------
   Lo usan induccion.html (el área SST la dicta) y induccion-responder.html
   (la persona la responde desde el inicio, sin usuario).
   empresa.js → induccion { temas, preguntas, aprueba } los reemplaza.
   preguntas: [texto, [opciones], índice de la correcta].
   ============================================================ */
const CFG_IND = (typeof EMPRESA !== 'undefined' && EMPRESA.induccion) || {};
const TEMAS = CFG_IND.temas || ['Política y objetivos de SST', 'Peligros y controles del cargo (matriz de peligros)', 'Plan de emergencias, rutas y punto de encuentro',
  'Cómo reportar actos, condiciones, incidentes y accidentes', 'Uso, cuidado y reposición del EPP', 'Tareas de alto riesgo: ATS y permisos de trabajo',
  'Derechos y deberes en SST', 'COPASST y Comité de Convivencia Laboral', 'Reglamento de higiene y seguridad industrial', 'Política de alcohol y drogas y seguridad vial'];
const PREGUNTAS = CFG_IND.preguntas || [
  ['Ves un cable pelado en el área de trabajo. ¿Qué haces?', ['Lo reporto de inmediato y aviso para que nadie se acerque', 'Sigo trabajando: no es mi tarea', 'Lo arreglo yo con cinta'], 0],
  ['¿Quién es responsable de tu seguridad en el trabajo?', ['Solo el jefe', 'La empresa y yo: el autocuidado también es obligación', 'La ARL'], 1],
  ['¿Desde qué altura se considera trabajo en alturas?', ['Desde 1 metro', 'Desde 2 metros sobre un nivel inferior', 'Desde 5 metros'], 1],
  ['Antes de una tarea de alto riesgo (alturas, espacios confinados, caliente, eléctrico, izaje) se necesita…', ['Solo la orden del jefe', 'El ATS y el permiso de trabajo firmados', 'Nada si ya lo he hecho antes'], 1],
  ['Si ocurre un accidente de trabajo, la empresa lo reporta a la ARL…', ['Dentro de los 2 días hábiles siguientes', 'Al final del mes', 'Solo si hay incapacidad'], 0],
  ['Suena la alarma de evacuación. ¿Qué haces?', ['Termino lo que estoy haciendo', 'Salgo por la ruta señalizada al punto de encuentro, sin correr ni devolverme', 'Busco mis cosas y salgo'], 1],
  ['Tu EPP se dañó. ¿Qué haces?', ['Sigo usándolo hasta el fin de mes', 'Pido la reposición y no hago la tarea sin la protección adecuada', 'Trabajo sin él con cuidado'], 1],
  ['¿Qué es el COPASST?', ['El comité de trabajadores y empresa que vigila la seguridad y salud en el trabajo', 'Un formato de la ARL', 'El área de recursos humanos'], 0],
  ['Una tarea no se puede hacer de forma segura. ¿Qué haces?', ['La hago rápido para salir de eso', 'La detengo y aviso al supervisor antes de continuar', 'Le pido a un compañero que la haga'], 1],
  ['Si sientes que eres víctima de acoso laboral, puedes acudir a…', ['El Comité de Convivencia Laboral', 'Nadie: es normal', 'Solo a la policía'], 0]];
const APRUEBA = Number(CFG_IND.aprueba) || 80;
const TIPOS = ['Inducción', 'Reinducción anual', 'Inducción de contratista', 'Visitante'];
/* Lo esencial de cada tema, para quien responde la inducción desde su celular. */
const DETALLE_TEMAS = CFG_IND.detalle || {
  'Política y objetivos de SST': 'La empresa se compromete a cuidar tu seguridad y salud, cumplir la ley y mejorar siempre. Tú te comprometes a cuidarte y a cuidar a tus compañeros.',
  'Peligros y controles del cargo (matriz de peligros)': 'Cada cargo tiene peligros (ruido, alturas, químicos, cargas…) y controles. Pregunta cuáles son los de tu cargo y cumple los controles.',
  'Plan de emergencias, rutas y punto de encuentro': 'Conoce la ruta de evacuación, el punto de encuentro, los extintores y a los brigadistas. Si suena la alarma, sal sin correr y sin devolverte.',
  'Cómo reportar actos, condiciones, incidentes y accidentes': 'Todo lo inseguro se reporta en el portal («Reportar un evento») o al supervisor. Un accidente se avisa de inmediato; la empresa lo reporta a la ARL en 2 días hábiles.',
  'Uso, cuidado y reposición del EPP': 'Usa el EPP que exige tu tarea, revísalo antes de usarlo y pide el cambio si está dañado. Sin la protección adecuada no se hace la tarea.',
  'Tareas de alto riesgo: ATS y permisos de trabajo': 'Alturas, espacios confinados, caliente, eléctrico e izaje necesitan ATS y permiso de trabajo firmados antes de empezar, y personal con el curso vigente.',
  'Derechos y deberes en SST': 'Tienes derecho a trabajar seguro, a la información y a parar una tarea insegura. Debes cumplir las normas, asistir a las capacitaciones y reportar.',
  'COPASST y Comité de Convivencia Laboral': 'El COPASST vigila la seguridad y salud en el trabajo; el Comité de Convivencia recibe quejas de acoso laboral de forma reservada.',
  'Reglamento de higiene y seguridad industrial': 'Es la norma interna de la empresa sobre seguridad: está publicado y es obligatorio para todos.',
  'Política de alcohol y drogas y seguridad vial': 'Prohibido trabajar o conducir bajo efectos de alcohol o drogas. Respeta las normas de tránsito y los límites de velocidad.'
};
if (typeof module !== 'undefined') module.exports = { TEMAS, PREGUNTAS, APRUEBA, TIPOS, DETALLE_TEMAS };
