#!/usr/bin/env node
/* ============================================================
   comercial.js — Arma los documentos comerciales en Word y PDF (v166)
   ------------------------------------------------------------
   Fuente (se edita): comercial/*.md  →  salida: .docx y .pdf firmables,
   con la versión del portal, la fecha, «Página X de Y» y el bloque de firmas.

     1-PROPUESTA            propuesta para un cliente (se llena por cliente)
     2-CONTRATO             contrato de licencia y servicio
     3-ANEXO-1-PRECIOS      plan, precios y la tabla de módulos por plan
     4-ANEXO-2-DATOS        encargo del tratamiento de datos (Ley 1581)
     5-ANEXO-3-SERVICIO     niveles de servicio y soporte
     6-ANEXO-4-REVENDEDOR   solo para consultores que revenden

   La tabla «Módulos por plan» del Anexo 1 NO se escribe a mano: sale de
   PLANES_PORTAL y COMPLEMENTOS_PORTAL (empresa-motor.js), lo mismo que usa el
   configurador. Así el contrato y el portal nunca dicen cosas distintas.
   Marcas en los .md: {{VERSION}} {{FECHA}} {{ANIO}} {{FIRMAS}} {{MODULOS_POR_PLAN}}.

   Uso:  node herramientas/comercial.js [carpeta de salida]   (por defecto ../comercial-vNNN)
   Necesita: docx (npm) y, para el PDF, LibreOffice (soffice); sin LibreOffice quedan solo los .docx.
   ============================================================ */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const RAIZ = path.join(__dirname, '..'), FUENTE = path.join(RAIZ, 'comercial');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, AlignmentType,
  Footer, Header, PageNumber, LevelFormat } = D;

const DOCS = [
  ['PROPUESTA.md', '1-PROPUESTA', 'Propuesta comercial'],
  ['CONTRATO.md', '2-CONTRATO', 'Contrato de licencia y servicio'],
  ['PRECIOS.md', '3-ANEXO-1-PRECIOS', 'Anexo 1 · Plan, precios y módulos'],
  ['DPA.md', '4-ANEXO-2-DATOS', 'Anexo 2 · Encargo del tratamiento de datos'],
  ['SLA.md', '5-ANEXO-3-SERVICIO', 'Anexo 3 · Niveles de servicio'],
  ['REVENDEDOR.md', '6-ANEXO-4-REVENDEDOR', 'Anexo 4 · Consultor que revende']
];

