/* ============================================================
   ats-catalogo.js — Base de conocimiento del ATS interactivo (SSTA-F-007)
   ------------------------------------------------------------
   DE DÓNDE SALE CADA COSA
   - Clasificación de peligros: GTC 45 (2012), Anexo A — Tabla de peligros.
     Siete clases: Biológico, Físico, Químico, Psicosocial, Biomecánico,
     Condiciones de seguridad y Fenómenos naturales.
   - Consecuencias y controles: redacción de obra para tareas típicas de
     montaje y mantenimiento industrial (bodega, calderas, tanques,
     tuberías). Se partieron en controles sueltos para poder marcarlos
     uno por uno.
   - Jerarquía de controles (GTC 45, numeral 2.8 / Decreto 1072 art.
     2.2.4.6.24): E eliminación · S sustitución · I controles de ingeniería ·
     A controles administrativos, señalización, advertencia · P EPP.

   CÓMO AGREGAR O CAMBIAR ALGO
   Este archivo es solo datos: se puede editar sin tocar la pantalla.
   - Un peligro nuevo: copiar uno de PELIGROS y cambiarle el id.
   - Un control nuevo: agregarlo a la lista `controles` del peligro con su
     letra de jerarquía.
   - Una tarea tipo nueva: agregarla a TAREAS con los ids de sus peligros.
   Después de editar, subir la versión en sw.js (CACHE_NAME) para que los
   celulares la descarguen.
   ============================================================ */

const ATS_FORMATO = {
  titulo: 'ANÁLISIS DE TRABAJO SEGURO',
  // Código, versión y fecha: los de la empresa (empresa.js → formatos). v126: sin código de fábrica.
  codigo: '',
  version: '',
  fecha: '',
  pagina: 'Página: 1 de 1'
};
// Código, versión y fecha propios de la empresa (empresa.js).
if (typeof Empresa !== 'undefined') (function () { const f = Empresa.formato('SSTA-F-007'); ['codigo', 'version', 'fecha'].forEach((k) => { if (f[k]) ATS_FORMATO[k] = f[k]; }); })();

/* Jerarquía de controles — orden en que se muestran y se imprimen. */
const JERARQUIA = {
  E: { nombre: 'Eliminación', orden: 1 },
  S: { nombre: 'Sustitución', orden: 2 },
  I: { nombre: 'Controles de ingeniería', orden: 3 },
  A: { nombre: 'Controles administrativos', orden: 4 },
  P: { nombre: 'Elementos de protección personal', orden: 5 }
};

/* Las 7 clases de peligro de la GTC 45 (Anexo A), con su descripción
   oficial resumida — se muestra al tocar la clase. */
const CLASES_GTC45 = [
  { id: 'biologico', nombre: 'Biológico', desc: 'Virus, bacterias, hongos, ricketsias, parásitos, picaduras, mordeduras, fluidos o excrementos.' },
  { id: 'fisico', nombre: 'Físico', desc: 'Ruido, iluminación, vibración, temperaturas extremas, presión atmosférica, radiaciones ionizantes y no ionizantes.' },
  { id: 'quimico', nombre: 'Químico', desc: 'Polvos orgánicos e inorgánicos, fibras, líquidos (nieblas y rocíos), gases y vapores, humos metálicos y no metálicos, material particulado.' },
  { id: 'psicosocial', nombre: 'Psicosocial', desc: 'Gestión organizacional, características de la organización del trabajo, del grupo social, condiciones de la tarea, jornada de trabajo.' },
  { id: 'biomecanico', nombre: 'Biomecánico', desc: 'Postura (prolongada, mantenida, forzada), esfuerzo, movimiento repetitivo, manipulación manual de cargas.' },
  { id: 'seguridad', nombre: 'Condiciones de seguridad', desc: 'Mecánico, eléctrico, locativo, tecnológico, accidentes de tránsito, públicos, trabajo en alturas, espacios confinados.' },
  { id: 'natural', nombre: 'Fenómenos naturales', desc: 'Sismo, terremoto, vendaval, inundación, derrumbe, precipitaciones (lluvias, granizadas, heladas).' }
];

/* ============================================================
   PELIGROS
   id        identificador interno (no cambiarlo si ya hay ATS guardados)
   clase     una de CLASES_GTC45
   sub       descriptor de la GTC 45 dentro de la clase
   texto     cómo se imprime en la columna PELIGROS
   efectos   cómo se imprime en la columna CONSECUENCIA
   controles [texto, jerarquía]
   generales controles generales que este peligro agrega a la tarea
   epp       ids de EPP que sugiere para el encabezado
   emergencia ids de equipos de emergencia que sugiere
   claves    palabras que, escritas en la tarea, sugieren este peligro
   ============================================================ */
