/* ============================================================
   pantalla-planta.app.js — El tablero para el televisor de la planta (v169)
   ------------------------------------------------------------
   Sin «k» en el enlace: SST crea aquí el enlace del televisor (con QR).
   Con «k»: modo televisor. Pide al servidor solo cifras (días sin accidentes,
   récord, reportes del mes, acciones vencidas, inspecciones), se actualiza cada
   5 minutos, guarda la última lectura para seguir mostrando algo si se cae la
   red, mantiene la pantalla encendida y rota mensajes de seguridad.
   Con ?lang=en sale en inglés (i18n.js).
   ============================================================ */
OfflineBanner.init();
const $ = UI.$;
const Q = new URLSearchParams(location.search),
  K = Q.get('k') || '';
const CACHE = 'ssta-pantalla-' + (Q.get('e') || '');
const MENSAJES = [
  'Si no es seguro, no se hace. Tienes derecho a parar un trabajo inseguro.',
  'Reporta los actos y condiciones inseguras: cada reporte evita un accidente.',
  'En alturas, el arnés se conecta siempre a un punto de anclaje certificado.',
  'Usa los elementos de protección personal completos durante toda la tarea.',
  'Antes de empezar: haz el ATS y revisa el preoperacional del equipo.',
  'Orden y aseo: un pasillo despejado es un pasillo seguro.',
  'Levanta las cargas con las piernas, no con la espalda. Pide ayuda si pesa.',
  'Conoce tu ruta de evacuación y el punto de encuentro.',
  'Un incidente es un aviso: repórtalo aunque nadie haya salido herido.',
  'Haz las pausas activas: tu cuerpo también es tu herramienta de trabajo.',
  'Nunca anules un dispositivo de seguridad de una máquina.',
  'Bloquea y etiqueta la energía antes de intervenir un equipo.',
];

/* ── Modo configuración: crear el enlace ── */
function rolSst() {
  const r = typeof Sesion !== 'undefined' && Sesion.rol ? Sesion.rol() : '';
  return !r || r === 'admin' || r === 'sst';
}
async function crearEnlace(nuevo) {
  if (UI.avisoServidor($('avisoSrv'))) return;
  if (!rolSst()) {
    $('enlace').innerHTML = '<div class="aviso info">El enlace del televisor lo crea el administrador o el área SST.</div>';
    return;
  }
  let r;
  try {
    r = await SGSST.consultar({ action: 'enlacePantalla', nuevo: nuevo ? '1' : '0' });
  } catch (e) {
    r = { ok: false, error: 'Necesita señal.' };
  }
  if (!r.ok) {
    $('enlace').innerHTML = '<div class="aviso mal">' + esc(r.error || 'No se pudo crear el enlace.') + '</div>';
    return;
  }
  const e = Q.get('e'),
    base = location.href.split(/[?#]/)[0];
  const url = base + '?' + (e ? 'e=' + encodeURIComponent(e) + '&' : '') + 'k=' + encodeURIComponent(r.k) + ($('enIngles').checked ? '&lang=en' : '');
  $('enlace').innerHTML =
    '<div class="card"><h2>Enlace del televisor</h2><canvas id="qrTv" width="160" height="160"></canvas>' +
    '<p class="ayuda u-mt8" style="word-break:break-all">' +
    esc(url) +
    '</p><div class="fila-btn"><button type="button" class="btn ghost" id="tvCopiar">📋 Copiar enlace</button>' +
    '<a class="btn ghost" href="' +
    esc(url) +
    '" target="_blank" rel="noopener">Ver la pantalla</a><button type="button" class="btn ghost" id="tvNuevo">Cambiar el enlace</button></div>' +
    '<p class="ayuda">Cambiar el enlace deja sin servicio el anterior (por ejemplo, si el televisor se cambia de sitio).</p></div>';
  try {
    QR.dibujar($('qrTv'), url, { px: 160, margen: 2 });
  } catch (x) {
    $('qrTv').remove();
  }
  $('tvCopiar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      $('tvCopiar').textContent = '✓ Copiado';
    } catch (x) {}
  });
  $('tvNuevo').addEventListener('click', async () => {
    if (await Dialogo.confirmar('¿Cambiar el enlace? El televisor que tenga el anterior deja de actualizarse.')) crearEnlace(true);
  });
}

