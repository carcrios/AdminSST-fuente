# Historial de versiones — Portal SSTA

Lo más nuevo arriba. Al sacar una versión: `node herramientas/subir-version.js`,
anotarla aquí y `node herramientas/empaquetar.js`.

## v178 — Certificado de aptitud adjunto a la persona y eliminar varias actividades del plan anual

- **Salud → «Leer exámenes (PDF)»**: si el PDF es el **certificado de aptitud sin diagnóstico**, queda **adjunto al examen de la persona** (en Drive; solo SST y el administrador lo pueden abrir). Se ve en la ficha de la persona («certificado adjunto») y al abrir el examen. Si el PDF trae diagnóstico, el portal lo detecta y **no lo adjunta** (Res. 1843 de 2025, art. 30: la empresa solo recibe el concepto).
- **Plan anual de trabajo → «Eliminar varias»**: se tocan las actividades que sobran (o «Marcar todas las visibles», sirve con el filtro por mes), «Eliminar marcadas» y confirmar. El plan anterior queda en el historial de cambios.
- Solo cambia el sitio; el servidor no cambia.

## v177 — El examen en PDF crea a la persona y trae todo lo que dice

- **Salud → «Leer exámenes (PDF)»** ahora trae del examen: tipo de evaluación, fecha, concepto, IPS o médico, próximo examen, **todas las restricciones y todas las recomendaciones** (también cuando vienen como título en mayúsculas sin «:»), si son temporales y hasta cuándo («por 3 meses» se calcula), **para qué trabajos queda restringido** (alturas, cargas, confinados, eléctrico…), las **pruebas realizadas** (audiometría, visiometría, espirometría…) y a qué **programa de vigilancia** ingresa. Nunca el diagnóstico.
- **Si la persona no está en el personal, se crea desde el examen** (nombre, tipo y número de documento, cargo; se pueden corregir antes de guardar).
- **El examen queda en la persona**: al guardar en lote pasa lo mismo que a mano (antes no): el concepto y las restricciones quedan en Personal habilitado y en su ficha, y los permisos lo tienen en cuenta.
- Solo cambia el sitio; el servidor no cambia.

## v176 — Leer exámenes en PDF, seleccionar y eliminar en todas las listas, calendario ordenado

- **Salud → Exámenes → «Leer exámenes (PDF)»**: se eligen uno o varios PDF de la IPS y el portal lee de cada uno a quién pertenece (por la cédula del personal), la fecha, el tipo, el concepto, las restricciones para el trabajo, si son temporales, la IPS y el próximo examen. Se revisa y se guardan todos de una vez, asignados a su trabajador. **Nunca toma el diagnóstico** (descarta las líneas con códigos CIE-10 o «diagnóstico») y **el PDF no se guarda**: se lee en el equipo. Los PDF escaneados (sin texto) se registran a mano.
- **Seleccionar varios y eliminar en todas las listas** de registros (antes solo en 4): «Seleccionar para eliminar», tocar los que sobran, «Eliminar». Va a la Papelera (30 días) y se puede deshacer. Solo Administrador y SST.
- **Calendario**: los días quedan dentro de la tarjeta y alineados (antes se salían a la derecha y el «hoy» salía redondo), el botón «+ Tarea» es el mismo del resto del portal y se quitó **«Cronograma del mes»**.
- Solo cambia el sitio; el servidor no cambia.

## v175 — Para vender: el código del proveedor fuera del público, licencia con solo lectura, Micro 7 y Decreto 1040

- **Lo del proveedor ya no se publica**: el servidor (`Portal-SSTA.gs`), el configurador, la consola, el panel del asesor y el instalador quedan solo en el repositorio privado. Se abren en el computador con `node herramientas/proveedor.js` (consola) o `… configurar` / `… instalar`. La publicación automática los **borra** del sitio público.
- **Licencia firmada y activa** (llave pública en `licencia.js`; la privada fuera del proyecto). Si vence: 60 días igual, con aviso al administrador; después, **solo lectura** (se ve y descarga todo, y se pueden seguir reportando accidentes y recibiendo quejas). Contrato (cláusulas tercera y séptima) y condiciones de licencia actualizados.
- **Plan Micro 7**: para empresas de hasta 10 trabajadores (7 estándares): 8 módulos (plan anual, peligros, personal, capacitación, inspecciones, EPP, reportes y convivencia). Precio en `comercial/PRECIOS.md`.
- **Decreto 1040 de 2026** (Convivencia → pestaña «Decreto 1040»): requisitos del año (política participativa con cero tolerancia, protocolo, canales confidenciales, responsables, reglamento y contratos, socialización, capacitación anual, estadística), plantillas en PDF de la **política** y del **protocolo con la ruta**; en cada queja, **medidas de protección** (en acoso sexual, aviso del plazo de 5 días hábiles) y **6 meses de protección contra represalias**; vínculo de quien presenta la queja (trabajador, contratista, aprendiz…).
- `comercial/GUION-INSTALACION.md`: guion de la videollamada de 45 minutos y del video sobre la pantalla «no es seguro» de Google.
- **Servidor**: hay que actualizarlo (Decreto 1040).

## v174 — Ajustes pedidos: Gestión con la semana y el calendario, personal sin mezclas y más

- **Guía flotante como chat**: al abrirla saluda y pregunta en qué te ayuda; la conversación queda en burbujas.
- **Enlaces para auditores**: pasaron de Usuarios a **Auditorías**. **Corrección**: el auditor ya no necesita la clave del portal (antes se la pedía y la rechazaba); entra solo con su enlace.
- **Papelera**: el texto ya no sale una letra por renglón.
- **Avisos por correo**: cada rol puede tener **varios correos adicionales** (gerente, correo del COPASST…) que reciben el resumen de ese rol.
- **Subir la firma**: en cada recuadro de firma, «📷 Subir firma» (foto o escaneo; se limpia el fondo).
- **Listado maestro de documentos desde Excel** (Documental): con la plantilla o con el formato propio (empareja las columnas por su nombre).
- **Gestión**: «Hoy» y «Lo mío hoy» se unen en **Para hoy y esta semana** (Hoy · Esta semana · Más adelante · Atrasado), **al lado del calendario**.
- **Calendario con tareas**: «+ Tarea» con día, hora y recordatorio (el mismo día, 1, 3 o 7 días antes). Llegan en el correo diario y, con el portal abierto, avisa a la hora. «✓ Hecha» la cierra.
- **Personal sin mezclas**: las sugerencias de nombres salen solo de Personal habilitado (antes mezclaban la base del anexo de permisos). Lo que llega de otros módulos (inducción, anexo, portal del contratista) queda **por revisar** aparte, con «Incluir» o «No es del personal», y no llena los pendientes.
- **Seguridad social del mes para todos**: una sola vez para todo el personal propio.
- Personal habilitado: sin «Traer de la base del anexo»; **tipo de documento** (CC, TI, CE, PPT, PEP, pasaporte).
- Dotación de la brigada: sin «vence» (se controla con la revisión y el estado).
- «Empezar con un cliente nuevo» ahora es **Por dónde iniciar**, sin la fase de instalar el portal.
- **Servidor**: hay que actualizarlo (auditor sin clave, tareas, correos por rol, personas por revisar).

## v173 — La guía flotando en cada pantalla y lo que no supo responder

- **Guía flotante**: un botón «?» abajo a la derecha en cada pantalla abre «Pregúntale a la guía» sin salir de lo que se está haciendo.
  Propone primero las preguntas de esa pantalla. Las respuestas se cargan solo al abrirla (no hace más pesada ninguna pantalla). No sale en Ayuda, en la pantalla de planta ni al imprimir.
- **Lo que no sabe, se anota**: la pregunta sin respuesta (solo el texto, sin quién la hizo) llega al servidor de la empresa; sin señal espera en el equipo y se envía después.
- **Consola**: «La guía no supo responder N preguntas», juntando las de todos los clientes, con cuántas veces y «Copiar la lista» para agregar esas respuestas.
- Corrección: la guía ignoraba mal las palabras vacías («cómo», «se», «de») y una sola palabra parecida podía dar una respuesta equivocada. Ahora no.
- **Servidor**: hay que actualizarlo (la raíz guarda y entrega las preguntas sin respuesta).

## v172 — Más directo para arrancar un cliente y una guía a la que se le pregunta

- Nueva pantalla **Empezar con un cliente nuevo**: un solo camino en orden, en tres fases (instalar el portal, montar la base del SG-SST y poner a andar el primer mes).
  Arriba muestra solo el siguiente paso con el porqué (la norma) y el cómo; lo que el portal ve hecho se tacha solo y lo demás se marca con «Ya lo hice».
- El inicio de administrador y SST cambia «Primeros pasos» por **Tu siguiente paso**: uno solo, más el enlace al camino completo. Desaparece cuando la empresa ya está montada.
- **Pregúntale a la guía** (en Ayuda): se escribe la pregunta y responde con el manual del portal y la norma colombiana (FURAT, COPASST, estándares de la 0312, alturas, exámenes, estabilidad reforzada…), con enlace al módulo.
  Sin IA: funciona sin señal y no envía la pregunta a nadie. Si no sabe, lo dice.
- Solo cambia el sitio; el servidor no cambia.

## v171 — Informe mensual de actividades

- Nueva pantalla **Informe mensual de actividades** (Paso 4 · Medir y cerrar el mes): elige el mes y junta de todos los servidores
  - permisos de trabajo abiertos, cerrados y que siguen abiertos por tipo, y ATS;
  - accidentes (con días perdidos), incidentes, actos y condiciones inseguras, con aviso de FURAT o investigación pendiente;
  - inspecciones por categoría, conformes y no conformes, con cada hallazgo;
  - charlas dadas, asistencias y temas; inducciones y reinducciones con horas;
  - EPP revisados (con las novedades más repetidas) y entregados (cuántas unidades de cada elemento);
  - preoperacionales, simulacros, reuniones de comités y plan de acción (nuevas, cerradas, vencidas).
- Resumen «Lo más importante» en frases y PDF con firma de SST y de quien recibe (gerencia o cliente).
- Si un servidor no responde, su parte dice «sin datos» en vez de un cero falso. No lleva nombres de personas.
- Solo cambia el sitio; el servidor no cambia.

## v170 — Los módulos, agrupados igual que se venden

**Actualiza solo el sitio (tandas 1 y 2).** El servidor no cambió (pegarlo es opcional, solo para que diga v170).

- **La lista de módulos va como se vende**, en el configurador, en la ventana «Menús» de la consola y en el Anexo 1 del contrato: **Base SG-SST** (lo que traen todos los planes), **Complemento Obra** (permisos de alto riesgo, ATS, preoperacionales y anexo de personal; no se vende solo) y **Solo en Integral** (ambiental, calidad y PESV). Antes iba por el ciclo PHVA, y el grupo «En obra» mezclaba lo del complemento con EPP, brigadistas, asistencia y tablero, que son de la base.
- **El panel del asesor ya no cuenta para ningún plan.** Es la herramienta de quien vende el portal: va aparte, en «Herramientas de quien vende el portal», y prenderlo o apagarlo no cambia el plan de la empresa.
- La guía de instalación explica los grupos y trae las capturas nuevas del configurador.

## v169 — Reintegro laboral, presupuesto, pantalla de planta, uso por módulo e informes en inglés

**Actualiza el sitio (tandas 1 y 2) y el servidor.** El servidor nuevo trae los tipos nuevos, la pantalla de planta y el conteo de uso.

- **Reintegro laboral con seguimiento a las restricciones** (Salud → Reintegro). Se registra el regreso después de una incapacidad, solo con el origen y sin diagnóstico: tipo de reintegro (con modificaciones, reubicación…), restricciones, para qué trabajos aplican, vigencia y a quién se comunicaron. Desde una incapacidad médica del ausentismo se inicia con un botón. Los trabajos restringidos quedan bloqueados en Personal habilitado mientras el caso esté abierto. Los seguimientos registran si se cumplen las restricciones y programan el siguiente. Avisa el seguimiento vencido, lo que falta comunicar y las restricciones que vencen. Al cerrar por retiro, advierte la estabilidad laboral reforzada (Ley 361 de 1997, art. 26). Trae el acta de reintegro en PDF para firmar. Solo lo ven el administrador y SST.
- **Presupuesto del SG-SST con su ejecución** (Planear → Presupuesto). Un presupuesto por año con sus rubros y su aprobación; cada gasto se registra contra un rubro. Muestra, por rubro, lo presupuestado, lo ejecutado, el porcentaje y el saldo, y avisa si la ejecución va muy por debajo de lo esperado a la fecha o si se pasó. Trae el PDF con firmas (evidencia del estándar 1.1.3) y los gastos en CSV.
- **Pantalla de planta para el televisor.** Días sin accidentes de trabajo, el récord, los reportes del mes, las acciones vencidas y las inspecciones, en letra grande, con un mensaje de seguridad que rota y un QR para reportar. El televisor entra con un enlace que SST crea y puede cambiar. Se actualiza sola cada 5 minutos, sigue mostrando lo último si se cae la red y no muestra ningún nombre.
- **Uso por módulo en la consola.** Cada servidor cuenta cuántos registros se guardan en cada módulo cada mes (solo números). La consola lo trae cada mañana y lo muestra en la tarjeta de cada cliente, con lo que no usa y una sugerencia de plan (por ejemplo, «no ha usado Obra: capacítalo o pásalo a SG-SST Esencial»).
- **Informes en inglés.** El informe del SG-SST, los indicadores, el tablero gerencial y la pantalla de planta tienen el botón ES | EN, y sus PDF salen en el idioma elegido. Lo que escribió la gente (nombres, hallazgos) se deja como se registró.
- El LEEME de la entrega explica la carpeta COMERCIAL (y que no se sube a GitHub).

## v168 — Listas que traen solo lo que cambió, y prueba de carga

**Actualiza el sitio (tandas 1 y 2) y el servidor.** El orden no importa: el sitio nuevo funciona con el servidor viejo (pide las listas completas, como antes) y el servidor nuevo, con el sitio viejo.