const PELIGROS = [
  /* ── Condiciones de seguridad ───────────────────────────── */
  {
    id: 'loc', clase: 'seguridad', sub: 'Locativo',
    texto: 'Superficies de trabajo irregulares, condiciones de orden y aseo.',
    efectos: 'Golpes, esguinces, torceduras, fracturas, contusiones.',
    controles: [
      ['Mantener orden y aseo permanente del área de trabajo', 'E'],
      ['Transitar por senderos autorizados', 'A'],
      ['Inspección visual del área de trabajo y señalización de la misma', 'A'],
      ['Niveles de iluminación óptimos para tránsito seguro por pasillos y áreas de circulación', 'I'],
      ['Uso de EPP adecuado (botas de seguridad con puntera)', 'P']
    ],
    epp: ['botas'], claves: ['orden', 'aseo', 'inspeccion', 'area', 'ingreso', 'recorrido']
  },
  {
    id: 'loc_objetos', clase: 'seguridad', sub: 'Locativo',
    texto: 'Caída de objetos y herramientas, almacenamiento de materiales.',
    efectos: 'Golpes, fracturas, heridas, contusiones a trabajadores y terceros.',
    controles: [
      ['Almacenamiento organizado de materiales en racks o zonas designadas, sin sobreapilar', 'I'],
      ['Uso de bolsa porta herramientas y amarre de herramientas con cuerda de vida', 'I'],
      ['Delimitación y señalización del área bajo el punto de trabajo', 'A'],
      ['Prohibido el tránsito de personal bajo el punto de trabajo', 'A'],
      ['Uso de casco de seguridad con barbuquejo', 'P']
    ],
    epp: ['casco'], claves: ['almacen', 'rack', 'estanteria', 'apilar', 'caida de objetos']
  },
  {
    id: 'loc_derrame', clase: 'seguridad', sub: 'Locativo',
    texto: 'Superficies resbaladizas por derrames de aceite, penetrantes o químicos.',
    efectos: 'Caídas, golpes, contusiones, quemaduras por derrames calientes.',
    controles: [
      ['Controlar derrames de inmediato con material absorbente (kit antiderrames)', 'I'],
      ['Demarcar y señalizar el área de trabajo', 'A'],
      ['Uso de botas de seguridad con suela antideslizante', 'P']
    ],
    epp: ['botas'], emergencia: ['antiderrames'], claves: ['derrame', 'aceite', 'resbal', 'lubric']
  },
  {
    id: 'mec_manual', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Uso de herramienta manual.',
    efectos: 'Machucones, heridas, golpes con o por objetos, pellizcos, atrapamiento de manos, cuerpos extraños en ojos, fracturas, luxaciones, amputaciones.',
    controles: [
      ['Inspección preoperacional de la herramienta; retirar la que esté en mal estado', 'A'],
      ['Mantenimiento preventivo de herramientas', 'A'],
      ['Personal calificado y con experiencia para realizar la labor', 'A'],
      ['Uso de guantes de vaqueta y gafas de seguridad', 'P']
    ],
    epp: ['g_vaqueta', 'gafas'], claves: ['llave', 'martillo', 'desarme', 'desmont', 'ajust', 'ensambl', 'armado', 'tornill', 'torque', 'mecanic']
  },
  {
    id: 'mec_rotativa', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Uso de herramienta eléctrica rotativa (pulidora, motortool, grata, lijadora): proyección de partículas, disco roto o suelto.',
    efectos: 'Heridas cortantes, laceraciones, amputaciones, cuerpos extraños en ojos, golpes, fracturas.',
    controles: [
      ['Usar disco certificado y en buen estado; verificar apriete del disco antes de operar', 'I'],
      ['Herramienta con guarda de protección instalada', 'I'],
      ['Inspección preoperacional de la herramienta', 'A'],
      ['Demarcar y señalizar el área de trabajo', 'A'],
      ['Uso de careta de pulir, gafas de seguridad, guantes de vaqueta, peto y mangas en vaqueta', 'P']
    ],
    epp: ['careta_pulir', 'gafas', 'g_vaqueta', 'peto'], claves: ['pulid', 'pulir', 'motortool', 'motor tool', 'grata', 'lijad', 'lijar', 'desbast', 'esmeril', 'corte', 'cortar', 'bisel', 'brill', 'abrasiv', 'rotosfera']
  },
  {
    id: 'mec_taladro', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Uso de taladro: broca giratoria, atrapamiento de ropa o guantes, rotura de broca.',
    efectos: 'Heridas cortantes, laceraciones, amputación de dedos, cuerpos extraños en ojos, golpes.',
    controles: [
      ['Verificar estado de la broca (sin fisuras ni desgaste) y asegurarla en el portabrocas', 'I'],
      ['No usar guantes holgados ni ropa suelta cerca de partes giratorias', 'A'],
      ['Inspección preoperacional del taladro', 'A'],
      ['Uso de careta de pulir o gafas de seguridad y guantes de vaqueta', 'P']
    ],
    epp: ['gafas', 'g_vaqueta'], claves: ['taladr', 'perfor', 'broca', 'agujero', 'anclaje quimico', 'chazo']
  },
  {
    id: 'mec_lamina', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Manejo de láminas y piezas metálicas: bordes cortantes, peso.',
    efectos: 'Cortes, laceraciones, amputaciones, golpes, heridas por bordes cortantes.',
    controles: [
      ['Proteger bordes cortantes con cinta o tapones', 'I'],
      ['Asegurar la lámina contra deslizamiento durante el corte', 'I'],
      ['Uso de guantes de vaqueta, mangas de vaqueta y botas de seguridad con puntera', 'P']
    ],
    epp: ['g_vaqueta', 'peto', 'botas'], claves: ['lamina', 'parche', 'plancha', 'chapa', 'rolad', 'conform', 'trazad']
  },
  {
    id: 'mec_izaje', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Izaje de cargas: falla del diferencial, eslingas o ganchos; carga suspendida.',
    efectos: 'Caída de carga, golpes, aplastamiento, atrapamiento, daños a la propiedad, muerte.',
    controles: [
      ['Uso de equipos de izaje certificados, sin superar la capacidad nominal', 'I'],
      ['Uso de cuerdas guía para controlar la carga', 'I'],
      ['Plan de izaje y personal capacitado y certificado', 'A'],
      ['Inspección preoperacional y tarjeta de operación del diferencial, eslingas, ganchos y grilletes', 'A'],
      ['Anclaje adecuado de la carga a izar y de los puntos de anclaje', 'A'],
      ['Delimitación del radio de izaje; prohibido el paso de personal bajo carga suspendida', 'A'],
      ['Trabajo en equipo y comunicación asertiva durante la maniobra', 'A'],
      ['Uso de casco con barbuquejo, guantes y botas con puntera', 'P']
    ],
    generales: ['Permiso de trabajo de izaje de cargas', 'Plan de izaje'],
    epp: ['casco', 'g_vaqueta', 'botas'], claves: ['izaj', 'izar', 'diferencial', 'polipasto', 'grua', 'portico', 'eslinga', 'grillete', 'montacarga', 'levant']
  },
  {
    id: 'energia', clase: 'seguridad', sub: 'Mecánico / Tecnológico',
    texto: 'Liberación de energía residual (agua, vapor, aire comprimido o eléctrica) por bloqueo inadecuado.',
    efectos: 'Quemaduras térmicas (vapor), golpe de fluido a presión, lesiones oculares, descargas eléctricas.',
    controles: [
      ['Aplicar procedimiento de bloqueo y etiquetado (LOTO) sobre las líneas a intervenir', 'I'],
      ['Purga, drenaje y despresurización completa de las líneas antes de intervenir', 'E'],
      ['Verificación de energía cero antes de iniciar; doble verificación por el supervisor', 'A'],
      ['Notificar el bloqueo al personal del cliente', 'A'],
      ['Uso de careta de protección facial y guantes', 'P']
    ],
    generales: ['Bloqueo y etiquetado de energías (LOTO)'],
    epp: ['gafas', 'g_vaqueta'], claves: ['bloqueo', 'loto', 'energia residual', 'energia cero', 'energizad', 'linea de vapor', 'purga', 'despresur', 'valvula', 'intervenir la linea']
  },
  {
    id: 'electrico', clase: 'seguridad', sub: 'Eléctrico',
    texto: 'Descargas eléctricas por uso de herramienta eléctrica y extensiones.',
    efectos: 'Descargas eléctricas, electrocución, quemaduras en distintos grados, incendio, muerte.',
    controles: [
      ['Usar extensiones certificadas y en buen estado, con conexión a tierra verificada', 'I'],
      ['Inspección preoperacional de cable, enchufe y cuerpo de la herramienta', 'A'],
      ['Mantenimiento preventivo de herramientas eléctricas', 'A'],
      ['No operar herramienta eléctrica en superficies húmedas', 'A'],
      ['Uso de botas dieléctricas y casco dieléctrico', 'P']
    ],
    epp: ['botas', 'casco'], claves: ['electric', 'extension', 'pulid', 'taladr', 'motortool', 'lijad', 'toma', 'tablero']
  },
  {
    id: 'electrico_sold', clase: 'seguridad', sub: 'Eléctrico',
    texto: 'Descarga eléctrica por contacto con el circuito de soldadura.',
    efectos: 'Electrocución, paro cardiorrespiratorio, quemaduras eléctricas, muerte.',
    controles: [
      ['Equipo de soldar conectado a tierra; cables y porta-electrodo en buen estado y aislados', 'I'],
      ['No enrollar el cable alrededor del cuerpo; no tocar partes conductoras energizadas', 'A'],
      ['Inspección preoperacional del equipo de soldar', 'A'],
      ['Usar guantes para soldador secos', 'P']
    ],
    epp: ['g_soldador'], claves: ['sold', 'smaw', 'gtaw', 'gmaw', 'tig', 'mig', 'electrodo', 'punte']
  },
  {
    id: 'tec_caliente', clase: 'seguridad', sub: 'Tecnológico',
    texto: 'Trabajo en caliente: chispas, salpicaduras y proyección de escoria (incendio, explosión).',
    efectos: 'Quemaduras de primer, segundo y tercer grado, incendio, explosión, muerte.',
    controles: [
      ['Retirar todo tipo de combustibles en un radio de 10 metros', 'E'],
      ['Cubrir con mantas ignífugas lo que no se pueda retirar; instalar mamparas o cortafuegos', 'I'],
      ['Mantener extintor multipropósito A,B,C disponible en el punto de trabajo', 'I'],
      ['Verificar ausencia de vapores inflamables antes de iniciar', 'A'],
      ['Señalizar y demarcar la zona de trabajo en caliente', 'A'],
      ['Vigía de seguridad durante y 30 minutos después del trabajo en caliente', 'A'],
      ['Personal competente para realizar la actividad', 'A'],
      ['Uso de careta de soldar o de pulir, guantes para soldador, peto, mangas y chaqueta en vaqueta', 'P']
    ],
    generales: ['Permiso de trabajo en caliente', 'Vigía de trabajo en caliente'],
    epp: ['careta_soldar', 'g_soldador', 'peto'], emergencia: ['extintor'],
    claves: ['sold', 'caliente', 'pulid', 'corte', 'oxicorte', 'chispa', 'esmeril', 'desbast', 'motortool', 'grata', 'bisel', 'fabricacion']
  },
  {
    id: 'tec_gas', clase: 'seguridad', sub: 'Tecnológico',
    texto: 'Manejo de cilindros de gas combustible y oxígeno (acetileno, propano): fuga, incendio, explosión.',
    efectos: 'Explosión, incendio, quemaduras graves, destrucción de equipos e instalaciones, muerte.',
    controles: [
      ['Mantener los cilindros asegurados en posición vertical, con capuchón cuando no estén en uso', 'I'],
      ['Válvulas antirretroceso (arrestallamas) instaladas en el equipo', 'I'],
      ['Inspeccionar mangueras, válvulas y reguladores; verificar fugas con agua jabonosa', 'A'],
      ['No usar aceite ni grasa en conexiones de oxígeno', 'A'],
      ['Personal capacitado en manejo de equipos oxicombustibles', 'A'],
      ['Extintor multipropósito cerca del área', 'I']
    ],
    generales: ['Permiso de trabajo en caliente', 'Inspección de equipos de gas antes del inicio'],
    epp: ['careta_soldar', 'g_soldador', 'peto'], emergencia: ['extintor'],
    claves: ['soplete', 'oxicorte', 'acetileno', 'propano', 'oxigeno', 'cilindro', 'precalent', 'gas combustible', 'gas propano']
  },
  {
    id: 'tec_inflamable', clase: 'seguridad', sub: 'Tecnológico',
    texto: 'Inflamabilidad de aerosoles, solventes o pinturas cerca de fuentes de calor.',
    efectos: 'Incendio, quemaduras, explosión.',
    controles: [
      ['Retirar fuentes de calor e ignición del área antes de aplicar', 'E'],
      ['No aplicar cerca de trabajos en caliente simultáneos ni sobre superficies calientes', 'A'],
      ['Almacenar los productos en recipiente cerrado y etiquetado', 'A'],
      ['Mantener extintor multipropósito cerca', 'I']
    ],
    epp: [], emergencia: ['extintor'], claves: ['tinta', 'penetrante', 'aerosol', 'solvente', 'thinner', 'pintur', 'inflamab', 'desengras']
  },
  {
    id: 'tec_presion', clase: 'seguridad', sub: 'Tecnológico',
    texto: 'Sistemas a presión: pruebas neumáticas o hidrostáticas, riesgo de fuga o ruptura.',
    efectos: 'Explosión, golpe por fluido o fragmentos, quemaduras, daños materiales severos, muerte.',
    controles: [
      ['Verificar hermeticidad de todas las uniones antes de presurizar', 'A'],
      ['Presurizar de forma gradual y controlada; vigilar manómetros e indicadores de temperatura', 'A'],
      ['Manómetros calibrados y válvula de alivio en el sistema', 'I'],
      ['Señalizar y demarcar el área de prueba; nadie cerca de zonas de alta presión', 'A'],
      ['Personal autorizado y capacitado para la prueba', 'A'],
      ['Uso de careta de protección facial y guantes', 'P']
    ],
    epp: ['gafas'], claves: ['presion', 'presuriz', 'neumatic', 'hidrostat', 'prueba de presion', 'psi', 'nitrogeno', 'caldera']
  },
  {
    id: 'transito', clase: 'seguridad', sub: 'Accidentes de tránsito',
    texto: 'Tránsito de vehículos y montacargas en el área de trabajo.',
    efectos: 'Golpes, heridas, fracturas, atropellamiento.',
    controles: [
      ['Transitar por las zonas establecidas para el tránsito de peatones', 'A'],
      ['Prelación al peatón; uso de controladores viales para ingreso y salida de vehículos', 'A'],
      ['Respetar la velocidad máxima permitida (10 km/h)', 'A'],
      ['Vehículos con requisitos de seguridad al día (SOAT, técnico-mecánica, licencia)', 'A'],
      ['Uso de chaleco reflectivo', 'P']
    ],
    epp: ['chaleco'], claves: ['montacarga', 'vehiculo', 'transito', 'camion', 'descarg', 'despacho', 'recepcion', 'cargue', 'ingreso']
  },
  {
    id: 'publico', clase: 'seguridad', sub: 'Públicos',
    texto: 'Robos, atracos, asaltos, desorden público en desplazamientos o trabajos en sitio.',
    efectos: 'Lesiones, estrés, pérdida de bienes.',
    controles: [
      ['Desplazamientos en grupo por rutas y horarios establecidos', 'A'],
      ['No portar objetos de valor a la vista; reportar novedades al supervisor', 'A']
    ],
    claves: ['desplaz', 'calle', 'via publica', 'exterior']
  },
  {
    id: 'alturas', clase: 'seguridad', sub: 'Trabajo en alturas',
    texto: 'Trabajo en alturas (andamio, escalera, techo o plataforma): caída de personas a diferente nivel.',
    efectos: 'Caída de alturas, fractura de huesos largos, politraumatismo, muerte.',
    controles: [
      ['Andamio certificado, completo (plataformas, barandas, rodapiés) y nivelado; tarjeta verde antes de su uso', 'I'],
      ['Garantizar puntos de anclaje certificados y línea de vida', 'I'],
      ['Anclaje permanente el 100% del tiempo; doble aseguramiento con eslinga de posicionamiento', 'A'],
      ['Inspección preoperacional del andamio y del EPCC', 'A'],
      ['Coordinador de alturas durante la ejecución de la actividad', 'A'],
      ['Personal idóneo y certificado para trabajo en alturas, con EMO con énfasis en alturas', 'A'],
      ['Delimitación del área de trabajo y comunicación asertiva', 'A'],
      ['Uso obligatorio y adecuado del EPCC: arnés de cuerpo entero, eslingas con absorbedor, casco con barbuquejo', 'P']
    ],
    generales: ['Permiso de trabajo en alturas', 'Coordinador de alturas', 'EMO con énfasis en alturas'],
    epp: ['arnes', 'eslinga', 'posicionamiento', 'casco'], emergencia: ['rescate_alturas'],
    claves: ['altura', 'andamio', 'escalera', 'techo', 'plataforma', 'linea de vida', 'tie-off', 'tie off', 'anclaje', 'elevador', 'cubierta', 'metros']
  },
  {
    id: 'confinados', clase: 'seguridad', sub: 'Espacios confinados',
    texto: 'Trabajo en espacio confinado: atmósfera peligrosa (deficiencia de oxígeno, gases), acceso restringido.',
    efectos: 'Asfixia, vértigo, pérdida del sentido, cefalea, intoxicación, muerte.',
    controles: [
      ['Medición de atmósfera antes de ingresar y cada 30 minutos durante la tarea; el medidor queda con la persona entrante', 'A'],
      ['Ventilación forzada / uso de extractor de aire', 'I'],
      ['Vigía (acompañamiento permanente) en la entrada y método de comunicación establecido', 'A'],
      ['Tomar descansos de 10 minutos cada hora', 'A'],
      ['Personal calificado para trabajo en espacios confinados, con examen específico para la labor', 'A'],
      ['Elementos de emergencia y rescate en sitio', 'I'],
      ['Uso de protección respiratoria adecuada a la atmósfera medida', 'P']
    ],
    generales: ['Permiso de trabajo en espacios confinados', 'Vigía de espacios confinados'],
    epp: ['resp', 'arnes'], emergencia: ['rescate_confinados'],
    claves: ['confinad', 'interior del tanque', 'dentro del tanque', 'manhole', 'recamara', 'boca de visita', 'silo', 'foso']
  },

  /* ── Físico ─────────────────────────────────────────────── */
  {
    id: 'ruido', clase: 'fisico', sub: 'Ruido',
    texto: 'Exposición a ruido por operación de herramientas y propio del área de trabajo.',
    efectos: 'Fatiga auditiva, hipoacusia, sordera, pitidos en el oído, dolor de cabeza.',
    controles: [
      ['Mantenimiento preventivo de las herramientas', 'I'],
      ['Toma de descansos y pausas periódicas; limitar el tiempo de exposición', 'A'],
      ['Uso de protección auditiva (tipo copa o de inserción)', 'P']
    ],
    epp: ['aud_copa', 'aud_ins'], claves: ['pulid', 'motortool', 'taladr', 'grata', 'esmeril', 'martill', 'ruido', 'compresor', 'lijad', 'desbast', 'corte']
  },
  {
    id: 'vibracion', clase: 'fisico', sub: 'Vibración',
    texto: 'Vibraciones mano-brazo por uso de herramientas eléctricas.',
    efectos: 'Síndrome de vibración mano-brazo, parestesias, tendinitis.',
    controles: [
      ['Apoyar la herramienta en superficie cuando sea posible', 'I'],
      ['Limitar el tiempo de exposición a vibraciones; pausas periódicas y rotación de tareas', 'A'],
      ['Uso de guantes de vaqueta', 'P']
    ],
    epp: ['g_vaqueta'], claves: ['pulid', 'taladr', 'motortool', 'grata', 'lijad', 'percutor', 'desbast', 'esmeril']
  },
  {
    id: 'rad_soldadura', clase: 'fisico', sub: 'Radiación no ionizante',
    texto: 'Radiación ultravioleta e infrarroja del arco de soldadura.',
    efectos: 'Quemaduras oculares (fotoqueratitis), quemaduras en piel, cáncer de piel.',
    controles: [
      ['Instalar mamparas para proteger a personas cercanas del arco', 'I'],
      ['Señalizar la zona de soldadura', 'A'],
      ['Uso de careta de soldador con filtro adecuado al proceso (sombra 10-12 SMAW/GMAW, 8-10 GTAW)', 'P'],
      ['Uso de peto, mangas y chaqueta en vaqueta; piel cubierta', 'P']
    ],
    epp: ['careta_soldar', 'peto'], claves: ['sold', 'smaw', 'gtaw', 'gmaw', 'tig', 'mig', 'arco', 'punte']
  },
  {
    id: 'rad_solar', clase: 'fisico', sub: 'Radiación no ionizante',
    texto: 'Radiación UV generada por el sol en trabajos a la intemperie.',
    efectos: 'Irritación de piel y ojos, deshidratación, agotamiento, posibilidad de cáncer de piel.',
    controles: [
      ['Instalar sombra o carpa en el punto de trabajo cuando sea posible', 'I'],
      ['Hidratación permanente y toma de descansos', 'A'],
      ['Uso de bloqueador solar, ropa de manga larga y gafas oscuras', 'P']
    ],
    epp: ['gafas'], claves: ['solar', 'al sol', 'bajo el sol', 'intemperie', 'exterior', 'techo', 'cubierta', 'aire libre', 'patio']
  },
  {
    id: 'temperatura', clase: 'fisico', sub: 'Temperaturas extremas',
    texto: 'Contacto con superficies, piezas o fluidos a alta temperatura.',
    efectos: 'Quemaduras de primer, segundo o tercer grado, golpe de calor, deshidratación.',
    controles: [
      ['Esperar enfriamiento a temperatura segura antes de manipular', 'E'],
      ['Verificar temperatura con pirómetro, termómetro infrarrojo o crayón térmico antes de tocar', 'A'],
      ['Precaución al manipular piezas recién soldadas o cortadas', 'A'],
      ['Uso de guantes de vaqueta o para soldador', 'P']
    ],
    epp: ['g_vaqueta'], claves: ['caliente', 'caldera', 'vapor', 'aceite termico', 'precalent', 'soplete', 'temperatura', 'horno', 'recien soldad']
  },
  {
    id: 'iluminacion', clase: 'fisico', sub: 'Iluminación',
    texto: 'Iluminación deficiente en el punto de trabajo.',
    efectos: 'Fatiga visual, trastornos visuales, dolor de cabeza, caídas y golpes por baja visibilidad.',
    controles: [
      ['Uso de linterna o iluminación portátil adecuada', 'I'],
      ['Programar las tareas críticas con luz suficiente', 'A']
    ],
    claves: ['noche', 'nocturn', 'oscur', 'interior del tanque', 'inspeccion visual', 'iluminac']
  },

  /* ── Químico ────────────────────────────────────────────── */
  {
    id: 'humos', clase: 'quimico', sub: 'Humos metálicos, gases y vapores',
    texto: 'Inhalación de humos metálicos y gases de soldadura.',
    efectos: 'Fiebre de humos metálicos, enfermedades respiratorias, neumoconiosis, intoxicación, muerte.',
    controles: [
      ['Ventilación forzada o extracción localizada de humos', 'I'],
      ['No soldar sobre superficies con aceite o pintura sin limpieza previa', 'A'],
      ['Uso de protección respiratoria media cara con filtros para humos metálicos (Ref. 2097)', 'P']
    ],
    epp: ['resp', 'f2097'], claves: ['sold', 'smaw', 'gtaw', 'gmaw', 'tig', 'mig', 'humo', 'oxicorte', 'punte']
  },
  {
    id: 'particulado', clase: 'quimico', sub: 'Material particulado',
    texto: 'Inhalación de polvos metálicos y material particulado por corte, desbaste o pulido.',
    efectos: 'Irritación de vías respiratorias, enfermedades respiratorias, neumoconiosis, irritación ocular.',
    controles: [
      ['Ventilación del área de trabajo', 'I'],
      ['Recolección del polvo metálico y limpieza del área al terminar', 'A'],
      ['Uso de protección respiratoria media cara con filtros Ref. 2097 y gafas de seguridad', 'P']
    ],
    epp: ['resp', 'f2097', 'gafas'], claves: ['pulid', 'desbast', 'lijad', 'lijar', 'grata', 'corte', 'motortool', 'esmeril', 'polvo', 'abrasiv', 'brill', 'sandblast']
  },
  {
    id: 'vapores', clase: 'quimico', sub: 'Gases y vapores',
    texto: 'Inhalación de vapores de solventes, pinturas, aceite térmico o productos químicos.',
    efectos: 'Irritación de vías respiratorias, mareos, cefalea, intoxicación, enfermedades respiratorias.',
    controles: [
      ['Ventilación del área de trabajo', 'I'],
      ['Ficha de datos de seguridad (SDS) de los productos disponible en el área; etiquetado de sustancias', 'A'],
      ['No fumar ni comer durante la aplicación', 'A'],
      ['Uso de protección respiratoria media cara con filtros para vapores orgánicos (Ref. 6003)', 'P']
    ],
    epp: ['resp', 'f6003'], claves: ['pintur', 'solvente', 'thinner', 'tinta', 'penetrante', 'aceite', 'quimic', 'vapor', 'decapad', 'desengras', 'resina']
  },
  {
    id: 'quimico_piel', clase: 'quimico', sub: 'Líquidos',
    texto: 'Contacto dérmico y ocular con químicos (penetrantes, desengrasantes, decapantes, pinturas).',
    efectos: 'Dermatitis, irritación de piel y ojos, quemaduras químicas.',
    controles: [
      ['Ficha de datos de seguridad (SDS) disponible y etiquetado de las sustancias', 'A'],
      ['Lavado de manos al terminar; no comer en el área', 'A'],
      ['Uso de guantes de nitrilo y gafas de seguridad', 'P']
    ],
    epp: ['g_nitrilo', 'gafas'], claves: ['quimic', 'tinta', 'penetrante', 'desengras', 'decapad', 'pintur', 'acido', 'limpieza quimica', 'pasivad']
  },

  /* ── Biomecánico ────────────────────────────────────────── */
  {
    id: 'cargas', clase: 'biomecanico', sub: 'Manipulación manual de cargas',
    texto: 'Manipulación manual de cargas y esfuerzo físico.',
    efectos: 'Lesiones musculoesqueléticas, lumbalgias, traumatismo de columna, hernias discales, inguinales y umbilicales.',
    controles: [
      ['Uso de medios mecánicos (patines, gatos, montacargas) cuando la carga supere 25 kg', 'I'],
      ['Aplicar procedimiento de manejo manual de cargas; no superar 25 kg por persona', 'A'],
      ['Trabajo en equipo para cargas pesadas (mínimo 2 personas)', 'A'],
      ['Pausas activas', 'A']
    ],
    claves: ['carga', 'cargue', 'descarg', 'traslad', 'recepcion', 'despacho', 'alistamiento', 'material', 'lamina', 'tubo', 'tuberia', 'montaje', 'andamio', 'mover']
  },
  {
    id: 'posturas', clase: 'biomecanico', sub: 'Postura',
    texto: 'Posturas inadecuadas, forzadas o prolongadas.',
    efectos: 'Lesiones musculoesqueléticas, lumbalgias, dolor cervical, tendinitis, úlceras varicosas.',
    controles: [
      ['Pausas activas e higiene postural', 'A'],
      ['Rotación de tareas cuando la actividad sea prolongada', 'A'],
      ['Adoptar posturas ergonómicas; apoyo de la herramienta cuando sea posible', 'A']
    ],
    claves: ['postur', 'inspeccion', 'sold', 'pulid', 'agachad', 'de pie', 'rodillas', 'prolongad']
  },

  /* ── Biológico / Psicosocial / Fenómenos naturales ──────── */
  {
    id: 'biologico', clase: 'biologico', sub: 'Virus, bacterias, hongos',
    texto: 'Virus, bacterias, hongos.',
    efectos: 'Enfermedades infectocontagiosas, alergias.',
    controles: [
      ['Lavado frecuente de manos; hidratación con agua potable', 'A'],
      ['Uso de tapabocas si presenta síntomas asociados a resfriados', 'P']
    ],
    claves: ['charla', 'pausa', 'inspeccion', 'orden', 'aseo', 'basura', 'residuo', 'agua residual', 'ptar', 'ptai']
  },
  {
    id: 'psicosocial', clase: 'psicosocial', sub: 'Jornada de trabajo / condiciones de la tarea',
    texto: 'Jornada de trabajo extensa y complejidad de la tarea.',
    efectos: 'Fatiga física y mental, estrés, ansiedad, falta de concentración.',
    controles: [
      ['Adecuar la carga y el ritmo de trabajo; pausas programadas', 'A'],
      ['Socialización del plan de trabajo y comunicación asertiva', 'A']
    ],
    claves: ['jornada', 'turno', 'noche', 'complej', 'urgente', 'parada de planta']
  },
  {
    id: 'natural', clase: 'natural', sub: 'Sismo, vendaval, precipitaciones',
    texto: 'Sismos, terremotos, inundaciones, precipitaciones, vendavales, granizadas.',
    efectos: 'Caídas, atrapamiento, heridas, golpes, contusiones, mareos, desmayos.',
    controles: [
      ['Suspender la actividad ante condición climática adversa (lluvia, tormenta eléctrica, vendaval)', 'E'],
      ['Aplicar plan de emergencias: ruta de evacuación, brigadistas y divulgación del punto de encuentro', 'A']
    ],
    claves: ['charla', 'inspeccion', 'techo', 'intemperie', 'exterior', 'altura', 'andamio', 'patio']
  },

  /* ── Agregados (versión 2 del catálogo) ─────────────────── */
  {
    id: 'mec_atrapamiento', clase: 'seguridad', sub: 'Mecánico',
    texto: 'Máquinas y equipos con partes móviles (bandas, poleas, ejes, engranajes, rodillos): atrapamiento o arrastre.',
    efectos: 'Atrapamiento de manos o extremidades, amputaciones, fracturas, heridas, aplastamiento.',
    controles: [
      ['Aplicar bloqueo y etiquetado (LOTO) del equipo antes de intervenirlo', 'E'],
      ['Guardas de protección instaladas en poleas, bandas, ejes y transmisiones', 'I'],
      ['Verificar parada total y energía cero antes de meter las manos', 'A'],
      ['No usar ropa suelta, anillos, cadenas ni cabello suelto cerca de partes móviles', 'A'],
      ['Uso de guantes ajustados y gafas de seguridad', 'P']
    ],
    epp: ['g_vaqueta', 'gafas'],
    claves: ['banda', 'transportador', 'polea', 'rodillo', 'engranaje', 'maquina', 'motor', 'bomba', 'reductor', 'eje', 'linea de produccion', 'envasadora', 'llenadora']
  },
  {
    id: 'excavacion', clase: 'seguridad', sub: 'Locativo',
    texto: 'Excavaciones y zanjas: derrumbe de paredes, caída a diferente nivel, contacto con redes enterradas.',
    efectos: 'Sepultamiento, asfixia, fracturas, golpes, electrocución por redes enterradas.',
    controles: [
      ['Consultar planos de redes enterradas (eléctricas, gas, agua) antes de excavar', 'E'],
      ['Entibado o taludes en zanjas de más de 1,5 m de profundidad', 'I'],
      ['Material excavado a más de 60 cm del borde de la zanja', 'A'],
      ['Barandas, señalización y delimitación del perímetro de la excavación', 'I'],
      ['Escalera de acceso y salida dentro de la zanja', 'I'],
      ['Uso de casco, botas y guantes de vaqueta', 'P']
    ],
    epp: ['casco', 'botas', 'g_vaqueta'],
    claves: ['excava', 'zanja', 'cimentacion', 'hueco', 'brecha', 'pala', 'pica', 'tierra', 'suelo']
  },
  {
    id: 'repetitivo', clase: 'biomecanico', sub: 'Movimiento repetitivo',
    texto: 'Movimientos repetitivos de manos, brazos y hombros.',
    efectos: 'Tendinitis, síndrome del túnel carpiano, epicondilitis, dolor de hombro y fatiga muscular.',
    controles: [
      ['Pausas activas cada hora con ejercicios de manos, muñecas y hombros', 'A'],
      ['Rotación de tareas entre el personal', 'A'],
      ['Uso de herramientas eléctricas o ergonómicas en lugar de manuales cuando sea posible', 'S']
    ],
    claves: ['repetit', 'atornill', 'lijado', 'enmasillar', 'empacar', 'embalaje', 'rotulacion']
  }
];

