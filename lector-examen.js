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
   * v181: el FURAT (Formato Único de Reporte de Accidente de Trabajo) que se radicó en la ARL.
   * Saca el radicado, la fecha de radicado, el accidentado, la fecha, hora y lugar del accidente,
   * la descripción y, si se les pasa las listas del portal, parte del cuerpo, tipo de lesión, mecanismo y agente.
   */
  function furat(texto, listas) {
    const t = String(texto || '').replace(/\r/g, ''),
      lineas = t
        .split(/\n/)
        .map((x) => x.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      ln = lineas.map((x) => sinTildes(x).toLowerCase()),
      n = ln.join('\n');
    const c = {},
      avisos = [];
    const val = (re) => (tras(lineas, re, 1, true)[0] || '').replace(/\s{2,}.*$/, '').trim();
    const rad =
      /(?:radicado|n(?:umero|o\.?|°)\s*(?:de\s*)?(?:radicacion|reporte|radicado|siniestro)|consecutivo|numero del reporte)\s*:?\s*([A-Z0-9][A-Z0-9-]{3,})/i.exec(
        sinTildes(t),
      );
    if (rad) c.numero = rad[1];
    const lfr = lineas.find((x, i) => /fecha (de )?(radicacion|radicado|diligenciamiento|del reporte|de reporte|de envio)/.test(ln[i]));
    c.fechaRadicado = fecha(lfr || '');
    const lfa = lineas.find((x, i) => /fecha (del|de ocurrencia del|en que ocurrio el) accidente|fecha del evento|fecha de ocurrencia/.test(ln[i]));
    c.fecha = fecha(lfa || '');
    const lh = lfa ? lineas[lineas.indexOf(lfa)] + ' ' + (lineas[lineas.indexOf(lfa) + 1] || '') : '';
    const hora = /(?:hora[^0-9]{0,15})?(\d{1,2})[:.h](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i.exec(
      sinTildes(lineas.find((x, i) => /\bhora\b/.test(ln[i])) || lh),
    );
    if (hora) {
      let hh = +hora[1];
      if (hora[3] && /p/i.test(hora[3]) && hh < 12) hh += 12;
      if (hora[3] && /a/i.test(hora[3]) && hh === 12) hh = 0;
      if (hh < 24) c.hora = (hh < 10 ? '0' : '') + hh + ':' + hora[2];
    }
    // El accidentado: nombre completo (también partido en apellidos y nombres), documento y cargo
    const limpiaN = (x) =>
      String(x || '')
        .replace(/\s+(apellidos?|primer|segundo|nombres?|documento|identificacion|tipo|cedula|c\.?c\.?|fecha|sexo|cargo)\b.*$/i, '')
        .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñü .'-]/g, '')
        .trim();
    const pa = limpiaN(val(/primer apellido\s*:?/i)),
      sa = limpiaN(val(/segundo apellido\s*:?/i)),
      no = limpiaN(val(/\bnombres?\s*:/i));
    let nom = limpiaN(val(/(?:nombre(?:s)? (?:y apellidos|completo)|nombre del (?:trabajador|accidentado|lesionado))\s*:?/i));
    if (!nom && (no || pa)) nom = [no, pa, sa].filter(Boolean).join(' ');
    if (nom) c.nombre = nom.slice(0, 90);
    const ced = /(?:c\.?\s?c\.?|cedula|documento|identificacion)[^\d]{0,30}([\d.]{5,15})/i.exec(sinTildes(t));
    if (ced) c.cedula = ced[1].replace(/\./g, '');
    const cg = val(/\b(?:cargo|ocupaci[oó]n habitual|ocupaci[oó]n|oficio)\s*:?/i);
    if (cg && !/^\d+$/.test(cg)) c.cargo = cg.replace(/\s+(tiempo|fecha|salario|jornada)\b.*$/i, '').slice(0, 60);
    const lugar = val(
      /(?:lugar donde ocurri[oó](?: el accidente)?|sitio (?:donde ocurri[oó]|del accidente)|lugar del accidente|lugar de ocurrencia|direcci[oó]n (?:del|donde ocurri[oó] el) accidente)\s*:?/i,
    );
    if (lugar) c.lugar = lugar.slice(0, 120);
    const desc = tras(lineas, /descripci[oó]n (?:del accidente|de los hechos|del evento)[^:]*:?/i, 12, true)
      .filter((x) => !/^(nombre|cedula|firma|cargo|fecha)\b/i.test(sinTildes(x)))
      .join(' ');
    if (desc) c.descripcion = desc.slice(0, 1500);
    c.mortal = /causo la muerte[^\n]{0,20}\bsi\b|accidente mortal|fallecio/.test(n);
    c.grave = c.mortal || /amputacion|fractura|trauma craneoencefalico|perdida (de|del) (ojo|vision)|quemadura de (segundo|tercer) grado/.test(n);
    // Clasificación: el primer valor de cada lista del portal que aparezca en el FURAT
    const busca = (lista, rotulo) => {
      if (!lista || !lista.length) return '';
      const i = ln.findIndex((x) => rotulo.test(x));
      const zona = i >= 0 ? ln.slice(i, i + 4).join(' ') : n;
      const hit =
        lista.find((v) => v && zona.indexOf(sinTildes(v).toLowerCase()) !== -1) ||
        lista.find((v) => v && sinTildes(v).length > 5 && n.indexOf(sinTildes(v).toLowerCase()) !== -1);
      return hit || '';
    };
    if (listas) {
      c.parteCuerpo = busca(listas.parte, /parte del cuerpo/);
      c.tipoLesion = busca(listas.tipo, /tipo de lesion/);
      c.mecanismo = busca(listas.mecanismo, /mecanismo|forma del accidente|tipo de accidente/);
      c.agente = busca(listas.agente, /agente/);
    }
    const leidos = ['numero', 'fecha', 'nombre', 'cedula', 'descripcion'].filter((k) => c[k]).length;
    if (leidos < 3) avisos.push('Encontré poca información en el PDF (¿es una imagen escaneada?): completa a mano lo que falte.');
    if (!c.numero) avisos.push('No encontré el número de radicado: escríbelo.');
    return { campos: c, avisos, leidos };
  }
  return { leer, textoPdf, fecha, condiciones, furat };
})();
if (typeof module !== 'undefined') module.exports = LectorExamen;
