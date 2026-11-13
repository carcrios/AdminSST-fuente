# Traspaso del Portal SSTA

Este documento es para **otra persona**: alguien que tenga que hacerse cargo
del portal sin haberlo construido. No repite el README (que explica cómo
desplegar); explica cómo está armado, por qué, y dónde están los peligros.

Si lo estás leyendo porque quien lo mantenía ya no está: **el portal sigue
funcionando solo**. No hay nada que hacer con urgencia. Tómate el tiempo de
leer esto completo antes de tocar nada.

---

## 1. Qué es esto y qué peso tiene

Permisos de trabajo de alto riesgo (alturas, caliente, espacios confinados,
izajes, eléctrico), inspecciones de EPP y registro de personal autorizado,
diligenciados desde el celular en planta.

**No son notas internas.** Son documentos que en Colombia sustentan decisiones
de seguridad y que un inspector del Ministerio de Trabajo puede pedir. Un
permiso sin firmas, o un espacio confinado sin su lectura de gases, es un
problema legal para la empresa y para quien firmó.

Eso condiciona todas las decisiones técnicas que verás. Cuando dudes entre
"rápido" y "que no se pierda un dato", siempre es lo segundo.

---

## 2. Las dos mitades

```
   El celular / la tablet
            │
            ├─── Sitio web (GitHub Pages)  ← este repositorio
            │      formularios, portal, dashboard
            │
            └─── Backends (Google Apps Script)  ← 1 proyecto por empresa
                   guardan en Google Sheets y mandan correos
```

Se despliegan **por separado** y por caminos distintos. Es el error más común:
subir el sitio y olvidar el backend, o al revés.

Los `.gs` de `backends/` en este repositorio son la **copia de referencia**.
Si cambias algo en Apps Script, tráelo también aquí o se pierde el historial.

### Los módulos del servidor (antes 10 proyectos; hoy 1 por empresa)

| Proyecto | Archivos que tiene |
|---|---|
| Caliente, Alturas, Confinados, Izajes, Eléctrico | `core.gs` (idéntico en los 5) + `config-<tipo>.gs` |
| Inspección de EPP | `backend-epp.gs` |
| Personal autorizado | `backend-personal-autorizado.gs` |
| ATS | `backend-ats.gs` |
| Asistencia a charlas | `backend-asistencia.gs` |
| Gestión del SG-SST (personal habilitado, reportes, plan de acción, inspecciones, indicadores, COPASST, Comité de Convivencia, auditorías, plan anual, matriz de peligros, emergencias, salud, documental y revisión por la dirección) | `backend-sgsst.gs` — los tipos de planeación y salud se definen en la tabla `TIPOS_GEN` (qué se lista y qué hoja escriben) — guarda documentos JSON (hojas `Registros`, `Datos`, `Imagenes`, `Eventos`) y escribe además una hoja legible por módulo. Tiene un aviso diario por correo (`instalarAvisosDiarios`). |

Para otra empresa todo lo anterior va en **un solo** proyecto (`servidor-unico/`,
ver `INSTALAR-NUEVA-EMPRESA.md`).

Cada uno tiene su propia hoja de cálculo con las pestañas `Permisos`,
`Firmas`, `Eventos` y (tras auditar) `Auditoria`.

---

## 3. Lo que tienes que entender sí o sí

### Las firmas van aparte del permiso

Una firma es una imagen que pesa decenas de miles de caracteres. Google Sheets
**no admite más de 50.000 caracteres en una celda**. Por eso:

- El navegador exporta la firma a resolución acotada antes de enviarla.
- El backend la parte en trozos si aún no cabe, y los vuelve a unir al leer.
- En el JSON del permiso solo queda una referencia corta (`SIGREF:abc123`).

**Nunca quites ninguna de esas tres piezas.** Sin ellas las firmas se pierden
en silencio: el permiso se guarda, la pantalla dice "Firmado ✓" y la imagen no
queda. Ya pasó, durante semanas, y se descubrió por casualidad.

### El portal verifica cada guardado

Después de guardar, el portal **vuelve a leer el permiso del servidor y
compara**: firmas, ejecutantes, lecturas. Si no coincide, avisa fuerte y no
borra el borrador.

Esto existe porque el sistema perdió datos en silencio tres veces. Es la única
defensa contra que vuelva a pasar sin que nadie se entere. **No la quites
porque "hace una consulta de más".**

### La bitácora es intocable