/* ============================================================
   CONTROLES GENERALES — encabezan la columna de medidas de cada tarea
   ("Generales: ..."), igual que en sus ATS.
   ============================================================ */
const GENERALES_BASE = [
  'Charla de seguridad',
  'Supervisión SSTA',
  'EMO periódico o de ingreso',
  'Socialización del plan de trabajo',
  'Divulgación del ATS',
  'Diligenciamiento de preoperacionales de los equipos a usar',
  'Verificación de condiciones de salud'
];
const GENERALES_EXTRA = [
  'Permiso de trabajo en caliente',
  'Vigía de trabajo en caliente',
  'Permiso de trabajo en alturas',
  'Coordinador de alturas',
  'EMO con énfasis en alturas',
  'Permiso de trabajo en espacios confinados',
  'Vigía de espacios confinados',
  'Permiso de trabajo de izaje de cargas',
  'Plan de izaje',
  'Permiso de trabajo eléctrico',
  'Bloqueo y etiquetado de energías (LOTO)',
  'Inspección de equipos de gas antes del inicio',
  'Verificación de certificación del soldador',
  'Ficha de datos de seguridad (SDS) disponible en el área',
  'Charla de seguridad conjunta con el cliente'
];

const RESPONSABLES = [
  'Coordinador de Producción',
  'Supervisor de obra',
  'Personal SSTA',
  'Personal operativo',
  'Coordinador de alturas',
  'Vigía de trabajo en caliente',
  'Soldador calificado',
  'Personal del cliente'
];

