// Genera GUIA-DE-INSTALACION.docx. Uso: node herramientas/guia/hacer-guia.js GUIA-DE-INSTALACION.docx (necesita: npm i docx)
const fs = require('fs'), path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  AlignmentType, ImageRun, LevelFormat, PageBreak, Footer, PageNumber, Header, TabStopType } = D;

const G = __dirname;
const VERSION = (fs.readFileSync(path.join(G, '..', '..', 'CHANGELOG.md'), 'utf8').match(/\bv(\d{3})\b/) || [, '?'])[1];
const SALIDA = process.argv[2] || path.join(G, 'GUIA-DE-INSTALACION.docx');
const ANCHO = 9360; // carta con márgenes de 1": 12240 - 2*1440
const C = { tinta: '10213A', suave: '5F7390', azul: '2F6BFF', morado: '5B3FD9', verde: '1D9A5B', rojo: 'B42318', amarillo: 'FFF8E6', azulClaro: 'EEF3FF', moradoClaro: 'F1EDFF', verdeClaro: 'EAF7F0', rojoClaro: 'FDEEEC', gris: 'F3F5F8' };

/* ── Ayudas ── */
const t = (texto, o = {}) => new TextRun(Object.assign({ text: texto, font: 'Calibri', size: o.size || 24, color: o.color || C.tinta }, o));
const b = (texto, o = {}) => t(texto, Object.assign({ bold: true }, o));
/** Párrafo con fragmentos: 'texto **negrita** texto'. */
function frag(s, o = {}) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((x) =>
    x.startsWith('**') ? b(x.slice(2, -2), o) : x.startsWith('`') ? t(x.slice(1, -1), Object.assign({ font: 'Consolas', size: (o.size || 24) - 2, shading: { type: ShadingType.CLEAR, fill: 'EEF1F5', color: 'auto' } }, o)) : t(x, o));
}
const p = (s, o = {}) => new Paragraph({ children: frag(s, o.run || {}), spacing: { after: o.after == null ? 140 : o.after, before: o.before || 0, line: 300 }, alignment: o.align, keepNext: o.keepNext });
const h1 = (s, color) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s, { size: 40, bold: true, color: color || C.tinta })], spacing: { before: 120, after: 160 } });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s, { size: 30, bold: true })], spacing: { before: 280, after: 120 }, keepNext: true });
const h3 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(s, { size: 26, bold: true, color: C.suave })], spacing: { before: 200, after: 80 }, keepNext: true });
let lista = 0;
/** Lista numerada que empieza en 1. */
const pasos = (items) => { lista++; return items.map((s) => new Paragraph({ numbering: { reference: 'num', level: 0, instance: lista }, children: frag(s), spacing: { after: 90, line: 300 } })); };
const vinetas = (items) => items.map((s) => new Paragraph({ numbering: { reference: 'vin', level: 0 }, children: frag(s), spacing: { after: 80, line: 300 } }));
const borde = (color) => ({ style: BorderStyle.SINGLE, size: 6, color });
const sinBorde = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
/** Recuadro de color (una celda). */
function caja(titulo, lineas, fondo, linea) {
  const hijos = [];
  if (titulo) hijos.push(new Paragraph({ children: [b(titulo, { size: 24 })], spacing: { after: 80 } }));
  lineas.forEach((s) => hijos.push(new Paragraph({ children: frag(s, { size: 22 }), spacing: { after: 60, line: 290 } })));
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO], rows: [new TableRow({ cantSplit: true, children: [new TableCell({
    width: { size: ANCHO, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: fondo, color: 'auto' }, margins: { top: 140, bottom: 140, left: 200, right: 200 },
    borders: { top: borde(linea), bottom: borde(linea), left: { style: BorderStyle.SINGLE, size: 24, color: linea }, right: borde(linea) }, children: hijos })] })] });
}
const ojo = (titulo, lineas) => caja('⚠  ' + titulo, lineas, C.amarillo, 'E0B84D');
const bien = (titulo, lineas) => caja('✓  ' + titulo, lineas, C.verdeClaro, '7CC9A0');
const nota = (titulo, lineas) => caja(titulo, lineas, C.azulClaro, '9DB7FF');
const espacio = (n = 120) => new Paragraph({ children: [], spacing: { after: n } });
/** Tabla simple con encabezado de color. */
function tabla(cols, filas, anchos, colorCab) {
  const w = anchos || cols.map(() => Math.floor(ANCHO / cols.length));
  const total = w.reduce((a, x) => a + x, 0);
  const celda = (s, i, cab, fondo) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, margins: { top: 90, bottom: 90, left: 120, right: 120 },
    shading: { type: ShadingType.CLEAR, fill: cab ? (colorCab || C.tinta) : (fondo || 'FFFFFF'), color: 'auto' },
    borders: { top: borde('DBE3EE'), bottom: borde('DBE3EE'), left: borde('DBE3EE'), right: borde('DBE3EE') },
    children: String(s).split('\n').map((l) => new Paragraph({ children: frag(l, cab ? { color: 'FFFFFF', bold: true, size: 22 } : { size: 22 }), spacing: { after: 40, line: 280 } })) });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: w,
    rows: [new TableRow({ tableHeader: true, children: cols.map((c, i) => celda(c, i, true)) })].concat(filas.map((f, k) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, i, false, k % 2 ? C.gris : 'FFFFFF')) }))) });
}
/** Captura de pantalla centrada, con pie de foto. */
function imagen(archivo, anchoPx, pie) {
  const buf = fs.readFileSync(path.join(G, archivo));
  const m = /c-(.*)\.jpg/.exec(archivo);
  const dims = require('child_process').execSync('python3 -c "from PIL import Image;im=Image.open(\'' + path.join(G, archivo) + '\');print(im.width,im.height)"').toString().trim().split(' ').map(Number);
  const alto = Math.round(anchoPx * dims[1] / dims[0]);
  return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: buf, transformation: { width: anchoPx, height: alto }, altText: { title: pie, description: pie, name: m ? m[1] : archivo } })], spacing: { before: 80, after: 40 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [t(pie, { size: 19, italics: true, color: C.suave })], spacing: { after: 200 } })];
}
/** Dos capturas lado a lado. */
function dosImagenes(a, pa, bb, pb, anchoPx) {
  const una = (archivo, pie) => { const dims = require('child_process').execSync('python3 -c "from PIL import Image;im=Image.open(\'' + path.join(G, archivo) + '\');print(im.width,im.height)"').toString().trim().split(' ').map(Number);
    return new TableCell({ width: { size: ANCHO / 2, type: WidthType.DXA }, borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'jpg', data: fs.readFileSync(path.join(G, archivo)), transformation: { width: anchoPx, height: Math.round(anchoPx * dims[1] / dims[0]) }, altText: { title: pie, description: pie, name: archivo } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [t(pie, { size: 19, italics: true, color: C.suave })], spacing: { before: 60, after: 160 } })] }); };
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO / 2, ANCHO / 2], rows: [new TableRow({ children: [una(a, pa), una(bb, pb)] })] });
}
/** Franja de color que dice qué parte es (A y B). */
function franja(texto, sub, fondo) {
  return new Table({ width: { size: ANCHO, type: WidthType.DXA }, columnWidths: [ANCHO], rows: [new TableRow({ children: [new TableCell({ width: { size: ANCHO, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: fondo, color: 'auto' }, margins: { top: 200, bottom: 200, left: 260, right: 260 }, borders: { top: sinBorde, bottom: sinBorde, left: sinBorde, right: sinBorde },
    children: [new Paragraph({ children: [t(texto, { size: 36, bold: true, color: 'FFFFFF' })], spacing: { after: 60 } }), new Paragraph({ children: [t(sub, { size: 22, color: 'FFFFFF' })] })] })] })] });
}
/** Lista de chequeo con casillas para marcar a mano. */
const chequeo = (items) => items.map((s) => new Paragraph({ children: [t('☐  ', { size: 28 })].concat(frag(s)), spacing: { after: 90 }, indent: { left: 200 } }));
const salto = () => new Paragraph({ children: [new PageBreak()] });

