const UpdateManager = {
  init() {
    if (!('serviceWorker' in navigator)) return;
    // v136: la primera vez (sin Service Worker todavía) se espera a que la página termine de cargar y a un
    // momento libre: así la descarga de todo el portal para usarlo sin señal no compite con lo que la
    // persona está esperando ver. Con señal lenta el inicio abre varios segundos antes.
    if (!navigator.serviceWorker.controller && !this._esperoCarga) {
      this._esperoCarga = true;
      const luego = () => setTimeout(() => this.init(), 0);
      if (document.readyState === 'complete') luego(); else window.addEventListener('load', luego, { once: true });
      return;
    }
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Ya hay un SW nuevo esperando desde antes de esta carga.
      if (reg.waiting) this._showBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            this._showBanner(nuevo);
          }
        });
      });
    }).catch(() => {});

    // Cuando el SW nuevo toma control, recarga una sola vez.
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargando) return;
      recargando = true;
      location.reload();
    });

    // Mensaje del SW pidiendo reintentar la cola pendiente (background sync).
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data === 'TRY_FLUSH_OUTBOX') Outbox.flush();
    });
  },
  _showBanner(worker) {
    if (document.getElementById('updateBanner')) return;
    const el = document.createElement('div');
    el.id = 'updateBanner';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span>🔄 Hay una versión nueva del portal disponible.</span>
      <button type="button" id="updateBannerBtn">Actualizar ahora</button>`;
    document.body.prepend(el);
    document.getElementById('updateBannerBtn').addEventListener('click', () => {
      worker.postMessage('SKIP_WAITING');
      el.remove();
    });
  }
};

/**
 * Outbox: cola de permisos que no se pudieron guardar por falta de señal.
 * Usa IndexedDB (no localStorage) porque el Service Worker también debe
 * poder leerla/escribirla en segundo plano vía Background Sync.
 * Uso desde los formularios (dentro del catch de fetchWithRetry):
 *   await Outbox.add(CONFIG.SCRIPT_URL, { action:'open', code, data, token });
 * Y al cargar la página: Outbox.flush();  // reintenta lo pendiente
 */
const Outbox = {
  _dbPromise: null,
  _flushing: false, // evita que dos disparos simultáneos (carga de página + evento 'online'
                     // + mensaje del Service Worker) reenvíen el mismo permiso dos veces
  _db() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('ssta-outbox', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  },
  /**
   * Encola un permiso pendiente. A diferencia de la versión anterior, la
   * promesa ahora SÍ rechaza si IndexedDB no pudo guardar el registro
   * (cuota llena por las firmas en base64, modo privado de Safari, etc.).
   * Antes la promesa quedaba colgada para siempre y el formulario le
   * mostraba al usuario "quedó guardado y se reintentará solo" sin que
   * realmente hubiera quedado nada guardado — quien llama debe hacer
   * await y avisar al usuario si esto rechaza.
   */
  async add(url, body) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      // v116: lo de la consola del administrador y lo del portal de un cliente no se mezclan en la cola
      // (cada uno sale con su clave y su sesión, y solo desde su lado).
      const nuevo = { url, body, savedAt: new Date().toISOString(), intentos: 0, ambito: Consola.activa() ? 'consola' : 'portal' };
      // v110: la misma operación (mismo opId) no se encola dos veces: si alguien
      // vuelve a guardar sin señal, queda solo la versión más reciente.
      const op = body && body.opId;
      if (!op) store.add(nuevo);
      else {
        const cur = store.openCursor();
        cur.onsuccess = () => {
          const c = cur.result;
          if (c) { const v = c.value; if (v.url === url && v.body && v.body.opId === op) c.delete(); c.continue(); }
          else store.add(nuevo);
        };
      }
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Outbox: transacción abortada'));
      tx.oncomplete = () => {
        // Ya quedó guardado en la cola: se confirma YA. Antes se esperaba a
        // que el Service Worker estuviera listo para registrar el Background
        // Sync, y si el Service Worker no estaba activo (primera visita, modo
        // privado, registro fallido) esa espera no terminaba nunca: el botón
        // quedaba en "Guardando…" y el aviso de "quedó en cola" no salía.
        Outbox._avisar();
        resolve();
        // El Background Sync se registra aparte, sin bloquear. Si el navegador
        // no lo soporta, igual se reintenta al volver la señal o al recargar.
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready
            .then((reg) => reg.sync.register('sync-outbox'))
            .catch(() => { /* sin soporte o permiso denegado; no es crítico */ });
        }
      };
    });
  },
  async list() {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readonly');
      const req = tx.objectStore('pending').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve([]);
    });
  },
  async remove(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').delete(id);
      tx.oncomplete = () => resolve();
    });
  },
  async _incrementarIntentos(id) {
    const db = await this._db();
    return new Promise((resolve) => {
      const tx = db.transaction('pending', 'readwrite');
      const store = tx.objectStore('pending');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (item) { item.intentos = (item.intentos || 0) + 1; store.put(item); }
        resolve(item ? item.intentos : 0);
      };
      getReq.onerror = () => resolve(0);
    });
  },
  /** Reintenta enviar todo lo pendiente. Llamar al cargar la página y al volver la señal. */
  async flush() {
    if (!navigator.onLine) return;
    if (this._flushing) return;
    this._flushing = true;
    try {
      const items = await this.list();
      // Cambios del MISMO registro SG-SST (crear, luego FURAT, luego cierre…):
      // si uno no sale, los que siguen esperan a la próxima pasada, para que
      // lleguen en orden y uno viejo no pise a uno nuevo.
      const trabados = new Set();
      const claveDoc = (it) => (it.body && it.body.id && /^(guardar|parche|borrar|adjuntar|quitarAdjunto|restaurar)$/.test(it.body.action || '')) ? it.url + '|' + it.body.id : null;
      const ambito = Consola.activa() ? 'consola' : 'portal';
      for (const item of items) {
        if ((item.ambito || 'portal') !== ambito) continue;
        const cd = claveDoc(item);
        if (cd && trabados.has(cd)) continue;
        if (cd) trabados.add(cd);   // se suelta abajo si salió
        // Lo que quedó en cola se envía con la clave VIGENTE, no con la que
        // había cuando se guardó (si la clave cambió, el envío fallaría).
        if (item.body && Object.prototype.hasOwnProperty.call(item.body, 'token') && typeof PORTAL_CONFIG !== 'undefined') item.body.token = PORTAL_CONFIG.API_TOKEN;
        // SG-SST con usuarios: sale con la sesión vigente (también lo que quedó en cola antes de los usuarios).
        // v112: igual para los permisos, el ATS y lo demás de la obra (todo lo del servidor del portal).
        if (item.body && typeof Sesion !== 'undefined' && ((typeof SGSST !== 'undefined' && SGSST.url() && item.url === SGSST.url()) || Outbox._delPortal(item.url))) item.body.sesion = Sesion.paraReenvio(item.body.sesion, item.sesionRechazada);
        try {
          const res = await fetch(item.url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(item.body)
          });
          // Se lee como texto: si el servidor responde con una PÁGINA (error de
          // Apps Script, inicio de sesión, implementación borrada), antes eso se
          // confundía con "sin señal" y el pendiente quedaba en cola sin decir
          // por qué. Ahora se guarda lo que respondió y se ve en la lista.
          const texto = await res.text();
          let json;
          try { json = JSON.parse(texto); }
          catch (errParse) {
            await Outbox._anotarError(item.id, Outbox.describirPagina(texto, res.status));
            continue;
          }
          if (json.ok) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else if (Outbox._esTemporal(json)) {
            // El servidor estaba ocupado (bloqueo, servicio de Google caído un
            // momento): no es culpa del registro. Se conserva SIN contar el
            // intento; se reenvía solo en la próxima pasada.
            await Outbox._anotarError(item.id, 'El servidor estaba ocupado; se reintenta solo. (' + (json.error || 'temporal') + ')');
          } else if (json.codigoError === 'SESION' || json.codigoError === 'CAMBIAR') {
            // Falta entrar con el usuario (o cambiar la clave temporal): no es un
            // error del registro. Se conserva sin contar el intento.
            await Outbox._anotarError(item.id, json.codigoError === 'CAMBIAR' ? 'Cambia tu clave temporal (botón 👤) para enviarlo.' : 'Entra con tu usuario (botón 👤) para enviarlo.', json.codigoError === 'SESION');
            if (typeof Sesion !== 'undefined' && json.codigoError === 'SESION' && item.body && item.body.sesion && item.body.sesion === Sesion.token()) Sesion.rechazada();
            if (typeof Sesion !== 'undefined' && !Sesion.get()) Sesion.pintarChip();
          } else if (ClavePortal.esErrorDeClave(json)) {
            // Clave faltante o vieja: NO es un error del permiso. Antes, a los 5
            // intentos se sacaba de la cola y se perdía. Se conserva y se pide
            // la clave; al guardarla se reenvía.
            await Outbox._anotarError(item.id, 'El servidor no aceptó la clave del portal de este equipo.');
            ClavePortal.pedir();
          } else {
            // El servidor respondió pero con error (token inválido, permiso ya
            // cerrado, etc.) — no es un problema de señal, así que reintentar
            // sin límite nunca lo resolvería solo. Tras 5 intentos fallidos se
            // saca de la cola y se avisa, en vez de reintentar para siempre.
            await Outbox._anotarError(item.id, 'El servidor respondió: ' + (json.error || 'error sin detalle'));
            const intentos = await this._incrementarIntentos(item.id);
            if (intentos >= 5) {
              await this.remove(item.id);
              Outbox._avisarFallidoDefinitivo(item, json.error);
            }
          }
        } catch (e) {
          // No hubo respuesta. Puede ser que no haya señal… o que el envío SÍ
          // llegara y se perdiera la respuesta de vuelta: en ese caso el permiso
          // ya está guardado y este pendiente quedaría en cola para siempre,
          // mostrando un aviso que no corresponde. Se comprueba preguntándole al
          // servidor si ese código ya existe.
          const yaEsta = await Outbox._yaFueGuardado(item);
          if (yaEsta) {
            await this.remove(item.id);
            Outbox._avisarEnviado(item);
          } else {
            await Outbox._anotarError(item.id, navigator.onLine
              ? 'No hubo respuesta legible del servidor (' + ((e && e.message) || 'error de red') + '). Con buena señal, esto casi siempre es un ERROR DENTRO DEL SCRIPT: Google lo responde de una forma que el navegador no deja leer. En Apps Script → «Ejecuciones» (ícono de reloj) aparece el error exacto.'
              : 'Sin conexión.');
          }
          // Si no se pudo comprobar, se deja en cola y se reintenta luego.
        }
        if (cd && !(await this.list()).some((x) => x.id === item.id)) trabados.delete(cd);
      }
    } finally {
      this._flushing = false;
      Outbox._avisar();
    }
  },
  async count() {
    return (await this.list()).length;
  },
  /** Texto legible de una respuesta que no es de datos (página de Google). */
  describirPagina(html, status) {
    const t = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    let causa = '';
    if (/inicia(r)? sesi|sign in|acceder|cuenta de google|accounts\.google/i.test(t)) causa = ' Parece la pantalla de inicio de sesión de Google: la implementación no está con «Acceso: Cualquier usuario».';
    else if (/autoriza|authoriz|permis/i.test(t)) causa = ' Parece que falta autorizar el script: en Apps Script ejecuta cualquier función una vez (▶) y acepta los permisos.';
    else if (/no se ha encontrado|not found|no encontr|404/i.test(t + status)) causa = ' La URL no corresponde a una implementación activa: revisa la URL en config.js.';
    else if (/error|exception|línea|line \d/i.test(t)) causa = ' Es un error dentro del script.';
    return 'El servidor respondió con una página en vez de datos (HTTP ' + status + ').' + causa + (t ? ' Texto: «' + t.slice(0, 260) + (t.length > 260 ? '…' : '') + '»' : '');
  },
  /* Error del servidor que se arregla solo al reintentar (no debe agotar los 5 intentos). */
  /** v112: ¿esta dirección es del servidor del portal de la empresa (cualquier módulo)? */
  _delPortal(url) {
    try { const base = typeof EMPRESA !== 'undefined' && EMPRESA.servidor ? String(EMPRESA.servidor).replace(/\/+$/, '') : ''; return !!base && String(url || '').indexOf(base + '/') === 0; } catch (e) { return false; }
  },
  _esTemporal(json) {
    return !!json && (json.codigoError === 'TEMPORAL' ||
      /lock timeout|timed out|tiempo de espera|bloqueo|Service (?:invoked too many times|Spreadsheets failed|unavailable)|servicio no disponible|try again later/i.test(String(json.error || '')));
  },
  async _anotarError(id, msg, sesionRechazada) {
    try {
      const db = await this._db();
      await new Promise((resolve) => {
        const tx = db.transaction('pending', 'readwrite');
        const store = tx.objectStore('pending');
        const g = store.get(id);
        g.onsuccess = () => { const it = g.result; if (it) { it.ultimoError = msg; it.ultimoIntento = new Date().toISOString(); if (sesionRechazada) it.sesionRechazada = true; store.put(it); } };
        tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve();
      });
    } catch (e) { /* no es crítico */ }
  },
  /** ¿El permiso de este pendiente ya está guardado en el servidor? Se usa para
   *  no dejar en cola algo que en realidad ya se envió. Devuelve false ante
   *  cualquier duda (sin señal, respuesta rara): más vale reintentar de más que
   *  descartar un permiso que no se guardó. */
  async _yaFueGuardado(item) {
    try {
      const code = item.body && (item.body.permitCode || item.body.code);
      const token = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.API_TOKEN) || (item.body && item.body.token);
      // Registro diario del anexo: no tiene código; se busca por obra y fecha y
      // cuenta como enviado solo si ESE guardado (su opId) ya está aplicado.
      if (item.body && item.body.action === 'guardarRegistro') {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=registro&obraId=' + encodeURIComponent(item.body.obraId) + '&fecha=' + encodeURIComponent(item.body.fecha) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && Array.isArray(j.opIds) && j.opIds.indexOf(item.body.opId) !== -1);
      }
      // SG-SST (habilitación, reportes, plan de acción, inspecciones…): se
      // pregunta si ESE envío (su opId) ya quedó aplicado.
      if (item.body && /^(guardar|parche|borrar|adjuntar|quitarAdjunto|restaurar)$/.test(item.body.action || '') && item.body.id) {
        if (!item.body.opId || !token) return false;
        const r = await fetch(item.url + '?action=opAplicado&opId=' + encodeURIComponent(item.body.opId) + '&token=' + encodeURIComponent(token));
        const j = await r.json();
        return !!(j && j.ok && j.aplicado);
      }
      if (!code || !token) return false;
      const res = await fetch(item.url + '?code=' + encodeURIComponent(code) + '&token=' + encodeURIComponent(token));
      const json = await res.json();
      if (!json || !json.ok) return false;
      // Un "agregar personal" del ATS solo cuenta como guardado si cada una de
      // esas personas ya aparece en el ATS del servidor (que el ATS exista no
      // basta: si se diera por enviado, esas firmas se perderían).
      if (item.body.action === 'agregarParticipantes') {
        const hay = (json.ats && json.ats.participantes) || [];
        return (item.body.participantes || []).every((p) =>
          hay.some((q) => (p.uid && q.uid === p.uid) || (String(p.cedula || '').trim() && String(q.cedula || '').trim() === String(p.cedula).trim())));
      }
      // Si el pendiente era un CIERRE, solo cuenta como guardado si allá ya
      // figura cerrado; si no, el cierre todavía tiene que salir.
      if (item.body.status === 'CERRADO') return json.status === 'CERRADO';
      if (item.body.action === 'cerrarAts') return json.estado === 'CERRADO';
      // Una charla solo cuenta como enviada si ESE guardado (su opId) ya está
      // aplicado en la semana: que la semana exista no basta, las firmas de
      // ese día se perderían.
      if (item.body.action === 'guardarDia') return !!(json.semana && (json.semana.opIds || []).indexOf(item.body.opId) !== -1);
      return true;
    } catch (e) { return false; }
  },
  _avisar() {
    window.dispatchEvent(new CustomEvent('outbox-cambio'));
  },
  _avisarEnviado(item) {
    window.dispatchEvent(new CustomEvent('outbox-enviado', { detail: item }));
  },
  _avisarFallidoDefinitivo(item, error) {
    window.dispatchEvent(new CustomEvent('outbox-fallido', { detail: { item, error } }));
  }
};
window.addEventListener('online', () => Outbox.flush());

/**
 * OutboxBadge: indicador visible ("N permisos pendientes de enviar") para que
 * el usuario sepa en todo momento si algo quedó en cola sin salir — antes,
 * un permiso podía quedar guardándose en segundo plano sin ningún aviso.
 * Se actualiza solo con los eventos que dispara Outbox.
 */
const OutboxBadge = {
  /* Qué es cada pendiente, según el servidor al que va. Antes todo decía
     "permiso", aunque fuera un ATS o una inspección de EPP. */
  tipoDe(item) {
    const B = (typeof PORTAL_CONFIG !== 'undefined' && PORTAL_CONFIG.BACKENDS) || {};
    const k = Object.keys(B).find((x) => B[x] && B[x].url && B[x].url === item.url);
    if (k === 'ats') return { uno: 'ATS', varios: 'ATS', articulo: 'Un', detalle: 'ATS' };
    if (k === 'epp') return { uno: 'inspección de EPP', varios: 'inspecciones de EPP', articulo: 'Una', detalle: 'Inspección de EPP' };
    if (k === 'personal') return { uno: 'registro de personal', varios: 'registros de personal', articulo: 'Un', detalle: 'Personal autorizado' };
    if (k === 'asistencia') return { uno: 'charla', varios: 'charlas', articulo: 'Una', detalle: 'Asistencia a charla' };
    if (k === 'sgsst') {
      const t = { trabajador: 'Personal habilitado', reporte: 'Reporte SST', accion: 'Plan de acción', mes: 'Indicadores', equipo: 'Equipo', inspeccion: 'Inspección' }[item.body && item.body.tipo] || 'Gestión SST';
      return { uno: 'registro SST', varios: 'registros SST', articulo: 'Un', detalle: t };
    }
    const nombre = k && B[k].nombre ? B[k].nombre : '';
    return { uno: 'permiso', varios: 'permisos', articulo: 'Un', detalle: nombre ? 'Permiso · ' + nombre : 'Permiso' };
  },
  textoBadge(items) {
    const n = items.length;
    const tipos = items.map((it) => this.tipoDe(it));
    const mismo = tipos.every((t) => t.uno === tipos[0].uno);
    if (mismo) return '⏳ ' + n + ' ' + (n === 1 ? tipos[0].uno + ' pendiente' : tipos[0].varios + ' pendientes') + ' de enviar';
    return '⏳ ' + n + ' registros pendientes de enviar';
  },
  init() {
    if (document.getElementById('outboxBadge')) return;
    const el = document.createElement('div');
    el.id = 'outboxBadge';
    el.style.cssText = 'display:none;position:fixed;left:12px;bottom:12px;z-index:9997;background:var(--ambar-600);color:var(--ink);font-weight:700;font-size:var(--fs-menor);padding:8px 14px;border-radius:var(--r-xl);box-shadow:0 2px 10px rgba(0,0,0,.25);';
    document.body.appendChild(el);
    const actualizar = async () => {
      const items = await Outbox.list();
      const n = items.length;
      if (n > 0) {
        el.textContent = OutboxBadge.textoBadge(items);
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    };
    window.addEventListener('outbox-cambio', actualizar);
    window.addEventListener('outbox-enviado', (ev) => {
      actualizar();
      const t = ev && ev.detail && ev.detail.url ? OutboxBadge.tipoDe(ev.detail) : { uno: 'registro', articulo: 'Un' };
      const aviso = document.createElement('div');
      aviso.textContent = '✓ ' + t.articulo + ' ' + t.uno + ' pendiente se envió correctamente.';
      aviso.style.cssText = 'position:fixed;left:12px;bottom:52px;z-index:9998;background:var(--ok);color:#fff;font-weight:600;font-size:var(--fs-menor);padding:8px 14px;border-radius:var(--r-s);box-shadow:0 2px 10px rgba(0,0,0,.25);';
      document.body.appendChild(aviso);
      setTimeout(()=> aviso.remove(), 5000);
    });
    window.addEventListener('outbox-fallido', async (e) => {
      actualizar();
      const t = e.detail && e.detail.item ? OutboxBadge.tipoDe(e.detail.item) : { uno: 'registro' };
      await Dialogo.avisar('No se pudo enviar ' + (t.uno === 'ATS' ? 'un ATS' : 'un(a) ' + t.uno) + ' guardado en cola, incluso con señal (' + (e.detail.error || 'error del servidor') + '). Revísalo manualmente: puede que haya que volver a intentarlo desde el formulario.');
    });

    // El aviso ahora se puede TOCAR para ver qué hay en cola. Antes solo decía
    // "N pendientes" sin forma de saber cuáles ni de quitarlos: si alguno se
    // quedaba trabado, el aviso se volvía permanente y dejaba de significar algo.
    el.style.cursor = 'pointer';
    el.title = 'Toca para ver qué está pendiente';
    el.addEventListener('click', () => OutboxBadge.verPendientes());

    actualizar();
  },

  async verPendientes() {
    const items = await Outbox.list();
    if (!items.length) { await Dialogo.avisar('No hay nada pendiente de enviar.'); return; }

    const fondo = document.createElement('div');
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,35,.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;';
    const caja = document.createElement('div');
    caja.style.cssText = 'background:#fff;border-radius:var(--r-l);max-width:460px;width:100%;max-height:80vh;overflow:auto;padding:18px;font-family:var(--font-family,sans-serif);';
    fondo.appendChild(caja);

    const pinta = (lista) => {
      caja.innerHTML =
        '<h3 style="margin:0 0 4px;font-size:var(--fs-campo);">Pendientes de enviar</h3>' +
        '<p style="margin:0 0 14px;font-size:var(--fs-menor);color:var(--ink-soft);line-height:1.5;">' +
        'Esto se guardó en el celular pero no se ha confirmado que llegara al servidor. ' +
        'Si ya los ves en el dashboard, es que sí llegaron y la confirmación se perdió: usa «Comprobar» para limpiarlos.</p>' +
        lista.map((it,i)=>{
          const code = (it.body && (it.body.permitCode || it.body.code)) || 'sin código';
          const cierre = it.body && (it.body.status === 'CERRADO' || it.body.action === 'cerrarAts');
          const agrego = it.body && (it.body.action === 'agregarParticipantes' || it.body.action === 'addWorkers');
          const tipo = OutboxBadge.tipoDe(it);
          const f = new Date(it.savedAt);
          const cuando = isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-CO') + ' ' + f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
          return '<div style="border:1px solid var(--line);border-radius:var(--r-s);padding:11px;margin-bottom:9px;font-size:var(--fs-menor);line-height:1.5;">' +
            '<span style="color:var(--ink-soft);font-size:var(--fs-menor);">' + esc(tipo.detalle) + '</span><br>' +
            '<b>' + esc(code) + '</b>' + (cierre ? ' <span style="color:var(--warn);">(cierre)</span>' : (agrego ? ' (personal agregado)' : ' (apertura o cambios)')) +
            '<br><span style="color:var(--ink-soft);">Guardado: ' + esc(cuando) + (it.intentos ? ' · ' + it.intentos + ' intento(s)' : '') + '</span>' +
            (it.ultimoError ? '<div style="margin-top:7px;background:var(--rojo-50);border:1px solid var(--rojo-200);color:var(--rojo-900);border-radius:var(--r-s);padding:7px 9px;font-size:var(--fs-menor);line-height:1.45;overflow-wrap:anywhere;"><b>Último intento:</b> ' + esc(it.ultimoError) + '</div>' : '') +
            '<div style="display:flex;gap:7px;margin-top:9px;">' +
            '<button data-comprobar="' + it.id + '" style="flex:1;padding:9px;border:1px solid #1f6f8b;background:#fff;color:#1f6f8b;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);cursor:pointer;">Comprobar</button>' +
            '<button data-descartar="' + it.id + '" style="padding:9px 12px;border:1px solid var(--rojo-300);background:#fff;color:var(--warn);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-menor);cursor:pointer;">Descartar</button>' +
            '</div></div>';
        }).join('') +
        '<button id="obxReenviar" style="width:100%;padding:12px;border:none;background:var(--ambar-600);color:var(--ink);border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;margin:2px 0 8px;">↻ Reenviar ahora</button>' +
        '<div style="display:flex;gap:8px;margin-top:6px;">' +
        '<button id="obxTodos" style="flex:1;padding:12px;border:none;background:var(--ink);color:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Comprobar todos</button>' +
        '<button id="obxCerrar" style="padding:12px 16px;border:1px solid var(--line);background:#fff;border-radius:var(--r-s);font-weight:700;font-size:var(--fs-base);cursor:pointer;">Cerrar</button>' +
        '</div>';

      caja.querySelector('#obxCerrar').onclick = () => fondo.remove();
      const btnRe = caja.querySelector('#obxReenviar');
      btnRe.onclick = async () => {
        btnRe.disabled = true; btnRe.textContent = 'Reenviando…';
        await Outbox.flush();
        const quedan = await Outbox.list();
        if (!quedan.length) { fondo.remove(); await Dialogo.avisar('✓ Todo se envió correctamente.'); return; }
        pinta(quedan);
      };

      const comprobar = async (item) => {
        const ya = await Outbox._yaFueGuardado(item);
        if (ya) { await Outbox.remove(item.id); return true; }
        return false;
      };

      caja.querySelectorAll('[data-comprobar]').forEach(b=>{
        b.onclick = async () => {
          b.disabled = true; b.textContent = 'Comprobando…';
          const item = lista.find(x=>String(x.id)===b.dataset.comprobar);
          const ya = await comprobar(item);
          if (ya) { await Dialogo.avisar('Eso SÍ está guardado en el servidor. Se quita de la cola.'); }
          else { await Dialogo.avisar('Todavía no aparece en el servidor. Se deja en cola para reintentarlo.'); }
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      caja.querySelectorAll('[data-descartar]').forEach(b=>{
        b.onclick = async () => {
          if (!await Dialogo.confirmar('¿Descartar este pendiente? Si no llegó al servidor, se pierde y habrá que volver a diligenciarlo.')) return;
          await Outbox.remove(b.dataset.descartar);
          Outbox._avisar();
          const quedan = await Outbox.list();
          quedan.length ? pinta(quedan) : fondo.remove();
        };
      });

      const btnTodos = caja.querySelector('#obxTodos');
      btnTodos.onclick = async () => {
        btnTodos.disabled = true; btnTodos.textContent = 'Comprobando…';
        let limpiados = 0;
        for (const it of lista) { if (await comprobar(it)) limpiados++; }
        Outbox._avisar();
        const quedan = await Outbox.list();
        await Dialogo.avisar(limpiados
          ? limpiados + ' de ' + lista.length + ' ya estaban guardados en el servidor y se quitaron de la cola.'
          : 'Ninguno aparece todavía en el servidor. Se dejan en cola.');
        quedan.length ? pinta(quedan) : fondo.remove();
      };
    };

    pinta(items);
    fondo.addEventListener('click', (e)=>{ if (e.target === fondo) fondo.remove(); });
    document.body.appendChild(fondo);
  }
};

