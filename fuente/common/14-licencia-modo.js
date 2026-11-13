/* ============================================================
   14-licencia-modo.js — Licencia vencida: solo lectura a los 60 días (v175)
   ------------------------------------------------------------
   Contrato (cláusula séptima, v175): si la licencia vence, el portal sigue
   igual 60 días (el administrador ve el aviso). Pasados 60 días queda en
   SOLO LECTURA: se puede ver, buscar, imprimir y descargar todo, pero no
   registrar cosas nuevas, hasta renovar.
   Siempre se puede (es seguridad de la gente y obligación legal):
     · reportar accidentes, incidentes, actos y condiciones inseguras;
     · el buzón y las quejas de acoso (Decreto 1040 de 2026);
     · entrar, salir y cambiar la clave.
   La licencia la firma el proveedor (ECDSA, licencia.js). Se revisa al abrir
   cada pantalla y el resultado queda en el equipo para que sin señal también aplique.
   ============================================================ */
const LicenciaModo = (function () {
  const GRACIA = 60,
    CLAVE = 'ssta-licencia-modo';
  const MSG =
    'La licencia del portal venció hace más de ' + GRACIA + ' días: el portal está en solo lectura. Puedes ver y descargar todo, ' +
    'reportar accidentes y recibir quejas; para registrar lo demás, pide la renovación a tu proveedor.';
  let solo = false,
    info = null;
  const hoy = () => new Date(Date.now() - 5 * 36e5).toISOString().slice(0, 10);
  const mas = (f, d) => new Date(Date.parse(f + 'T12:00:00Z') + d * 864e5).toISOString().slice(0, 10);
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (c && typeof EMPRESA !== 'undefined' && c.lic === String(EMPRESA.licencia || '').slice(-24)) {
      solo = !!(c.hasta && mas(c.hasta, GRACIA) < hoy());
      info = c;
    }
  } catch (e) {}
  const cargarJs = (src) =>
    new Promise((ok) => {
      if (typeof Licencia !== 'undefined') return ok();
      const s = document.createElement('script');
      s.src = src;
      s.onload = s.onerror = () => ok();
      document.head.appendChild(s);
    });
  const listo = (async () => {
    if (typeof document === 'undefined' || typeof EMPRESA === 'undefined' || !EMPRESA.licencia) {
      solo = false;
      return;
    }
    try {
      await cargarJs('licencia.js');
      if (typeof Licencia === 'undefined') return;
      const r = await Licencia.revisar();
      const hasta = r.estado === 'vencida' && r.datos ? r.datos.hasta : '';
      solo = !!(hasta && mas(hasta, GRACIA) < hoy());
      info = { lic: String(EMPRESA.licencia).slice(-24), estado: r.estado, hasta };
      try {
        localStorage.setItem(CLAVE, JSON.stringify(info));
      } catch (e) {}
    } catch (e) {}
    if (solo) aviso();
  })();
  function aviso() {
    if (!document.body || document.getElementById('licSoloLectura')) return;
    const d = document.createElement('div');
    d.id = 'licSoloLectura';
    d.className = 'lic-solo';
    d.setAttribute('role', 'status');
    d.textContent = 'Solo lectura: la licencia está vencida. Puedes consultar todo y reportar accidentes; para registrar lo demás, renueva con tu proveedor.';
    document.body.insertBefore(d, document.body.firstChild);
  }
  /** ¿Este envío se puede hacer en solo lectura? */
  function permitido(body) {
    if (!body || typeof body !== 'object') return true;
    if (body.__consulta || body.__guia) return true;
    const a = String(body.action || '');
    if (/^(login|logout|salir|sesion|cerrarSesion|cambiarClave|consulta|list|pendientes)$/i.test(a)) return true;
    const t = String(body.tipo || (body.doc && body.doc.tipo) || '');
    return /^(reporte|buzon|queja)$/.test(t);
  }
  /** Lo usa fetchWithRetry antes de cada envío. Devuelve el rechazo o null. */
  async function revisarEnvio(cuerpo) {
    if (!solo) {
      try {
        await Promise.race([listo, new Promise((r) => setTimeout(r, 2500))]);
      } catch (e) {}
    }
    if (!solo) return null;
    let b = cuerpo;
    try {
      if (typeof b === 'string') b = JSON.parse(b);
    } catch (e) {
      return null;
    }
    return permitido(b) ? null : { ok: false, codigoError: 'LICENCIA', error: MSG };
  }
  if (typeof document !== 'undefined' && solo) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aviso);
    else aviso();
  }
  return { revisarEnvio, permitido, listo, soloLectura: () => solo, info: () => info, GRACIA, MSG };
})();
