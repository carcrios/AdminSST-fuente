/* ============================================================
   licencia.js — Licencia de uso del Portal SSTA (v162)
   ------------------------------------------------------------
   Cada empresa cliente tiene una licencia firmada por quien vende el
   portal: NIT, plan, módulos y vigencia. La firma es ECDSA P-256: el
   portal la comprueba con la llave PÚBLICA de abajo; la privada nunca
   está en el sitio (la guarda el proveedor fuera del proyecto).

   Si vence, el portal sigue igual 60 días y avisa al administrador. Pasados
   60 días queda en SOLO LECTURA (fuente/common/14-licencia-modo.js): se ve y
   descarga todo y se pueden reportar accidentes y recibir quejas, pero no
   registrar lo demás. Los datos nunca se bloquean ni se borran (v175).

   Para crear las llaves y firmar licencias: herramientas/licencia.js
   ============================================================ */
const LICENCIA_LLAVE_PUBLICA = {"kty":"EC","crv":"P-256","x":"mEQTH5bTAxAwzqKX8IfwMIp5tTo0UcaoEu5Eo1uS9KM","y":"xCW20SLTuctB7AgbWuiFXvN7AXKW5UjvhoXnWiFKIjU"};   // la pone «node herramientas/licencia.js llaves» (JWK pública)

const SOLO_TXT = 'A los 60 días de vencida, el portal queda en solo lectura (se ve todo y se pueden reportar accidentes, pero no registrar lo demás).';
const Licencia = {
  _b64: (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0)),
  /** Lee y verifica la licencia. {estado: 'sin'|'invalida'|'vencida'|'por-vencer'|'vigente'|'sin-llave', datos} */
  async revisar(texto, hoy) {
    texto = String(texto || (typeof EMPRESA !== 'undefined' && EMPRESA.licencia) || '').trim();
    if (!texto) return { estado: 'sin' };
    const p = texto.split('.'); if (p.length !== 2) return { estado: 'invalida', motivo: 'formato' };
    let datos; try { datos = JSON.parse(new TextDecoder().decode(this._b64(p[0]))); } catch (e) { return { estado: 'invalida', motivo: 'contenido' }; }
    if (!LICENCIA_LLAVE_PUBLICA) return { estado: 'sin-llave', datos };
    try {
      const k = await crypto.subtle.importKey('jwk', LICENCIA_LLAVE_PUBLICA, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, this._b64(p[1]), new TextEncoder().encode(p[0]));
      if (!ok) return { estado: 'invalida', motivo: 'firma', datos };
    } catch (e) { return { estado: 'invalida', motivo: 'firma', datos }; }
    const nitE = String((typeof EMPRESA !== 'undefined' && EMPRESA.nit) || '').replace(/\D/g, '').slice(0, 9), nitL = String(datos.nit || '').replace(/\D/g, '').slice(0, 9);
    if (nitE && nitL && nitE !== nitL) return { estado: 'invalida', motivo: 'nit', datos };
    const h = hoy || new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    if (datos.hasta && datos.hasta < h) return { estado: 'vencida', datos };
    const en30 = new Date(Date.parse(h) + 30 * 864e5).toISOString().slice(0, 10);
    return { estado: datos.hasta && datos.hasta <= en30 ? 'por-vencer' : 'vigente', datos };
  },
  /** Aviso para el administrador (en el inicio). */
  async avisar(el) {
    if (!el || typeof Sesion === 'undefined' || !Sesion.yo || !Sesion.yo() || Sesion.rol() !== 'admin') return;
    const r = await this.revisar(); const d = r.datos || {};
    const txt = { sin: 'Esta empresa no tiene licencia registrada.', invalida: 'La licencia registrada no es válida (' + ({ firma: 'la firma no corresponde', nit: 'es de otro NIT', formato: 'formato', contenido: 'no se pudo leer' }[r.motivo] || r.motivo) + ').',
      vencida: 'La licencia venció el ' + (d.hasta || '') + '.', 'por-vencer': 'La licencia vence el ' + (d.hasta || '') + '.' }[r.estado];
    if (!txt) return;
    const mas = r.estado === 'vencida' ? SOLO_TXT : 'El portal sigue funcionando.';
    el.innerHTML = '<div class="aviso ' + (r.estado === 'por-vencer' ? 'amar' : 'mal') + '"><b>Licencia:</b> ' + txt + ' ' + mas +
      ' Pide la renovación a tu proveedor. <a href="licencia.html">Condiciones de licencia</a></div>';
  }
};
if (typeof module !== 'undefined') module.exports = { Licencia };
