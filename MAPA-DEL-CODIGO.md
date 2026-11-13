# Mapa del código

Generado por `node herramientas/mapa.js` a partir del código: **no se edita a mano**. Dice dónde está cada cosa;
el porqué de las decisiones está en [TRASPASO.md](TRASPASO.md) y cómo sacar una versión, en [RELEASE.md](RELEASE.md).

## 1. `common.js`, por partes

`common.js` lo cargan todas las pantallas. Se **genera** uniendo estos archivos de `fuente/common/` en orden
(`node herramientas/armar-common.js`). Se cambia la parte, nunca `common.js`. Si el navegador reporta un error en
`common.js:1234`, `node herramientas/armar-common.js --linea 1234` dice en qué parte y línea está.

| Parte | Líneas | Módulos que define |
|---|---|---|
| `01-base.js` | 161 | 3 funciones |
| `02-clave-y-jornada.js` | 355 | Consola, ClavePortal, Jornada, TraerDeAts |
| `03-borradores-ayuda-diagnostico.js` | 210 | AvisoPersonal, DraftStore, AyudaCorta, BuscarTodo, Diagnostico |
| `04-actualizacion-y-cola-sin-senal.js` | 520 | UpdateManager, Outbox, OutboxBadge |
| `05-firma.js` | 352 | SignaturePad |
| `06-pantalla-y-seleccion.js` | 123 | ScrollProgress, OfflineBanner, SeleccionMultiple |
| `07-firma-pantalla-completa.js` | 272 | AnclaGiro, FirmaCompleta |
| `08-festivos-y-sesion.js` | 237 | Festivos, Sesion |
| `09-sgsst-y-personal.js` | 473 | SGSST, Areas, AutoCedula, Habilitacion |
| `10-roles-y-navegacion.js` | 287 | AccesoRol, Iconos, BarraInferior, NavAtras |
| `11-accesibilidad.js` | 423 | ModoSol, Dictado, Letra, Leer, MiFirma, FirmaAlterna, SubirFirma, Accesible |
| `12-errores-y-autoguardado.js` | 368 | Errores, AutoGuardado |
| `13-guia-flotante.js` | 171 | GuiaFlotante |

## 2. Código del sitio

