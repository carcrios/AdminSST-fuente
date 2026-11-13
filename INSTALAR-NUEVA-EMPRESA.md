# Instalar el Portal SSTA en una empresa nueva (≈ 30 minutos)

Todas las empresas usan **los mismos archivos**: solo cambian `empresa.js` (los datos de la empresa) y el servidor, que es **un solo Apps Script** en la cuenta de Google de esa empresa.

**Dónde quedan los datos:** en el Google Drive de la empresa, en la carpeta «Portal SSTA - <empresa>», con un libro de Google Sheets por módulo. Nadie más los ve, ni siquiera quien instala, salvo que la empresa comparta la carpeta.

---

## ¿Qué estás instalando? (léelo primero)

| | **A. Tu sitio — administrador** | **B. Una empresa cliente** |
|---|---|---|
| Cuándo | **Una sola vez**, antes del primer cliente | Cada vez que vendes el portal |
| Dónde | Tu cuenta de Google y tu GitHub | La cuenta de Google **de la empresa** (su servidor). El sitio es el tuyo. |
| Cómo | `configurar-empresa.html` → **«Mi sitio — soy el administrador»** → descargas `empresa.js` y `manifest.json`, los subes y abres `admin.html` | En tu consola (`admin.html`) → **Instalar empresa nueva** → **«Guardar en tu consola y publicar»** |
| Qué sale | Tu consola | El enlace `?e=código` y el QR para sus celulares |

El configurador pregunta primero cuál de las dos es, y una franja de color arriba lo recuerda todo el tiempo: **morada = tu sitio**, **azul = una empresa cliente** (verde = una empresa con sitio propio, caso avanzado que es el que describe esta guía paso a paso).

---

## 0. Antes de empezar

| Necesitas | Para qué |
|---|---|
| Una cuenta de Google **de la empresa** (Gmail o Workspace), por ejemplo `sst@empresa.com` | Ahí viven el servidor y los datos. Si quien instala usa su cuenta personal, los datos quedan en su Drive: **no lo hagas**. |
| Una cuenta de GitHub **de la empresa** (gratis) | Para publicar el sitio. Cada empresa en su propia cuenta: si dos empresas comparten cuenta, comparten en los celulares la clave guardada y los pendientes. |
| Los archivos del portal (este paquete) | — |
| El listado maestro de documentos de la empresa | Códigos, versiones y fechas de sus formatos. |

> **Correos: Gmail gratuito o Google Workspace.** Google limita los correos que el
> servidor puede mandar al día, y el tope de una cuenta Gmail gratuita es mucho
> más bajo que el de Workspace (confirma las cifras vigentes en la documentación
> de cuotas de Apps Script). Con muchos avisos diarios, el resumen del lunes y las
> PQRS, una empresa grande puede llegar al tope con Gmail. El portal no se rompe:
> desde la v110 deja de enviar lo de rutina al quedar pocos, guarda el cupo final
> para lo urgente (accidente reportado) y lo muestra en 🩺 Estado. Si allí aparece
> seguido «sin enviar hoy por el límite de Google», usa una cuenta de Workspace.

---

## 1. Servidor (Apps Script): 10 minutos

> **Camino corto (v167): un comando en vez de los pasos 1 a 6.** Con Node 18+ y clasp
> (`npm install -g @google/clasp`, `clasp login`, y la API de Apps Script activada en
> script.google.com/home/usersettings):
> ```bash
> node herramientas/instalar-empresa.js --codigo acme-sas --nombre "ACME S.A.S." \
>      --correos sst@empresa.com,gerencia@empresa.com --contacto "Laura Gómez" --whatsapp "+57 300 123 4567" \
>      --clientes ~/clientes.json
> ```
> Crea el proyecto, le pone el servidor de esta versión con `01-Empresa` ya lleno y la zona horaria de
> Bogotá, lo publica como aplicación web y anota la empresa en `clientes.json` (la lista que usa
> `actualizar-servidores.js`). Con `--probar` arma todo sin crear nada en Google.
> - **El proyecto queda en la cuenta con la que entraste a clasp.** Para que el servidor y los datos queden
>   en la cuenta de la empresa, entra con la de ella (`clasp logout` y `clasp login`); al terminar, compártelo
>   contigo como Editor y vuelve a tu cuenta.
> - **Quedan dos pasos que Google solo le deja hacer al dueño:** ▶ `instalar` (aceptar permisos; paso 5) y
>   ▶ `verConfiguracion` (copiar servidor y clave; paso 7). El comando te deja el enlace del proyecto.
> - Si el comando falla después de crear el proyecto, el mensaje dice cuál es: termínalo ahí o bórralo antes
>   de repetir, para no dejar dos.

1. Entra con la cuenta de la empresa a **script.google.com** → **Nuevo proyecto**. Ponle de nombre «Portal SSTA».
2. En **⚙️ Configuración del proyecto**, pon la zona horaria **(GMT-05:00) Bogotá**.
3. Crea 8 archivos (botón **+** → Secuencia de comandos) con estos nombres, sin `.gs`, y pega en cada uno el contenido del archivo del mismo nombre de la carpeta `servidor-unico/`:
   `00-Portal`, `01-Empresa`, `10-permisos`, `11-personal`, `12-ats`, `13-asistencia`, `14-epp`, `15-sgsst`.
   Borra el archivo `Código.gs` que trae vacío. El orden de los archivos no importa.
4. En `01-Empresa` (el único que se edita; las actualizaciones nunca lo reemplazan), cambia las tres líneas:
   ```js
   const EMPRESA_NOMBRE = 'Montajes del Sur S.A.S.';
   const CORREOS_SSTA = ['sst@empresa.com', 'gerencia@empresa.com'];
   const CONTACTO_EPP = { nombre: 'Laura Gómez', whatsapp: '+57 300 123 4567' };
   ```
   (Si después cambian, edítalos aquí y haz *Gestionar implementaciones → Nueva versión*.)
5. Arriba, elige la función **instalar** → **▶ Ejecutar** → **Revisar permisos** → elige la cuenta de la empresa → *Configuración avanzada* → *Ir a Portal SSTA* → **Permitir**.
   Se crean la carpeta y los 10 libros, queda programado el **aviso diario del SG-SST** (6 a. m., a los correos de `CORREOS_SSTA`) y en el registro aparece la **clave del portal** (por ejemplo `KQRT-4827`).
6. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar**.
7. Elige la función **verConfiguracion** → **▶ Ejecutar**. Copia las líneas que salen (`servidor: …` y `apiToken: …`).
   La URL del servidor debe terminar en **/exec**. Si termina en /dev o no aparece, cópiala de **Implementar → Gestionar implementaciones** (la URL de la aplicación web).

8. **Si vas a mantener tú el servidor** (actualizaciones con un comando, ver «Vender el portal a varias empresas»): **Compartir** → tu correo como **Editor**, y anota el **ID de la secuencia de comandos** (⚙️ Configuración del proyecto).

> Para actualizar el servidor a mano más adelante, pega los archivos nuevos (**nunca** `01-Empresa`) y luego **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión**. **No** uses «Nueva implementación»: eso cambia la URL.

---

## 2. Sitio (GitHub Pages): 10 minutos

1. En la cuenta de GitHub de la empresa, crea un repositorio **público** (por ejemplo `portal-sst`).
2. Sube **todos** los archivos del portal **excepto** estas carpetas: `backends/`, `pruebas/`, `herramientas/`, `fuente/`, `comercial/` y `sitio-demo/` (lo más fácil: sube las tandas de `PASO-2-SITIO` del paquete, que ya vienen sin ellas). Las carpetas `servidor-unico/` y `demo/` no estorban, pero se pueden omitir.
3. En **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, carpeta `/ (root)` → **Save**.
   (En TU repositorio multiempresa usa mejor *GitHub Actions*: publica solo si pasan las pruebas; ver README.)
   A los 1–2 minutos queda en `https://<cuenta>.github.io/portal-sst/`.