- **Las listas ya no viajan completas cada vez.** El celular guarda su copia y pide solo lo creado, modificado o borrado desde su última lectura. En la prueba con 10.000 registros, la lista del plan de acción pasó de 2 MB a 2 KB por consulta; con 50.000, de 10,5 MB a 2 KB. El servidor lee 4 columnas angostas en vez de las 12.
- **Redes de seguridad:** el celular vuelve a pedir la lista completa una vez al día, cuando cambia el usuario o el rol, después de archivar registros, y cuando la cuenta del servidor no cuadra con su copia.
- **Datos de salud:** igual que antes, no dejan copia en el celular y siempre se piden completos.
- **La copia de las listas pasa de localStorage a IndexedDB:** ya no compite por espacio con los borradores y las firmas, y una lista grande ya no se queda sin copia para trabajar sin señal. Se borra al cambiar de empresa.
- **Restaurar de la papelera** ahora queda con su fecha de cambio.
- **Ficha 360:** leía la hoja una vez por cada registro de la persona (100 registros, 100 lecturas); ahora, máximo 12.
- **Prueba de carga** (`PRUEBA-DE-CARGA.md`): `node herramientas/carga.js` mide el servidor real en el simulador hasta 50.000 registros; `herramientas/carga-en-google.gs` mide los segundos reales en un Apps Script de prueba, y `herramientas/carga-concurrente.js`, 20 guardados a la vez.

## v167 — Empresa nueva con un comando y código más fácil de mantener

**Actualiza solo el sitio (tandas 1 y 2).** El servidor no cambió: hace lo mismo que el de la v166 (pegarlo es opcional, solo para que diga v167).

**Instalación**
- **Empresa nueva con un comando:** `node herramientas/instalar-empresa.js --codigo … --nombre "…" --correos …` crea el proyecto en Apps Script, le pone el servidor de esta versión con el nombre, los correos y el WhatsApp ya escritos, la zona horaria de Bogotá, lo publica como aplicación web y anota la empresa en tu lista de clientes. Reemplaza los pasos 1 a 6 del servidor. Quedan dos pasos que Google solo le deja hacer al dueño de la cuenta: ▶ instalar (aceptar permisos) y ▶ verConfiguracion (copiar la clave). Con `--probar` arma todo sin crear nada.
- **¿En qué versión va cada cliente?** `node herramientas/actualizar-servidores.js clientes.json --estado` le pregunta a cada servidor y dice cuáles están al día, cuáles faltan, cuáles piden autorización y cuáles no responden. No cambia nada ni necesita clasp.
- **El botón «Copiar el servidor» del instalador ya funciona en un sitio publicado por GitHub Actions:** el flujo dejaba por fuera el archivo que ese botón copia.
- **El sitio demo ya no lleva precios ni contrato.** La carpeta de la demo (que se sube a un repositorio abierto) traía `comercial/`, la guía y los documentos internos. Ahora la verificación de la versión lo revisa. **Si ya subiste una demo de la v166 a mano, borra de ese repositorio la carpeta `comercial/`.**
- El paquete pesa menos (la demo ya no repite la guía ni los documentos).

**Mantenibilidad**
- **`common.js` por partes:** sus 3.600 líneas viven ahora en `fuente/common/`, en 12 archivos por tema (firma, cola sin señal, sesión, accesibilidad…), ninguno de más de 600 líneas. `common.js` se arma uniéndolos (`node herramientas/armar-common.js`) y queda igual letra por letra: las pantallas y los celulares no notan nada. Se cambia la parte, nunca `common.js`; las pruebas, el pre-commit y GitHub fallan si alguien lo edita a mano. `--linea N` dice en qué parte está una línea que reporta el navegador.
- **Mapa del código** (`MAPA-DEL-CODIGO.md`): qué hay en cada archivo, qué módulos define y qué pantallas lo cargan. Se escribe solo al sacar cada versión.
- **Tope a las líneas kilométricas:** se cuentan las líneas de más de 200 caracteres por archivo (hoy 1.914) y ninguna versión puede subir ese número; solo baja.
- Las pruebas nuevas de esta versión ejecutan las herramientas (con un clasp simulado) y comparan el resultado, en vez de buscar un texto en el código.

## v166 — El SG-SST como base, documentos comerciales firmables y .zip en Windows

- **Planes rehechos: el SG-SST es la base.** «SG-SST Esencial» trae todo el ciclo de la Res. 0312 con EPP y dotación, capacitación, contratistas y proveedores. «Obra» (permisos de alto riesgo, ATS, preoperacionales y personal autorizado) es un complemento que se suma a la base y no se vende solo: «SG-SST + Obra» es el paquete para constructoras. «Integral» agrega ambiental, calidad y PESV. Una prueba exige que todo plan traiga el ciclo completo del SG-SST.
- **Documentos comerciales firmables:** carpeta `comercial/` con propuesta, contrato, Anexo 1 (plan, precios y módulos), Anexo 2 (encargo de datos, Ley 1581), Anexo 3 (niveles de servicio) y Anexo 4 (revendedor). `node herramientas/comercial.js` los arma en Word y PDF con versión, fecha, «Página X de Y» y firmas. La tabla de módulos por plan sale del código del portal, así que el contrato y el portal no pueden decir cosas distintas. Van en el zip (carpeta COMERCIAL), nunca en el sitio público, y la verificación de la versión revisa que estén.
- **Precios ajustados al nuevo modelo:** SG-SST Esencial desde 350.000/mes, SG-SST + Obra desde 520.000 e Integral desde 800.000, por tramo de trabajadores de la 0312.
- **El .zip lo arma Node** (fflate): `publicar.js` ya no necesita el programa «zip» y funciona igual en Windows.
- **Importar:** los topes del Excel (5000 filas) ahora también aplican a un CSV o a un texto pegado, más un tope de 4 MB de texto, antes de leerlo: el celular no se cuelga.

## v165 — Publicar con un solo comando, tres planes y pruebas para iPhone

- **Un solo comando para sacar una versión:** `node herramientas/publicar.js vNNN`. Revisa el CHANGELOG, sube la versión, recalcula la CSP, corre lint y todas las pruebas, rehace las capturas y la guía si hace falta, arma la entrega con las pruebas en navegador sobre el sitio minificado, la verifica y deja el .zip. Si un paso falla, no hay versión. Con `--git` hace commit y etiqueta; con `--push`, además sube.
- **Verificador de la versión** (`herramientas/verificar-release.js`): misma versión en todos los archivos, CSP de cada página al día, ningún `onclick`, núcleo sin señal completo, servidor generado igual a `backends/`, guía y capturas de esta versión, y paquete sin archivos internos ni carpetas de más de 100 archivos.
- **Revisión antes de cada commit** (`herramientas/git-hooks/pre-commit`) y en GitHub: verificación de la versión, servidor generado al día, aviso de vulnerabilidades y de secretos en el código.
- **Pruebas en WebKit (Safari / iPhone):** la misma suite corre con `SSTA_MOTOR=webkit`. En GitHub va en un trabajo aparte que avisa sin frenar la publicación hasta que salga en verde varias veces.
- **Tres planes:** Obra, SG-SST e Integral. En el configurador, un botón deja prendido exactamente el plan contratado, y si se toca un módulo suelto queda «personalizado». La consola muestra el plan de cada empresa.
- **RELEASE.md:** cómo sacar una versión y cómo volver a la anterior (sitio y servidor) sin perder datos.
- Guía de instalación: el paso de módulos ahora habla de los planes, y la hoja de instalación pide plan y tramo.

## v164 — Maestro único de personas

- **Cada persona tiene un `personaId` que no cambia nunca.** Lo pone el servidor; el celular no lo puede cambiar.
- **Corregir una cédula ya no parte a la persona en dos.** La cédula vieja queda guardada y se sigue encontrando por ella: lo registrado antes (inducciones, actas, permisos, ATS, charlas) sigue saliendo en su ficha 360.
- **Unificar fichas repetidas conserva todo.** La ficha que queda recoge la cédula y el `personaId` de la otra. Buscar por cualquiera de los dos lleva a la que quedó. Una inducción o un examen que llegue con la cédula de la ficha unificada va a la que quedó, no a la inactiva.
- **Una sola lista de personas.** Quien se agrega al anexo de personal autorizado entra también a Personal habilitado «por revisar». Si ya estaba, aun con una cédula anterior, no se repite. «Traer de la base del anexo» tampoco repite a quien ya está con otra cédula.
- **Maestro de personas en CSV para nómina o PILA.** SST lo descarga desde Personal habilitado: una fila por persona con su `personaId`, sus cédulas anteriores, cargo, área, empresa y estado. No lleva datos de salud.
- **Ficha 360 por `personaId`** (`persona.html?p=…`). Muestra el `personaId` y las cédulas anteriores, y busca en permisos, ATS y charlas con todas las cédulas de la persona.
- Las fichas que ya existían reciben su `personaId` solas la primera vez que se abre el maestro. También se puede hacer a mano: `sgsst__asignarPersonaIds`.

## v163 — Lo que encontró la segunda revisión

- **GitHub ya publica:** el flujo instala ESLint (`npm ci` en `herramientas/lint`) antes de las pruebas. Antes, en un clon limpio, las pruebas fallaban y no se publicaba.
- **ATS y Reportes funcionan sin señal desde la primera instalación:** su código (`ats.app.js`, `reportes.app.js`) y el de otras pantallas del núcleo ahora se guardan en la primera visita. Una prueba nueva instala, quita la señal y abre las dos.
- **Bitácora sin candado doble:** dentro de un guardado ya no se pide el candado otra vez (en Apps Script, soltar el de adentro dejaba el resto del guardado sin protección).
- **Política de seguridad más estricta:** sin `'unsafe-inline'` para scripts; cada página permite solo sus propios scripts por su huella. Un `<script>` o un `onclick` metido por `innerHTML` ya no corre. Se quitaron los 5 `onclick` que quedaban.
- **Importar Excel con topes:** máximo 8 MB, 40 MB descomprimido y 5000 filas; un «zip bomba» se rechaza sin colgar el celular.
- **Guía de instalación con las pantallas actuales:** capturas nuevas tomadas de las pantallas reales (`herramientas/guia/capturas.js`) y textos al día.
- Instalador: el ícono de «A. Mi sitio» se veía como un cuadro oscuro; ya se ve el escudo.

## v162 — Revisión completa: uso en campo, seguridad, identidad, datos y producto

**Uso en campo**
- Letra base de 15 px, un solo botón principal por pantalla y los demás en contorno; etiquetas que no desaparecen al escribir.
- Encabezado con menos botones: en celular, Clave, Sol, Letra, Estado y Ayuda pasan al menú «Más».
- Quien entra con usuario cae directo en Gestión con «Lo mío hoy» arriba; guía de inicio por rol.
- Barra de contexto compacta en el instalador, QR con «Copiar enlace», ayudas más cortas.
- Videos con subtítulos y portada; aviso de error con «Copiar diagnóstico».

**Seguridad y pruebas**
- Política de seguridad (CSP) en todas las páginas; pruebas unitarias reales; ESLint con regla de innerHTML; revisión de accesibilidad (axe) en todas las páginas.
- Bitácora encadenada con hash y página para consultarla y verificar que nadie la alteró.
- Scripts que no bloquean la carga; el JavaScript de las 5 páginas más grandes va en archivos aparte.

**Identidad y datos**
- Ficha 360 de cada persona (permisos, ATS, charlas, SG-SST) y fichas por área y contratista.
- Validación de cédula y NIT (dígito de verificación); personal autorizado y habilitado en una sola lista; fusión de duplicados con historial.
- Importar Excel (.xlsx) con mapeo de columnas, simulación, política de duplicados, deshacer e historial.
- Calendario para suscribirse (ICS) y «Descargar todo».

**Producto**
- Certificados de inducción con QR verificable; solicitudes de datos personales (Ley 1581) con plazos legales.
- Enlace de solo lectura para auditores; avisos personales por usuario; búsqueda global (Ctrl+K o «/»); normograma.
- Portal del contratista: sube sus documentos y su personal para revisión.
- Acciones en lote en el plan de acción; licencia firmada que nunca bloquea el portal, con su EULA.

## v161 — Investigación de accidentes con los datos del FURAT

- **Sección «Investigación de accidentes»**: tarjeta en el inicio y pestaña «Investigaciones» en Reportes.
  - Muestra todos los accidentes e incidentes con su estado (por investigar, en curso, investigada) y el plazo de 15 días.
  - Se abre directo la investigación.
- **Datos del FURAT dentro de la investigación** (formato de la Res. 1401 de 2007):
  - I. Persona que se accidentó: vinculación, apellidos y nombres, identificación, nacimiento, sexo, residencia, cargo, ocupación, ingreso, salario y jornada.
  - II. Accidente: fecha, hora, día, jornada, labor habitual, tiempo previo, tipo, muerte, lugar y sitio, tipo de lesión, parte del cuerpo, agente y mecanismo, con los códigos del formato.
  - Se precargan del reporte, de Personal habilitado y del perfil de la empresa.
- **Testigos** con su declaración, y responsable del informe.
- **Formato de investigación en PDF** con las secciones del formato de la empresa: 0 a IX, causas en las cuatro casillas, soluciones con responsable y fecha, participantes, representante legal y profesional SST con licencia.
  - Su código se asigna en Configurar empresa (formato «SG-INV-AT»).
- **Inventario:** el filtro por elemento siempre está visible, tanto por categoría como por elemento (la descripción: «Arnés», «Extintor PQS 20 lb»…). Las hojas de vida en lote salen del filtro.

## v160 — Hojas de vida y filtro por elemento en el inventario

- **Filtro por elemento** en el inventario y en los pendientes: extintores, botiquines, arneses, vehículos, etc., con cuántos hay de cada uno.
- **Hoja de vida del equipo:**
  - Datos técnicos: marca, modelo, serie, fecha de compra, proveedor y características.
  - Registro de mantenimientos y reparaciones: fecha, tipo, qué se hizo, quién y costo. Actualiza solo la fecha del último y del siguiente mantenimiento.
  - PDF con identificación, datos técnicos, vencimientos, contenido (botiquín), mantenimientos, inspecciones y firmas.