Cada backend escribe en la pestaña `Eventos` una fila por **cada intento** de
escritura: aplicado, rechazado o duplicado. Incluso los rechazados.

Eso es a propósito: un intento de modificar un permiso ya cerrado es justo lo
que querrías poder demostrar en una investigación. Protege esa pestaña en
Google Sheets y no la borres para "ahorrar espacio".

**Si algo raro pasa, la respuesta casi siempre está ahí.** Así se encontraron
dos de los tres fallos graves.

### Las quejas de convivencia están cifradas (y nadie más tiene la clave)

El contenido de cada queja del Comité de Convivencia se cifra en el celular
(`cifrado.js`, AES-GCM con una llave sacada de la clave del comité). El
servidor solo guarda código, fechas y etapa, y rechaza cualquier queja que
llegue sin cifrar o sin la "prueba" de la clave. **No hay forma de recuperar
una clave perdida**, ni siquiera con acceso a la hoja. No "arregles" esto
guardando la clave en algún lado: es justamente lo que protege a quien se queja.

### Las listas traen solo lo que cambió (desde v168)

Cada celular guarda una copia de cada lista (en IndexedDB) y le pide al servidor solo lo creado, modificado o
borrado desde su última lectura. Lo que lo mantiene correcto, y que **no se debe quitar**:

- **Toda escritura en `Registros` deja huella de cuándo cambió** (`updatedAt`, o la fecha dentro de `borrado`).
  Si agregas una forma nueva de modificar una fila, tiene que actualizar `updatedAt`; si no, los celulares no se enteran.
- **Si sacas filas de la hoja** (como hace el archivo anual), llama `subirListaGen_()`: obliga a todos a pedir la lista completa.
- El celular vuelve a pedir la lista completa una vez al día, cuando cambia de usuario o rol, y cuando la cuenta
  del servidor (`total`) no cuadra con su copia. Son las redes de seguridad; no las relajes.
- Los tipos con datos de salud (`RESERVADOS`) nunca dejan copia: siempre piden todo.

Cómo medir si algo de esto empeora: [PRUEBA-DE-CARGA.md](PRUEBA-DE-CARGA.md).

### Usuarios con nombre (opcional, desde v94)

Si la hoja del SG-SST tiene la pestaña `Usuarios`, el servidor SG-SST exige
iniciar sesión para leer y cambiar (salvo **crear** un reporte o una acción, y
la lista de personal habilitado que consultan los permisos en campo). Detalles
que no se deben "arreglar":

- La clave de cada persona **nunca llega al servidor**: el celular deriva una
  "prueba" (PBKDF2, 150.000 vueltas) y en la hoja queda solo su huella (SHA-256).
  No hay forma de ver la clave de nadie; si alguien la olvida, el administrador
  le da una temporal.
- La sesión es un texto firmado con un secreto que vive en las *Propiedades del
  script* (`SECRETO_SESION`). Si se borra esa propiedad, todos tienen que volver
  a entrar (sirve para "cerrar todas las sesiones" de golpe).
- Si nadie recuerda la clave del administrador: ▶ `codigoAdministrador` (en el
  servidor único `sgsst__codigoAdministrador`) da un código de un solo uso que
  vale 2 horas; en *Usuarios y respaldo* se recupera el acceso.
- Quién hizo cada cambio queda en la columna `usuario` de `Eventos` y en el
  propio registro (`registradoPor`, `modificadoPor`), puesto por el servidor.
- Los permisos de trabajo, ATS, EPP, charlas y anexo **no** usan usuarios: su
  evidencia legal son las firmas de cada persona.

### Adjuntos y respaldo (desde v94)

Los adjuntos van a Google Drive (carpeta *Adjuntos SG-SST*, una subcarpeta por
tipo de registro) y en el registro queda solo la ficha. Drive **no se comparte**
con nadie: el portal los baja a través del servidor. Quitar un adjunto no lo
borra: lo marca como retirado y renombra el archivo.

El respaldo semanal (`instalarRespaldo`) copia los libros a *Respaldos SG-SST*.
Para que copie también los de los permisos, ATS, EPP, charlas y anexo, pega sus
URL en `RESPALDAR_TAMBIEN` (arriba en `backend-sgsst.gs`). El aviso diario dice
si el respaldo dejó de hacerse.