/* ============================================================
   ENCABEZADO: opciones seleccionables
   ============================================================ */
const CENTROS_COSTO = (typeof EMPRESA !== 'undefined' && EMPRESA.centrosCosto) ? EMPRESA.centrosCosto.slice() : [];

const PERMISOS = [
  { id: 'caliente', nombre: 'Caliente', peligros: ['tec_caliente'] },
  { id: 'alturas', nombre: 'Alturas', peligros: ['alturas', 'loc_objetos'] },
  { id: 'confinados', nombre: 'Espacios confinados', peligros: ['confinados'] },
  { id: 'izaje', nombre: 'Izaje de cargas', peligros: ['mec_izaje'] },
  { id: 'electrico', nombre: 'Eléctrico', peligros: ['electrico', 'energia'] }
];

const EPP = [
  { id: 'casco', nombre: 'Casco dieléctrico de seguridad con barbuquejo', base: true },
  { id: 'gafas', nombre: 'Gafas de seguridad claras y/u oscuras', base: true },
  { id: 'aud_ins', nombre: 'Protector auditivo de inserción', base: true },
  { id: 'aud_copa', nombre: 'Protector auditivo tipo copa' },
  { id: 'g_vaqueta', nombre: 'Guantes de vaqueta', base: true },
  { id: 'g_nitrilo', nombre: 'Guantes de nitrilo' },
  { id: 'g_soldador', nombre: 'Guantes para soldador' },
  { id: 'careta_pulir', nombre: 'Careta de pulir (soporte basculante y visor contra impactos)' },
  { id: 'careta_soldar', nombre: 'Careta de soldador' },
  { id: 'resp', nombre: 'Protección respiratoria media cara' },
  { id: 'f2097', nombre: 'Filtros Ref. 2097 (humos metálicos y partículas)' },
  { id: 'f6003', nombre: 'Filtros Ref. 6003 (vapores orgánicos)' },
  { id: 'peto', nombre: 'Peto, mangas y chaqueta en vaqueta' },
  { id: 'botas', nombre: 'Botas de cuero con puntera de acero y dieléctricas', base: true },
  { id: 'dotacion', nombre: 'Dotación: pantalón y camisa en jean/drill', base: true },
  { id: 'arnes', nombre: 'Arnés de cuerpo entero certificado' },
  { id: 'eslinga', nombre: 'Doble eslinga con absorbedor de energía' },
  { id: 'posicionamiento', nombre: 'Líneas de vida de restricción y posicionamiento' },
  { id: 'chaleco', nombre: 'Chaleco reflectivo' },
  { id: 'tapabocas', nombre: 'Tapabocas' }
];

/* ============================================================
   CONTROLES ADICIONALES POR PELIGRO — aparecen como opciones SIN marcar
   dentro de cada peligro, ordenados por la jerarquía de controles, para
   que quien hace el ATS escoja los que aplican. Se suman a los controles
   de arriba (que sí vienen marcados). [texto, jerarquía]
   ============================================================ */
