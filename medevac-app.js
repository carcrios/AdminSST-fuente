/* ============================================================
   medevac-app.js — MEDEVAC: ¿qué está pasando? y los pasos de esa situación (v180)
   ------------------------------------------------------------
   Lo usan dos pantallas: la pestaña «MEDEVAC» de Emergencias y medevac.html
   (que abre sin usuario, para quien llega primero). Primero pregunta qué está
   pasando; según la situación muestra los pasos de primer respondiente,
   luego quién es el trabajador, dónde está (hospital, ambulancia, ARL) y
   los pasos que siempre van. Los pasos son de primer respondiente; no
   reemplazan la atención médica: lo primero siempre es asegurar la escena
   y llamar al 123.
   ============================================================ */
const Medevac = (function () {
  /** Situaciones: [clave, nombre, pasos propios]. Primeros auxilios básicos (primer respondiente). */
  const SITUACIONES = [
    [
      'caida',
      'Caída de altura o golpe fuerte',
      [
        'No muevas a la persona: puede tener lesión de columna o cuello. Solo muévela si hay peligro inmediato (fuego, derrumbe, tránsito).',
        'Si está suspendida en el arnés, rescátala lo antes posible (riesgo de trauma por suspensión) con el plan de rescate en alturas; no la acuestes de golpe: déjala sentada o' +
          ' semisentada.',
        'Háblale y mira si responde y respira. Si no respira, inicia RCP si estás capacitado.',
        'Mantén la cabeza, el cuello y el cuerpo alineados. Abrígala.',
        'Controla sangrados presionando con un trapo limpio.',
      ],
    ],
    [
      'sangrado',
      'Herida o sangrado',
      [
        'Ponte guantes si los tienes.',
        'Presiona la herida con gasa o tela limpia, sin soltar, por lo menos 10 minutos.',
        'Si la sangre traspasa, pon más tela encima; no quites la primera.',
        'Si es un brazo o una pierna y el sangrado no para, eleva la extremidad. Torniquete solo si el sangrado es masivo y estás capacitado (anota la hora).',
        'No saques objetos clavados: fíjalos para que no se muevan.',
        'Amputación: guarda la parte en una bolsa limpia y esa bolsa sobre hielo (sin contacto directo) y llévala con la persona.',
      ],
    ],
    [
      'quemadura',
      'Quemadura (calor, fuego o químico)',
      [
        'Aleja a la persona de la fuente. Si la ropa arde: que se tire al piso y ruede, o cúbrela con una manta.',
        'Enfría la quemadura con agua a temperatura ambiente durante 20 minutos. No uses hielo, cremas, pasta de dientes ni remedios caseros.',
        'Quemadura química: retira la ropa contaminada y lava con abundante agua 20 minutos. Ten a mano la hoja de seguridad (FDS) del producto.',
        'Quita anillos, relojes y pulseras antes de que se hinche.',
        'No revientes las ampollas. Cubre con tela limpia y seca o plástico de cocina.',
        'Quemaduras en cara, manos, genitales, grandes o con dificultad para respirar: traslado urgente.',
      ],
    ],
    [
      'electrico',
      'Choque eléctrico',
      [
        'NO toques a la persona hasta cortar la energía (breaker, totalizador) o separarla con algo seco que no conduzca (madera, plástico).',
        'Alta tensión: no te acerques; espera a la empresa de energía.',
        'Mira si responde y respira. Si no respira, inicia RCP si estás capacitado; usa el DEA si lo hay.',
        'Busca quemaduras de entrada y salida y cúbrelas con tela limpia.',
        'Aunque se vea bien, debe ir al médico: el corazón puede alterarse después.',
      ],
    ],
    [
      'quimico',
      'Intoxicación o contacto con químicos',
      [
        'Saca a la persona al aire libre si el químico es un gas o vapor, solo si es seguro para ti (no entres sin protección respiratoria).',
        'Identifica el producto y busca su hoja de seguridad (FDS): dice qué hacer.',
        'Piel u ojos: lava con abundante agua 15–20 minutos. Retira la ropa contaminada.',
        'Si lo tragó: NO provoques el vómito. No le des leche ni nada de comer.',
        'Llama también a la línea toxicológica de la ARL o al Centro de Información Toxicológica.',
        'Lleva la etiqueta o la FDS del producto al hospital.',
      ],
    ],
    [
      'inconsciente',
      'Desmayo o persona que no responde',
      [
        'Háblale fuerte y tócale los hombros. Si no responde, grita pidiendo ayuda y que alguien llame al 123 y traiga el DEA.',
        'Mira si respira (máximo 10 segundos).',
        'Si NO respira o solo boquea: inicia RCP (30 compresiones fuertes en el centro del pecho, a 100–120 por minuto) si estás capacitado, y usa el DEA apenas llegue.',
        'Si respira y no hay sospecha de golpe en la columna: ponla de lado (posición de recuperación) y vigila que siga respirando.',
        'No le des nada de tomar.',
      ],
    ],
    [
      'pecho',
      'Dolor en el pecho o posible infarto',
      [
        'Siéntala y que no haga ningún esfuerzo. Afloja la ropa.',
        'Llama al 123 de inmediato y di que es un posible infarto.',
        'Si deja de responder o de respirar: RCP y DEA.',
        'No la dejes sola ni dejes que se vaya caminando o manejando.',
        'Anota a qué hora empezó el dolor.',
      ],
    ],
    [
      'convulsion',
      'Convulsión',
      [
        'Retira objetos alrededor para que no se golpee. Protege la cabeza con algo blando.',
        'NO la sujetes ni le metas nada en la boca.',
        'Mira la hora: si dura más de 5 minutos o se repite, es urgente.',
        'Cuando termine, ponla de lado y déjala descansar; háblale con calma.',
      ],
    ],
    [
      'asfixia',
      'Atrapamiento o falta de aire en espacio confinado',
      [
        'NO entres a rescatar sin equipo: la mayoría de muertes en espacios confinados son de rescatistas.',
        'Activa el plan de rescate del permiso de espacio confinado; el vigía no entra.',
        'Ventila el espacio y mide gases antes de cualquier rescate.',
        'Rescata desde afuera con el sistema de recuperación (trípode, arnés y línea) si está instalado.',
        'Ya afuera: aire fresco, mira si respira; RCP si no respira y estás capacitado.',
      ],
    ],
    [
      'atrapamiento',
      'Atrapamiento en máquina',
      [
        'Para la máquina y bloquéala (LOTO): que nadie la pueda encender.',
        'No intentes sacar la extremidad a la fuerza ni reversar la máquina sin saber cómo: puede empeorar la lesión.',
        'Controla el sangrado presionando.',
        'Espera a los bomberos si no se puede liberar sin riesgo.',
      ],
    ],
    [
      'fractura',
      'Posible fractura, esguince o luxación',
      [
        'No muevas la parte lesionada ni intentes acomodar el hueso.',
        'Inmoviliza en la posición en que está (tablilla, cartón, revista enrollada).',
        'Hielo envuelto en tela 15–20 minutos para el dolor y la hinchazón.',
        'Si el hueso se ve o hay sangrado, cubre con tela limpia.',
      ],
    ],
    [
      'picadura',
      'Picadura o mordedura (abejas, serpientes, animales)',
      [
        'Aléjate del animal.',
        'Abejas: retira el aguijón raspando con una tarjeta (no lo pellizques). Si se hincha la cara, la garganta o le cuesta respirar: urgente.',
        'Serpiente: que la persona se quede quieta, retira anillos y relojes, inmoviliza la extremidad por debajo del corazón. NO cortes, no chupes, no pongas torniquete. Si puedes,' +
          ' toma una foto de la serpiente sin acercarte.',
        'Mordedura de perro u otro animal: lava con agua y jabón 15 minutos.',
      ],
    ],
    [
      'otro',
      'Otra situación',
      ['Describe al 123 qué pasó, cuántas personas hay lesionadas y qué ves.', 'Sigue las indicaciones de la línea de emergencias y de la brigada.'],
    ],
  ];
  const COMUNES = [
    'Asegurar la escena: que nadie más corra peligro.',
    'Llamar a la línea de emergencias 123 o a la ambulancia de la sede.',
    'Avisar a la brigada y al responsable de SST.',
    'Avisar a la ARL por su línea de emergencias.',
    'Trasladar al hospital indicado, con un acompañante y la cédula del trabajador.',
    'Avisar al contacto de emergencia del trabajador.',
    'Reportar el accidente en el portal (a la ARL y a la EPS dentro de los 2 días hábiles siguientes).',
  ];
  const ESTILO =
    '.med-sit{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;}' +
    '.med-sit button{min-height:56px;padding:8px 10px;border-radius:var(--r-m);border:2px solid' +
      ' var(--n-200);background:#fff;font-weight:800;font-size:var(--fs-base);text-align:left;color:var(--tinta);cursor:pointer;}' +
    '.med-sit button.on{border-color:var(--rojo-700);background:var(--rojo-50);color:var(--rojo-700);}' +
    '.med-paso{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--n-100);}' +
    '.med-paso input{width:24px;height:24px;flex:0 0 auto;margin-top:2px;}.med-paso label{flex:1;font-size:var(--fs-base);line-height:1.4;}' +
    '.med-paso.esp label{font-weight:700;}' +
    '.med-dato{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--n-100);font-size:var(--fs-base);}.med-dato' +
      ' b{text-align:right;overflow-wrap:anywhere;}' +
    '.med-tels{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}' +
    '.med-tels a{flex:1 1 calc(33% -' +
      ' 8px);min-width:100px;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:var(--r-m);font-weight:800;text-decoration:none;border:2px solid' +
        ' var(--tinta);color:var(--tinta);background:#fff;}' +
    '.med-tels a.llamar{background:var(--rojo-700);border-color:var(--rojo-700);color:#fff;}.med-tels' +
      ' a.llamar-blanco{background:#fff;color:var(--rojo-700);border-color:#fff;font-size:var(--fs-titulo);}' +
    '.med-alerta{background:var(--rojo-700);color:#fff;border-radius:var(--r-m);padding:12px 14px;font-weight:800;font-size:var(--fs-titulo);margin-bottom:12px;}.med-alerta' +
      ' small{display:block;font-weight:600;font-size:var(--fs-menor);margin-top:6px;}';
  const soloNum = (t) => String(t || '').replace(/[^\d+]/g, '');
  const waNum = (t) => {
    let n = String(t || '').replace(/\D/g, '');
    if (n.length === 10 && n[0] === '3') n = '57' + n;
    return n;
  };
  function botonesTel(t, nombre) {
    const n = soloNum(t);
    if (!n) return '';
    const esCel = /^(\+?57)?3\d{9}$/.test(n);
    return (
      '<div class="med-tels"><a class="llamar" href="tel:' +
      esc(n) +
      '" aria-label="Llamar a ' +
      esc(nombre) +
      '">Llamar</a>' +
      (esCel
        ? '<a href="https://wa.me/' +
          esc(waNum(n)) +
          '" target="_blank" rel="noopener" aria-label="WhatsApp a ' +
          esc(nombre) +
          '">WhatsApp</a>' +
          '<a href="sms:' +
          esc(n) +
          '" aria-label="Mensaje de texto a ' +
          esc(nombre) +
          '">SMS</a>'
        : '') +
      '</div>'
    );
  }
  const dato = (l, v) => (v ? '<div class="med-dato"><span>' + esc(l) + '</span><b>' + esc(v) + '</b></div>' : '');

  /** Pinta MEDEVAC dentro de «el». opc.planes: filas de «emergencia» ya cargadas (Emergencias); si no, las pide. */
  function montar(el, opc) {
    opc = opc || {};
    if (!document.getElementById('estiloMedevac')) {
      const st = document.createElement('style');
      st.id = 'estiloMedevac';
      st.textContent = ESTILO;
      document.head.appendChild(st);
    }
    el.innerHTML =
      '<div class="med-alerta" role="note">Primero, asegura la escena y llama a la línea de emergencias 123.<div class="med-tels"><a class="llamar llamar-blanco" href="tel:123">Llamar' +
        ' al 123</a></div><small>Estos pasos son de primer respondiente: no reemplazan la atención médica.</small></div>' +
      '<div class="card"><h2>1. ¿Qué está pasando?</h2><div class="med-sit" id="medSit" role="group" aria-label="Qué está pasando">' +
      SITUACIONES.map((s) => '<button type="button" data-sit="' + s[0] + '" aria-pressed="false">' + esc(s[1]) + '</button>').join('') +
      '</div></div>' +
      '<div class="card" id="medQueHacer" hidden><h2 id="medQueTit">Qué hacer</h2><div id="medEsp"></div></div>' +
      '<div class="card"><h2>2. ¿Quién es el trabajador?</h2>' +
      '<div class="field"><label for="medPersona">Nombre o cédula</label><input type="text" id="medPersona" list="medLista" autocomplete="off" placeholder="Escribe para buscar en el' +
        ' personal habilitado"></div>' +
      '<datalist id="medLista"></datalist><div id="medFicha"><div class="empty">Elige al trabajador para ver su contacto de emergencia.</div></div></div>' +
      '<div class="card"><h2>3. ¿Dónde está?</h2><div class="field"><label for="medSede">Sede u obra</label><select id="medSede"><option value="">Cargando…</option></select></div><div' +
        ' id="medSedeDatos"></div></div>' +
      '<div class="card"><h2>4. Pasos que siempre van</h2><div id="medPasos"></div><div class="med-tels"><a class="llamar" href="tel:123">Llamar al 123</a></div>' +
      '<button type="button" class="btn btn-sec u-mt8" id="medCopiar">Copiar los datos para la ambulancia</button>' +
      '<a class="btn amber u-mt8" id="medReportar" href="reportes.html?nuevo=accidente">Reportar el accidente de trabajo</a></div>';
    const $m = (id) => el.querySelector('#' + id);
    let personas = [],
      planes = opc.planes || [],
      elegida = null,
      sede = null,
      sit = null;
    const pasosHTML = (l, pre, cls) =>
      l
        .map(
          (p, i) =>
            '<div class="med-paso ' +
            (cls || '') +
            '"><input type="checkbox" id="' +
            pre +
            i +
            '" data-sin-borrador><label for="' +
            pre +
            i +
            '">' +
            esc(p) +
            '</label></div>',
        )
        .join('');
    $m('medPasos').innerHTML = pasosHTML(COMUNES, 'mp');
    $m('medSit').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sit]');
      if (!b) return;
      sit = SITUACIONES.find((s) => s[0] === b.dataset.sit);
      el.querySelectorAll('#medSit button').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      $m('medQueHacer').hidden = false;
      $m('medQueTit').textContent = 'Qué hacer: ' + sit[1];
      $m('medEsp').innerHTML = pasosHTML(sit[2], 'ms', 'esp');
      $m('medQueHacer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    function pintarFicha(s, em, d) {
      let h = dato('Nombre', s.nombre) + dato('Cédula', s.cedula) + dato('Cargo', s.cargo) + dato('Empresa', s.empresa);
      if (!d) h += '<p class="ayuda">Escribe la cédula completa para ver su contacto de emergencia.</p>';
      else if (!em || !(em.telefono || em.nombre))
        h +=
          '<p class="ayuda"><b>No tiene contacto de emergencia registrado.</b> Regístralo en <a href="habilitacion.html">Personal habilitado</a>.</p>' +
          dato('EPS', em && em.eps) +
          dato('ARL', em && em.arl) +
          dato('RH', em && em.rh);
      else
        h +=
          dato('Tipo de sangre (RH)', em.rh) +
          dato('EPS', em.eps) +
          dato('ARL', em.arl) +
          '<h3 class="u-mt8">Contacto de emergencia</h3>' +
          dato('Nombre', em.nombre) +
          dato('Parentesco', em.parentesco) +
          dato('Teléfono', em.telefono) +
          botonesTel(em.telefono, em.nombre || 'contacto') +
          (em.telefono2 ? dato('Otro teléfono', em.telefono2) + botonesTel(em.telefono2, em.nombre || 'contacto') : '');
      $m('medFicha').innerHTML = h;
      if (elegida) elegida.em = em;
    }
    async function porCedula(ced) {
      if (!SGSST.url()) return;
      $m('medFicha').innerHTML = '<div class="empty">Buscando…</div>';
      let r;
      try {
        r = await (
          await fetchWithRetry(SGSST.url() + '?action=contactoEmergencia&cedula=' + encodeURIComponent(ced) + '&token=' + encodeURIComponent(SGSST.token()))
        ).json();
      } catch (e) {
        $m('medFicha').innerHTML = '<div class="empty">Sin señal: no se pudo buscar. Llama al 123.</div>';
        return;
      }
      if (!r || !r.ok) {
        $m('medFicha').innerHTML = '<div class="empty">' + esc((r && r.error) || 'No se encontró.') + '</div>';
        return;
      }
      elegida = { resumen: { nombre: r.nombre, cedula: ced, cargo: r.cargo, empresa: r.empresa } };
      pintarFicha(elegida.resumen, r.emergencia, true);
    }
    async function elegir(p) {
      elegida = p;
      $m('medFicha').innerHTML = '<div class="empty">Abriendo…</div>';
      const d = await SGSST.doc(p.id);
      if (!d) {
        const ced = String(p.resumen.cedula || '').replace(/\D/g, '');
        if (ced) return porCedula(ced);
      }
      pintarFicha(p.resumen, (d && d.emergencia) || null, !!d);
    }
    function pintarSede() {
      const x = planes[Number($m('medSede').value)];
      sede = x ? x.resumen : null;
      if (!sede) {
        $m('medSedeDatos').innerHTML =
          '<p class="ayuda">Registra el hospital, la ambulancia y la línea de la ARL en el plan de emergencias de la sede (Emergencias → Plan por sede).</p>';
        return;
      }
      const mapa = sede.hospitalDireccion
        ? '<div class="med-tels"><a href="https://www.google.com/maps/search/?api=1&amp;query=' +
          encodeURIComponent(sede.hospital + ' ' + sede.hospitalDireccion) +
          '" target="_blank" rel="noopener">Cómo llegar</a></div>'
        : '';
      $m('medSedeDatos').innerHTML =
        dato('Dirección de la sede', sede.direccion) +
        dato('Punto de encuentro', sede.puntoEncuentro) +
        (sede.hospital
          ? '<h3 class="u-mt8">Hospital</h3>' +
            dato('Hospital', sede.hospital) +
            dato('Dirección', sede.hospitalDireccion) +
            dato('Tiempo de llegada', sede.hospitalTiempo) +
            botonesTel(sede.hospitalTelefono, sede.hospital) +
            mapa
          : '<p class="ayuda">Falta el hospital en el plan de emergencias de esta sede.</p>') +
        (sede.ambulanciaTelefono
          ? '<h3 class="u-mt8">Ambulancia</h3>' + dato('Teléfono', sede.ambulanciaTelefono) + botonesTel(sede.ambulanciaTelefono, 'la ambulancia')
          : '') +
        (sede.arlTelefono
          ? '<h3 class="u-mt8">ARL ' +
            esc(sede.arlNombre || '') +
            '</h3>' +
            dato('Línea de emergencias', sede.arlTelefono) +
            botonesTel(sede.arlTelefono, 'la ARL')
          : '');
    }
    $m('medSede').addEventListener('change', pintarSede);
    $m('medPersona').addEventListener('change', () => {
      const v = $m('medPersona').value.trim().toLowerCase(),
        ced = (v.match(/\d{5,}/) || [])[0];
      const p = personas.find((x) => (ced && String(x.resumen.cedula) === ced) || (x.resumen.nombre || '').toLowerCase() === v.split(' · ')[0]);
      if (p) elegir(p);
      else if (ced) porCedula(ced);
    });
    $m('medCopiar').addEventListener('click', async () => {
      const s = elegida ? elegida.resumen : {},
        em = (elegida && elegida.em) || {};
      const t = [
        'MEDEVAC — ' + (typeof EMPRESA !== 'undefined' ? EMPRESA.nombreCorto || EMPRESA.nombre || '' : ''),
        sit ? 'Qué pasó: ' + sit[1] : '',
        'Trabajador: ' + (s.nombre || '—') + ' · C.C. ' + (s.cedula || '—'),
        em.rh ? 'RH: ' + em.rh : '',
        em.eps ? 'EPS: ' + em.eps : '',
        em.arl ? 'ARL: ' + em.arl : '',
        sede ? 'Sede: ' + (sede.sede || '') + ' · ' + (sede.direccion || '') : '',
        sede && sede.hospital ? 'Hospital: ' + sede.hospital + ' · ' + (sede.hospitalDireccion || '') : '',
        em.telefono ? 'Contacto: ' + (em.nombre || '') + ' (' + (em.parentesco || '') + ') ' + em.telefono : '',
      ]
        .filter(Boolean)
        .join('\n');
      try {
        await navigator.clipboard.writeText(t);
        UI.toast('Copiado. Pégalo en el mensaje a la ambulancia o la ARL.');
      } catch (e) {
        Dialogo.avisar(t);
      }
    });
    (async () => {
      if (UI.avisoServidor(document.createElement('div'))) {
        $m('medFicha').innerHTML = '<div class="empty">Sin servidor configurado.</div>';
        $m('medSede').innerHTML = '<option value="">Sin servidor</option>';
        return;
      }
      const r = await SGSST.listar('trabajador', { sinPedir: true });
      personas = (r.rows || []).filter((x) => x.resumen.activo !== false);
      $m('medLista').innerHTML = personas.map((x) => '<option value="' + esc(x.resumen.nombre + ' · ' + x.resumen.cedula) + '">').join('');
      const q = new URLSearchParams(location.search).get('id');
      if (q) {
        const p = personas.find((x) => x.id === q);
        if (p) {
          $m('medPersona').value = p.resumen.nombre + ' · ' + p.resumen.cedula;
          elegir(p);
        }
      }
      if (!opc.planes) {
        const e = await SGSST.listar('emergencia', { sinPedir: true });
        planes = e.rows || [];
        if (!planes.length && e && e.codigoError === 'SESION') {
          $m('medSede').innerHTML = '<option value="">Entra con tu usuario para ver el hospital y la ambulancia</option>';
          $m('medSedeDatos').innerHTML =
            '<p class="ayuda">El jefe, supervisor o brigadista que tenga usuario ve aquí el hospital, la ambulancia y la línea de la ARL de la sede.</p>';
          return;
        }
      }
      $m('medSede').innerHTML = planes.length
        ? planes.map((x, i) => '<option value="' + i + '">' + esc(x.resumen.sede || 'Sede') + '</option>').join('')
        : '<option value="">Sin planes de emergencia</option>';
      pintarSede();
    })();
  }
  return { montar, SITUACIONES, COMUNES };
})();
