#!/usr/bin/env node
/* ============================================================
   pruebas.js — Comprobaciones antes de desplegar el Portal SSTA
   ------------------------------------------------------------
   POR QUÉ EXISTE ESTO

   El bug que más caro salió del portal fue el de las firmas: durante semanas
   se guardaron inspecciones y permisos SIN la firma, porque el PNG superaba el
   máximo de 50.000 caracteres que Google Sheets admite en una celda. Nada
   fallaba a la vista — la pantalla decía "Firmado ✓", el permiso se guardaba,
   los nombres quedaban — y solo se descubrió por casualidad, revisando un
   permiso viejo.

   Estas pruebas no reemplazan probar en el celular. Lo que hacen es atrapar,
   en dos segundos y antes de subir nada, la clase de error que no se ve:
   listas que dejaron de coincidir entre el navegador y el servidor, límites
   que se superan en silencio, archivos que quedaron sin registrar en la caché.

   CÓMO SE USA
       cd pruebas && npm install     (una sola vez)
       node pruebas.js

   Devuelve 0 si todo está bien y 1 si algo falló, para poder encadenarlo a un
   despliegue automático más adelante.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

/* ── Producto neutro (v108): ningún dato de una empresa real en el código ──
   Las palabras prohibidas van como huella (sha256), para no escribirlas aquí. */
const HUELLAS_PROHIBIDAS = new Set(['c0ebeb071b84dc97', '819d9245a5d6ce62', 'c16f4f348ff8e412', '3d390cac0a06ed28', '48d2500452de7875', '9de6b6c5b17da829',
  '542e2cb66b448928', '484164097713d42a', '604521f2f552c43d', '36b0e3489f87f1a3', '44a0374b4c329947']);
function rastroReal(texto) {
  const cr = require('crypto'), vistas = new Set();
  const palabras = String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) || [];
  for (const w of palabras) {
    if (w.length < 5 || vistas.has(w)) continue; vistas.add(w);
    if (HUELLAS_PROHIBIDAS.has(cr.createHash('sha256').update(w).digest('hex').slice(0, 16))) return true;
  }
  return false;
}
function archivosTexto(dir, out) {
  for (const n of fs.readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const f = path.join(dir, n), st = fs.statSync(f);
    if (st.isDirectory()) archivosTexto(f, out);
    else if (/\.(html|js|css|json|md|txt|gs|py|svg)$/i.test(n)) out.push(f);
  }
  return out;
}


let fallos = 0, total = 0;
const grupos = [];
function grupo(nombre, fn) { grupos.push([nombre, fn]); }
function ok(desc, cond, detalle) {
  total++;
  if (cond) { console.log('    ✓ ' + desc); }
  else { fallos++; console.log('    ✗ ' + desc + (detalle ? '\n        ' + detalle : '')); }
}
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8') + (/\.html$/.test(f) && fs.existsSync(path.join(RAIZ, f.replace(/\.html$/, '.app.js'))) ? '\n<script>\n' + fs.readFileSync(path.join(RAIZ, f.replace(/\.html$/, '.app.js')), 'utf8') + '\n</script>\n' : '') +   // v162: el código de las páginas grandes va en <página>.app.js
   (f === 'empresa.js' ? '\n' + fs.readFileSync(path.join(RAIZ, 'empresa-motor.js'), 'utf8') : '') + (f === 'ayuda.html' ? '\n' + fs.readFileSync(path.join(RAIZ, 'ayuda-guias.js'), 'utf8') : '');   // v116: el motor va aparte · v129: las guías de la ayuda también
const existe = (f) => fs.existsSync(path.join(RAIZ, f));

/* empresa.js se revisa por sus VALORES, no por cómo está escrito: a mano va
   compacto y el configurador lo escribe en JSON; las dos formas son válidas. */
function datosEmpresa() {
  const vm = require('vm'), src = leer('empresa.js');
  const i = src.indexOf('const EMPRESA = {'), fin = src.indexOf('\n};', i) + 3;
  if (i < 0 || fin < 3) return {};
  const c = {}; vm.createContext(c);
  vm.runInContext(src.slice(i, fin).replace('const EMPRESA =', 'this.EMPRESA ='), c);
  return c.EMPRESA;
}
const formatoVacio = (D, k) => { const f = (D.formatos || {})[k]; return !!f && f.version === '' && f.fecha === '' && f.actualizacion === ''; };
const modulosEncendidos = (lista) => { const m = datosEmpresa().modulos || {}; return lista.every((k) => m[k] === true); };

/* ═══════════════════════════════════════════════════════════
   1. FIRMAS — el fallo que ya nos costó semanas
   ═══════════════════════════════════════════════════════════ */
grupo('Firmas: no pueden perderse en silencio', () => {
  const common = leer('common.js');

  ok('el lienzo se exporta con tamaño acotado (exportarFirmaAcotada)',
     common.includes('exportarFirmaAcotada'),
     'Sin esto, en tablets de pantalla densa el PNG supera las 50.000 celdas de Sheets.');

  const m = /const MAX_CARACTERES = (\d+)/.exec(common);
  ok('el tope del cliente está por debajo del límite de Google Sheets (50.000)',
     m && Number(m[1]) < 50000,
     m ? `MAX_CARACTERES = ${m[1]}` : 'No se encontró MAX_CARACTERES');

  ok('getDataUrl() usa la versión acotada, no el lienzo crudo',
     /getDataUrl:\s*\(\)\s*=>\s*\(hasInk \? exportarFirmaAcotada\(\)/.test(common),
     'Si vuelve a usar canvas.toDataURL() directo, regresa el bug.');

  // Fijar canvas.width/height limpia el lienzo: después de resize() hay que
  // volver a pintar lo firmado. Desde la v64 se hace de forma síncrona con los
  // trazos guardados (redibujar), en vez de copiar una imagen y restaurarla en
  // diferido — la restauración en diferido podía borrar un trazo recién empezado.
  ok('refreshSize() preserva la firma al redimensionar',
     /refreshSize:\s*\(\)\s*=>\s*ajustarTamano\(true\)/.test(common) &&
     /function ajustarTamano[\s\S]{0,900}?resize\(\);\s*redibujar\(\);/.test(common),
     'Sin esto, refrescar el lienzo borra la firma dejando el estado en "Firmado ✓".');

  ok('al redimensionar, los trazos se reescalan a la nueva medida',
     /function ajustarTamano[\s\S]{0,700}?strokes\s*=\s*strokes\.map/.test(common),
     'Sin esto, la firma queda corrida o recortada después de girar el celular.');

  // Al girar el celular, la pantalla debe volver al recuadro que se estaba
  // viendo. Estas tres condiciones son las que fallaban en la v62/v64.
  ok('al girar, vuelve a lo que se está VIENDO, no al último lienzo tocado',
     /const AnclaGiro/.test(common) && /if \(enPantalla\(ultimoTocado\)\) return ultimoTocado;/.test(common),
     'Sin esto, si ya se firmó el recuadro de otro ejecutante, al girar manda a ese.');
  ok('al girar, nunca se ancla a un bloque más alto que media pantalla',
     /masCercanoAlCentro\(SEL_CAMPO, window\.innerHeight \* 0\.5\)/.test(common),
     'Centrar una sección entera deja cualquier parte del permiso a la vista.');
  ok('el giro se detecta por la orientación del aparato (el teclado no cuenta)',
     /screen\.orientation\.type/.test(common),
     'Si se usa el alto de la ventana, abrir el teclado en una tablet dispara el salto.');
  ok('se insiste en volver durante más de un segundo mientras termina el giro',
     (() => { const m = common.match(/REINTENTOS_MS = \[([^\]]+)\]/); return m && Math.max(...m[1].split(',').map(Number)) >= 1000; })(),
     'En Android el giro puede terminar tarde y el navegador deshace una corrección temprana.');

  ok('el lienzo verifica su tamaño real al empezar a firmar',
     /function start\(e\)[\s\S]{0,500}?ajustarTamano\(false\);[\s\S]{0,80}?pos\(e\)/.test(common),
     'Sin esto, si la imagen interna quedó con la medida de horizontal, en vertical la raya sale corrida del dedo.');

  // Firma a pantalla completa en celulares (v66)
  const iFc = common.indexOf('FirmaCompleta.abrir(canvas');
  const iStart = common.indexOf("canvas.addEventListener('touchstart', start");
  ok('en celular, el toque abre la pantalla completa ANTES de dibujar en el recuadro',
     iFc > 0 && iStart > 0 && iFc < iStart && /e\.stopImmediatePropagation\(\);\s*FirmaCompleta\.abrir/.test(common),
     'Si el interceptor queda después, el primer toque deja una raya en el recuadro pequeño.');
  ok('"Listo" sin dibujar NO borra una firma que ya venía guardada',
     /else if \(!teniaBase\) destinoPad\.setStrokes\(\[\]\)/.test(common),
     'Sin esto, abrir la firma de un permiso restaurado y tocar Listo la borra.');
  ok('la firma pasa como trazos escalados sin deformar (misma escala en ancho y alto)',
     /const k = Math\.min\(\(tamCss\.w - 2 \* margen\) \/ bw, \(tamCss\.h - 2 \* margen\) \/ bh, 1\)/.test(common),
     'Una firma hecha en horizontal quedaría aplastada en el recuadro vertical.');
  ok('al confirmar, se avisa al formulario para que guarde el borrador',
     /destino\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/.test(common),
     'El lienzo grande está fuera del formulario: sin este aviso, la firma no entra al borrador.');

  ok('el historial de deshacer NO guarda mapas de bits completos',
     !common.includes('history.push(ctx.getImageData'),
     'Guardar una foto por trazo consumía cientos de MB y el navegador mataba la pestaña.');

  // El backend debe poder partir una firma que no quepa en una celda
  const core = leer('backends/permisos/core.gs');
  ok('el backend trocea firmas que exceden el máximo de celda',
     core.includes('function trocearFirma_') && core.includes('MAX_CHARS_CELDA'),
     'Es la red de seguridad por si entra una firma pesada por otra vía.');

  const mc = /const MAX_CHARS_CELDA = (\d+)/.exec(core);
  ok('el troceo deja margen bajo el límite real de 50.000',
     mc && Number(mc[1]) < 50000,
     mc ? `MAX_CHARS_CELDA = ${mc[1]}` : 'No se encontró MAX_CHARS_CELDA');

  // Simulación del viaje completo: trocear → guardar → leer → reensamblar
  const MAX = Number(mc[1]);
  const trocear = (key, url) => {
    if (url.length <= MAX) return [{ key, texto: url }];
    const t = Math.ceil(url.length / MAX), out = [];
    for (let i = 0; i < t; i++) out.push({ key: key + '~' + (i + 1) + '/' + t, texto: url.substr(i * MAX, MAX) });
    return out;
  };
  const reensamblar = (filas) => {
    const mapa = {}, partes = {};
    filas.forEach(f => {
      const k = String(f.key), pos = k.indexOf('~');
      if (pos === -1) { mapa[k] = f.texto; return; }
      const base = k.substring(0, pos), n = parseInt(k.substring(pos + 1), 10) || 1;
      (partes[base] = partes[base] || []).push({ n, texto: f.texto });
    });
    for (const b in partes) { partes[b].sort((x, y) => x.n - y.n); mapa[b] = partes[b].map(p => p.texto).join(''); }
    return mapa;
  };
  [['firma normal', 20000], ['firma de tablet', 117000], ['firma enorme', 500000]].forEach(([nombre, n]) => {
    const url = 'data:image/png;base64,' + 'A'.repeat(n);
    const filas = trocear('k1', url);
    const cabenTodas = filas.every(f => f.texto.length <= 50000);
    const recuperada = reensamblar(filas.slice().reverse())['k1']; // llegan desordenadas a propósito
    ok(`${nombre} (${n.toLocaleString()} car.) viaja y vuelve intacta en ${filas.length} fila(s)`,
       cabenTodas && recuperada === url);
  });
});

/* ═══════════════════════════════════════════════════════════
   2. EPP — el correo de reposición debe coincidir con lo marcado
   ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   Tablero: nunca decir "todo cerrado" con datos incompletos (v66)
   ═══════════════════════════════════════════════════════════ */
grupo('Tablero y contador de permisos abiertos', () => {
  const dash = leer('dashboard.html');
  const idx = leer('index.html');
  ok('el tablero registra los tipos de permiso que no respondieron',
     /nFallidos\.push/.test(dash) && !/status !== 'fulfilled'\) return; \/\/ backend no disponible; se omite/.test(dash),
     'Antes se omitían en silencio: con un backend caído el tablero podía decir "No hay permisos abiertos ✓".');
  ok('el chulo de "No hay permisos abiertos" solo sale si respondieron todos',
     /else if\(fallidos\.length\) msg = '⚠️ No se puede confirmar/.test(dash),
     'Una lista incompleta que parece completa es una falsa tranquilidad.');
  ok('un backend que responde con error (token, login de Google) también cuenta como caído',
     /if\(!data \|\| !data\.ok \|\| !Array\.isArray\(data\.rows\)\)/.test(dash));
  ok('el contador de la portada avisa cuando le faltan datos',
     /sinDatos\.push/.test(idx) && /al menos /.test(idx),
     'Sin esto, el contador sale por debajo de lo real sin decirlo.');
});

/* ═══════════════════════════════════════════════════════════
   ATS interactivo (SSTA-F-007) — base de conocimiento GTC 45
   ═══════════════════════════════════════════════════════════ */
grupo('ATS interactivo', () => {
  const vm = require('vm');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(leer('ats-catalogo.js') + ';this.D={PELIGROS,TAREAS,EPP,EMERGENCIA,PERMISOS,JERARQUIA,CLASES_GTC45,CONDICIONES,ATS_FORMATO}', ctx);
  const D = ctx.D;
  const pid = new Set(D.PELIGROS.map((p) => p.id));
  const tid = new Set(D.TAREAS.map((t) => t.id));
  const eid = new Set(D.EPP.map((e) => e.id));
  const emid = new Set(D.EMERGENCIA.map((e) => e.id));

  ok('los peligros cubren las 7 clases de la GTC 45',
     D.CLASES_GTC45.length === 7 && D.CLASES_GTC45.every((c) => D.PELIGROS.some((p) => p.clase === c.id)));
  ok('no hay ids de peligro ni de tarea repetidos',
     pid.size === D.PELIGROS.length && tid.size === D.TAREAS.length);
  const sinCtrl = D.PELIGROS.filter((p) => !p.controles.length || p.controles.some((c) => !D.JERARQUIA[c[1]]));
  ok('todo peligro tiene controles con jerarquía válida (E/S/I/A/P)', !sinCtrl.length, sinCtrl.map((p) => p.id).join(', '));
  const rotas = [];
  D.TAREAS.forEach((t) => {
    if (!t.peligros.length) rotas.push(t.id + ': sin peligros');
    t.peligros.forEach((x) => { if (!pid.has(x)) rotas.push(t.id + ' → ' + x); });
    (t.siguiente || []).forEach((x) => { if (!tid.has(x)) rotas.push(t.id + ' sigue → ' + x); });
  });
  D.PELIGROS.forEach((p) => {
    (p.epp || []).forEach((x) => { if (!eid.has(x)) rotas.push(p.id + ' epp → ' + x); });
    (p.emergencia || []).forEach((x) => { if (!emid.has(x)) rotas.push(p.id + ' emergencia → ' + x); });
  });
  D.CONDICIONES.concat(D.PERMISOS).forEach((c) => c.peligros.forEach((x) => { if (!pid.has(x)) rotas.push(c.id + ' → ' + x); }));
  ok('no hay referencias rotas entre tareas, peligros, EPP y condiciones', !rotas.length, rotas.join(' | '));
  ok('existen las 3 tareas de inicio y la de orden y aseo',
     D.TAREAS.filter((t) => t.inicio).length === 3 && tid.has('orden'));

  // Las palabras clave se buscan desde el inicio de palabra (igual que en ats.html).
  const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const contiene = (t, k) => new RegExp('(^|[^a-z0-9])' + norm(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(norm(t));
  const detecta = (texto) => D.PELIGROS.filter((p) => (p.claves || []).some((k) => contiene(texto, k))).map((p) => p.id);
  const sold = detecta('Soldadura TIG de soportes');
  ok('"soldadura" sugiere humos y radiación del arco, pero NO radiación solar',
     sold.includes('humos') && sold.includes('rad_soldadura') && !sold.includes('rad_solar'), sold.join(', '));
  ok('"Gaseosas Lux" no sugiere cilindros de gas', !detecta('Tanque para Gaseosas Lux').includes('tec_gas'));
  ok('"andamio a 4 metros" sugiere trabajo en alturas', detecta('armado de andamio a 4 metros').includes('alturas'));

  const ats = leer('ats.html');
  ok('ats.html no usa id="app" (common.css lo oculta en los permisos)', !/id="app"/.test(ats),
     'Con id="app" la página del ATS salía completamente en blanco.');
  ok('el autocompletar de personal no se cierra al desplazar la pantalla',
     !/window\.addEventListener\('scroll', cerrar, true\)/.test(ats.split('function autocompletar')[1] || ''),
     'En el celular el teclado desplaza la pantalla y cerraba la lista antes de poder tocar un nombre.');
  ok('el borrador se guarda al cerrar o bloquear el celular (firma recién hecha)',
     /addEventListener\('pagehide', guardarYa\)/.test(ats));
  ok('al imprimir no se rearma la hoja si ya está en vista previa (el logo no alcanzaba a cargar)',
     /beforeprint[\s\S]{0,120}classList\.contains\('previa'\)/.test(ats));
  ok('el logo de reserva (antes de cargar el de la empresa) está en la caché', leer('sw.js').includes("'./logo-empresa.svg'") && existe('logo-empresa.svg'));
  ok('la portada enlaza el ATS', leer('index.html').includes('href="ats.html"'));
  ok('config.js tiene la entrada del backend del ATS', /ats: \{[\s\S]*?url:/.test(leer('config.js')));
  ok('la cola sin señal no espera al Service Worker para confirmar (se quedaba en "Guardando…")',
     !/await navigator\.serviceWorker\.ready/.test(leer('common.js').split('async add(')[1].split('async list(')[0]));
  ok('el ATS avisa conflicto en vez de sobrescribir lo de otro dispositivo', /r\.conflicto/.test(ats) && /versionBase: ats\.version/.test(ats));
  ok('después de guardar, el ATS se vuelve a leer y se compara (verificación)', /async function verificarGuardado/.test(ats));
  ok('la cola sin señal verifica un "agregar personal" persona por persona (no basta con que el ATS exista)',
     /item\.body\.action === 'agregarParticipantes'/.test(leer('common.js')));
  ok('"Llegó más gente" aparece apenas se guarda el ATS (no solo al recargar)',
     /function actualizarEstado\(\) \{[\s\S]{0,300}btnModoAgregar/.test(ats));
  ok('para agregar personal hay que marcar que se le socializó el ATS', /falta marcar que se le socializó el ATS/.test(ats));
  ok('el ATS abre en un menú como el de los permisos: abrir, cerrar y agregar personal',
     /<body class="en-menu">/.test(ats) && /id="opAbrir"/.test(ats) && /id="opCerrar"/.test(ats) && /id="opAgregar"/.test(ats));
  ok('los motivos de cierre del ATS son los mismos en la pantalla y en el backend', (() => {
    const pant = (/<select id="cMotivo">([\s\S]*?)<\/select>/.exec(ats) || [])[1] || '';
    const enPant = [...pant.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);
    const back = (/const MOTIVOS_CIERRE = \[([\s\S]*?)\]/.exec(leer('backends/backend-ats.gs')) || [])[1] || '';
    const enBack = [...back.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    return enPant.length === 5 && JSON.stringify(enPant) === JSON.stringify(enBack);
  })());
  ok('la cola sin señal reconoce un cierre de ATS ya aplicado', /action === 'cerrarAts'\) return json\.estado === 'CERRADO'/.test(leer('common.js')));
  ok('la hoja impresa del ATS lleva QR al modo "Agregar personal" (como los permisos)',
     /QR\.comoImagen\(enlaceAgregar\(ats\.code\)/.test(ats) && /<script src="qr\.js"><\/script>/.test(ats));
  const tamQr = /\.hoja \.qr-hoja img\{width:(\d+)px/.exec(ats);
  ok('el QR impreso mide al menos 100 px (~25 mm) y tiene margen de 4 módulos, para que la cámara lo lea en papel',
     tamQr && Number(tamQr[1]) >= 100 && /enlaceAgregar\(ats\.code\), \{ px: \d+, margen: 4 \}/.test(ats),
     'A 72 px (17 mm) y margen 2 un lector no lo decodificaba desde el PDF.');
});

/* ═══════════════════════════════════════════════════════════
   Backend del ATS — se EJECUTA en un simulador de Apps Script
   ═══════════════════════════════════════════════════════════ */
grupo('Backend del ATS (ejecutado en simulador)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const vm = require('vm');
  const cat = {}; vm.createContext(cat);
  vm.runInContext(leer('ats-catalogo.js') + ';this.D={PELIGROS,TAREAS,CLASES_GTC45}', cat);
  const { PELIGROS, TAREAS, CLASES_GTC45 } = cat.D;
  const PEL = Object.fromEntries(PELIGROS.map((p) => [p.id, p]));
  const CL = Object.fromEntries(CLASES_GTC45.map((c) => [c.id, c.nombre]));
  const TOKEN = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const firma = (n, s) => 'data:image/png;base64,' + require('crypto').createHash('sha256').update(String(s)).digest('base64').repeat(Math.ceil(n / 44)).slice(0, n);
  const inst = (id) => ({ id, clase: CL[PEL[id].clase], sub: PEL[id].sub, texto: PEL[id].texto, efectos: PEL[id].efectos, ctrls: PEL[id].controles.map(([t, j]) => ({ t, j, on: true })), extra: [] });
  const armar = (nT, nP) => ({ v: 1,
    cab: { centro: ['Cliente uno'], desde: '2026-09-28', hasta: '', area: 'Bodega', trabajo: 'Prueba', requiere: 'SI', permisos: ['caliente'] },
    participantes: Array.from({ length: nP }, (_, i) => ({ nombres: 'N' + i, apellidos: 'A' + i, cedula: String(i), cargo: 'X', firma: firma(30000 + i, i) })),
    tareas: Array.from({ length: nT }, (_, i) => { const t = TAREAS[i % TAREAS.length]; return { uid: 'u' + i, plantilla: t.id, titulo: t.nombre, desc: t.desc, peligros: t.peligros.map(inst), generales: [], responsables: [] }; }),
    firmas: { lider: { nombre: 'L', firma: firma(40000, 'L') }, jefe: { nombre: 'J', firma: null }, sst: { nombre: 'S', firma: null } } });

  let E;
  try { E = crearEntorno(path.join(RAIZ, 'backends/backend-ats.gs')); }
  catch (e) { ok('backend-ats.gs se carga en el simulador', false, e.message); return; }

  ok('rechaza un token inválido', !E.post({ token: 'x', ats: armar(1, 1) }).ok);
  const grande = armar(22, 12);
  const r1 = E.post({ token: TOKEN, opId: 'a', code: 'ATS-20260928-111111', versionBase: 0, ats: grande });
  ok('guarda un ATS de 22 tareas y 12 firmas (' + Math.round(JSON.stringify(grande).length / 1000) + ' mil caracteres)', r1.ok && r1.version === 1, r1.error);
  const maxCelda = Math.max(...Object.values(E.hojas).flatMap((h) => h.filas.flat()).map((v) => (typeof v === 'string' ? v.length : 0)));
  ok('ninguna celda supera 50.000 caracteres (el límite de Google Sheets)', maxCelda <= 50000, 'celda más grande: ' + maxCelda);
  const leido = E.get({ token: TOKEN, code: 'ATS-20260928-111111' }).ats || {};
  delete leido.code; delete leido.version;
  // v137: el servidor agrega el sello de cada firma (<campo>_sello); lo demás debe quedar idéntico.
  const sinSellos = (o) => JSON.parse(JSON.stringify(o, (k, v) => (/_sello$/.test(k) ? undefined : v)));
  const sellos = []; JSON.stringify(leido, (k, v) => { if (/_sello$/.test(k)) sellos.push(v); return v; });
  ok('lo que se lee es idéntico a lo que se guardó, firmas incluidas', JSON.stringify(sinSellos(leido)) === JSON.stringify(grande));
  ok('v137: cada firma del ATS quedó con su sello (hora del servidor, huella y código)', sellos.length > 0 && sellos.every((x) => x && x.fecha && x.huella && x.codigo), sellos.length + ' sellos');
  ok('un reenvío con el mismo opId no duplica', E.post({ token: TOKEN, opId: 'a', code: 'ATS-20260928-111111', ats: grande }).duplicado === true);
  ok('guardar sobre la versión vigente sube a v2', E.post({ token: TOKEN, opId: 'b', code: 'ATS-20260928-111111', versionBase: 1, ats: grande }).version === 2);
  const conf = E.post({ token: TOKEN, opId: 'c', code: 'ATS-20260928-111111', versionBase: 1, ats: armar(1, 1) });
  ok('guardar sobre una versión vieja NO sobrescribe (conflicto entre dispositivos)', !conf.ok && conf.conflicto === true);
  ok('"Datos" y "Peligros" se reemplazan al volver a guardar, no se acumulan',
     E.hojas.Peligros.filas.filter((f) => f[0] === 'ATS-20260928-111111').length === grande.tareas.reduce((a, t) => a + t.peligros.length, 0));
  const i = E.hojas.Firmas.filas.findIndex((f) => f[0] === 'ATS-20260928-111111' && !String(f[1]).includes('~'));
  E.hojas.Firmas.filas.splice(i, 1);
  E.ctx.auditarIntegridad();
  ok('la auditoría detecta una firma cuya imagen se perdió', /imagen perdida/.test(E.hojas.Auditoria.filas.find((f) => f[1] === 'ATS-20260928-111111')[6]));

  // Gente que llega después a la obra: se SUMA sin reemplazar el ATS.
  const code2 = 'ATS-20260928-222222';
  E.post({ token: TOKEN, opId: 'd1', code: code2, versionBase: 0, ats: armar(2, 1) });
  const ag = E.post({ token: TOKEN, action: 'agregarParticipantes', opId: 'd2', code: code2, participantes: [
    { uid: 'n1', nombres: 'Nuevo', apellidos: 'Uno', cedula: '777', firma: firma(30000, 'n1'), socializado: true },
    { uid: 'n2', nombres: 'Repetido', cedula: '0', firma: firma(30000, 'n2'), socializado: true }] });
  ok('agregar personal suma a la persona nueva y omite la cédula que ya estaba', ag.ok && ag.agregados.length === 1 && ag.omitidos.length === 1);
  const tras = E.get({ token: TOKEN, code: code2 }).ats;
  ok('la persona agregada queda firmada, marcada como tardía y socializada, sin tocar las tareas',
     tras.participantes.length === 2 && tras.participantes[1].tardio && tras.participantes[1].socializado && tras.participantes[1].firma.length > 100 && tras.tareas.length === 2);
  const viejo = E.post({ token: TOKEN, opId: 'd3', code: code2, versionBase: 1, ats: armar(2, 1) });
  ok('quien editaba el ATS completo sobre una versión vieja no borra a los agregados (conflicto)', !viejo.ok && viejo.conflicto && E.get({ token: TOKEN, code: code2 }).ats.participantes.length === 2);

  // Cierre del ATS (como el de los permisos).
  const cierre = { fecha: '2026-09-28', hora: '17:30', motivo: 'Actividad finalizada', observaciones: 'Área entregada limpia',
                   nombre: 'Carlos Ríos', cedula: '123', cargo: 'Líder SST', firma: firma(30000, 'cierre'), pendientes: ['Firma de SSTA'] };
  ok('un ATS recién guardado queda ABIERTO', E.get({ token: TOKEN, code: code2 }).estado === 'ABIERTO');
  ok('no cierra sin firma de quien cierra', !E.post({ token: TOKEN, action: 'cerrarAts', opId: 'k0', code: code2, cierre: Object.assign({}, cierre, { firma: null }) }).ok);
  ok('no cierra con un motivo que no está en la lista', !E.post({ token: TOKEN, action: 'cerrarAts', opId: 'k0b', code: code2, cierre: Object.assign({}, cierre, { motivo: 'porque sí' }) }).ok);
  const cz = E.post({ token: TOKEN, action: 'cerrarAts', opId: 'k1', code: code2, cierre });
  const trasCierre = E.get({ token: TOKEN, code: code2 });
  ok('cierra el ATS: queda CERRADO, con la firma del cierre y los pendientes anotados',
     cz.ok && trasCierre.estado === 'CERRADO' && trasCierre.ats.cierre.firma.length > 100 && trasCierre.ats.cierre.pendientes[0] === 'Firma de SSTA', cz.error);
  ok('el cierre no borra participantes ni tareas', trasCierre.ats.participantes.length === 2 && trasCierre.ats.tareas.length === 2);
  ok('la hoja "ATS" muestra estado, quién cerró y el motivo',
     (() => { const f = E.hojas.ATS.filas.find((x) => x[0] === code2); return f[16] === 'CERRADO' && f[18] === 'Carlos Ríos' && f[19] === 'Actividad finalizada'; })());
  ok('el listado trae el estado de cada ATS', E.get({ token: TOKEN, list: '1' }).rows.find((x) => x.code === code2).estado === 'CERRADO');
  ok('un reenvío del cierre no lo repite', E.post({ token: TOKEN, action: 'cerrarAts', opId: 'k1', code: code2, cierre }).duplicado === true);
  const segundo = E.post({ token: TOKEN, action: 'cerrarAts', opId: 'k2', code: code2, cierre: Object.assign({}, cierre, { nombre: 'Otra persona' }) });
  ok('un segundo cierre no reemplaza al primero', segundo.ok && segundo.yaCerrado && E.get({ token: TOKEN, code: code2 }).ats.cierre.nombre === 'Carlos Ríos');
  const agTarde = E.post({ token: TOKEN, action: 'agregarParticipantes', opId: 'k3', code: code2, participantes: [
    { uid: 'n9', nombres: 'Tarde', cedula: '999', firma: firma(30000, 'n9'), socializado: true }] });
  ok('a un ATS cerrado no se le puede agregar personal', !agTarde.ok && agTarde.cerrado);
  const edTarde = E.post({ token: TOKEN, opId: 'k4', code: code2, versionBase: E.get({ token: TOKEN, code: code2 }).version, ats: armar(1, 1) });
  ok('un ATS cerrado no se puede sobrescribir (ni siquiera sobre la versión vigente)', !edTarde.ok && edTarde.cerrado && E.get({ token: TOKEN, code: code2 }).ats.tareas.length === 2);
  ok('forzar tampoco sobrescribe un ATS cerrado', !E.post({ token: TOKEN, opId: 'k5', code: code2, force: true, ats: armar(1, 1) }).ok);
  ok('la hoja "ATS" tiene el encabezado de las columnas de cierre', E.hojas.ATS.filas[0][16] === 'estado' && E.hojas.ATS.filas[0][19] === 'motivoCierre');
});

grupo('Inspección de EPP', () => {
  const back = leer('backends/backend-epp.gs');
  const front = leer('inspeccion-epp.html');
  // La comparación de listas se hace más abajo, por formato: esta pantalla
  // atiende dos (SSTA-F-006 y SSTA-F-147) y cada uno tiene la suya.

  // La misma pantalla y el mismo backend atienden dos formatos (SSTA-F-006 y
  // SSTA-F-147). Cada uno tiene su lista, y las dos mitades deben coincidir
  // igual que la de EPP: si se separan, el correo pide cosas equivocadas.
  const bloqueFormato = (txt, clave) => {
    const m = new RegExp('\\n  ' + clave + ':\\s*\\{([\\s\\S]*?)\\n  \\}').exec(txt);
    if (!m) return null;
    const els = /elementos:\s*\[([\s\S]*?)\]/.exec(m[1]);
    if (!els) return null;
    let nombres = [...els[1].matchAll(/nombre:\s*'([^']+)'/g)].map(x => x[1]);
    if (!nombres.length) nombres = [...els[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    const cantidades = [...els[1].matchAll(/cantidad:\s*(\d+|null)/g)].map(x => x[1]);
    return { nombres, cantidades };
  };
  ['epp', 'brigadista'].forEach(tipo => {
    const bb = bloqueFormato(back, tipo), ff = bloqueFormato(front, tipo);
    ok(`el formato "${tipo}" está definido en las dos mitades`, !!bb && !!ff);
    if (bb && ff) {
      ok(`  "${tipo}": los elementos coinciden entre navegador y servidor`,
         JSON.stringify(bb.nombres) === JSON.stringify(ff.nombres),
         'Desincronizados, se marcaría una cosa y se pediría otra.');
      ok(`  "${tipo}": las cantidades esperadas coinciden`,
         JSON.stringify(bb.cantidades) === JSON.stringify(ff.cantidades),
         'La cantidad decide si un kit está incompleto: tiene que ser la misma en los dos lados.');
    }
  });

  ok('el formato de brigadistas pide por cantidad además de por estado',
     back.includes('faltantes') && front.includes('faltantesPorCantidad'),
     'Un botiquín con 1 tapabocas de 3 está incompleto aunque lo que haya esté bueno.');

  ok('un campo de unidades vacío no cuenta como faltante',
     front.includes("el.value === ''") && back.includes("!== undefined"),
     'Vacío significa "no lo conté", no "hay cero".');

  ok('el servidor recalcula los MALO en vez de confiar en el navegador',
     /(formato\.elementos|elementos)\.forEach\([\s\S]{0,260}?=== 'M'/.test(back) && /: formato\.elementos;/.test(back),
     'El correo es el efecto real del formato: debe salir de lo que quedó guardado.');

  ok('el servidor también recalcula los incompletos por cantidad',
     /faltantes\.push/.test(back),
     'Un kit incompleto se repone aunque lo que haya esté en buen estado.');

  ok('sin nada por reponer no se envía correo',
     back.includes("Sin elementos por reponer"));

  ok('un fallo de correo no tumba el guardado',
     /try \{[\s\S]{0,300}?MailApp\.sendEmail[\s\S]{0,200}?catch/.test(back),
     'La inspección debe quedar guardada aunque Gmail falle.');

  ok('el código fuente trae solo el correo de ejemplo (el real sale de la configuración del servidor de cada empresa)',
     /const CORREOS_REPOSICION = \['pon-aqui-el-correo@empresa\.com'\];/.test(back),
     'En backends/ no va el correo de nadie: el servidor único lo toma de sus Propiedades.');
});

/* ═══════════════════════════════════════════════════════════
   3. PERMISOS — un permiso cerrado es un documento, no un borrador
   ═══════════════════════════════════════════════════════════ */
grupo('Permisos de trabajo', () => {
  const core = leer('backends/permisos/core.gs');
  const front = leer('permiso-core.js');

  ok('el backend rechaza modificar un permiso ya cerrado',
     core.includes("Este permiso ya fue cerrado"));

  ok('el navegador bloquea la sección de cierre en modo consulta',
     front.includes('lockCloseSections'));

  ok('al consultar un cerrado se restauran sus datos de cierre',
     front.includes('loadCloseDataIntoForm'),
     'Si no, un permiso cerrado se ve vacío, como si nunca se hubiera cerrado.');

  ok('la apertura lleva clave de idempotencia (no duplica por reintento)',
     front.includes('opIdApertura') && core.includes('opIdYaAplicado_'));

  ok('las escrituras quedan en la bitácora',
     core.includes('registrarEvento_'));

  // Regresión: el backend llegó a guardar firstSave y opId DENTRO del permiso.
  // Como el panel de lectura de gases descarga el permiso y lo reenvía, esos
  // campos volvían al servidor, que lo leía como un reintento del guardado
  // inicial: respondía ok y descartaba el cambio. Las lecturas se perdían y en
  // pantalla decía "guardado". En la bitácora quedaba como ABRIR/DUPLICADO.
  ok('el backend NO guarda firstSave ni opId dentro del permiso',
     /k === 'token' \|\| k === 'firstSave' \|\| k === 'opId'/.test(core),
     'Sin esto, cualquier reenvío de un permiso descargado se descarta en silencio.');

  ok('el navegador los descarta al descargar un permiso',
     front.includes('delete data.firstSave') && front.includes('delete data.opId'),
     'Protege a los permisos guardados antes del arreglo del backend.');

  // ── Verificación después de guardar ──
  // Es la defensa contra el modo de fallo que más daño ha hecho aquí: el
  // servidor responde "ok", la pantalla dice "guardado" y el dato no queda.
  // Pasó con las firmas, con las lecturas de gases y con los reenvíos.
  ok('existe la verificación de lo guardado',
     front.includes('function verificarGuardado_'),
     'Sin ella, un guardado que no queda vuelve a pasar desapercibido.');

  ok('la verificación compara las firmas, no solo que el permiso exista',
     front.includes('firmasEjecutantes') && front.includes('firmasResponsables'),
     'Las firmas son lo que se perdía en silencio; comparar solo el código no lo detectaría.');

  ok('el borrador NO se borra si la verificación falla',
     /if \((?:await )?mostrarVerificacion_\(verif, 'apertura'\)\) \{[\s\S]{0,120}?DraftStore\.clear/.test(front),
     'Si lo guardado no coincide, lo diligenciado tiene que seguir disponible.');

  ok('sin señal no se da por fallido (evita falsas alarmas)',
     front.includes("estado: 'sin-verificar'"),
     'Una alarma que salta sin motivo deja de creerse, y entonces no sirve.');

  // El registro de ejecución de Apps Script solo muestra lo que se escribe con
  // console.log: devolver el resultado no le sirve a quien la ejecuta a mano y
  // deja la impresión de que no hizo nada.
  ok('la auditoría escribe su resultado en el registro de ejecución',
     /console\.log\(resumen\)/.test(core),
     'Sin esto, ejecutarla parece no hacer nada.');

  ok('existe la auditoría de lo ya guardado',
     core.includes('function auditarIntegridad'),
     'Es la única forma de saber qué quedó incompleto antes de los arreglos.');

  ok('la auditoría distingue "sin firma" de "firma perdida"',
     core.includes('imagen perdida') || core.includes('firmasRotas') || core.includes('rotas'),
     'No es lo mismo que alguien no firmara a que su firma se perdiera.');

  ok('existe la vigilancia de tokens inválidos',
     core.includes('function revisarIntentosSospechosos'));

  // En Apps Script una función que termina en "_" es privada y NO sale en el
  // desplegable del editor: no se puede ejecutar a mano. Las que están hechas
  // para ejecutarse así no pueden llevarlo.
  ['auditarIntegridad', 'instalarVigilancia', 'revisarIntentosSospechosos', 'verificarIntegridad'].forEach(f => {
    ok(`${f} se puede ejecutar desde el editor (sin guion bajo)`,
       new RegExp('function ' + f + '\\s*\\(').test(core) && !core.includes('function ' + f + '_('),
       'Con "_" al final, Apps Script la oculta del desplegable.');
  });

  ok('hay documento de traspaso',
     existe('TRASPASO.md'),
     'Hoy una sola persona entiende el sistema completo.');

  ok('la lectura de gases también se verifica',
     leer('permiso-espacios-confinados.html').includes('NO quedó guardada'),
     'Fue justo el dato que se estuvo perdiendo.');

  ok('las búsquedas en las hojas son dirigidas, no recorridos completos',
     core.includes('createTextFinder'),
     'Sin esto, guardar se vuelve más lento a medida que crecen las hojas.');
});

/* ═══════════════════════════════════════════════════════════
   4. NÚCLEO COMPARTIDO — los 5 permisos no deben separarse
   ═══════════════════════════════════════════════════════════ */
grupo('Núcleo compartido de los backends', () => {
  const core = leer('backends/permisos/core.gs');
  // Se ignoran los comentarios: ahí los nombres aparecen solo como explicación.
  // Lo que importa es que no queden en el CÓDIGO que se ejecuta.
  const coreCodigo = core.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('core.gs no menciona ningún permiso concreto en su código',
     !/Trabajo en Caliente|Espacios Confinados|Izajes de Cargas|Trabajo Eléctrico|Trabajo en Alturas/.test(coreCodigo),
     'Debe ser idéntico en los cinco proyectos; lo propio va en config-<tipo>.gs.');
  ok('core.gs no define el token (vive en el config de cada proyecto)',
     !/^const API_TOKEN =/m.test(core));

  const tipos = ['caliente', 'alturas', 'confinados', 'izajes', 'electrico'];
  tipos.forEach(t => {
    const f = `backends/permisos/config-${t}.gs`;
    ok(`existe ${f}`, existe(f));
    if (existe(f)) {
      const c = leer(f);
      ok(`  config-${t} define nombre, código y token`,
         /const PERMISO_NOMBRE =/.test(c) && /const PERMISO_CODIGO =/.test(c) && /const API_TOKEN =/.test(c));
    }
  });
});

/* ═══════════════════════════════════════════════════════════
   5. TOKEN — el mismo valor en todos lados o nada funciona
   ═══════════════════════════════════════════════════════════ */
grupo('Token compartido', () => {
  const sitio = /API_TOKEN:\s*'([^']+)'/.exec(leer('config.js'));
  ok('config.js define el token del sitio', !!sitio);
  if (!sitio) return;
  const archivos = ['backends/backend-epp.gs', 'backends/backend-personal-autorizado.gs',
    ...['caliente', 'alturas', 'confinados', 'izajes', 'electrico'].map(t => `backends/permisos/config-${t}.gs`)];
  archivos.forEach(f => {
    if (!existe(f)) return ok(`${f} existe`, false);
    const m = /const API_TOKEN = '([^']+)'/.exec(leer(f));
    ok(`${f} usa el mismo token que el sitio`, m && m[1] === sitio[1],
       m ? 'difiere del de config.js' : 'no define API_TOKEN');
  });
});

grupo('Estilos de las páginas en common.css (v110)', () => {
  const css = leer('common.css'), defs = new Set([...css.matchAll(/\.([a-z0-9-]+)\.\1\{/g)].map((m) => m[1]));
  const usadas = new Set(); fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html')).forEach((f) => { for (const m of leer(f).matchAll(/class="([^"$]*)"/g)) m[1].split(/\s+/).forEach((c) => { if (/^(mt|mb|ml)-|^(btn-menu|btn-compacto|entrada-codigo|entrada-buscar|lista-permisos|lista-historial|texto-suave|nota-suave)$/.test(c)) usadas.add(c); }); });
  ok('las clases que reemplazan estilos en línea están definidas en common.css', defs.size >= 15 && [...usadas].every((c) => defs.has(c)), [...usadas].filter((c) => !defs.has(c)).join(', '));
  ok('el menú de los 5 permisos ya no repite el estilo en línea de sus botones', ['permiso-trabajo-alturas.html', 'permiso-trabajo-caliente.html', 'permiso-espacios-confinados.html', 'permiso-izajes-cargas.html', 'permiso-trabajo-electrico.html'].every((f) => !leer(f).includes('style="margin-top:8px;width:100%;color:var(--steel);border-color:var(--line);"') && leer(f).includes('btn-menu')));
});

grupo('Una sola fuente y herramientas de entrega (v110)', () => {
  ok('existen empaquetar.js y subir-version.js', existe('herramientas/empaquetar.js') && existe('herramientas/subir-version.js'));
  ok('la demo no copia empresas/ ni las herramientas', /const NO_COPIAR = new Set\(\[[^\]]*'empresas'[^\]]*'herramientas'|const NO_COPIAR = new Set\(\[[^\]]*'herramientas'[^\]]*'empresas'/.test(leer('herramientas/armar-demo.js')));
  ok('subir-version cubre las 4 constantes que compara el panel del asesor', ['VERSION_PORTAL_WEB', "'VERSION'", 'VERSION_SGSST', 'VERSION_PORTAL'].every((k) => leer('herramientas/subir-version.js').includes(k)));
  ok('CHANGELOG.md tiene la versión actual', (() => { const v = /const CACHE_NAME = 'ssta-portal-(v\d+)'/.exec(leer('sw.js')); return !!v && existe('CHANGELOG.md') && leer('CHANGELOG.md').includes('## ' + v[1] + ' '); })(),
     'Anota la versión en CHANGELOG.md antes de empaquetar.');
  const { versionActual } = require('../herramientas/subir-version');
  ok('servidor-unico/ está al día con backends/ (se regeneró)', leer('servidor-unico/00-Portal.gs').includes("VERSION_PORTAL = 'v" + versionActual() + "'") && leer('servidor-unico/15-sgsst.gs').includes("VERSION_SGSST = 'v" + versionActual() + "'"),
     'Corre node herramientas/armar-servidor-unico.js');
});

grupo('Cuota diaria de correos de Google (v110)', () => {
  const vm = require('vm');
  const { armar, SALIDA } = require('../herramientas/armar-servidor-unico');
  const { crearEntorno } = require('./simulador-apps-script');
  const rutas = armar().map((f) => path.join(SALIDA, f));
  ok('todos los módulos mandan correo por el envoltorio con cuota', ['10-permisos.gs', '11-personal.gs', '12-ats.gs', '13-asistencia.gs', '14-epp.gs', '15-sgsst.gs'].every((f) => leer('servidor-unico/' + f).includes('MailApp = __entorno.MailApp')));
  const E = crearEntorno(rutas, { sinLibroActivo: true, urlServicio: 'https://script.google.com/macros/s/PRUEBA/exec' });
  E.ctx.instalar();
  const M = vm.runInContext('MailAppConCuota', E.ctx);
  E.ctx.__cuotaCorreo = 3;
  M.sendEmail('a@ejemplo.com', 'SG-SST: 2 vencidos', 'x');
  ok('con poco cupo no gasta los últimos correos en avisos de rutina', E.correos.length === 0);
  M.sendEmail('a@ejemplo.com', '⚠ Accidente de trabajo reportado — R-1', 'x');
  ok('con poco cupo sí manda lo urgente (accidente)', E.correos.length === 1);
  E.ctx.__cuotaCorreo = 0;
  let lanzo = false; try { M.sendEmail({ to: 'a@ejemplo.com', subject: '⚠ Accidente de trabajo reportado — R-2', body: 'x' }); } catch (e) { lanzo = true; }
  ok('sin cupo no lanza error (el aviso diario no se corta a mitad de camino)', !lanzo && E.correos.length === 1);
  const raiz = E.get({}, '');
  ok('la URL del servidor dice el cupo que queda y lo que no se envió hoy', raiz.correos && raiz.correos.quedanHoy === 0 && raiz.correos.sinEnviarHoy === 2 && raiz.correos.asuntosSinEnviar.length === 2);
  ok('Estado muestra los correos sin enviar por cuota', /sinEnviarHoy/.test(leer('estado.html')) && /consultarCorreos/.test(leer('estado.html')));
});

grupo('Autorización de datos personales y de salud, Ley 1581 (v110)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v110-aut.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  // Inducción pública: el servidor conserva la autorización, pero solo verdadero/falso y con SU fecha.
  const d = E.ctx.limpiarInduccionPublica_({ nombre: 'Ana', cedula: '123', autorizacionDatos: { version: 'v1', fecha: '1999-01-01', general: true, sensibles: 'sí', extra: '<script>' } });
  ok('inducción sin usuario: la autorización no se pierde en la limpieza del servidor', d.autorizacionDatos && d.autorizacionDatos.general === true && d.autorizaDatos === 'SÍ');
  ok('inducción sin usuario: solo acepta verdadero/falso (un texto no cuenta como autorización) y la fecha la pone el servidor', d.autorizacionDatos.sensibles === false && d.autorizaSalud === 'NO' && !/1999/.test(d.autorizacionDatos.fecha) && !('extra' in d.autorizacionDatos));
  const sin = E.ctx.limpiarInduccionPublica_({ nombre: 'Ana', cedula: '123' });
  ok('sin autorización queda registrado que NO autorizó', sin.autorizacionDatos === null && sin.autorizaDatos === 'NO' && sin.autorizaSalud === 'NO');
  // Inducción aprobada con autorización → queda en la ficha de la persona (Salud la consulta).
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  P({ action: 'guardar', tipo: 'induccion', id: 'IND-A1', doc: { tipoInduccion: 'Inducción', fecha: hoy, nombre: 'Luz Datos', cedula: '55667788', resultado: 'APROBADA', puntaje: 90, vence: hoy, temas: ['a'], autorizacionDatos: { version: 'v1', general: true, sensibles: true }, autorizaDatos: 'SÍ', autorizaSalud: 'SÍ' }, opId: 'a1' });
  const t = G({ id: 'TRB-55667788' }).doc;
  ok('la autorización firmada con la inducción queda en Personal habilitado', t && t.autorizacionDatos && t.autorizacionDatos.sensibles === true && t.autorizacionDatos.fuente === 'IND-A1');
  const fila = (G({ action: 'list', tipo: 'trabajador' }).rows || []).find((x) => x.id === 'TRB-55667788');
  ok('v148: sin sesión (clave pública) la lista de Personal habilitado NO trae la autorización de datos de salud', fila && !fila.resumen.autorizacion);
  const hoja = E.hojas['Inducciones y reinducciones'];
  ok('la hoja legible de inducciones tiene columnas de autorización', !!hoja && JSON.stringify(hoja).includes('autorizaSalud'));
  // Las pantallas
  const ad = leer('autorizacion-datos.js');
  ok('dos casillas: general obligatoria y datos de salud voluntaria (art. 6: no se condiciona)', /NO estoy obligado\(a\) a autorizar/.test(ad) && /function falta\(prefijo\)[\s\S]{0,200}General/.test(ad) && !/function falta\(prefijo\)[\s\S]{0,200}Sensibles/.test(ad));
  ok('las dos inducciones piden la autorización y la guardan', ['induccion.html', 'induccion-responder.html'].every((f) => /<script src="autorizacion-datos\.js"><\/script>/.test(leer(f)) && /AutorizacionDatos\.html\(/.test(leer(f)) && /AutorizacionDatos\.falta\(/.test(leer(f)) && /autorizacionDatos: AutorizacionDatos\.valor\(/.test(leer(f))));
  ok('la constancia PDF de la inducción lleva la autorización antes de la firma', /AUTORIZACIÓN DE TRATAMIENTO DE DATOS PERSONALES[\s\S]{0,200}UI\.seccion\('FIRMA'/.test(leer('induccion.html')));
  ok('Salud avisa al registrar un examen sin autorización de datos de salud', /function avisoAutorizacionSalud/.test(leer('salud.html')) && /avisoAutorizacionSalud\(el, q\('cedula'\)\)/.test(leer('salud.html')));
  ok('autorizacion-datos.js está en la caché sin señal', leer('sw.js').includes("'./autorizacion-datos.js'"));
  fs.unlinkSync(tmp);
});

grupo('La clave y la sesión no viajan en la dirección (v110)', () => {
  const vm = require('vm');
  const { armar, SALIDA } = require('../herramientas/armar-servidor-unico');
  const { crearEntorno } = require('./simulador-apps-script');
  const E = crearEntorno(armar().map((f) => path.join(SALIDA, f)), { sinLibroActivo: true, urlServicio: 'https://script.google.com/macros/s/PRUEBA/exec' });
  E.ctx.instalar();
  const T = E.propiedades.CLAVE_PORTAL;   // instalado: el servidor pide la clave del portal
  const porGet = E.get({ list: '1', token: T }, 'ats'), porPost = E.post({ __consulta: { list: '1', token: T } }, 'ats');
  ok('servidor: una consulta por POST responde igual que el GET de siempre', porGet.ok === true && JSON.stringify(porGet) === JSON.stringify(porPost));
  ok('servidor: por POST también rechaza una clave equivocada', E.post({ __consulta: { list: '1', token: 'otra' } }, 'ats').ok === false);
  ok('servidor: la raíz anuncia «consultaPost»', (E.get({}, '').capacidades || []).includes('consultaPost'));
  ok('servidor: un guardado normal (sin __consulta) sigue por doPost', !/__consulta/.test(JSON.stringify(E.post({ action: 'nada', token: T }, 'ats'))));
  // Sitio: el envoltorio de fetch, con un servidor nuevo y con uno sin actualizar.
  const cuerpo = leer('common.js'), i = cuerpo.indexOf('/* ── v110: la clave del portal'), j = cuerpo.indexOf('async function fetchWithRetry');
  const prueba = (capacidades) => {
    const vistas = [], almacen = {};
    const c = { EMPRESA: { servidor: 'https://srv.invalid/exec' }, URL, JSON, Date, Promise, String, Array, Object,
      localStorage: { getItem: (k) => almacen[k] || null, setItem: (k, v) => { almacen[k] = v; } } };
    c.window = c; c.fetch = (u, o) => { vistas.push([String(u), (o && o.method) || 'GET', (o && o.body) || '']); return Promise.resolve({ json: () => Promise.resolve(String(u) === 'https://srv.invalid/exec' ? { ok: true, capacidades } : { ok: true }) }); };
    vm.createContext(c); vm.runInContext(cuerpo.slice(i, j), c);
    return c.window.fetch('https://srv.invalid/exec/ats?list=1&token=SECRETA&sesion=S1').then(() => vistas);
  };
  return Promise.all([prueba(['consultaPost']), prueba(undefined)]).then(([nuevo, viejo]) => {
    const q = nuevo.find((x) => x[0].indexOf('/ats') !== -1);
    ok('sitio: con un servidor actualizado la consulta va por POST y la dirección queda sin clave ni sesión', q && q[1] === 'POST' && q[0] === 'https://srv.invalid/exec/ats' && /"token":"SECRETA"/.test(q[2]) && /"sesion":"S1"/.test(q[2]), JSON.stringify(q));
    const g = viejo.find((x) => x[0].indexOf('/ats') !== -1);
    ok('sitio: con un servidor sin actualizar sigue el GET de siempre (nada se rompe)', g && g[1] === 'GET' && /token=SECRETA/.test(g[0]), JSON.stringify(g));
  });
});

/* ═══════════════════════════════════════════════════════════
   6. DESPLIEGUE — los errores que ya nos hicieron perder tiempo
   ═══════════════════════════════════════════════════════════ */
grupo('Herramientas y equipos por permiso', () => {
  // Los cinco permisos preguntan qué herramientas se van a usar, con fichas de
  // lo habitual en ESE trabajo más un campo libre. El campo oculto guarda el
  // texto combinado, así que lo ya registrado en la hoja se sigue leyendo.
  const CAMPO = {
    'permiso-trabajo-caliente.html': 'herramientas',
    'permiso-trabajo-alturas.html': 'herramientas',
    'permiso-trabajo-electrico.html': 'herramientas',
    'permiso-espacios-confinados.html': 'herramientas',
    'permiso-izajes-cargas.html': 'equiposReq'
  };
  Object.entries(CAMPO).forEach(([f, campo]) => {
    const t = leer(f);
    ok(`${f}: tiene el campo de herramientas/equipos`,
       t.includes(`id="${campo}Sel"`) && t.includes(`id="${campo}"`));
    ok(`  se inicializa y se restaura`,
       t.includes(`initSel_${campo}();`) && t.includes(`sel_${campo}.set(vals.${campo}`));
    ok(`  se GUARDA con el permiso`,
       t.includes(`${campo}: document.getElementById('${campo}').value`),
       'Sin esto el campo se llena pero no queda en la hoja.');
    const m = new RegExp("opciones: \\[([^\\]]*)\\]").exec(t.slice(t.indexOf(`function initSel_${campo}`)));
    const n = m ? (m[1].match(/'/g) || []).length / 2 : 0;
    ok(`  ofrece opciones propias del permiso (${n})`, n >= 8,
       'Una lista genérica no ahorra escribir: tiene que tener lo que de verdad se usa en ese trabajo.');
  });
});

grupo('Historial y vencimiento', () => {
  const core = leer('permiso-core.js');
  const back = leer('backends/permisos/core.gs');
  const dash = leer('dashboard.html');

  // ── Historial (bitácora) desde el portal ──
  ok('el permiso puede consultar su bitácora', core.includes('verHistorialDelPermiso'));
  ok('el backend expone el historial', back.includes("action === 'history'"));
  ok('el historial muestra también los intentos rechazados',
     core.includes('hp-marca') && core.includes('ETIQUETA_ACCION'),
     'Un intento rechazado de tocar un permiso cerrado es justo lo que hay que poder demostrar.');
  ['permiso-trabajo-caliente.html','permiso-trabajo-alturas.html','permiso-espacios-confinados.html',
   'permiso-izajes-cargas.html','permiso-trabajo-electrico.html'].forEach(f => {
    ok(`${f} tiene el botón de historial`, leer(f).includes('id="historyBtn"'));
  });

  // ── Vencimiento real ──
  ok('el backend guarda la vigencia en columnas propias',
     back.includes("'hastaFecha', 'hastaHora'"),
     'Leer el JSON de cada fila solo para saber cuándo vence sería caro.');
  ok('el listado devuelve la vigencia', back.includes('hastaFecha: hastaFecha'));
  ok('el dashboard calcula el vencimiento', dash.includes('estadoVigencia'));
  ok('distingue vencido de por vencer',
     dash.includes("'vencido'") && dash.includes("'porvencer'"));
  ok('la fecha se arma en hora local, no UTC',
     /new Date\(a, m-1, d,/.test(dash),
     'Con UTC un permiso que vence a las 6pm aparecía venciendo a la 1pm.');
  ok('ordena por urgencia real',
     /va\.minutos - vb\.minutos/.test(dash));
  ok('los permisos sin vigencia siguen funcionando como antes',
     dash.includes('HORAS_ALERTA'),
     'Los permisos viejos no declaran vigencia: no pueden quedar sin indicador.');
});

grupo('Código QR e impresión', () => {
  ok('existe el generador de QR propio', existe('qr.js'),
     'Un servicio de internet no cargaría en planta sin señal, que es justo donde se usa.');
  if (existe('qr.js')) {
    const qr = leer('qr.js');
    ok('no depende de ningún servicio externo',
       !/https?:\/\//.test(qr.replace(/\/\*[\s\S]*?\*\//g, '')),
       'Debe funcionar sin conexión.');
    ok('usa corrección de errores (se lee aunque se ensucie)',
       qr.includes('TABLA_M') && qr.includes('corregir'));
  }
  ok('qr.js está en la caché del Service Worker', leer('sw.js').includes("'./qr.js'"));

  const core = leer('permiso-core.js');
  ok('el permiso genera su QR', core.includes('mostrarQrDelPermiso'));
  ok('el QR lleva la dirección que abre ESE permiso',
     /\?code=' \+ encodeURIComponent\(permitCode\)/.test(core),
     'Si solo llevara el código, escanearlo no abriría nada.');

  ['permiso-trabajo-caliente.html','permiso-trabajo-alturas.html','permiso-espacios-confinados.html',
   'permiso-izajes-cargas.html','permiso-trabajo-electrico.html'].forEach(f => {
    const t = leer(f);
    ok(`${f} carga qr.js y tiene dónde mostrarlo`,
       t.includes('src="qr.js"') && t.includes('id="qrPermiso"'));
  });

  // Impresión compacta: un permiso llegaba a salir en 7 hojas.
  const css = leer('common.css');
  ok('las firmas se achican al imprimir',
     /canvas\.pad[\s\S]{0,120}?height:72px/.test(css),
     'Cada firma ocupaba 220px y hay hasta diez por permiso.');
  ok('las secciones pueden partirse entre hojas',
     /\.section\{ break-inside:auto/.test(css),
     'Forzarlas enteras dejaba media hoja en blanco y sumaba páginas.');
  ok('los ejecutantes se imprimen en dos columnas',
     /\.exec-cards\{[\s\S]{0,160}?grid-template-columns:1fr 1fr/.test(css));
  ok('el QR sale en la impresión', /@media print\{[\s\S]*?\.qr-permiso\{[\s\S]{0,120}?display:block/.test(css));
});

grupo('ATS: otros, QR centrado y errores del servidor', () => {
  const h = leer('ats.html');
  const gs = leer('backends/backend-ats.gs');
  ok('hay ficha "Otro" en los permisos, con campo para escribirlo',
     /PERMISOS_UI = PERMISOS\.concat\(\[\{ id: 'otro'/.test(h) && h.includes('id="permisoOtro"'));
  ok('"Otro" no entra al catálogo (no dispara la alerta de permisos por peligros)',
     !/id: 'otro'/.test(leer('ats-catalogo.js')));
  ok('el otro permiso se guarda, se recarga y sale en la hoja',
     h.includes("permisoOtro: ''") && (h.match(/\['permisoOtro', 'permisoOtro'\]/g) || []).length === 2 && /OTRO: ' \+/.test(h));
  ok('si marcan "Otro" sin escribirlo, queda como pendiente', h.includes('Escribir cuál es el otro permiso'));
  ok('el backend guarda el texto del otro permiso en la columna', /x === 'otro' \? 'otro: '/.test(gs));
  ok('herramientas tiene campo visible para escribir otras', /Otras herramientas o equipos \(escríbelas\)/.test(h) && /<textarea[^>]*id="herrOtro"/.test(h));
  const col = /col style="width:' \+ \(qr \? (\d+) : 57\) \+ '%"><col style="width:25%">' \+ \(qr \? '<col style="width:(\d+)%">'/.exec(h);
  ok('las columnas del encabezado suman 100% con QR', col && 18 + (+col[1]) + 25 + (+col[2]) === 100);
  ok('la columna del QR cabe la imagen de 115 px (900 px de hoja)', col && 900 * (+col[2]) / 100 - 4 >= 115,
     'Con 12% quedaban ~98 px: el QR se salía por la derecha y no quedaba centrado.');
  ok('el QR no puede desbordar su celda', /\.qr-hoja img\{[^}]*max-width:100%/.test(h));
  ok('"Load failed" se explica en vez de mostrarse crudo',
     h.includes('function motivoFallaSrv') && !/No se pudo consultar: ' \+ esc\(e\.message\)/.test(h));
  ok('el backend funciona aunque el script no esté creado desde la hoja',
     /function libro_\(\)[\s\S]{0,400}?getActiveSpreadsheet\(\)[\s\S]{0,200}?ATS_SHEET_ID/.test(gs) && !/function hoja_[\s\S]{0,80}?getActiveSpreadsheet/.test(gs));
  ok('el backend termina en una llave (sin texto pegado de más al final)', /\}\s*$/.test(gs));
});

grupo('ATS: tocar un ATS lo abre de una para revisarlo', () => {
  const h = leer('ats.html');
  ok('las tarjetas de las listas del menú son revisables', /class="pl-item" data-revisar="' \+ esc\(x\.code\)/.test(h) && /tarjetasRevisables\(lista, 'menu'\)/.test(h));
  ok('las tarjetas de la lista "Abrir" también', /tarjetasRevisables\(cont, 'editor', cerrarPanel\)/.test(h));
  ok('tocar un botón dentro de la tarjeta hace lo del botón, no revisa', /if \(e\.target\.closest\('button'\)\) return;/.test(h));
  ok('revisar no toca el borrador del dispositivo', /function revisarAts[\s\S]{0,500}?const propio = ats; ats = ref; try \{ armarHoja\(\); \} finally \{ ats = propio; \}/.test(h));
  ok('desde la revisión se puede agregar personal o cerrar', h.includes('id="btnRevPersonal"') && h.includes('id="btnRevCerrar"'));
  ok('un ATS cerrado no muestra agregar/cerrar en la revisión', /body\.revision\.rev-cerrado \.rev-acc\{display:none;\}/.test(h));
  ok('el menú se oculta mientras se revisa', /body\.previa #menuAts\{display:none !important;\}/.test(h));
  ok('"Volver" sale de la revisión y deja el botón como estaba', /function salirRevision[\s\S]{0,200}?'← Volver a editar'/.test(h));
});

grupo('ATS: catálogo ampliado y editor más guiado', () => {
  const vm = require('vm');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(leer('ats-catalogo.js') + ';this.D={PELIGROS,TAREAS,HERRAMIENTAS,CONDICIONES,CONTROLES_ADICIONALES,JERARQUIA}', ctx);
  const D = ctx.D, h = leer('ats.html');
  const pid = new Set(D.PELIGROS.map((p) => p.id));
  const herr = D.HERRAMIENTAS.flatMap((g) => g.items);
  ok('hay condición de manipulación manual de cargas', D.CONDICIONES.some((c) => c.id === 'manual' && c.peligros.includes('cargas')));
  ok('al menos 25 condiciones de trabajo', D.CONDICIONES.length >= 25);
  ok('las condiciones apuntan a peligros que existen', D.CONDICIONES.every((c) => c.peligros.every((x) => pid.has(x))));
  ok('toda condición tiene palabras clave para sugerirse', D.CONDICIONES.every((c) => (c.claves || []).length));
  ok('hay condición "Otra" para escribir', /concat\(\[\{ id: 'otra', nombre: 'Otra \(escribir\)' \}\]\)/.test(h) && h.includes('id="edCondOtro"'));
  ok('las condiciones salen en la hoja impresa', /function textoCondiciones/.test(h) && /Condiciones: ' \+ esc\(textoCondiciones\(t\)\)/.test(h));
  ok('todos los peligros tienen controles adicionales', D.PELIGROS.every((p) => (D.CONTROLES_ADICIONALES[p.id] || []).length >= 2));
  ok('los controles adicionales usan niveles de la jerarquía', Object.values(D.CONTROLES_ADICIONALES).flat().every(([t, j]) => t && D.JERARQUIA[j]));
  ok('los adicionales se ofrecen sin marcar', /className = 'ctrl opcional'/.test(h));
  ok('cada nivel de control tiene su campo "Otro"', /className = 'j-otro'/.test(h) && /propio: true/.test(h));
  ok('al menos 140 herramientas en 12 grupos, sin repetidas', herr.length >= 140 && D.HERRAMIENTAS.length >= 12 && new Set(herr).size === herr.length);
  ok('cada grupo de herramientas tiene su "Otra"', /Otra en ' \+ esc\(g\.grupo\.toLowerCase\(\)\)/.test(h) && /herrOtros\[g\.grupo\]/.test(h));
  ok('las herramientas de las tareas tipo existen', D.TAREAS.every((t) => (t.herr || []).every((x) => herr.includes(x))));
  ok('al menos 45 tareas tipo, con peligros y siguientes válidos', D.TAREAS.length >= 45 &&
     D.TAREAS.every((t) => t.peligros.every((x) => pid.has(x)) && (t.siguiente || []).every((x) => D.TAREAS.some((y) => y.id === x))));
  ok('sugerencias en vivo con palabra a medias ("valv")', /w\.startsWith\(e\)/.test(h));
  ok('se pueden ver todas las tareas tipo', h.includes('Ver todas las tareas tipo'));
  ok('"cuarto frío" no se sugiere solo por la tarea tipo', D.CONDICIONES.find((c) => c.id === 'frio').soloTexto === true && /!c\.soloTexto/.test(h));
  ok('la tarea nueva va antes de "Orden y aseo" por defecto', /function posicionPorDefecto/.test(h) && /ats\.tareas\.splice\(pos, 0, t\)/.test(h));
  ok('se escoge dónde va la tarea y hay "+ Tarea después"', h.includes('id="edPos"') && h.includes('data-a="despues"'));
  ok('la tarea agregada después de firmado queda marcada e impresa', /t\.agregadaDespues = new Date\(\)\.toISOString\(\)/.test(h) && h.includes('Tarea agregada después de firmado el ATS'));
  ok('desde la revisión se agrega una tarea olvidada', h.includes('id="btnRevTarea"'));
  ok('un ATS cerrado no admite tareas nuevas', /function abrirEditor[\s\S]{0,120}?ats\.estado === 'CERRADO'/.test(h));
  ok('copiar ATS: sin firmas, sin código y con fecha de hoy', /function copiaSinFirmas[\s\S]*?n\.code = null[\s\S]*?n\.cab\.desde = hoyISO\(\)[\s\S]*?firma: null/.test(h));
  ok('copiar ATS está en la revisión y en "Abrir"', h.includes('id="btnRevCopiar"') && h.includes('id="cpActual"') && h.includes('data-copiar='));
  ok('"_pos" no se guarda en la tarea', /delete t\._pos/.test(h));
});

grupo('Permisos: hoja compacta para imprimir / PDF (como el ATS)', () => {
  const core = leer('permiso-core.js');
  const css = leer('common.css');
  ok('el botón Imprimir arma la hoja compacta antes de imprimir', /\$\('printBtn'\)\.addEventListener\('click', imprimirHoja\)/.test(core) && /async function imprimirHoja[\s\S]{0,200}?prepararImpresion\(\)[\s\S]{0,200}?window\.print\(\)/.test(core));
  ok('espera a que carguen las imágenes (logo, firmas, QR) antes del diálogo', /imagenesListas_\(cont, \d+\)/.test(core));
  ok('imprimir desde el menú del navegador también usa la hoja', /addEventListener\('beforeprint'/.test(core));
  ok('no se vuelve a armar si el botón acaba de armarla (las imágenes no cargarían)', /Date\.now\(\) - hojaArmadaEn_ < \d+\) return/.test(core));
  ok('el logo va como dataURL (sale aunque se imprima desde el menú)', /readAsDataURL/.test(core) && /logoHoja_ \|\| EMPRESA\.logo/.test(core));
  ok('si el armado falla, se imprime el formulario como antes', /catch \(e\) \{[\s\S]{0,200}?classList\.remove\('hp-lista'\)/.test(core));
  ok('carta horizontal solo en los permisos (no cambia otras páginas)', /@page\{size:letter landscape;margin:8mm;\}/.test(core) && !/@page\{size:letter landscape/.test(css));
  ok('al imprimir se ve SOLO la hoja', /body\.hp-lista > \*:not\(#hojaPermiso\)\{display:none !important;\}/.test(css));
  ok('en pantalla la hoja no se ve', /#hojaPermiso\{display:none;\}/.test(css));
  ok('preguntas de a dos por renglón con su respuesta', /hp-qa[\s\S]{0,200}?width:42%[\s\S]{0,60}?width:8%/.test(core));
  ok('campos de a tres por renglón', /if \(fila\.length === 3\) cerrarFila\(\)/.test(core));
  ok('firmas en cuadrícula y ejecutantes en tabla', /hp-firmas/.test(core) && /hp-ejec/.test(core));
  ok('lee las listas, SÍ/NO sueltas, cierre, cálculos, tablas y casillas', ['check-item', 'yn-row', 'close-q', 'calc-row', "el.tagName === 'TABLE'", 'casillas.length >= 2', 'sig-block', 'exec-card'].every((x) => core.includes(x)));
  ok('incluye la bitácora de lecturas de gases, legible en blanco y negro', /c\.contains\('gasLog'\)/.test(core) && core.includes('FUERA DE RANGO'));
  ok('una firma vacía no se imprime como imagen en blanco', /p\.hasInk && !p\.hasInk\(\) \? null/.test(core));
  ok('lo oculto en pantalla no sale en la hoja', /function visibleHoja_[\s\S]{0,80}?getClientRects\(\)\.length > 0/.test(core));
});

grupo('Clave del portal (los datos del personal ya no quedan abiertos con el token público)', () => {
  const vm = require('vm');
  const backs = { 'ATS': 'backends/backend-ats.gs', 'EPP': 'backends/backend-epp.gs', 'Personal': 'backends/backend-personal-autorizado.gs', 'Permisos (core)': 'backends/permisos/core.gs' };
  Object.entries(backs).forEach(([n, f]) => {
    const t = leer(f);
    ok(n + ': en GitHub la clave queda sin escribir (nunca la real)', /const CLAVE_PORTAL = 'ESCRIBE_AQUI_LA_CLAVE_DEL_PORTAL';/.test(t));
    ok(n + ': el rechazo lleva codigoError CLAVE', (t.match(/codigoError: 'CLAVE'/g) || []).length >= 2);
    // Se ejecuta la validación real con distintas configuraciones.
    const probar = (propiedad, constante) => {
      let src = (f.includes('permisos/') ? leer('backends/permisos/config-caliente.gs') + '\n' : '') + t;
      if (constante) src = src.replace("'ESCRIBE_AQUI_LA_CLAVE_DEL_PORTAL'", JSON.stringify(constante));
      const ctx = { PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'CLAVE_PORTAL' ? propiedad : null) }) }, console };
      vm.createContext(ctx);
      vm.runInContext(src + ';this.chk=checkToken_;this.tok=API_TOKEN;', ctx);
      return ctx;
    };
    const sin = probar(null, null);
    ok(n + ': sin clave configurada acepta el token de siempre (nada se cae al actualizar)', sin.chk(sin.tok) === true && sin.chk('otra') === false);
    const conConst = probar(null, 'Obra-Segura-2026!');
    ok(n + ': con clave escrita, el token público deja de servir', conConst.chk(conConst.tok) === false && conConst.chk('Obra-Segura-2026!') === true);
    const conProp = probar('Desde-Propiedades-1', 'Obra-Segura-2026!');
    ok(n + ': la clave en Propiedades del script tiene prioridad', conProp.chk('Desde-Propiedades-1') === true && conProp.chk('Obra-Segura-2026!') === false);
  });
  const c = leer('common.js');
  ok('cada equipo guarda su clave y la usa en todas las llamadas', /const ClavePortal = \{/.test(c) && /PORTAL_CONFIG\.API_TOKEN = this\.get\(\) \|\| PORTAL_CONFIG\._tokenOriginal/.test(c) && /ClavePortal\.aplicar\(\);/.test(c));
  ok('si el servidor rechaza la clave, se pide en cualquier página', /res\.clone\(\)\.json\(\)\.then\(\(j\) => \{ if \(ClavePortal\.esErrorDeClave\(j\)\) ClavePortal\.pedir\(\); \}\)/.test(c));
  ok('la cola reenvía con la clave vigente', /item\.body\.token = PORTAL_CONFIG\.API_TOKEN/.test(c));
  ok('un rechazo de clave NO saca el pendiente de la cola (antes se perdía a los 5 intentos)', /else if \(ClavePortal\.esErrorDeClave\(json\)\) \{[\s\S]{0,450}?ClavePortal\.pedir\(\);\s*\} else \{/.test(c));
  ok('en un formulario, guardar la clave no recarga la página (no se pierde lo escrito)', /hayFormulario = document\.querySelector\('#app, #atsApp, form'\)/.test(c));
  ok('el inicio tiene el botón de la clave', leer('index.html').includes('id="btnClave"'));
});

grupo('ATS vencidos y ATS en el tablero', () => {
  const vm = require('vm');
  const c = leer('common.js');
  const fn = /function atsVence[\s\S]*?\n\}\nfunction atsVencido[\s\S]*?\n\}/.exec(c)[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fn + ';this.v=atsVencido;', ctx);
  ok('un ATS abierto con fecha hasta de ayer está vencido', ctx.v({ estado: 'ABIERTO', fechaHasta: '2020-01-01' }) === true);
  ok('un ATS cerrado nunca sale vencido', ctx.v({ estado: 'CERRADO', fechaHasta: '2020-01-01' }) === false);
  ok('vence al final del día (con la fecha en formato de la hoja)', ctx.v({ estado: 'ABIERTO', fechaHasta: '2999-01-01T05:00:00.000Z' }) === false && ctx.v({ estado: 'ABIERTO', fechaDesde: '2020-05-05' }) === true);
  const d = leer('dashboard.html');
  ok('el tablero consulta los ATS en paralelo con los permisos', /const pAts = cargarAts\(\);/.test(d) && /rAts\.abiertos\.forEach/.test(d));
  ok('si el ATS no responde, el tablero lo dice (no afirma "no hay abiertos")', /out\.fallo = \{ nombre:'ATS'/.test(d));
  ok('tocar un ATS en el tablero lo abre para revisar', /ats\.html\?code=' \+ encodeURIComponent\(it\.code\) \+ '&ver=1'/.test(d) && /qs\.get\('ver'\) === '1'\) revisarAts/.test(leer('ats.html')));
  ok('el inicio muestra ATS abiertos y vencidos', /function contarAts/.test(leer('index.html')) && /abiertos\.filter\(atsVencido\)/.test(leer('index.html')));
  ok('las listas del ATS marcan VENCIDO', /atsVencido\(x\) \? '<span class="etiqueta-estado vencido">VENCIDO/.test(leer('ats.html')));
});

grupo('ATS amarrado con sus permisos', () => {
  const h = leer('ats.html'), core = leer('permiso-core.js');
  ok('el ATS abre cada permiso que requiere con datos y personal', /function abrirPermisoDesdeAts/.test(h) && /personas: ats\.participantes\.map/.test(h) && /'\?desdeAts=1'/.test(h));
  ok('los permisos del ATS se mapean a su backend', /const PERMISO_A_BACKEND = \{ caliente: 'caliente', alturas: 'alturas', confinados: 'confinados', izaje: 'izajes', electrico: 'electrico' \}/.test(h));
  ok('el permiso toma los datos solo si son recientes y de su tipo', /Date\.now\(\) - \(p\.t \|\| 0\) > 30 \* 60000/.test(core) && /p\.tipo && tipo && p\.tipo !== tipo/.test(core));
  ok('el permiso llega directo al formulario nuevo, después de cargar la página', /get\('desdeAts'\) === '1'\) \{[\s\S]{0,300}?setTimeout\(\(\) => \{ startNewPermit\(\);/.test(core));
  ok('el permiso guarda y restaura el ATS relacionado', /if \(atsRelacionado\) base\.atsRelacionado = atsRelacionado;/.test(core) && /atsRelacionado = data\.atsRelacionado \|\| null;/.test(core));
  ok('el permiso le devuelve su código al ATS', /'ssta-ats-permisos:' \+ atsRelacionado/.test(core) && /'ssta-ats-permisos:' \+ a\.code/.test(h));
  ok('la hoja impresa del permiso dice su ATS', /ATS relacionado: <b>' \+ esc\(atsRelacionado\)/.test(core));
  ok('la hoja del ATS lista sus permisos', /Permisos diligenciados: ' \+ permisosAsociadosDe\(ats\)/.test(h));
  ok('al cerrar el ATS avisa si algún permiso sigue abierto', /const r = await permisosAbiertosDe\(a\);[\s\S]{0,200}?siguen ABIERTOS/.test(h));
  ok('copiar un ATS no se lleva los permisos del original', /n\.cab\.permisosAsociados = \[\];/.test(h));
});

grupo('Visual: "Todo cumple", marca común, avisos y barra', () => {
  const core = leer('permiso-core.js'), css = leer('common.css'), c = leer('common.js');
  ok('"Todo C / Todo SÍ" por categoría', /class="cat-todo">✓ Todo ' \+ esc\(states_\[0\]\.label\)/.test(core));
  ok('solo marca las preguntas sin responder', /filter\(\(r\) => !r\.querySelector\('button\[aria-pressed="true"\]'\)\)/.test(core));
  ok('pide confirmar que se verificó en campo', /¿Confirmas que las verificaste en campo\?/.test(core));
  ok('avance por categoría (ej. 5/12)', /av\.textContent = hechas \+ '\/' \+ filas\.length/.test(core));
  ok('"Todo SÍ" por sección en alturas', /function initTodoSiPorSeccion/.test(core) && /initFreeformYN\(\); initTodoSiPorSeccion\(\);/.test(core));
  ok('la hoja impresa no copia los botones nuevos', /n\.tagName !== 'BUTTON'/.test(core) && /querySelector\('\.cat-nombre'\)/.test(core));
  ok('el mismo logo en todas las pantallas', /\.marca\{[^}]*logo-empresa\.svg/.test(css) && /body \.hdr-logo\{[^}]*logo-empresa\.svg/.test(css) &&
     ['index.html', 'ats.html', 'dashboard.html', 'inspeccion-epp.html', 'personal-autorizado.html'].every((f) => leer(f).includes('class="marca')));
  ok('ya no quedan el ⛑ ni el "📋 Permisos" como logo', !leer('index.html').includes('<div class="logo">⛑</div>') && !leer('dashboard.html').includes('<h1>📋 Permisos</h1>'));
  ok('aviso de personal: franja arriba y se puede cerrar', /const AvisoPersonal = \{/.test(c) && /insertBefore\(el, document\.body\.firstChild\)/.test(c) && /class="cerrar"/.test(c) && !/\.aviso-personal\{[^}]*position:fixed/.test(css));
  ok('el ATS y los permisos usan el mismo aviso', /AvisoPersonal\.mostrar\(personalMotivo, cargarPersonal\)/.test(leer('ats.html')) && /AvisoPersonal\.mostrar\(personalMotivo, cargarPersonalCompartido\)/.test(core));
  const vm = require('vm');
  const ob = /const OutboxBadge = \{\s*\/\*[\s\S]*?textoBadge\(items\) \{[\s\S]*?\n  \},/.exec(c)[0] + '\n};';
  const ctx = { PORTAL_CONFIG: { BACKENDS: { ats: { url: 'u-ats' }, caliente: { url: 'u-cal', nombre: 'Trabajo en Caliente' }, epp: { url: 'u-epp' } } } };
  vm.createContext(ctx); vm.runInContext(ob + ';this.O=OutboxBadge;', ctx);
  ok('pendientes: dice "ATS" cuando son ATS', ctx.O.textoBadge([{ url: 'u-ats' }, { url: 'u-ats' }, { url: 'u-ats' }]) === '⏳ 3 ATS pendientes de enviar');
  ok('pendientes: dice "permiso" cuando es un permiso', ctx.O.textoBadge([{ url: 'u-cal' }]) === '⏳ 1 permiso pendiente de enviar');
  ok('pendientes: mezclados dice "registros"', ctx.O.textoBadge([{ url: 'u-cal' }, { url: 'u-epp' }]) === '⏳ 2 registros pendientes de enviar');
  ok('barra de revisión del ATS en dos columnas', /body\.revision \.previa-barra\{display:grid;grid-template-columns:1fr 1fr;/.test(leer('ats.html')));
});

grupo('Anexo de personal: firma del verificador y permisos abiertos', () => {
  const h = leer('personal-autorizado.html');
  ok('la firma del verificador se inicializa al abrir el registro', /setupPad\(padVerif\);/.test(h) && /getElementById\('padVerificador'\)/.test(h));
  ok('la firma del verificador se limpia en cada registro nuevo', /pads\.padVerificador\.clear\(\)/.test(h));
  ok('los permisos abiertos se consultan en paralelo', /Promise\.allSettled\(fuentes\.map/.test(h) && !/for\(const backend of PERMIT_BACKENDS\)/.test(h));
  ok('si un servidor falla se dice cuál (no se esconde)', /No se pudo consultar: /.test(h) && /btnReintentarPicker/.test(h));
  ok('usa la clave vigente, no el token de cuando abrió la página', /encodeURIComponent\(PORTAL_CONFIG\.API_TOKEN\)/.test(h.split('async function consultarAbiertos')[1] || ''));
  ok('también se pueden vincular ATS abiertos', /fuentes\.push\(\{ backend:ats, esAts:true \}\)/.test(h));
  ok('la fecha de hoy es la local (no UTC)', /ahora\.setMinutes\(ahora\.getMinutes\(\) - ahora\.getTimezoneOffset\(\)\)/.test(h) && !/new Date\(\)\.toISOString\(\)\.slice\(0,10\)/.test(h));
  ok('los encabezados del anexo van en columna', /^\.hdr\{display:block;/m.test(h));
  // Filtro de abiertos, ejecutado de verdad
  const vm = require('vm');
  const src = /function conLimite[\s\S]*?\n\}\nasync function consultarAbiertos[\s\S]*?\n\}\n/.exec(h)[0];
  const ctx = { PORTAL_CONFIG: { API_TOKEN: 't' }, ClavePortal: { esErrorDeClave: () => false }, setTimeout,
    fetchWithRetry: async (u) => ({ text: async () => JSON.stringify(u.includes('ats') ? { ok: true, rows: [{ code: 'ATS-1', estado: 'ABIERTO' }, { code: 'ATS-2', estado: 'CERRADO' }] }
      : { ok: true, rows: [{ permitCode: 'TC-1', status: 'ABIERTO' }, { permitCode: 'TC-2', status: 'CERRADO' }, { permitCode: 5, status: 'ABIERTO ' }] }) }) };
  vm.createContext(ctx); vm.runInContext(src + ';this.C=consultarAbiertos;', ctx);
  return Promise.all([ctx.C({ url: 'x', nombre: 'Caliente' }, false), ctx.C({ url: 'ats', nombre: 'ATS' }, true)]).then(([p, a]) => {
    ok('filtra solo los permisos ABIERTOS (y tolera códigos numéricos)', JSON.stringify(p.map(x => x.code)) === '["TC-1","5"]');
    ok('filtra solo los ATS abiertos', JSON.stringify(a.map(x => x.code)) === '["ATS-1"]' && a[0].tipo === 'ATS');
  });
});

grupo('Anexo: exportar a PDF y fechas en el backend', () => {
  const h = leer('personal-autorizado.html');
  ok('la hoja PDF dice a qué permisos y ATS está anexado', /Anexado a: <b>/.test(h) && /Anexado a los siguientes permisos de trabajo y ATS/.test(h));
  ok('la hoja PDF lleva al verificador con su firma', /Verificado y aprobado por<\/td>/.test(h) && /firma-verif">' \+ img\(ver\.firma\)/.test(h));
  ok('la hoja PDF lleva la firma de cada persona', /<td class="firma">'\+img\(t\.firma\)/.test(h));
  ok('se ofrece el PDF al guardar (y sin señal también)', /¿Quieres exportarlo a PDF ahora\?/.test(h) && /btnPdfPendiente/.test(h));
  ok('PDF por día y de todo el historial', /class="btn-pdf"/.test(h) && /btnPdfTodo/.test(h) && /action=registro&obraId=/.test(h));
  ok('varios días: una hoja por día', /page-break-before:always/.test(h));
  const sw = /const CACHE_NAME = 'ssta-portal-(v\d+)'/.exec(leer('sw.js'));
  ok('la versión visible del anexo coincide con la del Service Worker', !!sw && h.includes('Portal SSTA · versión ' + sw[1]));

  const { crearEntorno } = require('./simulador-apps-script');
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-personal-autorizado.gs'), { fechasComoSheets: true });
  const T = 'PON-AQUI-EL-TOKEN', firma = 'data:image/png;base64,' + 'Q'.repeat(300);
  const o = E.post({ action: 'crearObra', nombre: 'PTAR', area: 'C', fechaInicio: '2026-09-28', fechaFin: '2026-10-10', token: T });
  const reg = (n) => ({ fecha: '2026-09-30', trabajadores: [{ nombre: n === 1 ? 'Carlos' : 'Luis', cedula: String(n), cargo: 'S', firma }], verificador: { nombre: 'Ana', cedula: '2', firma: firma.replace('QQQQ', 'VVVV') }, permisos: [{ code: 'TC-1', tipo: 'Trabajo en Caliente' }] });
  E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-09-30', data: reg(1), token: T, opId: 'x1' });
  E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-09-30', data: reg(2), token: T, opId: 'x2' });
  ok('Sheets guarda la fecha como Date (simulado como Google)', E.hojas['Registros'].filas[1][1] instanceof Date);
  ok('volver a guardar el mismo día ACTUALIZA, no duplica la fila', E.hojas['Registros'].filas.length - 1 === 1);
  const hist = E.get({ action: 'historial', obraId: o.obraId, token: T });
  ok('el historial devuelve la fecha como AAAA-MM-DD', hist.registros.length === 1 && hist.registros[0].fecha === '2026-09-30');
  const r = E.get({ action: 'registro', obraId: o.obraId, fecha: '2026-09-30', token: T });
  ok('se puede abrir un día guardado (para el PDF), con la firma del verificador', r.trabajadores.length === 2 && r.verificador.firma === firma.replace('QQQQ', 'VVVV') && r.permisos[0].code === 'TC-1');
  ok('dos guardados del mismo día se SUMAN (no se pisan entre celulares)', r.trabajadores.map((t) => t.nombre).join() === 'Carlos,Luis' && r.opIds.join() === 'x1,x2');
  ok('"copiar último registro" trae el más reciente (con todos)', E.get({ action: 'ultimoRegistro', obraId: o.obraId, token: T }).trabajadores.length === 2);
  const dupA = E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-09-30', data: reg(2), token: T, opId: 'x2' });
  ok('un reintento de la cola no duplica', dupA.duplicado === true);
  E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-09-30', data: { trabajadores: [], verificador: null }, quitar: ['C:1'], token: T, opId: 'x3' });
  const r2 = E.get({ action: 'registro', obraId: o.obraId, fecha: '2026-09-30', token: T });
  ok('quitar a alguien es explícito y conserva al verificador', r2.trabajadores.map((t) => t.nombre).join() === 'Luis' && r2.verificador.nombre === 'Ana');
  const ob = E.get({ action: 'listObras', token: T }).obras[0];
  ok('las fechas de la obra vuelven como AAAA-MM-DD', ob.fechaInicio === '2026-09-28' && ob.fechaFin === '2026-10-10');
  // Firmas reales de celular (~30.000 caracteres cada una). El anexo las llama
  // `firma`; antes solo se sacaban del JSON los campos con "sig" en el nombre y
  // el registro pasaba el límite de 50.000 caracteres por celda.
  const grande = (x) => 'data:image/png;base64,' + x.repeat(30000);
  let rg;
  try { rg = E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-10-01', token: T,
    data: { fecha: '2026-10-01', trabajadores: [{ nombre: 'Carlos', cedula: '1', firma: grande('A') }, { nombre: 'Luis', cedula: '2', firma: grande('B') }], verificador: { nombre: 'Ana', cedula: '3', firma: grande('C') }, permisos: [] } }); }
  catch (e) { rg = { ok: false, error: e.message }; }
  ok('registro con 3 firmas grandes de celular se guarda (no pasa el límite de celda)', rg.ok === true, rg.error);
  const leido = E.get({ action: 'registro', obraId: o.obraId, fecha: '2026-10-01', token: T });
  ok('las firmas van a la hoja Firmas y vuelven completas', leido.trabajadores && leido.trabajadores[1].firma === grande('B') && leido.verificador.firma === grande('C'));
  ok('un error del script vuelve como datos, no como "Load failed"', /return doPostInterno_\(e\);\s*\} catch \(err\) \{/.test(leer('backends/backend-personal-autorizado.gs')));
});

grupo('Asistencia a charlas (SSTA-F-005)', () => {
  const h = leer('asistencia.html'), idx = leer('index.html'), cfg = leer('config.js'), sw = leer('sw.js'), c = leer('common.js');
  ok('la página existe y está en el portal', /href="asistencia\.html"/.test(idx) && /SSTA-F-005/.test(idx));
  ok('config.js tiene el backend de asistencia', /asistencia: \{[\s\S]{0,300}?archivo: 'asistencia\.html'/.test(cfg));
  ok('funciona sin conexión (está en la caché del Service Worker)', sw.includes("'./asistencia.html'"));
  ok('cada día lleva tema, hora, duración y ejecutor', ['inTema', 'inHora', 'inDuracion', 'inEjecutor'].every((id) => h.includes('id="' + id + '"')));
  ok('el tema es obligatorio al guardar', /if \(!tema\)\{ st\.textContent = 'Escribe el tema de la charla\.'/.test(h));
  ok('firma por asistente, con la firma a pantalla completa del portal', /SignaturePad\.createManager/.test(h) && /canvas class="mini-pad" id="padAs\$\{n\}"/.test(h));
  ok('autocompleta con la base de datos de personal del anexo', /action=listPersonal/.test(h) && /autocompletar\(\$\('asNombre' \+ n\), buscarPersona/.test(h));
  ok('sin señal: queda en cola y se ve en la semana', /Outbox\.add\(URL_ASIS, body\)/.test(h) && /async function aplicarPendientes/.test(h));
  ok('borrador en el equipo mientras se diligencia', /LS\.borrador\(semana\.code, diaActual\)/.test(h) && /pagehide/.test(h));
  ok('sin servidor configurado funciona solo en el equipo', /Modo solo en este equipo/.test(h) && /if \(!URL_ASIS\)\{\s*mezclarDia/.test(h));
  ok('la cola no da por enviada una charla solo porque la semana exista', /item\.body\.action === 'guardarDia'\) return !!\(json\.semana && \(json\.semana\.opIds/.test(c));
  ok('el aviso de pendientes dice "charla"', /k === 'asistencia'\) return \{ uno: 'charla'/.test(c));
  ok('PDF: encabezado y códigos del formato (versión de la empresa)', /CONTROL DE ASISTENCIA A CAPACITACION, EVENTOS Y REUNIONES\./.test(h) && /Versión: ' \+ e\(F005\.version\)/.test(h) && /Empresa\.formato\('SSTA-F-005'\)/.test(h) && datosEmpresa().formatos['SSTA-F-005'].codigo === '' && formatoVacio(datosEmpresa(), 'SSTA-F-005'));
  ok('PDF: temario de lunes a domingo con hora, duración y ejecutor', /<b>Hora:<\/b>/.test(h) && /<b>Duración:<\/b>/.test(h) && /<b>Ejecutor:<\/b>/.test(h));
  ok('PDF: firma del trabajador en la columna de cada día', /DIA DE ASISTENCIA \(Firma del trabajador\)/.test(h));
  ok('PDF: solo filas de asistentes (sin renglones en blanco)', !/Math\.max\(16, personas\.length\)/.test(h) && /personas\.forEach\(\(p, i\)=>\{/.test(h));
  ok('PDF: en un día con charla, quien no fue dice "No asistió"', /huboCharla\[d\] \? '<td class="f"><span class="no">No asistió<\/span><\/td>'/.test(h));
  ok('PDF: un día sin charla queda sombreado y el temario dice "No hubo charla"', /<td class="f nd">—<\/td>/.test(h) && /No hubo charla/.test(h));
  ok('PDF en carta horizontal', /size:letter landscape/.test(h));
  ok('hasta dos ejecutores por charla (se guardan juntos: "Ana / Carlos")', /id="inEjecutor2"/.test(h) && /function ejecutoresTexto\(\)/.test(h) && /ejecutor:ejecutoresTexto\(\)/.test(h));
  ok('duración en lista de 5 min a 6 horas, con "Otra…"', /<option>6 horas<\/option>/.test(h) && /<option value="otra">Otra…<\/option>/.test(h));
  ok('fechas y horas no se salen de la tarjeta en iPhone', /input\[type=date\],\.field input\[type=time\]\{-webkit-appearance:none;appearance:none;min-width:0/.test(h));
  const swv = /const CACHE_NAME = 'ssta-portal-(v\d+)'/.exec(sw);
  ok('versión visible = versión del Service Worker', !!swv && h.includes('Portal SSTA · versión ' + swv[1]));

  // La hoja semanal junta a cada persona en UNA fila con sus días
  const vm = require('vm');
  const src = ['const DIAS', 'function clavePersona', 'function personasDeSemana', 'function mezclarDia'].map((k) => {
    const i = h.indexOf(k); const fin = h.indexOf('\n}\n', i); return h.slice(i, k === 'const DIAS' ? h.indexOf('\n', i) : fin + 2);
  }).join('\n');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.P=personasDeSemana;this.M=mezclarDia;', ctx);
  const doc = { dias: {} };
  ctx.M(doc, { dia: 'lun', tema: 'A', asistentes: [{ nombre: 'Carlos', cedula: '1.010', firma: 'data:image/png;x' }, { nombre: 'Luis', cedula: '2', firma: '' }] });
  ctx.M(doc, { dia: 'mie', tema: 'B', asistentes: [{ nombre: 'Carlos Ríos', cedula: '1010', firma: 'data:image/png;y' }] });
  ctx.M(doc, { dia: 'mie', asistentes: [{ nombre: 'Ana', cedula: '3', firma: 'data:image/png;z' }] });
  ctx.M(doc, { dia: 'lun', quitar: ['C:2'] });
  const filas = ctx.P(doc);
  ok('una persona que asistió varios días ocupa una sola fila', filas.length === 2 && Object.keys(filas[0].dias).join() === 'lun,mie');
  ok('dos guardados del mismo día se suman, no se pisan', doc.dias.mie.asistentes.length === 2 && doc.dias.mie.tema === 'B');
  ok('quitar a alguien es explícito', doc.dias.lun.asistentes.length === 1);

  // Backend ejecutado en el simulador, con las fechas como las guarda Google
  const { crearEntorno } = require('./simulador-apps-script');
  let E;
  try { E = crearEntorno(path.join(RAIZ, 'backends/backend-asistencia.gs'), { fechasComoSheets: true }); }
  catch (e) { ok('backend-asistencia.gs se carga en el simulador', false, e.message); return; }
  const T = 'PON-AQUI-EL-TOKEN', F = (x) => 'data:image/png;base64,' + x.repeat(300);
  const a = E.post({ action: 'abrirSemana', fecha: '2026-09-30', lugar: 'Planta Norte', token: T });
  ok('abrir semana: arranca el lunes y termina el domingo', a.ok && a.semana.semanaDel === '2026-09-28' && a.semana.semanaAl === '2026-10-04');
  ok('mismo lugar y semana (escrito distinto) → la MISMA hoja', E.post({ action: 'abrirSemana', fecha: '2026-10-02', lugar: ' planta  NORTE ', token: T }).code === a.code);
  E.post({ action: 'guardarDia', code: a.code, dia: 'mie', tema: 'Arnés', hora: '07:00', duracion: '15 min', ejecutor: 'Ana', asistentes: [{ nombre: 'Carlos', cedula: '1', firma: F('A') }], opId: 'p1', token: T });
  E.post({ action: 'guardarDia', code: a.code, dia: 'mie', asistentes: [{ nombre: 'Luis', cedula: '2', firma: F('B') }], opId: 'p2', token: T });
  const dup = E.post({ action: 'guardarDia', code: a.code, dia: 'mie', asistentes: [{ nombre: 'Luis', cedula: '2', firma: F('B') }], opId: 'p2', token: T });
  const s1 = E.get({ code: a.code, token: T }).semana;
  ok('dos celulares el mismo día: quedan los dos', s1.dias.mie.asistentes.length === 2 && s1.dias.mie.tema === 'Arnés');
  ok('un reintento de la cola no duplica', dup.duplicado === true);
  ok('las firmas vuelven completas', s1.dias.mie.asistentes.every((x) => x.firma.length > 100));
  ok('el opId queda en la semana (para saber si un pendiente ya llegó)', s1.opIds.indexOf('p2') !== -1);
  const off = E.post({ action: 'guardarDia', code: 'ASI-20260928-999999', semanaDel: '2026-10-01', lugar: 'PLANTA NORTE', dia: 'jue', tema: 'Aseo', asistentes: [{ nombre: 'Ana', cedula: '9', firma: F('C') }], opId: 'p3', token: T });
  ok('guardado sin señal con código propio se une a la semana que ya existía', off.code === a.code);
  const nueva = E.post({ action: 'guardarDia', code: 'ASI-20261005-123456', semanaDel: '2026-10-07', lugar: 'Taller', dia: 'mie', tema: 'X', asistentes: [], opId: 'p4', token: T });
  ok('guardado sin señal de una semana nueva la crea', nueva.ok && E.get({ code: 'ASI-20261005-123456', token: T }).semana.semanaDel === '2026-10-05');
  const lista = E.get({ list: 1, token: T }).rows;
  ok('listado con fechas AAAA-MM-DD, más reciente primero', lista.length === 2 && lista[0].semanaDel === '2026-10-05' && lista[1].semanaDel === '2026-09-28');
  ok('hoja "Asistencias": una fila por persona por charla', E.hojas['Asistencias'].filas.length - 1 === 3);
  ok('clave del portal: rechaza sin clave', E.post({ action: 'guardarDia', code: a.code, dia: 'mie', token: 'x' }).codigoError === 'CLAVE');
});

grupo('Pendientes: se ve por qué no se envían', () => {
  const c = leer('common.js'), pa = leer('personal-autorizado.html');
  ok('la cola lee la respuesta como texto (una página no es "sin señal")', /const texto = await res\.text\(\);\s*let json;\s*try \{ json = JSON\.parse\(texto\); \}/.test(c));
  ok('cada pendiente guarda su último error', /async _anotarError\(id, msg(, sesionRechazada)?\)/.test(c) && /it\.ultimoError = msg/.test(c));
  ok('la lista de pendientes muestra el último error', /<b>Último intento:<\/b> ' \+ esc\(it\.ultimoError\)/.test(c));
  ok('botón "Reenviar ahora" que sí reintenta el envío', /id="obxReenviar"/.test(c) && /btnRe\.onclick = async \(\) => \{[\s\S]{0,120}?await Outbox\.flush\(\)/.test(c));
  ok('el anexo dice la causa real al guardar', /mostrarPdfPendiente\(mezclado, err && err\.pagina \? err\.message : ''\)/.test(pa));
  const vm = require('vm');
  const src = /  describirPagina\(html, status\) \{[\s\S]*?\n  \},/.exec(c)[0];
  const ctx = {}; vm.createContext(ctx); vm.runInContext('this.O={' + src + '}', ctx);
  ok('reconoce la pantalla de inicio de sesión de Google', /Acceso: Cualquier usuario/.test(ctx.O.describirPagina('<div>Iniciar sesión</div><div>Correo electrónico</div>', 200)));
  ok('reconoce un error del script y copia su texto', /error dentro del script[\s\S]*línea 97/.test(ctx.O.describirPagina('<html><style>x{}</style><div>TypeError: algo (línea 97, archivo "Código")</div></html>', 200)));
  ok('reconoce una URL sin implementación', /no corresponde a una implementación activa/.test(ctx.O.describirPagina('<p>Lo sentimos, no se ha encontrado el archivo.</p>', 404)));
});

grupo('Estado del sistema, anexo que suma, traer del ATS y PDF por rango', () => {
  const est = leer('estado.html'), idx = leer('index.html'), sw = leer('sw.js'), c = leer('common.js');
  const pa = leer('personal-autorizado.html'), as = leer('asistencia.html');
  ok('página de estado en el portal y en la caché sin señal', /href="estado\.html"/.test(idx) && sw.includes("'./estado.html'"));
  ok('el estado prueba los 9 servidores', ['caliente','alturas','confinados','izajes','electrico','ats','epp','personal','asistencia'].every((k) => new RegExp("k:'" + k + "'").test(est)));
  ok('el estado solo LEE (no envía POST a ningún servidor)', !/method:\s*'POST'/.test(est));
  ok('el estado distingue clave, página de Google, sin respuesta y sin configurar', /Pide la clave/.test(est) && /Responde una página/.test(est) && /No responde/.test(est) && /Sin configurar/.test(est));
  ok('el estado da el enlace de prueba e informe para WhatsApp', /Abrir enlace de prueba/.test(est) && /wa\.me\/\?text=/.test(est));
  ok('el informe no incluye la clave ni el token', !/txt[\s\S]{0,400}API_TOKEN/.test(est.slice(est.indexOf('function actualizarInforme'), est.indexOf("$('btnCopiar')"))));
  ok('anexo: muestra quién ya está registrado ese día', /async function cargarRegistroDelDia/.test(pa) && /Ya registrados este día/.test(pa));
  ok('anexo: el verificador no es obligatorio si el día ya está verificado', /yaVerificado/.test(pa) && /Ya verificado por/.test(pa));
  ok('anexo: guarda con opId y lista de quitar', /quitar, opId, token: PORTAL_CONFIG\.API_TOKEN/.test(pa));
  ok('anexo: "Copiar último registro" ya no borra lo escrito', /const n = agregarPersonas\(reg\.trabajadores/.test(pa) && !/document\.getElementById\('trabajadoresList'\)\.innerHTML = '';\s*trabajadorCounter = 0;\s*\/\/ Se copian/.test(pa));
  ok('la cola reconoce un registro del anexo ya enviado (por opId)', /item\.body\.action === 'guardarRegistro'\) \{[\s\S]{0,400}?j\.opIds\.indexOf\(item\.body\.opId\)/.test(c));
  ok('selector "Traer personal de un ATS" compartido', /const TraerDeAts = \{/.test(c) && /TraerDeAts\.elegir\(\)/.test(pa) && /TraerDeAts\.elegir\(\)/.test(as));
  ok('trae nombres + apellidos, cédula y cargo del ATS', /String\(p\.nombres \|\| ''\) \+ ' ' \+ String\(p\.apellidos \|\| ''\)/.test(c));
  ok('anexo: PDF por rango de fechas (desde/hasta)', /id="rangoDesde"/.test(pa) && /id="rangoHasta"/.test(pa) && /exportarDias\(enRango\(\)/.test(pa));
  ok('asistencia: PDF por rango y lugar opcional', /id="rgDesde"/.test(as) && /id="rgLugar"/.test(as) && /imprimirSemanas\(conCharlas\)/.test(as));
  // recortarSemana deja solo los días del rango
  const vm = require('vm');
  const tomar = (k) => { const i = as.indexOf(k), fin = as.indexOf('\n', i), linea = as.slice(i, fin); return /\}\s*$/.test(linea) ? linea + '\n' : as.slice(i, as.indexOf('\n}\n', i) + 2); };
  const src = "const DIAS = ['lun','mar','mie','jue','vie','sab','dom'];\n" + tomar('function sumarDias') + tomar('function fechaDelDia') + tomar('function recortarSemana');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.R=recortarSemana;', ctx);
  const doc = { semanaDel: '2026-09-21', dias: { mie: { tema: 'A' }, vie: { tema: 'B' }, dom: { tema: 'C' } } };
  ok('rango: solo quedan los días dentro (24/9 al 26/9 → viernes)', Object.keys(ctx.R(doc, '2026-09-24', '2026-09-26').dias).join() === 'vie');
});

grupo('Jornada (ATS → permisos → charla → anexo) y repetir permiso', () => {
  const c = leer('common.js'), core = leer('permiso-core.js'), at = leer('ats.html'), as = leer('asistencia.html'), pa = leer('personal-autorizado.html');
  const vm = require('vm');
  // Jornada ejecutada de verdad, con localStorage simulado
  const mem = {};
  const ls = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  const src = /const Jornada = \{[\s\S]*?\n\};/.exec(c)[0];
  const ctx = { localStorage: ls, sessionStorage: ls, window: { dispatchEvent() {}, addEventListener() {} }, CustomEvent: function () {}, location: { search: '?jornada=1', pathname: '/asistencia.html' }, setTimeout: () => 0, Date, JSON, Object,
    PORTAL_CONFIG: { BACKENDS: { alturas: { nombre: 'Trabajo en Alturas', icono: 'A', archivo: 'permiso-trabajo-alturas.html' }, caliente: { nombre: 'Trabajo en Caliente', icono: 'C', archivo: 'permiso-trabajo-caliente.html' } } } };
  vm.createContext(ctx); vm.runInContext(src + ';this.J=Jornada;', ctx);
  const J = ctx.J;
  J.iniciar({ atsCode: 'ATS-1', trabajo: 'X', personas: [{ nombre: 'Ana', cc: '1' }], permisosReq: ['alturas', 'caliente'] });
  ok('la jornada arma los pasos: ATS, cada permiso requerido, charla y anexo', J.pasos().map((x) => x.id).join() === 'ats,permiso:alturas,permiso:caliente,charla,anexo');
  ok('el siguiente paso es el primer permiso', J.siguiente().id === 'permiso:alturas');
  J.marcarPermiso('alturas', 'TA-9', 'ATS-OTRO');
  ok('un permiso de OTRO ATS no marca el paso', !J.pasos()[1].hecho);
  J.marcarPermiso('alturas', 'TA-9', 'ATS-1'); J.omitir('permiso:caliente');
  ok('al guardar el permiso de este ATS se marca; "No aplica" lo salta', J.pasos()[1].hecho.code === 'TA-9' && J.siguiente().id === 'charla');
  ok('en la página de la charla, "Siguiente" no recarga la página', J.pasoDeEstaPagina() === 'charla');
  J.iniciar({ atsCode: 'ATS-1', trabajo: 'X', personas: [{ nombre: 'Ana', cc: '1' }, { nombre: 'Luis', cc: '2' }], permisosReq: ['alturas', 'caliente'] });
  ok('reiniciar con el mismo ATS (llegó más gente) conserva lo hecho', J.pasos()[1].hecho && J.actual().personas.length === 2);
  J.marcar('charla', { code: 'ASI-1' }); J.marcar('anexo', { code: 'Obra' });
  ok('con todo hecho, la jornada queda completa', J.siguiente() === null);
  ok('el ATS inicia la jornada al guardar y desde el bloque de permisos', /id="btnJornadaTrasGuardar"/.test(at) && /id="btnJornada"/.test(at) && /Jornada\.iniciar\(datosJornadaDesdeAts\(\)\)/.test(at));
  ok('el permiso marca el paso al guardar (y en cola sin señal)', (core.match(/Jornada\.marcarPermiso\(tipoDeEstaPagina_\(\), permitCode, atsRelacionado/g) || []).length === 2);
  ok('la charla de la jornada trae tema, ejecutor y personal del ATS', /'Socialización del ATS ' \+ j\.atsCode/.test(as) && /j\.responsable/.test(as) && /Jornada\.marcar\('charla'/.test(as));
  ok('el anexo de la jornada elige/crea obra, anexa ATS y permisos y marca el paso', /async function iniciarAnexoDeJornada/.test(pa) && /Crear obra con los datos del ATS/.test(pa) && /Jornada\.marcar\('anexo'/.test(pa));
  ok('la barra de la jornada no sale al imprimir', /@media print\{ \.jornada-barra,\.jornada-aviso\{display:none !important;\} \}/.test(leer('common.css')));

  // Repetir permiso: qué se copia y qué no
  const tomar = (k) => { const i = core.indexOf(k); return core.slice(i, core.indexOf('\n  }\n', i) + 4); };
  const srcR = /const NO_COPIAR_ = \[[\s\S]*?\];/.exec(core)[0] + '\n' + tomar('function sinFirmas_') + tomar('function copiaParaRepetir_');
  const ctxR = { cfg: { checklistGroups: [{ stateKey: 'checklist' }, { stateKey: 'equipos' }] }, Date, JSON, Object };
  vm.createContext(ctxR); vm.runInContext(srcR + ';this.C=copiaParaRepetir_;', ctxR);
  const img = 'data:image/png;base64,AAAA';
  const orig = { permitCode: 'TC-1', status: 'CERRADO', descripcion: 'Soldar', sitio: 'Caldera', herramientas: 'Pulidora', desdeFecha: '2026-09-30', hastaFecha: '2026-09-30', desdeHora: '07:00',
    checklist: { a: 'C' }, equipos: { b: 'SI' }, yn: { x: 'SI' }, gases: [{ o2: 20.9 }], observaciones: 'lluvia', atsRelacionado: 'ATS-9', motivoCierre: 'ok', cierre1: { nombre: 'Z', sig: img },
    ejecutantes: [{ nombre: 'Jorge', cc: '8', sig: img }], responsablesSigs: [{ nombre: 'Ana', cc: '1', sig: 'SIGREF:abc' }], epp: { casco: true } };
  const cp = ctxR.C(orig);
  ok('repetir copia descripción, sitio, herramientas, horas, EPP y personal', cp.descripcion === 'Soldar' && cp.sitio === 'Caldera' && cp.herramientas === 'Pulidora' && cp.desdeHora === '07:00' && cp.epp.casco && cp.ejecutantes[0].nombre === 'Jorge' && cp.responsablesSigs[0].nombre === 'Ana');
  ok('repetir NO copia verificaciones, mediciones, observaciones ni cierre', !cp.checklist && !cp.equipos && !cp.yn && !cp.gases && !cp.observaciones && !cp.motivoCierre && !cp.cierre1 && !cp.status && !cp.permitCode && !cp.atsRelacionado);
  ok('repetir NO copia ninguna firma', cp.ejecutantes[0].sig === null && cp.responsablesSigs[0].sig === null && !JSON.stringify(cp).includes('data:image') && !JSON.stringify(cp).includes('SIGREF'));
  ok('repetir deja las fechas en hoy', cp.desdeFecha === cp.hastaFecha && cp.desdeFecha !== '2026-09-30');
  ok('el permiso copiado guarda de cuál viene y lo dice en la hoja impresa', /if \(copiadoDe\) base\.copiadoDe = copiadoDe;/.test(core) && /Datos tomados del permiso/.test(core));
});

grupo('Copiar listas con las respuestas REALES de los servidores', async () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const vm = require('vm');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const firma = 'data:image/png;base64,' + 'Q'.repeat(300);
  const h = leer('personal-autorizado.html');

  // ── Anexo: "Copiar último registro" ──
  ok('el anexo ya no exige "ok" en el registro (el servidor no lo manda)', !/if\(!data\.ok \|\| !data\.trabajadores\)/.test(h) && /function esRegistro_\(d\)\{ return !!d && d\.ok !== false && Array\.isArray\(d\.trabajadores\)/.test(h));
  ok('el botón vuelve a su texto original después de copiar', /btn\.textContent = texto;/.test(h) && !/Copiar lista del último registro/.test(h));
  ok('el anexo usa la clave vigente del portal en todas las consultas', !/encodeURIComponent\(API_TOKEN\)|token: API_TOKEN/.test(h));
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-personal-autorizado.gs'), { fechasComoSheets: true });
  const o = E.post({ action: 'crearObra', nombre: 'PTAR', area: 'C', fechaInicio: '2026-09-28', fechaFin: '2026-10-10', token: T });
  const guardar = (f, nombres) => E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: f, token: T, opId: 'op' + f,
    data: { fecha: f, trabajadores: nombres.map((n, i) => ({ nombre: n, cedula: f.replace(/-/g, '') + i, cargo: 'Ayudante', firma })), verificador: { nombre: 'Ana', cedula: '2', firma }, permisos: [] } });
  guardar('2026-09-28', ['Pedro Gómez']); guardar('2026-09-30', ['Luis Pérez', 'Jorge Díaz']); guardar('2026-10-01', ['Marta Ruiz']);
  const u1 = E.get({ action: 'ultimoRegistro', obraId: o.obraId, antesDe: '2026-10-01', token: T });
  ok('ultimoRegistro&antesDe trae el día ANTERIOR (no el mismo día) y dice su fecha', u1.fecha === '2026-09-30' && u1.trabajadores.length === 2 && u1.ok === undefined);
  ok('ultimoRegistro&antesDe sin días anteriores responde ok:false con antesDe', (r => r.ok === false && r.antesDe === '2026-09-28')(E.get({ action: 'ultimoRegistro', obraId: o.obraId, antesDe: '2026-09-28', token: T })));
  ok('ultimoRegistro sin antesDe sigue igual que antes (compatibilidad)', E.get({ action: 'ultimoRegistro', obraId: o.obraId, token: T }).fecha === '2026-10-01');
  // Se ejecuta la función REAL de la página contra el servidor simulado: el
  // nuevo y el que ya está desplegado (que ignora antesDe y no manda fecha).
  const fuente = h.slice(h.indexOf('function fechaCorta_('), h.indexOf("document.getElementById('btnCopiarAyer')"));
  const probar = async (viejo, fecha) => {
    const ctx = { PORTAL_CONFIG: { API_TOKEN: T }, FIXED_WEBAPP_URL: 'https://x/exec', URL, encodeURIComponent, JSON, Object, Array, String, Number, Error, navigator: { onLine: true },
      fetchWithRetry: async (url) => { const prm = {}; new URL(url).searchParams.forEach((v, k) => { prm[k] = v; });
        if (viejo) delete prm.antesDe;
        let txt = E.ctx.doGet({ parameter: prm })._t;
        if (viejo && prm.action === 'ultimoRegistro') { const j = JSON.parse(txt); delete j.antesDe; if (j.trabajadores) j.fecha = undefined; txt = JSON.stringify(j); }
        return { text: async () => txt, json: async () => JSON.parse(txt) }; } };
    vm.createContext(ctx); vm.runInContext(fuente + ';this.buscar = buscarRegistroAnterior;', ctx);
    return ctx.buscar(o.obraId, fecha);
  };
  for (const viejo of [false, true]) {
    const etq = viejo ? ' (backend ya desplegado)' : ' (backend nuevo)';
    const a = await probar(viejo, '2026-10-01');
    ok('si hoy ya tiene registro, copia el de AYER' + etq, a && a.fecha === '2026-09-30' && a.trabajadores.map((t) => t.nombre).join() === 'Luis Pérez,Jorge Díaz');
    const b = await probar(viejo, '2026-09-29');
    ok('con fecha atrasada copia el anterior a ESA fecha' + etq, b && b.fecha === '2026-09-28');
    ok('el primer día de la obra no hay nada que copiar' + etq, (await probar(viejo, '2026-09-28')) === null);
  }

  // ── Charla: "Lista de otro día" ──
  const a = leer('asistencia.html');
  ok('la charla también ofrece la semana anterior del mismo lugar (el lunes ya hay de dónde copiar)', /async function opcionesParaCopiar\(\)/.test(a) && /\(semana anterior\)/.test(a) && /normLugar\(s\.lugar\) === normLugar\(semana\.lugar\)/.test(a));
  ok('la charla copia también el cargo', /fila\.dataset\.cargo = a\.cargo/.test(a));
  const A = crearEntorno(path.join(RAIZ, 'backends/backend-asistencia.gs'), { fechasComoSheets: true });
  const s1 = A.post({ action: 'abrirSemana', fecha: '2026-09-25', lugar: 'PTAR', opId: 's1', token: T }).semana;
  A.post({ action: 'guardarDia', code: s1.code, semanaDel: s1.semanaDel, lugar: s1.lugar, dia: 'vie', tema: 'Orden y aseo', asistentes: [{ nombre: 'Luis Pérez', cedula: '1010', cargo: 'Soldador', firma }], opId: 'g1', token: T });
  const lista = A.get({ list: '1', token: T });
  ok('el listado de semanas trae código, lunes y lugar (para hallar la semana anterior)', lista.ok && lista.rows.some((r) => r.code === s1.code && r.semanaDel === '2026-09-21' && r.lugar === 'PTAR'));
  const doc = A.get({ code: s1.code, token: T });
  ok('la semana anterior se abre con asistentes, cédula y cargo', doc.ok && doc.semana.dias.vie.asistentes[0].cedula === '1010' && doc.semana.dias.vie.asistentes[0].cargo === 'Soldador');

  // ── Traer del ATS: lo que lee TraerDeAts existe en la respuesta real ──
  const S = crearEntorno(path.join(RAIZ, 'backends/backend-ats.gs'));
  S.post({ token: T, opId: 'x', code: 'ATS-20261001-123456', versionBase: 0, ats: { v: 1, cab: { centro: [], desde: '2026-10-01', area: 'PTAR', trabajo: 'Cambio de bomba' },
    participantes: [{ nombres: 'Luis', apellidos: 'Pérez', cedula: '1010', cargo: 'Soldador', firma }], tareas: [], firmas: { lider: { nombre: 'L', firma: null } } } });
  const la = S.get({ list: '1', token: T });
  ok('Traer del ATS: el listado trae ok, código y estado ABIERTO', la.ok && la.rows.some((r) => r.code === 'ATS-20261001-123456' && r.estado === 'ABIERTO'));
  const ca = S.get({ code: 'ATS-20261001-123456', token: T });
  ok('Traer del ATS: el ATS trae ok y participantes con nombres, apellidos, cédula y cargo', ca.ok && ca.ats.cab.trabajo === 'Cambio de bomba' && ca.ats.participantes[0].nombres === 'Luis' && ca.ats.participantes[0].cedula === '1010');

  // ── Repetir permiso: el servidor devuelve el permiso sin "ok" y la página lo acepta ──
  const pc = leer('permiso-core.js');
  ok('Repetir permiso: solo rechaza ok:false (el permiso llega sin "ok")', /if \(data\.ok === false\) \{/.test(pc) && /async function repetirPermiso_\(code\) \{\s*const data = await fetchFromSheet\(code\);/.test(pc));
});

grupo('Otra empresa: empresa.js y servidor único', () => {
  const emp = leer('empresa.js');
  ok('empresa.js de fábrica es de ejemplo: formatos sin código, versión ni fechas (v126: los crea cada empresa)', (() => { const D = datosEmpresa(); return D.formatos['SSTA-F-117'].codigo === '' && Object.keys(D.formatos).every((k) => formatoVacio(D, k)) && /^TU (EMPRESA|MARCA)$/.test(D.nombreCorto) && D.sinConfigurar === true && JSON.stringify(D.contactoEpp) === '{"nombre":"","cargo":"","whatsapp":""}'; })());
  ok('el motor no tiene una «instalación original»: toda empresa se trata igual', !/\boriginal\b/.test(emp.slice(emp.indexOf('const Empresa = (function'))) && /if \(!raiz\) return;/.test(emp));
  ok('empresa sin logo propio: sale uno con sus iniciales', /if \(!E\.logo\) \{/.test(emp));
  ok('los enlaces externos del inicio no se ocultan por empresa (solo los módulos apagados)', /const fuera = m && m !== 'externo' && !moduloActivo\(m\);/.test(emp));
  const paginas = ['index.html','ats.html','asistencia.html','personal-autorizado.html','inspeccion-epp.html','dashboard.html','estado.html','permiso-trabajo-caliente.html','permiso-trabajo-alturas.html','permiso-espacios-confinados.html','permiso-izajes-cargas.html','permiso-trabajo-electrico.html'];
  ok('todas las páginas cargan empresa.js ANTES de config.js', paginas.every((f) => { const t = leer(f), a = t.indexOf('<script src="empresa.js"></script>'), b = t.indexOf('<script src="empresa-motor.js"></script>'), c = t.indexOf('<script src="config.js"></script>'); return a !== -1 && a < b && b < c; }));   // v162: en el inicio, config.js va al final del cuerpo
  ok('los PDF usan el logo de la empresa', [['asistencia.html', /logoHoja \|\| EMPRESA\.logo/], ['personal-autorizado.html', /logoHoja \|\| EMPRESA\.logo/], ['permiso-core.js', /logoHoja_ \|\| EMPRESA\.logo/], ['ats.html', /esc\(EMPRESA\.logo\)/]].every(([f, re]) => re.test(leer(f))));
  ok('config.js arma las URL del servidor único (<servidor>/<módulo>)', /PORTAL_CONFIG\.BACKENDS\[k\]\.url = base \+ '\/' \+ k;/.test(leer('config.js')));
  ok('el ATS toma los clientes / centros de costo solo de empresa.js', /const CENTROS_COSTO = \(typeof EMPRESA !== 'undefined' && EMPRESA\.centrosCosto\) \? EMPRESA\.centrosCosto\.slice\(\) : \[\];/.test(leer('ats-catalogo.js')));
  ok('empresa.js queda en la caché del Service Worker', /'\.\/empresa\.js'/.test(leer('sw.js')));

  // El servidor único se genera de los MISMOS backends: si alguien cambia un
  // .gs y no vuelve a generar, la prueba lo dice.
  const { armar, MODULOS, SALIDA } = require('../herramientas/armar-servidor-unico');
  const antes = fs.existsSync(SALIDA) ? Object.fromEntries(fs.readdirSync(SALIDA).filter((f) => f.endsWith('.gs')).map((f) => [f, fs.readFileSync(path.join(SALIDA, f), 'utf8')])) : {};
  const archivos = armar();
  ok('servidor-unico/ está al día con backends/ (node herramientas/armar-servidor-unico.js)', archivos.every((f) => antes[f] === fs.readFileSync(path.join(SALIDA, f), 'utf8')) && Object.keys(antes).length === archivos.length);
  const { crearEntorno } = require('./simulador-apps-script');
  const rutas = archivos.slice().reverse().map((f) => path.join(SALIDA, f));   // en cualquier orden, como en el editor
  const E = crearEntorno(rutas, { sinLibroActivo: true, urlServicio: 'https://script.google.com/macros/s/PRUEBA/exec', fechasComoSheets: true });
  ok('responde la lista de módulos en la raíz', JSON.stringify(E.get({}, '').modulos.slice().sort()) === JSON.stringify(MODULOS.slice().sort()));
  ok('antes de instalar no acepta el token de ejemplo', E.get({ list: '1', token: 'PON-AQUI-EL-TOKEN' }, 'ats').ok === false);
  E.ctx.instalar();
  const P = E.propiedades, C = P.CLAVE_PORTAL;
  ok('instalar() crea la clave (fácil de dictar) y el token', /^[A-Z]{4}-[2-9]{4}$/.test(C) && String(P.API_TOKEN).length === 40);
  ok('instalar() programa el aviso diario del SG-SST (y no lo duplica al repetir)', (E.ctx.instalar(), E.activadores.filter((t) => t.getHandlerFunction() === 'sgsst__avisoDiario').length === 1));
  ok('instalar() crea un libro por módulo dentro de la carpeta de la empresa', MODULOS.every((m) => P[m + '.LIBRO']) && E.carpetas.length === 1 && E.carpetas[0].archivos.length === MODULOS.length);
  ok('verConfiguracion() da las líneas para empresa.js', /servidor: 'https:\/\/script\.google\.com\/macros\/s\/PRUEBA\/exec',/.test(E.ctx.verConfiguracion()) && E.ctx.verConfiguracion().includes("apiToken: '" + P.API_TOKEN + "'"));
  ok('con clave configurada, el token público ya no sirve', E.get({ list: '1', token: P.API_TOKEN }, 'ats').ok === false && E.get({ list: '1', token: C }, 'ats').ok === true);
  {
    // v123: con usuarios activos, el token del sitio vale como la clave (los celulares no la piden); la sesión sigue mandando.
    const antes = E.ctx.usuariosActivos_; E.ctx.usuariosActivos_ = () => true;
    const pg = E.get({ action: 'ping', token: P.API_TOKEN }, 'sgsst'), lst = E.get({ list: '1', token: P.API_TOKEN }, 'ats');
    const pp = E.post({ action: 'guardar', tipo: 'reporte', id: 'REP-TOK-1', doc: { clase: 'Condición insegura', descripcion: 'x' }, token: P.API_TOKEN, opId: 'tk1' }, 'sgsst');
    E.ctx.usuariosActivos_ = antes;
    ok('con usuarios activos, el token del sitio vale como la clave (ping y reporte sin usuario)', pg.ok === true && pp.ok === true, JSON.stringify([pg.ok, pp.ok]));
    ok('sin usuarios activos, el token del sitio no reemplaza la clave', E.get({ action: 'ping', token: P.API_TOKEN }, 'sgsst').ok === false);
  }
  // Cada módulo con datos reales, por su ruta.
  const firma = 'data:image/png;base64,' + 'Q'.repeat(300);
  const o = E.post({ action: 'crearObra', nombre: 'PTAR', area: 'C', fechaInicio: '2026-09-28', fechaFin: '2026-10-10', token: C }, 'personal');
  E.post({ action: 'guardarRegistro', obraId: o.obraId, fecha: '2026-09-30', token: C, opId: 'r1', data: { fecha: '2026-09-30', trabajadores: [{ nombre: 'Luis', cedula: '1', cargo: 'S', firma }], verificador: { nombre: 'Ana', cedula: '2', firma }, permisos: [] } }, 'personal');
  ok('anexo: guarda y lee por /personal', E.get({ action: 'registro', obraId: o.obraId, fecha: '2026-09-30', token: C }, 'personal').trabajadores[0].firma === firma);
  const sem = E.post({ action: 'abrirSemana', fecha: '2026-09-30', lugar: 'PTAR', opId: 'a1', token: C }, 'asistencia').semana;
  E.post({ action: 'guardarDia', code: sem.code, semanaDel: sem.semanaDel, lugar: 'PTAR', dia: 'mie', tema: 'Orden y aseo', asistentes: [{ nombre: 'Luis', cedula: '1', firma }], opId: 'g1', token: C }, 'asistencia');
  ok('charlas: guarda y lee por /asistencia', E.get({ code: sem.code, token: C }, 'asistencia').semana.dias.mie.asistentes.length === 1);
  E.post({ token: C, opId: 'x', code: 'ATS-20261001-123456', versionBase: 0, ats: { v: 1, cab: { centro: [], desde: '2026-10-01', area: 'PTAR', trabajo: 'Bomba' }, participantes: [{ nombres: 'Luis', apellidos: 'P', cedula: '1', firma }], tareas: [], firmas: { lider: { nombre: 'L', firma: null } } } }, 'ats');
  ok('ATS: guarda y lee por /ats', E.get({ code: 'ATS-20261001-123456', token: C }, 'ats').ats.participantes[0].firma === firma);
  const per = E.post({ permitCode: 'TC-20261001-111111', status: 'ABIERTO', descripcion: 'Soldadura', sitio: 'PTAR', ejecutantes: [{ nombre: 'Luis', cc: '1', sig: firma }], opId: 'p1', firstSave: true, token: C }, 'caliente');
  ok('permisos: guarda y lee por /caliente', per.ok && E.get({ code: 'TC-20261001-111111', token: C }, 'caliente').ejecutantes[0].sig === firma);
  ok('un permiso de caliente NO aparece en alturas (libros separados)', E.get({ list: '1', token: C }, 'alturas').rows.length === 0 && E.get({ list: '1', token: C }, 'caliente').rows.length === 1);
  ok('EPP responde por /epp', E.get({ list: '1', token: C }, 'epp').ok === true);
  const hojasDe = (m) => Object.keys(E.libros[P[m + '.LIBRO']].hojas);
  ok('cada módulo escribe solo en su libro (las hojas "Firmas" no se mezclan)', hojasDe('personal').includes('Registros') && !hojasDe('ats').includes('Registros') && hojasDe('ats').includes('Firmas') && hojasDe('personal').includes('Firmas'));
  const errMod = JSON.parse(E.ctx.doPost({ postData: { contents: 'esto no es json' }, pathInfo: 'caliente' })._t);
  ok('un error dentro de un módulo responde JSON marcado TEMPORAL (el celular lo conserva en la cola)', /Error en el servidor \(caliente\)/.test(errMod.error || '') && errMod.codigoError === 'TEMPORAL');
  ok('la cola de envíos no descarta los errores temporales (no cuentan como intento)', /_esTemporal\(json\) \{/.test(leer('common.js')) && /\} else if \(Outbox\._esTemporal\(json\)\) \{[\s\S]{0,400}_anotarError/.test(leer('common.js')));
  // Un libro que existe pero no abre NUNCA se reemplaza por uno vacío.
  const E2 = crearEntorno(rutas, { sinLibroActivo: true });
  Object.assign(E2.propiedades, { API_TOKEN: 'T', 'ats.LIBRO': 'libro-que-no-abre' });
  const r2 = E2.get({ list: '1', token: 'T' }, 'ats');
  ok('si el libro de un módulo no abre, responde TEMPORAL y no crea otro (no se "pierden" los datos)', r2.ok === false && r2.codigoError === 'TEMPORAL' && Object.keys(E2.libros).length === 1 && E2.propiedades['ats.LIBRO'] === 'libro-que-no-abre');
  ok('el servidor de cada empresa no lleva datos reales (correos, celulares, tokens) y el armador lo vigila', archivos.every((f) => !/@(?!(empresa\.com|ejemplo\.com|[\w-]+\.invalid)\b)[\w-]+\.[a-z]{2,}/i.test(fs.readFileSync(path.join(SALIDA, f), 'utf8').replace(/[\w.+-]+@(empresa\.com|ejemplo\.com|[\w.-]+\.invalid)/gi, ''))) && /function datoReal\(s\)/.test(leer('herramientas/armar-servidor-unico.js')));
  ok('el WhatsApp de EPP sale de empresa.js (pantalla) y de 00-Portal (correo)', /EMPRESA\.contactoEpp/.test(leer('inspeccion-epp.html')) && !/'57\d{10}'/.test(leer('inspeccion-epp.html')) && /const WHATSAPP_APROBACION = contactoEpp_\(\)\.whatsapp/.test(fs.readFileSync(path.join(SALIDA, '14-epp.gs'), 'utf8')));   // v119: con respaldo en lo que guardó instalar()
  ok('el resumen diario de EPP desde el activador usa la fecha de hoy (antes recibía el evento como fecha)', /typeof fechaTexto === 'string' && fechaTexto\) \? fechaTexto :/.test(leer('backends/backend-epp.gs')));
  E.ctx.epp__instalarResumenDiario();
  ok('los activadores de un módulo llaman a su función con prefijo (epp__…), que existe', E.activadores.length === 4 && E.activadores.some((t) => t.getHandlerFunction() === 'sgsst__avisoSemanal') && E.activadores.some((t) => t.getHandlerFunction() === 'sgsst__respaldoSemanal') && E.activadores.some((t) => t.getHandlerFunction() === 'epp__enviarResumenDiario' || /^epp__/.test(t.getHandlerFunction())) && E.activadores.every((t) => typeof E.ctx[t.getHandlerFunction()] === 'function'));
});

grupo('Empresa demo (funciona sin Google)', () => {
  const vm = require('vm');
  const d = leer('demo/demo.js');
  ok('la demo solo se carga si EMPRESA.demo es true', /if \(EMPRESA\.demo && typeof document !== 'undefined'/.test(leer('empresa.js')) && datosEmpresa().demo === false);
  ok('la empresa demo es ficticia y está marcada como demo', /nombre: 'Montajes Andinos S\.A\.S\. \(empresa demo\)'/.test(leer('demo/empresa-demo.js')) && /demo: true/.test(leer('demo/empresa-demo.js')));
  ok('la demo responde "ok" solo después de guardar en el equipo (no se pierde el último registro)', /await guardar\(m\.estado\);\s*\} else/.test(d) && !/guardarPronto/.test(d));
  ok('la demo no pide clave y no sale a internet (atiende solo su URL)', /delete m\.estado\.propiedades\.CLAVE_PORTAL/.test(d) && /if \(url\.indexOf\(BASE\) !== 0\) return fetchOriginal/.test(d));
  ok('las fechas de la semilla se corren por semanas completas (las charlas siguen en su día)', /Math\.floor\(\(hoy - new Date\(ref \+ 'T12:00:00'\)\) \/ 86400000 \/ 7\) \* 7/.test(d));
  ok('el botón DEMO no sale en los PDF', /@media print\{#botonDemo\{display:none !important;\}/.test(d));
  // El simulador del navegador corre el MISMO servidor único con los datos de ejemplo.
  const win = {}; const ctx = { window: win, console, JSON, Date, Math, String, Number, Array, Object, RegExp, Error, parseInt, isNaN, encodeURIComponent, TextEncoder, TextDecoder, btoa, atob };   // TextEncoder/btoa: firmar sesiones (v112)
  vm.createContext(ctx); vm.runInContext(leer('demo/apps-script-navegador.js'), ctx);
  const N = win.AppsScriptNavegador;
  const fuentes = fs.readdirSync(path.join(RAIZ, 'servidor-unico')).filter((f) => f.endsWith('.gs')).sort().map((f) => leer('servidor-unico/' + f));
  ok('demo/demo.js carga todos los archivos del servidor único', fs.readdirSync(path.join(RAIZ, 'servidor-unico')).filter((f) => f.endsWith('.gs')).every((f) => d.includes("'" + f + "'")));
  ok('existe la semilla de la demo', existe('demo/semilla.json'));
  if (!existe('demo/semilla.json')) return;
  const sem = JSON.parse(leer('demo/semilla.json'));
  const m = N.cargar(fuentes, N.revivir(JSON.stringify(sem.estado)));
  m.estado.propiedades.API_TOKEN = 'token-demo'; delete m.estado.propiedades.CLAVE_PORTAL;
  const g0 = (ruta, q) => JSON.parse(m.servidor.doGet({ parameter: Object.assign({ token: 'token-demo' }, q), pathInfo: ruta })._t);
  // v112: la demo tiene usuarios, así que lo de la obra pide sesión también en el servidor.
  const sinSes = g0('ats', { list: '1' }), sinSesPost = JSON.parse(m.servidor.doPost({ postData: { contents: JSON.stringify({ action: 'crearObra', nombre: 'Intruso', token: 'token-demo' }) }, pathInfo: 'personal' })._t);
  ok('servidor: sin sesión, la obra (ATS, anexo…) responde SESION y no guarda (v112)', sinSes.codigoError === 'SESION' && !sinSes.rows && sinSesPost.codigoError === 'SESION');
  ok('servidor: los preoperacionales y los reportes (módulo sgsst) siguen sin sesión (v112)', g0('sgsst', { action: 'ping' }).ok === true);
  const salU = g0('sgsst', { action: 'sal', usuario: 'jorge.obra' });
  const prueba = require('crypto').pbkdf2Sync('Demo2026', Buffer.from(salU.salt, 'hex'), Number(salU.iter), 32, 'sha256').toString('base64');
  const ent = JSON.parse(m.servidor.doPost({ postData: { contents: JSON.stringify({ action: 'entrar', usuario: 'jorge.obra', prueba, token: 'token-demo', opId: 'e1' }) }, pathInfo: 'sgsst' })._t);
  ok('servidor: el supervisor entra con su usuario y recibe su sesión', ent.ok && !!ent.sesion, JSON.stringify(ent).slice(0, 200));
  const SES = ent.sesion;
  ok('servidor: una sesión falsa tampoco abre la obra (v112)', g0('caliente', { list: '1', sesion: 'v1.falsa.firma' }).codigoError === 'SESION');
  const g = (ruta, q) => g0(ruta, Object.assign({ sesion: SES }, q));
  const ats = g('ats', { list: '1' }).rows;
  ok('semilla: 2 ATS (uno cerrado)', ats.length === 2 && ats.some((r) => r.estado === 'CERRADO') && ats.some((r) => r.estado === 'ABIERTO'));
  ok('semilla: permiso en caliente y en alturas abiertos', g('caliente', { list: '1' }).rows.length === 1 && g('alturas', { list: '1' }).rows.length === 1);
  const obra = g('personal', { action: 'listObras' }).obras[0];
  ok('semilla: anexo con 4 días y verificador', obra && g('personal', { action: 'historial', obraId: obra.obraId }).registros.length === 4);
  ok('semilla: charlas de 2 semanas con firmas', g('asistencia', { list: '1' }).rows.length === 2);
  ok('semilla: base de personal para autocompletar', (g('personal', { action: 'listPersonal' }).personal || []).length >= 10);
  ok('semilla: sin datos reales de ninguna empresa', !rastroReal(JSON.stringify(sem.estado)));
  const post = JSON.parse(m.servidor.doPost({ postData: { contents: JSON.stringify({ action: 'crearObra', nombre: 'Nueva', area: 'X', fechaInicio: '2026-10-05', fechaFin: '2026-10-06', token: 'token-demo', sesion: SES }) }, pathInfo: 'personal' })._t);
  ok('en la demo se puede registrar (y queda en el estado que se guarda)', post.ok && g('personal', { action: 'listObras' }).obras.length === 2 && N.serializar(m.estado).includes('"Nueva"'));
});

grupo('Gestión del SG-SST: servidor (ejecutado en simulador)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const foto = 'data:image/jpeg;base64,' + 'F'.repeat(120000);
  ok('rechaza la clave equivocada', P({ token: 'x', action: 'guardar', tipo: 'reporte', id: 'REP-1', doc: {} }).ok === false);
  const r1 = P({ action: 'parche', tipo: 'trabajador', id: 'TRB-1010', campos: { nombre: 'Luis', cedula: '1010', requisitos: { alturas: { fecha: '2025-01-10', vence: '2026-07-10', soporte: foto } } }, opId: 'h1' });
  P({ action: 'parche', tipo: 'trabajador', id: 'TRB-1010', campos: { requisitos: { medico: { fecha: '2026-03-01', vence: '2027-03-01', apto: 'Apto' } } }, opId: 'h2' });
  const doc = E.get({ action: 'doc', id: 'TRB-1010', token: T }).doc;
  ok('parche suma requisitos sin borrar los anteriores (dos celulares no se pisan)', r1.ok && doc.requisitos.alturas.vence === '2026-07-10' && doc.requisitos.medico.apto === 'Apto');
  ok('una foto de 120.000 caracteres se guarda troceada y vuelve completa', doc.requisitos.alturas.soporte === foto && Math.max(...Object.values(E.hojas).flatMap((h) => h.filas.flat()).map((v) => typeof v === 'string' ? v.length : 0)) <= 50000);
  ok('un reenvío con el mismo opId no aplica dos veces', P({ action: 'parche', tipo: 'trabajador', id: 'TRB-1010', campos: { nombre: 'Otro' }, opId: 'h2' }).duplicado === true && E.get({ action: 'doc', id: 'TRB-1010', token: T }).doc.nombre === 'Luis');
  ok('la lista trae el resumen sin la foto (liviana para el celular)', (() => { const r = E.get({ action: 'list', tipo: 'trabajador', token: T }).rows[0]; return r.resumen.req.alturas.soporte === true && !JSON.stringify(r).includes('data:image'); })());
  ok('la hoja "Requisitos" queda legible (una fila por requisito)', E.hojas['Requisitos'].filas.length === 3);
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-20261002-AAA', doc: { clase: 'Accidente de trabajo', fecha: '2026-10-02', descripcion: 'Golpe', lesionado: { nombre: 'Luis' } }, opId: 'r1' });
  ok('guardar sobre una versión vieja NO sobrescribe (conflicto)', P({ action: 'guardar', tipo: 'reporte', id: 'REP-20261002-AAA', versionBase: 0, doc: {}, opId: 'r2' }).conflicto === true);
  ok('no se puede reusar un id de otro tipo', P({ action: 'guardar', tipo: 'accion', id: 'REP-20261002-AAA', doc: {}, opId: 'r3' }).ok === false);
  ok('la cola sin señal puede preguntar si un envío ya se aplicó', E.get({ action: 'opAplicado', opId: 'r1', token: T }).aplicado === true && E.get({ action: 'opAplicado', opId: 'zz', token: T }).aplicado === false);
  P({ action: 'parche', tipo: 'mes', id: 'MES-2026-10', campos: { mes: '2026-10', trabajadores: 80 }, opId: 'm1' });
  P({ action: 'borrar', id: 'MES-2026-10', opId: 'm2' });
  ok('borrar saca el registro de la lista y de su hoja (queda en la bitácora)', !E.get({ action: 'list', tipo: 'mes', token: T }).rows.length && E.hojas['Indicadores'].filas.length === 1 && E.hojas['Eventos'].filas.some((f) => f[2] === 'BORRAR'));
  ok('festivos de Colombia 2026 exactos (Emiliani y Semana Santa)', JSON.stringify(Object.keys(E.ctx.festivosCO_(2026)).sort()) === JSON.stringify(['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25']));
  ok('plazo FURAT: 2 días hábiles (salta fin de semana y el festivo del 12 de octubre)', E.ctx.sumarHabiles_('2026-10-02', 2) === '2026-10-06' && E.ctx.sumarHabiles_('2026-10-09', 2) === '2026-10-14');
  // El celular y el servidor cuentan igual los días hábiles.
  const vm = require('vm'); const c = { console }; vm.createContext(c); vm.runInContext(leer('common.js').slice(leer('common.js').indexOf('const Festivos = {')).split('\n/* ================= SERVIDOR SG-SST')[0] + ';this.F=Festivos;', c);
  ok('los festivos de common.js son los mismos del servidor (2025–2035)', [2025, 2027, 2028, 2030, 2033, 2035].every((a) => JSON.stringify(Object.keys(c.F.de(a)).sort()) === JSON.stringify(Object.keys(E.ctx.festivosCO_(a)).sort())));
  // Avisos: correo de accidente y resumen diario
  const E2 = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  E2.ctx.CORREOS_AVISO && E2.ctx.CORREOS_AVISO.length;  // (const del archivo)
  ok('avisoDiario sin correos configurados no falla', E2.ctx.avisoDiario() === 'Sin correos configurados.');
  ok('un servidor que viene de antes programa solo el resumen del lunes con su primer aviso diario', (E2.ctx.avisoDiario(), E2.ctx.avisoDiario(), E2.activadores.filter((t) => t.getHandlerFunction() === 'avisoSemanal').length === 1));
  ok('instalarAvisosDiarios deja el aviso diario y el resumen del lunes (sin duplicar al repetir)', (E2.ctx.instalarAvisosDiarios(), E2.ctx.instalarAvisosDiarios(), E2.activadores.length === 2 && E2.activadores.map((t) => t.getHandlerFunction()).sort().join() === 'avisoDiario,avisoSemanal'));
  // Correcciones de la revisión independiente
  const E3 = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P3 = (o) => E3.post(Object.assign({ token: T }, o));
  const D3 = (id) => E3.get({ action: 'doc', id, token: T }).doc;
  const tmp = P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: { estado: 'CERRADA' }, opId: 'x0' });
  ok('un cambio que llega antes que el registro espera (TEMPORAL) y no lo crea a medias', tmp.ok === false && tmp.codigoError === 'TEMPORAL' && !D3('ACC-X'));
  P3({ action: 'guardar', tipo: 'accion', id: 'ACC-X', doc: { accion: 'Arreglar', estado: 'ABIERTA', seguimiento: [] }, opId: 'x1' });
  P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: {}, agregar: { seguimiento: [{ uid: 'a', texto: 'Celular 1' }] }, opId: 'x2' });
  P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: {}, agregar: { seguimiento: [{ uid: 'b', texto: 'Celular 2' }] }, opId: 'x3' });
  P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: {}, agregar: { seguimiento: [{ uid: 'a', texto: 'Celular 1' }] }, opId: 'x4' });
  const ax = D3('ACC-X');
  ok('dos celulares anotan avances y ninguno borra el del otro (sin duplicar)', ax.seguimiento.length === 2 && ax.estado === 'EN PROCESO');
  P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: { estado: 'CERRADA' }, opId: 'x5' });
  P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: {}, agregar: { seguimiento: [{ uid: 'c', texto: 'tarde' }] }, opId: 'x6' });
  ok('un avance que llega tarde no reabre una acción cerrada', D3('ACC-X').estado === 'CERRADA' && D3('ACC-X').seguimiento.length === 3);
  P3({ action: 'borrar', id: 'ACC-X', opId: 'x7' });
  ok('un cambio en cola no revive un registro borrado', P3({ action: 'parche', tipo: 'accion', id: 'ACC-X', campos: { accion: 'otra' }, opId: 'x8' }).borrado === true);
  P3({ action: 'guardar', tipo: 'reporte', id: 'REP-F', doc: { clase: 'Condición insegura', fecha: '2026-10-02', descripcion: '=HYPERLINK("http://x")', reporta: { nombre: '+57 300' } }, opId: 'f1' });
  ok('textos que empiezan por = + - @ no se vuelven fórmulas en la hoja', E3.formulas.length === 0 && E3.hojas['Reportes'].filas.flat().some((v) => String(v).indexOf('=HYPERLINK') === 0));
  const fotoG = 'data:image/jpeg;base64,' + 'G'.repeat(44977) + '+/=+'.repeat(12000);
  P3({ action: 'guardar', tipo: 'inspeccion', id: 'INS-F', doc: { fecha: '2026-10-02', fotos: [fotoG, fotoG] }, opId: 'f2' });
  ok('las fotos sueltas dentro de una lista también se trocean y vuelven completas', (() => { const d = D3('INS-F'); return d.fotos.length === 2 && d.fotos[1] === fotoG && E3.formulas.length === 0 && Math.max(...Object.values(E3.hojas).flatMap((h) => h.filas.flat()).map((v) => typeof v === 'string' ? v.length : 0)) <= 50000; })());
});

grupo('Gestión del SG-SST: pantallas e integración', () => {
  const vm = require('vm');
  const paginas = ['habilitacion.html', 'reportes.html', 'plan-accion.html', 'inspecciones.html', 'indicadores.html'];
  ok('las 5 pantallas cargan empresa, config, common y sgsst-ui (en ese orden)', paginas.every((f) => /<script src="empresa\.js"><\/script>\s*<script src="empresa-motor\.js"><\/script>\s*<script src="config\.js"><\/script>\s*<script src="common\.js"><\/script>\s*(?:<script src="iconos-emoji\.js"><\/script>\s*)?(?:<script src="valida\.js"><\/script>\s*)?<script src="sgsst-ui\.js"><\/script>/.test(leer(f))));
  ok('las 5 pantallas están en el inicio, en la caché sin señal y en empresa.js (módulos)', paginas.every((f) => leer('index.html').includes('href="' + f + '"') && leer('sw.js').includes("'./" + f + "'")) && modulosEncendidos(['reportes', 'habilitacion', 'plan', 'inspecciones', 'indicadores']));
  ok('sin servidor SG-SST cada pantalla lo dice (no falla callada)', paginas.every((f) => /UI\.avisoServidor\(\$\('avisoSrv'\)\)/.test(leer(f))));
  ok('config.js tiene el servidor sgsst y Estado lo prueba', /sgsst: \{/.test(leer('config.js')) && /k:'sgsst', q:'action=list'/.test(leer('estado.html')));
  ok('la cola sin señal reconoce los envíos SG-SST (opAplicado) y los nombra', /action=opAplicado&opId=/.test(leer('common.js')) && /if \(k === 'sgsst'\)/.test(leer('common.js')));
  // Habilitación: la lógica con los requisitos de empresa.js
  const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, Date, JSON, Math, String, Object, Array, RegExp, Number };
  vm.createContext(ctx);
  const com = leer('common.js');
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'empresa.js'), 'utf8').split('/* ════')[0].replace('const EMPRESA', 'this.EMPRESA') + ';var EMPRESA=this.EMPRESA;' +
    com.slice(com.indexOf('const Festivos = {')) .replace(/window\.addEventListener\([\s\S]*?\n\}\);\n/g, '') + ';this.H=Habilitacion;this.F=Festivos;', ctx);
  const H = ctx.H, hoy = ctx.F.hoy(), mas = (n) => ctx.F.sumarDias(hoy, n);
  H._mapa = { '1010': { nombre: 'Luis', activo: true, req: { seguridad_social: { fecha: mas(-5), vence: mas(25) }, induccion: { fecha: mas(-30), vence: mas(300) }, medico: { fecha: mas(-30), vence: mas(5), apto: 'Apto con restricciones', restricciones: 'No levantar más de 20 kg' }, alturas: { fecha: mas(-600), vence: mas(-3) } } },
              '2020': { nombre: 'Ana', activo: false, req: {} } };
  const a = H.revisar('1010', ['alturas']), g = H.revisar('1.010', []);
  ok('alturas vencido → no habilitado para el permiso de alturas', a.estado === 'mal' && a.problemas.some((x) => /Curso de trabajo en alturas vencido/.test(x)) && a.problemas.some((x) => /Apto con restricciones/.test(x)));   // v148: en alto riesgo la restricción también frena
  ok('el mismo trabajador sí está habilitado para un trabajo general (aviso de vencimiento y de restricciones, sin mostrar el dato de salud)', g.estado === 'pronto' && g.avisos.some((x) => /vence/.test(x)) && g.avisos.some((x) => x === 'Apto con restricciones (ver su ficha)') && !JSON.stringify([g.avisos, g.problemas]).includes('No levantar'));
  H._mapa['3030'] = { nombre: 'Juan', activo: true, req: { seguridad_social: { fecha: mas(-5), vence: mas(25) }, induccion: { fecha: mas(-30), vence: mas(300) }, medico: { fecha: mas(-3), vence: mas(360), apto: 'Aplazado' } } };
  ok('concepto médico "Aplazado" o "No apto" no habilita', H.revisar('3030', []).estado === 'mal');
  ok('quien no está en la base o está inactivo no queda habilitado', H.revisar('999', []).estado === 'sin-registro' && H.revisar('2020', []).estado === 'mal');
  ok('alturas: vigencia de 18 meses (Res. 4272 de 2021)', JSON.stringify(datosEmpresa().habilitacion.requisitos.alturas) === '{"nombre":"Curso de trabajo en alturas","meses":18}' && /alturas: \{ nombre: 'Curso de trabajo en alturas', meses: 18 \}/.test(com));
  H._mapa = {};
  ok('si el módulo no se usa todavía (base vacía) no estorba a nadie', H.revisar('1010', ['alturas']).estado === 'sin-datos');
  const pc = leer('permiso-core.js');
  ok('permisos: aviso debajo de cada cédula y confirmación al guardar (queda anotado en el permiso)', /Habilitacion\.vigilar\(document, '#execBody \[id\^="execCC"\]'/.test(pc) && /if \(habAdvertencias\.length\) data\.habilitacion = habAdvertencias;/.test(pc) && /const habNuevos = await revisarHabilitacion_\(filasNuevas, true\);/.test(pc) && /que: agregar \? 'No se puede agregar a estas personas al permiso' : 'No se puede abrir el permiso'/.test(pc) && /Habilitacion\.exigir\(filas, contextoHab_\(\)/.test(pc));
  ok('ATS y anexo muestran el aviso; el anexo pide confirmar según sus permisos', /Habilitacion\.vigilar\(document, 'input\[data-f="cedula"\]', contextoHabAts\)/.test(leer('ats.html')) && /await Habilitacion\.exigir\(ats\.participantes/.test(leer('ats.html')) && /await Habilitacion\.exigir\(trabajadores\.map/.test(leer('personal-autorizado.html')));
  const ui = leer('sgsst-ui.js'); const srcFn = new Function(/function src\(s\) \{[^\n]*\}/.exec(ui)[0] + ';return src;')();
  ok('las fotos solo se pintan si son imágenes de verdad (no código escondido)', srcFn('data:image/png;base64,iVBORw0KGgo=') !== '' && srcFn('x" onerror="alert(1)') === '' && srcFn('data:image/svg+xml;base64,PHN2Zz4=') === '' && srcFn('javascript:alert(1)') === '');
  ok('ninguna pantalla pinta fotos sin pasar por el filtro', ['plan-accion.html', 'reportes.html', 'inspecciones.html', 'habilitacion.html', 'indicadores.html'].every((f) => leer(f).split('\n').filter((l) => l.includes('<img src="\' +')).every((l) => l.includes('UI.src'))));
  ok('la cola sin señal respeta el orden de cada registro (si uno falla, espera el siguiente del mismo)', /const trabados = new Set\(\);/.test(leer('common.js')) && /if \(cd && trabados\.has\(cd\)\) continue;/.test(leer('common.js')));
  ok('EPP en mal estado → acción del plan de acción', /origen: 'Inspección de EPP'/.test(leer('inspeccion-epp.html')));
  ok('inspección no conforme → una acción por hallazgo, con su foto', /for \(const x of nc\) await UI\.guardarAccion\(/.test(leer('inspecciones.html')));
  ok('investigación: equipo firmado, causas y plazo de 15 días (Res. 1401)', /Para terminar falta: /.test(leer('reportes.html')) && /Festivos\.sumarDias\(res\.fecha, 15\)/.test(leer('reportes.html')) && /Festivos\.sumarHabiles\(res\.fecha, 2\)/.test(leer('reportes.html')));
  ok('indicadores con las fórmulas del art. 30 de la Res. 0312', /atMes\.length \/ trab \* 100/.test(leer('indicadores.html')) && /\(diasInc \+ diasCarg\) \/ trab \* 100/.test(leer('indicadores.html')) && /\* 100000/.test(leer('indicadores.html')) && /diasAusencia\) \|\| 0\) \/ Number\(dm\.diasProgramados\) \* 100/.test(leer('indicadores.html')));
  const pl = {}; vm.createContext(pl); vm.runInContext(leer('inspecciones-plantillas.js') + ';this.P=PLANTILLAS_INSPECCION;this.F=FRECUENCIAS;', pl);
  ok('plantillas de inspección válidas (id único, preguntas, frecuencia conocida)', pl.P.length >= 10 && new Set(pl.P.map((x) => x.id)).size === pl.P.length && pl.P.every((x) => x.items.length >= 5 && pl.F[x.frecuencia]));
  if (existe('demo/semilla.json')) {
    const sem = leer('demo/semilla.json');
    ok('la demo trae datos de los 5 módulos de gestión', ['TRB-', 'REP-', 'ACC-', 'EQP-', 'INS-', 'MES-'].every((k) => sem.includes('"' + k)));
    ok('la demo trae plan anual, matriz de peligros, emergencias, salud, documental y revisión por la dirección', ['PAT-', 'PEL-DEMO', 'RVM-', 'SUS-', 'MED-', 'EME-', 'SIM-', 'CAR-', 'EXA-', 'AUS-', 'PSI-', 'POL-', 'LEG-BASE', 'DOC-DEMO', 'CAM-', 'PRV-', 'REV-', 'REN-'].every((k) => sem.includes(k)));
    ok('la demo trae comités, actas, quejas y auditorías; las quejas solo cifradas', ['CMT-COPASST', 'CMT-CONVIVENCIA', 'REU-', 'QJA-', 'AUD-'].every((k) => sem.includes(k)) && !/Trabajadora A|Persona D|Burlas y apodos/.test(sem));
  }
});

grupo('Comités y auditorías: servidor (ejecutado en simulador)', async () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-con-correo.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const G = (q) => E.get(Object.assign({ token: T }, q));
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const mas = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Comité
  const cop = { comite: 'copasst', trabajadores: 80, periodos: [{ uid: 'p1', inicio: mas(-700), fin: mas(20), miembros: [{ nombre: 'Ana Ruiz', cedula: '52000111', cargo: 'Gerente', representa: 'Empleador', calidad: 'Principal', rol: 'Presidente' }, { nombre: 'Luis Pérez', cedula: '1010', cargo: 'Soldador', representa: 'Trabajadores', calidad: 'Principal', rol: 'Secretario' }] }] };
  const r1 = P({ action: 'guardar', tipo: 'comite', id: 'CMT-COPASST', doc: cop, opId: 'c1' });
  const fila = G({ action: 'list', tipo: 'comite' }).rows[0];
  ok('comité: se guarda y la lista trae el periodo vigente con sus integrantes', r1.ok && fila.estado === 'VIGENTE' && fila.resumen.periodo.miembros.length === 2 && fila.vence === mas(20));
  ok('comité: la hoja "Comités" tiene una fila por integrante', E.hojas['Comités'].filas.length === 3);
  P({ action: 'parche', tipo: 'comite', id: 'CMT-COPASST', campos: {}, agregar: { capacitaciones: [{ uid: 'k1', fecha: mas(-10), tema: 'Investigación de accidentes', horas: '4' }] }, opId: 'c2' });
  ok('comité: las capacitaciones se agregan sin pisar la conformación', G({ action: 'doc', id: 'CMT-COPASST' }).doc.periodos.length === 1 && G({ action: 'list', tipo: 'comite' }).rows[0].resumen.capacitaciones === 1);
  // Clave del comité de convivencia
  const cfg = { kid: 'aaa111', salt: 'c2FsdA==', iter: 310000, verif: { iv: 'aXY=', data: 'ZGF0YQ==' } };
  ok('convivencia: crear la clave exige la prueba de la clave', P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', campos: { comite: 'convivencia', cifrado: { actual: cfg, anterior: null } }, opId: 'v0' }).ok === false);
  P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', pruebaNueva: 'prueba-1', campos: { comite: 'convivencia', cifrado: { actual: cfg, anterior: null } }, opId: 'v1' });
  ok('convivencia: el servidor guarda solo el hash de la prueba', !JSON.stringify(E.hojas).includes('prueba-1') && /^[0-9a-f]{64}$/.test(G({ action: 'doc', id: 'CMT-CONVIVENCIA' }).doc.cifrado.actual.pruebaHash));
  const otra = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', campos: { cifrado: { actual: Object.assign({}, cfg, { kid: 'bbb222' }) } }, opId: 'v2' });
  ok('convivencia: un segundo celular no puede reemplazar la clave del comité por accidente', otra.ok === false && otra.claveExiste === true);
  const sinPrueba = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', cambioClave: true, kidBase: 'aaa111', prueba: 'mala', pruebaNueva: 'prueba-2', campos: { cifrado: { actual: Object.assign({}, cfg, { kid: 'bbb222' }), anterior: cfg } }, opId: 'v2b' });
  const atrasado = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', cambioClave: true, kidBase: 'zzz999', prueba: 'prueba-1', pruebaNueva: 'prueba-2', campos: { cifrado: { actual: Object.assign({}, cfg, { kid: 'bbb222' }), anterior: cfg } }, opId: 'v2c' });
  ok('convivencia: cambiar la clave exige la clave actual y que nadie la haya cambiado antes', sinPrueba.ok === false && /incorrecta/.test(sinPrueba.error) && atrasado.ok === false && atrasado.conflicto === true);
  const cambio = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', cambioClave: true, kidBase: 'aaa111', prueba: 'prueba-1', pruebaNueva: 'prueba-2', campos: { cifrado: { actual: Object.assign({}, cfg, { kid: 'bbb222' }), anterior: cfg } }, opId: 'v3' });
  const otraVez = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', cambioClave: true, kidBase: 'bbb222', prueba: 'prueba-2', pruebaNueva: 'prueba-3', campos: { cifrado: { actual: Object.assign({}, cfg, { kid: 'ccc333' }), anterior: cfg } }, opId: 'v3b' });
  ok('convivencia: no se puede empezar otro cambio de clave sin terminar el anterior', otraVez.ok === false && /sin terminar/.test(otraVez.error));
  const cv = G({ action: 'list', tipo: 'comite' }).rows.find((x) => x.id === 'CMT-CONVIVENCIA');
  ok('convivencia: con "cambiar clave" sí se cambia, y la lista trae la clave nueva y la anterior (para terminar el cambio)', cambio.ok && cv.resumen.cifrado.actual.kid === 'bbb222' && cv.resumen.cifrado.anterior.kid === 'aaa111');
  // Quejas
  const q = { codigo: 'CCL-2026-001', fechaRecepcion: hoy, etapa: 'Recibida', estado: 'ABIERTA', inicioEtapa: hoy, venceEtapa: mas(5), venceTotal: mas(65), fechaCierre: '', cifrado: { v: 1, kid: 'bbb222', iv: 'aXY=', data: 'Y2lmcmFkbw==' } };
  ok('queja: sin la prueba de la clave del comité no se acepta', P({ action: 'guardar', tipo: 'queja', id: 'QJA-0', doc: q, opId: 'q0' }).ok === false && P({ action: 'guardar', tipo: 'queja', id: 'QJA-0', doc: q, prueba: 'prueba-1', opId: 'q0b' }).ok === false);
  ok('queja: cifrada con una clave que ya no es la actual, se rechaza', /cambió/.test(P({ action: 'guardar', tipo: 'queja', id: 'QJA-0', doc: Object.assign({}, q, { cifrado: Object.assign({}, q.cifrado, { kid: 'aaa111' }) }), prueba: 'prueba-2', opId: 'q0c' }).error));
  ok('queja: llega cifrada y se guarda', P({ action: 'guardar', tipo: 'queja', id: 'QJA-1', doc: q, prueba: 'prueba-2', opId: 'q1' }).ok === true);
  const cerrarCambio = P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', prueba: 'prueba-2', campos: { cifrado: { anterior: null } }, opId: 'v4' });
  ok('convivencia: cerrar el cambio de clave (sin quejas con la anterior) con la prueba de la actual', cerrarCambio.ok === true && G({ action: 'doc', id: 'CMT-CONVIVENCIA' }).doc.cifrado.anterior === null);
  ok('borrar: la conformación de un comité no se borra; una queja solo con la prueba', P({ action: 'borrar', id: 'CMT-COPASST', opId: 'b1' }).ok === false && P({ action: 'borrar', id: 'QJA-1', opId: 'b2' }).ok === false);
  ok('queja: datos raros fuera del cifrado (objetos, llaves extra) se rechazan', P({ action: 'guardar', tipo: 'queja', id: 'QJA-4', doc: Object.assign({}, q, { etapa: { quejoso: 'X' } }), prueba: 'prueba-2', opId: 'q5' }).ok === false &&
    P({ action: 'guardar', tipo: 'queja', id: 'QJA-5', doc: Object.assign({}, q, { cifrado: Object.assign({ nombre: 'X' }, q.cifrado) }), prueba: 'prueba-2', opId: 'q6' }).ok === false);
  ok('versionBase 0 sobre un registro que ya existe = conflicto (no borra el historial)', P({ action: 'guardar', tipo: 'comite', id: 'CMT-COPASST', doc: { comite: 'copasst', periodos: [] }, versionBase: 0, opId: 'c9' }).conflicto === true);
  const mal1 = P({ action: 'guardar', tipo: 'queja', id: 'QJA-2', doc: Object.assign({}, q, { hechos: 'El jefe me grita' }), prueba: 'prueba-2', opId: 'q2' });
  const mal2 = P({ action: 'guardar', tipo: 'queja', id: 'QJA-3', doc: Object.assign({}, q, { cifrado: null }), prueba: 'prueba-2', opId: 'q3' });
  const mal3 = P({ action: 'parche', tipo: 'queja', id: 'QJA-1', campos: { etapa: 'X' }, prueba: 'prueba-2', opId: 'q4' });
  ok('queja: el servidor RECHAZA cualquier dato sin cifrar (nombres, hechos) y los parches', mal1.ok === false && /no permitido/.test(mal1.error) && mal2.ok === false && mal3.ok === false);
  const todo = JSON.stringify(E.hojas);
  ok('queja: en ninguna hoja queda texto de una queja rechazada', todo.indexOf('me grita') === -1);
  ok('v148: sin usuarios creados (clave pública) la lista de quejas de convivencia no se entrega', G({ action: 'list', tipo: 'queja' }).rows.length === 0);
  const filaQ = Object.values(E.hojas).flatMap((h) => h.filas || []).find((r) => r[0] === 'QJA-1' && r[1] === 'queja');
  const fq = filaQ ? { resumen: JSON.parse(filaQ[8] || '{}'), vence: E.ctx.fechaISO_ ? E.ctx.fechaISO_(filaQ[7]) : filaQ[7] } : null;   // v148: lo que el comité recibe en la lista
  ok('queja: la lista solo trae código, fechas, etapa, la clave usada y las fechas del Decreto 1040 (sin contenido)', !!fq && JSON.stringify(Object.keys(fq.resumen).sort()) === JSON.stringify(['codigo', 'estado', 'etapa', 'fechaCierre', 'fechaRecepcion', 'inicioEtapa', 'kid', 'medAdopcion', 'medSexual', 'medSolicitud', 'protegeHasta', 'venceEtapa', 'venceTotal']) && fq.vence === mas(5));
  ok('queja: hoja "Quejas convivencia (sin datos)" sin contenido cifrado', E.hojas['Quejas convivencia (sin datos)'].filas.length === 2 && !JSON.stringify(E.hojas['Quejas convivencia (sin datos)'].filas).includes('Y2lmcmFkbw'));
  // v128: buzón reservado del comité (quejas y acoso sexual que llegan cifrados con la llave pública)
  const bzDoc = { clase: 'convivencia', codigo: 'CCL-B-2610-AB12', cifrado: { v: 1, kp: 'a1b2c3d4e5f6a7b8', ek: 'ZWs=', iv: 'aXY=', data: 'c2VjcmV0bw==' } };
  ok('buzón: sin activar por el comité, no recibe nada', /no ha activado/.test(P({ action: 'guardar', tipo: 'buzon', id: 'BZN-CCL-B-1', doc: bzDoc, opId: 'bz0' }).error || ''));
  const bzLlaves = { publica: { kty: 'RSA', n: 'bW9kdWxv', e: 'AQAB' }, privada: { v: 1, kid: 'bbb222', iv: 'aXY=', data: 'cHJpdg==' }, correo: 'comite@empresa.com' };
  ok('buzón: activarlo exige la clave del comité', P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', campos: { buzon: bzLlaves }, opId: 'bz1' }).ok === false &&
    P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', prueba: 'prueba-2', campos: { buzon: bzLlaves }, opId: 'bz2' }).ok === true);
  const bzPub = G({ action: 'buzonPublico' });
  ok('buzón: la página pública recibe la llave pública y el correo, nunca la privada', bzPub.ok && bzPub.activo && bzPub.publica.n === 'bW9kdWxv' && bzPub.correo === 'comite@empresa.com' && !JSON.stringify(bzPub).includes('cHJpdg'));
  ok('buzón: llega cifrado y se guarda; datos sin cifrar o clase rara se rechazan', P({ action: 'guardar', tipo: 'buzon', id: 'BZN-CCL-B-2', doc: bzDoc, opId: 'bz3' }).ok === true &&
    P({ action: 'guardar', tipo: 'buzon', id: 'BZN-CCL-B-3', doc: Object.assign({}, bzDoc, { cifrado: Object.assign({ hechos: 'x' }, bzDoc.cifrado) }), opId: 'bz4' }).ok === false &&
    P({ action: 'guardar', tipo: 'buzon', id: 'BZN-CCL-B-4', doc: Object.assign({}, bzDoc, { clase: 'otra' }), opId: 'bz5' }).ok === false &&
    P({ action: 'guardar', tipo: 'buzon', id: 'BZN-CCL-B-2', doc: bzDoc, opId: 'bz6' }).ok === false);
  ok('buzón: un parche del comité que no trae el buzón no lo borra', P({ action: 'parche', tipo: 'comite', id: 'CMT-CONVIVENCIA', campos: { trabajadores: 30 }, opId: 'bz7' }).ok && !!G({ action: 'doc', id: 'CMT-CONVIVENCIA' }).doc.buzon.publica);
  ok('buzón: archivarlo solo con la clave del comité', P({ action: 'borrar', id: 'BZN-CCL-B-2', opId: 'bz8' }).ok === false && P({ action: 'borrar', id: 'BZN-CCL-B-2', prueba: 'prueba-2', opId: 'bz9' }).ok === true);
  // Actas
  P({ action: 'guardar', tipo: 'reunion', id: 'REU-1', doc: { comite: 'copasst', tipoReunion: 'Ordinaria', numero: '01-2026', fecha: hoy, lugar: 'Sala', asistentes: [{ nombre: 'Ana', asistio: 'Sí' }, { nombre: 'Luis', asistio: 'No' }], quorum: false, ordenDia: ['Quórum', 'Accidentes'], compromisos: ['ACC-1'] }, opId: 'r1' });
  const fr = G({ action: 'list', tipo: 'reunion' }).rows[0];
  ok('acta: la lista trae asistentes, quórum y compromisos', fr.resumen.asistentes === 1 && fr.resumen.convocados === 2 && fr.resumen.quorum === false && fr.resumen.compromisos === 1 && E.hojas['Actas de comités'].filas.length === 2);
  // Auditoría
  P({ action: 'guardar', tipo: 'auditoria', id: 'AUD-1', doc: { plantilla: 'DEC1072', tipoAuditoria: 'Auditoría interna Dec. 1072', titulo: 'Interna 2026', fechaPlan: mas(-3), estado: 'PROGRAMADA', auditor: { nombre: 'Marta' }, items: [{ id: 'A1', r: '' }], hallazgos: [] }, opId: 'a1' });
  P({ action: 'guardar', tipo: 'auditoria', id: 'AUD-2', doc: { plantilla: 'ISO45001', tipoAuditoria: 'ISO 45001', titulo: 'ISO', fechaPlan: mas(-40), fechaEjecucion: mas(-38), estado: 'CERRADA', auditor: { nombre: 'Marta' }, items: [{ id: '4.1', r: 'NC' }, { id: '4.2', r: 'C' }], hallazgos: [{ uid: 'h1', tipo: 'ncMayor' }, { uid: 'h2', tipo: 'ncMenor' }, { uid: 'h3', tipo: 'obs' }], puntaje: null }, opId: 'a2' });
  const fa = G({ action: 'list', tipo: 'auditoria' }).rows.find((x) => x.id === 'AUD-2');
  ok('auditoría: la lista cuenta hallazgos por tipo y el avance', fa.resumen.hallazgos.ncMayor === 1 && fa.resumen.hallazgos.ncMenor === 1 && fa.resumen.hallazgos.obs === 1 && fa.resumen.respondidos === 2 && E.hojas['Auditorías'].filas.length === 3);
  // Aviso diario
  E.correos.length = 0;
  E.ctx.avisoDiario();
  const cuerpo = E.correos.length ? String(E.correos[0][2]) : '';
  ok('aviso diario: periodo del comité por vencer, plazos de la queja (solo el código) y auditoría atrasada', /COPASST: el periodo vence/.test(cuerpo) && /Convivencia CCL-2026-001/.test(cuerpo) && /Auditoría: Interna 2026/.test(cuerpo) && cuerpo.indexOf('Y2lmcmFkbw') === -1);
  fs.unlinkSync(tmp);
});

grupo('Comités y auditorías: cifrado, reglas y pantallas', async () => {
  const vm = require('vm');
  const c = { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, console, Uint8Array, String, JSON, Array, Error };
  vm.createContext(c); vm.runInContext(leer('cifrado.js') + ';this.K=Cifrado;', c);
  const K = c.K;
  const n = await K.crear('Convivencia2026');
  const blob = await K.cifrar(n.llave, { hechos: 'Gritos en la reunión del lunes', quejoso: { nombre: 'Persona X' } });
  const llave = await K.abrir('Convivencia2026', n.config);
  const vuelta = await K.descifrar(llave, blob);
  let malClave = false; try { await K.abrir('OtraClave2026', n.config); } catch (e) { malClave = /incorrecta/.test(e.message); }
  ok('cifrado: con la clave del comité la queja vuelve completa', vuelta.hechos === 'Gritos en la reunión del lunes' && vuelta.quejoso.nombre === 'Persona X');
  ok('cifrado: con otra clave no abre', malClave);
  ok('cifrado: lo que viaja al servidor no contiene el texto', JSON.stringify(blob).indexOf('Gritos') === -1 && JSON.stringify(blob).indexOf('Persona') === -1 && blob.kid === n.config.kid);
  const b2 = await K.cifrar(n.llave, { hechos: 'Gritos en la reunión del lunes' });
  ok('cifrado: la llave abierta da la misma prueba que al crearla, y la prueba no es la llave', llave.prueba === n.llave.prueba && llave.kid === n.config.kid && llave.prueba.length >= 40);
  const n2 = await K.crear('OtraClave2027'); let otraLlave = false; try { await K.descifrar(n2.llave, blob); } catch (e) { otraLlave = true; }
  ok('cifrado: una queja de otra clave no se abre con la llave equivocada', otraLlave);
  ok('cifrado: el mismo texto cifrado dos veces da resultados distintos (IV aleatorio)', b2.data !== blob.data && b2.iv !== blob.iv);
  let debil = 0; for (const x of ['corta1', 'sinnumerosaqui', '1234567890123']) { try { await K.crear(x); } catch (e) { debil++; } }
  ok('cifrado: rechaza claves débiles (menos de 10, sin letras o sin números)', debil === 3 && K.ITER >= 310000);
  // Plantillas
  const pl = {}; vm.createContext(pl); vm.runInContext(leer('auditorias-plantillas.js') + ';this.P=PLANTILLAS_AUDITORIA;this.V=valoracion0312;', pl);
  const r = pl.P.RES0312.items, suma = (f) => Math.round(r.filter(f).reduce((a, i) => a + i[3], 0) * 100) / 100;
  ok('Res. 0312: 60 estándares que suman 100', r.length === 60 && suma(() => true) === 100 && new Set(r.map((i) => i[0])).size === 60);
  ok('Res. 0312: Planear 25, Hacer 60, Verificar 5, Actuar 10', suma((i) => i[1] === 'Planear') === 25 && suma((i) => i[1] === 'Hacer') === 60 && suma((i) => i[1] === 'Verificar') === 5 && suma((i) => i[1] === 'Actuar') === 10);
  ok('Res. 0312: valoración del art. 28 (<60 crítico, 60–85 moderado, >85 aceptable)', pl.V(59.5).n === 'CRÍTICO' && pl.V(60).n === 'MODERADAMENTE ACEPTABLE' && pl.V(85).n === 'MODERADAMENTE ACEPTABLE' && pl.V(85.5).n === 'ACEPTABLE');
  ok('Dec. 1072: incluye los 13 numerales del art. 2.2.4.6.30', pl.P.DEC1072.items.filter((i) => /2\.2\.4\.6\.30/.test(i[2])).length === 13);
  ok('todas las plantillas tienen id único por pregunta', Object.keys(pl.P).every((k) => new Set(pl.P[k].items.map((i) => i[0])).size === pl.P[k].items.length));
  // Reglas de conformación y quórum (comites.js)
  const cj = leer('comites.js');
  const reglas = new Function('return (' + /const REGLAS = (\{[\s\S]*?\n  \});/.exec(cj)[1] + ');')();
  ok('COPASST: integrantes según Res. 2013 (vigía <10; 1, 2, 3, 4 por parte)', reglas.copasst(8).vigia && reglas.copasst(30).porParte === 1 && reglas.copasst(80).porParte === 2 && reglas.copasst(600).porParte === 3 && reglas.copasst(1500).porParte === 4);
  ok('Convivencia: integrantes según Res. 3461 de 2025 (1 por parte <20; 2 por parte desde 20; sin suplentes <5)', reglas.convivencia(3).suplentes === false && reglas.convivencia(12).porParte === 1 && reglas.convivencia(20).porParte === 2);
  const quorum = new Function('return (' + /  function quorum\(asis\) (\{[\s\S]*?\n  \})/.exec(cj)[0].replace('function quorum(asis)', 'function (asis)') + ');')();
  const A = (rep, cal, s) => ({ representa: rep, calidad: cal, asistio: s });
  ok('quórum: mitad más uno; el suplente reemplaza al principal ausente', quorum([A('Empleador', 'Principal', 'Sí'), A('Empleador', 'Principal', 'No'), A('Trabajadores', 'Principal', 'Sí'), A('Trabajadores', 'Principal', 'No')]).ok === false &&
    quorum([A('Empleador', 'Principal', 'Sí'), A('Empleador', 'Principal', 'No'), A('Empleador', 'Suplente', 'Sí'), A('Trabajadores', 'Principal', 'Sí'), A('Trabajadores', 'Principal', 'No')]).ok === true &&
    quorum([A('Empleador', 'Principal', 'Sí'), A('Empleador', 'Suplente', 'Sí'), A('Trabajadores', 'Principal', 'No'), A('Trabajadores', 'Suplente', 'No')]).pres === 1);
  // Pantallas
  ok('las 3 pantallas cargan empresa, config, common y sgsst-ui', ['copasst.html', 'convivencia.html', 'auditorias.html'].every((f) => /<script src="empresa\.js"><\/script>\s*<script src="empresa-motor\.js"><\/script>\s*<script src="config\.js"><\/script>\s*<script src="common\.js"><\/script>\s*(?:<script src="iconos-emoji\.js"><\/script>\s*)?(?:<script src="valida\.js"><\/script>\s*)?<script src="sgsst-ui\.js"><\/script>/.test(leer(f))));
  const cv = leer('convivencia.html');
  ok('convivencia: todo lo de la queja se cifra antes de enviarse (guardar = cifrar + enviar)', /const cifrado = await Cifrado\.cifrar\(llave, datos\);/.test(cv) && /llave\.kid !== kidActual\(\)/.test(cv) && /\{ sinCola: true \}/.test(cv) && /doc: Object\.assign\(\{\}, pub, \{ cifrado \}\)/.test(cv) && !/localStorage\.setItem\([^)]*clave/i.test(cv));
  ok('convivencia: la clave queda solo en memoria y se cierra sola a los 15 minutos', /setTimeout\(bloquear, 15 \* 60 \* 1000\)/.test(cv) && !/sessionStorage/.test(cv));
  ok('convivencia: acoso sexual → el comité no es competente (Res. 3461, art. 6 par. 1)', /no es competente/.test(cv) && /Ley 2365 de 2024/.test(cv));
  ok('convivencia: plazos de 5 días para tramitar y 65 en total', /const LIMITE_TOTAL = 65;/.test(cv) && /\{ n: 'Recibida', plazo: 5/.test(cv));
  ok('COPASST: reunión extraordinaria en 5 días tras accidente grave (Res. 2013, art. 7)', /Festivos\.sumarDias\(g\.resumen\.fecha, 5\)/.test(leer('copasst.html')));
  ok('auditorías: cada NC se vuelve acción y la auditoría pide COPASST en la planeación', /await UI\.guardarAccion\(\{ origen: P\.origenAccion, origenRef: a\.id/.test(leer('auditorias.html')) && /2\.2\.4\.6\.29/.test(leer('auditorias.html')));
  ok('empresa.js: módulos y formatos nuevos (sin código hasta asignarlo)', modulosEncendidos(['copasst', 'convivencia', 'auditorias']) && datosEmpresa().formatos['SG-AUDITORIA'].codigo === '' && /'copasst\.html': 'copasst'/.test(leer('empresa.js')));
  ok('inicio: tarjetas de COPASST, Convivencia y Auditorías en Gestión del SG-SST', ['copasst.html', 'convivencia.html', 'auditorias.html'].every((f) => leer('index.html').includes('href="' + f + '"')));
  ok('plan de acción: orígenes nuevos y enlace a la auditoría', /'Autoevaluación Res\. 0312'/.test(leer('sgsst-ui.js')) && /'Comité de convivencia'/.test(leer('sgsst-ui.js')) && /auditorias\.html#/.test(leer('plan-accion.html')));
});

grupo('Planeación, salud y documental (v93): servidor', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v93.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const mas = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const r1 = P({ action: 'guardar', tipo: 'peligro', id: 'PEL-1', doc: { proceso: 'Montaje', actividad: 'Soldadura', tarea: 'Soldar en andamio', peligro: 'Caída a distinto nivel', clasificacion: 'Condiciones de seguridad', nd: 6, ne: 3, np: 18, nc: 60, nr: 1080, nivel: 'I', aceptabilidad: 'No aceptable', expuestos: 4, controlesPendientes: 2, medidas: { ingenieria: { texto: 'Línea de vida', estado: 'Por implementar' } }, fechaRevision: hoy }, opId: 'p1' });
  const f = G({ action: 'list', tipo: 'peligro' }).rows[0];
  ok('tipos nuevos: se guardan y la lista trae el resumen de la tabla (sin objetos completos)', r1.ok && f.resumen.nr === 1080 && f.resumen.nivel === 'I' && f.estado === 'No aceptable' && f.titulo === 'Caída a distinto nivel' && f.responsable === 'Montaje' && !('medidas' in f.resumen));
  ok('tipos nuevos: hoja legible "Matriz de peligros" con sus columnas', E.hojas['Matriz de peligros'] && E.hojas['Matriz de peligros'].filas.length === 2 && E.hojas['Matriz de peligros'].filas[0].indexOf('aceptabilidad') !== -1);
  P({ action: 'guardar', tipo: 'politica', id: 'POL-1', doc: { version: '1', fechaFirma: hoy, firmante: 'Gerente', proximaRevision: mas(365), objetivosLista: [{ objetivo: 'a' }, { objetivo: 'b' }], objetivos: 2, divulgaciones: 0, estado: 'VIGENTE' }, opId: 'p2' });
  ok('listas internas no viajan en la lista (solo los campos cortos)', G({ action: 'list', tipo: 'politica' }).rows[0].resumen.objetivos === 2 && !JSON.stringify(G({ action: 'list', tipo: 'politica' }).rows[0]).includes('objetivosLista'));
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-1', doc: { nombre: 'Luis Pérez', cedula: '1010', cargo: 'Soldador', tipoExamen: 'Periódico', fecha: mas(-400), concepto: 'Apto', proxima: mas(-30) }, opId: 'p3' });
  P({ action: 'guardar', tipo: 'medicion', id: 'MED-1', doc: { agente: 'Ruido', area: 'Taller', fecha: mas(-300), resultado: 'Cumple', proxima: mas(10) }, opId: 'p4' });
  P({ action: 'guardar', tipo: 'documento', id: 'DOC-1', doc: { codigo: 'P-01', nombre: 'Procedimiento viejo', estado: 'Obsoleto', proximaRevision: mas(-100) }, opId: 'p5' });
  E.correos.length = 0; E.ctx.avisoDiario();
  const cuerpo = E.correos.length ? String(E.correos[0][2]) : '';
  ok('aviso diario: examen vencido y medición por vencer; no avisa de documentos obsoletos', /Examen médico: Luis Pérez/.test(cuerpo) && /Medición ambiental: Ruido/.test(cuerpo) && !/Procedimiento viejo/.test(cuerpo));
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-2', doc: { nombre: 'Luis Pérez', cedula: '1010', cargo: 'Soldador', tipoExamen: 'Periódico', fecha: mas(-20), concepto: 'Apto', proxima: mas(345) }, opId: 'p6' });
  P({ action: 'guardar', tipo: 'proveedor', id: 'PRV-1', doc: { nombre: 'Proveedor inactivo', activo: false, proximaEvaluacion: mas(-5), resultado: 'Aprobado' }, opId: 'p7' });
  E.correos.length = 0; E.ctx.avisoDiario();
  const c2 = E.correos.length ? String(E.correos[0][2]) : '';
  ok('aviso diario: solo cuenta el examen más reciente de cada persona y no avisa de proveedores inactivos', !/Examen médico: Luis/.test(c2) && !/Proveedor inactivo/.test(c2));
  ok('el campo «versión» de documentos y política no choca con la versión interna del registro', /titulo: 'versionDoc'/.test(leer('backends/backend-sgsst.gs')) && !/k: 'version'/.test(leer('documental.html')));
  ok('un registro reabierto nunca queda como «nuevo» (si no, no se podría volver a guardar)', /'pendiente', 'nuevo'/.test(leer('registros.js')) && /delete d\.nuevo;/.test(leer('registros.js')));
  ok('todas las hojas de los tipos nuevos tienen nombre propio', Object.keys(E.ctx.TIPOS_GEN || {}).length >= 20 || /const TIPOS_GEN = \{/.test(leer('backends/backend-sgsst.gs')));
  fs.unlinkSync(tmp);
});

grupo('Planeación, salud y documental (v93): pantallas y reglas', () => {
  const pg = leer('peligros.html');
  const f = new Function(/function interpNP[^\n]*\n/.exec(pg)[0] + /function nivelNR[^\n]*\n/.exec(pg)[0] + 'return { interpNP, nivelNR };')();
  ok('GTC 45: interpretación del nivel de probabilidad (24–40 muy alto, 10–20 alto, 6–8 medio, 2–4 bajo)', f.interpNP(40) === 'Muy alto' && f.interpNP(24) === 'Muy alto' && f.interpNP(20) === 'Alto' && f.interpNP(10) === 'Alto' && f.interpNP(8) === 'Medio' && f.interpNP(6) === 'Medio' && f.interpNP(4) === 'Bajo' && f.interpNP(2) === 'Bajo');
  ok('GTC 45: nivel de riesgo I (600–4000), II (150–500), III (40–120), IV (20)', f.nivelNR(4000) === 'I' && f.nivelNR(600) === 'I' && f.nivelNR(500) === 'II' && f.nivelNR(150) === 'II' && f.nivelNR(120) === 'III' && f.nivelNR(40) === 'III' && f.nivelNR(20) === 'IV' && f.nivelNR(0) === 'IV');
  ok('GTC 45: escalas de ND (10, 6, 2, 0), NE (4–1) y NC (100, 60, 25, 10)', /const ND = \[\[10,[^\]]+\], \[6,[^\]]+\], \[2,[^\]]+\], \[0,/.test(pg) && /const NC = \[\[100,[^\]]+\], \[60,[^\]]+\], \[25,[^\]]+\], \[10,/.test(pg));
  const em = leer('emergencias.html');
  const nr = new Function(/function nivelRiesgo\(a\) \{[\s\S]*?\n\}/.exec(em)[0] + ';return nivelRiesgo;')();
  ok('emergencias: método por colores (3–4 rojos alto; 1–2 rojos o 3–4 amarillos medio; si no, bajo)', nr({ amenaza: 'r', personas: 'r', recursos: 'r', sistemas: 'v' }) === 'Alto' && nr({ amenaza: 'r', personas: 'v', recursos: 'v', sistemas: 'v' }) === 'Medio' && nr({ amenaza: 'a', personas: 'a', recursos: 'a', sistemas: 'v' }) === 'Medio' && nr({ amenaza: 'a', personas: 'v', recursos: 'v', sistemas: 'v' }) === 'Bajo');
  const sa = leer('salud.html');
  ok('salud: no se guardan diagnósticos (aviso y filtro de palabras de diagnóstico)', /Aquí NO se guardan diagnósticos/.test(sa) && /Parece un diagnóstico/.test(sa) && /No escribas el diagnóstico/.test(sa));
  ok('salud: Res. 1843 de 2025 (tipos de evaluación, egreso en 5 días hábiles, máximo 3 años)', /'Pre-ingreso', 'Periódico', 'Egreso', 'Post-incapacidad', 'Retorno laboral', 'Seguimiento o control'/.test(sa) && /Festivos\.sumarHabiles\(v\.fechaRetiro, 5\)/.test(sa) && /sumarMeses\(v\.fecha, 36\)/.test(sa));
  ok('salud: el concepto del examen actualiza Personal habilitado', /requisitos: \{ medico: \{ fecha: v\.fecha/.test(sa));
  ok('psicosocial: alto o muy alto se repite al año; medio o bajo a los 2 años (Res. 2764 de 2022)', /sumarMeses\(v\.fecha, \/alto\/i\.test\(v\.nivelGeneral\) \? 12 : 24\)/.test(sa));
  const vm = require('vm'); const nb = {}; vm.createContext(nb); vm.runInContext(leer('normas-base.js') + ';this.N=NORMAS_BASE;', nb);
  ok('matriz legal base: normas vigentes clave y sin las derogadas', nb.N.length >= 25 && ['Resolución 0312 de 2019', 'Resolución 3461 de 2025', 'Resolución 1843 de 2025', 'Resolución 2764 de 2022', 'Resolución 4272 de 2021'].every((x) => nb.N.some((n) => n[0] === x)) && !nb.N.some((n) => /2346 de 2007|652 de 2012|1356 de 2012|2404 de 2019|1409 de 2012/.test(n[0])));
  const rd = leer('revision-direccion.html');
  ok('revisión por la dirección: los 24 numerales del art. 2.2.4.6.31 y comunicación al COPASST', (/const ASPECTOS = \[([\s\S]*?)\n\];/.exec(rd)[1].match(/^  \['/gm) || []).length === 24 && /comunicadaCopasst/.test(rd) && /ASPECTOS_V1/.test(rd));
  ok('plan anual: plantilla con actividades que el portal marca solo', /\['Hacer', 'Reunión mensual del COPASST', 'Comité', todos, 'copasst'\]/.test(leer('plan-anual.html')) && /\['Verificar', 'Revisión por la alta dirección', 'Documental', \[12\], 'revision'\]/.test(leer('plan-anual.html')));
  const paginas = ['plan-anual.html', 'peligros.html', 'emergencias.html', 'salud.html', 'documental.html', 'revision-direccion.html'];
  ok('las 6 pantallas cargan empresa, config, common, sgsst-ui y registros', paginas.every((x) => /<script src="empresa\.js"><\/script>\s*<script src="empresa-motor\.js"><\/script>\s*<script src="config\.js"><\/script>\s*<script src="common\.js"><\/script>\s*(?:<script src="iconos-emoji\.js"><\/script>\s*)?(?:<script src="valida\.js"><\/script>\s*)?<script src="sgsst-ui\.js"><\/script>\s*<script src="registros\.js"><\/script>/.test(leer(x))));
  ok('inicio: sección «Planear y revisar el SG-SST» con las 6 tarjetas', /sec-planear/.test(leer('index.html')) && paginas.every((x) => leer('index.html').includes('href="' + x + '"')));
  ok('empresa.js: módulos y formatos nuevos', modulosEncendidos(['plananual', 'peligros', 'emergencias', 'salud', 'documental', 'revision']) && datosEmpresa().formatos['SG-MATRIZ-PELIGROS'].codigo === '' && /'revision-direccion\.html': 'revision'/.test(leer('empresa.js')));
  ok('indicadores: estructura y proceso, y ausentismo desde el registro', /function estructuraProceso\(\)/.test(leer('indicadores.html')) && /function ausenciaDelMes\(m\)/.test(leer('indicadores.html')));
  ok('autoevaluación: pistas del portal para los estándares de planeación y salud', ['2.1.1', '2.4.1', '2.7.1', '3.1.4', '4.1.1', '4.1.2', '5.1.1', '6.1.3'].every((k) => leer('auditorias.html').includes("pistas['" + k + "']")));
});

grupo('Usuarios, adjuntos, respaldo y contratistas (v94): servidor', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const crypto = require('crypto');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v94.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];")
    .replace('const RESPALDAR_TAMBIEN = [];', "const RESPALDAR_TAMBIEN = ['https://docs.google.com/spreadsheets/d/OTRAHOJA123456789012345/edit'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  E.libros.OTRAHOJA123456789012345 = { id: 'OTRAHOJA123456789012345', nombre: 'Permisos de alturas', hojas: {} };
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const mas = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Lo que hace el celular: PBKDF2 de la clave con la sal (la clave nunca viaja).
  const prueba = (clave, sal) => crypto.pbkdf2Sync(clave, Buffer.from(sal, 'hex'), 100000, 32, 'sha256').toString('base64');
  const sal = () => crypto.randomBytes(16).toString('hex');
  const todoElTexto = () => JSON.stringify(Object.keys(E.hojas).map((h) => E.hojas[h].filas));

  // ── Sin usuarios: todo como siempre ──
  const r0 = P({ action: 'guardar', tipo: 'accion', id: 'ACC-1', doc: { accion: 'Cambiar guarda', responsable: 'Ana', fechaCompromiso: mas(10), estado: 'ABIERTA' }, opId: 'a1' });
  const l0 = G({ action: 'list', tipo: 'accion' });
  ok('sin usuarios: se guarda y se lista solo con la clave del portal (sin datos de sesión; v168 agrega total, gen, vista y hasta)', r0.ok && l0.ok && Array.isArray(l0.rows) && !('usuarios' in l0) && !('yo' in l0) && l0.vista === 'abierto' && !('registradoPor' in G({ id: 'ACC-1' }).doc) && G({ action: 'ping' }).usuarios === false);
  ok('sin usuarios: no se crea la hoja "Usuarios"', !E.hojas.Usuarios);
  ok('sin usuarios: crear el administrador exige el código que solo ve el dueño del Apps Script', P({ action: 'primerAdmin', codigo: 'ABCDE-FGHJK', usuario: 'carc', nombre: 'Carc', salt: sal(), pruebaNueva: 'x'.repeat(44) }).ok === false && !E.hojas.Usuarios);

  // ── Primer administrador ──
  const codigo = E.ctx.codigoAdministrador();
  const sA = sal(), pA = prueba('ClaveAdmin2026', sA);
  const adm = P({ action: 'primerAdmin', codigo, usuario: 'Carc', nombre: 'Carlos Ríos', cargo: 'HSEQ', salt: sA, iter: 150000, pruebaNueva: pA, opId: 'u1' });
  const SA = adm.sesion;
  ok('el código crea el primer administrador y entra de una vez', adm.ok && /^v1\./.test(SA) && adm.yo.rol === 'admin' && adm.yo.usuario === 'carc');
  ok('el código sirve una sola vez', P({ action: 'primerAdmin', codigo, usuario: 'otro', nombre: 'Otro', salt: sal(), pruebaNueva: 'y'.repeat(44) }).ok === false);
  ok('en la hoja "Usuarios" queda la huella de la prueba, nunca la prueba ni la clave', E.hojas.Usuarios && !todoElTexto().includes(pA) && !todoElTexto().includes('ClaveAdmin2026') && todoElTexto().includes(crypto.createHash('sha256').update(pA).digest('hex')));

  // ── Con usuarios: leer y escribir exigen sesión ──
  ok('con usuarios: sin sesión no se lista ni se abre nada (pide entrar)', G({ action: 'list', tipo: 'accion' }).codigoError === 'SESION' && G({ id: 'ACC-1' }).codigoError === 'SESION');
  ok('con usuarios: la lista de personal habilitado sigue abierta (la usan los permisos en campo)', G({ action: 'list', tipo: 'trabajador' }).ok === true);
  const sinSes = P({ action: 'parche', tipo: 'accion', id: 'ACC-1', campos: { estado: 'CERRADA' }, opId: 'a2' });
  ok('con usuarios: cambiar sin sesión se rechaza y queda en la bitácora', sinSes.codigoError === 'SESION' && E.hojas.Eventos.filas.some((f) => f[1] === 'ACC-1' && f[3] === 'RECHAZADO'));
  ok('con usuarios: cualquiera puede CREAR un reporte o una acción sin usuario (reportar no se bloquea)', P({ action: 'guardar', tipo: 'reporte', id: 'REP-1', doc: { clase: 'Condición insegura', fecha: hoy, descripcion: 'Cable pelado' }, opId: 'r1' }).ok &&
     P({ action: 'guardar', tipo: 'reporte', id: 'REP-1', doc: { clase: 'Condición insegura', fecha: hoy, descripcion: 'otra cosa' }, versionBase: 1, opId: 'r2' }).codigoError === 'SESION');
  const lA = G({ action: 'list', tipo: 'accion', sesion: SA });
  ok('con sesión: la lista dice quién entró', lA.ok && lA.usuarios === true && lA.yo.nombre === 'Carlos Ríos');

  // ── Usuario supervisor con clave temporal ──
  const sT = sal(), pT = prueba('Temporal123', sT);
  const nu = P({ action: 'guardarUsuario', sesion: SA, usuario: 'luis.sup', nombre: 'Luis Supervisor', rol: 'supervisor', salt: sT, iter: 150000, pruebaNueva: pT, opId: 'u2' });
  ok('el administrador crea un usuario con clave temporal', nu.ok && nu.usuario.debeCambiar === true && nu.usuario.rol === 'supervisor');
  ok('solo un administrador crea usuarios', P({ action: 'guardarUsuario', usuario: 'x.y', nombre: 'X', rol: 'admin', salt: sal(), pruebaNueva: 'z'.repeat(44) }).codigoError === 'SESION');
  const salLuis = G({ action: 'sal', usuario: 'luis.sup' });
  const salNadie1 = G({ action: 'sal', usuario: 'nadie' }), salNadie2 = G({ action: 'sal', usuario: 'nadie' });
  ok('la sal de un usuario que no existe es fija y con la misma forma (no revela quién existe)', salLuis.salt === sT && /^[0-9a-f]{32}$/.test(salNadie1.salt) && salNadie1.salt === salNadie2.salt);
  const e1 = P({ action: 'entrar', usuario: 'luis.sup', prueba: pT, opId: 'e1' });
  ok('entra con la clave temporal y debe cambiarla', e1.ok && e1.yo.debeCambiar === true);
  ok('con clave temporal no puede guardar nada', P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-1', doc: { categoria: 'Extintores', fecha: hoy, items: [] }, sesion: e1.sesion, opId: 'i0' }).codigoError === 'CAMBIAR');
  const sL = sal(), pL = prueba('MiClaveLuis99', sL);
  const cc = P({ action: 'cambiarMiClave', sesion: e1.sesion, prueba: pT, salt: sL, iter: 150000, pruebaNueva: pL, opId: 'c1' });
  const SL = cc.sesion;
  ok('cambia su clave: recibe sesión nueva y la vieja deja de servir', cc.ok && SL && P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-0', doc: { categoria: 'x', fecha: hoy, items: [] }, sesion: e1.sesion, opId: 'i00' }).codigoError === 'SESION');

  // ── Permisos por rol ──
  ok('supervisor: guarda inspecciones', P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-1', doc: { categoria: 'Extintores', fecha: hoy, items: [] }, sesion: SL, opId: 'i1' }).ok);
  const nop = P({ action: 'guardar', tipo: 'peligro', id: 'PEL-9', doc: { peligro: 'Ruido' }, sesion: SL, opId: 'pp1' });
  ok('supervisor: NO cambia la matriz de peligros (solo SST)', nop.codigoError === 'PERMISO' && /Supervisor/.test(nop.error));
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-1', doc: { nombre: 'Pedro', cedula: '77', concepto: 'Apto con restricciones', fecha: hoy, proxima: mas(300) }, sesion: SA, opId: 'x1' });
  const lsup = G({ action: 'list', tipo: 'examen,accion', sesion: SL });
  ok('supervisor: no ve exámenes médicos individuales (ni en listas mezcladas ni abriéndolos)', lsup.ok && !lsup.rows.some((r) => r.tipo === 'examen') && lsup.rows.some((r) => r.tipo === 'accion') && G({ id: 'EXA-1', sesion: SL }).codigoError === 'PERMISO');
  ok('administrador: sí ve el examen', G({ id: 'EXA-1', sesion: SA }).ok === true);

  // ── Quién hizo qué ──
  P({ action: 'parche', tipo: 'accion', id: 'ACC-1', campos: { estado: 'EN PROCESO', registradoPor: 'Falso' }, sesion: SL, opId: 'a3' });
  const dAcc = G({ id: 'ACC-1', sesion: SA }).doc;
  ok('el registro dice quién lo modificó (y el celular no puede falsificarlo)', dAcc.modificadoPor === 'Luis Supervisor (luis.sup)' && dAcc.registradoPor !== 'Falso');
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-2', doc: { accion: 'Señalizar', responsable: 'Ana', estado: 'ABIERTA' }, sesion: SA, opId: 'a4' });
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-2', doc: { accion: 'Señalizar zona', responsable: 'Ana', estado: 'ABIERTA', registradoPor: 'Otro' }, versionBase: 1, sesion: SL, opId: 'a5' });
  const d2 = G({ id: 'ACC-2', sesion: SA }).doc;
  ok('quien lo creó se conserva al reescribirlo completo', d2.registradoPor === 'Carlos Ríos (carc)' && d2.modificadoPor === 'Luis Supervisor (luis.sup)');
  const ev = E.hojas.Eventos.filas;
  ok('la bitácora tiene la columna "usuario" con el nombre de cada quien', ev[0][8] === 'usuario' && ev.some((f) => f[1] === 'ACC-2' && f[8] === 'Luis Supervisor (luis.sup)' && /cambió: accion/.test(f[4])));
  const h = G({ action: 'historial', id: 'ACC-2', sesion: SA });
  ok('historial de un registro: del más nuevo al más viejo, con usuario y qué cambió', h.ok && h.eventos.length === 2 && h.eventos[0].usuario === 'Luis Supervisor (luis.sup)' && /cambió: accion/.test(h.eventos[0].detalle) && h.eventos[1].accion === 'CREAR');
  ok('historial: sin sesión no se ve', G({ action: 'historial', id: 'ACC-2' }).codigoError === 'SESION');

  // ── Sesiones: falsificadas, bloqueo por intentos, último administrador ──
  const partes = SL.split('.'); const carga = JSON.parse(Buffer.from(partes[1], 'base64').toString()); carga.u = 'carc';
  const falsa = 'v1.' + Buffer.from(JSON.stringify(carga)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + partes[2];
  ok('una sesión alterada (otro usuario en la carga) no sirve', G({ action: 'usuarios', sesion: falsa }).codigoError === 'SESION');
  for (let i = 0; i < 5; i++) P({ action: 'entrar', usuario: 'luis.sup', prueba: 'mala' + i, opId: 'm' + i });
  const bloq = P({ action: 'entrar', usuario: 'luis.sup', prueba: pL, opId: 'm9' });
  ok('5 claves malas bloquean 15 minutos (aunque luego llegue la buena), con el mismo mensaje de siempre', bloq.ok === false && bloq.error === P({ action: 'entrar', usuario: 'nadie', prueba: 'x' }).error && /5 intentos/.test(bloq.error));
  const quitarme = P({ action: 'guardarUsuario', sesion: SA, usuario: 'carc', nombre: 'Carlos Ríos', rol: 'consulta', opId: 'u3' });
  ok('no se puede dejar el portal sin administrador', quitarme.ok === false && /al menos un administrador/.test(quitarme.error));
  const lu = G({ action: 'usuarios', sesion: SA });
  ok('lista de usuarios para el administrador, sin huellas ni sales', lu.ok && lu.usuarios.length === 2 && !JSON.stringify(lu).includes(sA) && lu.usuarios.some((u) => u.usuario === 'luis.sup' && u.bloqueado === true));
  P({ action: 'guardarUsuario', sesion: SA, usuario: 'luis.sup', nombre: 'Luis Supervisor', rol: 'supervisor', activo: false, opId: 'u4' });
  ok('desactivar un usuario corta su sesión de inmediato', G({ action: 'list', tipo: 'accion', sesion: SL }).codigoError === 'SESION');

  // ── Adjuntos ──
  const pdf = Buffer.from('%PDF-1.4 certificado de prueba').toString('base64');
  const ad = P({ action: 'adjuntar', id: 'ACC-1', uid: 'adj-0001', nombre: 'Evidencia cierre.pdf', mime: 'application/pdf', base64: pdf, ref: 'cierre', sesion: SA, opId: 'ad1' });
  const carpAdj = E.carpetas.find((c) => c.nombre === 'Portal SSTA - Adjuntos SG-SST');
  ok('adjuntar: el archivo va a Drive (Adjuntos SG-SST/accion) y el registro lo enlaza', ad.ok && carpAdj && E.carpetas.some((c) => c.padre === carpAdj.id && c.nombre === 'accion' && c.archivos.length === 1) && G({ id: 'ACC-1', sesion: SA }).doc.adjuntos.length === 1);
  ok('adjuntar dos veces lo mismo (reintento de la cola) no lo duplica', P({ action: 'adjuntar', id: 'ACC-1', uid: 'adj-0001', nombre: 'Evidencia cierre.pdf', mime: 'application/pdf', base64: pdf, sesion: SA, opId: 'ad1b' }).duplicado === true && Object.keys(E.archivos).filter((k) => /Evidencia/.test(E.archivos[k].nombre)).length === 1);
  ok('la lista cuenta los adjuntos del registro', G({ action: 'list', tipo: 'accion', sesion: SA }).rows.find((r) => r.id === 'ACC-1').resumen._adj === 1);
  ok('adjuntar no cambia la versión (quien tiene el registro abierto lo puede guardar sin conflicto)', ad.version === 2 && G({ id: 'ACC-1', sesion: SA }).version === 2);
  const v1 = G({ id: 'ACC-1', sesion: SA });
  const g6 = P({ action: 'guardar', tipo: 'accion', id: 'ACC-1', doc: { accion: 'Cambiar guarda', responsable: 'Ana', estado: 'EN PROCESO', adjuntos: [] }, versionBase: v1.version, sesion: SA, opId: 'a6' });
  P({ action: 'parche', tipo: 'accion', id: 'ACC-1', campos: { adjuntos: [{ uid: 'falso', fileId: 'otro' }] }, sesion: SA, opId: 'a7' });
  ok('guardar el registro completo no borra los adjuntos, y no se pueden meter adjuntos falsos', g6.ok && G({ id: 'ACC-1', sesion: SA }).doc.adjuntos.length === 1 && G({ id: 'ACC-1', sesion: SA }).doc.adjuntos[0].uid === 'adj-0001');
  const baj = G({ action: 'adjunto', id: 'ACC-1', uid: 'adj-0001', sesion: SA });
  ok('el adjunto se baja por el servidor (Drive no se comparte con nadie)', baj.ok && baj.base64 === pdf && baj.mime === 'application/pdf');
  ok('adjuntar: rechaza tipos de archivo no permitidos y las quejas de convivencia', P({ action: 'adjuntar', id: 'ACC-1', uid: 'adj-0002', nombre: 'x.exe', mime: 'application/x-msdownload', base64: pdf, sesion: SA, opId: 'ad2' }).ok === false);
  ok('adjuntar: más de 10 MB se rechaza', P({ action: 'adjuntar', id: 'ACC-1', uid: 'adj-0003', nombre: 'grande.pdf', mime: 'application/pdf', base64: Buffer.alloc(10 * 1024 * 1024 + 10).toString('base64'), sesion: SA, opId: 'ad3' }).error === 'El archivo pasa de 10 MB.');
  ok('adjuntar a un registro que aún no llega: TEMPORAL (la cola lo reintenta)', P({ action: 'adjuntar', id: 'ACC-NOLLEGA', uid: 'adj-0004', nombre: 'a.pdf', mime: 'application/pdf', base64: pdf, sesion: SA, opId: 'ad4' }).codigoError === 'TEMPORAL');
  const qa = P({ action: 'quitarAdjunto', id: 'ACC-1', uid: 'adj-0001', motivo: 'Era de otra acción', sesion: SA, opId: 'ad5' });
  const dq = G({ id: 'ACC-1', sesion: SA }).doc.adjuntos[0];
  ok('quitar un adjunto no lo borra: queda retirado (quién, cuándo, por qué) y el archivo se renombra', qa.ok && dq.retirado && dq.retirado.motivo === 'Era de otra acción' && /^RETIRADO - /.test(E.archivos[dq.fileId].nombre) && !E.archivos[dq.fileId].papelera &&
     !G({ action: 'list', tipo: 'accion', sesion: SA }).rows.find((r) => r.id === 'ACC-1').resumen._adj);

  // ── Lo que encontró la revisión ──
  E.archivos['archivo-ajeno'] = { id: 'archivo-ajeno', nombre: 'Nómina', mime: 'text/plain', bytes: Array.from(Buffer.from('SECRETO')), carpeta: null, papelera: false };
  const proto = JSON.parse('{"__proto__":{"adjuntos":[{"uid":"evil123","mime":"text/plain","fileId":"archivo-ajeno"}],"registradoPor":"Falso"}}');
  P({ action: 'parche', tipo: 'accion', id: 'ACC-2', campos: proto, sesion: SA, opId: 'pr1' });
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-2', doc: Object.assign(JSON.parse('{"__proto__":{"adjuntos":[{"uid":"evil123","fileId":"archivo-ajeno"}]}}'), { accion: 'x' }), versionBase: G({ id: 'ACC-2', sesion: SA }).version, sesion: SA, opId: 'pr2' });
  ok('un "__proto__" en los datos no cuela adjuntos (no se puede leer un archivo ajeno de Drive)', !G({ action: 'adjunto', id: 'ACC-2', uid: 'evil123', sesion: SA }).ok && !(G({ id: 'ACC-2', sesion: SA }).doc.adjuntos));
  ok('crear un usuario que ya existe no lo sobrescribe', P({ action: 'guardarUsuario', sesion: SA, nuevo: true, usuario: 'luis.sup', nombre: 'Otro', rol: 'admin', salt: sal(), iter: 150000, pruebaNueva: prueba('Otra1234', sal()), opId: 'u9' }).ok === false);
  ok('iteraciones de la clave fuera de rango: rechazadas', P({ action: 'guardarUsuario', sesion: SA, usuario: 'nuevo.x', nombre: 'X', rol: 'consulta', salt: sal(), iter: 10, pruebaNueva: 'z'.repeat(44), opId: 'u10' }).ok === false);
  P({ action: 'parche', tipo: 'trabajador', id: 'TRB-77', campos: { nombre: 'Pedro', cedula: '77', requisitos: { medico: { fecha: hoy, vence: mas(300), apto: 'Apto con restricciones', restricciones: 'No levantar >10 kg por hernia' } } }, sesion: SA, opId: 't77' });
  const libreT = G({ action: 'list', tipo: 'trabajador' }).rows.find((r) => r.id === 'TRB-77');
  ok('restricciones médicas: sin sesión (o sin rol SST) no se ven; el apto sí (lo usan los permisos)', libreT.resumen.req.medico.apto === 'Apto con restricciones' && !/hernia/.test(JSON.stringify(libreT)) && /hernia/.test(JSON.stringify(G({ action: 'list', tipo: 'trabajador', sesion: SA }).rows)));

  // ── Respaldo ──
  const est = E.ctx.instalarRespaldo();
  const carpR = E.carpetas.find((c) => c.nombre === 'Portal SSTA - Respaldos SG-SST');
  ok('respaldo: copia esta hoja y las de RESPALDAR_TAMBIEN, y queda programado cada semana', est.libros === 2 && carpR && carpR.archivos.length === 2 && E.activadores.some((t) => t.getHandlerFunction() === 'respaldoSemanal') && E.hojas.Eventos.protegida === true);
  // Copias viejas: de un mismo mes se queda la primera; las de las últimas 8 semanas, todas.
  const viejo = (n, f) => { const id = 'archivo-v' + n; E.archivos[id] = { id, nombre: 'activo — respaldo ' + f, mime: 'x', bytes: [], carpeta: carpR.id, papelera: false }; carpR.archivos.push(id); return id; };
  const a1 = viejo(1, mas(-200).slice(0, 7) + '-02'), a2 = viejo(2, mas(-200).slice(0, 7) + '-09'), a3 = viejo(3, mas(-14));
  E.ctx.respaldoSemanal();
  ok('respaldo: conserva el primero de cada mes y las últimas 8 semanas; el resto va a la papelera', !E.archivos[a1].papelera && E.archivos[a2].papelera && !E.archivos[a3].papelera);
  E.propiedades.RESPALDO_ULTIMO = JSON.stringify({ fecha: mas(-12), en: new Date().toISOString(), libros: 2, errores: [] });
  E.correos.length = 0; E.ctx.avisoDiario();
  ok('aviso diario: avisa si el respaldo semanal dejó de hacerse', E.correos.length && /Respaldo semanal de las hojas: no se hace desde/.test(String(E.correos[0][2])));
  ok('respaldar ahora desde el portal: solo el administrador', P({ action: 'respaldar', sesion: SL, opId: 'rs1' }).ok === false && P({ action: 'respaldar', sesion: SA, opId: 'rs2' }).ok === true);

  // ── Contratistas ──
  P({ action: 'guardar', tipo: 'contratista', id: 'CTR-1', doc: { nombre: 'Andamios del Norte SAS', nit: '900123', documentos: { camara: { fecha: mas(-100), vence: mas(-10) } }, docsVencidos: 1, venceDocs: mas(-10), estado: 'ACTIVO' }, sesion: SA, opId: 'ct1' });
  P({ action: 'guardar', tipo: 'contratista', id: 'CTR-2', doc: { nombre: 'Contratista retirado', venceDocs: mas(-50), estado: 'INACTIVO' }, sesion: SA, opId: 'ct2' });
  E.correos.length = 0; E.ctx.avisoDiario();
  const cu = E.correos.length ? String(E.correos[0][2]) : '';
  ok('contratistas: avisa de documentos vencidos (no de contratistas inactivos)', /Documentos del contratista: Andamios del Norte SAS/.test(cu) && !/Contratista retirado/.test(cu));
  ok('contratistas: hojas legibles "Contratistas" e "Ingresos de contratistas"', !!E.hojas.Contratistas && P({ action: 'guardar', tipo: 'ingreso', id: 'ING-1', doc: { fecha: hoy, contratista: 'Andamios del Norte SAS', personas: 3, autorizadas: 2, noAutorizadas: 1, resultado: 'AUTORIZADO CON OBSERVACIONES', autorizo: 'Ana' }, sesion: SA, opId: 'in1' }).ok && E.hojas['Ingresos de contratistas'].filas.length === 2);
  fs.unlinkSync(tmp);
});

grupo('Usuarios y adjuntos sin usuarios configurados (igual que antes)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-1', doc: { nombre: 'Ana', cedula: '1' }, opId: 'x' });
  const ad = P({ action: 'adjuntar', id: 'TRB-1', uid: 'adj-sin-usr', nombre: 'Curso alturas.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF').toString('base64'), opId: 'y' });
  ok('sin usuarios también se adjunta (con la clave del portal) y el registro no cambia de forma', ad.ok && G({ id: 'TRB-1' }).doc.adjuntos.length === 1 && !('modificadoPor' in G({ id: 'TRB-1' }).doc));
  ok('sin usuarios la bitácora deja vacía la columna de usuario y lleva su huella encadenada (v162)', E.hojas.Eventos.filas.slice(1).every((f) => f.length === 11 && f[8] === '' && /^[0-9a-f]{64}$/.test(f[9])));
  ok('v163: guardar y registrar en la bitácora no pide el candado dos veces (soltar el de adentro dejaba el guardado sin protección)', E.ctx._candado.anidado === 0 && !E.ctx._candado.tomado, JSON.stringify(E.ctx._candado));
  { const antes = E.hojas.Eventos.filas.length; E.ctx.registrarEvento_('X-1', 'probar', 'OK', 'fuera de un guardado'); ok('v163: fuera de un guardado (lecturas, tareas) la bitácora sí toma y suelta su candado', E.hojas.Eventos.filas.length === antes + 1 && !E.ctx._candado.tomado && E.ctx._candado.anidado === 0); }
  ok('sin usuarios el historial se puede ver con la clave del portal', G({ action: 'historial', id: 'TRB-1' }).eventos.length === 2);
});

grupo('v153: paquete de documentación para el cliente (.zip)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const pdf = (t) => Buffer.from('%PDF-1.4 ' + t).toString('base64'), jpg = 'data:image/jpeg;base64,' + Buffer.from('JPEGFAKE').toString('base64');
  P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-1', doc: { nombre: 'Ana Pérez', cedula: '101', requisitos: { alturas: { fecha: '2026-03-01', soporte: jpg }, medico: { fecha: '2026-01-10', apto: 'Apto', soporte: jpg } } }, opId: 'p1' });
  P({ action: 'adjuntar', id: 'TRB-1', uid: 'adj-curso01', nombre: 'Curso alturas.pdf', mime: 'application/pdf', base64: pdf('curso'), ref: 'alturas', opId: 'p2' });
  P({ action: 'adjuntar', id: 'TRB-1', uid: 'adj-medic01', nombre: 'Concepto.pdf', mime: 'application/pdf', base64: pdf('medico'), ref: 'medico', opId: 'p3' });
  P({ action: 'guardar', tipo: 'equipo', id: 'EQ-1', doc: { categoria: 'extintor', codigo: 'EXT-01', nombre: 'Extintor PQS 20 lb' }, opId: 'p4' });
  P({ action: 'adjuntar', id: 'EQ-1', uid: 'adj-ficha01', nombre: 'Ficha técnica.pdf', mime: 'application/pdf', base64: pdf('ficha'), ref: 'ficha', opId: 'p5' });
  P({ action: 'guardar', tipo: 'sve', id: 'SVE-1', doc: { programa: 'Conservación auditiva', estado: 'Activo' }, opId: 'p6' });
  const r = P({ action: 'paqueteCliente', cliente: 'Cliente ABC', personas: ['TRB-1'], equipos: ['EQ-1'], programas: ['SVE-1'], indiceHtml: '<html><body>Índice</body></html>', opId: 'p7' });
  const nombres = (b64) => { const z = Buffer.from(b64, 'base64'), out = []; let i = 0; while (z.readUInt32LE(i) === 0x04034b50) { const n = z.readUInt16LE(i + 26), t = z.readUInt32LE(i + 18); out.push(z.slice(i + 30, i + 30 + n).toString('utf8')); i += 30 + n + t; } return out; };
  const l = r.ok ? nombres(r.base64) : [];
  ok('arma un .zip con el índice en PDF, los soportes del personal y los documentos del equipo', r.ok && /^Paquete Cliente ABC \d{4}-\d{2}-\d{2}\.zip$/.test(r.nombre) && l[0] === '00 Índice - Cliente ABC.pdf' && l.includes('Personal/Ana Pérez - CC 101/Curso alturas.pdf') && l.includes('Personal/Ana Pérez - CC 101/Soporte alturas.jpg') && l.includes('Equipos/EXT-01 - Extintor PQS 20 lb/Ficha técnica.pdf'), JSON.stringify(l));
  ok('sin marcarlo, los conceptos médicos no salen en el paquete', !l.some((x) => /Concepto|medico/i.test(x)));
  const r2 = P({ action: 'paqueteCliente', cliente: 'Cliente ABC', personas: ['TRB-1'], incluirMedico: true, opId: 'p8' });
  ok('marcado expresamente, sí salen (y queda en la bitácora)', r2.ok && nombres(r2.base64).some((x) => /Concepto\.pdf$/.test(x)) && E.hojas.Eventos.filas.some((f) => f.join('|').includes('PAQUETE_CLIENTE') && f.join('|').includes('con conceptos médicos')));
  ok('el .zip queda en Drive (Paquetes para clientes) y solo se comparte si se pide', E.carpetas.some((c) => /Paquetes para clientes/.test(c.nombre) && c.archivos.length === 2) && !r.compartido && P({ action: 'paqueteCliente', cliente: 'X', equipos: ['EQ-1'], compartir: true, opId: 'p9' }).compartido === true);
  ok('sin nada marcado no arma nada', P({ action: 'paqueteCliente', cliente: 'X', opId: 'p10' }).ok === false);
  const pg = leer('paquete-cliente.html');
  ok('pantalla: personas, equipos y PVE con «Solo los habilitados», índice en PDF y descarga del .zip', /data-hab="1"/.test(pg) && /action: 'paqueteCliente'/.test(pg) && /application\/zip/.test(pg) && /SGSST\.listar\('trabajador,equipo'\)/.test(pg) && !/data-todos="V"/.test(pg) && /href="paquete-cliente\.html"/.test(leer('index.html')) && /paquete-cliente\.html/.test(leer('sw.js')) && /'paquete-cliente\.html': 'evidencias'/.test(leer('empresa-motor.js')));
  ok('equipos: se suben su ficha técnica, certificados y manual', /titulo: 'Documentos del equipo'/.test(leer('inspecciones.html')));
});

grupo('Usuarios, adjuntos y contratistas (v94): pantallas y reglas', () => {
  const c = leer('common.js'), ui = leer('sgsst-ui.js'), rg = leer('registros.js');
  ok('la clave de la persona nunca viaja: se manda una prueba PBKDF2 derivada con su sal', /deriveBits\(\{ name: 'PBKDF2', hash: 'SHA-256'/.test(c) && /action: 'entrar', usuario, prueba: await this\.derivar\(clave/.test(c) && !/clave: clave|, clave \}/.test(c));
  ok('cada envío al SG-SST lleva la sesión, y cada consulta también', /sesion: Sesion\.token\(\) \}, body\)/.test(c) && /this\._ses\(\)\);/.test(c));
  ok('la cola no descarta lo que espera a que alguien entre (SESION / CAMBIAR no cuentan como intento)', /json\.codigoError === 'SESION' \|\| json\.codigoError === 'CAMBIAR'\) \{[\s\S]{0,300}_anotarError/.test(c));
  ok('la cola reenvía con la sesión vigente (también lo que quedó en cola antes de los usuarios, o si la rechazaron) — SG-SST y la obra (v112)', /item\.url === SGSST\.url\(\)\) \|\| Outbox\._delPortal\(item\.url\)\)\) item\.body\.sesion = Sesion\.paraReenvio\(item\.body\.sesion, item\.sesionRechazada\)/.test(c));
  ok('adjuntar y quitar adjuntos van en orden con los demás cambios del registro (y se comprueba si ya llegaron)', (c.match(/guardar\|parche\|borrar\|adjuntar\|quitarAdjunto/g) || []).length >= 2);
  ok('formularios: un registro guardado muestra adjuntos e historial', /UI\.adjuntos\(m\.el\.querySelector\('\[data-adjuntos\]'\)/.test(rg) && /UI\.botonHistorial\(d0\.id/.test(rg));
  ok('el celular no manda adjuntos ni autoría al guardar un registro completo', /'nuevo', 'adjuntos', 'registradoPor', 'modificadoPor'\]/.test(rg));
  ok('los adjuntos se abren desde la pestaña creada al tocar (si no, el celular la bloquea)', /window\.open\('', '_blank'\)[\s\S]{0,2500}w\.location\.href = url/.test(ui));
  ok('fotos grandes se reducen antes de adjuntar; límite de 10 MB', /f\.size > 1500000/.test(ui) && /MAX_ADJ = 10 \* 1024 \* 1024/.test(ui));
  ok('adjuntos e historial en plan de acción, reportes, personal, auditorías, actas y contratistas', ['plan-accion.html', 'reportes.html', 'habilitacion.html', 'auditorias.html', 'comites.js', 'contratistas.html'].every((f) => /UI\.adjuntos\(/.test(leer(f)) && /UI\.botonHistorial\(/.test(leer(f))));
  ok('salud: los roles que no son SST ven un aviso, no una pantalla vacía engañosa', /rol !== 'admin' && rol !== 'sst'/.test(leer('salud.html')));
  const ct = leer('contratistas.html');
  ok('contratistas: el ingreso exige empresa al día, verificación en sitio y firma, y solo autoriza a personas habilitadas', /empresaMal/.test(ct) && /chInd[\s\S]*chEpp/.test(ct) && /Falta la firma de quien autoriza/.test(ct) && /Habilitacion\.revisar\(p\.cedula, ing\.tareas\)/.test(ct));
  ok('contratistas: el nombre de la empresa se compara sin "S.A.S.", tildes ni signos', /s\\\.\?a\\\.\?s/.test(ct));
  ok('inicio: tarjetas de Contratistas y Usuarios; módulos apagables', /href="contratistas\.html"/.test(leer('index.html')) && /href="usuarios\.html"/.test(leer('index.html')) && /'contratistas\.html': 'contratistas', 'usuarios\.html': 'usuarios'/.test(leer('empresa.js')));
  ok('la demo trae usuarios ficticios para probar cada rol', /demoUsuarios/.test(leer('demo/empresa-demo.js')) && /EMPRESA\.demoUsuarios/.test(c));
  ok('servidor único: respaldo de TODOS los libros y activador semanal', /function librosDelPortal_\(\)/.test(leer('herramientas/servidor-unico-portal.gs')) && /instalarRespaldo\(true\)/.test(leer('herramientas/servidor-unico-portal.gs')) && /WeekDay: ScriptApp\.WeekDay/.test(leer('herramientas/servidor-unico-portal.gs')));
  // Demo: la semilla trae usuarios, contratistas y adjuntos
  const sem = JSON.parse(leer('demo/semilla.json')), est = sem.estado || sem;
  const libro = Object.values(est.libros).find((l) => l.hojas.Usuarios);
  ok('demo: semilla con usuarios (3), contratistas, ingresos y archivos adjuntos', libro && libro.hojas.Usuarios.length === 4 && libro.hojas.Contratistas && libro.hojas['Ingresos de contratistas'] && Object.keys(est.archivos || {}).length >= 6);
  ok('demo: en la semilla no quedan claves ni el código de administrador', !/Demo2026|Temporal1/.test(JSON.stringify(est)) && !Object.keys(est.propiedades).some((k) => /CODIGO_ADMIN/.test(k)));
});

grupo('EPP, inducción, programas de alto riesgo y PESV (v95): servidor', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v95.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const mas = (n) => { const d = new Date(hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // Inducción aprobada → Personal habilitado al día (aunque la persona no existiera)
  P({ action: 'guardar', tipo: 'induccion', id: 'IND-1', doc: { tipoInduccion: 'Inducción', fecha: hoy, nombre: 'Nuevo Ingreso', cedula: '1.234.567', cargo: 'Ayudante', resultado: 'APROBADA', puntaje: 90, vence: mas(364), temas: ['a', 'b'] }, opId: 'i1' });
  const t = G({ id: 'TRB-1234567' }).doc;
  ok('inducción aprobada: crea a la persona en Personal habilitado con la inducción al día', t && t.nombre === 'Nuevo Ingreso' && t.requisitos.induccion.fecha === hoy && t.requisitos.induccion.vence === mas(364) && t.requisitos.induccion.fuente === 'IND-1');
  P({ action: 'guardar', tipo: 'induccion', id: 'IND-0', doc: { tipoInduccion: 'Inducción', fecha: mas(-400), nombre: 'Nuevo Ingreso', cedula: '1234567', resultado: 'APROBADA', vence: mas(-36) }, opId: 'i0' });
  P({ action: 'guardar', tipo: 'induccion', id: 'IND-2', doc: { tipoInduccion: 'Reinducción anual', fecha: hoy, nombre: 'Otro', cedula: '999', resultado: 'REPROBADA', puntaje: 50 }, opId: 'i2' });
  ok('una inducción más vieja no pisa la vigente, y una reprobada no habilita', G({ id: 'TRB-1234567' }).doc.requisitos.induccion.fecha === hoy && G({ id: 'TRB-999' }).ok === false);
  // Con usuarios: un supervisor registra la inducción aunque no pueda editar el personal
  const codigo = E.ctx.codigoAdministrador();
  const crypto = require('crypto'), sal = crypto.randomBytes(16).toString('hex'), pr = (c, sl) => crypto.pbkdf2Sync(c, Buffer.from(sl, 'hex'), 100000, 32, 'sha256').toString('base64');
  const adm = P({ action: 'primerAdmin', codigo, usuario: 'adm', nombre: 'Admin', salt: sal, iter: 150000, pruebaNueva: pr('Clave1234', sal) });
  const s2 = crypto.randomBytes(16).toString('hex');
  P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'sup', nombre: 'Sup', rol: 'supervisor', salt: s2, iter: 150000, pruebaNueva: pr('Temp1234', s2) });
  const e = P({ action: 'entrar', usuario: 'sup', prueba: pr('Temp1234', s2) }), s3 = crypto.randomBytes(16).toString('hex');
  const sup = P({ action: 'cambiarMiClave', sesion: e.sesion, prueba: pr('Temp1234', s2), salt: s3, iter: 150000, pruebaNueva: pr('Nueva1234', s3) }).sesion;
  ok('supervisor: no puede editar Personal habilitado directamente', P({ action: 'parche', tipo: 'trabajador', id: 'TRB-555', campos: { nombre: 'X' }, sesion: sup }).codigoError === 'PERMISO');
  const ri = P({ action: 'guardar', tipo: 'induccion', id: 'IND-3', doc: { tipoInduccion: 'Inducción de contratista', fecha: hoy, nombre: 'Contratista Uno', cedula: '555', empresa: 'Andamios SAS', resultado: 'APROBADA', puntaje: 100, vence: mas(364) }, sesion: sup, opId: 'i3' });
  ok('…pero sí registra la inducción, y el servidor deja al día su habilitación', ri.ok && G({ id: 'TRB-555', sesion: adm.sesion }).doc.requisitos.induccion.fecha === hoy && G({ id: 'TRB-555', sesion: adm.sesion }).doc.empresa === 'Andamios SAS');
  ok('el supervisor registra entregas de EPP y siniestros viales; no cambia el PESV', P({ action: 'guardar', tipo: 'entrega', id: 'ENT-X', doc: { nombre: 'A', cedula: '1', fecha: hoy, motivo: 'Ingreso' }, sesion: sup, opId: 'ex' }).ok &&
     P({ action: 'guardar', tipo: 'siniestro', id: 'SIN-X', doc: { fecha: hoy, placa: 'ABC123', descripcion: 'x' }, sesion: sup, opId: 'sx' }).ok && P({ action: 'guardar', tipo: 'pesv', id: 'PESV-EMPRESA', doc: { nivel: 'Básico' }, sesion: sup, opId: 'px' }).codigoError === 'PERMISO');
  // EPP: reposición por persona y elemento (cuenta la última entrega)
  const S = adm.sesion;
  P({ action: 'guardar', tipo: 'entrega', id: 'ENT-1', doc: { nombre: 'Luis Pérez', cedula: '1010', fecha: mas(-200), motivo: 'Ingreso', elementosTexto: 'Casco, Guantes', vencimientos: 'Casco|' + mas(100) + '; Guantes de vaqueta|' + mas(-170), reponer: mas(-170) }, sesion: S, opId: 'e1' });
  P({ action: 'guardar', tipo: 'entrega', id: 'ENT-2', doc: { nombre: 'Luis Pérez', cedula: '1010', fecha: mas(-20), motivo: 'Reposición por desgaste', elementosTexto: 'Guantes', vencimientos: 'Guantes de vaqueta|' + mas(10), reponer: mas(10) }, sesion: S, opId: 'e2' });
  P({ action: 'guardar', tipo: 'entrega', id: 'ENT-3', doc: { nombre: 'Ana Ruiz', cedula: '2020', fecha: mas(-400), motivo: 'Ingreso', elementosTexto: 'Botas', vencimientos: 'Botas de seguridad|' + mas(-215), reponer: mas(-215) }, sesion: S, opId: 'e3' });
  const largo = 'X'.repeat(600);
  P({ action: 'guardar', tipo: 'eppcargo', id: 'EPC-1', doc: { cargo: 'Soldador', elementosTexto: largo, elementos: [{ elemento: 'Casco' }] }, sesion: S, opId: 'm1' });
  ok('matriz de EPP: el texto de los elementos no se corta a 200 caracteres en la lista', G({ action: 'list', tipo: 'eppcargo', sesion: S }).rows[0].resumen.elementosTexto.length === 600);
  // Vehículos y conductores
  P({ action: 'guardar', tipo: 'vehiculo', id: 'VEH-1', doc: { placa: 'ABC123', tipoVehiculo: 'Camioneta', soat: mas(-3), rtm: mas(100), venceDocs: mas(-3), estado: 'ACTIVO' }, sesion: S, opId: 'v1' });
  P({ action: 'guardar', tipo: 'vehiculo', id: 'VEH-2', doc: { placa: 'XYZ999', soat: mas(-30), venceDocs: mas(-30), estado: 'INACTIVO' }, sesion: S, opId: 'v2' });
  P({ action: 'guardar', tipo: 'conductor', id: 'CON-1', doc: { nombre: 'Jorge', cedula: '80', venceLicencia: mas(8), vence: mas(8), estado: 'ACTIVO' }, sesion: S, opId: 'c1' });
  P({ action: 'guardar', tipo: 'programa', id: 'PRG-ALTURAS', doc: { programa: 'alturas', nombre: 'Protección contra caídas', cumplimiento: 80, proximaRevision: mas(-1), estado: 'ACTIVO' }, sesion: S, opId: 'pg1' });
  E.correos.length = 0; E.ctx.avisoDiario();
  const c = E.correos.length ? String(E.correos[0][2]) : '';
  ok('aviso diario: reponer EPP solo con la ÚLTIMA entrega de cada elemento (guantes repuestos no salen vencidos; botas sí)', /Reponer EPP: Guantes de vaqueta de Luis Pérez \(vence/.test(c) && !/Guantes de vaqueta de Luis Pérez \(venció/.test(c) && /Reponer EPP: Botas de seguridad de Ana Ruiz \(venció/.test(c));
  ok('aviso diario: SOAT vencido (no de vehículos inactivos), licencia por vencer y revisión del programa', /Documentos del vehículo.*ABC123/.test(c) && !/XYZ999/.test(c) && /Requisitos del conductor.*Jorge/.test(c) && /Revisar el programa: Protección contra caídas/.test(c));
  ok('aviso diario: la reinducción vencida no sale si ya hay una más reciente', !/Reinducción en SST: Nuevo Ingreso \(venció/.test(c));
  ok('hojas legibles nuevas', ['Matriz de EPP', 'Entregas de EPP', 'Inducciones y reinducciones', 'Vehículos', 'Conductores', 'Siniestros viales', 'Programas de alto riesgo'].every((h) => E.hojas[h]));
  fs.unlinkSync(tmp);
});

grupo('EPP, inducción, programas y PESV (v95): pantallas', () => {
  ['entrega-epp.html', 'induccion.html', 'programas.html', 'pesv.html'].forEach((f) => ok(f + ': en el inicio, la caché y los módulos apagables', new RegExp('href="' + f.replace('.', '\\.') + '"').test(leer('index.html')) && leer('sw.js').includes("'./" + f + "'") && leer('empresa.js').includes("'" + f + "'")));
  const ep = leer('entrega-epp.html'), ind = leer('induccion.html');
  ok('EPP: la entrega exige firma y calcula la reposición con la vida útil de cada elemento', /Falta la firma de quien recibe/.test(ep) && /Festivos\.sumarMeses\(f, v\)/.test(ep) && /const vidaDe = /.test(ep));   // v148: o desde la fabricación si es más temprano
  ok('EPP: los nombres de elementos no rompen el formato de reposición ("|" y ";")', /replace\(\/\[;\|\]\/g/.test(ep));
  ok('inducción: la evaluación se califica en el celular, exige responder todo y aprueba con la nota de empresa.js', /Faltan ' \+ sin \+ ' pregunta/.test(ind) && /CFG_IND\.aprueba/.test(leer('induccion-banco.js')) && /<script src="induccion-banco\.js"><\/script>/.test(ind) &&/resultado: visitante\(\) \? 'REALIZADA' : aprobada \? 'APROBADA' : 'REPROBADA'/.test(ind));
  ok('PESV: nivel según misionalidad (Res. 40595, tabla 1) y pasos por nivel', /m1 \? \(v > 50 \? 3/.test(leer('pesv.html')) && /aplicaPaso/.test(leer('pesv.html')) && (leer('pesv.html').match(/\['(Planear|Hacer|Verificar|Actuar)', '[^']+', '[BEA]'\]/g) || []).length === 24);
  ok('programas: lo que no se cumple se vuelve acción (una sola vez por requisito)', /accionesPor/.test(leer('programas.html')) && /!creadas\[i\]/.test(leer('programas.html')));
  ok('autoevaluación: pistas de inducción (1.2.2) y EPP (4.2.6)', /pistas\['4\.2\.6'\]/.test(leer('auditorias.html')) && /induccion,entrega,eppcargo/.test(leer('auditorias.html')));
});

grupo('Tablero, reporte anual, ambiental y RUC (v96)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v96.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const hoyReal = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10), anio = hoyReal.slice(0, 4);
  P({ action: 'guardar', tipo: 'aspecto', id: 'ASP-1', doc: { proceso: 'Taller', aspecto: 'Residuos peligrosos', impacto: 'Suelo', valor: 18, significancia: 'SIGNIFICATIVO', fechaRevision: hoyReal }, opId: 'a1' });
  P({ action: 'guardar', tipo: 'residuo', id: 'RES-1', doc: { fecha: hoyReal, mes: hoyReal.slice(0, 7), clase: 'Peligroso (RESPEL)', corriente: 'Trapos', cantidad: 12, unidad: 'kg' }, opId: 'r1' });
  ok('ambiental: hojas "Aspectos e impactos ambientales", "Residuos" y "Consumos"', !!E.hojas['Aspectos e impactos ambientales'] && !!E.hojas.Residuos && P({ action: 'guardar', tipo: 'consumo', id: 'CNS-1', doc: { mes: '2026-09', agua: 10 }, opId: 'c1' }).ok && !!E.hojas.Consumos);
  // Recordatorio del reporte anual desde el 15 de noviembre
  const avisoEn = (fecha) => { const D0 = E.ctx.Date; const fijo = new D0(fecha + 'T12:00:00-05:00').getTime();
    E.ctx.Date = class extends D0 { constructor(...a) { if (a.length) super(...a); else super(fijo); } static now() { return fijo; } };
    E.correos.length = 0; try { E.ctx.avisoDiario(); } finally { E.ctx.Date = D0; } return E.correos.length ? String(E.correos[0][2]) : ''; };
  ok('reporte anual: antes del 15 de noviembre no recuerda; después sí, hasta que se registre', !/Estándares mínimos/.test(avisoEn(anio + '-10-20')) && /Estándares mínimos \d{4}: registrar la autoevaluación/.test(avisoEn(anio + '-11-20')));
  P({ action: 'guardar', tipo: 'reporteanual', id: 'RAN-' + anio, doc: { anio, fechaRegistro: anio + '-11-21', estado: 'REGISTRADO' }, opId: 'ra1' });
  ok('reporte anual registrado: ya no se recuerda, y queda en su hoja', !/Estándares mínimos/.test(avisoEn(anio + '-11-25')) && !!E.hojas['Reporte anual 0312']);
  const pl = leer('auditorias-plantillas.js'), au = leer('auditorias.html');
  ok('auditorías: plantilla ISO 14001 por capítulos y RUC vacía para pegar la guía vigente (no se inventan numerales)', /ISO14001: \{/.test(pl) && /RUC: \{[\s\S]{0,400}pegar: true,\s*items: \[\]/.test(pl));
  ok('auditorías: pegar lista desde Excel y calificación ponderada (NA no cuenta)', /function pegarLista\(\)/.test(au) && /i\.r && i\.r !== 'NA'/.test(au));
  const ge = leer('gerencia.html');
  ok('tablero: exámenes solo en cantidad y reservado para roles que no son SST', /'🔒', 'reservado'/.test(ge) && /Solo cantidades: sin nombres ni diagnósticos/.test(ge));
  ok('tablero: paquete del reporte anual con estándares, plan de mejoramiento e indicadores del art. 30', /REPORTE ANUAL DE ESTÁNDARES MÍNIMOS/.test(ge) && /PLAN DE MEJORAMIENTO/.test(ge) && /INDICADORES MÍNIMOS \(RES\. 0312, ART\. 30\)/.test(ge));
  ok('ambiental: categoría de generador RESPEL con la media de 6 meses', /media >= 1000 \? 'Gran generador' : media >= 100 \? 'Mediano generador' : media >= 10 \? 'Pequeño generador'/.test(leer('ambiental.html')));
  ['gerencia.html', 'ambiental.html'].forEach((f) => ok(f + ': en el inicio, la caché y los módulos apagables', leer('index.html').includes('href="' + f + '"') && leer('sw.js').includes("'./" + f + "'") && leer('empresa.js').includes("'" + f + "'")));
  fs.unlinkSync(tmp);
});

grupo('Panel del asesor y estándares 7 / 21 / 60 (v97)', () => {
  const vm = require('vm'), c = {}; vm.createContext(c);
  vm.runInContext(leer('auditorias-plantillas.js') + ';this.P = PLANTILLAS_AUDITORIA; this.g = grupo0312;', c);
  ok('segmento: ≤10 y riesgo I-III → 7; 11-50 → 21; >50 o riesgo IV/V → 60', c.g(10, 'III') === 7 && c.g(11, 'I') === 21 && c.g(50, 'II') === 21 && c.g(51, 'I') === 60 && c.g(3, 'IV') === 60 && c.g(40, 'V') === 60);
  ok('plantillas de 7 (art. 3) y 21 (art. 9) estándares, cada uno con su numeral de los 60', c.P.RES0312_7.items.length === 7 && c.P.RES0312_21.items.length === 21 && c.P.RES0312_21.items.every((i) => c.P.RES0312.items.some((x) => x[0] === i[0])));
  ok('en los grupos de 7 y 21 cada estándar pesa lo mismo y suman 100', Math.round(c.P.RES0312_7.items.reduce((a, i) => a + i[3], 0)) === 100 && Math.round(c.P.RES0312_21.items.reduce((a, i) => a + i[3], 0)) === 100);
  ok('los 21 incluyen COPASST, convivencia, brigada y revisión por la dirección; los 7 no', ['1.1.6', '1.1.8', '5.1.2', '6.1.3'].every((k) => c.P.RES0312_21.items.some((i) => i[0] === k)) && !c.P.RES0312_7.items.some((i) => i[0] === '1.1.6'));
  ok('tablero, revisión y autoevaluación reconocen las tres variantes de la 0312', ['auditorias.html', 'gerencia.html', 'revision-direccion.html'].every((f) => !/plantilla === 'RES0312'/.test(leer(f))));
  const a = leer('asesor.html');
  ok('asesor: la clave de cada cliente queda en el registro (no en la lista) y solo la leen Administrador y SST', /'cliente', 'habeas'(, 'reintegro')?\];/.test(leer('backends/backend-sgsst.gs')) && !/'clave'/.test((/cliente: \{ hoja[^\n]*\n[^\n]*/.exec(leer('backends/backend-sgsst.gs')) || [''])[0]));
  ok('asesor: las tareas van al plan de acción del cliente con origen «Asesor SST» y se verifican', /const ORIGEN = 'Asesor SST'/.test(a) && /verificada: \{ fecha: UI\.hoy\(\), por: yo\(\)/.test(a));
  ok('asesor: si el cliente usa usuarios, pide entrar con su usuario y reintenta', /codigoError === 'SESION' && await this\.pedir/.test(a));
  ok('asesor: tareas de los estándares sin repetir las que ya están abiertas', /ya tiene tarea abierta/.test(a));
  ok('cliente: el plan de acción avisa de las tareas del asesor y muestra la verificación', /Tu asesor de SST te dejó/.test(leer('plan-accion.html')) && /Verificada por el asesor/.test(leer('plan-accion.html')));
  ok('asesor.html en la consola del administrador (no en el inicio de los clientes), la caché y los módulos', !leer('index.html').includes('href="asesor.html"') && leer('admin.html').includes('href="asesor.html"') && leer('sw.js').includes("'./asesor.html'") && leer('sw.js').includes("'./admin.html'") && leer('empresa.js').includes("'asesor.html'"));
});

grupo('Sustancias químicas, inspecciones flexibles y correos a clientes (v98)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v98.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const G = (o) => E.get(Object.assign({ token: T }, o));
  const hoyReal = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10), anio = hoyReal.slice(0, 4);
  // Sustancias: el resumen trae lo del SGA y la gestión química tiene su hoja
  P({ action: 'guardar', tipo: 'sustancia', id: 'SUS-1', doc: { nombre: 'Thinner', ubicacion: 'Bodega', pictogramas: ['Inflamable', 'Irritante / nocivo'], palabra: 'Peligro', etiquetaSGA: 'Conforme al SGA', hojaSeguridad: 'Sí', fechaHoja: '2024-01-10', venceHoja: '2029-01-10', estado: 'En uso', corrosivoTipo: '' }, opId: 's1' });
  const ls = G({ action: 'list', tipo: 'sustancia' }).rows[0];
  ok('sustancia: el resumen trae pictogramas, palabra de advertencia y etiqueta (para la compatibilidad sin abrir cada una)', ls && ls.resumen.pictogramas === 'Inflamable, Irritante / nocivo' && ls.resumen.palabra === 'Peligro' && ls.resumen.etiquetaSGA === 'Conforme al SGA' && ls.resumen.ubicacion === 'Bodega');
  const hs = E.hojas['Sustancias químicas'];
  hs.filas[0] = ['id', 'nombre', 'fabricante', 'uso', 'ubicacion', 'cantidad', 'pictogramas', 'carcinogena', 'toxicidadAguda', 'hojaSeguridad', 'fechaHoja', 'venceHoja', 'estado', 'actualizado'];   // hoja de la v97
  hs.filas[1] = ['SUS-1', 'Thinner', '', '', 'Bodega'];
  P({ action: 'guardar', tipo: 'sustancia', id: 'SUS-2', doc: { nombre: 'Acetona', ubicacion: 'Bodega', estado: 'En uso' }, opId: 's2' });
  ok('hoja legible de una versión anterior: se rehace con las columnas nuevas, sin duplicar filas', hs.filas[0].includes('palabra') && hs.filas[0].indexOf('ubicacion') === 5 && hs.filas.filter((f) => f[0] === 'SUS-1').length === 1 && hs.filas.filter((f) => f[0] === 'SUS-2').length === 1 && hs.filas.find((f) => f[0] === 'SUS-1')[5] === 'Bodega');
  ok('gestión química: hoja propia y la capacitación anual en SGA entra al correo diario', P({ action: 'guardar', tipo: 'gestquim', id: 'QUIMICOS-GESTION', doc: { capacitacionSGA: '2025-01-01', proximaCapacitacion: '2026-01-01' }, opId: 'g1' }).ok && !!E.hojas['Gestión del riesgo químico'] && /AVISO_GEN = \{[\s\S]*gestquim: 'Capacitación anual en el SGA/.test(leer('backends/backend-sgsst.gs')));
  // Listas de chequeo propias: las preguntas viajan completas en el resumen (hasta 6.000 caracteres)
  const items = Array.from({ length: 40 }, (_, i) => 'Pregunta número ' + (i + 1) + ' de la lista de chequeo de la cocina y el comedor');
  P({ action: 'guardar', tipo: 'plantillainsp', id: 'PLI-1', doc: { nombre: 'Cocina', items, itemsTexto: items.join('\n'), activa: true }, opId: 'p1' });
  const lp = G({ action: 'list', tipo: 'plantillainsp' }).rows[0];
  ok('lista de chequeo propia: sus ' + items.length + ' preguntas llegan completas en la lista (sirve sin señal)', lp && lp.resumen.itemsTexto.split('\n').length === 40 && !/…$/.test(lp.resumen.itemsTexto));
  ok('la lista trae la fecha de creación de cada registro (para el cronograma)', !!lp.creado);
  // Inspección gerencial con participantes y su lugar en el programa
  P({ action: 'guardar', tipo: 'proginsp', id: 'PIN-1', doc: { anio: Number(anio), titulo: 'Planta', tipoInspeccion: 'Gerencial', plantilla: 'locativa', meses: Array.from({ length: 12 }, (_, i) => anio + '-' + String(i + 1).padStart(2, '0')).concat([(Number(anio) + 1) + '-01']), activo: true }, opId: 'pi1' });
  P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-G1', doc: { categoria: 'Locativa', plantilla: 'locativa', fecha: hoyReal, items: [{ t: 'Orden', r: 'C' }], tipoInspeccion: 'Gerencial', participantes: [{ nombre: 'Gerente' }, { nombre: 'SST' }], progId: 'PIN-1', inspector: { nombre: 'Gerente' } }, opId: 'ig1' });
  const li = G({ action: 'list', tipo: 'inspeccion' }).rows.find((x) => x.id === 'INS-G1');
  ok('inspección gerencial: el resumen trae tipo, participantes y a qué programada corresponde', li && li.resumen.tipoInspeccion === 'Gerencial' && li.resumen.participantes === 2 && li.resumen.progId === 'PIN-1');
  const avisoEn = (fecha) => { const D0 = E.ctx.Date; const fijo = new D0(fecha + 'T12:00:00-05:00').getTime();
    E.ctx.Date = class extends D0 { constructor(...a) { if (a.length) super(...a); else super(fijo); } static now() { return fijo; } };
    E.correos.length = 0; try { E.ctx.avisoDiario(); } finally { E.ctx.Date = D0; } return E.correos.map((c) => c.slice(0, 3).join(' | ')).join('\n'); };
  const mesSig = (() => { const d = new Date(hoyReal + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1, 21); return d.toISOString().slice(0, 10); })();
  const mesHoy = hoyReal.slice(0, 8) + '21';
  ok('programa de inspecciones: el día 20 avisa la gerencial del mes sin hacer y no la que ya se hizo', (mesSig.slice(0, 4) !== anio || /Inspección gerencial de \d{4}-\d{2} sin hacer: Planta/.test(avisoEn(mesSig))) && !/Inspección gerencial de [\d-]+ sin hacer/.test(avisoEn(mesHoy)));
  // Tareas del asesor: correo al responsable (del perfil), copia al asesor; aviso al asesor cuando la cierran
  P({ action: 'guardar', tipo: 'empresa', id: 'EMPRESA-PERFIL', doc: { nombre: 'Cliente S.A.S.', trabajadores: 8, claseRiesgo: 'I', grupo0312: 7, correoSST: 'resp@cliente.invalid', correoAsesor: 'asesor@consultor.invalid' }, opId: 'e1' });
  E.correos.length = 0;
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-AS0', doc: { origen: 'Asesor SST', accion: 'Con el token de fábrica', responsable: 'Laura', estado: 'ABIERTA', asignadaPor: 'X' }, versionBase: 0, opId: 'as0' });
  ok('con el token de fábrica (público) no sale ningún correo de tareas', E.correos.length === 0);
  E.propiedades.CLAVE_PORTAL = 'clave-del-cliente';
  const P2 = (o) => E.post(Object.assign({}, o, { token: 'clave-del-cliente' }));
  P2({ action: 'guardar', tipo: 'accion', id: 'ACC-AS00', doc: { origen: 'Asesor SST', accion: 'Sin quién la asignó (desde el plan de acción)', responsable: 'Laura', estado: 'ABIERTA' }, versionBase: 0, opId: 'as00' });
  ok('una acción con origen «Asesor SST» sin asesor que la asigne no manda correo', E.correos.length === 0);
  P2({ action: 'guardar', tipo: 'accion', id: 'ACC-AS1', doc: { origen: 'Asesor SST', accion: 'Firmar la política', responsable: 'Laura', fechaCompromiso: hoyReal, prioridad: 'Alta', estado: 'ABIERTA', asignadaPor: 'Carlos (asesor)', avisarA: 'atacante@x.invalid' }, versionBase: 0, opId: 'as1' });
  const c1 = E.correos[0] || [];
  ok('tarea nueva del asesor: correo al responsable del perfil con copia al asesor (nunca a correos que mande el celular)', E.correos.length === 1 && c1[0] === 'resp@cliente.invalid' && /Nueva tarea de tu asesor SST/.test(c1[1]) && (c1[3] || {}).cc === 'asesor@consultor.invalid' && !JSON.stringify(E.correos).includes('atacante'));
  E.correos.length = 0;
  P2({ action: 'guardar', tipo: 'accion', id: 'ACC-NO', doc: { origen: 'Inspección planeada', accion: 'Otra', responsable: 'X', estado: 'ABIERTA' }, versionBase: 0, opId: 'no1' });
  ok('las demás acciones no mandan correo al crearse', E.correos.length === 0);
  P2({ action: 'parche', tipo: 'accion', id: 'ACC-AS1', campos: { estado: 'CERRADA', cierre: { fecha: hoyReal, descripcion: 'Firmada y publicada', eficaz: 'Sí' } }, opId: 'as2' });
  ok('tarea del asesor cerrada: le llega al asesor para verificarla', E.correos.length === 1 && E.correos[0][0] === 'asesor@consultor.invalid' && /por verificar/.test(E.correos[0][1]));
  E.correos.length = 0;
  P2({ action: 'parche', tipo: 'accion', id: 'ACC-AS1', campos: { verificada: { fecha: hoyReal, por: 'Carlos' } }, opId: 'as3' });
  ok('verificarla (sigue cerrada) no repite el aviso', E.correos.length === 0);
  // Recordatorios: 3 días antes y el día siguiente al vencimiento (luego cada 7 días)
  const en = (n) => { const d = new Date(hoyReal + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  P2({ action: 'guardar', tipo: 'accion', id: 'ACC-AS2', doc: { origen: 'Asesor SST', accion: 'Matriz legal', responsable: 'Laura', fechaCompromiso: en(3), estado: 'ABIERTA', asignadaPor: 'Carlos' }, versionBase: 0, opId: 'as4' });
  const tareasEn = (f) => { avisoEn(f); return E.correos.filter((c) => /Tareas de tu asesor SST/.test(c[1])).map((c) => c[2]).join('\n'); };
  ok('recordatorio de tareas del asesor: 3 días antes y al día siguiente de vencer; los demás días no', /Vence el [\d-]+ \(en 3 días\): Matriz legal/.test(tareasEn(hoyReal)) && /VENCIDA hace 1 día\(s\)[\s\S]*Matriz legal/.test(tareasEn(en(4))) && !/Matriz legal/.test(tareasEn(en(5))) && /VENCIDA hace 8 día/.test(tareasEn(en(11))));
  // Lote: un solo correo al llegar la última
  E.correos.length = 0;
  for (let i = 1; i <= 4; i++) P2({ action: 'guardar', tipo: 'accion', id: 'ACC-L' + i, doc: { origen: 'Asesor SST', accion: 'Estándar ' + i, responsable: 'Laura', estado: 'ABIERTA', asignadaPor: 'Carlos', lote: 'L1', loteN: 4, loteI: i }, versionBase: 0, opId: 'l' + i });
  ok('tareas en lote: un solo correo con las 4', E.correos.length === 1 && /4 tareas nuevas/.test(E.correos[0][1]) && /Estándar 1[\s\S]*Estándar 4/.test(E.correos[0][2]));
  // Tope diario de correos inmediatos
  E.correos.length = 0;
  for (let i = 0; i < 35; i++) P2({ action: 'guardar', tipo: 'accion', id: 'ACC-T' + i, doc: { origen: 'Asesor SST', accion: 'T' + i, responsable: 'Laura', estado: 'ABIERTA', asignadaPor: 'Carlos' }, versionBase: 0, opId: 'tt' + i });
  ok('tope diario de correos de tareas (evita abusos con la clave del portal)', E.correos.length > 0 && E.correos.length <= 30);
  // Páginas
  const q = leer('quimicos.html'), ins = leer('inspecciones.html'), ip = leer('inspecciones-plantillas.js'), as = leer('asesor.html');
  ok('químicos: revisión de la ficha máximo cada 5 años (Res. 773, art. 18) y capacitación anual en SGA', /VIGENCIA_FDS_MESES = 60/.test(q) && /quedó a 5 años de su fecha/.test(q) && /mínimo una vez al año/.test(q));
  ok('químicos: compatibilidad por lugar de almacenamiento, inflamable con comburente NO, ácidos con bases NO', /INF: \{ INF: 'S', COM: 'N'/.test(q) && /if \(ta && tb && ta !== tb\) subir\('N', 'ACIDO-BASE'\)/.test(q));
  ok('químicos: acciones de lo que falta sin repetir las abiertas', /ya\(x\.id, hall\)/.test(q) && /origen: 'Sustancias químicas'/.test(q) && leer('sgsst-ui.js').includes("'Sustancias químicas'"));
  ok('inspecciones: listas ajustables (la ajustada toma el lugar de la original con el mismo id) y propias', /if \(r\.reemplaza\)/.test(ip) && /id: r\.reemplaza, origen: 'ajustada'/.test(ip) && /function editarLista/.test(ins));
  ok('inspecciones: la lista se copia al empezar (no cambia si se recargan las listas)', /p: Object\.assign\(\{\}, p, \{ items: its \}\)/.test(ins) && /const its = p\.items\.concat\(/.test(ins));
  ok('inspecciones: gerenciales y del COPASST exigen participantes con firma', /CON_PARTICIPANTES = \['Gerencial', 'COPASST'\]/.test(ip) && /anota a los participantes/.test(ins) && /UI\.padHTML\('fPart_'/.test(ins));
  ok('inspecciones: cronograma anual programado frente a ejecutado con % de cumplimiento y PDF', /function cronograma\(anio\)/.test(ins) && /cumplimiento del cronograma/.test(ins) && /CRONOGRAMA DE INSPECCIONES/.test(ins));
  ok('inspecciones: nuevas listas de almacenamiento de químicos e instalaciones eléctricas', /id: 'quimicos'|"id":"quimicos"/.test(ip) && /id: 'electrica'|"id":"electrica"/.test(ip));
  ok('asesor: configura los correos en el perfil del cliente (su servidor los manda)', /function configurarCorreos/.test(as) && /tipo: 'empresa', id: 'EMPRESA-PERFIL', campos/.test(as));
  ok('quimicos.html en el inicio, la caché y los módulos apagables', leer('index.html').includes('href="quimicos.html"') && leer('sw.js').includes("'./quimicos.html'") && leer('empresa.js').includes("'quimicos.html'"));
  fs.unlinkSync(tmp);
});

grupo('Varias empresas en un sitio y actualización central (v99)', () => {
  const { execFileSync } = require('child_process'), os = require('os');
  // Un "clasp" de mentira: guarda los proyectos en carpetas y anota lo que se publica.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-')), remoto = path.join(base, 'remoto'), falso = path.join(base, 'clasp');
  fs.mkdirSync(remoto);
  fs.writeFileSync(falso, '#!/usr/bin/env node\n' + `
const fs = require('fs'), path = require('path'); const R = ${JSON.stringify(remoto)}; const [cmd, ...a] = process.argv.slice(2); const cwd = process.cwd();
const log = (x) => fs.appendFileSync(path.join(R, 'log.txt'), x + '\\n');
if (cmd === 'clone') { const d = path.join(R, a[0]); if (!fs.existsSync(d)) { console.error('No existe el proyecto'); process.exit(1); } fs.readdirSync(d).forEach((f) => fs.copyFileSync(path.join(d, f), path.join(cwd, f))); fs.writeFileSync(path.join(cwd, '.clasp.json'), JSON.stringify({ scriptId: a[0] })); }
else if (cmd === 'push') { const id = JSON.parse(fs.readFileSync(path.join(cwd, '.clasp.json'))).scriptId, d = path.join(R, id); fs.readdirSync(d).forEach((f) => fs.unlinkSync(path.join(d, f))); fs.readdirSync(cwd).filter((f) => f !== '.clasp.json').forEach((f) => fs.copyFileSync(path.join(cwd, f), path.join(d, f))); log('push ' + id); }
else if (cmd === 'version') { const n = (fs.existsSync(path.join(R, 'n')) ? Number(fs.readFileSync(path.join(R, 'n'))) : 0) + 1; fs.writeFileSync(path.join(R, 'n'), String(n)); console.log('Created version ' + n + '.'); }
else if (cmd === 'redeploy') { log('redeploy ' + a.join(' ')); }
else { console.error('comando ' + cmd); process.exit(1); }`);
  fs.chmodSync(falso, 0o755);
  const proy = (id, archivos) => { fs.mkdirSync(path.join(remoto, id)); Object.keys(archivos).forEach((f) => fs.writeFileSync(path.join(remoto, id, f), archivos[f])); };
  proy('VIEJO', { 'appsscript.json': '{"timeZone":"America/Bogota","webapp":{"access":"ANYONE_ANONYMOUS"}}', '00-Portal.js': "const EMPRESA_NOMBRE = 'ACME S.A.S.';\nconst CORREOS_SSTA = ['sst@acme.invalid',\n  'gerencia@acme.invalid'];\nconst CONTACTO_EPP = { nombre: 'Laura', whatsapp: '+57 300 1' };\nfunction instalar() {}", '15-sgsst.js': '// viejo' });
  proy('NUEVO', { 'appsscript.json': '{}', '01-Empresa.js': "const EMPRESA_NOMBRE = 'BETA';\nconst CORREOS_SSTA = ['b@beta.invalid'];\nconst CONTACTO_EPP = { nombre: '', whatsapp: '' };", '00-Portal.js': '// viejo' });
  proy('RARO', { 'appsscript.json': '{}', 'Codigo.js': 'function hola() {}' });
  fs.writeFileSync(path.join(remoto, 'NUEVO', 'propio-Informes.js'), 'function mio() {}'); fs.writeFileSync(path.join(remoto, 'NUEVO', 'Extra.js'), 'function otro() {}');
  const lista = path.join(base, 'clientes.json');
  fs.writeFileSync(lista, JSON.stringify([{ codigo: 'acme', scriptId: 'VIEJO', servidor: 'https://script.google.com/macros/s/AKfyDEP1/exec' }, { codigo: 'beta', scriptId: 'NUEVO', servidor: 'https://script.google.com/macros/s/AKfyDEP2/exec' }, { codigo: 'raro', scriptId: 'RARO', servidor: 'https://script.google.com/macros/s/AKfyDEP3/exec' }]));
  let salida = '';
  try { salida = execFileSync('node', [path.join(RAIZ, 'herramientas/actualizar-servidores.js'), lista, '--sin-comprobar'], { env: Object.assign({}, process.env, { CLASP: falso }), encoding: 'utf8' }); } catch (e) { salida = String(e.stdout || '') + String(e.stderr || ''); }
  const L = (id, f) => fs.existsSync(path.join(remoto, id, f)) ? fs.readFileSync(path.join(remoto, id, f), 'utf8') : '';
  const v = (/const VERSION_PORTAL = '([^']+)'/.exec(leer('servidor-unico/00-Portal.gs')) || [])[1];
  ok('actualizador: un servidor de antes de la v99 queda con 01-Empresa armado con SUS datos (nombre, correos, WhatsApp)', /EMPRESA_NOMBRE = 'ACME S\.A\.S\.'/.test(L('VIEJO', '01-Empresa.js')) && /gerencia@acme\.invalid/.test(L('VIEJO', '01-Empresa.js')) && /Laura/.test(L('VIEJO', '01-Empresa.js')), salida);
  ok('actualizador: el resto del código se reemplaza por el de servidor-unico (y appsscript.json se conserva)', L('VIEJO', '00-Portal.js') === leer('servidor-unico/00-Portal.gs') && L('VIEJO', '15-sgsst.js') === leer('servidor-unico/15-sgsst.gs') && /ANYONE_ANONYMOUS/.test(L('VIEJO', 'appsscript.json')) && !/^const EMPRESA_NOMBRE/m.test(L('VIEJO', '00-Portal.js')));
  ok('actualizador: un 01-Empresa existente no se toca', L('NUEVO', '01-Empresa.js').includes("'BETA'") && L('NUEVO', '00-Portal.js') === leer('servidor-unico/00-Portal.gs'));
  const log = fs.readFileSync(path.join(remoto, 'log.txt'), 'utf8');
  ok('actualizador: publica en LA MISMA implementación (sale de la URL /exec), con versión nueva', /redeploy AKfyDEP1 \d+ Portal-v\d+/.test(log) && /redeploy AKfyDEP2 /.test(log));
  ok('actualizador: conserva los archivos «propio…» y avisa de los que quita', L('NUEVO', 'propio-Informes.js').includes('mio') && !L('NUEVO', 'Extra.js') && /se quitaron archivos que no son del portal: Extra\.js/.test(salida), salida);
  let s2 = ''; try { s2 = execFileSync('node', [path.join(RAIZ, 'herramientas/actualizar-servidores.js'), '--solo', 'nadie', lista], { env: Object.assign({}, process.env, { CLASP: falso }), encoding: 'utf8' }); } catch (e) { s2 = String(e.stdout || ''); }
  ok('actualizador: --solo con un código que no está lo dice y no toca nada (el orden de los argumentos da igual)', /No hay ninguna empresa con el código «nadie»/.test(s2), s2);
  ok('actualizador: lee el número de «Created version N» y usa descripciones sin espacios (Windows)', /Created version \(\\d\+\)\/i/.test(leer('herramientas/actualizar-servidores.js')) && /'Portal-' \+ version/.test(leer('herramientas/actualizar-servidores.js')));
  ok('actualizador: un proyecto que no es del portal no se sube y queda en el resumen', !/push RARO/.test(log) && /✗ .*No encontré los datos de la empresa/.test(salida) && /2 de 3 al día/.test(salida), salida);
  ok('versiones: sitio, enrutador y SG-SST dicen la misma (el panel del asesor las compara)', v && (/const VERSION_PORTAL_WEB = '([^']+)'/.exec(leer('common.js')) || [])[1] === v && (/const VERSION_SGSST = '([^']+)'/.exec(leer('backends/backend-sgsst.gs')) || [])[1] === v && leer('sw.js').includes("'ssta-portal-" + v + "'"));
  ok('servidor único: 01-Empresa.gs es lo único editable y 00-Portal ya no trae datos de la empresa', /const EMPRESA_NOMBRE/.test(leer('servidor-unico/01-Empresa.gs')) && !/^const EMPRESA_NOMBRE/m.test(leer('servidor-unico/00-Portal.gs')) && leer('demo/demo.js').includes("'01-Empresa.gs'"));
  fs.rmSync(base, { recursive: true, force: true });
  // Sitio multiempresa
  const em = leer('empresa.js'), ix = leer('index.html');
  ok('multiempresa: el código entra por ?e= y los datos salen de empresas/<código>.json', /searchParams|URLSearchParams\(location\.search\)\.get\('e'\)/.test(em) && /'empresas\/' \+ encodeURIComponent\(c\) \+ '\.json'/.test(em));
  ok('multiempresa: no cambia de empresa con registros sin enviar y al cambiar borra lo de la anterior en el equipo', /sin enviar\. Envíalos/.test(em) && em.includes('/^(ssta-|ats-)/.test(k)') && /ev\.key === 'ssta-empresa'/.test(em));
  ok('multiempresa: los datos de la empresa se guardan en el celular (abre sin señal) y el SW no los cachea', /ssta-empresa-datos/.test(em) && leer('sw.js').includes("'/empresas/'"));
  ok('multiempresa: el inicio pide el código (aclarando que no es contraseña) y deja cambiar de empresa', /¿De qué empresa eres\?/.test(ix) && /No es una contraseña/.test(ix) && /MultiEmpresa\.entrar/.test(ix));
  ok('multiempresa (v114): empresa principal del sitio y enlaces ?e= entran sin mostrar ventana; solo sale si falla', /empresaPorDefecto/.test(em) && /const automatico = !cod && !pedido && valido\(porDefecto\)/.test(em) && /MultiEmpresa\.pedido && !MultiEmpresa\.codigo\) \{\s*MultiEmpresa\.entrar\(MultiEmpresa\.pedido\)\.then/.test(ix));
  ok('multiempresa (v114): un sitio con su propio servidor funciona como su empresa, sin pedir código', /else if \(!pedido && E\.servidor && !E\.sinConfigurar\)/.test(em));
  ok('inicio (v114): el botón de la clave técnica no sale en la pantalla pública', /!Consola\.esEquipoAdmin\(\) && !ClavePortal\.tiene\(\)\) btnClave\.hidden = true/.test(ix) && /\.btn-clave\[hidden\]\{display:none;\}/.test(ix));
  ok('marca propia: "producto" reemplaza "Portal SSTA" en títulos y pies', /PRODUCTO !== 'Portal SSTA'\) reemplazos\.push\(\[\/Portal SSTA\/g, PRODUCTO\]\)/.test(em));
  const cf = leer('configurar-empresa.html');
  ok('configurador: «tu marca» parte de la configuración del proveedor (nunca de la empresa abierta) y no hereda sinEmpresa ni código', /const base = tipo === 'proveedor' && ME \? MultiEmpresa\.proveedor : E/.test(cf) && /producto: \$\('cProducto'\)\.value\.trim\(\) \|\| 'Portal SSTA', sinEmpresa: undefined, codigo: undefined/.test(cf) && /E\.codigo = cod; delete E\.sinEmpresa;/.test(em));
  {
    const vm = require('vm'), cx = { EMPRESA: { sinEmpresa: true, servidor: 'https://x/exec', apiToken: 'k' } }; vm.createContext(cx);
    vm.runInContext(leer('config.js').replace(/^const /gm, 'var '), cx);
    ok('sitio multiempresa sin empresa elegida: no habla con ningún servidor', cx.PORTAL_CONFIG.API_TOKEN === '' && Object.keys(cx.PORTAL_CONFIG.BACKENDS).every((k) => cx.PORTAL_CONFIG.BACKENDS[k].url === ''));
  }
  ok('multiempresa: logo y color de la empresa se validan al leer su archivo', /delete emp\.logo/.test(em) && /delete emp\.colorMarca/.test(em));
  ok('configurador (v114): «tu marca» define la empresa principal; no viaja en el JSON de un cliente', /id="cDefecto"/.test(cf) && /empresaPorDefecto: \$\('cDefecto'\)/.test(cf) && /delete emp\.empresaPorDefecto/.test(cf));
  ok('configurador: sitio propio, empresa dentro del sitio multiempresa (JSON + enlace + QR) o tu marca', /value="cliente"/.test(cf) && /value="proveedor"/.test(cf) && /function jsonCliente/.test(cf) && /QR\.dibujar/.test(cf));
});

grupo('Carga masiva desde Excel (v100)', () => {
  const vm = require('vm'), c = { UI: {}, SGSST: {} }; vm.createContext(c);
  vm.runInContext(leer('importar.js') + ';this.I = Importar;', c);
  const I = c.I;
  ok('lee lo pegado de Excel (tabuladores) y CSV con ; o , y comillas', I.leerTabla('a\tb\n1\t2').length === 2 && I.leerTabla('a;b\n"x; y";2')[1][0] === 'x; y' && I.leerTabla('﻿a,b\n"di ""hola""",3')[1][0] === 'di "hola"');
  ok('fechas: 15/03/2026, 2026-03-15, 15-03-26 y número de serie de Excel', I.fecha('15/03/2026') === '2026-03-15' && I.fecha('2026-3-5') === '2026-03-05' && I.fecha('15-03-26') === '2026-03-15' && I.fecha('46096') === '2026-03-15' && I.fecha('31/13/2026') === null && I.fecha('32/01/2026') === null && I.fecha('29/02/2027') === null && I.fecha('29/02/2028') === '2028-02-29');
  ok('números con coma decimal o punto de miles', I.numero('1.234,5') === 1234.5 && I.numero('12,5') === 12.5 && I.numero('7') === 7 && I.numero('x') === null && I.numero('1.500') === 1500 && I.numero('1.5') === 1.5);
  const cfg = { columnas: [{ k: 'nombre', l: 'Nombre completo', req: true }, { k: 'cedula', l: 'Cédula', req: true, sin: ['documento'] }, { k: 'activo', l: 'Activo', tipo: 'sino', def: true }, { k: 'f', l: 'Fecha', tipo: 'fecha' }, { k: 'tipo', l: 'Tipo', tipo: 'lista', op: ['Propio', 'Contratista'] }],
    id: (f) => 'TRB-' + f.cedula, existe: (id) => id === 'TRB-2', validar: () => '' };
  const a = I.analizar('Documento\tNOMBRE COMPLETO *\tTipo\tFecha\tOtra\n1\tAna\tpropio\t01/02/2026\tx\n2\tLuis\tcontratista\t\t\n3\t\tPropio\t\t\n1\tAna B\tPropio\t\t\n4\tEva\tsocio\t31/02x\t', cfg);
  ok('mapea títulos sin importar mayúsculas, tildes, * ni otros nombres; ignora columnas que no son', !a.error && a.ignoradas.join() === 'Otra', JSON.stringify(a.error || a.ignoradas));
  ok('vista previa: nuevas, las que actualizan, faltantes, repetidas y valores que no se entienden', a.filas[0].errores.length === 0 && a.filas[0].f.tipo === 'Propio' && a.filas[0].f.activo === true && a.filas[1].existe && a.filas[1].f.activo === '' && /Falta Nombre/.test(a.filas[2].errores.join()) && /Repetida con la fila 2/.test(a.filas[3].errores.join()) && a.filas[4].errores.length === 2, JSON.stringify(a.filas && a.filas.map((x) => x.errores)));
  ok('en un registro que ya existe, la celda vacía no borra ni pone el valor por defecto', JSON.stringify(I.soloLlenos({ nombre: 'Luis', cargo: '', activo: undefined, p: [], m: {}, n: 0, b: false }, true)) === '{"nombre":"Luis","n":0,"b":false}' && I.soloLlenos({ cargo: '' }, false).cargo === '');
  ok('importadores: los valores por defecto (activo, frecuencia, rutinaria…) solo en registros nuevos', /armar: \(f, existe\)=>/.test(leer('habilitacion.html')) && /armar: \(f, existe\)=>/.test(leer('inspecciones.html')) && /armar: \(f, existe\)=>/.test(leer('quimicos.html')) && /armar: \(f, existe\)=>/.test(leer('peligros.html')));
  ok('cédulas en notación científica de Excel (1,02E+09) se rechazan con la explicación', /notación científica/.test(leer('habilitacion.html')));
  ok('sin las columnas obligatorias lo dice antes de cargar', /No encuentro la\(s\) columna\(s\): Cédula/.test(I.analizar('Nombre completo\nAna', cfg).error || ''));
  ok('plantilla CSV con BOM y ; (abre bien en Excel en español)', /^﻿Nombre completo \*;Cédula \*;Activo/.test(I.plantillaCSV(cfg)));
  ok('ids estables: la misma fila vuelve al mismo registro', I.idDe('SUS', 'Thinner', 'Bodega') === I.idDe('SUS', 'THINNER ', 'bodega') && /^SUS-THINNER-[0-9A-Z]+$/.test(I.idDe('SUS', 'Thinner', 'Bodega')));
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  P({ action: 'parche', tipo: 'trabajador', id: 'TRB-111', campos: { nombre: 'Ana', cedula: '111', requisitos: { alturas: { fecha: '2026-01-01', vence: '2027-07-01' } } }, opId: 'x1' });
  const r = P({ action: 'guardarLote', items: [{ tipo: 'trabajador', id: 'TRB-111', campos: { cargo: 'Soldadora', requisitos: { induccion: { fecha: '2026-02-01', vence: '2027-02-01' } } } }, { tipo: 'trabajador', id: 'TRB-222', campos: { nombre: 'Luis', cedula: '222' } }, { tipo: 'accion', id: 'ACC-1', campos: { accion: 'x' } }], opId: 'lote1' });
  const d = E.get({ token: T, action: 'doc', id: 'TRB-111' }).doc;
  ok('lote: crea lo nuevo y en lo que existe cambia solo lo que trae (no borra otros requisitos)', r.ok && r.cargados === 2 && d.cargo === 'Soldadora' && d.requisitos.alturas.vence === '2027-07-01' && d.requisitos.induccion.fecha === '2026-02-01' && E.get({ token: T, action: 'doc', id: 'TRB-222' }).ok, JSON.stringify(r));
  const r2 = P({ action: 'guardarLote', items: [{ tipo: 'trabajador', id: 'TRB-111', campos: { cargo: 'Otro' } }], opId: 'lote1-rep' });
  P({ action: 'guardarLote', items: [{ tipo: 'trabajador', id: 'TRB-111', campos: { cargo: 'Tercero' } }, { tipo: 'trabajador', id: 'TRB-333', campos: { nombre: 'Eva', cedula: '333' } }], opId: 'lote1-rep' });
  ok('lote: si el celular repite un envío cortado, lo que ya quedó no se aplica dos veces', r2.ok && E.get({ token: T, action: 'doc', id: 'TRB-111' }).doc.cargo === 'Otro');
  ok('lote: solo tipos de carga masiva (no acciones ni reportes) y máximo 10 por envío (no bloquea a los demás)', /const LOTE = 8;/.test(leer('importar.js')) && !r.resultados[2].ok && !P({ action: 'guardarLote', items: Array.from({ length: 11 }, (_, i) => ({ tipo: 'legal', id: 'LEG-' + i, campos: { norma: 'x' } })), opId: 'lote2' }).ok);
  ['habilitacion.html', 'inspecciones.html', 'quimicos.html', 'documental.html', 'peligros.html'].forEach((f) => ok(f + ': botón «Cargar desde Excel» con importar.js', leer(f).includes('importar.js') && /Importar\.abrir\(/.test(leer(f))));
  ok('importar.js en la caché', leer('sw.js').includes("'./importar.js'"));
});

grupo('Kit documental (v101)', () => {
  const vm = require('vm'), c = {}; vm.createContext(c);
  vm.runInContext(leer('kit-documental.js') + ';this.K = KIT_DOCUMENTOS;', c);
  const K = c.K, ctx = { emp: 'ACME S.A.S.', nit: '900.1', act: 'montajes', trab: 8, riesgo: 'III', grupo: 7, ciudad: 'Bogotá', dir: 'Cra 1', arl: 'Positiva', sedes: '', rep: 'Ana Rep', repCc: '1', resp: 'Luis SST', respCc: '2', respLic: 'L-1', respCurso: '2025-01-01',
    fechaLarga: '4 de octubre de 2026', anio: '2026', peligros: [{ clase: 'Condiciones de seguridad', ejemplos: ['Caída <de> altura'] }], comite: 'Vigía de SST', comiteTxt: 'el Vigía de Seguridad y Salud en el Trabajo', cod: () => '' };
  const html = (id) => K.find((d) => d.id === id).generar(ctx).map((s) => s[0] + ' ' + s[1]).join(' ');
  ok('kit: ' + K.length + ' documentos, cada uno con formato, tipo y base legal', K.length >= 18 && K.every((d) => d.formato && d.tipo && d.norma && typeof d.generar === 'function'));
  ok('política con los tres compromisos del Decreto 1072 (peligros, mejora continua, normatividad) y los datos de la empresa', /Identificar los peligros, evaluar y valorar los riesgos/.test(html('POLITICA')) && /mejora continua/.test(html('POLITICA')) && /Cumplir la normatividad nacional vigente/.test(html('POLITICA')) && /ACME S\.A\.S\./.test(html('POLITICA')) && /Positiva/.test(html('POLITICA')));
  ok('el texto de la empresa va escapado (sin HTML inyectado)', /Caída &lt;de&gt; altura/.test(html('REGLAMENTO')) && !/Caída <de>/.test(html('REGLAMENTO')));
  ok('reglamento: toma los peligros de la matriz y avisa que se exige desde 10 trabajadores', /Condiciones de seguridad/.test(html('REGLAMENTO')) && /diez \(10\) o más trabajadores permanentes/.test(html('REGLAMENTO')) && /no es obligatorio/.test(html('REGLAMENTO')));
  ok('con menos de 10 trabajadores habla del Vigía, no del COPASST', /Vigía de SST/.test(html('ROLES')) && !/COPASST/.test(html('ROLES')) && !/COPASST/.test(html('POLITICA')));
  ok('investigación: 2 días hábiles para reportar y 15 días para investigar (Res. 1401 de 2007)', /dos \(2\) días hábiles/.test(html('PROC-INVESTIGACION')) && /quince \(15\) días/.test(html('PROC-INVESTIGACION')));
  ok('conservación de registros 20 años (art. 2.2.4.6.13) y médico sin diagnóstico (Res. 1843 de 2025)', /veinte \(20\) años/.test(html('PROC-DOCUMENTOS')) && /no recibe ni guarda el diagnóstico/.test(html('PROG-MEDICO')) && /1843 de 2025/.test(K.find((d) => d.id === 'PROG-MEDICO').norma));
  const pg = leer('documentos.html');
  ok('página: PDF, Word editable, aprobar en el listado maestro con versión y próxima revisión', /application\/msword/.test(pg) && /'DOC-KIT-' \+ d\.id/.test(pg) && /proximaRevision: Festivos\.sumarMeses\(UI\.hoy\(\), 12\)/.test(pg));
  ok('página: dice qué documentos pide su grupo de estándares (7, 21, 60)', /function aplica\(estandar\)/.test(pg) && /le aplica/.test(pg));
  ok('documentos.html en el inicio, la caché y los módulos; formatos en el configurador', leer('index.html').includes('href="documentos.html"') && leer('sw.js').includes("'./documentos.html'") && leer('empresa.js').includes("'documentos.html'") && leer('configurar-empresa.html').includes("'SG-PROC-INVESTIGACION'"));
});

grupo('Calidad ISO 9001 (v102)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v102.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp, { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const hoyReal = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  ['contextocal', 'riesgocal', 'objcal', 'pnc', 'pqrs', 'encuesta'].forEach((t) => ok('tipo ' + t + ' se guarda con su hoja legible', P({ action: 'guardar', tipo: t, id: t.toUpperCase() + '-1', doc: { cliente: 'X', producto: 'Y', objetivo: 'Z', descripcion: 'D', alcance: 'A', fecha: hoyReal, estado: 'ABIERTA' }, opId: 'c-' + t }).ok));
  P({ action: 'guardar', tipo: 'pqrs', id: 'PQR-V', doc: { cliente: 'Cliente Uno', tipoPQRS: 'Queja', fecha: '2026-01-02', fechaLimite: '2026-01-20', estado: 'ABIERTA' }, opId: 'pq1' });
  P({ action: 'guardar', tipo: 'pqrs', id: 'PQR-R', doc: { cliente: 'Cliente Dos', tipoPQRS: 'Queja', fecha: '2026-01-02', fechaLimite: '2026-01-20', estado: 'RESPONDIDA' }, opId: 'pq2' });
  // (fechas en el pasado frente a hoy: no se reemplaza Date, porque las fechas de la hoja dejarían de ser "Date")
  E.correos.length = 0; E.ctx.avisoDiario();
  const cuerpo = E.correos.map((c) => c[2]).join('\n');
  ok('correo diario: PQRS vencida sí, la ya respondida no', /Responder la PQRS: Cliente Uno/.test(cuerpo) && !/Cliente Dos/.test(cuerpo));
  fs.unlinkSync(tmp);
  const q = leer('calidad.html');
  ok('PQRS con plazo interno en días hábiles (configurable) y respuesta obligatoria para cerrar', /Festivos\.sumarHabiles\(v\.fecha \|\| UI\.hoy\(\), DIAS_PQRS\)/.test(q) && /Escribe la respuesta dada al cliente/.test(q));
  ok('satisfacción: promedio de 4 criterios a % y NPS (promotores − detractores)', /Math\.round\(prom \* 20\)/.test(q) && />= 9\).length - conNps\.filter\(\(x\)=> Number\(x\.resumen\.nps\) <= 6\)/.test(q));
  ok('riesgos y oportunidades P × I; los altos y los no conformes con acción correctiva van al plan con origen Calidad', /n >= 15 \? 'Alto'/.test(q) && /origen: 'Calidad'/.test(q) && leer('sgsst-ui.js').includes("'Calidad'"));
  ok('medir de nuevo un periodo ya medido lo corrige (con confirmación), no se pierde en silencio', /ya tiene una medición/.test(q) && /campos\.mediciones = d\.mediciones\.map/.test(q));
  ok('el plazo de la PQRS se mueve si cambia la fecha (si nadie lo cambió a mano) y una encuesta solo con NPS no baja la satisfacción', /v\.fechaLimite === v\.limiteAuto/.test(q) && /Number\(x\.resumen\.promedio\) > 0/.test(q));
  ok('objetivos de calidad con mediciones guardadas (agregar) y meta mayor o menor', /agregar: \{ mediciones:/.test(q) && /s\.sentido === 'menor'/.test(q));
  const vm = require('vm'), c = {}; vm.createContext(c); vm.runInContext(leer('auditorias-plantillas.js') + ';this.P = PLANTILLAS_AUDITORIA;', c);
  ok('auditoría ISO 9001:2015 por capítulos 4 a 10', c.P.ISO9001 && c.P.ISO9001.items.length >= 25 && c.P.ISO9001.items.some((i) => i[0] === '8.7'));
  ok('calidad.html en el inicio, la caché y los módulos', leer('index.html').includes('href="calidad.html"') && leer('sw.js').includes("'./calidad.html'") && leer('empresa.js').includes("'calidad.html'"));
});

grupo('Pendientes del mes y resumen del lunes (v105)', () => {
  const { crearEntorno } = require('./simulador-apps-script'), crypto = require('crypto');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v105.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp);   // fechas como texto: aquí se cambia la fecha de hoy y una fecha de hoja (Date) dejaría de reconocerse
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (q) => E.get(Object.assign({ token: T }, q));
  const en = (fecha, fn) => { const D0 = E.ctx.Date; const fijo = new D0(fecha + 'T12:00:00-05:00').getTime();
    E.ctx.Date = class extends D0 { constructor(...a) { if (a.length) super(...a); else super(fijo); } static now() { return fijo; } };
    try { return fn(); } finally { E.ctx.Date = D0; } };
  const anio = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 4), m = anio + '-03';
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-1', doc: { accion: 'Poner guarda al esmeril', responsable: 'Ana Pérez', fechaCompromiso: m + '-02', estado: 'ABIERTA' }, opId: 'a1' });
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-2', doc: { accion: 'Señalizar bodega', responsable: 'Luis Supervisor', fechaCompromiso: m + '-12', estado: 'ABIERTA' }, opId: 'a2' });
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-1', doc: { nombre: 'Pedro Gómez', cedula: '77', tipoExamen: 'Periódico', fecha: (Number(anio) - 1) + '-03-01', proxima: m + '-05' }, opId: 'x1' });
  P({ action: 'guardar', tipo: 'plananual', id: 'PAT-' + anio, doc: { anio, ejec: {}, actividades: [
    { uid: 'u1', ciclo: 'Hacer', actividad: 'Capacitación en alturas', tipo: 'Capacitación', meses: [3], responsable: 'Luis Supervisor', auto: '' },
    { uid: 'u2', ciclo: 'Hacer', actividad: 'Inspecciones planeadas', tipo: 'Inspección', meses: [3], responsable: 'Ana Pérez', auto: 'inspecciones' },
    { uid: 'u3', ciclo: 'Hacer', actividad: 'Simulacro', tipo: 'Emergencias', meses: [10], responsable: '', auto: 'simulacro' }] }, opId: 'p1' });
  P({ action: 'guardar', tipo: 'inspeccion', id: 'INS-1', doc: { categoria: 'Extintores', fecha: m + '-04', items: [] }, opId: 'i1' });
  const L = en(m + '-08', () => G({ action: 'pendientes' }));
  const txt = (L.items || []).map((x) => x.texto + ' | ' + x.nivel + ' | ' + x.responsable + ' | ' + x.modulo).join('\n');
  ok('pendientes: una sola lista con vencido y por vencer, responsable y el módulo que lo abre', L.ok && /Acción: Poner guarda al esmeril — Ana Pérez \| vencido \| Ana Pérez \| plan-accion\.html#ACC-1/.test(txt) && /Señalizar bodega .*\| pronto \| Luis Supervisor/.test(txt), txt);
  ok('pendientes: lo del plan anual de este mes que falta, con su responsable (lo que el portal detecta hecho no sale)', /Plan anual: Capacitación en alturas \| pronto \| Luis Supervisor \| plan-anual\.html/.test(txt) && !/Plan anual: Inspecciones planeadas/.test(txt) && !/Simulacro/.test(txt), txt);
  ok('pendientes: lo vencido va primero', L.items.length && L.items[0].nivel === 'vencido');
  const fin = en(m + '-28', () => G({ action: 'pendientes' })).items.map((x) => x.texto).join('\n');
  ok('fin de mes: pide los datos de indicadores y cerrar el mes', /Registrar los datos del mes para los indicadores/.test(fin) && /Cerrar el mes \d{4}-03/.test(fin), fin);
  const ini = en(anio + '-04-03', () => G({ action: 'pendientes' })).items, txtN = (l, n) => l.filter((x) => x.nivel === n).map((x) => x.texto).join('\n');
  ok('inicio de mes: lo del plan del mes pasado sin hacer sale vencido; cerrar el mes pasado, por hacer (hay 10 días)', /quedó sin hacer en \d{4}-03/.test(txtN(ini, 'vencido')) && /Falta cerrar el mes \d{4}-03/.test(txtN(ini, 'pronto')), JSON.stringify(ini.map((x) => [x.nivel, x.texto])));
  ok('después del día 10, el mes sin cerrar sale vencido (y sigue saliendo hasta que se cierre)', ['-04-12', '-04-28'].every((d) => /Falta cerrar el mes \d{4}-03/.test(txtN(en(anio + d, () => G({ action: 'pendientes' })).items, 'vencido'))));
  P({ action: 'guardar', tipo: 'cierremes', id: 'CIE-' + m, doc: { mes: m, fechaCierre: anio + '-04-02', estado: 'CERRADO' }, opId: 'c1' });
  ok('mes cerrado (tipo cierremes, con su hoja): ya no lo pide', !/Falta cerrar el mes \d{4}-03/.test(en(anio + '-04-03', () => G({ action: 'pendientes' })).items.map((x) => x.texto).join('\n')) && !!E.hojas['Cierres de mes']);
  P({ action: 'guardar', tipo: 'plananual', id: 'PAT-' + (Number(anio) + 1), doc: { anio: String(Number(anio) + 1), ejec: {}, actividades: [{ uid: 'z1', actividad: 'Actividad del plan borrado', meses: [1], responsable: 'Ana Pérez' }] }, opId: 'pb1' });
  const conPlan = en((Number(anio) + 1) + '-01-08', () => G({ action: 'pendientes' })).items.some((x) => /plan borrado/.test(x.texto));
  P({ action: 'borrar', id: 'PAT-' + (Number(anio) + 1), motivo: 'prueba', opId: 'pb2' });
  ok('un plan anual borrado ya no genera pendientes', conPlan && !en((Number(anio) + 1) + '-01-08', () => G({ action: 'pendientes' })).items.some((x) => /plan borrado/.test(x.texto)));
  const a2 = String(Number(anio) + 2);
  P({ action: 'guardar', tipo: 'plananual', id: 'PAT-' + a2, doc: { anio: a2, ejec: {}, actividades: [{ uid: 'i1', actividad: 'Medición de indicadores', meses: [5], auto: 'indicadores', responsable: 'Ana Pérez' }, { uid: 'i2', actividad: 'Otra del mes', meses: [5], responsable: 'Ana Pérez' }] }, opId: 'p2' });
  const fin5 = en(a2 + '-05-29', () => G({ action: 'pendientes' })).items.map((x) => x.texto);
  ok('la actividad del plan que ya tiene su propio pendiente (datos de indicadores) no sale dos veces', fin5.some((t) => /Registrar los datos del mes/.test(t)) && fin5.some((t) => /Plan anual: Otra del mes/.test(t)) && !fin5.some((t) => /Plan anual: Medición de indicadores/.test(t)), fin5.join(' | '));
  E.correos.length = 0; en(m + '-08', () => E.ctx.avisoDiario());
  const diario = E.correos.map((c) => c[2]).join('\n');
  ok('el correo diario sigue igual: vencimientos sí, tareas del plan no', /Acción: Poner guarda al esmeril — Ana Pérez \(venció \d{4}-03-02\)/.test(diario) && !/Plan anual/.test(diario), diario);
  // Con usuarios: cada quien lo suyo
  const sal = () => crypto.randomBytes(16).toString('hex'), prueba = (c, s) => crypto.pbkdf2Sync(c, Buffer.from(s, 'hex'), 100000, 32, 'sha256').toString('base64');
  const sA = sal(), adm = P({ action: 'primerAdmin', codigo: E.ctx.codigoAdministrador(), usuario: 'ana', nombre: 'Ana Pérez', salt: sA, iter: 150000, pruebaNueva: prueba('ClaveAna2026', sA), opId: 'u1' });
  const sT = sal(), pT = prueba('Temporal123', sT);
  P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'luis', nombre: 'Luis Supervisor', rol: 'supervisor', correo: 'luis@demo.invalid', salt: sT, iter: 150000, pruebaNueva: pT, opId: 'u2' });
  P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'ana', nombre: 'Ana Pérez', rol: 'admin', correo: 'ana@demo.invalid', opId: 'u3' });
  ok('con usuarios: sin sesión no se ven los pendientes', G({ action: 'pendientes' }).codigoError === 'SESION');
  const e1 = P({ action: 'entrar', usuario: 'luis', prueba: pT, opId: 'e1' }), sL = sal();
  const SL = P({ action: 'cambiarMiClave', sesion: e1.sesion, prueba: pT, salt: sL, iter: 150000, pruebaNueva: prueba('ClaveLuis2026', sL), opId: 'c2' }).sesion;
  const LS = en(m + '-08', () => G({ action: 'pendientes', sesion: SL }));
  ok('un supervisor no ve los pendientes de salud individual (exámenes); SST sí', LS.ok && !LS.items.some((x) => x.tipo === 'examen') && en(m + '-08', () => G({ action: 'pendientes', sesion: adm.sesion })).items.some((x) => x.tipo === 'examen'));
  E.correos.length = 0; en(m + '-09', () => E.ctx.avisoSemanal());
  const para = (c) => E.correos.filter((x) => x[0] === c).map((x) => x[2]).join('\n');
  ok('lunes: cada usuario recibe lo suyo de la semana (Luis: su acción y su actividad, no lo de Ana ni exámenes)', /Señalizar bodega/.test(para('luis@demo.invalid')) && /Capacitación en alturas/.test(para('luis@demo.invalid')) && !/esmeril/.test(para('luis@demo.invalid')) && !/Examen/.test(para('luis@demo.invalid')), E.correos.map((x) => x[0]).join(', '));
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-J', doc: { accion: 'Tarea de Juliana', responsable: 'Juliana Ríos', fechaCompromiso: m + '-10', estado: 'ABIERTA' }, opId: 'aj' });
  const sN = sal(); P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'nueva', nombre: 'Nueva SST', rol: 'sst', correo: 'nueva@demo.invalid', salt: sN, iter: 150000, pruebaNueva: prueba('Temporal999', sN), opId: 'u4' });
  const sA2 = sal(); P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'ana2', nombre: 'Ana', rol: 'supervisor', correo: 'ana2@demo.invalid', salt: sA2, iter: 150000, pruebaNueva: prueba('Temporal888', sA2), opId: 'u5' });
  const e2 = P({ action: 'entrar', usuario: 'ana2', prueba: prueba('Temporal888', sA2), opId: 'e2' }), sA3 = sal();
  P({ action: 'cambiarMiClave', sesion: e2.sesion, prueba: prueba('Temporal888', sA2), salt: sA3, iter: 150000, pruebaNueva: prueba('ClaveAna22026', sA3), opId: 'c3' });
  E.correos.length = 0; en(m + '-09', () => E.ctx.avisoSemanal());
  ok('lunes: quien tiene la clave temporal no recibe nada; «Ana» no recibe lo de «Juliana Ríos»', !E.correos.some((x) => x[0] === 'nueva@demo.invalid') && !/Juliana/.test(para('ana2@demo.invalid')), E.correos.map((x) => x[0]).join(', '));
  ok('lunes: administrador y SST reciben todo; CORREOS_AVISO también; nadie dos veces', /esmeril/.test(para('ana@demo.invalid')) && /Examen médico/.test(para('ana@demo.invalid')) && /esmeril/.test(para('sst@demo.invalid')) && new Set(E.correos.map((x) => x[0])).size === E.correos.length);
  fs.unlinkSync(tmp);
});

grupo('Personal en tabla, etiquetas QR por tipo y contratistas en celular (v107)', () => {
  const vm = require('vm'), c = { UI: {}, SGSST: {} }; vm.createContext(c);
  vm.runInContext(leer('importar.js') + ';this.I = Importar;', c);
  const I = c.I, imp = leer('importar.js'), hab = leer('habilitacion.html');
  const cfg = { columnas: [{ k: 'nombre', l: 'Nombre completo', req: true }, { k: 'cedula', l: 'Cédula', req: true, tipo: 'cedula', unico: true }, { k: 'f', l: 'Fecha de ingreso', tipo: 'fecha', noFutura: true }], id: (f) => 'TRB-' + f.cedula, existe: () => false };
  const idx = { nombre: 0, cedula: 1, f: 2 }, vistos = {}, unicos = {};
  const a = I.procesar(['Ana Torres', '1.020.304.050', ''], idx, cfg, vistos, 1, unicos), b2 = I.procesar(['Luis Mora', '1020304050', ''], idx, cfg, vistos, 2, unicos);
  const m = I.procesar(['Rosa Díaz', '12ab', '31/02/2026'], idx, cfg, {}, 3, {});
  ok('tabla: cédula con puntos se limpia; repetida entre filas se marca en su cuadro', a.f.cedula === '1020304050' && !a.errores.length && /repetida con la fila 1/.test(b2.porCol.cedula));
  ok('tabla: cédula con letras y fecha que no existe quedan en rojo con su motivo', /solo números/.test(m.porCol.cedula) && /no se entiende/.test(m.porCol.f));
  ok('tabla: pestañas «Escribir en una tabla» y «Pegar o subir Excel», pegar varias celdas y «Guardar todo» por lotes', /data-modo="tabla">Escribir en una tabla/.test(imp) && /addEventListener\('paste'/.test(imp) && /data-tguardar>Guardar todo/.test(imp) && /guardarFilas\(cfg, buenas, msg\)[\s\S]*guardarFilas\(cfg, buenas, msg\)/.test(imp));
  ok('tabla: revisa sus propios cuadros (sin el mensaje doble de valida.js) y la cédula no deja escribir letras', /imp-wrap" data-sin-valida/.test(imp) && /Valida\.soloDigitos\(el, 10\)/.test(imp));
  ok('personal: botón «Escribir en una tabla», nombre y apellido sin números y cédula de otra persona bloqueada', /id="btnTabla"/.test(hab) && /abrirImportar\('tabla'\)/.test(hab) && /Valida\.nombre\(f\.nombre\)/.test(hab) && /Esa cédula ya es de/.test(hab));
  // Etiquetas QR
  const ins = leer('inspecciones.html'), tam = vm.runInNewContext('(' + /const TAM_QR = (\{[\s\S]*?\n\});/.exec(ins)[1] + ')');
  ok('QR: tres tamaños que caben centrados en carta con margen de 10 mm (195 × 259 mm útiles)', ['grande', 'mediana', 'pequena'].every((k) => tam[k].col * tam[k].w <= 195 && tam[k].fil * tam[k].h + 12 <= 259 && tam[k].qr < tam[k].h - 8));
  ok('QR: grilla de tamaño fijo en mm, centrada, una hoja por grupo y sin partir etiquetas', /grid-template-columns:repeat\(' \+ T\.col \+ ',' \+ T\.w \+ 'mm\)/.test(ins) && /justify-content:center/.test(ins) && /break-inside:avoid/.test(ins) && /UI\.imprimir\(hojas\)/.test(ins));
  ok('QR: todos (con conteo), por tipo con conteo, varios con casillas y uno solo con copias y tamaño', /data-modo="todos">Todos <small>' \+ act\.length/.test(ins) && /data-tipo="/.test(ins) && /data-eqq="/.test(ins) && /id="qrCopias"/.test(ins) && /segTam\(tamQR\)/.test(ins));
  ok('inspecciones: botones de acción arriba de la lista y equipo con código único y aviso de vencimiento', ins.indexOf('id="btnQrTodos"') < ins.indexOf('id="lista"') && ins.indexOf('id="btnInspeccionar"') < ins.indexOf('id="lista"') && /ya lo tiene/.test(ins) && /Ya está vencida/.test(ins));
  // Contratistas
  const ct = leer('contratistas.html'), cx = {}; vm.createContext(cx);
  vm.runInContext(/function nitDV[\s\S]*?\n\}/.exec(ct)[0] + '\n' + /function revisarNit[\s\S]*?\n\}/.exec(ct)[0] + ';this.dv = nitDV; this.rn = revisarNit;', cx);
  ok('NIT: dígito de verificación DIAN (890903938 → 8, 860002964 → 4) y se rechaza el que no coincide', cx.dv('890903938') === 8 && cx.dv('860002964') === 4 && cx.rn('890.903.938').nit === '890903938-8' && cx.rn('890903938-8').nit === '890903938-8' && /no coincide/.test(cx.rn('890903938-5').e) && !!cx.rn('12a').e);
  ok('contratistas: «Aplica / No aplica» en dos botones iguales con texto centrado (no una casilla que se sale en 360 px)', /\.doc-ap\{display:grid;grid-template-columns:1fr 1fr/.test(ct) && /justify-content:center;text-align:center/.test(ct) && !/class="na"/.test(ct) && /@media \(max-width:380px\)/.test(ct));
  ok('contratistas: fechas coherentes, aviso de vencido y qué falta para autorizar; botones arriba', /no puede ser antes de la expedición/.test(ct) && /Vencido desde el/.test(ct) && /Para autorizar ingresos/.test(ct) && ct.indexOf('id="btnNuevoCtr"') < ct.indexOf('id="panel"') && ct.indexOf('id="btnPdfCtr"') < ct.indexOf('id="cDatos"'));
});

grupo('Encuestas de satisfacción por enlace a clientes (v107)', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const crypto = require('crypto');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
  const K = 'Ab3'.repeat(11), ID = 'ENV-20261007-ABC123';
  const preg = [{ id: 'calidad', texto: 'Calidad', tipo: 'escala' }, { id: 'oportunidad', texto: 'Oportunidad', tipo: 'escala' }, { id: 'nps', texto: 'Recomendaría', tipo: 'nps' }, { id: 'p1', texto: '¿Volvería?', tipo: 'sino' }, { id: 'comentario', texto: 'Comentario', tipo: 'texto', obligatoria: false }];
  const crear = (id, extra) => P({ action: 'guardar', tipo: 'encuestacli', id, doc: Object.assign({ cliente: 'Cliente Uno', contacto: 'Ana', periodo: 'Semestre', clave: K, preguntas: preg, estado: 'ABIERTA', fechaEnvio: '2026-10-07', fechaLimite: '2099-12-31' }, extra || {}), opId: 'c-' + id });
  ok('crear la encuesta exige clave aleatoria larga, preguntas válidas y una sola de NPS', crear(ID).ok && !crear('ENV-1-SINCLAVE', { clave: 'corta' }).ok && !crear('ENV-1-DOSNPS', { preguntas: [{ id: 'a', texto: 'x', tipo: 'nps' }, { id: 'b', texto: 'y', tipo: 'nps' }] }).ok && !crear('ENV-1-RARA', { preguntas: [{ id: 'a', texto: 'x', tipo: 'html' }] }).ok);
  const lista = JSON.stringify(G({ action: 'list', tipo: 'encuestacli' })) + JSON.stringify(E.hojas['Encuestas enviadas a clientes'].filas);
  ok('la clave del enlace no sale en la lista ni en la hoja legible', !lista.includes(K));
  const pub = G({ action: 'encuestaPublica', e: ID, k: K });
  ok('encuestaPublica: con la clave devuelve SOLO las preguntas de esa encuesta (sin clave, correo ni teléfono)', pub.ok && pub.preguntas.length === 5 && pub.cliente === 'Cliente Uno' && !JSON.stringify(pub).includes(K) && !('correo' in pub) && !('telefono' in pub));
  ok('encuestaPublica: con otra clave o id no dice nada', G({ action: 'encuestaPublica', e: ID, k: K.replace('A', 'B') }).codigoError === 'NOENCUESTA' && G({ action: 'encuestaPublica', e: 'ACC-1', k: K }).ok === false);
  const R = (doc, op) => P({ action: 'guardar', tipo: 'encresp', id: 'RSP-' + ID, doc: Object.assign({ e: ID, k: K }, doc), opId: op });
  const f = R({ respuestas: { calidad: 5 } }, 'r1');
  ok('respuesta incompleta: dice cuáles faltan', f.codigoError === 'FALTAN' && f.faltan.join('|') === 'Oportunidad|Recomendaría|¿Volvería?');
  ok('valores fuera de escala se rechazan (escala 1–5, NPS 0–10, Sí/No)', R({ respuestas: { calidad: 7, oportunidad: 3, nps: 11, p1: 'Tal vez' } }, 'r2').codigoError === 'FALTAN');
  ok('el id de la respuesta es fijo por enlace (una sola)', P({ action: 'guardar', tipo: 'encresp', id: 'RSP-OTRO', doc: { e: ID, k: K, respuestas: { calidad: 5, oportunidad: 4, nps: 9, p1: 'Sí' } }, opId: 'r3' }).ok === false);
  const bien = R({ respuestas: { calidad: 5, oportunidad: 3, nps: 9, p1: 'Sí', comentario: 'x'.repeat(3000) }, encuestado: 'Ana Pérez', promedio: 1, nps: 0 }, 'r4');
  const d = G({ action: 'doc', id: 'RSP-' + ID }).doc;
  ok('sin usuario: la respuesta se guarda; promedio y NPS los calcula el servidor (no el navegador) y el texto se acota', bien.ok && d.promedio === 4 && d.nps === 9 && d.calidad === 5 && d.comentario.length === 1500 && d.canal === 'Enlace');
  ok('la encuesta queda RESPONDIDA con su resultado y el enlace ya no abre', G({ action: 'doc', id: ID }).doc.estado === 'RESPONDIDA' && G({ action: 'doc', id: ID }).doc.promedio === 4 && G({ action: 'encuestaPublica', e: ID, k: K }).codigoError === 'CERRADA');
  ok('una segunda respuesta al mismo enlace se rechaza', R({ respuestas: { calidad: 1, oportunidad: 1, nps: 0, p1: 'No' } }, 'r5').codigoError === 'CERRADA' && G({ action: 'doc', id: 'RSP-' + ID }).doc.calidad === 5);
  ok('la respuesta no se edita; solo se le anota la acción o la PQRS', P({ action: 'parche', tipo: 'encresp', id: 'RSP-' + ID, campos: { calidad: 1 }, opId: 'r6' }).ok === false && P({ action: 'parche', tipo: 'encresp', id: 'RSP-' + ID, campos: { accionId: 'ACC-1' }, opId: 'r7' }).ok);
  ok('una encuesta respondida no se reabre; resultado no se cambia desde el navegador', P({ action: 'parche', tipo: 'encuestacli', id: ID, campos: { estado: 'ABIERTA' }, opId: 'r8' }).ok === false);
  crear('ENV-2-VENCIDA', { fechaLimite: '2020-01-01' }); crear('ENV-3-CERRADA', { estado: 'CERRADA' });
  ok('vencida o cerrada: no recibe respuestas', G({ action: 'encuestaPublica', e: 'ENV-2-VENCIDA', k: K }).codigoError === 'CERRADA' && G({ action: 'encuestaPublica', e: 'ENV-3-CERRADA', k: K }).codigoError === 'CERRADA' &&
    P({ action: 'guardar', tipo: 'encresp', id: 'RSP-ENV-3-CERRADA', doc: { e: 'ENV-3-CERRADA', k: K, respuestas: { calidad: 5, oportunidad: 5, nps: 10, p1: 'Sí' } }, opId: 'r9' }).ok === false);
  ok('reabrir una cerrada (sin respuesta) con otro plazo', P({ action: 'parche', tipo: 'encuestacli', id: 'ENV-3-CERRADA', campos: { estado: 'ABIERTA', fechaLimite: '2099-01-01' }, opId: 'r10' }).ok && G({ action: 'encuestaPublica', e: 'ENV-3-CERRADA', k: K }).ok);
  // Con usuarios: el cliente responde sin sesión; crear la encuesta y leer las respuestas sí exigen usuario.
  const E2 = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true }), P2 = (o) => E2.post(Object.assign({ token: T }, o)), G2 = (o) => E2.get(Object.assign({ token: T }, o));
  const sal = crypto.randomBytes(16).toString('hex'), adm = P2({ action: 'primerAdmin', codigo: E2.ctx.codigoAdministrador(), usuario: 'sst', nombre: 'Ana SST', salt: sal, iter: 150000, pruebaNueva: crypto.pbkdf2Sync('Clave2026x', Buffer.from(sal, 'hex'), 100000, 32, 'sha256').toString('base64'), opId: 'u1' });
  const sinSesion = P2({ action: 'guardar', tipo: 'encuestacli', id: ID, doc: { cliente: 'C', clave: K, preguntas: preg, estado: 'ABIERTA' }, opId: 'u2' });
  const conSesion = P2({ sesion: adm.sesion, action: 'guardar', tipo: 'encuestacli', id: ID, doc: { cliente: 'C', clave: K, preguntas: preg, estado: 'ABIERTA' }, opId: 'u3' });
  const verSinUsuario = G2({ action: 'encuestaPublica', e: ID, k: K });
  const resp = P2({ action: 'guardar', tipo: 'encresp', id: 'RSP-' + ID, doc: { e: ID, k: K, respuestas: { calidad: 4, oportunidad: 4, nps: 6, p1: 'No' } }, opId: 'u4' });
  ok('con usuarios: crear la encuesta exige sesión; el cliente la ve y responde sin usuario; la lista de respuestas exige sesión',
    adm.ok && !sinSesion.ok && conSesion.ok && verSinUsuario.ok === true && resp.ok && G2({ action: 'list', tipo: 'encresp' }).ok === false && G2({ sesion: adm.sesion, action: 'list', tipo: 'encresp' }).rows.length === 1);
  ok('encresp en LIBRE_SIN_SESION (solo crear) y encuestacli NO', /const LIBRE_SIN_SESION = \[[^\]]*'encresp'/.test(leer('backends/backend-sgsst.gs')) && !/const LIBRE_SIN_SESION = \[[^\]]*'encuestacli'/.test(leer('backends/backend-sgsst.gs')));
  const q = leer('calidad.html'), pub2 = leer('encuesta-cliente.html');
  ok('calidad: botón arriba «Enviar encuesta a un cliente», enlace con la clave en el #, QR, WhatsApp, correo y copiar', /id="envB">Enviar encuesta a un cliente/.test(q) && /'encuesta-cliente\.html' \+ q \+ '#r=' \+ id \+ '\.' \+ clave/.test(q) && /QR\.dibujar/.test(q) && /wa\.me\//.test(q) && /mailto:/.test(q) && /<script src="qr\.js"><\/script>/.test(q));
  ok('calidad: la clave sale de crypto.getRandomValues (32 caracteres) y en un sitio con varias empresas el enlace lleva ?e=', /crypto\.getRandomValues/.test(q) && /new Uint8Array\(32\)/.test(q) && /MultiEmpresa\.activo && EMPRESA\.codigo\) \? '\?e='/.test(q));
  ok('calidad: las respuestas por enlace entran al MISMO cálculo de satisfacción y NPS (no hay otro)', /const respuestasSat = \(\)=> de\('encuesta'\)\.concat\(de\('encresp'\)\)/.test(q) && (q.match(/function satisfaccion\(/g) || []).length === 1);
  ok('calidad: estados enviada / vencida / respondida / cerrada, cerrar y reabrir, informe PDF con lo enviado por enlace', /'Vencida'/.test(q) && /'Respondida'/.test(q) && /evCerrar/.test(q) && /evReabrir/.test(q) && /ENCUESTAS ENVIADAS POR ENLACE/.test(q));
  ok('calidad: todas las pestañas con los botones arriba', (q.match(/panel\.innerHTML = '<div class="acciones-top">/g) || []).length === 6);
  ok('encuesta-cliente.html: pública (no está en MODULO_DE), en la caché, lee el # y envía encresp sin cola', !/'encuesta-cliente\.html'/.test(leer('empresa.js')) && leer('sw.js').includes("'./encuesta-cliente.html'") && /r=\(ENV-/.test(pub2) && /tipo: 'encresp'/.test(pub2) && /sinCola: true/.test(pub2) && /action: 'encuestaPublica'/.test(pub2));
  ok('encuesta-cliente.html: dice qué preguntas faltan y explica enlace incompleto, inexistente, cerrado o ya respondido', /Falta responder/.test(pub2) && /El enlace está incompleto/.test(pub2) && /No encontramos esta encuesta/.test(pub2) && /ya fue respondida/.test(pub2));
  ok('formularios de Registros: además de decir qué falta, resalta cada campo vacío', /Valida\.marcar\(m\.el\.querySelector\('#' \+ pref \+ c\.k\), 'falta'\)/.test(leer('registros.js')));
});

grupo('Ambiental: aspectos, categoría RESPEL y consumos; etiquetas SGA y lugares de químicos (v107)', () => {
  const vm = require('vm');
  const puro = (f) => { const s = leer(f); return s.slice(s.indexOf('/* PURO-INICIO'), s.indexOf('/* PURO-FIN */')); };
  const c = { esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])) }; vm.createContext(c);
  vm.runInContext(puro('ambiental.html') + ';this.A={categoriaRespel,analisisRespel,kgResiduo,fechasRua,proximoRua,analizarConsumo,consumosPorMes,RECURSOS,valorar,ACTIVIDADES,ASPECTOS,IMPACTOS,aspectosDe,impactosDe}', c);
  const A = c.A, cat = (m) => A.categoriaRespel(m).n;
  ok('RESPEL: límites 9,9 → no obligado · 10 → pequeño · 99,99 → pequeño · 100 → mediano · 999,9 → mediano · 1.000 → gran generador', cat(9.9) === 'Menos de 10 kg/mes' && cat(10) === 'Pequeño generador' && cat(99.99) === 'Pequeño generador' && cat(100) === 'Mediano generador' && cat(999.9) === 'Mediano generador' && cat(1000) === 'Gran generador');
  ok('RESPEL: 9,999 sigue sin obligación y 9,9999999999 (coma flotante) cuenta como 10; < 10 no exige inscripción', cat(9.999) === 'Menos de 10 kg/mes' && cat(60 / 6 - 1e-12) === 'Pequeño generador' && !A.categoriaRespel(9.9).inscribir && A.categoriaRespel(10).inscribir);
  const R = (mes, cantidad, unidad, densidad, clase) => ({ mes, cantidad, unidad: unidad || 'kg', densidad, clase: clase || 'Peligroso (RESPEL)' });
  const L1 = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((m) => R(m, 60)).concat(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'].map((m) => R(m, 20)),
    [R('2026-09', 300, 'L'), R('2026-09', 100, 'galones', 0.9), R('2026-10', 5000), R('2026-08', 999, 'kg', '', 'Aprovechable (reciclable)')]);
  const a1 = A.analisisRespel(L1, '2026-10');
  ok('media móvil: los 6 meses completos anteriores (abr–sep), sin el mes en curso ni lo que no es RESPEL', a1.meses.join(',') === '2026-04,2026-05,2026-06,2026-07,2026-08,2026-09' && Math.abs(a1.media - (360 + 100 * 3.785411784 * 0.9) / 6) < 0.01, String(a1.media));
  ok('media móvil: galones con densidad se pasan a kg; litros sin densidad no se cuentan y se avisan', a1.sinKg.length === 1 && /litros sin densidad/.test(a1.sinKg[0].motivo) && A.kgResiduo({ cantidad: 300, unidad: 'L', densidad: 0.9 }).kg === 270 && A.kgResiduo({ cantidad: 5, unidad: 'unidades' }).kg === null);
  ok('cambio de categoría frente a los 6 meses anteriores (pequeño 20 kg/mes → mediano)', a1.cambio && a1.sube && a1.catAnterior.n === 'Pequeño generador' && a1.cat.n === 'Mediano generador');
  const a2 = A.analisisRespel([R('2026-09', 59.4)], '2026-10');
  ok('meses sin registros cuentan como 0 (59,4 kg en un solo mes → 9,9 kg/mes, no obligado) y sin datos previos no hay aviso de cambio', Math.abs(a2.media - 9.9) < 1e-9 && a2.cat.orden === 0 && !a2.cambio && a2.serie.length === 12);
  const f1 = A.fechasRua('900123454-1', 2027), f2 = A.fechasRua('900123456-7', 2027), f3 = A.fechasRua('9001234567', 2027);
  ok('RUA (Res. 0839 de 2023): NIT terminado en 0–4 del 1 de feb al 15 de mar; 5–9 del 15 de mar al 30 de abr; sin contar el dígito de verificación', f1.desde === '2027-02-01' && f1.hasta === '2027-03-15' && f2.desde === '2027-03-15' && f2.hasta === '2027-04-30' && f3.digito === 6 && f2.periodo === 2026 && A.fechasRua('', 2027) === null);
  ok('RUA: si el plazo de este año ya pasó, el próximo es el del año siguiente', A.proximoRua('900123454', '2026-10-11').hasta === '2027-03-15' && A.proximoRua('900123454', '2026-01-20').hasta === '2026-03-15');
  const serie = []; for (let i = 0; i < 14; i++) serie.push({ mes: new Date(Date.UTC(2025, 7 + i, 1)).toISOString().slice(0, 7), agua: 30 + i + (i === 10 ? 25 : 0), trabajadores: 40 });
  const an = A.analizarConsumo(A.consumosPorMes(serie), A.RECURSOS[0]);
  ok('consumos: tendencia con 3 meses frente a 3 (un mes raro no la voltea), mismo mes del año anterior y promedio', an.nivel === 'sube' && an.textos.some((t) => /mismo mes del año anterior/.test(t)) && an.textos.some((t) => /promedio de los 12/.test(t)) && /sube/.test(an.resumen));
  ok('consumos: marca el mes atípico, calcula el indicador por trabajador y da recomendaciones', an.atipicos.length === 1 && an.atipicos[0].mes === '2026-06' && an.porTrabajador > 1 && an.recs.some((t) => /fugas/.test(t)));
  const baja = A.analizarConsumo([{ mes: '2026-08', energia: 1000 }, { mes: '2026-09', energia: 800 }], A.RECURSOS[1]);
  ok('consumos: con dos meses compara mes a mes (baja 20 %) y con uno solo pide más datos', baja.nivel === 'baja' && Math.round(baja.pct) === -20 && A.analizarConsumo([{ mes: '2026-09', agua: 5 }], A.RECURSOS[0]).nivel === 'sin datos');
  ok('consumos: varias sedes se suman por mes', A.consumosPorMes([{ mes: '2026-09', sede: 'A', agua: 10 }, { mes: '2026-09', sede: 'B', agua: 5 }])[0].agua === 15 && A.consumosPorMes([{ mes: '2026-09', sede: 'A', agua: 10 }, { mes: '2026-09', sede: 'B', agua: 5 }], 'b')[0].agua === 5);
  ok('aspectos: el catálogo enlaza actividad → aspectos → impactos sin huecos', Object.values(A.ACTIVIDADES).every((l) => l.every((k) => A.ASPECTOS[k])) && A.ASPECTOS.every((x) => x.i.every((k) => A.IMPACTOS[k])) && A.aspectosDe('Soldadura y corte').length >= 4 && A.impactosDe('Consumo de agua')[0] === 'Agotamiento del recurso hídrico');
  ok('aspectos: valoración F × S × A (12 o más, emergencia severa o legal incumplido → significativo; positivo aparte)', A.valorar({ frecuencia: '3', severidad: '2', alcance: '2' }).significancia === 'SIGNIFICATIVO' && A.valorar({ frecuencia: '1', severidad: '3', alcance: '1', condicion: 'Emergencia' }).significancia === 'SIGNIFICATIVO' && A.valorar({ frecuencia: '1', severidad: '1', alcance: '1', legal: 'Aplica y NO se cumple' }).significancia === 'SIGNIFICATIVO' && A.valorar({ frecuencia: '2', severidad: '2', alcance: '1' }).significancia === 'NO SIGNIFICATIVO' && A.valorar({ frecuencia: '3', severidad: '3', alcance: '3', tipoImpacto: 'Positivo' }).significancia === 'POSITIVO');
  const amb = leer('ambiental.html'), gs = leer('backends/backend-sgsst.gs');
  ok('ambiental: listas con «Otro» escribible (actividad, aspecto, impacto) y botones arriba en las 3 pestañas', /Otra actividad \(escribir\)/.test(amb) && /data-v="__otro"/.test(amb) && /id="aImpOtro"/.test(amb) && (amb.match(/panel\.innerHTML = '<div class="acciones-top">/g) || []).length === 3);
  ok('ambiental: gráficas SVG propias (sin librerías) y cita de normas (Decreto 1076 de 2015, Res. 0839 de 2023, verificar con la autoridad)', /function grafica\(/.test(amb) && !/chart\.js|cdn\./i.test(amb) && /Decreto 1076 de 2015/.test(amb) && /Res\. 0839 de 2023/.test(amb) && /Verifica la fecha vigente con tu autoridad ambiental/.test(amb));
  ok('backend: aspecto con tipoImpacto/norma/grupoAspecto, residuo con densidad y kg, respel con NIT; lugarquim con sus condiciones', /aspecto: \{[^}]*'tipoImpacto', 'norma', 'grupoAspecto'/.test(gs) && /residuo: \{[^}]*'densidad', 'kg'/.test(gs) && /respel: \{[^}]*'pgirespel', 'nit'/.test(gs) && /lugarquim: \{[^}]*'tipoLugar'[^}]*'ventilacion', 'contencion', 'kitDerrames', 'extintor', 'lavaojos', 'senalizacion'[^}]*'activo'/.test(gs));
  // Químicos: etiquetas SGA
  const q = leer('quimicos.html'); vm.runInContext(puro('quimicos.html') + ';this.Q={etiquetaHTML,hojasEtiquetas,faltaEtiqueta,TAMANOS,alertasLugar}', c);
  const Q = c.Q, s = { nombre: 'Thinner', pictogramas: 'Inflamable, Irritante / nocivo', palabra: 'Peligro', frasesH: 'H225, H336', consejosP: 'P210', fabricante: 'Proveedor', telProveedor: 'Calle 1 · 601 000 0000', telEmergencia: '601 111 1111' };
  ok('etiqueta SGA: pictogramas en SVG, palabra, textos de H y P desde el código y proveedor; completa no le falta nada', (Q.etiquetaHTML(s, 'g').match(/<svg/g) || []).length === 2 && /Líquido y vapores muy inflamables/.test(Q.etiquetaHTML(s, 'g')) && /PELIGRO|Peligro/.test(Q.etiquetaHTML(s, 'm')) && Q.faltaEtiqueta(s).length === 0 && Q.faltaEtiqueta({ nombre: 'X' }).length >= 5);
  ok('etiquetas: 2 grandes, 6 medianas o 15 pequeñas por hoja carta', Q.hojasEtiquetas([s, s, s], 'g', 1).length === 2 && Q.hojasEtiquetas([s], 'm', 6).length === 1 && Q.hojasEtiquetas([s], 'p', 16).length === 2);
  const mm = (k) => Number((new RegExp('\\.etq\\.' + k + '\\{width:(\\d+)mm;height:(\\d+)mm').exec(q) || [])[1]), alto = (k) => Number((new RegExp('\\.etq\\.' + k + '\\{width:\\d+mm;height:(\\d+)mm').exec(q) || [])[1]);
  ok('etiquetas: caben en el ancho útil de la carta con márgenes de 10 mm (≤ 194 mm por fila) y van centradas', mm('g') <= 194 && 2 * mm('m') + 2 <= 194 && 3 * mm('p') + 4 <= 194 && 2 * alto('g') + 2 <= 255 && 3 * alto('m') + 4 <= 255 && 5 * alto('p') + 8 <= 255 && /\.etqs\{[^}]*justify-content:center/.test(q));
  ok('lugares de químicos: agregar, editar, quitar y asignar; la dirección del proveedor no se filtra como teléfono', /SGSST\.nuevoId\('LUQ'\)/.test(q) && /Registros\.guardar\('lugarquim'/.test(q) && /Registros\.borrar\(d\.id, 'Borrado desde Sustancias químicas'\)/.test(q) && /function asignarSustancias/.test(q) && /data-sin-valida/.test(q) && Q.alertasLugar({ ventilacion: true, contencion: true, kitDerrames: true, extintor: false, lavaojos: true, senalizacion: true }, [s]).some((t) => /extintor/i.test(t)));
});

grupo('Evaluación de proveedores y contratistas (v107)', () => {
  const PV = require(path.join(RAIZ, 'proveedores-catalogo.js'));
  const cats = PV.categorias(), todos = [].concat(...cats.map((c)=> PV.requisitos(c.c)));
  ok('catálogo de la matriz: 29 categorías (S01–S05 bienes, V01–V24 servicios), 544 requisitos y 206 excluyentes ★', cats.length === 29 && todos.length === 544 && todos.filter((q)=> q.excl).length === 206 &&
    cats.filter((c)=> c.b === 'Bien').every((c)=> /^S0[1-5]$/.test(c.c)) && cats.filter((c)=> c.b === 'Servicio').every((c)=> /^V\d\d$/.test(c.c)));
  ok('criticidad y periodicidad copiadas de la matriz (V01 alto crítico semestral, S01 básico anual, V20 sin etapa 3)', PV.categoria('V01').nivel === 'Alto' && PV.categoria('V01').critico && !PV.categoria('S01').critico && cats.find((c)=> c.c === 'S01').reevaluacion === 'Anual' && !PV.requisitos('V20').some((q)=> q.etapa === 3));
  const sum = (l)=> Math.round(l.reduce((a, b)=> a + b, 0) * 1000) / 1000;
  ok('pesos de la evaluación inicial: bienes 15/30/25/15/10/5 y servicios 30/20/20/15/10/5 (suman 100 %)', PV.pesos('Proveedor de bienes').join() === '0.15,0.3,0.25,0.15,0.1,0.05' && PV.pesos('Contratista').join() === '0.3,0.2,0.2,0.15,0.1,0.05' && sum(PV.pesos('Proveedor de servicios')) === 1);
  ok('pesos de la reevaluación 25/25/20/15/10/5', PV.REEV.map((c)=> c.p).join() === '0.25,0.25,0.2,0.15,0.1,0.05');
  ok('dígito de verificación del NIT (DIAN): 800197268-4 y 890903938-8 válidos; sin dígito o con otro, no', PV.dvNit('800197268') === 4 && PV.dvNit('890903938') === 8 && PV.validarNit('800.197.268-4').ok && !PV.validarNit('800197268').ok && /es 4/.test(PV.validarNit('800197268-1').error) && !PV.validarNit('1111111-1').ok);
  const ps = PV.pesos('Proveedor de bienes'), p4 = PV.puntaje([4, 4, 4, 4, 4, 4], ps);
  ok('puntaje = Σ calificación × peso ÷ 5 (todo en 4 = 80 % CONFIABLE, sin quedar en 79,99 % por redondeo)', p4.sobre5 === 4 && p4.pct === 80 && PV.clasificarInicial(p4.pct, 'CUMPLE') === 'CONFIABLE' && PV.puntaje([4, 4, 4, 4, 4], ps) === null);
  ok('clasificación inicial: ≥ 80 CONFIABLE · 60–79 CONDICIONADO · < 60 NO APTO; sin excluyentes verificados = PENDIENTE', PV.clasificarInicial(60, 'CUMPLE') === 'CONDICIONADO' && PV.clasificarInicial(59.99, 'CUMPLE') === 'NO APTO' && PV.clasificarInicial(95, 'PENDIENTE') === 'PENDIENTE');
  const rq = PV.requisitos('S04'), rut = rq.find((q)=> /RUT/.test(q.req)), sds = rq.find((q)=> q.excl && q.condicional && q.etapa <= 2), si = {};
  rq.filter((q)=> q.etapa <= 2).forEach((q)=> { si[q.k] = { e: 'Sí' }; });
  const conNo = Object.assign({}, si, { [rut.k]: { e: 'No' } }), naRut = Object.assign({}, si, { [rut.k]: { e: 'N.A.' } }), naSds = sds ? Object.assign({}, si, { [sds.k]: { e: 'N.A.' } }) : si, sinMarca = Object.assign({}, si); delete sinMarca[rut.k];
  const d5 = PV.revisarDocs(rq, conNo, [1, 2]);
  ok('un excluyente ★ en «No» = NO APTO aunque el puntaje sea 100 %', d5.estado === 'NO CUMPLE' && PV.clasificarInicial(PV.puntaje([5, 5, 5, 5, 5, 5], ps).pct, PV.excluyentesInicial(d5, 'Sí', 'Sí')) === 'NO APTO (requisito excluyente)');
  ok('N.A. solo vale en un ★ condicional; sin marcar queda PENDIENTE; SST no verificada o conflicto de interés = NO CUMPLE', PV.revisarDocs(rq, naRut, [1, 2]).estado === 'NO CUMPLE' && (!sds || PV.revisarDocs(rq, naSds, [1, 2]).estado === 'CUMPLE') &&
    PV.revisarDocs(rq, sinMarca, [1, 2]).estado === 'PENDIENTE' && PV.excluyentesInicial(PV.revisarDocs(rq, si, [1, 2]), 'No', 'Sí') === 'NO CUMPLE' && PV.excluyentesInicial(PV.revisarDocs(rq, si, [1, 2]), 'Sí', '') === 'PENDIENTE');
  ok('un documento ★ vencido cuenta como faltante', PV.revisarDocs(rq, Object.assign({}, si, { [rut.k]: { e: 'Sí', v: '2020-01-01' } }), [1, 2], '2026-10-07').estado === 'NO CUMPLE');
  const ev = { entregas: 10, aTiempo: 9, conNC: 1, diasCierre: 4, mesesLabor: 6, mesesSS: 6, inspecciones: 5, conHallazgos: 1, incidentes: 0, reqAplicables: 20, reqVencidos: 1, exclVencidos: 0 };
  ok('reevaluación: calificación sugerida desde las evidencias (escala objetiva del formato)', PV.sugeridas(ev).join() === '4,3,4,Manual,4,4' && PV.sugeridas(Object.assign({}, ev, { incidentes: 1 }))[0] === 1 && PV.sugeridas(Object.assign({}, ev, { mesesSS: 5 }))[0] === 2 && PV.sugeridas({})[0] === '');
  ok('reevaluación: ≥ 80 CONFIABLE · 60–79 ACEPTABLE CON PLAN DE MEJORA · < 60 RECHAZADO; alerta extraordinaria con ≥ 2 NC o ★ vencido', PV.clasificarReev(80) === 'CONFIABLE' && PV.clasificarReev(79) === 'ACEPTABLE CON PLAN DE MEJORA' && PV.clasificarReev(59) === 'RECHAZADO' &&
    PV.alertaExtraordinaria(Object.assign({}, ev, { conNC: 2 })) && PV.alertaExtraordinaria(Object.assign({}, ev, { exclVencidos: 1 })) && !PV.alertaExtraordinaria(ev) && PV.incoherencias(Object.assign({}, ev, { aTiempo: 11 })).length === 1);
  ok('próxima evaluación: crítico +6 meses, no crítico +12, con plan de mejora +6, rechazado/no apto no se programa', PV.proxima('2026-01-31', 'CONFIABLE', true) === '2026-07-31' && PV.proxima('2026-01-31', 'CONFIABLE', false) === '2027-01-31' &&
    PV.proxima('2026-08-31', 'ACEPTABLE CON PLAN DE MEJORA', false) === '2027-02-28' && PV.proxima('2026-01-31', 'RECHAZADO', true) === '' && PV.proxima('2026-01-31', 'NO APTO (requisito excluyente)', false) === '' && PV.estadoReev('2026-10-01', '2026-10-07', 'CONFIABLE') === 'VENCIDA');
  const cr = PV.cronograma({ proxima: '2026-03-10', critico: true, evaluaciones: [{ fecha: '2026-01-15' }] }, 2026, '2026-10-07');
  ok('cronograma: ✔ ejecutada, ⚠ vencida y semestral también a los 6 meses; homologación con dos CONFIABLE seguidos', cr.meses[1] === '✔' && cr.meses[3] === '⚠' && cr.meses[9] === '⚠' && cr.estado === 'VENCIDA' &&
    PV.candidatoHomologacion([{ fecha: '2026-01-01', clasificacion: 'CONFIABLE' }, { fecha: '2026-07-01', clasificacion: 'CONFIABLE' }]) && !PV.candidatoHomologacion([{ fecha: '2026-01-01', clasificacion: 'CONFIABLE' }, { fecha: '2026-07-01', clasificacion: 'ACEPTABLE CON PLAN DE MEJORA' }]));
  const pg = leer('proveedores.html'), cj = leer('proveedores-catalogo.js');
  ok('sin datos de la empresa del ejemplo en el catálogo ni en la página (genérico; códigos con Empresa.formato)', !/DCL-|compras@/i.test(cj) && !rastroReal(cj) && !/DCL-|compras@/i.test(pg) && /UI\.cabecera\('SG-EVAL-PROVEEDOR'/.test(pg) && /UI\.cabecera\('SG-PROVEEDORES'/.test(pg) && ('SG-EVAL-PROVEEDOR' in datosEmpresa().formatos));
  ok('resultado bajo → acción con origen «Evaluación de proveedores»; PDF horizontal de la matriz y CSV', /origen: 'Evaluación de proveedores'/.test(pg) && leer('sgsst-ui.js').includes("'Evaluación de proveedores'") && /pdfMatriz[\s\S]*\], true\);/.test(pg) && /text\/csv/.test(pg));
  ok('Dec. 1072 arts. 2.2.4.6.27 y 2.2.4.6.28 y Res. 0312 (2.9.1 y 2.10.1) en la pestaña de criterios SST', /2\.2\.4\.6\.27/.test(pg) && /2\.2\.4\.6\.28/.test(pg) && /2\.10\.1/.test(pg));
  ok('proveedores.html en sistema de gestión (MODULO_DE), consulta la ve, caché y servidor', leer('empresa.js').includes("'proveedores.html': 'proveedores'") && /consulta: \[[^\]]*'proveedores'/.test(leer('empresa.js')) &&
    leer('sw.js').includes("'./proveedores.html'") && leer('sw.js').includes("'./proveedores-catalogo.js'") && /proveedor: 'proveedores\.html'/.test(leer('backends/backend-sgsst.gs')));
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1], E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const g = E.post({ token: T, action: 'guardar', tipo: 'proveedor', id: 'PRV-T1', opId: 'prv-t1', doc: { nombre: 'Proveedor de prueba', nit: '800.197.268-4', tipoProveedor: 'Contratista', categoria: 'V03', categoriaNombre: 'Alquiler de Andamios', nivel: 'Alto', critico: true,
    resultado: 'CONFIABLE', puntaje: 86, fechaEvaluacion: '2026-01-10', proximaEvaluacion: '2026-07-10', fechasEval: ['2025-07-01', '2026-01-10'], faltan3: 0, evaluaciones: [{ uid: 'a', fecha: '2025-07-01' }, { uid: 'b', fecha: '2026-01-10' }], activo: true } });
  const fila = (E.get({ token: T, action: 'list', tipo: 'proveedor' }).rows || []).find((x)=> x.id === 'PRV-T1') || {};
  ok('servidor: el proveedor se guarda y la lista trae las fechas de evaluación (cronograma) y el n.º de evaluaciones', g.ok && fila.resumen && fila.resumen.fechasEval === '2025-07-01, 2026-01-10' && fila.resumen.evaluaciones === 2 && fila.vence === '2026-07-10' && fila.resumen.critico === true);
});

grupo('Informe del SG-SST con sugerencias y tareas del asesor (v107)', () => {
  const INF = require(path.join(RAIZ, 'informe-reglas.js'));
  const T3 = INF.periodo('trimestre', '2026-T3');
  ok('informe: periodos de mes, trimestre y año (con el anterior para comparar)', T3.meses.join(',') === '2026-07,2026-08,2026-09' && T3.anterior === '2026-T2' && INF.periodo('anio', '2026').meses.length === 12 && INF.periodo('mes', '2026-01').anterior === '2025-12' && INF.opciones('mes', '2026-10-11').length === 13);
  const hoy = '2026-10-11', P = INF.periodo('mes', '2026-09');
  const rows = [
    { id: 'EMPRESA-PERFIL', tipo: 'empresa', resumen: { trabajadores: 40, claseRiesgo: 'III', grupo0312: 60 } },
    { id: 'PAT-2026', tipo: 'plananual', resumen: { anio: '2026', cumplimiento: 45, avance: 38, firmado: true } },
    { id: 'ACC-1', tipo: 'accion', estado: 'ABIERTA', fecha: '2026-07-01', resumen: { accion: 'Guarda del esmeril', responsable: 'Ana Pérez', fechaCompromiso: '2026-08-01' } },
    { id: 'ACC-2', tipo: 'accion', estado: 'ABIERTA', fecha: '2026-08-01', resumen: { accion: 'Tarea del asesor', origen: 'Asesor SST', responsable: 'Ana Pérez', fechaCompromiso: '2026-10-01' } },
    { id: 'EXA-1', tipo: 'examen', resumen: { nombre: 'Pedro Gómez', cedula: '77', tipoExamen: 'Periódico', fecha: '2025-01-10', proxima: '2026-01-10' } },
    { id: 'MES-2026-09', tipo: 'mes', resumen: { mes: '2026-09', trabajadores: 40, diasProgramados: 1000, diasAusencia: 5 } }];
  const ctx = (esSst) => ({ rows, hoy, periodo: P, esSst, plan: null, evid: null, perfil: { trabajadores: 40, claseRiesgo: 'III' }, charlas: null, habilitado: () => true, nombresCategoria: {}, calidad: true });
  const K = INF.calcular(ctx(true)), S = INF.sugerencias(K), id = (x) => S.find((s) => s.id === x);
  ok('informe: «el plan anual va al 45 %» sale como sugerencia de prioridad alta, con su porqué y su norma', id('plan_bajo') && id('plan_bajo').prioridad === 'alta' && /45 %/.test(id('plan_bajo').titulo) && /2\.2\.4\.6\.8/.test(id('plan_bajo').norma), JSON.stringify(id('plan_bajo')));
  ok('informe: acciones vencidas con más de 30 días y tareas del asesor vencidas', !!id('acciones_30') && !!id('tareas_asesor') && K.acciones.asesorAbiertas === 1 && /01\/08\/2026/.test(id('acciones_30').porque), S.map((s) => s.id).join(','));
  ok('informe: cada sugerencia trae área, por qué, norma, qué hacer y prioridad válida', S.length > 3 && S.every((s) => s.area && s.porque && s.norma && s.accion && s.accion.accion && ['alta', 'media', 'baja'].indexOf(s.prioridad) !== -1));
  const K2 = INF.calcular(ctx(false)), S2 = INF.sugerencias(K2);
  ok('informe: SST ve los exámenes vencidos; quien no es SST no ve salud individual (SOLO_SST)', K.salud && K.salud.vencidos === 1 && !!id('examenes') && K2.salud === null && !S2.some((s) => s.id === 'examenes' || s.id === 'restricciones'));
  ok('informe: el resumen ejecutivo dice el periodo bien escrito y las fechas en DD/MM/AAAA', /^Informe del SG-SST de septiembre de 2026\.$/.test(INF.resumen(K, S)[0]) && !S.some((s) => /el \d{4}-\d{2}-\d{2}/.test(s.porque)), INF.resumen(K, S)[0]);
  const svg = INF.graf.barras([{ et: 'ene', v: 2 }, { et: 'feb', v: 0 }], { titulo: 'Prueba' }) + INF.graf.linea([{ et: 'ene', v: 1 }, { et: 'feb', v: null }], { titulo: 'L' }) + INF.graf.anillo([{ n: 'A', v: 1, color: '#000' }], { titulo: 'An' });
  ok('informe: gráficas en SVG propio (sin librerías), accesibles (role="img" y aria-label)', (svg.match(/<svg class="graf"/g) || []).length === 3 && /role="img" aria-label="Prueba"/.test(svg) && !/NaN/.test(svg));
  const inf = leer('informe.html');
  ok('informe.html: carga informe-reglas y evidencias, PDF con firma del responsable y botón «Crear acción»', /informe-reglas\.js/.test(inf) && /evidencias-reglas\.js/.test(inf) && /UI\.firmaHoja/.test(inf) && /Elaboró/.test(inf) && /UI\.nuevaAccion\(/.test(inf) && /TIPOS_SALUD/.test(inf) && /esSst\(\) \? TIPOS_SALUD/.test(inf));
  ok('informe.html: en MODULO_DE (lo ven gerencia y consulta) y en la caché', /'informe\.html': 'gerencia'/.test(leer('empresa.js')) && /'\.\/informe\.html'/.test(leer('sw.js')) && /'\.\/informe-reglas\.js'/.test(leer('sw.js')));
  ok('gerencia y asesor: botones arriba (acciones-top) y la gerencia enlaza el informe', /class="acciones-top"[\s\S]{0,200}id="btnPdf"[\s\S]{0,200}informe\.html/.test(leer('gerencia.html')) && /class="acciones-top">\s*<button type="button" class="btn amber" id="btnNuevo"/.test(leer('asesor.html')));
  const a = leer('asesor.html');
  ok('asesor: «Asignar tarea» en la tarjeta de cada empresa, con responsable de la lista de su portal, fecha ≥ hoy y validación', /data-asig=/.test(a) && /action: 'responsables'/.test(a) && /Valida\.revisar\(m\.el/.test(a) && /no puede ser anterior a hoy/.test(a) && /<option>Otro<\/option>/.test(a));
  ok('asesor: tareas por empresa con estado (abierta / vencida / cerrada), filtro y avance', /function estTarea/.test(a) && /data-ft=/.test(a) && /Avance: ' \+ cuenta\.cerradas/.test(a) && /tareasCerradas: tareas\.length - ab\.length/.test(a));
  ok('ayuda: guía de cómo asignar tareas (en la consola) y de cómo sacar el informe', /Asignar una tarea: en la tarjeta de la empresa/.test(leer('admin.html')) && !/asesor\.html/.test(leer('ayuda.html')) && /id: 'informe'/.test(leer('ayuda.html')));
  // Servidor: pendientes, correo del lunes y lista de responsables
  const { crearEntorno } = require('./simulador-apps-script'), crypto = require('crypto');
  const TK = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const tmp = path.join(require('os').tmpdir(), 'sgsst-v107h.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs'));
  const E = crearEntorno(tmp);
  const Po = (o) => E.post(Object.assign({ token: TK }, o)), G = (q) => E.get(Object.assign({ token: TK }, q));
  const en = (fecha, fn) => { const D0 = E.ctx.Date; const fijo = new D0(fecha + 'T12:00:00-05:00').getTime();
    E.ctx.Date = class extends D0 { constructor(...x) { if (x.length) super(...x); else super(fijo); } static now() { return fijo; } };
    try { return fn(); } finally { E.ctx.Date = D0; } };
  const an = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 4), m = an + '-03';
  Po({ action: 'guardar', tipo: 'accion', id: 'ACC-AS1', doc: { origen: 'Asesor SST', origenRef: 'ASESOR', accion: 'Actualizar el plan de emergencias', responsable: 'Luis Supervisor', fechaCompromiso: m + '-28', estado: 'ABIERTA', asignadaPor: 'Asesora', seguimiento: [] }, opId: 'as1' });
  Po({ action: 'guardar', tipo: 'accion', id: 'ACC-N1', doc: { accion: 'Acción normal lejana', responsable: 'Luis Supervisor', fechaCompromiso: m + '-28', estado: 'ABIERTA' }, opId: 'n1' });
  const L = en(m + '-02', () => G({ action: 'pendientes' })), itA = (L.items || []).find((x) => x.id === 'ACC-AS1');
  ok('servidor: la tarea del asesor sale en los pendientes aunque venza en más de 15 días, destacada y con su responsable (una acción normal lejana no)', itA && itA.asesor === true && /^Tarea del asesor SST: Actualizar el plan de emergencias/.test(itA.texto) && itA.responsable === 'Luis Supervisor' && itA.nivel === 'pronto' && !(L.items || []).some((x) => x.id === 'ACC-N1'), JSON.stringify(itA));
  ok('servidor: vencida, sale como vencida', (en(m + '-30', () => G({ action: 'pendientes' })).items || []).some((x) => x.id === 'ACC-AS1' && x.nivel === 'vencido'));
  Po({ action: 'parche', tipo: 'accion', id: 'ACC-AS1', agregar: { seguimiento: [{ uid: 's1', fecha: m + '-03', quien: 'Luis', texto: 'Ya se pidió el análisis de vulnerabilidad' }] }, opId: 'as2' });
  const ra = (G({ action: 'list', tipo: 'accion' }).rows || []).find((x) => x.id === 'ACC-AS1');
  ok('servidor: el resumen de la acción trae el avance (anotaciones y la última) para el panel del asesor', ra && ra.resumen.avances === 1 && /análisis de vulnerabilidad/.test(ra.resumen.ultimoAvance), ra && JSON.stringify(ra.resumen));
  const sal = () => crypto.randomBytes(16).toString('hex'), prueba = (c, s) => crypto.pbkdf2Sync(c, Buffer.from(s, 'hex'), 100000, 32, 'sha256').toString('base64');
  const sA = sal(), adm = Po({ action: 'primerAdmin', codigo: E.ctx.codigoAdministrador(), usuario: 'ana', nombre: 'Ana Pérez', salt: sA, iter: 150000, pruebaNueva: prueba('ClaveAna2026', sA), opId: 'u1' });
  const sT = sal(), pT = prueba('Temporal123', sT);
  Po({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'luis', nombre: 'Luis Supervisor', cedula: '80111222', rol: 'supervisor', correo: 'luis@demo.invalid', salt: sT, iter: 150000, pruebaNueva: pT, opId: 'u2' });
  const R = G({ action: 'responsables', sesion: adm.sesion });
  ok('servidor: «responsables» da nombre, cargo y rol de los usuarios activos, sin correo, cédula ni usuario', R.ok && R.usuarios.some((u) => u.nombre === 'Luis Supervisor' && u.rol === 'supervisor') && !JSON.stringify(R.usuarios).match(/@|80111222|"usuario"/), JSON.stringify(R));
  ok('servidor: «responsables» sin sesión pide entrar; un supervisor no la puede ver', G({ action: 'responsables' }).codigoError === 'SESION' && (() => { const e1 = Po({ action: 'entrar', usuario: 'luis', prueba: pT, opId: 'e1' }), sL = sal();
    const SL = Po({ action: 'cambiarMiClave', sesion: e1.sesion, prueba: pT, salt: sL, iter: 150000, pruebaNueva: prueba('ClaveLuis2026', sL), opId: 'c2' }).sesion; return G({ action: 'responsables', sesion: SL }).codigoError === 'PERMISO'; })());
  E.correos.length = 0; en(m + '-02', () => E.ctx.avisoSemanal());
  const paraL = E.correos.filter((x) => x[0] === 'luis@demo.invalid').map((x) => x[2]).join('\n');
  ok('servidor: el correo del lunes le lleva al responsable su tarea del asesor (aunque venza después de 7 días)', /Tarea del asesor SST: Actualizar el plan de emergencias/.test(paraL) && !/Acción normal lejana/.test(paraL), paraL || E.correos.map((x) => x[0]).join(', '));
  fs.unlinkSync(tmp);
});

grupo('Inicio por categorías, agenda, inducción desde el inicio y casillas sin tropiezos (v109)', () => {
  const ix = leer('index.html');
  ok('la obra va por categorías visibles dentro del sistema de gestión (permisos, antes de la tarea, EPP, personas) (v111)', ['jornada', 'campo-antes', 'campo-epp', 'campo-personas'].every((id) => ix.includes('class="accordion-item sec-campo cat-campo" id="' + id + '"')) && /id="zonaObra"><h3>En obra<\/h3>/.test(ix) && ix.indexOf('id="zonaObra"') > ix.indexOf('id="sgContenido"'));
  ok('en el inicio: responder la inducción y PQRS (sin usuario)', ix.includes('href="induccion-responder.html"') && ix.includes('href="reportes.html?nuevo=1&amp;pqrs=1"'));
  ok('con usuario: agenda con calendario de pendientes y el cronograma como pestaña', /id="agenda"/.test(ix) && /window\.Agenda = \(function/.test(ix) && /data-ag="crono"/.test(ix) && /action=pendientes&dias=45/.test(ix) && /window\.Agenda\.pintar\(lTodo, hoy\)/.test(ix));
  const { crearEntorno } = require('./simulador-apps-script');
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'));
  const d = E.ctx.limpiarInduccionPublica_({ tipoInduccion: 'Cualquier cosa', fecha: '2020-01-01', nombre: 'Ana  Prueba', cedula: '10.333.444', respuestas: [{ pregunta: 'a', respuesta: 'x', correcta: true }, { pregunta: 'b', respuesta: 'y', correcta: false }], aprueba: 80, resultado: 'APROBADA', firma: 'javascript:alert(1)' });
  ok('inducción sin usuario: el servidor pone la fecha de hoy, recalcula la nota y el resultado y limpia la firma', d.fecha === E.ctx.hoyISO_() && d.tipoInduccion === 'Inducción' && d.cedula === '10333444' && d.puntaje === 50 && d.resultado === 'REPROBADA' && d.firma === '' && d.autoservicio === true);
  ok('inducción: está en LIBRE_SIN_SESION (solo crear) y la página pública no está en MODULO_DE', /const LIBRE_SIN_SESION = \[[^\]]*'induccion'/.test(leer('backends/backend-sgsst.gs')) && !/'induccion-responder\.html'/.test(leer('empresa.js')) && leer('sw.js').includes("'./induccion-responder.html'"));
  ok('inducción: un solo banco de temas y preguntas para la página del SST y la pública', /<script src="induccion-banco\.js"><\/script>/.test(leer('induccion-responder.html')) && /<script src="induccion-banco\.js"><\/script>/.test(leer('induccion.html')));
  ok('los pendientes del permiso van en una barra abajo (no una pastilla encima de las casillas) y la página deja el espacio', /#pendingNav\{[^}]*left:0;right:0;[^}]*bottom:0;/.test(leer('common.css')) && /body\.con-pendientes\{padding-bottom/.test(leer('common.css')) && /classList\.toggle\('con-pendientes', !!n\)/.test(leer('permiso-core.js')));
  ok('el botón de subir solo sale al subir con el dedo y se esconde al tocar la pantalla', /subida > 160/.test(leer('common.js')) && /pointerdown[\s\S]{0,80}ocultar\(\)/.test(leer('common.js')));
  ok('la franja transparente de la barra de guardar deja pasar los toques', /\.barra-guardar,\.barra-env\{pointer-events:none;\}/.test(leer('sgsst.css')));
  ok('cifras clicables: el motor está en sgsst-ui.js', /function irKpi\(destino\)/.test(leer('sgsst-ui.js')) && /\.kpi\[data-ir\]\{cursor:pointer/.test(leer('sgsst.css')));
});

grupo('Proveedores por etapas, EPP sugerido y 5 porqués con ayudas (v109)', () => {
  const pv = leer('proveedores.html'), back = leer('backends/backend-sgsst.gs');
  ok('proveedores: el ingreso por etapas tiene todas sus piezas (lista, abrir, 6 etapas, alta en la matriz)', ['procs', 'abiertos', 'nuevoProceso', 'continuarProceso', 'pintarProcesos', 'pintarCandidatos', 'campoNit', 'activarNit', 'resumenReqsProc', 'etapaNecesidad', 'etapaCotizaciones', 'etapaSeleccion', 'etapaDocumentos', 'etapaEvaluacion', 'etapaDecision', 'darDeAlta']
    .every((f) => new RegExp('(function ' + f + '\\(|const ' + f + ' = )').test(pv)));
  ok('proveedores: el servidor conoce el tipo «compraprov» (y su enlace)', /compraprov: \{ hoja: 'Ingreso de proveedores \(cotizaciones\)'/.test(back) && /compraprov: 'proveedores\.html'/.test(back));
  const P = require(path.join(RAIZ, 'proveedores-catalogo.js'));
  const n = P.nitEscribiendo('900123456', null);
  ok('NIT: se escribe solo el número y el guion con el dígito se pone solo', n.texto === '900123456-' + P.dvNit('900123456') && n.ok === true);
  const proc = { necesidad: 'Mantenimiento del compresor', fecha: '2026-10-01', monto: 6500000, categoria: P.categorias().find((c) => c.b !== 'Bien').c, tipoProveedor: 'Proveedor de servicios', cotizaciones: [] };
  ok('ingreso: con la necesidad lista, queda en la etapa 2 (cotizaciones) y pide 3 por el monto', P.etapaAlta(proc) === 2 && P.cotMinimasProc(proc) === 3 && P.resumenAlta(proc).estadoProceso === 'En cotización');
  const ep = leer('entrega-epp.html');
  ok('matriz de EPP: sugiere elementos por cargo y peligros, y completa mientras se escribe', /function sugerenciasEpp\(cargo, peligrosTxt, ya\)/.test(ep) && /REGLAS_EPP = \[/.test(ep) && /class="sug-epp"/.test(ep) && /sug-el/.test(ep) && /SGSST\.listar\('entrega,eppcargo,trabajador,cargo,peligro[,']/.test(ep));
  const rp = leer('reportes.html');
  ok('5 porqués: uno a uno, con sugerencias según el caso y sin repetir lo ya respondido', /function sugPq\(i\)/.test(rp) && /CASOS_PQ = \[/.test(rp) && /const repetida = /.test(rp) && /Según este caso/.test(rp) && /const primeraFrase = /.test(rp));
  ok('cifras clicables también en EPP, inducción y calidad', /data-ir="fn:verSinEntrega"/.test(ep) && /data-ir="tab:pendientes"/.test(leer('induccion.html')) && /data-ir="tab:pnc"/.test(leer('calidad.html')));
});

grupo('Producto neutro: sin datos de ninguna empresa real (v108)', () => {
  const todos = archivosTexto(RAIZ, []), rel = (f) => path.relative(RAIZ, f);
  const conRastro = todos.filter((f) => rastroReal(fs.readFileSync(f, 'utf8'))).map(rel);
  ok('ningún archivo nombra a una empresa, cliente o persona real', conRastro.length === 0, conRastro.join(', '));
  const sitio = todos.filter((f) => !/^pruebas[\\/]/.test(rel(f)));
  const enlaces = sitio.filter((f) => /forms\.gle\/[A-Za-z0-9]{6,}|docs\.google\.com\/forms\/d\/e\/[\w-]{20,}|drive\.google\.com\/drive\/folders\/[\w-]{10,}|1drv\.ms\/|script\.google\.com\/macros\/s\/AKfy[\w-]{20,}/.test(fs.readFileSync(f, 'utf8'))).map(rel);
  ok('sin enlaces a formularios, carpetas o servidores de alguien', enlaces.length === 0, enlaces.join(', '));
  const PERMITIDO = /@(empresa\.com(\.co)?|tuempresa\.com|cliente\.com|ejemplo\.com|example\.com|[\w-]+\.invalid|[\w-]+\.demo)$/i;
  const correos = [];
  sitio.forEach((f) => (fs.readFileSync(f, 'utf8').match(/[\w.%+-]+@([\w-]+\.)+[a-z]{2,}/gi) || []).forEach((c) => { if (!PERMITIDO.test(c) && !/^no-?reply@/i.test(c)) correos.push(rel(f) + ': ' + c); }));
  ok('los correos del código son solo de ejemplo', correos.length === 0, correos.slice(0, 5).join(', '));
  const cel = [];
  sitio.filter((f) => !/semilla\.json$/.test(f)).forEach((f) => (fs.readFileSync(f, 'utf8').match(/\+57[ -]?3\d{2}[ -]?\d{3}[ -]?\d{4}|\b3\d{2}[ -]\d{3}[ -]\d{4}\b/g) || []).forEach((t) => { if (!/000[ -]?000\d|123[ -]?4567|555/.test(t)) cel.push(rel(f) + ': ' + t); }));
  ok('sin celulares reales escritos en el código', cel.length === 0, cel.join(', '));
  ok('config.js y backends/ sin token real (solo el marcador)', /API_TOKEN: 'PON-AQUI-EL-TOKEN'/.test(leer('config.js')) &&
     archivosTexto(path.join(RAIZ, 'backends'), []).every((f) => { const m = /const API_TOKEN = '([^']*)'/.exec(fs.readFileSync(f, 'utf8')); return !m || m[1] === 'PON-AQUI-EL-TOKEN'; }));
  ok('el inicio no trae tarjetas que abran sitios externos', !/class="card[^"]*\bext\b/.test(leer('index.html')) && !/target="_blank"[^>]*class="card/.test(leer('index.html')));
  ok('logo e íconos neutros: logo-empresa.svg de reserva y sin el logo de una empresa en el sitio', existe('logo-empresa.svg') && !fs.readdirSync(RAIZ).some((n) => /^logo-(?!empresa\.svg$)/.test(n)));
  ok('manifest y título del inicio sin nombre de empresa', /"name": "Portal SSTA"/.test(leer('manifest.json')) && /<title>Portal SSTA<\/title>/.test(leer('index.html')));
});

grupo('Sistema de gestión por rol (v106)', () => {
  const vm = require('vm');
  const doc = { readyState: 'complete', addEventListener() {}, querySelectorAll() { return []; }, documentElement: { style: { setProperty() {} }, classList: { add() {} } }, title: '', head: { appendChild() {} }, createElement() { return { setAttribute() {}, style: {} }; }, getElementById() { return null; } };
  const carga = (acceso) => { const c = { console, document: doc, window: {}, location: { pathname: '/index.html' } }; vm.createContext(c);
    vm.runInContext(leer('empresa.js').replace(/"?acceso"?: null,/, 'acceso: ' + JSON.stringify(acceso || null) + ',') + ';this.E=Empresa;', c); return c.E; };
  const E = carga();
  ok('sin contraseña solo los preoperacionales y los reportes (v111)', ['reportes.html', 'reportes.html?nuevo=1&pqrs=1', 'preoperacional.html', 'percepcion-peligros.html', 'induccion-responder.html'].every((h) => E.esPublico(E.moduloDeHref(h))));
  ok('permisos, ATS, charlas, EPP, personal y el tablero piden usuario (v111)', ['permiso-trabajo-alturas.html', 'permiso-trabajo-caliente.html', 'permiso-espacios-confinados.html', 'permiso-izajes-cargas.html', 'permiso-trabajo-electrico.html', 'ats.html', 'asistencia.html', 'inspeccion-epp.html', 'inspeccion-epp.html?tipo=brigadista', 'personal-autorizado.html', 'dashboard.html'].every((h) => !E.esPublico(E.moduloDeHref(h))));
  ok('el supervisor de campo siempre tiene lo de la obra (permisos, ATS, charlas, EPP, tablero) (v111)', ['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'asistencia', 'personal', 'epp', 'brigadistas', 'tablero'].every((m) => E.accesoRol(m, 'supervisor')) && carga({ supervisor: ['plan'] }).accesoRol('alturas', 'supervisor'));
  ok('comité y consulta ven el tablero de permisos, pero no abren permisos (v111)', E.accesoRol('tablero', 'comite') && E.accesoRol('tablero', 'consulta') && !E.accesoRol('alturas', 'consulta') && !E.accesoRol('ats', 'comite'));
  ok('el sistema de gestión no es público (plan anual, gerencia, salud, usuarios, comités, indicadores)', ['plan-anual.html', 'gerencia.html', 'salud.html', 'usuarios.html', 'copasst.html', 'convivencia.html', 'indicadores.html', 'cierre-mes.html', 'evidencias.html'].every((h) => !E.esPublico(E.moduloDeHref(h))));
  ok('Administrador y SST ven todo', ['salud', 'usuarios', 'gerencia', 'asesor'].every((m) => E.accesoRol(m, 'admin') && E.accesoRol(m, 'sst')));
  ok('supervisor: inspecciones y plan de acción sí; gerencia, salud y usuarios no', E.accesoRol('inspecciones', 'supervisor') && E.accesoRol('plan', 'supervisor') && !E.accesoRol('gerencia', 'supervisor') && !E.accesoRol('salud', 'supervisor') && !E.accesoRol('usuarios', 'supervisor'));
  ok('comité: COPASST y convivencia sí; salud no', E.accesoRol('copasst', 'comite') && E.accesoRol('convivencia', 'comite') && !E.accesoRol('salud', 'comite'));
  ok('consulta: gerencia, indicadores y evidencias sí; salud, usuarios y convivencia no', E.accesoRol('gerencia', 'consulta') && E.accesoRol('evidencias', 'consulta') && !E.accesoRol('salud', 'consulta') && !E.accesoRol('usuarios', 'consulta') && !E.accesoRol('convivencia', 'consulta'));
  ok('un rol desconocido solo ve lo público', !E.accesoRol('plan', 'otro') && !E.accesoRol('ats', 'otro') && E.accesoRol('preop', 'otro') && E.accesoRol('reportes', 'otro'));
  const E2 = carga({ supervisor: ['plan', 'gerencia'] });
  ok('EMPRESA.acceso cambia la tabla de un rol sin tocar los demás', E2.accesoRol('gerencia', 'supervisor') && !E2.accesoRol('inspecciones', 'supervisor') && E2.accesoRol('copasst', 'comite') && E2.tablaAcceso().supervisor.length === 2);
  const cm = leer('common.js');
  ok('cada página del sistema de gestión se cuida sola: AccesoRol pide entrar o avisa que el rol no tiene acceso', /const AccesoRol = \{/.test(cm) && /if \(!yo\) return 'entrar';/.test(cm) && /Empresa\.accesoRol\(m, yo\.rol\) \? null : 'rol'/.test(cm) && /AccesoRol\.vigilar\(\)/.test(cm));
  ok('sin usuarios en el servidor no se bloquea nada (como antes)', /!Sesion\.modo\(\)\) return null;/.test(cm));
  const sg = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && E.moduloDeHref(f) && !E.esPublico(E.moduloDeHref(f)));
  ok('todas las páginas del sistema de gestión cargan empresa.js y common.js (' + sg.length + ')', sg.length > 25 && sg.every((f) => /<script src="empresa\.js"><\/script>/.test(leer(f)) && /<script src="common\.js"><\/script>/.test(leer(f))), sg.filter((f) => !/<script src="common\.js">/.test(leer(f))).join());
  const ix = leer('index.html');
  ok('inicio: «Sistema de gestión» con su puerta y su contenido aparte', /<section class="sg" id="sg"[ >]/.test(ix) && /id="sgPuerta"/.test(ix) && /id="sgContenido"/.test(ix) && />Sistema de gestión</.test(ix));
  const iSg = ix.indexOf('id="sgContenido"'), iFin = ix.indexOf('id="biblioteca"', iSg), dentro = ix.slice(iSg, iFin), antes = ix.slice(0, ix.indexOf('<section class="sg"'));
  ok('inicio: el plan del mes, pendientes, plan anual, comités y gerencia van dentro del sistema de gestión', /id="pend"/.test(dentro) && /href="plan-anual\.html"/.test(dentro) && /href="copasst\.html"/.test(dentro) && /href="gerencia\.html"/.test(dentro) && !/href="plan-anual\.html"/.test(antes));
  ok('inicio: fuera del sistema de gestión solo el preoperacional y los reportes; la encuesta de peligros la comparte SST (v123)', /href="preoperacional\.html"/.test(antes) && /href="reportes\.html\?nuevo=1"/.test(antes) && /href="reportes\.html\?nuevo=1&amp;pqrs=1"/.test(antes) && !/href="percepcion-peligros\.html"/.test(antes) && !/href="permiso-/.test(antes) && !/href="ats\.html"/.test(antes) && !/href="asistencia\.html"/.test(antes) && !/href="inspeccion-epp\.html/.test(antes) && !/href="dashboard\.html"/.test(antes));
  { const ix = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'), m = /const PREOP_BASE_INDICE = (\[.*?\]);/.exec(ix);
    const pb = fs.readFileSync(path.join(RAIZ, 'preop-base.js'), 'utf8'); const ids = (pb.match(/"id": "[^"]+"/g) || []).length;
    const lst = m ? JSON.parse(m[1]) : [];
    ok('inicio: la lista de preoperacionales base coincide con preop-base.js (si cambias uno, vuelve a generar la lista)', lst.length > 0 && lst.every((f) => pb.includes('"id": "' + f.id + '"') && pb.includes(f.nombre)), lst.length + ' / ' + ids); }
  ok('inicio: permisos, ATS, EPP y personal van dentro del sistema de gestión (v111)', /href="permiso-trabajo-alturas\.html"/.test(dentro) && /href="ats\.html"/.test(dentro) && /href="inspeccion-epp\.html"/.test(dentro) && /href="asistencia\.html"/.test(dentro));
  ok('página de un módulo con usuario en un celular nuevo: pregunta al servidor si hay usuarios (v111)', /_preguntar\(\)/.test(cm) && /action=ping/.test(cm.slice(cm.indexOf('const AccesoRol'))));
  ok('inicio: sin sesión no se muestra nada del sistema de gestión y el buscador no lo destapa', /if \(modo && !yo\) \{\s*cerrar\(true\)/.test(ix) && /oculto-sg/.test(ix) && /classList\.contains\('oculto-sg'\)/.test(ix));
  ok('inicio: sin usuarios avisa que cualquiera puede abrirlo y cómo cerrarlo', /Sin usuarios, cualquiera con el enlace puede abrir el sistema de gestión/.test(ix) && /href="usuarios\.html">Activar los usuarios/.test(ix));
  ok('inicio: pendientes filtrados por el rol', /Empresa\.accesoRol\(Empresa\.moduloDeHref\(x\.modulo\), rol\)/.test(ix));
  ok('usuarios.html muestra qué módulos ve cada rol (de empresa.js)', /Empresa\.tablaAcceso\(\)/.test(leer('usuarios.html')) && /data-rol="supervisor"/.test(leer('usuarios.html')));
  const rt = leer('herramientas/servidor-unico-portal.gs');
  ok('servidor: la obra (5 permisos, ATS, charlas, EPP, personal) pide sesión en el enrutador; el SG-SST (preoperacionales y reportes) no (v112)', /const OBRA_PORTAL = \['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'asistencia', 'epp', 'personal'\];/.test(rt) && /const sinSesion = exigirSesionObra_\(ruta, e, metodo\);/.test(rt) && /function revisarSesionObra\(tokenSesion\)/.test(leer('backends/backend-sgsst.gs')));
  ok('servidor: sin usuarios activos (o sin libro del SG-SST) la obra sigue como antes, solo con la clave', /if \(!r \|\| !r\.modo\) return null;/.test(rt) && /getProperty\('sgsst\.LIBRO'\)\) return null;/.test(rt));
  ok('el sitio manda la sesión a todo el servidor del portal (consultas, envíos y la cola)', /if \(!consulta\.sesion\) \{ const ses = sesionActual\(\); if \(ses\) consulta\.sesion = ses; \}/.test(cm) && /b\.sesion = ses;/.test(cm) && /_delPortal\(url\)/.test(cm));
  ok('Estado: «pide usuario» cuenta como que el servidor funciona', /json\.codigoError === 'SESION'[\s\S]{0,200}Funciona · pide usuario/.test(leer('estado.html')));
  ok('el servidor sigue cuidando la salud aunque alguien abra la página', /SOLO_SST = \[[^\]]*'examen'/.test(leer('backends/backend-sgsst.gs')));
});

grupo('Res. 0312 en la instalación: estándares que aplican, por categoría (v113)', () => {
  const vm = require('vm'), c = {}; vm.createContext(c);
  vm.runInContext(leer('auditorias-plantillas.js') + ';this.g=grupo0312;this.cl=clasificar0312;this.P=PLANTILLAS_AUDITORIA;this.N=NOMBRE_0312;this.A=ARTICULO_0312;', c);
  ok('grupo: 3 (agropecuaria ≤10, riesgo I-III, art. 7), 7 (≤10, art. 3), 21 (11-50, art. 9), 60 (>50 o riesgo IV-V, art. 16)',
    c.g(6, 'I', true) === 3 && c.g(10, 'III', true) === 3 && c.g(6, 'I') === 7 && c.g(11, 'II', true) === 21 && c.g(50, 'III') === 21 && c.g(51, 'I') === 60 && c.g(5, 'IV', true) === 60 && c.g(5, 'V') === 60 &&
    c.A[3] === 'art. 7' && c.A[7] === 'art. 3' && c.A[21] === 'art. 9' && c.A[60] === 'art. 16');
  const tot = (g) => c.cl(g).reduce((s, x) => s + x.n, 0);
  ok('la clasificación por categoría trae todos los estándares de cada grupo (3, 7, 21 y 60)', tot(3) === 3 && tot(7) === 7 && tot(21) === 21 && tot(60) === 60);
  const pesos = {}; c.cl(60).forEach((ci) => ci.categorias.forEach((k) => { pesos[k.nombre] = Math.round(k.peso); }));
  ok('los 60 suman los pesos del art. 27 por categoría (10, 15, 20, 30, 10, 5, 10)', JSON.stringify(pesos) === JSON.stringify({ 'Recursos': 10, 'Gestión integral del SG-SST': 15, 'Gestión de la salud': 20, 'Gestión de peligros y riesgos': 30, 'Gestión de amenazas': 10, 'Verificación del SG-SST': 5, 'Mejoramiento': 10 }), JSON.stringify(pesos));
  ok('ciclos en orden PHVA y los 60 con su nombre oficial', c.cl(60).map((x) => x.ciclo).join() === 'Planear,Hacer,Verificar,Actuar' && c.P.RES0312.items.every((i) => !!c.N[i[0]]) && Object.keys(c.N).length === 60);
  ok('autoevaluación de 3 estándares (agropecuarias) disponible', !!c.P.RES0312_3 && c.P.RES0312_3.items.length === 3 && c.P.RES0312_3.grupo0312 === 3);
  const ce = leer('configurar-empresa.html');
  ok('instalación: paso «Estándares mínimos» con trabajadores, riesgo y unidad agropecuaria, y la lista por categoría', /Estándares mínimos \(Res\. 0312 de 2019\)/.test(ce) && /id="cTrab"/.test(ce) && /id="cRiesgo"/.test(ce) && /id="cAgro"/.test(ce) && /clasificar0312\(g\)/.test(ce) && /<script src="auditorias-plantillas\.js"><\/script>/.test(ce));
  ok('instalación: el perfil queda en el archivo de la empresa (perfil0312) y se vuelve a cargar al abrir', /perfil0312: tipo === 'proveedor' \? undefined : p0312/.test(ce) && /E\.perfil0312\.trabajadores/.test(ce));
  ok('instalación: marca qué módulos apoyan los estándares, sin apagar ninguno', /class="apoya"/.test(ce) && /informativo: no se apaga nada/.test(ce));
  const ui = leer('sgsst-ui.js');
  ok('el portal usa el perfil de la instalación mientras el SG-SST no tenga uno', /function perfilInstalacion\(\)/.test(ui) && /f \? Object\.assign\(\{ id: f\.id \}, f\.resumen\) : perfilInstalacion\(\)/.test(ui) &&
    ['evidencias.html', 'informe.html', 'plan-anual.html', 'documentos.html'].every((f) => /UI\.perfilInstalacion\(\)/.test(leer(f))));
  ok('el perfil de la empresa y el panel del asesor aceptan unidad agropecuaria', /id="peAgro"/.test(ui) && /k: 'agropecuaria'/.test(leer('asesor.html')) && /3 estándares \(unidad agropecuaria/.test(ui));
});

grupo('Diseño v112: barra inferior, señales ISO y tablero con tickets', () => {
  const cm = leer('common.js'), css = leer('common.css'), db = leer('dashboard.html');
  ok('la barra inferior solo sale con sesión y no tapa barras de guardar', /const BarraInferior = /.test(cm) && /if \(!yo \|\| !document\.body/.test(cm) && /function hayOtraBarra\(nav\)/.test(cm) && /\.barra-inferior\{position:fixed/.test(css) && /@media print\{ \.barra-inferior\{display:none !important;\} \}/.test(css));
  ok('Inicio · Permisos · Gestión · Ayuda en la barra', ['index.html', 'dashboard.html', 'index.html#sg', 'ayuda.html'].every((h) => cm.includes("href: '" + h + "'")));
  ok('señales ISO para cada tipo de permiso, ATS y acciones (sin emojis)', /const Iconos = /.test(cm) && ['caliente', 'alturas', 'confinados', 'izajes', 'electrico', 'ats', 'cerrar', 'agregar', 'repetir'].every((k) => new RegExp(k + ": \\['").test(cm)));
  const permisos = fs.readdirSync(RAIZ).filter((f) => /^permiso-.*\.html$/.test(f));
  ok('las tarjetas de inicio de los 5 permisos y del ATS usan señales, no emojis', permisos.length === 5 && permisos.every((f) => !/<div class="icon">[^<]/.test(leer(f)) && /data-senal="/.test(leer(f))) && !/<div class="ico">[^<]/.test(leer('ats.html')));
  ok('tablero: cifras arriba y cada permiso como ticket con su señal, código técnico y barra de vigencia', /id="kAbiertos"/.test(db) && /id="kVencidos"/.test(db) && /class="tk \$\{clase\}"/.test(db) && /Iconos\.senal\(/.test(db) && /tk-cod codigo-tec/.test(db) && /function avance\(it, h\)/.test(db));
  ok('Manrope e IBM Plex Mono van en la caché sin conexión (con licencia OFL)', /manrope-latin-800-normal\.woff2/.test(leer('sw.js')) && existe('fonts/OFL-Manrope.txt') && existe('fonts/ibm-plex-mono-latin-600-normal.woff2') && /ibm-plex-mono-latin-600-normal\.woff2/.test(leer('sw.js')));
});

grupo('Preoperacionales dentro del portal (v106)', () => {
  const I = require(path.join(RAIZ, 'herramientas/importar-formularios.js')), ex = JSON.parse(leer('pruebas/fixtures/formularios-ejemplo.json'));
  const r = I.importar(ex, [{ id: 'prueba', nombre: 'Equipo de prueba', grupo: 'Corte, desbaste y pulido', url: 'https://forms.gle/EJEMPLO' }, { id: 'otro', nombre: 'Otro', grupo: 'X', url: 'https://forms.gle/NOESTA' }]);
  const d = r.defs[0], qs = d.paginas.reduce((a, p) => a.concat(p.items), []), q = (k) => qs.find((x) => x.k === k);
  ok('importador: el formulario tal cual (título, código, descripción, 3 páginas, títulos de sección y preguntas en orden)', d.titulo === 'INSPECCIÓN GENERAL DE EQUIPO DE PRUEBA' && d.codigo === 'SSTA-F-999' && d.paginas.length === 3 && d.paginas[1].titulo === 'Revisión del equipo' && d.paginas[1].descripcion === 'Revisa antes de conectar.' && qs.map((x) => x.k).join() === 'p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11');
  ok('importador: tipos, obligatorias, opciones, «Otra», cuadrícula y saltos de sección (Sí → enviar, No → página 3)', q('p3').tipo === 'lista' && q('p3').opciones.join() === 'Armador,Ayudante,Soldador' && q('p3').obligatoria && q('p6').tipo === 'titulo' && q('p8').tipo === 'cuadricula' && q('p8').filas.length === 3 && q('p11').otra === true && JSON.stringify(q('p9').saltos) === '["fin",2]');
  ok('importador: la lista «NOMBRE - CÉDULA» NO se copia (se elige del Personal habilitado) y las imágenes quedan anotadas', q('p1').tipo === 'persona' && !q('p1').opciones && !JSON.stringify(r.defs).includes('1000000001') && d.notas.some((n) => /imagen/.test(n)));
  ok('importador: papel de cada pregunta (responsable, fecha, cargo, equipo, centro) y respuestas «Malo» marcadas', q('p1').rol === 'responsable' && q('p2').rol === 'fecha' && q('p3').rol === 'cargo' && q('p4').rol === 'equipo' && q('p5').rol === 'centro' && q('p7').malas.join() === 'Malo' && q('p8').malasCol.join() === 'Malo' && !q('p9').malas);
  ok('importador: dice cuáles no encontró y cuáles no pudo abrir', r.faltan.length === 1 && r.faltan[0].id === 'otro' && r.conError.length === 1);
  ok('importador: sin lista de enlaces de nadie (sin enlaces.json monta todos los formularios del archivo)', I.ENLACES.length === 0 && /: enlacesDeTodos\(exportado\)\);/.test(leer('herramientas/importar-formularios.js')));
  const pg = leer('preoperacional.html');
  ok('motor: páginas con atrás/siguiente, obligatorias, saltos, «qué encontraste» con foto, firma opcional, sin señal (cola) y PDF/CSV', /function siguiente\(\)/.test(pg) && /Te falta' \+ \(faltan\.length > 1/.test(pg) && /data-hall=/.test(pg) && /UI\.padHTML\('pfFirma'\)/.test(pg) && /SGSST\.enviar\(\{ action: 'guardar', tipo, id, doc \}/.test(pg) && /function csv\(/.test(pg) && /function pdf\(/.test(pg));
  ok('motor: los centros de trabajo y los códigos de formato salen de empresa.js (v125: o del nombre que les puso la empresa)', /if \(q\.rol === 'centro'\) \{ const c = EMPRESA\.centrosCosto/.test(pg) && /function codigoDe\(f\)\{ if \(f\.codigoEmpresa\) return f\.codigoEmpresa; if \(!f\.codigo\) return ''; const x = EMPRESA\.formatos/.test(pg));
  const { crearEntorno } = require('./simulador-apps-script'), crypto = require('crypto');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1], E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'));
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
  const doc = { formulario: 'prueba', nombreFormulario: 'Equipo de prueba', fecha: '2026-10-06', responsable: 'Ana', resultado: 'SIN NOVEDAD', malos: 0, detalle: 'Pregunta: respuesta\nOtra: x', respuestas: [] };
  P({ action: 'guardar', tipo: 'preop', id: 'PRE-1', doc, opId: 'x1' }); P({ action: 'guardar', tipo: 'preopsalud', id: 'PRE-2', doc: Object.assign({}, doc, { formulario: 'condiciones-salud', autorizaSalud: true }), opId: 'x2' });
  ok('servidor: tipos preop y preopsalud con su hoja legible (el detalle con saltos de línea)', !!E.hojas.Preoperacionales && !!E.hojas['Condiciones de salud (preoperacional)'] && G({ action: 'list', tipo: 'preop' }).rows[0].resumen.detalle === 'Pregunta: respuesta\nOtra: x');
  const sal = () => crypto.randomBytes(16).toString('hex'), pr = (c, s) => crypto.pbkdf2Sync(c, Buffer.from(s, 'hex'), 100000, 32, 'sha256').toString('base64');
  const sA = sal(), adm = P({ action: 'primerAdmin', codigo: E.ctx.codigoAdministrador(), usuario: 'adm', nombre: 'Admin', salt: sA, iter: 150000, pruebaNueva: pr('Clave2026x', sA), opId: 'u1' });
  ok('con usuarios: quien usa el equipo llena el preoperacional sin usuario (como en Google), pero no lo cambia', P({ action: 'guardar', tipo: 'preop', id: 'PRE-3', doc, opId: 'x3' }).ok && P({ action: 'guardar', tipo: 'preopsalud', id: 'PRE-4', doc: Object.assign({}, doc, { autorizaSalud: true }), opId: 'x4' }).ok && P({ action: 'guardar', tipo: 'preop', id: 'PRE-3', doc, versionBase: 1, opId: 'x5' }).codigoError === 'SESION');
  const sT = sal(); P({ action: 'guardarUsuario', sesion: adm.sesion, usuario: 'sup', nombre: 'Sup', rol: 'supervisor', salt: sT, iter: 150000, pruebaNueva: pr('Temporal1x', sT), opId: 'u2' });
  const e1 = P({ action: 'entrar', usuario: 'sup', prueba: pr('Temporal1x', sT), opId: 'e1' }), sL = sal(); const SL = P({ action: 'cambiarMiClave', sesion: e1.sesion, prueba: pr('Temporal1x', sT), salt: sL, iter: 150000, pruebaNueva: pr('ClaveSup2026', sL), opId: 'c1' }).sesion;
  ok('condiciones de salud: solo Administrador y SST las ven (el supervisor ve los preoperacionales de equipos)', G({ action: 'list', tipo: 'preop,preopsalud', sesion: SL }).rows.every((x) => x.tipo === 'preop') && G({ action: 'list', tipo: 'preop,preopsalud', sesion: adm.sesion }).rows.some((x) => x.tipo === 'preopsalud'));
  ok('integración: módulo apagable, en la caché, origen de acciones y enlace desde el plan de acción', /'preoperacional\.html': 'preop'/.test(leer('empresa.js')) && leer('sw.js').includes("'./preoperacional.html'") && leer('sw.js').includes("'./preop-formularios.js'") && leer('sgsst-ui.js').includes("'Preoperacional'") && /\^PRE-/.test(leer('plan-accion.html')) && existe('preop-formularios.js'));
});

grupo('Plan sugerido, cierre del mes, QR y evidencias (v105)', () => {
  const PS = require(path.join(RAIZ, 'plan-sugerido.js')), EV = require(path.join(RAIZ, 'evidencias-reglas.js'));
  const pel = [{ clasificacion: 'Condiciones de seguridad', subtipo: 'Trabajo en alturas', peligro: 'Caída desde andamio', expuestos: 4 }, { clasificacion: 'Biomecánico', peligro: 'Posturas prolongadas', expuestos: 10 }];
  const p7 = PS.proponer({ grupo: 7, trabajadores: 6, responsable: 'Ana', peligros: [] }), p60 = PS.proponer({ grupo: 60, trabajadores: 80, responsable: 'Ana', peligros: pel, sustancias: 3, vehiculos: 2, contratistas: 1 });
  const k = (l) => l.map((x) => x.clave);
  ok('plan sugerido: con menos de 10 trabajadores propone vigía (no COPASST mensual) y no lo de 21/60', k(p7).includes('vigia') && !k(p7).includes('copasst') && !k(p7).includes('auditoria') && !k(p7).includes('rendicion'));
  const pc = PS.proponer({ grupo: 60, trabajadores: 0, copasst: true, peligros: [] });
  ok('plan sugerido: con COPASST registrado (sin perfil) no mezcla COPASST y vigía', k(pc).includes('copasst') && /del COPASST/.test(pc.find((x) => x.clave === 'cap-copasst').actividad) && !k(pc).includes('vigia'));
  ok('plan sugerido: 60 estándares con alturas, biomecánico, químicos, vehículos y contratistas en la matriz/inventario', ['copasst', 'alturas-cap', 'alturas-prog', 'biomecanico', 'sga-cap', 'pesv', 'contratistas', 'rendicion', 'auditoria'].every((c) => k(p60).includes(c)) && !k(p60).includes('confinados'));
  ok('plan sugerido: cada actividad dice por qué, con responsable y meses; la de alturas lleva los expuestos como meta', p60.every((x) => x.por && x.meses.length && x.responsable) && p60.find((x) => x.clave === 'alturas-cap').metaPersonas === 4 && /4 expuestos/.test(p60.find((x) => x.clave === 'alturas-cap').por));
  ok('plan sugerido: lo que ya está en el plan (por clave o nombre) no se repite', PS.faltantes(p60, [{ clave: 'copasst' }, { actividad: 'Simulacro de evacuación' }, { actividad: 'Capacitaciones por peligros prioritarios (charlas)' }, { actividad: 'Inspecciones (otro nombre)', auto: 'inspecciones' }]).every((x) => ['copasst', 'simulacro', 'charlas', 'inspecciones'].indexOf(x.clave) === -1) && PS.faltantes(p60, []).length === p60.length);
  const vm = require('vm'), cA = {}; vm.createContext(cA); vm.runInContext(leer('auditorias-plantillas.js') + ';this.P = PLANTILLAS_AUDITORIA;', cA);
  const hoy = '2026-10-06', rows = [
    { id: 'EMPRESA-PERFIL', tipo: 'empresa', resumen: {} },
    { id: 'DOC-KIT-DESIGNACION', tipo: 'documento', resumen: { versionDoc: '1', fechaAprobacion: '2026-02-01', proximaRevision: '2027-02-01', estado: 'Vigente' } },
    { id: 'T1', tipo: 'trabajador', resumen: { activo: true, cedula: '1', req: { seguridad_social: { fecha: '2026-10-01', vence: '2026-11-01' }, induccion: { fecha: '2026-01-10', vence: '2027-01-10' } } } },
    { id: 'T2', tipo: 'trabajador', resumen: { activo: true, cedula: '2', req: { seguridad_social: { fecha: '2026-08-01', vence: '2026-09-01' } } } },
    { id: 'PAT-2026', tipo: 'plananual', resumen: { anio: '2026', programadas: 30, cumplimiento: 80, firmado: true, capProgramadas: 5, capEjecutadas: 4 } },
    { id: 'EX1', tipo: 'examen', resumen: { cedula: '1', fecha: '2026-03-01' } }];
  const items60 = cA.P.RES0312.items;
  return EV.evaluar(items60, { rows, perfil: { responsableSST: 'Ana' }, hoy, esSst: true }).then((l) => {
    const e = (id) => l.find((x) => x.id === id);
    ok('evidencias: un resultado por cada uno de los 60 estándares', l.length === 60 && l.every((x) => ['ok', 'parcial', 'falta', 'manual', 'reservado'].includes(x.e)));
    ok('evidencias: responsable con designación aprobada → al día; PILA de 1 de 2 personas → incompleto; plan firmado → al día', e('1.1.1').e === 'ok' && e('1.1.4').e === 'parcial' && /1 de 2 personas/.test(e('1.1.4').ev[0]) && e('2.4.1').e === 'ok');
    ok('evidencias: lo que el portal no registra queda «revisar a mano» con la indicación', e('1.1.5').e === 'manual' && /Dec\. 2090/.test(e('1.1.5').que) && e('3.1.5').e === 'falta' && e('1.1.5').registrable === true);   // v148: la custodia se registra en Matrices ISO; lo manual admite «No aplica»
    return EV.evaluar(items60, { rows, perfil: {}, hoy, esSst: false });
  }).then((l2) => {
    ok('evidencias: quien no es SST no ve los estándares de salud individual (exámenes, diagnóstico)', ['3.1.1', '3.1.2', '3.1.4', '3.1.6'].every((id) => l2.find((x) => x.id === id).e === 'reservado'));
    const r = EV.resumen([{ e: 'ok', valor: 3 }, { e: 'falta', valor: 1 }]);
    ok('evidencias: el porcentaje se pondera por el valor del estándar', r.pct === 75 && r.ok === 1 && r.falta === 1);
    const ci = leer('cierre-mes.html'), ix = leer('index.html'), em = leer('empresa.js');
    ok('cerrar el mes: lista de cierre (7 puntos), informe PDF y registro CIE-AAAA-MM', /Datos del mes para los indicadores/.test(ci) && /UI\.cabecera\('SG-CIERRE-MES'/.test(ci) && /Registros\.guardar\('cierremes', cierre \? cierre\.id : 'CIE-' \+ k\.m/.test(ci) && /CERRADO CON PENDIENTES/.test(ci));
    ok('QR: etiqueta por equipo y hoja de todo el inventario; el enlace #ins= abre su inspección (con ?e= en multiempresa)', /function enlaceEquipo/.test(leer('inspecciones.html')) && /'#ins=' \+ encodeURIComponent\(id\)/.test(leer('inspecciones.html')) && /\?e=' \+ encodeURIComponent\(EMPRESA\.codigo\)/.test(leer('inspecciones.html')) && /window\.addEventListener\('hashchange', abrirDesdeHash\)/.test(leer('inspecciones.html')) && leer('inspecciones.html').includes('<script src="qr.js"></script>'));
    { const f = /return (\/\^\[a-z0-9-\]\+[^;]*?\/i)\.test\(v\)/.exec(ix); const re = f && eval(f[1]);
      ok('QR en un celular nuevo del sitio multiempresa: después de escribir el código vuelve al equipo (#ins=…)', re && re.test('inspecciones.html#ins=EQP-EXT-01') && !re.test('https://otro.sitio/x.html') && !re.test('javascript:alert(1)')); }
    ok('autoevaluación desde la carpeta de evidencias (se sugiere, no se cierra sola)', /function desdeEvidencias/.test(leer('auditorias.html')) && /r: x\.r === 'C' \? 'C' : ''/.test(leer('auditorias.html')) && /estado: 'PROGRAMADA'/.test(leer('auditorias.html')));
    ok('módulos nuevos: en el inicio, apagables en empresa.js y el configurador, en la caché y en el manual', ['cierre-mes.html', 'evidencias.html'].every((f) => ix.includes('href="' + f + '"') && leer('sw.js').includes("'./" + f + "'")) &&
      /'cierre-mes\.html': 'cierre', 'evidencias\.html': 'evidencias'/.test(em) && /\['cierre', /.test(leer('empresa-motor.js')) && ['plan-sugerido.js', 'evidencias-reglas.js'].every((f) => leer('sw.js').includes("'./" + f + "'")) &&
      ["id: 'cierre'", "id: 'qr'", "id: 'evidencias'", "id: 'pendientes'", "id: 'plananual'"].every((t) => leer('ayuda.html').includes(t)));
    ok('formatos nuevos con su nombre en empresa.js y en el configurador', ['SG-CIERRE-MES', 'SG-EVIDENCIAS', 'SG-ETIQUETAS-QR'].every((f) => (f in datosEmpresa().formatos) && leer('configurar-empresa.html').includes("'" + f + "'")));
    ok('inicio: lista de pendientes (míos/todos, copia sin señal, enlaces solo a páginas del portal)', /action=pendientes/.test(ix) && /data-f="mios"/.test(ix) && /ssta-pendientes/.test(ix) && /\^\[a-z0-9-\]\+\\\.html/.test(ix));
  });
});

grupo('Inicio en el orden del mes (v104)', () => {
  const ix = leer('index.html');
  const orden = ['id="jornada"', 'id="planear"', 'id="ejecutar"', 'id="comites"', 'id="cerrar"', 'id="mejorar"', 'id="administrar"'].map((x) => ix.indexOf(x));
  ok('secciones en el orden del mes: jornada, 1 planear, 2 ejecutar, 3 comités, 4 medir y cerrar, 5 revisar y mejorar, administrar', orden.every((v, i) => v > 0 && (i === 0 || v > orden[i - 1])), orden.join(','));
  const modulos = Object.keys(eval('({' + /const MODULO_DE = \{([\s\S]*?)\};/.exec(leer('empresa.js'))[1] + '})'));
  const enInicio = modulos.filter((f) => f !== 'asesor.html');   // v115: el panel del asesor es de la consola del administrador
  ok('cada módulo del portal tiene su tarjeta en el inicio (el panel del asesor, en la consola)', enInicio.every((f) => ix.includes('href="' + f + '"')) && leer('admin.html').includes('href="asesor.html"'), enInicio.filter((f) => !ix.includes('href="' + f + '"')).join(', '));
  ok('las tarjetas usan íconos de línea, no emojis', !/class="card-icon">[^<]/.test(ix) && /<symbol id="i-ats"/.test(ix));
  ok('cronograma del mes con la línea de hoy y lo que toca', /id="gantt"/.test(ix) && /class="g-hoy"/.test(ix) && /toca <b>/.test(ix));
  ok('la letra va dentro del sitio (sin señal se ve igual) y en la caché', /@font-face\{font-family:'IBM Plex Sans'/.test(leer('common.css')) && !/fonts\.googleapis\.com\/css2/.test(leer('common.css') + ix) && ['400', '500', '600'].every((w) => existe('fonts/plex-sans-' + w + '.woff2') && leer('sw.js').includes("'./fonts/plex-sans-" + w + ".woff2'")) && existe('fonts/OFL-IBM-Plex.txt'));
  ok('el botón de la clave cambia su texto sin borrar el ícono', /btnClave\.querySelector\('\.btn-txt'\)\.textContent/.test(ix));
});

grupo('Manual de uso y videos (v103)', () => {
  const a = leer('ayuda.html'), g = leer('herramientas/grabar-videos.js');
  const hrefs = [...a.matchAll(/href: '([a-z-]+\.html)'/g)].map((m) => m[1]);
  ok('manual: ' + hrefs.length + ' guías y cada una abre un módulo que existe', hrefs.length >= 15 && hrefs.every((h) => existe(h)), hrefs.filter((h) => !existe(h)).join(', '));
  const vids = [...a.matchAll(/video: '([a-z-]+)'/g)].map((m) => m[1]);
  const guiones = Object.keys(eval('(' + /const GUIONES = (\{[\s\S]*?\n\});/.exec(g)[1].replace(/async (\w+)\(p\) \{[\s\S]*?\n  \}/g, '$1: 1') + ')'));
  ok('cada video del manual tiene su guion de grabación', vids.length >= 8 && vids.every((v) => guiones.includes(v)), vids.filter((v) => !guiones.includes(v)).join(', '));
  // v130: tokens de diseño — ningún tamaño de letra ni radio escrito a mano (fuera de lo que se imprime)
  { const SALTA = ['config.js', 'empresa.js', 'preop-base.js', 'preop-formularios.js', 'inspecciones-plantillas.js', 'ats-catalogo.js', 'gtc45-catalogo.js', 'sw.js', 'qr.js', 'iconos-emoji.js', 'ayuda-guias.js', '404.html'];
    const sinPrint = (t) => { let out = '', i = 0; const re = /@media\s+print\s*\{/g; let m; while ((m = re.exec(t))) { out += t.slice(i, m.index); let j = re.lastIndex, d = 1; while (j < t.length && d) { if (t[j] === '{') d++; else if (t[j] === '}') d--; j++; } i = j; re.lastIndex = j; } return out + t.slice(i); };
    const malos = [];
    fs.readdirSync(RAIZ).filter((f) => /\.(html|css|js)$/.test(f) && SALTA.indexOf(f) === -1).forEach((f) => {
      const t = sinPrint(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
      (t.match(/font-size:\s*(\d+(?:\.\d+)?)px/g) || []).forEach((x) => { const v = parseFloat(x.replace(/[^\d.]/g, '')); if (v >= 10.5 && v <= 44) malos.push(f + ' ' + x); });
      (t.match(/border-radius:\s*\d+(?:\.\d+)?px\s*(?=[;"'}!])/g) || []).forEach((x) => malos.push(f + ' ' + x));
    });
    ok('v130: tamaños de letra y radios salen de los tokens (var(--fs-…), var(--r-…)), no escritos a mano', !malos.length, malos.slice(0, 8).join(' | '));
    // v131: colores de la paleta (common.css) en vez de escritos a mano; solo quedan los decorativos poco usados.
    let sueltos = 0;
    fs.readdirSync(RAIZ).filter((f) => /\.(html|css|js)$/.test(f) && SALTA.indexOf(f) === -1).forEach((f) => {
      const t = fs.readFileSync(path.join(RAIZ, f), 'utf8');
      (t.match(/(?<![-\w])(?:color|background(?:-color)?|border(?:-[a-z]+)?|outline|fill|stroke|box-shadow)\s*:\s*[^;"'{}<>]+/g) || []).forEach((d) => { if (!/url\(/.test(d)) sueltos += (d.match(/#(?!fff\b|ffffff\b|000\b|000000\b)[0-9a-fA-F]{6}\b/g) || []).length; });
    });
    ok('v131: los colores salen de la paleta; quedan pocos escritos a mano (solo decorativos)', sueltos <= 190, sueltos + ' colores sueltos');   // v155: +5 del índice del paquete para el cliente (HTML suelto que el servidor vuelve PDF: sin la hoja de estilos del portal)   // v149: el modo oscuro trae su propia paleta (bloque prefers-color-scheme de common.css)
    const nativas = [];
    fs.readdirSync(RAIZ).filter((f) => /\.(html|js)$/.test(f) && f !== 'dialogo.js' && SALTA.indexOf(f) === -1).forEach((f) => {
      const t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); (t.match(/(?<![.\w])(alert|confirm|prompt)\(/g) || []).forEach((x) => nativas.push(f + ' ' + x));
      if (/Dialogo\./.test(t) && /\.html$/.test(f) && !/src="dialogo\.js"/.test(t)) nativas.push(f + ' usa Dialogo sin cargar dialogo.js');
    });
    ok('v132: sin ventanas grises del navegador (alert/confirm/prompt): todas son del portal (Dialogo)', !nativas.length, nativas.slice(0, 6).join(' | '));
    ok('v131: utilidades para lo que se repetía en línea (márgenes, nota, fila…)', /\.u-mt8\{/.test(leer('common.css')) && /\.u-nota\{/.test(leer('common.css')));
    const cc = leer('common.css');
    ok('v130: los tokens están definidos en un solo lugar (common.css)', ['--r-xs', '--r-s', '--r-m', '--r-l', '--r-xl', '--r-2xl', '--r-pill', '--fs-etiqueta', '--fs-menor', '--fs-base', '--fs-titulo', '--fs-campo', '--fs-display', '--fs-subtitulo', '--fs-h1', '--fs-hero', '--tinta', '--azul', '--foco'].every((v) => new RegExp(v + ':').test(cc)));
    const cm = leer('common.js');
    ok('v130: accesibilidad común: foco visible, nombres para botones de ícono, avisos que se anuncian, diálogos y esqueleto de carga', /:focus-visible/.test(cm) && /aria-label/.test(cm) && /aria-live/.test(cm) && /role', 'dialog'/.test(cm) && /esqueleto/.test(cm) && /prefers-reduced-motion/.test(cm)); }
  ok('manual con preguntas frecuentes (sin señal, clave, datos de salud) y filtro por rol', /¿Qué pasa si no hay señal\?/.test(a) && /¿Quién ve los datos de salud\?/.test(a) && /const ROLES_AYUDA = /.test(a));
  ok('el inicio enlaza el manual y queda en la caché; abre sin empresa en el sitio multiempresa', leer('index.html').includes('href="ayuda.html"') && leer('sw.js').includes("'./ayuda.html'") && leer('empresa.js').includes('ayuda\\.html'));
});

grupo('Consola del administrador general, aparte de los clientes (v115)', () => {
  const ad = leer('admin.html'), em = leer('empresa.js'), co = leer('common.js'), as = leer('asesor.html'), es = leer('estado.html'), cf = leer('configurar-empresa.html'), ix = leer('index.html');
  ok('admin.html y asesor.html son páginas de la consola: usan la configuración del sitio, nunca la de la empresa abierta', /const PAGINAS_CONSOLA = \['admin\.html', 'asesor\.html'\]/.test(em) && /else if \(enConsola\) \{[\s\S]{0,160}E\.codigo = ''; delete E\.sinEmpresa;/.test(em) && /const cargada = !enConsola && !editar/.test(em));
  ok('la sesión, la clave y la caché de la consola van aparte (ssta-admin-…) y cambiar de empresa no las borra', /get KEY\(\) \{ return Consola\.clave\('ssta-sesion'\)/.test(co) && /get KEY\(\) \{ return Consola\.clave\('ssta-clave-portal'\)/.test(co) && /localStorage\.getItem\(Consola\.clave\(k\)\)/.test(co) && /!\/\^ssta-admin-\/\.test\(k\)/.test(em) && /'ssta-admin-cli:'/.test(as));
  ok('la consola entra solo con usuario Administrador de tu servidor (o crea el primero con el código de Apps Script)', /yo\.rol !== 'admin'/.test(ad) && /action: 'primerAdmin'/.test(ad) && /sgsst__codigoAdministrador/.test(ad) && /noindex/.test(ad));
  ok('consola: clientes con estado del servidor (en vivo), módulos publicados, tareas y su portal', /async function revisar\(x\)/.test(ad) && /action=ping/.test(ad) && /empresas\/' \+ encodeURIComponent\(c\) \+ '\.json/.test(ad) && /asesor\.html#cli=/.test(ad) && /configurar-empresa\.html\?nueva=1/.test(ad));
  ok('consola: la URL y la clave del cliente se leen de su ficha (no viajan en la lista)', /const d = await SGSST\.doc\(x\.id\); if \(d\) docs\[x\.id\] = d;/.test(ad) && !/resumen\.clave/.test(ad));
  ok('módulos por cliente: el configurador abre su archivo publicado (?editar=) y no copia marcas internas', /ssta-admin-editar/.test(ad) && /E\.editandoCliente = true/.test(em) && /'editandoCliente', 'consola'\]\.indexOf\(k\)/.test(cf) && /id="cModulos"/.test(cf));
  ok('el panel del asesor sin sesión de la consola manda a admin.html, y vuelve a ella', /location\.replace\('admin\.html'\)/.test(as) && /href="admin\.html">← Volver a la consola/.test(as) && /#cli=/.test(as));
  ok('los clientes no ven el panel del asesor (ni en el inicio, ni en la ayuda, ni como módulo en su configuración)', !ix.includes('href="asesor.html"') && !/asesor\.html/.test(leer('ayuda.html')) && /ma\.closest\('label'\)\.hidden = tipo === 'cliente'/.test(cf));
  ok('el estado técnico (enlaces de prueba, clave, versiones) solo en el equipo del administrador', /const TECNICO = typeof Consola !== 'undefined' && Consola\.esEquipoAdmin\(\)/.test(es) && /\$\{TECNICO && r\.url/.test(es) && /function paraCliente/.test(es));
  ok('la consola no lleva la barra ni el chip de los clientes', /if \(Consola\.activa\(\)\) return null;/.test(co) && /classList\.contains\('consola'\)\) return;/.test(co) && /<body class="consola">/.test(ad));
});

grupo('Clientes desde la consola: configuración, módulos firmados y vigilancia (v116)', () => {
  const { crearEntorno } = require('./simulador-apps-script'), crypto = require('crypto');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  // ── Tu servidor (el del sitio): guarda la configuración de cada cliente
  const vm = require('vm'), tmp = path.join(require('os').tmpdir(), 'sgsst-v116.gs');
  fs.writeFileSync(tmp, leer('backends/backend-sgsst.gs').replace("const CORREOS_AVISO = ['pon-aqui-el-correo@empresa.com'];", "const CORREOS_AVISO = ['sst@demo.invalid'];"));
  const E = crearEntorno(tmp);
  const P = (o) => E.post(Object.assign({ token: T }, o));
  const cfg = { nombre: 'ACME S.A.S.', nombreCorto: 'ACME', servidor: 'https://script.google.com/macros/s/ACME/exec', apiToken: 'tok-acme', modulos: { ats: false, pesv: false, caliente: true }, clave: 'NO-DEBE-SALIR' };
  P({ action: 'guardar', tipo: 'cliente', id: 'CLI-1', doc: { nombre: 'ACME S.A.S.', codigo: 'acme-sas', estado: 'ACTIVO', servidor: 'https://script.google.com/macros/s/ACME/exec', modo: 'unico', clave: 'K-1', llaveProveedor: 'llave-acme', config: cfg, publicado: '2026-10-23T10:00:00Z', modulosOn: 1, modulosTotal: 3 }, opId: 'c1' });
  P({ action: 'guardar', tipo: 'cliente', id: 'CLI-2', doc: { nombre: 'Viejo S.A.S.', codigo: 'viejo', estado: 'INACTIVO', config: cfg }, opId: 'c2' });
  const pub = E.get({ action: 'empresaPublica', codigo: 'acme-sas' }, 'sgsst');
  ok('los celulares leen su configuración por el código, sin la clave del servidor del sitio', pub.ok && pub.empresa.nombreCorto === 'ACME' && pub.empresa.modulos.ats === false, JSON.stringify(pub).slice(0, 200));
  ok('la configuración pública nunca lleva la clave ni la llave del proveedor', !JSON.stringify(pub).includes('NO-DEBE-SALIR') && !JSON.stringify(pub).includes('llave-acme') && !JSON.stringify(pub).includes('K-1'));
  ok('cliente inactivo o código que no existe: NOEXISTE (y el celular busca empresas/<código>.json)', E.get({ action: 'empresaPublica', codigo: 'viejo' }, 'sgsst').codigoError === 'NOEXISTE' && E.get({ action: 'empresaPublica', codigo: 'nadie' }, 'sgsst').codigoError === 'NOEXISTE' && E.get({ action: 'empresaPublica', codigo: '../x' }, 'sgsst').ok === false);
  ok('publicar y vigilar desde la red: solo el administrador', /administrador/i.test(P({ action: 'publicarCliente', id: 'CLI-1', opId: 'p0' }).error || '') && /administrador/i.test(P({ action: 'vigilarAhora' }).error || ''));
  // Mensaje firmado a SU servidor
  let enviado = null; E.ctx.__fetch = (url, op) => { enviado = { url, op }; return { codigo: 200, texto: JSON.stringify({ ok: true, apagados: ['ats', 'pesv'] }) }; };
  const env = E.ctx.enviarModulos_({ servidor: 'https://script.google.com/macros/s/ACME/exec', modo: 'unico', llaveProveedor: 'llave-acme', config: cfg });
  const cuerpo = enviado && JSON.parse(enviado.op.payload).__proveedor;
  const firma = cuerpo && crypto.createHmac('sha256', 'llave-acme').update(cuerpo.carga).digest('base64');
  ok('los módulos van firmados (HMAC-SHA256 con la llave del cliente) a la raíz de su servidor', env.ok && enviado.url === 'https://script.google.com/macros/s/ACME/exec' && cuerpo.firma === firma && JSON.parse(cuerpo.carga).apagados.join() === 'ats,pesv', JSON.stringify(env));
  ok('sin llave o con servidor directo del SG-SST no se manda nada', !E.ctx.enviarModulos_({ servidor: 'https://x/exec', modo: 'unico', config: cfg }).ok && !E.ctx.enviarModulos_({ servidor: 'https://x/exec', modo: 'sgsst', llaveProveedor: 'k', config: cfg }).ok);
  // Vigilancia: un servidor responde viejo y sin los módulos; se anota, se reenvían y se avisa por correo
  let reenviados = 0;
  E.ctx.__fetch = (url, op) => { if (op && op.method === 'post') { reenviados++; return { codigo: 200, texto: JSON.stringify({ ok: true, apagados: ['ats', 'pesv'] }) }; } return { codigo: 200, texto: JSON.stringify({ ok: true, version: 'v100', apagados: [], uso: { '2026-11': { reportes: 40, caliente: 3 } } }) }; };
  E.correos.length = 0;
  const v = E.ctx.vigilarClientes();
  // v145: sin usuarios, «cliente» ya no se entrega por la clave pública; se lee directo del libro
  const fila = (() => { const f = E.ctx.leerFila_(E.ctx.filaDe_('CLI-1')); return { id: 'CLI-1', resumen: typeof f.resumen === 'string' ? JSON.parse(f.resumen) : f.resumen }; })();
  ok('vigilancia: prueba cada servidor, anota estado y versión, y reenvía los módulos que le faltan', v.ok && v.revisados === 1 && fila.resumen.estadoServidor === 'ok' && fila.resumen.versionServidor === 'v100' && /por actualizar/.test(fila.resumen.detalleServidor) && reenviados === 1 && fila.resumen.apagadosServidor === 'ats,pesv', JSON.stringify(fila && fila.resumen).slice(0, 300));
  ok('v169: la vigilancia guarda el uso por módulo de cada cliente (lo muestra la consola)', JSON.parse(fila.resumen.usoServidor || '{}')['2026-11'].reportes === 40, String(fila.resumen.usoServidor));
  ok('v169: la consola muestra el uso, lo que no usa y sugiere el plan', /function usoHtml\(s\)/.test(leer('admin.html')) && /No ha usado Obra/.test(leer('admin.html')) && /usoHtml\(s\)/.test(leer('admin.html')));
  ok('vigilancia: avisa por correo lo que está por revisar', E.correos.some((c) => /Servidores de clientes/.test(c[1]) && /ACME/.test(c[2])), JSON.stringify(E.correos).slice(0, 200));
  E.ctx.__fetch = () => { throw new Error('timeout'); };
  const v2 = E.ctx.vigilarClientes_(false);
  ok('vigilancia: un servidor que no responde queda en rojo', v2.resultados[0].estado === 'mal');
  ok('vigilancia: se instala para cada mañana', /cada día/.test(E.ctx.instalarVigilancia()) && E.activadores.some((t) => t.getHandlerFunction() === 'vigilarClientes'));

  // ── SU servidor (servidor único): acepta solo mensajes firmados y bloquea lo apagado
  const U = crearEntorno(fs.readdirSync(path.join(RAIZ, 'servidor-unico')).filter((f) => f.endsWith('.gs')).sort().map((f) => path.join(RAIZ, 'servidor-unico', f)));
  U.propiedades.API_TOKEN = 'token-demo'; U.propiedades.LLAVE_PROVEEDOR = 'llave-cliente';
  const raiz = (o) => U.post(o, '');
  const firmar = (apagados, ts, llave) => { const carga = JSON.stringify({ apagados, ts }); return { __proveedor: { carga, firma: crypto.createHmac('sha256', llave || 'llave-cliente').update(carga).digest('base64') } }; };
  const ts = Date.now();
  ok('su servidor rechaza un mensaje con otra llave', raiz(firmar(['ats'], ts, 'otra')).codigoError === 'FIRMA');
  ok('su servidor rechaza un mensaje viejo', raiz(firmar(['ats'], ts - 3600000)).ok === false);
  const okMsg = raiz(firmar(['ats', 'pesv'], ts));
  ok('su servidor acepta el mensaje firmado y lo cuenta en su raíz', okMsg.ok && okMsg.apagados.join() === 'ats,pesv' && U.get({}, '').apagados.join() === 'ats,pesv');
  ok('el mismo mensaje no se puede repetir', raiz(firmar(['ats'], ts)).ok === false);
  const post = (ruta, o) => U.post(Object.assign({ token: 'token-demo' }, o), ruta);
  ok('lo apagado no se puede registrar: ATS y vehículos del PESV → MODULO', post('ats', { action: 'crear' }).codigoError === 'MODULO' && post('sgsst', { action: 'guardar', tipo: 'vehiculo', id: 'VEH-1', doc: {} }).codigoError === 'MODULO');
  ok('lo contratado sigue igual (un reporte no se bloquea por módulos)', post('sgsst', { action: 'guardar', tipo: 'reporte', id: 'REP-X', doc: {} }).codigoError !== 'MODULO');
  ok('verConfiguracion da la llave, la clave y el scriptId para la consola (no para empresa.js)', /llaveProveedor: '/.test(leer('herramientas/servidor-unico-portal.gs')) && /scriptId: '/.test(leer('herramientas/servidor-unico-portal.gs')) && /function nuevaLlaveProveedor/.test(leer('herramientas/servidor-unico-portal.gs')));
  // ── El sitio
  const mo = leer('empresa-motor.js'), cf = leer('configurar-empresa.html'), ad = leer('admin.html');
  ok('el motor de empresa.js va aparte (se actualiza con el portal) y no pisa uno viejo', /typeof Empresa !== 'undefined'\);/.test(mo) && /\(function \(g, yaTieneMotor\)/.test(mo) && /if \(yaTieneMotor\) return;/.test(mo) && !/const MultiEmpresa/.test(fs.readFileSync(path.join(RAIZ, 'empresa.js'), 'utf8')) && /const motor = '';/.test(cf));
  ok('los celulares toman su configuración de tu servidor y, si no está, de empresas/<código>.json', /action=empresaPublica&codigo=/.test(mo) && /async function delServidor/.test(mo) && /if \(s && !s\.noExiste\) j = s;/.test(mo));
  ok('instalar en un solo flujo: el configurador guarda en tu consola y publica', /id="btnConsola"/.test(cf) && /action: 'publicarCliente'/.test(cf) && /llaveProveedor: x\('llaveProveedor'\)/.test(cf));
  ok('consola: módulos, editar todo, revisar con tu servidor y clientes.json', /async function abrirModulos/.test(ad) && /async function guardarConfig/.test(ad) && /action: 'vigilarAhora'/.test(ad) && /clientes\.json/.test(ad) && /sgsst__instalarVigilancia/.test(ad));
});

grupo('Inicio con «Gestión» y diagnóstico de todo caído (v117)', () => {
  const ix = leer('index.html'), es = leer('estado.html');
  ok('«Gestión» va en el encabezado, entre Estado y Ayuda, con la misma clase de botón', /id="btnGestion"[\s\S]{0,300}href="ayuda\.html"/.test(ix) && /class="btn-clave btn-estado btn-gestion"/.test(ix));
  ok('dos vistas: lo público o el sistema de gestión (#sg), con «Inicio» para volver', /body\.vista-sg #pub\{display:none;\}/.test(ix) && /window\.addEventListener\('hashchange', vista\)/.test(ix) && /id="sgVolver"/.test(ix));
  ok('sin sesión, «Gestión» abre la ventana para entrar', /enSg && hayServidor && typeof Sesion !== 'undefined' && Sesion\.modo\(\) && !Sesion\.yo\(\)/.test(ix));
  ok('movimiento suave que respeta «reducir movimiento»', /@keyframes vistaEntra/.test(ix) && /prefers-reduced-motion: reduce\)\{\.vista-entra/.test(ix));
  ok('estado: si todos fallan igual, un solo diagnóstico (implementación, autorización, /dev, dirección vieja)', /async function diagnosticar\(\)/.test(es) && /Cualquier usuario/.test(es) && /verConfiguracion/.test(es) && /\\\/dev\$/.test(es) && /TODOS los servidores/.test(es));
  ok('la barra inferior lleva a la vista del sistema de gestión', /location\.hash = 'sg'; marcar\('gestion'\)/.test(leer('common.js')));
});

grupo('Instalación como asistente y módulos por categoría (v118)', () => {
  const cf = leer('configurar-empresa.html'), mo = leer('empresa-motor.js');
  ok('primero pregunta qué se instala: tu sitio (administrador) o una empresa cliente', /¿Qué vas a instalar\?/.test(cf) && /data-inst="proveedor"/.test(cf) && /data-inst="cliente"/.test(cf) && /data-inst="propio"/.test(cf));
  ok('un aviso fijo dice todo el tiempo qué se está instalando', /class="que-instalo"/.test(cf) && /'tu sitio \(administrador\)'/.test(cf) && /cliente: \['🏢', 'Instalando:'/.test(cf));
  ok('cada tipo ve solo sus pasos y se numeran en orden', /const VE = \{ cTipo: \['cliente', 'proveedor'\]/.test(cf) && /c0312: \['propio', 'cliente'\]/.test(cf) && /\+\+n/.test(cf));
  ok('al terminar tu sitio, los siguientes pasos (consola, usuario, vigilancia, primer cliente)', /sgsst__codigoAdministrador/.test(cf) && /sgsst__instalarVigilancia/.test(cf));
  ok('los 42 módulos están en una categoría', (() => { const vm = require('vm'), cx = { EMPRESA: {} }; cx.globalThis = cx; vm.createContext(cx); vm.runInContext(mo.replace(/\}\)\(typeof globalThis[\s\S]*$/, '})(globalThis, true);'), cx); const t = cx.CATALOGO_MODULOS.map((x) => x[0]), c = [].concat(...cx.CATEGORIAS_MODULOS.map((x) => x[3])); return t.length === c.length && t.every((k) => c.indexOf(k) !== -1); })());
  ok('módulos plegables por categoría, con «Todos / Ninguno» y paquetes que nunca apagan reportes ni usuarios', /<details class="mod-cat"/.test(cf) && /data-todos/.test(cf) && /PLANES_PORTAL/.test(cf));
  { // v165: los tres planes
    const sb = { EMPRESA: { modulos: {} }, console }; sb.window = sb; sb.globalThis = sb; try { require('vm').runInNewContext(fs.readFileSync(path.join(RAIZ, 'empresa-motor.js'), 'utf8'), sb); } catch (e) { /* lo de la página (DOM) no corre aquí: basta el catálogo */ }
    const g = sb.PLANES_PORTAL ? sb : sb.window, P = g.PLANES_PORTAL || {}, todos = (g.CATALOGO_MODULOS || []).map((x) => x[0]);
    const deLista = (l) => { const m = {}; todos.forEach((k) => { m[k] = !l || l.indexOf(k) !== -1; }); return m; };
    ok('v175: planes Micro 7, SG-SST Esencial, SG-SST + Obra e Integral; todos traen reportes y usuarios y solo módulos que existen', Object.keys(P).join() === 'micro,sgsst,sgsstObra,integral' && Object.keys(P).every((k) => !P[k].mods || (P[k].mods.indexOf('reportes') !== -1 && P[k].mods.indexOf('usuarios') !== -1 && P[k].mods.every((x) => todos.indexOf(x) !== -1))), JSON.stringify(Object.keys(P)));
    const m = deLista(P.sgsstObra && P.sgsstObra.mods); const m2 = Object.assign({}, m, { ambiental: true });
    ok('v165: el configurador reconoce el plan por los módulos prendidos, y «personalizado» si se toca uno suelto', g.planDeModulos(m) === 'sgsstObra' && g.planDeModulos(deLista(P.sgsst.mods)) === 'sgsst' && g.planDeModulos(deLista(null)) === 'integral' && g.planDeModulos(m2) === '');
    // v166: el SG-SST es la base: trae todo el ciclo de la 0312 con EPP, capacitación, contratistas y proveedores; Obra nunca va sola
    const CICLO = ['plananual', 'peligros', 'inspecciones', 'indicadores', 'copasst', 'convivencia', 'auditorias', 'salud', 'plan', 'emergencias', 'revision', 'epp', 'asistencia', 'contratistas', 'proveedores', 'dotacion', 'induccion'];
    ok('v166: todo plan que se vende (salvo Micro 7) trae el ciclo completo del SG-SST (con EPP, capacitación, contratistas y proveedores)', Object.keys(P).every((k) => k === 'micro' || !P[k].mods || CICLO.every((x) => P[k].mods.indexOf(x) !== -1)), JSON.stringify(Object.keys(P).map((k) => [k, CICLO.filter((x) => P[k].mods && P[k].mods.indexOf(x) === -1)])));
    ok('v166: «Obra» es un complemento (no un plan que se venda solo) y el paquete SG-SST + Obra = la base + Obra', !P.obra && g.COMPLEMENTOS_PORTAL && g.COMPLEMENTOS_PORTAL.obra.mods.every((x) => P.sgsstObra.mods.indexOf(x) !== -1) && P.sgsst.mods.every((x) => P.sgsstObra.mods.indexOf(x) !== -1));
    // v170: la lista de módulos va agrupada igual que se vende
    const CAT = g.CATEGORIAS_MODULOS || [], enCat = [].concat(...CAT.map((c) => c[3]));
    ok('v170: los módulos se agrupan como se venden: Base SG-SST, Complemento Obra, Solo en Integral y las herramientas internas', CAT.map((c) => c[0]).join() === 'base,obra,integral,interno' &&
      JSON.stringify(CAT[0][3]) === JSON.stringify(P.sgsst.mods) && JSON.stringify(CAT[1][3]) === JSON.stringify(g.COMPLEMENTOS_PORTAL.obra.mods), CAT.map((c) => c[1] + ':' + c[3].length).join(' | '));
    ok('v170: cada módulo está en un solo grupo y ninguno queda por fuera', todos.every((k) => enCat.indexOf(k) !== -1) && enCat.length === new Set(enCat).size, todos.filter((k) => enCat.indexOf(k) === -1).join(','));
    ok('v170: el panel del asesor no es parte de ningún plan (prenderlo o apagarlo no cambia el plan)', g.MODULOS_INTERNOS.indexOf('asesor') !== -1 && g.planDeModulos(Object.assign(deLista(null), { asesor: false })) === 'integral' && g.planDeModulos(Object.assign(deLista(P.sgsst.mods), { asesor: true })) === 'sgsst');
    // v166: documentos comerciales: fuente en comercial/, nunca en el sitio público, y el anexo de módulos sale del código
    const COM = ['PROPUESTA.md', 'CONTRATO.md', 'PRECIOS.md', 'DPA.md', 'SLA.md', 'REVENDEDOR.md'];
    ok('v166: comercial/ tiene propuesta, contrato y los cuatro anexos, y no se publica en el sitio', COM.every((f) => fs.existsSync(path.join(RAIZ, 'comercial', f))) && /'comercial'/.test(leer('herramientas/empaquetar.js')) && /--exclude comercial/.test(leer('.github/workflows/pruebas.yml')));
    const tab = require(path.join(RAIZ, 'herramientas', 'comercial.js')).modulosPorPlan();
    ok('v166: la tabla «Módulos por plan» del Anexo 1 sale de PLANES_PORTAL (los mismos planes y módulos del configurador)', Object.keys(P).every((k) => tab.indexOf(P[k].nombre) !== -1) && /\| Trabajo en alturas \| — \| — \| Sí \| Sí \|/.test(tab) && /\| Inspección de EPP \| Sí \| Sí \| Sí \| Sí \|/.test(tab), tab.slice(0, 300));
    const ctr = fs.readFileSync(path.join(RAIZ, 'comercial', 'CONTRATO.md'), 'utf8'), pre = fs.readFileSync(path.join(RAIZ, 'comercial', 'PRECIOS.md'), 'utf8');
    ok('v175: el contrato dice que los datos nunca se bloquean y que a los 60 días de vencida la licencia el portal queda en solo lectura (igual en la licencia del portal) y nombra los planes que existen', /En ningún caso EL PROVEEDOR impide el acceso a los datos ni borra información/.test(ctr) && /modo de solo lectura/.test(ctr) && /solo lectura/.test(leer('licencia.html')) && /hasta el valor pagado/.test(leer('licencia.html')) && /Micro 7, SG-SST Esencial, SG-SST \+ Obra o Integral/.test(ctr) && /«Obra» no se vende solo/.test(pre) && /\{\{MODULOS_POR_PLAN\}\}/.test(pre));
  }
  ok('lo oculto no se ve aunque el CSS lo muestre (radios, panel del asesor en clientes)', /\.tipos\[hidden\],\.mods label\[hidden\]/.test(cf));
});

grupo('Instalar más fácil: un solo archivo, página guiada y paquete por pasos (v119)', () => {
  const ins = leer('instalar.html'), por = leer('herramientas/servidor-unico-portal.gs'), em = leer('herramientas/empaquetar.js');
  require('../herramientas/armar-servidor-unico').armar();
  const uno = leer('servidor-todo-en-uno/Portal-SSTA.gs');
  ok('el servidor completo en un solo archivo, con los datos de la empresa arriba y se puede cargar', /DATOS DE LA EMPRESA \(cambia solo esto\)/.test(uno) && uno.indexOf('const EMPRESA_NOMBRE') < uno.indexOf('function instalar()') && (() => { try { new (require('vm').Script)(uno); return true; } catch (e) { return false; } })());
  ok('el archivo único trae los 8 archivos del servidor', ['00-Portal.gs', '10-permisos.gs', '11-personal.gs', '12-ats.gs', '13-asistencia.gs', '14-epp.gs', '15-sgsst.gs'].every((f) => uno.includes('═════════ ' + f)));
  ok('el actualizador saca los datos de la empresa de un proyecto con el archivo único', /const EMPRESA_NOMBRE =/.test(uno) && /extraerDatosEmpresa/.test(leer('herramientas/actualizar-servidores.js')));
  ok('instalar() guarda correos y contacto: actualizar pegando el archivo nuevo no los pierde', /p\.setProperty\('CORREOS'/.test(por) && /getProperty\('CORREOS'\)/.test(por) && /function contactoEpp_\(\)/.test(por) && /contactoEpp_\(\)\.whatsapp/.test(leer('servidor-unico/14-epp.gs')));
  ok('página «Instalar paso a paso»: dos caminos, franja de qué se instala, pasos con «Listo» y progreso guardado', /data-camino="a"/.test(ins) && /data-camino="b"/.test(ins) && /class="franja /.test(ins) && /data-hecho=/.test(ins) && /ssta-instalar/.test(ins));
  ok('la página prueba el servidor y dice qué está mal (/dev, acceso, autorización, no encontrado)', /async function probar\(paso\)/.test(ins) && /\/dev\$/.test(ins) && /Cualquier usuario/.test(ins) && /Se necesita autorización/.test(ins));
  ok('copiar el servidor con un toque y la consola instala clientes por la página guiada', /data-copiar/.test(ins) && /servidor-todo-en-uno\/Portal-SSTA\.gs/.test(ins) && /href="instalar\.html\?para=cliente"/.test(leer('admin.html')));
  ok('el paquete sale por pasos: servidor, sitio en tandas de menos de 100 y empresa.js aparte', /PASO-1-SERVIDOR/.test(em) && /1-paginas/.test(em) && /3-solo-la-primera-vez/.test(em) && /cuenta\(d\) >= 100/.test(em));
  ok('la página de instalar abre sin empresa elegida y queda en la caché', /instalar\\\.html/.test(leer('empresa-motor.js')) && leer('sw.js').includes("'./instalar.html'"));
});

grupo('Módulos por ?modulo= (v120)', () => {
  const c = leer('common.js');
  ok('las llamadas a «…/exec/<módulo>» se reescriben a «…/exec?modulo=<módulo>» (Google pedía iniciar sesión)', /v120: los módulos por \?modulo=/.test(c) && /'\?modulo=' \+ m\[2\]/.test(c) && /b\.__consulta\.modulo = m\[2\]/.test(c));
  ok('el servidor ya entiende ?modulo=', /e\.parameter\.modulo/.test(leer('herramientas/servidor-unico-portal.gs')));
});

grupo('Caché y despliegue', () => {
  const sw = leer('sw.js');
  const v = /const CACHE_NAME = '([^']+)'/.exec(sw);
  ok('sw.js define CACHE_NAME', !!v, 'Sin subirlo, los celulares siguen con la versión vieja.');

  // Todo archivo servido debe estar listado en la caché
  const listados = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  const enDisco = fs.readdirSync(RAIZ).filter(f => /\.(html|css|js|json|png)$/.test(f) && f !== 'sw.js');
  enDisco.forEach(f => {
    ok(`${f} está en la caché del Service Worker`, listados.includes(f),
       'Si falta, esa página no funciona sin señal.');
  });

  // Todo lo listado debe existir de verdad
  listados.filter(f => f && f !== '').forEach(f => {
    ok(`${f} existe en el repositorio`, existe(f), 'Está en la caché pero el archivo no está.');
  });

  const man = JSON.parse(leer('manifest.json'));
  ok('manifest.json es válido y tiene íconos', Array.isArray(man.icons) && man.icons.length > 0);
  man.icons.forEach(i => ok(`  ícono ${i.src} existe`, existe(i.src.replace('./', ''))));
  ok('hay un ícono maskable con margen propio',
     man.icons.some(i => i.purpose === 'maskable'),
     'Android recorta los maskable en círculo; con el logo ancho se cortan las letras.');
});

/* ═══════════════════════════════════════════════════════════
   7. ACCESIBILIDAD — se usa a pleno sol y con guantes
   ═══════════════════════════════════════════════════════════ */
grupo('Legibilidad en obra', () => {
  const css = leer('common.css');
  const lum = (h) => {
    h = h.replace('#', '');
    const c = [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  const muted = /--ink-muted:\s*(#[0-9a-fA-F]{6})/.exec(css);
  ok('existe --ink-muted para el texto secundario', !!muted);
  if (muted) ok(`--ink-muted cumple 4.5:1 sobre blanco (${ratio(muted[1], '#ffffff').toFixed(2)}:1)`,
                ratio(muted[1], '#ffffff') >= 4.5);

  const grisesMalos = ['#aab3ba', '#8a97a3'];
  ['common.css', 'inspeccion-epp.html', 'dashboard.html', 'index.html'].forEach(f => {
    const t = leer(f);
    grisesMalos.forEach(g => {
      // se ignoran los comentarios, donde el color aparece solo como explicación
      const sinComentarios = t.replace(/\/\*[\s\S]*?\*\//g, '');
      ok(`${f} no usa ${g} (contraste insuficiente)`, !sinComentarios.includes(g));
    });
  });

  const touch = /--touch:\s*(\d+)px/.exec(css);
  ok('el alto mínimo táctil es de al menos 44px', touch && Number(touch[1]) >= 44,
     touch ? `--touch: ${touch[1]}px` : 'no se encontró --touch');
});

/* ═══════════════════════════════════════════════════════════
   8. SINTAXIS — que nada quede roto al pegar un archivo
   ═══════════════════════════════════════════════════════════ */
grupo('Sintaxis de todos los archivos', () => {
  fs.readdirSync(RAIZ).filter(f => f.endsWith('.js')).forEach(f => {
    let bien = true, err = '';
    try { new Function(leer(f)); } catch (e) { bien = false; err = e.message; }
    ok(`${f} compila`, bien, err);
  });
  const gs = [];
  const rec = (d) => fs.readdirSync(path.join(RAIZ, d)).forEach(x => {
    const rel = path.join(d, x);
    if (fs.statSync(path.join(RAIZ, rel)).isDirectory()) rec(rel);
    else if (x.endsWith('.gs')) gs.push(rel);
  });
  if (existe('backends')) rec('backends');
  gs.forEach(f => {
    let bien = true, err = '';
    try { new Function(leer(f)); } catch (e) { bien = false; err = e.message; }
    ok(`${f} compila`, bien, err);
  });
  fs.readdirSync(RAIZ).filter(f => f.endsWith('.html')).forEach(f => {
    const t = leer(f);
    ok(`${f} tiene los <div> balanceados`,
       (t.match(/<div/g) || []).length === (t.match(/<\/div>/g) || []).length);
    const bloques = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    bloques.forEach((b, i) => {
      let bien = true, err = '';
      try { new Function(b); } catch (e) { bien = false; err = e.message; }
      ok(`${f} · bloque <script> ${i + 1} compila`, bien, err);
    });
  });
  const css = leer('common.css');
  ok('common.css tiene las llaves balanceadas',
     (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
  // v134: enlaces rotos — todo href/src relativo de cada página (y los «x.html» dentro de sus scripts) existe
  const rotos = [];
  fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html')).forEach((f) => {
    const s = leer(f);
    const refs = [...s.matchAll(/\b(?:href|src)=["']([^"'#?]+)/g)].map((m) => m[1])
      .concat([...s.matchAll(/["'`]([a-z0-9-]+\.html)(?:[?#][^"'`]*)?["'`]/g)].map((m) => m[1]));
    refs.forEach((r) => { if (/^(https?:|mailto:|tel:|sms:|data:|javascript:|blob:|\/\/)|\$\{|' *\+|^\s*$/.test(r)) return;
      if (!fs.existsSync(path.join(RAIZ, decodeURIComponent(r)))) rotos.push(f + ' → ' + r); });
  });
  ok('v134: ningún enlace roto entre páginas (href, src y páginas nombradas en los scripts)', !rotos.length, [...new Set(rotos)].slice(0, 12).join(' | '));
  ok('v134: hay página 404, condiciones de uso, robots.txt que no indexa e imagen para compartir', ['404.html', 'terminos.html', 'og.png'].every((x) => fs.existsSync(path.join(RAIZ, x))) && /Disallow: \//.test(leer('robots.txt')));
  const sinOg = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html') && !/property="og:image"/.test(leer(f)));
  ok('v134: todas las páginas traen título, descripción e imagen al compartir el enlace (y noindex)', !sinOg.length, sinOg.join(', '));
  ok('v134: contra spam: campo trampa en el portal y límite de envíos sin usuario en el servidor', /sstaTrampa/.test(leer('common.js')) && /function antiSpam_/.test(leer('backends/backend-sgsst.gs')) && /antiSpam_\(tipo, body/.test(leer('backends/backend-sgsst.gs')));
});

grupo('v145: seguridad y errores de la segunda ronda de revisores', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1], E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'));
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-XSS', doc: { accion: 'x', responsable: 'y', fechaCompromiso: '2030-01-01', firmaResponsable: 'data:image/png" onerror="alert(1)', estado: '=IMAGE("https://x")' }, opId: 'x1' });
  const d = G({ action: 'doc', id: 'ACC-XSS' }).doc || {}, fila = E.hojas.Registros.filas.find((f) => f[0] === 'ACC-XSS') || [];
  ok('una «imagen» con código escondido se descarta antes de guardarla (XSS almacenado)', d.firmaResponsable === '' || d.firmaResponsable === undefined, JSON.stringify(d.firmaResponsable));
  ok('ninguna celda de «Registros» queda como fórmula (estado, fecha, vence, id)', /const valores = \[celda_\(id\), celda_\(tipo\), version, celda_\(c\.estado\), celda_\(c\.fecha\)/.test(leer('backends/backend-sgsst.gs')) && fila.length > 0);
  const m = E.ctx.reensamblar_([{ key: 'doc~1/3', texto: 'A1' }, { key: 'doc~2/3', texto: 'A2' }, { key: 'doc~3/3', texto: 'A3' }, { key: 'doc~1/2', texto: 'B1' }, { key: 'doc~2/2', texto: 'B2' }]);
  ok('si quedaron trozos de un guardado anterior, se arma solo la última versión', m.doc === 'B1B2', m.doc);
  const c = leer('common.js'), pc = leer('permiso-core.js'), sw = leer('sw.js'), b = leer('backends/backend-sgsst.gs'), su = leer('servidor-unico/00-Portal.gs');
  ok('el botón «Dictar» vuelve a tener texto e ícono', /b\.innerHTML = MIC_SVG \+ 'Dictar';   \/\/ v143/.test(c));
  ok('permisos: la justificación de la excepción queda; sin lista del personal se pregunta', /f\.excepcion = h\.excepcion/.test(pc) && /No se pudo verificar si estas personas están habilitadas/.test(leer('common.js')));
  ok('las páginas pintan las firmas solo si son imágenes de verdad', ['ats.html', 'personal-autorizado.html', 'asistencia.html'].every((f) => /srcSeguro\(/.test(leer(f))) && /function srcSeguro/.test(c));
  ok('ningún otro servidor escribe celdas que se vuelvan fórmula', ['backend-ats.gs', 'backend-asistencia.gs', 'backend-epp.gs', 'backend-personal-autorizado.gs', 'permisos/core.gs'].every((f) => /function filaSegura_/.test(leer('backends/' + f)) && /function sinImagenesFalsas_/.test(leer('backends/' + f))));
  ok('consulta y comité no guardan ni borran en permisos, ATS, charlas, EPP ni personal', /metodo === 'doPost' && \(r\.rol === 'consulta' \|\| r\.rol === 'comite'\)/.test(su));
  ok('envíos sin usuario: tope de tamaño y sin campos del área SST; sin usuarios no se leen las conexiones a clientes', /El envío es demasiado grande/.test(b) && /'origen', 'asignadaPor', 'investigacion'/.test(b) && !/tipo === 'cliente'\) && tipo !== 'buzon'/.test(b));
  ok('sesión comparada en tiempo constante y usuario inexistente sin pista por el tiempo', /igualSeguro_\(hmac_\(p\[1\]\), p\[2\]\)/.test(b) && /Utilities\.sleep\(250/.test(b));
  ok('service worker: copia fresca y el resto se baja después de activar; un envío cortado sin opId no se repite', /cache: 'reload'/.test(sw) && /setTimeout\(\(\) => guardarTodos\(RESTO\), 5000\)/.test(sw) && /err\.name === 'AbortError' && esPost/.test(c));
  ok('documentos internos (.md, .docx) y servidores fuera del sitio publicado', /--exclude '\*\.md' --exclude '\*\.docx'/.test(leer('.github/workflows/pruebas.yml')));
});

grupo('v146–v147: jornada del supervisor, ISO y RUC', () => {
  const vm = require('vm');
  const { armar, SALIDA } = require('../herramientas/armar-servidor-unico');
  const { crearEntorno } = require('./simulador-apps-script');
  const E = crearEntorno(armar().map((f) => path.join(SALIDA, f)), { sinLibroActivo: true, urlServicio: 'https://script.google.com/macros/s/PRUEBA/exec' });
  E.ctx.instalar();
  const T = E.propiedades.CLAVE_PORTAL;
  const P = (o) => E.post(Object.assign({ token: T }, o), 'alturas');
  const enH = (h) => new Date(Date.now() - 5 * 3600000 + h * 3600000).toISOString(), F2 = enH(2).slice(0, 10), H2 = enH(2).slice(11, 16), F3 = enH(3).slice(0, 10), H3 = enH(3).slice(11, 16);   // v148: ampliar solo hacia adelante y dentro de 24 h
  const a = P({ permitCode: 'TA-NOV1', status: 'ABIERTO', firstSave: true, opId: 'o1', responsable: 'Ana', sitio: 'Torre', hastaFecha: '2030-01-01', hastaHora: '17:00', ejecutantes: [{ nombre: 'Ana', cc: '52111222' }] });
  const amp = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n1', novedad: { tipo: 'ampliar', hastaFecha: F2, hastaHora: H2, quien: 'Ana', nota: 'condiciones revisadas' } });
  const rep = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n1', novedad: { tipo: 'ampliar', hastaFecha: F2, hastaHora: H2 } });
  const sus = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n2', novedad: { tipo: 'suspender', nota: 'tormenta' } });
  const tur = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n3', novedad: { tipo: 'turno', quien: '=Luis', cedula: '79111222', nota: 'avance 50%' } });
  const mala = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n4', novedad: { tipo: 'borrar' } });
  const sinHora = P({ action: 'novedad', permitCode: 'TA-NOV1', opId: 'n5', novedad: { tipo: 'ampliar', hastaHora: 'mañana' } });
  const todas = Object.values(E.libros).flatMap((l) => Object.values(l.hojas || {})).concat(Object.values(E.hojas));
  const hoja = todas.find((h) => (h.filas || []).some((r) => r[0] === 'TA-NOV1'));
  const fila = hoja && hoja.filas.find((r) => r[0] === 'TA-NOV1'), reg = fila ? JSON.parse(fila[2]) : {};
  ok('permiso: ampliar, suspender y entregar turno quedan en el permiso sin reescribirlo', a.ok && amp.ok && sus.ok && tur.ok && (reg.novedades || []).length === 3 && reg.hastaHora === H2 && reg.suspendido === true && reg.responsableTrabajo === '=Luis', JSON.stringify(reg.novedades));
  ok('permiso: la novedad repetida (mismo opId) no se duplica; tipo o fecha inválidos se rechazan', rep.ok && !mala.ok && !sinHora.ok);
  ok('permiso: la vigencia nueva queda en la columna del tablero y el responsable no se vuelve fórmula', fila && String(fila[8]) === H2 && String(fila[5]) === '=Luis' && /setValue\(filaSegura_\(item\.quien\)\)/.test(leer('backends/permisos/core.gs')), JSON.stringify(fila && fila.slice(5, 9)));
  // v147 (revisor de flujos): el cierre ya no borra excepción, novedades ni personal agregado por otro equipo.
  P({ permitCode: 'TA-MRG', status: 'ABIERTO', firstSave: true, opId: 'm1', createdAt: '2030-01-01T07:00:00Z', responsable: 'Ana', hastaFecha: '2030-01-01', hastaHora: '17:00',
      ejecutantes: [{ nombre: 'Camilo', cc: '1033445566', habilitacion: ['Curso vencido'], excepcion: 'rescate listo y supervisión directa', autorizo: 'SST' }] });
  P({ action: 'addWorkers', permitCode: 'TA-MRG', opId: 'm2', newWorkers: [{ nombre: 'Nelson', cc: '1100112233' }] });
  P({ action: 'novedad', permitCode: 'TA-MRG', opId: 'm3', novedad: { tipo: 'ampliar', hastaFecha: F3, hastaHora: H3 } });
  const cierre = P({ permitCode: 'TA-MRG', status: 'CERRADO', opId: 'm4', createdAt: '2030-01-01T18:00:00Z', responsable: 'Ana', hastaFecha: '2030-01-01', hastaHora: '17:00', ejecutantes: [{ nombre: 'Camilo', cc: '1033445566' }] });
  const todas2 = Object.values(E.libros).flatMap((l) => Object.values(l.hojas || {})).concat(Object.values(E.hojas));
  const fm = (todas2.find((h) => (h.filas || []).some((r) => r[0] === 'TA-MRG')) || { filas: [] }).filas.find((r) => r[0] === 'TA-MRG'), rm = fm ? JSON.parse(fm[2]) : {};
  const cam = (rm.ejecutantes || []).find((x) => x.cc === '1033445566');
  ok('cierre: conserva la excepción de habilitación, la fecha de creación, las novedades, la vigencia ampliada y el personal agregado', cierre.ok && rm.status === 'CERRADO' && cam && cam.excepcion && rm.createdAt === '2030-01-01T07:00:00Z' && (rm.novedades || []).length === 1 && rm.hastaHora === H3 && (rm.ejecutantes || []).some((x) => x.cc === '1100112233'), JSON.stringify(rm).slice(0, 400));
  const cc = leer('common.js'), atsH = leer('ats.html'), pc = leer('permiso-core.js');
  ok('salir: borra el borrador y las plantillas del ATS y avisa si hay envíos sin subir', /\^\(ats-borrador\|ats-plantillas\)/.test(cc) && /async salirSeguro\(\)/.test(cc) && /Sesion\.salirSeguro\(\)/.test(leer('index.html')));
  ok('ATS guardado sin señal también se puede repetir mañana', /v147: también se puede repetir mañana[\s\S]{0,120}ssta-ats-ultimo/.test(atsH));
  ok('agregar personal: sin señal queda en cola y el aviso dice «agregar», no «abrir»', /await Outbox\.add\(getWebAppUrl\(\), payload\)/.test(pc) && /revisarHabilitacion_\(filasNuevas, true\)/.test(pc) && /No se puede agregar a estas personas al permiso/.test(pc));
  const core = leer('permiso-core.js');
  ok('permiso nuevo: repetir el último y prellenar fecha, hora, responsable y sitio sin pisar nada', /id = 'btnRepetirAyer'/.test(core) && /function prellenarBasicos_/.test(core) && /recordarUltimoPermiso_\(\)/.test(core) && /!String\(el\.value \|\| ''\)\.trim\(\)/.test(core));
  ok('checklist en lenguaje claro (Cumple / No aplica) y botones de 48 px', /label: 'Cumple'/.test(core) && /label: 'No aplica'/.test(core) && /div\.toggle button\{min-height:48px/.test(leer('common.css')));
  const dash = leer('dashboard.html');
  ok('tablero: aviso 30 minutos antes del vencimiento y dos permisos en la misma área', /function avisosJornada/.test(dash) && /v\.minutos > 30/.test(dash) && /en la misma área/.test(dash));
  ok('charla con temas sugeridos; EPP directo al formulario; serial del arnés', /function pintarTemasSug/.test(leer('asistencia.html')) && /q\.get\('nuevo'\) !== '1'/.test(leer('entrega-epp.html')) && /id="serialEquipo"/.test(leer('inspeccion-epp.html')));
  const pa = leer('plan-accion.html');
  ok('acción correctiva: no se cierra sin causa raíz', /correctiva\/i\.test\(actual\.tipoAccion/.test(pa) && /extra\.causaRaiz/.test(pa));
  const rd = leer('revision-direccion.html');
  ok('revisión por la dirección: entradas ISO al final sin mover las revisiones guardadas', /const ASPECTOS_V3 = ASPECTOS\.concat\(ASPECTOS_ISO\)/.test(rd) && /aspectosV === 2 \? ASPECTOS : ASPECTOS_V1/.test(rd));
  const ind = leer('indicadores.html');
  const f = new Function('atMes', 'dias', 'hht', 'const iF = atMes * 240000 / hht, iS = dias * 240000 / hht; return iF * iS / 1000;');
  ok('RUC: índice de severidad por HHT e ILI = IF × IS ÷ 1.000', /iSevHht/.test(ind) && /r\.iFrecIncHht \* r\.iSevHht \/ 1000/.test(ind) && Math.abs(f(2, 30, 480000) - 0.015) < 1e-9);
  const g = leer('backends/backend-sgsst.gs');
  ok('matrices ISO: cinco tipos nuevos en el servidor y su pantalla', ['competencia', 'auditorint', 'calibracion', 'comunicacion', 'retencion'].every((t) => new RegExp('\\n  ' + t + ': \\{ hoja:').test(g)) && /matrices-iso\.html/.test(leer('sw.js')) && /href="matrices-iso\.html"/.test(leer('index.html')));
  ok('calidad: sistema, exclusiones 4.3 y consulta 45001 5.4; matriz legal con otros requisitos; aspectos con ciclo de vida', /k: 'sistema'/.test(leer('calidad.html')) && /exclusionesT/.test(leer('calidad.html')) && /consultaT/.test(leer('calidad.html')) && /tipoRequisito/.test(leer('documental.html')) && /seg\('cicloVida'/.test(leer('ambiental.html')));
  ok('bloqueo por equipo: 5 fallos bloquean ese equipo; la cuenta entera solo con 20', /'fallo:' \+ u\.usuario \+ ':' \+ disp/.test(g) && /u\.intentos >= \(disp \? 20 : 5\)/.test(g) && /disp \}\);/.test(leer('common.js')));
  const dlg = leer('dialogo.js'); let verbo; vm.runInNewContext(dlg.match(/function verbo[\s\S]*?\n  \}/)[0] + ';this.v=verbo', (verbo = {}));
  ok('confirmaciones con el verbo de la acción en vez de «Aceptar»', verbo.v('confirmar', '¿Borrar este registro?') === 'Borrar' && verbo.v('confirmar', 'Esto es raro') === 'Sí, continuar' && !/'Aceptar'/.test(dlg));
  ok('instalar.html y la guía dicen lo obligatorio (administrador, RESPALDO_EXTERNO, restauración)', /RESPALDO_EXTERNO/.test(leer('instalar.html')) && /probarRestauracion/.test(leer('instalar.html')) && /RESPALDO_EXTERNO/.test(leer('herramientas/guia/hacer-guia.js')) && /const VERSION = /.test(leer('herramientas/guia/hacer-guia.js')));
});

grupo('v148: lo que encontraron los 14 revisores por módulo', () => {
  const vm = require('vm');
  const INF = require(path.join(RAIZ, 'informe-reglas.js'));
  // Indicadores: días por mes calendario y AT sin ausencia registrada
  const rows = [
    { tipo: 'reporte', resumen: { clase: 'Accidente de trabajo', fecha: '2024-01-31', lesionadoCc: '111', diasIncapacidad: 16, diasCargados: 0 } },
    { tipo: 'ausencia', resumen: { causa: 'Accidente de trabajo', cedula: '111', inicio: '2024-01-31', fin: '2024-02-15' } },
    { tipo: 'reporte', resumen: { clase: 'Accidente de trabajo', fecha: '2024-02-10', lesionadoCc: '222', diasIncapacidad: 10, diasCargados: 0 } },
    { tipo: 'reporte', resumen: { clase: 'Accidente de trabajo', fecha: '2024-02-20', lesionadoCc: '333', diasIncapacidad: 0, diasCargados: 0, mortal: true } },
    { tipo: 'mes', resumen: { mes: '2024-01', trabajadores: 100 } }, { tipo: 'mes', resumen: { mes: '2024-02', trabajadores: 100 } }];
  const en = INF.diasAT(rows, '2024-01'), fe = INF.diasAT(rows, '2024-02');
  ok('indicadores: la incapacidad cuenta en el mes en que se pierde (1 en enero, 15 en febrero) y el AT sin ausencia suma sus días', en.incapacidad === 1 && fe.incapacidad === 15 + 10, JSON.stringify([en, fe]));
  ok('indicadores: AT mortal sin días cargados = 6.000 (ANSI Z16.1) y queda avisado', fe.cargados === 6000 && fe.mortalSinCargados === true);
  ok('indicadores: Gerencia, Cierre del mes e Indicadores usan el mismo cálculo', /INFORME\.mesInd\(rows, m\)/.test(leer('gerencia.html')) && /INFORME\.diasAT\(rows, m\)/.test(leer('cierre-mes.html')) && /INFORME\.diasAT\(D\.reportes/.test(leer('indicadores.html')));
  const an = INF.anual(rows.filter((x) => x.tipo !== 'reporte'), '2024', '2024-12-31');
  ok('indicadores: sin accidentes la proporción de mortales es «—», no 0 %', an.mortalidad === null);
  // Servidor SG-SST
  const { armar, SALIDA } = require('../herramientas/armar-servidor-unico');
  const { crearEntorno } = require('./simulador-apps-script');
  const E = crearEntorno(armar().map((f) => path.join(SALIDA, f)), { sinLibroActivo: true, urlServicio: 'https://script.google.com/macros/s/PRUEBA/exec' });
  E.ctx.instalar();
  const ES = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const q = ES.ctx.quorumActa_;
  ok('comités: el servidor calcula el quórum (no el celular)', q([{ calidad: 'Principal', representa: 'Empleador', asistio: 'Sí' }, { calidad: 'Principal', representa: 'Trabajadores', asistio: 'No' }, { calidad: 'Suplente', representa: 'Trabajadores', asistio: 'Sí' }]) === true
    && q([{ calidad: 'Principal', representa: 'Empleador', asistio: 'Sí' }, { calidad: 'Principal', representa: 'Trabajadores', asistio: 'No' }, { calidad: 'Principal', representa: 'Trabajadores', asistio: 'No' }]) === false);
  const req = { medico: { apto: 'Apto', soporte: 'data:image/png;base64,AAA', restricciones: 'x' }, alturas: { soporte: 'data:image/png;base64,BBB' } };
  ES.ctx.sinRestricciones_(req);
  ok('salud: a quien no es SST no le llega la foto del concepto médico (sí la del curso)', req.medico.soporte === '' && req.medico.restricciones === '(reservado)' && !!req.alturas.soporte);
  const g = leer('backends/backend-sgsst.gs');
  ok('salud: supervisor y comité crean el preoperacional de salud pero no leen ni cambian uno guardado', /if \(existe && \(SOLO_SST\.indexOf\(tipo\) !== -1/.test(g) && /puedeLeer_\(tipo\) \? \{ ok: true, id: id, version: version, resumen/.test(g));
  ok('salud: sin usuario SST de verdad (clave pública) no se ven restricciones ni concepto', /function sstConSesion_/.test(g) && /v\[1\] === 'trabajador' && !sstConSesion_\(\)/.test(g));
  ok('salud: el respaldo externo no va por defecto al asesor y avisa que es confidencial', !/prop \|\| pf\.correoAsesor/.test(g) && /CONFIDENCIAL: incluye datos de salud/.test(g));
  ok('salud: los adjuntos de salud del personal y las incapacidades de un reporte solo para SST; la lesión del AT tampoco', /Este soporte solo lo ven el administrador y SST/.test(g) && /doc\.lesionado = \{ nombre: doc\.lesionado\.nombre/.test(g));
  ok('salud: el celular no guarda copia de las listas de salud, quejas ni buzón', /RESERVADOS: \['examen', 'ausencia', 'perfil', 'sve', 'pvecaso', 'psico', 'preopsalud', 'cliente', 'queja', 'buzon'\]/.test(leer('common.js')));
  ok('comités: quejas y actas de Convivencia solo para su comité y SST; motivo y temas no van a la hoja', /function deConvivencia_/.test(g) && /function actaReservada_/.test(g) && /'convivencia' \? '' : corto_\(d\.motivo/.test(g));
  ok('comités: inhabilidad bloquea, periodo de 2 años exactos, texto de la extraordinaria', /Falta la declaración de inhabilidad/.test(leer('comites.js')) && /Festivos\.sumarDias\(sumarAnios\(UI\.hoy\(\), 2\), -1\)/.test(leer('comites.js')) && /intervención inmediata/.test(leer('convivencia.html')));
  // Habilitación
  const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, Date, JSON, Math, String, Object, Array, RegExp, Number, setTimeout };
  vm.createContext(ctx);
  const com = leer('common.js');
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'empresa.js'), 'utf8').split('/* ════')[0].replace('const EMPRESA', 'this.EMPRESA') + ';var EMPRESA=this.EMPRESA;' +
    com.slice(com.indexOf('const Festivos = {')).replace(/window\.addEventListener\([\s\S]*?\n\}\);\n/g, '') + ';this.H=Habilitacion;this.F=Festivos;', ctx);
  const H = ctx.H, hoy = ctx.F.hoy(), mas = (n) => ctx.F.sumarDias(hoy, n);
  const base = { seguridad_social: { fecha: mas(-5), vence: mas(25) }, induccion: { fecha: mas(-30), vence: mas(300) }, medico: { fecha: mas(-30), vence: mas(300), apto: 'Apto' }, alturas: { fecha: mas(-30), vence: mas(5) } };
  H._mapa = { '1': { nombre: 'A', activo: true, req: base }, '2': { nombre: 'B', activo: true, req: Object.assign({}, base, { medico: { fecha: mas(-30), vence: mas(300), apto: 'Apto con restricciones' } }) },
    '3': { nombre: 'C', activo: true, req: Object.assign({}, base, { medico: { fecha: mas(-30), vence: mas(300) } }) }, '4': { nombre: 'D', activo: true, req: Object.assign({}, base, { alturas: { fecha: mas(-600) } }) } };   // curso de 18 meses sin «vence»
  ok('habilitación: en alturas, «apto con restricciones» no pasa sin SST; en trabajo general solo avisa', H.revisar('2', ['alturas']).estado === 'mal' && H.revisar('2', []).estado !== 'mal');
  ok('habilitación: concepto médico sin aptitud registrada = no habilitado', H.revisar('3', []).estado === 'mal');
  ok('habilitación: curso sin fecha de vencimiento se calcula con su vigencia (ya no queda vigente para siempre)', H.revisar('4', ['alturas']).estado === 'mal');
  ok('habilitación: un permiso que termina después del vencimiento del curso no pasa', H.revisar('1', ['alturas'], mas(10)).estado === 'mal' && H.revisar('1', ['alturas'], mas(2)).estado !== 'mal');
  ok('habilitación: en alto riesgo, quien no está en Personal habilitado no pasa', H.revisar('999', ['confinados']).estado === 'mal' && H.revisar('999', []).estado === 'sin-registro');
  ok('habilitación: una sola regla (Habilitacion.exigir) en permisos, ATS y registro diario; «hoy» en hora de Colombia', /async exigir\(filas, contexto, op\)/.test(com) && /Date\.now\(\) - 5 \* 3600000/.test(com));
  // Permisos de alto riesgo
  const pc = leer('permiso-core.js');
  ok('permisos: una verificación crítica en «No» no deja abrir y no se marca en bloque', /Verificación crítica sin cumplir/.test(pc) && /\.check-item:not\(\.critico\)/.test(pc) && /const CRITICO_RE = .*sin tensi/.test(pc));
  ok('permisos: máximo una jornada; no se cierra con personal adentro ni «finalizado» si está suspendido', /máximo ' \+ maxH \+ ' horas/.test(pc) && /El personal debe estar fuera del área/.test(pc) && /El permiso está suspendido: reanúdalo/.test(pc));
  ok('permisos: confinados no abre sin lectura de gases en rango ni amplía/reanuda sin lectura reciente', /Medición de gases antes de entrar/.test(leer('permiso-espacios-confinados.html')) && /lectura de gases \(menú «Registrar lectura de gases»\) de los últimos 15 minutos/.test(pc));
  ok('permisos: vigía de fuego y 30 min de vigilancia (caliente); vigía y conteo (confinados); LOTO y reenergización (eléctrico); WLL y certificados (izaje)',
    /vigiaFuegoNombre/.test(leer('permiso-trabajo-caliente.html')) && /Menos de 30 minutos/.test(leer('permiso-trabajo-caliente.html')) && /conteoSalieron/.test(leer('permiso-espacios-confinados.html')) && /lotoTabla/.test(leer('permiso-trabajo-electrico.html')) && /tierrasRetiradas/.test(leer('permiso-trabajo-electrico.html')) && /0\.75 \* w/.test(leer('permiso-izajes-cargas.html')));
  ok('permisos: entregar turno pide cédula y aceptación; el servidor exige ejecutante y amplía solo hacia adelante', /Cédula de ' \+ n\.quien/.test(pc) && /El permiso necesita al menos un ejecutante/.test(leer('backends/permisos/core.gs')) && /dentro de las próximas 24 horas/.test(leer('backends/permisos/core.gs')));
  // ATS y charla
  const ats = leer('ats.html'), bats = leer('backends/backend-ats.gs'), basi = leer('backends/backend-asistencia.gs');
  ok('ATS: la copia sube «copia de» y la revisión de hoy; el servidor rechaza la copia sin revisión; no copia firmantes finales', /copiaDe: c\.copiaDe/.test(ats) && /Este ATS es copia de otro: confirma que se revisó hoy/.test(bats) && !/f\[k\]\.nombre = \(c\.firmas/.test(ats));
  ok('ATS: lo rechazado por conflicto queda recuperable en el servidor y el resumen dice qué falta', /'ATS rechazados'/.test(bats) && /peligro\(s\) sin control/.test(bats));
  ok('charla: sin tildes en nombres y lugares, no pisa el tema con vacío, deja rastro de quién se quitó', /function sinTildes_/.test(basi) && /return n \|\| texto_\(previo\[k\]\)/.test(basi) && /quitados\.push/.test(basi));
  // AT e investigación
  const rep = leer('reportes.html');
  ok('AT: cada rol del equipo investigador es otra persona y «COPASST» no cuenta como SST; licencia obligatoria si es grave', /«representante del COPASST» no cuenta/.test(rep) && /el número de la licencia en SST/.test(rep));
  ok('AT: corregir no cambia la fecha de terminación; validación de radicados; gravedad editable; cierre exige FURAT, investigación y acción', /prev\.estado === 'CERRADA' && prev\.fecha \? prev\.fecha/.test(rep) && /la fecha debe estar entre el día del evento y hoy/.test(rep) && /id="fGrave"/.test(rep) && /al menos una acción en el plan de acción/.test(rep));
  ok('AT: pendientes del Ministerio y la ARL a la vista; el PDF sin firmas sale como BORRADOR', /mintrabajo: \['Reporte al Ministerio pendiente/.test(rep) && /BORRADOR — investigación sin terminar/.test(rep));
  // EPP
  ok('EPP: hoja de vida por serial (retiro por caída o MALO, inspección anual) y entrega con serial', /function actualizarSeriales_/.test(leer('backends/backend-epp.gs')) && /action === 'serial'/.test(leer('backends/backend-epp.gs')) && /id="caidaEpp"/.test(leer('inspeccion-epp.html')) && /Falta el serial o lote de/.test(leer('entrega-epp.html')));
  ok('EPP: sin avisos de reposición para retirados; faltante de la matriz pide justificación', /inactivos\[e\.ced\]/.test(g) && /No se entregan elementos que la matriz del cargo exige/.test(leer('entrega-epp.html')));
  // 0312, ISO, auditor
  ok('0312: custodia de historias, pensión especial, saneamiento, mediciones cruzadas con la matriz y «No aplica» justificado', /custodiahc: \{ hoja:/.test(g) && /evid0312: \{ hoja:/.test(g) && /pensionEspecial/.test(leer('habilitacion.html')) && /"id":"SANEAMIENTO"/.test(leer('inspecciones-plantillas.js')) && /r\.registrable = true/.test(leer('evidencias-reglas.js')));
  ok('ISO: independencia del auditor contra la matriz; gestión del cambio completa; política integrada', /async function independencia\(a\)/.test(leer('auditorias.html')) && /revisionPost/.test(leer('documental.html')) && /function textoPoliticaIntegrada/.test(leer('documental.html')));
  ok('PDF: firmas de aprobación, «Página X de Y», trazabilidad en el pie y «versión del formato»', /function firmasAprobacion/.test(leer('sgsst-ui.js')) && /counter\(pages\)/.test(leer('sgsst-ui.js')) && /Versión del formato/.test(leer('sgsst-ui.js')) && /UI\.firmasAprobacion\(\)/.test(leer('peligros.html')));
  ok('pantallas que usan INFORME cargan informe-reglas.js', ['gerencia.html', 'cierre-mes.html', 'indicadores.html'].every((f) => !/INFORME\./.test(leer(f)) || /<script src="informe-reglas\.js"><\/script>/.test(leer(f))));
  ok('gerencia: veredicto en una frase, multa posible según el tamaño (Dec. 472, art. 5) y lo que debe decidir; aprueba recursos', /Lo que usted debe decidir este mes/.test(leer('gerencia.html')) && /\[101, 500, 'gran empresa'\]/.test(leer('gerencia.html')) && /id="btnRecursos"/.test(leer('gerencia.html')) && /aprobrec: \{ hoja:/.test(g) && /consulta: \['tarea', 'revision', 'aprobrec'\]/.test(g));
  ok('RUC: fichas técnicas de los indicadores; contratistas con evaluación de desempeño, selección ponderada y constancia de peligros comunicados', /id="btnFichas"/.test(leer('indicadores.html')) && /evalPuntaje/.test(leer('contratistas.html')) && /seleccionPuntaje/.test(leer('contratistas.html')) && /k: 'comunicacion'/.test(leer('contratistas-docs.js')) && /contratistas-docs\.js/.test(leer('contratistas.html')));
  ok('contratista nuevo: «Inducción» en el inicio; la inducción guarda el avance y baraja la evaluación sin mostrar la correcta', /<b>Inducción<\/b>/.test(leer('index.html')) && /CLAVE_AVANCE = 'ssta-induccion-avance'/.test(leer('induccion-responder.html')) && /function barajar/.test(leer('induccion-responder.html')) && !/j === q\[2\] \? ' correcta'/.test(leer('induccion-responder.html')));
  ok('contratista nuevo: firma su participación en el ATS con el enlace del supervisor (clave de ESE ATS), sin usuario', /function claveFirmaAts_/.test(leer('backends/backend-ats.gs')) && /function claveFirmaEnlace_/.test(leer('herramientas/servidor-unico-portal.gs')) && /\[\?&\]k=\[\\w-\]\{10,\}/.test(leer('common.js')) && /clave: claveEnlace \|\| undefined/.test(leer('ats.html')));
  const tal = (()=> { const t = leer('preop-base.js'), a = t.indexOf('"id": "taladro"'), b = t.indexOf('"id": "', a + 20); return t.slice(a, b < 0 ? undefined : b); })();
  ok('preoperacional: firma de quien inspecciona obligatoria; taladro sin preguntas de soldadura ni de pulidora; equipo propio sin código', /Falta la firma de quien inspecciona/.test(leer('preoperacional.html')) && !/Careta|Peto y mangas|abrasivo/.test(tal) && /escribe «PROPIO»/.test(tal));
  ok('auditor: matriz de peligros con anchos fijos; asistencia con fechas listas; PDF médico con IPS y cédula enmascarada para el cliente', /table-layout:fixed/.test(leer('peligros.html')) && /data-rango="ant"/.test(leer('asistencia.html')) && /••••/.test(leer('salud.html')) && /IPS \/ médico/.test(leer('salud.html')));
  ok('matriz legal: cada evaluación queda en su historial', /v\.evaluaciones = \(d\.evaluaciones/.test(leer('documental.html')));
  const css = leer('common.css'), ui = leer('sgsst-ui.js');
  ok('diseño obra: la barra de pendientes no tapa «Guardar»; botones de obra de 44–48 px; modo sol también en la cabecera; «sin señal» en ámbar', /body:has\(#pendingNav\.show\) \.footer-actions\{bottom:/.test(css) && /\.btn-menu\.btn-menu\{min-height:48px/.test(css) && /#app \.sig-actions button\{min-height:44px/.test(css) && /html\.modo-sol \.hdr/.test(css) && /--offline-bg: #8a5a00/.test(css) && /color-scheme:light/.test(css));
  ok('diseño PDF: títulos de columna en cada hoja, código y versión arriba, trazabilidad y «Página X de Y» abajo de cada hoja, letra en pt', /t\.createTHead\(\)/.test(ui) && /@top-right\{content:/.test(ui) && /@bottom-left\{content:/.test(ui) && /\.hp-sgsst \.hp\{font-size:7\.5pt/.test(css) && /\.hp thead\{display:table-header-group/.test(css));
  ok('diseño PDF: la matriz de peligros sale con semáforo de nivel y aceptabilidad; gerencia y plan de acción con un solo color por significado', /nv-' \+ esc\(String\(d\.nivel/.test(leer('peligros.html')) && /class="btn ghost" id="btnPdf"/.test(leer('gerencia.html')) && /return c === 'ok' \? 'gris' : c/.test(leer('plan-accion.html')));
  ok('usuarios: cada integrante del rol Comité dice a qué comités pertenece', /data-com=/.test(leer('usuarios.html')) && /'comites'\];/.test(g));
});

grupo('v144: rendimiento en celulares y señal débil', () => {
  const sw = leer('sw.js'), c = leer('common.js'), ui = leer('sgsst-ui.js');
  ok('primera visita: solo el núcleo de obra (el resto al abrirlo o con wifi)', /const NUCLEO = \[/.test(sw) && /NUCLEO\.map\(\(url\) => fetch\(fresco\(url\)\)/.test(sw) && /datosBaratos\(\)\) setTimeout\(\(\) => guardarTodos\(RESTO\)/.test(sw) && /cache: 'reload'/.test(sw));
  ok('páginas: con señal débil se muestra la copia a los 3,5 s; con parámetros (QR) también abre sin señal', /setTimeout\(\(\) => copia\(\)\.then\(dar\), 3500\)/.test(sw) && /ignoreSearch: true/.test(sw));
  ok('js, css y fuentes salen de la caché sin volver a pedirlos', /caches\.match\(req\)\.then\(\(cached\) => cached \|\| fetch\(req\)/.test(sw));
  ok('la red tiene tiempo límite y un envío pesado no se reenvía tres veces', /ctl\.abort\(\), esPost \? 60000 : 25000/.test(c) && /if \(pesado\) retries = 0;/.test(c));
  ok('fotos más livianas (calidad 0,6) y decodificadas sin base64 intermedio', /calidad = calidad \|\| 0\.6/.test(ui) && /createImageBitmap\(archivo\)/.test(ui));
  ok('los observadores revisan solo lo agregado, cuando el celular está libre', /requestIdleCallback\(correr/.test(c) && /const conCampos = /.test(c));
});

grupo('v143: trabajador novato, auditoría SG-SST y lector de pantalla', () => {
  const ix = leer('index.html'), rp = leer('reportes.html'), pr = leer('preoperacional.html'), pc = leer('permiso-core.js'), c = leer('common.js'), al = leer('permiso-trabajo-alturas.html'), bz = leer('buzon.html');
  ok('inicio: botón rojo «Emergencia» sin usuario y «buzón» con palabras sencillas', /class="pub-emergencia" href="medevac\.html"/.test(ix) && /Peligro, accidente, queja o sugerencia \(buzón\)/.test(ix) && /Buzón: pedir algo, quejarse o sugerir/.test(ix));
  ok('reporte: sin tipo dice todos los faltantes de una vez; «Quién reporta *»; quien no tiene usuario ve «Gracias» con su código', /sin tipo elegido se dicen TODOS los faltantes/.test(rp) && /Quién reporta \*/.test(rp) && /quien reporta sin usuario ve una pantalla de gracias/.test(rp));
  ok('preoperacional: «Marcar todo Bueno», «Paso 1 de 3», dice qué falta y el cargo se llena solo', /data-todo=/.test(pr) && /'<div class="pasos">Paso <b>'/.test(pr) && /Te falta' \+/.test(pr) && /el cargo se llena solo/.test(pr) && /\(opcional\)/.test(pr));
  ok('buzón sin activar no muestra un formulario que no se puede enviar', /Este buzón todavía no está activo/.test(bz) && /#fAviso ~ \*/.test(bz));
  ok('accidente grave o mortal: reporte al Ministerio (2 días hábiles) y envío de la investigación a la ARL; no se cierra sin ellos', /Reporte al Ministerio del Trabajo \(Dirección Territorial\)/.test(rp) && /Enviar la investigación a la ARL/.test(rp) && /no se cierra sin el reporte al Ministerio/.test(rp) && /mintrabajo: \{ fecha/.test(leer('backends/backend-sgsst.gs')));
  ok('investigación: exige jefe inmediato, COPASST o vigía y SST; con licencia si fue grave o mortal (Res. 1401 art. 7)', /el jefe inmediato o supervisor en el equipo/.test(rp) && /un profesional con licencia en SST/.test(rp));
  ok('permisos: personal no habilitado NO entra (solo admin o SST con justificación) y ahora sí se espera la respuesta', /async function revisarHabilitacion_/.test(pc) && /No se puede abrir el permiso/.test(pc) && /await revisarHabilitacion_\(collectExecRows\(\)\)/.test(pc));
  ok('alturas: plan de rescate con rescatistas y equipo, obligatorio', /id="rescateAlt"/.test(al) && /id:'rescateAlt'/.test(al) && /planRescate: v\('rescateAlt'\)/.test(al));
  ok('indicadores: severidad por mes calendario y revisión anual con el indicador del periodo; inducción con horas', /function diasAusenciaCausa/.test(leer('indicadores.html')) && /indicador del periodo \(Res\. 0312, art\. 30\)/.test(leer('revision-direccion.html')) && /intensidadHoras/.test(leer('induccion.html')));
  ok('lector de pantalla: ventana de entrada con foco e inerte detrás, firma completa con Escape y sin dibujar, opciones con estado, foco al cambiar pantalla, «Dictar: campo»', /x\.inert = true/.test(c) && /e\.key === 'Escape'\) \{ e\.preventDefault\(\); cerrar\(false\)/.test(c) && /data-fc="alterna"/.test(c) && /function radios\(/.test(c) && /attributeOldValue: true/.test(c) && /'Dictar: ' \+ nm/.test(c) && /'No aplica'/.test(pc));
  ok('ayuda: temas de emergencia y buzón; se abre en lo del trabajador', /id: 'emergencia'/.test(leer('ayuda-guias.js')) && /id: 'buzon'/.test(leer('ayuda-guias.js')) && /'campo';   \/\/ v143/.test(leer('ayuda.html')));
});

grupo('v142: seguridad, datos personales e integridad del servidor', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1], E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'));
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
  const png = (n) => 'data:image/png;base64,' + Buffer.from('foto-' + n + '-'.repeat(50)).toString('base64');
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-IMG1', doc: { descripcion: 'x', fotos: [png('A')] }, opId: 'i1' });
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-IMG1', doc: { descripcion: 'x', fotos: [png('B')] }, versionBase: 1, opId: 'i2' });
  const imgs = E.hojas.Imagenes.filas.filter((f) => f[0] === 'REP-IMG1'), d = G({ action: 'doc', id: 'REP-IMG1' });
  ok('al cambiar una foto, la anterior se borra de «Imagenes» (la hoja ya no crece sin fin)', imgs.length === 1 && d.doc && d.doc.fotos[0] === png('B'), JSON.stringify(imgs.map((f) => f[1])));
  const datos = E.hojas.Datos.filas.filter((f) => f[0] === 'REP-IMG1');
  ok('guardar escribe lo nuevo antes de borrar lo viejo, y no quedan trozos repetidos', datos.length === 1 && /function escribirDoc_[\s\S]{0,400}setValues[\s\S]{0,120}borrarFilas_\(sheet, viejas\)/.test(leer('backends/backend-sgsst.gs')));
  const largo = {}; for (let k = 0; k < 400; k++) largo['r' + k] = 'x'.repeat(200);
  const rc = E.ctx.resumenCelda_({ titulo: 'T', req: largo, notas: 'y'.repeat(50000) });
  let okJson = true; try { JSON.parse(rc); } catch (e) { okJson = false; }
  ok('un resumen enorme se acorta sin romper el JSON (antes salía en blanco)', okJson && rc.length <= 30000);
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-142', doc: { nombre: 'Ana', cedula: '123456', tipoExamen: 'Periódico', fecha: '2026-11-01', concepto: 'Apto' }, opId: 'e1' });
  const ex = G({ action: 'list', tipo: 'examen' });
  ok('sin usuarios creados, nadie lee datos de salud con la clave pública (exámenes, ausencias…)', !(ex.rows || []).length, JSON.stringify(ex).slice(0, 200));
  const sa = P({ action: 'guardar', tipo: 'preopsalud', id: 'PRE-142', doc: { formulario: 'salud', fecha: '2026-11-01', responsable: 'Ana' }, opId: 's1' });
  ok('el preoperacional de salud sin autorización de la persona no se guarda (Ley 1581 art. 6)', !sa.ok && sa.codigoError === 'AUTORIZACION');
  const b = leer('backends/backend-sgsst.gs'), c = leer('common.js'), pv = leer('privacidad.html');
  ok('el examen registrado por SST queda con la base legal escrita si la persona no autorizó', /d\.baseLegal = BASE_LEGAL_SST_/.test(b));
  ok('sin sesión, el personal sale sin área, fecha de ingreso ni contacto de emergencia', /function trabajadorPublico_/.test(b) && /res = trabajadorPublico_\(res\)/.test(b));
  ok('admin y SST: sesión de 12 horas (ven salud)', /sensible: 12/.test(b) && /rol === 'admin' \|\| rol === 'sst' \? HORAS_SESION\.sensible/.test(b));
  ok('al cerrar sesión se borran listas, personal, borradores y autoguardado del celular', /BORRAR_AL_SALIR: \/\^\(ats-borrador\|ats-plantillas\)\|ssta-\(auto/.test(c) && /sgsst-lista/.test(c) && /personal-lista/.test(c) && /draft-/.test(c));
  ok('aviso de privacidad: transmisión internacional a Google, firma con GPS, RH y contacto, encargado siempre, y qué queda en el celular', /fuera de Colombia/.test(pv) && /GPS/.test(pv) && /RH/.test(pv) && /Encargado del tratamiento:<\/b> ' \+ \(enc \|\|/.test(pv) && /Al <b>cerrar sesión<\/b>/.test(pv));
  ok('bitácora que rota por año, respaldo que se puede probar y restaurar, y errores del respaldo visibles', /function rotarEventos_/.test(b) && /function probarRestauracion\(\)/.test(b) && /function restaurarDesdeRespaldo\(/.test(b) && /Respaldo externo sin enviar/.test(b));
  ok('celdas de 32.000 caracteres (Excel) y trozos protegidos con comilla en todos los servidores', ['backend-sgsst.gs', 'backend-ats.gs', 'backend-asistencia.gs', 'backend-epp.gs', 'backend-personal-autorizado.gs', 'permisos/core.gs'].every((f) => /MAX_CHARS_CELDA = 32000/.test(leer('backends/' + f))) &&
    ['backend-ats.gs', 'backend-asistencia.gs', 'backend-epp.gs', 'backend-personal-autorizado.gs', 'permisos/core.gs'].every((f) => !/lock\.waitLock/.test(leer('backends/' + f)) && /"'" \+ t\.texto/.test(leer('backends/' + f))));
  ok('la zona horaria se pide una vez (las listas ya no la piden por cada fila) y se cuida la cuota de correos', /function zonaHoraria_\(\)/.test(b) && /puedeEnviarCorreo_\('baja'\)/.test(b));
});

grupo('v141: correcciones de la revisión independiente', () => {
  const c = leer('common.js'), b = leer('backends/backend-sgsst.gs'), ui = leer('sgsst-ui.js');
  ok('buzón, convivencia y salud fuera del autoguardado; se borra al cerrar sesión', /\(ats\|buzon\|convivencia\|salud\)\\\.html\$/.test(c) && /BORRAR_AL_SALIR: \/\^\(ats-borrador\|ats-plantillas\)\|ssta-\(auto\\\|/.test(c));
  ok('las firmas no se autoguardan (solo las fotos)', !/registrarExtra\(c, 'firma:'/.test(ui));
  ok('al guardar se borra solo el borrador de ese formulario', /g === ultimoGrupo/.test(c));
  ok('el sello vale solo en su registro y al editar se conserva el original', /s\.ref === ref/.test(b) && /prev \? prevDoc\(\) : null/.test(b));
  ok('la firma sin trazo viaja al sello y se valida la cédula contra el personal', /s\.alterna = /.test(b) && /alternas/.test(c) && /NO registrada en el personal/.test(b));
  ok('RH y contacto de emergencia solo para SST, admin y supervisor con usuario', /\['admin', 'sst', 'supervisor'\]\.indexOf\(CTX_\.u\.rol\)/.test(b));
  ok('papelera y recuperar exigen poder leer el tipo; borrar dos veces no cambia nada', /puedeLeer_\(tipo\) && /.test(b) && /yaBorrado: true/.test(b));
  ok('archivo anual en lotes de 1500, sin duplicar si se repite', /mover\.length < 1500/.test(b) && /lo que ya está en el archivo no se copia de nuevo/.test(b));
  ok('«Deshacer» no promete lo que no hizo (sin cola) y el GPS solo viaja con firmas', /action: 'restaurar', id \}, null, \{ sinCola: true \}/.test(ui) && /\(\?:firma\|sig\)/.test(c));
});

grupo('v140: accesibilidad, MEDEVAC y contacto de emergencia', () => {
  const c = leer('common.js'), css = leer('common.css'), b = leer('backends/backend-sgsst.gs'), h = leer('habilitacion.html'), m = leer('medevac.html'), a = leer('accesibilidad.html');
  ok('tamaño de letra (A, A+, A++) en todo el portal', /const Letra = /.test(c) && /html\.letra-1\{/.test(css) && /html\.letra-2\{/.test(css));
  ok('«Escuchar»: el celular lee en voz alta lo que hay en pantalla', /const Leer = /.test(c) && /SpeechSynthesisUtterance/.test(c) && /Leer\.montar\(\)/.test(c));
  ok('«Firmar sin dibujar» con nombre y cédula, sellado como cualquier firma', /const FirmaAlterna = /.test(c) && /Firma sin trazo/.test(c) && /canvas\._pad = pads\[canvas\.id\]/.test(c));
  ok('«Saltar al contenido», zona principal y errores ligados a su campo', /saltarContenido/.test(c) && /aria-describedby/.test(c) && /aria-invalid/.test(c));
  ok('estados con símbolo además del color, y botones de 44 px en pantallas táctiles', /\.chip\.ok::before/.test(c) && /pointer:coarse/.test(c) && /min-height:44px/.test(c));
  ok('contacto de emergencia en el registro (no en la lista libre) y MEDEVAC con llamar, WhatsApp y SMS', /campos: \{ emergencia: em \}/.test(h) && /emer: !!\(d\.emergencia/.test(b) && !/telefono: .*emergencia/.test(b.slice(b.indexOf('function resumen_'), b.indexOf('function resumen_') + 1500)) && /wa\.me/.test(m) && /sms:/.test(m) && /tel:123/.test(m));
  ok('el plan de emergencias guarda hospital, ambulancia y línea de la ARL', /'hospital', 'hospitalDireccion', 'hospitalTelefono'/.test(b) && /hospitalTelefono/.test(leer('emergencias.html')));
  ok('página Accesibilidad con declaración y forma de reportar barreras', /WCAG 2\.1/.test(a) && /Ley 1618 de 2013/.test(a) && /pqrs=1/.test(a));
});

grupo('v138: autoguardado de todos los formularios', () => {
  const c = leer('common.js');
  ok('autoguardado en todas las páginas, al escribir, al salir y al cerrar una ventana', /const AutoGuardado = /.test(c) && /addEventListener\('pagehide', guardarYa\)/.test(c) && /visibilityState === 'hidden'\) guardarYa/.test(c) && /if \(pendientes\.size && ms\.some/.test(c));
  ok('no pisa un formulario que ya trae datos (edición) y ofrece «Descartar»', /if \(conTexto\(c\)\) \{ restaurados\.add\(c\); return; \}/.test(c) && /'Descartar'/.test(c));
  ok('no guarda claves, archivos ni buscadores; ATS y permisos siguen con su borrador', /password\|file\|hidden\|search/.test(c) && /\(ats\|buzon\|convivencia\|salud\)\\\.html\$/.test(c) && /permiso-core\.js/.test(c));
  ok('se limpia solo al guardar algo que la persona pidió (no con reenvíos de la cola)', /desde - ultimoToque > 8000/.test(c) && /ACCIONES\.test\(body\.action/.test(c));
});

grupo('v137: sello de firmas, alarmas, respaldo externo y archivo anual', () => {
  const B = ['backends/backend-sgsst.gs', 'backends/permisos/core.gs', 'backends/backend-ats.gs', 'backends/backend-asistencia.gs', 'backends/backend-epp.gs', 'backends/backend-personal-autorizado.gs'];
  ok('los seis servidores ponen el sello de auditoría a cada firma (hora del servidor, huella SHA-256 y código HMAC)', B.every((f) => /function sellarFirmas_/.test(leer(f)) && /computeHmacSha256Signature/.test(leer(f)) && /sellarFirmas_\((body|doc), ctxSello_/.test(leer(f))), B.filter((f) => !/sellarFirmas_\((body|doc), ctxSello_/.test(leer(f))).join(', '));
  const g = leer('backends/backend-sgsst.gs');
  ok('el historial verifica los sellos (acción «sellos»)', /p\.action === 'sellos'/.test(g) && /action: 'sellos'/.test(leer('sgsst-ui.js')));
  ok('alarma de borrado masivo: avisa a los 15 y frena a los 40 en 10 minutos', /function controlBorrado_/.test(g) && /controlBorrado_\(\); if \(frenado\)/.test(g));
  ok('alarmas de entradas raras: usuario bloqueado, muchos fallos en una hora y administrador nuevo', /Usuario bloqueado por claves incorrectas/.test(g) && /function fallosEntrada_/.test(g) && /Nuevo administrador del portal/.test(g));
  ok('respaldo fuera de la cuenta: Excel por correo a RESPALDO_EXTERNO o al asesor, dentro del respaldo semanal', /function respaldoExterno_/.test(g) && /externo = respaldoExterno_\(hoy\)/.test(g));
  ok('archivo anual: vista previa, copia verificada antes de quitar y sin dejar la hoja vacía', /function archivoAnualVistaPrevia/.test(g) && /function archivarAniosAnteriores/.test(g) && /no se quitó nada de la base activa/.test(g) && /nunca hay un momento con la hoja vacía/.test(g));
  ok('el envío con firma lleva el equipo y el GPS (si se permite)', /b\._disp = \{ ua: navigator\.userAgent/.test(leer('common.js')));
  ok('dictado por voz y modo sol en el portal', /const Dictado = /.test(leer('common.js')) && /const ModoSol = /.test(leer('common.js')) && /html\.modo-sol\{/.test(leer('common.css')) && /id="btnSol"/.test(leer('index.html')));
  ok('ATS repetido: pide confirmar que se revisaron las condiciones de hoy', /n\.revisarHoy = true/.test(leer('ats.html')) && /ats\.revisarHoy && !ats\.revisadoHoy/.test(leer('ats.html')) && /id="menuRepetir"/.test(leer('ats.html')));
  ok('documentos: control de cambios con versión, fecha, quién y motivo', /v\.controlCambios = lista/.test(leer('documental.html')) && /Control de cambios/.test(leer('documental.html')));
});

grupo('v150: firma de actas por enlace, dotación, modo oscuro y pendientes', () => {
  const g = leer('backends/backend-sgsst.gs'), c = leer('comites.js');
  ok('actas: enlace público firmado con HMAC y firma desde el celular', /function claveActa_/.test(g) && /function firmarActa_/.test(g) && /actaPublica/.test(g) && fs.existsSync(path.join(RAIZ, 'firmar-acta.html')) && /compartirFirma/.test(c) && /firmar-acta\.html/.test(leer('sw.js')));
  ok('dotación: módulo con los tres plazos del CST (abril, agosto y diciembre), tallas y firma', fs.existsSync(path.join(RAIZ, 'dotacion.html')) && /dotacion: \{ hoja: 'Entregas de dotación'/.test(g) && /href="dotacion\.html"/.test(leer('index.html')) && /dotacion\.html/.test(leer('sw.js')));
  ok('modo oscuro: bloque prefers-color-scheme que respeta el modo sol', /prefers-color-scheme: dark/.test(leer('common.css')) && /:root:not\(\.modo-sol\)/.test(leer('common.css')));
  ok('permisos: enlace para volver al portal en la cabecera', /← Atrás/.test(leer('permiso-core.js')));
  ok('indicadores: tendencia con valor en cada barra y línea de meta', /tend-v/.test(leer('indicadores.html')) && /tend-meta/.test(leer('indicadores.html')));
  ok('ATS: no se cierra con envíos en cola', /Outbox/.test(leer('ats.html')) && /body\.code === /.test(leer('ats.html')));
  ok('charlas: firma de quien da la charla, guardada y en el PDF', /id="padEjec"/.test(leer('asistencia.html')) && /ejecutorFirma/.test(leer('backends/backend-asistencia.gs')) && /Firma ejecutor/.test(leer('asistencia.html')));
  ok('COPASST: reunión extraordinaria por riesgo inminente con plazo de 5 días', /btnRiesgo/.test(c) && /fechaHecho/.test(c) && /Res\. 2013 de 1986, art\. 9/.test(c));
  ok('Convivencia: el informe trimestral/anual queda guardado en el servidor', /informecc: \{/.test(g) && /Registros\.guardar\('informecc'/.test(leer('convivencia.html')) && /<script src="registros\.js">/.test(leer('convivencia.html')));
  ok('matriz de peligros: cruce con los peligros de los ATS', /action === 'peligrosResumen'/.test(leer('backends/backend-ats.gs')) && /function cruzarAts/.test(leer('peligros.html')));
  ok('emergencias ambientales cruzadas con los PON del plan', /function avisoEmergAmb/.test(leer('ambiental.html')) && /ponTexto/.test(g) && /d\.ponTexto = /.test(leer('emergencias.html')));
  ok('carpeta de evidencias: paquete único en PDF para el auditor', /function paquete\(\)/.test(leer('evidencias.html')) && /id="btnPaquete"/.test(leer('evidencias.html')));
});

grupo('v151: ajustes pedidos tras probar la v150', () => {
  { const malos = fs.readdirSync(RAIZ).filter((f) => /\.(html|css|js)$/.test(f)).filter((f) => /--([a-z0-9-]+)\s*:\s*var\(--\1\)/.test(leer(f)));
    ok('ningún color se define a sí mismo (--x: var(--x) deja el color vacío: textos invisibles)', !malos.length, malos.join(', ')); }
  const ix = leer('index.html'), r = leer('reportes.html'), g = leer('backends/backend-sgsst.gs');
  ok('inicio sin usuario: sin la frase de «no piden usuario»; clave y estado del sistema solo en Gestión', !/no piden usuario/.test(ix) && /body:not\(\.vista-sg\) \.solo-sg\{display:none/.test(ix) && /class="btn-clave solo-sg" id="btnClave"/.test(ix) && /href="estado\.html" class="solo-usuario"/.test(ix) && /body:not\(\.con-usuario\) \.solo-usuario\{display:none/.test(ix));
  ok('inicio: la tarjeta dice «Inducción» (ya no «Llegué hoy a la obra»)', /<b>Inducción<\/b>/.test(ix) && !/Llegué hoy/.test(ix));
  ok('reportes sin botón de plantillas', /papelera\|reportes\|buzon\)\\\.html\$/.test(leer('common.js')));
  ok('acción inmediata en casillas uniformes y el incidente con los mismos cuadros', /\.acc-grid\{display:grid;grid-template-columns:1fr 1fr/.test(r) && /border:1\.5px solid var\(--n-300\)/.test(r) && /c === 'Incidente' \|\| c === AT\) && c !== 'Acto seguro'/.test(r));
  ok('emergencia: sin botón de reportar accidente; contacto de emergencia con la cédula, sin usuario', !/href="reportes.html?nuevo=1">Reportar el accidente/.test(leer('medevac.html')) && /function porCedula/.test(leer('medevac.html')) && /function contactoEmergencia_/.test(g) && /'CONTACTO_EMERGENCIA'/.test(g));
  ok('requisitos: concepto de manipulación de alimentos (también en empresas ya configuradas)', /alimentos: \{ nombre: 'Concepto de manipulación de alimentos'/.test(leer('common.js')) && /Object\.assign\(\{\}, f\.requisitos, e\.requisitos\)/.test(leer('common.js')));
  ok('guardar más rápido: hojas en caché por petición, papelera revisada cada 10 min y servidor despierto antes de guardar', /HOJAS_CACHE_\[nombre\] = sheet/.test(g) && /'papelera\.' \+ id/.test(leer('herramientas/servidor-unico-portal.gs')) && /'ssta-despierto'/.test(leer('common.js')));
});

// v162 · ESLint: sin eval ni errores, y los innerHTML con datos no suben de la base revisada (trinquete).
grupo('v162: revisión del código con ESLint', () => {
  let L = null; try { L = require('../herramientas/lint/revisar.js'); } catch (e) {}
  if (!L) { ok('ESLint instalado (cd herramientas/lint && npm install)', false); return; }
  const r = L.revisar(), base = JSON.parse(fs.readFileSync(L.BASE, 'utf8'));
  ok('sin eval, new Function, código inalcanzable, claves duplicadas ni otros errores en ' + Object.keys(r.por).length + ' archivos', !r.errores.length, r.errores.slice(0, 5).join(' | '));
  const suben = Object.keys(r.por).filter((f) => r.por[f].innerHTML > (base[f] || 0));
  ok('ningún archivo suma innerHTML con datos sin revisar (base ' + Object.values(base).reduce((a, x) => a + x, 0) + ')', !suben.length, suben.map((f) => f + ' ' + r.por[f].innerHTML + '/' + (base[f] || 0)).join(' | '));
  ok('cada página tiene política de seguridad (CSP) sin eval y sin objetos embebidos', fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html')).every((f) => { const t = leer(f); return /http-equiv="Content-Security-Policy"/.test(t) && !/unsafe-eval/.test(t) && /object-src 'none'/.test(t); }));
  { const wf = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'pruebas.yml'), 'utf8');
    ok('v163: GitHub instala ESLint (npm ci en herramientas/lint) ANTES de correr pruebas.js', /working-directory: herramientas\/lint\s+run: npm ci/.test(wf) && wf.indexOf('herramientas/lint') < wf.indexOf('node pruebas/pruebas.js') && fs.existsSync(path.join(RAIZ, 'herramientas', 'lint', 'package-lock.json'))); }
  { const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8'), N = new Set((/const NUCLEO = \[([\s\S]*?)\];/.exec(sw)[1].match(/'\.\/[^']*'/g) || []).map((s) => s.slice(3, -1))), falta = [];
    [...N].filter((f) => f.endsWith('.html')).forEach((f) => { const t = fs.readFileSync(path.join(RAIZ, f), 'utf8'); (t.match(/<script src="[^"]+"|<link[^>]*href="[^"]+\.css"/g) || []).forEach((x) => { const u = /(?:src|href)="([^"]+)"/.exec(x)[1].replace(/^\.\//, ''); if (!/^https?:/.test(u) && !N.has(u)) falta.push(u + ' (' + f + ')'); }); });
    ok('v163: cada pantalla del núcleo sin señal tiene en el núcleo TODO su JS y CSS (primera instalación offline)', !falta.length, falta.join(', ')); }
  { const CSP = require(path.join(RAIZ, 'herramientas', 'csp.js'));
    const malas = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.html')).filter((f) => { const h = fs.readFileSync(path.join(RAIZ, f), 'utf8'); const m = /script-src ([^;"]*)/.exec(h); return !m || /unsafe-inline/.test(m[1]) || !CSP.aldia(h); });
    ok('v163: ninguna página permite scripts en línea sin huella (sin \'unsafe-inline\'); si falla: node herramientas/csp.js', !malas.length, malas.join(', '));
    const handlers = fs.readdirSync(RAIZ).filter((f) => /\.(html|js)$/.test(f) && !/\.min\.js$/.test(f)).filter((f) => /\son(click|change|input|submit|load|error|keydown|keyup)\s*=\s*\\?["']/.test(fs.readFileSync(path.join(RAIZ, f), 'utf8')));
    ok('v163: ningún onclick u otro manejador en línea (la CSP no los dejaría correr)', !handlers.length, handlers.join(', ')); }
});

// v162 · Pruebas de LÓGICA: ejecutan las funciones con datos conocidos (festivos, plazos, indicadores, 0312, habilitación, servidor).
require('./unitarias').correr(ok, grupo);

grupo('v161: investigación de accidentes con los datos del FURAT', () => {
  const r = leer('reportes.html');
  ok('sección «Investigaciones» en reportes (y tarjeta en el inicio) con plazo de 15 días y acceso directo', /data-tab="investigaciones"/.test(r) && /function pintarInvestigaciones/.test(r) && leer('index.html').includes('href="reportes.html?tab=investigaciones"'));
  ok('datos del FURAT (persona y accidente) en la investigación, precargados del reporte y de Personal habilitado', /id="iFuratCard"/.test(r) && /function prellenarFurat/.test(r) && /furat: leerFurat\(\)/.test(r) && /\(4\.46\) Manos/.test(r) && /\(55\) Golpe, contusión o aplastamiento/.test(r));
  ok('testigos con su declaración y responsable del informe', /function agregarTestigo/.test(r) && /respNombre/.test(r));
  ok('formato de investigación en PDF con las secciones del formato (0 a IX) y código configurable', /function formatoInvestigacion/.test(r) && /VII\. Resumen de causas y conclusiones/.test(r) && /VIII\. Soluciones/.test(r) && /UI\.cabecera\('SG-INV-AT'/.test(r) && /'SG-INV-AT':/.test(leer('configurar-empresa.html')));
  ok('no se borran los datos del FURAT si se guarda antes de que carguen', /aún no se pintó: no se borra lo guardado/.test(r));
});

grupo('v160: hojas de vida y filtro por elemento en el inventario', () => {
  const ins = leer('inspecciones.html'), gs = leer('backends/backend-sgsst.gs');
  ok('el inventario se filtra por elemento (extintor, botiquín, arnés…) con su conteo', /id="fCatSel"/.test(ins) && /const pasaFiltroEq = /.test(ins) && /optgroup label="Por elemento"/.test(ins));
  ok('datos técnicos de la hoja de vida: marca, modelo, serie, compra, proveedor y características (y el servidor los guarda)', ['eqMarca', 'eqModelo', 'eqSerie', 'eqCompra', 'eqProv', 'eqCarac'].every((k) => ins.includes('id="' + k + '"')) && /marca: corto_\(d\.marca, 60\)/.test(gs) && /mantHist: Array\.isArray\(d\.mantHist\)/.test(gs));
  ok('se registran mantenimientos y reparaciones (actualizan el último y el siguiente)', /id="btnMant"/.test(ins) && /campos\.mantUltimo = m\.f/.test(ins));
  ok('hoja de vida en PDF de un equipo o de todos los del filtro, en hoja vertical', /function hojaDeVida\(e\)/.test(ins) && /HOJA DE VIDA DEL EQUIPO/.test(ins) && /hojasDeVidaFiltradas/.test(ins) && /hojaDeVida\(e\)\), false\)/.test(ins));
  ok('la ficha del equipo muestra los datos técnicos y los mantenimientos', /bloque\('Datos técnicos'/.test(leer('equipo.html')) && /bloque\('Mantenimientos y reparaciones'/.test(leer('equipo.html')));
});

grupo('v159: el portal llena solo lo que ya sabe', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  P({ action: 'guardar', tipo: 'empresa', id: 'EMPRESA-PERFIL', doc: { nombre: 'Demo', correoSST: 'sst@demo.co', areasTexto: 'Bodega | Ana Ruiz\nTaller | Pedro Gil' }, opId: 'p1' });
  const hoy = E.ctx.hoyISO_();
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-9', doc: { clase: 'Condición insegura', categoria: 'Orden y aseo', fecha: hoy, lugar: 'Bodega norte', descripcion: 'Cajas en el pasillo', potencial: 'Alto' }, opId: 'p2' });
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-10', doc: { clase: 'Accidente de trabajo', fecha: hoy, lugar: 'Taller', descripcion: 'Golpe' }, opId: 'p3' });
  P({ action: 'guardar', tipo: 'preop', id: 'PRE-1', doc: { formulario: 'pulidora', nombreFormulario: 'Pulidora', fecha: hoy, codigoEquipo: 'PU-01', malos: 1, hallazgos: [{ p: 'Guarda', v: 'Malo', obs: 'rota' }], resultado: 'CON NOVEDAD' }, opId: 'p4' });
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-9', doc: { clase: 'Condición insegura', categoria: 'Orden y aseo', fecha: hoy, lugar: 'Bodega norte', descripcion: 'Cajas en el pasillo (editado)', potencial: 'Alto' }, versionBase: 1, opId: 'p5' });
  const acc = (E.get({ token: T, action: 'list', tipo: 'accion' }).rows || []);
  const a9 = acc.find((x) => x.id === 'ACC-REP-9'), ap = acc.find((x) => x.id === 'ACC-PRE-1');
  ok('6 · un acto o condición crea solo su acción, con el responsable del área y fecha según el potencial', a9 && a9.resumen.responsable === 'Ana Ruiz' && a9.resumen.prioridad === 'Alta' && a9.resumen.origenRef === 'REP-9', JSON.stringify(a9 && a9.resumen));
  ok('6 · un preoperacional con novedad también; el accidente no (va por la investigación) y editar no duplica', ap && !acc.some((x) => x.id === 'ACC-REP-10') && acc.filter((x) => x.id === 'ACC-REP-9').length === 1, acc.map((x) => x.id).join());
  const im = E.ctx.informeMensual(), co = E.correos.find((c) => /Informe SG-SST/.test(c[1]));
  ok('8 · el informe del mes sale solo (día 1, con el aviso diario) a SST, una sola vez por mes', /enviado/.test(im) && co && /sst@demo\.co/.test(co[0]) && /ACCIDENTALIDAD/.test(co[2]) && /informe\.html\?p=mes&v=|Informes/.test(co[2]) && /Ya se envió/.test(E.ctx.informeMensual()) && /informeMensual\(\)/.test(leer('backends/backend-sgsst.gs')), im);
  const cz = P({ action: 'carpetaAuditoria', carpetas: [{ nombre: '1.1.1 Responsable del SG-SST', evidencia: 'Designación', ids: ['REP-9'] }], indiceHtml: '<p>Índice</p>' });
  ok('10 · carpeta de auditoría: un .zip con una carpeta por numeral', cz.ok && cz.archivos >= 2 && /Carpeta de auditoria/.test(cz.nombre), JSON.stringify(cz).slice(0, 200));
  const ui = leer('sgsst-ui.js'), c = leer('common.js');
  ok('1 · autollenado por cédula: al elegir la persona o escribir su cédula se llenan cédula, cargo, área y empresa vacíos', /const AutoCedula = /.test(c) && /function llenarVecinos/.test(c) && /llenarVecinos\(i, p\); \}\);/.test(ui));
  ok('2 · el ATS sale del permiso con trabajo, sitio, fechas, cuadrilla y tipo de permiso', /Hacer el ATS con estos datos/.test(leer('permiso-core.js')) && /async function atsDesdePermiso/.test(leer('ats.html')) && /get\('desde'\) === 'permiso'/.test(leer('ats.html')));
  ok('3 · repetir el de ayer: el preoperacional recuerda equipo, persona y centro (nunca el estado del equipo)', /ssta-preop-ultimo-/.test(leer('preoperacional.html')) && /\['texto', 'lista', 'persona'\]/.test(leer('preoperacional.html')));
  ok('4 · mi firma: quien entra con usuario la guarda una vez y la pone con un toque', /const MiFirma = / .test(c) && /Poner mi firma/.test(c) && /MiFirma\.boton\(c\)/.test(c));
  ok('5 · «Lo mío hoy» arriba y quien entra con usuario cae en su pantalla de trabajo', leer('index.html').indexOf('id="pend"') < leer('index.html').indexOf('class="search-box"') && /ssta-sg-auto/.test(leer('index.html')));
  ok('7 · ficha del equipo con inspecciones, preoperacionales, acciones y QR', fs.existsSync(path.join(RAIZ, 'equipo.html')) && /equipo\.html\?id=/.test(leer('inspecciones.html')) && leer('sw.js').includes('./equipo.html') && leer('empresa-motor.js').includes("'equipo.html'"));
  ok('9 · el plan anual se cumple solo también por el texto, sin pisar lo marcado a mano', /Registro del portal: /.test(leer('plan-anual.html')) && /if \(e\) return;/.test(leer('plan-anual.html')));
  ok('11 · recordatorio por WhatsApp a la persona (celular en Personal habilitado, oculto sin sesión)', /function avisar\(x, tr\)/.test(leer('analitica.html')) && /id="inCelular"/.test(leer('habilitacion.html')) && /'autorizacion', 'celular'(, 'cedulasAnteriores')?\]/.test(leer('backends/backend-sgsst.gs')));
  ok('12 · datos por depurar: duplicados, inactivos con movimiento, áreas mal escritas (unificar) y equipos sin inspección', /function datosSucios/.test(leer('analitica.html')) && /data-unificar/.test(leer('analitica.html')));
});

grupo('v158: análisis y alertas con los datos del portal', () => {
  const an = leer('analitica.html'), cm = leer('common.js'), pc = leer('permiso-core.js'), at = leer('ats.html'), pg = leer('peligros.html');
  ok('existe «Análisis y alertas» con sus 9 análisis', ['alertas','controles','costos','contratistas','r0312','charlas','personas','vence','eficacia'].every((k) => an.includes("['" + k + "'")));
  ok('alertas de patrón: reportes repetidos, equipo NC dos veces, EPP dañado y lesiones repetidas', /length >= 3/.test(an) && an.includes("every((x)=> x.resumen.resultado === 'NO CONFORME')") && an.includes("de('solrepo')"));
  ok('semáforo de la cuadrilla en permisos y ATS', /semaforo\(el, filas/.test(cm) && pc.includes('Habilitacion.semaforo') && at.includes('Habilitacion.semaforo'));
  ok('la matriz guarda el texto de los controles para revisarlos', pg.includes('controlesTexto') && leer('backends/backend-sgsst.gs').includes("'controlesTexto'"));
  ok('costo de la accidentalidad sin salarios reales (lo pone el usuario)', an.includes('cSal') && an.includes('No se usan los salarios reales'));
  ok('Res. 0312 hoy y en 30 días', an.includes('EVIDENCIAS.evaluar(items, ctx(mas(30)))'));
  ok('acciones no eficaces se pueden reabrir', an.includes("estado: 'ABIERTA'") && an.includes('data-reabrir'));
  ok('salud (exámenes y PVE) en vencimientos solo para SST', /if \(esSst\) \{ de\('examen'\)/.test(an));
  ok('está en el inicio, en el service worker y en el motor', leer('index.html').includes('href="analitica.html"') && leer('sw.js').includes('./analitica.html') && leer('empresa-motor.js').includes("'analitica.html'"));
});
grupo('v157: los datos del portal conectados entre sí', () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o));
  P({ action: 'guardar', tipo: 'trabajador', id: 'TRB-555', doc: { nombre: 'Luis Gómez', cedula: '555', cargo: 'Técnico', activo: true }, opId: 'r1' });
  P({ action: 'guardar', tipo: 'examen', id: 'EXM-1', doc: { nombre: 'Luis Gómez', cedula: '555', tipoExamen: 'Periódico', fecha: '2026-10-01', concepto: 'Apto con restricciones', restricciones: 'No subir a más de 1,5 m', temporalidad: 'Temporales', venceRestriccion: '2026-12-01', restringePara: ['Trabajo en alturas'] }, opId: 'r2' });
  const lst = E.get({ token: T, action: 'list', tipo: 'trabajador' }), t = ((lst.rows || []).find((x) => x.id === 'TRB-555') || {}).resumen || {};
  ok('1 · el examen pasa a Personal habilitado PARA QUÉ tiene restricción y hasta cuándo (sin diagnóstico)', t.restr && t.restr.para.join() === 'alturas' && t.restr.hasta === '2026-12-01' && !JSON.stringify(t).includes('1,5 m'), JSON.stringify(t.restr));
  const c = leer('common.js');
  ok('1 · la habilitación bloquea el permiso o ATS de ese trabajo mientras la restricción esté vigente', /Restricción médica para ' \+ NOM\[p\]/.test(c) && /rm\.para\.filter\(\(p\) => p === 'todo' \? alto : ctx\.indexOf\(p\) !== -1\)/.test(c) && /k: 'restringePara'/.test(leer('salud.html')));
  ok('2 · PVE: población y profesiograma según la matriz de peligros', /function cargosExpuestos/.test(leer('pve.html')) && /function profesiogramaSinPrueba/.test(leer('pve.html')) && /id="addMatriz"/.test(leer('pve.html')));
  ok('3 · ficha del trabajador con todo de la persona (salud solo para SST)', fs.existsSync(path.join(RAIZ, 'persona.html')) && /esSst \? ',examen,pvecaso' : ''/.test(leer('persona.html')) && /persona\.html\?ced=/.test(leer('habilitacion.html')) && /href="persona\.html"/.test(leer('index.html')));
  ok('4 · inspección de EPP con «Malo» → pedido en Entrega de EPP, y al entregar se cierra con su acción', /tipo: 'solrepo'/.test(leer('inspeccion-epp.html')) && /data-sr=/.test(leer('entrega-epp.html')) && /estado: 'ENTREGADA'/.test(leer('entrega-epp.html')) && /solrepo: \{ hoja: 'Reposición pedida \(EPP\)'/.test(leer('backends/backend-sgsst.gs')));
  ok('5 · al cerrar un accidente o incidente, se propone revisar la matriz y la vigilancia', /Cerrar el ciclo/.test(leer('reportes.html')) && /peligros\.html\?buscar=/.test(leer('reportes.html')) && /get\('buscar'\)/.test(leer('peligros.html')));
  ok('6 · informe: accidentes, inspecciones no conformes y personal por área', /Accidentes e incidentes por área/.test(leer('informe.html')) && /Inspecciones no conformes por área/.test(leer('informe.html')));
  ok('7 · plan anual: más actividades se cumplen solas (EPP, dotación, PVE, equipos de emergencia) y se proponen por el texto', /\['entregaepp', 'Entregas de EPP registradas'\]/.test(leer('plan-sugerido.js')) && /auto === 'entregaepp'/.test(leer('informe-reglas.js')) && /const AUTO_TXT = /.test(leer('plan-anual.html')));
  const pe = P({ action: 'guardar', tipo: 'solrepo', id: 'SRP-1', doc: { nombre: 'Luis Gómez', cedula: '555', fecha: '2026-10-01', elementosTexto: 'CASCO', estado: 'PENDIENTE' }, opId: 'r3' });
  const pend = E.get({ token: T, action: 'pendientes', dias: 45 }), txt = JSON.stringify(pend);
  ok('8 · «Lo mío hoy» suma reposiciones de EPP, mantenimientos, seguimientos del PVE y fin de restricciones', pe.ok && /Entregar reposición de EPP a Luis Gómez/.test(txt) && /termina la restricción médica/.test(txt) && /<h2 id="pendTit">Para hoy y esta semana<\/h2>/.test(leer('index.html')), txt.slice(0, 200));
});

grupo('v156: atrás que vuelve, inventario con mantenimiento, botiquín editable, paquete sin PVE e inspección de EPP desde la matriz', () => {
  const ins = leer('inspecciones.html'), ep = leer('inspeccion-epp.html'), c = leer('common.js');
  ok('«← Atrás» en los módulos: vuelve a donde estabas (Gestión con la categoría abierta) en vez del inicio', /a\.back\[href="index\.html"\]/.test(c) && /history\.back\(\); return;/.test(c) && !/← Volver al portal/.test(leer('inspecciones.html')));
  ok('inventario: la tarjeta dice qué equipo es (categoría) y el estado «Por vencer» no dice «Al día»', /class="m eq-cat"/.test(ins) && /'Por vencer'/.test(ins));
  ok('inventario: mantenimiento preventivo / correctivo con fecha del último y del siguiente', /id="eqMant"/.test(ins) && /Fecha último preventivo y\/o correctivo/.test(ins) && /Fecha siguiente preventivo y\/o correctivo/.test(ins) && /mantProximo: texto_/.test(leer('backends/backend-sgsst.gs')));
  ok('botiquín: el contenido se edita (agregar, quitar y mínimos) y la inspección cuenta contra él', /function pintarCont/.test(ins) && /Contenido del botiquín \| ' \+ x\.e/.test(ins) && /contenido: Array\.isArray\(d\.contenido\)/.test(leer('backends/backend-sgsst.gs')));
  ok('paquete para el cliente: ya no envía los PVE', !/Programas de vigilancia \(PVE\)/.test(leer('paquete-cliente.html')) && /function pves\(\)\{ return \[\]; \}/.test(leer('paquete-cliente.html')));
  ok('inspección de EPP: los EPP vienen de la matriz, se eligen cuáles se inspeccionan y los de alturas solo con arnés', /function cargarMatrizEpp/.test(ep) && /SGSST\.listar\('eppcargo'/.test(ep) && /id="eppSel"/.test(ep) && /id="camposAlturas" hidden/.test(ep) && /tipo === 'epp'\s*\? Object\.keys\(items\)/.test(leer('backends/backend-epp.gs')));
});

grupo('v155: vigilancia epidemiológica como módulo propio y «atrás» en las categorías', () => {
  const pv = leer('pve.html'), g = leer('backends/backend-sgsst.gs'), ix = leer('index.html');
  ok('PVE: módulo propio con programas, personas, seguimientos e indicadores (prevalencia, incidencia, cobertura, cumplimiento)', fs.existsSync(path.join(RAIZ, 'pve.html')) && /function indicadores\(prog\)/.test(pv) && /prevalencia/.test(pv) && /incidencia/.test(pv) && /function editarPersona/.test(pv) && /seguimientos: segs/.test(pv));
  ok('PVE: las personas entran por examen médico (remitidas), por cargo expuesto o a mano', /function remitidosSinIncluir/.test(pv) && /s\.pveIngresa !== 'Sí'/.test(pv) && /function agregarPorCargo/.test(pv));
  ok('PVE: las personas del programa son dato de salud (solo SST, sin copia en el celular, sin diagnósticos)', /pvecaso: \{ hoja: 'PVE · personas'/.test(g) && /const SOLO_SST = \[[^\]]*'pvecaso'/.test(g) && /const TIPOS_SALUD_ = \[[^\]]*'pvecaso'/.test(g) && /No escribas el diagnóstico/.test(pv));
  ok('PVE: tarjeta en el portal, en la caché sin señal y Salud lleva al módulo', /href="pve\.html"/.test(ix) && /pve\.html/.test(leer('sw.js')) && /href="pve\.html">Abrir Vigilancia epidemiológica/.test(leer('salud.html')) && /'pve\.html': 'salud'/.test(leer('empresa-motor.js')));
  ok('Gestión: abrir una categoría deja paso en el historial (atrás la cierra) y tiene botón «← Categorías»', /__cat: it\.id/.test(ix) && /class(Name)? ?=? ?'cat-atras'/.test(ix) && /← Categorías/.test(ix));
});

grupo('v154: botiquín Res. 0705, extintor con recarga y vencimiento, categorías nuevas, áreas, tablero gerencial y 5 porqués', () => {
  const vm = require('vm'), c = {}; vm.createContext(c); vm.runInContext(leer('inspecciones-plantillas.js') + ';this.P=PLANTILLAS_INSPECCION;this.E=elementosBotiquin;', c);
  const b = c.P.find((x) => x.id === 'botiquin'), ex = c.P.find((x) => x.id === 'extintor');
  ok('botiquín: solo «Botiquín», tipos A/B/C y contenido de la Res. 0705 con mínimos (A 12 elementos, B y C 32)', b.nombre === 'Botiquín' && b.tipos.join() === 'A,B,C' && c.E('A').length === 12 && c.E('B').length === 32 && c.E('C').find((x) => /Linterna/.test(x.t)).min === 4 && c.E('B').find((x) => /Gasas estériles/.test(x.t)).min === 20);
  const ins = leer('inspecciones.html');
  ok('inspección del botiquín: se cuenta cada elemento y queda NC si hay menos del mínimo o está vencido', /class="hay"/.test(ins) && /Number\(hay\) < q\.min/.test(ins) && /x\.min = q\.min/.test(ins) && /Mínimo ' \+ x\.min/.test(ins));
  ok('extintor: fecha de recarga y fecha de vencimiento (se calcula a 12 meses)', ex.fechas && ex.fechas.Recarga.hecha === 'Fecha de recarga' && /data-hecha=/.test(ins) && /hechas: hec/.test(leer('backends/backend-sgsst.gs')));
  ok('inventario: «Otra categoría» crea una lista nueva sin salir del equipo', /value="__nueva"/.test(ins) && /function nuevaCategoria/.test(ins));
  ok('departamentos y áreas: página propia y los campos de área los ofrecen en todo el portal', fs.existsSync(path.join(RAIZ, 'areas.html')) && /const Areas = \{/.test(leer('common.js')) && /'areasTexto'/.test(leer('backends/backend-sgsst.gs')) && /href="areas\.html"/.test(leer('index.html')) && /id="eqArea"/.test(ins));
  ok('informe: tablero gerencial con semáforo en pantalla y en el PDF', /function tablero\(\)/.test(leer('informe.html')) && /'TABLERO GERENCIAL', tableroPdf\(\)/.test(leer('informe.html')));
  ok('plan de acción: tarjeta «Análisis de causa · 5 porqués» siempre visible, con ejemplo completo de ayuda', /id="cardPq"/.test(leer('plan-accion.html')) && /Ver un ejemplo completo/.test(leer('plan-accion.html')));
  ok('«Estado» del sistema solo para quien entró con su usuario', /class="btn-clave btn-estado solo-usuario" href="estado\.html"/.test(leer('index.html')));
});

grupo('v154: el enlace «Saltar al contenido» no pisa el id «contenido» de la página', () => {
  ok('si la página ya tiene id="contenido", el principal toma otro id', /document\.getElementById\('contenido'\) \? 'contenido-principal' : 'contenido'/.test(leer('common.js')));
});

grupo('v152: 5 porqués al cerrar, textos visibles, «atrás» sin perder el lugar, vencimientos y sin plantillas', () => {
  const pa = leer('plan-accion.html'), ix = leer('index.html');
  ok('plan de acción: los 5 porqués guiados aparecen al cerrar (obligatorios en correctivas) y quedan en el detalle', /function cincoPorques/.test(pa) && /await cincoPorques\(actual, obligatoria, true\)/.test(pa) && /extra\.porques = r\.porques/.test(pa) && /Ver los ' \+ d\.porques\.length \+ ' porqués/.test(pa));
  ok('aviso de privacidad con fondo sólido y encima de la barra inferior', /background:#10213a;/.test(ix) && /d\.style\.bottom = 'calc\(100px/.test(ix));
  ok('inicio: al volver de un módulo se reabre la categoría y se baja al mismo punto', /ssta-inicio-pos/.test(ix) && /scrollRestoration = 'manual'/.test(ix) && /__sstaVolviendo/.test(ix));
  ok('extintor: solo la recarga, y el aviso dice los días reales que faltan', /"id":"extintor"[^\n]*"vencimientos":\["Recarga"\]/.test(leer('inspecciones-plantillas.js')) && /'Vence en ' \+ dias/.test(leer('inspecciones.html')));
  ok('el botón «Plantillas» ya no se pone en ningún formulario', /if \(false\) ponerPlantillas\(c\);/.test(leer('common.js')));
});

grupo('v167: instalación con un comando, estado de los clientes y código más fácil de mantener', async () => {
  const { execFileSync } = require('child_process'), os = require('os');
  // ── common.js sale de fuente/common/ ──
  const AC = require('../herramientas/armar-common');
  ok('common.js es exactamente la unión de las partes de fuente/common/ (nadie lo editó a mano)', AC.revisar() === '' && AC.unir() === fs.readFileSync(path.join(RAIZ, 'common.js'), 'utf8'), AC.revisar());
  const partes = AC.partes(), tam = partes.map((f) => fs.readFileSync(path.join(RAIZ, 'fuente/common', f), 'utf8').split('\n').length);
  ok('common.js quedó en partes por tema, ninguna de más de 600 líneas', partes.length >= 10 && Math.max(...tam) <= 600, partes.map((f, i) => f + ':' + tam[i]).join(' '));
  const copia = fs.readFileSync(path.join(RAIZ, 'common.js'), 'utf8');
  try { fs.writeFileSync(path.join(RAIZ, 'common.js'), copia.replace('const Outbox = {', 'const Outbox = { /* a mano */')); ok('si alguien edita common.js a mano, la revisión lo dice y explica qué hacer', /no coincide con fuente\/common/.test(AC.revisar()) && /pasa ese cambio a su parte/.test(AC.revisar())); }
  finally { fs.writeFileSync(path.join(RAIZ, 'common.js'), copia); }
  const nl = copia.split('\n').findIndex((l) => l.startsWith('const Outbox = {')) + 1, u = AC.ubicar(nl);
  ok('una línea de common.js se ubica en su parte (para los errores que reporta el navegador)', u && /04-actualizacion-y-cola-sin-senal\.js$/.test(u.parte) && fs.readFileSync(path.join(RAIZ, u.parte), 'utf8').split('\n')[u.linea - 1].startsWith('const Outbox = {'), JSON.stringify(u));
  ok('subir la versión cambia la parte (no common.js) y vuelve a armar', /^fuente\/common\/\d\d-/.test(require('../herramientas/subir-version').parteDe('VERSION_PORTAL_WEB')) && /require\('\.\/armar-common'\)\.armar\(\)/.test(leer('herramientas/subir-version.js')));
  ok('fuente/ nunca va al sitio: ni en las tandas, ni en la demo, ni en lo que publica GitHub', /'comercial', 'fuente'\]\)/.test(leer('herramientas/empaquetar.js')) && /--exclude fuente/.test(leer('.github/workflows/pruebas.yml')) && /armar-common\.js --check/.test(leer('.github/workflows/pruebas.yml')) && /armar-common\.js --check/.test(leer('herramientas/git-hooks/pre-commit')));
  // ── tope de líneas largas y mapa ──
  const LL = require('../herramientas/lineas-largas').revisar();
  ok('ninguna línea nueva de más de 200 caracteres (la base solo puede bajar)', LL.subieron.length === 0, LL.subieron.map((x) => x[0] + ' ' + x[1] + '→' + x[2]).join(', ') + ' · node herramientas/lineas-largas.js --detalle <archivo>');
  const mapa = require('../herramientas/mapa').generar();
  const jsRaiz = fs.readdirSync(RAIZ).filter((f) => f.endsWith('.js') && f !== 'common.js' && !/\.min\.js$/.test(f));
  ok('el mapa del código nombra cada parte, cada .js del sitio, cada servidor y cada herramienta', partes.every((f) => mapa.includes('`' + f + '`')) && jsRaiz.every((f) => mapa.includes('`' + f + '`')) && mapa.includes('backends/backend-sgsst.gs') && mapa.includes('herramientas/instalar-empresa.js') && /\| `04-[^|]+\| \d+ \| UpdateManager, Outbox, OutboxBadge \|/.test(mapa));
  ok('el mapa existe y se regenera solo al sacar una versión', existe('MAPA-DEL-CODIGO.md') && /require\('\.\/mapa'\)\.generar\(\)/.test(leer('herramientas/subir-version.js')));

  // ── instalar-empresa.js con un «clasp» de mentira ──
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'clasp-nueva-')), remoto = path.join(base, 'remoto'), falso = path.join(base, 'clasp');
  fs.mkdirSync(remoto);
  fs.writeFileSync(falso, '#!/usr/bin/env node\n' + `
const fs = require('fs'), path = require('path'); const R = ${JSON.stringify(remoto)}; const [cmd, ...a] = process.argv.slice(2); const cwd = process.cwd();
const log = (x) => fs.appendFileSync(path.join(R, 'log.txt'), x + '\\n');
if (cmd === 'create') { const n = fs.readdirSync(R).filter((f) => f.startsWith('PROY')).length + 1, id = 'PROY' + n; fs.mkdirSync(path.join(R, id)); fs.writeFileSync(path.join(cwd, '.clasp.json'), JSON.stringify({ scriptId: id })); fs.writeFileSync(path.join(cwd, 'appsscript.json'), JSON.stringify({ timeZone: 'America/New_York', dependencies: {}, exceptionLogging: 'STACKDRIVER' })); fs.writeFileSync(path.join(cwd, 'Code.js'), 'function myFunction() {}'); log('create ' + a.join(' ')); console.log('Created new standalone script: https://script.google.com/d/' + id + '/edit'); }
else if (cmd === 'push') { const id = JSON.parse(fs.readFileSync(path.join(cwd, '.clasp.json'))).scriptId, d = path.join(R, id); fs.readdirSync(cwd).filter((f) => f !== '.clasp.json').forEach((f) => fs.copyFileSync(path.join(cwd, f), path.join(d, f))); log('push ' + id); }
else if (cmd === 'version') { console.log('Created version 1.'); }
else if (cmd === 'deploy') { if (fs.existsSync(path.join(R, 'FALLA-DEPLOY'))) { console.error('Deploy quota exceeded'); process.exit(1); } log('deploy ' + a.join(' ')); console.log('- AKfycbNUEVA_impl-123 @1.'); }
else { console.error('comando ' + cmd); process.exit(1); }`);
  fs.chmodSync(falso, 0o755);
  const lista = path.join(base, 'mis', 'clientes.json'), INST = path.join(RAIZ, 'herramientas/instalar-empresa.js');
  const correr = (args) => { try { return { cod: 0, sal: execFileSync('node', [INST].concat(args), { env: Object.assign({}, process.env, { CLASP: falso }), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { cod: e.status, sal: String(e.stdout || '') + String(e.stderr || '') }; } };
  const L = (id, f) => fs.existsSync(path.join(remoto, id, f)) ? fs.readFileSync(path.join(remoto, id, f), 'utf8') : '';
  const datos = ['--codigo', 'acme-sas', '--nombre', "Montajes D'Acme S.A.S.", '--correos', 'sst@acme.invalid,gerencia@acme.invalid', '--contacto', 'Laura Gómez', '--whatsapp', '+57 300 123 4567', '--clientes', lista];
  const pr = correr(datos.concat('--probar'));
  ok('instalar empresa: --probar arma el servidor y no crea nada en Google ni en la lista', pr.cod === 0 && /PRUEBA/.test(pr.sal) && !fs.existsSync(path.join(remoto, 'log.txt')) && !fs.existsSync(lista), pr.sal);
  const r1 = correr(datos), emp = L('PROY1', '01-Empresa.gs');
  ok('instalar empresa: crea el proyecto, sube el servidor de esta versión completo y sin el archivo vacío de Google', r1.cod === 0 && L('PROY1', '00-Portal.gs') === leer('servidor-unico/00-Portal.gs') && L('PROY1', '15-sgsst.gs') === leer('servidor-unico/15-sgsst.gs') && !L('PROY1', 'Code.js') && fs.readdirSync(path.join(remoto, 'PROY1')).filter((f) => f.endsWith('.gs')).length === fs.readdirSync(path.join(RAIZ, 'servidor-unico')).filter((f) => f.endsWith('.gs')).length, r1.sal);
  let emOk = false; try { const sb = {}; require('vm').runInNewContext(emp + '\nthis.N = EMPRESA_NOMBRE; this.C = CORREOS_SSTA; this.W = CONTACTO_EPP;', sb); emOk = sb.N === "Montajes D'Acme S.A.S." && sb.C.join() === 'sst@acme.invalid,gerencia@acme.invalid' && sb.W.nombre === 'Laura Gómez' && sb.W.whatsapp === '+57 300 123 4567'; } catch (e) { emOk = false; }
  ok('instalar empresa: 01-Empresa queda lleno con nombre (aun con apóstrofo), correos y WhatsApp, y es código válido', emOk, emp.slice(-400));
  let mf = {}; try { mf = JSON.parse(L('PROY1', 'appsscript.json')); } catch (e) {}
  ok('instalar empresa: zona horaria de Bogotá y aplicación web «como yo, cualquier usuario»', mf.timeZone === 'America/Bogota' && mf.webapp && mf.webapp.executeAs === 'USER_DEPLOYING' && mf.webapp.access === 'ANYONE_ANONYMOUS' && mf.runtimeVersion === 'V8', JSON.stringify(mf));
  let cl = []; try { cl = JSON.parse(fs.readFileSync(lista, 'utf8')); } catch (e) {}
  ok('instalar empresa: la anota en clientes.json con el formato que usa actualizar-servidores (crea la lista si no existe)', cl.length === 1 && cl[0].codigo === 'acme-sas' && cl[0].scriptId === 'PROY1' && cl[0].servidor === 'https://script.google.com/macros/s/AKfycbNUEVA_impl-123/exec' && require('../herramientas/actualizar-servidores').implementacion(cl[0].servidor) === 'AKfycbNUEVA_impl-123', JSON.stringify(cl));
  ok('instalar empresa: dice los dos pasos que solo puede hacer el dueño (instalar y verConfiguracion) y el enlace del proyecto', /script\.google\.com\/d\/PROY1\/edit/.test(r1.sal) && /«instalar»/.test(r1.sal) && /verConfiguracion/.test(r1.sal) && /--estado/.test(r1.sal), r1.sal);
  const log = fs.readFileSync(path.join(remoto, 'log.txt'), 'utf8');
  ok('instalar empresa: ningún argumento de clasp lleva espacios (Windows) y se publica la versión creada', /create --type standalone --title Portal-SSTA-acme-sas\n/.test(log) && /deploy --versionNumber 1 --description Portal-v\d+\n/.test(log), log);
  const r2 = correr(datos);
  ok('instalar empresa: un código que ya está en la lista no crea un segundo proyecto', r2.cod === 1 && /Ya hay una empresa con el código «acme-sas»/.test(r2.sal) && !fs.existsSync(path.join(remoto, 'PROY2')), r2.sal);
  const r3 = correr(['--codigo', 'Con Espacios', '--nombre', 'X', '--correos', 'no-es-correo']);
  ok('instalar empresa: datos mal escritos se dicen todos de una vez, antes de tocar Google', r3.cod === 1 && /--codigo/.test(r3.sal) && /no parece un correo/.test(r3.sal) && !fs.existsSync(path.join(remoto, 'PROY2')), r3.sal);
  fs.writeFileSync(path.join(remoto, 'FALLA-DEPLOY'), '1');
  const r4 = correr(['--codigo', 'beta', '--nombre', 'Beta S.A.S.', '--correos', 'sst@beta.invalid', '--clientes', lista]);
  ok('instalar empresa: si falla después de crear el proyecto, dice cuál es (para no dejar dos) y no lo anota', r4.cod === 1 && /El proyecto ya existe \(https:\/\/script\.google\.com\/d\/PROY2\/edit\)/.test(r4.sal) && JSON.parse(fs.readFileSync(lista, 'utf8')).length === 1, r4.sal);
  const r5 = (() => { try { return { cod: 0, sal: execFileSync('node', [INST, '--codigo', 'gama', '--nombre', 'Gama', '--correos', 'a@gama.invalid'], { env: Object.assign({}, process.env, { CLASP: path.join(base, 'no-existe-clasp') }), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { cod: e.status, sal: String(e.stderr || '') }; } })();
  ok('instalar empresa: sin clasp instalado explica cómo instalarlo', r5.cod === 1 && /npm install -g @google\/clasp/.test(r5.sal), r5.sal);
  fs.rmSync(base, { recursive: true, force: true });

  // ── --estado: en qué versión va cada empresa ──
  const AS = require('../herramientas/actualizar-servidores'), V = AS.versionPortal();
  ok('estado: distingue al día, atrasado, falta autorizar y sin respuesta', AS.clasificar(JSON.stringify({ ok: true, version: V }), V).estado === 'al-dia' && AS.clasificar('{"version":"v150"}', V).estado === 'atrasado' && AS.clasificar('<html>accounts.google.com/ServiceLogin</html>', V).estado === 'autorizar' && AS.clasificar('<html>Error</html>', V).estado === 'sin-respuesta' && AS.clasificar('', V).estado === 'sin-respuesta');
  const E = 'https://script.google.com/macros/s/AKfyX/exec';
  const res = await AS.estado([{ codigo: 'a', nombre: 'A', servidor: E + '?1' }, { codigo: 'b', nombre: 'B', servidor: E + '?2' }, { codigo: 'c', servidor: E + '?3' }, { codigo: 'd', servidor: 'https://otra.cosa/' }], V,
    async (url) => { if (/\?1$/.test(url)) return JSON.stringify({ version: V }); if (/\?2$/.test(url)) return JSON.stringify({ version: 'v160' }); throw new Error('sin red'); });
  const tabla = AS.tablaEstado(res, V);
  ok('estado: una empresa caída no tumba la revisión de las demás, y el resumen dice cuáles faltan', res.map((r) => r.estado).join() === 'al-dia,atrasado,sin-respuesta,sin-respuesta' && /1 de 4 al día\. Por actualizar o revisar: b, c, d/.test(tabla) && /v160\s+↑ falta actualizar/.test(tabla), tabla);
  let s6 = ''; try { s6 = execFileSync('node', [path.join(RAIZ, 'herramientas/actualizar-servidores.js'), path.join(os.tmpdir(), 'no-hay-lista-' + Date.now() + '.json'), '--estado'], { encoding: 'utf8' }); } catch (e) { s6 = String(e.stdout || ''); }
  ok('estado: si la lista de clientes no existe, lo dice en vez de reventar', /No existe .*instalar-empresa\.js/.test(s6), s6);

  // ── el sitio demo y lo que publica GitHub ──
  const dd = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-v167-'));
  require('../herramientas/armar-demo').armar(dd);
  const enDemo = fs.readdirSync(dd);
  ok('sitio demo (va a un repositorio público): sin precios ni contrato, sin documentos internos ni el código por partes', !['comercial', 'fuente', 'backends', 'herramientas', 'pruebas', 'TRASPASO.md', 'RELEASE.md', 'INSTALAR-NUEVA-EMPRESA.md', 'GUIA-DE-INSTALACION.docx', 'MAPA-DEL-CODIGO.md'].some((f) => enDemo.includes(f)), enDemo.filter((f) => !/\.(html|js|css|png)$/.test(f)).join(' '));
  ok('sitio demo: conserva lo que necesita para funcionar (su servidor en el navegador, la semilla y common.js)', enDemo.includes('servidor-unico') && enDemo.includes('demo') && enDemo.includes('common.js') && enDemo.includes('index.html'));
  fs.rmSync(dd, { recursive: true, force: true });
  const wf = leer('.github/workflows/pruebas.yml');
  ok('v175: el servidor, el configurador, la consola, el asesor y el instalador NO se publican (son del proveedor) y se abren en el computador con herramientas/proveedor.js',
    ['servidor-todo-en-uno', 'admin.html', 'configurar-empresa.html', 'asesor.html', 'instalar.html'].every((f) => wf.indexOf('--exclude ' + f) !== -1 && leer('herramientas/empaquetar.js').indexOf("'" + f + "'") !== -1) &&
    existe('servidor-todo-en-uno/Portal-SSTA.gs') && /PAGINAS = \{ consola: 'admin\.html'/.test(leer('herramientas/proveedor.js')));
  ok('la guía de instalación y el LEEME del paquete nombran el camino corto', /instalar-empresa\.js --codigo/.test(leer('INSTALAR-NUEVA-EMPRESA.md')) && /--estado/.test(leer('INSTALAR-NUEVA-EMPRESA.md')) && /instalar-empresa\.js/.test(leer('herramientas/empaquetar.js')) && /instalar-empresa\.js/.test(leer('herramientas/guia/hacer-guia.js')));
});

grupo('v168: las listas traen solo lo que cambió y la ficha 360 lee una sola vez', async () => {
  const { crearEntorno } = require('./simulador-apps-script');
  const T = /API_TOKEN: '([^']+)'/.exec(leer('config.js'))[1];
  const E = crearEntorno(path.join(RAIZ, 'backends/backend-sgsst.gs'), { fechasComoSheets: true });
  const P = (o) => E.post(Object.assign({ token: T }, o)), G = (o) => E.get(Object.assign({ token: T }, o));
  const hoy = E.ctx.hoyISO_();
  const acc = (id, extra) => P({ action: 'guardar', tipo: 'accion', id, opId: 'op-' + id + '-' + Math.random(),
    doc: Object.assign({ origen: 'Inspección', hallazgo: 'H ' + id, accion: 'A', responsable: 'Ana', fechaCompromiso: hoy, estado: 'ABIERTA' }, extra || {}) });
  for (let i = 0; i < 40; i++) acc('ACC-' + i);
  P({ action: 'guardar', tipo: 'reporte', id: 'REP-1', doc: { clase: 'Condición insegura', fecha: hoy, descripcion: 'x' }, opId: 'r1' });
  // Envejecer lo guardado: como si hubiera pasado una hora desde entonces.
  const R = E.hojas.Registros.filas; R.slice(1).forEach((f) => { f[10] = new Date(f[10].getTime() - 3600000); });
  const completa = G({ action: 'list', tipo: 'accion' });   // 40 acciones + la que el reporte crea sola
  ok('lista completa: igual que antes, más el sello para pedir cambios la próxima vez', completa.ok && !completa.delta && completa.rows.length === 41 && completa.total === 41 && completa.gen && completa.vista === 'abierto' && /^\d{4}-/.test(completa.hasta));
  // El simulador de la librería del cliente, con el servidor simulado detrás.
  const { SGSST } = (() => {
    const mem = {}, sb = { console, Date, JSON, Math, Promise, setTimeout, encodeURIComponent, decodeURIComponent, URLSearchParams, Array, Object, String, Number, Error, isNaN, parseInt,
      localStorage: { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } }, _mem: mem, _pedidos: [] };
    sb.window = sb; sb.addEventListener = () => {};
    const parte = leer('fuente/common/09-sgsst-y-personal.js');
    const cuerpo = parte.slice(parte.indexOf('const SGSST = {'), parte.indexOf('\n};', parte.indexOf('const SGSST = {')) + 3);
    require('vm').runInNewContext('const Consola = { clave: (k) => k }; const Sesion = { token: () => "", marcar() {}, rechazada() {}, pintarChip() {}, pedir() {} };' +
      'const ClavePortal = { esErrorDeClave: () => false, pedir() {} }; const Outbox = {}; const PORTAL_CONFIG = { API_TOKEN: ' + JSON.stringify(T) + ', BACKENDS: { sgsst: { url: "http://servidor/exec" } } };' +
      'async function fetchWithRetry(u) { _pedidos.push(u); const q = {}; new URLSearchParams(u.split("?")[1]).forEach((v, k) => { q[k] = v; }); const t = _servidor(q); return { status: 200, text: async () => t }; }\n' +
      cuerpo + '\nthis.SGSST = SGSST;', sb);
    sb._servidor = (q) => E.ctx.doGet({ parameter: q })._t;
    sb.SGSST._sb = sb; return sb;
  })();
  const sb = SGSST._sb, ultimo = () => sb._pedidos[sb._pedidos.length - 1], peso = (u) => { const q = {}; new URLSearchParams(u.split('?')[1]).forEach((v, k) => { q[k] = v; }); return E.ctx.doGet({ parameter: q })._t.length; };
  if (typeof SGSST.url !== 'function' || !SGSST.url()) { ok('el cliente simulado encuentra su servidor', false, 'SGSST.url() vacío'); return; }
  const l1 = await SGSST.listar('accion');
  ok('celular, primera vez: pide la lista completa y guarda la copia con el sello', l1.rows.length === 41 && !/cambios=/.test(ultimo()) && /"gen":"/.test(sb._mem['ssta-sgsst-lista:accion'] || ''));
  const l2 = await SGSST.listar('accion'), pesoDelta = peso(ultimo()), pesoTodo = JSON.stringify(completa).length;
  ok('celular, segunda vez: pide solo los cambios, la respuesta pesa 20 veces menos y la lista queda idéntica', /cambios=/.test(ultimo()) && pesoDelta * 20 < pesoTodo && JSON.stringify(l2.rows) === JSON.stringify(l1.rows), pesoDelta + ' vs ' + pesoTodo);
  acc('ACC-NUEVA'); const v5 = G({ id: 'ACC-5' });
  P({ action: 'guardar', tipo: 'accion', id: 'ACC-5', versionBase: v5.version, opId: 'cambio5', doc: Object.assign({}, v5.doc, { estado: 'CERRADA', hallazgo: 'CAMBIADO' }) });
  P({ action: 'borrar', id: 'ACC-7', motivo: 'duplicada', opId: 'b7' });
  const l3 = await SGSST.listar('accion'), todo3 = G({ action: 'list', tipo: 'accion' }).rows;
  ok('lo nuevo, lo modificado y lo borrado llegan en los cambios: la copia unida es IGUAL a la lista completa del servidor (mismo orden)', /cambios=/.test(ultimo()) && JSON.stringify(l3.rows) === JSON.stringify(todo3) && l3.rows.length === 41 && !l3.rows.some((r) => r.id === 'ACC-7') && l3.rows.some((r) => r.id === 'ACC-NUEVA'),
    l3.rows.length + ' vs ' + todo3.length);
  P({ action: 'restaurar', id: 'ACC-7', opId: 'rest7' });
  const l4 = await SGSST.listar('accion');
  ok('restaurar de la papelera cuenta como cambio: el registro vuelve a la lista del celular', l4.rows.some((r) => r.id === 'ACC-7') && JSON.stringify(l4.rows.map((r) => r.id).sort()) === JSON.stringify(G({ action: 'list', tipo: 'accion' }).rows.map((r) => r.id).sort()));
  // Cuenta que no cuadra (alguien quitó una fila a mano en la hoja): el celular pide la lista entera.
  const iFila = R.findIndex((f) => f[0] === 'ACC-9'); R.splice(iFila, 1);
  const antes = sb._pedidos.length, l5 = await SGSST.listar('accion');
  ok('si la cuenta del servidor no cuadra con la copia, el celular pide la lista entera y se corrige solo', sb._pedidos.length - antes === 2 && !/cambios=/.test(ultimo()) && !l5.rows.some((r) => r.id === 'ACC-9') && l5.rows.length === G({ action: 'list', tipo: 'accion' }).rows.length);
  // Archivar saca filas: cambia «gen» y nadie recibe cambios sobre una copia vieja.
  const genAntes = G({ action: 'list', tipo: 'accion' }).gen; E.ctx.subirListaGen_();
  const conGenViejo = G({ action: 'list', tipo: 'accion', cambios: new Date().toISOString(), gen: genAntes, vista: 'abierto' });
  ok('después de archivar (cambia «gen») el servidor responde con la lista completa, no con cambios', !conGenViejo.delta && conGenViejo.rows.length >= 40 && /subirListaGen_\(\)/.test(leer('backends/backend-sgsst.gs').split('function archivarAniosAnteriores')[1] || ''));
  const otraVista = G({ action: 'list', tipo: 'accion', cambios: new Date().toISOString(), gen: conGenViejo.gen, vista: 'u:otro:consulta' });
  ok('si la copia es de otro usuario o rol («vista» distinta), lista completa', !otraVista.delta && otraVista.vista === 'abierto');
  const sinCambios = G({ action: 'list', tipo: 'reporte', cambios: new Date(Date.now() + 1000).toISOString(), gen: conGenViejo.gen, vista: 'abierto' });
  ok('sin novedades en la última hora: cero filas y la cuenta para comprobar', sinCambios.delta && sinCambios.rows.length === 0 && sinCambios.borrados.length === 0 && sinCambios.total === 1, JSON.stringify(sinCambios).slice(0, 200));
  // Margen: un guardado que se estaba escribiendo cuando se leyó (su hora es anterior al «hasta» del celular) no se pierde.
  acc('ACC-TARDE'); R[R.length - 1][10] = new Date(Date.now() - 5 * 60000);
  const conMargen = G({ action: 'list', tipo: 'accion', cambios: new Date().toISOString(), gen: conGenViejo.gen, vista: 'abierto' });
  ok('margen de 10 minutos: lo que se guardó justo antes de la lectura anterior vuelve a venir', conMargen.delta && conMargen.rows.some((r) => r.id === 'ACC-TARDE'));
  // Tipos reservados (salud): sin copia en el celular, siempre completa.
  P({ action: 'guardar', tipo: 'examen', id: 'EXA-1', doc: { cedula: '111', nombre: 'Ana', fecha: hoy, tipoExamen: 'Periódico', concepto: 'Apto' }, opId: 'e1' });
  await SGSST.listar('examen'); await SGSST.listar('examen');
  ok('datos de salud: siguen sin copia en el celular y por eso nunca piden cambios', !/cambios=/.test(ultimo()) && !Object.keys(sb._mem).some((k) => /lista:examen/.test(k)));
  // Portal nuevo con servidor viejo (sin sello): se comporta como antes.
  const viejo = SGSST.unirCambios([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { rows: [{ id: 'b', x: 2 }, { id: 'd' }], borrados: ['a'] });
  ok('unir cambios: lo modificado queda en su sitio, lo nuevo al final y lo borrado sale', JSON.stringify(viejo) === '[{"id":"b","x":2},{"id":"c"},{"id":"d"}]');
  ok('la copia de las listas va a IndexedDB (no le quita espacio a borradores y firmas) y se borra al cambiar de empresa', /indexedDB\.open\('ssta-listas', 1\)/.test(leer('common.js')) && /indexedDB\.deleteDatabase\('ssta-listas'\)/.test(leer('empresa-motor.js')));
  // Ficha 360: una persona con 60 registros no cuesta 60 lecturas.
  for (let i = 0; i < 60; i++) P({ action: 'guardar', tipo: 'induccion', id: 'IND-' + i, doc: { nombre: 'Luis Mora', cedula: '1099888777', fecha: hoy, tipoInduccion: 'Inducción' }, opId: 'i' + i });
  const Pr = Object.getPrototypeOf(E.hojas.Registros), gr = Pr.getRange; let lecturas = 0;
  Pr.getRange = function (...a) { const r = gr.apply(this, a), gv = r.getValues; r.getValues = function () { lecturas++; return gv.call(r); }; return r; };
  const vin = G({ action: 'vinculos', cedula: '1099888777' }); Pr.getRange = gr;
  ok('ficha 360: 60 registros de una persona se leen en pocas llamadas (antes, una por registro) y salen todos', vin.ok && vin.rows.length === 60 && lecturas <= 6, vin.rows.length + ' registros, ' + lecturas + ' lecturas');
});

grupo('v171: informe mensual de actividades (permisos, accidentes, inspecciones, charlas y EPP)', () => {
  const IM = require(path.join(RAIZ, 'informe-mes-reglas.js'));
  const r = (tipo, id, resumen, extra) => Object.assign({ tipo, id, fecha: resumen.fecha || '', estado: '', resumen }, extra || {});
  const rows = [
    r('reporte', 'R1', { clase: 'Accidente de trabajo', fecha: '2026-10-03', lugar: 'Bodega', descripcion: 'Golpe en la mano', diasIncapacidad: 3, lesionado: 'Pedro Pérez', furat: { radicado: true } }),
    r('reporte', 'R2', { clase: 'Incidente', fecha: '2026-10-09', lugar: 'Patio', descripcion: 'Caída de carga sin lesionados' }),
    r('reporte', 'R3', { clase: 'Acto inseguro', fecha: '2026-10-10' }),
    r('reporte', 'R4', { clase: 'Condición insegura', fecha: '2026-10-11' }),
    r('reporte', 'R5', { clase: 'Accidente de trabajo', fecha: '2026-09-28', diasIncapacidad: 9 }),
    r('inspeccion', 'I1', { categoria: 'Extintores', equipo: 'EXT-01', fecha: '2026-10-05', resultado: 'NO CONFORME', nc: 2, noConformes: ['Manómetro en rojo', 'Sin señalización'] }),
    r('inspeccion', 'I2', { categoria: 'Botiquín', fecha: '2026-10-06', resultado: 'CONFORME', nc: 0 }),
    r('induccion', 'N1', { fecha: '2026-10-02', tipoInduccion: 'Inducción', intensidadHoras: 4 }),
    r('induccion', 'N2', { fecha: '2026-10-02', tipoInduccion: 'Reinducción', intensidadHoras: 2 }),
    r('entrega', 'E1', { fecha: '2026-10-04', cedula: '1', motivo: 'Ingreso', elementosTexto: '2 × Guantes de vaqueta, 1 × Casco' }),
    r('entrega', 'E2', { fecha: '2026-10-20', cedula: '2', motivo: 'Reposición por desgaste', elementosTexto: '1 × Guantes de vaqueta', capacitado: false }),
    r('preop', 'P1', { fecha: '2026-10-07', nombreFormulario: 'Montacargas', resultado: 'CON NOVEDAD' }),
    r('preop', 'P2', { fecha: '2026-10-08', nombreFormulario: 'Montacargas', resultado: 'SIN NOVEDAD' }),
    r('reunion', 'C1', { fecha: '2026-10-15', comite: 'COPASST' }),
    r('accion', 'A1', { fechaCompromiso: '2026-10-10' }, { fecha: '2026-10-01', estado: 'ABIERTA' }),
  ];
  const permisos = [
    { tipo: 'Trabajo en Alturas', rows: [{ status: 'CERRADO', openedAt: '2026-10-01T08:00:00' }, { status: 'ABIERTO', openedAt: '2026-10-30T08:00:00' }, { status: 'CERRADO', openedAt: '2026-09-30T08:00:00' }] },
    { tipo: 'Trabajo en Caliente', rows: null },
  ];
  const R = IM.calcular({ mes: '2026-10', hoy: '2026-11-11', rows, permisos,
    ats: [{ fechaDesde: '2026-10-02', estado: 'CERRADO' }, { fechaDesde: '2026-11-01', estado: 'ABIERTO' }],
    epp: [{ tipo: 'epp', fechaInspeccion: '2026-10-12', malos: 'Casco | Botas' }, { tipo: 'epp', fechaInspeccion: '2026-10-13', malos: '' }, { tipo: 'brigadistas', fechaInspeccion: '2026-10-13' }],
    charlas: [{ semanaDel: '2026-10-05', charlas: 5, asistentes: 60, temas: '{"lun":"Orden y aseo","mar":"Uso del arnés"}' }, { semanaDel: '2026-10-12', charlas: 3, asistentes: 30, temas: '{"lun":"Orden y aseo","mie":"Riesgo eléc' }] });
  ok('informe mensual: permisos abiertos en el mes por tipo (los del mes anterior no cuentan) y ATS', R.permisos.total === 2 && R.permisos.cerrados === 1 && R.permisos.siguen === 1 && R.permisos.ats === 1, JSON.stringify(R.permisos));
  ok('informe mensual: el servidor que no respondió sale «sin datos», no en cero', R.permisos.tipos[1].sinDatos === true && R.permisos.faltan.join() === 'Trabajo en Caliente');
  ok('informe mensual: accidentes, días perdidos, incidentes, actos y condiciones del mes', R.eventos.accidentes === 1 && R.eventos.dias === 3 && R.eventos.incidentes === 1 && R.eventos.actos === 1 && R.eventos.condiciones === 1, JSON.stringify(R.eventos).slice(0, 200));
  ok('informe mensual: no lleva nombres de personas (el lesionado no aparece)', JSON.stringify(R).indexOf('Pedro') === -1);
  ok('informe mensual: inspecciones con sus hallazgos', R.inspecciones.total === 2 && R.inspecciones.hallazgos === 2 && R.inspecciones.lista[0].items.length === 2);
  ok('informe mensual: charlas, asistencias y temas sin repetir (también si el texto llega recortado)', R.formacion.charlas === 8 && R.formacion.asistentes === 90 && R.formacion.temas.join('|') === 'Orden y aseo|Uso del arnés', R.formacion.temas.join('|'));
  ok('informe mensual: los temas escritos «Lunes: … | Martes: …» salen separados y sin el día', IM.temas('Lunes: Orden y aseo | Martes: Pausas activas').join('/') === 'Orden y aseo/Pausas activas');
  ok('informe mensual: inducciones y reinducciones con horas', R.formacion.inducciones === 1 && R.formacion.reinducciones === 1 && R.formacion.horas === 6);
  ok('informe mensual: EPP revisados con sus novedades y entregados sumando cada elemento', R.epp.revisados === 2 && R.epp.conNovedad === 1 && R.epp.brigada === 1 && R.epp.entregas === 2 && R.epp.unidades === 4 &&
    R.epp.elementos[0].k === 'Guantes de vaqueta' && R.epp.elementos[0].n === 3 && R.epp.porReposicion === 1 && R.epp.sinCapacitar === 1, JSON.stringify(R.epp));
  ok('informe mensual: preoperacionales, comités y acciones vencidas', R.otros.preop === 2 && R.otros.preopNovedad === 1 && R.otros.reuniones[0].k === 'COPASST' && R.acciones.vencidas === 1);
  const D = IM.destacados(R).join(' / ');
  ok('informe mensual: el resumen del mes dice lo más importante en frases', /2 permisos de trabajo y 1 ATS/.test(D) && /1 accidente de trabajo \(3 días perdidos\)/.test(D) && /2 inspecciones con 2 hallazgos/.test(D), D);
  ok('informe mensual: los primeros 5 días del mes propone el mes que acaba de cerrar', IM.porDefecto('2026-11-03') === '2026-10' && IM.porDefecto('2026-11-11') === '2026-11');
  ok('informe mensual: está en el inicio, en el service worker y en el módulo de gerencia', /href="informe-mes\.html"/.test(leer('index.html')) && /informe-mes-reglas\.js/.test(leer('sw.js')) && /'informe-mes\.html': 'gerencia'/.test(leer('empresa-motor.js')));
});

grupo('v172: empezar con un cliente nuevo y la guía a la que se le pregunta', () => {
  const EP = require(path.join(RAIZ, 'empezar-reglas.js')), GP = require(path.join(RAIZ, 'guia-preguntas.js'));
  const vacio = EP.evaluar({ servidor: false, empresa: false, usuarios: null, rows: null });
  ok('por dónde iniciar (v174): 2 fases, sin «instalar el portal»; sin nada hecho, el siguiente paso es subir el personal', vacio.fases.length === 2 && vacio.hechos === 0 && vacio.siguiente.id === 'personal' && !vacio.pasos.some((p) => /servidor|empresa|usuarios/.test(p.id)));
  const rows = [{ tipo: 'trabajador' }, { tipo: 'peligro' }, { tipo: 'comite', id: 'CMT-COPASST', resumen: {} }];
  const E = EP.evaluar({ servidor: true, empresa: true, usuarios: true, rows, manual: { politica: true } });
  ok('empezar: lo que el portal ve se tacha solo (personal, matriz, COPASST) y lo marcado a mano también', ['personal', 'politica', 'peligros', 'copasst'].every((id) => E.pasos.find((p) => p.id === id).hecho) &&
    E.siguiente.id === 'legal' && !E.pasos.find((p) => p.id === 'politica').auto, E.siguiente && E.siguiente.id);
  const sinObra = EP.evaluar({ servidor: true, empresa: true, rows: [], activo: (h) => h !== 'entrega-epp.html' });
  ok('empezar: un módulo apagado no aparece en el camino', !sinObra.pasos.some((p) => p.id === 'entrega'));
  ok('empezar: cada paso lleva a una pantalla que existe', EP.PASOS.every((p) => fs.existsSync(path.join(RAIZ, p[5].split(/[?#]/)[0]))), EP.PASOS.filter((p) => !fs.existsSync(path.join(RAIZ, p[5]))).map((p) => p[5]).join());
  const vm = require('vm'), c = {}; vm.createContext(c); vm.runInContext(leer('ayuda-guias.js') + ';this.G=GUIAS;', c);
  GP.armar({ guias: c.G, faq: [['Olvidé la clave del portal', 'Pídela al responsable de SST.']] });
  const top = (q) => (GP.preguntar(q)[0] || {}).t || '';
  ok('guía: responde preguntas del portal escritas de muchas formas', /empiezo/.test(top('por donde empiezo')) && /clave/i.test(top('olvide mi contraseña')) && /informe del mes/.test(top('informe del mes')), top('olvide mi contraseña'));
  ok('guía: responde la norma (FURAT 2 días hábiles, COPASST cada mes, estándares 7/21/60)', /ARL/.test(top('plazo para reportar el furat')) && /COPASST/.test(top('cada cuanto se reune el copasst')) &&
    /7 estándares.*21.*60/.test(GP.preguntar('cuantos estandares minimos aplican')[0].r));
  ok('guía: las palabras vacías («cómo», «se», «de») no cuentan para buscar', GP.palabras('cómo se calibra el luxómetro de la bodega').join() === 'calibra,luxometro,bodega', GP.palabras('cómo se calibra el luxómetro de la bodega').join());
  ok('guía: una sola palabra parecida no basta (luxómetro ≠ autoevaluación)', GP.preguntar('como se calibra el luxometro de la bodega').length === 0);
  ok('guía: si no sabe, no inventa (pregunta sin relación = sin respuesta)', GP.preguntar('receta de arepas con queso').length === 0);
  ok('guía: cada enlace de una respuesta lleva a una pantalla que existe', GP.RESPUESTAS.every((x) => (x.a || []).every(([, h]) => fs.existsSync(path.join(RAIZ, h.split(/[?#]/)[0])))));
  ok('guía: está en la ayuda, solo le escribe al servidor de la propia empresa (la pregunta sin respuesta) y el inicio muestra «Tu siguiente paso»', /guia-preguntas\.js/.test(leer('ayuda.html')) && !/XMLHttpRequest|https?:\/\/[a-z]/.test(leer('guia-preguntas.js')) && /fetch\(r, \{ method: 'POST', body: JSON\.stringify\(\{ __guia: \{ texto: l\[0\] \} \}\) \}\)/.test(leer('guia-preguntas.js')) &&
    /Tu siguiente paso/.test(leer('index.html')) && /empezar-reglas\.js/.test(leer('sw.js')));
});

grupo('v173: la guía flotante y lo que no supo responder', () => {
  const c = leer('common.js'), css = leer('common.css');
  ok('guía flotante: está en todas las pantallas (common.js) y carga las respuestas solo al abrirla', /const GuiaFlotante/.test(c) && /cargarJs\('guia-preguntas\.js'\)/.test(c) && /cargarJs\('ayuda-guias\.js'\)/.test(c));
  ok('guía flotante: no sale en Ayuda, en la pantalla de planta, sin señal ni al imprimir', /ayuda\|pantalla-planta\|offline/.test(c) && /@media print\{\.gf-btn,\.gf-panel\{display:none/.test(css));
  ok('guía flotante: sube cuando hay barra de abajo (no se tapan)', /body\.con-barra-inferior \.gf-btn\{bottom:calc\(92px/.test(css));
  ok('consola: junta lo que la guía no supo responder en todos los clientes, con «Copiar la lista»', /function guiaSinRespuesta/.test(leer('admin.html')) && /gsCopiar/.test(leer('admin.html')) && /guiaServidor/.test(leer('backends/backend-sgsst.gs')));
  ok('servidor: la raíz anuncia «guia» y entrega las preguntas sin nombre de quien preguntó', /capacidades: \[[^\]]*'guia'/.test(leer('herramientas/servidor-unico-portal.gs')) && /\{ t: t, n: 1, u: hoy \}/.test(leer('herramientas/servidor-unico-portal.gs')));
});

grupo('v174: ajustes pedidos (auditor, papelera, avisos, firma, listado maestro, agenda, personal, brigada, por dónde iniciar)', () => {
  const us = leer('usuarios.html'), au = leer('auditorias.html'), hb = leer('habilitacion.html'), g = leer('backends/backend-sgsst.gs');
  ok('enlaces para auditores: ahora están en Auditorías y ya no en Usuarios', /id="cardAuditor"/.test(au) && /auditor-enlaces\.js/.test(au) && !/cardAuditor|cargarAuditores/.test(us) && /function cargarAuditores/.test(leer('auditor-enlaces.js')));
  ok('auditor: el enlace es su llave; el servidor no le pide la clave del portal', /if \(p\.auditor\) \{ iniciarContexto_\(''\); const ra = contextoAuditor_\(p\)/.test(g));
  ok('papelera: el botón no aplasta el texto (ya no sale una letra por renglón)', /\.pap-item \.btn\{width:auto;flex:none/.test(leer('papelera.html')) && /\.pap-item div\{flex:1 1 220px;min-width:0\}/.test(leer('papelera.html')));
  ok('avisos por correo: cada rol puede tener varios correos adicionales', /data-correos="' \+ r/.test(us) && /data-correos="' \+ r/.test(leer('mis-avisos.html')) && /Correos adicionales por rol/.test(g));
  ok('firma: en cada recuadro de firma se puede subir una foto o escaneo (se limpia el fondo)', /const SubirFirma/.test(leer('common.js')) && /SubirFirma\.boton\(c\)/.test(leer('common.js')) && /Subir firma \(foto\)/.test(leer('common.js')));
  ok('listado maestro de documentos desde Excel (con el formato propio: empareja columnas por nombre)', /id="xDoc"/.test(leer('documental.html')) && /Listado maestro de documentos desde Excel/.test(leer('documental.html')) && /const SIN_DOC = /.test(leer('documental.html')));
  ok('Gestión: «Para hoy y esta semana» al lado del calendario, agrupado en Hoy / Esta semana / Atrasado', /class="dia-grid"/.test(leer('index.html')) && /\['Hoy \(' \+ pHoy\.length/.test(leer('index.html')) && /\['Esta semana \(' \+ pSem\.length/.test(leer('index.html')));
  ok('calendario: «+ Tarea» con día, hora y recordatorio; se guarda en el servidor y se marca hecha', /id="agNueva"/.test(leer('index.html')) && /tipo: 'tarea'/.test(leer('agenda-tareas.js')) && /data-hecha/.test(leer('index.html')) && /tarea: \{ hoja: 'Tareas y recordatorios'/.test(g));
  ok('personal: el autocompletar solo ofrece el personal habilitado (ya no la base del anexo de permisos)', !/listPersonal/.test(leer('sgsst-ui.js')) && /p\.activo !== false && !p\.porRevisar/.test(leer('sgsst-ui.js')));
  ok('personal: lo que llega de otros módulos queda «por revisar» aparte, con Incluir / No es del personal', /function pintarRevisar/.test(hb) && /data-incluir/.test(hb) && /porRevisar: true, origen: 'Inducción'/.test(g));
  ok('personal: sin «Traer de la base del anexo»', !/btnImportar|Traer de la base del anexo/.test(hb));
  ok('personal: tipo de documento CC, TI, CE, PPT, PEP y pasaporte', ['Cédula de ciudadanía', 'Tarjeta de identidad', 'PPT', 'PEP', 'Pasaporte'].every((t) => hb.indexOf(t) !== -1) && /function docNumero/.test(hb));
  ok('personal: la seguridad social del mes se registra una vez para todo el personal propio', /id="btnPila"/.test(hb) && /requisitos: \{ seguridad_social: reg \}/.test(hb));
  ok('brigada: la dotación ya no lleva «vence»', !/data-dk="vence"/.test(leer('emergencias.html')) && !/x\.vence/.test(leer('emergencias.html')));
  ok('«Por dónde iniciar» (antes «Empezar con un cliente nuevo») sin la fase de instalar', /<h1>Por dónde iniciar<\/h1>/.test(leer('empezar.html')) && !/'servidor',/.test(leer('empezar-reglas.js')));
  ok('guía flotante: saluda y pregunta en qué ayuda, como un chat', /¿En qué te ayudo\?/.test(leer('common.js')) && /gf-yo/.test(leer('common.css')));
});

grupo('v175: venta protegida, licencia con solo lectura, Micro 7 y Decreto 1040', () => {
  const vm = require('vm'), c = { localStorage: { getItem: () => null, setItem() {} }, EMPRESA: {}, document: undefined, setTimeout, Promise, JSON, Date };
  vm.createContext(c); vm.runInContext(leer('fuente/common/14-licencia-modo.js') + ';this.LM = LicenciaModo;', c);
  const P = (b) => c.LM.permitido(b);
  ok('licencia vencida: en solo lectura se puede entrar, consultar, reportar accidentes y presentar quejas; lo demás no', P({ action: 'login' }) && P({ __consulta: 1 }) && P({ action: 'guardar', tipo: 'reporte' }) &&
    P({ action: 'guardar', tipo: 'buzon' }) && P({ action: 'guardar', tipo: 'queja' }) && !P({ action: 'guardar', tipo: 'inspeccion' }) && !P({ action: 'abrir', permitCode: 'X' }));
  ok('licencia: el bloqueo de escritura está en el único camino de envío (fetchWithRetry) y es a los 60 días de vencida', /LicenciaModo\.revisarEnvio\(options\.body\)/.test(leer('common.js')) && /GRACIA = 60/.test(leer('common.js')));
  ok('licencia: la llave pública está puesta y la privada NO está en el proyecto', /LICENCIA_LLAVE_PUBLICA = \{"kty":"EC"/.test(leer('licencia.js')) && !/"d":"/.test(leer('licencia.js')));
  ok('Micro 7: máximo 8 módulos visibles (más usuarios y tablero) e incluye convivencia por el Decreto 1040', (() => { const m = /micro: \{[^}]*mods: \[([^\]]*)\]/.exec(leer('empresa-motor.js')); if (!m) return false;
    const l = m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter((x) => x !== 'usuarios' && x !== 'tablero'); return l.length <= 8 && l.indexOf('convivencia') !== -1; })());
  ok('Micro 7 tiene precio en PRECIOS.md', /\| Micro 7 \| 190\.000/.test(leer('comercial/PRECIOS.md')));
  const cv = leer('convivencia.html'), g = leer('backends/backend-sgsst.gs');
  ok('Decreto 1040: pestaña con los requisitos (política participativa, protocolo, canales, capacitación anual…) y plantillas en PDF', /id: 'd1040', nombre: 'Decreto 1040'/.test(cv) && /function pdfPolitica1040/.test(cv) && /function pdfProtocolo1040/.test(cv) && /cero tolerancia/.test(cv));
  ok('Decreto 1040: medidas de protección en la queja, plazo de 5 días hábiles en acoso sexual y 6 meses contra represalias', /MEDIDAS_1040/.test(cv) && /sumarHabiles\(q\.medSolicitud, 5\)/.test(cv) && /const seisMeses = /.test(cv) && /sumarHabiles_\(r\.medSolicitud, 5\)/.test(g));
  ok('Decreto 1040: la capacitación anual avisa cuando toca repetirla', /tipo === 'cumple1040' && r\.capacitacion\) anotar\(sumarDias_\(r\.capacitacion, 365\)/.test(g));
  ok('quejas: fuera del cifrado solo van fechas y una marca (nunca nombres ni hechos)', /'medSolicitud', 'medAdopcion', 'medSexual', 'protegeHasta'/.test(g) && /k !== 'cifrado' && d\[k\] != null && \(typeof d\[k\] !== 'string' \|\| d\[k\]\.length > 60\)/.test(g));
  ok('guion de instalación y texto del video de la pantalla «no seguro» (privados, en comercial/)', existe('comercial/GUION-INSTALACION.md') && /no es seguro|no seguro/i.test(leer('comercial/GUION-INSTALACION.md')));
});

/* ═══════════════════════════════════════════════════════════ */
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   PRUEBAS DEL PORTAL SSTA — antes de desplegar        ║');
console.log('╚══════════════════════════════════════════════════════╝');
(async () => {
for (const [nombre, fn] of grupos) {
  console.log('\n▸ ' + nombre);
  try { await fn(); } catch (e) { fallos++; console.log('    ✗ error ejecutando el grupo: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); }
}
console.log('\n' + '─'.repeat(58));
if (fallos === 0) {
  console.log(`✅  ${total} comprobaciones, todas correctas. Se puede desplegar.`);
} else {
  console.log(`❌  ${fallos} de ${total} comprobaciones fallaron. Revisar antes de subir nada.`);
}
process.exit(fallos === 0 ? 0 : 1);
})();