const CONTROLES_ADICIONALES = {
  loc: [
    ['Retirar del área materiales, cables y obstáculos que no se necesiten', 'E'],
    ['Cubrir huecos, rejillas y desniveles o señalizarlos', 'I'],
    ['Instalar tapetes antideslizantes o pasarelas en zonas de tránsito', 'I'],
    ['Organizar las extensiones y mangueras por encima o por el borde del área', 'A'],
    ['Inspección de orden y aseo al inicio y al final de la jornada', 'A']
  ],
  loc_objetos: [
    ['Rodapiés y mallas en plataformas y andamios', 'I'],
    ['No dejar herramientas ni materiales sueltos en bordes o plataformas', 'A'],
    ['Subir y bajar materiales con cuerda y balde, nunca lanzándolos', 'A'],
    ['Vigía que controle el paso de personas bajo el punto de trabajo', 'A']
  ],
  loc_derrame: [
    ['Bandejas de contención bajo equipos que puedan gotear', 'I'],
    ['Revisar mangueras y acoples antes de iniciar', 'A'],
    ['Reportar y limpiar de inmediato cualquier derrame', 'A']
  ],
  mec_manual: [
    ['Usar la herramienta adecuada para cada labor; no improvisar herramientas', 'A'],
    ['Herramienta con mangos en buen estado, sin fisuras ni reparaciones hechizas', 'A'],
    ['Transportar herramientas en caja o cinturón porta herramientas', 'A'],
    ['Uso de herramienta antichispa en áreas con atmósferas inflamables', 'S']
  ],
  mec_rotativa: [
    ['Usar el disco adecuado al material y a las RPM de la pulidora', 'I'],
    ['Nunca retirar la guarda ni usar la pulidora sin mango lateral', 'A'],
    ['Esperar la detención total del disco antes de apoyar la herramienta', 'A'],
    ['Pantallas o mamparas para proteger a personas cercanas de las chispas', 'I'],
    ['Posición firme y agarre con las dos manos durante el corte', 'A']
  ],
  mec_taladro: [
    ['Asegurar la pieza con prensa o mordaza; no sostenerla con la mano', 'I'],
    ['Usar la velocidad y la broca adecuadas al material', 'A'],
    ['Retirar la llave del mandril antes de encender', 'A']
  ],
  mec_lamina: [
    ['Manipular láminas grandes entre dos personas', 'A'],
    ['Almacenar láminas de canto en soportes o racks', 'I'],
    ['Retirar rebabas con lima o pulidora después del corte', 'E']
  ],
  mec_izaje: [
    ['Verificar el peso de la carga y la capacidad de los aparejos antes de izar', 'A'],
    ['Un solo señalero con señales acordadas y radio de comunicación', 'A'],
    ['Suspender el izaje con vientos fuertes o lluvia', 'E'],
    ['No dejar cargas suspendidas sin vigilancia', 'A']
  ],
  energia: [
    ['Candado y tarjeta personal por cada trabajador que interviene', 'A'],
    ['Identificar todas las fuentes de energía en el diagrama o en campo', 'A'],
    ['Instalar bridas ciegas o desconectar físicamente la línea cuando sea posible', 'E']
  ],
  electrico: [
    ['Tablero o toma con protección diferencial (GFCI)', 'I'],
    ['Herramienta con doble aislamiento', 'S'],
    ['Extensiones colgadas o protegidas del tránsito, sin empalmes', 'A'],
    ['Desconectar la herramienta para cambiar discos, brocas o accesorios', 'A']
  ],
  electrico_sold: [
    ['Retirar electrodos del porta electrodo al terminar', 'A'],
    ['No soldar en superficies mojadas o con ropa húmeda', 'A'],
    ['Apagar el equipo de soldar en pausas largas', 'A']
  ],
  tec_caliente: [
    ['Hacer el trabajo en el taller cuando sea posible, fuera del área del cliente', 'E'],
    ['Humedecer o proteger pisos y superficies combustibles cercanas', 'I'],
    ['Inspección del área 30 minutos después de terminar para detectar puntos de fuego', 'A'],
    ['Coordinar con el cliente la desactivación temporal de detectores de humo', 'A']
  ],
  tec_gas: [
    ['Transportar cilindros en carro porta cilindros con cadena', 'I'],
    ['Cerrar válvulas de los cilindros al terminar y en pausas', 'A'],
    ['Prueba de fugas con agua jabonosa en conexiones', 'A'],
    ['Cilindros con capuchón cuando no están en uso', 'I']
  ],
  tec_inflamable: [
    ['Usar productos base agua o menos inflamables cuando sea posible', 'S'],
    ['Ventilar el área antes y durante la aplicación', 'I'],
    ['Solo la cantidad de producto necesaria para la jornada en el área', 'A']
  ],
  tec_presion: [
    ['Probar con agua (hidrostática) en lugar de aire cuando sea posible', 'S'],
    ['Asegurar mangueras y acoples con cable de seguridad (whip check)', 'I'],
    ['Despresurizar completamente antes de ajustar uniones', 'A']
  ],
  transito: [
    ['Delimitar el área de trabajo con conos y cinta frente a vehículos', 'I'],
    ['Coordinar con el cliente el cierre temporal de vías internas', 'A'],
    ['Alarma de reversa y luces en montacargas', 'I']
  ],
  publico: [
    ['Coordinar con seguridad del cliente el ingreso y salida del personal', 'A'],
    ['Evitar desplazamientos en horarios nocturnos', 'A']
  ],
  alturas: [
    ['Hacer en el piso los trabajos que se puedan prefabricar abajo', 'E'],
    ['Usar plataforma elevadora o andamio en lugar de escalera', 'S'],
    ['Plan de rescate en alturas socializado y kit de rescate en sitio', 'A'],
    ['Suspender la actividad con lluvia o vientos fuertes', 'E'],
    ['Verificar que el espacio libre de caída sea suficiente para el sistema usado', 'A']
  ],
  confinados: [
    ['Hacer la tarea desde afuera del espacio confinado cuando sea posible', 'E'],
    ['Bloqueo y aislamiento de todas las líneas que entran al espacio', 'I'],
    ['Plan de rescate y equipo de rescate (trípode, arnés, línea) en la entrada', 'A'],
    ['Registro de entrada y salida del personal', 'A']
  ],
  ruido: [
    ['Usar equipos de menor ruido o con silenciador', 'S'],
    ['Aislar o encerrar la fuente de ruido cuando sea posible', 'I'],
    ['Señalizar las zonas de uso obligatorio de protección auditiva', 'A']
  ],
  vibracion: [
    ['Herramientas con mangos antivibración', 'S'],
    ['Mantenimiento de la herramienta (discos balanceados, rodamientos en buen estado)', 'I'],
    ['Rotación del personal en tareas con vibración', 'A']
  ],
  rad_soldadura: [
    ['Biombos o cortinas de soldadura alrededor del punto de trabajo', 'I'],
    ['Advertir al personal cercano antes de iniciar el arco', 'A']
  ],
  rad_solar: [
    ['Programar las tareas pesadas fuera de las horas de mayor radiación (10 a. m. a 3 p. m.)', 'A'],
    ['Uso de cubrenucas o casco con ala', 'P']
  ],
  temperatura: [
    ['Aislar o proteger las superficies calientes cercanas', 'I'],
    ['Señalizar tuberías y equipos calientes', 'A'],
    ['Hidratación y descansos en ambientes calurosos', 'A'],
    ['Ropa térmica en cuartos fríos o bajas temperaturas', 'P']
  ],
  iluminacion: [
    ['Reflectores portátiles en el punto de trabajo', 'I'],
    ['Linterna de casco (manos libres)', 'P']
  ],
  humos: [
    ['Soldar en áreas abiertas o bien ventiladas', 'I'],
    ['Limpiar pintura, grasa o galvanizado antes de soldar o cortar', 'E'],
    ['Ubicarse fuera de la columna de humo (a favor del viento)', 'A']
  ],
  particulado: [
    ['Humedecer la superficie para evitar polvo (corte en húmedo)', 'I'],
    ['Aspiradora industrial en lugar de barrer en seco', 'S'],
    ['Aislar el área con plástico o polisombra', 'I']
  ],
  vapores: [
    ['Usar productos de menor toxicidad', 'S'],
    ['Mantener los recipientes cerrados cuando no se usan', 'A'],
    ['Rotación del personal durante la aplicación', 'A']
  ],
  quimico_piel: [
    ['Kit lavaojos disponible en el área', 'I'],
    ['Trasvasar solo a recipientes rotulados', 'A'],
    ['Delantal o traje de protección química cuando haya salpicaduras', 'P']
  ],
  cargas: [
    ['Reducir el peso de la carga fraccionándola o pidiéndola en empaques menores', 'E'],
    ['Usar carretilla, patín o tecle para trasladar cargas', 'S'],
    ['Técnica segura: espalda recta, flexionar rodillas, carga pegada al cuerpo, sin girar el tronco', 'A'],
    ['Despejar la ruta antes de trasladar la carga', 'A'],
    ['Capacitación en manejo manual de cargas', 'A'],
    ['Uso de guantes y botas con puntera', 'P']
  ],
  posturas: [
    ['Ajustar la altura del trabajo (mesa, caballetes, andamio) a la altura del trabajador', 'I'],
    ['Rodilleras para trabajos arrodillado', 'P'],
    ['Alternar posturas de pie y sentado cuando sea posible', 'A']
  ],
  biologico: [
    ['Disposición de basuras en recipientes cerrados', 'A'],
    ['No consumir alimentos en el área de trabajo', 'A'],
    ['Esquema de vacunación al día (tétano, fiebre amarilla si aplica)', 'A'],
    ['Uso de guantes en contacto con aguas residuales o residuos', 'P']
  ],
  psicosocial: [
    ['Respetar la jornada laboral y los descansos', 'A'],
    ['Planear el trabajo con tiempos reales; evitar presión por entregas', 'A'],
    ['Canal de comunicación con el supervisor para reportar dificultades', 'A']
  ],
  natural: [
    ['Consultar el pronóstico del clima antes de trabajos a la intemperie', 'A'],
    ['Identificar el punto de encuentro y la ruta de evacuación del cliente', 'A']
  ],
  mec_atrapamiento: [
    ['Parada de emergencia accesible y probada', 'I'],
    ['Coordinar con el operador del cliente el paro de la máquina', 'A'],
    ['No retirar guardas; reinstalarlas antes de poner en marcha', 'A']
  ],
  excavacion: [
    ['Excavación mecánica en lugar de manual cuando sea posible', 'S'],
    ['Inspección diaria de las paredes de la excavación, sobre todo después de lluvia', 'A'],
    ['Detector de redes enterradas antes de excavar', 'I']
  ],
  repetitivo: [
    ['Ajustar la altura del plano de trabajo', 'I'],
    ['Alternar la mano de trabajo cuando sea posible', 'A']
  ]
};

/* Herramientas, agrupadas como en sus ATS. */
const HERRAMIENTAS = [
  { grupo: 'Herramientas eléctricas', items: ['Pulidoras', 'Motor tool', 'Lijadoras', 'Rotosfera', 'Grata eléctrica', 'Taladro para metal', 'Taladro de árbol', 'Taladro percutor', 'Taladro magnético', 'Cortadora orbital', 'Extensiones eléctricas',
    'Tronzadora', 'Sierra circular', 'Sierra sinfín', 'Caladora', 'Atornillador inalámbrico', 'Martillo demoledor', 'Pistola de calor', 'Remachadora eléctrica'] },
  { grupo: 'Soldadura y corte', items: ['Equipo de soldar SMAW', 'Equipo de soldar TIG', 'Equipo de soldar MIG', 'Equipo de oxicorte', 'Soplete', 'Cilindros de gas', 'Discos de corte y desbaste',
    'Cortadora de plasma', 'Electrodos y material de aporte', 'Horno para electrodos', 'Biombos o cortinas de soldadura', 'Carro porta cilindros'] },
  { grupo: 'Herramientas manuales', items: ['Llaves expansivas', 'Llaves mixtas', 'Llaves fijas', 'Martillos', 'Pinzas', 'Hombre solo', 'Destornilladores', 'Ratches', 'Flexómetro', 'Escuadras', 'Niveles', 'Limas', 'Boquilleras',
    'Llave de tubo (Stilson)', 'Llaves Allen', 'Alicates', 'Seguetas', 'Cinceles y puntos', 'Tijeras para lámina', 'Cortatubos', 'Machuelos y terrajas', 'Palanca o pata de cabra', 'Espátulas', 'Calibrador (pie de rey)', 'Remachadora manual'] },
  { grupo: 'Herramientas mecánicas', items: ['Gato estibador', 'Gato hidráulico', 'Patines', 'Roladora', 'Prensa hidráulica', 'Montacargas',
    'Carretilla', 'Tecle de cadena', 'Tirfor (malacate manual)', 'Compresor de aire', 'Torquímetro', 'Extractor de rodamientos', 'Bomba hidráulica manual', 'Dobladora de tubo'] },
  { grupo: 'Trabajo en alturas', items: ['EPCC completo', 'Líneas de vida', 'Puntos de anclaje certificados', 'Conectores de anclaje (Tie-Off)', 'Andamio certificado', 'Andamio multidireccional', 'Escalera tipo tijera', 'Plataforma elevadora',
    'Escalera de extensión', 'Sistema autorretráctil', 'Eslinga de posicionamiento', 'Kit de rescate en alturas'] },
  { grupo: 'Izaje', items: ['Diferencial (polipasto)', 'Grúa tipo pórtico', 'Eslingas', 'Ganchos y grilletes certificados', 'Cuerdas guía',
    'Tecle de palanca', 'Grúa móvil o camión grúa', 'Cáncamos', 'Cadenas de izaje', 'Viga separadora', 'Radios de comunicación'] },
  { grupo: 'Medición y END', items: ['Tintas penetrantes', 'Pirómetro', 'Crayón térmico', 'Multímetro', 'Medidor de atmósferas (multigás)', 'Extractor de aire', 'Manómetro',
    'Nivel láser', 'Medidor de espesores (ultrasonido)', 'Luxómetro', 'Sonómetro', 'Galgas'] },
  { grupo: 'Trabajo eléctrico', items: ['Herramienta aislada 1000 V', 'Pinza voltiamperimétrica', 'Probador de tensión (detector)', 'Pelacables', 'Ponchadora', 'Guía pasacables', 'Tapete dieléctrico', 'Pértiga', 'Megóhmetro'] },
  { grupo: 'Obra civil', items: ['Palas', 'Picas', 'Barras', 'Mezcladora de concreto', 'Vibrador de concreto', 'Baldes', 'Llanas y palustres', 'Formaleta', 'Hilo y plomada'] },
  { grupo: 'Pintura y limpieza', items: ['Pistola de pintura', 'Equipo airless', 'Brochas y rodillos', 'Hidrolavadora', 'Aspiradora industrial', 'Material absorbente', 'Químicos de limpieza (con SDS)', 'Cepillos y escobas'] },
  { grupo: 'Bloqueo y señalización', items: ['Tarjetas y candados de bloqueo (LOTO)', 'Extintor multipropósito', 'Manta ignífuga', 'Cinta y conos de delimitación',
    'Candado múltiple (hasp)', 'Bloqueo de breakers', 'Avisos de seguridad', 'Polisombra o cerramiento', 'Barreras plásticas'] },
  { grupo: 'Complementaria', items: ['Polines de madera', 'Estibas', 'Manilas', 'Prensas mordazas', 'Burros niveladores',
    'Planta eléctrica', 'Reflector portátil', 'Carpa', 'Mesa de trabajo portátil', 'Caja de herramientas'] }
];

const EMERGENCIA = [
  { id: 'botiquin', nombre: 'Botiquín de primeros auxilios', base: true },
  { id: 'camilla', nombre: 'Camilla', base: true },
  { id: 'extintor', nombre: 'Extintor multipropósito A,B,C', base: true },
  { id: 'brigadistas', nombre: 'Brigadistas', base: true },
  { id: 'rescate_alturas', nombre: 'Kit de rescate en alturas' },
  { id: 'rescate_confinados', nombre: 'Equipo de rescate para espacios confinados (trípode, arnés, línea)' },
  { id: 'antiderrames', nombre: 'Kit antiderrames' },
  { id: 'lavaojos', nombre: 'Lavaojos portátil' }
];

const AMBIENTAL = [
  { id: 'separacion', nombre: 'Separación en la fuente y clasificación de residuos, con disposición final en el centro de acopio', base: true },
  { id: 'punto_eco', nombre: 'Disposición en puntos ecológicos (chatarra metálica, colillas de electrodo, escoria, empaques)' },
  { id: 'respel', nombre: 'Residuos peligrosos (trapos con aceite, envases de químicos, filtros) en recipiente rotulado para gestor autorizado' },
  { id: 'no_vertim', nombre: 'Evitar el vertimiento de residuos al suelo o a fuentes hídricas' },
  { id: 'derrames', nombre: 'Control de derrames con kit antiderrames' },
  { id: 'polvo', nombre: 'Recolección del polvo metálico generado' }
];

