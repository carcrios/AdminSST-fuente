/* ============================================================
   presupuesto.app.js — Presupuesto del SG-SST con su ejecución (v169)
   ------------------------------------------------------------
   Un presupuesto por año (tipo «presupuesto», id PRE-<año>) con sus rubros, y
   cada gasto (tipo «gasto») contra un rubro. La pantalla muestra, por rubro, lo
   presupuestado, lo gastado, el porcentaje y el saldo; y el total contra lo que
   «debería» llevarse ejecutado a esta altura del año. El PDF con firmas es la
   evidencia del estándar 1.1.3 (asignación de recursos) de la Res. 0312.
   Editan Administrador y SST; los demás roles solo miran.
   ============================================================ */
OfflineBanner.init();
if (typeof UpdateManager !== 'undefined') UpdateManager.init();
const $ = UI.$;
let rows = [];
const de = (t) => rows.filter((x) => x.tipo === t);
const pesos = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const RUBROS_BASE = [
  'Evaluaciones médicas ocupacionales',
  'Elementos de protección personal y dotación',
  'Capacitación y formación (incluye cursos de alturas)',
  'Emergencias: extintores, botiquines, camillas, señalización y brigada',
  'Mediciones higiénicas y estudios',
  'Inspección y mantenimiento de equipos de alturas',
  'Programas de vigilancia, bienestar y pausas activas',
  'Asesoría y auditoría externa en SST',
  'Software, documentación y licencias',
  'Otros',
];
function puedeEditar() {
  const r = typeof Sesion !== 'undefined' && Sesion.rol ? Sesion.rol() : '';
  return !r || r === 'admin' || r === 'sst';
}
function anioSel() {
  return $('anio').value || UI.hoy().slice(0, 4);
}
function presupuestoDe(anio) {
  return de('presupuesto').find((x) => String(x.resumen.anio) === String(anio)) || null;
}
function gastosDe(anio) {
  return de('gasto')
    .filter((x) => String(x.resumen.anio) === String(anio))
    .sort((a, b) => String(b.resumen.fecha).localeCompare(String(a.resumen.fecha)));
}

async function cargar() {
  if (UI.avisoServidor($('avisoSrv'))) {
    $('resumen').innerHTML = '';
    return;
  }
  const r = await SGSST.listar('presupuesto,gasto,plananual');
  UI.avisoCopia($('avisoCopia'), r);
  rows = r.rows || [];
  llenarAnios();
  pintar();
}
function llenarAnios() {
  const h = Number(UI.hoy().slice(0, 4)),
    ya = $('anio').value,
    s = new Set([h, h + 1]);
  de('presupuesto')
    .concat(de('gasto'))
    .forEach((x) => {
      const a = Number(x.resumen.anio);
      if (a > 2000 && a < 2100) s.add(a);
    });
  $('anio').innerHTML = [...s]
    .sort((a, b) => b - a)
    .map((a) => '<option value="' + a + '">' + a + '</option>')
    .join('');
  $('anio').value = ya || String(h);
}