---

## 3. Configurar la empresa: 5 minutos

1. Abre `https://<cuenta>.github.io/portal-sst/configurar-empresa.html`.
2. Llena:
   - razón social, nombre corto, NIT, logo y color;
   - **estándares mínimos (Res. 0312 de 2019)**: número de trabajadores, clase de riesgo más alta de la ARL y si es unidad de producción agropecuaria. El portal dice cuántos estándares debe cumplir (3, 7, 21 o 60) y los muestra **clasificados por ciclo (Planear, Hacer, Verificar, Actuar) y categoría** (Recursos, Gestión integral, Gestión de la salud, Gestión de peligros y riesgos, Gestión de amenazas, Verificación, Mejoramiento), con el peso de cada categoría en los 60;
   - códigos, versiones y fechas de los formatos;
   - módulos que va a usar (la marca **0312 · n** dice cuántos de sus estándares apoya cada módulo; no se apaga nada solo);
   - correos y centros de costo (clientes) para el ATS.
3. En el paso 6, pega lo que dio **verConfiguracion**.
4. **Descargar empresa.js** y **Descargar manifest.json**. Súbelos al repositorio **reemplazando** los que están.

> Si después hay que cambiar algo (un código, el logo, un correo), vuelve a abrir `configurar-empresa.html`: carga lo que ya está y solo hay que corregir y volver a subir.

---

## 4. Probar y entregar: 5 minutos

1. Abre el sitio → **🔑 Clave** → escribe la clave del paso 1.5. Luego **🩺 Estado**: los 10 servidores deben salir en verde. Si salen «Pide la clave», la clave quedó mal escrita.
2. Haz una prueba de punta a punta: un ATS corto, un permiso, una charla con un asistente, y exporta el PDF. Revisa que salgan el logo, los códigos y el nombre de la empresa.
3. Entrega al responsable de SST:
   - el enlace del portal (y que lo **agreguen a la pantalla de inicio** de cada celular);
   - la **clave del portal**, que cada celular escribe una vez en 🔑 Clave;
   - la carpeta de Drive con los libros (que la compartan solo con quien deba verla).

Si la clave se filtra o se va alguien: en Apps Script ejecuta **cambiarClave** y reparte la nueva.

### 4.1 Obligatorio antes de entregar (v145)

1. **Crear el administrador.** En Apps Script ejecuta ▶ `sgsst__codigoAdministrador`, abre el portal → Gestión → «Crear el administrador» con ese código. Luego crea un usuario por supervisor y por persona de SST. **Sin administrador, el módulo de salud y el buzón quedan cerrados, y todo lo demás se abre con la clave del portal.**
2. **Respaldo fuera de la cuenta.** En Apps Script → Configuración del proyecto → Propiedades del script, agrega `RESPALDO_EXTERNO` con un correo **de la empresa** (otra cuenta, no la dueña de los libros). Si no lo pones, **no hay copia externa** (desde v148 ya no se manda al correo del asesor: el libro lleva datos de salud). El correo dice que es confidencial.
3. **Comités en Usuarios (v148).** A cada usuario con rol Comité márcale a qué comités pertenece (COPASST, Convivencia, Emergencias). Solo los de Convivencia (y SST) ven quejas, actas y buzón de Convivencia.
4. **Probar la restauración.** Ejecuta ▶ `sgsst__respaldoSemanal` una vez y luego ▶ `sgsst__probarRestauracion`: debe decir «✓ El respaldo se puede restaurar».

### 4.2 Después de instalar: mantenimiento

| Cada cuánto | Qué (en el proyecto del cliente las funciones llevan el prefijo del módulo) |
|---|---|
| Cada mes | ▶ `sgsst__probarRestauracion` y revisar que llegue el correo del respaldo externo |
| Cada enero | ▶ `sgsst__archivoAnualVistaPrevia` y luego ▶ `sgsst__archivarAniosAnteriores` |
| Si se daña algo | ▶ `sgsst__restaurarDesdeRespaldo` (deja copia de las hojas actuales). Solo cubre el libro del SG-SST: los libros de permisos, ATS, EPP, charlas y personal se restauran abriendo su copia en «Respaldos SG-SST» y copiando las hojas a mano |
| Si alguien se va | Desactivar su usuario y, si conocía la clave del portal, ▶ `cambiarClave` |

### 4.3 Propiedades del script (no las borres; cópialas si migras de cuenta)

| Propiedad | Qué es | ¿Copiar al migrar? |
|---|---|---|
| `API_TOKEN`, `CLAVE_PORTAL` | Clave del portal | Sí (o repartir una nueva) |
| `SECRETO_SESION` | Firma las sesiones | Si se pierde, todos vuelven a entrar |
| `SELLO_SECRETO` | Firma el sello de las firmas | **Sí: sin ella los sellos antiguos dejan de verificarse** |
| `LLAVE_PROVEEDOR` | Mensajes de tu consola | Sí |
| `RESPALDO_EXTERNO` | Correo del respaldo fuera de la cuenta | Sí |
| `CARPETA_RESPALDOS`, `ARCHIVO_LIBRO` | Carpeta de respaldos y libro de archivo de la bitácora | Sí |
| `AVISOS_APAGADOS` | Avisos por correo apagados | Opcional |

---

## Gestión del SG-SST (8 módulos)

Están en el inicio, sección **Gestión del SG-SST**, y usan el servidor `15-sgsst`:

| Módulo | Qué hace |
|---|---|
| 🪪 **Personal habilitado** | Requisitos de cada trabajador con su vencimiento (seguridad social, inducción, concepto médico, alturas, espacios confinados…). Los permisos, el ATS y el anexo avisan debajo de cada cédula si alguien no está habilitado. |
| ⚠️ **Reportes e investigación** | Actos y condiciones inseguras (se puede reportar anónimo), incidentes y accidentes. En los accidentes lleva el plazo del FURAT (2 días hábiles) y la investigación con equipo, causas y firmas (15 días, Res. 1401 de 2007). |
| ✅ **Plan de acción** | Una sola lista de acciones con origen (reporte, inspección, EPP, COPASST, auditoría…), responsable, fecha, avances y cierre con evidencia. |
| 🔍 **Inspecciones planeadas** | Inventario de equipos y áreas (extintores, arneses, botiquines, eslingas…) con 13 listas de chequeo ajustables más las propias de la empresa, inspecciones gerenciales y del COPASST con participantes, y cronograma anual. Cada «no conforme» crea su acción. |
| 📈 **Indicadores** | Los de la Res. 0312 de 2019 (art. 30) calculados solos con los reportes; solo hay que escribir cada mes el número de trabajadores y los días de ausencia. |
| 🤝 **COPASST** | Conformación por periodos de 2 años con los integrantes que pide la Res. 2013 de 1986 según el número de trabajadores (vigía si son menos de 10), calendario de reuniones mensuales, actas con quórum y firmas, compromisos al plan de acción, capacitaciones del comité. Avisa la reunión extraordinaria dentro de 5 días tras un accidente grave. |
| 🕊️ **Comité de Convivencia** | Igual que el COPASST (Res. 3461 de 2025) más las **quejas de acoso laboral cifradas**, con los plazos del procedimiento (5 días para darle trámite, 65 en total) e informes trimestral y anual para la alta dirección sin nombres. |
| 🧾 **Auditorías** | Programa anual; autoevaluación de los 60 estándares de la Res. 0312 con puntaje y valoración; auditoría interna del Decreto 1072 (art. 2.2.4.6.30); ISO 45001; auditorías de clientes. Cada no conformidad crea su acción. |