/* ============================================================
   TAREAS TIPO
   Cada una trae el nombre y la descripción como aparecen en sus ATS, los
   peligros que la acompañan y las tareas que normalmente siguen (para
   sugerir la próxima). `herr` sugiere herramientas para el encabezado.
   ============================================================ */
const TAREAS = [
  { id: 'inspeccion', nombre: 'Ingreso de personal y herramientas, inspección de área para identificar los peligros asociados a las tareas',
    desc: 'Se efectúa una inspección preventiva del área de trabajo para identificar y documentar los peligros existentes que podrían afectar la seguridad y salud de los trabajadores durante la realización de sus tareas.',
    peligros: ['loc', 'posturas', 'cargas', 'biologico', 'natural'], siguiente: ['pausas'], inicio: 1,
    claves: ['inspeccion de area', 'ingreso', 'recorrido'] },
  { id: 'pausas', nombre: 'Pausas activas y charla de seguridad',
    desc: 'Al inicio de la jornada se realizan pausas activas (estiramiento y activación muscular). Después, el supervisor SSTA dirige la charla de seguridad sobre los riesgos y protocolos de las tareas del día.',
    peligros: ['loc', 'posturas', 'biologico', 'natural'], siguiente: ['divulgacion'], inicio: 2,
    claves: ['pausa', 'charla'] },
  { id: 'divulgacion', nombre: 'Divulgación del ATS, diligenciamiento de permisos e inspección preoperacional de equipos y herramientas',
    desc: 'Se socializa el ATS con todo el personal, se diligencian los permisos de trabajo requeridos y se inspeccionan los equipos y herramientas verificando su operatividad y condición.',
    peligros: ['loc', 'posturas', 'biologico', 'natural'], inicio: 3,
    siguiente: ['descargue', 'recepcion', 'loto', 'andamio', 'fabricacion'],
    claves: ['divulgacion', 'permiso', 'preoperacional'] },
  { id: 'recepcion', nombre: 'Recepción, alistamiento y despacho de materiales, consumibles, fabricaciones y herramientas',
    desc: 'Recepción de materiales entrantes, verificación contra órdenes de compra, descarga y almacenamiento en racks o zonas designadas; alistamiento y despacho con montacargas, patines hidráulicos, eslingas y trabajo en equipo.',
    peligros: ['loc', 'loc_objetos', 'cargas', 'posturas', 'mec_manual', 'transito', 'mec_izaje', 'ruido', 'biologico', 'natural'],
    herr: ['Montacargas', 'Patines', 'Eslingas', 'Gato estibador'], siguiente: ['fabricacion', 'orden'],
    claves: ['recepcion', 'alistamiento', 'despacho', 'bodega', 'almacen', 'embalaje'] },
  { id: 'descargue', nombre: 'Descargue de materiales y herramientas',
    desc: 'Descargue con montacargas en el área designada y traslado al interior mediante patines.',
    peligros: ['mec_manual', 'psicosocial', 'loc', 'transito', 'natural', 'cargas', 'posturas'],
    herr: ['Montacargas', 'Patines'], siguiente: ['andamio', 'portico', 'fabricacion'],
    claves: ['descargue', 'descargar', 'montacargas'] },
  { id: 'loto', nombre: 'Bloqueo de energías, purga y despresurización de líneas (LOTO)',
    desc: 'Previo a la intervención se bloquean, purgan y despresurizan las líneas de agua, vapor, aire o energía eléctrica a intervenir, verificando energía cero.',
    peligros: ['energia', 'temperatura', 'loc', 'posturas'],
    herr: ['Tarjetas y candados de bloqueo (LOTO)', 'Manómetro'], siguiente: ['corte', 'andamio'],
    claves: ['bloqueo', 'loto', 'purga', 'despresur', 'energia cero'] },
  { id: 'andamio', nombre: 'Armado de andamio para trabajo en altura',
    desc: 'Armado del andamio certificado con plataformas completas, barandas, rodapiés y escalera interna; nivelado, arriostrado y anclado. Inspección final del coordinador de alturas y tarjeta verde.',
    peligros: ['alturas', 'loc_objetos', 'mec_manual', 'loc', 'cargas'],
    herr: ['Andamio multidireccional', 'EPCC completo', 'Llaves mixtas', 'Niveles'], siguiente: ['linea_vida', 'acceso_altura'],
    claves: ['armado de andamio', 'andamio'] },
  { id: 'linea_vida', nombre: 'Instalación de conectores de anclaje (Tie-Off) y línea de vida horizontal',
    desc: 'El personal certificado asciende de forma segura y monta los conectores de anclaje y una línea de vida horizontal certificada anclada a un punto fijo.',
    peligros: ['alturas', 'loc_objetos', 'mec_manual', 'posturas'],
    herr: ['Conectores de anclaje (Tie-Off)', 'Líneas de vida', 'Puntos de anclaje certificados'], siguiente: ['acceso_altura'],
    claves: ['linea de vida', 'tie-off', 'tie off', 'anclaje'] },
  { id: 'acceso_altura', nombre: 'Acceso seguro al punto de trabajo en altura e inspección inicial',
    desc: 'Ascenso por el medio de acceso, conectado de forma permanente al sistema contra caídas, y evaluación visual del estado del punto a intervenir.',
    peligros: ['alturas', 'loc_objetos', 'rad_solar', 'posturas', 'natural'],
    siguiente: ['desarme', 'corte', 'desbaste'], claves: ['acceso', 'techo', 'ascenso', 'subir'] },
  { id: 'portico', nombre: 'Armado de grúa tipo pórtico',
    desc: 'Descarga y ubicación de las partes de la grúa en el área de ensamble; armado con andamio y herramientas manuales, uniones mecánicas que garanticen la integridad estructural.',
    peligros: ['mec_manual', 'psicosocial', 'loc', 'alturas', 'cargas', 'posturas', 'natural'],
    herr: ['Grúa tipo pórtico', 'Andamio multidireccional', 'Llaves mixtas'], siguiente: ['izaje'],
    claves: ['portico', 'grua'] },
  { id: 'izaje', nombre: 'Izaje y montaje mecánico con diferencial o grúa',
    desc: 'Con apoyo del diferencial o la grúa y eslingas certificadas se izan y posicionan las piezas, complementando con montaje manual en elementos livianos.',
    peligros: ['mec_izaje', 'loc_objetos', 'cargas', 'posturas', 'loc'],
    herr: ['Diferencial (polipasto)', 'Eslingas', 'Ganchos y grilletes certificados', 'Cuerdas guía'], siguiente: ['soldadura', 'tuberia'],
    claves: ['izaje', 'izar', 'diferencial', 'montaje mecanico'] },
  { id: 'desarme', nombre: 'Desarme o desmontaje con herramienta manual',
    desc: 'Desmontaje del equipo o componente con herramientas de mano (llaves fijas, expansivas, rachet) para inspeccionar y determinar la reparación.',
    peligros: ['mec_manual', 'posturas', 'cargas', 'loc'],
    herr: ['Llaves fijas', 'Llaves expansivas', 'Ratches'], siguiente: ['desbaste', 'inspeccion_visual'],
    claves: ['desarme', 'desmontaje', 'desmontar', 'desarmar'] },
  { id: 'corte', nombre: 'Corte con pulidora o motortool',
    desc: 'Corte del material o tubería con pulidora angular o motortool y limpieza de la zona de corte.',
    peligros: ['mec_rotativa', 'tec_caliente', 'ruido', 'vibracion', 'particulado', 'electrico', 'posturas'],
    herr: ['Pulidoras', 'Motor tool', 'Discos de corte y desbaste', 'Extensiones eléctricas', 'Extintor multipropósito'], siguiente: ['desbaste', 'soldadura'],
    claves: ['corte', 'cortar', 'motortool'] },
  { id: 'desbaste', nombre: 'Desbaste, pulido, lijado y limpieza con grata',
    desc: 'Desbaste y limpieza mecánica de la zona con pulidora, lijadora, motortool o grata para retirar pintura, óxido, escoria o material contaminado hasta exponer metal sano.',
    peligros: ['mec_rotativa', 'tec_caliente', 'ruido', 'vibracion', 'particulado', 'electrico', 'posturas'],
    herr: ['Pulidoras', 'Lijadoras', 'Grata eléctrica', 'Discos de corte y desbaste'], siguiente: ['soldadura', 'tintas', 'pintura'],
    claves: ['desbast', 'pulid', 'lijad', 'grata', 'bisel', 'brill', 'esmeril', 'abrasiv'] },
  { id: 'taladro', nombre: 'Perforación con taladro',
    desc: 'Perforación con taladro y broca adecuada al material, para anclajes, alivio de tensiones o uniones.',
    peligros: ['mec_taladro', 'ruido', 'vibracion', 'particulado', 'electrico', 'posturas'],
    herr: ['Taladro para metal', 'Taladro percutor', 'Extensiones eléctricas'], siguiente: ['soporteria', 'soldadura'],
    claves: ['taladr', 'perfor', 'agujero'] },
  { id: 'soporteria', nombre: 'Instalación de soportería anclada',
    desc: 'Ubicación, nivelación y anclaje de soportes mediante taladro y anclajes mecánicos.',
    peligros: ['mec_taladro', 'mec_manual', 'ruido', 'electrico', 'loc_objetos', 'posturas'],
    herr: ['Taladro percutor', 'Niveles', 'Flexómetro'], siguiente: ['tuberia', 'soldadura'],
    claves: ['soporte', 'mensula', 'soporteria'] },
  { id: 'precalentamiento', nombre: 'Precalentamiento con soplete',
    desc: 'Precalentamiento de la zona de la junta con soplete de gas, verificando la temperatura con crayón térmico o pirómetro.',
    peligros: ['tec_gas', 'temperatura', 'vapores', 'tec_caliente'],
    herr: ['Soplete', 'Cilindros de gas', 'Pirómetro', 'Crayón térmico'], siguiente: ['soldadura'],
    claves: ['precalent', 'soplete'] },
  { id: 'oxicorte', nombre: 'Corte con oxicorte',
    desc: 'Corte de material con equipo oxicombustible.',
    peligros: ['tec_gas', 'tec_caliente', 'humos', 'temperatura', 'rad_soldadura'],
    herr: ['Equipo de oxicorte', 'Cilindros de gas', 'Extintor multipropósito'], siguiente: ['desbaste', 'soldadura'],
    claves: ['oxicorte'] },
  { id: 'soldadura', nombre: 'Soldadura (SMAW, GTAW o GMAW)',
    desc: 'Personal soldador calificado ejecuta la soldadura aplicando los parámetros del procedimiento (WPS): amperaje, voltaje, velocidad de avance y temperatura entre pasadas.',
    peligros: ['tec_caliente', 'rad_soldadura', 'humos', 'electrico_sold', 'temperatura', 'posturas'],
    herr: ['Equipo de soldar SMAW', 'Equipo de soldar TIG', 'Extintor multipropósito', 'Manta ignífuga'], siguiente: ['desbaste', 'tintas', 'pintura'],
    claves: ['sold', 'smaw', 'gtaw', 'gmaw', 'tig', 'mig'] },
  { id: 'fabricacion', nombre: 'Fabricación metalmecánica en taller (corte, perforación, pulido, soldadura)',
    desc: 'Trabajo en caliente: trazado, corte, perforaciones, pulido, brillado y soldadura. Limpieza con trabajo químico y procesos abrasivos.',
    peligros: ['loc', 'cargas', 'posturas', 'tec_caliente', 'mec_manual', 'mec_rotativa', 'ruido', 'electrico', 'humos', 'particulado', 'biologico', 'natural'],
    herr: ['Pulidoras', 'Equipo de soldar SMAW', 'Taladro para metal', 'Extensiones eléctricas', 'Prensas mordazas'], siguiente: ['pintura', 'presion', 'orden'],
    claves: ['fabricacion', 'fabricar', 'taller', 'skid', 'tanque', 'recipiente', 'plataforma', 'guarda', 'bandeja', 'escalera', 'manifold', 'caja'] },
  { id: 'tuberia', nombre: 'Montaje de tubería',
    desc: 'Presentación, alineación y fijación de tramos de tubería sobre la soportería instalada, para su posterior soldadura o acople.',
    peligros: ['cargas', 'mec_manual', 'loc_objetos', 'posturas', 'loc'],
    herr: ['Llaves mixtas', 'Niveles', 'Flexómetro'], siguiente: ['soldadura', 'presion'],
    claves: ['tuberia', 'tubo', 'ruteo', 'linea'] },
  { id: 'tornilleria', nombre: 'Sustitución de tornillería y aplicación de torque',
    desc: 'Retiro de la tornillería antigua y reemplazo por tornillos, tuercas y arandelas nuevos, aplicando el torque técnico con herramientas manuales.',
    peligros: ['mec_manual', 'posturas', 'loc'],
    herr: ['Llaves mixtas', 'Ratches'], siguiente: ['inspeccion_visual'],
    claves: ['tornill', 'torque', 'perno', 'tuerca'] },
  { id: 'inspeccion_visual', nombre: 'Inspección visual y control de calidad',
    desc: 'Verificación visual y técnica de la reparación (cordones de soldadura, torque, estado del metal base), con registro fotográfico.',
    peligros: ['posturas', 'temperatura', 'iluminacion', 'loc'],
    herr: ['Pirómetro'], siguiente: ['tintas', 'desmontaje_andamio', 'orden'],
    claves: ['inspeccion visual', 'control de calidad', 'verificacion', 'localizar'] },
  { id: 'tintas', nombre: 'Ensayo de tintas penetrantes (END)',
    desc: 'Limpieza de la superficie, aplicación del penetrante, tiempo de penetración, limpieza del exceso y aplicación del revelador para verificar ausencia de fisuras y discontinuidades.',
    peligros: ['vapores', 'quimico_piel', 'tec_inflamable', 'temperatura', 'posturas', 'loc_derrame'],
    herr: ['Tintas penetrantes', 'Pirómetro'], siguiente: ['soldadura', 'presion', 'orden'],
    claves: ['tinta', 'penetrante', 'ensayo no destructivo', 'ensayos no destructivos'] },
  { id: 'pintura', nombre: 'Aplicación de pintura o recubrimiento',
    desc: 'Preparación de superficie y aplicación de pintura o recubrimiento de protección.',
    peligros: ['vapores', 'quimico_piel', 'tec_inflamable', 'posturas', 'loc_derrame'],
    siguiente: ['orden'], claves: ['pintur', 'recubrim', 'anticorros'] },
  { id: 'quimico', nombre: 'Limpieza química, decapado o pasivado',
    desc: 'Limpieza de piezas con productos químicos (desengrasantes, decapantes o pasivantes) según la ficha de seguridad.',
    peligros: ['quimico_piel', 'vapores', 'loc_derrame', 'posturas'],
    siguiente: ['orden'], claves: ['decapad', 'pasivad', 'limpieza quimica', 'desengras'] },
  { id: 'presion', nombre: 'Prueba de presión (neumática o hidrostática)',
    desc: 'Presurización gradual del equipo o línea con aire, nitrógeno o agua hasta la presión de prueba, verificando estanqueidad y ausencia de fugas.',
    peligros: ['tec_presion', 'ruido', 'loc', 'loc_derrame'],
    herr: ['Manómetro'], siguiente: ['orden'], claves: ['prueba', 'presion', 'presuriz', 'neumatic', 'hidrostat'] },
  { id: 'confinado', nombre: 'Ingreso y trabajo en espacio confinado',
    desc: 'Medición de atmósfera, ventilación, ingreso con vigía en la entrada y ejecución de la tarea dentro del espacio confinado.',
    peligros: ['confinados', 'posturas', 'temperatura', 'iluminacion', 'psicosocial'],
    herr: ['Medidor de atmósferas (multigás)', 'Extractor de aire'], siguiente: ['soldadura', 'desbaste', 'inspeccion_visual'],
    claves: ['confinad', 'interior del tanque', 'dentro del tanque', 'manhole'] },
  { id: 'desmontaje_andamio', nombre: 'Desmontaje de andamio y sistemas de protección contra caídas',
    desc: 'Desmontaje seguro, ordenado y en secuencia inversa de la línea de vida, los conectores de anclaje y el andamio, módulo por módulo.',
    peligros: ['alturas', 'loc_objetos', 'mec_manual', 'cargas', 'loc'],
    herr: ['EPCC completo', 'Llaves mixtas'], siguiente: ['orden'], claves: ['desmontaje de andamio', 'desarme de andamio'] },
  { id: 'mantenimiento', nombre: 'Mantenimiento interno de bodega',
    desc: 'Arreglo y adecuación de cajones portaherramientas, mesas de trabajo, escaleras, carros porta cilindros, carpas y activos en general.',
    peligros: ['loc', 'cargas', 'posturas', 'tec_caliente', 'mec_manual', 'ruido', 'electrico', 'particulado'],
    siguiente: ['orden'], claves: ['mantenimiento', 'adecuacion', 'arreglo', 'reparacion de activos'] },
  { id: 'traslado_manual', nombre: 'Traslado manual de materiales, equipos y herramientas',
    desc: 'Traslado de materiales, equipos y herramientas desde el punto de descargue o bodega hasta el sitio de trabajo, con carretilla, patines o entre varias personas.',
    peligros: ['cargas', 'posturas', 'loc', 'loc_objetos', 'mec_manual', 'transito'],
    herr: ['Carretilla', 'Patines'], siguiente: ['andamio', 'fabricacion', 'tuberia', 'orden'],
    claves: ['traslado', 'trasladar', 'transportar', 'llevar', 'cargar', 'manipulacion', 'mover material'] },
  { id: 'cargue', nombre: 'Cargue de vehículo y transporte de materiales o fabricaciones',
    desc: 'Cargue del vehículo con montacargas, grúa o manualmente, amarre y aseguramiento de la carga y transporte hasta el sitio del cliente.',
    peligros: ['cargas', 'posturas', 'mec_izaje', 'loc_objetos', 'transito', 'mec_lamina'],
    herr: ['Montacargas', 'Eslingas', 'Manilas', 'Carretilla'], siguiente: ['descargue', 'orden'],
    claves: ['cargue', 'cargar el camion', 'vehiculo', 'camion', 'transporte', 'amarre de carga'] },
  { id: 'medicion', nombre: 'Visita técnica, levantamiento de medidas y replanteo',
    desc: 'Recorrido por el área del cliente para tomar medidas, verificar interferencias y marcar los puntos de trabajo.',
    peligros: ['loc', 'transito', 'posturas', 'ruido', 'biologico', 'natural'],
    herr: ['Flexómetro', 'Nivel láser', 'Escalera tipo tijera'], siguiente: ['orden'],
    claves: ['medida', 'medicion', 'levantamiento', 'visita', 'replanteo', 'marcacion'] },
  { id: 'estructura', nombre: 'Montaje de estructura metálica (vigas, columnas, cerchas, plataformas)',
    desc: 'Presentación, izaje, nivelación, fijación con pernos y/o soldadura de elementos estructurales, con apoyo de andamio o plataforma elevadora.',
    peligros: ['mec_izaje', 'alturas', 'loc_objetos', 'mec_manual', 'cargas', 'posturas', 'tec_caliente'],
    herr: ['Diferencial (polipasto)', 'Eslingas', 'Cuerdas guía', 'Llaves mixtas', 'Torquímetro', 'Niveles'], siguiente: ['soldadura', 'tornilleria', 'pintura', 'orden'],
    claves: ['estructura', 'viga', 'columna', 'cercha', 'plataforma metalica', 'escalera metalica', 'pasarela', 'montaje de estructura'] },
  { id: 'cubierta', nombre: 'Instalación o cambio de cubierta, láminas o canales en techo',
    desc: 'Retiro e instalación de láminas de cubierta, canales o bajantes, desplazándose sobre la cubierta con línea de vida y tablones.',
    peligros: ['alturas', 'mec_lamina', 'loc_objetos', 'cargas', 'rad_solar', 'natural', 'mec_manual'],
    herr: ['Líneas de vida', 'EPCC completo', 'Atornillador inalámbrico', 'Tijeras para lámina', 'Remachadora manual'], siguiente: ['orden'],
    claves: ['cubierta', 'techo', 'teja', 'lamina de techo', 'canal', 'bajante', 'claraboya'] },
  { id: 'valvulas', nombre: 'Cambio de válvulas, bridas o empaques',
    desc: 'Con la línea bloqueada, despresurizada y drenada, se desmonta la válvula o brida, se cambian empaques y se instala el elemento nuevo aplicando torque.',
    peligros: ['energia', 'tec_presion', 'temperatura', 'mec_manual', 'cargas', 'posturas', 'loc_derrame'],
    herr: ['Llaves mixtas', 'Llave de tubo (Stilson)', 'Torquímetro', 'Tarjetas y candados de bloqueo (LOTO)', 'Material absorbente'], siguiente: ['presion', 'orden'],
    claves: ['valvula', 'brida', 'empaque', 'cambio de valvula', 'trampa de vapor', 'filtro'] },
  { id: 'bombas', nombre: 'Mantenimiento de bombas, motores o reductores',
    desc: 'Bloqueo del equipo, desacople, desarme, cambio de rodamientos, sellos o retenes, armado, alineación y prueba de funcionamiento.',
    peligros: ['mec_atrapamiento', 'energia', 'electrico', 'mec_manual', 'cargas', 'posturas', 'loc_derrame', 'ruido'],
    herr: ['Extractor de rodamientos', 'Llaves mixtas', 'Tecle de cadena', 'Tarjetas y candados de bloqueo (LOTO)', 'Multímetro'], siguiente: ['orden'],
    claves: ['bomba', 'motor', 'reductor', 'rodamiento', 'sello mecanico', 'alineacion', 'acople', 'compresor'] },
  { id: 'banda', nombre: 'Mantenimiento de bandas transportadoras o máquinas de línea de producción',
    desc: 'Con la máquina detenida y bloqueada, se ajustan o cambian bandas, rodillos, cadenas o piezas de la línea de producción del cliente.',
    peligros: ['mec_atrapamiento', 'energia', 'electrico', 'mec_manual', 'posturas', 'ruido', 'loc'],
    herr: ['Tarjetas y candados de bloqueo (LOTO)', 'Llaves mixtas', 'Llaves Allen'], siguiente: ['orden'],
    claves: ['banda', 'transportador', 'linea de produccion', 'maquina', 'rodillo', 'cadena', 'envasadora', 'llenadora'] },
  { id: 'instalacion_electrica', nombre: 'Instalación o conexión eléctrica (tableros, cableado, acometidas)',
    desc: 'Con el circuito desenergizado y bloqueado, se tiende y conecta el cableado, se instalan tableros o tomas y se verifica ausencia de tensión antes y después.',
    peligros: ['electrico', 'energia', 'mec_manual', 'posturas', 'loc'],
    herr: ['Herramienta aislada 1000 V', 'Probador de tensión (detector)', 'Pinza voltiamperimétrica', 'Pelacables', 'Tarjetas y candados de bloqueo (LOTO)'], siguiente: ['orden'],
    claves: ['electric', 'cableado', 'cable', 'tablero', 'acometida', 'toma', 'luminaria', 'breaker', 'conexion electrica'] },
  { id: 'instrumentacion', nombre: 'Instalación de instrumentación (sensores, manómetros, termómetros)',
    desc: 'Montaje y conexión de instrumentos en tuberías o equipos, con la línea bloqueada y despresurizada.',
    peligros: ['energia', 'tec_presion', 'mec_manual', 'posturas', 'electrico'],
    herr: ['Llaves mixtas', 'Manómetro', 'Multímetro'], siguiente: ['presion', 'orden'],
    claves: ['instrument', 'sensor', 'transmisor', 'manometro', 'termometro', 'termopozo'] },
  { id: 'aislamiento', nombre: 'Aislamiento térmico de tubería o equipos',
    desc: 'Instalación de cañuela o lana mineral y recubrimiento con lámina de aluminio sobre tuberías o equipos.',
    peligros: ['particulado', 'mec_lamina', 'quimico_piel', 'posturas', 'temperatura', 'loc_objetos'],
    herr: ['Tijeras para lámina', 'Remachadora manual', 'Flexómetro'], siguiente: ['orden'],
    claves: ['aislamiento', 'aislar', 'canuela', 'lana mineral', 'lana de vidrio', 'recubrimiento de aluminio'] },
  { id: 'hidrolavado', nombre: 'Lavado a presión (hidrolavado) de equipos o superficies',
    desc: 'Limpieza con hidrolavadora de equipos, pisos o estructuras, controlando el agua residual y las conexiones eléctricas cercanas.',
    peligros: ['tec_presion', 'loc_derrame', 'electrico', 'ruido', 'quimico_piel', 'posturas'],
    herr: ['Hidrolavadora', 'Extensiones eléctricas', 'Cinta y conos de delimitación'], siguiente: ['orden'],
    claves: ['hidrolav', 'lavado', 'lavar', 'presion de agua', 'limpieza con agua'] },
  { id: 'limpieza_tanque', nombre: 'Limpieza interna de tanques o recipientes',
    desc: 'Vaciado, bloqueo de líneas, ventilación, medición de atmósfera y limpieza interna del tanque con vigía permanente.',
    peligros: ['confinados', 'vapores', 'quimico_piel', 'biologico', 'posturas', 'loc_derrame', 'energia'],
    herr: ['Medidor de atmósferas (multigás)', 'Extractor de aire', 'Hidrolavadora', 'Reflector portátil'], siguiente: ['inspeccion_visual', 'orden'],
    claves: ['limpieza de tanque', 'tanque', 'silo', 'recipiente', 'marmita', 'interior del tanque'] },
  { id: 'excavacion', nombre: 'Excavación manual o zanja',
    desc: 'Excavación con pala y pica para cimentaciones, ductos o tuberías enterradas, con verificación previa de redes y señalización del perímetro.',
    peligros: ['excavacion', 'cargas', 'posturas', 'mec_manual', 'rad_solar', 'natural', 'particulado'],
    herr: ['Palas', 'Picas', 'Barras', 'Carretilla', 'Cinta y conos de delimitación'], siguiente: ['obra_civil', 'tuberia', 'orden'],
    claves: ['excava', 'zanja', 'hueco', 'cimentacion', 'brecha'] },
  { id: 'obra_civil', nombre: 'Obra civil: demolición, resanes, concreto o mampostería',
    desc: 'Demolición menor, preparación y vaciado de concreto, resanes y mampostería en el área del cliente.',
    peligros: ['particulado', 'cargas', 'posturas', 'mec_manual', 'ruido', 'vibracion', 'loc', 'quimico_piel'],
    herr: ['Martillo demoledor', 'Mezcladora de concreto', 'Palas', 'Baldes', 'Llanas y palustres'], siguiente: ['orden'],
    claves: ['obra civil', 'demol', 'concreto', 'resane', 'mamposteria', 'pañete', 'base de concreto', 'placa'] },
  { id: 'orden', nombre: 'Orden y aseo', fin: true,
    desc: 'Retiro de residuos (virutas, restos de soldadura, empaques), limpieza del área, recolección y almacenamiento de herramientas verificando su estado, y retiro de la señalización una vez el área sea segura.',
    peligros: ['loc', 'cargas', 'posturas', 'biologico', 'natural'],
    claves: ['orden', 'aseo', 'limpieza', '5s'] }
];