- **Hojas de vida en lote:** un solo PDF con las de todo el inventario o solo las del elemento filtrado.
- La ficha del equipo también muestra los datos técnicos y los mantenimientos.

## v159 — El portal llena solo lo que ya sabe

1. **Autollenado por cédula en todo el portal**, también en permisos, ATS, charlas e inspección de EPP. Al escribir una cédula conocida o elegir a alguien por su nombre, se llenan los campos vacíos de nombre, cédula, cargo, área y empresa de esa persona. En listas de varias personas, nunca se llenan las filas de otros.
2. **ATS desde el permiso.** El botón «🧭 Hacer el ATS con estos datos» abre un ATS nuevo con el trabajo, el sitio, las fechas, la cuadrilla y el tipo de permiso.
3. **Repetir el de ayer en el preoperacional.** El botón «↻ Mismos datos del último» recuerda el equipo, la persona y el centro, nunca el estado del equipo. El ATS, los permisos y las charlas ya tenían cómo copiar.
4. **Mi firma.** Quien entra con usuario guarda su firma una vez en su equipo y la pone con un toque (con confirmación) en cualquier recuadro de firma.
5. **«Lo mío hoy» primero.** Va arriba en Gestión, y quien entra con usuario cae directo en su pantalla de trabajo (una vez por sesión).
6. **Acciones automáticas.** Un acto o condición insegura, un incidente o un preoperacional con novedad crean solos su acción en el plan de acción:
   - Se asigna al responsable del área según Departamentos y áreas.
   - La fecha es de 5 días si el potencial es alto y de 15 en los demás casos.
   - Nunca se duplican. El accidente sigue por la investigación.
7. **Ficha del equipo** (equipo.html): estado, vencimientos y mantenimiento, inspecciones, preoperacionales, acciones por sus hallazgos, reportes y QR. Se abre desde el inventario.
8. **Informe del mes automático.** El día 1 sale por correo a SST y gerencia el resumen del mes, con el enlace al informe gerencial. Sale una sola vez por mes.
9. **El plan anual se cumple solo**, también en las actividades «a mano», cuando un registro del mes nombra lo mismo. Lo marcado o desmarcado a mano manda.
10. **Carpeta de auditoría con un clic** (Carpeta de evidencias): un .zip con una carpeta por numeral de la Res. 0312, con sus soportes y la lista de registros. No incluye datos de salud.
11. **Recordatorios por WhatsApp.** El botón «📲 Avisar» en los vencimientos del mes usa el celular nuevo de Personal habilitado, que no se muestra sin sesión.
12. **Datos por depurar** (Análisis y alertas): cédulas duplicadas, mismo nombre con cédulas distintas, personas inactivas con movimiento, áreas escritas de varias formas (botón «Unificar») y equipos sin inspección en 90 días.

## v158 — Análisis y alertas: lo que dicen los datos juntos

- **Nuevo módulo «Análisis y alertas»** (Revisar y mejorar) con 9 pestañas:
  - **Alertas de patrón:** 3+ reportes iguales en el mismo lugar en 30 días, equipo no conforme dos inspecciones seguidas, persona con EPP dañado 2+ veces en 90 días, persona lesionada 2+ veces en el año, 3+ acciones con más de 30 días vencidas.
  - **Controles no evidenciados:** lee los controles de la matriz de peligros y busca la inspección, el mantenimiento o el EPP en la matriz de EPP de los cargos.
  - **Costo de la accidentalidad:** días de incapacidad × salario promedio que pone el usuario, más un factor de costos ocultos; gráfica por mes.
  - **Calificación de contratistas:** personal habilitado, documentos, accidentes y evaluación → nota de 0 a 100.
  - **Res. 0312:** estimado hoy y en 30 días, y qué estándares se caerían.
  - **Charlas sugeridas** según actos/condiciones repetidos por área.
  - **Personas sin actividad:** sin inducción vigente, sin entrega de EPP o sin examen en el año.
  - **Vencimientos agrupados por mes y tipo** (3 meses) para programar en lote.
  - **Eficacia de acciones:** si el problema se volvió a reportar después de cerrar, se marca «no eficaz» con botón para reabrir.
- **Semáforo de la cuadrilla** en permisos y ATS antes de empezar: cuántos en verde, por vencer y no habilitados.
- La matriz de peligros guarda el texto de los controles para poder revisarlos.

## v157 — Los datos del portal conectados entre sí

1. **Restricciones médicas que frenan el trabajo.** En el examen se marca «¿Para qué trabajos tiene restricción?» (alturas, confinados, caliente, eléctrico, izajes, cargas, conducción). Solo eso pasa a Personal habilitado, con su vigencia y sin diagnóstico. Los permisos y ATS de ese trabajo no dejan incluir a la persona mientras la restricción esté vigente. Un concepto «No apto» bloquea todo trabajo de alto riesgo.
2. **Del peligro al PVE.** Cada programa muestra los cargos expuestos según la matriz de peligros (ruido → auditivo, biomecánico → osteomuscular…). Ofrece agregar a quienes faltan y avisa si el profesiograma de esos cargos no pide la prueba de vigilancia (audiometría, espirometría…).
3. **Ficha del trabajador** (nueva). Todo de una persona en un solo lugar:
   - Semáforo de habilitación por tipo de trabajo y requisitos.
   - EPP entregado e inspeccionado, reposiciones pendientes, dotación e inducción.
   - Accidentes donde fue el lesionado y, solo para SST, exámenes y PVE.
   - Se imprime, y se abre desde Personal habilitado o desde su tarjeta.
4. **Inspección de EPP → entrega.** Lo que queda en «Malo» aparece en Entrega de EPP → Reposición como «Pedidos por la inspección de EPP». Al entregarlo y firmarlo, el pedido queda ENTREGADO y su acción se cierra sola con la entrega como evidencia.
5. **Cerrar el ciclo.** Al cerrar un accidente o incidente, el portal propone revisar el peligro en la matriz (abre la matriz ya filtrada), valorar el PVE del lesionado y ver su ficha.
6. **Indicadores por área** en el informe: accidentes e incidentes, inspecciones no conformes y personal activo por departamento.
7. **Plan anual que avanza solo con más registros:** entregas de EPP, dotación, seguimientos del PVE e inspecciones de extintores, botiquines y camillas. Al escribir una actividad, el portal propone con qué registro se cumple.
8. **«Lo mío hoy».** Los pendientes del inicio ahora también traen reposiciones de EPP por entregar, mantenimientos, evaluaciones del PVE y el fin de las restricciones médicas temporales (solo SST).

## v156 — «Atrás» que vuelve, mantenimiento en el inventario, botiquín editable y EPP desde la matriz

- **«← Atrás»:** el botón de cada módulo (antes «← Volver al portal», que llevaba al inicio) ahora vuelve a donde estabas: Gestión, con la categoría abierta y en el mismo punto. Si estás en una pantalla interna, vuelve primero a la lista del módulo. Si entraste directo (QR o enlace), va a Gestión si tienes sesión.
- **Inventario:**
  - Cada tarjeta dice qué equipo es (categoría, tipo y área).
  - Lo que está por vencer dice «Por vencer» (antes «! Al día»).
  - Nuevo «¿Aplica mantenimiento?» (preventivo, correctivo o ambos), con fecha del último y del siguiente. Avisa cuando faltan 30 días y marca «Atención» si se venció.
- **Botiquín:** su contenido se edita en el equipo. Se agregan o quitan elementos, se cambia la cantidad mínima y la unidad, y se puede volver al contenido del tipo. La inspección cuenta contra ese contenido.
- **Paquete para el cliente:** ya no incluye los PVE.
- **Inspección de EPP:**
  - Los EPP salen de la matriz de EPP. Arriba se eligen cuáles se inspeccionan, y al escoger al trabajador se marcan solos los de su cargo. Se pueden agregar otros.
  - Los campos de equipo de alturas (serial, pre-uso o anual, caída) solo aparecen si se inspecciona arnés, eslinga o línea de vida.

## v155 — Vigilancia epidemiológica (PVE) como módulo propio y «atrás» en Gestión

- **Nuevo módulo «Vigilancia epidemiológica (PVE)»** (Hacer → Personas), separado del paquete para el cliente y de Salud:
  - **Programas:** responsable, objetivo, metas (prevalencia máxima y cobertura) y actividades del año (programadas y ejecutadas), con actividades típicas sugeridas por programa.
  - **Personas:** entran por examen médico (las que el médico remitió en el examen aparecen en «Remitidos por examen», con «Agregar» o «Agregar todos»), por cargo expuesto o a mano. Cada una tiene clasificación (expuesto, sospechoso o caso, sin diagnóstico), seguimientos, recomendaciones, próxima evaluación y egreso.
  - **Indicadores:** población, prevalencia, incidencia del año, cobertura de evaluación, seguimientos vencidos y cumplimiento de actividades, con semáforo y gráficas por programa y del conjunto.
  - **PDF:** informe por programa y de todos los PVE.
  - Datos de salud: solo SST y administrador, sin copia en el celular, y bloquea si se escribe un diagnóstico.
  - Salud → «Vigilancia» ahora lleva al módulo.
- **Gestión:** al abrir una categoría, el botón «atrás» del celular la cierra y te deja en la lista de categorías, en vez de sacarte al inicio. Cada categoría abierta tiene su botón visible «← Categorías». Dentro de los módulos, «atrás» sigue volviendo a la pantalla anterior.
- Arreglo: el color gris claro (n-100) no existía y algunos fondos salían transparentes en el inicio, emergencia, etiquetas QR y papelera.

## v154 — Botiquín Res. 0705, departamentos, tablero gerencial y 5 porqués a la vista

- **Corrección importante:** el enlace de accesibilidad «Saltar al contenido» repetía el id «contenido» en 4 páginas (Informe, Plan anual, Carpeta de evidencias y Cierre del mes). Al cargar, la página borraba su propia cabecera y el selector de periodo, y no dejaba sacar el PDF del informe. Corregido, con prueba.
- **Botón «Estado»:** solo lo ve quien entró con su usuario.
- **Extintor:** «Fecha de recarga» y «Recarga (vence)». Al poner la fecha de recarga, el vencimiento se calcula a 12 meses y se puede corregir.
- **Botiquín** (antes «Botiquín y camillas»; las camillas quedan en su propia lista):
  - Se elige el tipo A, B o C (Res. 0705 de 2007, con la guía por m²).
  - La inspección trae el contenido de ese tipo, con el mínimo de cada elemento (12 en el A, 32 en el B y el C).
  - Se escribe cuántos hay y cuándo vencen. Si hay menos del mínimo o está vencido, queda NC con la observación escrita sola.
- **Inventario:** «➕ Otra categoría» crea una lista nueva sin salir del equipo (trae preguntas generales que se pueden ajustar). Cada equipo tiene ahora «Departamento / área».
- **Departamentos y áreas:** página nueva (Planear). Se escriben una vez, con responsable opcional; se pueden sugerir los típicos o traer los ya escritos. Todos los campos de «Área» del portal (personal, equipos, reportes, ATS, matriz de peligros, permisos…) los ofrecen al escribir.
- **Informe del SG-SST:** «Tablero gerencial» con 10 indicadores en semáforo (accidentes, frecuencia, severidad, ausentismo, plan anual, capacitación, inspecciones, plan de acción, personal habilitado y estándares), en pantalla y al inicio del PDF. Se saca por mes, trimestre o año.
- **Plan de acción:** tarjeta «Análisis de causa · 5 porqués», siempre visible en cada acción. Se hace o rehace en cualquier momento, con ayuda en cada paso, pistas y un ejemplo completo. Al cerrar se sigue pidiendo si falta (obligatorio en las correctivas).

## v153 — Paquete de documentación para el cliente

- Nuevo módulo «Paquete para el cliente» (Ejecutar los programas → Personas). Se marcan las personas, los equipos y los programas de vigilancia (PVE) y de alto riesgo que pide el cliente, y se descarga un solo .zip con:
  - «00 Índice» en PDF: relación del personal con el vencimiento de cada requisito (en rojo lo vencido), los equipos con su última inspección y vencimientos, y cada programa con objetivo, actividades y cobertura.
  - Carpetas Personal/, Equipos/ y Programas de vigilancia/ con los soportes cargados en el portal (cursos, PILA, fotos de soportes, documentos de cada equipo y de cada programa).
- Botón «Solo los habilitados» según el trabajo (alturas, confinados, caliente, eléctrico, izajes).
- Los conceptos médicos de aptitud solo van si se marcan expresamente. Las historias clínicas y los nombres de quienes están en cada PVE nunca van.
- El .zip queda también en Drive («Paquetes para clientes»). Si se marca, se deja con enlace para compartir y se envía por WhatsApp.
- Equipos: ahora se suben sus documentos (ficha técnica, certificado o calibración, manual, hoja de vida) para que salgan en el paquete.

## v152 — 5 porqués al cerrar, textos visibles y «atrás» sin perder el lugar

- Plan de acción: al cerrar una acción aparecen los **5 porqués guiados**. Cada respuesta se vuelve la siguiente pregunta, con ayuda en cada paso y pistas (método, mano de obra, material, máquina, entorno, supervisión). Se puede corregir el anterior. La última respuesta queda como causa raíz y los porqués quedan en el detalle. Son obligatorios en las acciones correctivas; en las demás se pueden omitir.
- Textos que no se veían: algunos colores quedaron definidos «en sí mismos» en la v150 y salían vacíos. El más visible era el aviso de privacidad del inicio, que quedaba transparente. Se corrigieron todos (8 archivos) y hay una prueba para que no vuelva a pasar. El aviso queda encima de la barra inferior.
- Inicio: al entrar a un módulo y volver con «atrás», se reabre la categoría y se baja al mismo punto, en vez de volver al principio de la página.
- Extintores: solo se controla la recarga. El aviso dice los días reales que faltan («Vence en 21 días»).
- Se quitó el botón «Plantillas» de todos los formularios.

## v151 — Ajustes después de probar la v150

**Inicio sin usuario**
- Sin la frase «El preoperacional y los reportes no piden usuario…».
- La clave del equipo y «Estado del sistema» solo se ven dentro de Gestión.
- La tarjeta «Llegué hoy a la obra» ahora dice «Inducción».

