/* ============================================================
   sw.js — Service Worker del Portal SSTA — v2
   Cambios sobre v1:
   - Página offline.html personalizada (en vez de pantalla en blanco
     del navegador cuando no hay caché de la página pedida).
   - Notificación de actualización: NO se activa solo (skipWaiting)
     al instalar; espera a que el usuario confirme desde el banner
     que muestra common.js, para no interrumpirlo a media captura
     de un permiso.
   - Background Sync: si el navegador lo soporta, cuando vuelve la
     señal se dispara automáticamente el reintento de la cola de
     permisos pendientes (ver Outbox en common.js), sin que el
     usuario tenga que volver a abrir la página.
   - Estrategias diferenciadas: los recursos estáticos (css/js/íconos)
     usan "cache first" (no cambian seguido, cargan al instante);
     las páginas HTML siguen en "network first" (para traer siempre
     la versión más nueva del formulario cuando hay señal).
   ============================================================ */

const CACHE_NAME = 'ssta-portal-v174';

const PAGES = [
  './',
  './index.html',
  './permiso-trabajo-alturas.html',
  './permiso-trabajo-caliente.html',
  './permiso-espacios-confinados.html',
  './permiso-izajes-cargas.html',
  './permiso-trabajo-electrico.html',
  './personal-autorizado.html',
  './asistencia.html',
  './estado.html',
  './configurar-empresa.html',
  './habilitacion.html',
  './reportes.html',
  './plan-accion.html',
  './indicadores.html',
  './inspecciones.html',
  './inspeccion-epp.html',
  './ats.html',
  './dashboard.html'
];
const STATIC_ASSETS = [
  './empresa.js',
  './empresa-motor.js',
  './sgsst.css',
  './sgsst-ui.js',
  './inspecciones-plantillas.js',
  './copasst.html',
  './convivencia.html',
  './auditorias.html',
  './comites.js',
  './cifrado.js',
  './auditorias-plantillas.js',
  './registros.js',
  './importar.js',
  './fflate.min.js',
  './normas-base.js',
  './plan-anual.html',
  './plan-sugerido.js',
  './cierre-mes.html',
  './preoperacional.html',
  './preop-formularios.js',
  './preop-base.js',
  './menus-empresa.js',
  './buzon.html',
  './ayuda-guias.js',
  './dialogo.js',
  './evidencias.html',
  './evidencias-reglas.js',
  './peligros.html',
  './emergencias.html',
  './salud.html',
  './documental.html',
  './revision-direccion.html',
  './contratistas.html',
  './usuarios.html',
  './entrega-epp.html',
  './induccion.html',
  './induccion-responder.html',
  './firmar-acta.html',
  './dotacion.html',
  './paquete-cliente.html',
  './areas.html',
  './pve.html',
  './persona.html',
  './analitica.html',
  './equipo.html',
  './bitacora.html',
  './presupuesto.html', './presupuesto.app.js',
  './empezar.html', './empezar.app.js', './empezar-reglas.js', './guia-preguntas.js', './agenda-tareas.js',
  './auditor-enlaces.js',
  './informe-mes.html', './informe-mes.app.js', './informe-mes-reglas.js', './pantalla-planta.html', './pantalla-planta.app.js', './i18n.js', './i18n-en.js',
  './ficha.html',
  './verificar.html',
  './habeas.html',
  './auditor.html',
  './mis-avisos.html',
  './normograma.html',
  './licencia.html',
  './licencia.js',
  './contratista-portal.html',
  './contratistas-docs.js',
  './ats.app.js',
  './reportes.app.js',
  './inspecciones.app.js',
  './proveedores.app.js',
  './induccion-banco.js',
  './autorizacion-datos.js',
  './programas.html',
  './pesv.html',
  './gerencia.html',
  './ambiental.html',
  './quimicos.html',
  './documentos.html',
  './calidad.html',
  './ayuda.html',
  './fonts/plex-sans-400.woff2',
  './fonts/plex-sans-500.woff2',
  './fonts/plex-sans-600.woff2',
  './fonts/manrope-latin-500-normal.woff2',
  './fonts/manrope-latin-600-normal.woff2',
  './fonts/manrope-latin-700-normal.woff2',
  './fonts/manrope-latin-800-normal.woff2',
  './fonts/ibm-plex-mono-latin-600-normal.woff2',
  './kit-documental.js',
  './valida.js',
  './comite-emergencias.html',
  './percepcion-peligros.html',
  './encuesta-cliente.html',
  './proveedores.html',
  './proveedores-catalogo.js',
  './gtc45-catalogo.js',
  './informe.html',
  './informe-reglas.js',
  './asesor.html',
  './admin.html',
  './instalar.html',
  './privacidad.html',
  './terminos.html',
  './etiquetas-qr.html',
  './papelera.html',
  './accesibilidad.html',
  './matrices-iso.html',
  './medevac.html',
  './404.html',
  './og.png',
  './consola.css',
  './config.js',
  './common.css',
  './common.js',
  './iconos-emoji.js',
  './permiso-core.js',
  './qr.js',
  './ats-catalogo.js',
  './logo-empresa.svg',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
const OFFLINE_PAGE = './offline.html';
const APP_SHELL = [...PAGES, ...STATIC_ASSETS, OFFLINE_PAGE];
/* v144: en la PRIMERA visita solo se descarga el núcleo de obra (≈ lo que usa un trabajador o supervisor
   en campo). Antes se bajaban 107 archivos (≈1,2 MB) por datos móviles. El resto se guarda al abrirlo
   y, si el celular está en wifi y sin «ahorro de datos», se completa en segundo plano. */
const NUCLEO = ['./', './index.html', './preoperacional.html', './reportes.html', './ats.html', './medevac.html', './buzon.html',
  './permiso-trabajo-alturas.html', './permiso-trabajo-caliente.html', './permiso-espacios-confinados.html', './permiso-izajes-cargas.html', './permiso-trabajo-electrico.html',
  './personal-autorizado.html', './asistencia.html', './dashboard.html', './ayuda.html', OFFLINE_PAGE,
  './common.css', './common.js', './config.js', './empresa.js', './empresa-motor.js', './dialogo.js', './valida.js', './iconos-emoji.js', './sgsst.css', './sgsst-ui.js',
  './permiso-core.js', './qr.js', './preop-formularios.js', './preop-base.js', './ats-catalogo.js', './ayuda-guias.js', './manifest.json', './icon-192.png', './logo-empresa.svg',
  './fonts/plex-sans-400.woff2', './fonts/plex-sans-600.woff2', './empezar-reglas.js', './guia-preguntas.js', './agenda-tareas.js',
  /* v163: el JS propio de cada pantalla del núcleo (sin esto, ATS y Reportes abrían sin su código en la primera instalación sin señal) */
  './ats.app.js', './reportes.app.js', './registros.js', './cifrado.js', './licencia.js'];
const RESTO = APP_SHELL.filter((u) => NUCLEO.indexOf(u) === -1 && !/og\.png$|icon-512/.test(u));
function datosBaratos() { const c = self.navigator && self.navigator.connection; return !!c && !c.saveData && (c.type === 'wifi' || c.type === 'ethernet'); }
// v145: siempre la copia nueva del servidor (no la de la caché HTTP del navegador), para no guardar un archivo viejo toda la versión.
const fresco = (url) => new Request(url, { cache: 'reload' });
function guardarTodos(lista) { return caches.open(CACHE_NAME).then((cache) => Promise.all(lista.map((url) => cache.match(url).then((ya) => ya || fetch(fresco(url)).then((r) => { if (r && r.ok) return cache.put(url, r); })).catch(() => {})))); }

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        NUCLEO.map((url) => fetch(fresco(url)).then((r) => { if (r && r.ok) return cache.put(url, r); }).catch(() => {
          /* archivo individual no disponible; se omite sin afectar al resto */
        }))
      )
    )
  );
  // Ya NO se llama self.skipWaiting() aquí. El SW nuevo se queda "esperando"
  // hasta que el usuario acepte actualizar (ver mensaje SKIP_WAITING abajo),
  // para no cortarle a alguien un permiso a medio llenar.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
  // v145: el resto se baja DESPUÉS de activar (antes la actualización esperaba a que bajaran ~70 archivos)
  if (datosBaratos()) setTimeout(() => guardarTodos(RESTO), 5000);
});