function version() { return 'v' + /const CACHE_NAME = 'ssta-portal-v(\d+)'/.exec(fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8'))[1]; }
function hoy() { const d = new Date(); return d.toISOString().slice(0, 10); }

/** Los planes y el catálogo, leídos del mismo archivo que usa el portal. */
function catalogo() {
  const sb = { EMPRESA: { modulos: {} }, console }; sb.window = sb; sb.globalThis = sb;
  try { require('vm').runInNewContext(fs.readFileSync(path.join(RAIZ, 'empresa-motor.js'), 'utf8'), sb); } catch (e) { /* lo de la página no corre aquí */ }
  if (!sb.PLANES_PORTAL || !sb.CATALOGO_MODULOS) throw new Error('empresa-motor.js no tiene PLANES_PORTAL / CATALOGO_MODULOS');
  return sb;
}
const sinEmoji = (s) => String(s).replace(/^[^\p{L}\p{N}(]+/u, '').trim();
/** Markdown de la tabla «Módulos por plan», por categoría (igual que el configurador). */
function modulosPorPlan() {
  const g = catalogo(), P = g.PLANES_PORTAL, ks = Object.keys(P), todos = g.CATALOGO_MODULOS.map((x) => x[0]);
  const nom = {}; g.CATALOGO_MODULOS.forEach(([k, n]) => { nom[k] = sinEmoji(n); });
  const tiene = (p, k) => !P[p].mods || P[p].mods.indexOf(k) !== -1;
  const cats = (g.CATEGORIAS_MODULOS || [['todos', 'Módulos', '', todos]]).concat([['otros', 'Otros', '', todos.filter((k) => !(g.CATEGORIAS_MODULOS || []).some((c) => c[3].indexOf(k) !== -1))]]);
  let md = '## Módulos por plan\n\nEsta tabla sale del mismo código que usa el portal para prender los módulos de cada plan (versión ' + version() + '). «Sí» = incluido en el plan.\n\n';
  md += '| Módulo | ' + ks.map((p) => P[p].nombre).join(' | ') + ' |\n| --- |' + ks.map(() => ' --- |').join('') + '\n';
  cats.forEach(([, cn, , l]) => { const vis = l.filter((k) => nom[k] && k !== 'asesor'); if (!vis.length) return;
    md += '| **' + cn + '** |' + ks.map(() => ' |').join('') + '\n';
    vis.forEach((k) => { md += '| ' + nom[k] + ' | ' + ks.map((p) => (tiene(p, k) ? 'Sí' : '—')).join(' | ') + ' |\n'; }); });
  return md;
}
function firmasMd() { return '[[FIRMAS]]'; }
/** Bloque de firmas: dos columnas, espacio para firmar, nombre, documento y fecha. */
function firmas() {
  const sin = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, linea = { style: BorderStyle.SINGLE, size: 6, color: TINTA };
  const col = (quien, extra) => new TableCell({ width: { size: 4680, type: WidthType.DXA }, borders: { top: sin, left: sin, right: sin, bottom: sin }, margins: { left: 120, right: 240 },
    children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: quien, bold: true, font: FUENTE_TXT, size: 22, color: TINTA })] }),
      new Paragraph({ keepNext: true, spacing: { before: 900 }, border: { bottom: linea }, children: [new TextRun({ text: ' ', size: 22 })] }),
      new Paragraph({ keepNext: true, children: [new TextRun({ text: 'Firma', font: FUENTE_TXT, size: 18, color: SUAVE })] })]
      .concat(['Nombre:', 'C.C. / NIT:', extra, 'Fecha:'].map((x) => new Paragraph({ keepNext: true, spacing: { before: 100 }, children: [new TextRun({ text: x + ' ______________________________', font: FUENTE_TXT, size: 20, color: TINTA })] }))) });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, borders: { top: sin, bottom: sin, left: sin, right: sin, insideHorizontal: sin, insideVertical: sin },
    rows: [new TableRow({ cantSplit: true, children: [col('EL PROVEEDOR', 'En nombre de:'), col('EL CLIENTE', 'Representante legal de:')] })] });
}
function plantilla(md) {
  const v = version();
  return md.replace(/\{\{VERSION\}\}/g, v).replace(/\{\{FECHA\}\}/g, hoy()).replace(/\{\{ANIO\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{MODULOS_POR_PLAN\}\}/g, () => modulosPorPlan()).replace(/\{\{FIRMAS\}\}/g, () => firmasMd());
}

/* ── Markdown sencillo → docx (títulos, párrafos, negrillas, listas, tablas, notas) ── */
const FUENTE_TXT = 'Calibri', TINTA = '10213A', SUAVE = '5F7390';
function corridas(s, o) {
  return String(s).split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((x) => x.startsWith('**') ? new TextRun(Object.assign({ text: x.slice(2, -2), bold: true, font: FUENTE_TXT, size: 22, color: TINTA }, o || {}))
    : x.startsWith('`') ? new TextRun(Object.assign({ text: x.slice(1, -1), font: 'Consolas', size: 20, color: TINTA }, o || {})) : new TextRun(Object.assign({ text: x, font: FUENTE_TXT, size: 22, color: TINTA }, o || {})));
}
const borde = { style: BorderStyle.SINGLE, size: 4, color: 'C9D2DC' };
function tabla(filas) {
  const enc = filas[0], cuerpo = filas.slice(2), n = enc.length, ancho = Math.floor(9360 / n);
  const celda = (t, cab) => new TableCell({ width: { size: ancho, type: WidthType.DXA }, borders: { top: borde, bottom: borde, left: borde, right: borde },
    shading: cab ? { type: ShadingType.CLEAR, fill: 'EEF3FF', color: 'auto' } : undefined, margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: String(t).split(/\n/).map((l) => new Paragraph({ children: corridas(l.trim(), cab ? { bold: true, size: 20 } : { size: 20 }) })) });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, rows: [new TableRow({ tableHeader: true, children: enc.map((t) => celda(t, true)) })]
    .concat(cuerpo.map((r) => new TableRow({ cantSplit: true, children: enc.map((_, i) => celda(r[i] == null ? '' : r[i], /^\*\*.*\*\*$/.test(String(r[0]).trim()) && i === 0)) }))) });
}
function aDocx(md) {
  const out = [], lineas = md.replace(/\r\n?/g, '\n').split('\n');
  let i = 0, num = 0;
  const celdas = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) { i++; continue; }
    if (l.trim() === '[[FIRMAS]]') { out.push(new Paragraph({ children: [], spacing: { after: 200 }, keepNext: true })); out.push(firmas()); i++; continue; }
    let m;
    if ((m = /^(#{1,3}) (.*)$/.exec(l))) { const n = m[1].length;
      out.push(new Paragraph({ heading: n === 1 ? HeadingLevel.HEADING_1 : n === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, keepNext: true, spacing: { before: n === 1 ? 0 : 240, after: 120 },
        children: [new TextRun({ text: m[2], bold: true, font: FUENTE_TXT, size: n === 1 ? 34 : n === 2 ? 26 : 23, color: TINTA })] })); i++; continue; }
    if (/^\|/.test(l)) { const f = []; let raw = ''; while (i < lineas.length && (/^\|/.test(lineas[i]) || (raw && !/\|\s*$/.test(raw)))) { raw += (raw ? '\n' : '') + lineas[i]; if (/\|\s*$/.test(raw)) { f.push(celdas(raw)); raw = ''; } i++; }
      out.push(tabla(f)); out.push(new Paragraph({ children: [], spacing: { after: 120 } })); continue; }
    if (/^> /.test(l)) { out.push(new Paragraph({ children: corridas(l.slice(2), { italics: true, color: SUAVE, size: 20 }), spacing: { after: 140 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'E0B84D', space: 8 } } })); i++; continue; }
    if (/^- /.test(l)) { while (i < lineas.length && /^- /.test(lineas[i])) { out.push(new Paragraph({ numbering: { reference: 'vin', level: 0 }, children: corridas(lineas[i].slice(2)), spacing: { after: 80, line: 290 } })); i++; } continue; }
    if (/^\d+\. /.test(l)) { num++; while (i < lineas.length && /^\d+\. /.test(lineas[i])) { out.push(new Paragraph({ numbering: { reference: 'num', level: 0, instance: num }, children: corridas(lineas[i].replace(/^\d+\. /, '')), spacing: { after: 80, line: 290 } })); i++; } continue; }
    let p = l; i++; while (i < lineas.length && lineas[i].trim() && !/^(#|\||- |\d+\. |> )/.test(lineas[i])) p += ' ' + lineas[i++].trim();
    out.push(new Paragraph({ children: corridas(p), spacing: { after: 140, line: 300 }, alignment: AlignmentType.JUSTIFIED }));
  }
  return out;
}
async function documento(titulo, md) {
  const v = version();
  const doc = new Document({
    creator: 'Portal SSTA', title: titulo, description: 'Portal SSTA ' + v,
    numbering: { config: [
      { reference: 'vin', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, bottom: 1200, left: 1440, right: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Portal SSTA · ' + titulo + ' · ' + v + ' · ' + hoy(), font: FUENTE_TXT, size: 16, color: SUAVE })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: FUENTE_TXT, size: 16, color: SUAVE }),
        new TextRun({ text: '   ·   Iniciales: ______  ______', font: FUENTE_TXT, size: 16, color: SUAVE })] })] }) },
      children: aDocx(md)
    }]
  });
  return Packer.toBuffer(doc);
}

