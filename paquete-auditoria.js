/* ============================================================
   paquete-auditoria.js — Paquete de auditoría con un clic (v182)
   ------------------------------------------------------------
   Arma un .zip con los soportes de un periodo, listo para el auditor externo,
   la ARL o el Ministerio: una hoja (CSV que abre Excel) por cada registro del
   SG-SST —accidentes, plan de acción, inspecciones, actas, auditorías,
   inducciones, entregas de EPP, simulacros, preoperacionales, revisión por la
   dirección— y lo vigente (política, matriz legal, matriz de peligros,
   listado maestro, plan anual), más un LEEME.html con el resumen.
   NO lleva datos de salud de personas (exámenes, PVE, reintegros, ausencias):
   esos los custodia SST y se muestran aparte si el auditor los pide.
   Las firmas (imágenes) no se copian: cada registro dice si está firmado.
   ============================================================ */
const PaqueteAuditoria = (function () {
  /** [tipo, archivo, nombre, campo de fecha (vacío = se lleva lo vigente)] */
  const PARTES = [
    ['politica', '01-politica-y-objetivos', 'Política y objetivos', ''],
    ['legal', '02-matriz-legal', 'Matriz legal', ''],
    ['peligro', '03-matriz-de-peligros', 'Matriz de peligros', ''],
    ['documento', '04-listado-maestro', 'Listado maestro de documentos', ''],
    ['plananual', '05-plan-anual', 'Plan anual de trabajo', ''],
    ['reporte', '06-accidentes-incidentes-y-reportes', 'Accidentes, incidentes y reportes', 'fecha'],
    ['accion', '07-plan-de-accion', 'Plan de acción', 'fecha'],
    ['inspeccion', '08-inspecciones', 'Inspecciones', 'fecha'],
    ['preop', '09-preoperacionales', 'Preoperacionales', 'fecha'],
    ['reunion', '10-actas-de-comites', 'Actas de comités (COPASST, convivencia…)', 'fecha'],
    ['auditoria', '11-auditorias', 'Auditorías', 'ejecutada'],
    ['induccion', '12-inducciones', 'Inducciones y reinducciones', 'fecha'],
    ['entrega', '13-entregas-de-epp', 'Entregas de EPP', 'fecha'],
    ['simulacro', '14-simulacros', 'Simulacros', 'fecha'],
    ['revision', '15-revision-por-la-direccion', 'Revisión por la dirección', 'fecha'],
    ['cambio', '16-gestion-del-cambio', 'Gestión del cambio', 'fecha'],
    ['medicion', '17-mediciones-ambientales', 'Mediciones ambientales', 'fecha'],
  ];
  const SALUD = /^(examen|pvecaso|psico|reintegro|ausencia|custodiahc|preopsalud|sve)$/;
  const plano = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return /^data:image/.test(v) ? '(firmado)' : v;
    if (typeof v === 'number' || typeof v === 'boolean') return v === true ? 'Sí' : v === false ? 'No' : String(v);
    if (Array.isArray(v)) return v.map(plano).filter(Boolean).join('; ');
    return Object.keys(v)
      .filter((k) => k.charAt(0) !== '_')
      .map((k) => k + ': ' + plano(v[k]))
      .filter((x) => !/: $/.test(x))
      .join(' · ');
  };
  const celda = (t) => {
    const s = String(t).replace(/\r?\n/g, ' ').slice(0, 30000);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  /** CSV con separador «;» (Excel en español) y BOM para que lea las tildes. */
  function csv(filas) {
    const cols = [];
    filas.forEach((f) =>
      Object.keys(f).forEach((k) => {
        if (cols.indexOf(k) === -1) cols.push(k);
      }),
    );
    return '﻿' + [cols.map(celda).join(';')].concat(filas.map((f) => cols.map((c) => celda(plano(f[c]))).join(';'))).join('\r\n');
  }
  const dentro = (f, desde, hasta) => {
    const d = String(f || '').slice(0, 10);
    return !!d && d >= desde && d <= hasta;
  };
  /** Pura: de las filas del servidor arma los archivos. rows: {tipo: [{id, estado, resumen}]} */
  function armar(rows, desde, hasta, empresa) {
    const archivos = {},
      resumen = [];
    PARTES.forEach(([tipo, arch, nombre, campo]) => {
      if (SALUD.test(tipo)) return;
      const l = (rows[tipo] || []).filter((x) => (campo ? dentro(x.resumen[campo] || x.resumen.fecha, desde, hasta) : x.resumen.estado !== 'Obsoleto'));
      resumen.push([nombre, l.length, campo ? 'del periodo' : 'vigente']);
      if (!l.length) return;
      archivos[arch + '.csv'] = csv(l.map((x) => Object.assign({ id: x.id, estado: x.estado || x.resumen.estado || '' }, x.resumen)));
    });
    const e = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    archivos['LEEME.html'] =
      '<!doctype html><meta charset="utf-8"><title>Paquete de auditoría</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0' +
        ' 16px;color:#1d2433}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 8px;text-align:left}</style>' +
      '<h1>Paquete de auditoría del SG-SST</h1><p><b>' +
      e(empresa || '') +
      '</b> · periodo del ' +
      e(desde) +
      ' al ' +
      e(hasta) +
      ' · generado el ' +
      e(new Date().toISOString().slice(0, 10)) +
      ' desde el Portal SSTA.</p>' +
      '<table><tr><th>Soporte</th><th>Registros</th><th></th></tr>' +
      resumen.map((r) => '<tr><td>' + e(r[0]) + '</td><td>' + r[1] + '</td><td>' + e(r[2]) + '</td></tr>').join('') +
      '</table>' +
      '<p>Cada archivo .csv se abre con Excel. Las firmas no se copian: donde había firma dice «(firmado)». Los adjuntos (fotos, PDF) están en el Drive de la empresa, en la carpeta de' +
        ' cada registro.</p>' +
      '<p>No incluye datos de salud de personas (exámenes, vigilancia epidemiológica, reintegros, ausencias): los custodia el responsable de SST y se muestran si el auditor los pide' +
        ' (Res. 1843 de 2025; Ley 1581 de 2012).</p>';
    return { archivos, resumen };
  }
  /** Con pantalla: pide el periodo, trae los datos y descarga el .zip. */
  async function abrir() {
    const h = UI.hoy(),
      ini = h.slice(0, 4) + '-01-01';
    const m = UI.modal(
      '<h3>📦 Paquete de auditoría</h3><p class="ayuda">Todos los soportes del periodo en un .zip (una hoja de Excel por registro, más un resumen). Sin datos de salud de las personas.</p>' +
        '<div class="grid2"><div class="field"><label for="paDesde">Desde</label><input type="date" id="paDesde" value="' +
        ini +
        '"></div><div class="field"><label for="paHasta">Hasta</label><input type="date" id="paHasta" value="' +
        h +
        '"></div></div>' +
        '<button type="button" class="btn amber" id="paOk">Armar y descargar</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button><p class="status-msg" id="paMsg"></p>',
      true,
    );
    m.el.querySelector('#paOk').addEventListener('click', async () => {
      const desde = m.el.querySelector('#paDesde').value,
        hasta = m.el.querySelector('#paHasta').value,
        msg = m.el.querySelector('#paMsg');
      if (!desde || !hasta || desde > hasta) {
        msg.textContent = 'Revisa las fechas.';
        return;
      }
      m.el.querySelector('#paOk').disabled = true;
      msg.textContent = 'Trayendo los registros…';
      const r = await SGSST.listar(PARTES.map((p) => p[0]).join(','));
      if (!r || r.ok === false) {
        msg.textContent = (r && r.error) || 'No se pudieron traer los registros.';
        m.el.querySelector('#paOk').disabled = false;
        return;
      }
      const rows = {};
      (r.rows || []).forEach((x) => (rows[x.tipo] = rows[x.tipo] || []).push(x));
      const p = armar(rows, desde, hasta, (typeof EMPRESA !== 'undefined' && EMPRESA.nombre) || '');
      msg.textContent = 'Comprimiendo…';
      if (typeof fflate === 'undefined')
        await new Promise((ok, mal) => {
          const s = document.createElement('script');
          s.src = 'fflate.min.js';
          s.onload = ok;
          s.onerror = () => mal(new Error('No se pudo cargar el compresor.'));
          document.head.appendChild(s);
        });
      const ent = {};
      Object.keys(p.archivos).forEach((k) => (ent[k] = fflate.strToU8(p.archivos[k])));
      const blob = new Blob([fflate.zipSync(ent, { level: 6 })], { type: 'application/zip' }),
        a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Paquete-auditoria-SG-SST_' + desde + '_a_' + hasta + '.zip';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 4000);
      m.cerrar();
      UI.toast('✓ Paquete listo: ' + p.resumen.reduce((s, x) => s + x[1], 0) + ' registros en ' + (Object.keys(p.archivos).length - 1) + ' hojas.');
    });
  }
  return { armar, abrir, PARTES };
})();
if (typeof module !== 'undefined' && typeof window === 'undefined') module.exports = PaqueteAuditoria;