/* ════════════════════ CONTENIDO ════════════════════ */
const hijos = [];
// Portada
hijos.push(espacio(1400),
  new Paragraph({ children: [t('PORTAL SSTA', { size: 26, bold: true, color: C.azul, characterSpacing: 60 })], spacing: { after: 120 } }),
  new Paragraph({ children: [t('Cómo instalarlo', { size: 64, bold: true })], spacing: { after: 120 } }),
  new Paragraph({ children: [t('Guía paso a paso, en palabras sencillas', { size: 30, color: C.suave })], spacing: { after: 600 } }),
  tabla(['Si vas a…', 'Lee', 'Tiempo'], [
    ['Instalar **tu sitio** (eres el administrador, la primera vez)', '**Parte A**', '≈ 45 min, una sola vez'],
    ['Instalar **una empresa cliente**', '**Parte B**', '≈ 25 min por empresa'],
    ['Arreglar algo que salió mal', '**Parte C**', '—'],
    ['**Cambiar algo** o pasar a una **versión nueva** (recetas paso a paso)', '**Parte D**', '2 a 10 min cada receta']
  ], [5160, 1800, 2400]),
  espacio(400),
  p('Versión del portal: **v' + VERSION + '**. Fecha de la guía: ' + new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) + '.', { run: { color: C.suave, size: 22 } }),
  salto());

// 0. Antes de empezar
hijos.push(h1('Antes de empezar'),
  h2('Lo más importante: hay DOS cosas distintas que se instalan'),
  p('Casi toda la confusión viene de aquí. Léelo con calma una vez:'),
  tabla(['', 'A. TU SITIO', 'B. UNA EMPRESA CLIENTE'], [
    ['¿Qué es?', 'Tu portal, con tu marca, y tu **consola** de administrador (donde ves a todos tus clientes).', 'El portal de una empresa a la que le vendes el servicio.'],
    ['¿Cuántas veces?', '**Una sola vez.**', '**Una vez por cada empresa** nueva.'],
    ['¿En qué cuenta de Google?', 'La **tuya** (la de tu negocio).', 'La **de la empresa** (sus datos quedan en su Drive, no en el tuyo).'],
    ['¿En qué GitHub?', 'El **tuyo**.', 'Ninguno: usa tu sitio.'],
    ['¿Cómo la reconoces en pantalla?', 'Arriba dice **«Instalando: tu sitio (administrador)»**.', 'O dice **«Instalando:»** con el nombre y el código de la empresa cliente.'],
    ['¿Qué te queda al final?', 'Tu consola: `tu-sitio/admin.html`', 'Un **enlace y un QR** para los celulares de esa empresa.']
  ], [2200, 3580, 3580]),
  espacio(),
  h2('Los 3 lugares donde se hace todo'),
  p('Todo lo que harás con el portal pasa en uno de estos tres lugares. Cuando una receta diga «en tu consola» o «en Apps Script», es aquí:'),
  tabla(['Lugar', 'Qué es', 'Qué cambias ahí', '¿Se guarda solo?'], [
    ['**1. Tu consola**\n`tu-sitio/admin.html`', 'Tu pantalla de administrador, con la lista de tus empresas.', 'Menús de cada empresa, nombres y códigos de sus formatos, logo, color, datos, módulos.', '**Sí.** Tocas «Guardar y publicar» y listo. No se descarga ni se sube nada.'],
    ['**2. GitHub**\n`github.com`', 'Donde viven las **pantallas** del portal (el mismo para todas tus empresas).', 'Solo dos cosas: subir una **versión nueva** y la marca de **tu** sitio (`empresa.js`).', '**No.** Hay que subir los archivos (Add file → Upload files).'],
    ['**3. Apps Script**\n`script.google.com`', 'El **servidor** de cada empresa (sus datos), en la cuenta de Google de ESA empresa.', 'Pegar el servidor nuevo cuando la versión lo pide; correos y WhatsApp de la empresa; ver su clave.', 'Guardas 💾 y, si cambiaste el código, **Nueva versión**.']
  ], [1900, 2500, 2900, 2060]),
  espacio(),
  nota('La regla de oro', ['Primero haces la **Parte A** (una vez). Después, cada vez que vendes, haces la **Parte B**.', 'Si no tienes tu consola funcionando, todavía estás en la Parte A.']),
  h2('Lo que necesitas'),
  ...chequeo(['Un **computador** con Google Chrome (no lo hagas desde el celular).',
    'Tu **cuenta de Google** (Gmail o Google Workspace de tu negocio).',
    'Una **cuenta de GitHub** (gratis, en github.com). Es donde se publica el sitio.',
    'Esta carpeta del portal **descomprimida** (clic derecho → Extraer todo).',
    'Para cada cliente: que la empresa te deje entrar a **su cuenta de Google** (o hacerlo con ellos).']),
  h2('Qué hay en la carpeta'),
  tabla(['Carpeta o archivo', 'Para qué sirve'], [
    ['`GUIA-DE-INSTALACION.docx`', 'Esta guía.'],
    ['`PASO-1-SERVIDOR/Portal-SSTA.gs`', 'El **servidor** en un solo archivo. Se copia y se pega en Google (Parte A y Parte B).'],
    ['`PASO-2-SITIO/`', 'Lo que se sube a GitHub, en 3 carpetas: `1-paginas`, `2-archivos` y `3-solo-la-primera-vez`.'],
    ['`CHANGELOG.md`', 'Qué cambió en cada versión.'],
    ['`avanzado/`', '**No se sube a ningún lado.** Es el respaldo del proyecto (ver abajo).']
  ], [3600, 5760]),
  h3('La carpeta «avanzado»: qué es y qué hacer con ella'),
  tabla(['Adentro', 'Qué es', 'Qué haces con ella'], [
    ['`sitio-de-tu-marca/`', 'El proyecto completo: el mismo portal más las **pruebas** automáticas, las **herramientas** que arman el servidor y el paquete, y el servidor por partes.', 'Guárdala como **respaldo** (por ejemplo en tu Drive, una carpeta por versión). Si hay que hacer cambios al portal, se parte de aquí.'],
    ['`sitio-demo/`', 'Una empresa de ejemplo («Montajes Andinos») con datos inventados y sin servidor real. Tiene botones para entrar como Administradora, Supervisor o Solo consulta.', 'Para **mostrarle el portal a un cliente** sin tocar datos reales. Si la quieres en línea, súbela a OTRO repositorio de GitHub (igual que A1 a A3).']
  ], [2200, 3880, 3280]),
  ojo('Nunca subas «avanzado» al GitHub de tu sitio', ['A tu sitio solo va lo de `PASO-2-SITIO`. Lo de «avanzado» no hace falta para que el portal funcione.']),
  h2('Palabras que vas a ver'),
  tabla(['Palabra', 'Qué significa'], [
    ['**Sitio**', 'Las pantallas del portal (lo que se abre en el celular). Vive en GitHub y es el mismo para todas tus empresas.'],
    ['**Servidor**', 'Donde se guardan los datos de UNA empresa. Es un proyecto de Google Apps Script en la cuenta de esa empresa.'],
    ['**Consola**', 'Tu pantalla de administrador: `admin.html`. Solo tú entras, con tu usuario y contraseña.'],
    ['**Código de la empresa**', 'Un nombre corto sin espacios, por ejemplo `acme-sas`. Va en el enlace: `tu-sitio/?e=acme-sas`.'],
    ['**URL del servidor**', 'La dirección del servidor. Siempre termina en `/exec`.'],
    ['**Clave del portal**', 'Una clave corta (por ejemplo `KQRT-4827`) que crea el servidor al instalarse.'],
    ['**Instalar paso a paso**', 'La página `tu-sitio/instalar.html`: te lleva por todo, un paso a la vez, y prueba tu servidor.']
  ], [2600, 6760]),
  salto());

