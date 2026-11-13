/* ============================================================
   empezar.app.js — Por dónde iniciar (v172)
   ------------------------------------------------------------
   Muestra arriba UN paso: el siguiente. Debajo, el camino completo en tres
   fases. Lo que el portal puede ver (hay personal, hay matriz de peligros…)
   se tacha solo; lo demás se marca con «Ya lo hice» (queda en este equipo).
   ============================================================ */
OfflineBanner.init();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();
const $ = UI.$;
const CLAVE = 'ssta-empezar-manual-' + ((typeof Empresa !== 'undefined' && Empresa.codigo && Empresa.codigo()) || 'sitio');
let manual = {};
try {
  manual = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {};
} catch (e) {}
let ctx = { servidor: false, empresa: false, usuarios: null, rows: null };

const activo = (href) => {
  try {
    const m = Empresa.moduloDeHref && Empresa.moduloDeHref(href);
    return !m || !Empresa.moduloActivo || Empresa.moduloActivo(m);
  } catch (e) {
    return true;
  }
};

async function cargar() {
  ctx.servidor = typeof SGSST !== 'undefined' && !!SGSST.url();
  ctx.empresa = !EMPRESA.sinConfigurar && !!String(EMPRESA.nit || '').trim();
  pintar();
  if (!ctx.servidor) return;
  try {
    const r = await SGSST.listar(EMPEZAR.TIPOS.join(','), { sinPedir: true });
    if (r && !r.sinSesion && r.rows) ctx.rows = r.rows;
  } catch (e) {}
  try {
    const u = await SGSST.consultar({ action: 'usuarios' });
    if (u && u.ok) ctx.usuarios = (u.usuarios || []).length >= 2;
  } catch (e) {}
  pintar();
}

function pintar() {
  const E = EMPEZAR.evaluar(Object.assign({ manual, activo }, ctx)),
    s = E.siguiente,
    pct = Math.round((E.hechos * 100) / (E.total || 1));
  const boton = (p, cl) =>
    '<a class="btn ' +
    cl +
    '" href="' +
    esc(p.href) +
    '">Ir a hacerlo →</a>' +
    (p.auto
      ? ''
      : '<button type="button" class="btn ghost" data-man="' + esc(p.id) + '">' + (manual[p.id] ? 'Desmarcar' : 'Ya lo hice') + '</button>');
  $('contenido').innerHTML =
    (s
      ? '<div class="card ep-sig"><div class="eyebrow">Tu siguiente paso · ' +
        (E.hechos + 1) +
        ' de ' +
        E.total +
        '</div><h2>' +
        esc(s.t) +
        '</h2><p class="u-mt0">' +
        esc(s.porque) +
        '</p><p class="ayuda">Cómo: ' +
        esc(s.como) +
        '</p><div class="fila-btn">' +
        boton(s, 'amber') +
        '</div></div>'
      : '<div class="card ep-sig"><h2>✓ El cliente quedó andando</h2><p class="u-mt0">Ya está todo lo básico. Desde ' +
        'aquí, cada mes: inspecciones, charlas, reportes, el cierre del mes y el informe mensual.</p>' +
        '<div class="fila-btn"><a class="btn amber" href="informe-mes.html">Informe mensual →</a></div></div>') +
    '<div class="card"><h2>Avance · ' +
    E.hechos +
    ' de ' +
    E.total +
    '</h2><div class="ep-barra" aria-hidden="true"><span style="width:' +
    pct +
    '%"></span></div>' +
    (ctx.rows === null && ctx.servidor ? '<p class="ayuda">Entra con tu usuario para que el portal tache solo lo que ya está hecho.</p>' : '') +
    '</div>' +
    E.fases
      .filter((f) => f.pasos.length)
      .map(
        (f) =>
          '<div class="card"><h2>' +
          f.n +
          '. ' +
          esc(f.t) +
          '</h2>' +
          f.pasos
            .map((p) => {
              const i = E.pasos.indexOf(p) + 1;
              return (
                '<div class="ep-paso' +
                (p.hecho ? ' hecho' : '') +
                (s && p.id === s.id ? ' ahora' : '') +
                '" id="p-' +
                esc(p.id) +
                '"><span class="ep-chk" aria-hidden="true">' +
                (p.hecho ? '✓' : i) +
                '</span><div class="ep-txt"><b>' +
                esc(p.t) +
                '</b>' +
                (p.hecho ? '<span class="solo-lector"> (hecho)</span>' : '') +
                '<small>' +
                esc(p.porque) +
                '</small>' +
                (p.hecho && p.auto
                  ? ''
                  : '<div class="ep-acc">' +
                    (p.hecho
                      ? '<button type="button" class="btn-mini" data-man="' + esc(p.id) + '">Desmarcar</button>'
                      : '<a class="btn-mini" href="' +
                        esc(p.href) +
                        '">Ir →</a>' +
                        (p.auto ? '' : '<button type="button" class="btn-mini gris" data-man="' + esc(p.id) + '">Ya lo hice</button>')) +
                    '</div>') +
                '</div></div>'
              );
            })
            .join('') +
          '</div>',
      )
      .join('') +
    '<p class="ayuda">¿Dudas en algún paso? Pregúntale a la <a href="ayuda.html">guía</a>.</p>';
}

$('contenido').addEventListener('click', (e) => {
  const b = e.target.closest('[data-man]');
  if (!b) return;
  const id = b.dataset.man;
  if (manual[id]) delete manual[id];
  else manual[id] = true;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(manual));
  } catch (x) {}
  pintar();
});
UI.avisoServidor($('avisoSrv'));
cargar();