/* Controles de la tarea especial "Plan de rescate" (sus ATS la incluyen como
   una fila más, con pasos de atención en vez de controles de prevención). */
const PLAN_RESCATE = {
  nombre: 'Plan de rescate: alturas, trabajo en caliente, piso y otros',
  pasos: [
    'Informar al jefe inmediato y a SST',
    'Evaluar la situación: verificar si la persona está consciente, respira y tiene pulso',
    'Llamar a emergencias (línea 123) si es necesario',
    'Mantener la calma y tranquilizar a la persona afectada',
    'Evaluar lesiones: heridas, fracturas, quemaduras',
    'Aplicar RCP si la persona no respira o no tiene pulso (solo personal capacitado)',
    'Controlar sangrados con presión directa',
    'Inmovilizar extremidades lesionadas',
    'Esperar la ayuda y seguir sus instrucciones',
    'Traslado a centro médico',
    'Registrar el incidente y analizarlo para prevenir que se repita'
  ]
};

/* ============================================================
   CONDICIONES DE LA TAREA — atajos que agregan de una vez los peligros de
   una condición ("esta tarea se hace en altura"). Si el encabezado del ATS
   ya marca el permiso correspondiente, la condición se resalta.
   claves     palabras que, escritas en la tarea, la sugieren
   soloTexto  se sugiere solo por lo escrito, no por los peligros de la
              tarea tipo (ej. "cuarto frío" comparte peligro con "superficies calientes")
   ============================================================ */