// PARTE A
hijos.push(franja('PARTE A · Tu sitio (administrador)', 'Se hace UNA SOLA VEZ, antes del primer cliente. Todo con TU cuenta de Google y TU GitHub.', '3F2A9E'), espacio(200),
  h2('A1. Crea tu repositorio en GitHub'),
  ...pasos(['Entra a **github.com** y crea tu cuenta (o entra con la que tienes).',
    'Arriba a la derecha toca **+** → **New repository**.',
    'En «Repository name» escribe `portal-sst` (o el nombre que quieras, sin espacios).',
    'Marca **Public** y toca **Create repository**.']),
  h2('A2. Sube el sitio (en 3 tandas)'),
  p('GitHub solo deja subir 100 archivos a la vez; por eso el sitio viene en 3 carpetas. Para **cada una**:'),
  ...pasos(['En tu repositorio toca **Add file** → **Upload files** (o el enlace «uploading an existing file»).',
    'Abre en tu computador la carpeta `PASO-2-SITIO/1-paginas`, selecciona **todo lo que hay adentro** (Ctrl + A) y arrástralo a la página de GitHub.',
    'Espera a que termine de cargar y toca **Commit changes** (el botón verde de abajo).',
    'Repite lo mismo con `2-archivos` y después con `3-solo-la-primera-vez`.']),
  ojo('Arrastra lo que hay DENTRO de cada carpeta', ['No arrastres la carpeta `1-paginas` completa: abre la carpeta, selecciona su contenido y arrastra eso. Las subcarpetas de `2-archivos` (fonts, videos…) sí se arrastran tal cual.']),
  h2('A3. Publica el sitio (GitHub Pages)'),
  ...pasos(['En tu repositorio: **Settings** → a la izquierda **Pages**.',
    'En «Branch» elige **main** y la carpeta **/ (root)**. Toca **Save**.',
    'Espera 1 o 2 minutos y recarga. Arriba sale tu dirección, algo como `https://tu-usuario.github.io/portal-sst/`. **Anótala: es tu sitio.**']),
  h2('A4. Abre «Instalar paso a paso»'),
  p('En el navegador abre `tu-sitio/instalar.html` (tu dirección + `instalar.html`). Elige **A. Mi sitio — soy el administrador**. Desde aquí la página te va guiando; esta guía explica lo mismo con más detalle.'),
  dosImagenes('c-01-instalar-elegir.jpg', 'Elige A la primera vez', 'c-02-instalar-camino-a.jpg', 'La franja de arriba te recuerda qué instalas', 200),
  h2('A5. Crea tu servidor en Google (un solo archivo)'),
  ...pasos(['Entra a **script.google.com** con **tu** cuenta de Google y toca **Nuevo proyecto**.',
    'Arriba, donde dice «Proyecto sin título», escribe **Portal SSTA**.',
    'A la izquierda, en **⚙️ Configuración del proyecto**, pon la zona horaria **(GMT-05:00) Bogotá**.',
    'Vuelve al editor (**< >** a la izquierda). Borra todo lo que hay en `Código.gs`.',
    'Abre `PASO-1-SERVIDOR/Portal-SSTA.gs` con el Bloc de notas, selecciona todo (Ctrl + A), copia (Ctrl + C) y pégalo en el editor (Ctrl + V). En «Instalar paso a paso» también está el botón **Copiar el servidor**.',
    'Arriba del todo, en **DATOS DE LA EMPRESA**, cambia solo lo que está entre comillas: el nombre de tu empresa, tus correos y tu WhatsApp.',
    'Toca **💾 Guardar**.']),
  p('Así deben quedar esas 3 líneas (con tus datos):', { keepNext: true }),
  caja(null, ["`const EMPRESA_NOMBRE = 'Asesorías SST Ríos S.A.S.';`", "`const CORREOS_SSTA = ['sst@tuempresa.com'];`", "`const CONTACTO_EPP = { nombre: 'Carlos Ríos', whatsapp: '+57 300 000 0000' };`"], C.gris, 'C8D0D6'),
  h2('A6. Instálalo'),
  ...pasos(['Arriba, junto a **▶ Ejecutar**, hay una lista de funciones. Elige **instalar**.',
    'Toca **▶ Ejecutar**.',
    'Google pide permisos: **Revisar permisos** → elige tu cuenta → **Configuración avanzada** → **Ir a Portal SSTA (no seguro)** → **Permitir**.',
    'Espera. Abajo, en el registro, sale **«✅ Instalado…»** y la **clave del portal** (por ejemplo `KQRT-4827`). Anótala.']),
  nota('«No seguro» es normal', ['Google lo dice de todo código que no publicó él. Es tu propio código, en tu propia cuenta.']),
  h2('A7. Publícalo como aplicación web'),
  ...pasos(['Arriba a la derecha: **Implementar** → **Nueva implementación**.',
    'Toca el engranaje ⚙️ junto a «Seleccionar tipo» y elige **Aplicación web**.',
    '**Ejecutar como: Yo.**',
    '**Quién tiene acceso: Cualquier usuario.**',
    'Toca **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).']),
  ojo('Este es el paso que más se olvida', ['Si en «Quién tiene acceso» queda otra opción (por ejemplo «Solo yo» o «Cualquier usuario con cuenta de Google»), **todo sale caído** en el portal.', 'Para corregirlo: Implementar → Gestionar implementaciones → ✏️ → cambia a **Cualquier usuario** → Implementar.']),
  h2('A8. Prueba tu servidor'),
  p('En «Instalar paso a paso», pega la URL que termina en `/exec` y toca **Probar mi servidor**. Si sale **«¡Funciona!»**, sigue. Si no, la misma página dice qué corregir (también está en la Parte C).'),
  ...imagen('c-03-probar-servidor.jpg', 250, 'Si algo está mal, la prueba te dice qué hacer'),
  h2('A9. Copia la configuración del servidor'),
  ...pasos(['En Apps Script, elige la función **verConfiguracion** y toca **▶ Ejecutar**.',
    'En el registro salen unas líneas entre rayas (`servidor:`, `apiToken:`, `clave:`, `llaveProveedor:`, `scriptId:`). **Cópialas todas.**']),
  h2('A10. Pon tu marca y sube 2 archivos'),
  ...pasos(['Abre `tu-sitio/configurar-empresa.html`. Pregunta «¿Qué vas a instalar?»: elige **Mi sitio — soy el administrador** (arriba dirá «Instalando: tu sitio»).',
    'Llena: nombre de tu producto (por ejemplo «Gestión SST 360»), los datos de tu empresa, logo y color.',
    'En el paso **Tu servidor**, pega lo que copiaste en A9.',
    'Toca **Descargar empresa.js** y **Descargar manifest.json**.',
    'En GitHub, **Add file → Upload files**, arrastra esos 2 archivos y **Commit changes** (reemplazan los que había). Espera 1 o 2 minutos.']),
  dosImagenes('c-04-configurador-elegir.jpg', 'El configurador pregunta primero qué instalas', 'c-05-configurador-mi-sitio.jpg', 'Mi sitio: arriba dice qué instalas y son pocos pasos', 200),
  h2('A11. Entra a tu consola'),
  ...pasos(['En Apps Script, elige **sgsst__codigoAdministrador** y ▶ Ejecutar. Sale un código como `ABCDE-12345` (sirve 2 horas, una sola vez).',
    'Abre `tu-sitio/admin.html`, escribe el código, tu usuario (por ejemplo `carlos`) y una contraseña de 8 o más letras y números.',
    '**Guarda `admin.html` en favoritos.** Ninguna pantalla de los clientes lleva ahí.']),
  h2('A12. Activa la vigilancia diaria'),
  p('En Apps Script, elige **sgsst__instalarVigilancia** y ▶ Ejecutar. Desde mañana, a las 6 a. m., tu servidor revisa los de tus clientes y te escribe si alguno falla.'),
  h3('Lista de chequeo de la Parte A (al terminar, nunca más la repites)'),
  ...chequeo(['Mi sitio abre en `https://tu-usuario.github.io/…`', 'Mi servidor dice «¡Funciona!» en Instalar paso a paso', 'Subí mi `empresa.js` y mi `manifest.json`', 'Entro a mi consola con mi usuario', 'Ejecuté `sgsst__instalarVigilancia`']),
  salto());