async function armar(salida) {
  const v = version(), dir = salida || path.join(RAIZ, '..', 'comercial-' + v);
  fs.mkdirSync(dir, { recursive: true });
  const hechos = [];
  for (const [fuente, nombre, titulo] of DOCS) {
    const md = plantilla(fs.readFileSync(path.join(FUENTE, fuente), 'utf8'));
    const f = path.join(dir, nombre + '.docx'); fs.writeFileSync(f, await documento(titulo, md)); hechos.push(f);
  }
  // PDF con LibreOffice, si está (Windows: «soffice» viene con LibreOffice; si no está, quedan los .docx).
  let pdf = false;
  const soffice = ['soffice', 'libreoffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe'].find((c) => { try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } });
  if (soffice) {
    try {
      const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-'));
      execFileSync(soffice, ['-env:UserInstallation=file://' + perfil.replace(/\\/g, '/'), '--headless', '--convert-to', 'pdf', '--outdir', dir].concat(hechos), { stdio: 'ignore', timeout: 180000 });
      pdf = hechos.every((f) => fs.existsSync(f.replace(/\.docx$/, '.pdf')));
    } catch (e) { pdf = false; }
  }
  fs.writeFileSync(path.join(dir, 'LEEME.txt'), 'Documentos comerciales del Portal SSTA ' + v + ' (' + hoy() + ').\r\n\r\n' +
    'Se editan en comercial/*.md del proyecto y se vuelven a armar con: node herramientas/comercial.js\r\n' +
    'La tabla de módulos por plan (Anexo 1) sale del código del portal: no se edita a mano.\r\n' +
    'Llena los espacios entre corchetes [___] para cada cliente. Borrador para revisar con un abogado.\r\n');
  return { dir, docx: hechos.length, pdf };
}
module.exports = { armar, modulosPorPlan, DOCS };
if (require.main === module) armar(process.argv[2] && path.resolve(process.argv[2])).then((r) => console.log('✓ ' + r.docx + ' documentos en ' + r.dir + (r.pdf ? ' (Word y PDF)' : ' (solo Word: instala LibreOffice para el PDF)'))).catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