### Planear y revisar el SG-SST (6 módulos más, misma hoja del servidor `15-sgsst`)

| Módulo | Qué hace |
|---|---|
| 🗓️ **Plan anual de trabajo** | Cronograma con responsables, recursos y firmas del empleador y del responsable. Trae una plantilla de actividades; las que el portal puede ver (reuniones del COPASST, inspecciones, simulacros, auditorías, revisión por la dirección) se marcan solas. Calcula el cumplimiento, la ejecución del plan de capacitación y su cobertura. |
| ☢️ **Matriz de peligros** | Identificación y valoración con la GTC 45 (ND × NE × NC → nivel de riesgo I a IV), medidas en orden de jerarquía que se vuelven acciones, revisión anual con firma de los trabajadores, inventario de sustancias (SGA) y mediciones ambientales. |
| 🚨 **Emergencias** | Plan por sede con el análisis de amenazas y vulnerabilidad por colores, procedimientos operativos, brigada con sus capacitaciones y dotación, y simulacros con tiempos y acciones de mejora. |
| 🩺 **Salud en el trabajo** | Profesiograma, programación de exámenes ocupacionales (Res. 1843 de 2025) con solo el concepto de aptitud y las restricciones, seguimiento a restricciones, diagnóstico de condiciones de salud, vigilancia epidemiológica, batería psicosocial (Res. 2764 de 2022, solo resultados generales) y ausentismo. **No guarda diagnósticos.** |
| 📚 **Documental y legal** | Política y objetivos (con plantilla), matriz legal (trae 30 normas base para evaluar), listado maestro (importa los formatos del portal), gestión del cambio y evaluación de proveedores y contratistas. |
| 🏛️ **Revisión por la dirección** | Se llena con los datos del portal (autoevaluación, plan anual, accidentalidad, acciones, auditorías, comités, peligros, legal, salud) y pide el análisis de los 11 puntos del art. 2.2.4.6.31 del Decreto 1072. También la rendición de cuentas. |

Indicadores trae además los de **estructura y proceso**, y la autoevaluación de estándares mínimos muestra pistas del portal para casi todos los estándares.

**Qué requisitos se exigen** se define en `empresa.js`, en `habilitacion` (vigencia en meses de cada requisito y cuáles pide cada tipo de trabajo). Por defecto: seguridad social, inducción y concepto médico para todos, y el curso de alturas (18 meses, Res. 4272 de 2021) para trabajo en alturas.

**Quejas del Comité de Convivencia (reservadas):** se cifran en el celular con una clave que crea el propio comité la primera vez que entra a *Quejas*. Ni el servidor, ni la hoja de Google, ni quien administra el portal pueden leerlas. **Si el comité pierde la clave, las quejas no se pueden recuperar**: recomienda guardarla en sobre sellado con el presidente y el secretario. Cuando sale un integrante, el comité usa *Cambiar la clave del comité*.

**Datos de salud:** del concepto médico solo se guarda si es apto y las restricciones; nunca el diagnóstico. Las restricciones solo se ven en la ficha del trabajador.

Si la empresa no va a usar alguno, se desmarca en `configurar-empresa.html` (paso de módulos) y desaparece del inicio.

### Contratistas, adjuntos, usuarios y respaldo (v94)

| Módulo | Qué hace |
|---|---|
| 🚧 **Contratistas** | Documentos de cada empresa contratista con su vencimiento (Cámara de Comercio, ARL, PILA, autoevaluación 0312, matriz de peligros, póliza…) y **control de ingreso a obra**: solo autoriza a las personas habilitadas (se toman de *Personal habilitado* por el nombre de la empresa), con la empresa al día, inducción del sitio, EPP y permisos verificados, y firma de quien autoriza. |
| 📎 **Adjuntos** | En casi todos los registros (acciones, reportes, personal, actas, auditorías, contratistas y los formularios de planeación) se puede adjuntar el soporte: PDF, foto, Word o Excel hasta 10 MB. Se guarda en Google Drive de la empresa (carpeta *Adjuntos SG-SST*) y se baja a través del servidor. Nada se borra: quitar un adjunto lo deja como retirado. |
| 🕘 **Historial** | Cada registro tiene «Historial de cambios»: quién, cuándo y qué campos cambió (sale de la bitácora). |
| 👥 **Usuarios con nombre** (opcional) | Mientras no se activen, todo funciona con la clave del portal. Para activarlos: en Apps Script ejecuta ▶ `sgsst__codigoAdministrador`, y en el portal → *Usuarios y respaldo* escribe el código y crea el administrador. Desde ahí cada persona entra con su usuario (clave temporal que cambia la primera vez), cada cambio queda con su nombre y cada rol ve y cambia solo lo suyo (Administrador, SST, Supervisor, Comité, Solo consulta). Sin usuario se puede seguir **reportando** y los permisos siguen consultando el personal habilitado. Si nadie recuerda la clave del administrador, el mismo código sirve para recuperarla. |
| 💾 **Respaldo semanal** | `instalar` ya lo deja programado: cada domingo a las 2 a. m. se copian **todos** los libros a la carpeta *Respaldos SG-SST*. Se guardan las últimas 8 semanas y, para siempre, la primera copia de cada mes. La bitácora queda protegida contra edición manual. |

### EPP, inducción, programas de alto riesgo y PESV (v95)

| Módulo | Qué hace |
|---|---|
| 🧤 **Matriz y entrega de EPP** | EPP de cada cargo con su norma y vida útil (trae un catálogo de partida), entregas con la firma de quien recibe y la constancia de que se explicó el uso, y la lista de lo que hay que reponer (también llega en el correo diario). |
| 🎓 **Inducción y reinducción** | Temas, evaluación que la persona responde en el celular (aprueba con 80 %) y firma. Al aprobar, el requisito de inducción de *Personal habilitado* queda al día solo (vence en 12 meses). Temas, preguntas y nota se cambian en `empresa.js` → `induccion`. |
| 🧗 **Programas de alto riesgo** | Alturas, espacios confinados, eléctrico, caliente e izaje: requisitos de cada programa con su evidencia, e indicadores sacados del portal (personal con curso vigente, equipos al día, permisos del mes, simulacros de rescate, incidentes). Lo que no se cumple pasa al plan de acción. |
| 🚗 **PESV** | Nivel según vehículos y conductores, los 24 pasos de la Res. 40595 de 2022 con evidencia, vehículos (SOAT, revisión técnico-mecánica, mantenimiento), conductores (licencia, comparendos, capacitación) y siniestros viales. |

Las listas de requisitos de los programas y los pasos del PESV son una guía práctica: verifícalas con el texto vigente de cada norma.

### Tablero de la gerencia, reporte anual, ambiental y RUC (v96)

| Módulo | Qué hace |
|---|---|
| 📊 **Tablero de la gerencia** | Todo el SG-SST en una pantalla con semáforos (autoevaluación, accidentalidad, plan de acción, plan anual, comités, programas, PESV, personal, EPP, contratistas, ambiental) e informe en PDF. A quien no es SST no le muestra datos de salud. |
| 📦 **Reporte anual 0312** | Lista de lo que hay que tener (autoevaluación cerrada, plan de mejoramiento, registro en la plataforma, avances a la ARL) y el paquete en PDF con los 60 estándares, el plan y los indicadores del art. 30. Desde el 15 de noviembre el correo diario lo recuerda hasta que se registre. |
| 🌱 **Gestión ambiental** | Matriz de aspectos e impactos (valoración de referencia frecuencia × severidad × alcance), residuos con la categoría de generador RESPEL (media de 6 meses) y certificados, y consumos de agua, energía y combustible. |
| 🧾 **Auditorías ISO 14001 y RUC** | Lista ISO 14001 por capítulos. La de RUC viene vacía: se pega la Guía RUC vigente desde Excel (numeral, requisito, peso) y se calcula la calificación ponderada. |