// PARTE B
hijos.push(franja('PARTE B · Una empresa cliente', 'Cada vez que vendes el portal. El servidor va en la cuenta de Google DE LA EMPRESA.', '1A6FE0'), espacio(200),
  ojo('No uses tu cuenta de Google para el cliente', ['Si instalas el servidor del cliente en tu cuenta, sus datos (cédulas, firmas, salud) quedan en **tu** Drive. Eso trae problemas legales (Ley 1581 de 2012). Usa siempre la cuenta **de la empresa**.']),
  h2('B1. Abre la guía desde tu consola'),
  p('Entra a tu consola (`admin.html`) y toca **Instalar empresa nueva**. Se abre «Instalar paso a paso» en el camino **B** (Una empresa cliente).'),
  h2('B2. Crea el servidor de la empresa'),
  p('Son los **mismos pasos A5 a A9**, con una sola diferencia: todo con la **cuenta de Google de la empresa**.'),
  tabla(['Paso', 'Qué haces', 'Ojo con'], [
    ['A5', 'Nuevo proyecto, pegar `Portal-SSTA.gs`, cambiar las 3 líneas con los datos **de la empresa**', 'Nombre y correos de la empresa, no los tuyos'],
    ['A6', '▶ **instalar** y aceptar permisos', 'Anota su **clave del portal**'],
    ['A7', 'Implementar como **Aplicación web**, **Yo**, **Cualquier usuario**', 'El acceso: **Cualquier usuario**'],
    ['A8', 'Probar la URL `/exec` en Instalar paso a paso', 'Debe decir el nombre de la empresa'],
    ['A9', '▶ **verConfiguracion** y copiar todas las líneas', 'Copia también `clave`, `llaveProveedor` y `scriptId`']
  ], [900, 4960, 3500]),
  h2('B3. Regístrala en tu consola'),
  ...pasos(['En Instalar paso a paso toca **Instalar la empresa en mi consola** (o en la consola, el configurador se abre solo).',
    'Arriba debe decir **«Instalando:»** con el nombre y el código de la empresa.',
    'Escribe el **código** (minúsculas y guiones, por ejemplo `acme-sas`) y los **datos** de la empresa.',
    '**Estándares mínimos 0312:** número de trabajadores y clase de riesgo. El portal dice si le aplican 7, 21 o 60.',
    '**Módulos:** vienen agrupados como se venden: **Base SG-SST** (todos los planes), **Complemento Obra** y **Solo en Integral**. Toca el **plan contratado** («SG-SST Esencial», «SG-SST + Obra» o «Integral»): deja prendido exactamente ese plan. «Obra» (permisos, ATS, preoperacionales, personal autorizado) no se vende solo: va sumado al SG-SST. Si prendes o apagas un módulo suelto, el plan queda «personalizado» (cóbralo como adicional). El panel del asesor es tuyo: no cuenta para el plan.',
    'En **Servidor de la empresa**, pega lo que copiaste en verConfiguracion.',
    'Toca **Guardar en tu consola y publicar**. Al final salen su **enlace** y su **QR**.']),
  dosImagenes('c-06-configurador-cliente.jpg', 'Empresa cliente: su nombre y código quedan a la vista arriba', 'c-07-modulos.jpg', 'Módulos agrupados como se venden', 185),
  ...imagen('c-08-guardar.jpg', 175, '«Guardar en tu consola y publicar»: no hay que subir nada a GitHub'),
  nota('¿No ves «Guardar en tu consola y publicar»?', ['Ese botón solo sale si entraste a tu consola en ese mismo computador. Abre `admin.html`, entra y vuelve a «Instalar empresa nueva».']),
  h2('B4. Pruébalo en un celular'),
  ...pasos(['Abre su enlace (o escanea el QR) en un celular.', 'Arriba toca **Estado**: todo debe salir en **verde**.', 'Haz un **reporte de prueba** y mira que llegue a la hoja de Google de la empresa (carpeta «Portal SSTA - …» en su Drive).']),
  h2('B5. Entrégala'),
  ...vinetas(['El **enlace o el QR** para todos los celulares (que lo agreguen a la pantalla de inicio).',
    'La **clave del portal** (A6), solo a quien la necesite.',
    '**Usuarios:** en el Apps Script de la empresa, ▶ `sgsst__codigoAdministrador`; con ese código, el responsable de SST crea su usuario en **Gestión → Usuarios y respaldo**, y luego crea los de su equipo.']),
  ojo('Obligatorio antes de entregar', ['**Crear el administrador** (paso anterior). Sin administrador, el módulo de salud y el buzón quedan cerrados, y todo lo demás se abre solo con la clave del portal.',
    '**Respaldo fuera de la cuenta:** Apps Script → Configuración del proyecto → Propiedades del script → agrega `RESPALDO_EXTERNO` con un correo de la empresa (otra cuenta, no la dueña de los libros).',
    '**Probar la restauración:** ▶ `sgsst__respaldoSemanal` una vez y luego ▶ `sgsst__probarRestauracion`: debe decir «✓ El respaldo se puede restaurar».']),
  h3('Mantenimiento'),
  ...vinetas(['**Cada mes:** ▶ `sgsst__probarRestauracion` y revisar que llegue el correo del respaldo externo.', '**Cada enero:** ▶ `sgsst__archivoAnualVistaPrevia` y luego ▶ `sgsst__archivarAniosAnteriores`.',
    '**Si se daña algo:** ▶ `sgsst__restaurarDesdeRespaldo` (deja copia de las hojas actuales).', '**Si alguien se va:** desactivar su usuario y, si conocía la clave del portal, ▶ `cambiarClave`.',
    '**Si migras de cuenta:** copia las propiedades del script `API_TOKEN`, `CLAVE_PORTAL`, `SELLO_SECRETO` (sin ella los sellos antiguos de las firmas dejan de verificarse), `LLAVE_PROVEEDOR`, `RESPALDO_EXTERNO`, `CARPETA_RESPALDOS` y `ARCHIVO_LIBRO`.']),
  h3('Lista de chequeo de cada cliente'),
  ...chequeo(['Servidor en la cuenta **de la empresa**', '«¡Funciona!» con el nombre de la empresa', 'Guardada y publicada en mi consola', 'Estado en verde desde un celular', 'Reporte de prueba en su hoja de Google', 'Entregué enlace, QR y clave; creamos el primer usuario', 'RESPALDO_EXTERNO puesto y restauración probada']),
  salto());

