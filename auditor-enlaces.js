/* ============================================================
   auditor-enlaces.js — Enlaces para auditores, en Auditorías (v174; antes estaba en Usuarios)
   ------------------------------------------------------------
   Solo el administrador los ve y los crea. El auditor entra solo con el enlace (sin usuario
   y sin la clave del portal), a leer los módulos elegidos, hasta la fecha que se diga.
   ============================================================ */
/* v162 · Enlaces para auditores: solo lectura, con vencimiento, módulos elegidos y registro de cada consulta. */
const GRUPOS_AUD = [
  ['personal', 'Personal y habilitación'],
  ['inspecciones', 'Inspecciones y equipos'],
  ['reportes', 'Reportes, investigaciones y acciones'],
  ['plan', 'Plan anual, indicadores y política'],
  ['peligros', 'Matriz de peligros y legal'],
  ['comites', 'Comités y actas'],
  ['epp', 'EPP'],
  ['emergencias', 'Emergencias y simulacros'],
  ['documentos', 'Documentos'],
  ['auditorias', 'Auditorías y revisión'],
  ['contratistas', 'Contratistas y proveedores'],
];
async function cargarAuditores() {
  const c = UI.$('cardAuditor');
  let j;
  try {
    j = await SGSST.consultar({ action: 'enlacesAuditor' });
  } catch (e) {
    return;
  }
  if (!j.ok) return;
  c.hidden = false;
  const h = UI.hoy();
  c.innerHTML =
    '<h2>🔎 Enlaces para auditores</h2>' +
    '<p class="ayuda">Para la ARL, el Ministerio, un cliente o un consultor: entran sin usuario y sin la clave del portal, solo a <b>leer</b> ' +
    'lo que elijas, hasta la fecha que digas. Nunca ven salud ni convivencia. Cada consulta queda en la bitácora.</p>' +
    '<div class="field"><label for="audNom">¿Quién audita?</label><input type="text" id="audNom" maxlength="80" placeholder="Ej.: ARL Positiva — Laura Gómez" data-no-ac></div>' +
    '<div class="field"><label for="audDias">Disponible por</label><select id="audDias"><option value="3">3 días</option>' +
    '<option value="7" selected>7 días</option><option value="15">15 días</option><option value="30">30 días</option></select></div>' +
    '<fieldset class="u-mt8"><legend class="etq-fija">Qué puede ver</legend>' +
    GRUPOS_AUD.map(
      ([k, n]) =>
        '<label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" data-gaud="' +
        k +
        '"' +
        (['inspecciones', 'reportes', 'plan', 'peligros'].indexOf(k) !== -1 ? ' checked' : '') +
        '> ' +
        esc(n) +
        '</label>',
    ).join('') +
    '</fieldset>' +
    '<button type="button" class="btn" id="audCrear">Crear enlace</button><div id="audNuevo"></div>' +
    ((j.enlaces || []).length
      ? '<h3 class="u-mt10">Enlaces creados</h3><ul class="fx-l">' +
        j.enlaces
          .map((x) => {
            const vivo = !x.revocado && x.vence >= h;
            return (
              '<li><b>' +
              esc(x.nombre) +
              '</b> <span class="chip ' +
              (vivo ? 'ok' : '') +
              '">' +
              (x.revocado ? 'Revocado' : vivo ? 'Hasta el ' + esc(UI.corta(x.vence)) : 'Venció') +
              '</span><br><small>' +
              esc((x.grupos || []).map((g) => (GRUPOS_AUD.find((y) => y[0] === g) || [g, g])[1]).join(' · ')) +
              '</small>' +
              (vivo ? ' <button type="button" class="btn-mini" data-revocar="' + esc(x.id) + '">Revocar</button>' : '') +
              ' <a class="btn-mini" href="bitacora.html">Ver sus consultas</a></li>'
            );
          })
          .join('') +
        '</ul>'
      : '');
  UI.$('audCrear').addEventListener('click', async () => {
    const grupos = [...c.querySelectorAll('[data-gaud]:checked')].map((x) => x.dataset.gaud),
      nombre = UI.$('audNom').value.trim();
    if (nombre.length < 3 || !grupos.length) {
      UI.toast('Escribe quién audita y elige al menos un módulo.');
      return;
    }
    const r = await SGSST.enviar({ action: 'crearEnlaceAuditor', nombre, grupos, dias: UI.$('audDias').value }, null, { sinCola: true });
    if (!r.ok) {
      UI.toast(r.error || 'No se pudo.', 'mal');
      return;
    }
    const e = new URLSearchParams(location.search).get('e'),
      url =
        location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') +
        'auditor.html?' +
        (e ? 'e=' + encodeURIComponent(e) + '&' : '') +
        'a=' +
        encodeURIComponent(r.token);
    UI.$('audNuevo').innerHTML =
      '<div class="aviso ok u-mt8"><b>Enlace listo</b> (solo se muestra esta vez):<code style="display:block;word-break:break-all;margin:6px 0;">' +
      esc(url) +
      '</code><button type="button" class="btn-mini" id="audCopiar">📋 Copiar</button> <a class="btn-mini" target="_blank" rel="noopener" href="https://wa.me/?text=' +
      encodeURIComponent('Enlace de consulta (solo lectura) de ' + (EMPRESA.nombre || '') + ': ' + url) +
      '">WhatsApp</a></div>';
    UI.$('audCopiar').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        UI.$('audCopiar').textContent = '✓ Copiado';
      } catch (x) {}
    });
    setTimeout(cargarAuditoresLista, 100);
  });
  c.querySelectorAll('[data-revocar]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!(await Dialogo.confirmar('¿Revocar este enlace? Deja de funcionar de inmediato.'))) return;
      const r = await SGSST.enviar({ action: 'revocarEnlaceAuditor', id: b.dataset.revocar }, null, { sinCola: true });
      UI.toast(r.ok ? '✓ Revocado' : r.error || 'No se pudo', r.ok ? '' : 'mal');
      cargarAuditores();
    }),
  );
}
function cargarAuditoresLista() {
  const n = UI.$('audNuevo') && UI.$('audNuevo').innerHTML;
  cargarAuditores().then(() => {
    if (n && UI.$('audNuevo')) {
      UI.$('audNuevo').innerHTML = n;
      const b = UI.$('audCopiar');
      if (b)
        b.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(b.previousElementSibling.textContent);
            b.textContent = '✓ Copiado';
          } catch (x) {}
        });
    }
  });
}

if (typeof SGSST !== 'undefined' && SGSST.url()) cargarAuditores();