### Estándares según el tamaño y panel del asesor (v97)

**Perfil de la empresa.** Desde v113 se define al instalar (`configurar-empresa.html`, paso 2) y queda en el archivo de la empresa (`perfil0312`). SST lo puede cambiar después en *Auditorías* o en el *Tablero de la gerencia* (el del SG-SST manda sobre el de la instalación). Con eso el portal sabe qué estándares le aplican (Res. 0312 de 2019): **3** si es unidad de producción agropecuaria con 10 o menos trabajadores permanentes y riesgo I a III (art. 7), **7** si tiene hasta 10 trabajadores y riesgo I a III (art. 3), **21** si tiene de 11 a 50 y riesgo I a III (art. 9), y **60** si tiene más de 50 o riesgo IV o V (art. 16). La autoevaluación que le aplica sale de primera. En los grupos de 7 y 21 el porcentaje es el de estándares que se cumplen, todos con el mismo peso: compáralo con el formato de tu ARL.

**Panel del asesor** (`asesor.html`). Para quien asesora varias empresas que tienen el portal instalado: cada cliente con su tamaño, clase de riesgo y segmento (7, 21 o 60), filtros, visitas y tareas. Las tareas se dejan **en el plan de acción del cliente** (origen «Asesor SST»); el cliente las ve con un aviso, las trabaja y las cierra con evidencia, y el asesor las verifica o las reabre. «Tareas de sus estándares» crea de una vez las tareas de los estándares que el cliente no cumplió en su última autoevaluación. Para conectar un cliente hacen falta la URL de su servidor (`verConfiguracion`) y su clave del portal; si el cliente usa usuarios con nombre, debe crearle al asesor un usuario con rol SST.

### Sustancias químicas, inspecciones flexibles y avisos a clientes (v98)

| Módulo | Qué hace |
|---|---|
| ⚗️ **Sustancias químicas** (`quimicos.html`) | Inventario con los pictogramas del SGA (con su dibujo), palabra de advertencia, frases H, CAS/ONU, EPP y la ficha de datos de seguridad adjunta (PDF). La próxima revisión de la ficha se pone sola a 5 años (Res. 773 de 2021, art. 18) y entra al correo diario. **Almacenamiento:** por cada lugar revisa qué sustancias quedan juntas y marca las que no deben ir juntas (p. ej. inflamable + comburente, ácido + base) o van con precaución, con el porqué y la matriz en PDF. **Res. 773:** semáforo de las obligaciones del empleador (inventario, etiquetas y fichas, capacitación anual en SGA, señalización, emergencias) y botón para crear en el plan de acción las acciones de lo que falta, sin repetir las abiertas. Lo que estaba en *Matriz de peligros → Sustancias* sigue ahí y se abre en el módulo nuevo. |
| 🔍 **Inspecciones** | **Listas de chequeo propias** (cocina, bodega, 5S…) y **ajuste** de las que trae el portal: la ajustada reemplaza a la original sin perder el inventario ni el historial, y se puede volver a la original. Listas nuevas de **almacenamiento de químicos** e **instalaciones eléctricas**. **Tipo de inspección:** rutinaria, gerencial, del COPASST o preoperacional; en las gerenciales y del COPASST se anotan los participantes con su firma (salen en el PDF) y los hallazgos del COPASST quedan con ese origen. **Cronograma anual:** equipos y áreas según su frecuencia, más las gerenciales y del COPASST que se programen; muestra lo hecho, lo atrasado y el % de cumplimiento, con PDF. El correo diario avisa desde el día 20 la gerencial o del COPASST del mes que no se ha hecho. |
| 📧 **Avisos a los clientes del asesor** | En el panel del asesor, *Configurar* en cada cliente guarda en **su** portal el correo del responsable del SG-SST y el del asesor. Desde ahí, el servidor del cliente avisa por correo cuando le dejan una tarea, le recuerda las que vencen en 3 días o ya vencieron (al día siguiente y luego cada semana) y le avisa al asesor cuando cierran una. Los correos salen solo a esas direcciones (y al usuario del portal que se llame como el responsable), con un tope diario. El cliente debe tener su servidor en v98 o posterior; también puede poner los correos él mismo en *Perfil de la empresa*. |

### Carga masiva desde Excel (v100)

Para arrancar una empresa sin digitar uno por uno. Está en **Personal habilitado**, **Inspecciones** (inventario), **Sustancias químicas**, **Documental → Matriz legal** y **Matriz de peligros**: botón «⬆️ Cargar desde Excel».

1. **Plantilla:** descárgala (CSV que abre en Excel). Los títulos con * son obligatorios.
2. **Llenar:** una fila por registro.
   - Fechas como 15/03/2026.
   - Sí/No en las casillas.
   - Las listas con sus opciones; por ejemplo, los pictogramas por nombre o código GHS, separados por coma.
3. **Pegar o subir:** copia las celdas con la fila de títulos y pégalas, o sube el archivo guardado como CSV.
4. **Revisar:** antes de guardar se ve qué filas son nuevas, cuáles actualizan algo que ya existe y cuáles tienen errores, y por qué. Las filas con error no se cargan.
5. **Cargar:** se guarda por lotes en el servidor. Si una persona, equipo o sustancia ya existe, solo cambia lo que trae la fila: no borra sus requisitos, soportes ni historial. Cargar el mismo archivo dos veces no duplica nada. En un registro que ya existe, una celda vacía deja lo que tenía (los valores por defecto, como «Activo: Sí», son solo para los nuevos).
   - Las cédulas: dale a la columna formato Número sin decimales; si Excel las muestra como 1,02E+09, el portal rechaza la fila y lo explica.

- En personal, el vencimiento de cada requisito se calcula con la vigencia configurada si no viene en la fila.
- En peligros, la valoración GTC 45 (NP, NR, nivel y aceptabilidad) se calcula sola.
- En sustancias, la próxima revisión de la ficha sale a 5 años.

### Kit documental (v101)

`documentos.html` genera **20 documentos del SG-SST** con los datos de la empresa:
- **Datos del perfil:** razón social, NIT, actividad, trabajadores, clase de riesgo, ARL, ciudad, representante legal y responsable del SG-SST.
- **Datos del portal:** los peligros de la matriz, el comité que corresponde (COPASST, o vigía con menos de 10 trabajadores) y los códigos de los formatos.

Los documentos son:
- **Política y documentos de la estructura:** política de SST, objetivos con metas e indicadores, designación del responsable, roles y responsabilidades, asignación de recursos y reglamento de higiene y seguridad industrial.
- **Procedimientos:** identificación de peligros (GTC 45), reporte e investigación de incidentes y accidentes, acciones correctivas y preventivas, gestión del cambio, auditoría, revisión por la dirección, control de documentos y conservación de registros, comunicación, compras y contratistas, y emergencias.
- **Programas y manual:** programas de capacitación, inspecciones y evaluaciones médicas, y el manual del SG-SST.

Para cada documento:
- Dice qué estándar de la Res. 0312 cubre y si está entre los que le aplican a la empresa (7, 21 o 60).
- Se ve en pantalla, sale en **PDF** con el encabezado de la empresa y en **Word editable** para ajustarlo. También se pueden sacar todos en un solo PDF o en un solo Word.
- **Aprobar** lo registra en el listado maestro (Documental) con su versión, la fecha y la próxima revisión a un año. Allí se adjunta la versión firmada. Aprobar de nuevo sube la versión.

Son una base técnica según el Decreto 1072 de 2015 y la Resolución 0312 de 2019. La empresa (o tú, como asesor con licencia) los revisa y los ajusta a su realidad antes de aprobarlos.

### Gestión de la calidad ISO 9001 (v102)