// PARTE C
hijos.push(h1('Parte C · Cuando algo sale mal'),
  p('Busca lo que ves en la primera columna. Para pedir ayuda: en el celular, **Estado → Enviar por WhatsApp** (dice qué falla y la dirección del servidor).'),
  tabla(['Lo que ves', 'Por qué pasa', 'Qué hacer'], [
    ['**Todo sale caído** en Estado («No responde» en todos)', 'La aplicación web no está abierta para todos, o falta autorizar.', 'Implementar → Gestionar implementaciones → ✏️ → **Quién tiene acceso: Cualquier usuario** → Implementar. Si sigue: ▶ **instalar** otra vez y acepta los permisos.'],
    ['La URL termina en **/dev**', 'Esa dirección solo le funciona a la cuenta dueña.', 'Usa la que termina en **/exec** (Implementar → Gestionar implementaciones).'],
    ['Al abrir la URL dice **«No se encontró»**', 'Esa implementación ya no existe (se borró o se creó otra).', 'Copia la URL vigente de Gestionar implementaciones y vuelve a guardar la empresa en la consola.'],
    ['Estado dice **«Pide la clave»**', 'El servidor tiene clave y ese celular no la tiene.', 'En el celular, botón **Clave** → escribe la clave del portal.'],
    ['El celular pregunta **«¿De qué empresa eres?»**', 'Ese celular no abrió el enlace de su empresa.', 'Abre el enlace `?e=código` o el QR. En tu marca puedes poner una **empresa principal** que abre sola.'],
    ['«No hay ninguna empresa con el código…»', 'La empresa no se guardó en la consola, o el código está mal escrito.', 'En la consola, revisa que esté y vuelve a **Guardar en tu consola y publicar**.'],
    ['No sale **«Guardar en tu consola y publicar»**', 'No has entrado a tu consola en ese computador.', 'Entra a `admin.html` y vuelve a «Instalar empresa nueva».'],
    ['El portal dice **«Empresa»** sin nombre', 'No cambiaste las 3 líneas de DATOS DE LA EMPRESA antes de instalar.', 'Cámbialas, guarda, ▶ **instalar** otra vez y luego **Gestionar implementaciones → Nueva versión**.'],
    ['**No llegan los correos**', 'Correos de ejemplo, o se acabó el cupo diario de Google.', 'Revisa los correos en DATOS DE LA EMPRESA. En Estado se ve si se llegó al límite (con Gmail gratis es bajo).'],
    ['GitHub dice **«too many files»**', 'Se intentaron subir más de 100 archivos a la vez.', 'Sube por tandas: `1-paginas`, `2-archivos`, `3-solo-la-primera-vez`.']
  ], [2700, 2900, 3760]),
  salto());

// PARTE D · RECETAS
const receta = (n, titulo, donde, guarda) => [h2('Receta ' + n + ' · ' + titulo),
  tabla(['Dónde', '¿Se guarda solo?'], [[donde, guarda]], [5200, 4160], C.suave)];
