/* ============================================================
   gtc45-catalogo.js — Catálogo de peligros de la GTC 45 (2012)
   ------------------------------------------------------------
   Lo usan la matriz de peligros (peligros.html: asistente con
   sugerencias) y la encuesta de percepción de los trabajadores
   (percepcion-peligros.html, pública).

   Por cada clase de la GTC 45 (Anexo A) y cada tipo de peligro:
     simple      cómo se le pregunta al trabajador (palabras de obra)
     desc        descripción típica para la matriz
     efectos     efectos posibles en la salud
     existentes  controles que suelen existir (fuente / medio / individuo)
     controles   medidas por jerarquía (eliminacion, sustitucion,
                 ingenieria, administrativos, epp)
     legal       norma colombiana de referencia
   Lo que no trae el tipo lo toma de la clase (base).
   Son SUGERENCIAS: cada empresa las ajusta a su realidad.
   ============================================================ */
const GTC45 = (function () {
  const C = [
    { id: 'biologico', nombre: 'Biológico', color: '#2f7d4f',
      desc: 'Virus, bacterias, hongos, ricketsias, parásitos, picaduras, mordeduras, fluidos o excrementos.',
      simple: 'Contacto con microbios, animales, insectos, sangre, fluidos, basuras o aguas sucias.',
      base: { efectos: 'Infecciones, alergias, enfermedades respiratorias, gastrointestinales o de la piel.',
        existentes: { fuente: ['Limpieza y desinfección de áreas'], medio: ['Ventilación natural'], individuo: ['Guantes de nitrilo', 'Lavado de manos'] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: ['Barreras físicas y ventilación de áreas', 'Puntos de lavado de manos con agua y jabón'],
          administrativos: ['Programa de orden, aseo, limpieza y desinfección', 'Esquema de vacunación según el riesgo', 'Protocolo de manejo de residuos biológicos', 'Capacitación en higiene y autocuidado'],
          epp: ['Guantes de nitrilo', 'Tapabocas o respirador N95 según la tarea', 'Gafas de seguridad'] },
        legal: 'Res. 2400 de 1979' },
      tipos: [
        { nombre: 'Virus', simple: 'Gripas, COVID u otros virus por contacto con personas o superficies.', desc: 'Exposición a virus por contacto con personas, superficies o ambientes cerrados.', efectos: 'Infecciones respiratorias agudas, gripe, COVID-19, hepatitis (según la fuente).' },
        { nombre: 'Bacterias', simple: 'Basuras, baños, aguas sucias, alimentos o residuos.', desc: 'Exposición a bacterias en residuos, aguas residuales, baños o alimentos.', efectos: 'Infecciones gastrointestinales, de la piel o respiratorias; tétanos por heridas contaminadas.' },
        { nombre: 'Hongos', simple: 'Humedad, moho, bodegas cerradas o material vegetal.', desc: 'Exposición a hongos por humedad, moho o material orgánico almacenado.', efectos: 'Alergias, micosis de la piel, afecciones respiratorias.' },
        { nombre: 'Ricketsias', simple: 'Garrapatas, pulgas o piojos de animales.', desc: 'Exposición a ricketsias transmitidas por garrapatas, pulgas o piojos.', efectos: 'Fiebre, rickettsiosis.' },
        { nombre: 'Parásitos', simple: 'Agua no potable, tierra o zonas con animales.', desc: 'Exposición a parásitos por agua no potable, suelos contaminados o animales.', efectos: 'Parasitosis intestinal, infecciones de la piel.' },
        { nombre: 'Picaduras', simple: 'Zancudos, abejas, avispas, arañas o alacranes.', desc: 'Picaduras de insectos o arácnidos en zonas verdes, bodegas o trabajos a campo abierto.', efectos: 'Reacciones alérgicas, choque anafiláctico, dengue, malaria (zonas endémicas).',
          controles: { ingenieria: ['Fumigación y control de plagas programado'], administrativos: ['Inspección del área antes de iniciar', 'Identificar trabajadores alérgicos y botiquín con antihistamínico prescrito'], epp: ['Repelente', 'Ropa de manga larga'] } },
        { nombre: 'Mordeduras', simple: 'Perros, roedores, serpientes u otros animales.', desc: 'Mordeduras de animales (perros, roedores, serpientes) en sitios de trabajo.', efectos: 'Heridas, infecciones, rabia, envenenamiento.',
          controles: { ingenieria: ['Control de roedores y cerramientos'], administrativos: ['Inspección del área y protocolo ante mordeduras', 'No manipular animales'], epp: ['Botas de caña alta en zonas verdes'] } },
        { nombre: 'Fluidos o excrementos', simple: 'Sangre, vómito, orina, heces o palomas.', desc: 'Contacto con fluidos corporales, excrementos de animales o aves.', efectos: 'Hepatitis B y C, VIH, histoplasmosis, infecciones gastrointestinales.',
          controles: { administrativos: ['Protocolo de limpieza de fluidos y kit de bioseguridad', 'Vacunación contra hepatitis B y tétanos'], epp: ['Guantes de nitrilo', 'Monogafas', 'Respirador N95 al limpiar excrementos de aves'] } }
      ] },
    { id: 'fisico', nombre: 'Físico', color: '#2d6aa3',
      desc: 'Ruido, iluminación, vibración, temperaturas extremas, presión atmosférica, radiaciones ionizantes y no ionizantes.',
      simple: 'Ruido fuerte, poca luz, vibraciones, mucho calor o frío, radiación.',
      base: { efectos: 'Afecciones por exposición a agentes físicos.', existentes: { fuente: ['Mantenimiento de equipos'], medio: [], individuo: [] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: [], administrativos: ['Mediciones higiénicas del agente', 'Exámenes médicos con énfasis según el agente'], epp: [] }, legal: 'Res. 2400 de 1979' },
      tipos: [
        { nombre: 'Ruido', simple: 'Máquinas o herramientas que no dejan hablar normal a un metro.', desc: 'Exposición a ruido continuo o de impacto generado por máquinas, herramientas o procesos.', efectos: 'Hipoacusia neurosensorial, tinnitus, estrés, cefalea, interferencia en la comunicación.',
          existentes: { fuente: ['Mantenimiento preventivo de máquinas'], medio: ['Señalización de uso obligatorio de protección auditiva'], individuo: ['Protectores auditivos de inserción'] },
          controles: { sustitucion: ['Cambiar por equipos o herramientas de menor emisión de ruido'], ingenieria: ['Encerramientos, silenciadores y amortiguadores en la fuente', 'Barreras acústicas o cabinas'], administrativos: ['Sonometría y dosimetría de ruido', 'Programa de conservación auditiva (audiometrías)', 'Rotación para reducir el tiempo de exposición'], epp: ['Protectores auditivos de inserción o tipo copa según la atenuación requerida'] }, legal: 'Res. 2400 de 1979; Res. 1792 de 1990' },
        { nombre: 'Iluminación', simple: 'Poca luz, luz que encandila o reflejos que no dejan ver bien.', desc: 'Iluminación deficiente o en exceso (deslumbramiento) en el puesto o en áreas de tránsito.', efectos: 'Fatiga visual, cefalea, disminución de la agudeza visual; caídas y golpes por mala visibilidad.',
          existentes: { fuente: ['Luminarias en buen estado'], medio: ['Luz natural'], individuo: [] },
          controles: { ingenieria: ['Rediseñar o aumentar luminarias según la tarea', 'Iluminación localizada en el puesto', 'Controlar reflejos y deslumbramientos'], administrativos: ['Medición de niveles de iluminación (luxometría)', 'Programa de mantenimiento y cambio de luminarias', 'Pausas visuales'], epp: ['Linterna de casco en sitios oscuros'] } },
        { nombre: 'Vibración', simple: 'Herramientas o máquinas que hacen temblar las manos o el cuerpo.', desc: 'Vibración mano-brazo (herramientas rotativas, martillos) o de cuerpo entero (vehículos, maquinaria).', efectos: 'Síndrome de vibración mano-brazo (dedo blanco), lesiones osteomusculares, lumbalgia.',
          controles: { sustitucion: ['Herramientas con sistema antivibración'], ingenieria: ['Mangos y soportes antivibración', 'Sillas con suspensión en vehículos'], administrativos: ['Limitar el tiempo de uso continuo y rotar', 'Mantenimiento de herramientas (balanceo)'], epp: ['Guantes antivibración'] } },
        { nombre: 'Temperaturas extremas', simple: 'Mucho calor (hornos, sol, soldadura) o mucho frío (cuartos fríos).', desc: 'Exposición a calor (hornos, fundición, sol directo) o frío (cuartos fríos, zonas altas).', efectos: 'Golpe de calor, deshidratación, agotamiento, calambres; hipotermia, congelación.',
          controles: { ingenieria: ['Ventilación, extracción de calor o apantallamiento de la fuente', 'Zonas de descanso con sombra o climatizadas'], administrativos: ['Hidratación programada y pausas', 'Aclimatación del personal nuevo', 'Medición de estrés térmico'], epp: ['Ropa térmica o de protección contra el calor', 'Gorra con cubrenuca y protector solar'] } },
        { nombre: 'Presión atmosférica', simple: 'Trabajo en grandes alturas geográficas, buceo o cámaras a presión.', desc: 'Exposición a presiones atmosféricas anormales (altura geográfica, cámaras hiperbáricas, buceo).', efectos: 'Mal de altura, barotrauma, enfermedad descompresiva.',
          controles: { administrativos: ['Exámenes médicos de aptitud', 'Aclimatación y procedimientos de descompresión'] } },
        { nombre: 'Radiaciones ionizantes', simple: 'Rayos X, gammagrafía de soldaduras o fuentes radiactivas.', desc: 'Exposición a radiaciones ionizantes (rayos X, gammagrafía industrial, fuentes radiactivas).', efectos: 'Quemaduras, daño celular, cáncer, efectos en la reproducción.',
          controles: { ingenieria: ['Blindajes y delimitación de zona controlada'], administrativos: ['Licencia del equipo y oficial de protección radiológica', 'Dosimetría personal', 'Restringir el acceso durante la exposición'], epp: ['Delantal plomado según la práctica'] } },
        { nombre: 'Radiaciones no ionizantes', simple: 'Arco de soldadura, sol directo, láser o microondas.', desc: 'Radiación ultravioleta (soldadura, sol), infrarroja, láser o campos electromagnéticos.', efectos: 'Queratoconjuntivitis (ojo de soldador), quemaduras de piel, cáncer de piel, cataratas.',
          existentes: { fuente: [], medio: ['Biombos o mamparas'], individuo: ['Careta de soldar con filtro'] },
          controles: { ingenieria: ['Biombos o cortinas para soldadura', 'Polisombra o cubiertas en trabajos a la intemperie'], administrativos: ['Horarios que eviten el sol de 10 a. m. a 3 p. m. cuando sea posible', 'Capacitación en protección solar'], epp: ['Careta de soldar con el filtro adecuado', 'Protector solar y ropa de manga larga', 'Gafas con filtro UV'] } }
      ] },
    { id: 'quimico', nombre: 'Químico', color: '#8a4b00',
      desc: 'Polvos orgánicos e inorgánicos, fibras, líquidos (nieblas y rocíos), gases y vapores, humos metálicos y no metálicos, material particulado.',
      simple: 'Polvo, humo, olores fuertes, gases, pinturas, solventes o productos químicos.',
      base: { efectos: 'Irritación de ojos, piel y vías respiratorias; intoxicación; enfermedades respiratorias crónicas.',
        existentes: { fuente: ['Recipientes tapados y rotulados'], medio: ['Ventilación natural'], individuo: ['Respirador o tapabocas'] },
        controles: { eliminacion: ['Eliminar el uso del producto si no es necesario'], sustitucion: ['Sustituir por un producto menos peligroso (revisar la hoja de seguridad)'], ingenieria: ['Extracción localizada en la fuente', 'Ventilación general forzada', 'Procesos cerrados o húmedos'],
          administrativos: ['Hojas de datos de seguridad disponibles y etiquetado SGA', 'Capacitación en el SGA y manejo seguro', 'Mediciones ambientales del contaminante', 'Duchas y lavaojos cerca'], epp: ['Respirador con cartuchos o filtros según el contaminante', 'Guantes de nitrilo o del material que indique la hoja de seguridad', 'Monogafas'] },
        legal: 'Decreto 1496 de 2018; Res. 0773 de 2021' },
      tipos: [
        { nombre: 'Polvos orgánicos e inorgánicos', simple: 'Polvo de cemento, madera, harina, granos o tierra.', desc: 'Exposición a polvos orgánicos (madera, harina, granos) o inorgánicos (cemento, sílice).', efectos: 'Neumoconiosis, silicosis, asma ocupacional, irritación.' },
        { nombre: 'Fibras', simple: 'Fibras de vidrio, lana mineral o asbesto en techos viejos.', desc: 'Exposición a fibras (fibra de vidrio, lana mineral, asbesto en materiales antiguos).', efectos: 'Irritación de piel y vías respiratorias, asbestosis, cáncer de pulmón y mesotelioma (asbesto).', legal: 'Ley 1968 de 2019 (prohíbe el asbesto)' },
        { nombre: 'Líquidos (nieblas y rocíos)', simple: 'Salpicaduras o rocío de pinturas, aceites, ácidos o limpiadores.', desc: 'Contacto o inhalación de líquidos, nieblas o rocíos (pinturas, aceites de corte, ácidos, desengrasantes).', efectos: 'Dermatitis, quemaduras químicas, irritación respiratoria, intoxicación.' },
        { nombre: 'Gases y vapores', simple: 'Olores fuertes de solventes, gasolina, amoníaco, cloro o gases de máquinas.', desc: 'Inhalación de gases y vapores (solventes, combustibles, amoníaco, monóxido de carbono).', efectos: 'Mareo, cefalea, narcosis, intoxicación, asfixia, daño hepático o renal.' },
        { nombre: 'Humos metálicos y no metálicos', simple: 'Humo de soldadura, corte con soplete o plásticos quemados.', desc: 'Inhalación de humos metálicos de soldadura y corte, o humos de combustión.', efectos: 'Fiebre de los humos metálicos, irritación respiratoria, enfermedad pulmonar crónica, cáncer (cromo, níquel).',
          controles: { ingenieria: ['Extractor de humos portátil en el punto de soldadura', 'Ventilación forzada en espacios cerrados'], epp: ['Respirador para humos metálicos (P100) bajo la careta'] } },
        { nombre: 'Material particulado', simple: 'Polvillo de pulir, esmerilar, cortar o lijar.', desc: 'Material particulado generado al pulir, esmerilar, cortar, lijar o perforar.', efectos: 'Irritación de ojos y vías respiratorias, cuerpos extraños en ojos, enfermedad pulmonar.',
          controles: { ingenieria: ['Herramientas con aspiración o corte en húmedo'], epp: ['Respirador para partículas N95 o P100', 'Monogafas y careta de esmerilar'] } }
      ] },
    { id: 'psicosocial', nombre: 'Psicosocial', color: '#7a3e9d',
      desc: 'Gestión organizacional, características de la organización del trabajo, del grupo social, condiciones de la tarea, interfase persona–tarea, jornada de trabajo.',
      simple: 'Estrés, presión, malos tratos, turnos largos, trabajo monótono o mucha responsabilidad.',
      base: { efectos: 'Estrés, ansiedad, depresión, alteraciones del sueño, trastornos gastrointestinales y cardiovasculares, ausentismo.',
        existentes: { fuente: [], medio: [], individuo: ['Pausas activas'] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: [],
          administrativos: ['Aplicar la batería de riesgo psicosocial y su plan de intervención', 'Programa de vigilancia epidemiológica psicosocial', 'Comité de convivencia laboral activo', 'Actividades de bienestar y manejo del estrés'], epp: [] },
        legal: 'Res. 2646 de 2008; Res. 2764 de 2022' },
      tipos: [
        { nombre: 'Gestión organizacional', simple: 'Poca claridad en lo que hay que hacer, cambios sin avisar o poco reconocimiento.', desc: 'Estilo de mando, inducción, evaluación del desempeño, estabilidad laboral y bienestar deficientes.' },
        { nombre: 'Características de la organización del trabajo', simple: 'Mucha presión, órdenes que cambian, poca comunicación.', desc: 'Comunicación, tecnología, organización del trabajo, demandas cualitativas y cuantitativas de la labor.' },
        { nombre: 'Características del grupo social de trabajo', simple: 'Conflictos con compañeros o jefes, malos tratos, poco trabajo en equipo.', desc: 'Relaciones, cohesión, calidad de interacciones y trabajo en equipo deficientes.', legal: 'Ley 1010 de 2006; Res. 3461 de 2025' },
        { nombre: 'Condiciones de la tarea', simple: 'Trabajo monótono, muy exigente mentalmente o con mucha responsabilidad.', desc: 'Carga mental, contenido de la tarea, demandas emocionales, sistemas de control, definición de roles, monotonía.' },
        { nombre: 'Interfase persona–tarea', simple: 'No saber bien cómo hacer el trabajo o no poder decidir sobre él.', desc: 'Conocimientos, habilidades frente a la demanda de la tarea, iniciativa, autonomía y reconocimiento.' },
        { nombre: 'Jornada de trabajo', simple: 'Turnos largos, de noche, sin descanso o muchas horas extra.', desc: 'Trabajo nocturno, por turnos, horas extra, pausas y descansos insuficientes.', efectos: 'Fatiga, alteraciones del sueño, estrés, mayor probabilidad de accidentes.', legal: 'Código Sustantivo del Trabajo; Ley 2191 de 2022 (desconexión laboral)',
          controles: { administrativos: ['Programación de turnos con descansos adecuados', 'Control de horas extra', 'Pausas activas durante la jornada'] } }
      ] },
    { id: 'biomecanico', nombre: 'Biomecánico', color: '#a3562d',
      desc: 'Postura (prolongada, mantenida, forzada), esfuerzo, movimiento repetitivo, manipulación manual de cargas.',
      simple: 'Malas posturas, mucho tiempo de pie o sentado, cargar peso o repetir el mismo movimiento.',
      base: { efectos: 'Lesiones osteomusculares: lumbalgia, cervicalgia, tendinitis, síndrome del túnel carpiano, hernias.',
        existentes: { fuente: [], medio: [], individuo: ['Pausas activas'] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: ['Ayudas mecánicas (carretillas, patines, polipastos)', 'Puestos de trabajo ajustables'],
          administrativos: ['Inspecciones de puesto de trabajo (ergonomía)', 'Programa de pausas activas', 'Capacitación en higiene postural', 'Programa de vigilancia epidemiológica osteomuscular'], epp: [] },
        legal: 'Res. 2400 de 1979' },
      tipos: [
        { nombre: 'Postura', simple: 'Agacharse, arrodillarse, brazos arriba o mucho tiempo en la misma posición.', desc: 'Posturas prolongadas, mantenidas, forzadas o antigravitacionales durante la tarea.', efectos: 'Lumbalgia, cervicalgia, dolor de hombros, fatiga muscular, várices.',
          controles: { ingenieria: ['Mesas y sillas regulables', 'Tapetes antifatiga en trabajos de pie'], administrativos: ['Alternar posturas y pausas activas cada hora'] } },
        { nombre: 'Esfuerzo', simple: 'Empujar, halar o hacer fuerza con las herramientas.', desc: 'Esfuerzo físico al empujar, halar, apretar o manipular herramientas pesadas.', efectos: 'Lesiones musculares, hernias, desgarros, fatiga.' },
        { nombre: 'Movimiento repetitivo', simple: 'Repetir el mismo movimiento de manos o brazos muchas veces.', desc: 'Movimientos repetitivos de miembros superiores durante la jornada.', efectos: 'Tendinitis, epicondilitis, síndrome del túnel carpiano, tenosinovitis.',
          controles: { administrativos: ['Rotación de tareas', 'Pausas activas con estiramientos de manos y brazos'] } },
        { nombre: 'Manipulación manual de cargas', simple: 'Levantar, cargar o mover cosas pesadas.', desc: 'Levantamiento, transporte y descargue manual de cargas.', efectos: 'Lumbalgia, hernias discales, lesiones de espalda y hombros.',
          existentes: { fuente: [], medio: [], individuo: ['Capacitación en levantamiento seguro'] },
          controles: { ingenieria: ['Patines hidráulicos, carretillas, montacargas o polipastos'], administrativos: ['Límites de peso por persona y levantamiento entre dos', 'Capacitación en técnicas de levantamiento seguro'], epp: ['Guantes con agarre', 'Botas de seguridad con puntera'] } }
      ] },
    { id: 'seguridad', nombre: 'Condiciones de seguridad', color: '#b3261e',
      desc: 'Mecánico, eléctrico, locativo, tecnológico, accidentes de tránsito, públicos, trabajo en alturas, espacios confinados.',
      simple: 'Máquinas, electricidad, pisos, alturas, tráfico, incendios, robos o espacios cerrados.',
      base: { efectos: 'Golpes, heridas, fracturas, quemaduras, amputaciones, muerte.', existentes: { fuente: [], medio: ['Señalización'], individuo: ['Casco, gafas y botas de seguridad'] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: [], administrativos: ['Inspecciones planeadas', 'Procedimiento de trabajo seguro y ATS', 'Capacitación en el riesgo'], epp: [] }, legal: 'Res. 2400 de 1979' },
      tipos: [
        { nombre: 'Mecánico', simple: 'Máquinas o herramientas que pueden cortar, atrapar, golpear o lanzar partículas.', desc: 'Uso de máquinas, equipos y herramientas con partes móviles, filos o proyección de partículas.', efectos: 'Heridas, atrapamientos, amputaciones, fracturas, cuerpos extraños en ojos.',
          existentes: { fuente: ['Guardas de protección'], medio: ['Demarcación del área'], individuo: ['Guantes y gafas de seguridad'] },
          controles: { sustitucion: ['Herramientas con mejores sistemas de protección'], ingenieria: ['Guardas fijas o con enclavamiento en partes móviles', 'Paradas de emergencia accesibles'], administrativos: ['Inspección preoperacional de equipos y herramientas', 'Bloqueo y etiquetado (LOTO) en mantenimientos', 'Solo personal capacitado y autorizado'], epp: ['Guantes de vaqueta o anticorte', 'Gafas de seguridad o careta', 'Botas con puntera'] } },
        { nombre: 'Eléctrico', simple: 'Cables pelados, tableros abiertos, extensiones dañadas o trabajos con energía.', desc: 'Contacto directo o indirecto con energía eléctrica de baja, media o alta tensión; electricidad estática.', efectos: 'Electrocución, quemaduras, paro cardiorrespiratorio, caídas por choque eléctrico, muerte.',
          existentes: { fuente: ['Tableros con tapa'], medio: ['Señalización de riesgo eléctrico'], individuo: ['Guantes dieléctricos'] },
          controles: { eliminacion: ['Trabajar sin tensión (desenergizar) siempre que sea posible'], ingenieria: ['Protecciones diferenciales y polo a tierra', 'Tableros cerrados y rotulados', 'Herramientas con doble aislamiento'], administrativos: ['Reglas de oro y bloqueo y etiquetado (LOTO)', 'Permiso de trabajo eléctrico', 'Solo personal calificado (competencia en riesgo eléctrico)'], epp: ['Guantes dieléctricos de la clase requerida', 'Casco dieléctrico', 'Ropa ignífuga para arco eléctrico', 'Botas dieléctricas'] },
          legal: 'RETIE (Res. 40117 de 2024)' },
        { nombre: 'Locativo', simple: 'Pisos resbalosos o irregulares, desorden, escaleras sin baranda, cosas que pueden caer.', desc: 'Superficies irregulares o deslizantes, desorden, almacenamiento inadecuado, escaleras y barandas en mal estado.', efectos: 'Caídas al mismo nivel, golpes, esguinces, fracturas, contusiones.',
          existentes: { fuente: ['Orden y aseo'], medio: ['Señalización de piso húmedo'], individuo: ['Botas antideslizantes'] },
          controles: { ingenieria: ['Reparar pisos y superficies; antideslizantes en escaleras', 'Barandas y pasamanos', 'Estanterías ancladas'], administrativos: ['Programa de orden y aseo (5S)', 'Inspecciones locativas', 'Demarcación de pasillos'], epp: ['Botas de seguridad antideslizantes'] } },
        { nombre: 'Tecnológico (explosión, fuga, derrame, incendio)', simple: 'Riesgo de incendio, explosión, fuga de gas o derrame de productos.', desc: 'Posibilidad de incendio, explosión, fuga o derrame por manejo de combustibles, gases, sustancias o trabajos en caliente.', efectos: 'Quemaduras, intoxicación, lesiones múltiples, muerte; daños a instalaciones y al ambiente.',
          existentes: { fuente: ['Almacenamiento según compatibilidad'], medio: ['Extintores'], individuo: [] },
          controles: { sustitucion: ['Productos menos inflamables'], ingenieria: ['Sistemas de detección y extinción', 'Ventilación y control de fuentes de ignición', 'Diques de contención para derrames'], administrativos: ['Permiso de trabajo en caliente', 'Plan de emergencias y brigada entrenada', 'Kit antiderrames y procedimiento'], epp: ['Ropa ignífuga', 'Guantes y careta según la sustancia'] }, legal: 'Decreto 2157 de 2017; Decreto 1347 de 2021 (si es instalación clasificada)' },
        { nombre: 'Accidentes de tránsito', simple: 'Conducir o moverse por vías, parqueaderos o patios con vehículos.', desc: 'Desplazamientos en vehículos, tránsito de montacargas o vehículos en patios y vías.', efectos: 'Politraumatismos, fracturas, lesiones graves, muerte.',
          controles: { ingenieria: ['Separar zonas peatonales de las vehiculares', 'Señalización vial interna'], administrativos: ['Plan estratégico de seguridad vial (PESV)', 'Inspección preoperacional del vehículo', 'Límites de velocidad y prohibición de uso del celular'], epp: ['Chaleco reflectivo'] }, legal: 'Ley 1503 de 2011; Res. 40595 de 2022' },
        { nombre: 'Públicos (robos, atracos, desorden público)', simple: 'Robos, atracos, asonadas o violencia en la zona.', desc: 'Exposición a robos, atracos, secuestro o desorden público en el sitio o en los desplazamientos.', efectos: 'Lesiones, estrés postraumático, muerte.',
          controles: { administrativos: ['Protocolo de seguridad física y de desplazamientos', 'Evitar horarios y rutas de riesgo', 'Comunicación permanente con el supervisor'] } },
        { nombre: 'Trabajo en alturas', simple: 'Trabajar a 2 metros o más: andamios, escaleras, techos, canastas.', desc: 'Trabajo a 2 m o más sobre un nivel inferior (andamios, escaleras, cubiertas, plataformas elevadoras).', efectos: 'Caídas de altura, fracturas, trauma craneoencefálico, muerte.',
          existentes: { fuente: [], medio: ['Delimitación del área'], individuo: ['Arnés de cuerpo completo y eslinga'] },
          controles: { eliminacion: ['Hacer el trabajo desde el piso (prefabricar abajo)'], ingenieria: ['Barandas, líneas de vida y puntos de anclaje certificados', 'Andamios certificados y plataformas elevadoras'], administrativos: ['Permiso de trabajo en alturas y ATS', 'Personal con curso vigente y concepto médico apto', 'Plan de rescate y coordinador de alturas', 'Inspección de equipos de protección contra caídas'], epp: ['Arnés de cuerpo completo, eslinga con absorbedor y casco con barbuquejo'] },
          legal: 'Res. 4272 de 2021' },
        { nombre: 'Espacios confinados', simple: 'Entrar a tanques, pozos, silos, ductos o lugares con una sola entrada.', desc: 'Ingreso a espacios con aberturas limitadas, ventilación deficiente y posible atmósfera peligrosa.', efectos: 'Asfixia, intoxicación, explosión, atrapamiento, muerte.',
          controles: { eliminacion: ['Hacer la tarea desde afuera (inspección con cámara, limpieza remota)'], ingenieria: ['Ventilación forzada', 'Medición continua de gases'], administrativos: ['Permiso de ingreso a espacio confinado', 'Vigía permanente y plan de rescate', 'Personal capacitado'], epp: ['Equipo de respiración autónomo o línea de aire según la atmósfera', 'Arnés con línea de rescate'] },
          legal: 'Res. 0491 de 2020' }
      ] },
    { id: 'natural', nombre: 'Fenómenos naturales', color: '#4f5d6b',
      desc: 'Sismo, terremoto, vendaval, inundación, derrumbe, precipitaciones (lluvias, granizadas, heladas).',
      simple: 'Temblores, vendavales, inundaciones, derrumbes, tormentas o rayos.',
      base: { efectos: 'Lesiones, atrapamientos, ahogamiento, muerte; daños a instalaciones.',
        existentes: { fuente: [], medio: ['Rutas de evacuación señalizadas'], individuo: [] },
        controles: { eliminacion: [], sustitucion: [], ingenieria: ['Reforzar estructuras y anclar estanterías'], administrativos: ['Plan de emergencias y contingencias', 'Simulacros de evacuación', 'Brigada de emergencias', 'Seguir las alertas del IDEAM y la unidad de gestión del riesgo'], epp: [] },
        legal: 'Ley 1523 de 2012; Decreto 2157 de 2017' },
      tipos: [
        { nombre: 'Sismo', simple: 'Temblores.', desc: 'Movimiento sísmico que puede generar caída de objetos o colapso estructural.' },
        { nombre: 'Terremoto', simple: 'Terremotos fuertes.', desc: 'Sismo de gran magnitud con riesgo de colapso estructural.' },
        { nombre: 'Vendaval', simple: 'Vientos fuertes que levantan techos o tumban cosas.', desc: 'Vientos fuertes que pueden desprender cubiertas, estructuras o elementos sueltos.', controles: { administrativos: ['Suspender trabajos en alturas e izajes con vientos fuertes', 'Asegurar elementos sueltos'] } },
        { nombre: 'Inundación', simple: 'Agua que se mete al sitio de trabajo por lluvias o desbordes.', desc: 'Ingreso de agua por lluvias intensas o desbordamiento de cuerpos de agua.', controles: { ingenieria: ['Canales y drenajes limpios'], administrativos: ['Almacenar materiales y equipos eléctricos en alto'] } },
        { nombre: 'Derrumbe', simple: 'Tierra o rocas que se pueden caer (taludes, excavaciones).', desc: 'Deslizamiento de tierra o caída de rocas en taludes o excavaciones.', controles: { ingenieria: ['Entibado y estabilización de taludes'], administrativos: ['Inspección de taludes antes de iniciar, sobre todo con lluvia'] } },
        { nombre: 'Precipitaciones', simple: 'Lluvias fuertes, granizo, tormentas eléctricas o heladas.', desc: 'Lluvias, granizadas, tormentas eléctricas o heladas durante trabajos a la intemperie.', efectos: 'Caídas por superficies mojadas, descargas por rayos, hipotermia.', controles: { administrativos: ['Suspender trabajos a la intemperie con tormenta eléctrica', 'Refugio para el personal'], epp: ['Impermeable y botas de caucho'] } }
      ] }
  ];
  const JER = [['eliminacion', 'Eliminación'], ['sustitucion', 'Sustitución'], ['ingenieria', 'Controles de ingeniería'], ['administrativos', 'Controles administrativos, señalización, advertencias'], ['epp', 'Equipos y elementos de protección personal']];
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  function clase(nombre) { return C.find((c) => c.nombre === nombre || c.id === nombre || norm(c.nombre) === norm(nombre)) || null; }
  /** Información completa de un tipo (con lo que hereda de su clase). */
  function info(claseNombre, tipoNombre) {
    const c = clase(claseNombre); if (!c) return null;
    const t = c.tipos.find((x) => norm(x.nombre) === norm(tipoNombre)) || null, b = c.base, tc = (t && t.controles) || {};
    const controles = {}; JER.forEach(([k]) => { controles[k] = [].concat(tc[k] || [], b.controles[k] || []).filter((x, i, a) => a.indexOf(x) === i); });
    const ex = (t && t.existentes) || b.existentes;
    return { clase: c.nombre, tipo: t ? t.nombre : '', simple: t ? t.simple : c.simple, desc: (t && t.desc) || '', efectos: (t && t.efectos) || b.efectos,
      existentes: { fuente: ex.fuente || [], medio: ex.medio || [], individuo: ex.individuo || [] }, controles, legal: (t && t.legal) || b.legal || '' };
  }
  const nombres = () => C.map((c) => c.nombre);
  const tipos = (claseNombre) => { const c = clase(claseNombre); return c ? c.tipos.map((t) => t.nombre) : []; };
  return { CLASES: C, JER, clase, info, nombres, tipos, norm,
    FRECUENCIAS: ['Todos los días', 'Varias veces por semana', 'De vez en cuando', 'Rara vez'] };
})();
if (typeof module !== 'undefined') module.exports = GTC45;
