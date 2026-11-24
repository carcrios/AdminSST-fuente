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
  const sinTildes = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
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
  /** ¿La línea es un rótulo nuevo? («Concepto:», o un título en MAYÚSCULAS solo en su línea). */
  const esRotulo = (x) =>
    (/^\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ /]{2,40}:/.test(x) && !/^\s*[-•*·]/.test(x)) ||
    (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ /]{4,45}$/.test(x.trim()) && !/^\s*[-•*·]/.test(x));
  /** Lo que sigue a un rótulo («Concepto:», «RECOMENDACIONES») hasta el siguiente rótulo. Junta todos los bloques que coincidan. */
  function tras(lineas, re, max, uno) {
    const out = [];
    for (let i = 0; i < lineas.length; i++) {
      const m = re.exec(lineas[i]);
      if (!m) continue;
      const resto = lineas[i].slice(m.index + m[0].length).replace(/^[\s:.-]+/, '');
      if (resto) out.push(resto);
      let j = i + 1;
      for (; j < lineas.length && out.length < (max || 6); j++) {
        if (esRotulo(lineas[j])) break;
        if (lineas[j].trim()) out.push(lineas[j].trim());
      }
      if (uno) return out;
      i = j - 1;
    }
    return out;
  }
  const RE_REC = new RegExp(
    '(?:recomendaci[oó]n(?:es)?|sugerencias?|indicaciones|conducta|plan de manejo|observaciones)' +
      '(?: m[eé]dic[oa]s?| generales| laborales| ocupacionales| para el trabajador| para la empresa| al empleador)?\\s*(?::|$)',
    'i',
  );
  const sinVacias = (l) =>
    l.filter((x) => !/^(ninguna?|no aplica|n\/?a|sin (restricciones|recomendaciones)|no (tiene|presenta|requiere))\.?$/i.test(sinTildes(x).trim()));
  // Pruebas que trae el examen → nombres de la lista del portal (salud.html, PRUEBAS)
  const PRUEBAS_RE = [
    [/audiometr/, 'Audiometría'],
    [/visiometr/, 'Visiometría'],
    [/optometr/, 'Optometría'],
    [/ishihara|vision de colores|cromatica/, 'Visión de colores (Ishihara)'],
    [/espirometr/, 'Espirometría'],
    [/electrocardiogram|\becg\b|\bekg\b/, 'Electrocardiograma'],
    [/glicemia|glucosa/, 'Glicemia'],
    [/perfil lipidico|colesterol|triglicerid/, 'Perfil lipídico'],
    [/cuadro hematico|hemograma/, 'Cuadro hemático'],
    [/creatinina|transaminas|funcion (hepatica|renal)/, 'Pruebas de función hepática y renal'],
    [/\bbei\b|indicador(es)? biologico/, 'Indicadores biológicos de exposición (BEI)'],
    [/rx de torax|radiografia de torax/, 'Rx de tórax con lectura OIT'],
    [/romberg|equilibrio/, 'Prueba de equilibrio (Romberg)'],
    [/psicosensometr/, 'Prueba psicosensométrica'],
    [/psicolog|psicotecnic/, 'Valoración psicológica'],
    [/coprologic/, 'Coprológico'],
    [/\bkoh\b/, 'KOH de uñas'],
    [/frotis/, 'Frotis de garganta'],
    [/vacuna|hepatitis b|tetano|titulos? de anticuerpos/, 'Vacunación y títulos de anticuerpos (hepatitis B y tétanos)'],
    [/osteomuscular/, 'Énfasis osteomuscular'],
    [/(enfasis|aptitud|examen|evaluacion).{0,30}altura|trabajo (seguro )?en alturas/, 'Énfasis para trabajo en alturas'],
    [/espacios? confinad/, 'Énfasis para espacios confinados'],
  ];
  const TRABAJOS_RE = [
    [/altura/, 'Trabajo en alturas'],
    [/espacios? confinad/, 'Espacios confinados'],
    [/trabajo(s)? en caliente|soldadura/, 'Trabajo en caliente'],
    [/electric/, 'Riesgo eléctrico'],
    [/izaje|montacarga|puente grua/, 'Izaje de cargas'],
    [/(manipulacion|levantamiento|cargue).{0,25}carga|levantar (mas de )?\d+ ?kg|cargas? (mayores|superiores)/, 'Manipulación manual de cargas'],
    [/conduc(ir|cion)|vehiculo|manejo de (vehiculos|motos)/, 'Conducción de vehículos'],
  ];
  const PVE_RE = [
    [/osteomuscular|biomecanic|ergonomic/, 'Osteomuscular'],
    [/auditiv|ruido|hipoacus/, 'Conservación auditiva'],
    [/respiratori/, 'Protección respiratoria'],
    [/psicosocial/, 'Riesgo psicosocial'],
    [/visual/, 'Visual'],
    [/cardiovascular/, 'Riesgo cardiovascular'],
    [/quimic/, 'Riesgo químico'],
    [/biologic/, 'Riesgo biológico'],
    [/radiacion/, 'Radiaciones ionizantes'],
  ];
  /**
   * @param {string} texto  el texto del PDF
   * @param {Array} personal  [{nombre, cedula, cargo}] — para saber de quién es
   * @returns {{ok, campos, persona, avisos[], descartadas}}
   */
  function leer(texto, personal) {
    const t = String(texto || '').replace(/\r/g, ''),
      n = sinTildes(t).toLowerCase(),
      lineas = t
        .split(/\n/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
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
    // Lo que trae el examen de la persona (sirve para crearla si no está en el personal)
    // v180: el nombre COMPLETO. Muchas IPS lo parten en «Nombres:» y «Apellidos:» (o primer/segundo nombre y apellido).
    const limpiaN = (x) =>
      String(x || '')
        .replace(
          /\s+(apellidos?|primer|segundo|c\.?c\.?|t\.?i\.?|c\.?e\.?|cedula|documento|identificacion|tipo|edad|sexo|genero|fecha|cargo|empresa)\b.*$/i,
          '',
        )
        .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñü .'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const val = (re) => limpiaN(tras(lineas, re, 1, true)[0]);
    const leido = {};
    let nomCompleto = val(
      /(?:nombres? y apellidos|apellidos? y nombres?|nombre completo|nombre del (?:trabajador|paciente|evaluado|aspirante)|paciente|trabajador|evaluado|aspirante)\s*:/i,
    );
    if (!nomCompleto) {
      const pn = val(/primer nombre\s*:/i),
        sn = val(/segundo nombre\s*:/i),
        pa = val(/primer apellido\s*:/i),
        sa = val(/segundo apellido\s*:/i);
      const nombres = pn ? [pn, sn].filter(Boolean).join(' ') : val(/\bnombres?\s*:/i);
      const apellidos = pa ? [pa, sa].filter(Boolean).join(' ') : val(/\bapellidos?\s*:/i);
      nomCompleto = [nombres, apellidos].filter(Boolean).join(' ');
    }
    if (nomCompleto) leido.nombre = nomCompleto.slice(0, 90);
    const cg = tras(lineas, /\b(?:cargo(?: a desempe[nñ]ar| actual)?|ocupacion|oficio)\s*:/i, 1, true)[0];
    if (cg) leido.cargo = cg.replace(/\s+(empresa|area|fecha|ips)\b.*$/i, '').slice(0, 60);
    leido.tipoDoc = /\bt\.?\s?i\.?\b|tarjeta de identidad/.test(n)
      ? 'TI'
      : /\bppt\b|permiso por proteccion/.test(n)
        ? 'PPT'
        : /\bpep\b|permiso especial/.test(n)
          ? 'PEP'
          : /\bc\.?\s?e\.?\b|cedula de extranjeria/.test(n)
            ? 'CE'
            : /pasaporte/.test(n)
              ? 'PA'
              : 'CC';
    if (!persona) {
      const c = /(?:c\.?\s?c\.?|cedula|documento|identificacion|n[°o]\.?\s*de\s*documento)[^\d]{0,20}([\d.]{5,15})/.exec(n);
      if (c) campos.cedula = c[1].replace(/\./g, '');
      Object.assign(campos, { nombre: leido.nombre || '', cargo: leido.cargo || '' });
      avisos.push('No encontré la cédula de nadie del personal en el examen: revisa a quién pertenece.');
    } else Object.assign(campos, { nombre: persona.nombre, cedula: persona.cedula, cargo: persona.cargo || leido.cargo || '' });
    // Si en el personal está con menos nombres que en el examen, se completa con el del examen
    if (
      persona &&
      leido.nombre &&
      leido.nombre.split(' ').length >
        String(persona.nombre || '')
          .trim()
          .split(/\s+/).length
    ) {
      campos.nombreAnterior = persona.nombre;
      campos.nombre = leido.nombre;
      avisos.push('En el personal estaba como «' + persona.nombre + '»: se guarda con el nombre completo del examen.');
    }
    campos.tipoDoc = leido.tipoDoc;
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
    const ipsL = tras(lineas, /\b(?:ips|prestador(?: de servicios)?(?: de salud)?|institucion prestadora[^:]*|razon social del prestador)\s*:/i, 1, true)[0];
    const ips =
      ipsL ||
      lineas.find(
        (x, i) => /\bips\b|institucion prestadora|salud ocupacional|medicina (del trabajo|laboral)/.test(ln[i]) && !DIAG.test(ln[i]) && x.length < 90,
      );
    if (ips) campos.ips = ips.replace(/^(ips|institucion prestadora[^:]*|prestador[^:]*)\s*:\s*/i, '').slice(0, 120);
    const med = lineas.find(
      (x, i) => /^(medico( especialista| ocupacional| evaluador)?\s*:|dr\.? |dra\.? )|licencia (sst|en salud ocupacional)/.test(ln[i]) && !DIAG.test(ln[i]),
    );
    if (med) campos.medico = med.replace(/^m[eé]dico[^:]*:\s*/i, '').slice(0, 120);
    // Restricciones y recomendaciones PARA EL TRABAJO, sin diagnóstico (cada bloque por separado)
    let descartadas = 0;
    const limpio = (l) =>
      sinVacias(l)
        .filter((x) => {
          if (DIAG.test(sinTildes(x))) {
            descartadas++;
            return false;
          }
          return true;
        })
        .map((x) => x.replace(/^[-•*·\d.)\s]+/, '').trim())
        .filter(Boolean);
    const res = limpio(tras(lineas, /restricci[oó]n(?:es)?(?: medic[oa]s?)?(?: laborales| ocupacionales| para el trabajo)?\s*(?::|$)/i, 10));
    const rec = limpio(tras(lineas, RE_REC, 14)).filter((x) => res.indexOf(x) === -1);
    // v180: restricciones y recomendaciones van en campos distintos
    if (res.length) campos.restricciones = res.join('; ').slice(0, 800);
    if (rec.length) campos.recomendaciones = rec.join('; ').slice(0, 800);
    if (res.length) campos.listaRestricciones = res;
    if (rec.length) campos.listaRecomendaciones = rec;
    if (descartadas) avisos.push('Quité ' + descartadas + ' línea(s) que parecían diagnóstico: el portal no guarda diagnósticos.');
    if (campos.concepto === 'Apto con restricciones' || res.length) {
      const nt = sinTildes(res.join(' ') + ' ' + ln.filter((x) => /restricci|temporalidad|concepto/.test(x)).join(' ')).toLowerCase();
      campos.temporalidad = /temporal|transitori|por (\d+|un|dos|tres|seis) (dias|meses|semanas)|hasta (el|nueva)/.test(nt)
        ? 'Temporales'
        : /permanent|definitiv/.test(nt)
          ? 'Permanentes'
          : '—';
      const lh = lineas.find((x, i) => /hasta|vigencia de (la )?restriccion/.test(ln[i]) && fecha(x));
      const dur = /por (\d+|un|dos|tres|seis) (dias|semanas|meses)/.exec(nt);
      if (campos.temporalidad === 'Temporales' && lh) campos.venceRestriccion = fecha(lh);
      else if (campos.temporalidad === 'Temporales' && dur && campos.fecha) {
        const num = { un: 1, dos: 2, tres: 3, seis: 6 }[dur[1]] || +dur[1],
          dias = dur[2] === 'dias' ? num : dur[2] === 'semanas' ? num * 7 : num * 30;
        campos.venceRestriccion = new Date(Date.parse(campos.fecha + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10);
      }
    }
    // ¿Para qué trabajos queda restringido? (lo usan los permisos). «no apto para alturas» o una restricción que lo nombre.
    const textoRes = sinTildes(
      res.join(' ') +
        ' ' +
        ln
          .filter(
            (x) =>
              /no apto|restring|restricci|no (puede|debe|realizar|realiza)|evitar|abstener/.test(x) && !/\bapto para\b(?!.*no)/.test(x.replace(/no apto/g, '')),
          )
          .join(' '),
    ).toLowerCase();
    const restr = TRABAJOS_RE.filter(([re]) => re.test(textoRes)).map(([, t]) => t);
    if (restr.length) campos.restringePara = restr;
    // Pruebas realizadas
    const quitar = new Set(res.concat(rec).map((x) => sinTildes(x).toLowerCase()));
    const nPr = ln
      .filter((x) => !/vigilancia|\bpve\b|\bsve\b|restricci|no (realizar|puede|debe)/.test(x) && ![...quitar].some((q) => q && x.indexOf(q) !== -1))
      .join('\n');
    const pr = PRUEBAS_RE.filter(([re]) => re.test(nPr)).map(([, t]) => t);
    if (pr.length) campos.pruebas = ['Examen médico ocupacional'].concat(pr);
    // ¿Remite a vigilancia epidemiológica? ¿A cuál?
    const lVig = ln.filter((x) => /vigilancia|\bpve\b|\bsve\b|programa de (conservacion|prevencion|proteccion)/.test(x)).join(' ');
    if (lVig) {
      campos.pveIngresa = 'Sí';
      const pv = PVE_RE.filter(([re]) => re.test(lVig)).map(([, t]) => t);
      if (pv.length) campos.pveLista = pv;
    }
    campos.leido = leido;
    // ¿El PDF trae diagnóstico? Entonces NO se puede adjuntar (la empresa solo recibe el concepto: Res. 1843 de 2025, art. 30).
    const conDiagnostico = descartadas > 0 || /diagnost|cie-?10|cie 10|impresion diag|\bdx\b/.test(n);
    return { conDiagnostico, ok: !!(campos.concepto || campos.fecha), campos, persona, avisos, descartadas };
  }
  /**
   * v187: las filas de la hoja como se ven (de arriba abajo, de izquierda a derecha), con la posición de cada celda.
   * Con esto el FURAT se lee por columnas: el dato es lo que está debajo (o a la derecha) de su rótulo.
   */
  function ordenarCeldas(items, p) {
    const fs = [];
    (items || []).forEach((it) => {
      const s = String(it.str || '').trim();
      if (!s) return;
      const x = it.transform[4],
        y = it.transform[5],
        w = it.width || s.length * 4;
      let f = fs.find((r) => Math.abs(r.y - y) <= 3);
      if (!f) fs.push((f = { p: p || 1, y, c: [] }));
      f.c.push({ x, x2: x + w, s });
    });
    fs.sort((a, b) => b.y - a.y);
    fs.forEach((f) => {
      f.c.sort((a, b) => a.x - b.x);
      const celdas = [];
      f.c.forEach((k) => {
        const u = celdas[celdas.length - 1];
        if (u && k.x - u.x2 < 6) {
          u.s += (k.x - u.x2 > 1.5 ? ' ' : '') + k.s;
          u.x2 = k.x2;
        } else celdas.push({ x: k.x, x2: k.x2, s: k.s });
      });
      f.c = celdas;
    });
    return fs;
  }

  /**
   * v187: las casillas y círculos marcados. Los FURAT de las ARL (SURA, Positiva…) dibujan cada opción como una
   * imagen pequeña: la marcada tiene el centro oscuro. Se dibuja la hoja y se mira el centro de cada una.
   */
  async function marcasPagina(pg, p) {
    const OPS = pdfjsLib.OPS,
      ol = await pg.getOperatorList(),
      pila = [],
      cajas = [];
    let m = [1, 0, 0, 1, 0, 0];
    const por = (a, b) => [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5],
    ];
    const caja = (t) => {
      const w = Math.hypot(t[0], t[1]),
        h = Math.hypot(t[2], t[3]);
      if (w >= 4 && w <= 16 && Math.abs(w - h) < 2.5) cajas.push({ x: t[4] + t[0] / 2 + t[2] / 2, y: t[5] + t[1] / 2 + t[3] / 2, w });
    };
    ol.fnArray.forEach((fn, i) => {
      const ar = ol.argsArray[i];
      if (fn === OPS.save) pila.push(m.slice());
      else if (fn === OPS.restore) m = pila.pop() || m;
      else if (fn === OPS.transform) m = por(m, ar);
      else if (fn === OPS.paintFormXObjectBegin) {
        pila.push(m.slice());
        if (ar && ar[0]) m = por(m, ar[0]);
      } else if (fn === OPS.paintFormXObjectEnd) m = pila.pop() || m;
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) caja(m);
      else if (fn === OPS.paintImageXObjectRepeat && ar && ar[3])
        for (let k = 0; k + 1 < ar[3].length; k += 2) caja(por(m, [ar[1], 0, 0, ar[2], ar[3][k], ar[3][k + 1]]));
    });
    if (cajas.length < 2 || typeof document === 'undefined') return [];
    const vp = pg.getViewport({ scale: 3 }),
      cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#fff';
    cx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: cx, viewport: vp }).promise;
    return cajas
      .filter((b) => {
        const q = vp.convertToViewportPoint(b.x, b.y),
          r = Math.max(1, Math.round(b.w * 3 * 0.12)),
          d = cx.getImageData(Math.round(q[0]) - r, Math.round(q[1]) - r, 2 * r + 1, 2 * r + 1).data;
        let s = 0;
        for (let k = 0; k < d.length; k += 4) s += (d[k] + d[k + 1] + d[k + 2]) / 3;
        return s / (d.length / 4) < 140;
      })
      .map((b) => ({ p, x: b.x, y: b.y }));
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
    let pares = '';
    const filas = [],
      marcas = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
      const pg = await pdf.getPage(p),
        c = await pg.getTextContent();
      // Formularios rellenables: el dato está en el campo, no en el texto
      try {
        (await pg.getAnnotations()).forEach((a) => {
          if (!a || !a.fieldName) return;
          let v = a.fieldValue;
          if (a.checkBox || a.radioButton) v = a.fieldValue && a.fieldValue !== 'Off' ? a.buttonValue || a.fieldValue || 'X' : '';
          if (Array.isArray(v)) v = v.join(', ');
          v = String(v == null ? '' : v).trim();
          const r = String(a.alternativeText || a.fieldName).replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim();
          if (v && v !== 'Off') pares += r + ': ' + v + '\n';
        });
      } catch (e) {}
      ordenarCeldas(c.items, p).forEach((f) => filas.push(f));
      try {
        (await marcasPagina(pg, p)).forEach((m) => marcas.push(m));
      } catch (e) {}
    }
    const out = filas.map((f) => f.c.map((k) => k.s).join('   ')).join('\n');
    LectorExamen.ultimoPdf = { pares: pares.trim(), texto: out.trim(), filas, marcas, sinTexto: !out.replace(/\s/g, '') && !pares };
    return (pares ? pares + '\n' : '') + out;
  }

  /**
   * v180: el informe de condiciones de salud que entrega la IPS (diagnóstico colectivo, sin nombres).
   * Saca año, fecha, IPS, cuántos evaluados, edad promedio, hombres y mujeres, los % de estilos de vida,
   * los hallazgos y las recomendaciones. Lo que no encuentre queda vacío para escribirlo a mano.
   */
  function condiciones(texto) {
    const t = String(texto || '').replace(/\r/g, ''),
      lineas = t
        .split(/\n/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      ln = lineas.map((x) => sinTildes(x).toLowerCase()),
      n = ln.join('\n');
    const c = {},
      avisos = [];
    const num = (x) => {
      const v = Number(
        String(x)
          .replace(/\.(?=\d{3}\b)/g, '')
          .replace(',', '.'),
      );
      return isNaN(v) ? '' : v;
    };
    /** El número que acompaña a un rótulo, en la misma línea (antes o después) o en la siguiente. */
    const cerca = (re, pct) => {
      for (let i = 0; i < ln.length; i++) {
        if (!re.test(ln[i])) continue;
        const lin = ln[i] + ' ' + (ln[i + 1] || '');
        const m = pct
          ? /(\d{1,3}(?:[.,]\d+)?)\s*%/.exec(lin) || /:\s*(\d{1,3}(?:[.,]\d+)?)/.exec(lin)
          : /(?::|=|\b)\s*(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)\b(?!\s*%)/.exec(ln[i].replace(re, ' ')) || /^(\d+(?:[.,]\d+)?)/.exec(ln[i + 1] || '');
        if (m) return num(m[1]);
      }
      return '';
    };
    const anio = /(?:ano|vigencia|periodo)\s*:?\s*(20\d{2})/.exec(n) || /\b(20\d{2})\b/.exec(n);
    if (anio) c.anio = anio[1];
    const lf = lineas.find((x, i) => /fecha (del informe|de elaboracion|de entrega|de emision)|^fecha\s*:/.test(ln[i]));
    c.fecha = fecha(lf || '') || '';
    const ips = tras(lineas, /\b(?:ips|prestador(?: de servicios)?(?: de salud)?|elaborado por|realizado por)\s*:/i, 1, true)[0];
    if (ips) c.ips = ips.slice(0, 120);
    c.trabajadores = cerca(
      /(trabajadores|personas|poblacion|total) (evaluad|valorad|examinad|atendid)|total de (trabajadores|evaluados)|n(umero)? de (trabajadores|evaluados)/,
    );
    c.edadPromedio = cerca(/edad promedio|promedio de edad|media de edad/);
    c.hombres = cerca(/\b(hombres|masculino)\b/);
    c.mujeres = cerca(/\b(mujeres|femenino)\b/);
    c.fumadores = cerca(/fumador|tabaquismo|consumo de (tabaco|cigarrillo)/, true);
    c.sedentarismo = cerca(/sedentari|inactividad fisica|no realiza(n)? (actividad|ejercicio)/, true);
    c.sobrepeso = cerca(/sobrepeso|obesidad|imc (elevado|alto)/, true);
    c.alcohol = cerca(/alcohol/, true);
    if (c.edadPromedio && (c.edadPromedio < 15 || c.edadPromedio > 80)) c.edadPromedio = '';
    ['fumadores', 'sedentarismo', 'sobrepeso', 'alcohol'].forEach((k) => {
      if (c[k] !== '' && c[k] > 100) c[k] = '';
    });
    let quitadas = 0;
    const limpio = (l) =>
      l
        .map((x) => x.replace(/^[-•*·\d.)\s]+/, '').trim())
        .filter((x) => {
          if (!x) return false;
          if (/\b\d{6,12}\b/.test(x)) {
            quitadas++;
            return false;
          } // nada que identifique personas
          return true;
        });
    const hall = limpio(
      tras(
        lineas,
        /(?:principales )?(?:hallazgos|conclusiones|resultados principales|principales resultados|morbilidad sentida|diagnosticos? mas frecuentes|analisis)\s*(?::|$)/i,
        14,
      ),
    );
    const rec = limpio(tras(lineas, RE_REC, 14));
    if (hall.length) c.hallazgos = hall.join('\n').slice(0, 2000);
    if (rec.length) c.recomendaciones = rec.join('\n').slice(0, 2000);
    if (quitadas) avisos.push('Quité ' + quitadas + ' línea(s) con números de documento: el diagnóstico es agregado, sin nombres.');
    const leidos = Object.keys(c).filter((k) => c[k] !== '' && c[k] != null).length;
    if (leidos < 3) avisos.push('Encontré poca información en el PDF (¿es una imagen escaneada?): complétalo a mano.');
    return { campos: c, avisos, leidos };
  }
  /**
   * v187: el FURAT leído por su forma, no por palabras sueltas. Cada dato es lo que está DEBAJO (o a la derecha)
   * de su rótulo, en la misma columna; las opciones (parte del cuerpo, tipo de lesión, agente, mecanismo, sitio,
   * ¿causó la muerte?) son solo las MARCADAS. Probado con el FURAT de ARL SURA y el de Colmena Seguros.
   * Lo que no esté en el PDF queda vacío: nunca se inventa.
   */
  function furat(texto, listas) {
    const t = String(texto || '').replace(/\r/g, '');
    const est = LectorExamen.ultimoPdf;
    let filas, marcas;
    const deTexto = (txt) =>
      txt.split('\n').map((l, i) => {
        const c = [];
        const re = /\S+(?: \S+)*/g;
        let m;
        while ((m = re.exec(l))) c.push({ x: m.index * 5, x2: (m.index + m[0].length) * 5, s: m[0] });
        return { p: 1, y: -i * 12, c };
      }).filter((f) => f.c.length);
    const conPares = !!(est && est.pares);
    if (est && est.filas && est.filas.length && est.texto && t.indexOf(est.texto.slice(0, 300)) !== -1 && !conPares) {
      filas = est.filas;
      marcas = est.marcas || [];
    } else {
      // Sin posiciones (texto pegado, o campos rellenables «Rótulo: dato»): la columna es la posición del carácter
      filas = deTexto(t);
      marcas = [];
    }
    const nz = (x) => sinTildes(x).toLowerCase().replace(/\s+/g, ' ').replace(/\s*:$/, '').trim();
    // «Rótulo: dato» en una misma celda → dos celdas (el dato queda a la derecha del rótulo)
    filas = filas.map((f) => {
      const c = [];
      f.c.forEach((k) => {
        const m = /^([A-Za-zÁÉÍÓÚÑáéíóúñ¿?() /.]{3,60}):\s*(.*)$/.exec(k.s);
        if (!m) return c.push(Object.assign({}, k));
        const xm = k.x + (m[1].length + 1) * ((k.x2 - k.x) / Math.max(1, k.s.length));
        c.push({ x: k.x, x2: xm, s: m[1], dos: true });
        if (m[2].trim()) c.push({ x: xm + 0.5, x2: k.x2, s: m[2].trim() });
      });
      return { p: f.p, y: f.y, c };
    });
    filas.forEach((f) => f.c.forEach((k) => (k.n = nz(k.s))));
    const c = {},
      avisos = [];
    /** La primera celda que dice eso (desde la fila «desde»). */
    const celda = (re, desde) => {
      for (let i = desde || 0; i < filas.length; i++) {
        const j = filas[i].c.findIndex((k) => re.test(k.n));
        if (j !== -1) return { i, j, k: filas[i].c[j], f: filas[i] };
      }
      return null;
    };
    const fila = (re, desde) => {
      const r = celda(re, desde);
      return r ? r.i : -1;
    };
    /** Lo que está debajo del rótulo, en su columna (hasta donde empieza el rótulo siguiente). */
    const abajo = (r, filasMax) => {
      if (!r) return '';
      const sig = r.f.c[r.j + 1],
        x0 = r.k.x - 14,
        x1 = sig ? sig.x - 3 : 1e9;
      for (let i = r.i + 1; i <= Math.min(filas.length - 1, r.i + (filasMax || 2)); i++) {
        if (filas[i].p !== r.f.p) break;
        const v = filas[i].c.filter((k) => k.x >= x0 && k.x < x1);
        if (v.length) return v.map((k) => k.s).join(' ').trim();
      }
      return '';
    };
    const derecha = (r) => (r && r.f.c[r.j + 1] ? r.f.c[r.j + 1].s.trim() : '');
    /** El dato del rótulo: a la derecha si el rótulo termina en «:» y trae dato; si no, debajo. */
    const dato = (r) => (r && r.k.dos ? derecha(r) || (r.f.c.length === 1 ? abajo(r) : '') : abajo(r));
    /** Para las listas (parte del cuerpo…): lo de debajo solo si es UN valor, no la lista de opciones sin marcar. */
    const unico = (r) => {
      if (!r) return '';
      if (r.k.dos) return derecha(r);
      const v = abajo(r, 1);
      const sg = filas[r.i + 2];
      if (!v || !sg || sg.p !== r.f.p) return v;
      const deb = sg.c.find((k) => k.x >= r.k.x - 14 && k.x < r.k.x + 60);
      return !deb || /^(agente|mecanismo|tipo de|parte del|sitio|lugar|descripcion|el accidente|iv\.|personas|hubo)/.test(deb.n) ? v : '';
    };
    /** La opción marcada debajo del rótulo (hasta el rótulo «hasta»), en su columna. */
    const marcada = (r, hasta, soloFila) => {
      if (!r || !marcas.length) return '';
      const sig = r.f.c[r.j + 1],
        x1 = sig ? sig.x - 4 : 1e9,
        yFin = hasta && hasta.f.p === r.f.p ? hasta.f.y : -1e9;
      const ms = marcas
        .filter((m) => m.p === r.f.p && m.y < r.f.y + 2 && m.y > yFin + 2 && m.x >= r.k.x - 16 && m.x < x1 && (!soloFila || r.f.y - m.y < 22))
        .sort((a, b) => b.y - a.y || a.x - b.x);
      for (const m of ms) {
        const f = filas.find((z) => z.p === m.p && Math.abs(z.y - (m.y - 2.5)) <= 4.5);
        const k = f && f.c.filter((z) => z.x > m.x && z.x - m.x < 40).sort((a, b) => a.x - b.x)[0];
        if (k) return k.s.trim();
      }
      return '';
    };
    const marcadaDer = (r) => {
      if (!r || !marcas.length) return '';
      const m = marcas.filter((z) => z.p === r.f.p && Math.abs(z.y - 2.5 - r.f.y) <= 5 && z.x > r.k.x2).sort((a, b) => a.x - b.x)[0];
      const k = m && r.f.c.filter((z) => z.x > m.x && z.x - m.x < 40).sort((a, b) => a.x - b.x)[0];
      return k ? k.s.trim() : '';
    };
    const ddmmaaaa = (v) => {
      const m = /\b(\d{2})(\d{2})(\d{4})\b/.exec(String(v || ''));
      return m && +m[2] >= 1 && +m[2] <= 12 && +m[1] <= 31 ? m[3] + '-' + m[2] + '-' + m[1] : fecha(v);
    };
    const horaDe = (v) => {
      const h = /(\d{1,2})\s?:\s?(\d{2})(?::\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i.exec(String(v || ''));
      if (!h) return '';
      let hh = +h[1];
      if (h[3] && /p/i.test(h[3]) && hh < 12) hh += 12;
      if (h[3] && /a/i.test(h[3]) && hh === 12) hh = 0;
      return hh < 24 ? dos(hh) + ':' + h[2] : '';
    };
    const iP = conPares ? 0 : Math.max(0, fila(/identificacion de la persona|informacion de la persona|datos del trabajador|persona que se accidento/)),
      iA = conPares ? 0 : Math.max(iP, fila(/informacion sobre el accidente|datos del accidente/, iP));
    // Radicado: rotulado, o el número suelto arriba de la primera hoja (Colmena)
    const rad =
      /(?:radicado|n(?:umero|o\.?|°)\s*(?:de\s*)?(?:radicacion|reporte|radicado|siniestro)|consecutivo|numero del reporte)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(sinTildes(t));
    if (rad) c.numero = rad[1];
    else {
      const f0 = filas.slice(0, 3).find((f) => f.p === 1 && f.c.length === 1 && /^\d{5,12}$/.test(f.c[0].s));
      if (f0) c.numero = f0.c[0].s;
    }
    const fr = celda(/^fecha de (diligenciamiento|radicacion|radicado|recibido)/);
    if (fr) c.fechaRadicado = ddmmaaaa(fr.f.c.slice(fr.j + 1).map((k) => k.s).join(' ') || abajo(fr));
    // Fecha y hora del accidente
    const fa = celda(/^fecha (y hora )?del accidente$|^fecha de ocurrencia|^fecha del evento/, iA) || celda(/^fecha (y hora )?del accidente/);
    const vfa = dato(fa) || derecha(fa);
    c.fecha = ddmmaaaa(vfa);
    c.hora = horaDe(vfa) || horaDe(dato(celda(/^hora( del accidente| de ocurrencia)?$/, iA)));
    // El accidentado
    const limpia = (v) => String(v || '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñü .'-]/g, '').replace(/\s+/g, ' ').trim();
    const no = limpia(dato(celda(/^nombres?$/, iP))),
      pa = limpia(dato(celda(/^primer apellido$/, iP))),
      sa = limpia(dato(celda(/^segundo apellido$/, iP)));
    let nom = [no, pa, sa].filter(Boolean).join(' ');
    if (!nom) nom = limpia(dato(celda(/^(apellidos y nombres|nombre completo|nombre del (trabajador|accidentado|lesionado))$/, iP)));
    if (nom.split(' ').length >= 2) c.nombre = nom.slice(0, 90);
    const id = celda(/^(numero|numero de (identificacion|documento)|identificacion|documento de (identidad|identificacion)|cedula)$/, iP);
    const vid = /\b(\d{5,12})\b/.exec((dato(id) + ' ' + derecha(id)).replace(/\./g, ''));
    if (vid) c.cedula = vid[1];
    const cg = limpia(dato(celda(/^cargo$/, iP)));
    if (cg) c.cargo = cg.slice(0, 60);
    // Dónde
    const hLes = celda(/^tipo de lesion$/, iA),
      hAge = celda(/^agente del accidente/, iA),
      hMec = celda(/^mecanismos? o forma del accidente$/, iA),
      hDes = celda(/descripcion del accidente$/, iA);
    const sitio = marcada(celda(/^indique cual sitio$/, iA), hLes) || unico(celda(/^sitio de ocurrencia$|^sitio donde ocurrio/, iA));
    const rl = celda(/^lugar (donde ocurrio|del accidente|de ocurrencia)/, iA);
    const lugar = marcadaDer(rl) || (marcas.length ? '' : unico(rl));
    const muni = dato(celda(/^municipio (del accidente|de ocurrencia)$/, iA));
    c.lugar = [sitio, lugar && !sitio ? lugar : '', muni].filter(Boolean).join(' — ').slice(0, 120);
    // Clasificación: solo lo marcado (o lo escrito debajo del rótulo)
    const parte = marcada(celda(/^parte del cuerpo/, iA), hLes) || unico(celda(/^parte del cuerpo/, iA));
    const tipo = marcada(hLes, hAge) || unico(hLes);
    const agente = marcada(hAge, hDes) || unico(hAge);
    const meca = marcada(hMec, hDes) || unico(hMec);
    const muerte = celda(/causo la muerte|genero muerte|accidente mortal/, iA);
    const vm = marcada(muerte, null, true) || (/^(si|no)$/i.test(nz(dato(muerte))) ? dato(muerte) : '');
    c.mortal = /^si\b/i.test(nz(vm));
    // Mapear a las listas del portal (por palabras en común); si no hay, «Otro»
    const mapa = (lista, v) => {
      if (!v || !lista || !lista.length) return '';
      const pal = (x) => nz(x).split(/[^a-z]+/).filter((w) => w.length >= 3 && !/^(del|las|los|por|con|sin|que|otr[oa]s?|y\/o|incluye)$/.test(w)).map((w) => w.slice(0, 5));
      const pv = pal(v);
      let mejor = '',
        pun = 0;
      lista.forEach((o) => {
        const po = pal(o),
          igual = (w) => po.some((z) => z.indexOf(w) === 0 || w.indexOf(z) === 0),
          n = pv.filter(igual).length + (pv[0] && igual(pv[0]) ? 0.5 : 0);
        if (n > pun) {
          pun = n;
          mejor = o;
        }
      });
      if (mejor) return mejor;
      return /^otr/.test(nz(v)) ? lista.find((o) => /^otr/i.test(sinTildes(o))) || '' : '';
    };
    c.parteCuerpo = mapa(listas && listas.parte, parte);
    c.tipoLesion = mapa(listas && listas.tipo, tipo);
    c.agente = mapa(listas && listas.agente, agente);
    c.mecanismo = mapa(listas && listas.mecanismo, meca);
    c.grave = c.mortal || /amputa/.test(nz(tipo));
    c.leido = { parte, tipo, agente, mecanismo: meca, sitio, muerte: vm };
    // Descripción: las filas debajo del rótulo hasta «Personas que presenciaron»
    if (hDes && hDes.k.dos && derecha(hDes)) c.descripcion = derecha(hDes).slice(0, 1500);
    else if (hDes) {
      let fin = fila(/personas que presenciaron/, hDes.i + 1);
      const fr2 = filas.findIndex((f, i) => i > hDes.i && f.c[0] && f.c[0].dos && /^(nombre|persona|firma|responsable|cargo|fecha)/.test(f.c[0].n));
      if (fr2 !== -1 && (fin === -1 || fr2 < fin)) fin = fr2;
      const vistas = {};
      const ls = filas
        .slice(hDes.i + 1, fin === -1 ? hDes.i + 14 : fin)
        .map((f) => f.c.map((k) => k.s).join(' ').trim())
        .filter((x) => x && !/^(observaciones|todos los derechos reservados)/i.test(sinTildes(x)) && !vistas[x] && (vistas[x] = 1));
      if (ls.length) c.descripcion = ls.join(' ').replace(/\s+/g, ' ').slice(0, 1500);
      // v188: Colmena pega el aviso telefónico («cargo : … descripción evento : …»): el relato es lo que sigue a «descripción evento»
      const txt = (f) => f.c.map((k) => k.s).join(' ').replace(/\s+/g, ' ').trim();
      const iE = filas.findIndex((f, i) => i > hDes.i && /^descripci[oó]n (del )?evento\b/i.test(sinTildes(txt(f)).replace(/descripcion/i, 'descripción')));
      if (iE !== -1) {
        const rel = [txt(filas[iE]).replace(/^.*?evento\s*:?\s*/i, '')];
        for (let i = iE + 1; i < filas.length && i < iE + 8; i++) {
          const x = txt(filas[i]);
          if (!x || /^[^:]{1,25}:|personas que presenciaron|^\d{7,}/i.test(x)) break;
          rel.push(x);
        }
        const r = rel.join(' ').replace(/\s+/g, ' ').trim();
        if (r.length > 15) c.descripcion = r.charAt(0).toUpperCase() + r.slice(1, 1500);
      }
    }
    // Testigos: solo los que tienen nombre escrito
    const iT = fila(/personas que presenciaron/, iA);
    if (iT !== -1) {
      const hubo = marcadaDer(celda(/hubo personas que presenciaron/, iT));
      const iR = fila(/persona responsable del informe/, iT + 1);
      const tes = [];
      if (!/^no$/i.test(hubo))
        filas.slice(iT + 1, iR === -1 ? iT + 8 : iR).forEach((f) => {
          const cs = f.c.map((k) => k.s.trim()).filter((s) => !/^(apellidos y nombres|nombre|identificaci[oó]n|documento de identidad|cargo|no\.?|cc|ti|ce|nu|pa|si|hubo personas.*)$/i.test(s));
          const n = cs.find((s) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ .'-]+$/.test(s) && s.split(' ').length >= 2);
          const d = cs.find((s) => /^\d{5,12}$/.test(s));
          if (n) tes.push(n + (d ? ' (' + d + ')' : ''));
        });
      if (tes.length) c.testigos = tes.slice(0, 4).join(', ');
    }
    const leidos = ['numero', 'fecha', 'nombre', 'cedula', 'descripcion'].filter((k) => c[k]).length;
    if (est && est.sinTexto)
      avisos.push('Ese PDF es una imagen (escaneado o foto): no tiene texto que leer. Descarga el FURAT original de la página de la ARL o llena los datos a mano.');
    else if (leidos < 3) avisos.push('Encontré poca información en el PDF: completa a mano lo que falte.');
    if (!c.numero) avisos.push('El FURAT no trae número de radicado: escríbelo si la ARL te lo dio.');
    return { campos: c, avisos, leidos };
  }
  const LectorExamen = { leer, textoPdf, fecha, condiciones, furat, ordenarCeldas };
  return LectorExamen;
})();
if (typeof module !== 'undefined') module.exports = LectorExamen;
