/* ============================================================
   proveedores-catalogo.js — Evaluación de proveedores y contratistas (v107)
   ------------------------------------------------------------
   Lo que usa proveedores.html (y las pruebas, en Node):
   · catálogo de categorías (S = suministro de bienes, V = servicios) con
     nivel de riesgo, criticidad y periodicidad de reevaluación, y los
     requisitos de cada una por etapa (★ = excluyente: sin él no se contrata
     o no se inicia el servicio);
   · criterios y pesos de la evaluación inicial (distintos para bienes y para
     servicios / contratistas) y de la reevaluación, con sus escalas;
   · clasificación (CONFIABLE ≥ 80 %, CONDICIONADO 60–79 %, NO APTO < 60 %;
     en la reevaluación: ACEPTABLE CON PLAN DE MEJORA y RECHAZADO), próxima
     fecha según la criticidad, cronograma anual y homologación;
   · dígito de verificación del NIT (DIAN).
   Criterios, pesos, rangos y requisitos se copiaron tal cual del procedimiento
   de adquisición de bienes y servicios, la matriz de requisitos para
   proveedores y el formato de evaluación/reevaluación que entregó el cliente
   (sin el nombre de esa empresa: cada empresa pone sus códigos en empresa.js).
   ============================================================ */
const Proveedores = (function () {
  /* Catálogo: CAT[i] = { c: código, n: nombre, b: 'Bien'|'Servicio', nivel, critico, r: requisitos }
     requisito = [etapa, subgrupo, requisito, condicional(1/0), condición, vigencia, verifica, excluyente(1/0), base legal]
     (los textos van por índice en las tablas REQ, SUB, COND, VIG, VER, BASE). */
  const C = {"REQ":["Oferta comercial (cotización)","Registro Único Tributario (RUT)","Certificado de Cámara de Comercio","Cédula del representante legal (ampliada al 150%)","Certificación bancaria","Remisión de entrega con cantidades","Seguridad social del personal que entrega o instala","Factura electrónica","Certificado de calidad del producto","Ficha técnica del material","Muestra del producto para aprobación (si aplica)","Ficha técnica (tallas, materiales y norma técnica que cumple)","Certificado de conformidad con norma técnica","Ficha técnica del equipo","Declaración o certificado de conformidad (RETIE, UL, CE)","Certificado de calibración","Manual de operación y mantenimiento","Garantía del equipo","Capacitación al personal usuario","Hojas de datos de seguridad (SDS) en formato SGA","Ficha técnica del insumo","Etiquetado SGA del envase","Autoevaluación de Estándares Mínimos SG-SST firmada por la ARL","Política del SG-SST firmada y vigente","Registro como distribuidor autorizado (SICOM)","Hojas de datos de seguridad (SDS) del combustible","Plan de contingencia por derrames","Afiliación y pago de seguridad social (EPS, AFP, ARL) del personal que ingresa","Inducción SST de la empresa al personal del proveedor","Licencia de tránsito (tarjeta de propiedad)","SOAT","Revisión técnico-mecánica y de emisiones","Póliza todo riesgo del vehículo","Inspección preoperacional del vehículo","Licencia de conducción de la categoría requerida","Consulta SIMIT / RUNT sin restricciones","Curso de manejo defensivo","Examen médico ocupacional del conductor","Remisión con volumen entregado","Consolidado de accidentalidad ARL (últimos 2 años)","Soporte de entrega de EPP y dotación (último semestre)","Matriz de peligros y procedimientos seguros de la actividad","Soportes de implementación del Sistema Globalmente Armonizado (SGA)","Póliza de Responsabilidad Civil Extracontractual (monto mínimo según contrato)","Certificado / carta de implementación del PESV","Examen médico ocupacional del personal","Análisis de Trabajo Seguro (ATS)","Permiso de trabajo para actividades de alto riesgo","Hoja de vida y cronograma de mantenimiento del equipo","Certificado de inspección del equipo de izaje por tercero competente","Certificado de inspección de accesorios de izaje (eslingas, grilletes, ganchos)","Inspección preoperacional del equipo","Plan de izaje","Certificado de competencia como operador del equipo","Certificado de aparejador / señalero (rigger)","Certificado de trabajo en alturas","Plan de contingencia por derrame de combustibles/lubricantes","Factura electrónica y/o cuenta de cobro","Soporte de recibido a satisfacción del servicio","Ficha técnica y/o manual de la herramienta","Remisión de la herramienta","Inspección de la herramienta a la entrega","Hoja de vida y cronograma de mantenimiento","Acta de devolución de la herramienta","Ficha técnica del andamio","Certificado del fabricante o memoria de cálculo de resistencia","Procedimiento de armado y desarmado","Certificado de trabajo en alturas del personal de armado","Designación de persona competente para armado e inspección","Certificado de inspección del andamio antes de su uso","Acta de desmonte y devolución","Ficha técnica del contenedor","Póliza de Responsabilidad Civil Extracontractual","Certificado de inspección del contenedor","Certificado de instalaciones eléctricas (RETIE)","Plan de izaje para ubicación del contenedor","Ficha técnica y tabla de carga del equipo","Portafolio de servicios y tarifario","Inscripción en REPS y habilitación de servicios de salud","Licencia de SST de la IPS","Licencias SST de los médicos que realizan evaluaciones","Certificados de calibración de equipos biomédicos","Protocolo de bioseguridad y gestión de residuos hospitalarios","Póliza de Responsabilidad Civil (profesional / extracontractual)","Acuerdo de tratamiento de datos y custodia de historias clínicas","Conceptos de aptitud médica por trabajador","Informe de diagnóstico de condiciones de salud","Soporte de restricciones y recomendaciones médicas","Habilitación como empresa de transporte de carga","Manifiesto electrónico de carga (RNDC)","Cumplido / soporte de entrega de la carga","Licencia ambiental vigente como gestor de RESPEL","Política ambiental del proveedor","Plan de contingencia por derrame de residuos peligrosos","Curso básico obligatorio de mercancías peligrosas del conductor","Rotulado del vehículo y kit de derrames","Remisión / manifiesto de transporte de residuos peligrosos","Certificado de tratamiento y/o disposición final","Programa de gestión de residuos (aceites, filtros, baterías, llantas)","Informe de mantenimiento con repuestos utilizados","Certificado de disposición de aceites usados y residuos peligrosos","Programa del curso","Soportes de autorización del centro de entrenamiento según Res. 4272/2021","Licencia SST y certificado de entrenador de los instructores","Certificados e inspección de equipos de entrenamiento","Certificados de aprobación por trabajador (verificables)","Programa o pensum del curso","Soportes de autorización o competencia del centro","Licencia SST y certificación de los instructores","Equipos de medición de atmósferas calibrados (O2, CO, H2S, LEL)","Certificados de aprobación por trabajador","Propuesta metodológica de aplicación","Licencia SST vigente y posgrado en SST del psicólogo ejecutor","Acuerdo de tratamiento de datos personales y confidencialidad","Seguridad social del profesional","Informe grupal confidencial con resultados","Plan de intervención recomendado","Soporte de custodia de cuestionarios individuales","Concepto sanitario favorable (Secretaría de Salud)","Registro de los productos ante la autoridad competente","Hojas de datos de seguridad (SDS) de los productos","Plan de contingencia por derrame de productos químicos","Kit antiderrame disponible en sitio","Certificado de fumigación con productos y dosis aplicadas","Certificado de disposición de envases y sobrantes","Procedimiento técnico de lavado","Concepto sanitario favorable","Permiso de vertimientos o contrato con gestor autorizado de lodos/aguas","Programa de gestión de residuos","Protocolo y certificación para espacios confinados","Informe de la actividad con registro fotográfico","Certificado de disposición de lodos y aguas residuales","Permiso de vertimientos o conexión a alcantarillado autorizada","Programa de gestión de residuos sólidos","Trampa de grasas operativa con mantenimiento al día","Propuesta técnica y metodología de medición","Licencia SST con alcance en higiene industrial del profesional","Certificados de calibración vigentes de los equipos","Acreditación ONAC del laboratorio","Informe técnico con metodología, resultados y firma del profesional licenciado","Propuesta técnica, cronograma y personal propuesto","Póliza de cumplimiento y de salarios y prestaciones","Registro Uniforme de Contratistas (RUC)","Plan SST específico para el proyecto","Certificados de competencia (alturas, soldadura, eléctricos, etc.)","Inspección de herramientas y equipos del subcontratista","Acta de entrega de obra","Paz y salvo de seguridad social, salarios y prestaciones del personal","Habilitación para servicio especial de transporte","Pólizas de responsabilidad civil contractual y extracontractual","Tarjeta de operación","Alcance de la inspección","Acreditación ONAC como organismo de inspección o soportes de competencia","Certificación de competencia del inspector","Certificado de inspección por equipo con resultados y vigencia","Acreditación ONAC (ISO/IEC 17025) del laboratorio de calibración","Certificado de calibración con trazabilidad e incertidumbre","Soportes de competencia técnica del personal","Certificado de recarga / mantenimiento por equipo","Registro como gestor u organización de recicladores autorizada","Certificado de aprovechamiento y/o disposición final","Certificado de manipulación de alimentos del personal","Registro Nacional de Turismo (RNT)","Propuesta técnica y hoja de vida del profesional","Tarjeta o licencia profesional","Acuerdo de confidencialidad","Planilla de seguridad social como independiente","Informe o entregables pactados"],"SUB":["General","Vehículo","Conductor","Equipo","Operador"],"VIG":["","Vigente","≤ 30 días","≤ 90 días","Mensual","Vigente (≤ 5 años)","Anual","Antes de ingresar","Diaria / por uso","Por servicio","Semestral","Vigencia del contrato","Por actividad","Por maniobra","Según Res. 4272/2021","Por entrega","Por obra","Antes de cada uso","Por viaje","Por proyecto"],"VER":["Compras","Contabilidad","Coordinador de Compras","GH y SSTA","Área solicitante","Ambiental","Supervisor del contrato","Compras / Gerencia","Supervisor SSTA"],"BASE":["","Estatuto Tributario","Código de Comercio","Dec. 358/2020","Dec. 1496/2018","Res. 0312/2019","Dec. 1072/2015","Normativa Min. Minas y Energía","Dec. 1072/2015 art. 2.2.4.6.28","Procedimiento de adquisiciones","Ley 769/2002","Res. 2346/2007","Res. 40595/2022","Res. 4272/2021","RETIE","Res. 3100/2019","Res. 754/2021","Res. 2346/2007 / Ley 1581/2012","Dec. 1079/2015","Dec. 1076/2015","Res. 1223/2014","Res. 491/2020","Res. 2764/2022","Ley 1581/2012","Res. 2674/2013"],"COND":["","Personas jurídicas / comerciantes","Si ingresa a instalaciones o a obra","Materiales estructurales o con especificación","EPP: calzado, casco, arnés, guantes, etc.","Equipos eléctricos","Equipos de medición","Equipos que la requieran","Sustancias químicas","Según contrato","Según PESV","Si maneja sustancias químicas","Si la flota o conductores superan el umbral legal","Izajes críticos","Si hay maniobras de izaje","Trabajo > 2 m","Equipos con motor","Herramientas eléctricas o de potencia","Contenedores oficina / habitables","Si se ubica con grúa","Empresas de transporte","Transporte intermunicipal","Aplicación presencial","Ingreso a tanques cerrados","Análisis de muestras en laboratorio","Si el cliente lo exige","Según actividad","Transporte de personal","Servicio especial","Servicio de alimentación","Hospedaje","Profesiones reguladas","Acceso a información sensible","Persona natural"],"CAT":[{"c":"S01","n":"Suministro de Materiales","b":"Bien","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[3,0,5,0,0,0,2,0,0],[3,0,6,1,2,4,3,0,0],[4,0,7,0,0,0,1,0,3],[4,0,8,1,3,0,4,0,0],[4,0,9,0,0,0,4,0,0]]},{"c":"S02","n":"Suministro de Dotación y EPP","b":"Bien","nivel":"Básico","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,10,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,11,0,0,1,3,1,0],[3,0,5,0,0,0,2,0,0],[3,0,6,1,2,4,3,0,0],[4,0,7,0,0,0,1,0,3],[4,0,12,1,4,0,4,0,0],[4,0,8,0,0,0,4,0,0]]},{"c":"S03","n":"Suministro de Equipos","b":"Bien","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[1,0,13,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[3,0,5,0,0,0,2,0,0],[3,0,6,1,2,4,3,0,0],[4,0,7,0,0,0,1,0,3],[4,0,14,1,5,0,4,0,0],[4,0,15,1,6,0,4,0,0],[4,0,16,0,0,0,4,0,0],[4,0,17,0,0,0,4,0,0],[4,0,18,1,7,0,4,0,0]]},{"c":"S04","n":"Suministro de Insumos y Sustancias Químicas","b":"Bien","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,19,1,8,5,3,1,4],[3,0,5,0,0,0,2,0,0],[3,0,6,1,2,4,3,0,0],[4,0,7,0,0,0,1,0,3],[4,0,8,0,0,0,4,0,0],[4,0,20,0,0,0,4,0,0],[4,0,21,1,8,0,4,0,0]]},{"c":"S05","n":"Suministro de Combustibles","b":"Bien","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,24,0,0,1,0,1,7],[2,0,25,0,0,1,3,0,4],[2,0,26,0,0,1,5,1,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[3,0,38,0,0,0,6,0,0],[4,0,7,0,0,0,1,0,3]]},{"c":"V01","n":"Alquiler de Máquinas y Equipos de Elevación","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,13,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,1,11,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,44,1,12,1,3,0,12],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[3,3,48,0,0,6,8,0,0],[3,3,49,0,0,6,8,1,0],[3,3,50,0,0,6,8,1,0],[3,3,51,0,0,8,6,0,0],[3,3,52,1,13,13,8,1,0],[3,4,53,0,0,1,3,1,0],[3,4,54,1,14,1,3,0,0],[3,4,55,1,15,14,3,0,13],[3,0,56,1,16,1,5,0,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V02","n":"Alquiler de Herramientas","b":"Servicio","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[1,0,59,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[3,0,60,0,0,0,2,0,0],[3,0,61,0,0,15,6,0,0],[3,0,62,1,17,6,8,0,0],[4,0,57,0,0,0,1,0,3],[4,0,63,0,0,0,6,0,0]]},{"c":"V03","n":"Alquiler de Andamios","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,64,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,1,11,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,65,0,0,1,8,1,0],[2,0,66,0,0,1,3,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,0,67,0,0,14,3,1,13],[3,0,68,0,0,16,8,1,13],[3,0,69,0,0,17,8,1,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,70,0,0,0,6,0,0]]},{"c":"V04","n":"Alquiler de Contenedores","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[1,0,71,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,72,0,0,11,0,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,73,0,0,15,6,0,0],[3,0,74,1,18,1,8,0,14],[3,0,75,1,19,13,8,0,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V05","n":"Alquiler de Montacargas y Grúas / PH","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,76,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,1,11,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,44,1,12,1,3,0,12],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[3,3,48,0,0,6,8,0,0],[3,3,49,0,0,6,8,1,0],[3,3,50,0,0,6,8,1,0],[3,3,51,0,0,8,6,0,0],[3,3,52,1,13,13,8,1,0],[3,4,53,0,0,1,3,1,0],[3,4,54,1,14,1,3,0,0],[3,4,55,1,15,14,3,0,13],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V06","n":"Centros Médicos Ocupacionales (IPS)","b":"Servicio","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,77,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,78,0,0,1,3,1,15],[2,0,79,0,0,1,3,1,16],[2,0,80,0,0,1,3,1,16],[2,0,81,0,0,6,3,0,0],[2,0,82,0,0,1,5,0,0],[2,0,83,0,0,1,0,0,0],[2,0,84,0,0,11,3,1,17],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[4,0,57,0,0,0,1,0,3],[4,0,85,0,0,0,6,0,0],[4,0,86,0,0,0,6,0,0],[4,0,87,0,0,0,6,0,0]]},{"c":"V07","n":"Transporte de Materiales y Herramientas","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,88,1,20,1,0,1,18],[2,0,72,0,0,1,0,1,0],[2,0,44,1,12,1,3,0,12],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,89,1,21,18,2,0,18],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[4,0,57,0,0,0,1,0,3],[4,0,90,0,0,0,6,0,0]]},{"c":"V08","n":"Disposición de Residuos Peligrosos","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,0,0,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,91,0,0,1,5,1,19],[2,0,92,0,0,1,5,0,0],[2,0,93,0,0,1,5,1,19],[2,0,44,1,12,1,3,0,12],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[3,2,94,0,0,1,3,1,20],[3,1,95,0,0,9,5,1,18],[3,0,96,0,0,9,5,1,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,97,0,0,0,6,0,0]]},{"c":"V09","n":"Mantenimiento de Vehículos","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,98,0,0,1,5,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,99,0,0,0,6,0,0],[4,0,100,0,0,0,6,0,0]]},{"c":"V10","n":"Centro de Entrenamiento – Trabajo en Alturas","b":"Servicio","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,101,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,102,0,0,1,3,1,13],[2,0,103,0,0,1,3,1,13],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,104,0,0,6,8,0,0],[4,0,57,0,0,0,1,0,3],[4,0,105,0,0,0,6,0,0]]},{"c":"V11","n":"Centro de Entrenamiento – Espacios Confinados","b":"Servicio","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,106,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,107,0,0,1,3,1,21],[2,0,108,0,0,1,3,1,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,109,0,0,6,8,0,0],[4,0,57,0,0,0,1,0,3],[4,0,110,0,0,0,6,0,0]]},{"c":"V12","n":"Batería de Riesgo Psicosocial","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[1,0,111,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,112,0,0,1,3,1,22],[2,0,113,0,0,11,3,1,23],[3,0,114,1,22,4,3,0,0],[4,0,57,0,0,0,1,0,3],[4,0,115,0,0,0,6,0,0],[4,0,116,0,0,0,6,0,0],[4,0,117,0,0,0,6,0,0]]},{"c":"V13","n":"Fumigación y Control de Plagas","b":"Servicio","nivel":"Alto","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,0,0,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,118,0,0,1,3,1,0],[2,0,119,0,0,1,3,1,0],[2,0,120,0,0,1,3,1,4],[2,0,121,0,0,1,5,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,0,122,0,0,9,8,0,0],[3,0,55,1,15,14,3,0,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,123,0,0,0,6,0,0],[4,0,124,0,0,0,6,0,0]]},{"c":"V14","n":"Lavado de Tanques","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,125,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,0,0,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,126,0,0,1,3,1,0],[2,0,127,0,0,1,5,1,19],[2,0,128,0,0,1,5,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,0,55,0,0,14,3,1,13],[3,0,129,1,23,1,3,1,21],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,130,0,0,0,6,0,0],[4,0,131,0,0,0,6,0,0]]},{"c":"V15","n":"Lavado de Vehículos","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,126,0,0,1,3,0,0],[2,0,132,0,0,1,5,1,19],[2,0,133,0,0,1,5,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,134,0,0,10,5,0,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V16","n":"Mediciones Higiénicas","b":"Servicio","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,135,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,136,0,0,1,3,1,16],[2,0,137,0,0,6,3,1,0],[2,0,138,1,24,1,3,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,55,1,15,14,3,0,0],[4,0,57,0,0,0,1,0,3],[4,0,139,0,0,0,6,0,0]]},{"c":"V17","n":"Subcontratistas de Obra y Montaje","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,140,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,39,0,0,6,3,0,5],[2,0,40,0,0,10,3,0,0],[2,0,41,0,0,1,3,1,6],[2,0,42,1,11,1,3,0,4],[2,0,43,0,0,11,7,1,0],[2,0,141,0,0,11,7,1,0],[2,0,142,1,25,6,3,0,0],[2,0,143,0,0,19,3,1,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,0,45,0,0,6,3,0,11],[3,0,46,0,0,12,8,1,0],[3,0,47,0,0,12,8,1,0],[3,0,144,1,26,1,3,1,0],[3,0,145,0,0,4,8,0,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,146,0,0,0,6,0,0],[4,0,147,0,0,0,6,0,0]]},{"c":"V18","n":"Transporte de Personal / Alquiler de Vehículos","b":"Servicio","nivel":"Alto","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,148,1,27,1,0,1,18],[2,0,149,0,0,1,0,1,18],[2,0,44,1,12,1,3,0,12],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[3,1,150,1,28,1,0,1,18],[3,1,29,0,0,1,0,1,10],[3,1,30,0,0,1,0,1,10],[3,1,31,0,0,1,0,1,10],[3,1,32,1,9,1,0,0,0],[3,1,33,0,0,8,6,0,0],[3,2,34,0,0,1,3,1,10],[3,2,35,0,0,9,3,0,0],[3,2,36,1,10,1,3,0,0],[3,2,37,0,0,6,3,0,11],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V19","n":"Inspección y Certificación de Equipos de Izaje","b":"Servicio","nivel":"Intermedio","critico":true,"r":[[1,0,0,0,0,0,0,0,0],[1,0,151,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,152,0,0,1,3,1,0],[2,0,153,0,0,1,3,1,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[4,0,57,0,0,0,1,0,3],[4,0,154,0,0,0,6,0,0]]},{"c":"V20","n":"Calibración y Metrología","b":"Servicio","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,155,0,0,1,4,1,0],[4,0,57,0,0,0,1,0,3],[4,0,156,0,0,0,6,0,0]]},{"c":"V21","n":"Mantenimiento de Extintores y Sistemas Contra Incendio","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,157,0,0,1,3,0,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,158,0,0,0,6,0,0]]},{"c":"V22","n":"Gestión de Residuos No Peligrosos / Aprovechables","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,22,0,0,6,3,1,5],[2,0,23,0,0,6,3,0,6],[2,0,159,0,0,1,5,1,0],[3,0,27,0,0,4,3,1,8],[3,0,28,0,0,7,3,0,9],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0],[4,0,160,0,0,0,6,0,0]]},{"c":"V23","n":"Alimentación y Hospedaje","b":"Servicio","nivel":"Intermedio","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,126,0,0,1,3,1,0],[2,0,161,1,29,6,3,0,24],[2,0,162,1,30,1,0,1,0],[4,0,57,0,0,0,1,0,3],[4,0,58,0,0,0,6,0,0]]},{"c":"V24","n":"Servicios Profesionales y Consultoría","b":"Servicio","nivel":"Básico","critico":false,"r":[[1,0,0,0,0,0,0,0,0],[1,0,163,0,0,0,4,0,0],[2,0,1,0,0,1,0,1,1],[2,0,2,0,1,2,0,1,2],[2,0,3,0,0,1,0,0,0],[2,0,4,0,0,3,1,0,0],[2,0,164,1,31,1,4,0,0],[2,0,165,1,32,11,0,0,0],[3,0,166,1,33,4,1,1,0],[4,0,57,0,0,0,1,0,3],[4,0,167,0,0,0,6,0,0]]}]};

  const ETAPAS = { 1: '1. Cotización', 2: '2. Inicio relación comercial', 3: '3. Previo / durante / entrega', 4: '4. Cierre / legalización' };
  const ETAPA_CUANDO = {
    1: 'Selección · al recibir las ofertas, para compararlas',
    2: 'Selección · antes de aprobar al proveedor y emitir la orden de compra o contrato',
    3: 'Monitoreo · antes de iniciar el servicio o recibir el bien, y luego según la vigencia (mensual, por actividad, anual)',
    4: 'Monitoreo → evaluación · antes del pago; los soportes son evidencia para la reevaluación'
  };
  const NIVELES = {
    'Básico': { aplica: 'Bienes o servicios sin ingreso de personal a instalaciones u obra, o de bajo riesgo', base: 'RUT, Cámara de Comercio, cédula del representante legal, certificación bancaria y requisitos técnicos del producto' },
    'Intermedio': { aplica: 'Proveedores que ingresan a sitio en actividades de riesgo bajo o moderado', base: 'Básico + autoevaluación SG-SST, política SST, seguridad social mensual e inducción SSTA' },
    'Alto': { aplica: 'Alturas, izaje, sustancias químicas, residuos peligrosos, espacios confinados, transporte y obra', base: 'Intermedio + accidentalidad, EPP, matriz de peligros, SGA, póliza RCE, exámenes médicos, ATS y permisos de alto riesgo' }
  };
  /* Parámetros (umbrales, montos y periodicidades del procedimiento). */
  const PARAM = { confiable: 80, condicionado: 60, cajaMenor: 200000, montoJefe: 2000000, diasPlan: 30, mesesPlan: 6, mesesCritico: 6, mesesNoCritico: 12, ncExtraordinaria: 2 };

  /* Evaluación inicial (selección): ponderación bienes (b) y servicios / contratistas (s). Escala 1 a 5. */
  const INICIAL = [
    { c: '1. Cumplimiento de requisitos SSTA', d: 'Documentos legales, ARL, seguridad social, estándares mínimos', b: 0.15, s: 0.30, quien: 'Responsable de SST',
      esc: ['No presenta documentos SSTA (ARL, seguridad social, SG-SST).', 'Documentos incompletos o con inconsistencias.', 'Documentos completos con observaciones; autoevaluación Res. 0312 < 60%.', 'Documentos completos y vigentes; autoevaluación Res. 0312 entre 60% y 85%.', 'Documentos vigentes; autoevaluación Res. 0312 > 85% y certificaciones adicionales (ISO 45001, RUC).'] },
    { c: '2. Precio competitivo (precio-calidad)', d: 'Relación precio-calidad', b: 0.30, s: 0.20, quien: 'Compras',
      esc: ['> 20% sobre el promedio de cotizaciones sin justificación técnica.', '11% a 20% sobre el promedio.', 'Dentro de ±10% del promedio.', 'Entre 10% y 20% por debajo del promedio con calidad equivalente.', 'Mejor precio con calidad igual o superior y condiciones de pago favorables.'] },
    { c: '3. Calidad y especificaciones técnicas', d: 'Cumplimiento de las especificaciones', b: 0.25, s: 0.20, quien: 'Compras / área solicitante',
      esc: ['No cumple especificaciones mínimas.', 'Cumple parcialmente.', 'Cumple especificaciones básicas.', 'Cumple todas y aporta fichas técnicas / certificados.', 'Supera especificaciones; certificación de calidad, trazabilidad y garantía.'] },
    { c: '4. Tiempo de entrega ofrecido', d: 'Plazo frente a lo requerido', b: 0.15, s: 0.15, quien: 'Compras',
      esc: ['Plazo ofrecido no atiende la necesidad.', 'Plazo superior al requerido con impacto.', 'Plazo ajustado al requerido.', 'Plazo mejor que el requerido.', 'Entrega inmediata o disponibilidad en stock / respuesta en sitio.'] },
    { c: '5. Garantía, posventa y reclamaciones', d: 'Garantía, posventa y atención a reclamaciones', b: 0.10, s: 0.10, quien: 'Compras',
      esc: ['Sin garantía ni posventa.', 'Garantía mínima, sin canal de atención.', 'Garantía legal y canal básico.', 'Garantía extendida y respuesta < 5 días hábiles.', 'Garantía extendida, canal dedicado y soporte técnico en sitio.'] },
    { c: '6. Solidez financiera y trayectoria', d: 'Solidez financiera y trayectoria comercial', b: 0.05, s: 0.05, quien: 'Compras / Contabilidad',
      esc: ['Sin trayectoria verificable o antecedentes negativos.', 'Menos de 2 años o referencias desfavorables.', '2 a 5 años con referencias aceptables.', 'Más de 5 años y referencias positivas.', 'Trayectoria sólida, estados financieros sanos y referencias sobresalientes.'] }
  ];
  /* Reevaluación (desempeño real del periodo). */
  const REEV = [
    { c: '1. Cumplimiento SSTA durante la ejecución', p: 0.25, fuente: 'Listas de chequeo, inspecciones, incidentes', quien: 'Responsable de SST',
      esc: ['Incidente grave atribuible, más de un excluyente ★ vencido, o seguridad social verificada < 80%.', 'Un excluyente ★ vencido o seguridad social verificada 80–99%.', 'SS al 100%; > 30% de inspecciones con hallazgos.', 'SS al 100%; 11–30% de inspecciones con hallazgos.', 'SS al 100%; ≤ 10% de inspecciones con hallazgos y sin incidentes.'] },
    { c: '2. Calidad (no conformidades)', p: 0.25, fuente: 'Registro de NC, seguimiento de desempeño', quien: 'Compras',
      esc: ['> 20% de entregas con NC.', '11–20% con NC.', '6–10% con NC.', '1–5% con NC.', '0% de entregas con NC.'] },
    { c: '3. Cumplimiento en tiempos de entrega', p: 0.20, fuente: 'OC vs. fecha real de entrega', quien: 'Compras',
      esc: ['< 50% de entregas a tiempo.', '50–69% a tiempo.', '70–89% a tiempo.', '90–99% a tiempo.', '100% a tiempo.'] },
    { c: '4. Precio y condiciones comerciales mantenidas', p: 0.15, fuente: 'Comparación con cotizaciones de mercado', quien: 'Compras',
      esc: ['Incrementos injustificados > 20% o incumple condiciones pactadas.', 'Incrementos 11–20% sin justificación.', 'Mantiene precios de mercado.', 'Mantiene precios pactados y ofrece mejoras.', 'Descuentos, mejores condiciones de pago o precios congelados.'] },
    { c: '5. Atención a reclamaciones y posventa', p: 0.10, fuente: 'Tiempo de cierre de NC', quien: 'Compras',
      esc: ['Promedio de cierre de NC > 15 días hábiles o no atiende.', '11–15 días.', '6–10 días.', '3–5 días.', '≤ 2 días hábiles.'] },
    { c: '6. Cumplimiento documental (matriz de requisitos) y facturación', p: 0.05, fuente: '% requisitos vigentes según la matriz / Contabilidad', quien: 'Compras / Contabilidad',
      esc: ['Cumplimiento documental de la matriz < 70%.', '70–84%.', '85–94%.', '95–99%.', '100% de requisitos de la matriz vigentes y entregados a tiempo.'] }
  ];
  const ESCALA = ['Muy deficiente', 'Deficiente', 'Aceptable', 'Bueno', 'Excelente'];
  const TIPOS_REEV = ['ORDINARIA', 'SEGUIMIENTO A PLAN DE MEJORA', 'EXTRAORDINARIA'];
  const TIPOS_PROVEEDOR = ['Proveedor de bienes', 'Proveedor de servicios', 'Contratista'];
  /* Qué hacer con cada clasificación (procedimiento, numerales de selección y reevaluación). */
  const DECISION = {
    'CONFIABLE': 'Se puede comprar y/o contratar sin restricciones.',
    'CONDICIONADO': 'Se puede comprar y/o contratar con aprobación de Gerencia, dejando registradas las condiciones a cumplir; se prioriza en monitoreo.',
    'NO APTO': 'No se puede comprar ni contratar. Se informa al oferente.',
    'NO APTO (requisito excluyente)': 'No se puede comprar ni contratar: falta un requisito excluyente ★ (o la verificación SST / el conflicto de interés). Se informa al oferente.',
    'ACEPTABLE CON PLAN DE MEJORA': 'Continúa con seguimiento. Presenta plan de mejora en 30 días calendario; se reevalúa a los 6 meses. Si no mejora a ≥ 80%, pasa a decisión de Gerencia.',
    'RECHAZADO': 'Se retira de la base de datos por decisión de la Gerencia General. Se notifica formalmente. No podrá presentarse nuevamente durante 12 meses.'
  };

  const n = (x) => (x === '' || x == null || !isFinite(Number(x)) ? 0 : Number(x));
  const vacio = (x) => x === '' || x == null || (typeof x === 'number' && isNaN(x));
  const r2 = (x) => Math.round(x * 100) / 100;

  /* ── Fechas (AAAA-MM-DD) ── */
  function sumarMeses(iso, m) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
    const p = iso.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1 + m, p[2]));
    if (d.getUTCDate() !== p[2]) d.setUTCDate(0);   // como EDATE: 31 + 1 mes → último día del mes
    return d.toISOString().slice(0, 10);
  }
  function sumarDias(iso, k) { const p = iso.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + k)).toISOString().slice(0, 10); }

  /* ── NIT con dígito de verificación (DIAN: pesos 3, 7, 13, 17… sobre los dígitos de derecha a izquierda, módulo 11) ── */
  function dvNit(base) {
    const s = String(base == null ? '' : base).replace(/\D/g, '');
    if (!s || s.length > 15) return null;
    const P = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    let t = 0;
    for (let i = 0; i < s.length; i++) t += Number(s[s.length - 1 - i]) * P[i];
    const r = t % 11;
    return r > 1 ? 11 - r : r;
  }
  /** «900.123.456-7» → { ok, base, dv, texto, error }. Pide el dígito de verificación y lo comprueba. */
  function validarNit(v) {
    const s = String(v == null ? '' : v).replace(/[.\s,]/g, '');
    if (!s) return { ok: false, error: 'falta' };
    const m = /^(\d+)(?:-(\d))?$/.exec(s);
    if (!m) return { ok: false, error: 'solo números y el dígito de verificación (ej.: 900123456-7)' };
    const base = m[1];
    if (base.length < 6 || base.length > 10) return { ok: false, error: 'el NIT tiene de 6 a 10 dígitos antes del guion (tiene ' + base.length + ')' };
    if (/^(\d)\1+$/.test(base)) return { ok: false, error: 'no parece un NIT real' };
    const dv = dvNit(base);
    if (m[2] == null) return { ok: false, base, dv, error: 'falta el dígito de verificación (según el NIT es ' + base + '-' + dv + ')' };
    if (Number(m[2]) !== dv) return { ok: false, base, dv, error: 'el dígito de verificación no corresponde (para ' + base + ' es ' + dv + ')' };
    return { ok: true, base, dv, texto: base.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv, error: '' };
  }

  /* ── v109: NIT o cédula mientras se escribe ──
     La persona escribe solo los números (con o sin puntos) y el campo muestra «900123456-7»: el guion
     y el dígito de verificación (mismo cálculo DIAN de dvNit) se ponen solos desde 6 dígitos.
     prev = lo que devolvió la llamada anterior, para saber si el guion lo puso el portal o la persona:
     · escribir al final o en medio cambia el NIT y el dígito se recalcula;
     · borrar el dígito automático borra el último número del NIT;
     · si la persona escribe su propio dígito (o pega «900123456-5») y no corresponde, se avisa cuál es. */
  function nitEscribiendo(valor, prev) {
    const crudo = String(valor == null ? '' : valor), MIN = 6, MAX = 10;
    const letras = /[^\d.\-\s,]/.test(crudo);
    const v = crudo.replace(/[^\d-]/g, ''), partes = v.split('-');
    let base, dvEsc = '', manual = false;
    if (prev && prev.auto && prev.dv !== '' && prev.dv != null) {
      const pdv = String(prev.dv);
      if (partes.length === 1) base = v;
      else if (partes.length === 2) {
        const L = partes[0], R = partes[1];
        if (R === '') base = L === prev.base ? L.slice(0, -1) : L;          // borró el dígito automático
        else if (R === pdv) base = L;                                         // cambió un número del NIT
        else if (R.length > 1 && R[0] === pdv && L === prev.base) base = L + R.slice(1);   // escribió al final
        else { base = L; dvEsc = R.slice(0, 1); manual = true; }              // puso otro dígito o pegó «NIT-DV»
      } else { base = partes[0]; dvEsc = partes.slice(2).join('').slice(0, 1); manual = true; }   // escribió «-» después del dígito automático
    } else if (partes.length === 1) base = v;
    else { base = partes[0]; dvEsc = partes.slice(1).join('').slice(0, 1); manual = true; }
    const largo = base.length > MAX; base = base.slice(0, MAX);
    const dv = base.length >= MIN ? dvNit(base) : null;
    if (manual && dvEsc !== '' && dv != null && Number(dvEsc) === dv) manual = false;
    const auto = !manual, texto = auto ? base + (dv != null ? '-' + dv : '') : base + '-' + dvEsc;
    const mal = manual && dvEsc !== '' && dv != null && Number(dvEsc) !== dv;
    const aviso = mal ? 'El dígito de verificación de ' + base + ' es ' + dv + ' (escribiste ' + dvEsc + ').' :
      letras ? 'Solo números: el guion y el dígito de verificación se ponen solos.' : largo ? 'Máximo 10 dígitos antes del guion.' : '';
    return { texto, base, dv: dv == null ? '' : dv, dvEscrito: dvEsc, auto, mal, aviso, ok: dv != null && !mal && (auto || dvEsc !== '') };
  }

  /* ── Catálogo ── */
  function categoria(cod) { return C.CAT.find((x) => x.c === cod) || null; }
  function categorias() { return C.CAT.map((x) => ({ c: x.c, n: x.n, b: x.b, nivel: x.nivel, critico: x.critico, reevaluacion: x.critico ? 'Semestral' : 'Anual', requisitos: x.r.length, excluyentes: x.r.filter((q) => q[7]).length })); }
  /** Requisitos de una categoría: [{ k, i, etapa, etapaTexto, sub, req, texto, condicional, cond, aplica, vig, ver, excl, base }] */
  function requisitos(cod) {
    const c = categoria(cod); if (!c) return [];
    return c.r.map((q, i) => {
      const sub = C.SUB[q[1]], req = C.REQ[q[2]], cond = C.COND[q[4]];
      return { k: c.c + '|' + (i + 1), i: i + 1, etapa: q[0], etapaTexto: ETAPAS[q[0]], sub, req, texto: (sub && sub !== 'General' ? '[' + sub + '] ' : '') + req,
        condicional: !!q[3], cond, aplica: q[3] ? 'Si aplica: ' + cond : 'Siempre', vig: C.VIG[q[5]], ver: C.VER[q[6]], excl: !!q[7], base: C.BASE[q[8]] };
    });
  }
  const esBien = (tipoProveedor) => tipoProveedor === 'Proveedor de bienes';
  /** Pesos de la evaluación inicial según sea bien o servicio / contratista. */
  function pesos(tipoProveedor) { return INICIAL.map((x) => (esBien(tipoProveedor) ? x.b : x.s)); }
  function tipoSegunCategoria(cod) { const c = categoria(cod); return c ? (c.b === 'Bien' ? 'Proveedor de bienes' : 'Proveedor de servicios') : ''; }

  /* ── Documentos de la matriz (marcas: { k: { e: 'Sí'|'No'|'N.A.', v: 'AAAA-MM-DD' } }) ──
     Resultado de los excluyentes ★ de las etapas pedidas: NO CUMPLE si alguno está en No (o en N.A.
     sin ser condicional), PENDIENTE si alguno está sin marcar, CUMPLE si no. % = Sí ÷ (aplicables − N.A.). */
  function revisarDocs(reqs, marcas, etapas, hoy) {
    marcas = marcas || {};
    const l = reqs.filter((q) => !etapas || etapas.indexOf(q.etapa) !== -1);
    const est = (q) => { const m = marcas[q.k] || {}; if (m.e === 'Sí' && hoy && m.v && m.v < hoy) return 'Vencido'; return m.e || ''; };
    const faltan = [], pendientes = [], vencidos = [], naObligatorio = [];
    let si = 0, na = 0;
    l.forEach((q) => {
      const e = est(q);
      if (e === 'Sí') si++;
      if (e === 'N.A.') { na++; if (!q.condicional) naObligatorio.push(q.texto); }
      if (e === 'Vencido') vencidos.push(q.texto);
      if (q.excl && (e === 'No' || e === 'Vencido' || (e === 'N.A.' && !q.condicional))) faltan.push(q.texto);
      if (q.excl && !e) pendientes.push(q.texto);
    });
    const den = l.length - na;
    return { estado: faltan.length ? 'NO CUMPLE' : pendientes.length ? 'PENDIENTE' : 'CUMPLE', faltan, pendientes, vencidos, naObligatorio,
      total: l.length, si, pct: den > 0 ? Math.round(si * 1000 / den) / 10 : null };
  }
  /** Sección C del formato: excluyentes de la matriz + verificación SST/ambiental + sin conflicto de interés. */
  function excluyentesInicial(docs, sstVerificada, sinConflicto) {
    if (docs.estado === 'NO CUMPLE' || sstVerificada === 'No' || sinConflicto === 'No') return 'NO CUMPLE';
    if (docs.estado !== 'CUMPLE' || !sstVerificada || !sinConflicto) return 'PENDIENTE';
    return 'CUMPLE';
  }

  /* ── Puntaje: Σ (calificación × ponderación), sobre 5; porcentaje = puntaje ÷ 5 ── */
  function puntaje(cals, ps) {
    if (!Array.isArray(cals) || cals.length !== ps.length || cals.some((c) => !(Number(c) >= 1 && Number(c) <= 5))) return null;
    const s = cals.reduce((t, c, i) => t + Number(c) * ps[i], 0);
    return { sobre5: Math.round(s * 10000) / 10000, pct: r2(s * 20) };   // redondeado: 3,9999999 no puede quedar en 79,99 %
  }
  function clasificarInicial(pct, excl) {
    if (excl === 'NO CUMPLE') return 'NO APTO (requisito excluyente)';
    if (pct == null || excl !== 'CUMPLE') return 'PENDIENTE';
    return pct >= PARAM.confiable ? 'CONFIABLE' : pct >= PARAM.condicionado ? 'CONDICIONADO' : 'NO APTO';
  }
  function clasificarReev(pct) {
    if (pct == null) return 'PENDIENTE';
    return pct >= PARAM.confiable ? 'CONFIABLE' : pct >= PARAM.condicionado ? 'ACEPTABLE CON PLAN DE MEJORA' : 'RECHAZADO';
  }
  /** Para el semáforo: 'ok' | 'pronto' | 'mal' | 'gris'. */
  function color(clasif) {
    const c = String(clasif || '');
    if (c === 'CONFIABLE' || c === 'Aprobado') return 'ok';
    if (/^(CONDICIONADO|ACEPTABLE|Aprobado con)/.test(c)) return 'pronto';
    if (/^(NO APTO|RECHAZADO|No aprobado)/.test(c)) return 'mal';
    return 'gris';
  }
  const malo = (clasif) => color(clasif) === 'mal';
  const conPlan = (clasif) => color(clasif) === 'pronto';

  /* ── Aprobación y cotizaciones según el monto (evaluación inicial) ── */
  function aprobacion(monto, critico) {
    if (vacio(monto)) return '';
    if (Number(monto) <= PARAM.cajaMenor) return 'Caja menor – no aplica evaluación';
    return critico || Number(monto) > PARAM.montoJefe ? 'Gerencia General' : 'Jefe de proyectos o del área';
  }
  function cotizacionesMinimas(monto) { if (vacio(monto)) return null; return Number(monto) <= PARAM.cajaMenor ? 0 : Number(monto) > PARAM.montoJefe ? 3 : 2; }

  /* ── Reevaluación: indicadores de las evidencias y calificación sugerida ──
     e = { entregas, aTiempo, conNC, diasCierre, mesesLabor, mesesSS, inspecciones, conHallazgos,
           incidentes, reqAplicables, reqVencidos, exclVencidos } (números o '') */
  function indicadores(e) {
    e = e || {};
    const div = (a, b) => (vacio(b) || n(b) === 0 ? null : n(a) / n(b));
    const pctDoc = vacio(e.reqAplicables) || n(e.reqAplicables) === 0 ? null : Math.max(0, 1 - n(e.reqVencidos) / n(e.reqAplicables));
    return { aTiempo: div(e.aTiempo, e.entregas), nc: div(e.conNC, e.entregas), ss: div(e.mesesSS, e.mesesLabor), hallazgos: div(e.conHallazgos, e.inspecciones), doc: pctDoc };
  }
  /** Las 6 calificaciones sugeridas (número 1–5, '' si faltan datos, 'Manual' si no hay cómo calcularla). */
  function sugeridas(e) {
    e = e || {};
    const I = indicadores(e), h = (x) => (n(x) > 0.3 ? 3 : n(x) > 0.1 ? 4 : 5);
    const sst = vacio(e.entregas) ? '' : (n(e.incidentes) > 0 || n(e.exclVencidos) > 1) ? 1 : n(e.exclVencidos) === 1 ? 2 :
      I.ss != null ? (I.ss < 0.8 ? 1 : I.ss < 1 ? 2 : h(I.hallazgos)) : h(I.hallazgos);
    const cal = I.nc == null ? '' : I.nc === 0 ? 5 : I.nc <= 0.05 ? 4 : I.nc <= 0.1 ? 3 : I.nc <= 0.2 ? 2 : 1;
    const tie = I.aTiempo == null ? '' : I.aTiempo >= 1 ? 5 : I.aTiempo >= 0.9 ? 4 : I.aTiempo >= 0.7 ? 3 : I.aTiempo >= 0.5 ? 2 : 1;
    const rec = vacio(e.conNC) ? '' : n(e.conNC) === 0 ? 5 : vacio(e.diasCierre) ? '' : n(e.diasCierre) <= 2 ? 5 : n(e.diasCierre) <= 5 ? 4 : n(e.diasCierre) <= 10 ? 3 : n(e.diasCierre) <= 15 ? 2 : 1;
    const doc = I.doc == null ? 'Manual' : I.doc >= 1 ? 5 : I.doc >= 0.95 ? 4 : I.doc >= 0.85 ? 3 : I.doc >= 0.7 ? 2 : 1;
    return [sst, cal, tie, 'Manual', rec, doc];
  }
  /** Calificación final de cada criterio: la asignada si la hay; si no, la sugerida (si es número). */
  function finales(sug, asignadas) { return sug.map((s, i) => { const a = asignadas && asignadas[i]; return !vacio(a) ? Number(a) : typeof s === 'number' ? s : null; }); }
  /** Errores de coherencia de las evidencias (lo que el formato marca como alerta). */
  function incoherencias(e) {
    e = e || {}; const l = [];
    if (n(e.aTiempo) > n(e.entregas)) l.push('Entregas a tiempo > total de entregas');
    if (n(e.conNC) > n(e.entregas)) l.push('Entregas con no conformidad > total de entregas');
    if (n(e.mesesSS) > n(e.mesesLabor)) l.push('Meses con seguridad social verificada > meses con personal en labor');
    if (n(e.conHallazgos) > n(e.inspecciones)) l.push('Inspecciones con hallazgos > inspecciones realizadas');
    if (n(e.reqVencidos) > n(e.reqAplicables)) l.push('Requisitos vencidos > requisitos aplicables');
    return l;
  }
  /** ¿Activa reevaluación extraordinaria? (≥ 2 NC, incidente grave, ★ vencido o seguridad social sin verificar algún mes) */
  function alertaExtraordinaria(e) {
    e = e || {}; const I = indicadores(e);
    return n(e.conNC) >= PARAM.ncExtraordinaria || n(e.incidentes) > 0 || n(e.exclVencidos) > 0 || (I.ss != null && I.ss < 1);
  }
  function accionReev(clasif, anterior) {
    if (clasif === 'CONFIABLE') return 'Continúa en la base de datos.' + (anterior === 'CONFIABLE' ? ' Candidato a homologación: proponer a Gerencia.' : '');
    if (clasif === 'ACEPTABLE CON PLAN DE MEJORA') return 'Continúa con seguimiento. Solicitar plan de mejora y reevaluar.';
    if (clasif === 'RECHAZADO') return 'Retirar de la base de datos (aprobación Gerencia). Notificar formalmente. No podrá presentarse por 12 meses.';
    return '';
  }

  /* ── Periodicidad y próxima evaluación ── */
  function periodicidad(critico) { return critico ? 'Semestral' : 'Anual'; }
  /** Próxima evaluación: crítico cada 6 meses, no crítico cada 12, condicionado / con plan de mejora a los 6; rechazado o no apto: no se programa. */
  function proxima(fecha, clasif, critico) {
    if (!fecha || !clasif || clasif === 'PENDIENTE' || malo(clasif)) return '';
    return sumarMeses(fecha, conPlan(clasif) ? PARAM.mesesPlan : critico ? PARAM.mesesCritico : PARAM.mesesNoCritico);
  }
  function estadoReev(prox, hoy, clasif) {
    if (malo(clasif)) return 'N.A. – retirado';
    if (!prox) return '';
    if (prox < hoy) return 'VENCIDA';
    if (prox <= sumarDias(hoy, 30)) return 'Próxima (≤30 días)';
    return 'Vigente';
  }
  function limitePlan(fecha) { return fecha ? sumarDias(fecha, PARAM.diasPlan) : ''; }
  /** Dos clasificaciones CONFIABLE seguidas (inicial o reevaluación) → candidato a la lista de homologados. */
  function candidatoHomologacion(evals) {
    const l = (evals || []).filter((x) => x && x.clasificacion && x.clasificacion !== 'PENDIENTE').slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    return l.length >= 2 && l[l.length - 1].clasificacion === 'CONFIABLE' && l[l.length - 2].clasificacion === 'CONFIABLE';
  }

  /* ── Cronograma anual: ● programada · ✔ ejecutada · ⚠ vencida ──
     p = { proxima, critico, evaluaciones: [{ fecha }] }. Meses programados: el de la próxima evaluación y,
     si es semestral, seis meses después (si caen en el año). Vencida: el día 28 de ese mes ya pasó. */
  function cronograma(p, anio, hoy) {
    const meses = {};
    (p.evaluaciones || []).forEach((x) => { const f = String(x.fecha || ''); if (f.slice(0, 4) === String(anio)) meses[Number(f.slice(5, 7))] = '✔'; });
    const marcar = (iso) => { if (!iso || iso.slice(0, 4) !== String(anio)) return; const m = Number(iso.slice(5, 7)); if (meses[m] === '✔') return;
      meses[m] = (String(anio) + '-' + String(m).padStart(2, '0') + '-28') < hoy ? '⚠' : '●'; };
    if (p.proxima) { marcar(p.proxima); if (p.critico) marcar(sumarMeses(p.proxima, 6)); }
    const v = Object.values(meses);
    return { meses, estado: v.indexOf('⚠') !== -1 ? 'VENCIDA' : v.indexOf('✔') !== -1 ? 'Ejecutada' : v.indexOf('●') !== -1 ? 'Programada' : '' };
  }

  /** Texto del correo para pedir los documentos de una categoría (★ = indispensable). */
  function plantillaCorreo(cod, empresa, correo) {
    const c = categoria(cod); if (!c) return '';
    const l = requisitos(cod), por = {};
    l.forEach((q) => { (por[q.etapa] = por[q.etapa] || []).push(q); });
    return 'Asunto: Solicitud de documentos – ' + c.n + ' – ' + (empresa || 'la empresa') + '\n\nBuen día,\n\nPara avanzar en el proceso de vinculación como proveedor de «' + c.n + '», agradecemos remitir la siguiente documentación completa, vigente y legible' + (correo ? ' al correo ' + correo : '') + ':\n\n' +
      Object.keys(por).sort().map((et) => ETAPAS[et].toUpperCase() + '\n' + por[et].map((q) => '- ' + q.texto + (q.condicional ? ' (si aplica: ' + q.cond.toLowerCase() + ')' : '') + (q.vig ? ' – vigencia: ' + q.vig : '') + (q.excl ? ' ★' : '')).join('\n')).join('\n\n') +
      '\n\n★ Documento indispensable: sin él no es posible continuar el proceso.\n\nCordialmente,\nCompras – ' + (empresa || '');
  }

  /* ── v109: ingreso de un proveedor nuevo por etapas (proceso «compraprov») ──
     1 Necesidad → 2 Cotizaciones (aquí se puede detener: «En cotización») → 3 Selección →
     4 Requisitos y documentos (★ de etapas 1 y 2) → 5 Evaluación inicial → 6 Decisión y alta en la matriz.
     p = { necesidad, area, solicitud, fecha, responsable, monto, categoria, categoriaNombre, categoriaBase, nivel, critico, tipoProveedor,
           unico, unicoJust, cotizaciones: [{ uid, nombre, nit, contacto, telefono, correo, valor, plazo, formaPago, garantia, garantiaDetalle, cumpleSst, excl: { k: true }, obs, estado }],
           elegida, justificacion, firmasComp: { elaboro: { nombre, cargo }, aprobo }, seleccion: { tipoPersona, ciudad, contacto, correo, telefono, proveedorExistente },
           marcas, evaluacion, decision: { resultado, fecha, aprobo: { nombre, cargo }, condiciones, observaciones }, cerrado, anulado, proveedorId } */
  const ETAPAS_ALTA = ['Necesidad', 'Cotizaciones', 'Selección', 'Requisitos y documentos', 'Evaluación inicial', 'Decisión y alta'];
  const ESTADO_ETAPA = ['Necesidad', 'En cotización', 'En selección', 'Revisión de documentos', 'En evaluación', 'Por aprobar'];
  const FORMAS_PAGO = ['Contado', 'Crédito 30 días', 'Crédito 45 días', 'Crédito 60 días', 'Anticipo y saldo contra entrega', 'Contra entrega'];
  const txt = (x) => String(x == null ? '' : x).trim();
  const tieneLetras = (x) => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(txt(x));
  const baseCat = (p) => (p.categoria === 'OTRO' ? p.categoriaBase : p.categoria);
  const correoOk = (c) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(txt(c));
  const telOk = (t) => { const d = String(t || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, ''); return d.length >= 7 && d.length <= 10; };
  const esNum = (x, min) => !vacio(x) && isFinite(Number(x)) && Number(x) >= (min || 0);
  /** Cotizaciones que pide el procedimiento según el monto (mínimo 1; proveedor único: 1). */
  function cotMinimasProc(p) { if (p.unico) return 1; const m = cotizacionesMinimas(p.monto); return m == null ? 2 : Math.max(1, m); }
  /** Lo que le falta a una cotización: [{ c: campo, e: error }]. */
  function faltaCot(c) {
    c = c || {}; const l = [], nit = validarNit(c.nit);
    if (!tieneLetras(c.nombre) || txt(c.nombre).length < 3) l.push({ c: 'nombre', e: 'falta la razón social' });
    if (!nit.ok) l.push({ c: 'nit', e: 'NIT: ' + nit.error });
    if (!(esNum(c.valor) && Number(c.valor) > 0)) l.push({ c: 'valor', e: 'falta el valor' });
    if (!(esNum(c.plazo) && Number.isInteger(Number(c.plazo)))) l.push({ c: 'plazo', e: 'falta el plazo de entrega (días)' });
    if (!txt(c.formaPago)) l.push({ c: 'formaPago', e: 'falta la forma de pago' });
    if (!esNum(c.garantia)) l.push({ c: 'garantia', e: 'falta la garantía en meses (0 si no ofrece)' });
    if (c.cumpleSst !== 'Sí' && c.cumpleSst !== 'No') l.push({ c: 'cumpleSst', e: 'falta decir si cumple la especificación SST' });
    return l;
  }
  const cotOk = (c) => !faltaCot(c).length && c.estado !== 'No apto';
  /** Requisitos ★ de las etapas 1 y 2 de la categoría del proceso (los que se piden para contratar). */
  const exclContratar = (p) => requisitos(baseCat(p)).filter((q) => q.etapa <= 2 && q.excl);
  /** Cuadro comparativo: puntaje con los pesos de la evaluación inicial (precio, plazo, garantía y SST/★),
      el más conveniente entre los que cumplen la especificación SST y cuál es el más barato. */
  function comparar(p) {
    const ex = exclContratar(p), ps = pesos(p.tipoProveedor || tipoSegunCategoria(baseCat(p)) || 'Proveedor de servicios');
    const w = { sst: ps[0], precio: ps[1], plazo: ps[3], garantia: ps[4] }, sw = w.sst + w.precio + w.plazo + w.garantia;
    const l = (p.cotizaciones || []).filter((c) => !faltaCot(c).length);
    if (!l.length) return { filas: [], recomendado: null, masBarato: null, promedio: null, totalExcl: ex.length };
    const vals = l.map((c) => Number(c.valor)), minV = Math.min.apply(null, vals), minP = Math.min.apply(null, l.map((c) => Number(c.plazo))), maxG = Math.max.apply(null, l.map((c) => Number(c.garantia)));
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    const filas = l.map((c) => {
      const nEx = ex.filter((q) => (c.excl || {})[q.k]).length, cumple = c.cumpleSst === 'Sí' && c.estado !== 'No apto';
      const pts = (w.precio * (minV / Number(c.valor)) + w.plazo * ((minP + 1) / (Number(c.plazo) + 1)) + w.garantia * (maxG > 0 ? Number(c.garantia) / maxG : 1) + w.sst * (ex.length ? nEx / ex.length : 1) + (cumple ? 0 : -w.sst)) / sw * 100;
      return { uid: c.uid, nombre: c.nombre, nit: c.nit, valor: Number(c.valor), plazo: Number(c.plazo), garantia: Number(c.garantia), formaPago: c.formaPago, cumple, noApto: c.estado === 'No apto', nExcl: nEx, totalExcl: ex.length,
        puntaje: Math.max(0, Math.round(pts * 10) / 10), vsPromedio: prom ? Math.round((Number(c.valor) - prom) / prom * 1000) / 10 : 0, masBarato: Number(c.valor) === minV, masRapido: Number(c.plazo) === minP, mayorGarantia: maxG > 0 && Number(c.garantia) === maxG };
    });
    const apt = filas.filter((f) => f.cumple).sort((a, b) => b.puntaje - a.puntaje || a.valor - b.valor);
    const rec = apt.length ? apt[0].uid : null;
    filas.forEach((f) => { f.recomendado = f.uid === rec; });
    return { filas, recomendado: rec, masBarato: (filas.find((f) => f.masBarato) || {}).uid || null, promedio: Math.round(prom), totalExcl: ex.length };
  }
  /** Calificación sugerida del criterio «precio competitivo» de la evaluación inicial, según el promedio de cotizaciones. */
  function sugerirPrecio(valor, valores) {
    const l = (valores || []).map(Number).filter((x) => x > 0); if (l.length < 2 || !(Number(valor) > 0)) return null;
    const prom = l.reduce((a, b) => a + b, 0) / l.length, d = (Number(valor) - prom) / prom, esMin = Number(valor) === Math.min.apply(null, l);
    return d > 0.2 ? 1 : d > 0.1 ? 2 : d >= -0.1 ? (esMin ? 4 : 3) : esMin ? 5 : 4;
  }
  function decisionDe(clasif) { const c = color(clasif); return c === 'ok' ? 'Aprobado' : c === 'pronto' ? 'Condicionado' : c === 'mal' ? 'No apto' : ''; }
  /** Lo que falta para terminar la etapa n: [{ campo, etiqueta, error }] (vacío = puede seguir). */
  function faltaEtapa(p, n) {
    p = p || {}; const f = [], add = (campo, etiqueta, error) => f.push({ campo, etiqueta, error });
    if (n === 1) {
      if (!tieneLetras(p.necesidad) || txt(p.necesidad).length < 5) add('necesidad', 'Qué se va a comprar o contratar', txt(p.necesidad) ? 'descríbelo mejor' : 'falta');
      if (!p.categoria) add('categoria', 'Categoría', 'falta');
      if (p.categoria === 'OTRO') {
        if (!tieneLetras(p.categoriaNombre)) add('categoriaNombre', 'Nombre de la categoría', 'falta');
        if (!categoria(p.categoriaBase)) add('categoriaBase', 'Categoría más parecida', 'falta');
        if (!NIVELES[p.nivel]) add('nivel', 'Nivel de riesgo', 'falta');
        if (p.critico !== true && p.critico !== false) add('critico', 'Criticidad', 'falta');
      }
      if (TIPOS_PROVEEDOR.indexOf(p.tipoProveedor) === -1) add('tipoProveedor', 'Tipo', 'falta');
      if (!esNum(p.monto)) add('monto', 'Monto estimado', 'falta');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha || ''))) add('fecha', 'Fecha de la solicitud', 'falta');
    }
    if (n === 2) {
      const cs = p.cotizaciones || [], min = cotMinimasProc(p), ok = cs.filter(cotOk);
      if (p.unico && (!tieneLetras(p.unicoJust) || txt(p.unicoJust).length < 10)) add('unicoJust', 'Proveedor único', 'explica por qué solo hay un proveedor');
      cs.forEach((c, i) => faltaCot(c).forEach((x) => add('cot:' + i + ':' + x.c, 'Cotización ' + (i + 1) + (txt(c.nombre) ? ' (' + txt(c.nombre) + ')' : ''), x.e)));
      const vistos = {};
      cs.forEach((c, i) => { const b = validarNit(c.nit).base; if (!b) return; if (vistos[b] != null) add('cot:' + i + ':nit', 'Cotización ' + (i + 1), 'tiene el mismo NIT que la cotización ' + (vistos[b] + 1) + ': deben ser proveedores distintos'); else vistos[b] = i; });
      if (ok.length < min) add('cotAdd', 'Cotizaciones', 'van ' + ok.length + ' de ' + min + ' completas (el procedimiento pide ' + min + (p.unico ? ', proveedor único' : ' por el monto') + ')');
      else {
        const el = cs.find((c) => c.uid === p.elegida), cmp = comparar(p);
        if (!el || !cotOk(el)) add('elegida', 'Elección', 'elige el proveedor en el cuadro comparativo');
        else {
          if (el.cumpleSst !== 'Sí') add('elegida', 'Elección', 'el elegido no cumple la especificación SST: elige otro');
          const barato = cmp.masBarato === el.uid, rec = cmp.recomendado === el.uid;
          if (!tieneLetras(p.justificacion) || txt(p.justificacion).length < (barato && rec ? 10 : 25))
            add('justificacion', 'Justificación de la elección', !barato ? 'no es el más barato: explica por qué se elige' : !rec ? 'no es el más conveniente del cuadro: explica por qué' : 'falta');
        }
      }
      if (!tieneLetras(((p.firmasComp || {}).elaboro || {}).nombre)) add('firmasComp.elaboro.nombre', 'Elaboró el cuadro comparativo', 'falta el nombre');
    }
    if (n === 3) {
      const s = p.seleccion || {};
      if (!tieneLetras(s.contacto)) add('seleccion.contacto', 'Contacto del proveedor', 'falta');
      if (!correoOk(s.correo)) add('seleccion.correo', 'Correo del proveedor', txt(s.correo) ? 'no es un correo válido' : 'falta');
      if (!telOk(s.telefono)) add('seleccion.telefono', 'Teléfono del proveedor', txt(s.telefono) ? 'escribe un teléfono de 7 a 10 dígitos' : 'falta');
      if (s.tipoPersona !== 'Jurídica' && s.tipoPersona !== 'Natural') add('seleccion.tipoPersona', 'Persona', 'falta');
    }
    if (n === 4) exclContratar(p).forEach((q) => { if (!((p.marcas || {})[q.k] || {}).e) add('rq:' + q.k, '★ ' + q.texto, 'márcalo (Sí, No o N.A.)'); });
    if (n === 5 && !p.evaluacion) add('evaluacion', 'Evaluación inicial', 'falta calificarla y guardarla');
    if (n === 6) {
      const d = p.decision || {};
      if (!d.resultado) add('decision', 'Decisión', 'falta');
      if (d.resultado && d.resultado !== 'No apto' && !tieneLetras((d.aprobo || {}).nombre)) add('decision.aprobo.nombre', 'Quién aprueba', 'falta el nombre');
      if (d.resultado === 'Condicionado' && (!tieneLetras(d.condiciones) || txt(d.condiciones).length < 10)) add('decision.condiciones', 'Condiciones a cumplir', 'falta');
      if (!p.cerrado) add('cerrar', 'Alta en la matriz', d.resultado === 'No apto' ? 'cierra el proceso o elige otro candidato' : 'falta darlo de alta');
    }
    return f;
  }
  /** Primera etapa sin terminar (1 a 6); 7 = proceso cerrado (o anulado). */
  function etapaAlta(p) { if (p && (p.cerrado || p.anulado)) return 7; for (let n = 1; n <= 6; n++) if (faltaEtapa(p, n).length) return n; return 7; }
  /** Lo que va en la lista: «En cotización · 2 de 3 cotizaciones», el elegido y el resultado. */
  function resumenAlta(p) {
    const e = etapaAlta(p), cs = p.cotizaciones || [], el = cs.find((c) => c.uid === p.elegida), min = cotMinimasProc(p), ok = cs.filter(cotOk).length;
    const estado = p.anulado ? 'Anulado' : p.cerrado ? ((p.decision || {}).resultado || 'Cerrado') : ESTADO_ETAPA[e - 1];
    const detalle = p.anulado || p.cerrado ? '' : e === 2 ? ok + ' de ' + min + ' cotizaciones' : 'Etapa ' + e + ' de 6: ' + ETAPAS_ALTA[e - 1].toLowerCase();
    return { etapa: e, estadoProceso: estado, detalleEtapa: detalle, nCotizaciones: ok, cotMinimas: min, elegido: el ? txt(el.nombre) : '', elegidoNit: el ? (validarNit(el.nit).texto || txt(el.nit)) : '',
      valorElegido: el && esNum(el.valor) ? Number(el.valor) : '', resultado: p.evaluacion ? p.evaluacion.clasificacion : '',
      candidatos: cs.filter((c) => txt(c.nombre)).map((c) => txt(c.nombre) + (c.uid === p.elegida ? ' (elegido)' : '')) };
  }

  return { C, ETAPAS, ETAPA_CUANDO, NIVELES, PARAM, INICIAL, REEV, ESCALA, TIPOS_REEV, TIPOS_PROVEEDOR, DECISION,
    ETAPAS_ALTA, ESTADO_ETAPA, FORMAS_PAGO, nitEscribiendo, cotMinimasProc, faltaCot, exclContratar, comparar, sugerirPrecio, decisionDe, faltaEtapa, etapaAlta, resumenAlta,
    sumarMeses, dvNit, validarNit, categoria, categorias, requisitos, esBien, pesos, tipoSegunCategoria, revisarDocs, excluyentesInicial,
    puntaje, clasificarInicial, clasificarReev, color, aprobacion, cotizacionesMinimas, indicadores, sugeridas, finales, incoherencias,
    alertaExtraordinaria, accionReev, periodicidad, proxima, estadoReev, limitePlan, candidatoHomologacion, cronograma, plantillaCorreo };
})();
if (typeof module !== 'undefined') module.exports = Proveedores;