/** Ejecución por rubro: [{ id, rubro, presupuestado, ejecutado }] (+ «Sin rubro» si hay gastos sueltos). */
function ejecucion(p, gastos) {
  const l = ((p && p.resumen.rubros) || []).map((r) => ({ id: r.id, rubro: r.rubro, presupuestado: Number(r.valor) || 0, ejecutado: 0 }));
  const porId = {};
  l.forEach((r) => {
    porId[r.id] = r;
  });
  gastos.forEach((g) => {
    const r = porId[g.resumen.rubroId];
    if (r) r.ejecutado += Number(g.resumen.valor) || 0;
    else {
      porId._s = porId._s || { id: '', rubro: 'Sin rubro (revisar)', presupuestado: 0, ejecutado: 0 };
      porId._s.ejecutado += Number(g.resumen.valor) || 0;
    }
  });
  if (porId._s) l.push(porId._s);
  return l;
}
function pintar() {
  const anio = anioSel(),
    p = presupuestoDe(anio),
    gastos = gastosDe(anio),
    ed = puedeEditar();
  if (!p) {
    $('resumen').innerHTML =
      '<div class="empty">No hay presupuesto del SG-SST para ' +
      esc(anio) +
      '.</div>' +
      (ed
        ? '<button type="button" class="btn amber" id="armar">Armar el presupuesto de ' + esc(anio) + '</button>'
        : '<p class="ayuda">Lo arma el administrador o el área SST.</p>');
    $('cGastos').hidden = !gastos.length;
    pintarGastos(p, gastos);
    if (ed) $('armar').addEventListener('click', () => editarPresupuesto(anio, null));
    return;
  }
  const s = p.resumen,
    l = ejecucion(p, gastos),
    tP = l.reduce((a, r) => a + r.presupuestado, 0),
    tE = l.reduce((a, r) => a + r.ejecutado, 0);
  const h = UI.hoy(),
    esperado = String(anio) < h.slice(0, 4) ? 100 : String(anio) > h.slice(0, 4) ? 0 : Math.round((Number(h.slice(5, 7)) / 12) * 100);
  const barra = (e, pr) => {
    const v = pct(e, pr);
    return (
      '<div class="pp-barra" role="img" aria-label="' +
      v +
      ' % ejecutado"><i class="' +
      (v > 100 ? 'mal' : '') +
      '" style="width:' +
      Math.min(100, v) +
      '%"></i></div>'
    );
  };
  const alerta =
    tE > tP
      ? '<div class="aviso mal">Se gastó más de lo presupuestado: ' +
        esc(pesos(tE - tP)) +
        ' por encima. Ajusta el presupuesto y deja la aprobación de la gerencia.</div>'
      : esperado && pct(tE, tP) + 25 < esperado
        ? '<div class="aviso alerta">La ejecución va en ' +
          pct(tE, tP) +
          ' % y a esta altura del año debería ir cerca del ' +
          esperado +
          ' %. Revisa si hay actividades del plan anual sin hacer.</div>'
        : '';
  $('resumen').innerHTML =
    '<p class="ayuda">' +
    (s.aprobadoPor
      ? 'Aprobado por ' + esc(s.aprobadoPor) + (s.fechaAprobacion ? ' el ' + esc(UI.corta(s.fechaAprobacion)) : '')
      : 'Sin aprobación registrada') +
    (s.responsable ? ' · Responsable: ' + esc(s.responsable) : '') +
    '</p>' +
    alerta +
    '<table class="pp-tabla"><thead><tr><th>Rubro</th><th class="n">Presupuestado</th><th class="n">Ejecutado</th><th class="n ocultar-cel">Saldo</th></tr></thead><tbody>' +
    l
      .map(
        (r) =>
          '<tr><td>' +
          esc(r.rubro) +
          barra(r.ejecutado, r.presupuestado) +
          '</td><td class="n">' +
          esc(pesos(r.presupuestado)) +
          '</td><td class="n">' +
          esc(pesos(r.ejecutado)) +
          '<br><small>' +
          pct(r.ejecutado, r.presupuestado) +
          ' %</small></td><td class="n ocultar-cel">' +
          esc(pesos(r.presupuestado - r.ejecutado)) +
          '</td></tr>',
      )
      .join('') +
    '<tr class="pp-tot"><td>Total' +
    barra(tE, tP) +
    '</td><td class="n">' +
    esc(pesos(tP)) +
    '</td><td class="n">' +
    esc(pesos(tE)) +
    '<br><small>' +
    pct(tE, tP) +
    ' %</small></td><td class="n ocultar-cel">' +
    esc(pesos(tP - tE)) +
    '</td></tr>' +
    '</tbody></table>' +
    (esperado && esperado < 100 ? '<p class="ayuda">A esta altura del año, una ejecución pareja iría en ' + esperado + ' %.</p>' : '') +
    '<div class="fila-btn">' +
    (ed ? '<button type="button" class="btn ghost" id="editarP">Editar rubros y aprobación</button>' : '') +
    '<button type="button" class="btn ghost" id="pdfP">🖨️ PDF de la ejecución (con firmas)</button><button type="button" class="btn ghost" id="csvP">⬇️ Gastos en CSV</button></div>';
  if (ed) $('editarP').addEventListener('click', () => editarPresupuesto(anio, p));
  $('pdfP').addEventListener('click', () => pdf(anio, p, l, gastos, tP, tE));
  $('csvP').addEventListener('click', () => csv(anio, gastos));
  $('cGastos').hidden = false;
  pintarGastos(p, gastos);
}
function pintarGastos(p, gastos) {
  const ed = puedeEditar(),
    f = $('fRubro'),
    ya = f.value,
    rub = (p && p.resumen.rubros) || [];
  f.innerHTML = '<option value="">Todos</option>' + rub.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.rubro) + '</option>').join('');
  f.value = rub.some((r) => r.id === ya) ? ya : '';
  $('nGasto').hidden = !ed || !p;
  const l = gastos.filter((g) => !f.value || g.resumen.rubroId === f.value);
  $('gastos').innerHTML = l.length
    ? l
        .map((g) => {
          const s = g.resumen;
          return (
            '<button type="button" class="item" data-g="' +
            esc(g.id) +
            '"' +
            (ed ? '' : ' disabled') +
            '><div class="pp-gasto"><div><div class="t">' +
            esc(s.concepto) +
            '</div><div class="m">' +
            esc(UI.corta(s.fecha)) +
            ' · ' +
            esc(s.rubro || 'Sin rubro') +
            (s.proveedor ? ' · ' + esc(s.proveedor) : '') +
            (s.soporte ? ' · ' + esc(s.soporte) : '') +
            '</div></div><div class="v">' +
            esc(pesos(s.valor)) +
            '</div></div></button>'
          );
        })
        .join('')
    : '<div class="empty">' +
      (p ? 'No hay gastos registrados' + (f.value ? ' en este rubro' : '') + '.' : 'Primero arma el presupuesto del año.') +
      '</div>';
  if (ed)
    $('gastos')
      .querySelectorAll('[data-g]')
      .forEach((b) =>
        b.addEventListener('click', async () => {
          const d = await Registros.abrir(b.dataset.g);
          if (d) editarGasto(p, d);
        }),
      );
}

