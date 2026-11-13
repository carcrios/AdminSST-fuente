/* ============================================================
   preop-base.js — Preoperacionales base del portal (v123–v124)
   Hechos a partir de formatos reales; van SIN código: cada empresa les pone
   su nombre y su código en «Menús» (EMPRESA.bautizos.preop). Basados en los formatos (SSTA-F-082, 171, 065, 083, 018, 163;
   v124: 010, 011, 012, 015, 047, 048, 167 y 189).
   Sirven a toda empresa nueva; si la empresa importa sus formularios de Google
   (preop-formularios.js) con el mismo id, se usa el suyo. El administrador puede
   apagar cualquiera para una empresa (EMPRESA.ocultos.preop).
   ============================================================ */
const PREOP_BASE = [
 {
  "id": "montacargas",
  "nombre": "Montacargas",
  "grupo": "Equipos móviles",
  "titulo": "Montacargas",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código o placa del montacargas",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "texto",
      "titulo": "Marca"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Gafas de lente claro en buen estado",
       "Casco en buen estado",
       "Usa el cinturón de seguridad"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Parte externa",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Espejos laterales sin roturas, sin manchas y ajustados",
       "Luces traseras: freno (2 rojas), direccionales (2 amarillas), retroceso (2 blancas)",
       "Alarma de reversa funciona automáticamente",
       "Extintor PQS de 10 libras recargado y revisado",
       "Llantas sin rajaduras ni desgaste excesivo",
       "Placa del montacargas en buen estado y legible",
       "Cilindros de elevación e inclinación sin escapes ni daños",
       "Montura de los cilindros firme",
       "Luces frontales altas funcionan",
       "Direccionales funcionan (mínimo dos)",
       "Luces delanteras: lentes sin roturas, funcionando",
       "Luces de parqueo funcionan (mínimo dos)",
       "Tanque de combustible sin fugas, ajustado y con tapa original"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Compartimiento del motor",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Fuente de energía sin rajaduras y aislada",
       "Conexiones eléctricas firmes y en buen estado",
       "Nivel de agua de refrigeración correcto y mangueras sin fugas",
       "Líneas hidráulicas sin fugas y en buen estado",
       "Niveles de aceite de motor e hidráulico según el fabricante",
       "Cableado eléctrico aislado, sin roturas y ajustado",
       "Botella de dirección y aceite sin fugas, bien asegurada"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Interior de la cabina",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Espejo retrovisor interior sin roturas ni manchas",
       "Cabina del operador protegida y en buen estado",
       "Indicador de combustible muestra el nivel",
       "Indicador de presión de aceite se ilumina al encender",
       "Silla atornillada al piso, asegurada, con forro antideslizante y sin juego excesivo",
       "Alarma de retroceso funciona",
       "Cinturón de seguridad de 3 puntos",
       "Pito funciona y se oye a 50 m",
       "Timón o volante en perfectas condiciones",
       "Frenos: pedales antideslizantes y nivel de líquido correcto",
       "Horómetro funciona, legible y dentro del rango de mantenimiento"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p11",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p12",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p13",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "plataforma-tijera",
  "nombre": "Plataforma eléctrica tipo tijera",
  "grupo": "Equipos móviles",
  "titulo": "Plataforma eléctrica tipo tijera",
  "codigo": "",
  "descripcion": "Antes de usarla: equipo de alturas y capacidad de carga revisados. Si algo está «Malo», no se inicia el trabajo.",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del equipo",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Casco con careta de seguridad",
       "Protección auditiva",
       "Gafas",
       "Guantes",
       "Botas de seguridad",
       "Equipo de alturas"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Equipo",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Estructura general (plataforma, canastilla, puerta, extensión, baranda)",
       "Llantas",
       "Movimiento de llantas",
       "Sistema de bloqueo",
       "Indicadores de seguridad / sensores",
       "Estabilizadores",
       "Pistones extensibles",
       "Tijeras y bisagras",
       "Nivel de aceite hidráulico",
       "Mangueras hidráulicas",
       "Tablero de control superior (palanca y botones)",
       "Tablero de control inferior (palanca y botones)",
       "Alarmas sonoras",
       "Alarmas visuales",
       "Paradas de emergencia",
       "Cables de alimentación eléctrica"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Condiciones",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El terreno donde se va a trabajar está nivelado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p9",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p10",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p11",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "camioneta",
  "nombre": "Camioneta / vehículo",
  "grupo": "Equipos móviles",
  "titulo": "Camioneta / vehículo",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Placa",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "texto",
      "titulo": "Vehículo y modelo"
     },
     {
      "k": "p7",
      "tipo": "texto",
      "titulo": "Kilometraje"
     },
     {
      "k": "p8",
      "tipo": "texto",
      "titulo": "N.º de licencia y categoría del conductor"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Documentos",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Licencia de tránsito",
       "Revisión técnico-mecánica",
       "Seguro obligatorio (SOAT)",
       "Seguro de terceros",
       "Licencia de conducción",
       "Contactos de emergencia"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Botas",
       "Overol de trabajo",
       "Guantes",
       "Protección auditiva",
       "Monogafas",
       "Radio teléfono o celular",
       "Casco"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p11",
      "tipo": "cuadricula",
      "titulo": "Equipo de emergencias",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Linterna con pilas",
       "Botiquín",
       "Conos",
       "Extintor con pin de seguridad, cargado y vigente"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p12",
      "tipo": "cuadricula",
      "titulo": "Herramientas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Triángulos reflectores (2)",
       "Gato",
       "Caja de herramientas",
       "Cruceta",
       "Tacos",
       "Llanta de repuesto",
       "Cables de arranque"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p13",
      "tipo": "cuadricula",
      "titulo": "Vidrios y espejos",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Parabrisas",
       "Limpiaparabrisas",
       "Vidrios laterales",
       "Vidrio trasero",
       "Espejo retrovisor",
       "Espejos laterales"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p14",
      "tipo": "cuadricula",
      "titulo": "Luces",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Bajas",
       "Plenas",
       "Direccionales",
       "Reversa",
       "Antiniebla",
       "Luces de cabina",
       "Luces de emergencia (estacionarias)"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p15",
      "tipo": "cuadricula",
      "titulo": "Fluidos",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Aceite de motor (y fecha del último cambio)",
       "Aceite hidráulico",
       "Líquido de frenos",
       "Refrigerante",
       "Agua del limpiaparabrisas",
       "Nivel de combustible",
       "Sin fugas de lubricantes",
       "Sin fugas de agua"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p16",
      "tipo": "cuadricula",
      "titulo": "Otros",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Freno de mano",
       "Correa del ventilador",
       "Eslingas con trinquete",
       "Manila",
       "Gancho de remolque",
       "Cojinería, sillas y tapicería",
       "Aseo del vehículo",
       "Manijas, chapas y seguros de puertas",
       "Elevavidrios y ajuste de puertas",
       "Bocina",
       "Cinturones de seguridad delanteros",
       "Mandos eléctricos y tablero de controles",
       "Aire acondicionado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p17",
      "tipo": "cuadricula",
      "titulo": "Neumáticos (desgaste, estructura y presión)",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Delantero derecho",
       "Delantero izquierdo",
       "Trasero derecho",
       "Trasero izquierdo",
       "Llanta de repuesto"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p18",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p19",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p20",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "escalera",
  "nombre": "Escalera de mano",
  "grupo": "Trabajo en alturas",
  "titulo": "Escalera de mano",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código de la escalera",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "opcion",
      "titulo": "Tipo de escalera",
      "opciones": [
       "Tijera",
       "Extensión",
       "Avión o de acceso"
      ]
     },
     {
      "k": "p7",
      "tipo": "texto",
      "titulo": "Marca / fabricante"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Inspección",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Zapatas / patas en buen estado",
       "Rieles / planos verticales en buen estado",
       "Escalones / peldaños en buen estado",
       "Tope superior en buen estado",
       "Sin partes oxidadas, corroídas, rajadas, sueltas o faltantes",
       "Etiquetas legibles",
       "Seguros de peldaños funcionan",
       "Cuerdas / poleas en buen estado (escalera de extensión)"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p9",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p10",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p11",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "equipo-alturas",
  "nombre": "Equipo de alturas (arnés, eslinga, tie off)",
  "grupo": "Trabajo en alturas",
  "titulo": "Equipo de alturas (arnés, eslinga, tie off)",
  "codigo": "",
  "descripcion": "Se inspecciona antes de cada uso. Solo se llena el día que se usa el equipo.",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Serial o código del arnés",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "texto",
      "titulo": "Marca y tipo de arnés"
     },
     {
      "k": "p7",
      "tipo": "texto",
      "titulo": "Serial de la eslinga"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Arnés · cintas y correas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin hoyos ni agujeros",
       "Sin cintas deshilachadas",
       "Sin desgaste",
       "Sin talladuras",
       "Sin torsión (fibras duras o deformadas)",
       "Sin contaminación excesiva por suciedad",
       "Sin quemaduras (soldadura, cigarrillo…)",
       "Sin salpicaduras de pintura ni rigidez",
       "Sin degradación por UV (pérdida de color, superficie quebradiza)",
       "Sin ataque por sustancias químicas",
       "Sin cortes de 1 mm en orillos o bordes",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Arnés · costuras",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin costuras abiertas",
       "Sin hebras sueltas",
       "Sin costuras reventadas",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Arnés · partes metálicas y hebillas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin desgaste en los extremos",
       "Sin corrosión",
       "Sin deformación",
       "Sin fisuras, golpes ni hundimientos",
       "Sin aristas ni bordes filosos o arrugados",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p11",
      "tipo": "cuadricula",
      "titulo": "Eslinga · mosquetón",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin desgaste en los extremos",
       "Sin corrosión",
       "Sin deformación",
       "Sin fisuras, golpes ni hundimientos",
       "Sin aristas ni bordes filosos o arrugados",
       "Doble seguro funciona",
       "Abren y cierran correctamente",
       "Ojetes sin deformaciones ni roturas"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p12",
      "tipo": "cuadricula",
      "titulo": "Eslinga · reatas y cuerdas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin hoyos ni agujeros",
       "Sin cintas deshilachadas",
       "Sin desgaste",
       "Sin talladuras",
       "Sin torsión (fibras duras o deformadas)",
       "Sin contaminación excesiva por suciedad",
       "Sin quemaduras (soldadura, cigarrillo…)",
       "Sin salpicaduras de pintura ni rigidez",
       "Sin degradación por UV (pérdida de color, superficie quebradiza)",
       "Sin ataque por sustancias químicas",
       "Sin cortes de 1 mm en orillos o bordes",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p13",
      "tipo": "cuadricula",
      "titulo": "Eslinga · costuras",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin costuras abiertas",
       "Sin hebras sueltas",
       "Sin costuras reventadas",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p14",
      "tipo": "cuadricula",
      "titulo": "Tie off · partes metálicas y hebillas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin desgaste en los extremos",
       "Sin corrosión",
       "Sin deformación",
       "Sin fisuras, golpes ni hundimientos",
       "Sin aristas ni bordes filosos o arrugados",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p15",
      "tipo": "cuadricula",
      "titulo": "Tie off · reatas y cuerdas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin hoyos ni agujeros",
       "Sin cintas deshilachadas",
       "Sin desgaste",
       "Sin talladuras",
       "Sin torsión (fibras duras o deformadas)",
       "Sin contaminación excesiva por suciedad",
       "Sin quemaduras (soldadura, cigarrillo…)",
       "Sin salpicaduras de pintura ni rigidez",
       "Sin degradación por UV (pérdida de color, superficie quebradiza)",
       "Sin ataque por sustancias químicas",
       "Sin cortes de 1 mm en orillos o bordes",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p16",
      "tipo": "cuadricula",
      "titulo": "Tie off · costuras",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin costuras abiertas",
       "Sin hebras sueltas",
       "Sin costuras reventadas",
       "Sin otros daños"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p17",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p18",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p19",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "camilla",
  "nombre": "Camilla",
  "grupo": "Emergencias",
  "titulo": "Camilla",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección (operador)",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código o ubicación de la camilla",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "Inspección visual",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Sin daños visibles en la estructura (grietas, roturas o partes sueltas)",
       "Partes móviles íntegras (bisagras y seguros de bloqueo)"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Superficie",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Superficie sin imperfecciones (rayones, abolladuras o manchas)",
       "Superficie limpia y libre de obstrucciones"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Dispositivos de seguridad",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Correas de sujeción presentes y en buen estado",
       "Seguros de bloqueo funcionan y aseguran la posición"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Capacidad de carga",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Capacidad de carga adecuada para transportar al paciente",
       "No se excede la capacidad máxima del fabricante"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Portabilidad",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Ligera y fácil de manipular en una emergencia",
       "Mangos de transporte firmes y cómodos"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p11",
      "tipo": "cuadricula",
      "titulo": "Señalización",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Señalizada con su información de identificación",
       "Manual de instrucciones a la mano"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p12",
      "tipo": "cuadricula",
      "titulo": "Capacitación",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El personal que la usa está capacitado en su manejo y transporte",
       "El personal conoce los primeros auxilios y el uso correcto de la camilla"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p13",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p14",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p15",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "herramientas-menores",
  "nombre": "Herramientas menores",
  "grupo": "Herramientas y equipos",
  "titulo": "Herramientas menores",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Caja o juego de herramientas (código o dueño)",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "Llaves expansivas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El sinfín está en buen estado, sin desgastes ni hilos quebrados, y se desliza sin forzarlo",
       "La cremallera y el sinfín ajustan sin juego que permita que se suelten",
       "Boca libre de deformaciones o grietas, ajusta sin torcerse",
       "Es original, sin signos de reparación"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Llaves mixtas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Las estrías están en buen estado",
       "Las bocas de las llaves fijas están originales, sin desbastar",
       "Conservan su forma original, no están torcidas ni dobladas",
       "Bocas sin deformaciones ni grietas y paralelas a sus caras",
       "Hay llaves suficientes en tamaños, sin necesidad de acuñarlas o usar extensiones de tubo"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Martillos",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El mango está acuñado con seguridad y encaja en la cabeza",
       "Los mangos están libres de asperezas y astillas",
       "Las cabezas están libres de rebabas"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Pinzas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Las quijadas están sin desgastes ni golpes",
       "Mangos en buen estado, sin deformaciones y aislados",
       "El tornillo o pasador está en buen estado, sin juego en las quijadas"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Hombresolo",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El sinfín está en buen estado y se desliza sin forzarlo",
       "El dispositivo de fijación ajusta correctamente, no se suelta",
       "Boca libre de deformaciones o grietas, ajusta sin torcerse"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p11",
      "tipo": "cuadricula",
      "titulo": "Destornilladores",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Mangos sin roturas, sueltos ni partidos",
       "Hoja y vástago alineados, sin torceduras",
       "Palas a escuadra, estrías afiladas y limpias",
       "Mangos aislados"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p12",
      "tipo": "cuadricula",
      "titulo": "Ratches",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El mecanismo de reversión funciona sin retenciones",
       "Hay copas en cantidad y medidas suficientes para el trabajo",
       "Las estrías de las copas están en perfecto estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p13",
      "tipo": "cuadricula",
      "titulo": "Otros",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Las herramientas están libres de aceites y materiales deslizantes",
       "Se trasladan en cajas adecuadas, diseñadas para tal fin",
       "Se guardan de forma que no se deterioran unas con otras",
       "Hay un sistema de reposición de herramientas y los trabajadores lo conocen",
       "Las herramientas dañadas se cambian a tiempo, no se reparan"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p14",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p15",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p16",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "equipo-soldar",
  "nombre": "Equipo de soldar",
  "grupo": "Herramientas y equipos",
  "titulo": "Equipo de soldar",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del equipo de soldar",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Careta en buen estado",
       "Protección auditiva en buen estado",
       "Gafas en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes de vaqueta en buen estado",
       "Peto y mangas en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Equipo",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Estructura física en buen estado, sin deterioro, rayones ni corrosión",
       "El tablero o toma está en buen estado",
       "El equipo tiene conexión de polo a tierra",
       "Hay un extintor asignado al equipo",
       "La antorcha TIG / MIG está en buen estado",
       "El portaelectrodo está en buen estado",
       "Tiene pinza de masa",
       "El cable de alimentación está en buen estado",
       "Los conectores tienen el ajuste adecuado",
       "El indicador de encendido funciona",
       "El selector de polaridad funciona correctamente",
       "Los interruptores de arranque y parada funcionan",
       "El equipo está sobre terreno seco y nivelado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p9",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p10",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "equipo-oxicorte",
  "nombre": "Equipo de oxicorte",
  "grupo": "Herramientas y equipos",
  "titulo": "Equipo de oxicorte",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del equipo de oxicorte",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Careta en buen estado",
       "Protección auditiva en buen estado",
       "Gafas de protección para corte en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes en buen estado",
       "Peto y mangas en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Botellas",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Las botellas de oxígeno y acetileno están identificadas",
       "Las botellas están en posición vertical",
       "Las botellas están libres de abolladuras",
       "Las botellas están aseguradas en su canastilla",
       "Hay un extintor a la mano",
       "Los cilindros están libres de escapes o fugas",
       "Cilindro y regulador libres de grasa, aceite o combustibles",
       "Libre de caída de objetos al mismo nivel",
       "La válvula del cilindro está en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "Manómetros",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El múltiple o manifold está en buenas condiciones",
       "Los manómetros están en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Mangueras",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Mangueras sin cortes, empalmes ni grasa",
       "Conexiones a las botellas con abrazaderas en buen estado y ajustadas",
       "El color de la manguera corresponde al gas",
       "Las mangueras están fuera de las vías de circulación",
       "Las mangueras están lejos de superficies calientes o cortantes"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Soplete o caña de corte",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Los orificios de salida de gas están libres de obstrucciones",
       "La caña está libre de obstrucciones y en buen estado",
       "Las válvulas de la caña están en buen estado",
       "El accionador de la caña está en buenas condiciones"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p11",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p12",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p13",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "pulidora",
  "nombre": "Pulidora",
  "grupo": "Herramientas y equipos",
  "titulo": "Pulidora",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código de la pulidora",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "opcion",
      "titulo": "Tipo de disco a usar",
      "opciones": [
       "Scotch brite (<2.000 RPM)",
       "Rodos",
       "Biselar",
       "Lija",
       "Cortar",
       "Gratear (radial / copa)",
       "Desbastar / pulir / circonio"
      ]
     },
     {
      "k": "p7",
      "tipo": "opcion",
      "titulo": "Tamaño del consumible",
      "opciones": [
       "4 1/2\" (pulidora de 10.500 RPM)",
       "7\" (pulidora de 8.500 RPM)"
      ]
     },
     {
      "k": "p8",
      "tipo": "texto",
      "titulo": "Revoluciones del disco (RPM)"
     },
     {
      "k": "p9",
      "tipo": "fecha",
      "titulo": "Fecha de vencimiento del consumible"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Careta en buen estado",
       "Protección auditiva en buen estado",
       "Gafas en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes de vaqueta en buen estado",
       "Peto y mangas en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p11",
      "tipo": "cuadricula",
      "titulo": "Consumibles y accesorios",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Libre de fisuras, fracturas o desgastes irregulares",
       "Eje sin deformaciones ni doblado",
       "Desgaste dentro del límite útil",
       "Sin desprendimiento de partículas o del abrasivo",
       "Sin oxidación ni corrosión"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p12",
      "tipo": "cuadricula",
      "titulo": "Herramienta",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Cable de alimentación en buen estado",
       "Polo a tierra en buen estado",
       "Acople del disco y rosca bien instalados",
       "Tornillos de ensamble de la pulidora completos y ajustados",
       "Mango bien instalado y en buen estado",
       "Mango auxiliar en buen estado",
       "Interruptor de encendido en buen estado",
       "Seguro en buen estado",
       "Guarda instalada y en buen estado",
       "Estado general de la pulidora (sin fisuras ni rupturas, aseada)"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p13",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p14",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p15",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "taladro",
  "nombre": "Taladro",
  "grupo": "Herramientas y equipos",
  "titulo": "Taladro",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del taladro (si es tuyo y no tiene código, escribe «PROPIO» y la marca)",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "opcion",
      "titulo": "Tipo de accesorio a usar",
      "opciones": [
       "Broca para concreto",
       "Broca para metal",
       "Broca para madera",
       "Puntas",
       "Copas"
      ]
     },
     {
      "k": "p7",
      "tipo": "texto",
      "titulo": "Diámetro de la broca"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Protección auditiva en buen estado",
       "Gafas en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes de vaqueta en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Consumibles y accesorios",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Libre de fisuras, fracturas o desgastes irregulares",
       "Eje sin deformaciones ni doblado",
       "Desgaste dentro del límite útil",
       "Broca bien sujeta en el mandril (llave retirada)",
       "Sin oxidación ni corrosión"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Herramienta",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Cable de alimentación en buen estado",
       "Polo a tierra en buen estado",
       "Cuerpo del equipo en buen estado",
       "Mandril en buen estado",
       "Interruptor de encendido y apagado en buen estado",
       "Mango de sujeción auxiliar en buen estado",
       "Llave del mandril en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p11",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p12",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p13",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "motortool",
  "nombre": "Motortool",
  "grupo": "Herramientas y equipos",
  "titulo": "Motortool",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del motortool",
      "obligatoria": true,
      "rol": "equipo"
     },
     {
      "k": "p6",
      "tipo": "opcion",
      "titulo": "Tipo de accesorio a usar",
      "opciones": [
       "Piedra instalada",
       "Fresas de metal",
       "Rodos",
       "Discos de pulir",
       "Disco scotch brite (<2.000 RPM)"
      ]
     },
     {
      "k": "p7",
      "tipo": "fecha",
      "titulo": "Fecha de vencimiento del consumible"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Careta en buen estado",
       "Protección auditiva en buen estado",
       "Gafas en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes de vaqueta en buen estado",
       "Peto y mangas en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p9",
      "tipo": "cuadricula",
      "titulo": "Consumibles y accesorios",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Libre de fisuras, fracturas o desgastes irregulares",
       "Eje sin deformaciones ni doblado",
       "Desgaste dentro del límite útil",
       "Sin desprendimiento de partículas o del abrasivo",
       "Sin oxidación ni corrosión"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p10",
      "tipo": "cuadricula",
      "titulo": "Herramienta",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Cable de alimentación en buen estado",
       "Conexión de polo a tierra en buen estado",
       "Cuerpo del equipo en buen estado",
       "Mandril en buen estado",
       "Interruptor de encendido y apagado en buen estado",
       "Cuello en buen estado",
       "Llaves del equipo en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p11",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p12",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p13",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "roladora",
  "nombre": "Roladora",
  "grupo": "Herramientas y equipos",
  "titulo": "Roladora",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código de la roladora",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "EPP",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Careta en buen estado",
       "Protección auditiva en buen estado",
       "Gafas en buen estado",
       "Protección respiratoria en buen estado",
       "Guantes en buen estado",
       "Peto y mangas en buen estado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     },
     {
      "k": "p7",
      "tipo": "cuadricula",
      "titulo": "Máquina",
      "ayuda": "Marca el estado de cada punto. Lo que esté «Malo» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "Interruptor de encendido/apagado funciona",
       "Máquina limpia",
       "Botón de emergencia en buen estado",
       "El sistema de transmisión mueve los rodillos en sincronía",
       "El control de manejo manual funciona correctamente",
       "Conexiones eléctricas y cables en buen estado",
       "Nivel de aceite de la parte hidráulica correcto",
       "La máquina está en un lugar estable y nivelado"
      ],
      "columnas": [
       "Bueno",
       "Malo",
       "No aplica"
      ],
      "malasCol": [
       "Malo"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p8",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «Malo», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p9",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p10",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 },
 {
  "id": "diferencial-cadena",
  "nombre": "Diferencial con cadena",
  "grupo": "Herramientas y equipos",
  "titulo": "Diferencial con cadena",
  "codigo": "",
  "descripcion": "",
  "base": true,
  "herramienta": true,
  "paginas": [
   {
    "titulo": "Datos",
    "descripcion": "",
    "items": [
     {
      "k": "p1",
      "tipo": "fecha",
      "titulo": "Fecha de la inspección",
      "obligatoria": true,
      "rol": "fecha"
     },
     {
      "k": "p2",
      "tipo": "persona",
      "titulo": "Responsable de la inspección",
      "obligatoria": true,
      "rol": "responsable"
     },
     {
      "k": "p3",
      "tipo": "texto",
      "titulo": "Cargo",
      "rol": "cargo"
     },
     {
      "k": "p4",
      "tipo": "lista",
      "titulo": "Centro de trabajo",
      "rol": "centro"
     },
     {
      "k": "p5",
      "tipo": "texto",
      "titulo": "Código del diferencial",
      "obligatoria": true,
      "rol": "equipo"
     }
    ]
   },
   {
    "titulo": "Inspección",
    "descripcion": "",
    "items": [
     {
      "k": "p6",
      "tipo": "cuadricula",
      "titulo": "Guía de inspección",
      "ayuda": "Marca el estado de cada punto. Lo que esté «No» pide foto y observación.",
      "obligatoria": true,
      "filas": [
       "El soporte de anclaje (gancho de anclaje) está en buen estado, sin daños visibles",
       "Los eslabones de la cadena están libres de desgaste, óxido o deformaciones",
       "La cadena está adecuadamente lubricada",
       "El sistema de rotación de cadenas funciona sin atascos",
       "El gancho de sujeción está libre de deformaciones o daños",
       "El gancho de sujeción tiene la lengüeta de seguridad instalada y funcional",
       "La tornillería está en buen estado, sin holguras ni daños",
       "Los elementos auxiliares (poleas, rodamientos, etc.) están en buen estado"
      ],
      "columnas": [
       "Sí",
       "No",
       "No aplica"
      ],
      "malasCol": [
       "No"
      ]
     }
    ]
   },
   {
    "titulo": "Resultado",
    "descripcion": "",
    "items": [
     {
      "k": "p7",
      "tipo": "opcion",
      "titulo": "¿Se puede usar?",
      "ayuda": "Si algún punto está «No», NO se usa hasta corregirlo.",
      "obligatoria": true,
      "opciones": [
       "Sí",
       "No"
      ],
      "malas": [
       "No"
      ]
     },
     {
      "k": "p8",
      "tipo": "parrafo",
      "titulo": "Observaciones"
     },
     {
      "k": "p9",
      "tipo": "foto",
      "titulo": "Fotos (opcional)"
     }
    ]
   }
  ]
 }
];
if (typeof module !== 'undefined') module.exports = PREOP_BASE;
