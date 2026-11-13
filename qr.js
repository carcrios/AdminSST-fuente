/* ============================================================
   qr.js — Generador de códigos QR del Portal SSTA
   ------------------------------------------------------------
   POR QUÉ ESTÁ AQUÍ Y NO SE USA UN SERVICIO DE INTERNET

   El portal se usa en planta, muchas veces sin señal. Un QR generado
   por un servicio externo (una imagen pedida a otro sitio) no cargaría
   justo donde más se necesita: al pie del permiso que se va a imprimir
   y pegar en el sitio de trabajo.

   Por eso el código se genera aquí mismo, en el navegador. El archivo
   queda en la caché del Service Worker como el resto del portal.

   QUÉ IMPLEMENTA
   Modo byte (texto/URL), corrección de errores nivel M (recupera ~15%
   del código si se ensucia o se rompe una esquina, que en obra pasa),
   versiones 1 a 10. Una URL de permiso ocupa versión 6.

   Se verificó módulo por módulo contra una librería de referencia para
   varias entradas: el patrón que sale de aquí es idéntico al de esa
   librería. La prueba está en pruebas/pruebas-qr.js.
   ============================================================ */

const QR = (function () {

  /* ── Aritmética en GF(256): la base de la corrección de errores ── */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;            // polinomio generador del estándar
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  /** Polinomio generador para `grado` bytes de corrección. */
  function polGenerador(grado) {
    let p = [1];
    for (let i = 0; i < grado; i++) {
      const q = [1, EXP[i]], r = new Array(p.length + 1).fill(0);
      for (let j = 0; j < p.length; j++)
        for (let k = 0; k < q.length; k++) r[j + k] ^= mul(p[j], q[k]);
      p = r;
    }
    return p;
  }

  /** Bytes de corrección de un bloque de datos. */
  function corregir(datos, grado) {
    const gen = polGenerador(grado);
    const res = new Array(datos.length + grado).fill(0);
    for (let i = 0; i < datos.length; i++) res[i] = datos[i];
    for (let i = 0; i < datos.length; i++) {
      const c = res[i];
      if (c === 0) continue;
      for (let j = 0; j < gen.length; j++) res[i + j] ^= mul(gen[j], c);
    }
    return res.slice(datos.length);
  }

  /* ── Tablas del estándar para nivel M, versiones 1..10 ──
     [ total de bytes, bytes de corrección por bloque,
       bloques del grupo 1, bytes de datos por bloque del grupo 1,
       bloques del grupo 2, bytes de datos por bloque del grupo 2 ] */
  const TABLA_M = {
    1:  [26,   10, 1, 16,  0, 0],
    2:  [44,   16, 1, 28,  0, 0],
    3:  [70,   26, 1, 44,  0, 0],
    4:  [100,  18, 2, 32,  0, 0],
    5:  [134,  24, 2, 43,  0, 0],
    6:  [172,  16, 4, 27,  0, 0],
    7:  [196,  18, 4, 31,  0, 0],
    8:  [242,  22, 2, 38,  2, 39],
    9:  [292,  22, 3, 36,  2, 37],
    10: [346,  26, 4, 43,  1, 44]
  };
  const capacidadDatos = (v) => {
    const t = TABLA_M[v];
    return t[2] * t[3] + t[4] * t[5];
  };

  /* Centros de los patrones de alineación por versión. */
  const ALINEACION = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  /* Información de versión (solo versiones 7 en adelante). */
  const INFO_VERSION = {
    7: 0x07C94, 8: 0x085BC, 9: 0x09A99, 10: 0x0A4D3
  };

  function aBytes(texto) {
    const out = [];
    for (const ch of texto) {
      const c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function construirDatos(bytes, version) {
    const cap = capacidadDatos(version);
    const bits = [];
    const push = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >> i) & 1); };

    push(0b0100, 4);                                   // modo byte
    push(bytes.length, version <= 9 ? 8 : 16);         // longitud
    bytes.forEach(b => push(b, 8));

    const totalBits = cap * 8;
    for (let i = 0; i < 4 && bits.length < totalBits; i++) bits.push(0);   // terminador
    while (bits.length % 8 !== 0) bits.push(0);

    const datos = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      datos.push(b);
    }
    const RELLENO = [0xEC, 0x11];
    let k = 0;
    while (datos.length < cap) datos.push(RELLENO[k++ % 2]);
    return datos;
  }

  /** Intercala bloques de datos y de corrección como manda el estándar. */
  function intercalar(datos, version) {
    const [, ecPorBloque, g1, d1, g2, d2] = TABLA_M[version];
    const bloques = [], ecs = [];
    let p = 0;
    for (let i = 0; i < g1; i++) { const b = datos.slice(p, p + d1); p += d1; bloques.push(b); ecs.push(corregir(b, ecPorBloque)); }
    for (let i = 0; i < g2; i++) { const b = datos.slice(p, p + d2); p += d2; bloques.push(b); ecs.push(corregir(b, ecPorBloque)); }

    const salida = [];
    const maxDatos = Math.max(d1, d2);
    for (let i = 0; i < maxDatos; i++)
      bloques.forEach(b => { if (i < b.length) salida.push(b[i]); });
    for (let i = 0; i < ecPorBloque; i++)
      ecs.forEach(e => salida.push(e[i]));
    return salida;
  }

  /* ── Construcción de la matriz ── */
  function nuevaMatriz(tam) {
    const m = [], reservado = [];
    for (let i = 0; i < tam; i++) { m.push(new Array(tam).fill(0)); reservado.push(new Array(tam).fill(false)); }
    return { m, reservado };
  }

  function ponerBuscador(M, R, fila, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const y = fila + r, x = col + c;
        if (y < 0 || x < 0 || y >= M.length || x >= M.length) continue;
        const dentro = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const negro = dentro && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        M[y][x] = negro ? 1 : 0;
        R[y][x] = true;
      }
    }
  }

  function ponerAlineacion(M, R, version) {
    const centros = ALINEACION[version];
    for (const fy of centros) {
      for (const fx of centros) {
        // No van encima de los tres buscadores.
        if ((fy <= 8 && fx <= 8) || (fy <= 8 && fx >= M.length - 9) || (fy >= M.length - 9 && fx <= 8)) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            M[fy + r][fx + c] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
            R[fy + r][fx + c] = true;
          }
        }
      }
    }
  }

  function ponerTiempos(M, R) {
    const tam = M.length;
    for (let i = 8; i < tam - 8; i++) {
      const v = (i % 2 === 0) ? 1 : 0;
      if (!R[6][i]) { M[6][i] = v; R[6][i] = true; }
      if (!R[i][6]) { M[i][6] = v; R[i][6] = true; }
    }
  }

  function reservarFormato(R, tam) {
    for (let i = 0; i < 9; i++) { R[8][i] = true; R[i][8] = true; }
    for (let i = 0; i < 8; i++) { R[8][tam - 1 - i] = true; R[tam - 1 - i][8] = true; }
  }

  function ponerInfoVersion(M, R, version) {
    if (version < 7) return;
    const info = INFO_VERSION[version];
    const tam = M.length;
    for (let i = 0; i < 18; i++) {
      const bit = (info >> i) & 1;
      const f = Math.floor(i / 3), c = i % 3;
      M[f][tam - 11 + c] = bit; R[f][tam - 11 + c] = true;
      M[tam - 11 + c][f] = bit; R[tam - 11 + c][f] = true;
    }
  }

  function colocarDatos(M, R, bytes) {
    const tam = M.length;
    let bitIdx = 0, subiendo = true;
    const totalBits = bytes.length * 8;
    for (let col = tam - 1; col > 0; col -= 2) {
      if (col === 6) col--;                       // la columna de tiempos se salta
      for (let i = 0; i < tam; i++) {
        const fila = subiendo ? tam - 1 - i : i;
        for (let j = 0; j < 2; j++) {
          const x = col - j;
          if (R[fila][x]) continue;
          let bit = 0;
          if (bitIdx < totalBits) bit = (bytes[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
          M[fila][x] = bit;
        }
      }
      subiendo = !subiendo;
    }
  }

  const MASCARAS = [
    (f, c) => (f + c) % 2 === 0,
    (f) => f % 2 === 0,
    (f, c) => c % 3 === 0,
    (f, c) => (f + c) % 3 === 0,
    (f, c) => (Math.floor(f / 2) + Math.floor(c / 3)) % 2 === 0,
    (f, c) => ((f * c) % 2) + ((f * c) % 3) === 0,
    (f, c) => (((f * c) % 2) + ((f * c) % 3)) % 2 === 0,
    (f, c) => (((f + c) % 2) + ((f * c) % 3)) % 2 === 0
  ];

  const BITS_FORMATO_M = [
    0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0
  ];

  function ponerFormato(M, mascara) {
    const tam = M.length, bits = BITS_FORMATO_M[mascara];
    for (let i = 0; i < 15; i++) {
      const b = (bits >> i) & 1;
      // Primera copia: baja por la columna 8 junto al buscador superior
      // izquierdo y dobla hacia la izquierda por la fila 8.
      if (i < 6) M[i][8] = b;
      else if (i === 6) M[7][8] = b;
      else if (i === 7) M[8][8] = b;
      else if (i === 8) M[8][7] = b;
      else M[8][14 - i] = b;
      // Segunda copia: parte por la fila 8 desde la derecha y sigue por la
      // columna 8 desde abajo. Estar repartida en dos sitios es lo que permite
      // leer el código aunque una esquina esté dañada.
      if (i < 8) M[8][tam - 1 - i] = b;
      else M[tam - 15 + i][8] = b;
    }
    M[tam - 8][8] = 1;                            // módulo siempre negro
  }

  /* Penalización del estándar: se elige la máscara que menos penaliza, que es
     la que resulta más fácil de leer para el escáner. */
  function penalizacion(M) {
    const tam = M.length;
    let p = 0;

    const corridas = (get) => {
      for (let a = 0; a < tam; a++) {
        let run = 1;
        for (let b = 1; b < tam; b++) {
          if (get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) p += 3 + (run - 5);
      }
    };
    corridas((f, c) => M[f][c]);
    corridas((c, f) => M[f][c]);

    for (let f = 0; f < tam - 1; f++)
      for (let c = 0; c < tam - 1; c++) {
        const v = M[f][c];
        if (v === M[f][c + 1] && v === M[f + 1][c] && v === M[f + 1][c + 1]) p += 3;
      }

    const patron = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const patronInv = patron.slice().reverse();
    const buscaPatron = (get) => {
      for (let a = 0; a < tam; a++)
        for (let b = 0; b <= tam - 11; b++) {
          let ok1 = true, ok2 = true;
          for (let k = 0; k < 11; k++) {
            const v = get(a, b + k);
            if (v !== patron[k]) ok1 = false;
            if (v !== patronInv[k]) ok2 = false;
          }
          if (ok1 || ok2) p += 40;
        }
    };
    buscaPatron((f, c) => M[f][c]);
    buscaPatron((c, f) => M[f][c]);

    let negros = 0;
    for (let f = 0; f < tam; f++) for (let c = 0; c < tam; c++) negros += M[f][c];
    const porc = (negros * 100) / (tam * tam);
    p += Math.floor(Math.abs(porc - 50) / 5) * 10;
    return p;
  }

  /**
   * Genera la matriz del código. Devuelve { tam, modulos } donde `modulos[f][c]`
   * vale 1 (negro) o 0 (blanco).
   */
  function generar(texto) {
    const bytes = aBytes(texto);
    // La versión más pequeña donde quepan: 4 bits de modo + el indicador de
    // longitud + los datos.
    let version = 0;
    for (let v = 1; v <= 10; v++) {
      const bitsLongitud = v <= 9 ? 8 : 16;
      const bitsNecesarios = 4 + bitsLongitud + 8 * bytes.length;
      if (bitsNecesarios <= capacidadDatos(v) * 8) { version = v; break; }
    }
    if (!version) throw new Error('El texto es demasiado largo para un código de hasta versión 10.');

    const datos = construirDatos(bytes, version);
    const finales = intercalar(datos, version);
    const tam = 17 + version * 4;

    let mejor = null, mejorP = Infinity;
    for (let mascara = 0; mascara < 8; mascara++) {
      const { m: M, reservado: R } = nuevaMatriz(tam);
      ponerBuscador(M, R, 0, 0);
      ponerBuscador(M, R, 0, tam - 7);
      ponerBuscador(M, R, tam - 7, 0);
      ponerAlineacion(M, R, version);
      ponerTiempos(M, R);
      reservarFormato(R, tam);
      ponerInfoVersion(M, R, version);
      M[tam - 8][8] = 1; R[tam - 8][8] = true;
      colocarDatos(M, R, finales);
      for (let f = 0; f < tam; f++)
        for (let c = 0; c < tam; c++)
          if (!R[f][c] && MASCARAS[mascara](f, c)) M[f][c] ^= 1;
      ponerFormato(M, mascara);
      const p = penalizacion(M);
      if (p < mejorP) { mejorP = p; mejor = M; }
    }
    return { tam, modulos: mejor };
  }

  /** Dibuja el código en un <canvas>. `margen` va en módulos (4 es lo normado). */
  function dibujar(canvas, texto, opciones) {
    opciones = opciones || {};
    const margen = opciones.margen === undefined ? 4 : opciones.margen;
    const { tam, modulos } = generar(texto);
    const total = tam + margen * 2;
    const escala = Math.max(1, Math.floor((opciones.px || 240) / total));
    canvas.width = total * escala;
    canvas.height = total * escala;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let f = 0; f < tam; f++)
      for (let c = 0; c < tam; c++)
        if (modulos[f][c]) ctx.fillRect((c + margen) * escala, (f + margen) * escala, escala, escala);
    return canvas;
  }

  /** Devuelve el código como imagen lista para poner en un <img src="...">. */
  function comoImagen(texto, opciones) {
    const canvas = document.createElement('canvas');
    dibujar(canvas, texto, opciones);
    return canvas.toDataURL('image/png');
  }

  return { generar, dibujar, comoImagen };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QR;
