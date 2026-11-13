/* ============================================================
   config.js — Configuración centralizada del Portal SSTA
   ------------------------------------------------------------
   Antes, cada URL de backend estaba repetida en varios archivos
   (hasta 8 lugares para una sola URL) — cambiar un despliegue de
   Apps Script significaba editar y volver a subir 8 archivos.
   Ahora todo vive aquí, en un solo lugar. Los 8 archivos que lo
   usan (los 5 permisos, el anexo, index.html y dashboard.html)
   solo LEEN de este objeto, nunca vuelven a declarar la URL.

   Este archivo también queda en caché del Service Worker (ver
   sw.js), así que sigue disponible sin conexión igual que antes.
   ============================================================ */

const PORTAL_CONFIG = {
  // Token único para todos los backends. Debe ser IDÉNTICO al
  // API_TOKEN que tiene cada uno de los 6 archivos .gs desplegados.
  API_TOKEN: 'PON-AQUI-EL-TOKEN',

  BACKENDS: {
    caliente: {
      nombre: 'Trabajo en Caliente',
      icono: '🔥',
      archivo: 'permiso-trabajo-caliente.html',
      url: '',
      listQuery: 'list=1'
    },
    alturas: {
      nombre: 'Trabajo en Alturas',
      icono: '🧗',
      archivo: 'permiso-trabajo-alturas.html',
      url: '',
      listQuery: 'list=1'
    },
    confinados: {
      nombre: 'Espacios Confinados',
      icono: '🕳️',
      archivo: 'permiso-espacios-confinados.html',
      url: '',
      listQuery: 'list=1'
    },
    izajes: {
      nombre: 'Izajes de Cargas',
      icono: '🏗️',
      archivo: 'permiso-izajes-cargas.html',
      url: '',
      listQuery: 'list=1'
    },
    electrico: {
      nombre: 'Trabajo Eléctrico',
      icono: '⚡',
      archivo: 'permiso-trabajo-electrico.html',
      url: '',
      listQuery: 'list=1'
    },
    epp: {
      nombre: 'Inspección de EPP',
      icono: '🦺',
      archivo: 'inspeccion-epp.html',
      url: '',
      listQuery: 'list=1'
    },
    ats: {
      nombre: 'ATS - Análisis de Trabajo Seguro',
      icono: '🧭',
      archivo: 'ats.html',
      // URL /exec del Apps Script backends/backend-ats.gs. Si se deja vacía,
      // el ATS funciona igual pero solo se guarda en el dispositivo (y se
      // entrega impreso o en PDF).
      url: ''
    },
    asistencia: {
      nombre: 'Asistencia a charlas',
      icono: '🗣️',
      archivo: 'asistencia.html',
      // URL /exec del Apps Script backends/backend-asistencia.gs (SSTA-F-005).
      // Mientras esté vacía, la asistencia funciona en MODO SOLO-EQUIPO: se
      // guarda en el celular y se imprime o guarda en PDF, pero no se comparte.
      url: ''
    },
    sgsst: {
      nombre: 'Gestión SG-SST',
      icono: '📋',
      archivo: 'plan-accion.html',
      // URL /exec del Apps Script backends/backend-sgsst.gs: personal habilitado,
      // reportes, plan de acción, indicadores, inspecciones, COPASST, Comité de
      // Convivencia, auditorías, plan anual, matriz de peligros, emergencias,
      // salud, documental y revisión por la dirección. Mientras esté vacía, esos módulos muestran
      // cómo configurarlo.
      url: ''
    },
    personal: {
      nombre: 'Personal Autorizado',
      icono: '👷',
      archivo: 'personal-autorizado.html',
      url: ''
      // Nota: personal.gs no usa listQuery — su endpoint de listado es ?action=listPersonal
    }
  }
};

/**
 * Devuelve el mismo arreglo PERMIT_BACKENDS que antes vivía copiado
 * en index.html, dashboard.html y personal-autorizado.html — pero
 * calculado desde PORTAL_CONFIG, así nunca se puede desactualizar
 * un archivo y no los demás.
 * @param {boolean} incluirPersonal — si se debe incluir el anexo en la lista
 */
function getPermitBackends(incluirPersonal){
  const claves = (incluirPersonal
    ? ['caliente','alturas','confinados','izajes','electrico','personal']
    : ['caliente','alturas','confinados','izajes','electrico'])
    .filter(k => typeof Empresa === 'undefined' || Empresa.moduloActivo(k));   // módulos apagados en empresa.js
  return claves.map(k => Object.assign({ token: PORTAL_CONFIG.API_TOKEN }, PORTAL_CONFIG.BACKENDS[k]));
}

/* Otra empresa (empresa.js): un solo Apps Script con todos los módulos.
   Cada módulo responde en <servidor>/<módulo>, p. ej. .../exec/ats. */
(function(){
  if (typeof EMPRESA === 'undefined') return;
  // Sitio multiempresa sin empresa elegida: no se habla con ningún servidor hasta escribir el código.
  if (EMPRESA.sinEmpresa) { PORTAL_CONFIG.API_TOKEN = ''; Object.keys(PORTAL_CONFIG.BACKENDS).forEach(k => { PORTAL_CONFIG.BACKENDS[k].url = ''; }); return; }
  if (EMPRESA.apiToken) PORTAL_CONFIG.API_TOKEN = EMPRESA.apiToken;
  if (EMPRESA.servidor) {
    const base = String(EMPRESA.servidor).replace(/\/+$/, '');
    Object.keys(PORTAL_CONFIG.BACKENDS).forEach(k => { PORTAL_CONFIG.BACKENDS[k].url = base + '/' + k; });
  }
})();