**Al actualizar a v94:** el código usa Drive por primera vez. Hay que ejecutar
una vez ▶ `instalarRespaldo` (o cualquier función) y aceptar el permiso **antes**
de *Nueva versión*; si no, el servidor responde con la pantalla de permisos de
Google y nada se guarda.

### El token es público y no tiene arreglo

`config.js` contiene el token que los backends validan, y es un archivo público.
Cualquiera que abra el código del sitio lo ve.

No se puede esconder: el sitio es estático y las peticiones salen sin sesión de
Google. Restringir el despliegue al dominio rompería el portal.

Lo que hay en su lugar:
- La bitácora deja rastro de todo.
- `revisarIntentosSospechosos()` avisa por correo si alguien prueba con un
  token inválido.
- Las acciones delicadas piden además clave o sesión de usuario; rotar el token es cambiar `apiToken` en la configuración de la empresa y en su servidor (`verConfiguracion`).

No es ideal. Es lo que se puede con esta arquitectura, y conviene que quien
tome decisiones lo sepa.

---

## 4. Antes de tocar nada

```bash
node pruebas/pruebas.js
```

Más de 1.300 comprobaciones, unos segundos. **Córrelas antes y después de
cualquier cambio.** Si algo sale en rojo, no subas.

Sé honesto sobre qué son: la mayoría verifica que ciertas piezas de código
sigan existiendo — protegen contra quitar sin querer algo que costó encontrar,
y contra errores de despliegue. **No garantizan que el sistema funcione bien.**

Para eso está la segunda (v110), en un navegador de verdad:

```bash
cd pruebas && npm install && npx playwright install chromium   # una vez
node navegador.js
```

Abre la demo (el mismo código del servidor corre dentro del navegador) y
diligencia, firma y guarda los 5 permisos como lo haría alguien en planta,
también sin señal y con firmas a pantalla completa. La más importante: llena
cada campo con una marca única y exige que **todas** vuelvan del servidor y se
vean al abrir el permiso en otro equipo. Así se descubrió que alturas llevaba
tiempo sin guardar fechas, área, descripción ni la firma del inspector.
Probar en un celular real sigue siendo necesario, pero ya no es la única red.

GitHub corre las dos en cada subida y no publica si algo sale en rojo
(`.github/workflows/pruebas.yml`).

---

## 5. Los errores que ya cometimos

Para que no los repitas:

**Subir el sitio sin cambiar `CACHE_NAME` en `sw.js`.** Los celulares siguen
con la versión vieja indefinidamente. Perdimos horas creyendo que un arreglo no
servía cuando nunca había llegado al dispositivo.

**Usar "Nueva implementación" en vez de "Nueva versión".** Cambia la URL del
backend y hay que actualizar `config.js`. Siempre "Nueva versión".

**Arreglar algo en un solo sitio.** Casi todos los fallos graves vinieron de
código duplicado: el motor de firmas, el CSS, los cinco backends. Ya está
unificado — **si vas a copiar y pegar algo, para y busca dónde centralizarlo.**

**Validar un campo sin guardarlo.** Alturas exigía fechas, área y descripción
para guardar, y los imprimía en el PDF, pero `collectOpenData` buscaba los id de
los otros permisos (`desdeFecha`, `sitio`…) y alturas usa los suyos. Nadie lo
notó porque el PDF del momento salía completo. Si agregas un campo a un permiso,
`node navegador.js` te dice si llega al servidor.

**Guardar datos del envío dentro del permiso.** `firstSave` y `opId` describen
la petición, no el documento. Guardarlos hizo que el servidor confundiera
reenvíos legítimos con reintentos y descartara guardados en silencio.

---

## 6. Diagnóstico rápido

| Síntoma | Primero revisa |
|---|---|
| "El arreglo no sirvió" | ¿Subiste `CACHE_NAME`? ¿Aceptaron el banner? |
| Faltan firmas | Pestaña `Firmas`: ¿hay filas con ese código? |
| No guarda algo | Pestaña `Eventos`: ahí está el motivo del rechazo |
| "Token inválido" / "Clave inválida" / "Sesión vencida" | ¿El `apiToken` de la empresa coincide con su servidor? Clave: la del usuario en `usuarios.html`. Sesión: volver a entrar. |
| No funciona sin señal | ¿El archivo está listado en `sw.js`? |

**En un dispositivo concreto:** abre cualquier permiso agregando `?debug=1` a
la dirección. Sale un panel que muestra el estado real de las firmas y los
errores, sin consola ni cable. Se hizo para diagnosticar una tablet en planta.