/* ── Formularios ── */
function editarPresupuesto(anio, p) {
  const d = p ? Object.assign({}, p.resumen) : { anio, rubros: RUBROS_BASE.map((r, i) => ({ id: 'R' + (i + 1), rubro: r, valor: '' })) };
  let rub = (d.rubros || []).map((r) => Object.assign({}, r));
  const fila = (r, i) =>
    '<div class="fila2" data-i="' +
    i +
    '"><input type="text" aria-label="Rubro" value="' +
    esc(r.rubro) +
    '" data-k="rubro"><input type="number" inputmode="numeric" min="0" step="1000" aria-label="Valor presupuestado" placeholder="Valor (COP)" value="' +
    esc(r.valor) +
    '" data-k="valor">' +
    '<button type="button" class="btn ghost" data-quitar="' +
    i +
    '" aria-label="Quitar este rubro">✕</button></div>';
  const m = UI.modal(
    '<h3>Presupuesto del SG-SST ' +
      esc(anio) +
      '</h3><p class="ayuda">Un rubro por línea, con el valor en pesos. Los gastos se registran después contra cada rubro.</p>' +
      '<div id="ppRub"></div><button type="button" class="btn ghost" id="ppMas">+ Agregar rubro</button>' +
      '<div class="field"><label for="ppResp">Responsable del SG-SST</label><input type="text" id="ppResp" value="' +
      esc(d.responsable || '') +
      '"></div>' +
      '<div class="field"><label for="ppAprob">Aprobado por (gerencia)</label><input type="text" id="ppAprob" value="' +
      esc(d.aprobadoPor || '') +
      '"></div>' +
      '<div class="field"><label for="ppFecha">Fecha de aprobación</label><input type="date" id="ppFecha" value="' +
      esc(d.fechaAprobacion || '') +
      '"></div>' +
      '<button type="button" class="btn amber" id="ppGuardar">Guardar</button><button type="button" class="btn ghost" data-cerrar>Cancelar</button><div class="status-msg" id="ppMsg"></div>',
    true,
  );
  const caja = m.el.querySelector('#ppRub');
  const leerFilas = () => {
    caja.querySelectorAll('[data-i]').forEach((f) => {
      const i = Number(f.dataset.i);
      rub[i].rubro = f.querySelector('[data-k=rubro]').value;
      rub[i].valor = f.querySelector('[data-k=valor]').value;
    });
  };
  const dibujar = () => {
    caja.innerHTML = rub.map(fila).join('');
    caja.querySelectorAll('[data-quitar]').forEach((b) =>
      b.addEventListener('click', () => {
        leerFilas();
        const i = Number(b.dataset.quitar);
        const usados = gastosDe(anio).filter((g) => g.resumen.rubroId === rub[i].id).length;
        if (usados) {
          m.el.querySelector('#ppMsg').textContent = 'Ese rubro tiene ' + usados + ' gasto(s): cámbialos de rubro antes de quitarlo.';
          return;
        }
        rub.splice(i, 1);
        dibujar();
      }),
    );
  };
  dibujar();
  m.el.querySelector('#ppMas').addEventListener('click', () => {
    leerFilas();
    rub.push({ id: 'R' + Date.now().toString(36), rubro: '', valor: '' });
    dibujar();
    caja.querySelector('[data-i="' + (rub.length - 1) + '"] input').focus();
  });
  m.el.querySelector('#ppGuardar').addEventListener('click', async () => {
    leerFilas();
    const msg = m.el.querySelector('#ppMsg'),
      limpio = rub.filter((r) => String(r.rubro).trim() || String(r.valor).trim());
    const mal = limpio.find((r) => !String(r.rubro).trim() || !(Number(r.valor) >= 0) || String(r.valor).trim() === '');
    if (!limpio.length) {
      msg.textContent = 'Agrega al menos un rubro con su valor.';
      return;
    }
    if (mal) {
      msg.textContent = 'Revisa el rubro «' + (mal.rubro || 'sin nombre') + '»: le falta el nombre o el valor (0 o más).';
      return;
    }
    const fA = m.el.querySelector('#ppFecha').value;
    if (fA && typeof Valida !== 'undefined' && Valida.pasada(fA)) {
      msg.textContent = 'La fecha de aprobación no puede ser futura.';
      return;
    }
    const rubros = limpio.map((r) => ({ id: r.id, rubro: String(r.rubro).trim().slice(0, 120), valor: Math.round(Number(r.valor)) }));
    const doc = {
      anio: String(anio),
      rubros,
      totalPresupuestado: rubros.reduce((a, r) => a + r.valor, 0),
      responsable: m.el.querySelector('#ppResp').value.trim(),
      aprobadoPor: m.el.querySelector('#ppAprob').value.trim(),
      fechaAprobacion: fA,
      estado: m.el.querySelector('#ppAprob').value.trim() ? 'APROBADO' : 'BORRADOR',
    };
    msg.textContent = 'Guardando…';
    const r = await Registros.guardar('presupuesto', p ? p.id : 'PRE-' + anio, doc, p ? p.version : 0);
    if (typeof r === 'string') {
      msg.textContent = r;
      return;
    }
    m.cerrar();
    UI.toast('✓ Presupuesto guardado');
    cargar();
  });
}
function editarGasto(p, d) {
  const rub = (p && p.resumen.rubros) || [];
  const campos = [
    { k: 'rubroId', l: 'Rubro', t: 'select', op: rub.map((r) => [r.id, r.rubro]), req: true },
    { k: 'fecha', l: 'Fecha', t: 'date', req: true, medio: true },
    { k: 'valor', l: 'Valor (COP)', t: 'number', req: true, medio: true },
    { k: 'concepto', l: 'Concepto', req: true, ph: 'Ej: 20 arneses con certificación' },
    { k: 'proveedor', l: 'Proveedor', medio: true },
    { k: 'soporte', l: 'Factura o soporte', medio: true, ph: 'Ej: FE-1234' },
  ];
  Registros.editar({
    titulo: d.nuevo ? 'Nuevo gasto del SG-SST' : 'Gasto del SG-SST',
    campos,
    datos: d,
    borrar: d.nuevo
      ? null
      : async () => {
          const ok = await Registros.borrar(d.id, 'Borrado desde Presupuesto');
          if (ok) cargar();
          return ok;
        },
    alGuardar: async (v) => {
      if (!(Number(v.valor) > 0)) return 'El valor debe ser mayor que cero.';
      if (typeof Valida !== 'undefined' && Valida.pasada(v.fecha)) return 'La fecha no puede ser futura.';
      if (String(v.fecha).slice(0, 4) !== String(anioSel())) return 'La fecha debe ser del año ' + anioSel() + '. Para otro año, cámbialo arriba.';
      const r0 = rub.find((r) => r.id === v.rubroId);
      const doc = {
        anio: String(anioSel()),
        rubroId: v.rubroId,
        rubro: r0 ? r0.rubro : '',
        fecha: v.fecha,
        valor: Math.round(Number(v.valor)),
        concepto: String(v.concepto).trim(),
        proveedor: v.proveedor || '',
        soporte: v.soporte || '',
      };
      const r = await Registros.guardar('gasto', d.id, doc, d.nuevo ? 0 : d.version);
      if (typeof r === 'string') return r;
      cargar();
      return true;
    },
  });
}

