/* ============================================================
   autorizacion-datos.js — Autorización de tratamiento de datos (Ley 1581 de 2012)
   ------------------------------------------------------------
   El portal guarda nombres, cédulas, firmas y DATOS SENSIBLES de salud
   (conceptos médicos, restricciones, exámenes). La Ley 1581 pide la
   autorización previa, expresa e informada del trabajador, y para los datos
   sensibles una autorización explícita, informándole que no está obligado a
   darla (art. 6). Por eso son DOS casillas: la general (obligatoria para
   registrar la inducción) y la de datos sensibles (voluntaria).

   Se pide en la inducción, porque todo trabajador pasa por ella y ahí ya
   firma. Queda guardada con la inducción (versión del texto, fecha, qué
   autorizó) y sale en la constancia PDF con la misma firma.

   El texto es una plantilla general: la empresa debe revisarlo con su
   asesor legal y tener su política de tratamiento de datos.
   ============================================================ */
const AutorizacionDatos = (function () {
  const VERSION = '2026-10-v1';
  const e = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function empresa() {
    const E = (typeof EMPRESA !== 'undefined' && EMPRESA) || {};
    return { nombre: E.nombre || 'la empresa', nit: E.nit || '' };
  }
  /** Texto que lee la persona (también va en la constancia PDF). */
  function parrafos() {
    const em = empresa(), quien = em.nombre + (em.nit ? ' (NIT ' + em.nit + ')' : '');
    return {
      general: 'Autorizo a ' + quien + ', como responsable, a recolectar, almacenar, usar y conservar mis datos personales (nombre, cédula, cargo, firma y los que registre en el portal de SST) para gestionar el Sistema de Gestión de Seguridad y Salud en el Trabajo: inducciones y capacitaciones, permisos de trabajo, habilitación para tareas de alto riesgo, entrega de EPP, emergencias, investigación de incidentes y los reportes que exige la ley.',
      sensibles: 'Autorizo de forma explícita el tratamiento de mis datos sensibles de salud (conceptos de aptitud, restricciones y recomendaciones médico-ocupacionales, y vigilancia epidemiológica) solo para las finalidades de SST anteriores, con acceso restringido al personal autorizado. Sé que estos datos son sensibles y que NO estoy obligado(a) a autorizar su tratamiento.',
      derechos: 'Me informaron que puedo conocer, actualizar, rectificar y pedir la supresión de mis datos, y revocar esta autorización, ante el área de SST o de Talento Humano de ' + em.nombre + ', y que puedo consultar su política de tratamiento de datos (Ley 1581 de 2012 y Decreto 1377 de 2013).'
    };
  }
  /** Bloque para el formulario. prefijo: para que los id no choquen. */
  function html(prefijo) {
    const p = parrafos(), id = (x) => prefijo + x;
    return '<div class="card autorizacion-datos" id="' + id('Caja') + '"><h2>Autorización de datos personales</h2>' +
      '<p class="ayuda">Ley 1581 de 2012. Léela antes de firmar.</p>' +
      '<label class="check"><input type="checkbox" id="' + id('General') + '"> <span><b>Sí, autorizo</b> — ' + e(p.general) + ' *</span></label>' +
      '<label class="check"><input type="checkbox" id="' + id('Sensibles') + '"> <span><b>Sí, autorizo mis datos de salud</b> (voluntario) — ' + e(p.sensibles) + '</span></label>' +
      '<p class="ayuda">' + e(p.derechos) + '</p></div>';
  }
  /** Lo que se guarda con la inducción. */
  function valor(prefijo) {
    const g = document.getElementById(prefijo + 'General'), s = document.getElementById(prefijo + 'Sensibles');
    return { version: VERSION, fecha: new Date().toISOString(), general: !!(g && g.checked), sensibles: !!(s && s.checked) };
  }
  /** Mensaje si falta la autorización general (la de salud es voluntaria). */
  function falta(prefijo) {
    const g = document.getElementById(prefijo + 'General');
    return g && !g.checked ? 'Autorización de datos personales: marca «Sí, autorizo»' : '';
  }
  /** Resumen corto para pantallas y listas. */
  function resumen(a) {
    if (!a || !a.general) return 'Sin autorización de datos registrada';
    return 'Autorizó sus datos' + (a.sensibles ? ' y sus datos de salud' : ' (NO autorizó datos de salud)') + ' · texto ' + a.version;
  }
  /** Sección para la constancia PDF (va antes de la firma, que la cubre). */
  function seccionPdf(a) {
    const p = parrafos(), si = (x) => (x ? 'SÍ AUTORIZA' : 'NO AUTORIZA');
    if (!a) return '<table><tr><td>No se registró autorización de datos con esta inducción.</td></tr></table>';
    return '<table>' +
      '<tr><td>' + e(p.general) + '</td><td><b>' + si(a.general) + '</b></td></tr>' +
      '<tr><td>' + e(p.sensibles) + '</td><td><b>' + si(a.sensibles) + '</b></td></tr>' +
      '<tr><td colspan="2">' + e(p.derechos) + ' (Texto ' + e(a.version) + ')</td></tr></table>';
  }
  return { VERSION, html, valor, falta, resumen, seccionPdf, parrafos };
})();