**Reportes**
- Sin el botón «Plantillas».
- Acción inmediata tomada en casillas iguales, en dos columnas y con borde (antes se veían sueltas).
- El incidente lleva los mismos cuadros que los actos y condiciones: relacionados, acción inmediata, plan sugerido y consecuencias.

**Emergencia**
- Al escribir la cédula completa del trabajador aparece su contacto de emergencia, RH, EPS y ARL, también sin usuario. Solo con la cédula exacta (no hay lista) y cada consulta queda en la bitácora.
- Se quitó el botón «Reportar el accidente».

**Personal habilitado**
- Requisito nuevo: concepto de manipulación de alimentos (vigencia 12 meses, con concepto de aptitud). Aparece también en empresas ya configuradas.

**Guardar más rápido**
- El servidor se «despierta» apenas se empieza a llenar un formulario, así al guardar ya está listo (se ahorran 2–5 s en el primer guardado).
- Cada hoja del libro se busca una sola vez por guardado, y la revisión de la papelera de Drive se hace cada 10 minutos en lugar de en cada petición.

## v150 — Firma de actas por enlace, entrega de dotación y pendientes

**Nuevo**
- Firma de actas por enlace: en COPASST, Convivencia y Comité de emergencias, «Enviar enlace para firmar» da QR, WhatsApp y copiar. Cada persona abre `firmar-acta.html` en su celular, se busca en la lista (o firma como invitado) y firma. Enlace firmado con HMAC (propiedad FIRMA_ACTAS); sin señal la firma queda en cola. En Convivencia no se muestran el lugar ni los temas.
- Módulo «Entrega de dotación» (CST art. 230): plazos 30 de abril, 31 de agosto y 20 de diciembre; quién falta por recibir (con derecho y más de 3 meses), tallas por persona, entrega con firma y declaración de uso (art. 233–234), acta en PDF y planilla del periodo.

**Pendientes resueltos**
- Modo oscuro automático (según el teléfono). El modo sol sigue mandando.
- Permisos: enlace «← Volver al portal» en la cabecera.
- Indicadores: la tendencia muestra el valor de cada barra y la meta (promedio del año anterior); la tabla solo lista meses con datos.
- ATS: no se cierra mientras haya envíos del mismo ATS en cola.
- Charlas: firma de quien da la charla; se guarda en el servidor y sale en el PDF.
- COPASST: botón «Riesgo inminente / accidente grave» que abre la reunión extraordinaria con fecha del hecho y aviso si pasa de 5 días (Res. 2013 de 1986, art. 9).
- Convivencia: el informe trimestral/anual queda guardado en el servidor (solo cifras) y se puede volver a abrir.
- Matriz de peligros: «Cruzar con los ATS» muestra los peligros identificados en campo que no están en la matriz, con botón para agregarlos.
- Gestión ambiental: los aspectos en condición de emergencia se cruzan con los PON del plan de emergencias.
- Carpeta de evidencias: «Paquete para el auditor», un solo PDF con el índice por estándar y los registros de cada módulo (sin datos de salud ni quejas).
- Verificado: el tamaño del Comité de Convivencia coincide con la Res. 3461 de 2025, art. 3. Revisados los PDF de revisión por la dirección, exámenes, fichas de indicadores e investigación de AT.

## v149 — Revisión de diseño (pantallas de obra, gestión y PDF)

**Obra**
- La barra «N preguntas sin responder» ya no tapa «Guardar apertura»: las acciones suben sobre ella. La etiqueta DEMO tampoco tapa contenido.
- Objetivos táctiles para usar con guantes: botones del inicio de cada permiso y campo del código de 48 px; «Borrar firma» y «Deshacer trazo» como botones de 44 px; SÍ/NO de 64×48; «Volver», el chip de sesión, los enlaces del pie y las plantillas de EPP de 44 px; pasos de MEDEVAC de 48 px.
- Modo sol también en las cabeceras (fondo negro y letra blanca, sin degradado ni sombras de color).
- «Sin señal» en ámbar (el rojo queda para errores). `color-scheme: light` para que el teléfono no oscurezca la app a la fuerza.
- Inspección de EPP: las 3 pestañas en una línea y «Limpiar» como enlace discreto (ya no compite con «Guardar»). MEDEVAC: nada queda bajo la barra inferior. Buscador del preoperacional con texto corto.

**PDF del SG-SST**
- Los títulos de columna se repiten en cada hoja; arriba de cada hoja van el título, el código y la versión del formato; abajo, el registro, la fecha de impresión, la empresa y «Página X de Y» (antes solo en la primera o la última hoja, y en letra Times).
- Letra en puntos (7–11 pt, antes 6 pt); palabras que ya no se parten a la mitad («ACEPTABI-LIDAD»); secciones y firmas que no quedan huérfanas al pie de una hoja.
- Matriz de peligros con semáforo de nivel y aceptabilidad en el papel.

**Gestión**
- Gerencia: los enlaces de la alerta con el estilo del portal y un solo botón principal (el PDF pasa a secundario); las etiquetas de las tarjetas ya no se recortan.
- Plan de acción: el verde queda solo para lo cerrado; lo abierto y a tiempo va en gris.

## v148 — Lo que encontraron los 14 revisores por módulo

**Datos de salud y confidencialidad**
- La foto del concepto médico ya no le llega a quien no es SST (la tapaba solo el texto de las restricciones). Sin usuarios creados (clave pública) tampoco se ven restricciones, aptitud fina ni autorización de datos.
- Supervisor y comité pueden crear el preoperacional de salud de alguien, pero no leer ni cambiar uno guardado; la respuesta ya no devuelve el resumen.
- Adjuntos de salud del personal e incapacidades de un reporte, y la lesión de un AT: solo SST (y el comité que investiga la lesión).
- El respaldo externo ya no va por defecto al correo del asesor (solo a RESPALDO_EXTERNO) y avisa que es confidencial.
- El celular no guarda copia de las listas de salud, quejas ni buzón. Los pendientes no dicen a quién le toca examen médico.
- Quejas y actas de Convivencia: solo su comité y SST (antes cualquier usuario veía la lista de quejas). En Usuarios se marca a qué comités pertenece cada integrante. El motivo y los temas de las actas de Convivencia no se copian a la hoja.

**Personal habilitado (una sola regla para todo)**
- `Habilitacion.exigir`: permisos, ATS y registro diario de personal bloquean a quien no está habilitado (antes el ATS y el registro diario solo avisaban); la excepción la hace SST o el administrador con justificación escrita.
- En alto riesgo: «apto con restricciones» y quien no está en Personal habilitado no pasan sin SST. Un concepto médico sin aptitud no habilita. Un requisito sin «vence» se calcula con su vigencia (antes quedaba vigente para siempre; ahora la ficha lo exige). Un permiso de varios días revisa hasta su último día. Se suma el permiso adicional marcado. Copia sin señal de más de 2 días: avisa. «Hoy» siempre en hora de Colombia.

**Permisos de alto riesgo**
- Verificaciones críticas (sin tensión, puestas a tierra, bloqueo y etiquetado, plan de izaje, rescate, extintor, gases, anclajes, sistema de acceso, vigía): en «No» no dejan abrir y no se marcan con «Marcar todo».
- Controles críticos por tipo: vigía de fuego, combustibles a 11 m y 30 min de vigilancia al cerrar (caliente); vigía, plan de rescate y conteo de entrada y salida (confinados); tensión, punto de corte, tabla de candados y tarjetas, verificación de ausencia de tensión y reenergización segura (eléctrico); peso, capacidad, aparejador y operador certificados, más de 75 % = izaje crítico (izaje).
- Confinados no abre sin lectura de gases en rango y no se amplía ni reanuda sin lectura de los últimos 15 minutos.
- Máximo una jornada (24 h, ajustable). No se cierra con personal en el área ni como «finalizado» si está suspendido. Entregar turno pide cédula, habilitación y aceptación de quien recibe. El servidor exige un ejecutante, rechaza confinados sin gases y solo amplía hacia adelante (máx. 24 h).

**ATS y charla**
- El participante firma desde su celular con el enlace del supervisor (clave de ESE ATS), sin usuario.
- La copia de un ATS sube «copia de» y la revisión de hoy (el servidor rechaza la copia sin revisión) y ya no trae los firmantes finales. Lo rechazado por conflicto queda recuperable en la hoja «ATS rechazados». La hoja dice qué le falta a cada ATS.
- Charla: nombres y lugares sin tildes para comparar, dos personas sin cédula con el mismo nombre y firmas distintas no se pisan, un celular viejo no borra el tema con vacío, y queda rastro de quién se quitó.

**Accidentes e investigación**
- Cada rol del equipo investigador lo cubre una persona distinta; «representante del COPASST» ya no cuenta como responsable de SST. N.º de licencia obligatorio si el AT es grave o mortal.
- Corregir una investigación cerrada no cambia su fecha. Fechas de radicado entre el evento y hoy, con su número; la remisión a la ARL, después de terminar la investigación. SST corrige la gravedad (grave/mortal) después del reporte; un AT mortal propone 6.000 días cargados.
- Ningún AT o incidente se cierra sin FURAT (AT), investigación terminada y al menos una acción, ni con acciones vencidas. Pendientes del Ministerio y de la ARL en «Lo que falta». El PDF de una investigación sin firmas sale como BORRADOR.

**Indicadores**
- Un solo cálculo de días (Indicadores, Gerencia, Cierre del mes e Informe): la incapacidad cuenta en el mes en que se pierde; un AT sin ausencia registrada suma sus días; AT mortal sin cargados = 6.000.
- Prevalencia con el último dato anotado; casos nuevos de meses sin trabajadores sí cuentan; ausencias sin fechas no inflan el mes; mortalidad «—» sin accidentes; aviso de AT en un mes sin trabajadores (y el cierre del mes no pasa); acumulado del año en Gerencia; ILI con la frecuencia de lesiones incapacitantes. Fichas técnicas de cada indicador en PDF.

**EPP**
- Hoja de vida por serial: la inspección registra tipo (pre-uso o anual por persona competente) y si el equipo soportó una caída; un equipo con caída o en MALO queda RETIRADO y así lo ve quien escriba su serial. La entrega de equipos de alturas exige serial o lote y toma la fecha de fabricación para la vida útil. Un elemento obligatorio de la matriz que no se entrega pide justificación. Sin avisos de reposición para retirados.

**Estándares mínimos, ISO, RUC y auditor**
- Carpeta de evidencias: «Registrar evidencia o No aplica» en lo que el portal no lleva; custodia de historias clínicas (Matrices ISO); pensión especial de alto riesgo en la ficha del trabajador; plantilla de saneamiento básico; mediciones cruzadas con los riesgos altos de la matriz; origen «Requerimiento ARL/MinTrabajo»; reglas que antes daban «al día» sin datos.
- Independencia del auditor comprobada contra la matriz de auditores internos. Gestión del cambio con sistemas, temporal, aspectos ambientales, consulta, aprobación obligatoria y revisión posterior. Política integrada. Historial de evaluaciones de la matriz legal.
- Contratistas: puntaje de selección ponderado, evaluación de desempeño SSTA, constancia de peligros comunicados, requisitos ambientales y de subcontratistas.
- PDF: bloque «Elaboró / Revisó / Aprobó» en matriz de peligros, matriz legal, simulacro y exámenes; «Página X de Y»; «Versión del formato»; anchos fijos en la matriz de peligros; simulacro con participantes y fotos; exámenes con IPS y la cédula enmascarada para el cliente; asistencia con fechas listas.

**Gerente y contratista nuevo**
- Gerencia abre con un veredicto en una frase, la multa posible según el tamaño de la empresa (Dec. 472 de 2015, art. 5, con el salario mínimo 2026) y «lo que usted debe decidir este mes»; la gerencia puede firmar su revisión y aprobar recursos (estándar 1.1.3).
- Inicio: «Llegué hoy a la obra · hacer mi inducción». La inducción guarda el avance, baraja la evaluación y ya no muestra la respuesta correcta; lleva la pantalla a lo que falta. Preoperacional: firma de quien inspecciona obligatoria, taladro sin preguntas de soldadura ni pulidora, equipo propio sin código, aviso que no asusta.

## v147 — Jornada del supervisor (v146) e ISO / RUC

**Supervisor (v146)**
- Permiso nuevo: botón «Repetir mi último permiso» arriba; fecha, hora de inicio, responsable (el de la sesión) y último sitio se llenan solos (sin pisar borradores ni lo que viene del ATS).
- Permiso abierto: panel «Durante el trabajo» con **Ampliar vigencia**, **Suspender / Reanudar** (motivo obligatorio) y **Entregar turno**. Nueva acción `novedad` del servidor de permisos: solo agrega, con candado y opId; queda en la bitácora y actualiza las columnas de vigencia y responsable.
- Tablero de permisos: aviso (y notificación del equipo, si la dio) 30 minutos antes de que venza un permiso; aviso si hay dos permisos abiertos en la misma área.
- Checklist de permisos en lenguaje claro: «Cumple / No aplica», «Sí / No / No aplica», botones de 48 px. La barra inferior ya no tapa la última tarjeta.
- Charla: temas sugeridos (rotan y recuerdan los usados). Reportes: recuerda el último lugar. Entrega de EPP: el atajo del supervisor entra directo al formulario (`?nuevo=1`, opcional `&cedula=`). Inspección de EPP: serial del arnés / eslinga / línea de vida.
- Atajos del supervisor: «Charla del día».