| Archivo | Líneas | De qué trata | Lo cargan |
|---|---|---|---|
| `agenda-tareas.js` | 134 | Tus tareas y recordatorios en el calendario de Gestión (v174) | index |
| `ats-catalogo.js` | 1164 | Base de conocimiento del ATS interactivo (SSTA-F-007) | ats |
| `ats.app.js` | 2250 | código de ats.html (v162: fuera del HTML para que el celular lo guarde en caché). | ats |
| `auditor-enlaces.js` | 133 | Enlaces para auditores, en Auditorías (v174; antes estaba en Usuarios) | auditorias |
| `auditorias-plantillas.js` | 423 | Listas de verificación de auditoría | 9 pantallas |
| `autorizacion-datos.js` | 68 | Autorización de tratamiento de datos (Ley 1581 de 2012) | induccion-responder, induccion |
| `ayuda-guias.js` | 78 | Las guías de «Ayuda» (v129) | admin, ayuda, configurar-empresa |
| `cifrado.js` | 112 | Reserva de las quejas del Comité de Convivencia | buzon, convivencia |
| `comites.js` | 504 | COPASST y Comité de Convivencia Laboral | comite-emergencias, convivencia, copasst |
| `config.js` | 128 | Configuración centralizada del Portal SSTA | todas |
| `contratistas-docs.js` | 19 | v162 · Documentos que se piden a los contratistas (los usan Contratistas y el portal del contratista). | contratista-portal, contratistas |
| `dialogo.js` | 79 | Ventanas del portal en vez de las del navegador (v132) | todas |
| `empezar-reglas.js` | 179 | Por dónde iniciar (v172; v174 sin la fase de instalar) | empezar, index |
| `empezar.app.js` | 142 | Por dónde iniciar (v172) | empezar |
| `empresa-motor.js` | 411 | Lo que hace funcionar empresa.js (v116) | todas |
| `empresa.js` | 746 | Sitio multiempresa (tu marca) | todas |
| `evidencias-reglas.js` | 190 | Carpeta de evidencias por estándar (v105) | analitica, evidencias, informe |
| `gtc45-catalogo.js` | 184 | Catálogo de peligros de la GTC 45 (2012) | peligros, percepcion-peligros |
| `guia-preguntas.js` | 448 | La guía a la que se le pregunta (v172) | ayuda |
| `i18n-en.js` | 282 | Diccionario español → inglés de los reportes y la gerencia (v169) | gerencia, indicadores, informe, pantalla-planta |
| `i18n.js` | 163 | Reportes y gerencia en inglés (v169) | gerencia, indicadores, informe, pantalla-planta |
| `iconos-emoji.js` | 126 | v122 | todas |
| `importar.js` | 593 | Carga masiva: escribir en una tabla o pegar de Excel | 5 pantallas |
| `induccion-banco.js` | 39 | Temas y evaluación de la inducción en SST | induccion-responder, induccion |
| `informe-mes-reglas.js` | 245 | Cálculo del informe mensual de actividades (v171) | informe-mes |
| `informe-mes.app.js` | 316 | Informe mensual de actividades (v171) | informe-mes |
| `informe-reglas.js` | 503 | Informe del SG-SST con sugerencias (v107) | 6 pantallas |
| `inspecciones-plantillas.js` | 983 | Listas de chequeo de las inspecciones | 6 pantallas |
| `inspecciones.app.js` | 824 | código de inspecciones.html (v162: fuera del HTML para que el celular lo guarde en caché). | inspecciones |
| `kit-documental.js` | 253 | Documentos del SG-SST con los datos de la empresa | documentos |
| `licencia.js` | 48 | Licencia de uso del Portal SSTA (v162) | index, licencia |
| `menus-empresa.js` | 122 | Qué ve cada empresa en sus menús (v124) | admin, configurar-empresa |
| `normas-base.js` | 42 | Lista para empezar la matriz legal de SST (Colombia) | documental |
| `pantalla-planta.app.js` | 223 | El tablero para el televisor de la planta (v169) | pantalla-planta |
| `permiso-core.js` | 2756 | Núcleo compartido de los 4 permisos de trabajo | 5 pantallas |
| `plan-sugerido.js` | 189 | Plan anual de trabajo armado según la empresa (v105) | plan-anual |
| `preop-base.js` | 2718 | Preoperacionales base del portal (v123–v124) | admin, configurar-empresa, etiquetas-qr, preoperacional |
| `preop-formularios.js` | 7 | Preoperacionales del portal (GENERADO) | 5 pantallas |
| `presupuesto.app.js` | 495 | Presupuesto del SG-SST con su ejecución (v169) | presupuesto |
| `proveedores-catalogo.js` | 455 | Evaluación de proveedores y contratistas (v107) | proveedores |
| `proveedores.app.js` | 994 | código de proveedores.html (v162: fuera del HTML para que el celular lo guarde en caché). | proveedores |
| `qr.js` | 388 | Generador de códigos QR del Portal SSTA | 18 pantallas |
| `registros.js` | 126 | Formularios por esquema para los módulos de planeación | 37 pantallas |
| `reportes.app.js` | 934 | código de reportes.html (v162: fuera del HTML para que el celular lo guarde en caché). | reportes |
| `sgsst-ui.js` | 662 | Piezas comunes de las pantallas del SG-SST | 63 pantallas |
| `sw.js` | 294 | Service Worker del Portal SSTA — v2 | — |
| `valida.js` | 262 | Reglas de datos de los formularios (v107) | 67 pantallas |

## 3. Pantallas

Cada pantalla es un `.html` con su código al final (las 5 más grandes lo tienen aparte en `*.app.js`).

