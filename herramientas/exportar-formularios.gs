/* ============================================================
   exportar-formularios.gs — Copia exacta de los formularios de Google
   para montarlos en el Portal SSTA.
   ------------------------------------------------------------
   CÓMO SE USA (una sola vez, 3 minutos):
   1. Entra a https://script.google.com con la cuenta de Google que es
      DUEÑA de los formularios preoperacionales (la de la empresa).
   2. «Nuevo proyecto». Borra lo que trae y pega TODO este archivo.
   3. Arriba, elige la función «exportarFormularios» y toca ▶ Ejecutar.
      Google pide permiso para ver tus formularios y crear un archivo en
      tu Drive: acepta (solo lee los formularios; no cambia nada).
   4. Al terminar, en el registro de ejecución sale el enlace del archivo
      «formularios-portal.json» (queda en la raíz de tu Drive).
      Descárgalo y adjúntalo en el chat.
   Lee TODOS los formularios de la cuenta (y los compartidos contigo como
   editor): título, descripción, secciones, preguntas, tipo, si es
   obligatoria, ayuda y todas las opciones, en el mismo orden.
   No lee las respuestas.
   ============================================================ */
function exportarFormularios() {
  const salida = [];
  const archivos = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  while (archivos.hasNext()) {
    const a = archivos.next();
    try {
      const f = FormApp.openById(a.getId());
      salida.push({
        id: a.getId(),
        titulo: f.getTitle(),
        descripcion: f.getDescription(),
        publicado: f.getPublishedUrl(),
        corto: (function () { try { return f.shortenFormUrl(f.getPublishedUrl()); } catch (e) { return ''; } })(),
        preguntas: f.getItems().map(leerPregunta_)
      });
    } catch (e) {
      salida.push({ id: a.getId(), titulo: a.getName(), error: 'No se pudo abrir (¿no eres editor?): ' + e.message });
    }
  }
  const json = JSON.stringify({ exportado: new Date().toISOString(), cuenta: Session.getActiveUser().getEmail(), formularios: salida }, null, 1);
  const archivo = DriveApp.createFile('formularios-portal.json', json, MimeType.PLAIN_TEXT);
  console.log('Listo: ' + salida.length + ' formularios. Descarga este archivo y adjúntalo en el chat: ' + archivo.getUrl());
}

function leerPregunta_(it) {
  const t = it.getType(), T = FormApp.ItemType;
  const p = { tipo: String(t), titulo: it.getTitle(), ayuda: it.getHelpText() };
  const req = function (x) { try { p.obligatoria = x.isRequired(); } catch (e) {} };
  // Opciones y, si las hay, saltos de sección («ir a la sección…» según la respuesta).
  const opciones = function (x) {
    p.opciones = x.getChoices().map(function (c) { return c.getValue(); });
    try {
      const saltos = x.getChoices().map(function (c) {
        const n = c.getPageNavigationType(), g = c.getGotoPage();
        return g ? 'pagina:' + g.getId() : n ? String(n) : '';
      });
      if (saltos.some(function (z) { return z && z !== 'CONTINUE'; })) p.saltos = saltos;
    } catch (e) {}
  };
  p.id = it.getId();
  if (t === T.MULTIPLE_CHOICE) { const x = it.asMultipleChoiceItem(); opciones(x); req(x); p.otra = x.hasOtherOption(); }
  else if (t === T.CHECKBOX) { const x = it.asCheckboxItem(); opciones(x); req(x); p.otra = x.hasOtherOption(); }
  else if (t === T.LIST) { const x = it.asListItem(); opciones(x); req(x); }
  else if (t === T.TEXT) { req(it.asTextItem()); }
  else if (t === T.PARAGRAPH_TEXT) { req(it.asParagraphTextItem()); }
  else if (t === T.DATE) { const x = it.asDateItem(); req(x); p.conAnio = x.includesYear(); }
  else if (t === T.DATETIME) { const x = it.asDateTimeItem(); req(x); }
  else if (t === T.TIME) { req(it.asTimeItem()); }
  else if (t === T.DURATION) { req(it.asDurationItem()); }
  else if (t === T.SCALE) { const x = it.asScaleItem(); req(x); p.desde = x.getLowerBound(); p.hasta = x.getUpperBound(); p.etiquetaDesde = x.getLeftLabel(); p.etiquetaHasta = x.getRightLabel(); }
  else if (t === T.GRID) { const x = it.asGridItem(); req(x); p.filas = x.getRows(); p.columnas = x.getColumns(); }
  else if (t === T.CHECKBOX_GRID) { const x = it.asCheckboxGridItem(); req(x); p.filas = x.getRows(); p.columnas = x.getColumns(); }
  else if (t === T.PAGE_BREAK) { const x = it.asPageBreakItem(); try { const g = x.getGoToPage(), n = x.getPageNavigationType(); p.alTerminar = g ? 'pagina:' + g.getId() : String(n || ''); } catch (e) {} }
  else if (t === T.SECTION_HEADER) { /* título dentro de la página */ }
  else if (t === T.IMAGE) { p.imagen = true; }
  else if (t === T.VIDEO) { p.video = true; }
  try { if (t === T.RATING) { const x = it.asRatingItem(); req(x); p.hasta = x.getRatingScaleLevel(); } } catch (e) {}
  return p;
}