**ISO 9001 / 14001 / 45001 y RUC (v147)**
- Revisión por la dirección: 4 entradas ISO nuevas al final (contexto y partes interesadas, riesgos y oportunidades, clientes y proveedores, no conformidades y consulta). Las revisiones guardadas conservan su lista.
- Calidad: campo «Sistema» (Calidad, SST, Ambiental, Integrado) en riesgos y objetivos; contexto con requisitos que no aplican (4.3 / 8.3) y su justificación, tipo de parte interesada y consulta y participación (45001 5.4).
- Plan de acción: una acción **correctiva** no se cierra sin la causa raíz.
- Nueva pantalla **Matrices ISO** (`matrices-iso.html`): competencias por cargo, auditores internos (competencia e independencia), calibración de equipos de medición (con vencimiento en pendientes), matriz de comunicaciones y retención de registros. Tipos nuevos del servidor: competencia, auditorint, calibracion, comunicacion, retencion.
- Matriz legal: tipo de requisito (legal u otro requisito), sistema, quién evaluó y qué se hará si no cumple.
- Aspectos ambientales: etapa del ciclo de vida.
- Indicadores: índice de severidad por HHT e **ILI** (IF × IS ÷ 1.000) junto al índice de frecuencia por HHT.

**Pendientes de las revisiones**
- Cierre de permisos: se une con lo guardado (antes lo reemplazaba). Ya no se pierden la excepción de habilitación, la fecha de creación, las novedades, la vigencia ampliada, el turno entregado ni el personal que otro equipo agregó mientras tanto.
- «Agregar personal» sin señal queda en cola; el aviso dice «no se puede agregar» (no «abrir»).
- Cerrar sesión borra también el borrador y las plantillas del ATS, y avisa si hay envíos sin subir.
- Un ATS guardado sin señal también se puede repetir al día siguiente.
- La sesión ya viaja en el cuerpo del POST (consultaPost), no en la dirección.
- Bloqueo por claves incorrectas por equipo: quien prueba claves desde su celular ya no deja por fuera al dueño de la cuenta (la cuenta entera solo se bloquea con 20 fallos).
- Ventanas de confirmación con el verbo de la acción («Borrar», «Cerrar»…) en vez de «Aceptar».
- instalar.html y la guía .docx dicen lo mismo que INSTALAR-NUEVA-EMPRESA.md (administrador, RESPALDO_EXTERNO y prueba de restauración obligatorios). La guía toma la versión del CHANGELOG.

## v145 — Seguridad y correcciones de la segunda revisión

**Actualiza el sitio (tandas 1 y 2) y el servidor.**

  · Una «firma» con código escondido ya no se guarda ni se pinta (ATS, anexo de personal, charlas).
  · Ninguna celda que escriba cualquier servidor puede volverse fórmula de Google Sheets.
  · «Solo consulta» y el comité ven, pero no guardan ni borran en permisos, ATS, charlas, EPP ni personal.
  · Lo que llega sin usuario tiene tope de tamaño (máx. 6 fotos) y no puede traer campos que solo pone SST.
  · Sin usuarios creados tampoco se leen las conexiones a clientes. Sesión comparada en tiempo
    constante; un usuario que no existe no se delata por el tiempo de respuesta.
  · Un documento que quedó a medias por un corte se arma con su última versión (nunca mezclado).
  · Permisos: la justificación de la excepción por personal no habilitado queda en el permiso; si no
    hay lista del personal (sin señal o recién se cerró sesión) se pregunta y queda anotado.
  · Botón «Dictar» con su texto de nuevo; lo que estaba oculto se revisa al mostrarse; «Marcar todo»
    solo con una opción de verdad buena; autorización de salud también en registros por parche;
    cédula con o sin puntos; restaurar un respaldo copia primero y renombra después.
  · Service worker: guarda siempre la copia nueva del servidor y la actualización no espera a bajar
    todo. Un envío cortado por tiempo sin código de operación no se repite.
  · Mensajes de error claros (sin «token», «servidor», «Apps Script» ni «config.js» para el trabajador).
  · Los documentos internos (.md, Word) y los servidores ya no se publican en el sitio.
  · Guía de instalación: crear el administrador, respaldo externo y probar la restauración son
    obligatorios; tabla de mantenimiento y de propiedades del script.

## v144 — Rápido con señal débil y menos datos móviles

**Actualiza solo el sitio (tandas 1 y 2).** El servidor es el de la v143.

  · Primera visita: solo se descarga el núcleo de obra (inicio, preoperacional, reportes, ATS,
    permisos, emergencia, buzón, ayuda). Antes eran 107 archivos (≈1,2 MB) por datos móviles. Lo
    demás se guarda al abrirlo, o solo con wifi y sin «ahorro de datos».
  · Con señal débil la página ya no queda en blanco: a los 3,5 s se muestra la copia guardada.
    Los enlaces de QR con parámetros abren sin señal.
  · Lo guardado (js, css, fuentes) ya no se vuelve a pedir en cada apertura.
  · Guardar con señal débil ya no se queda colgado (tiempo límite) y un envío con fotos que falla no
    se sube tres veces: queda en la cola.
  · Fotos ~40 % más livianas (calidad 0,6, más rápidas de procesar).
  · El celular trabaja menos al pintar listas largas (accesibilidad y autoguardado revisan solo lo
    nuevo, cuando el celular está libre). Minificado más agresivo.

## v143 — Más fácil para el trabajador, lista para auditoría y para lector de pantalla

**Actualiza el sitio y el servidor.**

  · Inicio: botón rojo «Emergencia» (MEDEVAC) a la vista sin usuario, con «Llamar al 123» arriba.
    «Reportar» dice «Peligro, accidente, queja o sugerencia (buzón)»; PQRS ahora se llama «Buzón».
  · Reporte: los faltantes salen todos de una vez; «Quién reporta *»; quien reporta sin usuario ve
    «¡Gracias!» con su código (antes caía en la ficha del área SST).
  · Preoperacional: «Marcar todo Bueno» en cada lista, «Paso 1 de 3», dice exactamente qué falta,
    el cargo se llena solo al elegir la persona y lo «(opcional)» nunca es obligatorio.
  · Buzón sin activar: no muestra el formulario, solo cómo entregar la queja.
  · Ayuda: «Emergencia: a quién llamar» y «Poner una queja o sugerencia»; abre en lo del trabajador.
  · Auditoría: accidente grave o mortal con reporte al Ministerio del Trabajo (2 días hábiles,
    Res. 0312 est. 3.2.1) y envío de la investigación a la ARL (Res. 1401 art. 14); no se cierra
    sin ellos. La investigación exige jefe inmediato, COPASST o vigía y SST, y profesional con
    licencia si es grave o mortal (Res. 1401 art. 7).
  · Permisos: quien tiene el curso vencido o no es apto NO entra (solo Administrador o SST con
    justificación escrita). Antes el aviso no se esperaba y no frenaba nada. Alturas: plan de rescate
    con rescatistas y equipo, obligatorio (Res. 4272 de 2021).
  · Indicadores: severidad por mes calendario (desde el registro de ausentismo) y la revisión por la
    dirección con el indicador del periodo, no el promedio de meses. Inducción con horas.
  · Lector de pantalla: la ventana «Entra con tu usuario» toma el foco y deja inerte lo de atrás; al
    cambiar de pantalla el foco va al título; opciones (tipo, potencial) dicen cuál está elegida;
    firma a pantalla completa con Escape y «Firmar sin dibujar»; recuadros de firma con nombre y
    estado; «Dictar: <campo>»; «No aplica» en vez de «N/A»; códigos y botones con su propósito.

## v142 — Seguridad, datos personales y que nada se pierda

**Actualiza el sitio y el servidor.** Primera de tres versiones con lo que encontraron 7 revisores.

  · Sin usuarios creados, la clave del portal es pública: ahora los datos de salud (exámenes,
    ausencias, SVE, psicosocial, condiciones de salud) y el buzón no se entregan a nadie hasta que
    exista el administrador.
  · Personal sin sesión: solo nombre, cédula, cargo y vigencia de requisitos (sin área, fecha de
    ingreso ni contacto de emergencia; las restricciones médicas ya iban ocultas).
  · Ley 1581: el preoperacional de salud pide la autorización de la persona antes de guardar; lo que
    registra SST sin autorización queda con la base legal escrita (Decreto 1072, Res. 1843 de 2025).
  · Cerrar sesión borra del celular listas, personal, borradores y autoguardado (queda solo lo que
    espera señal). Sesión de administrador y SST: 12 horas.
  · Aviso de privacidad completo: transmisión a Google fuera de Colombia, firma con hora/equipo/GPS
    (voluntario), RH y contacto de emergencia, fotos, quejas, contratistas, encargado siempre, qué
    queda en el celular y cuánto tiempo se guarda.
  · Guardar ya no puede perder un registro: se escribe lo nuevo antes de borrar lo viejo.
  · Fotos cambiadas se borran de la hoja «Imagenes»; la bitácora «Eventos» pasa lo de más de un año
    a un libro de archivo (con el respaldo semanal). Respaldos mensuales: últimos 24 meses.
  · Respaldo que se puede probar y restaurar: ▶ probarRestauracion() (cada mes) y
    ▶ restaurarDesdeRespaldo() (deja copia de lo actual). El respaldo por correo avisa lo que no pudo
    enviar. Celdas de 32.000 caracteres para que el Excel no corte los trozos.
  · Servidores de ATS, asistencia, EPP, permisos y personal: si están ocupados responden «reintenta»
    en vez de una página de error; trozos de firma protegidos. Listas más rápidas y avisos por correo
    que no se comen el cupo diario de las alarmas y el respaldo.

## v141 — Correcciones de la revisión independiente

**Actualiza el sitio (tandas 1 y 2) y el servidor.** Un revisor independiente (que no vio cómo se
programó) revisó v137–v140 y encontró 15 puntos; estos son los arreglos:

  · Buzón, convivencia y salud ya no se autoguardan en el equipo ni ofrecen plantillas (quejas
    confidenciales en una tablet compartida). Al cerrar sesión se borra todo el autoguardado.
  · Las firmas ya no se autoguardan (una firma a medias no puede aparecer en el registro de otro).
  · Al guardar se borra solo el borrador de ese formulario, no los de los demás.
  · Sello: solo vale en su registro (uno copiado de otro se rehace) y al editar se conserva el
    sello original (quién firmó y cuándo).
  · Firma sin trazo: el sello dice «sin trazo» con nombre y cédula, y avisa si la cédula NO está en
    el personal registrado.
  · RH y contacto de emergencia: solo los ven SST, administrador y supervisores con usuario.
  · Papelera y «Recuperar» exigen poder ver ese tipo de registro (salud solo SST). Borrar dos veces
    ya no cambia la fecha ni el motivo.
  · Archivo anual en lotes de 1500 y sin duplicados si una corrida se corta y se repite.
  · «Deshacer» sin señal ya no dice «Recuperado»; el GPS solo viaja con firmas (no con fotos).
  · Fotos de borradores vencidos se borran del equipo; las fotos de un borrador no se ponen en un
    registro que se está editando.

## v140 — Accesibilidad y MEDEVAC

**Actualiza el sitio (tandas 1 y 2) y el servidor** (el contacto de emergencia y los datos
MEDEVAC del plan viven en el servidor).

  · Contacto de emergencia en Personal habilitado: nombre, parentesco, celular, otro teléfono,
    EPS, ARL y RH. Va solo en el registro completo (pide usuario), nunca en la lista libre.
  · MEDEVAC (medevac.html): el trabajador con su contacto (llamar, WhatsApp, SMS), RH, EPS y ARL;
    la sede con hospital (llamar y «Cómo llegar»), ambulancia y línea de la ARL; los 7 pasos;
    «Copiar los datos para la ambulancia» y «Reportar el accidente».
  · Plan de emergencias: nueva sección MEDEVAC (hospital, dirección, teléfono, tiempo de llegada,
    ambulancia, ARL y transporte alterno).
  · Accesibilidad: tamaño de letra (A, A grande, A muy grande), «Escuchar» en cada página,
    «Firmar sin dibujar» (nombre y cédula, sellada igual), «Saltar al contenido» y zona principal,
    errores ligados a su campo para el lector de pantalla, estados con símbolo (✓ ! ✕) y no solo
    color, botones de 44 px en celular, contraste WCAG AA en los colores de la paleta, nombres en
    los campos de tablas, página «Accesibilidad» con la declaración y cómo reportar una barrera.
  · Pruebas: revisión automática con axe (contraste, etiquetas, nombres, zona principal).

## v139 — Nada se pierde y se escribe menos

**Actualiza el sitio (tandas 1 y 2) y el servidor** (la papelera, «Deshacer» y las plantillas
compartidas viven en el servidor).

  · Autoguardado con fotos y firmas: lo que se fotografió o firmó a medias también vuelve.
  · Deshacer al eliminar (10 s) y Papelera (papelera.html) con lo eliminado en 30 días y «Recuperar».
  · Lo de la última vez: área, lugar, equipo, supervisor, proceso, turno… quedan puestos en un
    formulario nuevo (con aviso) y al tocar el campo salen los más usados.
  · «Te falta esto» al tocar Guardar/Enviar/Firmar: lista de lo obligatorio vacío; cada uno lleva al campo.
  · Al salir por un enlace con algo a medias, pregunta y aclara que lo escrito queda guardado.
  · Plantillas de tareas frecuentes en cada formulario: «Guardar lo escrito como plantilla» y
    aplicarla con un toque; se comparten con todo el equipo (sin servidor, quedan en el celular).
  · Autoguardado: si la página limpia su formulario al abrir, lo recuperado se vuelve a poner.

## v138 — Autoguardado en todos los formularios

**Actualiza solo el sitio (tandas 1 y 2).** El servidor no cambia.

  · Lo que se escribe en cualquier formulario (reportes, inspecciones, acciones, documentos,
    preoperacionales, EPP, asistencia…) se guarda solo en el equipo al momento, al salir de la
    página, al bloquear el celular o al cerrar una ventana tocando fuera.
  · Al volver al mismo formulario en blanco se rellena con lo que llevaba, con el aviso
    «Recuperamos lo que estabas escribiendo» y los botones Seguir / Descartar.
  · Se borra solo al guardar el registro (o al quedar en cola sin señal); dura 7 días.
  · No pisa un registro que se está editando, ni guarda claves, buscadores, fotos ni firmas.
    ATS y permisos siguen con su borrador completo (que sí incluye firmas).

## v137 — Seguridad y valor probatorio: sello de firmas, alarmas, respaldo externo y archivo anual