| Pantalla | Líneas | Scripts propios (además de los comunes) |
|---|---|---|
| `404.html` | 42 | — |
| `accesibilidad.html` | 95 | — |
| `admin.html` | 485 | auditorias-plantillas.js, preop-formularios.js, preop-base.js, inspecciones-plantillas.js, ayuda-guias.js, menus-empresa.js |
| `ambiental.html` | 613 | registros.js |
| `analitica.html` | 331 | registros.js, auditorias-plantillas.js, evidencias-reglas.js, informe-reglas.js |
| `areas.html` | 110 | registros.js |
| `asesor.html` | 486 | registros.js, auditorias-plantillas.js |
| `asistencia.html` | 1049 | — |
| `ats.html` | 558 | qr.js, ats-catalogo.js, ats.app.js |
| `auditor.html` | 84 | — |
| `auditorias.html` | 628 | registros.js, auditorias-plantillas.js, auditor-enlaces.js |
| `ayuda.html` | 139 | ayuda-guias.js, guia-preguntas.js |
| `bitacora.html` | 99 | — |
| `buzon.html` | 288 | cifrado.js |
| `calidad.html` | 560 | registros.js, qr.js |
| `cierre-mes.html` | 226 | informe-reglas.js, registros.js |
| `comite-emergencias.html` | 91 | qr.js, comites.js |
| `configurar-empresa.html` | 676 | qr.js, auditorias-plantillas.js, preop-formularios.js, preop-base.js, inspecciones-plantillas.js, ayuda-guias.js, menus-empresa.js |
| `contratista-portal.html` | 89 | contratistas-docs.js |
| `contratistas.html` | 529 | registros.js, qr.js, contratistas-docs.js |
| `convivencia.html` | 738 | cifrado.js, qr.js, registros.js, comites.js |
| `copasst.html` | 104 | qr.js, comites.js |
| `dashboard.html` | 545 | — |
| `documental.html` | 430 | registros.js, importar.js, normas-base.js |
| `documentos.html` | 210 | registros.js, auditorias-plantillas.js, kit-documental.js |
| `dotacion.html` | 164 | registros.js |
| `emergencias.html` | 403 | registros.js |
| `empezar.html` | 65 | registros.js, empezar-reglas.js, empezar.app.js |
| `encuesta-cliente.html` | 213 | — |
| `entrega-epp.html` | 545 | registros.js |
| `equipo.html` | 117 | registros.js, qr.js |
| `estado.html` | 292 | — |
| `etiquetas-qr.html` | 119 | preop-formularios.js, preop-base.js, qr.js |
| `evidencias.html` | 193 | registros.js, auditorias-plantillas.js, evidencias-reglas.js |
| `ficha.html` | 138 | registros.js |
| `firmar-acta.html` | 104 | — |
| `gerencia.html` | 215 | i18n-en.js, i18n.js, informe-reglas.js, registros.js, auditorias-plantillas.js |
| `habeas.html` | 75 | — |
| `habilitacion.html` | 542 | importar.js |
| `index.html` | 1519 | licencia.js, preop-formularios.js, empezar-reglas.js, agenda-tareas.js |
| `indicadores.html` | 401 | i18n-en.js, i18n.js, informe-reglas.js |
| `induccion-responder.html` | 204 | induccion-banco.js, autorizacion-datos.js |
| `induccion.html` | 262 | registros.js, induccion-banco.js, autorizacion-datos.js, qr.js |
| `informe-mes.html` | 65 | registros.js, informe-mes-reglas.js, informe-mes.app.js |
| `informe.html` | 372 | i18n-en.js, i18n.js, registros.js, auditorias-plantillas.js, evidencias-reglas.js, inspecciones-plantillas.js, informe-reglas.js |
| `inspeccion-epp.html` | 1572 | — |
| `inspecciones.html` | 228 | registros.js, inspecciones-plantillas.js, importar.js, qr.js, inspecciones.app.js |
| `instalar.html` | 203 | — |
| `licencia.html` | 61 | licencia.js |
| `matrices-iso.html` | 112 | registros.js |
| `medevac.html` | 151 | — |
| `mis-avisos.html` | 69 | — |
| `normograma.html` | 112 | — |
| `offline.html` | 62 | — |
| `pantalla-planta.html` | 112 | qr.js, i18n-en.js, i18n.js, pantalla-planta.app.js |
| `papelera.html` | 82 | — |
| `paquete-cliente.html` | 192 | registros.js, inspecciones-plantillas.js |
| `peligros.html` | 494 | registros.js, importar.js, gtc45-catalogo.js, qr.js |
| `percepcion-peligros.html` | 138 | gtc45-catalogo.js |
| `permiso-espacios-confinados.html` | 879 | qr.js, permiso-core.js |
| `permiso-izajes-cargas.html` | 528 | qr.js, permiso-core.js |
| `permiso-trabajo-alturas.html` | 1012 | qr.js, permiso-core.js |
| `permiso-trabajo-caliente.html` | 543 | qr.js, permiso-core.js |
| `permiso-trabajo-electrico.html` | 573 | qr.js, permiso-core.js |
| `persona.html` | 172 | registros.js |
| `personal-autorizado.html` | 1181 | — |
| `pesv.html` | 311 | registros.js |
| `plan-accion.html` | 401 | — |
| `plan-anual.html` | 574 | registros.js, plan-sugerido.js |
| `preoperacional.html` | 428 | registros.js, preop-formularios.js, preop-base.js |
| `presupuesto.html` | 72 | registros.js, presupuesto.app.js |
| `privacidad.html` | 116 | — |
| `programas.html` | 860 | registros.js, inspecciones-plantillas.js |
| `proveedores.html` | 156 | registros.js, proveedores-catalogo.js, proveedores.app.js |
| `pve.html` | 353 | registros.js, informe-reglas.js |
| `quimicos.html` | 807 | registros.js, importar.js |
| `reportes.html` | 343 | reportes.app.js |
| `revision-direccion.html` | 329 | registros.js |
| `salud.html` | 996 | registros.js |
| `terminos.html` | 71 | — |
| `usuarios.html` | 283 | — |
| `verificar.html` | 56 | — |