---

## 7. Mantenimiento periódico

Ver la tabla actualizada en INSTALAR-NUEVA-EMPRESA.md §4.2 y las propiedades del script en §4.3
(en el servidor único las funciones llevan prefijo: `sgsst__probarRestauracion`, etc.).

---

## 8. Estado actual (v162) y herramientas

- **Arquitectura:** 1 proyecto de Apps Script por empresa (`servidor-unico/`), con los libros de cada módulo.
- **La restauración automática solo cubre el libro del SG-SST.** Los demás tienen copia semanal y se restauran a mano.
- **Todo depende de una sola cuenta de Google** por empresa: el respaldo externo (`exportarTodo`, «Descargar todo» en usuarios.html) es obligatorio.
- **Bitácora encadenada:** cada evento guarda el hash del anterior; `verificarBitacora()` o bitacora.html detectan alteraciones.
- **Páginas nuevas:** bitacora, ficha (área/contratista), verificar (certificados con QR, pública), habeas (Ley 1581), auditor (enlace de solo lectura, público), mis-avisos, normograma, licencia, contratista-portal (público).
- **Pruebas:** `node pruebas/pruebas.js` (incluye `pruebas/unitarias.js` y la revisión de CSP en cada página); `node pruebas/navegador.js` (además barre todas las páginas con axe y CSP).
- **Lint:** `(cd herramientas/lint && npm install)` una vez; `node herramientas/lint/revisar.js`. Es un trinquete: si suben los innerHTML, revisar y correr `--actualizar`.
- **Licencia:** `node herramientas/licencia.js llaves` una vez (la llave privada queda en `~/.ssta-licencia-privada.json`, **nunca** en el proyecto); `firmar` emite licencias. La licencia nunca bloquea el portal.
- **JS de páginas grandes:** `node herramientas/extraer-js.js` deja `<pagina>.app.js` (ats, reportes, inspecciones, proveedores…).
- **CSP:** cada página permite solo SUS `<script>` en línea, por huella sha256 (sin `'unsafe-inline'` para scripts). Si cambias un `.html`, corre `node herramientas/csp.js` (lo hacen solos `subir-version`, el minificador y la demo; `pruebas.js` falla si quedó vieja). Nada de `onclick=` en el HTML: usa `data-recargar` / `data-seleccionar` / `data-imprimir` o un `addEventListener`. Los estilos en línea sí siguen permitidos. La demo agrega `'unsafe-eval'` solo por el emulador.
- **Publicar:** un solo comando, `node herramientas/publicar.js vNNN` (RELEASE.md). `herramientas/verificar-release.js` revisa que la versión esté completa (misma versión en todos lados, CSP, núcleo sin señal, servidor generado al día, guía y capturas al día, paquete limpio); el hook `herramientas/git-hooks/pre-commit` corre la parte rápida.
- **Planes:** `PLANES_PORTAL` en `empresa-motor.js` (SG-SST Esencial = la base con todo el ciclo de la 0312; SG-SST + Obra; Integral) y `COMPLEMENTOS_PORTAL.obra` (permisos, ATS, preoperacionales, personal autorizado: se suma a la base, nunca va solo). Los documentos comerciales están en `comercial/` y su anexo de módulos se genera desde aquí. El configurador y la consola muestran qué plan tiene cada empresa («personalizado» si se prendió algo fuera del plan).
- **WebKit (iPhone):** `SSTA_MOTOR=webkit node pruebas/navegador.js`. En GitHub corre en un job que todavía no frena la publicación.
- **Capturas de la guía:** `node herramientas/guia/capturas.js` las toma de las pantallas reales; luego `node herramientas/guia/hacer-guia.js GUIA-DE-INSTALACION.docx`. Córrelo siempre que cambie el instalador o la consola.
- **Candado del servidor:** `LOCK_TOMADO_` cuenta si la ejecución ya tiene el candado; la bitácora no lo vuelve a pedir dentro de un guardado.
- **Importar Excel:** máximo 8 MB, 40 MB descomprimido y 5000 filas por archivo.
- **Maestro único de personas (v164):** cada ficha de Personal habilitado (`trabajador`) tiene un `personaId` (`P-` + 12 caracteres) que pone el servidor y no cambia nunca. Si corrigen la cédula, la vieja queda en `cedulasAnteriores`; si se unifican dos fichas, la que queda recoge la cédula y el `personaId` de la otra (`personasFusionadas`). Todo lo que busca por cédula (ficha 360, inducciones, exámenes, el anexo) pasa por `personaDe_`, que encuentra a la persona por cualquiera de ellas. Quien se agrega al anexo de personal entra también al maestro «por revisar» (`asegurarPersona`). SST descarga el maestro en CSV desde Personal habilitado (para nómina o PILA); el servidor lo entrega con `?action=personas`. Las fichas de antes reciben su `personaId` solas al abrir el maestro, o a mano con `sgsst__asignarPersonaIds`.
- **Lo que sigue (si se integra con nómina o PILA):** los permisos, ATS y charlas siguen guardando la cédula del día (es la evidencia de ese día) y se cruzan con el maestro por todas las cédulas de la persona.
- **Se perdieron datos antes de los arreglos de 2026.** Corre `auditarIntegridad()` para saber cuáles.