**Actualiza el sitio (tandas 1 y 2) y el servidor** (casi todo esto vive en el servidor).

  · Sello de auditoría en cada firma (permisos, ATS, charlas, EPP, personal y SG-SST): hora del
    servidor, quién, el equipo, el GPS si se permite, la huella SHA-256 de la firma y un código HMAC
    que solo el servidor puede generar. El historial de cada registro muestra «✓ Firma verificada».
  · Alarmas por correo: borrado masivo (avisa a los 15 en 10 min y frena a los 40), usuario
    bloqueado por claves malas, 20 intentos fallidos en una hora y administrador nuevo.
  · Respaldo fuera de la cuenta: cada semana, un Excel de cada hoja por correo a otra cuenta
    (propiedad RESPALDO_EXTERNO, o el correo del asesor).
  · Archivo anual: «archivoAnualVistaPrevia» y «archivarAniosAnteriores» mueven lo cerrado de antes
    del año pasado a un libro de archivo, con copia verificada antes de quitar nada.
  · Dictado por voz en los campos de texto largo (ATS, reportes, buzón…).
  · ATS: «Repetir el último ATS» y, en toda copia, confirmar al guardar que se revisaron las
    condiciones de hoy (los permisos ya tenían «repetir» sin firmas).
  · Modo sol: botón «Sol» en el inicio (blanco puro, bordes negros, letra más grande).
  · Documentos: control de cambios (versión, fecha, quién y motivo); el cambio de versión pide el motivo.

## v136 — Más fácil en la obra: QR en cada equipo, avisos solos y primeros pasos

**Actualiza el sitio (tandas 1 y 2) y el servidor** (los avisos por correo viven en el servidor).

  · Etiquetas QR de los equipos (etiquetas-qr.html): del inventario o escritas a mano, listas para
    imprimir y pegar. Al escanear, el preoperacional abre con el código del equipo ya puesto.
  · Avisos que llegan solos: se programan sin ejecutar nada a mano. Además del resumen a SST, cada
    usuario con correo recibe en la mañana lo suyo SOLO si algo le vence hoy o mañana o venció ayer.
  · Gerencia (solo consulta) ve cuatro cifras arriba: accidentes del mes y del año, reportes sin
    cerrar y acciones vencidas.
  · Primeros pasos para una empresa nueva (SST y administrador): personal, usuarios, equipos,
    etiquetas QR y un reporte de prueba; se tachan solos y se pueden ocultar.
  · Primera carga más rápida: la descarga del portal para usarlo sin señal espera a que el inicio
    termine de abrir.

## v135 — Cada quien ve lo suyo: «Hoy», atajos por rol y pantallas más simples

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Gestión abre con «Hoy»: lo que vence hoy y en dos días, y lo atrasado agrupado en una línea
    («19 atrasados · ver») en vez de empezar con «vencido hace 177 días».
  · Atajos según el rol: supervisor (permisos, ATS, alturas, EPP, preoperacionales, reportes),
    SST (permisos, reportes, EPP, inspecciones, plan de acción, indicadores), comité (COPASST,
    convivencia, emergencias) y consulta/gerencia (resumen, indicadores, permisos, plan).
  · Supervisor, comité y consulta ven solo lo suyo; lo demás queda tras «Ver todo el sistema de
    gestión». A SST el calendario y el cronograma le quedan plegados tras un botón.
  · En Pendientes sale primero lo próximo y después lo atrasado.
  · Reportar sin usuario: la pantalla es solo «Reportar ahora» (sin pestañas, cifras ni lista).
  · Cada equipo del preoperacional con su propio ícono (montacargas, escalera, soldadura…).
  · En el celular los botones de arriba llevan su nombre; «Estado del sistema» pasa al pie.

## v134 — Lo que le faltaba a un sitio serio: condiciones, 404, compartir y antispam

**Actualiza el sitio (tandas 1 y 2) y el servidor** (el límite contra spam vive en el servidor).

  · Condiciones de uso (terminos.html), enlazadas desde el inicio y el aviso de privacidad. Es una
    plantilla: la empresa la revisa con su asesor legal.
  · Página 404 propia: una dirección mal escrita lleva de vuelta al inicio del portal.
  · robots.txt y «noindex» en todas las páginas: el portal no sale en Google.
  · Al compartir el enlace por WhatsApp sale título, descripción e imagen (og.png).
  · Contra spam en lo que se envía sin usuario (reportes, PQRS, preoperacional, buzón): campo
    trampa invisible, tiempo mínimo en la página y máximo 40 envíos por tipo cada 10 minutos.
  · Revisión automática de enlaces rotos en las pruebas.

## v133 — Mismo trato, pantallas vacías que guían y validación al escribir

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Un mismo trato: todo el portal le habla al usuario de «tú» («Revisa tu conexión», «Elige…»);
    los formularios formales de queja de convivencia y de acoso sexual hablan de «usted».
  · Pantallas vacías que dicen qué hacer: «Sin registros» trae el botón para crear el primero.
  · Validación mientras se llena: al salir de un campo obligatorio vacío dice «falta»; correo,
    cédula y teléfono mal escritos se avisan ahí mismo, y el aviso se quita apenas se corrige.

## v132 — Pulido final: ventanas del portal, etiquetas, errores y sitio más liviano

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Ventanas del portal en vez de las grises del navegador: los 167 avisos, confirmaciones y
    preguntas («¿Borrar este registro?», «¿Por qué se archiva?»…) salen ahora en una ventana con la
    marca del portal, legible, accesible (Escape cancela, el foco no se escapa) y con «Aceptar» en
    rojo cuando es para borrar o quitar. Ya no las puede bloquear el celular.
  · Campos con su etiqueta conectada: el lector de pantalla lee la etiqueta de cada campo y tocar la
    etiqueta enfoca el campo (comprobado en 14 pantallas: ninguno sin nombre).
  · Errores con la misma forma en todo el portal: «No se guardó. Qué pasó. Qué hacer» (sesión
    vencida, sin clave, sin señal, otra persona lo cambió…).
  · Sitio más liviano: lo que se sube a GitHub (PASO-2) va minificado: unos 750 KB menos (25 a 40 %
    menos por página). La copia de «avanzado/» queda legible. Todas las pruebas en navegador se
    corren también sobre el sitio minificado antes de entregar.

## v131 — Paleta de colores y utilidades (lo que quedó de la v130)

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Paleta: los 408 colores sueltos se reunieron en familias con tonos (neutros, rojo, verde, ámbar,
    azul, pizarra, cian…) definidas en common.css. Se cambiaron unos 1.130 colores; quedan ~140
    usos de colores decorativos poco frecuentes. El aspecto no cambia (comparado en 20 pantallas).
  · Utilidades: los estilos que se repetían escritos a mano (márgenes, texto de nota, filas, alto
    de campos…) pasaron a clases comunes (u-mt8, u-nota, u-fila…): 245 reemplazos. Los estilos
    únicos (anchos de columnas de los PDF) se quedan donde están.
  · Pruebas automáticas que impiden volver a dispersar colores.

## v130 — Diseño: accesibilidad, esqueletos de carga y tokens

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Accesibilidad: anillo de foco visible al navegar con teclado; todo botón o enlace de solo ícono
    tiene nombre para lectores de pantalla (comprobado en 14 pantallas: cero sin nombre); los
    mensajes y avisos se anuncian solos; las ventanas son diálogos (el foco entra, Escape cierra);
    quien pide «menos movimiento» en su teléfono no ve animaciones.
  · Estados de carga: el «Cargando…» de las listas ahora es un esqueleto con la forma de lo que
    viene (la pantalla no salta al llegar los datos).
  · Tokens de diseño: una sola escala de tamaños de letra (9 pasos, antes 39 valores sueltos) y de
    radios (7 pasos, antes 27) y los colores principales como variables en common.css. Se
    reemplazaron unos 1.300 tamaños, 640 radios y 300 colores escritos a mano. Lo que se imprime
    (PDF) no cambia. Una prueba automática impide volver a escribirlos a mano.

## v129 — Cada empresa escoge qué reportes y qué ayuda ve

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian (si vienes de la v127 o antes,
sí: la v128 los pedía).

  · Acto seguro: ya no pide potencial de daño ni «reconocimiento dado».
  · «Reportar» ya no ofrece el accidente de trabajo (lo registra SST). La pestaña «Accidentes» de
    Reportes también se oculta.
  · Consola → Menús (y configurador) tiene dos partes nuevas:
      – Tipos de reporte: acto seguro, acto inseguro, condición insegura, hallazgo ambiental,
        incidente, accidente de trabajo, PQRS, queja al comité y acoso sexual. Lo apagado no sale
        en el inicio ni en Reportes. El accidente viene apagado; se puede prender.
      – Ayuda: qué guías ven. Además, la Ayuda solo muestra las guías de los módulos prendidos.

## v128 — Reportes de actos y condiciones (también ambientales) y buzón reservado del comité

**Actualiza el sitio (tandas 1 y 2) y los servidores** (pega `Portal-SSTA.gs` → Nueva versión):
el buzón y las columnas nuevas de la hoja «Reportes» viven en el servidor.

  · Reportar: ahora hay Acto seguro, Acto inseguro, Condición insegura y Hallazgo ambiental. Los
    de riesgo piden: categoría del acto o condición observada (20 categorías de seguridad y
    ambientales, más «Otros»), ¿Qué sucedió? (qué, dónde y cómo), persona(s), equipo(s), máquina(s)
    o instalaciones relacionadas, acción inmediata tomada (informó al jefe, detuvo la tarea,
    señalizó, informó al Supervisor SSTA, no se tomó acción, otros), plan de acción sugerido y qué
    consecuencias se evitan. La hoja «Reportes» suma esas columnas al final.
  · Buzón reservado del Comité de Convivencia (sin usuario, desde el inicio → Reportar):
      – Formato de quejas · Comité de Convivencia Laboral: no acepta anónimas; hechos con sujeto,
        tiempo, modo y lugar; evidencia (descripción y archivos); testigos; sugerencias; intención;
        las dos autorizaciones; muestra el correo del comité.
      – Reporte o queja de acoso sexual en el trabajo (Ley 2365 de 2024): presunto agresor y cargo,
        conductas, testigos, si conoce las conductas (con los ejemplos), pruebas (archivos o correo)
        y la solicitud (protección inmediata, reserva de identidad, asesoría, acompañamiento).
      – Todo se cifra en el celular de quien lo envía con la llave pública del comité: solo el
        comité, con su clave, lo lee (pestaña «Buzón»). Al correo del comité llega solo el aviso.
      – «Registrar como queja» la pasa a las quejas del comité ya llena; el acoso sexual queda
        como remitido (el comité no es competente: Res. 3461 de 2025).
  · Guía: Receta 10 «Activar el buzón reservado del comité».

## v127 — Herramientas separadas, equipos por preoperacional y «Eliminar»

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Inspecciones planeadas: la lista «Herramienta eléctrica» (que mezclaba todo) se separó en
    Pulidora, Taladro, Motortool, Herramientas menores, Roladora y Diferencial con cadena, con los
    puntos de sus formatos. Soldadura y oxicorte quedan completos. La lista vieja ya no se ofrece;
    sus equipos e inspecciones anteriores se siguen viendo.
  · Preoperacional: en el código del equipo solo se sugieren los equipos de ese preoperacional
    (en el de soldar, solo los equipos de soldadura del inventario).
  · Eliminar lo que se agregó mal: botón «Eliminar» en la ficha de una persona, de un equipo, de
    una entrega de EPP y de un preoperacional; y «Seleccionar para eliminar» varios a la vez en
    Personal habilitado, Inventario, Entregas de EPP y Registros del preoperacional. Solo SST y
    Administrador. No se pierde: queda en la hoja con fecha, motivo y quién.
  · Guía: Receta 9 «Eliminar algo que se agregó mal».

## v126 — Sin códigos de fábrica: cada empresa crea los suyos

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Se quitaron todos los códigos SSTA-F de fábrica: permisos, ATS, asistencia, inspección de EPP,
    anexo de personal, listas de inspección y preoperacionales. Una empresa sin códigos propios no
    ve ninguno (ni «Código:» vacío) en pantallas ni PDF.
  · Cada empresa los crea: los de los formatos en el configurador («Códigos de los formatos», o
    consola → Editar todo), y los de preoperacionales e inspecciones en consola → Menús.
  · Si una empresa ya tenía sus códigos guardados en el configurador, se conservan.

## v125 — Menús legibles, cada empresa bautiza sus formatos y guía en recetas

**Actualiza el sitio (tandas 1 y 2)**. Los servidores no cambian.

  · Consola: la ventana «Menús» (y las demás ventanas) se leía con letra muy clara sobre fondo
    claro. Ahora el texto es oscuro.
  · Los preoperacionales base vienen SIN código. En «Menús» de cada empresa, debajo de cada
    preoperacional y de cada lista de inspección, hay dos cajas: «Nombre en esta empresa» y
    «Código». Salen en el inicio, en el formulario y en el PDF. Vacío = nombre del portal, sin código.
  · Lo que se guarda en «Menús» queda en tu servidor al tocar «Guardar y publicar» (no se descarga
    ningún archivo). El inicio de los celulares de esa empresa lo aplica en segundos.
  · Guía de instalación: Parte D ahora son recetas (versión nueva, prender/apagar, nombre y código,
    logo, marca de tu sitio, usuarios, clave, correos), cada una con dónde, si se guarda sola, los
    pasos clic por clic y cómo saber que quedó. Nueva tabla «Los 3 lugares donde se hace todo».

## v124 — Preoperacionales de herramientas, menús por empresa y reposición de EPP