const comoSe = (items) => [h3('Cómo sé que quedó'), ...vinetas(items)];
hijos.push(h1('Parte D · Recetas: cómo hacer cada cosa'),
  p('Cada receta dice **dónde** se hace, **si se guarda sola** o hay que subir algo, los **pasos uno por uno** y **cómo saber que quedó**. Busca la que necesitas:'),
  tabla(['Quiero…', 'Receta'], [
    ['Pasar a una **versión nueva** (me llegó otro zip)', '**1**'],
    ['**Prender o apagar** lo que ve una empresa (permisos, ATS, preoperacionales, inspecciones…)', '**2**'],
    ['Ponerle **nombre y código** a sus preoperacionales e inspecciones', '**3**'],
    ['Cambiar **logo, color o datos** de una empresa', '**4**'],
    ['Cambiar la **marca de mi sitio** (mi logo, mi producto)', '**5**'],
    ['**Usuarios**: crear, cambiar rol, contraseña olvidada, el primero', '**6**'],
    ['Un celular **pide la clave** del portal', '**7**'],
    ['Cambiar **correos o WhatsApp** que reciben avisos', '**8**'],
    ['**Eliminar** algo que se agregó mal (una persona, una herramienta, varias)', '**9**'],
    ['Activar el **buzón reservado** del Comité de Convivencia (quejas y acoso sexual)', '**10**']
  ], [7560, 1800]),
  salto(),

  // R1
  ...receta(1, 'Pasar a una versión nueva', 'GitHub (siempre) y Apps Script de cada empresa (solo si el CHANGELOG lo pide).', '**No:** hay que subir archivos a GitHub y pegar el servidor.'),
  h3('Paso 1. Mira qué pide'),
  ...pasos(['Descomprime el zip nuevo: clic derecho → **Extraer todo**.', 'Abre `CHANGELOG.md` con el Bloc de notas. Mira **solo el primer título** (la versión nueva) y la línea en negrilla de abajo:']),
  tabla(['Si esa línea dice…', 'Haces'], [
    ['«Actualiza el sitio» (y dice que los servidores no cambian)', 'Solo el **Paso 2**.'],
    ['«Actualiza el sitio … **y los servidores**»', 'El **Paso 2** y el **Paso 3** (en tu servidor y en el de cada empresa).']
  ], [4900, 4460]),
  h3('Paso 2. Las pantallas (GitHub) · una sola vez para todas las empresas'),
  ...pasos(['Abre **github.com** e inicia sesión. Entra a tu repositorio (el del portal).',
    'Arriba, a la derecha de la lista de archivos, toca el botón **Add file** y luego **Upload files**.',
    'En tu computador abre la carpeta del zip nuevo → `PASO-2-SITIO` → `1-paginas`.',
    'Dentro de `1-paginas` presiona **Ctrl + A** (selecciona todo) y **arrastra** los archivos a la página de GitHub, donde dice «Drag files here».',
    'Espera a que la barra de carga termine (todos los archivos aparecen en la lista de abajo).',
    'Baja hasta el final y toca el botón verde **Commit changes**. Espera a que vuelva a la lista de archivos.',
    'Repite los pasos 2 a 6 con la carpeta `2-archivos`.',
    'Espera **2 minutos**. Abre tu sitio en el computador, baja hasta el final de la pantalla: debe decir **«Portal SSTA · versión v…»** con el número nuevo. Si sale el viejo, recarga con **Ctrl + F5**.']),
  ojo('La carpeta 3 NO se sube al actualizar', ['`3-solo-la-primera-vez` trae `empresa.js` y `manifest.json` de fábrica. Si los subes, tu sitio pierde tu logo y tu nombre. Si ya pasó: Receta 5.']),
  nota('Los archivos con el mismo nombre se reemplazan solos', ['No borres nada antes. GitHub cambia los viejos por los nuevos al tocar Commit changes.']),
  h3('Paso 3. El servidor de cada empresa (Apps Script) · solo si el CHANGELOG lo pide'),
  p('Hazlo primero en **tu** servidor y después en el de **cada** empresa. Cada uno se abre con **la cuenta de Google de esa empresa**.'),
  ...pasos(['Abre **script.google.com** (con la cuenta de esa empresa). Toca el proyecto **Portal SSTA**.',
    'A la izquierda, en «Archivos», toca `Código.gs`. Haz clic dentro del código.',
    'Presiona **Ctrl + A** y luego la tecla **Supr** (el editor queda vacío).',
    'En tu computador abre `PASO-1-SERVIDOR/Portal-SSTA.gs` del zip **nuevo** con el Bloc de notas. **Ctrl + A**, **Ctrl + C**.',
    'Vuelve al editor y pega con **Ctrl + V**. Toca el ícono **💾 Guardar** (arriba).',
    'Arriba a la derecha toca el botón azul **Implementar** → **Gestionar implementaciones**.',
    'En la ventana que abre, toca el **lápiz ✏️** (Editar), arriba a la derecha.',
    'En **Versión** abre la lista y elige **Nueva versión**. Toca **Implementar** y luego **Listo**.',
    'Si Google pide permisos: **Revisar permisos** → tu cuenta → **Configuración avanzada** → **Ir a Portal SSTA** → **Permitir**.']),
  ojo('Tres cosas que NO se hacen al actualizar', ['**No** cambies las líneas de DATOS DE LA EMPRESA (quedaron guardadas al instalar).', '**No** ejecutes «instalar».', '**No** uses «Nueva implementación»: crea otra dirección y los celulares quedan apuntando a la vieja.']),
  ...comoSe(['En tu consola toca **Revisar todos los servidores**: cada empresa dice **«servidor v… · al día»**. Si dice **«por actualizar»**, a esa le falta el Paso 3.',
    'En los celulares no haces nada: al abrir el portal les sale **«Hay una versión nueva del portal disponible» → Actualizar ahora**.']),
  nota('Con varias empresas: no pegues el servidor una por una', ['Desde la carpeta `avanzado/sitio-de-tu-marca`, con Node y clasp instalados: `node herramientas/actualizar-servidores.js clientes.json --estado` te dice en qué versión va cada empresa, y el mismo comando sin `--estado` las actualiza todas.', 'Para una empresa nueva, `node herramientas/instalar-empresa.js` crea su servidor y la anota en esa lista. Los pasos están en `INSTALAR-NUEVA-EMPRESA.md`.']),
  ...chequeo(['Leí el CHANGELOG', 'Subí `1-paginas` (Commit changes)', 'Subí `2-archivos` (Commit changes)', 'NO subí la carpeta 3', 'Al final de las pantallas sale la versión nueva', 'Si lo pedía: pegué el servidor en mi Apps Script y en el de cada empresa (Nueva versión)', '«Revisar todos»: todas «al día»']),
  salto(),

  // R2
  ...receta(2, 'Prender o apagar lo que ve una empresa', 'Tu consola (`admin.html`) → botón **Menús** de la empresa.', '**Sí.** Al tocar «Guardar y publicar» queda en tu servidor. **No se descarga ningún .json ni se sube nada a GitHub.**'),
  ...pasos(['Abre tu consola: `tu-sitio/admin.html` (está en tus favoritos). Si pide, entra con tu usuario.',
    'Busca la empresa en la lista (puedes escribir su nombre en el buscador).',
    'En la tarjeta de la empresa toca **Menús**. Se abre una ventana con estas partes:',
    '**Módulos del menú**: por grupos (En obra, Personas, Planear…). Toca un grupo para abrirlo y marca o desmarca cada casilla. «Todos / Ninguno» marca el grupo completo.',
    '**Preoperacionales**: los que salen en la tarjeta Preoperacional del inicio.',
    '**Listas de inspección**: las que se pueden escoger en Inspecciones planeadas.',
    '**Tipos de reporte**: lo que sale en «Reportar» (acto seguro, acto inseguro, condición, ambiental, incidente, accidente, PQRS, queja al comité, acoso sexual). El accidente de trabajo viene apagado.',
    '**Ayuda**: las guías que ven. Además, la ayuda solo muestra las de los módulos que la empresa tiene prendidos.',
    'Al terminar, toca **Guardar y publicar** (botón azul de abajo). Sale «✓ Guardado y publicado».']),
  ...imagen('c-09-consola-menus.jpg', 520, 'La tarjeta de cada empresa en tu consola: el botón «Menús»'),
  ...imagen('c-10-menus.jpg', 330, 'La ventana «Menús»: aquí se apagaron los permisos y el ATS'),
  tabla(['Si apagas…', 'Pasa esto en el portal de la empresa'], [
    ['Los 5 permisos (caliente, alturas, confinados, izajes, eléctrico)', 'Desaparece «Permisos» de la barra de abajo, de Gestión y del tablero.'],
    ['ATS', 'Desaparece de Gestión y del inicio.'],
    ['Un preoperacional', 'No sale en la tarjeta Preoperacional y no abre aunque alguien tenga el enlace.'],
    ['Una lista de inspección', 'No se puede escoger para inspecciones nuevas.']
  ], [3800, 5560]),
  nota('Nada se borra', ['Lo que ya estaba registrado se sigue viendo e imprimiendo. Si lo vuelves a prender, aparece igual que antes.']),
  ...comoSe(['Abre el portal de esa empresa en un celular (su enlace o QR). En el **inicio** se actualiza solo en segundos; en las demás pantallas, la próxima vez que se abran.',
    'Si el botón **Menús** sale gris: esa empresa tiene su propio GitHub. Se cambia en **su** `configurar-empresa.html`, en «Módulos que usará», y luego **Descargar empresa.js** y subirlo a **su** GitHub.']),
  salto(),

  // R3
  ...receta(3, 'Ponerle nombre y código a sus preoperacionales e inspecciones', 'Tu consola → **Menús** de la empresa → partes «Preoperacionales» y «Listas de inspección».', '**Sí**, igual que la Receta 2.'),
  p('Los preoperacionales del portal vienen **sin código**, porque cada empresa tiene el suyo en su listado maestro de documentos. Tú se lo pones:'),
  ...pasos(['Consola → empresa → **Menús**.',
    'Baja a **Preoperacionales** y abre un grupo (por ejemplo «Herramientas y equipos»).',
    'Debajo de cada uno hay dos cajas: **Nombre en esta empresa** (opcional) y **Código**. Escribe, por ejemplo: `Inspección preoperacional pulidora` y `SST-F-015`.',
    'Haz lo mismo con los que quieras en **Listas de inspección**.',
    'Toca **Guardar y publicar**.']),
  ...imagen('c-11-nombre-codigo.jpg', 330, 'Debajo de cada preoperacional: el nombre y el código de esa empresa'),
  ...vinetas(['Si dejas el **nombre vacío**, sale el nombre que trae el portal.', 'Si dejas el **código vacío**, el formato sale sin código.', 'El nombre y el código salen en el inicio, en el formulario y en el **PDF**.']),
  ...comoSe(['En el celular de la empresa, toca **Preoperacional** en el inicio: cada uno sale con el nombre y el código que escribiste.']),

  // R4
  ...receta(4, 'Cambiar logo, color o datos de una empresa', 'Tu consola → botón **Editar todo** de la empresa.', '**Sí**, con «Guardar en tu consola y publicar».'),
  ...pasos(['Consola → empresa → **Editar todo**. Se abre el configurador con sus datos (arriba sale «Instalando:» con su nombre).',
    'Cambia lo que necesites: **Logo**, **Color de la marca**, **Razón social**, **Centros de costo / clientes** (uno por línea), **Estándares mínimos 0312**, **Códigos de los formatos**.',
    'Baja hasta el final y toca **Guardar en tu consola y publicar**.']),
  ...comoSe(['Abre su enlace en un celular: el inicio se actualiza solo.']),
  salto(),

  // R5
  ...receta(5, 'Cambiar la marca de mi sitio', '`tu-sitio/configurar-empresa.html` → **Tu sitio multiempresa**.', '**No:** se descargan 2 archivos y se suben a GitHub.'),
  ...pasos(['Abre `tu-sitio/configurar-empresa.html` y elige **Tu sitio multiempresa (tu marca)** (arriba: «Instalando: tu sitio»).',
    'Cambia nombre del producto, logo, color o la **empresa principal**.',
    'Toca **Descargar empresa.js** y **Descargar manifest.json** (quedan en tu carpeta Descargas).',
    'En GitHub: **Add file → Upload files**, arrastra esos **2 archivos** y toca **Commit changes**.',
    'Espera 2 minutos y recarga tu sitio con **Ctrl + F5**.']),

  // R6
  ...receta(6, 'Usuarios', 'En el portal de la empresa: **Gestión → Usuarios y respaldo** (entra el responsable de SST).', '**Sí.**'),
  tabla(['Quiero…', 'Pasos'], [
    ['Crear un usuario', 'Usuarios y respaldo → **+ Nuevo usuario** → nombre, usuario y rol → Guardar. Sale una **clave temporal**: dásela a la persona; al entrar la cambia por una suya.'],
    ['Cambiar el rol de alguien', 'Usuarios y respaldo → toca a la persona → cambia el rol → Guardar.'],
    ['Olvidó su contraseña', 'Usuarios y respaldo → toca a la persona → **Nueva clave temporal** → dásela.'],
    ['Nadie puede entrar (el primer usuario)', 'En Apps Script de la empresa: lista de funciones → `sgsst__codigoAdministrador` → ▶ Ejecutar → copia el código. En el portal: Gestión → Usuarios y respaldo → pega el código y crea el primer usuario.']
  ], [2600, 6760]),
  salto(),

  // R7
  ...receta(7, 'Un celular pide la clave del portal', 'El celular → botón **Clave**. La clave se ve en Apps Script → `verConfiguracion`.', '**Sí** (queda en ese celular).'),
  ...pasos(['En Apps Script de la empresa: lista de funciones → **verConfiguracion** → ▶ Ejecutar. En el registro, la línea `clave:` (por ejemplo `KQRT-4827`).',
    'En el celular toca **Clave**, escríbela y toca Guardar.']),
  nota('Si la empresa ya tiene usuarios', ['Con usuarios creados (Receta 6), los celulares ya no piden la clave: cada persona entra con su usuario.']),

  // R8
  ...receta(8, 'Cambiar correos o WhatsApp que reciben avisos', 'Apps Script de la empresa → arriba del código, DATOS DE LA EMPRESA.', '**No del todo:** se guarda, se ejecuta «instalar» y se hace Nueva versión.'),
  ...pasos(['Abre su proyecto en **script.google.com**.',
    'Arriba del código, en **DATOS DE LA EMPRESA**, cambia solo lo que está entre comillas (correos, WhatsApp).',
    'Toca **💾 Guardar**. En la lista de funciones elige **instalar** → ▶ Ejecutar (vuelve a leer esos datos; no borra nada).',
    '**Implementar → Gestionar implementaciones → ✏️ → Nueva versión → Implementar.**']),

  // R9
  ...receta(9, 'Eliminar algo que se agregó mal', 'En el portal de la empresa, en la lista donde está (solo usuarios SST o Administrador).', '**Sí.**'),
  h3('Una sola cosa'),
  ...pasos(['Abre lo que quieres eliminar (la persona, el equipo, la entrega o el preoperacional).', 'Abajo toca **Eliminar** (letra roja).', 'Escribe por qué (opcional) y toca **Eliminar** otra vez.']),
  h3('Varias a la vez'),
  ...pasos(['En la lista (Personal habilitado, Inventario de inspecciones, Entregas de EPP o Registros del preoperacional), arriba a la derecha toca **Seleccionar para eliminar**.',
    'Toca cada cosa que quieres quitar: se marca en rojo. Abajo sale cuántas llevas; **Todos** las marca todas.',
    'Toca **Eliminar** en la barra de abajo, escribe por qué (opcional) y confirma.',
    'Para salir sin eliminar: **Cancelar**.']),
  nota('No se pierde nada', ['Lo eliminado deja de salir en las listas, pero queda guardado en la hoja de Google con la fecha, el motivo y quién lo eliminó. Las inspecciones viejas de un equipo eliminado se siguen viendo en el historial.']),

  // R10
  ...receta(10, 'Activar el buzón reservado del comité', 'En el portal de la empresa: Gestión → Comité de Convivencia → pestaña **Buzón** (con la clave del comité).', '**Sí.** Una sola vez.'),
  p('Con el buzón, cualquier trabajador presenta su **queja de convivencia** o su **reporte de acoso sexual** desde el inicio (Reportar), sin usuario. Lo que escribe y sus evidencias se cifran en su celular: solo el comité, con su clave, lo puede leer.'),
  ...pasos(['Un integrante del comité entra al portal: **Gestión → Comité de Convivencia**.', 'Toca la pestaña **Buzón** y escribe la **clave del comité**. El buzón se activa solo.',
    'Escribe el **correo del comité** y toca **Guardar el correo**. Sale en los formularios y ahí llega el aviso de que entró algo (sin el contenido).',
    'Comparte los dos enlaces que salen ahí (cartelera, correo, QR). También están en el inicio, en **Reportar**.']),
  h3('Cuando llega algo'),
  ...pasos(['Llega un correo: «Buzón del comité: llegó una queja… (código)».', 'Entra a **Comité de Convivencia → Buzón** con la clave y toca lo que llegó: se ve completo, con las evidencias para descargar.',
    'Toca **Registrar como queja del comité**: se abre la queja ya llena. Revisa, completa y guarda. Desde ahí corren los plazos.', 'Si no procede, **Archivar sin registrar** (con el motivo).']),
  ojo('El acoso sexual no lo concilia el comité', ['El comité **no es competente** en acoso sexual (Res. 3461 de 2025, art. 6, par. 1). Al registrarlo queda como **remitido** a la instancia que defina el protocolo de la empresa (Ley 2365 de 2024). Si el presunto agresor es un superior, va al inspector de trabajo.']),
  salto());

