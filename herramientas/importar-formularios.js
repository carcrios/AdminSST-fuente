#!/usr/bin/env node
/* ============================================================
   importar-formularios.js — Formularios de Google → preoperacionales del portal
   ------------------------------------------------------------
   Toma formularios-portal.json (lo genera exportar-formularios.gs en la
   cuenta dueña de los formularios) y escribe preop-formularios.js con
   cada formulario TAL CUAL: título, descripción, páginas, preguntas,
   tipo, obligatoria, ayuda, opciones y saltos de sección.

   Solo cambia dos cosas, a propósito:
   · La lista desplegable de personas («NOMBRE - CÉDULA») no se copia al
     código (el sitio es público y son datos personales): se elige del
     Personal habilitado del portal o se escribe.
   · Las imágenes y videos del formulario no se copian (quedan anotados).

   Uso:
     node herramientas/importar-formularios.js formularios-portal.json            (todos los formularios)
     node herramientas/importar-formularios.js formularios-portal.json enlaces.json (solo los de la lista)
   Con todos, el grupo sale de «Grupo: …» en la descripción del formulario (o «Preoperacionales»).
   enlaces.json (opcional): [{ "url": "https://forms.gle/…", "id": "pulidora", "grupo": "Corte, desbaste y pulido", "nombre": "Pulidora" }]
   ============================================================ */
'use strict';
const fs = require('fs'), path = require('path');
const RAIZ = path.join(__dirname, '..');

/* Lista de enlaces por defecto: vacía. Sin enlaces.json se montan TODOS los formularios del archivo. */
const ENLACES = [];

const TIPO = { MULTIPLE_CHOICE: 'opcion', CHECKBOX: 'casillas', LIST: 'lista', TEXT: 'texto', PARAGRAPH_TEXT: 'parrafo', DATE: 'fecha', DATETIME: 'fechahora',
  TIME: 'hora', DURATION: 'texto', SCALE: 'escala', RATING: 'escala', GRID: 'cuadricula', CHECKBOX_GRID: 'cuadricula-casillas', SECTION_HEADER: 'titulo', FILE_UPLOAD: 'foto' };
const sinQuery = (u) => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '');
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
/** ¿Es la lista de personas «NOMBRE - CÉDULA»? (no se copia al código). */
const esListaPersonas = (op) => (op || []).length >= 5 && op.filter((o) => /\s[-–]\s*\d{6,}\s*$/.test(o)).length >= op.length * 0.7;
/** Respuestas que indican un problema (se piden observación y foto). Sí/No no se juzga solo: depende de la pregunta. */
const MALA = /^(mal[oa]?|mal estado|deficiente|defectuos[oa]|dañad[oa]|averiad[oa]|no cumple|no funciona|no conforme|regular|malo\/no apto|no apto|fuera de servicio)$/i;

/** Busca en el export el formulario de un enlace (por URL publicada, corta o id). */
function buscar(formularios, url) {
  const u = sinQuery(url);
  return formularios.find((f) => !f.error && (sinQuery(f.publicado) === u || sinQuery(f.corto) === u || (f.id && u.indexOf(f.id) !== -1)));
}

/** Un formulario del export → definición del portal. */
function convertir(f, e) {
  const preguntas = f.preguntas || [], paginas = [{ titulo: '', descripcion: '', items: [] }], idsPagina = {}, notas = [];
  let n = 0;
  preguntas.forEach((p) => {
    if (p.tipo === 'PAGE_BREAK') {
      // El salto de esta sección dice a dónde ir DESPUÉS de la página anterior.
      if (p.alTerminar && p.alTerminar !== 'CONTINUE') paginas[paginas.length - 1].despues = p.alTerminar;
      paginas.push({ titulo: p.titulo || '', descripcion: p.ayuda || '', items: [], gid: String(p.id || '') });
      if (p.id) idsPagina['pagina:' + p.id] = paginas.length - 1;
      return;
    }
    if (p.tipo === 'IMAGE' || p.tipo === 'VIDEO') { notas.push('El formulario tenía ' + (p.tipo === 'IMAGE' ? 'una imagen' : 'un video') + (p.titulo ? ' («' + p.titulo + '»)' : '') + ' que no se copió.'); return; }
    const t = TIPO[p.tipo];
    if (!t) { notas.push('Pregunta de tipo ' + p.tipo + ' no reconocida: «' + p.titulo + '» (va como texto).'); }
    const q = { k: 'p' + (++n), tipo: t || 'texto', titulo: p.titulo || '', ayuda: p.ayuda || '' };
    if (p.obligatoria) q.obligatoria = true;
    if (p.opciones) q.opciones = p.opciones.slice();
    if (p.otra) q.otra = true;
    if (p.filas) { q.filas = p.filas.slice(); q.columnas = (p.columnas || []).slice(); }
    if (q.tipo === 'escala') { q.desde = p.desde == null ? 1 : p.desde; q.hasta = p.hasta || 5; if (p.etiquetaDesde) q.etiquetaDesde = p.etiquetaDesde; if (p.etiquetaHasta) q.etiquetaHasta = p.etiquetaHasta; }
    if (p.saltos) q.saltos = p.saltos.slice();
    // Papel de la pregunta en el registro (para la lista, el PDF y el inventario).
    const tt = norm(q.titulo);
    if (q.tipo === 'lista' && esListaPersonas(q.opciones)) { q.tipo = 'persona'; delete q.opciones; q.rol = 'responsable'; notas.push('La lista de personas de «' + q.titulo + '» no se copió: se elige del Personal habilitado del portal.'); }
    else if (/responsable|inspector|nombre del trabajador|nombre/.test(tt) && ['texto', 'persona'].indexOf(q.tipo) !== -1) q.rol = 'responsable';
    if (q.tipo === 'fecha' && /fecha/.test(tt) && !paginas.some((pg) => pg.items.some((x) => x.rol === 'fecha'))) q.rol = 'fecha';
    if (/^cargo\b|cargo del/.test(tt)) q.rol = 'cargo';
    if (/c[oó]digo.*equipo|codigo del equipo|serial|n[uú]mero interno|placa/.test(tt)) q.rol = 'equipo';
    if (/centro de trabajo|centro de costo|^obra\b|proyecto|cliente/.test(tt)) q.rol = 'centro';
    if (q.opciones) { const m = q.opciones.filter((o) => MALA.test(String(o).trim())); if (m.length && m.length < q.opciones.length) q.malas = m; }
    if (q.columnas) { const m = q.columnas.filter((o) => MALA.test(String(o).trim())); if (m.length && m.length < q.columnas.length) q.malasCol = m; }
    paginas[paginas.length - 1].items.push(q);
  });
  // Saltos «pagina:<id>» → número de página (o «fin»).
  const destino = (s) => !s || s === 'CONTINUE' ? null : s === 'SUBMIT' ? 'fin' : s === 'RESTART' ? 0 : (s in idsPagina ? idsPagina[s] : null);
  paginas.forEach((pg) => {
    if (pg.despues) { const d = destino(pg.despues); if (d === null) delete pg.despues; else pg.despues = d; }
    pg.items.forEach((q) => { if (q.saltos) { q.saltos = q.saltos.map(destino); if (q.saltos.every((x) => x === null)) delete q.saltos; } });
    delete pg.gid;
  });
  const codigo = ((f.titulo + ' ' + (f.descripcion || '')).match(/SSTA-F-\d{3}/) || [])[0] || '';
  const def = { id: e.id, nombre: e.nombre, grupo: e.grupo, titulo: f.titulo, codigo, descripcion: f.descripcion || '', salud: e.grupo === 'Salud', origen: e.url, paginas: paginas.filter((pg, i) => i === 0 || pg.items.length || pg.titulo) };
  if (!def.paginas[0].items.length && !def.paginas[0].titulo && def.paginas.length > 1) def.paginas.shift();
  if (notas.length) def.notas = notas;
  return def;
}

