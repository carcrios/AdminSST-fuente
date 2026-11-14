/* ============================================================
   lector-examen.js — Lee el concepto de un examen médico ocupacional (v176)
   ------------------------------------------------------------
   Del texto del PDF que entrega la IPS saca SOLO lo que el portal guarda:
   a quién pertenece (cédula → persona del personal), fecha, tipo de examen,
   concepto de aptitud, restricciones o recomendaciones PARA EL TRABAJO,
   si son temporales, la IPS y el próximo examen.
   NUNCA el diagnóstico: se descartan las líneas con códigos CIE-10 o palabras
   como «diagnóstico», «impresión diagnóstica», «enfermedad», «patología».
   El PDF no se guarda (tiene diagnósticos): se lee en el equipo y se descarta.
   Es puro (sin pantalla): lo prueban las pruebas en Node.
   ============================================================ */
const LectorExamen = (function () {
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const dos = (n) => (n < 10 ? '0' : '') + n;
  /** «15/03/2026», «2026-03-15», «15 de marzo de 2026», «15-mar-2026» → «2026-03-15» */
  function fecha(t) {
    const s = sinTildes(t).toLowerCase();
    let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + dos(+m[2]) + '-' + dos(+m[3]);
    m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
    if (m && +m[2] <= 12) return m[3] + '-' + dos(+m[2]) + '-' + dos(+m[1]);
    m = /(\d{1,2})\s*(?:de\s+|[-/.\s])?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?\s*(?:de\s+|[-/.\s])?(\d{4})/.exec(s);
    if (m) return m[3] + '-' + dos(MESES[m[2]]) + '-' + dos(+m[1]);
    return '';
  }
  const DIAG = /\b[A-TV-Z]\d{2}(\.\d{1,2})?\b|diagnost|impresion diagnost|enfermedad|patolog|cie-?10|cie 10|antecedente|hallazgo clinic|dx\b/i;
  /** Lo que sigue a un rótulo («Concepto:», «Restricciones:») hasta el siguiente rótulo conocido. */
  function tras(lineas, re, max) {
    for (let i = 0; i < lineas.length; i++) {
      const m = re.exec(lineas[i]);
      if (!m) continue;
      const out = [],
        resto = lineas[i].slice(m.index + m[0].length).replace(/^[\s:.-]+/, '');
      if (resto) out.push(resto);
      for (let j = i + 1; j < lineas.length && out.length < (max || 6); j++) {
        if (/^\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ ]{2,40}:/.test(lineas[j]) && !/^\s*-/.test(lineas[j])) break;
        if (lineas[j].trim()) out.push(lineas[j].trim());
      }
      return out;
    }
    return [];
  }
  /**
   * @param {string} texto  el texto del PDF
   * @param {Array} personal  [{nombre, cedula, cargo}] — para saber de quién es
   * @returns {{ok, campos, persona, avisos[], descartadas}}
   */
  function leer(texto, personal) {
    const t = String(texto || '').replace(/\r/g, ''),
      n = sinTildes(t).toLowerCase(),
      lineas = t.split(/\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean),
      ln = lineas.map((x) => sinTildes(x).toLowerCase());
    const avisos = [],
      campos = {};
    // ¿De quién es? Cualquier número de 5 a 12 cifras del texto que sea la cédula de alguien del personal.
    const nums = new Set((t.match(/\b\d[\d.]{4,15}\d\b/g) || []).map((x) => x.replace(/\./g, '')).filter((x) => x.length >= 5 && x.length <= 12));
    let persona = null;
    (personal || []).some((p) => {
      const c = String(p.cedula || '').replace(/\D/g, '');
      if (c && nums.has(c)) {
        persona = p;
        return true;
      }
      return false;
    });
    if (!persona) {
      const c = /(?:c\.?\s?c\.?|cedula|documento|identificacion|n[°o]\.?\s*de\s*documento)[^\d]{0,20}([\d.]{5,15})/.exec(n);
      if (c) campos.cedula = c[1].replace(/\./g, '');
      const nm = tras(lineas, /(?:nombre(?: del (?:trabajador|paciente|evaluado))?|paciente|trabajador)\s*:/i, 1)[0];
      if (nm) campos.nombre = nm.replace(/\s+(c\.?c\.?|cedula|documento).*$/i, '').slice(0, 80);
      avisos.push('No encontré la cédula de nadie del personal en el examen: revisa a quién pertenece.');
    } else Object.assign(campos, { nombre: persona.nombre, cedula: persona.cedula, cargo: persona.cargo || '' });
    // Tipo de examen
    const tipos = [
      [/pre-?ingreso|ingreso/, 'Pre-ingreso'],
      [/periodic/, 'Periódico'],
      [/egreso|retiro/, 'Egreso'],
      [/post-?incapacidad|postincapacidad/, 'Post-incapacidad'],
      [/reintegro|retorno/, 'Retorno laboral'],
      [/cambio de (ocupacion|cargo)/, 'Cambio de ocupación'],
      [/seguimiento|control/, 'Seguimiento o control'],
    ];
    const lTipo = ln.find((x) => /tipo de (examen|evaluacion)|evaluacion medica ocupacional|examen medico ocupacional/.test(x)) || n;
    const tp = tipos.find(([re]) => re.test(lTipo)) || tipos.find(([re]) => re.test(n));
    if (tp) campos.tipoExamen = tp[1];
    // Concepto (lo más restrictivo primero)
    const lCon = ln.filter((x) => /concepto|aptitud|resultado/.test(x)).join(' ') || n;
    campos.concepto = /no apto/.test(lCon)
      ? 'No apto'
      : /apto con (restricciones|recomendaciones)|con restricciones/.test(lCon)
        ? 'Apto con restricciones'
        : /aplazad/.test(lCon)
          ? 'Aplazado'
          : /\bapto\b/.test(lCon)
            ? 'Apto'
            : '';
    if (!campos.concepto) avisos.push('No encontré el concepto (apto, apto con restricciones, no apto): escógelo tú.');
    // Fecha del examen y próximo
    const lFec = lineas.find((x, i) => /fecha (del examen|de (la )?evaluacion|de atencion|de expedicion)|^fecha\s*:/.test(ln[i]));
    campos.fecha = fecha(lFec || '') || fecha(t);
    const lProx = lineas.find((x, i) => /proxim[oa] (examen|evaluacion|control)|siguiente (examen|evaluacion)|vigencia hasta/.test(ln[i]));
    const fp = lProx ? fecha(lProx) : '';
    if (fp && fp > (campos.fecha || '')) campos.proxima = fp;
    // IPS / médico
    const ips = lineas.find((x, i) => /\bips\b|institucion prestadora|medico (especialista|ocupacional)|dr\.|dra\./.test(ln[i]) && !DIAG.test(ln[i]));
    if (ips) campos.ips = ips.replace(/^(ips|institucion prestadora[^:]*|medico[^:]*)\s*:\s*/i, '').slice(0, 120);
    // Restricciones / recomendaciones para el trabajo, SIN diagnóstico
    let descartadas = 0;
    const rec = tras(lineas, /(restricciones|recomendaciones)( laborales| ocupacionales| para el trabajo)?\s*:/i, 8).filter((x) => {
      if (DIAG.test(sinTildes(x))) {
        descartadas++;
        return false;
      }
      return !/^(ninguna|no aplica|n\/?a|sin restricciones)\.?$/i.test(x);
    });
    if (rec.length) campos.restricciones = rec.map((x) => x.replace(/^[-•*·\s]+/, '')).join('; ').slice(0, 600);
    if (descartadas) avisos.push('Quité ' + descartadas + ' línea(s) que parecían diagnóstico: el portal no guarda diagnósticos.');
    if (campos.concepto === 'Apto con restricciones' || campos.restricciones) {
      campos.temporalidad = /permanent/.test(n) ? 'Permanentes' : /temporal|por (\d+|un|dos|tres|seis) (dias|meses|semanas)|hasta el/.test(n) ? 'Temporales' : '—';
      const lh = lineas.find((x, i) => /hasta|vigencia de (la )?restriccion/.test(ln[i]) && fecha(x));
      if (campos.temporalidad === 'Temporales' && lh) campos.venceRestriccion = fecha(lh);
    }
    // ¿Remite a vigilancia epidemiológica?
    if (/sistema de vigilancia|programa de vigilancia|\bpve\b|\bsve\b/.test(n)) campos.pveIngresa = 'Sí';
    return { ok: !!(campos.concepto || campos.fecha), campos, persona, avisos, descartadas };
  }
  /** Saca el texto de un PDF con pdf.js (se carga solo cuando se usa). */
  async function textoPdf(archivo) {
    if (typeof pdfjsLib === 'undefined') {
      await new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = 'pdfjs.min.js';
        s.onload = ok;
        s.onerror = () => mal(new Error('No se pudo cargar el lector de PDF.'));
        document.head.appendChild(s);
      });
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs.worker.min.js';
    }
    const datos = new Uint8Array(await archivo.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: datos, isEvalSupported: false }).promise;
    let out = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const pg = await pdf.getPage(p),
        c = await pg.getTextContent();
      let ultY = null;
      c.items.forEach((it) => {
        const y = Math.round(it.transform[5]);
        out += (ultY !== null && Math.abs(y - ultY) > 2 ? '\n' : ' ') + it.str;
        ultY = y;
      });
      out += '\n';
    }
    return out;
  }
  return { leer, textoPdf, fecha };
})();
if (typeof module !== 'undefined') module.exports = LectorExamen;
