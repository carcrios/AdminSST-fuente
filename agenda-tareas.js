/* ============================================================
   agenda-tareas.js — Tus tareas y recordatorios en el calendario de Gestión (v174)
   ------------------------------------------------------------
   «+ Tarea» anota algo tuyo (título, día, hora, cuándo recordarlo). Se guarda en el
   servidor (tipo «tarea») con tu nombre como responsable, así:
   · aparece en el calendario y en «Para hoy y esta semana»;
   · el correo diario de avisos te la recuerda (el día, o 1, 3 o 7 días antes);
   · si tienes el portal abierto, a la hora de la tarea sale un aviso en pantalla.
   «✓ Hecha» la cierra.
   ============================================================ */
(function () {
  const btn = document.getElementById('agNueva');
  if (!btn || typeof SGSST === 'undefined' || !SGSST.url()) {
    if (btn) btn.hidden = true;
    return;
  }
  const yo = () => (typeof Sesion !== 'undefined' && Sesion.yo && Sesion.yo()) || null;
  const escH = (t) =>
    String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const hoyISO = () =>
    typeof Festivos !== 'undefined' && Festivos.hoy ? Festivos.hoy() : new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
  const RECORDAR = ['El mismo día', 'Un día antes', 'Tres días antes', 'Una semana antes'];
  const otraVez = () => {
    if (window.__pendTraer) window.__pendTraer();
  };

  function formulario() {
    if (document.getElementById('tareaFondo')) return;
    const dia = (window.Agenda && window.Agenda.dia && window.Agenda.dia()) || hoyISO();
    const f = document.createElement('div');
    f.id = 'tareaFondo';
    f.className = 'clave-fondo';
    f.innerHTML =
      '<div class="clave-caja" role="dialog" aria-modal="true" aria-labelledby="tareaTit"><h3 id="tareaTit">Nueva tarea</h3>' +
      '<form id="tareaForm"><div class="field"><label for="tTit">Qué hay que hacer</label><input id="tTit" maxlength="140" required placeholder="Ej.: Llamar a la ARL por el FURAT"></div>' +
      '<div class="grid2"><div class="field"><label for="tFec">Día</label><input type="date" id="tFec" required value="' +
      escH(dia) +
      '"></div>' +
      '<div class="field"><label for="tHora">Hora (opcional)</label><input type="time" id="tHora"></div></div>' +
      '<div class="field"><label for="tRec">Recordármela</label><select id="tRec">' +
      RECORDAR.map((r) => '<option>' + escH(r) + '</option>').join('') +
      '</select></div>' +
      '<div class="field"><label for="tNot">Notas (opcional)</label><textarea id="tNot" rows="2" maxlength="500"></textarea></div>' +
      '<p class="ayuda">Te llega en el correo diario de avisos y sale en el calendario. Con el portal abierto, también te avisa a la hora.</p>' +
      '<div class="fila-btn"><button type="submit" class="btn amber" id="tGuardar">Guardar tarea</button><button type="button" class="btn ghost" id="tCancelar">Cancelar</button></div>' +
      '<p class="status-msg" id="tMsg" aria-live="polite"></p></form></div>';
    document.body.appendChild(f);
    const cerrar = () => {
      f.remove();
      btn.focus();
    };
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrar();
    });
    f.addEventListener('click', (e) => {
      if (e.target === f) cerrar();
    });
    document.getElementById('tCancelar').addEventListener('click', cerrar);
    document.getElementById('tTit').focus();
    document.getElementById('tareaForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const titulo = document.getElementById('tTit').value.trim(),
        fecha = document.getElementById('tFec').value;
      if (titulo.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        document.getElementById('tMsg').textContent = 'Escribe la tarea y el día.';
        return;
      }
      const y = yo() || {};
      const doc = {
        titulo,
        fecha,
        hora: document.getElementById('tHora').value || '',
        recordar: document.getElementById('tRec').value,
        notas: document.getElementById('tNot').value.trim(),
        responsable: y.nombre || '',
        usuario: y.usuario || '',
        estado: 'PENDIENTE',
      };
      document.getElementById('tGuardar').disabled = true;
      const r = await SGSST.enviar({ action: 'guardar', tipo: 'tarea', id: SGSST.nuevoId('TAR'), doc }, { titulo, fecha, estado: 'PENDIENTE' });
      document.getElementById('tGuardar').disabled = false;
      if (!r.ok) {
        document.getElementById('tMsg').textContent = r.error || 'No se pudo guardar.';
        return;
      }
      cerrar();
      if (typeof UI !== 'undefined' && UI.toast) UI.toast(r.enCola ? '⏳ Tarea guardada; se envía cuando haya señal' : '✓ Tarea anotada');
      setTimeout(otraVez, 400);
    });
  }
  btn.addEventListener('click', formulario);

  // ✓ Hecha (en el calendario o en la lista de la semana)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-hecha]');
    if (!b) return;
    e.preventDefault();
    b.disabled = true;
    const r = await SGSST.enviar({ action: 'parche', tipo: 'tarea', id: b.dataset.hecha, campos: { estado: 'HECHA', hechaEl: hoyISO() } });
    if (!r.ok) {
      b.disabled = false;
      if (typeof UI !== 'undefined' && UI.toast) UI.toast(r.error || 'No se pudo marcar.', 'mal');
      return;
    }
    if (typeof UI !== 'undefined' && UI.toast) UI.toast('✓ Hecha');
    const it = b.closest('.p-item');
    if (it) it.remove();
    setTimeout(otraVez, 400);
  });

  // Aviso en pantalla a la hora de la tarea (si el portal está abierto)
  const programadas = {};
  document.addEventListener('ssta-pend', () => {
    const p = window.__sstaPend || {},
      hoy = p.hoy || hoyISO();
    (p.mios || [])
      .filter((x) => x.tipo === 'tarea' && x.fecha === hoy && !/^Recordatorio:/.test(x.texto || ''))
      .forEach((x) => {
        const m = /\((\d{2}):(\d{2})\)$/.exec(x.texto || '');
        if (!m || programadas[x.id]) return;
        const cuando = new Date();
        cuando.setHours(Number(m[1]), Number(m[2]), 0, 0);
        const falta = cuando.getTime() - Date.now();
        if (falta < 0 || falta > 16 * 3600000) return;
        programadas[x.id] = setTimeout(() => {
          const t = String(x.texto || '').replace(/^Tarea: /, '');
          if (typeof Dialogo !== 'undefined') Dialogo.avisar('⏰ Es hora: ' + t);
          try {
            if ('Notification' in window && Notification.permission === 'granted') new Notification('Portal SSTA', { body: t });
          } catch (er) {}
        }, falta);
      });
  });
})();