// Hoja de datos
hijos.push(h1('Hoja de datos de cada cliente'),
  p('Imprímela y llénala por cada empresa. Guárdala en un lugar seguro: tiene la clave del portal.'),
  tabla(['Dato', 'Valor'], [
    ['Empresa (razón social)', ''], ['NIT', ''], ['Código en tu sitio (ej. acme-sas)', ''], ['Enlace para los celulares', 'https://…/?e='],
    ['Cuenta de Google de la empresa', ''], ['URL del servidor (/exec)', ''], ['Clave del portal', ''], ['Trabajadores / clase de riesgo / estándares 0312', '        /         /'],
    ['Plan contratado y tramo', '☐ SG-SST Esencial   ☐ SG-SST + Obra   ☐ Integral   ☐ Personalizado    Trabajadores: ____ (T1–T4)'], ['Responsable SST (nombre, correo, celular)', ''], ['Fecha de instalación', ''], ['Primer usuario creado', '☐ Sí']
  ], [4200, 5160]),
  espacio(300),
  p('Para revisar con un abogado antes de vender: `avanzado/sitio-de-tu-marca/LEGAL-DATOS-PERSONALES.md` (contrato de transmisión de datos, Ley 1581 de 2012). Esta guía no es asesoría legal.', { run: { size: 20, color: C.suave } }));

const doc = new Document({
  creator: 'Portal SSTA', title: 'Cómo instalar el Portal SSTA', description: 'Guía paso a paso v' + VERSION,
  styles: { default: { document: { run: { font: 'Calibri', size: 24 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 40, bold: true, font: 'Calibri' }, paragraph: { spacing: { before: 120, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: 'Calibri' }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 26, bold: true, font: 'Calibri' }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } }] },
  numbering: { config: [
    { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } }, run: { bold: true, color: C.azul } } }] },
    { reference: 'vin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [t('Portal SSTA · Cómo instalarlo · página ', { size: 18, color: C.suave }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.suave, font: 'Calibri' })] })] }) },
    children: hijos
  }]
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(SALIDA, buf); console.log('Guía: ' + SALIDA + ' (' + Math.round(buf.length / 1024) + ' KB)'); });