`calidad.html` (HSEQ · Calidad) cubre el sistema de gestión de la calidad:

| Pestaña | Qué hace |
|---|---|
| **Contexto** (4.1 a 4.3) | Alcance, DOFA y partes interesadas con sus necesidades y cómo se les hace seguimiento. Se revisa cada año y el correo diario lo recuerda. |
| **Riesgos y oportunidades** (6.1) | Probabilidad × impacto (1 a 5): alto desde 15. Los riesgos altos van al plan de acción con origen «Calidad». |
| **Objetivos** (6.2) | Indicador, fórmula, meta (mayor o menor que) y frecuencia. Cada medición queda guardada con su análisis; si no cumple, ofrece la acción. |
| **No conforme** (8.7) | Producto o servicio no conforme: dónde se detectó, cantidad, costo y tratamiento (corrección, concesión, rechazo…). Con acción correctiva cuando hace falta. |
| **PQRS** | Peticiones, quejas, reclamos, sugerencias y felicitaciones. El plazo interno es de 15 días hábiles y se cambia en `empresa.js` con `calidad: { diasPQRS: 10 }`. No se cierra sin respuesta, el correo diario avisa las vencidas y mide el % respondido a tiempo. Una queja o reclamo que procede va con acción. |
| **Satisfacción** (9.1.2) | Encuestas con 4 criterios (1 a 5) y NPS. Calcula la satisfacción global, el NPS y el promedio por criterio de los últimos 12 meses. Trae encuesta en blanco para imprimir. |

En **Auditorías** quedó la lista de verificación **ISO 9001:2015** por capítulos (4 a 10). La evaluación de proveedores sigue en Documental.

### Manual de uso y videos (v103)

- **❓ Ayuda** (en el inicio) abre `ayuda.html`, el manual dentro del portal:
  - guías paso a paso de cada módulo;
  - filtro por rol (trabajador y supervisor, SST, comités, gerencia, asesor) y buscador;
  - preguntas frecuentes.
- **Videos:** cada guía tiene un video corto (30 a 60 segundos, con subtítulos), grabado sobre la empresa demo. Están en la carpeta `videos/` del sitio (pesan unos 2,5 MB en total). Necesitan señal; el resto del manual funciona sin ella.
- **Volver a grabar los videos** cuando cambie una pantalla (con Playwright y ffmpeg):
  ```
  node herramientas/armar-demo.js /tmp/sitio-demo
  (cd /tmp/sitio-demo && python3 -m http.server 8766) &
  node herramientas/grabar-videos.js http://localhost:8766
  ```

---


### Inicio en el orden del mes (v104)

El inicio ya no agrupa por tipo de formato sino por **cuándo se hace** en el mes:

| Sección | Cuándo | Qué hay |
|---|---|---|
| En cada jornada | Todos los días, en campo | ATS, permisos, preoperacionales, charla, personal autorizado, inspección de EPP, permisos abiertos, reportar un evento |
| 1. Planear el mes | Días 1 a 5 | Plan anual, personal habilitado (vencimientos y PILA), inspecciones planeadas, contratistas |
| 2. Ejecutar los programas | Durante el mes | Inducción, EPP, salud, alto riesgo, químicos, emergencias, PESV, ambiental, calidad |
| 3. Reunir los comités | Una vez al mes | COPASST y Comité de Convivencia |
| 4. Medir y cerrar el mes | Últimos 5 días | Indicadores, plan de acción, tablero de la gerencia |
| 5. Revisar y mejorar | Cada trimestre y al año | Auditorías, revisión por la dirección, matriz de peligros, documental y kit |
| Administrar el portal | Cuando haga falta | Panel del asesor, usuarios y respaldo |

- Arriba, un **cronograma del mes** marca hoy y dice qué toca; tocar una fila abre esa sección.
- Íconos de línea en vez de emojis y una sola letra en todo el portal (IBM Plex Sans), que va dentro del sitio: sin señal se ve igual.
- Al buscar, solo quedan las secciones con resultados y cada una dice cuántos tiene.


### Pendientes, cierre del mes, QR, plan automático y evidencias (v105)

Para que el sistema se lleve casi solo:

- **Pendientes en el inicio.** Lo vencido y lo que vence en 15 días, de todos los módulos, más lo del mes: actividades del plan anual sin hacer, inspecciones del cronograma, reunión del COPASST, datos de indicadores y cierre del mes. Con usuarios, «Míos» muestra lo que tiene el nombre de la persona como responsable; los exámenes médicos solo los ven Administrador y SST. Sin señal se ve la última lista.
- **Correo del lunes.** A cada usuario con correo (activo y con su clave ya cambiada) le llega lo suyo de la semana; Administrador, SST y `CORREOS_AVISO` reciben todo. El correo diario de las 6 a. m. sigue igual.
  - En un servidor que viene de una versión anterior, el resumen del lunes se programa solo con el primer aviso diario. Para hacerlo de una vez: ▶ `sgsst__instalarAvisosDiarios`.
  - Para que algo le llegue a alguien, su nombre debe estar igual (o con sus dos apellidos o nombres completos) en el responsable de la acción o de la actividad del plan.
- **Cerrar el mes** (`cierre-mes.html`). Lista de cierre automática (indicadores, accidentes, inspecciones programadas, COPASST, plan anual, acciones, personal habilitado), cifras del mes, informe mensual en PDF y la foto del cierre guardada (hoja «Cierres de mes»). El mes sin cerrar aparece en pendientes: por hacer hasta el día 10 del mes siguiente, después vencido.
- **Etiquetas QR.** En Inspecciones: una etiqueta por equipo o la hoja de todo el inventario (12 por hoja carta). Al escanearla se abre la inspección de ese equipo; en el sitio de tu marca la etiqueta lleva el código de la empresa.
- **Plan anual según la empresa.** Propone las actividades con los estándares que le aplican (7, 21 o 60), los trabajadores (COPASST o vigía), los peligros de la matriz (alturas, confinados, eléctrico, caliente, izaje, químico, biomecánico, psicosocial, físico), los químicos, los vehículos y los contratistas. Cada una dice por qué. Con un plan ya hecho, sugiere solo lo que falta.
- **Carpeta de evidencias** (`evidencias.html`). Cada estándar mínimo que le aplica con la evidencia del portal: al día, incompleto, falta o revisar a mano. Índice en PDF para el auditor y «Llevar a una autoevaluación», que crea la autoevaluación con la evidencia escrita y «cumple» sugerido (quien audita confirma). El porcentaje es una guía, no la calificación oficial.


### Preoperacionales dentro del portal (v106): trae tus formularios de Google

Los preoperacionales que la empresa tenía en Google Forms se montan **tal cual** en el portal (`preoperacional.html`): mismas páginas, preguntas, opciones, obligatorias y saltos de sección. Ganan lo del portal: funcionan sin señal, quedan en el SG-SST (hoja «Preoperacionales»), piden qué se encontró y foto cuando algo está «Malo», crean la acción en el plan de acción, PDF de cada uno y las respuestas en CSV para Excel (como la hoja de respuestas de Google).

1. **Exportar** (en la cuenta de Google dueña de los formularios): https://script.google.com → Nuevo proyecto → pega `herramientas/exportar-formularios.gs` → ejecuta `exportarFormularios`. Deja `formularios-portal.json` en el Drive.
2. **Importar** (en tu computador, con el repositorio):
   - `node herramientas/importar-formularios.js formularios-portal.json` monta todos los formularios del archivo; el grupo sale de «Grupo: …» en la descripción del formulario.
   - Para montar solo algunos: `node herramientas/importar-formularios.js formularios-portal.json enlaces.json` (lista de enlaces con su grupo).
   - Se genera `preop-formularios.js`. Súbelo al sitio y vuelve a generar el inicio.