/** Todos los formularios del archivo (para una empresa nueva que trae sus formularios de Google). */
function enlacesDeTodos(exportado) {
  const usados = {};
  return ((exportado && exportado.formularios) || []).filter((f) => !f.error).map((f) => {
    let id = norm(f.titulo).replace(/^(inspeccion|preoperacional|formato)( general)?( de| del)? /, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'formulario';
    while (usados[id]) id += '-2'; usados[id] = true;
    const g = /grupo:\s*([^\n]+)/i.exec(f.descripcion || '');
    return { id, nombre: f.titulo.replace(/^\s+|\s+$/g, ''), grupo: g ? g[1].trim() : (/salud/i.test(f.titulo) ? 'Salud' : 'Preoperacionales'), url: f.publicado || f.corto || f.id };
  });
}
function importar(exportado, enlaces) {
  const forms = (exportado && exportado.formularios) || [], defs = [], faltan = [];
  (enlaces || ENLACES).forEach((e) => { const f = buscar(forms, e.url); if (f) defs.push(convertir(f, e)); else faltan.push(e); });
  return { defs, faltan, conError: forms.filter((f) => f.error) };
}

function archivoJS(defs, exportado) {
  return '/* ============================================================\n' +
    '   preop-formularios.js — Preoperacionales del portal (GENERADO)\n' +
    '   Copia de los formularios de Google de la empresa, tal cual: lo genera\n' +
    '   herramientas/importar-formularios.js con formularios-portal.json\n' +
    '   (exportado el ' + String((exportado && exportado.exportado) || '').slice(0, 10) + '). No se edita a mano: si cambia un\n' +
    '   formulario, se vuelve a exportar e importar.\n' +
    '   ============================================================ */\n' +
    'const PREOP_FORMULARIOS = ' + JSON.stringify(defs, null, 1) + ';\n' +
    "if (typeof module !== 'undefined') module.exports = PREOP_FORMULARIOS;\n";
}

if (require.main === module) {
  const [entrada, enl] = process.argv.slice(2);
  if (!entrada) { console.log('Uso: node herramientas/importar-formularios.js formularios-portal.json [enlaces.json]'); process.exit(2); }
  const exportado = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  const r = importar(exportado, enl && enl !== '--todos' ? JSON.parse(fs.readFileSync(enl, 'utf8')) : enlacesDeTodos(exportado));
  fs.writeFileSync(path.join(RAIZ, 'preop-formularios.js'), archivoJS(r.defs, exportado));
  console.log('✓ ' + r.defs.length + ' formulario(s) en preop-formularios.js');
  r.defs.forEach((d) => console.log('  · ' + d.id + ': ' + d.titulo + ' — ' + d.paginas.length + ' página(s), ' + d.paginas.reduce((a, p) => a + p.items.length, 0) + ' pregunta(s)' + (d.notas ? ' (' + d.notas.length + ' nota(s))' : '')));
  if (r.faltan.length) console.log('⚠ No se encontraron en el archivo: ' + r.faltan.map((e) => e.nombre + ' (' + e.url + ')').join(', '));
  if (r.conError.length) console.log('⚠ No se pudieron abrir: ' + r.conError.map((f) => f.titulo).join(', '));
}
module.exports = { importar, convertir, buscar, archivoJS, ENLACES, esListaPersonas, MALA, enlacesDeTodos };