// El usuario confirmó desde el banner de "nueva versión disponible"
// (común.js envía este mensaje) → recién ahí se activa el nuevo SW.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isOwnOrigin = url.origin === self.location.origin;
  const isBackendCall = url.hostname.includes('script.google.com');

  // Tipografías de Google (la hoja de estilos y los archivos .woff2).
  // Sin esto, en planta sin señal el portal caía a la tipografía del sistema:
  // cambiaba el ancho de todo, los textos se reacomodaban y la app se veía
  // distinta justo donde más se usa. Se guardan la primera vez que hay señal
  // y de ahí en adelante se sirven desde la caché, con la red solo como
  // respaldo — las fuentes no cambian, así que no hay nada que refrescar.
  const isFuente = url.hostname === 'fonts.googleapis.com' ||
                   url.hostname === 'fonts.gstatic.com';
  if (isFuente && req.method === 'GET') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // Las respuestas de gstatic son opacas (no-cors); igual se guardan,
          // que es justo lo que permite que la fuente aparezca sin señal.
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  if (!isOwnOrigin || isBackendCall || req.method !== 'GET') {
    return; // deja pasar tal cual (red real, sin caché)
  }
  // Datos de cada empresa (sitio multiempresa): siempre de la red; el celular
  // ya los guarda aparte para abrir sin señal.
  if (url.pathname.indexOf('/empresas/') !== -1) return;

  const isNavigation = req.mode === 'navigate' || PAGES.some(p => {
    const rel = p.replace('./', '');
    return rel !== '' && url.pathname.endsWith(rel);
  });

  if (isNavigation) {
    // Páginas: la red primero, pero con señal débil no se espera más de 3,5 s: si hay copia guardada se
    // muestra esa (y la red la actualiza para la próxima). v144: antes la pantalla quedaba en blanco
    // hasta que la red fallara. Las URL con parámetros (?empresa=, QR) encuentran su página sin señal.
    const red = fetch(req).then((res) => {
      if (res && res.ok) { const clone = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)); }
      return res;
    });
    const copia = () => caches.match(req).then((c) => c || caches.match(req, { ignoreSearch: true }));
    event.respondWith(new Promise((resolver) => {
      let listo = false;
      const dar = (r) => { if (!listo && r) { listo = true; resolver(r); } };
      const t = setTimeout(() => copia().then(dar), 3500);
      red.then((r) => { clearTimeout(t); dar(r); }).catch(() => { clearTimeout(t); copia().then((c) => { if (c) dar(c); else caches.match(OFFLINE_PAGE).then((o) => dar(o || Response.error())); }); });
    }));
  } else {
    // Estáticos (css/js/íconos): de la caché, sin volver a pedirlos. v144: antes se pedían a la red en cada
    // apertura (gastaba datos); la caché se renueva sola en cada versión (CACHE_NAME cambia).
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.ok) { const clone = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)); }
        return res;
      }))
    );
  }
});

// Background Sync: se dispara solo cuando vuelve la señal, aunque la
// pestaña ya esté cerrada. Le avisa a la(s) página(s) abiertas para que
// reintenten el envío desde el Outbox (IndexedDB) — el SW no guarda el
// token/URL del backend, por eso delega el reintento real a common.js.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-outbox') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((c) => c.postMessage('TRY_FLUSH_OUTBOX'));
      })
    );
  }
});