3. **Cambios a propósito:** la lista desplegable «NOMBRE - CÉDULA» no se copia al código (el sitio es público): la persona se elige del Personal habilitado. Los centros de trabajo salen de `empresa.js` (centros de costo), no de la lista del formulario.
- Quien usa el equipo puede llenarlo sin usuario (como en Google), pero no cambiarlo después. El de **condiciones de salud** queda aparte (`preopsalud`) y solo lo ven Administrador y SST.

### Campo a la vista, «Sistema de gestión» por rol (v106)

El inicio quedó en dos partes:

- **Sin usuario ni contraseña (desde v111)**: solo el **preoperacional** y los **reportes** (evento, PQRS y «¿Qué peligros ves?»). La inducción que el trabajador responde por enlace o QR (`induccion-responder.html`) y la encuesta a clientes siguen sin usuario porque se abren con su enlace.
- **Sistema de gestión**: **en obra** (permisos de trabajo, ATS, charlas, inspección de EPP, personal autorizado y tablero de permisos; hasta v110 eran públicos), cronograma del mes, pendientes y los pasos 1 a 5 (planear, ejecutar, comités, cerrar el mes, mejorar, administrar). Con usuarios activos pide **entrar**, y cada rol ve solo sus módulos. Si alguien abre la página de un módulo directo (enlace, favorito), la página misma pide entrar o dice «Tu usuario no tiene acceso aquí».

| Rol | Ve en el sistema de gestión (de fábrica) |
|---|---|
| Administrador, SST | Todo (SST incluye salud; Administrador además usuarios y respaldo) |
| Supervisor / campo | Siempre lo de la obra (permisos, ATS, charlas, inspección de EPP, personal autorizado, tablero). Además: habilitación, inspecciones y equipos, plan de acción, contratistas, dotación, inducción, emergencias, PESV, programas, químicos, matriz de peligros |
| Integrante de comité | Tablero de permisos (solo verlos), COPASST, Convivencia, inspecciones, plan de acción, indicadores, matriz de peligros, auditorías, plan anual, habilitación |
| Solo consulta | Tablero de permisos (solo verlos), tablero de gerencia, indicadores, plan de acción, plan anual, cierre del mes, evidencias, auditorías, revisión por la dirección, documentos, kit, matriz de peligros, habilitación, calidad, ambiental, COPASST |

**Cambiar la tabla de una empresa:** en `empresa.js` (o `empresas/<código>.json`), `acceso`, solo para los roles que cambian. Ejemplo: `acceso: { supervisor: ['inspecciones', 'plan', 'emergencias', 'gerencia'] }`. Los nombres de módulo son los de `modulos`. Lo de la obra no se le puede quitar al Supervisor, y lo público (preoperacional y reportes) no se puede cerrar.

**Importante:**
- El bloqueo por rol funciona cuando la empresa **activa los usuarios** (Usuarios y respaldo). Sin usuarios, el sistema de gestión (con los permisos y el ATS) se abre con «Abrir el sistema de gestión» y avisa que cualquiera con el enlace puede verlo. **Para que los permisos pidan contraseña, activa los usuarios y crea uno para cada supervisor.**
- **Desde v112 el servidor también lo exige:** con usuarios activos, los módulos de la obra (5 permisos, ATS, charlas, inspección de EPP y personal autorizado) rechazan cualquier consulta o registro sin una sesión válida (`codigoError: SESION`). Lo que estaba en la cola de un celular no se pierde: queda esperando a que la persona entre. Los preoperacionales y los reportes (módulo `sgsst`) siguen sin usuario. 🩺 Estado muestra esos servidores como «Funciona · pide usuario».
- La página oculta lo que el rol no ve; lo que el servidor protege de verdad sigue igual: datos de salud solo Administrador y SST, quejas de convivencia cifradas, y solo escriben los roles con permiso (Solo consulta no cambia nada).
- Los pendientes del inicio solo muestran lo de los módulos del rol; el correo del lunes le llega a cada quien con lo que tiene su nombre (Administrador y SST, todo).

### v109: inicio por categorías, agenda, proveedores por etapas y más ayudas

**Al actualizar:** cambió el servidor (tipo nuevo `compraprov`; PQRS e inducción se pueden crear sin usuario). Actualiza el sitio **y** los servidores.

- **Inicio:** «En la obra» por categorías (permisos, antes de la tarea, EPP, personas y capacitación, reportar y participar). El sistema de gestión pide entrar; al entrar muestra **Tu agenda** (calendario de pendientes y cronograma del mes).
- **Inducción desde el inicio:** `induccion-responder.html` la responde cualquiera sin usuario (datos, temas, evaluación y firma); el SST la ve en Inducción. El banco de temas y preguntas es uno solo (`induccion-banco.js`).
- **PQRS en Reportes:** se presentan desde «Reportar y participar» sin usuario y se gestionan en Reportes → PQRS y en Calidad.
- **Proveedores por etapas:** necesidad → cotizaciones (se puede parar en «En cotización» hasta tener las 2 o 3 que pide el procedimiento) → cuadro comparativo y elección → datos → documentos → evaluación inicial → decisión y alta en la matriz. El NIT se escribe solo con números: el guion y el dígito de verificación se ponen solos.
- **Matriz de EPP:** sugiere elementos según el cargo, los peligros escritos y la matriz de peligros (columna «Cargos expuestos» y «Control en el individuo»), y completa norma y vida útil.
- **Investigación de accidentes:** los 5 porqués se agregan uno a uno, con sugerencias según lo que pasó y las causas marcadas, ayuda y alertas (culpar a la persona no es causa raíz).
- **Programas de alto riesgo:** personal y equipos sincronizados con el personal autorizado, el Personal habilitado y el inventario de equipos.
- **Cifras clicables:** tocar una cifra («3 vencidos») lleva a la lista filtrada de eso que falta.
- **Celular:** los pendientes del permiso van en una barra abajo (ya no tapan las casillas) y el botón de subir solo sale al subir.

### v108: producto neutro, sin datos de ninguna empresa

- El sitio de fábrica trae datos de ejemplo («Tu empresa», sin logo, sin correos ni teléfonos) y `sinConfigurar: true` hasta que el configurador genera el `empresa.js` o el `empresas/<código>.json` de la empresa.
- `config.js` y `backends/` traen el marcador `PON-AQUI-EL-TOKEN` y ninguna URL de servidor: cada empresa usa su servidor único, con su propio token.
- El inicio ya no tiene enlaces a formularios ni carpetas externas; los preoperacionales se montan en el portal con `herramientas/importar-formularios.js`.
- Íconos de la app y logo de reserva neutros. Una prueba automática falla si en el código aparece un correo, celular, token, enlace o nombre de una empresa real.

### Novedades de la v107: validaciones, proveedores, encuestas a clientes e informe

**Al actualizar:** cambió el servidor (`15-sgsst.gs` y `00-Portal.gs`). Actualiza el sitio **y** los servidores de todas las empresas (`node herramientas/actualizar-servidores.js clientes.json`, o a mano con «Nueva versión» de la misma implementación).