**Actualiza el sitio (tandas 1 y 2) y los servidores** (pega `Portal-SSTA.gs` → Nueva versión;
así la lista de entregas muestra el motivo de cada reposición).

  · 8 preoperacionales nuevos en «Herramientas y equipos»: herramientas menores (SSTA-F-010),
    equipo de soldar (011), oxicorte (012), pulidora (015, con tipo de disco, RPM y vencimiento
    del consumible), taladro (047), motortool (048), roladora (167) y diferencial con cadena (189).
  · Consola del administrador: el botón de cada empresa ahora es «Menús». Ahí se prende o apaga,
    por categoría, cada módulo del menú, cada preoperacional y cada lista de inspección. Lo mismo
    en el configurador. Lo apagado no se ofrece ni abre por enlace; los registros viejos se ven.
  · Entrega de EPP: pestaña «Reposición» con «Registrar reposición»: se escoge la persona, se ve lo
    que tiene hoy, se marca qué se cambia, el motivo de cada elemento (desgaste, daño, pérdida,
    robo, talla) y si devolvió el anterior; luego firma de quien recibe. Queda en «Reposiciones
    hechas», en el registro y en el PDF de la persona.
  · Entrega de EPP: pestaña «Por trabajador» con el historial de cada persona: lo que tiene hoy con
    su fecha de reposición (al día, por vencer, vencido), todas sus entregas y reposiciones, y
    desde ahí «+ Entrega», «Reposición» y el historial en PDF.

## v123 — Inicio con tarjetas que se despliegan, formatos nuevos, «atrás» que vuelve a donde estabas

**Actualiza el sitio (tandas 1 y 2) y los servidores** (pega otra vez `Portal-SSTA.gs` →
Gestionar implementaciones → Nueva versión), por lo de la clave.

  · Inicio: quedan solo las dos tarjetas grandes (Preoperacional y Reportar); al tocarlas
    se despliega lo que tienen. «¿Qué peligros ves?» sale del inicio (sigue en Matriz de peligros).
  · Color de la marca: ahora pinta el saludo, el encabezado de cada página, los títulos y botones.
  · Clave del sitio: con usuarios activos, el servidor ya no pide la clave en cada celular.
  · Preoperacionales base para cualquier empresa: montacargas, plataforma tijera, camioneta,
    escalera, equipo de alturas y camilla. Sin usuario abren sin pedir entrar.
  · Inspecciones: reemplazadas por los 19 formatos SSTA-F (botiquín, extintor, kit de derrames,
    arnés, escalera, andamio, locativa, áreas, eléctricas, tablero, gerencial, puestos, ergonomía…),
    con sus secciones en pantalla y en el PDF.
  · Permisos y ATS apagados: no salen en la barra de abajo, en Gestión ni el tablero.
  · «Atrás» del celular vuelve a la pantalla o ventana anterior, no al inicio del portal.
  · Todo campo que pide un nombre (responsable, inspector, quien recibe…) ofrece el personal habilitado.

## v122 — Íconos en lugar de emojis en todo el portal, y revisión completa de las llamadas

**Actualiza el sitio** (tandas 1 y 2; los servidores no cambian).

  · Todos los emojis de colores (impresora, candado, lápiz, cámara, alerta…) se ven ahora
    como íconos de línea, en las 52 pantallas y en lo que se pinta después (listas,
    ventanas, PDF). Las alertas del navegador salen sin emojis. Se dejan los signos
    simples (✓ ✕ ★ ☐), que son letras.
  · Revisión de todas las llamadas al servidor: también la demo pasa ahora por
    «?modulo=», y una prueba verifica que ninguna pantalla llama «…/exec/<módulo>».
    El enlace de prueba de Estado usa la misma forma.
  · La consola muestra su versión real (decía v114 fijo).

## v121 — Arreglo: «Guardar en tu consola y publicar» decía «Failed to fetch»

**Actualiza el sitio** (tandas 1 y 2).

  · El configurador y la lectura de la configuración de cada cliente también llaman a tu
    servidor con «?modulo=sgsst» (lo mismo que se arregló en la v120 para el resto).

## v120 — Arreglo: Google pedía iniciar sesión en los módulos

**Actualiza el sitio** (tandas 1 y 2; los servidores no cambian).

  · Con algunas cuentas de Google, «…/exec» abría bien pero «…/exec/sgsst» (y cada módulo)
    pedía iniciar sesión: la consola decía «Tu servidor no respondió · Failed to fetch» y
    el portal salía todo caído. Ahora el sitio llama a cada módulo con «…/exec?modulo=…»,
    que el servidor ya entendía.

## v119 — Instalar más fácil: un solo archivo, «Instalar paso a paso» y guía en Word

**Actualiza el sitio** (los servidores pueden seguir como están; los nuevos se instalan con
el archivo único).

  · **El servidor en UN archivo** (`Portal-SSTA.gs`): se pega una vez en Apps Script y
    solo se cambian 3 líneas de arriba (nombre, correos, WhatsApp). Antes eran 8 archivos.
    `instalar()` guarda esos datos: para actualizar basta pegar el archivo nuevo encima.
    El actualizador con un comando sigue funcionando (saca los datos del archivo único).
  · **Instalar paso a paso** (`instalar.html`): elige A (tu sitio, una vez) o B (una
    empresa cliente), con la franja de color de qué estás instalando, un paso a la vez,
    «Listo, ya lo hice», el progreso guardado, el servidor para copiar con un toque y la
    **prueba del servidor** que dice qué está mal (/dev, acceso, autorización, no existe).
    En la consola, «Instalar empresa nueva» abre esta guía.
  · **El paquete viene por pasos**: GUIA-DE-INSTALACION.docx, PASO-1-SERVIDOR y
    PASO-2-SITIO en tandas de menos de 100 archivos (el límite de GitHub al subir), con
    empresa.js y manifest.json aparte (no se suben al actualizar). La fuente y la demo,
    en avanzado/.

## v118 — Instalar sin confundirse: asistente y módulos por categoría

**Actualiza el sitio** (los servidores no cambian).

  · El configurador pregunta primero **qué vas a instalar**: «Mi sitio — soy el
    administrador» (una vez) o «Una empresa cliente» (cada cliente). El sitio propio
    de una empresa queda como opción avanzada.
  · Una franja fija arriba dice todo el tiempo qué estás instalando: morada = tu sitio,
    azul = empresa cliente (con su nombre y código), verde = sitio propio. «Cambiar»
    vuelve a la pregunta.
  · Cada tipo ve solo sus pasos, numerados en orden (tu sitio: marca, datos, servidor y
    descargar, con los siguientes pasos: consola, usuario, vigilancia, primer cliente).
  · Módulos agrupados como en el inicio (En obra, Personas, Planear, Hacer y emergencias,
    Comités, Verificar, Mejorar, Administración), plegables, con «Todos / Ninguno» y
    cuántos van en cada una; paquetes «Solo obra», «SG-SST completo» y «Todo» (reportes
    y usuarios siempre quedan).
  · Arreglado: en una empresa cliente se veían la lista de tipos y el panel del asesor
    aunque estaban ocultos.

## v117 — Inicio más dinámico y diagnóstico cuando todo sale caído

**Actualiza el sitio** (los servidores no cambian).

Inicio
  · «Gestión» es ahora un botón del encabezado, al lado de Ayuda y del mismo tamaño.
    Cambia la pantalla al sistema de gestión (y sin sesión abre de una vez la ventana
    para entrar); «Inicio» o «atrás» del celular vuelven a lo público.
  · Saludo según la hora (buenos días / tardes / noches) con la fecha de hoy, entrada
    suave de las tarjetas y respuesta al toque (se apaga con «reducir movimiento»).

Estado del sistema
  · Si todos los servidores fallan igual, un solo cuadro dice que es la instalación del
    servidor y qué hacer según lo que se ve al abrirlo: acceso «Cualquier usuario»,
    autorizar con verConfiguracion, dirección /dev o de una implementación borrada.
  · El informe por WhatsApp sale corto en ese caso (una línea, con la dirección del servidor).

## v116 — Clientes desde la consola, módulos en el servidor, vigilancia y datos personales

**Actualiza el sitio Y los servidores** (`node herramientas/actualizar-servidores.js clientes.json`;
la consola descarga ese archivo). En tu servidor ejecuta una vez `sgsst__instalarVigilancia`.
Vuelve a generar tu `empresa.js` con el configurador: el motor ahora va aparte.

1. La configuración de cada cliente vive en TU servidor
  · Ya no hay que subir `empresas/<código>.json` a GitHub: los celulares leen su
    configuración de tu servidor por el código (si no está, siguen con el archivo).
  · `empresa.js` lleva solo los datos; el motor va en `empresa-motor.js` y se actualiza
    con el portal (un `empresa.js` viejo sigue funcionando con su motor).
2. Instalar en un solo flujo
  · Desde la consola, el configurador termina con «Guardar en tu consola y publicar»:
    registra el cliente (datos, 0312, servidor, clave, llave, scriptId) y publica su
    configuración. Al final, su enlace y su QR. Editar un cliente usa el mismo botón.
3. Módulos contratados también en el servidor
  · Tu servidor le manda al del cliente los módulos apagados, firmados (HMAC-SHA256)
    con la llave que ese servidor generó al instalarse (`verConfiguracion`). Con un
    módulo apagado, su servidor no acepta registros nuevos de ese módulo (lo guardado
    se sigue leyendo). Mensajes viejos, repetidos o con otra llave se rechazan.
4. Vigilancia diaria
  · `instalarVigilancia`: cada mañana tu servidor prueba el de cada cliente, anota estado
    y versión, le reenvía los módulos si no los tiene y te escribe si algo falla o está
    desactualizado (los lunes, el resumen aunque nada sea nuevo).
  · La consola muestra la última revisión y descarga `clientes.json` para actualizar todos.
5. Datos personales (Ley 1581 de 2012)
  · Aviso de privacidad (`privacidad.html`) con responsable, encargado, datos, finalidad,
    derechos y contacto; sale la primera vez en cada celular.
  · `LEGAL-DATOS-PERSONALES.md`: quién es quién, cláusula modelo de transmisión de datos,
    lo que falta firmar y la lista del piloto. Revísalo con un abogado.
6. Piloto
  · Prueba en navegador con 3G lenta y procesador 4 veces más lento (inicio y preoperacional).
7. Consola
  · El configurador y el panel del asesor abiertos desde la consola tienen su mismo aspecto.
  · La cola sin señal separa lo de la consola y lo de un cliente (no se mezclan sesiones).

## v115 — Dos interfaces: la consola del administrador y el portal de los clientes

**Actualiza el sitio** (los servidores no cambian). Tu consola: `https://tu-sitio/admin.html`.

Consola del administrador general (`admin.html`, nueva)
  · Página aparte, oscura, sin enlace desde ningún menú de los clientes (y `noindex`).
  · Entra solo un usuario **Administrador de tu servidor** (el del sitio). Si aún no tienes
    usuarios, la misma página crea el primero con `sgsst__codigoAdministrador`.
  · Clientes con su segmento 0312, código, tareas abiertas/vencidas, módulos publicados
    («n de N módulos») y el estado de su servidor probado en vivo («Revisar» / «Revisar
    todos»: responde, versión, por actualizar, no acepta la clave…).
  · Instalar empresa nueva → configurador en blanco. Módulos → el configurador abre lo que
    ese cliente tiene publicado en `empresas/<código>.json`; cambias y descargas.
  · Panel del asesor y tareas: ahora vive dentro de la consola (vuelve a ella).
  · Tu marca y empresa principal → configurador «Tu sitio multiempresa».
  · La sesión, la clave y la caché de la consola se guardan aparte (`ssta-admin-…`): un
    mismo equipo puede tener abierta la consola y el portal de un cliente sin mezclarse.

Portal de los clientes
  · Sin «Panel del asesor» en el sistema de gestión, ni en la ayuda, ni como módulo.
  · Estado del sistema sencillo: funciona / no funciona / no activo, con el botón para
    avisarte por WhatsApp. Enlaces de prueba, clave y versiones, solo en tu equipo.
  · El botón «Clave» solo sale en tu equipo (o si ese celular ya tiene una guardada).

## v114 — El inicio ya no pregunta nada a quien solo reporta

**Actualiza el sitio** (los servidores no cambian). En un sitio multiempresa, para que
nadie vea la ventana: `configurar-empresa.html` → «Tu sitio multiempresa» → **Empresa
principal**, y sube el `empresa.js` nuevo.

  · Empresa principal del sitio (`empresaPorDefecto`): cualquier celular entra solo a
    ella, sin escribir código. Las demás siguen con su enlace `?e=` o su QR.
  · El enlace `?e=` y la empresa principal entran sin mostrar ventana; solo aparece si
    la empresa no existe o no hay señal la primera vez.
  · Un sitio cuyo `empresa.js` ya tiene servidor funciona como esa empresa, sin preguntar.
  · La ventana dice «¿De qué empresa eres?» y aclara que **no es una contraseña** y que
    se pregunta una sola vez en ese celular.
  · El botón «Clave» (clave técnica del equipo) ya no sale en la pantalla pública: solo
    dentro del sistema de gestión o si el equipo ya tiene una guardada.

## v113 — La instalación según la Res. 0312: cuántos estándares y por categoría

**Actualiza el sitio.** Los servidores no cambiaron (córrelos igual si quieres que el
Panel del asesor los vea al día: `node herramientas/actualizar-servidores.js clientes.json`).

Instalación (`configurar-empresa.html`, paso 2 nuevo: «Estándares mínimos»)
  · Número de trabajadores, clase de riesgo más alta y si es unidad de producción
    agropecuaria → cuántos estándares debe cumplir: 3 (art. 7), 7 (art. 3), 21 (art. 9)
    o 60 (art. 16), con el artículo y a quién aplica.
  · La lista sale clasificada por ciclo PHVA y por categoría (Recursos, Gestión integral
    del SG-SST, Gestión de la salud, Gestión de peligros y riesgos, Gestión de amenazas,
    Verificación y Mejoramiento), con el nombre oficial y el numeral de cada estándar, y
    en los 60 el peso de cada categoría (art. 27).
  · En «Módulos», la marca «0312 · n» dice cuántos de sus estándares apoya cada módulo
    (informativo: no apaga nada; cumplir los estándares no exime de las demás normas).
  · Queda en el archivo de la empresa (perfil0312) y se carga al volver a abrir.

El portal
  · Mientras SST no guarde el perfil en el SG-SST, la autoevaluación, la carpeta de
    evidencias, el plan anual, el kit documental, el informe y el tablero de la gerencia
    usan el de la instalación (antes tomaban 60 por defecto).
  · Nuevo grupo de 3 estándares (unidades agropecuarias, art. 7) con su autoevaluación.
  · El perfil de la empresa y el Panel del asesor tienen «unidad agropecuaria».
  · El sistema de gestión del inicio dice cuántos estándares le aplican.