/* ── Salidas ── */
function pdf(anio, p, l, gastos, tP, tE) {
  const s = p.resumen;
  UI.imprimir([
    UI.cabecera(
      'SG-PRESUPUESTO',
      'EJECUCIÓN DEL PRESUPUESTO DEL SG-SST ' + anio,
      'Recursos asignados al SG-SST (Res. 0312 de 2019, estándar 1.1.3; Decreto 1072 de 2015, art. 2.2.4.6.8)',
    ) +
      '<table><tr><th>Rubro</th><th>Presupuestado</th><th>Ejecutado</th><th>%</th><th>Saldo</th></tr>' +
      l
        .map(
          (r) =>
            '<tr><td>' +
            esc(r.rubro) +
            '</td><td class="a">' +
            esc(pesos(r.presupuestado)) +
            '</td><td class="a">' +
            esc(pesos(r.ejecutado)) +
            '</td><td class="a">' +
            pct(r.ejecutado, r.presupuestado) +
            ' %</td><td class="a">' +
            esc(pesos(r.presupuestado - r.ejecutado)) +
            '</td></tr>',
        )
        .join('') +
      '<tr><td><b>Total</b></td><td class="a"><b>' +
      esc(pesos(tP)) +
      '</b></td><td class="a"><b>' +
      esc(pesos(tE)) +
      '</b></td><td class="a"><b>' +
      pct(tE, tP) +
      ' %</b></td><td class="a"><b>' +
      esc(pesos(tP - tE)) +
      '</b></td></tr></table>' +
      (gastos.length
        ? '<h3>Detalle de gastos</h3><table><tr><th>Fecha</th><th>Rubro</th><th>Concepto</th><th>Proveedor</th><th>Soporte</th><th>Valor</th></tr>' +
          gastos
            .slice()
            .reverse()
            .map((g) => {
              const x = g.resumen;
              return (
                '<tr><td>' +
                esc(UI.corta(x.fecha)) +
                '</td><td>' +
                esc(x.rubro) +
                '</td><td>' +
                esc(x.concepto) +
                '</td><td>' +
                esc(x.proveedor || '') +
                '</td><td>' +
                esc(x.soporte || '') +
                '</td><td class="a">' +
                esc(pesos(x.valor)) +
                '</td></tr>'
              );
            })
            .join('') +
          '</table>'
        : '') +
      '<p style="font-size:10px;margin-top:8px">Aprobado por: ' +
      esc(s.aprobadoPor || '—') +
      (s.fechaAprobacion ? ' el ' + esc(UI.corta(s.fechaAprobacion)) : '') +
      '. Corte: ' +
      esc(UI.corta(UI.hoy())) +
      '.</p>' +
      '<table style="margin-top:28px"><tr><td style="height:60px;vertical-align:bottom">_________________________<br>Representante legal / gerencia</td>' +
        '<td style="vertical-align:bottom">_________________________<br>Responsable del SG-SST</td></tr></table>',
  ]);
}
function csv(anio, gastos) {
  const c = (x) => {
    const v = String(x == null ? '' : x);
    return /[";\n]|^[=+\-@]/.test(v) ? '"' + v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""') + '"' : v;
  };
  const txt =
    '﻿' +
    ['fecha;rubro;concepto;proveedor;soporte;valor']
      .concat(
        gastos.map((g) => {
          const x = g.resumen;
          return [x.fecha, x.rubro, x.concepto, x.proveedor, x.soporte, x.valor].map(c).join(';');
        }),
      )
      .join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = 'gastos-sgsst-' + anio + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

$('anio').addEventListener('change', pintar);
$('fRubro').addEventListener('change', () => {
  const anio = anioSel();
  pintarGastos(presupuestoDe(anio), gastosDe(anio));
});
$('nGasto').addEventListener('click', () => {
  const anio = anioSel(),
    p = presupuestoDe(anio);
  if (!p) return;
  const h = UI.hoy();
  editarGasto(p, {
    id: SGSST.nuevoId('GAS'),
    nuevo: true,
    fecha: String(anio) === h.slice(0, 4) ? h : anio + '-12-31',
    rubroId: $('fRubro').value || ((p.resumen.rubros || [])[0] || {}).id || '',
  });
});
window.addEventListener('outbox-enviado', () => cargar());
cargar();