- **Validación en todos los formularios** (`valida.js`): cédula solo números, NIT con dígito de verificación, correo, teléfono, cantidades ≥ 0 y fechas coherentes. Al guardar dice qué falta y resalta el campo. Toda lista con «Otro» abre un cuadro para escribir.
- **Proveedores y contratistas** (`proveedores.html`, módulo `proveedores`): matriz de requisitos por categoría con excluyentes ★, evaluación inicial (pesos de bienes y de servicios), reevaluación, homologación (dos CONFIABLE seguidos), cronograma, PDF con firmas y CSV. El catálogo y los pesos están en `proveedores-catalogo.js`: si la empresa usa otro formato, se cambia solo ese archivo. Usa los mismos registros `proveedor` de Documental.
- **Encuestas a clientes** (Calidad → Satisfacción → «Enviar encuesta a un cliente»): genera un enlace (`encuesta-cliente.html#r=…`) para WhatsApp, correo o QR. El cliente responde **sin usuario**; el servidor solo le muestra esa encuesta y acepta una respuesta por enlace. El resultado entra al indicador de satisfacción y NPS.
- **Encuesta de peligros para los trabajadores** (`percepcion-peligros.html`, pública): desde Matriz de peligros → Revisiones se saca el enlace o QR por área; el consolidado muestra qué peligros señalan y si ya están en la matriz.
- **Comité de emergencias** (`comite-emergencias.html`, módulo `comiteemergencias`): igual que COPASST y Convivencia, con reuniones trimestrales.
- **Informe del SG-SST** (`informe.html`, lo ven SST, Administrador y Solo consulta): gráficas, hallazgos y sugerencias de mejora por mes, trimestre o año, con botón para crear la acción y PDF firmado. La gerencia no ve datos de salud individuales.
- **Tareas del asesor**: en el panel del asesor, «Asignar tarea» por empresa. Llega como acción (origen «Asesor SST») a los pendientes del responsable y al correo del lunes. La lista de responsables solo sale con servidores v107 o posteriores; con uno anterior se escribe el nombre.
- **Novedades normativas** (Documental → Matriz legal): el servidor consulta fuentes en línea (RSS) cada 6 horas como máximo y marca si la norma ya está en la matriz. Es una ayuda: cada norma se revisa antes de incluirla.
- **Ambiental**: categoría de generador de RESPEL con la media móvil de 6 meses (≥1.000 kg/mes grande, 100 a <1.000 mediano, 10 a <100 pequeño) y la fecha del reporte en el RUA según el NIT (verificarla con la autoridad ambiental).
- **Revisión por la dirección** con los 24 puntos del Dec. 1072, art. 2.2.4.6.31, y rendición de cuentas de responsable del SG-SST, comités, brigada y gerencia.
- **Formatos nuevos** (códigos en Configurar la empresa): SG-EVAL-PROVEEDOR, SG-EMERGENCIAS-ACTA, SG-LUGARES-QUIMICOS, SG-CONSUMOS.

## Firma de actas por enlace y entrega de dotación (v150)

- **Firma de actas:** no hay que configurar nada. La primera vez el servidor crea solo la clave `FIRMA_ACTAS` (Propiedades del script) con la que firma los enlaces. Si se cambia, los enlaces ya enviados dejan de servir. Desde el acta: «Enviar enlace para firmar» → QR o WhatsApp.
- **Dotación:** en «Ejecutar los programas → Personas». Marca en «Tallas y derecho» quién tiene derecho (hasta 2 SMMLV, CST art. 230) y registra cada entrega con firma en los tres plazos del año.

## Tu consola de administrador (v115–v116)

El portal tiene **dos interfaces**:

| | Quién | Dónde | Qué ve |
|---|---|---|---|
| **Portal** | Trabajadores y SST de cada empresa | `https://tu-sitio/` (o `?e=código`) | Preoperacionales y reportes sin clave; su sistema de gestión con su usuario |
| **Consola** | Solo tú (administrador general) | `https://tu-sitio/admin.html` | Todos tus clientes, sus servidores, sus módulos, instalaciones nuevas, panel del asesor y tareas |

**Activar la consola (una vez):**
1. Tu sitio necesita **su propio servidor** (instálalo como el de cualquier empresa) puesto en «Tu sitio multiempresa (tu marca)» del configurador. Vuelve a generar ahí tu `empresa.js` (desde la v116 el motor va en `empresa-motor.js`).
2. Abre `admin.html`. Si tu servidor aún no tiene usuarios: en Apps Script ejecuta `sgsst__codigoAdministrador`, escribe el código en la consola y crea tu usuario. Luego entra con él.
3. En tu servidor ejecuta una vez `sgsst__instalarVigilancia` (revisión diaria de los clientes a las 6 a. m., con correo a `CORREOS_AVISO`).
4. Guarda `admin.html` en favoritos. Ningún menú de los clientes lleva ahí.

**Instalar una empresa nueva (un solo flujo, v116):**
1. Instala su servidor único en **su** cuenta de Google (paso 1 de esta guía) y ejecuta `verConfiguracion`.
2. En la consola: **Instalar empresa nueva** → llena el configurador (código, datos, 0312, módulos) y pega lo que dio `verConfiguracion` (servidor, clave, llave del proveedor y scriptId).
3. **Guardar en tu consola y publicar.** Queda registrada como cliente, su configuración queda en tu servidor (no hay que subir archivos a GitHub) y su servidor recibe los módulos contratados. Sale su enlace `?e=código` y su QR.

**Lo que haces después desde la consola:**
- **Revisar** cada servidor (o todos) en vivo; la revisión diaria aparece en cada tarjeta.
- **Módulos / editar:** abre el configurador con su configuración; cambias y vuelves a «Guardar en tu consola y publicar». Sus celulares lo toman al abrir el portal y su servidor deja de aceptar lo apagado.
- **Descargar clientes.json** y correr `node herramientas/actualizar-servidores.js clientes.json` para ponerlos al día.
- **Panel del asesor y tareas** y **Tu marca / empresa principal**.

Si cambias la llave de un cliente (`nuevaLlaveProveedor` en su Apps Script), pega la nueva en su ficha. En el equipo donde entraste a la consola, el portal muestra además los detalles técnicos (botón «Clave», enlaces de prueba y versiones en «Estado»). En los celulares de los clientes no.

## Vender el portal a varias empresas (sitio multiempresa, v99)

En vez de un sitio por empresa, **tú publicas UN sitio con tu marca** y cada empresa entra con su código. Así una actualización del sitio les llega a todas a la vez, y los servidores se actualizan con un solo comando.

**Lo que es de cada uno:**
- **Tuyo:** el sitio (GitHub Pages), tu marca y el archivo de cada empresa (`empresas/<código>.json`).
- **De la empresa:** su servidor y sus datos, en **su** cuenta de Google. Tú no ves sus datos salvo que te compartan el proyecto como editor para mantenerlo; pon eso por escrito en el contrato.

**1. Tu sitio (una vez)**
1. Sube el portal a tu repositorio de GitHub y activa GitHub Pages (como en el paso 2).
2. Abre `configurar-empresa.html` → **«Tu sitio multiempresa (tu marca)»**. Escribe el nombre de tu producto, tus datos y tu logo. Descarga `empresa.js` y `manifest.json` y súbelos al repositorio.
3. Crea en el repositorio la carpeta `empresas/`.

**2. Cada empresa nueva**
1. Instala su servidor en **su** cuenta de Google: con `node herramientas/instalar-empresa.js … --clientes clientes.json` (camino corto del paso 1) o a mano (paso 1 de esta guía, con el paso 8: compártelo contigo como editor).
2. En tu sitio, `configurar-empresa.html` → **«Empresa dentro de tu sitio multiempresa»**. Llena el código (por ejemplo `acme-sas`), sus datos, su logo y su servidor (`verConfiguracion`).
3. Descarga `acme-sas.json` y súbelo a `empresas/` en tu repositorio.
4. Envía a la empresa el enlace `https://tu-sitio/?e=acme-sas` o imprime el QR que sale en el configurador. Cada celular lo abre una vez y queda en esa empresa. La clave del portal es la de su servidor.
5. En tu **panel del asesor**, crea el cliente con su servidor, su clave y el mismo código.

Un enlace a una página concreta (p. ej. un registro del plan de acción) en un celular sin empresa pide el código y, al entrar, abre esa página.

