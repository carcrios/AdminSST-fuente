/* ============================================================
   empresa-motor.js — Lo que hace funcionar empresa.js (v116)
   ------------------------------------------------------------
   Antes vivía al final de empresa.js. Como empresa.js es de cada
   sitio (no se reemplaza al actualizar), los arreglos del motor no
   llegaban. Ahora empresa.js solo tiene los datos y este archivo
   se actualiza con el portal.
   Si el sitio todavía tiene un empresa.js viejo (con su propio
   motor adentro), este archivo no hace nada: se usa el de allá
   hasta que se vuelva a generar empresa.js con el configurador.
   ============================================================ */
(function (g, yaTieneMotor) {
  /* Catálogo de módulos (clave en empresa.js → nombre): lo usan el configurador y la consola. */
  g.CATALOGO_MODULOS = [['caliente', '🔥 Trabajo en caliente'], ['alturas', '🧗 Trabajo en alturas'], ['confinados', '🕳️ Espacios confinados'], ['izajes', '🏗️ Izajes de cargas'],
    ['electrico', '⚡ Trabajo eléctrico'], ['ats', '🧭 ATS'], ['asistencia', '🗣️ Asistencia a charlas'], ['personal', '👷 Anexo de personal autorizado'],
    ['epp', '🦺 Inspección de EPP'], ['brigadistas', '🧰 EPP de brigadistas'], ['tablero', '📊 Tablero'],
    ['reportes', '⚠️ Reportes e investigación'], ['habilitacion', '🪪 Personal habilitado'], ['plan', '✅ Plan de acción'], ['inspecciones', '🔍 Inspecciones planeadas'], ['indicadores', '📈 Indicadores'],
    ['copasst', '🤝 COPASST'], ['convivencia', '🕊️ Comité de Convivencia'], ['auditorias', '🧾 Auditorías'],
    ['plananual', '🗓️ Plan anual de trabajo'], ['presupuesto', '💰 Presupuesto del SG-SST'], ['peligros', '☢️ Matriz de peligros'], ['emergencias', '🚨 Emergencias'], ['salud', '🩺 Salud en el trabajo'], ['documental', '📚 Documental y legal'], ['revision', '🏛️ Revisión por la dirección'], ['contratistas', '🚧 Contratistas'], ['usuarios', '👥 Usuarios y respaldo'], ['dotacion', '🦺 Matriz y entrega de EPP'], ['induccion', '🎓 Inducción y reinducción'], ['programas', '🧗 Programas de alto riesgo'], ['pesv', '🚗 PESV'], ['gerencia', '📊 Tablero de la gerencia'], ['ambiental', '🌱 Gestión ambiental'], ['quimicos', '⚗️ Sustancias químicas'], ['kit', '📄 Kit documental'], ['calidad', '🏅 Gestión de la calidad (ISO 9001)'], ['asesor', '🧑‍💼 Panel del asesor (clientes)'], ['cierre', '📅 Cerrar el mes'], ['evidencias', '🗂️ Carpeta de evidencias'], ['preop', '🔧 Preoperacionales'], ['proveedores', '🤝 Evaluación de proveedores'], ['comiteemergencias', '🚨 Comité de emergencias']];
  /* v166: lo que se vende. El SG-SST es la BASE (todo el ciclo de la Res. 0312, con EPP, capacitación, contratistas y
     proveedores); «Obra» es un complemento que se suma a la base, nunca se vende solo: una constructora que comprara solo
     los permisos podría creer que cumple la 0312. Reportes y usuarios van siempre. */
  const SGSST_BASE = ['plananual', 'presupuesto', 'peligros', 'inspecciones', 'indicadores', 'copasst', 'convivencia', 'auditorias', 'documental', 'salud', 'plan', 'emergencias', 'comiteemergencias', 'revision', 'cierre', 'gerencia', 'programas', 'kit',
    'dotacion', 'epp', 'brigadistas', 'asistencia', 'contratistas', 'proveedores', 'quimicos', 'habilitacion', 'induccion', 'evidencias', 'reportes', 'usuarios', 'tablero'];
  g.COMPLEMENTOS_PORTAL = { obra: { nombre: 'Obra', para: 'Trabajo de alto riesgo en campo', mods: ['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'preop', 'personal'] } };
  g.MODULOS_INTERNOS = ['asesor'];   // v170: el panel del asesor es de quien vende el portal: no es parte de ningún plan
  g.PLANES_PORTAL = {
    // v175: para la empresa pequeña de 7 estándares (Res. 0312, art. 3: hasta 10 trabajadores, riesgo I a III):
    // 8 módulos que cubren los 7 estándares, más Convivencia por el Decreto 1040 de 2026. Usuarios y tablero no cuentan.
    micro: { nombre: 'Micro 7', para: 'Empresas de hasta 10 trabajadores (7 estándares): plan anual, peligros, personal, capacitación, inspecciones, EPP, reportes y convivencia (Decreto 1040)',
      mods: ['plananual', 'peligros', 'habilitacion', 'asistencia', 'inspecciones', 'epp', 'reportes', 'convivencia', 'usuarios', 'tablero'] },
    sgsst: { nombre: 'SG-SST Esencial', para: 'Todo el ciclo del SG-SST (Res. 0312): plan, peligros, inspecciones, indicadores, comités, auditorías, salud, EPP, capacitación, contratistas y proveedores', mods: SGSST_BASE },
    sgsstObra: { nombre: 'SG-SST + Obra', para: 'Constructoras y contratistas: el SG-SST completo más permisos de trabajo, ATS, preoperacionales y personal autorizado', mods: SGSST_BASE.concat(g.COMPLEMENTOS_PORTAL.obra.mods) },
    integral: { nombre: 'Integral', para: 'Varias sedes y HSEQ: todo, más ambiental, calidad y PESV', mods: null }   // null = todos
  };
  g.planDeModulos = function (modulos) {   // qué plan son estos módulos prendidos ('' = personalizado)
    // v170: los módulos internos (panel del asesor) no cuentan: prenderlos o apagarlos no cambia el plan.
    const todos = g.CATALOGO_MODULOS.map((x) => x[0]).filter((k) => g.MODULOS_INTERNOS.indexOf(k) === -1), on = todos.filter((k) => !modulos || modulos[k] !== false);
    return Object.keys(g.PLANES_PORTAL).find((p) => { const l = g.PLANES_PORTAL[p].mods || todos; return on.length === l.filter((k) => todos.indexOf(k) !== -1).length && on.every((k) => l.indexOf(k) !== -1); }) || '';
  };
  /* v118: los módulos por categoría (en el orden del inicio). Lo usan el configurador y la consola. */
  /* v170: la lista de módulos va agrupada IGUAL QUE SE VENDE (configurador, «Menús» de la consola y Anexo 1 del
     contrato): la base que traen todos los planes, el complemento Obra, lo que solo trae Integral y, aparte, las
     herramientas de quien vende el portal, que no se cobran ni cuentan para el plan. Sale de PLANES_PORTAL. */
  g.CATEGORIAS_MODULOS = [
    ['base', 'Base SG-SST', 'En SG-SST Esencial, + Obra e Integral: el ciclo completo de la Res. 0312 (Micro 7 trae solo 8 de estos módulos)', SGSST_BASE.slice()],
    ['obra', 'Complemento Obra', 'En «SG-SST + Obra» e «Integral»: permisos de alto riesgo, ATS, preoperacionales y anexo de personal. No se vende solo', g.COMPLEMENTOS_PORTAL.obra.mods.slice()],
    ['integral', 'Solo en Integral', 'Ambiental, calidad y PESV', ['ambiental', 'calidad', 'pesv']],
    ['interno', 'Herramientas de quien vende el portal', 'No se cobran ni cuentan para el plan', g.MODULOS_INTERNOS.slice()]
  ];
  if (yaTieneMotor) return;   // empresa.js viejo: ya trae su motor
  /* ════════════════════════════════════════════════════════════
     Motor: no hace falta tocar nada de aquí para abajo.
     ════════════════════════════════════════════════════════════ */

  /* ── Varias empresas en un mismo sitio (multiempresa: true) ──
     Quien vende el portal publica UN sitio con su marca; cada empresa cliente
     tiene su archivo empresas/<código>.json (lo genera configurar-empresa.html)
     y entra con  https://…/?e=<código>.  El celular recuerda su empresa (y sus
     datos, para abrir sin señal); cambiar de empresa borra lo de la anterior en
     ese equipo. Así una sola actualización del sitio les llega a todos. */
  /* ── Consola del administrador general (v115) ──
     admin.html y asesor.html son SOLO del administrador: usan siempre la configuración
     del sitio (tu servidor, tus clientes), nunca la de la empresa abierta en ese
     equipo, y guardan su sesión aparte (ssta-admin-…) para no mezclarse con la de un
     cliente. Los clientes no tienen enlace a estas páginas. */
  const PAGINAS_CONSOLA = ['admin.html', 'asesor.html'];
  if (typeof window !== 'undefined' && typeof location !== 'undefined') {
    const pag = (location.pathname.split('/').pop() || 'index.html');
    if (PAGINAS_CONSOLA.indexOf(pag) !== -1) EMPRESA.consola = true;
  }

  const MultiEmpresa = (function () {
    const E = EMPRESA;
    if (!E.multiempresa || typeof window === 'undefined') return { activo: false };
    const enConsola = !!E.consola;
    const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } return null; };
    const valido = (c) => /^[a-z0-9][a-z0-9-]{1,39}$/.test(String(c || ''));
    const proveedor = JSON.parse(JSON.stringify(E));
    let cod = ls('ssta-empresa') || '';
    let pedido = '';
    try { pedido = String(new URLSearchParams(location.search).get('e') || '').trim().toLowerCase(); } catch (e) {}
    if (pedido && (!valido(pedido) || pedido === cod)) pedido = pedido === cod ? '' : pedido;
    // Sitio con una empresa principal: el celular entra solo a ella, sin pedir código.
    const porDefecto = String(E.empresaPorDefecto || '').trim().toLowerCase();
    const automatico = !cod && !pedido && valido(porDefecto);
    if (automatico) pedido = porDefecto;
    let datos = null; try { datos = JSON.parse(ls('ssta-empresa-datos') || 'null'); } catch (e) {}
    // Configurador abierto desde la consola: «?editar=<código>» trae ese cliente (la consola lo dejó en esta pestaña) y «?nueva=1» empieza en blanco.
    let editar = null;
    try {
      const q = new URLSearchParams(location.search), ed = String(q.get('editar') || '').toLowerCase();
      if (/configurar-empresa\.html$/.test(location.pathname) || location.pathname.split('/').pop() === 'configurar-empresa.html') {
        if (valido(ed)) { const x = JSON.parse(sessionStorage.getItem('ssta-admin-editar') || 'null'); if (x && x.codigo === ed && x.empresa) editar = x; }
        if (q.get('nueva') === '1') editar = { nueva: true };
      }
    } catch (e) {}
    const cargada = !enConsola && !editar && !!(cod && datos && datos.codigo === cod && datos.empresa) && !pedido;
    if (editar && editar.empresa) {
      Object.keys(editar.empresa).forEach((k) => { if (k !== 'multiempresa' && k !== 'producto' && k !== 'demo' && k !== 'empresaPorDefecto') E[k] = editar.empresa[k]; });
      E.codigo = editar.codigo; E.editandoCliente = true; delete E.sinEmpresa; delete E.sinConfigurar;
    } else if (editar && editar.nueva) {
      E.sinEmpresa = true;
    } else if (enConsola) {
      // La consola siempre trabaja con la configuración del sitio (la del administrador).
      E.codigo = ''; delete E.sinEmpresa;
    } else if (cargada) {
      // Lo de la empresa reemplaza lo del sitio; la marca (producto) y el modo siguen siendo del proveedor.
      Object.keys(datos.empresa).forEach((k) => { if (k !== 'multiempresa' && k !== 'producto' && k !== 'demo') E[k] = datos.empresa[k]; });
      E.codigo = cod; delete E.sinEmpresa; delete E.sinConfigurar;
    } else if (!pedido && E.servidor && !E.sinConfigurar) {
      // El sitio ya tiene su propio servidor: funciona como su propia empresa, sin pedir código.
      E.codigo = ''; delete E.sinEmpresa;
    } else E.sinEmpresa = true;
    const url = (c) => 'empresas/' + encodeURIComponent(c) + '.json';
    /* v116: la configuración de cada cliente se publica desde la consola en el servidor del
       sitio (sin subir archivos a GitHub). Si allá no está, se busca empresas/<código>.json. */
    async function delServidor(c) {
      const P = proveedor;
      if (!P.servidor) return null;
      try {
        const u = String(P.servidor).replace(/\/+$/, '') + '?modulo=sgsst&action=empresaPublica&codigo=' + encodeURIComponent(c) + '&token=' + encodeURIComponent(P.apiToken || '');
        const r = await fetch(u, { cache: 'no-store' });
        const j = await r.json();
        return j && j.ok && j.empresa ? j : (j && j.codigoError === 'NOEXISTE' ? { noExiste: true } : null);
      } catch (e) { return null; }
    }
    async function traer(c) {
      const s = await delServidor(c);
      let j;
      if (s && !s.noExiste) j = s;
      else {
        const r = await fetch(url(c), { cache: 'no-store' });
        if (r.status === 404) throw new Error('No hay ninguna empresa con el código «' + c + '».');
        if (!r.ok) throw new Error('No se pudo leer la empresa (' + r.status + ').');
        j = await r.json();
      }
      if (!j || !j.empresa || (j.codigo && j.codigo !== c)) throw new Error('El archivo de la empresa no es válido.');
      const emp = j.empresa;
      // Solo se aceptan logos de imagen y colores reales (el archivo viene del sitio, pero mejor no confiar a ciegas).
      if (emp.logo && !/^(data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|[\w./-]+\.(png|jpe?g|gif|webp|svg))$/i.test(String(emp.logo))) delete emp.logo;
      if (emp.colorMarca && !/^#[0-9a-f]{3,8}$/i.test(String(emp.colorMarca))) delete emp.colorMarca;
      return { codigo: c, empresa: emp, generado: j.generado || '' };
    }
    /** Lo que el portal guarda en el equipo (sesión, borradores de ATS y reportes, plantillas…), de la empresa anterior. */
    function borrarLocal() {
      try { Object.keys(localStorage).filter((k) => /^(ssta-|ats-)/.test(k) && !/^ssta-admin-/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
      try { indexedDB.deleteDatabase('ssta-listas'); } catch (e) {}   // v168: las copias de las listas de la empresa anterior
    }
    /** ¿Hay registros sin enviar en este celular? (no se cambia de empresa con cosas en la cola) */
    function pendientes() {
      return new Promise((ok) => {
        try {
          const req = indexedDB.open('ssta-outbox', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
          req.onsuccess = () => { try { const c = req.result.transaction('pending', 'readonly').objectStore('pending').count(); c.onsuccess = () => ok(c.result || 0); c.onerror = () => ok(0); } catch (e) { ok(0); } };
          req.onerror = () => ok(0);
        } catch (e) { ok(0); }
      });
    }
    /** Entra a la empresa c: si había otra, primero revisa la cola y borra lo de la anterior en este equipo. */
    async function entrar(c) {
      c = String(c || '').trim().toLowerCase();
      if (!valido(c)) throw new Error('El código tiene letras minúsculas, números y guiones (ej: acme-sas).');
      const d = await traer(c);
      if (cod && cod !== c) {
        const n = await pendientes();
        if (n) throw new Error('Este celular tiene ' + n + ' registro(s) de ' + ((datos && datos.empresa && datos.empresa.nombreCorto) || cod) + ' sin enviar. Envíalos (con señal) antes de cambiar de empresa.');
        borrarLocal(); try { sessionStorage.clear(); } catch (e) {}
      }
      ls('ssta-empresa', c); ls('ssta-empresa-datos', JSON.stringify(d));
      return d;
    }
    function salir() { borrarLocal(); }
    // Si en otra pestaña se cambió de empresa, esta se recarga para no mezclar datos.
    if (!enConsola && !editar) try { window.addEventListener('storage', (ev) => { if (ev.key === 'ssta-empresa' && (ev.newValue || '') !== cod) location.reload(); }); } catch (e) {}
    // Con señal, se refrescan los datos de la empresa (logo, formatos, módulos…) para la próxima vez.
    if (cargada && typeof fetch !== 'undefined') setTimeout(() => { traer(cod).then((d) => { const a = JSON.stringify(d.empresa); if (a !== JSON.stringify(datos.empresa) && ls('ssta-empresa') === cod) {
        ls('ssta-empresa-datos', JSON.stringify(d));
        // v125: en el inicio (donde no se está llenando nada) lo nuevo se ve de una vez: menús, nombres, marca.
        const pg = location.pathname.split('/').pop() || 'index.html';
        let ya = 0; try { ya = Number(sessionStorage.getItem('ssta-recargo-config') || 0); } catch (e) {}
        if (pg === 'index.html' && Date.now() - ya > 60000) { try { sessionStorage.setItem('ssta-recargo-config', String(Date.now())); } catch (e) {} location.reload(); }
      } }).catch(() => {}); }, 2500);
    // Sin empresa elegida, las páginas llevan al inicio (allí se escribe el código).
    const pagina = location.pathname.split('/').pop() || 'index.html';
    if (E.sinEmpresa && !/^(index\.html|estado\.html|configurar-empresa\.html|instalar\.html|offline\.html|ayuda\.html|admin\.html)?$/.test(pagina)) {
      // Se recuerda a qué página iba (con su #registro) para volver allí después de elegir la empresa.
      const volver = pagina + (location.hash || '');
      location.replace('index.html?' + (pedido ? 'e=' + encodeURIComponent(pedido) + '&' : '') + 'volver=' + encodeURIComponent(volver));
    }
    return { activo: true, consola: enConsola, editando: !!(editar && editar.empresa), codigo: cod, pedido, automatico, cargada, proveedor, entrar, salir, pendientes, nombre: () => (datos && datos.empresa && (datos.empresa.nombreCorto || datos.empresa.nombre)) || '' };
  })();

  const Empresa = (function () {
    const E = EMPRESA;
    const PRODUCTO = String(E.producto || 'Portal SSTA');
    // Empresa sin logo propio: un distintivo con sus iniciales y su color.
    if (!E.logo) {
      const ini = String(E.nombreCorto || E.nombre || 'SST').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]/g, '').split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'SST';
      const color = E.colorMarca || '#1f3b57';
      E.logo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140"><rect width="240" height="140" rx="22" fill="' + color + '"/><text x="120" y="92" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#fff">' + ini + '</text></svg>');
    }
    const FABRICA = ['SSTA-F-005', 'SSTA-F-006', 'SSTA-F-007', 'SSTA-F-116', 'SSTA-F-117', 'SSTA-F-118', 'SSTA-F-119', 'SSTA-F-147', 'SSTA-F-149', 'SSTA-F-180'];
    const MODULO_DE = {
      'permiso-trabajo-caliente.html': 'caliente', 'permiso-trabajo-alturas.html': 'alturas', 'permiso-espacios-confinados.html': 'confinados',
      'permiso-izajes-cargas.html': 'izajes', 'permiso-trabajo-electrico.html': 'electrico', 'ats.html': 'ats', 'asistencia.html': 'asistencia',
      'personal-autorizado.html': 'personal', 'inspeccion-epp.html': 'epp', 'dashboard.html': 'tablero',
      'reportes.html': 'reportes', 'habilitacion.html': 'habilitacion', 'plan-accion.html': 'plan', 'inspecciones.html': 'inspecciones', 'indicadores.html': 'indicadores',
      'copasst.html': 'copasst', 'convivencia.html': 'convivencia', 'comite-emergencias.html': 'comiteemergencias', 'auditorias.html': 'auditorias',
      'plan-anual.html': 'plananual', 'peligros.html': 'peligros', 'emergencias.html': 'emergencias', 'salud.html': 'salud', 'pve.html': 'salud', 'documental.html': 'documental', 'revision-direccion.html': 'revision',
      'presupuesto.html': 'presupuesto', 'pantalla-planta.html': 'tablero', 'contratistas.html': 'contratistas', 'usuarios.html': 'usuarios', 'entrega-epp.html': 'dotacion', 'dotacion.html': 'dotacion', 'induccion.html': 'induccion', 'programas.html': 'programas', 'pesv.html': 'pesv', 'gerencia.html': 'gerencia', 'informe.html': 'gerencia', 'informe-mes.html': 'gerencia', 'ambiental.html': 'ambiental', 'quimicos.html': 'quimicos', 'documentos.html': 'kit', 'areas.html': 'kit', 'analitica.html': 'evidencias', 'bitacora.html': 'evidencias', 'persona.html': 'habilitacion', 'equipo.html': 'preop', 'ficha.html': 'evidencias', 'habeas.html': 'evidencias', 'normograma.html': 'documental', 'calidad.html': 'calidad', 'matrices-iso.html': 'calidad', 'asesor.html': 'asesor', 'cierre-mes.html': 'cierre', 'evidencias.html': 'evidencias', 'paquete-cliente.html': 'evidencias', 'preoperacional.html': 'preop', 'etiquetas-qr.html': 'preop', 'papelera.html': 'usuarios', 'proveedores.html': 'proveedores'
    };

    /* v126: los formatos del portal (SSTA-F-…) vienen SIN código: cada empresa pone el suyo en el
       configurador («Códigos de los formatos»). Sin código, no se muestra ninguno. */
    const DE_FABRICA = (id) => /^SSTA-F-/.test(String(id));
    function formato(id) {
      return Object.assign({ codigo: DE_FABRICA(id) ? '' : id, version: '', fecha: '', actualizacion: '' }, (E.formatos && E.formatos[id]) || {});
    }
    function codigo(id) { return formato(id).codigo || (DE_FABRICA(id) ? '' : id); }
    const PERMISOS_MOD = ['caliente', 'alturas', 'confinados', 'izajes', 'electrico'];
    /** v124: lo que el administrador apagó dentro de un módulo para esta empresa
        (E.ocultos = { preop: [ids], inspecciones: [ids] }). */
    /** v125: cada empresa le pone a los preoperacionales e inspecciones su nombre y su código
        (E.bautizos = { preop: { id: { nombre, codigo } }, inspecciones: { … } }). */
    function bautizar(lista, f) {
      const b = f && E.bautizos && E.bautizos[lista] && E.bautizos[lista][f.id];
      if (!b) return f;
      const o = Object.assign({}, f);
      if (b.nombre) { o.nombre = b.nombre; o.titulo = b.nombre; }
      if (b.codigo) { o.codigo = b.codigo; o.codigoEmpresa = b.codigo; }
      return o;
    }
    /* v129: si la empresa todavía no ha escogido qué tipos de reporte se ofrecen, el accidente de
       trabajo no sale en «Reportar» (lo registra SST). Lo demás, todo visible. */
    const OCULTOS_FABRICA = { reportes: ['Accidente de trabajo'] };
    function visible(lista, id) { const o = E.ocultos && Array.isArray(E.ocultos[lista]) ? E.ocultos[lista] : (OCULTOS_FABRICA[lista] || []); return o.indexOf(id) === -1; }
    function moduloActivo(k) {
      if (!E.modulos) return true;
      // v123: el tablero es el de los permisos; sin ningún permiso contratado, tampoco sale.
      if (k === 'tablero' && !PERMISOS_MOD.some((m) => E.modulos[m] !== false)) return false;
      return E.modulos[k] !== false;
    }
    /* ── Quién ve qué (v111) ──
       PUBLICO: solo los preoperacionales y los reportes (evento, PQRS y «¿qué peligros ves?»):
       cualquiera, sin usuario ni contraseña.
       Todo lo demás es el «Sistema de gestión» y pide entrar con usuario y contraseña:
       también los permisos de trabajo, el ATS, las charlas, el personal autorizado y la
       inspección de EPP (antes eran públicos). Administrador y SST ven todo; el supervisor
       de campo siempre tiene lo de la obra (CAMPO) además de lo de su tabla. */
    const PUBLICO = ['reportes', 'preop'];
    const CAMPO = ['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'asistencia', 'personal', 'epp', 'brigadistas', 'tablero'];
    const ACCESO_FABRICA = {
      supervisor: ['habilitacion', 'inspecciones', 'plan', 'contratistas', 'dotacion', 'induccion', 'emergencias', 'comiteemergencias', 'pesv', 'programas', 'quimicos', 'peligros'],
      comite: ['copasst', 'convivencia', 'comiteemergencias', 'inspecciones', 'plan', 'indicadores', 'peligros', 'auditorias', 'plananual', 'habilitacion', 'tablero'],
      consulta: ['gerencia', 'indicadores', 'plan', 'plananual', 'cierre', 'evidencias', 'auditorias', 'revision', 'documental', 'kit', 'peligros', 'habilitacion', 'calidad', 'ambiental', 'copasst', 'proveedores', 'tablero']
    };
    const esPublico = (m) => !m || m === 'externo' || PUBLICO.indexOf(m) !== -1;
    function accesoRol(m, rol) {
      if (esPublico(m) || rol === 'admin' || rol === 'sst') return true;
      if (rol === 'supervisor' && CAMPO.indexOf(m) !== -1) return true;
      const t = Object.assign({}, ACCESO_FABRICA, E.acceso || {});
      return Array.isArray(t[rol]) && t[rol].indexOf(m) !== -1;
    }
    /** Tabla en uso (fábrica + lo que la empresa cambió en EMPRESA.acceso), para mostrarla. */
    function tablaAcceso() { return Object.assign({}, ACCESO_FABRICA, E.acceso || {}); }
    /** Rol de quien está en este equipo (solo si el servidor usa usuarios y hay sesión). */
    function rolActual() {
      try { return typeof Sesion !== 'undefined' && Sesion.modo() && Sesion.yo() ? Sesion.rol() : null; } catch (e) { return null; }
    }
    function moduloDeHref(href) {
      const h = String(href || '');
      if (/^https?:/i.test(h)) return 'externo';
      const archivo = h.split(/[?#]/)[0].split('/').pop();
      if (archivo === 'inspeccion-epp.html' && /tipo=brigadista/.test(h)) return 'brigadistas';
      return MODULO_DE[archivo] || null;
    }

    /* ── Reemplazo de textos: nombre del producto y códigos propios de los formatos ── */
    const reemplazos = [];
    if (PRODUCTO !== 'Portal SSTA') reemplazos.push([/Portal SSTA/g, PRODUCTO]);
    FABRICA.forEach((id) => {
      const c = codigo(id), x = id.replace(/-/g, '\\-') + '(?!\\d)';
      if (c === id) return;
      if (c) { reemplazos.push([new RegExp(x, 'g'), c]); return; }
      // Sin código de la empresa: se quita el de fábrica con lo que lo acompaña («(…)», «… · », «Anexo …»).
      reemplazos.push([new RegExp('\\s*\\((?:[Ff]ormato\\s+)?' + x + '\\)', 'g'), ''], [new RegExp('(?:Anexo\\s+|[Ff]ormato\\s+)?' + x + '\\s*·\\s*', 'g'), ''],
        [new RegExp('\\s*·\\s*(?:[Ff]ormato\\s+)?' + x, 'g'), ''], [new RegExp('(?:Anexo\\s+|[Ff]ormato\\s+)?' + x, 'g'), '']);
    });
    function cambiarTexto(s) {
      let r = s;
      for (let i = 0; i < reemplazos.length; i++) r = r.replace(reemplazos[i][0], reemplazos[i][1]);
      return r;
    }
    const ATRIBUTOS = ['aria-label', 'placeholder', 'title', 'alt', 'data-search'];
    function metaFormato(el) {
      // Encabezado de los permisos: "Código: <b>SSTA-F-117</b> · Versión: <b>2</b><br>Fecha doc…"
      if (el.dataset.empresaMeta) return;
      const m = /SSTA-F-\d+/.exec(el.textContent || '');
      if (!m || FABRICA.indexOf(m[0]) === -1) return;
      const f = formato(m[0]);
      el.dataset.empresaMeta = '1';
      const largo = el.dataset.meta === 'largo' || /Versión|Fecha/.test(el.textContent);
      el.innerHTML = [f.codigo ? 'Código: <b>' + esc(f.codigo) + '</b>' : '', f.version ? (largo ? 'Versión: <b>' + esc(f.version) + '</b>' : 'V' + esc(f.version)) : ''].filter(Boolean).join(' · ') +
        (largo && (f.fecha || f.actualizacion) ? '<br>' + [f.fecha ? 'Fecha doc: ' + esc(f.fecha) : '', f.actualizacion ? 'Act.: ' + esc(f.actualizacion) : ''].filter(Boolean).join(' · ') : '');
    }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function aplicar(raiz) {
      if (!raiz) return;
      if (raiz.nodeType === 1) {
        raiz.querySelectorAll && raiz.querySelectorAll('.hdr .meta').forEach(metaFormato);
        if (raiz.matches && raiz.matches('.hdr .meta')) metaFormato(raiz);
      }
      if (raiz.nodeType === 1 && raiz.closest && raiz.closest('[data-empresa-no-tocar]')) return;
      if (raiz.nodeType === 3 && raiz.parentElement && raiz.parentElement.closest('[data-empresa-no-tocar]')) return;
      // [data-empresa-no-tocar]: zonas que muestran los textos de fábrica a propósito (configurador).
      const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        { acceptNode: (x) => (x.nodeType === 1 && x.hasAttribute('data-empresa-no-tocar')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      let n = raiz.nodeType === 3 ? raiz : w.currentNode;
      while (n) {
        if (n.nodeType === 3) {
          const p = n.parentNode && n.parentNode.nodeName;
          if (p !== 'SCRIPT' && p !== 'STYLE') { const t = cambiarTexto(n.data); if (t !== n.data) n.data = t; }
        } else if (n.nodeType === 1) {
          for (let i = 0; i < ATRIBUTOS.length; i++) {
            const v = n.getAttribute(ATRIBUTOS[i]);
            if (v) { const t = cambiarTexto(v); if (t !== v) n.setAttribute(ATRIBUTOS[i], t); }
          }
          if (n.nodeName === 'IMG') { const s = n.getAttribute('src') || ''; if (/logo-empresa\.svg$/.test(s)) n.setAttribute('src', E.logo); }
        }
        if (raiz.nodeType === 3) break;
        n = w.nextNode();
      }
    }

    /* ── Inicio: módulos apagados y enlaces de otra empresa ── */
    function filtrarInicio() {
      if (!document.querySelector('.accordion')) return;
      document.querySelectorAll('a.card[href]').forEach((a) => {
        const m = moduloDeHref(a.getAttribute('href'));
        const fuera = m && m !== 'externo' && !moduloActivo(m);
        // Con usuario: lo que su rol no ve tampoco sale en el inicio.
        const rol = rolActual();
        if (fuera || (rol && !accesoRol(m, rol))) a.classList.add('oculto-empresa');
      });
      document.querySelectorAll('details.sub-item').forEach((d) => {
        const vis = d.querySelectorAll('a.card:not(.oculto-empresa)').length;
        const c = d.querySelector('.sub-count'); if (c) c.textContent = vis;
        if (!vis) d.classList.add('oculto-empresa');
      });
      document.querySelectorAll('details.accordion-item').forEach((d) => {
        if (!d.querySelector('a.card:not(.oculto-empresa)')) d.classList.add('oculto-empresa');
      });
    }

    function estilos() {
      const st = document.createElement('style');
      st.id = 'estiloEmpresa';
      let css = '.oculto-empresa{display:none !important;}';
      const url = 'url("' + String(E.logo).replace(/"/g, '%22') + '")';
      css += '.marca{background-image:' + url + ' !important;}body .hdr-logo{background-image:' + url + ' !important;}';
      if (E.colorMarca) css += ':root{--brand-index:' + E.colorMarca + ';}';
      // v123: el color de la marca pinta el saludo del inicio y los acentos (antes solo una franja que ya no se ve).
      const hx = /^#([0-9a-f]{6})$/i.exec(String(E.colorMarca || '').trim());
      if (hx && hx[1].toLowerCase() !== '1f3b57') {
        const n = parseInt(hx[1], 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
        const mez = (a, f) => '#' + rgb.map((c) => Math.round(c + (a - c) * f).toString(16).padStart(2, '0')).join('');
        css += 'html body{--h1:' + mez(255, .12) + ' !important;--h2:' + mez(0, .28) + ' !important;--h3:' + mez(255, .45) + ' !important;}' +
          'html body .pub-hero{box-shadow:0 18px 40px ' + 'rgba(' + rgb.join(',') + ',.28) !important;}' +
          'html body .hdr-acc .btn-gestion[aria-pressed="true"],html body .sg-btn{background:linear-gradient(135deg,' + mez(255, .1) + ',' + mez(0, .25) + ') !important;}' +
          // y también el encabezado de cada página, los títulos de sección y el botón principal de entrar.
          'html body .hdr,html body .header{background:radial-gradient(80% 100% at 0 100%,' + mez(0, .35) + ',transparent 65%),linear-gradient(135deg,' + mez(255, .15) + ',' + mez(0, .2) + ') !important;box-shadow:0 16px 36px rgba(' + rgb.join(',') + ',.25) !important;}' +
          'html body .section-title:not(.locked),html body .acceso-rol .ar-si{background:linear-gradient(135deg,' + mez(255, .1) + ',' + mez(0, .25) + ') !important;}';
      }
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
    }

    function iniciar() {
      estilos();
      if (reemplazos.length) {
        document.title = cambiarTexto(document.title);
        aplicar(document.body);
        // Lo que se pinta después (listas, modales, la hoja del PDF) también.
        new MutationObserver((muts) => {
          muts.forEach((m) => m.addedNodes.forEach((nd) => { if (nd.nodeType === 1 || nd.nodeType === 3) aplicar(nd); }));
        }).observe(document.body, { childList: true, subtree: true });
        window.addEventListener('beforeprint', () => aplicar(document.body));
      }
      filtrarInicio();
      const cab = document.querySelector('[data-empresa="cabecera"]');
      if (cab) cab.textContent = (E.nombre || E.nombreCorto) + (E.nit ? ' · NIT ' + E.nit : '') + (E.subtitulo ? ' — ' + E.subtitulo : '');
      document.querySelectorAll('[data-empresa="nombre"]').forEach((el) => { el.textContent = E.nombre || E.nombreCorto || ''; });
      document.querySelectorAll('[data-empresa="marca"]').forEach((el) => { el.textContent = (E.nombreCorto || E.nombre || '') + ' · ' + PRODUCTO; });
      document.querySelectorAll('.marca[role="img"], .hdr-logo[role="img"]').forEach((el) => el.setAttribute('aria-label', 'Logo de ' + (E.nombreCorto || E.nombre || 'la empresa')));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else if (document.body) iniciar();

    return {
      formato, codigo, moduloActivo, visible, bautizar, aplicar, moduloDeHref, esPublico, accesoRol, rolActual, tablaAcceso,
      logo: () => E.logo,
      producto: PRODUCTO,
      pie: () => PRODUCTO + ' · ' + (E.nombreCorto || E.nombre)
    };
  })();

  /* Empresa demo: carga el servidor simulado ANTES que el resto del portal. */
  if (EMPRESA.demo && typeof document !== 'undefined' && document.readyState === 'loading') {
    document.write('<script src="demo/demo.js"><\/script>');
  }

  g.PAGINAS_CONSOLA = PAGINAS_CONSOLA; g.MultiEmpresa = MultiEmpresa; g.Empresa = Empresa; g.MOTOR_EMPRESA = 'v116';
})(typeof globalThis !== 'undefined' ? globalThis : window, typeof Empresa !== 'undefined');