const CONDICIONES = [
  { id: 'altura', nombre: 'En altura', peligros: ['alturas', 'loc_objetos'], permiso: 'alturas', claves: ['altura', 'andamio', 'techo', 'cubierta', 'escalera', 'plataforma', 'manlift'] },
  { id: 'caliente', nombre: 'En caliente', peligros: ['tec_caliente'], permiso: 'caliente', claves: ['sold', 'oxicorte', 'soplete', 'corte con pulidora', 'caliente', 'chispa'] },
  { id: 'confinado', nombre: 'Espacio confinado', peligros: ['confinados'], permiso: 'confinados', claves: ['confinado', 'tanque', 'silo', 'pozo', 'interior del', 'ducto'] },
  { id: 'izaje', nombre: 'Con izaje de cargas', peligros: ['mec_izaje'], permiso: 'izaje', claves: ['izaje', 'izar', 'diferencial', 'grua', 'polipasto', 'tecle'] },
  { id: 'manual', nombre: 'Manipulación manual de cargas', peligros: ['cargas', 'posturas'], claves: ['cargar', 'cargue', 'descargue', 'traslado', 'trasladar', 'mover', 'levantar', 'manipulacion', 'bulto', 'a mano', 'subir material', 'bajar material', 'peso'] },
  { id: 'posturas', nombre: 'Posturas forzadas o prolongadas', peligros: ['posturas'], claves: ['arrodill', 'agachad', 'acostado', 'de pie', 'bajo el equipo', 'dificil acceso'] },
  { id: 'repetitivo', nombre: 'Movimientos repetitivos', peligros: ['repetitivo'], claves: ['repetit', 'atornill', 'lijado', 'embalaje', 'empacar'] },
  { id: 'reducido', nombre: 'Espacio reducido o de difícil acceso', peligros: ['posturas', 'loc'], claves: ['reducido', 'estrecho', 'dificil acceso', 'debajo', 'bajo el equipo'] },
  { id: 'electrica', nombre: 'Herramienta eléctrica', peligros: ['electrico', 'ruido'], claves: ['pulid', 'taladr', 'motortool', 'electric', 'lijadora', 'tronzadora'] },
  { id: 'energias', nombre: 'Líneas energizadas o a presión', peligros: ['energia'], permiso: 'electrico', claves: ['energiz', 'vapor', 'aire comprimido', 'presion', 'linea', 'tablero'] },
  { id: 'partes_moviles', nombre: 'Máquinas con partes móviles', peligros: ['mec_atrapamiento'], claves: ['banda', 'polea', 'motor', 'bomba', 'maquina', 'rodillo', 'reductor', 'linea de produccion'] },
  { id: 'presion', nombre: 'Equipos o pruebas a presión', peligros: ['tec_presion'], claves: ['prueba de presion', 'hidrostatica', 'neumatica', 'hidrolav', 'compresor'] },
  { id: 'gases', nombre: 'Con cilindros de gas', peligros: ['tec_gas'], claves: ['cilindro', 'oxicorte', 'acetileno', 'propano', 'soplete', 'oxigeno'] },
  { id: 'inflamables', nombre: 'Cerca de inflamables o combustibles', peligros: ['tec_inflamable'], claves: ['inflamable', 'combustible', 'solvente', 'thinner', 'gasolina', 'acpm', 'pintura'] },
  { id: 'superficies_calientes', nombre: 'Superficies o líneas calientes', peligros: ['temperatura'], claves: ['vapor', 'caldera', 'horno', 'caliente', 'marmita', 'aceite termico'] },
  { id: 'frio', nombre: 'Cuarto frío o bajas temperaturas', peligros: ['temperatura'], soloTexto: true, claves: ['cuarto frio', 'refriger', 'congel', 'camara fria'] },
  { id: 'quimicos', nombre: 'Con químicos', peligros: ['vapores', 'quimico_piel'], claves: ['quimic', 'decap', 'pasiv', 'solvente', 'acido', 'soda', 'desengras', 'pintura'] },
  { id: 'polvo', nombre: 'Genera polvo o partículas', peligros: ['particulado'], claves: ['pulid', 'lij', 'desbast', 'demol', 'corte', 'polvo', 'grata', 'sandblast'] },
  { id: 'humos', nombre: 'Genera humos o gases', peligros: ['humos'], claves: ['sold', 'oxicorte', 'humo', 'soplete'] },
  { id: 'ruido', nombre: 'Ruido alto', peligros: ['ruido'], claves: ['ruido', 'pulid', 'martillo', 'compresor', 'demol'] },
  { id: 'vibracion', nombre: 'Herramientas que vibran', peligros: ['vibracion'], claves: ['vibra', 'pulid', 'martillo demoledor', 'rotomartillo', 'lijadora'] },
  { id: 'humedo', nombre: 'Superficies mojadas o con aceite', peligros: ['loc_derrame'], claves: ['mojad', 'humed', 'agua', 'aceite', 'hidrolav', 'lavado', 'derrame'] },
  { id: 'excavacion', nombre: 'Excavación o zanja', peligros: ['excavacion'], claves: ['excava', 'zanja', 'hueco', 'cimentacion'] },
  { id: 'filos', nombre: 'Láminas o piezas con filos', peligros: ['mec_lamina'], claves: ['lamina', 'chapa', 'filo', 'lamina de aluminio', 'cubierta'] },
  { id: 'intemperie', nombre: 'A la intemperie', peligros: ['rad_solar', 'natural'], claves: ['intemperie', 'exterior', 'techo', 'cubierta', 'patio', 'al aire libre'] },
  { id: 'nocturno', nombre: 'Nocturno o poca iluminación', peligros: ['iluminacion', 'psicosocial'], claves: ['noche', 'nocturno', 'turno', 'oscur', 'poca luz'] },
  { id: 'vehiculos', nombre: 'Cerca de vehículos o montacargas', peligros: ['transito'], claves: ['montacarga', 'vehiculo', 'camion', 'parqueadero', 'via', 'patio de maniobras'] },
  { id: 'residuos', nombre: 'Con residuos o aguas residuales', peligros: ['biologico'], claves: ['ptar', 'residual', 'alcantarill', 'residuo', 'basura', 'trampa de grasa'] }
];
