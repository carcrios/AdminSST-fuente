/* ============================================================
   guia-preguntas.js — La guía a la que se le pregunta (v172)
   ------------------------------------------------------------
   Sin IA y sin señal: busca la pregunta en respuestas escritas sobre el
   portal y sobre la norma colombiana de SST, y además en las guías del
   manual (ayuda-guias.js). No envía nada a ningún servicio.
   Para agregar una respuesta: copia una entrada de RESPUESTAS (p = formas de
   preguntarlo, k = palabras clave, r = respuesta, a = enlaces).
   ============================================================ */
const GUIA_PREGUNTAS = (function () {
  const RESPUESTAS = [
    // ── Arrancar con un cliente ──
    {
      p: ['¿Por dónde empiezo con un cliente nuevo?', '¿Por dónde inicio?', '¿Qué hago primero?', 'Cómo arranco la implementación del SG-SST'],
      k: 'empezar iniciar arrancar primero cliente nuevo implementar implementación orden pasos',
      r:
        'Sigue «Por dónde iniciar»: un solo camino en orden. 1) Base del SG-SST: personal, política, matriz de ' +
        'peligros, matriz legal, COPASST, Convivencia, plan anual y emergencias. 2) Primer mes: inducción, equipos y QR, ' +
        'primera inspección, entrega de EPP y cierre del mes. Arriba siempre te dice cuál es el siguiente.',
      a: [['Por dónde iniciar', 'empezar.html']],
    },
    {
      p: ['¿Cómo instalo el portal para una empresa?', 'Instalar el servidor', 'Conectar el servidor de Google'],
      k: 'instalar instalación servidor apps script google drive enlace conectar desplegar',
      r:
        'En «Instalar» está el paso a paso: se copia el servidor a la cuenta de Google de la empresa, se publica y se ' +
        'pega su enlace en el portal. Los datos quedan en el Drive de la empresa. Con «Estado del sistema» compruebas ' +
        'que responde.',
      a: [
        ['Instalar', 'instalar.html'],
        ['Estado del sistema', 'estado.html'],
      ],
    },
    {
      p: ['¿Cómo agrego una empresa cliente?', 'Configurar una empresa nueva', 'Cambiar el logo o el nombre de la empresa'],
      k: 'configurar empresa cliente logo nombre nit colores configurador agregar crear',
      r:
        'En el configurador eliges «empresa cliente», llenas nombre, NIT y logo, y eliges el plan (SG-SST, SG-SST + ' +
        'Obra o Integral). Al guardar sale el archivo de la empresa para subir al sitio.',
      a: [['Configurador', 'configurar-empresa.html']],
    },
    {
      p: ['¿Qué plan le vendo?', '¿Qué trae cada plan?', 'Diferencia entre los planes'],
      k: 'plan planes vender precio integral obra sgsst modulos incluye diferencia',
      r:
        'SG-SST (base): todo el ciclo de la Res. 0312 con EPP, capacitación, contratistas y proveedores. SG-SST + Obra: ' +
        'suma permisos de trabajo, ATS, preoperacionales y lo de campo. Integral: suma ambiental, calidad y PESV. En el ' +
        'configurador los módulos salen agrupados así.',
      a: [['Configurador', 'configurar-empresa.html']],
    },
    {
      p: ['¿Cómo creo los usuarios?', 'Dar acceso a un trabajador', 'Qué roles hay'],
      k: 'usuario usuarios crear rol roles acceso permiso entrar supervisor gerencia comite consulta',
      r:
        'En «Usuarios» → «Nuevo usuario», uno por persona, con su rol: administrador, SST, supervisor, comité, gerencia ' +
        'o consulta. Cada rol ve solo lo suyo; los datos de salud solo los ven administrador y SST.',
      a: [['Usuarios', 'usuarios.html']],
    },
    {
      p: ['Olvidé la clave', 'Cambiar la contraseña de un usuario', 'Un usuario no puede entrar'],
      k: 'clave contraseña olvide olvidé cambiar restablecer entrar bloqueado acceso',
      r: 'El administrador entra a «Usuarios» y le da una clave temporal; la persona la cambia al entrar. La clave general del portal la tiene el responsable de SST.',
      a: [['Usuarios', 'usuarios.html']],
    },
    {
      p: ['¿Cómo subo el personal?', 'Cargar trabajadores desde Excel', 'Agregar un trabajador'],
      k: 'personal trabajadores cargar subir excel lista cedulas cargos nomina habilitacion agregar',
      r: 'En «Personal habilitado» pega la lista de Excel (nombre, cédula, cargo). De ahí sale todo: el semáforo de habilitación en permisos, la entrega de EPP, inducciones y exámenes.',
      a: [['Personal', 'habilitacion.html']],
    },
    // ── Uso diario ──
    {
      p: ['¿Funciona sin internet?', 'No hay señal en la obra', 'Qué pasa si no hay conexión'],
      k: 'señal internet conexion offline sin red datos pendiente sincronizar',
      r: 'Sí. Todo se guarda en el celular y queda «⏳ pendiente»; se envía solo cuando vuelve la señal. No borres los datos del navegador ni desinstales la app mientras haya pendientes.',
      a: [],
    },
    {
      p: ['¿Cómo lo instalo en el celular?', 'Tener el portal como app'],
      k: 'celular instalar app aplicacion pantalla inicio android iphone',
      r: 'En Android: menú ⋮ → «Instalar aplicación». En iPhone: Safari → Compartir → «Agregar a inicio». Queda como una app y abre más rápido.',
      a: [],
    },
    {
      p: ['¿Cómo saco un PDF?', 'Imprimir un formato', 'Descargar el informe'],
      k: 'pdf imprimir descargar formato guardar',
      r: 'Toca el botón del PDF (la impresora) y en la ventana de impresión elige «Guardar como PDF».',
      a: [],
    },
    {
      p: ['¿Cómo hago un permiso de trabajo?', 'Permiso de alturas', 'Abrir y cerrar un permiso'],
      k: 'permiso permisos trabajo alturas caliente confinados izaje electrico abrir cerrar firmar',
      r:
        'Desde el inicio, «En cada jornada» → el permiso que corresponda. Escribes la cédula de cada trabajador (el ' +
        'semáforo dice si está habilitado), llenas la lista de verificación y firman en el celular. Al terminar el ' +
        'trabajo se cierra con firma.',
      a: [['Inicio', 'index.html']],
    },
    {
      p: ['¿Cómo reporto un accidente?', 'Reportar un incidente', 'Reportar un acto o condición insegura'],
      k: 'reportar reporte accidente incidente acto condicion insegura lesion casi',
      r: 'En «Reportar» eliges la clase (accidente, incidente, acto o condición insegura), con foto y lugar. Si es accidente de trabajo, el portal te recuerda el FURAT y la investigación.',
      a: [['Reportar', 'reportes.html']],
    },
    {
      p: ['¿Cómo registro una entrega de EPP?', 'Entregar dotación o elementos de protección'],
      k: 'epp entrega entregar elementos proteccion dotacion firma casco guantes botas',
      r: 'En «Entrega de EPP» buscas la cédula, eliges los elementos y la persona firma en el celular. Queda la constancia con fecha, que es la prueba ante la ARL.',
      a: [['Entrega de EPP', 'entrega-epp.html']],
    },
    {
      p: ['¿Cómo hago una inspección?', 'Inspección de extintores o botiquín', 'Cronograma de inspecciones'],
      k: 'inspeccion inspecciones extintor botiquin cronograma plantilla hallazgo recorrido',
      r:
        'En «Inspecciones» eliges la plantilla (o el equipo con su QR) y marcas cada punto. Lo que salga no conforme ' +
        'puede pasar al plan de acción. El cronograma sale de la matriz de peligros.',
      a: [['Inspecciones', 'inspecciones.html']],
    },
    {
      p: ['¿Cómo registro las charlas?', 'Charla de cinco minutos', 'Asistencia a una capacitación'],
      k: 'charla charlas asistencia capacitacion firmar tema semana cinco minutos',
      r: 'En «Asistencia a charlas» pones el tema del día y los asistentes firman en el celular. Al final del mes aparecen en el informe mensual.',
      a: [['Charlas', 'asistencia.html']],
    },
    {
      p: ['¿Cómo saco el informe del mes?', 'Informe para gerencia o el cliente', 'Cuántos permisos se abrieron en el mes'],
      k: 'informe mensual mes actividades gerencia cliente resumen permisos accidentes charlas',
      r: 'En «Informe mensual de actividades» eliges el mes: junta permisos, accidentes, inspecciones con hallazgos, charlas, EPP revisados y entregados, y saca el PDF con firma.',
      a: [
        ['Informe mensual', 'informe-mes.html'],
        ['Cierre del mes', 'cierre-mes.html'],
      ],
    },
    {
      p: ['¿Cómo pongo el tablero en el televisor?', 'Pantalla de planta', 'Días sin accidentes en la TV'],
      k: 'televisor tv pantalla planta tablero dias sin accidentes',
      r: 'En «Pantalla de planta» creas el enlace del televisor (con QR). Muestra solo cifras: días sin accidentes, reportes del mes y acciones vencidas; nunca nombres.',
      a: [['Pantalla de planta', 'pantalla-planta.html']],
    },
    {
      p: ['Borré algo por error', 'Recuperar un registro borrado'],
      k: 'borrar borre borrado recuperar papelera eliminar error',
      r: 'Lo borrado va a la «Papelera» y desde ahí se recupera.',
      a: [['Papelera', 'papelera.html']],
    },
    {
      p: ['Algo no funciona', 'El portal no carga', 'Error al guardar'],
      k: 'error falla no funciona no carga problema servidor estado',
      r: 'Abre «Estado del sistema»: prueba cada servidor y dice qué falla. Envía una captura de esa pantalla a quien te instaló el portal.',
      a: [['Estado del sistema', 'estado.html']],
    },
    {
      p: ['¿Quién ve los datos de salud?', 'Exámenes médicos y diagnósticos'],
      k: 'salud datos medicos examen diagnostico privacidad quien ve confidencial',
      r: 'Solo administrador y SST. Del concepto médico se guarda si es apto y sus restricciones; el diagnóstico nunca se guarda.',
      a: [['Salud', 'salud.html']],
    },
    {
      p: ['¿Cómo anoto una tarea o un recordatorio?', 'Poner una tarea en el calendario'],
      k: 'tarea tareas recordatorio recordar calendario agenda anotar pendiente',
      r:
        'En Gestión, junto a «Para hoy y esta semana», está el calendario: toca «+ Tarea», escribe qué hay que hacer, ' +
        'el día, la hora y cuándo recordártela. Te llega en el correo diario de avisos y, con el portal abierto, te ' +
        'avisa a la hora. «✓ Hecha» la cierra.',
      a: [['Gestión', 'index.html#sg']],
    },
    {
      p: ['¿Cómo le doy acceso a un auditor?', 'Enlace para el auditor o la ARL'],
      k: 'auditor auditoria arl ministerio enlace acceso externo consultor ver solo lectura',
      r:
        'En «Auditorías», abajo, está «Enlaces para auditores» (solo el administrador). Eliges quién audita, por ' +
        'cuántos días y qué módulos puede ver. El auditor entra solo con el enlace: sin usuario y sin la clave del ' +
        'portal, y solo puede leer.',
      a: [['Auditorías', 'auditorias.html']],
    },
    {
      p: ['¿Cómo registro la seguridad social de todos?', 'PILA del mes para todo el personal'],
      k: 'seguridad social pila planilla pago aportes todos mes personal',
      r:
        'En «Personal habilitado», toca «Seguridad social del mes (para todos)»: pones la fecha de pago y queda ' +
        'registrada para todo el personal propio de una vez. Los de contratistas llevan la suya.',
      a: [['Personal habilitado', 'habilitacion.html']],
    },
    {
      p: ['¿Puedo subir la firma de una persona?', 'Subir una foto de la firma'],
      k: 'firma subir foto imagen escaneo escaneada firmar',
      r:
        'Sí. En cada recuadro de firma está «Subir firma (foto)»: elige una foto o escaneo de la firma en papel blanco. El ' +
        'portal limpia el fondo y la pone en el recuadro. Revísala antes de guardar.',
      a: [],
    },
    {
      p: ['¿Cómo cargo el listado maestro de documentos?', 'Subir el listado maestro desde Excel'],
      k: 'listado maestro documentos excel cargar subir control documental codigos versiones',
      r:
        'En «Documental» → Listado maestro → «Cargar listado maestro desde Excel». Sirve la plantilla o tu propio ' +
        'formato: el portal empareja las columnas por su nombre (código, nombre, versión, fecha, responsable…).',
      a: [['Documental', 'documental.html']],
    },
    // ── Norma ──
    {
      p: ['¿Cuántos estándares mínimos le aplican?', 'Resolución 0312', '¿Son 7, 21 o 60 estándares?'],
      k: 'estandares minimos 0312 resolucion 7 21 60 aplican trabajadores riesgo',
      r:
        'Res. 0312 de 2019: 7 estándares para empresas de 10 o menos trabajadores en riesgo I, II o III; 21 para 11 a ' +
        '50 trabajadores en riesgo I, II o III; 60 para más de 50 trabajadores o cualquier empresa en riesgo IV o V.',
      a: [['Auditorías y autoevaluación', 'auditorias.html']],
    },
    {
      p: ['¿Cómo se califica la autoevaluación?', 'Resultado crítico de la 0312'],
      k: 'autoevaluacion calificacion critico moderadamente aceptable porcentaje plan mejoramiento',
      r:
        'Menos de 60 %: crítico (plan de mejoramiento inmediato y aviso a la ARL). De 60 % a 85 %: moderadamente ' +
        'aceptable. Más de 85 %: aceptable. Se hace cada año y el plan de mejoramiento se sigue en el plan de acción.',
      a: [
        ['Auditorías', 'auditorias.html'],
        ['Plan de acción', 'plan-accion.html'],
      ],
    },
    {
      p: ['¿En cuánto tiempo se reporta un accidente a la ARL?', 'Plazo del FURAT'],
      k: 'furat plazo reportar arl eps accidente dias habiles',
      r: 'El FURAT se reporta a la ARL y a la EPS dentro de los 2 días hábiles siguientes al accidente (Res. 156 de 2005).',
      a: [['Reportes', 'reportes.html']],
    },
    {
      p: ['¿En cuánto tiempo se investiga un accidente?', 'Plazo de la investigación'],
      k: 'investigacion investigar accidente incidente plazo dias 1401 equipo investigador',
      r:
        'Dentro de los 15 días calendario siguientes (Res. 1401 de 2007), con el jefe inmediato, un integrante del ' +
        'COPASST o el vigía y el responsable de SST. Si es grave o mortal, el informe se envía a la ARL.',
      a: [['Reportes', 'reportes.html']],
    },
    {
      p: ['¿Cada cuánto se reúne el COPASST?', 'Vigía o COPASST', 'Cuánto dura el COPASST'],
      k: 'copasst vigia reunion cada cuanto periodo años integrantes elegir',
      r: 'El COPASST se reúne al menos una vez al mes y su periodo es de 2 años. Con menos de 10 trabajadores va un vigía de SST en lugar del comité.',
      a: [['COPASST', 'copasst.html']],
    },
    {
      p: ['¿Cada cuánto se reúne el Comité de Convivencia?', 'Comité de convivencia laboral'],
      k: 'convivencia comite laboral acoso reunion trimestral cada cuanto 652',
      r: 'Cada 3 meses como mínimo (Res. 652 de 2012) y de forma extraordinaria cuando hay una queja. Su periodo es de 2 años.',
      a: [['Convivencia', 'convivencia.html']],
    },
    {
      p: ['¿Desde qué altura es trabajo en alturas?', 'Norma de alturas'],
      k: 'alturas metros norma 4272 trabajo en alturas certificado curso',
      r: 'Desde 2 metros sobre el nivel inferior (Res. 4272 de 2021). Pide permiso de trabajo, trabajadores con curso vigente, coordinador de alturas y sistema de protección contra caídas.',
      a: [['Permiso de alturas', 'permiso-trabajo-alturas.html']],
    },
    {
      p: ['Norma de espacios confinados'],
      k: 'espacios confinados norma 0491 atmosfera vigia',
      r: 'Res. 0491 de 2020: permiso de entrada, medición de atmósfera, vigía de seguridad y plan de rescate.',
      a: [['Permiso de espacios confinados', 'permiso-espacios-confinados.html']],
    },
    {
      p: ['¿Qué exámenes médicos hay que hacer?', 'Examen de ingreso, periódico y de egreso'],
      k: 'examenes medicos ocupacionales ingreso periodico egreso retiro 2346',
      r:
        'De ingreso, periódicos y de egreso (Res. 2346 de 2007). El de egreso se hace dentro de los 5 días hábiles ' +
        'siguientes al retiro. El portal guarda el concepto (apto y restricciones), nunca el diagnóstico.',
      a: [['Salud', 'salud.html']],
    },
    {
      p: ['¿Qué indicadores pide la norma?', 'Indicadores de accidentalidad'],
      k: 'indicadores frecuencia severidad mortalidad prevalencia incidencia ausentismo 0312',
      r:
        'La Res. 0312 pide frecuencia y severidad de accidentes, proporción de accidentes mortales, prevalencia e ' +
        'incidencia de enfermedad laboral y ausentismo por causa médica. El portal los calcula en «Indicadores» con el ' +
        'cierre de cada mes.',
      a: [
        ['Indicadores', 'indicadores.html'],
        ['Cierre del mes', 'cierre-mes.html'],
      ],
    },
    {
      p: ['¿Cuánto tiempo se guardan los documentos?', 'Conservación de registros'],
      k: 'conservar guardar documentos años archivo retencion 20',
      r: 'Los registros del SG-SST se conservan por lo menos 20 años desde el retiro del trabajador (Decreto 1072 de 2015, art. 2.2.4.6.13).',
      a: [['Documental', 'documental.html']],
    },
    {
      p: ['¿Cada cuánto hay que hacer simulacro?', 'Plan de emergencias'],
      k: 'simulacro emergencias brigada evacuacion cada cuanto plan amenazas',
      r: 'Al menos un simulacro al año, con la brigada conformada y capacitada y el plan de emergencias con análisis de amenazas y vulnerabilidad.',
      a: [['Emergencias', 'emergencias.html']],
    },
    {
      p: ['¿Se puede despedir a alguien con restricciones médicas?', 'Estabilidad laboral reforzada'],
      k: 'estabilidad laboral reforzada despedir despido restricciones reintegro incapacidad 361',
      r:
        'Un trabajador con restricciones o en condición de debilidad por su salud tiene estabilidad laboral reforzada: ' +
        'para terminar su contrato se necesita autorización del Ministerio de Trabajo (Ley 361 de 1997, art. 26). Lleva ' +
        'el reintegro y sus seguimientos en Salud → Reintegro.',
      a: [['Reintegro laboral', 'salud.html#reintegro']],
    },
    {
      p: ['¿Qué lleva el plan anual de trabajo?', 'Plan anual del SG-SST'],
      k: 'plan anual trabajo cronograma actividades responsables recursos firmado',
      r:
        'Las actividades del año con responsable, fecha y recursos, firmado por el representante legal y el responsable ' +
        'de SST. En el portal, «Sugerencias según la empresa» lo arranca y las actividades se marcan solas cuando hay ' +
        'registros.',
      a: [['Plan anual', 'plan-anual.html']],
    },
    {
      p: ['¿Cómo controlo el presupuesto del SG-SST?', 'Presupuesto y gastos'],
      k: 'presupuesto gasto gastos ejecucion rubros recursos dinero',
      r: 'En «Presupuesto» defines los rubros del año y registras cada gasto: ves lo ejecutado contra lo presupuestado y sale el PDF con firmas (estándar 1.1.3 de la 0312).',
      a: [['Presupuesto', 'presupuesto.html']],
    },
  ];

  const VACIAS = new Set(
    ('a al algo alguien como con cual cuales cuando cuanto cuantos cuanta cuantas de del desde donde el ella en es ' +
      'esta este esto hay hacer hago la las le lo los me mi mis no o para pero por puedo que quien se si sin sobre su ' +
      'sus tengo un una uno y ya debo debe hace pongo poner doy dar puede').split(' '),
  );
  const SIN = {
    contrasena: 'clave',
    password: 'clave',
    at: 'accidente',
    epps: 'epp',
    dotacion: 'epp',
    elementos: 'epp',
    tv: 'televisor',
    copass: 'copasst',
    copaso: 'copasst',
  };
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ ]+/g, ' ');
  const raiz = (w) => (w.length > 5 ? w.replace(/(es|s)$/, '') : w.length > 3 ? w.replace(/s$/, '') : w);
  const palabras = (s) =>
    norm(s)
      .split(/\s+/)
      .filter((w) => w && !VACIAS.has(w))
      .map((w) => raiz(SIN[w] || w));

  let base = null;
  /** Une las respuestas con las guías del manual y las preguntas frecuentes. */
  function armar(extra) {
    const l = RESPUESTAS.map((x) => ({ t: x.p[0], r: x.r, a: x.a || [], txt: x.p.join(' ') + ' ' + x.k, fuerte: x.p.join(' ') + ' ' + x.k }));
    ((extra && extra.guias) || []).forEach((g) =>
      l.push({
        t: g.t,
        r: g.pasos.map((p, i) => i + 1 + '. ' + p).join('\n'),
        a: g.href ? [['Abrir el módulo', g.href]] : [],
        txt: g.t + ' ' + g.pasos.join(' '),
        fuerte: g.t,
        guia: g.id,
      }),
    );
    ((extra && extra.faq) || []).forEach(([q, r]) => l.push({ t: q, r, a: [], txt: q + ' ' + r, fuerte: q }));
    const df = {};
    l.forEach((x) => {
      x.w = new Set(palabras(x.txt));
      x.wf = new Set(palabras(x.fuerte));
      x.w.forEach((w) => (df[w] = (df[w] || 0) + 1));
    });
    base = { l, df, n: l.length };
    return base;
  }
  const coincide = (q, set) => {
    if (set.has(q)) return 1;
    if (q.length >= 4) for (const w of set) if (w.length >= 4 && (w.indexOf(q) === 0 || q.indexOf(w) === 0)) return 0.7;
    return 0;
  };
  /** Las mejores respuestas para una pregunta: [{t, r, a, puntaje}] (vacío si no hay nada parecido). */
  function preguntar(texto, extra) {
    const B = base || armar(extra),
      q = [...new Set(palabras(texto))];
    if (!q.length) return [];
    const res = B.l
      .map((x) => {
        let s = 0,
          hit = 0;
        q.forEach((w) => {
          const idf = Math.log(1 + B.n / (B.df[w] || 1));
          const c = Math.max(coincide(w, x.wf) * 1.6, coincide(w, x.w));
          if (c) hit++;
          s += c * idf;
        });
        if (q.length >= 3 && hit < 2) return { puntaje: 0 };   // con una sola palabra en común de tres o más, no es la misma pregunta
        return { t: x.t, r: x.r, a: x.a, guia: x.guia, puntaje: (s / Math.sqrt(q.length)) * (hit / q.length + 0.5) };
      })
      .filter((x) => x.puntaje >= 1.2)
      .sort((a, b) => b.puntaje - a.puntaje);
    return res.filter((x) => x.puntaje >= res[0].puntaje * 0.45).slice(0, 3);
  }
  const SUGERIDAS = [
    '¿Por dónde empiezo con un cliente nuevo?',
    '¿En cuánto tiempo se reporta un accidente a la ARL?',
    '¿Cuántos estándares mínimos le aplican?',
    '¿Cómo saco el informe del mes?',
    '¿Funciona sin internet?',
  ];
  /* v173 · Lo que no supo responder se le avisa al servidor de la empresa (solo el texto de la pregunta).
     Sin señal queda en este equipo y se envía la próxima vez. Quien vende el portal lo ve en su consola. */
  const COLA = 'ssta-guia-sin-respuesta';
  const leerCola = () => {
    try {
      return JSON.parse(localStorage.getItem(COLA) || '[]') || [];
    } catch (e) {
      return [];
    }
  };
  const ponerCola = (l) => {
    try {
      localStorage.setItem(COLA, JSON.stringify(l.slice(-20)));
    } catch (e) {}
  };
  function urlRaiz() {
    const s = typeof EMPRESA !== 'undefined' && EMPRESA.servidor ? String(EMPRESA.servidor).trim().replace(/\/+$/, '') : '';
    return /^https:\/\//.test(s) ? s : '';
  }
  async function enviarCola() {
    const r = urlRaiz();
    if (!r || typeof fetch === 'undefined') return;
    let l = leerCola();
    while (l.length) {
      try {
        const j = await (await fetch(r, { method: 'POST', body: JSON.stringify({ __guia: { texto: l[0] } }) })).json();
        if (!j || (!j.ok && j.codigoError === 'TEMPORAL')) return;
      } catch (e) {
        return;
      }
      l = leerCola().slice(1);
      ponerCola(l);
    }
  }
  /** Guarda la pregunta sin respuesta y la envía (o la deja en cola). */
  function reportar(texto) {
    const t = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (t.length < 4) return;
    const l = leerCola();
    if (l.indexOf(t) === -1) l.push(t);
    ponerCola(l);
    return enviarCola();
  }
  return { preguntar, armar, palabras, reportar, enviarCola, RESPUESTAS, SUGERIDAS };
})();
if (typeof module !== 'undefined') module.exports = GUIA_PREGUNTAS;