Pruebas: 1374 de código y 116 en navegador (nuevas: grupos 3/7/21/60, pesos del art. 27,
clasificación por categoría y el paso de la instalación).

## v112 — El servidor también pide usuario, barra inferior y tablero con tickets

**Actualiza el sitio Y los servidores** (`node herramientas/actualizar-servidores.js clientes.json`).
Sin el servidor nuevo, la contraseña de la obra solo la pide la pantalla (como en v111).

Seguridad
  · Con usuarios activos, el servidor rechaza sin sesión las consultas y registros de
    los 5 permisos, el ATS, las charlas, la inspección de EPP y el personal autorizado
    (antes bastaba la clave del portal, que está en el sitio). Lo hace el enrutador del
    servidor único (00-Portal.gs) con la sesión que firma el SG-SST.
  · El sitio manda la sesión de quien entró en todas esas consultas y envíos, también lo
    que estaba en la cola sin señal; si la sesión venció, el registro se conserva y pide
    entrar (no se pierde).
  · Sin usuarios activos, o sin el SG-SST instalado, todo sigue como antes.
  · 🩺 Estado: «Funciona · pide usuario» para esos servidores cuando no has entrado.

Diseño
  · Barra inferior flotante (Inicio · Permisos · Gestión · Ayuda) para quien entró con su
    usuario. Se esconde sola en pantallas con su propia barra de guardar y al imprimir.
  · Tablero de permisos y ATS: cifras arriba (abiertos, vencidos, cerrados) y cada uno
    como ticket con su señal ISO, el código en letra técnica, el estado y una barra con
    la vigencia usada.
  · Señales ISO 7010 (círculo azul, cuadrado verde, triángulo amarillo) en lugar de
    emojis en los 5 permisos, el ATS, la inspección de EPP y 🩺 Estado.
  · Letra técnica (IBM Plex Mono, OFL) para los códigos.

Pruebas: 1364 de código y 109 en navegador (nuevas: el servidor rechaza la obra sin
sesión y la entrega con sesión, sesión falsa, barra inferior, tickets y señales).

## v111 — Diseño moderno y contraseña solo para el sistema de gestión

**Actualiza el sitio y luego los servidores** (`node herramientas/actualizar-servidores.js clientes.json`).
El código de los servidores no cambió (solo su número de versión): con los de v110 todo
funciona, pero el Panel del asesor los marcaría «desactualizado» hasta que corras el comando.

Acceso (pedido: «solo pedir la contraseña a quien entra al sistema de gestión»)
  · Sin usuario ni contraseña solo quedan el **preoperacional** y los **reportes**
    (evento, PQRS y «¿Qué peligros ves?»). La inducción por enlace o QR y la encuesta
    a clientes siguen abriéndose con su enlace.
  · Todo lo demás pasó al sistema de gestión y pide entrar: también los permisos de
    trabajo, el ATS, las charlas, la inspección de EPP, el personal autorizado y el
    tablero de permisos (hasta v110 eran públicos).
  · El Supervisor siempre tiene lo de la obra; Comité y Solo consulta ven el tablero
    de permisos pero no abren permisos. Administrador y SST, todo.
  · Un enlace directo a un permiso (o el QR) en un celular nuevo también pide entrar:
    la página pregunta al servidor si hay usuarios.
  · Funciona cuando la empresa tiene los usuarios activos. Sin usuarios, el sistema
    de gestión se abre con «Abrir el sistema de gestión», como antes.

Diseño
  · Inicio nuevo: tarjeta de bienvenida con la empresa, accesos grandes a
    Preoperacional y Reportar, y el sistema de gestión abajo (En obra + ciclo del mes).
  · Todas las pantallas: fondo con degradado suave, encabezados con degradado de marca,
    tarjetas de vidrio, botones en píldora, colores alegres y la letra Manrope
    (licencia OFL en fonts/). Los PDF e impresiones no cambian.
  · Ventana de entrar y aviso «Entra con tu usuario» con el diseño nuevo.

Pruebas: 1349 de código y 102 en navegador (nuevas: quién entra a qué, sin usuario y
con cada rol).

## v110 — Nada de lo diligenciado se pierde, pruebas en navegador y orden del proyecto

**Hay que actualizar sitio Y servidores** (`node herramientas/actualizar-servidores.js clientes.json`).
El sitio nuevo funciona con servidores viejos (sigue como antes), pero la clave
fuera de la dirección y el control de correos solo se activan con el servidor nuevo.

Corregido (se perdían datos o confundían)
  · Permiso de ALTURAS: no se guardaban fecha y hora de inicio y culminación, área,
    descripción de la actividad, nombre/cédula/FIRMA del inspector del sistema de
    acceso, altura aproximada, «¿por qué?» de la planeación, «Otro, ¿cuál?», EPP
    adicional (7.1) ni otros riesgos (9.9). La pantalla los exigía y salían en el PDF
    del momento, pero no quedaban en el registro: al cerrarlo desde otro celular no
    se veían, y sin fecha de culminación no salía la alerta de «vencido sin cerrar».
    Ahora van con los mismos nombres que los otros 4 permisos. Los permisos de
    alturas ya guardados no se pueden recuperar (esos datos nunca llegaron).
  · Sin señal, el permiso quedaba en cola pero la pantalla decía «No se pudo conectar…
    intente de nuevo»: ahora dice que quedó guardado en el equipo y se enviará solo.
  · Guardar varias veces sin señal dejaba copias del mismo permiso en la cola: ahora
    queda una sola (la más reciente).
  · Inducción desde el inicio: un error de JavaScript al marcar casillas del último paso.

Nuevo
  · Autorización de datos personales y de salud (Ley 1581) en las dos inducciones:
    la general es obligatoria y la de salud voluntaria. Se guarda con la inducción,
    sale en la constancia PDF y pasa a Personal habilitado; Salud avisa al registrar
    un examen de alguien sin esa autorización. Texto en autorizacion-datos.js.
  · La clave del portal y la sesión ya no viajan en la dirección de las consultas
    (van por POST). Solo con el servidor actualizado; con uno viejo sigue el GET.
  · Correos: el servidor revisa el cupo diario de Google antes de enviar, guarda los
    últimos para lo urgente (accidente) y no corta el aviso diario a mitad. 🩺 Estado
    muestra cuántos quedan y lo que no se envió.
  · pruebas/navegador.js: 97 pruebas en Chromium con tamaño de celular sobre la demo
    (sitio + servidor juntos): las 50 pantallas, los 5 permisos de punta a punta,
    que TODO lo escrito llegue y se vea en otro equipo, sin señal, firmas a pantalla
    completa y su tamaño, inducción con autorización, clave fuera de la dirección.
  · .github/workflows/pruebas.yml: GitHub corre las dos pruebas en cada subida y NO
    publica si algo sale en rojo (Settings → Pages → «GitHub Actions»).

Orden
  · Pruebas del código: de 84 fallas (y 13 grupos que ni corrían) a todas correctas
    (1339). La causa de 74 era una sola: config.js decía 'sin-servidor' en lugar del
    marcador 'PON-AQUI-EL-TOKEN'. Otras 10 leían empresa.js como texto compacto; ahora
    revisan los valores, así que vale también el formato JSON del configurador.
  · Una sola fuente: el paquete ya no trae tres copias de los .gs ni de la guía.
  · herramientas/empaquetar.js (pruebas + navegador si hay Playwright + servidor + demo
    + LEEME) y herramientas/subir-version.js (la versión en los 6 lugares a la vez).
  · 134 estilos escritos en línea en el HTML pasan a 18 clases de common.css,
    verificado con capturas píxel a píxel de todas las pantallas.
  · Medido el peso en celular: abrir un permiso descarga ~121 KB comprimidos y la
    instalación sin señal ~1,1 MB; el JavaScript tarda 40–130 ms con CPU lenta. No
    se parten los archivos: el beneficio sería mínimo y el riesgo alto.
  · El historial de versiones pasa del LEEME a este archivo.

## v109 — Inicio por categorías, agenda, proveedores por etapas y más ayudas

El servidor cambió (ingreso de proveedores por etapas; PQRS e inducción sin usuario): hay que actualizar los servidores de todas las empresas.

  · Inicio: «En la obra» por categorías; el sistema de gestión pide entrar y al entrar muestra
    «Tu agenda»: calendario de pendientes y cronograma del mes.
  · Inducción para responder desde el inicio (sin usuario): datos, temas, evaluación y firma.
    El resto de la inducción sigue en el sistema de gestión.
  · PQRS desde el inicio y dentro de Reportes (también en Calidad).
  · Proveedores por etapas: necesidad → 2 o 3 cotizaciones (se puede dejar «En cotización») →
    cuadro comparativo y elección → datos → documentos → evaluación inicial → alta en la matriz.
    El NIT se escribe solo con números: el guion y el dígito de verificación se ponen solos.
  · Matriz de EPP: sugiere los elementos según el cargo y sus peligros, y completa norma y
    vida útil mientras se escribe.
  · Investigación: los 5 porqués se agregan uno a uno con sugerencias según el caso, ayuda y
    alertas.
  · Programas de alto riesgo sincronizados con el personal autorizado y el inventario de equipos.
  · Cifras clicables: tocar «3 vencidos» lleva a la lista de eso que falta.
  · Celular: los pendientes del permiso ya no tapan las casillas al subir y bajar.

## v108 — Producto neutro, sin datos de ninguna empresa

  · Sin datos de ninguna empresa en el código: el sitio de fábrica trae datos de ejemplo
    («Tu empresa»), sin logo, correos, teléfonos, servidores, tokens ni enlaces de nadie.
  · Íconos de la app y logo de reserva propios del producto (escudo con chulo).
  · El inicio ya no tiene enlaces a formularios o carpetas externas.
  · Una prueba automática falla si vuelve a aparecer un correo, celular, token, enlace o
    nombre de una empresa real en el código.
  · OJO: no subas esta versión al repositorio de un sitio que ya esté en uso con su propia
    configuración en el código: ese sitio debe pasar primero a su empresas/<código>.json.

## v107 — Más fácil de llenar, con validaciones, y módulos nuevos (proveedores, encuestas, informe)
En todo el portal
  · Validación: cédula solo números, NIT con dígito de verificación, correo y teléfono válidos,
    cantidades no negativas, fechas coherentes (no futuras donde no aplica; fin ≥ inicio).
    Al guardar dice exactamente QUÉ falta y resalta el campo.
  · Toda lista con «Otro» abre un cuadro para escribir, y se guarda lo escrito.
  · Botones de acción (agregar, PDF, exportar) arriba de cada lista; botón flotante para subir.
  · PDF centrados y sin cortes en los márgenes. Ajustes de celular en todos los módulos.
  · Al elegir nombres, la lista aparece al tocar el campo y filtra al escribir.

Planear
  · Plan anual: cada actividad muestra su fase (Planear, Hacer, Verificar, Actuar); «Marcar
    como realizada»; en capacitaciones, personas esperadas, asistentes y cobertura.
  · Autoevaluación: con el número de trabajadores y el riesgo, solo deja los 7, 21 o 60
    estándares que le corresponden (los demás bloqueados), no permite «No aplica» donde sí
    aplica y dice cuáles faltan por contestar.
  · Personal habilitado: «Escribir en una tabla» (cuadros, pegar desde Excel, revisa cada celda).
  · Inspecciones: etiquetas QR de todos los equipos, por tipo o elegidos uno a uno, 3 tamaños.
  · Contratistas: Aplica / No aplica centrados en el celular, NIT y vencimientos validados.
  · NUEVO Proveedores y contratistas: matriz de requisitos por categoría (con excluyentes ★),
    evaluación inicial (bienes / servicios), reevaluación, homologación, cronograma, PDF y CSV.

Ejecutar
  · Exámenes médicos según la Res. 1843 de 2025: sugiere exámenes por cargo y exposición,
    periodicidad e ingreso a PVE; en cada PVE aparece quién está.
  · Entrega de EPP: matriz por cargo con elemento, norma y vida útil.
  · Inducción y reinducción con validación y la inducción anterior de la persona.
  · Programas de alto riesgo: botones arreglados y más programas.
  · Sustancias químicas: generador de etiquetas SGA para imprimir y lugares de almacenamiento.
  · Emergencias: amenazas con «Otra», dotación de la brigada como inventario, hoja de vida
    de cada brigadista (PDF) y participantes de los simulacros.
  · PESV según la Res. 40595 de 2022: nivel por misionalidad, pasos que aplican y 13 indicadores.
  · Ambiental: aspectos e impactos seleccionables; categoría de generador de RESPEL con la
    media de 6 meses y el reporte en el RUA; conclusiones automáticas de los consumos.
  · Calidad: encuestas de satisfacción por enlace (WhatsApp, correo o QR); el cliente responde
    sin usuario y el resultado entra al indicador.

Comités
  · NUEVO Comité de emergencias (conformación, actas trimestrales, compromisos, PDF).
  · El informe del Comité de Convivencia sale con firmas de todos.

Medir y mejorar
  · Investigación de accidentes: causas con «Otra», 5 porqués, causa raíz, medidas por causa
    y avance de la investigación.
  · Revisión por la dirección con los 24 puntos del Dec. 1072 (art. 2.2.4.6.31) y rendición
    de cuentas de responsable del SG-SST, comités, brigada y gerencia, con firmas.
  · Matriz de peligros con sugerencias de controles y encuesta para que los trabajadores
    identifiquen sus peligros (QR por área).
  · Matriz legal: «Novedades normativas» consulta fuentes en línea y propone normas nuevas.
  · Listado maestro: código automático de documentos. Gestión del cambio a PDF.
  · NUEVO Informe del SG-SST: gráficas y sugerencias de mejora por periodo, con PDF firmado.
  · Asesor: «Asignar tarea» a cada empresa; le llega al SST en sus pendientes y en el correo
    del lunes; el asesor ve abiertas, vencidas y cerradas.