## 4. Servidor (Apps Script)

Se edita en `backends/`. `servidor-unico/` (por partes) y `servidor-todo-en-uno/` (un solo archivo para pegar) se
**generan** con `node herramientas/armar-servidor-unico.js`.

| Archivo | Líneas | De qué trata | Funciones |
|---|---|---|---|
| `backends/backend-asistencia.gs` | 588 | Control de asistencia a capacitación, eventos y | 52 |
| `backends/backend-ats.gs` | 905 | Análisis de Trabajo Seguro (SSTA-F-007) — Portal SSTA | 44 |
| `backends/backend-epp.gs` | 1098 | Inspección de EPP (SSTA-F-006) — Portal SSTA | 37 |
| `backends/backend-personal-autorizado.gs` | 1025 |  | 40 |
| `backends/backend-sgsst.gs` | 3916 | Gestión del SG-SST — Portal SSTA | 263 |
| `backends/permisos/config-alturas.gs` | 18 | Lo ÚNICO propio del permiso de Trabajo en Alturas | 0 |
| `backends/permisos/config-caliente.gs` | 18 | Lo ÚNICO propio del permiso de Trabajo en Caliente | 0 |
| `backends/permisos/config-confinados.gs` | 18 | Lo ÚNICO propio del permiso de Espacios Confinados | 0 |
| `backends/permisos/config-electrico.gs` | 18 | Lo ÚNICO propio del permiso de Trabajo Eléctrico | 0 |
| `backends/permisos/config-izajes.gs` | 18 | Lo ÚNICO propio del permiso de Izajes de Cargas | 0 |
| `backends/permisos/core.gs` | 1345 |  | 41 |

## 5. Herramientas

| Comando | Para qué |
|---|---|
| `node herramientas/actualizar-servidores.js` | Actualiza el servidor de TODAS tus empresas |
| `node herramientas/armar-common.js` | common.js sale de fuente/common/ (v167) |
| `node herramientas/armar-demo.js` | Arma el sitio de la EMPRESA DEMO |
| `node herramientas/armar-servidor-unico.js` | Genera el Apps Script de UNA empresa nueva |
| `node herramientas/carga-concurrente.js` | ¿Qué pasa si 20 personas guardan a la vez? |
| `node herramientas/carga.js` | Prueba de carga del servidor SG-SST, sin Google (v167) |
| `node herramientas/comercial.js` | Arma los documentos comerciales en Word y PDF (v166) |
| `node herramientas/csp.js` | Política de seguridad SIN 'unsafe-inline' para scripts (v163) |
| `node herramientas/empaquetar.js` | Arma la entrega completa con UN comando |
| `node herramientas/extraer-js.js` | v162 · Saca el <script> grande de una página a «<página>.app.js» (archivo aparte: el celular lo guarda en cach |
| `node herramientas/grabar-videos.js` | Graba los videos cortos del manual (ayuda.html) |
| `node herramientas/importar-formularios.js` | Formularios de Google → preoperacionales del portal |
| `node herramientas/indice-preop.js` | Vuelve a escribir en index.html la lista corta de los preoperacionales base |
| `node herramientas/instalar-empresa.js` | El servidor de una empresa NUEVA con un comando (v167) |
| `node herramientas/licencia.js` | herramientas/licencia.js — Llaves y licencias del Portal SSTA (v162) |
| `node herramientas/lineas-largas.js` | Tope a las líneas kilométricas (v167) |
| `node herramientas/mapa.js` | MAPA-DEL-CODIGO.md: dónde está cada cosa (v167) |
| `node herramientas/minificar.js` | Achica el sitio que se sube (v132) |
| `node herramientas/publicar.js` | UN solo comando para sacar una versión (v165) |
| `node herramientas/sembrar-demo.js` | Crea demo/semilla.json (los datos de ejemplo de la demo) |
| `node herramientas/subir-version.js` | Sube la versión del portal en TODOS lados a la vez |
| `node herramientas/verificar-release.js` | Lo que tiene que estar bien ANTES de entregar (v165) |

## 6. Pruebas

| Archivo | Líneas | Qué revisa |
|---|---|---|
| `pruebas/pruebas.js` | 3773 | El código: reglas de la casa, servidor simulado, caché, versiones, datos reales que no deben colarse |
| `pruebas/unitarias.js` | 346 | Lógica pura: se ejecuta la función y se compara el resultado |
| `pruebas/navegador.js` | 1447 | Un navegador de verdad con tamaño de celular: pantallas, permisos, firmas, sin señal |
