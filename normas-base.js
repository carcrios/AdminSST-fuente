/* ============================================================
   normas-base.js — Lista para empezar la matriz legal de SST (Colombia)
   [norma, año, emisor, tema, artículos, requisito resumido]
   Es un punto de partida: cada empresa revisa que apliquen a su actividad,
   que sigan vigentes y agrega las de su sector. Corte: octubre de 2026.
   ============================================================ */
const NORMAS_BASE = [
  ['Ley 9 de 1979', '1979', 'Congreso', 'Generales', 'Título III', 'Medidas sanitarias y de salud ocupacional en los lugares de trabajo.'],
  ['Resolución 2400 de 1979', '1979', 'Min. Trabajo', 'Generales', 'Toda', 'Estatuto de seguridad industrial: vivienda, higiene y seguridad en los establecimientos de trabajo.'],
  ['Decreto 1295 de 1994', '1994', 'Min. Trabajo', 'Riesgos laborales', 'Toda', 'Organización y administración del Sistema General de Riesgos Laborales.'],
  ['Ley 1562 de 2012', '2012', 'Congreso', 'Riesgos laborales', 'Toda', 'Modifica el Sistema de Riesgos Laborales: SG-SST, afiliación, accidente y enfermedad laboral.'],
  ['Decreto 1072 de 2015', '2015', 'Min. Trabajo', 'SG-SST', 'Libro 2, Parte 2, Título 4, Cap. 6', 'Implementar el SG-SST: política, objetivos, plan anual, matriz de peligros, emergencias, indicadores, auditoría, revisión por la dirección y mejora.'],
  ['Resolución 0312 de 2019', '2019', 'Min. Trabajo', 'SG-SST', 'Toda', 'Estándares mínimos del SG-SST; autoevaluación anual y plan de mejoramiento.'],
  ['Resolución 4927 de 2016', '2016', 'Min. Trabajo', 'Capacitación', 'Toda', 'Curso virtual de 50 horas del SG-SST para los responsables.'],
  ['Decreto 472 de 2015', '2015', 'Min. Trabajo', 'Sanciones', 'Toda', 'Criterios para multas por incumplir las normas de SST y riesgos laborales.'],
  ['Resolución 2013 de 1986', '1986', 'Min. Trabajo / Salud', 'COPASST', 'Toda', 'Organización y funcionamiento del comité paritario: conformación, reuniones mensuales, funciones.'],
  ['Ley 1010 de 2006', '2006', 'Congreso', 'Convivencia laboral', 'Toda', 'Prevenir, corregir y sancionar el acoso laboral.'],
  ['Resolución 3461 de 2025', '2025', 'Min. Trabajo', 'Convivencia laboral', 'Toda', 'Conformación y funcionamiento del Comité de Convivencia Laboral; procedimiento de quejas e informes.'],
  ['Ley 2365 de 2024', '2024', 'Congreso', 'Acoso sexual', 'Toda', 'Prevención, protección y atención del acoso sexual en el ámbito laboral.'],
  ['Resolución 2646 de 2008', '2008', 'Min. Protección Social', 'Riesgo psicosocial', 'Toda', 'Identificación, evaluación, prevención e intervención de los factores de riesgo psicosocial.'],
  ['Resolución 2764 de 2022', '2022', 'Min. Trabajo', 'Riesgo psicosocial', 'Toda', 'Batería de instrumentos de riesgo psicosocial y su periodicidad de aplicación.'],
  ['Ley 2191 de 2022', '2022', 'Congreso', 'Riesgo psicosocial', 'Toda', 'Desconexión laboral.'],
  ['Resolución 1843 de 2025', '2025', 'Min. Trabajo', 'Evaluaciones médicas', 'Toda', 'Evaluaciones médicas ocupacionales, profesiograma, historia clínica ocupacional y su custodia.'],
  ['Resolución 1401 de 2007', '2007', 'Min. Protección Social', 'Accidentes', 'Toda', 'Investigación de incidentes y accidentes de trabajo (15 días, equipo investigador).'],
  ['Resolución 156 de 2005', '2005', 'Min. Protección Social', 'Accidentes', 'Toda', 'Formatos de informe de accidente de trabajo y enfermedad laboral (FURAT / FUREL).'],
  ['Resolución 4272 de 2021', '2021', 'Min. Trabajo', 'Trabajo en alturas', 'Toda', 'Requisitos mínimos de seguridad para trabajo en alturas: programa, certificación, permisos, equipos.'],
  ['Resolución 0491 de 2020', '2020', 'Min. Trabajo', 'Espacios confinados', 'Toda', 'Requisitos mínimos de seguridad para trabajo en espacios confinados.'],
  ['Resolución 5018 de 2019', '2019', 'Min. Trabajo', 'Riesgo eléctrico', 'Toda', 'Lineamientos de SST en los procesos de generación, transmisión, distribución y comercialización de energía eléctrica.'],
  ['Reglamento Técnico de Instalaciones Eléctricas (RETIE)', '', 'Min. Minas y Energía', 'Riesgo eléctrico', 'Toda', 'Requisitos de las instalaciones eléctricas. Verifica la resolución vigente del RETIE y escribe su número.'],
  ['Decreto 1496 de 2018', '2018', 'Presidencia', 'Sustancias químicas', 'Toda', 'Adopta el Sistema Globalmente Armonizado (SGA) de clasificación y etiquetado de productos químicos.'],
  ['Resolución 0773 de 2021', '2021', 'Min. Trabajo', 'Sustancias químicas', 'Toda', 'Implementación del SGA en los lugares de trabajo: etiquetado, hojas de seguridad, capacitación.'],
  ['Ley 1523 de 2012', '2012', 'Congreso', 'Emergencias', 'Art. 42', 'Gestión del riesgo de desastres: análisis específico de riesgo y planes de contingencia.'],
  ['Decreto 2157 de 2017', '2017', 'Presidencia', 'Emergencias', 'Toda', 'Plan de gestión del riesgo de desastres de las entidades públicas y privadas.'],
  ['Ley 1503 de 2011', '2011', 'Congreso', 'Seguridad vial', 'Toda', 'Promoción de la seguridad vial; plan estratégico de seguridad vial (PESV).'],
  ['Resolución 40595 de 2022', '2022', 'Min. Transporte', 'Seguridad vial', 'Toda', 'Metodología para el diseño, implementación y verificación del PESV.'],
  ['Decreto 1477 de 2014', '2014', 'Min. Trabajo', 'Enfermedad laboral', 'Toda', 'Tabla de enfermedades laborales.'],
  ['Ley 1581 de 2012', '2012', 'Congreso', 'Datos personales', 'Toda', 'Protección de datos personales (datos de salud de los trabajadores, autorizaciones).'],
  ['Decreto 1076 de 2015 (modificado por el Decreto 766 de 2026)', '2026', 'Min. Ambiente', 'Residuos peligrosos', 'Título 6 (RESPEL)', 'Gestión integral de residuos peligrosos: categoría de generador, almacenamiento máximo 12 meses, capacitación anual, certificados 5 años y registro en el RUA.'],
  ['Resolución 0839 de 2023', '2023', 'Min. Ambiente', 'Residuos peligrosos', 'Toda', 'Registro Único Ambiental (RUA): inscripción y reporte anual de generadores de residuos peligrosos ante el IDEAM.'],
  ['Resolución 2674 de 2013', '2013', 'Min. Salud', 'Manipulación de alimentos', 'Art. 11 y 12', 'Reconocimiento médico y capacitación de manipuladores de alimentos (si aplica).'],
  ['Resolución 1455 de 2025', '2025', 'Supertransporte', 'Seguridad vial', 'Toda', 'Reporte del PESV en la plataforma VIGIA 2 (vigilados por la Supertransporte).']
];