---

### v169: reintegro, presupuesto, pantalla de planta, uso por módulo e inglés

- **Reintegro laboral** (tipo `reintegro`, pestaña Reintegro de Salud): dato de salud (`SOLO_SST` y `TIPOS_SALUD_`), sin diagnóstico. Con «¿para qué trabajos tiene restricción?» bloquea esos trabajos en Personal habilitado (`efectoReintegro_`, igual que un examen); al cerrar el caso se quita el bloqueo que puso. Avisos: seguimiento vencido, restricciones sin comunicar y vencimiento de restricciones temporales. El cierre por retiro advierte la estabilidad laboral reforzada (Ley 361 de 1997, art. 26).
- **Presupuesto del SG-SST** (`presupuesto.html`, tipos `presupuesto` = uno por año con sus rubros, y `gasto`). El resumen del presupuesto lleva los rubros como lista (los demás tipos genéricos reducen las listas de objetos a un número). La pista 1.1.3 de las auditorías usa esta ejecución.
- **Pantalla de planta** (`pantalla-planta.html`): sin `k` es la configuración (SST crea el enlace); con `k` es el modo televisor. El servidor (`pantalla`, antes de pedir la clave del portal) solo entrega cifras; `enlacePantalla` con `nuevo=1` invalida el anterior.
- **Uso por módulo:** el enrutador del servidor único (`contarUso_`) cuenta cada guardado por módulo y mes en las propiedades (`USO_aaaa-mm`, 13 meses) y la raíz lo entrega en `uso`. La vigilancia de la consola lo guarda en `usoServidor` del cliente y `admin.html` (`usoHtml`) lo muestra con sugerencias de plan. Contar nunca impide guardar.
- **Inglés** (`i18n.js` + `i18n-en.js`): se traduce lo que la pantalla ya pintó en las páginas con `<body data-i18n>` (informe, indicadores, gerencia, pantalla de planta) y el HTML de sus PDF. Para encontrar frases sin traducir: abrir con `?lang=en&i18n=faltan` y en la consola `I18N.faltan()`. Lo que escribió la gente no se traduce. Los patrones con números usan «lookahead», nunca `.*X.*Y.*` (en textos largos se cuelga).

## 9. Si tienes que cambiar algo

Para sacar la versión: `node herramientas/publicar.js vNNN` (ver RELEASE.md). Lo de abajo es el criterio.

1. Corre las pruebas primero, para partir de verde.
2. Haz el cambio en el sitio **centralizado** que corresponda (`fuente/common/`,
   `common.css`, `permiso-core.js`, `core.gs`), nunca copiando en cinco lados.
   - **`common.js` no se edita** (v167): se genera de `fuente/common/` con
     `node herramientas/armar-common.js`. Las pruebas y GitHub fallan si alguien lo cambia a mano.
   - ¿No sabes dónde está algo? `MAPA-DEL-CODIGO.md`.
   - No escribas líneas de más de 200 caracteres: `node herramientas/lineas-largas.js` cuenta las
     que hay por archivo y no deja que suban (las viejas se van partiendo cuando se toca ese código).
3. Corre las pruebas otra vez.
4. Sube `CACHE_NAME` si tocaste algo del sitio.
5. Despliega **un backend primero**, pruébalo, y sigue con el resto.
6. Prueba en un celular real: crear, firmar, guardar, cerrar y reabrir.

El paso 6 no es opcional. Los tres fallos graves de este portal pasaron todas
las revisiones de código y solo aparecieron usándolo de verdad.