/* ── Modo televisor ── */
const fmtFecha = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString(I18N.idioma() === 'en' ? 'en-US' : 'es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (e) {
    return iso;
  }
};
function reloj() {
  const d = new Date(),
    loc = I18N.idioma() === 'en' ? 'en-US' : 'es-CO';
  $('tvHora').textContent = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  $('tvFecha').textContent = d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
}
function pintar(d, viejo) {
  if (d.empresa) $('tvEmp').textContent = d.empresa;
  const sin = d.diasSinAccidente;
  $('tvDias').textContent = sin === null || sin === undefined ? '—' : String(sin);
  $('tvLbl').textContent = I18N.t(sin === 1 ? 'día sin accidentes de trabajo' : 'días sin accidentes de trabajo');
  $('tvHeroe').classList.toggle('mal', sin !== null && sin !== undefined && sin < 7);
  $('tvDet').textContent =
    sin === null || sin === undefined
      ? I18N.t('No hay accidentes de trabajo registrados.')
      : I18N.t('Récord') +
        ': ' +
        d.record +
        ' ' +
        I18N.t(d.record === 1 ? 'día' : 'días') +
        ' · ' +
        I18N.t('Último accidente') +
        ': ' +
        fmtFecha(d.ultimoAccidente);
  const r = d.reportesMes || {};
  $('tvRep').textContent = String(r.total || 0);
  $('tvRepD').textContent =
    [
      [r.actos, r.actos === 1 ? 'acto inseguro' : 'actos inseguros'],
      [r.condiciones, r.condiciones === 1 ? 'condición insegura' : 'condiciones inseguras'],
      [r.incidentes, r.incidentes === 1 ? 'incidente' : 'incidentes'],
      [r.accidentes, r.accidentes === 1 ? 'accidente' : 'accidentes'],
    ]
      .filter((x) => x[0])
      .map((x) => x[0] + ' ' + I18N.t(x[1]))
      .join(' · ') || I18N.t('Repórtalos: así se previenen los accidentes.');
  $('tvAcc').textContent = String(d.accionesVencidas || 0);
  $('cAcc').classList.toggle('mal', d.accionesVencidas > 0);
  $('cAcc').classList.toggle('ok', !d.accionesVencidas);
  $('tvAccD').textContent = (d.accionesAbiertas || 0) + ' ' + I18N.t('abiertas en el plan de acción');
  $('tvIns').textContent = String(d.inspeccionesMes || 0);
  const hora = d.generado
    ? new Date(d.generado).toLocaleTimeString(I18N.idioma() === 'en' ? 'en-US' : 'es-CO', { hour: '2-digit', minute: '2-digit' })
    : '';
  $('tvEstado').hidden = false;
  $('tvEstado').textContent = (viejo ? I18N.t('Sin conexión: datos de las') + ' ' : I18N.t('Actualizado a las') + ' ') + hora;
}
async function leer() {
  let r;
  try {
    r = await SGSST.consultar({ action: 'pantalla', k: K });
  } catch (e) {
    r = null;
  }
  if (r && r.ok) {
    try {
      localStorage.setItem(CACHE, JSON.stringify(r));
    } catch (e) {}
    pintar(r, false);
    return;
  }
  if (r && r.codigoError === 'CLAVE') {
    $('tvDias').textContent = '—';
    $('tvDet').textContent = I18N.t(r.error);
    return;
  }
  try {
    const c = JSON.parse(localStorage.getItem(CACHE) || 'null');
    if (c) pintar(c, true);
  } catch (e) {}
}
let iMsg = 0;
function mensaje() {
  const el = $('tvMsg');
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = I18N.t(MENSAJES[iMsg++ % MENSAJES.length]);
    el.style.opacity = '1';
  }, 600);
}
let wake = null;
async function despierto() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') wake = await navigator.wakeLock.request('screen');
  } catch (e) {
    wake = null;
  }
}
function modoTv() {
  document.body.classList.add('tv');
  const e = Q.get('e'),
    urlRep = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'reportes.html' + (e ? '?e=' + encodeURIComponent(e) : '');
  try {
    QR.dibujar($('tvQr'), urlRep, { px: 140, margen: 1 });
  } catch (x) {
    $('tvQr').remove();
  }
  reloj();
  setInterval(reloj, 15000);
  mensaje();
  setInterval(mensaje, 20000);
  leer();
  setInterval(leer, 5 * 60000);
  despierto();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      despierto();
      leer();
    }
  });
  // Un toque: pantalla completa. El cursor se esconde a los 3 segundos sin moverse.
  document.addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  });
  let tCur = 0;
  document.addEventListener('mousemove', () => {
    document.body.classList.remove('sin-cursor');
    clearTimeout(tCur);
    tCur = setTimeout(() => document.body.classList.add('sin-cursor'), 3000);
  });
  // Una vez al día se recarga (toma la versión nueva del portal si la hay).
  setTimeout(() => location.reload(), 24 * 3600000);
}

if (K) modoTv();
else {
  if (typeof UpdateManager !== 'undefined') UpdateManager.init();
  UI.avisoServidor($('avisoSrv'));
  $('enIngles').checked = I18N.idioma() === 'en';
  $('crear').addEventListener('click', () => crearEnlace(false));
}