**¿Por qué me pide «el código de la empresa»? (v114)** No es una contraseña: el sitio no sabe a qué empresa pertenece ese celular. Se evita así:
- **Sitio de una sola empresa (o una principal):** en `configurar-empresa.html` → «Tu sitio multiempresa (tu marca)» → **Empresa principal**, escribe su código (debe existir `empresas/<código>.json`). Descarga `empresa.js` y súbelo. Desde ese momento cualquier celular entra directo a esa empresa, sin preguntar nada.
- **Varias empresas:** comparte el enlace `?e=<código>` o el QR. Abre directo, sin ventana.
- Si el `empresa.js` del sitio ya tiene su propio servidor, el sitio funciona como esa empresa y tampoco pregunta.
- La primera vez se necesita internet para traer los datos de la empresa; después abre sin señal.
- La única contraseña es la del **sistema de gestión**. El preoperacional y los reportes nunca la piden.

Un celular queda en una sola empresa. Para cambiar, se usa «cambiar» al pie del inicio o el enlace de otra empresa. No deja cambiar si hay registros sin enviar, y al cambiar borra lo de la anterior en ese equipo (en el servidor no se borra nada).

**3. Actualizar a todas**
- **Sitio:** subes la versión nueva a tu repositorio y les llega a todas. Nunca reemplaces `empresa.js`, `manifest.json` ni la carpeta `empresas/`.
- **Servidores:** desde tu computador, una vez: Node 18+, `npm install -g @google/clasp`, `clasp login` con tu cuenta, y activar la API de Apps Script en script.google.com/home/usersettings. Luego haz una lista `clientes.json` (fuera del repositorio):
  ```json
  [ { "codigo": "acme-sas", "nombre": "ACME S.A.S.", "scriptId": "1AbC…", "servidor": "https://script.google.com/macros/s/AKfy…/exec" } ]
  ```
  y corre `node herramientas/actualizar-servidores.js clientes.json`.
  - Por cada empresa: descarga su proyecto, conserva su `01-Empresa` y su `appsscript.json`, sube el código nuevo y lo publica en la **misma** URL. Al final comprueba que responda con la versión nueva.
  - Con `--probar` arma todo sin subir nada, y con `--solo acme-sas` actualiza solo esa empresa.
  - Con `--estado` (v167) no cambia nada ni necesita clasp: pregunta a cada servidor en qué versión va y dice cuáles faltan por actualizar, cuáles piden autorización y cuáles no responden. Sirve antes y después de actualizar.
  - Un servidor de la v98 o anterior (sin `01-Empresa`) queda migrado con sus mismos datos.
  - **Código propio de un cliente:** todo `.gs` se reemplaza menos `01-Empresa` y los que empiecen por `propio` (p. ej. `propio-Informes.gs`). Si un cliente agregó un archivo con otro nombre, se quita y el resumen lo dice: renómbralo antes.
- El **panel del asesor** muestra la versión del servidor de cada cliente y cuántos faltan por actualizar.
- Si una versión nueva pidiera permisos nuevos de Google, el dueño del proyecto debe ejecutar ▶ `instalar` una vez; el resumen del comando lo avisa.

---

## Actualizar a una versión nueva del portal

- **Sitio:** sube los archivos nuevos **menos** `empresa.js` y `manifest.json` (esos son de la empresa).
- **Servidor:** solo si cambió algún backend. Vuelve a pegar los archivos de `servidor-unico/` que cambiaron → *Gestionar implementaciones → Nueva versión*.
- **De v98 o anterior a v99 (a mano):** los datos de la empresa pasaron de `00-Portal` a un archivo nuevo, `01-Empresa`. Crea `01-Empresa` con el contenido de `servidor-unico/01-Empresa.gs` y pon ahí las tres líneas (`EMPRESA_NOMBRE`, `CORREOS_SSTA`, `CONTACTO_EPP`) que tenías arriba de tu `00-Portal`. Después pega el `00-Portal` nuevo. Con `herramientas/actualizar-servidores.js` esto se hace solo.
- **De v93 o anterior a v94:** el servidor ahora usa **Google Drive** (adjuntos y respaldo). Después de pegar el código y **antes** de *Nueva versión*, ejecuta una vez ▶ `instalar` y acepta el permiso nuevo de Drive. Si no se autoriza, el portal no puede guardar nada (Google responde con su pantalla de permisos).

Para quien mantiene el código: `servidor-unico/` se genera con `node herramientas/armar-servidor-unico.js` a partir de `backends/`. Las pruebas (`node pruebas/pruebas.js`) avisan si quedó desactualizado.

---

## La empresa demo (para mostrar el portal)

Es el portal completo con una empresa ficticia («Montajes Andinos S.A.S. (empresa demo)»). **No usa Google**: el servidor corre dentro del navegador y lo que se registre queda solo en ese equipo. Tiene datos de ejemplo:

- 2 ATS (uno cerrado);
- permisos en caliente y en alturas firmados;
- el anexo de una obra con 4 días;
- charlas de dos semanas;
- inspecciones de EPP;
- gestión del SG-SST: 12 trabajadores con sus requisitos (uno con alturas vencido, otro con la PILA vencida), reportes (un accidente con FURAT e investigación en curso), plan de acción, 8 equipos con sus inspecciones e indicadores de 3 meses.
- plan anual, matriz de peligros, plan de emergencias con simulacro, exámenes y ausentismo, política, matriz legal evaluada y una revisión por la dirección;
- COPASST y Comité de Convivencia conformados con sus actas mensuales, dos quejas cifradas (la clave de la demo es `Convivencia2026`) y tres auditorías (autoevaluación de estándares mínimos al 85 %, una de cliente y una interna programada).

Las fechas se corren solas para verse siempre recientes. El botón **🧪 DEMO** (abajo a la izquierda) explica qué es y permite **reiniciar**.

**Publicarla:**

1. `node herramientas/armar-demo.js` → sale la carpeta `sitio-demo/`.
2. Súbela a un repositorio de GitHub Pages en **una cuenta distinta** a la de los clientes (por ejemplo, la tuya o la de tu marca).

**Regenerar los datos de ejemplo** (si cambian los formatos): sirve `sitio-demo/` en un puerto y ejecuta `node herramientas/sembrar-demo.js http://localhost:8766` (necesita Playwright).

---

## Protección de datos (Ley 1581 de 2012)

Con esta instalación, la empresa es la **responsable** de los datos (nombres, cédulas, firmas) y los guarda en su propia cuenta. Si quien vende o da soporte va a tener acceso a esa cuenta o a la carpeta, conviene firmar un **contrato de transmisión o encargo de datos** y que la empresa tenga su política de tratamiento y la autorización de los trabajadores.

**Autorización de los trabajadores (desde la v110).** La inducción (la del área SST y la que la persona responde desde el inicio) pide antes de firmar:

- **«Sí, autorizo»** el tratamiento de los datos personales para el SG-SST: es obligatoria para registrar la inducción.
- **«Sí, autorizo mis datos de salud»**: es **voluntaria**, porque la ley no permite condicionar nada a que se autoricen datos sensibles (art. 6). Si la persona no la marca, queda registrado que NO autorizó.

La autorización queda con la inducción (qué marcó, versión del texto y fecha que pone el servidor), sale en la constancia PDF antes de la firma y pasa a la ficha de Personal habilitado. En **Salud**, al registrar un examen de alguien sin esa autorización, el portal lo advierte (no bloquea: el examen es una obligación del empleador). El texto está en `autorizacion-datos.js`: revísalo con el asesor legal de la empresa y, si se cambia, sube su `VERSION`.

**Aviso de privacidad y contrato (v116).** Cada celular ve el aviso (`privacidad.html`) la primera vez. La cláusula modelo de transmisión de datos, lo que falta firmar y la lista del piloto están en `LEGAL-DATOS-PERSONALES.md`.

*Esto es orientación general, no asesoría legal: confírmalo con un abogado.*
